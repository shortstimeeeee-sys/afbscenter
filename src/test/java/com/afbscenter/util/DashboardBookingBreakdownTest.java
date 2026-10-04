package com.afbscenter.util;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Facility;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DashboardBookingBreakdownTest {

    @Test
    void sahaEliteMember_countsAsElite() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                eliteMember(), Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL);
        assertEquals("SAHA", DashboardBookingBreakdown.studioOf(booking));
        assertEquals("elite", DashboardBookingBreakdown.categoryOf(booking));
    }

    @Test
    void yeonsanYouthLesson_countsAsYouth() {
        Booking booking = booking(Facility.Branch.YEONSAN, "연산점", Booking.Branch.YEONSAN,
                socialMember(), Booking.BookingPurpose.LESSON, LessonCategory.YOUTH_BASEBALL);
        assertEquals("YEONSAN", DashboardBookingBreakdown.studioOf(booking));
        assertEquals("youth", DashboardBookingBreakdown.categoryOf(booking));
    }

    @Test
    void socialMember_countsAsSocial() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                socialMember(), Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL);
        assertEquals("social", DashboardBookingBreakdown.categoryOf(booking));
    }

    @Test
    void rentalPurpose_countsAsRentalEvenIfNonMember() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.RENTAL,
                null, Booking.BookingPurpose.RENTAL, null);
        assertEquals("SAHA", DashboardBookingBreakdown.studioOf(booking));
        assertEquals("rental", DashboardBookingBreakdown.categoryOf(booking));
    }

    @Test
    void nonMemberBaseball_countsAsNonMember() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                null, Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL);
        assertEquals("nonMember", DashboardBookingBreakdown.categoryOf(booking));
    }

    @Test
    void bpaSocialFacility_countsAsSocial() {
        Booking booking = booking(Facility.Branch.RENTAL, "BPA 야구장(사회인)", Booking.Branch.RENTAL,
                null, Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL);
        assertEquals("social", DashboardBookingBreakdown.categoryOf(booking));
        assertEquals("SAHA", DashboardBookingBreakdown.studioOf(booking));
    }

    @Test
    void youthBaseball_countsAsYouthPartNotBaseball() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                youthMember(), Booking.BookingPurpose.YOUTH_LESSON, LessonCategory.YOUTH_BASEBALL);
        assertEquals("youth", DashboardBookingBreakdown.partOf(booking));
    }

    @Test
    void socialBaseball_countsAsSocialPartNotBaseball() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                socialMember(), Booking.BookingPurpose.SOCIAL_LESSON, LessonCategory.BASEBALL);
        assertEquals("social", DashboardBookingBreakdown.partOf(booking));
    }

    @Test
    void socialPilates_staysPilatesPart() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                socialMember(), Booking.BookingPurpose.PILATES_LESSON, LessonCategory.PILATES);
        assertEquals("pilates", DashboardBookingBreakdown.partOf(booking));
    }

    @Test
    void pilatesLesson_countsAsPilatesPart() {
        Booking booking = booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                eliteMember(), Booking.BookingPurpose.PILATES_LESSON, LessonCategory.PILATES);
        assertEquals("pilates", DashboardBookingBreakdown.partOf(booking));
    }

    @Test
    void trainingLesson_countsAsTrainingPart() {
        Booking booking = booking(Facility.Branch.YEONSAN, "연산점", Booking.Branch.YEONSAN,
                eliteMember(), Booking.BookingPurpose.TRAINING_LESSON, LessonCategory.TRAINING);
        assertEquals("YEONSAN", DashboardBookingBreakdown.studioOf(booking));
        assertEquals("training", DashboardBookingBreakdown.partOf(booking));
    }

    @Test
    void addPart_incrementsStudioPartBuckets() {
        Map<String, Map<String, Long>> byStudio = DashboardBookingBreakdown.emptyPartsByStudio();
        DashboardBookingBreakdown.addPart(byStudio, booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                eliteMember(), Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL));
        DashboardBookingBreakdown.addPart(byStudio, booking(Facility.Branch.YEONSAN, "연산점", Booking.Branch.YEONSAN,
                eliteMember(), Booking.BookingPurpose.PILATES_LESSON, LessonCategory.PILATES));
        assertEquals(1L, byStudio.get("SAHA").get("baseball"));
        assertEquals(1L, byStudio.get("YEONSAN").get("pilates"));
        assertEquals(1L, byStudio.get("YEONSAN").get("total"));
    }

    @Test
    void add_incrementsStudioBuckets() {
        Map<String, Map<String, Long>> byStudio = DashboardBookingBreakdown.emptyByStudio();
        DashboardBookingBreakdown.add(byStudio, booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                eliteMember(), Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL));
        DashboardBookingBreakdown.add(byStudio, booking(Facility.Branch.SAHA, "사하점", Booking.Branch.SAHA,
                null, Booking.BookingPurpose.LESSON, LessonCategory.BASEBALL));
        assertEquals(2L, byStudio.get("SAHA").get("total"));
        assertEquals(1L, byStudio.get("SAHA").get("elite"));
        assertEquals(1L, byStudio.get("SAHA").get("nonMember"));
    }

    private static Member eliteMember() {
        Member member = new Member();
        member.setGrade(Member.MemberGrade.ELITE_HIGH);
        return member;
    }

    private static Member youthMember() {
        Member member = new Member();
        member.setGrade(Member.MemberGrade.YOUTH);
        return member;
    }

    private static Member socialMember() {
        Member member = new Member();
        member.setGrade(Member.MemberGrade.SOCIAL);
        return member;
    }

    private static Booking booking(Facility.Branch facilityBranch, String facilityName,
                                   Booking.Branch bookingBranch, Member member,
                                   Booking.BookingPurpose purpose, LessonCategory lessonCategory) {
        Facility facility = new Facility();
        facility.setBranch(facilityBranch);
        facility.setName(facilityName);
        Booking booking = new Booking();
        booking.setFacility(facility);
        booking.setBranch(bookingBranch);
        booking.setMember(member);
        booking.setPurpose(purpose);
        booking.setLessonCategory(lessonCategory);
        return booking;
    }
}
