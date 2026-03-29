package com.afbscenter.constants;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Payment;

/**
 * 운영·세무·대시보드에서 매출·잔액을 다룰 때의 공통 기준.
 * <p>
 * 이 클래스는 세법을 대신하지 않으며, 사내 장부·세무사와 최종 기준을 맞출 때 참고용입니다.
 * </p>
 * <ul>
 *   <li><b>순매출(실질 매출액)</b>: {@code 결제금액(amount) − 환불액(refundAmount)}. 부분 환불은 동일 건에서 차감.</li>
 *   <li><b>집계에 포함하는 결제 상태</b>: 기간 합계({@link com.afbscenter.repository.PaymentRepository#sumAmountByDateRange})는
 *       {@code COMPLETED} 또는 {@code status null}만 포함. {@code REFUNDED} 전액 환불 건은 제외(이중 차감 방지).</li>
 *   <li><b>이용권 소프트 삭제</b>: {@code member_products.deleted_at}만 채우고 {@code payments} 행은 삭제하지 않음 → 과거 매출·증빙 추적 유지.
 *       단, {@code payments.member_product_id}로 연결된 이용권이 삭제된 경우 {@link com.afbscenter.repository.PaymentRepository#sumAmountByDateRange} 등 순매출 합계에서 제외.</li>
 *   <li><b>현금영수증·부가세</b>: 본 시스템은 결제 단위 금액만 보관. 세금계산서/현금영수증 발행 여부는 별도 정책.</li>
 * </ul>
 */
public final class AccountingPolicy {

    private AccountingPolicy() {
    }

    /** 순매출: 결제액 − 환불액 (null 안전). */
    public static int netAmount(Payment p) {
        if (p == null) {
            return 0;
        }
        return netAmount(p.getAmount(), p.getRefundAmount());
    }

    /**
     * 순매출·통계 집계에서 제외할 결제인지: 연결된 이용권이 있고 소프트 삭제된 경우.
     * (결제 행·이력은 유지, 합계만 제외)
     */
    public static boolean excludedFromRevenueSummary(Payment p) {
        if (p == null) {
            return true;
        }
        MemberProduct mp = p.getMemberProduct();
        if (mp == null) {
            return false;
        }
        return mp.getDeletedAt() != null;
    }

    /** 순매출: 결제액 − 환불액 (null 안전). */
    public static int netAmount(Integer amount, Integer refundAmount) {
        int a = amount != null ? amount : 0;
        int r = refundAmount != null ? refundAmount : 0;
        return a - r;
    }

    /** API 소비자용: 대시보드 매출 합계가 어떤 규칙인지 짧게 설명. */
    public static String revenueSummaryBasisDescription() {
        return "기간 내 결제 건별 (금액 - 환불액) 합계, 상태는 COMPLETED 또는 미설정만 포함, "
                + "이용권이 소프트 삭제된 결제(연결 시)는 제외";
    }
}
