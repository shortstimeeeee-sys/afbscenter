package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
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
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductType type;

    @Column(nullable = false)
    private Integer price;

    @Column(name = "valid_days")
    private Integer validDays; // 유효기간 (일)

    @Column(name = "usage_count")
    private Integer usageCount; // 사용 횟수 (이용권인 경우)

    @Column(length = 1000)
    private String conditions; // 사용 조건

    @Column(length = 1000)
    private String refundPolicy; // 환불 규정

    @Column(nullable = false)
    private Boolean active = true;

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
}
