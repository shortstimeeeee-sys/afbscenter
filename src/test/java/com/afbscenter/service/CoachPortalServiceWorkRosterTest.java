package com.afbscenter.service;

import com.afbscenter.model.Coach;
import com.afbscenter.model.CoachWorkRecord;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachPaymentReceiptRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.CoachWorkRecordRepository;
import com.afbscenter.repository.MemberProductHistoryRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.util.PaymentCoachResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoachPortalServiceWorkRosterTest {

    @Mock CoachRepository coachRepository;
    @Mock CoachWorkRecordRepository workRecordRepository;
    @Mock MemberService memberService;
    @Mock OperationalCoachViewService operationalCoachViewService;
    @Mock AttendanceRepository attendanceRepository;
    @Mock MemberProductHistoryRepository historyRepository;
    @Mock BookingRepository bookingRepository;
    @Mock PaymentRepository paymentRepository;
    @Mock PaymentCoachResolver paymentCoachResolver;
    @Mock CoachPaymentReceiptRepository receiptRepository;

    @InjectMocks
    CoachPortalService service;

    @Test
    void getWorkRoster_aggregatesCoachHomeRecords() {
        Coach soyeon = coach(10L, "이소연 [강사]", "필라테스");
        Coach pitcher = coach(20L, "박근엽 [투수코치]", "야구");
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(soyeon, pitcher));
        LocalDate today = LocalDate.now();
        CoachWorkRecord rec = new CoachWorkRecord();
        rec.setCoach(soyeon);
        rec.setWorkDate(today);
        rec.setDayType(CoachWorkRecord.DayType.WORK);
        rec.setCheckInTime(today.atTime(9, 0));
        when(workRecordRepository.findByWorkDateBetweenWithCoach(any(), any())).thenReturn(List.of(rec));

        Map<String, Object> out = service.getWorkRoster(YearMonth.from(today));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> staff = (List<Map<String, Object>>) out.get("staff");
        assertEquals(2, staff.size());
        assertEquals(10L, staff.get(1).get("coachId"));
        assertEquals("근무 중", staff.get(1).get("todayStatus"));
        assertEquals("미출근", staff.get(0).get("todayStatus"));
        assertEquals(1, out.get("workingNow"));
        assertEquals(1, out.get("notIn"));
    }

    @Test
    void saveRosterDay_storesCheckInAndOutFromCoachHomeShape() {
        Coach coach = coach(10L, "이소연 [강사]", "필라테스");
        LocalDate date = LocalDate.of(2026, 9, 7);
        when(workRecordRepository.findByCoachIdAndWorkDate(10L, date)).thenReturn(Optional.empty());
        when(workRecordRepository.save(any(CoachWorkRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> saved = service.saveRosterDay(
                coach, date, CoachWorkRecord.DayType.WORK, "현장",
                date.atTime(10, 0), true, date.atTime(19, 0), true);

        assertEquals(CoachWorkRecord.DayType.WORK.name(), saved.get("dayType"));
        assertEquals(LocalDateTime.of(2026, 9, 7, 10, 0), saved.get("checkInTime"));
        assertEquals(LocalDateTime.of(2026, 9, 7, 19, 0), saved.get("checkOutTime"));
        assertEquals("현장", saved.get("memo"));
    }

    @Test
    void setRosterAllOff_marksActiveCoachesOffAndSkipsClockedIn() {
        Coach soyeon = coach(10L, "이소연 [강사]", "필라테스");
        Coach pitcher = coach(20L, "박근엽 [투수코치]", "야구");
        LocalDate today = LocalDate.now();
        CoachWorkRecord clocked = new CoachWorkRecord();
        clocked.setCoach(soyeon);
        clocked.setWorkDate(today);
        clocked.setDayType(CoachWorkRecord.DayType.WORK);
        clocked.setCheckInTime(today.atTime(9, 0));
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(soyeon, pitcher));
        when(workRecordRepository.findByCoachIdAndWorkDate(10L, today)).thenReturn(Optional.of(clocked));
        when(workRecordRepository.findByCoachIdAndWorkDate(20L, today)).thenReturn(Optional.empty());
        when(workRecordRepository.save(any(CoachWorkRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.setRosterAllOff(today);

        assertEquals(1, out.get("updated"));
        assertEquals(1, out.get("skipped"));
        @SuppressWarnings("unchecked")
        List<String> names = (List<String>) out.get("skippedNames");
        assertEquals("이소연(출근)", names.get(0));
    }

    @Test
    void setRosterAllOff_skipsSickLeave() {
        Coach soyeon = coach(10L, "이소연 [강사]", "필라테스");
        LocalDate date = LocalDate.of(2026, 9, 20);
        CoachWorkRecord sick = new CoachWorkRecord();
        sick.setCoach(soyeon);
        sick.setWorkDate(date);
        sick.setDayType(CoachWorkRecord.DayType.SICK);
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(soyeon));
        when(workRecordRepository.findByCoachIdAndWorkDate(10L, date)).thenReturn(Optional.of(sick));

        Map<String, Object> out = service.setRosterAllOff(date);

        assertEquals(0, out.get("updated"));
        assertEquals(1, out.get("skipped"));
    }

    @Test
    void clearRosterAllOff_deletesOffRecordsOnly() {
        Coach soyeon = coach(10L, "이소연 [강사]", "필라테스");
        Coach pitcher = coach(20L, "박근엽 [투수코치]", "야구");
        LocalDate date = LocalDate.of(2026, 9, 20);
        CoachWorkRecord off = new CoachWorkRecord();
        off.setCoach(soyeon);
        off.setWorkDate(date);
        off.setDayType(CoachWorkRecord.DayType.OFF);
        CoachWorkRecord work = new CoachWorkRecord();
        work.setCoach(pitcher);
        work.setWorkDate(date);
        work.setDayType(CoachWorkRecord.DayType.WORK);
        work.setCheckInTime(date.atTime(10, 0));
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(soyeon, pitcher));
        when(workRecordRepository.findByCoachIdAndWorkDate(10L, date)).thenReturn(Optional.of(off));
        when(workRecordRepository.findByCoachIdAndWorkDate(20L, date)).thenReturn(Optional.of(work));

        Map<String, Object> out = service.clearRosterAllOff(date);

        assertEquals(1, out.get("cleared"));
        org.mockito.Mockito.verify(workRecordRepository).delete(off);
        org.mockito.Mockito.verify(workRecordRepository, org.mockito.Mockito.never()).delete(work);
    }

    @Test
    void setRosterAllOff_mainGroupDoesNotChangeSonHeejin() {
        Coach heejin = coach(30L, "손희진 [강사]", "필라테스");
        Coach pitcher = coach(20L, "박근엽 [투수코치]", "야구");
        LocalDate date = LocalDate.of(2026, 9, 21);
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(heejin, pitcher));
        when(workRecordRepository.findByCoachIdAndWorkDate(20L, date)).thenReturn(Optional.empty());
        when(workRecordRepository.save(any(CoachWorkRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.setRosterAllOff(date, "main");

        assertEquals(1, out.get("updated"));
        org.mockito.Mockito.verify(workRecordRepository, org.mockito.Mockito.never())
                .findByCoachIdAndWorkDate(30L, date);
    }

    @Test
    void setRosterAllOff_separateGroupOnlyChangesSonHeejin() {
        Coach heejin = coach(30L, "손희진 [강사]", "필라테스");
        Coach pitcher = coach(20L, "박근엽 [투수코치]", "야구");
        LocalDate date = LocalDate.of(2026, 9, 21);
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(heejin, pitcher));
        when(workRecordRepository.findByCoachIdAndWorkDate(30L, date)).thenReturn(Optional.empty());
        when(workRecordRepository.save(any(CoachWorkRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.setRosterAllOff(date, "separate");

        assertEquals(1, out.get("updated"));
        org.mockito.Mockito.verify(workRecordRepository, org.mockito.Mockito.never())
                .findByCoachIdAndWorkDate(20L, date);
    }

    @Test
    void setRosterDayMark_outdoorMarksMainGroup() {
        Coach heejin = coach(30L, "손희진 [강사]", "필라테스");
        Coach pitcher = coach(20L, "박근엽 [투수코치]", "야구");
        LocalDate date = LocalDate.of(2026, 9, 22);
        when(coachRepository.findByActiveTrue()).thenReturn(List.of(heejin, pitcher));
        when(workRecordRepository.findByCoachIdAndWorkDate(20L, date)).thenReturn(Optional.empty());
        when(workRecordRepository.save(any(CoachWorkRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> out = service.setRosterDayMark(date, "main", CoachWorkRecord.DayType.OUTDOOR);

        assertEquals("OUTDOOR", out.get("mark"));
        assertEquals(1, out.get("updated"));
        org.mockito.Mockito.verify(workRecordRepository, org.mockito.Mockito.never())
                .findByCoachIdAndWorkDate(30L, date);
    }

    private static Coach coach(Long id, String name, String specialties) {
        Coach c = new Coach();
        c.setId(id);
        c.setName(name);
        c.setSpecialties(specialties);
        c.setActive(true);
        return c;
    }
}
