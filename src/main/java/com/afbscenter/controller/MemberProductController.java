package com.afbscenter.controller;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.AttendanceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/member-products")
public class MemberProductController {

    private static final Logger logger = LoggerFactory.getLogger(MemberProductController.class);

    private final MemberProductRepository memberProductRepository;
    private final ProductRepository productRepository;
    private final com.afbscenter.repository.BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final AttendanceRepository attendanceRepository;

    public MemberProductController(MemberProductRepository memberProductRepository,
                                   ProductRepository productRepository,
                                   com.afbscenter.repository.BookingRepository bookingRepository,
                                   PaymentRepository paymentRepository,
                                   AttendanceRepository attendanceRepository) {
        this.memberProductRepository = memberProductRepository;
        this.productRepository = productRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.attendanceRepository = attendanceRepository;
    }

    // 상품권 통계 조회
    @GetMapping("/statistics")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getStatistics() {
        try {
            List<MemberProduct> allProducts = memberProductRepository.findAll();
            
            // 전체 통계
            long totalIssued = allProducts.size();
            long activeCount = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE)
                    .count();
            long expiredCount = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.EXPIRED)
                    .count();
            long usedUpCount = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.USED_UP)
                    .count();
            
            // 만료된 상품권 (상태가 ACTIVE이지만 expiryDate가 지난 경우)
            long actuallyExpired = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE)
                    .filter(mp -> mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(LocalDate.now()))
                    .count();
            
            Map<String, Object> statistics = new HashMap<>();
            statistics.put("totalIssued", totalIssued); // 전체 발급 수
            statistics.put("activeCount", activeCount); // 활성 상태 수
            statistics.put("expiredCount", expiredCount + actuallyExpired); // 만료 수 (상태 + 실제 만료)
            statistics.put("usedUpCount", usedUpCount); // 소진 수
            
            // 상품 유형별 통계
            Map<String, Map<String, Long>> byProductType = new HashMap<>();
            allProducts.stream()
                    .collect(Collectors.groupingBy(
                            mp -> mp.getProduct() != null ? mp.getProduct().getType().name() : "UNKNOWN",
                            Collectors.counting()
                    ))
                    .forEach((type, count) -> {
                        Map<String, Long> typeStats = new HashMap<>();
                        typeStats.put("total", count);
                        typeStats.put("active", allProducts.stream()
                                .filter(mp -> mp.getProduct() != null && mp.getProduct().getType().name().equals(type))
                                .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE)
                                .count());
                        typeStats.put("expired", allProducts.stream()
                                .filter(mp -> mp.getProduct() != null && mp.getProduct().getType().name().equals(type))
                                .filter(mp -> mp.getStatus() == MemberProduct.Status.EXPIRED || 
                                            (mp.getStatus() == MemberProduct.Status.ACTIVE && 
                                             mp.getExpiryDate() != null && 
                                             mp.getExpiryDate().isBefore(LocalDate.now())))
                                .count());
                        typeStats.put("usedUp", allProducts.stream()
                                .filter(mp -> mp.getProduct() != null && mp.getProduct().getType().name().equals(type))
                                .filter(mp -> mp.getStatus() == MemberProduct.Status.USED_UP)
                                .count());
                        byProductType.put(type, typeStats);
                    });
            
            statistics.put("byProductType", byProductType);
            
            return ResponseEntity.ok(statistics);
        } catch (Exception e) {
            logger.error("상품권 통계 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 상품권 목록 조회 (필터링 가능)
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllMemberProducts(
            @RequestParam(required = false) Long memberId,
            @RequestParam(required = false) String status) {
        try {
            List<MemberProduct> memberProducts;
            
            if (memberId != null && status != null) {
                try {
                    MemberProduct.Status productStatus = MemberProduct.Status.valueOf(status);
                    memberProducts = memberProductRepository.findByMemberIdAndStatus(memberId, productStatus);
                } catch (IllegalArgumentException e) {
                    memberProducts = memberProductRepository.findByMemberId(memberId);
                }
            } else if (memberId != null) {
                memberProducts = memberProductRepository.findByMemberId(memberId);
            } else {
                memberProducts = memberProductRepository.findAll();
            }
            
            // Map으로 변환하여 반환 (순환 참조 방지)
            // 회차권인 경우 실제 사용 기록 기반으로 remainingCount 재계산
            List<Map<String, Object>> result = memberProducts.stream().map(mp -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", mp.getId());
                map.put("purchaseDate", mp.getPurchaseDate());
                map.put("expiryDate", mp.getExpiryDate());
                
                // 회차권인 경우 remainingCount 재계산
                Integer remainingCount = mp.getRemainingCount();
                if (mp.getProduct() != null && mp.getProduct().getType() == com.afbscenter.model.Product.ProductType.COUNT_PASS) {
                    // 총 횟수 계산
                    Integer totalCount = mp.getTotalCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = mp.getProduct().getUsageCount();
                        if (totalCount == null || totalCount <= 0) {
                            totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                        }
                    }
                    
                    // memberId 가져오기 (파라미터 또는 Member 객체에서)
                    Long actualMemberId = memberId;
                    if (actualMemberId == null && mp.getMember() != null) {
                        try {
                            actualMemberId = mp.getMember().getId();
                        } catch (Exception e) {
                            logger.warn("Member ID 가져오기 실패: MemberProduct ID={}", mp.getId());
                        }
                    }
                    
                    // 실제 사용된 횟수 계산
                    Long usedCountByAttendance = 0L;
                    Long usedCountByBooking = 0L;
                    try {
                        if (actualMemberId != null) {
                            usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(actualMemberId, mp.getId());
                            if (usedCountByAttendance == null) {
                                usedCountByAttendance = 0L;
                            }
                        }
                        usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                        if (usedCountByBooking == null) {
                            usedCountByBooking = 0L;
                        }
                    } catch (Exception e) {
                        logger.warn("사용 횟수 계산 실패: MemberProduct ID={}, 오류={}", mp.getId(), e.getMessage());
                    }
                    
                    // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용
                    Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                    
                    // remainingCount가 null이거나 0인 경우 재계산
                    // 새로 구매한 상품의 경우 remainingCount가 0으로 저장될 수 있으므로, 사용 기록이 없으면 totalCount로 설정
                    if (remainingCount == null || remainingCount == 0) {
                        if (actualUsedCount == 0) {
                            // 사용 기록이 없으면 totalCount로 설정 (새로 구매한 상품)
                            remainingCount = totalCount;
                            logger.debug("remainingCount 재계산: MemberProduct ID={}, totalCount={}, usedCount=0, 최종 remainingCount={}", 
                                    mp.getId(), totalCount, remainingCount);
                        } else {
                            // 사용 기록이 있으면 재계산
                            remainingCount = Math.max(0, totalCount - actualUsedCount.intValue());
                            logger.debug("remainingCount 재계산: MemberProduct ID={}, totalCount={}, usedCount={}, 최종 remainingCount={}", 
                                    mp.getId(), totalCount, actualUsedCount, remainingCount);
                        }
                    } else {
                        // remainingCount가 이미 있으면 실제 사용 기록과 비교하여 검증
                        Integer calculatedRemaining = Math.max(0, totalCount - actualUsedCount.intValue());
                        if (remainingCount != calculatedRemaining) {
                            logger.warn("remainingCount 불일치: MemberProduct ID={}, DB값={}, 계산값={}, totalCount={}, usedCount={}", 
                                    mp.getId(), remainingCount, calculatedRemaining, totalCount, actualUsedCount);
                            // DB 값이 잘못된 경우 계산값으로 덮어쓰기
                            if (actualUsedCount == 0 && remainingCount == 0) {
                                // 사용 기록이 없는데 remainingCount가 0이면 totalCount로 수정
                                remainingCount = totalCount;
                                logger.info("remainingCount 수정: MemberProduct ID={}, 0 -> {}", mp.getId(), remainingCount);
                            }
                        }
                    }
                }
                
                map.put("remainingCount", remainingCount);
                map.put("totalCount", mp.getTotalCount());
                map.put("status", mp.getStatus() != null ? mp.getStatus().name() : null);
                
                // 만료 여부 확인 (상태가 ACTIVE이지만 expiryDate가 지난 경우)
                if (mp.getStatus() == MemberProduct.Status.ACTIVE && 
                    mp.getExpiryDate() != null && 
                    mp.getExpiryDate().isBefore(LocalDate.now())) {
                    map.put("isActuallyExpired", true);
                } else {
                    map.put("isActuallyExpired", false);
                }
                
                // Member 정보
                if (mp.getMember() != null) {
                    try {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", mp.getMember().getId());
                        memberMap.put("name", mp.getMember().getName());
                        memberMap.put("memberNumber", mp.getMember().getMemberNumber());
                        map.put("member", memberMap);
                    } catch (Exception e) {
                        logger.warn("Member 로드 실패: MemberProduct ID={}", mp.getId(), e);
                        map.put("member", null);
                    }
                } else {
                    map.put("member", null);
                }
                
                // Product 정보
                if (mp.getProduct() != null) {
                    try {
                        Map<String, Object> productMap = new HashMap<>();
                        productMap.put("id", mp.getProduct().getId());
                        productMap.put("name", mp.getProduct().getName());
                        productMap.put("type", mp.getProduct().getType() != null ? mp.getProduct().getType().name() : null);
                        productMap.put("category", mp.getProduct().getCategory() != null ? mp.getProduct().getCategory().name() : null);
                        productMap.put("price", mp.getProduct().getPrice());
                        productMap.put("usageCount", mp.getProduct().getUsageCount()); // 상품의 usageCount 추가
                        
                        // Product의 코치 정보
                        if (mp.getProduct().getCoach() != null) {
                            try {
                                Map<String, Object> productCoachMap = new HashMap<>();
                                productCoachMap.put("id", mp.getProduct().getCoach().getId());
                                productCoachMap.put("name", mp.getProduct().getCoach().getName());
                                productMap.put("coach", productCoachMap);
                            } catch (Exception e) {
                                logger.warn("Product 코치 로드 실패: MemberProduct ID={}", mp.getId(), e);
                            }
                        }
                        
                        map.put("product", productMap);
                    } catch (Exception e) {
                        logger.warn("Product 로드 실패: MemberProduct ID={}", mp.getId(), e);
                        map.put("product", null);
                    }
                } else {
                    map.put("product", null);
                }
                
                // MemberProduct의 코치 정보 (우선순위: MemberProduct.coach > Product.coach)
                Map<String, Object> coachMap = null;
                try {
                    if (mp.getCoach() != null) {
                        coachMap = new HashMap<>();
                        coachMap.put("id", mp.getCoach().getId());
                        coachMap.put("name", mp.getCoach().getName());
                    } else if (mp.getProduct() != null && mp.getProduct().getCoach() != null) {
                        // MemberProduct에 코치가 없으면 Product의 코치 사용
                        coachMap = new HashMap<>();
                        coachMap.put("id", mp.getProduct().getCoach().getId());
                        coachMap.put("name", mp.getProduct().getCoach().getName());
                    }
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패: MemberProduct ID={}", mp.getId(), e);
                }
                map.put("coach", coachMap);
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("상품권 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 상품권 연장
    @PutMapping("/{id}/extend")
    @Transactional
    public ResponseEntity<Map<String, Object>> extendMemberProduct(
            @PathVariable Long id,
            @RequestBody Map<String, Object> extendData) {
        try {
            // member와 product를 함께 로드 (lazy loading 방지)
            MemberProduct memberProduct = memberProductRepository.findByIdWithMember(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다."));
            
            // 연장 일수 확인
            Integer extendDays = null;
            if (extendData.get("days") != null) {
                if (extendData.get("days") instanceof Number) {
                    extendDays = ((Number) extendData.get("days")).intValue();
                } else {
                    extendDays = Integer.parseInt(extendData.get("days").toString());
                }
            }
            
            if (extendDays == null || extendDays <= 0) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "연장 횟수는 1 이상이어야 합니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 횟수권인 경우에만 횟수 추가
            Integer previousRemainingCount = memberProduct.getRemainingCount();
            if (memberProduct.getProduct() != null && 
                memberProduct.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                
                // 현재 남은 횟수
                Integer currentRemaining = memberProduct.getRemainingCount();
                if (currentRemaining == null) {
                    currentRemaining = 0;
                }
                
                // 총 횟수 확인
                Integer totalCount = memberProduct.getTotalCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = memberProduct.getProduct().getUsageCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                    }
                    memberProduct.setTotalCount(totalCount);
                }
                
                // 연장일수만큼 횟수 추가 (총 횟수 제한 없이 추가)
                Integer newRemainingCount = currentRemaining + extendDays;
                
                memberProduct.setRemainingCount(newRemainingCount);
                
                // 사용 완료 상태였던 경우 활성 상태로 변경
                if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                    memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                }
                
                logger.info("횟수권 연장: MemberProduct ID={}, 이전 남은 횟수={}, 추가 횟수={}, 새 남은 횟수={}", 
                        memberProduct.getId(), previousRemainingCount, extendDays, newRemainingCount);
                
                // 연장 시 결제 기록 생성 (연장 횟수 * 단가)
                // 단가 = 실제 구매 금액 / 총 횟수
                if (memberProduct.getProduct() != null && memberProduct.getMember() != null) {
                    try {
                        // 실제 구매 금액 찾기 (MemberProduct 구매 시 결제 기록)
                        Integer actualPurchasePrice = null;
                        LocalDateTime purchaseDate = memberProduct.getPurchaseDate() != null ? memberProduct.getPurchaseDate() : LocalDateTime.now();
                        
                        // 구매일 전후 7일 범위 내의 결제 기록 찾기
                        LocalDateTime startDate = purchaseDate.minusDays(7);
                        LocalDateTime endDate = purchaseDate.plusDays(7);
                        
                        List<Payment> purchasePayments = paymentRepository.findPurchasePaymentByMemberAndProductInRange(
                                memberProduct.getMember().getId(),
                                memberProduct.getProduct().getId(),
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
                                    memberProduct.getMember().getId(),
                                    memberProduct.getProduct().getId(),
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
                            actualPurchasePrice = memberProduct.getProduct().getPrice();
                            if (actualPurchasePrice == null) {
                                actualPurchasePrice = 0;
                            }
                        }
                        
                        Integer productTotalCount = memberProduct.getProduct().getUsageCount();
                        if (productTotalCount == null || productTotalCount <= 0) {
                            productTotalCount = totalCount; // MemberProduct의 totalCount 사용
                        }
                        if (productTotalCount == null || productTotalCount <= 0) {
                            productTotalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                        }
                        
                        // 단가 계산 (실제 구매 금액 / 총 횟수)
                        Integer unitPrice = 0;
                        Integer totalPrice = 0;
                        if (productTotalCount > 0 && actualPurchasePrice > 0) {
                            unitPrice = actualPurchasePrice / productTotalCount;
                            totalPrice = unitPrice * extendDays;
                        }
                        
                        logger.info("이용권 연장 금액 계산: MemberProduct ID={}, 실제 구매 금액={}, 총 횟수={}, 단가={}, 연장 횟수={}, 연장 금액={}", 
                                memberProduct.getId(), actualPurchasePrice, productTotalCount, unitPrice, extendDays, totalPrice);
                        
                        // 결제 기록 생성 (금액이 0원이어도 기록)
                        Payment payment = new Payment();
                        payment.setMember(memberProduct.getMember());
                        payment.setProduct(memberProduct.getProduct());
                        payment.setAmount(totalPrice);
                        payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_METHOD);
                        payment.setStatus(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_STATUS);
                        payment.setCategory(com.afbscenter.constants.PaymentDefaults.DEFAULT_PAYMENT_CATEGORY);
                        payment.setMemo("이용권 연장: " + memberProduct.getProduct().getName() + " (" + extendDays + "회 추가)");
                        payment.setPaidAt(LocalDateTime.now());
                        payment.setCreatedAt(LocalDateTime.now());
                        paymentRepository.save(payment);
                        
                        logger.info("이용권 연장 결제 기록 생성: Member ID={}, Product ID={}, 연장 횟수={}, 금액={}", 
                                memberProduct.getMember().getId(), memberProduct.getProduct().getId(), extendDays, totalPrice);
                    } catch (Exception e) {
                        logger.error("이용권 연장 시 결제 기록 생성 실패: MemberProduct ID={}, 오류: {}", 
                                memberProduct.getId(), e.getMessage(), e);
                        // 결제 기록 생성 실패해도 연장은 계속 진행
                    }
                } else {
                    logger.warn("이용권 연장 시 결제 기록 생성 실패: MemberProduct ID={}, Product={}, Member={}", 
                            memberProduct.getId(), 
                            memberProduct.getProduct() != null ? memberProduct.getProduct().getId() : "null",
                            memberProduct.getMember() != null ? memberProduct.getMember().getId() : "null");
                }
            } else {
                // 횟수권이 아닌 경우 오류
                Map<String, Object> error = new HashMap<>();
                error.put("error", "횟수권만 연장할 수 있습니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 코치 정보 유지 확인 및 로깅
            if (memberProduct.getCoach() != null) {
                logger.info("이용권 연장 시 코치 정보 유지: MemberProduct ID={}, Coach ID={}, Coach Name={}", 
                        memberProduct.getId(), 
                        memberProduct.getCoach().getId(), 
                        memberProduct.getCoach().getName());
            } else {
                logger.debug("이용권 연장 시 코치 정보 없음: MemberProduct ID={}", memberProduct.getId());
            }
            
            // totalCount도 함께 업데이트 (연장된 횟수만큼 총 횟수도 증가)
            Integer newTotalCount = memberProduct.getTotalCount() + extendDays;
            memberProduct.setTotalCount(newTotalCount);
            logger.info("이용권 총 횟수 업데이트: MemberProduct ID={}, 기존 총={}회, 추가={}회, 새 총={}회", 
                    memberProduct.getId(), memberProduct.getTotalCount() - extendDays, extendDays, newTotalCount);
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("expiryDate", saved.getExpiryDate());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("previousRemainingCount", previousRemainingCount);
            result.put("newRemainingCount", saved.getRemainingCount());
            result.put("previousTotalCount", newTotalCount - extendDays);
            result.put("newTotalCount", newTotalCount);
            
            // 코치 정보도 응답에 포함
            if (saved.getCoach() != null) {
                Map<String, Object> coachMap = new HashMap<>();
                coachMap.put("id", saved.getCoach().getId());
                coachMap.put("name", saved.getCoach().getName());
                result.put("coach", coachMap);
            }
            
            result.put("message", "남은 횟수가 " + extendDays + "회 추가되었습니다. (이전: " + 
                    (previousRemainingCount != null ? previousRemainingCount : 0) + 
                    "회 → 현재: " + saved.getRemainingCount() + "회)");
            
            logger.info("횟수권 연장 완료: MemberProduct ID={}, 추가 횟수={}, 새 남은 횟수={}, 새 총 횟수={}", 
                    saved.getId(), extendDays, saved.getRemainingCount(), newTotalCount);
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("상품권을 찾을 수 없습니다. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            logger.error("상품권 연장 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "상품권 연장 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // 상품권 상세 조회
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMemberProductById(@PathVariable Long id) {
        try {
            return memberProductRepository.findById(id)
                    .map(mp -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("id", mp.getId());
                        map.put("purchaseDate", mp.getPurchaseDate());
                        map.put("expiryDate", mp.getExpiryDate());
                        map.put("remainingCount", mp.getRemainingCount());
                        map.put("totalCount", mp.getTotalCount());
                        map.put("status", mp.getStatus() != null ? mp.getStatus().name() : null);
                        
                        // 만료 여부 확인
                        if (mp.getStatus() == MemberProduct.Status.ACTIVE && 
                            mp.getExpiryDate() != null && 
                            mp.getExpiryDate().isBefore(LocalDate.now())) {
                            map.put("isActuallyExpired", true);
                        } else {
                            map.put("isActuallyExpired", false);
                        }
                        
                        // Member 정보
                        if (mp.getMember() != null) {
                            try {
                                Map<String, Object> memberMap = new HashMap<>();
                                memberMap.put("id", mp.getMember().getId());
                                memberMap.put("name", mp.getMember().getName());
                                memberMap.put("memberNumber", mp.getMember().getMemberNumber());
                                map.put("member", memberMap);
                            } catch (Exception e) {
                                logger.warn("Member 로드 실패: MemberProduct ID={}", mp.getId(), e);
                                map.put("member", null);
                            }
                        } else {
                            map.put("member", null);
                        }
                        
                        // Product 정보
                        if (mp.getProduct() != null) {
                            try {
                                Map<String, Object> productMap = new HashMap<>();
                                productMap.put("id", mp.getProduct().getId());
                                productMap.put("name", mp.getProduct().getName());
                                productMap.put("type", mp.getProduct().getType() != null ? mp.getProduct().getType().name() : null);
                                productMap.put("price", mp.getProduct().getPrice());
                                map.put("product", productMap);
                            } catch (Exception e) {
                                logger.warn("Product 로드 실패: MemberProduct ID={}", mp.getId(), e);
                                map.put("product", null);
                            }
                        } else {
                            map.put("product", null);
                        }
                        
                        return ResponseEntity.ok(map);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("상품권 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 이용권 잔여 횟수 재계산 (실제 예약 데이터 기반)
    @PostMapping("/{id}/recalculate")
    @Transactional
    public ResponseEntity<Map<String, Object>> recalculateRemainingCount(@PathVariable Long id) {
        try {
            MemberProduct memberProduct = memberProductRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다."));
            
            // 횟수권이 아닌 경우
            if (memberProduct.getProduct() == null || 
                memberProduct.getProduct().getType() != Product.ProductType.COUNT_PASS) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "횟수권이 아닙니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 총 횟수 계산
            Integer totalCount = memberProduct.getTotalCount();
            if (totalCount == null || totalCount <= 0) {
                totalCount = memberProduct.getProduct().getUsageCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                }
            }
            
            // 실제 사용된 횟수 계산
            // 주의: countConfirmedBookingsByMemberProductId는 이제 체크인된 예약만 카운트함
            // 출석 기록도 확인하여 더 정확한 계산
            Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(
                memberProduct.getMember().getId(), id);
            if (usedCountByAttendance == null) {
                usedCountByAttendance = 0L;
            }
            
            Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(id);
            if (usedCountByBooking == null) {
                usedCountByBooking = 0L;
            }
            
            // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용 (중복 방지)
            Long usedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
            
            // 잔여 횟수 재계산
            Integer remainingCount = totalCount - usedCount.intValue();
            if (remainingCount < 0) {
                remainingCount = 0;
            }
            
            // 업데이트
            memberProduct.setRemainingCount(remainingCount);
            memberProduct.setTotalCount(totalCount);
            
            // 상태 업데이트
            if (remainingCount == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
            } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                // 잔여 횟수가 있으면 다시 ACTIVE로 변경
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("totalCount", totalCount);
            result.put("usedCount", usedCount.intValue());
            result.put("remainingCount", remainingCount);
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", "잔여 횟수가 재계산되었습니다.");
            
            logger.info("이용권 잔여 횟수 재계산: MemberProduct ID={}, 총={}회, 사용={}회, 잔여={}회", 
                    saved.getId(), totalCount, usedCount, remainingCount);
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("상품권을 찾을 수 없습니다. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            logger.error("이용권 잔여 횟수 재계산 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "재계산 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 회원의 모든 이용권 잔여 횟수 재계산
    @PostMapping("/member/{memberId}/recalculate-all")
    @Transactional
    public ResponseEntity<Map<String, Object>> recalculateAllMemberProducts(@PathVariable Long memberId) {
        try {
            List<MemberProduct> memberProducts = memberProductRepository.findByMemberId(memberId);
            
            int recalculatedCount = 0;
            int totalRecalculated = 0;
            
            for (MemberProduct memberProduct : memberProducts) {
                // 횟수권인 경우만 재계산
                if (memberProduct.getProduct() != null && 
                    memberProduct.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                    
                    // 총 횟수 계산
                    Integer totalCount = memberProduct.getTotalCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = memberProduct.getProduct().getUsageCount();
                        if (totalCount == null || totalCount <= 0) {
                            totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                        }
                    }
                    
                    // 실제 사용된 횟수 계산
                    Long usedCount = bookingRepository.countConfirmedBookingsByMemberProductId(memberProduct.getId());
                    if (usedCount == null) {
                        usedCount = 0L;
                    }
                    
                    // 잔여 횟수 재계산
                    Integer remainingCount = totalCount - usedCount.intValue();
                    if (remainingCount < 0) {
                        remainingCount = 0;
                    }
                    
                    // 업데이트
                    memberProduct.setRemainingCount(remainingCount);
                    memberProduct.setTotalCount(totalCount);
                    
                    // 상태 업데이트
                    if (remainingCount == 0) {
                        memberProduct.setStatus(MemberProduct.Status.USED_UP);
                    } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                        memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                    }
                    
                    memberProductRepository.save(memberProduct);
                    recalculatedCount++;
                    totalRecalculated += remainingCount;
                }
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("recalculatedCount", recalculatedCount);
            result.put("totalRemainingCount", totalRecalculated);
            result.put("message", recalculatedCount + "개의 이용권이 재계산되었습니다.");
            
            logger.info("회원 이용권 전체 재계산: Member ID={}, 재계산={}개, 총 잔여={}회", 
                    memberId, recalculatedCount, totalRecalculated);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 이용권 재계산 중 오류 발생. Member ID: {}", memberId, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "재계산 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 이용권 횟수 직접 설정 (절대값)
    @PutMapping("/{id}/set-count")
    @Transactional
    public ResponseEntity<Map<String, Object>> setRemainingCount(
            @PathVariable Long id,
            @RequestBody Map<String, Object> setData) {
        try {
            logger.info("===== 이용권 횟수 직접 설정 API 호출 =====");
            logger.info("MemberProduct ID: {}", id);
            logger.info("요청 데이터: {}", setData);
            
            MemberProduct memberProduct = memberProductRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다."));
            
            logger.info("현재 상태 - 잔여: {}회, 총: {}회", 
                    memberProduct.getRemainingCount(), memberProduct.getTotalCount());
            
            // 횟수권이 아닌 경우
            if (memberProduct.getProduct() == null || 
                memberProduct.getProduct().getType() != Product.ProductType.COUNT_PASS) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "횟수권이 아닙니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 설정할 횟수 추출
            Integer newCount = null;
            if (setData.get("count") != null) {
                if (setData.get("count") instanceof Number) {
                    newCount = ((Number) setData.get("count")).intValue();
                } else {
                    newCount = Integer.parseInt(setData.get("count").toString());
                }
            }
            
            logger.info("설정할 횟수: {}회", newCount);
            
            if (newCount == null || newCount < 0) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "0 이상의 값을 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 현재 잔여 횟수
            Integer currentRemaining = memberProduct.getRemainingCount();
            if (currentRemaining == null) {
                currentRemaining = 0;
            }
            
            // 총 횟수 확인
            Integer totalCount = memberProduct.getTotalCount();
            if (totalCount == null || totalCount <= 0) {
                totalCount = memberProduct.getProduct().getUsageCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                }
            }
            
            // 잔여 횟수를 직접 설정할 때는 총 횟수도 함께 업데이트
            // (수동 조정된 값을 기준으로 새로운 기준선 설정)
            totalCount = newCount;
            memberProduct.setTotalCount(totalCount);
            
            // 업데이트
            memberProduct.setRemainingCount(newCount);
            
            logger.info("총 횟수도 함께 업데이트: {}회 → {}회", 
                    memberProduct.getTotalCount(), totalCount);
            
            logger.info("저장 전 - 잔여: {}회, 총: {}회", newCount, totalCount);
            
            // 상태 업데이트
            if (newCount == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
            } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                // 잔여 횟수가 있으면 다시 ACTIVE로 변경
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            logger.info("저장 후 - 잔여: {}회, 총: {}회", saved.getRemainingCount(), saved.getTotalCount());
            logger.info("===== 이용권 횟수 직접 설정 완료 =====");
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("previousRemainingCount", currentRemaining);
            result.put("newRemainingCount", saved.getRemainingCount());
            result.put("totalCount", saved.getTotalCount());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", String.format("잔여 횟수가 설정되었습니다. (이전: %d회 → 현재: %d회)", 
                    currentRemaining, saved.getRemainingCount()));
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("상품권을 찾을 수 없습니다. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            logger.error("이용권 횟수 설정 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "횟수 설정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 이용권 횟수 수동 조정 (+/- 가능)
    @PutMapping("/{id}/adjust-count")
    @Transactional
    public ResponseEntity<Map<String, Object>> adjustRemainingCount(
            @PathVariable Long id,
            @RequestBody Map<String, Object> adjustData) {
        try {
            logger.info("===== 이용권 횟수 상대 조정 API 호출 =====");
            logger.info("MemberProduct ID: {}", id);
            logger.info("요청 데이터: {}", adjustData);
            
            MemberProduct memberProduct = memberProductRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다."));
            
            logger.info("현재 상태 - 잔여: {}회, 총: {}회", 
                    memberProduct.getRemainingCount(), memberProduct.getTotalCount());
            
            // 횟수권이 아닌 경우
            if (memberProduct.getProduct() == null || 
                memberProduct.getProduct().getType() != Product.ProductType.COUNT_PASS) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "횟수권이 아닙니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 조정할 횟수 추출
            Integer adjustAmount = null;
            if (adjustData.get("amount") != null) {
                if (adjustData.get("amount") instanceof Number) {
                    adjustAmount = ((Number) adjustData.get("amount")).intValue();
                } else {
                    adjustAmount = Integer.parseInt(adjustData.get("amount").toString());
                }
            }
            
            logger.info("조정할 횟수: {}회", adjustAmount);
            
            if (adjustAmount == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "조정할 횟수를 입력해주세요. (양수: 추가, 음수: 차감)");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 현재 잔여 횟수
            Integer currentRemaining = memberProduct.getRemainingCount();
            if (currentRemaining == null) {
                currentRemaining = 0;
            }
            
            // 총 횟수 확인
            Integer totalCount = memberProduct.getTotalCount();
            if (totalCount == null || totalCount <= 0) {
                totalCount = memberProduct.getProduct().getUsageCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                }
            }
            
            // 조정 후 잔여 횟수 계산
            Integer newRemainingCount = currentRemaining + adjustAmount;
            logger.info("계산: {}회 + {}회 = {}회", currentRemaining, adjustAmount, newRemainingCount);
            
            if (newRemainingCount < 0) {
                logger.info("음수 방지: {}회 → 0회", newRemainingCount);
                newRemainingCount = 0;
            }
            
            // 잔여 횟수가 총 횟수를 초과하면 총 횟수도 함께 증가
            if (newRemainingCount > totalCount) {
                logger.info("이용권 총 횟수 자동 증가: MemberProduct ID={}, 기존 총={}회 → 새 총={}회", 
                        memberProduct.getId(), totalCount, newRemainingCount);
                totalCount = newRemainingCount;
            }
            
            logger.info("저장 전 - 잔여: {}회, 총: {}회", newRemainingCount, totalCount);
            
            // 업데이트
            memberProduct.setRemainingCount(newRemainingCount);
            memberProduct.setTotalCount(totalCount);
            
            // 상태 업데이트
            if (newRemainingCount == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
            } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                // 잔여 횟수가 있으면 다시 ACTIVE로 변경
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            logger.info("저장 후 - 잔여: {}회, 총: {}회", saved.getRemainingCount(), saved.getTotalCount());
            logger.info("===== 이용권 횟수 상대 조정 완료 =====");
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("previousRemainingCount", currentRemaining);
            result.put("adjustAmount", adjustAmount);
            result.put("newRemainingCount", saved.getRemainingCount());
            result.put("totalCount", saved.getTotalCount());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", String.format("잔여 횟수가 %s%d회 조정되었습니다. (이전: %d회 → 현재: %d회)", 
                    adjustAmount >= 0 ? "+" : "", adjustAmount, currentRemaining, saved.getRemainingCount()));
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("상품권을 찾을 수 없습니다. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            logger.error("이용권 횟수 조정 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "횟수 조정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 기간권 기간 수정 (시작일/종료일)
    @PutMapping("/{id}/update-period")
    @Transactional
    public ResponseEntity<Map<String, Object>> updatePeriod(
            @PathVariable Long id,
            @RequestBody Map<String, Object> periodData) {
        try {
            logger.info("===== 기간권 기간 수정 API 호출 =====");
            logger.info("MemberProduct ID: {}", id);
            logger.info("요청 데이터: {}", periodData);
            
            MemberProduct memberProduct = memberProductRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다."));
            
            logger.info("현재 상태 - 시작: {}, 종료: {}", 
                    memberProduct.getPurchaseDate(), memberProduct.getExpiryDate());
            
            // 시작일 추출
            String startDateStr = periodData.get("startDate") != null ? periodData.get("startDate").toString() : null;
            String endDateStr = periodData.get("endDate") != null ? periodData.get("endDate").toString() : null;
            
            if (startDateStr == null || endDateStr == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "시작일과 종료일을 모두 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }
            
            java.time.LocalDate startDate = java.time.LocalDate.parse(startDateStr);
            java.time.LocalDate endDate = java.time.LocalDate.parse(endDateStr);
            
            // 시작일이 종료일보다 늦으면 안됨
            if (startDate.isAfter(endDate)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "시작일은 종료일보다 늦을 수 없습니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 기존 시작일/종료일 저장 (로그용)
            java.time.LocalDateTime oldPurchaseDate = memberProduct.getPurchaseDate();
            java.time.LocalDate oldExpiryDate = memberProduct.getExpiryDate();
            
            // 시작일 업데이트 (purchaseDate를 LocalDate 기준 자정으로 설정)
            memberProduct.setPurchaseDate(startDate.atStartOfDay());
            
            // 종료일 업데이트
            memberProduct.setExpiryDate(endDate);
            
            // 만료 여부 확인 및 상태 업데이트
            java.time.LocalDate today = java.time.LocalDate.now();
            if (endDate.isBefore(today)) {
                memberProduct.setStatus(MemberProduct.Status.EXPIRED);
            } else if (memberProduct.getStatus() == MemberProduct.Status.EXPIRED) {
                // 만료된 상품이 종료일 연장으로 다시 활성화
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            logger.info("저장 후 - 시작: {}, 종료: {}", saved.getPurchaseDate(), saved.getExpiryDate());
            logger.info("===== 기간권 기간 수정 완료 =====");
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("oldStartDate", oldPurchaseDate != null ? oldPurchaseDate.toLocalDate() : null);
            result.put("oldEndDate", oldExpiryDate);
            result.put("newStartDate", saved.getPurchaseDate() != null ? saved.getPurchaseDate().toLocalDate() : null);
            result.put("newEndDate", saved.getExpiryDate());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", String.format("기간이 수정되었습니다. (시작: %s, 종료: %s)", 
                    startDate, endDate));
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("상품권을 찾을 수 없습니다. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            logger.error("기간권 기간 수정 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "기간 수정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 개별 이용권 삭제
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteMemberProduct(@PathVariable Long id) {
        try {
            if (id == null) {
                return ResponseEntity.badRequest().build();
            }
            
            MemberProduct memberProduct = memberProductRepository.findById(id)
                    .orElse(null);
            
            if (memberProduct == null) {
                return ResponseEntity.notFound().build();
            }
            
            Long memberId = memberProduct.getMember() != null ? memberProduct.getMember().getId() : null;
            Long productId = memberProduct.getProduct() != null ? memberProduct.getProduct().getId() : null;
            
            // 관련 Booking의 memberProduct 참조를 null로 설정
            List<com.afbscenter.model.Booking> bookings = bookingRepository.findAllBookingsByMemberProductId(id);
            for (com.afbscenter.model.Booking booking : bookings) {
                booking.setMemberProduct(null);
                bookingRepository.save(booking);
            }
            
            // 해당 상품에 대한 PRODUCT_SALE 결제 제거 (상품 할당과 함께 제거)
            if (memberId != null && productId != null) {
                List<Payment> productPayments = paymentRepository.findActiveProductPaymentsByMemberAndProduct(
                    memberId, productId);
                
                for (Payment payment : productPayments) {
                    if (payment != null) {
                        paymentRepository.delete(payment);
                        logger.debug("이용권 삭제 시 결제도 함께 제거: Payment ID={}, Member ID={}, Product ID={}", 
                            payment.getId(), memberId, productId);
                    }
                }
            }
            
            // MemberProduct 삭제
            memberProductRepository.delete(memberProduct);
            
            logger.info("이용권 삭제 완료: MemberProduct ID={}, Member ID={}, Product ID={}", 
                id, memberId, productId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "이용권이 삭제되었습니다.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("이용권 삭제 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "이용권 삭제 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
