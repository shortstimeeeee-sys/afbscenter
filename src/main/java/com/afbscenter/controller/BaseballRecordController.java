package com.afbscenter.controller;

import com.afbscenter.model.BaseballRecord;
import com.afbscenter.service.BaseballRecordService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/baseball-records")
public class BaseballRecordController {

    private final BaseballRecordService baseballRecordService;

    public BaseballRecordController(BaseballRecordService baseballRecordService) {
        this.baseballRecordService = baseballRecordService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<BaseballRecord>> getAllRecords() {
        return ResponseEntity.ok(baseballRecordService.getAllRecords());
    }

    @GetMapping("/member/{memberId}")
    @Transactional(readOnly = true)
    public ResponseEntity<List<BaseballRecord>> getRecordsByMember(@PathVariable Long memberId) {
        return ResponseEntity.ok(baseballRecordService.getRecordsByMember(memberId));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<BaseballRecord> getRecordById(@PathVariable Long id) {
        return baseballRecordService.getRecordById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/member/{memberId}")
    @Transactional
    public ResponseEntity<BaseballRecord> createRecord(@PathVariable Long memberId, @Valid @RequestBody BaseballRecord record) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(baseballRecordService.createRecord(memberId, record));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<BaseballRecord> updateRecord(@PathVariable Long id, @Valid @RequestBody BaseballRecord record) {
        try {
            return ResponseEntity.ok(baseballRecordService.updateRecord(id, record));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteRecord(@PathVariable Long id) {
        try {
            baseballRecordService.deleteRecord(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/date-range")
    @Transactional(readOnly = true)
    public ResponseEntity<List<BaseballRecord>> getRecordsByDateRange(
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate) {
        return ResponseEntity.ok(baseballRecordService.getRecordsByDateRange(startDate, endDate));
    }

    @GetMapping("/member/{memberId}/average-batting")
    @Transactional(readOnly = true)
    public ResponseEntity<Double> getAverageBattingAverage(@PathVariable Long memberId) {
        Double average = baseballRecordService.calculateAverageBattingAverage(memberId);
        return ResponseEntity.ok(average != null ? average : 0.0);
    }
}
