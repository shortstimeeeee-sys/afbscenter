package com.afbscenter.controller;

import com.afbscenter.constants.CoachColorPalette;
import com.afbscenter.model.Coach;
import com.afbscenter.model.ManualProfitSheetEntry;
import com.afbscenter.model.ManualProfitSheetPayer;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.ManualProfitSheetEntryRepository;
import com.afbscenter.repository.ManualProfitSheetPayerRepository;
import com.afbscenter.service.ProfitSheetAccessService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 수기 수익 정산표. 결제 데이터로 채우지 않고 입력값만 보관한다.
 */
@RestController
@RequestMapping("/api/profit-sheet")
public class ProfitSheetController {

    private static final Logger logger = LoggerFactory.getLogger(ProfitSheetController.class);

    private static final List<String> PREFERRED_COACH_ORDER = List.of(
            "서정민", "서정훈", "이원준", "공인욱", "정영삼", "정진환",
            "이품순", "김가영", "이소연", "김유진", "김태영", "박근엽"
    );

    private final ManualProfitSheetEntryRepository entryRepository;
    private final ManualProfitSheetPayerRepository payerRepository;
    private final CoachRepository coachRepository;
    private final ProfitSheetAccessService accessService;

    public ProfitSheetController(ManualProfitSheetEntryRepository entryRepository,
                                 ManualProfitSheetPayerRepository payerRepository,
                                 CoachRepository coachRepository,
                                 ProfitSheetAccessService accessService) {
        this.entryRepository = entryRepository;
        this.payerRepository = payerRepository;
        this.coachRepository = coachRepository;
        this.accessService = accessService;
    }

