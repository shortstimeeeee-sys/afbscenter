package com.afbscenter.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class MemberProductRemainingOpsTest {

    @Test
    void purchaseThenClassDeductsOne() {
        int remaining = MemberProductRemainingOps.remainingOnPurchase(10);
        assertEquals(10, remaining);
        remaining = MemberProductRemainingOps.remainingAfterLessonDeduct(remaining);
        assertEquals(9, remaining);
    }

    @Test
    void purchaseThenAddSessionsThenClassDeductsOne() {
        int remaining = MemberProductRemainingOps.remainingOnPurchase(10);
        remaining = MemberProductRemainingOps.remainingAfterRelativeAdjust(remaining, 2);
        int total = MemberProductRemainingOps.totalAfterRemainingChange(10, remaining);
        assertEquals(12, remaining);
        assertEquals(12, total);
        remaining = MemberProductRemainingOps.remainingAfterLessonDeduct(remaining);
        assertEquals(11, remaining);
    }

    @Test
    void usedUpPassCanBeToppedUpThenDeductedOnce() {
        int remaining = 0;
        remaining = MemberProductRemainingOps.remainingAfterRelativeAdjust(remaining, 4);
        assertEquals(4, remaining);
        remaining = MemberProductRemainingOps.remainingAfterLessonDeduct(remaining);
        assertEquals(3, remaining);
    }

    @Test
    void zeroRemainingIsNotDeducted() {
        assertNull(MemberProductRemainingOps.remainingAfterLessonDeduct(0));
        assertNull(MemberProductRemainingOps.remainingAfterLessonDeduct(null));
    }
}
