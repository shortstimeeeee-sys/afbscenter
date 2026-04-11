package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 데스크(프론트)·코치 등의 회원 신규/재등록/연장 요청을 관리자·매니저가 검토하기 위한 승인 큐.
 */
@Entity
@Table(name = "member_approval_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "memberProducts", "bookings"})
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 32)
    private RequestType requestType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "requested_by", length = 100)
    private String requestedBy;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt = LocalDateTime.now();

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_note", length = 2000)
    private String reviewNote;

    /** 화면용 한 줄 요약 (예: 신규 등록, 연장 요청) */
    @Column(name = "detail_summary", length = 2000)
    private String detailSummary;

    /** EXTENSION 승인 시 적용할 이용권(MemberProduct) ID */
    @Column(name = "extension_member_product_id")
    private Long extensionMemberProductId;

    /** EXTENSION: 연장 회차 수 */
    @Column(name = "extension_days")
    private Integer extensionDays;

    /** RE_REGISTER: 원본 요청 JSON(POST /members/{id}/products body) */
    @Column(name = "approval_payload", columnDefinition = "TEXT")
    private String approvalPayload;

    @PrePersist
    protected void onCreate() {
        if (requestedAt == null) {
            requestedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = Status.PENDING;
        }
    }

    public enum RequestType {
        NEW_MEMBER,
        RE_REGISTER,
        EXTENSION
    }

    public enum Status {
        PENDING,
        APPROVED,
        REJECTED
    }
}
