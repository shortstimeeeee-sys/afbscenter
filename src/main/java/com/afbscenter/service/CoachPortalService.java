package com.afbscenter.service;

import com.afbscenter.dto.MemberResponseDTO;
import com.afbscenter.model.Attendance;
import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.CoachPaymentReceipt;
import com.afbscenter.model.CoachWorkRecord;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.MemberProductHistory;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachPaymentReceiptRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.CoachWorkRecordRepository;
import com.afbscenter.repository.MemberProductHistoryRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.util.LessonCategoryUtil;
import com.afbscenter.util.MemberProductCoachResolver;
import com.afbscenter.util.PaymentCoachResolver;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

@Service
public class CoachPortalService {

    private final CoachRepository coachRepository;
    private final CoachWorkRecordRepository workRecordRepository;
    private final MemberService memberService;
    private final OperationalCoachViewService operationalCoachViewService;
    private final AttendanceRepository attendanceRepository;
    private final MemberProductHistoryRepository historyRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentCoachResolver paymentCoachResolver;
    private final CoachPaymentReceiptRepository receiptRepository;

    public CoachPortalService(CoachRepository coachRepository,
                              CoachWorkRecordRepository workRecordRepository,
                              MemberService memberService,
                              OperationalCoachViewService operationalCoachViewService,
                              AttendanceRepository attendanceRepository,
                              MemberProductHistoryRepository historyRepository,
                              BookingRepository bookingRepository,
                              PaymentRepository paymentRepository,
                              PaymentCoachResolver paymentCoachResolver,
                              CoachPaymentReceiptRepository receiptRepository) {
        this.coachRepository = coachRepository;
        this.workRecordRepository = workRecordRepository;
        this.memberService = memberService;
        this.operationalCoachViewService = operationalCoachViewService;
        this.attendanceRepository = attendanceRepository;
        this.historyRepository = historyRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.paymentCoachResolver = paymentCoachResolver;
        this.receiptRepository = receiptRepository;
    }

