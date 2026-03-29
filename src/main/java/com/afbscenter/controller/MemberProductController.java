package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.model.Payment;
import com.afbscenter.util.MemberProductCoachResolver;
import com.afbscenter.util.PaymentPurchasePriceHelper;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberProductHistoryRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.service.MemberService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/member-products")
public class MemberProductController {

    private static final Logger logger = LoggerFactory.getLogger(MemberProductController.class);

    /** 잘못된 숫자 형식(문자열 등) 요청 시 API·프론트 공통 메시지 */
    private static final String MSG_NUMERIC_ONLY = "숫자만 입력해 주세요.";

    private static ResponseEntity<Map<String, Object>> badRequestNumericOnly() {
        Map<String, Object> error = new HashMap<>();
        error.put("error", MSG_NUMERIC_ONLY);
        return ResponseEntity.badRequest().body(error);
    }

    /**
     * JSON Number 또는 trim 후 정수 문자열을 int로 변환.
     * @return null — value가 null이거나 빈 문자열일 때
     * @throws NumberFormatException 숫자로 변환할 수 없을 때
     */
    private static Integer parseRequestInteger(Object value) throws NumberFormatException {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String s = value.toString().trim();
        if (s.isEmpty()) {
            return null;
        }
        return Integer.parseInt(s);
    }

    /**
     * 패키지형 이용권: DB의 잔여·총횟수와 {@code package_items_remaining} JSON을 동일하게 맞춤.
     * JSON 파싱/직렬화 실패 시 예외를 던져 트랜잭션 롤백 → DB만 바뀌고 JSON만 옛값인 불일치 방지.
     */
    private void syncPackageItemsRemainingJsonStrict(MemberProduct memberProduct, int newRemaining, int newTotal) {
        String raw = memberProduct.getPackageItemsRemaining();
        if (raw == null || raw.isEmpty()) {
            return;
        }
        try {
            ObjectMapper om = new ObjectMapper();
            List<Map<String, Object>> items = om.readValue(raw,
                    new TypeReference<List<Map<String, Object>>>() {});
            if (items.isEmpty()) {
                return;
            }
            if (items.size() == 1) {
                items.get(0).put("remaining", newRemaining);
                items.get(0).put("total", newTotal);
            } else {
                items.get(0).put("remaining", newRemaining);
                for (int i = 1; i < items.size(); i++) {
                    items.get(i).put("remaining", 0);
                }
            }
            memberProduct.setPackageItemsRemaining(om.writeValueAsString(items));
        } catch (Exception e) {
            logger.error("packageItemsRemaining 동기화 실패: MemberProduct ID={}, msg={}",
                    memberProduct.getId(), e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "패키지 이용권 정보(JSON)를 잔여·총횟수에 맞게 갱신할 수 없습니다. 데이터 형식을 확인하거나 관리자에게 문의해 주세요.", e);
        }
    }

    private final MemberProductRepository memberProductRepository;
    private final ProductRepository productRepository;
    private final com.afbscenter.repository.BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final AttendanceRepository attendanceRepository;
    private final com.afbscenter.repository.CoachRepository coachRepository;
    private final MemberProductHistoryRepository memberProductHistoryRepository;
    private final MemberService memberService;

