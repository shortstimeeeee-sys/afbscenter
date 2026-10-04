package com.afbscenter.repository;

import com.afbscenter.model.ManualProfitSheetEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ManualProfitSheetEntryRepository extends JpaRepository<ManualProfitSheetEntry, Long> {

    List<ManualProfitSheetEntry> findByYearAndMonth(Integer year, Integer month);

    Optional<ManualProfitSheetEntry> findByYearAndMonthAndDayAndCoachId(
            Integer year, Integer month, Integer day, Long coachId);

    void deleteByYearAndMonthAndDayAndCoachId(Integer year, Integer month, Integer day, Long coachId);
}
