package com.afbscenter.config;

import com.afbscenter.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
            "/api/auth/init-admin"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // 정적 리소스나 인증 관련 경로는 필터 건너뛰기
        if (shouldSkipFilter(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        // API 요청에 대한 JWT 검증
        if (path.startsWith("/api/")) {
            String authHeader = request.getHeader("Authorization");
            logger.debug("JWT 필터 - 요청 경로: {}", path);
            logger.debug("JWT 필터 - Authorization 헤더: {}", authHeader != null ? "존재함" : "없음");
            
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                logger.debug("JWT 필터 - 토큰 추출 성공, 길이: {}", token.length());
                
                try {
                    String username = jwtUtil.extractUsername(token);
                    logger.debug("JWT 필터 - 사용자명 추출: {}", username);
                    
                    if (jwtUtil.validateToken(token, username)) {
                        // 토큰이 유효하면 요청 속성에 사용자 정보 저장
                        String role = jwtUtil.extractRole(token);
                        logger.debug("JWT 필터 - 토큰 검증 성공: username={}, role={}", username, role);
                        request.setAttribute("username", username);
                        request.setAttribute("role", role);
                        filterChain.doFilter(request, response);
                        return;
                    } else {
                        logger.warn("JWT 필터 - 토큰 검증 실패: validateToken 반환 false");
                    }
                } catch (Exception e) {
                    // 토큰 검증 실패 - 로그 출력
                    logger.error("JWT 필터 - 토큰 검증 예외: {}", e.getMessage(), e);
                }
            } else {
                logger.debug("JWT 필터 - Authorization 헤더가 없거나 Bearer 형식이 아님");
            }

            // 토큰이 없거나 유효하지 않은 경우
            logger.warn("JWT 필터 - 401 Unauthorized 반환");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"인증이 필요합니다.\"}");
            return;
        }

        // API가 아닌 요청은 그대로 통과
        filterChain.doFilter(request, response);
    }

    private boolean shouldSkipFilter(String path) {
        // 인증 API는 제외
        if (EXCLUDED_PATHS.stream().anyMatch(path::startsWith)) {
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
}
