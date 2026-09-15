package com.afbscenter.util;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class BranchStudioTest {

    @Test
    void parsesSahaAndYeonsanOnly() {
        assertEquals(Facility.Branch.SAHA, BranchStudio.parse("saha"));
        assertEquals(Facility.Branch.YEONSAN, BranchStudio.parse(" YEONSAN "));
        assertNull(BranchStudio.parse("RENTAL"));
        assertNull(BranchStudio.parse(""));
        assertNull(BranchStudio.parse(null));
    }

    @Test
    void parsesThreeClosureGroups() {
        assertEquals(BranchClosure.ClosureGroup.SAHA, BranchStudio.parseGroup("saha"));
        assertEquals(BranchClosure.ClosureGroup.SAHA, BranchStudio.parseGroup("SAHA_PILATES"));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN, BranchStudio.parseGroup("YEONSAN"));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN, BranchStudio.parseGroup("YEONSAN_TRAINING"));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL, BranchStudio.parseGroup("NON_BASEBALL"));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL, BranchStudio.parseGroup("YOUTH_BASEBALL"));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL, BranchStudio.parseGroup("social"));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL, BranchStudio.parseGroup("RENTAL"));
        assertNull(BranchStudio.parseGroup("TRAINING"));
        assertNull(BranchStudio.parseGroup(null));
    }

    @Test
    void mapsCalendarsToSidebarGroups() {
        assertEquals(BranchClosure.ClosureGroup.SAHA,
                BranchStudio.fromCalendarConfig("SAHA", "BASEBALL", null, null));
        assertEquals(BranchClosure.ClosureGroup.SAHA,
                BranchStudio.fromCalendarConfig("SAHA", "TRAINING_FITNESS", "TRAINING", null));
        assertEquals(BranchClosure.ClosureGroup.SAHA,
                BranchStudio.fromCalendarConfig("SAHA", "TRAINING_FITNESS", "PILATES", null));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN,
                BranchStudio.fromCalendarConfig("YEONSAN", "BASEBALL", null, null));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN,
                BranchStudio.fromCalendarConfig("YEONSAN", "TRAINING_FITNESS", "PILATES", null));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromCalendarConfig("YEONSAN", "BASEBALL", "YOUTH_BASEBALL", null));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromCalendarConfig("SAHA", "BASEBALL", null, "SOCIAL"));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromCalendarConfig("RENTAL", "RENTAL", null, null));
    }

    @Test
    void nonBaseballStoresOnRentalBaseball() {
        assertEquals(Facility.Branch.RENTAL, BranchStudio.storageBranch(BranchClosure.ClosureGroup.NON_BASEBALL));
        assertEquals(BranchClosure.CalendarPart.BASEBALL,
                BranchStudio.storagePart(BranchClosure.ClosureGroup.NON_BASEBALL));
        assertEquals(Facility.Branch.YEONSAN, BranchStudio.storageBranch(BranchClosure.ClosureGroup.YEONSAN));
        assertEquals(BranchClosure.CalendarPart.BASEBALL,
                BranchStudio.storagePart(BranchClosure.ClosureGroup.SAHA));
        assertEquals(BranchClosure.ClosureGroup.SAHA,
                BranchStudio.fromStored(Facility.Branch.SAHA, BranchClosure.CalendarPart.TRAINING));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromStored(Facility.Branch.SAHA, BranchClosure.CalendarPart.NON_BASEBALL));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromStored(Facility.Branch.RENTAL, BranchClosure.CalendarPart.BASEBALL));
    }
}
