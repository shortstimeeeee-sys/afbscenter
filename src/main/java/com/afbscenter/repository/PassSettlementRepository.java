package com.afbscenter.repository;

import com.afbscenter.model.PassSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PassSettlementRepository extends JpaRepository<PassSettlement, Long> {

    Optional<PassSettlement> findTopByOrderBySettledThroughDesc();

    boolean existsBySettledThrough(LocalDateTime settledThrough);
}
