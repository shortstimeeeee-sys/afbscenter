package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Payment;
import com.afbscenter.model.Product;
import com.afbscenter.model.ActionAuditLog;
import com.afbscenter.repository.ActionAuditLogRepository;
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
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
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
/**
 * 회원 상세/서브리소스 전용. URL은 기존과 동일: /api/members/{id}/ability-stats-context, /{memberId}/products, /bookings, /payments, /attendance, /product-history, /create-missing-payments
 */
public class MemberDetailController {

    private static final Logger logger = LoggerFactory.getLogger(MemberDetailController.class);

    private final MemberService memberService;
    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final ProductRepository productRepository;
    private final MemberProductRepository memberProductRepository;
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;
    private final com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository;
    private final TransactionTemplate transactionTemplate;
    private final ActionAuditLogRepository actionAuditLogRepository;

    public MemberDetailController(MemberService memberService,
                           MemberRepository memberRepository,
                           CoachRepository coachRepository,
                           ProductRepository productRepository,
                           MemberProductRepository memberProductRepository,
                           PaymentRepository paymentRepository,
                           BookingRepository bookingRepository,
                           AttendanceRepository attendanceRepository,
                           com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository,
                           org.springframework.transaction.PlatformTransactionManager transactionManager,
                           ActionAuditLogRepository actionAuditLogRepository) {
        this.memberService = memberService;
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.productRepository = productRepository;
        this.memberProductRepository = memberProductRepository;
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.actionAuditLogRepository = actionAuditLogRepository;
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
            // 람다 표현식에서 사용하기 위해 final 변수로 선언
            final Boolean skipPayment = request.get("skipPayment") != null ? (Boolean) request.get("skipPayment") : false;
            
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
            
            // 코치 설정: 요청에서 지정한 경우에만 설정 (이용권 1개당 1코치 지정, 상품 기본 코치 자동 채우지 않음)
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
            // 코치 미지정 시 null 유지 (상품 기본 코치로 채우지 않음 → 훈련 통계 미배정 건수와 일치)
            
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
                    int totalPackageCount = 0;
                    for (Map<String, Object> item : items) {
                        Map<String, Object> remainingItem = new HashMap<>();
                        remainingItem.put("name", item.get("name"));
                        Object countObj = item.get("count");
                        int count = countObj instanceof Number ? ((Number) countObj).intValue() : 0;
                        remainingItem.put("remaining", count);
                        remainingItems.add(remainingItem);
                        totalPackageCount += count;
                    }
                    
                    memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(remainingItems));
                    
                    // 패키지 항목이 있는 경우에도 totalCount와 remainingCount 설정 (일반 횟수권과 동일하게)
                    if (product.getType() != null && product.getType() == Product.ProductType.COUNT_PASS) {
                        memberProduct.setTotalCount(totalPackageCount);
                        if (skipPayment) {
                            memberProduct.setRemainingCount(0);
                            logger.debug("연장 모달: 패키지 상품 remainingCount를 0으로 설정");
                        } else {
                            memberProduct.setRemainingCount(totalPackageCount);
                            logger.debug("신규 할당: 패키지 상품 remainingCount를 {}로 설정", totalPackageCount);
                        }
                    }
                    
