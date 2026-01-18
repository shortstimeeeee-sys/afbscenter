package com.afbscenter.controller;

import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.AnnouncementRepository;
import com.afbscenter.model.Announcement;
import com.afbscenter.service.MemberService;
import com.afbscenter.util.LessonCategoryUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "http://localhost:8080")
public class DashboardController {

    private static final Logger logger = LoggerFactory.getLogger(DashboardController.class);

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

    @Autowired
    private AnnouncementRepository announcementRepository;

    @Autowired
    private MemberService memberService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/kpi")
    public ResponseEntity<Map<String, Object>> getKPI() {
        try {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

            // 총 회원 수 (JdbcTemplate으로 직접 조회하여 enum 변환 오류 방지)
            long totalMembers = 0L;
            try {
                Long totalMembersLong = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM members", Long.class);
                totalMembers = totalMembersLong != null ? totalMembersLong : 0L;
            } catch (Exception e) {
                logger.warn("총 회원 수 조회 실패: {}", e.getMessage());
                totalMembers = 0L;
            }

            // 월 가입자 수 (이번 달 1일부터 오늘까지)
            LocalDate firstDayOfMonth = today.withDayOfMonth(1);
            Long monthlyNewMembers = 0L;
            try {
                Long result = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM members WHERE join_date >= ? AND join_date <= ?",
                    Long.class,
                    firstDayOfMonth, today
                );
                monthlyNewMembers = result != null ? result : 0L;
            } catch (Exception e) {
                logger.warn("월 가입자 수 조회 실패: {}", e.getMessage());
                monthlyNewMembers = 0L;
            }

            // 오늘 회원 가입 수
            Long todayNewMembers = 0L;
            try {
                Long result = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM members WHERE join_date = ?",
                    Long.class,
                    today
                );
                todayNewMembers = result != null ? result : 0L;
            } catch (Exception e) {
                logger.warn("오늘 가입자 수 조회 실패: {}", e.getMessage());
                todayNewMembers = 0L;
            }

            // 오늘 예약 수
            long todayBookings = 0L;
            try {
                todayBookings = bookingRepository.findByDateRange(startOfDay, endOfDay).size();
            } catch (Exception e) {
                logger.warn("오늘 예약 수 조회 실패: {}", e.getMessage());
                todayBookings = 0L;
            }

            // 오늘 방문 수 (출석) - 숨김 처리하지만 데이터는 유지
            long todayVisits = 0L;
            try {
                todayVisits = attendanceRepository.findByDate(today).size();
            } catch (Exception e) {
                logger.warn("오늘 방문 수 조회 실패: {}", e.getMessage());
                todayVisits = 0L;
            }

            // 오늘 매출
            Integer todayRevenue = 0;
            try {
                todayRevenue = paymentRepository.sumAmountByDateRange(startOfDay, endOfDay);
                if (todayRevenue == null) todayRevenue = 0;
            } catch (Exception e) {
                logger.warn("오늘 매출 조회 실패: {}", e.getMessage());
                todayRevenue = 0;
            }

            // 어제 날짜 및 시간 범위 (어제 대비 계산용)
            LocalDate yesterday = today.minusDays(1);
            LocalDateTime startOfYesterday = yesterday.atStartOfDay();
            LocalDateTime endOfYesterday = yesterday.atTime(LocalTime.MAX);
            
            // 어제 예약 수 (어제 대비 계산용)
            long yesterdayBookings = 0L;
            try {
                yesterdayBookings = bookingRepository.findByDateRange(startOfYesterday, endOfYesterday).size();
            } catch (Exception e) {
                logger.warn("어제 예약 수 조회 실패: {}", e.getMessage());
                yesterdayBookings = 0L;
            }
            
            // 어제 매출 (어제 대비 계산용)
            Integer yesterdayRevenue = 0;
            try {
                yesterdayRevenue = paymentRepository.sumAmountByDateRange(startOfYesterday, endOfYesterday);
                if (yesterdayRevenue == null) yesterdayRevenue = 0;
            } catch (Exception e) {
                logger.warn("어제 매출 조회 실패: {}", e.getMessage());
                yesterdayRevenue = 0;
            }

            // 월 매출 (이번 달 1일부터 말일까지)
            LocalDate lastDayOfMonth = today.withDayOfMonth(today.lengthOfMonth());
            LocalDateTime startOfMonth = firstDayOfMonth.atStartOfDay();
            LocalDateTime endOfMonth = lastDayOfMonth.atTime(LocalTime.MAX);
            
            Integer monthlyRevenue = 0;
            try {
                monthlyRevenue = paymentRepository.sumAmountByDateRange(startOfMonth, endOfMonth);
                if (monthlyRevenue == null) monthlyRevenue = 0;
            } catch (Exception e) {
                logger.warn("월 매출 조회 실패: {}", e.getMessage());
                monthlyRevenue = 0;
            }

