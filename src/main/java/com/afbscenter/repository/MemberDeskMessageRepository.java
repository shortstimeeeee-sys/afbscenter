package com.afbscenter.repository;

import com.afbscenter.model.MemberDeskMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MemberDeskMessageRepository extends JpaRepository<MemberDeskMessage, Long> {

    List<MemberDeskMessage> findByMember_IdOrderByCreatedAtAsc(Long memberId);

    /** 회원 공개 화면: 초기화 시각 이후 쪽지만 (clearedAt null이면 전체) */
    @Query("SELECT m FROM MemberDeskMessage m WHERE m.member.id = :memberId "
            + "AND (:clearedAt IS NULL OR m.createdAt > :clearedAt) ORDER BY m.createdAt ASC")
    List<MemberDeskMessage> findForMemberPublicView(@Param("memberId") Long memberId,
                                                     @Param("clearedAt") LocalDateTime clearedAt);

    @Query("SELECT COUNT(m) FROM MemberDeskMessage m WHERE m.member.id = :memberId "
            + "AND m.fromMember = false AND m.readByMember = false "
            + "AND (:clearedAt IS NULL OR m.createdAt > :clearedAt)")
    long countUnreadAdminForMemberPublic(@Param("memberId") Long memberId,
                                        @Param("clearedAt") LocalDateTime clearedAt);

    @Query("SELECT m FROM MemberDeskMessage m WHERE m.member.id = :memberId "
            + "AND m.fromMember = false AND m.readByMember = false "
            + "AND (:clearedAt IS NULL OR m.createdAt > :clearedAt) ORDER BY m.createdAt DESC")
    List<MemberDeskMessage> findUnreadAdminForMemberPublicPreview(@Param("memberId") Long memberId,
                                                                  @Param("clearedAt") LocalDateTime clearedAt,
                                                                  Pageable pageable);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE MemberDeskMessage m SET m.readByMember = true WHERE m.member.id = :memberId "
            + "AND m.fromMember = false AND (:clearedAt IS NULL OR m.createdAt > :clearedAt)")
    int markVisibleAdminPostsReadByMember(@Param("memberId") Long memberId,
                                         @Param("clearedAt") LocalDateTime clearedAt);

    /** 관리자→회원 미읽음 쪽지, 최신순 최대 5건 (종 알림 미리보기, 읽음 처리 없음) */
    List<MemberDeskMessage> findTop5ByMember_IdAndFromMemberIsFalseAndReadByMemberIsFalseOrderByCreatedAtDesc(
            Long memberId);

    @Modifying
    @Transactional
    @Query("DELETE FROM MemberDeskMessage m WHERE m.member.id = :memberId")
    int deleteAllByMember_Id(@Param("memberId") Long memberId);

    @Query("SELECT COUNT(m) FROM MemberDeskMessage m WHERE m.member.id = :memberId AND m.fromMember = false AND m.readByMember = false")
    long countUnreadAdminMessagesForMember(@Param("memberId") Long memberId);

    @Query("SELECT COUNT(m) FROM MemberDeskMessage m WHERE m.member.id = :memberId AND m.fromMember = true AND m.readByAdmin = false")
    long countUnreadMemberMessagesForAdmin(@Param("memberId") Long memberId);

    @Query("SELECT COUNT(m) FROM MemberDeskMessage m WHERE m.fromMember = true AND m.readByAdmin = false")
    long countTotalUnreadFromMembers();

    @Query(value = "SELECT member_id FROM member_desk_messages GROUP BY member_id ORDER BY MAX(created_at) DESC", nativeQuery = true)
    List<Long> findMemberIdsByRecentActivity();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE MemberDeskMessage m SET m.readByAdmin = true WHERE m.fromMember = true AND m.readByAdmin = false")
    int markAllMemberPostsReadByAdmin();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE MemberDeskMessage m SET m.readByAdmin = true WHERE m.member.id = :memberId AND m.fromMember = true")
    int markMemberPostsReadByAdmin(@Param("memberId") Long memberId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE MemberDeskMessage m SET m.readByMember = true WHERE m.member.id = :memberId AND m.fromMember = false")
    int markAdminPostsReadByMember(@Param("memberId") Long memberId);
}
