package com.afbscenter.repository;

import com.afbscenter.model.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {
    
    List<Member> findByName(String name);

    Optional<Member> findByPhoneNumber(String phoneNumber);
    
    Optional<Member> findByMemberNumber(String memberNumber);
    
    List<Member> findByNameContaining(String name);

    List<Member> findBySchoolContainingIgnoreCase(String school);
    
    List<Member> findByMemberNumberContaining(String memberNumber);
    
    List<Member> findByPhoneNumberContaining(String phoneNumber);
    
    @Query("SELECT DISTINCT m FROM Member m LEFT JOIN FETCH m.coach ORDER BY m.name")
    List<Member> findAllOrderByName();
    
    @Query("SELECT m FROM Member m LEFT JOIN FETCH m.coach WHERE m.id = :id")
    Optional<Member> findByIdWithCoach(@Param("id") Long id);
    
    @Query("SELECT m FROM Member m LEFT JOIN FETCH m.coach WHERE m.id = :id")
    Optional<Member> findByIdWithCoachAndProducts(@Param("id") Long id);
    
    @Query("SELECT m FROM Member m WHERE m.coach.id = :coachId")
    List<Member> findByCoachId(@Param("coachId") Long coachId);

    /** 운영 코치 viewCoachIds: 회원 기본 담당 코치가 목록에 포함되는 회원 ID */
    @Query("SELECT m.id FROM Member m WHERE m.coach IS NOT NULL AND m.coach.id IN :coachIds")
    List<Long> findMemberIdsByCoachIdIn(@Param("coachIds") List<Long> coachIds);

    @Query("SELECT CASE WHEN COUNT(m) > 0 THEN true ELSE false END FROM Member m WHERE m.id = :memberId AND m.coach IS NOT NULL AND m.coach.id = :coachId")
    boolean existsByIdAndCoachId(@Param("memberId") Long memberId, @Param("coachId") Long coachId);
    
    @Query("SELECT COUNT(m) FROM Member m WHERE m.joinDate = :date")
    Long countByJoinDate(@Param("date") java.time.LocalDate date);
    
    @Query("SELECT COUNT(m) FROM Member m WHERE m.joinDate >= :startDate AND m.joinDate <= :endDate")
    Long countByJoinDateRange(@Param("startDate") java.time.LocalDate startDate, @Param("endDate") java.time.LocalDate endDate);

    long countByStatus(Member.MemberStatus status);
    long countByGrade(Member.MemberGrade grade);

    /** 활성 이용권이 없고, 회원 기본 담당 코치가 퇴사(active=false)인 회원 */
    @Query("SELECT m.id FROM Member m JOIN m.coach c WHERE m.status = 'ACTIVE' AND c.active = false " +
           "AND NOT EXISTS (SELECT 1 FROM MemberProduct mp WHERE mp.member.id = m.id AND mp.deletedAt IS NULL AND mp.status = 'ACTIVE')")
    List<Long> findActiveMemberIdsUnspecifiedDueToResignedMemberCoach();

    List<Member> findByGrade(Member.MemberGrade grade);

    List<Member> findByGradeAndStatus(Member.MemberGrade grade, Member.MemberStatus status);

    /** 자동 휴면 후보: 활성 회원 중 최근 방문(없으면 가입일)이 cutoff 이전 */
    @Query("SELECT m FROM Member m WHERE m.status = 'ACTIVE' AND (" +
           "(m.lastVisitDate IS NOT NULL AND m.lastVisitDate <= :cutoff) OR " +
           "(m.lastVisitDate IS NULL AND m.joinDate <= :cutoff))")
    List<Member> findActiveMembersUnvisitedSince(@Param("cutoff") java.time.LocalDate cutoff);
}
