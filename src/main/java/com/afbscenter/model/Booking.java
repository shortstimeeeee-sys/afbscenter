package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member; // null이면 비회원

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Coach coach; // 담당 코치 (회원/비회원 모두 가능)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_product_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private com.afbscenter.model.MemberProduct memberProduct; // 사용한 상품/이용권 (선택사항)

    @Column(name = "non_member_name")
    private String nonMemberName; // 비회원 이름

    @Column(name = "non_member_phone")
    private String nonMemberPhone; // 비회원 전화번호

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private Integer participants = 1; // 인원

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingPurpose purpose;

    @Enumerated(EnumType.STRING)
    @Column(name = "lesson_category")
    private Lesson.LessonCategory lessonCategory; // 레슨 카테고리 (레슨인 경우)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status = BookingStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Column(name = "discount_amount")
    private Integer discountAmount = 0; // 할인 금액

    @Column(name = "coupon_code")
    private String couponCode; // 쿠폰 코드

    @Column(length = 1000)
    private String memo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private java.util.List<Payment> payments = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private java.util.List<Attendance> attendances = new java.util.ArrayList<>();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum BookingPurpose {
        LESSON,         // 레슨
        RENTAL,         // 대관
        PERSONAL_TRAINING // 개인훈련
    }

    public enum BookingStatus {
        PENDING,        // 대기
        CONFIRMED,      // 확정
        CANCELLED,      // 취소
        NO_SHOW,        // 노쇼
        COMPLETED       // 완료
    }

    public enum PaymentMethod {
        PREPAID,        // 선결제
        ON_SITE,        // 현장
        POSTPAID        // 후불
    }
}
