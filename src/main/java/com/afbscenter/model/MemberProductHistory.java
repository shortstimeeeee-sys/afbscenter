package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "member_product_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberProductHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_product_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private MemberProduct memberProduct;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attendance_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Attendance attendance; // 출석 기록과 연결 (차감인 경우)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Payment payment; // 결제 기록과 연결 (충전인 경우)

    @Column(nullable = false)
    private LocalDateTime transactionDate = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    @Column(nullable = false)
    private Integer changeAmount; // 변경량 (+: 충전, -: 차감)

    @Column(name = "remaining_count_after")
    private Integer remainingCountAfter; // 변경 후 잔여 횟수

    @Column(length = 500)
    private String description; // 설명 (예: "체크인으로 인한 차감", "결제로 인한 충전")

    public enum TransactionType {
        CHARGE,     // 충전
        DEDUCT,     // 차감
        ADJUST      // 조정
    }
}
