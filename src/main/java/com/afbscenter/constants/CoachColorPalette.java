package com.afbscenter.constants;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 코치 고유색 팔레트.
 * DB coaches.color 에 저장되며, 등록·마이그레이션 시 미사용·다른 계열 색을 할당한다.
 */
public final class CoachColorPalette {

    private CoachColorPalette() {}

    /**
     * 서로 다른 색상 계열 위주 팔레트.
     * 같은 계열(비슷한 hue)은 pick 시 한 코치만 쓰도록 필터한다.
     */
    public static final List<String> PALETTE = List.of(
            "#FF9800", // 오렌지
            "#4CAF50", // 초록
            "#E91E63", // 핫핑크
            "#9C27B0", // 보라
            "#00897B", // 틸
            "#5E6AD2", // 남색/인디고
            "#1976D2", // 파랑
            "#FFFFFF", // 흰색 (서정훈 운영/대관담당)
            "#FFC107", // 노랑
            "#F06292", // 밝은핑크
            "#795548", // 브라운
            "#009688", // 틸2
            "#673AB7", // 진보라
            "#F57C00", // 진오렌지
            "#8E24AA", // 자홍보라
            "#FF5722", // 딥오렌지/코랄쪽
            "#CDDC39", // 라임
            "#FF4081", // 핑크액센트
            "#3F51B5", // 인디고
            "#8BC34A", // 연두
            "#FF6B6B", // 코랄
            "#4ECDC4", // 민트
            "#45B7D1", // 하늘
            "#D32F2F", // 빨강
            "#C0CA33", // 라임 (박근엽 — 이름 표시용 부드러운 톤)
            "#00796B", // 진틸
            "#5D4037", // 진브라운
            "#455A64", // 블루그레이
            "#C2185B", // 마젠타
            "#7B1FA2", // 딥퍼플
            "#0288D1", // 라이트블루
            "#F9A825", // 앰버
            "#558B2F", // 올리브
            "#6D4C41", // 커피
            "#E65100", // 딥오렌지2
            "#1B5E20", // 딥그린
            "#880E4F", // 딥핑크
            "#311B92", // 딥인디고
            "#006064", // 딥시안
            "#BF360C", // 딥레드오렌지
            "#827717"  // 올리브브라운
    );

