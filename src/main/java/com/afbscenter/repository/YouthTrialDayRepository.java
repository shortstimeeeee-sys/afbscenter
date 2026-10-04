package com.afbscenter.repository;

import com.afbscenter.model.YouthTrialDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface YouthTrialDayRepository extends JpaRepository<YouthTrialDay, Long> {

    Optional<YouthTrialDay> findByTrialDate(LocalDate trialDate);

    List<YouthTrialDay> findByTrialDateBetweenOrderByTrialDateAsc(LocalDate start, LocalDate end);

    void deleteByTrialDate(LocalDate trialDate);
}
