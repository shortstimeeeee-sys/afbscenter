package com.afbscenter.repository;

import com.afbscenter.model.CoachPaymentReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CoachPaymentReceiptRepository extends JpaRepository<CoachPaymentReceipt, Long> {

    Optional<CoachPaymentReceipt> findByCoachIdAndPaymentId(Long coachId, Long paymentId);

    List<CoachPaymentReceipt> findByCoachIdAndPaymentIdIn(Long coachId, Collection<Long> paymentIds);

    void deleteByCoachIdAndPaymentId(Long coachId, Long paymentId);
}
