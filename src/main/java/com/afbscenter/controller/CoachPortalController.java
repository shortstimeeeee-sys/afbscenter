package com.afbscenter.controller;

import com.afbscenter.model.Coach;
import com.afbscenter.model.CoachWorkRecord;
import com.afbscenter.model.User;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.UserRepository;
import com.afbscenter.service.CoachPortalService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.Map;

@RestController
@RequestMapping("/api/coach-portal")
public class CoachPortalController {

    private final CoachPortalService coachPortalService;
    private final UserRepository userRepository;
    private final CoachRepository coachRepository;
    private final com.afbscenter.service.CoachHomeOperatorService coachHomeOperatorService;

    public CoachPortalController(CoachPortalService coachPortalService,
                                 UserRepository userRepository,
                                 CoachRepository coachRepository,
                                 com.afbscenter.service.CoachHomeOperatorService coachHomeOperatorService) {
        this.coachPortalService = coachPortalService;
        this.userRepository = userRepository;
        this.coachRepository = coachRepository;
        this.coachHomeOperatorService = coachHomeOperatorService;
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public ResponseEntity<?> summary(@RequestParam(required = false) Integer year,
                                     @RequestParam(required = false) Integer month,
                                     HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.getHomeSummary(coach, parseMonth(year, month)));
    }

