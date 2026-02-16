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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
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

    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final FacilityRepository facilityRepository;
    private final MemberProductRepository memberProductRepository;
    private final BookingRepository bookingRepository;
    private final MemberProductHistoryRepository memberProductHistoryRepository;
    private final JdbcTemplate jdbcTemplate;

    public AttendanceCheckController(AttendanceRepository attendanceRepository,
                                     MemberRepository memberRepository,
                                     FacilityRepository facilityRepository,
                                     MemberProductRepository memberProductRepository,
                                     BookingRepository bookingRepository,
                                     MemberProductHistoryRepository memberProductHistoryRepository,
                                     JdbcTemplate jdbcTemplate) {
        this.attendanceRepository = attendanceRepository;
        this.memberRepository = memberRepository;
        this.facilityRepository = facilityRepository;
        this.memberProductRepository = memberProductRepository;
        this.bookingRepository = bookingRepository;
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Attendance> createAttendance(@Valid @RequestBody Attendance attendance) {
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

            if (attendance.getStatus() == Attendance.AttendanceStatus.PRESENT && member != null) {
                member.setLastVisitDate(attendance.getDate());
                memberRepository.save(member);
                logger.debug("회원 최근 방문일 업데이트: Member ID={}, Date={}", member.getId(), attendance.getDate());

                try {
                    LessonCategory lessonCategory = (attendance.getBooking() != null)
                        ? attendance.getBooking().getLessonCategory()
                        : null;
                    MemberProduct memberProductToUse = (attendance.getBooking() != null && attendance.getBooking().getMemberProduct() != null)
                        ? attendance.getBooking().getMemberProduct()
                        : null;
                    java.util.Map.Entry<MemberProduct, Integer> deductResult = decreaseCountPassUsage(member.getId(), lessonCategory, memberProductToUse);

                    if (deductResult != null) {
                        saveProductHistory(member.getId(), deductResult.getKey(), deductResult.getValue(),
                            deductResult.getKey().getRemainingCount(), attendance, null, "체크인으로 인한 차감");
                    }
                } catch (Exception e) {
                    logger.warn("상품권 횟수 차감 실패: Member ID={}", member.getId(), e);
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

    private java.util.Map.Entry<MemberProduct, Integer> decreaseCountPassUsage(Long memberId, LessonCategory lessonCategory, MemberProduct specifiedMemberProduct) {
        logger.info("회권 차감 시작: Member ID={}, LessonCategory={}, SpecifiedMemberProduct={}",
            memberId, lessonCategory != null ? lessonCategory.name() : "null",
            specifiedMemberProduct != null ? specifiedMemberProduct.getId() : "null");

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
                            MemberProduct loaded = memberProductRepository.findById(specifiedMemberProduct.getId()).orElse(null);
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
        boolean hasPackageItems = memberProduct.getPackageItemsRemaining() != null
            && !memberProduct.getPackageItemsRemaining().isEmpty();
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

        Integer currentRemaining = memberProduct.getRemainingCount();
        boolean needsInitialization = (currentRemaining == null || currentRemaining == 0);

        if (needsInitialization) {
            final MemberProduct finalMemberProduct = memberProduct;
            logger.info("회권 remainingCount 초기화 필요: MemberProduct ID={}, 현재 remainingCount={}",
                finalMemberProduct.getId(), currentRemaining);

            currentRemaining = finalMemberProduct.getTotalCount();
            if (currentRemaining == null || currentRemaining <= 0) {
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
                        return null;
                    }
                } catch (Exception e) {
                    logger.error("Product 로드 실패: MemberProduct ID={}", finalMemberProduct.getId(), e);
                    return null;
                }
            } else {
                logger.info("totalCount로 초기화: MemberProduct ID={}, totalCount={}",
                    finalMemberProduct.getId(), currentRemaining);
            }

            try {
                final Long memberProductId = finalMemberProduct.getId();

                Long usedCountByAttendance = 0L;
                try {
                    List<Attendance> checkedInAttendances =
                        attendanceRepository.findByMemberId(memberId).stream()
                            .filter(a -> a.getBooking() != null &&
                                a.getBooking().getMemberProduct() != null &&
                                a.getBooking().getMemberProduct().getId().equals(memberProductId) &&
                                a.getCheckInTime() != null)
                            .collect(java.util.stream.Collectors.toList());
                    usedCountByAttendance = (long) checkedInAttendances.size();
                } catch (Exception e) {
                    logger.warn("출석 기록 확인 실패: {}", e.getMessage());
                }

                Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(memberProductId);
                if (usedCountByBooking == null) usedCountByBooking = 0L;

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
                try {
                    com.afbscenter.model.Product product = memberProduct.getProduct();
                    if (product != null && product.getUsageCount() != null && product.getUsageCount() > 0) {
                        memberProduct.setTotalCount(product.getUsageCount());
                    }
                } catch (Exception e) {
                    // ignore
                }
            }
        } else {
            currentRemaining = memberProduct.getRemainingCount();
        }

        if (currentRemaining == null) {
            currentRemaining = memberProduct.getRemainingCount();
        }

        if (currentRemaining != null && currentRemaining > 0) {
            Integer beforeRemaining = currentRemaining;
            memberProduct.setRemainingCount(currentRemaining - 1);

            if (memberProduct.getRemainingCount() == 0) {
                memberProduct.setStatus(MemberProduct.Status.USED_UP);
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
    public ResponseEntity<java.util.Map<String, Object>> processCheckin(@RequestBody java.util.Map<String, Object> checkinData) {
        try {
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

            final Long finalBookingId = bookingId;
            logger.info("체크인 시작: Booking ID={}", finalBookingId);

            com.afbscenter.model.Booking booking = null;
            try {
                booking = bookingRepository.findByIdWithAllRelations(finalBookingId);
            } catch (Exception e) {
                try {
                    booking = bookingRepository.findByIdWithFacilityAndMember(finalBookingId);
                } catch (Exception e2) {
                    // ignore
                }
            }

            if (booking == null) {
                booking = bookingRepository.findById(finalBookingId)
                    .orElseThrow(() -> new IllegalArgumentException("예약을 찾을 수 없습니다. Booking ID: " + finalBookingId));
            }

            com.afbscenter.model.MemberProduct bookingMemberProduct = null;
            try {
                com.afbscenter.model.MemberProduct lazyMemberProduct = booking.getMemberProduct();
                if (lazyMemberProduct != null && lazyMemberProduct.getId() != null) {
                    bookingMemberProduct = memberProductRepository.findByIdWithMember(lazyMemberProduct.getId()).orElse(null);
                    if (bookingMemberProduct == null) {
                        bookingMemberProduct = memberProductRepository.findById(lazyMemberProduct.getId()).orElse(null);
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
                            bookingMemberProduct = memberProductRepository.findById(mpId).orElse(null);
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

            java.util.Optional<Attendance> existingAttendance = attendanceRepository.findByBookingId(finalBookingId);

            Attendance attendance;
            boolean isNewAttendance = false;
            java.time.LocalDate bookingDate = booking.getStartTime() != null ? booking.getStartTime().toLocalDate() : java.time.LocalDate.now();

            java.util.Map.Entry<MemberProduct, Integer> deductResultForResponse = null;
            String deductSkipReason = null;
            String deductFailReason = null;
            Integer rentalDisplayBefore = null;
            Integer rentalDisplayAfter = null;

            if (existingAttendance.isPresent()) {
                attendance = existingAttendance.get();
                if (attendance.getCheckInTime() != null) {
                    java.util.Map<String, Object> error = new java.util.HashMap<>();
                    error.put("error", "이미 체크인된 예약입니다.");
                    return ResponseEntity.badRequest().body(error);
                }
                isNewAttendance = true;
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
            } else {
                isNewAttendance = true;
                attendance = new Attendance();
                attendance.setBooking(booking);
                attendance.setMember(booking.getMember());
                attendance.setFacility(booking.getFacility());
                attendance.setDate(bookingDate);
                attendance.setCheckInTime(java.time.LocalDateTime.now());
                attendance.setStatus(Attendance.AttendanceStatus.PRESENT);
            }

            if (attendance.getMember() != null) {
                Member member = memberRepository.findById(attendance.getMember().getId()).orElse(null);
                if (member != null) {
                    member.setLastVisitDate(attendance.getDate());
                    memberRepository.save(member);

                    Boolean autoDeduct = checkinData.get("autoDeduct") != null
                        ? Boolean.parseBoolean(checkinData.get("autoDeduct").toString()) : true;
                    boolean isRental = booking.getPurpose() != null && booking.getPurpose() == com.afbscenter.model.Booking.BookingPurpose.RENTAL;

                    if (autoDeduct && isNewAttendance) {
                        try {
                            com.afbscenter.model.MemberProduct memberProductToUse = bookingMemberProduct;
                            // 대관 체크인 시 이용권을 DB에서 재조회해 최신 packageItemsRemaining/remainingCount 기준으로 차감·저장
                            if (isRental && memberProductToUse != null && memberProductToUse.getId() != null) {
                                memberProductToUse = memberProductRepository.findById(memberProductToUse.getId()).orElse(memberProductToUse);
                            }

                            if (isRental) {
                                // 대관: 예약에 연결된 이용권만 사용. 연결돼 있으면 체크인 시 1회 차감(DEDUCT) 반드시 수행
                                if (memberProductToUse != null) {
                                    // 차감 전/후 표시용: DEDUCT 건수 기준 실제 잔여 사용 (목록과 동일). 차감 전 4회였으면 4→3으로 표시
                                    try {
                                        List<MemberProductHistory> histories = memberProductHistoryRepository.findByMemberProductIdOrderByTransactionDateDesc(memberProductToUse.getId());
                                        int deductCount = 0;
                                        for (MemberProductHistory h : histories) {
                                            if (h.getType() == MemberProductHistory.TransactionType.DEDUCT && h.getChangeAmount() != null)
                                                deductCount += Math.abs(h.getChangeAmount().intValue());
                                        }
                                        Integer total = memberProductToUse.getTotalCount();
                                        if (total == null && memberProductToUse.getProduct() != null && memberProductToUse.getProduct().getUsageCount() != null)
                                            total = memberProductToUse.getProduct().getUsageCount();
                                        if (total != null) {
                                            rentalDisplayBefore = Math.max(0, total - deductCount);
                                            rentalDisplayAfter = Math.max(0, rentalDisplayBefore - 1);
                                        }
                                    } catch (Exception e) {
                                        logger.debug("대관 차감 전/후 표시용 DEDUCT 계산 실패: {}", e.getMessage());
                                    }
                                    java.util.Map.Entry<MemberProduct, Integer> deductResult = decreaseCountPassUsage(member.getId(), null, memberProductToUse);
                                    if (deductResult != null) {
                                        deductResultForResponse = deductResult;
                                        saveProductHistory(member.getId(), deductResult.getKey(), deductResult.getValue(),
                                            deductResult.getKey().getRemainingCount(), attendance, null, "체크인으로 인한 차감");
                                        logger.info("대관 체크인 시 이용권 차감: Booking ID={}, MemberProduct ID={}, 잔여 {} → {}",
                                            finalBookingId, memberProductToUse.getId(), deductResult.getValue(), deductResult.getKey().getRemainingCount());
                                    } else {
                                        deductFailReason = "이용권 차감 실패 (remainingCount가 0이거나 차감할 수 없음)";
                                    }
                                } else {
                                    deductFailReason = "대관 예약에 이용권이 연결되지 않음";
                                }
                            } else {
                                if (memberProductToUse == null) {
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

                                if (memberProductToUse != null) {
                                    LessonCategory lessonCategory = booking.getLessonCategory();
                                    java.util.Map.Entry<MemberProduct, Integer> deductResult = decreaseCountPassUsage(member.getId(), lessonCategory, memberProductToUse);
                                    if (deductResult != null) {
                                        deductResultForResponse = deductResult;
                                        saveProductHistory(member.getId(), deductResult.getKey(), deductResult.getValue(),
                                            deductResult.getKey().getRemainingCount(), attendance, null, "체크인으로 인한 차감");
                                    } else {
                                        deductFailReason = "이용권 차감 실패 (remainingCount가 0이거나 차감할 수 없음)";
                                    }
                                } else {
                                    deductFailReason = "활성 횟수권이 없음";
                                }
                            }
                        } catch (Exception e) {
                            logger.error("상품권 횟수 차감 실패: Member ID={}, Booking ID={}", member.getId(), finalBookingId, e);
                        }
                    } else {
                        if (!autoDeduct) deductSkipReason = "autoDeduct가 false로 설정됨";
                        else if (!isNewAttendance) deductSkipReason = "기존 출석 기록 업데이트";
                    }
                }
            }

            Attendance saved = attendanceRepository.save(attendance);

            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("checkInTime", saved.getCheckInTime());
            result.put("status", saved.getStatus() != null ? saved.getStatus().name() : null);
            result.put("message", "체크인이 완료되었습니다.");
            if (deductFailReason != null) {
                result.put("deductFailed", true);
                result.put("deductFailReason", deductFailReason);
            } else if (deductSkipReason != null) {
                result.put("deductSkipped", true);
                result.put("deductSkipReason", deductSkipReason);
            }
            if (deductResultForResponse != null) {
                try {
                    MemberProduct deductedProduct = deductResultForResponse.getKey();
                    Integer actualBefore = deductResultForResponse.getValue();
                    Integer actualAfter = deductedProduct.getRemainingCount();
                    // 대관 DEDUCT 기준 표시는 "실제 차감 전"보다 클 때는 쓰지 않음. 4/10인데 10→9로 나오는 것 방지
                    boolean useRentalDisplay = rentalDisplayBefore != null && rentalDisplayAfter != null
                        && actualBefore != null && rentalDisplayBefore <= actualBefore;
                    Integer beforeCount = useRentalDisplay ? rentalDisplayBefore : actualBefore;
                    Integer afterCount = useRentalDisplay ? rentalDisplayAfter : actualAfter;
                    Integer totalCount = deductedProduct.getTotalCount();
                    if (deductedProduct.getProduct() != null && deductedProduct.getMember() != null) {
                        try {
                            List<MemberProduct> sameProducts = memberProductRepository.findByMemberIdAndProductId(
                                deductedProduct.getMember().getId(), deductedProduct.getProduct().getId());
                            if (sameProducts != null && !sameProducts.isEmpty()) {
                                totalCount = sameProducts.stream()
                                    .filter(mp -> mp.getTotalCount() != null)
                                    .mapToInt(MemberProduct::getTotalCount)
                                    .sum();
                            }
                        } catch (Exception e) {
                            logger.warn("같은 상품 구매 조회 실패: {}", e.getMessage());
                        }
                    }
                    java.util.Map<String, Object> productDeducted = new java.util.HashMap<>();
                    productDeducted.put("productName", deductedProduct.getProduct() != null ? deductedProduct.getProduct().getName() : "이용권");
                    productDeducted.put("remainingCount", afterCount);
                    productDeducted.put("totalCount", totalCount);
                    productDeducted.put("beforeCount", beforeCount);
                    result.put("productDeducted", productDeducted);
                } catch (Exception e) {
                    logger.error("이용권 차감 정보 추가 실패: {}", e.getMessage(), e);
                }
            }

            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Long errorBookingId = checkinData.get("bookingId") != null ? ((Number) checkinData.get("bookingId")).longValue() : null;
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", e.getMessage());
            error.put("bookingId", errorBookingId);
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Long errorBookingId = checkinData.get("bookingId") != null ? ((Number) checkinData.get("bookingId")).longValue() : null;
            logger.error("체크인 처리 중 오류: Booking ID={}", errorBookingId, e);
            java.util.Map<String, Object> error = new java.util.HashMap<>();
            error.put("error", "체크인 처리 중 오류가 발생했습니다: " + e.getMessage());
            error.put("errorType", e.getClass().getSimpleName());
            error.put("bookingId", errorBookingId);
            if (e.getCause() != null) error.put("cause", e.getCause().getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/checkout")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> processCheckout(@RequestBody java.util.Map<String, Object> checkoutData) {
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

            if (attendance.getCheckOutTime() != null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "이미 체크아웃된 기록입니다.");
                return ResponseEntity.badRequest().body(error);
            }
            if (attendance.getCheckInTime() == null) {
                java.util.Map<String, Object> error = new java.util.HashMap<>();
                error.put("error", "체크인되지 않은 기록입니다.");
                return ResponseEntity.badRequest().body(error);
            }

            attendance.setCheckOutTime(java.time.LocalDateTime.now());
            Attendance saved = attendanceRepository.save(attendance);

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
