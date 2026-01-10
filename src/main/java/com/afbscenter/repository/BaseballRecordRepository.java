package com.afbscenter.repository;

import com.afbscenter.model.BaseballRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface BaseballRecordRepository extends JpaRepository<BaseballRecord, Long> {
    
    List<BaseballRecord> findByMemberId(Long memberId);
    
    List<BaseballRecord> findByMemberIdOrderByRecordDateDesc(Long memberId);
    
    List<BaseballRecord> findByRecordDateBetween(LocalDate startDate, LocalDate endDate);
    
    @Query("SELECT br FROM BaseballRecord br WHERE br.member.id = :memberId ORDER BY br.recordDate DESC")
    List<BaseballRecord> findRecentRecordsByMember(@Param("memberId") Long memberId);
    
    @Query("SELECT AVG(br.hits * 1.0 / br.atBats) FROM BaseballRecord br WHERE br.member.id = :memberId AND br.atBats > 0")
    Double calculateAverageBattingAverage(@Param("memberId") Long memberId);
}
