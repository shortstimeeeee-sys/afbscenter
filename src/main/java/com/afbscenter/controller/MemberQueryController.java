package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.Booking;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 회원 조회 전용 (GET by-number, search). URL은 기존과 동일: /api/members/by-number/{memberNumber}, /api/members/search
 */
@RestController
@RequestMapping("/api/members")
public class MemberQueryController {

    private static final Logger logger = LoggerFactory.getLogger(MemberQueryController.class);

    private final MemberRepository memberRepository;
    private final MemberService memberService;
    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberProductRepository memberProductRepository;
    private final PaymentRepository paymentRepository;

    public MemberQueryController(MemberRepository memberRepository,
                                 MemberService memberService,
                                 BookingRepository bookingRepository,
                                 AttendanceRepository attendanceRepository,
                                 MemberProductRepository memberProductRepository,
                                 PaymentRepository paymentRepository) {
        this.memberRepository = memberRepository;
        this.memberService = memberService;
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberProductRepository = memberProductRepository;
        this.paymentRepository = paymentRepository;
    }

    @GetMapping("/by-number/{memberNumber}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMemberByMemberNumber(@PathVariable String memberNumber) {
        try {
            Optional<Member> memberOpt = memberRepository.findByMemberNumber(memberNumber);
            if (memberOpt.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "회원을 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            Member member = memberOpt.get();

            Map<String, Object> memberMap = new HashMap<>();
            memberMap.put("id", member.getId());
            memberMap.put("memberNumber", member.getMemberNumber());
            memberMap.put("name", member.getName());
            memberMap.put("phoneNumber", member.getPhoneNumber());
            memberMap.put("birthDate", member.getBirthDate());
            memberMap.put("gender", member.getGender());
            memberMap.put("grade", member.getGrade());
            memberMap.put("status", member.getStatus());
            memberMap.put("joinDate", member.getJoinDate());
            memberMap.put("lastVisitDate", member.getLastVisitDate());
            memberMap.put("school", member.getSchool());
            memberMap.put("coachMemo", member.getCoachMemo());

            if (member.getCoach() != null) {
                Map<String, Object> coachMap = new HashMap<>();
                coachMap.put("id", member.getCoach().getId());
                coachMap.put("name", member.getCoach().getName());
                memberMap.put("coach", coachMap);
            } else {
                memberMap.put("coach", null);
            }

            List<Booking> bookings = bookingRepository.findByMemberId(member.getId());
            memberMap.put("bookingCount", bookings.size());

            List<Attendance> attendances = attendanceRepository.findByMemberId(member.getId());
            memberMap.put("attendanceCount", attendances.size());

            List<MemberProduct> products = memberProductRepository.findByMemberId(member.getId());
            memberMap.put("productCount", products.size());

            return ResponseEntity.ok(memberMap);
        } catch (Exception e) {
            logger.error("회원 조회 실패 (회원번호: {})", memberNumber, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "회원 조회 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> searchMembers(@RequestParam(required = false) String name,
                                                                   @RequestParam(required = false) String memberNumber,
                                                                   @RequestParam(required = false) String phoneNumber) {
        List<Member> members;
        if (memberNumber != null && !memberNumber.isEmpty()) {
            members = memberService.searchMembersByMemberNumber(memberNumber);
        } else if (phoneNumber != null && !phoneNumber.isEmpty()) {
            members = memberService.searchMembersByPhoneNumber(phoneNumber);
        } else if (name != null && !name.isEmpty()) {
            members = memberService.searchMembersByName(name);
        } else {
            members = memberService.getAllMembers();
        }

        List<com.afbscenter.dto.MemberResponseDTO> memberDTOs = new java.util.ArrayList<>();
        for (Member member : members) {
            try {
                Integer totalPayment = null;
                try {
                    totalPayment = paymentRepository.sumTotalAmountByMemberId(member.getId());
                    if (totalPayment == null) {
                        totalPayment = 0;
                    }
                } catch (Exception e) {
                    logger.warn("결제 금액 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                    totalPayment = 0;
                }

                java.time.LocalDate latestLessonDate = null;
                try {
                    List<Booking> latestLessons = bookingRepository.findLatestLessonByMemberId(member.getId());
                    if (latestLessons != null && !latestLessons.isEmpty()) {
                        latestLessonDate = latestLessons.get(0).getStartTime().toLocalDate();
                    }
                } catch (Exception e) {
                    logger.warn("최근 레슨 날짜 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }

                List<MemberProduct> allMemberProducts = null;
                try {
                    allMemberProducts = memberProductRepository.findByMemberIdWithProduct(member.getId());
                } catch (Exception e) {
                    logger.warn("회원 상품 조회 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                    allMemberProducts = new java.util.ArrayList<>();
                }

                int remainingCount = 0;
                try {
                    if (allMemberProducts != null) {
                        for (MemberProduct mp : allMemberProducts) {
                            try {
                                if (mp.getProduct() == null ||
                                        mp.getProduct().getType() != Product.ProductType.COUNT_PASS ||
                                        mp.getStatus() != MemberProduct.Status.ACTIVE) {
                                    continue;
                                }

                                Integer mpRemainingCount = mp.getRemainingCount();
                                if (mpRemainingCount == null || mpRemainingCount == 0) {
                                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
                                    if (usedCountByAttendance == null) {
                                        usedCountByAttendance = 0L;
                                    }

                                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                                    if (usedCountByBooking == null) {
                                        usedCountByBooking = 0L;
                                    }

                                    Long usedCount = Math.max(usedCountByAttendance, usedCountByBooking);

                                    Integer totalCount = mp.getTotalCount();
                                    if (totalCount == null || totalCount <= 0) {
                                        if (mp.getProduct() != null) {
                                            totalCount = mp.getProduct().getUsageCount();
                                            if (totalCount == null || totalCount <= 0) {
                                                logger.warn("상품의 usageCount가 설정되지 않음: 상품 ID={}, 상품명={}",
                                                        mp.getProduct().getId(), mp.getProduct().getName());
                                                totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                                            }
                                        } else {
                                            totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                                        }
                                    }

                                    if (usedCount == 0) {
                                        mpRemainingCount = totalCount;
                                    } else if (mpRemainingCount == null) {
                                        mpRemainingCount = Math.max(0, totalCount - usedCount.intValue());
                                    }
                                }

                                if (mpRemainingCount != null && mpRemainingCount > 0) {
                                    remainingCount += mpRemainingCount;
                                }
                            } catch (Exception e) {
                                logger.warn("회원 상품 잔여 횟수 계산 실패 (Member ID: {}, MemberProduct ID: {}): {}",
                                        member.getId(), mp.getId(), e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.warn("회원 잔여 횟수 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }

                MemberProduct activePeriodPass = null;
                try {
                    if (allMemberProducts != null) {
                        activePeriodPass = allMemberProducts.stream()
                                .filter(mp -> {
                                    try {
                                        return mp.getProduct() != null &&
                                                mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS &&
                                                mp.getStatus() == MemberProduct.Status.ACTIVE &&
                                                mp.getExpiryDate() != null;
                                    } catch (Exception e) {
                                        return false;
                                    }
                                })
                                .filter(mp -> {
                                    try {
                                        return mp.getExpiryDate().isAfter(java.time.LocalDate.now()) ||
                                                mp.getExpiryDate().isEqual(java.time.LocalDate.now());
                                    } catch (Exception e) {
                                        return false;
                                    }
                                })
                                .findFirst()
                                .orElse(null);
                    }
                } catch (Exception e) {
                    logger.warn("기간권 조회 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }

                com.afbscenter.dto.MemberResponseDTO dto = com.afbscenter.dto.MemberResponseDTO.fromMember(member, totalPayment, latestLessonDate,
                        remainingCount, allMemberProducts, activePeriodPass);
                memberDTOs.add(dto);
            } catch (Exception e) {
                logger.error("회원 DTO 변환 실패 (Member ID: {}): {}",
                        member != null ? member.getId() : "null", e.getMessage(), e);
            }
        }

        List<Map<String, Object>> membersWithTotalPayment = new java.util.ArrayList<>();
        for (com.afbscenter.dto.MemberResponseDTO dto : memberDTOs) {
            try {
                Map<String, Object> memberMap = dto.toMap();
                membersWithTotalPayment.add(memberMap);
            } catch (Exception e) {
                logger.warn("회원 DTO 변환 실패 (Member ID: {}): {}",
                        dto != null ? dto.getId() : "unknown", e.getMessage());
            }
        }

        return ResponseEntity.ok(membersWithTotalPayment);
    }
}
