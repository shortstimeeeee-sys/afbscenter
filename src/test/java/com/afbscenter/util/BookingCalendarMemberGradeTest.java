package com.afbscenter.util;

import com.afbscenter.model.Booking;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BookingCalendarMemberGradeTest {

    @Test
    void socialMenu_showsSocialMembersAndBpaSocialFacility() {
        Booking social = bookingWithGrade(Member.MemberGrade.SOCIAL);
        Booking elite = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        Booking bpaSocialGuest = guestAt("BPA 야구장(사회인)");
        Booking bpaPlainGuest = guestAt("BPA 야구장");
        Booking bpaYouthGuest = guestAt("BPA 야구장(유소년)");
        assertTrue(BookingCalendarMemberGrade.include(social, "SOCIAL", "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(elite, "SOCIAL", "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(guest(), "SOCIAL", "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(bpaSocialGuest, "SOCIAL", "YEONSAN", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(bpaPlainGuest, "SOCIAL", "YEONSAN", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(bpaYouthGuest, "SOCIAL", "YEONSAN", "BASEBALL", null));
    }

    @Test
    void sahaBaseballMenu_hidesSocialAndYouthMembers() {
        Booking social = bookingWithGrade(Member.MemberGrade.SOCIAL);
        Booking youth = bookingWithGrade(Member.MemberGrade.YOUTH);
        Booking elite = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        Booking youthLesson = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        youthLesson.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        assertFalse(BookingCalendarMemberGrade.include(social, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(youth, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(youthLesson, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(elite, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guest(), null, "SAHA", "BASEBALL", null));
    }

    @Test
    void yeonsanBaseballMenu_hidesYouthAndSocial() {
        Booking social = bookingWithGrade(Member.MemberGrade.SOCIAL);
        Booking youth = bookingWithGrade(Member.MemberGrade.YOUTH);
        Booking elite = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        assertFalse(BookingCalendarMemberGrade.include(social, null, "YEONSAN", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(youth, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(elite, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(social, "SOCIAL", "YEONSAN", "BASEBALL", null));
    }

    @Test
    void youthMenu_pullsYouthGradeFromBaseballAndYouthLesson() {
        Booking youthOnBaseball = bookingWithGrade(Member.MemberGrade.YOUTH);
        youthOnBaseball.setLessonCategory(LessonCategory.BASEBALL);
        Booking youthLesson = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        youthLesson.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        Booking elite = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        elite.setLessonCategory(LessonCategory.BASEBALL);
        assertTrue(BookingCalendarMemberGrade.include(youthOnBaseball, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.include(youthLesson, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertFalse(BookingCalendarMemberGrade.include(elite, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.include(guestAt("BPA 야구장(유소년)"), null, "YEONSAN", "BASEBALL", "YOUTH_BASEBALL"));
        assertFalse(BookingCalendarMemberGrade.include(guestAt("BPA 야구장(사회인)"), null, "YEONSAN", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.skipStrictLessonCategoryFilter(null, "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(
                LessonCategory.BASEBALL, null, null));
        assertFalse(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(
                LessonCategory.YOUTH_BASEBALL, null, null));
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(
                LessonCategory.YOUTH_BASEBALL, null, "YOUTH_BASEBALL"));
    }

    private static Booking guest() {
        return new Booking();
    }

    private static Booking guestAt(String facilityName) {
        Booking booking = guest();
        com.afbscenter.model.Facility facility = new com.afbscenter.model.Facility();
        facility.setName(facilityName);
        booking.setFacility(facility);
        return booking;
    }

    private static Booking bookingWithGrade(Member.MemberGrade grade) {
        Member member = new Member();
        member.setGrade(grade);
        Booking booking = new Booking();
        booking.setMember(member);
        return booking;
    }
}
