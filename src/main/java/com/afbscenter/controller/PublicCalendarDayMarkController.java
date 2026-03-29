package com.afbscenter.controller;

import com.afbscenter.model.CalendarDayMark;
import com.afbscenter.repository.CalendarDayMarkRepository;
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
 * 달력 표시용 — 로그인 없이 기간별 조회 (회원 예약·운영 달력 공통)
 */
@RestController
@RequestMapping("/api/public/calendar-day-marks")
public class PublicCalendarDayMarkController {

    private final CalendarDayMarkRepository calendarDayMarkRepository;

    public PublicCalendarDayMarkController(CalendarDayMarkRepository calendarDayMarkRepository) {
        this.calendarDayMarkRepository = calendarDayMarkRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listInRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
        List<CalendarDayMark> rows = calendarDayMarkRepository.findByMarkDateBetweenOrderByMarkDateAsc(startDate, endDate);
        List<Map<String, Object>> out = rows.stream().map(this::toMap).collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }

    private Map<String, Object> toMap(CalendarDayMark m) {
        Map<String, Object> map = new HashMap<>();
        map.put("markDate", m.getMarkDate().toString());
        map.put("memo", m.getMemo() != null ? m.getMemo() : "");
        map.put("redDay", m.isRedDay());
        return map;
    }
}
