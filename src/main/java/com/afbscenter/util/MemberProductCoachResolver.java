package com.afbscenter.util;

import com.afbscenter.model.MemberProduct;

/**
 * 이용권 담당 코치 표시 규칙 (API·화면 공통):
 * 이용권에 직접 배정된 코치 → 상품 기본 코치.
 * 회원(Member) 기본 코치는 이용권 정보와 혼동을 막기 위해 여기서는 사용하지 않는다.
 */
public final class MemberProductCoachResolver {

    private MemberProductCoachResolver() {
    }

    /** 표시용 코치명. 없으면 null. */
    public static String resolveDisplayCoachName(MemberProduct mp) {
        if (mp == null) {
            return null;
        }
        try {
            if (mp.getCoach() != null) {
                return mp.getCoach().getName();
            }
        } catch (Exception ignored) {
            // lazy / detached
        }
        try {
            if (mp.getProduct() != null && mp.getProduct().getCoach() != null) {
                return mp.getProduct().getCoach().getName();
            }
        } catch (Exception ignored) {
            // lazy / detached
        }
        return null;
    }
}
