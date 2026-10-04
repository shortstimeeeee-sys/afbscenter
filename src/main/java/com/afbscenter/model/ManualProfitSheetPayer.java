package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 수기 정산표 한 칸의 납부 내역. 누가 얼마를 냈는지 참고용으로 적는다.
 */
@Entity
@Table(name = "manual_profit_sheet_payers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualProfitSheetPayer {

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

    @Column(name = "payer_name", nullable = false, length = 100)
    private String payerName;

    @Column(nullable = false)
    private Long amount;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = LocalDateTime.now();
    }
}
