package com.afbscenter.config;

import com.afbscenter.model.Facility;
import com.afbscenter.model.FacilitySlot;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.MemberProductHistory;
import com.afbscenter.model.Payment;
import com.afbscenter.model.Product;
import com.afbscenter.model.User;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.FacilitySlotRepository;
import com.afbscenter.repository.MemberProductHistoryRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.repository.UserRepository;
import com.afbscenter.service.MemberService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
    
    @Autowired
    private FacilityRepository facilityRepository;
    
    @Autowired
    private FacilitySlotRepository facilitySlotRepository;
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private MemberProductRepository memberProductRepository;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Autowired
    private MemberProductHistoryRepository memberProductHistoryRepository;
    
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    // 시설 초기화 데이터 (application.properties에서 주입)
    @Value("${facility.init.saha.name:사하점}")
    private String sahaFacilityName;
    
    @Value("${facility.init.saha.location:부산}")
    private String sahaFacilityLocation;
    
    @Value("${facility.init.saha.open-time:08:00}")
    private String sahaFacilityOpenTime;
    
    @Value("${facility.init.saha.close-time:00:00}")
    private String sahaFacilityCloseTime;
    
    @Value("${facility.init.saha.hourly-rate:0}")
    private Integer sahaFacilityHourlyRate;
    
    @Value("${facility.init.yeonsan.name:연산점}")
    private String yeonsanFacilityName;
    
    @Value("${facility.init.yeonsan.location:부산}")
    private String yeonsanFacilityLocation;
    
    @Value("${facility.init.yeonsan.open-time:08:00}")
    private String yeonsanFacilityOpenTime;
    
    @Value("${facility.init.yeonsan.close-time:00:00}")
    private String yeonsanFacilityCloseTime;
    
    @Value("${facility.init.yeonsan.hourly-rate:0}")
    private Integer yeonsanFacilityHourlyRate;
    
    @Value("${admin.init.password:admin123}")
    private String adminInitPassword;

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (!migrationExecuted) {
            // ⚠️⚠️⚠️ 주의: 회원 데이터 자동 삭제 기능 ⚠️⚠️⚠️
            // 이 옵션은 개발 환경에서만 사용해야 하며, 프로덕션 환경에서는 절대 true로 설정하지 마세요!
            // true로 설정하면 서버 시작 시마다 모든 회원 데이터가 삭제됩니다!
            // 현재 설정: false (삭제 안함) - 이 값을 변경하지 마세요!
            // ⚠️⚠️⚠️ 이 값을 true로 변경하면 모든 회원 데이터가 영구적으로 삭제됩니다! ⚠️⚠️⚠️
            final boolean deleteAllMembers = false; // ⚠️ 절대 true로 변경하지 마세요! 회원 데이터가 모두 삭제됩니다!
            
            // 회원 데이터 삭제 기능은 완전히 비활성화됨
            // 필요시 아래 주석을 해제하고 deleteAllMembers를 true로 변경해야 함
            // 하지만 프로덕션 환경에서는 절대 사용하지 마세요!
            /*
            if (deleteAllMembers) {
                try {
                    logger.error("⚠️⚠️⚠️ 경고: 회원(Member) 테이블 데이터 삭제 모드가 활성화되어 있습니다! ⚠️⚠️⚠️");
                    logger.error("⚠️⚠️⚠️ 모든 회원 데이터가 삭제됩니다! ⚠️⚠️⚠️");
                    logger.warn("⚠️ 회원(Member) 테이블 데이터 삭제 모드 활성화 - Member 테이블만 삭제합니다!");
                    deleteAllMemberData();
                    logger.info("회원(Member) 테이블 데이터 삭제 완료");
                } catch (Exception e) {
                    logger.error("회원(Member) 테이블 데이터 삭제 중 오류 발생", e);
                }
            } else {
                logger.debug("회원 데이터 자동 삭제 기능 비활성화됨 (deleteAllMembers = false)");
            }
            */
            
            // 회원 데이터 삭제 기능이 비활성화되어 있음을 명확히 로그에 기록
            logger.info("✅ 회원 데이터 자동 삭제 기능: 비활성화됨 (deleteAllMembers = false)");
            logger.info("✅ 회원 데이터는 서버 시작 시 삭제되지 않습니다.");
            
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
            
            // 비회원 대기 예약 → 확정으로 일괄 수정 (체크인 없이 자동 승인)
            try {
                int updated = jdbcTemplate.update("UPDATE bookings SET status = 'CONFIRMED' WHERE member_id IS NULL AND status = 'PENDING'");
                if (updated > 0) {
                    logger.info("비회원 대기 예약을 확정으로 일괄 수정: {}건", updated);
                }
            } catch (Exception e) {
                logger.warn("비회원 대기 예약 수정 중 오류 (무시): {}", e.getMessage());
            }
            
            // 회원으로 잘못 저장된 '체험' 예약 → 비회원으로 전환 (체크인 목록에서 제거)
            try {
                int converted = jdbcTemplate.update(
                    "UPDATE bookings b INNER JOIN members m ON b.member_id = m.id " +
                    "SET b.member_id = NULL, b.non_member_name = m.name, b.status = 'CONFIRMED' " +
                    "WHERE m.name LIKE '%체험%'"
                );
                if (converted > 0) {
                    logger.info("체험 회원 예약을 비회원으로 전환(자동 체크인 적용): {}건", converted);
                }
            } catch (Exception e) {
                logger.warn("체험 예약 비회원 전환 중 오류 (무시): {}", e.getMessage());
            }
            
            // 초기 관리자 계정 생성
            try {
                initializeDefaultUsers();
            } catch (Exception e) {
                logger.error("초기 사용자 계정 생성 중 오류 발생: {}", e.getMessage(), e);
            }
            
            try {
                logger.info("애플리케이션 시작 시 announcements 테이블 CHECK 제약 조건 제거 실행");
                removeAnnouncementsCheckConstraints();
                logger.info("announcements 테이블 CHECK 제약 조건 제거 완료");
            } catch (Exception e) {
                logger.warn("announcements 테이블 CHECK 제약 조건 제거 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("애플리케이션 시작 시 Products 테이블 coach_id 컬럼 마이그레이션 실행");
                migrateProductsTableCoachColumn();
                logger.info("Products 테이블 coach_id 컬럼 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("Products 테이블 coach_id 컬럼 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("애플리케이션 시작 시 시설 데이터 초기화 실행");
                initializeFacilities();
                logger.info("시설 데이터 초기화 완료");
            } catch (Exception e) {
                logger.warn("시설 데이터 초기화 중 오류 (무시): {}", e.getMessage());
            }
            try {
                ensureFacilitySlots();
            } catch (Exception e) {
                logger.warn("시설 슬롯 기본값 생성 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("불필요한 FACILITY_SLOTS_COPY_* 테이블 정리 실행");
                dropUnusedFacilitySlotsCopyTables();
                logger.info("불필요한 FACILITY_SLOTS_COPY_* 테이블 정리 완료");
            } catch (Exception e) {
                logger.warn("FACILITY_SLOTS_COPY_* 테이블 정리 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("애플리케이션 시작 시 Members 테이블 컬럼명 마이그레이션 실행");
                migrateMembersTableColumnNames();
                logger.info("Members 테이블 컬럼명 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("Members 테이블 컬럼명 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }
            
            try {
                logger.info("member_id FK 수정 마이그레이션 실행 (MEMBERS_COPY_3_1 -> members)");
                fixAllMemberIdForeignKeysToMembers();
                logger.info("member_id FK 수정 완료");
            } catch (Exception e) {
                logger.warn("member_id FK 수정 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }

            try {
                logger.info("애플리케이션 시작 시 누락된 결제(Payment) 자동 생성 실행");
                createMissingPayments();
                logger.info("누락된 결제(Payment) 자동 생성 완료");
            } catch (Exception e) {
                logger.warn("누락된 결제(Payment) 자동 생성 중 오류 (무시): {}", e.getMessage());
            }
            
            // 레거시 패키지 데이터 정리: TEAM_PACKAGE를 더 이상 사용하지 않는 운영 방식이면
            // COUNT_PASS 등 일반 이용권에 잘못 남아있는 package_items_remaining을 비워 잔여/표시 불일치 방지
            try {
                int cleared = 0;
                try {
                    cleared = jdbcTemplate.update(
                        "UPDATE member_products mp " +
                        "JOIN products p ON p.id = mp.product_id " +
                        "SET mp.package_items_remaining = NULL " +
                        "WHERE mp.package_items_remaining IS NOT NULL " +
                        "  AND TRIM(mp.package_items_remaining) <> '' " +
                        "  AND (p.type IS NULL OR p.type <> 'TEAM_PACKAGE')"
                    );
                } catch (Exception e) {
                    logger.debug("package_items_remaining 정리 JOIN UPDATE 실패(무시): {}", e.getMessage());
                }
                if (cleared > 0) {
                    logger.info("레거시 package_items_remaining 정리 완료: {}건", cleared);
                }
            } catch (Exception e) {
                logger.warn("레거시 package_items_remaining 정리 중 오류 (무시): {}", e.getMessage());
            }

            try {
                logger.info("애플리케이션 시작 시 Users 테이블 approved 컬럼 마이그레이션 실행");
                migrateUsersTableApprovedColumn();
                logger.info("Users 테이블 approved 컬럼 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("Users 테이블 approved 컬럼 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }

            try {
                logger.info("애플리케이션 시작 시 회원 히스토리 추적용 processed_by 컬럼 마이그레이션 실행");
                migrateProcessedByColumns();
                logger.info("processed_by 컬럼 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("processed_by 컬럼 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }

            try {
                logger.info("애플리케이션 시작 시 분야별 코치 메모 컬럼 마이그레이션 실행");
                migrateCoachMemoByFieldColumns();
                logger.info("분야별 코치 메모 컬럼 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("분야별 코치 메모 컬럼 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }

            try {
                logger.info("애플리케이션 시작 시 수치별 코치 메모(JSON) 컬럼 마이그레이션 실행");
                migrateCoachMemoStatsColumn();
                logger.info("수치별 코치 메모 컬럼 마이그레이션 완료");
            } catch (Exception e) {
                logger.warn("수치별 코치 메모 컬럼 마이그레이션 중 오류 (무시): {}", e.getMessage());
            }

            try {
                logger.info("애플리케이션 시작 시 횟수권(COUNT_PASS) remaining_count 동기화 실행");
                syncMemberProductRemainingCountFromEndedBookings();
                logger.info("횟수권 remaining_count 동기화 완료");
            } catch (Exception e) {
                logger.warn("횟수권 remaining_count 동기화 중 오류 (무시): {}", e.getMessage());
            }
            
            migrationExecuted = true;
        }
    }

    /**
     * Member 테이블의 데이터만 삭제
     * 외래키 제약 조건을 일시적으로 비활성화하여 Member만 삭제합니다.
     */
    private void deleteAllMemberData() {
        try {
            logger.info("회원(Member) 테이블 데이터 삭제 시작...");
            
            // H2에서 외래키 제약 조건 일시적으로 비활성화
            jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
            
            try {
                // Member 테이블만 삭제
                int memberCount = jdbcTemplate.update("DELETE FROM members");
                logger.info("Member 삭제 완료: {} 건", memberCount);
            } finally {
                // 외래키 제약 조건 다시 활성화
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
            }
            
            logger.info("회원(Member) 테이블 데이터 삭제 완료");
        } catch (Exception e) {
            logger.error("회원(Member) 테이블 데이터 삭제 중 오류 발생", e);
            // 오류 발생 시에도 외래키 제약 조건 다시 활성화 시도
            try {
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
            } catch (Exception ex) {
                logger.warn("외래키 제약 조건 재활성화 실패: {}", ex.getMessage());
            }
            throw e;
        }
    }

    /**
     * Products 테이블에 coach_id 컬럼 추가 마이그레이션
     * 상품별 코치 배정 기능을 위한 컬럼 추가
     */
    private void migrateProductsTableCoachColumn() {
        try {
            // Products 테이블 존재 여부 확인
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES " +
                "WHERE TABLE_NAME = 'PRODUCTS'"
            );
            
            if (!tables.isEmpty()) {
                // coach_id 컬럼 존재 여부 확인
                List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'PRODUCTS' AND COLUMN_NAME = 'COACH_ID'"
                );
                
                if (columns.isEmpty()) {
                    logger.info("Products 테이블에 coach_id 컬럼이 없습니다. 컬럼을 추가합니다.");
                    
                    // H2 데이터베이스에서 컬럼 추가
                    try {
                        jdbcTemplate.execute("ALTER TABLE products ADD COLUMN coach_id BIGINT");
                        logger.info("Products 테이블에 coach_id 컬럼 추가 완료");
                        
                        // 외래키 제약 조건 추가 (선택사항, 에러 발생 시 무시)
                        try {
                            jdbcTemplate.execute(
                                "ALTER TABLE products ADD CONSTRAINT fk_products_coach " +
                                "FOREIGN KEY (coach_id) REFERENCES coaches(id)"
                            );
                            logger.info("Products 테이블에 coach 외래키 제약 조건 추가 완료");
                        } catch (Exception e) {
                            logger.debug("외래키 제약 조건 추가 실패 (무시): {}", e.getMessage());
                        }
                    } catch (Exception e) {
                        logger.warn("Products 테이블에 coach_id 컬럼 추가 실패: {}", e.getMessage());
                        // 컬럼이 이미 존재하거나 다른 이유로 실패할 수 있음
                    }
                } else {
                    logger.debug("Products 테이블에 coach_id 컬럼이 이미 존재합니다.");
                }
            } else {
                logger.debug("Products 테이블이 존재하지 않습니다 - Hibernate가 자동으로 생성합니다.");
            }
        } catch (Exception e) {
            logger.warn("Products 테이블 coach_id 컬럼 마이그레이션 중 오류: {}", e.getMessage());
            // 마이그레이션 실패해도 애플리케이션은 계속 실행되도록 함
        }

        // members 테이블에 pitcher_breaking_ball(변화구) 컬럼 추가
        try {
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE UPPER(TABLE_NAME) = 'MEMBERS'"
            );
            if (!tables.isEmpty()) {
                List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE UPPER(TABLE_NAME) = 'MEMBERS' AND UPPER(COLUMN_NAME) = 'PITCHER_BREAKING_BALL'"
                );
                if (columns.isEmpty()) {
                    jdbcTemplate.execute("ALTER TABLE members ADD COLUMN pitcher_breaking_ball VARCHAR(10)");
                    logger.info("Members 테이블에 pitcher_breaking_ball 컬럼 추가 완료");
                }
            }
        } catch (Exception e) {
            logger.warn("Members 테이블 pitcher_breaking_ball 컬럼 마이그레이션 중 오류: {}", e.getMessage());
        }

        // member_products 테이블에 ended_at 컬럼 추가 (이용권 종료 시각, 종료 배지 3일 유지 규칙용)
        try {
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE UPPER(TABLE_NAME) = 'MEMBER_PRODUCTS'"
            );
            if (!tables.isEmpty()) {
                List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE UPPER(TABLE_NAME) = 'MEMBER_PRODUCTS' AND UPPER(COLUMN_NAME) = 'ENDED_AT'"
                );
                if (columns.isEmpty()) {
                    jdbcTemplate.execute("ALTER TABLE member_products ADD COLUMN ended_at TIMESTAMP");
                    logger.info("member_products 테이블에 ended_at 컬럼 추가 완료");
                }
            }
        } catch (Exception e) {
            logger.warn("member_products ended_at 컬럼 마이그레이션 중 오류: {}", e.getMessage());
        }

        // members 테이블에 수비 순발력 컬럼 추가
        try {
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE UPPER(TABLE_NAME) = 'MEMBERS'"
            );
            if (!tables.isEmpty()) {
                List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE UPPER(TABLE_NAME) = 'MEMBERS' AND UPPER(COLUMN_NAME) = 'DEFENSE_QUICKNESS'"
                );
                if (columns.isEmpty()) {
                    jdbcTemplate.execute("ALTER TABLE members ADD COLUMN defense_quickness DOUBLE");
                    logger.info("Members 테이블에 defense_quickness 컬럼 추가 완료");
                }
            }
        } catch (Exception e) {
            logger.warn("Members 테이블 defense_quickness 컬럼 마이그레이션 중 오류: {}", e.getMessage());
        }

        // members 테이블에 포수 기록 컬럼 추가
        for (String col : new String[]{"catcher_blocking", "catcher_throwing", "catcher_framing"}) {
            try {
                List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE UPPER(TABLE_NAME) = 'MEMBERS'"
                );
                if (!tables.isEmpty()) {
                    List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                        "WHERE UPPER(TABLE_NAME) = 'MEMBERS' AND UPPER(COLUMN_NAME) = ?",
                        col.toUpperCase()
                    );
                    if (columns.isEmpty()) {
                        jdbcTemplate.execute("ALTER TABLE members ADD COLUMN " + col + " DOUBLE");
                        logger.info("Members 테이블에 {} 컬럼 추가 완료", col);
                    }
                }
            } catch (Exception e) {
                logger.warn("Members 테이블 {} 컬럼 마이그레이션 중 오류: {}", col, e.getMessage());
            }
        }
    }

    /**
     * 시설 데이터 초기화
     * 사하점을 ID 1번, 연산점을 ID 2번으로 설정
     */
    private void initializeFacilities() {
        try {
            // 기존 시설 데이터 확인
            List<Facility> existingFacilities = facilityRepository.findAll();
            
            // 사하점과 연산점이 이미 올바른 ID로 존재하는지 확인
            boolean hasSaha = false;
            boolean hasYeonsan = false;
            Long sahaId = null;
            Long yeonsanId = null;
            
            for (Facility facility : existingFacilities) {
                if (facility.getBranch() == Facility.Branch.SAHA && facility.getName().contains("사하")) {
                    hasSaha = true;
                    sahaId = facility.getId();
                }
                if (facility.getBranch() == Facility.Branch.YEONSAN && facility.getName().contains("연산")) {
                    hasYeonsan = true;
                    yeonsanId = facility.getId();
                }
            }
            
            // 모든 시설 삭제 후 재생성
            if (!existingFacilities.isEmpty()) {
                logger.info("기존 시설 데이터 삭제 중... ({} 건)", existingFacilities.size());
                
                // 외래키 제약 조건 일시적으로 비활성화
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
                try {
                    // bookings 테이블의 facility_id를 NULL로 설정
                    jdbcTemplate.update("UPDATE bookings SET facility_id = NULL");
                    // 시설 삭제
                    facilityRepository.deleteAll();
                    // ID 시퀀스 리셋
                    jdbcTemplate.execute("ALTER TABLE facilities ALTER COLUMN id RESTART WITH 1");
                } finally {
                    jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
                }
                logger.info("기존 시설 데이터 삭제 완료");
            }
            
            // 사하점 생성 (ID 1번) - application.properties에서 설정값 사용
            Facility sahaFacility = new Facility();
            sahaFacility.setName(sahaFacilityName);
            sahaFacility.setLocation(sahaFacilityLocation);
            sahaFacility.setBranch(Facility.Branch.SAHA);
            sahaFacility.setFacilityType(Facility.FacilityType.ALL);
            sahaFacility.setHourlyRate(sahaFacilityHourlyRate);
            sahaFacility.setOpenTime(LocalTime.parse(sahaFacilityOpenTime));
            sahaFacility.setCloseTime(LocalTime.parse(sahaFacilityCloseTime));
            sahaFacility.setActive(true);
            Facility savedSaha = facilityRepository.save(sahaFacility);
            logger.info("사하점 생성 완료: ID={}", savedSaha.getId());
            
            // ID가 1번이 아니면 수정
            if (savedSaha.getId() != 1L) {
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
                try {
                    jdbcTemplate.update("UPDATE facilities SET id = 1 WHERE id = ?", savedSaha.getId());
                    jdbcTemplate.execute("ALTER TABLE facilities ALTER COLUMN id RESTART WITH 2");
                } finally {
                    jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
                }
                logger.info("사하점 ID를 1번으로 수정 완료");
            }
            
            // 연산점 생성 (ID 2번) - application.properties에서 설정값 사용
            Facility yeonsanFacility = new Facility();
            yeonsanFacility.setName(yeonsanFacilityName);
            yeonsanFacility.setLocation(yeonsanFacilityLocation);
            yeonsanFacility.setBranch(Facility.Branch.YEONSAN);
            yeonsanFacility.setFacilityType(Facility.FacilityType.ALL);
            yeonsanFacility.setHourlyRate(yeonsanFacilityHourlyRate);
            yeonsanFacility.setOpenTime(LocalTime.parse(yeonsanFacilityOpenTime));
            yeonsanFacility.setCloseTime(LocalTime.parse(yeonsanFacilityCloseTime));
            yeonsanFacility.setActive(true);
            Facility savedYeonsan = facilityRepository.save(yeonsanFacility);
            logger.info("연산점 생성 완료: ID={}", savedYeonsan.getId());
            
            // ID가 2번이 아니면 수정
            if (savedYeonsan.getId() != 2L) {
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
                try {
                    jdbcTemplate.update("UPDATE facilities SET id = 2 WHERE id = ?", savedYeonsan.getId());
                    jdbcTemplate.execute("ALTER TABLE facilities ALTER COLUMN id RESTART WITH 3");
                } finally {
                    jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
                }
                logger.info("연산점 ID를 2번으로 수정 완료");
            }
            
        } catch (Exception e) {
            logger.error("시설 데이터 초기화 중 오류 발생", e);
            throw e;
        }
    }
    
    /** 슬롯이 하나도 없는 시설에 대해 기본 운영시간으로 요일별 슬롯 7건 생성 */
    @Transactional
    public void ensureFacilitySlots() {
        List<Facility> facilities = facilityRepository.findAll();
        for (Facility f : facilities) {
            if (facilitySlotRepository.findByFacilityIdOrderByDayOfWeek(f.getId()).isEmpty()) {
                LocalTime open = f.getOpenTime() != null ? f.getOpenTime() : LocalTime.of(9, 0);
                LocalTime close = f.getCloseTime() != null ? f.getCloseTime() : LocalTime.of(18, 0);
                for (int day = 1; day <= 7; day++) {
                    FacilitySlot slot = new FacilitySlot();
                    slot.setFacility(f);
                    slot.setDayOfWeek(day);
                    slot.setStartTime(open);
                    slot.setEndTime(close);
                    slot.setIsOpen(true);
                    facilitySlotRepository.save(slot);
                }
                logger.info("시설 ID={} 에 기본 슬롯 7건 생성 ({}~{})", f.getId(), open, close);
            }
        }
    }
    
    /**
     * 불필요한 FACILITY_SLOTS_COPY_* 테이블 삭제 (과거 마이그레이션 잔여물, 사용 안 함)
     * INFORMATION_SCHEMA에서 패턴에 맞는 테이블을 찾아 모두 DROP
     */
    private void dropUnusedFacilitySlotsCopyTables() {
        try {
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES " +
                "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME LIKE 'FACILITY_SLOTS_COPY%'"
            );
            for (Map<String, Object> row : tables) {
                String tableName = (String) row.get("TABLE_NAME");
                if (tableName != null && !tableName.isEmpty()) {
                    try {
                        jdbcTemplate.execute("DROP TABLE IF EXISTS \"" + tableName + "\"");
                        logger.info("불필요한 테이블 삭제: {}", tableName);
                    } catch (Exception e) {
                        logger.debug("테이블 {} 삭제 스킵: {}", tableName, e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            logger.debug("FACILITY_SLOTS_COPY 테이블 조회/삭제 중 오류 (무시): {}", e.getMessage());
        }
    }
    
    /**
     * Members 테이블의 guardian_name, guardian_phone 컬럼을 student_name, student_phone으로 변경
     * 보호자 정보 필드를 수강생 정보 필드로 용도 변경
     */
    private void migrateMembersTableColumnNames() {
        try {
            // Members 테이블 존재 여부 확인
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES " +
                "WHERE TABLE_NAME = 'MEMBERS'"
            );
            
            if (!tables.isEmpty()) {
                // guardian_name 컬럼 존재 여부 확인
                List<Map<String, Object>> guardianNameColumns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'MEMBERS' AND COLUMN_NAME = 'GUARDIAN_NAME'"
                );
                
                // student_name 컬럼 존재 여부 확인
                List<Map<String, Object>> studentNameColumns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'MEMBERS' AND COLUMN_NAME = 'STUDENT_NAME'"
                );
                
                // guardian_name이 있고 student_name이 없으면 컬럼명 변경
                if (!guardianNameColumns.isEmpty() && studentNameColumns.isEmpty()) {
                    logger.info("Members 테이블의 guardian_name 컬럼을 student_name으로 변경합니다.");
                    try {
                        // H2에서 컬럼명 변경 (데이터 유지)
                        // H2는 기본적으로 대문자로 저장하므로 소문자로 명시
                        jdbcTemplate.execute("ALTER TABLE MEMBERS ALTER COLUMN GUARDIAN_NAME RENAME TO STUDENT_NAME");
                        logger.info("Members 테이블의 guardian_name 컬럼을 student_name으로 변경 완료");
                    } catch (Exception e) {
                        // 대문자로 실패하면 소문자로 시도
                        try {
                            jdbcTemplate.execute("ALTER TABLE members ALTER COLUMN guardian_name RENAME TO student_name");
                            logger.info("Members 테이블의 guardian_name 컬럼을 student_name으로 변경 완료 (소문자)");
                        } catch (Exception e2) {
                            logger.warn("guardian_name 컬럼명 변경 실패: {} / {}", e.getMessage(), e2.getMessage());
                        }
                    }
                } else if (!studentNameColumns.isEmpty()) {
                    logger.debug("Members 테이블에 student_name 컬럼이 이미 존재합니다.");
                } else {
                    logger.debug("Members 테이블에 guardian_name 컬럼이 없습니다 - Hibernate가 자동으로 생성합니다.");
                }
                
                // guardian_phone 컬럼 존재 여부 확인
                List<Map<String, Object>> guardianPhoneColumns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'MEMBERS' AND COLUMN_NAME = 'GUARDIAN_PHONE'"
                );
                
                // student_phone 컬럼 존재 여부 확인
                List<Map<String, Object>> studentPhoneColumns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'MEMBERS' AND COLUMN_NAME = 'STUDENT_PHONE'"
                );
                
                // guardian_phone이 있고 student_phone이 없으면 컬럼명 변경
                if (!guardianPhoneColumns.isEmpty() && studentPhoneColumns.isEmpty()) {
                    logger.info("Members 테이블의 guardian_phone 컬럼을 student_phone으로 변경합니다.");
                    try {
                        // H2에서 컬럼명 변경 (데이터 유지)
                        // H2는 기본적으로 대문자로 저장하므로 대문자로 명시
                        jdbcTemplate.execute("ALTER TABLE MEMBERS ALTER COLUMN GUARDIAN_PHONE RENAME TO STUDENT_PHONE");
                        logger.info("Members 테이블의 guardian_phone 컬럼을 student_phone으로 변경 완료");
                    } catch (Exception e) {
                        // 대문자로 실패하면 소문자로 시도
                        try {
                            jdbcTemplate.execute("ALTER TABLE members ALTER COLUMN guardian_phone RENAME TO student_phone");
                            logger.info("Members 테이블의 guardian_phone 컬럼을 student_phone으로 변경 완료 (소문자)");
                        } catch (Exception e2) {
                            logger.warn("guardian_phone 컬럼명 변경 실패: {} / {}", e.getMessage(), e2.getMessage());
                        }
                    }
                } else if (!studentPhoneColumns.isEmpty()) {
                    logger.debug("Members 테이블에 student_phone 컬럼이 이미 존재합니다.");
                } else {
                    logger.debug("Members 테이블에 guardian_phone 컬럼이 없습니다 - Hibernate가 자동으로 생성합니다.");
                }
            } else {
                logger.debug("Members 테이블이 존재하지 않습니다 - Hibernate가 자동으로 생성합니다.");
            }
        } catch (Exception e) {
            logger.warn("Members 테이블 컬럼명 마이그레이션 중 오류: {}", e.getMessage());
            // 마이그레이션 실패해도 애플리케이션은 계속 실행되도록 함
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
    
    /**
     * 누락된 결제(Payment) 자동 생성
     * MemberProduct가 있지만 Payment가 없는 경우 자동으로 Payment를 생성하고,
     * COUNT_PASS 이용권은 이용권 구매/종료 이력(MemberProductHistory CHARGE)도 함께 생성합니다.
     *
     * 회원 상세 "연결된 부분" 처리 현황:
     * - 기본 정보: members 테이블 (FK 무관)
     * - 이용권: member_products (FK 수정으로 INSERT 정상)
     * - 결제 내역: payments (FK 수정 + 본 메서드로 누락분 보정)
     * - 예약 내역: bookings (FK 수정으로 INSERT 정상)
     * - 출석 내역: attendances (FK 수정으로 INSERT 정상)
     * - 이용권 구매/종료 이력: member_product_history (FK 수정 + 본 메서드에서 결제 생성 시 CHARGE 이력 추가)
     * - 회원 히스토리/코치 메모: members 컬럼 (FK 무관)
     */
    @Transactional(readOnly = false)
    private void createMissingPayments() {
        try {
            logger.info("누락된 결제 자동 생성 시작");
            
            int totalCreated = 0;
            int totalSkipped = 0;
            int totalErrors = 0;
            
            // 모든 회원 조회
            List<Member> allMembers = memberRepository.findAll();
            logger.info("총 {}명의 회원에 대해 누락된 결제 확인 시작", allMembers.size());
            
            for (Member member : allMembers) {
                try {
                    // 회원의 모든 MemberProduct 조회
                    List<MemberProduct> memberProducts = memberProductRepository.findByMemberId(member.getId());
                    
                    for (MemberProduct memberProduct : memberProducts) {
                        try {
                            // Product 정보 확인 (Lazy Loading 문제 해결을 위해 명시적으로 조회)
                            Product product = null;
                            try {
                                // MemberProduct에서 product_id를 가져와서 직접 조회
                                Long productId = null;
                                try {
                                    // 먼저 프록시로 접근 시도
                                    Product proxyProduct = memberProduct.getProduct();
                                    if (proxyProduct != null) {
                                        productId = proxyProduct.getId();
                                    }
                                } catch (Exception e) {
                                    // 프록시 접근 실패 시 product_id를 직접 조회
                                    // MemberProduct의 product_id 컬럼을 직접 읽기
                                    logger.debug("Product 프록시 접근 실패, 직접 조회 시도: MemberProduct ID={}", 
                                        memberProduct.getId());
                                }
                                
                                // productId가 없으면 건너뜀
                                if (productId == null) {
                                    continue;
                                }
                                
                                // Product를 명시적으로 조회
                                product = productRepository.findById(productId).orElse(null);
                                if (product == null) {
                                    logger.debug("Product를 찾을 수 없음: Product ID={}, MemberProduct ID={}", 
                                        productId, memberProduct.getId());
                                    totalErrors++;
                                    continue;
                                }
                            } catch (Exception e) {
                                logger.debug("Product 조회 실패: MemberProduct ID={}, 오류: {}", 
                                    memberProduct.getId(), e.getMessage());
                                totalErrors++;
                                continue;
                            }
                            
                            if (product == null || product.getPrice() == null || product.getPrice() <= 0) {
                                continue;
                            }
                            
                            Long productId = product.getId();
                            
                            // 이미 결제가 있는지 확인
                            List<Payment> existingPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(
                                member.getId(), productId);
                            
                            if (!existingPayments.isEmpty()) {
                                // 이미 결제가 있으면 건너뜀
                                totalSkipped++;
                                continue;
                            }
                            
                            // 결제 생성
                            Payment payment = new Payment();
                            payment.setMember(member);
                            payment.setProduct(product);
                            payment.setAmount(product.getPrice());
                            payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentMethod());
                            payment.setStatus(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentStatus());
                            payment.setCategory(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentCategory());
                            String productName = product.getName() != null ? 
                                product.getName() : "상품 ID: " + productId;
                            payment.setMemo("상품 할당 (자동 생성): " + productName);
                            
                            // paidAt과 createdAt 설정
                            LocalDateTime purchaseDate = memberProduct.getPurchaseDate();
                            if (purchaseDate == null) {
                                purchaseDate = LocalDateTime.now();
                            }
                            payment.setPaidAt(purchaseDate);
                            payment.setCreatedAt(LocalDateTime.now());
                            
                            // Payment 저장
                            Payment savedPayment = paymentRepository.save(payment);
                            paymentRepository.flush();
                            totalCreated++;
                            
                            // 이용권 구매/종료 이력(충전) 저장 - 결제 내역과 동일하게 처리
                            if (product.getType() == Product.ProductType.COUNT_PASS) {
                                try {
                                    Integer afterRemaining = memberProduct.getRemainingCount() != null ? memberProduct.getRemainingCount() : 0;
                                    Integer totalCount = memberProduct.getTotalCount() != null ? memberProduct.getTotalCount() : (product.getUsageCount() != null ? product.getUsageCount() : 0);
                                    MemberProductHistory history = new MemberProductHistory();
                                    history.setMemberProduct(memberProduct);
                                    history.setMember(member);
                                    history.setPayment(savedPayment);
                                    history.setTransactionDate(LocalDateTime.now());
                                    history.setType(MemberProductHistory.TransactionType.CHARGE);
                                    history.setChangeAmount(totalCount != null ? totalCount : 0);
                                    history.setRemainingCountAfter(afterRemaining);
                                    history.setDescription("상품 할당 (자동 생성): " + productName);
                                    memberProductHistoryRepository.save(history);
                                } catch (Exception histEx) {
                                    logger.debug("이용권 이력 저장 실패 (무시): {}", histEx.getMessage());
                                }
                            }
                            
                            logger.debug("누락된 결제 생성 완료: Payment ID={}, 회원 ID={}, 상품 ID={}, 금액={}", 
                                savedPayment.getId(), member.getId(), productId, product.getPrice());
                        } catch (Exception e) {
                            logger.debug("MemberProduct 처리 중 오류: MemberProduct ID={}, 오류: {}", 
                                memberProduct.getId(), e.getMessage());
                            totalErrors++;
                        }
                    }
                } catch (Exception e) {
                    logger.debug("회원 ID={}의 결제 생성 중 오류: {}", member.getId(), e.getMessage());
                    totalErrors++;
                }
            }
            
            logger.info("누락된 결제 자동 생성 완료: 총 생성={}건, 건너뜀={}건, 오류={}건", 
                totalCreated, totalSkipped, totalErrors);
        } catch (Exception e) {
            logger.error("누락된 결제 자동 생성 중 오류 발생: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 횟수권(COUNT_PASS) 이용권의 remaining_count를 '이미 종료된 예약 수' 기준으로 동기화.
     * 같은 이용권(member_product_id) + 같은 회원·상품 기준 둘 다 반영해 사용 횟수를 세고, 잔여를 맞춤.
     */
    @Transactional(readOnly = false)
    private void syncMemberProductRemainingCountFromEndedBookings() {
        List<MemberProduct> list = memberProductRepository.findAllCountPassWithProductAndMember();
        LocalDateTime now = LocalDateTime.now();
        int updated = 0;
        for (MemberProduct mp : list) {
            try {
                Integer totalCount = mp.getTotalCount();
                if (totalCount == null && mp.getProduct() != null && mp.getProduct().getUsageCount() != null) {
                    totalCount = mp.getProduct().getUsageCount();
                }
                if (totalCount == null || totalCount <= 0) continue;
                long byMp = bookingRepository.countByMemberProductEndedBefore(mp.getId(), now);
                long byMemberProduct = 0;
                if (mp.getMember() != null && mp.getProduct() != null) {
                    byMemberProduct = bookingRepository.countByMemberIdAndProductIdEndedBefore(
                            mp.getMember().getId(), mp.getProduct().getId(), now);
                }
                long endedCount = Math.max(byMp, byMemberProduct);
                int usedCount = (int) Math.min(endedCount, totalCount);
                int newRemaining = Math.max(0, totalCount - usedCount);
                Integer currentRemaining = mp.getRemainingCount();
                // 이미 더 적게 남은 값(수동 보정 등)이 있으면 덮어쓰지 않음. 사용만 늘어난 경우에만 감소 반영
                if (currentRemaining != null && newRemaining > currentRemaining) {
                    continue; // 이력 없이 N회부터 쓴 경우 등 수동 설정 유지
                }
                if (!Objects.equals(currentRemaining, newRemaining)) {
                    int oldRemaining = currentRemaining != null ? currentRemaining : -1;
                    mp.setRemainingCount(newRemaining);
                    memberProductRepository.save(mp);
                    updated++;
                    logger.info("remaining_count 동기화: MemberProduct ID={}, totalCount={}, 사용={}(byMp={}, byMemberProduct={}), remaining {} -> {}",
                            mp.getId(), totalCount, usedCount, byMp, byMemberProduct, oldRemaining, newRemaining);
                }
            } catch (Exception e) {
                logger.debug("MemberProduct ID={} 동기화 중 오류 (무시): {}", mp.getId(), e.getMessage());
            }
        }
        if (updated > 0) {
            logger.info("횟수권 remaining_count 동기화: {}건 수정됨", updated);
        }
    }

    /**
     * Users 테이블에 approved 컬럼 추가 마이그레이션
     * 회원가입 승인 기능을 위한 컬럼 추가
     */
    private void migrateUsersTableApprovedColumn() {
        try {
            // Users 테이블 존재 여부 확인
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES " +
                "WHERE TABLE_NAME = 'USERS'"
            );
            
            if (!tables.isEmpty()) {
                // approved 컬럼 존재 여부 확인 (대소문자 모두 확인)
                boolean columnExists = false;
                try {
                    List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                        "WHERE UPPER(TABLE_NAME) = 'USERS' AND UPPER(COLUMN_NAME) = 'APPROVED'"
                    );
                    columnExists = !columns.isEmpty();
                } catch (Exception e) {
                    logger.debug("컬럼 존재 여부 확인 중 오류 (무시): {}", e.getMessage());
                }
                
                if (!columnExists) {
                    logger.info("Users 테이블에 approved 컬럼이 없습니다. 컬럼을 추가합니다.");
                    
                    // H2 데이터베이스에서 컬럼 추가
                    try {
                        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN approved BOOLEAN DEFAULT TRUE");
                        logger.info("Users 테이블에 approved 컬럼 추가 완료");
                        
                        // 기존 사용자들은 모두 승인된 것으로 설정 (NULL 값만 업데이트)
                        // approved = FALSE인 신규 가입자는 업데이트하지 않음
                        jdbcTemplate.update("UPDATE users SET approved = TRUE WHERE approved IS NULL");
                        logger.info("기존 사용자들을 승인 상태로 업데이트 완료 (NULL 값만 업데이트)");
                    } catch (Exception e) {
                        // 컬럼이 이미 존재하는 경우 무시
                        if (e.getMessage() != null && (e.getMessage().contains("Duplicate column") || 
                            e.getMessage().contains("already exists"))) {
                            logger.info("Users 테이블에 approved 컬럼이 이미 존재합니다. (중복 컬럼 오류 무시)");
                            columnExists = true; // 컬럼이 존재하는 것으로 표시
                        } else {
                            logger.warn("Users 테이블에 approved 컬럼 추가 실패: {}", e.getMessage());
                        }
                    }
                }
                
                // 컬럼이 존재하는 경우 기존 사용자들의 approved 값 업데이트
                if (columnExists) {
                    logger.info("Users 테이블에 approved 컬럼이 이미 존재합니다.");
                    // 기존 사용자 중 approved가 NULL인 경우만 TRUE로 설정
                    // approved = FALSE인 사용자(승인 대기 중인 신규 가입자)는 업데이트하지 않음
                    try {
                        int updated = jdbcTemplate.update("UPDATE users SET approved = TRUE WHERE approved IS NULL");
                        if (updated > 0) {
                            logger.info("기존 사용자 {}명을 승인 상태로 업데이트했습니다. (NULL 값만 업데이트)", updated);
                        }
                    } catch (Exception e) {
                        logger.debug("기존 사용자 승인 상태 업데이트 중 오류 (무시): {}", e.getMessage());
                    }
                }
            } else {
                logger.debug("Users 테이블이 존재하지 않습니다 - Hibernate가 자동으로 생성합니다.");
            }
        } catch (Exception e) {
            logger.warn("Users 테이블 approved 컬럼 마이그레이션 중 오류: {}", e.getMessage());
            // 마이그레이션 실패해도 애플리케이션은 계속 실행되도록 함
        }
    }

    /**
     * 회원 히스토리 추적용 processed_by 컬럼 추가 (members, payments, bookings, attendances, member_product_history)
     */
    private void migrateProcessedByColumns() {
        String[] tableColumnPairs = {
            "members", "processed_by",
            "payments", "processed_by",
            "bookings", "processed_by",
            "attendances", "processed_by",
            "member_product_history", "processed_by"
        };
        for (int i = 0; i < tableColumnPairs.length; i += 2) {
            String tableName = tableColumnPairs[i];
            String columnName = tableColumnPairs[i + 1];
            try {
                List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE UPPER(TABLE_NAME) = ?",
                    tableName.toUpperCase().replace("-", "_")
                );
                if (!tables.isEmpty()) {
                    List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
                        "WHERE UPPER(TABLE_NAME) = ? AND UPPER(COLUMN_NAME) = ?",
                        tableName.toUpperCase().replace("-", "_"),
                        columnName.toUpperCase()
                    );
                    if (columns.isEmpty()) {
                        jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " VARCHAR(50)");
                        logger.info("{} 테이블에 {} 컬럼 추가 완료", tableName, columnName);
                    }
                }
            } catch (Exception e) {
                logger.warn("{} 테이블 {} 컬럼 마이그레이션 중 오류: {}", tableName, columnName, e.getMessage());
            }
        }
    }

    /** 분야별 코치 메모 컬럼 추가 (members) */
    private void migrateCoachMemoByFieldColumns() {
        String[] columns = {"coach_memo_pitcher", "coach_memo_batter", "coach_memo_defense", "coach_memo_catcher"};
        for (String col : columns) {
            try {
                List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE UPPER(TABLE_NAME) = 'MEMBERS'");
                if (!tables.isEmpty()) {
                    List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE UPPER(TABLE_NAME) = 'MEMBERS' AND UPPER(COLUMN_NAME) = ?",
                        col.toUpperCase());
                    if (existing.isEmpty()) {
                        jdbcTemplate.execute("ALTER TABLE members ADD COLUMN " + col + " VARCHAR(1000)");
                        logger.info("members 테이블에 {} 컬럼 추가 완료", col);
                    }
                }
            } catch (Exception e) {
                logger.warn("members {} 컬럼 마이그레이션 중 오류: {}", col, e.getMessage());
            }
        }
    }

    /** 수치별 코치 메모 JSON 컬럼 추가 (members.coach_memo_stats) */
    private void migrateCoachMemoStatsColumn() {
        try {
            List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE UPPER(TABLE_NAME) = 'MEMBERS' AND UPPER(COLUMN_NAME) = 'COACH_MEMO_STATS'");
            if (existing.isEmpty()) {
                jdbcTemplate.execute("ALTER TABLE members ADD COLUMN coach_memo_stats VARCHAR(4000)");
                logger.info("members 테이블에 coach_memo_stats 컬럼 추가 완료");
            }
        } catch (Exception e) {
            logger.warn("coach_memo_stats 컬럼 마이그레이션 중 오류: {}", e.getMessage());
        }
    }

    /**
     * member_id FK를 가진 테이블들 (H2 MEMBERS_COPY_3_1 참조 오류 수정 대상).
     * 애플리케이션 코드는 MEMBERS_COPY_3_1을 참조하지 않으며, JPA는 항상 members 테이블을 사용함.
     * 아래 7개 테이블이 Member 엔티티와 member_id로 연결된 전부이므로, 이 FK 수정으로
     * 이용권 할당·결제·예약·출석·이력·기록 등 관련 기능이 정상 동작함.
     */
    private static final String[] MEMBER_ID_TABLES = {
        "member_products", "payments", "bookings", "attendances",
        "member_product_history", "baseball_records", "training_logs"
    };

    /** 에러 로그에서 확인된 잘못된 FK 제약 이름 (테이블 무관, 제거 시도용) */
    private static final String[] KNOWN_BAD_FK_NAMES = {
        "MEMBERS_COPY_3_1_FKK2BY4CTF2FV2VHFO1MBRTQJP1",
        "MEMBERS_COPY_3_1_FKTVBQ19GRAFF4NNOQPNGBE762",
        "MEMBERS_COPY_3_1_FK2HU43B2W26UM1GQL30WBF0173",  // bookings.member_id
        "MEMBERS_COPY_3_1_FKBPSEF3FSYN2QIAPT3E0B1MIXA",  // member_product_history.member_id
        "MEMBERS_COPY_3_1_FKR7CD1E30648D21VCIF5FGFTTU"   // attendances.member_id
    };

    /**
     * member_id FK가 H2 내부 복사 테이블(MEMBERS_COPY_3_1)을 참조하는 모든 테이블을
     * members(id) 참조로 수정. (member_products, payments, bookings, attendances 등)
     */
    private void fixAllMemberIdForeignKeysToMembers() {
        try {
            jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
            try {
                for (String tableName : MEMBER_ID_TABLES) {
                    fixMemberIdForeignKeyForTable(tableName);
                }
            } finally {
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
            }
        } catch (Exception e) {
            logger.warn("member_id FK 일괄 수정 중 오류: {}", e.getMessage());
            throw e;
        }
    }

    private void fixMemberIdForeignKeyForTable(String tableName) {
        String tableUpper = tableName.toUpperCase();
        try {
            // 1) 알려진 잘못된 제약 이름으로 제거 시도 (여러 개 있을 수 있으므로 모두 시도)
            for (String name : KNOWN_BAD_FK_NAMES) {
                try {
                    jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT \"" + name + "\"");
                    logger.info("{} 잘못된 FK 제거(알려진 이름): {}", tableName, name);
                } catch (Exception e) {
                    try {
                        jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT " + name);
                        logger.info("{} 잘못된 FK 제거(알려진 이름): {}", tableName, name);
                    } catch (Exception e2) {
                        logger.trace("제약 제거 시도 무시: {} - {}", name, e2.getMessage());
                    }
                }
            }
            // 2) INFORMATION_SCHEMA로 해당 테이블의 REFERENTIAL 제약 중 MEMBERS가 아닌 테이블 참조 제거 (또는 이름에 MEMBERS_COPY 포함)
            List<Map<String, Object>> tcList = jdbcTemplate.queryForList(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
                "WHERE UPPER(TABLE_SCHEMA) = 'PUBLIC' AND UPPER(TABLE_NAME) = ? AND UPPER(CONSTRAINT_TYPE) = 'REFERENTIAL'",
                tableUpper
            );
            for (Map<String, Object> tc : tcList) {
                Object cnObj = tc.get("CONSTRAINT_NAME");
                if (cnObj == null) continue;
                String constraintName = cnObj.toString();
                // 이름에 MEMBERS_COPY가 포함된 FK는 무조건 제거 (H2 ALTER TABLE 복사본 참조)
                if (constraintName.toUpperCase().contains("MEMBERS_COPY")) {
                    try {
                        jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT \"" + constraintName + "\"");
                        logger.info("{} MEMBERS_COPY FK 제거(이름 패턴): {}", tableName, constraintName);
                    } catch (Exception e) {
                        try {
                            jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT " + constraintName);
                            logger.info("{} MEMBERS_COPY FK 제거(이름 패턴): {}", tableName, constraintName);
                        } catch (Exception e2) {
                            logger.warn("{} FK 제거 실패: {} - {}", tableName, constraintName, e2.getMessage());
                        }
                    }
                    continue;
                }
                List<Map<String, Object>> refList = jdbcTemplate.queryForList(
                    "SELECT tc2.TABLE_NAME AS REF_TABLE FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc " +
                    "JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc2 ON tc2.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME AND tc2.CONSTRAINT_SCHEMA = rc.UNIQUE_CONSTRAINT_SCHEMA " +
                    "WHERE rc.CONSTRAINT_NAME = ? AND rc.CONSTRAINT_SCHEMA = 'PUBLIC'",
                    constraintName
                );
                if (!refList.isEmpty()) {
                    Object refTable = refList.get(0).get("REF_TABLE");
                    String refTableStr = refTable != null ? refTable.toString() : "";
                    if (!"MEMBERS".equalsIgnoreCase(refTableStr)) {
                        try {
                            jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT \"" + constraintName + "\"");
                            logger.info("{} 잘못된 FK 제거: {} (참조: {})", tableName, constraintName, refTableStr);
                        } catch (Exception e) {
                            try {
                                jdbcTemplate.execute("ALTER TABLE " + tableName + " DROP CONSTRAINT " + constraintName);
                                logger.info("{} 잘못된 FK 제거: {} (참조: {})", tableName, constraintName, refTableStr);
                            } catch (Exception e2) {
                                logger.warn("{} FK 제거 실패 (무시): {} - {}", tableName, constraintName, e2.getMessage());
                            }
                        }
                    }
                }
            }
            // 3) member_id -> members(id) FK가 없으면 추가
            List<Map<String, Object>> existingRefs = jdbcTemplate.queryForList(
                "SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc_child " +
                "JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc ON rc.CONSTRAINT_NAME = tc_child.CONSTRAINT_NAME AND rc.CONSTRAINT_SCHEMA = tc_child.CONSTRAINT_SCHEMA " +
                "JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc_parent ON tc_parent.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME AND tc_parent.CONSTRAINT_SCHEMA = rc.UNIQUE_CONSTRAINT_SCHEMA " +
                "WHERE UPPER(tc_child.TABLE_NAME) = ? AND tc_child.CONSTRAINT_TYPE = 'REFERENTIAL' AND UPPER(tc_parent.TABLE_NAME) = 'MEMBERS'",
                tableUpper
            );
            if (existingRefs.isEmpty()) {
                String fkName = "fk_" + tableName.replace(" ", "_") + "_member";
                jdbcTemplate.execute(
                    "ALTER TABLE " + tableName + " ADD CONSTRAINT " + fkName + " FOREIGN KEY (member_id) REFERENCES members(id)"
                );
                logger.info("{} -> members FK 추가 완료", tableName);
            }
        } catch (Exception e) {
            logger.warn("{} member_id FK 수정 중 오류: {}", tableName, e.getMessage());
        }
    }

    /**
     * 초기 관리자 계정 생성
     * 애플리케이션 시작 시 기본 관리자 계정이 없으면 생성합니다.
     */
    private void initializeDefaultUsers() {
        try {
            // 기본 관리자 계정 생성
            if (!userRepository.existsByUsername("admin")) {
                User admin = new User();
                admin.setUsername("admin");
                String encodedPassword = passwordEncoder.encode(adminInitPassword);
                admin.setPassword(encodedPassword);
                admin.setRole(User.Role.ADMIN);
                admin.setName("관리자");
                admin.setActive(true);
                admin.setApproved(true); // 관리자는 자동 승인
                userRepository.save(admin);
                logger.info("✅ 기본 관리자 계정 생성 완료: username=admin (초기 비밀번호는 설정값 사용)");
                logger.info("암호화된 비밀번호 길이: {}", encodedPassword.length());
            } else {
                logger.info("기본 관리자 계정이 이미 존재합니다.");
                // 기존 계정 확인 및 approved 설정
                userRepository.findByUsername("admin").ifPresent(user -> {
                    if (user.getApproved() == null || !user.getApproved()) {
                        user.setApproved(true);
                        userRepository.save(user);
                        logger.info("기존 관리자 계정을 승인 상태로 업데이트했습니다.");
                    }
                    logger.info("기존 관리자 계정 정보: username={}, role={}, active={}, approved={}", 
                        user.getUsername(), user.getRole(), user.getActive(), user.getApproved());
                });
            }
        } catch (Exception e) {
            logger.error("초기 사용자 계정 생성 중 오류 발생: {}", e.getMessage(), e);
        }
    }
}
