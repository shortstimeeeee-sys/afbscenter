package com.afbscenter.constants;

/**
 * 상품 관련 기본값 상수 클래스
 * 하드코딩된 기본값들을 중앙에서 관리
 */
public class ProductDefaults {
    
    /**
     * 기본 총 횟수 (totalCount가 없을 때 사용)
     */
    public static final int DEFAULT_TOTAL_COUNT = 10;
    
    /**
     * 기본 사용 횟수 (usageCount가 없을 때 사용)
     */
    public static final int DEFAULT_USAGE_COUNT = 10;
    
    private ProductDefaults() {
        // 인스턴스 생성 방지
    }
}
