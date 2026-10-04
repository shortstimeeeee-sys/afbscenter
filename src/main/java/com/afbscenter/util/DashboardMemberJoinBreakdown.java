package com.afbscenter.util;

import com.afbscenter.model.Member;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 대시보드 월 가입 수를 사하/연산 × 엘리트·유소년·사회인으로 나눌 때 사용.
 */
public final class DashboardMemberJoinBreakdown {

    private DashboardMemberJoinBreakdown() {
    }

    public static Map<String, Long> emptyCounts() {
        Map<String, Long> row = new LinkedHashMap<>();
        row.put("total", 0L);
        row.put("elite", 0L);
        row.put("youth", 0L);
        row.put("social", 0L);
        row.put("other", 0L);
        return row;
    }

    public static Map<String, Map<String, Long>> emptyByStudio() {
        Map<String, Map<String, Long>> map = new LinkedHashMap<>();
        map.put("SAHA", emptyCounts());
        map.put("YEONSAN", emptyCounts());
        return map;
    }

    public static void add(Map<String, Map<String, Long>> byStudio, String grade, String availableBranches) {
        if (byStudio == null) {
            return;
        }
        String studio = studioFromBranches(availableBranches);
        Map<String, Long> row = byStudio.computeIfAbsent(studio, key -> emptyCounts());
        row.merge("total", 1L, Long::sum);
        row.merge(categoryFromGrade(grade), 1L, Long::sum);
    }

    static String studioFromBranches(String availableBranches) {
        if (availableBranches == null || availableBranches.isBlank()) {
            return "SAHA";
        }
        String upper = availableBranches.toUpperCase(Locale.ROOT);
        boolean saha = upper.contains("SAHA");
        boolean yeonsan = upper.contains("YEONSAN");
        if (yeonsan && !saha) {
            return "YEONSAN";
        }
        return "SAHA";
    }

    static String categoryFromGrade(String grade) {
        if (grade == null || grade.isBlank()) {
            return "social";
        }
        String key = grade.trim().toUpperCase(Locale.ROOT);
        if (key.startsWith("ELITE")) {
            return "elite";
        }
        if ("YOUTH".equals(key)) {
            return "youth";
        }
        if ("SOCIAL".equals(key)) {
            return "social";
        }
        return "other";
    }

    static String categoryFromGrade(Member.MemberGrade grade) {
        return categoryFromGrade(grade != null ? grade.name() : null);
    }
}
