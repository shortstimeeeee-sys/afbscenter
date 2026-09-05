package com.afbscenter.service;

import com.afbscenter.constants.ProductDefaults;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * 회원 목록「마감」배지·common.js {@code checkMemberHasExpired} / {@code filterEndedMemberProductsPastGraceDays}와
 * 동일한 3일 유예 기준(종료 시각·ACTIVE 횟수권 잔여 0 포함).
 */
@Service
public class MemberEndedGraceService {

    private static final long GRACE_MS = 3L * 24 * 60 * 60 * 1000;

    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;

    public MemberEndedGraceService(BookingRepository bookingRepository, AttendanceRepository attendanceRepository) {
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
    }

    public int computeCountPassRemaining(Member member, MemberProduct mp) {
        if (mp.getProduct() == null || mp.getProduct().getType() != Product.ProductType.COUNT_PASS) {
            return -1;
        }
        Integer remainingCount = mp.getRemainingCount();
        if (remainingCount == null) {
            Integer totalCount = mp.getTotalCount();
            if (totalCount == null || totalCount <= 0) {
                totalCount = mp.getProduct().getUsageCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = ProductDefaults.getDefaultTotalCount();
                }
            }
            Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
            if (usedCountByBooking == null) {
                usedCountByBooking = 0L;
            }
            Long usedCountByAttendance =
                    attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
            if (usedCountByAttendance == null) {
                usedCountByAttendance = 0L;
            }
            long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
            remainingCount = totalCount - (int) actualUsedCount;
            if (remainingCount < 0) {
                remainingCount = 0;
            }
        }
        return remainingCount != null ? remainingCount : -1;
    }

    public boolean isActiveCountPassExhausted(Member member, MemberProduct mp) {
        if (mp.getStatus() != MemberProduct.Status.ACTIVE || mp.getProduct() == null
                || mp.getProduct().getType() != Product.ProductType.COUNT_PASS) {
            return false;
        }
        int r = computeCountPassRemaining(member, mp);
        return r == 0;
    }

    /** USED_UP / EXPIRED / ACTIVE·횟수권·잔여0 (프론트 isEndedLike) */
    public boolean isEndedMemberProductForGrace(Member member, MemberProduct mp) {
        if (mp == null) {
            return false;
        }
        if (mp.getStatus() == MemberProduct.Status.USED_UP || mp.getStatus() == MemberProduct.Status.EXPIRED) {
            return true;
        }
        return isActiveCountPassExhausted(member, mp);
    }

    /**
     * 연장·추가구매 등으로 실제로 쓸 수 있는 ACTIVE 이용권이 있으면 「마감」·종료 탭 대상에서 제외
     * (옛 USED_UP 행은 남아 있어도 최신 이용 가능이면 알림하지 않음).
     */
    public boolean hasUsableActivePass(Member member, List<MemberProduct> all) {
        if (all == null || all.isEmpty()) {
            return false;
        }
        LocalDate today = LocalDate.now();
        for (MemberProduct mp : all) {
            if (mp.getStatus() != MemberProduct.Status.ACTIVE || mp.getProduct() == null) {
                continue;
            }
            Product.ProductType t = mp.getProduct().getType();
            if (t == Product.ProductType.COUNT_PASS) {
                if (!isActiveCountPassExhausted(member, mp)) {
                    return true;
                }
            } else if (t == Product.ProductType.MONTHLY_PASS || t == Product.ProductType.TIME_PASS) {
                if (mp.getExpiryDate() == null || !mp.getExpiryDate().isBefore(today)) {
                    return true;
                }
            } else {
                return true;
            }
        }
        return false;
    }

    /** 만료일이 오늘 이전(당일 포함)일 때만 만료일을 종료 시각으로 사용 — 미래 만료일만 있으면 횟수 소진 후에도 유예가 영원히 안 끝남 */
    private boolean expiryOnOrBeforeToday(LocalDate expiry) {
        return expiry != null && !expiry.isAfter(LocalDate.now());
    }

    /** common.js resolveMemberProductEndedAtForGrace */
    public Optional<LocalDateTime> resolveEndedAtForGrace(Member member, MemberProduct mp) {
        if (mp.getEndedAt() != null) {
            return Optional.of(mp.getEndedAt());
        }
        if (mp.getStatus() == MemberProduct.Status.EXPIRED) {
            if (expiryOnOrBeforeToday(mp.getExpiryDate())) {
                return Optional.of(mp.getExpiryDate().atStartOfDay());
            }
            if (mp.getPurchaseDate() != null) {
                return Optional.of(mp.getPurchaseDate());
            }
            if (mp.getExpiryDate() != null) {
                return Optional.of(mp.getExpiryDate().atStartOfDay());
            }
            return Optional.empty();
        }
        if (mp.getStatus() == MemberProduct.Status.USED_UP) {
            if (expiryOnOrBeforeToday(mp.getExpiryDate())) {
                return Optional.of(mp.getExpiryDate().atStartOfDay());
            }
            if (mp.getPurchaseDate() != null) {
                return Optional.of(mp.getPurchaseDate());
            }
            if (mp.getExpiryDate() != null) {
                return Optional.of(mp.getExpiryDate().atStartOfDay());
            }
            return Optional.empty();
        }
        if (isActiveCountPassExhausted(member, mp)) {
            if (expiryOnOrBeforeToday(mp.getExpiryDate())) {
                return Optional.of(mp.getExpiryDate().atStartOfDay());
            }
            if (mp.getPurchaseDate() != null) {
                return Optional.of(mp.getPurchaseDate());
            }
        }
        return Optional.empty();
    }

    /** members.js checkMemberHasExpired 와 동일 */
    public boolean memberHasExpiredGraceBadge(Member member, List<MemberProduct> all) {
        if (all == null || all.isEmpty()) {
            return false;
        }
        if (hasUsableActivePass(member, all)) {
            return false;
        }
        LocalDateTime latest = null;
        for (MemberProduct mp : all) {
            if (!isEndedMemberProductForGrace(member, mp)) {
                continue;
            }
            Optional<LocalDateTime> end = resolveEndedAtForGrace(member, mp);
            if (end.isEmpty()) {
                continue;
            }
            LocalDateTime e = end.get();
            if (latest == null || e.isAfter(latest)) {
                latest = e;
            }
        }
        if (latest == null) {
            return false;
        }
        Instant endInstant = latest.atZone(ZoneId.systemDefault()).toInstant();
        long elapsed = Instant.now().toEpochMilli() - endInstant.toEpochMilli();
        return elapsed >= 0 && elapsed <= GRACE_MS;
    }

    /** common.js filterEndedMemberProductsPastGraceDays (종료 행만 판단; 비종료는 true) */
    public boolean memberProductPassesEndedListGraceFilter(Member member, MemberProduct mp) {
        if (!isEndedMemberProductForGrace(member, mp)) {
            return true;
        }
        Optional<LocalDateTime> end = resolveEndedAtForGrace(member, mp);
        if (end.isEmpty()) {
            return true;
        }
        Instant endInstant = end.get().atZone(ZoneId.systemDefault()).toInstant();
        long elapsed = Instant.now().toEpochMilli() - endInstant.toEpochMilli();
        return elapsed >= 0 && elapsed <= GRACE_MS;
    }
}
