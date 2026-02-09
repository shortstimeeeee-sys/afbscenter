package com.afbscenter.service;

import com.afbscenter.model.RolePermission;
import com.afbscenter.repository.RolePermissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional
public class RolePermissionService {

    private static final Logger logger = LoggerFactory.getLogger(RolePermissionService.class);
    
    private final RolePermissionRepository rolePermissionRepository;

    @Autowired
    public RolePermissionService(RolePermissionRepository rolePermissionRepository) {
        this.rolePermissionRepository = rolePermissionRepository;
    }

    // 모든 역할의 권한 조회
    @Transactional(readOnly = true)
    public Map<String, RolePermission> getAllRolePermissions() {
        List<RolePermission> permissions = rolePermissionRepository.findAll();
        Map<String, RolePermission> result = new HashMap<>();
        
        // 기본 역할들
        String[] roles = {"ADMIN", "MANAGER", "COACH", "FRONT"};
        
        for (String role : roles) {
            Optional<RolePermission> existing = permissions.stream()
                    .filter(p -> p.getRole().equals(role))
                    .findFirst();
            
            if (existing.isPresent()) {
                result.put(role, existing.get());
            } else {
                // 기본 권한 생성
                RolePermission defaultPerm = createDefaultPermissions(role);
                result.put(role, defaultPerm);
            }
        }
        
        return result;
    }

    // 특정 역할의 권한 조회
    @Transactional(readOnly = true)
    public RolePermission getRolePermission(String role) {
        return rolePermissionRepository.findByRole(role)
                .orElseGet(() -> createDefaultPermissions(role));
    }

