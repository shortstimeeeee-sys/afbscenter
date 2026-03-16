package com.afbscenter.config;

import org.hibernate.boot.Metadata;
import org.hibernate.boot.spi.BootstrapContext;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.integrator.spi.Integrator;
import org.hibernate.service.spi.SessionFactoryServiceRegistry;

/**
 * Booking 엔티티가 ID로 로드될 때마다 로그를 남기는 리스너를 등록.
 * "bookings where id=?" N+1 추적용.
 */
public class BookingLoadTraceIntegrator implements Integrator {

    @Override
    public void integrate(Metadata metadata, BootstrapContext bootstrapContext, SessionFactoryImplementor sessionFactory) {
        SessionFactoryServiceRegistry registry = (SessionFactoryServiceRegistry) sessionFactory.getServiceRegistry();
        EventListenerRegistry eventListenerRegistry = registry.getService(EventListenerRegistry.class);
        eventListenerRegistry.getEventListenerGroup(EventType.POST_LOAD).appendListener(new BookingLoadTraceListener());
    }

    @Override
    public void disintegrate(SessionFactoryImplementor sessionFactory, SessionFactoryServiceRegistry serviceRegistry) {
        // no-op
    }
}
