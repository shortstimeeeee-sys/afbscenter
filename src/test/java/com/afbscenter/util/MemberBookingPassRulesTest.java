package com.afbscenter.util;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MemberBookingPassRulesTest {

    @Test
    void nonMember_create_withoutPass_isAllowed() {
        assertTrue(MemberBookingPassRules.validateCreate(null, null, false).isEmpty());
    }

    @Test
    void member_create_withoutPass_asksToConfirm() {
        assertEquals(MemberBookingPassRules.MSG_CONFIRM_PASS,
                MemberBookingPassRules.validateCreate(member(), null, false).orElse(null));
    }

    @Test
    void countPass_remainingZero_cannotCreate() {
        assertEquals(MemberBookingPassRules.MSG_NO_REMAINING,
                MemberBookingPassRules.validateCreate(member(), countPass(0), false).orElse(null));
    }

    @Test
    void countPass_remainingOne_canCreate_butCannotCopy() {
        MemberProduct oneLeft = countPass(1);
        assertTrue(MemberBookingPassRules.validateCreate(member(), oneLeft, false).isEmpty());
        assertEquals(MemberBookingPassRules.MSG_COPY_NEED_TWO,
                MemberBookingPassRules.validateCreate(member(), oneLeft, true).orElse(null));
    }

    @Test
    void countPass_remainingFive_occupiedFive_cannotCreateOrCopy() {
        MemberProduct fiveLeft = countPass(5);
        assertEquals(MemberBookingPassRules.MSG_OVER_REMAINING,
                MemberBookingPassRules.validateCreate(member(), fiveLeft, false, 5).orElse(null));
        assertEquals(MemberBookingPassRules.MSG_OVER_REMAINING,
                MemberBookingPassRules.validateCreate(member(), fiveLeft, true, 5).orElse(null));
    }

    @Test
    void countPass_remainingFive_occupiedFour_canCreateAndCopy() {
        MemberProduct fiveLeft = countPass(5);
        assertTrue(MemberBookingPassRules.validateCreate(member(), fiveLeft, false, 4).isEmpty());
        assertTrue(MemberBookingPassRules.validateCreate(member(), fiveLeft, true, 4).isEmpty());
    }

    @Test
    void countPass_remainingOne_occupiedOne_cannotCreate() {
        assertEquals(MemberBookingPassRules.MSG_OVER_REMAINING,
                MemberBookingPassRules.validateCreate(member(), countPass(1), false, 1).orElse(null));
    }

    @Test
    void usedUp_countPass_cannotCreate() {
        MemberProduct usedUp = countPass(3);
        usedUp.setStatus(MemberProduct.Status.USED_UP);
        assertEquals(MemberBookingPassRules.MSG_NO_REMAINING,
                MemberBookingPassRules.validateCreate(member(), usedUp, false).orElse(null));
    }

    @Test
    void unlimited_countPass_canCreateEvenIfRemainingZero() {
        MemberProduct unlimited = countPass(0);
        unlimited.setTotalCount(999);
        assertTrue(MemberBookingPassRules.validateCreate(member(), unlimited, false).isEmpty());
        assertTrue(MemberBookingPassRules.validateCreate(member(), unlimited, true).isEmpty());
    }

    @Test
    void monthlyPass_doesNotUseRemainingCount() {
        MemberProduct monthly = new MemberProduct();
        monthly.setRemainingCount(0);
        Product product = new Product();
        product.setType(Product.ProductType.MONTHLY_PASS);
        monthly.setProduct(product);
        assertTrue(MemberBookingPassRules.validateCreate(member(), monthly, false).isEmpty());
        assertTrue(MemberBookingPassRules.validateCreate(member(), monthly, true).isEmpty());
    }

    @Test
    void update_emptyPass_asksToConfirm_evenIfRemainingWasZero() {
        assertEquals(MemberBookingPassRules.MSG_CONFIRM_PASS,
                MemberBookingPassRules.validateUpdate(member(), null).orElse(null));
        assertTrue(MemberBookingPassRules.validateUpdate(member(), countPass(0)).isEmpty());
        assertTrue(MemberBookingPassRules.validateUpdate(null, null).isEmpty());
    }

    @Test
    void remainingHoldFrom_isLastNoonSettlement() {
        assertEquals(java.time.LocalDateTime.of(2026, 9, 11, 12, 0),
                MemberBookingPassRules.remainingHoldFrom(java.time.LocalDate.of(2026, 9, 11)));
    }

    @Test
    void expectedSettledThrough_beforeNoon_usesYesterdayNoon() {
        assertEquals(java.time.LocalDateTime.of(2026, 9, 10, 12, 0),
                MemberBookingPassRules.expectedSettledThrough(java.time.LocalDateTime.of(2026, 9, 11, 11, 59)));
    }

    @Test
    void expectedSettledThrough_atNoon_closesThroughTodayNoon() {
        assertEquals(java.time.LocalDateTime.of(2026, 9, 11, 12, 0),
                MemberBookingPassRules.expectedSettledThrough(java.time.LocalDateTime.of(2026, 9, 11, 12, 0)));
        assertEquals(java.time.LocalDateTime.of(2026, 9, 11, 12, 0),
                MemberBookingPassRules.expectedSettledThrough(java.time.LocalDateTime.of(2026, 9, 11, 21, 0)));
    }

    @Test
    void highlightExcessHold_coversNearestDatesFirst() {
        // 잔여 0, 12일·13일 홀드 → 둘 다 빨강
        assertTrue(MemberBookingPassRules.highlightExcessHold(countPass(0), true, 0));
        assertTrue(MemberBookingPassRules.highlightExcessHold(countPass(0), true, 1));
        // 1회 추가 → 가까운 날짜(index 0)만 원래 색, 다음 날은 빨강
        assertFalse(MemberBookingPassRules.highlightExcessHold(countPass(1), true, 0));
        assertTrue(MemberBookingPassRules.highlightExcessHold(countPass(1), true, 1));
        // 2회 추가 → 둘 다 원래 색
        assertFalse(MemberBookingPassRules.highlightExcessHold(countPass(2), true, 0));
        assertFalse(MemberBookingPassRules.highlightExcessHold(countPass(2), true, 1));
        assertTrue(MemberBookingPassRules.highlightExcessHold(countPass(2), true, 2));
        assertFalse(MemberBookingPassRules.highlightExcessHold(countPass(5), true, 4));
        assertTrue(MemberBookingPassRules.highlightExcessHold(countPass(5), true, 5));
        assertFalse(MemberBookingPassRules.highlightExcessHold(countPass(5), false, 5));
        assertFalse(MemberBookingPassRules.highlightExcessHold(countPass(1), true, -1));
        MemberProduct unlimited = countPass(0);
        unlimited.setTotalCount(999);
        assertFalse(MemberBookingPassRules.highlightExcessHold(unlimited, true, 3));
    }

    @Test
    void copyRequest_detectsSourceBookingId() {
        Map<String, Object> copy = new HashMap<>();
        copy.put("sourceBookingId", 12);
        assertTrue(MemberBookingPassRules.isCopyRequest(copy));
        Map<String, Object> create = new HashMap<>();
        create.put("sourceBookingId", "");
        assertFalse(MemberBookingPassRules.isCopyRequest(create));
        assertFalse(MemberBookingPassRules.isCopyRequest(null));
    }

    private static Member member() {
        Member member = new Member();
        member.setId(1L);
        return member;
    }

    private static MemberProduct countPass(int remaining) {
        MemberProduct mp = new MemberProduct();
        mp.setRemainingCount(remaining);
        mp.setTotalCount(10);
        mp.setStatus(MemberProduct.Status.ACTIVE);
        Product product = new Product();
        product.setType(Product.ProductType.COUNT_PASS);
        product.setUsageCount(10);
        mp.setProduct(product);
        return mp;
    }
}
