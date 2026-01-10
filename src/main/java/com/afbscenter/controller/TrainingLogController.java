package com.afbscenter.controller;

import com.afbscenter.model.TrainingLog;
import com.afbscenter.model.Member;
import com.afbscenter.repository.TrainingLogRepository;
import com.afbscenter.repository.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/training-logs")
@CrossOrigin(origins = "*")
public class TrainingLogController {

    private static final Logger logger = LoggerFactory.getLogger(TrainingLogController.class);

    @Autowired
    private TrainingLogRepository trainingLogRepository;

    @Autowired
    private MemberRepository memberRepository;

    @GetMapping
    public ResponseEntity<List<TrainingLog>> getAllTrainingLogs(
            @RequestParam(required = false) Long memberId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            List<TrainingLog> logs;
            
            if (memberId != null) {
                logs = trainingLogRepository.findByMemberId(memberId);
            } else if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                logs = trainingLogRepository.findByDateRange(start, end);
            } else {
                logs = trainingLogRepository.findAll();
            }
            
            // Member를 안전하게 로드
            logs.forEach(log -> {
                if (log.getMember() != null) {
                    try {
                        log.getMember().getName(); // Member 로드
                    } catch (Exception e) {
                        // 로드 오류는 무시
                    }
                }
            });
            
            return ResponseEntity.ok(logs);
        } catch (Exception e) {
            logger.error("훈련 기록 목록 조회 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<TrainingLog> getTrainingLogById(@PathVariable Long id) {
        try {
            return trainingLogRepository.findById(id)
                    .map(log -> {
                        // Member를 안전하게 로드
                        if (log.getMember() != null) {
                            try {
                                log.getMember().getName(); // Member 로드
                            } catch (Exception e) {
                                // 로드 오류는 무시
                            }
                        }
                        return ResponseEntity.ok(log);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("훈련 기록 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    public ResponseEntity<TrainingLog> createTrainingLog(@RequestBody TrainingLog trainingLog) {
        try {
            // 필수 필드 검증
            if (trainingLog.getMember() == null || trainingLog.getMember().getId() == null) {
                return ResponseEntity.badRequest().build();
            }
            
            if (trainingLog.getRecordDate() == null) {
                return ResponseEntity.badRequest().build();
            }
            
            if (trainingLog.getType() == null) {
                return ResponseEntity.badRequest().build();
            }
            
            if (trainingLog.getPart() == null) {
                return ResponseEntity.badRequest().build();
            }

            // Member 설정
            Member member = memberRepository.findById(trainingLog.getMember().getId())
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
            trainingLog.setMember(member);

            TrainingLog saved = trainingLogRepository.save(trainingLog);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("훈련 기록 생성 중 잘못된 인자: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("훈련 기록 생성 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<TrainingLog> updateTrainingLog(@PathVariable Long id, @RequestBody TrainingLog updatedLog) {
        try {
            TrainingLog log = trainingLogRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("훈련 기록을 찾을 수 없습니다."));

            // 필드 업데이트
            if (updatedLog.getRecordDate() != null) {
                log.setRecordDate(updatedLog.getRecordDate());
            }
            
            if (updatedLog.getType() != null) {
                log.setType(updatedLog.getType());
            }
            
            if (updatedLog.getPart() != null) {
                log.setPart(updatedLog.getPart());
            }
            
            // Member 업데이트
            if (updatedLog.getMember() != null && updatedLog.getMember().getId() != null) {
                Member member = memberRepository.findById(updatedLog.getMember().getId())
                        .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
                log.setMember(member);
            }
            
            // 타격 기록 업데이트
            if (updatedLog.getSwingCount() != null) {
                log.setSwingCount(updatedLog.getSwingCount());
            }
            if (updatedLog.getBallSpeed() != null) {
                log.setBallSpeed(updatedLog.getBallSpeed());
            }
            if (updatedLog.getLaunchAngle() != null) {
                log.setLaunchAngle(updatedLog.getLaunchAngle());
            }
            if (updatedLog.getHitDirection() != null) {
                log.setHitDirection(updatedLog.getHitDirection());
            }
            if (updatedLog.getContactRate() != null) {
                log.setContactRate(updatedLog.getContactRate());
            }
            
            // 투구 기록 업데이트
            if (updatedLog.getPitchSpeed() != null) {
                log.setPitchSpeed(updatedLog.getPitchSpeed());
            }
            if (updatedLog.getSpinRate() != null) {
                log.setSpinRate(updatedLog.getSpinRate());
            }
            if (updatedLog.getPitchType() != null) {
                log.setPitchType(updatedLog.getPitchType());
            }
            if (updatedLog.getStrikeRate() != null) {
                log.setStrikeRate(updatedLog.getStrikeRate());
            }
            
            // 체력 기록 업데이트
            if (updatedLog.getRunningDistance() != null) {
                log.setRunningDistance(updatedLog.getRunningDistance());
            }
            if (updatedLog.getWeightTraining() != null) {
                log.setWeightTraining(updatedLog.getWeightTraining());
            }
            if (updatedLog.getConditionScore() != null) {
                log.setConditionScore(updatedLog.getConditionScore());
            }
            
            // 메모 업데이트
            if (updatedLog.getNotes() != null) {
                log.setNotes(updatedLog.getNotes());
            }

            TrainingLog saved = trainingLogRepository.save(log);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            logger.warn("훈련 기록을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("훈련 기록 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTrainingLog(@PathVariable Long id) {
        try {
            if (!trainingLogRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            trainingLogRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            logger.error("훈련 기록 삭제 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
