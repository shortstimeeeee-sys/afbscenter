package com.afbscenter.repository;

import com.afbscenter.model.FacilitySlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.util.List;

@Repository
public interface FacilitySlotRepository extends JpaRepository<FacilitySlot, Long> {
    List<FacilitySlot> findByFacilityIdAndDayOfWeek(Long facilityId, DayOfWeek dayOfWeek);
}
