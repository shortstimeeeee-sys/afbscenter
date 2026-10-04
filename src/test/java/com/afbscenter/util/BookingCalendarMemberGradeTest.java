package com.afbscenter.util;

import com.afbscenter.model.Booking;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
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
    void socialBooking_showsOnBookedBranchAndSocialCalendar() {
        Booking social = bookingWithGrade(Member.MemberGrade.SOCIAL);
        assertTrue(BookingCalendarMemberGrade.include(social, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(social, "SOCIAL", "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(social, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(social, "SOCIAL", "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestAt("BPA 야구장(사회인)"), null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestAt("BPA 야구장(사회인)"), "SOCIAL", "SAHA", "BASEBALL", null));
    }

    @Test
    void bpaSocialOutdoor_sharesSahaBaseballCalendar() {
        Booking bpaSocial = guestAt("BPA 야구장(사회인)");
        bpaSocial.setBranch(Booking.Branch.YEONSAN);
        assertTrue(BookingCalendarMemberGrade.matchesRequestedBranch(bpaSocial, Booking.Branch.SAHA, "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(bpaSocial, null, "SAHA", "BASEBALL", null));
        Booking bpaYouth = guestAt("BPA 야구장(유소년)");
        bpaYouth.setBranch(Booking.Branch.YEONSAN);
        assertFalse(BookingCalendarMemberGrade.matchesRequestedBranch(bpaYouth, Booking.Branch.SAHA, "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(bpaYouth, null, "SAHA", "BASEBALL", null));
    }

    @Test
    void guestSocialBooking_showsOnBookedBranchAndSocialCalendar() {
        Booking guestSocial = guest();
        BookingCalendarMemberGrade.applyCalendarGrade(guestSocial, "SOCIAL", null);
        assertTrue(BookingCalendarMemberGrade.include(guestSocial, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocial, "SOCIAL", "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocial, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocial, "SOCIAL", "YEONSAN", "BASEBALL", null));
        Booking unmarkedGuest = guest();
        assertTrue(BookingCalendarMemberGrade.include(unmarkedGuest, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(unmarkedGuest, "SOCIAL", "SAHA", "BASEBALL", null));
    }

    @Test
    void socialLessonPurpose_showsOnBookedBranchAndSocialCalendar() {
        Booking guestSocialLesson = guest();
        guestSocialLesson.setPurpose(Booking.BookingPurpose.SOCIAL_LESSON);
        BookingCalendarMemberGrade.applyCalendarGrade(guestSocialLesson, null, null);
        assertTrue(BookingCalendarMemberGrade.include(guestSocialLesson, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocialLesson, "SOCIAL", "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocialLesson, "SOCIAL", "YEONSAN", "BASEBALL", null));
    }

    @Test
    void socialOutdoorLessonPurpose_showsOnBookedBranchAndSocialCalendar() {
        Booking guestSocialOutdoor = guest();
        guestSocialOutdoor.setPurpose(Booking.BookingPurpose.SOCIAL_OUTDOOR_LESSON);
        guestSocialOutdoor.setLessonCategory(LessonCategory.BASEBALL);
        BookingCalendarMemberGrade.applyCalendarGrade(guestSocialOutdoor, null, null);
        assertTrue(BookingCalendarMemberGrade.include(guestSocialOutdoor, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocialOutdoor, "SOCIAL", "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestSocialOutdoor, "SOCIAL", "YEONSAN", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(guestSocialOutdoor, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
    }

    @Test
    void youthLessonPurpose_showsOnBookedBranchAndYouthCalendar() {
        Booking guestYouth = guest();
        guestYouth.setPurpose(Booking.BookingPurpose.YOUTH_LESSON);
        BookingCalendarMemberGrade.applyCalendarGrade(guestYouth, null, null);
        assertTrue(BookingCalendarMemberGrade.include(guestYouth, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(guestYouth, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertFalse(BookingCalendarMemberGrade.include(guestYouth, "SOCIAL", "SAHA", "BASEBALL", null));
    }

    @Test
    void baseballLessonPurpose_staysOnBranchBaseball_notSocialOrYouth() {
        Booking guestBaseball = guest();
        guestBaseball.setPurpose(Booking.BookingPurpose.BASEBALL_LESSON);
        guestBaseball.setLessonCategory(LessonCategory.BASEBALL);
        assertTrue(BookingCalendarMemberGrade.include(guestBaseball, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(guestBaseball, "SOCIAL", "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(guestBaseball, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
    }

    @Test
    void outdoorLessonPurpose_staysOnBranchBaseball_notSocialOrYouth() {
        Booking guestOutdoor = guest();
        guestOutdoor.setPurpose(Booking.BookingPurpose.OUTDOOR_LESSON);
        guestOutdoor.setLessonCategory(LessonCategory.BASEBALL);
        assertTrue(BookingCalendarMemberGrade.include(guestOutdoor, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(guestOutdoor, "SOCIAL", "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(guestOutdoor, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
    }

    @Test
    void sahaBaseballMenu_showsYouthMembersSharedWithYouthCalendar() {
        Booking youth = bookingWithGrade(Member.MemberGrade.YOUTH);
        Booking elite = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        Booking youthLesson = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        youthLesson.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        assertTrue(BookingCalendarMemberGrade.include(youth, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(youth, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.include(youthLesson, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(youthLesson, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.include(elite, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(elite, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.include(guest(), null, "SAHA", "BASEBALL", null));
    }

    @Test
    void yeonsanBaseballMenu_showsYouth_keepsSocialOnSocialCalendar() {
        Booking social = bookingWithGrade(Member.MemberGrade.SOCIAL);
        Booking youth = bookingWithGrade(Member.MemberGrade.YOUTH);
        Booking elite = bookingWithGrade(Member.MemberGrade.ELITE_HIGH);
        assertTrue(BookingCalendarMemberGrade.include(social, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(youth, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(youth, null, "YEONSAN", "BASEBALL", "YOUTH_BASEBALL"));
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
        Booking allBaseball = guest();
        allBaseball.setLessonCategory(LessonCategory.BASEBALL);
        Booking allYouthOld = guest();
        allYouthOld.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        Booking allYouthTyped = guest();
        allYouthTyped.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        allYouthTyped.setPurpose(Booking.BookingPurpose.YOUTH_LESSON);
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(allBaseball, null, null));
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(allYouthOld, null, null));
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(allYouthOld, null, "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(allYouthTyped, null, null));
    }

    @Test
    void baseballGroupPurpose_showsYouthOnRegularBaseball_andKeepsEliteOffSocialYouth() {
        Booking youthPickedYouth = bookingWithGrade(Member.MemberGrade.YOUTH);
        youthPickedYouth.setPurpose(Booking.BookingPurpose.YOUTH_LESSON);
        youthPickedYouth.setLessonCategory(LessonCategory.BASEBALL);
        BookingCalendarMemberGrade.applyCalendarGrade(youthPickedYouth, null, youthPickedYouth.getMember());
        assertTrue(BookingCalendarMemberGrade.include(youthPickedYouth, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(youthPickedYouth, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));

        Booking socialPickedElite = bookingWithGrade(Member.MemberGrade.SOCIAL);
        socialPickedElite.setPurpose(Booking.BookingPurpose.BASEBALL_LESSON);
        socialPickedElite.setLessonCategory(LessonCategory.BASEBALL);
        BookingCalendarMemberGrade.applyCalendarGrade(socialPickedElite, null, socialPickedElite.getMember());
        assertTrue(BookingCalendarMemberGrade.include(socialPickedElite, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(socialPickedElite, "SOCIAL", "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(socialPickedElite, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
    }

    @Test
    void typedPurpose_sharesSameBranchCalendars_sahaAndYeonsan() {
        Booking elite = guest();
        elite.setPurpose(Booking.BookingPurpose.BASEBALL_LESSON);
        elite.setLessonCategory(LessonCategory.BASEBALL);
        BookingCalendarMemberGrade.applyCalendarGrade(elite, null, null);
        Booking youth = guest();
        youth.setPurpose(Booking.BookingPurpose.YOUTH_LESSON);
        youth.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        BookingCalendarMemberGrade.applyCalendarGrade(youth, null, null);
        Booking social = guest();
        social.setPurpose(Booking.BookingPurpose.SOCIAL_LESSON);
        social.setLessonCategory(LessonCategory.BASEBALL);
        BookingCalendarMemberGrade.applyCalendarGrade(social, null, null);

        for (String branch : new String[] {"SAHA", "YEONSAN"}) {
            assertTrue(BookingCalendarMemberGrade.include(elite, null, branch, "BASEBALL", null));
            assertFalse(BookingCalendarMemberGrade.include(elite, null, branch, "BASEBALL", "YOUTH_BASEBALL"));
            assertFalse(BookingCalendarMemberGrade.include(elite, "SOCIAL", branch, "BASEBALL", null));

            assertTrue(BookingCalendarMemberGrade.include(youth, null, branch, "BASEBALL", null));
            assertTrue(BookingCalendarMemberGrade.include(youth, null, branch, "BASEBALL", "YOUTH_BASEBALL"));
            assertFalse(BookingCalendarMemberGrade.include(youth, "SOCIAL", branch, "BASEBALL", null));

            assertTrue(BookingCalendarMemberGrade.include(social, null, branch, "BASEBALL", null));
            assertTrue(BookingCalendarMemberGrade.include(social, "SOCIAL", branch, "BASEBALL", null));
            assertFalse(BookingCalendarMemberGrade.include(social, null, branch, "BASEBALL", "YOUTH_BASEBALL"));
        }
    }

    @Test
    void personalTraining_showsOnRegularBaseball_notSocialOrYouth() {
        Booking pt = bookingWithGrade(Member.MemberGrade.ELITE_ELEMENTARY);
        pt.setPurpose(Booking.BookingPurpose.PERSONAL_TRAINING);
        pt.setLessonCategory(null);
        pt.setCalendarGrade(Member.MemberGrade.SOCIAL);
        BookingCalendarMemberGrade.applyCalendarGrade(pt, "SOCIAL", pt.getMember());
        assertNull(pt.getCalendarGrade());
        assertTrue(BookingCalendarMemberGrade.include(pt, null, "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(pt, "SOCIAL", "SAHA", "BASEBALL", null));
        assertFalse(BookingCalendarMemberGrade.include(pt, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(pt, null, null));
        assertFalse(BookingCalendarMemberGrade.includeAllFacilityOnBaseballCalendar(pt, null, "YOUTH_BASEBALL"));
    }

    @Test
    void oldLessonYouthCategory_sharesRegularBaseballAndYouthCalendar() {
        Booking oldYouthLesson = bookingWithGrade(Member.MemberGrade.YOUTH);
        oldYouthLesson.setPurpose(Booking.BookingPurpose.LESSON);
        oldYouthLesson.setLessonCategory(LessonCategory.YOUTH_BASEBALL);
        assertTrue(BookingCalendarMemberGrade.include(oldYouthLesson, null, "SAHA", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(oldYouthLesson, null, "SAHA", "BASEBALL", "YOUTH_BASEBALL"));
        assertTrue(BookingCalendarMemberGrade.include(oldYouthLesson, null, "YEONSAN", "BASEBALL", null));
        assertTrue(BookingCalendarMemberGrade.include(oldYouthLesson, null, "YEONSAN", "BASEBALL", "YOUTH_BASEBALL"));
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
