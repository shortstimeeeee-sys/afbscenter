package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_products")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"memberProducts"})
    private Product product;

    /** 사람이 보기에 쉬운 이용권 번호 (예: MP-회원ID-상품ID-YYMMDDHHMMSS) */
    @Column(name = "voucher_number", length = 50)
    private String voucherNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Coach coach; // 해당 상품 담당 코치 (회원별로 다를 수 있음)

    @Column(name = "purchase_date", nullable = false)
    private LocalDateTime purchaseDate = LocalDateTime.now();

    @Column(name = "expiry_date")
    private LocalDate expiryDate; // 유효기간 종료일

    @Column(name = "remaining_count")
    private Integer remainingCount; // 잔여 횟수 (일반 상품용)

    @Column(name = "total_count")
    private Integer totalCount; // 총 횟수 (일반 상품용)

    @Column(name = "package_items_remaining", length = 2000)
    private String packageItemsRemaining; // 패키지 항목별 잔여 횟수 (JSON: [{"name":"야구","remaining":10},...])

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    /** 이용권이 종료(EXPIRED/USED_UP)된 시각. 종료 배지 3일 유지 규칙용 */
    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    public enum Status {
        ACTIVE,     // 사용 가능
        EXPIRED,    // 만료
        USED_UP     // 소진
    }
}
