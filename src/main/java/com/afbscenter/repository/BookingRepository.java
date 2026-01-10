package com.afbscenter.repository;

import com.afbscenter.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByMemberId(Long memberId);
    List<Booking> findByFacilityId(Long facilityId);
    List<Booking> findByStatus(Booking.BookingStatus status);
    
    @Query("SELECT DISTINCT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach WHERE b.startTime >= :start AND b.startTime < :end")
    List<Booking> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    @Query("SELECT DISTINCT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach")
    List<Booking> findAllWithFacilityAndMember();
    
    @Query("SELECT DISTINCT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach WHERE b.id = :id")
    Booking findByIdWithFacilityAndMember(@Param("id") Long id);
    
    @Query("SELECT b FROM Booking b WHERE DATE(b.startTime) = DATE(:date)")
    List<Booking> findByDate(@Param("date") LocalDateTime date);
    
    @Query("SELECT b FROM Booking b WHERE b.purpose = 'LESSON' AND b.lessonCategory = :category")
    List<Booking> findByLessonCategory(@Param("category") com.afbscenter.model.Lesson.LessonCategory category);
    
    @Query("SELECT b FROM Booking b WHERE b.member.id = :memberId AND b.purpose = 'LESSON' AND b.status = 'CONFIRMED' ORDER BY b.startTime DESC")
    List<Booking> findLatestLessonByMemberId(@Param("memberId") Long memberId);
    
    // 특정 상품을 사용한 확정된 예약 수 조회 (이전 날짜 포함)
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.status = 'CONFIRMED'")
    Long countConfirmedBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 회원의 특정 상품을 사용한 확정된 예약 목록 조회
    @Query("SELECT b FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.status = 'CONFIRMED' ORDER BY b.startTime ASC")
    List<Booking> findConfirmedBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
}
