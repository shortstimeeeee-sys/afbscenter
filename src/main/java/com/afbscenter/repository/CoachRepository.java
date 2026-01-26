package com.afbscenter.repository;

import com.afbscenter.model.Coach;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CoachRepository extends JpaRepository<Coach, Long> {
    List<Coach> findByActiveTrue();
    Optional<Coach> findByUserId(Long userId);
}
