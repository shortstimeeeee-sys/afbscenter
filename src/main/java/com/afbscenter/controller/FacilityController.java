package com.afbscenter.controller;

import com.afbscenter.model.Facility;
import com.afbscenter.model.FacilitySlot;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.FacilitySlotRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/facilities")
public class FacilityController {

    private static final Logger logger = LoggerFactory.getLogger(FacilityController.class);

    private final FacilityRepository facilityRepository;
    private final FacilitySlotRepository facilitySlotRepository;

    public FacilityController(FacilityRepository facilityRepository, FacilitySlotRepository facilitySlotRepository) {
        this.facilityRepository = facilityRepository;
        this.facilitySlotRepository = facilitySlotRepository;
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

    /** 시설별 요일별 운영 슬롯 조회 (슬롯 관리 UI용). DB에 저장된 슬롯이 있으면 반환, 없으면 시설 openTime/closeTime으로 1~7요일 동일 슬롯 반환 */
    @GetMapping("/{id}/slots")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getFacilitySlots(@PathVariable Long id) {
        Optional<Facility> opt = facilityRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Facility f = opt.get();
        List<FacilitySlot> dbSlots = facilitySlotRepository.findByFacilityIdOrderByDayOfWeek(id);
        if (!dbSlots.isEmpty()) {
            List<Map<String, Object>> slots = new ArrayList<>();
            for (FacilitySlot s : dbSlots) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", s.getId());
                map.put("dayOfWeek", s.getDayOfWeek());
                map.put("startTime", s.getStartTime() != null ? s.getStartTime().toString() : null);
                map.put("endTime", s.getEndTime() != null ? s.getEndTime().toString() : null);
                map.put("isOpen", Boolean.TRUE.equals(s.getIsOpen()));
                slots.add(map);
            }
            return ResponseEntity.ok(slots);
        }
        LocalTime open = f.getOpenTime();
        LocalTime close = f.getCloseTime();
        boolean hasHours = open != null && close != null;
        String startStr = hasHours ? open.toString() : "09:00";
        String endStr = hasHours ? close.toString() : "18:00";
        List<Map<String, Object>> slots = new ArrayList<>();
        for (int dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
            Map<String, Object> slot = new HashMap<>();
            slot.put("dayOfWeek", dayOfWeek);
            slot.put("startTime", startStr);
            slot.put("endTime", endStr);
            slot.put("isOpen", hasHours);
            slots.add(slot);
        }
        return ResponseEntity.ok(slots);
    }

    /** 시설 슬롯 일괄 저장. 기존 슬롯 삭제 후 요청 본문으로 교체 */
    @PutMapping("/{id}/slots")
    @Transactional
    public ResponseEntity<List<Map<String, Object>>> saveFacilitySlots(
            @PathVariable Long id,
            @RequestBody List<FacilitySlotDto> body) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다."));
        facilitySlotRepository.deleteByFacilityId(id);
        if (body != null && !body.isEmpty()) {
            for (FacilitySlotDto dto : body) {
                FacilitySlot slot = new FacilitySlot();
                slot.setFacility(facility);
                slot.setDayOfWeek(dto.getDayOfWeek());
                slot.setStartTime(dto.getStartTime() != null ? LocalTime.parse(dto.getStartTime()) : null);
                slot.setEndTime(dto.getEndTime() != null ? LocalTime.parse(dto.getEndTime()) : null);
                slot.setIsOpen(dto.getIsOpen() != null ? dto.getIsOpen() : true);
                facilitySlotRepository.save(slot);
            }
        }
        return ResponseEntity.ok(getFacilitySlots(id).getBody());
    }

    /** 특정 날짜에 해당 시설에서 예약 가능한 시간대 목록. 예약 폼에서 "오픈 슬롯만" 제한할 때 사용 */
    @GetMapping("/{id}/available-slots")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, String>>> getAvailableSlots(
            @PathVariable Long id,
            @RequestParam String date) {
        Optional<Facility> opt = facilityRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Facility f = opt.get();
        LocalDate localDate = LocalDate.parse(date);
        int dayOfWeek = localDate.getDayOfWeek().getValue();
        List<FacilitySlot> dbSlots = facilitySlotRepository.findByFacilityIdOrderByDayOfWeek(id);
        FacilitySlot daySlot = dbSlots.stream().filter(s -> s.getDayOfWeek() == dayOfWeek).findFirst().orElse(null);
        List<Map<String, String>> ranges = new ArrayList<>();
        if (daySlot != null && Boolean.TRUE.equals(daySlot.getIsOpen()) && daySlot.getStartTime() != null && daySlot.getEndTime() != null) {
            Map<String, String> range = new HashMap<>();
            range.put("startTime", daySlot.getStartTime().toString());
            range.put("endTime", daySlot.getEndTime().toString());
            ranges.add(range);
        } else if (daySlot == null || Boolean.TRUE.equals(daySlot.getIsOpen())) {
            LocalTime open = f.getOpenTime();
            LocalTime close = f.getCloseTime();
            if (open != null && close != null) {
                Map<String, String> range = new HashMap<>();
                range.put("startTime", open.toString());
                range.put("endTime", close.toString());
                ranges.add(range);
            }
        }
        return ResponseEntity.ok(ranges);
    }

    /** 슬롯 저장용 DTO */
    public static class FacilitySlotDto {
        private Integer dayOfWeek;
        private String startTime;
        private String endTime;
        private Boolean isOpen;

        public Integer getDayOfWeek() { return dayOfWeek; }
        public void setDayOfWeek(Integer dayOfWeek) { this.dayOfWeek = dayOfWeek; }
        public String getStartTime() { return startTime; }
        public void setStartTime(String startTime) { this.startTime = startTime; }
        public String getEndTime() { return endTime; }
        public void setEndTime(String endTime) { this.endTime = endTime; }
        public Boolean getIsOpen() { return isOpen; }
        public void setIsOpen(Boolean isOpen) { this.isOpen = isOpen; }
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
