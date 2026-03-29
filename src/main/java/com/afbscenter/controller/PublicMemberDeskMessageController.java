package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberDeskMessage;
import com.afbscenter.repository.MemberDeskMessageRepository;
import com.afbscenter.repository.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 비로그인 회원 → 관리자 쪽지 (회원번호 검증).
 */
@RestController
@RequestMapping("/api/public/member-desk-messages")
public class PublicMemberDeskMessageController {

    private static final Logger logger = LoggerFactory.getLogger(PublicMemberDeskMessageController.class);
    private static final int MAX_CONTENT = 4000;

    private final MemberRepository memberRepository;
    private final MemberDeskMessageRepository memberDeskMessageRepository;

    public PublicMemberDeskMessageController(MemberRepository memberRepository,
                                             MemberDeskMessageRepository memberDeskMessageRepository) {
        this.memberRepository = memberRepository;
        this.memberDeskMessageRepository = memberDeskMessageRepository;
    }

    @GetMapping
    @Transactional
    public ResponseEntity<?> getThread(@RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "등록된 회원이 아닙니다."));
        }
        Member member = opt.get();
        memberDeskMessageRepository.markAdminPostsReadByMember(member.getId());
        List<MemberDeskMessage> rows = memberDeskMessageRepository.findByMember_IdOrderByCreatedAtAsc(member.getId());
        long unreadFromAdmin = memberDeskMessageRepository.countUnreadAdminMessagesForMember(member.getId());
        Map<String, Object> out = new HashMap<>();
        out.put("memberId", member.getId());
        out.put("unreadFromAdminCount", unreadFromAdmin);
        out.put("messages", rows.stream().map(this::toMap).collect(Collectors.toList()));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/unread-count")
    @Transactional(readOnly = true)
    public ResponseEntity<?> unreadCount(@RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber.trim());
        if (opt.isEmpty()) {
            return ResponseEntity.ok(Map.of("count", 0));
        }
        Member m = opt.get();
        long n = memberDeskMessageRepository.countUnreadAdminForMemberPublic(m.getId(), m.getDeskThreadClearedAt());
        return ResponseEntity.ok(Map.of("count", n));
    }

    /** 종 알림 목록용 — 미읽음 데스크 답장 미리보기(읽음 처리하지 않음) */
    @GetMapping("/unread-preview")
    @Transactional(readOnly = true)
    public ResponseEntity<?> unreadPreview(@RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber.trim());
        if (opt.isEmpty()) {
            return ResponseEntity.ok(Map.of("count", 0, "items", List.of()));
        }
        Member member = opt.get();
        LocalDateTime clearedAt = member.getDeskThreadClearedAt();
        long count = memberDeskMessageRepository.countUnreadAdminForMemberPublic(member.getId(), clearedAt);
        List<MemberDeskMessage> rows = memberDeskMessageRepository.findUnreadAdminForMemberPublicPreview(
                member.getId(), clearedAt, PageRequest.of(0, 5));
        List<Map<String, Object>> items = rows.stream().map(m -> {
            Map<String, Object> one = new HashMap<>();
            one.put("id", m.getId());
            one.put("createdAt", m.getCreatedAt());
            String c = m.getContent() != null ? m.getContent() : "";
            String preview = c.length() > 120 ? c.substring(0, 120) + "…" : c;
            one.put("contentPreview", preview);
            return one;
        }).collect(Collectors.toList());
        Map<String, Object> out = new HashMap<>();
        out.put("count", count);
        out.put("items", items);
        return ResponseEntity.ok(out);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> postFromMember(@RequestBody Map<String, Object> body) {
        try {
            String memberNumber = body != null && body.get("memberNumber") != null
                    ? body.get("memberNumber").toString().trim() : null;
            String content = body != null && body.get("content") != null
                    ? body.get("content").toString().trim() : null;
            if (memberNumber == null || memberNumber.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "회원번호를 입력해 주세요."));
            }
            if (content == null || content.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "내용을 입력해 주세요."));
            }
            if (content.length() > MAX_CONTENT) {
                return ResponseEntity.badRequest().body(Map.of("error", "내용은 " + MAX_CONTENT + "자 이하로 입력해 주세요."));
            }
            Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber);
            if (opt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "등록된 회원이 아닙니다."));
            }
            Member member = opt.get();
            MemberDeskMessage m = new MemberDeskMessage();
            m.setMember(member);
            m.setFromMember(true);
            m.setContent(content);
            m.setCreatedAt(LocalDateTime.now());
            m.setReadByAdmin(false);
            m.setReadByMember(true);
            MemberDeskMessage saved = memberDeskMessageRepository.save(m);
            return ResponseEntity.ok(Map.of(
                    "id", saved.getId(),
                    "message", "전달되었습니다."
            ));
        } catch (Exception e) {
            logger.error("회원 쪽지 저장 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "저장 중 오류가 발생했습니다."));
        }
    }

    /**
     * 회원 본인 확인 후 «쪽지 초기화»: DB 행은 유지하고, 회원 화면만 이 시점 이전 쪽지를 숨김.
     * 관리자 쪽지함·기록은 그대로입니다. 완전 삭제는 관리자 화면의 스레드 삭제를 사용합니다.
     */
    @DeleteMapping("/thread")
    @Transactional
    public ResponseEntity<?> clearThreadForMemberView(@RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "등록된 회원이 아닙니다."));
        }
        Member member = opt.get();
        LocalDateTime now = LocalDateTime.now();
        member.setDeskThreadClearedAt(now);
        memberRepository.save(member);
        logger.info("회원 쪽지 화면 초기화(기록 유지) memberId={} clearedAt={}", member.getId(), now);
        return ResponseEntity.ok(Map.of(
                "message", "회원 화면에서 이전 쪽지가 숨겨졌습니다. 센터 데스크에는 기록이 남아 있습니다.",
                "deskThreadClearedAt", now
        ));
    }

    private Map<String, Object> toMap(MemberDeskMessage m) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", m.getId());
        map.put("fromMember", m.isFromMember());
        map.put("content", m.getContent());
        map.put("createdAt", m.getCreatedAt());
        return map;
    }
}
