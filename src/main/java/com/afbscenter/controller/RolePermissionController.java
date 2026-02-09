package com.afbscenter.controller;

import com.afbscenter.model.RolePermission;
import com.afbscenter.service.RolePermissionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/role-permissions")
public class RolePermissionController {

    private static final Logger logger = LoggerFactory.getLogger(RolePermissionController.class);
    
    private final RolePermissionService rolePermissionService;

    @Autowired
    public RolePermissionController(RolePermissionService rolePermissionService) {
        this.rolePermissionService = rolePermissionService;
    }

    // 모든 역할의 권한 조회
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllRolePermissions() {
        try {
            Map<String, RolePermission> permissions = rolePermissionService.getAllRolePermissions();
            Map<String, Object> response = new HashMap<>();
            response.put("permissions", permissions);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "권한 조회 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    // 특정 역할의 권한 조회
    @GetMapping("/{role}")
    public ResponseEntity<RolePermission> getRolePermission(@PathVariable String role) {
        try {
            RolePermission permission = rolePermissionService.getRolePermission(role.toUpperCase());
            return ResponseEntity.ok(permission);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // 권한 저장
    @PutMapping("/{role}")
    public ResponseEntity<Map<String, Object>> saveRolePermission(
            @PathVariable String role,
            @RequestBody Map<String, Boolean> permissions) {
        try {
            logger.info("권한 저장 요청: role={}, permissions={}", role, permissions);
            RolePermission saved = rolePermissionService.saveRolePermission(role.toUpperCase(), permissions);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "권한이 저장되었습니다.");
            response.put("permission", saved);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("권한 저장 중 오류 발생: role={}", role, e);
            logger.error("오류 클래스: {}", e.getClass().getName());
            logger.error("오류 메시지: {}", e.getMessage());
            
            // 원인 체인 전체 출력
            Throwable cause = e.getCause();
            int depth = 0;
            while (cause != null && depth < 5) {
                logger.error("원인 {}: {} - {}", depth + 1, cause.getClass().getName(), cause.getMessage());
                cause = cause.getCause();
                depth++;
            }
            
            Map<String, Object> error = new HashMap<>();
            error.put("error", "권한 저장 중 오류가 발생했습니다: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
            error.put("errorClass", e.getClass().getName());
            if (e.getCause() != null) {
                error.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
