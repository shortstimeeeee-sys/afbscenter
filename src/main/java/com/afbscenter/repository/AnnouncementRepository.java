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
    List<Announcement> findByActiveTrue();
    
    @Query("SELECT a FROM Announcement a WHERE a.active = true AND (a.startDate IS NULL OR a.startDate <= :date) AND (a.endDate IS NULL OR a.endDate >= :date)")
    List<Announcement> findActiveByDate(@Param("date") LocalDate date);
}
