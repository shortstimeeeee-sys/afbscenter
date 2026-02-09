package com.afbscenter.constants;

import com.afbscenter.model.Payment;
import org.springframework.core.env.Environment;

/**
 * 결제 관련 기본값.
 * application.properties의 payment.default.* 를 사용하며, 없으면 아래 기본값 사용.
 */
public final class PaymentDefaults {

    private static volatile Environment environment;

    public static void setEnvironment(Environment env) {
        environment = env;
    }

    private static String getProperty(String key, String fallback) {
        if (environment != null) {
            String v = environment.getProperty(key);
            if (v != null && !v.trim().isEmpty()) {
                return v.trim();
            }
        }
        return fallback != null ? fallback : "";
    }

    /** 기본 결제 방법 */
    public static Payment.PaymentMethod getDefaultPaymentMethod() {
        String v = getProperty("payment.default.method", "CASH");
        try {
            return Payment.PaymentMethod.valueOf(v);
        } catch (IllegalArgumentException e) {
            return Payment.PaymentMethod.CASH;
        }
    }

    /** 기본 결제 상태 */
    public static Payment.PaymentStatus getDefaultPaymentStatus() {
        String v = getProperty("payment.default.status", "COMPLETED");
        try {
            return Payment.PaymentStatus.valueOf(v);
        } catch (IllegalArgumentException e) {
            return Payment.PaymentStatus.COMPLETED;
        }
    }

    /** 기본 결제 카테고리 */
    public static Payment.PaymentCategory getDefaultPaymentCategory() {
        String v = getProperty("payment.default.category", "PRODUCT_SALE");
        try {
            return Payment.PaymentCategory.valueOf(v);
        } catch (IllegalArgumentException e) {
            return Payment.PaymentCategory.PRODUCT_SALE;
        }
    }

    private PaymentDefaults() {
    }
}
