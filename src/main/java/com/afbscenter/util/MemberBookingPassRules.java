package com.afbscenter.util;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;

/**
 * 회원 예약의 이용권 필수·횟수권 잔여·복사 최소 횟수 규칙.
 */
public final class MemberBookingPassRules {

    public static final String MSG_CONFIRM_PASS = "이용권을 확인해 주세요.";
    public static final String MSG_NO_REMAINING = "선택한 횟수권의 잔여 횟수가 없습니다.";
    public static final String MSG_COPY_NEED_TWO = "복사는 이용권 잔여 횟수가 2회 이상이어야 합니다.";
    public static final String MSG_OVER_REMAINING = "이미 잡혀 있는 예약을 포함하면 횟수권 잔여 횟수를 초과합니다.";
    public static final String MSG_NOT_OWNED = "선택한 이용권이 해당 회원의 것이 아닙니다.";
    public static final ZoneId SETTLEMENT_ZONE = ZoneId.of("Asia/Seoul");
    public static final int SETTLEMENT_HOUR = 12;

    private MemberBookingPassRules() {
    }

    public static LocalDateTime nowSeoul() {
        return LocalDateTime.now(SETTLEMENT_ZONE);
    }

    public static boolean isCopyRequest(Map<String, Object> requestData) {
        if (requestData == null) {
            return false;
        }
        Object src = requestData.get("sourceBookingId");
        if (src == null) {
            return false;
        }
        String s = src.toString().trim();
        return !s.isEmpty() && !"null".equalsIgnoreCase(s);
    }

    public static boolean isCountPass(MemberProduct mp) {
        if (mp == null || mp.getProduct() == null) {
            return false;
        }
        return mp.getProduct().getType() == Product.ProductType.COUNT_PASS;
    }

    /** 총 횟수 999 이상만 무제한으로 본다. totalCount null은 무제한이 아니다. */
    public static boolean isUnlimited(MemberProduct mp) {
        if (mp == null) {
            return false;
        }
        Integer total = mp.getTotalCount();
        if (total != null && total >= 999) {
            return true;
        }
        if (mp.getProduct() != null) {
            Integer usage = mp.getProduct().getUsageCount();
            if (usage != null && usage >= 999) {
                return true;
            }
        }
        return false;
    }

    public static int remainingSessions(MemberProduct mp) {
        if (mp == null) {
            return 0;
        }
        if (mp.getStatus() == MemberProduct.Status.USED_UP || mp.getStatus() == MemberProduct.Status.EXPIRED) {
            return 0;
        }
        Integer remaining = mp.getRemainingCount();
        return remaining == null ? 0 : Math.max(0, remaining);
    }

    public static Optional<String> validateCreate(Member member, MemberProduct mp, boolean copy) {
        return validateCreate(member, mp, copy, 0);
    }

    /**
     * @param occupiedHoldCount 이 이용권에 이미 잡혀 있고 아직 차감되지 않은 예약 수(취소·노쇼 제외).
     *                          복사·신규는 여기에 +1회가 더 필요하다.
     */
    public static Optional<String> validateCreate(Member member, MemberProduct mp, boolean copy, int occupiedHoldCount) {
        if (member == null) {
            return Optional.empty();
        }
        if (mp == null) {
            return Optional.of(MSG_CONFIRM_PASS);
        }
        if (isUnlimited(mp) || !isCountPass(mp)) {
            return Optional.empty();
        }
        int remaining = remainingSessions(mp);
        int occupied = Math.max(0, occupiedHoldCount);
        if (remaining <= 0) {
            return Optional.of(MSG_NO_REMAINING);
        }
        if (remaining < occupied + 1) {
            return Optional.of(MSG_OVER_REMAINING);
        }
        if (copy && remaining < 2) {
            return Optional.of(MSG_COPY_NEED_TWO);
        }
        return Optional.empty();
    }

    public static Optional<String> validateUpdate(Member member, MemberProduct mp) {
        if (member == null) {
            return Optional.empty();
        }
        if (mp == null) {
            return Optional.of(MSG_CONFIRM_PASS);
        }
        return Optional.empty();
    }

    /**
     * 매일 12:00 결산 마감선. 이 시각 이전 시작 예약은 잔여 홀드·빨간 표시에서 뺀다.
     * 잔여 횟수 자체는 결산이 다시 계산하지 않는다(복구 +1은 즉시 유지).
     */
    public static LocalDateTime remainingHoldFrom() {
        return expectedSettledThrough(nowSeoul());
    }

    public static LocalDateTime remainingHoldFrom(LocalDate today) {
        LocalDate day = today != null ? today : nowSeoul().toLocalDate();
        return expectedSettledThrough(day.atTime(SETTLEMENT_HOUR, 0));
    }

    public static LocalDateTime expectedSettledThrough(LocalDateTime now) {
        LocalDateTime at = now != null ? now : nowSeoul();
        LocalDateTime noon = at.toLocalDate().atTime(SETTLEMENT_HOUR, 0);
        if (at.isBefore(noon)) {
            return noon.minusDays(1);
        }
        return noon;
    }

    /**
     * 가까운 날짜부터 잔여 횟수를 채운 뒤, 남은 예약만 빨간색으로 표시할지.
     * holdIndex는 결산 이후 미차감 예약의 날짜순(0이 가장 가까운 날짜).
     */
    public static boolean highlightExcessHold(MemberProduct mp, boolean occupiesRemaining, int holdIndex) {
        if (!occupiesRemaining || mp == null || isUnlimited(mp) || !isCountPass(mp) || holdIndex < 0) {
            return false;
        }
        int remaining = remainingSessions(mp);
        return holdIndex >= remaining;
    }
}
