package com.afbscenter.controller;

import com.afbscenter.model.Payment;
import com.afbscenter.model.Member;
import com.afbscenter.model.Booking;
import com.afbscenter.model.Product;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentController {

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private ProductRepository productRepository;

    @GetMapping
    public ResponseEntity<List<Payment>> getAllPayments(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            List<Payment> payments = paymentRepository.findAll();
            
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
            
            // Member와 Booking을 안전하게 로드
            payments.forEach(payment -> {
                try {
                    if (payment.getMember() != null) {
                        payment.getMember().getName(); // Member 로드
                    }
                    if (payment.getBooking() != null) {
                        payment.getBooking().getId(); // Booking 로드
                    }
                    if (payment.getProduct() != null) {
                        payment.getProduct().getName(); // Product 로드
                    }
                } catch (Exception e) {
                    // 로드 오류는 무시
                }
            });
            
            return ResponseEntity.ok(payments);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getPaymentSummary() {
        try {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime endOfDay = today.atTime(LocalTime.MAX);
            
            // 오늘 매출
            Integer todayRevenue = paymentRepository.sumAmountByDateRange(startOfDay, endOfDay);
            if (todayRevenue == null) todayRevenue = 0;
            
            // 이번 달 매출
            LocalDate monthStart = today.withDayOfMonth(1);
            LocalDateTime monthStartDateTime = monthStart.atStartOfDay();
            LocalDateTime monthEndDateTime = today.atTime(LocalTime.MAX);
            Integer monthRevenue = paymentRepository.sumAmountByDateRange(monthStartDateTime, monthEndDateTime);
            if (monthRevenue == null) monthRevenue = 0;
            
            // 미수금 (확정된 예약 중 미결제)
            // 간단히 0으로 설정 (실제로는 Booking과 Payment 조인 필요)
            Integer unpaid = 0;
            
            // 환불 대기 (간단히 0으로 설정)
            Integer refundPending = 0;
            
            Map<String, Object> summary = new HashMap<>();
            summary.put("todayRevenue", todayRevenue);
            summary.put("monthRevenue", monthRevenue);
            summary.put("unpaid", unpaid);
            summary.put("refundPending", refundPending);
            
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Payment> getPaymentById(@PathVariable Long id) {
        try {
            return paymentRepository.findById(id)
                    .map(payment -> {
                        // Member와 Booking을 안전하게 로드
                        try {
                            if (payment.getMember() != null) {
                                payment.getMember().getName(); // Member 로드
                            }
                            if (payment.getBooking() != null) {
                                payment.getBooking().getId(); // Booking 로드
                            }
                            if (payment.getProduct() != null) {
                                payment.getProduct().getName(); // Product 로드
                            }
                        } catch (Exception e) {
                            // 로드 오류는 무시
                        }
                        return ResponseEntity.ok(payment);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<Payment> createPayment(@RequestBody Payment payment) {
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
            
            Payment saved = paymentRepository.save(payment);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Payment> updatePayment(@PathVariable Long id, @RequestBody Payment updatedPayment) {
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
            e.printStackTrace();
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePayment(@PathVariable Long id) {
        try {
            if (!paymentRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            paymentRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 환불 처리
    @PostMapping("/{id}/refund")
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
            e.printStackTrace();
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
