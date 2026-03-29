package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Facility;
import com.afbscenter.model.LessonCategory;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.FacilityRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.util.MemberProductCountPassHelper;
import com.afbscenter.util.MemberProductPassDisplayFormatter;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 비로그인 회원이 회원번호로 본인 이용권에 맞는 예약 화면을 쓰기 위한 공개 API.
 */
@RestController
@RequestMapping("/api/public/member-booking")
public class PublicMemberBookingController {

    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final FacilityRepository facilityRepository;
    private final BookingController bookingController;
    private final FacilityController facilityController;
    private final CoachController coachController;
    private final AttendanceRepository attendanceRepository;
    private final BookingRepository bookingRepository;
    private final MemberController memberController;
    private final MemberDetailQueryController memberDetailQueryController;
    private final MemberProductController memberProductController;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PublicMemberBookingController(
            MemberRepository memberRepository,
            MemberProductRepository memberProductRepository,
            FacilityRepository facilityRepository,
            BookingController bookingController,
            FacilityController facilityController,
            CoachController coachController,
            AttendanceRepository attendanceRepository,
            BookingRepository bookingRepository,
            @Lazy MemberController memberController,
            @Lazy MemberDetailQueryController memberDetailQueryController,
            @Lazy MemberProductController memberProductController) {
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.facilityRepository = facilityRepository;
        this.bookingController = bookingController;
        this.facilityController = facilityController;
        this.coachController = coachController;
        this.attendanceRepository = attendanceRepository;
        this.bookingRepository = bookingRepository;
        this.memberController = memberController;
        this.memberDetailQueryController = memberDetailQueryController;
        this.memberProductController = memberProductController;
    }