    private boolean canSee(HttpServletRequest request) {
        String username = request != null ? (String) request.getAttribute("username") : null;
        String role = request != null ? (String) request.getAttribute("role") : null;
        return accessService.canSee(username, role);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getSheet(
            @RequestParam int year,
            @RequestParam int month,
            HttpServletRequest request) {
        if (!canSee(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "정산표를 볼 수 없습니다."));
        }
        if (!validYearMonth(year, month)) {
            return ResponseEntity.badRequest().body(Map.of("error", "연·월이 올바르지 않습니다."));
        }
        int daysInMonth = YearMonth.of(year, month).lengthOfMonth();
        List<Map<String, Object>> coaches = sortedCoaches();
        Map<String, Integer> payerCounts = new HashMap<>();
        for (ManualProfitSheetPayer payer : payerRepository.findByYearAndMonth(year, month)) {
            if (payer.getDay() == null || payer.getCoachId() == null) {
                continue;
            }
            String key = payer.getCoachId() + "-" + payer.getDay();
            payerCounts.merge(key, 1, Integer::sum);
        }
        List<Map<String, Object>> entries = new ArrayList<>();
        for (ManualProfitSheetEntry row : entryRepository.findByYearAndMonth(year, month)) {
            if (row.getDay() == null || row.getDay() < 1 || row.getDay() > daysInMonth) {
                continue;
            }
            Map<String, Object> cell = new HashMap<>();
            cell.put("coachId", row.getCoachId());
            cell.put("day", row.getDay());
            cell.put("amount", row.getAmount());
            cell.put("payerCount", payerCounts.getOrDefault(row.getCoachId() + "-" + row.getDay(), 0));
            entries.add(cell);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("year", year);
        out.put("month", month);
        out.put("daysInMonth", daysInMonth);
        out.put("coaches", coaches);
        out.put("entries", entries);
        return ResponseEntity.ok(out);
    }

    @PutMapping
    @Transactional
    public ResponseEntity<?> upsert(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!canSee(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "정산표를 수정할 수 없습니다."));
        }
        try {
            Integer year = toInt(body.get("year"));
            Integer month = toInt(body.get("month"));
            Integer day = toInt(body.get("day"));
            Long coachId = toLong(body.get("coachId"));
            Long amount = toLong(body.get("amount"));
            if (year == null || month == null || day == null || coachId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "year, month, day, coachId가 필요합니다."));
            }
            if (!validYearMonth(year, month)) {
                return ResponseEntity.badRequest().body(Map.of("error", "연·월이 올바르지 않습니다."));
            }
            int daysInMonth = YearMonth.of(year, month).lengthOfMonth();
            if (day < 1 || day > daysInMonth) {
                return ResponseEntity.badRequest().body(Map.of("error", "날짜가 올바르지 않습니다."));
            }
            if (coachRepository.findById(coachId).isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "코치를 찾을 수 없습니다."));
            }
            if (amount == null || amount <= 0) {
                payerRepository.deleteByYearAndMonthAndDayAndCoachId(year, month, day, coachId);
                entryRepository.deleteByYearAndMonthAndDayAndCoachId(year, month, day, coachId);
                return ResponseEntity.ok(Map.of("deleted", true, "year", year, "month", month, "day", day, "coachId", coachId));
            }
            ManualProfitSheetEntry row = entryRepository
                    .findByYearAndMonthAndDayAndCoachId(year, month, day, coachId)
                    .orElseGet(ManualProfitSheetEntry::new);
            row.setYear(year);
            row.setMonth(month);
            row.setDay(day);
            row.setCoachId(coachId);
            row.setAmount(amount);
            entryRepository.save(row);
            Map<String, Object> out = new HashMap<>();
            out.put("year", year);
            out.put("month", month);
            out.put("day", day);
            out.put("coachId", coachId);
            out.put("amount", amount);
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            logger.warn("profit-sheet upsert 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다."));
        }
    }

    @GetMapping("/payers")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getPayers(
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam int day,
            @RequestParam long coachId,
            HttpServletRequest request) {
        if (!canSee(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "정산표를 볼 수 없습니다."));
        }
        if (!validYearMonth(year, month)) {
            return ResponseEntity.badRequest().body(Map.of("error", "연·월이 올바르지 않습니다."));
        }
        var entry = entryRepository.findByYearAndMonthAndDayAndCoachId(year, month, day, coachId);
        if (entry.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "먼저 칸 금액을 등록해 주세요."));
        }
        String coachName = coachRepository.findById(coachId)
                .map(ProfitSheetController::displayName)
                .orElse("");
        List<Map<String, Object>> payers = new ArrayList<>();
        for (ManualProfitSheetPayer row : payerRepository
                .findByYearAndMonthAndDayAndCoachIdOrderBySortOrderAscIdAsc(year, month, day, coachId)) {
            Map<String, Object> p = new HashMap<>();
            p.put("name", row.getPayerName());
            p.put("amount", row.getAmount());
            payers.add(p);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("year", year);
        out.put("month", month);
        out.put("day", day);
        out.put("coachId", coachId);
        out.put("coachName", coachName);
        out.put("cellAmount", entry.get().getAmount());
        out.put("payers", payers);
        return ResponseEntity.ok(out);
    }

    @PutMapping("/payers")
    @Transactional
    public ResponseEntity<?> savePayers(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!canSee(request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "정산표를 수정할 수 없습니다."));
        }
        try {
            Integer year = toInt(body.get("year"));
            Integer month = toInt(body.get("month"));
            Integer day = toInt(body.get("day"));
            Long coachId = toLong(body.get("coachId"));
            if (year == null || month == null || day == null || coachId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "year, month, day, coachId가 필요합니다."));
            }
            if (!validYearMonth(year, month)) {
                return ResponseEntity.badRequest().body(Map.of("error", "연·월이 올바르지 않습니다."));
            }
            int daysInMonth = YearMonth.of(year, month).lengthOfMonth();
            if (day < 1 || day > daysInMonth) {
                return ResponseEntity.badRequest().body(Map.of("error", "날짜가 올바르지 않습니다."));
            }
            if (entryRepository.findByYearAndMonthAndDayAndCoachId(year, month, day, coachId).isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "먼저 칸 금액을 등록해 주세요."));
            }
            payerRepository.deleteByYearAndMonthAndDayAndCoachId(year, month, day, coachId);
            Object raw = body.get("payers");
            int order = 0;
            List<Map<String, Object>> saved = new ArrayList<>();
            if (raw instanceof List<?>) {
                for (Object item : (List<?>) raw) {
                    if (!(item instanceof Map<?, ?>)) {
                        continue;
                    }
                    Map<?, ?> m = (Map<?, ?>) item;
                    String name = m.get("name") != null ? m.get("name").toString().trim() : "";
                    Long amount = toLong(m.get("amount"));
                    if (name.isEmpty() || amount == null || amount <= 0) {
                        continue;
                    }
                    if (name.length() > 100) {
                        name = name.substring(0, 100);
                    }
                    ManualProfitSheetPayer row = new ManualProfitSheetPayer();
                    row.setYear(year);
                    row.setMonth(month);
                    row.setDay(day);
                    row.setCoachId(coachId);
                    row.setPayerName(name);
                    row.setAmount(amount);
                    row.setSortOrder(order++);
                    payerRepository.save(row);
                    Map<String, Object> p = new HashMap<>();
                    p.put("name", name);
                    p.put("amount", amount);
                    saved.add(p);
                }
            }
            Map<String, Object> out = new HashMap<>();
            out.put("year", year);
            out.put("month", month);
            out.put("day", day);
            out.put("coachId", coachId);
            out.put("payers", saved);
            out.put("payerCount", saved.size());
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            logger.warn("profit-sheet payers 저장 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "저장에 실패했습니다."));
        }
    }

    private List<Map<String, Object>> sortedCoaches() {
        List<Coach> active = coachRepository.findByActiveTrue();
        List<Coach> visible = new ArrayList<>();
        for (Coach c : active) {
            if (c == null || CoachColorPalette.isOutdoorLessonPlaceholder(c)) {
                continue;
            }
            visible.add(c);
        }
        visible.sort(Comparator
                .comparingInt((Coach c) -> preferredIndex(CoachColorPalette.normalizeBaseName(c.getName())))
                .thenComparing(c -> CoachColorPalette.normalizeBaseName(c.getName()), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(Coach::getId, Comparator.nullsLast(Long::compareTo)));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Coach c : visible) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("name", c.getName());
            map.put("displayName", displayName(c));
            out.add(map);
        }
        return out;
    }

    static String displayName(Coach coach) {
        String base = CoachColorPalette.normalizeBaseName(coach != null ? coach.getName() : null);
        if (base.isEmpty() && coach != null && coach.getName() != null) {
            base = coach.getName().trim();
        }
        String name = coach != null && coach.getName() != null ? coach.getName() : "";
        if (name.contains("[S]") || name.contains("[P]") || name.contains("[s]") || name.contains("[p]")) {
            return name.trim();
        }
        String spec = coach != null && coach.getSpecialties() != null ? coach.getSpecialties() : "";
        if (spec.contains("필라테스")) {
            return base + "[P]";
        }
        if (spec.contains("사회인")) {
            return base + "[S]";
        }
        return base;
    }

    private static int preferredIndex(String baseName) {
        int idx = PREFERRED_COACH_ORDER.indexOf(baseName);
        return idx >= 0 ? idx : 1000;
    }

    private static boolean validYearMonth(int year, int month) {
        return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
    }

    private static Integer toInt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number) {
            return ((Number) v).intValue();
        }
        String s = v.toString().trim().replace(",", "");
        if (s.isEmpty()) {
            return null;
        }
        return Integer.parseInt(s);
    }

    private static Long toLong(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number) {
            return ((Number) v).longValue();
        }
        String s = v.toString().trim().replace(",", "").replace("원", "");
        if (s.isEmpty()) {
            return null;
        }
        return Long.parseLong(s);
    }
}
