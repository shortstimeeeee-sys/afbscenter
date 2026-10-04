package com.afbscenter.util;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DashboardMemberJoinBreakdownTest {

    @Test
    void yeonsanOnlyCoach_countsAsYeonsan() {
        Map<String, Map<String, Long>> byStudio = DashboardMemberJoinBreakdown.emptyByStudio();
        DashboardMemberJoinBreakdown.add(byStudio, "YOUTH", "YEONSAN");
        assertEquals(1L, byStudio.get("YEONSAN").get("total"));
        assertEquals(1L, byStudio.get("YEONSAN").get("youth"));
        assertEquals(0L, byStudio.get("SAHA").get("total"));
    }

    @Test
    void sahaCoach_countsAsSahaElite() {
        Map<String, Map<String, Long>> byStudio = DashboardMemberJoinBreakdown.emptyByStudio();
        DashboardMemberJoinBreakdown.add(byStudio, "ELITE_HIGH", "SAHA");
        assertEquals(1L, byStudio.get("SAHA").get("elite"));
    }

    @Test
    void bothBranches_defaultToSaha() {
        assertEquals("SAHA", DashboardMemberJoinBreakdown.studioFromBranches("SAHA,YEONSAN"));
    }
}
