package com.afbscenter.controller;

import com.afbscenter.model.Announcement;
import com.afbscenter.model.Settings;
import com.afbscenter.repository.AnnouncementRepository;
import com.afbscenter.repository.SettingsRepository;
import com.afbscenter.util.MembershipDuesAnnouncementHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 비로그인 회원 예약 페이지용 공지 API (JWT 불필요, /api/public/).
 */
@RestController
@RequestMapping("/api/public/member-announcements")
public class PublicMemberAnnouncementController {

    private static final Logger logger = LoggerFactory.getLogger(PublicMemberAnnouncementController.class);

    private final AnnouncementRepository announcementRepository;
    private final SettingsRepository settingsRepository;

    public PublicMemberAnnouncementController(AnnouncementRepository announcementRepository,
                                              SettingsRepository settingsRepository) {
        this.announcementRepository = announcementRepository;
        this.settingsRepository = settingsRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listForMemberPage() {
        try {
            List<Announcement> announcements = announcementRepository.findAllOrderByCreatedAtDesc();
            List<Map<String, Object>> result = new ArrayList<>();
            LocalDate currentDate = LocalDate.now();
            for (Announcement announcement : announcements) {
                if (!Boolean.TRUE.equals(announcement.getVisibleToMembers())) {
                    continue;
                }
                Map<String, Object> map = toAnnouncementMap(announcement, currentDate);
                if (Boolean.TRUE.equals(map.get("isActive"))) {
                    result.add(map);
                }
            }
            prependMembershipDuesFromSettings(result);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 공개 공지 목록 조회 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getForMemberPage(@PathVariable Long id) {
        try {
            if (id != null && id == MembershipDuesAnnouncementHelper.SYNTHETIC_ANNOUNCEMENT_ID) {
                Settings settings = settingsRepository.findAll().stream().findFirst().orElse(null);
                if (MembershipDuesAnnouncementHelper.shouldExposeInBell(settings)) {
                    return ResponseEntity.ok(MembershipDuesAnnouncementHelper.toSyntheticMap(settings));
                }
                Map<String, Object> error = new HashMap<>();
                error.put("error", "안내를 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            Announcement announcement = announcementRepository.findById(id).orElse(null);
            if (announcement == null || !Boolean.TRUE.equals(announcement.getVisibleToMembers())) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "공지를 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            LocalDate currentDate = LocalDate.now();
            Map<String, Object> map = toAnnouncementMap(announcement, currentDate);
            if (!Boolean.TRUE.equals(map.get("isActive"))) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "노출 기간이 아닌 공지입니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }
            return ResponseEntity.ok(map);
        } catch (Exception e) {
            logger.error("회원 공개 공지 단건 조회 실패 id={}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private static Map<String, Object> toAnnouncementMap(Announcement announcement, LocalDate currentDate) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", announcement.getId());
        map.put("title", announcement.getTitle());
        map.put("content", announcement.getContent());
        map.put("startDate", announcement.getStartDate());
        map.put("endDate", announcement.getEndDate());
        map.put("createdAt", announcement.getCreatedAt());
        map.put("updatedAt", announcement.getUpdatedAt());
        boolean isActive = true;
        if (announcement.getStartDate() != null && announcement.getStartDate().isAfter(currentDate)) {
            isActive = false;
        }
        if (announcement.getEndDate() != null && announcement.getEndDate().isBefore(currentDate)) {
            isActive = false;
        }
        map.put("isActive", isActive);
        map.put("type", announcement.getType());
        map.put("visibleToMembers", true);
        return map;
    }

    private void prependMembershipDuesFromSettings(List<Map<String, Object>> result) {
        Settings settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        if (MembershipDuesAnnouncementHelper.shouldExposeInBell(settings)) {
            result.add(0, MembershipDuesAnnouncementHelper.toSyntheticMap(settings));
        }
    }
}
