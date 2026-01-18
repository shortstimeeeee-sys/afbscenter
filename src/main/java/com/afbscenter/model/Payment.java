package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private Integer amount; // 결제 금액

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.COMPLETED;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_category")
    private PaymentCategory category;

    @Column(length = 1000)
    private String memo;

    @Column(name = "refund_amount")
    private Integer refundAmount = 0; // 환불 금액

    @Column(name = "refund_reason")
    private String refundReason; // 환불 사유

    @Column(name = "refund_approved_by")
    private String refundApprovedBy; // 환불 승인자

    @Column(name = "paid_at", nullable = false)
    private LocalDateTime paidAt = LocalDateTime.now();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "payment_number", unique = true)
    private String paymentNumber; // 관리용 결제 번호 (예: PAY-2026-0001)

    public enum PaymentMethod {
        CASH,           // 현금
        CARD,           // 카드
        BANK_TRANSFER,  // 계좌이체
        EASY_PAY        // 간편결제
    }

    public enum PaymentStatus {
        COMPLETED,      // 완료
        PARTIAL,        // 부분 결제
        REFUNDED        // 환불
    }

    public enum PaymentCategory {
        RENTAL,         // 대관
        LESSON,         // 레슨
        PRODUCT_SALE    // 상품판매
    }
}
