package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 사회인 청/백전 반복 일정(날짜). 사회인 야외·유소년 체험·휴무와 별도로 관리한다.
 */
@Entity
@Table(name = "social_scrimmage_days", uniqueConstraints = {
        @UniqueConstraint(name = "uk_social_scrimmage_days_date", columnNames = "scrimmage_date")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SocialScrimmageDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scrimmage_date", nullable = false, unique = true)
    private LocalDate scrimmageDate;

    /** 사용시간 표시용 자유 입력 (예: 10:00 - 12:00) */
    @Column(name = "time_text", length = 80)
    private String timeText;

    /** SAHA / YEONSAN */
    @Column(name = "branch", length = 20)
    private String branch;

    @Column(name = "coach_id")
    private Long coachId;

    /** 장소 표시 (예: BPA 야구장) */
    @Column(name = "place", length = 80)
    private String place;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = LocalDateTime.now();
    }
}
