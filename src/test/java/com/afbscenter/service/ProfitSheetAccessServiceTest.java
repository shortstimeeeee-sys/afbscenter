package com.afbscenter.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProfitSheetAccessServiceTest {

    private final ProfitSheetAccessService service = new ProfitSheetAccessService("xorho12,xorhko12");

    @Test
    void listedUsernames_canSee() {
        assertTrue(service.canSee("xorho12", "FRONT"));
        assertTrue(service.canSee("XORHO12", "COACH"));
        assertTrue(service.canSee("xorhko12", "FRONT"));
    }

    @Test
    void admin_canSeeEvenIfNotListed() {
        assertTrue(service.canSee("someone", "ADMIN"));
    }

    @Test
    void manager_cannotSeeUnlessListed() {
        assertFalse(service.canSee("manager1", "MANAGER"));
        assertFalse(service.canSee("afsh", "FRONT"));
    }
}
