package com.afbscenter.controller;

import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.util.LessonCategoryUtil;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private CoachRepository coachRepository;

    @GetMapping("/kpi")
    public ResponseEntity<Map<String, Object>> getKPI() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        // 총 회원 수
        long totalMembers = memberRepository.count();

        // 월 가입자 수 (이번 달 1일부터 오늘까지)
        LocalDate firstDayOfMonth = today.withDayOfMonth(1);
        Long monthlyNewMembers = memberRepository.countByJoinDateRange(firstDayOfMonth, today);
        if (monthlyNewMembers == null) monthlyNewMembers = 0L;

        // 오늘 회원 가입 수
        Long todayNewMembers = memberRepository.countByJoinDate(today);
        if (todayNewMembers == null) todayNewMembers = 0L;

        // 오늘 예약 수
        long todayBookings = bookingRepository.findByDateRange(startOfDay, endOfDay).size();

        // 오늘 방문 수 (출석) - 숨김 처리하지만 데이터는 유지
        long todayVisits = attendanceRepository.findByDate(today).size();

        // 오늘 매출
        Integer todayRevenue = paymentRepository.sumAmountByDateRange(startOfDay, endOfDay);
        if (todayRevenue == null) todayRevenue = 0;

        // 월 매출 (이번 달 1일부터 말일까지)
        LocalDate lastDayOfMonth = today.withDayOfMonth(today.lengthOfMonth());
        LocalDateTime startOfMonth = firstDayOfMonth.atStartOfDay();
        LocalDateTime endOfMonth = lastDayOfMonth.atTime(LocalTime.MAX);
        
        Integer monthlyRevenue = paymentRepository.sumAmountByDateRange(startOfMonth, endOfMonth);
        if (monthlyRevenue == null) monthlyRevenue = 0;

        Map<String, Object> kpi = new HashMap<>();
        kpi.put("totalMembers", totalMembers);       // 총 회원 수
        kpi.put("monthlyNewMembers", monthlyNewMembers); // 월 가입자 수
        kpi.put("newMembers", todayNewMembers);      // 오늘 가입 수
        kpi.put("bookings", todayBookings);         // 예약 수
        kpi.put("revenue", todayRevenue);           // 오늘 매출
        kpi.put("monthlyRevenue", monthlyRevenue);   // 월 매출
        kpi.put("visits", todayVisits);             // 방문 수 (숨김 처리)

        return ResponseEntity.ok(kpi);
    }

    // 레슨 카테고리가 없는 예약들을 자동으로 업데이트 (내부 메서드)
    @Transactional
    private void updateMissingLessonCategoriesForBookings(List<com.afbscenter.model.Booking> bookings) {
        try {
            for (com.afbscenter.model.Booking booking : bookings) {
                if (booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.LESSON && 
                    booking.getLessonCategory() == null) {
                    com.afbscenter.model.Coach coach = booking.getCoach();
                    if (coach == null && booking.getMember() != null && booking.getMember().getCoach() != null) {
                        coach = booking.getMember().getCoach();
                    }
                    
                    if (coach != null) {
                        com.afbscenter.model.Lesson.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                        if (category != null) {
                            booking.setLessonCategory(category);
                            bookingRepository.save(booking);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // 조용히 실패 (로그만 출력)
            System.err.println("레슨 카테고리 자동 업데이트 실패: " + e.getMessage());
        }
    }

    @GetMapping("/today-schedule")
    public ResponseEntity<List<Map<String, Object>>> getTodaySchedule() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        List<com.afbscenter.model.Booking> bookings = bookingRepository.findByDateRange(startOfDay, endOfDay);
        
        // 레슨 카테고리가 없는 예약들을 자동으로 업데이트
        updateMissingLessonCategoriesForBookings(bookings);

        // 확정된 예약만 필터링
        List<Map<String, Object>> schedule = bookings.stream()
                .filter(booking -> booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.CONFIRMED)
                .map(booking -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", booking.getId());
                    
                    // 시간 포맷팅 (HH:mm)
                    String timeStr = booking.getStartTime().toLocalTime().toString();
                    if (timeStr.length() > 5) {
                        timeStr = timeStr.substring(0, 5);
                    }
                    item.put("time", timeStr);
                    
                    // 시설 이름
                    item.put("facility", booking.getFacility() != null ? booking.getFacility().getName() : "-");
                    
                    // 회원 이름
                    String memberName = booking.getMember() != null ? booking.getMember().getName() : 
                                      (booking.getNonMemberName() != null ? booking.getNonMemberName() : "비회원");
                    item.put("memberName", memberName);
                    
                    // 레슨 카테고리 (레슨인 경우만)
                    String lessonCategory = "";
                    if (booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.LESSON) {
                        // 먼저 예약에 저장된 레슨 카테고리 확인
                        if (booking.getLessonCategory() != null) {
                            lessonCategory = LessonCategoryUtil.toKoreanText(booking.getLessonCategory());
                        } else {
                            // 레슨 카테고리가 없으면 코치의 담당 종목으로 자동 설정
                            com.afbscenter.model.Coach coach = null;
                            if (booking.getCoach() != null) {
                                coach = booking.getCoach();
                            } else if (booking.getMember() != null && booking.getMember().getCoach() != null) {
                                coach = booking.getMember().getCoach();
                            }
                            
                            if (coach != null) {
                                com.afbscenter.model.Lesson.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                                if (category != null) {
                                    lessonCategory = LessonCategoryUtil.toKoreanText(category);
                                }
                            }
                        }
                    }
                    item.put("lessonCategory", lessonCategory);
                    
                    // 코치 정보 (예약에 직접 할당된 코치 우선, 없으면 회원의 코치)
                    String coachName = "";
                    Long coachId = null;
                    if (booking.getCoach() != null) {
                        coachName = booking.getCoach().getName();
                        coachId = booking.getCoach().getId();
                    } else if (booking.getMember() != null && booking.getMember().getCoach() != null) {
                        coachName = booking.getMember().getCoach().getName();
                        coachId = booking.getMember().getCoach().getId();
                    }
                    item.put("coachName", coachName);
                    item.put("coachId", coachId);
                    
                    item.put("status", booking.getStatus().name());
                    return item;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(schedule);
    }

    @GetMapping("/alerts")
    public ResponseEntity<List<Map<String, Object>>> getAlerts() {
        // 대기 예약
        List<com.afbscenter.model.Booking> pendingBookings = bookingRepository.findByStatus(
                com.afbscenter.model.Booking.BookingStatus.PENDING);

        List<Map<String, Object>> alerts = pendingBookings.stream().map(booking -> {
            Map<String, Object> alert = new HashMap<>();
            alert.put("type", "warning");
            alert.put("title", "대기 예약 승인 필요");
            alert.put("message", booking.getFacility().getName() + " - " + 
                    (booking.getMember() != null ? booking.getMember().getName() : booking.getNonMemberName()));
            return alert;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(alerts);
    }
}
