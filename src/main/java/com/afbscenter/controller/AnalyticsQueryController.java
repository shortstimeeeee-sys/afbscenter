package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Facility;
import com.afbscenter.model.Member;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
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
@RequestMapping("/api/analytics")
public class AnalyticsQueryController {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsQueryController.class);

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final MemberRepository memberRepository;
    private final FacilityRepository facilityRepository;

    public AnalyticsQueryController(BookingRepository bookingRepository,
                                    PaymentRepository paymentRepository,
                                    MemberRepository memberRepository,
                                    FacilityRepository facilityRepository) {
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.memberRepository = memberRepository;
        this.facilityRepository = facilityRepository;
    }

    @GetMapping("/revenue/category/{category}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getCategoryRevenueDetails(
            @PathVariable String category,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            logger.info("카테고리별 세부 내역 조회 시작: category={}", category);

            LocalDateTime startDateTime = null;
            LocalDateTime endDateTime = null;

            try {
                if (startDate != null && endDate != null) {
                    startDateTime = LocalDate.parse(startDate).atStartOfDay();
                    endDateTime = LocalDate.parse(endDate).atTime(LocalTime.MAX);
                } else {
                    LocalDate today = LocalDate.now();
                    startDateTime = today.withDayOfMonth(1).atStartOfDay();
                    endDateTime = today.atTime(LocalTime.MAX);
                }
            } catch (Exception e) {
                logger.error("날짜 파싱 실패: startDate={}, endDate={}", startDate, endDate, e);
                return ResponseEntity.badRequest().build();
            }

            Payment.PaymentCategory paymentCategory = null;
            try {
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

            List<Payment> allPayments = paymentRepository.findAll();
            List<Payment> payments = new ArrayList<>();
            for (Payment p : allPayments) {
                try {
                    if (p.getCategory() != paymentCategory) continue;
                    if (p.getPaidAt() == null) continue;
                    if (p.getPaidAt().isBefore(startDateTime) || p.getPaidAt().isAfter(endDateTime)) continue;
                    payments.add(p);
                } catch (Exception e) {
                    logger.warn("결제 필터링 중 오류: Payment ID={}", p.getId(), e);
                }
            }

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

                    try {
                        if (payment.getMember() != null) {
                            Member member = payment.getMember();
                            Map<String, Object> memberMap = new HashMap<>();
                            memberMap.put("id", member.getId());
                            memberMap.put("name", member.getName());
                            memberMap.put("memberNumber", member.getMemberNumber());
                            map.put("member", memberMap);
                        } else {
                            map.put("member", null);
                        }
                    } catch (Exception e) {
                        logger.warn("회원 정보 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("member", null);
                    }

                    try {
                        if (payment.getProduct() != null) {
                            com.afbscenter.model.Product product = payment.getProduct();
                            Map<String, Object> productMap = new HashMap<>();
                            productMap.put("id", product.getId());
                            productMap.put("name", product.getName());
                            map.put("product", productMap);
                        } else {
                            map.put("product", null);
                        }
                    } catch (Exception e) {
                        logger.warn("상품 정보 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("product", null);
                    }

                    try {
                        com.afbscenter.model.Coach coach = null;
                        try {
                            if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                                coach = payment.getBooking().getCoach();
                            }
                        } catch (Exception e) {
                            logger.debug("예약의 코치 로드 실패: Payment ID={}", payment.getId(), e);
                        }
                        if (coach == null && payment.getMember() != null && payment.getMember().getCoach() != null) {
                            coach = payment.getMember().getCoach();
                        }
                        if (coach != null) {
                            Map<String, Object> coachMap = new HashMap<>();
                            coachMap.put("id", coach.getId());
                            coachMap.put("name", coach.getName());
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
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("카테고리별 결제 세부 내역 조회 실패: category={}, error={}", category, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

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

                if (payment.getMember() != null) {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", payment.getMember().getId());
                    memberMap.put("name", payment.getMember().getName());
                    memberMap.put("memberNumber", payment.getMember().getMemberNumber());
                    map.put("member", memberMap);
                }

                if (payment.getProduct() != null) {
                    Map<String, Object> productMap = new HashMap<>();
                    productMap.put("id", payment.getProduct().getId());
                    productMap.put("name", payment.getProduct().getName());
                    map.put("product", productMap);
                }

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

    @GetMapping("/members/details")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberDetails(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            LocalDate start;
            LocalDate end;
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

            List<Member> allMembers = memberRepository.findAllOrderByName();
            List<Map<String, Object>> result = new ArrayList<>();
            for (Member member : allMembers) {
                try {
                    if (member.getCreatedAt() == null) continue;
                    LocalDate memberDate = member.getCreatedAt().toLocalDate();
                    if (memberDate.isBefore(start) || memberDate.isAfter(end)) continue;

                    Map<String, Object> map = new HashMap<>();
                    map.put("id", member.getId());
                    map.put("name", member.getName());
                    map.put("memberNumber", member.getMemberNumber());
                    map.put("phoneNumber", member.getPhoneNumber());
                    map.put("grade", member.getGrade());
                    map.put("school", member.getSchool());
                    map.put("createdAt", member.getCreatedAt());

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
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 지표 세부 내역 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/operational/details")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getOperationalDetails(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            LocalDateTime startDateTime;
            LocalDateTime endDateTime;
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
            details.put("totalBookings", bookings.size());
            details.put("confirmedBookings", bookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.CONFIRMED).count());
            details.put("completedBookings", bookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.COMPLETED).count());
            details.put("cancelledBookings", bookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.CANCELLED).count());
            details.put("noShowBookings", bookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.NO_SHOW).count());

            List<Map<String, Object>> facilityDetails = new ArrayList<>();
            for (Facility facility : facilities) {
                List<Booking> facilityBookings = bookings.stream()
                        .filter(b -> b.getFacility() != null && b.getFacility().getId().equals(facility.getId()))
                        .collect(Collectors.toList());
                Map<String, Object> facilityMap = new HashMap<>();
                facilityMap.put("id", facility.getId());
                facilityMap.put("name", facility.getName());
                facilityMap.put("totalBookings", facilityBookings.size());
                facilityMap.put("confirmedBookings", facilityBookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.CONFIRMED).count());
                facilityMap.put("completedBookings", facilityBookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.COMPLETED).count());
                facilityDetails.add(facilityMap);
            }
            details.put("facilities", facilityDetails);

            return ResponseEntity.ok(details);
        } catch (Exception e) {
            logger.error("운영 지표 세부 내역 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