                    logger.info("패키지 항목 초기화 완료: {}, totalCount={}, remainingCount={}", 
                        memberProduct.getPackageItemsRemaining(), memberProduct.getTotalCount(), memberProduct.getRemainingCount());
                } catch (Exception e) {
                    logger.error("패키지 항목 초기화 실패: {}", e.getMessage(), e);
                    // 패키지 항목 초기화 실패해도 계속 진행
                }
            }
            // 일반 횟수권인 경우 총 횟수 설정 (패키지 항목이 없는 경우)
            else if (product.getType() != null && product.getType() == Product.ProductType.COUNT_PASS) {
                logger.debug("횟수권 처리 시작: 상품 타입={}", product.getType());
                // usageCount가 null이면 기본값 0으로 설정 (에러 방지)
                Integer usageCount = product.getUsageCount();
                if (usageCount == null || usageCount <= 0) {
                    // usageCount가 없으면 기본값 사용
                    logger.warn("경고: 상품 {}의 usageCount가 설정되지 않았습니다. 기본값 {}을 사용합니다.", 
                        product.getId(), com.afbscenter.constants.ProductDefaults.getDefaultUsageCount());
                    usageCount = com.afbscenter.constants.ProductDefaults.getDefaultUsageCount();
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
            
            // 람다에서 사용하기 위해 final 변수 생성 (effectively final)
            final Product finalProduct = product; // 람다에서 사용하기 위해 final 변수로 복사
            
            // MemberProduct 저장을 별도 트랜잭션으로 실행하여 먼저 커밋
            // 이렇게 하면 코치 배정이나 결제 생성 실패가 MemberProduct 저장에 영향을 주지 않음
            // TransactionTemplate을 사용하여 REQUIRES_NEW 트랜잭션으로 실행
            // 람다에서 사용하기 위해 final 변수 사용
            MemberProduct saved = transactionTemplate.execute(status -> {
                try {
                    // 저장 전 상태 로깅
                    if (finalProduct.getType() == Product.ProductType.COUNT_PASS) {
                        logger.info("MemberProduct 저장 전 - 회원 ID={}, 상품 ID={}, totalCount={}, remainingCount={}, skipPayment={}", 
                            memberId, finalProductIdForLambda, memberProduct.getTotalCount(), memberProduct.getRemainingCount(), skipPayment);
                    }
                    
                    MemberProduct result = memberProductRepository.save(memberProduct);
                    
                    // 저장 후 검증
                    if (finalProduct.getType() == Product.ProductType.COUNT_PASS) {
                        logger.info("MemberProduct 저장 성공 (별도 트랜잭션): ID={}, 회원 ID={}, 상품 ID={}, totalCount={}, remainingCount={}", 
                            result.getId(), memberId, finalProductIdForLambda, result.getTotalCount(), result.getRemainingCount());
                        
                        // remainingCount가 0인데 skipPayment가 false이면 경고 (null 체크 추가)
                        Integer remainingCount = result.getRemainingCount();
                        if (remainingCount != null && remainingCount == 0 && !skipPayment) {
                            logger.warn("⚠️ 회차권 상품 구매 시 remainingCount가 0입니다! 회원 ID={}, 상품 ID={}, totalCount={}", 
                                memberId, finalProductIdForLambda, result.getTotalCount());
                        }
                    } else {
                        logger.info("MemberProduct 저장 성공 (별도 트랜잭션): ID={}, 회원 ID={}, 상품 ID={}", 
                            result.getId(), memberId, finalProductIdForLambda);
                    }
                    
                    return result;
                } catch (Exception e) {
                    logger.error("MemberProduct 저장 실패 (별도 트랜잭션): 회원 ID={}, 상품 ID={}, 에러 타입: {}, 에러 메시지: {}", 
                        memberId, finalProductIdForLambda, e.getClass().getName(), e.getMessage(), e);
                    logger.error("트랜잭션 롤백 표시", e);
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
            // 람다에서 사용하기 위해 final 변수 생성
            final Member finalMember = member;
            
            try {
                // 상품 할당 시 이용권에 지정된 코치가 있으면 회원 담당 코치로 반영 (자동 채우기 없음)
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
                            createPaymentIfNeededInTransaction(finalMember, finalProduct, memberId, finalProductIdForLambda, finalProductIdForLambda);
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
                memberId, e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        } catch (org.springframework.transaction.UnexpectedRollbackException e) {
            // 트랜잭션 롤백 전용 예외 처리
            logger.error("트랜잭션 롤백 오류 발생. 회원 ID: {}, 상품 ID: {}, 에러: {}", 
                memberId, productIdLong != null ? productIdLong : "unknown", e.getMessage(), e);
            
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
                logger.error("원인 예외: 타입={}, 메시지={}", cause.getClass().getName(), cause.getMessage(), cause);
            }
            
            // 에러 상세 정보를 클라이언트에 반환 (디버깅용)
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Internal Server Error");
            errorResponse.put("message", "서버 내부 오류가 발생했습니다: " + (errorMessage != null ? errorMessage : "알 수 없는 오류"));
            errorResponse.put("errorType", errorType);
            errorResponse.put("memberId", memberId);
            errorResponse.put("productId", productIdLong);
            if (cause != null) {
                errorResponse.put("cause", cause.getClass().getName() + ": " + cause.getMessage());
                // 스택 트레이스도 포함 (디버깅용)
                java.io.StringWriter sw = new java.io.StringWriter();
                java.io.PrintWriter pw = new java.io.PrintWriter(sw);
                cause.printStackTrace(pw);
                errorResponse.put("stackTrace", sw.toString());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
    
    // 코치 배정을 별도 트랜잭션으로 실행 (TransactionTemplate에서 호출)
    // 이용권(MemberProduct)에 지정된 코치가 있을 때만 회원 담당 코치로 반영 (상품 기본 코치 자동 채우기 없음)
    private void assignCoachToMemberIfNeededInTransaction(Member member, Product product, MemberProduct memberProduct, Long memberId, Long productIdLong) {
        try {
            Coach coachToAssign = null;
            if (memberProduct != null && memberProduct.getCoach() != null) {
                try {
                    coachToAssign = memberProduct.getCoach();
                    logger.debug("MemberProduct의 코치 사용: 회원 ID={}, 상품 ID={}, 코치 ID={}", 
                        memberId, productIdLong, coachToAssign.getId());
                } catch (Exception e) {
                    logger.warn("MemberProduct 코치 정보 로드 실패: {}", e.getMessage());
                }
            }
            // MemberProduct에 코치가 없으면 회원 쪽에도 채우지 않음 (상품 기본 코치 미사용)
            if (coachToAssign != null) {
                Member currentMember = memberRepository.findById(memberId).orElse(null);
                if (currentMember != null && currentMember.getCoach() == null) {
                    currentMember.setCoach(coachToAssign);
                    memberRepository.save(currentMember);
                    logger.info("상품 할당 시 코치 반영 (주 담당 코치): 회원 ID={}, 코치 ID={}, 상품 ID={}", 
                        memberId, coachToAssign.getId(), productIdLong);
                } else if (currentMember != null) {
                    logger.debug("회원에게 이미 코치가 설정되어 있습니다. 회원 ID={}", memberId);
                }
            }
        } catch (Exception e) {
            logger.warn("상품 코치 배정 실패 (무시). 회원 ID={}, 상품 ID={}: {}", 
                memberId, productIdLong, e.getMessage());
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
                payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentMethod());
                payment.setStatus(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentStatus());
                payment.setCategory(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentCategory());
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
                
                // 이용권 히스토리 저장 (충전)
                try {
                    if (currentProduct.getType() == Product.ProductType.COUNT_PASS) {
                        // 해당 회원과 상품의 최신 MemberProduct 찾기
                        List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdAndProductId(memberId, productIdLong);
                        if (!memberProducts.isEmpty()) {
                            MemberProduct latestProduct = memberProducts.stream()
                                .max((mp1, mp2) -> {
                                    if (mp1.getPurchaseDate() == null) return -1;
                                    if (mp2.getPurchaseDate() == null) return 1;
                                    return mp1.getPurchaseDate().compareTo(mp2.getPurchaseDate());
                                })
                                .orElse(memberProducts.get(0));
                            
                            Integer afterRemaining = latestProduct.getRemainingCount() != null ? latestProduct.getRemainingCount() : 0;
                            Integer totalCount = latestProduct.getTotalCount() != null ? latestProduct.getTotalCount() : 0;
                            
                            // 결제로 인한 충전이므로 변경량은 totalCount (새로 충전된 횟수)
                            com.afbscenter.model.MemberProductHistory history = new com.afbscenter.model.MemberProductHistory();
                            history.setMemberProduct(latestProduct);
                            history.setMember(currentMember);
                            history.setPayment(savedPayment);
                            history.setTransactionDate(java.time.LocalDateTime.now());
                            history.setType(com.afbscenter.model.MemberProductHistory.TransactionType.CHARGE);
                            history.setChangeAmount(totalCount); // 충전된 횟수
                            history.setRemainingCountAfter(afterRemaining);
                            history.setDescription("결제로 인한 충전: " + currentProduct.getName() + " (" + totalCount + "회)");
                            memberProductHistoryRepository.save(history);
                            logger.debug("이용권 히스토리 저장 (충전): MemberProduct ID={}, Payment ID={}, Change={}, After={}", 
                                latestProduct.getId(), savedPayment.getId(), totalCount, afterRemaining);
                        }
                    }
                } catch (Exception e) {
                    logger.warn("이용권 히스토리 저장 실패 (무시): {}", e.getMessage());
                }
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
            
            // 각 MemberProduct를 삭제하기 전에: Booking 참조 해제 → MemberProductHistory 삭제 → Payment 삭제 (FK 순서 준수)
            for (MemberProduct memberProduct : memberProducts) {
                // 이 MemberProduct를 참조하는 모든 Booking 찾기 (상태 무관)
                List<Booking> bookings = bookingRepository.findAllBookingsByMemberProductId(memberProduct.getId());
                
                // Booking의 memberProduct 참조를 null로 설정
                for (Booking booking : bookings) {
                    booking.setMemberProduct(null);
                    bookingRepository.save(booking);
                }
                
                // MemberProduct를 참조하는 MemberProductHistory 먼저 삭제 (Payment/Attendance 참조 시 FK 오류 방지)
                List<com.afbscenter.model.MemberProductHistory> histories =
                    memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(memberProduct.getId());
                if (!histories.isEmpty()) {
                    memberProductHistoryRepository.deleteAll(histories);
                    logger.debug("회원 상품 할당 제거 시 히스토리 삭제: MemberProduct ID={}, 삭제된 히스토리 수={}",
                        memberProduct.getId(), histories.size());
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
    
    /** 회원 히스토리(타임라인)에서 선택한 이용권 변동 건 삭제. ?historyIds=1,2,3 */
    @DeleteMapping("/{memberId}/timeline-entries")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteMemberTimelineEntries(
            @PathVariable Long memberId,
            @RequestParam(value = "historyIds") String historyIdsParam) {
        try {
            if (memberId == null || !memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            if (historyIdsParam == null || historyIdsParam.trim().isEmpty()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "삭제할 항목을 선택해 주세요.");
                return ResponseEntity.badRequest().body(err);
            }
            List<Long> historyIds = java.util.Arrays.stream(historyIdsParam.split(","))
                    .map(String::trim).filter(s -> !s.isEmpty())
                    .map(Long::parseLong).distinct().collect(Collectors.toList());
            if (historyIds.isEmpty()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "삭제할 항목을 선택해 주세요.");
                return ResponseEntity.badRequest().body(err);
            }
            int deletedCount = 0;
            for (Long historyId : historyIds) {
                Optional<com.afbscenter.model.MemberProductHistory> opt = memberProductHistoryRepository.findById(historyId);
                if (opt.isPresent() && memberId.equals(opt.get().getMember() != null ? opt.get().getMember().getId() : null)) {
                    memberProductHistoryRepository.deleteById(historyId);
                    deletedCount++;
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("deletedCount", deletedCount);
            result.put("message", deletedCount + "건이 삭제되었습니다.");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 히스토리 항목 삭제 실패: memberId={}", memberId, e);
            Map<String, Object> err = new HashMap<>();
            err.put("error", "삭제 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    // 특정 설명을 가진 히스토리 삭제 (예약 삭제로 인한 복구 히스토리 등)
    @DeleteMapping("/{memberId}/product-history/cleanup")
    @Transactional
    public ResponseEntity<Map<String, Object>> cleanupMemberProductHistory(@PathVariable Long memberId) {
        try {
            if (memberId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // "예약 삭제로 인한 차감 복구" 또는 "체크인으로 인한 차감" 포함하는 히스토리 찾기
            List<com.afbscenter.model.MemberProductHistory> allHistories = 
                memberProductHistoryRepository.findByMemberIdOrderByTransactionDateDesc(memberId);
            
            List<com.afbscenter.model.MemberProductHistory> historiesToDelete = allHistories.stream()
                .filter(h -> {
                    if (h.getDescription() == null) return false;
                    String desc = h.getDescription();
                    // "예약 삭제로 인한 차감 복구" 또는 "체크인으로 인한 차감" 포함
                    return desc.contains("예약 삭제로 인한 차감 복구") || 
                           desc.contains("체크인으로 인한 차감");
                })
                .collect(java.util.stream.Collectors.toList());
            
            int deletedCount = 0;
            for (com.afbscenter.model.MemberProductHistory history : historiesToDelete) {
                try {
                    memberProductHistoryRepository.deleteById(history.getId());
                    deletedCount++;
                    logger.info("히스토리 삭제: History ID={}, Description={}", history.getId(), history.getDescription());
                } catch (Exception e) {
                    logger.warn("히스토리 삭제 실패: History ID={}, {}", history.getId(), e.getMessage());
                }
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("deletedCount", deletedCount);
            result.put("message", deletedCount + "개의 히스토리가 삭제되었습니다.");
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("히스토리 정리 실패: Member ID={}", memberId, e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", "히스토리 정리 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
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
                    payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentMethod());
                    payment.setStatus(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentStatus());
                    payment.setCategory(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentCategory());
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
                    logger.error("결제 생성 실패 상세", e);
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
}
