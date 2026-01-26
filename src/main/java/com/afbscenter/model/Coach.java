package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "coaches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Coach {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "코치 이름은 필수입니다")
    @Size(max = 255, message = "코치 이름은 255자 이하여야 합니다")
    @Column(nullable = false)
    private String name;

    @Size(max = 20, message = "전화번호는 20자 이하여야 합니다")
    @Column
    private String phoneNumber;

    @Size(max = 255, message = "이메일은 255자 이하여야 합니다")
    @Column
    private String email;

    @Size(max = 1000, message = "프로필은 1000자 이하여야 합니다")
    @Column(length = 1000)
    private String profile; // 프로필

    @Size(max = 500, message = "담당 종목은 500자 이하여야 합니다")
    @Column
    private String specialties; // 담당 종목 (타격/투구/수비 등, 쉼표로 구분)

    @Size(max = 1000, message = "가능 시간은 1000자 이하여야 합니다")
    @Column(name = "available_times")
    private String availableTimes; // 가능 시간 (JSON 또는 텍스트)

    @Size(max = 500, message = "배정 지점은 500자 이하여야 합니다")
    @Column(name = "available_branches")
    private String availableBranches; // 배정된 지점들 (SAHA,YEONSAN,RENTAL 등 쉼표로 구분)

    @Column(name = "user_id")
    private Long userId; // 연결된 사용자 계정 ID (User 테이블 참조)

    @Column(nullable = false)
    private Boolean active = true;
}
