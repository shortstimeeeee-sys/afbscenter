package com.afbscenter.controller;

import com.afbscenter.model.Member;
import com.afbscenter.model.TrainingLog;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.TrainingLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 훈련 기록 통계·랭킹 전용. URL은 기존과 동일: /api/training-logs/unregistered-count, /rankings
 */
@RestController
@RequestMapping("/api/training-logs")
public class TrainingLogStatsController {

    private static final Logger logger = LoggerFactory.getLogger(TrainingLogStatsController.class);

    private final TrainingLogRepository trainingLogRepository;
    private final MemberRepository memberRepository;

    public TrainingLogStatsController(TrainingLogRepository trainingLogRepository,
                                     MemberRepository memberRepository) {
        this.trainingLogRepository = trainingLogRepository;
        this.memberRepository = memberRepository;
    }

    @GetMapping("/unregistered-count")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getUnregisteredCount(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            if (startDate == null || startDate.isBlank() || endDate == null || endDate.isBlank()) {
                Map<String, Object> empty = new HashMap<>();
                empty.put("unregisteredCount", 0);
                return ResponseEntity.ok(empty);
            }
            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            List<Member> activeMembers = memberRepository.findAll().stream()
                    .filter(m -> m.getStatus() == Member.MemberStatus.ACTIVE)
                    .collect(Collectors.toList());
            java.util.Set<Long> activeIds = activeMembers.stream().map(Member::getId).collect(Collectors.toSet());
            List<TrainingLog> logsInRange = trainingLogRepository.findByDateRange(start, end);
            java.util.Set<Long> memberIdsWithLog = logsInRange.stream()
                    .map(t -> t.getMember() != null ? t.getMember().getId() : null)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            long unregistered = activeIds.stream().filter(id -> !memberIdsWithLog.contains(id)).count();
            Map<String, Object> result = new HashMap<>();
            result.put("unregisteredCount", unregistered);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("미등록 기록자 수 조회 실패: {}", e.getMessage(), e);
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("unregisteredCount", 0);
            return ResponseEntity.ok(fallback);
        }
    }

    @GetMapping("/rankings")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getRankings(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false) String grade) {
        try {
            LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
            LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusDays(days - 1);

            logger.info("랭킹 조회 요청: startDate={}, endDate={}, days={}, grade={}", start, end, days, grade);

            List<TrainingLog> logs = trainingLogRepository.findByDateRange(start, end);
            logger.info("조회된 훈련 기록 수: {}", logs.size());

            if (grade != null && !grade.isEmpty() && !grade.equals("ALL")) {
                Member.MemberGrade filterGrade = Member.MemberGrade.valueOf(grade);
                logs = logs.stream()
                        .filter(log -> log.getMember() != null && log.getMember().getGrade() == filterGrade)
                        .collect(Collectors.toList());
                logger.info("등급 필터링 후 훈련 기록 수: {}", logs.size());
            }

            Map<Long, Map<String, Object>> memberStats = new HashMap<>();

            for (TrainingLog log : logs) {
                if (log.getMember() == null) continue;

                Long memberId = log.getMember().getId();
                Map<String, Object> stats = memberStats.computeIfAbsent(memberId, k -> {
                    Map<String, Object> newStats = new HashMap<>();
                    newStats.put("memberId", memberId);
                    newStats.put("memberName", log.getMember().getName());
                    newStats.put("memberNumber", log.getMember().getMemberNumber());
                    newStats.put("memberGrade", log.getMember().getGrade() != null ? log.getMember().getGrade().name() : "SOCIAL");
                    newStats.put("totalRecords", 0);
                    newStats.put("swingSpeedMax", 0.0);
                    newStats.put("swingSpeedAvg", 0.0);
                    newStats.put("swingSpeedCount", 0);
                    newStats.put("swingSpeedSum", 0.0);
                    newStats.put("ballSpeedMax", 0.0);
                    newStats.put("ballSpeedAvg", 0.0);
                    newStats.put("ballSpeedCount", 0);
                    newStats.put("ballSpeedSum", 0.0);
                    newStats.put("pitchSpeedMax", 0.0);
                    newStats.put("pitchSpeedAvg", 0.0);
                    newStats.put("pitchSpeedCount", 0);
                    newStats.put("pitchSpeedSum", 0.0);
                    newStats.put("contactRateMax", 0.0);
                    newStats.put("contactRateAvg", 0.0);
                    newStats.put("contactRateCount", 0);
                    newStats.put("contactRateSum", 0.0);
                    newStats.put("strikeRateMax", 0.0);
                    newStats.put("strikeRateAvg", 0.0);
                    newStats.put("strikeRateCount", 0);
                    newStats.put("strikeRateSum", 0.0);
                    return newStats;
                });

                stats.put("totalRecords", (Integer) stats.get("totalRecords") + 1);

                if (log.getSwingSpeed() != null && log.getSwingSpeed() > 0) {
                    double currentMax = (Double) stats.get("swingSpeedMax");
                    stats.put("swingSpeedMax", Math.max(currentMax, log.getSwingSpeed()));
                    stats.put("swingSpeedSum", (Double) stats.get("swingSpeedSum") + log.getSwingSpeed());
                    stats.put("swingSpeedCount", (Integer) stats.get("swingSpeedCount") + 1);
                }

                if (log.getBallSpeed() != null && log.getBallSpeed() > 0) {
                    double currentMax = (Double) stats.get("ballSpeedMax");
                    stats.put("ballSpeedMax", Math.max(currentMax, log.getBallSpeed()));
                    stats.put("ballSpeedSum", (Double) stats.get("ballSpeedSum") + log.getBallSpeed());
                    stats.put("ballSpeedCount", (Integer) stats.get("ballSpeedCount") + 1);
                }

                if (log.getPitchSpeed() != null && log.getPitchSpeed() > 0) {
                    double currentMax = (Double) stats.get("pitchSpeedMax");
                    stats.put("pitchSpeedMax", Math.max(currentMax, log.getPitchSpeed()));
                    stats.put("pitchSpeedSum", (Double) stats.get("pitchSpeedSum") + log.getPitchSpeed());
                    stats.put("pitchSpeedCount", (Integer) stats.get("pitchSpeedCount") + 1);
                }

                if (log.getContactRate() != null && log.getContactRate() > 0) {
                    double currentMax = (Double) stats.get("contactRateMax");
                    stats.put("contactRateMax", Math.max(currentMax, log.getContactRate()));
                    stats.put("contactRateSum", (Double) stats.get("contactRateSum") + log.getContactRate());
                    stats.put("contactRateCount", (Integer) stats.get("contactRateCount") + 1);
                }

                if (log.getStrikeRate() != null && log.getStrikeRate() > 0) {
                    double currentMax = (Double) stats.get("strikeRateMax");
                    stats.put("strikeRateMax", Math.max(currentMax, log.getStrikeRate()));
                    stats.put("strikeRateSum", (Double) stats.get("strikeRateSum") + log.getStrikeRate());
                    stats.put("strikeRateCount", (Integer) stats.get("strikeRateCount") + 1);
                }
            }

            for (Map<String, Object> stats : memberStats.values()) {
                int swingSpeedCount = (Integer) stats.get("swingSpeedCount");
                if (swingSpeedCount > 0) {
                    stats.put("swingSpeedAvg", (Double) stats.get("swingSpeedSum") / swingSpeedCount);
                }

                int ballSpeedCount = (Integer) stats.get("ballSpeedCount");
                if (ballSpeedCount > 0) {
                    stats.put("ballSpeedAvg", (Double) stats.get("ballSpeedSum") / ballSpeedCount);
                }

                int pitchSpeedCount = (Integer) stats.get("pitchSpeedCount");
                if (pitchSpeedCount > 0) {
                    stats.put("pitchSpeedAvg", (Double) stats.get("pitchSpeedSum") / pitchSpeedCount);
                }

                int contactRateCount = (Integer) stats.get("contactRateCount");
                if (contactRateCount > 0) {
                    stats.put("contactRateAvg", (Double) stats.get("contactRateSum") / contactRateCount);
                }

                int strikeRateCount = (Integer) stats.get("strikeRateCount");
                if (strikeRateCount > 0) {
                    stats.put("strikeRateAvg", (Double) stats.get("strikeRateSum") / strikeRateCount);
                }
            }

            List<Map<String, Object>> statsList = new ArrayList<>(memberStats.values());
            logger.info("통계 계산 완료: 회원 수={}", statsList.size());

            Map<String, Object> result = new HashMap<>();
            result.put("period", Map.of("start", start.toString(), "end", end.toString(), "days", days));
            result.put("totalMembers", statsList.size());
            result.put("filterGrade", grade != null ? grade : "ALL");

            List<Map<String, Object>> swingSpeedRanking = statsList.stream()
                    .filter(s -> (Double) s.get("swingSpeedMax") > 0)
                    .sorted((a, b) -> Double.compare((Double) b.get("swingSpeedMax"), (Double) a.get("swingSpeedMax")))
                    .collect(Collectors.toList());
            logger.info("스윙속도 랭킹: {}명", swingSpeedRanking.size());
            result.put("swingSpeedRanking", swingSpeedRanking);

            List<Map<String, Object>> ballSpeedRanking = statsList.stream()
                    .filter(s -> (Double) s.get("ballSpeedMax") > 0)
                    .sorted((a, b) -> Double.compare((Double) b.get("ballSpeedMax"), (Double) a.get("ballSpeedMax")))
                    .collect(Collectors.toList());
            logger.info("타구속도 랭킹: {}명", ballSpeedRanking.size());
            result.put("ballSpeedRanking", ballSpeedRanking);

            List<Map<String, Object>> pitchSpeedRanking = statsList.stream()
                    .filter(s -> (Double) s.get("pitchSpeedMax") > 0)
                    .sorted((a, b) -> Double.compare((Double) b.get("pitchSpeedMax"), (Double) a.get("pitchSpeedMax")))
                    .collect(Collectors.toList());
            logger.info("구속 랭킹: {}명", pitchSpeedRanking.size());
            result.put("pitchSpeedRanking", pitchSpeedRanking);

            List<Map<String, Object>> contactRateRanking = statsList.stream()
                    .filter(s -> (Double) s.get("contactRateMax") > 0)
                    .sorted((a, b) -> Double.compare((Double) b.get("contactRateMax"), (Double) a.get("contactRateMax")))
                    .collect(Collectors.toList());
            result.put("contactRateRanking", contactRateRanking);

            List<Map<String, Object>> strikeRateRanking = statsList.stream()
                    .filter(s -> (Double) s.get("strikeRateMax") > 0)
                    .sorted((a, b) -> Double.compare((Double) b.get("strikeRateMax"), (Double) a.get("strikeRateMax")))
                    .collect(Collectors.toList());
            result.put("strikeRateRanking", strikeRateRanking);

            List<Map<String, Object>> recordCountRanking = statsList.stream()
                    .filter(s -> (Integer) s.get("totalRecords") > 0)
                    .sorted((a, b) -> Integer.compare((Integer) b.get("totalRecords"), (Integer) a.get("totalRecords")))
                    .collect(Collectors.toList());
            logger.info("훈련 횟수 랭킹: {}명", recordCountRanking.size());
            result.put("recordCountRanking", recordCountRanking);

            logger.info("랭킹 조회 완료: 타구속도={}, 구속={}, 훈련횟수={}",
                    ballSpeedRanking.size(), pitchSpeedRanking.size(), recordCountRanking.size());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("랭킹 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
