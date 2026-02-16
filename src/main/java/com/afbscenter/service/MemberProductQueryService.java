package com.afbscenter.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 대관 회차 계산용: 별도 트랜잭션으로 DB 잔여만 조회 (캐시 무시, 횟수 조정 반영).
 */
@Service
public class MemberProductQueryService {

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Integer getRemainingCountFromDb(Long memberProductId) {
        if (memberProductId == null) return null;
        try {
            Query q = entityManager.createNativeQuery("SELECT remaining_count FROM member_product WHERE id = ?1");
            q.setParameter(1, memberProductId);
            @SuppressWarnings("unchecked")
            java.util.List<Object> list = q.getResultList();
            if (list != null && !list.isEmpty() && list.get(0) != null) {
                Object v = list.get(0);
                if (v instanceof Number) return ((Number) v).intValue();
            }
        } catch (Exception ignored) {
            // 새 트랜잭션에서만 실패, 호출부 트랜잭션에는 영향 없음
        }
        return null;
    }
}
