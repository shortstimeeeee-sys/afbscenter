package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "lessons")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Lesson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id", nullable = false)
    private Coach coach;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LessonType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LessonCategory category; // 레슨 카테고리

    @Column(length = 2000)
    private String notes; // 수업 메모

    @Column(length = 2000)
    private String homework; // 과제

    @Column(length = 2000)
    private String nextPlan; // 다음 수업 계획

    @Column(name = "created_at", nullable = false)
    private java.time.LocalDateTime createdAt = java.time.LocalDateTime.now();

    public enum LessonType {
        INDIVIDUAL, // 개인
        GROUP,      // 그룹
        CLINIC      // 클리닉
    }

    public enum LessonCategory {
        BASEBALL,   // 야구 레슨
        PILATES,    // 필라테스 레슨
        TRAINING    // 트레이닝 파트
    }
}
