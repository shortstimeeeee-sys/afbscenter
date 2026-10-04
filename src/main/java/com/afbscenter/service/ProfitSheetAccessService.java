package com.afbscenter.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

/**
 * 수기 수익 정산표. 관리자와 지정 아이디만 본다.
 */
@Service
public class ProfitSheetAccessService {

    private final Set<String> usernames;

    public ProfitSheetAccessService(
            @Value("${app.profit-sheet-usernames:xorho12,xorhko12}") String usernamesRaw) {
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

    public boolean isAllowedUsername(String username) {
        if (username == null || username.isBlank()) {
            return false;
        }
        return usernames.contains(username.trim().toLowerCase());
    }

    public boolean canSee(String username, String role) {
        if (role != null && "ADMIN".equalsIgnoreCase(role.trim())) {
            return true;
        }
        return isAllowedUsername(username);
    }
}
