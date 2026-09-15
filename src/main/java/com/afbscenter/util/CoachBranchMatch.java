package com.afbscenter.util;

import com.afbscenter.model.Coach;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 코치 목록 지점 필터.
 * 필라테스 강사는 사하·연산 중 한 곳에만 배정돼 있어도 양쪽에서 선택 가능하다.
 */
public final class CoachBranchMatch {

    private CoachBranchMatch() {
    }

    public static boolean matchesRequestedBranch(Coach coach, String branch) {
        if (coach == null) {
            return false;
        }
        if (branch == null || branch.trim().isEmpty()) {
            return true;
        }
        String requested = branch.trim().toUpperCase();
        Set<String> assigned = parseBranches(coach.getAvailableBranches());
        if (assigned.isEmpty()) {
            return false;
        }
        if (assigned.contains(requested)) {
            return true;
        }
        return isStudioBranch(requested)
                && isPilatesInstructor(coach)
                && (assigned.contains("SAHA") || assigned.contains("YEONSAN"));
    }

    /**
     * 화면 {@code App.categorizeCoachBySubject} 와 같은 우선순위:
     * 매니저 → 대관 → 트레이너 → 필라테스([강사]/필라테스).
     */
    public static boolean isPilatesInstructor(Coach coach) {
        if (coach == null) {
            return false;
        }
        String spec = combined(coach);
        if (spec.contains("매니저") || spec.contains("[매니저]")) {
            return false;
        }
        if (spec.contains("대관") || spec.contains("[대관담당]")) {
            return false;
        }
        if (spec.contains("[트레이너]") || spec.contains("트레이닝")) {
            return false;
        }
        String lower = spec.toLowerCase();
        return spec.contains("[강사]") || spec.contains("필라테스") || lower.contains("pilates");
    }

    static Set<String> parseBranches(String availableBranches) {
        if (availableBranches == null || availableBranches.trim().isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> out = new LinkedHashSet<>();
        for (String part : availableBranches.split("[,，]")) {
            String code = part.trim().toUpperCase();
            if (!code.isEmpty()) {
                out.add(code);
            }
        }
        return out;
    }

    private static boolean isStudioBranch(String branch) {
        return "SAHA".equals(branch) || "YEONSAN".equals(branch);
    }

    private static String combined(Coach coach) {
        String specialties = coach.getSpecialties() != null ? coach.getSpecialties() : "";
        String name = coach.getName() != null ? coach.getName() : "";
        return specialties + " " + name;
    }
}
