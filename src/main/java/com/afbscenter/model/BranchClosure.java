package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 휴무 저장.
 * 지점 전체는 calendar_part=ALL, 파트는 BASEBALL/TRAINING/PILATES/YOUTH/SOCIAL/RENTAL.
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
        SAHA_BASEBALL,
        SAHA_TRAINING,
        SAHA_PILATES,
        YEONSAN,
        YEONSAN_BASEBALL,
        YEONSAN_PILATES,
        NON_BASEBALL,
        YOUTH,
        SOCIAL,
        RENTAL
    }

    public enum CalendarPart {
        ALL,
        BASEBALL,
        NON_BASEBALL,
        TRAINING,
        PILATES,
        YOUTH,
        SOCIAL,
        RENTAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "branch", nullable = false, length = 20)
    private Facility.Branch branch;

    @Enumerated(EnumType.STRING)
    @Column(name = "calendar_part", nullable = false, length = 20,
            columnDefinition = "VARCHAR(20) DEFAULT 'ALL' NOT NULL")
    private CalendarPart calendarPart = CalendarPart.ALL;

    @Column(name = "closure_date", nullable = false)
    private LocalDate closureDate;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        if (calendarPart == null) {
            calendarPart = CalendarPart.ALL;
        }
        updatedAt = LocalDateTime.now();
    }
}
