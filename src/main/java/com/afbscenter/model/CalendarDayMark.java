package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 예약 달력용 공휴일·메모·빨간날(숫자 색) 표시
 */
@Entity
@Table(name = "calendar_day_marks", uniqueConstraints = {
        @UniqueConstraint(name = "uk_calendar_day_marks_date", columnNames = "mark_date")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CalendarDayMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "mark_date", nullable = false, unique = true)
    private LocalDate markDate;

    @Column(length = 2000)
    private String memo;

    @Column(name = "red_day", nullable = false)
    private boolean redDay = true;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = LocalDateTime.now();
    }
}
