package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "training_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrainingLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false)
    private LocalDate recordDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TrainingType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "training_part", nullable = false)
    private TrainingPart part; // 트레이닝 파트

    // 타격 기록
    @Column(name = "swing_count")
    private Integer swingCount; // 스윙수

    @Column(name = "ball_speed")
    private Double ballSpeed; // 타구속도 (km/h)

    @Column(name = "launch_angle")
    private Double launchAngle; // 발사각 (도)

    @Column(name = "hit_direction")
    private String hitDirection; // 타구방향

    @Column(name = "contact_rate")
    private Double contactRate; // 컨택률

    // 투구 기록
    @Column(name = "pitch_speed")
    private Double pitchSpeed; // 구속 (km/h)

    @Column(name = "spin_rate")
    private Integer spinRate; // 회전수 (rpm)

    @Column(name = "pitch_type")
    private String pitchType; // 구종

    @Column(name = "strike_rate")
    private Double strikeRate; // 스트라이크율

    // 체력 기록
    @Column(name = "running_distance")
    private Double runningDistance; // 러닝 거리 (km)

    @Column(name = "weight_training")
    private String weightTraining; // 웨이트 내용

    @Column(name = "condition_score")
    private Integer conditionScore; // 컨디션 점수 (1-10)

    @Column(length = 2000)
    private String notes; // 메모

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum TrainingType {
        BATTING,    // 타격
        PITCHING,   // 투구
        FITNESS     // 체력
    }

    public enum TrainingPart {
        BASEBALL_BATTING,      // 야구 타격
        BASEBALL_PITCHING,     // 야구 투구
        BASEBALL_FIELDING,     // 야구 수비
        BASEBALL_RUNNING,      // 야구 주루
        PILATES_CORE,          // 필라테스 코어
        PILATES_FLEXIBILITY,   // 필라테스 유연성
        PILATES_STRENGTH,      // 필라테스 근력
        GENERAL_FITNESS,       // 일반 체력
        WEIGHT_TRAINING        // 웨이트 트레이닝
    }
}
