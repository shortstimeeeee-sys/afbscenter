package com.afbscenter.util;

import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 회원 상세 「이용권」 탭과 대시보드 「종료 이용권」이 공유하는 목록 정리 규칙.
 * <p>
 * {@link com.afbscenter.controller.MemberProductController#getAllMemberProducts} 의
 * {@code forMemberDetailUi=true} 응답과 동일한 2단계(동일 상품·동일 바우처) dedupe.
 */
public final class MemberProductUiDedupe {

    private MemberProductUiDedupe() {
    }

    /**
     * 회원 상세 이용권 API와 동일한 최소 필드로 dedupe 판단용 행을 만든다.
     * {@link com.afbscenter.controller.MemberProductController} 의 Map 변환과 잔여 계산이 가능한 한 맞춘다.
     */
    public static Map<String, Object> buildMinimalDedupeRow(
            MemberProduct mp,
            Long memberId,
            AttendanceRepository attendanceRepository,
            BookingRepository bookingRepository) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", mp.getId());
        map.put("voucherNumber", mp.getVoucherNumber());
        map.put("extendedFromMemberProductId", mp.getExtendedFromMemberProductId());

        LocalDate today = LocalDate.now();
        String statusName = mp.getStatus() != null ? mp.getStatus().name() : null;
        Integer remainingCount = mp.getRemainingCount();

        if ("ACTIVE".equals(statusName) && mp.getExpiryDate() != null && mp.getExpiryDate().isBefore(today)) {
            statusName = "EXPIRED";
            remainingCount = 0;
        }

        if (mp.getProduct() != null && mp.getProduct().getType() == Product.ProductType.COUNT_PASS) {
            Long mid = memberId;
            if (mid == null && mp.getMember() != null) {
                try {
                    mid = mp.getMember().getId();
                } catch (Exception ignored) {
                    mid = null;
                }
            }
            if (mid != null && attendanceRepository != null && bookingRepository != null) {
                int rc = MemberProductCountPassHelper.resolveRemainingForRead(
                        mp, mid, attendanceRepository, bookingRepository);
                remainingCount = rc;
            } else if (remainingCount == null) {
                remainingCount = 0;
            }
        }

        map.put("status", statusName);
        map.put("remainingCount", remainingCount);

        if (mp.getProduct() != null) {
            Map<String, Object> productMap = new HashMap<>();
            productMap.put("id", mp.getProduct().getId());
            productMap.put("type", mp.getProduct().getType() != null ? mp.getProduct().getType().name() : null);
            map.put("product", productMap);
        } else {
            map.put("product", null);
        }
        return map;
    }

    /**
     * 회원 상세 「이용권」 탭 전용: 동일 상품의 소진 행·동일 바우처 중복을 제거.
     */
    public static List<Map<String, Object>> applyDetailUiDedupe(List<Map<String, Object>> rows) {
        if (rows == null || rows.size() < 2) {
            return rows;
        }
        List<Map<String, Object>> out = new ArrayList<>(rows);
        Set<Map<String, Object>> toRemove = new HashSet<>();
        Map<Long, List<Map<String, Object>>> byProduct = new LinkedHashMap<>();
        for (Map<String, Object> m : out) {
            Long pid = extractProductIdForDedupe(m);
            if (pid == null) {
                continue;
            }
            byProduct.computeIfAbsent(pid, k -> new ArrayList<>()).add(m);
        }
        for (List<Map<String, Object>> group : byProduct.values()) {
            if (group.size() < 2) {
                continue;
            }
            List<Map<String, Object>> exhausted = new ArrayList<>();
            List<Map<String, Object>> fresh = new ArrayList<>();
            for (Map<String, Object> m : group) {
                if (isExhaustedForDetailUi(m)) {
                    exhausted.add(m);
                } else {
                    fresh.add(m);
                }
            }
            if (fresh.isEmpty() || exhausted.isEmpty()) {
                continue;
            }
            boolean linked = false;
            for (Map<String, Object> g : fresh) {
                Object ext = g.get("extendedFromMemberProductId");
                if (ext == null) {
                    continue;
                }
                long extId = toLongIdSafe(ext);
                for (Map<String, Object> e : exhausted) {
                    if (extId == toLongIdSafe(e.get("id"))) {
                        String vg = voucherTrimForDedupe(g);
                        String ve = voucherTrimForDedupe(e);
                        if (!vg.isEmpty() && vg.equals(ve)) {
                            continue;
                        }
                        linked = true;
                        break;
                    }
                }
                if (linked) {
                    break;
                }
            }
            if (!linked) {
                toRemove.addAll(exhausted);
            } else {
                // 연장으로 신규 행이 직전 소진 행을 가리키면, 직전 행은 목록에서 제외(이력은 ledgerLines·이용권 변동 탭)
                for (Map<String, Object> e : exhausted) {
                    if (isExhaustedSupersededByFreshExtension(e, fresh)) {
                        toRemove.add(e);
                    }
                }
            }
        }
        out.removeIf(toRemove::contains);
        if (out.size() < 2) {
            return out;
        }
        toRemove.clear();
        Map<String, List<Map<String, Object>>> byVoucher = new LinkedHashMap<>();
        for (Map<String, Object> m : out) {
            Object vn = m.get("voucherNumber");
            if (vn == null || vn.toString().isBlank()) {
                continue;
            }
            String key = vn.toString().trim();
            byVoucher.computeIfAbsent(key, k -> new ArrayList<>()).add(m);
        }
        for (List<Map<String, Object>> group : byVoucher.values()) {
            if (group.size() < 2) {
                continue;
            }
            Map<String, Object> best = group.get(0);
            int bestRem = remainingForSortVoucher(best);
            long bestId = toLongIdSafe(best.get("id"));
            for (int i = 1; i < group.size(); i++) {
                Map<String, Object> m = group.get(i);
                int rem = remainingForSortVoucher(m);
                long id = toLongIdSafe(m.get("id"));
                if (rem > bestRem || (rem == bestRem && id > bestId)) {
                    best = m;
                    bestRem = rem;
                    bestId = id;
                }
            }
            for (Map<String, Object> m : group) {
                if (m != best) {
                    toRemove.add(m);
                }
            }
        }
        out.removeIf(toRemove::contains);
        return out;
    }

    /**
     * 연장 체인: 다른 이용권 행의 {@code extendedFromMemberProductId}가 가리키는 행(직전 이용권)은 목록에서 제외.
     * 잔여 계산·소진 분류와 무관하게 적용해, ACTIVE·잔여 0 등으로 dedupe 1단계에 걸리지 않던 직전 행도 숨긴다.
     */
    public static List<Map<String, Object>> removeExtensionChainParentRows(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return rows;
        }
        Set<Long> idsPointedAsParent = new HashSet<>();
        for (Map<String, Object> m : rows) {
            Object ext = m.get("extendedFromMemberProductId");
            if (ext instanceof Number) {
                idsPointedAsParent.add(((Number) ext).longValue());
            }
        }
        if (idsPointedAsParent.isEmpty()) {
            return rows;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> m : rows) {
            long mid = toLongIdSafe(m != null ? m.get("id") : null);
            if (mid != 0L && idsPointedAsParent.contains(mid)) {
                continue;
            }
            out.add(m);
        }
        return out;
    }

    /** 신규 활성 행이 extendedFrom 으로 가리키는 소진 행(동일 바우처 예외는 linked 판단과 동일) */
    private static boolean isExhaustedSupersededByFreshExtension(Map<String, Object> e, List<Map<String, Object>> fresh) {
        for (Map<String, Object> g : fresh) {
            Object ext = g.get("extendedFromMemberProductId");
            if (ext == null) {
                continue;
            }
            if (toLongIdSafe(ext) != toLongIdSafe(e.get("id"))) {
                continue;
            }
            String vg = voucherTrimForDedupe(g);
            String ve = voucherTrimForDedupe(e);
            if (!vg.isEmpty() && vg.equals(ve)) {
                continue;
            }
            return true;
        }
        return false;
    }

    private static String voucherTrimForDedupe(Map<String, Object> m) {
        if (m == null) {
            return "";
        }
        Object vn = m.get("voucherNumber");
        return vn == null ? "" : vn.toString().trim();
    }

    private static Long extractProductIdForDedupe(Map<String, Object> m) {
        @SuppressWarnings("unchecked")
        Map<String, Object> prod = (Map<String, Object>) m.get("product");
        if (prod == null) {
            return null;
        }
        Object id = prod.get("id");
        if (id instanceof Number) {
            return ((Number) id).longValue();
        }
        return null;
    }

    private static boolean isExhaustedForDetailUi(Map<String, Object> m) {
        Object stObj = m.get("status");
        String st = stObj != null ? stObj.toString() : "";
        if ("USED_UP".equals(st) || "EXPIRED".equals(st)) {
            return true;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> prod = (Map<String, Object>) m.get("product");
        if (prod == null || !"COUNT_PASS".equals(String.valueOf(prod.get("type")))) {
            return false;
        }
        Object rc = m.get("remainingCount");
        return rc instanceof Number && ((Number) rc).intValue() == 0;
    }

    private static int remainingForSortVoucher(Map<String, Object> m) {
        Object rc = m.get("remainingCount");
        if (rc instanceof Number) {
            return ((Number) rc).intValue();
        }
        return 0;
    }

    private static long toLongIdSafe(Object o) {
        if (o instanceof Number) {
            return ((Number) o).longValue();
        }
        if (o == null) {
            return 0L;
        }
        try {
            return Long.parseLong(o.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
