package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Facility;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 예약 통계·목록 조회 전용 (GET만). URL은 기존과 동일: /api/bookings/stats, /pending, /non-members 등.
 */
@RestController
@RequestMapping("/api/bookings")
public class BookingStatsController {

    private static final Logger logger = LoggerFactory.getLogger(BookingStatsController.class);

    private final BookingRepository bookingRepository;

    public BookingStatsController(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getBookingStats(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String lessonCategory) {
        try {
            LocalDateTime startDate;
            LocalDateTime endDate;
            if (start != null && !start.trim().isEmpty() && end != null && !end.trim().isEmpty()) {
                try {
                    startDate = OffsetDateTime.parse(start).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    endDate = OffsetDateTime.parse(end).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e) {
                    logger.warn("날짜 파싱 실패, 당월 사용: start={}, end={}", start, end);
                    LocalDate now = LocalDate.now();
                    startDate = now.withDayOfMonth(1).atStartOfDay();
                    endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
                }
            } else {
                LocalDate now = LocalDate.now();
                startDate = now.withDayOfMonth(1).atStartOfDay();
                endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
            }

            List<Booking> bookings = bookingRepository.findByDateRange(startDate, endDate);
            java.util.Set<Long> seenIds = new java.util.HashSet<>();
            bookings = bookings.stream()
                    .filter(b -> b.getId() != null && !seenIds.contains(b.getId()) && seenIds.add(b.getId()))
                    .collect(Collectors.toList());

            Booking.Branch branchEnum = null;
            if (branch != null && !branch.trim().isEmpty()) {
                try {
                    branchEnum = Booking.Branch.valueOf(branch.toUpperCase());
                } catch (IllegalArgumentException ignored) { }
            }
            if (branchEnum != null) {
                final Booking.Branch b = branchEnum;
                bookings = bookings.stream().filter(bk -> bk.getBranch() == b).collect(Collectors.toList());
            }
            if (facilityType != null && !facilityType.trim().isEmpty()) {
                try {
                    Facility.FacilityType requestedType = Facility.FacilityType.valueOf(facilityType.toUpperCase());
                    bookings = bookings.stream()
                            .filter(booking -> {
                                if (booking.getFacility() == null) return false;
                                Facility.FacilityType ft = booking.getFacility().getFacilityType();
                                if (ft == requestedType) return true;
                                if (ft == Facility.FacilityType.ALL && booking.getLessonCategory() != null) {
                                    if (requestedType == Facility.FacilityType.BASEBALL)
                                        return booking.getLessonCategory() == LessonCategory.BASEBALL;
                                    if (requestedType == Facility.FacilityType.TRAINING_FITNESS)
                                        return booking.getLessonCategory() == LessonCategory.TRAINING
                                                || booking.getLessonCategory() == LessonCategory.PILATES;
                                }
                                return false;
                            })
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException ignored) { }
            }
            if (lessonCategory != null && !lessonCategory.trim().isEmpty()) {
                try {
                    LessonCategory categoryEnum = LessonCategory.valueOf(lessonCategory.toUpperCase());
                    final LessonCategory finalCategoryEnum = categoryEnum;
                    bookings = bookings.stream()
                            .filter(bk -> bk.getLessonCategory() == finalCategoryEnum)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException ignored) { }
            }

            int year = startDate.getYear();
            int month = startDate.getMonthValue();
            String monthLabel = year + "년 " + month + "월";

            java.util.Map<Long, java.util.Map<String, Object>> coachMap = new java.util.LinkedHashMap<>();
            for (Booking b : bookings) {
                Coach c = b.getCoach();
                final Long key = c != null ? c.getId() : -1L;
                final String name = c != null ? c.getName() : "(미배정)";
                coachMap.computeIfAbsent(key, k -> {
                    java.util.Map<String, Object> m = new HashMap<>();
                    m.put("coachId", key.equals(-1L) ? null : key);
                    m.put("coachName", name);
                    m.put("count", 0);
                    return m;
                });
                java.util.Map<String, Object> m = coachMap.get(key);
                m.put("count", (Integer) m.get("count") + 1);
            }
            List<Map<String, Object>> byCoach = new java.util.ArrayList<>(coachMap.values());
            byCoach.sort((a, b) -> Integer.compare((Integer) b.get("count"), (Integer) a.get("count")));

            int pendingCount = (int) bookings.stream()
                    .filter(b -> b.getStatus() == Booking.BookingStatus.PENDING)
                    .count();

            Map<String, Object> result = new HashMap<>();
            result.put("monthLabel", monthLabel);
            result.put("totalCount", bookings.size());
            result.put("pendingCount", pendingCount);
            result.put("byCoach", byCoach);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("예약 통계 조회 실패: {}", e.getMessage(), e);
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("monthLabel", "");
            fallback.put("totalCount", 0);
            fallback.put("pendingCount", 0);
            fallback.put("byCoach", new java.util.ArrayList<>());
            return ResponseEntity.ok(fallback);
        }
    }

    @GetMapping("/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getPendingBookings(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String lessonCategory,
            @RequestParam(required = false) Long coachId) {
        try {
            LocalDateTime startDate;
            LocalDateTime endDate;
            if (start != null && !start.trim().isEmpty() && end != null && !end.trim().isEmpty()) {
                try {
                    startDate = OffsetDateTime.parse(start).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    endDate = OffsetDateTime.parse(end).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e) {
                    LocalDate now = LocalDate.now();
                    startDate = now.withDayOfMonth(1).atStartOfDay();
                    endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
                }
            } else {
                LocalDate now = LocalDate.now();
                startDate = now.withDayOfMonth(1).atStartOfDay();
                endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
            }

            List<Booking> bookings = bookingRepository.findByDateRange(startDate, endDate);
            java.util.Set<Long> seenIds = new java.util.HashSet<>();
            bookings = bookings.stream()
                    .filter(b -> b.getId() != null && !seenIds.contains(b.getId()) && seenIds.add(b.getId()))
                    .filter(b -> b.getStatus() == Booking.BookingStatus.PENDING)
                    .collect(Collectors.toList());

            Booking.Branch branchEnum = null;
            if (branch != null && !branch.trim().isEmpty()) {
                try {
                    branchEnum = Booking.Branch.valueOf(branch.toUpperCase());
                } catch (IllegalArgumentException ignored) { }
            }
            if (branchEnum != null) {
                final Booking.Branch b = branchEnum;
                bookings = bookings.stream().filter(bk -> bk.getBranch() == b).collect(Collectors.toList());
            }
            if (facilityType != null && !facilityType.trim().isEmpty()) {
                try {
                    Facility.FacilityType requestedType = Facility.FacilityType.valueOf(facilityType.toUpperCase());
                    bookings = bookings.stream()
                            .filter(booking -> {
                                if (booking.getFacility() == null) return false;
                                Facility.FacilityType ft = booking.getFacility().getFacilityType();
                                if (ft == requestedType) return true;
                                if (ft == Facility.FacilityType.ALL && booking.getLessonCategory() != null) {
                                    if (requestedType == Facility.FacilityType.BASEBALL)
                                        return booking.getLessonCategory() == LessonCategory.BASEBALL;
                                    if (requestedType == Facility.FacilityType.TRAINING_FITNESS)
                                        return booking.getLessonCategory() == LessonCategory.TRAINING
                                                || booking.getLessonCategory() == LessonCategory.PILATES;
                                }
                                return false;
                            })
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException ignored) { }
            }
            if (lessonCategory != null && !lessonCategory.trim().isEmpty()) {
                try {
                    LessonCategory categoryEnum = LessonCategory.valueOf(lessonCategory.toUpperCase());
                    final LessonCategory finalCategoryEnum = categoryEnum;
                    bookings = bookings.stream()
                            .filter(bk -> bk.getLessonCategory() == finalCategoryEnum)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException ignored) { }
            }
            if (coachId != null) {
                final Long cid = coachId;
                bookings = bookings.stream()
                        .filter(bk -> bk.getCoach() != null && cid.equals(bk.getCoach().getId()))
                        .collect(Collectors.toList());
            }

            List<Map<String, Object>> resultList = new java.util.ArrayList<>();
            for (Booking b : bookings) {
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId());
                m.put("startTime", b.getStartTime());
                m.put("endTime", b.getEndTime());
                m.put("status", b.getStatus() != null ? b.getStatus().name() : null);
                if (b.getFacility() != null) {
                    Map<String, Object> f = new HashMap<>();
                    f.put("id", b.getFacility().getId());
                    f.put("name", b.getFacility().getName());
                    m.put("facility", f);
                }
                if (b.getMember() != null) {
                    m.put("memberName", b.getMember().getName());
                    m.put("memberNumber", b.getMember().getMemberNumber());
                } else {
                    m.put("memberName", b.getNonMemberName() != null ? b.getNonMemberName() : "-");
                    m.put("memberNumber", null);
                }
                if (b.getCoach() != null) {
                    m.put("coachId", b.getCoach().getId());
                    m.put("coachName", b.getCoach().getName());
                } else {
                    m.put("coachId", null);
                    m.put("coachName", null);
                }
                resultList.add(m);
            }
            resultList.sort((a, b) -> {
                LocalDateTime t1 = (LocalDateTime) a.get("startTime");
                LocalDateTime t2 = (LocalDateTime) b.get("startTime");
                return t1 != null && t2 != null ? t1.compareTo(t2) : 0;
            });
            return ResponseEntity.ok(resultList);
        } catch (Exception e) {
            logger.error("승인 대기 예약 목록 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/non-members")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getNonMemberBookings(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false) String branch) {
        try {
            LocalDateTime startDate;
            LocalDateTime endDate;
            if (start != null && !start.trim().isEmpty() && end != null && !end.trim().isEmpty()) {
                try {
                    startDate = OffsetDateTime.parse(start).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    endDate = OffsetDateTime.parse(end).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e) {
                    LocalDate now = LocalDate.now();
                    startDate = now.withDayOfMonth(1).atStartOfDay();
                    endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
                }
            } else {
                LocalDate now = LocalDate.now();
                startDate = now.withDayOfMonth(1).atStartOfDay();
                endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
            }

            List<Booking> bookings = bookingRepository.findByDateRange(startDate, endDate);
            java.util.Set<Long> seenIds = new java.util.HashSet<>();
            bookings = bookings.stream()
                    .filter(b -> b.getId() != null && !seenIds.contains(b.getId()) && seenIds.add(b.getId()))
                    .filter(b -> b.getMember() == null)
                    .collect(Collectors.toList());

            if (branch != null && !branch.trim().isEmpty()) {
                try {
                    Booking.Branch branchEnum = Booking.Branch.valueOf(branch.toUpperCase());
                    final Booking.Branch be = branchEnum;
                    bookings = bookings.stream().filter(b -> b.getBranch() == be).collect(Collectors.toList());
                } catch (IllegalArgumentException ignored) { }
            }

            List<Map<String, Object>> resultList = new java.util.ArrayList<>();
            for (Booking b : bookings) {
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId());
                m.put("startTime", b.getStartTime());
                m.put("endTime", b.getEndTime());
                m.put("status", b.getStatus() != null ? b.getStatus().name() : null);
                m.put("branch", b.getBranch() != null ? b.getBranch().name() : null);
                m.put("nonMemberName", b.getNonMemberName());
                m.put("nonMemberPhone", b.getNonMemberPhone());
                if (b.getFacility() != null) {
                    Map<String, Object> f = new HashMap<>();
                    f.put("id", b.getFacility().getId());
                    f.put("name", b.getFacility().getName());
                    m.put("facility", f);
                }
                if (b.getCoach() != null) {
                    m.put("coachName", b.getCoach().getName());
                } else {
                    m.put("coachName", null);
                }
                resultList.add(m);
            }
            resultList.sort((a, b) -> {
                LocalDateTime t1 = (LocalDateTime) a.get("startTime");
                LocalDateTime t2 = (LocalDateTime) b.get("startTime");
                return t1 != null && t2 != null ? t1.compareTo(t2) : 0;
            });
            return ResponseEntity.ok(resultList);
        } catch (Exception e) {
            logger.error("비회원 예약 목록 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/pending/rentals")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getPendingRentalBookings(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        try {
            LocalDateTime startDate;
            LocalDateTime endDate;
            if (start != null && !start.trim().isEmpty() && end != null && !end.trim().isEmpty()) {
                try {
                    startDate = OffsetDateTime.parse(start).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    endDate = OffsetDateTime.parse(end).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e) {
                    LocalDate now = LocalDate.now();
                    startDate = now.withDayOfMonth(1).atStartOfDay();
                    endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
                }
            } else {
                LocalDate now = LocalDate.now();
                startDate = now.withDayOfMonth(1).atStartOfDay();
                endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
            }

            List<Booking> bookings = bookingRepository.findByDateRange(startDate, endDate);
            java.util.Set<Long> seenIds = new java.util.HashSet<>();
            bookings = bookings.stream()
                    .filter(b -> b.getId() != null && !seenIds.contains(b.getId()) && seenIds.add(b.getId()))
                    .filter(b -> b.getPurpose() == Booking.BookingPurpose.RENTAL)
                    .filter(b -> b.getStatus() == Booking.BookingStatus.PENDING)
                    .collect(Collectors.toList());

            List<Map<String, Object>> resultList = new java.util.ArrayList<>();
            for (Booking b : bookings) {
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId());
                m.put("startTime", b.getStartTime());
                m.put("endTime", b.getEndTime());
                if (b.getFacility() != null) {
                    Map<String, Object> f = new HashMap<>();
                    f.put("id", b.getFacility().getId());
                    f.put("name", b.getFacility().getName());
                    if (b.getFacility().getBranch() != null) f.put("branch", b.getFacility().getBranch().name());
                    m.put("facility", f);
                }
                if (b.getMember() != null) {
                    m.put("memberName", b.getMember().getName());
                    m.put("memberNumber", b.getMember().getMemberNumber());
                } else {
                    m.put("memberName", b.getNonMemberName() != null ? b.getNonMemberName() : "-");
                    m.put("memberNumber", null);
                }
                if (b.getCoach() != null) {
                    m.put("coachId", b.getCoach().getId());
                    m.put("coachName", b.getCoach().getName());
                } else {
                    m.put("coachId", null);
                    m.put("coachName", null);
                }
                m.put("branch", b.getBranch() != null ? b.getBranch().name() : null);
                resultList.add(m);
            }
            resultList.sort((a, b) -> {
                LocalDateTime t1 = (LocalDateTime) a.get("startTime");
                LocalDateTime t2 = (LocalDateTime) b.get("startTime");
                return t1 != null && t2 != null ? t1.compareTo(t2) : 0;
            });
            return ResponseEntity.ok(resultList);
        } catch (Exception e) {
            logger.error("승인 대기 대관 목록 조회 실패: {}", e.getMessage(), e);
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/stats/rentals")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getRentalStats(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        try {
            LocalDateTime startDate;
            LocalDateTime endDate;
            if (start != null && !start.trim().isEmpty() && end != null && !end.trim().isEmpty()) {
                try {
                    startDate = OffsetDateTime.parse(start).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                    endDate = OffsetDateTime.parse(end).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
                } catch (Exception e) {
                    LocalDate now = LocalDate.now();
                    startDate = now.withDayOfMonth(1).atStartOfDay();
                    endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
                }
            } else {
                LocalDate now = LocalDate.now();
                startDate = now.withDayOfMonth(1).atStartOfDay();
                endDate = now.plusMonths(1).withDayOfMonth(1).atTime(23, 59, 59).minusNanos(1);
            }

            List<Booking> bookings = bookingRepository.findByDateRange(startDate, endDate);
            java.util.Set<Long> seenIds = new java.util.HashSet<>();
            bookings = bookings.stream()
                    .filter(b -> b.getId() != null && !seenIds.contains(b.getId()) && seenIds.add(b.getId()))
                    .filter(b -> b.getPurpose() == Booking.BookingPurpose.RENTAL)
                    .collect(Collectors.toList());

            int year = startDate.getYear();
            int month = startDate.getMonthValue();
            String monthLabel = year + "년 " + month + "월";

            java.util.Map<Booking.Branch, Integer> branchCounts = new java.util.LinkedHashMap<>();
            java.util.Map<Booking.Branch, Integer> branchConfirmedCounts = new java.util.LinkedHashMap<>();
            java.util.Map<Booking.Branch, Integer> branchPendingCounts = new java.util.LinkedHashMap<>();
            branchCounts.put(Booking.Branch.SAHA, 0);
            branchCounts.put(Booking.Branch.YEONSAN, 0);
            branchConfirmedCounts.put(Booking.Branch.SAHA, 0);
            branchConfirmedCounts.put(Booking.Branch.YEONSAN, 0);
            branchPendingCounts.put(Booking.Branch.SAHA, 0);
            branchPendingCounts.put(Booking.Branch.YEONSAN, 0);
            for (Booking b : bookings) {
                Booking.Branch br = b.getBranch();
                if (br == null || br == Booking.Branch.RENTAL) {
                    if (b.getFacility() != null && b.getFacility().getBranch() != null) {
                        Facility.Branch fb = b.getFacility().getBranch();
                        if (fb == Facility.Branch.SAHA || fb == Facility.Branch.YEONSAN) {
                            br = Booking.Branch.valueOf(fb.name());
                        }
                    }
                }
                if (br != null && br != Booking.Branch.RENTAL && branchCounts.containsKey(br)) {
                    branchCounts.put(br, branchCounts.get(br) + 1);
                    if (b.getStatus() == Booking.BookingStatus.CONFIRMED) {
                        branchConfirmedCounts.put(br, branchConfirmedCounts.get(br) + 1);
                    } else if (b.getStatus() == Booking.BookingStatus.PENDING) {
                        branchPendingCounts.put(br, branchPendingCounts.get(br) + 1);
                    }
                }
            }
            int totalConfirmed = (int) bookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.CONFIRMED).count();
            int totalPending = (int) bookings.stream().filter(b -> b.getStatus() == Booking.BookingStatus.PENDING).count();

            java.util.Map<String, String> branchNames = new HashMap<>();
            branchNames.put("SAHA", "사하점");
            branchNames.put("YEONSAN", "연산점");
            List<Map<String, Object>> byBranch = new java.util.ArrayList<>();
            for (java.util.Map.Entry<Booking.Branch, Integer> e : branchCounts.entrySet()) {
                Map<String, Object> m = new HashMap<>();
                m.put("branch", e.getKey().name());
                m.put("branchName", branchNames.getOrDefault(e.getKey().name(), e.getKey().name()));
                m.put("count", e.getValue());
                m.put("confirmedCount", branchConfirmedCounts.getOrDefault(e.getKey(), 0));
                m.put("pendingCount", branchPendingCounts.getOrDefault(e.getKey(), 0));
                byBranch.add(m);
            }
            byBranch.sort((a, b) -> Integer.compare((Integer) b.get("count"), (Integer) a.get("count")));

            Map<String, Object> result = new HashMap<>();
            result.put("monthLabel", monthLabel);
            result.put("totalCount", bookings.size());
            result.put("totalConfirmedCount", totalConfirmed);
            result.put("totalPendingCount", totalPending);
            result.put("byBranch", byBranch);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("대관 통계 조회 실패: {}", e.getMessage(), e);
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("monthLabel", "");
            fallback.put("totalCount", 0);
            fallback.put("totalConfirmedCount", 0);
            fallback.put("totalPendingCount", 0);
            fallback.put("byBranch", new java.util.ArrayList<>());
            return ResponseEntity.ok(fallback);
        }
    }

