package com.afbscenter.util;

import com.afbscenter.model.Coach;
import com.afbscenter.model.MemberProduct;

/**
 * 이용권 담당 코치 표시 규칙 (API·화면 공통):
 * 이용권에 직접 배정된 코치 → 상품 기본 코치.
 * 회원(Member) 기본 코치는 이용권 정보와 혼동을 막기 위해 여기서는 사용하지 않는다.
 * 근무 중 코치는 코치/레슨 관리에 등록된 활성 코치(active !== false)만 표시한다.
 */
public final class MemberProductCoachResolver {

    private MemberProductCoachResolver() {
    }

    /**
     * 코치/레슨 관리 기본 목록과 동일: active가 false가 아니면 근무 중.
     */
    public static boolean isWorkingCoach(Coach coach) {
        return coach != null && (coach.getActive() == null || Boolean.TRUE.equals(coach.getActive()));
    }

    /** 표시용 코치명. 퇴사·미배정이면 null(화면에서는 미지정). */
    public static String resolveDisplayCoachName(MemberProduct mp) {
        if (mp == null) {
            return null;
        }
        try {
            if (mp.getCoach() != null) {
                // 이용권에 직접 배정된 코치가 퇴사면 상품 기본 코치로 대체하지 않고 미지정
                return isWorkingCoach(mp.getCoach()) ? mp.getCoach().getName() : null;
            }
        } catch (Exception ignored) {
            // lazy / detached
        }
        try {
            if (mp.getProduct() != null && isWorkingCoach(mp.getProduct().getCoach())) {
                return mp.getProduct().getCoach().getName();
            }
        } catch (Exception ignored) {
            // lazy / detached
        }
        return null;
    }
}
