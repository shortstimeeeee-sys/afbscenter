package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/attendance")
@CrossOrigin(origins = "http://localhost:8080")
public class AttendanceController {

    private static final Logger logger = LoggerFactory.getLogger(AttendanceController.class);

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private MemberProductRepository memberProductRepository;
    
    @Autowired
    private com.afbscenter.repository.BookingRepository bookingRepository;
    
    @Autowired
    private com.afbscenter.repository.TrainingLogRepository trainingLogRepository;
    
    @Autowired
    private MemberService memberService;

    @GetMapping
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
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
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
    public ResponseEntity<Attendance> createAttendance(@RequestBody Attendance attendance) {
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
                    decreaseCountPassUsage(member.getId());
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
    private void decreaseCountPassUsage(Long memberId) {
        // 회원의 활성 횟수권 조회
        List<MemberProduct> countPassProducts = 
            memberProductRepository.findActiveCountPassByMemberId(memberId);
        
        if (countPassProducts.isEmpty()) {
            return; // 횟수권이 없으면 차감하지 않음
        }
        
        // 가장 오래된 횟수권부터 사용 (구매일 기준)
        countPassProducts.sort((a, b) -> a.getPurchaseDate().compareTo(b.getPurchaseDate()));
        
        // 첫 번째 횟수권 차감
        MemberProduct memberProduct = countPassProducts.get(0);
        if (memberProduct.getRemainingCount() != null && memberProduct.getRemainingCount() > 0) {
            memberProduct.setRemainingCount(memberProduct.getRemainingCount() - 1);
            
            // 횟수가 0이 되면 상태 변경
            if (memberProduct.getRemainingCount() == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
            }
            
            memberProductRepository.save(memberProduct);
            logger.debug("상품권 횟수 차감: MemberProduct ID={}, 잔여={}회", memberProduct.getId(), memberProduct.getRemainingCount());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Attendance> updateAttendance(@PathVariable Long id, @RequestBody Attendance updatedAttendance) {
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

    // 체크인된 출석 기록 조회 (훈련 기록 입력용)
    @GetMapping("/checked-in")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<java.util.Map<String, Object>>> getCheckedInAttendances(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            logger.info("체크인된 출석 기록 조회 시작: startDate={}, endDate={}", startDate, endDate);
            List<Attendance> attendances;
            
            try {
                if (startDate != null && endDate != null) {
                    LocalDate start = LocalDate.parse(startDate);
                    LocalDate end = LocalDate.parse(endDate);
                    attendances = attendanceRepository.findCheckedInByDateRange(start, end);
                    logger.info("날짜 범위로 조회: {}건", attendances != null ? attendances.size() : 0);
                } else {
                    attendances = attendanceRepository.findCheckedInAttendances();
                    logger.info("전체 조회: {}건", attendances != null ? attendances.size() : 0);
                }
            } catch (Exception e) {
                logger.error("출석 기록 조회 실패: {}", e.getMessage(), e);
                return ResponseEntity.ok(new java.util.ArrayList<>());
            }
            
            if (attendances == null) {
                attendances = new java.util.ArrayList<>();
            }
            
            // 훈련이 끝난 내용만 필터링 (예약 종료 시간이 지났거나 예약 상태가 완료인 것만)
            // 이미 훈련 기록이 있는 체크인 기록은 제외
            LocalDateTime now = LocalDateTime.now();
            List<Attendance> filteredAttendances = new java.util.ArrayList<>();
            for (Attendance attendance : attendances) {
                try {
                    // 예약 정보 확인: 예약이 있고 종료 시간이 지났거나 상태가 완료인 것만 포함
                    boolean isTrainingCompleted = false;
                    try {
                        com.afbscenter.model.Booking booking = attendance.getBooking();
                        if (booking != null) {
                            // 예약 종료 시간이 지났거나 예약 상태가 완료인 경우
                            try {
                                if (booking.getEndTime() != null && booking.getEndTime().isBefore(now)) {
                                    isTrainingCompleted = true;
                                } else {
                                    try {
                                        if (booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.COMPLETED) {
                                            isTrainingCompleted = true;
                                        }
                                    } catch (Exception e) {
                                        logger.warn("예약 상태 확인 실패 (Attendance ID: {}, Booking ID: {}): {}", 
                                            attendance.getId(), booking.getId(), e.getMessage());
                                    }
                                }
                            } catch (Exception e) {
                                logger.warn("예약 종료 시간 확인 실패 (Attendance ID: {}, Booking ID: {}): {}", 
                                    attendance.getId(), booking.getId(), e.getMessage());
                            }
                        } else {
                            // 예약 정보가 없는 경우, 체크인 시간이 현재보다 이전이면 포함
                            if (attendance.getCheckInTime() != null && attendance.getCheckInTime().isBefore(now)) {
                                isTrainingCompleted = true;
                            }
                        }
                    } catch (Exception e) {
                        logger.warn("예약 정보 확인 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                        // 예약 정보 확인 실패 시, 체크인 시간으로 판단
                        if (attendance.getCheckInTime() != null && attendance.getCheckInTime().isBefore(now)) {
                            isTrainingCompleted = true;
                        }
                    }
                    
                    // 훈련이 끝나지 않았으면 제외
                    if (!isTrainingCompleted) {
                        continue;
                    }
                    
                    if (attendance.getMember() == null) {
                        filteredAttendances.add(attendance); // 회원 정보가 없으면 포함
                        continue;
                    }
                    
                    // 체크인 기록의 날짜 결정 (예약 날짜 우선, 없으면 체크인 날짜)
                    // 람다 표현식에서 사용하기 위해 final 변수로 계산
                    LocalDate attendanceDate = attendance.getDate(); // 기본값 설정
                    try {
                        com.afbscenter.model.Booking booking = attendance.getBooking();
                        if (booking != null) {
                            try {
                                if (booking.getStartTime() != null) {
                                    attendanceDate = booking.getStartTime().toLocalDate();
                                }
                            } catch (Exception e) {
                                logger.warn("예약 시작 시간 읽기 실패 (Attendance ID: {}, Booking ID: {}): {}", 
                                    attendance.getId(), booking.getId(), e.getMessage());
                                // 기본값(attendance.getDate()) 유지
                            }
                        }
                    } catch (Exception e) {
                        logger.warn("출석 기록 날짜 읽기 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                        // 기본값(attendance.getDate()) 유지
                    }
                    final LocalDate finalAttendanceDate = attendanceDate;
                    
                    // 해당 날짜와 회원에 대한 훈련 기록이 있는지 확인
                    boolean hasTrainingLog = false;
                    try {
                        List<com.afbscenter.model.TrainingLog> existingLogs = 
                            trainingLogRepository.findByMemberId(attendance.getMember().getId());
                        
                        if (existingLogs != null) {
                            hasTrainingLog = existingLogs.stream()
                                    .anyMatch(log -> log != null && log.getRecordDate() != null && 
                                                   log.getRecordDate().equals(finalAttendanceDate));
                        }
                    } catch (Exception e) {
                        logger.warn("훈련 기록 확인 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                        // 확인 실패 시 포함 (안전하게 처리)
                    }
                    
                    // 훈련 기록이 없으면 포함 (목록에 표시)
                    if (!hasTrainingLog) {
                        filteredAttendances.add(attendance);
                    }
                } catch (Exception e) {
                    logger.warn("출석 기록 필터링 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                    // 필터링 실패 시 제외 (안전하게 처리)
                }
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (예약 정보 포함)
            List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
            for (Attendance attendance : filteredAttendances) {
                try {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", attendance.getId());
                    map.put("date", attendance.getDate());
                    map.put("checkInTime", attendance.getCheckInTime());
                    map.put("checkOutTime", attendance.getCheckOutTime());
                    map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
                    
                    // 회원 정보
                    if (attendance.getMember() != null) {
                        java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                        memberMap.put("id", attendance.getMember().getId());
                        memberMap.put("name", attendance.getMember().getName());
                        map.put("member", memberMap);
                    } else {
                        map.put("member", null);
                    }
                    
                    // 시설 정보
                    if (attendance.getFacility() != null) {
                        java.util.Map<String, Object> facilityMap = new java.util.HashMap<>();
                        facilityMap.put("id", attendance.getFacility().getId());
                        facilityMap.put("name", attendance.getFacility().getName());
                        map.put("facility", facilityMap);
                    } else {
                        map.put("facility", null);
                    }
                    
                    // 예약 정보 (있는 경우)
                    try {
                        com.afbscenter.model.Booking booking = attendance.getBooking();
                        if (booking != null) {
                            java.util.Map<String, Object> bookingMap = new java.util.HashMap<>();
                            try {
                                bookingMap.put("id", booking.getId());
                                bookingMap.put("startTime", booking.getStartTime());
                                bookingMap.put("endTime", booking.getEndTime());
                                bookingMap.put("purpose", booking.getPurpose() != null ? booking.getPurpose().name() : null);
                                bookingMap.put("lessonCategory", booking.getLessonCategory() != null ? booking.getLessonCategory().name() : null);
                                
                                // 코치 정보
                                try {
                                    if (booking.getCoach() != null) {
                                        java.util.Map<String, Object> coachMap = new java.util.HashMap<>();
                                        coachMap.put("id", booking.getCoach().getId());
                                        coachMap.put("name", booking.getCoach().getName());
                                        coachMap.put("specialties", booking.getCoach().getSpecialties());
                                        bookingMap.put("coach", coachMap);
                                    } else {
                                        bookingMap.put("coach", null);
                                    }
                                } catch (Exception e) {
                                    logger.warn("코치 정보 읽기 실패 (Attendance ID: {}, Booking ID: {}): {}", 
                                        attendance.getId(), booking.getId(), e.getMessage());
                                    bookingMap.put("coach", null);
                                }
                                
                                map.put("booking", bookingMap);
                            } catch (Exception e) {
                                logger.warn("예약 정보 읽기 실패 (Attendance ID: {}, Booking ID: {}): {}", 
                                    attendance.getId(), booking.getId(), e.getMessage());
                                map.put("booking", null);
                            }
                        } else {
                            map.put("booking", null);
                        }
                    } catch (Exception e) {
                        logger.warn("예약 접근 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                        map.put("booking", null);
                    }
                    
                    result.add(map);
                } catch (Exception e) {
                    logger.warn("출석 기록 변환 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                    // 해당 항목만 건너뛰고 계속 진행
                }
            }
            
            logger.info("체크인된 출석 기록 조회 완료: {}건", result.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("체크인된 출석 기록 조회 중 오류 발생: {}", e.getMessage(), e);
            logger.error("오류 상세:", e);
            // 오류 발생 시 빈 리스트 반환 (서비스 중단 방지)
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }
    
    // 체크인 처리 (예약 기반)
    @PostMapping("/checkin")
    @org.springframework.transaction.annotation.Transactional
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
            com.afbscenter.model.Booking booking = bookingRepository.findById(finalBookingId)
                    .orElseThrow(() -> new IllegalArgumentException("예약을 찾을 수 없습니다."));
            
            // 이미 출석 기록이 있는지 확인
            java.util.Optional<Attendance> existingAttendance = attendanceRepository.findAll().stream()
                    .filter(a -> a.getBooking() != null && a.getBooking().getId().equals(finalBookingId))
                    .findFirst();
            
            Attendance attendance;
            boolean isNewAttendance = false;
            // 예약 날짜 결정 (booking.startTime의 날짜를 사용하여 캘린더와 일치시킴)
            java.time.LocalDate bookingDate = null;
            if (booking.getStartTime() != null) {
                bookingDate = booking.getStartTime().toLocalDate();
            } else {
                bookingDate = java.time.LocalDate.now();
            }
            
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
                // 기존 출석 기록의 날짜도 예약 날짜로 업데이트 (캘린더와 일치시키기 위해)
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
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
            
            // 회원이 있는 경우에만 처리
            if (attendance.getMember() != null) {
                Member member = memberRepository.findById(attendance.getMember().getId())
                        .orElse(null);
                
                if (member != null) {
                    // 1. 회원의 최근 방문일 업데이트
                    member.setLastVisitDate(attendance.getDate());
                    memberRepository.save(member);
                    logger.debug("회원 최근 방문일 업데이트: Member ID={}, Date={}", member.getId(), attendance.getDate());
                    
                    // 2. 상품권 횟수 차감 (autoDeduct가 true이고 새로운 출석 기록인 경우에만)
                    Boolean autoDeduct = checkinData.get("autoDeduct") != null ? 
                            Boolean.parseBoolean(checkinData.get("autoDeduct").toString()) : true;
                    
                    if (autoDeduct && isNewAttendance) {
                        try {
                            decreaseCountPassUsage(member.getId());
                            logger.info("상품권 횟수 차감 완료: Member ID={}, Booking ID={}", member.getId(), finalBookingId);
                        } catch (Exception e) {
                            logger.warn("상품권 횟수 차감 실패: Member ID={}", member.getId(), e);
                            // 상품권 차감 실패해도 출석 기록은 저장됨
                        }
                    } else if (!isNewAttendance) {
                        logger.debug("기존 출석 기록 업데이트 - 횟수권 차감 건너뜀: Attendance ID={}", attendance.getId());
                    }
                }
            }
            
            Attendance saved = attendanceRepository.save(attendance);
            
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("checkInTime", saved.getCheckInTime());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", "체크인이 완료되었습니다.");
            
            logger.info("체크인 완료: Attendance ID={}, Booking ID={}, Member ID={}", 
                    saved.getId(), finalBookingId, attendance.getMember() != null ? attendance.getMember().getId() : null);
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("체크인 처리 중 잘못된 인자: {}", e.getMessage());
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            logger.error("체크인 처리 중 오류 발생", e);
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", "체크인 처리 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    // 체크인 미처리 예약 목록 조회 (예약은 있지만 출석 기록이 없는 확정된 예약)
    @GetMapping("/unchecked-bookings")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<java.util.Map<String, Object>>> getUncheckedBookings() {
        try {
            // 모든 확정된 예약 조회
            List<com.afbscenter.model.Booking> confirmedBookings = bookingRepository.findByStatus(
                    com.afbscenter.model.Booking.BookingStatus.CONFIRMED);
            
            // 완료된 예약도 포함 (과거 예약 체크인 처리용)
            List<com.afbscenter.model.Booking> completedBookings = bookingRepository.findByStatus(
                    com.afbscenter.model.Booking.BookingStatus.COMPLETED);
            
            // 두 목록 합치기
            List<com.afbscenter.model.Booking> allBookings = new java.util.ArrayList<>();
            allBookings.addAll(confirmedBookings);
            allBookings.addAll(completedBookings);
            
            // 모든 출석 기록 조회 (booking_id가 있는 것만)
            List<Attendance> allAttendances = attendanceRepository.findAll();
            java.util.Set<Long> bookingsWithAttendance = new java.util.HashSet<>();
            for (Attendance attendance : allAttendances) {
                if (attendance.getBooking() != null) {
                    bookingsWithAttendance.add(attendance.getBooking().getId());
                }
            }
            
            // 출석 기록이 없는 예약만 필터링
            final java.util.Set<Long> finalBookingsWithAttendance = bookingsWithAttendance;
            List<com.afbscenter.model.Booking> uncheckedBookings = allBookings.stream()
                    .filter(booking -> !finalBookingsWithAttendance.contains(booking.getId()))
                    .sorted((a, b) -> {
                        if (a.getStartTime() == null && b.getStartTime() == null) return 0;
                        if (a.getStartTime() == null) return 1;
                        if (b.getStartTime() == null) return -1;
                        return b.getStartTime().compareTo(a.getStartTime()); // 최신순
                    })
                    .collect(java.util.stream.Collectors.toList());
            
            // Map으로 변환하여 반환
            List<java.util.Map<String, Object>> result = uncheckedBookings.stream().map(booking -> {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", booking.getId());
                map.put("startTime", booking.getStartTime());
                map.put("endTime", booking.getEndTime());
                map.put("participants", booking.getParticipants());
                map.put("status", booking.getStatus() != null ? booking.getStatus().name() : null);
                
                // Facility 정보
                if (booking.getFacility() != null) {
                    try {
                        java.util.Map<String, Object> facilityMap = new java.util.HashMap<>();
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
                
                // Member 정보
                if (booking.getMember() != null) {
                    try {
                        java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                        memberMap.put("id", booking.getMember().getId());
                        memberMap.put("name", booking.getMember().getName());
                        memberMap.put("memberNumber", booking.getMember().getMemberNumber());
                        map.put("member", memberMap);
                    } catch (Exception e) {
                        logger.warn("Member 로드 실패: Booking ID={}", booking.getId(), e);
                        map.put("member", null);
                    }
                } else {
                    map.put("member", null);
                    map.put("nonMemberName", booking.getNonMemberName());
                    map.put("nonMemberPhone", booking.getNonMemberPhone());
                }
                
                return map;
            }).collect(java.util.stream.Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("체크인 미처리 예약 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 체크아웃 처리
    @PostMapping("/checkout")
    @org.springframework.transaction.annotation.Transactional
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
