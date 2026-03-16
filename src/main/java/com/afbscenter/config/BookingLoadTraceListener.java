package com.afbscenter.config;

import com.afbscenter.model.Booking;
import org.hibernate.event.spi.PostLoadEvent;
import org.hibernate.event.spi.PostLoadEventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hibernate POST_LOAD 시 Booking 엔티티가 로드될 때마다 로그.
 * "bookings where id=?" N+1 원인 추적용. 로그 순서로 어느 시점에 단건 조회가 발생하는지 확인 가능.
 */
public class BookingLoadTraceListener implements PostLoadEventListener {

    private static final Logger log = LoggerFactory.getLogger("BOOKING_LOAD_TRACE");

    @Override
    public void onPostLoad(PostLoadEvent event) {
        Object entity = event.getEntity();
        if (entity == null) return;
        if (entity instanceof Booking) {
            Long id = ((Booking) entity).getId();
            log.warn("[BOOKING_LOAD] Booking loaded by id: bookingId={}, entityClass={}", id, entity.getClass().getSimpleName());
            if (log.isDebugEnabled()) {
                log.debug("[BOOKING_LOAD] stack trace for bookingId={}", id, new Throwable("Call stack"));
            }
        }
    }
}
