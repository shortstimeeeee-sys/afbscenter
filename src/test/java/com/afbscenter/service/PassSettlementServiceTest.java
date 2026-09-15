package com.afbscenter.service;

import com.afbscenter.util.MemberBookingPassRules;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PassSettlementServiceTest {

    @Test
    void restorePlusOne_staysOnTheLedger_settlementOnlyMovesCutoff() {
        // 차감 복구로 잔여가 4→5가 되면, 결산 마감선이 지나도 잔여는 5로 남는다.
        assertFalse(MemberBookingPassRules.highlightExcessHold(
                remainingPass(5), true, 0));
        LocalDateTime beforeNoon = LocalDateTime.of(2026, 9, 11, 11, 0);
        LocalDateTime afterNoon = LocalDateTime.of(2026, 9, 11, 12, 0);
        assertEquals(LocalDateTime.of(2026, 9, 10, 12, 0),
                MemberBookingPassRules.expectedSettledThrough(beforeNoon));
        assertEquals(LocalDateTime.of(2026, 9, 11, 12, 0),
                MemberBookingPassRules.expectedSettledThrough(afterNoon));
        assertTrue(LocalDateTime.of(2026, 9, 10, 20, 0)
                .isBefore(MemberBookingPassRules.expectedSettledThrough(afterNoon)));
    }

    private static com.afbscenter.model.MemberProduct remainingPass(int remaining) {
        com.afbscenter.model.MemberProduct mp = new com.afbscenter.model.MemberProduct();
        mp.setRemainingCount(remaining);
        mp.setTotalCount(10);
        mp.setStatus(com.afbscenter.model.MemberProduct.Status.ACTIVE);
        com.afbscenter.model.Product product = new com.afbscenter.model.Product();
        product.setType(com.afbscenter.model.Product.ProductType.COUNT_PASS);
        product.setUsageCount(10);
        mp.setProduct(product);
        return mp;
    }
}
