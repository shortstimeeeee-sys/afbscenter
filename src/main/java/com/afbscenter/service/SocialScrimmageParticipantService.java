package com.afbscenter.service;

import com.afbscenter.model.Booking;
import com.afbscenter.model.SocialScrimmageParticipant;
import com.afbscenter.repository.SocialScrimmageParticipantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class SocialScrimmageParticipantService {

    private static final Set<String> POSITIONS = Set.of(
            "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "BENCH");

    private final SocialScrimmageParticipantRepository repository;
    private final OutdoorLessonParticipantService outdoorLessonParticipantService;

    public SocialScrimmageParticipantService(SocialScrimmageParticipantRepository repository,
                                             OutdoorLessonParticipantService outdoorLessonParticipantService) {
        this.repository = repository;
        this.outdoorLessonParticipantService = outdoorLessonParticipantService;
    }

    @Transactional(readOnly = true)
    public List<SocialScrimmageParticipant> list(LocalDate matchDate, Booking.Branch branch) {
        if (matchDate == null) {
            return List.of();
        }
        if (branch != null) {
            List<SocialScrimmageParticipant> byBranch =
                    repository.findByMatchDateAndBranchOrderBySeqNoAscIdAsc(matchDate, branch);
            if (!byBranch.isEmpty()) {
                return byBranch;
            }
        }
        return repository.findByMatchDateOrderBySeqNoAscIdAsc(matchDate);
    }

    /** 조회 시 지난 경기일의 대기 차감을 반영한다. */
    @Transactional
    public List<SocialScrimmageParticipant> listWithPassSync(LocalDate matchDate, Booking.Branch branch) {
        List<SocialScrimmageParticipant> rows = list(matchDate, branch);
        LocalDate today = LocalDate.now();
        List<SocialScrimmageParticipant> out = new ArrayList<>();
        for (SocialScrimmageParticipant row : rows) {
            if (applyPendingPass(row, today)) {
                out.add(repository.save(row));
            } else {
                out.add(row);
            }
        }
        return out;
    }

    @Transactional
    public List<SocialScrimmageParticipant> replace(LocalDate matchDate, Booking.Branch branch,
                                                    List<Map<String, Object>> rows) {
        List<SocialScrimmageParticipant> existing = list(matchDate, branch);
        for (SocialScrimmageParticipant prev : existing) {
            if (prev != null && prev.isCountPassApplied()) {
                outdoorLessonParticipantService.restoreSharedOutdoorCountPassVisit(
                        prev.getName(), prev.getPhone(), prev.getProductId());
            }
        }
        repository.deleteByMatchDate(matchDate);
        repository.flush();
        List<SocialScrimmageParticipant> saved = new ArrayList<>();
        if (rows == null) {
            return saved;
        }
        LocalDate today = LocalDate.now();
        int seq = 1;
        for (Map<String, Object> row : rows) {
            String name = text(row.get("name"));
            if (name.isEmpty()) {
                continue;
            }
            SocialScrimmageParticipant p = new SocialScrimmageParticipant();
            p.setMatchDate(matchDate);
            p.setBranch(branch != null ? branch : Booking.Branch.SAHA);
            p.setSeqNo(seq++);
            p.setName(clip(name, 100));
            p.setTeam(clip(text(row.get("team")), 100));
            p.setPhone(clip(text(row.get("phone")), 20));
            p.setSide(parseSide(row.get("side")));
            p.setHopedPosition(normalizePosition(row.get("hopedPosition")));
            p.setAssignedPosition(normalizePosition(row.get("assignedPosition")));
            p.setMemo(clip(text(row.get("memo")), 500));
            Integer clientAmount = toInt(row.get("depositAmount"));
            boolean clientHasDepositFlag = row.containsKey("depositConfirmed");
            boolean clientDeposit = bool(row.get("depositConfirmed"));
            attachSharedPass(p, matchDate, today);
            if (clientAmount != null) {
                p.setDepositAmount(clientAmount);
            }
            if (clientHasDepositFlag) {
                p.setDepositConfirmed(clientDeposit);
            }
            saved.add(repository.save(p));
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchMembers(String query) {
        return outdoorLessonParticipantService.searchMembersForRoster(query, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> lookupPass(String name, String phone) {
        return outdoorLessonParticipantService.lookupSharedOutdoorCountPass(name, phone);
    }

    private void attachSharedPass(SocialScrimmageParticipant p, LocalDate matchDate, LocalDate today) {
        if (p == null) {
            return;
        }
        Map<String, Object> pass = outdoorLessonParticipantService.attachSharedOutdoorCountPassVisit(
                p.getName(), p.getPhone(), matchDate, today);
        if (pass == null || pass.isEmpty()) {
            p.setProductId(null);
            p.setRemainingCount(null);
            p.setPendingDeductDate(null);
            p.setCountPassApplied(false);
            return;
        }
        Object productId = pass.get("productId");
        if (productId instanceof Number n) {
            p.setProductId(n.longValue());
        } else {
            p.setProductId(null);
        }
        Object rem = pass.get("remainingAtStart") != null ? pass.get("remainingAtStart") : pass.get("remainingCount");
        if (rem instanceof Number n) {
            p.setRemainingCount(n.intValue());
        } else {
            p.setRemainingCount(null);
        }
        p.setCountPassApplied(Boolean.TRUE.equals(pass.get("countPassApplied")));
        if (pass.get("depositAmount") instanceof Number amt) {
            p.setDepositAmount(amt.intValue());
        }
        if (Boolean.TRUE.equals(pass.get("prepaidPass")) || Boolean.TRUE.equals(pass.get("depositConfirmed"))) {
            p.setDepositConfirmed(true);
        }
        Object pending = pass.get("pendingDeductDate");
        if (pending instanceof LocalDate d) {
            p.setPendingDeductDate(d);
        } else if (pending != null && !pending.toString().isBlank()) {
            try {
                p.setPendingDeductDate(LocalDate.parse(pending.toString().trim()));
            } catch (Exception e) {
                p.setPendingDeductDate(matchDate);
            }
        } else if (!p.isCountPassApplied()) {
            p.setPendingDeductDate(matchDate);
        } else {
            p.setPendingDeductDate(null);
        }
        if (text(p.getPhone()).isEmpty() && pass.get("phone") != null) {
            p.setPhone(clip(text(pass.get("phone")), 20));
        }
        if (text(p.getTeam()).isEmpty() && pass.get("team") != null) {
            p.setTeam(clip(text(pass.get("team")), 100));
        }
    }

    private boolean applyPendingPass(SocialScrimmageParticipant row, LocalDate today) {
        if (row == null || row.isCountPassApplied()) {
            return false;
        }
        if (row.getProductId() == null && OutdoorLessonParticipantService.personKey(row.getName(), row.getPhone()) == null) {
            return false;
        }
        boolean changed = outdoorLessonParticipantService.applyPendingSharedOutdoorPass(
                row.getName(),
                row.getPhone(),
                row.getProductId(),
                row.getRemainingCount(),
                row.getPendingDeductDate() != null ? row.getPendingDeductDate() : row.getMatchDate(),
                row.isCountPassApplied(),
                today);
        if (changed) {
            row.setCountPassApplied(true);
            row.setPendingDeductDate(null);
        }
        return changed;
    }

    private static Integer toInt(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number n) {
            return n.intValue();
        }
        String s = raw.toString().trim().replace(",", "");
        if (s.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean bool(Object raw) {
        if (raw instanceof Boolean b) {
            return b;
        }
        if (raw == null) {
            return false;
        }
        String s = raw.toString().trim();
        return "true".equalsIgnoreCase(s) || "1".equals(s) || "Y".equalsIgnoreCase(s);
    }

    private static SocialScrimmageParticipant.Side parseSide(Object raw) {
        String s = text(raw).toUpperCase(Locale.ROOT);
        if ("BLUE".equals(s) || "청".equals(text(raw)) || "청팀".equals(text(raw))) {
            return SocialScrimmageParticipant.Side.BLUE;
        }
        if ("WHITE".equals(s) || "백".equals(text(raw)) || "백팀".equals(text(raw))) {
            return SocialScrimmageParticipant.Side.WHITE;
        }
        return null;
    }

    private static String normalizePosition(Object raw) {
        String s = text(raw).toUpperCase(Locale.ROOT).replace(" ", "");
        if (s.isEmpty()) {
            return null;
        }
        if ("투수".equals(text(raw)) || "PITCHER".equals(s)) return "P";
        if ("포수".equals(text(raw)) || "CATCHER".equals(s)) return "C";
        if ("1루".equals(text(raw)) || "1루수".equals(text(raw))) return "1B";
        if ("2루".equals(text(raw)) || "2루수".equals(text(raw))) return "2B";
        if ("3루".equals(text(raw)) || "3루수".equals(text(raw))) return "3B";
        if ("유격".equals(text(raw)) || "유격수".equals(text(raw))) return "SS";
        if ("좌익".equals(text(raw)) || "좌익수".equals(text(raw))) return "LF";
        if ("중견".equals(text(raw)) || "중견수".equals(text(raw))) return "CF";
        if ("우익".equals(text(raw)) || "우익수".equals(text(raw))) return "RF";
        if ("지명타자".equals(text(raw))) return "DH";
        if ("벤치".equals(text(raw)) || "대기".equals(text(raw))) return "BENCH";
        return POSITIONS.contains(s) ? s : null;
    }

    private static String text(Object raw) {
        return raw == null ? "" : raw.toString().trim();
    }

    private static String clip(String value, int max) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
