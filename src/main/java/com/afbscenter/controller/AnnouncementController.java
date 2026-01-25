package com.afbscenter.controller;

import com.afbscenter.model.Announcement;
import com.afbscenter.repository.AnnouncementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private static final Logger logger = LoggerFactory.getLogger(AnnouncementController.class);

    private final AnnouncementRepository announcementRepository;

    public AnnouncementController(AnnouncementRepository announcementRepository) {
        this.announcementRepository = announcementRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllAnnouncements() {
        try {
            List<Announcement> announcements = announcementRepository.findAllOrderByCreatedAtDesc();
            List<Map<String, Object>> result = new ArrayList<>();
            LocalDate currentDate = LocalDate.now();
            
            for (Announcement announcement : announcements) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", announcement.getId());
                map.put("title", announcement.getTitle());
                map.put("content", announcement.getContent());
                map.put("startDate", announcement.getStartDate());
                map.put("endDate", announcement.getEndDate());
                map.put("createdAt", announcement.getCreatedAt());
                map.put("updatedAt", announcement.getUpdatedAt());
                
                // 활성 상태 계산 (현재 날짜가 시작일과 종료일 사이에 있는지)
                boolean isActive = true;
                if (announcement.getStartDate() != null && announcement.getStartDate().isAfter(currentDate)) {
                    isActive = false;
                }
                if (announcement.getEndDate() != null && announcement.getEndDate().isBefore(currentDate)) {
                    isActive = false;
                }
                map.put("isActive", isActive);
                
                result.add(map);
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("공지 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getAnnouncementById(@PathVariable Long id) {
        try {
            Announcement announcement = announcementRepository.findById(id)
                    .orElse(null);
            
            if (announcement == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "공지를 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            
            Map<String, Object> map = new HashMap<>();
            map.put("id", announcement.getId());
            map.put("title", announcement.getTitle());
            map.put("content", announcement.getContent());
            map.put("startDate", announcement.getStartDate());
            map.put("endDate", announcement.getEndDate());
            map.put("createdAt", announcement.getCreatedAt());
            map.put("updatedAt", announcement.getUpdatedAt());
            
            // 활성 상태 계산
            LocalDate currentDate = LocalDate.now();
            boolean isActive = true;
            if (announcement.getStartDate() != null && announcement.getStartDate().isAfter(currentDate)) {
                isActive = false;
            }
            if (announcement.getEndDate() != null && announcement.getEndDate().isBefore(currentDate)) {
                isActive = false;
            }
            map.put("isActive", isActive);
            
            return ResponseEntity.ok(map);
        } catch (Exception e) {
            logger.error("공지 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> createAnnouncement(@RequestBody Map<String, Object> announcementData) {
        logger.info("공지 생성 요청 수신: {}", announcementData);
        
        try {
            // 필수 필드 검증
            String title = announcementData.get("title") != null ? announcementData.get("title").toString().trim() : null;
            if (title == null || title.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "제목은 필수입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            String content = announcementData.get("content") != null ? announcementData.get("content").toString().trim() : null;
            if (content == null || content.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "내용은 필수입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            Announcement announcement = new Announcement();
            announcement.setTitle(title);
            announcement.setContent(content);
            // createdAt은 @PrePersist에서 자동 설정되지만, 명시적으로 설정
            announcement.setCreatedAt(LocalDateTime.now());
            // active 기본값 설정
            announcement.setActive(true);
            // type 기본값 설정
            announcement.setType("GENERAL");
            
            // 시작일 파싱
            Object startDateObj = announcementData.get("startDate");
            if (startDateObj != null && !startDateObj.toString().trim().isEmpty() && !"null".equals(startDateObj.toString())) {
                try {
                    String startDateStr = startDateObj.toString().trim();
                    announcement.setStartDate(LocalDate.parse(startDateStr));
                    logger.debug("시작일 파싱 성공: {}", startDateStr);
                } catch (Exception e) {
                    logger.warn("시작일 파싱 실패: {} - {}", startDateObj, e.getMessage());
                    announcement.setStartDate(null);
                }
            } else {
                announcement.setStartDate(null);
            }
            
            // 종료일 파싱
            Object endDateObj = announcementData.get("endDate");
            if (endDateObj != null && !endDateObj.toString().trim().isEmpty() && !"null".equals(endDateObj.toString())) {
                try {
                    String endDateStr = endDateObj.toString().trim();
                    announcement.setEndDate(LocalDate.parse(endDateStr));
                    logger.debug("종료일 파싱 성공: {}", endDateStr);
                } catch (Exception e) {
                    logger.warn("종료일 파싱 실패: {} - {}", endDateObj, e.getMessage());
                    announcement.setEndDate(null);
                }
            } else {
                announcement.setEndDate(null);
            }
            
            logger.info("공지 저장 시도: 제목={}, 내용 길이={}, 시작일={}, 종료일={}, createdAt={}", 
                announcement.getTitle(), announcement.getContent().length(), 
                announcement.getStartDate(), announcement.getEndDate(), announcement.getCreatedAt());
            
            // createdAt이 null이면 명시적으로 설정
            if (announcement.getCreatedAt() == null) {
                announcement.setCreatedAt(LocalDateTime.now());
                logger.debug("createdAt 명시적으로 설정: {}", announcement.getCreatedAt());
            }
            
            logger.info("Repository를 사용하여 공지 저장 시작...");
            Announcement saved = announcementRepository.save(announcement);
            logger.info("공지 저장 완료: ID={}", saved.getId());
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("title", saved.getTitle());
            response.put("content", saved.getContent());
            response.put("startDate", saved.getStartDate());
            response.put("endDate", saved.getEndDate());
            response.put("createdAt", saved.getCreatedAt());
            response.put("message", "공지가 등록되었습니다.");
            
            logger.info("공지 등록 완료: ID={}, 제목={}", saved.getId(), saved.getTitle());
            return ResponseEntity.ok(response);
            
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            logger.error("데이터 무결성 오류 발생: {}", e.getMessage(), e);
            if (e.getCause() != null) {
                logger.error("원인: {}", e.getCause().getMessage());
            }
            Map<String, Object> error = new HashMap<>();
            String errorMessage = e.getMessage() != null ? e.getMessage() : "데이터 저장 중 오류가 발생했습니다.";
            if (e.getCause() != null && e.getCause().getMessage() != null) {
                errorMessage = e.getCause().getMessage();
            }
            error.put("error", "데이터 저장 중 오류가 발생했습니다: " + errorMessage);
            error.put("errorClass", e.getClass().getName());
            if (e.getCause() != null) {
                error.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        } catch (org.springframework.transaction.UnexpectedRollbackException e) {
            logger.error("트랜잭션 롤백 오류 발생: {}", e.getMessage(), e);
            if (e.getCause() != null) {
                logger.error("원인: {}", e.getCause().getMessage());
            }
            Map<String, Object> error = new HashMap<>();
            String errorMessage = "데이터 저장 중 오류가 발생했습니다.";
            if (e.getCause() != null && e.getCause().getMessage() != null) {
                errorMessage = e.getCause().getMessage();
            }
            error.put("error", errorMessage);
            error.put("errorClass", e.getClass().getName());
            if (e.getCause() != null) {
                error.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        } catch (Exception e) {
            logger.error("공지 생성 중 오류 발생", e);
            logger.error("오류 클래스: {}", e.getClass().getName());
            logger.error("오류 메시지: {}", e.getMessage());
            e.printStackTrace();
            
            Throwable cause = e.getCause();
            int depth = 0;
            while (cause != null && depth < 5) {
                logger.error("원인 {}: {} - {}", depth + 1, cause.getClass().getName(), cause.getMessage());
                cause = cause.getCause();
                depth++;
            }
            
            Map<String, Object> error = new HashMap<>();
            error.put("error", "공지 생성 중 오류가 발생했습니다: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
            error.put("errorClass", e.getClass().getName());
            if (e.getCause() != null) {
                error.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            if (e.getStackTrace() != null && e.getStackTrace().length > 0) {
                error.put("stackTrace", e.getStackTrace()[0].toString());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateAnnouncement(@PathVariable Long id, @RequestBody Map<String, Object> announcementData) {
        try {
            Announcement announcement = announcementRepository.findById(id)
                    .orElse(null);
            
            if (announcement == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "공지를 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            
            // 필수 필드 검증
            if (announcementData.get("title") != null) {
                announcement.setTitle(announcementData.get("title").toString());
            }
            if (announcementData.get("content") != null) {
                announcement.setContent(announcementData.get("content").toString());
            }
            
            // 시작일 파싱
            if (announcementData.get("startDate") != null) {
                String startDateStr = announcementData.get("startDate").toString().trim();
                if (startDateStr.isEmpty()) {
                    announcement.setStartDate(null);
                } else {
                    try {
                        announcement.setStartDate(LocalDate.parse(startDateStr));
                    } catch (Exception e) {
                        logger.warn("시작일 파싱 실패: {}", startDateStr);
                    }
                }
            }
            
            // 종료일 파싱
            if (announcementData.get("endDate") != null) {
                String endDateStr = announcementData.get("endDate").toString().trim();
                if (endDateStr.isEmpty()) {
                    announcement.setEndDate(null);
                } else {
                    try {
                        announcement.setEndDate(LocalDate.parse(endDateStr));
                    } catch (Exception e) {
                        logger.warn("종료일 파싱 실패: {}", endDateStr);
                    }
                }
            }
            
            announcement.setUpdatedAt(LocalDateTime.now());
            
            Announcement saved = announcementRepository.save(announcement);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("title", saved.getTitle());
            response.put("content", saved.getContent());
            response.put("startDate", saved.getStartDate());
            response.put("endDate", saved.getEndDate());
            response.put("updatedAt", saved.getUpdatedAt());
            response.put("message", "공지가 수정되었습니다.");
            
            logger.info("공지 수정 완료: ID={}, 제목={}", saved.getId(), saved.getTitle());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("공지 수정 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "공지 수정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable Long id) {
        try {
            if (!announcementRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            
            announcementRepository.deleteById(id);
            logger.info("공지 삭제 완료: ID={}", id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("공지 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
