package com.afbscenter.repository;

import com.afbscenter.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByUsernameAndActiveTrue(String username);
    boolean existsByUsername(String username);
    
    // 승인 대기 사용자 조회 (approved = false AND active = true)
    List<User> findByApprovedFalseAndActiveTrue();
}
