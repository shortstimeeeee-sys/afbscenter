package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.OutdoorLessonParticipant;
import com.afbscenter.model.Product;
import com.afbscenter.repository.SocialOutdoorDayRepository;
import com.afbscenter.service.OutdoorLessonParticipantService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/outdoor-lesson-participants")
public class OutdoorLessonParticipantController {

    private final OutdoorLessonParticipantService service;
    private final SocialOutdoorDayRepository socialOutdoorDayRepository;

    public OutdoorLessonParticipantController(OutdoorLessonParticipantService service,
                                              SocialOutdoorDayRepository socialOutdoorDayRepository) {
        this.service = service;
        this.socialOutdoorDayRepository = socialOutdoorDayRepository;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam String lessonDate,
                                  @RequestParam(required = false, defaultValue = "SAHA") String branch) {
        LocalDate date;
        Booking.Branch branchEnum;
        try {
            date = LocalDate.parse(lessonDate.trim());
            branchEnum = Booking.Branch.valueOf(branch.trim().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 또는 지점이 올바르지 않습니다."));
        }
        LocalDate today = LocalDate.now();
        List<OutdoorLessonParticipant> rows = service.refreshUnappliedRemaining(
                service.applyPendingCountPassDeductions(
                        service.list(date, branchEnum), today));
        boolean seeded = false;
        // 달력에 사회인 야외일로 표시된 날에만 이전 횟수권 잔여 명단을 시드한다.
        // (야외 없는 날을 열었을 때 임의 이월처럼 보이는 것 방지)
        boolean outdoorDay = socialOutdoorDayRepository.findByOutdoorDate(date).isPresent();
        if (rows.isEmpty() && outdoorDay) {
            rows = service.suggestCountPassCarryOver(date, branchEnum, today);
            seeded = !rows.isEmpty();
        }
        Map<String, Object> payload = toPayload(date, branchEnum, rows);
        payload.put("seededFromPrevious", seeded);
        payload.put("socialOutdoorDay", outdoorDay);
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/history")
    public ResponseEntity<?> history() {
        return ResponseEntity.ok(service.history());
    }

    @GetMapping("/pass-lookup")
    public ResponseEntity<?> lookupPass(@RequestParam(required = false, defaultValue = "") String name,
                                        @RequestParam(required = false, defaultValue = "") String phone,
                                        @RequestParam(required = false, defaultValue = "") String team,
                                        @RequestParam(required = false, defaultValue = "false") boolean teamBooking,
                                        @RequestParam(required = false) String lessonDate) {
        return ResponseEntity.ok(service.lookupMemberCountPass(
                name, phone, team, teamBooking, parseOptionalDate(lessonDate)));
    }

    @GetMapping("/member-lookup")
    public ResponseEntity<?> lookupMembers(@RequestParam(required = false, defaultValue = "") String q,
                                           @RequestParam(required = false) String lessonDate) {
        return ResponseEntity.ok(service.searchMembersForRoster(q, parseOptionalDate(lessonDate)));
    }

    private static LocalDate parseOptionalDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (Exception e) {
            return null;
        }
    }

    @PutMapping
    public ResponseEntity<?> replace(@RequestBody Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "요청 본문이 필요합니다."));
        }
        LocalDate date;
        Booking.Branch branchEnum;
        try {
            date = LocalDate.parse(String.valueOf(body.get("lessonDate")).trim());
            Object branchRaw = body.get("branch");
            String branch = branchRaw == null || branchRaw.toString().isBlank() ? "SAHA" : branchRaw.toString();
            branchEnum = Booking.Branch.valueOf(branch.trim().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 또는 지점이 올바르지 않습니다."));
        }
        LocalDate previousDate = null;
        Object prevRaw = body.get("previousLessonDate");
        if (prevRaw != null && !prevRaw.toString().isBlank()) {
            try {
                previousDate = LocalDate.parse(prevRaw.toString().trim());
            } catch (Exception e) {
                return ResponseEntity.badRequest().body(Map.of("error", "이전 날짜가 올바르지 않습니다."));
            }
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
        List<OutdoorLessonParticipant> saved = service.replace(date, branchEnum, rows, previousDate);
        return ResponseEntity.ok(toPayload(date, branchEnum, saved));
    }

    @PostMapping("/carry-over")
    public ResponseEntity<?> carryOver(@RequestBody Map<String, Object> body) {
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "요청 본문이 필요합니다."));
        }
        LocalDate fromDate;
        LocalDate toDate;
        Booking.Branch branchEnum;
        try {
            fromDate = LocalDate.parse(String.valueOf(body.get("fromDate")).trim());
            toDate = LocalDate.parse(String.valueOf(body.get("toDate")).trim());
            Object branchRaw = body.get("branch");
            String branch = branchRaw == null || branchRaw.toString().isBlank() ? "SAHA" : branchRaw.toString();
            branchEnum = Booking.Branch.valueOf(branch.trim().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 또는 지점이 올바르지 않습니다."));
        }
        Map<String, Object> participant = Map.of();
        Object raw = body.get("participant");
        if (raw instanceof Map<?, ?> map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> row = (Map<String, Object>) map;
            participant = row;
        }
        OutdoorLessonParticipant moved = service.carryOver(fromDate, toDate, branchEnum, participant);
        Map<String, Object> payload = toPayload(fromDate, branchEnum, service.list(fromDate, branchEnum));
        payload.put("movedToDate", toDate.toString());
        payload.put("movedName", moved.getName());
        payload.put("movedId", moved.getId());
        return ResponseEntity.ok(payload);
    }

    @PatchMapping("/{id}/attendance")
    public ResponseEntity<?> markAttendance(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        boolean attended = body != null && bool(body.get("attended"));
        OutdoorLessonParticipant saved = service.markAttendance(id, attended);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", saved.getId());
        out.put("attended", saved.isAttended());
        out.put("name", saved.getName() == null ? "" : saved.getName());
        out.put("remainingCount", service.remainingToShow(saved));
        out.put("remainingAtStart", service.remainingAtStartToSend(saved));
        out.put("countPassApplied", saved.isCountPassApplied());
        return ResponseEntity.ok(out);
    }

    @DeleteMapping
    public ResponseEntity<?> clear(@RequestParam String lessonDate,
                                   @RequestParam(required = false, defaultValue = "SAHA") String branch) {
        LocalDate date;
        Booking.Branch branchEnum;
        try {
            date = LocalDate.parse(lessonDate.trim());
            branchEnum = Booking.Branch.valueOf(branch.trim().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 또는 지점이 올바르지 않습니다."));
        }
        service.replace(date, branchEnum, List.of());
        return ResponseEntity.ok(toPayload(date, branchEnum, List.of()));
    }

    private Map<String, Object> toPayload(LocalDate date, Booking.Branch branch,
                                          List<OutdoorLessonParticipant> rows) {
        List<Map<String, Object>> plans = service.listPlans(rows);
        Map<Long, Map<String, Object>> planById = new LinkedHashMap<>();
        for (Map<String, Object> plan : plans) {
            Object id = plan.get("id");
            if (id instanceof Number number) {
                planById.put(number.longValue(), plan);
            }
        }
        List<Map<String, Object>> participants = new ArrayList<>();
        int confirmed = 0;
        int attendedCount = 0;
        long confirmedAmount = 0;
        for (OutdoorLessonParticipant row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.getId());
            item.put("seqNo", row.getSeqNo());
            item.put("name", row.getName());
            item.put("team", row.getTeam() == null ? "" : row.getTeam());
            item.put("phone", row.getPhone() == null ? "" : row.getPhone());
            int headcount = row.isTeamBooking()
                    ? (row.getHeadcount() == null || row.getHeadcount() < 1 ? 1 : row.getHeadcount())
                    : 1;
            item.put("headcount", headcount);
            item.put("teamBooking", row.isTeamBooking());
            item.put("productId", row.getProductId());
            Integer amount = row.getDepositAmount();
            String productName = "";
            boolean prepaidPass = service.isPrepaidCountPass(row);
            if (row.getProductId() != null) {
                Map<String, Object> plan = planById.get(row.getProductId());
                if (plan != null) {
                    productName = String.valueOf(plan.getOrDefault("name", ""));
                    if (!prepaidPass && plan.get("price") instanceof Number price) {
                        if (amount == null || amount == 0) {
                            amount = price.intValue();
                        }
                    }
                } else {
                    productName = service.findPlan(row.getProductId())
                            .map(Product::getName)
                            .orElse("");
                }
            }
            if (prepaidPass) {
                amount = 0;
            }
            item.put("productName", productName);
            boolean teamPackage = false;
            if (row.getProductId() != null) {
                Map<String, Object> plan = planById.get(row.getProductId());
                if (plan != null && Boolean.TRUE.equals(plan.get("teamPackage"))) {
                    teamPackage = true;
                } else if (plan != null && "TEAM_PACKAGE".equals(String.valueOf(plan.get("type")))) {
                    teamPackage = true;
                }
            }
            item.put("teamPackage", teamPackage);
            item.put("prepaidPass", prepaidPass);
            item.put("depositAmount", amount);
            item.put("depositConfirmed", row.isDepositConfirmed());
            item.put("attended", row.isAttended());
            item.put("remainingCount", service.remainingToShow(row));
            item.put("remainingAtStart", service.remainingAtStartToSend(row));
            item.put("countPassApplied", row.isCountPassApplied());
            item.put("totalCount", service.totalCountToShow(row));
            item.put("pendingDeductDate", row.getPendingDeductDate() == null ? null : row.getPendingDeductDate().toString());
            item.put("notes", notesFor(row, row.isTeamBooking()));
            item.put("carriedFromDate", row.getCarriedFromDate() == null ? null : row.getCarriedFromDate().toString());
            if (row.isDepositConfirmed()) {
                confirmed += headcount;
                if (amount != null) {
                    confirmedAmount += amount;
                }
            }
            if (row.isAttended()) {
                attendedCount += headcount;
            }
            participants.add(item);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("lessonDate", date.toString());
        payload.put("branch", branch.name());
        payload.put("plans", plans);
        payload.put("participants", participants);
        int people = 0;
        for (OutdoorLessonParticipant row : rows) {
            int hc = row.isTeamBooking()
                    ? (row.getHeadcount() == null || row.getHeadcount() < 1 ? 1 : row.getHeadcount())
                    : 1;
            people += hc;
        }
        payload.put("total", people);
        payload.put("depositConfirmedCount", confirmed);
        payload.put("depositConfirmedAmount", confirmedAmount);
        payload.put("attendedCount", attendedCount);
        return payload;
    }

    private static List<String> notesFor(OutdoorLessonParticipant row, boolean teamPackage) {
        List<String> notes = new ArrayList<>();
        if (!row.isDepositConfirmed()) {
            notes.add("입금 확인 할 것");
        }
        String phone = row.getPhone() == null ? "" : row.getPhone().replaceAll("\\D", "");
        if (!teamPackage && phone.isEmpty()) {
            notes.add("연락처 확인 할 것");
        }
        if (row.getProductId() == null) {
            notes.add("요금제 확인 할 것");
        }
        return notes;
    }

    private static boolean bool(Object raw) {
        if (raw instanceof Boolean value) {
            return value;
        }
        if (raw == null) {
            return false;
        }
        String s = raw.toString().trim();
        return "true".equalsIgnoreCase(s) || "1".equals(s) || "Y".equalsIgnoreCase(s);
    }
}
