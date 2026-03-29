package com.afbscenter.util;

import com.afbscenter.model.Settings;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 설정에 저장된 회비 입금 전용계좌 안내를 공지 목록·알림(종)과 동일한 형태로 노출하기 위한 헬퍼.
 */
public final class MembershipDuesAnnouncementHelper {

    public static final long SYNTHETIC_ANNOUNCEMENT_ID = -1L;

    private MembershipDuesAnnouncementHelper() {
    }

    public static boolean shouldExposeInBell(Settings settings) {
        if (settings == null) {
            return false;
        }
        if (Boolean.FALSE.equals(settings.getShowMembershipDuesInBell())) {
            return false;
        }
        String notice = settings.getMembershipDuesAccountNotice();
        return notice != null && !notice.trim().isEmpty();
    }

    public static Map<String, Object> toSyntheticMap(Settings settings) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", SYNTHETIC_ANNOUNCEMENT_ID);
        map.put("title", "회비 입금 전용계좌");
        map.put("content", settings.getMembershipDuesAccountNotice().trim());
        map.put("startDate", null);
        map.put("endDate", null);
        map.put("createdAt", settings.getUpdatedAt() != null ? settings.getUpdatedAt() : LocalDateTime.now());
        map.put("updatedAt", settings.getUpdatedAt());
        map.put("isActive", true);
        map.put("type", "MEMBERSHIP_DUES_ACCOUNT");
        map.put("source", "SETTINGS_MEMBERSHIP_DUES");
        map.put("hideFromStaffFeed", false);
        return map;
    }
}
