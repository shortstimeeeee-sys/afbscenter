package com.afbscenter.service;

import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.Booking;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired
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
    // Member.coach 필드(담당 코치로 지정된 회원), Booking.coach 필드(예약에 할당된 코치) 모두 고려
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
            
            // 1. Member.coach 필드를 통해 담당 코치로 지정된 회원 (JdbcTemplate 사용하여 enum 변환 오류 방지)
            try {
                List<Long> memberIds = jdbcTemplate.queryForList(
                    "SELECT id FROM members WHERE coach_id = ?",
                    Long.class,
                    coachId
                );
                if (memberIds != null) {
                    uniqueMemberIds.addAll(memberIds);
                }
            } catch (Exception e) {
                logger.warn("코치별 회원 조회 실패 (coachId: {}): {}", coachId, e.getMessage());
            }
            
            // 2. Booking을 통해 예약에 할당된 코치 (회원 + 비회원 모두 포함)
            // JdbcTemplate을 사용하여 직접 쿼리 (enum 변환 오류 방지)
            try {
                // 예약에 직접 할당된 코치인 경우
                List<Long> bookingMemberIds = jdbcTemplate.queryForList(
                    "SELECT DISTINCT member_id FROM bookings WHERE coach_id = ? AND status = 'CONFIRMED' AND member_id IS NOT NULL",
                    Long.class,
                    coachId
                );
                if (bookingMemberIds != null) {
                    uniqueMemberIds.addAll(bookingMemberIds);
                }
                
                // 비회원 예약 수 (예약에 직접 할당된 코치이고 member_id가 NULL인 경우)
                Integer nonMemberCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM bookings WHERE coach_id = ? AND status = 'CONFIRMED' AND member_id IS NULL AND non_member_name IS NOT NULL AND non_member_name != ''",
                    Integer.class,
                    coachId
                );
                if (nonMemberCount != null) {
                    nonMemberBookingCount += nonMemberCount;
                }
                
                // 회원의 코치가 해당 코치인 경우 (회원의 coach_id를 통해)
                List<Long> memberCoachIds = jdbcTemplate.queryForList(
                    "SELECT DISTINCT b.member_id FROM bookings b " +
                    "INNER JOIN members m ON b.member_id = m.id " +
                    "WHERE m.coach_id = ? AND b.status = 'CONFIRMED' AND b.member_id IS NOT NULL",
                    Long.class,
                    coachId
                );
                if (memberCoachIds != null) {
                    uniqueMemberIds.addAll(memberCoachIds);
                }
            } catch (Exception e) {
                logger.warn("코치별 예약 조회 실패 (coachId: {}): {}", coachId, e.getMessage());
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
    // Member.coach 필드(담당 코치로 지정된 회원), Booking.coach 필드(예약에 할당된 코치) 모두 고려
    // 비회원 예약도 포함 (확정된 예약만)
    @Transactional(readOnly = true)
    public List<Member> getStudents(Long coachId) {
        Set<Long> uniqueMemberIds = new HashSet<>();
        List<Member> allStudents = new ArrayList<>();
        
        // 1. Member.coach 필드를 통해 담당 코치로 지정된 회원
        List<Member> membersByCoach = memberRepository.findByCoachId(coachId);
        for (Member member : membersByCoach) {
            if (!uniqueMemberIds.contains(member.getId())) {
                uniqueMemberIds.add(member.getId());
                allStudents.add(member);
            }
        }
        
        // 2. Booking을 통해 예약에 할당된 코치 (회원만, 비회원은 수강 인원 수에만 포함)
        // JOIN FETCH를 사용하여 member와 coach를 함께 로드
        List<Booking> bookings = bookingRepository.findAllWithFacilityAndMember();
        for (Booking booking : bookings) {
            try {
                // 예약에 직접 할당된 코치 또는 회원의 코치가 해당 코치인 경우
                boolean isAssignedToThisCoach = false;
                if (booking.getCoach() != null && booking.getCoach().getId().equals(coachId)) {
                    isAssignedToThisCoach = true;
                } else if (booking.getMember() != null) {
                    // member의 coach를 안전하게 로드
                    try {
                        if (booking.getMember().getCoach() != null && 
                            booking.getMember().getCoach().getId().equals(coachId)) {
                            isAssignedToThisCoach = true;
                        }
                    } catch (Exception e) {
                        // lazy loading 실패 시 memberRepository에서 다시 조회
                        try {
                            Optional<Member> memberOpt = memberRepository.findByIdWithCoach(booking.getMember().getId());
                            if (memberOpt.isPresent()) {
                                Member member = memberOpt.get();
                                if (member.getCoach() != null && member.getCoach().getId().equals(coachId)) {
                                    isAssignedToThisCoach = true;
                                }
                            }
                        } catch (Exception ex) {
                            // 조회 실패 시 무시하고 계속 진행
                            // Member 조회 실패 시 무시하고 계속 진행
                        }
                    }
                }
                
                if (isAssignedToThisCoach && booking.getStatus() == Booking.BookingStatus.CONFIRMED) {
                    if (booking.getMember() != null && !uniqueMemberIds.contains(booking.getMember().getId())) {
                        // 회원 예약 (중복 제거)
                        uniqueMemberIds.add(booking.getMember().getId());
                        allStudents.add(booking.getMember());
                    }
                    // 비회원 예약은 목록에는 포함하지 않음 (수강 인원 수에만 포함)
                }
            } catch (Exception e) {
                // 개별 예약 처리 실패 시 무시하고 계속 진행
                // Booking 처리 실패 시 무시하고 계속 진행
            }
        }
        
        return allStudents;
    }
}
