package com.afbscenter.util;

import com.afbscenter.model.Payment;

/**
 * 이용권 연장 시 자동 생성되는 결제와 최초 구매 결제를 구분한다.
 */
public final class PaymentPurchasePriceHelper {

    private PaymentPurchasePriceHelper() {}

    public static boolean isLikelyExtensionChargePayment(Payment payment) {
        if (payment == null) {
            return false;
        }
        String memo = payment.getMemo();
        if (memo == null || memo.isBlank()) {
            return false;
        }
        return memo.contains("이용권 연장");
    }
}
