package com.afbscenter.controller;

import com.afbscenter.model.Message;
import com.afbscenter.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private static final Logger logger = LoggerFactory.getLogger(MessageController.class);

    private final MessageRepository messageRepository;

    public MessageController(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllMessages() {
        try {
            List<Message> messages = messageRepository.findAllOrderByCreatedAtDesc();
            
            List<Map<String, Object>> result = messages.stream().map(message -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", message.getId());
                map.put("recipient", message.getRecipient());
                map.put("content", message.getContent());
                map.put("status", message.getStatus().name());
                map.put("type", message.getType().name());
                map.put("sentAt", message.getSentAt());
                map.put("createdAt", message.getCreatedAt());
                map.put("errorMessage", message.getErrorMessage());
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("메시지 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMessageById(@PathVariable Long id) {
        try {
            return messageRepository.findById(id)
                    .map(message -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("id", message.getId());
                        map.put("recipient", message.getRecipient());
                        map.put("content", message.getContent());
                        map.put("status", message.getStatus().name());
                        map.put("type", message.getType().name());
                        map.put("sentAt", message.getSentAt());
                        map.put("createdAt", message.getCreatedAt());
                        map.put("errorMessage", message.getErrorMessage());
                        return ResponseEntity.ok(map);
                    })
                    .orElseGet(() -> {
                        Map<String, Object> error = new HashMap<>();
                        error.put("error", "메시지를 찾을 수 없습니다.");
                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
                    });
        } catch (Exception e) {
            logger.error("메시지 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> createMessage(@RequestBody Map<String, Object> messageData) {
        try {
            // 필수 필드 검증
            String recipient = messageData.get("recipient") != null ? messageData.get("recipient").toString() : null;
            String content = messageData.get("content") != null ? messageData.get("content").toString() : null;
            
            if (recipient == null || recipient.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "수신자는 필수입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            if (content == null || content.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "메시지 내용은 필수입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            Message message = new Message();
            message.setRecipient(recipient);
            message.setContent(content);
            message.setCreatedAt(LocalDateTime.now());
            
            // 메시지 타입 설정
            String type = messageData.get("type") != null ? messageData.get("type").toString() : "SMS";
            try {
                message.setType(Message.MessageType.valueOf(type));
            } catch (IllegalArgumentException e) {
                message.setType(Message.MessageType.SMS);
            }
            
            // 상태 설정 (기본: PENDING)
            message.setStatus(Message.MessageStatus.PENDING);
            
            // 실제 환경에서는 여기서 SMS API 호출
            // 현재는 시뮬레이션으로 즉시 SENT 상태로 변경
            message.setStatus(Message.MessageStatus.SENT);
            message.setSentAt(LocalDateTime.now());
            
            Message saved = messageRepository.save(message);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("recipient", saved.getRecipient());
            response.put("content", saved.getContent());
            response.put("status", saved.getStatus().name());
            response.put("type", saved.getType().name());
            response.put("sentAt", saved.getSentAt());
            response.put("createdAt", saved.getCreatedAt());
            response.put("message", "메시지가 발송되었습니다.");
            
            logger.info("메시지 발송 완료: ID={}, 수신자={}", saved.getId(), saved.getRecipient());
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("메시지 생성 중 오류 발생", e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "메시지 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateMessage(@PathVariable Long id, @RequestBody Map<String, Object> messageData) {
        try {
            return messageRepository.findById(id)
                    .map(message -> {
                        // 수신자 업데이트
                        if (messageData.get("recipient") != null) {
                            message.setRecipient(messageData.get("recipient").toString());
                        }
                        
                        // 내용 업데이트
                        if (messageData.get("content") != null) {
                            message.setContent(messageData.get("content").toString());
                        }
                        
                        // 상태 업데이트
                        if (messageData.get("status") != null) {
                            try {
                                Message.MessageStatus status = Message.MessageStatus.valueOf(
                                    messageData.get("status").toString()
                                );
                                message.setStatus(status);
                                if (status == Message.MessageStatus.SENT && message.getSentAt() == null) {
                                    message.setSentAt(LocalDateTime.now());
                                }
                            } catch (IllegalArgumentException e) {
                                logger.warn("잘못된 상태 값: {}", messageData.get("status"));
                            }
                        }
                        
                        Message saved = messageRepository.save(message);
                        
                        Map<String, Object> response = new HashMap<>();
                        response.put("id", saved.getId());
                        response.put("recipient", saved.getRecipient());
                        response.put("content", saved.getContent());
                        response.put("status", saved.getStatus().name());
                        response.put("type", saved.getType().name());
                        response.put("sentAt", saved.getSentAt());
                        response.put("message", "메시지가 수정되었습니다.");
                        
                        logger.info("메시지 수정 완료: ID={}", saved.getId());
                        return ResponseEntity.ok(response);
                    })
                    .orElseGet(() -> {
                        Map<String, Object> error = new HashMap<>();
                        error.put("error", "메시지를 찾을 수 없습니다.");
                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
                    });
        } catch (Exception e) {
            logger.error("메시지 수정 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "메시지 수정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteMessage(@PathVariable Long id) {
        try {
            if (!messageRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            
            messageRepository.deleteById(id);
            logger.info("메시지 삭제 완료: ID={}", id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("메시지 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
