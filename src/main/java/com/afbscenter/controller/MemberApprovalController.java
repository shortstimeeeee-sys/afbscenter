package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberApprovalRequest;
import com.afbscenter.repository.MemberApprovalRequestRepository;
import com.afbscenter.service.MemberApprovalService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/member-approvals")
public class MemberApprovalController {

    private static final Logger logger = LoggerFactory.getLogger(MemberApprovalController.class);
    private static final DateTimeFormatter ISO_LDT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final MemberApprovalService memberApprovalService;
    private final MemberApprovalRequestRepository memberApprovalRequestRepository;

    public MemberApprovalController(MemberApprovalService memberApprovalService,
                                      MemberApprovalRequestRepository memberApprovalRequestRepository) {
        this.memberApprovalService = memberApprovalService;
        this.memberApprovalRequestRepository = memberApprovalRequestRepository;
    }

    private static boolean isAdminOrManager(HttpServletRequest request) {
        if (request == null) return false;
        String role = (String) request.getAttribute("role");
        return role != null && ("ADMIN".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role));
    }

    /** 시스템 관리자(ADMIN) — 코치 변경 요청 시 즉시 승인 등에 사용 */
    private static boolean isAdmin(HttpServletRequest request) {
        if (request == null) return false;
        String role = (String) request.getAttribute("role");
        return "ADMIN".equalsIgnoreCase(role);
    }

    /** 로그인한 직원 누구나 승인 요청 등록 가능 (실제 승인/반려는 관리자·매니저만) */
    private static boolean isAuthenticatedStaff(HttpServletRequest request) {
        if (request == null) return false;
        String username = (String) request.getAttribute("username");
        return username != null && !username.isBlank();
    }

    /** JSON 본문에서 숫자 필드가 문자열·정수·실수 등으로 올 수 있어 안전하게 long으로 변환 */
    private static long parseLongFromBody(Object o, String fieldName) {
        if (o == null) {
            throw new IllegalArgumentException(fieldName + "가 필요합니다.");
        }
        if (o instanceof Number) {
            return ((Number) o).longValue();
        }
        if (o instanceof String) {
            String t = ((String) o).trim();
            if (t.isEmpty()) {
                throw new IllegalArgumentException(fieldName + "가 비어 있습니다.");
            }
            try {
                return Long.parseLong(t);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(fieldName + " 숫자 형식이 올바르지 않습니다.");
            }
        }
        throw new IllegalArgumentException(fieldName + " 형식이 올바르지 않습니다.");
    }

    /** 대기 목록 (관리자·매니저) */
    @GetMapping("/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listPending(HttpServletRequest request) {
        if (!isAdminOrManager(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            List<Map<String, Object>> list = memberApprovalService.findPending().stream()
                    .map(this::toMap)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            logger.error("승인 대기 목록 조회 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** 승인 (관리자·매니저) */
    @PostMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request) {
        if (!isAdminOrManager(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            String username = (String) request.getAttribute("username");
            String note = body != null && body.get("note") != null ? body.get("note").toString() : null;
            MemberApprovalRequest saved = memberApprovalService.approve(id, username, note);
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("request", toMap(saved));
            return ResponseEntity.ok(res);
        } catch (IllegalArgumentException | IllegalStateException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception e) {
            logger.error("승인 처리 실패 id={}", id, e);
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            String msg = e.getMessage() != null && !e.getMessage().isBlank()
                    ? e.getMessage()
                    : e.getClass().getSimpleName();
            err.put("error", msg);
            err.put("message", msg);
            err.put("exception", e.getClass().getName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    /** 반려 (관리자·매니저) */
    @PostMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> reject(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request) {
        if (!isAdminOrManager(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            String username = (String) request.getAttribute("username");
            String note = body != null && body.get("note") != null ? body.get("note").toString() : null;
            MemberApprovalRequest saved = memberApprovalService.reject(id, username, note);
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            if (saved != null) {
                res.put("request", toMap(saved));
            } else {
                // 신규(NEW_MEMBER) 반려 시 회원 행 삭제 — 응답에 request 없음
                res.put("memberRemoved", true);
            }
            return ResponseEntity.ok(res);
        } catch (IllegalArgumentException | IllegalStateException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(err);
        } catch (Exception e) {
            logger.error("반려 처리 실패 id={}", id, e);
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            String msg = e.getMessage() != null && !e.getMessage().isBlank()
                    ? e.getMessage()
                    : e.getClass().getSimpleName();
            err.put("error", msg);
            err.put("message", msg);
            err.put("exception", e.getClass().getName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    /**
     * 재등록·연장 등 수동 승인 요청 (로그인 직원 누구나 등록 가능 · 승인은 관리자·매니저만)
     * <p>
     * 트랜잭션은 서비스 계층에서만 둔다. 컨트롤러에 @Transactional을 두면 응답 직렬화(toMap) 시점과
     * 세션 범위가 꼬여 LazyInitializationException(HTTP 500)이 나기 쉽다.
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> createRequest(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        if (!isAuthenticatedStaff(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            long memberId = parseLongFromBody(body.get("memberId"), "memberId");
            String typeStr = body.get("requestType") != null ? body.get("requestType").toString() : "EXTENSION";
            MemberApprovalRequest.RequestType type = MemberApprovalRequest.RequestType.valueOf(typeStr.toUpperCase());
            String summary = body.get("detailSummary") != null ? body.get("detailSummary").toString() : null;
            String username = (String) request.getAttribute("username");
            if (type == MemberApprovalRequest.RequestType.COACH_REASSIGNMENT) {
                long newCoachId = parseLongFromBody(body.get("newCoachId"), "newCoachId");
                long memberProductId = parseLongFromBody(body.get("memberProductId"), "memberProductId");
                Map<String, Object> coachRes = memberApprovalService.createCoachReassignmentFlow(
                        memberId, newCoachId, memberProductId, username, summary, isAdmin(request));
                return ResponseEntity.status(HttpStatus.CREATED).body(coachRes);
            }
            Optional<MemberApprovalRequest> opt =
                    memberApprovalService.createPendingIfAbsent(memberId, type, username, summary);
            MemberApprovalRequest result = null;
            if (opt.isPresent()) {
                result = opt.get();
            }
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("created", opt.isPresent());
            if (result != null) {
                res.put("request", toMap(result));
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(res);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            logger.error("승인 요청 생성 실패", e);
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            String msg = e.getMessage() != null && !e.getMessage().isBlank()
                    ? e.getMessage()
                    : e.getClass().getSimpleName();
            err.put("error", msg);
            err.put("message", msg);
            err.put("exception", e.getClass().getName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    private static String isoLocalDateTime(java.time.LocalDateTime t) {
        return t == null ? null : t.format(ISO_LDT);
    }

    /**
     * 응답 JSON용 맵. member는 LAZY이므로, id가 있으면 JOIN FETCH로 다시 읽어 세션 밖에서도 안전하게 필드를 채운다.
     */
    private Map<String, Object> toMap(MemberApprovalRequest r) {
        MemberApprovalRequest src = r;
        if (r != null && r.getId() != null) {
            src = memberApprovalRequestRepository.findByIdWithMember(r.getId()).orElse(r);
        }
        Map<String, Object> m = new HashMap<>();
        m.put("id", src.getId());
        m.put("requestType", src.getRequestType() != null ? src.getRequestType().name() : null);
        m.put("status", src.getStatus() != null ? src.getStatus().name() : null);
        m.put("requestedBy", src.getRequestedBy());
        m.put("requestedAt", isoLocalDateTime(src.getRequestedAt()));
        m.put("reviewedBy", src.getReviewedBy());
        m.put("reviewedAt", isoLocalDateTime(src.getReviewedAt()));
        m.put("reviewNote", src.getReviewNote());
        m.put("detailSummary", src.getDetailSummary());
        m.put("extensionMemberProductId", src.getExtensionMemberProductId());
        m.put("extensionDays", src.getExtensionDays());
        m.put("reassignmentNewCoachId", src.getReassignmentNewCoachId());
        m.put("reassignmentMemberProductId", src.getReassignmentMemberProductId());
        Member mem = src.getMember();
        if (mem != null) {
            m.put("memberId", mem.getId());
            m.put("memberName", mem.getName());
            m.put("memberNumber", mem.getMemberNumber());
            m.put("phoneNumber", mem.getPhoneNumber());
        }
        return m;
    }
}
