package com.afbscenter.repository;

import com.afbscenter.model.Booking;
import com.afbscenter.model.OutdoorLessonParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface OutdoorLessonParticipantRepository extends JpaRepository<OutdoorLessonParticipant, Long> {

    List<OutdoorLessonParticipant> findByLessonDateAndBranchOrderBySeqNoAscIdAsc(
            LocalDate lessonDate, Booking.Branch branch);

    List<OutdoorLessonParticipant> findByLessonDateOrderBySeqNoAscIdAsc(LocalDate lessonDate);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from OutdoorLessonParticipant p where p.lessonDate = :lessonDate and p.branch = :branch")
    int deleteByLessonDateAndBranch(@Param("lessonDate") LocalDate lessonDate,
                                    @Param("branch") Booking.Branch branch);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from OutdoorLessonParticipant p where p.lessonDate = :lessonDate")
    int deleteByLessonDate(@Param("lessonDate") LocalDate lessonDate);
}
