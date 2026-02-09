package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.BookingAuditLog;
import com.afbscenter.model.Coach;
import com.afbscenter.repository.BookingAuditLogRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.util.LessonCategoryUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bookings")
public class BookingAdminController {

    private static final Logger logger = LoggerFactory.getLogger(BookingAdminController.class);

    private final BookingRepository bookingRepository;
    private final MemberProductRepository memberProductRepository;
    private final BookingAuditLogRepository bookingAuditLogRepository;
    private final JdbcTemplate jdbcTemplate;
    private final CoachRepository coachRepository;

    public BookingAdminController(BookingRepository bookingRepository,
                                  MemberProductRepository memberProductRepository,
                                  BookingAuditLogRepository bookingAuditLogRepository,
                                  JdbcTemplate jdbcTemplate,
                                  CoachRepository coachRepository) {
        this.bookingRepository = bookingRepository;
        this.memberProductRepository = memberProductRepository;
        this.bookingAuditLogRepository = bookingAuditLogRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.coachRepository = coachRepository;
    }

    /** 선택 예약 일괄 확정(승인) - 관리자만 가능, DB 로그 저장 */
    @PostMapping("/bulk-confirm")
    @Transactional
    public ResponseEntity<Map<String, Object>> bulkConfirmBookings(@RequestBody Map<String, Object> body,
                                                                   HttpServletRequest request) {
        Map<String, Object> response = new HashMap<>();
        try {
            String role = (String) request.getAttribute("role");
            if (role == null || !role.equals("ADMIN")) {
                logger.warn("일괄 승인 권한 없음: role={}", role);
                response.put("status", "error");
                response.put("message", "일괄 승인은 관리자만 사용할 수 있습니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
            }

            @SuppressWarnings("unchecked")
            List<Number> idList = (List<Number>) body.get("bookingIds");
            if (idList == null || idList.isEmpty()) {
                response.put("status", "error");
                response.put("message", "bookingIds가 비어 있습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            int updated = 0;
            for (Number n : idList) {
                Long id = n.longValue();
                Booking booking = bookingRepository.findById(id).orElse(null);
                if (booking != null && booking.getStatus() == Booking.BookingStatus.PENDING) {
                    booking.setStatus(Booking.BookingStatus.CONFIRMED);
                    if (booking.getMember() != null && booking.getMemberProduct() == null
                            && booking.getPurpose() == Booking.BookingPurpose.LESSON) {
                        try {
                            List<com.afbscenter.model.MemberProduct> activeCountPass =
                                    memberProductRepository.findActiveCountPassByMemberId(booking.getMember().getId());
                            if (!activeCountPass.isEmpty()) {
                                booking.setMemberProduct(activeCountPass.get(0));
                            }
                        } catch (Exception e) {
                            logger.warn("확정 시 상품 자동 할당 실패: bookingId={}", id, e);
                        }
                    }
                    bookingRepository.save(booking);
                    updated++;
                }
            }

            String username = (String) request.getAttribute("username");
            Map<String, Object> logDetails = new HashMap<>();
            logDetails.put("bookingIds", idList.stream().map(Number::longValue).collect(Collectors.toList()));
            logDetails.put("updatedCount", updated);
            try {
                String detailsJson = new ObjectMapper().writeValueAsString(logDetails);
                BookingAuditLog auditLog = BookingAuditLog.of(username, "BULK_CONFIRM", detailsJson);
                bookingAuditLogRepository.save(auditLog);
            } catch (Exception e) {
                logger.warn("일괄 승인 감사 로그 저장 실패: {}", e.getMessage());
            }

            response.put("status", "success");
            response.put("updatedCount", updated);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("일괄 확정 실패: {}", e.getMessage(), e);
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

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
                        com.afbscenter.model.LessonCategory category = LessonCategoryUtil.fromCoachSpecialties(coach);
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

    @PostMapping("/reorder")
    @Transactional
    public ResponseEntity<Map<String, String>> reorderBookingIdsByDateEndpoint() {
        try {
            reorderBookingIdsByDate();
            Map<String, String> response = new HashMap<>();
            response.put("message", "예약 시퀀스가 조정되었습니다. (H2 제약으로 인해 실제 ID 재정렬은 불가능합니다)");
            response.put("status", "success");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("예약 시퀀스 조정 중 오류 발생", e);
            Map<String, String> response = new HashMap<>();
            response.put("message", "예약 시퀀스 조정 중 오류가 발생했습니다: " + e.getMessage());
            response.put("status", "error");
            return ResponseEntity.ok(response);
        }
    }

    private void reorderBookingIdsByDate() {
        try {
            List<Booking> bookings = bookingRepository.findAll();
            if (bookings.isEmpty()) {
                resetBookingSequence(1);
                return;
            }
            long maxId = bookings.stream()
                    .mapToLong(Booking::getId)
                    .max()
                    .orElse(0L);
            long nextId = maxId + 1;
            resetBookingSequence(nextId);
            logger.info("예약 시퀀스가 {}로 설정되었습니다. (총 {}개 예약)", nextId, bookings.size());
        } catch (Exception e) {
            logger.error("예약 시퀀스 리셋 중 오류 발생", e);
        }
    }

    private void resetBookingSequence(long nextValue) {
        try {
            if (nextValue < 1) {
                logger.warn("잘못된 시퀀스 값: {}", nextValue);
                return;
            }
            String sql = "ALTER TABLE bookings ALTER COLUMN id RESTART WITH " + nextValue;
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            logger.warn("예약 시퀀스 리셋 실패: {}", e.getMessage());
        }
    }
}
