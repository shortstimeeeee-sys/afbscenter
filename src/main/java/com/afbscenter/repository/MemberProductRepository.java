package com.afbscenter.repository;

import com.afbscenter.model.MemberProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberProductRepository extends JpaRepository<MemberProduct, Long> {

    /** 활성(미삭제) 이용권만 — 일반 조회·수정용 */
    Optional<MemberProduct> findByIdAndDeletedAtIsNull(Long id);

    List<MemberProduct> findAllByDeletedAtIsNull();

    @Query("SELECT mp FROM MemberProduct mp WHERE mp.member.id = :memberId AND mp.deletedAt IS NULL")
    List<MemberProduct> findByMemberId(@Param("memberId") Long memberId);

    @Query("SELECT DISTINCT mp FROM MemberProduct mp LEFT JOIN FETCH mp.coach WHERE mp.member.id = :memberId AND mp.product.id = :productId AND mp.deletedAt IS NULL")
    List<MemberProduct> findByMemberIdAndProductId(@Param("memberId") Long memberId, @Param("productId") Long productId);

    @Query("SELECT mp FROM MemberProduct mp WHERE mp.member.id = :memberId AND mp.status = :status AND mp.deletedAt IS NULL")
    List<MemberProduct> findByMemberIdAndStatus(@Param("memberId") Long memberId, @Param("status") MemberProduct.Status status);

    @Query("SELECT DISTINCT mp FROM MemberProduct mp " +
           "LEFT JOIN FETCH mp.product p " +
           "LEFT JOIN FETCH mp.coach " +
           "LEFT JOIN FETCH p.coach " +
           "WHERE mp.status = :status AND mp.deletedAt IS NULL ORDER BY mp.purchaseDate DESC")
    List<MemberProduct> findByStatusWithProductAndCoach(@Param("status") MemberProduct.Status status);

    @Query("SELECT mp FROM MemberProduct mp JOIN mp.product p WHERE mp.member.id = :memberId AND mp.status = 'ACTIVE' AND p.type = 'COUNT_PASS' AND mp.deletedAt IS NULL")
    List<MemberProduct> findActiveCountPassByMemberId(@Param("memberId") Long memberId);

    @Query("SELECT mp FROM MemberProduct mp JOIN mp.product p WHERE mp.member.id = :memberId AND p.type = :productType AND mp.deletedAt IS NULL ORDER BY mp.purchaseDate DESC")
    List<MemberProduct> findByMemberIdAndProductType(@Param("memberId") Long memberId, @Param("productType") com.afbscenter.model.Product.ProductType productType);

    @Query("SELECT DISTINCT mp FROM MemberProduct mp " +
           "LEFT JOIN FETCH mp.product p " +
           "LEFT JOIN FETCH mp.coach " +
           "LEFT JOIN FETCH p.coach " +
           "WHERE mp.member.id = :memberId AND mp.deletedAt IS NULL ORDER BY mp.purchaseDate DESC")
    List<MemberProduct> findByMemberIdWithProduct(@Param("memberId") Long memberId);

    @Query("SELECT mp FROM MemberProduct mp LEFT JOIN FETCH mp.member LEFT JOIN FETCH mp.product WHERE mp.id = :id AND mp.deletedAt IS NULL")
    Optional<MemberProduct> findByIdWithMember(@Param("id") Long id);

    @Query("SELECT mp FROM MemberProduct mp LEFT JOIN FETCH mp.product LEFT JOIN FETCH mp.member WHERE mp.purchaseDate >= :start AND mp.purchaseDate <= :end AND mp.deletedAt IS NULL")
    List<MemberProduct> findByPurchaseDateRange(@Param("start") java.time.LocalDateTime start, @Param("end") java.time.LocalDateTime end);

    @Query("SELECT mp FROM MemberProduct mp WHERE mp.product.id = :productId AND mp.deletedAt IS NULL")
    List<MemberProduct> findByProductId(@Param("productId") Long productId);

    @Query("SELECT mp FROM MemberProduct mp JOIN FETCH mp.product p JOIN FETCH mp.member m WHERE p.type = 'COUNT_PASS' AND mp.deletedAt IS NULL")
    List<MemberProduct> findAllCountPassWithProductAndMember();

    /** 운영 코치 viewCoachIds: ACTIVE 이용권에 직접 배정된 코치만 (종료·소진 행은 목록·화면 담당 표시와 불일치 방지) */
    @Query("SELECT DISTINCT mp.member.id FROM MemberProduct mp WHERE mp.deletedAt IS NULL AND mp.status = 'ACTIVE' AND mp.coach IS NOT NULL AND mp.coach.id IN :coachIds")
    List<Long> findMemberIdsByMemberProductCoachIdIn(@Param("coachIds") List<Long> coachIds);

    /** 운영 코치 viewCoachIds: ACTIVE 이용권의 상품 기본 담당 코치만 */
    @Query("SELECT DISTINCT mp.member.id FROM MemberProduct mp JOIN mp.product p WHERE mp.deletedAt IS NULL AND mp.status = 'ACTIVE' AND p.coach IS NOT NULL AND p.coach.id IN :coachIds")
    List<Long> findMemberIdsByProductCoachIdIn(@Param("coachIds") List<Long> coachIds);

    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM MemberProduct mp WHERE mp.member.id = :memberId AND mp.deletedAt IS NULL AND mp.status = 'ACTIVE' AND mp.coach IS NOT NULL AND mp.coach.id = :coachId")
    boolean existsActiveByMemberIdAndMemberProductCoachId(@Param("memberId") Long memberId, @Param("coachId") Long coachId);

    @Query("SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM MemberProduct mp JOIN mp.product p WHERE mp.member.id = :memberId AND mp.deletedAt IS NULL AND mp.status = 'ACTIVE' AND p.coach IS NOT NULL AND p.coach.id = :coachId")
    boolean existsActiveByMemberIdAndProductCoachId(@Param("memberId") Long memberId, @Param("coachId") Long coachId);

    @Query("SELECT mp.remainingCount FROM MemberProduct mp WHERE mp.id = :id AND mp.deletedAt IS NULL")
    List<Integer> findRemainingCountListById(@Param("id") Long id);

    @Query("SELECT COUNT(DISTINCT m.id) FROM Member m WHERE EXISTS (SELECT 1 FROM MemberProduct mp WHERE mp.member.id = m.id AND mp.deletedAt IS NULL AND (mp.status = 'EXPIRED' OR mp.status = 'USED_UP')) AND NOT EXISTS (SELECT 1 FROM MemberProduct mp2 WHERE mp2.member.id = m.id AND mp2.deletedAt IS NULL AND mp2.status = 'ACTIVE')")
    long countMembersWithOnlyEndedProducts();

    @Query("SELECT COUNT(DISTINCT mp.member.id) FROM MemberProduct mp WHERE mp.deletedAt IS NULL AND (mp.status = 'EXPIRED' OR mp.status = 'USED_UP') AND mp.endedAt >= :since AND EXISTS (SELECT 1 FROM MemberProduct mp2 WHERE mp2.member.id = mp.member.id AND mp2.deletedAt IS NULL AND mp2.status = 'ACTIVE')")
    long countMembersWithPartialEndedSince(@Param("since") java.time.LocalDateTime since);

    @Query("SELECT DISTINCT m.id FROM Member m WHERE EXISTS (SELECT 1 FROM MemberProduct mp WHERE mp.member.id = m.id AND mp.deletedAt IS NULL AND (mp.status = 'EXPIRED' OR mp.status = 'USED_UP')) AND NOT EXISTS (SELECT 1 FROM MemberProduct mp2 WHERE mp2.member.id = m.id AND mp2.deletedAt IS NULL AND mp2.status = 'ACTIVE')")
    List<Long> findMemberIdsWithOnlyEndedProducts();

    @Query("SELECT DISTINCT mp.member.id FROM MemberProduct mp WHERE mp.deletedAt IS NULL AND (mp.status = 'EXPIRED' OR mp.status = 'USED_UP') AND mp.endedAt >= :since AND EXISTS (SELECT 1 FROM MemberProduct mp2 WHERE mp2.member.id = mp.member.id AND mp2.deletedAt IS NULL AND mp2.status = 'ACTIVE')")
    List<Long> findMemberIdsWithPartialEndedSince(@Param("since") java.time.LocalDateTime since);
}
