package com.afbscenter.controller;

import com.afbscenter.model.Coach;
import com.afbscenter.service.CoachService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/coaches")
@CrossOrigin(origins = "http://localhost:8080")
public class CoachController {

    @Autowired
    private CoachService coachService;

    @GetMapping
    public ResponseEntity<List<Coach>> getAllCoaches() {
        return ResponseEntity.ok(coachService.getAllCoaches());
    }

    @GetMapping("/active")
    public ResponseEntity<List<Coach>> getActiveCoaches() {
        return ResponseEntity.ok(coachService.getActiveCoaches());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Coach> getCoachById(@PathVariable Long id) {
        return coachService.getCoachById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Coach> createCoach(@RequestBody Coach coach) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(coachService.createCoach(coach));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Coach> updateCoach(@PathVariable Long id, @RequestBody Coach coach) {
        try {
            return ResponseEntity.ok(coachService.updateCoach(id, coach));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCoach(@PathVariable Long id) {
        try {
            coachService.deleteCoach(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/student-count")
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
    public ResponseEntity<List<com.afbscenter.model.Member>> getStudents(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(coachService.getStudents(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
