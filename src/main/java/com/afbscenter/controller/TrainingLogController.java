package com.afbscenter.controller;

import com.afbscenter.model.TrainingLog;
import com.afbscenter.model.Member;
import com.afbscenter.repository.TrainingLogRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.service.MemberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/training-logs")
public class TrainingLogController {

    private static final Logger logger = LoggerFactory.getLogger(TrainingLogController.class);

    private final TrainingLogRepository trainingLogRepository;
    private final MemberRepository memberRepository;
    private final MemberService memberService;

    public TrainingLogController(TrainingLogRepository trainingLogRepository,
                                 MemberRepository memberRepository,
                                 MemberService memberService) {
        this.trainingLogRepository = trainingLogRepository;
        this.memberRepository = memberRepository;
        this.memberService = memberService;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<java.util.Map<String, Object>>> getAllTrainingLogs(
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
                // JOIN FETCH를 사용하여 Member를 미리 로드
                logs = trainingLogRepository.findAllWithMember();
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
            for (TrainingLog log : logs) {
                try {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", log.getId());
                    map.put("recordDate", log.getRecordDate());
                    map.put("type", log.getType() != null ? log.getType().name() : null);
                    map.put("part", log.getPart() != null ? log.getPart().name() : null);
                    
                    // 타격 기록
                    map.put("swingSpeed", log.getSwingSpeed());
                    map.put("swingCount", log.getSwingCount());
                    map.put("ballSpeed", log.getBallSpeed());
                    map.put("launchAngle", log.getLaunchAngle());
                    map.put("hitDirection", log.getHitDirection());
                    map.put("contactRate", log.getContactRate());
                    
                    // 투구 기록
                    map.put("pitchSpeed", log.getPitchSpeed());
                    map.put("spinRate", log.getSpinRate());
                    map.put("pitchType", log.getPitchType());
                    map.put("strikeRate", log.getStrikeRate());
                    
                    // 체력 기록
                    map.put("runningDistance", log.getRunningDistance());
                    map.put("weightTraining", log.getWeightTraining());
                    map.put("conditionScore", log.getConditionScore());
                    
                    // 메모
                    map.put("notes", log.getNotes());
                    map.put("createdAt", log.getCreatedAt());
                    
                    // Member 정보
                    if (log.getMember() != null) {
                        java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                        memberMap.put("id", log.getMember().getId());
                        memberMap.put("name", log.getMember().getName());
                        memberMap.put("memberNumber", log.getMember().getMemberNumber());
                        map.put("member", memberMap);
                    } else {
                        map.put("member", null);
                    }
                    
                    result.add(map);
                } catch (Exception e) {
                    logger.warn("훈련 기록 변환 실패 (TrainingLog ID: {}): {}", log.getId(), e.getMessage());
                    // 해당 항목만 건너뛰고 계속 진행
                }
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("훈련 기록 목록 조회 중 오류 발생: {}", e.getMessage(), e);
            // 오류 발생 시 빈 리스트 반환 (서비스 중단 방지)
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<java.util.Map<String, Object>> getTrainingLogById(@PathVariable Long id) {
        try {
            TrainingLog log = trainingLogRepository.findById(id)
                    .orElse(null);
            
            if (log == null) {
                return ResponseEntity.notFound().build();
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", log.getId());
            map.put("recordDate", log.getRecordDate());
            map.put("type", log.getType() != null ? log.getType().name() : null);
            map.put("part", log.getPart() != null ? log.getPart().name() : null);
            
            // 타격 기록
            map.put("swingSpeed", log.getSwingSpeed());
            map.put("swingCount", log.getSwingCount());
            map.put("ballSpeed", log.getBallSpeed());
            map.put("launchAngle", log.getLaunchAngle());
            map.put("hitDirection", log.getHitDirection());
            map.put("contactRate", log.getContactRate());
            
            // 투구 기록
            map.put("pitchSpeed", log.getPitchSpeed());
            map.put("spinRate", log.getSpinRate());
            map.put("pitchType", log.getPitchType());
            map.put("strikeRate", log.getStrikeRate());
            
            // 체력 기록
            map.put("runningDistance", log.getRunningDistance());
            map.put("weightTraining", log.getWeightTraining());
            map.put("conditionScore", log.getConditionScore());
            
            // 메모
            map.put("notes", log.getNotes());
            map.put("createdAt", log.getCreatedAt());
            
            // Member 정보
            if (log.getMember() != null) {
                try {
                    java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                    memberMap.put("id", log.getMember().getId());
                    memberMap.put("name", log.getMember().getName());
                    memberMap.put("memberNumber", log.getMember().getMemberNumber());
                    map.put("member", memberMap);
                } catch (Exception e) {
                    logger.warn("Member 로드 실패: TrainingLog ID={}", id, e);
                    map.put("member", null);
                }
            } else {
                map.put("member", null);
            }
            
            return ResponseEntity.ok(map);
        } catch (Exception e) {
            logger.error("훈련 기록 조회 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> createTrainingLog(@RequestBody java.util.Map<String, Object> data) {
        try {
            // Member ID 추출
            Long memberId = null;
            if (data.get("member") != null) {
                Object memberObj = data.get("member");
                if (memberObj instanceof java.util.Map) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> memberMap = (java.util.Map<String, Object>) memberObj;
                    Object idObj = memberMap.get("id");
                    if (idObj instanceof Number) {
                        memberId = ((Number) idObj).longValue();
                    } else if (idObj != null) {
                        memberId = Long.parseLong(idObj.toString());
                    }
                } else if (memberObj instanceof Number) {
                    memberId = ((Number) memberObj).longValue();
                }
            }
            
            if (memberId == null) {
                logger.warn("훈련 기록 생성: 회원 ID가 없습니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // Member 조회
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
            
            // TrainingLog 생성
            TrainingLog trainingLog = new TrainingLog();
            trainingLog.setMember(member);
            
            // 날짜 설정
            if (data.get("recordDate") != null) {
                String dateStr = data.get("recordDate").toString();
                trainingLog.setRecordDate(LocalDate.parse(dateStr));
            } else {
                logger.warn("훈련 기록 생성: 날짜가 없습니다.");
                return ResponseEntity.badRequest().build();
            }
            
            // Type 설정 (enum 변환)
            if (data.get("type") != null) {
                try {
                    String typeStr = data.get("type").toString();
                    trainingLog.setType(TrainingLog.TrainingType.valueOf(typeStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("훈련 기록 생성: 잘못된 타입: {}", data.get("type"));
                    // 기본값으로 설정
                    trainingLog.setType(TrainingLog.TrainingType.BATTING);
                }
            } else {
                // 기본값으로 설정
                trainingLog.setType(TrainingLog.TrainingType.BATTING);
            }
            
            // Part 설정 (enum 변환)
            if (data.get("part") != null) {
                try {
                    String partStr = data.get("part").toString();
                    trainingLog.setPart(TrainingLog.TrainingPart.valueOf(partStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("훈련 기록 생성: 잘못된 파트: {}", data.get("part"));
                    // 기본값으로 설정
                    trainingLog.setPart(TrainingLog.TrainingPart.BASEBALL_BATTING);
                }
            } else {
                // 기본값으로 설정
                trainingLog.setPart(TrainingLog.TrainingPart.BASEBALL_BATTING);
            }
            
            // 타격 기록
            if (data.get("swingSpeed") != null) {
                try {
                    Object swingSpeedObj = data.get("swingSpeed");
                    if (swingSpeedObj instanceof Number) {
                        trainingLog.setSwingSpeed(((Number) swingSpeedObj).doubleValue());
                    } else if (swingSpeedObj instanceof String && !((String) swingSpeedObj).trim().isEmpty()) {
                        trainingLog.setSwingSpeed(Double.parseDouble((String) swingSpeedObj));
                    }
                } catch (Exception e) {
                    logger.warn("swingSpeed 파싱 실패: {}", data.get("swingSpeed"), e);
                }
            }
            if (data.get("swingCount") != null) {
                try {
                    Object swingCountObj = data.get("swingCount");
                    if (swingCountObj instanceof Number) {
                        trainingLog.setSwingCount(((Number) swingCountObj).intValue());
                    } else if (swingCountObj instanceof String && !((String) swingCountObj).trim().isEmpty()) {
                        trainingLog.setSwingCount(Integer.parseInt((String) swingCountObj));
                    }
                } catch (Exception e) {
                    logger.warn("swingCount 파싱 실패: {}", data.get("swingCount"), e);
                }
            }
            if (data.get("ballSpeed") != null) {
                try {
                    Object ballSpeedObj = data.get("ballSpeed");
                    if (ballSpeedObj instanceof Number) {
                        trainingLog.setBallSpeed(((Number) ballSpeedObj).doubleValue());
                    } else if (ballSpeedObj instanceof String && !((String) ballSpeedObj).trim().isEmpty()) {
                        trainingLog.setBallSpeed(Double.parseDouble((String) ballSpeedObj));
                    }
                } catch (Exception e) {
                    logger.warn("ballSpeed 파싱 실패: {}", data.get("ballSpeed"), e);
                }
            }
            if (data.get("launchAngle") != null) {
                try {
                    Object launchAngleObj = data.get("launchAngle");
                    if (launchAngleObj instanceof Number) {
                        trainingLog.setLaunchAngle(((Number) launchAngleObj).doubleValue());
                    } else if (launchAngleObj instanceof String && !((String) launchAngleObj).trim().isEmpty()) {
                        trainingLog.setLaunchAngle(Double.parseDouble((String) launchAngleObj));
                    }
                } catch (Exception e) {
                    logger.warn("launchAngle 파싱 실패: {}", data.get("launchAngle"), e);
                }
            }
            if (data.get("hitDirection") != null) {
                String hitDirection = data.get("hitDirection").toString();
                if (!hitDirection.trim().isEmpty()) {
                    trainingLog.setHitDirection(hitDirection);
                }
            }
            if (data.get("contactRate") != null) {
                try {
                    Object contactRateObj = data.get("contactRate");
                    if (contactRateObj instanceof Number) {
                        trainingLog.setContactRate(((Number) contactRateObj).doubleValue());
                    } else if (contactRateObj instanceof String && !((String) contactRateObj).trim().isEmpty()) {
                        trainingLog.setContactRate(Double.parseDouble((String) contactRateObj));
                    }
                } catch (Exception e) {
                    logger.warn("contactRate 파싱 실패: {}", data.get("contactRate"), e);
                }
            }
            
            // 투구 기록
            if (data.get("pitchSpeed") != null) {
                try {
                    Object pitchSpeedObj = data.get("pitchSpeed");
                    if (pitchSpeedObj instanceof Number) {
                        trainingLog.setPitchSpeed(((Number) pitchSpeedObj).doubleValue());
                    } else if (pitchSpeedObj instanceof String && !((String) pitchSpeedObj).trim().isEmpty()) {
                        trainingLog.setPitchSpeed(Double.parseDouble((String) pitchSpeedObj));
                    }
                } catch (Exception e) {
                    logger.warn("pitchSpeed 파싱 실패: {}", data.get("pitchSpeed"), e);
                }
            }
            if (data.get("spinRate") != null) {
                try {
                    Object spinRateObj = data.get("spinRate");
                    if (spinRateObj instanceof Number) {
                        trainingLog.setSpinRate(((Number) spinRateObj).intValue());
                    } else if (spinRateObj instanceof String && !((String) spinRateObj).trim().isEmpty()) {
                        trainingLog.setSpinRate(Integer.parseInt((String) spinRateObj));
                    }
                } catch (Exception e) {
                    logger.warn("spinRate 파싱 실패: {}", data.get("spinRate"), e);
                }
            }
            if (data.get("pitchType") != null) {
                String pitchType = data.get("pitchType").toString();
                if (!pitchType.trim().isEmpty()) {
                    trainingLog.setPitchType(pitchType);
                }
            }
            if (data.get("strikeRate") != null) {
                try {
                    Object strikeRateObj = data.get("strikeRate");
                    if (strikeRateObj instanceof Number) {
                        trainingLog.setStrikeRate(((Number) strikeRateObj).doubleValue());
                    } else if (strikeRateObj instanceof String && !((String) strikeRateObj).trim().isEmpty()) {
                        trainingLog.setStrikeRate(Double.parseDouble((String) strikeRateObj));
                    }
                } catch (Exception e) {
                    logger.warn("strikeRate 파싱 실패: {}", data.get("strikeRate"), e);
                }
            }
            
            // 체력 기록
            if (data.get("runningDistance") != null) {
                try {
                    Object runningDistanceObj = data.get("runningDistance");
                    if (runningDistanceObj instanceof Number) {
                        trainingLog.setRunningDistance(((Number) runningDistanceObj).doubleValue());
                    } else if (runningDistanceObj instanceof String && !((String) runningDistanceObj).trim().isEmpty()) {
                        trainingLog.setRunningDistance(Double.parseDouble((String) runningDistanceObj));
                    }
                } catch (Exception e) {
                    logger.warn("runningDistance 파싱 실패: {}", data.get("runningDistance"), e);
                }
            }
            if (data.get("weightTraining") != null) {
                String weightTraining = data.get("weightTraining").toString();
                if (!weightTraining.trim().isEmpty()) {
                    trainingLog.setWeightTraining(weightTraining);
                }
            }
            // conditionScore는 문자열일 수 있으므로 처리
            if (data.get("conditionScore") != null) {
                Object conditionObj = data.get("conditionScore");
                if (conditionObj instanceof Number) {
                    trainingLog.setConditionScore(((Number) conditionObj).intValue());
                } else if (conditionObj instanceof String) {
                    // 문자열인 경우 (예: "EXCELLENT", "GOOD") 무시
                    // 숫자 문자열인 경우만 처리
                    try {
                        trainingLog.setConditionScore(Integer.parseInt((String) conditionObj));
                    } catch (NumberFormatException e) {
                        // 숫자가 아닌 문자열은 무시
                    }
                }
            }
            
            // 메모
            if (data.get("notes") != null) {
                String notes = data.get("notes").toString();
                if (!notes.trim().isEmpty()) {
                    trainingLog.setNotes(notes);
                }
            }

            TrainingLog saved = trainingLogRepository.save(trainingLog);
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("recordDate", saved.getRecordDate());
            result.put("type", saved.getType() != null ? saved.getType().name() : null);
            result.put("part", saved.getPart() != null ? saved.getPart().name() : null);
            result.put("swingSpeed", saved.getSwingSpeed());
            result.put("swingCount", saved.getSwingCount());
            result.put("ballSpeed", saved.getBallSpeed());
            result.put("launchAngle", saved.getLaunchAngle());
            result.put("hitDirection", saved.getHitDirection());
            result.put("contactRate", saved.getContactRate());
            result.put("pitchSpeed", saved.getPitchSpeed());
            result.put("spinRate", saved.getSpinRate());
            result.put("pitchType", saved.getPitchType());
            result.put("strikeRate", saved.getStrikeRate());
            result.put("runningDistance", saved.getRunningDistance());
            result.put("weightTraining", saved.getWeightTraining());
            result.put("conditionScore", saved.getConditionScore());
            result.put("notes", saved.getNotes());
            result.put("createdAt", saved.getCreatedAt());
            
            // Member 정보
            if (saved.getMember() != null) {
                try {
                    java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                    memberMap.put("id", saved.getMember().getId());
                    memberMap.put("name", saved.getMember().getName());
                    memberMap.put("memberNumber", saved.getMember().getMemberNumber());
                    result.put("member", memberMap);
                } catch (Exception e) {
                    logger.warn("Member 로드 실패: TrainingLog ID={}", saved.getId(), e);
                    result.put("member", null);
                }
            } else {
                result.put("member", null);
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException e) {
            logger.warn("훈련 기록 생성 중 잘못된 인자: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("훈련 기록 생성 중 오류 발생", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<java.util.Map<String, Object>> updateTrainingLog(@PathVariable Long id, @RequestBody java.util.Map<String, Object> data) {
        try {
            TrainingLog log = trainingLogRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("훈련 기록을 찾을 수 없습니다."));

            // 날짜 업데이트
            if (data.get("recordDate") != null) {
                String dateStr = data.get("recordDate").toString();
                log.setRecordDate(LocalDate.parse(dateStr));
            }
            
            // Type 업데이트 (enum 변환)
            if (data.get("type") != null) {
                try {
                    String typeStr = data.get("type").toString();
                    log.setType(TrainingLog.TrainingType.valueOf(typeStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("훈련 기록 수정: 잘못된 타입: {}", data.get("type"));
                }
            }
            
            // Part 업데이트 (enum 변환)
            if (data.get("part") != null) {
                try {
                    String partStr = data.get("part").toString();
                    log.setPart(TrainingLog.TrainingPart.valueOf(partStr));
                } catch (IllegalArgumentException e) {
                    logger.warn("훈련 기록 수정: 잘못된 파트: {}", data.get("part"));
                }
            }
            
            // Member 업데이트
            if (data.get("member") != null) {
                Object memberObj = data.get("member");
                Long memberId = null;
                if (memberObj instanceof java.util.Map) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> memberMap = (java.util.Map<String, Object>) memberObj;
                    Object idObj = memberMap.get("id");
                    if (idObj instanceof Number) {
                        memberId = ((Number) idObj).longValue();
                    } else if (idObj != null) {
                        memberId = Long.parseLong(idObj.toString());
                    }
                } else if (memberObj instanceof Number) {
                    memberId = ((Number) memberObj).longValue();
                }
                
                if (memberId != null) {
                    Member member = memberRepository.findById(memberId)
                            .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
                    log.setMember(member);
                }
            }
            
            // 타격 기록 업데이트
            if (data.get("swingSpeed") != null) {
                try {
                    Object swingSpeedObj = data.get("swingSpeed");
                    if (swingSpeedObj instanceof Number) {
                        log.setSwingSpeed(((Number) swingSpeedObj).doubleValue());
                    } else if (swingSpeedObj instanceof String && !((String) swingSpeedObj).trim().isEmpty()) {
                        log.setSwingSpeed(Double.parseDouble((String) swingSpeedObj));
                    }
                } catch (Exception e) {
                    logger.warn("swingSpeed 업데이트 실패: {}", data.get("swingSpeed"), e);
                }
            } else {
                // null이 명시적으로 전달되면 null로 설정
                log.setSwingSpeed(null);
            }
            if (data.get("swingCount") != null) {
                try {
                    Object swingCountObj = data.get("swingCount");
                    if (swingCountObj instanceof Number) {
                        log.setSwingCount(((Number) swingCountObj).intValue());
                    } else if (swingCountObj instanceof String && !((String) swingCountObj).trim().isEmpty()) {
                        log.setSwingCount(Integer.parseInt((String) swingCountObj));
                    }
                } catch (Exception e) {
                    logger.warn("swingCount 업데이트 실패: {}", data.get("swingCount"), e);
                }
            }
            if (data.get("ballSpeed") != null) {
                try {
                    Object ballSpeedObj = data.get("ballSpeed");
                    if (ballSpeedObj instanceof Number) {
                        log.setBallSpeed(((Number) ballSpeedObj).doubleValue());
                    } else if (ballSpeedObj instanceof String && !((String) ballSpeedObj).trim().isEmpty()) {
                        log.setBallSpeed(Double.parseDouble((String) ballSpeedObj));
                    }
                } catch (Exception e) {
                    logger.warn("ballSpeed 업데이트 실패: {}", data.get("ballSpeed"), e);
                }
            }
            if (data.get("launchAngle") != null) {
                try {
                    Object launchAngleObj = data.get("launchAngle");
                    if (launchAngleObj instanceof Number) {
                        log.setLaunchAngle(((Number) launchAngleObj).doubleValue());
                    } else if (launchAngleObj instanceof String && !((String) launchAngleObj).trim().isEmpty()) {
                        log.setLaunchAngle(Double.parseDouble((String) launchAngleObj));
                    }
                } catch (Exception e) {
                    logger.warn("launchAngle 업데이트 실패: {}", data.get("launchAngle"), e);
                }
            }
            if (data.get("hitDirection") != null) {
                String hitDirection = data.get("hitDirection").toString();
                if (!hitDirection.trim().isEmpty()) {
                    log.setHitDirection(hitDirection);
                } else {
                    log.setHitDirection(null);
                }
            }
            if (data.get("contactRate") != null) {
                try {
                    Object contactRateObj = data.get("contactRate");
                    if (contactRateObj instanceof Number) {
                        log.setContactRate(((Number) contactRateObj).doubleValue());
                    } else if (contactRateObj instanceof String && !((String) contactRateObj).trim().isEmpty()) {
                        log.setContactRate(Double.parseDouble((String) contactRateObj));
                    }
                } catch (Exception e) {
                    logger.warn("contactRate 업데이트 실패: {}", data.get("contactRate"), e);
                }
            }
            
            // 투구 기록 업데이트
            if (data.get("pitchSpeed") != null) {
                try {
                    Object pitchSpeedObj = data.get("pitchSpeed");
                    if (pitchSpeedObj instanceof Number) {
                        log.setPitchSpeed(((Number) pitchSpeedObj).doubleValue());
                    } else if (pitchSpeedObj instanceof String && !((String) pitchSpeedObj).trim().isEmpty()) {
                        log.setPitchSpeed(Double.parseDouble((String) pitchSpeedObj));
                    }
                } catch (Exception e) {
                    logger.warn("pitchSpeed 업데이트 실패: {}", data.get("pitchSpeed"), e);
                }
            }
            if (data.get("spinRate") != null) {
                try {
                    Object spinRateObj = data.get("spinRate");
                    if (spinRateObj instanceof Number) {
                        log.setSpinRate(((Number) spinRateObj).intValue());
                    } else if (spinRateObj instanceof String && !((String) spinRateObj).trim().isEmpty()) {
                        log.setSpinRate(Integer.parseInt((String) spinRateObj));
                    }
                } catch (Exception e) {
                    logger.warn("spinRate 업데이트 실패: {}", data.get("spinRate"), e);
                }
            }
            if (data.get("pitchType") != null) {
                String pitchType = data.get("pitchType").toString();
                if (!pitchType.trim().isEmpty()) {
                    log.setPitchType(pitchType);
                } else {
                    log.setPitchType(null);
                }
            }
            if (data.get("strikeRate") != null) {
                try {
                    Object strikeRateObj = data.get("strikeRate");
                    if (strikeRateObj instanceof Number) {
                        log.setStrikeRate(((Number) strikeRateObj).doubleValue());
                    } else if (strikeRateObj instanceof String && !((String) strikeRateObj).trim().isEmpty()) {
                        log.setStrikeRate(Double.parseDouble((String) strikeRateObj));
                    }
                } catch (Exception e) {
                    logger.warn("strikeRate 업데이트 실패: {}", data.get("strikeRate"), e);
                }
            }
            
            // 체력 기록 업데이트
            if (data.get("runningDistance") != null) {
                try {
                    Object runningDistanceObj = data.get("runningDistance");
                    if (runningDistanceObj instanceof Number) {
                        log.setRunningDistance(((Number) runningDistanceObj).doubleValue());
                    } else if (runningDistanceObj instanceof String && !((String) runningDistanceObj).trim().isEmpty()) {
                        log.setRunningDistance(Double.parseDouble((String) runningDistanceObj));
                    }
                } catch (Exception e) {
                    logger.warn("runningDistance 업데이트 실패: {}", data.get("runningDistance"), e);
                }
            }
            if (data.get("weightTraining") != null) {
                String weightTraining = data.get("weightTraining").toString();
                if (!weightTraining.trim().isEmpty()) {
                    log.setWeightTraining(weightTraining);
                } else {
                    log.setWeightTraining(null);
                }
            }
            // conditionScore는 문자열일 수 있으므로 처리
            if (data.get("conditionScore") != null) {
                Object conditionObj = data.get("conditionScore");
                if (conditionObj instanceof Number) {
                    log.setConditionScore(((Number) conditionObj).intValue());
                } else if (conditionObj instanceof String) {
                    // 문자열인 경우 (예: "EXCELLENT", "GOOD") 무시
                    // 숫자 문자열인 경우만 처리
                    try {
                        log.setConditionScore(Integer.parseInt((String) conditionObj));
                    } catch (NumberFormatException e) {
                        // 숫자가 아닌 문자열은 무시
                    }
                }
            }
            
            // 메모 업데이트
            if (data.get("notes") != null) {
                log.setNotes(data.get("notes").toString());
            }

            TrainingLog saved = trainingLogRepository.save(log);
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지)
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("id", saved.getId());
            result.put("recordDate", saved.getRecordDate());
            result.put("type", saved.getType() != null ? saved.getType().name() : null);
            result.put("part", saved.getPart() != null ? saved.getPart().name() : null);
            result.put("swingSpeed", saved.getSwingSpeed());
            result.put("swingCount", saved.getSwingCount());
            result.put("ballSpeed", saved.getBallSpeed());
            result.put("launchAngle", saved.getLaunchAngle());
            result.put("hitDirection", saved.getHitDirection());
            result.put("contactRate", saved.getContactRate());
            result.put("pitchSpeed", saved.getPitchSpeed());
            result.put("spinRate", saved.getSpinRate());
            result.put("pitchType", saved.getPitchType());
            result.put("strikeRate", saved.getStrikeRate());
            result.put("runningDistance", saved.getRunningDistance());
            result.put("weightTraining", saved.getWeightTraining());
            result.put("conditionScore", saved.getConditionScore());
            result.put("notes", saved.getNotes());
            result.put("createdAt", saved.getCreatedAt());
            
            // Member 정보
            if (saved.getMember() != null) {
                try {
                    java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                    memberMap.put("id", saved.getMember().getId());
                    memberMap.put("name", saved.getMember().getName());
                    memberMap.put("memberNumber", saved.getMember().getMemberNumber());
                    result.put("member", memberMap);
                } catch (Exception e) {
                    logger.warn("Member 로드 실패: TrainingLog ID={}", saved.getId(), e);
                    result.put("member", null);
                }
            } else {
                result.put("member", null);
            }
            
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            logger.warn("훈련 기록을 찾을 수 없습니다. ID: {}", id, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("훈련 기록 수정 중 오류 발생. ID: {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
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
