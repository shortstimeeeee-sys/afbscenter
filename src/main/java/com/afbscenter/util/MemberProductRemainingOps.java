package com.afbscenter.util;

/**
 * 횟수권 잔여: 구매·수동 조정으로 쌓고, 수업 종료 때 1회만 차감한다.
 * 끝난 예약 수로 잔여를 다시 0에 맞추지 않는다.
 */
public final class MemberProductRemainingOps {

    private MemberProductRemainingOps() {
    }

    public static int remainingOnPurchase(int usageCount) {
        return Math.max(0, usageCount);
    }

    public static int remainingAfterRelativeAdjust(int currentRemaining, int amount) {
        return Math.max(0, currentRemaining + amount);
    }

    public static int totalAfterRemainingChange(int currentTotal, int newRemaining) {
        if (newRemaining > currentTotal) {
            return newRemaining;
        }
        return Math.max(0, currentTotal);
    }

    /** 잔여가 없으면 차감하지 않는다. 있으면 1회만 줄인다. */
    public static Integer remainingAfterLessonDeduct(Integer currentRemaining) {
        if (currentRemaining == null || currentRemaining <= 0) {
            return null;
        }
        return currentRemaining - 1;
    }
}
