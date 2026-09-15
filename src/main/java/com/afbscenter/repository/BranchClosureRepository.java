package com.afbscenter.repository;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BranchClosureRepository extends JpaRepository<BranchClosure, Long> {

    Optional<BranchClosure> findByBranchAndCalendarPartAndClosureDate(
            Facility.Branch branch, BranchClosure.CalendarPart calendarPart, LocalDate closureDate);

    List<BranchClosure> findByBranchAndCalendarPartAndClosureDateBetweenOrderByClosureDateAsc(
            Facility.Branch branch, BranchClosure.CalendarPart calendarPart, LocalDate start, LocalDate end);

    void deleteByBranchAndCalendarPartAndClosureDate(
            Facility.Branch branch, BranchClosure.CalendarPart calendarPart, LocalDate closureDate);
}
