package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.MemberProductHistory;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.MemberProductHistoryRepository;
import com.afbscenter.service.MemberProductQueryService;
import com.afbscenter.util.MemberProductRemainingOps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.util.List;
import java.util.Map;

/**
 * 출석 체크인/체크아웃 및 출석 생성(POST) 전용.
 * URL 유지: /api/attendance, POST /, POST /checkin, POST /checkout
 */
@RestController
@RequestMapping("/api/attendance")
public class AttendanceCheckController {

    private static final Logger logger = LoggerFactory.getLogger(AttendanceCheckController.class);
    /** 수동 체크아웃을 안 누른 경우, 예약 종료 시각에서 이 시간이 지나면 자동 정산 */
    private static final int AUTO_CHECKOUT_AFTER_HOURS = 1;
    /** 이용권/출석 히스토리에 남기는 안내 (자동 종료보다 사유가 드러나게) */
    private static final String AUTO_CHECKOUT_HISTORY_NOTE = "체크아웃 미처리 · 수업 종료 1시간 후 자동 정산";
    /** 체크인을 못 누른 채 수업이 끝난 경우, 당일 자정 이후 자동 체크인 */
    public static final String AUTO_CHECKIN_HISTORY_NOTE = "체크인 미처리 · 당일 자정 경과 후 자동 체크인";
    private static final int AUTO_CHECKIN_LOOKBACK_DAYS = 3;
    private static final int AUTO_CHECKIN_BATCH_LIMIT = 150;

    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final FacilityRepository facilityRepository;
    private final MemberProductRepository memberProductRepository;
    private final BookingRepository bookingRepository;
    private final MemberProductHistoryRepository memberProductHistoryRepository;
    private final JdbcTemplate jdbcTemplate;
    private final EntityManager entityManager;
    private final MemberProductQueryService memberProductQueryService;

