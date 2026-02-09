package com.afbscenter.util;

import com.afbscenter.model.Coach;
import com.afbscenter.model.LessonCategory;

/**
 * 레슨 카테고리 관련 유틸리티 클래스
 */
public class LessonCategoryUtil {
    
    /**
     * 코치의 담당 종목(specialties)에서 레슨 카테고리를 추출
     * @param coach 코치 객체
     * @return 레슨 카테고리 (없으면 null)
     */
    public static LessonCategory fromCoachSpecialties(Coach coach) {
        if (coach == null || coach.getSpecialties() == null) {
            return null;
        }
        
        String specialties = coach.getSpecialties().toLowerCase();
        if (specialties.contains("유소년") || specialties.contains("youth")) {
            return LessonCategory.YOUTH_BASEBALL;
        } else if (specialties.contains("야구") || specialties.contains("baseball")) {
            return LessonCategory.BASEBALL;
        } else if (specialties.contains("필라테스") || specialties.contains("pilates")) {
            return LessonCategory.PILATES;
        } else if (specialties.contains("트레이닝") || specialties.contains("training")) {
            return LessonCategory.TRAINING;
        }
        return null;
    }
    
    /**
     * 레슨 카테고리를 한글 텍스트로 변환
     * @param category 레슨 카테고리
     * @return 한글 텍스트
     */
    public static String toKoreanText(LessonCategory category) {
        if (category == null) {
            return "";
        }
        
        switch (category) {
            case BASEBALL:
                return "야구 레슨";
            case YOUTH_BASEBALL:
                return "유소년 야구";
            case PILATES:
                return "필라테스 레슨";
            case TRAINING:
                return "트레이닝 파트";
            default:
                return "";
        }
    }
}
