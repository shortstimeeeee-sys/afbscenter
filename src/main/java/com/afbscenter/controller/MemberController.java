package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Payment;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.service.MemberService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/members")
@CrossOrigin(origins = "http://localhost:8080")
public class MemberController {

    private static final Logger logger = LoggerFactory.getLogger(MemberController.class);

    @Autowired
    private MemberService memberService;
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private CoachRepository coachRepository;
    
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private MemberProductRepository memberProductRepository;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Autowired
    private BookingRepository bookingRepository;
    
    @Autowired
    private AttendanceRepository attendanceRepository;
    
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllMembers() {
        try {
            List<Member> members = memberService.getAllMembers();
            
            // 각 회원의 누적 결제 금액을 계산해서 Map으로 변환
            List<Map<String, Object>> membersWithTotalPayment = members.stream().map(member -> {
                Map<String, Object> memberMap = new HashMap<>();
                memberMap.put("id", member.getId());
                memberMap.put("memberNumber", member.getMemberNumber());
                memberMap.put("name", member.getName());
                memberMap.put("phoneNumber", member.getPhoneNumber());
                memberMap.put("birthDate", member.getBirthDate());
                memberMap.put("gender", member.getGender());
                memberMap.put("height", member.getHeight());
                memberMap.put("weight", member.getWeight());
                memberMap.put("address", member.getAddress());
                memberMap.put("memo", member.getMemo());
                
                // grade 필드 안전하게 읽기 (enum 변환 오류 처리)
                try {
                    memberMap.put("grade", member.getGrade());
                } catch (Exception e) {
                    logger.warn("회원 등급 읽기 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                    // 기본값으로 SOCIAL 설정
                    memberMap.put("grade", "SOCIAL");
                }
                
                memberMap.put("status", member.getStatus());
            memberMap.put("joinDate", member.getJoinDate());
            memberMap.put("lastVisitDate", member.getLastVisitDate());
            memberMap.put("coachMemo", member.getCoachMemo());
            memberMap.put("guardianName", member.getGuardianName());
            memberMap.put("guardianPhone", member.getGuardianPhone());
            memberMap.put("school", member.getSchool());
            memberMap.put("createdAt", member.getCreatedAt());
            memberMap.put("updatedAt", member.getUpdatedAt());
            
            // 코치 정보
            if (member.getCoach() != null) {
                Map<String, Object> coachMap = new HashMap<>();
                coachMap.put("id", member.getCoach().getId());
                coachMap.put("name", member.getCoach().getName());
                memberMap.put("coach", coachMap);
            } else {
                memberMap.put("coach", null);
            }
            
            // 누적 결제 금액 계산
            Integer totalPayment = paymentRepository.sumTotalAmountByMemberId(member.getId());
            memberMap.put("totalPayment", totalPayment != null ? totalPayment : 0);
            
            // 최근 레슨 날짜 계산 (확정된 레슨 예약 중 가장 최근)
            java.time.LocalDate latestLessonDate = null;
            List<com.afbscenter.model.Booking> latestLessons = bookingRepository.findLatestLessonByMemberId(member.getId());
            if (!latestLessons.isEmpty()) {
                latestLessonDate = latestLessons.get(0).getStartTime().toLocalDate();
            }
            memberMap.put("latestLessonDate", latestLessonDate);
            
            // 횟수권 남은 횟수 계산 (실제 예약/출석 기록 기반으로 정확하게 계산)
            int remainingCount = 0;
            List<MemberProduct> countPassProducts = memberProductRepository.findActiveCountPassByMemberId(member.getId());
            
            for (MemberProduct mp : countPassProducts) {
                // 총 횟수: totalCount 또는 product.usageCount
                Integer totalCount = mp.getTotalCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = mp.getProduct().getUsageCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = 10; // 기본값
                    }
                }
                
                // 실제 사용된 횟수 계산
                // 출석 기록이 있는 예약은 출석 기록으로 카운트, 출석 기록이 없는 예약은 예약으로 카운트
                // countConfirmedBookingsByMemberProductId는 이미 출석 기록이 없는 예약만 카운트함
                Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                if (usedCountByBooking == null) {
                    usedCountByBooking = 0L;
                }
                
                Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
                if (usedCountByAttendance == null) {
                    usedCountByAttendance = 0L;
                }
                
                // 출석 기록 + 출석 기록이 없는 예약 = 실제 사용 횟수 (중복 없음)
                Long actualUsedCount = usedCountByAttendance + usedCountByBooking;
                
                // 잔여 횟수 = 총 횟수 - 실제 사용된 횟수
                Integer mpRemainingCount = totalCount - actualUsedCount.intValue();
                if (mpRemainingCount < 0) {
                    mpRemainingCount = 0; // 음수 방지
                }
                
                remainingCount += mpRemainingCount;
                
                logger.debug("회원 목록 - MemberProduct ID={}, 총 횟수={}, 예약 사용(출석없는)={}, 출석 사용={}, 실제 사용={}, 잔여={}", 
                    mp.getId(), totalCount, usedCountByBooking, usedCountByAttendance, actualUsedCount, mpRemainingCount);
            }
            
            // memberProduct가 없는 확정된 레슨 예약/출석도 차감 (첫 번째 활성 횟수권에서 차감)
            // countConfirmedLessonsWithoutMemberProduct는 이미 출석 기록이 없는 예약만 카운트함
            Long unassignedConfirmedLessons = bookingRepository.countConfirmedLessonsWithoutMemberProduct(member.getId());
            if (unassignedConfirmedLessons == null) {
                unassignedConfirmedLessons = 0L;
            }
            
            Long unassignedAttendancesCount = attendanceRepository.countCheckedInAttendancesWithoutMemberProduct(member.getId());
            if (unassignedAttendancesCount == null) {
                unassignedAttendancesCount = 0L;
            }
            
            // 출석 기록 + 출석 기록이 없는 예약 = 실제 사용 횟수 (중복 없음)
            Long unassignedCount = unassignedAttendancesCount + unassignedConfirmedLessons;
            
            if (unassignedCount > 0 && !countPassProducts.isEmpty()) {
                // 첫 번째 활성 횟수권에서 차감
                int unassignedCountInt = unassignedCount.intValue();
                if (remainingCount >= unassignedCountInt) {
                    remainingCount -= unassignedCountInt;
                } else {
                    remainingCount = 0; // 음수 방지
                }
                logger.debug("회원 목록 - memberProduct 없는 사용: 예약(출석없는)={}, 출석={}, 실제 차감={}, 잔여={}", 
                    unassignedConfirmedLessons, unassignedAttendancesCount, unassignedCountInt, remainingCount);
            }
            
            memberMap.put("remainingCount", remainingCount);
            
            return memberMap;
        }).collect(Collectors.toList());
        
            return ResponseEntity.ok(membersWithTotalPayment);
        } catch (Exception e) {
            logger.error("회원 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 회원번호로 회원 조회
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
            
            // 회원 정보를 Map으로 변환
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
            
            // 코치 정보
            if (member.getCoach() != null) {
                Map<String, Object> coachMap = new HashMap<>();
                coachMap.put("id", member.getCoach().getId());
                coachMap.put("name", member.getCoach().getName());
                memberMap.put("coach", coachMap);
            } else {
                memberMap.put("coach", null);
            }
            
            // 예약 내역 수
            List<Booking> bookings = bookingRepository.findByMemberId(member.getId());
            memberMap.put("bookingCount", bookings.size());
            
            // 출석 내역 수
            List<Attendance> attendances = attendanceRepository.findByMemberId(member.getId());
            memberMap.put("attendanceCount", attendances.size());
            
            // 이용권 수
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

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMemberById(@PathVariable Long id) {
        try {
            Optional<Member> memberOpt = memberRepository.findById(id);
            if (memberOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Member member = memberOpt.get();
            
            // Map으로 변환하여 안전하게 직렬화
            Map<String, Object> memberMap = new HashMap<>();
            memberMap.put("id", member.getId());
            memberMap.put("memberNumber", member.getMemberNumber());
            memberMap.put("name", member.getName());
            memberMap.put("phoneNumber", member.getPhoneNumber());
            memberMap.put("birthDate", member.getBirthDate());
            memberMap.put("gender", member.getGender());
            memberMap.put("height", member.getHeight());
            memberMap.put("weight", member.getWeight());
            memberMap.put("address", member.getAddress());
            memberMap.put("memo", member.getMemo());
            memberMap.put("grade", member.getGrade());
            
            memberMap.put("status", member.getStatus());
            memberMap.put("joinDate", member.getJoinDate());
            memberMap.put("lastVisitDate", member.getLastVisitDate());
            memberMap.put("coachMemo", member.getCoachMemo());
            memberMap.put("guardianName", member.getGuardianName());
            memberMap.put("guardianPhone", member.getGuardianPhone());
            memberMap.put("school", member.getSchool());
            memberMap.put("createdAt", member.getCreatedAt());
            memberMap.put("updatedAt", member.getUpdatedAt());
            
            // 코치 정보 안전하게 로드
            if (member.getCoach() != null) {
                try {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", member.getCoach().getId());
                    coachMap.put("name", member.getCoach().getName());
                    memberMap.put("coach", coachMap);
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패 (회원 ID: {}): {}", id, e.getMessage());
                    memberMap.put("coach", null);
                }
            } else {
                memberMap.put("coach", null);
            }
            
            // memberProducts를 안전하게 로드 (JOIN FETCH 사용)
            List<Map<String, Object>> memberProductsList = new java.util.ArrayList<>();
            try {
                List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdWithProduct(id);
                if (memberProducts != null && !memberProducts.isEmpty()) {
                    for (MemberProduct mp : memberProducts) {
                        try {
                            Map<String, Object> mpMap = new HashMap<>();
                            mpMap.put("id", mp.getId());
                            mpMap.put("purchaseDate", mp.getPurchaseDate());
                            mpMap.put("expiryDate", mp.getExpiryDate());
                            mpMap.put("remainingCount", mp.getRemainingCount());
                            mpMap.put("totalCount", mp.getTotalCount());
                            mpMap.put("status", mp.getStatus() != null ? mp.getStatus().name() : null);
                            
                            // Product 정보 안전하게 로드
                            if (mp.getProduct() != null) {
                                Map<String, Object> productMap = new HashMap<>();
                                productMap.put("id", mp.getProduct().getId());
                                productMap.put("name", mp.getProduct().getName());
                                productMap.put("type", mp.getProduct().getType() != null ? mp.getProduct().getType().name() : null);
                                productMap.put("price", mp.getProduct().getPrice());
                                mpMap.put("product", productMap);
                                // productId도 추가 (프론트엔드 호환성)
                                mpMap.put("productId", mp.getProduct().getId());
                            } else {
                                mpMap.put("product", null);
                                mpMap.put("productId", null);
                            }
                            
                            memberProductsList.add(mpMap);
                        } catch (Exception e) {
                            logger.warn("MemberProduct 직렬화 실패 (MemberProduct ID: {}): {}", 
                                (mp != null ? mp.getId() : "null"), e.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                logger.warn("MemberProducts 로드 실패 (회원 ID: {}): {}", id, e.getMessage(), e);
            }
            
            memberMap.put("memberProducts", memberProductsList);
            
            return ResponseEntity.ok(memberMap);
        } catch (Exception e) {
            logger.error("회원 조회 중 오류 발생 (회원 ID: {})", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원이 보유한 상품 목록 조회 (실제 예약 데이터 기반 잔여 횟수 계산)
    @GetMapping("/{memberId}/products")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberProducts(@PathVariable Long memberId) {
        try {
            // memberId 유효성 검사
            if (memberId == null) {
                logger.warn("회원 ID가 null입니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // 회원 존재 여부 확인
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // JOIN FETCH를 사용하여 product와 member를 함께 로드 (lazy loading 방지)
            // 모든 상태의 상품 포함 (ACTIVE, EXPIRED, USED_UP 모두)
            // 필터링 없이 모든 MemberProduct 반환
            List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
            
            logger.info("회원 상품 목록 조회 시작: 회원 ID={}, 조회된 MemberProduct 개수={}", memberId, memberProducts != null ? memberProducts.size() : 0);
            
            // 각 상품에 대해 실제 예약 데이터 기반 잔여 횟수 계산
            List<Map<String, Object>> productsWithRemainingCount = new java.util.ArrayList<>();
            
            if (memberProducts == null || memberProducts.isEmpty()) {
                logger.warn("회원 상품 목록이 비어있습니다. 회원 ID={}", memberId);
                return ResponseEntity.ok(new java.util.ArrayList<>());
            }
            
            // 각 상품 상세 정보 로그 (중복 확인용)
            logger.info("회원 상품 상세 목록 (MemberProduct ID 기준):");
            for (MemberProduct mp : memberProducts) {
                logger.info("  - MemberProduct ID={}, Product ID={}, Product Name={}, Status={}, Purchase Date={}, Price={}", 
                        mp.getId(), 
                        mp.getProduct() != null ? mp.getProduct().getId() : "null",
                        mp.getProduct() != null ? mp.getProduct().getName() : "null",
                        mp.getStatus(),
                        mp.getPurchaseDate(),
                        mp.getProduct() != null ? mp.getProduct().getPrice() : "null");
                Map<String, Object> productMap = new java.util.HashMap<>();
                productMap.put("id", mp.getId());
                productMap.put("purchaseDate", mp.getPurchaseDate());
                productMap.put("expiryDate", mp.getExpiryDate());
                productMap.put("totalCount", mp.getTotalCount());
                productMap.put("status", mp.getStatus().name());
                productMap.put("product", mp.getProduct());
                
                // 실제 구매 금액 찾기 (MemberProduct 구매 시 결제 기록)
                Integer actualPurchasePrice = null;
                if (mp.getProduct() != null) {
                    java.time.LocalDateTime purchaseDate = mp.getPurchaseDate() != null ? mp.getPurchaseDate() : java.time.LocalDateTime.now();
                    
                    // 구매일 전후 7일 범위 내의 결제 기록 찾기
                    java.time.LocalDateTime startDate = purchaseDate.minusDays(7);
                    java.time.LocalDateTime endDate = purchaseDate.plusDays(7);
                    
                    List<Payment> purchasePayments = paymentRepository.findPurchasePaymentByMemberAndProductInRange(
                            memberId,
                            mp.getProduct().getId(),
                            startDate,
                            endDate
                    );
                    
                    if (purchasePayments != null && !purchasePayments.isEmpty()) {
                        // 구매일과 가장 가까운 결제 기록 찾기 (환불 금액 제외)
                        Payment closestPayment = null;
                        long minTimeDiff = Long.MAX_VALUE;
                        
                        for (Payment payment : purchasePayments) {
                            if (payment.getRefundAmount() == null || payment.getRefundAmount() == 0) {
                                long timeDiff = Math.abs(java.time.Duration.between(payment.getPaidAt(), purchaseDate).toMillis());
                                if (timeDiff < minTimeDiff) {
                                    minTimeDiff = timeDiff;
                                    closestPayment = payment;
                                }
                            }
                        }
                        
                        if (closestPayment != null) {
                            actualPurchasePrice = closestPayment.getAmount();
                        }
                    }
                    
                    // 범위 내에서 찾지 못하면 구매일 이전의 모든 결제 기록에서 찾기
                    if (actualPurchasePrice == null) {
                        List<Payment> beforePayments = paymentRepository.findPurchasePaymentByMemberAndProductBefore(
                                memberId,
                                mp.getProduct().getId(),
                                purchaseDate
                        );
                        
                        if (beforePayments != null && !beforePayments.isEmpty()) {
                            // 구매일 이전의 가장 최근 결제 기록 사용 (환불 금액 제외)
                            for (Payment payment : beforePayments) {
                                if (payment.getRefundAmount() == null || payment.getRefundAmount() == 0) {
                                    actualPurchasePrice = payment.getAmount();
                                    break;
                                }
                            }
                        }
                    }
                    
                    // 구매 결제 기록이 없으면 상품 기본 가격 사용
                    if (actualPurchasePrice == null) {
                        actualPurchasePrice = mp.getProduct().getPrice();
                    }
                }
                productMap.put("actualPurchasePrice", actualPurchasePrice);
                
                // member는 순환 참조 방지를 위해 제외 (이미 memberId로 조회 중)
                
                // 횟수권인 경우 실제 예약 데이터 기반 잔여 횟수 계산
                if (mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                    // 총 횟수: totalCount 또는 product.usageCount
                    Integer totalCount = mp.getTotalCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = mp.getProduct().getUsageCount();
                        if (totalCount == null || totalCount <= 0) {
                            totalCount = 10; // 기본값
                        }
                    }
                    
                    // 실제 사용된 횟수 계산
                    // 출석 기록이 있는 예약은 출석 기록으로 카운트, 출석 기록이 없는 예약은 예약으로 카운트
                    // countConfirmedBookingsByMemberProductId는 이미 출석 기록이 없는 예약만 카운트함
                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                    if (usedCountByBooking == null) {
                        usedCountByBooking = 0L;
                    }
                    
                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(memberId, mp.getId());
                    if (usedCountByAttendance == null) {
                        usedCountByAttendance = 0L;
                    }
                    
                    // 출석 기록 + 출석 기록이 없는 예약 = 실제 사용 횟수 (중복 없음)
                    Long actualUsedCount = usedCountByAttendance + usedCountByBooking;
                    
                    // 잔여 횟수 = 총 횟수 - 실제 사용 횟수
                    Integer remainingCount = totalCount - actualUsedCount.intValue();
                    if (remainingCount < 0) {
                        remainingCount = 0; // 음수 방지
                    }
                    
                    productMap.put("remainingCount", remainingCount);
                    productMap.put("usedCount", actualUsedCount.intValue());
                    productMap.put("totalCount", totalCount);
                } else {
                    // 횟수권이 아닌 경우 기존 remainingCount 사용
                    productMap.put("remainingCount", mp.getRemainingCount());
                    productMap.put("usedCount", 0);
                }
                
                productsWithRemainingCount.add(productMap);
            }
            
            logger.info("회원 상품 목록 반환 완료: 회원 ID={}, 반환된 상품 개수={}", memberId, productsWithRemainingCount.size());
            logger.info("반환된 상품 ID 목록: {}", productsWithRemainingCount.stream().map(p -> p.get("id")).collect(java.util.stream.Collectors.toList()));
            
            return ResponseEntity.ok(productsWithRemainingCount);
        } catch (Exception e) {
            logger.error("회원 상품 목록 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원에게 상품 할당 및 결제 생성
    @PostMapping("/{memberId}/products")
    public ResponseEntity<MemberProduct> assignProductToMember(
            @PathVariable Long memberId,
            @RequestBody Map<String, Object> request) {
        Long productIdLong = null;
        try {
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
            
            Integer productId = (Integer) request.get("productId");
            if (productId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            // 연장 모달에서 호출하는지 확인 (결제 생성을 건너뛰기 위해)
            Boolean skipPayment = (Boolean) request.get("skipPayment");
            if (skipPayment == null) {
                skipPayment = false;
            }
            
            productIdLong = productId.longValue();
            Product product = productRepository.findById(productIdLong)
                    .orElseThrow(() -> new IllegalArgumentException("상품을 찾을 수 없습니다."));
            
            // 이미 할당된 상품인지 확인 (lazy loading 방지를 위해 JOIN FETCH 사용)
            final Long finalProductId = productIdLong; // 람다 표현식에서 사용하기 위해 final 변수 생성
            List<MemberProduct> existing = memberProductRepository.findByMemberIdWithProduct(memberId);
            boolean alreadyAssigned = existing.stream()
                    .anyMatch(mp -> mp.getProduct() != null && 
                                 mp.getProduct().getId().equals(finalProductId) &&
                                 mp.getStatus() == MemberProduct.Status.ACTIVE);
            
            if (alreadyAssigned) {
                // 같은 상품이 이미 있으면 연장하도록 안내 (400 대신 409 Conflict 반환)
                logger.warn("이미 할당된 상품입니다. 회원 ID: {}, 상품 ID: {}", memberId, productIdLong);
                return ResponseEntity.status(HttpStatus.CONFLICT).build();
            }
            
            MemberProduct memberProduct = new MemberProduct();
            memberProduct.setMember(member);
            memberProduct.setProduct(product);
            memberProduct.setPurchaseDate(LocalDateTime.now());
            memberProduct.setStatus(MemberProduct.Status.ACTIVE);
            
            // 유효기간 설정
            if (product.getValidDays() != null && product.getValidDays() > 0) {
                memberProduct.setExpiryDate(LocalDate.now().plusDays(product.getValidDays()));
            }
            
            // 횟수권인 경우 총 횟수 설정
            if (product.getType() == Product.ProductType.COUNT_PASS) {
                // usageCount가 null이면 기본값 0으로 설정 (에러 방지)
                Integer usageCount = product.getUsageCount();
                if (usageCount == null || usageCount <= 0) {
                    // usageCount가 없으면 기본값 10으로 설정 (또는 에러 발생)
                    logger.warn("경고: 상품 {}의 usageCount가 설정되지 않았습니다. 기본값 10을 사용합니다.", product.getId());
                    usageCount = 10; // 기본값
                }
                memberProduct.setTotalCount(usageCount);
                // 연장 모달에서 호출하는 경우 remainingCount를 0으로 설정 (연장 시에만 횟수 추가)
                if (skipPayment) {
                    memberProduct.setRemainingCount(0);
                } else {
                    memberProduct.setRemainingCount(usageCount); // 초기값은 총 횟수와 동일
                }
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            // 상품 할당 시 자동으로 결제(Payment) 생성 (중복 방지)
            // 단, 연장 모달에서 호출하는 경우(skipPayment=true)는 결제 생성을 건너뜀
            if (!skipPayment && product.getPrice() != null && product.getPrice() > 0) {
                // 같은 회원, 같은 상품에 대한 활성 결제가 있는지 확인 (시간 제한 없음)
                // 상품 할당 제거 후 재할당 시 결제가 중복 생성되는 것을 방지
                // JOIN을 사용하여 Product를 함께 로드하지 않고, 직접 product_id로 조회하여 lazy loading 문제 방지
                List<Payment> existingPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(memberId, finalProductId);
                
                if (existingPayments.isEmpty()) {
                    // 활성 결제가 없으면 새로 생성
                    Payment payment = new Payment();
                    payment.setMember(member);
                    payment.setProduct(product);
                    payment.setAmount(product.getPrice());
                    payment.setPaymentMethod(Payment.PaymentMethod.CASH); // 기본값: 현금
                    payment.setStatus(Payment.PaymentStatus.COMPLETED);
                    payment.setCategory(Payment.PaymentCategory.PRODUCT_SALE);
                    payment.setMemo("상품 할당: " + product.getName());
                    payment.setPaidAt(LocalDateTime.now());
                    payment.setCreatedAt(LocalDateTime.now());
                    paymentRepository.save(payment);
                    logger.debug("상품 할당 시 결제 생성: Member ID={}, Product ID={}, Amount={}", 
                        memberId, productIdLong, product.getPrice());
                } else {
                    logger.debug("중복 결제 방지: 같은 회원({})과 상품({})에 대한 활성 결제가 이미 존재합니다. (기존 결제 수: {})", 
                        memberId, productIdLong, existingPayments.size());
                }
            } else if (skipPayment) {
                logger.debug("연장 모달에서 호출: 결제 생성을 건너뜁니다. Member ID={}, Product ID={}", 
                    memberId, productIdLong);
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("회원 상품 할당 중 오류 발생. 회원 ID: {}, 상품 ID: {}", memberId, productIdLong != null ? productIdLong : "unknown", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원의 모든 상품 할당 제거 (해당 상품에 대한 결제도 함께 제거)
    @DeleteMapping("/{memberId}/products")
    @Transactional
    public ResponseEntity<Void> removeAllProductsFromMember(@PathVariable Long memberId) {
        try {
            // 회원 존재 확인
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // 회원의 모든 상품 할당 조회 (Product를 함께 로드하여 lazy loading 문제 방지)
            List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
            
            if (memberProducts.isEmpty()) {
                // 이미 상품 할당이 없으면 성공으로 처리
                return ResponseEntity.noContent().build();
            }
            
            // 각 MemberProduct를 삭제하기 전에 관련 Booking의 참조를 null로 설정
            // 그리고 해당 상품에 대한 결제도 함께 제거
            for (MemberProduct memberProduct : memberProducts) {
                // 이 MemberProduct를 참조하는 모든 Booking 찾기 (상태 무관)
                List<Booking> bookings = bookingRepository.findAllBookingsByMemberProductId(memberProduct.getId());
                
                // Booking의 memberProduct 참조를 null로 설정
                for (Booking booking : bookings) {
                    booking.setMemberProduct(null);
                    bookingRepository.save(booking);
                }
                
                // 해당 상품에 대한 PRODUCT_SALE 결제 제거 (상품 할당과 함께 제거)
                // Product는 이미 JOIN FETCH로 로드되어 있음
                if (memberProduct.getProduct() != null && memberProduct.getProduct().getId() != null) {
                    Long productId = memberProduct.getProduct().getId();
                    List<Payment> productPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(
                        memberId, productId);
                    
                    for (Payment payment : productPayments) {
                        paymentRepository.delete(payment);
                        logger.debug("상품 할당 제거 시 결제도 함께 제거: Payment ID={}, Member ID={}, Product ID={}", 
                            payment.getId(), memberId, productId);
                    }
                }
            }
            
            // 모든 참조를 제거한 후 MemberProduct 삭제
            memberProductRepository.deleteAll(memberProducts);
            
            logger.debug("회원 상품 할당 제거 완료: Member ID={}, 삭제된 상품 수={}", memberId, memberProducts.size());
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("회원 상품 할당 제거 중 오류 발생. 회원 ID: {}", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원 예약 내역 조회
    @GetMapping("/{memberId}/bookings")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberBookings(@PathVariable Long memberId) {
        try {
            // memberId 유효성 검사
            if (memberId == null) {
                logger.warn("회원 ID가 null입니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // 회원 존재 여부 확인
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // 회원의 예약 목록 조회 (JOIN FETCH 사용하여 lazy loading 방지)
            List<Booking> bookings = bookingRepository.findAllWithFacilityAndMember().stream()
                    .filter(b -> b.getMember() != null && b.getMember().getId().equals(memberId))
                    .collect(Collectors.toList());
            
            // Map으로 변환하여 반환 (순환 참조 방지)
            List<Map<String, Object>> result = bookings.stream().map(booking -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", booking.getId());
                map.put("startTime", booking.getStartTime());
                map.put("endTime", booking.getEndTime());
                map.put("participants", booking.getParticipants());
                map.put("status", booking.getStatus() != null ? booking.getStatus().name() : null);
                map.put("purpose", booking.getPurpose() != null ? booking.getPurpose().name() : null);
                map.put("memo", booking.getMemo());
                map.put("createdAt", booking.getCreatedAt());
                
                // Facility 정보
                if (booking.getFacility() != null) {
                    try {
                        Map<String, Object> facilityMap = new HashMap<>();
                        facilityMap.put("id", booking.getFacility().getId());
                        facilityMap.put("name", booking.getFacility().getName());
                        map.put("facility", facilityMap);
                    } catch (Exception e) {
                        logger.warn("Facility 로드 실패: Booking ID={}", booking.getId(), e);
                        map.put("facility", null);
                    }
                } else {
                    map.put("facility", null);
                }
                
                // Coach 정보
                if (booking.getCoach() != null) {
                    try {
                        Map<String, Object> coachMap = new HashMap<>();
                        coachMap.put("id", booking.getCoach().getId());
                        coachMap.put("name", booking.getCoach().getName());
                        map.put("coach", coachMap);
                    } catch (Exception e) {
                        logger.warn("Coach 로드 실패: Booking ID={}", booking.getId(), e);
                        map.put("coach", null);
                    }
                } else {
                    map.put("coach", null);
                }
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 예약 내역 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원 결제 내역 조회
    @GetMapping("/{memberId}/payments")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberPayments(@PathVariable Long memberId) {
        try {
            // memberId 유효성 검사
            if (memberId == null) {
                logger.warn("회원 ID가 null입니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // 회원 존재 여부 확인
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // 회원의 결제 내역 조회 (코치 정보 포함)
            List<Payment> payments = paymentRepository.findByMemberIdWithCoach(memberId);
            
            // Map으로 변환하여 반환 (순환 참조 방지)
            List<Map<String, Object>> result = payments.stream().map(payment -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", payment.getId());
                map.put("amount", payment.getAmount());
                map.put("paymentMethod", payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : null);
                map.put("status", payment.getStatus() != null ? payment.getStatus().name() : null);
                map.put("category", payment.getCategory() != null ? payment.getCategory().name() : null);
                map.put("memo", payment.getMemo());
                map.put("paidAt", payment.getPaidAt());
                map.put("createdAt", payment.getCreatedAt());
                map.put("refundAmount", payment.getRefundAmount());
                map.put("refundReason", payment.getRefundReason());
                
                // Product 정보
                if (payment.getProduct() != null) {
                    Map<String, Object> productMap = new HashMap<>();
                    productMap.put("id", payment.getProduct().getId());
                    productMap.put("name", payment.getProduct().getName());
                    map.put("product", productMap);
                } else {
                    map.put("product", null);
                }
                
                // Coach 정보 (예약의 코치 우선, 없으면 회원의 담당 코치)
                try {
                    com.afbscenter.model.Coach coach = null;
                    if (payment.getBooking() != null && payment.getBooking().getCoach() != null) {
                        coach = payment.getBooking().getCoach();
                    } else if (payment.getMember() != null && payment.getMember().getCoach() != null) {
                        coach = payment.getMember().getCoach();
                    }
                    
                    if (coach != null) {
                        Map<String, Object> coachMap = new HashMap<>();
                        coachMap.put("id", coach.getId());
                        coachMap.put("name", coach.getName());
                        map.put("coach", coachMap);
                    } else {
                        map.put("coach", null);
                    }
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패: Payment ID={}", payment.getId(), e);
                    map.put("coach", null);
                }
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 결제 내역 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원 출석 내역 조회
    @GetMapping("/{memberId}/attendance")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberAttendance(@PathVariable Long memberId) {
        try {
            // memberId 유효성 검사
            if (memberId == null) {
                logger.warn("회원 ID가 null입니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // 회원 존재 여부 확인
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // 회원의 출석 기록 조회
            List<Attendance> attendances = attendanceRepository.findByMemberId(memberId);
            
            // Map으로 변환하여 반환 (순환 참조 방지)
            List<Map<String, Object>> result = attendances.stream().map(attendance -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", attendance.getId());
                map.put("date", attendance.getDate());
                map.put("checkInTime", attendance.getCheckInTime());
                map.put("checkOutTime", attendance.getCheckOutTime());
                map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
                map.put("memo", attendance.getMemo());
                map.put("penaltyApplied", attendance.getPenaltyApplied());
                
                // Facility 정보
                if (attendance.getFacility() != null) {
                    try {
                        Map<String, Object> facilityMap = new HashMap<>();
                        facilityMap.put("id", attendance.getFacility().getId());
                        facilityMap.put("name", attendance.getFacility().getName());
                        map.put("facility", facilityMap);
                    } catch (Exception e) {
                        logger.warn("Facility 로드 실패: Attendance ID={}", attendance.getId(), e);
                        map.put("facility", null);
                    }
                } else {
                    map.put("facility", null);
                }
                
                // Booking 정보 (있는 경우)
                if (attendance.getBooking() != null) {
                    try {
                        Map<String, Object> bookingMap = new HashMap<>();
                        bookingMap.put("id", attendance.getBooking().getId());
                        bookingMap.put("startTime", attendance.getBooking().getStartTime());
                        bookingMap.put("endTime", attendance.getBooking().getEndTime());
                        map.put("booking", bookingMap);
                    } catch (Exception e) {
                        logger.warn("Booking 로드 실패: Attendance ID={}", attendance.getId(), e);
                        map.put("booking", null);
                    }
                } else {
                    map.put("booking", null);
                }
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 출석 내역 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createMember(@RequestBody Map<String, Object> requestData) {
        Map<String, Object> response = new HashMap<>();
        try {
            logger.info("회원 등록 요청 수신: {}", requestData);
            logger.info("요청 데이터 상세: name={}, phoneNumber={}, gender={}, grade={}, status={}, joinDate={}", 
                requestData.get("name"), requestData.get("phoneNumber"), requestData.get("gender"), 
                requestData.get("grade"), requestData.get("status"), requestData.get("joinDate"));
            
            // Map에서 Member 객체로 변환
            Member member = new Member();
            
            // 필수 필드 검증 및 설정
            String name = (String) requestData.get("name");
            if (name == null || name.trim().isEmpty()) {
                throw new IllegalArgumentException("이름은 필수입니다.");
            }
            member.setName(name.trim());
            
            String phoneNumber = (String) requestData.get("phoneNumber");
            if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
                throw new IllegalArgumentException("전화번호는 필수입니다.");
            }
            member.setPhoneNumber(phoneNumber.trim());
            
            // 회원번호 설정 (안전한 타입 변환)
            Object memberNumberObj = requestData.get("memberNumber");
            if (memberNumberObj != null) {
                String memberNumberStr = memberNumberObj.toString().trim();
                member.setMemberNumber(memberNumberStr.isEmpty() ? null : memberNumberStr);
            } else {
                member.setMemberNumber(null);
            }
            
            // 생년월일
            if (requestData.get("birthDate") != null) {
                try {
                    member.setBirthDate(java.time.LocalDate.parse((String) requestData.get("birthDate")));
                } catch (Exception e) {
                    logger.warn("생년월일 파싱 실패: {}", requestData.get("birthDate"));
                }
            }
            
            // 성별
            if (requestData.get("gender") != null) {
                try {
                    member.setGender(Member.Gender.valueOf(((String) requestData.get("gender")).toUpperCase()));
                } catch (Exception e) {
                    logger.warn("성별 파싱 실패: {}", requestData.get("gender"));
                    throw new IllegalArgumentException("성별은 MALE 또는 FEMALE이어야 합니다.");
                }
            }
            
            // 키, 몸무게 (@Positive 검증을 피하기 위해 null이거나 0 이하인 경우 null로 설정)
            if (requestData.get("height") != null) {
                try {
                    Integer height = ((Number) requestData.get("height")).intValue();
                    member.setHeight(height > 0 ? height : null);
                } catch (Exception e) {
                    logger.warn("키 파싱 실패: {}", requestData.get("height"));
                    member.setHeight(null);
                }
            }
            if (requestData.get("weight") != null) {
                try {
                    Integer weight = ((Number) requestData.get("weight")).intValue();
                    member.setWeight(weight > 0 ? weight : null);
                } catch (Exception e) {
                    logger.warn("몸무게 파싱 실패: {}", requestData.get("weight"));
                    member.setWeight(null);
                }
            }
            
            // 주소, 메모 등 (빈 문자열은 null로 변환)
            String address = (String) requestData.get("address");
            member.setAddress(address != null && !address.trim().isEmpty() ? address : null);
            
            String memo = (String) requestData.get("memo");
            member.setMemo(memo != null && !memo.trim().isEmpty() ? memo : null);
            
            String school = (String) requestData.get("school");
            member.setSchool(school != null && !school.trim().isEmpty() ? school : null);
            
            String guardianName = (String) requestData.get("guardianName");
            member.setGuardianName(guardianName != null && !guardianName.trim().isEmpty() ? guardianName : null);
            
            String guardianPhone = (String) requestData.get("guardianPhone");
            member.setGuardianPhone(guardianPhone != null && !guardianPhone.trim().isEmpty() ? guardianPhone : null);
            
            String coachMemo = (String) requestData.get("coachMemo");
            member.setCoachMemo(coachMemo != null && !coachMemo.trim().isEmpty() ? coachMemo : null);
            
            // 등급
            if (requestData.get("grade") != null) {
                try {
                    member.setGrade(Member.MemberGrade.valueOf(((String) requestData.get("grade")).toUpperCase()));
                } catch (Exception e) {
                    logger.warn("등급 파싱 실패: {}, 기본값 사용", requestData.get("grade"));
                    member.setGrade(Member.MemberGrade.SOCIAL);
                }
            }
            
            // 상태
            if (requestData.get("status") != null) {
                try {
                    member.setStatus(Member.MemberStatus.valueOf(((String) requestData.get("status")).toUpperCase()));
                } catch (Exception e) {
                    logger.warn("상태 파싱 실패: {}, 기본값 사용", requestData.get("status"));
                    member.setStatus(Member.MemberStatus.ACTIVE);
                }
            }
            
            // 가입일
            if (requestData.get("joinDate") != null) {
                try {
                    member.setJoinDate(java.time.LocalDate.parse((String) requestData.get("joinDate")));
                } catch (Exception e) {
                    logger.warn("가입일 파싱 실패: {}", requestData.get("joinDate"));
                }
            }
            
            // 등록일시
            if (requestData.get("createdAt") != null && !requestData.get("createdAt").toString().trim().isEmpty()) {
                try {
                    String createdAtStr = requestData.get("createdAt").toString().trim();
                    java.time.LocalDateTime createdAt = null;
                    
                    // 다양한 형식 지원
                    if (createdAtStr.contains("T")) {
                        // ISO 형식 (YYYY-MM-DDTHH:mm:ss 또는 YYYY-MM-DDTHH:mm:00)
                        try {
                            // 표준 ISO 형식으로 시도 (YYYY-MM-DDTHH:mm:ss)
                            createdAt = java.time.LocalDateTime.parse(createdAtStr);
                        } catch (Exception e1) {
                            try {
                                // 초가 없는 형식 (YYYY-MM-DDTHH:mm)인 경우
                                createdAt = java.time.LocalDateTime.parse(createdAtStr, 
                                    java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
                            } catch (Exception e2) {
                                try {
                                    // 초가 2자리인 형식 (YYYY-MM-DDTHH:mm:00)
                                    createdAt = java.time.LocalDateTime.parse(createdAtStr, 
                                        java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
                                } catch (Exception e3) {
                                    logger.warn("등록일시 파싱 실패: {}", createdAtStr);
                                    createdAt = java.time.LocalDateTime.now();
                                }
                            }
                        }
                    } else if (createdAtStr.contains(" ")) {
                        // 공백으로 구분된 형식 (YYYY-MM-DD HH:mm:ss 또는 YYYY-MM-DD HH:mm)
                        try {
                            createdAt = java.time.LocalDateTime.parse(createdAtStr.replace(" ", "T"));
                        } catch (Exception e) {
                            createdAt = java.time.LocalDateTime.now();
                        }
                    } else {
                        // 날짜만 있는 경우 (YYYY-MM-DD)
                        try {
                            createdAt = java.time.LocalDate.parse(createdAtStr).atStartOfDay();
                        } catch (Exception e) {
                            createdAt = java.time.LocalDateTime.now();
                        }
                    }
                    
                    if (createdAt != null) {
                        member.setCreatedAt(createdAt);
                    }
                } catch (Exception e) {
                    logger.warn("등록일시 파싱 실패: {}, 오류: {}", requestData.get("createdAt"), e.getMessage());
                    // 파싱 실패 시 현재 시간 사용
                    member.setCreatedAt(java.time.LocalDateTime.now());
                }
            }
            
            // 코치 설정
            if (requestData.get("coach") != null) {
                Map<String, Object> coachMap = (Map<String, Object>) requestData.get("coach");
                if (coachMap != null && coachMap.get("id") != null) {
                    Long coachId = ((Number) coachMap.get("id")).longValue();
                    Optional<Coach> coachOpt = coachRepository.findById(coachId);
                    if (coachOpt.isPresent()) {
                        member.setCoach(coachOpt.get());
                    } else {
                        logger.warn("코치를 찾을 수 없습니다. ID: {}", coachId);
                        member.setCoach(null);
                    }
                }
            }
            
            logger.info("회원 등록 요청: 이름={}, 전화번호={}, 성별={}, 등급={}, 상태={}, 가입일={}", 
                member.getName(), member.getPhoneNumber(), member.getGender(), member.getGrade(), 
                member.getStatus(), member.getJoinDate());
            
            // Member 객체 상태 확인
            logger.debug("Member 객체 상태: name={}, phoneNumber={}, gender={}, grade={}, status={}, joinDate={}, createdAt={}, coach={}", 
                member.getName(), member.getPhoneNumber(), member.getGender(), member.getGrade(), 
                member.getStatus(), member.getJoinDate(), member.getCreatedAt(), 
                member.getCoach() != null ? member.getCoach().getId() : null);
            
            // 최종 검증: 필수 필드 확인
            if (member.getName() == null || member.getName().trim().isEmpty()) {
                throw new IllegalArgumentException("이름은 필수입니다.");
            }
            if (member.getPhoneNumber() == null || member.getPhoneNumber().trim().isEmpty()) {
                throw new IllegalArgumentException("전화번호는 필수입니다.");
            }
            if (member.getGender() == null) {
                throw new IllegalArgumentException("성별은 필수입니다.");
            }
            
            logger.info("MemberService.createMember() 호출 전 - Member 객체: name={}, phoneNumber={}, gender={}, grade={}, status={}, joinDate={}, createdAt={}, memberNumber={}", 
                member.getName(), member.getPhoneNumber(), member.getGender(), member.getGrade(), 
                member.getStatus(), member.getJoinDate(), member.getCreatedAt(), member.getMemberNumber());
            
            Member createdMember;
            try {
                createdMember = memberService.createMember(member);
                logger.info("MemberService.createMember() 호출 성공 - 생성된 회원 ID: {}", createdMember != null ? createdMember.getId() : "null");
            } catch (Exception e) {
                logger.error("MemberService.createMember() 호출 실패: {}", e.getMessage(), e);
                logger.error("MemberService.createMember() 호출 실패 - 예외 클래스: {}", e.getClass().getName());
                logger.error("MemberService.createMember() 호출 실패 - 스택 트레이스:", e);
                e.printStackTrace();
                throw e;
            }
            logger.info("회원 등록 성공: ID={}, 회원번호={}", createdMember.getId(), createdMember.getMemberNumber());
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            Map<String, Object> memberMap = new HashMap<>();
            memberMap.put("id", createdMember.getId());
            memberMap.put("memberNumber", createdMember.getMemberNumber());
            memberMap.put("name", createdMember.getName());
            memberMap.put("phoneNumber", createdMember.getPhoneNumber());
            memberMap.put("birthDate", createdMember.getBirthDate());
            memberMap.put("gender", createdMember.getGender());
            memberMap.put("height", createdMember.getHeight());
            memberMap.put("weight", createdMember.getWeight());
            memberMap.put("address", createdMember.getAddress());
            memberMap.put("memo", createdMember.getMemo());
            memberMap.put("grade", createdMember.getGrade());
            memberMap.put("status", createdMember.getStatus());
            memberMap.put("joinDate", createdMember.getJoinDate());
            memberMap.put("lastVisitDate", createdMember.getLastVisitDate());
            memberMap.put("coachMemo", createdMember.getCoachMemo());
            memberMap.put("guardianName", createdMember.getGuardianName());
            memberMap.put("guardianPhone", createdMember.getGuardianPhone());
            memberMap.put("school", createdMember.getSchool());
            memberMap.put("createdAt", createdMember.getCreatedAt());
            
            return ResponseEntity.status(HttpStatus.CREATED).body(memberMap);
        } catch (IllegalArgumentException e) {
            logger.warn("회원 등록 실패: {}", e.getMessage(), e);
            response.put("error", e.getMessage());
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            logger.error("회원 등록 중 데이터 무결성 오류 발생: {}", e.getMessage(), e);
            response.put("error", "데이터 무결성 오류");
            response.put("message", "회원 등록 중 오류가 발생했습니다. 전화번호가 이미 등록되어 있거나 필수 정보가 누락되었을 수 있습니다.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            logger.error("회원 등록 중 오류 발생: {}", e.getMessage(), e);
            logger.error("회원 등록 오류 클래스: {}", e.getClass().getName());
            logger.error("회원 등록 오류 스택 트레이스:", e);
            e.printStackTrace(); // 콘솔에 전체 스택 트레이스 출력
            
            // 원인 체인 전체 출력
            Throwable cause = e.getCause();
            int depth = 0;
            while (cause != null && depth < 5) {
                logger.error("원인 {}: {} - {}", depth + 1, cause.getClass().getName(), cause.getMessage());
                cause = cause.getCause();
                depth++;
            }
            
            response.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            response.put("message", "회원 등록 중 오류가 발생했습니다: " + e.getMessage());
            response.put("errorClass", e.getClass().getName());
            if (e.getCause() != null) {
                response.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            // 스택 트레이스의 첫 번째 줄도 포함
            if (e.getStackTrace() != null && e.getStackTrace().length > 0) {
                response.put("stackTrace", e.getStackTrace()[0].toString());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateMember(@PathVariable Long id, @Valid @RequestBody Member member) {
        try {
            Member updatedMember = memberService.updateMember(id, member);
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            Map<String, Object> memberMap = new HashMap<>();
            memberMap.put("id", updatedMember.getId());
            memberMap.put("memberNumber", updatedMember.getMemberNumber());
            memberMap.put("name", updatedMember.getName());
            memberMap.put("phoneNumber", updatedMember.getPhoneNumber());
            memberMap.put("birthDate", updatedMember.getBirthDate());
            memberMap.put("gender", updatedMember.getGender());
            memberMap.put("height", updatedMember.getHeight());
            memberMap.put("weight", updatedMember.getWeight());
            memberMap.put("address", updatedMember.getAddress());
            memberMap.put("memo", updatedMember.getMemo());
            memberMap.put("grade", updatedMember.getGrade());
            memberMap.put("status", updatedMember.getStatus());
            memberMap.put("joinDate", updatedMember.getJoinDate());
            memberMap.put("lastVisitDate", updatedMember.getLastVisitDate());
            memberMap.put("coachMemo", updatedMember.getCoachMemo());
            memberMap.put("guardianName", updatedMember.getGuardianName());
            memberMap.put("guardianPhone", updatedMember.getGuardianPhone());
            memberMap.put("school", updatedMember.getSchool());
            memberMap.put("createdAt", updatedMember.getCreatedAt());
            memberMap.put("updatedAt", updatedMember.getUpdatedAt());
            
            // 코치 정보
            if (updatedMember.getCoach() != null) {
                try {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", updatedMember.getCoach().getId());
                    coachMap.put("name", updatedMember.getCoach().getName());
                    memberMap.put("coach", coachMap);
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패: Member ID={}", updatedMember.getId(), e);
                    memberMap.put("coach", null);
                }
            } else {
                memberMap.put("coach", null);
            }
            
            return ResponseEntity.ok(memberMap);
        } catch (IllegalArgumentException e) {
            logger.warn("회원 수정 실패: {}", e.getMessage(), e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("회원 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteMember(@PathVariable Long id) {
        Map<String, Object> response = new HashMap<>();
        try {
            logger.info("회원 삭제 요청: ID={}", id);
            memberService.deleteMember(id);
            logger.info("회원 삭제 성공: ID={}", id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            logger.warn("회원 삭제 실패: ID={}, 오류: {}", id, e.getMessage(), e);
            response.put("error", e.getMessage());
            response.put("message", "회원을 찾을 수 없습니다.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        } catch (Exception e) {
            logger.error("회원 삭제 중 오류 발생. ID: {}, 오류: {}", id, e.getMessage(), e);
            logger.error("회원 삭제 오류 스택 트레이스:", e);
            response.put("error", e.getMessage());
            response.put("message", "회원 삭제 중 오류가 발생했습니다: " + e.getMessage());
            if (e.getCause() != null) {
                response.put("cause", e.getCause().getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
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
        
        // 각 회원의 누적 결제 금액을 계산해서 Map으로 변환
        List<Map<String, Object>> membersWithTotalPayment = members.stream().map(member -> {
            Map<String, Object> memberMap = new HashMap<>();
            memberMap.put("id", member.getId());
            memberMap.put("memberNumber", member.getMemberNumber());
            memberMap.put("name", member.getName());
            memberMap.put("phoneNumber", member.getPhoneNumber());
            memberMap.put("birthDate", member.getBirthDate());
            memberMap.put("gender", member.getGender());
            memberMap.put("height", member.getHeight());
            memberMap.put("weight", member.getWeight());
            memberMap.put("address", member.getAddress());
            memberMap.put("memo", member.getMemo());
            memberMap.put("grade", member.getGrade());
            memberMap.put("status", member.getStatus());
            memberMap.put("joinDate", member.getJoinDate());
            memberMap.put("lastVisitDate", member.getLastVisitDate());
            memberMap.put("coachMemo", member.getCoachMemo());
            memberMap.put("guardianName", member.getGuardianName());
            memberMap.put("guardianPhone", member.getGuardianPhone());
            memberMap.put("school", member.getSchool());
            memberMap.put("createdAt", member.getCreatedAt());
            memberMap.put("updatedAt", member.getUpdatedAt());
            
            // 코치 정보 안전하게 로드
            try {
                if (member.getCoach() != null) {
                    // Lazy loading 트리거
                    member.getCoach().getName();
                    
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", member.getCoach().getId());
                    coachMap.put("name", member.getCoach().getName());
                    memberMap.put("coach", coachMap);
                } else {
                    memberMap.put("coach", null);
                }
            } catch (Exception e) {
                logger.warn("코치 정보 로드 실패 (회원 ID: {}): {}", member.getId(), e.getMessage());
                memberMap.put("coach", null);
            }
            
            // 누적 결제 금액 계산
            Integer totalPayment = paymentRepository.sumTotalAmountByMemberId(member.getId());
            memberMap.put("totalPayment", totalPayment != null ? totalPayment : 0);
            
            // 최근 레슨 날짜 계산 (확정된 레슨 예약 중 가장 최근)
            java.time.LocalDate latestLessonDate = null;
            List<com.afbscenter.model.Booking> latestLessons = bookingRepository.findLatestLessonByMemberId(member.getId());
            if (!latestLessons.isEmpty()) {
                latestLessonDate = latestLessons.get(0).getStartTime().toLocalDate();
            }
            memberMap.put("latestLessonDate", latestLessonDate);
            
            // 횟수권 남은 횟수 계산 (실제 예약/출석 기록 기반으로 정확하게 계산)
            int remainingCount = 0;
            List<MemberProduct> countPassProducts = memberProductRepository.findActiveCountPassByMemberId(member.getId());
            
            for (MemberProduct mp : countPassProducts) {
                // 총 횟수: totalCount 또는 product.usageCount
                Integer totalCount = mp.getTotalCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = mp.getProduct().getUsageCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = 10; // 기본값
                    }
                }
                
                // 실제 사용된 횟수 계산 (출석 기록 우선, 없으면 예약 기록)
                Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                if (usedCountByBooking == null) {
                    usedCountByBooking = 0L;
                }
                
                Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
                if (usedCountByAttendance == null) {
                    usedCountByAttendance = 0L;
                }
                
                // 출석 기록이 있으면 출석 기록 사용 (출석이 실제 사용), 없으면 예약 기록 사용
                // 중복 방지: 출석과 예약 중 하나만 사용
                Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                
                // 잔여 횟수 = 총 횟수 - 실제 사용된 횟수
                Integer mpRemainingCount = totalCount - actualUsedCount.intValue();
                if (mpRemainingCount < 0) {
                    mpRemainingCount = 0; // 음수 방지
                }
                
                remainingCount += mpRemainingCount;
            }
            
            // memberProduct가 없는 확정된 레슨 예약/출석도 차감 (첫 번째 활성 횟수권에서 차감)
            Long unassignedConfirmedLessons = bookingRepository.countConfirmedLessonsWithoutMemberProduct(member.getId());
            if (unassignedConfirmedLessons == null) {
                unassignedConfirmedLessons = 0L;
            }
            
            Long unassignedAttendancesCount = attendanceRepository.countCheckedInAttendancesWithoutMemberProduct(member.getId());
            if (unassignedAttendancesCount == null) {
                unassignedAttendancesCount = 0L;
            }
            
            // 출석 기록 + 출석 기록이 없는 예약 = 실제 사용 횟수 (중복 없음)
            Long unassignedCount = unassignedAttendancesCount + unassignedConfirmedLessons;
            
            if (unassignedCount > 0 && !countPassProducts.isEmpty()) {
                // 첫 번째 활성 횟수권에서 차감
                int unassignedCountInt = unassignedCount.intValue();
                if (remainingCount >= unassignedCountInt) {
                    remainingCount -= unassignedCountInt;
                } else {
                    remainingCount = 0; // 음수 방지
                }
            }
            
            memberMap.put("remainingCount", remainingCount);
            
            return memberMap;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(membersWithTotalPayment);
    }
    
    // 회원 등급 마이그레이션 강제 실행 (디버깅/수동 실행용)
    @PostMapping("/migrate-grades")
    public ResponseEntity<Map<String, Object>> migrateMemberGrades() {
        Map<String, Object> result = new HashMap<>();
        try {
            logger.info("회원 등급 마이그레이션 강제 실행 시작");
            memberService.migrateMemberGradesInSeparateTransaction();
            result.put("success", true);
            result.put("message", "회원 등급 마이그레이션이 성공적으로 완료되었습니다.");
            logger.info("회원 등급 마이그레이션 강제 실행 완료");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 등급 마이그레이션 강제 실행 실패: {}", e.getMessage(), e);
            result.put("success", false);
            result.put("message", "마이그레이션 실행 중 오류 발생: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }
}
