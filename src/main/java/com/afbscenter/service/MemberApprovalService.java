package com.afbscenter.service;

import com.afbscenter.controller.MemberDetailController;
import com.afbscenter.controller.MemberProductController;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.Member.MemberStatus;
import com.afbscenter.model.MemberApprovalRequest;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberApprovalRequestRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * 회원 승인 큐: 신규 가입(NEW_MEMBER), 이용권 연장(EXTENSION), 재등록(RE_REGISTER) 등은
 * 관리자·매니저 승인 후 반영한다.
 * <p>
 * 정책: {@code afbscenter.member.approval-policy-effective-at} 이전에 DB에 있던 회원은
 * {@link com.afbscenter.config.DatabaseMigration} 에서 이미 승인된 것으로 정리한다.
 * 그 이후 발생하는 가입·연장·재등록 요청은 본 서비스의 대기 건으로 처리한다.
 */
@Service
public class MemberApprovalService {

    private static final Logger logger = LoggerFactory.getLogger(MemberApprovalService.class);
    private static final DateTimeFormatter ISO_LDT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final MemberApprovalRequestRepository memberApprovalRequestRepository;
    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final MemberProductRepository memberProductRepository;
    private final MemberService memberService;
    private final MemberProductController memberProductController;
    private final MemberDetailController memberDetailController;
    private final ObjectMapper objectMapper;
    /** 내부 호출 시 @Transactional 적용을 위해 프록시로 승인 처리 */
    private final MemberApprovalService self;

    public MemberApprovalService(MemberApprovalRequestRepository memberApprovalRequestRepository,
                                 MemberRepository memberRepository,
                                 CoachRepository coachRepository,
                                 MemberProductRepository memberProductRepository,
                                 @Lazy MemberService memberService,
                                 @Lazy MemberProductController memberProductController,
                                 @Lazy MemberDetailController memberDetailController,
                                 ObjectMapper objectMapper,
                                 @Lazy MemberApprovalService self) {
        this.memberApprovalRequestRepository = memberApprovalRequestRepository;
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.memberProductRepository = memberProductRepository;
        this.memberService = memberService;
        this.memberProductController = memberProductController;
        this.memberDetailController = memberDetailController;
        this.objectMapper = objectMapper;
        this.self = self;
    }

    /**
     * 신규 가입 직후(회원 상태 PENDING_APPROVAL) 이용권 POST가 오면 RE_REGISTER 대기를 새로 만들지 않고,
     * 기존 NEW_MEMBER 승인 요청의 {@code approvalPayload}(JSON 배열)에 합친다. 승인 1번으로 가입+이용권 반영.
     */
    @Transactional
    public Optional<MemberApprovalRequest> mergeInitialProductIntoPendingNewMember(
            Long memberId,
            String singleProductPayloadJson,
            String productNameHint) {
        Member member = memberRepository.findById(memberId).orElse(null);
        if (member == null || member.getStatus() != MemberStatus.PENDING_APPROVAL) {
            return Optional.empty();
        }
        Optional<MemberApprovalRequest> pendingNew = memberApprovalRequestRepository
                .findFirstByMember_IdAndStatusAndRequestTypeOrderByRequestedAtDesc(
                        memberId,
                        MemberApprovalRequest.Status.PENDING,
                        MemberApprovalRequest.RequestType.NEW_MEMBER);
        if (pendingNew.isEmpty()) {
            return Optional.empty();
        }
        MemberApprovalRequest r = pendingNew.get();
        try {
            ArrayNode arr;
            String existing = r.getApprovalPayload();
            if (existing == null || existing.isBlank()) {
                arr = objectMapper.createArrayNode();
            } else {
                JsonNode node = objectMapper.readTree(existing);
                if (node.isArray()) {
                    arr = (ArrayNode) node;
                } else {
                    arr = objectMapper.createArrayNode();
                    arr.add(node);
                }
            }
            arr.add(objectMapper.readTree(singleProductPayloadJson));
            r.setApprovalPayload(objectMapper.writeValueAsString(arr));
        } catch (JsonProcessingException e) {
            logger.warn("신규 가입 이용권 merge JSON 실패 memberId={}: {}", memberId, e.getMessage());
            return Optional.empty();
        }
        String label = productNameHint != null && !productNameHint.isBlank() ? productNameHint.trim() : "상품";
        String ds = r.getDetailSummary();
        if (ds == null || ds.isBlank()) {
            r.setDetailSummary("신규 회원 등록 · " + label);
        } else if (!ds.contains(label)) {
            r.setDetailSummary(ds + " · " + label);
        }
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        logger.info("신규(NEW_MEMBER) 승인 건에 초기 이용권 merge: memberId={}, requestId={}", memberId, saved.getId());
        return Optional.of(saved);
    }

