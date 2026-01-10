package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000, nullable = false)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false)
    private TargetType targetType;

    @Column(name = "target_value")
    private String targetValue; // 대상 값 (등급, 회원 ID 등)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageStatus status = MessageStatus.PENDING;

    @Column(name = "sent_at")
    private LocalDateTime sentAt; // 발송 시간

    @Column(name = "sent_count")
    private Integer sentCount = 0; // 발송 건수

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum TargetType {
        ALL,            // 전체
        GRADE,          // 등급별
        MEMBER,         // 특정 회원
        BOOKING         // 예약자
    }

    public enum MessageStatus {
        PENDING,        // 대기
        SENT,           // 발송 완료
        FAILED          // 발송 실패
    }
}
