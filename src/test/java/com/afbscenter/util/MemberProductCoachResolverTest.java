package com.afbscenter.util;

import com.afbscenter.model.Coach;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MemberProductCoachResolverTest {

    @Test
    void isWorkingCoach_treatsNullActiveAsWorking() {
        Coach coach = new Coach();
        coach.setName("김코치");
        coach.setActive(null);
        assertTrue(MemberProductCoachResolver.isWorkingCoach(coach));
    }

    @Test
    void isWorkingCoach_falseWhenResigned() {
        Coach coach = new Coach();
        coach.setName("퇴사코치");
        coach.setActive(false);
        assertFalse(MemberProductCoachResolver.isWorkingCoach(coach));
    }

    @Test
    void resolveDisplayCoachName_skipsResignedAssignedCoach() {
        Coach resigned = new Coach();
        resigned.setName("퇴사코치");
        resigned.setActive(false);

        Coach productDefault = new Coach();
        productDefault.setName("상품기본");
        productDefault.setActive(true);

        Product product = new Product();
        product.setCoach(productDefault);

        MemberProduct mp = new MemberProduct();
        mp.setCoach(resigned);
        mp.setProduct(product);

        assertNull(MemberProductCoachResolver.resolveDisplayCoachName(mp));
    }

    @Test
    void resolveDisplayCoachName_usesWorkingAssignedCoach() {
        Coach working = new Coach();
        working.setName("근무코치");
        working.setActive(true);

        MemberProduct mp = new MemberProduct();
        mp.setCoach(working);

        assertEquals("근무코치", MemberProductCoachResolver.resolveDisplayCoachName(mp));
    }

    @Test
    void resolveDisplayCoachName_fallsBackToWorkingProductCoachWhenUnassigned() {
        Coach productDefault = new Coach();
        productDefault.setName("상품기본");
        productDefault.setActive(true);

        Product product = new Product();
        product.setCoach(productDefault);

        MemberProduct mp = new MemberProduct();
        mp.setProduct(product);

        assertEquals("상품기본", MemberProductCoachResolver.resolveDisplayCoachName(mp));
    }

    @Test
    void resolveDisplayCoachName_skipsInactiveProductCoach() {
        Coach resigned = new Coach();
        resigned.setName("퇴사코치");
        resigned.setActive(false);

        Product product = new Product();
        product.setCoach(resigned);

        MemberProduct mp = new MemberProduct();
        mp.setProduct(product);

        assertNull(MemberProductCoachResolver.resolveDisplayCoachName(mp));
    }
}
