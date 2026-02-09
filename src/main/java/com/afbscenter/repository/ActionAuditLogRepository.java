package com.afbscenter.repository;

import com.afbscenter.model.ActionAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ActionAuditLogRepository extends JpaRepository<ActionAuditLog, Long> {
}
