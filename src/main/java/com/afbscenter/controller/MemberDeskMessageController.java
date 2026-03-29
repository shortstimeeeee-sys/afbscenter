package com.afbscenter.controller;



import com.afbscenter.model.Member;

import com.afbscenter.model.MemberDeskMessage;

import com.afbscenter.repository.MemberDeskMessageRepository;

import com.afbscenter.repository.MemberRepository;

import com.afbscenter.util.JwtUtil;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;

import org.slf4j.LoggerFactory;

import org.springframework.http.HttpStatus;

import org.springframework.http.ResponseEntity;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.bind.annotation.*;



import java.time.LocalDateTime;

import java.util.ArrayList;

import java.util.HashMap;

import java.util.List;

import java.util.Map;

import java.util.Optional;

import java.util.stream.Collectors;



/**

 * 관리자 ↔ 회원 쪽지 (JWT). 회원(Member)에 스레드 잠금 PIN이 있으면 X-Desk-Thread-Unlock JWT 헤더 필요.

 */

@RestController

@RequestMapping("/api/member-desk-messages")

public class MemberDeskMessageController {



    private static final Logger logger = LoggerFactory.getLogger(MemberDeskMessageController.class);

    private static final int MAX_CONTENT = 4000;



    private final MemberRepository memberRepository;

    private final MemberDeskMessageRepository memberDeskMessageRepository;

    private final JwtUtil jwtUtil;

    private final PasswordEncoder passwordEncoder;



    public MemberDeskMessageController(MemberRepository memberRepository,

                                       MemberDeskMessageRepository memberDeskMessageRepository,

                                       JwtUtil jwtUtil,

                                       PasswordEncoder passwordEncoder) {

        this.memberRepository = memberRepository;

        this.memberDeskMessageRepository = memberDeskMessageRepository;

        this.jwtUtil = jwtUtil;

        this.passwordEncoder = passwordEncoder;

    }



    private boolean isThreadLocked(Member member) {

        return member != null && member.getDeskThreadLockPinHash() != null

                && !member.getDeskThreadLockPinHash().isBlank();

    }



    /**

     * 해당 회원 스레드에 잠금이 있으면 X-Desk-Thread-Unlock JWT 필요. 통과 시 null.

     */

