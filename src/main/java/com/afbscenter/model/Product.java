package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@AllArgsConstructor
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "상품명은 필수입니다")
    @Size(max = 255, message = "상품명은 255자 이하여야 합니다")
    @Column(nullable = false)
    private String name;

    @Size(max = 1000, message = "설명은 1000자 이하여야 합니다")
    @Column(length = 1000)
    private String description;

    @NotNull(message = "상품 유형은 필수입니다")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductType type;

    @NotNull(message = "가격은 필수입니다")
    @PositiveOrZero(message = "가격은 0 이상이어야 합니다")
    @Column(nullable = false)
    private Integer price;

    @Column(name = "valid_days")
    private Integer validDays; // 유효기간 (일)

    @Column(name = "usage_count")
    private Integer usageCount; // 사용 횟수 (이용권인 경우)

    @Column(name = "package_items", length = 2000)
    private String packageItems; // 패키지 구성 (JSON 형태: [{"name":"야구장","count":10},...])

    @Column(length = 1000)
    private String conditions; // 사용 조건 (추가 안내사항)

    @Column(length = 1000)
    private String refundPolicy; // 환불 규정

    @Enumerated(EnumType.STRING)
    @Column(name = "category")
    private ProductCategory category; // 상품 카테고리 (야구/트레이닝 등)

    @Column(nullable = false)
    private Boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    @JsonIgnore
    private Coach coach; // 상품 담당 코치

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<MemberProduct> memberProducts = new ArrayList<>();

    public enum ProductType {
        SINGLE_USE,     // 단건 대관
        TIME_PASS,      // 시간권
        COUNT_PASS,     // 횟수권 (10회권 등)
        MONTHLY_PASS,   // 월정기
        TEAM_PACKAGE    // 팀 대관 패키지
    }

    public enum ProductCategory {
        BASEBALL,           // 야구
        TRAINING_FITNESS,   // 트레이닝+필라테스
        TRAINING,           // 트레이닝
        PILATES,            // 필라테스
        GENERAL,            // 일반/공통
        RENTAL              // 대관
    }
}
