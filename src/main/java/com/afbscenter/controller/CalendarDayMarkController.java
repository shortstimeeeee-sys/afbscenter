package com.afbscenter.controller;

import com.afbscenter.model.CalendarDayMark;
import com.afbscenter.repository.CalendarDayMarkRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 관리자 전용 — 달력 날짜 메모·빨간날 등록/삭제
 */
@RestController
@RequestMapping("/api/calendar-day-marks")
public class CalendarDayMarkController {

    private static final Logger logger = LoggerFactory.getLogger(CalendarDayMarkController.class);

    private final CalendarDayMarkRepository calendarDayMarkRepository;

    public CalendarDayMarkController(CalendarDayMarkRepository calendarDayMarkRepository) {
        this.calendarDayMarkRepository = calendarDayMarkRepository;
    }

    private boolean canEditCalendarMarks(HttpServletRequest request) {
        String role = request != null ? (String) request.getAttribute("role") : null;
        return "ADMIN".equals(role) || "MANAGER".equals(role);
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> upsert(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!canEditCalendarMarks(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 수정할 수 있습니다."));
        }
        try {
            String dateStr = body != null && body.get("markDate") != null ? body.get("markDate").toString().trim() : null;
            if (dateStr == null || dateStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "markDate가 필요합니다."));
            }
            LocalDate markDate = LocalDate.parse(dateStr);
            String memo = body.get("memo") != null ? body.get("memo").toString().trim() : "";
            if (memo.length() > 2000) {
                return ResponseEntity.badRequest().body(Map.of("error", "메모는 2000자까지입니다."));
            }
            boolean redDay = true;
            if (body.containsKey("redDay") && body.get("redDay") != null) {
                Object rd = body.get("redDay");
                if (rd instanceof Boolean) {
                    redDay = (Boolean) rd;
                } else {
                    redDay = Boolean.parseBoolean(rd.toString());
                }
            }

            if (!redDay && memo.isEmpty()) {
                calendarDayMarkRepository.deleteByMarkDate(markDate);
                return ResponseEntity.ok(Map.of("deleted", true, "markDate", markDate.toString()));
            }

            Optional<CalendarDayMark> opt = calendarDayMarkRepository.findByMarkDate(markDate);
            CalendarDayMark row = opt.orElseGet(CalendarDayMark::new);
            row.setMarkDate(markDate);
            row.setMemo(memo.isEmpty() ? null : memo);
            row.setRedDay(redDay);
            calendarDayMarkRepository.save(row);
            return ResponseEntity.ok(Map.of(
                    "markDate", markDate.toString(),
                    "memo", memo,
                    "redDay", redDay
            ));
        } catch (Exception e) {
            logger.warn("calendar-day-marks upsert 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{markDate}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String markDate, HttpServletRequest request) {
        if (!canEditCalendarMarks(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 삭제할 수 있습니다."));
        }
        try {
            LocalDate d = LocalDate.parse(markDate);
            calendarDayMarkRepository.deleteByMarkDate(d);
            return ResponseEntity.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "삭제에 실패했습니다."));
        }
    }
}
