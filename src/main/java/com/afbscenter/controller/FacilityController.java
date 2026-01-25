package com.afbscenter.controller;

import com.afbscenter.model.Facility;
import com.afbscenter.repository.FacilityRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/facilities")
public class FacilityController {

    private static final Logger logger = LoggerFactory.getLogger(FacilityController.class);

    private final FacilityRepository facilityRepository;

    public FacilityController(FacilityRepository facilityRepository) {
        this.facilityRepository = facilityRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Facility>> getAllFacilities(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String facilityType) {
        try {
            List<Facility> facilities;
            
            // 지점 필터링
            if (branch != null && !branch.trim().isEmpty()) {
                try {
                    Facility.Branch branchEnum = Facility.Branch.valueOf(branch.toUpperCase());
                    facilities = facilityRepository.findByBranchAndActiveTrue(branchEnum);
                    logger.info("지점별 시설 조회: {} - {}건", branchEnum, facilities.size());
                } catch (IllegalArgumentException e) {
                    logger.warn("잘못된 지점 파라미터: {}, 모든 시설 반환", branch);
                    facilities = facilityRepository.findByActiveTrue();
                }
            } else {
                facilities = facilityRepository.findByActiveTrue();
            }
            
            // 시설 타입 필터링
            if (facilityType != null && !facilityType.trim().isEmpty()) {
                try {
                    Facility.FacilityType typeEnum = Facility.FacilityType.valueOf(facilityType.toUpperCase());
                    facilities = facilities.stream()
                            .filter(f -> f.getFacilityType() == typeEnum || f.getFacilityType() == Facility.FacilityType.ALL)
                            .collect(java.util.stream.Collectors.toList());
                    logger.info("시설 타입 필터링 완료: {} - {}건", typeEnum, facilities.size());
                } catch (IllegalArgumentException e) {
                    logger.warn("잘못된 시설 타입 파라미터: {}", facilityType);
                }
            }
            
            return ResponseEntity.ok(facilities);
        } catch (Exception e) {
            logger.error("시설 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Facility> getFacilityById(@PathVariable Long id) {
        return facilityRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Facility> createFacility(@Valid @RequestBody Facility facility) {
        try {
            // active 기본값 설정
            if (facility.getActive() == null) {
                facility.setActive(true);
            }
            
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(facilityRepository.save(facility));
        } catch (Exception e) {
            logger.error("시설 생성 중 오류 발생", e);
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Facility> updateFacility(@PathVariable Long id, @Valid @RequestBody Facility facility) {
        try {
            Facility existingFacility = facilityRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다."));
            
            existingFacility.setName(facility.getName());
            existingFacility.setLocation(facility.getLocation());
            existingFacility.setCapacity(facility.getCapacity());
            existingFacility.setHourlyRate(facility.getHourlyRate());
            existingFacility.setOpenTime(facility.getOpenTime());
            existingFacility.setCloseTime(facility.getCloseTime());
            existingFacility.setEquipment(facility.getEquipment());
            existingFacility.setFacilityType(facility.getFacilityType());
            existingFacility.setActive(facility.getActive());
            
            return ResponseEntity.ok(facilityRepository.save(existingFacility));
        } catch (IllegalArgumentException e) {
            logger.warn("시설을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("시설 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteFacility(@PathVariable Long id) {
        try {
            if (!facilityRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            facilityRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("시설 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }
}
