package com.afbscenter.controller;

import com.afbscenter.model.Product;
import com.afbscenter.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
public class ProductController {

    private static final Logger logger = LoggerFactory.getLogger(ProductController.class);

    @Autowired
    private ProductRepository productRepository;

    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts() {
        try {
            List<Product> products = productRepository.findAll();
            // memberProducts는 @JsonIgnore로 처리되므로 별도 로드 불필요
            return ResponseEntity.ok(products);
        } catch (Exception e) {
            logger.error("상품 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        try {
            return productRepository.findById(id)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("상품 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<Product> createProduct(@RequestBody Product product) {
        try {
            // 필수 필드 검증
            if (product.getName() == null || product.getName().trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            if (product.getType() == null) {
                return ResponseEntity.badRequest().build();
            }
            
            if (product.getPrice() == null) {
                return ResponseEntity.badRequest().build();
            }
            
            // active 기본값 설정
            if (product.getActive() == null) {
                product.setActive(true);
            }
            
            Product saved = productRepository.save(product);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            logger.error("상품 생성 중 오류 발생", e);
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> updateProduct(@PathVariable Long id, @RequestBody Product updatedProduct) {
        try {
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
            
            if (updatedProduct.getConditions() != null) {
                product.setConditions(updatedProduct.getConditions());
            }
            
            if (updatedProduct.getRefundPolicy() != null) {
                product.setRefundPolicy(updatedProduct.getRefundPolicy());
            }
            
            if (updatedProduct.getActive() != null) {
                product.setActive(updatedProduct.getActive());
            }
            
            Product saved = productRepository.save(product);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("상품을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("상품 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        try {
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
