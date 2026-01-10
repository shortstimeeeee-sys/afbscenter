package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Facility;
import com.afbscenter.model.Member;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import com.afbscenter.util.LessonCategoryUtil;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "http://localhost:8080")
public class BookingController {

    private static final Logger logger = LoggerFactory.getLogger(BookingController.class);

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private CoachRepository coachRepository;
    
    @Autowired
    private com.afbscenter.repository.MemberProductRepository memberProductRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllBookings(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) String date) {
        try {
            List<Booking> bookings;
            if (date != null && !date.trim().isEmpty()) {
                // 단일 날짜로 조회 (해당 날짜의 예약만)
                LocalDate localDate = LocalDate.parse(date);
                LocalDateTime startOfDay = localDate.atStartOfDay();
                LocalDateTime endOfDay = localDate.atTime(23, 59, 59);
                bookings = bookingRepository.findByDateRange(startOfDay, endOfDay);
            } else if (start != null && end != null) {
                // ISO 8601 형식 (Z 포함)을 LocalDateTime으로 변환
                try {
                    LocalDateTime startDate = OffsetDateTime.parse(start)
                            .atZoneSameInstant(ZoneId.systemDefault())
                            .toLocalDateTime();
                    LocalDateTime endDate = OffsetDateTime.parse(end)
                            .atZoneSameInstant(ZoneId.systemDefault())
                            .toLocalDateTime();
                    
                    bookings = bookingRepository.findByDateRange(startDate, endDate);
                } catch (Exception e) {
                    logger.error("날짜 파싱 실패: start={}, end={}", start, end, e);
                    bookings = new java.util.ArrayList<>();
                }
            } else {
                // 전체 예약 조회 시에도 안전한 쿼리 사용
                bookings = bookingRepository.findAllWithFacilityAndMember();
            }
            
            // Booking을 Map으로 변환하여 JSON 직렬화 문제 방지
            List<Map<String, Object>> bookingMaps = new java.util.ArrayList<>();
            for (Booking booking : bookings) {
                try {
                    Map<String, Object> bookingMap = new HashMap<>();
                    bookingMap.put("id", booking.getId());
                    bookingMap.put("startTime", booking.getStartTime());
                    bookingMap.put("endTime", booking.getEndTime());
                    bookingMap.put("participants", booking.getParticipants());
                    bookingMap.put("purpose", booking.getPurpose());
                    bookingMap.put("lessonCategory", booking.getLessonCategory());
                    bookingMap.put("status", booking.getStatus());
                    bookingMap.put("paymentMethod", booking.getPaymentMethod());
                    bookingMap.put("memo", booking.getMemo());
                    bookingMap.put("nonMemberName", booking.getNonMemberName());
                    bookingMap.put("nonMemberPhone", booking.getNonMemberPhone());
                    
                    // Facility 정보
                    if (booking.getFacility() != null) {
                        Map<String, Object> facilityMap = new HashMap<>();
                        facilityMap.put("id", booking.getFacility().getId());
                        facilityMap.put("name", booking.getFacility().getName());
                        bookingMap.put("facility", facilityMap);
                    }
                    
                    // Coach 정보
                    if (booking.getCoach() != null) {
                        Map<String, Object> coachMap = new HashMap<>();
                        coachMap.put("id", booking.getCoach().getId());
                        coachMap.put("name", booking.getCoach().getName());
                        bookingMap.put("coach", coachMap);
                    }
                    
                    // Member 정보
                    if (booking.getMember() != null) {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", booking.getMember().getId());
                        memberMap.put("memberNumber", booking.getMember().getMemberNumber());
                        memberMap.put("name", booking.getMember().getName());
                        memberMap.put("phoneNumber", booking.getMember().getPhoneNumber());
                        memberMap.put("grade", booking.getMember().getGrade());
                        memberMap.put("school", booking.getMember().getSchool());
                        
                        // Member의 Coach 정보
                        if (booking.getMember().getCoach() != null) {
                            Map<String, Object> memberCoachMap = new HashMap<>();
                            memberCoachMap.put("id", booking.getMember().getCoach().getId());
                            memberCoachMap.put("name", booking.getMember().getCoach().getName());
                            memberMap.put("coach", memberCoachMap);
                        }
                        
                        bookingMap.put("member", memberMap);
                    }
                    
                    bookingMaps.add(bookingMap);
                } catch (Exception e) {
                    // 개별 예약 변환 오류는 무시하고 계속 진행
                    logger.warn("예약 변환 오류 (ID: {}): {}", booking.getId(), e.getMessage(), e);
                }
            }
            
            return ResponseEntity.ok(bookingMaps);
        } catch (Exception e) {
            logger.error("예약 조회 실패", e);
            // 오류 발생 시 빈 리스트 반환
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getBookingById(@PathVariable Long id) {
        try {
            // JOIN FETCH를 사용하여 관련 엔티티를 함께 로드
            Booking booking = bookingRepository.findByIdWithFacilityAndMember(id);
            
            if (booking == null) {
                return ResponseEntity.notFound().build();
            }
            
            // Booking을 Map으로 변환하여 JSON 직렬화 문제 방지
            Map<String, Object> bookingMap = new HashMap<>();
            bookingMap.put("id", booking.getId());
            bookingMap.put("startTime", booking.getStartTime());
            bookingMap.put("endTime", booking.getEndTime());
            bookingMap.put("participants", booking.getParticipants());
            bookingMap.put("purpose", booking.getPurpose());
            bookingMap.put("lessonCategory", booking.getLessonCategory());
            bookingMap.put("status", booking.getStatus());
            bookingMap.put("paymentMethod", booking.getPaymentMethod());
            bookingMap.put("memo", booking.getMemo());
            bookingMap.put("nonMemberName", booking.getNonMemberName());
            bookingMap.put("nonMemberPhone", booking.getNonMemberPhone());
            
            // Facility 정보
            if (booking.getFacility() != null) {
                Map<String, Object> facilityMap = new HashMap<>();
                facilityMap.put("id", booking.getFacility().getId());
                facilityMap.put("name", booking.getFacility().getName());
                bookingMap.put("facility", facilityMap);
            }
            
            // Coach 정보
            if (booking.getCoach() != null) {
                Map<String, Object> coachMap = new HashMap<>();
                coachMap.put("id", booking.getCoach().getId());
                coachMap.put("name", booking.getCoach().getName());
                bookingMap.put("coach", coachMap);
            }
            
            // Member 정보
            if (booking.getMember() != null) {
                Map<String, Object> memberMap = new HashMap<>();
                memberMap.put("id", booking.getMember().getId());
                memberMap.put("memberNumber", booking.getMember().getMemberNumber());
                memberMap.put("name", booking.getMember().getName());
                memberMap.put("phoneNumber", booking.getMember().getPhoneNumber());
                memberMap.put("grade", booking.getMember().getGrade());
                memberMap.put("school", booking.getMember().getSchool());
                
                // Member의 Coach 정보
                if (booking.getMember().getCoach() != null) {
                    Map<String, Object> memberCoachMap = new HashMap<>();
                    memberCoachMap.put("id", booking.getMember().getCoach().getId());
                    memberCoachMap.put("name", booking.getMember().getCoach().getName());
                    memberMap.put("coach", memberCoachMap);
                }
                
                bookingMap.put("member", memberMap);
            }
            
            // MemberProduct 정보 (ID만 포함)
            if (booking.getMemberProduct() != null) {
                Map<String, Object> memberProductMap = new HashMap<>();
                memberProductMap.put("id", booking.getMemberProduct().getId());
                bookingMap.put("memberProduct", memberProductMap);
            }
            
            return ResponseEntity.ok(bookingMap);
        } catch (Exception e) {
            logger.error("예약 조회 실패 (ID: {})", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Booking> createBooking(@RequestBody Map<String, Object> requestData) {
        try {
            // Booking 객체로 변환
            Booking booking = new Booking();
            
            // Facility 설정
            if (requestData.get("facility") != null) {
                Map<String, Object> facilityMap = (Map<String, Object>) requestData.get("facility");
                Object facilityIdObj = facilityMap.get("id");
                if (facilityIdObj == null) {
                    logger.warn("시설 ID가 없습니다.");
                    return ResponseEntity.badRequest().build();
                }
                Long facilityId;
                try {
                    if (facilityIdObj instanceof Number) {
                        facilityId = ((Number) facilityIdObj).longValue();
                    } else {
                        facilityId = Long.parseLong(facilityIdObj.toString());
                    }
                } catch (NumberFormatException e) {
                    logger.warn("시설 ID 형식이 올바르지 않습니다: {}", facilityIdObj);
                    return ResponseEntity.badRequest().build();
                }
                Facility facility = facilityRepository.findById(facilityId)
                        .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다."));
                booking.setFacility(facility);
            } else {
                return ResponseEntity.badRequest().build();
            }
            
            // Member 설정 - MEMBER_NUMBER 우선 사용
            Member member = null;
            String memberNumber = (String) requestData.get("memberNumber");
            if (memberNumber != null && !memberNumber.trim().isEmpty()) {
                // MEMBER_NUMBER로 회원 찾기
                member = memberRepository.findByMemberNumber(memberNumber)
                        .orElse(null);
                if (member == null) {
                    logger.warn("회원번호로 회원을 찾을 수 없습니다: {}", memberNumber);
                }
            } else if (requestData.get("member") != null) {
                // 하위 호환성: ID로도 찾기 시도
                Map<String, Object> memberMap = (Map<String, Object>) requestData.get("member");
                Object memberIdObj = memberMap.get("id");
                if (memberIdObj != null) {
                    try {
                        Long memberId;
                        if (memberIdObj instanceof Number) {
                            memberId = ((Number) memberIdObj).longValue();
                        } else {
                            memberId = Long.parseLong(memberIdObj.toString());
                        }
                        member = memberRepository.findById(memberId).orElse(null);
                    } catch (NumberFormatException e) {
                        logger.warn("회원 ID 형식이 올바르지 않습니다: {}", memberIdObj);
                    }
                }
            }
            
            booking.setMember(member);
            
            // 비회원 정보 설정
            if (member == null) {
                booking.setNonMemberName((String) requestData.get("nonMemberName"));
                booking.setNonMemberPhone((String) requestData.get("nonMemberPhone"));
            } else {
                booking.setNonMemberName(null);
                booking.setNonMemberPhone(null);
            }
            
            // 시간 설정
            if (requestData.get("startTime") != null) {
                try {
                    String startTimeStr = (String) requestData.get("startTime");
                    booking.setStartTime(java.time.LocalDateTime.parse(startTimeStr));
                } catch (Exception e) {
                    logger.error("시작 시간 파싱 실패: {}", requestData.get("startTime"), e);
                    return ResponseEntity.badRequest().build();
                }
            } else {
                return ResponseEntity.badRequest().build();
            }
            
            if (requestData.get("endTime") != null) {
                try {
                    String endTimeStr = (String) requestData.get("endTime");
                    java.time.LocalDateTime endTime = java.time.LocalDateTime.parse(endTimeStr);
                    
                    // 종료 시간이 시작 시간보다 이전인지 확인
                    if (booking.getStartTime() != null && endTime.isBefore(booking.getStartTime())) {
                        logger.warn("종료 시간이 시작 시간보다 이전입니다. 시작: {}, 종료: {}", booking.getStartTime(), endTime);
                        return ResponseEntity.badRequest().build();
                    }
                    
                    booking.setEndTime(endTime);
                } catch (Exception e) {
                    logger.error("종료 시간 파싱 실패: {}", requestData.get("endTime"), e);
                    return ResponseEntity.badRequest().build();
                }
            } else {
                logger.warn("종료 시간이 없습니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // 기타 필드 설정
            if (requestData.get("participants") != null) {
                booking.setParticipants(((Number) requestData.get("participants")).intValue());
            }
            
            if (requestData.get("purpose") != null) {
                booking.setPurpose(Booking.BookingPurpose.valueOf((String) requestData.get("purpose")));
            } else {
                return ResponseEntity.badRequest().build();
            }
            
            if (requestData.get("lessonCategory") != null && !((String) requestData.get("lessonCategory")).trim().isEmpty()) {
                try {
                    booking.setLessonCategory(com.afbscenter.model.Lesson.LessonCategory.valueOf((String) requestData.get("lessonCategory")));
                } catch (IllegalArgumentException e) {
                    logger.warn("레슨 카테고리 파싱 실패: {}", requestData.get("lessonCategory"));
                }
            }
            
            if (requestData.get("status") != null && !((String) requestData.get("status")).trim().isEmpty()) {
                try {
                    booking.setStatus(Booking.BookingStatus.valueOf((String) requestData.get("status")));
                } catch (IllegalArgumentException e) {
                    logger.warn("상태 파싱 실패: {}", requestData.get("status"));
                    booking.setStatus(Booking.BookingStatus.PENDING);
                }
            }
            
            if (requestData.get("paymentMethod") != null && !((String) requestData.get("paymentMethod")).trim().isEmpty()) {
                try {
                    booking.setPaymentMethod(Booking.PaymentMethod.valueOf((String) requestData.get("paymentMethod")));
                } catch (IllegalArgumentException e) {
                    logger.warn("결제 방법 파싱 실패: {}", requestData.get("paymentMethod"));
                }
            }
            
            if (requestData.get("memo") != null) {
                booking.setMemo((String) requestData.get("memo"));
            }
            
            // Coach 설정 (회원/비회원 모두 가능)
            Coach assignedCoach = null;
            if (requestData.get("coach") != null) {
                Map<String, Object> coachMap = (Map<String, Object>) requestData.get("coach");
                Object coachIdObj = coachMap.get("id");
                if (coachIdObj != null) {
                    try {
                        Long coachId;
                        if (coachIdObj instanceof Number) {
                            coachId = ((Number) coachIdObj).longValue();
                        } else {
                            coachId = Long.parseLong(coachIdObj.toString());
                        }
                        assignedCoach = coachRepository.findById(coachId)
                                .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
                        booking.setCoach(assignedCoach);
                    } catch (NumberFormatException e) {
                        logger.warn("코치 ID 형식이 올바르지 않습니다: {}", coachIdObj);
                    }
                }
            } else if (member != null) {
                // 예약에 코치가 없으면 회원의 코치 확인
                if (member.getCoach() != null) {
                    assignedCoach = member.getCoach();
                    booking.setCoach(assignedCoach);
                } else {
                    booking.setCoach(null);
                }
            } else {
                booking.setCoach(null);
            }
            
            // MemberProduct 설정 (상품/이용권 사용)
            if (requestData.get("memberProductId") != null && member != null) {
                try {
                    Object memberProductIdObj = requestData.get("memberProductId");
                    Long memberProductId;
                    if (memberProductIdObj instanceof Number) {
                        memberProductId = ((Number) memberProductIdObj).longValue();
                    } else {
                        memberProductId = Long.parseLong(memberProductIdObj.toString());
                    }
                    // JOIN FETCH를 사용하여 member와 product를 함께 로드 (lazy loading 방지)
                    java.util.Optional<com.afbscenter.model.MemberProduct> memberProductOpt = 
                        memberProductRepository.findByIdWithMember(memberProductId);
                    
                    if (memberProductOpt.isPresent()) {
                        com.afbscenter.model.MemberProduct memberProduct = memberProductOpt.get();
                        
                        // 회원의 상품인지 확인 (member는 이미 JOIN FETCH로 로드됨)
                        Long memberProductMemberId = memberProduct.getMember().getId();
                        if (memberProductMemberId != null && memberProductMemberId.equals(member.getId())) {
                            booking.setMemberProduct(memberProduct);
                            logger.debug("상품 설정 완료: MemberProduct ID={}", memberProductId);
                        } else {
                            logger.warn("상품이 해당 회원의 것이 아닙니다. MemberProduct Member ID: {}, 요청 회원 ID: {}", memberProductMemberId, member.getId());
                        }
                    } else {
                        logger.warn("상품을 찾을 수 없습니다: MemberProduct ID={}", memberProductId);
                    }
                } catch (NumberFormatException e) {
                    logger.warn("MemberProduct ID 형식이 올바르지 않습니다: {}", requestData.get("memberProductId"));
                    // 상품 설정 실패해도 예약은 저장됨
                } catch (Exception e) {
                    logger.error("상품 설정 실패", e);
                    // 상품 설정 실패해도 예약은 저장됨
                }
            }

            // 상태 기본값 설정
            if (booking.getStatus() == null) {
                booking.setStatus(Booking.BookingStatus.PENDING);
            }
            
            // 레슨 카테고리 설정 (레슨인 경우만)
            if (booking.getPurpose() == Booking.BookingPurpose.LESSON) {
                // lessonCategory가 이미 설정되어 있으면 그대로 사용
                if (booking.getLessonCategory() == null && assignedCoach != null) {
                    // 코치의 담당 종목을 기반으로 레슨 카테고리 자동 설정
                    com.afbscenter.model.Lesson.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(assignedCoach);
                    if (category != null) {
                        booking.setLessonCategory(category);
                    }
                }
            } else {
                // 레슨이 아니면 레슨 카테고리를 null로 설정
                booking.setLessonCategory(null);
            }

            Booking saved = bookingRepository.save(booking);
            logger.debug("예약 저장 성공: ID={}", saved.getId());
            
            // 상품/이용권 사용 처리 (이제 memberProduct 필드에 저장되므로 실제 예약 데이터로 계산)
            // remainingCount는 더 이상 직접 수정하지 않고, 실제 예약 데이터를 기반으로 계산
            // 확정된 예약인 경우 상품 상태 업데이트만 수행
            if (saved.getMemberProduct() != null && saved.getStatus() == Booking.BookingStatus.CONFIRMED) {
                try {
                    com.afbscenter.model.MemberProduct memberProduct = saved.getMemberProduct();
                    
                    // 상품이 횟수권인 경우
                    if (memberProduct.getProduct().getType() == com.afbscenter.model.Product.ProductType.COUNT_PASS) {
                        // 실제 예약 데이터 기반으로 사용 횟수 계산
                        Long usedCount = bookingRepository.countConfirmedBookingsByMemberProductId(memberProduct.getId());
                        
                        // 총 횟수
                        Integer totalCount = memberProduct.getTotalCount();
                        if (totalCount == null || totalCount <= 0) {
                            totalCount = memberProduct.getProduct().getUsageCount();
                            if (totalCount == null || totalCount <= 0) {
                                totalCount = 10; // 기본값
                            }
                        }
                        
                        // 잔여 횟수 계산
                        Integer remainingCount = totalCount - usedCount.intValue();
                        if (remainingCount < 0) {
                            remainingCount = 0;
                        }
                        
                        // remainingCount 필드 업데이트 (참고용, 실제 계산은 예약 데이터 기반)
                        memberProduct.setRemainingCount(remainingCount);
                        
                        // 횟수가 0이 되면 상태 변경
                        if (remainingCount == 0) {
                            memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.USED_UP);
                        }
                        
                        memberProductRepository.save(memberProduct);
                        logger.debug("횟수권 상태 업데이트: MemberProduct ID={}, 사용={}회, 잔여={}회", memberProduct.getId(), usedCount, remainingCount);
                    }
                } catch (Exception e) {
                    logger.error("상품 사용 처리 실패", e);
                    // 상품 처리 실패해도 예약은 저장됨
                }
            } else if (saved.getMember() != null && saved.getStatus() == Booking.BookingStatus.CONFIRMED) {
                // 상품이 선택되지 않았지만 회원이고 확정된 예약인 경우 기존 로직 사용
                try {
                    decreaseCountPassUsage(saved.getMember().getId());
                } catch (Exception e) {
                    logger.error("횟수권 차감 실패", e);
                    // 횟수권 차감 실패해도 예약은 저장됨
                }
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("예약 저장 실패 (IllegalArgumentException): {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("예약 저장 실패", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Booking> updateBooking(@PathVariable Long id, @RequestBody Booking updatedBooking) {
        try {
            // JOIN FETCH를 사용하여 관련 엔티티를 함께 로드
            Booking booking = bookingRepository.findByIdWithFacilityAndMember(id);
            if (booking == null) {
                return ResponseEntity.notFound().build();
            }

            // 부분 업데이트 지원: null이 아닌 필드만 업데이트
            if (updatedBooking.getFacility() != null && updatedBooking.getFacility().getId() != null) {
                Facility facility = facilityRepository.findById(updatedBooking.getFacility().getId())
                        .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다."));
                booking.setFacility(facility);
            }

            if (updatedBooking.getStartTime() != null) {
                booking.setStartTime(updatedBooking.getStartTime());
            }
            if (updatedBooking.getEndTime() != null) {
                booking.setEndTime(updatedBooking.getEndTime());
            }
            if (updatedBooking.getParticipants() != null) {
                booking.setParticipants(updatedBooking.getParticipants());
            }
            if (updatedBooking.getPurpose() != null) {
                booking.setPurpose(updatedBooking.getPurpose());
            }
            // 레슨 카테고리 업데이트 (레슨인 경우만)
            if (updatedBooking.getPurpose() != null) {
                if (updatedBooking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.LESSON) {
                    // 레슨인 경우
                    if (updatedBooking.getLessonCategory() != null) {
                        booking.setLessonCategory(updatedBooking.getLessonCategory());
                    } else if (booking.getLessonCategory() == null) {
                        // 레슨 카테고리가 없으면 코치의 담당 종목으로 자동 설정
                        Coach coach = booking.getCoach();
                        if (coach == null && booking.getMember() != null && booking.getMember().getCoach() != null) {
                            coach = booking.getMember().getCoach();
                        }
                        if (coach != null) {
                            com.afbscenter.model.Lesson.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                            if (category != null) {
                                booking.setLessonCategory(category);
                            }
                        }
                    }
                } else {
                    // 레슨이 아니면 레슨 카테고리를 null로 설정
                    booking.setLessonCategory(null);
                }
            }
            if (updatedBooking.getStatus() != null) {
                Booking.BookingStatus oldStatus = booking.getStatus();
                booking.setStatus(updatedBooking.getStatus());
                
                // 상태가 PENDING에서 CONFIRMED로 변경되면 횟수권 차감 (소급 예약 포함)
                if (oldStatus == Booking.BookingStatus.PENDING && 
                    updatedBooking.getStatus() == Booking.BookingStatus.CONFIRMED &&
                    booking.getMember() != null) {
                    try {
                        decreaseCountPassUsage(booking.getMember().getId());
                    } catch (Exception e) {
                        logger.error("횟수권 차감 실패", e);
                    }
                }
            }
            if (updatedBooking.getPaymentMethod() != null) {
                booking.setPaymentMethod(updatedBooking.getPaymentMethod());
            }
            // Coach 업데이트 처리
            // 프론트엔드에서 coach 필드가 전달된 경우 처리
            if (updatedBooking.getCoach() != null) {
                if (updatedBooking.getCoach().getId() != null) {
                    Coach coach = coachRepository.findById(updatedBooking.getCoach().getId())
                            .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
                    booking.setCoach(coach);
                } else {
                    // ID가 null이면 코치 제거
                    booking.setCoach(null);
                }
            } else {
                // coach 필드가 null로 전달된 경우 코치 제거
                // 프론트엔드에서 coach: null로 보낸 경우
                booking.setCoach(null);
            }
            if (updatedBooking.getMemo() != null) {
                booking.setMemo(updatedBooking.getMemo());
            }

            Booking saved = bookingRepository.save(booking);
            
            // 저장 후 다시 조회하여 관련 엔티티를 안전하게 로드
            Booking result = bookingRepository.findByIdWithFacilityAndMember(saved.getId());
            if (result == null) {
                result = saved;
            }
            
            // 응답 전에 Coach와 Member의 coach를 안전하게 로드
            try {
                // Facility 로드 확인
                if (result.getFacility() != null) {
                    result.getFacility().getName(); // Facility 로드
                }
                // 예약에 직접 할당된 코치 로드
                if (result.getCoach() != null) {
                    result.getCoach().getName(); // Coach 로드
                }
                // 회원의 코치 로드
                if (result.getMember() != null) {
                    result.getMember().getName(); // Member 로드 확인
                    if (result.getMember().getCoach() != null) {
                        result.getMember().getCoach().getName(); // Coach 로드
                    }
                }
            } catch (Exception e) {
                logger.warn("예약 응답 로드 오류 (ID: {}): {}", result.getId(), e.getMessage(), e);
            }
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("예약을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("예약 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteBooking(@PathVariable Long id) {
        try {
            if (!bookingRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            bookingRepository.deleteById(id);
            // 삭제 후 ID 재정렬
            reorderBookingIds();
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("예약 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.badRequest().build();
        }
    }

    // 레슨 카테고리가 없는 예약들을 자동으로 업데이트 (내부 메서드)
    @Transactional
    private void updateMissingLessonCategories() {
        try {
            List<Booking> bookings = bookingRepository.findAllWithFacilityAndMember();
            for (Booking booking : bookings) {
                if (booking.getPurpose() == Booking.BookingPurpose.LESSON && booking.getLessonCategory() == null) {
                    Coach coach = booking.getCoach();
                    if (coach == null && booking.getMember() != null && booking.getMember().getCoach() != null) {
                        coach = booking.getMember().getCoach();
                    }
                    
                    if (coach != null) {
                        com.afbscenter.model.Lesson.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                        if (category != null) {
                            booking.setLessonCategory(category);
                            bookingRepository.save(booking);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // 조용히 실패 (로그만 출력)
            logger.warn("레슨 카테고리 자동 업데이트 실패: {}", e.getMessage(), e);
        }
    }

    // 기존 예약들의 레슨 카테고리 일괄 업데이트 (수동 실행용)
    @PostMapping("/update-lesson-categories")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateLessonCategories() {
        try {
            List<Booking> bookings = bookingRepository.findAllWithFacilityAndMember();
            int updatedCount = 0;
            
            for (Booking booking : bookings) {
                if (booking.getPurpose() == Booking.BookingPurpose.LESSON && booking.getLessonCategory() == null) {
                    Coach coach = booking.getCoach();
                    if (coach == null && booking.getMember() != null && booking.getMember().getCoach() != null) {
                        coach = booking.getMember().getCoach();
                    }
                    
                    if (coach != null) {
                        com.afbscenter.model.Lesson.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                        if (category != null) {
                            booking.setLessonCategory(category);
                            bookingRepository.save(booking);
                            updatedCount++;
                        }
                    }
                }
            }
            
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("updatedCount", updatedCount);
            result.put("message", updatedCount + "개의 예약이 업데이트되었습니다.");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("예약 상태 변경 중 오류 발생", e);
            Map<String, Object> result = new HashMap<>();
            result.put("status", "error");
            result.put("message", "업데이트 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }

    // ID 재정렬 (삭제 후 순번을 연속적으로 유지)
    @Transactional
    private void reorderBookingIds() {
        reorderBookingIdsByDate();
    }
    
    // ID 재정렬 (날짜/시간 기준으로 정렬하여 재할당)
    @Transactional
    public void reorderBookingIdsByDate() {
        try {
            // 모든 예약을 날짜/시간 순으로 가져오기
            List<Booking> bookings = bookingRepository.findAll();
            if (bookings.isEmpty()) {
                // 예약이 없으면 시퀀스를 1로 리셋
                resetBookingSequence(1);
                return;
            }
            
            // 날짜/시간 기준으로 정렬 (startTime 오름차순)
            bookings.sort((b1, b2) -> {
                if (b1.getStartTime() == null && b2.getStartTime() == null) return 0;
                if (b1.getStartTime() == null) return 1;
                if (b2.getStartTime() == null) return -1;
                return b1.getStartTime().compareTo(b2.getStartTime());
            });
            
            // ID를 1부터 순차적으로 재할당
            // 먼저 모든 ID를 임시 값으로 변경 (충돌 방지)
            for (int i = 0; i < bookings.size(); i++) {
                Booking booking = bookings.get(i);
                Long tempId = 999999L - i;
                
                if (!booking.getId().equals(tempId)) {
                    // 관련 테이블의 외래키도 임시로 업데이트
                    updateBookingForeignKeys(booking.getId(), tempId);
                    // ID를 임시 값으로 변경
                    jdbcTemplate.update("UPDATE bookings SET id = ? WHERE id = ?", tempId, booking.getId());
                }
            }
            
            // 다시 올바른 ID로 변경 (날짜/시간 순서대로)
            for (int i = 0; i < bookings.size(); i++) {
                Long tempId = 999999L - i;
                Long newId = (long) (i + 1);
                
                // 관련 테이블의 외래키도 업데이트
                updateBookingForeignKeys(tempId, newId);
                // ID를 올바른 값으로 변경
                jdbcTemplate.update("UPDATE bookings SET id = ? WHERE id = ?", newId, tempId);
            }
            
            // 시퀀스를 다음 ID로 설정
            long nextId = bookings.size() + 1;
            resetBookingSequence(nextId);
            
        } catch (Exception e) {
            // 재정렬 실패 시 롤백 (트랜잭션)
            throw new RuntimeException("예약 ID 재정렬 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
    
    // 날짜/시간 기준으로 예약 번호 재할당 API
    @PostMapping("/reorder")
    @Transactional
    public ResponseEntity<Map<String, String>> reorderBookingIdsByDateEndpoint() {
        try {
            reorderBookingIdsByDate();
            Map<String, String> response = new HashMap<>();
            response.put("message", "예약 번호가 날짜/시간 순서대로 재할당되었습니다.");
            response.put("status", "success");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("예약 번호 재할당 중 오류 발생", e);
            Map<String, String> response = new HashMap<>();
            response.put("message", "예약 번호 재할당 중 오류가 발생했습니다: " + e.getMessage());
            response.put("status", "error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    // 관련 테이블의 외래키 업데이트
    private void updateBookingForeignKeys(Long oldId, Long newId) {
        try {
            // Payment 테이블
            jdbcTemplate.update("UPDATE payments SET booking_id = ? WHERE booking_id = ?", newId, oldId);
            // Attendance 테이블
            jdbcTemplate.update("UPDATE attendances SET booking_id = ? WHERE booking_id = ?", newId, oldId);
        } catch (Exception e) {
            // 외래키 업데이트 실패는 무시 (일부 테이블이 없을 수 있음)
        }
    }
    
    // 횟수권 사용 차감 (소급 예약 포함)
    private void decreaseCountPassUsage(Long memberId) {
        // 회원의 활성 횟수권 조회
        List<com.afbscenter.model.MemberProduct> countPassProducts = 
            memberProductRepository.findActiveCountPassByMemberId(memberId);
        
        if (countPassProducts.isEmpty()) {
            return; // 횟수권이 없으면 차감하지 않음
        }
        
        // 가장 오래된 횟수권부터 사용 (구매일 기준)
        countPassProducts.sort((a, b) -> a.getPurchaseDate().compareTo(b.getPurchaseDate()));
        
        // 첫 번째 횟수권 차감
        com.afbscenter.model.MemberProduct memberProduct = countPassProducts.get(0);
        if (memberProduct.getRemainingCount() != null && memberProduct.getRemainingCount() > 0) {
            memberProduct.setRemainingCount(memberProduct.getRemainingCount() - 1);
            
            // 횟수가 0이 되면 상태 변경
            if (memberProduct.getRemainingCount() == 0) {
                memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.USED_UP);
            }
            
            memberProductRepository.save(memberProduct);
        }
    }
    
    // H2 시퀀스 리셋
    private void resetBookingSequence(long nextValue) {
        try {
            // SQL 인젝션 방지: nextValue가 유효한 long 값인지 확인
            if (nextValue < 1) {
                logger.warn("잘못된 시퀀스 값: {}", nextValue);
                return;
            }
            // H2에서 IDENTITY 컬럼의 시퀀스 리셋
            // H2의 ALTER TABLE은 파라미터화를 지원하지 않으므로, 값 검증 후 사용
            String sql = "ALTER TABLE bookings ALTER COLUMN id RESTART WITH " + nextValue;
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            // 시퀀스 리셋 실패는 무시 (다음 삽입 시 자동으로 조정됨)
            logger.warn("예약 시퀀스 리셋 실패: {}", e.getMessage());
        }
    }
}
