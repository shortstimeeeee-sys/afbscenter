package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "사용자명은 필수입니다")
    @Size(max = 50, message = "사용자명은 50자 이하여야 합니다")
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @NotBlank(message = "비밀번호는 필수입니다")
    @Size(min = 4, message = "비밀번호는 최소 4자 이상이어야 합니다")
    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @NotNull(message = "권한은 필수입니다")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Size(max = 100, message = "이름은 100자 이하여야 합니다")
    @Column(length = 100)
    private String name; // 실제 이름

    @Size(max = 20, message = "전화번호는 20자 이하여야 합니다")
    @Column(length = 20)
    private String phoneNumber;

    @Column(nullable = false)
    private Boolean active = true; // 계정 활성화 여부

    @Column(name = "approved", nullable = false)
    private Boolean approved = true; // 관리자 승인 여부 (회원가입 시 false)

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Role {
        ADMIN,      // 관리자 - 모든 기능 접근 가능
        MANAGER,    // 매니저 - 관리 기능 접근 가능
        COACH,      // 코치 - 코치 관련 기능 접근
        FRONT       // 데스크 - 데스크 기능 접근
    }
}
