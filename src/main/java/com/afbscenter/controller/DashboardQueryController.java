package com.afbscenter.controller;

import com.afbscenter.model.Announcement;
import com.afbscenter.model.Booking;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AnnouncementRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.util.LessonCategoryUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardQueryController {

    private static final Logger logger = LoggerFactory.getLogger(DashboardQueryController.class);

    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final CoachRepository coachRepository;
    private final AnnouncementRepository announcementRepository;

    public DashboardQueryController(BookingRepository bookingRepository,
                                    AttendanceRepository attendanceRepository,
                                    MemberRepository memberRepository,
                                    MemberProductRepository memberProductRepository,
                                    CoachRepository coachRepository,
                                    AnnouncementRepository announcementRepository) {
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.coachRepository = coachRepository;
        this.announcementRepository = announcementRepository;
    }

    @GetMapping("/expiring-members")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getExpiringMembers() {
        try {
            LocalDate today = LocalDate.now();
            LocalDate expiryThreshold = today.plusDays(7);
            List<com.afbscenter.model.Member> allMembers = memberRepository.findAll();
            List<Map<String, Object>> expiringMembersList = new ArrayList<>();
            List<Map<String, Object>> expiredMembersList = new ArrayList<>();
            List<Map<String, Object>> noProductMembersList = new ArrayList<>();

            for (com.afbscenter.model.Member member : allMembers) {
                try {
                    List<MemberProduct> activeProducts = memberProductRepository.findByMemberIdAndStatus(member.getId(), MemberProduct.Status.ACTIVE);
                    List<MemberProduct> expiredMemberProducts = memberProductRepository.findByMemberIdAndStatus(member.getId(), MemberProduct.Status.EXPIRED);
                    List<MemberProduct> usedUpMemberProducts = memberProductRepository.findByMemberIdAndStatus(member.getId(), MemberProduct.Status.USED_UP);
                    List<MemberProduct> allMemberProducts = memberProductRepository.findByMemberIdWithProduct(member.getId());

                    boolean isExpiring = false;
                    List<Map<String, Object>> expiringProducts = new ArrayList<>();
                    boolean isExpired = false;
                    List<Map<String, Object>> expiredProducts = new ArrayList<>();

                    for (MemberProduct mp : activeProducts) {
                        try {
                            Map<String, Object> productInfo = new HashMap<>();
                            boolean productExpiring = false;
                            String expiryReason = "";
                            if (mp.getProduct() != null && mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
                                Integer remainingCount = mp.getRemainingCount();
                                if (remainingCount == null) {
                                    Integer totalCount = mp.getTotalCount();
                                    if (totalCount == null || totalCount <= 0) {
                                        totalCount = mp.getProduct().getUsageCount();
                                        if (totalCount == null || totalCount <= 0)
                                            totalCount = com.afbscenter.constants.ProductDefaults.getDefaultTotalCount();
                                    }
                                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                                    if (usedCountByBooking == null) usedCountByBooking = 0L;
                                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
                                    if (usedCountByAttendance == null) usedCountByAttendance = 0L;
                                    Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                                    remainingCount = totalCount - actualUsedCount.intValue();
                                    if (remainingCount < 0) remainingCount = 0;
                                }
                                if (remainingCount != null && remainingCount <= 3 && remainingCount > 0) {
                                    productExpiring = true;
                                    expiryReason = "남은 횟수: " + remainingCount + "회";
                                    productInfo.put("remainingCount", remainingCount);
                                }
                            }
                            if (mp.getProduct() != null && mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS && mp.getExpiryDate() != null) {
                                if (!mp.getExpiryDate().isBefore(today) && !mp.getExpiryDate().isAfter(expiryThreshold)) {
                                    productExpiring = true;
                                    long daysUntilExpiry = java.time.temporal.ChronoUnit.DAYS.between(today, mp.getExpiryDate());
                                    expiryReason = daysUntilExpiry == 0 ? "오늘 만료" : (daysUntilExpiry == 1 ? "내일 만료" : "만료까지 " + daysUntilExpiry + "일");
                                    productInfo.put("expiryDate", mp.getExpiryDate().toString());
                                    productInfo.put("daysUntilExpiry", daysUntilExpiry);
                                }
                            }
                            if (productExpiring) {
                                isExpiring = true;
                                productInfo.put("id", mp.getId());
                                productInfo.put("productName", mp.getProduct() != null ? mp.getProduct().getName() : "알 수 없음");
                                productInfo.put("productType", mp.getProduct() != null ? mp.getProduct().getType().toString() : "");
                                productInfo.put("expiryReason", expiryReason);
                                expiringProducts.add(productInfo);
                            }
                        } catch (Exception e) {
                            logger.debug("MemberProduct 만료 확인 실패: MemberProduct ID={}", mp.getId(), e.getMessage());
                        }
                    }

                    if (allMemberProducts == null || allMemberProducts.isEmpty()) {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", member.getId());
                        memberMap.put("memberNumber", member.getMemberNumber());
                        memberMap.put("name", member.getName());
                        memberMap.put("phoneNumber", member.getPhoneNumber());
                        memberMap.put("grade", member.getGrade());
                        memberMap.put("school", member.getSchool());
                        List<Map<String, Object>> noProducts = new ArrayList<>();
                        Map<String, Object> pi = new HashMap<>();
                        pi.put("id", null);
                        pi.put("productName", "이용권 없음");
                        pi.put("productType", "NONE");
                        pi.put("expiryReason", "등록된 이용권이 없습니다");
                        pi.put("status", "NO_PRODUCT");
                        noProducts.add(pi);
                        memberMap.put("expiredProducts", noProducts);
                        noProductMembersList.add(memberMap);
                    } else {
                        if (!usedUpMemberProducts.isEmpty()) {
                            for (MemberProduct mp : usedUpMemberProducts) {
                                try {
                                    if (mp.getProduct() == null) continue;
                                    Map<String, Object> productInfo = new HashMap<>();
                                    String expiryReason = mp.getProduct().getType() == Product.ProductType.COUNT_PASS ? "횟수 소진" : "만료됨";
                                    if (mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS && mp.getExpiryDate() != null) {
                                        long d = java.time.temporal.ChronoUnit.DAYS.between(mp.getExpiryDate(), today);
                                        expiryReason = d == 0 ? "오늘 만료됨" : (d > 0 ? d + "일 전 만료됨" : "만료됨");
                                    }
                                    isExpired = true;
                                    productInfo.put("id", mp.getId());
                                    productInfo.put("productName", mp.getProduct().getName());
                                    productInfo.put("productType", mp.getProduct().getType().toString());
                                    productInfo.put("expiryReason", expiryReason);
                                    productInfo.put("status", mp.getStatus() != null ? mp.getStatus().toString() : "");
                                    expiredProducts.add(productInfo);
                                } catch (Exception e) {
                                    logger.warn("MemberProduct 종료 확인 실패: MemberProduct ID={}", mp.getId(), e.getMessage());
                                }
                            }
                        }
                        if (activeProducts == null || activeProducts.isEmpty()) {
                            if (!expiredMemberProducts.isEmpty()) {
                                for (MemberProduct mp : expiredMemberProducts) {
                                    try {
                                        if (mp.getProduct() == null) continue;
                                        Map<String, Object> productInfo = new HashMap<>();
                                        String expiryReason = mp.getProduct().getType() == Product.ProductType.COUNT_PASS ? "횟수 소진" : "만료됨";
                                        if (mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS && mp.getExpiryDate() != null) {
                                            long d = java.time.temporal.ChronoUnit.DAYS.between(mp.getExpiryDate(), today);
                                            expiryReason = d == 0 ? "오늘 만료됨" : (d > 0 ? d + "일 전 만료됨" : "만료됨");
                                        }
                                        isExpired = true;
                                        productInfo.put("id", mp.getId());
                                        productInfo.put("productName", mp.getProduct().getName());
                                        productInfo.put("productType", mp.getProduct().getType().toString());
                                        productInfo.put("expiryReason", expiryReason);
                                        productInfo.put("status", mp.getStatus() != null ? mp.getStatus().toString() : "");
                                        expiredProducts.add(productInfo);
                                    } catch (Exception e) {
                                        logger.warn("MemberProduct 종료 확인 실패: MemberProduct ID={}", mp.getId(), e.getMessage());
                                    }
                                }
                            }
                            if (expiredProducts.isEmpty() && usedUpMemberProducts.isEmpty() && expiredMemberProducts.isEmpty()) {
                                isExpired = true;
                                Map<String, Object> pi = new HashMap<>();
                                pi.put("id", null);
                                pi.put("productName", "활성 이용권 없음");
                                pi.put("productType", "NONE");
                                pi.put("expiryReason", "활성 상태의 이용권이 없습니다");
                                pi.put("status", "NO_ACTIVE");
                                expiredProducts.add(pi);
                            }
                        }
                        if (!isExpired && (activeProducts == null || activeProducts.isEmpty()) && !allMemberProducts.isEmpty()) {
                            isExpired = true;
                            if (expiredProducts.isEmpty()) {
                                Map<String, Object> pi = new HashMap<>();
                                pi.put("id", null);
                                pi.put("productName", "활성 이용권 없음");
                                pi.put("productType", "NONE");
                                pi.put("expiryReason", "활성 상태의 이용권이 없습니다");
                                pi.put("status", "NO_ACTIVE");
                                expiredProducts.add(pi);
                            }
                        }
                    }

                    if (isExpiring) {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", member.getId());
                        memberMap.put("memberNumber", member.getMemberNumber());
                        memberMap.put("name", member.getName());
                        memberMap.put("phoneNumber", member.getPhoneNumber());
                        memberMap.put("grade", member.getGrade());
                        memberMap.put("school", member.getSchool());
                        memberMap.put("expiringProducts", expiringProducts);
                        expiringMembersList.add(memberMap);
                    }
                    if (isExpired) {
                        Map<String, Object> memberMap = new HashMap<>();
                        memberMap.put("id", member.getId());
                        memberMap.put("memberNumber", member.getMemberNumber());
                        memberMap.put("name", member.getName());
                        memberMap.put("phoneNumber", member.getPhoneNumber());
                        memberMap.put("grade", member.getGrade());
                        memberMap.put("school", member.getSchool());
                        memberMap.put("expiredProducts", expiredProducts);
                        expiredMembersList.add(memberMap);
                    }
                } catch (Exception e) {
                    logger.debug("회원 만료 확인 실패: Member ID={}", member.getId(), e.getMessage());
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("expiring", expiringMembersList);
            result.put("expired", expiredMembersList);
            result.put("noProduct", noProductMembersList);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("만료 임박 및 종료 회원 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @Transactional
    void updateMissingLessonCategoriesForBookings(List<Booking> bookings) {
        try {
            for (Booking booking : bookings) {
                if (booking.getPurpose() == Booking.BookingPurpose.LESSON && booking.getLessonCategory() == null) {
                    com.afbscenter.model.Coach coach = booking.getCoach();
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
            logger.warn("레슨 카테고리 자동 업데이트 실패: {}", e.getMessage(), e);
        }
    }

    @GetMapping("/today-schedule")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getTodaySchedule() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);
        LocalDateTime now = LocalDateTime.now();

        List<Booking> bookings = bookingRepository.findByDateRange(startOfDay, endOfDay);
        updateMissingLessonCategoriesForBookings(bookings);

        for (Booking booking : bookings) {
            if (booking.getEndTime() != null
                    && booking.getStatus() == Booking.BookingStatus.CONFIRMED
                    && booking.getEndTime().isBefore(now)) {
                booking.setStatus(Booking.BookingStatus.COMPLETED);
                bookingRepository.save(booking);
            }
        }

        List<Map<String, Object>> schedule = bookings.stream()
                .filter(b -> b.getStatus() == Booking.BookingStatus.CONFIRMED || b.getStatus() == Booking.BookingStatus.COMPLETED)
                .map(booking -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", booking.getId());
                    String timeStr = booking.getStartTime().toLocalTime().toString();
                    if (timeStr.length() > 5) timeStr = timeStr.substring(0, 5);
                    item.put("time", timeStr);
                    String endTimeStr = "";
                    if (booking.getEndTime() != null) {
                        endTimeStr = booking.getEndTime().toLocalTime().toString();
                        if (endTimeStr.length() > 5) endTimeStr = endTimeStr.substring(0, 5);
                    }
                    item.put("endTime", endTimeStr);
                    item.put("isCompleted", booking.getEndTime() != null && booking.getEndTime().isBefore(now));
                    item.put("facility", booking.getFacility() != null ? booking.getFacility().getName() : "-");
                    String memberName = booking.getMember() != null ? booking.getMember().getName() : (booking.getNonMemberName() != null ? booking.getNonMemberName() : "비회원");
                    item.put("memberName", memberName);
                    String lessonCategory = "";
                    if (booking.getPurpose() == Booking.BookingPurpose.LESSON) {
                        if (booking.getLessonCategory() != null) {
                            lessonCategory = LessonCategoryUtil.toKoreanText(booking.getLessonCategory());
                        } else {
                            com.afbscenter.model.Coach coach = booking.getCoach();
                            if (coach == null && booking.getMember() != null) coach = booking.getMember().getCoach();
                            if (coach != null) {
                                com.afbscenter.model.LessonCategory cat = LessonCategoryUtil.fromCoachSpecialties(coach);
                                if (cat != null) lessonCategory = LessonCategoryUtil.toKoreanText(cat);
                            }
                        }
                    }
                    item.put("lessonCategory", lessonCategory);
                    String coachName = "";
                    Long coachId = null;
                    if (booking.getCoach() != null) {
                        coachName = booking.getCoach().getName();
                        coachId = booking.getCoach().getId();
                    } else if (booking.getMember() != null && booking.getMember().getCoach() != null) {
                        coachName = booking.getMember().getCoach().getName();
                        coachId = booking.getMember().getCoach().getId();
                    }
                    item.put("coachName", coachName);
                    item.put("coachId", coachId);
                    item.put("status", booking.getStatus().name());
                    return item;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(schedule);
    }

    @GetMapping("/alerts")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAlerts() {
        List<Booking> pendingBookings = bookingRepository.findByStatus(Booking.BookingStatus.PENDING);
        List<Map<String, Object>> alerts = pendingBookings.stream().map(booking -> {
            Map<String, Object> alert = new HashMap<>();
            alert.put("type", "warning");
            alert.put("title", "대기 예약 승인 필요");
            alert.put("message", booking.getFacility().getName() + " - " + (booking.getMember() != null ? booking.getMember().getName() : booking.getNonMemberName()));
            return alert;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/announcements")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getActiveAnnouncements() {
        try {
            List<Announcement> announcements = announcementRepository.findActiveAnnouncements(LocalDate.now());
            List<Map<String, Object>> result = new ArrayList<>();
            for (Announcement a : announcements) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", a.getId());
                map.put("title", a.getTitle());
                map.put("content", a.getContent());
                map.put("startDate", a.getStartDate());
                map.put("endDate", a.getEndDate());
                map.put("createdAt", a.getCreatedAt());
                result.add(map);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("활성 공지사항 조회 중 오류 발생: {}", e.getMessage(), e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }
}
