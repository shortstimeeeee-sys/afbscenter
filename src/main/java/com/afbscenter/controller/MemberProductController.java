package com.afbscenter.controller;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.repository.PaymentRepository;
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
@CrossOrigin(origins = "http://localhost:8080")
public class MemberProductController {

    private static final Logger logger = LoggerFactory.getLogger(MemberProductController.class);

    @Autowired
    private MemberProductRepository memberProductRepository;

    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private com.afbscenter.repository.BookingRepository bookingRepository;
    
    @Autowired
    private PaymentRepository paymentRepository;

    // 상품권 통계 조회
    @GetMapping("/statistics")
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
            List<Map<String, Object>> result = memberProducts.stream().map(mp -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", mp.getId());
                map.put("purchaseDate", mp.getPurchaseDate());
                map.put("expiryDate", mp.getExpiryDate());
                map.put("remainingCount", mp.getRemainingCount());
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
                        productMap.put("price", mp.getProduct().getPrice());
                        map.put("product", productMap);
                    } catch (Exception e) {
                        logger.warn("Product 로드 실패: MemberProduct ID={}", mp.getId(), e);
                        map.put("product", null);
                    }
                } else {
                    map.put("product", null);
                }
                
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
                        totalCount = 10; // 기본값
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
                            productTotalCount = 10; // 기본값
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
                        payment.setPaymentMethod(Payment.PaymentMethod.CASH); // 기본값: 현금
                        payment.setStatus(Payment.PaymentStatus.COMPLETED);
                        payment.setCategory(Payment.PaymentCategory.PRODUCT_SALE);
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
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("expiryDate", saved.getExpiryDate());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("previousRemainingCount", previousRemainingCount);
            result.put("newRemainingCount", saved.getRemainingCount());
            result.put("message", "남은 횟수가 " + extendDays + "회 추가되었습니다. (이전: " + 
                    (previousRemainingCount != null ? previousRemainingCount : 0) + 
                    "회 → 현재: " + saved.getRemainingCount() + "회)");
            
            logger.info("횟수권 연장: MemberProduct ID={}, 추가 횟수={}, 새 남은 횟수={}", 
                    saved.getId(), extendDays, saved.getRemainingCount());
            
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
                    totalCount = 10; // 기본값
                }
            }
            
            // 실제 사용된 횟수 계산 (확정된 예약 중 해당 상품을 사용한 것)
            Long usedCount = bookingRepository.countConfirmedBookingsByMemberProductId(id);
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
                            totalCount = 10; // 기본값
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
    
    // 이용권 횟수 수동 조정 (+/- 가능)
    @PutMapping("/{id}/adjust-count")
    @Transactional
    public ResponseEntity<Map<String, Object>> adjustRemainingCount(
            @PathVariable Long id,
            @RequestBody Map<String, Object> adjustData) {
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
            
            // 조정할 횟수 추출
            Integer adjustAmount = null;
            if (adjustData.get("amount") != null) {
                if (adjustData.get("amount") instanceof Number) {
                    adjustAmount = ((Number) adjustData.get("amount")).intValue();
                } else {
                    adjustAmount = Integer.parseInt(adjustData.get("amount").toString());
                }
            }
            
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
                    totalCount = 10; // 기본값
                }
            }
            
            // 조정 후 잔여 횟수 계산
            Integer newRemainingCount = currentRemaining + adjustAmount;
            if (newRemainingCount < 0) {
                newRemainingCount = 0;
            }
            
            // 총 횟수보다 많아지면 총 횟수로 제한
            if (newRemainingCount > totalCount) {
                newRemainingCount = totalCount;
            }
            
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
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("previousRemainingCount", currentRemaining);
            result.put("adjustAmount", adjustAmount);
            result.put("newRemainingCount", newRemainingCount);
            result.put("totalCount", totalCount);
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", String.format("잔여 횟수가 %s%d회 조정되었습니다. (이전: %d회 → 현재: %d회)", 
                    adjustAmount >= 0 ? "+" : "", adjustAmount, currentRemaining, newRemainingCount));
            
            logger.info("이용권 횟수 수동 조정: MemberProduct ID={}, 조정={}회, 이전={}회, 현재={}회", 
                    saved.getId(), adjustAmount, currentRemaining, newRemainingCount);
            
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
}
