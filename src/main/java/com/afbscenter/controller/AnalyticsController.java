package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Facility;
import com.afbscenter.model.Member;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "http://localhost:8080")
public class AnalyticsController {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsController.class);

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private MemberService memberService;

    // 카테고리별 결제 세부 내역 조회
    @GetMapping("/revenue/category/{category}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getCategoryRevenueDetails(
            @PathVariable String category,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            // Spring은 자동으로 URL 디코딩을 처리하므로 category는 이미 디코딩된 상태
            logger.info("카테고리별 세부 내역 조회 시작: category={}", category);
            
            LocalDateTime startDateTime = null;
            LocalDateTime endDateTime = null;
            
            try {
                if (startDate != null && endDate != null) {
                    startDateTime = LocalDate.parse(startDate).atStartOfDay();
                    endDateTime = LocalDate.parse(endDate).atTime(LocalTime.MAX);
                } else {
                    // 기본값: 이번 달
                    LocalDate today = LocalDate.now();
                    startDateTime = today.withDayOfMonth(1).atStartOfDay();
                    endDateTime = today.atTime(LocalTime.MAX);
                }
            } catch (Exception e) {
                logger.error("날짜 파싱 실패: startDate={}, endDate={}", startDate, endDate, e);
                return ResponseEntity.badRequest().build();
            }
            
            // 카테고리 변환 (한글 또는 영문 -> PaymentCategory)
            Payment.PaymentCategory paymentCategory = null;
            try {
                // 먼저 한글 카테고리명 확인
                switch (category) {
                    case "대관":
                        paymentCategory = Payment.PaymentCategory.RENTAL;
                        break;
                    case "레슨":
                        paymentCategory = Payment.PaymentCategory.LESSON;
                        break;
                    case "상품판매":
                        paymentCategory = Payment.PaymentCategory.PRODUCT_SALE;
                        break;
                    default:
                        // 영문 카테고리명 시도 (RENTAL, LESSON, PRODUCT_SALE)
                        try {
                            paymentCategory = Payment.PaymentCategory.valueOf(category);
                        } catch (IllegalArgumentException e) {
                            logger.warn("알 수 없는 카테고리: {}", category);
                            return ResponseEntity.badRequest().build();
                        }
                }
            } catch (Exception e) {
                logger.error("카테고리 변환 실패: category={}", category, e);
                return ResponseEntity.badRequest().build();
            }
            
            logger.info("카테고리 변환 완료: category={}, paymentCategory={}", category, paymentCategory);
            
            // 결제 데이터 조회 (더 안전한 방법)
            List<Payment> payments;
            try {
                // 먼저 모든 결제를 조회하고 필터링
                List<Payment> allPayments = paymentRepository.findAll();
                logger.info("전체 결제 건수: {}", allPayments.size());
                
                payments = new ArrayList<>();
                for (Payment p : allPayments) {
                    try {
                        // 카테고리 확인
                        if (p.getCategory() != paymentCategory) {
                            continue;
                        }
                        
                        // 날짜 확인
                        if (p.getPaidAt() == null) {
                            continue;
                        }
                        
                        if (p.getPaidAt().isBefore(startDateTime) || p.getPaidAt().isAfter(endDateTime)) {
                            continue;
                        }
                        
                        payments.add(p);
                    } catch (Exception e) {
                        logger.warn("결제 필터링 중 오류: Payment ID={}", p.getId(), e);
                        // 개별 결제 필터링 실패는 무시하고 계속 진행
                    }
                }
                
                logger.info("필터링된 결제 건수: {}", payments.size());
            } catch (Exception e) {
                logger.error("결제 데이터 조회 실패", e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
            
            // Map으로 변환
            List<Map<String, Object>> result = new ArrayList<>();
            for (Payment payment : payments) {
                try {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", payment.getId());
                    map.put("amount", payment.getAmount());
                    map.put("refundAmount", payment.getRefundAmount() != null ? payment.getRefundAmount() : 0);
                    map.put("paidAt", payment.getPaidAt());
                    map.put("paymentMethod", payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : null);
                    map.put("memo", payment.getMemo());
                    
                    // 회원 정보 (lazy loading 안전 처리)
                    try {
                        if (payment.getMember() != null) {
                            // 회원 정보를 안전하게 로드
                            com.afbscenter.model.Member member = payment.getMember();
                            Map<String, Object> memberMap = new HashMap<>();
                            memberMap.put("id", member.getId());
                            try {
                                memberMap.put("name", member.getName());
                            } catch (Exception e) {
                                logger.warn("회원 이름 로드 실패: Member ID={}", member.getId(), e);
                                memberMap.put("name", null);
                            }
                            try {
                                memberMap.put("memberNumber", member.getMemberNumber());
                            } catch (Exception e) {
                                logger.warn("회원번호 로드 실패: Member ID={}", member.getId(), e);
                                memberMap.put("memberNumber", null);
                            }
                            map.put("member", memberMap);
                        } else {
                            map.put("member", null);
                        }
                    } catch (Exception e) {
                        logger.warn("회원 정보 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("member", null);
                    }
                    
                    // 상품 정보 (lazy loading 안전 처리)
                    try {
                        if (payment.getProduct() != null) {
                            com.afbscenter.model.Product product = payment.getProduct();
                            Map<String, Object> productMap = new HashMap<>();
                            productMap.put("id", product.getId());
                            try {
                                productMap.put("name", product.getName());
                            } catch (Exception e) {
                                logger.warn("상품 이름 로드 실패: Product ID={}", product.getId(), e);
                                productMap.put("name", null);
                            }
                            map.put("product", productMap);
                        } else {
                            map.put("product", null);
                        }
                    } catch (Exception e) {
                        logger.warn("상품 정보 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("product", null);
                    }
                    
                    // 코치 정보 (lazy loading 안전 처리)
                    try {
                        com.afbscenter.model.Coach coach = null;
                        
                        // 예약의 코치 확인
                        try {
                            if (payment.getBooking() != null) {
                                com.afbscenter.model.Booking booking = payment.getBooking();
                                if (booking.getCoach() != null) {
                                    coach = booking.getCoach();
                                }
                            }
                        } catch (Exception e) {
                            logger.debug("예약의 코치 로드 실패: Payment ID={}", payment.getId(), e);
                        }
                        
                        // 회원의 담당 코치 확인 (예약의 코치가 없을 때만)
                        if (coach == null) {
                            try {
                                if (payment.getMember() != null) {
                                    com.afbscenter.model.Member member = payment.getMember();
                                    if (member.getCoach() != null) {
                                        coach = member.getCoach();
                                    }
                                }
                            } catch (Exception e) {
                                logger.debug("회원의 코치 로드 실패: Payment ID={}", payment.getId(), e);
                            }
                        }
                        
                        if (coach != null) {
                            Map<String, Object> coachMap = new HashMap<>();
                            coachMap.put("id", coach.getId());
                            try {
                                coachMap.put("name", coach.getName());
                            } catch (Exception e) {
                                logger.warn("코치 이름 로드 실패: Coach ID={}", coach.getId(), e);
                                coachMap.put("name", null);
                            }
                            map.put("coach", coachMap);
                        } else {
                            map.put("coach", null);
                        }
                    } catch (Exception e) {
                        logger.warn("코치 정보 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("coach", null);
                    }
                    
                    result.add(map);
                } catch (Exception e) {
                    logger.warn("결제 데이터 변환 실패: Payment ID={}", payment.getId(), e);
                    // 개별 결제 변환 실패는 무시하고 계속 진행
                }
            }
            
            logger.info("카테고리별 세부 내역 조회 완료: category={}, 결과 건수={}", category, result.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("카테고리별 결제 세부 내역 조회 실패: category={}, error={}", category, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 날짜별 결제 세부 내역 조회
    @GetMapping("/revenue/date/{date}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getDateRevenueDetails(@PathVariable String date) {
        try {
            LocalDate targetDate = LocalDate.parse(date);
            LocalDateTime startDateTime = targetDate.atStartOfDay();
            LocalDateTime endDateTime = targetDate.atTime(LocalTime.MAX);
            
            List<Payment> payments = paymentRepository.findAllWithCoach().stream()
                    .filter(p -> p.getPaidAt() != null &&
                               !p.getPaidAt().isBefore(startDateTime) &&
                               !p.getPaidAt().isAfter(endDateTime))
                    .collect(Collectors.toList());
            
            List<Map<String, Object>> result = payments.stream().map(payment -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", payment.getId());
                map.put("amount", payment.getAmount());
                map.put("refundAmount", payment.getRefundAmount());
                map.put("paidAt", payment.getPaidAt());
                map.put("paymentMethod", payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : null);
                map.put("category", payment.getCategory() != null ? payment.getCategory().name() : null);
                map.put("memo", payment.getMemo());
                
                // 회원 정보
                if (payment.getMember() != null) {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", payment.getMember().getId());
                    memberMap.put("name", payment.getMember().getName());
                    memberMap.put("memberNumber", payment.getMember().getMemberNumber());
                    map.put("member", memberMap);
                }
                
                // 상품 정보
                if (payment.getProduct() != null) {
                    Map<String, Object> productMap = new HashMap<>();
                    productMap.put("id", payment.getProduct().getId());
                    productMap.put("name", payment.getProduct().getName());
                    map.put("product", productMap);
                }
                
                // 코치 정보
                com.afbscenter.model.Coach coach = null;
                try {
                    if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                        coach = payment.getBooking().getCoach();
                    } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
                        coach = payment.getMember().getCoach();
                    }
                } catch (Exception e) {
                    logger.warn("코치 정보 로드 실패: Payment ID={}", payment.getId(), e);
                }
                
                if (coach != null) {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", coach.getId());
                    coachMap.put("name", coach.getName());
                    map.put("coach", coachMap);
                }
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("날짜별 결제 세부 내역 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원 지표 세부 내역 조회 (코치별)
    @GetMapping("/members/details")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberDetails(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            logger.info("회원 지표 세부 내역 조회 시작");
            
            LocalDate start = null;
            LocalDate end = null;
            
            try {
                if (startDate != null && endDate != null) {
                    start = LocalDate.parse(startDate);
                    end = LocalDate.parse(endDate);
                } else {
                    LocalDate today = LocalDate.now();
                    start = today.withDayOfMonth(1);
                    end = today;
                }
            } catch (Exception e) {
                logger.error("날짜 파싱 실패: startDate={}, endDate={}", startDate, endDate, e);
                return ResponseEntity.badRequest().build();
            }
            
            logger.info("조회 기간: {} ~ {}", start, end);
            
            // 코치 정보를 포함하여 조회 (lazy loading 방지)
            List<Member> allMembers = memberRepository.findAllOrderByName();
            logger.info("전체 회원 수: {}", allMembers.size());
            
            List<Map<String, Object>> result = new ArrayList<>();
            for (Member member : allMembers) {
                try {
                    // 날짜 필터링
                    if (member.getCreatedAt() == null) {
                        continue;
                    }
                    
                    LocalDate memberDate = member.getCreatedAt().toLocalDate();
                    if (memberDate.isBefore(start) || memberDate.isAfter(end)) {
                        continue;
                    }
                    
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", member.getId());
                    map.put("name", member.getName());
                    map.put("memberNumber", member.getMemberNumber());
                    map.put("phoneNumber", member.getPhoneNumber());
                    map.put("grade", member.getGrade());
                    map.put("school", member.getSchool());
                    map.put("createdAt", member.getCreatedAt());
                    
                    // 코치 정보 (안전하게 로드)
                    try {
                        if (member.getCoach() != null) {
                            com.afbscenter.model.Coach coach = member.getCoach();
                            Map<String, Object> coachMap = new HashMap<>();
                            coachMap.put("id", coach.getId());
                            coachMap.put("name", coach.getName());
                            map.put("coach", coachMap);
                        } else {
                            map.put("coach", null);
                        }
                    } catch (Exception e) {
                        logger.warn("코치 정보 로드 실패: Member ID={}", member.getId(), e);
                        map.put("coach", null);
                    }
                    
                    result.add(map);
                } catch (Exception e) {
                    logger.warn("회원 데이터 변환 실패: Member ID={}", member.getId(), e);
                    // 개별 회원 변환 실패는 무시하고 계속 진행
                }
            }
            
            logger.info("회원 지표 세부 내역 조회 완료: 결과 건수={}", result.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 지표 세부 내역 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 운영 지표 세부 내역 조회
    @GetMapping("/operational/details")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getOperationalDetails(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            LocalDateTime startDateTime = null;
            LocalDateTime endDateTime = null;
            
            if (startDate != null && endDate != null) {
                startDateTime = LocalDate.parse(startDate).atStartOfDay();
                endDateTime = LocalDate.parse(endDate).atTime(LocalTime.MAX);
            } else {
                LocalDate today = LocalDate.now();
                startDateTime = today.withDayOfMonth(1).atStartOfDay();
                endDateTime = today.atTime(LocalTime.MAX);
            }
            
            List<Booking> bookings = bookingRepository.findByDateRange(startDateTime, endDateTime);
            List<Facility> facilities = facilityRepository.findByActiveTrue();
            
            Map<String, Object> details = new HashMap<>();
            
            // 예약 통계
            long totalBookings = bookings.size();
            long confirmedBookings = bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.CONFIRMED)
                    .count();
            long completedBookings = bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.COMPLETED)
                    .count();
            long cancelledBookings = bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.CANCELLED)
                    .count();
            long noShowBookings = bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.NO_SHOW)
                    .count();
            
            details.put("totalBookings", totalBookings);
            details.put("confirmedBookings", confirmedBookings);
            details.put("completedBookings", completedBookings);
            details.put("cancelledBookings", cancelledBookings);
            details.put("noShowBookings", noShowBookings);
            
            // 시설별 상세 정보
            List<Map<String, Object>> facilityDetails = new ArrayList<>();
            for (Facility facility : facilities) {
                List<Booking> facilityBookings = bookings.stream()
                        .filter(b -> b.getFacility() != null && b.getFacility().getId().equals(facility.getId()))
                        .collect(Collectors.toList());
                
                Map<String, Object> facilityMap = new HashMap<>();
                facilityMap.put("id", facility.getId());
                facilityMap.put("name", facility.getName());
                facilityMap.put("totalBookings", facilityBookings.size());
                facilityMap.put("confirmedBookings", facilityBookings.stream()
                        .filter(b -> b.getStatus() == Booking.BookingStatus.CONFIRMED)
                        .count());
                facilityMap.put("completedBookings", facilityBookings.stream()
                        .filter(b -> b.getStatus() == Booking.BookingStatus.COMPLETED)
                        .count());
                facilityDetails.add(facilityMap);
            }
            details.put("facilities", facilityDetails);
            
            return ResponseEntity.ok(details);
        } catch (Exception e) {
            logger.error("운영 지표 세부 내역 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            // 기간 계산
            LocalDate start;
            LocalDate end;
            
            if (period != null && period.equals("custom") && startDate != null && endDate != null) {
                start = LocalDate.parse(startDate);
                end = LocalDate.parse(endDate);
            } else {
                LocalDate today = LocalDate.now();
                switch (period != null ? period : "month") {
                    case "day":
                        start = today;
                        end = today;
                        break;
                    case "week":
                        start = today.minusDays(6);
                        end = today;
                        break;
                    case "month":
                        start = today.withDayOfMonth(1);
                        end = today;
                        break;
                    case "year":
                        start = today.withDayOfYear(1);
                        end = today;
                        break;
                    default:
                        start = today.withDayOfMonth(1);
                        end = today;
                        break;
                }
            }
            
            LocalDateTime startDateTime = start.atStartOfDay();
            LocalDateTime endDateTime = end.atTime(LocalTime.MAX);
            
            logger.info("Analytics 조회 - 기간: {} ~ {}, period: {}", start, end, period);
            
            // 예약 데이터 조회
            List<Booking> bookings = bookingRepository.findByDateRange(startDateTime, endDateTime);
            logger.info("조회된 예약 수: {}건 (기간: {} ~ {})", bookings != null ? bookings.size() : 0, startDateTime, endDateTime);
            
            // 예약 상세 로그 (처음 10개만)
            if (bookings != null && !bookings.isEmpty()) {
                int logCount = Math.min(10, bookings.size());
                for (int i = 0; i < logCount; i++) {
                    Booking b = bookings.get(i);
                    try {
                        logger.info("  예약 #{}: ID={}, 시설={}, 상태={}, 시작={}, 종료={}", 
                            i + 1, b.getId(), 
                            b.getFacility() != null ? b.getFacility().getName() : "null",
                            b.getStatus(), b.getStartTime(), b.getEndTime());
                    } catch (Exception e) {
                        logger.warn("예약 로그 출력 실패: {}", e.getMessage());
                    }
                }
            }
            
            // 결제 데이터 조회 (코치 정보 포함)
            List<Payment> payments = paymentRepository.findAllWithCoach().stream()
                    .filter(p -> p.getPaidAt() != null && 
                               !p.getPaidAt().isBefore(startDateTime) && 
                               !p.getPaidAt().isAfter(endDateTime))
                    .collect(Collectors.toList());
            
            // 회원 데이터 조회
            List<Member> members = memberRepository.findAll();
            
            // 시설 데이터 조회
            List<Facility> facilities = facilityRepository.findByActiveTrue();
            
            // 운영 지표
            Map<String, Object> operational = calculateOperationalMetrics(bookings, facilities, start, end);
            
            // 매출 지표
            Map<String, Object> revenue = calculateRevenueMetrics(payments, start, end);
            
            // 회원 지표
            Map<String, Object> memberMetrics = calculateMemberMetrics(members, start, end);
            
            Map<String, Object> analytics = new HashMap<>();
            analytics.put("operational", operational);
            analytics.put("revenue", revenue);
            analytics.put("members", memberMetrics);
            
            return ResponseEntity.ok(analytics);
        } catch (Exception e) {
            logger.error("통계 데이터 조회 중 오류 발생: {}", e.getMessage(), e);
            // 오류 발생 시 기본 구조의 빈 데이터 반환 (서비스 중단 방지)
            Map<String, Object> errorAnalytics = new HashMap<>();
            errorAnalytics.put("operational", new HashMap<>());
            errorAnalytics.put("revenue", new HashMap<>());
            Map<String, Object> errorMemberMetrics = new HashMap<>();
            errorMemberMetrics.put("activeCount", 0L);
            errorMemberMetrics.put("trend", new ArrayList<>());
            errorAnalytics.put("members", errorMemberMetrics);
            return ResponseEntity.ok(errorAnalytics);
        }
    }
    
    private Map<String, Object> calculateOperationalMetrics(List<Booking> bookings, List<Facility> facilities, LocalDate start, LocalDate end) {
        Map<String, Object> metrics = new HashMap<>();
        
        // 기간 정보 추가
        long totalDays = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        metrics.put("periodDays", totalDays);
        metrics.put("periodStart", start.toString());
        metrics.put("periodEnd", end.toString());
        
        // 취소율 및 노쇼율 계산
        if (bookings.isEmpty()) {
            metrics.put("cancelRate", 0.0);
            metrics.put("noShowRate", 0.0);
        } else {
            long totalBookings = bookings.size();
            long cancelledCount = bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.CANCELLED)
                    .count();
            long noShowCount = bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.NO_SHOW)
                    .count();
            
            double cancelRate = totalBookings > 0 ? (double) cancelledCount / totalBookings : 0.0;
            double noShowRate = totalBookings > 0 ? (double) noShowCount / totalBookings : 0.0;
            
            metrics.put("cancelRate", cancelRate);
            metrics.put("noShowRate", noShowRate);
        }
        
        // 시설별 가동률 계산
        List<Map<String, Object>> facilityUtilization = new ArrayList<>();
        logger.info("시설별 가동률 계산 시작 - 시설 수: {}, 예약 수: {}", facilities.size(), bookings.size());
        
        for (Facility facility : facilities) {
            // 해당 시설의 확정/완료 예약만 필터링
            List<Booking> facilityBookings = bookings.stream()
                    .filter(b -> {
                        try {
                            if (b.getFacility() == null) return false;
                            // LAZY 로딩된 facility의 ID를 안전하게 비교
                            Long facilityId = b.getFacility().getId();
                            boolean matches = facilityId != null && facilityId.equals(facility.getId()) &&
                                           (b.getStatus() == Booking.BookingStatus.CONFIRMED || 
                                            b.getStatus() == Booking.BookingStatus.COMPLETED);
                            return matches;
                        } catch (Exception e) {
                            logger.warn("예약 필터링 중 오류 (Booking ID: {}): {}", b.getId(), e.getMessage());
                            return false;
                        }
                    })
                    .collect(Collectors.toList());
            
            logger.info("시설 {} - 필터링된 예약 수: {}", facility.getName(), facilityBookings.size());
            
            // 예약된 총 시간 계산 (분 단위) 및 시간대별 통계
            long totalBookedMinutes = 0;
            Map<Integer, Long> hourlyBookingCount = new HashMap<>(); // 시간대별 예약 횟수
            Map<Integer, Long> hourlyBookingMinutes = new HashMap<>(); // 시간대별 예약 시간(분)
            
            for (Booking booking : facilityBookings) {
                try {
                    if (booking.getStartTime() != null && booking.getEndTime() != null) {
                        long minutes = java.time.Duration.between(booking.getStartTime(), booking.getEndTime()).toMinutes();
                        logger.info("  예약 ID {}: 시작={}, 종료={}, 시간(분)={}", 
                            booking.getId(), booking.getStartTime(), booking.getEndTime(), minutes);
                        
                        // 예약 시간이 0이거나 음수인 경우 기본값 60분(1시간) 사용
                        if (minutes <= 0) {
                            logger.warn("예약 시간이 0이거나 음수입니다 - Booking ID: {}, 시작: {}, 종료: {}, 계산된 분: {}. 기본값 60분 사용", 
                                booking.getId(), booking.getStartTime(), booking.getEndTime(), minutes);
                            minutes = 60; // 기본값 1시간
                        }
                        totalBookedMinutes += minutes;
                        
                        // 시간대별 통계 (시작 시간 기준)
                        int startHour = booking.getStartTime().getHour();
                        hourlyBookingCount.put(startHour, hourlyBookingCount.getOrDefault(startHour, 0L) + 1);
                        hourlyBookingMinutes.put(startHour, hourlyBookingMinutes.getOrDefault(startHour, 0L) + minutes);
                    } else {
                        logger.warn("예약 시간 정보 없음 - Booking ID: {}, 시작: {}, 종료: {}. 기본값 60분 사용", 
                            booking.getId(), booking.getStartTime(), booking.getEndTime());
                        totalBookedMinutes += 60; // 기본값 1시간
                    }
                } catch (Exception e) {
                    logger.warn("예약 시간 계산 중 오류 (Booking ID: {}): {}. 기본값 60분 사용", booking.getId(), e.getMessage(), e);
                    totalBookedMinutes += 60; // 기본값 1시간
                }
            }
            
            // 예약이 있는 날짜 수 계산
            java.util.Set<LocalDate> bookingDates = new java.util.HashSet<>();
            for (Booking booking : facilityBookings) {
                if (booking.getStartTime() != null) {
                    bookingDates.add(booking.getStartTime().toLocalDate());
                }
            }
            int usedDays = bookingDates.size();
            
            // 운영 가능 시간 계산 (분 단위)
            long totalAvailableMinutes = 0;
            int totalDaysInPeriod = (int) java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
            long dailyMinutes = 0;
            
            if (facility.getOpenTime() != null && facility.getCloseTime() != null) {
                java.time.LocalTime openTime = facility.getOpenTime();
                java.time.LocalTime closeTime = facility.getCloseTime();
                
                // closeTime이 openTime보다 작거나 같으면 다음날 자정으로 간주
                if (closeTime.isBefore(openTime) || closeTime.equals(openTime)) {
                    // 다음날 자정까지의 시간 계산: (24시간 - openTime) + closeTime
                    // 예: 08:00 ~ 00:00 = (24*60 - 8*60) + 0 = 16*60 = 960분
                    long minutesFromMidnightToOpen = openTime.toSecondOfDay() / 60;
                    long minutesFromMidnightToClose = closeTime.toSecondOfDay() / 60;
                    dailyMinutes = (24 * 60) - minutesFromMidnightToOpen + minutesFromMidnightToClose;
                } else {
                    dailyMinutes = java.time.Duration.between(openTime, closeTime).toMinutes();
                }
                
                totalAvailableMinutes = dailyMinutes * totalDaysInPeriod;
                logger.info("시설 {} - 운영 시간: {} ~ {}, 일수: {}, 일일 운영 시간(분): {}, 총 운영 시간(분): {}", 
                    facility.getName(), openTime, closeTime, totalDaysInPeriod, dailyMinutes, totalAvailableMinutes);
            } else {
                // 운영 시간이 설정되지 않은 경우, 기본값으로 24시간 사용
                dailyMinutes = 24 * 60; // 하루 24시간 = 1440분
                totalAvailableMinutes = dailyMinutes * totalDaysInPeriod;
                logger.info("시설 {} - 운영 시간 미설정, 기본값 24시간 사용, 일수: {}, 총 운영 시간(분): {}", 
                    facility.getName(), totalDaysInPeriod, totalAvailableMinutes);
            }
            
            // 가동률 계산 (%)
            double utilizationRate = 0.0;
            if (totalAvailableMinutes > 0) {
                utilizationRate = (double) totalBookedMinutes / totalAvailableMinutes * 100.0;
            } else {
                logger.warn("시설 {} - 운영 가능 시간이 0입니다. 가동률 계산 불가", facility.getName());
            }
            
            // 디버깅 로그 (모든 시설에 대해 상세 정보 출력)
            logger.info("시설 가동률 계산 - 시설: {}, 예약 수: {}, 예약 시간(분): {}, 운영 가능 시간(분): {}, 가동률: {}%", 
                facility.getName(), facilityBookings.size(), totalBookedMinutes, totalAvailableMinutes, utilizationRate);
            
            // 예약이 있는데 가동률이 0인 경우 상세 로그
            if (facilityBookings.size() > 0 && utilizationRate == 0.0) {
                logger.error("시설 가동률 0 경고 - 시설: {}, 예약 수: {}, 예약 시간(분): {}, 운영 가능 시간(분): {}", 
                    facility.getName(), facilityBookings.size(), totalBookedMinutes, totalAvailableMinutes);
                // 예약 상세 정보 로그
                for (Booking booking : facilityBookings) {
                    try {
                        logger.error("  - 예약 ID: {}, 상태: {}, 시작: {}, 종료: {}, 시설 ID: {}", 
                            booking.getId(), booking.getStatus(), booking.getStartTime(), booking.getEndTime(),
                            booking.getFacility() != null ? booking.getFacility().getId() : "null");
                    } catch (Exception e) {
                        logger.error("  - 예약 ID: {} 로그 출력 실패: {}", booking.getId(), e.getMessage());
                    }
                }
            }
            
            // 모든 활성 시설 표시 (가동률이 0이어도 표시)
            if (facility.getActive() != null && facility.getActive()) {
                Map<String, Object> facilityData = new HashMap<>();
                facilityData.put("label", facility.getName() + (facility.getLocation() != null ? " (" + facility.getLocation() + ")" : ""));
                facilityData.put("value", Math.round(utilizationRate * 10.0) / 10.0); // 소수점 첫째 자리까지
                facilityData.put("percentage", Math.min(utilizationRate, 100.0));
                facilityData.put("bookedMinutes", totalBookedMinutes);
                facilityData.put("availableMinutes", totalAvailableMinutes);
                facilityData.put("totalDays", totalDaysInPeriod);
                facilityData.put("usedDays", usedDays);
                facilityData.put("bookingCount", facilityBookings.size());
                facilityData.put("totalHours", Math.round(totalBookedMinutes / 60.0 * 10.0) / 10.0); // 시간 단위로 변환
                facilityData.put("availableHours", Math.round(totalAvailableMinutes / 60.0 * 10.0) / 10.0); // 시간 단위로 변환
                
                // 시간대별 통계 (시간대별 예약 횟수와 시간)
                List<Map<String, Object>> hourlyStats = new ArrayList<>();
                for (int hour = 0; hour < 24; hour++) {
                    long count = hourlyBookingCount.getOrDefault(hour, 0L);
                    long minutes = hourlyBookingMinutes.getOrDefault(hour, 0L);
                    if (count > 0 || minutes > 0) {
                        Map<String, Object> hourData = new HashMap<>();
                        hourData.put("hour", hour);
                        hourData.put("label", String.format("%02d:00", hour));
                        hourData.put("count", count);
                        hourData.put("minutes", minutes);
                        hourData.put("hours", Math.round(minutes / 60.0 * 10.0) / 10.0);
                        hourlyStats.add(hourData);
                    }
                }
                // 시간대별로 정렬
                hourlyStats.sort((a, b) -> Integer.compare((Integer) a.get("hour"), (Integer) b.get("hour")));
                facilityData.put("hourlyStats", hourlyStats);
                
                facilityUtilization.add(facilityData);
            }
        }
        metrics.put("facilityUtilization", facilityUtilization);
        
        // 시간대별 수요 계산 (0시~23시)
        Map<Integer, Long> hourlyDemand = new HashMap<>();
        
        // 확정/완료 예약만 집계
        for (Booking booking : bookings) {
            if ((booking.getStatus() == Booking.BookingStatus.CONFIRMED || 
                 booking.getStatus() == Booking.BookingStatus.COMPLETED) &&
                booking.getStartTime() != null) {
                int hour = booking.getStartTime().getHour();
                hourlyDemand.put(hour, hourlyDemand.getOrDefault(hour, 0L) + 1);
            }
        }
        
        // 차트용 데이터 형식으로 변환 (값이 0보다 큰 시간대만 포함)
        List<Map<String, Object>> hourlyDemandList = new ArrayList<>();
        if (!hourlyDemand.isEmpty()) {
            long maxDemand = hourlyDemand.values().stream().mapToLong(Long::longValue).max().orElse(0L);
            
            // 시간대별로 정렬하여 추가 (값이 있는 것만)
            List<Integer> sortedHours = new ArrayList<>(hourlyDemand.keySet());
            sortedHours.sort(Integer::compareTo);
            
            for (int hour : sortedHours) {
                long count = hourlyDemand.get(hour);
                if (count > 0) { // 값이 0보다 큰 경우만 추가
                    Map<String, Object> hourData = new HashMap<>();
                    hourData.put("label", String.format("%02d:00", hour));
                    hourData.put("value", count);
                    hourData.put("percentage", maxDemand > 0 ? (count * 100.0 / maxDemand) : 0.0);
                    hourlyDemandList.add(hourData);
                }
            }
        }
        metrics.put("hourlyDemand", hourlyDemandList);
        
        return metrics;
    }
    
    private Map<String, Object> calculateRevenueMetrics(List<Payment> payments, LocalDate start, LocalDate end) {
        Map<String, Object> revenue = new HashMap<>();
        
        // 기간 일수 계산
        long periodDays = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        
        // 전월 동일 기간 계산
        LocalDate prevStart = start.minusMonths(1);
        LocalDate prevEnd = end.minusMonths(1);
        LocalDateTime prevStartDateTime = prevStart.atStartOfDay();
        LocalDateTime prevEndDateTime = prevEnd.atTime(LocalTime.MAX);
        
        // 전월 결제 데이터 조회
        List<Payment> prevPayments = paymentRepository.findAllWithCoach().stream()
                .filter(p -> p.getPaidAt() != null && 
                           !p.getPaidAt().isBefore(prevStartDateTime) && 
                           !p.getPaidAt().isAfter(prevEndDateTime))
                .collect(Collectors.toList());
        
        // 전월 카테고리별 매출 계산
        Map<String, Integer> prevByCategory = new HashMap<>();
        for (Payment payment : prevPayments) {
            if (payment.getCategory() != null) {
                String category = payment.getCategory().name();
                int amount = payment.getAmount() != null ? payment.getAmount() : 0;
                int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
                int netAmount = amount - refund;
                
                prevByCategory.put(category, prevByCategory.getOrDefault(category, 0) + netAmount);
            }
        }
        
        // 카테고리별 매출
        Map<String, Integer> byCategory = new HashMap<>();
        Map<String, Map<String, Integer>> categoryCoachRevenue = new HashMap<>(); // 카테고리별 코치별 매출
        Map<LocalDate, Integer> dailyRevenue = new HashMap<>(); // 일별 매출 (최고 매출일 찾기용)
        
        for (Payment payment : payments) {
            if (payment.getCategory() != null) {
                String category = payment.getCategory().name();
                int amount = payment.getAmount() != null ? payment.getAmount() : 0;
                int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
                int netAmount = amount - refund;
                
                byCategory.put(category, byCategory.getOrDefault(category, 0) + netAmount);
                
                // 코치별 매출 집계 (카테고리별)
                com.afbscenter.model.Coach coach = null;
                try {
                    if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                        coach = payment.getBooking().getCoach();
                    } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
                        coach = payment.getMember().getCoach();
                    }
                } catch (Exception e) {
                    logger.debug("코치 정보 로드 실패: Payment ID={}", payment.getId(), e);
                }
                
                String coachName = (coach != null && coach.getName() != null) ? coach.getName() : "미지정";
                if (!categoryCoachRevenue.containsKey(category)) {
                    categoryCoachRevenue.put(category, new HashMap<>());
                }
                categoryCoachRevenue.get(category).put(coachName, 
                    categoryCoachRevenue.get(category).getOrDefault(coachName, 0) + netAmount);
                
                // 일별 매출 집계
                if (payment.getPaidAt() != null) {
                    LocalDate date = payment.getPaidAt().toLocalDate();
                    dailyRevenue.put(date, dailyRevenue.getOrDefault(date, 0) + netAmount);
                }
            }
        }
        
        // 카테고리 한글 변환 함수
        java.util.function.Function<String, String> getCategoryKorean = (category) -> {
            if (category == null) return "기타";
            switch (category) {
                case "RENTAL":
                    return "대관";
                case "LESSON":
                    return "레슨";
                case "PRODUCT_SALE":
                    return "상품판매";
                default:
                    return category;
            }
        };
        
        // 차트용 데이터 형식으로 변환
        List<Map<String, Object>> byCategoryList = new ArrayList<>();
        int totalRevenue = byCategory.values().stream().mapToInt(Integer::intValue).sum();
        
        // 최고 매출일 찾기
        LocalDate bestRevenueDate = null;
        int bestRevenueAmount = 0;
        for (Map.Entry<LocalDate, Integer> entry : dailyRevenue.entrySet()) {
            if (entry.getValue() > bestRevenueAmount) {
                bestRevenueAmount = entry.getValue();
                bestRevenueDate = entry.getKey();
            }
        }
        
        // 평균 일일 매출
        double avgDailyRevenue = periodDays > 0 ? (double) totalRevenue / periodDays : 0.0;
        
        for (Map.Entry<String, Integer> entry : byCategory.entrySet()) {
            String category = entry.getKey();
            int currentAmount = entry.getValue();
            int prevAmount = prevByCategory.getOrDefault(category, 0);
            
            // 전월 대비 증감률 계산
            double changeRate = 0.0;
            int changeAmount = currentAmount - prevAmount;
            if (prevAmount > 0) {
                changeRate = ((double) changeAmount / prevAmount) * 100.0;
            } else if (currentAmount > 0) {
                changeRate = 100.0; // 전월 0원, 이번 달 매출 있음
            }
            
            // 카테고리별 평균 일일 매출
            double categoryAvgDaily = periodDays > 0 ? (double) currentAmount / periodDays : 0.0;
            
            // 카테고리별 코치별 기여도 (상위 3명)
            List<Map<String, Object>> topCoaches = new ArrayList<>();
            if (categoryCoachRevenue.containsKey(category)) {
                Map<String, Integer> coachRevenues = categoryCoachRevenue.get(category);
                List<Map.Entry<String, Integer>> sortedCoaches = new ArrayList<>(coachRevenues.entrySet());
                sortedCoaches.sort((a, b) -> Integer.compare(b.getValue(), a.getValue()));
                
                for (int i = 0; i < Math.min(3, sortedCoaches.size()); i++) {
                    Map.Entry<String, Integer> coachEntry = sortedCoaches.get(i);
                    Map<String, Object> coachData = new HashMap<>();
                    coachData.put("name", coachEntry.getKey());
                    coachData.put("amount", coachEntry.getValue());
                    coachData.put("percentage", currentAmount > 0 ? (coachEntry.getValue() * 100.0 / currentAmount) : 0.0);
                    topCoaches.add(coachData);
                }
            }
            
            Map<String, Object> item = new HashMap<>();
            item.put("label", getCategoryKorean.apply(category)); // 한글로 변환
            item.put("value", currentAmount);
            item.put("percentage", totalRevenue > 0 ? (currentAmount * 100.0 / totalRevenue) : 0.0);
            item.put("prevAmount", prevAmount);
            item.put("changeRate", changeRate);
            item.put("changeAmount", changeAmount);
            item.put("avgDailyRevenue", categoryAvgDaily);
            item.put("topCoaches", topCoaches);
            byCategoryList.add(item);
        }
        
        revenue.put("byCategory", byCategoryList);
        revenue.put("totalRevenue", totalRevenue);
        revenue.put("avgDailyRevenue", avgDailyRevenue);
        revenue.put("bestRevenueDate", bestRevenueDate != null ? bestRevenueDate.toString() : null);
        revenue.put("bestRevenueAmount", bestRevenueAmount);
        revenue.put("periodDays", periodDays);
        
        // 코치별 매출
        Map<String, Integer> byCoach = new HashMap<>();
        for (Payment payment : payments) {
            // 코치 정보 가져오기 (예약의 코치 우선, 없으면 회원의 담당 코치)
            com.afbscenter.model.Coach coach = null;
            try {
                if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                    coach = payment.getBooking().getCoach();
                } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
                    coach = payment.getMember().getCoach();
                }
            } catch (Exception e) {
                logger.warn("코치 정보 로드 실패: Payment ID={}", payment.getId(), e);
            }
            
            String coachName = (coach != null && coach.getName() != null) ? coach.getName() : "미지정";
            int amount = payment.getAmount() != null ? payment.getAmount() : 0;
            int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
            int netAmount = amount - refund;
            
            byCoach.put(coachName, byCoach.getOrDefault(coachName, 0) + netAmount);
        }
        
        // 코치별 매출 차트용 데이터 형식으로 변환
        List<Map<String, Object>> byCoachList = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : byCoach.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("label", entry.getKey());
            item.put("value", entry.getValue());
            item.put("percentage", totalRevenue > 0 ? (entry.getValue() * 100.0 / totalRevenue) : 0.0);
            byCoachList.add(item);
        }
        
        // 매출 금액 순으로 정렬
        byCoachList.sort((a, b) -> Integer.compare((Integer) b.get("value"), (Integer) a.get("value")));
        
        revenue.put("byCoach", byCoachList);
        
        // 상품별 매출 (상품명, 판매 횟수, 총 금액, 판매한 코치 정보)
        Map<String, Map<String, Object>> byProduct = new HashMap<>();
        Map<String, Map<String, Integer>> productCoachCount = new HashMap<>(); // 상품별 코치별 판매 횟수
        
        for (Payment payment : payments) {
            if (payment.getCategory() == Payment.PaymentCategory.PRODUCT_SALE && payment.getProduct() != null) {
                try {
                    String productName = payment.getProduct().getName();
                    if (productName == null) continue;
                    
                    // 코치 정보 가져오기
                    com.afbscenter.model.Coach coach = null;
                    try {
                        if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                            coach = payment.getBooking().getCoach();
                        } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
                            coach = payment.getMember().getCoach();
                        }
                    } catch (Exception e) {
                        logger.warn("코치 정보 로드 실패: Payment ID={}", payment.getId(), e);
                    }
                    
                    String coachName = (coach != null && coach.getName() != null) ? coach.getName() : "미지정";
                    
                    int amount = payment.getAmount() != null ? payment.getAmount() : 0;
                    int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
                    int netAmount = amount - refund;
                    
                    // 상품별 매출 집계
                    if (!byProduct.containsKey(productName)) {
                        Map<String, Object> productData = new HashMap<>();
                        productData.put("productName", productName);
                        productData.put("totalAmount", 0);
                        productData.put("count", 0);
                        productData.put("coaches", new HashMap<String, Integer>());
                        byProduct.put(productName, productData);
                        productCoachCount.put(productName, new HashMap<>());
                    }
                    
                    Map<String, Object> productData = byProduct.get(productName);
                    productData.put("totalAmount", (Integer) productData.get("totalAmount") + netAmount);
                    productData.put("count", (Integer) productData.get("count") + 1);
                    
                    // 코치별 판매 횟수 집계
                    Map<String, Integer> coachCount = productCoachCount.get(productName);
                    coachCount.put(coachName, coachCount.getOrDefault(coachName, 0) + 1);
                    
                } catch (Exception e) {
                    logger.warn("상품별 매출 집계 중 오류: Payment ID={}", payment.getId(), e);
                }
            }
        }
        
        // 상품별 매출 데이터 형식으로 변환 (매출 금액 순으로 정렬)
        List<Map<String, Object>> byProductList = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : byProduct.entrySet()) {
            Map<String, Object> productData = entry.getValue();
            Map<String, Integer> coachCount = productCoachCount.get(entry.getKey());
            
            // 코치별 판매 횟수를 리스트로 변환 (판매 횟수 순으로 정렬)
            List<Map<String, Object>> coachList = new ArrayList<>();
            for (Map.Entry<String, Integer> coachEntry : coachCount.entrySet()) {
                Map<String, Object> coachData = new HashMap<>();
                coachData.put("coachName", coachEntry.getKey());
                coachData.put("count", coachEntry.getValue());
                coachList.add(coachData);
            }
            coachList.sort((a, b) -> Integer.compare((Integer) b.get("count"), (Integer) a.get("count")));
            
            Map<String, Object> item = new HashMap<>();
            item.put("productName", entry.getKey());
            item.put("totalAmount", productData.get("totalAmount"));
            item.put("count", productData.get("count"));
            item.put("coaches", coachList);
            item.put("percentage", totalRevenue > 0 ? ((Integer) productData.get("totalAmount") * 100.0 / totalRevenue) : 0.0);
            byProductList.add(item);
        }
        
        // 매출 금액 순으로 정렬
        byProductList.sort((a, b) -> Integer.compare((Integer) b.get("totalAmount"), (Integer) a.get("totalAmount")));
        revenue.put("byProduct", byProductList);
        
        // 매출 추이 (일별) - dailyRevenue는 이미 위에서 계산됨
        // 전월 일별 매출 계산
        Map<LocalDate, Integer> prevDailyRevenue = new HashMap<>();
        for (Payment payment : prevPayments) {
            if (payment.getPaidAt() != null) {
                LocalDate date = payment.getPaidAt().toLocalDate();
                int amount = payment.getAmount() != null ? payment.getAmount() : 0;
                int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
                int netAmount = amount - refund;
                
                prevDailyRevenue.put(date, prevDailyRevenue.getOrDefault(date, 0) + netAmount);
            }
        }
        
        // 모든 날짜 포함 (매출이 없는 날도 포함)
        List<LocalDate> allDates = new ArrayList<>();
        LocalDate current = start;
        while (!current.isAfter(end)) {
            allDates.add(current);
            current = current.plusDays(1);
        }
        
        // 전월 동일 기간 날짜 리스트
        List<LocalDate> prevAllDates = new ArrayList<>();
        LocalDate prevCurrent = prevStart;
        while (!prevCurrent.isAfter(prevEnd)) {
            prevAllDates.add(prevCurrent);
            prevCurrent = prevCurrent.plusDays(1);
        }
        
        // 평균 매출 계산
        double avgRevenue = dailyRevenue.values().stream().mapToInt(Integer::intValue).average().orElse(0.0);
        
        // 최고/최저 매출일 찾기
        LocalDate maxDate = null;
        LocalDate minDate = null;
        int maxValue = Integer.MIN_VALUE;
        int minValue = Integer.MAX_VALUE;
        for (Map.Entry<LocalDate, Integer> entry : dailyRevenue.entrySet()) {
            if (entry.getValue() > maxValue) {
                maxValue = entry.getValue();
                maxDate = entry.getKey();
            }
            if (entry.getValue() < minValue && entry.getValue() > 0) {
                minValue = entry.getValue();
                minDate = entry.getKey();
            }
        }
        
        // 요일별 패턴 계산
        Map<String, List<Integer>> weekdayRevenue = new HashMap<>();
        Map<String, String> weekdayKorean = new HashMap<>();
        weekdayKorean.put("MONDAY", "월요일");
        weekdayKorean.put("TUESDAY", "화요일");
        weekdayKorean.put("WEDNESDAY", "수요일");
        weekdayKorean.put("THURSDAY", "목요일");
        weekdayKorean.put("FRIDAY", "금요일");
        weekdayKorean.put("SATURDAY", "토요일");
        weekdayKorean.put("SUNDAY", "일요일");
        
        for (Map.Entry<LocalDate, Integer> entry : dailyRevenue.entrySet()) {
            String weekday = entry.getKey().getDayOfWeek().name();
            if (!weekdayRevenue.containsKey(weekday)) {
                weekdayRevenue.put(weekday, new ArrayList<>());
            }
            weekdayRevenue.get(weekday).add(entry.getValue());
        }
        
        List<Map<String, Object>> weekdayPattern = new ArrayList<>();
        for (Map.Entry<String, List<Integer>> entry : weekdayRevenue.entrySet()) {
            double avg = entry.getValue().stream().mapToInt(Integer::intValue).average().orElse(0.0);
            Map<String, Object> weekdayData = new HashMap<>();
            weekdayData.put("weekday", weekdayKorean.get(entry.getKey()));
            weekdayData.put("avgRevenue", avg);
            weekdayData.put("count", entry.getValue().size());
            weekdayPattern.add(weekdayData);
        }
        weekdayPattern.sort((a, b) -> {
            String[] order = {"월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"};
            int aIndex = java.util.Arrays.asList(order).indexOf(a.get("weekday"));
            int bIndex = java.util.Arrays.asList(order).indexOf(b.get("weekday"));
            return Integer.compare(aIndex, bIndex);
        });
        
        // 매출 추이 데이터 생성 (누적 매출 포함)
        List<Map<String, Object>> trend = new ArrayList<>();
        int cumulativeRevenue = 0;
        Integer prevValue = null;
        
        for (LocalDate date : allDates) {
            int value = dailyRevenue.getOrDefault(date, 0);
            cumulativeRevenue += value;
            
                            // 전월 동일 요일 매출 찾기 (비교용)
                            int prevValueForDate = 0;
                            if (prevAllDates.size() > 0) {
                                // 전월에서 비슷한 위치의 날짜 찾기 (간단히 같은 일자)
                                try {
                                    LocalDate prevDate = prevStart.plusDays(date.getDayOfMonth() - 1);
                                    if (!prevDate.isAfter(prevEnd)) {
                                        prevValueForDate = prevDailyRevenue.getOrDefault(prevDate, 0);
                                    }
                                } catch (Exception e) {
                                    // 날짜 계산 오류 무시
                                }
                            }
            
            // 전일 대비 성장률
            double growthRate = 0.0;
            if (prevValue != null && prevValue > 0) {
                growthRate = ((double)(value - prevValue) / prevValue) * 100.0;
            } else if (value > 0 && prevValue != null && prevValue == 0) {
                growthRate = 100.0; // 전일 0원, 오늘 매출 있음
            }
            
            Map<String, Object> item = new HashMap<>();
            item.put("label", date.toString());
            item.put("value", value);
            item.put("cumulative", cumulativeRevenue);
            item.put("prevValue", prevValueForDate);
            item.put("growthRate", growthRate);
            item.put("isMax", date.equals(maxDate));
            item.put("isMin", date.equals(minDate));
            trend.add(item);
            
            prevValue = value;
        }
        
        revenue.put("trend", trend);
        revenue.put("trendAvg", avgRevenue);
        revenue.put("trendMaxDate", maxDate != null ? maxDate.toString() : null);
        revenue.put("trendMaxValue", maxValue > Integer.MIN_VALUE ? maxValue : 0);
        revenue.put("trendMinDate", minDate != null ? minDate.toString() : null);
        revenue.put("trendMinValue", minValue < Integer.MAX_VALUE ? minValue : 0);
        revenue.put("weekdayPattern", weekdayPattern);
        
        return revenue;
    }
    
    private Map<String, Object> calculateMemberMetrics(List<Member> members, LocalDate start, LocalDate end) {
        Map<String, Object> metrics = new HashMap<>();
        
        // 활성 회원 수
        long activeCount = members.stream()
                .filter(m -> m != null && m.getStatus() == Member.MemberStatus.ACTIVE)
                .count();
        
        metrics.put("activeCount", activeCount);
        
        // 회원 추이 (가입일 기준 신규, updatedAt 기준 이탈)
        Map<LocalDate, Long> dailyNewMembers = new HashMap<>();
        Map<LocalDate, Long> dailyWithdrawnMembers = new HashMap<>();
        
        for (Member member : members) {
            if (member == null) continue;
            
            // 신규 회원 (가입일 기준)
            if (member.getJoinDate() != null) {
                LocalDate joinDate = member.getJoinDate();
                if (!joinDate.isBefore(start) && !joinDate.isAfter(end)) {
                    dailyNewMembers.put(joinDate, dailyNewMembers.getOrDefault(joinDate, 0L) + 1);
                }
            }
            
            // 이탈 회원 (상태가 WITHDRAWN이고 updatedAt이 있는 경우)
            if (member.getStatus() == Member.MemberStatus.WITHDRAWN && member.getUpdatedAt() != null) {
                LocalDate withdrawnDate = member.getUpdatedAt().toLocalDate();
                if (!withdrawnDate.isBefore(start) && !withdrawnDate.isAfter(end)) {
                    dailyWithdrawnMembers.put(withdrawnDate, dailyWithdrawnMembers.getOrDefault(withdrawnDate, 0L) + 1);
                }
            }
        }
        
        // 모든 날짜에 대해 신규/이탈 데이터 생성
        Set<LocalDate> allDates = new HashSet<>();
        allDates.addAll(dailyNewMembers.keySet());
        allDates.addAll(dailyWithdrawnMembers.keySet());
        
        // 날짜 범위의 모든 날짜 포함
        LocalDate current = start;
        while (!current.isAfter(end)) {
            allDates.add(current);
            current = current.plusDays(1);
        }
        
        List<LocalDate> sortedDates = new ArrayList<>(allDates);
        sortedDates.sort(LocalDate::compareTo);
        
        List<Map<String, Object>> trend = new ArrayList<>();
        for (LocalDate date : sortedDates) {
            long newCount = dailyNewMembers.getOrDefault(date, 0L);
            long withdrawnCount = dailyWithdrawnMembers.getOrDefault(date, 0L);
            
            // 신규나 이탈이 있는 날짜만 표시
            if (newCount > 0 || withdrawnCount > 0) {
                Map<String, Object> item = new HashMap<>();
                item.put("label", date.toString());
                item.put("newCount", newCount);
                item.put("withdrawnCount", withdrawnCount);
                item.put("netChange", newCount - withdrawnCount); // 순증감
                trend.add(item);
            }
        }
        
        metrics.put("trend", trend);
        
        return metrics;
    }
}
