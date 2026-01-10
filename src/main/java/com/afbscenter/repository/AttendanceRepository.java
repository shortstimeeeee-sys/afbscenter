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
    
    @Query("SELECT a FROM Attendance a WHERE a.date = :date")
    List<Attendance> findByDate(@Param("date") LocalDate date);
    
    @Query("SELECT a FROM Attendance a WHERE a.date >= :start AND a.date <= :end")
    List<Attendance> findByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);
    
    // 체크인된 출석 기록 조회 (checkInTime이 있는 경우)
    @Query("SELECT a FROM Attendance a WHERE a.checkInTime IS NOT NULL ORDER BY a.date DESC, a.checkInTime DESC")
    List<Attendance> findCheckedInAttendances();
    
    // 특정 날짜의 체크인된 출석 기록 조회
    @Query("SELECT a FROM Attendance a WHERE a.date = :date AND a.checkInTime IS NOT NULL ORDER BY a.checkInTime DESC")
    List<Attendance> findCheckedInByDate(@Param("date") LocalDate date);
    
    // 날짜 범위의 체크인된 출석 기록 조회
    @Query("SELECT a FROM Attendance a WHERE a.date >= :start AND a.date <= :end AND a.checkInTime IS NOT NULL ORDER BY a.date DESC, a.checkInTime DESC")
    List<Attendance> findCheckedInByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
