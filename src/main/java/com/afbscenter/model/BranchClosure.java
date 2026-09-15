package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 휴무 그룹 저장.
 * 사하=SAHA/BASEBALL, 연산=YEONSAN/BASEBALL, 비 야구파트=RENTAL/BASEBALL.
 */
@Entity
@Table(name = "branch_closures", uniqueConstraints = {
        @UniqueConstraint(name = "uk_branch_closures_branch_part_date",
                columnNames = { "branch", "calendar_part", "closure_date" })
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BranchClosure {

    public enum ClosureGroup {
        SAHA,
        YEONSAN,
        NON_BASEBALL
    }

    public enum CalendarPart {
        BASEBALL,
        NON_BASEBALL,
        TRAINING,
        PILATES
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "branch", nullable = false, length = 20)
    private Facility.Branch branch;

    @Enumerated(EnumType.STRING)
    @Column(name = "calendar_part", nullable = false, length = 20,
            columnDefinition = "VARCHAR(20) DEFAULT 'BASEBALL' NOT NULL")
    private CalendarPart calendarPart = CalendarPart.BASEBALL;

    @Column(name = "closure_date", nullable = false)
    private LocalDate closureDate;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        if (calendarPart == null) {
            calendarPart = CalendarPart.BASEBALL;
        }
        updatedAt = LocalDateTime.now();
    }
}
