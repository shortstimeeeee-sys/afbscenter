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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

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
public class MemberController {

    private static final Logger logger = LoggerFactory.getLogger(MemberController.class);

    private final MemberService memberService;
    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final ProductRepository productRepository;
    private final MemberProductRepository memberProductRepository;
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;
    private final TransactionTemplate transactionTemplate;

    public MemberController(MemberService memberService,
                           MemberRepository memberRepository,
                           CoachRepository coachRepository,
                           ProductRepository productRepository,
                           MemberProductRepository memberProductRepository,
                           PaymentRepository paymentRepository,
                           BookingRepository bookingRepository,
                           AttendanceRepository attendanceRepository,
                           org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.memberService = memberService;
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.productRepository = productRepository;
        this.memberProductRepository = memberProductRepository;
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        // REQUIRES_NEW 전파 속성을 가진 TransactionTemplate 생성
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllMembers(
            @RequestParam(required = false) String productCategory,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String branch) {
        try {
            logger.debug("회원 목록 조회 시작: productCategory={}, grade={}, status={}, branch={}", 
                productCategory, grade, status, branch);
            
            // Service에서 필터링 및 변환 로직 처리
            List<com.afbscenter.dto.MemberResponseDTO> memberDTOs = 
                    memberService.getAllMembersWithFilters(productCategory, grade, status, branch);
            
            logger.debug("회원 DTO 변환 완료: {}명", memberDTOs != null ? memberDTOs.size() : 0);
            
            // DTO를 Map으로 변환 (기존 API 호환성 유지)
            List<Map<String, Object>> membersWithTotalPayment = new java.util.ArrayList<>();
            if (memberDTOs != null) {
                for (com.afbscenter.dto.MemberResponseDTO dto : memberDTOs) {
                    try {
                        Map<String, Object> memberMap = dto.toMap();
                        membersWithTotalPayment.add(memberMap);
                    } catch (Exception e) {
                        logger.warn("회원 DTO 변환 실패 (Member ID: {}): {}", 
                            dto != null ? dto.getId() : "unknown", e.getMessage());
                        // 개별 회원 변환 실패해도 계속 진행
                    }
                }
            }
            
            logger.info("회원 목록 조회 완료: {}명", membersWithTotalPayment.size());
            return ResponseEntity.ok(membersWithTotalPayment);
        } catch (Exception e) {
            logger.error("회원 목록 조회 중 오류 발생", e);
            e.printStackTrace();
            // 에러 상세 정보를 클라이언트에 반환 (디버깅용)
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "회원 목록 조회 중 오류가 발생했습니다");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                java.util.Collections.singletonList(errorResponse));
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
            if (id == null) {
                return ResponseEntity.badRequest().build();
            }
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
            memberMap.put("swingSpeed", member.getSwingSpeed());
            memberMap.put("exitVelocity", member.getExitVelocity());
            memberMap.put("pitchingSpeed", member.getPitchingSpeed());
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
                            
                            // 코치 정보 (MemberProduct.coach -> Product.coach -> Member.coach 순서)
                            String coachName = null;
                            try {
                                if (mp.getCoach() != null) {
                                    coachName = mp.getCoach().getName();
                                }
                            } catch (Exception e) {
                                // coach 필드가 아직 로드되지 않았거나 없을 수 있음
                            }
                            
                            if (coachName == null && mp.getProduct() != null) {
                                try {
                                    if (mp.getProduct().getCoach() != null) {
                                        coachName = mp.getProduct().getCoach().getName();
                                    }
                                } catch (Exception e) {
                                    // 상품의 코치 로드 실패 시 무시
                                }
                            }
                            
                            if (coachName == null && member.getCoach() != null) {
                                coachName = member.getCoach().getName();
                            }
                            
                            if (coachName != null) {
                                mpMap.put("coachName", coachName);
                            }
                            
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
                            totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                        }
                    }
                    
                    // 실제 사용된 횟수 계산
                    // 주의: countConfirmedBookingsByMemberProductId는 이제 체크인된 예약만 카운트하므로
                    // 출석 기록과 중복될 수 있음. 출석 기록을 우선 사용
                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(memberId, mp.getId());
                    if (usedCountByAttendance == null) {
                        usedCountByAttendance = 0L;
                    }
                    
                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                    if (usedCountByBooking == null) {
                        usedCountByBooking = 0L;
                    }
                    
                    // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용 (중복 방지)
                    Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                    
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
    // @Transactional 제거: TransactionTemplate을 사용하여 필요한 부분만 트랜잭션 처리
    @PostMapping("/{memberId}/products")
    public ResponseEntity<Map<String, Object>> assignProductToMember(
            @PathVariable Long memberId,
            @RequestBody Map<String, Object> request) {
        Long productIdLong = null; // catch 블록에서 접근 가능하도록 try 블록 밖에서 선언
        try {
            logger.info("상품 할당 요청 시작: 회원 ID={}, 요청 데이터={}", memberId, request);
            
            if (memberId == null) {
                logger.warn("회원 ID가 null입니다.");
                return ResponseEntity.badRequest().build();
            }
            
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다. 회원 ID: " + memberId));
            logger.debug("회원 조회 성공: 회원 ID={}, 이름={}", memberId, member.getName());
            
            Integer productId = (Integer) request.get("productId");
            if (productId == null) {
                logger.warn("상품 ID가 null입니다. 요청 데이터: {}", request);
                return ResponseEntity.badRequest().build();
            }
            
            // 코치 ID (선택사항 - 회원 등록 시 선택한 코치)
            Long coachId = null;
            if (request.get("coachId") != null) {
                Object coachIdObj = request.get("coachId");
                if (coachIdObj instanceof Number) {
                    coachId = ((Number) coachIdObj).longValue();
                } else if (coachIdObj instanceof String) {
                    try {
                        coachId = Long.parseLong((String) coachIdObj);
                    } catch (NumberFormatException e) {
                        logger.warn("코치 ID 형식이 올바르지 않습니다: {}", coachIdObj);
                    }
                }
            }
            
            // 연장 모달에서 호출하는지 확인 (결제 생성을 건너뛰기 위해)
            Boolean skipPayment = (Boolean) request.get("skipPayment");
            if (skipPayment == null) {
                skipPayment = false;
            }
            
            productIdLong = productId.longValue();
            logger.debug("상품 조회 시작: 상품 ID={}", productIdLong);
            
            // 람다에서 사용하기 위해 final 변수 생성 (effectively final)
            final Long finalProductId = productIdLong;
            final Long finalProductIdForLambda = productIdLong;
            
            // Coach를 함께 로드하여 Lazy loading 문제 방지
            // findByIdWithCoach가 실패할 경우를 대비해 일반 findById로 대체 가능
            Product product = null;
            try {
                product = productRepository.findByIdWithCoach(finalProductId)
                        .orElse(null);
                if (product != null) {
                    logger.debug("findByIdWithCoach로 상품 조회 성공: 상품 ID={}", finalProductId);
                } else {
                    logger.debug("findByIdWithCoach로 상품을 찾을 수 없음: 상품 ID={}", finalProductId);
                }
            } catch (Exception e) {
                logger.warn("findByIdWithCoach 실패, 일반 findById로 재시도: 에러 타입={}, 메시지={}", 
                    e.getClass().getName(), e.getMessage());
            }
            
            if (product == null) {
                try {
                    product = productRepository.findById(finalProductId)
                            .orElse(null);
                    if (product == null) {
                        logger.error("상품을 찾을 수 없습니다. 상품 ID={}", finalProductId);
                        throw new IllegalArgumentException("상품을 찾을 수 없습니다. 상품 ID: " + finalProductId);
                    }
                    logger.debug("일반 findById로 상품 조회 성공: 상품 ID={}", finalProductId);
                } catch (IllegalArgumentException e) {
                    throw e; // 재전파
                } catch (Exception e) {
                    logger.error("상품 조회 중 예상치 못한 오류: 상품 ID={}, 에러 타입={}, 메시지={}", 
                        finalProductId, e.getClass().getName(), e.getMessage(), e);
                    throw new RuntimeException("상품 조회 중 오류가 발생했습니다: " + e.getMessage(), e);
                }
            }
            
            logger.debug("상품 조회 성공: 상품 ID={}, 이름={}, 타입={}", 
                productIdLong, product.getName(), product.getType());
            
            // 이미 할당된 상품인지 확인 (lazy loading 방지를 위해 JOIN FETCH 사용)
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
            
            logger.debug("MemberProduct 생성 시작: 회원 ID={}, 상품 ID={}", memberId, productIdLong);
            
            MemberProduct memberProduct = new MemberProduct();
            memberProduct.setMember(member);
            memberProduct.setProduct(product);
            memberProduct.setPurchaseDate(LocalDateTime.now());
            memberProduct.setStatus(MemberProduct.Status.ACTIVE);
            
            // 코치 설정 (요청에서 전달된 코치 ID 우선, 없으면 상품의 코치, 둘 다 없으면 null)
            if (coachId != null) {
                try {
                    Coach selectedCoach = coachRepository.findById(coachId).orElse(null);
                    if (selectedCoach != null) {
                        memberProduct.setCoach(selectedCoach);
                        logger.info("상품 할당 시 선택된 코치 설정: 회원 ID={}, 상품 ID={}, 코치 ID={}", 
                            memberId, productIdLong, coachId);
                    } else {
                        logger.warn("선택된 코치를 찾을 수 없습니다. 코치 ID={}", coachId);
                    }
                } catch (Exception e) {
                    logger.warn("코치 조회 실패: 코치 ID={}, 오류: {}", coachId, e.getMessage());
                }
            }
            
            // 코치가 설정되지 않았고 상품에 코치가 있으면 상품의 코치 사용
            if (memberProduct.getCoach() == null && product.getCoach() != null) {
                try {
                    memberProduct.setCoach(product.getCoach());
                    logger.debug("상품의 기본 코치 사용: 회원 ID={}, 상품 ID={}, 코치 ID={}", 
                        memberId, productIdLong, product.getCoach().getId());
                } catch (Exception e) {
                    logger.warn("상품 코치 로드 실패: {}", e.getMessage());
                }
            }
            
            // 유효기간 설정 (구매일로부터 validDays일 후)
            if (product.getValidDays() != null && product.getValidDays() > 0) {
                // purchaseDate의 날짜를 기준으로 계산 (시간대 차이 방지)
                LocalDate purchaseDateLocal = memberProduct.getPurchaseDate() != null 
                    ? memberProduct.getPurchaseDate().toLocalDate() 
                    : LocalDate.now();
                memberProduct.setExpiryDate(purchaseDateLocal.plusDays(product.getValidDays()));
                logger.debug("유효기간 설정: 구매일={}, 유효기간={}일, 만료일={}", 
                    purchaseDateLocal, product.getValidDays(), memberProduct.getExpiryDate());
            }
            
            // 패키지 항목이 있는 경우 각 항목별 카운터 초기화
            if (product.getPackageItems() != null && !product.getPackageItems().isEmpty()) {
                try {
                    logger.debug("패키지 항목 처리 시작: {}", product.getPackageItems());
                    // Product의 packageItems를 파싱하여 각 항목별 remaining 초기화
                    ObjectMapper mapper = new ObjectMapper();
                    List<Map<String, Object>> items = mapper.readValue(
                        product.getPackageItems(), 
                        new TypeReference<List<Map<String, Object>>>() {}
                    );
                    
                    // 각 항목의 count를 remaining으로 복사
                    List<Map<String, Object>> remainingItems = new ArrayList<>();
                    for (Map<String, Object> item : items) {
                        Map<String, Object> remainingItem = new HashMap<>();
                        remainingItem.put("name", item.get("name"));
                        remainingItem.put("remaining", item.get("count")); // count를 remaining으로
                        remainingItems.add(remainingItem);
                    }
                    
                    memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(remainingItems));
                    logger.info("패키지 항목 초기화 완료: {}", memberProduct.getPackageItemsRemaining());
                } catch (Exception e) {
                    logger.error("패키지 항목 초기화 실패: {}", e.getMessage(), e);
                    // 패키지 항목 초기화 실패해도 계속 진행
                }
            }
            // 일반 횟수권인 경우 총 횟수 설정
            else if (product.getType() != null && product.getType() == Product.ProductType.COUNT_PASS) {
                logger.debug("횟수권 처리 시작: 상품 타입={}", product.getType());
                // usageCount가 null이면 기본값 0으로 설정 (에러 방지)
                Integer usageCount = product.getUsageCount();
                if (usageCount == null || usageCount <= 0) {
                    // usageCount가 없으면 기본값 사용
                    logger.warn("경고: 상품 {}의 usageCount가 설정되지 않았습니다. 기본값 {}을 사용합니다.", 
                        product.getId(), com.afbscenter.constants.ProductDefaults.DEFAULT_USAGE_COUNT);
                    usageCount = com.afbscenter.constants.ProductDefaults.DEFAULT_USAGE_COUNT;
                }
                memberProduct.setTotalCount(usageCount);
                // 연장 모달에서 호출하는 경우 remainingCount를 0으로 설정 (연장 시에만 횟수 추가)
                if (skipPayment) {
                    memberProduct.setRemainingCount(0);
                    logger.debug("연장 모달: remainingCount를 0으로 설정");
                } else {
                    memberProduct.setRemainingCount(usageCount); // 초기값은 총 횟수와 동일
                    logger.debug("신규 할당: remainingCount를 {}로 설정", usageCount);
                }
            }
            
            logger.debug("MemberProduct 저장 시작: 회원 ID={}, 상품 ID={}, 상태={}", 
                memberId, productIdLong, memberProduct.getStatus());
            
            // MemberProduct 필드 검증
            if (memberProduct.getMember() == null) {
                logger.error("MemberProduct의 Member가 null입니다. 회원 ID={}, 상품 ID={}", memberId, productIdLong);
                throw new IllegalArgumentException("MemberProduct의 Member가 null입니다.");
            }
            if (memberProduct.getProduct() == null) {
                logger.error("MemberProduct의 Product가 null입니다. 회원 ID={}, 상품 ID={}", memberId, productIdLong);
                throw new IllegalArgumentException("MemberProduct의 Product가 null입니다.");
            }
            
            // MemberProduct 저장을 별도 트랜잭션으로 실행하여 먼저 커밋
            // 이렇게 하면 코치 배정이나 결제 생성 실패가 MemberProduct 저장에 영향을 주지 않음
            // TransactionTemplate을 사용하여 REQUIRES_NEW 트랜잭션으로 실행
            // 람다에서 사용하기 위해 final 변수 사용
            MemberProduct saved = transactionTemplate.execute(status -> {
                try {
                    MemberProduct result = memberProductRepository.save(memberProduct);
                    logger.info("MemberProduct 저장 성공 (별도 트랜잭션): ID={}, 회원 ID={}, 상품 ID={}", 
                        result.getId(), memberId, finalProductIdForLambda);
                    return result;
                } catch (Exception e) {
                    logger.error("MemberProduct 저장 실패 (별도 트랜잭션): 회원 ID={}, 상품 ID={}, 에러 타입: {}, 에러 메시지: {}", 
                        memberId, finalProductIdForLambda, e.getClass().getName(), e.getMessage(), e);
                    e.printStackTrace();
                    status.setRollbackOnly(); // 트랜잭션 롤백 표시
                    throw e;
                }
            });
            
            // MemberProduct 저장 실패 시 예외 처리
            if (saved == null) {
                logger.error("MemberProduct 저장 결과가 null입니다. 회원 ID={}, 상품 ID={}", memberId, productIdLong);
                throw new RuntimeException("MemberProduct 저장에 실패했습니다.");
            }
            
            // MemberProduct를 Map으로 변환하여 반환 (lazy loading 문제 방지)
            // 이미 로드한 product 객체를 사용 (saved.getProduct()는 lazy loading 문제 발생 가능)
            Map<String, Object> responseMap = new HashMap<>();
            responseMap.put("id", saved.getId());
            responseMap.put("purchaseDate", saved.getPurchaseDate());
            responseMap.put("expiryDate", saved.getExpiryDate());
            responseMap.put("remainingCount", saved.getRemainingCount());
            responseMap.put("totalCount", saved.getTotalCount());
            responseMap.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            
            // Product 정보는 이미 로드한 product 객체 사용 (lazy loading 방지)
            try {
                Map<String, Object> productMap = new HashMap<>();
                productMap.put("id", product.getId());
                productMap.put("name", product.getName());
                productMap.put("type", product.getType() != null ? product.getType().name() : null);
                productMap.put("price", product.getPrice());
                responseMap.put("product", productMap);
            } catch (Exception e) {
                logger.warn("Product 정보 변환 실패: {}", e.getMessage());
                responseMap.put("product", null);
            }
            
            // MemberProduct 저장이 성공한 후, 코치 배정과 결제 생성을 별도 트랜잭션으로 처리
            // TransactionTemplate을 사용하여 완전히 독립적인 트랜잭션으로 실행
            // 이렇게 하면 MemberProduct 저장이 롤백되지 않음
            // 람다에서 사용하기 위해 final 변수 생성 (product는 null에서 할당되므로 final 변수 필요)
            final Product finalProduct = product;
            final Member finalMember = member;
            
            try {
                // 상품 할당 시 상품의 코치를 회원에게 자동 배정
                // MemberProduct에 설정된 코치를 우선 사용
                final MemberProduct finalSaved = saved;
                transactionTemplate.execute(status -> {
                    try {
                        assignCoachToMemberIfNeededInTransaction(finalMember, finalProduct, finalSaved, memberId, finalProductIdForLambda);
                        return null;
                    } catch (Exception e) {
                        logger.warn("코치 배정 실패 (무시): {}", e.getMessage());
                        status.setRollbackOnly();
                        return null; // 예외를 다시 던지지 않고 null 반환하여 무시
                    }
                });
            } catch (Exception e) {
                logger.warn("코치 배정 트랜잭션 실패 (무시): {}", e.getMessage());
                // 코치 배정 실패해도 MemberProduct 저장은 성공했으므로 계속 진행
            }
            
            try {
                // 상품 할당 시 자동으로 결제(Payment) 생성 (중복 방지)
                // 단, 연장 모달에서 호출하는 경우(skipPayment=true)는 결제 생성을 건너뜀
                if (!skipPayment) {
                    logger.info("결제 생성 트랜잭션 시작: Member ID={}, Product ID={}, SkipPayment={}", 
                        memberId, finalProductIdForLambda, skipPayment);
                    transactionTemplate.execute(status -> {
                        try {
                            createPaymentIfNeededInTransaction(finalMember, finalProduct, memberId, finalProductId, finalProductIdForLambda);
                            logger.info("결제 생성 트랜잭션 완료: Member ID={}, Product ID={}", 
                                memberId, finalProductIdForLambda);
                            return null;
                        } catch (Exception e) {
                            logger.error("결제 생성 실패: 회원 ID={}, 상품 ID={}, 오류: {}", 
                                memberId, finalProductIdForLambda, e.getMessage(), e);
                            // 결제 생성 실패해도 상품 할당은 성공했으므로 계속 진행
                            // 하지만 에러는 로그에 기록
                            return null;
                        }
                    });
                } else {
                    logger.info("연장 모달에서 호출: 결제 생성을 건너뜁니다. Member ID={}, Product ID={}", 
                        memberId, finalProductIdForLambda);
                }
            } catch (Exception e) {
                logger.error("결제 생성 트랜잭션 실패: 회원 ID={}, 상품 ID={}, 오류: {}", 
                    memberId, finalProductIdForLambda, e.getMessage(), e);
                // 결제 생성 실패해도 MemberProduct 저장은 성공했으므로 계속 진행
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(responseMap);
        } catch (IllegalArgumentException e) {
            logger.warn("회원 상품 할당 중 잘못된 인자: 회원 ID={}, 에러: {}", 
                memberId, e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        } catch (org.springframework.transaction.UnexpectedRollbackException e) {
            // 트랜잭션 롤백 전용 예외 처리
            logger.error("트랜잭션 롤백 오류 발생. 회원 ID: {}, 상품 ID: {}, 에러: {}", 
                memberId, productIdLong != null ? productIdLong : "unknown", e.getMessage(), e);
            e.printStackTrace();
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Internal Server Error");
            errorResponse.put("message", "서버 내부 오류가 발생했습니다: " + e.getMessage());
            errorResponse.put("errorType", e.getClass().getName());
            errorResponse.put("memberId", memberId);
            errorResponse.put("productId", productIdLong);
            if (e.getCause() != null) {
                errorResponse.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        } catch (Exception e) {
            String errorType = e.getClass().getName();
            String errorMessage = e.getMessage();
            Throwable cause = e.getCause();
            
            logger.error("회원 상품 할당 중 오류 발생. 회원 ID: {}, 상품 ID: {}, 에러 타입: {}, 에러 메시지: {}", 
                memberId, productIdLong != null ? productIdLong : "unknown", errorType, errorMessage, e);
            
            if (cause != null) {
                logger.error("원인 예외: 타입={}, 메시지={}", cause.getClass().getName(), cause.getMessage());
            }
            
            e.printStackTrace();
            
            // 에러 상세 정보를 클라이언트에 반환 (디버깅용)
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Internal Server Error");
            errorResponse.put("message", "서버 내부 오류가 발생했습니다: " + (errorMessage != null ? errorMessage : "알 수 없는 오류"));
            errorResponse.put("errorType", errorType);
            errorResponse.put("memberId", memberId);
            errorResponse.put("productId", productIdLong);
            if (cause != null) {
                errorResponse.put("cause", cause.getClass().getName() + ": " + cause.getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
    
    // 코치 배정을 별도 트랜잭션으로 실행 (TransactionTemplate에서 호출)
    // MemberProduct에 코치가 설정되어 있으면 그것을 사용, 없으면 상품의 코치 사용
    private void assignCoachToMemberIfNeededInTransaction(Member member, Product product, MemberProduct memberProduct, Long memberId, Long productIdLong) {
        try {
            Coach coachToAssign = null;
            
            // 1. MemberProduct에 코치가 설정되어 있으면 우선 사용
            if (memberProduct != null && memberProduct.getCoach() != null) {
                try {
                    coachToAssign = memberProduct.getCoach();
                    logger.debug("MemberProduct의 코치 사용: 회원 ID={}, 상품 ID={}, 코치 ID={}", 
                        memberId, productIdLong, coachToAssign.getId());
                } catch (Exception e) {
                    logger.warn("MemberProduct 코치 정보 로드 실패: {}", e.getMessage());
                }
            }
            
            // 2. MemberProduct에 코치가 없으면 상품의 코치 사용
            if (coachToAssign == null) {
                try {
                    coachToAssign = product.getCoach();
                } catch (Exception e) {
                    logger.warn("상품 코치 정보 로드 실패: {}", e.getMessage());
                    return; // 코치 정보를 가져올 수 없으면 종료
                }
            }
            
            if (coachToAssign != null) {
                // 회원을 다시 조회하여 최신 상태로 가져옴
                Member currentMember = memberRepository.findById(memberId).orElse(null);
                if (currentMember != null && currentMember.getCoach() == null) {
                    // 회원에게 코치가 없으면 배정 (주 담당 코치로 설정)
                    currentMember.setCoach(coachToAssign);
                    memberRepository.save(currentMember);
                    logger.info("상품 할당 시 코치 자동 배정 (주 담당 코치): 회원 ID={}, 코치 ID={}, 상품 ID={}", 
                        memberId, coachToAssign.getId(), productIdLong);
                } else if (currentMember != null) {
                    // 회원에게 이미 코치가 있으면 로그만 남김 (기존 코치 유지)
                    logger.debug("회원에게 이미 코치가 설정되어 있습니다. 회원 ID={}, 기존 코치 ID={}, 새 코치 ID={}", 
                        memberId, currentMember.getCoach().getId(), coachToAssign.getId());
                }
            } else {
                logger.debug("상품에 코치가 설정되어 있지 않습니다. 상품 ID={}", productIdLong);
            }
        } catch (Exception e) {
            logger.warn("상품 코치 배정 실패 (무시). 회원 ID={}, 상품 ID={}: {}", 
                memberId, productIdLong, e.getMessage());
            // 코치 배정 실패해도 상품 할당은 계속 진행
        }
    }
    
    // 결제 생성을 별도 트랜잭션으로 실행 (TransactionTemplate에서 호출)
    private void createPaymentIfNeededInTransaction(Member member, Product product, Long memberId, Long finalProductId, Long productIdLong) {
        try {
            logger.info("결제 생성 시작: Member ID={}, Product ID={}", memberId, productIdLong);
            
            if (product == null) {
                logger.warn("Product가 null입니다. 결제 생성을 건너뜁니다. Member ID={}, Product ID={}", memberId, productIdLong);
                return;
            }
            
            if (product.getPrice() == null || product.getPrice() <= 0) {
                logger.debug("상품 가격이 없거나 0원입니다. 결제 생성을 건너뜁니다. Member ID={}, Product ID={}, Price={}", 
                    memberId, productIdLong, product.getPrice());
                return; // 가격이 없으면 결제 생성하지 않음
            }
            
            // 같은 회원, 같은 상품에 대한 활성 결제가 있는지 확인 (시간 제한 없음)
            // 상품 할당 제거 후 재할당 시 결제가 중복 생성되는 것을 방지
            List<Payment> existingPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(memberId, finalProductId);
            
            if (existingPayments.isEmpty()) {
                // 회원과 상품을 다시 조회하여 최신 상태로 가져옴
                Member currentMember = memberRepository.findById(memberId).orElse(null);
                Product currentProduct = productRepository.findById(finalProductId).orElse(null);
                
                if (currentMember == null) {
                    logger.warn("회원을 찾을 수 없습니다. 결제 생성을 건너뜁니다. Member ID={}", memberId);
                    return;
                }
                
                if (currentProduct == null) {
                    logger.warn("상품을 찾을 수 없습니다. 결제 생성을 건너뜁니다. Product ID={}", finalProductId);
                    return;
                }
                
                // 활성 결제가 없으면 새로 생성
                Payment payment = new Payment();
                payment.setMember(currentMember);
                payment.setProduct(currentProduct);
                payment.setAmount(currentProduct.getPrice());
                payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_METHOD);
                payment.setStatus(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_STATUS);
                payment.setCategory(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_CATEGORY);
                String productName = currentProduct.getName() != null ? currentProduct.getName() : "상품 ID: " + productIdLong;
                payment.setMemo("상품 할당: " + productName);
                payment.setPaidAt(LocalDateTime.now());
                payment.setCreatedAt(LocalDateTime.now());
                
                // 결제 번호 자동 생성
                try {
                    String paymentNumber = generatePaymentNumber();
                    payment.setPaymentNumber(paymentNumber);
                } catch (Exception e) {
                    logger.warn("결제 번호 생성 실패, 계속 진행: {}", e.getMessage());
                }
                
                Payment savedPayment = paymentRepository.save(payment);
                logger.info("✅ 상품 할당 시 결제 생성 완료: Payment ID={}, Member ID={}, Product ID={}, Amount={}, PaymentNumber={}", 
                    savedPayment.getId(), memberId, productIdLong, currentProduct.getPrice(), 
                    savedPayment.getPaymentNumber() != null ? savedPayment.getPaymentNumber() : "N/A");
            } else {
                logger.debug("중복 결제 방지: 같은 회원({})과 상품({})에 대한 활성 결제가 이미 존재합니다. (기존 결제 수: {})", 
                    memberId, productIdLong, existingPayments.size());
            }
        } catch (Exception e) {
            logger.error("❌ 결제 생성 중 오류 발생: 회원 ID={}, 상품 ID={}, 오류: {}", 
                memberId, productIdLong, e.getMessage(), e);
            // 결제 생성 실패해도 상품 할당은 계속 진행
            // 누적 결제 금액은 MemberService에서 MemberProduct 기반으로 자동 계산됨
            // 예외를 다시 던지지 않음 (상품 할당이 성공하도록 보장)
        }
    }
    
    // 결제 관리 번호 생성 (PaymentController의 로직 재사용)
    private String generatePaymentNumber() {
        try {
            // 올해 연도
            int year = LocalDate.now().getYear();
            
            // 올해 결제 중 가장 큰 번호 찾기
            List<Payment> allPayments = paymentRepository.findAll();
            List<Payment> thisYearPayments = allPayments.stream()
                    .filter(p -> p.getPaymentNumber() != null && 
                               p.getPaymentNumber().startsWith("PAY-" + year + "-"))
                    .collect(Collectors.toList());
            
            int maxNumber = 0;
            for (Payment p : thisYearPayments) {
                try {
                    String numberPart = p.getPaymentNumber().substring(("PAY-" + year + "-").length());
                    int num = Integer.parseInt(numberPart);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                } catch (Exception e) {
                    // 번호 파싱 실패는 무시
                }
            }
            
            // 다음 번호 생성
            int nextNumber = maxNumber + 1;
            return String.format("PAY-%d-%04d", year, nextNumber);
        } catch (Exception e) {
            logger.warn("결제 관리 번호 생성 실패, 타임스탬프 기반 번호 사용", e);
            // 실패 시 타임스탬프 기반 번호 생성
            return "PAY-" + System.currentTimeMillis();
        }
    }
    
    // 회원의 모든 상품 할당 제거 (해당 상품에 대한 결제도 함께 제거)
    @DeleteMapping("/{memberId}/products")
    @Transactional
    public ResponseEntity<Void> removeAllProductsFromMember(@PathVariable Long memberId) {
        try {
            if (memberId == null) {
                return ResponseEntity.badRequest().build();
            }
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
                        if (payment != null) {
                            paymentRepository.delete(payment);
                            logger.debug("상품 할당 제거 시 결제도 함께 제거: Payment ID={}, Member ID={}, Product ID={}", 
                                payment.getId(), memberId, productId);
                        }
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
    @Transactional
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
            
            // 코치 설정 (선택사항 - 상품 할당 시 상품의 코치가 자동으로 배정됨)
            // 회원 가입 시 코치를 직접 설정하지 않아도 됨
            if (requestData.get("coach") != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> coachMap = (Map<String, Object>) requestData.get("coach");
                if (coachMap != null && coachMap.get("id") != null) {
                    Long coachId = ((Number) coachMap.get("id")).longValue();
                    Optional<Coach> coachOpt = coachRepository.findById(coachId);
                    if (coachOpt.isPresent()) {
                        member.setCoach(coachOpt.get());
                        logger.info("회원 가입 시 코치 직접 설정: 코치 ID={}", coachId);
                    } else {
                        logger.warn("코치를 찾을 수 없습니다. ID: {}", coachId);
                        member.setCoach(null);
                    }
                }
            } else {
                // 코치가 지정되지 않으면 null로 설정 (상품 할당 시 자동 배정됨)
                member.setCoach(null);
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
            if (createdMember == null) {
                throw new IllegalStateException("회원 생성에 실패했습니다.");
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
            memberMap.put("swingSpeed", createdMember.getSwingSpeed());
            memberMap.put("exitVelocity", createdMember.getExitVelocity());
            memberMap.put("pitchingSpeed", createdMember.getPitchingSpeed());
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
            memberMap.put("swingSpeed", updatedMember.getSwingSpeed());
            memberMap.put("exitVelocity", updatedMember.getExitVelocity());
            memberMap.put("pitchingSpeed", updatedMember.getPitchingSpeed());
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

    @DeleteMapping("/all")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteAllMembers() {
        Map<String, Object> response = new HashMap<>();
        try {
            logger.warn("⚠️ 회원 전체 삭제 요청 시작");
            long memberCount = memberRepository.count();
            logger.warn("⚠️ 삭제될 회원 수: {}명", memberCount);
            
            memberService.deleteAllMembers();
            
            logger.warn("⚠️ 회원 전체 삭제 완료: {}명 삭제됨", memberCount);
            response.put("success", true);
            response.put("message", String.format("모든 회원이 삭제되었습니다. (총 %d명)", memberCount));
            response.put("deletedCount", memberCount);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("회원 전체 삭제 중 오류 발생: {}", e.getMessage(), e);
            response.put("success", false);
            response.put("error", e.getMessage());
            response.put("message", "회원 전체 삭제 중 오류가 발생했습니다: " + e.getMessage());
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
            memberMap.put("swingSpeed", member.getSwingSpeed());
            memberMap.put("exitVelocity", member.getExitVelocity());
            memberMap.put("pitchingSpeed", member.getPitchingSpeed());
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
            Integer totalPayment = null;
            try {
                totalPayment = paymentRepository.sumTotalAmountByMemberId(member.getId());
                if (totalPayment == null) {
                    totalPayment = 0;
                }
                logger.debug("회원 누적 결제 금액 계산: Member ID={}, Total Payment={}", member.getId(), totalPayment);
            } catch (Exception e) {
                logger.warn("결제 금액 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage(), e);
                totalPayment = 0;
            }
            memberMap.put("totalPayment", totalPayment);
            
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
                try {
                    // DB에 저장된 remainingCount를 우선 사용 (수동 조정된 값 반영)
                    Integer mpRemainingCount = mp.getRemainingCount();
                    
                    // remainingCount가 null이면 다시 계산
                    if (mpRemainingCount == null) {
                        // 총 횟수: totalCount 또는 product.usageCount
                        Integer totalCount = mp.getTotalCount();
                        if (totalCount == null || totalCount <= 0) {
                            if (mp.getProduct() != null) {
                                totalCount = mp.getProduct().getUsageCount();
                            }
                            if (totalCount == null || totalCount <= 0) {
                                totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                            }
                        }
                        
                        // 실제 사용된 횟수 계산
                        Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                        if (usedCountByBooking == null) {
                            usedCountByBooking = 0L;
                        }
                        
                        Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
                        if (usedCountByAttendance == null) {
                            usedCountByAttendance = 0L;
                        }
                        
                        // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용
                        Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                        
                        // 잔여 횟수 = 총 횟수 - 실제 사용된 횟수
                        mpRemainingCount = totalCount - actualUsedCount.intValue();
                        if (mpRemainingCount < 0) {
                            mpRemainingCount = 0;
                        }
                    }
                    
                    // 음수 방지
                    if (mpRemainingCount < 0) {
                        mpRemainingCount = 0;
                    }
                    
                    remainingCount += mpRemainingCount;
                } catch (Exception e) {
                    logger.warn("회원 상품 잔여 횟수 계산 실패 (Member ID: {}, MemberProduct ID: {}): {}", 
                            member.getId(), mp.getId(), e.getMessage());
                    // 예외 발생 시 0으로 처리
                }
            }
            
            // DB에 저장된 remainingCount를 사용하므로 추가 차감 불필요
            // (수동 조정된 값을 존중하기 위해 주석 처리)
            /*
            // memberProduct가 없는 확정된 레슨 예약/출석도 차감
            Long unassignedConfirmedLessons = bookingRepository.countConfirmedLessonsWithoutMemberProduct(member.getId());
            if (unassignedConfirmedLessons == null) {
                unassignedConfirmedLessons = 0L;
            }
            
            Long unassignedAttendancesCount = attendanceRepository.countCheckedInAttendancesWithoutMemberProduct(member.getId());
            if (unassignedAttendancesCount == null) {
                unassignedAttendancesCount = 0L;
            }
            
            Long unassignedCount = unassignedAttendancesCount + unassignedConfirmedLessons;
            
            if (unassignedCount > 0 && !countPassProducts.isEmpty()) {
                int unassignedCountInt = unassignedCount.intValue();
                if (remainingCount >= unassignedCountInt) {
                    remainingCount -= unassignedCountInt;
                } else {
                    remainingCount = 0;
                }
            }
            */
            
            memberMap.put("remainingCount", remainingCount);
            
            // 기간권 정보 (한달권 등) - 시작/종료 날짜
            List<MemberProduct> periodPassProducts = memberProductRepository.findByMemberIdAndProductType(
                member.getId(), 
                Product.ProductType.MONTHLY_PASS
            );
            
            // 활성 기간권 중 가장 최근 것 선택
            MemberProduct activePeriodPass = periodPassProducts.stream()
                .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE && mp.getExpiryDate() != null)
                .filter(mp -> mp.getExpiryDate().isAfter(java.time.LocalDate.now()) || 
                             mp.getExpiryDate().isEqual(java.time.LocalDate.now()))
                .findFirst()
                .orElse(null);
            
            if (activePeriodPass != null) {
                memberMap.put("periodPassStartDate", activePeriodPass.getPurchaseDate() != null ? 
                    activePeriodPass.getPurchaseDate().toLocalDate() : null);
                memberMap.put("periodPassEndDate", activePeriodPass.getExpiryDate());
            } else {
                memberMap.put("periodPassStartDate", null);
                memberMap.put("periodPassEndDate", null);
            }
            
            return memberMap;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(membersWithTotalPayment);
    }
    
    // 회원 등급 마이그레이션 강제 실행 (디버깅/수동 실행용)
    @PostMapping("/migrate-grades")
    @Transactional
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
    
    // 특정 회원의 누락된 결제 생성 (기존 상품 할당에 대해)
    @PostMapping("/{memberId}/create-missing-payments")
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> createMissingPaymentsForMember(@PathVariable Long memberId) {
        Map<String, Object> result = new HashMap<>();
        try {
            logger.info("누락된 결제 생성 시작: 회원 ID={}", memberId);
            
            // 회원 존재 확인
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다. 회원 ID: " + memberId));
            
            // 회원의 모든 상품 할당 조회 (Product와 함께 eager loading)
            List<MemberProduct> memberProducts;
            try {
                memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
                logger.debug("회원 상품 할당 조회 완료: 회원 ID={}, 상품 수={}", memberId, memberProducts != null ? memberProducts.size() : 0);
            } catch (Exception e) {
                logger.error("회원 상품 할당 조회 실패: 회원 ID={}, 오류: {}", memberId, e.getMessage(), e);
                result.put("success", false);
                result.put("message", "회원 상품 할당 조회 중 오류 발생: " + e.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
            }
            
            if (memberProducts == null || memberProducts.isEmpty()) {
                logger.info("회원에게 할당된 상품이 없습니다: 회원 ID={}", memberId);
                result.put("success", true);
                result.put("message", "할당된 상품이 없어 결제를 생성할 수 없습니다.");
                result.put("created", 0);
                result.put("skipped", 0);
                result.put("errors", 0);
                return ResponseEntity.ok(result);
            }
            
            int createdCount = 0;
            int skippedCount = 0;
            int errorCount = 0;
            
            for (MemberProduct memberProduct : memberProducts) {
                Long productId = null;
                try {
                    // MemberProduct ID 확인
                    if (memberProduct == null) {
                        logger.warn("MemberProduct가 null입니다.");
                        errorCount++;
                        continue;
                    }
                    
                    Long memberProductId = memberProduct.getId();
                    if (memberProductId == null) {
                        logger.warn("MemberProduct ID가 null입니다.");
                        errorCount++;
                        continue;
                    }
                    
                    // Product 정보 확인 (lazy loading 방지를 위해 다시 조회)
                    Product product = null;
                    try {
                        // 먼저 MemberProduct에서 Product ID 가져오기
                        Product lazyProduct = memberProduct.getProduct();
                        if (lazyProduct == null) {
                            logger.warn("상품 정보가 없는 MemberProduct: MemberProduct ID={}", memberProductId);
                            skippedCount++;
                            continue;
                        }
                        productId = lazyProduct.getId();
                        if (productId == null) {
                            logger.warn("상품 ID가 없는 MemberProduct: MemberProduct ID={}", memberProductId);
                            skippedCount++;
                            continue;
                        }
                        
                        // Product를 다시 조회하여 lazy loading 문제 방지
                        product = productRepository.findById(productId).orElse(null);
                        if (product == null) {
                            logger.warn("상품을 찾을 수 없음: 상품 ID={}, MemberProduct ID={}", productId, memberProductId);
                            skippedCount++;
                            continue;
                        }
                    } catch (Exception e) {
                        logger.error("상품 정보 로드 실패: MemberProduct ID={}, 오류: {}", memberProductId, e.getMessage(), e);
                        errorCount++;
                        continue;
                    }
                    
                    // 이미 결제가 있는지 확인
                    List<Payment> existingPayments;
                    try {
                        existingPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(memberId, productId);
                    } catch (Exception e) {
                        logger.error("기존 결제 조회 실패: 회원 ID={}, 상품 ID={}, 오류: {}", memberId, productId, e.getMessage(), e);
                        errorCount++;
                        continue;
                    }
                    
                    if (!existingPayments.isEmpty()) {
                        logger.debug("이미 결제가 존재함: 회원 ID={}, 상품 ID={}, 기존 결제 수={}", 
                            memberId, productId, existingPayments.size());
                        skippedCount++;
                        continue;
                    }
                    
                    // 상품 가격 확인
                    Integer productPrice = product.getPrice();
                    if (productPrice == null || productPrice <= 0) {
                        logger.warn("상품 가격이 없거나 0원: 회원 ID={}, 상품 ID={}", memberId, productId);
                        skippedCount++;
                        continue;
                    }
                    
                    // 결제 생성
                    Payment payment = new Payment();
                    payment.setMember(member);
                    payment.setProduct(product);
                    payment.setAmount(productPrice);
                    payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_METHOD);
                    payment.setStatus(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_STATUS);
                    payment.setCategory(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_CATEGORY);
                    String productName = product.getName() != null ? 
                        product.getName() : "상품 ID: " + productId;
                    payment.setMemo("상품 할당 (후처리): " + productName);
                    
                    // paidAt과 createdAt 설정
                    LocalDateTime purchaseDate = memberProduct.getPurchaseDate();
                    if (purchaseDate == null) {
                        purchaseDate = LocalDateTime.now();
                    }
                    payment.setPaidAt(purchaseDate);
                    payment.setCreatedAt(LocalDateTime.now());
                    
                    // Payment 저장 시도
                    Payment savedPayment;
                    try {
                        // Payment 객체 유효성 검사
                        if (payment.getMember() == null) {
                            logger.error("Payment member가 null입니다: 회원 ID={}, 상품 ID={}", memberId, productId);
                            errorCount++;
                            continue;
                        }
                        if (payment.getProduct() == null) {
                            logger.error("Payment product가 null입니다: 회원 ID={}, 상품 ID={}", memberId, productId);
                            errorCount++;
                            continue;
                        }
                        if (payment.getAmount() == null || payment.getAmount() <= 0) {
                            logger.error("Payment amount가 유효하지 않습니다: 회원 ID={}, 상품 ID={}, 금액={}", 
                                memberId, productId, payment.getAmount());
                            errorCount++;
                            continue;
                        }
                        if (payment.getPaymentMethod() == null) {
                            logger.error("Payment paymentMethod가 null입니다: 회원 ID={}, 상품 ID={}", memberId, productId);
                            errorCount++;
                            continue;
                        }
                        if (payment.getStatus() == null) {
                            logger.error("Payment status가 null입니다: 회원 ID={}, 상품 ID={}", memberId, productId);
                            errorCount++;
                            continue;
                        }
                        if (payment.getPaidAt() == null) {
                            logger.error("Payment paidAt이 null입니다: 회원 ID={}, 상품 ID={}", memberId, productId);
                            errorCount++;
                            continue;
                        }
                        if (payment.getCreatedAt() == null) {
                            logger.error("Payment createdAt이 null입니다: 회원 ID={}, 상품 ID={}", memberId, productId);
                            errorCount++;
                            continue;
                        }
                        
                        savedPayment = paymentRepository.save(payment);
                        // 저장 후 즉시 flush하여 제약 조건 위반 등을 즉시 확인
                        paymentRepository.flush();
                        createdCount++;
                        logger.info("누락된 결제 생성 완료: Payment ID={}, 회원 ID={}, 상품 ID={}, 금액={}", 
                            savedPayment.getId(), memberId, productId, productPrice);
                    } catch (DataIntegrityViolationException e) {
                        logger.error("결제 저장 실패 (데이터 무결성 위반): 회원 ID={}, 상품 ID={}, 오류: {}", 
                            memberId, productId, e.getMessage(), e);
                        if (e.getCause() != null) {
                            logger.error("원인: {}", e.getCause().getMessage());
                        }
                        errorCount++;
                        continue;
                    } catch (jakarta.validation.ConstraintViolationException e) {
                        logger.error("결제 저장 실패 (제약 조건 위반): 회원 ID={}, 상품 ID={}, 오류: {}", 
                            memberId, productId, e.getMessage(), e);
                        errorCount++;
                        continue;
                    }
                        
                } catch (Exception e) {
                    errorCount++;
                    logger.error("결제 생성 실패: 회원 ID={}, MemberProduct ID={}, Product ID={}, 오류 타입: {}, 오류: {}", 
                        memberId, 
                        memberProduct != null ? memberProduct.getId() : "null",
                        productId,
                        e.getClass().getName(),
                        e.getMessage(), 
                        e);
                    e.printStackTrace();
                }
            }
            
            result.put("success", true);
            result.put("message", String.format("결제 생성 완료: 생성=%d건, 건너뜀=%d건, 오류=%d건", 
                createdCount, skippedCount, errorCount));
            result.put("created", createdCount);
            result.put("skipped", skippedCount);
            result.put("errors", errorCount);
            
            logger.info("누락된 결제 생성 완료: 회원 ID={}, 생성={}건, 건너뜀={}건, 오류={}건", 
                memberId, createdCount, skippedCount, errorCount);
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("누락된 결제 생성 실패: {}", e.getMessage());
            result.put("success", false);
            result.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(result);
        } catch (Exception e) {
            logger.error("누락된 결제 생성 중 오류 발생: 회원 ID={}, 오류 타입: {}, 오류 메시지: {}", 
                memberId, e.getClass().getName(), e.getMessage(), e);
            e.printStackTrace();
            
            // 더 자세한 에러 정보 반환
            result.put("success", false);
            result.put("message", "결제 생성 중 오류 발생: " + e.getMessage());
            result.put("errorType", e.getClass().getName());
            
            // 원인 예외가 있으면 추가 정보 제공
            if (e.getCause() != null) {
                result.put("cause", e.getCause().getMessage());
                result.put("causeType", e.getCause().getClass().getName());
            }
            
            // 스택 트레이스 일부 포함 (디버깅용)
            java.io.StringWriter sw = new java.io.StringWriter();
            java.io.PrintWriter pw = new java.io.PrintWriter(sw);
            e.printStackTrace(pw);
            String stackTrace = sw.toString();
            // 스택 트레이스가 너무 길면 앞부분만
            if (stackTrace.length() > 1000) {
                stackTrace = stackTrace.substring(0, 1000) + "... (truncated)";
            }
            result.put("stackTrace", stackTrace);
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }
    
    // 모든 회원의 누락된 결제 일괄 생성
    @PostMapping("/batch/create-missing-payments")
    public ResponseEntity<Map<String, Object>> createMissingPaymentsForAllMembers() {
        Map<String, Object> result = new HashMap<>();
        int totalCreated = 0;
        int totalSkipped = 0;
        int totalErrors = 0;
        
        try {
            logger.info("모든 회원의 누락된 결제 일괄 생성 시작");
            
            // 모든 회원 조회
            List<Member> allMembers = memberRepository.findAll();
            logger.info("총 {}명의 회원에 대해 누락된 결제 생성 시작", allMembers.size());
            
            // 각 회원별로 별도 트랜잭션으로 처리 (한 회원의 오류가 전체를 롤백하지 않도록)
            for (Member member : allMembers) {
                try {
                    logger.info("회원 ID={} (이름: {})의 누락된 결제 생성 시작", member.getId(), member.getName());
                    
                    // 각 회원별로 별도 트랜잭션으로 실행
                    Map<String, Object> memberResult = null;
                    try {
                        logger.debug("회원 ID={}의 트랜잭션 시작", member.getId());
                        Object resultObj = transactionTemplate.execute(status -> {
                            try {
                                logger.debug("회원 ID={}의 createMissingPaymentsForMemberInternal 호출 시작", member.getId());
                                Map<String, Object> internalResult = createMissingPaymentsForMemberInternal(member.getId());
                                logger.debug("회원 ID={}의 createMissingPaymentsForMemberInternal 완료: {}", member.getId(), internalResult);
                                return internalResult;
                            } catch (IllegalArgumentException e) {
                                // 회원을 찾을 수 없는 경우는 오류가 아니라 건너뛰기
                                logger.warn("회원 ID={}를 찾을 수 없습니다: {}", member.getId(), e.getMessage());
                                Map<String, Object> skipResult = new HashMap<>();
                                skipResult.put("created", 0);
                                skipResult.put("skipped", 1);
                                skipResult.put("errors", 0);
                                return skipResult;
                            } catch (Exception e) {
                                logger.error("회원 ID={}의 누락된 결제 생성 중 트랜잭션 내부 오류: 타입={}, 메시지={}", 
                                    member.getId(), e.getClass().getName(), e.getMessage(), e);
                                e.printStackTrace();
                                // 트랜잭션 롤백하지 않고 결과 반환
                                Map<String, Object> errorResult = new HashMap<>();
                                errorResult.put("created", 0);
                                errorResult.put("skipped", 0);
                                errorResult.put("errors", 1);
                                errorResult.put("errorMessage", e.getMessage());
                                errorResult.put("errorType", e.getClass().getName());
                                if (e.getCause() != null) {
                                    errorResult.put("cause", e.getCause().getMessage());
                                }
                                return errorResult;
                            }
                        });
                        
                        if (resultObj instanceof Map) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> resultMap = (Map<String, Object>) resultObj;
                            memberResult = resultMap;
                        } else {
                            logger.error("회원 ID={}의 트랜잭션 결과가 Map이 아닙니다: {}", member.getId(), resultObj != null ? resultObj.getClass().getName() : "null");
                            memberResult = new HashMap<>();
                            memberResult.put("created", 0);
                            memberResult.put("skipped", 0);
                            memberResult.put("errors", 1);
                        }
                    } catch (Exception e) {
                        logger.error("회원 ID={}의 트랜잭션 실행 중 예외 발생: {}", member.getId(), e.getMessage(), e);
                        e.printStackTrace();
                        // 트랜잭션 실행 자체가 실패한 경우
                        memberResult = new HashMap<>();
                        memberResult.put("created", 0);
                        memberResult.put("skipped", 0);
                        memberResult.put("errors", 1);
                        memberResult.put("errorMessage", e.getMessage());
                        memberResult.put("errorType", e.getClass().getName());
                    }
                    
                    if (memberResult != null) {
                        Integer created = (Integer) memberResult.get("created");
                        Integer skipped = (Integer) memberResult.get("skipped");
                        Integer errors = (Integer) memberResult.get("errors");
                        
                        logger.info("회원 ID={} 처리 결과: 생성={}, 건너뜀={}, 오류={}", 
                            member.getId(), created, skipped, errors);
                        
                        totalCreated += created != null ? created : 0;
                        totalSkipped += skipped != null ? skipped : 0;
                        totalErrors += errors != null ? errors : 0;
                        
                        // 오류가 발생한 경우 상세 정보 로깅
                        if (errors != null && errors > 0) {
                            String errorMsg = (String) memberResult.get("errorMessage");
                            String errorType = (String) memberResult.get("errorType");
                            logger.warn("회원 ID={}에서 오류 발생: 타입={}, 메시지={}", 
                                member.getId(), errorType, errorMsg);
                        }
                    } else {
                        logger.error("회원 ID={}의 처리 결과가 null입니다.", member.getId());
                        totalErrors++;
                    }
                } catch (Exception e) {
                    logger.error("회원 ID={}의 누락된 결제 생성 중 예외 발생: {}", member.getId(), e.getMessage(), e);
                    e.printStackTrace();
                    totalErrors++;
                }
            }
            
            result.put("success", true);
            result.put("message", String.format("누락된 결제 일괄 생성 완료: 총 생성=%d건, 건너뜀=%d건, 오류=%d건", 
                totalCreated, totalSkipped, totalErrors));
            result.put("totalCreated", totalCreated);
            result.put("totalSkipped", totalSkipped);
            result.put("totalErrors", totalErrors);
            result.put("totalMembers", allMembers.size());
            
            logger.info("모든 회원의 누락된 결제 일괄 생성 완료: 총 생성={}건, 건너뜀={}건, 오류={}건", 
                totalCreated, totalSkipped, totalErrors);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("누락된 결제 일괄 생성 중 오류 발생: {}", e.getMessage(), e);
            e.printStackTrace();
            result.put("success", false);
            result.put("message", "결제 일괄 생성 중 오류 발생: " + e.getMessage());
            result.put("errorType", e.getClass().getName());
            if (e.getCause() != null) {
                result.put("cause", e.getCause().getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }
    
    // 내부 메서드: 특정 회원의 누락된 결제 생성 (재사용 가능)
    private Map<String, Object> createMissingPaymentsForMemberInternal(Long memberId) {
        Map<String, Object> result = new HashMap<>();
        int createdCount = 0;
        int skippedCount = 0;
        int errorCount = 0;
        
        try {
            // 회원 존재 확인
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다. 회원 ID: " + memberId));
            
            // 트랜잭션 내부에서 MemberProduct 조회 (Product 정보를 함께 로드)
            List<MemberProduct> memberProducts = null;
            try {
                logger.debug("회원 ID={}의 MemberProduct 조회 시작", memberId);
                memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
                logger.info("회원 ID={}의 MemberProduct 수: {}건", memberId, memberProducts != null ? memberProducts.size() : 0);
            } catch (Exception e) {
                logger.error("회원 ID={}의 MemberProduct 조회 실패: 타입={}, 메시지={}", 
                    memberId, e.getClass().getName(), e.getMessage(), e);
                e.printStackTrace();
                result.put("created", 0);
                result.put("skipped", 0);
                result.put("errors", 1);
                result.put("errorMessage", "MemberProduct 조회 실패: " + e.getMessage());
                result.put("errorType", e.getClass().getName());
                if (e.getCause() != null) {
                    result.put("cause", e.getCause().getMessage());
                }
                return result;
            }
            
            if (memberProducts == null || memberProducts.isEmpty()) {
                logger.info("회원 ID={}의 MemberProduct가 없습니다. 건너뜁니다.", memberId);
                result.put("created", 0);
                result.put("skipped", 0);
                result.put("errors", 0);
                return result;
            }
            
            for (MemberProduct memberProduct : memberProducts) {
                try {
                    Long productId = null;
                    Long memberProductId = null;
                    
                    // MemberProduct ID 확인
                    if (memberProduct == null) {
                        logger.warn("MemberProduct가 null입니다.");
                        errorCount++;
                        continue;
                    }
                    
                    memberProductId = memberProduct.getId();
                    if (memberProductId == null) {
                        logger.warn("MemberProduct ID가 null입니다.");
                        errorCount++;
                        continue;
                    }
                    
                    // Product 정보 확인 (findByMemberIdWithProduct로 이미 로드됨)
                    Product product = null;
                    try {
                        // Product를 명시적으로 초기화
                        product = memberProduct.getProduct();
                        if (product == null) {
                            logger.warn("상품 정보가 없는 MemberProduct: MemberProduct ID={}", memberProductId);
                            skippedCount++;
                            continue;
                        }
                        
                        // Product ID 가져오기
                        productId = product.getId();
                        if (productId == null) {
                            logger.warn("상품 ID가 없는 MemberProduct: MemberProduct ID={}", memberProductId);
                            skippedCount++;
                            continue;
                        }
                        
                        // Product 정보를 명시적으로 접근하여 초기화
                        product.getName(); // Lazy loading 트리거
                        
                        logger.debug("MemberProduct ID={}, Product ID={}, Product Name={}", 
                            memberProductId, productId, product != null ? product.getName() : "null");
                    } catch (org.hibernate.LazyInitializationException e) {
                        logger.error("LazyInitializationException 발생: MemberProduct ID={}, 오류: {}", memberProductId, e.getMessage(), e);
                        e.printStackTrace();
                        errorCount++;
                        continue;
                    } catch (Exception e) {
                        logger.error("상품 정보 로드 실패: MemberProduct ID={}, 오류 타입: {}, 오류: {}", 
                            memberProductId, e.getClass().getName(), e.getMessage(), e);
                        e.printStackTrace();
                        errorCount++;
                        continue;
                    }
                    
                    // 이미 결제가 있는지 확인
                    List<Payment> existingPayments;
                    try {
                        existingPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(memberId, productId);
                    } catch (Exception e) {
                        logger.error("기존 결제 조회 실패: 회원 ID={}, 상품 ID={}, 오류: {}", memberId, productId, e.getMessage());
                        errorCount++;
                        continue;
                    }
                    
                    if (!existingPayments.isEmpty()) {
                        logger.debug("이미 결제가 존재함: 회원 ID={}, 상품 ID={}, 기존 결제 수={}", 
                            memberId, productId, existingPayments.size());
                        skippedCount++;
                        continue;
                    }
                    
                    // 상품 가격 확인
                    Integer productPrice = product.getPrice();
                    if (productPrice == null || productPrice <= 0) {
                        logger.warn("상품 가격이 없거나 0원: 회원 ID={}, 상품 ID={}", memberId, productId);
                        skippedCount++;
                        continue;
                    }
                    
                    // 결제 생성
                    Payment payment = new Payment();
                    payment.setMember(member);
                    payment.setProduct(product);
                    payment.setAmount(productPrice);
                    payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_METHOD);
                    payment.setStatus(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_STATUS);
                    payment.setCategory(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_CATEGORY);
                    // refundAmount는 Payment 모델의 @PrePersist에서 자동으로 0으로 설정됨
                    String productName = product.getName() != null ? 
                        product.getName() : "상품 ID: " + productId;
                    payment.setMemo("상품 할당 (후처리): " + productName);
                    
                    // paidAt과 createdAt 설정
                    LocalDateTime purchaseDate = memberProduct.getPurchaseDate();
                    if (purchaseDate == null) {
                        purchaseDate = LocalDateTime.now();
                    }
                    payment.setPaidAt(purchaseDate);
                    payment.setCreatedAt(LocalDateTime.now());
                    
                    // 결제 번호 자동 생성
                    try {
                        String paymentNumber = generatePaymentNumber();
                        payment.setPaymentNumber(paymentNumber);
                    } catch (Exception e) {
                        logger.warn("결제 번호 생성 실패, 계속 진행: {}", e.getMessage());
                    }
                    
                    // Payment 저장
                    try {
                        Payment savedPayment = paymentRepository.save(payment);
                        paymentRepository.flush();
                        createdCount++;
                        logger.info("✅ 누락된 결제 생성 완료: Payment ID={}, 회원 ID={}, 상품 ID={}, 금액={}, PaymentNumber={}", 
                            savedPayment.getId(), memberId, productId, productPrice,
                            savedPayment.getPaymentNumber() != null ? savedPayment.getPaymentNumber() : "N/A");
                    } catch (jakarta.validation.ConstraintViolationException e) {
                        logger.error("결제 저장 실패 (제약 조건 위반): 회원 ID={}, 상품 ID={}, 오류: {}", 
                            memberId, productId, e.getMessage(), e);
                        errorCount++;
                        continue;
                    } catch (org.springframework.dao.DataIntegrityViolationException e) {
                        logger.error("결제 저장 실패 (데이터베이스 제약 조건 위반): 회원 ID={}, 상품 ID={}, 오류: {}", 
                            memberId, productId, e.getMessage(), e);
                        errorCount++;
                        continue;
                    } catch (Exception e) {
                        logger.error("결제 저장 실패: 회원 ID={}, 상품 ID={}, 오류 타입: {}, 오류: {}", 
                            memberId, productId, e.getClass().getName(), e.getMessage(), e);
                        errorCount++;
                        continue;
                    }
                } catch (Exception e) {
                    logger.error("MemberProduct 처리 중 오류: 회원 ID={}, MemberProduct ID={}, 오류: {}", 
                        memberId, memberProduct != null ? memberProduct.getId() : "null", e.getMessage(), e);
                    e.printStackTrace();
                    errorCount++;
                    continue;
                }
            }
            
            logger.info("회원 ID={}의 누락된 결제 생성 완료: 생성={}건, 건너뜀={}건, 오류={}건", 
                memberId, createdCount, skippedCount, errorCount);
            result.put("created", createdCount);
            result.put("skipped", skippedCount);
            result.put("errors", errorCount);
            return result;
        } catch (Exception e) {
            logger.error("회원 ID={}의 누락된 결제 생성 중 전체 오류: {}", memberId, e.getMessage(), e);
            e.printStackTrace();
            result.put("created", createdCount);
            result.put("skipped", skippedCount);
            result.put("errors", errorCount + 1);
            result.put("errorMessage", e.getMessage());
            result.put("errorType", e.getClass().getName());
            return result;
        }
    }
}
