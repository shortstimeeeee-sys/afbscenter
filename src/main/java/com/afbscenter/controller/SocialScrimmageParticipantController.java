package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.SocialScrimmageParticipant;
import com.afbscenter.service.SocialScrimmageParticipantService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/social-scrimmage-participants")
public class SocialScrimmageParticipantController {

    private final SocialScrimmageParticipantService service;

    public SocialScrimmageParticipantController(SocialScrimmageParticipantService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam String matchDate,
                                  @RequestParam(required = false, defaultValue = "SAHA") String branch) {
        LocalDate date;
        Booking.Branch branchEnum;
        try {
            date = LocalDate.parse(matchDate.trim());
            branchEnum = Booking.Branch.valueOf(branch.trim().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 또는 지점이 올바르지 않습니다."));
        }
        return ResponseEntity.ok(toPayload(date, branchEnum, service.listWithPassSync(date, branchEnum)));
    }

    @GetMapping("/member-lookup")
    public ResponseEntity<?> lookupMembers(@RequestParam(required = false, defaultValue = "") String q) {
        return ResponseEntity.ok(service.searchMembers(q));
    }

    @GetMapping("/pass-lookup")
    public ResponseEntity<?> lookupPass(@RequestParam(required = false, defaultValue = "") String name,
                                        @RequestParam(required = false, defaultValue = "") String phone) {
        return ResponseEntity.ok(service.lookupPass(name, phone));
    }

    @PutMapping
    public ResponseEntity<?> replace(@RequestBody Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "요청 본문이 필요합니다."));
        }
        LocalDate date;
        Booking.Branch branchEnum;
        try {
            date = LocalDate.parse(String.valueOf(body.get("matchDate")).trim());
            Object branchRaw = body.get("branch");
            String branch = branchRaw == null || branchRaw.toString().isBlank() ? "SAHA" : branchRaw.toString();
            branchEnum = Booking.Branch.valueOf(branch.trim().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 또는 지점이 올바르지 않습니다."));
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        Object rawList = body.get("participants");
        if (rawList instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> row = (Map<String, Object>) map;
                    rows.add(row);
                }
            }
        }
        try {
            List<SocialScrimmageParticipant> saved = service.replace(date, branchEnum, rows);
            return ResponseEntity.ok(toPayload(date, branchEnum, saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    e.getMessage() == null ? "저장에 실패했습니다." : e.getMessage()));
        }
    }

    private Map<String, Object> toPayload(LocalDate date, Booking.Branch branch,
                                          List<SocialScrimmageParticipant> rows) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("matchDate", date.toString());
        payload.put("branch", branch != null ? branch.name() : "SAHA");
        List<Map<String, Object>> participants = new ArrayList<>();
        int blue = 0;
        int white = 0;
        int unassigned = 0;
        for (SocialScrimmageParticipant p : rows) {
            participants.add(toRow(p));
            if (p.getSide() == SocialScrimmageParticipant.Side.BLUE) {
                blue++;
            } else if (p.getSide() == SocialScrimmageParticipant.Side.WHITE) {
                white++;
            } else {
                unassigned++;
            }
        }
        payload.put("participants", participants);
        payload.put("total", participants.size());
        payload.put("blueCount", blue);
        payload.put("whiteCount", white);
        payload.put("unassignedSideCount", unassigned);
        return payload;
    }

    private Map<String, Object> toRow(SocialScrimmageParticipant p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("seqNo", p.getSeqNo());
        m.put("name", p.getName());
        m.put("team", p.getTeam());
        m.put("phone", p.getPhone());
        m.put("side", p.getSide() != null ? p.getSide().name() : null);
        m.put("hopedPosition", p.getHopedPosition());
        m.put("assignedPosition", p.getAssignedPosition());
        m.put("memo", p.getMemo());
        m.put("productId", p.getProductId());
        m.put("remainingAtStart", p.getRemainingCount());
        m.put("countPassApplied", p.isCountPassApplied());
        m.put("pendingDeductDate", p.getPendingDeductDate() != null ? p.getPendingDeductDate().toString() : null);

        // 이름+연락처가 야외 레슨 횟수권과 같으면 실시간 잔여를 공유 표시
        Map<String, Object> live = service.lookupPass(p.getName(), p.getPhone());
        if (live != null && !live.isEmpty() && live.get("remainingCount") != null) {
            m.put("remainingCount", live.get("remainingCount"));
            m.put("totalCount", live.get("totalCount"));
            m.put("planName", live.get("planName"));
            if (live.get("productId") != null) {
                m.put("productId", live.get("productId"));
            }
            if (live.get("prepaidPass") != null) {
                m.put("prepaidPass", live.get("prepaidPass"));
            }
            if (p.getDepositAmount() == null && live.get("depositAmount") != null) {
                m.put("depositAmount", live.get("depositAmount"));
            } else {
                m.put("depositAmount", p.getDepositAmount());
            }
            if (!p.isDepositConfirmed() && Boolean.TRUE.equals(live.get("depositConfirmed"))) {
                m.put("depositConfirmed", true);
            } else {
                m.put("depositConfirmed", p.isDepositConfirmed());
            }
        } else {
            m.put("remainingCount", displayRemaining(p));
            m.put("totalCount", null);
            m.put("depositAmount", p.getDepositAmount());
            m.put("depositConfirmed", p.isDepositConfirmed());
        }
        return m;
    }

    /** 차감 전이면 시작 잔여, 차감 후면 시작-1 */
    private static Integer displayRemaining(SocialScrimmageParticipant p) {
        if (p == null || p.getRemainingCount() == null) {
            return null;
        }
        if (p.isCountPassApplied()) {
            return Math.max(0, p.getRemainingCount() - 1);
        }
        return p.getRemainingCount();
    }
}
