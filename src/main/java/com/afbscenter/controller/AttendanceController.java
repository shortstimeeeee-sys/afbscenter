package com.afbscenter.controller;

import com.afbscenter.model.ActionAuditLog;
import com.afbscenter.model.Attendance;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.MemberProductHistory;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.ActionAuditLogRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.validation.Valid;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private static final Logger logger = LoggerFactory.getLogger(AttendanceController.class);

    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final FacilityRepository facilityRepository;
    private final MemberProductRepository memberProductRepository;
    private final com.afbscenter.repository.BookingRepository bookingRepository;
    private final com.afbscenter.repository.TrainingLogRepository trainingLogRepository;
    private final com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository;
    private final MemberService memberService;
    private final JdbcTemplate jdbcTemplate;
    private final ActionAuditLogRepository actionAuditLogRepository;

    public AttendanceController(AttendanceRepository attendanceRepository,
                                MemberRepository memberRepository,
                                FacilityRepository facilityRepository,
                                MemberProductRepository memberProductRepository,
                                com.afbscenter.repository.BookingRepository bookingRepository,
                                com.afbscenter.repository.TrainingLogRepository trainingLogRepository,
                                com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository,
                                MemberService memberService,
                                JdbcTemplate jdbcTemplate,
                                ActionAuditLogRepository actionAuditLogRepository) {
        this.attendanceRepository = attendanceRepository;
        this.memberRepository = memberRepository;
        this.facilityRepository = facilityRepository;
        this.memberProductRepository = memberProductRepository;
        this.bookingRepository = bookingRepository;
        this.trainingLogRepository = trainingLogRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.memberService = memberService;
        this.jdbcTemplate = jdbcTemplate;
        this.actionAuditLogRepository = actionAuditLogRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<java.util.Map<String, Object>>> getAllAttendance(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Long memberId,
            @RequestParam(required = false) String memberNumber) {
        try {
            List<Attendance> attendances;
            
            // 회원 번호로 조회하는 경우
            if (memberNumber != null && !memberNumber.trim().isEmpty()) {
                java.util.Optional<Member> memberOpt = memberRepository.findByMemberNumber(memberNumber);
                if (memberOpt.isPresent()) {
                    attendances = attendanceRepository.findByMemberId(memberOpt.get().getId());
                } else {
                    logger.warn("회원번호로 회원을 찾을 수 없습니다: {}", memberNumber);
                    return ResponseEntity.ok(new java.util.ArrayList<>());
                }
            } else if (memberId != null) {
                attendances = attendanceRepository.findByMemberId(memberId);
            } else if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                attendances = attendanceRepository.findByDateRange(start, end);
            } else {
                // JOIN FETCH를 사용하여 Member와 Facility를 미리 로드 (enum 변환 오류 방지)
                try {
                    attendances = attendanceRepository.findAllWithMemberAndFacility();
                } catch (Exception e) {
                    logger.warn("출석 기록 전체 조회 실패, 빈 리스트 반환: {}", e.getMessage());
                    attendances = new java.util.ArrayList<>();
                }
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지 및 memberName, facilityName 추가)
            List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
            for (Attendance attendance : attendances) {
                try {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", attendance.getId());
                map.put("date", attendance.getDate());
                
                // Member 정보
                if (attendance.getMember() != null) {
                    map.put("memberId", attendance.getMember().getId());
                    map.put("memberName", attendance.getMember().getName());
                    map.put("memberNumber", attendance.getMember().getMemberNumber());
                } else {
                    map.put("memberId", null);
                    map.put("memberName", "-");
                    map.put("memberNumber", null);
                }
                
                // Facility 정보
                map.put("facilityName", attendance.getFacility() != null ? attendance.getFacility().getName() : "-");
                
                    map.put("checkInTime", attendance.getCheckInTime());
                    map.put("checkOutTime", attendance.getCheckOutTime());
                    map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
                    map.put("memo", attendance.getMemo());
                    map.put("penaltyApplied", attendance.getPenaltyApplied());
                    result.add(map);
                } catch (Exception e) {
                    logger.warn("출석 기록 변환 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                    // 해당 항목만 건너뛰고 계속 진행
                }
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("출석 기록 조회 중 오류 발생: {}", e.getMessage(), e);
            // 오류 발생 시 빈 리스트 반환 (서비스 중단 방지)
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<java.util.Map<String, Object>> getAttendanceById(@PathVariable Long id) {
        try {
            Attendance attendance = attendanceRepository.findById(id)
                    .orElse(null);
            
            if (attendance == null) {
                return ResponseEntity.notFound().build();
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지 및 memberName, facilityName 추가)
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", attendance.getId());
            map.put("date", attendance.getDate());
            map.put("memberId", attendance.getMember() != null ? attendance.getMember().getId() : null);
            map.put("memberName", attendance.getMember() != null ? attendance.getMember().getName() : "-");
            map.put("memberNumber", attendance.getMember() != null ? attendance.getMember().getMemberNumber() : null);
            map.put("facilityName", attendance.getFacility() != null ? attendance.getFacility().getName() : "-");
            map.put("facilityId", attendance.getFacility() != null ? attendance.getFacility().getId() : null);
            map.put("checkInTime", attendance.getCheckInTime());
            map.put("checkOutTime", attendance.getCheckOutTime());
            map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
            map.put("memo", attendance.getMemo());
            map.put("penaltyApplied", attendance.getPenaltyApplied());
            
            // Member 정보
            if (attendance.getMember() != null) {
                java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                memberMap.put("id", attendance.getMember().getId());
                memberMap.put("name", attendance.getMember().getName());
                memberMap.put("memberNumber", attendance.getMember().getMemberNumber());
                map.put("member", memberMap);
            } else {
                map.put("member", null);
            }
            
            // Facility 정보
            if (attendance.getFacility() != null) {
                java.util.Map<String, Object> facilityMap = new java.util.HashMap<>();
                facilityMap.put("id", attendance.getFacility().getId());
                facilityMap.put("name", attendance.getFacility().getName());
                map.put("facility", facilityMap);
            } else {
                map.put("facility", null);
            }
            
            // Booking 정보 (있는 경우)
            if (attendance.getBooking() != null) {
                java.util.Map<String, Object> bookingMap = new java.util.HashMap<>();
                bookingMap.put("id", attendance.getBooking().getId());
                bookingMap.put("startTime", attendance.getBooking().getStartTime());
                bookingMap.put("endTime", attendance.getBooking().getEndTime());
                bookingMap.put("purpose", attendance.getBooking().getPurpose() != null ? attendance.getBooking().getPurpose().name() : null);
                bookingMap.put("lessonCategory", attendance.getBooking().getLessonCategory() != null ? attendance.getBooking().getLessonCategory().name() : null);
                
                // 코치 정보
                if (attendance.getBooking().getCoach() != null) {
                    java.util.Map<String, Object> coachMap = new java.util.HashMap<>();
                    coachMap.put("id", attendance.getBooking().getCoach().getId());
                    coachMap.put("name", attendance.getBooking().getCoach().getName());
                    bookingMap.put("coach", coachMap);
                }
                
                // 이용권(MemberProduct) 정보 (체크인 시 사용된 이용권)
                if (attendance.getBooking().getMemberProduct() != null) {
                    try {
                        com.afbscenter.model.MemberProduct memberProduct = attendance.getBooking().getMemberProduct();
                        java.util.Map<String, Object> memberProductMap = new java.util.HashMap<>();
                        memberProductMap.put("id", memberProduct.getId());
                        
                        // 상품 정보
                        if (memberProduct.getProduct() != null) {
                            java.util.Map<String, Object> productMap = new java.util.HashMap<>();
                            productMap.put("id", memberProduct.getProduct().getId());
                            productMap.put("name", memberProduct.getProduct().getName());
                            productMap.put("type", memberProduct.getProduct().getType() != null ? memberProduct.getProduct().getType().name() : null);
                            memberProductMap.put("product", productMap);
                        }
                        
                        // 이용권에 지정된 코치 정보 (우선순위: MemberProduct.coach -> Product.coach)
                        java.util.Map<String, Object> memberProductCoachMap = null;
                        try {
                            if (memberProduct.getCoach() != null) {
                                memberProductCoachMap = new java.util.HashMap<>();
                                memberProductCoachMap.put("id", memberProduct.getCoach().getId());
                                memberProductCoachMap.put("name", memberProduct.getCoach().getName());
                            } else if (memberProduct.getProduct() != null && memberProduct.getProduct().getCoach() != null) {
                                memberProductCoachMap = new java.util.HashMap<>();
                                memberProductCoachMap.put("id", memberProduct.getProduct().getCoach().getId());
                                memberProductCoachMap.put("name", memberProduct.getProduct().getCoach().getName());
                            }
                        } catch (Exception e) {
                            logger.warn("이용권 코치 정보 읽기 실패: {}", e.getMessage());
                        }
                        
                        if (memberProductCoachMap != null) {
                            memberProductMap.put("coach", memberProductCoachMap);
                        }
                        
                        bookingMap.put("memberProduct", memberProductMap);
                    } catch (Exception e) {
                        logger.warn("이용권 정보 읽기 실패: {}", e.getMessage());
                        bookingMap.put("memberProduct", null);
                    }
                } else {
                    bookingMap.put("memberProduct", null);
                }
                
                map.put("booking", bookingMap);
            } else {
                map.put("booking", null);
            }
            
            return ResponseEntity.ok(map);
        } catch (Exception e) {
            logger.error("출석 기록 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Attendance> createAttendance(@Valid @RequestBody Attendance attendance) {
        try {
            // Member 설정
            Member member = null;
            if (attendance.getMember() != null && attendance.getMember().getId() != null) {
                member = memberRepository.findById(attendance.getMember().getId())
                        .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
                attendance.setMember(member);
            }
            
            // Facility 설정
            if (attendance.getFacility() != null && attendance.getFacility().getId() != null) {
                attendance.setFacility(facilityRepository.findById(attendance.getFacility().getId())
                        .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다.")));
            }
            
            // 출석 날짜 설정 (없으면 오늘 날짜)
            if (attendance.getDate() == null) {
                attendance.setDate(java.time.LocalDate.now());
            }
            
            // 출석 상태가 PRESENT인 경우에만 처리
            if (attendance.getStatus() == Attendance.AttendanceStatus.PRESENT && member != null) {
                // 1. 회원의 최근 방문일 업데이트
                member.setLastVisitDate(attendance.getDate());
                memberRepository.save(member);
                logger.debug("회원 최근 방문일 업데이트: Member ID={}, Date={}", member.getId(), attendance.getDate());
                
                // 2. 상품권 횟수 차감 (횟수권이 있는 경우)
                try {
                    LessonCategory lessonCategory = (attendance.getBooking() != null) 
                        ? attendance.getBooking().getLessonCategory() 
                        : null;
                    // 예약에 지정된 memberProduct가 있으면 해당 상품 사용
                    com.afbscenter.model.MemberProduct memberProductToUse = (attendance.getBooking() != null && attendance.getBooking().getMemberProduct() != null)
                        ? attendance.getBooking().getMemberProduct()
                        : null;
                    java.util.Map.Entry<MemberProduct, Integer> deductResult = decreaseCountPassUsage(member.getId(), lessonCategory, memberProductToUse);
                    
                    // 히스토리 저장
                    if (deductResult != null) {
                        saveProductHistory(member.getId(), deductResult.getKey(), deductResult.getValue(), 
                            deductResult.getKey().getRemainingCount(), attendance, null, "체크인으로 인한 차감");
                    }
                } catch (Exception e) {
                    logger.warn("상품권 횟수 차감 실패: Member ID={}", member.getId(), e);
                    // 상품권 차감 실패해도 출석 기록은 저장됨
                }
            }
            
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(attendanceRepository.save(attendance));
        } catch (IllegalArgumentException e) {
            logger.warn("출석 기록 생성 중 잘못된 인자: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("출석 기록 생성 중 오류 발생", e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * 횟수권 사용 차감
     * 가장 오래된 활성 횟수권부터 차감
     */
    private java.util.Map.Entry<MemberProduct, Integer> decreaseCountPassUsage(Long memberId, LessonCategory lessonCategory, MemberProduct specifiedMemberProduct) {
        logger.info("회권 차감 시작: Member ID={}, LessonCategory={}, SpecifiedMemberProduct={}", 
            memberId, lessonCategory != null ? lessonCategory.name() : "null", 
            specifiedMemberProduct != null ? specifiedMemberProduct.getId() : "null");
        
        MemberProduct memberProduct = null;
        
        // 예약에 지정된 memberProduct가 있으면 해당 상품 사용
        if (specifiedMemberProduct != null) {
            try {
                // product를 안전하게 로드
                com.afbscenter.model.Product product = null;
                try {
                    product = specifiedMemberProduct.getProduct();
                } catch (Exception e) {
                    logger.warn("MemberProduct의 Product 로드 실패: {}", e.getMessage());
                    // product ID로 직접 조회 시도
                    if (specifiedMemberProduct.getId() != null) {
                        try {
                            com.afbscenter.model.MemberProduct loaded = memberProductRepository.findById(specifiedMemberProduct.getId()).orElse(null);
                            if (loaded != null && loaded.getProduct() != null) {
                                product = loaded.getProduct();
                            }
                        } catch (Exception e2) {
                            logger.warn("MemberProduct 재조회 실패: {}", e2.getMessage());
                        }
                    }
                }
                
                // 지정된 상품이 활성 상태이고 횟수권인지 확인
                if (specifiedMemberProduct.getStatus() == MemberProduct.Status.ACTIVE &&
                    product != null &&
                    product.getType() == com.afbscenter.model.Product.ProductType.COUNT_PASS) {
                    memberProduct = specifiedMemberProduct;
                    logger.info("체크인 시 예약에 지정된 상품 사용: MemberProduct ID={}", memberProduct.getId());
                } else {
                    logger.warn("예약에 지정된 상품이 활성 상태가 아니거나 횟수권이 아님: MemberProduct ID={}, Status={}, Product={}", 
                        specifiedMemberProduct.getId(), 
                        specifiedMemberProduct.getStatus() != null ? specifiedMemberProduct.getStatus().name() : "null",
                        product != null ? product.getType() : "null");
                }
            } catch (Exception e) {
                logger.error("지정된 MemberProduct 확인 중 오류: {}", e.getMessage(), e);
            }
        }
        
        // 예약에 지정된 상품이 없거나 사용할 수 없으면 회원의 활성 횟수권 중 첫 번째 사용
        if (memberProduct == null) {
            List<MemberProduct> countPassProducts = 
                memberProductRepository.findActiveCountPassByMemberId(memberId);
            
            if (countPassProducts.isEmpty()) {
                logger.warn("체크인 시 차감할 활성 횟수권이 없음: Member ID={}", memberId);
                return null; // 횟수권이 없으면 차감하지 않음
            }
            
            // 레슨 카테고리와 맞는 횟수권 우선 사용
            List<MemberProduct> filteredByCategory = countPassProducts;
            if (lessonCategory != null) {
                filteredByCategory = countPassProducts.stream()
                    .filter(mp -> matchesLessonCategory(mp, lessonCategory))
                    .collect(java.util.stream.Collectors.toList());
                if (filteredByCategory.isEmpty()) {
                    filteredByCategory = countPassProducts;
                }
            }
            
            // 잔여 횟수가 적은 상품 우선, 그 다음 구매일 기준
            // remainingCount가 null이거나 0인 경우도 포함 (나중에 초기화 가능)
            filteredByCategory.sort((a, b) -> {
                Integer aRemaining = a.getRemainingCount() != null ? a.getRemainingCount() : Integer.MAX_VALUE;
                Integer bRemaining = b.getRemainingCount() != null ? b.getRemainingCount() : Integer.MAX_VALUE;
                int remainingCompare = Integer.compare(aRemaining, bRemaining);
                if (remainingCompare != 0) {
                    return remainingCompare;
                }
                if (a.getPurchaseDate() == null && b.getPurchaseDate() == null) return 0;
                if (a.getPurchaseDate() == null) return 1;
                if (b.getPurchaseDate() == null) return -1;
                return a.getPurchaseDate().compareTo(b.getPurchaseDate());
            });
            memberProduct = filteredByCategory.get(0);
            logger.info("체크인 시 회원의 활성 횟수권 선택: MemberProduct ID={}, Product Name={}, RemainingCount={}, LessonCategory={}", 
                memberProduct.getId(), 
                memberProduct.getProduct() != null ? memberProduct.getProduct().getName() : "unknown",
                memberProduct.getRemainingCount(),
                lessonCategory != null ? lessonCategory.name() : "null");
        }
        
        // LessonCategory를 레슨명으로 변환
        String lessonName = convertLessonCategoryToName(lessonCategory);
        
        // 패키지 상품인 경우 해당 레슨의 카운터만 차감
        // packageItemsRemaining이 있고 일반 횟수권이 아닌 경우 패키지 로직 사용
        // (일반 횟수권은 COUNT_PASS 타입이므로 패키지 로직을 사용하지 않음)
        com.afbscenter.model.Product productForType = null;
        try {
            productForType = memberProduct.getProduct();
        } catch (Exception e) {
            logger.warn("Product 로드 실패: MemberProduct ID={}, {}", memberProduct.getId(), e.getMessage());
        }
        
        // 일반 횟수권(COUNT_PASS)이 아니고 packageItemsRemaining이 있으면 패키지 상품으로 간주
        boolean isPackageProduct = productForType != null && 
                                   productForType.getType() != com.afbscenter.model.Product.ProductType.COUNT_PASS &&
                                   memberProduct.getPackageItemsRemaining() != null && 
                                   !memberProduct.getPackageItemsRemaining().isEmpty();
        
        if (isPackageProduct) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                List<Map<String, Object>> items = mapper.readValue(
                    memberProduct.getPackageItemsRemaining(), 
                    new TypeReference<List<Map<String, Object>>>() {}
                );
                
                boolean updated = false;
                for (Map<String, Object> item : items) {
                    if (lessonName.equals(item.get("name"))) {
                        int remaining = ((Number) item.get("remaining")).intValue();
                        if (remaining > 0) {
                            item.put("remaining", remaining - 1);
                            updated = true;
                            logger.info("패키지 레슨 차감: {} - {}회 남음", lessonName, remaining - 1);
                            break;
                        }
                    }
                }
                
                if (updated) {
                    // 차감 후 remaining 값을 가져오기 위해 다시 계산
                    Integer beforeRemaining = null;
                    for (Map<String, Object> item : items) {
                        if (lessonName.equals(item.get("name"))) {
                            beforeRemaining = ((Number) item.get("remaining")).intValue() + 1; // 차감 전 값
                            break;
                        }
                    }
                    if (beforeRemaining == null) {
                        beforeRemaining = 0;
                    }
                    
                    memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(items));
                    
                    // 모든 항목이 0이 되면 상태 변경
                    boolean allZero = items.stream()
                        .allMatch(item -> ((Number) item.get("remaining")).intValue() == 0);
                    if (allZero) {
                        memberProduct.setStatus(MemberProduct.Status.USED_UP);
                    }
                    
                    memberProductRepository.save(memberProduct);
                    logger.info("상품권 패키지 횟수 차감 완료: MemberProduct ID={}, Product Name={}, 레슨={}, 차감 전: {}회", 
                        memberProduct.getId(), 
                        memberProduct.getProduct() != null ? memberProduct.getProduct().getName() : "unknown",
                        lessonName, beforeRemaining);
                    
                    return new java.util.AbstractMap.SimpleEntry<>(memberProduct, beforeRemaining);
                } else {
                    logger.warn("패키지 레슨 차감 실패: 해당 레슨의 잔여 횟수가 0. MemberProduct ID={}, 레슨={}", 
                        memberProduct.getId(), lessonName);
                    return null;
                }
            } catch (Exception e) {
                logger.error("패키지 횟수 차감 실패", e);
                return null;
            }
        }
        // 일반 횟수권인 경우
        else {
            // remainingCount가 null이거나 0이면 totalCount나 product의 usageCount로 초기화
            Integer currentRemaining = memberProduct.getRemainingCount();
            boolean needsInitialization = (currentRemaining == null || currentRemaining == 0);
            
            if (needsInitialization) {
                final MemberProduct finalMemberProduct = memberProduct; // final 변수로 복사
                logger.info("회권 remainingCount 초기화 필요: MemberProduct ID={}, 현재 remainingCount={}", 
                    finalMemberProduct.getId(), currentRemaining);
                
                // totalCount 확인
                currentRemaining = finalMemberProduct.getTotalCount();
                if (currentRemaining == null || currentRemaining <= 0) {
                    // product의 usageCount 확인
                    try {
                        com.afbscenter.model.Product product = finalMemberProduct.getProduct();
                        if (product != null && product.getUsageCount() != null && product.getUsageCount() > 0) {
                            currentRemaining = product.getUsageCount();
                            logger.info("Product의 usageCount로 초기화: MemberProduct ID={}, usageCount={}", 
                                finalMemberProduct.getId(), currentRemaining);
                        } else {
                            logger.warn("회권 차감 실패: remainingCount가 null/0이고 totalCount/usageCount도 없음. MemberProduct ID={}, Product Name={}", 
                                finalMemberProduct.getId(),
                                product != null ? product.getName() : "unknown");
                            return null; // 차감할 수 없음
                        }
                    } catch (Exception e) {
                        logger.error("Product 로드 실패: MemberProduct ID={}", finalMemberProduct.getId(), e);
                        return null;
                    }
                } else {
                    logger.info("totalCount로 초기화: MemberProduct ID={}, totalCount={}", 
                        finalMemberProduct.getId(), currentRemaining);
                }
                
                // 사용 기록 확인하여 실제 잔여 횟수 계산
                // 체크인된 출석 기록은 모두 카운트 (체크인 시 이미 차감되었으므로)
                try {
                    final Long memberProductId = finalMemberProduct.getId(); // final 변수로 복사
                    
                    // 체크인 완료된 출석 기록 카운트 (체크인만 되어도 차감되었으므로 모두 카운트)
                    Long usedCountByAttendance = 0L;
                    try {
                        List<com.afbscenter.model.Attendance> checkedInAttendances = 
                            attendanceRepository.findByMemberId(memberId).stream()
                                .filter(a -> a.getBooking() != null && 
                                           a.getBooking().getMemberProduct() != null &&
                                           a.getBooking().getMemberProduct().getId().equals(memberProductId) &&
                                           a.getCheckInTime() != null) // 체크인만 되어도 차감되었으므로 모두 카운트
                                .collect(java.util.stream.Collectors.toList());
                        usedCountByAttendance = (long) checkedInAttendances.size();
                    } catch (Exception e) {
                        logger.warn("출석 기록 확인 실패: {}", e.getMessage());
                    }
                    
                    // booking의 confirmed 상태도 확인 (예약 확정 시 차감되는 경우 대비)
                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(memberProductId);
                    if (usedCountByBooking == null) usedCountByBooking = 0L;
                    
                    // attendance와 booking 중 더 큰 값 사용 (중복 방지)
                    // 체크인된 출석 기록이 더 정확하므로 우선 사용
                    Long actualUsedCount = Math.max(usedCountByAttendance, usedCountByBooking);
                    Integer calculatedRemaining = Math.max(0, currentRemaining - actualUsedCount.intValue());
                    
                    logger.info("사용 기록 기반 재계산: MemberProduct ID={}, totalCount={}, usedCountByBooking={}, usedCountByAttendance={}, actualUsedCount={}, calculatedRemaining={}", 
                        memberProductId, currentRemaining, usedCountByBooking, usedCountByAttendance, actualUsedCount, calculatedRemaining);
                    
                    currentRemaining = calculatedRemaining;
                } catch (Exception e) {
                    logger.warn("사용 기록 확인 실패, totalCount/usageCount 사용: {}", e.getMessage());
                }
                
                memberProduct.setRemainingCount(currentRemaining);
                if (memberProduct.getTotalCount() == null || memberProduct.getTotalCount() <= 0) {
                    // totalCount도 설정 (usageCount에서 가져온 경우)
                    try {
                        com.afbscenter.model.Product product = memberProduct.getProduct();
                        if (product != null && product.getUsageCount() != null && product.getUsageCount() > 0) {
                            memberProduct.setTotalCount(product.getUsageCount());
                        }
                    } catch (Exception e) {
                        // 무시
                    }
                }
            } else {
                // 초기화가 필요 없는 경우, 현재 remainingCount 사용
                currentRemaining = memberProduct.getRemainingCount();
            }
            
            // remainingCount가 0보다 크면 차감
            // 초기화 후에도 0이면 차감 불가
            if (currentRemaining == null) {
                currentRemaining = memberProduct.getRemainingCount();
            }
            
            if (currentRemaining != null && currentRemaining > 0) {
                Integer beforeRemaining = currentRemaining;
                memberProduct.setRemainingCount(currentRemaining - 1);
                
                // 횟수가 0이 되면 상태 변경
                if (memberProduct.getRemainingCount() == 0) {
                    memberProduct.setStatus(MemberProduct.Status.USED_UP);
                }
                
                memberProductRepository.save(memberProduct);
                logger.info("상품권 횟수 차감 완료: MemberProduct ID={}, Product Name={}, totalCount={}, 잔여={}회 (차감 전: {}회)", 
                    memberProduct.getId(), 
                    memberProduct.getProduct() != null ? memberProduct.getProduct().getName() : "unknown",
                    memberProduct.getTotalCount(),
                    memberProduct.getRemainingCount(), beforeRemaining);
                
                // 히스토리 저장을 위해 반환값으로 변경 정보 전달
                // 히스토리는 호출하는 쪽에서 저장 (attendance 정보 필요)
                return new java.util.AbstractMap.SimpleEntry<>(memberProduct, beforeRemaining);
            } else if (currentRemaining == null || currentRemaining == 0) {
                // remainingCount가 0이면 이미 사용 완료된 상품
                logger.warn("회권 차감 실패: remainingCount가 0 또는 null (이미 사용 완료 또는 초기화 실패). MemberProduct ID={}, Product Name={}, totalCount={}, currentRemaining={}", 
                    memberProduct.getId(),
                    memberProduct.getProduct() != null ? memberProduct.getProduct().getName() : "unknown",
                    memberProduct.getTotalCount(),
                    currentRemaining);
                return null;
            } else {
                logger.warn("회권 차감 실패: remainingCount가 음수. MemberProduct ID={}, remainingCount={}", 
                    memberProduct.getId(), currentRemaining);
                return null;
            }
        }
    }
    
    // 이용권 히스토리 저장
    private void saveProductHistory(Long memberId, MemberProduct memberProduct, Integer beforeRemaining, 
                                    Integer afterRemaining, Attendance attendance, Payment payment, String description) {
        try {
            MemberProductHistory history = new MemberProductHistory();
            history.setMemberProduct(memberProduct);
            history.setMember(memberRepository.findById(memberId).orElse(null));
            history.setAttendance(attendance);
            history.setPayment(payment);
            history.setTransactionDate(java.time.LocalDateTime.now());
            history.setType(payment != null ? MemberProductHistory.TransactionType.CHARGE : MemberProductHistory.TransactionType.DEDUCT);
            history.setChangeAmount(afterRemaining - beforeRemaining);
            history.setRemainingCountAfter(afterRemaining);
            history.setDescription(description);
            memberProductHistoryRepository.save(history);
            logger.debug("이용권 히스토리 저장: MemberProduct ID={}, Change={}, After={}", 
                memberProduct.getId(), history.getChangeAmount(), afterRemaining);
        } catch (Exception e) {
            logger.warn("이용권 히스토리 저장 실패: {}", e.getMessage());
        }
    }
    
    // LessonCategory enum을 패키지 레슨명으로 변환
    private String convertLessonCategoryToName(LessonCategory category) {
        if (category == null) return "";
        switch (category) {
            case BASEBALL: return "야구";
            case YOUTH_BASEBALL: return "유소년 야구";
            case PILATES: return "필라테스";
            case TRAINING: return "트레이닝";
            default: return "";
        }
    }

    private boolean matchesLessonCategory(MemberProduct memberProduct, LessonCategory lessonCategory) {
        if (memberProduct == null || lessonCategory == null) return false;
        try {
            com.afbscenter.model.Product product = memberProduct.getProduct();
            if (product == null) return false;
            // 카테고리 우선 매칭
            if (product.getCategory() != null) {
                String category = product.getCategory().name();
                if (lessonCategory == LessonCategory.BASEBALL && "BASEBALL".equals(category)) return true;
                if (lessonCategory == LessonCategory.YOUTH_BASEBALL && ("YOUTH_BASEBALL".equals(category) || "BASEBALL".equals(category))) return true;
                if (lessonCategory == LessonCategory.PILATES && "PILATES".equals(category)) return true;
                if (lessonCategory == LessonCategory.TRAINING &&
                    ("TRAINING".equals(category) || "TRAINING_FITNESS".equals(category))) return true;
            }
            
            // 상품명으로 보조 매칭
            String productName = product.getName() != null ? product.getName().toLowerCase() : "";
            switch (lessonCategory) {
                case BASEBALL:
                    return productName.contains("야구") || productName.contains("baseball");
                case YOUTH_BASEBALL:
                    return productName.contains("유소년") || productName.contains("야구") || productName.contains("youth") || productName.contains("baseball");
                case PILATES:
                    return productName.contains("필라테스") || productName.contains("pilates");
                case TRAINING:
                    return productName.contains("트레이닝") || productName.contains("training");
                default:
                    return false;
            }
        } catch (Exception e) {
            return false;
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Attendance> updateAttendance(@PathVariable Long id, @Valid @RequestBody Attendance updatedAttendance) {
        try {
            Attendance attendance = attendanceRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("출석 기록을 찾을 수 없습니다."));
            
            if (updatedAttendance.getStatus() != null) {
                attendance.setStatus(updatedAttendance.getStatus());
            }
            if (updatedAttendance.getCheckInTime() != null) {
                attendance.setCheckInTime(updatedAttendance.getCheckInTime());
            }
            if (updatedAttendance.getCheckOutTime() != null) {
                attendance.setCheckOutTime(updatedAttendance.getCheckOutTime());
            }
            if (updatedAttendance.getMemo() != null) {
                attendance.setMemo(updatedAttendance.getMemo());
            }
            if (updatedAttendance.getPenaltyApplied() != null) {
                attendance.setPenaltyApplied(updatedAttendance.getPenaltyApplied());
            }
            
            return ResponseEntity.ok(attendanceRepository.save(attendance));
        } catch (IllegalArgumentException e) {
            logger.warn("출석 기록을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("출석 기록 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteAttendance(@PathVariable Long id) {
        try {
            if (!attendanceRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            attendanceRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("출석 기록 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }
    
    // 체크인만 있고 체크아웃이 없는 출석 기록 일괄 삭제 (관리자만 가능, DB 로그 저장)
    @DeleteMapping("/reset-incomplete")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> resetIncompleteAttendances(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if (role == null || !role.equals("ADMIN")) {
            logger.warn("이용중 출석 리셋 권한 없음: role={}", role);
            java.util.Map<String, Object> err = new java.util.HashMap<>();
            err.put("error", "이용중 출석 기록 리셋은 관리자만 사용할 수 있습니다.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(err);
        }
        try {
            // 체크인은 있지만 체크아웃이 없는 출석 기록 조회
            List<Attendance> incompleteAttendances = attendanceRepository.findIncompleteAttendances();
            
            if (incompleteAttendances.isEmpty()) {
                java.util.Map<String, Object> result = new java.util.HashMap<>();
                result.put("message", "리셋할 출석 기록이 없습니다.");
                result.put("deletedCount", 0);
                String username = (String) request.getAttribute("username");
                try {
                    actionAuditLogRepository.save(ActionAuditLog.of(username, "RESET_INCOMPLETE_ATTENDANCES", "{\"deletedCount\":0}"));
                } catch (Exception logEx) {
                    logger.warn("출석 리셋 감사 로그 저장 실패: {}", logEx.getMessage());
                }
                return ResponseEntity.ok(result);
            }
            
            int deletedCount = 0;
            for (Attendance attendance : incompleteAttendances) {
                try {
                    attendanceRepository.deleteById(attendance.getId());
                    deletedCount++;
                    logger.info("이용중 출석 기록 삭제: Attendance ID={}, Member={}, Date={}", 
                        attendance.getId(),
                        attendance.getMember() != null ? attendance.getMember().getName() : "비회원",
                        attendance.getDate());
                } catch (Exception e) {
                    logger.warn("출석 기록 삭제 실패: Attendance ID={}, 오류: {}", attendance.getId(), e.getMessage());
                }
            }
            
            String username = (String) request.getAttribute("username");
            try {
                String details = new ObjectMapper().writeValueAsString(java.util.Map.of("deletedCount", deletedCount));
                actionAuditLogRepository.save(ActionAuditLog.of(username, "RESET_INCOMPLETE_ATTENDANCES", details));
            } catch (Exception logEx) {
                logger.warn("출석 리셋 감사 로그 저장 실패: {}", logEx.getMessage());
            }
            
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("message", String.format("%d개의 이용중 출석 기록이 삭제되었습니다.", deletedCount));
            result.put("deletedCount", deletedCount);
            
            logger.info("이용중 출석 기록 일괄 삭제 완료: {}건", deletedCount);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("이용중 출석 기록 일괄 삭제 중 오류 발생", e);
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", "이용중 출석 기록 삭제 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // 체크인 처리 (예약 기반)
    @PostMapping("/checkin")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> processCheckin(@RequestBody java.util.Map<String, Object> checkinData) {
        try {
            // bookingId 추출
            Long bookingId = null;
            if (checkinData.get("bookingId") != null) {
                if (checkinData.get("bookingId") instanceof Number) {
                    bookingId = ((Number) checkinData.get("bookingId")).longValue();
                } else {
                    bookingId = Long.parseLong(checkinData.get("bookingId").toString());
                }
            }
            
            if (bookingId == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "예약 ID가 필요합니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 예약 정보 조회
            final Long finalBookingId = bookingId; // effectively final 변수 생성
            logger.info("체크인 시작: Booking ID={}", finalBookingId);
            
            com.afbscenter.model.Booking booking = null;
            try {
                booking = bookingRepository.findByIdWithAllRelations(finalBookingId);
                logger.debug("findByIdWithAllRelations로 예약 조회 성공: Booking ID={}", finalBookingId);
            } catch (Exception e) {
                logger.warn("findByIdWithAllRelations 실패, findByIdWithFacilityAndMember 시도: {}", e.getMessage());
                try {
                    booking = bookingRepository.findByIdWithFacilityAndMember(finalBookingId);
                    logger.debug("findByIdWithFacilityAndMember로 예약 조회 성공: Booking ID={}", finalBookingId);
                } catch (Exception e2) {
                    logger.warn("findByIdWithFacilityAndMember 실패, findById 시도: {}", e2.getMessage());
                }
            }
            
            if (booking == null) {
                try {
                    booking = bookingRepository.findById(finalBookingId)
                            .orElseThrow(() -> new IllegalArgumentException("예약을 찾을 수 없습니다. Booking ID: " + finalBookingId));
                    logger.debug("findById로 예약 조회 성공: Booking ID={}", finalBookingId);
                } catch (Exception e) {
                    logger.error("예약 조회 실패: Booking ID={}, 오류: {}", finalBookingId, e.getMessage(), e);
                    throw new IllegalArgumentException("예약을 찾을 수 없습니다. Booking ID: " + finalBookingId, e);
                }
            }
            
            // 예약 기본 정보 로깅
            logger.info("예약 정보: ID={}, Member={}, Facility={}, StartTime={}, Status={}", 
                booking.getId(),
                booking.getMember() != null ? booking.getMember().getId() : "null",
                booking.getFacility() != null ? booking.getFacility().getId() : "null",
                booking.getStartTime(),
                booking.getStatus());
            
            // memberProduct를 안전하게 조회 (lazy loading 방지)
            com.afbscenter.model.MemberProduct bookingMemberProduct = null;
            try {
                // booking에서 memberProduct ID를 직접 가져오기 (lazy loading 방지)
                com.afbscenter.model.MemberProduct lazyMemberProduct = booking.getMemberProduct();
                if (lazyMemberProduct != null) {
                    Long memberProductId = lazyMemberProduct.getId();
                    if (memberProductId != null) {
                        // memberProduct를 명시적으로 조회 (product와 함께 로드)
                        bookingMemberProduct = memberProductRepository.findByIdWithMember(memberProductId).orElse(null);
                        if (bookingMemberProduct == null) {
                            // findByIdWithMember가 없으면 일반 findById 사용
                            bookingMemberProduct = memberProductRepository.findById(memberProductId).orElse(null);
                        }
                    }
                }
            } catch (org.hibernate.LazyInitializationException e) {
                // lazy loading 예외 발생 시 booking의 memberProductId를 직접 조회
                logger.debug("LazyInitializationException 발생, memberProductId 직접 조회: {}", e.getMessage());
                try {
                    // JPA 쿼리로 memberProductId 직접 조회
                    List<Long> results = jdbcTemplate.query(
                        "SELECT member_product_id FROM bookings WHERE id = ?",
                        (rs, rowNum) -> {
                            Long id = rs.getLong("member_product_id");
                            return rs.wasNull() ? null : id;
                        },
                        finalBookingId
                    );
                    if (!results.isEmpty() && results.get(0) != null) {
                        Long memberProductId = results.get(0);
                        bookingMemberProduct = memberProductRepository.findByIdWithMember(memberProductId).orElse(null);
                        if (bookingMemberProduct == null) {
                            bookingMemberProduct = memberProductRepository.findById(memberProductId).orElse(null);
                        }
                    }
                } catch (Exception e2) {
                    logger.warn("memberProductId 직접 조회 실패: {}", e2.getMessage());
                }
            } catch (Exception e) {
                logger.warn("Booking의 MemberProduct 조회 실패: {}", e.getMessage());
            }

            // memberProduct가 없으면 전체 관계로 재조회 시도
            if (bookingMemberProduct == null) {
                try {
                    com.afbscenter.model.Booking bookingWithAll = bookingRepository.findByIdWithAllRelations(finalBookingId);
                    if (bookingWithAll != null && bookingWithAll.getMemberProduct() != null) {
                        bookingMemberProduct = bookingWithAll.getMemberProduct();
                    }
                } catch (Exception e) {
                    logger.debug("memberProduct 재조회 실패 (무시): {}", e.getMessage());
                }
            }
            
            // 이미 출석 기록이 있는지 확인
            java.util.Optional<Attendance> existingAttendance = attendanceRepository.findByBookingId(finalBookingId);
            
            Attendance attendance;
            boolean isNewAttendance = false;
            // 예약 날짜 결정 (booking.startTime의 날짜를 사용하여 캘린더와 일치시킴)
            java.time.LocalDate bookingDate = null;
            if (booking.getStartTime() != null) {
                bookingDate = booking.getStartTime().toLocalDate();
            } else {
                bookingDate = java.time.LocalDate.now();
            }
            
            // 차감 정보 저장용 변수 (응답에 포함하기 위해 상위 스코프에 선언)
            java.util.Map.Entry<MemberProduct, Integer> deductResultForResponse = null;
            // 차감 실패/건너뜀 정보 저장용 변수
            String deductSkipReason = null;
            String deductFailReason = null;
            
            if (existingAttendance.isPresent()) {
                // 기존 출석 기록이 있으면 업데이트
                attendance = existingAttendance.get();
                // 이미 체크인된 경우 중복 차감 방지
                if (attendance.getCheckInTime() != null) {
                    logger.warn("이미 체크인된 예약입니다. Booking ID={}", finalBookingId);
                    java.util.Map<String, Object> error = new java.util.HashMap<>();
                    error.put("error", "이미 체크인된 예약입니다.");
                    return ResponseEntity.badRequest().body(error);
                }
                // 기존 출석 기록이지만 아직 체크인하지 않은 경우, 차감을 위해 isNewAttendance를 true로 설정
                isNewAttendance = true;
                // 기존 출석 기록의 날짜도 예약 날짜로 업데이트 (캘린더와 일치시키기 위해)
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
                logger.info("기존 출석 기록에 체크인 처리: Attendance ID={}, Booking ID={}, 체크인 시간이 null이었으므로 차감 진행", 
                    attendance.getId(), finalBookingId);
            } else {
                // 새로운 출석 기록 생성
                isNewAttendance = true;
                attendance = new Attendance();
                attendance.setBooking(booking);
                attendance.setMember(booking.getMember());
                attendance.setFacility(booking.getFacility());
                // 예약 날짜(booking.startTime의 날짜)를 사용하여 캘린더와 일치시킴
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
            }
            
            // 회원이 있는 경우에만 회원 관련 처리 (대관 등 비회원 예약은 회원 처리 건너뜀)
            if (attendance.getMember() != null) {
                Member member = memberRepository.findById(attendance.getMember().getId())
                        .orElse(null);
                
                if (member != null) {
                    // 1. 회원의 최근 방문일 업데이트
                    member.setLastVisitDate(attendance.getDate());
                    memberRepository.save(member);
                    logger.debug("회원 최근 방문일 업데이트: Member ID={}, Date={}", member.getId(), attendance.getDate());
                    
                    // 2. 상품권 횟수 차감 (autoDeduct가 true이고 새로운 출석 기록인 경우에만)
                    // 체크인 시에만 차감 (예약 확정 시에는 차감하지 않음)
                    // 대관(RENTAL) 예약은 횟수권 차감하지 않음
                    Boolean autoDeduct = checkinData.get("autoDeduct") != null ? 
                            Boolean.parseBoolean(checkinData.get("autoDeduct").toString()) : true;
                    
                    // 대관 예약이 아니고 레슨 예약인 경우에만 횟수권 차감
                    boolean isRental = booking.getPurpose() != null && 
                                      booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL;
                    
                    logger.info("체크인 이용권 차감 조건 확인: autoDeduct={}, isNewAttendance={}, isRental={}, Booking ID={}", 
                        autoDeduct, isNewAttendance, isRental, finalBookingId);
                    
                    if (autoDeduct && isNewAttendance && !isRental) {
                        try {
                            // 예약에 지정된 memberProduct가 있으면 해당 상품 사용, 없으면 회원의 활성 횟수권 중 첫 번째 사용
                            com.afbscenter.model.MemberProduct memberProductToUse = bookingMemberProduct;
                            
                            if (memberProductToUse == null) {
                                List<MemberProduct> countPassProducts = 
                                    memberProductRepository.findActiveCountPassByMemberId(member.getId());
                                
                                logger.info("체크인 시 활성 횟수권 조회: Member ID={}, 조회된 횟수권 수={}, Booking ID={}", 
                                    member.getId(), countPassProducts != null ? countPassProducts.size() : 0, finalBookingId);
                                
                                if (countPassProducts != null && !countPassProducts.isEmpty()) {
                                    // 레슨 카테고리와 맞는 횟수권 우선 사용
                                    LessonCategory lessonCategory = booking.getLessonCategory();
                                    List<MemberProduct> filteredByCategory = countPassProducts;
                                    if (lessonCategory != null) {
                                        filteredByCategory = countPassProducts.stream()
                                            .filter(mp -> matchesLessonCategory(mp, lessonCategory))
                                            .collect(java.util.stream.Collectors.toList());
                                        if (filteredByCategory.isEmpty()) {
                                            filteredByCategory = countPassProducts;
                                        }
                                    }
                                    
                                    // 잔여 횟수가 적은 상품 우선, 그 다음 구매일 기준
                                    filteredByCategory.sort((a, b) -> {
                                        Integer aRemaining = a.getRemainingCount() != null ? a.getRemainingCount() : Integer.MAX_VALUE;
                                        Integer bRemaining = b.getRemainingCount() != null ? b.getRemainingCount() : Integer.MAX_VALUE;
                                        int remainingCompare = Integer.compare(aRemaining, bRemaining);
                                        if (remainingCompare != 0) {
                                            return remainingCompare;
                                        }
                                        if (a.getPurchaseDate() == null && b.getPurchaseDate() == null) return 0;
                                        if (a.getPurchaseDate() == null) return 1;
                                        if (b.getPurchaseDate() == null) return -1;
                                        return a.getPurchaseDate().compareTo(b.getPurchaseDate());
                                    });
                                    
                                    memberProductToUse = filteredByCategory.get(0);
                                    logger.info("체크인 시 기본 횟수권 지정: MemberProduct ID={}, Product Name={}, RemainingCount={}, TotalCount={}, Booking ID={}", 
                                        memberProductToUse.getId(), 
                                        memberProductToUse.getProduct() != null ? memberProductToUse.getProduct().getName() : "unknown",
                                        memberProductToUse.getRemainingCount(),
                                        memberProductToUse.getTotalCount(),
                                        finalBookingId);
                                    
                                    // 예약에 상품이 없으면 연결하여 추적 가능하게 설정
                                    if (booking.getMemberProduct() == null) {
                                        booking.setMemberProduct(memberProductToUse);
                                        bookingRepository.save(booking);
                                    }
                                } else {
                                    logger.warn("체크인 시 차감할 활성 횟수권이 없음: Member ID={}, Booking ID={}", 
                                        member.getId(), finalBookingId);
                                }
                            } else {
                                logger.info("체크인 시 예약에 지정된 상품 사용: MemberProduct ID={}, Product Name={}, RemainingCount={}, Booking ID={}", 
                                    memberProductToUse.getId(),
                                    memberProductToUse.getProduct() != null ? memberProductToUse.getProduct().getName() : "unknown",
                                    memberProductToUse.getRemainingCount(),
                                    finalBookingId);
                            }
                            
                            if (memberProductToUse != null) {
                                LessonCategory lessonCategory = booking.getLessonCategory();
                                if (lessonCategory == null) {
                                    logger.warn("예약의 LessonCategory가 null입니다. Booking ID={}", finalBookingId);
                                }
                                java.util.Map.Entry<MemberProduct, Integer> deductResult = decreaseCountPassUsage(member.getId(), lessonCategory, memberProductToUse);
                                
                                // 히스토리 저장
                                if (deductResult != null) {
                                    deductResultForResponse = deductResult; // 응답용으로 저장
                                    saveProductHistory(member.getId(), deductResult.getKey(), deductResult.getValue(), 
                                        deductResult.getKey().getRemainingCount(), attendance, null, "체크인으로 인한 차감");
                                    logger.info("상품권 횟수 차감 완료: Member ID={}, Booking ID={}, MemberProduct ID={}, 차감 전: {}회, 차감 후: {}회", 
                                        member.getId(), finalBookingId, deductResult.getKey().getId(), 
                                        deductResult.getValue(), deductResult.getKey().getRemainingCount());
                                } else {
                                    logger.warn("이용권 차감 실패: decreaseCountPassUsage가 null 반환. Member ID={}, Booking ID={}, MemberProduct ID={}", 
                                        member.getId(), finalBookingId, memberProductToUse.getId());
                                    // 차감 실패 이유 저장
                                    deductFailReason = "이용권 차감 실패 (remainingCount가 0이거나 차감할 수 없음)";
                                }
                            } else {
                                logger.warn("이용권 차감 실패: 사용할 MemberProduct가 없음. Member ID={}, Booking ID={}", 
                                    member.getId(), finalBookingId);
                                // 차감 실패 이유 저장
                                deductFailReason = "활성 횟수권이 없음";
                            }
                        } catch (Exception e) {
                            logger.error("상품권 횟수 차감 실패: Member ID={}, Booking ID={}", member.getId(), finalBookingId, e);
                            // 상품권 차감 실패해도 출석 기록은 저장됨
                        }
                    } else {
                        if (!autoDeduct) {
                            deductSkipReason = "autoDeduct가 false로 설정됨";
                            logger.info("autoDeduct가 false로 설정되어 이용권 차감을 건너뜁니다. Booking ID={}", finalBookingId);
                        } else if (!isNewAttendance) {
                            deductSkipReason = "기존 출석 기록 업데이트";
                            logger.info("기존 출석 기록 업데이트 - 횟수권 차감 건너뜀: Attendance ID={}, Booking ID={}", 
                                attendance.getId(), finalBookingId);
                        } else if (isRental) {
                            deductSkipReason = "대관 예약";
                            logger.info("대관 예약 - 횟수권 차감 건너뜀: Booking ID={}", finalBookingId);
                        }
                    }
                }
            } else {
                // 비회원 예약 (대관 등) - 회원 관련 처리 없이 출석 기록만 저장
                logger.info("비회원 예약 체크인: Booking ID={}, NonMemberName={}", 
                    finalBookingId, booking.getNonMemberName());
            }
            
            Attendance saved = attendanceRepository.save(attendance);
            
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("checkInTime", saved.getCheckInTime());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", "체크인이 완료되었습니다.");
            
            // 차감 실패/건너뜀 정보 추가
            if (deductFailReason != null) {
                result.put("deductFailed", true);
                result.put("deductFailReason", deductFailReason);
            } else if (deductSkipReason != null) {
                result.put("deductSkipped", true);
                result.put("deductSkipReason", deductSkipReason);
            }
            
            // 이용권 차감 정보 추가
            if (deductResultForResponse != null) {
                try {
                    MemberProduct deductedProduct = deductResultForResponse.getKey();
                    Integer beforeCount = deductResultForResponse.getValue(); // 차감 전 횟수
                    Integer afterCount = deductedProduct.getRemainingCount(); // 차감 후 횟수
                    
                    // 같은 상품을 여러 번 구매한 경우 총 횟수 합산
                    Integer totalCount = deductedProduct.getTotalCount();
                    if (deductedProduct.getProduct() != null && deductedProduct.getMember() != null) {
                        try {
                            List<MemberProduct> sameProducts = memberProductRepository.findByMemberIdAndProductId(
                                deductedProduct.getMember().getId(), 
                                deductedProduct.getProduct().getId()
                            );
                            if (sameProducts != null && !sameProducts.isEmpty()) {
                                // 같은 상품의 모든 구매의 totalCount 합산
                                totalCount = sameProducts.stream()
                                    .filter(mp -> mp.getTotalCount() != null)
                                    .mapToInt(MemberProduct::getTotalCount)
                                    .sum();
                                logger.info("같은 상품 여러 구매 합산: Product ID={}, 구매 수={}, 총 횟수={}", 
                                    deductedProduct.getProduct().getId(), sameProducts.size(), totalCount);
                            }
                        } catch (Exception e) {
                            logger.warn("같은 상품 구매 조회 실패, 단일 구매 totalCount 사용: {}", e.getMessage());
                        }
                    }
                    
                    java.util.Map<String, Object> productDeducted = new java.util.HashMap<>();
                    productDeducted.put("productName", deductedProduct.getProduct() != null ? 
                        deductedProduct.getProduct().getName() : "이용권");
                    productDeducted.put("remainingCount", afterCount);
                    productDeducted.put("totalCount", totalCount);
                    productDeducted.put("beforeCount", beforeCount);
                    
                    result.put("productDeducted", productDeducted);
                    
                    logger.info("체크인 완료: Attendance ID={}, Booking ID={}, Member ID={}, ProductDeducted={}, ProductName={}, Before={}, After={}", 
                        saved.getId(), finalBookingId, attendance.getMember() != null ? attendance.getMember().getId() : null,
                        "예", productDeducted.get("productName"), beforeCount, afterCount);
                } catch (Exception e) {
                    logger.error("이용권 차감 정보 추가 실패: {}", e.getMessage(), e);
                }
            } else {
                // 차감이 실행되지 않은 이유 로깅
                if (attendance.getMember() != null) {
                    Boolean autoDeduct = checkinData.get("autoDeduct") != null ? 
                            Boolean.parseBoolean(checkinData.get("autoDeduct").toString()) : true;
                    boolean isRental = booking != null && booking.getPurpose() != null && 
                                      booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL;
                    
                    logger.info("체크인 완료 (차감 없음): Attendance ID={}, Booking ID={}, Member ID={}, autoDeduct={}, isNewAttendance={}, isRental={}", 
                        saved.getId(), finalBookingId, attendance.getMember() != null ? attendance.getMember().getId() : null,
                        autoDeduct, isNewAttendance, isRental);
                } else {
                    logger.info("체크인 완료 (비회원): Attendance ID={}, Booking ID={}", 
                        saved.getId(), finalBookingId);
                }
            }
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Long errorBookingId = checkinData.get("bookingId") != null ? 
                ((Number) checkinData.get("bookingId")).longValue() : null;
            logger.warn("체크인 처리 중 잘못된 인자: Booking ID={}, 오류: {}", errorBookingId, e.getMessage());
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", e.getMessage());
            error.put("bookingId", errorBookingId);
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Long errorBookingId = checkinData.get("bookingId") != null ? 
                ((Number) checkinData.get("bookingId")).longValue() : null;
            logger.error("체크인 처리 중 오류 발생: Booking ID={}, 오류 타입: {}, 메시지: {}", 
                errorBookingId, e.getClass().getName(), e.getMessage(), e);
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", "체크인 처리 중 오류가 발생했습니다: " + e.getMessage());
            error.put("errorType", e.getClass().getSimpleName());
            error.put("bookingId", errorBookingId);
            // 디버깅 정보 추가
            if (e.getCause() != null) {
                error.put("cause", e.getCause().getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 체크아웃 처리
    @PostMapping("/checkout")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> processCheckout(@RequestBody java.util.Map<String, Object> checkoutData) {
        try {
            // attendanceId 추출
            Long attendanceId = null;
            if (checkoutData.get("attendanceId") != null) {
                if (checkoutData.get("attendanceId") instanceof Number) {
                    attendanceId = ((Number) checkoutData.get("attendanceId")).longValue();
                } else {
                    attendanceId = Long.parseLong(checkoutData.get("attendanceId").toString());
                }
            }
            
            if (attendanceId == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "출석 기록 ID가 필요합니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 출석 기록 조회
            Attendance attendance = attendanceRepository.findById(attendanceId)
                    .orElseThrow(() -> new IllegalArgumentException("출석 기록을 찾을 수 없습니다."));
            
            // 이미 체크아웃된 경우
            if (attendance.getCheckOutTime() != null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "이미 체크아웃된 기록입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 체크인되지 않은 경우
            if (attendance.getCheckInTime() == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "체크인되지 않은 기록입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 체크아웃 시간 설정
            attendance.setCheckOutTime(java.time.LocalDateTime.now());
            
            // 상태는 그대로 유지 (PRESENT, ABSENT, LATE, NO_SHOW 중 하나)
            // 체크아웃 여부는 checkOutTime이 null인지로 판단
            
            Attendance saved = attendanceRepository.save(attendance);
            
            // 대관(RENTAL) 예약인 경우 체크아웃 시 예약 상태를 완료(COMPLETED)로 변경
            com.afbscenter.model.Booking booking = saved.getBooking();
            if (booking != null && booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL) {
                booking.setStatus(com.afbscenter.model.Booking.BookingStatus.COMPLETED);
                bookingRepository.save(booking);
                logger.info("대관 예약 완료 처리: Booking ID={}", booking.getId());
            }
            
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("checkInTime", saved.getCheckInTime());
            result.put("checkOutTime", saved.getCheckOutTime());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", "체크아웃이 완료되었습니다.");
            
            logger.info("체크아웃 완료: Attendance ID={}, Member ID={}", 
                    saved.getId(), attendance.getMember() != null ? attendance.getMember().getId() : null);
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("체크아웃 처리 중 잘못된 인자: {}", e.getMessage());
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            logger.error("체크아웃 처리 중 오류 발생", e);
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", "체크아웃 처리 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
