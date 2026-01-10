package com.afbscenter.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/db-check")
@CrossOrigin(origins = "*")
public class DatabaseCheckController {

    @Autowired
    private EntityManager entityManager;

    @GetMapping("/columns")
    public ResponseEntity<Map<String, Object>> checkColumns() {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> columnChecks = new ArrayList<>();

        // LESSONS 테이블의 CATEGORY 컬럼 확인
        Map<String, Object> lessonsCheck = checkColumn("LESSONS", "CATEGORY");
        columnChecks.add(lessonsCheck);

        // TRAINING_LOGS 테이블의 TRAINING_PART 컬럼 확인
        Map<String, Object> trainingLogsCheck = checkColumn("TRAINING_LOGS", "TRAINING_PART");
        columnChecks.add(trainingLogsCheck);

        // BOOKINGS 테이블의 LESSON_CATEGORY 컬럼 확인
        Map<String, Object> bookingsCheck = checkColumn("BOOKINGS", "LESSON_CATEGORY");
        columnChecks.add(bookingsCheck);

        result.put("columns", columnChecks);
        result.put("allFound", columnChecks.stream().allMatch(c -> (Boolean) c.get("exists")));

        return ResponseEntity.ok(result);
    }

    private Map<String, Object> checkColumn(String tableName, String columnName) {
        Map<String, Object> result = new HashMap<>();
        result.put("table", tableName);
        result.put("column", columnName);
        
        try {
            Query query = entityManager.createNativeQuery(
                "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE " +
                "FROM INFORMATION_SCHEMA.COLUMNS " +
                "WHERE TABLE_NAME = ? AND COLUMN_NAME = ?"
            );
            query.setParameter(1, tableName);
            query.setParameter(2, columnName);
            
            @SuppressWarnings("unchecked")
            List<Object[]> results = query.getResultList();
            
            if (!results.isEmpty()) {
                Object[] row = results.get(0);
                result.put("exists", true);
                result.put("dataType", row[1]);
                result.put("nullable", row[2]);
            } else {
                result.put("exists", false);
            }
        } catch (Exception e) {
            result.put("exists", false);
            result.put("error", e.getMessage());
        }
        
        return result;
    }
}
