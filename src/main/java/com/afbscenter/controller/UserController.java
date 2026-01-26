package com.afbscenter.controller;

import com.afbscenter.model.User;
import com.afbscenter.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }

    // 전체 사용자 조회
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    // 활성 사용자만 조회
    @GetMapping("/active")
    public ResponseEntity<List<User>> getActiveUsers() {
        List<User> users = userService.getActiveUsers();
        return ResponseEntity.ok(users);
    }

    // 승인 대기 사용자 조회
    @GetMapping("/pending")
    public ResponseEntity<List<User>> getPendingUsers() {
        List<User> users = userService.getPendingUsers();
        return ResponseEntity.ok(users);
    }

    // 사용자 승인
    @PostMapping("/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveUser(@PathVariable Long id) {
        try {
            User approvedUser = userService.approveUser(id);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "사용자가 승인되었습니다.");
            response.put("user", approvedUser);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "사용자 승인 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 사용자 승인 거부
    @PostMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectUser(@PathVariable Long id) {
        try {
            userService.rejectUser(id);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "사용자 승인이 거부되었습니다.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "사용자 승인 거부 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 사용자 ID로 조회
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 사용자 생성
    @PostMapping
    public ResponseEntity<Map<String, Object>> createUser(@RequestBody User user) {
        try {
            User createdUser = userService.createUser(user);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "사용자가 생성되었습니다.");
            response.put("user", createdUser);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "사용자 생성 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 사용자 수정
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateUser(@PathVariable Long id, @RequestBody User userData) {
        try {
            User updatedUser = userService.updateUser(id, userData);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "사용자 정보가 수정되었습니다.");
            response.put("user", updatedUser);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "사용자 수정 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 사용자 삭제 (소프트 삭제)
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteUser(@PathVariable Long id) {
        try {
            userService.deleteUser(id);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "사용자가 비활성화되었습니다.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "사용자 삭제 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 비밀번호 변경
    @PostMapping("/{id}/change-password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            String newPassword = request.get("password");
            if (newPassword == null || newPassword.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "비밀번호는 필수입니다.");
                return ResponseEntity.badRequest().body(error);
            }

            userService.changePassword(id, newPassword);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "비밀번호가 변경되었습니다.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "비밀번호 변경 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 권한 변경
    @PostMapping("/{id}/change-role")
    public ResponseEntity<Map<String, Object>> changeRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            String roleStr = request.get("role");
            if (roleStr == null || roleStr.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "권한은 필수입니다.");
                return ResponseEntity.badRequest().body(error);
            }

            User.Role newRole;
            try {
                newRole = User.Role.valueOf(roleStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "유효하지 않은 권한입니다: " + roleStr);
                return ResponseEntity.badRequest().body(error);
            }

            userService.changeRole(id, newRole);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "권한이 변경되었습니다.");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "권한 변경 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
