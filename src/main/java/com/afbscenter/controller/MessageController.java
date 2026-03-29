package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.Member.MemberGrade;
import com.afbscenter.model.Message;
import com.afbscenter.repository.MemberRepository;
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
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private static final Logger logger = LoggerFactory.getLogger(MessageController.class);

    private final MessageRepository messageRepository;
    private final MemberRepository memberRepository;

    public MessageController(MessageRepository messageRepository, MemberRepository memberRepository) {
        this.messageRepository = messageRepository;
        this.memberRepository = memberRepository;
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

    /**
     * 상단 종 알림용: 마지막으로 확인한 message id 이후 신규 발송 건수.
     * {@code afterId=0}이면 id&gt;0 인 전체 건수(초기 동기화에 사용 가능).
     */
    @GetMapping("/stats/bell")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> bellStats(@RequestParam(defaultValue = "0") long afterId) {
        try {
            long maxId = messageRepository.findMaxId();
            long aid = Math.max(0L, afterId);
            long newCount = messageRepository.countByIdGreaterThan(aid);
            Map<String, Object> out = new HashMap<>();
            out.put("newCount", newCount);
            out.put("maxId", maxId);
            return ResponseEntity.ok(out);
        } catch (Exception e) {
            logger.error("메시지 종 알림 통계 조회 실패", e);
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
            String content = messageData.get("content") != null ? messageData.get("content").toString() : null;

            String targetValidationError = validateMessageTarget(messageData);
            if (targetValidationError != null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", targetValidationError);
                return ResponseEntity.badRequest().body(error);
            }

            String recipient = resolveRecipientFromTargetOrLegacy(messageData);
            if (recipient == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "발송 대상 또는 수신자 정보를 확인해 주세요.");
                return ResponseEntity.badRequest().body(error);
            }
            if (recipient.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "등록된 회원번호가 아닙니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
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

    /**
     * target별 필수 파라미터(등급, 회원번호) 검증. 통과 시 null.
     */
    private String validateMessageTarget(Map<String, Object> messageData) {
        Object targetObj = messageData.get("target");
        if (targetObj == null || targetObj.toString().trim().isEmpty()) {
            return null;
        }
        String t = targetObj.toString().trim().toUpperCase();
        if ("GRADE".equals(t)) {
            String g = messageData.get("grade") != null ? messageData.get("grade").toString().trim() : "";
            if (g.isEmpty()) {
                return "등급을 선택해 주세요.";
            }
            try {
                MemberGrade.valueOf(g.toUpperCase());
            } catch (IllegalArgumentException e) {
                return "올바른 등급이 아닙니다.";
            }
        }
        if ("MEMBER".equals(t)) {
            String mn = messageData.get("memberNumber") != null
                    ? messageData.get("memberNumber").toString().trim() : "";
            if (mn.isEmpty()) {
                return "회원번호를 입력해 주세요.";
            }
        }
        return null;
    }

    private static String memberGradeDisplayName(MemberGrade grade) {
        if (grade == null) {
            return "";
        }
        switch (grade) {
            case SOCIAL:
                return "사회인";
            case ELITE_ELEMENTARY:
                return "엘리트 (초)";
            case ELITE_MIDDLE:
                return "엘리트 (중)";
            case ELITE_HIGH:
                return "엘리트 (고)";
            case YOUTH:
                return "유소년";
            case OTHER:
                return "기타 종목";
            default:
                return grade.name();
        }
    }

    /**
     * 프론트의 발송 대상(target) 또는 레거시 recipient 문자열로 수신자 표기 결정.
     * MEMBER: 회원번호로 조회해 일치할 때만 발송(저장).
     * GRADE: validateMessageTarget 통과 후 등급명 포함 표기.
     *
     * @return 수신자 표기 문자열, null이면 파라미터 부족 등, 빈 문자열이면 회원 없음(MEMBER)
     */
    private String resolveRecipientFromTargetOrLegacy(Map<String, Object> messageData) {
        Object targetObj = messageData.get("target");
        if (targetObj != null && !targetObj.toString().trim().isEmpty()) {
            String t = targetObj.toString().trim().toUpperCase();
            switch (t) {
                case "ALL":
                    return "전체";
                case "GRADE": {
                    String g = messageData.get("grade") != null
                            ? messageData.get("grade").toString().trim().toUpperCase() : "";
                    if (g.isEmpty()) {
                        return null;
                    }
                    try {
                        MemberGrade mg = MemberGrade.valueOf(g);
                        return "등급별 " + memberGradeDisplayName(mg) + " (" + mg.name() + ")";
                    } catch (IllegalArgumentException e) {
                        return null;
                    }
                }
                case "BOOKING":
                    return "예약자";
                case "MEMBER":
                    String mn = messageData.get("memberNumber") != null
                            ? messageData.get("memberNumber").toString().trim() : "";
                    if (mn.isEmpty()) {
                        return null;
                    }
                    Optional<Member> opt = memberRepository.findByMemberNumber(mn);
                    if (opt.isEmpty()) {
                        return "";
                    }
                    Member mem = opt.get();
                    String phone = mem.getPhoneNumber() != null ? mem.getPhoneNumber().trim() : "";
                    String name = mem.getName() != null ? mem.getName().trim() : "";
                    return "회원개인 " + mn + " / " + name + " / " + phone;
                default:
                    break;
            }
        }
        String legacy = messageData.get("recipient") != null ? messageData.get("recipient").toString().trim() : null;
        if (legacy != null && !legacy.isEmpty()) {
            return legacy;
        }
        return null;
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
