package com.afbscenter.service;

import com.afbscenter.constants.CoachColorPalette;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.Booking;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
public class CoachService {

    private static final Logger logger = LoggerFactory.getLogger(CoachService.class);

    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final BookingRepository bookingRepository;
    private final JdbcTemplate jdbcTemplate;

    // 생성자 주입 (Spring 4.3+에서는 @Autowired 불필요)
    public CoachService(CoachRepository coachRepository, MemberRepository memberRepository, 
                        BookingRepository bookingRepository, JdbcTemplate jdbcTemplate) {
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.bookingRepository = bookingRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    // 코치 생성 (활성 코치와 같은 계열·동일색이 아닌 고유색 자동 할당)
    public Coach createCoach(Coach coach) {
        if (coach.getActive() == null) {
            coach.setActive(true);
        }
        assignUniqueColorIfNeeded(coach, null, true);
        return coachRepository.save(coach);
    }

    // 코치 조회 (ID)
    @Transactional(readOnly = true)
    public Optional<Coach> getCoachById(Long id) {
        return coachRepository.findById(id);
    }

    // 코치 조회 (사용자 ID)
    @Transactional(readOnly = true)
    public Optional<Coach> getCoachByUserId(Long userId) {
        return coachRepository.findByUserId(userId);
    }

    // 전체 코치 조회
    @Transactional(readOnly = true)
    public List<Coach> getAllCoaches() {
        return coachRepository.findAll();
    }

    // 활성 코치만 조회
    @Transactional(readOnly = true)
    public List<Coach> getActiveCoaches() {
        return coachRepository.findByActiveTrue();
    }

    // 코치 수정
    public Coach updateCoach(Long id, Coach updatedCoach) {
        Coach coach = coachRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));

