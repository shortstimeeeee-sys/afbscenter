package com.afbscenter.service;

import com.afbscenter.model.Booking;
import com.afbscenter.model.OutdoorLessonParticipant;
import com.afbscenter.model.Product;
import com.afbscenter.repository.OutdoorLessonParticipantRepository;
import com.afbscenter.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutdoorLessonParticipantServiceTest {

    @Mock
    OutdoorLessonParticipantRepository repository;

    @Mock
    ProductRepository productRepository;

    @Mock
    com.afbscenter.repository.MemberRepository memberRepository;

    @Mock
    com.afbscenter.repository.MemberProductRepository memberProductRepository;

    @Mock
    com.afbscenter.repository.SocialScrimmageParticipantRepository socialScrimmageParticipantRepository;

    @InjectMocks
    OutdoorLessonParticipantService service;

    @Test
    void replace_skipsBlankNamesAndRenumbers() {
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<Map<String, Object>> rows = List.of(
                Map.of("name", "  ", "team", "A"),
                Map.of("name", "홍길동", "team", "B팀", "phone", "010-1111-2222", "depositConfirmed", true)
        );
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-13"), Booking.Branch.SAHA, rows);
        assertEquals(1, saved.size());
        assertEquals(1, saved.get(0).getSeqNo());
        assertEquals("홍길동", saved.get(0).getName());
        assertEquals("B팀", saved.get(0).getTeam());
        assertTrue(saved.get(0).isDepositConfirmed());
        assertNull(saved.get(0).getProductId());
        verify(repository).deleteByLessonDate(LocalDate.parse("2026-09-13"));
    }

    @Test
    void list_fallsBackToOtherBranchWhenRequestedBranchEmpty() {
        LocalDate date = LocalDate.parse("2026-09-14");
        OutdoorLessonParticipant row = new OutdoorLessonParticipant();
        row.setName("박진성");
        when(repository.findByLessonDateAndBranchOrderBySeqNoAscIdAsc(date, Booking.Branch.YEONSAN))
                .thenReturn(List.of());
        when(repository.findByLessonDateOrderBySeqNoAscIdAsc(date)).thenReturn(List.of(row));

        List<OutdoorLessonParticipant> result = service.list(date, Booking.Branch.YEONSAN);

        assertEquals(1, result.size());
        assertEquals("박진성", result.get(0).getName());
    }

    @Test
    void replace_movesRosterOffPreviousDate() {
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        LocalDate from = LocalDate.parse("2026-09-09");
        LocalDate to = LocalDate.parse("2026-09-13");
        service.replace(to, Booking.Branch.SAHA, List.of(Map.of("name", "장영석")), from);
        verify(repository).deleteByLessonDate(from);
        verify(repository).deleteByLessonDate(to);
    }

    @Test
    void replace_setsAmountFromOutdoorLessonPlan() {
        Product oneDay = new Product();
        oneDay.setId(36L);
        oneDay.setName("사회인 야외 1회권");
        oneDay.setPrice(25000);
        oneDay.setCategory(Product.ProductCategory.OUTDOOR_LESSON);
        oneDay.setType(Product.ProductType.DAY_PASS);
        oneDay.setActive(true);
        when(productRepository.findById(36L)).thenReturn(Optional.of(oneDay));
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));

        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-14"),
                Booking.Branch.SAHA,
                List.of(Map.of("name", "박진성", "productId", 36, "depositConfirmed", true)));

        assertEquals(36L, saved.get(0).getProductId());
        assertEquals(25000, saved.get(0).getDepositAmount());
    }

    @Test
    void listPlans_returnsActiveOutdoorLessonProductsByPrice() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        Product one = plan(36L, "사회인 야외 1회권", 25000);
        Product baseball = new Product();
        baseball.setId(2L);
        baseball.setName("야구레슨 10회권");
        baseball.setPrice(500000);
        baseball.setCategory(Product.ProductCategory.BASEBALL);
        baseball.setActive(true);
        when(productRepository.findByActiveTrue()).thenReturn(List.of(ten, baseball, one));

        List<Map<String, Object>> plans = service.listPlans(List.of());
        assertEquals(2, plans.size());
        assertEquals(36L, plans.get(0).get("id"));
        assertEquals(25000, plans.get(0).get("price"));
        assertEquals(37L, plans.get(1).get("id"));
        assertEquals(200000, plans.get(1).get("price"));
    }

    @Test
    void listPlans_includesTeamPackageProducts() {
        Product team = new Product();
        team.setId(80L);
        team.setName("사회인 팀 대관 10회");
        team.setPrice(1500000);
        team.setType(Product.ProductType.TEAM_PACKAGE);
        team.setCategory(Product.ProductCategory.BASEBALL);
        team.setActive(true);
        Product one = plan(36L, "사회인 야외 1회권", 25000);
        when(productRepository.findByActiveTrue()).thenReturn(List.of(team, one));

        List<Map<String, Object>> plans = service.listPlans(List.of());
        assertEquals(2, plans.size());
        Map<String, Object> teamPlan = plans.stream()
                .filter(p -> Long.valueOf(80L).equals(p.get("id")))
                .findFirst()
                .orElseThrow();
        assertEquals(Boolean.TRUE, teamPlan.get("teamPackage"));
        assertEquals(Boolean.TRUE, teamPlan.get("countPass"));
    }

    @Test
    void replace_savesTeamHeadcount() {
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-14"),
                Booking.Branch.SAHA,
                List.of(Map.of("name", "나르샤", "team", "나르샤", "headcount", 12, "teamBooking", true)));
        assertEquals(1, saved.size());
        assertEquals(12, saved.get(0).getHeadcount());
        assertEquals("나르샤", saved.get(0).getTeam());
        assertTrue(saved.get(0).isTeamBooking());
    }

    @Test
    void replace_rejectsTeamHeadcountOverRemaining() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.replace(
                        LocalDate.parse("2026-09-24"),
                        Booking.Branch.SAHA,
                        List.of(Map.of(
                                "name", "나르샤",
                                "team", "나르샤",
                                "headcount", 8,
                                "teamBooking", true,
                                "productId", 37,
                                "remainingCount", 7))));
        assertTrue(ex.getMessage().contains("잔여 7회"));
        assertTrue(ex.getMessage().contains("인원이 8명"));
    }

    @Test
    void replace_keepsRemainingUntilParticipation() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-24"),
                Booking.Branch.SAHA,
                List.of(Map.of(
                        "name", "나르샤",
                        "team", "나르샤",
                        "headcount", 7,
                        "teamBooking", true,
                        "productId", 37,
                        "remainingCount", 7)));
        assertEquals(7, saved.get(0).getHeadcount());
        assertEquals(7, saved.get(0).getRemainingCount());
        assertFalse(saved.get(0).isCountPassApplied());
        assertEquals(7, service.remainingToShow(saved.get(0)));
        assertEquals(0, saved.get(0).getDepositAmount());
    }

    @Test
    void replace_newTenPassChargesPrice() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-28"),
                Booking.Branch.SAHA,
                List.of(Map.of(
                        "name", "김건수",
                        "productId", 37,
                        "depositConfirmed", true,
                        "remainingCount", 10)));
        assertEquals(10, saved.get(0).getRemainingCount());
        assertEquals(200000, saved.get(0).getDepositAmount());
        assertFalse(service.isPrepaidCountPass(saved.get(0)));
    }

    @Test
    void replace_priorTenPassVisitDoesNotChargeAgain() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        OutdoorLessonParticipant earlier = new OutdoorLessonParticipant();
        earlier.setName("김건수");
        earlier.setPhone("010-4799-6817");
        earlier.setProductId(37L);
        earlier.setLessonDate(LocalDate.parse("2026-09-14"));
        earlier.setDepositAmount(200000);
        earlier.setDepositConfirmed(true);
        earlier.setRemainingCount(10);
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        when(repository.findByProductIdAndLessonDateBefore(37L, LocalDate.parse("2026-09-28")))
                .thenReturn(List.of(earlier));
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-28"),
                Booking.Branch.SAHA,
                List.of(Map.of(
                        "name", "김건수",
                        "phone", "010-4799-6817",
                        "productId", 37,
                        "depositConfirmed", true,
                        "remainingCount", 10)));
        assertEquals(0, saved.get(0).getDepositAmount());
        assertTrue(service.isPrepaidCountPass(saved.get(0)));
    }

    @Test
    void replace_tenPassPurchasedOnLessonDateChargesPrice() {
        com.afbscenter.model.Member member = new com.afbscenter.model.Member();
        member.setId(9L);
        member.setName("이강산");
        member.setStatus(com.afbscenter.model.Member.MemberStatus.ACTIVE);
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        com.afbscenter.model.MemberProduct mp = new com.afbscenter.model.MemberProduct();
        mp.setProduct(ten);
        mp.setRemainingCount(10);
        mp.setTotalCount(10);
        mp.setStatus(com.afbscenter.model.MemberProduct.Status.ACTIVE);
        mp.setPurchaseDate(java.time.LocalDateTime.of(2026, 9, 28, 10, 0));
        when(memberRepository.findByName("이강산")).thenReturn(List.of(member));
        when(memberProductRepository.findByMemberIdWithProduct(9L)).thenReturn(List.of(mp));
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-28"),
                Booking.Branch.SAHA,
                List.of(Map.of(
                        "name", "이강산",
                        "productId", 37,
                        "depositConfirmed", true,
                        "remainingCount", 10)));
        assertEquals(200000, saved.get(0).getDepositAmount());
        assertFalse(service.isPrepaidCountPass(saved.get(0)));
    }

    @Test
    void remainingToShow_afterAppliedUsesHeadcount() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        OutdoorLessonParticipant row = new OutdoorLessonParticipant();
        row.setProductId(37L);
        row.setRemainingCount(7);
        row.setTeamBooking(true);
        row.setHeadcount(7);
        row.setCountPassApplied(true);
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        assertEquals(0, service.remainingToShow(row));
        row.setHeadcount(3);
        assertEquals(4, service.remainingToShow(row));
    }

    @Test
    void carryOver_movesSavedParticipantAndKeepsDeposit() {
        OutdoorLessonParticipant source = new OutdoorLessonParticipant();
        source.setId(10L);
        source.setLessonDate(LocalDate.parse("2026-09-14"));
        source.setBranch(Booking.Branch.SAHA);
        source.setSeqNo(2);
        source.setName("홍길동");
        source.setTeam("나르샤");
        source.setPhone("010-1111-2222");
        source.setProductId(36L);
        source.setDepositAmount(25000);
        source.setDepositConfirmed(true);
        when(repository.findById(10L)).thenReturn(Optional.of(source));
        when(repository.findByLessonDateOrderBySeqNoAscIdAsc(LocalDate.parse("2026-09-21")))
                .thenReturn(List.of());
        when(repository.findByLessonDateOrderBySeqNoAscIdAsc(LocalDate.parse("2026-09-14")))
                .thenReturn(List.of());
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));

        OutdoorLessonParticipant moved = service.carryOver(
                LocalDate.parse("2026-09-14"),
                LocalDate.parse("2026-09-21"),
                Booking.Branch.SAHA,
                Map.of("id", 10, "name", "홍길동"));

        assertEquals("홍길동", moved.getName());
        assertEquals("나르샤", moved.getTeam());
        assertEquals(LocalDate.parse("2026-09-21"), moved.getLessonDate());
        assertEquals(LocalDate.parse("2026-09-14"), moved.getCarriedFromDate());
        assertTrue(moved.isDepositConfirmed());
        assertEquals(36L, moved.getProductId());
        assertEquals(25000, moved.getDepositAmount());
        assertEquals(1, moved.getSeqNo());
        verify(repository).delete(source);
    }

    @Test
    void replace_keepsAttendanceFlag() {
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        List<OutdoorLessonParticipant> saved = service.replace(
                LocalDate.parse("2026-09-14"),
                Booking.Branch.SAHA,
                List.of(Map.of("name", "홍길동", "attended", true)));
        assertTrue(saved.get(0).isAttended());
    }

    @Test
    void markAttendance_setsFlag() {
        OutdoorLessonParticipant row = new OutdoorLessonParticipant();
        row.setId(7L);
        row.setName("홍길동");
        row.setAttended(false);
        when(repository.findById(7L)).thenReturn(Optional.of(row));
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));
        OutdoorLessonParticipant saved = service.markAttendance(7L, true);
        assertTrue(saved.isAttended());
    }

    @Test
    void carryOver_resetsAttendanceOnNewDate() {
        OutdoorLessonParticipant source = new OutdoorLessonParticipant();
        source.setId(10L);
        source.setLessonDate(LocalDate.parse("2026-09-14"));
        source.setBranch(Booking.Branch.SAHA);
        source.setSeqNo(1);
        source.setName("홍길동");
        source.setAttended(true);
        when(repository.findById(10L)).thenReturn(Optional.of(source));
        when(repository.findByLessonDateOrderBySeqNoAscIdAsc(LocalDate.parse("2026-09-21")))
                .thenReturn(List.of());
        when(repository.findByLessonDateOrderBySeqNoAscIdAsc(LocalDate.parse("2026-09-14")))
                .thenReturn(List.of());
        when(repository.save(any(OutdoorLessonParticipant.class))).thenAnswer(inv -> inv.getArgument(0));

        OutdoorLessonParticipant moved = service.carryOver(
                LocalDate.parse("2026-09-14"),
                LocalDate.parse("2026-09-21"),
                Booking.Branch.SAHA,
                Map.of("id", 10, "name", "홍길동"));

        assertEquals("홍길동", moved.getName());
        assertFalse(moved.isAttended());
    }

    @Test
    void carryOver_rejectsSameDate() {
        assertThrows(IllegalArgumentException.class, () ->
                service.carryOver(
                        LocalDate.parse("2026-09-14"),
                        LocalDate.parse("2026-09-14"),
                        Booking.Branch.SAHA,
                        Map.of("name", "홍길동")));
    }

    @Test
    void lookupMemberCountPass_setsOutdoorTenPassByNameAndPhone() {
        com.afbscenter.model.Member member = new com.afbscenter.model.Member();
        member.setId(5L);
        member.setName("김광민");
        member.setPhoneNumber("010-2222-3333");
        member.setStatus(com.afbscenter.model.Member.MemberStatus.ACTIVE);
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        com.afbscenter.model.MemberProduct mp = new com.afbscenter.model.MemberProduct();
        mp.setProduct(ten);
        mp.setRemainingCount(8);
        mp.setStatus(com.afbscenter.model.MemberProduct.Status.ACTIVE);
        when(memberRepository.findByName("김광민")).thenReturn(List.of(member));
        when(memberProductRepository.findByMemberIdWithProduct(5L)).thenReturn(List.of(mp));
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));

        Map<String, Object> found = service.lookupMemberCountPass("김광민", "010-2222-3333");
        assertEquals(37L, found.get("productId"));
        assertEquals(8, found.get("remainingCount"));
        assertEquals(10, found.get("totalCount"));
        assertEquals(true, found.get("depositConfirmed"));
        assertEquals(true, found.get("prepaidPass"));
        assertEquals(0, found.get("depositAmount"));
    }

    @Test
    void lookupMemberCountPass_ignoresSameNameDifferentPhone() {
        com.afbscenter.model.Member member = new com.afbscenter.model.Member();
        member.setId(5L);
        member.setName("김광민");
        member.setPhoneNumber("010-0000-0000");
        member.setStatus(com.afbscenter.model.Member.MemberStatus.ACTIVE);
        when(memberRepository.findByName("김광민")).thenReturn(List.of(member));

        Map<String, Object> found = service.lookupMemberCountPass("김광민", "010-2222-3333");
        assertTrue(found.isEmpty());
    }

    @Test
    void suggestCountPassCarryOver_deductsOneAfterPreviousDatePassed() {
        LocalDate prev = LocalDate.parse("2026-09-14");
        LocalDate next = LocalDate.parse("2026-09-21");
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        OutdoorLessonParticipant source = new OutdoorLessonParticipant();
        source.setName("김광민");
        source.setPhone("010-2222-3333");
        source.setProductId(37L);
        source.setRemainingCount(10);
        source.setDepositConfirmed(true);
        source.setBranch(Booking.Branch.SAHA);
        when(repository.findLatestLessonDateBefore(next)).thenReturn(Optional.of(prev));
        when(repository.findByLessonDateOrderBySeqNoAscIdAsc(prev)).thenReturn(List.of(source));
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));

        List<OutdoorLessonParticipant> suggested = service.suggestCountPassCarryOver(
                next, Booking.Branch.SAHA, LocalDate.parse("2026-09-18"));

        assertEquals(1, suggested.size());
        assertEquals("김광민", suggested.get(0).getName());
        assertEquals(37L, suggested.get(0).getProductId());
        assertEquals(9, suggested.get(0).getRemainingCount());
        assertEquals(0, suggested.get(0).getDepositAmount());
        assertEquals(prev, suggested.get(0).getCarriedFromDate());
    }

    @Test
    void remainingToShow_keepsPastDateAtStartCount() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        OutdoorLessonParticipant row = new OutdoorLessonParticipant();
        row.setProductId(37L);
        row.setRemainingCount(10);
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        assertEquals(10, service.remainingToShow(row));
        assertEquals(10, service.totalCountToShow(row));
    }

    @Test
    @SuppressWarnings("unchecked")
    void history_groupsMembersAndCountsPassOnce() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        Product one = plan(36L, "사회인 야외 1회권", 25000);
        OutdoorLessonParticipant a1 = row("김광민", "010-2222-3333", "나르샤",
                LocalDate.parse("2026-09-07"), 37L, 200000, true, 10, false);
        OutdoorLessonParticipant a2 = row("김광민", "010-2222-3333", "나르샤",
                LocalDate.parse("2026-09-14"), 37L, 200000, true, 9, true);
        OutdoorLessonParticipant b1 = row("박진성", "010-1111-0000", "B팀",
                LocalDate.parse("2026-09-07"), 36L, 25000, true, null, true);
        when(repository.findAllByOrderByLessonDateAscSeqNoAscIdAsc()).thenReturn(List.of(a1, b1, a2));
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));
        when(productRepository.findById(36L)).thenReturn(Optional.of(one));

        Map<String, Object> history = service.history();
        List<Map<String, Object>> members = (List<Map<String, Object>>) history.get("members");
        List<Map<String, Object>> expenses = (List<Map<String, Object>>) history.get("expenses");
        Map<String, Object> totals = (Map<String, Object>) history.get("totals");

        assertEquals(2, members.size());
        Map<String, Object> kim = members.stream()
                .filter(m -> "김광민".equals(m.get("name")))
                .findFirst()
                .orElseThrow();
        assertEquals(2, kim.get("visitCount"));
        assertEquals(1, kim.get("attendedCount"));
        assertEquals(200000L, ((Number) kim.get("paidAmount")).longValue());
        assertEquals(9, kim.get("remainingCount"));
        assertEquals(10, kim.get("totalCount"));
        List<Map<String, Object>> visits = (List<Map<String, Object>>) kim.get("visits");
        assertEquals("2026-09-07", visits.get(0).get("lessonDate"));
        assertEquals("2026-09-14", visits.get(1).get("lessonDate"));

        Map<String, Object> park = members.stream()
                .filter(m -> "박진성".equals(m.get("name")))
                .findFirst()
                .orElseThrow();
        assertEquals(25000L, ((Number) park.get("paidAmount")).longValue());
        assertEquals(1, park.get("visitCount"));

        assertEquals(2, expenses.size());
        assertEquals(300000, expenses.get(0).get("amount"));
        assertEquals(2, totals.get("memberCount"));
        assertEquals(3, totals.get("visitCount"));
        assertEquals(225000L, ((Number) totals.get("paidAmount")).longValue());
        assertEquals(600000L, ((Number) totals.get("expenseAmount")).longValue());
        assertEquals(-375000L, ((Number) totals.get("netAmount")).longValue());
    }

    @Test
    @SuppressWarnings("unchecked")
    void history_treatsSameNameAndPhoneAsOnePerson() {
        Product one = plan(36L, "사회인 야외 1회권", 25000);
        OutdoorLessonParticipant a1 = row("김 광민", "010-2222-3333", "나르샤",
                LocalDate.parse("2026-09-07"), 36L, 25000, true, null, true);
        OutdoorLessonParticipant a2 = row("김광민", "01022223333", "나르샤",
                LocalDate.parse("2026-09-14"), 36L, 25000, true, null, true);
        OutdoorLessonParticipant a3 = row("김광민", "", "나르샤",
                LocalDate.parse("2026-09-21"), 36L, 25000, true, null, false);
        when(repository.findAllByOrderByLessonDateAscSeqNoAscIdAsc()).thenReturn(List.of(a1, a2, a3));
        when(productRepository.findById(36L)).thenReturn(Optional.of(one));

        Map<String, Object> history = service.history();
        List<Map<String, Object>> members = (List<Map<String, Object>>) history.get("members");
        Map<String, Object> totals = (Map<String, Object>) history.get("totals");

        assertEquals(3, members.size());
        assertEquals(1, totals.get("memberCount"));
        Map<String, Object> kim = members.get(0);
        assertEquals("김광민", kim.get("name"));
        assertEquals(1, kim.get("visitCount"));
        assertEquals("010-2222-3333", kim.get("phone"));
        long paid = members.stream()
                .mapToLong(m -> ((Number) m.get("paidAmount")).longValue())
                .sum();
        assertEquals(75000L, paid);
        assertEquals(75000L, ((Number) totals.get("paidAmount")).longValue());
        assertEquals(3, totals.get("visitCount"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void history_keepsSingleVisitSeparateFromLaterCountPass() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        Product one = plan(36L, "사회인 야외 1회권", 25000);
        OutdoorLessonParticipant oneVisit = row("김건수", "010-4799-6817", "2회차",
                LocalDate.parse("2026-09-14"), 36L, 25000, true, null, true);
        OutdoorLessonParticipant tenVisit = row("김건수", "010-4799-6817", "2회차",
                LocalDate.parse("2026-09-28"), 37L, 200000, true, 10, true);
        when(repository.findAllByOrderByLessonDateAscSeqNoAscIdAsc()).thenReturn(List.of(oneVisit, tenVisit));
        when(productRepository.findById(36L)).thenReturn(Optional.of(one));
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));

        Map<String, Object> history = service.history();
        List<Map<String, Object>> members = (List<Map<String, Object>>) history.get("members");
        Map<String, Object> totals = (Map<String, Object>) history.get("totals");

        assertEquals(2, members.size());
        assertEquals(1, totals.get("memberCount"));

        Map<String, Object> single = members.stream()
                .filter(m -> "사회인 야외 1회권".equals(m.get("planName")))
                .findFirst()
                .orElseThrow();
        assertEquals(1, single.get("visitCount"));
        assertEquals(25000L, ((Number) single.get("paidAmount")).longValue());
        List<Map<String, Object>> singleVisits = (List<Map<String, Object>>) single.get("visits");
        assertEquals("2026-09-14", singleVisits.get(0).get("lessonDate"));

        Map<String, Object> countPass = members.stream()
                .filter(m -> "사회인 야외 10회권".equals(m.get("planName")))
                .findFirst()
                .orElseThrow();
        assertEquals(1, countPass.get("visitCount"));
        assertEquals(10, countPass.get("totalCount"));
        assertEquals(200000L, ((Number) countPass.get("paidAmount")).longValue());
        List<Map<String, Object>> countVisits = (List<Map<String, Object>>) countPass.get("visits");
        assertEquals("2026-09-28", countVisits.get(0).get("lessonDate"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void history_prepaidRemainingCountPassKeepsOriginalPrice() {
        Product ten = plan(37L, "사회인 야외 10회권", 200000);
        ten.setType(Product.ProductType.COUNT_PASS);
        ten.setUsageCount(10);
        OutdoorLessonParticipant carried = row("슈독스", "123423213412", "슈독스 사회인 야구팀",
                LocalDate.parse("2026-09-28"), 37L, 0, true, 7, false);
        carried.setTeamBooking(true);
        carried.setHeadcount(7);
        when(repository.findAllByOrderByLessonDateAscSeqNoAscIdAsc()).thenReturn(List.of(carried));
        when(productRepository.findById(37L)).thenReturn(Optional.of(ten));

        Map<String, Object> history = service.history();
        List<Map<String, Object>> members = (List<Map<String, Object>>) history.get("members");
        Map<String, Object> sudox = members.get(0);
        assertEquals(200000L, ((Number) sudox.get("paidAmount")).longValue());
        List<Map<String, Object>> visits = (List<Map<String, Object>>) sudox.get("visits");
        assertEquals(0, ((Number) visits.get(0).get("amount")).intValue());
        assertEquals(200000L, ((Number) ((Map<String, Object>) history.get("totals")).get("paidAmount")).longValue());
    }

    private static OutdoorLessonParticipant row(String name, String phone, String team,
                                                LocalDate date, Long productId, Integer amount,
                                                boolean confirmed, Integer remaining, boolean attended) {
        OutdoorLessonParticipant p = new OutdoorLessonParticipant();
        p.setName(name);
        p.setPhone(phone);
        p.setTeam(team);
        p.setLessonDate(date);
        p.setProductId(productId);
        p.setDepositAmount(amount);
        p.setDepositConfirmed(confirmed);
        p.setRemainingCount(remaining);
        p.setAttended(attended);
        p.setBranch(Booking.Branch.SAHA);
        return p;
    }

    private static Product plan(Long id, String name, int price) {
        Product product = new Product();
        product.setId(id);
        product.setName(name);
        product.setPrice(price);
        product.setCategory(Product.ProductCategory.OUTDOOR_LESSON);
        product.setType(Product.ProductType.DAY_PASS);
        product.setActive(true);
        return product;
    }
}
