package com.afbscenter.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 사회인 청백전 참가 명단 (날짜별)
 */
@Entity
@Table(name = "social_scrimmage_participants")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SocialScrimmageParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "match_date", nullable = false)
    private LocalDate matchDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "branch", nullable = false, length = 20)
    private Booking.Branch branch = Booking.Branch.SAHA;

    @NotNull
    @Column(name = "seq_no", nullable = false)
    private Integer seqNo = 1;

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String name;

    @Size(max = 100)
    @Column(length = 100)
    private String team;

    @Size(max = 20)
    @Column(length = 20)
    private String phone;

    /** 청 / 백 */
    @Enumerated(EnumType.STRING)
    @Column(name = "side", length = 16)
    private Side side;

    /** 희망 포지션 */
    @Size(max = 16)
    @Column(name = "hoped_position", length = 16)
    private String hopedPosition;

    /** 실제 배치 포지션 (그라운드 표시) */
    @Size(max = 16)
    @Column(name = "assigned_position", length = 16)
    private String assignedPosition;

    @Size(max = 500)
    @Column(length = 500)
    private String memo;

    /** 야외 레슨 횟수권과 공유 (이름+연락처 일치 시) */
    @Column(name = "product_id")
    private Long productId;

    /** 이 경기 차감 직전 잔여(표시·복구용) */
    @Column(name = "remaining_count")
    private Integer remainingCount;

    @Column(name = "pending_deduct_date")
    private LocalDate pendingDeductDate;

    @Column(name = "count_pass_applied", nullable = false)
    private boolean countPassApplied = false;

    @Column(name = "deposit_amount")
    private Integer depositAmount;

    @Column(name = "deposit_confirmed", nullable = false)
    private boolean depositConfirmed = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Side {
        BLUE,   // 청
        WHITE   // 백
    }

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
