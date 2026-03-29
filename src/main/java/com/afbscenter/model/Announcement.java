package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "announcements")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String title; // 제목

    @Column(nullable = false, length = 5000)
    private String content; // 내용

    @Column(name = "start_date")
    private LocalDate startDate; // 시작일

    @Column(name = "end_date")
    private LocalDate endDate; // 종료일

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(nullable = false, length = 50)
    private String type = "GENERAL"; // 공지 타입

    /** 회원 예약 페이지(비로그인)에 노출 — 운영자만 체크 시 공개 */
    @Column(name = "visible_to_members", nullable = false)
    private Boolean visibleToMembers = false;

    /**
     * true면 대시보드 활성 공지·직원 종 알림에서 제외. 회원 공개 API와 공지 관리 목록에는 그대로 표시.
     * 회원에게 공개하지 않을 때는 의미 없으므로 항상 false로 둔다.
     */
    @Column(name = "hide_from_staff_feed", nullable = false)
    private Boolean hideFromStaffFeed = false;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (active == null) {
            active = true;
        }
        if (type == null) {
            type = "GENERAL";
        }
        if (visibleToMembers == null) {
            visibleToMembers = false;
        }
        if (hideFromStaffFeed == null) {
            hideFromStaffFeed = false;
        }
        if (!Boolean.TRUE.equals(visibleToMembers)) {
            hideFromStaffFeed = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (!Boolean.TRUE.equals(visibleToMembers)) {
            hideFromStaffFeed = false;
        }
    }
}
