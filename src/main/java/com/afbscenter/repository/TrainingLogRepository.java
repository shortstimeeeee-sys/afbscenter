package com.afbscenter.repository;

import com.afbscenter.model.TrainingLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TrainingLogRepository extends JpaRepository<TrainingLog, Long> {
    List<TrainingLog> findByMemberId(Long memberId);
    
    @Query("SELECT t FROM TrainingLog t LEFT JOIN FETCH t.member WHERE t.recordDate >= :start AND t.recordDate <= :end")
    List<TrainingLog> findByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);
    
    @Query("SELECT DISTINCT t FROM TrainingLog t LEFT JOIN FETCH t.member")
    List<TrainingLog> findAllWithMember();
    
    @Query("SELECT t FROM TrainingLog t WHERE t.member.id = :memberId AND t.type = :type ORDER BY t.recordDate DESC")
    List<TrainingLog> findByMemberIdAndType(@Param("memberId") Long memberId, @Param("type") TrainingLog.TrainingType type);
    
    List<TrainingLog> findByPart(TrainingLog.TrainingPart part);
    
    @Query("SELECT t FROM TrainingLog t WHERE t.member.id = :memberId AND t.part = :part ORDER BY t.recordDate DESC")
    List<TrainingLog> findByMemberIdAndPart(@Param("memberId") Long memberId, @Param("part") TrainingLog.TrainingPart part);
}
