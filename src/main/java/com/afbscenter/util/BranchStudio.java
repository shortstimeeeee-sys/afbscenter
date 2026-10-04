package com.afbscenter.util;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 휴무 대상은 사이드바와 같다.
 * 지점 전체(사하 / 연산 / 비 야구파트)와 그 아래 파트(야구·트레이닝·필라테스·유소년·사회인·대관)를 구분한다.
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
        if ("SAHA".equals(key) || "SAHA_ALL".equals(key)) {
            return BranchClosure.ClosureGroup.SAHA;
        }
        if ("SAHA_BASEBALL".equals(key)) {
            return BranchClosure.ClosureGroup.SAHA_BASEBALL;
        }
        if ("SAHA_TRAINING".equals(key)) {
            return BranchClosure.ClosureGroup.SAHA_TRAINING;
        }
        if ("SAHA_PILATES".equals(key)) {
            return BranchClosure.ClosureGroup.SAHA_PILATES;
        }
        if ("YEONSAN".equals(key) || "YEONSAN_ALL".equals(key)) {
            return BranchClosure.ClosureGroup.YEONSAN;
        }
        if ("YEONSAN_BASEBALL".equals(key)) {
            return BranchClosure.ClosureGroup.YEONSAN_BASEBALL;
        }
        if ("YEONSAN_PILATES".equals(key) || "YEONSAN_TRAINING".equals(key)) {
            return BranchClosure.ClosureGroup.YEONSAN_PILATES;
        }
        if ("NON_BASEBALL".equals(key) || "NON_BASEBALL_ALL".equals(key)) {
            return BranchClosure.ClosureGroup.NON_BASEBALL;
        }
        if ("YOUTH".equals(key) || "YOUTH_BASEBALL".equals(key)) {
            return BranchClosure.ClosureGroup.YOUTH;
        }
        if ("SOCIAL".equals(key)) {
            return BranchClosure.ClosureGroup.SOCIAL;
        }
        if ("RENTAL".equals(key)) {
            return BranchClosure.ClosureGroup.RENTAL;
        }
        return null;
    }

    public static BranchClosure.ClosureGroup fromCalendarConfig(
            String branch, String facilityType, String lessonCategory, String memberGrade) {
        String ft = upper(facilityType);
        String lc = upper(lessonCategory);
        String grade = upper(memberGrade);
        String b = upper(branch);
        if ("RENTAL".equals(ft) || "RENTAL".equals(b)) {
            return BranchClosure.ClosureGroup.RENTAL;
        }
        if ("YOUTH_BASEBALL".equals(lc) || "YOUTH".equals(lc) || "YOUTH".equals(grade)) {
            return BranchClosure.ClosureGroup.YOUTH;
        }
        if ("SOCIAL".equals(grade) || "SOCIAL".equals(lc)) {
            return BranchClosure.ClosureGroup.SOCIAL;
        }
        if ("YEONSAN".equals(b)) {
            if ("PILATES".equals(lc) || "TRAINING_FITNESS".equals(ft)) {
                return BranchClosure.ClosureGroup.YEONSAN_PILATES;
            }
            return BranchClosure.ClosureGroup.YEONSAN_BASEBALL;
        }
        if ("SAHA".equals(b)) {
            if ("TRAINING".equals(lc)) {
                return BranchClosure.ClosureGroup.SAHA_TRAINING;
            }
            if ("PILATES".equals(lc)) {
                return BranchClosure.ClosureGroup.SAHA_PILATES;
            }
            return BranchClosure.ClosureGroup.SAHA_BASEBALL;
        }
        return null;
    }

    public static boolean isWholeGroup(BranchClosure.ClosureGroup group) {
        return group == BranchClosure.ClosureGroup.SAHA
                || group == BranchClosure.ClosureGroup.YEONSAN
                || group == BranchClosure.ClosureGroup.NON_BASEBALL;
    }

    public static BranchClosure.ClosureGroup parentGroup(BranchClosure.ClosureGroup group) {
        if (group == null || isWholeGroup(group)) {
            return null;
        }
        if (group == BranchClosure.ClosureGroup.SAHA_BASEBALL
                || group == BranchClosure.ClosureGroup.SAHA_TRAINING
                || group == BranchClosure.ClosureGroup.SAHA_PILATES) {
            return BranchClosure.ClosureGroup.SAHA;
        }
        if (group == BranchClosure.ClosureGroup.YEONSAN_BASEBALL
                || group == BranchClosure.ClosureGroup.YEONSAN_PILATES) {
            return BranchClosure.ClosureGroup.YEONSAN;
        }
        return BranchClosure.ClosureGroup.NON_BASEBALL;
    }

    public static Facility.Branch storageBranch(BranchClosure.ClosureGroup group) {
        if (group == BranchClosure.ClosureGroup.YEONSAN
                || group == BranchClosure.ClosureGroup.YEONSAN_BASEBALL
                || group == BranchClosure.ClosureGroup.YEONSAN_PILATES) {
            return Facility.Branch.YEONSAN;
        }
        if (group == BranchClosure.ClosureGroup.NON_BASEBALL
                || group == BranchClosure.ClosureGroup.YOUTH
                || group == BranchClosure.ClosureGroup.SOCIAL
                || group == BranchClosure.ClosureGroup.RENTAL) {
            return Facility.Branch.RENTAL;
        }
        return Facility.Branch.SAHA;
    }

    public static BranchClosure.CalendarPart storagePart(BranchClosure.ClosureGroup group) {
        if (group == null || isWholeGroup(group)) {
            return BranchClosure.CalendarPart.ALL;
        }
        if (group == BranchClosure.ClosureGroup.SAHA_TRAINING) {
            return BranchClosure.CalendarPart.TRAINING;
        }
        if (group == BranchClosure.ClosureGroup.SAHA_PILATES
                || group == BranchClosure.ClosureGroup.YEONSAN_PILATES) {
            return BranchClosure.CalendarPart.PILATES;
        }
        if (group == BranchClosure.ClosureGroup.YOUTH) {
            return BranchClosure.CalendarPart.YOUTH;
        }
        if (group == BranchClosure.ClosureGroup.SOCIAL) {
            return BranchClosure.CalendarPart.SOCIAL;
        }
        if (group == BranchClosure.ClosureGroup.RENTAL) {
            return BranchClosure.CalendarPart.RENTAL;
        }
        return BranchClosure.CalendarPart.BASEBALL;
    }

    /** 달력 표시: 선택한 파트 휴무 + 그 지점 전체 휴무. */
    public static List<BranchClosure.CalendarPart> displayParts(BranchClosure.ClosureGroup group) {
        List<BranchClosure.CalendarPart> parts = new ArrayList<>();
        parts.add(storagePart(group));
        if (!isWholeGroup(group)) {
            parts.add(0, BranchClosure.CalendarPart.ALL);
        }
        return parts;
    }

    public static BranchClosure.ClosureGroup fromStored(Facility.Branch branch, BranchClosure.CalendarPart part) {
        if (branch == Facility.Branch.RENTAL
                || part == BranchClosure.CalendarPart.NON_BASEBALL) {
            if (part == BranchClosure.CalendarPart.YOUTH) {
                return BranchClosure.ClosureGroup.YOUTH;
            }
            if (part == BranchClosure.CalendarPart.SOCIAL) {
                return BranchClosure.ClosureGroup.SOCIAL;
            }
            if (part == BranchClosure.CalendarPart.RENTAL) {
                return BranchClosure.ClosureGroup.RENTAL;
            }
            return BranchClosure.ClosureGroup.NON_BASEBALL;
        }
        if (branch == Facility.Branch.YEONSAN) {
            if (part == BranchClosure.CalendarPart.BASEBALL) {
                return BranchClosure.ClosureGroup.YEONSAN_BASEBALL;
            }
            if (part == BranchClosure.CalendarPart.PILATES || part == BranchClosure.CalendarPart.TRAINING) {
                return BranchClosure.ClosureGroup.YEONSAN_PILATES;
            }
            return BranchClosure.ClosureGroup.YEONSAN;
        }
        if (part == BranchClosure.CalendarPart.BASEBALL) {
            return BranchClosure.ClosureGroup.SAHA_BASEBALL;
        }
        if (part == BranchClosure.CalendarPart.TRAINING) {
            return BranchClosure.ClosureGroup.SAHA_TRAINING;
        }
        if (part == BranchClosure.CalendarPart.PILATES) {
            return BranchClosure.ClosureGroup.SAHA_PILATES;
        }
        return BranchClosure.ClosureGroup.SAHA;
    }

    private static String upper(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    }
}
