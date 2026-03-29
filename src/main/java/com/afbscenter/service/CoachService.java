package com.afbscenter.service;

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

    // 코치 생성
    public Coach createCoach(Coach coach) {
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
        
        coach.setName(updatedCoach.getName());
        coach.setPhoneNumber(updatedCoach.getPhoneNumber());
        coach.setEmail(updatedCoach.getEmail());
        coach.setProfile(updatedCoach.getProfile());
        coach.setSpecialties(updatedCoach.getSpecialties());
        coach.setAvailableTimes(updatedCoach.getAvailableTimes());
        coach.setAvailableBranches(updatedCoach.getAvailableBranches()); // 배정 지점 업데이트 추가
        if (updatedCoach.getActive() != null) {
            coach.setActive(updatedCoach.getActive());
        }
        
        return coachRepository.save(coach);
    }

    // 코치 삭제 → 실제 삭제 대신 비활성(퇴사 처리)로 변경
    public void deleteCoach(Long id) {
        Coach coach = coachRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
        // 이미 비활성인 경우에도 에러 없이 한 번 더 호출 가능
        coach.setActive(false);
        coachRepository.save(coach);
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
