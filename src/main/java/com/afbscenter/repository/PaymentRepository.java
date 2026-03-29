package com.afbscenter.repository;

import com.afbscenter.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByMemberId(Long memberId);
    List<Payment> findByBookingId(Long bookingId);

    @Query("SELECT DISTINCT p FROM Payment p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.coach LEFT JOIN FETCH p.booking b LEFT JOIN FETCH b.coach LEFT JOIN FETCH p.product prod LEFT JOIN FETCH prod.coach LEFT JOIN FETCH p.memberProduct WHERE p.id = :id")
    Optional<Payment> findByIdWithCoach(@Param("id") Long id);
    
    // 코치 정보를 포함하여 모든 결제 조회 (상품 기본 코치까지 한 번에 로드)
    @Query("SELECT DISTINCT p FROM Payment p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.coach LEFT JOIN FETCH p.booking b LEFT JOIN FETCH b.coach LEFT JOIN FETCH p.product prod LEFT JOIN FETCH prod.coach LEFT JOIN FETCH p.memberProduct ORDER BY p.paidAt DESC")
    List<Payment> findAllWithCoach();

    // 기간 내 결제만 조회 (대시보드 매출 지표용 - 전체 조회 대체)
    @Query("SELECT DISTINCT p FROM Payment p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.coach LEFT JOIN FETCH p.booking b LEFT JOIN FETCH b.coach LEFT JOIN FETCH p.product prod LEFT JOIN FETCH prod.coach LEFT JOIN FETCH p.memberProduct WHERE p.paidAt >= :start AND p.paidAt <= :end ORDER BY p.paidAt DESC")
    List<Payment> findByPaidAtBetweenWithCoach(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    // 회원의 결제 내역을 코치 정보와 함께 조회
    @Query("SELECT DISTINCT p FROM Payment p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.coach LEFT JOIN FETCH p.booking b LEFT JOIN FETCH b.coach LEFT JOIN FETCH p.product prod LEFT JOIN FETCH prod.coach LEFT JOIN FETCH p.memberProduct WHERE p.member.id = :memberId ORDER BY p.paidAt DESC")
    List<Payment> findByMemberIdWithCoach(@Param("memberId") Long memberId);
    
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.paidAt >= :since ORDER BY p.paidAt DESC")
    List<Payment> findRecentProductPaymentsByMemberAndProduct(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("since") LocalDateTime since);
    
    // 회원과 상품 ID로 활성 결제 조회 (상품 할당 시 중복 방지용)
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.status = 'COMPLETED' AND (p.refundAmount IS NULL OR p.refundAmount = 0)")
    List<Payment> findActiveProductPaymentsByMemberAndProduct(@Param("memberId") Long memberId, @Param("productId") Long productId);
    
    /**
     * 기간 순매출 합계: 각 건 (amount − refundAmount), 상태는 COMPLETED·null 만.
     * 연결된 이용권이 소프트 삭제된 결제는 집계에서 제외(이력은 payments에 유지).
     */
    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundAmount, 0)), 0) FROM Payment p WHERE p.paidAt >= :start AND p.paidAt <= :end AND (p.status = 'COMPLETED' OR p.status IS NULL) AND (p.memberProduct IS NULL OR p.memberProduct.deletedAt IS NULL)")
    Integer sumAmountByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** {@link #sumAmountByDateRange}와 동일 조건의 결제 건수 (대시보드·모달 표시용). */
    @Query("SELECT COUNT(p) FROM Payment p WHERE p.paidAt >= :start AND p.paidAt <= :end AND (p.status = 'COMPLETED' OR p.status IS NULL) AND (p.memberProduct IS NULL OR p.memberProduct.deletedAt IS NULL)")
    long countForRevenueInDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** 환불 금액이 있으나 상태가 REFUNDED가 아닌 건 수 (요약용, 전체 스캔 대체) */
    @Query("SELECT COUNT(p) FROM Payment p WHERE p.refundAmount IS NOT NULL AND p.refundAmount > 0 AND (p.status IS NULL OR p.status <> 'REFUNDED')")
    long countRefundPending();
    
    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundAmount, 0)), 0) FROM Payment p WHERE p.member.id = :memberId AND (p.status = 'COMPLETED' OR p.status IS NULL) AND (p.memberProduct IS NULL OR p.memberProduct.deletedAt IS NULL)")
    Integer sumTotalAmountByMemberId(@Param("memberId") Long memberId);
    
    // MemberProduct 구매 시 결제 기록 찾기 (구매일 전후 범위 내의 결제 기록)
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.status = 'COMPLETED' AND p.paidAt >= :startDate AND p.paidAt <= :endDate ORDER BY p.paidAt ASC")
    List<Payment> findPurchasePaymentByMemberAndProductInRange(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
    
    // MemberProduct 구매 시 결제 기록 찾기 (구매일 이전의 모든 결제 기록, 대체용)
    @Query("SELECT p FROM Payment p WHERE p.member.id = :memberId AND p.product.id = :productId AND p.category = 'PRODUCT_SALE' AND p.status = 'COMPLETED' AND p.paidAt <= :purchaseDate ORDER BY p.paidAt DESC")
    List<Payment> findPurchasePaymentByMemberAndProductBefore(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("purchaseDate") LocalDateTime purchaseDate);
    
    // 특정 연도의 결제 번호로 시작하는 결제 조회
    @Query("SELECT p FROM Payment p WHERE p.paymentNumber LIKE :pattern ORDER BY p.paymentNumber DESC")
    List<Payment> findByPaymentNumberPattern(@Param("pattern") String pattern);
}
