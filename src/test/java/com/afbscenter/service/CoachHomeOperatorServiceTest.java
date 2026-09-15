package com.afbscenter.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CoachHomeOperatorServiceTest {

    private final CoachHomeOperatorService service = new CoachHomeOperatorService("xorhko12");

    @Test
    void xorhko12_isOperatorIgnoreCase() {
        assertTrue(service.isOperatorUsername("xorhko12"));
        assertTrue(service.isOperatorUsername("XORHKO12"));
        assertTrue(service.canUseAdminCoachHome("xorhko12", "FRONT"));
    }

    @Test
    void adminRole_canUseEvenIfNotListed() {
        assertTrue(service.canUseAdminCoachHome("someone", "ADMIN"));
        assertTrue(service.canUseAdminCoachHome("someone", "MANAGER"));
    }

    @Test
    void otherFront_isNotOperator() {
        assertFalse(service.isOperatorUsername("afsh"));
        assertFalse(service.canUseAdminCoachHome("afsh", "FRONT"));
    }

    @Test
    void onlyAdmin_canUseStaffWorkRoster() {
        assertTrue(service.canUseStaffWorkRoster("someone", "ADMIN"));
        assertFalse(service.canUseStaffWorkRoster("someone", "MANAGER"));
        assertFalse(service.canUseStaffWorkRoster("afsh", "FRONT"));
        assertFalse(service.canUseStaffWorkRoster("xorhko12", "FRONT"));
        assertFalse(service.canUseStaffWorkRoster("coach1", "COACH"));
    }
}
