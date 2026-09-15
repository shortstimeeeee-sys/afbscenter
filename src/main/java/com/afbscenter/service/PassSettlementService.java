package com.afbscenter.service;

import com.afbscenter.model.PassSettlement;
import com.afbscenter.repository.PassSettlementRepository;
import com.afbscenter.util.MemberBookingPassRules;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 매일 12:00 이용권 결산. 마감선 이전 예약은 홀드·빨간 표시에서 빼지만,
 * 잔여 횟수는 다시 계산하지 않는다. 차감 복구(+1)는 즉시 장부에 남고 결산이 다시 깎지 않는다.
 */
@Service
public class PassSettlementService {

    private static final Logger logger = LoggerFactory.getLogger(PassSettlementService.class);

    private final PassSettlementRepository passSettlementRepository;

    public PassSettlementService(PassSettlementRepository passSettlementRepository) {
        this.passSettlementRepository = passSettlementRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void catchUpOnStartup() {
        try {
            settleIfDue(MemberBookingPassRules.nowSeoul(), "startup");
        } catch (Exception e) {
            logger.warn("시작 시 이용권 결산 보정 실패: {}", e.getMessage());
        }
    }

    @Scheduled(cron = "0 0 12 * * *", zone = "Asia/Seoul")
    @Transactional
    public void settleAtNoon() {
        settleIfDue(MemberBookingPassRules.nowSeoul(), "scheduled-noon");
    }

    public boolean settleIfDue(LocalDateTime now, String reason) {
        LocalDateTime expected = MemberBookingPassRules.expectedSettledThrough(now);
        LocalDateTime last = passSettlementRepository.findTopByOrderBySettledThroughDesc()
                .map(PassSettlement::getSettledThrough)
                .orElse(null);
        if (last != null && !last.isBefore(expected)) {
            return false;
        }
        LocalDateTime cursor = last == null ? expected : last.plusDays(1);
        int saved = 0;
        while (!cursor.isAfter(expected)) {
            if (!passSettlementRepository.existsBySettledThrough(cursor)) {
                PassSettlement row = new PassSettlement();
                row.setSettledThrough(cursor);
                row.setSettledAt(now);
                row.setNote(reason);
                passSettlementRepository.save(row);
                saved++;
            }
            if (last == null) {
                break;
            }
            cursor = cursor.plusDays(1);
        }
        if (saved > 0) {
            logger.info("이용권 결산 마감 {}건 through={} reason={} (잔여는 변경하지 않음)",
                    saved, expected, reason);
        }
        return saved > 0;
    }
}
