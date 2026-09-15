package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.service.MemberEndedGraceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * 회원 기본 통계 API (총 회원 수, 등급별·상태별 집계).
 * URL은 기존과 동일: GET /api/members/stats
 */
@RestController
@RequestMapping("/api/members")
public class MemberStatsController {

    private static final Logger logger = LoggerFactory.getLogger(MemberStatsController.class);

    private final MemberRepository memberRepository;
    private final BookingRepository bookingRepository;
    private final MemberProductRepository memberProductRepository;
    private final MemberEndedGraceService memberEndedGraceService;

    public MemberStatsController(MemberRepository memberRepository,
                                 BookingRepository bookingRepository,
                                 MemberProductRepository memberProductRepository,
                                 MemberEndedGraceService memberEndedGraceService) {
        this.memberRepository = memberRepository;
        this.bookingRepository = bookingRepository;
        this.memberProductRepository = memberProductRepository;
        this.memberEndedGraceService = memberEndedGraceService;
    }

    /** 회원 기본 통계 (총 회원 수, 등급별·상태별 집계) */
    @GetMapping("/stats")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMemberStats() {
        try {
            long total = memberRepository.count();
            long activeCount = memberRepository.countByStatus(Member.MemberStatus.ACTIVE);
            Map<String, Long> byGrade = new HashMap<>();
            for (Member.MemberGrade g : Member.MemberGrade.values()) {
                byGrade.put(g.name(), memberRepository.countByGrade(g));
            }
            Map<String, Long> byStatus = new HashMap<>();
            for (Member.MemberStatus s : Member.MemberStatus.values()) {
                byStatus.put(s.name(), memberRepository.countByStatus(s));
            }
            long nonMemberCount = bookingRepository.countByMemberIsNull();
            // 이용권 종료: 잔여가 남은 이용권이 있으면 제외, 횟수 0·만료만
            long endedTicketMemberCount = 0L;
            for (Member m : memberRepository.findAll()) {
                if (m.getStatus() != Member.MemberStatus.ACTIVE) {
                    continue;
                }
                java.util.List<MemberProduct> products = memberProductRepository.findByMemberIdWithProduct(m.getId());
                if (memberEndedGraceService.memberQualifiesAsEndedTicket(m, products)) {
                    endedTicketMemberCount++;
                }
            }

            java.util.Set<Long> unspecifiedIds = new java.util.HashSet<>(
                    memberProductRepository.findActiveMemberIdsUnspecifiedDueToResignedCoach());
            unspecifiedIds.addAll(memberRepository.findActiveMemberIdsUnspecifiedDueToResignedMemberCoach());
            long unspecifiedCoachCount = unspecifiedIds.size();

            Map<String, Object> stats = new HashMap<>();
            stats.put("total", total);
            stats.put("activeCount", activeCount);
            stats.put("byGrade", byGrade);
            stats.put("byStatus", byStatus);
            stats.put("nonMemberCount", nonMemberCount);
            stats.put("endedTicketMemberCount", endedTicketMemberCount);
            stats.put("unspecifiedCoachCount", unspecifiedCoachCount);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("회원 통계 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new HashMap<>());
        }
    }
}
