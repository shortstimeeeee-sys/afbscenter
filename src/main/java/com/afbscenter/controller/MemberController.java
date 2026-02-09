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
    private final com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository;
    private final TransactionTemplate transactionTemplate;
    private final ActionAuditLogRepository actionAuditLogRepository;

    public MemberController(MemberService memberService,
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

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getAllMembers(
            @RequestParam(required = false) String productCategory,
            @RequestParam(required = false) String grade,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        try {
            logger.debug("회원 목록 조회 시작: productCategory={}, grade={}, status={}, branch={}, page={}, size={}",
                productCategory, grade, status, branch, page, size);
            
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
            
            // 페이지네이션: page, size 모두 있으면 페이지 단위 응답
            if (page != null && size != null && page >= 0 && size > 0) {
                int total = membersWithTotalPayment.size();
                int from = Math.min(page * size, total);
                int to = Math.min(from + size, total);
                List<Map<String, Object>> content = from < to ? membersWithTotalPayment.subList(from, to) : new java.util.ArrayList<>();
                int totalPages = size > 0 ? (int) Math.ceil((double) total / size) : 0;
                Map<String, Object> body = new HashMap<>();
                body.put("content", content);
                body.put("totalElements", total);
                body.put("totalPages", totalPages);
                body.put("number", page);
                body.put("size", size);
                logger.info("회원 목록 조회 완료 (페이지): {}명 중 {}~{} 반환", total, from, to);
                return ResponseEntity.ok(body);
            }
            
            logger.info("회원 목록 조회 완료: {}명", membersWithTotalPayment.size());
            return ResponseEntity.ok(membersWithTotalPayment);
        } catch (Exception e) {
            logger.error("회원 목록 조회 중 오류 발생", e);
            // 에러 상세 정보를 클라이언트에 반환 (디버깅용)
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "회원 목록 조회 중 오류가 발생했습니다");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                java.util.Collections.singletonList(errorResponse));
        }
    }

    // 회원 기본 통계는 MemberStatsController (GET /api/members/stats) 에서 처리
    // 회원번호/검색 조회는 MemberQueryController (GET /api/members/by-number/..., GET /api/members/search) 에서 처리

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
            memberMap.put("pitcherPower", member.getPitcherPower());
            memberMap.put("pitcherControl", member.getPitcherControl());
            memberMap.put("pitcherFlexibility", member.getPitcherFlexibility());
            memberMap.put("runningSpeed", member.getRunningSpeed());
            memberMap.put("batterPower", member.getBatterPower());
            memberMap.put("batterFlexibility", member.getBatterFlexibility());
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
                            Map<String, Object> coachMap = null;
                            try {
                                if (mp.getCoach() != null) {
                                    coachMap = new HashMap<>();
                                    coachMap.put("id", mp.getCoach().getId());
                                    coachMap.put("name", mp.getCoach().getName());
                                }
                            } catch (Exception e) {
                                // coach 필드가 아직 로드되지 않았거나 없을 수 있음
                            }
                            
                            if (coachMap == null && mp.getProduct() != null) {
                                try {
                                    if (mp.getProduct().getCoach() != null) {
                                        coachMap = new HashMap<>();
                                        coachMap.put("id", mp.getProduct().getCoach().getId());
                                        coachMap.put("name", mp.getProduct().getCoach().getName());
                                    }
                                } catch (Exception e) {
                                    // 상품의 코치 로드 실패 시 무시
                                }
                            }
                            
                            if (coachMap == null && member.getCoach() != null) {
                                coachMap = new HashMap<>();
                                coachMap.put("id", member.getCoach().getId());
                                coachMap.put("name", member.getCoach().getName());
                            }
                            
                            if (coachMap != null) {
                                mpMap.put("coach", coachMap);
                                mpMap.put("coachName", coachMap.get("name")); // 하위 호환성
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
            
            // 누적 결제 금액 계산
            Integer totalPayment = null;
            try {
                totalPayment = paymentRepository.sumTotalAmountByMemberId(id);
                if (totalPayment == null) {
                    totalPayment = 0;
                }
            } catch (Exception e) {
                logger.warn("결제 금액 계산 실패 (Member ID: {}): {}", id, e.getMessage());
                totalPayment = 0;
            }
            memberMap.put("totalPayment", totalPayment);
            
            // 최근 레슨 날짜 계산
            java.time.LocalDate latestLessonDate = null;
            try {
                List<com.afbscenter.model.Booking> latestLessons = bookingRepository.findLatestLessonByMemberId(id);
                if (latestLessons != null && !latestLessons.isEmpty()) {
                    latestLessonDate = latestLessons.get(0).getStartTime().toLocalDate();
                }
            } catch (Exception e) {
                logger.warn("최근 레슨 날짜 계산 실패 (Member ID: {}): {}", id, e.getMessage());
            }
            memberMap.put("latestLessonDate", latestLessonDate);
            
            return ResponseEntity.ok(memberMap);
        } catch (Exception e) {
            logger.error("회원 조회 중 오류 발생 (회원 ID: {})", id, e);
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
            
            // 투수/타자 기록 (훈련 기록)
            if (requestData.get("pitchingSpeed") != null) {
                try { member.setPitchingSpeed(((Number) requestData.get("pitchingSpeed")).doubleValue()); } catch (Exception e) { logger.warn("구속 파싱 실패: {}", requestData.get("pitchingSpeed")); }
            }
            if (requestData.get("pitcherPower") != null) {
                try { member.setPitcherPower(((Number) requestData.get("pitcherPower")).doubleValue()); } catch (Exception e) { logger.warn("투수 파워 파싱 실패: {}", requestData.get("pitcherPower")); }
            }
            if (requestData.get("pitcherControl") != null) {
                String s = requestData.get("pitcherControl").toString().trim();
                member.setPitcherControl(s.isEmpty() ? null : s.toUpperCase());
            }
            if (requestData.get("pitcherFlexibility") != null) {
                String s = requestData.get("pitcherFlexibility").toString().trim();
                member.setPitcherFlexibility(s.isEmpty() ? null : s.toUpperCase());
            }
            if (requestData.get("runningSpeed") != null) {
                try { member.setRunningSpeed(((Number) requestData.get("runningSpeed")).doubleValue()); } catch (Exception e) { logger.warn("주력 파싱 실패: {}", requestData.get("runningSpeed")); }
            }
            if (requestData.get("swingSpeed") != null) {
                try { member.setSwingSpeed(((Number) requestData.get("swingSpeed")).doubleValue()); } catch (Exception e) { logger.warn("스윙 속도 파싱 실패: {}", requestData.get("swingSpeed")); }
            }
            if (requestData.get("exitVelocity") != null) {
                try { member.setExitVelocity(((Number) requestData.get("exitVelocity")).doubleValue()); } catch (Exception e) { logger.warn("타구 속도 파싱 실패: {}", requestData.get("exitVelocity")); }
            }
            if (requestData.get("batterPower") != null) {
                try { member.setBatterPower(((Number) requestData.get("batterPower")).doubleValue()); } catch (Exception e) { logger.warn("타자 파워 파싱 실패: {}", requestData.get("batterPower")); }
            }
            if (requestData.get("batterFlexibility") != null) {
                try { member.setBatterFlexibility(((Number) requestData.get("batterFlexibility")).doubleValue()); } catch (Exception e) { logger.warn("타자 유연성 파싱 실패: {}", requestData.get("batterFlexibility")); }
            }
            
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
            memberMap.put("pitcherPower", createdMember.getPitcherPower());
            memberMap.put("pitcherControl", createdMember.getPitcherControl());
            memberMap.put("pitcherFlexibility", createdMember.getPitcherFlexibility());
            memberMap.put("runningSpeed", createdMember.getRunningSpeed());
            memberMap.put("batterPower", createdMember.getBatterPower());
            memberMap.put("batterFlexibility", createdMember.getBatterFlexibility());
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
            memberMap.put("pitcherPower", updatedMember.getPitcherPower());
            memberMap.put("pitcherControl", updatedMember.getPitcherControl());
            memberMap.put("pitcherFlexibility", updatedMember.getPitcherFlexibility());
            memberMap.put("runningSpeed", updatedMember.getRunningSpeed());
            memberMap.put("batterPower", updatedMember.getBatterPower());
            memberMap.put("batterFlexibility", updatedMember.getBatterFlexibility());
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
    public ResponseEntity<Map<String, Object>> deleteMember(@PathVariable Long id, 
                                                             jakarta.servlet.http.HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        try {
            // 관리자 권한 확인
            String role = (String) request.getAttribute("role");
            if (role == null || !role.equals("ADMIN")) {
                logger.warn("회원 삭제 권한 없음: ID={}, Role={}", id, role);
                response.put("error", "회원 삭제는 관리자만 가능합니다.");
                response.put("message", "회원 삭제는 관리자만 가능합니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
            }
            
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
    public ResponseEntity<Map<String, Object>> deleteAllMembers(jakarta.servlet.http.HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        try {
            // 관리자 권한 확인
            String role = (String) request.getAttribute("role");
            if (role == null || !role.equals("ADMIN")) {
                logger.warn("회원 전체 삭제 권한 없음: Role={}", role);
                response.put("success", false);
                response.put("error", "회원 전체 삭제는 관리자만 가능합니다.");
                response.put("message", "회원 전체 삭제는 관리자만 가능합니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
            }
            
            logger.warn("⚠️ 회원 전체 삭제 요청 시작");
            long memberCount = memberRepository.count();
            logger.warn("⚠️ 삭제될 회원 수: {}명", memberCount);
            
            memberService.deleteAllMembers();
            
            String username = (String) request.getAttribute("username");
            try {
                String details = new ObjectMapper().writeValueAsString(Map.of("deletedCount", memberCount));
                actionAuditLogRepository.save(ActionAuditLog.of(username, "DELETE_ALL_MEMBERS", details));
            } catch (Exception logEx) {
                logger.warn("회원 전체 삭제 감사 로그 저장 실패: {}", logEx.getMessage());
            }
            
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
    
    // 모든 회원의 누락된 결제 일괄 생성 (관리자만 가능, DB 로그 저장)
    @PostMapping("/batch/create-missing-payments")
    public ResponseEntity<Map<String, Object>> createMissingPaymentsForAllMembers(HttpServletRequest request) {
        Map<String, Object> result = new HashMap<>();
        String role = (String) request.getAttribute("role");
        if (role == null || !role.equals("ADMIN")) {
            logger.warn("누락된 결제 일괄 생성 권한 없음: role={}", role);
            result.put("success", false);
            result.put("message", "누락된 결제 일괄 생성은 관리자만 사용할 수 있습니다.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(result);
        }
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
                                logger.error("결제 생성 실패 상세", e);
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
                        logger.error("결제 생성 실패 상세", e);
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
                    logger.error("결제 생성 실패 상세", e);
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
            
            String username = (String) request.getAttribute("username");
            try {
                String details = new ObjectMapper().writeValueAsString(Map.of(
                    "totalCreated", totalCreated, "totalSkipped", totalSkipped, "totalErrors", totalErrors, "totalMembers", allMembers.size()));
                actionAuditLogRepository.save(ActionAuditLog.of(username, "BATCH_CREATE_MISSING_PAYMENTS", details));
            } catch (Exception logEx) {
                logger.warn("결제 일괄 생성 감사 로그 저장 실패: {}", logEx.getMessage());
            }
            
            logger.info("모든 회원의 누락된 결제 일괄 생성 완료: 총 생성={}건, 건너뜀={}건, 오류={}건", 
                totalCreated, totalSkipped, totalErrors);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("누락된 결제 일괄 생성 중 오류 발생: {}", e.getMessage(), e);
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
                        logger.error("결제 생성 실패 상세", e);
                        errorCount++;
                        continue;
                    } catch (Exception e) {
                        logger.error("상품 정보 로드 실패: MemberProduct ID={}, 오류 타입: {}, 오류: {}", 
                            memberProductId, e.getClass().getName(), e.getMessage(), e);
                        logger.error("결제 생성 실패 상세", e);
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
                    payment.setPaymentMethod(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentMethod());
                    payment.setStatus(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentStatus());
                    payment.setCategory(com.afbscenter.constants.PaymentDefaults.getDefaultPaymentCategory());
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
                    logger.error("결제 생성 실패 상세", e);
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
            result.put("created", createdCount);
            result.put("skipped", skippedCount);
            result.put("errors", errorCount + 1);
            result.put("errorMessage", e.getMessage());
            result.put("errorType", e.getClass().getName());
            return result;
        }
    }

    // 결제 관리 번호 생성 (batch create-missing-payments에서 사용)
    private String generatePaymentNumber() {
        try {
            int year = LocalDate.now().getYear();
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
                    if (num > maxNumber) maxNumber = num;
                } catch (Exception e) { }
            }
            return String.format("PAY-%d-%04d", year, maxNumber + 1);
        } catch (Exception e) {
            logger.warn("결제 관리 번호 생성 실패, 타임스탬프 기반 번호 사용", e);
            return "PAY-" + System.currentTimeMillis();
        }
    }
}
