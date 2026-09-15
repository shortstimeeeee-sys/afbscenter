package com.afbscenter.controller;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AttendanceAutoCheckInTest {

    @Test
    void yesterdayClass_isReadyAfterMidnight() {
        LocalDateTime start = LocalDateTime.of(2026, 9, 8, 20, 0);
        LocalDateTime now = LocalDateTime.of(2026, 9, 9, 0, 1);
        assertTrue(AttendanceCheckController.bookingDayHasPassedMidnight(start, now));
    }

    @Test
    void sameDayClass_isNotAutoCheckedInYet() {
        LocalDateTime start = LocalDateTime.of(2026, 9, 8, 20, 0);
        LocalDateTime now = LocalDateTime.of(2026, 9, 8, 23, 59);
        assertFalse(AttendanceCheckController.bookingDayHasPassedMidnight(start, now));
    }

    @Test
    void nullStart_isNotReady() {
        assertFalse(AttendanceCheckController.bookingDayHasPassedMidnight(
                null, LocalDateTime.of(2026, 9, 9, 0, 1)));
    }

    @Test
    void midnightExactly_isReady() {
        LocalDateTime start = LocalDateTime.of(2026, 9, 8, 20, 0);
        LocalDateTime now = LocalDateTime.of(2026, 9, 9, 0, 0);
        assertTrue(AttendanceCheckController.bookingDayHasPassedMidnight(start, now));
    }

    @Test
    void autoCheckInMemo_isDetected() {
        assertTrue(AttendanceCheckController.isMidnightAutoCheckInMemo(
                AttendanceCheckController.AUTO_CHECKIN_HISTORY_NOTE));
        assertTrue(AttendanceCheckController.isMidnightAutoCheckInMemo(
                "기존 메모 / " + AttendanceCheckController.AUTO_CHECKIN_HISTORY_NOTE));
        assertFalse(AttendanceCheckController.isMidnightAutoCheckInMemo("수동 체크인"));
        assertFalse(AttendanceCheckController.isMidnightAutoCheckInMemo(null));
    }

    @Test
    void pastMidnightMutation_isAdminOnly() {
        LocalDateTime start = LocalDateTime.of(2026, 9, 8, 20, 0);
        LocalDateTime now = LocalDateTime.of(2026, 9, 9, 0, 1);
        assertFalse(AttendanceCheckController.isPastMidnightMutationLocked(
                start, now, "ADMIN"));
        assertTrue(AttendanceCheckController.isPastMidnightMutationLocked(
                start, now, "FRONT"));
        assertTrue(AttendanceCheckController.isPastMidnightMutationLocked(
                start, now, "MANAGER"));
        assertTrue(AttendanceCheckController.isPastMidnightMutationLocked(
                start, now, null));
        assertFalse(AttendanceCheckController.isPastMidnightMutationLocked(
                start, LocalDateTime.of(2026, 9, 8, 23, 0), "FRONT"));
    }
}
