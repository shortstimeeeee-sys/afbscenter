package com.afbscenter.util;

import com.afbscenter.model.BranchClosure;
import com.afbscenter.model.Facility;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void parsesWholeGroupsAndParts() {
        assertEquals(BranchClosure.ClosureGroup.SAHA, BranchStudio.parseGroup("saha"));
        assertEquals(BranchClosure.ClosureGroup.SAHA_PILATES, BranchStudio.parseGroup("SAHA_PILATES"));
        assertEquals(BranchClosure.ClosureGroup.SAHA_TRAINING, BranchStudio.parseGroup("SAHA_TRAINING"));
        assertEquals(BranchClosure.ClosureGroup.SAHA_BASEBALL, BranchStudio.parseGroup("SAHA_BASEBALL"));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN, BranchStudio.parseGroup("YEONSAN"));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN_PILATES, BranchStudio.parseGroup("YEONSAN_TRAINING"));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN_BASEBALL, BranchStudio.parseGroup("YEONSAN_BASEBALL"));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL, BranchStudio.parseGroup("NON_BASEBALL"));
        assertEquals(BranchClosure.ClosureGroup.YOUTH, BranchStudio.parseGroup("YOUTH_BASEBALL"));
        assertEquals(BranchClosure.ClosureGroup.SOCIAL, BranchStudio.parseGroup("social"));
        assertEquals(BranchClosure.ClosureGroup.RENTAL, BranchStudio.parseGroup("RENTAL"));
        assertNull(BranchStudio.parseGroup("TRAINING"));
        assertNull(BranchStudio.parseGroup(null));
    }

    @Test
    void mapsCalendarsToParts() {
        assertEquals(BranchClosure.ClosureGroup.SAHA_BASEBALL,
                BranchStudio.fromCalendarConfig("SAHA", "BASEBALL", null, null));
        assertEquals(BranchClosure.ClosureGroup.SAHA_TRAINING,
                BranchStudio.fromCalendarConfig("SAHA", "TRAINING_FITNESS", "TRAINING", null));
        assertEquals(BranchClosure.ClosureGroup.SAHA_PILATES,
                BranchStudio.fromCalendarConfig("SAHA", "TRAINING_FITNESS", "PILATES", null));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN_BASEBALL,
                BranchStudio.fromCalendarConfig("YEONSAN", "BASEBALL", null, null));
        assertEquals(BranchClosure.ClosureGroup.YEONSAN_PILATES,
                BranchStudio.fromCalendarConfig("YEONSAN", "TRAINING_FITNESS", "PILATES", null));
        assertEquals(BranchClosure.ClosureGroup.YOUTH,
                BranchStudio.fromCalendarConfig("YEONSAN", "BASEBALL", "YOUTH_BASEBALL", null));
        assertEquals(BranchClosure.ClosureGroup.SOCIAL,
                BranchStudio.fromCalendarConfig("SAHA", "BASEBALL", null, "SOCIAL"));
        assertEquals(BranchClosure.ClosureGroup.RENTAL,
                BranchStudio.fromCalendarConfig("RENTAL", "RENTAL", null, null));
    }

    @Test
    void partCalendarAlsoReadsWholeBranchClosures() {
        assertTrue(BranchStudio.displayParts(BranchClosure.ClosureGroup.SAHA_TRAINING)
                .contains(BranchClosure.CalendarPart.ALL));
        assertTrue(BranchStudio.displayParts(BranchClosure.ClosureGroup.SAHA_TRAINING)
                .contains(BranchClosure.CalendarPart.TRAINING));
        assertFalse(BranchStudio.displayParts(BranchClosure.ClosureGroup.SAHA)
                .contains(BranchClosure.CalendarPart.TRAINING));
        assertEquals(List.of(BranchClosure.CalendarPart.ALL),
                BranchStudio.displayParts(BranchClosure.ClosureGroup.SAHA));
    }

    @Test
    void storesWholeGroupsAsAllPart() {
        assertEquals(Facility.Branch.RENTAL, BranchStudio.storageBranch(BranchClosure.ClosureGroup.NON_BASEBALL));
        assertEquals(BranchClosure.CalendarPart.ALL,
                BranchStudio.storagePart(BranchClosure.ClosureGroup.NON_BASEBALL));
        assertEquals(Facility.Branch.YEONSAN, BranchStudio.storageBranch(BranchClosure.ClosureGroup.YEONSAN));
        assertEquals(BranchClosure.CalendarPart.ALL,
                BranchStudio.storagePart(BranchClosure.ClosureGroup.SAHA));
        assertEquals(BranchClosure.CalendarPart.TRAINING,
                BranchStudio.storagePart(BranchClosure.ClosureGroup.SAHA_TRAINING));
        assertEquals(BranchClosure.ClosureGroup.SAHA,
                BranchStudio.fromStored(Facility.Branch.SAHA, BranchClosure.CalendarPart.ALL));
        assertEquals(BranchClosure.ClosureGroup.SAHA_TRAINING,
                BranchStudio.fromStored(Facility.Branch.SAHA, BranchClosure.CalendarPart.TRAINING));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromStored(Facility.Branch.SAHA, BranchClosure.CalendarPart.NON_BASEBALL));
        assertEquals(BranchClosure.ClosureGroup.NON_BASEBALL,
                BranchStudio.fromStored(Facility.Branch.RENTAL, BranchClosure.CalendarPart.ALL));
        assertEquals(BranchClosure.ClosureGroup.YOUTH,
                BranchStudio.fromStored(Facility.Branch.RENTAL, BranchClosure.CalendarPart.YOUTH));
    }
}
