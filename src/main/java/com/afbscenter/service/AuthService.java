package com.afbscenter.service;

import com.afbscenter.model.User;
import com.afbscenter.repository.UserRepository;
import com.afbscenter.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public AuthService(UserRepository userRepository, JwtUtil jwtUtil, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, Object> login(String username, String password) {
        System.out.println("=== 로그인 시도 시작 ===");
        System.out.println("입력된 사용자명: [" + username + "]");
        System.out.println("입력된 비밀번호 길이: " + (password != null ? password.length() : 0));
        
        // 먼저 모든 사용자 확인 (디버깅)
        long totalUsers = userRepository.count();
        System.out.println("전체 사용자 수: " + totalUsers);
        
        // 사용자명으로 검색 (active 여부 무관)
        Optional<User> userOptAll = userRepository.findByUsername(username);
        if (userOptAll.isPresent()) {
            User userAll = userOptAll.get();
            System.out.println("사용자 찾음 (active 무관): username=" + userAll.getUsername() + 
                ", active=" + userAll.getActive() + ", role=" + userAll.getRole());
        } else {
            System.out.println("사용자명으로 검색 결과 없음: " + username);
        }
        
        // active=true이고 approved=true인 사용자만 검색
        Optional<User> userOpt = userRepository.findByUsernameAndActiveTrue(username);
        
        if (userOpt.isEmpty()) {
            System.out.println("❌ 활성화된 사용자를 찾을 수 없음: " + username);
            throw new RuntimeException("사용자명 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = userOpt.get();
        
        // 승인되지 않은 사용자는 로그인 불가
        if (!user.getApproved()) {
            System.out.println("❌ 승인되지 않은 사용자: " + username);
            throw new RuntimeException("관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.");
        }
        
        System.out.println("✅ 사용자 찾음: username=" + user.getUsername() + 
            ", role=" + user.getRole() + ", active=" + user.getActive() + ", approved=" + user.getApproved());
        System.out.println("저장된 비밀번호 해시 길이: " + (user.getPassword() != null ? user.getPassword().length() : 0));
        
        boolean passwordMatches = passwordEncoder.matches(password, user.getPassword());
        System.out.println("비밀번호 일치 여부: " + passwordMatches);
        
        if (!passwordMatches) {
            System.out.println("❌ 비밀번호 불일치");
            // 테스트: 직접 해시 생성해서 비교
            String testHash = passwordEncoder.encode(password);
            System.out.println("테스트 해시 생성: " + testHash);
            boolean testMatch = passwordEncoder.matches(password, testHash);
            System.out.println("테스트 해시 검증: " + testMatch);
            throw new RuntimeException("사용자명 또는 비밀번호가 올바르지 않습니다.");
        }
        
        System.out.println("✅ 비밀번호 일치 확인");

        // 마지막 로그인 시간 업데이트
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

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
        System.out.println("=== 회원 가입 시작 ===");
        System.out.println("사용자명: " + username);
        System.out.println("이름: " + name);
        System.out.println("전화번호: " + phoneNumber);
        
        // 사용자명 중복 확인
        if (userRepository.existsByUsername(username)) {
            System.out.println("❌ 이미 사용 중인 사용자명: " + username);
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
        
        System.out.println("사용자 생성 전 - approved: " + newUser.getApproved() + ", active: " + newUser.getActive());
        
        User savedUser = userRepository.save(newUser);
        
        System.out.println("✅ 사용자 저장 완료");
        System.out.println("  - ID: " + savedUser.getId());
        System.out.println("  - 사용자명: " + savedUser.getUsername());
        System.out.println("  - 이름: " + savedUser.getName());
        System.out.println("  - 권한: " + savedUser.getRole());
        System.out.println("  - active: " + savedUser.getActive());
        System.out.println("  - approved: " + savedUser.getApproved());
        
        // 저장 후 다시 조회하여 확인
        Optional<User> verifyUser = userRepository.findById(savedUser.getId());
        if (verifyUser.isPresent()) {
            User verified = verifyUser.get();
            System.out.println("저장 후 재조회 - approved: " + verified.getApproved() + ", active: " + verified.getActive());
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
            String newPassword = passwordEncoder.encode("admin123");
            admin.setPassword(newPassword);
            admin.setActive(true);
            admin.setRole(User.Role.ADMIN);
            admin.setApproved(true); // 관리자는 자동 승인
            userRepository.save(admin);
            
            // 비밀번호 검증 테스트
            boolean testMatch = passwordEncoder.matches("admin123", newPassword);
            System.out.println("관리자 계정 비밀번호 재설정 완료");
            System.out.println("비밀번호 검증 테스트: " + testMatch);
            
            response.put("message", "관리자 계정 비밀번호가 재설정되었습니다. (username: admin, password: admin123)");
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
        String encodedPassword = passwordEncoder.encode("admin123");
        admin.setPassword(encodedPassword);
        admin.setRole(User.Role.ADMIN);
        admin.setName("관리자");
        admin.setActive(true);
        admin.setApproved(true); // 관리자는 자동 승인
        userRepository.save(admin);
        
        // 비밀번호 검증 테스트
        boolean testMatch = passwordEncoder.matches("admin123", encodedPassword);
        System.out.println("관리자 계정 생성 완료");
        System.out.println("비밀번호 검증 테스트: " + testMatch);

        response.put("message", "관리자 계정이 생성되었습니다. (username: admin, password: admin123)");
        response.put("exists", false);
        response.put("username", "admin");
        response.put("role", "ADMIN");
        response.put("passwordReset", false);
        return response;
    }
}
