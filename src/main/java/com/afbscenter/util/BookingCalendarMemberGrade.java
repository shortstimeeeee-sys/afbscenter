package com.afbscenter.util;

import com.afbscenter.model.Booking;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;

/**
 * 야구 캘린더를 회원 등급·레슨 종목으로 나눌 때 사용.
 * 비회원 목적(야구·트레이닝·필라테스·사회인·유소년)은 예약한 지점의 해당 캘린더에 두고,
 * 사회인은 사회인 캘린더에도, 유소년은 일반 야구 캘린더와 비야구 유소년 캘린더에 함께 둔다.
 * BPA 야구장(사회인) 야외 일정은 사회인 캘린더와 지점 야구 캘린더에 함께 둔다.
 * BPA 야구장(유소년)만 전용 캘린더에 두고 일반 야구에서는 뺀다.
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
            if (target == Member.MemberGrade.SOCIAL) {
                return isSocialCalendarBooking(booking);
            }
            return booking.getMember() != null && booking.getMember().getGrade() == target;
        }
        if (isRegularBaseballCalendar(facilityType, lessonCategory)) {
            if (isBpaYouthFacility(booking)) {
                return false;
            }
        }
        return true;
    }

    /** 유소년 캘린더는 종목만 보면 야구 캘린더에 남은 유소년 예약을 놓치므로, 엄격한 종목 필터를 건너뛴다. */
    public static boolean skipStrictLessonCategoryFilter(String memberGrade, String lessonCategory) {
        return isYouthCalendar(memberGrade, lessonCategory);
    }

    /** 지점 야구 캘린더: 해당 지점 예약 + BPA 야구장(사회인) 야외 일정. */
    public static boolean matchesRequestedBranch(Booking booking, Booking.Branch requestedBranch,
                                                 String facilityType, String lessonCategory) {
        if (requestedBranch == null) {
            return true;
        }
        if (booking != null && booking.getBranch() == requestedBranch) {
            return true;
        }
        return isRegularBaseballCalendar(facilityType, lessonCategory) && isBpaSocialFacility(booking);
    }

    /** ALL 시설의 야구 캘린더: 일반 야구 + 유소년 야구(비야구 유소년과 공유) + 개인훈련. */
    public static boolean includeAllFacilityOnBaseballCalendar(Booking booking,
                                                               String memberGrade, String lessonCategory) {
        if (booking == null) {
            return false;
        }
        if (booking.getPurpose() == Booking.BookingPurpose.PERSONAL_TRAINING) {
            if (isYouthCalendar(memberGrade, lessonCategory)) {
                return false;
            }
            LessonCategory lc = booking.getLessonCategory();
            return lc == null || lc == LessonCategory.BASEBALL || lc == LessonCategory.YOUTH_BASEBALL;
        }
        if (booking.getLessonCategory() == null) {
            return false;
        }
        return includeAllFacilityOnBaseballCalendar(booking.getLessonCategory(), memberGrade, lessonCategory,
                booking.getPurpose());
    }

    static boolean includeAllFacilityOnBaseballCalendar(LessonCategory bookingLesson,
                                                        String memberGrade, String lessonCategory,
                                                        Booking.BookingPurpose purpose) {
        if (bookingLesson == LessonCategory.BASEBALL || bookingLesson == LessonCategory.YOUTH_BASEBALL) {
            return true;
        }
        return false;
    }

    static boolean isYouthCalendar(String memberGrade, String lessonCategory) {
        return "YOUTH".equalsIgnoreCase(trim(memberGrade))
                || "YOUTH_BASEBALL".equalsIgnoreCase(trim(lessonCategory));
    }

    static boolean isYouthBooking(Booking booking) {
        if (Booking.isEliteTypedPurpose(booking.getPurpose())
                || Booking.isSocialTypedPurpose(booking.getPurpose())
                || booking.getPurpose() == Booking.BookingPurpose.PERSONAL_TRAINING) {
            return false;
        }
        if (booking.getPurpose() == Booking.BookingPurpose.YOUTH_LESSON) {
            return true;
        }
        if (booking.getCalendarGrade() == Member.MemberGrade.YOUTH) {
            return true;
        }
        if (booking.getLessonCategory() == LessonCategory.YOUTH_BASEBALL) {
            return true;
        }
        return booking.getMember() != null && booking.getMember().getGrade() == Member.MemberGrade.YOUTH;
    }

    static boolean isSocialCalendarBooking(Booking booking) {
        if (isBpaSocialFacility(booking)) {
            return true;
        }
        if (Booking.isEliteTypedPurpose(booking.getPurpose())
                || booking.getPurpose() == Booking.BookingPurpose.YOUTH_LESSON
                || booking.getPurpose() == Booking.BookingPurpose.PERSONAL_TRAINING) {
            return false;
        }
        if (booking.getCalendarGrade() == Member.MemberGrade.SOCIAL) {
            return true;
        }
        if (Booking.isSocialTypedPurpose(booking.getPurpose())) {
            return true;
        }
        return booking.getMember() != null && booking.getMember().getGrade() == Member.MemberGrade.SOCIAL;
    }

    /** 사회인 화면에서 잡은 예약(비회원 포함)과 사회인 회원 예약에 캘린더 표시를 남긴다. */
    public static void applyCalendarGrade(Booking booking, String memberGrade, Member member) {
        if (booking == null) {
            return;
        }
        if (Booking.isEliteTypedPurpose(booking.getPurpose())
                || booking.getPurpose() == Booking.BookingPurpose.PERSONAL_TRAINING) {
            booking.setCalendarGrade(null);
            return;
        }
        if (Booking.isSocialTypedPurpose(booking.getPurpose())) {
            booking.setCalendarGrade(Member.MemberGrade.SOCIAL);
            return;
        }
        if (booking.getPurpose() == Booking.BookingPurpose.YOUTH_LESSON) {
            booking.setCalendarGrade(Member.MemberGrade.YOUTH);
            return;
        }
        if ("SOCIAL".equalsIgnoreCase(trim(memberGrade))) {
            booking.setCalendarGrade(Member.MemberGrade.SOCIAL);
            return;
        }
        if ("YOUTH".equalsIgnoreCase(trim(memberGrade))) {
            booking.setCalendarGrade(Member.MemberGrade.YOUTH);
            return;
        }
        if (member != null && member.getGrade() == Member.MemberGrade.SOCIAL) {
            booking.setCalendarGrade(Member.MemberGrade.SOCIAL);
        }
        if (member != null && member.getGrade() == Member.MemberGrade.YOUTH) {
            booking.setCalendarGrade(Member.MemberGrade.YOUTH);
        }
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
