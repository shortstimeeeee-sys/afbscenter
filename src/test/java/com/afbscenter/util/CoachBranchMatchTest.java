package com.afbscenter.util;

import com.afbscenter.model.Coach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CoachBranchMatchTest {

    @Test
    void pilatesAtYeonsan_canBeAssignedAtSaha() {
        Coach coach = pilates("김강사 [강사]", "YEONSAN");
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "YEONSAN"));
    }

    @Test
    void pilatesAtSaha_canBeAssignedAtYeonsan() {
        Coach coach = pilates("이강사 [강사]", "SAHA");
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "YEONSAN"));
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
    }

    @Test
    void pilatesWithBothStudios_matchesEither() {
        Coach coach = pilates("박강사 [강사]", "SAHA,YEONSAN");
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "YEONSAN"));
    }

    @Test
    void pilatesRentalOnly_doesNotMatchStudio() {
        Coach coach = pilates("대관강사 [강사]", "RENTAL");
        assertFalse(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
        assertFalse(CoachBranchMatch.matchesRequestedBranch(coach, "YEONSAN"));
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "RENTAL"));
    }

    @Test
    void trainerStaysOnAssignedStudioOnly() {
        Coach coach = new Coach();
        coach.setName("최트레이너 [트레이너]");
        coach.setSpecialties("트레이닝");
        coach.setAvailableBranches("SAHA");
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
        assertFalse(CoachBranchMatch.matchesRequestedBranch(coach, "YEONSAN"));
        assertFalse(CoachBranchMatch.isPilatesInstructor(coach));
    }

    @Test
    void emptyBranches_excluded() {
        Coach coach = pilates("무배정 [강사]", null);
        assertFalse(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
    }

    @Test
    void instructorTitleWithoutPilatesSpecialty_isPilates() {
        Coach coach = new Coach();
        coach.setName("정강사 [강사]");
        coach.setSpecialties("강사");
        coach.setAvailableBranches("YEONSAN");
        assertTrue(CoachBranchMatch.isPilatesInstructor(coach));
        assertTrue(CoachBranchMatch.matchesRequestedBranch(coach, "SAHA"));
    }

    private static Coach pilates(String name, String branches) {
        Coach coach = new Coach();
        coach.setName(name);
        coach.setSpecialties("필라테스");
        coach.setAvailableBranches(branches);
        return coach;
    }
}
