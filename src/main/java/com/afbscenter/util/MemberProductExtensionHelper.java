package com.afbscenter.util;

import com.afbscenter.model.MemberProduct;

import java.util.List;

/**
 * 연장 시 신규 행이 {@code extendedFromMemberProductId}로 직전 행을 가리킬 때의 판별.
 * 대시보드 KPI 등 경량 집계용.
 */
public final class MemberProductExtensionHelper {

    private MemberProductExtensionHelper() {
    }

    public static boolean isSupersededByExtension(MemberProduct mp, List<MemberProduct> allMemberProducts) {
        if (mp == null || mp.getId() == null || allMemberProducts == null) {
            return false;
        }
        Long id = mp.getId();
        for (MemberProduct other : allMemberProducts) {
            if (other.getExtendedFromMemberProductId() != null && id.equals(other.getExtendedFromMemberProductId())) {
                return true;
            }
        }
        return false;
    }
}
