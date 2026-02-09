package com.afbscenter.constants;

import org.springframework.core.env.Environment;

/**
 * 상품 관련 기본값.
 * application.properties의 product.default.* 를 사용하며, 없으면 아래 기본값 사용.
 */
public final class ProductDefaults {

    private static final int FALLBACK_TOTAL_COUNT = 10;
    private static final int FALLBACK_USAGE_COUNT = 10;

    private static volatile Environment environment;

    public static void setEnvironment(Environment env) {
        environment = env;
    }

    /** 기본 총 횟수 (totalCount가 없을 때 사용) */
    public static int getDefaultTotalCount() {
        if (environment != null) {
            String v = environment.getProperty("product.default.total-count");
            if (v != null && !v.trim().isEmpty()) {
                try {
                    return Integer.parseInt(v.trim());
                } catch (NumberFormatException ignored) { }
            }
        }
        return FALLBACK_TOTAL_COUNT;
    }

    /** 기본 사용 횟수 (usageCount가 없을 때 사용) */
    public static int getDefaultUsageCount() {
        if (environment != null) {
            String v = environment.getProperty("product.default.usage-count");
            if (v != null && !v.trim().isEmpty()) {
                try {
                    return Integer.parseInt(v.trim());
                } catch (NumberFormatException ignored) { }
            }
        }
        return FALLBACK_USAGE_COUNT;
    }

    private ProductDefaults() {
    }
}
