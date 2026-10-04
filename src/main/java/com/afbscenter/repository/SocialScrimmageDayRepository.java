package com.afbscenter.repository;

import com.afbscenter.model.SocialScrimmageDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SocialScrimmageDayRepository extends JpaRepository<SocialScrimmageDay, Long> {

    Optional<SocialScrimmageDay> findByScrimmageDate(LocalDate scrimmageDate);

    List<SocialScrimmageDay> findByScrimmageDateBetweenOrderByScrimmageDateAsc(LocalDate start, LocalDate end);

    void deleteByScrimmageDate(LocalDate scrimmageDate);
}
