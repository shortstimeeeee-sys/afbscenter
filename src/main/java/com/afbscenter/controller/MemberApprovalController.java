package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberApprovalRequest;
import com.afbscenter.service.MemberApprovalService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/member-approvals")
public class MemberApprovalController {

    private static final Logger logger = LoggerFactory.getLogger(MemberApprovalController.class);

    private final MemberApprovalService memberApprovalService;

    public MemberApprovalController(MemberApprovalService memberApprovalService) {
        this.memberApprovalService = memberApprovalService;
    }

    private static boolean isAdminOrManager(HttpServletRequest request) {
        if (request == null) return false;
        String role = (String) request.getAttribute("role");
        return role != null && ("ADMIN".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role));
    }

    /** 로그인한 직원 누구나 승인 요청 등록 가능 (실제 승인/반려는 관리자·매니저만) */
    private static boolean isAuthenticatedStaff(HttpServletRequest request) {
        if (request == null) return false;
        String username = (String) request.getAttribute("username");
        return username != null && !username.isBlank();
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
    @Transactional
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** 반려 (관리자·매니저) */
    @PostMapping("/{id}/reject")
    @Transactional
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 재등록·연장 등 수동 승인 요청 (로그인 직원 누구나 등록 가능 · 승인은 관리자·매니저만)
     */
    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> createRequest(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        if (!isAuthenticatedStaff(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            Object mid = body.get("memberId");
            if (mid == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "memberId가 필요합니다."));
            }
            long memberId = ((Number) mid).longValue();
            String typeStr = body.get("requestType") != null ? body.get("requestType").toString() : "EXTENSION";
            MemberApprovalRequest.RequestType type = MemberApprovalRequest.RequestType.valueOf(typeStr.toUpperCase());
            String summary = body.get("detailSummary") != null ? body.get("detailSummary").toString() : null;
            String username = (String) request.getAttribute("username");
            var opt = memberApprovalService.createPendingIfAbsent(memberId, type, username, summary);
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("created", opt.isPresent());
            opt.ifPresent(r -> res.put("request", toMap(r)));
            return ResponseEntity.status(HttpStatus.CREATED).body(res);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            logger.error("승인 요청 생성 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private Map<String, Object> toMap(MemberApprovalRequest r) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", r.getId());
        m.put("requestType", r.getRequestType() != null ? r.getRequestType().name() : null);
        m.put("status", r.getStatus() != null ? r.getStatus().name() : null);
        m.put("requestedBy", r.getRequestedBy());
        m.put("requestedAt", r.getRequestedAt());
        m.put("reviewedBy", r.getReviewedBy());
        m.put("reviewedAt", r.getReviewedAt());
        m.put("reviewNote", r.getReviewNote());
        m.put("detailSummary", r.getDetailSummary());
        m.put("extensionMemberProductId", r.getExtensionMemberProductId());
        m.put("extensionDays", r.getExtensionDays());
        Member mem = r.getMember();
        if (mem != null) {
            m.put("memberId", mem.getId());
            m.put("memberName", mem.getName());
            m.put("memberNumber", mem.getMemberNumber());
            m.put("phoneNumber", mem.getPhoneNumber());
        }
        return m;
    }
}
