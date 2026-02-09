package com.afbscenter.controller;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Payment;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.PaymentRepository;
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
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 결제 통계·리포트 전용. URL은 기존과 동일: /api/payments/summary, /statistics/method, /unpaid/details, /export/excel
 */
@RestController
@RequestMapping("/api/payments")
public class PaymentStatsController {

    private static final Logger logger = LoggerFactory.getLogger(PaymentStatsController.class);

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;

    public PaymentStatsController(PaymentRepository paymentRepository, BookingRepository bookingRepository) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getPaymentSummary() {
        try {
            LocalDate today = LocalDate.now();
            LocalDateTime startOfDay = today.atStartOfDay();
            LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

            Integer todayRevenue = paymentRepository.sumAmountByDateRange(startOfDay, endOfDay);
            if (todayRevenue == null) todayRevenue = 0;

            LocalDate monthStart = today.withDayOfMonth(1);
            LocalDateTime monthStartDateTime = monthStart.atStartOfDay();
            LocalDateTime monthEndDateTime = today.atTime(LocalTime.MAX);
            Integer monthRevenue = paymentRepository.sumAmountByDateRange(monthStartDateTime, monthEndDateTime);
            if (monthRevenue == null) monthRevenue = 0;

            LocalDate yesterday = today.minusDays(1);
            LocalDateTime startOfYesterday = yesterday.atStartOfDay();
            LocalDateTime endOfYesterday = yesterday.atTime(LocalTime.MAX);
            Integer yesterdayRevenue = paymentRepository.sumAmountByDateRange(startOfYesterday, endOfYesterday);
            if (yesterdayRevenue == null) yesterdayRevenue = 0;

            LocalDate lastMonthEnd = monthStart.minusDays(1);
            LocalDate lastMonthStart = lastMonthEnd.withDayOfMonth(1);
            LocalDateTime lastMonthStartDateTime = lastMonthStart.atStartOfDay();
            LocalDateTime lastMonthEndDateTime = lastMonthEnd.atTime(LocalTime.MAX);
            Integer lastMonthRevenue = paymentRepository.sumAmountByDateRange(lastMonthStartDateTime, lastMonthEndDateTime);
            if (lastMonthRevenue == null) lastMonthRevenue = 0;

            Integer unpaid = 0;
            try {
                List<Booking> confirmedBookings = new ArrayList<>();
                confirmedBookings.addAll(bookingRepository.findByStatus(Booking.BookingStatus.CONFIRMED));
                confirmedBookings.addAll(bookingRepository.findByStatus(Booking.BookingStatus.COMPLETED));

                for (Booking booking : confirmedBookings) {
                    if (booking.getPaymentMethod() == Booking.PaymentMethod.PREPAID) {
                        continue;
                    }
                    if (booking.getMemberProduct() != null) {
                        continue;
                    }
                    List<Payment> bookingPayments = paymentRepository.findByBookingId(booking.getId());
                    if (bookingPayments == null || bookingPayments.isEmpty()) {
                        if (booking.getPaymentMethod() != Booking.PaymentMethod.PREPAID) {
                            unpaid++;
                        }
                    }
                }
            } catch (Exception e) {
                logger.warn("미수금 계산 중 오류 발생", e);
            }

            Integer refundPending = 0;
            try {
                List<Payment> allPayments = paymentRepository.findAll();
                refundPending = (int) allPayments.stream()
                        .filter(p -> p.getRefundAmount() != null && p.getRefundAmount() > 0 &&
                                p.getStatus() != Payment.PaymentStatus.REFUNDED)
                        .count();
            } catch (Exception e) {
                logger.warn("환불 대기 계산 중 오류 발생", e);
            }

            Map<String, Object> summary = new HashMap<>();
            double todayChangeRate = 0.0;
            if (yesterdayRevenue > 0) {
                todayChangeRate = ((double) (todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
            } else if (todayRevenue > 0) {
                todayChangeRate = 100.0;
            }

            double monthChangeRate = 0.0;
            if (lastMonthRevenue > 0) {
                monthChangeRate = ((double) (monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
            } else if (monthRevenue > 0) {
                monthChangeRate = 100.0;
            }

            summary.put("todayRevenue", todayRevenue);
            summary.put("monthRevenue", monthRevenue);
            summary.put("yesterdayRevenue", yesterdayRevenue);
            summary.put("lastMonthRevenue", lastMonthRevenue);
            summary.put("todayChangeRate", Math.round(todayChangeRate * 10.0) / 10.0);
            summary.put("monthChangeRate", Math.round(monthChangeRate * 10.0) / 10.0);
            summary.put("unpaid", unpaid);
            summary.put("refundPending", refundPending);

            logger.debug("결제 요약 조회 완료: 오늘={}, 이번달={}, 전일={}, 전월={}, 오늘증감률={}%, 이번달증감률={}%, 미수금={}, 환불대기={}",
                    todayRevenue, monthRevenue, yesterdayRevenue, lastMonthRevenue, todayChangeRate, monthChangeRate, unpaid, refundPending);

            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            logger.error("결제 요약 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/statistics/method")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getPaymentMethodStatistics(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            List<Payment> payments = paymentRepository.findAllWithCoach();
            if (payments == null) {
                payments = new ArrayList<>();
            }

            if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                LocalDateTime startDateTime = start.atStartOfDay();
                LocalDateTime endDateTime = end.atTime(LocalTime.MAX);

                payments = payments.stream()
                        .filter(p -> {
                            LocalDateTime paidAt = p.getPaidAt();
                            return paidAt != null && !paidAt.isBefore(startDateTime) && !paidAt.isAfter(endDateTime);
                        })
                        .collect(Collectors.toList());
            }

            Map<String, Integer> methodCount = new HashMap<>();
            Map<String, Integer> methodAmount = new HashMap<>();
            int totalCount = payments.size();
            int totalAmount = 0;

            for (Payment payment : payments) {
                if (payment.getPaymentMethod() != null && payment.getAmount() != null) {
                    String method = payment.getPaymentMethod().name();
                    methodCount.put(method, methodCount.getOrDefault(method, 0) + 1);
                    methodAmount.put(method, methodAmount.getOrDefault(method, 0) + payment.getAmount());
                    totalAmount += payment.getAmount();
                }
            }

            Map<String, Object> statistics = new HashMap<>();
            statistics.put("methodCount", methodCount);
            statistics.put("methodAmount", methodAmount);
            statistics.put("totalCount", totalCount);
            statistics.put("totalAmount", totalAmount);

            return ResponseEntity.ok(statistics);
        } catch (Exception e) {
            logger.error("결제 방법별 통계 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/unpaid/details")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getUnpaidDetails() {
        try {
            List<Booking> confirmedBookings = new ArrayList<>();
            confirmedBookings.addAll(bookingRepository.findByStatus(Booking.BookingStatus.CONFIRMED));
            confirmedBookings.addAll(bookingRepository.findByStatus(Booking.BookingStatus.COMPLETED));

            List<Map<String, Object>> unpaidDetails = new ArrayList<>();

            for (Booking booking : confirmedBookings) {
                if (booking.getPaymentMethod() == Booking.PaymentMethod.PREPAID) {
                    continue;
                }
                if (booking.getMemberProduct() != null) {
                    continue;
                }
                List<Payment> bookingPayments = paymentRepository.findByBookingId(booking.getId());
                if (bookingPayments == null || bookingPayments.isEmpty()) {
                    if (booking.getPaymentMethod() != Booking.PaymentMethod.PREPAID) {
                        Map<String, Object> detail = new HashMap<>();
                        detail.put("bookingId", booking.getId());
                        detail.put("startTime", booking.getStartTime());
                        detail.put("endTime", booking.getEndTime());
                        detail.put("paymentMethod", booking.getPaymentMethod() != null ? booking.getPaymentMethod().name() : null);
                        detail.put("purpose", booking.getPurpose() != null ? booking.getPurpose().name() : null);
                        if (booking.getMember() != null) {
                            Map<String, Object> memberMap = new HashMap<>();
                            memberMap.put("id", booking.getMember().getId());
                            memberMap.put("name", booking.getMember().getName());
                            detail.put("member", memberMap);
                        } else {
                            detail.put("nonMemberName", booking.getNonMemberName());
                            detail.put("nonMemberPhone", booking.getNonMemberPhone());
                        }
                        if (booking.getFacility() != null) {
                            Map<String, Object> facilityMap = new HashMap<>();
                            facilityMap.put("id", booking.getFacility().getId());
                            facilityMap.put("name", booking.getFacility().getName());
                            detail.put("facility", facilityMap);
                        }
                        unpaidDetails.add(detail);
                    }
                }
            }

            return ResponseEntity.ok(unpaidDetails);
        } catch (Exception e) {
            logger.error("미수금 상세 내역 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/export/excel")
    @Transactional(readOnly = true)
    public ResponseEntity<org.springframework.core.io.Resource> exportToExcel(
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            List<Payment> payments = paymentRepository.findAllWithCoach();
            if (payments == null) {
                payments = new ArrayList<>();
            }

            if (paymentMethod != null && !paymentMethod.isEmpty()) {
                try {
                    Payment.PaymentMethod method = Payment.PaymentMethod.valueOf(paymentMethod);
                    payments = payments.stream()
                            .filter(p -> p.getPaymentMethod() == method)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {}
            }

            if (status != null && !status.isEmpty()) {
                try {
                    Payment.PaymentStatus paymentStatus = Payment.PaymentStatus.valueOf(status);
                    payments = payments.stream()
                            .filter(p -> p.getStatus() == paymentStatus)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {}
            }

            if (category != null && !category.isEmpty()) {
                try {
                    Payment.PaymentCategory paymentCategory = Payment.PaymentCategory.valueOf(category);
                    payments = payments.stream()
                            .filter(p -> p.getCategory() == paymentCategory)
                            .collect(Collectors.toList());
                } catch (IllegalArgumentException e) {}
            }

            if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                LocalDateTime startDateTime = start.atStartOfDay();
                LocalDateTime endDateTime = end.atTime(LocalTime.MAX);

                payments = payments.stream()
                        .filter(p -> {
                            LocalDateTime paidAt = p.getPaidAt();
                            return paidAt != null && !paidAt.isBefore(startDateTime) && !paidAt.isAfter(endDateTime);
                        })
                        .collect(Collectors.toList());
            }

            org.apache.poi.ss.usermodel.Workbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
            org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet("결제 내역");

            org.apache.poi.ss.usermodel.Row headerRow = sheet.createRow(0);
            String[] headers = {"결제번호", "날짜/시간", "회원", "코치", "분류", "결제수단", "금액", "상태", "환불금액", "메모"};
            for (int i = 0; i < headers.length; i++) {
                org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
            }

            int rowNum = 1;
            for (Payment payment : payments) {
                org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowNum++);

                row.createCell(0).setCellValue(payment.getId() != null ? payment.getId().toString() : "");
                row.createCell(1).setCellValue(payment.getPaidAt() != null ? payment.getPaidAt().toString() : "");
                row.createCell(2).setCellValue(payment.getMember() != null && payment.getMember().getName() != null
                        ? payment.getMember().getName() : "");
                row.createCell(3).setCellValue(
                        (payment.getBooking() != null && payment.getBooking().getCoach() != null)
                                ? payment.getBooking().getCoach().getName()
                                : (payment.getMember() != null && payment.getMember().getCoach() != null
                                ? payment.getMember().getCoach().getName() : ""));
                row.createCell(4).setCellValue(payment.getCategory() != null ? payment.getCategory().name() : "");
                row.createCell(5).setCellValue(payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : "");
                row.createCell(6).setCellValue(payment.getAmount() != null ? payment.getAmount() : 0);
                row.createCell(7).setCellValue(payment.getStatus() != null ? payment.getStatus().name() : "");
                row.createCell(8).setCellValue(payment.getRefundAmount() != null ? payment.getRefundAmount() : 0);
                row.createCell(9).setCellValue(payment.getMemo() != null ? payment.getMemo() : "");
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            java.io.File tempFile = java.io.File.createTempFile("payments_export_", ".xlsx");
            try (java.io.FileOutputStream outputStream = new java.io.FileOutputStream(tempFile)) {
                workbook.write(outputStream);
            }
            workbook.close();

            org.springframework.core.io.Resource resource = new org.springframework.core.io.FileSystemResource(tempFile);

            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"결제내역_" + LocalDate.now() + ".xlsx\"")
                    .header(org.springframework.http.HttpHeaders.CONTENT_TYPE,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .body(resource);
        } catch (Exception e) {
            logger.error("엑셀 다운로드 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
