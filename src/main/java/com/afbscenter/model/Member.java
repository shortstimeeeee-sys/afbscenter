package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "members")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Size(max = 20, message = "회원번호는 20자 이하여야 합니다")
    @Column(name = "member_number", unique = true, length = 20)
    private String memberNumber; // 회원번호 (예: M0001, M0002)

    @NotBlank(message = "이름은 필수입니다")
    @Size(max = 255, message = "이름은 255자 이하여야 합니다")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "전화번호는 필수입니다")
    @Size(max = 20, message = "전화번호는 20자 이하여야 합니다")
    @Column(nullable = false)
    private String phoneNumber; // 형제/가족이 같은 전화번호 사용 가능

    @Past(message = "생년월일은 과거 날짜여야 합니다")
    @Column(name = "birth_date", nullable = true)
    private LocalDate birthDate;

    @NotNull(message = "성별은 필수입니다")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Gender gender;

    @Positive(message = "키는 0보다 커야 합니다")
    @Column(nullable = true)
    private Integer height; // cm

    @Positive(message = "몸무게는 0보다 커야 합니다")
    @Column(nullable = true)
    private Integer weight; // kg

    @Column(length = 500)
    private String address;

    @Column(length = 1000)
    private String memo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberGrade grade = MemberGrade.SOCIAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberStatus status = MemberStatus.ACTIVE;

    @Column(name = "join_date", nullable = false)
    private LocalDate joinDate = LocalDate.now();

    @Column(name = "last_visit_date")
    private LocalDate lastVisitDate;

    @Column(name = "coach_memo", length = 2000)
    private String coachMemo; // 코치 메모

    @Column(name = "student_name")
    private String guardianName; // 수강생 이름 (유소년의 경우 실제 수강생 이름)

    @Column(name = "student_phone")
    private String guardianPhone; // 수강생 연락처 (유소년의 경우 실제 수강생 연락처)

    @Column(name = "school", length = 200)
    private String school; // 학교/소속

    @Column(name = "swing_speed")
    private Double swingSpeed; // 스윙 속도 (km/h) - 소수점 한자리

    @Column(name = "exit_velocity")
    private Double exitVelocity; // 타구 속도 (km/h) - 소수점 한자리

    @Column(name = "pitching_speed")
    private Double pitchingSpeed; // 구속 (km/h) - 소수점 한자리

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coach_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Coach coach; // 담당 코치

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<BaseballRecord> baseballRecords = new ArrayList<>();

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"member"})
    private List<MemberProduct> memberProducts = new ArrayList<>();

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Booking> bookings = new ArrayList<>();

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Attendance> attendances = new ArrayList<>();

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<TrainingLog> trainingLogs = new ArrayList<>();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Gender {
        MALE, FEMALE
    }

    public enum MemberGrade {
        SOCIAL,            // 사회인
        ELITE_ELEMENTARY,  // 엘리트 (초)
        ELITE_MIDDLE,      // 엘리트 (중)
        ELITE_HIGH,        // 엘리트 (고)
        YOUTH              // 유소년
    }

    public enum MemberStatus {
        ACTIVE,     // 활성
        INACTIVE,   // 휴면
        WITHDRAWN   // 탈퇴
    }
}
