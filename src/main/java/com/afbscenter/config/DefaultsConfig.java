package com.afbscenter.config;

import com.afbscenter.constants.PaymentDefaults;
import com.afbscenter.constants.ProductDefaults;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * application.properties의 기본값을 ProductDefaults, PaymentDefaults에 주입.
 * 하드코딩 제거 후 설정 기반 기본값 사용.
 */
@Component
public class DefaultsConfig {

    private final Environment environment;

    public DefaultsConfig(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void init() {
        ProductDefaults.setEnvironment(environment);
        PaymentDefaults.setEnvironment(environment);
    }
}