    @GetMapping("/without-member-product")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getBookingsWithoutMemberProduct() {
        try {
            List<Booking> list = bookingRepository.findByMemberNotNullAndMemberProductNull();
            List<Map<String, Object>> result = new java.util.ArrayList<>();
            for (Booking b : list) {
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId());
                m.put("startTime", b.getStartTime());
                m.put("endTime", b.getEndTime());
                m.put("status", b.getStatus() != null ? b.getStatus().name() : null);
                m.put("purpose", b.getPurpose() != null ? b.getPurpose().name() : null);
                if (b.getFacility() != null) {
                    Map<String, Object> f = new HashMap<>();
                    f.put("id", b.getFacility().getId());
                    f.put("name", b.getFacility().getName());
                    if (b.getFacility().getBranch() != null) f.put("branch", b.getFacility().getBranch().name());
                    if (b.getFacility().getFacilityType() != null) f.put("facilityType", b.getFacility().getFacilityType().name());
                    m.put("facility", f);
                }
                if (b.getMember() != null) {
                    Map<String, Object> mem = new HashMap<>();
                    mem.put("id", b.getMember().getId());
                    mem.put("memberNumber", b.getMember().getMemberNumber());
                    mem.put("name", b.getMember().getName());
                    mem.put("phoneNumber", b.getMember().getPhoneNumber());
                    m.put("member", mem);
                }
                if (b.getCoach() != null) {
                    Map<String, Object> c = new HashMap<>();
                    c.put("id", b.getCoach().getId());
                    c.put("name", b.getCoach().getName());
                    m.put("coach", c);
                }
                m.put("memberProduct", null);
                result.add(m);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("이용권 미연결 예약 목록 조회 실패", e);
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
