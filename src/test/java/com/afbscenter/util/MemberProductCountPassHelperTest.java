package com.afbscenter.util;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MemberProductCountPassHelperTest {

    @Test
    void storedRemainingIsUsedEvenIfPassLooksUsedUp() {
        MemberProduct mp = countPass(4);
        mp.setStatus(MemberProduct.Status.USED_UP);
        assertEquals(4, MemberProductCountPassHelper.resolveRemainingForRead(mp, 1L, null, null));
    }

    @Test
    void storedZeroStaysZero() {
        MemberProduct mp = countPass(0);
        mp.setStatus(MemberProduct.Status.ACTIVE);
        assertEquals(0, MemberProductCountPassHelper.resolveRemainingForRead(mp, 1L, null, null));
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
