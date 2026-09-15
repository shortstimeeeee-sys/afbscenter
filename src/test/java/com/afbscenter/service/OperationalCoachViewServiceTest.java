package com.afbscenter.service;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Facility;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OperationalCoachViewServiceTest {

    @Test
    void unassignedNonMemberPilates_isCandidate() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        assertTrue(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
    }

    @Test
    void memberPilates_isNotCandidate() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        Member member = new Member();
        member.setId(1L);
        b.setMember(member);
        assertFalse(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
    }

    @Test
    void assignedPilatesNonMember_isNotCandidate() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        Coach coach = new Coach();
        coach.setId(9L);
        b.setCoach(coach);
        assertFalse(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
    }

    @Test
    void unassignedNonMemberTraining_isNotCandidate() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.TRAINING);
        assertFalse(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
    }

    @Test
    void unassignedPilatesOnBaseballFacility_isNotCandidate() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        Facility facility = new Facility();
        facility.setFacilityType(Facility.FacilityType.BASEBALL);
        b.setFacility(facility);
        assertFalse(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
        assertFalse(OperationalCoachViewService.isNonMemberOnTrainingFitnessCalendar(b));
    }

    @Test
    void assignedNonMemberPilatesOnTrainingFacility_canBeEdited() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        Facility facility = new Facility();
        facility.setFacilityType(Facility.FacilityType.TRAINING_FITNESS);
        b.setFacility(facility);
        Coach coach = new Coach();
        coach.setId(9L);
        b.setCoach(coach);
        assertFalse(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
        assertTrue(OperationalCoachViewService.isNonMemberOnTrainingFitnessCalendar(b));
    }

    @Test
    void allFacilityPilatesNonMember_canBeEdited() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        Facility facility = new Facility();
        facility.setFacilityType(Facility.FacilityType.ALL);
        b.setFacility(facility);
        assertTrue(OperationalCoachViewService.isUnassignedNonMemberPilatesBooking(b));
        assertTrue(OperationalCoachViewService.isNonMemberOnTrainingFitnessCalendar(b));
    }

    @Test
    void pilatesViewerSeesUnassignedNonMemberPilates() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        OperationalCoachViewService svc = serviceWithoutRepos();
        assertTrue(svc.coachSeesBookingOnCalendar(b, List.of(1L), true));
        assertFalse(svc.coachSeesBookingOnCalendar(b, List.of(1L), false));
    }

    @Test
    void assignedCoachStillMatchesWithoutPilatesViewerFlag() {
        Booking b = new Booking();
        b.setLessonCategory(LessonCategory.PILATES);
        Coach coach = new Coach();
        coach.setId(3L);
        b.setCoach(coach);
        OperationalCoachViewService svc = serviceWithoutRepos();
        assertTrue(svc.coachSeesBookingOnCalendar(b, List.of(3L), false));
        assertFalse(svc.coachSeesBookingOnCalendar(b, List.of(99L), true));
    }

    @Test
    void afshUsername_isRecognizedIgnoreCase() {
        assertTrue(OperationalCoachViewService.isAfshUsername("afsh"));
        assertTrue(OperationalCoachViewService.isAfshUsername("AFSH"));
        assertFalse(OperationalCoachViewService.isAfshUsername("admin"));
        assertFalse(OperationalCoachViewService.isAfshUsername(null));
    }

    private static OperationalCoachViewService serviceWithoutRepos() {
        return new OperationalCoachViewService(null, null, null, null, "", "", "");
    }
}
