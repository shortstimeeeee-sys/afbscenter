package com.afbscenter.repository;

import com.afbscenter.model.Facility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FacilityRepository extends JpaRepository<Facility, Long> {
    List<Facility> findByActiveTrue();
    
    // 지점별 시설 조회
    List<Facility> findByBranchAndActiveTrue(Facility.Branch branch);
    
    // 지점별 시설 조회 (active 필터링 없음)
    List<Facility> findByBranch(Facility.Branch branch);
}
