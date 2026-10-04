package com.afbscenter.controller;

import com.afbscenter.repository.SocialScrimmageDayRepository;
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
 * 달력 표시용 — 로그인 없이 사회인 청/백전 날짜 조회
 */
@RestController
@RequestMapping("/api/public/social-scrimmage-days")
public class PublicSocialScrimmageDayController {

    private final SocialScrimmageDayRepository socialScrimmageDayRepository;

    public PublicSocialScrimmageDayController(SocialScrimmageDayRepository socialScrimmageDayRepository) {
        this.socialScrimmageDayRepository = socialScrimmageDayRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listInRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
        List<Map<String, Object>> out = socialScrimmageDayRepository
                .findByScrimmageDateBetweenOrderByScrimmageDateAsc(startDate, endDate)
                .stream()
                .map(row -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("scrimmageDate",
                            row.getScrimmageDate() != null ? row.getScrimmageDate().toString() : null);
                    WeekdayScheduleFields.putInto(map, row.getTimeText(), row.getBranch(), row.getCoachId(), row.getPlace());
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }
}
