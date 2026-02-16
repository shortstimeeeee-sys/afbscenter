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

    /** 출석에 연결된 DEDUCT 1건 (회차 계산용). 타입 지정으로 잘못된 히스토리 반환 방지 */
    @Query("SELECT h FROM MemberProductHistory h WHERE h.attendance.id = :attendanceId AND h.type = 'DEDUCT'")
    java.util.Optional<MemberProductHistory> findDeductByAttendanceId(@Param("attendanceId") Long attendanceId);
    
    @Query("SELECT h FROM MemberProductHistory h WHERE h.description LIKE :descriptionPattern")
    List<MemberProductHistory> findByDescriptionContaining(@Param("descriptionPattern") String descriptionPattern);

    /** 같은 이용권의 DEDUCT 중 id <= historyId 인 건수 (해당 체크인이 몇 번째 사용인지 = 회차) */
    @Query("SELECT COUNT(h) FROM MemberProductHistory h WHERE h.memberProduct.id = :memberProductId AND h.type = 'DEDUCT' AND h.id <= :historyId")
    long countDeductByMemberProductIdAndIdLessThanEqual(@Param("memberProductId") Long memberProductId, @Param("historyId") Long historyId);

    /** 같은 이용권의 DEDUCT 중 "출석→예약"이 (startTime, bookingId)보다 이전인 건수. 회차 = count+1 (예약 시각 순서 기준, 체크인 직후 7→1 방지) */
    @Query("SELECT COUNT(h) FROM MemberProductHistory h INNER JOIN h.attendance a INNER JOIN a.booking b " +
           "WHERE h.memberProduct.id = :memberProductId AND h.type = 'DEDUCT' " +
           "AND (b.startTime < :startTime OR (b.startTime = :startTime AND b.id < :bookingId))")
    long countDeductByMemberProductAndBookingBeforeInOrder(@Param("memberProductId") Long memberProductId,
                                                           @Param("startTime") java.time.LocalDateTime startTime,
                                                           @Param("bookingId") Long bookingId);
}
