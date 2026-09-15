package com.afbscenter.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "pass_settlements", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pass_settled_through", columnNames = {"settled_through"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PassSettlement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 이 시각 이전 시작 예약은 결산 마감. 잔여 횟수는 이 행으로 덮지 않는다. */
    @Column(name = "settled_through", nullable = false)
    private LocalDateTime settledThrough;

    @Column(name = "settled_at", nullable = false)
    private LocalDateTime settledAt;

    @Column(name = "note", length = 80)
    private String note;
}