    @Transactional
    public Optional<MemberApprovalRequest> createPendingIfAbsent(
            Long memberId,
            MemberApprovalRequest.RequestType requestType,
            String requestedBy,
            String detailSummary) {
        if (memberId == null) {
            return Optional.empty();
        }
        if (memberApprovalRequestRepository.existsByMember_IdAndStatusAndRequestType(
                memberId, MemberApprovalRequest.Status.PENDING, requestType)) {
            logger.debug("승인 요청 이미 존재: memberId={}, type={}", memberId, requestType);
            return Optional.empty();
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        MemberApprovalRequest r = new MemberApprovalRequest();
        r.setMember(member);
        r.setRequestType(requestType);
        r.setStatus(MemberApprovalRequest.Status.PENDING);
        r.setRequestedBy(requestedBy);
        r.setRequestedAt(LocalDateTime.now());
        r.setDetailSummary(detailSummary);
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        logger.info("회원 승인 요청 등록: id={}, memberId={}, type={}, by={}", saved.getId(), memberId, requestType, requestedBy);
        return Optional.of(saved);
    }

    /**
     * 이용권 연장 승인 요청 (동일 이용권에 대기 건이 있으면 생략)
     */
    @Transactional
    public Optional<MemberApprovalRequest> createExtensionPendingIfAbsent(
            Long memberId,
            Long memberProductId,
            Integer extendDays,
            String requestedBy,
            String detailSummary) {
        if (memberId == null || memberProductId == null || extendDays == null || extendDays <= 0) {
            return Optional.empty();
        }
        if (memberApprovalRequestRepository.existsByExtensionMemberProductIdAndStatus(
                memberProductId, MemberApprovalRequest.Status.PENDING)) {
            logger.debug("연장 승인 요청 이미 존재: memberProductId={}", memberProductId);
            return Optional.empty();
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        MemberApprovalRequest r = new MemberApprovalRequest();
        r.setMember(member);
        r.setRequestType(MemberApprovalRequest.RequestType.EXTENSION);
        r.setStatus(MemberApprovalRequest.Status.PENDING);
        r.setRequestedBy(requestedBy);
        r.setRequestedAt(LocalDateTime.now());
        r.setDetailSummary(detailSummary);
        r.setExtensionMemberProductId(memberProductId);
        r.setExtensionDays(extendDays);
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        logger.info("이용권 연장 승인 요청 등록: id={}, memberProductId={}, days={}, by={}",
                saved.getId(), memberProductId, extendDays, requestedBy);
        return Optional.of(saved);
    }

    /**
     * 이용권 추가/재등록(POST /members/{id}/products) 승인 요청 — 회원당 동시에 1건만 대기
     */
    @Transactional
    public Optional<MemberApprovalRequest> createReRegisterPendingIfAbsent(
            Long memberId,
            String approvalPayloadJson,
            String requestedBy,
            String detailSummary) {
        if (memberId == null || approvalPayloadJson == null || approvalPayloadJson.isBlank()) {
            return Optional.empty();
        }
        if (memberApprovalRequestRepository.existsByMember_IdAndStatusAndRequestType(
                memberId, MemberApprovalRequest.Status.PENDING, MemberApprovalRequest.RequestType.RE_REGISTER)) {
            logger.debug("재등록 승인 요청 이미 존재: memberId={}", memberId);
            return Optional.empty();
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        MemberApprovalRequest r = new MemberApprovalRequest();
        r.setMember(member);
        r.setRequestType(MemberApprovalRequest.RequestType.RE_REGISTER);
        r.setStatus(MemberApprovalRequest.Status.PENDING);
        r.setRequestedBy(requestedBy);
        r.setRequestedAt(LocalDateTime.now());
        r.setDetailSummary(detailSummary);
        r.setApprovalPayload(approvalPayloadJson);
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        logger.info("재등록/이용권 추가 승인 요청 등록: id={}, memberId={}, by={}", saved.getId(), memberId, requestedBy);
        return Optional.of(saved);
    }

    /**
     * 담당 코치 변경 승인 요청 — 회원당 동시에 1건만 대기
     */
    @Transactional
    public Optional<MemberApprovalRequest> createCoachReassignmentPendingIfAbsent(
            Long memberId,
            Long newCoachId,
            Long reassignmentMemberProductId,
            String requestedBy,
            String detailSummary) {
        if (memberId == null || newCoachId == null) {
            throw new IllegalArgumentException("memberId와 newCoachId가 필요합니다.");
        }
        if (reassignmentMemberProductId == null) {
            throw new IllegalArgumentException("대상 이용권(memberProductId)이 필요합니다.");
        }
        if (memberApprovalRequestRepository.existsByMember_IdAndStatusAndRequestType(
                memberId, MemberApprovalRequest.Status.PENDING, MemberApprovalRequest.RequestType.COACH_REASSIGNMENT)) {
            logger.debug("코치 변경 승인 요청 이미 존재: memberId={}", memberId);
            return Optional.empty();
        }
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        MemberProduct mp = memberProductRepository.findByIdAndDeletedAtIsNull(reassignmentMemberProductId)
                .orElseThrow(() -> new IllegalArgumentException("이용권을 찾을 수 없습니다."));
        if (!Objects.equals(memberId, mp.getMember().getId())) {
            throw new IllegalArgumentException("회원과 이용권이 일치하지 않습니다.");
        }
        if (mp.getStatus() != MemberProduct.Status.ACTIVE) {
            throw new IllegalArgumentException("활성 이용권만 담당 코치 변경을 요청할 수 있습니다.");
        }
        Long mpCoachId = mp.getCoach() != null ? mp.getCoach().getId() : null;
        if (Objects.equals(mpCoachId, newCoachId)) {
            throw new IllegalArgumentException("이미 해당 코치가 이 이용권에 배정되어 있습니다.");
        }
        Coach newCoach = coachRepository.findById(newCoachId)
                .orElseThrow(() -> new IllegalArgumentException("선택한 코치를 찾을 수 없습니다."));
        String summary = detailSummary;
        if (summary == null || summary.isBlank()) {
            String pn = mp.getProduct() != null && mp.getProduct().getName() != null ? mp.getProduct().getName() : "이용권";
            String nn = newCoach.getName() != null ? newCoach.getName() : ("ID " + newCoachId);
            summary = "[" + pn + "] 담당 코치 변경 → " + nn;
        }
        MemberApprovalRequest r = new MemberApprovalRequest();
        r.setMember(member);
        r.setRequestType(MemberApprovalRequest.RequestType.COACH_REASSIGNMENT);
        r.setStatus(MemberApprovalRequest.Status.PENDING);
        r.setRequestedBy(requestedBy);
        r.setRequestedAt(LocalDateTime.now());
        r.setDetailSummary(summary);
        r.setReassignmentNewCoachId(newCoachId);
        r.setReassignmentMemberProductId(reassignmentMemberProductId);
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        logger.info("담당 코치 변경 승인 요청: id={}, memberId={}, memberProductId={}, newCoachId={}, by={}",
                saved.getId(), memberId, reassignmentMemberProductId, newCoachId, requestedBy);
        return Optional.of(saved);
    }

    /**
     * 담당 코치 변경: 등록(+관리자면 즉시 승인)과 API 응답 맵 생성을 <strong>한 트랜잭션</strong>에서 처리한다.
     * 컨트롤러에서 create → approve 를 따로 호출하면 커밋/세션 경계 때문에 LazyInitializationException 또는 응답 직렬화 500이 날 수 있다.
     */
    @Transactional
    public Map<String, Object> createCoachReassignmentFlow(
            long memberId,
            long newCoachId,
            long memberProductId,
            String requestedBy,
            String detailSummary,
            boolean adminAutoApprove) {
        Optional<MemberApprovalRequest> opt = createCoachReassignmentPendingIfAbsent(
                memberId, newCoachId, memberProductId, requestedBy, detailSummary);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("created", opt.isPresent());
        if (opt.isEmpty()) {
            return res;
        }
        MemberApprovalRequest entity = opt.get();
        if (adminAutoApprove) {
            entity = self.approve(entity.getId(), requestedBy, detailSummary);
            res.put("autoApproved", true);
        }
        res.put("request", approvalRequestToResponseMap(entity));
        return res;
    }

    private static String isoLocalDateTime(LocalDateTime t) {
        return t == null ? null : t.format(ISO_LDT);
    }

    /** 동일 영속성 컨텍스트(서비스 트랜잭션) 안에서만 호출 — member LAZY 초기화 안전 */
    private Map<String, Object> approvalRequestToResponseMap(MemberApprovalRequest r) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", r.getId());
        m.put("requestType", r.getRequestType() != null ? r.getRequestType().name() : null);
        m.put("status", r.getStatus() != null ? r.getStatus().name() : null);
        m.put("requestedBy", r.getRequestedBy());
        m.put("requestedAt", isoLocalDateTime(r.getRequestedAt()));
        m.put("reviewedBy", r.getReviewedBy());
        m.put("reviewedAt", isoLocalDateTime(r.getReviewedAt()));
        m.put("reviewNote", r.getReviewNote());
        m.put("detailSummary", r.getDetailSummary());
        m.put("extensionMemberProductId", r.getExtensionMemberProductId());
        m.put("extensionDays", r.getExtensionDays());
        m.put("reassignmentNewCoachId", r.getReassignmentNewCoachId());
        m.put("reassignmentMemberProductId", r.getReassignmentMemberProductId());
        Member mem = r.getMember();
        if (mem != null) {
            m.put("memberId", mem.getId());
            m.put("memberName", mem.getName());
            m.put("memberNumber", mem.getMemberNumber());
            m.put("phoneNumber", mem.getPhoneNumber());
        }
        return m;
    }

    /**
     * 이미 PENDING 인 RE_REGISTER 건이 있으면 새 요청을 같은 건의 {@code approvalPayload}(JSON 배열)에 합친다.
     * 회원당 재등록 대기는 1건만 두되, 여러 상품 추가는 한 번에 승인되도록 한다.
     */
    @Transactional
    public Optional<MemberApprovalRequest> mergeReRegisterPayloadIntoPending(
            Long memberId,
            String singleProductPayloadJson,
            String productNameHint) {
        if (memberId == null || singleProductPayloadJson == null || singleProductPayloadJson.isBlank()) {
            return Optional.empty();
        }
        Optional<MemberApprovalRequest> pending = memberApprovalRequestRepository
                .findFirstByMember_IdAndStatusAndRequestTypeOrderByRequestedAtDesc(
                        memberId,
                        MemberApprovalRequest.Status.PENDING,
                        MemberApprovalRequest.RequestType.RE_REGISTER);
        if (pending.isEmpty()) {
            return Optional.empty();
        }
        MemberApprovalRequest r = pending.get();
        try {
            ArrayNode arr;
            String existing = r.getApprovalPayload();
            if (existing == null || existing.isBlank()) {
                arr = objectMapper.createArrayNode();
            } else {
                JsonNode node = objectMapper.readTree(existing);
                if (node.isArray()) {
                    arr = (ArrayNode) node;
                } else {
                    arr = objectMapper.createArrayNode();
                    arr.add(node);
                }
            }
            arr.add(objectMapper.readTree(singleProductPayloadJson));
            r.setApprovalPayload(objectMapper.writeValueAsString(arr));
        } catch (JsonProcessingException e) {
            logger.warn("RE_REGISTER merge JSON 실패 memberId={}: {}", memberId, e.getMessage());
            return Optional.empty();
        }
        String label = productNameHint != null && !productNameHint.isBlank() ? productNameHint.trim() : "상품";
        long productIdFromPayload = 0L;
        String intentFromPayload = null;
        try {
            JsonNode root = objectMapper.readTree(singleProductPayloadJson);
            if (root.hasNonNull("productId")) {
                productIdFromPayload = root.get("productId").asLong();
            }
            if (root.hasNonNull("productSelectionIntent")) {
                intentFromPayload = root.get("productSelectionIntent").asText();
            }
        } catch (Exception ignored) {
            // 아래에서 productId 없으면 기존 문구로 대체
        }
        String summaryLine = productIdFromPayload > 0
                ? memberDetailController.buildReRegisterApprovalDetailSummary(memberId, productIdFromPayload, label, intentFromPayload)
                : ("이용권 추가/재등록: " + label);
        String ds = r.getDetailSummary();
        if (ds == null || ds.isBlank()) {
            r.setDetailSummary(summaryLine);
        } else if (!ds.contains(label)) {
            r.setDetailSummary(ds + " · " + label);
        }
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        logger.info("재등록(RE_REGISTER) 승인 건에 이용권 merge: memberId={}, requestId={}", memberId, saved.getId());
        return Optional.of(saved);
    }

    @Transactional(readOnly = true)
    public List<MemberApprovalRequest> findPending() {
        return memberApprovalRequestRepository.findByStatusWithMemberOrderByRequestedAtDesc(MemberApprovalRequest.Status.PENDING);
    }

    @Transactional(readOnly = true)
    public long countPending() {
        return memberApprovalRequestRepository.countByStatus(MemberApprovalRequest.Status.PENDING);
    }

    @Transactional
    public MemberApprovalRequest approve(Long id, String reviewerUsername, String note) {
        MemberApprovalRequest r = memberApprovalRequestRepository.findByIdWithMember(id)
                .orElseThrow(() -> new IllegalArgumentException("승인 요청을 찾을 수 없습니다."));
        if (r.getStatus() != MemberApprovalRequest.Status.PENDING) {
            throw new IllegalStateException("이미 처리된 요청입니다.");
        }
        if (r.getRequestType() == MemberApprovalRequest.RequestType.EXTENSION
                && r.getExtensionMemberProductId() != null && r.getExtensionDays() != null) {
            Long extensionMemberProductId = r.getExtensionMemberProductId();
            boolean targetExists = memberProductRepository.findByIdAndDeletedAtIsNull(extensionMemberProductId).isPresent();
            if (!targetExists) {
                throw new IllegalStateException(
                        "연장 대상 이용권(ID: " + extensionMemberProductId + ")을 찾을 수 없어 승인할 수 없습니다. "
                                + "요청을 반려한 뒤 회원 화면에서 이용권 추가/재등록으로 다시 요청해 주세요.");
            }
            ResponseEntity<Map<String, Object>> extRes = memberProductController.applyExtensionAfterApproval(
                    extensionMemberProductId, r.getExtensionDays());
            if (!extRes.getStatusCode().is2xxSuccessful()) {
                throw new IllegalStateException("이용권 연장 적용에 실패했습니다. HTTP " + extRes.getStatusCode().value());
            }
            Map<String, Object> body = extRes.getBody();
            if (body != null && body.containsKey("error") && body.get("error") != null) {
                throw new IllegalStateException(String.valueOf(body.get("error")));
            }
        }
        if (r.getRequestType() == MemberApprovalRequest.RequestType.COACH_REASSIGNMENT) {
            Long nc = r.getReassignmentNewCoachId();
            if (nc == null) {
                throw new IllegalStateException("코치 변경 요청에 새 코치가 지정되지 않았습니다.");
            }
            Long mpId = r.getReassignmentMemberProductId();
            if (mpId != null) {
                memberService.applyCoachReassignmentForMemberProduct(r.getMember().getId(), mpId, nc, reviewerUsername);
            } else {
                memberService.applyCoachReassignmentAfterApproval(r.getMember().getId(), nc, reviewerUsername);
            }
        }
        // 신규 가입 건에 합쳐 둔 초기 이용권(approvalPayload JSON 배열) — 활성화 전에 반영
        if (r.getRequestType() == MemberApprovalRequest.RequestType.NEW_MEMBER
                && r.getApprovalPayload() != null && !r.getApprovalPayload().isBlank()
                && r.getMember() != null) {
            applyNewMemberInitialProductsFromPayload(r);
        }
        if (r.getRequestType() == MemberApprovalRequest.RequestType.RE_REGISTER
                && r.getApprovalPayload() != null && r.getMember() != null) {
            applyReRegisterProductsFromPayload(r);
        }
        r.setStatus(MemberApprovalRequest.Status.APPROVED);
        r.setReviewedBy(reviewerUsername);
        r.setReviewedAt(LocalDateTime.now());
        r.setReviewNote(note);
        MemberApprovalRequest saved = memberApprovalRequestRepository.save(r);
        Member m = saved.getMember();
        if (m != null && saved.getRequestType() == MemberApprovalRequest.RequestType.NEW_MEMBER
                && m.getStatus() == MemberStatus.PENDING_APPROVAL) {
            m.setStatus(MemberStatus.ACTIVE);
            memberRepository.save(m);
            logger.info("신규 회원 승인: memberId={} → ACTIVE", m.getId());
        }
        return saved;
    }

    /**
     * 반려 처리.
     * <p>
     * 신규 가입(NEW_MEMBER)이고 아직 승인 대기(PENDING_APPROVAL)인 경우 — 반려 시 회원 행 자체를 두지 않고
     * {@link MemberService#deleteMember(Long)} 로 관련 데이터를 모두 삭제한다 (목록·DB에 정보가 남지 않음).
     * 연장·재등록 등 기존 회원 대상 요청은 요청만 REJECTED 로 남긴다.
     */
    @Transactional
    public MemberApprovalRequest reject(Long id, String reviewerUsername, String note) {
        MemberApprovalRequest r = memberApprovalRequestRepository.findByIdWithMember(id)
                .orElseThrow(() -> new IllegalArgumentException("승인 요청을 찾을 수 없습니다."));
        if (r.getStatus() != MemberApprovalRequest.Status.PENDING) {
            throw new IllegalStateException("이미 처리된 요청입니다.");
        }
        Member m = r.getMember();
        if (m != null && r.getRequestType() == MemberApprovalRequest.RequestType.NEW_MEMBER
                && m.getStatus() == MemberStatus.PENDING_APPROVAL) {
            Long memberId = m.getId();
            logger.info("신규 회원 반려: memberId={} — 회원·승인요청·이용권 등 삭제 (반려 후 정보 미보관)", memberId);
            memberService.deleteMember(memberId);
            return null;
        }
        r.setStatus(MemberApprovalRequest.Status.REJECTED);
        r.setReviewedBy(reviewerUsername);
        r.setReviewedAt(LocalDateTime.now());
        r.setReviewNote(note);
        return memberApprovalRequestRepository.save(r);
    }

    /** RE_REGISTER 의 approvalPayload(배열 또는 단일 객체)마다 이용권 행 생성 */
    private void applyReRegisterProductsFromPayload(MemberApprovalRequest r) {
        Long memberId = r.getMember().getId();
        String payload = r.getApprovalPayload();
        try {
            JsonNode node = objectMapper.readTree(payload);
            if (node.isArray()) {
                for (JsonNode item : node) {
                    ResponseEntity<Map<String, Object>> rr = memberDetailController.applyReRegisterFromApproval(
                            memberId, objectMapper.writeValueAsString(item));
                    assertApplyResponse(rr, "이용권 추가/재등록");
                }
            } else {
                ResponseEntity<Map<String, Object>> rr = memberDetailController.applyReRegisterFromApproval(
                        memberId, payload);
                assertApplyResponse(rr, "이용권 추가/재등록");
            }
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("재등록 payload를 파싱할 수 없습니다.", e);
        }
    }

    /** NEW_MEMBER 의 approvalPayload(배열 또는 단일 객체)마다 이용권 행 생성 (회원은 아직 PENDING_APPROVAL) */
    private void applyNewMemberInitialProductsFromPayload(MemberApprovalRequest r) {
        Long memberId = r.getMember().getId();
        String payload = r.getApprovalPayload();
        try {
            JsonNode node = objectMapper.readTree(payload);
            if (node.isArray()) {
                for (JsonNode item : node) {
                    ResponseEntity<Map<String, Object>> rr = memberDetailController.applyReRegisterFromApproval(
                            memberId, objectMapper.writeValueAsString(item));
                    assertApplyResponse(rr, "신규 가입 이용권 배정");
                }
            } else {
                ResponseEntity<Map<String, Object>> rr = memberDetailController.applyReRegisterFromApproval(
                        memberId, payload);
                assertApplyResponse(rr, "신규 가입 이용권 배정");
            }
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("신규 가입 이용권 payload를 파싱할 수 없습니다.", e);
        }
    }

    private static void assertApplyResponse(ResponseEntity<Map<String, Object>> rr, String context) {
        if (!rr.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException(context + " 실패: HTTP " + rr.getStatusCode().value());
        }
        Map<String, Object> body = rr.getBody();
        if (body != null && body.containsKey("error") && body.get("error") != null) {
            throw new IllegalStateException(context + ": " + body.get("error"));
        }
    }
}
