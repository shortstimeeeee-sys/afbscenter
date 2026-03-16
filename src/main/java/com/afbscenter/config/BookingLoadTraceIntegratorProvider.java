package com.afbscenter.config;

import org.hibernate.jpa.boot.spi.IntegratorProvider;

import java.util.Collections;
import java.util.List;

/**
 * Hibernate IntegratorProvider. Booking ID 단건 로드 추적용 Integrator를 등록.
 */
public class BookingLoadTraceIntegratorProvider implements IntegratorProvider {

    @Override
    public List<org.hibernate.integrator.spi.Integrator> getIntegrators() {
        return Collections.singletonList(new BookingLoadTraceIntegrator());
    }
}
