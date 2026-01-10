package com.afbscenter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@SpringBootApplication
public class AfbsCenterApplication {

    public static void main(String[] args) {
        // UTF-8 인코딩 강제 설정 (한글 깨짐 방지)
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("sun.jnu.encoding", "UTF-8");
        java.nio.charset.Charset.defaultCharset(); // 인코딩 적용 강제
        
        // 로케일 설정 (한국어)
        Locale.setDefault(Locale.KOREA);
        
        SpringApplication.run(AfbsCenterApplication.class, args);
    }
}
