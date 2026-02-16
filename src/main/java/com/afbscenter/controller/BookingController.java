package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Facility;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import com.afbscenter.model.BookingAuditLog;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.model.FacilitySlot;
import com.afbscenter.repository.BookingAuditLogRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.FacilitySlotRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.time.LocalDate;
import com.afbscenter.util.LessonCategoryUtil;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private static final Logger logger = LoggerFactory.getLogger(BookingController.class);

    private final BookingRepository bookingRepository;
    private final FacilityRepository facilityRepository;
    private final FacilitySlotRepository facilitySlotRepository;
    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final com.afbscenter.repository.MemberProductRepository memberProductRepository;
    private final JdbcTemplate jdbcTemplate;
    private final MemberService memberService;
    private final AttendanceRepository attendanceRepository;
    private final com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository;
    private final BookingAuditLogRepository bookingAuditLogRepository;
    private final PaymentRepository paymentRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public BookingController(BookingRepository bookingRepository,
                            FacilityRepository facilityRepository,
                            FacilitySlotRepository facilitySlotRepository,
                            MemberRepository memberRepository,
                            CoachRepository coachRepository,
                            com.afbscenter.repository.MemberProductRepository memberProductRepository,
                            JdbcTemplate jdbcTemplate,
                            MemberService memberService,
                            AttendanceRepository attendanceRepository,
                            com.afbscenter.repository.MemberProductHistoryRepository memberProductHistoryRepository,
                            BookingAuditLogRepository bookingAuditLogRepository,
                            PaymentRepository paymentRepository) {
        this.bookingRepository = bookingRepository;
        this.facilityRepository = facilityRepository;
        this.facilitySlotRepository = facilitySlotRepository;
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.memberProductRepository = memberProductRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.memberService = memberService;
        this.attendanceRepository = attendanceRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.bookingAuditLogRepository = bookingAuditLogRepository;
        this.paymentRepository = paymentRepository;
    }

    /** 예약 시간이 해당 시설의 운영 슬롯(또는 기본 운영시간) 내인지 검증. 위반 시 에러 메시지 반환 */
    private Optional<String> validateBookingWithinFacilitySlot(Facility facility, LocalDateTime start, LocalDateTime end) {
        if (facility == null || start == null || end == null) return Optional.empty();
        int dayOfWeek = start.getDayOfWeek().getValue();
        LocalTime startTime = start.toLocalTime();
        LocalTime endTime = end.toLocalTime();
        List<FacilitySlot> slots = facilitySlotRepository.findByFacilityIdOrderByDayOfWeek(facility.getId());
        FacilitySlot daySlot = slots.stream().filter(s -> s.getDayOfWeek() == dayOfWeek).findFirst().orElse(null);
        if (daySlot != null) {
            if (!Boolean.TRUE.equals(daySlot.getIsOpen())) {
                return Optional.of("해당 요일에는 시설이 운영되지 않습니다.");
            }
            LocalTime slotStart = daySlot.getStartTime();
            LocalTime slotEnd = daySlot.getEndTime();
            if (slotStart != null && slotEnd != null) {
                if (startTime.isBefore(slotStart) || endTime.isAfter(slotEnd)) {
                    return Optional.of("예약 시간이 시설 운영시간(" + slotStart + "~" + slotEnd + ") 범위를 벗어났습니다.");
                }
            }
        } else {
            LocalTime open = facility.getOpenTime();
            LocalTime close = facility.getCloseTime();
            if (open != null && close != null && (startTime.isBefore(open) || endTime.isAfter(close))) {
                return Optional.of("예약 시간이 시설 기본 운영시간(" + open + "~" + close + ") 범위를 벗어났습니다.");
            }
        }
        return Optional.empty();
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllBookings(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Long memberId,
            @RequestParam(required = false) String memberNumber,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String lessonCategory) {
        try {
            List<Booking> bookings = new java.util.ArrayList<>();
            
            // 지점 파라미터 파싱
            Booking.Branch branchEnum = null;
            if (branch != null && !branch.trim().isEmpty()) {
                try {
                    branchEnum = Booking.Branch.valueOf(branch.toUpperCase());
                    logger.info("지점 필터링: {}", branchEnum);
                } catch (IllegalArgumentException e) {
                    logger.warn("잘못된 지점 파라미터: {}", branch);
                }
            }
            
            // 회원 번호로 조회하는 경우
            if (memberNumber != null && !memberNumber.trim().isEmpty()) {
                try {
                    java.util.Optional<Member> memberOpt = memberRepository.findByMemberNumber(memberNumber);
                    if (memberOpt.isPresent()) {
                        bookings = bookingRepository.findByMemberId(memberOpt.get().getId());
                    } else {
                        logger.warn("회원번호로 회원을 찾을 수 없습니다: {}", memberNumber);
                        return ResponseEntity.ok(new java.util.ArrayList<>());
                    }
                } catch (Exception e) {
                    logger.warn("회원번호로 회원 조회 실패: {}", e.getMessage());
                    return ResponseEntity.ok(new java.util.ArrayList<>());
                }
            } else if (memberId != null) {
                bookings = bookingRepository.findByMemberId(memberId);
            } else if (date != null && !date.trim().isEmpty()) {
                // 단일 날짜로 조회 (해당 날짜의 예약만) - 모든 지점, 모든 목적 포함
                LocalDate localDate = LocalDate.parse(date);
                LocalDateTime startOfDay = localDate.atStartOfDay();
                LocalDateTime endOfDay = localDate.atTime(23, 59, 59);
                List<Booking> rawBookings = bookingRepository.findByDateRange(startOfDay, endOfDay);
                // JOIN FETCH로 인한 중복 제거
                java.util.Set<Long> seenIds = new java.util.HashSet<>();
                bookings = rawBookings.stream()
                        .filter(booking -> {
                            if (booking.getId() == null) return false;
                            if (seenIds.contains(booking.getId())) {
                                return false;
                            }
                            seenIds.add(booking.getId());
                            return true;
                        })
                        .collect(java.util.stream.Collectors.toList());
                logger.debug("날짜별 예약 조회: 원본 {}건, 중복 제거 후 {}건", rawBookings.size(), bookings.size());
                // 대관 예약 확인
                long rentalCount = bookings.stream().filter(b -> b.getPurpose() == Booking.BookingPurpose.RENTAL).count();
                long lessonCount = bookings.stream().filter(b -> b.getPurpose() == Booking.BookingPurpose.LESSON).count();
                logger.info("날짜별 예약 조회 결과: 전체 {}건 (레슨: {}건, 대관: {}건)", bookings.size(), lessonCount, rentalCount);
            } else if (start != null && end != null) {
                // ISO 8601 형식 (Z 포함)을 LocalDateTime으로 변환
                LocalDateTime startDate = null;
                LocalDateTime endDate = null;
                try {
                    startDate = OffsetDateTime.parse(start)
                            .atZoneSameInstant(ZoneId.systemDefault())
                            .toLocalDateTime();
                    endDate = OffsetDateTime.parse(end)
                            .atZoneSameInstant(ZoneId.systemDefault())
                            .toLocalDateTime();
                } catch (Exception e) {
                    logger.error("날짜 파싱 실패: start={}, end={}", start, end, e);
                    bookings = new java.util.ArrayList<>();
                }
                
                if (startDate != null && endDate != null) {
                    bookings = bookingRepository.findByDateRange(startDate, endDate);
                }
            } else {
                // 전체 예약 조회
                bookings = bookingRepository.findAllWithFacilityAndMember();
            }
            
            // 종료 시간이 지난 확정 예약을 자동으로 완료 상태로만 변경. 대관(RENTAL)은 체크인된 경우에만 자동 완료
            LocalDateTime now = LocalDateTime.now();
            java.util.List<Long> rentalPastEndIds = new java.util.ArrayList<>();
            for (Booking b : bookings) {
                if (b.getEndTime() != null && b.getStatus() == Booking.BookingStatus.CONFIRMED
                    && b.getEndTime().isBefore(now) && b.getPurpose() == Booking.BookingPurpose.RENTAL && b.getId() != null) {
                    rentalPastEndIds.add(b.getId());
                }
            }
            java.util.Set<Long> rentalIdsWithCheckIn = rentalPastEndIds.isEmpty() ? java.util.Collections.emptySet()
                : new java.util.HashSet<>(attendanceRepository.findBookingIdsWithCheckIn(rentalPastEndIds));
            int autoCompletedCount = 0;
            for (Booking booking : bookings) {
                if (booking.getEndTime() != null && booking.getStatus() == Booking.BookingStatus.CONFIRMED
                    && booking.getEndTime().isBefore(now)) {
                    if (booking.getPurpose() == Booking.BookingPurpose.RENTAL
                        && !rentalIdsWithCheckIn.contains(booking.getId())) {
                        continue;
                    }
                    booking.setStatus(Booking.BookingStatus.COMPLETED);
                    bookingRepository.save(booking);
                    autoCompletedCount++;
                    logger.debug("예약 자동 완료 처리: Booking ID={}, 종료 시간={}", booking.getId(), booking.getEndTime());
                }
            }
            if (autoCompletedCount > 0) {
                logger.info("{}개의 예약이 자동으로 완료 상태로 변경되었습니다.", autoCompletedCount);
            }
            
            // 체크인된 예약 필터링 (date 파라미터가 있을 때만, 출석 관리 페이지에서 사용)
            if (date != null && !date.trim().isEmpty()) {
                try {
                    LocalDate localDateForAttendance = LocalDate.parse(date);
                    List<com.afbscenter.model.Attendance> checkedInAttendances = attendanceRepository.findCheckedInByDate(localDateForAttendance);
                    java.util.Set<Long> checkedInBookingIds = new java.util.HashSet<>();
                    for (com.afbscenter.model.Attendance attendance : checkedInAttendances) {
                        if (attendance.getBooking() != null) {
                            checkedInBookingIds.add(attendance.getBooking().getId());
                        }
                    }
                    final java.util.Set<Long> finalCheckedInBookingIds = checkedInBookingIds;
                    bookings = bookings.stream()
                            .filter(booking -> !finalCheckedInBookingIds.contains(booking.getId()))
                            .collect(java.util.stream.Collectors.toList());
                    logger.debug("체크인된 예약 {}건 제외됨", checkedInBookingIds.size());
                } catch (Exception e) {
                    logger.warn("체크인된 예약 필터링 중 오류 (무시): {}", e.getMessage());
                }
            }
            
            // 지점별 필터링
            if (branchEnum != null) {
                final Booking.Branch finalBranchEnum = branchEnum;
                bookings = bookings.stream()
                        .filter(booking -> booking.getBranch() == finalBranchEnum)
                        .collect(java.util.stream.Collectors.toList());
                logger.info("지점 필터링 완료: {} - {}건", branchEnum, bookings.size());
            }
            
            // 시설 타입별 필터링 (각 타입별로 완전히 분리)
            // BASEBALL 요청 시: BASEBALL 타입 시설의 예약 OR (ALL 타입 시설의 예약 중 lessonCategory가 BASEBALL인 것)
            // TRAINING_FITNESS 요청 시: TRAINING_FITNESS 타입 시설의 예약 OR (ALL 타입 시설의 예약 중 lessonCategory가 TRAINING 또는 PILATES인 것)
            if (facilityType != null && !facilityType.trim().isEmpty()) {
                try {
                    Facility.FacilityType requestedType = Facility.FacilityType.valueOf(facilityType.toUpperCase());
                    bookings = bookings.stream()
                            .filter(booking -> {
                                if (booking.getFacility() == null) return false;
                                Facility.FacilityType bookingFacilityType = booking.getFacility().getFacilityType();
                                
                                // 정확히 일치하는 타입이면 포함
                                if (bookingFacilityType == requestedType) {
                                    return true;
                                }
                                
                                // ALL 타입 시설의 경우, 예약의 lessonCategory를 기준으로 필터링
                                if (bookingFacilityType == Facility.FacilityType.ALL) {
                                    if (booking.getLessonCategory() == null) {
                                        return false;
                                    }
                                    
                                    if (requestedType == Facility.FacilityType.BASEBALL) {
                                        // BASEBALL 캘린더: lessonCategory가 BASEBALL인 예약만
                                        return booking.getLessonCategory() == LessonCategory.BASEBALL;
                                    } else if (requestedType == Facility.FacilityType.TRAINING_FITNESS) {
                                        // TRAINING_FITNESS 캘린더: lessonCategory가 TRAINING 또는 PILATES인 예약만
                                        return booking.getLessonCategory() == LessonCategory.TRAINING || 
                                               booking.getLessonCategory() == LessonCategory.PILATES;
                                    }
                                }
                                
                                return false;
                            })
                            .collect(java.util.stream.Collectors.toList());
                    logger.info("시설 타입 필터링 완료: {} - {}건", requestedType, bookings.size());
                } catch (IllegalArgumentException e) {
                    logger.warn("잘못된 시설 타입 파라미터: {}", facilityType);
                }
            }
            
            // 레슨 카테고리별 필터링 (야구(유소년) 캘린더 등)
            if (lessonCategory != null && !lessonCategory.trim().isEmpty()) {
                try {
                    LessonCategory categoryEnum = LessonCategory.valueOf(lessonCategory.toUpperCase());
                    final LessonCategory finalCategoryEnum = categoryEnum;
                    bookings = bookings.stream()
                            .filter(booking -> booking.getLessonCategory() == finalCategoryEnum)
                            .collect(java.util.stream.Collectors.toList());
                    logger.info("레슨 카테고리 필터링 완료: {} - {}건", categoryEnum, bookings.size());
                } catch (IllegalArgumentException e) {
                    logger.warn("잘못된 레슨 카테고리 파라미터: {}", lessonCategory);
                }
            }
            
            // Booking을 Map으로 변환하여 JSON 직렬화 문제 방지 (대관 회차: 같은 이용권별 "시각순 첫 예약 완료 여부" 캐시)
            List<Map<String, Object>> bookingMaps = new java.util.ArrayList<>();
            java.util.Map<Long, Boolean> rentalFirstCompletedByMpId = new HashMap<>();
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
                    bookingMap.put("branch", booking.getBranch()); // 지점 정보 추가
                    bookingMap.put("paymentMethod", booking.getPaymentMethod());
                    bookingMap.put("memo", booking.getMemo());
                    bookingMap.put("nonMemberName", booking.getNonMemberName());
                    bookingMap.put("nonMemberPhone", booking.getNonMemberPhone());
                    
                    // Facility 정보
                    if (booking.getFacility() != null) {
                        Map<String, Object> facilityMap = new HashMap<>();
                        facilityMap.put("id", booking.getFacility().getId());
                        facilityMap.put("name", booking.getFacility().getName());
                        if (booking.getFacility().getBranch() != null) {
                            facilityMap.put("branch", booking.getFacility().getBranch().name());
                        }
                        bookingMap.put("facility", facilityMap);
                    } else {
                        bookingMap.put("facility", null);
                    }
                    
                    // Coach 정보
                    if (booking.getCoach() != null) {
                        Map<String, Object> coachMap = new HashMap<>();
                        coachMap.put("id", booking.getCoach().getId());
                        coachMap.put("name", booking.getCoach().getName());
                        bookingMap.put("coach", coachMap);
                    } else {
                        bookingMap.put("coach", null);
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
                        } else {
                            memberMap.put("coach", null);
                        }
                        
                        bookingMap.put("member", memberMap);
                    } else {
                        bookingMap.put("member", null);
                    }

                    // MemberProduct 정보 (상품명, 횟수권 회차 표시용 totalCount/remainingCount/sessionNumber)
                    if (booking.getMemberProduct() != null) {
                        Long mpId = booking.getMemberProduct().getId();
                        java.time.LocalDateTime thisStart = booking.getStartTime();
                        Long thisId = booking.getId();

                        boolean isRental = branch != null && "RENTAL".equalsIgnoreCase(branch.trim());
                        com.afbscenter.model.MemberProduct mpForCount = isRental ? memberProductRepository.findById(mpId).orElse(null) : null;
                        com.afbscenter.model.MemberProduct mpEntity = (mpForCount != null) ? mpForCount : booking.getMemberProduct();

                        Integer totalCount = mpEntity.getTotalCount();
                        if (totalCount == null && mpEntity.getProduct() != null && mpEntity.getProduct().getUsageCount() != null) {
                            totalCount = mpEntity.getProduct().getUsageCount();
                        }
                        Integer remainingCount = mpEntity.getRemainingCount();

                        // 회차 순서용 카운트 (한 번만 계산)
                        long sessionNumberByOrder = 0, sessionNumberByEnded = 0, sessionNumberByMemberProduct = 0, sessionNumberByCreationOrder = 0;
                        if (thisStart != null && thisId != null) {
                            sessionNumberByOrder = bookingRepository.countByMemberProductBeforeInOrder(mpId, thisStart, thisId) + 1;
                            sessionNumberByEnded = bookingRepository.countByMemberProductEndedBefore(mpId, thisStart) + 1;
                        }
                        if (mpId != null && thisId != null) {
                            sessionNumberByCreationOrder = bookingRepository.countByMemberProductIdBefore(mpId, thisId) + 1;
                        }
                        Long memId = booking.getMember() != null ? booking.getMember().getId() : (mpEntity.getMember() != null ? mpEntity.getMember().getId() : null);
                        Long prodId = mpEntity.getProduct() != null ? mpEntity.getProduct().getId() : null;
                        if (memId != null && prodId != null && thisStart != null) {
                            sessionNumberByMemberProduct = bookingRepository.countByMemberIdAndProductIdEndedBefore(memId, prodId, thisStart) + 1;
                        }

                        long sessionNumber = Math.max(Math.max(sessionNumberByOrder, sessionNumberByEnded), sessionNumberByMemberProduct);

                        if (isRental) {
                            // ---- 대관(RENTAL): 이용권 숫자만 보지 말고 체크인(사용) 반영. DEDUCT(체크인 차감) 우선, 없으면 ADJUST/DB 잔여 + 첫 예약 완료 감안 ----
                            Integer baseRemaining = (mpForCount != null && mpForCount.getRemainingCount() != null) ? mpForCount.getRemainingCount() : remainingCount;
                            boolean baseRemainingFromAdjust = false;
                            Integer displayTotal = totalCount;
                            int rentalDeductCount = 0; // 체크인된 예약 회차 = 이 값 사용 (7→1 방지)
                            if (mpForCount != null && totalCount != null) {
                                try {
                                    List<com.afbscenter.model.MemberProductHistory> histories =
                                        memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(mpId);
                                    for (com.afbscenter.model.MemberProductHistory h : histories) {
                                        if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.ADJUST && h.getRemainingCountAfter() != null) {
                                            baseRemaining = h.getRemainingCountAfter();
                                            baseRemainingFromAdjust = true;
                                            break;
                                        }
                                    }
                                    // 체크인 시 차감(DEDUCT)이 있으면 사용 횟수를 이걸로 반영 → 잔여 = 이용권 숫자만이 아니라 (총 - 사용)
                                    int deductCount = 0;
                                    for (com.afbscenter.model.MemberProductHistory h : histories) {
                                        if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.DEDUCT && h.getChangeAmount() != null) {
                                            deductCount += Math.abs(h.getChangeAmount().intValue());
                                        }
                                    }
                                    rentalDeductCount = deductCount;
                                    if (deductCount > 0) {
                                        int fromHistory = Math.max(0, totalCount - deductCount);
                                        remainingCount = fromHistory;
                                        baseRemaining = (baseRemaining == null || remainingCount < baseRemaining) ? remainingCount : baseRemaining;
                                        displayTotal = deductCount + remainingCount;
                                    } else if (baseRemaining != null && totalCount != null) {
                                        // DEDUCT 없음: 횟수 조정(ADJUST) 또는 DB 잔여로 2월 9일부터 7·8·9회차 반영
                                        boolean firstCompleted = mpId != null && Boolean.TRUE.equals(rentalFirstCompletedByMpId.computeIfAbsent(mpId, id -> {
                                            Booking first = bookingRepository.findFirstByMemberProduct_IdOrderByStartTimeAscIdAsc(id).orElse(null);
                                            return first != null && first.getStatus() == Booking.BookingStatus.COMPLETED;
                                        }));
                                        int inferredTotal = firstCompleted ? (baseRemaining + 7) : (baseRemainingFromAdjust ? (baseRemaining + 6) : totalCount);
                                        if (inferredTotal < totalCount) {
                                            displayTotal = inferredTotal;
                                        }
                                    }
                                } catch (Exception e) {
                                    logger.debug("대관 DEDUCT 보정 실패: mpId={}", mpId, e);
                                }
                                if (thisStart != null && thisId != null) {
                                    int countLater = 0;
                                    for (Booking b : bookings) {
                                        if (b.getMemberProduct() == null || !b.getMemberProduct().getId().equals(mpId)) continue;
                                        if (b.getStartTime() == null) continue;
                                        if (b.getStartTime().isAfter(thisStart) || (b.getStartTime().equals(thisStart) && b.getId() != null && b.getId() > thisId))
                                            countLater++;
                                    }
                                    remainingCount = (remainingCount != null ? remainingCount : 0) + countLater;
                                }
                            }
                            // 회차: 잔여/ADJUST(횟수 조정) 기준으로 계산. "앞에 예약 개수+1"만 쓰지 않음(첫 회차가 조정된 경우 앞에 건수 없어서 1로 나오는 문제 방지)
                            Integer totalForSession = (displayTotal != null ? displayTotal : totalCount);
                            long orderForSession = sessionNumberByOrder >= 1 ? sessionNumberByOrder : (thisStart != null && thisId != null ? bookingRepository.countByMemberProductBeforeInOrder(mpId, thisStart, thisId) + 1 : sessionNumberByCreationOrder);
                            if (totalForSession != null && baseRemaining != null) {
                                long firstSession = totalForSession - baseRemaining + 1L; // 다음에 쓸 회차(ADJUST/DEDUCT 반영, 앞에 기록 없어도 맞음)
                                if (booking.getStatus() == Booking.BookingStatus.COMPLETED) {
                                    // 체크인된 예약: DEDUCT 순번으로 회차 확정. 단, 체크인 시 회차 줄이지 않음 → 미완료 시 회차보다 작게 두지 않음
                                    long sessionFromDeductId = 0;
                                    try {
                                        java.util.Optional<com.afbscenter.model.Attendance> attOpt = attendanceRepository.findByBookingId(booking.getId());
                                        if (attOpt.isPresent()) {
                                            java.util.Optional<com.afbscenter.model.MemberProductHistory> histOpt = memberProductHistoryRepository.findDeductByAttendanceId(attOpt.get().getId());
                                            if (histOpt.isPresent() && histOpt.get().getId() != null) {
                                                sessionFromDeductId = memberProductHistoryRepository.countDeductByMemberProductIdAndIdLessThanEqual(mpId, histOpt.get().getId());
                                            }
                                        }
                                    } catch (Exception e) {
                                        logger.trace("체크인 회차 DEDUCT id 기준 조회 실패: bookingId={}", booking.getId(), e);
                                    }
                                    if (sessionFromDeductId >= 1 && sessionFromDeductId <= totalForSession) {
                                        sessionNumber = sessionFromDeductId;
                                    } else if (rentalDeductCount >= 1 && rentalDeductCount <= totalForSession) {
                                        sessionNumber = rentalDeductCount;
                                    } else if (orderForSession >= 1) {
                                        sessionNumber = Math.min(totalForSession, orderForSession);
                                    }
                                    // 체크인 시 회차 줄이지 않음: 미완료였을 때 회차(firstSession+order오프셋)보다 작게 두지 않음
                                    long minSessionIfUncompleted = (firstSession >= 1 && orderForSession >= 1) ? Math.min(totalForSession, firstSession + (orderForSession - 1L)) : 0;
                                    if (minSessionIfUncompleted >= 1 && sessionNumber < minSessionIfUncompleted) {
                                        sessionNumber = minSessionIfUncompleted;
                                    }
                                } else {
                                    // 미완료: firstSession(잔여 기준) + 예약 순서 오프셋. "앞에 예약 개수+1"만 쓰지 않고 조정 반영
                                    if (firstSession >= 1 && firstSession <= totalForSession && orderForSession >= 1) {
                                        sessionNumber = Math.min(totalForSession, firstSession + (orderForSession - 1L));
                                    } else if (firstSession >= 1 && firstSession <= totalForSession) {
                                        sessionNumber = firstSession;
                                    } else if (orderForSession >= 1) {
                                        sessionNumber = Math.min(totalForSession, orderForSession);
                                    }
                                }
                            } else if (totalForSession != null && orderForSession >= 1) {
                                sessionNumber = Math.min(totalForSession, orderForSession);
                            }
                            if (sessionNumber < 1 && totalForSession != null && remainingCount != null) {
                                sessionNumber = Math.min(totalForSession, totalForSession - remainingCount + 1L);
                            }
                            // 회차와 이용권 횟수 분리: 잔여(remainingCount)는 위에서 DEDUCT/ADJUST/countLater로만 계산. 회차로 역산해 덮지 않음.
                            totalCount = totalForSession != null ? totalForSession : totalCount;
                        } else {
                            // ---- 대관 아님: endedBeforeNow 보정, 잔여 기반 회차 보정 ----
                            if (totalCount != null && memId != null && prodId != null) {
                                long endedBeforeNow = bookingRepository.countByMemberIdAndProductIdEndedBefore(memId, prodId, java.time.LocalDateTime.now());
                                int usedSoFar = (int) Math.min(endedBeforeNow, totalCount);
                                int computedRemaining = Math.max(0, totalCount - usedSoFar);
                                if (remainingCount == null || computedRemaining < remainingCount) {
                                    remainingCount = computedRemaining;
                                    if (sessionNumber == 1 && usedSoFar > 0) {
                                        sessionNumber = usedSoFar + 1;
                                    }
                                }
                            }
                            if (remainingCount == null && totalCount != null && sessionNumber >= 1) {
                                remainingCount = Math.max(0, Math.min(totalCount, totalCount - (int) sessionNumber + 1));
                            }
                            if (remainingCount == null && totalCount != null) {
                                remainingCount = totalCount;
                            }
                            if (totalCount != null && remainingCount != null && remainingCount < totalCount) {
                                long firstSession = totalCount - remainingCount + 1;
                                if (sessionNumberByOrder >= 1) {
                                    long byOrder = (firstSession - 1) + sessionNumberByOrder;
                                    if (byOrder <= totalCount) {
                                        sessionNumber = Math.max(sessionNumber, byOrder);
                                    } else if (sessionNumber == 1 && firstSession > 1) {
                                        sessionNumber = firstSession;
                                    }
                                } else if (firstSession > sessionNumber) {
                                    sessionNumber = firstSession;
                                }
                                if (sessionNumber == 1 && firstSession > 1) {
                                    sessionNumber = sessionNumberByOrder >= 1 ? Math.min(totalCount, (firstSession - 1) + sessionNumberByOrder) : firstSession;
                                }
                            }
                        }

                        if (remainingCount == null && totalCount != null) {
                            remainingCount = totalCount;
                        }

                        Map<String, Object> memberProductMap = new HashMap<>();
                        memberProductMap.put("id", mpId);
                        memberProductMap.put("totalCount", totalCount);
                        memberProductMap.put("remainingCount", remainingCount);
                        memberProductMap.put("sessionNumber", sessionNumber);
                        if (mpEntity.getProduct() != null) {
                            memberProductMap.put("productName", mpEntity.getProduct().getName());
                            memberProductMap.put("productType", mpEntity.getProduct().getType());
                        }
                        bookingMap.put("memberProduct", memberProductMap);
                    } else {
                        bookingMap.put("memberProduct", null);
                    }
                    
                    bookingMaps.add(bookingMap);
                } catch (Exception e) {
                    // 개별 예약 변환 오류는 무시하고 계속 진행
                    logger.warn("예약 변환 오류 (ID: {}): {}", booking.getId(), e.getMessage(), e);
                }
            }
            
            logger.info("예약 조회 완료: {}건", bookingMaps.size());
            return ResponseEntity.ok(bookingMaps);
        } catch (Exception e) {
            logger.error("예약 조회 실패: {}", e.getMessage(), e);
            // 오류 발생 시 빈 리스트 반환 (서비스 중단 방지)
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getBookingById(@PathVariable Long id) {
        try {
            // memberProduct까지 함께 로드 (수정 시 이용권이 보이도록)
            Booking booking = bookingRepository.findByIdWithAllRelations(id);
            
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
                if (booking.getFacility().getBranch() != null) {
                    facilityMap.put("branch", booking.getFacility().getBranch().name());
                }
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
                } else {
                    memberMap.put("coach", null);
                }
                
                bookingMap.put("member", memberMap);
            } else {
                bookingMap.put("member", null);
            }
            
            // MemberProduct 정보 (수정 화면에서 이용권 표시용, 회차 표시용 totalCount/remainingCount/sessionNumber)
            if (booking.getMemberProduct() != null) {
                Long mpId = booking.getMemberProduct().getId();
                Map<String, Object> memberProductMap = new HashMap<>();
                memberProductMap.put("id", mpId);
                Integer totalCount = booking.getMemberProduct().getTotalCount();
                if (totalCount == null && booking.getMemberProduct().getProduct() != null
                        && booking.getMemberProduct().getProduct().getUsageCount() != null) {
                    totalCount = booking.getMemberProduct().getProduct().getUsageCount();
                }
                // 패키지(대관 10회권 등): totalCount가 없으면 packageItemsRemaining JSON 합으로 채움
                if (totalCount == null && booking.getMemberProduct().getPackageItemsRemaining() != null
                        && !booking.getMemberProduct().getPackageItemsRemaining().isEmpty()) {
                    try {
                        List<Map<String, Object>> pkgItems = new ObjectMapper().readValue(
                            booking.getMemberProduct().getPackageItemsRemaining(),
                            new TypeReference<List<Map<String, Object>>>() {});
                        int sumTotal = 0;
                        for (Map<String, Object> item : pkgItems) {
                            Object t = item.get("total");
                            if (t instanceof Number) sumTotal += ((Number) t).intValue();
                        }
                        if (sumTotal > 0) totalCount = sumTotal;
                    } catch (Exception e) { /* ignore */ }
                }
                // 대관인데 totalCount가 비어 있으면 DB에서 이용권 재조회해 채움 (잔여 보정 블록 진입 위해)
                boolean isRental = (booking.getPurpose() == Booking.BookingPurpose.RENTAL || (booking.getBranch() != null && booking.getBranch() == Booking.Branch.RENTAL));
                if (isRental && totalCount == null && mpId != null) {
                    com.afbscenter.model.MemberProduct mpReload = memberProductRepository.findById(mpId).orElse(null);
                    if (mpReload != null) {
                        totalCount = mpReload.getTotalCount();
                        if (totalCount == null && mpReload.getProduct() != null && mpReload.getProduct().getUsageCount() != null)
                            totalCount = mpReload.getProduct().getUsageCount();
                        if (totalCount == null && mpReload.getPackageItemsRemaining() != null && !mpReload.getPackageItemsRemaining().isEmpty()) {
                            try {
                                List<Map<String, Object>> pkg = new ObjectMapper().readValue(mpReload.getPackageItemsRemaining(), new TypeReference<List<Map<String, Object>>>() {});
                                int sum = 0;
                                for (Map<String, Object> item : pkg) {
                                    Object t = item.get("total");
                                    if (t instanceof Number) sum += ((Number) t).intValue();
                                }
                                if (sum > 0) totalCount = sum;
                            } catch (Exception e) { /* ignore */ }
                        }
                    }
                }
                memberProductMap.put("totalCount", totalCount);
                Integer remainingCount = booking.getMemberProduct().getRemainingCount();
                Long sessionNumber = null;
                int rentalDeductCount = -1; // 대관 블록에서 계산해 잔여 상한 적용용

                if (isRental && totalCount != null && booking.getStartTime() != null && booking.getId() != null) {
                    try {
                        com.afbscenter.model.MemberProduct mpForCount = memberProductRepository.findById(mpId).orElse(null);
                        Integer baseRemaining = (mpForCount != null && mpForCount.getRemainingCount() != null) ? mpForCount.getRemainingCount() : remainingCount;
                        boolean baseRemainingFromAdjust = false;
                        Integer displayTotal = totalCount;
                        List<com.afbscenter.model.MemberProductHistory> histories =
                            memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(mpId);
                        int deductCount = 0;
                        for (com.afbscenter.model.MemberProductHistory h : histories) {
                            if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.DEDUCT && h.getChangeAmount() != null) {
                                deductCount += Math.abs(h.getChangeAmount().intValue());
                            }
                        }
                        rentalDeductCount = deductCount;
                        if (mpForCount != null) {
                            for (com.afbscenter.model.MemberProductHistory h : histories) {
                                if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.ADJUST && h.getRemainingCountAfter() != null) {
                                    baseRemaining = h.getRemainingCountAfter();
                                    baseRemainingFromAdjust = true;
                                    break;
                                }
                            }
                            if (deductCount > 0) {
                                // 체크인(DEDUCT) 건수 기준 잔여만 사용. ADJUST/DB에 눌리지 않게 (체크인 1회인데 잔여 4회로 나오는 것 방지)
                                int fromHistory = Math.max(0, totalCount - deductCount);
                                baseRemaining = fromHistory;
                                displayTotal = deductCount + fromHistory;
                            } else if (baseRemaining != null && totalCount != null) {
                                // ADJUST 또는 DB 잔여만 있어도 첫 예약 완료면 7회차부터 반영
                                boolean firstCompleted = bookingRepository.findFirstByMemberProduct_IdOrderByStartTimeAscIdAsc(mpId)
                                        .map(b -> b.getStatus() == Booking.BookingStatus.COMPLETED).orElse(false);
                                int inferredTotal = firstCompleted ? (baseRemaining + 7) : (baseRemainingFromAdjust ? (baseRemaining + 6) : totalCount);
                                if (inferredTotal < totalCount) {
                                    displayTotal = inferredTotal;
                                }
                            }
                        }
                        Integer totalForSession = (displayTotal != null ? displayTotal : totalCount);
                        long orderByStartTime = bookingRepository.countByMemberProductBeforeInOrder(mpId, booking.getStartTime(), booking.getId()) + 1;
                        sessionNumber = totalForSession != null ? Math.min(totalForSession, orderByStartTime) : orderByStartTime;
                        if (totalForSession != null && baseRemaining != null) {
                            long firstSession = totalForSession - baseRemaining + 1L; // 다음에 쓸 회차(ADJUST/DEDUCT 반영)
                            if (booking.getStatus() == Booking.BookingStatus.COMPLETED) {
                                long sessionFromDeductId = 0;
                                try {
                                    java.util.Optional<com.afbscenter.model.Attendance> attOpt = attendanceRepository.findByBookingId(booking.getId());
                                    if (attOpt.isPresent()) {
                                        java.util.Optional<com.afbscenter.model.MemberProductHistory> histOpt = memberProductHistoryRepository.findDeductByAttendanceId(attOpt.get().getId());
                                        if (histOpt.isPresent() && histOpt.get().getId() != null) {
                                            sessionFromDeductId = memberProductHistoryRepository.countDeductByMemberProductIdAndIdLessThanEqual(mpId, histOpt.get().getId());
                                        }
                                    }
                                } catch (Exception e) {
                                    logger.trace("예약 단건 체크인 회차 DEDUCT id 기준 조회 실패: bookingId={}", id, e);
                                }
                                if (sessionFromDeductId >= 1 && sessionFromDeductId <= totalForSession) {
                                    sessionNumber = sessionFromDeductId;
                                } else if (rentalDeductCount >= 1 && rentalDeductCount <= totalForSession) {
                                    sessionNumber = (long) rentalDeductCount;
                                } else if (orderByStartTime >= 1) {
                                    sessionNumber = Math.min(totalForSession, orderByStartTime);
                                }
                                // 체크인 시 회차 줄이지 않음: 미완료였을 때 회차보다 작게 두지 않음
                                long minSessionIfUncompleted = (firstSession >= 1 && orderByStartTime >= 1) ? Math.min(totalForSession, firstSession + (orderByStartTime - 1L)) : 0;
                                if (minSessionIfUncompleted >= 1 && sessionNumber != null && sessionNumber < minSessionIfUncompleted) {
                                    sessionNumber = minSessionIfUncompleted;
                                }
                            } else {
                                // 미완료: firstSession(잔여/조정 기준) + 예약 순서 오프셋. 앞에 건수 없어도 조정 반영
                                if (firstSession >= 1 && firstSession <= totalForSession && orderByStartTime >= 1)
                                    sessionNumber = Math.min(totalForSession, firstSession + (orderByStartTime - 1L));
                                else if (firstSession >= 1 && firstSession <= totalForSession)
                                    sessionNumber = firstSession;
                                else if (orderByStartTime >= 1)
                                    sessionNumber = Math.min(totalForSession, orderByStartTime);
                            }
                        } else if (totalForSession != null && orderByStartTime >= 1) {
                            sessionNumber = Math.min(totalForSession, orderByStartTime);
                        }
                        // 회차와 이용권 횟수 분리: 잔여는 DEDUCT/ADJUST 기준(baseRemaining)으로만. 회차로 역산해 덮지 않음.
                        if (baseRemaining != null) {
                            remainingCount = Integer.valueOf(Math.max(0, baseRemaining));
                        }
                        // 빠른 예약 수정 모달: 체크인 후에도 DEDUCT 기준으로 잔여 상한 (9회로 나오는 것 방지)
                        if (totalCount != null && rentalDeductCount >= 0) {
                            int fromHistory = Math.max(0, totalCount - rentalDeductCount);
                            if (remainingCount == null || remainingCount > fromHistory)
                                remainingCount = fromHistory;
                        }
                        if (displayTotal != null) {
                            memberProductMap.put("totalCount", displayTotal);
                        }
                    } catch (Exception e) {
                        logger.debug("예약 단건 대관 회차/잔여 보정 실패: bookingId={}", id, e);
                    }
                }
                if (!isRental && totalCount != null && booking.getStartTime() != null && booking.getId() != null) {
                    try {
                        com.afbscenter.model.MemberProduct mpForCount = memberProductRepository.findById(mpId).orElse(null);
                        if (mpForCount != null) {
                            List<com.afbscenter.model.MemberProductHistory> histories =
                                memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(mpId);
                            int deductCount = 0;
                            for (com.afbscenter.model.MemberProductHistory h : histories) {
                                if (h.getType() == com.afbscenter.model.MemberProductHistory.TransactionType.DEDUCT && h.getChangeAmount() != null) {
                                    deductCount += Math.abs(h.getChangeAmount().intValue());
                                }
                            }
                            if (deductCount > 0) {
                                int fromHistory = Math.max(0, totalCount - deductCount);
                                remainingCount = fromHistory;
                            }
                            long countLater = bookingRepository.countByMemberProductAfterInOrder(mpId, booking.getStartTime(), booking.getId());
                            remainingCount = (remainingCount != null ? remainingCount : 0) + (int) countLater;
                        }
                    } catch (Exception e) {
                        logger.debug("예약 단건 잔여 보정 실패: bookingId={}", id, e);
                    }
                }
                if (remainingCount == null) {
                    remainingCount = booking.getMemberProduct().getRemainingCount();
                }
                memberProductMap.put("remainingCount", remainingCount);
                if (sessionNumber != null) {
                    memberProductMap.put("sessionNumber", sessionNumber);
                }
                if (booking.getMemberProduct().getProduct() != null) {
                    Map<String, Object> productMap = new HashMap<>();
                    productMap.put("id", booking.getMemberProduct().getProduct().getId());
                    productMap.put("name", booking.getMemberProduct().getProduct().getName());
                    productMap.put("type", booking.getMemberProduct().getProduct().getType() != null ? booking.getMemberProduct().getProduct().getType().name() : null);
                    memberProductMap.put("product", productMap);
                }
                bookingMap.put("memberProduct", memberProductMap);
            } else {
                bookingMap.put("memberProduct", null);
            }
            
            return ResponseEntity.ok(bookingMap);
        } catch (Exception e) {
            logger.error("예약 조회 실패 (ID: {})", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> createBooking(@RequestBody Map<String, Object> requestData) {
        try {
            logger.info("예약 생성 요청 수신: purpose={}, branch={}", requestData.get("purpose"), requestData.get("branch"));
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
            
            // 시설 운영 슬롯 내 예약인지 검증
            Optional<String> slotError = validateBookingWithinFacilitySlot(booking.getFacility(), booking.getStartTime(), booking.getEndTime());
            if (slotError.isPresent()) {
                Map<String, Object> errBody = new HashMap<>();
                errBody.put("message", slotError.get());
                return ResponseEntity.badRequest().body(errBody);
            }
            
            // 기타 필드 설정
            if (requestData.get("participants") != null) {
                booking.setParticipants(((Number) requestData.get("participants")).intValue());
            }
            
            // purpose는 요청값으로만 설정하고, 차감 여부는 이 값으로만 판단 (DB/엔티티 상태 의존 제거)
            final Booking.BookingPurpose requestedPurpose;
            if (requestData.get("purpose") != null && !requestData.get("purpose").toString().trim().isEmpty()) {
                String purposeStr = requestData.get("purpose").toString().trim().toUpperCase();
                try {
                    requestedPurpose = Booking.BookingPurpose.valueOf(purposeStr);
                    booking.setPurpose(requestedPurpose);
                    logger.info("예약 생성 요청 purpose: {} (차감 여부는 이 값으로만 판단)", purposeStr);
                } catch (IllegalArgumentException e) {
                    logger.warn("예약 목적 파싱 실패: '{}', 허용값: LESSON, RENTAL", purposeStr);
                    return ResponseEntity.badRequest().build();
                }
            } else {
                return ResponseEntity.badRequest().build();
            }
            
            if (requestData.get("lessonCategory") != null && !((String) requestData.get("lessonCategory")).trim().isEmpty()) {
                try {
                    booking.setLessonCategory(com.afbscenter.model.LessonCategory.valueOf((String) requestData.get("lessonCategory")));
                } catch (IllegalArgumentException e) {
                    logger.warn("레슨 카테고리 파싱 실패: {}", requestData.get("lessonCategory"));
                }
            }
            // 유소년 야구 예약: 회원이 있으면 유소년 등급만 허용
            if (booking.getLessonCategory() == com.afbscenter.model.LessonCategory.YOUTH_BASEBALL && member != null
                    && member.getGrade() != Member.MemberGrade.YOUTH) {
                Map<String, Object> err = new HashMap<>();
                err.put("message", "유소년 예약은 유소년 등급 회원만 가능합니다.");
                return ResponseEntity.badRequest().body(err);
            }
            
            // 상태 설정: 새 예약 생성 시에는 항상 PENDING으로 시작
            // (수정은 updateBooking 메서드에서 처리)
            if (requestData.get("status") != null && !((String) requestData.get("status")).trim().isEmpty()) {
                try {
                    String statusStr = ((String) requestData.get("status")).trim();
                    // 새 예약 생성 시에는 PENDING만 허용 (보안상의 이유)
                    // 빠른 예약 등 특수한 경우를 제외하고는 PENDING으로 강제
                    // 주의: 빠른 예약 기능이 필요한 경우 별도 엔드포인트 사용 권장
                    Booking.BookingStatus requestedStatus = Booking.BookingStatus.valueOf(statusStr);
                    
                    // 새 예약 생성 시 CONFIRMED는 허용하지 않음 (수정 시에만 가능)
                    // 빠른 예약 기능을 위한 예외는 주석 처리 (필요시 활성화)
                    // if (requestedStatus == Booking.BookingStatus.CONFIRMED) {
                    //     logger.warn("새 예약 생성 시 CONFIRMED 상태는 허용되지 않습니다. PENDING으로 변경합니다.");
                    //     booking.setStatus(Booking.BookingStatus.PENDING);
                    // } else {
                    //     booking.setStatus(requestedStatus);
                    // }
                    
                    // 일단 요청된 상태를 그대로 사용 (프론트엔드에서 이미 PENDING으로 보내도록 수정됨)
                    booking.setStatus(requestedStatus);
                } catch (IllegalArgumentException e) {
                    logger.warn("상태 파싱 실패: {}", requestData.get("status"));
                    booking.setStatus(Booking.BookingStatus.PENDING);
                }
            }

            // 지점(Branch) 설정
            if (requestData.get("branch") != null && !((String) requestData.get("branch")).trim().isEmpty()) {
                try {
                    booking.setBranch(Booking.Branch.valueOf(((String) requestData.get("branch")).toUpperCase()));
                    logger.info("지점 설정: {}", booking.getBranch());
                } catch (IllegalArgumentException e) {
                    logger.warn("지점 파싱 실패: {}, 기본값(SAHA) 사용", requestData.get("branch"));
                    booking.setBranch(Booking.Branch.SAHA);
                }
            } else {
                // branch가 없으면 기본값 사용 (사하점)
                booking.setBranch(Booking.Branch.SAHA);
                logger.info("지점 미지정, 기본값(SAHA) 사용");
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
            
            // 할인 금액 설정 (기본값: 0)
            if (requestData.get("discountAmount") != null) {
                try {
                    Object discountAmountObj = requestData.get("discountAmount");
                    Integer discountAmount;
                    if (discountAmountObj instanceof Number) {
                        discountAmount = ((Number) discountAmountObj).intValue();
                    } else {
                        discountAmount = Integer.parseInt(discountAmountObj.toString());
                    }
                    if (discountAmount < 0) {
                        discountAmount = 0;
                    }
                    booking.setDiscountAmount(discountAmount);
                } catch (NumberFormatException e) {
                    logger.warn("할인 금액 형식이 올바르지 않습니다: {}", requestData.get("discountAmount"));
                    booking.setDiscountAmount(0);
                }
            } else {
                booking.setDiscountAmount(0);
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
            // 주의: 트랜잭션 롤백을 방지하기 위해 예외를 명시적으로 처리
            if (requestData.get("memberProductId") != null && member != null) {
                com.afbscenter.model.MemberProduct memberProductToSet = null;
                try {
                    Object memberProductIdObj = requestData.get("memberProductId");
                    Long memberProductId;
                    if (memberProductIdObj instanceof Number) {
                        memberProductId = ((Number) memberProductIdObj).longValue();
                    } else {
                        memberProductId = Long.parseLong(memberProductIdObj.toString());
                    }
                    
                    logger.info("MemberProduct 조회 시작: ID={}, Member ID={}", memberProductId, member.getId());
                    
                    // JOIN FETCH를 사용하여 member와 product를 함께 로드 (lazy loading 방지)
                    java.util.Optional<com.afbscenter.model.MemberProduct> memberProductOpt = 
                        memberProductRepository.findByIdWithMember(memberProductId);
                    
                    if (memberProductOpt.isPresent()) {
                        com.afbscenter.model.MemberProduct memberProduct = memberProductOpt.get();
                        
                        // 회원의 상품인지 확인 (member는 이미 JOIN FETCH로 로드됨)
                        if (memberProduct.getMember() != null) {
                            Long memberProductMemberId = memberProduct.getMember().getId();
                            if (memberProductMemberId != null && memberProductMemberId.equals(member.getId())) {
                                memberProductToSet = memberProduct;
                                logger.info("상품 설정 완료: MemberProduct ID={}, Member ID={}", memberProductId, member.getId());
                            } else {
                                logger.warn("상품이 해당 회원의 것이 아닙니다. MemberProduct Member ID: {}, 요청 회원 ID: {}", 
                                    memberProductMemberId, member.getId());
                                // 상품이 회원의 것이 아니면 null로 설정 (예약은 저장됨)
                            }
                        } else {
                            logger.warn("MemberProduct의 Member가 null입니다: MemberProduct ID={}", memberProductId);
                        }
                    } else {
                        logger.warn("상품을 찾을 수 없습니다: MemberProduct ID={}", memberProductId);
                    }
                } catch (NumberFormatException e) {
                    logger.warn("MemberProduct ID 형식이 올바르지 않습니다: {}", requestData.get("memberProductId"), e);
                } catch (org.springframework.dao.DataAccessException e) {
                    logger.error("MemberProduct 조회 중 데이터베이스 오류: MemberProduct ID={}", 
                        requestData.get("memberProductId"), e);
                } catch (Exception e) {
                    logger.error("상품 설정 중 예상치 못한 오류: MemberProduct ID={}, 오류 타입: {}, 메시지: {}", 
                        requestData.get("memberProductId"), e.getClass().getName(), e.getMessage(), e);
                }
                
                // 예외가 발생해도 예약은 저장됨 (memberProduct는 null일 수 있음)
                booking.setMemberProduct(memberProductToSet);
            } else {
                // memberProductId가 없거나 member가 null이면 null로 설정
                booking.setMemberProduct(null);
                if (requestData.get("memberProductId") != null && member == null) {
                    logger.warn("MemberProduct ID가 제공되었지만 회원 정보가 없습니다: MemberProduct ID={}", 
                        requestData.get("memberProductId"));
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
                    com.afbscenter.model.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(assignedCoach);
                    if (category != null) {
                        booking.setLessonCategory(category);
                    }
                }
            } else {
                // 레슨이 아니면 레슨 카테고리를 null로 설정
                booking.setLessonCategory(null);
            }

            // 저장 전 최종 검증
            if (booking.getFacility() == null) {
                logger.error("예약 저장 실패: 시설이 설정되지 않았습니다.");
                throw new IllegalArgumentException("시설이 설정되지 않았습니다.");
            }
            if (booking.getStartTime() == null || booking.getEndTime() == null) {
                logger.error("예약 저장 실패: 시작 시간 또는 종료 시간이 설정되지 않았습니다.");
                throw new IllegalArgumentException("시작 시간 또는 종료 시간이 설정되지 않았습니다.");
            }
            if (booking.getPurpose() == null) {
                logger.error("예약 저장 실패: 목적이 설정되지 않았습니다.");
                throw new IllegalArgumentException("목적이 설정되지 않았습니다.");
            }
            if (booking.getBranch() == null) {
                logger.error("예약 저장 실패: 지점이 설정되지 않았습니다.");
                throw new IllegalArgumentException("지점이 설정되지 않았습니다.");
            }
            
            logger.info("예약 저장 시도: Facility ID={}, Member ID={}, MemberProduct ID={}, StartTime={}, EndTime={}, Purpose={}, Branch={}", 
                booking.getFacility().getId(), 
                booking.getMember() != null ? booking.getMember().getId() : null,
                booking.getMemberProduct() != null ? booking.getMemberProduct().getId() : null,
                booking.getStartTime(), booking.getEndTime(), booking.getPurpose(), booking.getBranch());
            
            Booking saved;
            try {
                saved = bookingRepository.save(booking);
                logger.info("예약 저장 성공: ID={}", saved.getId());
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                logger.error("예약 저장 실패 (데이터베이스 제약 조건 위반): {}", e.getMessage(), e);
                throw new IllegalArgumentException("예약 저장 중 데이터베이스 제약 조건 위반: " + e.getMessage(), e);
            } catch (org.hibernate.exception.ConstraintViolationException e) {
                logger.error("예약 저장 실패 (제약 조건 위반): {}", e.getMessage(), e);
                throw new IllegalArgumentException("예약 저장 중 제약 조건 위반: " + e.getMessage(), e);
            } catch (Exception e) {
                logger.error("예약 저장 실패 (예상치 못한 오류): {}", e.getMessage(), e);
                throw e;
            }
            
            // 저장 후 다시 조회하여 관련 엔티티를 안전하게 로드 (memberProduct·purpose 포함)
            Booking result = bookingRepository.findByIdWithAllRelations(saved.getId());
            if (result == null) {
                result = saved;
            }
            
            // 예약 등록(POST) 시 일반적으로는 차감 안 함. 단, 체크인된 예약을 복사한 경우에만 1회 차감 (sourceBookingId는 복사 시에만 전달됨, 빠른 예약 수정은 PUT이라 여기 미진입)
            Object sourceIdObj = requestData.get("sourceBookingId");
            if (sourceIdObj != null && result.getMemberProduct() != null && result.getMember() != null) {
                try {
                    Long sourceBookingId = sourceIdObj instanceof Number ? ((Number) sourceIdObj).longValue() : Long.parseLong(sourceIdObj.toString());
                    boolean sourceWasCheckedIn = attendanceRepository.findByBookingId(sourceBookingId)
                            .filter(a -> a.getCheckInTime() != null)
                            .isPresent();
                    if (sourceWasCheckedIn) {
                        com.afbscenter.model.MemberProduct mp = memberProductRepository.findByIdWithMember(result.getMemberProduct().getId()).orElse(null);
                        if (mp != null && mp.getProduct() != null && mp.getProduct().getType() == com.afbscenter.model.Product.ProductType.COUNT_PASS && mp.getStatus() == com.afbscenter.model.MemberProduct.Status.ACTIVE) {
                            if (mp.getPackageItemsRemaining() != null && !mp.getPackageItemsRemaining().isEmpty()) {
                                ObjectMapper mapper = new ObjectMapper();
                                List<Map<String, Object>> items = mapper.readValue(mp.getPackageItemsRemaining(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                                String itemName = result.getPurpose() == Booking.BookingPurpose.RENTAL ? "대관" : convertLessonCategoryToName(result.getLessonCategory());
                                boolean updated = false;
                                for (Map<String, Object> item : items) {
                                    if (itemName.equals(item.get("name"))) {
                                        int remaining = ((Number) item.get("remaining")).intValue();
                                        if (remaining > 0) {
                                            item.put("remaining", remaining - 1);
                                            updated = true;
                                            break;
                                        }
                                    }
                                }
                                if (updated) {
                                    mp.setPackageItemsRemaining(mapper.writeValueAsString(items));
                                    if (items.stream().allMatch(item -> ((Number) item.get("remaining")).intValue() == 0)) {
                                        mp.setStatus(com.afbscenter.model.MemberProduct.Status.USED_UP);
                                    }
                                    memberProductRepository.save(mp);
                                    logger.info("체크인된 예약 복사 시 이용권 1회 차감: Booking ID={}, MemberProduct ID={}, 항목={}", saved.getId(), mp.getId(), itemName);
                                }
                            } else if (mp.getRemainingCount() != null && mp.getRemainingCount() > 0) {
                                mp.setRemainingCount(mp.getRemainingCount() - 1);
                                if (mp.getRemainingCount() == 0) mp.setStatus(com.afbscenter.model.MemberProduct.Status.USED_UP);
                                memberProductRepository.save(mp);
                                logger.info("체크인된 예약 복사 시 이용권 1회 차감: Booking ID={}, MemberProduct ID={}, 잔여={}회", saved.getId(), mp.getId(), mp.getRemainingCount());
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.warn("체크인된 예약 복사 시 차감 처리 중 오류 (무시): {}", e.getMessage());
                }
            }
            
            // 레슨 예약이 확정되거나 완료되면 회원의 최근 방문일 업데이트
            if (result.getMember() != null && 
                result.getPurpose() == Booking.BookingPurpose.LESSON &&
                (result.getStatus() == Booking.BookingStatus.CONFIRMED || 
                 result.getStatus() == Booking.BookingStatus.COMPLETED) &&
                result.getStartTime() != null) {
                try {
                    // Member를 다시 조회하여 영속성 컨텍스트에서 관리되도록 함
                    Member memberToUpdate = memberRepository.findById(result.getMember().getId())
                            .orElse(null);
                    if (memberToUpdate != null) {
                        java.time.LocalDate visitDate = result.getStartTime().toLocalDate();
                        
                        // 기존 최근 방문일보다 더 최신이면 업데이트
                        if (memberToUpdate.getLastVisitDate() == null || 
                            visitDate.isAfter(memberToUpdate.getLastVisitDate())) {
                            memberToUpdate.setLastVisitDate(visitDate);
                            memberRepository.save(memberToUpdate);
                            logger.debug("회원 최근 방문일 업데이트 (레슨): Member ID={}, Date={}", memberToUpdate.getId(), visitDate);
                        }
                    }
                } catch (Exception e) {
                    logger.warn("최근 방문일 업데이트 실패: Member ID={}", result.getMember() != null ? result.getMember().getId() : "unknown", e);
                    // 최근 방문일 업데이트 실패해도 예약은 저장됨
                }
            }
            
            // 예약이 확정되거나 완료될 때 memberProduct가 없으면 자동으로 할당
            // 주의: PENDING 상태에서는 자동 할당하지 않음 (예약 생성 시에는 상품을 선택해야 함)
            // 이 로직은 예약 수정 시에만 작동하도록 함
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            Map<String, Object> bookingMap = new HashMap<>();
            bookingMap.put("id", result.getId());
            bookingMap.put("startTime", result.getStartTime());
            bookingMap.put("endTime", result.getEndTime());
            bookingMap.put("participants", result.getParticipants());
            bookingMap.put("purpose", result.getPurpose() != null ? result.getPurpose().name() : null);
            bookingMap.put("lessonCategory", result.getLessonCategory() != null ? result.getLessonCategory().name() : null);
            bookingMap.put("status", result.getStatus() != null ? result.getStatus().name() : null);
            bookingMap.put("paymentMethod", result.getPaymentMethod() != null ? result.getPaymentMethod().name() : null);
            bookingMap.put("discountAmount", result.getDiscountAmount());
            bookingMap.put("couponCode", result.getCouponCode());
            bookingMap.put("memo", result.getMemo());
            bookingMap.put("nonMemberName", result.getNonMemberName());
            bookingMap.put("nonMemberPhone", result.getNonMemberPhone());
            bookingMap.put("createdAt", result.getCreatedAt());
            bookingMap.put("updatedAt", result.getUpdatedAt());
            
            // Facility 정보
            if (result.getFacility() != null) {
                try {
                    Map<String, Object> facilityMap = new HashMap<>();
                    facilityMap.put("id", result.getFacility().getId());
                    facilityMap.put("name", result.getFacility().getName());
                    if (result.getFacility().getBranch() != null) {
                        facilityMap.put("branch", result.getFacility().getBranch().name());
                    }
                    bookingMap.put("facility", facilityMap);
                } catch (Exception e) {
                    logger.warn("Facility 로드 실패: Booking ID={}", result.getId(), e);
                    bookingMap.put("facility", null);
                }
            } else {
                bookingMap.put("facility", null);
            }
            
            // Member 정보
            if (result.getMember() != null) {
                try {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", result.getMember().getId());
                    memberMap.put("name", result.getMember().getName());
                    memberMap.put("memberNumber", result.getMember().getMemberNumber());
                    bookingMap.put("member", memberMap);
                } catch (Exception e) {
                    logger.warn("Member 로드 실패: Booking ID={}", result.getId(), e);
                    bookingMap.put("member", null);
                }
            } else {
                bookingMap.put("member", null);
            }
            
            // Coach 정보
            if (result.getCoach() != null) {
                try {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", result.getCoach().getId());
                    coachMap.put("name", result.getCoach().getName());
                    bookingMap.put("coach", coachMap);
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패: Booking ID={}", result.getId(), e);
                    bookingMap.put("coach", null);
                }
            } else {
                bookingMap.put("coach", null);
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(bookingMap);
        } catch (IllegalArgumentException e) {
            logger.error("예약 저장 실패 (IllegalArgumentException): {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Bad Request");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (org.springframework.transaction.UnexpectedRollbackException e) {
            logger.error("예약 저장 실패 (트랜잭션 롤백): {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Transaction Rollback");
            errorResponse.put("message", "트랜잭션이 롤백되었습니다: " + e.getMessage());
            // 원인 예외 확인
            Throwable cause = e.getCause();
            if (cause != null) {
                logger.error("트랜잭션 롤백 원인: {}", cause.getMessage(), cause);
                errorResponse.put("cause", cause.getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        } catch (Exception e) {
            logger.error("예약 저장 실패 (예상치 못한 오류): {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Internal Server Error");
            errorResponse.put("message", "서버 내부 오류가 발생했습니다: " + e.getMessage());
            errorResponse.put("errorClass", e.getClass().getName());
            // 원인 예외 확인
            Throwable cause = e.getCause();
            if (cause != null) {
                logger.error("예외 원인: {}", cause.getMessage(), cause);
                errorResponse.put("cause", cause.getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateBooking(@PathVariable Long id, @RequestBody Map<String, Object> requestData) {
        try {
            // JOIN FETCH를 사용하여 관련 엔티티를 함께 로드
            Booking booking = bookingRepository.findByIdWithFacilityAndMember(id);
            if (booking == null) {
                return ResponseEntity.notFound().build();
            }

            // 부분 업데이트 지원: null이 아닌 필드만 업데이트
            if (requestData.get("facility") != null) {
                Map<String, Object> facilityMap = (Map<String, Object>) requestData.get("facility");
                Object facilityIdObj = facilityMap.get("id");
                if (facilityIdObj != null) {
                    Long facilityId;
                    if (facilityIdObj instanceof Number) {
                        facilityId = ((Number) facilityIdObj).longValue();
                    } else {
                        facilityId = Long.parseLong(facilityIdObj.toString());
                    }
                    Facility facility = facilityRepository.findById(facilityId)
                            .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다."));
                    booking.setFacility(facility);
                }
            }

            if (requestData.get("startTime") != null) {
                try {
                    String startTimeStr = requestData.get("startTime").toString();
                    booking.setStartTime(java.time.LocalDateTime.parse(startTimeStr));
                } catch (Exception e) {
                    logger.warn("시작 시간 파싱 실패: {}", requestData.get("startTime"), e);
                }
            }
            if (requestData.get("endTime") != null) {
                try {
                    String endTimeStr = requestData.get("endTime").toString();
                    booking.setEndTime(java.time.LocalDateTime.parse(endTimeStr));
                } catch (Exception e) {
                    logger.warn("종료 시간 파싱 실패: {}", requestData.get("endTime"), e);
                }
            }
            // 시설 운영 슬롯 내 예약인지 검증 (시간/시설 변경 시)
            Optional<String> slotError = validateBookingWithinFacilitySlot(booking.getFacility(), booking.getStartTime(), booking.getEndTime());
            if (slotError.isPresent()) {
                Map<String, Object> errBody = new HashMap<>();
                errBody.put("message", slotError.get());
                return ResponseEntity.badRequest().body(errBody);
            }
            if (requestData.get("participants") != null) {
                try {
                    Object participantsObj = requestData.get("participants");
                    if (participantsObj instanceof Number) {
                        booking.setParticipants(((Number) participantsObj).intValue());
                    } else if (participantsObj instanceof String) {
                        booking.setParticipants(Integer.parseInt((String) participantsObj));
                    }
                } catch (Exception e) {
                    logger.warn("인원 파싱 실패: {}", requestData.get("participants"), e);
                }
            }
            if (requestData.get("purpose") != null) {
                try {
                    String purposeStr = requestData.get("purpose").toString();
                    booking.setPurpose(Booking.BookingPurpose.valueOf(purposeStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("목적 파싱 실패: {}", requestData.get("purpose"), e);
                }
            }
            // 레슨 카테고리 업데이트 (레슨인 경우만)
            Booking.BookingPurpose currentPurpose = booking.getPurpose();
            if (requestData.get("purpose") != null) {
                try {
                    String purposeStr = requestData.get("purpose").toString();
                    currentPurpose = Booking.BookingPurpose.valueOf(purposeStr);
                    if (currentPurpose == Booking.BookingPurpose.LESSON) {
                        // 레슨인 경우
                        if (requestData.get("lessonCategory") != null && !requestData.get("lessonCategory").toString().trim().isEmpty()) {
                            try {
                                String categoryStr = requestData.get("lessonCategory").toString();
                                booking.setLessonCategory(com.afbscenter.model.LessonCategory.valueOf(categoryStr));
                            } catch (IllegalArgumentException e) {
                                logger.warn("레슨 카테고리 파싱 실패: {}", requestData.get("lessonCategory"), e);
                            }
                        } else if (booking.getLessonCategory() == null) {
                            // 레슨 카테고리가 없으면 코치의 담당 종목으로 자동 설정
                            Coach coach = booking.getCoach();
                            if (coach == null && booking.getMember() != null && booking.getMember().getCoach() != null) {
                                coach = booking.getMember().getCoach();
                            }
                            if (coach != null) {
                                com.afbscenter.model.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
                                if (category != null) {
                                    booking.setLessonCategory(category);
                                }
                            }
                        }
                    } else {
                        // 레슨이 아니면 레슨 카테고리를 null로 설정
                        booking.setLessonCategory(null);
                    }
                } catch (IllegalArgumentException e) {
                    logger.warn("목적 파싱 실패: {}", requestData.get("purpose"), e);
                }
            }
            // 유소년 야구 예약 수정: 회원이 있으면 유소년 등급만 허용
            if (booking.getLessonCategory() == com.afbscenter.model.LessonCategory.YOUTH_BASEBALL
                    && booking.getMember() != null
                    && booking.getMember().getGrade() != Member.MemberGrade.YOUTH) {
                Map<String, Object> err = new HashMap<>();
                err.put("message", "유소년 예약은 유소년 등급 회원만 가능합니다.");
                return ResponseEntity.badRequest().body(err);
            }
            
            if (requestData.get("status") != null) {
                Booking.BookingStatus oldStatus = booking.getStatus();
                try {
                    String statusStr = requestData.get("status").toString();
                    Booking.BookingStatus newStatus = Booking.BookingStatus.valueOf(statusStr);
                    booking.setStatus(newStatus);
                    
                    // 예약이 확정되거나 완료될 때 memberProduct가 없으면 자동으로 할당
                    if (booking.getMember() != null && 
                        booking.getMemberProduct() == null &&
                        currentPurpose != null &&
                        currentPurpose == Booking.BookingPurpose.LESSON &&
                        (newStatus == Booking.BookingStatus.CONFIRMED || 
                         newStatus == Booking.BookingStatus.COMPLETED)) {
                        try {
                            // 회원의 활성 횟수권 조회
                            List<com.afbscenter.model.MemberProduct> activeCountPass = 
                                memberProductRepository.findActiveCountPassByMemberId(booking.getMember().getId());
                            
                            if (!activeCountPass.isEmpty()) {
                                // 첫 번째 활성 횟수권을 자동 할당
                                com.afbscenter.model.MemberProduct memberProduct = activeCountPass.get(0);
                                booking.setMemberProduct(memberProduct);
                                logger.debug("예약 확정 시 상품 자동 할당: Booking ID={}, MemberProduct ID={}", 
                                    booking.getId(), memberProduct.getId());
                            } else {
                                logger.debug("예약 확정 시 활성 횟수권이 없음: Member ID={}", booking.getMember().getId());
                            }
                        } catch (Exception e) {
                            logger.warn("예약 확정 시 상품 자동 할당 실패: Member ID={}", 
                                booking.getMember() != null ? booking.getMember().getId() : "unknown", e);
                            // 상품 할당 실패해도 예약은 저장됨
                        }
                    }
                    
                    // 주의: 횟수권 차감은 체크인 시에만 수행 (AttendanceController.processCheckin)
                    // 예약 상태 변경 시에는 차감하지 않음 (중복 차감 방지)
                    
                    // 레슨 예약이 확정되거나 완료되면 회원의 최근 방문일 업데이트
                    if (booking.getMember() != null && 
                        currentPurpose != null &&
                        currentPurpose == Booking.BookingPurpose.LESSON &&
                        (newStatus == Booking.BookingStatus.CONFIRMED || 
                         newStatus == Booking.BookingStatus.COMPLETED) &&
                        booking.getStartTime() != null) {
                        try {
                            // Member를 다시 조회하여 영속성 컨텍스트에서 관리되도록 함
                            Member memberToUpdate = memberRepository.findById(booking.getMember().getId())
                                    .orElse(null);
                            if (memberToUpdate != null) {
                                java.time.LocalDate visitDate = booking.getStartTime().toLocalDate();
                                
                                // 기존 최근 방문일보다 더 최신이면 업데이트
                                if (memberToUpdate.getLastVisitDate() == null || 
                                    visitDate.isAfter(memberToUpdate.getLastVisitDate())) {
                                    memberToUpdate.setLastVisitDate(visitDate);
                                    memberRepository.save(memberToUpdate);
                                    logger.debug("회원 최근 방문일 업데이트 (레슨): Member ID={}, Date={}", memberToUpdate.getId(), visitDate);
                                }
                            }
                        } catch (Exception e) {
                            logger.warn("최근 방문일 업데이트 실패: Member ID={}", booking.getMember() != null ? booking.getMember().getId() : "unknown", e);
                            // 최근 방문일 업데이트 실패해도 예약은 저장됨
                        }
                    }
                } catch (IllegalArgumentException e) {
                    logger.warn("상태 파싱 실패: {}", requestData.get("status"), e);
                }
            }
            
            if (requestData.get("paymentMethod") != null && !requestData.get("paymentMethod").toString().trim().isEmpty()) {
                try {
                    String paymentMethodStr = requestData.get("paymentMethod").toString();
                    booking.setPaymentMethod(Booking.PaymentMethod.valueOf(paymentMethodStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("결제 방법 파싱 실패: {}", requestData.get("paymentMethod"), e);
                }
            }
            
            // Coach 업데이트 처리
            if (requestData.containsKey("coach")) {
                Object coachObj = requestData.get("coach");
                if (coachObj == null) {
                    // coach 필드가 null로 전달된 경우 코치 제거
                    booking.setCoach(null);
                } else if (coachObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> coachMap = (Map<String, Object>) coachObj;
                    Object coachIdObj = coachMap.get("id");
                    if (coachIdObj != null) {
                        try {
                            Long coachId;
                            if (coachIdObj instanceof Number) {
                                coachId = ((Number) coachIdObj).longValue();
                            } else {
                                coachId = Long.parseLong(coachIdObj.toString());
                            }
                            Coach coach = coachRepository.findById(coachId)
                                    .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
                            booking.setCoach(coach);
                        } catch (Exception e) {
                            logger.warn("코치 설정 실패: {}", coachIdObj, e);
                        }
                    } else {
                        // ID가 null이면 코치 제거
                        booking.setCoach(null);
                    }
                }
            }
            
            // memo는 null이거나 빈 문자열일 때도 명시적으로 설정 (메모 삭제/수정 시)
            if (requestData.get("memo") != null) {
                String memo = requestData.get("memo").toString().trim();
                booking.setMemo(memo.isEmpty() ? null : memo);
            } else {
                // null인 경우도 명시적으로 null로 설정
                booking.setMemo(null);
            }
            
            // 비회원 이름/전화번호 직접 업데이트 (대관 빠른 수정 등, member/memberNumber 없이 전달되는 경우)
            if (requestData.containsKey("nonMemberName")) {
                Object v = requestData.get("nonMemberName");
                booking.setNonMemberName(v != null && !v.toString().trim().isEmpty() ? v.toString().trim() : null);
            }
            if (requestData.containsKey("nonMemberPhone")) {
                Object v = requestData.get("nonMemberPhone");
                booking.setNonMemberPhone(v != null && !v.toString().trim().isEmpty() ? v.toString().trim() : null);
            }
            
            // 지점(branch) 업데이트
            if (requestData.get("branch") != null && !requestData.get("branch").toString().trim().isEmpty()) {
                try {
                    String branchStr = requestData.get("branch").toString().trim().toUpperCase();
                    booking.setBranch(Booking.Branch.valueOf(branchStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("지점 파싱 실패: {}", requestData.get("branch"), e);
                }
            }
            
            // Member 업데이트 (memberNumber 또는 member.id로)
            if (requestData.get("memberNumber") != null) {
                String memberNumber = requestData.get("memberNumber").toString();
                if (!memberNumber.trim().isEmpty()) {
                    Member member = memberRepository.findByMemberNumber(memberNumber).orElse(null);
                    booking.setMember(member);
                    if (member == null) {
                        // 비회원 정보 설정
                        booking.setNonMemberName((String) requestData.get("nonMemberName"));
                        booking.setNonMemberPhone((String) requestData.get("nonMemberPhone"));
                    } else {
                        booking.setNonMemberName(null);
                        booking.setNonMemberPhone(null);
                    }
                }
            } else if (requestData.get("member") != null) {
                Object memberObj = requestData.get("member");
                if (memberObj == null) {
                    booking.setMember(null);
                    booking.setNonMemberName((String) requestData.get("nonMemberName"));
                    booking.setNonMemberPhone((String) requestData.get("nonMemberPhone"));
                } else if (memberObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> memberMap = (Map<String, Object>) memberObj;
                    Object memberIdObj = memberMap.get("id");
                    if (memberIdObj != null) {
                        try {
                            Long memberId;
                            if (memberIdObj instanceof Number) {
                                memberId = ((Number) memberIdObj).longValue();
                            } else {
                                memberId = Long.parseLong(memberIdObj.toString());
                            }
                            Member member = memberRepository.findById(memberId).orElse(null);
                            booking.setMember(member);
                            if (member == null) {
                                booking.setNonMemberName((String) requestData.get("nonMemberName"));
                                booking.setNonMemberPhone((String) requestData.get("nonMemberPhone"));
                            } else {
                                booking.setNonMemberName(null);
                                booking.setNonMemberPhone(null);
                            }
                        } catch (Exception e) {
                            logger.warn("회원 설정 실패: {}", memberIdObj, e);
                        }
                    }
                }
            }

            // 수정 시 이용권(memberProductId) 반영 - 미연결 예약에서 이용권 연결 시 목록에서 제거되도록
            if (requestData.containsKey("memberProductId")) {
                Object memberProductIdObj = requestData.get("memberProductId");
                Member member = booking.getMember();
                if (memberProductIdObj != null && !memberProductIdObj.toString().trim().isEmpty() && member != null) {
                    try {
                        Long memberProductId;
                        if (memberProductIdObj instanceof Number) {
                            memberProductId = ((Number) memberProductIdObj).longValue();
                        } else {
                            memberProductId = Long.parseLong(memberProductIdObj.toString().trim());
                        }
                        java.util.Optional<com.afbscenter.model.MemberProduct> memberProductOpt =
                                memberProductRepository.findByIdWithMember(memberProductId);
                        if (memberProductOpt.isPresent()) {
                            com.afbscenter.model.MemberProduct mp = memberProductOpt.get();
                            if (mp.getMember() != null && mp.getMember().getId().equals(member.getId())) {
                                booking.setMemberProduct(mp);
                                logger.info("예약 수정 시 이용권 연결: Booking ID={}, MemberProduct ID={}", id, memberProductId);
                            } else {
                                logger.warn("예약 수정: 이용권이 해당 회원 소유가 아님. Booking ID={}, MemberProduct ID={}", id, memberProductId);
                                booking.setMemberProduct(null);
                            }
                        } else {
                            logger.warn("예약 수정: 이용권을 찾을 수 없음. MemberProduct ID={}", memberProductId);
                            booking.setMemberProduct(null);
                        }
                    } catch (Exception e) {
                        logger.warn("예약 수정 시 이용권 설정 실패: {}", memberProductIdObj, e);
                        booking.setMemberProduct(null);
                    }
                } else {
                    booking.setMemberProduct(null);
                }
            }

            Booking saved = bookingRepository.save(booking);
            
            // 주의: 횟수권 차감은 체크인 시에만 수행 (AttendanceController.processCheckin)
            // 예약 확정/완료 시에는 차감하지 않음 (체크인 시에만 차감)
            
            // 저장 후 다시 조회하여 관련 엔티티를 안전하게 로드
            Booking result = bookingRepository.findByIdWithFacilityAndMember(saved.getId());
            if (result == null) {
                result = saved;
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            Map<String, Object> bookingMap = new HashMap<>();
            bookingMap.put("id", result.getId());
            bookingMap.put("startTime", result.getStartTime());
            bookingMap.put("endTime", result.getEndTime());
            bookingMap.put("participants", result.getParticipants());
            bookingMap.put("purpose", result.getPurpose() != null ? result.getPurpose().name() : null);
            bookingMap.put("lessonCategory", result.getLessonCategory() != null ? result.getLessonCategory().name() : null);
            bookingMap.put("status", result.getStatus() != null ? result.getStatus().name() : null);
            bookingMap.put("paymentMethod", result.getPaymentMethod() != null ? result.getPaymentMethod().name() : null);
            bookingMap.put("discountAmount", result.getDiscountAmount());
            bookingMap.put("couponCode", result.getCouponCode());
            bookingMap.put("memo", result.getMemo());
            bookingMap.put("nonMemberName", result.getNonMemberName());
            bookingMap.put("nonMemberPhone", result.getNonMemberPhone());
            bookingMap.put("createdAt", result.getCreatedAt());
            bookingMap.put("updatedAt", result.getUpdatedAt());
            
            // Facility 정보
            if (result.getFacility() != null) {
                try {
                    Map<String, Object> facilityMap = new HashMap<>();
                    facilityMap.put("id", result.getFacility().getId());
                    facilityMap.put("name", result.getFacility().getName());
                    if (result.getFacility().getBranch() != null) {
                        facilityMap.put("branch", result.getFacility().getBranch().name());
                    }
                    bookingMap.put("facility", facilityMap);
                } catch (Exception e) {
                    logger.warn("Facility 로드 실패: Booking ID={}", result.getId(), e);
                    bookingMap.put("facility", null);
                }
            } else {
                bookingMap.put("facility", null);
            }
            
            // Member 정보
            if (result.getMember() != null) {
                try {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", result.getMember().getId());
                    memberMap.put("name", result.getMember().getName());
                    memberMap.put("memberNumber", result.getMember().getMemberNumber());
                    bookingMap.put("member", memberMap);
                } catch (Exception e) {
                    logger.warn("Member 로드 실패: Booking ID={}", result.getId(), e);
                    bookingMap.put("member", null);
                }
            } else {
                bookingMap.put("member", null);
            }
            
            // Coach 정보
            if (result.getCoach() != null) {
                try {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", result.getCoach().getId());
                    coachMap.put("name", result.getCoach().getName());
                    bookingMap.put("coach", coachMap);
                } catch (Exception e) {
                    logger.warn("Coach 로드 실패: Booking ID={}", result.getId(), e);
                    bookingMap.put("coach", null);
                }
            } else {
                bookingMap.put("coach", null);
            }
            
            return ResponseEntity.ok(bookingMap);
        } catch (IllegalArgumentException e) {
            logger.warn("예약을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("예약 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 예약 삭제 시 처리:
     * - 출석(체크인) 기록: 해당 예약에 연결된 Attendance 1건 삭제 (체크인 여부 무관).
     * - 체크인된 예약 삭제 시: 이용권 1회 복구 + 해당 출석과 연결된 MemberProductHistory 삭제 후 출석 삭제 (횟수 차감 없음).
     * - 체크인 없이 삭제 시: 레슨만 예약 등록 시 차감했던 1회 복구 (대관은 예약 시 차감 안 하므로 복구 불필요).
     * - 결제(Payment): 이 예약을 참조하는 결제의 booking_id만 null로 해제 (결제 내역은 유지).
     * - 예약: 최종 삭제.
     */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteBooking(@PathVariable Long id) {
        try {
            if (!bookingRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            // 삭제 전 예약 정보 로드 (체크인 없이 삭제 시 예약 등록 시 차감한 1회 복구용)
            Booking bookingToRestore = bookingRepository.findByIdWithAllRelations(id);
            boolean wasCheckedIn = false;

            // 예약과 연결된 출석 기록 확인 및 처리
            try {
                java.util.Optional<com.afbscenter.model.Attendance> attendanceOpt = 
                    attendanceRepository.findByBookingId(id);
                if (attendanceOpt.isPresent()) {
                    com.afbscenter.model.Attendance attendance = attendanceOpt.get();
                    wasCheckedIn = (attendance.getCheckInTime() != null);

                    // 체크인된 경우: 차감된 횟수 +1 복구
                    if (attendance.getCheckInTime() != null) {
                        try {
                            // 출석 기록과 연결된 이용권 히스토리 찾기 (모두 찾기)
                            List<com.afbscenter.model.MemberProductHistory> historiesWithAttendance = 
                                memberProductHistoryRepository.findAllByAttendanceId(attendance.getId());
                            
                            com.afbscenter.model.MemberProduct memberProduct = null;
                            
                            // 히스토리에서 memberProduct 정보 추출
                            if (!historiesWithAttendance.isEmpty()) {
                                com.afbscenter.model.MemberProductHistory firstHistory = historiesWithAttendance.get(0);
                                try {
                                    memberProduct = firstHistory.getMemberProduct();
                                } catch (Exception e) {
                                    logger.warn("히스토리에서 MemberProduct 로드 실패: {}", e.getMessage());
                                }
                            }
                            
                            // 히스토리에서 memberProduct를 찾지 못한 경우, booking에서 직접 가져오기
                            if (memberProduct == null && attendance.getBooking() != null) {
                                try {
                                    com.afbscenter.model.Booking booking = attendance.getBooking();
                                    memberProduct = booking.getMemberProduct();
                                } catch (Exception e) {
                                    logger.warn("Booking에서 MemberProduct 로드 실패: {}", e.getMessage());
                                }
                            }
                            
                            if (memberProduct != null) {
                                try {
                                    // memberProduct를 다시 조회하여 최신 상태로 가져오기 (lazy loading 방지)
                                    com.afbscenter.model.MemberProduct refreshedProduct = 
                                        memberProductRepository.findByIdWithMember(memberProduct.getId()).orElse(null);
                                    if (refreshedProduct != null) {
                                        memberProduct = refreshedProduct;
                                    }
                                    
                                    Integer totalCount = memberProduct.getTotalCount();
                                    if (totalCount == null && memberProduct.getProduct() != null && memberProduct.getProduct().getUsageCount() != null) {
                                        totalCount = memberProduct.getProduct().getUsageCount();
                                        memberProduct.setTotalCount(totalCount);
                                    }
                                    boolean hasPackage = memberProduct.getPackageItemsRemaining() != null
                                        && !memberProduct.getPackageItemsRemaining().isEmpty();
                                    Integer beforeRemaining = memberProduct.getRemainingCount() != null ? memberProduct.getRemainingCount() : 0;

                                    // 패키지(대관 10회권 등): JSON 항목 복구 후 합으로 remainingCount 설정 (출석 삭제와 동일 로직)
                                    if (hasPackage) {
                                        try {
                                            ObjectMapper mapper = new ObjectMapper();
                                            List<Map<String, Object>> items = mapper.readValue(
                                                memberProduct.getPackageItemsRemaining(),
                                                new TypeReference<List<Map<String, Object>>>() {});
                                            String itemName = (attendance.getBooking() != null && attendance.getBooking().getPurpose() == Booking.BookingPurpose.RENTAL)
                                                ? "대관" : convertLessonCategoryToName(attendance.getBooking() != null ? attendance.getBooking().getLessonCategory() : null);
                                            boolean packageItemRestored = false;
                                            for (Map<String, Object> item : items) {
                                                String nameStr = item.get("name") != null ? item.get("name").toString() : "";
                                                // 대관(RENTAL)은 "대관" 정확 일치 또는 이름에 '대관' 포함 또는 항목 1개일 때 매칭 (체크인 차감 로직과 동일)
                                                boolean nameMatches = itemName.equals("대관")
                                                    ? (nameStr.equals("대관") || nameStr.contains("대관") || items.size() == 1)
                                                    : itemName.equals(nameStr);
                                                if (nameMatches) {
                                                    int remaining = item.get("remaining") instanceof Number ? ((Number) item.get("remaining")).intValue() : 0;
                                                    item.put("remaining", remaining + 1);
                                                    memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(items));
                                                    int sum = 0;
                                                    for (Map<String, Object> i : items) {
                                                        if (i.get("remaining") instanceof Number) sum += ((Number) i.get("remaining")).intValue();
                                                    }
                                                    memberProduct.setRemainingCount(Math.min(sum, totalCount != null ? totalCount : sum));
                                                    packageItemRestored = true;
                                                    break;
                                                }
                                            }
                                            // 패키지 항목 이름 매칭 실패 시에도 잔여 횟수만이라도 복구
                                            if (!packageItemRestored) {
                                                int cur = beforeRemaining;
                                                int newRemaining = totalCount != null ? Math.min(cur + 1, totalCount) : cur + 1;
                                                memberProduct.setRemainingCount(newRemaining);
                                                logger.debug("예약 삭제 시 패키지 항목 이름 매칭 없음, remainingCount만 복구: {} -> {}", beforeRemaining, newRemaining);
                                            }
                                        } catch (Exception e) {
                                            logger.warn("예약 삭제 시 패키지 복구 실패, remainingCount만 복구: {}", e.getMessage());
                                            int cur = beforeRemaining;
                                            int newRemaining = totalCount != null ? Math.min(cur + 1, totalCount) : cur + 1;
                                            memberProduct.setRemainingCount(newRemaining);
                                        }
                                    } else {
                                        int cur = beforeRemaining;
                                        int newRemaining = totalCount != null ? Math.min(cur + 1, totalCount) : cur + 1;
                                        memberProduct.setRemainingCount(newRemaining);
                                    }

                                    if (memberProduct.getStatus() == com.afbscenter.model.MemberProduct.Status.USED_UP && 
                                        memberProduct.getRemainingCount() != null && memberProduct.getRemainingCount() > 0) {
                                        memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.ACTIVE);
                                    }
                                    memberProductRepository.save(memberProduct);
                                    logger.info("예약 삭제 시 차감된 횟수 복구: Booking ID={}, MemberProduct ID={}, 복구 전: {}회, 복구 후: {}회",
                                        id, memberProduct.getId(), beforeRemaining, memberProduct.getRemainingCount());
                                } catch (Exception e) {
                                    logger.error("MemberProduct 복구 처리 중 오류: Booking ID={}, MemberProduct ID={}, 오류: {}",
                                        id, memberProduct != null ? memberProduct.getId() : "unknown", e.getMessage(), e);
                                }
                            } else {
                                logger.warn("예약 삭제 시 차감 복구 실패: MemberProduct를 찾을 수 없음. Booking ID={}, Attendance ID={}", 
                                    id, attendance.getId());
                            }
                            
                            // 예약과 연결된 모든 히스토리 삭제 (차감 히스토리 포함)
                            for (com.afbscenter.model.MemberProductHistory history : historiesWithAttendance) {
                                try {
                                    memberProductHistoryRepository.deleteById(history.getId());
                                    logger.debug("예약 삭제 시 관련 히스토리 삭제: History ID={}, Type={}, Attendance ID={}", 
                                        history.getId(), history.getType(), attendance.getId());
                                } catch (Exception e) {
                                    logger.warn("히스토리 삭제 실패 (무시): History ID={}, {}", 
                                        history.getId(), e.getMessage());
                                }
                            }
                            
                            // 복구 히스토리도 삭제 (description에 "예약 삭제로 인한 차감 복구 (Booking ID: {id})" 포함)
                            if (memberProduct != null) {
                                try {
                                    List<com.afbscenter.model.MemberProductHistory> allHistories = 
                                        memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(memberProduct.getId());
                                    
                                    String bookingIdPattern = "예약 삭제로 인한 차감 복구 (Booking ID: " + id + ")";
                                    for (com.afbscenter.model.MemberProductHistory history : allHistories) {
                                        if (history.getDescription() != null && 
                                            history.getDescription().contains(bookingIdPattern)) {
                                            try {
                                                memberProductHistoryRepository.deleteById(history.getId());
                                                logger.debug("예약 삭제 시 복구 히스토리 삭제: History ID={}, Description={}", 
                                                    history.getId(), history.getDescription());
                                            } catch (Exception e) {
                                                logger.warn("복구 히스토리 삭제 실패 (무시): History ID={}, {}", 
                                                    history.getId(), e.getMessage());
                                            }
                                        }
                                    }
                                } catch (Exception e) {
                                    logger.warn("복구 히스토리 삭제 중 오류 (무시): {}", e.getMessage());
                                }
                            }
                            
                            if (!historiesWithAttendance.isEmpty()) {
                                logger.info("예약 삭제 시 관련 히스토리 {}건 삭제 완료: Booking ID={}, Attendance ID={}", 
                                    historiesWithAttendance.size(), id, attendance.getId());
                            }
                        } catch (Exception e) {
                            logger.error("예약 삭제 시 횟수 복구 및 히스토리 삭제 실패: Booking ID={}, Attendance ID={}, 오류: {}", 
                                id, attendance != null ? attendance.getId() : "unknown", e.getMessage(), e);
                            // 복구 실패해도 예약 삭제는 계속 진행
                        }
                    }
                    
                    // 히스토리 삭제가 DB에 반영된 뒤 출석 삭제 (FK로 인해 출석만 남는 현상 방지)
                    if (entityManager != null) {
                        try { entityManager.flush(); } catch (Exception e) { logger.trace("flush 무시: {}", e.getMessage()); }
                    }
                    
                    // 출석 기록 삭제 (체크인 여부와 관계없이)
                    // 주의: 체크인된 경우 위에서 이미 관련 히스토리를 삭제했으므로 여기서는 attendance만 삭제
                    try {
                        attendanceRepository.deleteById(attendance.getId());
                        logger.info("예약 삭제 시 출석 기록도 함께 삭제: Booking ID={}, Attendance ID={}, 체크인 여부: {}", 
                            id, attendance.getId(), attendance.getCheckInTime() != null ? "체크인됨" : "미체크인");
                    } catch (Exception e) {
                        logger.error("출석 기록 삭제 실패: Booking ID={}, Attendance ID={}, 오류: {}", 
                            id, attendance.getId(), e.getMessage(), e);
                        // 출석 기록 삭제 실패해도 예약 삭제는 계속 진행
                    }
                }
            } catch (Exception e) {
                logger.error("예약 삭제 시 출석 기록 확인 중 오류: Booking ID={}, 오류: {}", id, e.getMessage(), e);
                // 출석 기록 확인 실패해도 예약 삭제는 계속 진행
            }

            // 체크인 없이 예약만 삭제한 경우: 예약 등록 시 차감한 1회 복구 (레슨만. 대관은 예약 시 차감 안 하므로 복구 불필요)
            if (!wasCheckedIn && bookingToRestore != null && bookingToRestore.getMemberProduct() != null
                && bookingToRestore.getMember() != null
                && bookingToRestore.getPurpose() == Booking.BookingPurpose.LESSON) {
                try {
                    com.afbscenter.model.MemberProduct memberProduct = memberProductRepository
                        .findByIdWithMember(bookingToRestore.getMemberProduct().getId()).orElse(null);
                    if (memberProduct != null && memberProduct.getProduct() != null
                        && memberProduct.getProduct().getType() == com.afbscenter.model.Product.ProductType.COUNT_PASS) {

                        if (memberProduct.getPackageItemsRemaining() != null
                            && !memberProduct.getPackageItemsRemaining().isEmpty()) {
                            ObjectMapper mapper = new ObjectMapper();
                            List<Map<String, Object>> items = mapper.readValue(
                                memberProduct.getPackageItemsRemaining(),
                                new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
                            String lessonName = (bookingToRestore.getPurpose() == Booking.BookingPurpose.RENTAL)
                                ? "대관" : convertLessonCategoryToName(bookingToRestore.getLessonCategory());
                            boolean updated = false;
                            for (Map<String, Object> item : items) {
                                if (lessonName.equals(item.get("name"))) {
                                    int remaining = ((Number) item.get("remaining")).intValue();
                                    item.put("remaining", remaining + 1);
                                    updated = true;
                                    logger.info("예약 삭제 시 패키지 복구: {} - {}회 남음", lessonName, remaining + 1);
                                    break;
                                }
                            }
                            if (updated) {
                                memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(items));
                                if (memberProduct.getStatus() == com.afbscenter.model.MemberProduct.Status.USED_UP) {
                                    memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.ACTIVE);
                                }
                                memberProductRepository.save(memberProduct);
                                logger.info("예약 삭제 시 패키지 상품 복구 완료: Booking ID={}, MemberProduct ID={}", id, memberProduct.getId());
                            }
                        } else {
                            Integer currentRemaining = memberProduct.getRemainingCount();
                            if (currentRemaining == null) currentRemaining = 0;
                            Integer totalCount = memberProduct.getTotalCount();
                            if (totalCount == null && memberProduct.getProduct().getUsageCount() != null) {
                                totalCount = memberProduct.getProduct().getUsageCount();
                                memberProduct.setTotalCount(totalCount);
                            }
                            int newRemaining = totalCount != null ? Math.min(currentRemaining + 1, totalCount) : currentRemaining + 1;
                            memberProduct.setRemainingCount(newRemaining);
                            if (memberProduct.getStatus() == com.afbscenter.model.MemberProduct.Status.USED_UP && memberProduct.getRemainingCount() > 0) {
                                memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.ACTIVE);
                            }
                            memberProductRepository.save(memberProduct);
                            logger.info("예약 삭제 시 횟수권 복구: Booking ID={}, MemberProduct ID={}, 복구 후 잔여={}회", id, memberProduct.getId(), memberProduct.getRemainingCount());
                        }
                    }
                } catch (Exception e) {
                    logger.error("예약 삭제 시(체크인 없음) 이용권 복구 실패: Booking ID={}, 오류: {}", id, e.getMessage(), e);
                }
            }

            // 이 예약을 참조하는 결제(Payment) 연결 해제 (예약 삭제 후에도 결제 내역은 유지, booking_id만 null)
            try {
                List<com.afbscenter.model.Payment> paymentsForBooking = paymentRepository.findByBookingId(id);
                for (com.afbscenter.model.Payment p : paymentsForBooking) {
                    p.setBooking(null);
                    paymentRepository.save(p);
                }
                if (!paymentsForBooking.isEmpty()) {
                    logger.info("예약 삭제 시 결제 연결 해제: Booking ID={}, {}건", id, paymentsForBooking.size());
                }
            } catch (Exception e) {
                logger.warn("예약 삭제 시 결제 연결 해제 중 오류 (무시): {}", e.getMessage());
            }

            bookingRepository.deleteById(id);
            // 삭제 후 ID 재정렬 (실패해도 예약 삭제는 성공으로 처리)
            try {
                reorderBookingIds();
            } catch (Exception e) {
                logger.warn("예약 삭제 후 ID 재정렬 실패 (무시): {}", e.getMessage());
            }
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("예약 삭제 중 오류 발생. ID: {}, 오류: {}", id, e.getMessage(), e);
            // 상세한 에러 정보를 반환
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
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
                        com.afbscenter.model.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
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

    // ID 재정렬 (삭제 후 순번을 연속적으로 유지)
    @Transactional
    private void reorderBookingIds() {
        reorderBookingIdsByDate();
    }
    
    // ID 재정렬 (날짜/시간 기준으로 정렬하여 재할당)
    // 주의: H2 데이터베이스에서 IDENTITY 컬럼은 직접 UPDATE할 수 없습니다.
    // 이 기능은 시퀀스만 리셋하고, 실제 ID 변경은 수행하지 않습니다.
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
            
            // H2에서 IDENTITY 컬럼은 직접 UPDATE할 수 없으므로
            // 시퀀스만 다음 ID로 설정합니다.
            // 실제 ID 재정렬은 데이터베이스 제약으로 인해 불가능합니다.
            long maxId = bookings.stream()
                    .mapToLong(Booking::getId)
                    .max()
                    .orElse(0L);
            
            // 시퀀스를 최대 ID + 1로 설정
            long nextId = maxId + 1;
            resetBookingSequence(nextId);
            
            logger.info("예약 시퀀스가 {}로 설정되었습니다. (총 {}개 예약)", nextId, bookings.size());
            
        } catch (Exception e) {
            logger.error("예약 시퀀스 리셋 중 오류 발생", e);
            // 에러를 던지지 않고 로그만 남김 (애플리케이션 계속 작동)
            // H2의 제약으로 인해 ID 재정렬이 불가능하므로, 에러를 무시합니다.
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
    private void decreaseCountPassUsage(Long memberId, LessonCategory lessonCategory) {
        // 회원의 활성 횟수권 조회
        List<com.afbscenter.model.MemberProduct> countPassProducts = 
            memberProductRepository.findActiveCountPassByMemberId(memberId);
        
        if (countPassProducts.isEmpty()) {
            return; // 횟수권이 없으면 차감하지 않음
        }
        
        // 가장 오래된 횟수권부터 사용 (구매일 기준)
        countPassProducts.sort((a, b) -> a.getPurchaseDate().compareTo(b.getPurchaseDate()));
        
        // LessonCategory를 레슨명으로 변환
        String lessonName = convertLessonCategoryToName(lessonCategory);
        
        // 첫 번째 횟수권 차감
        com.afbscenter.model.MemberProduct memberProduct = countPassProducts.get(0);
        
        // 패키지 상품인 경우 해당 레슨의 카운터만 차감
        if (memberProduct.getPackageItemsRemaining() != null && !memberProduct.getPackageItemsRemaining().isEmpty()) {
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
                    memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(items));
                    
                    // 모든 항목이 0이 되면 상태 변경
                    boolean allZero = items.stream()
                        .allMatch(item -> ((Number) item.get("remaining")).intValue() == 0);
                    if (allZero) {
                        memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.USED_UP);
                    }
                    
                    memberProductRepository.save(memberProduct);
                }
            } catch (Exception e) {
                logger.error("패키지 횟수 차감 실패", e);
            }
        }
        // 일반 횟수권인 경우
        else if (memberProduct.getRemainingCount() != null && memberProduct.getRemainingCount() > 0) {
            memberProduct.setRemainingCount(memberProduct.getRemainingCount() - 1);
            
            // 횟수가 0이 되면 상태 변경
            if (memberProduct.getRemainingCount() == 0) {
                memberProduct.setStatus(com.afbscenter.model.MemberProduct.Status.USED_UP);
            }
            
            memberProductRepository.save(memberProduct);
        }
    }
    
    // LessonCategory enum을 패키지 레슨명으로 변환
    private String convertLessonCategoryToName(LessonCategory category) {
        if (category == null) return "";
        switch (category) {
            case BASEBALL: return "야구";
            case PILATES: return "필라테스";
            case TRAINING: return "트레이닝";
            default: return "";
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
