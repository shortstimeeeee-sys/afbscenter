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

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM UserAccessLog l WHERE l.userId = :userId")
    void deleteByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);
}
