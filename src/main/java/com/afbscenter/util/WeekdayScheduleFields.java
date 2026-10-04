package com.afbscenter.util;

import java.util.Map;
import java.util.Set;

/**
 * 요일 반복 일정(체험·야외·청백전·정회원 모임) 공통 — 사용시간·지점·장소·담당 코치.
 */
public final class WeekdayScheduleFields {

    private static final Set<String> ALLOWED_PLACES = Set.of("BPA 야구장");

    private WeekdayScheduleFields() {
    }

    public static String normalizeBranch(Object raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.toString().trim().toUpperCase();
        if (v.isEmpty()) {
            return null;
        }
        if ("YEONSAN".equals(v) || "연산".equals(raw.toString().trim()) || "연산점".equals(raw.toString().trim())) {
            return "YEONSAN";
        }
        if ("SAHA".equals(v) || "사하".equals(raw.toString().trim()) || "사하점".equals(raw.toString().trim())) {
            return "SAHA";
        }
        return null;
    }

    public static String normalizeTimeText(Object raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.toString().trim();
        if (v.isEmpty()) {
            return null;
        }
        if (v.length() > 80) {
            return v.substring(0, 80);
        }
        return v;
    }

    public static Long normalizeCoachId(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number) {
            long id = ((Number) raw).longValue();
            return id > 0 ? id : null;
        }
        String v = raw.toString().trim();
        if (v.isEmpty()) {
            return null;
        }
        try {
            long id = Long.parseLong(v);
            return id > 0 ? id : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static String normalizePlace(Object raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.toString().trim();
        if (v.isEmpty()) {
            return null;
        }
        if ("BPA".equalsIgnoreCase(v) || "BPA야구장".equalsIgnoreCase(v.replace(" ", ""))) {
            return "BPA 야구장";
        }
        if (ALLOWED_PLACES.contains(v)) {
            return v;
        }
        if (v.length() > 80) {
            return v.substring(0, 80);
        }
        // 허용 목록 외 자유 입력도 저장 가능(확장용)
        return v;
    }

    public static void putInto(Map<String, Object> map, String timeText, String branch, Long coachId) {
        putInto(map, timeText, branch, coachId, null);
    }

    public static void putInto(Map<String, Object> map, String timeText, String branch, Long coachId, String place) {
        map.put("timeText", timeText);
        map.put("branch", branch);
        map.put("coachId", coachId);
        map.put("place", place);
    }

    /** [0]=timeText, [1]=branch, [2]=coachId, [3]=place */
    public static Object[] readFromBody(Map<String, Object> body) {
        if (body == null) {
            return new Object[]{null, null, null, null};
        }
        return new Object[]{
                normalizeTimeText(body.get("timeText")),
                normalizeBranch(body.get("branch")),
                normalizeCoachId(body.get("coachId")),
                normalizePlace(body.get("place"))
        };
    }
}