    public MemberProductController(MemberProductRepository memberProductRepository,
                                   ProductRepository productRepository,
                                   com.afbscenter.repository.BookingRepository bookingRepository,
                                   PaymentRepository paymentRepository,
                                   AttendanceRepository attendanceRepository,
                                   com.afbscenter.repository.CoachRepository coachRepository,
                                   MemberProductHistoryRepository memberProductHistoryRepository,
                                   MemberService memberService) {
        this.memberProductRepository = memberProductRepository;
        this.productRepository = productRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.attendanceRepository = attendanceRepository;
        this.coachRepository = coachRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.memberService = memberService;
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
                    List<MemberProduct> all = memberProductRepository.findByMemberIdWithProduct(memberId);
                    memberProducts = all.stream().filter(mp -> mp.getStatus() == productStatus).collect(Collectors.toList());
                } catch (IllegalArgumentException e) {
                    memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
                }
            } else if (memberId != null) {
                // 연장된 이용권 포함: product·coach 함께 로드해 예약 화면에서 선택 가능
                memberProducts = memberProductRepository.findByMemberIdWithProduct(memberId);
            } else if (status != null) {
                // status만 있는 경우 (활성 이용권 전체 조회 등)
                try {
                    MemberProduct.Status productStatus = MemberProduct.Status.valueOf(status);
                    memberProducts = memberProductRepository.findByStatusWithProductAndCoach(productStatus);
                } catch (IllegalArgumentException e) {
                    memberProducts = memberProductRepository.findAllByDeletedAtIsNull();
                }
            } else {
                memberProducts = memberProductRepository.findAllByDeletedAtIsNull();
            }
            
            // Map으로 변환하여 반환 (순환 참조 방지)
            // 횟수권: DB 잔여 우선, 없을 때만 출석·예약 추정(총횟수만 변경해도 잔여 자동 변경 안 함)
            List<Map<String, Object>> result = memberProducts.stream().map(mp -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", mp.getId());
                map.put("purchaseDate", mp.getPurchaseDate());
                map.put("expiryDate", mp.getExpiryDate());
                
                // 회차권/패키지 remainingCount 계산
                final LocalDate today = LocalDate.now();
                Integer remainingCount = mp.getRemainingCount();
                Integer computedTotalCount = mp.getTotalCount();
                String statusName = mp.getStatus() != null ? mp.getStatus().name() : null;

                // 만료일이 지났는데 status가 ACTIVE로 남아있는 데이터는 API 응답 기준으로 만료로 정규화
                if ("ACTIVE".equals(statusName) && mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) {
                    statusName = "EXPIRED";
                    remainingCount = 0;
                }
                final boolean isTeamPackage = (mp.getProduct() != null && mp.getProduct().getType() == com.afbscenter.model.Product.ProductType.TEAM_PACKAGE);
                // 패키지 상품(TEAM_PACKAGE)만 패키지 로직 적용 (COUNT_PASS에 packageItemsRemaining이 잘못 들어간 경우 무시)
                if (isTeamPackage && mp.getPackageItemsRemaining() != null && !mp.getPackageItemsRemaining().isEmpty()) {
                    Integer totalCount = computedTotalCount;
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> pkgItems = om.readValue(mp.getPackageItemsRemaining(),
                            new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                        int sumRemaining = 0;
                        int sumTotal = 0;
                        for (Map<String, Object> item : pkgItems) {
                            Object r = item.get("remaining");
                            Object t = item.get("total");
                            if (r instanceof Number) sumRemaining += ((Number) r).intValue();
                            if (t instanceof Number) sumTotal += ((Number) t).intValue();
                        }
                        // 직접 설정(조정)으로 저장된 DB 값 우선 — 4 입력 시 13/13처럼 JSON 합으로 덮어쓰지 않음
                        if (mp.getRemainingCount() != null) {
                            remainingCount = mp.getRemainingCount();
                        } else {
                            remainingCount = sumRemaining;
                        }
                        if (totalCount == null || totalCount <= 0) totalCount = sumTotal > 0 ? sumTotal : mp.getTotalCount();
                        computedTotalCount = totalCount;
                    } catch (Exception e) {
                        logger.warn("패키지 잔여 합산 실패: MemberProduct ID={}", mp.getId(), e);
                        remainingCount = mp.getRemainingCount();
                    }
                    try {
                        List<com.afbscenter.model.MemberProductHistory> histories =
                            memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(mp.getId());
                        int deductCount = 0;
                        for (com.afbscenter.model.MemberProductHistory h : histories) {
                            if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.DEDUCT && h.getChangeAmount() != null) {
                                deductCount += Math.abs(h.getChangeAmount().intValue());
                            }
                        }
                        if (totalCount == null) totalCount = mp.getTotalCount() != null ? mp.getTotalCount() : 0;
                        // 체크인(DEDUCT) 건수 기준 상한: DB/조정이 DEDUCT보다 크게 나오지 않게 (4회 남았는데 9/10으로 보이는 것 방지)
                        if (totalCount != null) {
                            int fromHistory = Math.max(0, totalCount - deductCount);
                            if (remainingCount == null || remainingCount > fromHistory)
                                remainingCount = fromHistory;
                        }
                        computedTotalCount = totalCount;
                    } catch (Exception e) {
                        logger.warn("히스토리 기반 잔여 보정 실패: MemberProduct ID={}", mp.getId(), e);
                    }
                } else if (mp.getProduct() != null && mp.getProduct().getType() == com.afbscenter.model.Product.ProductType.COUNT_PASS) {
                    computedTotalCount = com.afbscenter.util.MemberProductCountPassHelper.resolveTotalCount(mp);
                    Long actualMemberId = memberId;
                    if (actualMemberId == null && mp.getMember() != null) {
                        try {
                            actualMemberId = mp.getMember().getId();
                        } catch (Exception e) {
                            logger.warn("Member ID 가져오기 실패: MemberProduct ID={}", mp.getId());
                        }
                    }
                    if (actualMemberId != null) {
                        remainingCount = com.afbscenter.util.MemberProductCountPassHelper.resolveRemainingForRead(
                                mp, actualMemberId, attendanceRepository, bookingRepository);
                    } else {
                        Integer st = mp.getRemainingCount();
                        remainingCount = st != null ? Math.max(0, st) : computedTotalCount;
                    }
                }
                
                map.put("remainingCount", remainingCount);
                map.put("totalCount", computedTotalCount);
                map.put("status", statusName);
                
                // 만료 여부 확인 (상태가 ACTIVE이지만 expiryDate가 지난 경우)
                if ("ACTIVE".equals(statusName) &&
                    mp.getExpiryDate() != null &&
                    mp.getExpiryDate().isBefore(today)) {
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
                
                // MemberProduct에 직접 배정된 코치만 반환 (미배정 집계용). Product 기본 코치는 product.coach에만 있음.
                Long memberProductCoachId = null;
                Map<String, Object> coachMap = null;
                try {
                    if (mp.getCoach() != null) {
                        memberProductCoachId = mp.getCoach().getId();
                        coachMap = new HashMap<>();
                        coachMap.put("id", memberProductCoachId);
                        coachMap.put("name", mp.getCoach().getName());
                    }
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패: MemberProduct ID={}", mp.getId(), e);
                }
                map.put("coachId", memberProductCoachId); // 이용권에 직접 배정된 코치 ID (null이면 미배정)
                map.put("coach", coachMap);

                // 이용권 번호 (없으면 null)
                map.put("voucherNumber", mp.getVoucherNumber());
                
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
            Integer extendDays;
            try {
                extendDays = parseRequestInteger(extendData.get("days"));
            } catch (NumberFormatException e) {
                return badRequestNumericOnly();
            }
            
            if (extendDays == null || extendDays <= 0) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "연장 횟수는 1 이상이어야 합니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 횟수권인 경우에만 횟수 추가
            Integer previousRemainingCount = memberProduct.getRemainingCount();
            Integer previousTotalForExtend = null; // 응답용·연장 전 총횟수
            Long sourceMemberProductIdForHistory = null; // 신규 행 생성 시 이전 이용권 ID
            Payment savedExtendPayment = null; // 연장 결제 저장 후 히스토리와 연결
            if (memberProduct.getProduct() != null && 
                memberProduct.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                
                MemberProduct oldMp = memberProduct;
                Product product = oldMp.getProduct();
                Member member = oldMp.getMember();
                
                // 현재 남은 횟수
                Integer currentRemaining = oldMp.getRemainingCount();
                if (currentRemaining == null) {
                    currentRemaining = 0;
                }
                
                boolean fullyUsedBeforeExtend = (previousRemainingCount == null || previousRemainingCount <= 0);
                // 소진·만료·잔여0은 "다시 쓰기=연장"으로 보고 기존 행은 그대로 두고 신규 이용권 행 생성 (구매·연장 이력 구분)
                boolean createNewMemberProduct =
                        oldMp.getStatus() == MemberProduct.Status.EXPIRED
                        || oldMp.getStatus() == MemberProduct.Status.USED_UP
                        || fullyUsedBeforeExtend;
                if (oldMp.getStatus() == MemberProduct.Status.ACTIVE && currentRemaining > 0) {
                    createNewMemberProduct = false;
                }
                
                if (createNewMemberProduct) {
                    sourceMemberProductIdForHistory = oldMp.getId();
                    previousTotalForExtend = oldMp.getTotalCount();
                    MemberProduct nu = new MemberProduct();
                    nu.setMember(member);
                    nu.setProduct(product);
                    try {
                        nu.setCoach(oldMp.getCoach());
                    } catch (Exception e) {
                        logger.debug("연장 신규행: 기존 코치 로드 생략: {}", e.getMessage());
                    }
                    nu.setPurchaseDate(LocalDateTime.now());
                    nu.setStatus(MemberProduct.Status.ACTIVE);
                    nu.setEndedAt(null);
                    nu.setPackageItemsRemaining(null);
                    try {
                        String voucherNumber = String.format(
                                "MP-%d-%d-%s",
                                member.getId(),
                                product.getId(),
                                nu.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyMMddHHmmss")));
                        nu.setVoucherNumber(voucherNumber);
                    } catch (Exception e) {
                        logger.warn("연장 신규행 이용권 번호 생성 실패: {}", e.getMessage());
                    }
                    if (product.getValidDays() != null && product.getValidDays() > 0) {
                        LocalDate purchaseDateLocal = nu.getPurchaseDate().toLocalDate();
                        nu.setExpiryDate(purchaseDateLocal.plusDays(product.getValidDays()));
                    }
                    memberProduct = nu;
                }
                
                // 총 횟수 확인 (연장 적용 대상 행 기준)
                Integer totalCount = memberProduct.getTotalCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = product.getUsageCount();
                    if (totalCount == null || totalCount <= 0) {
                        totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                    }
                    if (!createNewMemberProduct) {
                        memberProduct.setTotalCount(totalCount);
                    }
                }
                
                // 1) 잔여 0(또는 null) 소진 상태 연장: 잔여·총횟수를 연장 횟수로 맞춤 (예: 10회 연장 → 10/10)
                // 2) 잔여가 있는 경우: 잔여·총횟수 모두 연장 횟수만큼 증가 (예: 1+10→11/11, 10+10→20/20)
                Integer newRemainingCount;
                if (!createNewMemberProduct) {
                    previousTotalForExtend = memberProduct.getTotalCount();
                }
                if (fullyUsedBeforeExtend) {
                    newRemainingCount = extendDays;
                    memberProduct.setRemainingCount(newRemainingCount);
                    memberProduct.setTotalCount(extendDays);
                } else {
                    newRemainingCount = currentRemaining + extendDays;
                    memberProduct.setRemainingCount(newRemainingCount);
                    int baseTotal = (previousTotalForExtend != null && previousTotalForExtend > 0)
                            ? previousTotalForExtend
                            : (totalCount != null && totalCount > 0 ? totalCount : extendDays);
                    memberProduct.setTotalCount(baseTotal + extendDays);
                }
                
                // 기존 행 갱신일 때만 상태 복귀 (신규 행은 이미 ACTIVE)
                if (!createNewMemberProduct) {
                    if (memberProduct.getStatus() == MemberProduct.Status.USED_UP
                            || memberProduct.getStatus() == MemberProduct.Status.EXPIRED) {
                        memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                    }
                }
                
                logger.info("횟수권 연장: 대상 ID={}, 신규행={}, 이전 남은 횟수={}, 추가 횟수={}, 새 남은 횟수={}", 
                        memberProduct.getId(), createNewMemberProduct, previousRemainingCount, extendDays, newRemainingCount);
                
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
                                if (PaymentPurchasePriceHelper.isLikelyExtensionChargePayment(payment)) {
                                    continue;
                                }
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
                                    if (PaymentPurchasePriceHelper.isLikelyExtensionChargePayment(payment)) {
                                        continue;
                                    }
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
                            productTotalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
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
                        payment.setMemberProduct(memberProduct);
                        payment.setAmount(totalPrice);
                        payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentMethod());
                        payment.setStatus(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentStatus());
                        payment.setCategory(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentCategory());
                        String extendMemo = "이용권 연장: " + memberProduct.getProduct().getName() + " (" + extendDays + "회 추가)";
                        if (sourceMemberProductIdForHistory != null) {
                            extendMemo += " [신규 이용권 발급, 이전 ID=" + sourceMemberProductIdForHistory + "]";
                        }
                        payment.setMemo(extendMemo);
                        payment.setPaidAt(LocalDateTime.now());
                        payment.setCreatedAt(LocalDateTime.now());
                        savedExtendPayment = paymentRepository.save(payment);
                        
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
            
            // 총·잔여는 위 COUNT_PASS 분기에서 이미 반영함 (소진 시 10/10, 잔여 있으면 총·잔여 각각 +연장)
            Integer newTotalCount = memberProduct.getTotalCount();
            logger.info("이용권 연장 후 총횟수: MemberProduct ID={}, 새 총={}회, 새 잔여={}회", 
                    memberProduct.getId(), newTotalCount, memberProduct.getRemainingCount());
            
            MemberProduct saved = memberProductRepository.save(memberProduct);

            // 연장 CHARGE 이력 (금액·횟수는 Payment·MemberProduct와 일치, member_product_history에 보존)
            try {
                if (saved.getProduct() != null && saved.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                    com.afbscenter.model.MemberProductHistory history = new com.afbscenter.model.MemberProductHistory();
                    history.setMemberProduct(saved);
                    history.setMember(saved.getMember());
                    history.setTransactionDate(LocalDateTime.now());
                    history.setType(com.afbscenter.model.MemberProductHistory.TransactionType.CHARGE);
                    history.setChangeAmount(extendDays);
                    history.setRemainingCountAfter(saved.getRemainingCount());
                    if (savedExtendPayment != null) {
                        history.setPayment(savedExtendPayment);
                    }
                    String productLabel = saved.getProduct().getName() != null ? saved.getProduct().getName() : "상품";
                    String desc = "이용권 연장: " + productLabel + " (+" + extendDays + "회)";
                    if (savedExtendPayment != null && savedExtendPayment.getAmount() != null) {
                        desc += ", 결제 " + savedExtendPayment.getAmount() + "원";
                    }
                    if (sourceMemberProductIdForHistory != null) {
                        desc += " [신규 이용권 발급, 이전 ID=" + sourceMemberProductIdForHistory + "]";
                    }
                    history.setDescription(desc);
                    memberProductHistoryRepository.save(history);
                    logger.info("이용권 연장 히스토리 저장: MemberProduct ID={}, CHARGE +{}회, 잔여={}, Payment ID={}",
                            saved.getId(), extendDays, saved.getRemainingCount(),
                            savedExtendPayment != null ? savedExtendPayment.getId() : null);
                }
            } catch (Exception e) {
                logger.warn("이용권 연장 히스토리 저장 실패 (무시): {}", e.getMessage());
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("expiryDate", saved.getExpiryDate());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("previousRemainingCount", previousRemainingCount);
            result.put("newRemainingCount", saved.getRemainingCount());
            result.put("previousTotalCount", previousTotalForExtend);
            result.put("newTotalCount", newTotalCount);
            if (sourceMemberProductIdForHistory != null) {
                result.put("sourceMemberProductId", sourceMemberProductIdForHistory);
                result.put("createdNewMemberProduct", Boolean.TRUE);
            }
            
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
            return memberProductRepository.findByIdAndDeletedAtIsNull(id)
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
            MemberProduct memberProduct = memberProductRepository.findByIdAndDeletedAtIsNull(id)
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
                    totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
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
                if (memberProduct.getEndedAt() == null) memberProduct.setEndedAt(LocalDateTime.now());
            } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                // 잔여 횟수가 있으면 다시 ACTIVE로 변경
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                memberProduct.setEndedAt(null);
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
                    // 총 횟수: 목록/단건 재계산 API와 동일 — 회원 구매 건 totalCount 우선 (상품 마스터만 20→10으로 바꿔도 기존 20회권 유지)
                    int totalCount = com.afbscenter.util.MemberProductCountPassHelper.resolveTotalCount(memberProduct);
                    
                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(
                        memberId, memberProduct.getId());
                    if (usedCountByAttendance == null) usedCountByAttendance = 0L;
                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(memberProduct.getId());
                    if (usedCountByBooking == null) usedCountByBooking = 0L;
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
                        if (memberProduct.getEndedAt() == null) memberProduct.setEndedAt(LocalDateTime.now());
                    } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                        memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                        memberProduct.setEndedAt(null);
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
            @RequestBody Map<String, Object> setData,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            logger.info("===== 이용권 횟수 직접 설정 API 호출 =====");
            logger.info("MemberProduct ID: {}", id);
            logger.info("요청 데이터: {}", setData);
            
            // Member 함께 로드 (조정 히스토리 저장 시 member_id 필수)
            MemberProduct memberProduct = memberProductRepository.findByIdWithMember(id)
                    .orElse(memberProductRepository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다.")));
            
            logger.info("현재 상태 - 잔여: {}회, 총: {}회", 
                    memberProduct.getRemainingCount(), memberProduct.getTotalCount());
            
            // 횟수권 또는 패키지(대관 10회권 등)가 아니면 설정 불가
            boolean isCountPassSet = memberProduct.getProduct() != null
                && memberProduct.getProduct().getType() == Product.ProductType.COUNT_PASS;
            boolean hasPackageRemainingSet = memberProduct.getPackageItemsRemaining() != null
                && !memberProduct.getPackageItemsRemaining().isEmpty();
            if (memberProduct.getProduct() == null || (!isCountPassSet && !hasPackageRemainingSet)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "횟수권이 아닙니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 설정할 잔여 횟수 추출
            Integer newCount;
            try {
                newCount = parseRequestInteger(setData.get("count"));
            } catch (NumberFormatException e) {
                return badRequestNumericOnly();
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
            
            // 기존 총 횟수
            Integer totalCount = memberProduct.getTotalCount();
            boolean reactivatingFromUsedUp = (memberProduct.getStatus() == MemberProduct.Status.USED_UP && newCount > 0);
            if (reactivatingFromUsedUp || totalCount == null || totalCount <= 0) {
                totalCount = memberProduct.getProduct().getUsageCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                }
            }

            // 새 총 횟수(옵션) 추출
            Integer requestedTotal = null;
            if (setData.get("total") != null) {
                try {
                    requestedTotal = parseRequestInteger(setData.get("total"));
                } catch (NumberFormatException e) {
                    return badRequestNumericOnly();
                }
            }
            if (requestedTotal != null) {
                if (requestedTotal <= 0) {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "총 횟수는 1 이상이어야 합니다.");
                    return ResponseEntity.badRequest().body(error);
                }
                totalCount = requestedTotal;
            }
            memberProduct.setTotalCount(totalCount);

            // 잔여 설정: 총 횟수를 넘지 않도록 제한
            if (newCount > totalCount) {
                newCount = totalCount;
                logger.info("잔여가 총 횟수를 초과하여 총 횟수로 제한: {}회", newCount);
            }
            memberProduct.setRemainingCount(newCount);
            
            // 패키지 상품: JSON 동기화 실패 시 예외 → 저장 전체 롤백 (DB·JSON 불일치 방지)
            syncPackageItemsRemainingJsonStrict(memberProduct, newCount, totalCount);
            
            logger.info("저장 전 - 잔여: {}회, 총: {}회 (총 횟수 유지)", newCount, totalCount);
            
            // 상태 업데이트
            if (newCount == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
                if (memberProduct.getEndedAt() == null) memberProduct.setEndedAt(LocalDateTime.now());
            } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                memberProduct.setEndedAt(null);
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            // 변동 내역에 조정 기록 (직접 설정도 조정으로 표시)
            try {
                if (saved.getMember() != null && !newCount.equals(currentRemaining)) {
                    int adjustAmount = newCount - currentRemaining;
                    com.afbscenter.model.MemberProductHistory history = new com.afbscenter.model.MemberProductHistory();
                    history.setMemberProduct(saved);
                    history.setMember(saved.getMember());
                    history.setTransactionDate(LocalDateTime.now());
                    history.setType(com.afbscenter.model.MemberProductHistory.TransactionType.ADJUST);
                    history.setChangeAmount(adjustAmount);
                    history.setRemainingCountAfter(saved.getRemainingCount());
                    String productName = saved.getProduct() != null ? saved.getProduct().getName() : "이용권";
                    history.setDescription(String.format("수동 조정(직접 설정): %d회 → %d회 (%s)", currentRemaining, saved.getRemainingCount(), productName));
                    String processedBy = request != null ? (String) request.getAttribute("username") : null;
                    if (processedBy != null && !processedBy.isEmpty()) history.setProcessedBy(processedBy);
                    memberProductHistoryRepository.save(history);
                }
            } catch (Exception e) {
                logger.warn("직접 설정 히스토리 저장 실패: MemberProduct ID={}", saved.getId(), e);
            }
            
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
        } catch (ResponseStatusException e) {
            throw e; // 409 CONFLICT 등 + 트랜잭션 롤백 (JSON 동기화 실패)
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
            @RequestBody Map<String, Object> adjustData,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            logger.info("===== 이용권 횟수 상대 조정 API 호출 =====");
            logger.info("MemberProduct ID: {}", id);
            logger.info("요청 데이터: {}", adjustData);
            
            // Member 함께 로드 (조정 히스토리 저장 시 member_id 필수, 변동 내역에 표시되도록)
            MemberProduct memberProduct = memberProductRepository.findByIdWithMember(id)
                    .orElse(memberProductRepository.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다.")));
            
            logger.info("현재 상태 - 잔여: {}회, 총: {}회", 
                    memberProduct.getRemainingCount(), memberProduct.getTotalCount());
            
            // 횟수권 또는 패키지(대관 10회권 등)가 아니면 조정 불가
            boolean isCountPass = memberProduct.getProduct() != null
                && memberProduct.getProduct().getType() == Product.ProductType.COUNT_PASS;
            boolean hasPackageRemaining = memberProduct.getPackageItemsRemaining() != null
                && !memberProduct.getPackageItemsRemaining().isEmpty();
            if (memberProduct.getProduct() == null || (!isCountPass && !hasPackageRemaining)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "횟수권이 아닙니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 조정할 횟수 추출
            Integer adjustAmount;
            try {
                adjustAmount = parseRequestInteger(adjustData.get("amount"));
            } catch (NumberFormatException e) {
                return badRequestNumericOnly();
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
            
            // 총 횟수: 마감(USED_UP) 후 양수 조정(+N) 시 상품 기준(10회권이면 10)으로 초기화
            Integer totalCount = memberProduct.getTotalCount();
            boolean reactivatingFromUsedUp = (memberProduct.getStatus() == MemberProduct.Status.USED_UP && adjustAmount != null && adjustAmount > 0);
            if (reactivatingFromUsedUp || totalCount == null || totalCount <= 0) {
                totalCount = memberProduct.getProduct().getUsageCount();
                if (totalCount == null || totalCount <= 0) {
                    totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
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
            
            syncPackageItemsRemainingJsonStrict(memberProduct, newRemainingCount, totalCount);
            
            // 상태 업데이트
            if (newRemainingCount == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
                if (memberProduct.getEndedAt() == null) memberProduct.setEndedAt(LocalDateTime.now());
            } else if (memberProduct.getStatus() == MemberProduct.Status.USED_UP) {
                // 잔여 횟수가 있으면 다시 ACTIVE로 변경
                memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                memberProduct.setEndedAt(null);
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            // 변동 내역에 조정 기록 저장 (회원 상세에서 확인 가능)
            try {
                if (saved.getMember() != null) {
                    com.afbscenter.model.MemberProductHistory history = new com.afbscenter.model.MemberProductHistory();
                    history.setMemberProduct(saved);
                    history.setMember(saved.getMember());
                    history.setTransactionDate(LocalDateTime.now());
                    history.setType(com.afbscenter.model.MemberProductHistory.TransactionType.ADJUST);
                    history.setChangeAmount(adjustAmount);
                    history.setRemainingCountAfter(saved.getRemainingCount());
                    String productName = saved.getProduct() != null ? saved.getProduct().getName() : "이용권";
                    history.setDescription(String.format("수동 조정: %d회 → %d회 (%s)", currentRemaining, saved.getRemainingCount(), productName));
                    String processedBy = request != null ? (String) request.getAttribute("username") : null;
                    if (processedBy != null && !processedBy.isEmpty()) history.setProcessedBy(processedBy);
                    memberProductHistoryRepository.save(history);
                }
            } catch (Exception e) {
                logger.warn("조정 히스토리 저장 실패: MemberProduct ID={}", saved.getId(), e);
            }
            
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
        } catch (ResponseStatusException e) {
            throw e; // JSON 동기화 실패 시 롤백
        } catch (Exception e) {
            logger.error("이용권 횟수 조정 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "횟수 조정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 기간권 기간 수정 (시작일/종료일)
    // — 월정기·시간권(MONTHLY_PASS, TIME_PASS)이 이미 만료/소진된 뒤 "다시 쓰기"면 기존 행은 유지하고 신규 MemberProduct 행 생성 (이력 구분).
    // — package_items_remaining 이 있는 이용권(패키지 연동)은 기존처럼 동일 행만 수정 (패키지 로직 유지).
    @PutMapping("/{id}/update-period")
    @Transactional
    public ResponseEntity<Map<String, Object>> updatePeriod(
            @PathVariable Long id,
            @RequestBody Map<String, Object> periodData) {
        try {
            logger.info("===== 기간권 기간 수정 API 호출 =====");
            logger.info("MemberProduct ID: {}", id);
            logger.info("요청 데이터: {}", periodData);
            
            MemberProduct oldMp = memberProductRepository.findByIdWithMember(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품권을 찾을 수 없습니다."));
            
            logger.info("현재 상태 - 시작: {}, 종료: {}", 
                    oldMp.getPurchaseDate(), oldMp.getExpiryDate());
            
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
            
            java.time.LocalDateTime oldPurchaseDate = oldMp.getPurchaseDate();
            java.time.LocalDate oldExpiryDate = oldMp.getExpiryDate();
            
            String pir = oldMp.getPackageItemsRemaining();
            boolean hasPackageJson = pir != null && !pir.trim().isEmpty();
            
            Product product = oldMp.getProduct();
            boolean isPeriodPassType = product != null && product.getType() != null
                    && (product.getType() == Product.ProductType.MONTHLY_PASS
                    || product.getType() == Product.ProductType.TIME_PASS);
            
            java.time.LocalDate today = java.time.LocalDate.now();
            boolean periodEnded = oldMp.getStatus() == MemberProduct.Status.EXPIRED
                    || oldMp.getStatus() == MemberProduct.Status.USED_UP
                    || (oldMp.getExpiryDate() != null && oldMp.getExpiryDate().isBefore(today));
            
            boolean createNewMemberProduct = isPeriodPassType && !hasPackageJson && periodEnded;
            
            Long sourceMemberProductIdForHistory = null;
            MemberProduct memberProduct = oldMp;
            
            if (createNewMemberProduct) {
                sourceMemberProductIdForHistory = oldMp.getId();
                Member member = oldMp.getMember();
                MemberProduct nu = new MemberProduct();
                nu.setMember(member);
                nu.setProduct(product);
                try {
                    nu.setCoach(oldMp.getCoach());
                } catch (Exception e) {
                    logger.debug("기간권 신규행: 코치 로드 생략: {}", e.getMessage());
                }
                nu.setPurchaseDate(startDate.atStartOfDay());
                nu.setExpiryDate(endDate);
                nu.setPackageItemsRemaining(null);
                nu.setRemainingCount(null);
                nu.setTotalCount(null);
                try {
                    String voucherNumber = String.format(
                            "MP-%d-%d-%s",
                            member.getId(),
                            product.getId(),
                            nu.getPurchaseDate().format(DateTimeFormatter.ofPattern("yyMMddHHmmss")));
                    nu.setVoucherNumber(voucherNumber);
                } catch (Exception e) {
                    logger.warn("기간권 신규행 이용권 번호 생성 실패: {}", e.getMessage());
                }
                if (endDate.isBefore(today)) {
                    nu.setStatus(MemberProduct.Status.EXPIRED);
                    if (nu.getEndedAt() == null) {
                        nu.setEndedAt(LocalDateTime.now());
                    }
                } else {
                    nu.setStatus(MemberProduct.Status.ACTIVE);
                    nu.setEndedAt(null);
                }
                memberProduct = nu;
                logger.info("기간권 기간 수정: 만료·소진 건 → 신규 이용권 행 생성 (이전 ID={})", sourceMemberProductIdForHistory);
            } else {
                // 활성·유효기간 내 수정 또는 패키지 JSON 있음·횟수권 등 → 기존 행 갱신
                memberProduct.setPurchaseDate(startDate.atStartOfDay());
                memberProduct.setExpiryDate(endDate);
                if (endDate.isBefore(today)) {
                    memberProduct.setStatus(MemberProduct.Status.EXPIRED);
                    if (memberProduct.getEndedAt() == null) {
                        memberProduct.setEndedAt(LocalDateTime.now());
                    }
                } else if (memberProduct.getStatus() == MemberProduct.Status.EXPIRED) {
                    memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                    memberProduct.setEndedAt(null);
                }
            }
            
            MemberProduct saved = memberProductRepository.save(memberProduct);
            
            logger.info("저장 후 - ID={}, 시작: {}, 종료: {}", saved.getId(), saved.getPurchaseDate(), saved.getExpiryDate());
            logger.info("===== 기간권 기간 수정 완료 =====");
            
            Map<String, Object> result = new HashMap<>();
            result.put("id", saved.getId());
            result.put("oldStartDate", oldPurchaseDate != null ? oldPurchaseDate.toLocalDate() : null);
            result.put("oldEndDate", oldExpiryDate);
            result.put("newStartDate", saved.getPurchaseDate() != null ? saved.getPurchaseDate().toLocalDate() : null);
            result.put("newEndDate", saved.getExpiryDate());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            if (sourceMemberProductIdForHistory != null) {
                result.put("sourceMemberProductId", sourceMemberProductIdForHistory);
                result.put("createdNewMemberProduct", Boolean.TRUE);
            }
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
    
    // 개별 이용권 삭제 (소프트 삭제: 결제·히스토리 유지, 화면·업무 목록에서만 제외)
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

            if (memberProduct.getDeletedAt() != null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "이미 삭제 처리된 이용권입니다.");
                response.put("alreadyDeleted", true);
                return ResponseEntity.ok(response);
            }
            
            Long memberId = memberProduct.getMember() != null ? memberProduct.getMember().getId() : null;
            Long productId = memberProduct.getProduct() != null ? memberProduct.getProduct().getId() : null;
            
            // 관련 Booking의 memberProduct 참조를 null로 설정
            List<com.afbscenter.model.Booking> bookings = bookingRepository.findAllBookingsByMemberProductId(id);
            for (com.afbscenter.model.Booking booking : bookings) {
                booking.setMemberProduct(null);
                bookingRepository.save(booking);
            }

            memberService.softDeleteMemberProduct(memberProduct, null);
            
            logger.info("이용권 소프트 삭제 완료: MemberProduct ID={}, Member ID={}, Product ID={}", 
                id, memberId, productId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "이용권이 삭제되었습니다. (결제·이용 이력은 보관됩니다.)");
            response.put("softDelete", true);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("이용권 삭제 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "이용권 삭제 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // MemberProduct 코치 업데이트
    @PutMapping("/{id}/coach")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateMemberProductCoach(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            MemberProduct memberProduct = memberProductRepository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new IllegalArgumentException("이용권을 찾을 수 없습니다."));
            
            // 코치 ID 가져오기
            Long coachId = null;
            if (request.get("coachId") != null) {
                Object coachIdObj = request.get("coachId");
                if (coachIdObj instanceof Number) {
                    coachId = ((Number) coachIdObj).longValue();
                } else if (coachIdObj instanceof String) {
                    String coachIdStr = (String) coachIdObj;
                    if (!coachIdStr.trim().isEmpty() && !coachIdStr.equals("null")) {
                        try {
                            coachId = Long.parseLong(coachIdStr);
                        } catch (NumberFormatException e) {
                            logger.warn("코치 ID 형식이 올바르지 않습니다: {}", coachIdStr);
                        }
                    }
                }
            }
            
            // 코치 설정 또는 제거
            if (coachId != null && coachId > 0) {
                com.afbscenter.model.Coach coach = coachRepository.findById(coachId)
                        .orElse(null);
                
                if (coach != null) {
                    memberProduct.setCoach(coach);
                    logger.info("이용권 코치 업데이트: MemberProduct ID={}, Coach ID={}, Coach Name={}", 
                            id, coachId, coach.getName());
                } else {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "코치를 찾을 수 없습니다.");
                    return ResponseEntity.badRequest().body(error);
                }
            } else {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "이용권에서는 담당 코치를 해제할 수 없습니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            memberProductRepository.save(memberProduct);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "코치가 업데이트되었습니다.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("이용권 코치 업데이트 중 오류 발생. ID: {}", id, e);
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "코치 업데이트 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
