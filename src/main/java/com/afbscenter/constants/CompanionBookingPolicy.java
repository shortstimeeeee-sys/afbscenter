package com.afbscenter.constants;

/**
 * 동반 예약: 같은 시설·같은 시작 시각에 최대 3명(인원 합), 2~3명 예약 시 수업 종료 30분 연장(서버에서 적용).
 */
public final class CompanionBookingPolicy {

    /** 같은 시작 시각 동반 인원 합 상한 */
    public static final int MAX_TOTAL_PARTICIPANTS = 3;

    /** 인원 2명 이상일 때 기본 종료 시각에 더하는 분 */
    public static final int EXTRA_MINUTES_FOR_TWO_OR_MORE = 30;

    /** 동반 예약으로 허용하는 인원(한 예약 건 기준) */
    public static final int MIN_PARTICIPANTS = 1;
    public static final int MAX_PARTICIPANTS_PER_BOOKING = 3;

    private CompanionBookingPolicy() {}
}