        boolean wasActive = coach.getActive() == null || Boolean.TRUE.equals(coach.getActive());
        coach.setName(updatedCoach.getName());
        coach.setPhoneNumber(updatedCoach.getPhoneNumber());
        coach.setEmail(updatedCoach.getEmail());
        coach.setProfile(updatedCoach.getProfile());
        coach.setSpecialties(updatedCoach.getSpecialties());
        coach.setAvailableTimes(updatedCoach.getAvailableTimes());
        coach.setAvailableBranches(updatedCoach.getAvailableBranches());
        if (updatedCoach.getActive() != null) {
            coach.setActive(updatedCoach.getActive());
        }
        boolean nowActive = coach.getActive() == null || Boolean.TRUE.equals(coach.getActive());
        if (updatedCoach.getColor() != null && !updatedCoach.getColor().trim().isEmpty()) {
            coach.setColor(updatedCoach.getColor().trim());
        }
        // 활성 코치만 계열 충돌 검사. 신규·재활성화는 계열까지 엄격히, 일반 수정은 exact 충돌·비선호 계열만 조정
        if (nowActive) {
            boolean strictFamily = !wasActive
                    || coach.getColor() == null
                    || coach.getColor().trim().isEmpty();
            assignUniqueColorIfNeeded(coach, id, strictFamily);
        } else if (wasActive) {
            // 퇴사(비활성): 목록에서 빠지므로 회원·이용권 담당은 미지정
            unassignCoachFromMembersAndProducts(id);
        }
        return coachRepository.save(coach);
    }

    /**
     * 활성 코치 기준으로 고유색을 보장한다.
     * @param strictFamily true면 같은 색상 계열도 피함(신규·재활성화). false면 exact 충돌만 강제 재할당하고,
     *                     계열 충돌은 선호색이 없을 때만 재할당.
     */
    void assignUniqueColorIfNeeded(Coach coach, Long excludeCoachId, boolean strictFamily) {
        if (coach == null) {
            return;
        }
        Set<String> used = collectActiveUsedColors(excludeCoachId);
        String current = CoachColorPalette.normalizeHex(coach.getColor());
        String preferred = CoachColorPalette.normalizeHex(
                CoachColorPalette.preferredColorForName(coach.getName()));

        if (current != null) {
            boolean exactConflict = CoachColorPalette.exactUsed(current, used);
            boolean familyConflict = CoachColorPalette.conflictsWithUsed(current, used);
            if (!exactConflict) {
                if (!familyConflict) {
                    coach.setColor(current);
                    return;
                }
                // 선호색(알려진 코치)은 계열 겹침을 허용 — 서정훈·공인욱 파랑 등
                if (preferred != null && preferred.equalsIgnoreCase(current)) {
                    coach.setColor(current);
                    return;
                }
                if (!strictFamily) {
                    coach.setColor(current);
                    return;
                }
            }
        }

        if (preferred != null && !CoachColorPalette.exactUsed(preferred, used)) {
            // 선호색은 exact만 유일하면 허용(계열 예외). 신규 자동색은 아래에서 계열까지 회피
            coach.setColor(preferred);
            return;
        }

        String picked = CoachColorPalette.pickUnused(used);
        coach.setColor(picked);
        logger.info("코치 고유색 할당: name={}, color={}, family={}",
                coach.getName(), picked, CoachColorPalette.familyKey(picked));
    }

    /** 근무 중 코치 고유색만 수집. 퇴사 강사 색은 현직과 같은 계열이 아니면 재사용해도 된다. */
    private Set<String> collectActiveUsedColors(Long excludeCoachId) {
        Set<String> used = new HashSet<>();
        for (Coach c : coachRepository.findAll()) {
            if (c == null || c.getColor() == null || c.getColor().trim().isEmpty()) {
                continue;
            }
            if (Boolean.FALSE.equals(c.getActive())) {
                continue;
            }
            if (excludeCoachId != null && excludeCoachId.equals(c.getId())) {
                continue;
            }
            String n = CoachColorPalette.normalizeHex(c.getColor());
            if (n != null) {
                used.add(n);
            }
        }
        return used;
    }

    /**
     * 사용자 계정과 코치 명단 행을 연결합니다. 동일 사용자에 여러 코치가 묶여 있으면 먼저 모두 해제한 뒤 지정 코치에만 연결합니다.
     *
     * @param userId  연결할 사용자 ID
     * @param coachId 코치 명단 ID, null이면 해당 사용자에 대한 연결만 모두 해제
     */
    public Optional<Coach> syncUserCoachLink(Long userId, Long coachId) {
        if (userId == null) {
            throw new IllegalArgumentException("userId는 필수입니다.");
        }
        for (Coach c : coachRepository.findAllByUserId(userId)) {
            c.setUserId(null);
            coachRepository.save(c);
        }
        if (coachId == null) {
            return Optional.empty();
        }
        Coach target = coachRepository.findById(coachId)
                .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
        target.setUserId(userId);
        return Optional.of(coachRepository.save(target));
    }

    /**
     * 코치 삭제: 목록에서 완전히 제거한다.
     * 담당 회원·이용권은 미지정(coach_id NULL). 예약은 남기고 코치만 해제한다.
     */
    public void deleteCoach(Long id) {
        Coach coach = coachRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
        String name = coach.getName();

        int[] cleared = unassignCoachFromMembersAndProducts(id);
        clearCoachFk("bookings", "coach_id", id);
        try {
            jdbcTemplate.update("DELETE FROM coach_work_records WHERE coach_id = ?", id);
        } catch (Exception e) {
            logger.warn("코치 삭제 전 출근 기록 삭제 스킵: {}", e.getMessage());
        }
        try {
            jdbcTemplate.update("DELETE FROM coach_payment_receipts WHERE coach_id = ?", id);
        } catch (Exception e) {
            logger.warn("코치 삭제 전 실제 수령 기록 삭제 스킵: {}", e.getMessage());
        }

        coach.setUserId(null);
        coachRepository.save(coach);
        coachRepository.delete(coach);
        logger.info("코치 삭제: id={}, name={}, 회원 미지정 {}명, 이용권 미지정 {}건",
                id, name, cleared[0], cleared[1]);
    }

    /**
     * 회원 카드·이용권·상품 기본 담당에서 해당 코치를 미지정(NULL)으로 바꾼다.
     * 과거 예약(bookings)은 이력으로 남긴다. 행 삭제 시에만 예약 FK를 별도로 해제한다.
     * @return [회원 수, 이용권 수]
     */
    int[] unassignCoachFromMembersAndProducts(Long coachId) {
        int membersCleared = clearCoachFk("members", "coach_id", coachId);
        int memberProductsCleared = clearCoachFk("member_products", "coach_id", coachId);
        clearCoachFk("products", "coach_id", coachId);
        clearCoachFk("member_approval_requests", "reassignment_new_coach_id", coachId);
        logger.info("코치 담당 미지정 처리: coachId={}, 회원 {}명, 이용권 {}건",
                coachId, membersCleared, memberProductsCleared);
        return new int[] { membersCleared, memberProductsCleared };
    }

    private int clearCoachFk(String table, String column, Long coachId) {
        try {
            return jdbcTemplate.update(
                    "UPDATE " + table + " SET " + column + " = NULL WHERE " + column + " = ?",
                    coachId);
        } catch (Exception e) {
            logger.warn("코치 삭제 전 {}.{} 해제 스킵: {}", table, column, e.getMessage());
            return 0;
        }
    }

    // 코치별 수강 인원 수 조회 (getStudents 목록과 동일 기준: 해당 코치가 배정된 활성 이용권 보유 회원 수만)
    // - 회원만 집계. 비회원 예약은 포함하지 않음 (비회원 예약은 예약 수(건수)에만 반영됨).
    // - MEMBER_PRODUCTS에서 해당 코치(coach_id)로 배정된 활성(ACTIVE) 이용권을 가진 회원 수 (동일 회원 1명으로 집계)
    @Transactional(readOnly = true)
    public Long getStudentCount(Long coachId) {
        try {
            if (coachId == null || !coachRepository.existsById(coachId)) {
                return 0L;
            }
            Set<Long> uniqueMemberIds = new HashSet<>();

            // 해당 코치가 배정된 활성 이용권을 보유한 회원 수 (DISTINCT member_id → 1인 1명)
            try {
                List<Long> memberProductCoachIds = jdbcTemplate.queryForList(
                    "SELECT DISTINCT mp.member_id FROM member_products mp " +
                    "WHERE mp.coach_id = ? AND mp.status = 'ACTIVE' AND mp.member_id IS NOT NULL " +
                    "AND mp.deleted_at IS NULL",
                    Long.class,
                    coachId
                );
                if (memberProductCoachIds != null) {
                    uniqueMemberIds.addAll(memberProductCoachIds);
                    logger.debug("MemberProduct 코치 기반 회원 수: {}명 (코치 ID: {})", memberProductCoachIds.size(), coachId);
                }
            } catch (Exception e) {
                logger.warn("MemberProduct 코치별 회원 조회 실패 (coachId: {}): {}", coachId, e.getMessage());
            }

            return (long) uniqueMemberIds.size();
        } catch (Exception e) {
            logger.error("코치별 학생 수 조회 실패 (coachId: {}): {}", coachId, e.getMessage(), e);
            return 0L;
        }
    }

    // 코치별 수강 인원 목록 조회 (getStudentCount와 동일 기준: 해당 코치가 배정된 활성 이용권 보유 회원)
    @Transactional(readOnly = true)
    public List<Member> getStudents(Long coachId) {
        try {
            // 코치 존재 여부 확인
            if (coachId == null || !coachRepository.existsById(coachId)) {
                logger.warn("코치 ID가 유효하지 않습니다: {}", coachId);
                return new ArrayList<>();
            }
            
            Set<Long> uniqueMemberIds = new HashSet<>();
            List<Member> allStudents = new ArrayList<>();
            
            // 1. MemberProduct.coach_id가 해당 코치인 회원 목록 (회원 등록 시 선택한 코치)
            // 회원의 이용권과 배정된 코치가 정확히 연결되어야 하므로 이것만 사용
            try {
                List<Long> memberProductCoachIds = jdbcTemplate.queryForList(
                    "SELECT DISTINCT mp.member_id FROM member_products mp " +
                    "WHERE mp.coach_id = ? AND mp.status = 'ACTIVE' AND mp.member_id IS NOT NULL " +
                    "AND mp.deleted_at IS NULL",
                    Long.class,
                    coachId
                );
                
                List<Long> idsToLoad = memberProductCoachIds.stream()
                        .filter(id -> !uniqueMemberIds.contains(id))
                        .distinct()
                        .toList();
                if (!idsToLoad.isEmpty()) {
                    List<Member> loaded = memberRepository.findAllById(idsToLoad);
                    for (Member m : loaded) {
                        if (m != null && m.getId() != null) {
                            uniqueMemberIds.add(m.getId());
                            allStudents.add(m);
                        }
                    }
                }
                logger.debug("MemberProduct 코치 기반 회원 수: {}명 (코치 ID: {})", memberProductCoachIds.size(), coachId);
            } catch (Exception e) {
                logger.warn("MemberProduct 코치별 회원 조회 실패 (coachId: {}): {}", coachId, e.getMessage());
            }
            
            logger.info("코치 {} 수강 인원: {}명", coachId, allStudents.size());
            return allStudents;
        } catch (Exception e) {
            logger.error("코치 수강 인원 조회 중 오류 발생 (coachId: {}): {}", coachId, e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    /**
     * 코치별 수강 인원(회원) + 해당 코치 비회원 예약을 합친 목록.
     * 각 항목에 type: "MEMBER" | "NON_MEMBER", id, name, phoneNumber, grade, school 포함.
     * 수강 인원 모달에서 회원/비회원 구분 컬럼 표시용.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getStudentsWithNonMembers(Long coachId) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (coachId == null || !coachRepository.existsById(coachId)) {
            return result;
        }
        for (Member m : getStudents(coachId)) {
            Map<String, Object> row = new HashMap<>();
            row.put("type", "MEMBER");
            row.put("id", m.getId());
            row.put("memberNumber", m.getMemberNumber());
            row.put("name", m.getName());
            row.put("phoneNumber", m.getPhoneNumber());
            row.put("grade", m.getGrade() != null ? m.getGrade().toString() : null);
            row.put("school", m.getSchool());
            result.add(row);
        }
        List<Booking> nonMemberBookings = bookingRepository.findByCoachIdAndMemberIsNull(coachId);
        for (Booking b : nonMemberBookings) {
            Map<String, Object> row = new HashMap<>();
            row.put("type", "NON_MEMBER");
            row.put("id", b.getId()); // 예약 ID (회원 상세 링크 없음)
            row.put("memberNumber", null);
            row.put("name", b.getNonMemberName() != null ? b.getNonMemberName() : "-");
            row.put("phoneNumber", b.getNonMemberPhone() != null ? b.getNonMemberPhone() : "-");
            row.put("grade", null);
            row.put("school", null);
            result.add(row);
        }
        logger.info("코치 {} 수강 인원(회원+비회원): {}명", coachId, result.size());
        return result;
    }
}
