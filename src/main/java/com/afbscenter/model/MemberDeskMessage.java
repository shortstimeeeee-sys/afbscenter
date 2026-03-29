package com.afbscenter.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 회원 예약(비로그인) ↔ 데스크(관리자) 쪽지 스레드. SMS용 {@link Message} 엔티티와 별도.
 */
@Entity
@Table(name = "member_desk_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberDeskMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    /** true: 회원이 보낸 글, false: 관리자 답장 */
    @Column(name = "from_member", nullable = false)
    private boolean fromMember;

    @Column(nullable = false, length = 4000)
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** 회원→관리자 글을 관리자가 읽었는지 (관리자 쪽지함 미읽음) */
    @Column(name = "read_by_admin", nullable = false)
    private boolean readByAdmin;

    /** 관리자→회원 글을 회원이 읽었는지 */
    @Column(name = "read_by_member", nullable = false)
    private boolean readByMember;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
