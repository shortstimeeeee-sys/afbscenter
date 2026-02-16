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
                attendances = attendanceRepository.findByDateRangeWithBooking(start, end);
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
                    // 레슨 카테고리·코치 필터용 (예약이 있을 때만)
                    if (attendance.getBooking() != null) {
                        map.put("purpose", attendance.getBooking().getPurpose() != null ? attendance.getBooking().getPurpose().name() : null);
                        map.put("lessonCategory", attendance.getBooking().getLessonCategory() != null ? attendance.getBooking().getLessonCategory().name() : null);
                        if (attendance.getBooking().getCoach() != null) {
                            map.put("coachId", attendance.getBooking().getCoach().getId());
                            map.put("coachName", attendance.getBooking().getCoach().getName());
                        } else {
                            map.put("coachId", null);
                            map.put("coachName", null);
                        }
                    } else {
                        map.put("purpose", null);
                        map.put("lessonCategory", null);
                        map.put("coachId", null);
                        map.put("coachName", null);
                    }
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

    /**
     * 출석 생성 / 체크인·체크아웃은 AttendanceCheckController로 이전됨 (URL 동일 유지).
     */

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
            Attendance attendance = attendanceRepository.findById(id).orElse(null);
            if (attendance == null) {
                return ResponseEntity.notFound().build();
            }
            // 체크인된 출석 삭제 시: 이용권 1회 복구 + 해당 DEDUCT 히스토리 삭제 (회원 상세 출석 내역에서 삭제해도 롤백되도록)
            if (attendance.getCheckInTime() != null) {
                try {
                    List<MemberProductHistory> historiesWithAttendance =
                        memberProductHistoryRepository.findAllByAttendanceId(id);
                    MemberProduct memberProduct = null;
                    if (!historiesWithAttendance.isEmpty()) {
                        try {
                            memberProduct = historiesWithAttendance.get(0).getMemberProduct();
                        } catch (Exception e) {
                            logger.warn("히스토리에서 MemberProduct 로드 실패: {}", e.getMessage());
                        }
                    }
                    if (memberProduct == null && attendance.getBooking() != null) {
                        try {
                            memberProduct = attendance.getBooking().getMemberProduct();
                        } catch (Exception e) {
                            logger.warn("Booking에서 MemberProduct 로드 실패: {}", e.getMessage());
                        }
                    }
                    if (memberProduct != null) {
                        MemberProduct refreshed = memberProductRepository.findByIdWithMember(memberProduct.getId()).orElse(null);
                        if (refreshed != null) memberProduct = refreshed;
                        Integer totalCount = memberProduct.getTotalCount();
                        if (totalCount == null && memberProduct.getProduct() != null && memberProduct.getProduct().getUsageCount() != null) {
                            totalCount = memberProduct.getProduct().getUsageCount();
                        }
                        boolean hasPackage = memberProduct.getPackageItemsRemaining() != null
                            && !memberProduct.getPackageItemsRemaining().isEmpty();
                        if (hasPackage) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                List<Map<String, Object>> items = mapper.readValue(memberProduct.getPackageItemsRemaining(),
                                    new TypeReference<List<Map<String, Object>>>() {});
                                String itemName = "대관";
                                if (attendance.getBooking() != null && attendance.getBooking().getPurpose() != com.afbscenter.model.Booking.BookingPurpose.RENTAL
                                        && attendance.getBooking().getLessonCategory() != null) {
                                    switch (attendance.getBooking().getLessonCategory()) {
                                        case BASEBALL: itemName = "야구"; break;
                                        case YOUTH_BASEBALL: itemName = "유소년 야구"; break;
                                        case PILATES: itemName = "필라테스"; break;
                                        case TRAINING: itemName = "트레이닝"; break;
                                        default: break;
                                    }
                                }
                                boolean packageItemRestored = false;
                                for (Map<String, Object> item : items) {
                                    String nameStr = item.get("name") != null ? item.get("name").toString() : "";
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
                                        memberProduct.setRemainingCount(sum);
                                        packageItemRestored = true;
                                        break;
                                    }
                                }
                                if (!packageItemRestored) {
                                    Integer cur = memberProduct.getRemainingCount() != null ? memberProduct.getRemainingCount() : 0;
                                    memberProduct.setRemainingCount(totalCount != null ? Math.min(cur + 1, totalCount) : cur + 1);
                                }
                            } catch (Exception e) {
                                logger.warn("출석 삭제 시 패키지 복구 실패, remainingCount만 복구: {}", e.getMessage());
                                Integer cur = memberProduct.getRemainingCount() != null ? memberProduct.getRemainingCount() : 0;
                                memberProduct.setRemainingCount(totalCount != null ? Math.min(cur + 1, totalCount) : cur + 1);
                            }
                        } else {
                            Integer cur = memberProduct.getRemainingCount() != null ? memberProduct.getRemainingCount() : 0;
                            Integer newRemaining = totalCount != null ? Math.min(cur + 1, totalCount) : cur + 1;
                            memberProduct.setRemainingCount(newRemaining);
                        }
                        if (memberProduct.getStatus() == MemberProduct.Status.USED_UP && memberProduct.getRemainingCount() != null && memberProduct.getRemainingCount() > 0) {
                            memberProduct.setStatus(MemberProduct.Status.ACTIVE);
                        }
                        memberProductRepository.save(memberProduct);
                        logger.info("출석 삭제 시 이용권 1회 복구: Attendance ID={}, MemberProduct ID={}, 복구 후 잔여={}회", id, memberProduct.getId(), memberProduct.getRemainingCount());
                    }
                    for (MemberProductHistory h : historiesWithAttendance) {
                        try {
                            memberProductHistoryRepository.deleteById(h.getId());
                        } catch (Exception e) {
                            logger.warn("출석 삭제 시 히스토리 삭제 실패 (무시): {}", e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    logger.error("출석 삭제 시 이용권 복구/히스토리 삭제 실패: Attendance ID={}, 오류: {}", id, e.getMessage(), e);
                }
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

    // 체크인/체크아웃은 AttendanceCheckController로 이전됨 (URL 동일: POST /checkin, POST /checkout)
}
