package com.afbscenter.util;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Facility;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 대시보드 「월 총 예약」을 사하/연산 구역별로
 * 엘리트·유소년·사회인·대관·비회원으로 나눌 때 사용.
 */
public final class DashboardBookingBreakdown {

    private DashboardBookingBreakdown() {
    }

    public static Map<String, Long> emptyCounts() {
        Map<String, Long> row = new LinkedHashMap<>();
        row.put("total", 0L);
        row.put("elite", 0L);
        row.put("youth", 0L);
        row.put("social", 0L);
        row.put("rental", 0L);
        row.put("nonMember", 0L);
        return row;
    }

    public static Map<String, Map<String, Long>> emptyByStudio() {
        Map<String, Map<String, Long>> map = new LinkedHashMap<>();
        map.put("SAHA", emptyCounts());
        map.put("YEONSAN", emptyCounts());
        return map;
    }

    /** 오늘 예약: 사하/연산 × 야구·유소년·사회인·필라테스·트레이닝 */
    public static Map<String, Long> emptyPartCounts() {
        Map<String, Long> row = new LinkedHashMap<>();
        row.put("total", 0L);
        row.put("baseball", 0L);
        row.put("youth", 0L);
        row.put("social", 0L);
        row.put("pilates", 0L);
        row.put("training", 0L);
        row.put("rental", 0L);
        return row;
    }

    public static Map<String, Map<String, Long>> emptyPartsByStudio() {
        Map<String, Map<String, Long>> map = new LinkedHashMap<>();
        map.put("SAHA", emptyPartCounts());
        map.put("YEONSAN", emptyPartCounts());
        return map;
    }

    public static void add(Map<String, Map<String, Long>> byStudio, Booking booking) {
        if (byStudio == null || booking == null) {
            return;
        }
        String studio = studioOf(booking);
        Map<String, Long> row = byStudio.computeIfAbsent(studio, key -> emptyCounts());
        row.merge("total", 1L, Long::sum);
        row.merge(categoryOf(booking), 1L, Long::sum);
    }

    public static void addPart(Map<String, Map<String, Long>> byStudio, Booking booking) {
        if (byStudio == null || booking == null) {
            return;
        }
        String studio = studioOf(booking);
        Map<String, Long> row = byStudio.computeIfAbsent(studio, key -> emptyPartCounts());
        row.merge("total", 1L, Long::sum);
        row.merge(partOf(booking), 1L, Long::sum);
    }

    static String studioOf(Booking booking) {
        Facility facility = booking.getFacility();
        if (facility != null && facility.getBranch() != null) {
            if (facility.getBranch() == Facility.Branch.SAHA) {
                return "SAHA";
            }
            if (facility.getBranch() == Facility.Branch.YEONSAN) {
                return "YEONSAN";
            }
        }
        if (booking.getBranch() == Booking.Branch.SAHA) {
            return "SAHA";
        }
        if (booking.getBranch() == Booking.Branch.YEONSAN) {
            return "YEONSAN";
        }
        String name = facility != null && facility.getName() != null ? facility.getName() : "";
        if (name.contains("연산")) {
            return "YEONSAN";
        }
        return "SAHA";
    }

    static String categoryOf(Booking booking) {
        if (isRentalNotBpa(booking)) {
            return "rental";
        }
        if (BookingCalendarMemberGrade.isYouthBooking(booking)
                || BookingCalendarMemberGrade.isBpaYouthFacility(booking)) {
            return "youth";
        }
        if (BookingCalendarMemberGrade.isBpaSocialFacility(booking)) {
            return "social";
        }
        Member member = booking.getMember();
        if (member == null) {
            return "nonMember";
        }
        Member.MemberGrade grade = member.getGrade();
        if (grade == Member.MemberGrade.YOUTH) {
            return "youth";
        }
        if (grade == Member.MemberGrade.SOCIAL) {
            return "social";
        }
        return "elite";
    }

    static String partOf(Booking booking) {
        if (isRentalNotBpa(booking)) {
            return "rental";
        }
        LessonCategory lc = booking.getLessonCategory();
        if (lc == null) {
            lc = Booking.lessonCategoryForPurpose(booking.getPurpose());
        }
        if (lc == LessonCategory.PILATES) {
            return "pilates";
        }
        if (lc == LessonCategory.TRAINING) {
            return "training";
        }
        String category = categoryOf(booking);
        if ("youth".equals(category) || "social".equals(category)) {
            return category;
        }
        return "baseball";
    }

    private static boolean isRentalNotBpa(Booking booking) {
        if (BookingCalendarMemberGrade.isBpaSocialFacility(booking)
                || BookingCalendarMemberGrade.isBpaYouthFacility(booking)) {
            return false;
        }
        if (booking.getPurpose() == Booking.BookingPurpose.RENTAL) {
            return true;
        }
        return booking.getBranch() == Booking.Branch.RENTAL;
    }
}
