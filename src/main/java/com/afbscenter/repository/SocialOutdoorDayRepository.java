package com.afbscenter.repository;

import com.afbscenter.model.SocialOutdoorDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SocialOutdoorDayRepository extends JpaRepository<SocialOutdoorDay, Long> {

    Optional<SocialOutdoorDay> findByOutdoorDate(LocalDate outdoorDate);

    List<SocialOutdoorDay> findByOutdoorDateBetweenOrderByOutdoorDateAsc(LocalDate start, LocalDate end);

    void deleteByOutdoorDate(LocalDate outdoorDate);
}
