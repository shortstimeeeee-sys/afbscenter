package com.afbscenter.service;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.User;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 운영용 코치 계정(예: 서정훈): 일반 코치처럼 본인 담당만 보지 않고,
 * {@code viewCoachIds}로 회원 카드 담당·이용권(상품) 담당 코치 기준 회원 목록·상세를 필터해 볼 수 있게 한다.
 */
@Service
public class OperationalCoachViewService {

    private final UserRepository userRepository;
    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final Set<String> usernames;
    private final Set<String> names;
    /** {@code coaches.id} 기준 운영 뷰 허용(이름 매칭 실패 시에도 지정 가능) */
    private final Set<Long> operationalCoachCoachIds;

    public OperationalCoachViewService(
            UserRepository userRepository,
            CoachRepository coachRepository,
            MemberRepository memberRepository,
            MemberProductRepository memberProductRepository,
            @Value("${app.operational-coach-view-usernames:}") String usernamesRaw,
            @Value("${app.operational-coach-view-names:서정훈}") String namesRaw,
            @Value("${app.operational-coach-view-coach-ids:}") String coachIdsRaw) {
        this.userRepository = userRepository;
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.usernames = splitSet(usernamesRaw);
        this.names = splitSet(namesRaw);
        this.operationalCoachCoachIds = splitLongSet(coachIdsRaw);
    }

    private static Set<Long> splitLongSet(String raw) {
        Set<Long> out = new HashSet<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        for (String p : raw.split(",")) {
            String t = p.trim();
            if (t.isEmpty()) {
                continue;
            }
            try {
                out.add(Long.parseLong(t));
            } catch (NumberFormatException ignored) {
                // skip
            }
        }
        return out;
    }

    private static Set<String> splitSet(String raw) {
        Set<String> s = new HashSet<>();
        if (raw == null || raw.isBlank()) {
            return s;
        }
        for (String p : raw.split(",")) {
            String t = p.trim();
            if (!t.isEmpty()) {
                s.add(t);
            }
        }
        return s;
    }

    /** 화면 표기용 접미사 제거: "서정훈 [대표]", "이름 [코치]" → 앞부분만 */
    private static String stripDisplayRoleSuffix(String name) {
        if (name == null) {
            return "";
        }
        return name.replaceAll("\\s*\\[[^\\]]+\\]\\s*$", "").trim();
    }

    /**
     * 설정 이름(app.operational-coach-view-names)과 일치하는지.
     * users.name만 "서정훈"이 아니고 코치 카드 이름이 "서정훈 [대표]"인 경우가 많아 접미사 제거 후 비교한다.
     */
    private boolean matchesConfiguredDisplayName(String rawName) {
        if (rawName == null || rawName.isBlank() || names.isEmpty()) {
            return false;
        }
        String trimmed = rawName.trim();
        String base = stripDisplayRoleSuffix(trimmed);
        for (String cfg : names) {
            if (cfg == null || cfg.isBlank()) {
                continue;
            }
            String c = cfg.trim();
            if (trimmed.equals(c) || base.equals(c)) {
                return true;
            }
        }
        return false;
    }

    public boolean isOperationalCoachViewer(User user) {
        if (user == null || user.getRole() != User.Role.COACH) {
            return false;
        }
        if (user.getUsername() != null && usernames.contains(user.getUsername().trim())) {
            return true;
        }
        Optional<Coach> coachOpt = coachRepository.findByUserId(user.getId());
        if (coachOpt.isPresent()) {
            Long cid = coachOpt.get().getId();
            if (cid != null && operationalCoachCoachIds.contains(cid)) {
                return true;
            }
        }
        if (matchesConfiguredDisplayName(user.getName())) {
            return true;
        }
        return coachOpt
                .map(Coach::getName)
                .filter(this::matchesConfiguredDisplayName)
                .isPresent();
    }

