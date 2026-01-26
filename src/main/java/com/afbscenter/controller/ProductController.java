package com.afbscenter.controller;

import com.afbscenter.model.Product;
import com.afbscenter.repository.ProductRepository;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private static final Logger logger = LoggerFactory.getLogger(ProductController.class);

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllProducts() {
        try {
            logger.info("상품 목록 조회 시작");
            List<Product> products = productRepository.findAll();
            logger.info("상품 조회 완료: {}개", products != null ? products.size() : 0);
            
            if (products == null || products.isEmpty()) {
                return ResponseEntity.ok(new java.util.ArrayList<>());
            }
            
            // Map으로 변환하여 안전하게 직렬화
            List<Map<String, Object>> result = new java.util.ArrayList<>();
            for (Product product : products) {
                try {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", product.getId());
                    map.put("name", product.getName());
                    map.put("description", product.getDescription());
                    map.put("type", product.getType() != null ? product.getType().name() : null);
                    map.put("price", product.getPrice());
                    map.put("validDays", product.getValidDays());
                    map.put("usageCount", product.getUsageCount());
                    map.put("packageItems", product.getPackageItems());
                    map.put("conditions", product.getConditions());
                    map.put("refundPolicy", product.getRefundPolicy());
                    map.put("category", product.getCategory() != null ? product.getCategory().name() : null);
                    map.put("active", product.getActive());
                    map.put("coach", null);
                    result.add(map);
                } catch (Exception e) {
                    logger.warn("상품 변환 실패. Product ID: {}", product.getId(), e);
                }
            }
            
            logger.info("상품 변환 완료: {}개 반환", result.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("상품 목록 조회 중 오류 발생", e);
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getProductById(@PathVariable Long id) {
        try {
            if (id == null) {
                return ResponseEntity.badRequest().build();
            }
            return productRepository.findById(id)
                    .map(product -> {
                        Map<String, Object> productMap = new HashMap<>();
                        productMap.put("id", product.getId());
                        productMap.put("name", product.getName());
                        productMap.put("description", product.getDescription());
                        productMap.put("type", product.getType() != null ? product.getType().name() : null);
                        productMap.put("price", product.getPrice());
                        productMap.put("validDays", product.getValidDays());
                        productMap.put("usageCount", product.getUsageCount());
                        productMap.put("packageItems", product.getPackageItems());
                        productMap.put("conditions", product.getConditions());
                        productMap.put("refundPolicy", product.getRefundPolicy());
                        productMap.put("category", product.getCategory() != null ? product.getCategory().name() : null);
                        productMap.put("active", product.getActive());
                        
                        // coach 정보는 Lazy loading이므로 null로 설정 (필요시 별도 조회)
                        productMap.put("coach", null);
                        
                        return ResponseEntity.ok(productMap);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("상품 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createProduct(@Valid @RequestBody Product product) {
        try {
            logger.info("상품 생성 요청 수신: name={}, type={}, price={}, usageCount={}", 
                product.getName(), product.getType(), product.getPrice(), product.getUsageCount());
            
            // active 기본값 설정
            if (product.getActive() == null) {
                product.setActive(true);
            }
            
            // 필수 필드 검증
            if (product.getName() == null || product.getName().trim().isEmpty()) {
                logger.error("⚠️ 상품명이 필수입니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "⚠️ 상품명은 필수 입력 항목입니다. 상품명을 입력해주세요.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            if (product.getType() == null) {
                logger.error("⚠️ 상품 유형이 필수입니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "⚠️ 상품 유형은 필수 선택 항목입니다. 유형을 선택해주세요.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            if (product.getCategory() == null) {
                logger.error("⚠️ 카테고리가 필수입니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "⚠️ 카테고리는 필수 선택 항목입니다. 카테고리를 선택해주세요.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            if (product.getPrice() == null || product.getPrice() < 0) {
                logger.error("⚠️ 가격이 필수이며 0 이상이어야 합니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "⚠️ 가격은 필수 입력 항목이며 0 이상의 숫자여야 합니다. 올바른 가격을 입력해주세요.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            // 기간제(MONTHLY_PASS)인 경우 validDays 필수 검증
            if (product.getType() == Product.ProductType.MONTHLY_PASS) {
                if (product.getValidDays() == null || product.getValidDays() <= 0) {
                    logger.error("⚠️ 기간제 상품의 유효기간(validDays)은 필수이며 1 이상이어야 합니다. 상품명={}", product.getName());
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("error", "⚠️ 기간제 상품은 유효기간(일)이 필수 입력 항목입니다. 1 이상의 숫자를 입력해주세요.");
                    return ResponseEntity.badRequest().body(errorResponse);
                }
            }
            
            // 회차권인 경우 규칙 적용: USAGE_COUNT 필수, VALID_DAYS는 0
            if (product.getType() == Product.ProductType.COUNT_PASS) {
                // VALID_DAYS는 무조건 0으로 설정 (회차권 규칙)
                product.setValidDays(0);
                
                Integer usageCount = product.getUsageCount();
                
                // usageCount가 없으면 패키지 구성에서 추출 시도 (보조 방법)
                if ((usageCount == null || usageCount <= 0) && product.getPackageItems() != null && !product.getPackageItems().trim().isEmpty()) {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        List<Map<String, Object>> packageItems = mapper.readValue(
                            product.getPackageItems(), 
                            new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}
                        );
                        // 패키지 구성의 모든 항목의 횟수 합계
                        int totalCount = 0;
                        for (Map<String, Object> item : packageItems) {
                            Object countObj = item.get("count");
                            if (countObj instanceof Number) {
                                totalCount += ((Number) countObj).intValue();
                            }
                        }
                        if (totalCount > 0) {
                            usageCount = totalCount;
                            product.setUsageCount(usageCount);
                            logger.info("패키지 구성에서 usageCount 자동 추출: 상품명={}, 추출된 횟수={}", 
                                product.getName(), usageCount);
                        }
                    } catch (Exception e) {
                        logger.warn("패키지 구성에서 usageCount 추출 실패: {}", e.getMessage());
                    }
                }
                
                // 여전히 usageCount가 없으면 사용 조건에서 추출 시도 (보조 방법)
                if ((product.getUsageCount() == null || product.getUsageCount() <= 0) && product.getConditions() != null && !product.getConditions().trim().isEmpty()) {
                    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(\\d+)회권");
                    java.util.regex.Matcher matcher = pattern.matcher(product.getConditions());
                    if (matcher.find()) {
                        try {
                            usageCount = Integer.parseInt(matcher.group(1));
                            product.setUsageCount(usageCount);
                            logger.info("사용 조건에서 usageCount 자동 추출: 상품명={}, 추출된 횟수={}", 
                                product.getName(), usageCount);
                        } catch (NumberFormatException e) {
                            logger.warn("사용 조건에서 usageCount 추출 실패: {}", e.getMessage());
                        }
                    }
                }
                
                // 최종적으로 usageCount가 없으면 에러 (회차권에서는 횟수 필수)
                if (product.getUsageCount() == null || product.getUsageCount() <= 0) {
                    logger.error("⚠️ 회차권 상품의 사용 횟수(usageCount)는 필수이며 1 이상이어야 합니다. 상품명={}", product.getName());
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("error", "⚠️ 회차권 상품은 사용 횟수가 필수 입력 항목입니다. 사용 조건에서 레슨명과 횟수를 입력해주세요. (1 이상)");
                    return ResponseEntity.badRequest().body(errorResponse);
                }
            }
            
            // 기간제인 경우 규칙 적용: VALID_DAYS 필수, USAGE_COUNT는 null
            if (product.getType() == Product.ProductType.MONTHLY_PASS) {
                // USAGE_COUNT는 무조건 null로 설정 (기간제 규칙)
                product.setUsageCount(null);
                
                // VALID_DAYS가 없으면 기본값 30으로 설정
                if (product.getValidDays() == null || product.getValidDays() <= 0) {
                    product.setValidDays(30);
                    logger.info("기간제 상품의 validDays 기본값 설정: 상품명={}, validDays=30", product.getName());
                }
            }
            
            // MONTHLY_PASS 상품인 경우 conditions의 날짜 형식을 "시작일로부터 X일" 형식으로 변환
            if (product.getType() == Product.ProductType.MONTHLY_PASS && product.getConditions() != null && !product.getConditions().trim().isEmpty()) {
                String conditions = product.getConditions().trim();
                java.util.regex.Pattern datePattern = java.util.regex.Pattern.compile("~\\s*\\d{4}\\.\\s*\\d{2}\\.\\s*\\d{2}\\.");
                java.util.regex.Matcher dateMatcher = datePattern.matcher(conditions);
                if (dateMatcher.find() || conditions.startsWith("~")) {
                    // 날짜 형식이면 "시작일로부터 X일" 형식으로 변환
                    Integer validDays = product.getValidDays() != null && product.getValidDays() > 0 ? product.getValidDays() : 30;
                    conditions = "시작일로부터 " + validDays + "일";
                    product.setConditions(conditions);
                    logger.info("MONTHLY_PASS 상품의 conditions 날짜 형식을 변환: 상품명={}, 변환된 값={}", product.getName(), conditions);
                }
            }
            
            Product saved = productRepository.save(product);
            logger.info("상품 저장 성공: ID={}, name={}, type={}, price={}, usageCount={}", 
                saved.getId(), saved.getName(), saved.getType(), saved.getPrice(), saved.getUsageCount());
            
            // 저장 후 즉시 조회하여 확인
            try {
                Optional<Product> verifyProduct = productRepository.findById(saved.getId());
                if (verifyProduct.isPresent()) {
                    logger.info("상품 저장 검증 성공: ID={} 존재 확인", saved.getId());
                } else {
                    logger.error("상품 저장 검증 실패: ID={}가 존재하지 않음", saved.getId());
                }
            } catch (Exception e) {
                logger.warn("상품 저장 검증 중 오류: {}", e.getMessage());
            }
            
            // Map으로 변환하여 반환
            Map<String, Object> productMap = new HashMap<>();
            productMap.put("id", saved.getId());
            productMap.put("name", saved.getName());
            productMap.put("description", saved.getDescription());
            productMap.put("type", saved.getType() != null ? saved.getType().name() : null);
            productMap.put("price", saved.getPrice());
            productMap.put("validDays", saved.getValidDays());
            productMap.put("usageCount", saved.getUsageCount());
            productMap.put("packageItems", saved.getPackageItems());
            productMap.put("conditions", saved.getConditions());
            productMap.put("refundPolicy", saved.getRefundPolicy());
            productMap.put("category", saved.getCategory() != null ? saved.getCategory().name() : null);
            productMap.put("active", saved.getActive());
            
            // coach 정보 안전하게 처리
            if (saved.getCoach() != null) {
                try {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", saved.getCoach().getId());
                    coachMap.put("name", saved.getCoach().getName());
                    productMap.put("coach", coachMap);
                } catch (Exception e) {
                    logger.warn("상품의 코치 정보 로드 실패. Product ID: {}", saved.getId(), e);
                    productMap.put("coach", null);
                }
            } else {
                productMap.put("coach", null);
            }
            
            logger.info("상품 생성 완료: ID={}", saved.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(productMap);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            logger.error("상품 생성 중 데이터 무결성 오류 발생", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "데이터 무결성 오류");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (jakarta.validation.ConstraintViolationException e) {
            logger.error("상품 생성 중 검증 오류 발생", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "검증 오류");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        } catch (Exception e) {
            logger.error("상품 생성 중 오류 발생", e);
            logger.error("예외 클래스: {}", e.getClass().getName());
            logger.error("예외 메시지: {}", e.getMessage());
            if (e.getCause() != null) {
                logger.error("원인: {}", e.getCause().getMessage());
            }
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "상품 생성 실패");
            errorResponse.put("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류");
            errorResponse.put("exception", e.getClass().getName());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateProduct(@PathVariable Long id, @Valid @RequestBody Product updatedProduct) {
        try {
            if (id == null) {
                return ResponseEntity.badRequest().build();
            }
            logger.info("상품 수정 요청 수신: ID={}, name={}, type={}, usageCount={}", 
                id, updatedProduct.getName(), updatedProduct.getType(), updatedProduct.getUsageCount());
            Product product = productRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("상품을 찾을 수 없습니다."));
            
            // 필드 업데이트
            if (updatedProduct.getName() != null) {
                product.setName(updatedProduct.getName());
            }
            
            if (updatedProduct.getDescription() != null) {
                product.setDescription(updatedProduct.getDescription());
            }
            
            if (updatedProduct.getType() != null) {
                product.setType(updatedProduct.getType());
            }
            
            if (updatedProduct.getCategory() != null) {
                product.setCategory(updatedProduct.getCategory());
            } else {
                // 카테고리가 null이면 에러
                logger.error("⚠️ 카테고리가 필수입니다. ID={}", id);
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "⚠️ 카테고리는 필수 선택 항목입니다. 카테고리를 선택해주세요.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            if (updatedProduct.getPrice() != null) {
                if (updatedProduct.getPrice() < 0) {
                    logger.error("⚠️ 가격은 0 이상이어야 합니다. ID={}", id);
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("error", "⚠️ 가격은 0 이상의 숫자여야 합니다. 올바른 가격을 입력해주세요.");
                    return ResponseEntity.badRequest().body(errorResponse);
                }
                product.setPrice(updatedProduct.getPrice());
            }
            
            // 기간제(MONTHLY_PASS)인 경우 규칙 적용: VALID_DAYS 필수, USAGE_COUNT는 null
            Product.ProductType finalType = updatedProduct.getType() != null ? updatedProduct.getType() : product.getType();
            if (finalType == Product.ProductType.MONTHLY_PASS) {
                // USAGE_COUNT는 무조건 null로 설정 (기간제 규칙)
                if (product.getUsageCount() != null) {
                    logger.info("기간제 상품의 USAGE_COUNT를 null로 설정: ID={}, name={}, 기존 값={}", 
                            id, product.getName(), product.getUsageCount());
                }
                product.setUsageCount(null);
                
                // validDays 필수 검증
                if (updatedProduct.getValidDays() != null) {
                    if (updatedProduct.getValidDays() <= 0) {
                        logger.error("⚠️ 기간제 상품의 유효기간(validDays)은 1 이상이어야 합니다. ID={}", id);
                        Map<String, Object> errorResponse = new HashMap<>();
                        errorResponse.put("error", "⚠️ 기간제 상품은 유효기간(일)이 필수이며 1 이상이어야 합니다.");
                        return ResponseEntity.badRequest().body(errorResponse);
                    }
                    product.setValidDays(updatedProduct.getValidDays());
                } else if (product.getValidDays() == null || product.getValidDays() <= 0) {
                    // 기존 값도 없으면 기본값 30으로 설정
                    product.setValidDays(30);
                    logger.info("기간제 상품의 validDays 기본값 설정: ID={}, name={}, validDays=30", 
                            id, product.getName());
                }
            } else {
                // 기간제가 아닌 경우
                if (updatedProduct.getValidDays() != null) {
                    product.setValidDays(updatedProduct.getValidDays());
                }
            }
            
            // packageItems는 null이거나 빈 문자열일 때도 명시적으로 설정 (항목 삭제 시 빈 값으로 업데이트)
            // packageItems를 먼저 업데이트하여 usageCount 자동 추출에 사용
            if (updatedProduct.getPackageItems() != null) {
                // 빈 문자열이면 null로 설정, 아니면 그대로 설정
                String packageItems = updatedProduct.getPackageItems().trim();
                product.setPackageItems(packageItems.isEmpty() ? null : updatedProduct.getPackageItems());
            } else {
                // null인 경우도 명시적으로 null로 설정 (항목 삭제 시)
                product.setPackageItems(null);
            }
            
            // 회차권인 경우 규칙 적용: USAGE_COUNT 필수, VALID_DAYS는 0
            if (finalType == Product.ProductType.COUNT_PASS) {
                // VALID_DAYS는 무조건 0으로 설정 (회차권 규칙)
                if (product.getValidDays() == null || product.getValidDays() != 0) {
                    logger.info("회차권 상품의 VALID_DAYS를 0으로 설정: ID={}, name={}, 기존 값={}", 
                            id, product.getName(), product.getValidDays());
                }
                product.setValidDays(0);
                Integer usageCount = updatedProduct.getUsageCount();
                
                // usageCount가 없으면 packageItems에서 추출 시도 (보조 방법)
                if ((usageCount == null || usageCount <= 0) && product.getPackageItems() != null && !product.getPackageItems().trim().isEmpty()) {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        List<Map<String, Object>> packageItemsList = mapper.readValue(
                            product.getPackageItems(), 
                            new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}
                        );
                        // 패키지 구성의 모든 항목의 횟수 합계
                        int totalCount = 0;
                        for (Map<String, Object> item : packageItemsList) {
                            Object countObj = item.get("count");
                            if (countObj instanceof Number) {
                                totalCount += ((Number) countObj).intValue();
                            }
                        }
                        if (totalCount > 0) {
                            usageCount = totalCount;
                            logger.info("패키지 구성에서 usageCount 자동 추출: 상품 ID={}, 상품명={}, 추출된 횟수={}", 
                                id, product.getName(), usageCount);
                        }
                    } catch (Exception e) {
                        logger.warn("패키지 구성에서 usageCount 추출 실패: {}", e.getMessage());
                    }
                }
                
                // 여전히 usageCount가 없으면 사용 조건에서 추출 시도 (보조 방법)
                if ((usageCount == null || usageCount <= 0) && product.getConditions() != null && !product.getConditions().trim().isEmpty()) {
                    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(\\d+)회권");
                    java.util.regex.Matcher matcher = pattern.matcher(product.getConditions());
                    if (matcher.find()) {
                        try {
                            usageCount = Integer.parseInt(matcher.group(1));
                            logger.info("사용 조건에서 usageCount 자동 추출: 상품 ID={}, 상품명={}, 추출된 횟수={}", 
                                id, product.getName(), usageCount);
                        } catch (NumberFormatException e) {
                            logger.warn("사용 조건에서 usageCount 추출 실패: {}", e.getMessage());
                        }
                    }
                }
                
                // 최종적으로 usageCount가 없으면 기존 값 확인 또는 에러
                if (usageCount == null || usageCount <= 0) {
                    // 기존 값이 있으면 유지, 없으면 에러
                    if (product.getUsageCount() == null || product.getUsageCount() <= 0) {
                        logger.error("회차권 상품의 사용 횟수(usageCount)는 필수이며 1 이상이어야 합니다. ID={}, name={}", 
                            id, updatedProduct.getName());
                        Map<String, Object> errorResponse = new HashMap<>();
                        errorResponse.put("error", "회차권인 경우 사용 횟수는 필수이며 1 이상이어야 합니다.");
                        return ResponseEntity.badRequest().body(errorResponse);
                    } else {
                        // 기존 값 유지
                        logger.warn("회차권 상품의 usageCount가 null입니다. 기존 값 유지: ID={}, name={}, 기존 usageCount={}", 
                            id, updatedProduct.getName(), product.getUsageCount());
                    }
                } else {
                    // 새로운 값으로 업데이트 (직접 입력 또는 자동 추출)
                    product.setUsageCount(usageCount);
                    logger.info("상품 usageCount 업데이트: ID={}, usageCount={}", id, usageCount);
                }
            } else {
                // 회차권이 아니면 null로 설정 가능
                if (updatedProduct.getUsageCount() != null) {
                    product.setUsageCount(updatedProduct.getUsageCount());
                } else {
                    product.setUsageCount(null);
                }
            }
            
            // conditions는 null이거나 빈 문자열일 때도 명시적으로 설정 (사용 조건 삭제/수정 시)
            if (updatedProduct.getConditions() != null) {
                String conditions = updatedProduct.getConditions().trim();
                // MONTHLY_PASS 상품인 경우 날짜 형식을 "시작일로부터 X일" 형식으로 변환
                if ((updatedProduct.getType() == Product.ProductType.MONTHLY_PASS || product.getType() == Product.ProductType.MONTHLY_PASS) 
                    && !conditions.isEmpty()) {
                    java.util.regex.Pattern datePattern = java.util.regex.Pattern.compile("~\\s*\\d{4}\\.\\s*\\d{2}\\.\\s*\\d{2}\\.");
                    java.util.regex.Matcher dateMatcher = datePattern.matcher(conditions);
                    if (dateMatcher.find() || conditions.trim().startsWith("~")) {
                        // 날짜 형식이면 "시작일로부터 X일" 형식으로 변환
                        Integer validDays = product.getValidDays();
                        if (validDays == null || validDays <= 0) {
                            validDays = updatedProduct.getValidDays() != null ? updatedProduct.getValidDays() : 30;
                        }
                        conditions = "시작일로부터 " + validDays + "일";
                        logger.info("MONTHLY_PASS 상품의 conditions 날짜 형식을 변환: ID={}, 변환된 값={}", id, conditions);
                    }
                }
                product.setConditions(conditions.isEmpty() ? null : conditions);
            } else {
                // null인 경우도 명시적으로 null로 설정
                product.setConditions(null);
            }
            
            // refundPolicy는 null이거나 빈 문자열일 때도 명시적으로 설정
            if (updatedProduct.getRefundPolicy() != null) {
                String refundPolicy = updatedProduct.getRefundPolicy().trim();
                product.setRefundPolicy(refundPolicy.isEmpty() ? null : updatedProduct.getRefundPolicy());
            } else {
                // null인 경우도 명시적으로 null로 설정
                product.setRefundPolicy(null);
            }
            
            if (updatedProduct.getActive() != null) {
                product.setActive(updatedProduct.getActive());
            }
            
            if (updatedProduct.getCategory() != null) {
                product.setCategory(updatedProduct.getCategory());
            }
            
            Product saved = productRepository.save(product);
            logger.info("상품 수정 완료: ID={}, name={}, type={}, usageCount={}", 
                saved.getId(), saved.getName(), saved.getType(), saved.getUsageCount());
            
            // Map으로 변환하여 반환
            Map<String, Object> productMap = new HashMap<>();
            productMap.put("id", saved.getId());
            productMap.put("name", saved.getName());
            productMap.put("description", saved.getDescription());
            productMap.put("type", saved.getType() != null ? saved.getType().name() : null);
            productMap.put("price", saved.getPrice());
            productMap.put("validDays", saved.getValidDays());
            productMap.put("usageCount", saved.getUsageCount());
            logger.info("상품 수정 응답 - usageCount: {}", saved.getUsageCount());
            productMap.put("packageItems", saved.getPackageItems());
            productMap.put("conditions", saved.getConditions());
            productMap.put("refundPolicy", saved.getRefundPolicy());
            productMap.put("category", saved.getCategory() != null ? saved.getCategory().name() : null);
            productMap.put("active", saved.getActive());
            
            // coach 정보 안전하게 처리
            if (saved.getCoach() != null) {
                try {
                    Map<String, Object> coachMap = new HashMap<>();
                    coachMap.put("id", saved.getCoach().getId());
                    coachMap.put("name", saved.getCoach().getName());
                    productMap.put("coach", coachMap);
                } catch (Exception e) {
                    logger.warn("상품의 코치 정보 로드 실패. Product ID: {}", saved.getId(), e);
                    productMap.put("coach", null);
                }
            } else {
                productMap.put("coach", null);
            }
            
            return ResponseEntity.ok(productMap);
        } catch (IllegalArgumentException e) {
            logger.warn("상품을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("상품 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        try {
            if (id == null) {
                return ResponseEntity.badRequest().build();
            }
            if (!productRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            productRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("상품 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PostMapping("/batch-update-monthly-pass-conditions")
    @Transactional
    public ResponseEntity<Map<String, Object>> batchUpdateMonthlyPassConditions() {
        List<Map<String, Object>> updateDetails = new java.util.ArrayList<>();
        int updatedCount = 0;
        int totalCount = 0;
        int errorCount = 0;
        
        try {
            logger.info("기간제 상품 conditions 일괄 업데이트 시작");
            
            // MONTHLY_PASS 타입의 모든 상품 조회
            List<Product> monthlyPassProducts = productRepository.findAll().stream()
                    .filter(p -> p.getType() == Product.ProductType.MONTHLY_PASS)
                    .collect(java.util.stream.Collectors.toList());
            
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
            // 트랜잭션이 롤백되도록 예외를 다시 던짐
            throw e;
        }
    }
    
    @PostMapping("/batch-update-all")
    @Transactional
    public ResponseEntity<Map<String, Object>> batchUpdateAllProducts() {
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
                                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                                    List<Map<String, Object>> packageItems = mapper.readValue(
                                        product.getPackageItems(), 
                                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}
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
                                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                                    List<Map<String, Object>> packageItems = mapper.readValue(
                                        product.getPackageItems(), 
                                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}
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
