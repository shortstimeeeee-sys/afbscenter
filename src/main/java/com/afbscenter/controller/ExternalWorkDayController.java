package com.afbscenter.controller;

import com.afbscenter.model.ExternalWorkDay;
import com.afbscenter.repository.ExternalWorkDayRepository;
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
 * 관리자 전용 — 외부업무 반복 일정 날짜 등록·삭제
 */
@RestController
@RequestMapping("/api/external-work-days")
public class ExternalWorkDayController {

    private static final Logger logger = LoggerFactory.getLogger(ExternalWorkDayController.class);

    private final ExternalWorkDayRepository externalWorkDayRepository;

    public ExternalWorkDayController(ExternalWorkDayRepository externalWorkDayRepository) {
        this.externalWorkDayRepository = externalWorkDayRepository;
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
        List<Map<String, Object>> out = externalWorkDayRepository
                .findByWorkDateBetweenOrderByWorkDateAsc(startDate, endDate)
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
            String dateStr = body != null && body.get("workDate") != null ? body.get("workDate").toString().trim() : null;
            if (dateStr == null || dateStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "workDate가 필요합니다."));
            }
            LocalDate workDate = LocalDate.parse(dateStr);
            ExternalWorkDay row = externalWorkDayRepository.findByWorkDate(workDate).orElseGet(ExternalWorkDay::new);
            row.setWorkDate(workDate);
            externalWorkDayRepository.save(row);
            return ResponseEntity.ok(toMap(row));
        } catch (Exception e) {
            logger.warn("external-work-days upsert 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다."));
        }
    }

    @DeleteMapping("/{workDate}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String workDate, HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 삭제할 수 있습니다."));
        }
        try {
            LocalDate d = LocalDate.parse(workDate);
            externalWorkDayRepository.deleteByWorkDate(d);
            return ResponseEntity.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "삭제에 실패했습니다."));
        }
    }

    private Map<String, Object> toMap(ExternalWorkDay row) {
        Map<String, Object> map = new HashMap<>();
        map.put("workDate", row.getWorkDate() != null ? row.getWorkDate().toString() : null);
        return map;
    }
}
