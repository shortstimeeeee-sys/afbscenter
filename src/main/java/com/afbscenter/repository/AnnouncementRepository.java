package com.afbscenter.repository;

import com.afbscenter.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    
    // 활성 공지 조회 (현재 날짜가 시작일과 종료일 사이에 있는 공지)
    @Query("SELECT a FROM Announcement a WHERE " +
           "(a.startDate IS NULL OR a.startDate <= :currentDate) AND " +
           "(a.endDate IS NULL OR a.endDate >= :currentDate) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findActiveAnnouncements(@Param("currentDate") LocalDate currentDate);

    /** 대시보드·직원 알림용: 회원 전용(운영 화면 숨김) 공지 제외 */
    @Query("SELECT a FROM Announcement a WHERE " +
           "(a.startDate IS NULL OR a.startDate <= :currentDate) AND " +
           "(a.endDate IS NULL OR a.endDate >= :currentDate) AND " +
           "(a.hideFromStaffFeed IS NULL OR a.hideFromStaffFeed = false) " +
           "ORDER BY a.createdAt DESC")
    List<Announcement> findActiveAnnouncementsVisibleToStaff(@Param("currentDate") LocalDate currentDate);
    
    // 전체 공지 조회 (최신순)
    @Query("SELECT a FROM Announcement a ORDER BY a.createdAt DESC")
    List<Announcement> findAllOrderByCreatedAtDesc();
}
