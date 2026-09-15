package com.afbscenter.service;

import com.afbscenter.model.User;
import com.afbscenter.repository.UserAccessLogRepository;
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
    private final CoachService coachService;
    private final UserAccessLogRepository userAccessLogRepository;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       CoachService coachService,
                       UserAccessLogRepository userAccessLogRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.coachService = coachService;
        this.userAccessLogRepository = userAccessLogRepository;
    }

    private String buildEmployeeCodeFromUserId(Long userId) {
        return String.format("USR-%06d", userId);
    }

    private void ensureEmployeeCode(User user) {
        if (user == null) return;
        if (user.getEmployeeCode() != null && !user.getEmployeeCode().trim().isEmpty()) return;
        if (user.getId() == null) return;

        String candidate = buildEmployeeCodeFromUserId(user.getId());
        if (userRepository.existsByEmployeeCode(candidate)) {
            int suffix = 1;
            while (true) {
                String fallback = candidate + "-" + suffix;
                if (!userRepository.existsByEmployeeCode(fallback)) {
                    candidate = fallback;
                    break;
                }
                suffix++;
            }
        }
        user.setEmployeeCode(candidate);
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

    // 직원코드로 조회
    @Transactional(readOnly = true)
    public Optional<User> getUserByEmployeeCode(String employeeCode) {
        return userRepository.findByEmployeeCode(employeeCode);
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

        User saved = userRepository.save(user);
        ensureEmployeeCode(saved);
        return userRepository.save(saved);
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
        // employeeCode는 회원번호처럼 시스템 자동 부여 값으로 취급 (수정 API에서 변경 불가)

        // 활성 상태 업데이트
        if (userData.getActive() != null) {
            user.setActive(userData.getActive());
        }

        // 승인 상태 업데이트
        if (userData.getApproved() != null) {
            user.setApproved(userData.getApproved());
        }

        user.setUpdatedAt(LocalDateTime.now());

        User saved = userRepository.save(user);
        ensureEmployeeCode(saved);
        return userRepository.save(saved);
    }

    // 사용자 완전 삭제. 코치 명단은 남기고 계정 연결만 해제한다.
    public void deleteUser(Long id) {
        deleteUser(id, null);
    }

    public void deleteUser(Long id, String currentUsername) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다: " + id));

        if (currentUsername != null && currentUsername.equalsIgnoreCase(user.getUsername())) {
            throw new RuntimeException("로그인한 계정은 삭제할 수 없습니다.");
        }
        if ("admin".equalsIgnoreCase(user.getUsername())) {
            throw new RuntimeException("기본 관리자 계정은 삭제할 수 없습니다.");
        }
        if (user.getRole() == User.Role.ADMIN) {
            long otherAdmins = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == User.Role.ADMIN && u.getId() != null && !u.getId().equals(id))
                    .count();
            if (otherAdmins == 0) {
                throw new RuntimeException("마지막 관리자 계정은 삭제할 수 없습니다.");
            }
        }

        try {
            coachService.syncUserCoachLink(id, null);
        } catch (Exception e) {
            logger.warn("사용자 삭제 시 코치 연결 해제 실패 userId={}: {}", id, e.getMessage());
        }
        try {
            userAccessLogRepository.deleteByUserId(id);
        } catch (Exception e) {
            logger.warn("사용자 삭제 시 접속 로그 삭제 실패 userId={}: {}", id, e.getMessage());
        }

        userRepository.delete(user);
        logger.info("사용자 삭제: id={}, username={}", id, user.getUsername());
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
        User saved = userRepository.save(user);
        ensureEmployeeCode(saved);
        return userRepository.save(saved);
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
