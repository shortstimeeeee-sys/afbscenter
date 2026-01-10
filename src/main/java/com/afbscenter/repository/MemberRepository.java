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
    
    Optional<Member> findByPhoneNumber(String phoneNumber);
    
    Optional<Member> findByMemberNumber(String memberNumber);
    
    List<Member> findByNameContaining(String name);
    
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
    
    @Query("SELECT COUNT(m) FROM Member m WHERE m.joinDate = :date")
    Long countByJoinDate(@Param("date") java.time.LocalDate date);
    
    @Query("SELECT COUNT(m) FROM Member m WHERE m.joinDate >= :startDate AND m.joinDate <= :endDate")
    Long countByJoinDateRange(@Param("startDate") java.time.LocalDate startDate, @Param("endDate") java.time.LocalDate endDate);
}
