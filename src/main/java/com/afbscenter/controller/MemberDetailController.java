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

    /** 등급 한글 라벨 */
    private static String gradeToLabel(Member.MemberGrade g) {
        if (g == null) return "전체";
        switch (g) {
            case SOCIAL: return "사회인";
            case ELITE_ELEMENTARY: return "엘리트 (초)";
            case ELITE_MIDDLE: return "엘리트 (중)";
            case ELITE_HIGH: return "엘리트 (고)";
            case YOUTH: return "유소년";
            case OTHER: return "기타 종목";
            default: return g.name();
        }
    }

    /** 상중하 또는 1~5단계 -> 수치 (평균/순위용). 1~5는 그대로 1.0~5.0 반환 */
    private static double levelToNum(String s) {
        if (s == null || s.isEmpty()) return 0;
        String t = s.trim();
        if (t.matches("[1-5]")) return Double.parseDouble(t);
        String u = s.toUpperCase();
        if ("HIGH".equals(u) || "상".equals(s)) return 1.0;
        if ("MID".equals(u) || "MIDDLE".equals(u) || "중".equals(s)) return 0.6;
        if ("LOW".equals(u) || "하".equals(s)) return 0.3;
        return 0.5;
    }

    /** 개인 능력치 탭용: 해당 회원 등급, 등급 내 평균치, 등급 내 순위 */
    @GetMapping("/{id}/ability-stats-context")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getAbilityStatsContext(@PathVariable Long id) {
        try {
            Member member = memberRepository.findById(id).orElse(null);
            if (member == null) {
                return ResponseEntity.notFound().build();
            }
            Member.MemberGrade grade = member.getGrade();
            List<Member> sameGrade = grade != null ? memberRepository.findByGrade(grade) : memberRepository.findAll();

            Map<String, Object> result = new HashMap<>();
            result.put("grade", grade != null ? grade.name() : null);
            result.put("gradeLabel", gradeToLabel(grade));

            // 투수 평균
            double sumVel = 0, sumPitchPower = 0, sumCtrl = 0, sumFlex = 0, sumRun = 0;
            int cntVel = 0, cntPitchPower = 0, cntCtrl = 0, cntFlex = 0, cntRun = 0;
            for (Member m : sameGrade) {
                if (m.getPitchingSpeed() != null) { sumVel += m.getPitchingSpeed(); cntVel++; }
                if (m.getPitcherPower() != null) { sumPitchPower += m.getPitcherPower(); cntPitchPower++; }
                if (m.getPitcherControl() != null && !m.getPitcherControl().isEmpty()) { sumCtrl += levelToNum(m.getPitcherControl()); cntCtrl++; }
                if (m.getPitcherFlexibility() != null && !m.getPitcherFlexibility().isEmpty()) { sumFlex += levelToNum(m.getPitcherFlexibility()); cntFlex++; }
                if (m.getRunningSpeed() != null) { sumRun += m.getRunningSpeed(); cntRun++; }
            }
            Map<String, Object> avgPitcher = new HashMap<>();
            avgPitcher.put("velocity", cntVel > 0 ? sumVel / cntVel : null);
            avgPitcher.put("power", cntPitchPower > 0 ? sumPitchPower / cntPitchPower : null);
            avgPitcher.put("controlRatio", cntCtrl > 0 ? sumCtrl / cntCtrl : null);
            avgPitcher.put("flexibilityRatio", cntFlex > 0 ? sumFlex / cntFlex : null);
            avgPitcher.put("runningSpeed", cntRun > 0 ? sumRun / cntRun : null);
            result.put("averages", Map.of("pitcher", avgPitcher));

            // 타자 평균
            double sumSwing = 0, sumExit = 0, sumBatPower = 0, sumBatFlex = 0;
            int cntSwing = 0, cntExit = 0, cntBatPower = 0, cntBatFlex = 0;
            for (Member m : sameGrade) {
                if (m.getSwingSpeed() != null) { sumSwing += m.getSwingSpeed(); cntSwing++; }
                if (m.getExitVelocity() != null) { sumExit += m.getExitVelocity(); cntExit++; }
                if (m.getBatterPower() != null) { sumBatPower += m.getBatterPower(); cntBatPower++; }
                if (m.getBatterFlexibility() != null) { sumBatFlex += m.getBatterFlexibility(); cntBatFlex++; }
            }
            Map<String, Object> avgBatter = new HashMap<>();
            avgBatter.put("swingSpeed", cntSwing > 0 ? sumSwing / cntSwing : null);
            avgBatter.put("exitVelocity", cntExit > 0 ? sumExit / cntExit : null);
            avgBatter.put("power", cntBatPower > 0 ? sumBatPower / cntBatPower : null);
            avgBatter.put("runningSpeed", cntRun > 0 ? sumRun / cntRun : null);
            avgBatter.put("flexibility", cntBatFlex > 0 ? sumBatFlex / cntBatFlex : null);
            @SuppressWarnings("unchecked")
            Map<String, Object> avgs = (Map<String, Object>) result.get("averages");
            Map<String, Object> newAverages = new HashMap<>(avgs);
            newAverages.put("batter", avgBatter);
            result.put("averages", newAverages);

            // 순위: 각 스탯별로 (memberId, value) 정렬 후 rank + total 반환 (상위 N% 표시용)
            Map<String, Object> rankPitcher = new HashMap<>();
            List<Map.Entry<Long, Double>> listVel = sameGrade.stream().filter(m -> m.getPitchingSpeed() != null).map(m -> Map.entry(m.getId(), m.getPitchingSpeed())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankPitcher.put("velocity", rankAndTotal(listVel, id));
            List<Map.Entry<Long, Double>> listPitchPower = sameGrade.stream().filter(m -> m.getPitcherPower() != null).map(m -> Map.entry(m.getId(), m.getPitcherPower())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankPitcher.put("power", rankAndTotal(listPitchPower, id));
            List<Map.Entry<Long, Double>> listCtrl = sameGrade.stream().filter(m -> m.getPitcherControl() != null && !m.getPitcherControl().isEmpty()).map(m -> Map.entry(m.getId(), levelToNum(m.getPitcherControl()))).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankPitcher.put("control", rankAndTotal(listCtrl, id));
            List<Map.Entry<Long, Double>> listFlex = sameGrade.stream().filter(m -> m.getPitcherFlexibility() != null && !m.getPitcherFlexibility().isEmpty()).map(m -> Map.entry(m.getId(), levelToNum(m.getPitcherFlexibility()))).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankPitcher.put("flexibility", rankAndTotal(listFlex, id));
            List<Map.Entry<Long, Double>> listRun = sameGrade.stream().filter(m -> m.getRunningSpeed() != null).map(m -> Map.entry(m.getId(), m.getRunningSpeed())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankPitcher.put("runningSpeed", rankAndTotal(listRun, id));

            Map<String, Object> rankBatter = new HashMap<>();
            List<Map.Entry<Long, Double>> listSwing = sameGrade.stream().filter(m -> m.getSwingSpeed() != null).map(m -> Map.entry(m.getId(), m.getSwingSpeed())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankBatter.put("swingSpeed", rankAndTotal(listSwing, id));
            List<Map.Entry<Long, Double>> listExit = sameGrade.stream().filter(m -> m.getExitVelocity() != null).map(m -> Map.entry(m.getId(), m.getExitVelocity())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankBatter.put("exitVelocity", rankAndTotal(listExit, id));
            List<Map.Entry<Long, Double>> listBatPower = sameGrade.stream().filter(m -> m.getBatterPower() != null).map(m -> Map.entry(m.getId(), m.getBatterPower())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankBatter.put("power", rankAndTotal(listBatPower, id));
            rankBatter.put("runningSpeed", rankAndTotal(listRun, id));
            List<Map.Entry<Long, Double>> listBatFlex = sameGrade.stream().filter(m -> m.getBatterFlexibility() != null).map(m -> Map.entry(m.getId(), m.getBatterFlexibility())).sorted((a, b) -> Double.compare(b.getValue(), a.getValue())).collect(Collectors.toList());
            rankBatter.put("flexibility", rankAndTotal(listBatFlex, id));

            result.put("rankings", Map.of("pitcher", rankPitcher, "batter", rankBatter));
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("ability-stats-context 오류 (회원 ID: {})", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private static Integer rankFromList(List<Map.Entry<Long, Double>> sortedList, Long memberId) {
        for (int i = 0; i < sortedList.size(); i++) {
            if (sortedList.get(i).getKey().equals(memberId)) return i + 1;
        }
        return null;
    }

    /** 상위 N% 표시용: { "rank": 1, "total": 10 } 형태로 반환 */
    private static Map<String, Object> rankAndTotal(List<Map.Entry<Long, Double>> sortedList, Long memberId) {
        Integer rank = rankFromList(sortedList, memberId);
        int total = sortedList.size();
        Map<String, Object> out = new HashMap<>();
        out.put("rank", rank);
        out.put("total", total);
        return out;
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
                    // 총 횟수: product.usageCount를 우선 사용 (상품의 실제 사용 횟수 반영, 데이터 일관성 보장)
                    Integer totalCount = mp.getProduct().getUsageCount();
                    if (totalCount == null || totalCount <= 0) {
                        // product.usageCount가 없으면 mp.totalCount 사용
                        totalCount = mp.getTotalCount();
                        if (totalCount == null || totalCount <= 0) {
                            // 그것도 없으면 기본값 사용
                            totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                        }
                    }
                    
                    // DB에 저장된 remainingCount를 우선 사용 (체크인 시 차감된 값이 정확함)
                    Integer remainingCount = mp.getRemainingCount();
                    
                    // remainingCount가 null일 때만 재계산 (초기화가 필요한 경우)
                    // 0도 유효한 값이므로 재계산하지 않음 (체크인 시 차감되어 0이 된 경우)
                    if (remainingCount == null) {
                        // 실제 사용된 횟수 계산
                        // 주의: countCheckedInAttendancesByMemberAndProduct는 booking.memberProduct를 기반으로 카운트하므로
                        // 예약에 memberProduct가 연결되지 않은 경우 0을 반환할 수 있음
                        Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(memberId, mp.getId());
                        if (usedCountByAttendance == null) {
                            usedCountByAttendance = 0L;
                        }
                        
                        // booking.memberProduct가 연결되지 않은 출석 기록도 카운트 (체크인 시 차감되었으므로)
                        // 성능 최적화: MemberProductHistory를 한 번에 조회하여 N+1 쿼리 문제 방지
                        try {
                            // 해당 회원의 모든 출석 기록을 한 번에 조회
                            List<com.afbscenter.model.Attendance> allAttendances = attendanceRepository.findByMemberId(memberId);
                            
                            // 해당 MemberProduct와 관련된 모든 히스토리를 한 번에 조회
                            List<com.afbscenter.model.MemberProductHistory> histories = 
                                memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(mp.getId());
                            
                            // 출석 ID를 Set으로 변환하여 빠른 조회
                            java.util.Set<Long> attendanceIdsWithHistory = histories.stream()
                                .filter(h -> h.getAttendance() != null && h.getAttendance().getCheckInTime() != null)
                                .map(h -> h.getAttendance().getId())
                                .collect(java.util.stream.Collectors.toSet());
                            
                            // 출석 기록에서 체크인된 것 중 booking.memberProduct가 연결된 것 또는 히스토리에 있는 것 카운트
                            long directCount = allAttendances.stream()
                                .filter(a -> a.getCheckInTime() != null && 
                                           a.getBooking() != null &&
                                           (a.getBooking().getMemberProduct() != null && a.getBooking().getMemberProduct().getId().equals(mp.getId()) ||
                                            attendanceIdsWithHistory.contains(a.getId())))
                                .count();
                            
                            if (directCount > usedCountByAttendance) {
                                usedCountByAttendance = directCount;
                            }
                        } catch (Exception e) {
                            logger.warn("출석 기록 직접 카운트 실패: {}", e.getMessage());
                        }
                        
                        Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                        if (usedCountByBooking == null) {
                            usedCountByBooking = 0L;
                        }
                        
                        // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용 (중복 방지)
                        Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                        
                        // 잔여 횟수 = 총 횟수 - 실제 사용 횟수
                        remainingCount = totalCount - actualUsedCount.intValue();
                        if (remainingCount < 0) {
                            remainingCount = 0; // 음수 방지
                        }
                        
                        logger.info("회원 상품 잔여 횟수 재계산: MemberProduct ID={}, totalCount={}, usedCount={}, calculatedRemaining={}", 
                            mp.getId(), totalCount, actualUsedCount, remainingCount);
                    } else {
                        // DB에 저장된 값을 사용 (체크인 시 차감된 정확한 값)
                        logger.debug("회원 상품 잔여 횟수 DB 값 사용: MemberProduct ID={}, remainingCount={}", 
                            mp.getId(), remainingCount);
                    }
                    
                    productMap.put("remainingCount", remainingCount);
                    productMap.put("usedCount", totalCount - remainingCount);
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
            List<Booking> bookings = bookingRepository.findByMemberId(memberId);
            
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

                // MemberProduct 정보 (상품명 포함)
                if (booking.getMemberProduct() != null) {
                    Map<String, Object> memberProductMap = new HashMap<>();
                    memberProductMap.put("id", booking.getMemberProduct().getId());
                    if (booking.getMemberProduct().getProduct() != null) {
                        memberProductMap.put("productName", booking.getMemberProduct().getProduct().getName());
                        memberProductMap.put("productType", booking.getMemberProduct().getProduct().getType());
                    }
                    map.put("memberProduct", memberProductMap);
                } else {
                    map.put("memberProduct", null);
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
                        
                        // 이용권 정보 추가
                        if (attendance.getBooking().getMemberProduct() != null) {
                            try {
                                com.afbscenter.model.MemberProduct mp = attendance.getBooking().getMemberProduct();
                                Map<String, Object> productMap = new HashMap<>();
                                productMap.put("id", mp.getId());
                                if (mp.getProduct() != null) {
                                    productMap.put("name", mp.getProduct().getName());
                                }
                                bookingMap.put("memberProduct", productMap);
                            } catch (Exception e) {
                                logger.warn("MemberProduct 로드 실패: {}", e.getMessage());
                            }
                        }
                        
                        map.put("booking", bookingMap);
                    } catch (Exception e) {
                        logger.warn("Booking 로드 실패: Attendance ID={}", attendance.getId(), e);
                        map.put("booking", null);
                    }
                } else {
                    map.put("booking", null);
                }
                
                // 이용권 히스토리 정보 (체크인 시 차감된 이용권)
                try {
                    java.util.Optional<com.afbscenter.model.MemberProductHistory> historyOpt = 
                        memberProductHistoryRepository.findByAttendanceId(attendance.getId());
                    if (historyOpt.isPresent()) {
                        com.afbscenter.model.MemberProductHistory history = historyOpt.get();
                        if (history.getMemberProduct() != null) {
                            Map<String, Object> historyMap = new HashMap<>();
                            historyMap.put("changeAmount", history.getChangeAmount());
                            historyMap.put("remainingCountAfter", history.getRemainingCountAfter());
                            try {
                                if (history.getMemberProduct().getProduct() != null) {
                                    historyMap.put("productName", history.getMemberProduct().getProduct().getName());
                                }
                            } catch (Exception e) {
                                logger.warn("Product 로드 실패: {}", e.getMessage());
                            }
                            map.put("productHistory", historyMap);
                        }
                    } else {
                        // 히스토리가 없지만 체크인된 경우, booking의 memberProduct 정보로 히스토리 정보 생성
                        // (차감 정보는 정확하지 않지만 일관된 표시를 위해)
                        if (attendance.getCheckInTime() != null && attendance.getBooking() != null) {
                            try {
                                com.afbscenter.model.Booking booking = attendance.getBooking();
                                if (booking.getMemberProduct() != null) {
                                    com.afbscenter.model.MemberProduct mp = booking.getMemberProduct();
                                    Map<String, Object> historyMap = new HashMap<>();
                                    historyMap.put("changeAmount", -1); // 체크인 시 일반적으로 -1 차감
                                    historyMap.put("remainingCountAfter", mp.getRemainingCount());
                                    try {
                                        if (mp.getProduct() != null) {
                                            historyMap.put("productName", mp.getProduct().getName());
                                        } else {
                                            historyMap.put("productName", "이용권");
                                        }
                                    } catch (Exception e) {
                                        logger.warn("Product 로드 실패: {}", e.getMessage());
                                        historyMap.put("productName", "이용권");
                                    }
                                    map.put("productHistory", historyMap);
                                }
                            } catch (Exception e) {
                                logger.debug("Booking에서 MemberProduct 정보 생성 실패 (무시): {}", e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    // 히스토리 조회 실패 시 무시
                    logger.debug("히스토리 조회 실패 (무시): {}", e.getMessage());
                }
                
                return map;
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 출석 내역 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 회원 이용권 히스토리 조회
    @GetMapping("/{memberId}/product-history")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberProductHistory(@PathVariable Long memberId) {
        try {
            if (memberId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            if (!memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            
            // 예약 startTime 기준 정렬을 위해 attendance와 booking도 함께 조회
            List<com.afbscenter.model.MemberProductHistory> histories = 
                memberProductHistoryRepository.findByMemberIdWithProductAndBookingOrderByTransactionDateDesc(memberId);
            
            // 예약 내역과 동일한 순서로 정렬: 체크인으로 인한 차감은 예약의 startTime 기준, 그 외는 transactionDate 기준
            List<Map<String, Object>> result = histories.stream().map(history -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", history.getId());
                map.put("transactionDate", history.getTransactionDate());
                map.put("type", history.getType() != null ? history.getType().name() : null);
                map.put("changeAmount", history.getChangeAmount());
                map.put("remainingCountAfter", history.getRemainingCountAfter());
                map.put("description", history.getDescription());
                
                // 이용권 정보
                if (history.getMemberProduct() != null) {
                    try {
                        Map<String, Object> productMap = new HashMap<>();
                        productMap.put("id", history.getMemberProduct().getId());
                        if (history.getMemberProduct().getProduct() != null) {
                            productMap.put("name", history.getMemberProduct().getProduct().getName());
                        }
                        map.put("memberProduct", productMap);
                    } catch (Exception e) {
                        logger.warn("MemberProduct 로드 실패: {}", e.getMessage());
                    }
                }
                
                // 체크인인 경우 출석 → 시설(지점) 정보 추가 (사하점/연산점 구분용)
                // 예약 정렬을 위한 startTime도 추가
                if (history.getAttendance() != null) {
                    try {
                        var attendance = history.getAttendance();
                        var facility = attendance.getFacility();
                        if (facility != null) {
                            map.put("branch", facility.getBranch() != null ? facility.getBranch().name() : null);
                            map.put("facilityName", facility.getName());
                        }
                        
                        // 예약 번호·startTime 추가 (정렬·표시용, 예약 내역과 동일 순서)
                        if (attendance.getBooking() != null) {
                            try {
                                var booking = attendance.getBooking();
                                map.put("bookingId", booking.getId());
                                map.put("bookingStartTime", booking.getStartTime());
                            } catch (Exception e) {
                                logger.warn("Booking 로드 실패 (히스토리 ID: {}): {}", history.getId(), e.getMessage());
                            }
                        }
                    } catch (Exception e) {
                        logger.debug("출석/시설 로드 실패 (히스토리 ID: {}): {}", history.getId(), e.getMessage());
                    }
                }
                
                return map;
            }).sorted((h1, h2) -> {
                // 예약 내역과 동일한 정렬: 예약 번호(bookingId) DESC, 같은 예약이면 transactionDate DESC
                Long id1 = (Long) h1.get("bookingId");
                Long id2 = (Long) h2.get("bookingId");
                
                // 예약이 있는 항목을 먼저, 예약 번호 DESC
                if (id1 == null && id2 == null) {
                    java.time.LocalDateTime t1 = (java.time.LocalDateTime) h1.get("transactionDate");
                    java.time.LocalDateTime t2 = (java.time.LocalDateTime) h2.get("transactionDate");
                    if (t1 == null && t2 == null) return 0;
                    if (t1 == null) return 1;
                    if (t2 == null) return -1;
                    return t2.compareTo(t1);
                }
                if (id1 == null) return 1;
                if (id2 == null) return -1;
                
                int compare = id2.compareTo(id1); // 예약 번호 DESC
                if (compare != 0) return compare;
                
                // 같은 예약에 여러 체크인: transactionDate DESC
                java.time.LocalDateTime trans1 = (java.time.LocalDateTime) h1.get("transactionDate");
                java.time.LocalDateTime trans2 = (java.time.LocalDateTime) h2.get("transactionDate");
                if (trans1 == null && trans2 == null) return 0;
                if (trans1 == null) return 1;
                if (trans2 == null) return -1;
                return trans2.compareTo(trans1);
            }).collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("회원 이용권 히스토리 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