    /** 이름(괄호·직함 제거 후 베이스명) → 선호 고유색 */
    public static final Map<String, String> PREFERRED_BY_BASE_NAME;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("서정민", "#FF9800");
        m.put("서정훈", "#FFFFFF"); // 운영/대관담당 — 흰색
        m.put("조장우", "#4CAF50");
        m.put("최성훈", "#E91E63");
        m.put("김우경", "#9C27B0");
        m.put("이원준", "#00897B");
        m.put("박준현", "#5E6AD2");
        m.put("공인욱", "#1976D2");
        m.put("이소연", "#FFC107");
        m.put("이서현", "#F06292");
        m.put("김가영", "#795548");
        m.put("김소연", "#009688");
        m.put("조혜진", "#673AB7");
        m.put("박근엽", "#C0CA33"); // 라임 — 빨강보다 부드럽고 다른 코치와 다른 계열
        m.put("이유진", "#8E24AA");
        PREFERRED_BY_BASE_NAME = Collections.unmodifiableMap(m);
    }

    /** "공인욱[코치]", "이원준 [포수코치]" → "공인욱", "이원준" */
    public static String normalizeBaseName(String name) {
        if (name == null) {
            return "";
        }
        String normalized = name.replaceAll("\\s+", " ").trim();
        if (normalized.isEmpty()) {
            return "";
        }
        normalized = normalized.replaceAll("\\s*[\\[\\(].*?[\\]\\)]\\s*$", "").trim();
        normalized = normalized
                .replaceAll("(대표|코치|강사|트레이너|투수코치|포수코치|대관담당)", "")
                .replaceAll("\\s+", " ")
                .trim();
        return normalized;
    }

    public static String normalizeHex(String color) {
        if (color == null) {
            return null;
        }
        String c = color.trim();
        if (c.isEmpty()) {
            return null;
        }
        if (!c.startsWith("#")) {
            c = "#" + c;
        }
        return c.toUpperCase(Locale.ROOT);
    }

    public static String preferredColorForName(String coachName) {
        String base = normalizeBaseName(coachName);
        if (base.isEmpty()) {
            return null;
        }
        return PREFERRED_BY_BASE_NAME.get(base);
    }

    /**
     * 색상 계열 키 (비슷한 hue = 같은 키).
     * 채도가 낮은 무채색/브라운은 별도 NEUTRAL_* 키.
     */
    public static String familyKey(String hex) {
        String n = normalizeHex(hex);
        if (n == null || n.length() != 7) {
            return "UNKNOWN";
        }
        try {
            int r = Integer.parseInt(n.substring(1, 3), 16);
            int g = Integer.parseInt(n.substring(3, 5), 16);
            int b = Integer.parseInt(n.substring(5, 7), 16);
            float[] hsl = rgbToHsl(r, g, b);
            float h = hsl[0];
            float s = hsl[1];
            float l = hsl[2];
            if (s < 0.18f || (s < 0.28f && l < 0.35f)) {
                // 브라운·그레이·블루그레이: 밝기 구간으로만 구분
                int band = Math.min(4, Math.max(0, (int) (l * 5)));
                return "NEUTRAL_" + band;
            }
            // 12등분 hue 버킷 (30도) — 같은 계열 겹침 방지
            int bucket = ((int) Math.floor(h / 30.0f)) % 12;
            if (bucket < 0) {
                bucket += 12;
            }
            return "HUE_" + bucket;
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    public static boolean sameFamily(String a, String b) {
        String na = normalizeHex(a);
        String nb = normalizeHex(b);
        if (na == null || nb == null) {
            return false;
        }
        if (na.equalsIgnoreCase(nb)) {
            return true;
        }
        return familyKey(na).equals(familyKey(nb));
    }

    /** 이미 쓰인 색(또는 같은 계열)과 충돌하면 true */
    public static boolean conflictsWithUsed(String candidate, Set<String> usedColors) {
        String n = normalizeHex(candidate);
        if (n == null) {
            return true;
        }
        Set<String> used = usedColors != null ? usedColors : Set.of();
        for (String u : used) {
            if (sameFamily(n, u)) {
                return true;
            }
        }
        return false;
    }

    public static boolean exactUsed(String candidate, Set<String> usedColors) {
        String n = normalizeHex(candidate);
        if (n == null) {
            return false;
        }
        Set<String> used = usedColors != null ? usedColors : Set.of();
        for (String u : used) {
            if (n.equalsIgnoreCase(normalizeHex(u))) {
                return true;
            }
        }
        return false;
    }

    /**
     * 이미 쓰인 색·같은 계열을 피해 팔레트에서 고른다.
     * 계열까지 소진되면 exact만 피한 색, 그래도 없으면 변형 색 생성.
     */
    public static String pickUnused(Set<String> usedColors) {
        Set<String> used = usedColors != null ? usedColors : Set.of();

        for (String c : PALETTE) {
            String n = normalizeHex(c);
            if (n != null && !conflictsWithUsed(n, used)) {
                return n;
            }
        }
        // 계열 소진: exact만 피함
        for (String c : PALETTE) {
            String n = normalizeHex(c);
            if (n != null && !exactUsed(n, used)) {
                return n;
            }
        }
        // 팔레트 소진: hue를 돌리며 새 색 생성
        for (int step = 0; step < 24; step++) {
            float hue = (step * 15f) % 360f;
            String generated = hslToHex(hue, 0.65f, 0.48f);
            if (!conflictsWithUsed(generated, used)) {
                return generated;
            }
        }
        for (int i = 0; i < PALETTE.size(); i++) {
            String base = normalizeHex(PALETTE.get(i));
            if (base == null) {
                continue;
            }
            String shifted = shiftHex(base, (i + 1) * 23);
            if (!exactUsed(shifted, used)) {
                return shifted;
            }
        }
        return normalizeHex(PALETTE.get(0));
    }

    public static List<String> allPreferredColors() {
        return new ArrayList<>(PREFERRED_BY_BASE_NAME.values());
    }

    private static float[] rgbToHsl(int r, int g, int b) {
        float rf = r / 255f;
        float gf = g / 255f;
        float bf = b / 255f;
        float max = Math.max(rf, Math.max(gf, bf));
        float min = Math.min(rf, Math.min(gf, bf));
        float l = (max + min) / 2f;
        float s;
        float h;
        if (max == min) {
            h = 0f;
            s = 0f;
        } else {
            float d = max - min;
            s = l > 0.5f ? d / (2f - max - min) : d / (max + min);
            if (max == rf) {
                h = ((gf - bf) / d + (gf < bf ? 6f : 0f)) / 6f;
            } else if (max == gf) {
                h = ((bf - rf) / d + 2f) / 6f;
            } else {
                h = ((rf - gf) / d + 4f) / 6f;
            }
        }
        return new float[]{h * 360f, s, l};
    }

    private static String hslToHex(float h, float s, float l) {
        float c = (1f - Math.abs(2f * l - 1f)) * s;
        float x = c * (1f - Math.abs((h / 60f) % 2f - 1f));
        float m = l - c / 2f;
        float r1;
        float g1;
        float b1;
        if (h < 60f) {
            r1 = c; g1 = x; b1 = 0f;
        } else if (h < 120f) {
            r1 = x; g1 = c; b1 = 0f;
        } else if (h < 180f) {
            r1 = 0f; g1 = c; b1 = x;
        } else if (h < 240f) {
            r1 = 0f; g1 = x; b1 = c;
        } else if (h < 300f) {
            r1 = x; g1 = 0f; b1 = c;
        } else {
            r1 = c; g1 = 0f; b1 = x;
        }
        int r = Math.round((r1 + m) * 255f);
        int g = Math.round((g1 + m) * 255f);
        int b = Math.round((b1 + m) * 255f);
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return String.format(Locale.ROOT, "#%02X%02X%02X", r, g, b);
    }

    private static String shiftHex(String hex, int delta) {
        try {
            int r = Integer.parseInt(hex.substring(1, 3), 16);
            int g = Integer.parseInt(hex.substring(3, 5), 16);
            int b = Integer.parseInt(hex.substring(5, 7), 16);
            r = (r + delta) % 256;
            g = (g + delta * 3) % 256;
            b = (b + delta * 5) % 256;
            if (r + g + b < 120) {
                r = Math.min(255, r + 80);
                g = Math.min(255, g + 80);
                b = Math.min(255, b + 80);
            }
            return String.format(Locale.ROOT, "#%02X%02X%02X", r, g, b);
        } catch (Exception e) {
            return hex;
        }
    }
}
