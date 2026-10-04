package com.afbscenter.controller;

import com.afbscenter.repository.YouthTrialDayRepository;
import com.afbscenter.util.WeekdayScheduleFields;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 달력 표시용 — 로그인 없이 유소년 체험 날짜 조회
 */
@RestController
@RequestMapping("/api/public/youth-trial-days")
public class PublicYouthTrialDayController {

    private final YouthTrialDayRepository youthTrialDayRepository;

    public PublicYouthTrialDayController(YouthTrialDayRepository youthTrialDayRepository) {
        this.youthTrialDayRepository = youthTrialDayRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listInRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
        List<Map<String, Object>> out = youthTrialDayRepository
                .findByTrialDateBetweenOrderByTrialDateAsc(startDate, endDate)
                .stream()
                .map(row -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("trialDate", row.getTrialDate() != null ? row.getTrialDate().toString() : null);
                    WeekdayScheduleFields.putInto(map, row.getTimeText(), row.getBranch(), row.getCoachId());
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }
}