    public boolean isOperationalCoachViewer(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String username = (String) request.getAttribute("username");
        if (username == null || username.isBlank()) {
            return false;
        }
        Optional<User> u = userRepository.findByUsername(username.trim());
        return u.filter(this::isOperationalCoachViewer).isPresent();
    }

    public List<Long> parseViewCoachIds(String param) {
        List<Long> out = new ArrayList<>();
        if (param == null || param.isBlank()) {
            return out;
        }
        for (String part : param.split(",")) {
            String p = part.trim();
            if (p.isEmpty()) {
                continue;
            }
            try {
                out.add(Long.parseLong(p));
            } catch (NumberFormatException ignored) {
                // skip invalid token
            }
        }
        return out;
    }

    /**
     * 운영 코치가 체크한 코치 ID에 해당하는 회원 ID 집합.
     * 회원 카드 담당({@link Member#getCoach()}), <strong>ACTIVE</strong> 이용권의 직접 배정 코치·상품 기본 담당 코치 중 하나라도 일치하면 포함.
     * (종료·소진 이용권만 과거에 서정민이었던 경우는 제외 — 목록 담당 컬럼·이용권 화면과 맞춤)
     * (예약 목록 등은 별도 규칙 — {@link #bookingMatchesOperationalCoachIds})
     */
    public Set<Long> findMemberIdsMatchingViewCoachIds(List<Long> viewCoachIds) {
        if (viewCoachIds == null || viewCoachIds.isEmpty()) {
            return Set.of();
        }
        Set<Long> out = new HashSet<>(memberRepository.findMemberIdsByCoachIdIn(viewCoachIds));
        out.addAll(memberProductRepository.findMemberIdsByMemberProductCoachIdIn(viewCoachIds));
        out.addAll(memberProductRepository.findMemberIdsByProductCoachIdIn(viewCoachIds));
        return out;
    }

    /**
     * 코치가 해당 회원을 회원 목록·상세·검색에서 볼 수 있는지.
     * {@link #findMemberIdsMatchingViewCoachIds(java.util.List)}와 동일 규칙을 단건에 대해 효율적으로 판별.
     */
    public boolean coachCanAccessMember(Long coachId, Long memberId) {
        if (coachId == null || memberId == null) {
            return false;
        }
        return memberRepository.existsByIdAndCoachId(memberId, coachId)
                || memberProductRepository.existsActiveByMemberIdAndMemberProductCoachId(memberId, coachId)
                || memberProductRepository.existsActiveByMemberIdAndProductCoachId(memberId, coachId);
    }

    /** 로그인 코치 계정에 연결된 {@link Coach#id} (예약/통계 필터용). */
    public Optional<Long> resolveCoachIdFromLoggedInUser(HttpServletRequest request) {
        if (request == null) {
            return Optional.empty();
        }
        String username = (String) request.getAttribute("username");
        if (username == null || username.trim().isEmpty()) {
            return Optional.empty();
        }
        return userRepository.findByUsername(username.trim())
                .flatMap(u -> coachRepository.findByUserId(u.getId()))
                .map(Coach::getId);
    }

    /**
     * GET /bookings 운영·코치 뷰({@code viewCoachIds}): 캘린더 색(레슨 배정)과 목록이 어긋나지 않게
     * <strong>예약에 레슨 코치가 있으면 그 id만</strong> 선택 목록과 비교한다.
     * 레슨 미배정(예약 코치 없음)인 회원 예약만 회원 카드 담당으로 본다. 비회원은 예약 배정 코치만.
     */
    public boolean bookingMatchesOperationalCoachIds(Booking b, Collection<Long> coachIds) {
        if (b == null || coachIds == null || coachIds.isEmpty()) {
            return false;
        }
        HashSet<Long> want = new HashSet<>(coachIds);
        try {
            Coach assigned = b.getCoach();
            if (assigned != null && assigned.getId() != null) {
                return want.contains(assigned.getId());
            }
            Member m = b.getMember();
            if (m != null && m.getCoach() != null && m.getCoach().getId() != null) {
                return want.contains(m.getCoach().getId());
            }
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }
}
