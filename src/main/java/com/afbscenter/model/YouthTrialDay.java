package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 유소년 체험 반복 일정(날짜). 휴무와 별도로 관리한다.
 */
@Entity
@Table(name = "youth_trial_days", uniqueConstraints = {
        @UniqueConstraint(name = "uk_youth_trial_days_date", columnNames = "trial_date")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class YouthTrialDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trial_date", nullable = false, unique = true)
    private LocalDate trialDate;

    /** 사용시간 표시용 자유 입력 (예: 10:00 - 12:00) */
    @Column(name = "time_text", length = 80)
    private String timeText;

    /** SAHA / YEONSAN */
    @Column(name = "branch", length = 20)
    private String branch;

    @Column(name = "coach_id")
    private Long coachId;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = LocalDateTime.now();
    }
}
