package com.afbscenter.constants;

import com.afbscenter.model.Payment;

/**
 * 결제 관련 기본값 상수 클래스
 * 하드코딩된 결제 기본값들을 중앙에서 관리
 */
public class PaymentDefaults {
    
    /**
     * 기본 결제 방법 (자동 생성 결제에 사용)
     */
    public static final Payment.PaymentMethod DEFAULT_PAYMENT_METHOD = Payment.PaymentMethod.CASH;
    
    /**
     * 기본 결제 상태 (자동 생성 결제에 사용)
     */
    public static final Payment.PaymentStatus DEFAULT_PAYMENT_STATUS = Payment.PaymentStatus.COMPLETED;
    
    /**
     * 기본 결제 카테고리 (상품 판매)
     */
    public static final Payment.PaymentCategory DEFAULT_PAYMENT_CATEGORY = Payment.PaymentCategory.PRODUCT_SALE;
    
    private PaymentDefaults() {
        // 인스턴스 생성 방지
    }
}
