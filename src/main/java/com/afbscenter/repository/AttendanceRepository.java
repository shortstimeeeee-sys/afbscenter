package com.afbscenter.repository;

import com.afbscenter.model.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByMemberId(Long memberId);
    
    @Query("SELECT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility WHERE a.date = :date")
    List<Attendance> findByDate(@Param("date") LocalDate date);
    
    @Query("SELECT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility WHERE a.date >= :start AND a.date <= :end")
    List<Attendance> findByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);
    
    @Query("SELECT DISTINCT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility")
    List<Attendance> findAllWithMemberAndFacility();
    
    // 체크인된 출석 기록 조회 (checkInTime이 있는 경우)
    @Query("SELECT DISTINCT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility LEFT JOIN FETCH a.booking b LEFT JOIN FETCH b.coach WHERE a.checkInTime IS NOT NULL ORDER BY a.date DESC, a.checkInTime DESC")
    List<Attendance> findCheckedInAttendances();
    
    // 특정 날짜의 체크인된 출석 기록 조회
    @Query("SELECT DISTINCT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility LEFT JOIN FETCH a.booking WHERE a.date = :date AND a.checkInTime IS NOT NULL ORDER BY a.checkInTime DESC")
    List<Attendance> findCheckedInByDate(@Param("date") LocalDate date);
    
    // 날짜 범위의 체크인된 출석 기록 조회
    @Query("SELECT DISTINCT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility LEFT JOIN FETCH a.booking b LEFT JOIN FETCH b.coach WHERE a.date >= :start AND a.date <= :end AND a.checkInTime IS NOT NULL ORDER BY a.date DESC, a.checkInTime DESC")
    List<Attendance> findCheckedInByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);
    
    // 특정 회원의 특정 상품을 사용한 출석 기록 수 (체크인 완료된 것만)
    @Query("SELECT COUNT(a) FROM Attendance a WHERE a.member.id = :memberId AND a.booking.memberProduct.id = :memberProductId AND a.status = 'PRESENT' AND a.checkInTime IS NOT NULL")
    Long countCheckedInAttendancesByMemberAndProduct(@Param("memberId") Long memberId, @Param("memberProductId") Long memberProductId);
    
    // 특정 회원의 출석 기록 수 (체크인 완료된 것만, memberProduct가 없는 경우)
    @Query("SELECT COUNT(a) FROM Attendance a WHERE a.member.id = :memberId AND (a.booking.memberProduct IS NULL OR a.booking.memberProduct.id IS NULL) AND a.status = 'PRESENT' AND a.checkInTime IS NOT NULL")
    Long countCheckedInAttendancesWithoutMemberProduct(@Param("memberId") Long memberId);
    
    // 체크인은 있지만 체크아웃이 없는 출석 기록 조회
    @Query("SELECT a FROM Attendance a LEFT JOIN FETCH a.member LEFT JOIN FETCH a.facility LEFT JOIN FETCH a.booking WHERE a.checkInTime IS NOT NULL AND a.checkOutTime IS NULL")
    List<Attendance> findIncompleteAttendances();
    
    // 특정 예약 ID로 출석 기록 조회 (booking과 memberProduct 함께 로드)
    @Query("SELECT a FROM Attendance a LEFT JOIN FETCH a.booking b LEFT JOIN FETCH b.memberProduct mp LEFT JOIN FETCH mp.product WHERE a.booking.id = :bookingId")
    java.util.Optional<Attendance> findByBookingId(@Param("bookingId") Long bookingId);
}
