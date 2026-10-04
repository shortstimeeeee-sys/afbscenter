package com.afbscenter.repository;

import com.afbscenter.model.ManualProfitSheetPayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManualProfitSheetPayerRepository extends JpaRepository<ManualProfitSheetPayer, Long> {

    List<ManualProfitSheetPayer> findByYearAndMonth(Integer year, Integer month);

    List<ManualProfitSheetPayer> findByYearAndMonthAndDayAndCoachIdOrderBySortOrderAscIdAsc(
            Integer year, Integer month, Integer day, Long coachId);

    void deleteByYearAndMonthAndDayAndCoachId(Integer year, Integer month, Integer day, Long coachId);
}
