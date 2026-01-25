package com.afbscenter.controller;

import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.AnnouncementRepository;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.model.Announcement;
import com.afbscenter.service.MemberService;
import com.afbscenter.util.LessonCategoryUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
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
public class DashboardController {

    private static final Logger logger = LoggerFactory.getLogger(DashboardController.class);

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final CoachRepository coachRepository;
    private final AnnouncementRepository announcementRepository;
    private final MemberService memberService;
    private final JdbcTemplate jdbcTemplate;

    public DashboardController(BookingRepository bookingRepository,
                              PaymentRepository paymentRepository,
                              AttendanceRepository attendanceRepository,
                              MemberRepository memberRepository,
                              MemberProductRepository memberProductRepository,
                              CoachRepository coachRepository,
                              AnnouncementRepository announcementRepository,
                              MemberService memberService,
                              JdbcTemplate jdbcTemplate) {
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.coachRepository = coachRepository;
        this.announcementRepository = announcementRepository;
        this.memberService = memberService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/kpi")
    @Transactional(readOnly = true)
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
                
                // Payment 데이터가 없으면 MemberProduct 기반으로 계산
                if (todayRevenue == 0) {
                    try {
                        List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findAll().stream()
                                .filter(mp -> {
                                    if (mp.getPurchaseDate() == null) return false;
                                    LocalDateTime purchaseDateTime = mp.getPurchaseDate();
                                    return !purchaseDateTime.isBefore(startOfDay) && 
                                           !purchaseDateTime.isAfter(endOfDay);
                                })
                                .collect(Collectors.toList());
                        
                        int memberProductRevenue = 0;
                        for (com.afbscenter.model.MemberProduct mp : memberProducts) {
                            try {
                                com.afbscenter.model.Product product = mp.getProduct();
                                if (product != null && product.getPrice() != null && product.getPrice() > 0) {
                                    memberProductRevenue += product.getPrice();
                                }
                            } catch (Exception e) {
                                // 무시
                            }
                        }
                        
                        if (memberProductRevenue > 0) {
                            todayRevenue = memberProductRevenue;
                            logger.debug("Payment 데이터가 없어 MemberProduct 기반으로 오늘 매출 계산: {}", todayRevenue);
                        }
                    } catch (Exception e) {
                        logger.debug("MemberProduct 기반 오늘 매출 계산 실패: {}", e.getMessage());
                    }
                }
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
                
                // Payment 데이터가 없으면 MemberProduct 기반으로 계산
                if (monthlyRevenue == 0) {
                    try {
                        List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findAll().stream()
                                .filter(mp -> {
                                    if (mp.getPurchaseDate() == null) return false;
                                    LocalDateTime purchaseDateTime = mp.getPurchaseDate();
                                    return !purchaseDateTime.isBefore(startOfMonth) && 
                                           !purchaseDateTime.isAfter(endOfMonth);
                                })
                                .collect(Collectors.toList());
                        
                        int memberProductRevenue = 0;
                        for (com.afbscenter.model.MemberProduct mp : memberProducts) {
                            try {
                                com.afbscenter.model.Product product = mp.getProduct();
                                if (product != null && product.getPrice() != null && product.getPrice() > 0) {
                                    memberProductRevenue += product.getPrice();
                                }
                            } catch (Exception e) {
                                // 무시
                            }
                        }
                        
                        if (memberProductRevenue > 0) {
                            monthlyRevenue = memberProductRevenue;
                            logger.debug("Payment 데이터가 없어 MemberProduct 기반으로 월 매출 계산: {}", monthlyRevenue);
                        }
                    } catch (Exception e) {
                        logger.debug("MemberProduct 기반 월 매출 계산 실패: {}", e.getMessage());
                    }
                }
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
            
            // 평균 회원당 매출 계산 (월 매출 ÷ 총 회원 수)
            Integer avgRevenuePerMember = 0;
            if (totalMembers > 0 && monthlyRevenue > 0) {
                avgRevenuePerMember = monthlyRevenue / (int)totalMembers;
            }
            kpi.put("avgRevenuePerMember", avgRevenuePerMember); // 평균 회원당 매출
            
            // 만료 임박 회원 수 계산 (횟수 5회 이하 또는 기간 7일 이하)
            long expiringMembersCount = 0L;
            try {
                List<com.afbscenter.model.Member> allMembers = memberRepository.findAll();
                LocalDate expiryThreshold = today.plusDays(7); // 7일 이내 만료
                
                for (com.afbscenter.model.Member member : allMembers) {
                    try {
                        List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdAndStatus(
                            member.getId(), MemberProduct.Status.ACTIVE);
                        
                        boolean isExpiring = false;
                        
                        for (MemberProduct mp : memberProducts) {
                            try {
                                // 횟수권: 남은 횟수 5회 이하
                                if (mp.getProduct() != null && 
                                    mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                                    Integer remainingCount = mp.getRemainingCount();
                                    
                                    // remainingCount가 null이면 실제 사용 횟수를 계산
                                    if (remainingCount == null) {
                                        Integer totalCount = mp.getTotalCount();
                                        if (totalCount == null || totalCount <= 0) {
                                            totalCount = mp.getProduct().getUsageCount();
                                            if (totalCount == null || totalCount <= 0) {
                                                totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                                            }
                                        }
                                        
                                        // 실제 사용된 횟수 계산
                                        Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                                        if (usedCountByBooking == null) usedCountByBooking = 0L;
                                        
                                        Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(
                                            member.getId(), mp.getId());
                                        if (usedCountByAttendance == null) usedCountByAttendance = 0L;
                                        
                                        // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용
                                        Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                                        remainingCount = totalCount - actualUsedCount.intValue();
                                        if (remainingCount < 0) remainingCount = 0;
                                    }
                                    
                                    if (remainingCount != null && remainingCount <= 5 && remainingCount > 0) {
                                        isExpiring = true;
                                        break;
                                    }
                                }
                                
                                // 기간권: 만료일이 7일 이내
                                if (mp.getProduct() != null && 
                                    mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS) {
                                    if (mp.getExpiryDate() != null && 
                                        !mp.getExpiryDate().isAfter(expiryThreshold) &&
                                        !mp.getExpiryDate().isBefore(today)) {
                                        isExpiring = true;
                                        break;
                                    }
                                }
                            } catch (Exception e) {
                                logger.debug("MemberProduct 만료 확인 실패: MemberProduct ID={}, 오류: {}", 
                                    mp.getId(), e.getMessage());
                            }
                        }
                        
                        if (isExpiring) {
                            expiringMembersCount++;
                        }
                    } catch (Exception e) {
                        logger.debug("회원 만료 임박 확인 실패: Member ID={}, 오류: {}", 
                            member.getId(), e.getMessage());
                    }
                }
            } catch (Exception e) {
                logger.warn("만료 임박 회원 수 계산 실패: {}", e.getMessage());
            }
            
            kpi.put("expiringMembers", expiringMembersCount); // 만료 임박 회원 수

            return ResponseEntity.ok(kpi);
        } catch (Exception e) {
            logger.error("KPI 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @GetMapping("/expiring-members")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getExpiringMembers() {
        try {
            LocalDate today = LocalDate.now();
            LocalDate expiryThreshold = today.plusDays(7); // 7일 이내 만료
            
            List<com.afbscenter.model.Member> allMembers = memberRepository.findAll();
            List<Map<String, Object>> expiringMembersList = new ArrayList<>();
            
            for (com.afbscenter.model.Member member : allMembers) {
                try {
                    List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdAndStatus(
                        member.getId(), MemberProduct.Status.ACTIVE);
                    
                    boolean isExpiring = false;
                    List<Map<String, Object>> expiringProducts = new ArrayList<>();
                    
                    for (MemberProduct mp : memberProducts) {
                        try {
                            Map<String, Object> productInfo = new HashMap<>();
                            boolean productExpiring = false;
                            String expiryReason = "";
                            
                            // 횟수권: 남은 횟수 5회 이하
                            if (mp.getProduct() != null && 
                                mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                                Integer remainingCount = mp.getRemainingCount();
                                
                                // remainingCount가 null이면 실제 사용 횟수를 계산
                                if (remainingCount == null) {
                                    Integer totalCount = mp.getTotalCount();
                                    if (totalCount == null || totalCount <= 0) {
                                        totalCount = mp.getProduct().getUsageCount();
                                        if (totalCount == null || totalCount <= 0) {
                                            totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                                        }
                                    }
                                    
                                    // 실제 사용된 횟수 계산
                                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                                    if (usedCountByBooking == null) usedCountByBooking = 0L;
                                    
                                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(
                                        member.getId(), mp.getId());
                                    if (usedCountByAttendance == null) usedCountByAttendance = 0L;
                                    
                                    // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용
                                    Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                                    remainingCount = totalCount - actualUsedCount.intValue();
                                    if (remainingCount < 0) remainingCount = 0;
                                }
                                
                                if (remainingCount != null && remainingCount <= 5 && remainingCount > 0) {
                                    productExpiring = true;
                                    expiryReason = "남은 횟수: " + remainingCount + "회";
                                    productInfo.put("remainingCount", remainingCount);
                                }
                            }
                            
                            // 기간권: 만료일이 7일 이내
                            if (mp.getProduct() != null && 
                                mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS) {
                                if (mp.getExpiryDate() != null) {
                                    // 만료일이 오늘 이후이고 7일 이내인 경우만 만료 임박으로 표시
                                    if (!mp.getExpiryDate().isBefore(today) && 
                                        !mp.getExpiryDate().isAfter(expiryThreshold)) {
                                        productExpiring = true;
                                        // 만료일까지 남은 일수 계산 (오늘 포함하지 않음)
                                        // 예: 오늘이 1월 26일이고 만료일이 1월 27일이면 1일
                                        long daysUntilExpiry = java.time.temporal.ChronoUnit.DAYS.between(today, mp.getExpiryDate());
                                        
                                        // 만료일이 오늘과 같으면 "오늘 만료", 내일이면 "내일 만료", 그 외는 "N일"
                                        if (daysUntilExpiry == 0) {
                                            expiryReason = "오늘 만료";
                                        } else if (daysUntilExpiry == 1) {
                                            expiryReason = "내일 만료";
                                        } else {
                                            expiryReason = "만료까지 " + daysUntilExpiry + "일";
                                        }
                                        
                                        productInfo.put("expiryDate", mp.getExpiryDate().toString());
                                        productInfo.put("daysUntilExpiry", daysUntilExpiry);
                                        
                                        logger.debug("만료 임박 기간권: 회원 ID={}, 상품={}, 만료일={}, 남은 일수={}", 
                                            member.getId(), mp.getProduct().getName(), mp.getExpiryDate(), daysUntilExpiry);
                                    }
                                }
                            }
                            
                            if (productExpiring) {
                                isExpiring = true;
                                productInfo.put("productName", mp.getProduct() != null ? mp.getProduct().getName() : "알 수 없음");
                                productInfo.put("productType", mp.getProduct() != null ? mp.getProduct().getType().toString() : "");
                                productInfo.put("expiryReason", expiryReason);
                                expiringProducts.add(productInfo);
                            }
                        } catch (Exception e) {
                            logger.debug("MemberProduct 만료 확인 실패: MemberProduct ID={}, 오류: {}", 
                                mp.getId(), e.getMessage());
                        }
                    }
                    
                    if (isExpiring) {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", member.getId());
                        memberMap.put("memberNumber", member.getMemberNumber());
                        memberMap.put("name", member.getName());
                        memberMap.put("phoneNumber", member.getPhoneNumber());
                        memberMap.put("grade", member.getGrade());
                        memberMap.put("school", member.getSchool());
                        memberMap.put("expiringProducts", expiringProducts);
                        expiringMembersList.add(memberMap);
                    }
                } catch (Exception e) {
                    logger.debug("회원 만료 임박 확인 실패: Member ID={}, 오류: {}", 
                        member.getId(), e.getMessage());
                }
            }
            
            return ResponseEntity.ok(expiringMembersList);
        } catch (Exception e) {
            logger.error("만료 임박 회원 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
    @Transactional(readOnly = true)
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
    @Transactional(readOnly = true)
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
    @Transactional(readOnly = true)
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

    @GetMapping("/revenue-metrics")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getRevenueMetrics() {
        try {
            LocalDate today = LocalDate.now();
            LocalDate firstDayOfMonth = today.withDayOfMonth(1);
            LocalDateTime startOfMonth = firstDayOfMonth.atStartOfDay();
            LocalDateTime endOfMonth = today.atTime(LocalTime.MAX);
            
            // 이번 달 결제 데이터 조회
            List<com.afbscenter.model.Payment> payments = paymentRepository.findAllWithCoach().stream()
                    .filter(p -> p.getPaidAt() != null && 
                               !p.getPaidAt().isBefore(startOfMonth) && 
                               !p.getPaidAt().isAfter(endOfMonth) &&
                               (p.getStatus() == null || p.getStatus() == com.afbscenter.model.Payment.PaymentStatus.COMPLETED))
                    .collect(Collectors.toList());
            
            // 카테고리별 매출 계산
            Map<String, Integer> byCategory = new HashMap<>();
            Map<LocalDate, Integer> dailyRevenue = new HashMap<>();
            
            for (com.afbscenter.model.Payment payment : payments) {
                int amount = payment.getAmount() != null ? payment.getAmount() : 0;
                int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
                int netAmount = amount - refund;
                
                // 카테고리 결정
                String category = null;
                String productCategory = null;
                
                if (payment.getCategory() != null) {
                    category = payment.getCategory().name();
                } else {
                    // 카테고리 자동 판단
                    if (payment.getBooking() != null) {
                        try {
                            com.afbscenter.model.Booking booking = payment.getBooking();
                            if (booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL) {
                                category = "RENTAL";
                            } else if (booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.LESSON) {
                                category = "LESSON";
                            }
                        } catch (Exception e) {
                            // 무시
                        }
                    }
                    
                    if (category == null && payment.getProduct() != null) {
                        category = "PRODUCT_SALE";
                        try {
                            com.afbscenter.model.Product product = payment.getProduct();
                            if (product.getCategory() != null) {
                                productCategory = product.getCategory().name();
                            }
                        } catch (Exception e) {
                            // 무시
                        }
                    }
                    
                    if (category == null) {
                        category = "OTHER";
                    }
                }
                
                // 상품 카테고리가 있으면 "PRODUCT_SALE_{상품카테고리}" 형식으로 저장
                String finalCategory = category;
                if (category.equals("PRODUCT_SALE") && productCategory != null) {
                    finalCategory = "PRODUCT_SALE_" + productCategory;
                }
                
                byCategory.put(finalCategory, byCategory.getOrDefault(finalCategory, 0) + netAmount);
                
                // 일별 매출
                if (payment.getPaidAt() != null) {
                    LocalDate date = payment.getPaidAt().toLocalDate();
                    dailyRevenue.put(date, dailyRevenue.getOrDefault(date, 0) + netAmount);
                }
            }
            
            // Payment 데이터가 없으면 MemberProduct 기반으로 계산
            if (payments.isEmpty()) {
                try {
                    List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findAll().stream()
                            .filter(mp -> {
                                if (mp.getPurchaseDate() == null) return false;
                                LocalDateTime purchaseDateTime = mp.getPurchaseDate();
                                return !purchaseDateTime.isBefore(startOfMonth) && 
                                       !purchaseDateTime.isAfter(endOfMonth);
                            })
                            .collect(Collectors.toList());
                    
                    for (com.afbscenter.model.MemberProduct mp : memberProducts) {
                        try {
                            com.afbscenter.model.Product product = mp.getProduct();
                            if (product == null || product.getPrice() == null || product.getPrice() <= 0) {
                                continue;
                            }
                            
                            int amount = product.getPrice();
                            String category = "PRODUCT_SALE";
                            
                            // 상품 카테고리가 있으면 "PRODUCT_SALE_{상품카테고리}" 형식으로 저장
                            String finalCategory = category;
                            if (product.getCategory() != null) {
                                finalCategory = "PRODUCT_SALE_" + product.getCategory().name();
                            }
                            
                            byCategory.put(finalCategory, byCategory.getOrDefault(finalCategory, 0) + amount);
                            
                            // 일별 매출
                            if (mp.getPurchaseDate() != null) {
                                LocalDate date = mp.getPurchaseDate().toLocalDate();
                                dailyRevenue.put(date, dailyRevenue.getOrDefault(date, 0) + amount);
                            }
                        } catch (Exception e) {
                            // 무시
                        }
                    }
                } catch (Exception e) {
                    logger.debug("MemberProduct 기반 매출 계산 실패: {}", e.getMessage());
                }
            }
            
            // 상품 카테고리 한글 변환 함수
            java.util.function.Function<String, String> getProductCategoryKorean = (productCategory) -> {
                if (productCategory == null) return "일반";
                switch (productCategory) {
                    case "BASEBALL":
                        return "야구";
                    case "TRAINING":
                        return "트레이닝";
                    case "PILATES":
                        return "필라테스";
                    case "TRAINING_FITNESS":
                        return "트레이닝+필라테스";
                    case "GENERAL":
                        return "일반";
                    case "RENTAL":
                        return "대관";
                    default:
                        return productCategory;
                }
            };
            
            // 카테고리 한글 변환
            java.util.function.Function<String, String> getCategoryKorean = (category) -> {
                if (category == null) return "기타";
                
                // 상품판매 + 상품 카테고리 조합 처리
                if (category.startsWith("PRODUCT_SALE_")) {
                    String productCategory = category.substring("PRODUCT_SALE_".length());
                    String productCategoryKorean = getProductCategoryKorean.apply(productCategory);
                    return "상품판매 - " + productCategoryKorean;
                }
                
                switch (category) {
                    case "RENTAL":
                        return "대관";
                    case "LESSON":
                        return "레슨";
                    case "PRODUCT_SALE":
                        return "상품판매";
                    case "OTHER":
                        return "기타";
                    default:
                        return category;
                }
            };
            
            // 카테고리별 매출 리스트 생성
            List<Map<String, Object>> categoryList = new ArrayList<>();
            int totalRevenue = byCategory.values().stream().mapToInt(Integer::intValue).sum();
            
            for (Map.Entry<String, Integer> entry : byCategory.entrySet()) {
                Map<String, Object> item = new HashMap<>();
                item.put("label", getCategoryKorean.apply(entry.getKey()));
                item.put("value", entry.getValue());
                item.put("percentage", totalRevenue > 0 ? (entry.getValue() * 100.0 / totalRevenue) : 0.0);
                categoryList.add(item);
            }
            
            // 일별 매출 추이 생성 (이번 달 1일부터 오늘까지)
            List<Map<String, Object>> dailyTrend = new ArrayList<>();
            for (LocalDate date = firstDayOfMonth; !date.isAfter(today); date = date.plusDays(1)) {
                Map<String, Object> dayData = new HashMap<>();
                dayData.put("date", date.toString());
                dayData.put("label", String.format("%02d/%02d", date.getMonthValue(), date.getDayOfMonth()));
                dayData.put("value", dailyRevenue.getOrDefault(date, 0));
                dailyTrend.add(dayData);
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("byCategory", categoryList);
            result.put("dailyTrend", dailyTrend);
            result.put("totalRevenue", totalRevenue);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("매출 지표 조회 중 오류 발생: {}", e.getMessage(), e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("byCategory", new ArrayList<>());
            errorResult.put("dailyTrend", new ArrayList<>());
            errorResult.put("totalRevenue", 0);
            return ResponseEntity.ok(errorResult);
        }
    }
}
