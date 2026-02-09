package com.afbscenter.controller;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.repository.MemberProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 회원 상품(이용권) 통계 전용. URL은 기존과 동일: /api/member-products/statistics
 */
@RestController
@RequestMapping("/api/member-products")
public class MemberProductStatsController {

    private static final Logger logger = LoggerFactory.getLogger(MemberProductStatsController.class);

    private final MemberProductRepository memberProductRepository;

    public MemberProductStatsController(MemberProductRepository memberProductRepository) {
        this.memberProductRepository = memberProductRepository;
    }

    @GetMapping("/statistics")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getStatistics() {
        try {
            List<MemberProduct> allProducts = memberProductRepository.findAll();

            long totalIssued = allProducts.size();
            long activeCount = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE)
                    .count();
            long expiredCount = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.EXPIRED)
                    .count();
            long usedUpCount = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.USED_UP)
                    .count();

            long actuallyExpired = allProducts.stream()
                    .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE)
                    .filter(mp -> mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(LocalDate.now()))
                    .count();

            Map<String, Object> statistics = new HashMap<>();
            statistics.put("totalIssued", totalIssued);
            statistics.put("activeCount", activeCount);
            statistics.put("expiredCount", expiredCount + actuallyExpired);
            statistics.put("usedUpCount", usedUpCount);

            Map<String, Map<String, Long>> byProductType = new HashMap<>();
            allProducts.stream()
                    .collect(Collectors.groupingBy(
                            mp -> mp.getProduct() != null ? mp.getProduct().getType().name() : "UNKNOWN",
                            Collectors.counting()
                    ))
                    .forEach((type, count) -> {
                        Map<String, Long> typeStats = new HashMap<>();
                        typeStats.put("total", count);
                        typeStats.put("active", allProducts.stream()
                                .filter(mp -> mp.getProduct() != null && mp.getProduct().getType().name().equals(type))
                                .filter(mp -> mp.getStatus() == MemberProduct.Status.ACTIVE)
                                .count());
                        typeStats.put("expired", allProducts.stream()
                                .filter(mp -> mp.getProduct() != null && mp.getProduct().getType().name().equals(type))
                                .filter(mp -> mp.getStatus() == MemberProduct.Status.EXPIRED ||
                                        (mp.getStatus() == MemberProduct.Status.ACTIVE &&
                                                mp.getExpiryDate() != null &&
                                                mp.getExpiryDate().isBefore(LocalDate.now())))
                                .count());
                        typeStats.put("usedUp", allProducts.stream()
                                .filter(mp -> mp.getProduct() != null && mp.getProduct().getType().name().equals(type))
                                .filter(mp -> mp.getStatus() == MemberProduct.Status.USED_UP)
                                .count());
                        byProductType.put(type, typeStats);
                    });

            statistics.put("byProductType", byProductType);

            return ResponseEntity.ok(statistics);
        } catch (Exception e) {
            logger.error("상품권 통계 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
