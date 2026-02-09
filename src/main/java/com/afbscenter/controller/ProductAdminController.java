package com.afbscenter.controller;

import com.afbscenter.model.ActionAuditLog;
import com.afbscenter.model.Product;
import com.afbscenter.repository.ActionAuditLogRepository;
import com.afbscenter.repository.ProductRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
public class ProductAdminController {

    private static final Logger logger = LoggerFactory.getLogger(ProductAdminController.class);

    private final ProductRepository productRepository;
    private final ActionAuditLogRepository actionAuditLogRepository;

    public ProductAdminController(ProductRepository productRepository,
                                  ActionAuditLogRepository actionAuditLogRepository) {
        this.productRepository = productRepository;
        this.actionAuditLogRepository = actionAuditLogRepository;
    }

    @PostMapping("/batch-update-monthly-pass-conditions")
    @Transactional
    public ResponseEntity<Map<String, Object>> batchUpdateMonthlyPassConditions(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if (role == null || !role.equals("ADMIN")) {
            logger.warn("기간제 상품 일괄 업데이트 권한 없음: role={}", role);
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", "기간제 상품 일괄 업데이트는 관리자만 사용할 수 있습니다.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(err);
        }
        List<Map<String, Object>> updateDetails = new java.util.ArrayList<>();
        int updatedCount = 0;
        int totalCount = 0;
        int errorCount = 0;

        try {
            logger.info("기간제 상품 conditions 일괄 업데이트 시작");

            // MONTHLY_PASS 타입의 모든 상품 조회
            List<Product> monthlyPassProducts = productRepository.findByType(Product.ProductType.MONTHLY_PASS);

            totalCount = monthlyPassProducts.size();
            logger.info("기간제 상품 총 {}개 발견", totalCount);

            for (Product product : monthlyPassProducts) {
                try {
                    // 업데이트 전 상태 저장
                    String oldConditions = product.getConditions();
                    Long productId = product.getId();
                    String productName = product.getName();

                    // 모든 기간제 상품의 conditions를 "시작일로부터 X일" 형식으로 업데이트
                    Integer validDays = product.getValidDays() != null && product.getValidDays() > 0
                            ? product.getValidDays()
                            : 30;
                    String newConditions = "시작일로부터 " + validDays + "일";

                    // 업데이트 실행
                    product.setConditions(newConditions);
                    Product saved = productRepository.save(product);

                    // 저장 후 검증
                    if (saved != null && newConditions.equals(saved.getConditions())) {
                        updatedCount++;
                        Map<String, Object> detail = new HashMap<>();
                        detail.put("id", productId);
                        detail.put("name", productName);
                        detail.put("oldConditions", oldConditions);
                        detail.put("newConditions", newConditions);
                        detail.put("validDays", validDays);
                        detail.put("status", "success");
                        updateDetails.add(detail);

                        logger.info("기간제 상품 conditions 업데이트 성공: ID={}, name={}, 기존={}, 변경={}",
                                productId, productName, oldConditions, newConditions);
                    } else {
                        errorCount++;
                        Map<String, Object> detail = new HashMap<>();
                        detail.put("id", productId);
                        detail.put("name", productName);
                        detail.put("status", "failed");
                        detail.put("error", "저장 후 검증 실패");
                        updateDetails.add(detail);
                        logger.error("기간제 상품 conditions 업데이트 검증 실패: ID={}, name={}",
                                productId, productName);
                    }
                } catch (Exception e) {
                    errorCount++;
                    Map<String, Object> detail = new HashMap<>();
                    detail.put("id", product.getId());
                    detail.put("name", product.getName());
                    detail.put("status", "error");
                    detail.put("error", e.getMessage());
                    updateDetails.add(detail);
                    logger.error("기간제 상품 conditions 업데이트 중 오류: ID={}, name={}, 오류={}",
                            product.getId(), product.getName(), e.getMessage(), e);
                }
            }

            // 최종 검증: 업데이트된 상품들이 실제로 DB에 반영되었는지 확인
            int verifiedCount = 0;
            for (Product product : monthlyPassProducts) {
                try {
                    Optional<Product> verified = productRepository.findById(product.getId());
                    if (verified.isPresent()) {
                        Product verifiedProduct = verified.get();
                        Integer validDays = verifiedProduct.getValidDays() != null && verifiedProduct.getValidDays() > 0
                                ? verifiedProduct.getValidDays()
                                : 30;
                        String expectedConditions = "시작일로부터 " + validDays + "일";
                        if (expectedConditions.equals(verifiedProduct.getConditions())) {
                            verifiedCount++;
                        }
                    }
                } catch (Exception e) {
                    logger.warn("최종 검증 중 오류: Product ID={}, 오류={}", product.getId(), e.getMessage());
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("totalCount", totalCount);
            response.put("updatedCount", updatedCount);
            response.put("errorCount", errorCount);
            response.put("verifiedCount", verifiedCount);
            response.put("updateDetails", updateDetails);
            response.put("message", String.format("기간제 상품 %d개 중 %d개 업데이트 완료 (오류: %d개, 검증 완료: %d개)",
                    totalCount, updatedCount, errorCount, verifiedCount));

            logger.info("기간제 상품 conditions 일괄 업데이트 완료: 전체={}, 업데이트={}, 오류={}, 검증={}",
                    totalCount, updatedCount, errorCount, verifiedCount);

            String username = (String) request.getAttribute("username");
            try {
                String details = new ObjectMapper().writeValueAsString(Map.of(
                        "totalCount", totalCount, "updatedCount", updatedCount, "errorCount", errorCount, "verifiedCount", verifiedCount));
                actionAuditLogRepository.save(ActionAuditLog.of(username, "BATCH_UPDATE_MONTHLY_PASS_CONDITIONS", details));
            } catch (Exception logEx) {
                logger.warn("기간제 상품 일괄 업데이트 감사 로그 저장 실패: {}", logEx.getMessage());
            }

            if (errorCount > 0) {
                logger.warn("일부 상품 업데이트 중 오류 발생: {}개", errorCount);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("기간제 상품 conditions 일괄 업데이트 중 치명적 오류 발생", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("totalCount", totalCount);
            errorResponse.put("updatedCount", updatedCount);
            errorResponse.put("errorCount", errorCount);
            errorResponse.put("updateDetails", updateDetails);
            errorResponse.put("error", "업데이트 중 오류가 발생했습니다: " + e.getMessage());
            throw e;
        }
    }

    @PostMapping("/batch-update-all")
    @Transactional
    public ResponseEntity<Map<String, Object>> batchUpdateAllProducts(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if (role == null || !role.equals("ADMIN")) {
            logger.warn("상품 데이터 일괄 수정 권한 없음: role={}", role);
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("error", "상품 데이터 일괄 수정은 관리자만 사용할 수 있습니다.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(err);
        }
        List<Map<String, Object>> fixDetails = new java.util.ArrayList<>();
        int fixedCount = 0;
        int totalCount = 0;
        int errorCount = 0;
        int conditionsUpdatedCount = 0;

        try {
            logger.info("상품 데이터 일괄 수정 시작 (정합성 수정 + 기간제 conditions 업데이트)");

            // 모든 상품 조회
            List<Product> allProducts = productRepository.findAll();
            int productTotalCount = allProducts.size();
            totalCount = productTotalCount;
            logger.info("전체 상품 {}개 발견", productTotalCount);

            // 1단계: 데이터 정합성 수정
            for (Product product : allProducts) {
                try {
                    boolean needsUpdate = false;
                    Map<String, Object> detail = new HashMap<>();
                    detail.put("id", product.getId());
                    detail.put("name", product.getName());
                    detail.put("type", product.getType() != null ? product.getType().name() : null);
                    List<String> fixes = new java.util.ArrayList<>();

                    // 회차권(COUNT_PASS) 처리
                    if (product.getType() == Product.ProductType.COUNT_PASS) {
                        // 규칙: 회차권은 USAGE_COUNT 필수, VALID_DAYS는 0

                        // VALID_DAYS가 null이거나 0이 아니면 0으로 설정
                        if (product.getValidDays() == null || product.getValidDays() != 0) {
                            Integer oldValidDays = product.getValidDays();
                            product.setValidDays(0);
                            needsUpdate = true;
                            fixes.add("VALID_DAYS: " + (oldValidDays != null ? oldValidDays : "null") + " → 0 (회차권 규칙)");
                        }

                        // USAGE_COUNT가 null이거나 0 이하면 경고 (패키지 구성에서 추출 시도)
                        if (product.getUsageCount() == null || product.getUsageCount() <= 0) {
                            // packageItems에서 추출 시도
                            if (product.getPackageItems() != null && !product.getPackageItems().trim().isEmpty()) {
                                try {
                                    ObjectMapper mapper = new ObjectMapper();
                                    List<Map<String, Object>> packageItems = mapper.readValue(
                                            product.getPackageItems(),
                                            new TypeReference<List<Map<String, Object>>>() {}
                                    );
                                    int extractedCount = 0;
                                    for (Map<String, Object> item : packageItems) {
                                        Object countObj = item.get("count");
                                        if (countObj instanceof Number) {
                                            extractedCount += ((Number) countObj).intValue();
                                        }
                                    }
                                    if (extractedCount > 0) {
                                        Integer oldUsageCount = product.getUsageCount();
                                        product.setUsageCount(extractedCount);
                                        needsUpdate = true;
                                        fixes.add("USAGE_COUNT: " + (oldUsageCount != null ? oldUsageCount : "null") + " → " + extractedCount + " (패키지 구성에서 추출)");
                                    }
                                } catch (Exception e) {
                                    logger.warn("패키지 구성에서 usageCount 추출 실패: Product ID={}", product.getId());
                                }
                            }

                            // 여전히 없으면 경고만 (에러는 아님, 수동 수정 필요)
                            if (product.getUsageCount() == null || product.getUsageCount() <= 0) {
                                fixes.add("⚠️ USAGE_COUNT가 없습니다. 수동으로 수정이 필요합니다.");
                            }
                        }
                    }

                    // 기간제(MONTHLY_PASS) 처리
                    if (product.getType() == Product.ProductType.MONTHLY_PASS) {
                        // 규칙: 기간제는 VALID_DAYS 필수, USAGE_COUNT는 null

                        // USAGE_COUNT가 null이 아니면 무조건 null로 설정 (기간제 규칙)
                        Integer oldUsageCount = product.getUsageCount();
                        if (oldUsageCount != null) {
                            product.setUsageCount(null);
                            needsUpdate = true;
                            fixes.add("USAGE_COUNT: " + oldUsageCount + " → null (기간제 규칙)");
                            logger.info("기간제 상품 USAGE_COUNT 수정: ID={}, name={}, {} → null",
                                    product.getId(), product.getName(), oldUsageCount);
                        }

                        // VALID_DAYS가 null이거나 0 이하면 기본값 30으로 설정
                        if (product.getValidDays() == null || product.getValidDays() <= 0) {
                            Integer oldValidDays = product.getValidDays();
                            product.setValidDays(30);
                            needsUpdate = true;
                            fixes.add("VALID_DAYS: " + (oldValidDays != null ? oldValidDays : "null") + " → 30 (기간제 기본값)");
                        }

                        // PACKAGE_ITEMS가 빈 문자열이면 null로 설정
                        if (product.getPackageItems() != null && product.getPackageItems().trim().isEmpty()) {
                            product.setPackageItems(null);
                            needsUpdate = true;
                            fixes.add("PACKAGE_ITEMS: 빈 문자열 → null");
                        }

                        // 2단계: 기간제 상품의 conditions를 "시작일로부터 X일" 형식으로 업데이트
                        Integer validDays = product.getValidDays() != null && product.getValidDays() > 0
                                ? product.getValidDays()
                                : 30;
                        String newConditions = "시작일로부터 " + validDays + "일";
                        String oldConditions = product.getConditions();

                        // conditions가 없거나 날짜 형식이면 업데이트
                        if (oldConditions == null || oldConditions.trim().isEmpty() ||
                                oldConditions.trim().startsWith("~") ||
                                !oldConditions.trim().startsWith("시작일로부터")) {
                            product.setConditions(newConditions);
                            needsUpdate = true;
                            if (oldConditions == null || oldConditions.trim().isEmpty()) {
                                fixes.add("CONDITIONS: null → " + newConditions);
                            } else {
                                fixes.add("CONDITIONS: " + oldConditions + " → " + newConditions);
                            }
                            conditionsUpdatedCount++;
                        }
                    }

                    if (needsUpdate) {
                        Product saved = productRepository.save(product);
                        if (saved != null) {
                            // 저장 후 검증: 실제로 DB에 반영되었는지 확인
                            Optional<Product> verified = productRepository.findById(product.getId());
                            boolean verificationPassed = true;
                            if (verified.isPresent()) {
                                Product verifiedProduct = verified.get();

                                // 기간제 상품의 경우 USAGE_COUNT가 null인지 확인
                                if (product.getType() == Product.ProductType.MONTHLY_PASS) {
                                    if (verifiedProduct.getUsageCount() != null) {
                                        verificationPassed = false;
                                        logger.error("검증 실패: 기간제 상품의 USAGE_COUNT가 null이 아닙니다. ID={}, USAGE_COUNT={}",
                                                product.getId(), verifiedProduct.getUsageCount());
                                    }
                                }

                                // 회차권 상품의 경우 VALID_DAYS가 0인지 확인
                                if (product.getType() == Product.ProductType.COUNT_PASS) {
                                    if (verifiedProduct.getValidDays() == null || verifiedProduct.getValidDays() != 0) {
                                        verificationPassed = false;
                                        logger.error("검증 실패: 회차권 상품의 VALID_DAYS가 0이 아닙니다. ID={}, VALID_DAYS={}",
                                                product.getId(), verifiedProduct.getValidDays());
                                    }
                                }
                            }

                            if (verificationPassed) {
                                fixedCount++;
                                detail.put("status", "fixed");
                                detail.put("fixes", fixes);
                                fixDetails.add(detail);
                                logger.info("상품 데이터 일괄 수정 성공: ID={}, name={}, 수정사항={}",
                                        product.getId(), product.getName(), fixes);
                            } else {
                                errorCount++;
                                detail.put("status", "verification_failed");
                                detail.put("error", "저장 후 검증 실패");
                                fixDetails.add(detail);
                                logger.error("상품 데이터 일괄 수정 검증 실패: ID={}, name={}",
                                        product.getId(), product.getName());
                            }
                        } else {
                            errorCount++;
                            detail.put("status", "failed");
                            detail.put("error", "저장 실패");
                            fixDetails.add(detail);
                            logger.error("상품 데이터 일괄 수정 실패: ID={}, name={}",
                                    product.getId(), product.getName());
                        }
                    }
                } catch (Exception e) {
                    errorCount++;
                    Map<String, Object> detail = new HashMap<>();
                    detail.put("id", product.getId());
                    detail.put("name", product.getName());
                    detail.put("status", "error");
                    detail.put("error", e.getMessage());
                    fixDetails.add(detail);
                    logger.error("상품 데이터 일괄 수정 중 오류: ID={}, name={}, 오류={}",
                            product.getId(), product.getName(), e.getMessage(), e);
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("totalCount", totalCount);
            response.put("fixedCount", fixedCount);
            response.put("conditionsUpdatedCount", conditionsUpdatedCount);
            response.put("errorCount", errorCount);
            response.put("fixDetails", fixDetails);
            response.put("message", String.format("전체 %d개 상품 중 %d개 수정 완료 (기간제 conditions: %d개, 오류: %d개)",
                    totalCount, fixedCount, conditionsUpdatedCount, errorCount));

            logger.info("상품 데이터 일괄 수정 완료: 전체={}, 수정={}, 기간제 conditions={}, 오류={}",
                    totalCount, fixedCount, conditionsUpdatedCount, errorCount);

            String username = (String) request.getAttribute("username");
            try {
                String details = new ObjectMapper().writeValueAsString(Map.of(
                        "totalCount", totalCount, "fixedCount", fixedCount, "conditionsUpdatedCount", conditionsUpdatedCount, "errorCount", errorCount));
                actionAuditLogRepository.save(ActionAuditLog.of(username, "BATCH_UPDATE_ALL_PRODUCTS", details));
            } catch (Exception logEx) {
                logger.warn("상품 일괄 수정 감사 로그 저장 실패: {}", logEx.getMessage());
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("상품 데이터 일괄 수정 중 치명적 오류 발생", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("totalCount", totalCount);
            errorResponse.put("fixedCount", fixedCount);
            errorResponse.put("conditionsUpdatedCount", conditionsUpdatedCount);
            errorResponse.put("errorCount", errorCount);
            errorResponse.put("fixDetails", fixDetails);
            errorResponse.put("error", "수정 중 오류가 발생했습니다: " + e.getMessage());
            throw e;
        }
    }

    @PostMapping("/fix-data-integrity")
    @Transactional
    @Deprecated
    public ResponseEntity<Map<String, Object>> fixProductDataIntegrity() {
        List<Map<String, Object>> fixDetails = new java.util.ArrayList<>();
        int fixedCount = 0;
        int totalCount = 0;
        int errorCount = 0;

        try {
            logger.info("상품 데이터 정합성 수정 시작");

            // 모든 상품 조회
            List<Product> allProducts = productRepository.findAll();
            int productTotalCount = allProducts.size();
            totalCount = productTotalCount;
            logger.info("전체 상품 {}개 발견", productTotalCount);

            for (Product product : allProducts) {
                try {
                    boolean needsUpdate = false;
                    Map<String, Object> detail = new HashMap<>();
                    detail.put("id", product.getId());
                    detail.put("name", product.getName());
                    detail.put("type", product.getType() != null ? product.getType().name() : null);
                    List<String> fixes = new java.util.ArrayList<>();

                    // 회차권(COUNT_PASS) 처리
                    if (product.getType() == Product.ProductType.COUNT_PASS) {
                        // 규칙: 회차권은 USAGE_COUNT 필수, VALID_DAYS는 0

                        // VALID_DAYS가 null이거나 0이 아니면 0으로 설정
                        if (product.getValidDays() == null || product.getValidDays() != 0) {
                            Integer oldValidDays = product.getValidDays();
                            product.setValidDays(0);
                            needsUpdate = true;
                            fixes.add("VALID_DAYS: " + (oldValidDays != null ? oldValidDays : "null") + " → 0 (회차권 규칙)");
                        }

                        // USAGE_COUNT가 null이거나 0 이하면 경고 (패키지 구성에서 추출 시도)
                        if (product.getUsageCount() == null || product.getUsageCount() <= 0) {
                            // packageItems에서 추출 시도
                            if (product.getPackageItems() != null && !product.getPackageItems().trim().isEmpty()) {
                                try {
                                    ObjectMapper mapper = new ObjectMapper();
                                    List<Map<String, Object>> packageItems = mapper.readValue(
                                            product.getPackageItems(),
                                            new TypeReference<List<Map<String, Object>>>() {}
                                    );
                                    int extractedCount = 0;
                                    for (Map<String, Object> item : packageItems) {
                                        Object countObj = item.get("count");
                                        if (countObj instanceof Number) {
                                            extractedCount += ((Number) countObj).intValue();
                                        }
                                    }
                                    if (extractedCount > 0) {
                                        Integer oldUsageCount = product.getUsageCount();
                                        product.setUsageCount(extractedCount);
                                        needsUpdate = true;
                                        fixes.add("USAGE_COUNT: " + (oldUsageCount != null ? oldUsageCount : "null") + " → " + extractedCount + " (패키지 구성에서 추출)");
                                    }
                                } catch (Exception e) {
                                    logger.warn("패키지 구성에서 usageCount 추출 실패: Product ID={}", product.getId());
                                }
                            }

                            // 여전히 없으면 경고만 (에러는 아님, 수동 수정 필요)
                            if (product.getUsageCount() == null || product.getUsageCount() <= 0) {
                                fixes.add("⚠️ USAGE_COUNT가 없습니다. 수동으로 수정이 필요합니다.");
                            }
                        }
                    }

                    // 기간제(MONTHLY_PASS) 처리
                    if (product.getType() == Product.ProductType.MONTHLY_PASS) {
                        // 규칙: 기간제는 VALID_DAYS 필수, USAGE_COUNT는 null

                        // USAGE_COUNT가 null이 아니면 무조건 null로 설정 (기간제 규칙)
                        Integer oldUsageCount = product.getUsageCount();
                        if (oldUsageCount != null) {
                            product.setUsageCount(null);
                            needsUpdate = true;
                            fixes.add("USAGE_COUNT: " + oldUsageCount + " → null (기간제 규칙)");
                            logger.info("기간제 상품 USAGE_COUNT 수정: ID={}, name={}, {} → null",
                                    product.getId(), product.getName(), oldUsageCount);
                        }

                        // VALID_DAYS가 null이거나 0 이하면 기본값 30으로 설정
                        if (product.getValidDays() == null || product.getValidDays() <= 0) {
                            Integer oldValidDays = product.getValidDays();
                            product.setValidDays(30);
                            needsUpdate = true;
                            fixes.add("VALID_DAYS: " + (oldValidDays != null ? oldValidDays : "null") + " → 30 (기간제 기본값)");
                        }

                        // PACKAGE_ITEMS가 빈 문자열이면 null로 설정
                        if (product.getPackageItems() != null && product.getPackageItems().trim().isEmpty()) {
                            product.setPackageItems(null);
                            needsUpdate = true;
                            fixes.add("PACKAGE_ITEMS: 빈 문자열 → null");
                        }
                    }

                    if (needsUpdate) {
                        Product saved = productRepository.save(product);
                        if (saved != null) {
                            fixedCount++;
                            detail.put("status", "fixed");
                            detail.put("fixes", fixes);
                            fixDetails.add(detail);
                            logger.info("상품 데이터 정합성 수정: ID={}, name={}, 수정사항={}",
                                    product.getId(), product.getName(), fixes);
                        } else {
                            errorCount++;
                            detail.put("status", "failed");
                            detail.put("error", "저장 실패");
                            fixDetails.add(detail);
                            logger.error("상품 데이터 정합성 수정 실패: ID={}, name={}",
                                    product.getId(), product.getName());
                        }
                    }
                } catch (Exception e) {
                    errorCount++;
                    Map<String, Object> detail = new HashMap<>();
                    detail.put("id", product.getId());
                    detail.put("name", product.getName());
                    detail.put("status", "error");
                    detail.put("error", e.getMessage());
                    fixDetails.add(detail);
                    logger.error("상품 데이터 정합성 수정 중 오류: ID={}, name={}, 오류={}",
                            product.getId(), product.getName(), e.getMessage(), e);
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("totalCount", totalCount);
            response.put("fixedCount", fixedCount);
            response.put("errorCount", errorCount);
            response.put("fixDetails", fixDetails);
            response.put("message", String.format("전체 %d개 상품 중 %d개 수정 완료 (오류: %d개)",
                    totalCount, fixedCount, errorCount));

            logger.info("상품 데이터 정합성 수정 완료: 전체={}, 수정={}, 오류={}",
                    totalCount, fixedCount, errorCount);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("상품 데이터 정합성 수정 중 치명적 오류 발생", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("totalCount", totalCount);
            errorResponse.put("fixedCount", fixedCount);
            errorResponse.put("errorCount", errorCount);
            errorResponse.put("fixDetails", fixDetails);
            errorResponse.put("error", "수정 중 오류가 발생했습니다: " + e.getMessage());
            throw e;
        }
    }
}
