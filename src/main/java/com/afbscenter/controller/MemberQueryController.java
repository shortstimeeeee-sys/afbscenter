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
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.UserRepository;
import com.afbscenter.service.MemberService;
import com.afbscenter.model.Coach;
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
import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDate;
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
    private final UserRepository userRepository;
    private final CoachRepository coachRepository;

    public MemberQueryController(MemberRepository memberRepository,
                                 MemberService memberService,
                                 BookingRepository bookingRepository,
                                 AttendanceRepository attendanceRepository,
                                 MemberProductRepository memberProductRepository,
                                 PaymentRepository paymentRepository,
                                 UserRepository userRepository,
                                 CoachRepository coachRepository) {
        this.memberRepository = memberRepository;
        this.memberService = memberService;
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberProductRepository = memberProductRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.coachRepository = coachRepository;
    }

    private Optional<Long> resolveCoachIdFromRequest(HttpServletRequest request) {
        if (request == null) return Optional.empty();
        String username = (String) request.getAttribute("username");
        if (username == null || username.trim().isEmpty()) return Optional.empty();
        return userRepository.findByUsername(username.trim())
                .flatMap(u -> coachRepository.findByUserId(u.getId()))
                .map(Coach::getId);
    }

    @GetMapping("/by-number/{memberNumber}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMemberByMemberNumber(@PathVariable String memberNumber, HttpServletRequest request) {
        try {
            Optional<Member> memberOpt = memberRepository.findByMemberNumber(memberNumber);
            if (memberOpt.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "회원을 찾을 수 없습니다.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
            }

            Member member = memberOpt.get();
            String role = request != null ? (String) request.getAttribute("role") : null;
            if ("COACH".equalsIgnoreCase(role)) {
                Optional<Long> coachIdOpt = resolveCoachIdFromRequest(request);
                Long memberCoachId = member.getCoach() != null ? member.getCoach().getId() : null;
                if (coachIdOpt.isEmpty() || memberCoachId == null || !coachIdOpt.get().equals(memberCoachId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }

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
            memberMap.put("coachMemoPitcher", member.getCoachMemoPitcher());
            memberMap.put("coachMemoBatter", member.getCoachMemoBatter());
            memberMap.put("coachMemoDefense", member.getCoachMemoDefense());
            memberMap.put("coachMemoCatcher", member.getCoachMemoCatcher());
            memberMap.put("coachMemoStats", member.getCoachMemoStats());

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
                                                                   @RequestParam(required = false) String phoneNumber,
                                                                   HttpServletRequest request) {
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

        String role = request != null ? (String) request.getAttribute("role") : null;
        if ("COACH".equalsIgnoreCase(role)) {
            Optional<Long> coachIdOpt = resolveCoachIdFromRequest(request);
            if (coachIdOpt.isEmpty()) {
                members = new java.util.ArrayList<>();
            } else {
                Long myCoachId = coachIdOpt.get();
                members = members.stream()
                        .filter(m -> m != null && m.getCoach() != null && myCoachId.equals(m.getCoach().getId()))
                        .collect(java.util.stream.Collectors.toList());
            }
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
                        java.time.LocalDateTime start = latestLessons.get(0).getStartTime();
                        latestLessonDate = start != null ? start.toLocalDate() : null;
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
                java.util.Map<Long, Integer> remainingOverrideByProductId = new java.util.HashMap<>();
                final LocalDate today = LocalDate.now();
                try {
                    if (allMemberProducts != null) {
                        for (MemberProduct mp : allMemberProducts) {
                            try {
                                if (mp.getProduct() == null ||
                                        mp.getProduct().getType() != Product.ProductType.COUNT_PASS ||
                                        mp.getStatus() != MemberProduct.Status.ACTIVE) {
                                    continue;
                                }
                                if (mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) {
                                    continue;
                                }
                                int displayRem = com.afbscenter.util.MemberProductCountPassHelper.resolveRemainingForRead(
                                        mp, member.getId(), attendanceRepository, bookingRepository);
                                remainingOverrideByProductId.put(mp.getId(), displayRem);
                                remainingCount += displayRem;
                            } catch (Exception e) {
                                logger.warn("회원 상품 잔여 횟수 계산 실패 (Member ID: {}, MemberProduct ID: {}): {}",
                                        member.getId(), mp != null ? mp.getId() : "null", e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.warn("회원 잔여 횟수 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }
                try {
                    if (allMemberProducts != null) {
                        for (MemberProduct mp : allMemberProducts) {
                            if (mp.getStatus() != MemberProduct.Status.ACTIVE) continue;
                            if (mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) continue;
                            if (mp.getProduct() == null || mp.getProduct().getType() != Product.ProductType.TEAM_PACKAGE) continue;
                            String json = mp.getPackageItemsRemaining();
                            if (json == null || json.trim().isEmpty()) continue;
                            try {
                                com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                                java.util.List<Map<String, Object>> items = om.readValue(json,
                                    new com.fasterxml.jackson.core.type.TypeReference<java.util.List<Map<String, Object>>>() {});
                                int sum = 0;
                                for (Map<String, Object> item : items) {
                                    Object r = item.get("remaining");
                                    if (r instanceof Number) sum += ((Number) r).intValue();
                                }
                                remainingOverrideByProductId.put(mp.getId(), sum);
                                remainingCount += sum;
                            } catch (Exception e) {
                                logger.debug("패키지 잔여 합산 스킵 (MemberProduct ID={}): {}", mp.getId(), e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.warn("패키지 잔여 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
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
                        remainingCount, allMemberProducts, activePeriodPass, remainingOverrideByProductId);
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
