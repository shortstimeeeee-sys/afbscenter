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

    @Column(nullable = false)
    private Boolean active = true;

    @OneToMany(mappedBy = "facility", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<FacilitySlot> slots = new ArrayList<>();

    @OneToMany(mappedBy = "facility", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Booking> bookings = new ArrayList<>();
}
