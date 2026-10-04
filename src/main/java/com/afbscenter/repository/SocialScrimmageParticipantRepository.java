package com.afbscenter.repository;

import com.afbscenter.model.Booking;
import com.afbscenter.model.SocialScrimmageParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SocialScrimmageParticipantRepository extends JpaRepository<SocialScrimmageParticipant, Long> {

    List<SocialScrimmageParticipant> findByMatchDateAndBranchOrderBySeqNoAscIdAsc(
            LocalDate matchDate, Booking.Branch branch);

    List<SocialScrimmageParticipant> findByMatchDateOrderBySeqNoAscIdAsc(LocalDate matchDate);

    List<SocialScrimmageParticipant> findAllByOrderByMatchDateAscSeqNoAscIdAsc();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SocialScrimmageParticipant p where p.matchDate = :matchDate and p.branch = :branch")
    int deleteByMatchDateAndBranch(@Param("matchDate") LocalDate matchDate,
                                   @Param("branch") Booking.Branch branch);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SocialScrimmageParticipant p where p.matchDate = :matchDate")
    int deleteByMatchDate(@Param("matchDate") LocalDate matchDate);
}
