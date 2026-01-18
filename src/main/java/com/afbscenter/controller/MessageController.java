package com.afbscenter.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "http://localhost:8080")
public class MessageController {

    private static final Logger logger = LoggerFactory.getLogger(MessageController.class);

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllMessages() {
        try {
            // 현재는 빈 배열 반환 (나중에 구현 가능)
            List<Map<String, Object>> messages = new ArrayList<>();
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            logger.error("메시지 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getMessageById(@PathVariable Long id) {
        try {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "메시지를 찾을 수 없습니다.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            logger.error("메시지 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createMessage(@RequestBody Map<String, Object> message) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "메시지 기능은 아직 구현되지 않았습니다.");
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(response);
        } catch (Exception e) {
            logger.error("메시지 생성 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateMessage(@PathVariable Long id, @RequestBody Map<String, Object> message) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "메시지 기능은 아직 구현되지 않았습니다.");
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(response);
        } catch (Exception e) {
            logger.error("메시지 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long id) {
        try {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        } catch (Exception e) {
            logger.error("메시지 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