    private ResponseEntity<?> threadLockDeniedUnlessUnlocked(HttpServletRequest request, Long memberId) {

        Optional<Member> mOpt = memberRepository.findById(memberId);

        if (mOpt.isEmpty()) {

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));

        }

        Member member = mOpt.get();

        if (!isThreadLocked(member)) {

            return null;

        }

        String username = (String) request.getAttribute("username");

        if (username == null) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증이 필요합니다."));

        }

        String unlock = request.getHeader("X-Desk-Thread-Unlock");

        if (!jwtUtil.isDeskThreadUnlockTokenValid(unlock, username, memberId)) {

            return ResponseEntity.status(HttpStatus.FORBIDDEN)

                    .body(Map.of(

                            "error", "이 대화는 잠금되어 있습니다. PIN을 입력해 주세요.",

                            "threadLockRequired", true));

        }

        return null;

    }



    /** 스레드 잠금 해제용 JWT 발급 (PIN 일치 시). 잠금이 없으면 바로 토큰 발급. */

    @PostMapping("/member/{memberId}/unlock")

    public ResponseEntity<?> unlockThread(@PathVariable Long memberId,

                                          @RequestBody(required = false) Map<String, Object> body,

                                          HttpServletRequest request) {

        String username = (String) request.getAttribute("username");

        if (username == null) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증이 필요합니다."));

        }

        Optional<Member> mOpt = memberRepository.findById(memberId);

        if (mOpt.isEmpty()) {

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));

        }

        Member member = mOpt.get();

        if (!isThreadLocked(member)) {

            return ResponseEntity.ok(Map.of(

                    "deskThreadUnlockToken", jwtUtil.generateDeskThreadUnlockToken(username, memberId),

                    "threadLocked", false));

        }

        String pin = body != null && body.get("pin") != null ? body.get("pin").toString() : "";

        if (!passwordEncoder.matches(pin, member.getDeskThreadLockPinHash())) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "PIN이 올바르지 않습니다."));

        }

        return ResponseEntity.ok(Map.of(

                "deskThreadUnlockToken", jwtUtil.generateDeskThreadUnlockToken(username, memberId),

                "threadLocked", true));

    }



    /** 이 회원과의 쪽지 스레드 잠금 PIN 설정·해제(공지/메시지 화면). 빈 문자열이면 잠금 해제. */

    @PutMapping("/member/{memberId}/thread-lock")

    @Transactional

    public ResponseEntity<?> setThreadLock(@PathVariable Long memberId,

                                           @RequestBody(required = false) Map<String, Object> body,

                                           HttpServletRequest request) {

        String username = (String) request.getAttribute("username");

        if (username == null) {

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "인증이 필요합니다."));

        }

        Optional<Member> mOpt = memberRepository.findById(memberId);

        if (mOpt.isEmpty()) {

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));

        }

        Member member = mOpt.get();

        String pin = body != null && body.get("pin") != null ? body.get("pin").toString().trim() : "";

        if (pin.isEmpty()) {

            member.setDeskThreadLockPinHash(null);

        } else {

            member.setDeskThreadLockPinHash(passwordEncoder.encode(pin));

        }

        memberRepository.save(member);

        return ResponseEntity.ok(Map.of(

                "threadLocked", isThreadLocked(member),

                "message", pin.isEmpty() ? "이 대화 잠금이 해제되었습니다." : "이 대화 잠금이 저장되었습니다."));

    }

    /** 종 알림 배지용 — 쪽지함 잠금과 무관, JWT만 (미읽음 건수만) */
    @GetMapping("/badge-count")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> badgeCount() {
        long n = memberDeskMessageRepository.countTotalUnreadFromMembers();
        return ResponseEntity.ok(Map.of("totalUnreadFromMembers", n));
    }

    /** 상단 알림「모두 읽음」— 회원→관리자 미읽음 일괄 읽음 (쪽지함 잠금 불필요) */
    @PostMapping("/mark-all-read")
    @Transactional
    public ResponseEntity<Map<String, Object>> markAllReadForAdmin() {
        int updated = memberDeskMessageRepository.markAllMemberPostsReadByAdmin();
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    @GetMapping("/inbox")

    @Transactional(readOnly = true)

    public ResponseEntity<?> inbox(HttpServletRequest request) {

        try {

            List<Long> memberIds = memberDeskMessageRepository.findMemberIdsByRecentActivity();

            long totalUnread = memberDeskMessageRepository.countTotalUnreadFromMembers();

            List<Map<String, Object>> rows = new ArrayList<>();

            for (Long mid : memberIds) {

                Optional<Member> mOpt = memberRepository.findById(mid);

                if (mOpt.isEmpty()) {

                    continue;

                }

                Member mem = mOpt.get();

                List<MemberDeskMessage> thread = memberDeskMessageRepository.findByMember_IdOrderByCreatedAtAsc(mid);

                MemberDeskMessage last = thread.isEmpty() ? null : thread.get(thread.size() - 1);

                long unread = memberDeskMessageRepository.countUnreadMemberMessagesForAdmin(mid);

                Map<String, Object> row = new HashMap<>();

                row.put("memberId", mid);

                row.put("memberName", mem.getName());

                row.put("memberNumber", mem.getMemberNumber());

                row.put("unreadFromMemberCount", unread);

                row.put("lastMessageAt", last != null ? last.getCreatedAt() : null);

                row.put("lastMessagePreview", last != null ? preview(last.getContent()) : "");

                row.put("lastFromMember", last != null && last.isFromMember());

                rows.add(row);

            }

            Map<String, Object> out = new HashMap<>();

            out.put("threads", rows);

            out.put("totalUnreadFromMembers", totalUnread);

            return ResponseEntity.ok(out);

        } catch (Exception e) {

            logger.error("쪽지함 목록 조회 실패", e);

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();

        }

    }



    @GetMapping("/inbox-meta")

    @Transactional(readOnly = true)

    public ResponseEntity<?> inboxMeta(HttpServletRequest request) {

        try {

            long totalUnread = memberDeskMessageRepository.countTotalUnreadFromMembers();

            return ResponseEntity.ok(Map.of("totalUnreadFromMembers", totalUnread));

        } catch (Exception e) {

            logger.error("쪽지함 메타 조회 실패", e);

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();

        }

    }



    /** 회원번호로 회원 식별 — 아직 쪽지가 없는 회원에게 첫 답장을 열 때만 사용 */

    @GetMapping("/lookup")

    @Transactional(readOnly = true)

    public ResponseEntity<?> lookupByMemberNumber(@RequestParam String memberNumber, HttpServletRequest request) {

        if (memberNumber == null || memberNumber.isBlank()) {

            return ResponseEntity.badRequest().body(Map.of("error", "회원번호를 입력해 주세요."));

        }

        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber.trim());

        if (opt.isEmpty()) {

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "등록된 회원번호가 아닙니다."));

        }

        Member m = opt.get();

        Map<String, Object> out = new HashMap<>();

        out.put("memberId", m.getId());

        out.put("memberName", m.getName());

        out.put("memberNumber", m.getMemberNumber());

        out.put("threadLocked", isThreadLocked(m));

        return ResponseEntity.ok(out);

    }



    @GetMapping("/member/{memberId}")

    @Transactional

    public ResponseEntity<?> threadForAdmin(@PathVariable Long memberId, HttpServletRequest request) {

        ResponseEntity<?> denied = threadLockDeniedUnlessUnlocked(request, memberId);

        if (denied != null) {

            return denied;

        }

        try {

            Optional<Member> mOpt = memberRepository.findById(memberId);

            if (mOpt.isEmpty()) {

                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));

            }

            Member member = mOpt.get();

            memberDeskMessageRepository.markMemberPostsReadByAdmin(memberId);

            List<MemberDeskMessage> rows = memberDeskMessageRepository.findByMember_IdOrderByCreatedAtAsc(memberId);

            Map<String, Object> out = new HashMap<>();

            out.put("memberId", memberId);

            out.put("memberName", member.getName());

            out.put("memberNumber", member.getMemberNumber());

            out.put("threadLocked", isThreadLocked(member));

            out.put("messages", rows.stream().map(this::toMap).collect(Collectors.toList()));

            return ResponseEntity.ok(out);

        } catch (Exception e) {

            logger.error("관리자 쪽지 스레드 조회 실패 memberId={}", memberId, e);

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "조회 실패"));

        }

    }



    @PostMapping("/reply")

    @Transactional

    public ResponseEntity<?> reply(@RequestBody Map<String, Object> body, HttpServletRequest request) {

        try {

            Object midObj = body != null ? body.get("memberId") : null;

            String content = body != null && body.get("content") != null

                    ? body.get("content").toString().trim() : null;

            if (midObj == null) {

                return ResponseEntity.badRequest().body(Map.of("error", "회원을 선택해 주세요."));

            }

            long memberId;

            try {

                memberId = Long.parseLong(midObj.toString());

            } catch (NumberFormatException e) {

                return ResponseEntity.badRequest().body(Map.of("error", "잘못된 회원입니다."));

            }

            ResponseEntity<?> lockDenied = threadLockDeniedUnlessUnlocked(request, memberId);

            if (lockDenied != null) {

                return lockDenied;

            }

            if (content == null || content.isEmpty()) {

                return ResponseEntity.badRequest().body(Map.of("error", "답장 내용을 입력해 주세요."));

            }

            if (content.length() > MAX_CONTENT) {

                return ResponseEntity.badRequest().body(Map.of("error", "내용은 " + MAX_CONTENT + "자 이하로 입력해 주세요."));

            }

            Optional<Member> mOpt = memberRepository.findById(memberId);

            if (mOpt.isEmpty()) {

                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));

            }

            Member member = mOpt.get();

            MemberDeskMessage m = new MemberDeskMessage();

            m.setMember(member);

            m.setFromMember(false);

            m.setContent(content);

            m.setCreatedAt(LocalDateTime.now());

            m.setReadByAdmin(true);

            m.setReadByMember(false);

            MemberDeskMessage saved = memberDeskMessageRepository.save(m);

            return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "답장이 저장되었습니다."));

        } catch (Exception e) {

            logger.error("관리자 답장 저장 실패", e);

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)

                    .body(Map.of("error", "저장 중 오류가 발생했습니다."));

        }

    }



    @DeleteMapping("/member/{memberId}/thread")

    @Transactional

    public ResponseEntity<?> deleteThread(@PathVariable Long memberId, HttpServletRequest request) {

        ResponseEntity<?> denied = threadLockDeniedUnlessUnlocked(request, memberId);

        if (denied != null) {

            return denied;

        }

        if (!memberRepository.existsById(memberId)) {

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));

        }

        int deleted = memberDeskMessageRepository.deleteAllByMember_Id(memberId);

        logger.info("쪽지 스레드 삭제 memberId={} 삭제건수={}", memberId, deleted);

        return ResponseEntity.ok(Map.of("deleted", deleted));

    }



    @DeleteMapping("/{messageId}")

    @Transactional

    public ResponseEntity<?> deleteMessage(@PathVariable Long messageId, HttpServletRequest request) {

        Optional<MemberDeskMessage> opt = memberDeskMessageRepository.findById(messageId);

        if (opt.isEmpty()) {

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "쪽지를 찾을 수 없습니다."));

        }

        Long threadMemberId = opt.get().getMember().getId();

        ResponseEntity<?> denied = threadLockDeniedUnlessUnlocked(request, threadMemberId);

        if (denied != null) {

            return denied;

        }

        memberDeskMessageRepository.deleteById(messageId);

        return ResponseEntity.noContent().build();

    }



    private Map<String, Object> toMap(MemberDeskMessage m) {

        Map<String, Object> map = new HashMap<>();

        map.put("id", m.getId());

        map.put("fromMember", m.isFromMember());

        map.put("content", m.getContent());

        map.put("createdAt", m.getCreatedAt());

        return map;

    }



    private static String preview(String s) {

        if (s == null) {

            return "";

        }

        String t = s.replace('\n', ' ').trim();

        return t.length() > 80 ? t.substring(0, 80) + "…" : t;

    }

}


