package com.afbscenter.repository;

import com.afbscenter.model.MemberProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberProductRepository extends JpaRepository<MemberProduct, Long> {

    @Query("SELECT mp FROM MemberProduct mp WHERE mp.member.id = :memberId")
    List<MemberProduct> findByMemberId(@Param("memberId") Long memberId);

    @Query("SELECT mp FROM MemberProduct mp WHERE mp.member.id = :memberId AND mp.product.id = :productId")
    List<MemberProduct> findByMemberIdAndProductId(@Param("memberId") Long memberId, @Param("productId") Long productId);

    @Query("SELECT mp FROM MemberProduct mp WHERE mp.member.id = :memberId AND mp.status = :status")
    List<MemberProduct> findByMemberIdAndStatus(@Param("memberId") Long memberId, @Param("status") MemberProduct.Status status);
    
    // 활성 이용권 조회 시 Product와 Coach 정보를 함께 로드
    @Query("SELECT DISTINCT mp FROM MemberProduct mp " +
           "LEFT JOIN FETCH mp.product p " +
           "LEFT JOIN FETCH mp.coach " +
           "LEFT JOIN FETCH p.coach " +
           "WHERE mp.status = :status ORDER BY mp.purchaseDate DESC")
    List<MemberProduct> findByStatusWithProductAndCoach(@Param("status") MemberProduct.Status status);
    
    @Query("SELECT mp FROM MemberProduct mp JOIN mp.product p WHERE mp.member.id = :memberId AND mp.status = 'ACTIVE' AND p.type = 'COUNT_PASS'")
    List<MemberProduct> findActiveCountPassByMemberId(@Param("memberId") Long memberId);
    
    // 특정 타입의 상품 조회 (기간권 등)
    @Query("SELECT mp FROM MemberProduct mp JOIN mp.product p WHERE mp.member.id = :memberId AND p.type = :productType ORDER BY mp.purchaseDate DESC")
    List<MemberProduct> findByMemberIdAndProductType(@Param("memberId") Long memberId, @Param("productType") com.afbscenter.model.Product.ProductType productType);
    
    // 회원의 모든 상품을 product와 함께 로드 (lazy loading 방지)
    // member는 이미 조회 중이므로 JOIN FETCH하지 않음 (순환 참조 방지)
    // DISTINCT 제거: 같은 상품을 여러 번 구매한 경우 모두 표시해야 함
    // 코치 정보도 함께 로드 (MemberProduct.coach, Product.coach)
    @Query("SELECT DISTINCT mp FROM MemberProduct mp " +
           "LEFT JOIN FETCH mp.product p " +
           "LEFT JOIN FETCH mp.coach " +
           "LEFT JOIN FETCH p.coach " +
           "WHERE mp.member.id = :memberId ORDER BY mp.purchaseDate DESC")
    List<MemberProduct> findByMemberIdWithProduct(@Param("memberId") Long memberId);
    
    // MemberProduct를 member와 함께 로드 (상품 설정 시 사용)
    @Query("SELECT mp FROM MemberProduct mp LEFT JOIN FETCH mp.member LEFT JOIN FETCH mp.product WHERE mp.id = :id")
    java.util.Optional<MemberProduct> findByIdWithMember(@Param("id") Long id);
    
    // 구매일 기준으로 기간 내의 MemberProduct 조회
    @Query("SELECT mp FROM MemberProduct mp LEFT JOIN FETCH mp.product LEFT JOIN FETCH mp.member WHERE mp.purchaseDate >= :start AND mp.purchaseDate <= :end")
    List<MemberProduct> findByPurchaseDateRange(@Param("start") java.time.LocalDateTime start, @Param("end") java.time.LocalDateTime end);
    
    // 특정 Product를 참조하는 모든 MemberProduct 조회
    @Query("SELECT mp FROM MemberProduct mp WHERE mp.product.id = :productId")
    List<MemberProduct> findByProductId(@Param("productId") Long productId);

    /** 횟수권(COUNT_PASS) 이용권만 product, member와 함께 조회 - remaining_count 동기화용 */
    @Query("SELECT mp FROM MemberProduct mp JOIN FETCH mp.product p JOIN FETCH mp.member m WHERE p.type = 'COUNT_PASS'")
    List<MemberProduct> findAllCountPassWithProductAndMember();

    /** 대관 회차용: 잔여만 조회 (getResultList 사용 → 결과 없으면 빈 리스트, 예외 없음) */
    @Query("SELECT mp.remainingCount FROM MemberProduct mp WHERE mp.id = :id")
    List<Integer> findRemainingCountListById(@Param("id") Long id);
}
