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
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach WHERE b.member.id = :memberId ORDER BY b.startTime DESC")
    List<Booking> findByMemberId(@Param("memberId") Long memberId);
    List<Booking> findByFacilityId(Long facilityId);
    List<Booking> findByStatus(Booking.BookingStatus status);
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach WHERE b.startTime >= :start AND b.startTime <= :end ORDER BY b.startTime ASC")
    List<Booking> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    // DISTINCT 제거: JOIN FETCH와 함께 사용 시 예상치 못한 결과 발생 가능
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach ORDER BY b.startTime DESC")
    List<Booking> findAllWithFacilityAndMember();
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach WHERE b.id = :id")
    Booking findByIdWithFacilityAndMember(@Param("id") Long id);
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct LEFT JOIN FETCH b.memberProduct.product WHERE b.id = :id")
    Booking findByIdWithAllRelations(@Param("id") Long id);
    
    @Query("SELECT b FROM Booking b WHERE DATE(b.startTime) = DATE(:date)")
    List<Booking> findByDate(@Param("date") LocalDateTime date);
    
    @Query("SELECT b FROM Booking b WHERE b.purpose = 'LESSON' AND b.lessonCategory = :category")
    List<Booking> findByLessonCategory(@Param("category") com.afbscenter.model.LessonCategory category);
    
    @Query("SELECT b FROM Booking b WHERE b.member.id = :memberId AND b.purpose = 'LESSON' AND b.status = 'CONFIRMED' ORDER BY b.startTime DESC")
    List<Booking> findLatestLessonByMemberId(@Param("memberId") Long memberId);
    
    // 특정 상품을 사용한 확정된 예약 수 조회 (출석 기록이 있는 예약만 카운트, 체크인 시에만 차감되므로)
    // 주의: 예약 확정 시에는 차감하지 않으므로, 확정된 예약은 카운트하지 않음
    // 체크인된 예약만 카운트하여 remainingCount 계산에 사용
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND EXISTS (SELECT 1 FROM Attendance a WHERE a.booking.id = b.id AND a.checkInTime IS NOT NULL)")
    Long countConfirmedBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 회원의 특정 상품을 사용한 확정된 예약 목록 조회
    @Query("SELECT b FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.status = 'CONFIRMED' ORDER BY b.startTime ASC")
    List<Booking> findConfirmedBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 특정 상품을 참조하는 모든 예약 조회 (상태 무관)
    @Query("SELECT b FROM Booking b WHERE b.memberProduct.id = :memberProductId")
    List<Booking> findAllBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 회원의 확정된 레슨 예약 중 memberProduct가 없고 출석 기록도 없는 예약 수 조회 (중복 방지)
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.member.id = :memberId AND b.purpose = 'LESSON' AND b.status = 'CONFIRMED' AND b.memberProduct IS NULL AND NOT EXISTS (SELECT 1 FROM Attendance a WHERE a.booking.id = b.id AND a.checkInTime IS NOT NULL)")
    Long countConfirmedLessonsWithoutMemberProduct(@Param("memberId") Long memberId);
}
