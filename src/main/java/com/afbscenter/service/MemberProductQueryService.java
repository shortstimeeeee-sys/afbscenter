package com.afbscenter.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 별도 트랜잭션(REQUIRES_NEW)으로 DB 잔여만 조회 → 체크인 시 "가져오기" 정확히 (캐시/영속성 컨텍스트 무시).
 */
@Service
public class MemberProductQueryService {

    private static final Logger logger = LoggerFactory.getLogger(MemberProductQueryService.class);

    @PersistenceContext
    private EntityManager entityManager;

    private final JdbcTemplate jdbcTemplate;

    public MemberProductQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Integer getRemainingCountFromDb(Long memberProductId) {
        if (memberProductId == null) return null;
        String[] sqls = {
            "SELECT remaining_count FROM member_products WHERE id = ? AND deleted_at IS NULL",
            "SELECT REMAINING_COUNT FROM MEMBER_PRODUCTS WHERE ID = ? AND DELETED_AT IS NULL",
            "SELECT \"remaining_count\" FROM \"member_products\" WHERE \"id\" = ? AND \"deleted_at\" IS NULL"
        };
        for (String sql : sqls) {
            try {
                Integer v = jdbcTemplate.queryForObject(sql, Integer.class, memberProductId);
                if (v != null) {
                    logger.info("[잔여조회] MemberProduct ID={} → DB remaining_count={}", memberProductId, v);
                    return v;
                }
            } catch (Exception e) {
                logger.trace("[잔여조회] SQL 실패: {}", e.getMessage());
            }
        }
        try {
            Query q = entityManager.createNativeQuery("SELECT remaining_count FROM member_products WHERE id = ?1 AND deleted_at IS NULL");
            q.setParameter(1, memberProductId);
            @SuppressWarnings("unchecked")
            java.util.List<Object> list = q.getResultList();
            if (list != null && !list.isEmpty() && list.get(0) != null) {
                Object v = list.get(0);
                if (v instanceof Number) {
                    int val = ((Number) v).intValue();
                    logger.info("[잔여조회] MemberProduct ID={} → native remaining_count={}", memberProductId, val);
                    return val;
                }
            }
        } catch (Exception e) {
            logger.debug("[잔여조회] native 실패: {}", e.getMessage());
        }
        logger.warn("[잔여조회] MemberProduct ID={} → 모두 실패, null (엔티티 값 사용됨)", memberProductId);
        return null;
    }
}
