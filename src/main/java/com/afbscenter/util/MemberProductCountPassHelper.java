package com.afbscenter.util;

import com.afbscenter.constants.ProductDefaults;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;

import java.time.LocalDate;

/**
 * 횟수권(COUNT_PASS) 총·잔여 표시 규칙.
 * <ul>
 *   <li>총 횟수: 회원 구매 건 {@code totalCount} 우선, 없을 때만 상품 {@code usageCount}.</li>
 *   <li>잔여(조회): DB {@code remainingCount}가 있으면 그대로 사용한다. 출석·예약 건수로 덮어쓰지 않는다.</li>
 *   <li>잔여가 null인 구 데이터만 출석·예약 기준으로 추정.</li>
 *   <li>잔여 변경은 수동 조정과 수업 차감만 한다.</li>
 * </ul>
 */
public final class MemberProductCountPassHelper {

    private MemberProductCountPassHelper() {
    }

    public static int resolveTotalCount(MemberProduct mp) {
        Integer totalCount = mp.getTotalCount();
        if (totalCount == null || totalCount <= 0) {
            try {
                if (mp.getProduct() != null) {
                    totalCount = mp.getProduct().getUsageCount();
                }
            } catch (Exception ignored) {
                totalCount = null;
            }
        }
        if (totalCount == null || totalCount <= 0) {
            return ProductDefaults.getDefaultTotalCount();
        }
        return totalCount;
    }

    /**
     * 목록·상세·이용권 API 조회용 잔여. 저장된 remainingCount가 있으면 그대로 사용한다.
     * 종료 예약 수·출석 건수로 잔여를 다시 맞추지 않는다.
     */
    public static int resolveRemainingForRead(MemberProduct mp, long memberId,
                                              AttendanceRepository attendanceRepository,
                                              BookingRepository bookingRepository) {
        if (mp.getProduct() == null || mp.getProduct().getType() != Product.ProductType.COUNT_PASS) {
            Integer r = mp.getRemainingCount();
            return r != null ? Math.max(0, r) : 0;
        }
        Integer stored = mp.getRemainingCount();
        if (stored != null) {
            return Math.max(0, stored);
        }
        MemberProduct.Status st = mp.getStatus();
        if (st == MemberProduct.Status.USED_UP || st == MemberProduct.Status.EXPIRED) {
            return 0;
        }
        LocalDate today = LocalDate.now();
        if (mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) {
            return 0;
        }
        int totalCount = resolveTotalCount(mp);
        Long u1 = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(memberId, mp.getId());
        if (u1 == null) {
            u1 = 0L;
        }
        Long u2 = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
        if (u2 == null) {
            u2 = 0L;
        }
        long used = u1 > 0 ? u1 : u2;
        return Math.max(0, totalCount - (int) used);
    }
}