    @GetMapping("/work")
    @Transactional(readOnly = true)
    public ResponseEntity<?> workMonth(@RequestParam(required = false) Integer year,
                                       @RequestParam(required = false) Integer month,
                                       HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.getWorkMonth(coach, parseMonth(year, month)));
    }

    @GetMapping("/work/roster")
    @Transactional(readOnly = true)
    public ResponseEntity<?> workRoster(@RequestParam(required = false) Integer year,
                                        @RequestParam(required = false) Integer month,
                                        HttpServletRequest request) {
        requireStaffRoster(request);
        return ResponseEntity.ok(coachPortalService.getWorkRoster(parseMonth(year, month)));
    }

    @PostMapping("/work/roster/{coachId}/clock-in")
    public ResponseEntity<?> rosterClockIn(@PathVariable Long coachId, HttpServletRequest request) {
        requireStaffRoster(request);
        return ResponseEntity.ok(coachPortalService.clockIn(requireRosterCoach(coachId)));
    }

    @PostMapping("/work/roster/{coachId}/clock-out")
    public ResponseEntity<?> rosterClockOut(@PathVariable Long coachId, HttpServletRequest request) {
        requireStaffRoster(request);
        return ResponseEntity.ok(coachPortalService.clockOut(requireRosterCoach(coachId)));
    }

    @PutMapping("/work/roster/{coachId}/days")
    public ResponseEntity<?> rosterUpsertDay(@PathVariable Long coachId,
                                             @RequestBody Map<String, Object> body,
                                             HttpServletRequest request) {
        requireStaffRoster(request);
        Coach coach = requireRosterCoach(coachId);
        LocalDate date = parseDate(body != null ? body.get("date") : null);
        CoachWorkRecord.DayType type = parseDayType(body != null ? body.get("dayType") : null);
        if (body == null || body.get("dayType") == null) {
            type = CoachWorkRecord.DayType.WORK;
        }
        String memo = body != null && body.get("memo") != null ? String.valueOf(body.get("memo")) : null;
        boolean updateCheckIn = body != null && body.containsKey("checkInTime");
        boolean updateCheckOut = body != null && body.containsKey("checkOutTime");
        LocalDateTime checkIn = updateCheckIn ? parseOptionalDateTime(body.get("checkInTime"), date) : null;
        LocalDateTime checkOut = updateCheckOut ? parseOptionalDateTime(body.get("checkOutTime"), date) : null;
        return ResponseEntity.ok(coachPortalService.saveRosterDay(
                coach, date, type, memo, checkIn, updateCheckIn, checkOut, updateCheckOut));
    }

    @DeleteMapping("/work/roster/{coachId}/days/{date}")
    public ResponseEntity<?> rosterClearDay(@PathVariable Long coachId,
                                            @PathVariable String date,
                                            HttpServletRequest request) {
        requireStaffRoster(request);
        coachPortalService.clearDay(requireRosterCoach(coachId), LocalDate.parse(date));
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @PostMapping("/work/roster/days/{date}/all-off")
    public ResponseEntity<?> rosterAllOff(@PathVariable String date,
                                          @RequestParam(required = false, defaultValue = "main") String group,
                                          @RequestParam(required = false, defaultValue = "OFF") String mark,
                                          HttpServletRequest request) {
        requireStaffRoster(request);
        CoachWorkRecord.DayType type = parseDayType(mark);
        if (type != CoachWorkRecord.DayType.OUTDOOR) {
            type = CoachWorkRecord.DayType.OFF;
        }
        return ResponseEntity.ok(coachPortalService.setRosterDayMark(LocalDate.parse(date), group, type));
    }

    @DeleteMapping("/work/roster/days/{date}/all-off")
    public ResponseEntity<?> rosterClearAllOff(@PathVariable String date,
                                               @RequestParam(required = false, defaultValue = "main") String group,
                                               HttpServletRequest request) {
        requireStaffRoster(request);
        return ResponseEntity.ok(coachPortalService.clearRosterAllOff(LocalDate.parse(date), group));
    }

    @PostMapping("/work/clock-in")
    public ResponseEntity<?> clockIn(HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.clockIn(coach));
    }

    @PostMapping("/work/clock-out")
    public ResponseEntity<?> clockOut(HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.clockOut(coach));
    }

    @PutMapping("/work/days")
    public ResponseEntity<?> upsertDay(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        Coach coach = requireCoach(request);
        LocalDate date = parseDate(body != null ? body.get("date") : null);
        CoachWorkRecord.DayType type = parseDayType(body != null ? body.get("dayType") : null);
        String memo = body != null && body.get("memo") != null ? String.valueOf(body.get("memo")) : null;
        return ResponseEntity.ok(coachPortalService.upsertDay(coach, date, type, memo));
    }

    @DeleteMapping("/work/days/{date}")
    public ResponseEntity<?> clearDay(@PathVariable String date, HttpServletRequest request) {
        Coach coach = requireCoach(request);
        coachPortalService.clearDay(coach, LocalDate.parse(date));
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/members")
    @Transactional(readOnly = true)
    public ResponseEntity<?> members(HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.getMembers(coach));
    }

    @GetMapping("/members/{memberId}/visits")
    @Transactional(readOnly = true)
    public ResponseEntity<?> visits(@PathVariable Long memberId, HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.getMemberVisits(coach, memberId));
    }

    @GetMapping("/settlement")
    @Transactional(readOnly = true)
    public ResponseEntity<?> settlement(@RequestParam(required = false) Integer year,
                                        @RequestParam(required = false) Integer month,
                                        HttpServletRequest request) {
        Coach coach = requireCoach(request);
        return ResponseEntity.ok(coachPortalService.getSettlement(coach, parseMonth(year, month)));
    }

    @PutMapping("/settlement/payments/{paymentId}/received")
    public ResponseEntity<?> saveReceived(@PathVariable Long paymentId,
                                          @RequestBody(required = false) Map<String, Object> body,
                                          HttpServletRequest request) {
        Coach coach = requireCoach(request);
        Integer amount = parseReceivedAmount(body != null ? body.get("receivedAmount") : null);
        return ResponseEntity.ok(coachPortalService.savePaymentReceived(coach, paymentId, amount));
    }

    private void requireStaffRoster(HttpServletRequest request) {
        String username = request != null ? (String) request.getAttribute("username") : null;
        String role = request != null ? (String) request.getAttribute("role") : null;
        if (username != null && !username.isBlank()) {
            User user = userRepository.findByUsername(username.trim()).orElse(null);
            if (user != null && user.getRole() != null) {
                role = user.getRole().name();
            }
        }
        if (!coachHomeOperatorService.canUseStaffWorkRoster(username, role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "직원 출퇴근 명부는 관리자만 볼 수 있습니다.");
        }
    }

    private Coach requireRosterCoach(Long coachId) {
        if (coachId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "코치를 선택해 주세요.");
        }
        return coachRepository.findById(coachId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "코치를 찾을 수 없습니다."));
    }

    private LocalDateTime parseOptionalDateTime(Object raw, LocalDate date) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim();
        if (text.isEmpty() || "null".equalsIgnoreCase(text)) {
            return null;
        }
        try {
            if (text.matches("\\d{1,2}:\\d{2}")) {
                LocalTime t = LocalTime.parse(text.length() == 4 ? "0" + text : text);
                return LocalDateTime.of(date, t);
            }
            if (text.matches("\\d{2}:\\d{2}:\\d{2}")) {
                return LocalDateTime.of(date, LocalTime.parse(text));
            }
            return LocalDateTime.parse(text);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "시각 형식이 올바르지 않습니다.");
        }
    }

    private Coach requireCoach(HttpServletRequest request) {
        String username = request != null ? (String) request.getAttribute("username") : null;
        String role = request != null ? (String) request.getAttribute("role") : null;
        User user = null;
        if (username != null && !username.isBlank()) {
            user = userRepository.findByUsername(username.trim()).orElse(null);
            if (user != null && user.getRole() != null) {
                role = user.getRole().name();
            }
        }
        if (coachHomeOperatorService.canUseAdminCoachHome(username, role)) {
            String raw = request != null ? request.getParameter("coachId") : null;
            if (raw == null || raw.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "코치를 선택해 주세요.");
            }
            Long coachId;
            try {
                coachId = Long.parseLong(raw.trim());
            } catch (NumberFormatException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "코치 ID가 올바르지 않습니다.");
            }
            return coachRepository.findById(coachId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "코치를 찾을 수 없습니다."));
        }
        if (!"COACH".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "코치 또는 관리자 계정만 사용할 수 있습니다.");
        }
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "인증이 필요합니다.");
        }
        return coachPortalService.requireLinkedCoach(user.getId());
    }

    private YearMonth parseMonth(Integer year, Integer month) {
        if (year == null || month == null) {
            return YearMonth.now();
        }
        return YearMonth.of(year, month);
    }

    private LocalDate parseDate(Object raw) {
        if (raw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "날짜가 필요합니다.");
        }
        return LocalDate.parse(String.valueOf(raw));
    }

    private CoachWorkRecord.DayType parseDayType(Object raw) {
        if (raw == null) {
            return CoachWorkRecord.DayType.OFF;
        }
        try {
            return CoachWorkRecord.DayType.valueOf(String.valueOf(raw).trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return CoachWorkRecord.DayType.OFF;
        }
    }

    private Integer parseReceivedAmount(Object raw) {
        if (raw == null) {
            return null;
        }
        String text = String.valueOf(raw).trim().replace(",", "");
        if (text.isEmpty() || "null".equalsIgnoreCase(text)) {
            return null;
        }
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "실제 수령 금액이 올바르지 않습니다.");
        }
    }
}
