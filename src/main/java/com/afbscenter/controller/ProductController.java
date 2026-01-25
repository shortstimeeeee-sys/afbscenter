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
            logger.info("상품 생성 요청 수신: name={}, type={}, price={}", 
                product.getName(), product.getType(), product.getPrice());
            
            // active 기본값 설정
            if (product.getActive() == null) {
                product.setActive(true);
            }
            
            // 필수 필드 검증
            if (product.getName() == null || product.getName().trim().isEmpty()) {
                logger.error("상품명이 필수입니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "상품명은 필수입니다.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            if (product.getType() == null) {
                logger.error("상품 유형이 필수입니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "상품 유형은 필수입니다.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            if (product.getPrice() == null || product.getPrice() < 0) {
                logger.error("가격이 필수이며 0 이상이어야 합니다.");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "가격은 필수이며 0 이상이어야 합니다.");
                return ResponseEntity.badRequest().body(errorResponse);
            }
            
            Product saved = productRepository.save(product);
            logger.info("상품 저장 성공: ID={}, name={}, type={}, price={}", 
                saved.getId(), saved.getName(), saved.getType(), saved.getPrice());
            
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
            
            if (updatedProduct.getPrice() != null) {
                product.setPrice(updatedProduct.getPrice());
            }
            
            if (updatedProduct.getValidDays() != null) {
                product.setValidDays(updatedProduct.getValidDays());
            }
            
            if (updatedProduct.getUsageCount() != null) {
                product.setUsageCount(updatedProduct.getUsageCount());
            }
            
            // packageItems는 null이거나 빈 문자열일 때도 명시적으로 설정 (항목 삭제 시 빈 값으로 업데이트)
            if (updatedProduct.getPackageItems() != null) {
                // 빈 문자열이면 null로 설정, 아니면 그대로 설정
                String packageItems = updatedProduct.getPackageItems().trim();
                product.setPackageItems(packageItems.isEmpty() ? null : updatedProduct.getPackageItems());
            } else {
                // null인 경우도 명시적으로 null로 설정 (항목 삭제 시)
                product.setPackageItems(null);
            }
            
            // conditions는 null이거나 빈 문자열일 때도 명시적으로 설정 (사용 조건 삭제/수정 시)
            if (updatedProduct.getConditions() != null) {
                String conditions = updatedProduct.getConditions().trim();
                product.setConditions(conditions.isEmpty() ? null : updatedProduct.getConditions());
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
}
