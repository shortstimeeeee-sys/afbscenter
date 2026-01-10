package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Payment;
import com.afbscenter.model.Product;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.service.MemberService;
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
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/members")
@CrossOrigin(origins = "*")
public class MemberController {

    private static final Logger logger = LoggerFactory.getLogger(MemberController.class);

    @Autowired
    private MemberService memberService;
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private ProductRepository productRepository;
    
    @Autowired
    private MemberProductRepository memberProductRepository;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Autowired
    private BookingRepository bookingRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllMembers() {
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
            
            // 횟수권 남은 횟수 계산 (ACTIVE 상태의 COUNT_PASS 타입 상품)
            int remainingCount = 0;
            List<MemberProduct> countPassProducts = memberProductRepository.findActiveCountPassByMemberId(member.getId());
            for (MemberProduct mp : countPassProducts) {
                if (mp.getRemainingCount() != null) {
                    remainingCount += mp.getRemainingCount();
                }
            }
            memberMap.put("remainingCount", remainingCount);
            
            return memberMap;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(membersWithTotalPayment);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Member> getMemberById(@PathVariable Long id) {
        try {
            // 기본 조회
            Optional<Member> memberOpt = memberRepository.findById(id);
            if (memberOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            Member member = memberOpt.get();
            
            // 코치 정보 안전하게 로드
            try {
                if (member.getCoach() != null) {
                    member.getCoach().getName(); // Lazy loading trigger
                }
            } catch (Exception e) {
                logger.warn("Coach 로드 실패 (회원 ID: {}): {}", id, e.getMessage());
            }
            
            // memberProducts를 안전하게 로드 (JOIN FETCH 사용)
            try {
                List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdWithProduct(id);
                if (memberProducts != null && !memberProducts.isEmpty()) {
                    // 각 MemberProduct의 product는 이미 JOIN FETCH로 로드됨
                    // 추가로 안전하게 접근하여 lazy loading 확인
                    for (MemberProduct mp : memberProducts) {
                        try {
                            if (mp != null && mp.getProduct() != null) {
                                mp.getProduct().getName(); // 이미 로드되어 있지만 확인
                            }
                        } catch (Exception e) {
                            // 개별 product 로드 실패는 무시
                            logger.warn("Product 로드 실패 (MemberProduct ID: {}): {}", (mp != null ? mp.getId() : "null"), e.getMessage());
                        }
                    }
                    member.setMemberProducts(memberProducts);
                } else {
                    member.setMemberProducts(new java.util.ArrayList<>());
                }
            } catch (Exception e) {
                logger.warn("MemberProducts 로드 실패 (회원 ID: {}): {}", id, e.getMessage(), e);
                member.setMemberProducts(new java.util.ArrayList<>());
            }
            
            return ResponseEntity.ok(member);
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
            // 회원 존재 여부 확인
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // JOIN FETCH를 사용하여 product와 member를 함께 로드 (lazy loading 방지)
            List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
            
            // 각 상품에 대해 실제 예약 데이터 기반 잔여 횟수 계산
            List<Map<String, Object>> productsWithRemainingCount = new java.util.ArrayList<>();
            
            for (MemberProduct mp : memberProducts) {
                Map<String, Object> productMap = new java.util.HashMap<>();
                productMap.put("id", mp.getId());
                productMap.put("purchaseDate", mp.getPurchaseDate());
                productMap.put("expiryDate", mp.getExpiryDate());
                productMap.put("totalCount", mp.getTotalCount());
                productMap.put("status", mp.getStatus().name());
                productMap.put("product", mp.getProduct());
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
                    
                    // 사용된 횟수: 해당 상품을 사용한 확정된 예약 수 (이전 날짜 포함)
                    Long usedCount = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                    if (usedCount == null) {
                        usedCount = 0L;
                    }
                    
                    // 잔여 횟수 = 총 횟수 - 사용된 횟수
                    Integer remainingCount = totalCount - usedCount.intValue();
                    if (remainingCount < 0) {
                        remainingCount = 0; // 음수 방지
                    }
                    
                    productMap.put("remainingCount", remainingCount);
                    productMap.put("usedCount", usedCount.intValue());
                    productMap.put("totalCount", totalCount);
                } else {
                    // 횟수권이 아닌 경우 기존 remainingCount 사용
                    productMap.put("remainingCount", mp.getRemainingCount());
                    productMap.put("usedCount", 0);
                }
                
                productsWithRemainingCount.add(productMap);
            }
            
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
        try {
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
            
            Integer productId = (Integer) request.get("productId");
            if (productId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            Product product = productRepository.findById(productId.longValue())
                    .orElseThrow(() -> new IllegalArgumentException("상품을 찾을 수 없습니다."));
            
            // 이미 할당된 상품인지 확인
            List<MemberProduct> existing = memberProductRepository.findByMemberId(memberId);
            boolean alreadyAssigned = existing.stream()
                    .anyMatch(mp -> mp.getProduct().getId().equals(productIdLong) && 
                                 mp.getStatus() == MemberProduct.Status.ACTIVE);
            
            if (alreadyAssigned) {
                return ResponseEntity.badRequest().build();
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
                memberProduct.setRemainingCount(usageCount); // 초기값은 총 횟수와 동일
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            // 상품 할당 시 자동으로 결제(Payment) 생성
            if (product.getPrice() != null && product.getPrice() > 0) {
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
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("회원 상품 할당 중 오류 발생. 회원 ID: {}, 상품 ID: {}", memberId, productIdLong != null ? productIdLong : "unknown", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원의 모든 상품 할당 제거 (결제는 유지)
    @DeleteMapping("/{memberId}/products")
    public ResponseEntity<Void> removeAllProductsFromMember(@PathVariable Long memberId) {
        try {
            List<MemberProduct> memberProducts = memberProductRepository.findByMemberId(memberId);
            memberProductRepository.deleteAll(memberProducts);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("회원 상품 할당 제거 중 오류 발생. 회원 ID: {}", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<Member> createMember(@RequestBody Member member) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(memberService.createMember(member));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Member> updateMember(@PathVariable Long id, @RequestBody Member member) {
        try {
            return ResponseEntity.ok(memberService.updateMember(id, member));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMember(@PathVariable Long id) {
        try {
            memberService.deleteMember(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
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
            
            // 횟수권 남은 횟수 계산 (ACTIVE 상태의 COUNT_PASS 타입 상품)
            int remainingCount = 0;
            List<MemberProduct> countPassProducts = memberProductRepository.findActiveCountPassByMemberId(member.getId());
            for (MemberProduct mp : countPassProducts) {
                if (mp.getRemainingCount() != null) {
                    remainingCount += mp.getRemainingCount();
                }
            }
            memberMap.put("remainingCount", remainingCount);
            
            return memberMap;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(membersWithTotalPayment);
    }
}
