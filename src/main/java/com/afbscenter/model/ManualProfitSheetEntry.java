package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 수기 수익 정산표 한 칸. 결제 집계와 무관하며 직접 입력한 금액만 저장한다.
 */
@Entity
@Table(name = "manual_profit_sheet_entries", uniqueConstraints = {
        @UniqueConstraint(name = "uk_profit_sheet_cell",
                columnNames = {"entry_year", "entry_month", "entry_day", "coach_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualProfitSheetEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_year", nullable = false)
    private Integer year;

    @Column(name = "entry_month", nullable = false)
    private Integer month;

    @Column(name = "entry_day", nullable = false)
    private Integer day;

    @Column(name = "coach_id", nullable = false)
    private Long coachId;

    @Column(nullable = false)
    private Long amount;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = LocalDateTime.now();
    }
}
