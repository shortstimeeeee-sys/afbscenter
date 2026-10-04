package com.afbscenter.controller;

import com.afbscenter.repository.ExternalWorkDayRepository;
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
 * 달력 표시용 — 로그인 없이 외부업무 날짜 조회
 */
@RestController
@RequestMapping("/api/public/external-work-days")
public class PublicExternalWorkDayController {

    private final ExternalWorkDayRepository externalWorkDayRepository;

    public PublicExternalWorkDayController(ExternalWorkDayRepository externalWorkDayRepository) {
        this.externalWorkDayRepository = externalWorkDayRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listInRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
        List<Map<String, Object>> out = externalWorkDayRepository
                .findByWorkDateBetweenOrderByWorkDateAsc(startDate, endDate)
                .stream()
                .map(row -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("workDate", row.getWorkDate() != null ? row.getWorkDate().toString() : null);
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }
}
