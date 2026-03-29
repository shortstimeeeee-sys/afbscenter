package com.afbscenter.repository;

import com.afbscenter.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    // 최신순으로 메시지 조회
    @Query("SELECT m FROM Message m ORDER BY m.createdAt DESC")
    List<Message> findAllOrderByCreatedAtDesc();

    // 특정 기간 내 메시지 조회
    @Query("SELECT m FROM Message m WHERE m.createdAt BETWEEN :startDate AND :endDate ORDER BY m.createdAt DESC")
    List<Message> findByDateRange(LocalDateTime startDate, LocalDateTime endDate);

    // 상태별 메시지 조회
    List<Message> findByStatus(Message.MessageStatus status);

    /** id가 더 큰 레코드 수 (종 알림: 마지막으로 본 id 이후 신규 발송 건) */
    long countByIdGreaterThan(Long id);

    @Query("SELECT COALESCE(MAX(m.id), 0) FROM Message m")
    long findMaxId();
}
