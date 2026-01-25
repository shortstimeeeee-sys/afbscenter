package com.afbscenter.repository;

import com.afbscenter.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByMemberId(Long memberId);
    List<Payment> findByBookingId(Long bookingId);
    
    // 코치 정보를 포함하여 모든 결제 조회 (lazy loading 방지)
    @Query("SELECT DISTINCT p FROM Payment p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.coach LEFT JOIN FETCH p.booking b LEFT JOIN FETCH b.coach LEFT JOIN FETCH p.product ORDER BY p.paidAt DESC")
    List<Payment> findAllWithCoach();
    
    // 회원의 결제 내역을 코치 정보와 함께 조회
    @Query("SELECT DISTINCT p FROM Payment p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.coach LEFT JOIN FETCH p.booking b LEFT JOIN FETCH b.coach LEFT JOIN FETCH p.product WHERE p.member.id = :memberId ORDER BY p.paidAt DESC")
    List<Payment> findByMemberIdWithCoach(@Param("memberId") Long memberId);
    
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.paidAt >= :since ORDER BY p.paidAt DESC")
    List<Payment> findRecentProductPaymentsByMemberAndProduct(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("since") LocalDateTime since);
    
    // 회원과 상품 ID로 활성 결제 조회 (상품 할당 시 중복 방지용)
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.status = 'COMPLETED' AND (p.refundAmount IS NULL OR p.refundAmount = 0)")
    List<Payment> findActiveProductPaymentsByMemberAndProduct(@Param("memberId") Long memberId, @Param("productId") Long productId);
    
    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundAmount, 0)), 0) FROM Payment p WHERE p.paidAt >= :start AND p.paidAt <= :end AND (p.status = 'COMPLETED' OR p.status IS NULL)")
    Integer sumAmountByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundAmount, 0)), 0) FROM Payment p WHERE p.member.id = :memberId AND (p.status = 'COMPLETED' OR p.status IS NULL)")
    Integer sumTotalAmountByMemberId(@Param("memberId") Long memberId);
    
    // MemberProduct 구매 시 결제 기록 찾기 (구매일 전후 범위 내의 결제 기록)
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.status = 'COMPLETED' AND p.paidAt >= :startDate AND p.paidAt <= :endDate ORDER BY p.paidAt ASC")
    List<Payment> findPurchasePaymentByMemberAndProductInRange(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
    
    // MemberProduct 구매 시 결제 기록 찾기 (구매일 이전의 모든 결제 기록, 대체용)
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.status = 'COMPLETED' AND p.paidAt <= :purchaseDate ORDER BY p.paidAt DESC")
    List<Payment> findPurchasePaymentByMemberAndProductBefore(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("purchaseDate") LocalDateTime purchaseDate);
}
