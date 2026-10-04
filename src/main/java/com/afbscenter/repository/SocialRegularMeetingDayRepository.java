package com.afbscenter.repository;

import com.afbscenter.model.SocialRegularMeetingDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SocialRegularMeetingDayRepository extends JpaRepository<SocialRegularMeetingDay, Long> {

    Optional<SocialRegularMeetingDay> findByMeetingDate(LocalDate meetingDate);

    List<SocialRegularMeetingDay> findByMeetingDateBetweenOrderByMeetingDateAsc(LocalDate start, LocalDate end);

    void deleteByMeetingDate(LocalDate meetingDate);
}
