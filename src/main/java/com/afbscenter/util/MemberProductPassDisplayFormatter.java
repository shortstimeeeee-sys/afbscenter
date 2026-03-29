package com.afbscenter.util;

import com.afbscenter.model.Coach;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 회원 목록(members.js · 상품별 줄 표시)과 동일한 이용권 한 줄 문구 생성.
 * 공개 회원 예약 API 등에서 관리 화면과 표기를 맞추기 위해 사용한다.
 */
public final class MemberProductPassDisplayFormatter {

    private static final DateTimeFormatter DATE_DOT = DateTimeFormatter.ofPattern("yyyy. MM. dd.");

    private MemberProductPassDisplayFormatter() {
    }

    /**
     * 기간권(MONTHLY_PASS): "상품명 : ~ yyyy. MM. dd."<br>
     * 그 외: "상품명 : N회" 또는 정보 없음 문구<br>
     *
     * @param resolvedCountOrPackageRemaining COUNT_PASS / TEAM_PACKAGE 는
     *                                        {@link MemberProductCountPassHelper}·패키지 합산과 동일한 잔여.
     *                                        다른 타입은 0을 넘기면 내부에서 mp·상품 필드로 보충한다.
     */
    public static String formatDisplayLine(MemberProduct mp, Product p, int resolvedCountOrPackageRemaining) {
        if (p == null || mp == null) {
            return "이용권";
        }
        String productName = p.getName() != null ? p.getName() : "이용권";

        if (p.getType() == Product.ProductType.MONTHLY_PASS) {
            LocalDate exp = mp.getExpiryDate();
            if (exp == null && mp.getPurchaseDate() != null) {
                int validDays = p.getValidDays() != null && p.getValidDays() > 0 ? p.getValidDays() : 30;
                exp = mp.getPurchaseDate().toLocalDate().plusDays(validDays);
            }
            if (exp != null) {
                return productName + " : ~ " + exp.format(DATE_DOT);
            }
            return productName + " : 기간 정보 없음";
        }

        Integer rem;
        if (mp.getStatus() == MemberProduct.Status.USED_UP) {
            rem = 0;
        } else if (p.getType() == Product.ProductType.COUNT_PASS || p.getType() == Product.ProductType.TEAM_PACKAGE) {
            rem = resolvedCountOrPackageRemaining;
        } else {
            rem = mp.getRemainingCount();
            if (rem == null) {
                rem = p.getUsageCount();
            }
            if (rem == null) {
                rem = mp.getTotalCount();
            }
        }

        if (rem == null) {
            return productName + " : 정보 없음";
        }
        return productName + " : " + rem + "회";
    }

    /**
     * 이용권 직접 배정 코치 → 상품 기본 코치. 이름 필드에 "[대표]" 등이 포함되면 그대로 반환.
     */
    public static String resolveCoachDisplayName(MemberProduct mp, Product p) {
        if (mp != null && mp.getCoach() != null) {
            String n = mp.getCoach().getName();
            if (n != null && !n.isBlank()) {
                return n.trim();
            }
        }
        if (p != null && p.getCoach() != null) {
            String n = p.getCoach().getName();
            if (n != null && !n.isBlank()) {
                return n.trim();
            }
        }
        return null;
    }

    /**
     * 코치 {@code available_branches}(SAHA,YEONSAN 등)를 화면용 한글 지점으로 표기. (예: 사하점·연산점)
     */
    public static String formatCoachAssignedBranchesKo(Coach coach) {
        if (coach == null || coach.getAvailableBranches() == null || coach.getAvailableBranches().isBlank()) {
            return null;
        }
        String[] parts = coach.getAvailableBranches().split("[\\s,;|]+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            String u = part.trim().toUpperCase();
            if (u.isEmpty()) {
                continue;
            }
            String label = switch (u) {
                case "SAHA" -> "사하점";
                case "YEONSAN" -> "연산점";
                case "RENTAL" -> "대관";
                default -> part.trim();
            };
            if (sb.length() > 0) {
                sb.append("·");
            }
            sb.append(label);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    /**
     * 코치 지점 필드가 비었을 때 상품 종류로만 보조 (대관 등).
     */
    public static String inferBranchLabelFromProduct(Product p) {
        if (p == null || p.getCategory() == null) {
            return null;
        }
        if (p.getCategory() == Product.ProductCategory.RENTAL) {
            return "대관";
        }
        return null;
    }

    /**
     * 보유 이용권 셀렉트 한 줄: 상품 요약, 코치명, 담당 지점(순서).
     */
    public static String buildPassOptionLabel(String displayLine, String coachDisplay, String branchDisplayKo) {
        String base = (displayLine != null && !displayLine.isBlank()) ? displayLine.trim() : "이용권";
        StringBuilder sb = new StringBuilder(base);
        if (coachDisplay != null && !coachDisplay.isBlank()) {
            sb.append(", ").append(coachDisplay.trim());
        }
        if (branchDisplayKo != null && !branchDisplayKo.isBlank()) {
            sb.append(", ").append(branchDisplayKo.trim());
        }
        return sb.toString();
    }

    /**
     * 코치 {@code available_branches}를 사이드바 지점(SAHA/YEONSAN/RENTAL) 코드 목록으로 파싱.
     * 대관 전용 상품이면 코치 없어도 {@code RENTAL} 포함.
     */
    /**
     * 코치 담당 종목(specialties)에 유소년 야구가 포함되는지 — 사이드바 「야구(유소년)」 메뉴 표시용.
     */
    public static boolean coachSpecialtiesIncludeYouthBaseball(Coach coach) {
        if (coach == null || coach.getSpecialties() == null || coach.getSpecialties().isBlank()) {
            return false;
        }
        String s = coach.getSpecialties();
        if (s.contains("유소년")) {
            return true;
        }
        String lower = s.toLowerCase();
        return lower.contains("youth") || lower.contains("youth_baseball");
    }

    public static List<String> resolveCoachBranchCodes(Coach coach, Product p) {
        List<String> out = new ArrayList<>();
        if (coach != null && coach.getAvailableBranches() != null && !coach.getAvailableBranches().isBlank()) {
            for (String part : coach.getAvailableBranches().split("[\\s,;|]+")) {
                String u = part.trim().toUpperCase();
                if (u.isEmpty()) {
                    continue;
                }
                if ("SAHA".equals(u) || "YEONSAN".equals(u) || "RENTAL".equals(u)) {
                    if (!out.contains(u)) {
                        out.add(u);
                    }
                }
            }
        }
        if (out.isEmpty() && p != null && p.getCategory() == Product.ProductCategory.RENTAL) {
            out.add("RENTAL");
        }
        return out;
    }
}
