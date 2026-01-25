package com.afbscenter.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
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

    @NotNull(message = "결제 금액은 필수입니다")
    @Positive(message = "결제 금액은 0보다 커야 합니다")
    @Column(nullable = false)
    private Integer amount; // 결제 금액

    @NotNull(message = "결제 방법은 필수입니다")
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @NotNull(message = "결제 상태는 필수입니다")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.COMPLETED;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_category")
    private PaymentCategory category;

    @Size(max = 1000, message = "메모는 1000자 이하여야 합니다")
    @Column(length = 1000)
    private String memo;

    @PositiveOrZero(message = "환불 금액은 0 이상이어야 합니다")
    @Column(name = "refund_amount")
    private Integer refundAmount = 0; // 환불 금액

    @Size(max = 1000, message = "환불 사유는 1000자 이하여야 합니다")
    @Column(name = "refund_reason")
    private String refundReason; // 환불 사유

    @Size(max = 255, message = "환불 승인자는 255자 이하여야 합니다")
    @Column(name = "refund_approved_by")
    private String refundApprovedBy; // 환불 승인자

    @Column(name = "paid_at", nullable = false)
    private LocalDateTime paidAt = LocalDateTime.now();

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Size(max = 50, message = "결제 번호는 50자 이하여야 합니다")
    @Column(name = "payment_number", unique = true)
    private String paymentNumber; // 관리용 결제 번호 (예: PAY-2026-0001)

    @PrePersist
    protected void onCreate() {
        // 저장 전에 refundAmount가 null이면 0으로 설정
        if (refundAmount == null) {
            refundAmount = 0;
        }
        // createdAt이 null이면 현재 시간으로 설정
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        // paidAt이 null이면 현재 시간으로 설정
        if (paidAt == null) {
            paidAt = LocalDateTime.now();
        }
    }

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
