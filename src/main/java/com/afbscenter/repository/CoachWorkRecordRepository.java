package com.afbscenter.repository;

import com.afbscenter.model.CoachWorkRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CoachWorkRecordRepository extends JpaRepository<CoachWorkRecord, Long> {
    Optional<CoachWorkRecord> findByCoachIdAndWorkDate(Long coachId, LocalDate workDate);

    List<CoachWorkRecord> findByCoachIdAndWorkDateBetweenOrderByWorkDateAsc(Long coachId, LocalDate start, LocalDate end);

    @Query("SELECT DISTINCT r FROM CoachWorkRecord r JOIN FETCH r.coach c "
            + "WHERE r.workDate BETWEEN :start AND :end ORDER BY c.id ASC, r.workDate ASC")
    List<CoachWorkRecord> findByWorkDateBetweenWithCoach(@Param("start") LocalDate start,
                                                         @Param("end") LocalDate end);
}
