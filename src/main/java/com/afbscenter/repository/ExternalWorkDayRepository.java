package com.afbscenter.repository;

import com.afbscenter.model.ExternalWorkDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExternalWorkDayRepository extends JpaRepository<ExternalWorkDay, Long> {

    Optional<ExternalWorkDay> findByWorkDate(LocalDate workDate);

    List<ExternalWorkDay> findByWorkDateBetweenOrderByWorkDateAsc(LocalDate start, LocalDate end);

    void deleteByWorkDate(LocalDate workDate);
}
