package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 예약 관련 관리자 작업 로그 (예: 일괄 승인)
 */
@Entity
@Table(name = "booking_audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public static BookingAuditLog of(String username, String action, String details) {
        BookingAuditLog log = new BookingAuditLog();
        log.setUsername(username != null ? username : "unknown");
        log.setAction(action != null ? action : "");
        log.setDetails(details);
        log.setCreatedAt(LocalDateTime.now());
        return log;
    }
}