            Map<String, Object> kpi = new HashMap<>();
            kpi.put("totalMembers", totalMembers);       // 총 회원 수
            kpi.put("monthlyNewMembers", monthlyNewMembers); // 월 가입자 수
            kpi.put("newMembers", todayNewMembers);      // 오늘 가입 수
            kpi.put("bookings", todayBookings);         // 오늘 예약 수
            kpi.put("yesterdayBookings", yesterdayBookings); // 어제 예약 수 (어제 대비 계산용)
            kpi.put("revenue", todayRevenue);           // 오늘 매출
            kpi.put("yesterdayRevenue", yesterdayRevenue); // 어제 매출 (어제 대비 계산용)
            kpi.put("monthlyRevenue", monthlyRevenue);   // 월 매출
            kpi.put("visits", todayVisits);             // 방문 수 (숨김 처리)

            return ResponseEntity.ok(kpi);
        } catch (Exception e) {
            logger.error("KPI 데이터 조회 중 오류 발생: {}", e.getMessage(), e);
            // 스택 트레이스도 로그에 출력
            logger.error("스택 트레이스:", e);
            
            // 오류 상세 정보를 응답에 포함 (개발 환경에서 디버깅용)
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "KPI 데이터 조회 중 오류가 발생했습니다.");
            errorResponse.put("message", e.getMessage());
            errorResponse.put("type", e.getClass().getSimpleName());
            if (e.getCause() != null) {
                errorResponse.put("cause", e.getCause().getMessage());
            }
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
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
                        com.afbscenter.model.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                        if (category != null) {
                            booking.setLessonCategory(category);
                            bookingRepository.save(booking);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // 조용히 실패 (로그만 출력)
            logger.warn("레슨 카테고리 자동 업데이트 실패: {}", e.getMessage(), e);
        }
    }

    @GetMapping("/today-schedule")
    @Transactional
    public ResponseEntity<List<Map<String, Object>>> getTodaySchedule() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);
        LocalDateTime now = LocalDateTime.now();

        List<com.afbscenter.model.Booking> bookings = bookingRepository.findByDateRange(startOfDay, endOfDay);
        
        // 레슨 카테고리가 없는 예약들을 자동으로 업데이트
        updateMissingLessonCategoriesForBookings(bookings);
        
        // 종료 시간이 지난 확정 예약을 자동으로 완료 상태로 변경
        int autoCompletedCount = 0;
        for (com.afbscenter.model.Booking booking : bookings) {
            if (booking.getEndTime() != null && 
                booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.CONFIRMED &&
                booking.getEndTime().isBefore(now)) {
                booking.setStatus(com.afbscenter.model.Booking.BookingStatus.COMPLETED);
                bookingRepository.save(booking);
                autoCompletedCount++;
            }
        }
        if (autoCompletedCount > 0) {
            logger.debug("오늘 일정 조회 시 {}개의 예약이 자동으로 완료 상태로 변경되었습니다.", autoCompletedCount);
        }

        // 확정 및 완료된 예약 필터링 (대기, 취소, 노쇼 제외)
        List<Map<String, Object>> schedule = bookings.stream()
                .filter(booking -> booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.CONFIRMED ||
                                 booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.COMPLETED)
                .map(booking -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", booking.getId());
                    
                    // 시간 포맷팅 (HH:mm)
                    String timeStr = booking.getStartTime().toLocalTime().toString();
                    if (timeStr.length() > 5) {
                        timeStr = timeStr.substring(0, 5);
                    }
                    item.put("time", timeStr);
                    
                    // 종료 시간 포맷팅
                    String endTimeStr = "";
                    if (booking.getEndTime() != null) {
                        endTimeStr = booking.getEndTime().toLocalTime().toString();
                        if (endTimeStr.length() > 5) {
                            endTimeStr = endTimeStr.substring(0, 5);
                        }
                    }
                    item.put("endTime", endTimeStr);
                    
                    // 종료 여부 확인 (종료 시간이 현재 시간보다 이전이면 종료됨)
                    boolean isCompleted = booking.getEndTime() != null && booking.getEndTime().isBefore(now);
                    item.put("isCompleted", isCompleted);
                    
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
                                com.afbscenter.model.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
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

    @GetMapping("/announcements")
    public ResponseEntity<List<Map<String, Object>>> getActiveAnnouncements() {
        try {
            LocalDate currentDate = LocalDate.now();
            List<Announcement> announcements = announcementRepository.findActiveAnnouncements(currentDate);
            
            List<Map<String, Object>> result = new ArrayList<>();
            for (Announcement announcement : announcements) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", announcement.getId());
                map.put("title", announcement.getTitle());
                map.put("content", announcement.getContent());
                map.put("startDate", announcement.getStartDate());
                map.put("endDate", announcement.getEndDate());
                map.put("createdAt", announcement.getCreatedAt());
                result.add(map);
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("활성 공지사항 조회 중 오류 발생: {}", e.getMessage(), e);
            return ResponseEntity.ok(new ArrayList<>()); // 오류 시 빈 리스트 반환
        }
    }
}
