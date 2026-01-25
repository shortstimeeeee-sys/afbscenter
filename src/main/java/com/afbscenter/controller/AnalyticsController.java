package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Facility;
import com.afbscenter.model.Member;
import com.afbscenter.model.Payment;
import com.afbscenter.model.Settings;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.SettingsRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
public class AnalyticsController {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsController.class);

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final FacilityRepository facilityRepository;
    private final MemberService memberService;
    private final SettingsRepository settingsRepository;

    public AnalyticsController(BookingRepository bookingRepository,
                               PaymentRepository paymentRepository,
                               MemberRepository memberRepository,
                               MemberProductRepository memberProductRepository,
                               FacilityRepository facilityRepository,
                               MemberService memberService,
                               SettingsRepository settingsRepository) {
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.facilityRepository = facilityRepository;
        this.memberService = memberService;
        this.settingsRepository = settingsRepository;
    }
    
    /**
     * Settings에서 기본 세션 시간을 가져옵니다. 없으면 상수 기본값을 사용합니다.
     */
    private int getDefaultSessionDuration() {
        try {
            List<Settings> settingsList = settingsRepository.findAll();
            if (!settingsList.isEmpty()) {
                Settings settings = settingsList.get(0);
                if (settings.getDefaultSessionDuration() != null && settings.getDefaultSessionDuration() > 0) {
                    return settings.getDefaultSessionDuration();
                }
            }
        } catch (Exception e) {
            logger.warn("Settings에서 기본 세션 시간 조회 실패, 상수 기본값 사용: {}", e.getMessage());
        }
        return com.afbscenter.constants.BookingDefaults.DEFAULT_BOOKING_MINUTES;
    }

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
            
            logger.info("Analytics 조회 - 기간: {} ~ {}, period: {}, startDateTime: {}, endDateTime: {}", 
                start, end, period, startDateTime, endDateTime);
            
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
            List<Payment> allPayments = paymentRepository.findAllWithCoach();
            logger.info("전체 결제 데이터 조회 완료 - 총 {}건", allPayments.size());
            
            // 전체 결제 데이터 상세 로그 (처음 10개)
            if (!allPayments.isEmpty()) {
                logger.info("전체 결제 데이터 샘플 (처음 10개):");
                for (int i = 0; i < Math.min(10, allPayments.size()); i++) {
                    Payment p = allPayments.get(i);
                    logger.info("  결제 #{}: ID={}, Amount={}, Category={}, Status={}, PaidAt={}, Product={}, Booking={}, Member={}", 
                        i + 1, p.getId(), p.getAmount(), p.getCategory(), p.getStatus(), 
                        p.getPaidAt(), p.getProduct() != null ? p.getProduct().getId() : null,
                        p.getBooking() != null ? p.getBooking().getId() : null,
                        p.getMember() != null ? p.getMember().getId() : null);
                }
            }
            
            // 필터링 적용
            List<Payment> payments = allPayments.stream()
                    .filter(p -> {
                        boolean hasPaidAt = p.getPaidAt() != null;
                        boolean inDateRange = hasPaidAt && 
                                           !p.getPaidAt().isBefore(startDateTime) && 
                                           !p.getPaidAt().isAfter(endDateTime);
                        boolean isCompleted = p.getStatus() == null || p.getStatus() == Payment.PaymentStatus.COMPLETED;
                        
                        if (!hasPaidAt) {
                            logger.debug("결제 필터링 제외 (paidAt null): Payment ID={}", p.getId());
                        } else if (!inDateRange) {
                            logger.debug("결제 필터링 제외 (날짜 범위 밖): Payment ID={}, PaidAt={}, 기간: {} ~ {}", 
                                p.getId(), p.getPaidAt(), startDateTime, endDateTime);
                        } else if (!isCompleted) {
                            logger.debug("결제 필터링 제외 (상태): Payment ID={}, Status={}", p.getId(), p.getStatus());
                        }
                        
                        return hasPaidAt && inDateRange && isCompleted;
                    })
                    .collect(Collectors.toList());
            
            logger.info("Analytics 결제 데이터 조회 - 기간: {} ~ {} ({} ~ {}), 필터링 후 결제 수: {}건", 
                start, end, startDateTime, endDateTime, payments.size());
            
            // 필터링된 결제 데이터 상세 로그 (처음 5개만)
            if (!payments.isEmpty()) {
                logger.info("필터링된 결제 데이터 샘플 (처음 5개):");
                for (int i = 0; i < Math.min(5, payments.size()); i++) {
                    Payment p = payments.get(i);
                    logger.info("  결제 #{}: ID={}, Amount={}, Category={}, Status={}, PaidAt={}, Product={}, Booking={}", 
                        i + 1, p.getId(), p.getAmount(), p.getCategory(), p.getStatus(), 
                        p.getPaidAt(), p.getProduct() != null ? p.getProduct().getId() : null,
                        p.getBooking() != null ? p.getBooking().getId() : null);
                }
            }
            
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
            // 해당 시설의 예약 필터링 (확정/완료/대기 상태 모두 포함, 취소/노쇼 제외)
            List<Booking> facilityBookings = bookings.stream()
                    .filter(b -> {
                        try {
                            if (b.getFacility() == null) return false;
                            // LAZY 로딩된 facility의 ID를 안전하게 비교
                            Long facilityId = b.getFacility().getId();
                            boolean matches = facilityId != null && facilityId.equals(facility.getId()) &&
                                           (b.getStatus() == Booking.BookingStatus.CONFIRMED || 
                                            b.getStatus() == Booking.BookingStatus.COMPLETED ||
                                            b.getStatus() == Booking.BookingStatus.PENDING);
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
                        
                        // 예약 시간이 0이거나 음수인 경우 기본값 사용
                        if (minutes <= 0) {
                            int defaultMinutes = getDefaultSessionDuration();
                            logger.warn("예약 시간이 0이거나 음수입니다 - Booking ID: {}, 시작: {}, 종료: {}, 계산된 분: {}. 기본값 {}분 사용", 
                                booking.getId(), booking.getStartTime(), booking.getEndTime(), minutes, defaultMinutes);
                            minutes = defaultMinutes;
                        }
                        totalBookedMinutes += minutes;
                        
                        // 시간대별 통계 (시작 시간 기준)
                        int startHour = booking.getStartTime().getHour();
                        hourlyBookingCount.put(startHour, hourlyBookingCount.getOrDefault(startHour, 0L) + 1);
                        hourlyBookingMinutes.put(startHour, hourlyBookingMinutes.getOrDefault(startHour, 0L) + minutes);
                    } else {
                        int defaultMinutes = getDefaultSessionDuration();
                        logger.warn("예약 시간 정보 없음 - Booking ID: {}, 시작: {}, 종료: {}. 기본값 {}분 사용", 
                            booking.getId(), booking.getStartTime(), booking.getEndTime(), defaultMinutes);
                        totalBookedMinutes += defaultMinutes;
                    }
                } catch (Exception e) {
                    int defaultMinutes = getDefaultSessionDuration();
                    logger.warn("예약 시간 계산 중 오류 (Booking ID: {}): {}. 기본값 {}분 사용", booking.getId(), e.getMessage(), e, defaultMinutes);
                    totalBookedMinutes += defaultMinutes;
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
                // 운영 시간이 설정되지 않은 경우, 기본값 사용
                int defaultOperatingHours = com.afbscenter.constants.BookingDefaults.DEFAULT_OPERATING_HOURS;
                dailyMinutes = defaultOperatingHours * 60; // 하루 기본 시간 = 분
                totalAvailableMinutes = dailyMinutes * totalDaysInPeriod;
                logger.info("시설 {} - 운영 시간 미설정, 기본값 {}시간 사용, 일수: {}, 총 운영 시간(분): {}", 
                    facility.getName(), defaultOperatingHours, totalDaysInPeriod, totalAvailableMinutes);
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
        
        // LocalDateTime 변환
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.atTime(LocalTime.MAX);
        
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
            int amount = payment.getAmount() != null ? payment.getAmount() : 0;
            int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
            int netAmount = amount - refund;
            
            // 카테고리 결정: 명시적으로 설정된 경우 우선, 없으면 자동 판단
            String category = null;
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
                        logger.debug("예약 정보 로드 실패: Payment ID={}", payment.getId(), e);
                    }
                }
                
                if (category == null && payment.getProduct() != null) {
                    category = "PRODUCT_SALE";
                }
                
                if (category == null) {
                    category = "OTHER";
                }
            }
            
            prevByCategory.put(category, prevByCategory.getOrDefault(category, 0) + netAmount);
        }
        
        // 카테고리별 매출
        Map<String, Integer> byCategory = new HashMap<>();
        Map<String, Map<String, Integer>> categoryCoachRevenue = new HashMap<>(); // 카테고리별 코치별 매출
        Map<LocalDate, Integer> dailyRevenue = new HashMap<>(); // 일별 매출 (최고 매출일 찾기용)
        
        logger.info("매출 지표 계산 시작 - 결제 수: {}건, 기간: {} ~ {}", payments.size(), start, end);
        
        for (Payment payment : payments) {
            int amount = payment.getAmount() != null ? payment.getAmount() : 0;
            int refund = payment.getRefundAmount() != null ? payment.getRefundAmount() : 0;
            int netAmount = amount - refund;
            
            // 카테고리 결정: 명시적으로 설정된 경우 우선, 없으면 자동 판단
            String category = null;
            String productCategory = null; // 상품 카테고리 (야구, 필라테스, 트레이닝 등)
            
            if (payment.getCategory() != null) {
                category = payment.getCategory().name();
            } else {
                // 카테고리 자동 판단
                if (payment.getBooking() != null) {
                    // 예약이 있으면 목적에 따라 판단
                    try {
                        com.afbscenter.model.Booking booking = payment.getBooking();
                        if (booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL) {
                            category = "RENTAL";
                        } else if (booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.LESSON) {
                            category = "LESSON";
                        }
                    } catch (Exception e) {
                        logger.debug("예약 정보 로드 실패: Payment ID={}", payment.getId(), e);
                    }
                }
                
                // Product가 있으면 상품판매로 판단
                if (category == null && payment.getProduct() != null) {
                    category = "PRODUCT_SALE";
                    try {
                        com.afbscenter.model.Product product = payment.getProduct();
                        if (product.getCategory() != null) {
                            productCategory = product.getCategory().name();
                        }
                    } catch (Exception e) {
                        logger.debug("상품 정보 로드 실패: Payment ID={}", payment.getId(), e);
                    }
                }
                
                // 여전히 null이면 기타로 처리
                if (category == null) {
                    category = "OTHER";
                }
            }
            
            // 상품 카테고리가 있으면 "상품판매 - {상품카테고리}" 형식으로 저장
            String finalCategory = category;
            if (category.equals("PRODUCT_SALE") && productCategory != null) {
                finalCategory = "PRODUCT_SALE_" + productCategory;
            }
            
            byCategory.put(finalCategory, byCategory.getOrDefault(finalCategory, 0) + netAmount);
            
            logger.debug("결제 카테고리 분류 - Payment ID: {}, Category: {}, Amount: {}, NetAmount: {}", 
                payment.getId(), category, amount, netAmount);
            
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
            if (!categoryCoachRevenue.containsKey(finalCategory)) {
                categoryCoachRevenue.put(finalCategory, new HashMap<>());
            }
            categoryCoachRevenue.get(finalCategory).put(coachName, 
                categoryCoachRevenue.get(finalCategory).getOrDefault(coachName, 0) + netAmount);
            
            // 일별 매출 집계
            if (payment.getPaidAt() != null) {
                LocalDate date = payment.getPaidAt().toLocalDate();
                dailyRevenue.put(date, dailyRevenue.getOrDefault(date, 0) + netAmount);
            }
        }
        
        // 상품 카테고리 한글 변환 함수 (먼저 정의)
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
        
        // 카테고리 한글 변환 함수
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
        
        // 매출 금액 기준으로 내림차순 정렬 (많이 판 카테고리가 위쪽)
        byCategoryList.sort((a, b) -> {
            Integer amountA = (Integer) a.get("value");
            Integer amountB = (Integer) b.get("value");
            if (amountA == null) amountA = 0;
            if (amountB == null) amountB = 0;
            return Integer.compare(amountB, amountA); // 내림차순
        });
        
        // Payment 데이터가 없으면 MemberProduct 기반으로 매출 계산
        if (byCategoryList.isEmpty() && payments.isEmpty()) {
            logger.warn("Payment 데이터가 없습니다. MemberProduct 기반으로 매출 계산 시작. 기간: {} ~ {}", start, end);
            
            try {
                // 기간 내의 모든 MemberProduct 조회
                List<com.afbscenter.model.MemberProduct> memberProducts = memberProductRepository.findAll().stream()
                        .filter(mp -> {
                            if (mp.getPurchaseDate() == null) return false;
                            LocalDateTime purchaseDateTime = mp.getPurchaseDate();
                            return !purchaseDateTime.isBefore(startDateTime) && !purchaseDateTime.isAfter(endDateTime);
                        })
                        .collect(Collectors.toList());
                
                logger.info("MemberProduct 기반 매출 계산 - 기간 내 MemberProduct 수: {}건", memberProducts.size());
                
                // MemberProduct 기반으로 카테고리별 매출 계산
                Map<String, Integer> memberProductByCategory = new HashMap<>();
                Map<LocalDate, Integer> memberProductDailyRevenue = new HashMap<>();
                
                for (com.afbscenter.model.MemberProduct mp : memberProducts) {
                    try {
                        com.afbscenter.model.Product product = mp.getProduct();
                        if (product == null || product.getPrice() == null || product.getPrice() <= 0) {
                            continue;
                        }
                        
                        int amount = product.getPrice();
                        String category = "PRODUCT_SALE"; // MemberProduct는 모두 상품판매
                        
                        // 상품 카테고리가 있으면 "PRODUCT_SALE_{상품카테고리}" 형식으로 저장
                        String finalCategory = category;
                        if (product.getCategory() != null) {
                            finalCategory = "PRODUCT_SALE_" + product.getCategory().name();
                        }
                        
                        memberProductByCategory.put(finalCategory, 
                            memberProductByCategory.getOrDefault(finalCategory, 0) + amount);
                        
                        // 일별 매출 집계
                        if (mp.getPurchaseDate() != null) {
                            LocalDate date = mp.getPurchaseDate().toLocalDate();
                            memberProductDailyRevenue.put(date, 
                                memberProductDailyRevenue.getOrDefault(date, 0) + amount);
                        }
                    } catch (Exception e) {
                        logger.debug("MemberProduct 처리 중 오류: MemberProduct ID={}, 오류: {}", 
                            mp.getId(), e.getMessage());
                    }
                }
                
                // 전월 MemberProduct 기반 매출 계산
                Map<String, Integer> prevMemberProductByCategory = new HashMap<>();
                List<com.afbscenter.model.MemberProduct> prevMemberProducts = memberProductRepository.findAll().stream()
                        .filter(mp -> {
                            if (mp.getPurchaseDate() == null) return false;
                            LocalDateTime purchaseDateTime = mp.getPurchaseDate();
                            return !purchaseDateTime.isBefore(prevStartDateTime) && 
                                   !purchaseDateTime.isAfter(prevEndDateTime);
                        })
                        .collect(Collectors.toList());
                
                for (com.afbscenter.model.MemberProduct mp : prevMemberProducts) {
                    try {
                        com.afbscenter.model.Product product = mp.getProduct();
                        if (product == null || product.getPrice() == null || product.getPrice() <= 0) {
                            continue;
                        }
                        String category = "PRODUCT_SALE";
                        
                        // 상품 카테고리가 있으면 "PRODUCT_SALE_{상품카테고리}" 형식으로 저장
                        String finalCategory = category;
                        if (product.getCategory() != null) {
                            finalCategory = "PRODUCT_SALE_" + product.getCategory().name();
                        }
                        
                        prevMemberProductByCategory.put(finalCategory, 
                            prevMemberProductByCategory.getOrDefault(finalCategory, 0) + product.getPrice());
                    } catch (Exception e) {
                        // 무시
                    }
                }
                
                // MemberProduct 기반 매출을 byCategoryList에 추가
                int memberProductTotalRevenue = memberProductByCategory.values().stream()
                        .mapToInt(Integer::intValue).sum();
                
                for (Map.Entry<String, Integer> entry : memberProductByCategory.entrySet()) {
                    String category = entry.getKey();
                    int currentAmount = entry.getValue();
                    int prevAmount = prevMemberProductByCategory.getOrDefault(category, 0);
                    
                    // 전월 대비 증감률 계산
                    double changeRate = 0.0;
                    int changeAmount = currentAmount - prevAmount;
                    if (prevAmount > 0) {
                        changeRate = ((double) changeAmount / prevAmount) * 100.0;
                    } else if (currentAmount > 0) {
                        changeRate = 100.0;
                    }
                    
                    // 카테고리별 평균 일일 매출
                    double categoryAvgDaily = periodDays > 0 ? (double) currentAmount / periodDays : 0.0;
                    
                    Map<String, Object> item = new HashMap<>();
                    item.put("label", getCategoryKorean.apply(category));
                    item.put("value", currentAmount);
                    item.put("percentage", memberProductTotalRevenue > 0 ? 
                        (currentAmount * 100.0 / memberProductTotalRevenue) : 0.0);
                    item.put("prevAmount", prevAmount);
                    item.put("changeRate", changeRate);
                    item.put("changeAmount", changeAmount);
                    item.put("avgDailyRevenue", categoryAvgDaily);
                    item.put("topCoaches", new ArrayList<>()); // MemberProduct에는 코치 정보가 없으므로 빈 리스트
                    byCategoryList.add(item);
                }
                
                // 매출 금액 기준으로 내림차순 정렬 (많이 판 카테고리가 위쪽)
                byCategoryList.sort((a, b) -> {
                    Integer amountA = (Integer) a.get("value");
                    Integer amountB = (Integer) b.get("value");
                    if (amountA == null) amountA = 0;
                    if (amountB == null) amountB = 0;
                    return Integer.compare(amountB, amountA); // 내림차순
                });
                
                // 일별 매출 업데이트
                for (Map.Entry<LocalDate, Integer> entry : memberProductDailyRevenue.entrySet()) {
                    LocalDate date = entry.getKey();
                    int amount = entry.getValue();
                    dailyRevenue.put(date, dailyRevenue.getOrDefault(date, 0) + amount);
                }
                
                // 총 매출 업데이트
                totalRevenue = memberProductTotalRevenue;
                
                // 최고 매출일 업데이트
                for (Map.Entry<LocalDate, Integer> entry : dailyRevenue.entrySet()) {
                    if (entry.getValue() > bestRevenueAmount) {
                        bestRevenueAmount = entry.getValue();
                        bestRevenueDate = entry.getKey();
                    }
                }
                
                // 평균 일일 매출 업데이트
                avgDailyRevenue = periodDays > 0 ? (double) totalRevenue / periodDays : 0.0;
                
                logger.info("✅ MemberProduct 기반 카테고리별 매출 집계 완료 - 총 {}개 카테고리, 총 매출: {}", 
                    byCategoryList.size(), totalRevenue);
                for (Map<String, Object> item : byCategoryList) {
                    logger.info("  - {}: {}", item.get("label"), item.get("value"));
                }
            } catch (Exception e) {
                logger.error("MemberProduct 기반 매출 계산 중 오류 발생: {}", e.getMessage(), e);
            }
        } else if (byCategoryList.isEmpty() && !payments.isEmpty()) {
            logger.error("⚠️ 결제 데이터는 있지만 카테고리별 매출이 없습니다! 결제 수: {}건", payments.size());
            logger.error("⚠️ byCategory 맵 내용: {}", byCategory);
            for (Payment p : payments) {
                logger.error("⚠️ 결제 정보 - ID: {}, Amount: {}, Category: {}, Status: {}, Booking: {}, Product: {}, PaidAt: {}", 
                    p.getId(), p.getAmount(), p.getCategory(), p.getStatus(),
                    p.getBooking() != null ? p.getBooking().getId() : null,
                    p.getProduct() != null ? p.getProduct().getId() : null,
                    p.getPaidAt());
            }
        } else {
            logger.info("✅ 카테고리별 매출 집계 완료 - 총 {}개 카테고리, 총 매출: {}", byCategoryList.size(), totalRevenue);
            for (Map<String, Object> item : byCategoryList) {
                logger.info("  - {}: {}", item.get("label"), item.get("value"));
            }
        }
        
        revenue.put("byCategory", byCategoryList);
        revenue.put("totalRevenue", totalRevenue);
        revenue.put("avgDailyRevenue", avgDailyRevenue);
        revenue.put("bestRevenueDate", bestRevenueDate != null ? bestRevenueDate.toString() : null);
        revenue.put("bestRevenueAmount", bestRevenueAmount);
        revenue.put("periodDays", periodDays);
        
        logger.info("매출 지표 계산 완료 - 총 매출: {}, 카테고리 수: {}, 카테고리별 매출: {}", 
            totalRevenue, byCategoryList.size(), byCategoryList.stream()
                .map(item -> item.get("label") + "=" + item.get("value"))
                .collect(Collectors.joining(", ")));
        
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
        
        // 총 회원 수
        long totalCount = members.size();
        metrics.put("totalCount", totalCount);
        
        // 활성 회원 수
        long activeCount = members.stream()
                .filter(m -> m != null && m.getStatus() == Member.MemberStatus.ACTIVE)
                .count();
        metrics.put("activeCount", activeCount);
        
        // 휴면 회원 수
        long inactiveCount = members.stream()
                .filter(m -> m != null && m.getStatus() == Member.MemberStatus.INACTIVE)
                .count();
        metrics.put("inactiveCount", inactiveCount);
        
        // 이탈 회원 수
        long withdrawnCount = members.stream()
                .filter(m -> m != null && m.getStatus() == Member.MemberStatus.WITHDRAWN)
                .count();
        metrics.put("withdrawnCount", withdrawnCount);
        
        // 기간 내 신규 회원 수
        long newMembersInPeriod = members.stream()
                .filter(m -> m != null && m.getJoinDate() != null)
                .filter(m -> {
                    LocalDate joinDate = m.getJoinDate();
                    return !joinDate.isBefore(start) && !joinDate.isAfter(end);
                })
                .count();
        metrics.put("newMembersInPeriod", newMembersInPeriod);
        
        // 기간 내 이탈 회원 수
        long withdrawnInPeriod = members.stream()
                .filter(m -> m != null && m.getStatus() == Member.MemberStatus.WITHDRAWN && m.getUpdatedAt() != null)
                .filter(m -> {
                    LocalDate withdrawnDate = m.getUpdatedAt().toLocalDate();
                    return !withdrawnDate.isBefore(start) && !withdrawnDate.isAfter(end);
                })
                .count();
        metrics.put("withdrawnInPeriod", withdrawnInPeriod);
        
        // 순증감 (신규 - 이탈)
        long netChange = newMembersInPeriod - withdrawnInPeriod;
        metrics.put("netChange", netChange);
        
        // 최근 방문 회원 수 계산용 날짜 (30일 전) - 등급별 통계에서도 사용
        LocalDate thirtyDaysAgo = LocalDate.now().minusDays(30);
        
        // 등급별 회원 분포
        Map<String, Long> gradeDistribution = new HashMap<>();
        Map<String, Map<String, Long>> gradeStatusDistribution = new HashMap<>(); // 등급별 상태 분포
        Map<String, Long> gradeActiveCount = new HashMap<>(); // 등급별 활성 회원 수
        Map<String, Long> gradeRecentVisitors = new HashMap<>(); // 등급별 최근 방문 회원 수
        
        for (Member member : members) {
            if (member == null || member.getGrade() == null) continue;
            String grade = member.getGrade().name();
            gradeDistribution.put(grade, gradeDistribution.getOrDefault(grade, 0L) + 1);
            
            // 등급별 상태 분포
            if (!gradeStatusDistribution.containsKey(grade)) {
                gradeStatusDistribution.put(grade, new HashMap<>());
            }
            String status = member.getStatus() != null ? member.getStatus().name() : "UNKNOWN";
            gradeStatusDistribution.get(grade).put(status, 
                gradeStatusDistribution.get(grade).getOrDefault(status, 0L) + 1);
            
            // 등급별 활성 회원 수
            if (member.getStatus() == Member.MemberStatus.ACTIVE) {
                gradeActiveCount.put(grade, gradeActiveCount.getOrDefault(grade, 0L) + 1);
            }
            
            // 등급별 최근 방문 회원 수
            if (member.getLastVisitDate() != null && !member.getLastVisitDate().isBefore(thirtyDaysAgo)) {
                gradeRecentVisitors.put(grade, gradeRecentVisitors.getOrDefault(grade, 0L) + 1);
            }
        }
        metrics.put("gradeDistribution", gradeDistribution);
        metrics.put("gradeStatusDistribution", gradeStatusDistribution);
        metrics.put("gradeActiveCount", gradeActiveCount);
        metrics.put("gradeRecentVisitors", gradeRecentVisitors);
        
        // 카테고리별 회원 통계 (활성 이용권 기준)
        Map<String, Long> categoryMemberCount = new HashMap<>(); // 카테고리별 회원 수
        Map<String, Long> categoryActiveProducts = new HashMap<>(); // 카테고리별 활성 이용권 수
        try {
            List<com.afbscenter.model.MemberProduct> allMemberProducts = memberProductRepository.findAll();
            Set<Long> categoryMemberIds = new HashSet<>();
            
            for (com.afbscenter.model.MemberProduct mp : allMemberProducts) {
                if (mp.getMember() == null || mp.getProduct() == null || 
                    mp.getStatus() != com.afbscenter.model.MemberProduct.Status.ACTIVE) {
                    continue;
                }
                
                com.afbscenter.model.Product.ProductCategory category = mp.getProduct().getCategory();
                if (category == null) continue;
                
                String categoryName = category.name();
                Long memberId = mp.getMember().getId();
                
                // 카테고리별 회원 수 (중복 제거)
                if (!categoryMemberIds.contains(memberId)) {
                    categoryMemberCount.put(categoryName, categoryMemberCount.getOrDefault(categoryName, 0L) + 1);
                    categoryMemberIds.add(memberId);
                }
                
                // 카테고리별 활성 이용권 수
                categoryActiveProducts.put(categoryName, 
                    categoryActiveProducts.getOrDefault(categoryName, 0L) + 1);
            }
        } catch (Exception e) {
            logger.warn("카테고리별 회원 통계 계산 실패: {}", e.getMessage());
        }
        metrics.put("categoryMemberCount", categoryMemberCount);
        metrics.put("categoryActiveProducts", categoryActiveProducts);
        
        // 평균 회원당 이용권 수
        long totalMemberProducts = 0L;
        long membersWithProducts = 0L;
        try {
            List<com.afbscenter.model.MemberProduct> allMemberProducts = memberProductRepository.findAll();
            Map<Long, Long> memberProductCount = new HashMap<>();
            for (com.afbscenter.model.MemberProduct mp : allMemberProducts) {
                if (mp.getMember() != null && mp.getStatus() == com.afbscenter.model.MemberProduct.Status.ACTIVE) {
                    Long memberId = mp.getMember().getId();
                    memberProductCount.put(memberId, memberProductCount.getOrDefault(memberId, 0L) + 1);
                }
            }
            totalMemberProducts = memberProductCount.values().stream().mapToLong(Long::longValue).sum();
            membersWithProducts = memberProductCount.size();
        } catch (Exception e) {
            logger.warn("이용권 통계 계산 실패: {}", e.getMessage());
        }
        double avgProductsPerMember = activeCount > 0 ? (double) totalMemberProducts / activeCount : 0.0;
        metrics.put("avgProductsPerMember", Math.round(avgProductsPerMember * 10.0) / 10.0);
        metrics.put("totalActiveProducts", totalMemberProducts);
        metrics.put("membersWithProducts", membersWithProducts);
        
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
            long dailyWithdrawnCount = dailyWithdrawnMembers.getOrDefault(date, 0L);
            
            // 신규나 이탈이 있는 날짜만 표시
            if (newCount > 0 || dailyWithdrawnCount > 0) {
                Map<String, Object> item = new HashMap<>();
                item.put("label", date.toString());
                item.put("newCount", newCount);
                item.put("withdrawnCount", dailyWithdrawnCount);
                item.put("netChange", newCount - dailyWithdrawnCount); // 순증감
                trend.add(item);
            }
        }
        
        metrics.put("trend", trend);
        
        return metrics;
    }
}
