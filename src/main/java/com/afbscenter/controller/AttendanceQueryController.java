package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.Booking;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.TrainingLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.stream.Collectors;

/**
 * 출석 조회 전용 (체크인 목록, 체크인 미처리 예약). URL은 기존과 동일: /api/attendance/checked-in, /unchecked-bookings
 */
@RestController
@RequestMapping("/api/attendance")
public class AttendanceQueryController {

    private static final Logger logger = LoggerFactory.getLogger(AttendanceQueryController.class);

    private final AttendanceRepository attendanceRepository;
    private final BookingRepository bookingRepository;
    private final TrainingLogRepository trainingLogRepository;

    public AttendanceQueryController(AttendanceRepository attendanceRepository,
                                     BookingRepository bookingRepository,
                                     TrainingLogRepository trainingLogRepository) {
        this.attendanceRepository = attendanceRepository;
        this.bookingRepository = bookingRepository;
        this.trainingLogRepository = trainingLogRepository;
    }

    @GetMapping("/checked-in")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getCheckedInAttendances(
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
                return ResponseEntity.ok(new ArrayList<>());
            }

            if (attendances == null) {
                attendances = new ArrayList<>();
            }

            LocalDateTime now = LocalDateTime.now();
            List<Attendance> filteredAttendances = new ArrayList<>();
            for (Attendance attendance : attendances) {
                try {
                    boolean isTrainingCompleted = false;
                    try {
                        Booking booking = attendance.getBooking();
                        if (booking != null) {
                            try {
                                if (booking.getEndTime() != null && booking.getEndTime().isBefore(now)) {
                                    isTrainingCompleted = true;
                                } else {
                                    try {
                                        if (booking.getStatus() == Booking.BookingStatus.COMPLETED) {
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
                            if (attendance.getCheckInTime() != null && attendance.getCheckInTime().isBefore(now)) {
                                isTrainingCompleted = true;
                            }
                        }
                    } catch (Exception e) {
                        logger.warn("예약 정보 확인 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                        if (attendance.getCheckInTime() != null && attendance.getCheckInTime().isBefore(now)) {
                            isTrainingCompleted = true;
                        }
                    }

                    if (!isTrainingCompleted) {
                        continue;
                    }

                    if (attendance.getMember() == null) {
                        filteredAttendances.add(attendance);
                        continue;
                    }

                    LocalDate attendanceDate = attendance.getDate();
                    try {
                        Booking booking = attendance.getBooking();
                        if (booking != null && booking.getStartTime() != null) {
                            attendanceDate = booking.getStartTime().toLocalDate();
                        }
                    } catch (Exception e) {
                        logger.warn("출석 기록 날짜 읽기 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                    }
                    final LocalDate finalAttendanceDate = attendanceDate;

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
                    }

                    if (!hasTrainingLog) {
                        filteredAttendances.add(attendance);
                    }
                } catch (Exception e) {
                    logger.warn("출석 기록 필터링 실패 (Attendance ID: {}): {}", attendance.getId(), e.getMessage());
                }
            }

            List<Map<String, Object>> result = new ArrayList<>();
            for (Attendance attendance : filteredAttendances) {
                try {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", attendance.getId());
                    map.put("date", attendance.getDate());
                    map.put("checkInTime", attendance.getCheckInTime());
                    map.put("checkOutTime", attendance.getCheckOutTime());
                    map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);

                    if (attendance.getMember() != null) {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", attendance.getMember().getId());
                        memberMap.put("name", attendance.getMember().getName());
                        map.put("member", memberMap);
                    } else {
                        map.put("member", null);
                    }

                    if (attendance.getFacility() != null) {
                        Map<String, Object> facilityMap = new HashMap<>();
                        facilityMap.put("id", attendance.getFacility().getId());
                        facilityMap.put("name", attendance.getFacility().getName());
                        map.put("facility", facilityMap);
                    } else {
                        map.put("facility", null);
                    }

                    try {
                        Booking booking = attendance.getBooking();
                        if (booking != null) {
                            Map<String, Object> bookingMap = new HashMap<>();
                            try {
                                bookingMap.put("id", booking.getId());
                                bookingMap.put("startTime", booking.getStartTime());
                                bookingMap.put("endTime", booking.getEndTime());
                                bookingMap.put("purpose", booking.getPurpose() != null ? booking.getPurpose().name() : null);
                                bookingMap.put("lessonCategory", booking.getLessonCategory() != null ? booking.getLessonCategory().name() : null);
                                if (booking.getCoach() != null) {
                                    Map<String, Object> coachMap = new HashMap<>();
                                    coachMap.put("id", booking.getCoach().getId());
                                    coachMap.put("name", booking.getCoach().getName());
                                    coachMap.put("specialties", booking.getCoach().getSpecialties());
                                    bookingMap.put("coach", coachMap);
                                } else {
                                    bookingMap.put("coach", null);
                                }
                                if (booking.getMemberProduct() != null) {
                                    com.afbscenter.model.MemberProduct memberProduct = booking.getMemberProduct();
                                    Map<String, Object> memberProductMap = new HashMap<>();
                                    memberProductMap.put("id", memberProduct.getId());
                                    if (memberProduct.getProduct() != null) {
                                        Map<String, Object> productMap = new HashMap<>();
                                        productMap.put("id", memberProduct.getProduct().getId());
                                        productMap.put("name", memberProduct.getProduct().getName());
                                        productMap.put("type", memberProduct.getProduct().getType() != null ? memberProduct.getProduct().getType().name() : null);
                                        memberProductMap.put("product", productMap);
                                    }
                                    if (memberProduct.getCoach() != null) {
                                        Map<String, Object> memberProductCoachMap = new HashMap<>();
                                        memberProductCoachMap.put("id", memberProduct.getCoach().getId());
                                        memberProductCoachMap.put("name", memberProduct.getCoach().getName());
                                        memberProductMap.put("coach", memberProductCoachMap);
                                    } else if (memberProduct.getProduct() != null && memberProduct.getProduct().getCoach() != null) {
                                        Map<String, Object> memberProductCoachMap = new HashMap<>();
                                        memberProductCoachMap.put("id", memberProduct.getProduct().getCoach().getId());
                                        memberProductCoachMap.put("name", memberProduct.getProduct().getCoach().getName());
                                        memberProductMap.put("coach", memberProductCoachMap);
                                    }
                                    bookingMap.put("memberProduct", memberProductMap);
                                } else {
                                    bookingMap.put("memberProduct", null);
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
                }
            }

            logger.info("체크인된 출석 기록 조회 완료: {}건", result.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("체크인된 출석 기록 조회 중 오류 발생: {}", e.getMessage(), e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    @GetMapping("/unchecked-bookings")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getUncheckedBookings() {
        try {
            java.time.LocalDate today = java.time.LocalDate.now();

            List<Booking> confirmedBookings = bookingRepository.findByStatus(Booking.BookingStatus.CONFIRMED);
            List<Booking> completedBookings = bookingRepository.findByStatus(Booking.BookingStatus.COMPLETED);

            List<Booking> allBookings = new ArrayList<>();
            allBookings.addAll(confirmedBookings);
            allBookings.addAll(completedBookings);

            final java.time.LocalDate finalToday = today;
            allBookings = allBookings.stream()
                    .filter(booking -> {
                        if (booking.getStartTime() == null) return false;
                        java.time.LocalDate bookingDate = booking.getStartTime().toLocalDate();
                        return !bookingDate.isAfter(finalToday);
                    })
                    .collect(Collectors.toList());

            logger.debug("체크인 미처리 예약 조회: 전체 {}건 중 오늘·과거 {}건",
                    confirmedBookings.size() + completedBookings.size(), allBookings.size());

            List<Long> bookingIdsWithAttendance = attendanceRepository.findDistinctBookingIds();
            final Set<Long> finalBookingsWithAttendance = new HashSet<>(bookingIdsWithAttendance != null ? bookingIdsWithAttendance : List.of());
            List<Booking> uncheckedBookings = allBookings.stream()
                    .filter(booking -> booking.getMember() != null) // 비회원 예약 제외 (체크인 버튼 미사용)
                    .filter(booking -> !finalBookingsWithAttendance.contains(booking.getId()))
                    .sorted((a, b) -> {
                        if (a.getStartTime() == null && b.getStartTime() == null) return 0;
                        if (a.getStartTime() == null) return 1;
                        if (b.getStartTime() == null) return -1;
                        return b.getStartTime().compareTo(a.getStartTime());
                    })
                    .collect(Collectors.toList());

            List<Map<String, Object>> result = uncheckedBookings.stream().map(booking -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", booking.getId());
                map.put("startTime", booking.getStartTime());
                map.put("endTime", booking.getEndTime());
                map.put("participants", booking.getParticipants());
                map.put("status", booking.getStatus() != null ? booking.getStatus().name() : null);
                map.put("purpose", booking.getPurpose() != null ? booking.getPurpose().name() : null);
                map.put("lessonCategory", booking.getLessonCategory() != null ? booking.getLessonCategory().name() : null);

                if (booking.getFacility() != null) {
                    Map<String, Object> facilityMap = new HashMap<>();
                    facilityMap.put("id", booking.getFacility().getId());
                    facilityMap.put("name", booking.getFacility().getName());
                    map.put("facility", facilityMap);
                } else {
                    map.put("facility", null);
                }

                if (booking.getCoach() != null) {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", booking.getCoach().getId());
                    coachMap.put("name", booking.getCoach().getName());
                    map.put("coach", coachMap);
                } else {
                    map.put("coach", null);
                }

                if (booking.getMember() != null) {
                    Map<String, Object> memberMap = new HashMap<>();
                    memberMap.put("id", booking.getMember().getId());
                    memberMap.put("name", booking.getMember().getName());
                    memberMap.put("memberNumber", booking.getMember().getMemberNumber());
                    map.put("member", memberMap);
                } else {
                    map.put("member", null);
                    map.put("nonMemberName", booking.getNonMemberName());
                    map.put("nonMemberPhone", booking.getNonMemberPhone());
                }

                return map;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("체크인 미처리 예약 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
