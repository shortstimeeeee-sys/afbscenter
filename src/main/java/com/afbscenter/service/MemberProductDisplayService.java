package com.afbscenter.service;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.MemberProductHistory;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.MemberProductHistoryRepository;
import com.afbscenter.util.MemberProductExtensionHelper;
import com.afbscenter.util.MemberProductUiDedupe;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 회원 이용권을 화면에 보여 줄 때의 공통 규칙.
 * <ul>
 *   <li>{@link MemberProductUiDedupe} — 회원 상세·대시보드 동일 목록 정리</li>
 *   <li>{@code ledgerLines} — 횟수권 카드용 CHARGE/ADJUST 요약</li>
 * </ul>
 */
@Service
public class MemberProductDisplayService {

    private static final Logger log = LoggerFactory.getLogger(MemberProductDisplayService.class);

    private final MemberProductHistoryRepository memberProductHistoryRepository;
    private final AttendanceRepository attendanceRepository;
    private final BookingRepository bookingRepository;

    public MemberProductDisplayService(
            MemberProductHistoryRepository memberProductHistoryRepository,
            AttendanceRepository attendanceRepository,
            BookingRepository bookingRepository) {
        this.memberProductHistoryRepository = memberProductHistoryRepository;
        this.attendanceRepository = attendanceRepository;
        this.bookingRepository = bookingRepository;
    }

    /**
     * {@link MemberProductUiDedupe#applyDetailUiDedupe} 와 동일 입력(최소 행)을 거친 뒤 남는 이용권 ID.
     * 대시보드 「종료」탭·KPI 등에서 회원 상세 이용권 API와 같은 집합을 쓸 때 사용.
     */
    public Set<Long> visibleMemberProductIdsAfterDetailUiDedupe(long memberId, List<MemberProduct> allMemberProducts) {
        Set<Long> out = new HashSet<>();
        if (allMemberProducts == null || allMemberProducts.isEmpty()) {
            return out;
        }
        if (allMemberProducts.size() == 1) {
            MemberProduct only = allMemberProducts.get(0);
            if (only.getId() != null) {
                out.add(only.getId());
            }
            return out;
        }
        try {
            List<Map<String, Object>> minimalRows = new ArrayList<>();
            for (MemberProduct mp : allMemberProducts) {
                minimalRows.add(MemberProductUiDedupe.buildMinimalDedupeRow(mp, memberId, attendanceRepository, bookingRepository));
            }
            List<Map<String, Object>> afterDedupe =
                    MemberProductUiDedupe.removeExtensionChainParentRows(
                            MemberProductUiDedupe.applyDetailUiDedupe(new ArrayList<>(minimalRows)));
            for (Map<String, Object> m : afterDedupe) {
                Object oid = m.get("id");
                if (oid instanceof Number) {
                    out.add(((Number) oid).longValue());
                }
            }
        } catch (Exception e) {
            log.debug("visibleMemberProductIdsAfterDetailUiDedupe 실패 memberId={}: {}", memberId, e.getMessage());
        }
        return out;
    }

    /**
     * 대시보드 「종료 이용권」 목록에 넣을지: 상세 dedupe에 남는 ID이면서, 연장에 가려진 직전 행은 제외.
     */
    public boolean isVisibleForDashboardEndedList(
            MemberProduct mp,
            Set<Long> visibleAfterDetailUiDedupe,
            List<MemberProduct> allMemberProducts) {
        if (mp == null || mp.getId() == null || visibleAfterDetailUiDedupe == null) {
            return false;
        }
        return visibleAfterDetailUiDedupe.contains(mp.getId())
                && !MemberProductExtensionHelper.isSupersededByExtension(mp, allMemberProducts);
    }

    /**
     * 회원별 이용권 ID → 횟수권 카드용 {@code ledgerLines} (충전/연장/조정 요약).
     */
    public Map<Long, List<Map<String, Object>>> buildLedgerLinesByMemberProductId(Long memberId) {
        if (memberId == null) {
            return Collections.emptyMap();
        }
        Map<Long, List<MemberProductHistory>> grouped = new HashMap<>();
        try {
            List<MemberProductHistory> ledgerAll =
                    memberProductHistoryRepository.findByMemberIdFetchMemberProductOrderByTransactionDateAsc(memberId);
            for (MemberProductHistory h : ledgerAll) {
                if (h.getMemberProduct() == null || h.getMemberProduct().getId() == null) {
                    continue;
                }
                grouped.computeIfAbsent(h.getMemberProduct().getId(), k -> new ArrayList<>()).add(h);
            }
        } catch (Exception e) {
            log.debug("ledger 묶음 로드 생략 memberId={}: {}", memberId, e.getMessage());
            return Collections.emptyMap();
        }
        Map<Long, List<Map<String, Object>>> result = new HashMap<>();
        for (Map.Entry<Long, List<MemberProductHistory>> e : grouped.entrySet()) {
            result.put(e.getKey(), buildCountPassLedgerLinesForApi(e.getValue()));
        }
        return result;
    }

    /**
     * 횟수권 한 건에 대한 CHARGE·ADJUST 이력 — API {@code ledgerLines} 필드.
     */
    private static List<Map<String, Object>> buildCountPassLedgerLinesForApi(List<MemberProductHistory> histories) {
        if (histories == null || histories.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> lines = new ArrayList<>();
        for (MemberProductHistory h : histories) {
            if (h.getType() == null || h.getChangeAmount() == null) {
                continue;
            }
            if (h.getType() == MemberProductHistory.TransactionType.CHARGE && h.getChangeAmount() > 0) {
                Map<String, Object> line = new HashMap<>();
                String desc = h.getDescription() != null ? h.getDescription() : "";
                String label = desc.contains("연장") ? "연장" : "충전";
                line.put("label", label);
                line.put("delta", h.getChangeAmount());
                line.put("at", h.getTransactionDate());
                lines.add(line);
            } else if (h.getType() == MemberProductHistory.TransactionType.ADJUST && h.getChangeAmount() != 0) {
                Map<String, Object> line = new HashMap<>();
                line.put("label", "조정");
                line.put("delta", h.getChangeAmount());
                line.put("at", h.getTransactionDate());
                lines.add(line);
            }
        }
        return lines;
    }
}
