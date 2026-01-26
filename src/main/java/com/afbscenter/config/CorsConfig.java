package com.afbscenter.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;

/**
 * CORS(Cross-Origin Resource Sharing) 설정
 * 모든 API 엔드포인트에 대한 CORS 정책을 중앙에서 관리
 * ngrok 등 외부 도메인 접근을 위한 강화된 CORS 설정
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${cors.allowed-origins:http://localhost:8080}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = allowedOrigins.split(",");
        registry.addMapping("/api/**")
                .allowedOriginPatterns(origins.length > 0 ? origins : new String[]{"*"})
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    /**
     * CorsFilter를 통한 추가 CORS 설정
     * ngrok 등 외부 프록시를 통한 접근 시 필요한 헤더 처리
     */
    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // 자격 증명 허용
        config.setAllowCredentials(true);
        
        // 허용된 origin 설정 (allowCredentials가 true일 때는 allowedOriginPatterns 사용)
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        if (origins.isEmpty() || origins.contains("*")) {
            // 모든 origin 허용 (개발 환경)
            config.addAllowedOriginPattern("*");
        } else {
            // 특정 origin만 허용
            config.setAllowedOriginPatterns(origins);
        }
        
        // 모든 헤더 허용 (ngrok-skip-browser-warning 포함)
        config.addAllowedHeader("*");
        
        // 모든 HTTP 메서드 허용
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"));
        
        // Preflight 요청 캐시 시간
        config.setMaxAge(3600L);
        
        // 모든 API 경로에 적용
        source.registerCorsConfiguration("/api/**", config);
        
        return new CorsFilter(source);
    }
}
