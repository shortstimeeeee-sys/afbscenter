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
 * 사회인 야외 레슨 참가 인원 (날짜별 명단)
 */
@Entity
@Table(name = "outdoor_lesson_participants")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OutdoorLessonParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "lesson_date", nullable = false)
    private LocalDate lessonDate;

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

    /** 팀 예약 시 참가 인원. 개인은 1. */
    @Column(name = "headcount")
    private Integer headcount = 1;

    /** 팀으로 체크한 예약. 이때만 인원 숫자·팀 이용권 차감을 쓴다. */
    @Column(name = "team_booking", nullable = false)
    private boolean teamBooking = false;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "deposit_amount")
    private Integer depositAmount;

    @Column(name = "deposit_confirmed", nullable = false)
    private boolean depositConfirmed = false;

    @Column(name = "attended", nullable = false)
    private boolean attended = false;

    /** 횟수권 잔여. 이 날짜 레슨을 시작하기 직전 기준. */
    @Column(name = "remaining_count")
    private Integer remainingCount;

    /** 이 날짜 이전에 쓴 차수를 아직 빼지 못한 경우, 차감 기준 날짜 */
    @Column(name = "pending_deduct_date")
    private LocalDate pendingDeductDate;

    /** 이 날짜 참여분(팀이면 인원 수)을 이용권에서 이미 뺀 경우 */
    @Column(name = "count_pass_applied", nullable = false)
    private boolean countPassApplied = false;

    /** 날짜 변경 요청으로 이 날짜로 넘어온 경우, 직전 레슨 날짜 */
    @Column(name = "carried_from_date")
    private LocalDate carriedFromDate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

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
