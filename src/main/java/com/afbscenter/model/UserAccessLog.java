package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 사용자별 접속(로그인) 로그. 각 ID별 로그인 시 저장.
 */
@Entity
@Table(name = "user_access_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserAccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "login_at", nullable = false)
    private LocalDateTime loginAt;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    public static UserAccessLog of(User user, String ipAddress, String userAgent) {
        UserAccessLog log = new UserAccessLog();
        log.setUserId(user.getId());
        log.setUsername(user.getUsername());
        log.setLoginAt(LocalDateTime.now());
        log.setIpAddress(ipAddress != null && ipAddress.length() > 45 ? ipAddress.substring(0, 45) : ipAddress);
        log.setUserAgent(userAgent != null && userAgent.length() > 500 ? userAgent.substring(0, 500) : userAgent);
        return log;
    }
}
