package com.afbscenter.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "baseball_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class BaseballRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "회원은 필수입니다")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Member member;

    @NotNull(message = "기록 날짜는 필수입니다")
    @Column(nullable = false)
    private LocalDate recordDate;

    @NotNull(message = "포지션은 필수입니다")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Position position;

    // 타격 기록
    @Positive(message = "타석은 0 이상이어야 합니다")
    @Column(name = "at_bats")
    private Integer atBats; // 타석

    @Positive(message = "안타는 0 이상이어야 합니다")
    @Column(name = "hits")
    private Integer hits; // 안타

    @Positive(message = "홈런은 0 이상이어야 합니다")
    @Column(name = "home_runs")
    private Integer homeRuns; // 홈런

    @Positive(message = "타점은 0 이상이어야 합니다")
    @Column(name = "runs_batted_in")
    private Integer runsBattedIn; // 타점

    @Positive(message = "삼진은 0 이상이어야 합니다")
    @Column(name = "strikeouts")
    private Integer strikeouts; // 삼진

    @Positive(message = "볼넷은 0 이상이어야 합니다")
    @Column(name = "walks")
    private Integer walks; // 볼넷

    // 투구 기록
    @Positive(message = "이닝은 0보다 커야 합니다")
    @Column(name = "innings_pitched")
    private Double inningsPitched; // 이닝

    @Positive(message = "자책점은 0 이상이어야 합니다")
    @Column(name = "earned_runs")
    private Integer earnedRuns; // 자책점

    @Positive(message = "탈삼진은 0 이상이어야 합니다")
    @Column(name = "strikeouts_pitched")
    private Integer strikeoutsPitched; // 탈삼진

    @Positive(message = "볼넷은 0 이상이어야 합니다")
    @Column(name = "walks_pitched")
    private Integer walksPitched; // 볼넷

    @Positive(message = "피안타는 0 이상이어야 합니다")
    @Column(name = "hits_allowed")
    private Integer hitsAllowed; // 피안타

    @Size(max = 1000, message = "메모는 1000자 이하여야 합니다")
    @Column(length = 1000)
    private String notes; // 메모

    public enum Position {
        PITCHER, CATCHER, FIRST_BASE, SECOND_BASE, THIRD_BASE, SHORTSTOP, 
        LEFT_FIELD, CENTER_FIELD, RIGHT_FIELD, DESIGNATED_HITTER
    }

    // 타율 계산
    public Double getBattingAverage() {
        if (atBats == null || atBats == 0) return null;
        if (hits == null) return 0.0;
        return (double) hits / atBats;
    }

    // 방어율 계산
    public Double getEarnedRunAverage() {
        if (inningsPitched == null || inningsPitched == 0) return null;
        if (earnedRuns == null) return 0.0;
        return (earnedRuns * 9.0) / inningsPitched;
    }
}
