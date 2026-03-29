package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Settings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 레거시 DB 호환: 단일 설정 행 식별 (NOT NULL 컬럼과 매핑)
     */
    @Column(name = "setting_key", length = 64, nullable = false)
    private String settingKey = "main";

    // 센터 기본 정보 (지점별)
    @Column(name = "center_name_saha", length = 100)
    private String centerNameSaha; // 사하점 센터명

    @Column(name = "center_name_yeonsan", length = 100)
    private String centerNameYeonsan; // 연산점 센터명

    @Column(name = "phone_number_saha", length = 20)
    private String phoneNumberSaha; // 사하점 연락처

    @Column(name = "phone_number_yeonsan", length = 20)
    private String phoneNumberYeonsan; // 연산점 연락처

    @Column(name = "address_saha", length = 200)
    private String addressSaha; // 사하점 주소

    @Column(name = "address_yeonsan", length = 200)
    private String addressYeonsan; // 연산점 주소

    // 하위 호환성을 위한 필드 (deprecated)
    @Column(name = "center_name", length = 100)
    private String centerName; // 센터명 (하위 호환)

    @Column(name = "phone_number", length = 20)
    private String phoneNumber; // 연락처 (하위 호환)

    @Column(name = "address", length = 200)
    private String address; // 주소 (하위 호환)

    @Column(name = "business_number", length = 50)
    private String businessNumber; // 사업자 등록번호

    // 운영 시간
    @Column(name = "operating_hours", length = 100)
    private String operatingHours; // 운영시간 (한 줄 텍스트, 예: "09:00 ~ 22:00")

    @Column(name = "holiday_info", length = 200)
    private String holidayInfo; // 휴무일 정보

    // 예약 설정
    @Column(name = "default_session_duration")
    private Integer defaultSessionDuration; // 기본 세션 시간 (분)

    @Column(name = "max_advance_booking_days")
    private Integer maxAdvanceBookingDays; // 최대 사전 예약 일수

    @Column(name = "cancellation_deadline_hours")
    private Integer cancellationDeadlineHours; // 취소 마감 시간 (시간)

    // 결제 설정
    @Column(name = "tax_rate")
    private Double taxRate; // 세율 (%)

    @Column(name = "refund_policy", length = 500)
    private String refundPolicy; // 환불 정책

    // 알림 설정
    @Column(name = "sms_enabled")
    private Boolean smsEnabled; // SMS 알림 사용 여부

    @Column(name = "email_enabled")
    private Boolean emailEnabled; // 이메일 알림 사용 여부

    @Column(name = "reminder_hours")
    private Integer reminderHours; // 예약 리마인더 시간 (시간)

    // 기타
    @Column(name = "notes", length = 1000)
    private String notes; // 비고

    /** 회비 입금 전용계좌 안내 (전달 사항 · 공지/메시지 페이지에서 편집) */
    @Column(name = "membership_dues_account_notice", length = 2000)
    private String membershipDuesAccountNotice;

    /** 상단 알림(종)에 회비 입금 전용계좌 안내 표시 여부 */
    @Column(name = "show_membership_dues_in_bell")
    private Boolean showMembershipDuesInBell = true;

    /** 회원 쪽지함(공지/메시지) 잠금 PIN — BCrypt 해시, null/공백이면 잠금 미사용 */
    @Column(name = "desk_inbox_lock_pin_hash", length = 120)
    private String deskInboxLockPinHash;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt; // 수정 시간

    @PrePersist
    protected void onCreate() {
        if (settingKey == null || settingKey.isBlank()) {
            settingKey = "main";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
