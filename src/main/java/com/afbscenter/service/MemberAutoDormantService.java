package com.afbscenter.service;

import com.afbscenter.model.ActionAuditLog;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.ActionAuditLogRepository;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 보유 이용권이 모두 소진(또는 만료)되고 2개월 이상 방문이 없으면 활성 회원을 휴면 처리.
 */
@Service
public class MemberAutoDormantService {

    private static final Logger logger = LoggerFactory.getLogger(MemberAutoDormantService.class);
    private static final int DORMANT_AFTER_MONTHS = 2;
    private static final String HISTORY_NOTE = "이용권 전량 소진 후 2개월 이상 미방문 · 자동 휴면";

    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberEndedGraceService memberEndedGraceService;
    private final ActionAuditLogRepository actionAuditLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MemberAutoDormantService(MemberRepository memberRepository,
                                    MemberProductRepository memberProductRepository,
                                    AttendanceRepository attendanceRepository,
                                    MemberEndedGraceService memberEndedGraceService,
                                    ActionAuditLogRepository actionAuditLogRepository) {
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberEndedGraceService = memberEndedGraceService;
        this.actionAuditLogRepository = actionAuditLogRepository;
    }

    @Scheduled(initialDelay = 120000, fixedDelay = 3600000)
    @Transactional
    public void autoDormantEligibleMembers() {
        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.minusMonths(DORMANT_AFTER_MONTHS);
        List<Member> candidates;
        try {
            candidates = memberRepository.findActiveMembersUnvisitedSince(cutoff);
        } catch (Exception e) {
            logger.warn("자동 휴면 후보 조회 실패: {}", e.getMessage());
            return;
        }
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        int changed = 0;
        for (Member member : candidates) {
            try {
                if (member.getStatus() != Member.MemberStatus.ACTIVE) {
                    continue;
                }
                LocalDate lastVisit = resolveLastVisitDate(member);
                if (lastVisit != null && lastVisit.isAfter(cutoff)) {
                    continue;
                }
                List<MemberProduct> products = memberProductRepository.findByMemberIdWithProduct(member.getId());
                if (products == null || products.isEmpty()) {
                    continue;
                }
                if (hasAnyUsablePass(member, products)) {
                    continue;
                }
                member.setStatus(Member.MemberStatus.INACTIVE);
                memberRepository.save(member);
                changed++;
                logger.info("자동 휴면: memberId={}, name={}, lastVisit={}",
                        member.getId(), member.getName(), lastVisit);
            } catch (Exception e) {
                logger.warn("자동 휴면 실패 memberId={}: {}", member.getId(), e.getMessage());
            }
        }
        if (changed > 0) {
            logger.info("자동 휴면 처리 {}명", changed);
            try {
                actionAuditLogRepository.save(ActionAuditLog.of(
                        "시스템", "AUTO_DORMANT_MEMBERS",
                        "{\"count\":" + changed + ",\"note\":\"" + HISTORY_NOTE + "\"}"));
            } catch (Exception e) {
                logger.warn("자동 휴면 감사 로그 저장 실패: {}", e.getMessage());
            }
        }
    }

    private LocalDate resolveLastVisitDate(Member member) {
        LocalDate lastVisit = member.getLastVisitDate();
        try {
            LocalDate fromAttendance = attendanceRepository.findLatestCheckedInDateByMemberId(member.getId());
            if (fromAttendance != null && (lastVisit == null || fromAttendance.isAfter(lastVisit))) {
                lastVisit = fromAttendance;
            }
        } catch (Exception e) {
            logger.debug("최근 출석일 조회 스킵 memberId={}: {}", member.getId(), e.getMessage());
        }
        if (lastVisit == null) {
            lastVisit = member.getJoinDate();
        }
        return lastVisit;
    }

    private boolean hasAnyUsablePass(Member member, List<MemberProduct> products) {
        LocalDate today = LocalDate.now();
        for (MemberProduct mp : products) {
            if (isPassStillUsable(member, mp, today)) {
                return true;
            }
        }
        return false;
    }

    private boolean isPassStillUsable(Member member, MemberProduct mp, LocalDate today) {
        if (mp == null) {
            return false;
        }
        if (mp.getStatus() == MemberProduct.Status.USED_UP || mp.getStatus() == MemberProduct.Status.EXPIRED) {
            return false;
        }
        if (mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) {
            return false;
        }
        int pkgSum = packageRemainingSum(mp);
        if (pkgSum > 0) {
            return true;
        }
        Product product = null;
        try {
            product = mp.getProduct();
        } catch (Exception ignored) {
        }
        Product.ProductType type = product != null ? product.getType() : null;
        if (type == Product.ProductType.COUNT_PASS) {
            return !memberEndedGraceService.isActiveCountPassExhausted(member, mp)
                    && (mp.getRemainingCount() == null || mp.getRemainingCount() > 0);
        }
        if (mp.getRemainingCount() != null) {
            return mp.getRemainingCount() > 0;
        }
        return mp.getStatus() == MemberProduct.Status.ACTIVE;
    }

    private int packageRemainingSum(MemberProduct mp) {
        String json = mp.getPackageItemsRemaining();
        if (json == null || json.isBlank()) {
            return -1;
        }
        try {
            List<Map<String, Object>> items = objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
            if (items == null || items.isEmpty()) {
                return -1;
            }
            int sum = 0;
            for (Map<String, Object> item : items) {
                Object rem = item.get("remaining");
                if (rem instanceof Number) {
                    sum += ((Number) rem).intValue();
                }
            }
            return sum;
        } catch (Exception e) {
            return -1;
        }
    }
}
