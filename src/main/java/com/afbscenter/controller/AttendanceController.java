package com.afbscenter.controller;

import com.afbscenter.model.Attendance;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.FacilityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/attendance")
@CrossOrigin(origins = "*")
public class AttendanceController {

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @GetMapping
    public ResponseEntity<List<java.util.Map<String, Object>>> getAllAttendance(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Long memberId) {
        try {
            List<Attendance> attendances;
            
            if (memberId != null) {
                attendances = attendanceRepository.findByMemberId(memberId);
            } else if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                attendances = attendanceRepository.findByDateRange(start, end);
            } else {
                attendances = attendanceRepository.findAll();
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (순환 참조 방지 및 memberName, facilityName 추가)
            List<java.util.Map<String, Object>> result = attendances.stream().map(attendance -> {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", attendance.getId());
                map.put("date", attendance.getDate());
                map.put("memberName", attendance.getMember() != null ? attendance.getMember().getName() : "-");
                map.put("facilityName", attendance.getFacility() != null ? attendance.getFacility().getName() : "-");
                map.put("checkInTime", attendance.getCheckInTime());
                map.put("checkOutTime", attendance.getCheckOutTime());
                map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
                map.put("memo", attendance.getMemo());
                map.put("penaltyApplied", attendance.getPenaltyApplied());
                return map;
            }).collect(java.util.stream.Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Attendance> getAttendanceById(@PathVariable Long id) {
        return attendanceRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Attendance> createAttendance(@RequestBody Attendance attendance) {
        try {
            // Member 설정
            if (attendance.getMember() != null && attendance.getMember().getId() != null) {
                attendance.setMember(memberRepository.findById(attendance.getMember().getId())
                        .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다.")));
            }
            
            // Facility 설정
            if (attendance.getFacility() != null && attendance.getFacility().getId() != null) {
                attendance.setFacility(facilityRepository.findById(attendance.getFacility().getId())
                        .orElseThrow(() -> new IllegalArgumentException("시설을 찾을 수 없습니다.")));
            }
            
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(attendanceRepository.save(attendance));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Attendance> updateAttendance(@PathVariable Long id, @RequestBody Attendance updatedAttendance) {
        try {
            Attendance attendance = attendanceRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("출석 기록을 찾을 수 없습니다."));
            
            if (updatedAttendance.getStatus() != null) {
                attendance.setStatus(updatedAttendance.getStatus());
            }
            if (updatedAttendance.getCheckInTime() != null) {
                attendance.setCheckInTime(updatedAttendance.getCheckInTime());
            }
            if (updatedAttendance.getCheckOutTime() != null) {
                attendance.setCheckOutTime(updatedAttendance.getCheckOutTime());
            }
            if (updatedAttendance.getMemo() != null) {
                attendance.setMemo(updatedAttendance.getMemo());
            }
            if (updatedAttendance.getPenaltyApplied() != null) {
                attendance.setPenaltyApplied(updatedAttendance.getPenaltyApplied());
            }
            
            return ResponseEntity.ok(attendanceRepository.save(attendance));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAttendance(@PathVariable Long id) {
        try {
            if (!attendanceRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            attendanceRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().build();
        }
    }

    // 체크인된 출석 기록 조회 (훈련 기록 입력용)
    @GetMapping("/checked-in")
    public ResponseEntity<List<java.util.Map<String, Object>>> getCheckedInAttendances(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        try {
            List<Attendance> attendances;
            
            if (startDate != null && endDate != null) {
                LocalDate start = LocalDate.parse(startDate);
                LocalDate end = LocalDate.parse(endDate);
                attendances = attendanceRepository.findCheckedInByDateRange(start, end);
            } else {
                attendances = attendanceRepository.findCheckedInAttendances();
            }
            
            // JSON 직렬화를 위해 Map으로 변환 (예약 정보 포함)
            List<java.util.Map<String, Object>> result = attendances.stream().map(attendance -> {
                java.util.Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", attendance.getId());
                map.put("date", attendance.getDate());
                map.put("checkInTime", attendance.getCheckInTime());
                map.put("checkOutTime", attendance.getCheckOutTime());
                map.put("status", attendance.getStatus() != null ? attendance.getStatus().name() : null);
                
                // 회원 정보
                if (attendance.getMember() != null) {
                    java.util.Map<String, Object> memberMap = new java.util.HashMap<>();
                    memberMap.put("id", attendance.getMember().getId());
                    memberMap.put("name", attendance.getMember().getName());
                    map.put("member", memberMap);
                }
                
                // 시설 정보
                if (attendance.getFacility() != null) {
                    java.util.Map<String, Object> facilityMap = new java.util.HashMap<>();
                    facilityMap.put("id", attendance.getFacility().getId());
                    facilityMap.put("name", attendance.getFacility().getName());
                    map.put("facility", facilityMap);
                }
                
                // 예약 정보 (있는 경우)
                if (attendance.getBooking() != null) {
                    try {
                        java.util.Map<String, Object> bookingMap = new java.util.HashMap<>();
                        bookingMap.put("id", attendance.getBooking().getId());
                        bookingMap.put("startTime", attendance.getBooking().getStartTime());
                        bookingMap.put("endTime", attendance.getBooking().getEndTime());
                        bookingMap.put("purpose", attendance.getBooking().getPurpose() != null ? attendance.getBooking().getPurpose().name() : null);
                        bookingMap.put("lessonCategory", attendance.getBooking().getLessonCategory() != null ? attendance.getBooking().getLessonCategory().name() : null);
                        
                        // 코치 정보
                        if (attendance.getBooking().getCoach() != null) {
                            java.util.Map<String, Object> coachMap = new java.util.HashMap<>();
                            coachMap.put("id", attendance.getBooking().getCoach().getId());
                            coachMap.put("name", attendance.getBooking().getCoach().getName());
                            coachMap.put("specialties", attendance.getBooking().getCoach().getSpecialties());
                            bookingMap.put("coach", coachMap);
                        }
                        
                        map.put("booking", bookingMap);
                    } catch (Exception e) {
                        // 예약 정보 로드 실패 시 무시
                    }
                }
                
                return map;
            }).collect(java.util.stream.Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
