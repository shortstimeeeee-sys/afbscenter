package com.afbscenter.util;

import com.afbscenter.model.Booking;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;

/**
 * 야구 캘린더를 회원 등급·레슨 종목으로 나눌 때 사용.
 * 사하점·연산점 「사회인」은 사회인 회원 예약과 BPA 야구장(사회인) 예약,
 * 「유소년」은 유소년 등급·유소년 야구 예약과 BPA 야구장(유소년) 예약을
 * 일반 야구 캘린더에서 발췌한다.
 */
public final class BookingCalendarMemberGrade {

    private BookingCalendarMemberGrade() {
    }

    public static boolean include(Booking booking, String memberGrade, String branch, String facilityType,
                                  String lessonCategory) {
        if (booking == null) {
            return false;
        }
        if (isYouthCalendar(memberGrade, lessonCategory)) {
            return isYouthBooking(booking) || isBpaYouthFacility(booking);
        }
        Member.MemberGrade target = parseGrade(memberGrade);
        if (target != null) {
            if (target == Member.MemberGrade.SOCIAL && isBpaSocialFacility(booking)) {
                return true;
            }
            return booking.getMember() != null && booking.getMember().getGrade() == target;
        }
        if (isRegularBaseballCalendar(facilityType, lessonCategory)) {
            if (isBpaSocialFacility(booking) || isBpaYouthFacility(booking)) {
                return false;
            }
            if (booking.getLessonCategory() == LessonCategory.YOUTH_BASEBALL) {
                return false;
            }
            Member.MemberGrade grade = booking.getMember() != null ? booking.getMember().getGrade() : null;
            if (grade == Member.MemberGrade.YOUTH) {
                return false;
            }
            if (grade == Member.MemberGrade.SOCIAL && hasSocialCalendar(branch)) {
                return false;
            }
        }
        return true;
    }

    /** 유소년 캘린더는 종목만 보면 야구 캘린더에 남은 유소년 예약을 놓치므로, 엄격한 종목 필터를 건너뛴다. */
    public static boolean skipStrictLessonCategoryFilter(String memberGrade, String lessonCategory) {
        return isYouthCalendar(memberGrade, lessonCategory);
    }

    /** ALL 시설의 야구 캘린더: 일반 야구 + (유소년 캘린더일 때 유소년 야구). */
    public static boolean includeAllFacilityOnBaseballCalendar(LessonCategory bookingLesson,
                                                               String memberGrade, String lessonCategory) {
        if (bookingLesson == LessonCategory.BASEBALL) {
            return true;
        }
        return bookingLesson == LessonCategory.YOUTH_BASEBALL
                && isYouthCalendar(memberGrade, lessonCategory);
    }

    static boolean isYouthCalendar(String memberGrade, String lessonCategory) {
        return "YOUTH".equalsIgnoreCase(trim(memberGrade))
                || "YOUTH_BASEBALL".equalsIgnoreCase(trim(lessonCategory));
    }

    static boolean isYouthBooking(Booking booking) {
        if (booking.getLessonCategory() == LessonCategory.YOUTH_BASEBALL) {
            return true;
        }
        return booking.getMember() != null && booking.getMember().getGrade() == Member.MemberGrade.YOUTH;
    }

    static boolean isBpaSocialFacility(Booking booking) {
        return facilityNameContains(booking, "BPA", "야구장", "사회인");
    }

    static boolean isBpaYouthFacility(Booking booking) {
        return facilityNameContains(booking, "BPA", "야구장", "유소년");
    }

    private static boolean facilityNameContains(Booking booking, String... tokens) {
        if (booking == null || booking.getFacility() == null || booking.getFacility().getName() == null) {
            return false;
        }
        String n = booking.getFacility().getName().replaceAll("\\s+", "");
        for (String token : tokens) {
            if (!n.contains(token)) {
                return false;
            }
        }
        return true;
    }

    static boolean isRegularBaseballCalendar(String facilityType, String lessonCategory) {
        return facilityType != null && "BASEBALL".equalsIgnoreCase(facilityType.trim())
                && (lessonCategory == null || lessonCategory.isBlank());
    }

    static boolean hasSocialCalendar(String branch) {
        if (branch == null || branch.isBlank()) {
            return false;
        }
        String key = branch.trim().toUpperCase();
        return "SAHA".equals(key) || "YEONSAN".equals(key);
    }

    static Member.MemberGrade parseGrade(String memberGrade) {
        if (memberGrade == null || memberGrade.isBlank()) {
            return null;
        }
        try {
            return Member.MemberGrade.valueOf(memberGrade.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String trim(String raw) {
        return raw == null ? null : raw.trim();
    }
}
