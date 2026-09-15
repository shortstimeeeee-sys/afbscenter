package com.afbscenter.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "coach_work_records", uniqueConstraints = {
        @UniqueConstraint(name = "uk_coach_work_date", columnNames = {"coach_id", "work_date"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CoachWorkRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @NotNull
    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "check_in_time")
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "day_type", nullable = false, length = 20)
    private DayType dayType = DayType.WORK;

    @Size(max = 500)
    @Column(length = 500)
    private String memo;

    public enum DayType {
        WORK,
        OFF,
        SICK,
        OUTDOOR
    }
}