    public Coach requireLinkedCoach(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "코치 명단과 연동된 계정이 필요합니다.");
        }
        return coachRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "코치 명단과 연동된 계정이 필요합니다."));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getHomeSummary(Coach coach, YearMonth month) {
        LocalDate today = LocalDate.now();
        YearMonth ym = month != null ? month : YearMonth.from(today);
        Map<String, Object> out = new HashMap<>();
        out.put("coachId", coach.getId());
        out.put("coachName", coach.getName());
        out.put("today", today.toString());
        out.put("todayRecord", toWorkMap(workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), today).orElse(null)));
        out.put("month", workMonthPayload(coach, ym));
        LocalDateTime dayStart = today.atStartOfDay();
        LocalDateTime dayEnd = today.plusDays(1).atStartOfDay();
        List<Booking> todayBookings = bookingRepository.findByCoachIdAndStartTimeRange(coach.getId(), dayStart, dayEnd);
        long lessonCount = todayBookings.stream().filter(b -> b.getStatus() != Booking.BookingStatus.CANCELLED).count();
        out.put("todayLessonCount", lessonCount);
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getWorkMonth(Coach coach, YearMonth month) {
        return workMonthPayload(coach, month != null ? month : YearMonth.now());
    }

    private Map<String, Object> workMonthPayload(Coach coach, YearMonth month) {
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        List<CoachWorkRecord> records = workRecordRepository.findByCoachIdAndWorkDateBetweenOrderByWorkDateAsc(coach.getId(), start, end);
        Map<LocalDate, List<Map<String, Object>>> paymentsByDate = paymentsByDateForCoach(coach, month);
        int workDays = 0;
        int offDays = 0;
        int sickDays = 0;
        int outdoorDays = 0;
        int externalWorkDays = 0;
        long workedMinutes = 0;
        List<Map<String, Object>> days = new ArrayList<>();
        Set<LocalDate> seen = new HashSet<>();
        for (CoachWorkRecord r : records) {
            if (r.getDayType() == CoachWorkRecord.DayType.OFF) {
                offDays++;
            } else if (r.getDayType() == CoachWorkRecord.DayType.SICK) {
                sickDays++;
            } else if (r.getDayType() == CoachWorkRecord.DayType.OUTDOOR) {
                outdoorDays++;
            } else if (r.getDayType() == CoachWorkRecord.DayType.EXTERNAL_WORK) {
                externalWorkDays++;
            } else if (r.getCheckInTime() != null) {
                workDays++;
                if (r.getCheckOutTime() != null) {
                    workedMinutes += Math.max(0, Duration.between(r.getCheckInTime(), r.getCheckOutTime()).toMinutes());
                }
            }
            Map<String, Object> row = toWorkMap(r);
            List<Map<String, Object>> dayPays = paymentsByDate.getOrDefault(r.getWorkDate(), List.of());
            row.put("payments", dayPays);
            row.put("revenue", sumPaymentNets(dayPays));
            days.add(row);
            seen.add(r.getWorkDate());
        }
        for (Map.Entry<LocalDate, List<Map<String, Object>>> entry : paymentsByDate.entrySet()) {
            if (seen.contains(entry.getKey())) {
                continue;
            }
            int revenue = sumPaymentNets(entry.getValue());
            if (revenue == 0) {
                continue;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("date", entry.getKey());
            row.put("revenue", revenue);
            row.put("payments", entry.getValue());
            days.add(row);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("year", month.getYear());
        out.put("month", month.getMonthValue());
        out.put("workDays", workDays);
        out.put("offDays", offDays);
        out.put("sickDays", sickDays);
        out.put("outdoorDays", outdoorDays);
        out.put("workedMinutes", workedMinutes);
        out.put("days", days);
        return out;
    }

    private Map<LocalDate, List<Map<String, Object>>> paymentsByDateForCoach(Coach coach, YearMonth month) {
        Map<LocalDate, List<Map<String, Object>>> byDate = new HashMap<>();
        if (coach == null || coach.getId() == null || month == null) {
            return byDate;
        }
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
        List<Payment> payments = paymentRepository.findByPaidAtBetweenWithCoach(start, end.minusNanos(1));
        Map<Long, Coach> coachByPayment = paymentCoachResolver.resolveCoachesForPayments(payments);
        for (Payment p : payments) {
            Coach resolved = coachByPayment.get(p.getId());
            if (resolved == null || resolved.getId() == null || !resolved.getId().equals(coach.getId())) {
                continue;
            }
            boolean completed = p.getStatus() == null || p.getStatus() == Payment.PaymentStatus.COMPLETED;
            if (!completed || p.getPaidAt() == null) {
                continue;
            }
            LocalDate date = p.getPaidAt().toLocalDate();
            byDate.computeIfAbsent(date, k -> new ArrayList<>()).add(toPaymentDetail(p));
        }
        return byDate;
    }

    private static int sumPaymentNets(List<Map<String, Object>> payments) {
        if (payments == null || payments.isEmpty()) {
            return 0;
        }
        int sum = 0;
        for (Map<String, Object> row : payments) {
            Object raw = row.get("netAmount");
            if (raw instanceof Number) {
                sum += ((Number) raw).intValue();
            }
        }
        return sum;
    }

    private Map<String, Object> toPaymentDetail(Payment p) {
        int net = (p.getAmount() != null ? p.getAmount() : 0) - (p.getRefundAmount() != null ? p.getRefundAmount() : 0);
        Map<String, Object> row = new HashMap<>();
        row.put("id", p.getId());
        row.put("paidAt", p.getPaidAt());
        row.put("amount", p.getAmount());
        row.put("refundAmount", p.getRefundAmount());
        row.put("netAmount", net);
        row.put("method", p.getPaymentMethod() != null ? p.getPaymentMethod().name() : null);
        row.put("category", p.getCategory() != null ? p.getCategory().name() : null);
        row.put("memberName", p.getMember() != null ? p.getMember().getName() : null);
        if (p.getProduct() != null) {
            row.put("productName", p.getProduct().getName());
        }
        row.put("source", paymentAttributionSource(p));
        try {
            if (p.getBooking() != null) {
                row.put("bookingStart", p.getBooking().getStartTime());
                if (p.getBooking().getFacility() != null) {
                    row.put("facilityName", p.getBooking().getFacility().getName());
                }
            }
        } catch (Exception ignored) {
        }
        return row;
    }

    private String paymentAttributionSource(Payment p) {
        try {
            if (p.getBooking() != null && p.getBooking().getCoach() != null) {
                return "예약 담당 코치";
            }
        } catch (Exception ignored) {
        }
        try {
            if (p.getMember() != null && p.getMember().getCoach() != null) {
                return "회원 담당 코치";
            }
        } catch (Exception ignored) {
        }
        return "이용권·상품 담당 코치";
    }

    @Transactional
    public Map<String, Object> clockIn(Coach coach) {
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        CoachWorkRecord record = workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), today)
                .orElseGet(() -> {
                    CoachWorkRecord created = new CoachWorkRecord();
                    created.setCoach(coach);
                    created.setWorkDate(today);
                    created.setDayType(CoachWorkRecord.DayType.WORK);
                    return created;
                });
        if (record.getCheckInTime() != null) {
            return toWorkMap(record);
        }
        record.setDayType(CoachWorkRecord.DayType.WORK);
        record.setCheckInTime(now);
        return toWorkMap(workRecordRepository.save(record));
    }

    @Transactional
    public Map<String, Object> clockOut(Coach coach) {
        LocalDate today = LocalDate.now();
        CoachWorkRecord record = workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), today)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "오늘 출근 기록이 없습니다. 먼저 출근 체크를 해 주세요."));
        if (record.getCheckInTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "오늘 출근 기록이 없습니다. 먼저 출근 체크를 해 주세요.");
        }
        if (record.getCheckOutTime() == null) {
            record.setCheckOutTime(LocalDateTime.now());
            workRecordRepository.save(record);
        }
        return toWorkMap(record);
    }

    @Transactional
    public Map<String, Object> upsertDay(Coach coach, LocalDate date, CoachWorkRecord.DayType dayType, String memo) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "날짜가 필요합니다.");
        }
        CoachWorkRecord record = workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), date)
                .orElseGet(() -> {
                    CoachWorkRecord created = new CoachWorkRecord();
                    created.setCoach(coach);
                    created.setWorkDate(date);
                    return created;
                });
        CoachWorkRecord.DayType type = dayType != null ? dayType : CoachWorkRecord.DayType.OFF;
        if (isNonWorkDay(type) && blocksOffConversion(record, date)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 출근한 날은 휴무로 바꿀 수 없습니다.");
        }
        record.setDayType(type);
        if (type != CoachWorkRecord.DayType.WORK) {
            record.setCheckInTime(null);
            record.setCheckOutTime(null);
        }
        if (memo != null) {
            record.setMemo(memo.isBlank() ? null : memo.trim());
        }
        return toWorkMap(workRecordRepository.save(record));
    }

    @Transactional
    public void clearDay(Coach coach, LocalDate date) {
        workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), date).ifPresent(record -> {
            if (record.getCheckInTime() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "출근 기록이 있는 날은 삭제할 수 없습니다.");
            }
            workRecordRepository.delete(record);
        });
    }

    /**
     * 운영 관리용 월간 출근 명부. 코치 전용 출근부에 입력된 기록을 그대로 모은다.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getWorkRoster(YearMonth month) {
        YearMonth ym = month != null ? month : YearMonth.now();
        LocalDate today = LocalDate.now();
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        List<Coach> coaches = new ArrayList<>(coachRepository.findByActiveTrue());
        coaches.sort(Comparator
                .comparingInt(CoachPortalService::staffSortOrder)
                .thenComparing(c -> c.getName() == null ? "" : c.getName(), String.CASE_INSENSITIVE_ORDER));

        Map<Long, List<CoachWorkRecord>> byCoach = new HashMap<>();
        for (CoachWorkRecord r : workRecordRepository.findByWorkDateBetweenWithCoach(start, end)) {
            if (r.getCoach() == null || r.getCoach().getId() == null) {
                continue;
            }
            byCoach.computeIfAbsent(r.getCoach().getId(), k -> new ArrayList<>()).add(r);
        }
        Map<Long, CoachWorkRecord> todayByCoach = new HashMap<>();
        if (!today.isBefore(start) && !today.isAfter(end)) {
            for (Map.Entry<Long, List<CoachWorkRecord>> e : byCoach.entrySet()) {
                for (CoachWorkRecord r : e.getValue()) {
                    if (today.equals(r.getWorkDate())) {
                        todayByCoach.put(e.getKey(), r);
                        break;
                    }
                }
            }
        } else {
            for (CoachWorkRecord r : workRecordRepository.findByWorkDateBetweenWithCoach(today, today)) {
                if (r.getCoach() != null && r.getCoach().getId() != null) {
                    todayByCoach.put(r.getCoach().getId(), r);
                }
            }
        }

        int workingNow = 0;
        int clockedOut = 0;
        int offToday = 0;
        int notIn = 0;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Coach coach : coaches) {
            List<CoachWorkRecord> records = byCoach.getOrDefault(coach.getId(), List.of());
            Map<String, Object> monthPayload = workMonthFromRecords(records);
            CoachWorkRecord todayEntity = todayByCoach.get(coach.getId());
            Map<String, Object> todayRec = todayEntity != null ? toWorkMap(todayEntity) : null;
            String todayStatus = todayStatus(todayRec);
            if ("근무 중".equals(todayStatus)) {
                workingNow++;
            } else if ("퇴근".equals(todayStatus)) {
                clockedOut++;
            } else if ("휴무".equals(todayStatus) || "병가".equals(todayStatus) || "야외레슨".equals(todayStatus)) {
                offToday++;
            } else {
                notIn++;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("coachId", coach.getId());
            row.put("coachName", coach.getName());
            row.put("color", coach.getColor());
            row.put("specialties", coach.getSpecialties());
            row.put("todayStatus", todayStatus);
            row.put("todayRecord", todayRec);
            row.put("workDays", monthPayload.get("workDays"));
            row.put("offDays", monthPayload.get("offDays"));
            row.put("sickDays", monthPayload.get("sickDays"));
            row.put("outdoorDays", monthPayload.get("outdoorDays"));
            row.put("workedMinutes", monthPayload.get("workedMinutes"));
            row.put("days", monthPayload.get("days"));
            rows.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("year", ym.getYear());
        out.put("month", ym.getMonthValue());
        out.put("today", today.toString());
        out.put("workingNow", workingNow);
        out.put("clockedOut", clockedOut);
        out.put("offToday", offToday);
        out.put("notIn", notIn);
        out.put("staffCount", rows.size());
        out.put("staff", rows);
        return out;
    }

    @Transactional
    public Map<String, Object> saveRosterDay(Coach coach, LocalDate date, CoachWorkRecord.DayType dayType,
                                             String memo, LocalDateTime checkInTime, boolean updateCheckIn,
                                             LocalDateTime checkOutTime, boolean updateCheckOut) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "날짜가 필요합니다.");
        }
        CoachWorkRecord record = workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), date)
                .orElseGet(() -> {
                    CoachWorkRecord created = new CoachWorkRecord();
                    created.setCoach(coach);
                    created.setWorkDate(date);
                    return created;
                });
        CoachWorkRecord.DayType type = dayType != null ? dayType : CoachWorkRecord.DayType.WORK;
        if (isNonWorkDay(type) && blocksOffConversion(record, date)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 출근한 날은 휴무로 바꿀 수 없습니다.");
        }
        record.setDayType(type);
        if (isNonWorkDay(type)) {
            record.setCheckInTime(null);
            record.setCheckOutTime(null);
        } else {
            if (updateCheckIn) {
                record.setCheckInTime(checkInTime);
            }
            if (updateCheckOut) {
                record.setCheckOutTime(checkOutTime);
            }
            if (record.getCheckOutTime() != null && record.getCheckInTime() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "퇴근만 넣을 수 없습니다. 출근 시각을 먼저 넣어 주세요.");
            }
            if (record.getCheckInTime() != null && record.getCheckOutTime() != null
                    && record.getCheckOutTime().isBefore(record.getCheckInTime())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "퇴근 시각이 출근보다 빠릅니다.");
            }
        }
        if (memo != null) {
            record.setMemo(memo.isBlank() ? null : memo.trim());
        }
        return toWorkMap(workRecordRepository.save(record));
    }

    /**
     * 운영 출근부에서 하루를 전원 휴무로 지정한다. 병가·이미 출근한 사람은 건너뛴다.
     * group=main 은 손희진을 제외하고, group=separate 는 손희진 출근부만 바꾼다.
     */
    @Transactional
    public Map<String, Object> setRosterAllOff(LocalDate date) {
        return setRosterAllOff(date, "main");
    }

    @Transactional
    public Map<String, Object> setRosterAllOff(LocalDate date, String group) {
        return setRosterDayMark(date, group, CoachWorkRecord.DayType.OFF);
    }

    @Transactional
    public Map<String, Object> setRosterDayMark(LocalDate date, String group, CoachWorkRecord.DayType dayType) {
        CoachWorkRecord.DayType type = dayType == CoachWorkRecord.DayType.OUTDOOR
                ? CoachWorkRecord.DayType.OUTDOOR
                : CoachWorkRecord.DayType.OFF;
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "날짜가 필요합니다.");
        }
        int updated = 0;
        int alreadyOff = 0;
        int skipped = 0;
        List<String> skippedNames = new ArrayList<>();
        String defaultMemo = type == CoachWorkRecord.DayType.OUTDOOR ? "야외레슨" : "전체 휴무";
        for (Coach coach : coachesForAllOffGroup(group)) {
            CoachWorkRecord existing = workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), date).orElse(null);
            if (existing != null && existing.getDayType() == type) {
                alreadyOff++;
                continue;
            }
            if (existing != null && existing.getDayType() == CoachWorkRecord.DayType.SICK) {
                skipped++;
                skippedNames.add(plainCoachName(coach) + "(병가)");
                continue;
            }
            if (blocksOffConversion(existing, date)) {
                skipped++;
                skippedNames.add(plainCoachName(coach) + "(출근)");
                continue;
            }
            saveRosterDay(coach, date, type, defaultMemo, null, true, null, true);
            updated++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", date.toString());
        out.put("mark", type.name());
        out.put("updated", updated);
        out.put("alreadyOff", alreadyOff);
        out.put("skipped", skipped);
        out.put("skippedNames", skippedNames);
        return out;
    }

    /**
     * 전원 휴무를 해제한다. 병가·출근 기록은 지우지 않는다.
     */
    @Transactional
    public Map<String, Object> clearRosterAllOff(LocalDate date) {
        return clearRosterAllOff(date, "main");
    }

    @Transactional
    public Map<String, Object> clearRosterAllOff(LocalDate date, String group) {
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "날짜가 필요합니다.");
        }
        int cleared = 0;
        int skipped = 0;
        List<String> skippedNames = new ArrayList<>();
        for (Coach coach : coachesForAllOffGroup(group)) {
            CoachWorkRecord existing = workRecordRepository.findByCoachIdAndWorkDate(coach.getId(), date).orElse(null);
            if (existing == null || !isClearableDayMark(existing.getDayType())) {
                continue;
            }
            if (existing.getCheckInTime() != null) {
                skipped++;
                skippedNames.add(plainCoachName(coach));
                continue;
            }
            workRecordRepository.delete(existing);
            cleared++;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", date.toString());
        out.put("cleared", cleared);
        out.put("skipped", skipped);
        out.put("skippedNames", skippedNames);
        return out;
    }

    private List<Coach> coachesForAllOffGroup(String group) {
        boolean separateOnly = "separate".equalsIgnoreCase(group == null ? "" : group.trim());
        List<Coach> out = new ArrayList<>();
        for (Coach coach : coachRepository.findByActiveTrue()) {
            boolean separate = isSeparateRosterCoach(coach);
            if (separateOnly == separate) {
                out.add(coach);
            }
        }
        return out;
    }

    static boolean isSeparateRosterCoach(Coach coach) {
        return "손희진".equals(plainCoachName(coach));
    }

    private static boolean isNonWorkDay(CoachWorkRecord.DayType type) {
        return type == CoachWorkRecord.DayType.OFF
                || type == CoachWorkRecord.DayType.SICK
                || type == CoachWorkRecord.DayType.OUTDOOR
                || type == CoachWorkRecord.DayType.EXTERNAL_WORK;
    }

    private static boolean isClearableDayMark(CoachWorkRecord.DayType type) {
        return type == CoachWorkRecord.DayType.OFF
                || type == CoachWorkRecord.DayType.OUTDOOR;
    }

    private static boolean blocksOffConversion(CoachWorkRecord record, LocalDate date) {
        return record != null && record.getCheckInTime() != null && !date.isAfter(LocalDate.now());
    }

    private static String plainCoachName(Coach coach) {
        String name = coach != null && coach.getName() != null ? coach.getName() : "";
        return name.replaceAll("\\s*\\[.*?\\]\\s*", " ").trim();
    }

    static int staffSortOrder(Coach coach) {
        String name = ((coach.getName() == null ? "" : coach.getName()) + " "
                + (coach.getSpecialties() == null ? "" : coach.getSpecialties()));
        if (name.contains("대표")) return 0;
        if (name.contains("이사")) return 1;
        if (name.contains("센터장")) return 2;
        if (name.contains("지점장")) return 3;
        if (name.contains("투수")) return 4;
        if (name.contains("유소년")) return 5;
        if (name.contains("재활")) return 6;
        if (name.contains("트레이너") || name.contains("트레이닝")) return 7;
        if (name.contains("강사") || name.contains("필라테스")) return 8;
        return 9;
    }

    private Map<String, Object> workMonthFromRecords(List<CoachWorkRecord> records) {
        int workDays = 0;
        int offDays = 0;
        int sickDays = 0;
        int outdoorDays = 0;
        int externalWorkDays = 0;
        long workedMinutes = 0;
        List<Map<String, Object>> days = new ArrayList<>();
        if (records != null) {
            for (CoachWorkRecord r : records) {
                if (r.getDayType() == CoachWorkRecord.DayType.OFF) {
                    offDays++;
                } else if (r.getDayType() == CoachWorkRecord.DayType.SICK) {
                    sickDays++;
                } else if (r.getDayType() == CoachWorkRecord.DayType.OUTDOOR) {
                    outdoorDays++;
                } else if (r.getDayType() == CoachWorkRecord.DayType.EXTERNAL_WORK) {
                    externalWorkDays++;
                } else if (r.getCheckInTime() != null) {
                    workDays++;
                    if (r.getCheckOutTime() != null) {
                        workedMinutes += Math.max(0, Duration.between(r.getCheckInTime(), r.getCheckOutTime()).toMinutes());
                    }
                }
                days.add(toWorkMap(r));
            }
        }
        Map<String, Object> out = new HashMap<>();
        out.put("workDays", workDays);
        out.put("offDays", offDays);
        out.put("sickDays", sickDays);
        out.put("outdoorDays", outdoorDays);
        out.put("externalWorkDays", externalWorkDays);
        out.put("workedMinutes", workedMinutes);
        out.put("days", days);
        return out;
    }

    private static String todayStatus(Map<String, Object> todayRec) {
        if (todayRec == null) {
            return "미출근";
        }
        Object type = todayRec.get("dayType");
        if ("OFF".equals(type)) {
            return "휴무";
        }
        if ("SICK".equals(type)) {
            return "병가";
        }
        if ("OUTDOOR".equals(type)) {
            return "야외레슨";
        }
        if ("EXTERNAL_WORK".equals(type)) {
            return "외부업무";
        }
        if (todayRec.get("checkOutTime") != null) {
            return "퇴근";
        }
        if (todayRec.get("checkInTime") != null) {
            return "근무 중";
        }
        return "미출근";
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMembers(Coach coach) {
        Set<Long> allowedIds = new HashSet<>(
                operationalCoachViewService.findMemberIdsMatchingViewCoachIds(List.of(coach.getId())));
        allowedIds.addAll(bookingRepository.findMemberIdsTaughtByCoach(coach.getId()));
        Map<Long, Set<Long>> taughtPassIdsByMember = new HashMap<>();
        Map<Long, Map<Long, List<String>>> taughtDatesByMemberPass = new HashMap<>();
        Map<Long, List<String>> taughtDatesWithoutPassByMember = new HashMap<>();
        Map<Long, Map<String, Object>> taughtPassInfo = new HashMap<>();
        for (Booking b : bookingRepository.findTaughtBookingsByCoach(coach.getId())) {
            if (b.getMember() == null || b.getMember().getId() == null || b.getStartTime() == null) {
                continue;
            }
            Long mid = b.getMember().getId();
            String ds = b.getStartTime().toLocalDate().toString();
            Long pid = b.getMemberProduct() != null ? b.getMemberProduct().getId() : null;
            if (pid != null) {
                taughtPassIdsByMember.computeIfAbsent(mid, k -> new HashSet<>()).add(pid);
                taughtDatesByMemberPass
                        .computeIfAbsent(mid, k -> new HashMap<>())
                        .computeIfAbsent(pid, k -> new ArrayList<>())
                        .add(ds);
                taughtPassInfo.putIfAbsent(pid, passStubFromMemberProduct(b.getMemberProduct(), b));
            } else {
                taughtDatesWithoutPassByMember.computeIfAbsent(mid, k -> new ArrayList<>()).add(ds);
            }
        }
        List<MemberResponseDTO> dtos = memberService.getAllMembersWithFilters(
                null, null, "ACTIVE", null, null, null, false, null);
        List<Map<String, Object>> out = new ArrayList<>();
        for (MemberResponseDTO dto : dtos) {
            Map<String, Object> full = dto.toMap();
            Long memberId = toLong(full.get("id"));
            if (memberId == null || !allowedIds.contains(memberId)) {
                continue;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("id", full.get("id"));
            row.put("memberNumber", full.get("memberNumber"));
            row.put("name", full.get("name"));
            row.put("phoneNumber", full.get("phoneNumber"));
            row.put("grade", full.get("grade"));
            row.put("school", full.get("school"));
            row.put("joinDate", full.get("joinDate"));
            row.put("createdAt", full.get("createdAt"));
            row.put("lastVisitDate", full.get("lastVisitDate"));
            row.put("latestLessonDate", full.get("latestLessonDate"));
            row.put("remainingCount", full.get("remainingCount"));
            row.put("coachNames", full.get("coachNames"));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> products = (List<Map<String, Object>>) full.get("memberProducts");
            Set<Long> taughtPassIds = taughtPassIdsByMember.getOrDefault(memberId, Set.of());
            Map<Long, List<String>> taughtDates = taughtDatesByMemberPass.getOrDefault(memberId, Map.of());
            List<Map<String, Object>> passes = new ArrayList<>();
            if (products != null) {
                for (Map<String, Object> mp : products) {
                    if (mp == null) {
                        continue;
                    }
                    Object status = mp.get("status");
                    String st = status != null ? String.valueOf(status) : "ACTIVE";
                    if (!"ACTIVE".equals(st) && !"EXPIRED".equals(st) && !"USED_UP".equals(st)) {
                        continue;
                    }
                    Long pid = toLong(mp.get("id"));
                    boolean assigned = assignedToCoach(mp, coach);
                    boolean taught = pid != null && taughtPassIds.contains(pid);
                    if (!assigned && !taught) {
                        continue;
                    }
                    Map<String, Object> pass = new HashMap<>();
                    pass.put("id", mp.get("id"));
                    pass.put("status", st);
                    pass.put("remainingCount", mp.get("remainingCount"));
                    pass.put("totalCount", mp.get("totalCount"));
                    pass.put("expiryDate", mp.get("expiryDate"));
                    pass.put("purchaseDate", mp.get("purchaseDate") != null ? mp.get("purchaseDate") : mp.get("createdAt"));
                    @SuppressWarnings("unchecked")
                    Map<String, Object> product = (Map<String, Object>) mp.get("product");
                    pass.put("productName", product != null ? product.get("name") : null);
                    pass.put("productType", product != null ? product.get("type") : null);
                    pass.put("assignedToViewer", assigned);
                    pass.put("taughtDates", uniqueDates(taughtDates.get(pid)));
                    passes.add(pass);
                }
            }
            Set<Long> listedPassIds = new HashSet<>();
            for (Map<String, Object> pass : passes) {
                Long listedId = toLong(pass.get("id"));
                if (listedId != null) {
                    listedPassIds.add(listedId);
                }
            }
            for (Long pid : taughtPassIds) {
                if (listedPassIds.contains(pid)) {
                    continue;
                }
                Map<String, Object> stub = taughtPassInfo.get(pid);
                if (stub == null) {
                    stub = new HashMap<>();
                    stub.put("id", pid);
                    stub.put("productName", "예약 수업");
                } else {
                    stub = new HashMap<>(stub);
                }
                stub.put("assignedToViewer", false);
                stub.put("taughtDates", uniqueDates(taughtDates.get(pid)));
                passes.add(stub);
                listedPassIds.add(pid);
            }
            List<String> orphanDates = uniqueDates(taughtDatesWithoutPassByMember.get(memberId));
            if (!orphanDates.isEmpty()) {
                Map<String, Object> stub = new HashMap<>();
                stub.put("productName", "예약 수업");
                stub.put("status", "ACTIVE");
                stub.put("assignedToViewer", false);
                stub.put("taughtDates", orphanDates);
                passes.add(stub);
            }
            row.put("activePasses", passes);
            if (passes.isEmpty()) {
                continue;
            }
            out.add(row);
        }
        attachUsageDates(out);
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getMemberVisits(Coach coach, Long memberId) {
        if (!operationalCoachViewService.coachCanAccessMember(coach.getId(), memberId)
                && !bookingRepository.existsTaughtByCoach(coach.getId(), memberId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "담당 회원이 아닙니다.");
        }
        Member member = memberService.getMemberById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        Map<String, Object> payload = new HashMap<>();
        payload.put("joinDate", member.getJoinDate());
        payload.put("createdAt", member.getCreatedAt());
        payload.put("name", member.getName());

        List<MemberProductHistory> histories = historyRepository
                .findByMemberIdWithProductAndBookingOrderByTransactionDateDesc(memberId);
        List<MemberProductHistory> deducts = new ArrayList<>();
        for (MemberProductHistory h : histories) {
            if (h != null && h.getType() == MemberProductHistory.TransactionType.DEDUCT) {
                deducts.add(h);
            }
        }
        deducts.sort(Comparator
                .comparing(this::usageDateOf, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(MemberProductHistory::getId, Comparator.nullsLast(Comparator.naturalOrder())));
        Map<Long, Integer> sessionByProduct = new HashMap<>();
        List<Map<String, Object>> usages = new ArrayList<>();
        for (MemberProductHistory h : deducts) {
            if (!usageVisibleForCoach(h, coach)) {
                continue;
            }
            Long pid = h.getMemberProduct() != null ? h.getMemberProduct().getId() : null;
            int session = pid != null ? sessionByProduct.merge(pid, 1, Integer::sum) : usages.size() + 1;
            usages.add(toUsageMap(h, session));
        }
        Set<String> usageKeys = new HashSet<>();
        for (Map<String, Object> u : usages) {
            usageKeys.add(String.valueOf(u.get("date")) + "|" + String.valueOf(u.get("memberProductId")));
        }
        for (Booking b : bookingRepository.findTaughtBookingsByCoachAndMember(coach.getId(), memberId)) {
            if (b.getStartTime() == null) {
                continue;
            }
            Long pid = b.getMemberProduct() != null ? b.getMemberProduct().getId() : null;
            String key = b.getStartTime().toLocalDate() + "|" + pid;
            if (usageKeys.contains(key)) {
                continue;
            }
            usageKeys.add(key);
            Map<String, Object> row = new HashMap<>();
            row.put("date", b.getStartTime().toLocalDate());
            row.put("startTime", b.getStartTime());
            row.put("sessionNumber", null);
            if (b.getMemberProduct() != null) {
                row.put("memberProductId", b.getMemberProduct().getId());
                if (b.getMemberProduct().getProduct() != null) {
                    row.put("productName", b.getMemberProduct().getProduct().getName());
                }
            } else {
                row.put("productName", lessonLabel(b));
            }
            usages.add(row);
        }
        usages.sort((a, b) -> String.valueOf(a.get("date")).compareTo(String.valueOf(b.get("date"))));
        payload.put("usages", usages);

        List<Attendance> attendances = attendanceRepository.findByMemberId(memberId);
        attendances.sort(Comparator.comparing(Attendance::getDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Attendance::getCheckInTime, Comparator.nullsLast(Comparator.reverseOrder())));
        List<Map<String, Object>> out = new ArrayList<>();
        int limit = Math.min(attendances.size(), 80);
        for (int i = 0; i < limit; i++) {
            Attendance a = attendances.get(i);
            Map<String, Object> row = new HashMap<>();
            row.put("id", a.getId());
            row.put("date", a.getDate());
            row.put("checkInTime", a.getCheckInTime());
            row.put("checkOutTime", a.getCheckOutTime());
            row.put("status", a.getStatus() != null ? a.getStatus().name() : null);
            if (a.getFacility() != null) {
                row.put("facilityName", a.getFacility().getName());
            }
            if (a.getBooking() != null) {
                row.put("startTime", a.getBooking().getStartTime());
                row.put("endTime", a.getBooking().getEndTime());
                if (a.getBooking().getCoach() != null) {
                    row.put("bookingCoachName", a.getBooking().getCoach().getName());
                }
            }
            Optional<MemberProductHistory> hist = Optional.empty();
            try {
                hist = historyRepository.findDeductByAttendanceId(a.getId());
            } catch (Exception ignored) {
                hist = Optional.empty();
            }
            if (hist.isEmpty()) {
                List<MemberProductHistory> all = historyRepository.findAllByAttendanceId(a.getId());
                hist = all.stream().filter(h -> h.getType() == MemberProductHistory.TransactionType.DEDUCT).findFirst();
            }
            if (hist.isPresent()) {
                MemberProductHistory h = hist.get();
                Integer after = h.getRemainingCountAfter();
                Integer change = h.getChangeAmount();
                Integer before = (after != null && change != null) ? after - change : null;
                row.put("remainingBefore", before);
                row.put("remainingAfter", after);
                row.put("changeAmount", change);
                if (h.getMemberProduct() != null && h.getMemberProduct().getProduct() != null) {
                    row.put("productName", h.getMemberProduct().getProduct().getName());
                }
            }
            out.add(row);
        }
        payload.put("visits", out);
        return payload;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSettlement(Coach coach, YearMonth month) {
        YearMonth ym = month != null ? month : YearMonth.now();
        LocalDateTime start = ym.atDay(1).atStartOfDay();
        LocalDateTime end = ym.plusMonths(1).atDay(1).atStartOfDay();
        List<Booking> bookings = bookingRepository.findByCoachIdAndStartTimeRange(coach.getId(), start, end);
        int bookingCount = 0;
        int completedCount = 0;
        int cancelledCount = 0;
        long lessonMinutes = 0;
        List<Map<String, Object>> bookingRows = new ArrayList<>();
        for (Booking b : bookings) {
            Booking.BookingStatus st = b.getStatus();
            if (st == Booking.BookingStatus.CANCELLED) {
                cancelledCount++;
            } else {
                bookingCount++;
                if (st == Booking.BookingStatus.COMPLETED) {
                    completedCount++;
                }
                if (b.getStartTime() != null && b.getEndTime() != null) {
                    lessonMinutes += Math.max(0, Duration.between(b.getStartTime(), b.getEndTime()).toMinutes());
                }
            }
            Map<String, Object> row = new HashMap<>();
            row.put("id", b.getId());
            row.put("startTime", b.getStartTime());
            row.put("endTime", b.getEndTime());
            row.put("status", st != null ? st.name() : null);
            row.put("memberName", b.getMember() != null ? b.getMember().getName() : b.getNonMemberName());
            row.put("facilityName", b.getFacility() != null ? b.getFacility().getName() : null);
            bookingRows.add(row);
        }

        List<Payment> payments = paymentRepository.findByPaidAtBetweenWithCoach(start, end.minusNanos(1));
        Map<Long, Coach> coachByPayment = paymentCoachResolver.resolveCoachesForPayments(payments);
        int revenue = 0;
        int paymentCount = 0;
        int refundedCount = 0;
        int netProfit = 0;
        int receivedCount = 0;
        List<Long> coachPaymentIds = new ArrayList<>();
        for (Payment p : payments) {
            Coach resolved = coachByPayment.get(p.getId());
            if (resolved == null || resolved.getId() == null || !resolved.getId().equals(coach.getId()) || p.getId() == null) {
                continue;
            }
            coachPaymentIds.add(p.getId());
        }
        Map<Long, Integer> receivedByPayment = new HashMap<>();
        if (!coachPaymentIds.isEmpty()) {
            for (CoachPaymentReceipt rec : receiptRepository.findByCoachIdAndPaymentIdIn(coach.getId(), coachPaymentIds)) {
                if (rec.getPaymentId() != null && rec.getReceivedAmount() != null) {
                    receivedByPayment.put(rec.getPaymentId(), rec.getReceivedAmount());
                }
            }
        }
        List<Map<String, Object>> paymentRows = new ArrayList<>();
        for (Payment p : payments) {
            Coach resolved = coachByPayment.get(p.getId());
            if (resolved == null || resolved.getId() == null || !resolved.getId().equals(coach.getId())) {
                continue;
            }
            int net = (p.getAmount() != null ? p.getAmount() : 0) - (p.getRefundAmount() != null ? p.getRefundAmount() : 0);
            boolean completed = p.getStatus() == null || p.getStatus() == Payment.PaymentStatus.COMPLETED;
            if (p.getStatus() == Payment.PaymentStatus.REFUNDED) {
                refundedCount++;
            } else if (completed) {
                revenue += net;
                paymentCount++;
            }
            Map<String, Object> row = new HashMap<>();
            row.put("id", p.getId());
            row.put("paidAt", p.getPaidAt());
            row.put("amount", p.getAmount());
            row.put("refundAmount", p.getRefundAmount());
            row.put("netAmount", net);
            row.put("status", p.getStatus() != null ? p.getStatus().name() : null);
            row.put("method", p.getPaymentMethod() != null ? p.getPaymentMethod().name() : null);
            row.put("category", p.getCategory() != null ? p.getCategory().name() : null);
            row.put("memberName", p.getMember() != null ? p.getMember().getName() : null);
            if (p.getProduct() != null) {
                row.put("productName", p.getProduct().getName());
            }
            row.put("source", paymentAttributionSource(p));
            Integer received = p.getId() != null ? receivedByPayment.get(p.getId()) : null;
            row.put("receivedAmount", received);
            if (received != null) {
                netProfit += received;
                receivedCount++;
            }
            try {
                if (p.getBooking() != null) {
                    row.put("bookingStart", p.getBooking().getStartTime());
                    if (p.getBooking().getFacility() != null) {
                        row.put("facilityName", p.getBooking().getFacility().getName());
                    }
                }
            } catch (Exception ignored) {
            }
            paymentRows.add(row);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("year", ym.getYear());
        out.put("month", ym.getMonthValue());
        out.put("bookingCount", bookingCount);
        out.put("completedCount", completedCount);
        out.put("cancelledCount", cancelledCount);
        out.put("lessonMinutes", lessonMinutes);
        out.put("revenue", revenue);
        out.put("netProfit", netProfit);
        out.put("receivedCount", receivedCount);
        out.put("paymentCount", paymentCount);
        out.put("refundedCount", refundedCount);
        out.put("bookings", bookingRows);
        out.put("payments", paymentRows);
        return out;
    }

    @Transactional
    public Map<String, Object> savePaymentReceived(Coach coach, Long paymentId, Integer receivedAmount) {
        if (coach == null || coach.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "코치가 필요합니다.");
        }
        if (paymentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "결제 ID가 필요합니다.");
        }
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "결제를 찾을 수 없습니다."));
        Coach resolved = paymentCoachResolver.resolve(payment);
        if (resolved == null || resolved.getId() == null || !resolved.getId().equals(coach.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 코치로 연결된 결제가 아닙니다.");
        }
        if (receivedAmount != null && receivedAmount < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "실제 수령 금액은 0원 이상이어야 합니다.");
        }
        if (receivedAmount == null) {
            receiptRepository.deleteByCoachIdAndPaymentId(coach.getId(), paymentId);
        } else {
            CoachPaymentReceipt rec = receiptRepository.findByCoachIdAndPaymentId(coach.getId(), paymentId)
                    .orElseGet(CoachPaymentReceipt::new);
            rec.setCoachId(coach.getId());
            rec.setPaymentId(paymentId);
            rec.setReceivedAmount(receivedAmount);
            receiptRepository.save(rec);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("ok", true);
        out.put("paymentId", paymentId);
        out.put("receivedAmount", receivedAmount);
        return out;
    }

    private void attachUsageDates(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<Long> memberIds = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long id = toLong(row.get("id"));
            if (id != null) {
                memberIds.add(id);
            }
        }
        if (memberIds.isEmpty()) {
            return;
        }
        List<MemberProductHistory> deducts = historyRepository.findDeductsByMemberIdIn(memberIds);
        Map<Long, List<MemberProductHistory>> byMember = new HashMap<>();
        for (MemberProductHistory h : deducts) {
            if (h.getMember() == null || h.getMember().getId() == null) {
                continue;
            }
            byMember.computeIfAbsent(h.getMember().getId(), k -> new ArrayList<>()).add(h);
        }
        for (Map<String, Object> row : rows) {
            Long mid = toLong(row.get("id"));
            List<MemberProductHistory> hist = new ArrayList<>(byMember.getOrDefault(mid, List.of()));
            hist.sort(Comparator
                    .comparing(this::usageDateOf, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(MemberProductHistory::getId, Comparator.nullsLast(Comparator.naturalOrder())));
            Set<String> allDates = new LinkedHashSet<>();
            Map<Long, List<String>> datesByPass = new LinkedHashMap<>();
            for (MemberProductHistory h : hist) {
                LocalDate d = usageDateOf(h);
                if (d == null) {
                    continue;
                }
                if (h.getMemberProduct() == null || h.getMemberProduct().getId() == null) {
                    continue;
                }
                Long pid = h.getMemberProduct().getId();
                datesByPass.computeIfAbsent(pid, k -> new ArrayList<>()).add(d.toString());
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> passes = (List<Map<String, Object>>) row.get("activePasses");
            if (passes == null) {
                passes = new ArrayList<>();
                row.put("activePasses", passes);
            }
            for (Map<String, Object> pass : passes) {
                Long pid = toLong(pass.get("id"));
                @SuppressWarnings("unchecked")
                List<String> taught = (List<String>) pass.get("taughtDates");
                List<String> combined = new ArrayList<>();
                if (pid != null) {
                    List<String> fromDeduct = datesByPass.get(pid);
                    if (fromDeduct != null) {
                        combined.addAll(fromDeduct);
                    }
                }
                if (taught != null) {
                    combined.addAll(taught);
                }
                List<String> dates = uniqueDates(combined);
                pass.put("usageDates", dates);
                allDates.addAll(dates);
            }
            row.put("usageDates", new ArrayList<>(allDates));
        }
    }

    private boolean usageVisibleForCoach(MemberProductHistory h, Coach coach) {
        if (h == null || coach == null) {
            return false;
        }
        try {
            if (h.getAttendance() != null && h.getAttendance().getBooking() != null
                    && h.getAttendance().getBooking().getCoach() != null
                    && coach.getId() != null
                    && coach.getId().equals(h.getAttendance().getBooking().getCoach().getId())) {
                return true;
            }
        } catch (Exception ignored) {
        }
        return h.getMemberProduct() != null && memberProductVisibleForCoach(h.getMemberProduct(), coach);
    }

    private boolean assignedToCoach(Map<String, Object> mp, Coach coach) {
        if (mp == null || coach == null) {
            return false;
        }
        Object coachName = mp.get("coachName");
        if (coachName != null && coachNameKey(String.valueOf(coachName)).equals(coachNameKey(coach.getName()))) {
            return true;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> product = (Map<String, Object>) mp.get("product");
        if (product != null) {
            @SuppressWarnings("unchecked")
            Map<String, Object> productCoach = (Map<String, Object>) product.get("coach");
            if (productCoach != null && coach.getId() != null && coach.getId().equals(toLong(productCoach.get("id")))) {
                return true;
            }
        }
        return false;
    }

    private boolean memberProductVisibleForCoach(MemberProduct mp, Coach coach) {
        if (mp == null || coach == null) {
            return false;
        }
        String display = MemberProductCoachResolver.resolveDisplayCoachName(mp);
        if (display != null && coachNameKey(display).equals(coachNameKey(coach.getName()))) {
            return true;
        }
        try {
            if (mp.getProduct() != null && mp.getProduct().getCoach() != null
                    && coach.getId() != null && coach.getId().equals(mp.getProduct().getCoach().getId())) {
                return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private static String coachNameKey(String name) {
        if (name == null) {
            return "";
        }
        return name.replaceAll("\\s*\\[[^\\]]+\\]\\s*$", "").trim();
    }

    private Map<String, Object> passStubFromMemberProduct(MemberProduct mp, Booking booking) {
        Map<String, Object> pass = new HashMap<>();
        if (mp == null) {
            pass.put("productName", lessonLabel(booking));
            pass.put("status", "ACTIVE");
            return pass;
        }
        pass.put("id", mp.getId());
        pass.put("remainingCount", mp.getRemainingCount());
        pass.put("totalCount", mp.getTotalCount());
        pass.put("expiryDate", mp.getExpiryDate());
        pass.put("purchaseDate", mp.getPurchaseDate());
        if (mp.getStatus() != null) {
            pass.put("status", mp.getStatus().name());
        }
        if (mp.getProduct() != null) {
            pass.put("productName", mp.getProduct().getName());
            pass.put("productType", mp.getProduct().getType() != null ? mp.getProduct().getType().name() : null);
        } else {
            pass.put("productName", lessonLabel(booking));
        }
        return pass;
    }

    private static String lessonLabel(Booking b) {
        if (b == null) {
            return "예약 수업";
        }
        if (b.getLessonCategory() != null) {
            return LessonCategoryUtil.toKoreanText(b.getLessonCategory()) + " 수업";
        }
        if (b.getPurpose() == Booking.BookingPurpose.RENTAL) {
            return "대관";
        }
        return "예약 수업";
    }

    private static List<String> uniqueDates(List<String> dates) {
        if (dates == null || dates.isEmpty()) {
            return List.of();
        }
        Set<String> set = new TreeSet<>();
        for (String d : dates) {
            if (d != null && !d.isBlank()) {
                set.add(d.trim());
            }
        }
        return new ArrayList<>(set);
    }

    private Map<String, Object> toUsageMap(MemberProductHistory h, int sessionNumber) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", h.getId());
        row.put("date", usageDateOf(h));
        row.put("sessionNumber", sessionNumber);
        Integer after = h.getRemainingCountAfter();
        Integer change = h.getChangeAmount();
        Integer before = (after != null && change != null) ? after - change : null;
        row.put("remainingBefore", before);
        row.put("remainingAfter", after);
        row.put("changeAmount", change);
        if (h.getMemberProduct() != null && h.getMemberProduct().getProduct() != null) {
            row.put("productName", h.getMemberProduct().getProduct().getName());
            row.put("memberProductId", h.getMemberProduct().getId());
            row.put("totalCount", h.getMemberProduct().getTotalCount());
        }
        if (h.getAttendance() != null) {
            row.put("checkInTime", h.getAttendance().getCheckInTime());
            row.put("status", h.getAttendance().getStatus() != null ? h.getAttendance().getStatus().name() : null);
            if (h.getAttendance().getBooking() != null) {
                row.put("startTime", h.getAttendance().getBooking().getStartTime());
            }
        }
        return row;
    }

    private LocalDate usageDateOf(MemberProductHistory h) {
        if (h == null) {
            return null;
        }
        try {
            if (h.getAttendance() != null && h.getAttendance().getDate() != null) {
                return h.getAttendance().getDate();
            }
        } catch (Exception ignored) {
        }
        try {
            if (h.getAttendance() != null && h.getAttendance().getBooking() != null
                    && h.getAttendance().getBooking().getStartTime() != null) {
                return h.getAttendance().getBooking().getStartTime().toLocalDate();
            }
        } catch (Exception ignored) {
        }
        return h.getTransactionDate() != null ? h.getTransactionDate().toLocalDate() : null;
    }

    private static Long toLong(Object raw) {
        if (raw instanceof Number) {
            return ((Number) raw).longValue();
        }
        if (raw == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(raw));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Map<String, Object> toWorkMap(CoachWorkRecord record) {
        if (record == null) {
            return null;
        }
        Map<String, Object> map = new HashMap<>();
        map.put("id", record.getId());
        map.put("date", record.getWorkDate());
        map.put("checkInTime", record.getCheckInTime());
        map.put("checkOutTime", record.getCheckOutTime());
        map.put("dayType", record.getDayType() != null ? record.getDayType().name() : null);
        return map;
    }
}
