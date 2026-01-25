package com.afbscenter.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 데이터베이스 상태 확인용 컨트롤러
 */
@RestController
@RequestMapping("/api/db-status")
public class DatabaseStatusController {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseStatusController.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDatabaseStatus() {
        Map<String, Object> status = new HashMap<>();
        
        try {
            // 각 테이블의 데이터 개수 확인
            status.put("members", getTableCount("members"));
            status.put("facilities", getTableCount("facilities"));
            status.put("products", getTableCount("products"));
            status.put("coaches", getTableCount("coaches"));
            status.put("bookings", getTableCount("bookings"));
            status.put("member_products", getTableCount("member_products"));
            status.put("payments", getTableCount("payments"));
            status.put("attendances", getTableCount("attendances"));
            status.put("training_logs", getTableCount("training_logs"));
            status.put("baseball_records", getTableCount("baseball_records"));
            
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            logger.error("데이터베이스 상태 확인 중 오류 발생", e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
    
    private Long getTableCount(String tableName) {
        try {
            Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + tableName, 
                Long.class
            );
            return count != null ? count : 0L;
        } catch (Exception e) {
            logger.warn("테이블 {} 조회 실패: {}", tableName, e.getMessage());
            return -1L; // 테이블이 없거나 오류 발생
        }
    }
}
