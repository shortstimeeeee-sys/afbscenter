package com.afbscenter.repository;

import com.afbscenter.model.MemberProductHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberProductHistoryRepository extends JpaRepository<MemberProductHistory, Long> {
    
    List<MemberProductHistory> findByMemberIdOrderByTransactionDateDesc(Long memberId);
    
    List<MemberProductHistory> findByMemberProductIdOrderByTransactionDateDesc(Long memberProductId);
    
    @Query("SELECT h FROM MemberProductHistory h LEFT JOIN FETCH h.memberProduct mp LEFT JOIN FETCH mp.product WHERE h.member.id = :memberId ORDER BY h.transactionDate DESC")
    List<MemberProductHistory> findByMemberIdWithProductOrderByTransactionDateDesc(@Param("memberId") Long memberId);
    
    /** 회원 이용권 히스토리 (상품 + 출석·예약 포함, 예약 startTime 기준 정렬용) */
    @Query("SELECT h FROM MemberProductHistory h " +
           "LEFT JOIN FETCH h.memberProduct mp LEFT JOIN FETCH mp.product " +
           "LEFT JOIN FETCH h.attendance a LEFT JOIN FETCH a.booking b " +
           "WHERE h.member.id = :memberId ORDER BY h.transactionDate DESC")
    List<MemberProductHistory> findByMemberIdWithProductAndBookingOrderByTransactionDateDesc(@Param("memberId") Long memberId);
    
    @Query("SELECT h FROM MemberProductHistory h LEFT JOIN FETCH h.memberProduct mp LEFT JOIN FETCH mp.product WHERE h.attendance.id = :attendanceId")
    java.util.Optional<MemberProductHistory> findByAttendanceId(@Param("attendanceId") Long attendanceId);
    
    @Query("SELECT h FROM MemberProductHistory h WHERE h.attendance.id = :attendanceId")
    List<MemberProductHistory> findAllByAttendanceId(@Param("attendanceId") Long attendanceId);
    
    @Query("SELECT h FROM MemberProductHistory h WHERE h.description LIKE :descriptionPattern")
    List<MemberProductHistory> findByDescriptionContaining(@Param("descriptionPattern") String descriptionPattern);
}
