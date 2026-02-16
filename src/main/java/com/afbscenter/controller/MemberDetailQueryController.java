package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.Booking;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/members")
/**
 * 회원 상세 조회 전용 (GET). URL 동일: /api/members/{id}/ability-stats-context, /{memberId}/products, /bookings, /payments, /attendance, /product-history
 */
public class MemberDetailQueryController {

    private static final Logger logger = LoggerFactory.getLogger(MemberDetailQueryController.class);

    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final ProductRepository productRepository;
    private final MemberProductRepository memberProductRepository;
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;
    private final com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository;

    public MemberDetailQueryController(MemberRepository memberRepository,
                           CoachRepository coachRepository,
                           ProductRepository productRepository,
                           MemberProductRepository memberProductRepository,
                           PaymentRepository paymentRepository,
                           BookingRepository bookingRepository,
                           AttendanceRepository attendanceRepository,
                           com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository) {
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.productRepository = productRepository;
        this.memberProductRepository = memberProductRepository;
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
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
                
                // packageItemsRemaining이 있으면 직접 설정(DB) 우선, 없으면 JSON 합 + DEDUCT 히스토리 (대관 10회권 등)
                if (mp.getPackageItemsRemaining() != null && !mp.getPackageItemsRemaining().isEmpty()) {
                    Integer remainingCount = null;
                    Integer totalCount = mp.getTotalCount();
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
                        // 직접 설정(조정)으로 저장된 DB 값 우선 — 4 입력 시 JSON 합으로 덮어쓰지 않음
                        if (mp.getRemainingCount() != null) {
                            remainingCount = mp.getRemainingCount();
                        } else {
                            remainingCount = sumRemaining;
                        }
                        if (totalCount == null || totalCount <= 0) totalCount = sumTotal > 0 ? sumTotal : mp.getTotalCount();
                    } catch (Exception e) {
                        logger.warn("패키지 잔여 합산 실패: MemberProduct ID={}", mp.getId(), e);
                        remainingCount = mp.getRemainingCount();
                    }
                    // 패키지 JSON이 체크인 시 갱신 안 됐을 수 있음 → 차감(DEDUCT) 횟수로 잔여 재계산
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
                        // DEDUCT 히스토리 잔여와 DB/JSON 잔여 중 더 작은 값 사용 → 수동 조정이 다음에도 유지됨
                        if (totalCount != null && deductCount > 0) {
                            int fromHistory = Math.max(0, totalCount - deductCount);
                            int fromJson = remainingCount != null ? remainingCount : Integer.MAX_VALUE;
                            int fromDb = mp.getRemainingCount() != null ? mp.getRemainingCount() : Integer.MAX_VALUE;
                            int current = Math.min(fromJson, fromDb);
                            remainingCount = Math.min(fromHistory, current);
                        }
                    } catch (Exception e) {
                        logger.warn("히스토리 기반 잔여 보정 실패: MemberProduct ID={}", mp.getId(), e);
                    }
                    if (totalCount == null) totalCount = mp.getTotalCount() != null ? mp.getTotalCount() : 0;
                    productMap.put("remainingCount", remainingCount != null ? remainingCount : mp.getRemainingCount());
                    productMap.put("usedCount", totalCount != null && remainingCount != null ? totalCount - remainingCount : 0);
                    productMap.put("totalCount", totalCount);
                } else if (mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                    // 횟수권(패키지 아님)인 경우 실제 예약 데이터 기반 잔여 횟수 계산
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
                    // 그 외: DB remainingCount 사용
                    Integer remainingCount = mp.getRemainingCount();
                    Integer totalCount = mp.getTotalCount() != null ? mp.getTotalCount() : 0;
                    productMap.put("remainingCount", remainingCount);
                    productMap.put("usedCount", totalCount != null && remainingCount != null ? totalCount - remainingCount : 0);
                    productMap.put("totalCount", totalCount);
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
    
    /** 회원 타임라인: 가입·구매·예약·체크인·이용권 변동을 날짜순 하나로 */
    @GetMapping("/{memberId}/timeline")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberTimeline(@PathVariable Long memberId) {
        try {
            if (memberId == null || !memberRepository.existsById(memberId)) {
                return ResponseEntity.notFound().build();
            }
            java.util.List<Map<String, Object>> events = new java.util.ArrayList<>();
            
            // 가입
            memberRepository.findById(memberId).ifPresent(m -> {
                if (m.getCreatedAt() != null) {
                    Map<String, Object> e = new HashMap<>();
                    e.put("eventType", "SIGNUP");
                    e.put("date", m.getCreatedAt());
                    e.put("label", "회원 가입");
                    e.put("detail", "");
                    events.add(e);
                }
            });
            
            // 구매(결제) — 구매 직후 잔여 = 해당 이용권 totalCount
            List<Payment> payments = paymentRepository.findByMemberIdWithCoach(memberId);
            for (Payment p : payments) {
                LocalDateTime d = p.getPaidAt() != null ? p.getPaidAt() : p.getCreatedAt();
                if (d == null) continue;
                Map<String, Object> e = new HashMap<>();
                e.put("eventType", "PAYMENT");
                e.put("date", d);
                e.put("label", "구매");
                String productName = p.getProduct() != null ? p.getProduct().getName() : "상품";
                Integer amount = p.getAmount();
                e.put("detail", productName + (amount != null ? " " + amount + "원" : ""));
                e.put("paymentId", p.getId());
                e.put("amount", amount);
                e.put("productName", productName);
                String amountStr = amount != null ? " ₩" + String.format("%,d", amount) : "";
                e.put("detail", productName + amountStr);
                if (p.getProduct() != null && p.getProduct().getId() != null) {
                    List<MemberProduct> mps = memberProductRepository.findByMemberIdAndProductId(memberId, p.getProduct().getId());
                    for (MemberProduct mp : mps) {
                        if (mp.getPurchaseDate() != null && java.time.Duration.between(mp.getPurchaseDate(), d).toMinutes() <= 60) {
                            Integer total = mp.getTotalCount() != null ? mp.getTotalCount() : (mp.getProduct() != null && mp.getProduct().getUsageCount() != null ? mp.getProduct().getUsageCount() : null);
                            if (total != null) {
                                e.put("remainingAfter", total);
                                e.put("detail", productName + amountStr + " · 구매 후 잔여 " + total + "회");
                            }
                            break;
                        }
                    }
                }
                events.add(e);
            }
            
            // 예약 — 시간대, 목적(한글), 상태(한글)
            List<Booking> bookings = bookingRepository.findByMemberId(memberId);
            for (Booking b : bookings) {
                LocalDateTime d = b.getStartTime() != null ? b.getStartTime() : b.getCreatedAt();
                if (d == null) continue;
                Map<String, Object> e = new HashMap<>();
                e.put("eventType", "BOOKING");
                e.put("date", d);
                e.put("label", "예약");
                String facilityName = b.getFacility() != null ? b.getFacility().getName() : "";
                String purposeKr = b.getPurpose() == null ? "" : (b.getPurpose() == Booking.BookingPurpose.RENTAL ? "대관" : b.getPurpose() == Booking.BookingPurpose.LESSON ? "레슨" : b.getPurpose() == Booking.BookingPurpose.PERSONAL_TRAINING ? "개인훈련" : b.getPurpose().name());
                String statusKr = b.getStatus() == null ? "" : (b.getStatus() == Booking.BookingStatus.CONFIRMED ? "확정" : b.getStatus() == Booking.BookingStatus.PENDING ? "대기" : b.getStatus() == Booking.BookingStatus.CANCELLED ? "취소" : b.getStatus().name());
                String timeRange = "";
                if (b.getStartTime() != null && b.getEndTime() != null) {
                    timeRange = " " + b.getStartTime().toLocalTime().toString().substring(0, 5) + "~" + b.getEndTime().toLocalTime().toString().substring(0, 5);
                }
                e.put("detail", facilityName + " · " + purposeKr + timeRange + " · " + statusKr + (b.getParticipants() != null && b.getParticipants() > 0 ? " · " + b.getParticipants() + "명" : ""));
                e.put("bookingId", b.getId());
                e.put("status", b.getStatus() != null ? b.getStatus().name() : null);
                e.put("startTime", b.getStartTime());
                e.put("endTime", b.getEndTime());
                e.put("purpose", purposeKr);
                e.put("facilityName", facilityName);
                events.add(e);
            }
            
            // 체크인 — DB 기록값(remainingAfter) 유지, 캘린더와 일치하는 보정값(remainingAfterCorrected)은 별도 계산
            List<Attendance> attendances = attendanceRepository.findByMemberId(memberId);
            for (Attendance a : attendances) {
                LocalDateTime d = a.getCheckInTime() != null ? a.getCheckInTime() : a.getDate() != null ? a.getDate().atStartOfDay() : null;
                if (d == null) continue;
                Map<String, Object> e = new HashMap<>();
                e.put("eventType", "CHECKIN");
                e.put("date", d);
                e.put("label", "체크인");
                String facilityName = a.getFacility() != null ? a.getFacility().getName() : "";
                String productName = "";
                Long memberProductId = null;
                Integer totalCount = null;
                if (a.getBooking() != null && a.getBooking().getMemberProduct() != null) {
                    com.afbscenter.model.MemberProduct mp = a.getBooking().getMemberProduct();
                    if (mp.getProduct() != null) productName = mp.getProduct().getName();
                    memberProductId = mp.getId();
                    totalCount = mp.getTotalCount() != null ? mp.getTotalCount() : (mp.getProduct() != null && mp.getProduct().getUsageCount() != null ? mp.getProduct().getUsageCount() : null);
                }
                Integer remainingAfter = null; // DB에 저장된 당시 기록값(흰색 표시)
                try {
                    java.util.Optional<com.afbscenter.model.MemberProductHistory> ho = memberProductHistoryRepository.findByAttendanceId(a.getId());
                    if (ho.isPresent() && ho.get().getRemainingCountAfter() != null) {
                        remainingAfter = ho.get().getRemainingCountAfter();
                    }
                } catch (Exception ex) { /* ignore */ }
                String detailStr = facilityName + (productName.isEmpty() ? "" : " · " + productName) + (remainingAfter != null ? " · 체크인 후 잔여 " + remainingAfter + "회" : "");
                e.put("detail", detailStr);
                e.put("attendanceId", a.getId());
                e.put("facilityName", facilityName);
                e.put("productName", productName.isEmpty() ? null : productName);
                e.put("remainingAfter", remainingAfter);
                if (memberProductId != null) e.put("memberProductId", memberProductId);
                if (totalCount != null) e.put("totalCount", totalCount);
                events.add(e);
            }
            
            // 이용권 변동(충전/차감/조정) — 변경량·잔여 명시
            List<com.afbscenter.model.MemberProductHistory> histories =
                memberProductHistoryRepository.findByMemberIdWithProductOrderByTransactionDateDesc(memberId);
            for (com.afbscenter.model.MemberProductHistory h : histories) {
                if (h.getTransactionDate() == null) continue;
                Map<String, Object> e = new HashMap<>();
                String typeLabel = "이용권";
                if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.CHARGE) typeLabel = "충전";
                else if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.DEDUCT) typeLabel = "차감";
                else if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.ADJUST) typeLabel = "조정";
                e.put("eventType", "PRODUCT_HISTORY");
                e.put("date", h.getTransactionDate());
                e.put("label", typeLabel);
                String productName = "이용권";
                if (h.getMemberProduct() != null && h.getMemberProduct().getProduct() != null) {
                    productName = h.getMemberProduct().getProduct().getName();
                }
                String changeStr = h.getChangeAmount() != null ? (h.getChangeAmount() >= 0 ? "+" + h.getChangeAmount() : "" + h.getChangeAmount()) : "";
                e.put("remainingAfter", h.getRemainingCountAfter());
                e.put("changeAmount", h.getChangeAmount());
                e.put("detail", productName + " " + changeStr + (h.getRemainingCountAfter() != null ? " → 잔여 " + h.getRemainingCountAfter() + "회" : ""));
                e.put("description", h.getDescription());
                e.put("productName", productName);
                e.put("historyId", h.getId());
                events.add(e);
            }
            
            // 날짜 오름차순으로 정렬 후, 상품별 잔여를 시간순 적용해 체크인 시점의 잔여를 계산
            events.sort((a, b) -> {
                LocalDateTime t1 = (LocalDateTime) a.get("date");
                LocalDateTime t2 = (LocalDateTime) b.get("date");
                if (t1 == null && t2 == null) return 0;
                if (t1 == null) return 1;
                if (t2 == null) return -1;
                return t1.compareTo(t2);
            });
            java.util.Map<String, Integer> remainingByProduct = new java.util.HashMap<>();
            for (Map<String, Object> e : events) {
                String type = (String) e.get("eventType");
                String productName = (String) e.get("productName");
                if (productName == null && "PRODUCT_HISTORY".equals(type)) productName = (String) e.get("detail");
                if (productName != null && productName.length() > 50) productName = productName.substring(0, 50);
                if ("PAYMENT".equals(type)) {
                    Object ra = e.get("remainingAfter");
                    if (ra instanceof Number && productName != null) remainingByProduct.put(productName, ((Number) ra).intValue());
                } else if ("PRODUCT_HISTORY".equals(type)) {
                    Object ra = e.get("remainingAfter");
                    if (ra instanceof Number && productName != null) remainingByProduct.put(productName, ((Number) ra).intValue());
                } else if ("CHECKIN".equals(type) && productName != null && !productName.isEmpty()) {
                    Integer current = remainingByProduct.get(productName);
                    if (current != null && current > 0) {
                        int after = current - 1;
                        remainingByProduct.put(productName, after);
                    }
                }
            }
            // 체크인별 remainingAfterCorrected: 시간순 적용 후 해당 상품의 현재 잔여(캘린더와 동일)
            for (Map<String, Object> e : events) {
                if (!"CHECKIN".equals(e.get("eventType"))) continue;
                String productName = (String) e.get("productName");
                if (productName == null || productName.isEmpty()) continue;
                if (productName.length() > 50) productName = productName.substring(0, 50);
                Integer currentRemaining = remainingByProduct.get(productName);
                if (currentRemaining != null) e.put("remainingAfterCorrected", currentRemaining);
            }
            // 날짜 오름차순(과거 → 현재, 날짜순)으로 재정렬
            events.sort((a, b) -> {
                LocalDateTime t1 = (LocalDateTime) a.get("date");
                LocalDateTime t2 = (LocalDateTime) b.get("date");
                if (t1 == null && t2 == null) return 0;
                if (t1 == null) return 1;
                if (t2 == null) return -1;
                return t1.compareTo(t2);
            });
            
            return ResponseEntity.ok(events);
                } catch (Exception e) {
            logger.error("회원 타임라인 조회 실패 (회원 ID: {})", memberId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
}