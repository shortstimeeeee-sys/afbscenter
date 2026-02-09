package com.afbscenter.service;

import com.afbscenter.model.User;
import com.afbscenter.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 전체 사용자 조회
    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        List<User> allUsers = userRepository.findAll();
        logger.debug("=== 전체 사용자 조회 ===");
        logger.debug("전체 사용자 수: {}", allUsers.size());
        for (User user : allUsers) {
            logger.debug("  - ID: {}, 사용자명: {}, 이름: {}, approved: {}, active: {}", 
                user.getId(), user.getUsername(), user.getName(), 
                user.getApproved(), user.getActive());
        }
        return allUsers;
    }

    // 활성 사용자만 조회
    @Transactional(readOnly = true)
    public List<User> getActiveUsers() {
        return userRepository.findAll().stream()
                .filter(user -> user.getActive() != null && user.getActive())
                .toList();
    }

    // 승인 대기 사용자 조회
    @Transactional(readOnly = true)
    public List<User> getPendingUsers() {
        List<User> pendingUsers = userRepository.findByApprovedFalseAndActiveTrue();
        logger.debug("=== 승인 대기 사용자 조회 ===");
        logger.debug("조회된 승인 대기 사용자 수: {}", pendingUsers.size());
        for (User user : pendingUsers) {
            logger.debug("  - ID: {}, 사용자명: {}, 이름: {}, approved: {}, active: {}", 
                user.getId(), user.getUsername(), user.getName(), 
                user.getApproved(), user.getActive());
        }
        return pendingUsers;
    }

    // 사용자 ID로 조회
    @Transactional(readOnly = true)
    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    // 사용자명으로 조회
    @Transactional(readOnly = true)
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    // 사용자 생성
    public User createUser(User user) {
        // 사용자명 중복 체크
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new RuntimeException("이미 존재하는 사용자명입니다: " + user.getUsername());
        }

        // 비밀번호 암호화
        if (user.getPassword() != null && !user.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        } else {
            throw new RuntimeException("비밀번호는 필수입니다.");
        }

        // 기본값 설정
        if (user.getActive() == null) {
            user.setActive(true);
        }
        if (user.getApproved() == null) {
            user.setApproved(true); // 관리자가 직접 생성한 사용자는 자동 승인
        }

        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        return userRepository.save(user);
    }

    // 사용자 수정
    public User updateUser(Long id, User userData) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));

        // 사용자명 변경 시 중복 체크
        if (!user.getUsername().equals(userData.getUsername()) && 
            userRepository.existsByUsername(userData.getUsername())) {
            throw new RuntimeException("이미 존재하는 사용자명입니다: " + userData.getUsername());
        }

        // 사용자명 업데이트
        user.setUsername(userData.getUsername());

        // 비밀번호 업데이트 (제공된 경우에만)
        if (userData.getPassword() != null && !userData.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(userData.getPassword()));
        }

        // 권한 업데이트
        if (userData.getRole() != null) {
            user.setRole(userData.getRole());
        }

        // 이름, 전화번호 업데이트
        user.setName(userData.getName());
        user.setPhoneNumber(userData.getPhoneNumber());

        // 활성 상태 업데이트
        if (userData.getActive() != null) {
            user.setActive(userData.getActive());
        }

        // 승인 상태 업데이트
        if (userData.getApproved() != null) {
            user.setApproved(userData.getApproved());
        }

        user.setUpdatedAt(LocalDateTime.now());

        return userRepository.save(user);
    }

    // 사용자 삭제 (소프트 삭제 - active를 false로)
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));
        
        // 자기 자신은 삭제 불가
        // (이 체크는 컨트롤러에서 현재 로그인한 사용자와 비교하여 처리)
        
        user.setActive(false);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    // 비밀번호 변경
    public void changePassword(Long id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));

        if (newPassword == null || newPassword.isEmpty()) {
            throw new RuntimeException("비밀번호는 필수입니다.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    // 권한 변경
    public void changeRole(Long id, User.Role newRole) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));

        user.setRole(newRole);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    // 사용자 승인
    public User approveUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));

        if (user.getApproved() != null && user.getApproved()) {
            throw new RuntimeException("이미 승인된 사용자입니다.");
        }

        user.setApproved(true);
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    // 사용자 승인 거부 (계정 비활성화)
    public void rejectUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));

        user.setActive(false);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }
}
