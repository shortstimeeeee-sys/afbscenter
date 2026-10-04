package com.afbscenter.controller;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;
import com.afbscenter.repository.BranchClosureRepository;
import com.afbscenter.util.BranchStudio;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 달력 표시용 — 로그인 없이 휴무 그룹·기간별 조회
 */
@RestController
@RequestMapping("/api/public/branch-closures")
public class PublicBranchClosureController {

    private final BranchClosureRepository branchClosureRepository;

    public PublicBranchClosureController(BranchClosureRepository branchClosureRepository) {
        this.branchClosureRepository = branchClosureRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listInRange(
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String calendarPart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        BranchClosure.ClosureGroup g = BranchStudio.parseGroup(group);
        if (g == null && calendarPart != null) {
            g = BranchStudio.parseGroup(calendarPart);
        }
        if (g == null) {
            g = BranchStudio.parseGroup(branch);
        }
        if (g == null || endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Collections.emptyList());
        }
        Facility.Branch studio = BranchStudio.storageBranch(g);
        List<BranchClosure.CalendarPart> parts = BranchStudio.displayParts(g);
        final BranchClosure.ClosureGroup resolved = g;
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, Object>> out = branchClosureRepository
                .findByBranchAndCalendarPartInAndClosureDateBetweenOrderByClosureDateAsc(
                        studio, parts, startDate, endDate)
                .stream()
                .filter(row -> row.getClosureDate() != null && seen.add(row.getClosureDate().toString()))
                .map(row -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("group", resolved.name());
                    map.put("closureDate", row.getClosureDate().toString());
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(out);
    }
}
