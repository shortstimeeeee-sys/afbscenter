package com.afbscenter.controller;

import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.AnnouncementRepository;
import com.afbscenter.model.Booking;
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
    /** Cache TTL for expiring/expired member counts (ms). Reduces repeated heavy computation on refresh. */
    private static final long KPI_EXPIRING_CACHE_TTL_MS = 60_000L;
    private static volatile long expiringExpiredCacheAt = 0L;
    private static volatile long cachedExpiringMembers = 0L;
    private static volatile long cachedExpiredMembers = 0L;

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

            // 오늘 예약 수 (count 쿼리로 엔티티 로드 없음)
            long todayBookings = 0L;
            try {
                todayBookings = bookingRepository.countByStartTimeBetween(startOfDay, endOfDay);
            } catch (Exception e) {
                logger.warn("오늘 예약 수 조회 실패: {}", e.getMessage());
                todayBookings = 0L;
            }

            // 오늘 방문 수 (출석) - count 쿼리로 엔티티 로드 없음
            long todayVisits = 0L;
            try {
                todayVisits = attendanceRepository.countByDate(today);
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
                        List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findByPurchaseDateRange(startOfDay, endOfDay);
                        
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
            
            // 어제 예약 수 (어제 대비 계산용, count 쿼리)
            long yesterdayBookings = 0L;
            try {
                yesterdayBookings = bookingRepository.countByStartTimeBetween(startOfYesterday, endOfYesterday);
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
                        List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findByPurchaseDateRange(startOfMonth, endOfMonth);
                        
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

            // 이번 달 총 예약 건수 (사하 + 연산 + 대관) 및 지점별 비회원 수
            long totalBookingsMonth = 0L;
            Map<String, Long> bookingsByBranch = new HashMap<>();
            bookingsByBranch.put("SAHA", 0L);
            bookingsByBranch.put("YEONSAN", 0L);
            bookingsByBranch.put("RENTAL", 0L);
            Map<String, Long> bookingsNonMemberByBranch = new HashMap<>();
            bookingsNonMemberByBranch.put("SAHA", 0L);
            bookingsNonMemberByBranch.put("YEONSAN", 0L);
            bookingsNonMemberByBranch.put("RENTAL", 0L);
            try {
                List<Booking> monthBookings = bookingRepository.findByDateRange(startOfMonth, endOfMonth);
                totalBookingsMonth = monthBookings.size();
                for (Booking b : monthBookings) {
                    if (b.getBranch() != null) {
                        String key = b.getBranch().name();
                        bookingsByBranch.merge(key, 1L, Long::sum);
                        if (b.getMember() == null) {
                            bookingsNonMemberByBranch.merge(key, 1L, Long::sum);
                        }
                    }
                }
            } catch (Exception e) {
                logger.warn("이번 달 예약 건수 조회 실패: {}", e.getMessage());
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
            kpi.put("totalBookingsMonth", totalBookingsMonth);   // 이번 달 총 예약 건수 (사하+연산+대관)
            kpi.put("bookingsByBranch", bookingsByBranch);      // 지점별 예약 건수 (SAHA, YEONSAN, RENTAL)
            kpi.put("bookingsNonMemberByBranch", bookingsNonMemberByBranch); // 지점별 비회원 예약 건수
            
            // 만료 임박 및 종료 회원 수: 60초 캐시로 새로고침 시 반복 계산 방지
            long expiringMembersCount;
            long expiredMembersCount;
            long now = System.currentTimeMillis();
            if (now - expiringExpiredCacheAt < KPI_EXPIRING_CACHE_TTL_MS) {
                expiringMembersCount = cachedExpiringMembers;
                expiredMembersCount = cachedExpiredMembers;
            } else {
                expiringMembersCount = 0L;
                expiredMembersCount = 0L;
                try {
                    List<com.afbscenter.model.Member> allMembers = memberRepository.findAll();
                    LocalDate expiryThreshold = today.plusDays(7);
                    for (com.afbscenter.model.Member member : allMembers) {
                        try {
                            List<MemberProduct> activeProducts = memberProductRepository.findByMemberIdAndStatus(
                                member.getId(), MemberProduct.Status.ACTIVE);
                            List<MemberProduct> usedUpMemberProducts = memberProductRepository.findByMemberIdAndStatus(
                                member.getId(), MemberProduct.Status.USED_UP);
                            List<MemberProduct> allMemberProducts = memberProductRepository.findByMemberId(member.getId());
                            boolean isExpiring = false;
                            boolean isExpired = false;
                            for (MemberProduct mp : activeProducts) {
                                try {
                                    if (mp.getProduct() != null && mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                                        Integer remainingCount = mp.getRemainingCount();
                                        if (remainingCount == null) {
                                            Integer totalCount = mp.getTotalCount();
                                            if (totalCount == null || totalCount <= 0) {
                                                totalCount = mp.getProduct().getUsageCount();
                                                if (totalCount == null || totalCount <= 0)
                                                    totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                                            }
                                            Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                                            if (usedCountByBooking == null) usedCountByBooking = 0L;
                                            Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(
                                                member.getId(), mp.getId());
                                            if (usedCountByAttendance == null) usedCountByAttendance = 0L;
                                            Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                                            remainingCount = totalCount - actualUsedCount.intValue();
                                            if (remainingCount < 0) remainingCount = 0;
                                        }
                                        if (remainingCount != null && remainingCount <= 3 && remainingCount > 0) {
                                            isExpiring = true;
                                            break;
                                        }
                                    }
                                    if (mp.getProduct() != null && mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS
                                        && mp.getExpiryDate() != null && !mp.getExpiryDate().isAfter(expiryThreshold)
                                        && !mp.getExpiryDate().isBefore(today)) {
                                        isExpiring = true;
                                        break;
                                    }
                                } catch (Exception e) { /* ignore */ }
                            }
                            if (allMemberProducts == null || allMemberProducts.isEmpty()) isExpired = true;
                            else if (activeProducts == null || activeProducts.isEmpty()) isExpired = true;
                            else if (!usedUpMemberProducts.isEmpty()) isExpired = true;
                            if (isExpiring) expiringMembersCount++;
                            if (isExpired) expiredMembersCount++;
                        } catch (Exception e) { /* ignore */ }
                    }
                    expiringExpiredCacheAt = now;
                    cachedExpiringMembers = expiringMembersCount;
                    cachedExpiredMembers = expiredMembersCount;
                } catch (Exception e) {
                    logger.warn("만료 임박 및 종료 회원 수 계산 실패: {}", e.getMessage());
                }
            }
            kpi.put("expiringMembers", expiringMembersCount);
            kpi.put("expiredMembers", expiredMembersCount);

            return ResponseEntity.ok(kpi);
        } catch (Exception e) {
            logger.error("KPI 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
            
            // 이번 달 결제 데이터만 조회 (기간 조건으로 DB에서 필터)
            List<com.afbscenter.model.Payment> payments = paymentRepository.findByPaidAtBetweenWithCoach(startOfMonth, endOfMonth).stream()
                    .filter(p -> p.getStatus() == null || p.getStatus() == com.afbscenter.model.Payment.PaymentStatus.COMPLETED)
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
                    List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findByPurchaseDateRange(startOfMonth, endOfMonth);
                    
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
