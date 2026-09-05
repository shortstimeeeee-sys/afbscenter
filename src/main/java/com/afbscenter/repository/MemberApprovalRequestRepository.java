package com.afbscenter.repository;

import com.afbscenter.model.MemberApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberApprovalRequestRepository extends JpaRepository<MemberApprovalRequest, Long> {

    long countByStatus(MemberApprovalRequest.Status status);

    List<MemberApprovalRequest> findByStatusOrderByRequestedAtDesc(MemberApprovalRequest.Status status);

    @Query("SELECT r FROM MemberApprovalRequest r JOIN FETCH r.member WHERE r.status = :status ORDER BY r.requestedAt DESC")
    List<MemberApprovalRequest> findByStatusWithMemberOrderByRequestedAtDesc(@Param("status") MemberApprovalRequest.Status status);

    /** member FK 기준 — {@code memberId} 단일 프로퍼티가 없으므로 {@code member.id} 경로를 명시 */
    boolean existsByMember_IdAndStatusAndRequestType(
            Long memberId,
            MemberApprovalRequest.Status status,
            MemberApprovalRequest.RequestType requestType);

    boolean existsByExtensionMemberProductIdAndStatus(
            Long extensionMemberProductId,
            MemberApprovalRequest.Status status);

    /** 신규 가입 승인 대기(NEW_MEMBER) 1건 — 이용권 의도를 같은 건에 합칠 때 사용 */
    Optional<MemberApprovalRequest> findFirstByMember_IdAndStatusAndRequestTypeOrderByRequestedAtDesc(
            Long memberId,
            MemberApprovalRequest.Status status,
            MemberApprovalRequest.RequestType requestType);

    /** API 응답 직렬화용: member를 한 번에 로드 (컨트롤러 세션 밖에서도 안전) */
    @Query("SELECT r FROM MemberApprovalRequest r JOIN FETCH r.member WHERE r.id = :id")
    Optional<MemberApprovalRequest> findByIdWithMember(@Param("id") Long id);
}
