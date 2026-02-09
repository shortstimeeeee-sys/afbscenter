package com.afbscenter.repository;

import com.afbscenter.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByActiveTrue();
    
    // Coach를 함께 로드하여 Lazy loading 문제 방지
    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.coach")
    List<Product> findAllWithCoach();
    
    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.coach WHERE p.id = :id")
    Optional<Product> findByIdWithCoach(Long id);
    
    // 타입별 상품 조회
    List<Product> findByType(Product.ProductType type);
    
    // 중복 체크: 이름, 가격, 카테고리가 모두 동일한 상품 조회
    @Query("SELECT p FROM Product p WHERE p.name = :name AND p.price = :price AND p.category = :category")
    List<Product> findByNameAndPriceAndCategory(String name, Integer price, Product.ProductCategory category);
}
