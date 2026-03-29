package com.afbscenter.repository;

import com.afbscenter.model.CalendarDayMark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CalendarDayMarkRepository extends JpaRepository<CalendarDayMark, Long> {

    Optional<CalendarDayMark> findByMarkDate(LocalDate markDate);

    List<CalendarDayMark> findByMarkDateBetweenOrderByMarkDateAsc(LocalDate start, LocalDate end);

    void deleteByMarkDate(LocalDate markDate);
}
