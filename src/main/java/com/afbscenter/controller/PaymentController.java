package com.afbscenter.controller;

import com.afbscenter.model.Payment;
import com.afbscenter.model.Member;
import com.afbscenter.model.Booking;
import com.afbscenter.model.Product;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentController.class);

    private final PaymentRepository paymentRepository;
    private final MemberRepository memberRepository;
    private final BookingRepository bookingRepository;
    private final ProductRepository productRepository;
    private final JdbcTemplate jdbcTemplate;

    public PaymentController(PaymentRepository paymentRepository,
                            MemberRepository memberRepository,
                            BookingRepository bookingRepository,
                            ProductRepository productRepository,
                            JdbcTemplate jdbcTemplate) {
        this.paymentRepository = paymentRepository;
        this.memberRepository = memberRepository;
        this.bookingRepository = bookingRepository;
        this.productRepository = productRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllPayments(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder) {
        try {
            // 코치 정보를 포함하여 조회 (lazy loading 방지)
            List<Payment> payments = paymentRepository.findAllWithCoach();
            if (payments == null) {
                payments = new java.util.ArrayList<>();
            }
            // 삭제된 회원의 결제는 목록/매출에 노출하지 않음 (회원 삭제 시 결제는 DB에서 삭제되지만, 회원이 null인 건 제외)
            payments = payments.stream().filter(p -> p.getMember() != null).collect(Collectors.toList());
            logger.info("결제 목록 조회: 전체 {}건 (회원 존재 건만)", payments.size());
            
            // 필터링
            if (paymentMethod != null && !paymentMethod.isEmpty()) {
                try {
                    Payment.PaymentMethod method = Payment.PaymentMethod.valueOf(paymentMethod);
                    payments = payments.stream()
                            .filter(p -> p.getPaymentMethod() == method)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {
                    // 잘못된 enum 값은 무시
                }
            }
            
            if (status != null && !status.isEmpty()) {
                try {
                    Payment.PaymentStatus paymentStatus = Payment.PaymentStatus.valueOf(status);
                    payments = payments.stream()
                            .filter(p -> p.getStatus() == paymentStatus)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {
                    // 잘못된 enum 값은 무시
                }
            }
            
            if (category != null && !category.isEmpty()) {
                try {
                    Payment.PaymentCategory paymentCategory = Payment.PaymentCategory.valueOf(category);
                    payments = payments.stream()
                            .filter(p -> p.getCategory() == paymentCategory)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {
                    // 잘못된 enum 값은 무시
                }
            }
            
            if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                LocalDateTime startDateTime = start.atStartOfDay();
                LocalDateTime endDateTime = end.atTime(LocalTime.MAX);
                
                payments = payments.stream()
                        .filter(p -> {
                            LocalDateTime paidAt = p.getPaidAt();
                            return paidAt != null && !paidAt.isBefore(startDateTime) && !paidAt.isAfter(endDateTime);
                        })
                        .collect(Collectors.toList());
            }
            
            // 검색 기능 (회원명, 결제번호, 상품명)
            if (search != null && !search.trim().isEmpty()) {
                final String searchLower = search.toLowerCase().trim();
                payments = payments.stream()
                        .filter(p -> {
                            // 회원명 검색
                            if (p.getMember() != null && p.getMember().getName() != null) {
                                if (p.getMember().getName().toLowerCase().contains(searchLower)) {
                                    return true;
                                }
                            }
                            // 결제번호 검색
                            if (p.getPaymentNumber() != null && p.getPaymentNumber().toLowerCase().contains(searchLower)) {
                                return true;
                            }
                            // 결제 ID 검색
                            if (String.valueOf(p.getId()).contains(searchLower)) {
                                return true;
                            }
                            // 상품명 검색
                            if (p.getProduct() != null && p.getProduct().getName() != null) {
                                if (p.getProduct().getName().toLowerCase().contains(searchLower)) {
                                    return true;
                                }
                            }
                            return false;
                        })
                        .collect(Collectors.toList());
            }
            
            // 정렬 기능
            if (sortBy != null && !sortBy.isEmpty()) {
                final String sortField = sortBy;
                final boolean ascending = sortOrder == null || !sortOrder.equalsIgnoreCase("desc");
                
                payments.sort((p1, p2) -> {
                    int result = 0;
                    switch (sortField.toLowerCase()) {
                        case "date":
                        case "paidat":
                            LocalDateTime date1 = p1.getPaidAt() != null ? p1.getPaidAt() : LocalDateTime.MIN;
                            LocalDateTime date2 = p2.getPaidAt() != null ? p2.getPaidAt() : LocalDateTime.MIN;
                            result = date1.compareTo(date2);
                            break;
                        case "amount":
                            Integer amount1 = p1.getAmount() != null ? p1.getAmount() : 0;
                            Integer amount2 = p2.getAmount() != null ? p2.getAmount() : 0;
                            result = amount1.compareTo(amount2);
                            break;
                        case "member":
                        case "membername":
                            String name1 = p1.getMember() != null && p1.getMember().getName() != null 
                                    ? p1.getMember().getName() : "";
                            String name2 = p2.getMember() != null && p2.getMember().getName() != null 
                                    ? p2.getMember().getName() : "";
                            result = name1.compareTo(name2);
                            break;
                        case "id":
                            result = p1.getId().compareTo(p2.getId());
                            break;
                        default:
                            result = 0;
                    }
                    return ascending ? result : -result;
                });
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            List<Map<String, Object>> result = payments.stream().map(payment -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", payment.getId());
                map.put("paymentNumber", payment.getPaymentNumber()); // 관리 번호
                map.put("amount", payment.getAmount());
                map.put("paymentMethod", payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : null);
                map.put("status", payment.getStatus() != null ? payment.getStatus().name() : null);
                map.put("category", payment.getCategory() != null ? payment.getCategory().name() : null);
                map.put("paidAt", payment.getPaidAt());
                map.put("createdAt", payment.getCreatedAt());
                map.put("memo", payment.getMemo());
                map.put("refundAmount", payment.getRefundAmount());
                map.put("refundReason", payment.getRefundReason());
                map.put("refundApprovedBy", payment.getRefundApprovedBy());
                
                // Member 정보
                if (payment.getMember() != null) {
                    try {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", payment.getMember().getId());
                        memberMap.put("name", payment.getMember().getName());
                        memberMap.put("memberNumber", payment.getMember().getMemberNumber());
                        map.put("member", memberMap);
                    } catch (Exception e) {
                        logger.warn("Member 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("member", null);
                    }
                } else {
                    map.put("member", null);
                }
                
                // Booking 정보
                if (payment.getBooking() != null) {
                    try {
                        Map<String, Object> bookingMap = new HashMap<>();
                        bookingMap.put("id", payment.getBooking().getId());
                        bookingMap.put("startTime", payment.getBooking().getStartTime());
                        bookingMap.put("endTime", payment.getBooking().getEndTime());
                        map.put("booking", bookingMap);
                    } catch (Exception e) {
                        logger.warn("Booking 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("booking", null);
                    }
                } else {
                    map.put("booking", null);
                }
                
                // Coach 정보 (예약의 코치 우선, 없으면 회원의 담당 코치)
                try {
                    com.afbscenter.model.Coach coach = null;
                    if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                        coach = payment.getBooking().getCoach();
                    } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
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
                    logger.warn("Coach 로드 실패: Payment ID={}", payment.getId(), e);
                    map.put("coach", null);
                }
                
                // Product 정보
                if (payment.getProduct() != null) {
                    try {
                        Map<String, Object> productMap = new HashMap<>();
                        productMap.put("id", payment.getProduct().getId());
                        productMap.put("name", payment.getProduct().getName());
                        productMap.put("price", payment.getProduct().getPrice());
                        map.put("product", productMap);
                    } catch (Exception e) {
                        logger.warn("Product 로드 실패: Payment ID={}", payment.getId(), e);
                        map.put("product", null);
                    }
                } else {
                    map.put("product", null);
                }
                
                return map;
            }).collect(Collectors.toList());
            
            logger.debug("결제 목록 조회 완료: 필터링 후 {}건", result.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("결제 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getPaymentById(@PathVariable Long id) {
        try {
            // findAllWithCoach로 조회하여 lazy loading 방지
            List<Payment> allPayments = paymentRepository.findAllWithCoach();
            Payment payment = allPayments.stream()
                    .filter(p -> p.getId().equals(id))
                    .findFirst()
                    .orElse(null);
            
            if (payment == null) {
                return ResponseEntity.notFound().build();
            }
            
            // Map으로 변환 (순환 참조 방지)
            Map<String, Object> map = new HashMap<>();
            map.put("id", payment.getId());
            map.put("paymentNumber", payment.getPaymentNumber());
            map.put("amount", payment.getAmount());
            map.put("paymentMethod", payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : null);
            map.put("status", payment.getStatus() != null ? payment.getStatus().name() : null);
            map.put("category", payment.getCategory() != null ? payment.getCategory().name() : null);
            map.put("paidAt", payment.getPaidAt());
            map.put("createdAt", payment.getCreatedAt());
            map.put("memo", payment.getMemo());
            map.put("refundAmount", payment.getRefundAmount());
            map.put("refundReason", payment.getRefundReason());
            map.put("refundApprovedBy", payment.getRefundApprovedBy());
            
            // Member 정보
            if (payment.getMember() != null) {
                try {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", payment.getMember().getId());
                    memberMap.put("name", payment.getMember().getName());
                    memberMap.put("memberNumber", payment.getMember().getMemberNumber());
                    map.put("member", memberMap);
                } catch (Exception e) {
                    logger.warn("Member 로드 실패: Payment ID={}", payment.getId(), e);
                    map.put("member", null);
                }
            } else {
                map.put("member", null);
            }
            
            // Booking 정보
            if (payment.getBooking() != null) {
                try {
                    Map<String, Object> bookingMap = new HashMap<>();
                    bookingMap.put("id", payment.getBooking().getId());
                    bookingMap.put("startTime", payment.getBooking().getStartTime());
                    bookingMap.put("endTime", payment.getBooking().getEndTime());
                    map.put("booking", bookingMap);
                } catch (Exception e) {
                    logger.warn("Booking 로드 실패: Payment ID={}", payment.getId(), e);
                    map.put("booking", null);
                }
            } else {
                map.put("booking", null);
            }
            
            // Coach 정보 (예약의 코치 우선, 없으면 회원의 담당 코치)
            try {
                com.afbscenter.model.Coach coach = null;
                if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                    coach = payment.getBooking().getCoach();
                } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
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
                logger.warn("Coach 로드 실패: Payment ID={}", payment.getId(), e);
                map.put("coach", null);
            }
            
            // Product 정보
            if (payment.getProduct() != null) {
                try {
                    Map<String, Object> productMap = new HashMap<>();
                    productMap.put("id", payment.getProduct().getId());
                    productMap.put("name", payment.getProduct().getName());
                    productMap.put("price", payment.getProduct().getPrice());
                    map.put("product", productMap);
                } catch (Exception e) {
                    logger.warn("Product 로드 실패: Payment ID={}", payment.getId(), e);
                    map.put("product", null);
                }
            } else {
                map.put("product", null);
            }
            
            return ResponseEntity.ok(map);
        } catch (Exception e) {
            logger.error("결제 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Payment> createPayment(@Valid @RequestBody Payment payment) {
        try {
            // 필수 필드 검증
            if (payment.getAmount() == null || payment.getAmount() <= 0) {
                return ResponseEntity.badRequest().build();
            }
            
            if (payment.getPaymentMethod() == null) {
                return ResponseEntity.badRequest().build();
            }
            
            // Member 설정
            if (payment.getMember() != null && payment.getMember().getId() != null) {
                Member member = memberRepository.findById(payment.getMember().getId())
                        .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
                payment.setMember(member);
            } else {
                payment.setMember(null);
            }
            
            // Booking 설정
            if (payment.getBooking() != null && payment.getBooking().getId() != null) {
                Booking booking = bookingRepository.findById(payment.getBooking().getId())
                        .orElse(null); // Booking이 없어도 결제는 가능
                payment.setBooking(booking);
            } else {
                payment.setBooking(null);
            }
            
            // Product 설정
            if (payment.getProduct() != null && payment.getProduct().getId() != null) {
                Product product = productRepository.findById(payment.getProduct().getId())
                        .orElse(null); // Product가 없어도 결제는 가능
                payment.setProduct(product);
            } else {
                payment.setProduct(null);
            }
            
            // 상태 기본값 설정
            if (payment.getStatus() == null) {
                payment.setStatus(Payment.PaymentStatus.COMPLETED);
            }
            
            // 관리 번호 자동 생성 (없는 경우)
            if (payment.getPaymentNumber() == null || payment.getPaymentNumber().isEmpty()) {
                payment.setPaymentNumber(generatePaymentNumber());
            }
            
            Payment saved = paymentRepository.save(payment);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("결제 생성 중 잘못된 인자: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("결제 생성 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Payment> updatePayment(@PathVariable Long id, @Valid @RequestBody Payment updatedPayment) {
        try {
            Payment payment = paymentRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("결제를 찾을 수 없습니다."));
            
            // 필드 업데이트
            if (updatedPayment.getAmount() != null) {
                payment.setAmount(updatedPayment.getAmount());
            }
            
            if (updatedPayment.getPaymentMethod() != null) {
                payment.setPaymentMethod(updatedPayment.getPaymentMethod());
            }
            
            if (updatedPayment.getStatus() != null) {
                payment.setStatus(updatedPayment.getStatus());
            }
            
            if (updatedPayment.getCategory() != null) {
                payment.setCategory(updatedPayment.getCategory());
            }
            
            if (updatedPayment.getMemo() != null) {
                payment.setMemo(updatedPayment.getMemo());
            }
            
            if (updatedPayment.getRefundAmount() != null) {
                payment.setRefundAmount(updatedPayment.getRefundAmount());
            }
            
            if (updatedPayment.getRefundReason() != null) {
                payment.setRefundReason(updatedPayment.getRefundReason());
            }
            
            if (updatedPayment.getRefundApprovedBy() != null) {
                payment.setRefundApprovedBy(updatedPayment.getRefundApprovedBy());
            }
            
            Payment saved = paymentRepository.save(payment);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("결제를 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("결제 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deletePayment(@PathVariable Long id) {
        try {
            if (!paymentRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            paymentRepository.deleteById(id);
            
            // 삭제 후 시퀀스 자동 조정
            resetPaymentSequenceIfNeeded();
            
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("결제 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 결제 시퀀스 리셋 (필요한 경우)
    @Transactional
    private void resetPaymentSequenceIfNeeded() {
        try {
            List<Payment> payments = paymentRepository.findAll();
            if (payments.isEmpty()) {
                // 결제가 없으면 시퀀스를 1로 리셋
                resetPaymentSequence(1);
            } else {
                // 현재 최대 ID를 찾아서 다음 ID로 시퀀스 설정
                Long maxId = payments.stream()
                        .mapToLong(Payment::getId)
                        .max()
                        .orElse(0L);
                resetPaymentSequence(maxId + 1);
            }
        } catch (Exception e) {
            logger.warn("결제 시퀀스 조정 실패: {}", e.getMessage());
        }
    }
    
    // H2 시퀀스 리셋
    private void resetPaymentSequence(long nextValue) {
        try {
            // SQL 인젝션 방지: nextValue가 유효한 long 값인지 확인
            if (nextValue < 1) {
                logger.warn("잘못된 시퀀스 값: {}", nextValue);
                return;
            }
            // H2에서 IDENTITY 컬럼의 시퀀스 리셋
            // H2의 ALTER TABLE은 파라미터화를 지원하지 않으므로, 값 검증 후 사용
            String sql = "ALTER TABLE payments ALTER COLUMN id RESTART WITH " + nextValue;
            jdbcTemplate.execute(sql);
            logger.debug("결제 시퀀스 리셋: nextValue={}", nextValue);
        } catch (Exception e) {
            // 시퀀스 리셋 실패는 무시 (다음 삽입 시 자동으로 조정됨)
            logger.warn("결제 시퀀스 리셋 실패: {}", e.getMessage());
        }
    }
    
    // 결제 번호 재정렬 API (1부터 시작하도록)
    @PostMapping("/reorder")
    @Transactional
    public ResponseEntity<Map<String, String>> reorderPaymentIds() {
        try {
            List<Payment> payments = paymentRepository.findAll();
            if (payments.isEmpty()) {
                resetPaymentSequence(1);
                Map<String, String> response = new HashMap<>();
                response.put("message", "결제 번호가 1로 리셋되었습니다.");
                response.put("status", "success");
                return ResponseEntity.ok(response);
            }
            
            // 날짜/시간 기준으로 정렬 (paidAt 오름차순)
            payments.sort((p1, p2) -> {
                if (p1.getPaidAt() == null && p2.getPaidAt() == null) return 0;
                if (p1.getPaidAt() == null) return 1;
                if (p2.getPaidAt() == null) return -1;
                return p1.getPaidAt().compareTo(p2.getPaidAt());
            });
            
            // ID를 1부터 순차적으로 재할당
            // 먼저 모든 ID를 임시 값으로 변경 (충돌 방지)
            for (int i = 0; i < payments.size(); i++) {
                Payment payment = payments.get(i);
                Long tempId = 999999L - i;
                
                if (!payment.getId().equals(tempId)) {
                    // ID를 임시 값으로 변경
                    jdbcTemplate.update("UPDATE payments SET id = ? WHERE id = ?", tempId, payment.getId());
                }
            }
            
            // 다시 올바른 ID로 변경 (날짜/시간 순서대로)
            for (int i = 0; i < payments.size(); i++) {
                Long tempId = 999999L - i;
                Long newId = (long) (i + 1);
                
                // ID를 올바른 값으로 변경
                jdbcTemplate.update("UPDATE payments SET id = ? WHERE id = ?", newId, tempId);
            }
            
            // 시퀀스를 다음 ID로 설정
            long nextId = payments.size() + 1;
            resetPaymentSequence(nextId);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "결제 번호가 날짜/시간 순서대로 1부터 재할당되었습니다.");
            response.put("status", "success");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("결제 번호 재정렬 중 오류 발생", e);
            Map<String, String> response = new HashMap<>();
            response.put("message", "결제 번호 재정렬 중 오류가 발생했습니다: " + e.getMessage());
            response.put("status", "error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    // 환불 처리
    @PostMapping("/{id}/refund")
    @Transactional
    public ResponseEntity<Payment> processRefund(@PathVariable Long id, @RequestBody Map<String, Object> refundData) {
        try {
            Payment payment = paymentRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("결제를 찾을 수 없습니다."));
            
            Integer refundAmount = refundData.get("amount") != null ? 
                    Integer.parseInt(refundData.get("amount").toString()) : payment.getAmount();
            String refundReason = refundData.get("reason") != null ? 
                    refundData.get("reason").toString() : null;
            
            payment.setRefundAmount(refundAmount);
            payment.setRefundReason(refundReason);
            payment.setStatus(Payment.PaymentStatus.REFUNDED);
            
            Payment saved = paymentRepository.save(payment);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("결제를 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("환불 처리 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 결제 관리 번호 생성 (예: PAY-2026-0001)
    private String generatePaymentNumber() {
        try {
            // 올해 연도
            int year = LocalDate.now().getYear();
            
            // 올해 결제 중 가장 큰 번호 찾기
            List<Payment> thisYearPayments = paymentRepository.findByPaymentNumberPattern("PAY-" + year + "-%");
            
            int maxNumber = 0;
            for (Payment p : thisYearPayments) {
                try {
                    String numberPart = p.getPaymentNumber().substring(("PAY-" + year + "-").length());
                    int num = Integer.parseInt(numberPart);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                } catch (Exception e) {
                    // 번호 파싱 실패는 무시
                }
            }
            
            // 다음 번호 생성
            int nextNumber = maxNumber + 1;
            return String.format("PAY-%d-%04d", year, nextNumber);
        } catch (Exception e) {
            logger.warn("결제 관리 번호 생성 실패, 기본 번호 사용", e);
            // 실패 시 타임스탬프 기반 번호 생성
            return "PAY-" + System.currentTimeMillis();
        }
    }
}
