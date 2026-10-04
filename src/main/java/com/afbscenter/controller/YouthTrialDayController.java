package com.afbscenter.controller;

import com.afbscenter.model.YouthTrialDay;
import com.afbscenter.repository.YouthTrialDayRepository;
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
 * 관리자 전용 — 유소년 체험 반복 일정 날짜 등록·삭제
 */
@RestController
@RequestMapping("/api/youth-trial-days")
public class YouthTrialDayController {

    private static final Logger logger = LoggerFactory.getLogger(YouthTrialDayController.class);

    private final YouthTrialDayRepository youthTrialDayRepository;

    public YouthTrialDayController(YouthTrialDayRepository youthTrialDayRepository) {
        this.youthTrialDayRepository = youthTrialDayRepository;
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
        List<Map<String, Object>> out = youthTrialDayRepository
                .findByTrialDateBetweenOrderByTrialDateAsc(startDate, endDate)
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
            String dateStr = body != null && body.get("trialDate") != null ? body.get("trialDate").toString().trim() : null;
            if (dateStr == null || dateStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "trialDate가 필요합니다."));
            }
            LocalDate trialDate = LocalDate.parse(dateStr);
            YouthTrialDay row = youthTrialDayRepository.findByTrialDate(trialDate).orElseGet(YouthTrialDay::new);
            row.setTrialDate(trialDate);
            Object[] fields = WeekdayScheduleFields.readFromBody(body);
            row.setTimeText((String) fields[0]);
            row.setBranch((String) fields[1]);
            row.setCoachId((Long) fields[2]);
            youthTrialDayRepository.save(row);
            return ResponseEntity.ok(toMap(row));
        } catch (Exception e) {
            logger.warn("youth-trial-days upsert 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다."));
        }
    }

    @DeleteMapping("/{trialDate}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String trialDate, HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 삭제할 수 있습니다."));
        }
        try {
            LocalDate d = LocalDate.parse(trialDate);
            youthTrialDayRepository.deleteByTrialDate(d);
            return ResponseEntity.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "삭제에 실패했습니다."));
        }
    }

    private Map<String, Object> toMap(YouthTrialDay row) {
        Map<String, Object> map = new HashMap<>();
        map.put("trialDate", row.getTrialDate() != null ? row.getTrialDate().toString() : null);
        WeekdayScheduleFields.putInto(map, row.getTimeText(), row.getBranch(), row.getCoachId());
        return map;
    }
}