    // 권한 저장
    public RolePermission saveRolePermission(String role, Map<String, Boolean> permissions) {
        try {
            logger.info("권한 저장 시작: role={}, permissions 개수={}", role, permissions != null ? permissions.size() : 0);
            
            Optional<RolePermission> existing = rolePermissionRepository.findByRole(role);
            RolePermission rolePermission;
            
            if (existing.isPresent()) {
                rolePermission = existing.get();
                logger.info("기존 권한 객체 찾음: id={}, role={}", rolePermission.getId(), rolePermission.getRole());
            } else {
                rolePermission = createDefaultPermissions(role);
                logger.info("새 권한 객체 생성: role={}", role);
            }

            // 권한 업데이트
        if (permissions.containsKey("memberView")) rolePermission.setMemberView(permissions.get("memberView"));
        if (permissions.containsKey("memberCreate")) rolePermission.setMemberCreate(permissions.get("memberCreate"));
        if (permissions.containsKey("memberEdit")) rolePermission.setMemberEdit(permissions.get("memberEdit"));
        if (permissions.containsKey("memberDelete")) rolePermission.setMemberDelete(permissions.get("memberDelete"));

        if (permissions.containsKey("bookingView")) rolePermission.setBookingView(permissions.get("bookingView"));
        if (permissions.containsKey("bookingCreate")) rolePermission.setBookingCreate(permissions.get("bookingCreate"));
        if (permissions.containsKey("bookingEdit")) rolePermission.setBookingEdit(permissions.get("bookingEdit"));
        if (permissions.containsKey("bookingDelete")) rolePermission.setBookingDelete(permissions.get("bookingDelete"));

        if (permissions.containsKey("coachView")) rolePermission.setCoachView(permissions.get("coachView"));
        if (permissions.containsKey("coachCreate")) rolePermission.setCoachCreate(permissions.get("coachCreate"));
        if (permissions.containsKey("coachEdit")) rolePermission.setCoachEdit(permissions.get("coachEdit"));
        if (permissions.containsKey("coachDelete")) rolePermission.setCoachDelete(permissions.get("coachDelete"));

        if (permissions.containsKey("productView")) rolePermission.setProductView(permissions.get("productView"));
        if (permissions.containsKey("productCreate")) rolePermission.setProductCreate(permissions.get("productCreate"));
        if (permissions.containsKey("productEdit")) rolePermission.setProductEdit(permissions.get("productEdit"));
        if (permissions.containsKey("productDelete")) rolePermission.setProductDelete(permissions.get("productDelete"));

        if (permissions.containsKey("paymentView")) rolePermission.setPaymentView(permissions.get("paymentView"));
        if (permissions.containsKey("paymentCreate")) rolePermission.setPaymentCreate(permissions.get("paymentCreate"));
        if (permissions.containsKey("paymentEdit")) rolePermission.setPaymentEdit(permissions.get("paymentEdit"));
        if (permissions.containsKey("paymentRefund")) rolePermission.setPaymentRefund(permissions.get("paymentRefund"));

        if (permissions.containsKey("analyticsView")) rolePermission.setAnalyticsView(permissions.get("analyticsView"));

        if (permissions.containsKey("dashboardView")) rolePermission.setDashboardView(permissions.get("dashboardView"));

        if (permissions.containsKey("settingsView")) rolePermission.setSettingsView(permissions.get("settingsView"));
        if (permissions.containsKey("settingsEdit")) rolePermission.setSettingsEdit(permissions.get("settingsEdit"));

        if (permissions.containsKey("userView")) rolePermission.setUserView(permissions.get("userView"));
        if (permissions.containsKey("userCreate")) rolePermission.setUserCreate(permissions.get("userCreate"));
        if (permissions.containsKey("userEdit")) rolePermission.setUserEdit(permissions.get("userEdit"));
        if (permissions.containsKey("userDelete")) rolePermission.setUserDelete(permissions.get("userDelete"));

        if (permissions.containsKey("announcementView")) rolePermission.setAnnouncementView(permissions.get("announcementView"));
        if (permissions.containsKey("announcementCreate")) rolePermission.setAnnouncementCreate(permissions.get("announcementCreate"));
        if (permissions.containsKey("announcementEdit")) rolePermission.setAnnouncementEdit(permissions.get("announcementEdit"));
        if (permissions.containsKey("announcementDelete")) rolePermission.setAnnouncementDelete(permissions.get("announcementDelete"));

        if (permissions.containsKey("attendanceView")) rolePermission.setAttendanceView(permissions.get("attendanceView"));
        if (permissions.containsKey("attendanceEdit")) rolePermission.setAttendanceEdit(permissions.get("attendanceEdit"));

        if (permissions.containsKey("trainingLogView")) rolePermission.setTrainingLogView(permissions.get("trainingLogView"));
        if (permissions.containsKey("trainingLogCreate")) rolePermission.setTrainingLogCreate(permissions.get("trainingLogCreate"));
        if (permissions.containsKey("trainingLogEdit")) rolePermission.setTrainingLogEdit(permissions.get("trainingLogEdit"));

            rolePermission.setUpdatedAt(LocalDateTime.now());
            
            logger.info("권한 객체 저장 시도: id={}, role={}", rolePermission.getId(), rolePermission.getRole());
            
            RolePermission saved;
            try {
                saved = rolePermissionRepository.save(rolePermission);
                logger.info("권한 저장 성공: id={}, role={}", saved.getId(), saved.getRole());
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                logger.error("권한 저장 실패 (데이터베이스 제약 조건 위반): role={}", role, e);
                logger.error("제약 조건 위반 메시지: {}", e.getMessage());
                if (e.getCause() != null) {
                    logger.error("원인: {}", e.getCause().getMessage());
                }
                throw new IllegalArgumentException("권한 저장 중 데이터베이스 제약 조건 위반: " + 
                    (e.getCause() != null ? e.getCause().getMessage() : e.getMessage()), e);
            } catch (org.hibernate.exception.ConstraintViolationException e) {
                logger.error("권한 저장 실패 (제약 조건 위반): role={}", role, e);
                logger.error("제약 조건 위반 메시지: {}", e.getMessage());
                throw new IllegalArgumentException("권한 저장 중 제약 조건 위반: " + e.getMessage(), e);
            }
            
            return saved;
        } catch (IllegalArgumentException e) {
            logger.warn("권한 저장 실패 (IllegalArgumentException): role={}, message={}", role, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("권한 저장 중 예외 발생: role={}", role, e);
            logger.error("예외 클래스: {}", e.getClass().getName());
            logger.error("예외 메시지: {}", e.getMessage());
            
            // 원인 체인 전체 출력
            Throwable cause = e.getCause();
            int depth = 0;
            while (cause != null && depth < 5) {
                logger.error("원인 {}: {} - {}", depth + 1, cause.getClass().getName(), cause.getMessage());
                cause = cause.getCause();
                depth++;
            }
            
            throw new RuntimeException("권한 저장 중 오류가 발생했습니다: " + 
                (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()), e);
        }
    }

    // 기본 권한 생성
    private RolePermission createDefaultPermissions(String role) {
        RolePermission perm = new RolePermission();
        perm.setRole(role);

        // 역할별 기본 권한 설정
        switch (role) {
            case "ADMIN":
                // 관리자: 모든 권한
                perm.setMemberView(true);
                perm.setMemberCreate(true);
                perm.setMemberEdit(true);
                perm.setMemberDelete(true);
                perm.setBookingView(true);
                perm.setBookingCreate(true);
                perm.setBookingEdit(true);
                perm.setBookingDelete(true);
                perm.setCoachView(true);
                perm.setCoachCreate(true);
                perm.setCoachEdit(true);
                perm.setCoachDelete(true);
                perm.setProductView(true);
                perm.setProductCreate(true);
                perm.setProductEdit(true);
                perm.setProductDelete(true);
                perm.setPaymentView(true);
                perm.setPaymentCreate(true);
                perm.setPaymentEdit(true);
                perm.setPaymentRefund(true);
                perm.setAnalyticsView(true);
                perm.setDashboardView(true);
                perm.setSettingsView(true);
                perm.setSettingsEdit(true);
                perm.setUserView(true);
                perm.setUserCreate(true);
                perm.setUserEdit(true);
                perm.setUserDelete(true);
                perm.setAnnouncementView(true);
                perm.setAnnouncementCreate(true);
                perm.setAnnouncementEdit(true);
                perm.setAnnouncementDelete(true);
                perm.setAttendanceView(true);
                perm.setAttendanceEdit(true);
                perm.setTrainingLogView(true);
                perm.setTrainingLogCreate(true);
                perm.setTrainingLogEdit(true);
                break;
            case "MANAGER":
                // 매니저: 관리 기능
                perm.setMemberView(true);
                perm.setMemberCreate(true);
                perm.setMemberEdit(true);
                perm.setMemberDelete(false);
                perm.setBookingView(true);
                perm.setBookingCreate(true);
                perm.setBookingEdit(true);
                perm.setBookingDelete(true);
                perm.setCoachView(true);
                perm.setCoachCreate(true);
                perm.setCoachEdit(true);
                perm.setCoachDelete(false);
                perm.setProductView(true);
                perm.setProductCreate(true);
                perm.setProductEdit(true);
                perm.setProductDelete(false);
                perm.setPaymentView(true);
                perm.setPaymentCreate(true);
                perm.setPaymentEdit(false);
                perm.setPaymentRefund(true);
                perm.setAnalyticsView(true);
                perm.setDashboardView(true);
                perm.setSettingsView(true);
                perm.setSettingsEdit(false);
                perm.setUserView(false);
                perm.setUserCreate(false);
                perm.setUserEdit(false);
                perm.setUserDelete(false);
                perm.setAnnouncementView(true);
                perm.setAnnouncementCreate(true);
                perm.setAnnouncementEdit(true);
                perm.setAnnouncementDelete(false);
                perm.setAttendanceView(true);
                perm.setAttendanceEdit(true);
                perm.setTrainingLogView(true);
                perm.setTrainingLogCreate(false);
                perm.setTrainingLogEdit(false);
                break;
            case "COACH":
                // 코치: 코치 관련 기능
                perm.setMemberView(true);
                perm.setMemberCreate(false);
                perm.setMemberEdit(false);
                perm.setMemberDelete(false);
                perm.setBookingView(true);
                perm.setBookingCreate(false);
                perm.setBookingEdit(false);
                perm.setBookingDelete(false);
                perm.setCoachView(true);
                perm.setCoachCreate(false);
                perm.setCoachEdit(false);
                perm.setCoachDelete(false);
                perm.setProductView(false);
                perm.setProductCreate(false);
                perm.setProductEdit(false);
                perm.setProductDelete(false);
                perm.setPaymentView(false);
                perm.setPaymentCreate(false);
                perm.setPaymentEdit(false);
                perm.setPaymentRefund(false);
                perm.setAnalyticsView(false);
                perm.setSettingsView(false);
                perm.setSettingsEdit(false);
                perm.setUserView(false);
                perm.setUserCreate(false);
                perm.setUserEdit(false);
                perm.setUserDelete(false);
                perm.setAnnouncementView(true);
                perm.setAnnouncementCreate(false);
                perm.setAnnouncementEdit(false);
                perm.setAnnouncementDelete(false);
                perm.setAttendanceView(true);
                perm.setAttendanceEdit(true);
                perm.setTrainingLogView(true);
                perm.setTrainingLogCreate(true);
                perm.setTrainingLogEdit(true);
                perm.setDashboardView(true);
                break;
            case "FRONT":
                // 데스크: 기본 기능
                perm.setMemberView(true);
                perm.setMemberCreate(true);
                perm.setMemberEdit(true);
                perm.setMemberDelete(false);
                perm.setBookingView(true);
                perm.setBookingCreate(true);
                perm.setBookingEdit(true);
                perm.setBookingDelete(true);
                perm.setCoachView(true);
                perm.setCoachCreate(false);
                perm.setCoachEdit(false);
                perm.setCoachDelete(false);
                perm.setProductView(true);
                perm.setProductCreate(false);
                perm.setProductEdit(false);
                perm.setProductDelete(false);
                perm.setPaymentView(true);
                perm.setPaymentCreate(true);
                perm.setPaymentEdit(false);
                perm.setPaymentRefund(false);
                perm.setAnalyticsView(false);
                perm.setSettingsView(false);
                perm.setSettingsEdit(false);
                perm.setUserView(false);
                perm.setUserCreate(false);
                perm.setUserEdit(false);
                perm.setUserDelete(false);
                perm.setAnnouncementView(true);
                perm.setAnnouncementCreate(false);
                perm.setAnnouncementEdit(false);
                perm.setAnnouncementDelete(false);
                perm.setAttendanceView(true);
                perm.setAttendanceEdit(true);
                perm.setTrainingLogView(false);
                perm.setTrainingLogCreate(false);
                perm.setTrainingLogEdit(false);
                perm.setDashboardView(true);
                break;
        }

        return perm;
    }
}
