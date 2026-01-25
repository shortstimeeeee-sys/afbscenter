package com.afbscenter.constants;

import com.afbscenter.model.Booking;

/**
 * 예약 관련 기본값 상수 클래스
 * 하드코딩된 예약 기본값들을 중앙에서 관리
 */
public class BookingDefaults {
    
    /**
     * 기본 예약 시간 (분) - 운영 시간이 없을 때 사용
     */
    public static final int DEFAULT_BOOKING_MINUTES = 60;
    
    /**
     * 기본 운영 시간 (시간) - 운영 시간이 설정되지 않았을 때 사용
     */
    public static final int DEFAULT_OPERATING_HOURS = 24;
    
    /**
     * 기본 지점
     */
    public static final Booking.Branch DEFAULT_BRANCH = Booking.Branch.SAHA;
    
    private BookingDefaults() {
        // 인스턴스 생성 방지
    }
}
