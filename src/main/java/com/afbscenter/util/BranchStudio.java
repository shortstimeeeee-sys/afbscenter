package com.afbscenter.util;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;

import java.util.Locale;

/**
 * 휴무 그룹은 사이드바와 같다.
 * 사하: 야구·트레이닝·필라테스 / 연산: 야구·필라테스 / 비 야구파트: 유소년·사회인·대관.
 */
public final class BranchStudio {

    private BranchStudio() {
    }

    public static Facility.Branch parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String key = raw.trim().toUpperCase(Locale.ROOT);
        if ("SAHA".equals(key)) {
            return Facility.Branch.SAHA;
        }
        if ("YEONSAN".equals(key)) {
            return Facility.Branch.YEONSAN;
        }
        return null;
    }

    public static BranchClosure.ClosureGroup parseGroup(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String key = raw.trim().toUpperCase(Locale.ROOT);
        if ("SAHA".equals(key) || "SAHA_BASEBALL".equals(key)
                || "SAHA_TRAINING".equals(key) || "SAHA_PILATES".equals(key)) {
            return BranchClosure.ClosureGroup.SAHA;
        }
        if ("YEONSAN".equals(key) || "YEONSAN_BASEBALL".equals(key)
                || "YEONSAN_TRAINING".equals(key) || "YEONSAN_PILATES".equals(key)) {
            return BranchClosure.ClosureGroup.YEONSAN;
        }
        if ("NON_BASEBALL".equals(key) || "YOUTH".equals(key) || "YOUTH_BASEBALL".equals(key)
                || "SOCIAL".equals(key) || "RENTAL".equals(key)) {
            return BranchClosure.ClosureGroup.NON_BASEBALL;
        }
        return null;
    }

    public static BranchClosure.ClosureGroup fromCalendarConfig(
            String branch, String facilityType, String lessonCategory, String memberGrade) {
        String ft = upper(facilityType);
        String lc = upper(lessonCategory);
        String grade = upper(memberGrade);
        String b = upper(branch);
        if ("RENTAL".equals(ft) || "RENTAL".equals(b)
                || "YOUTH_BASEBALL".equals(lc) || "YOUTH".equals(lc)
                || "SOCIAL".equals(grade) || "SOCIAL".equals(lc)) {
            return BranchClosure.ClosureGroup.NON_BASEBALL;
        }
        if ("YEONSAN".equals(b)) {
            return BranchClosure.ClosureGroup.YEONSAN;
        }
        if ("SAHA".equals(b)) {
            return BranchClosure.ClosureGroup.SAHA;
        }
        return null;
    }

    public static Facility.Branch storageBranch(BranchClosure.ClosureGroup group) {
        if (group == BranchClosure.ClosureGroup.YEONSAN) {
            return Facility.Branch.YEONSAN;
        }
        if (group == BranchClosure.ClosureGroup.NON_BASEBALL) {
            return Facility.Branch.RENTAL;
        }
        return Facility.Branch.SAHA;
    }

    public static BranchClosure.CalendarPart storagePart(BranchClosure.ClosureGroup group) {
        return BranchClosure.CalendarPart.BASEBALL;
    }

    public static BranchClosure.ClosureGroup fromStored(Facility.Branch branch, BranchClosure.CalendarPart part) {
        if (branch == Facility.Branch.RENTAL
                || part == BranchClosure.CalendarPart.NON_BASEBALL) {
            return BranchClosure.ClosureGroup.NON_BASEBALL;
        }
        if (branch == Facility.Branch.YEONSAN) {
            return BranchClosure.ClosureGroup.YEONSAN;
        }
        return BranchClosure.ClosureGroup.SAHA;
    }

    private static String upper(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    }
}
