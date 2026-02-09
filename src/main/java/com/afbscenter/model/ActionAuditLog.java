package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 전체/일괄 통제 등 관리자 작업 감사 로그 (회원 전체 삭제, 상품 일괄 수정, 결제 일괄 생성, 출석 리셋 등)
 */
@Entity
@Table(name = "action_audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActionAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "action", nullable = false, length = 80)
    private String action;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public static ActionAuditLog of(String username, String action, String details) {
        ActionAuditLog log = new ActionAuditLog();
        log.setUsername(username != null ? username : "unknown");
        log.setAction(action != null ? action : "");
        log.setDetails(details);
        log.setCreatedAt(LocalDateTime.now());
        return log;
    }
}
