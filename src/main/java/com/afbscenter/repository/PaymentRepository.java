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
    
    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundAmount, 0)), 0) FROM Payment p WHERE p.paidAt >= :start AND p.paidAt < :end AND (p.status = 'COMPLETED' OR p.status IS NULL)")
    Integer sumAmountByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundAmount, 0)), 0) FROM Payment p WHERE p.member.id = :memberId AND (p.status = 'COMPLETED' OR p.status IS NULL)")
    Integer sumTotalAmountByMemberId(@Param("memberId") Long memberId);
}
