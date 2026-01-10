package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "baseball_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BaseballRecord {

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
    private Position position;

    // 타격 기록
    @Column(name = "at_bats")
    private Integer atBats; // 타석

    @Column(name = "hits")
    private Integer hits; // 안타

    @Column(name = "home_runs")
    private Integer homeRuns; // 홈런

    @Column(name = "runs_batted_in")
    private Integer runsBattedIn; // 타점

    @Column(name = "strikeouts")
    private Integer strikeouts; // 삼진

    @Column(name = "walks")
    private Integer walks; // 볼넷

    // 투구 기록
    @Column(name = "innings_pitched")
    private Double inningsPitched; // 이닝

    @Column(name = "earned_runs")
    private Integer earnedRuns; // 자책점

    @Column(name = "strikeouts_pitched")
    private Integer strikeoutsPitched; // 탈삼진

    @Column(name = "walks_pitched")
    private Integer walksPitched; // 볼넷

    @Column(name = "hits_allowed")
    private Integer hitsAllowed; // 피안타

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
