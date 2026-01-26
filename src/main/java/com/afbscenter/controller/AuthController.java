package com.afbscenter.controller;

import com.afbscenter.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    
    @Value("${admin.init.password:07-503392}")
    private String adminInitPassword;

    @Autowired
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> loginRequest) {
        try {
            System.out.println("로그인 요청 수신: " + loginRequest);
            
            String username = loginRequest.get("username");
            String password = loginRequest.get("password");

            if (username == null || username.trim().isEmpty()) {
                System.out.println("사용자명이 비어있음");
                Map<String, Object> error = new HashMap<>();
                error.put("error", "사용자명을 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }

            if (password == null || password.trim().isEmpty()) {
                System.out.println("비밀번호가 비어있음");
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호를 입력해주세요.");
                return ResponseEntity.badRequest().body(error);
            }

            System.out.println("AuthService.login 호출: username=" + username);
            Map<String, Object> response = authService.login(username, password);
            System.out.println("로그인 성공: " + response.get("username"));
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            System.out.println("로그인 실패 (RuntimeException): " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            System.out.println("로그인 실패 (Exception): " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "로그인 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
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
