package com.afbscenter.repository;

import com.afbscenter.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct mp LEFT JOIN FETCH mp.product WHERE b.member.id = :memberId ORDER BY b.id DESC")
    List<Booking> findByMemberId(@Param("memberId") Long memberId);
    List<Booking> findByFacilityId(Long facilityId);
    List<Booking> findByStatus(Booking.BookingStatus status);
    
    @Query("SELECT DISTINCT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct mp LEFT JOIN FETCH mp.product LEFT JOIN FETCH mp.member WHERE b.startTime >= :start AND b.startTime <= :end ORDER BY b.startTime ASC")
    List<Booking> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    // DISTINCT 제거: JOIN FETCH와 함께 사용 시 예상치 못한 결과 발생 가능. 대관 회차 표시를 위해 memberProduct/product/member 포함
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct mp LEFT JOIN FETCH mp.product LEFT JOIN FETCH mp.member ORDER BY b.startTime DESC")
    List<Booking> findAllWithFacilityAndMember();
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach WHERE b.id = :id")
    Booking findByIdWithFacilityAndMember(@Param("id") Long id);
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct LEFT JOIN FETCH b.memberProduct.product WHERE b.id = :id")
    Booking findByIdWithAllRelations(@Param("id") Long id);
    
    @Query("SELECT b FROM Booking b WHERE DATE(b.startTime) = DATE(:date)")
    List<Booking> findByDate(@Param("date") LocalDateTime date);
    
    @Query("SELECT b FROM Booking b WHERE b.purpose = 'LESSON' AND b.lessonCategory = :category")
    List<Booking> findByLessonCategory(@Param("category") com.afbscenter.model.LessonCategory category);
    
    @Query("SELECT b FROM Booking b WHERE b.member.id = :memberId AND b.purpose = 'LESSON' AND b.status = 'CONFIRMED' ORDER BY b.startTime DESC")
    List<Booking> findLatestLessonByMemberId(@Param("memberId") Long memberId);
    
    // 특정 상품을 사용한 확정된 예약 수 조회 (출석 기록이 있는 예약만 카운트, 체크인 시에만 차감되므로)
    // 주의: 예약 확정 시에는 차감하지 않으므로, 확정된 예약은 카운트하지 않음
    // 체크인된 예약만 카운트하여 remainingCount 계산에 사용
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND EXISTS (SELECT 1 FROM Attendance a WHERE a.booking.id = b.id AND a.checkInTime IS NOT NULL)")
    Long countConfirmedBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 회원의 특정 상품을 사용한 확정된 예약 목록 조회
    @Query("SELECT b FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.status = 'CONFIRMED' ORDER BY b.startTime ASC")
    List<Booking> findConfirmedBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 특정 상품을 참조하는 모든 예약 조회 (상태 무관)
    @Query("SELECT b FROM Booking b WHERE b.memberProduct.id = :memberProductId")
    List<Booking> findAllBookingsByMemberProductId(@Param("memberProductId") Long memberProductId);
    
    // 회원의 확정된 레슨 예약 중 memberProduct가 없고 출석 기록도 없는 예약 수 조회 (중복 방지)
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.member.id = :memberId AND b.purpose = 'LESSON' AND b.status = 'CONFIRMED' AND b.memberProduct IS NULL AND NOT EXISTS (SELECT 1 FROM Attendance a WHERE a.booking.id = b.id AND a.checkInTime IS NOT NULL)")
    Long countConfirmedLessonsWithoutMemberProduct(@Param("memberId") Long memberId);

    /** 회원 예약 중 이용권(memberProduct)이 연결되지 않은 예약 목록 (확인/보정용) */
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach WHERE b.member IS NOT NULL AND b.memberProduct IS NULL ORDER BY b.startTime DESC")
    List<Booking> findByMemberNotNullAndMemberProductNull();

    /** 같은 이용권으로 예약된 건 중 이 예약보다 먼저 온 건 수 (startTime 오름차순, id 오름차순). 회차 = count + 1 */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND (b.startTime < :startTime OR (b.startTime = :startTime AND b.id < :bookingId))")
    long countByMemberProductBeforeInOrder(@Param("memberProductId") Long memberProductId, @Param("startTime") LocalDateTime startTime, @Param("bookingId") Long bookingId);

    /** 같은 이용권 + 같은 지점으로 예약된 건 중 이 예약보다 먼저 온 건 수. 대관 캘린더에서 지점별 회차 표시용 */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.branch = :branch AND (b.startTime < :startTime OR (b.startTime = :startTime AND b.id < :bookingId))")
    long countByMemberProductAndBranchBeforeInOrder(@Param("memberProductId") Long memberProductId, @Param("branch") com.afbscenter.model.Booking.Branch branch, @Param("startTime") LocalDateTime startTime, @Param("bookingId") Long bookingId);

    /** 같은 이용권으로 이미 종료된 예약 수 (end_time < 기준시각). 잔여 역산·회차 표시 보정용 */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.endTime < :beforeTime")
    long countByMemberProductEndedBefore(@Param("memberProductId") Long memberProductId, @Param("beforeTime") LocalDateTime beforeTime);

    /** 같은 회원·같은 상품(다른 이용권 행 포함)으로 이미 종료된 예약 수. member_product_id 없이 저장된 과거 예약도 회차에 반영 */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct IS NOT NULL AND b.memberProduct.member.id = :memberId AND b.memberProduct.product.id = :productId AND b.endTime < :beforeTime")
    long countByMemberIdAndProductIdEndedBefore(@Param("memberId") Long memberId, @Param("productId") Long productId, @Param("beforeTime") LocalDateTime beforeTime);

    /** 비회원 예약 건수 (member_id가 null인 예약) */
    long countByMemberIsNull();
}
