package com.afbscenter.config;

import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 데이터베이스 마이그레이션 컴포넌트
 * 애플리케이션 시작 시 자동으로 실행됩니다.
 */
@Component
@Order(1) // 가장 먼저 실행되도록 설정
public class DatabaseMigration implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseMigration.class);
    private static boolean migrationExecuted = false;

    @Autowired
    private MemberService memberService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!migrationExecuted) {
            try {
                logger.info("애플리케이션 시작 시 회원 등급 마이그레이션 실행");
                memberService.migrateMemberGradesInSeparateTransaction();
                logger.info("회원 등급 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("회원 등급 마이그레이션 실행 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("애플리케이션 시작 시 NULL 허용 컬럼 마이그레이션 실행");
                memberService.migrateNullableColumnsInSeparateTransaction();
                logger.info("NULL 허용 컬럼 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("NULL 허용 컬럼 마이그레이션 실행 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("애플리케이션 시작 시 announcements 테이블 CHECK 제약 조건 제거 실행");
                removeAnnouncementsCheckConstraints();
                logger.info("announcements 테이블 CHECK 제약 조건 제거 완료");
            } catch (Exception e) {
                logger.warn("announcements 테이블 CHECK 제약 조건 제거 중 오류 (무시): {}", e.getMessage());
            }
            
            migrationExecuted = true;
        }
    }

    private void removeAnnouncementsCheckConstraints() {
        try {
            // 가능한 제약 조건 이름들 시도
            String[] possibleConstraintNames = {
                "CONSTRAINT_D", "CONSTRAINT_C", "CONSTRAINT_B", "CONSTRAINT_A",
                "CHECK_TYPE", "ANNOUNCEMENTS_TYPE_CHECK"
            };
            
            for (String constraintName : possibleConstraintNames) {
                try {
                    jdbcTemplate.execute("ALTER TABLE announcements DROP CONSTRAINT IF EXISTS " + constraintName);
                    logger.debug("제약 조건 삭제 시도: {}", constraintName);
                } catch (Exception e) {
                    logger.debug("제약 조건 삭제 실패 (무시): {} - {}", constraintName, e.getMessage());
                }
            }
            
            // H2에서 제약 조건 목록 조회 시도
            try {
                List<Map<String, Object>> constraints = jdbcTemplate.queryForList(
                    "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
                    "WHERE TABLE_NAME = 'ANNOUNCEMENTS' AND CONSTRAINT_TYPE = 'CHECK'"
                );
                for (Map<String, Object> constraint : constraints) {
                    String constraintName = (String) constraint.get("CONSTRAINT_NAME");
                    if (constraintName != null) {
                        try {
                            jdbcTemplate.execute("ALTER TABLE announcements DROP CONSTRAINT " + constraintName);
                            logger.info("CHECK 제약 조건 삭제: {}", constraintName);
                        } catch (Exception e) {
                            logger.debug("제약 조건 삭제 실패 (무시): {}", constraintName);
                        }
                    }
                }
            } catch (Exception e) {
                logger.debug("제약 조건 목록 조회 실패 (무시): {}", e.getMessage());
            }
        } catch (Exception e) {
            logger.warn("announcements 테이블 CHECK 제약 조건 제거 중 오류: {}", e.getMessage());
        }
    }
}