    /** 회원번호로 최소 정보만 조회 (이용권 목록 포함) */
    @PostMapping("/verify")
    @Transactional(readOnly = true)
    public ResponseEntity<?> verify(@RequestBody Map<String, String> body) {
        String memberNumber = body != null ? body.get("memberNumber") : null;
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호를 입력해 주세요."));
        }
        memberNumber = memberNumber.trim();
        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "등록된 회원번호가 아닙니다."));
        }
        Member member = opt.get();
        List<MemberProduct> mps = memberProductRepository.findByMemberIdWithProduct(member.getId());
        List<Map<String, Object>> passes = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (MemberProduct mp : mps) {
            if (mp.getDeletedAt() != null) continue;
            if (mp.getStatus() != MemberProduct.Status.ACTIVE) continue;
            if (mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) continue;
            Product p = mp.getProduct();
            if (p == null) continue;

            if (!hasUsableRemaining(member, mp, p, today)) continue;

            Map<String, Object> passMap = buildPassMap(member, mp, p);
            if (passMap != null) passes.add(passMap);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("memberId", member.getId());
        out.put("memberNumber", member.getMemberNumber());
        out.put("name", member.getName());
        out.put("grade", member.getGrade() != null ? member.getGrade().name() : null);
        out.put("passes", passes);
        return ResponseEntity.ok(out);
    }

    /**
     * 훈련 랭킹 병합용 — 로그인 없이 회원번호만으로, 해당 회원과 동일 등급·활성 회원의 스윙/타구 등록값만 반환.
     */
    @GetMapping("/ranking-peers")
    @Transactional(readOnly = true)
    public ResponseEntity<?> rankingPeers(@RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        Optional<Member> opt = memberRepository.findByMemberNumber(memberNumber);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "등록된 회원이 아닙니다."));
        }
        Member.MemberGrade g = opt.get().getGrade() != null ? opt.get().getGrade() : Member.MemberGrade.SOCIAL;
        List<Member> peers = memberRepository.findByGradeAndStatus(g, Member.MemberStatus.ACTIVE);
        List<Map<String, Object>> members = new ArrayList<>();
        for (Member m : peers) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", m.getId());
            row.put("name", m.getName());
            row.put("memberNumber", m.getMemberNumber());
            row.put("grade", m.getGrade() != null ? m.getGrade().name() : "SOCIAL");
            row.put("swingSpeed", m.getSwingSpeed());
            row.put("exitVelocity", m.getExitVelocity());
            members.add(row);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("grade", g.name());
        out.put("members", members);
        return ResponseEntity.ok(out);
    }

    /**
     * 회원 관리 화면과 동일한 JSON 본문(회원 상세 모달용).
     * 회원번호를 아는 경우에만 조회 가능 — verify와 동일한 전제로 memberId와 일치 여부를 검증.
     */
    @GetMapping("/member-detail")
    @Transactional(readOnly = true)
    public ResponseEntity<?> memberDetailForPublic(
            @RequestParam(required = false) String memberNumber,
            @RequestParam(required = false) Long memberId,
            HttpServletRequest request) {
        if (memberNumber == null || memberNumber.isBlank() || memberId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호와 회원 ID가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberController.getMemberById(memberId, request);
    }

    /** 회원번호 + 회원 ID가 DB와 일치할 때만 true (본인 확인) */
    private boolean assertPublicMemberBookingAccess(String memberNumber, Long memberId) {
        if (memberNumber == null || memberNumber.isBlank() || memberId == null) {
            return false;
        }
        return memberRepository.findByMemberNumber(memberNumber.trim())
                .map(m -> m.getId().equals(memberId))
                .orElse(false);
    }

    /** 회원 상세 모달 탭 — 기존 API와 동일 응답, 회원번호로 본인 검증 후 위임 */
    @GetMapping("/member-products")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberProductsList(
            @RequestParam Long memberId,
            @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberProductController.getAllMemberProducts(memberId, null);
    }

    @GetMapping("/members/{id}/ability-stats-context")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicAbilityStatsContext(@PathVariable Long id, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getAbilityStatsContext(id);
    }

    @GetMapping("/members/{memberId}/products")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberProductsForHistory(@PathVariable Long memberId, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getMemberProducts(memberId);
    }

    @GetMapping("/members/{memberId}/bookings")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberBookings(@PathVariable Long memberId, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getMemberBookings(memberId);
    }

    @GetMapping("/members/{memberId}/payments")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberPayments(@PathVariable Long memberId, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getMemberPayments(memberId);
    }

    @GetMapping("/members/{memberId}/attendance")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberAttendance(@PathVariable Long memberId, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getMemberAttendance(memberId);
    }

    @GetMapping("/members/{memberId}/product-history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberProductHistory(@PathVariable Long memberId, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getMemberProductHistory(memberId);
    }

    @GetMapping("/members/{memberId}/timeline")
    @Transactional(readOnly = true)
    public ResponseEntity<?> publicMemberTimeline(@PathVariable Long memberId, @RequestParam String memberNumber) {
        if (!assertPublicMemberBookingAccess(memberNumber, memberId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 정보가 일치하지 않습니다."));
        }
        return memberDetailQueryController.getMemberTimeline(memberId);
    }

    private boolean hasUsableRemaining(Member member, MemberProduct mp, Product p, LocalDate today) {
        Product.ProductType t = p.getType();
        if (t == Product.ProductType.COUNT_PASS) {
            int rem = MemberProductCountPassHelper.resolveRemainingForRead(mp, member.getId(), attendanceRepository, bookingRepository);
            return rem > 0;
        }
        if (t == Product.ProductType.TEAM_PACKAGE) {
            return teamPackageRemainingSum(mp) > 0;
        }
        if (t == Product.ProductType.MONTHLY_PASS || t == Product.ProductType.TIME_PASS) {
            return mp.getExpiryDate() == null || !mp.getExpiryDate().isBefore(today);
        }
        if (t == Product.ProductType.SINGLE_USE) {
            Integer r = mp.getRemainingCount();
            return r == null || r > 0;
        }
        return true;
    }

    private int teamPackageRemainingSum(MemberProduct mp) {
        String json = mp.getPackageItemsRemaining();
        if (json == null || json.isBlank()) return 0;
        try {
            List<Map<String, Object>> items = objectMapper.readValue(json, new TypeReference<>() {});
            int sum = 0;
            for (Map<String, Object> item : items) {
                Object r = item.get("remaining");
                if (r instanceof Number) sum += ((Number) r).intValue();
            }
            return sum;
        } catch (Exception e) {
            return 0;
        }
    }

    /** 상품 패키지 구성(JSON)에서 총 횟수 합 — 잔여 표시 분모용 */
    private int teamPackageTotalSumFromProduct(Product p) {
        String json = p.getPackageItems();
        if (json == null || json.isBlank()) return 0;
        try {
            List<Map<String, Object>> items = objectMapper.readValue(json, new TypeReference<>() {});
            int sum = 0;
            for (Map<String, Object> item : items) {
                Object c = item.get("count");
                if (c instanceof Number) sum += ((Number) c).intValue();
            }
            return sum;
        } catch (Exception e) {
            return 0;
        }
    }

    private Integer resolveTotalCountForDisplay(MemberProduct mp, Product p) {
        if (p.getType() == Product.ProductType.TEAM_PACKAGE) {
            int t = teamPackageTotalSumFromProduct(p);
            if (t > 0) return t;
        }
        if (mp.getTotalCount() != null) return mp.getTotalCount();
        if (p.getUsageCount() != null) return p.getUsageCount();
        return null;
    }

    private Map<String, Object> buildPassMap(Member member, MemberProduct mp, Product p) {
        Product.ProductCategory cat = p.getCategory() != null ? p.getCategory() : Product.ProductCategory.GENERAL;
        boolean youth = member.getGrade() == Member.MemberGrade.YOUTH;

        String facilityType;
        String lessonCategory;
        Booking.BookingPurpose purpose;

        if (cat == Product.ProductCategory.RENTAL) {
            facilityType = Facility.FacilityType.RENTAL.name();
            lessonCategory = null;
            purpose = Booking.BookingPurpose.RENTAL;
        } else if (cat == Product.ProductCategory.TRAINING_FITNESS
                || cat == Product.ProductCategory.TRAINING
                || cat == Product.ProductCategory.PILATES) {
            facilityType = Facility.FacilityType.TRAINING_FITNESS.name();
            lessonCategory = cat == Product.ProductCategory.PILATES
                    ? LessonCategory.PILATES.name()
                    : LessonCategory.TRAINING.name();
            purpose = Booking.BookingPurpose.LESSON;
        } else if (cat == Product.ProductCategory.BASEBALL || cat == Product.ProductCategory.GENERAL) {
            facilityType = Facility.FacilityType.BASEBALL.name();
            lessonCategory = youth ? LessonCategory.YOUTH_BASEBALL.name() : LessonCategory.BASEBALL.name();
            purpose = Booking.BookingPurpose.LESSON;
        } else {
            facilityType = Facility.FacilityType.BASEBALL.name();
            lessonCategory = LessonCategory.BASEBALL.name();
            purpose = Booking.BookingPurpose.LESSON;
        }

        Map<String, Object> m = new HashMap<>();
        m.put("memberProductId", mp.getId());
        m.put("productId", p.getId());
        m.put("productName", p.getName());
        m.put("productType", p.getType() != null ? p.getType().name() : null);
        m.put("productCategory", cat.name());
        m.put("facilityType", facilityType);
        m.put("lessonCategory", lessonCategory);
        m.put("purpose", purpose.name());
        m.put("expiryDate", mp.getExpiryDate() != null ? mp.getExpiryDate().toString() : null);
        int resolvedForDisplayLine = 0;
        if (p.getType() == Product.ProductType.COUNT_PASS) {
            int rem = MemberProductCountPassHelper.resolveRemainingForRead(mp, member.getId(), attendanceRepository, bookingRepository);
            m.put("remainingCount", rem);
            resolvedForDisplayLine = rem;
        } else if (p.getType() == Product.ProductType.TEAM_PACKAGE) {
            int rem = teamPackageRemainingSum(mp);
            m.put("remainingCount", rem);
            resolvedForDisplayLine = rem;
        } else {
            m.put("remainingCount", mp.getRemainingCount());
        }
        m.put("totalCount", resolveTotalCountForDisplay(mp, p));
        String coachDisplay = MemberProductPassDisplayFormatter.resolveCoachDisplayName(mp, p);
        String displayLine = MemberProductPassDisplayFormatter.formatDisplayLine(mp, p, resolvedForDisplayLine);
        m.put("displayLine", displayLine);
        m.put("coachDisplayName", coachDisplay);
        m.put("coachName", coachDisplay);

        Coach coachEntity = mp.getCoach();
        if (coachEntity == null && p != null) {
            coachEntity = p.getCoach();
        }
        String branchDisplayKo = MemberProductPassDisplayFormatter.formatCoachAssignedBranchesKo(coachEntity);
        if (branchDisplayKo == null || branchDisplayKo.isBlank()) {
            branchDisplayKo = MemberProductPassDisplayFormatter.inferBranchLabelFromProduct(p);
        }
        m.put("coachBranchLabel", branchDisplayKo);
        m.put("coachBranchCodes", MemberProductPassDisplayFormatter.resolveCoachBranchCodes(coachEntity, p));
        m.put("coachSupportsYouthBaseball", MemberProductPassDisplayFormatter.coachSpecialtiesIncludeYouthBaseball(coachEntity));
        m.put("optionLabel", MemberProductPassDisplayFormatter.buildPassOptionLabel(displayLine, coachDisplay, branchDisplayKo));
        if (coachEntity != null) {
            m.put("coachId", coachEntity.getId());
            m.put("coachSpecialties", coachEntity.getSpecialties());
        } else {
            m.put("coachId", null);
            m.put("coachSpecialties", null);
        }
        return m;
    }

    /**
     * 운영자 캘린더와 동일한 조회(지점·시설타입·레슨종목 필터).
     * {@code memberNumber}가 있으면 해당 회원만, 지점·시설·레슨 필터는 생략 가능(종합 달력).
     */
    @GetMapping("/calendar")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> calendar(
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String lessonCategory,
            @RequestParam(required = false) String memberNumber) {
        return bookingController.getAllBookings(start, end, null, null, memberNumber, branch, facilityType, lessonCategory, true);
    }

    /**
     * 회원 예약 시간표: 동반 등으로 수업이 :30에 끝난 경우에만 그 시각을 다음 시작(30분 단위) 후보로 반환.
     * 캘린더가 본인 예약만 담을 때도 시설·일 단위로 조회해 타인 동반 종료를 반영한다.
     */
    @GetMapping("/occupancy-half-hour-starts")
    @Transactional(readOnly = true)
    public ResponseEntity<?> occupancyHalfHourStarts(
            @RequestParam Long facilityId,
            @RequestParam String date,
            @RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank() || facilityId == null || date == null || date.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "시설, 날짜, 회원번호가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        if (memberRepository.findByMemberNumber(memberNumber).isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));
        }
        if (facilityRepository.findById(facilityId).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "시설을 찾을 수 없습니다."));
        }
        LocalDate d;
        try {
            d = LocalDate.parse(date);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "날짜 형식이 올바르지 않습니다."));
        }
        LocalDateTime dayStart = d.atStartOfDay();
        LocalDateTime dayEnd = d.plusDays(1).atStartOfDay();
        List<Booking> bookings = bookingRepository.findByFacilityOverlappingDay(
                facilityId, dayStart, dayEnd, Booking.BookingStatus.CANCELLED);
        Set<String> seen = new HashSet<>();
        List<String> halfHourStartTimes = new ArrayList<>();
        for (Booking b : bookings) {
            if (b.getEndTime() == null) {
                continue;
            }
            LocalDateTime end = b.getEndTime();
            if (!end.toLocalDate().equals(d)) {
                continue;
            }
            if (end.getMinute() != 30 || end.getSecond() != 0 || end.getNano() != 0) {
                continue;
            }
            String iso = end.toString();
            if (seen.add(iso)) {
                halfHourStartTimes.add(iso);
            }
        }
        halfHourStartTimes.sort(String::compareTo);
        Map<String, Object> out = new HashMap<>();
        out.put("halfHourStartTimes", halfHourStartTimes);
        return ResponseEntity.ok(out);
    }

    /** 원본 예약 화면과 동일: 코치 이름 필터용 목록 (비로그인). branch 없으면 전 지점 코치 */
    @GetMapping("/coaches")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Coach>> coaches(@RequestParam(required = false) String branch) {
        return coachController.getAllCoaches(branch);
    }

    @GetMapping("/facilities")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Facility>> facilities(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String facilityType) {
        return facilityController.getAllFacilities(branch, facilityType);
    }

    @GetMapping("/facilities/{id}/slots")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> facilitySlots(@PathVariable Long id) {
        return facilityController.getFacilitySlots(id);
    }

    @GetMapping("/facilities/{id}/available-slots")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, String>>> availableSlots(
            @PathVariable Long id,
            @RequestParam String date) {
        return facilityController.getAvailableSlots(id, date);
    }

    /**
     * 본인 예약 단건 조회 — 운영 화면 {@link BookingController#getBookingById(Long)}와 동일 응답.
     */
    @GetMapping("/bookings/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getBookingForPublicViewer(
            @PathVariable Long id,
            @RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        Booking booking = bookingRepository.findByIdWithAllRelations(id);
        if (booking == null) {
            return ResponseEntity.notFound().build();
        }
        if (booking.getMember() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 예약만 조회할 수 있습니다."));
        }
        if (!assertPublicMemberBookingAccess(memberNumber, booking.getMember().getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "본인 예약만 조회할 수 있습니다."));
        }
        return bookingController.getBookingById(id);
    }

    /**
     * 본인 예약 삭제(취소) — 승인 대기(PENDING)만 허용. 처리 로직은 {@link BookingController#deleteBooking(Long)} 위임.
     */
    @DeleteMapping("/bookings/{id}")
    @Transactional
    public ResponseEntity<?> deleteBookingForPublicMember(
            @PathVariable Long id,
            @RequestParam String memberNumber) {
        if (memberNumber == null || memberNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        memberNumber = memberNumber.trim();
        Booking booking = bookingRepository.findByIdWithAllRelations(id);
        if (booking == null) {
            return ResponseEntity.notFound().build();
        }
        if (booking.getMember() == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "회원 예약만 삭제할 수 있습니다."));
        }
        if (!assertPublicMemberBookingAccess(memberNumber, booking.getMember().getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "본인 예약만 삭제할 수 있습니다."));
        }
        if (booking.getStatus() != Booking.BookingStatus.PENDING) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "승인 대기 중인 예약만 회원 화면에서 취소할 수 있습니다. 확정된 예약은 데스크에 문의해 주세요."));
        }
        return bookingController.deleteBooking(id);
    }

    @PostMapping("/bookings")
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> createMemberBooking(
            @RequestBody Map<String, Object> requestData,
            HttpServletRequest request) {
        String memberNumber = requestData.get("memberNumber") != null ? requestData.get("memberNumber").toString().trim() : null;
        if (memberNumber == null || memberNumber.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "회원번호가 필요합니다."));
        }
        Optional<Member> mOpt = memberRepository.findByMemberNumber(memberNumber);
        if (mOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "회원을 찾을 수 없습니다."));
        }
        Member member = mOpt.get();

        Object mpIdObj = requestData.get("memberProductId");
        if (mpIdObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "이용권을 선택해 주세요."));
        }
        long memberProductId;
        try {
            memberProductId = mpIdObj instanceof Number ? ((Number) mpIdObj).longValue() : Long.parseLong(mpIdObj.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "이용권 ID가 올바르지 않습니다."));
        }

        MemberProduct mp = memberProductRepository.findByIdWithMember(memberProductId).orElse(null);
        if (mp == null || mp.getDeletedAt() != null) {
            return ResponseEntity.badRequest().body(Map.of("error", "이용권을 찾을 수 없습니다."));
        }
        if (mp.getMember() == null || !mp.getMember().getId().equals(member.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "해당 이용권은 본인 것이 아닙니다."));
        }

        Object facilityObj = requestData.get("facility");
        if (!(facilityObj instanceof Map)) {
            return ResponseEntity.badRequest().body(Map.of("error", "시설 정보가 필요합니다."));
        }
        Object fid = ((Map<?, ?>) facilityObj).get("id");
        long facilityId;
        try {
            facilityId = fid instanceof Number ? ((Number) fid).longValue() : Long.parseLong(fid.toString());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "시설 ID가 올바르지 않습니다."));
        }
        Facility facility = facilityRepository.findById(facilityId).orElse(null);
        if (facility == null || Boolean.FALSE.equals(facility.getActive())) {
            return ResponseEntity.badRequest().body(Map.of("error", "시설을 찾을 수 없습니다."));
        }

        Product product = mp.getProduct();
        if (product == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "상품 정보가 없습니다."));
        }

        String branchStr = requestData.get("branch") != null ? requestData.get("branch").toString().trim() : null;
        if (branchStr == null || branchStr.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "지점(branch)이 필요합니다."));
        }
        Booking.Branch bookingBranch;
        try {
            bookingBranch = Booking.Branch.valueOf(branchStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "지점 값이 올바르지 않습니다."));
        }
        if (facility.getBranch() == null || !facility.getBranch().name().equals(bookingBranch.name())) {
            return ResponseEntity.badRequest().body(Map.of("error", "선택한 시설은 해당 지점이 아닙니다."));
        }

        LessonCategory lc = null;
        if (requestData.get("lessonCategory") != null && !requestData.get("lessonCategory").toString().isBlank()) {
            try {
                lc = LessonCategory.valueOf(requestData.get("lessonCategory").toString().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "레슨 종목이 올바르지 않습니다."));
            }
        }

        if (!isProductCompatibleWithFacility(product, facility, lc)) {
            return ResponseEntity.badRequest().body(Map.of("error", "선택한 이용권으로는 이 시설·종목에 예약할 수 없습니다."));
        }

        if (lc == LessonCategory.YOUTH_BASEBALL && member.getGrade() != Member.MemberGrade.YOUTH) {
            return ResponseEntity.badRequest().body(Map.of("error", "유소년 예약은 유소년 등급 회원만 가능합니다."));
        }

        requestData.put("bookingSource", "MEMBER_WEB");
        return bookingController.createBooking(requestData, request);
    }

    private boolean isProductCompatibleWithFacility(Product p, Facility f, LessonCategory lc) {
        Product.ProductCategory cat = p.getCategory() != null ? p.getCategory() : Product.ProductCategory.GENERAL;
        Facility.FacilityType ft = f.getFacilityType();

        if (ft == Facility.FacilityType.RENTAL) {
            return cat == Product.ProductCategory.RENTAL;
        }
        if (cat == Product.ProductCategory.RENTAL) {
            return ft == Facility.FacilityType.RENTAL;
        }

        if (ft == Facility.FacilityType.BASEBALL || (ft == Facility.FacilityType.ALL && lc != null
                && (lc == LessonCategory.BASEBALL || lc == LessonCategory.YOUTH_BASEBALL))) {
            return cat == Product.ProductCategory.BASEBALL || cat == Product.ProductCategory.GENERAL;
        }
        if (ft == Facility.FacilityType.TRAINING_FITNESS
                || (ft == Facility.FacilityType.ALL && lc != null && (lc == LessonCategory.TRAINING || lc == LessonCategory.PILATES))) {
            return cat == Product.ProductCategory.TRAINING_FITNESS
                    || cat == Product.ProductCategory.TRAINING
                    || cat == Product.ProductCategory.PILATES
                    || cat == Product.ProductCategory.GENERAL;
        }
        if (ft == Facility.FacilityType.ALL) {
            return true;
        }
        return ft == Facility.FacilityType.BASEBALL || ft == Facility.FacilityType.TRAINING_FITNESS;
    }
}
