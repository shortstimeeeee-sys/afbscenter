package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "facilities")
@Data
@NoArgsConstructor
@AllArgsConstructor
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Facility {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "시설명은 필수입니다")
    @Size(max = 255, message = "시설명은 255자 이하여야 합니다")
    @Column(nullable = false)
    private String name;

    @Column
    private String location;

    @Column(name = "capacity")
    private Integer capacity; // 수용 인원

    @Column(name = "hourly_rate")
    private Integer hourlyRate; // 시간당 단가

    @Column(name = "open_time")
    private LocalTime openTime; // 운영 시작 시간

    @Column(name = "close_time")
    private LocalTime closeTime; // 운영 종료 시간

    @Column(length = 1000)
    private String equipment; // 사용 가능 장비 (쉼표로 구분)

    @Enumerated(EnumType.STRING)
    @Column(name = "branch", nullable = false)
    private Branch branch = Branch.SAHA; // 소속 지점 (기본값: 사하점)

    @Enumerated(EnumType.STRING)
    @Column(name = "facility_type", nullable = false)
    private FacilityType facilityType = FacilityType.BASEBALL; // 시설 타입 (기본값: 야구)

    @Column(nullable = false)
    private Boolean active = true;

    @OneToMany(mappedBy = "facility", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Booking> bookings = new ArrayList<>();

    public enum Branch {
        SAHA,       // 사하점
        YEONSAN,    // 연산점
        RENTAL      // 대관 (공용)
    }

    public enum FacilityType {
        BASEBALL,           // 야구 (배팅케이지, 피칭머신존 등)
        TRAINING_FITNESS,   // 트레이닝+필라테스 (트레이닝룸, 필라테스룸 등)
        RENTAL,             // 대관 (실내구장 등)
        ALL                 // 전체 (야구, 필라테스, 트레이닝 모두)
    }
}
