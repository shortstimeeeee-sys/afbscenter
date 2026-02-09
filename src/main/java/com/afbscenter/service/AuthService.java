package com.afbscenter.service;

import com.afbscenter.model.User;
import com.afbscenter.model.UserAccessLog;
import com.afbscenter.repository.UserAccessLogRepository;
import com.afbscenter.repository.UserRepository;
import com.afbscenter.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final UserAccessLogRepository userAccessLogRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    
    @Value("${admin.init.password:admin123}")
    private String adminInitPassword;

    @Autowired
    public AuthService(UserRepository userRepository, UserAccessLogRepository userAccessLogRepository,
                       JwtUtil jwtUtil, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.userAccessLogRepository = userAccessLogRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 로그인 처리. 성공 시 접속 로그 저장.
     * @param ipAddress 클라이언트 IP (null 가능)
     * @param userAgent User-Agent (null 가능)
     */
    @Transactional
    public Map<String, Object> login(String username, String password, String ipAddress, String userAgent) {
        logger.debug("=== 로그인 시도 시작 ===");
        logger.debug("입력된 사용자명: [{}]", username);
        logger.debug("입력된 비밀번호 길이: {}", password != null ? password.length() : 0);
        
        // 먼저 모든 사용자 확인 (디버깅)
        long totalUsers = userRepository.count();
        logger.debug("전체 사용자 수: {}", totalUsers);
        
        // 사용자명으로 검색 (active 여부 무관)
        Optional<User> userOptAll = userRepository.findByUsername(username);
        if (userOptAll.isPresent()) {
            User userAll = userOptAll.get();
            logger.debug("사용자 찾음 (active 무관): username={}, active={}, role={}", 
                userAll.getUsername(), userAll.getActive(), userAll.getRole());
        } else {
            logger.debug("사용자명으로 검색 결과 없음: {}", username);
        }
        
        // active=true이고 approved=true인 사용자만 검색
        Optional<User> userOpt = userRepository.findByUsernameAndActiveTrue(username);
        
        if (userOpt.isEmpty()) {
            logger.warn("활성화된 사용자를 찾을 수 없음: {}", username);
            throw new RuntimeException("사용자명 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = userOpt.get();
        
        // 승인되지 않은 사용자는 로그인 불가
        if (!user.getApproved()) {
            logger.warn("승인되지 않은 사용자: {}", username);
            throw new RuntimeException("관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.");
        }
        
        logger.debug("사용자 찾음: username={}, role={}, active={}, approved={}", 
            user.getUsername(), user.getRole(), user.getActive(), user.getApproved());
        logger.debug("저장된 비밀번호 해시 길이: {}", user.getPassword() != null ? user.getPassword().length() : 0);
        
        boolean passwordMatches = passwordEncoder.matches(password, user.getPassword());
        logger.debug("비밀번호 일치 여부: {}", passwordMatches);
        
        if (!passwordMatches) {
            logger.warn("비밀번호 불일치: username={}", username);
            throw new RuntimeException("사용자명 또는 비밀번호가 올바르지 않습니다.");
        }
        
        logger.debug("비밀번호 일치 확인 완료: username={}", username);

        // 마지막 로그인 시간 업데이트
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        // 접속 로그 저장 (각 사용자별 로그인 기록)
        try {
            UserAccessLog accessLog = UserAccessLog.of(user, ipAddress, userAgent);
            userAccessLogRepository.save(accessLog);
        } catch (Exception e) {
            logger.warn("접속 로그 저장 실패 (로그인은 유지): {}", e.getMessage());
        }

        // JWT 토큰 생성
        String token = jwtUtil.generateToken(username, user.getRole().name());

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("username", user.getUsername());
        response.put("role", user.getRole().name());
        response.put("name", user.getName());
        response.put("id", user.getId());

        return response;
    }

    /**
     * 로그인 아이디/비밀번호만 검증 (토큰 발급·lastLogin 업데이트 없음).
     * 랭킹 개인정보 보기 등에서 "본인 확인"용으로 사용.
     */
    public boolean verifyCredentials(String username, String password) {
        if (username == null || username.trim().isEmpty() || password == null) {
            return false;
        }
        Optional<User> userOpt = userRepository.findByUsernameAndActiveTrue(username.trim());
        if (userOpt.isEmpty() || !userOpt.get().getApproved()) {
            return false;
        }
        User user = userOpt.get();
        return passwordEncoder.matches(password, user.getPassword());
    }

    /**
     * 관리자 비밀번호 검증 (랭킹 개인정보 열람용).
     * DB에 있는 admin 계정 비밀번호와 일치하면 true.
     */
    public boolean verifyAdminPassword(String password) {
        if (password == null || password.isEmpty()) {
            return false;
        }
        Optional<User> adminOpt = userRepository.findByUsername("admin");
        if (adminOpt.isEmpty()) {
            return false;
        }
        User admin = adminOpt.get();
        return User.Role.ADMIN.equals(admin.getRole()) && passwordEncoder.matches(password, admin.getPassword());
    }

    public User getCurrentUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    }

    public boolean validateToken(String token) {
        try {
            String username = jwtUtil.extractUsername(token);
            return jwtUtil.validateToken(token, username);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 회원 가입
     */
    @Transactional
    public Map<String, Object> register(String username, String password, String name, String phoneNumber) {
        logger.debug("=== 회원 가입 시작 ===");
        logger.debug("사용자명: {}, 이름: {}, 전화번호: {}", username, name, phoneNumber);
        
        // 사용자명 중복 확인
        if (userRepository.existsByUsername(username)) {
            logger.warn("이미 사용 중인 사용자명: {}", username);
            throw new RuntimeException("이미 사용 중인 사용자명입니다.");
        }

        // 새 사용자 생성 (승인 대기 상태)
        User newUser = new User();
        newUser.setUsername(username);
        newUser.setPassword(passwordEncoder.encode(password));
        newUser.setName(name);
        newUser.setPhoneNumber(phoneNumber);
        newUser.setRole(User.Role.FRONT); // 기본 역할은 FRONT
        newUser.setActive(true);
        newUser.setApproved(false); // 관리자 승인 대기 상태
        
        logger.debug("사용자 생성 전 - approved: {}, active: {}", newUser.getApproved(), newUser.getActive());
        
        User savedUser = userRepository.save(newUser);
        
        logger.info("사용자 저장 완료 - ID: {}, 사용자명: {}, 이름: {}, 권한: {}, active: {}, approved: {}", 
            savedUser.getId(), savedUser.getUsername(), savedUser.getName(), 
            savedUser.getRole(), savedUser.getActive(), savedUser.getApproved());
        
        // 저장 후 다시 조회하여 확인
        Optional<User> verifyUser = userRepository.findById(savedUser.getId());
        if (verifyUser.isPresent()) {
            User verified = verifyUser.get();
            logger.debug("저장 후 재조회 - approved: {}, active: {}", verified.getApproved(), verified.getActive());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "회원 가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
        response.put("username", savedUser.getUsername());
        response.put("name", savedUser.getName());
        response.put("role", savedUser.getRole().name());
        response.put("approved", savedUser.getApproved());
        return response;
    }

    /**
     * 기본 관리자 계정 생성 (개발용)
     * 기존 계정이 있으면 비밀번호를 재설정합니다.
     */
    @Transactional
    public Map<String, Object> createDefaultAdmin() {
        Map<String, Object> response = new HashMap<>();
        
        Optional<User> existingUser = userRepository.findByUsername("admin");
        
        if (existingUser.isPresent()) {
            // 기존 계정이 있으면 비밀번호를 재설정
            User admin = existingUser.get();
            String newPassword = passwordEncoder.encode(adminInitPassword);
            admin.setPassword(newPassword);
            admin.setActive(true);
            admin.setRole(User.Role.ADMIN);
            admin.setApproved(true); // 관리자는 자동 승인
            userRepository.save(admin);
            
            // 비밀번호 검증 테스트
            boolean testMatch = passwordEncoder.matches(adminInitPassword, newPassword);
            logger.info("관리자 계정 비밀번호 재설정 완료 - 비밀번호 검증 테스트: {}", testMatch);
            
            response.put("message", "관리자 계정 비밀번호가 재설정되었습니다. (username: admin, 초기 비밀번호는 설정값을 확인하세요)");
            response.put("exists", true);
            response.put("username", admin.getUsername());
            response.put("role", admin.getRole().name());
            response.put("active", admin.getActive());
            response.put("passwordReset", true);
            return response;
        }

        // 새 계정 생성
        User admin = new User();
        admin.setUsername("admin");
        String encodedPassword = passwordEncoder.encode(adminInitPassword);
        admin.setPassword(encodedPassword);
        admin.setRole(User.Role.ADMIN);
        admin.setName("관리자");
        admin.setActive(true);
        admin.setApproved(true); // 관리자는 자동 승인
        userRepository.save(admin);
        
        // 비밀번호 검증 테스트
        boolean testMatch = passwordEncoder.matches(adminInitPassword, encodedPassword);
        logger.info("관리자 계정 생성 완료 - 비밀번호 검증 테스트: {}", testMatch);

        response.put("message", "관리자 계정이 생성되었습니다. (username: admin, 초기 비밀번호는 설정값을 확인하세요)");
        response.put("exists", false);
        response.put("username", "admin");
        response.put("role", "ADMIN");
        response.put("passwordReset", false);
        return response;
    }
}
