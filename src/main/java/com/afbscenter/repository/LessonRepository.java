package com.afbscenter.repository;

import com.afbscenter.model.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LessonRepository extends JpaRepository<Lesson, Long> {
    List<Lesson> findByMemberId(Long memberId);
    List<Lesson> findByCoachId(Long coachId);
    
    @Query("SELECT l FROM Lesson l WHERE l.startTime >= :start AND l.startTime < :end")
    List<Lesson> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    List<Lesson> findByCategory(com.afbscenter.model.Lesson.LessonCategory category);
    
    @Query("SELECT l FROM Lesson l WHERE l.member.id = :memberId AND l.category = :category")
    List<Lesson> findByMemberIdAndCategory(@Param("memberId") Long memberId, @Param("category") com.afbscenter.model.Lesson.LessonCategory category);
}
