package com.afbscenter.controller;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;
import com.afbscenter.repository.BranchClosureRepository;
import com.afbscenter.util.BranchStudio;
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
 * 관리자 전용 — 휴무 그룹(사하 / 연산 / 비야구 파트) 등록·삭제
 */
@RestController
@RequestMapping("/api/branch-closures")
public class BranchClosureController {

    private static final Logger logger = LoggerFactory.getLogger(BranchClosureController.class);

    private final BranchClosureRepository branchClosureRepository;

    public BranchClosureController(BranchClosureRepository branchClosureRepository) {
        this.branchClosureRepository = branchClosureRepository;
    }

    private boolean canEdit(HttpServletRequest request) {
        String role = request != null ? (String) request.getAttribute("role") : null;
        return "ADMIN".equals(role) || "MANAGER".equals(role);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(
            @RequestParam(required = false) String group,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String calendarPart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 조회할 수 있습니다."));
        }
        BranchClosure.ClosureGroup g = resolveGroup(group, branch, calendarPart);
        if (g == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "그룹은 사하·연산·비야구 파트만 지정할 수 있습니다."));
        }
        if (endDate.isBefore(startDate)) {
            return ResponseEntity.badRequest().body(Map.of("error", "기간이 올바르지 않습니다."));
        }
        Facility.Branch studio = BranchStudio.storageBranch(g);
        BranchClosure.CalendarPart part = BranchStudio.storagePart(g);
        List<Map<String, Object>> out = branchClosureRepository
                .findByBranchAndCalendarPartAndClosureDateBetweenOrderByClosureDateAsc(studio, part, startDate, endDate)
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
            String groupRaw = body != null && body.get("group") != null ? body.get("group").toString() : null;
            String branchRaw = body != null && body.get("branch") != null ? body.get("branch").toString() : null;
            String partRaw = body != null && body.get("calendarPart") != null ? body.get("calendarPart").toString() : null;
            BranchClosure.ClosureGroup g = resolveGroup(groupRaw, branchRaw, partRaw);
            if (g == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "그룹은 사하·연산·비야구 파트만 지정할 수 있습니다."));
            }
            String dateStr = body.get("closureDate") != null ? body.get("closureDate").toString().trim() : null;
            if (dateStr == null || dateStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "closureDate가 필요합니다."));
            }
            LocalDate closureDate = LocalDate.parse(dateStr);
            Facility.Branch studio = BranchStudio.storageBranch(g);
            BranchClosure.CalendarPart part = BranchStudio.storagePart(g);
            BranchClosure row = branchClosureRepository
                    .findByBranchAndCalendarPartAndClosureDate(studio, part, closureDate)
                    .orElseGet(BranchClosure::new);
            row.setBranch(studio);
            row.setCalendarPart(part);
            row.setClosureDate(closureDate);
            branchClosureRepository.save(row);
            return ResponseEntity.ok(toMap(row));
        } catch (Exception e) {
            logger.warn("branch-closures upsert 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다."));
        }
    }

    @DeleteMapping("/{group}/{closureDate}")
    @Transactional
    public ResponseEntity<?> delete(
            @PathVariable String group,
            @PathVariable String closureDate,
            HttpServletRequest request) {
        if (!canEdit(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "관리자·매니저만 삭제할 수 있습니다."));
        }
        try {
            BranchClosure.ClosureGroup g = resolveGroup(group, null, null);
            if (g == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "그룹은 사하·연산·비야구 파트만 지정할 수 있습니다."));
            }
            LocalDate d = LocalDate.parse(closureDate);
            branchClosureRepository.deleteByBranchAndCalendarPartAndClosureDate(
                    BranchStudio.storageBranch(g), BranchStudio.storagePart(g), d);
            return ResponseEntity.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "삭제에 실패했습니다."));
        }
    }

    private BranchClosure.ClosureGroup resolveGroup(String group, String branch, String calendarPart) {
        BranchClosure.ClosureGroup fromGroup = BranchStudio.parseGroup(group);
        if (fromGroup != null) {
            return fromGroup;
        }
        if (calendarPart != null && !calendarPart.isBlank()) {
            BranchClosure.ClosureGroup fromPart = BranchStudio.parseGroup(calendarPart);
            if (fromPart == BranchClosure.ClosureGroup.NON_BASEBALL) {
                return fromPart;
            }
        }
        return BranchStudio.parseGroup(branch);
    }

    private Map<String, Object> toMap(BranchClosure m) {
        Map<String, Object> map = new HashMap<>();
        BranchClosure.ClosureGroup g = BranchStudio.fromStored(m.getBranch(), m.getCalendarPart());
        map.put("group", g != null ? g.name() : "");
        map.put("closureDate", m.getClosureDate() != null ? m.getClosureDate().toString() : "");
        return map;
    }
}
