package com.afbscenter.util;

import com.afbscenter.model.Payment;
import com.afbscenter.repository.PaymentRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * 결제 목록·통계·엑셀의 기간 필터. 기본은 이번 달, {@code all}은 전체, {@code custom}은 시작·종료일 필수.
 */
@Component
public class PaymentPeriodQueryHelper {

    private final PaymentRepository paymentRepository;

    public PaymentPeriodQueryHelper(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    /**
     * @param period {@code month} (기본), {@code all}, {@code custom}
     */
    public List<Payment> loadPayments(String period, String startDate, String endDate) {
        String p = (period == null || period.isBlank()) ? "month" : period.trim();
        if ("all".equalsIgnoreCase(p)) {
            List<Payment> all = paymentRepository.findAllWithCoach();
            return all != null ? all : List.of();
        }
        LocalDateTime startDt;
        LocalDateTime endDt;
        if ("custom".equalsIgnoreCase(p)) {
            if (startDate == null || endDate == null || startDate.isBlank() || endDate.isBlank()) {
                return loadPayments("month", null, null);
            }
            LocalDate s = LocalDate.parse(startDate);
            LocalDate e = LocalDate.parse(endDate);
            startDt = s.atStartOfDay();
            endDt = e.atTime(LocalTime.MAX);
        } else {
            if (startDate != null && !startDate.isBlank() && endDate != null && !endDate.isBlank()) {
                LocalDate s = LocalDate.parse(startDate);
                LocalDate e = LocalDate.parse(endDate);
                startDt = s.atStartOfDay();
                endDt = e.atTime(LocalTime.MAX);
            } else {
                LocalDate today = LocalDate.now();
                LocalDate s = today.withDayOfMonth(1);
                LocalDate e = today.withDayOfMonth(today.lengthOfMonth());
                startDt = s.atStartOfDay();
                endDt = e.atTime(LocalTime.MAX);
            }
        }
        List<Payment> list = paymentRepository.findByPaidAtBetweenWithCoach(startDt, endDt);
        return list != null ? list : List.of();
    }
}
