package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/lessons")
@CrossOrigin(origins = "http://localhost:8080")
public class LessonController {

    private static final Logger logger = LoggerFactory.getLogger(LessonController.class);

    @Autowired
    private BookingRepository bookingRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getLessons(
            @RequestParam(required = false) Long coachId,
            @RequestParam(required = false) String category) {
        try {
            // LESSON 목적의 예약만 조회
            List<Booking> allBookings = bookingRepository.findAll();
            List<Booking> lessonBookings = allBookings.stream()
                    .filter(b -> b.getPurpose() == Booking.BookingPurpose.LESSON)
                    .collect(Collectors.toList());
            
            // 코치 필터링
            if (coachId != null) {
                lessonBookings = lessonBookings.stream()
                        .filter(b -> b.getCoach() != null && b.getCoach().getId().equals(coachId))
                        .collect(Collectors.toList());
            }
            
            // 카테고리 필터링
            if (category != null && !category.isEmpty()) {
                try {
                    LessonCategory lessonCategory = LessonCategory.valueOf(category);
                    lessonBookings = lessonBookings.stream()
                            .filter(b -> b.getLessonCategory() == lessonCategory)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {
                    // 잘못된 enum 값은 무시
                    logger.warn("잘못된 레슨 카테고리: {}", category);
                }
            }
            
            // Map으로 변환하여 반환 (순환 참조 방지)
            List<Map<String, Object>> result = lessonBookings.stream().map(booking -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", booking.getId());
                map.put("startTime", booking.getStartTime());
                map.put("endTime", booking.getEndTime());
                map.put("participants", booking.getParticipants());
                map.put("status", booking.getStatus() != null ? booking.getStatus().name() : null);
                map.put("lessonCategory", booking.getLessonCategory() != null ? booking.getLessonCategory().name() : null);
                map.put("memo", booking.getMemo());
                map.put("createdAt", booking.getCreatedAt());
                
                // Coach 정보
                if (booking.getCoach() != null) {
                    try {
                        Map<String, Object> coachMap = new HashMap<>();
                        coachMap.put("id", booking.getCoach().getId());
                        coachMap.put("name", booking.getCoach().getName());
                        coachMap.put("specialties", booking.getCoach().getSpecialties());
                        map.put("coach", coachMap);
                    } catch (Exception e) {
                        logger.warn("Coach 로드 실패: Booking ID={}", booking.getId(), e);
                        map.put("coach", null);
                    }
                } else {
                    map.put("coach", null);
                }
                
                // Member 정보
                if (booking.getMember() != null) {
                    try {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", booking.getMember().getId());
                        memberMap.put("name", booking.getMember().getName());
                        memberMap.put("memberNumber", booking.getMember().getMemberNumber());
                        map.put("member", memberMap);
                    } catch (Exception e) {
                        logger.warn("Member 로드 실패: Booking ID={}", booking.getId(), e);
                        map.put("member", null);
                    }
                } else {
                    map.put("member", null);
                }
                
                // Facility 정보
                if (booking.getFacility() != null) {
                    try {
                        Map<String, Object> facilityMap = new HashMap<>();
                        facilityMap.put("id", booking.getFacility().getId());
                        facilityMap.put("name", booking.getFacility().getName());
                        map.put("facility", facilityMap);
                    } catch (Exception e) {
                        logger.warn("Facility 로드 실패: Booking ID={}", booking.getId(), e);
                        map.put("facility", null);
                    }
                } else {
                    map.put("facility", null);
                }
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("레슨 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getLessonById(@PathVariable Long id) {
        try {
            return bookingRepository.findById(id)
                    .map(booking -> {
                        // LESSON 목적인지 확인
                        if (booking.getPurpose() != Booking.BookingPurpose.LESSON) {
                            Map<String, Object> error = new HashMap<>();
                            error.put("error", "레슨을 찾을 수 없습니다.");
                            return ResponseEntity.<Map<String, Object>>status(HttpStatus.NOT_FOUND).body(error);
                        }
                        
                        Map<String, Object> map = new HashMap<>();
                        map.put("id", booking.getId());
                        map.put("startTime", booking.getStartTime());
                        map.put("endTime", booking.getEndTime());
                        map.put("participants", booking.getParticipants());
                        map.put("status", booking.getStatus() != null ? booking.getStatus().name() : null);
                        map.put("lessonCategory", booking.getLessonCategory() != null ? booking.getLessonCategory().name() : null);
                        map.put("memo", booking.getMemo());
                        map.put("createdAt", booking.getCreatedAt());
                        
                        // Coach 정보
                        if (booking.getCoach() != null) {
                            try {
                                Map<String, Object> coachMap = new HashMap<>();
                                coachMap.put("id", booking.getCoach().getId());
                                coachMap.put("name", booking.getCoach().getName());
                                coachMap.put("specialties", booking.getCoach().getSpecialties());
                                map.put("coach", coachMap);
                            } catch (Exception e) {
                                logger.warn("Coach 로드 실패: Booking ID={}", booking.getId(), e);
                                map.put("coach", null);
                            }
                        } else {
                            map.put("coach", null);
                        }
                        
                        // Member 정보
                        if (booking.getMember() != null) {
                            try {
                                Map<String, Object> memberMap = new HashMap<>();
                                memberMap.put("id", booking.getMember().getId());
                                memberMap.put("name", booking.getMember().getName());
                                memberMap.put("memberNumber", booking.getMember().getMemberNumber());
                                map.put("member", memberMap);
                            } catch (Exception e) {
                                logger.warn("Member 로드 실패: Booking ID={}", booking.getId(), e);
                                map.put("member", null);
                            }
                        } else {
                            map.put("member", null);
                        }
                        
                        // Facility 정보
                        if (booking.getFacility() != null) {
                            try {
                                Map<String, Object> facilityMap = new HashMap<>();
                                facilityMap.put("id", booking.getFacility().getId());
                                facilityMap.put("name", booking.getFacility().getName());
                                map.put("facility", facilityMap);
                            } catch (Exception e) {
                                logger.warn("Facility 로드 실패: Booking ID={}", booking.getId(), e);
                                map.put("facility", null);
                            }
                        } else {
                            map.put("facility", null);
                        }
                        
                        return ResponseEntity.ok(map);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("레슨 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
