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
}
