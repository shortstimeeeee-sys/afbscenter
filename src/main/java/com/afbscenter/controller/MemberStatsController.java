package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.MemberRepository;
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

    public MemberStatsController(MemberRepository memberRepository, BookingRepository bookingRepository) {
        this.memberRepository = memberRepository;
        this.bookingRepository = bookingRepository;
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
            Map<String, Object> stats = new HashMap<>();
            stats.put("total", total);
            stats.put("activeCount", activeCount);
            stats.put("byGrade", byGrade);
            stats.put("byStatus", byStatus);
            stats.put("nonMemberCount", nonMemberCount);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("회원 통계 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new HashMap<>());
        }
    }
}
