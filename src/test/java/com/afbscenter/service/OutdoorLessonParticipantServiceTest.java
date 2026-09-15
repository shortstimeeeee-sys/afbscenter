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
