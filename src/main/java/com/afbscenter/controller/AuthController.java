package com.afbscenter.controller;

import com.afbscenter.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    
    @Value("${admin.init.password:07-503392}")
    private String adminInitPassword;

    @Autowired
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> loginRequest,
                                                      HttpServletRequest request) {
        try {
            logger.debug("로그인 요청 수신");
            
            String username = loginRequest.get("username");
            String password = loginRequest.get("password");

            if (username == null || username.trim().isEmpty()) {
                logger.warn("로그인 실패: 사용자명이 비어있음");
                Map<String, Object> error = new HashMap<>();
                error.put("error", "사용자명을 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }

            if (password == null || password.trim().isEmpty()) {
                logger.warn("로그인 실패: 비밀번호가 비어있음");
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호를 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }

            String ipAddress = getClientIp(request);
            String userAgent = request.getHeader("User-Agent");

            logger.debug("AuthService.login 호출: username={}", username);
            Map<String, Object> response = authService.login(username, password, ipAddress, userAgent);
            logger.info("로그인 성공: username={}", response.get("username"));
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            logger.warn("로그인 실패 (RuntimeException): {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            logger.error("로그인 실패 (Exception): {}", e.getMessage(), e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "로그인 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /** 로그인 아이디/비밀번호 검증 (토큰 발급 없음). 랭킹 개인정보 보기 등 본인 확인용 */
    @PostMapping("/verify-credentials")
    public ResponseEntity<Map<String, Object>> verifyCredentials(@RequestBody Map<String, String> body) {
        Map<String, Object> result = new HashMap<>();
        String username = body != null ? body.get("username") : null;
        String password = body != null ? body.get("password") : null;
        boolean valid = authService.verifyCredentials(username, password);
        result.put("valid", valid);
        return ResponseEntity.ok(result);
    }

    /** 관리자 비밀번호만 검증 (랭킹 이름·회원번호 열람용). admin 계정 비밀번호와 일치하면 valid: true */
    @PostMapping("/verify-admin-password")
    public ResponseEntity<Map<String, Object>> verifyAdminPassword(@RequestBody Map<String, String> body) {
        Map<String, Object> result = new HashMap<>();
        String password = body != null ? body.get("password") : null;
        boolean valid = authService.verifyAdminPassword(password);
        result.put("valid", valid);
        return ResponseEntity.ok(result);
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateToken(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            if (token == null || token.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("valid", false);
                error.put("error", "토큰이 제공되지 않았습니다.");
                return ResponseEntity.badRequest().body(error);
            }

            boolean isValid = authService.validateToken(token);
            Map<String, Object> response = new HashMap<>();
            response.put("valid", isValid);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("valid", false);
            error.put("error", "토큰 검증 중 오류가 발생했습니다.");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, String> registerRequest) {
        try {
            String username = registerRequest.get("username");
            String password = registerRequest.get("password");
            String name = registerRequest.get("name");
            String phoneNumber = registerRequest.get("phoneNumber");

            if (username == null || username.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "사용자명을 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }

            if (password == null || password.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호를 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }

            if (password.length() < 4) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호는 최소 4자 이상이어야 합니다.");
                return ResponseEntity.badRequest().body(error);
            }

            Map<String, Object> response = authService.register(username, password, name, phoneNumber);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "회원 가입 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * 임시: 초기 관리자 계정 생성 (개발용)
     * 비밀번호 인증이 필요합니다.
     * 프로덕션에서는 제거하거나 보안 강화 필요
     */
    @PostMapping("/init-admin")
    public ResponseEntity<Map<String, Object>> initAdmin(@RequestBody(required = false) Map<String, String> request) {
        try {
            // 비밀번호 검증
            String providedPassword = request != null ? request.get("password") : null;
            
            if (providedPassword == null || providedPassword.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호가 필요합니다.");
                return ResponseEntity.badRequest().body(error);
            }
            
            if (!providedPassword.equals(adminInitPassword)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호가 일치하지 않습니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
            }
            
            Map<String, Object> result = authService.createDefaultAdmin();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "관리자 계정 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
