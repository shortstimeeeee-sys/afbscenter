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
    private String recipient; // 수신자 (전화번호 또는 "전체")

    @Column(nullable = false, length = 1000)
    private String content; // 메시지 내용

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageStatus status = MessageStatus.PENDING; // 발송 상태

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageType type = MessageType.SMS; // 메시지 유형

    @Column(name = "sent_at")
    private LocalDateTime sentAt; // 발송 시간

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt; // 생성 시간

    @Column(name = "error_message")
    private String errorMessage; // 실패 시 에러 메시지

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public enum MessageStatus {
        PENDING,    // 대기중
        SENT,       // 발송 완료
        FAILED      // 발송 실패
    }

    public enum MessageType {
        SMS,        // 단문 메시지
        LMS,        // 장문 메시지
        ALIMTALK    // 알림톡
    }
}