    public AttendanceCheckController(AttendanceRepository attendanceRepository,
                                     MemberRepository memberRepository,
                                     FacilityRepository facilityRepository,
                                     MemberProductRepository memberProductRepository,
                                     BookingRepository bookingRepository,
                                     MemberProductHistoryRepository memberProductHistoryRepository,
                                     JdbcTemplate jdbcTemplate,
                                     EntityManager entityManager,
                                     MemberProductQueryService memberProductQueryService) {
        this.attendanceRepository = attendanceRepository;
        this.memberRepository = memberRepository;
        this.facilityRepository = facilityRepository;
        this.memberProductRepository = memberProductRepository;
        this.bookingRepository = bookingRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.entityManager = entityManager;
        this.memberProductQueryService = memberProductQueryService;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Attendance> createAttendance(@Valid @RequestBody Attendance attendance, HttpServletRequest request) {
        try {
            Member member = null;
            if (attendance.getMember() != null && attendance.getMember().getId() != null) {
                member = memberRepository.findById(attendance.getMember().getId())
                        .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
                attendance.setMember(member);
            }

            if (attendance.getFacility() != null && attendance.getFacility().getId() != null) {
                attendance.setFacility(facilityRepository.findById(attendance.getFacility().getId())
                        .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다.")));
            }

            if (attendance.getDate() == null) {
                attendance.setDate(java.time.LocalDate.now());
            }

            String processedBy = request != null ? (String) request.getAttribute("username") : null;
            if (processedBy != null && !processedBy.isEmpty()) attendance.setProcessedBy(processedBy);
            if (attendance.getStatus() == Attendance.AttendanceStatus.PRESENT && member != null) {
                member.setLastVisitDate(attendance.getDate());
                memberRepository.save(member);
                logger.debug("회원 최근 방문일 업데이트: Member ID={}, Date={}", member.getId(), attendance.getDate());
                // 횟수 차감은 수업 종료(체크아웃) 시 1회만 수행
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

    private java.util.Map.Entry<MemberProduct, Integer> decreaseCountPassUsage(Long memberId, LessonCategory lessonCategory, MemberProduct specifiedMemberProduct) {
        return decreaseCountPassUsage(memberId, lessonCategory, specifiedMemberProduct, null);
    }

    private java.util.Map.Entry<MemberProduct, Integer> decreaseCountPassUsage(Long memberId, LessonCategory lessonCategory, MemberProduct specifiedMemberProduct, Integer knownRemainingFromDb) {
        logger.info("회권 차감 시작: Member ID={}, LessonCategory={}, SpecifiedMemberProduct={}, knownRemainingFromDb={}",
            memberId, lessonCategory != null ? lessonCategory.name() : "null",
            specifiedMemberProduct != null ? specifiedMemberProduct.getId() : "null", knownRemainingFromDb);

        MemberProduct memberProduct = null;

        if (specifiedMemberProduct != null) {
            try {
                com.afbscenter.model.Product product = null;
                try {
                    product = specifiedMemberProduct.getProduct();
                } catch (Exception e) {
                    logger.warn("MemberProduct의 Product 로드 실패: {}", e.getMessage());
                    if (specifiedMemberProduct.getId() != null) {
                        try {
                            MemberProduct loaded = memberProductRepository.findByIdAndDeletedAtIsNull(specifiedMemberProduct.getId()).orElse(null);
                            if (loaded != null && loaded.getProduct() != null) {
                                product = loaded.getProduct();
                            }
                        } catch (Exception e2) {
                            logger.warn("MemberProduct 재조회 실패: {}", e2.getMessage());
                        }
                    }
                }

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

        if (memberProduct == null) {
            List<MemberProduct> countPassProducts =
                memberProductRepository.findActiveCountPassByMemberId(memberId);

            if (countPassProducts.isEmpty()) {
                logger.warn("체크인 시 차감할 활성 횟수권이 없음: Member ID={}", memberId);
                return null;
            }

            List<MemberProduct> filteredByCategory = countPassProducts;
            if (lessonCategory != null) {
                filteredByCategory = countPassProducts.stream()
                    .filter(mp -> matchesLessonCategory(mp, lessonCategory))
                    .collect(java.util.stream.Collectors.toList());
                if (filteredByCategory.isEmpty()) {
                    filteredByCategory = countPassProducts;
                }
            }

            filteredByCategory.sort((a, b) -> {
                Integer aRemaining = a.getRemainingCount() != null ? a.getRemainingCount() : Integer.MAX_VALUE;
                Integer bRemaining = b.getRemainingCount() != null ? b.getRemainingCount() : Integer.MAX_VALUE;
                int remainingCompare = Integer.compare(aRemaining, bRemaining);
                if (remainingCompare != 0) return remainingCompare;
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

        String lessonName = convertLessonCategoryToName(lessonCategory);

        com.afbscenter.model.Product productForType = null;
        try {
            productForType = memberProduct.getProduct();
        } catch (Exception e) {
            logger.warn("Product 로드 실패: MemberProduct ID={}, {}", memberProduct.getId(), e.getMessage());
        }

        // 패키지 형태: packageItemsRemaining이 있으면 패키지 차감 (대관 10회권 등 COUNT_PASS+패키지 포함)
        String packageJson = memberProduct.getPackageItemsRemaining();
        if ((packageJson == null || packageJson.isEmpty()) && productForType != null) {
            String productPackageItems = null;
            try {
                productPackageItems = productForType.getPackageItems();
            } catch (Exception e) {
                // ignore
            }
            if (productPackageItems != null && !productPackageItems.isEmpty()) {
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    List<Map<String, Object>> defItems = mapper.readValue(productPackageItems, new TypeReference<List<Map<String, Object>>>() {});
                    if (!defItems.isEmpty()) {
                        int currentRem = memberProduct.getRemainingCount() != null ? memberProduct.getRemainingCount().intValue() : 0;
                        if (knownRemainingFromDb != null && knownRemainingFromDb > 0) currentRem = knownRemainingFromDb.intValue();
                        List<Map<String, Object>> remainingItems = new java.util.ArrayList<>();
                        for (int i = 0; i < defItems.size(); i++) {
                            Map<String, Object> def = defItems.get(i);
                            Map<String, Object> r = new java.util.HashMap<>();
                            r.put("name", def.get("name"));
                            r.put("remaining", defItems.size() == 1 ? currentRem : (i == 0 ? currentRem : 0));
                            remainingItems.add(r);
                        }
                        packageJson = mapper.writeValueAsString(remainingItems);
                        memberProduct.setPackageItemsRemaining(packageJson);
                        logger.info("패키지 잔여 초기화: MemberProduct ID={}, 상품 패키지 기반 remaining_count={} 반영", memberProduct.getId(), currentRem);
                    }
                } catch (Exception e) {
                    logger.debug("패키지 잔여 초기화 스킵: {}", e.getMessage());
                }
            }
        }
        boolean hasPackageItems = packageJson != null && !packageJson.isEmpty();
        boolean isPackageProduct = productForType != null && hasPackageItems;

        if (isPackageProduct) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                List<Map<String, Object>> items = mapper.readValue(
                    memberProduct.getPackageItemsRemaining(),
                    new TypeReference<List<Map<String, Object>>>() {}
                );

                boolean updated = false;
                String matchedName = null;
                // 1) lessonName이 있으면 해당 이름 항목에서 차감
                // 2) lessonName이 비어 있으면(대관 등) 잔여>0인 첫 항목 또는 이름에 '대관' 포함된 항목에서 차감
                for (Map<String, Object> item : items) {
                    String itemName = item.get("name") != null ? item.get("name").toString() : "";
                    boolean nameMatches = !lessonName.isEmpty()
                        ? lessonName.equals(itemName)
                        : (itemName.contains("대관") || items.size() == 1);
                    if (nameMatches) {
                        int remaining = item.get("remaining") instanceof Number
                            ? ((Number) item.get("remaining")).intValue() : 0;
                        if (remaining > 0) {
                            item.put("remaining", remaining - 1);
                            updated = true;
                            matchedName = itemName;
                            logger.info("패키지 레슨 차감: {} - {}회 남음 (lessonName={})", itemName, remaining - 1, lessonName.isEmpty() ? "대관" : lessonName);
                            break;
                        }
                    }
                }
                if (!updated && lessonName.isEmpty()) {
                    // 대관인데 위에서 못 찾은 경우: 잔여>0인 첫 항목에서 차감
                    for (Map<String, Object> item : items) {
                        int remaining = item.get("remaining") instanceof Number
                            ? ((Number) item.get("remaining")).intValue() : 0;
                        if (remaining > 0) {
                            item.put("remaining", remaining - 1);
                            updated = true;
                            matchedName = item.get("name") != null ? item.get("name").toString() : "대관";
                            logger.info("패키지 차감(대관): {} - {}회 남음", matchedName, remaining - 1);
                            break;
                        }
                    }
                }

                if (updated) {
                    Integer beforeRemaining = null;
                    for (Map<String, Object> item : items) {
                        Object r = item.get("remaining");
                        int nowRemaining = r instanceof Number ? ((Number) r).intValue() : 0;
                        if (matchedName != null && matchedName.equals(item.get("name") != null ? item.get("name").toString() : "")) {
                            beforeRemaining = nowRemaining + 1;
                            break;
                        }
                    }
                    if (beforeRemaining == null) {
                        int sumBefore = 0;
                        for (Map<String, Object> item : items) {
                            Object r = item.get("remaining");
                            if (r instanceof Number) sumBefore += ((Number) r).intValue();
                        }
                        beforeRemaining = sumBefore + 1;
                    }

                    memberProduct.setPackageItemsRemaining(mapper.writeValueAsString(items));

                    int sumRemaining = 0;
                    for (Map<String, Object> item : items) {
                        Object r = item.get("remaining");
                        if (r instanceof Number) sumRemaining += ((Number) r).intValue();
                    }
                    memberProduct.setRemainingCount(sumRemaining);

                    boolean allZero = items.stream()
                        .allMatch(item -> (item.get("remaining") instanceof Number && ((Number) item.get("remaining")).intValue() == 0));
                    if (allZero) {
                        memberProduct.setStatus(MemberProduct.Status.USED_UP);
                        if (memberProduct.getEndedAt() == null) memberProduct.setEndedAt(java.time.LocalDateTime.now());
                    }

                    memberProductRepository.save(memberProduct);
                    logger.info("상품권 패키지 횟수 차감 완료: MemberProduct ID={}, Product Name={}, 레슨={}, 차감 전: {}회",
                        memberProduct.getId(),
                        memberProduct.getProduct() != null ? memberProduct.getProduct().getName() : "unknown",
                        matchedName != null ? matchedName : lessonName, beforeRemaining);

                    return new java.util.AbstractMap.SimpleEntry<>(memberProduct, beforeRemaining);
                } else {
                    logger.warn("패키지 레슨 차감 실패: 해당 레슨의 잔여 횟수가 0이거나 매칭 없음. MemberProduct ID={}, lessonName={}",
                        memberProduct.getId(), lessonName.isEmpty() ? "(대관)" : lessonName);
                    return null;
                }
            } catch (Exception e) {
                logger.error("패키지 횟수 차감 실패", e);
                return null;
            }
        }

        // ★ '차감 전' 표시값: 호출부에서 차감 직전 JDBC로 읽은 값(knownRemainingFromDb) 우선 사용 → 8→7 표시 보정
        Integer currentRemaining = null;
        if (knownRemainingFromDb != null && memberProduct != null) {
            currentRemaining = knownRemainingFromDb;
            logger.info("체크인 차감: MemberProduct ID={} 호출부 전달 잔여={}회 사용", memberProduct.getId(), currentRemaining);
        } else {
            Long mpId = memberProduct.getId();
            if (mpId != null) {
                for (String sql : new String[] {
                    "SELECT remaining_count FROM member_products WHERE id = ? AND deleted_at IS NULL",
                    "SELECT REMAINING_COUNT FROM MEMBER_PRODUCTS WHERE ID = ? AND DELETED_AT IS NULL"
                }) {
                    try {
                        Integer fromDb = jdbcTemplate.queryForObject(sql, Integer.class, mpId);
                        if (fromDb != null) {
                            currentRemaining = fromDb;
                            logger.info("체크인 차감: MemberProduct ID={} DB 잔여={}회", mpId, currentRemaining);
                            break;
                        }
                    } catch (Exception e) {
                        logger.debug("DB 잔여 조회 시도 실패 (sql 사용 중): {}", e.getMessage());
                    }
                }
                if (currentRemaining == null) {
                    logger.warn("체크인 차감: MemberProduct ID={} DB 조회 불가, 엔티티 잔여 사용 (캐시값일 수 있음)", mpId);
                }
            }
            if (currentRemaining == null) {
                currentRemaining = memberProduct.getRemainingCount();
            }
        }
        if (currentRemaining == null) {
            currentRemaining = memberProduct.getRemainingCount();
        }

        Integer afterRemaining = MemberProductRemainingOps.remainingAfterLessonDeduct(currentRemaining);
        if (afterRemaining != null) {
            Integer beforeRemaining = currentRemaining;
            memberProduct.setRemainingCount(afterRemaining);

            if (memberProduct.getRemainingCount() == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
                if (memberProduct.getEndedAt() == null) memberProduct.setEndedAt(java.time.LocalDateTime.now());
            }

            memberProductRepository.save(memberProduct);
            logger.info("상품권 횟수 차감 완료: MemberProduct ID={}, Product Name={}, totalCount={}, 잔여={}회 (차감 전: {}회)",
                memberProduct.getId(),
                memberProduct.getProduct() != null ? memberProduct.getProduct().getName() : "unknown",
                memberProduct.getTotalCount(),
                memberProduct.getRemainingCount(), beforeRemaining);

            return new java.util.AbstractMap.SimpleEntry<>(memberProduct, beforeRemaining);
        } else if (currentRemaining == null || currentRemaining == 0) {
            logger.warn("회권 차감 실패: remainingCount가 0 또는 null. MemberProduct ID={}, Product Name={}, totalCount={}, currentRemaining={}",
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

    private void saveProductHistory(Long memberId, MemberProduct memberProduct, Integer beforeRemaining,
                                    Integer afterRemaining, Attendance attendance, Payment payment, String description, String processedBy) {
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
            if (processedBy != null && !processedBy.isEmpty()) history.setProcessedBy(processedBy);
            memberProductHistoryRepository.save(history);
            logger.debug("이용권 히스토리 저장: MemberProduct ID={}, Change={}, After={}",
                memberProduct.getId(), history.getChangeAmount(), afterRemaining);
        } catch (Exception e) {
            logger.warn("이용권 히스토리 저장 실패: {}", e.getMessage());
        }
    }

    /** 같은 수업(출석 또는 예약)에 이미 DEDUCT가 있으면 true — 1회만 차감 */
    private boolean sessionAlreadyDeducted(Attendance attendance) {
        if (attendance == null) {
            return false;
        }
        try {
            if (attendance.getId() != null
                    && memberProductHistoryRepository.countDeductByAttendanceId(attendance.getId()) > 0) {
                return true;
            }
            Long bookingId = attendance.getBooking() != null ? attendance.getBooking().getId() : null;
            if (bookingId != null && memberProductHistoryRepository.countDeductByBookingId(bookingId) > 0) {
                return true;
            }
        } catch (Exception e) {
            logger.warn("차감 여부 확인 실패 attendanceId={}: {}", attendance.getId(), e.getMessage());
        }
        return false;
    }

    /**
     * 수업 종료 시 횟수 1회 차감. 이미 차감된 수업이면 건너뜀.
     */
    private java.util.Map.Entry<MemberProduct, Integer> applySessionDeductionIfAbsent(
            Attendance attendance, String processedBy, String description) {
        if (attendance == null || sessionAlreadyDeducted(attendance)) {
            logger.info("수업 차감 생략(이미 1회 차감됨): attendanceId={}", attendance != null ? attendance.getId() : null);
            return null;
        }
        Member member = attendance.getMember();
        if (member == null || member.getId() == null) {
            return null;
        }
        member = memberRepository.findById(member.getId()).orElse(null);
        if (member == null) {
            return null;
        }
        com.afbscenter.model.Booking booking = attendance.getBooking();
        LessonCategory lessonCategory = booking != null ? booking.getLessonCategory() : null;
        MemberProduct memberProductToUse = null;
        if (booking != null) {
            try {
                if (booking.getMemberProduct() != null && booking.getMemberProduct().getId() != null) {
                    memberProductToUse = memberProductRepository.findByIdAndDeletedAtIsNull(booking.getMemberProduct().getId())
                            .orElse(booking.getMemberProduct());
                }
            } catch (Exception e) {
                logger.debug("예약 이용권 로드 스킵: {}", e.getMessage());
                if (booking.getId() != null) {
                    try {
                        List<Long> ids = jdbcTemplate.query(
                                "SELECT member_product_id FROM bookings WHERE id = ?",
                                (rs, rowNum) -> {
                                    long id = rs.getLong("member_product_id");
                                    return rs.wasNull() ? null : id;
                                },
                                booking.getId());
                        if (!ids.isEmpty() && ids.get(0) != null) {
                            memberProductToUse = memberProductRepository.findByIdAndDeletedAtIsNull(ids.get(0)).orElse(null);
                        }
                    } catch (Exception e2) {
                        logger.warn("member_product_id 조회 실패: {}", e2.getMessage());
                    }
                }
            }
        }
        boolean isRental = booking != null && booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL;
        Integer knownRemaining = null;
        if (memberProductToUse != null && memberProductToUse.getId() != null) {
            knownRemaining = memberProductQueryService.getRemainingCountFromDb(memberProductToUse.getId());
        }
        java.util.Map.Entry<MemberProduct, Integer> deductResult = decreaseCountPassUsage(
                member.getId(), isRental ? null : lessonCategory, memberProductToUse, knownRemaining);
        if (deductResult != null) {
            saveProductHistory(member.getId(), deductResult.getKey(), deductResult.getValue(),
                    deductResult.getKey().getRemainingCount(), attendance, null, description, processedBy);
            logger.info("수업 1회 차감: attendanceId={}, memberProductId={}, {} → {}, desc={}",
                    attendance.getId(), deductResult.getKey().getId(),
                    deductResult.getValue(), deductResult.getKey().getRemainingCount(), description);
        }
        return deductResult;
    }

    /**
     * 수동 체크아웃이 없으면 예약 종료 1시간 뒤에 자동 체크아웃 + 1회 차감.
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 60000)
    @Transactional
    public void autoCheckoutOverdueSessions() {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        List<Attendance> open;
        try {
            open = attendanceRepository.findIncompleteAttendances();
        } catch (Exception e) {
            logger.warn("자동 체크아웃 대상 조회 실패: {}", e.getMessage());
            return;
        }
        if (open == null || open.isEmpty()) {
            return;
        }
        int closed = 0;
        for (Attendance a : open) {
            try {
                com.afbscenter.model.Booking booking = a.getBooking();
                if (a.getCheckInTime() == null || a.getCheckOutTime() != null) {
                    continue;
                }
                java.time.LocalDateTime sessionEnd = booking != null ? booking.getEndTime() : null;
                if (sessionEnd == null) {
                    sessionEnd = a.getCheckInTime();
                }
                if (sessionEnd == null || sessionEnd.plusHours(AUTO_CHECKOUT_AFTER_HOURS).isAfter(now)) {
                    continue;
                }
                if (booking != null && booking.getId() != null) {
                    try {
                        bookingRepository.findByIdForUpdate(booking.getId());
                    } catch (Exception ignored) { }
                }
                Attendance latest = a;
                if (a.getId() != null) {
                    try {
                        entityManager.refresh(a);
                    } catch (Exception ignored) { }
                    latest = attendanceRepository.findById(a.getId()).orElse(a);
                }
                if (latest.getCheckOutTime() == null) {
                    latest.setCheckOutTime(now);
                    latest.setMemo(appendAutoCheckoutNote(latest.getMemo()));
                    latest = attendanceRepository.save(latest);
                    if (booking != null && (booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.CONFIRMED
                            || booking.getStatus() == null)) {
                        booking.setStatus(com.afbscenter.model.Booking.BookingStatus.COMPLETED);
                        bookingRepository.save(booking);
                    }
                    closed++;
                    logger.info("미체크아웃 자동 정산: attendanceId={}, bookingId={}, sessionEnd={}",
                            latest.getId(), booking != null ? booking.getId() : null, sessionEnd);
                }
                applySessionDeductionIfAbsent(latest, "시스템", AUTO_CHECKOUT_HISTORY_NOTE);
            } catch (Exception e) {
                logger.warn("자동 체크아웃 실패 attendanceId={}: {}", a.getId(), e.getMessage());
            }
        }
        if (closed > 0) {
            logger.info("미체크아웃 자동 정산 처리 {}건", closed);
        }
    }

    /**
     * 원칙은 수동 체크인. 누르지 못한 채 수업이 진행된 건은 예약일 자정이 지나면 자동 체크인.
     * 이후 기존 자동 체크아웃(종료 1시간 후)이 횟수 차감을 처리한다.
     */
    @org.springframework.scheduling.annotation.Scheduled(initialDelay = 45000, fixedDelay = 60000)
    @Transactional
    public void autoCheckInAfterMidnight() {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.time.LocalDate today = now.toLocalDate();
        java.time.LocalDateTime until = today.atStartOfDay();
        java.time.LocalDateTime from = today.minusDays(AUTO_CHECKIN_LOOKBACK_DAYS).atStartOfDay();
        List<com.afbscenter.model.Booking> pending;
        try {
            pending = bookingRepository.findMemberBookingsPastMidnightWithoutCheckIn(from, until);
        } catch (Exception e) {
            logger.warn("자정 경과 자동 체크인 대상 조회 실패: {}", e.getMessage());
            return;
        }
        if (pending == null || pending.isEmpty()) {
            return;
        }
        int created = 0;
        int limit = Math.min(pending.size(), AUTO_CHECKIN_BATCH_LIMIT);
        for (int i = 0; i < limit; i++) {
            com.afbscenter.model.Booking booking = pending.get(i);
            try {
                if (autoCheckInMemberBooking(booking, now)) {
                    created++;
                }
            } catch (Exception e) {
                logger.warn("자정 경과 자동 체크인 실패 bookingId={}: {}", booking.getId(), e.getMessage());
            }
        }
        if (created > 0) {
            logger.info("자정 경과 자동 체크인 처리 {}건", created);
        }
    }

    static boolean isMidnightAutoCheckInMemo(String memo) {
        return memo != null && memo.contains(AUTO_CHECKIN_HISTORY_NOTE);
    }

    /** 예약 시작일이 오늘보다 이전이면 당일 자정이 지난 것. */
    static boolean bookingDayHasPassedMidnight(java.time.LocalDateTime startTime, java.time.LocalDateTime now) {
        if (startTime == null || now == null) {
            return false;
        }
        return startTime.toLocalDate().isBefore(now.toLocalDate());
    }

    /** 예약일 자정이 지났으면 관리자 외 수정·삭제 불가. */
    static boolean isPastMidnightMutationLocked(java.time.LocalDateTime startTime, java.time.LocalDateTime now, String role) {
        if (role != null && "ADMIN".equalsIgnoreCase(role.trim())) {
            return false;
        }
        return bookingDayHasPassedMidnight(startTime, now);
    }

    private boolean autoCheckInMemberBooking(com.afbscenter.model.Booking booking, java.time.LocalDateTime now) {
        if (booking == null || booking.getId() == null) {
            return false;
        }
        if (booking.getMember() == null || booking.getFacility() == null) {
            return false;
        }
        if (booking.getNonMemberName() != null && !booking.getNonMemberName().isBlank()) {
            return false;
        }
        if (booking.getMember().getName() != null && booking.getMember().getName().contains("체험")) {
            return false;
        }
        if (!bookingDayHasPassedMidnight(booking.getStartTime(), now)) {
            return false;
        }
        if (booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.CANCELLED
                || booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.NO_SHOW) {
            return false;
        }
        try {
            bookingRepository.findByIdForUpdate(booking.getId());
        } catch (Exception ignored) { }

        java.util.List<Attendance> existing = attendanceRepository.findByBookingIdForCheckin(booking.getId());
        Attendance attendance;
        if (existing != null && !existing.isEmpty()) {
            attendance = existing.get(0);
            if (attendance.getCheckInTime() != null) {
                return false;
            }
        } else {
            attendance = new Attendance();
            attendance.setBooking(booking);
            attendance.setMember(booking.getMember());
            attendance.setFacility(booking.getFacility());
        }
        java.time.LocalDate bookingDate = booking.getStartTime() != null
                ? booking.getStartTime().toLocalDate() : now.toLocalDate();
        java.time.LocalDateTime checkInAt = booking.getStartTime() != null ? booking.getStartTime() : now;
        attendance.setDate(bookingDate);
        attendance.setCheckInTime(checkInAt);
        attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
        attendance.setProcessedBy("시스템");
        attendance.setMemo(appendAutoCheckInNote(attendance.getMemo()));
        Attendance saved = attendanceRepository.save(attendance);

        try {
            Member member = memberRepository.findById(booking.getMember().getId()).orElse(null);
            if (member != null && (member.getLastVisitDate() == null || bookingDate.isAfter(member.getLastVisitDate()))) {
                member.setLastVisitDate(bookingDate);
                memberRepository.save(member);
            }
        } catch (Exception e) {
            logger.debug("자동 체크인 최근 방문일 갱신 스킵: {}", e.getMessage());
        }

        java.time.LocalDateTime sessionEnd = booking.getEndTime() != null ? booking.getEndTime() : checkInAt;
        if (!sessionEnd.plusHours(AUTO_CHECKOUT_AFTER_HOURS).isAfter(now)) {
            saved.setCheckOutTime(now);
            saved.setMemo(appendAutoCheckoutNote(saved.getMemo()));
            saved = attendanceRepository.save(saved);
            if (booking.getStatus() == com.afbscenter.model.Booking.BookingStatus.CONFIRMED
                    || booking.getStatus() == null) {
                booking.setStatus(com.afbscenter.model.Booking.BookingStatus.COMPLETED);
                bookingRepository.save(booking);
            }
            applySessionDeductionIfAbsent(saved, "시스템", AUTO_CHECKOUT_HISTORY_NOTE);
        }

        logger.info("자정 경과 자동 체크인: bookingId={}, memberId={}, start={}",
                booking.getId(),
                booking.getMember() != null ? booking.getMember().getId() : null,
                booking.getStartTime());
        return true;
    }

    private String appendAutoCheckInNote(String existingMemo) {
        if (existingMemo != null && existingMemo.contains(AUTO_CHECKIN_HISTORY_NOTE)) {
            return existingMemo;
        }
        if (existingMemo == null || existingMemo.isBlank()) {
            return AUTO_CHECKIN_HISTORY_NOTE;
        }
        String merged = existingMemo.trim() + " / " + AUTO_CHECKIN_HISTORY_NOTE;
        return merged.length() <= 1000 ? merged : existingMemo;
    }

    private String appendAutoCheckoutNote(String existingMemo) {
        if (existingMemo != null && existingMemo.contains(AUTO_CHECKOUT_HISTORY_NOTE)) {
            return existingMemo;
        }
        if (existingMemo == null || existingMemo.isBlank()) {
            return AUTO_CHECKOUT_HISTORY_NOTE;
        }
        String merged = existingMemo.trim() + " / " + AUTO_CHECKOUT_HISTORY_NOTE;
        return merged.length() <= 1000 ? merged : existingMemo;
    }

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
            if (product.getCategory() != null) {
                String category = product.getCategory().name();
                if (lessonCategory == LessonCategory.BASEBALL && "BASEBALL".equals(category)) return true;
                if (lessonCategory == LessonCategory.YOUTH_BASEBALL && ("YOUTH_BASEBALL".equals(category) || "BASEBALL".equals(category))) return true;
                if (lessonCategory == LessonCategory.PILATES && "PILATES".equals(category)) return true;
                if (lessonCategory == LessonCategory.TRAINING &&
                    ("TRAINING".equals(category) || "TRAINING_FITNESS".equals(category))) return true;
            }
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

    @PostMapping("/checkin")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> processCheckin(@RequestBody java.util.Map<String, Object> checkinData, HttpServletRequest request) {
        String failedStep = "start";
        try {
            failedStep = "parse_booking_id";
            Long bookingId = null;
            Object bookingIdObj = checkinData.get("bookingId");
            if (bookingIdObj != null) {
                String str = bookingIdObj.toString().trim();
                if (!str.isEmpty()) {
                    if (bookingIdObj instanceof Number) {
                        bookingId = ((Number) bookingIdObj).longValue();
                    } else {
                        try {
                            bookingId = Long.parseLong(str);
                        } catch (NumberFormatException e) {
                            java.util.Map<String, Object> error = new java.util.HashMap<>();
                            error.put("error", "예약 ID 형식이 올바르지 않습니다.");
                            return ResponseEntity.badRequest().body(error);
                        }
                    }
                }
            }

            if (bookingId == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "예약 ID가 필요합니다.");
                return ResponseEntity.badRequest().body(error);
            }

            final Long finalBookingId = bookingId;
            logger.info("[BOOKING_FLOW] checkin start bookingId={}", finalBookingId);
            logger.info("체크인 시작: Booking ID={}", finalBookingId);

            failedStep = "lock_booking";
            // 동일 예약에 대한 동시 체크인 요청 시 한 건만 차감되도록 예약 행 배타 락
            bookingRepository.findByIdForUpdate(finalBookingId)
                    .orElseThrow(() -> new IllegalArgumentException("예약을 찾을 수 없습니다. Booking ID: " + finalBookingId));

            failedStep = "load_booking";
            // 체크인은 facility·member만 필요. memberProduct 미포함 조회로 null 예약에서도 예외 방지
            com.afbscenter.model.Booking booking = bookingRepository.findByIdWithFacilityAndMemberOnly(finalBookingId).orElse(null);
            if (booking == null) {
                try {
                    logger.debug("[BOOKING_FLOW] checkin fallback findByIdWithFacilityAndMember bookingId={}", finalBookingId);
                    booking = bookingRepository.findByIdWithFacilityAndMember(finalBookingId);
                } catch (Exception e) {
                    // ignore
                }
                if (booking == null) {
                    logger.debug("[BOOKING_FLOW] checkin fallback findById bookingId={}", finalBookingId);
                    booking = bookingRepository.findById(finalBookingId)
                        .orElseThrow(() -> new IllegalArgumentException("예약을 찾을 수 없습니다. Booking ID: " + finalBookingId));
                }
            }

            failedStep = "validate_member_facility";
            // 출석(Attendance)은 회원·시설 필수이므로 비회원/시설없음 예약은 체크인 불가
            if (booking.getMember() == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "비회원 예약은 체크인할 수 없습니다. 회원 예약만 체크인 가능합니다.");
                error.put("bookingId", finalBookingId);
                return ResponseEntity.badRequest().body(error);
            }
            if (booking.getFacility() == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "시설 정보가 없는 예약은 체크인할 수 없습니다.");
                error.put("bookingId", finalBookingId);
                return ResponseEntity.badRequest().body(error);
            }

            failedStep = "load_member_product";
            com.afbscenter.model.MemberProduct bookingMemberProduct = null;
            try {
                com.afbscenter.model.MemberProduct lazyMemberProduct = booking.getMemberProduct();
                if (lazyMemberProduct != null && lazyMemberProduct.getId() != null) {
                    bookingMemberProduct = memberProductRepository.findByIdWithMember(lazyMemberProduct.getId()).orElse(null);
                    if (bookingMemberProduct == null) {
                        bookingMemberProduct = memberProductRepository.findByIdAndDeletedAtIsNull(lazyMemberProduct.getId()).orElse(null);
                    }
                }
            } catch (org.hibernate.LazyInitializationException e) {
                try {
                    List<Long> results = jdbcTemplate.query(
                        "SELECT member_product_id FROM bookings WHERE id = ?",
                        (rs, rowNum) -> {
                            long id = rs.getLong("member_product_id");
                            return rs.wasNull() ? null : id;
                        },
                        finalBookingId
                    );
                    if (!results.isEmpty() && results.get(0) != null) {
                        Long mpId = results.get(0);
                        bookingMemberProduct = memberProductRepository.findByIdWithMember(mpId).orElse(null);
                        if (bookingMemberProduct == null) {
                            bookingMemberProduct = memberProductRepository.findByIdAndDeletedAtIsNull(mpId).orElse(null);
                        }
                    }
                } catch (Exception e2) {
                    logger.warn("memberProductId 직접 조회 실패: {}", e2.getMessage());
                }
            } catch (Exception e) {
                logger.warn("Booking의 MemberProduct 조회 실패: {}", e.getMessage());
            }

            if (bookingMemberProduct == null) {
                try {
                    com.afbscenter.model.Booking bookingWithAll = bookingRepository.findByIdWithAllRelations(finalBookingId);
                    if (bookingWithAll != null && bookingWithAll.getMemberProduct() != null) {
                        bookingMemberProduct = bookingWithAll.getMemberProduct();
                    }
                } catch (Exception e) {
                    // ignore
                }
            }

            failedStep = "find_existing_attendance";
            // memberProduct FETCH 없는 단순 조회로 기존 출석 여부만 확인 (복잡한 JOIN 시 예외 방지)
            java.util.Optional<Attendance> existingAttendance = attendanceRepository.findByBookingIdForCheckin(finalBookingId).stream().findFirst();

            final String processedBy = request != null ? (String) request.getAttribute("username") : null;
            Attendance attendance;
            failedStep = "booking_date";
            java.time.LocalDate bookingDate = booking.getStartTime() != null ? booking.getStartTime().toLocalDate() : java.time.LocalDate.now();

            if (existingAttendance.isPresent()) {
                attendance = existingAttendance.get();
                if (attendance.getCheckInTime() != null) {
                    java.util.Map<String, Object> error = new java.util.HashMap<>();
                    error.put("error", "이미 체크인된 예약입니다.");
                    return ResponseEntity.badRequest().body(error);
                }
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
            } else {
                attendance = new Attendance();
                attendance.setBooking(booking);
                attendance.setMember(booking.getMember());
                attendance.setFacility(booking.getFacility());
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
            }

            if (attendance.getMember() != null) {
                failedStep = "member_save";
                Member member = memberRepository.findById(attendance.getMember().getId()).orElse(null);
                if (member != null) {
                    member.setLastVisitDate(attendance.getDate());
                    memberRepository.save(member);
                }
                failedStep = "link_member_product";
                if (member != null) {
                    try {
                        com.afbscenter.model.MemberProduct memberProductToUse = bookingMemberProduct;
                        boolean isRental = booking.getPurpose() != null && booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL;
                        if (!isRental && memberProductToUse == null) {
                            List<MemberProduct> countPassProducts = memberProductRepository.findActiveCountPassByMemberId(member.getId());
                            if (countPassProducts != null && !countPassProducts.isEmpty()) {
                                LessonCategory lessonCategory = booking.getLessonCategory();
                                List<MemberProduct> filteredByCategory = countPassProducts;
                                if (lessonCategory != null) {
                                    filteredByCategory = countPassProducts.stream()
                                        .filter(mp -> matchesLessonCategory(mp, lessonCategory))
                                        .collect(java.util.stream.Collectors.toList());
                                    if (filteredByCategory.isEmpty()) filteredByCategory = countPassProducts;
                                }
                                filteredByCategory.sort((a, b) -> {
                                    Integer ar = a.getRemainingCount() != null ? a.getRemainingCount() : Integer.MAX_VALUE;
                                    Integer br = b.getRemainingCount() != null ? b.getRemainingCount() : Integer.MAX_VALUE;
                                    int c = Integer.compare(ar, br);
                                    if (c != 0) return c;
                                    if (a.getPurchaseDate() == null && b.getPurchaseDate() == null) return 0;
                                    if (a.getPurchaseDate() == null) return 1;
                                    if (b.getPurchaseDate() == null) return -1;
                                    return a.getPurchaseDate().compareTo(b.getPurchaseDate());
                                });
                                memberProductToUse = filteredByCategory.get(0);
                                if (booking.getMemberProduct() == null) {
                                    booking.setMemberProduct(memberProductToUse);
                                    bookingRepository.save(booking);
                                }
                            }
                        }
                    } catch (Exception e) {
                        logger.warn("체크인 시 이용권 연결 실패(차감은 종료 시): Member ID={}, Booking ID={}", member.getId(), finalBookingId, e);
                    }
                }
            }

            if (processedBy != null && !processedBy.isEmpty()) attendance.setProcessedBy(processedBy);
            failedStep = "save_attendance";
            Attendance saved = attendanceRepository.save(attendance);

            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("checkInTime", saved.getCheckInTime());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", "체크인이 완료되었습니다. 이용권 횟수는 체크아웃 시 1회 차감됩니다.");

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Long errorBookingId = checkinData.get("bookingId") != null ? ((Number) checkinData.get("bookingId")).longValue() : null;
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", e.getMessage());
            error.put("bookingId", errorBookingId);
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Long errorBookingId = checkinData != null && checkinData.get("bookingId") != null ? ((Number) checkinData.get("bookingId")).longValue() : null;
            logger.error("체크인 처리 중 오류: failedStep={}, Booking ID={}", failedStep, errorBookingId, e);
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", "체크인 처리 중 오류가 발생했습니다: " + e.getMessage());
            error.put("errorType", e.getClass().getSimpleName());
            error.put("failedStep", failedStep);
            error.put("bookingId", errorBookingId);
            if (e.getCause() != null) error.put("cause", e.getCause().getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/checkout")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> processCheckout(@RequestBody java.util.Map<String, Object> checkoutData, HttpServletRequest request) {
        try {
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

            Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new IllegalArgumentException("출석 기록을 찾을 수 없습니다."));

            if (attendance.getCheckInTime() == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "체크인되지 않은 기록입니다.");
                return ResponseEntity.badRequest().body(error);
            }

            boolean alreadyCheckedOut = attendance.getCheckOutTime() != null;
            com.afbscenter.model.Booking booking = attendance.getBooking();
            if (booking != null && booking.getId() != null) {
                try {
                    bookingRepository.findByIdForUpdate(booking.getId());
                } catch (Exception e) {
                    logger.debug("체크아웃 예약 락 스킵: {}", e.getMessage());
                }
            }

            if (!alreadyCheckedOut) {
                attendance.setCheckOutTime(java.time.LocalDateTime.now());
            }
            Attendance saved = attendanceRepository.save(attendance);

            if (booking != null && booking.getId() != null) {
                booking.setStatus(com.afbscenter.model.Booking.BookingStatus.COMPLETED);
                bookingRepository.save(booking);
                logger.info("수업 종료 처리: Booking ID={}", booking.getId());
            }

            String processedBy = request != null ? (String) request.getAttribute("username") : null;
            java.util.Map.Entry<MemberProduct, Integer> deductResult = applySessionDeductionIfAbsent(
                    saved, processedBy, "수업 종료(체크아웃)로 인한 차감");

            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("checkInTime", saved.getCheckInTime());
            result.put("checkOutTime", saved.getCheckOutTime());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            if (alreadyCheckedOut && deductResult == null) {
                result.put("message", "이미 체크아웃된 기록입니다.");
            } else {
                result.put("message", "체크아웃이 완료되었습니다.");
            }
            if (deductResult != null) {
                result.put("productDeducted", true);
                result.put("remainingBefore", deductResult.getValue());
                result.put("remainingAfter", deductResult.getKey().getRemainingCount());
            } else if (sessionAlreadyDeducted(saved)) {
                result.put("deductSkipped", true);
                result.put("deductSkipReason", "이 수업은 이미 1회 차감되었습니다.");
            }
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
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
