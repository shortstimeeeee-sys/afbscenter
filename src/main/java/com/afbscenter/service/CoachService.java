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
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

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

    // 코치 삭제
    public void deleteCoach(Long id) {
        if (!coachRepository.existsById(id)) {
            throw new IllegalArgumentException("코치를 찾을 수 없습니다.");
        }
        coachRepository.deleteById(id);
    }

    // 코치별 수강 인원 수 조회
    // 상품 기반: 해당 코치가 담당인 상품을 가진 회원 수
    // 기존 방식도 유지: Member.coach 필드, Booking.coach 필드
    // 비회원 예약도 포함 (확정된 예약만 카운트)
    @Transactional(readOnly = true)
    public Long getStudentCount(Long coachId) {
        try {
            // 코치 존재 여부 확인
            if (coachId == null || !coachRepository.existsById(coachId)) {
                return 0L;
            }
            
            Set<Long> uniqueMemberIds = new HashSet<>();
            int nonMemberBookingCount = 0; // 비회원 예약 수
            
            // 1. MemberProduct.coach_id가 해당 코치인 회원들 조회 (회원 등록 시 선택한 코치)
            // 이것이 가장 정확한 방법: 회원이 실제로 배정받은 코치를 기준으로 카운트
            // 회원의 이용권과 배정된 코치가 정확히 연결되어야 하므로 이것만 사용
            try {
                List<Long> memberProductCoachIds = jdbcTemplate.queryForList(
                    "SELECT DISTINCT mp.member_id FROM member_products mp " +
                    "WHERE mp.coach_id = ? AND mp.status = 'ACTIVE' AND mp.member_id IS NOT NULL",
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
            
            // 2. 비회원 예약 수만 추가 (회원은 MemberProduct.coach_id로만 카운트)
            try {
                Integer nonMemberCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM bookings WHERE coach_id = ? AND status = 'CONFIRMED' AND member_id IS NULL AND non_member_name IS NOT NULL AND non_member_name != ''",
                    Integer.class,
                    coachId
                );
                if (nonMemberCount != null) {
                    nonMemberBookingCount += nonMemberCount;
                }
            } catch (Exception e) {
                logger.warn("비회원 예약 조회 실패 (coachId: {}): {}", coachId, e.getMessage());
            }
            
            // 회원 수 + 비회원 예약 수
            return (long) (uniqueMemberIds.size() + nonMemberBookingCount);
        } catch (Exception e) {
            logger.error("코치별 학생 수 조회 실패 (coachId: {}): {}", coachId, e.getMessage(), e);
            // 모든 예외를 catch하여 0 반환
            return 0L;
        }
    }

    // 코치별 수강 인원 목록 조회
    // 상품 기반: 해당 코치가 담당인 상품을 가진 회원 목록
    // 기존 방식도 유지: Member.coach 필드, Booking.coach 필드
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
                    "WHERE mp.coach_id = ? AND mp.status = 'ACTIVE' AND mp.member_id IS NOT NULL",
                    Long.class,
                    coachId
                );
                
                for (Long memberId : memberProductCoachIds) {
                    if (!uniqueMemberIds.contains(memberId)) {
                        Optional<Member> memberOpt = memberRepository.findById(memberId);
                        if (memberOpt.isPresent()) {
                            uniqueMemberIds.add(memberId);
                            allStudents.add(memberOpt.get());
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
}
