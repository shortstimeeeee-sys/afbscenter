package com.afbscenter.repository;

import com.afbscenter.model.UserAccessLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserAccessLogRepository extends JpaRepository<UserAccessLog, Long> {

    List<UserAccessLog> findByUserIdOrderByLoginAtDesc(Long userId, Pageable pageable);

    List<UserAccessLog> findByUserIdAndLoginAtBetweenOrderByLoginAtDesc(Long userId, LocalDateTime start, LocalDateTime end);
}
