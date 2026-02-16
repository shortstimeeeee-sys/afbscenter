package com.afbscenter.model;

import com.afbscenter.model.converter.DayOfWeekIntegerConverter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

/**
 * 시설별 요일별 운영 슬롯.
 * 요일(1=월~7=일), 시작/종료 시간, 운영 여부를 DB에 저장해 예약 가능 시간 제한에 사용.
 */
@Entity
@Table(name = "facility_slots", uniqueConstraints = {
    @UniqueConstraint(columnNames = { "facility_id", "day_of_week" })
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FacilitySlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "facility_id", nullable = false)
    @JsonIgnore
    private Facility facility;

    /** 요일 (1=월요일 ~ 7=일요일, java.time.DayOfWeek과 동일). DB는 varchar로 저장(기존 MONDAY 등 호환) */
    @NotNull
    @Min(1)
    @Max(7)
    @Convert(converter = DayOfWeekIntegerConverter.class)
    @Column(name = "day_of_week", nullable = false, columnDefinition = "varchar(20)")
    private Integer dayOfWeek;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    /** 해당 요일에 운영 여부. false면 예약 불가 */
    @Column(name = "is_open", nullable = false)
    private Boolean isOpen = true;
}
