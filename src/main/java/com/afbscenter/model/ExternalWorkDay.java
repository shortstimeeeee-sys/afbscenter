package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 외부업무 반복 일정(날짜). 유소년 체험·사회인 야외·휴무와 별도로 관리한다.
 */
@Entity
@Table(name = "external_work_days", uniqueConstraints = {
        @UniqueConstraint(name = "uk_external_work_days_date", columnNames = "work_date")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExternalWorkDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "work_date", nullable = false, unique = true)
    private LocalDate workDate;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = LocalDateTime.now();
    }
}
