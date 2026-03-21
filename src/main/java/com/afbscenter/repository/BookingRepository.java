package com.afbscenter.repository;

import com.afbscenter.model.Booking;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct WHERE b.member.id = :memberId ORDER BY b.id DESC")
    List<Booking> findByMemberId(@Param("memberId") Long memberId);
    List<Booking> findByFacilityId(Long facilityId);
    List<Booking> findByStatus(Booking.BookingStatus status);

    /** 체크인 미처리 예약용: CONFIRMED+COMPLETED를 facility/member/coach와 함께 한 번에 조회 (N+1 방지) */
    @Query("SELECT DISTINCT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.member.coach LEFT JOIN FETCH b.coach WHERE b.status IN :statuses ORDER BY b.startTime DESC")
    List<Booking> findByStatusInWithFacilityAndMember(@Param("statuses") List<Booking.BookingStatus> statuses);

    /** JOIN FETCH 4개로 제한: 7개일 때 Hibernate가 루트를 ID별 개별 조회(bookings where id=?)하는 문제 방지. member.coach, mp.product, mp.member는 default_batch_fetch_size로 lazy 시 배치 로드 */
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct WHERE b.startTime >= :start AND b.startTime <= :end ORDER BY b.startTime ASC")
    List<Booking> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    long countByStartTimeBetween(LocalDateTime start, LocalDateTime end);
    
    /** JOIN FETCH 4개로 제한 (findByDateRange와 동일, N+1 방지) */
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct ORDER BY b.startTime DESC")
    List<Booking> findAllWithFacilityAndMember();
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach WHERE b.id = :id")
    Booking findByIdWithFacilityAndMember(@Param("id") Long id);

    /** 체크인 전용: facility·member만 FETCH (memberProduct 없음 → null 예약에서도 예외 없음) */
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member WHERE b.id = :id")
    Optional<Booking> findByIdWithFacilityAndMemberOnly(@Param("id") Long id);
    
    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.facility LEFT JOIN FETCH b.member LEFT JOIN FETCH b.coach LEFT JOIN FETCH b.memberProduct LEFT JOIN FETCH b.memberProduct.product WHERE b.id = :id")
    Booking findByIdWithAllRelations(@Param("id") Long id);

    /** 체크인 시 동일 예약에 대한 동시 요청으로 인한 중복 차감 방지용 배타 락 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);
    
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

    /** 같은 이용권으로 예약된 건 중 id가 더 작은 건 수 (생성 순서). 횟수 조정 시 원본=7회차·복사본=8·9회차 구분용 */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND b.id < :bookingId")
    long countByMemberProductIdBefore(@Param("memberProductId") Long memberProductId, @Param("bookingId") Long bookingId);

    /** 같은 이용권으로 예약된 건 중 이 예약보다 나중인 건 수. 예약 시점 잔여 = 현재 잔여 + 이 값 */
    @Query("SELECT COUNT(b) FROM Booking b WHERE b.memberProduct.id = :memberProductId AND (b.startTime > :startTime OR (b.startTime = :startTime AND b.id > :bookingId))")
    long countByMemberProductAfterInOrder(@Param("memberProductId") Long memberProductId, @Param("startTime") LocalDateTime startTime, @Param("bookingId") Long bookingId);

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

    /** 특정 코치의 비회원 예약 목록 (수강 인원 모달용) */
    @Query("SELECT b FROM Booking b WHERE b.coach.id = :coachId AND b.member IS NULL ORDER BY b.id DESC")
    List<Booking> findByCoachIdAndMemberIsNull(@Param("coachId") Long coachId);

    /** 같은 이용권 중 시각순 첫 예약 1건 (회차 표시: 첫 예약이 완료면 firstSession 보정용) */
    Optional<Booking> findFirstByMemberProduct_IdOrderByStartTimeAscIdAsc(Long memberProductId);
}
