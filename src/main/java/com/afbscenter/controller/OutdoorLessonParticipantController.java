package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.OutdoorLessonParticipant;
import com.afbscenter.model.Product;
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

    public OutdoorLessonParticipantController(OutdoorLessonParticipantService service) {
        this.service = service;
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
        return ResponseEntity.ok(toPayload(date, branchEnum, service.list(date, branchEnum)));
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
        return ResponseEntity.ok(Map.of(
                "id", saved.getId(),
                "attended", saved.isAttended(),
                "name", saved.getName() == null ? "" : saved.getName()
        ));
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
            item.put("productId", row.getProductId());
            Integer amount = row.getDepositAmount();
            String productName = "";
            if (row.getProductId() != null) {
                Map<String, Object> plan = planById.get(row.getProductId());
                if (plan != null) {
                    productName = String.valueOf(plan.getOrDefault("name", ""));
                    if (amount == null && plan.get("price") instanceof Number price) {
                        amount = price.intValue();
                    }
                } else {
                    productName = service.findPlan(row.getProductId())
                            .map(Product::getName)
                            .orElse("");
                }
            }
            item.put("productName", productName);
            item.put("depositAmount", amount);
            item.put("depositConfirmed", row.isDepositConfirmed());
            item.put("attended", row.isAttended());
            item.put("notes", notesFor(row));
            item.put("carriedFromDate", row.getCarriedFromDate() == null ? null : row.getCarriedFromDate().toString());
            if (row.isDepositConfirmed()) {
                confirmed++;
                if (amount != null) {
                    confirmedAmount += amount;
                }
            }
            if (row.isAttended()) {
                attendedCount++;
            }
            participants.add(item);
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("lessonDate", date.toString());
        payload.put("branch", branch.name());
        payload.put("plans", plans);
        payload.put("participants", participants);
        payload.put("total", participants.size());
        payload.put("depositConfirmedCount", confirmed);
        payload.put("depositConfirmedAmount", confirmedAmount);
        payload.put("attendedCount", attendedCount);
        return payload;
    }

    private static List<String> notesFor(OutdoorLessonParticipant row) {
        List<String> notes = new ArrayList<>();
        if (!row.isDepositConfirmed()) {
            notes.add("입금 확인 할 것");
        }
        String phone = row.getPhone() == null ? "" : row.getPhone().replaceAll("\\D", "");
        if (phone.isEmpty()) {
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
