package com.afbscenter.service;

import com.afbscenter.model.Coach;
import com.afbscenter.model.Lesson;
import com.afbscenter.model.Member;
import com.afbscenter.model.Booking;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.LessonRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.BookingRepository;
import org.springframework.beans.factory.annotation.Autowired;
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

    private final CoachRepository coachRepository;
    private final LessonRepository lessonRepository;
    private final MemberRepository memberRepository;
    private final BookingRepository bookingRepository;

    @Autowired
    public CoachService(CoachRepository coachRepository, LessonRepository lessonRepository, MemberRepository memberRepository, BookingRepository bookingRepository) {
        this.coachRepository = coachRepository;
        this.lessonRepository = lessonRepository;
        this.memberRepository = memberRepository;
        this.bookingRepository = bookingRepository;
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
    // Member.coach 필드(담당 코치로 지정된 회원), Lesson.coach 필드(레슨을 받는 회원), Booking.coach 필드(예약에 할당된 코치) 모두 고려
    // 비회원 예약도 포함 (확정된 예약만 카운트)
    @Transactional(readOnly = true)
    public Long getStudentCount(Long coachId) {
        Set<Long> uniqueMemberIds = new HashSet<>();
        int nonMemberBookingCount = 0; // 비회원 예약 수
        
        // 1. Member.coach 필드를 통해 담당 코치로 지정된 회원
        List<Member> membersByCoach = memberRepository.findByCoachId(coachId);
        membersByCoach.forEach(member -> uniqueMemberIds.add(member.getId()));
        
        // 2. Lesson을 통해 레슨을 받는 회원
        List<Lesson> lessons = lessonRepository.findByCoachId(coachId);
        lessons.forEach(lesson -> uniqueMemberIds.add(lesson.getMember().getId()));
        
        // 3. Booking을 통해 예약에 할당된 코치 (회원 + 비회원 모두 포함)
        List<Booking> bookings = bookingRepository.findAll();
        for (Booking booking : bookings) {
            // 예약에 직접 할당된 코치 또는 회원의 코치가 해당 코치인 경우
            boolean isAssignedToThisCoach = false;
            if (booking.getCoach() != null && booking.getCoach().getId().equals(coachId)) {
                isAssignedToThisCoach = true;
            } else if (booking.getMember() != null && booking.getMember().getCoach() != null && 
                      booking.getMember().getCoach().getId().equals(coachId)) {
                isAssignedToThisCoach = true;
            }
            
            if (isAssignedToThisCoach && booking.getStatus() == Booking.BookingStatus.CONFIRMED) {
                if (booking.getMember() != null) {
                    // 회원 예약
                    uniqueMemberIds.add(booking.getMember().getId());
                } else {
                    // 비회원 예약 (nonMemberName이 있는 경우)
                    if (booking.getNonMemberName() != null && !booking.getNonMemberName().trim().isEmpty()) {
                        nonMemberBookingCount++;
                    }
                }
            }
        }
        
        // 회원 수 + 비회원 예약 수
        return (long) (uniqueMemberIds.size() + nonMemberBookingCount);
    }

    // 코치별 수강 인원 목록 조회
    // Member.coach 필드(담당 코치로 지정된 회원), Lesson.coach 필드(레슨을 받는 회원), Booking.coach 필드(예약에 할당된 코치) 모두 고려
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
        
        // 2. Lesson을 통해 레슨을 받는 회원
        List<Lesson> lessons = lessonRepository.findByCoachId(coachId);
        for (Lesson lesson : lessons) {
            Member member = lesson.getMember();
            if (!uniqueMemberIds.contains(member.getId())) {
                uniqueMemberIds.add(member.getId());
                allStudents.add(member);
            }
        }
        
        // 3. Booking을 통해 예약에 할당된 코치 (회원만, 비회원은 수강 인원 수에만 포함)
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
                            System.err.println("Member 조회 실패 (ID: " + booking.getMember().getId() + "): " + ex.getMessage());
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
                System.err.println("Booking 처리 실패 (ID: " + booking.getId() + "): " + e.getMessage());
            }
        }
        
        return allStudents;
    }
}
