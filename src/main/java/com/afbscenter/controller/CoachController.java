package com.afbscenter.controller;

import com.afbscenter.model.Coach;
import com.afbscenter.service.CoachService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/coaches")
public class CoachController {

    private final CoachService coachService;

    public CoachController(CoachService coachService) {
        this.coachService = coachService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Coach>> getAllCoaches(
            @RequestParam(required = false) String branch) {
        List<Coach> coaches = coachService.getAllCoaches();
        
        // branch 파라미터가 있으면 해당 지점에 배정된 코치만 필터링
        if (branch != null && !branch.trim().isEmpty()) {
            coaches = coaches.stream()
                .filter(coach -> {
                    String availableBranches = coach.getAvailableBranches();
                    if (availableBranches == null || availableBranches.trim().isEmpty()) {
                        return false; // 배정된 지점이 없으면 제외
                    }
                    // 쉼표로 구분된 지점 목록에 해당 지점이 포함되어 있는지 확인
                    return availableBranches.toUpperCase().contains(branch.toUpperCase());
                })
                .collect(java.util.stream.Collectors.toList());
        }
        
        return ResponseEntity.ok(coaches);
    }

    @GetMapping("/active")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Coach>> getActiveCoaches() {
        return ResponseEntity.ok(coachService.getActiveCoaches());
    }

    @GetMapping("/by-user/{userId}")
    @Transactional(readOnly = true)
    public ResponseEntity<Coach> getCoachByUserId(@PathVariable Long userId) {
        return coachService.getCoachByUserId(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Coach> getCoachById(@PathVariable Long id) {
        return coachService.getCoachById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Coach> createCoach(@Valid @RequestBody Coach coach) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(coachService.createCoach(coach));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Coach> updateCoach(@PathVariable Long id, @Valid @RequestBody Coach coach) {
        try {
            return ResponseEntity.ok(coachService.updateCoach(id, coach));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteCoach(@PathVariable Long id) {
        try {
            coachService.deleteCoach(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/student-count")
    @Transactional(readOnly = true)
    public ResponseEntity<Long> getStudentCount(@PathVariable Long id) {
        try {
            // 코치 존재 여부 확인
            if (!coachService.getCoachById(id).isPresent()) {
                // 코치가 없으면 0 반환 (404 대신)
                return ResponseEntity.ok(0L);
            }
            return ResponseEntity.ok(coachService.getStudentCount(id));
        } catch (Exception e) {
            // 예외 발생 시에도 0 반환 (서비스 중단 방지)
            return ResponseEntity.ok(0L);
        }
    }

    @GetMapping("/{id}/students")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getStudents(@PathVariable Long id) {
        try {
            org.slf4j.LoggerFactory.getLogger(CoachController.class)
                .info("코치 수강 인원 조회 요청: coachId={}", id);
            
            // 코치 존재 여부 확인
            if (!coachService.getCoachById(id).isPresent()) {
                org.slf4j.LoggerFactory.getLogger(CoachController.class)
                    .warn("코치를 찾을 수 없음: coachId={}", id);
                return ResponseEntity.ok(new java.util.ArrayList<>());
            }
            
            List<com.afbscenter.model.Member> students = coachService.getStudents(id);
            org.slf4j.LoggerFactory.getLogger(CoachController.class)
                .info("코치 수강 인원 조회 성공: coachId={}, 인원수={}", id, students.size());
            
            // Member 객체를 직접 반환하지 않고 DTO로 변환
            List<java.util.Map<String, Object>> studentList = new java.util.ArrayList<>();
            for (com.afbscenter.model.Member member : students) {
                java.util.Map<String, Object> studentMap = new java.util.HashMap<>();
                studentMap.put("id", member.getId());
                studentMap.put("memberNumber", member.getMemberNumber());
                studentMap.put("name", member.getName());
                studentMap.put("phoneNumber", member.getPhoneNumber());
                studentMap.put("grade", member.getGrade() != null ? member.getGrade().toString() : null);
                studentMap.put("school", member.getSchool());
                studentList.add(studentMap);
            }
            
            return ResponseEntity.ok(studentList);
        } catch (Exception e) {
            // 모든 예외 발생 시 에러 메시지와 함께 빈 목록 반환
            org.slf4j.LoggerFactory.getLogger(CoachController.class)
                .error("코치 수강 인원 조회 실패 (coachId: {}): {}", id, e.getMessage(), e);
            
            // 에러 정보를 포함한 응답 반환 (개발 중에는 유용)
            java.util.Map<String, Object> errorResponse = new java.util.HashMap<>();
            errorResponse.put("error", true);
            errorResponse.put("message", e.getMessage());
            errorResponse.put("students", new java.util.ArrayList<>());
            
            return ResponseEntity.ok(errorResponse);
        }
    }
}
