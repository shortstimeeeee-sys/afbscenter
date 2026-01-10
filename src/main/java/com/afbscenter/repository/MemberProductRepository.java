package com.afbscenter.repository;

import com.afbscenter.model.MemberProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberProductRepository extends JpaRepository<MemberProduct, Long> {
    List<MemberProduct> findByMemberId(Long memberId);
    List<MemberProduct> findByMemberIdAndStatus(Long memberId, MemberProduct.Status status);
    
    @Query("SELECT mp FROM MemberProduct mp JOIN mp.product p WHERE mp.member.id = :memberId AND mp.status = 'ACTIVE' AND p.type = 'COUNT_PASS'")
    List<MemberProduct> findActiveCountPassByMemberId(@Param("memberId") Long memberId);
    
    // 회원의 모든 상품을 product와 함께 로드 (lazy loading 방지)
    // member는 이미 조회 중이므로 JOIN FETCH하지 않음 (순환 참조 방지)
    @Query("SELECT DISTINCT mp FROM MemberProduct mp LEFT JOIN FETCH mp.product WHERE mp.member.id = :memberId")
    List<MemberProduct> findByMemberIdWithProduct(@Param("memberId") Long memberId);
    
    // MemberProduct를 member와 함께 로드 (상품 설정 시 사용)
    @Query("SELECT mp FROM MemberProduct mp LEFT JOIN FETCH mp.member LEFT JOIN FETCH mp.product WHERE mp.id = :id")
    java.util.Optional<MemberProduct> findByIdWithMember(@Param("id") Long id);
}
