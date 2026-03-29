package com.afbscenter.util;

import com.afbscenter.model.Coach;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Payment;
import com.afbscenter.model.Product;
import com.afbscenter.repository.MemberProductRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 결제/정산 목록의 코치 표시. 예약·회원 담당만 보면 상품(이용권) 결제는 항상 비어 보이므로,
 * 동일 회원·상품의 이용권({@link MemberProduct#getCoach()})과 상품 기본 코치를 뒤이어 사용한다.
 * <p>
 * 목록에서 결제 건수만큼 이용권 조회가 반복되지 않도록 {@link #resolveCoachesForPayments(List)}로 배치 처리한다.
 */
@Component
public class PaymentCoachResolver {

    private final MemberProductRepository memberProductRepository;

    public PaymentCoachResolver(MemberProductRepository memberProductRepository) {
        this.memberProductRepository = memberProductRepository;
    }

    /**
     * 예약 코치 → 회원 담당 코치 → (상품 판매) 결제 시각과 가장 가까운 구매의 이용권 코치 → 상품 기본 코치
     */
    public Coach resolve(Payment payment) {
        return resolveWithCache(payment, new HashMap<>());
    }

    /**
     * 결제 목록용: (회원, 상품) 쌍별 이용권 목록을 한 번만 조회해 재사용한다.
     */
    public Map<Long, Coach> resolveCoachesForPayments(List<Payment> payments) {
        Map<String, List<MemberProduct>> mpCache = new HashMap<>();
        Map<Long, Coach> out = new HashMap<>();
        if (payments == null) {
            return out;
        }
        for (Payment p : payments) {
            if (p != null && p.getId() != null) {
                out.put(p.getId(), resolveWithCache(p, mpCache));
            }
        }
        return out;
    }

    private Coach resolveWithCache(Payment payment, Map<String, List<MemberProduct>> mpCache) {
        if (payment == null) {
            return null;
        }
        try {
            if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                return payment.getBooking().getCoach();
            }
        } catch (Exception ignored) {
        }
        try {
            if (payment.getMember() != null && payment.getMember().getCoach() != null) {
                return payment.getMember().getCoach();
            }
        } catch (Exception ignored) {
        }
        if (payment.getMember() == null || payment.getProduct() == null) {
            return null;
        }
        Long mid = payment.getMember().getId();
        Long pid = payment.getProduct().getId();
        String key = mid + ":" + pid;
        List<MemberProduct> mps = mpCache.computeIfAbsent(key, k ->
                memberProductRepository.findByMemberIdAndProductId(mid, pid));
        Coach fromMp = pickCoachFromMemberProducts(mps, payment.getPaidAt());
        if (fromMp != null) {
            return fromMp;
        }
        try {
            Product prod = payment.getProduct();
            if (prod != null && prod.getCoach() != null) {
                return prod.getCoach();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static Coach pickCoachFromMemberProducts(List<MemberProduct> mps, LocalDateTime paidAt) {
        if (mps == null || mps.isEmpty()) {
            return null;
        }
        LocalDateTime t = paidAt != null ? paidAt : LocalDateTime.now();
        MemberProduct best = mps.stream()
                .filter(mp -> mp.getCoach() != null && mp.getPurchaseDate() != null)
                .min(Comparator.comparingLong(mp ->
                        Math.abs(Duration.between(mp.getPurchaseDate(), t).getSeconds())))
                .orElse(null);
        if (best != null) {
            return best.getCoach();
        }
        MemberProduct withCoach = mps.stream()
                .filter(mp -> mp.getCoach() != null)
                .max(Comparator.comparing(MemberProduct::getPurchaseDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        return withCoach != null ? withCoach.getCoach() : null;
    }
}
