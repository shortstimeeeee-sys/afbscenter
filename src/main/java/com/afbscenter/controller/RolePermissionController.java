package com.afbscenter.controller;

import com.afbscenter.model.RolePermission;
import com.afbscenter.service.RolePermissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/role-permissions")
public class RolePermissionController {

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
            RolePermission saved = rolePermissionService.saveRolePermission(role.toUpperCase(), permissions);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "권한이 저장되었습니다.");
            response.put("permission", saved);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "권한 저장 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
