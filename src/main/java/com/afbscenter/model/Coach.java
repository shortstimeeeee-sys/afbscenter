package com.afbscenter.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
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

    @Column(nullable = false)
    private String name;

    @Column
    private String phoneNumber;

    @Column
    private String email;

    @Column(length = 1000)
    private String profile; // 프로필

    @Column
    private String specialties; // 담당 종목 (타격/투구/수비 등, 쉼표로 구분)

    @Column(name = "available_times")
    private String availableTimes; // 가능 시간 (JSON 또는 텍스트)

    @Column(nullable = false)
    private Boolean active = true;
}
