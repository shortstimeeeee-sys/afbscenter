package com.afbscenter.controller;

import com.afbscenter.model.Facility;
import com.afbscenter.repository.FacilityRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/facilities")
@CrossOrigin(origins = "http://localhost:8080")
public class FacilityController {

    private static final Logger logger = LoggerFactory.getLogger(FacilityController.class);

    @Autowired
    private FacilityRepository facilityRepository;

    @GetMapping
    public ResponseEntity<List<Facility>> getAllFacilities() {
        return ResponseEntity.ok(facilityRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Facility> getFacilityById(@PathVariable Long id) {
        return facilityRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
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
