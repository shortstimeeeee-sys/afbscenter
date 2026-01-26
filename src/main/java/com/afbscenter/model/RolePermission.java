package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "role_permissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RolePermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "role", nullable = false, length = 20)
    private String role; // ADMIN, MANAGER, COACH, FRONT

    // 권한 항목들 (JSON 형태로 저장하거나 개별 필드로)
    // 회원 관리
    @Column(name = "member_view")
    private Boolean memberView = true;

    @Column(name = "member_create")
    private Boolean memberCreate = true;

    @Column(name = "member_edit")
    private Boolean memberEdit = true;

    @Column(name = "member_delete")
    private Boolean memberDelete = false;

    // 예약 관리
    @Column(name = "booking_view")
    private Boolean bookingView = true;

    @Column(name = "booking_create")
    private Boolean bookingCreate = true;

    @Column(name = "booking_edit")
    private Boolean bookingEdit = true;

    @Column(name = "booking_delete")
    private Boolean bookingDelete = false;

    // 코치 관리
    @Column(name = "coach_view")
    private Boolean coachView = true;

    @Column(name = "coach_create")
    private Boolean coachCreate = false;

    @Column(name = "coach_edit")
    private Boolean coachEdit = false;

    @Column(name = "coach_delete")
    private Boolean coachDelete = false;

    // 상품 관리
    @Column(name = "product_view")
    private Boolean productView = true;

    @Column(name = "product_create")
    private Boolean productCreate = false;

    @Column(name = "product_edit")
    private Boolean productEdit = false;

    @Column(name = "product_delete")
    private Boolean productDelete = false;

    // 결제 관리
    @Column(name = "payment_view")
    private Boolean paymentView = true;

    @Column(name = "payment_create")
    private Boolean paymentCreate = true;

    @Column(name = "payment_edit")
    private Boolean paymentEdit = false;

    @Column(name = "payment_refund")
    private Boolean paymentRefund = false;

    // 통계 조회
    @Column(name = "analytics_view")
    private Boolean analyticsView = false;

    // 대시보드 조회
    @Column(name = "dashboard_view")
    private Boolean dashboardView = true;

    // 설정 관리
    @Column(name = "settings_view")
    private Boolean settingsView = false;

    @Column(name = "settings_edit")
    private Boolean settingsEdit = false;

    // 사용자 관리
    @Column(name = "user_view")
    private Boolean userView = false;

    @Column(name = "user_create")
    private Boolean userCreate = false;

    @Column(name = "user_edit")
    private Boolean userEdit = false;

    @Column(name = "user_delete")
    private Boolean userDelete = false;

    // 공지사항 관리
    @Column(name = "announcement_view")
    private Boolean announcementView = true;

    @Column(name = "announcement_create")
    private Boolean announcementCreate = false;

    @Column(name = "announcement_edit")
    private Boolean announcementEdit = false;

    @Column(name = "announcement_delete")
    private Boolean announcementDelete = false;

    // 출석 관리
    @Column(name = "attendance_view")
    private Boolean attendanceView = true;

    @Column(name = "attendance_edit")
    private Boolean attendanceEdit = true;

    // 훈련 기록
    @Column(name = "training_log_view")
    private Boolean trainingLogView = true;

    @Column(name = "training_log_create")
    private Boolean trainingLogCreate = true;

    @Column(name = "training_log_edit")
    private Boolean trainingLogEdit = true;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
