package com.afbscenter.config;

import com.afbscenter.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtFilter.class);

    @Autowired
    private JwtUtil jwtUtil;

    // JWT 검증을 건너뛸 경로들
    private static final List<String> EXCLUDED_PATHS = Arrays.asList(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/validate",
            "/api/auth/init-admin",
            "/api/public/"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // 정적 리소스나 인증 관련 경로는 필터 건너뛰기
        if (shouldSkipFilter(path, request)) {
            filterChain.doFilter(request, response);
            return;
        }

        // API 요청에 대한 JWT 검증
        if (path.startsWith("/api/")) {
            String token = extractToken(request);
            logger.debug("JWT 필터 - 요청 경로: {}", path);
            logger.debug("JWT 필터 - 토큰: {}", token != null ? "존재함" : "없음");

            if (token != null && !token.isBlank()) {
                logger.debug("JWT 필터 - 토큰 추출 성공, 길이: {}", token.length());
                try {
                    String username = jwtUtil.extractUsername(token);
                    logger.debug("JWT 필터 - 사용자명 추출: {}", username);

                    if (jwtUtil.validateToken(token, username)) {
                        String role = jwtUtil.extractRole(token);
                        logger.debug("JWT 필터 - 토큰 검증 성공: username={}, role={}", username, role);
                        request.setAttribute("username", username);
                        request.setAttribute("role", role);
                        filterChain.doFilter(request, response);
                        return;
                    }
                    logger.warn("JWT 필터 - 토큰 검증 실패: validateToken 반환 false");
                } catch (Exception e) {
                    logger.error("JWT 필터 - 토큰 검증 예외: {}", e.getMessage(), e);
                }
            } else {
                logger.debug("JWT 필터 - Authorization 헤더·인증 쿠키가 없음");
            }

            logger.warn("JWT 필터 - 401 Unauthorized 반환");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"인증이 필요합니다.\"}");
            return;
        }

        // API가 아닌 요청은 그대로 통과
        filterChain.doFilter(request, response);
    }

    private boolean shouldSkipFilter(String path, HttpServletRequest request) {
        // 인증 API는 제외
        if (EXCLUDED_PATHS.stream().anyMatch(path::startsWith)) {
            return true;
        }
        // 비로그인 회원 예약 메뉴에서 훈련 랭킹 열람용 — GET만 허용 (컨텍스트 경로 있어도 동작하도록 endsWith)
        if (path.endsWith("/api/training-logs/rankings") && HttpMethod.GET.matches(request.getMethod())) {
            return true;
        }
        
        // 정적 리소스는 제외
        if (path.equals("/") ||
            path.endsWith(".html") ||
            path.endsWith(".css") ||
            path.endsWith(".js") ||
            path.endsWith(".ico") ||
            path.startsWith("/css/") ||
            path.startsWith("/js/") ||
            path.startsWith("/favicon.ico")) {
            return true;
        }
        
        // API가 아닌 경로는 제외
        if (!path.startsWith("/api/")) {
            return true;
        }
        
        return false;
    }

    /** Bearer 헤더 우선, 없으면 로그인 쿠키(엑셀 등 새 탭 다운로드용). */
    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String bearer = authHeader.substring(7).trim();
            if (!bearer.isEmpty()) {
                return bearer;
            }
        }
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (jakarta.servlet.http.Cookie cookie : cookies) {
            if (cookie != null && "afbs_auth".equals(cookie.getName())
                    && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return java.net.URLDecoder.decode(cookie.getValue(), java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
