package com.afbscenter.controller;

import com.afbscenter.model.SocialOutdoorDay;
import com.afbscenter.repository.SocialOutdoorDayRepository;
import com.afbscenter.util.WeekdayScheduleFields;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 관리자 전용 — 사회인 야외 반복 일정 날짜 등록·삭제
 */
@RestController
@RequestMapping("/api/social-outdoor-days")
public class SocialOutdoorDayController {

    private static final Logger logger = LoggerFactory.getLogger(SocialOutdoorDayController.class);

    private final SocialOutdoorDayRepository socialOutdoorDayRepository;

    public SocialOutdoorDayController(SocialOutdoorDayRepository socialOutdoorDayRepository) {
        this.socialOutdoorDayRepository = socialOutdoorDayRepository;
    }

    private boolean canEdit(HttpServletRequest request) {
        String role = request != null ? (String) request.getAttribute("role") : null;
        return "ADMIN".equals(role) || "MANAGER".equals(role);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 조회할 수 있습니다."));
        }
        if (endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Map.of("error", "기간이 올바르지 않습니다."));
        }
        List<Map<String, Object>> out = socialOutdoorDayRepository
                .findByOutdoorDateBetweenOrderByOutdoorDateAsc(startDate, endDate)
                .stream()
                .map(this::toMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }

    @PutMapping
    public ResponseEntity<?> upsert(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 수정할 수 있습니다."));
        }
        try {
            String dateStr = body != null && body.get("outdoorDate") != null ? body.get("outdoorDate").toString().trim() : null;
            if (dateStr == null || dateStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "outdoorDate가 필요합니다."));
            }
            LocalDate outdoorDate = LocalDate.parse(dateStr);
            SocialOutdoorDay row = socialOutdoorDayRepository.findByOutdoorDate(outdoorDate).orElseGet(SocialOutdoorDay::new);
            row.setOutdoorDate(outdoorDate);
            Object[] fields = WeekdayScheduleFields.readFromBody(body);
            row.setTimeText((String) fields[0]);
            row.setBranch((String) fields[1]);
            row.setCoachId((Long) fields[2]);
            row.setPlace((String) fields[3]);
            socialOutdoorDayRepository.save(row);
            return ResponseEntity.ok(toMap(row));
        } catch (Exception e) {
            logger.warn("social-outdoor-days upsert 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다."));
        }
    }

    @DeleteMapping("/{outdoorDate}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String outdoorDate, HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 삭제할 수 있습니다."));
        }
        try {
            LocalDate d = LocalDate.parse(outdoorDate);
            socialOutdoorDayRepository.deleteByOutdoorDate(d);
            return ResponseEntity.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "삭제에 실패했습니다."));
        }
    }

    private Map<String, Object> toMap(SocialOutdoorDay row) {
        Map<String, Object> map = new HashMap<>();
        map.put("outdoorDate", row.getOutdoorDate() != null ? row.getOutdoorDate().toString() : null);
        WeekdayScheduleFields.putInto(map, row.getTimeText(), row.getBranch(), row.getCoachId(), row.getPlace());
        return map;
    }
}
