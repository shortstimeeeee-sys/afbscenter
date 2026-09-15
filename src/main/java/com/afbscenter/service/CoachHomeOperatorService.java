package com.afbscenter.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

/**
 * 관리자·매니저가 아니어도 코치 홈(출근부)을 관리자처럼 쓸 수 있는 운영 아이디.
 */
@Service
public class CoachHomeOperatorService {

    private final Set<String> usernames;

    public CoachHomeOperatorService(
            @Value("${app.coach-home-operator-usernames:xorhko12}") String usernamesRaw) {
        this.usernames = parseUsernames(usernamesRaw);
    }

    static Set<String> parseUsernames(String raw) {
        Set<String> out = new HashSet<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        for (String p : raw.split(",")) {
            String t = p.trim().toLowerCase();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    public boolean isOperatorUsername(String username) {
        if (username == null || username.isBlank()) {
            return false;
        }
        return usernames.contains(username.trim().toLowerCase());
    }

    /** 코치 홈에서 코치를 골라 조회하는 관리자형 권한. */
    public boolean canUseAdminCoachHome(String username, String role) {
        if (role != null) {
            String r = role.trim();
            if ("ADMIN".equalsIgnoreCase(r) || "MANAGER".equalsIgnoreCase(r)) {
                return true;
            }
        }
        return isOperatorUsername(username);
    }

    /** 운영 관리 화면의 직원 출퇴근 명부. 관리자만. */
    public boolean canUseStaffWorkRoster(String username, String role) {
        return role != null && "ADMIN".equalsIgnoreCase(role.trim());
    }
}
