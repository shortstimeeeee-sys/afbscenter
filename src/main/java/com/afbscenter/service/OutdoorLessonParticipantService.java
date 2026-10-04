package com.afbscenter.service;

import com.afbscenter.model.Booking;
import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.OutdoorLessonParticipant;
import com.afbscenter.model.Product;
import com.afbscenter.model.SocialScrimmageParticipant;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.OutdoorLessonParticipantRepository;
import com.afbscenter.repository.ProductRepository;
import com.afbscenter.repository.SocialScrimmageParticipantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

@Service
public class OutdoorLessonParticipantService {

    public static final int FIELD_RENTAL_FEE = 300_000;

    private final OutdoorLessonParticipantRepository repository;
    private final ProductRepository productRepository;
    private final MemberRepository memberRepository;
    private final MemberProductRepository memberProductRepository;
    private final SocialScrimmageParticipantRepository socialScrimmageParticipantRepository;

    public OutdoorLessonParticipantService(OutdoorLessonParticipantRepository repository,
                                           ProductRepository productRepository,
                                           MemberRepository memberRepository,
                                           MemberProductRepository memberProductRepository,
                                           SocialScrimmageParticipantRepository socialScrimmageParticipantRepository) {
        this.repository = repository;
        this.productRepository = productRepository;
        this.memberRepository = memberRepository;
        this.memberProductRepository = memberProductRepository;
        this.socialScrimmageParticipantRepository = socialScrimmageParticipantRepository;
    }

    @Transactional(readOnly = true)
    public List<OutdoorLessonParticipant> list(LocalDate lessonDate, Booking.Branch branch) {
        List<OutdoorLessonParticipant> rows = repository.findByLessonDateAndBranchOrderBySeqNoAscIdAsc(lessonDate, branch);
        if (!rows.isEmpty()) {
            return rows;
        }
        // 야외 레슨 명단은 날짜 기준 공유. 사하에 저장한 14일 명단이 연산점 사회인에서도 보여야 한다.
        return repository.findByLessonDateOrderBySeqNoAscIdAsc(lessonDate);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPlans(List<OutdoorLessonParticipant> rows) {
        Map<Long, Product> byId = new LinkedHashMap<>();
        for (Product product : productRepository.findByActiveTrue()) {
            if (isOutdoorLessonPlan(product) && product.getId() != null) {
                byId.put(product.getId(), product);
            }
        }
        if (rows != null) {
            for (OutdoorLessonParticipant row : rows) {
                if (row.getProductId() == null || byId.containsKey(row.getProductId())) {
                    continue;
                }
                productRepository.findById(row.getProductId()).ifPresent(product -> {
                    if (isOutdoorLessonPlan(product)) {
                        byId.put(product.getId(), product);
                    }
                });
            }
        }
        return byId.values().stream()
                .sorted(Comparator
                        .comparing((Product p) -> p.getPrice() == null ? Integer.MAX_VALUE : p.getPrice())
                        .thenComparing(p -> p.getName() == null ? "" : p.getName()))
                .map(OutdoorLessonParticipantService::toPlanMap)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> history() {
        List<OutdoorLessonParticipant> rows = repository.findAllByOrderByLessonDateAscSeqNoAscIdAsc();
        Map<Long, Product> products = new HashMap<>();
        Map<String, Map<String, Object>> members = new LinkedHashMap<>();
        Set<LocalDate> lessonDates = new TreeSet<>();
        for (OutdoorLessonParticipant row : rows) {
            if (row == null) {
                continue;
            }
            String name = text(row.getName());
            if (name.isEmpty()) {
                continue;
            }
            String personKey = historyPersonKey(row.getName(), row.getPhone());
            if (personKey == null) {
                continue;
            }
            Product plan = resolvePlan(row.getProductId(), products);
            LocalDate date = row.getLessonDate();
            String passKey = historyPassKey(plan, date);
            String key = personKey + "#" + passKey;
            Map<String, Object> member = members.get(key);
            if (member == null) {
                member = newMemberHistory(name, row.getTeam(), row.getPhone());
                member.put("productId", plan == null ? null : plan.getId());
                member.put("countPass", isCountPass(plan));
                if (plan != null) {
                    member.put("planName", plan.getName() == null ? "" : plan.getName());
                    if (isCountPass(plan)) {
                        member.put("totalCount", usageCountOf(plan));
                    }
                }
                members.put(key, member);
            } else {
                member.put("name", name);
                if (text(row.getTeam()).length() > 0) {
                    member.put("team", text(row.getTeam()));
                }
                if (text(row.getPhone()).length() > 0) {
                    member.put("phone", formatPhone(normalizePhone(row.getPhone())));
                    member.put("phoneDigits", normalizePhone(row.getPhone()));
                }
            }
            Integer visitAmount = row.getDepositAmount();
            if (isPrepaidCountPass(row)) {
                visitAmount = 0;
            } else if (visitAmount == null && plan != null && plan.getPrice() != null) {
                visitAmount = plan.getPrice();
            }
            Integer passAmount = visitAmount;
            if (isCountPass(plan) && isPrepaidCountPass(row) && plan.getPrice() != null) {
                passAmount = plan.getPrice();
            }
            if (date != null) {
                lessonDates.add(date);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> visits = (List<Map<String, Object>>) member.get("visits");
                @SuppressWarnings("unchecked")
                Set<String> seenDates = (Set<String>) member.get("_dates");
                String ymd = date.toString();
                if (seenDates.add(ymd)) {
                    Map<String, Object> visit = new LinkedHashMap<>();
                    visit.put("lessonDate", ymd);
                    visit.put("attended", row.isAttended());
                    visit.put("depositConfirmed", row.isDepositConfirmed());
                    visit.put("amount", visitAmount);
                    visits.add(visit);
                    member.put("visitCount", visits.size());
                    if (row.isAttended()) {
                        member.put("attendedCount", ((Number) member.get("attendedCount")).intValue() + 1);
                    }
                }
            }
            if (isCountPass(plan)) {
                member.put("remainingCount", remainingToShow(row));
                member.put("remainingAtStart", remainingAtStartToSend(row));
                member.put("totalCount", usageCountOf(plan));
            }
            if ((row.isDepositConfirmed() || isPrepaidCountPass(row))
                    && passAmount != null && passAmount > 0) {
                @SuppressWarnings("unchecked")
                Set<String> paidKeys = (Set<String>) member.get("_paid");
                String payKey = isCountPass(plan)
                        ? "pass:" + (plan.getId() == null ? "x" : plan.getId())
                        : "day:" + (date == null ? "x" : date);
                if (paidKeys.add(payKey)) {
                    long paid = ((Number) member.get("paidAmount")).longValue() + passAmount.longValue();
                    member.put("paidAmount", paid);
                }
            }
        }
        mergeScrimmageVisitsIntoHistory(members, products);
        mergeSamePersonHistory(members);
        List<Map<String, Object>> memberList = new ArrayList<>();
        Set<String> uniquePeople = new HashSet<>();
        long paidTotal = 0;
        int visitTotal = 0;
        for (Map<String, Object> member : members.values()) {
            member.remove("_dates");
            member.remove("_paid");
            paidTotal += ((Number) member.get("paidAmount")).longValue();
            visitTotal += ((Number) member.get("visitCount")).intValue();
            String person = historyPersonKey(text(member.get("name")),
                    text(member.get("phoneDigits")).isEmpty()
                            ? text(member.get("phone"))
                            : text(member.get("phoneDigits")));
            if (person != null) {
                uniquePeople.add(person);
            }
            memberList.add(member);
        }
        memberList.sort(Comparator
                .comparing((Map<String, Object> m) -> String.valueOf(m.getOrDefault("name", "")),
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparing(OutdoorLessonParticipantService::firstVisitDate));
        List<Map<String, Object>> expenses = new ArrayList<>();
        long expenseTotal = 0;
        for (LocalDate date : lessonDates) {
            Map<String, Object> expense = new LinkedHashMap<>();
            expense.put("lessonDate", date.toString());
            expense.put("label", "경기장 대여비");
            expense.put("amount", FIELD_RENTAL_FEE);
            expenses.add(expense);
            expenseTotal += FIELD_RENTAL_FEE;
        }
        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("memberCount", uniquePeople.size());
        totals.put("visitCount", visitTotal);
        totals.put("paidAmount", paidTotal);
        totals.put("expenseAmount", expenseTotal);
        totals.put("netAmount", paidTotal - expenseTotal);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("members", memberList);
        payload.put("expenses", expenses);
        payload.put("totals", totals);
        payload.put("fieldRentalFee", FIELD_RENTAL_FEE);
        payload.put("sharedWithScrimmage", true);
        return payload;
    }

    /** 청백전 참가를 같은 이름+연락처 누적 명단에 합친다 (횟수권 잔여·방문일 공유). */
    private void mergeScrimmageVisitsIntoHistory(Map<String, Map<String, Object>> members,
                                                 Map<Long, Product> products) {
        if (socialScrimmageParticipantRepository == null || members == null) {
            return;
        }
        List<SocialScrimmageParticipant> scrimmageRows =
                socialScrimmageParticipantRepository.findAllByOrderByMatchDateAscSeqNoAscIdAsc();
        if (scrimmageRows == null || scrimmageRows.isEmpty()) {
            return;
        }
        LocalDate today = LocalDate.now();
        for (SocialScrimmageParticipant row : scrimmageRows) {
            if (row == null) {
                continue;
            }
            String name = text(row.getName());
            if (name.isEmpty()) {
                continue;
            }
            String personKey = historyPersonKey(row.getName(), row.getPhone());
            if (personKey == null) {
                continue;
            }
            Long productId = row.getProductId();
            Map<String, Object> shared = lookupSharedOutdoorCountPass(row.getName(), row.getPhone());
            if (productId == null && shared.get("productId") instanceof Number n) {
                productId = n.longValue();
            }
            Product plan = resolvePlan(productId, products);
            LocalDate date = row.getMatchDate();
            String passKey = historyPassKey(plan, date);
            String key = personKey + "#" + passKey;
            Map<String, Object> member = members.get(key);
            if (member == null) {
                member = newMemberHistory(name, row.getTeam(), row.getPhone());
                member.put("productId", plan == null ? null : plan.getId());
                member.put("countPass", isCountPass(plan));
                if (plan != null) {
                    member.put("planName", plan.getName() == null ? "" : plan.getName());
                    if (isCountPass(plan)) {
                        member.put("totalCount", usageCountOf(plan));
                    }
                } else if (shared.get("planName") != null) {
                    member.put("planName", String.valueOf(shared.get("planName")));
                    member.put("countPass", Boolean.TRUE.equals(shared.get("countPass")));
                    if (shared.get("totalCount") instanceof Number tc) {
                        member.put("totalCount", tc.intValue());
                    }
                    if (shared.get("productId") instanceof Number pid) {
                        member.put("productId", pid.longValue());
                    }
                }
                members.put(key, member);
            } else {
                member.put("name", name);
                if (text(row.getTeam()).length() > 0) {
                    member.put("team", text(row.getTeam()));
                }
                if (text(row.getPhone()).length() > 0) {
                    member.put("phone", formatPhone(normalizePhone(row.getPhone())));
                    member.put("phoneDigits", normalizePhone(row.getPhone()));
                }
            }
            if (date != null) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> visits = (List<Map<String, Object>>) member.get("visits");
                @SuppressWarnings("unchecked")
                Set<String> seenDates = (Set<String>) member.get("_dates");
                String ymd = date.toString();
                if (seenDates.add(ymd)) {
                    Map<String, Object> visit = new LinkedHashMap<>();
                    visit.put("lessonDate", ymd);
                    boolean dueOrApplied = row.isCountPassApplied()
                            || (date.isBefore(today));
                    visit.put("attended", dueOrApplied);
                    visit.put("depositConfirmed", row.getProductId() != null || !shared.isEmpty());
                    visit.put("amount", 0);
                    visit.put("source", "SCRIMMAGE");
                    visits.add(visit);
                    member.put("visitCount", visits.size());
                    if (dueOrApplied) {
                        member.put("attendedCount", ((Number) member.get("attendedCount")).intValue() + 1);
                    }
                } else {
                    // 같은 날 야외+청백전이면 청백전 표시만 보강
                    for (Map<String, Object> visit : visits) {
                        if (ymd.equals(String.valueOf(visit.get("lessonDate")))) {
                            visit.put("alsoScrimmage", true);
                            break;
                        }
                    }
                }
            }
            if (isCountPass(plan) || Boolean.TRUE.equals(member.get("countPass"))) {
                if (shared.get("remainingCount") instanceof Number rem) {
                    member.put("remainingCount", rem.intValue());
                }
                if (shared.get("totalCount") instanceof Number tot) {
                    member.put("totalCount", tot.intValue());
                }
                if (shared.get("planName") != null && text(member.get("planName")).isEmpty()) {
                    member.put("planName", String.valueOf(shared.get("planName")));
                }
                member.put("countPass", true);
            }
        }
    }

    private Product resolvePlan(Long productId, Map<Long, Product> cache) {
        if (productId == null) {
            return null;
        }
        if (cache.containsKey(productId)) {
            return cache.get(productId);
        }
        Product plan = findPlan(productId).orElse(null);
        cache.put(productId, plan);
        return plan;
    }

    private static Map<String, Object> newMemberHistory(String name, String team, String phone) {
        Map<String, Object> member = new LinkedHashMap<>();
        member.put("name", name);
        member.put("team", text(team));
        member.put("phone", formatPhone(normalizePhone(phone)));
        member.put("phoneDigits", normalizePhone(phone));
        member.put("planName", "");
        member.put("productId", null);
        member.put("countPass", false);
        member.put("visitCount", 0);
        member.put("attendedCount", 0);
        member.put("paidAmount", 0L);
        member.put("remainingCount", null);
        member.put("remainingAtStart", null);
        member.put("totalCount", null);
        member.put("visits", new ArrayList<Map<String, Object>>());
        member.put("_dates", new LinkedHashSet<String>());
        member.put("_paid", new LinkedHashSet<String>());
        return member;
    }

    static String historyPersonKey(String name, String phone) {
        String n = normalizeName(name);
        String ph = normalizePhone(phone);
        if (n.isEmpty()) {
            return null;
        }
        return ph.isEmpty() ? n : n + "|" + ph;
    }

    static String historyPassKey(Product plan, LocalDate date) {
        String pid = plan == null || plan.getId() == null ? "x" : String.valueOf(plan.getId());
        if (isCountPass(plan)) {
            return "p:" + pid;
        }
        String ymd = date == null ? "x" : date.toString();
        return "s:" + pid + ":" + ymd;
    }

    private static String firstVisitDate(Map<String, Object> member) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> visits = (List<Map<String, Object>>) member.get("visits");
        if (visits == null || visits.isEmpty()) {
            return "";
        }
        Object ymd = visits.get(0).get("lessonDate");
        return ymd == null ? "" : ymd.toString();
    }

    @SuppressWarnings("unchecked")
    private static void mergeSamePersonHistory(Map<String, Map<String, Object>> members) {
        Map<String, List<String>> byPass = new LinkedHashMap<>();
        for (String key : members.keySet()) {
            int hash = key.lastIndexOf('#');
            String personKey = hash < 0 ? key : key.substring(0, hash);
            String passKey = hash < 0 ? "" : key.substring(hash + 1);
            String name = personKey.contains("|") ? personKey.substring(0, personKey.indexOf('|')) : personKey;
            byPass.computeIfAbsent(name + "#" + passKey, ignored -> new ArrayList<>()).add(key);
        }
        for (List<String> keys : byPass.values()) {
            List<String> withPhone = new ArrayList<>();
            List<String> noPhone = new ArrayList<>();
            for (String key : keys) {
                int hash = key.lastIndexOf('#');
                String personKey = hash < 0 ? key : key.substring(0, hash);
                if (personKey.contains("|")) {
                    withPhone.add(key);
                } else {
                    noPhone.add(key);
                }
            }
            if (withPhone.size() == 1 && !noPhone.isEmpty()) {
                Map<String, Object> target = members.get(withPhone.get(0));
                for (String extraKey : noPhone) {
                    mergeMemberHistory(target, members.get(extraKey));
                    members.remove(extraKey);
                }
            }
        }
        fillMissingPhoneFromSameName(members);
    }

    private static void fillMissingPhoneFromSameName(Map<String, Map<String, Object>> members) {
        Map<String, String> phoneByName = new LinkedHashMap<>();
        Map<String, Boolean> uniquePhone = new LinkedHashMap<>();
        for (Map<String, Object> member : members.values()) {
            String name = normalizeName(text(member.get("name")));
            if (name.isEmpty()) {
                continue;
            }
            String phone = normalizePhone(text(member.get("phoneDigits")).isEmpty()
                    ? text(member.get("phone"))
                    : text(member.get("phoneDigits")));
            if (phone.isEmpty()) {
                continue;
            }
            String existing = phoneByName.get(name);
            if (existing == null) {
                phoneByName.put(name, phone);
                uniquePhone.put(name, true);
            } else if (!existing.equals(phone)) {
                uniquePhone.put(name, false);
            }
        }
        for (Map<String, Object> member : members.values()) {
            String name = normalizeName(text(member.get("name")));
            if (!Boolean.TRUE.equals(uniquePhone.get(name))) {
                continue;
            }
            if (normalizePhone(text(member.get("phoneDigits"))).isEmpty()
                    && normalizePhone(text(member.get("phone"))).isEmpty()) {
                String phone = phoneByName.get(name);
                member.put("phone", formatPhone(phone));
                member.put("phoneDigits", phone);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static void mergeMemberHistory(Map<String, Object> target, Map<String, Object> extra) {
        if (target == null || extra == null) {
            return;
        }
        Set<String> dates = (Set<String>) target.get("_dates");
        List<Map<String, Object>> visits = (List<Map<String, Object>>) target.get("visits");
        List<Map<String, Object>> extraVisits = (List<Map<String, Object>>) extra.get("visits");
        if (dates != null && visits != null && extraVisits != null) {
            for (Map<String, Object> visit : extraVisits) {
                Object ymd = visit.get("lessonDate");
                if (ymd != null && dates.add(ymd.toString())) {
                    visits.add(visit);
                }
            }
            visits.sort(Comparator.comparing(v -> String.valueOf(v.getOrDefault("lessonDate", ""))));
            target.put("visitCount", visits.size());
            int attended = 0;
            for (Map<String, Object> visit : visits) {
                if (Boolean.TRUE.equals(visit.get("attended"))) {
                    attended++;
                }
            }
            target.put("attendedCount", attended);
        }
        Set<String> paidKeys = (Set<String>) target.get("_paid");
        Set<String> extraPaid = (Set<String>) extra.get("_paid");
        long targetPaid = ((Number) target.getOrDefault("paidAmount", 0L)).longValue();
        long extraAmount = ((Number) extra.getOrDefault("paidAmount", 0L)).longValue();
        if (paidKeys != null && extraPaid != null && !extraPaid.isEmpty()) {
            boolean added = false;
            for (String payKey : extraPaid) {
                if (paidKeys.add(payKey)) {
                    added = true;
                }
            }
            if (added && extraAmount > 0 && extraAmount != targetPaid) {
                target.put("paidAmount", targetPaid == 0 ? extraAmount : targetPaid + extraAmount);
            }
        } else if (extraAmount > 0) {
            if (targetPaid == 0) {
                target.put("paidAmount", extraAmount);
            } else if (targetPaid != extraAmount) {
                target.put("paidAmount", targetPaid + extraAmount);
            }
        }
        if (text(extra.get("team")).length() > 0 && text(target.get("team")).isEmpty()) {
            target.put("team", extra.get("team"));
        }
        if (extra.get("remainingCount") != null) {
            target.put("remainingCount", extra.get("remainingCount"));
            target.put("totalCount", extra.get("totalCount"));
        }
        if (text(extra.get("planName")).length() > 0) {
            target.put("planName", extra.get("planName"));
        }
    }

    static String normalizePhone(String phone) {
        String d = digitsOnly(phone);
        if (d.startsWith("82") && d.length() >= 12) {
            d = "0" + d.substring(2);
        }
        if (d.length() == 10 && d.startsWith("10")) {
            d = "0" + d;
        }
        return d;
    }

    static String formatPhone(String digits) {
        String d = normalizePhone(digits);
        if (d.length() == 11) {
            return d.substring(0, 3) + "-" + d.substring(3, 7) + "-" + d.substring(7);
        }
        if (d.length() == 10) {
            return d.substring(0, 3) + "-" + d.substring(3, 6) + "-" + d.substring(6);
        }
        return d;
    }

    @Transactional
    public List<OutdoorLessonParticipant> replace(LocalDate lessonDate, Booking.Branch branch,
                                                  List<Map<String, Object>> rows) {
        return replace(lessonDate, branch, rows, null);
    }

    @Transactional
    public List<OutdoorLessonParticipant> replace(LocalDate lessonDate, Booking.Branch branch,
                                                  List<Map<String, Object>> rows, LocalDate previousDate) {
        if (previousDate != null && !previousDate.equals(lessonDate)) {
            repository.deleteByLessonDate(previousDate);
            repository.flush();
        }
        repository.deleteByLessonDate(lessonDate);
        repository.flush();
        List<OutdoorLessonParticipant> saved = new ArrayList<>();
        int seq = 1;
        if (rows == null) {
            return saved;
        }
        for (Map<String, Object> row : rows) {
            String name = text(row.get("name"));
            if (name.isEmpty()) {
                continue;
            }
            OutdoorLessonParticipant p = new OutdoorLessonParticipant();
            p.setLessonDate(lessonDate);
            p.setBranch(branch);
            p.setSeqNo(seq++);
            p.setName(clip(name, 100));
            p.setTeam(clip(text(row.get("team")), 100));
            p.setPhone(clip(text(row.get("phone")), 20));
            boolean teamBooking = bool(row.get("teamBooking"));
            p.setTeamBooking(teamBooking);
            p.setHeadcount(teamBooking ? normalizeHeadcount(row.get("headcount")) : 1);
            p.setDepositConfirmed(bool(row.get("depositConfirmed")));
            p.setAttended(bool(row.get("attended")));
            p.setCarriedFromDate(parseDate(row.get("carriedFromDate")));
            p.setRemainingCount(toInt(row.get("remainingCount")));
            p.setPendingDeductDate(parseDate(row.get("pendingDeductDate")));
            p.setCountPassApplied(bool(row.get("countPassApplied")));
            Long productId = toLong(row.get("productId"));
            if (productId != null) {
                applyPlan(p, productId);
            } else {
                applyMemberOutdoorCountPass(p);
            }
            applyMovedCountPassDeduction(p, previousDate, LocalDate.now());
            refreshUnappliedRemainingFromPass(p);
            applyPrepaidPassAmount(p);
            validatePassUsage(p);
            if (p.isCountPassApplied()) {
                syncMemberPassRemaining(p);
            } else {
                scheduleVisitDeduction(p);
            }
            saved.add(repository.save(p));
        }
        return saved;
    }

    @Transactional
    public OutdoorLessonParticipant carryOver(LocalDate fromDate, LocalDate toDate,
                                              Booking.Branch branch, Map<String, Object> row) {
        if (fromDate == null || toDate == null) {
            throw new IllegalArgumentException("이월할 날짜를 선택해 주세요.");
        }
        if (fromDate.equals(toDate)) {
            throw new IllegalArgumentException("같은 날짜로는 이월할 수 없습니다.");
        }
        if (branch == null) {
            branch = Booking.Branch.SAHA;
        }
        OutdoorLessonParticipant source = null;
        Long id = toLong(row == null ? null : row.get("id"));
        if (id != null) {
            source = repository.findById(id).orElse(null);
            if (source == null) {
                throw new IllegalArgumentException("참가자를 찾을 수 없습니다. 저장 후 다시 시도해 주세요.");
            }
            if (toDate.equals(source.getLessonDate())) {
                throw new IllegalArgumentException("같은 날짜로는 이월할 수 없습니다.");
            }
        }
        OutdoorLessonParticipant created = new OutdoorLessonParticipant();
        created.setLessonDate(toDate);
        created.setBranch(source != null && source.getBranch() != null ? source.getBranch() : branch);
        created.setSeqNo(nextSeq(toDate));
        if (source != null) {
            created.setName(source.getName());
            created.setTeam(source.getTeam());
            created.setPhone(source.getPhone());
            created.setHeadcount(normalizeHeadcount(source.getHeadcount()));
            created.setTeamBooking(source.isTeamBooking());
            created.setProductId(source.getProductId());
            created.setDepositAmount(source.getDepositAmount());
            created.setDepositConfirmed(source.isDepositConfirmed());
            created.setRemainingCount(source.getRemainingCount());
            created.setPendingDeductDate(source.getPendingDeductDate());
            created.setCountPassApplied(false);
        }
        applyRowOverrides(created, row);
        if (text(created.getName()).isEmpty()) {
            throw new IllegalArgumentException("이름을 입력해 주세요.");
        }
        created.setCarriedFromDate(source != null && source.getLessonDate() != null
                ? source.getLessonDate()
                : fromDate);
        applyMovedCountPassDeduction(created, created.getCarriedFromDate(), LocalDate.now());
        OutdoorLessonParticipant saved = repository.save(created);
        if (source != null) {
            LocalDate sourceDate = source.getLessonDate();
            repository.delete(source);
            repository.flush();
            renumberDate(sourceDate);
        }
        return saved;
    }

    public Optional<Product> findPlan(Long productId) {
        if (productId == null) {
            return Optional.empty();
        }
        return productRepository.findById(productId).filter(OutdoorLessonParticipantService::isOutdoorLessonPlan);
    }

    @Transactional
    public List<OutdoorLessonParticipant> applyPendingCountPassDeductions(
            List<OutdoorLessonParticipant> rows, LocalDate today) {
        if (rows == null || rows.isEmpty() || today == null) {
            return rows == null ? List.of() : rows;
        }
        List<OutdoorLessonParticipant> out = new ArrayList<>();
        for (OutdoorLessonParticipant row : rows) {
            if (applyPendingDeduction(row, today)) {
                syncMemberPassRemaining(row);
                out.add(repository.save(row));
            } else {
                out.add(row);
            }
        }
        return out;
    }

    @Transactional
    public List<OutdoorLessonParticipant> refreshUnappliedRemaining(
            List<OutdoorLessonParticipant> rows) {
        if (rows == null || rows.isEmpty()) {
            return rows == null ? List.of() : rows;
        }
        List<OutdoorLessonParticipant> out = new ArrayList<>();
        for (OutdoorLessonParticipant row : rows) {
            if (refreshUnappliedRemainingFromPass(row)) {
                out.add(repository.save(row));
            } else {
                out.add(row);
            }
        }
        return out;
    }

    private boolean refreshUnappliedRemainingFromPass(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return false;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return false;
        }
        if (row.isCountPassApplied()) {
            return applyPrepaidPassAmount(row);
        }
        Integer live = livePassRemaining(row);
        if (live == null) {
            return applyPrepaidPassAmount(row);
        }
        Integer stored = row.getRemainingCount();
        boolean remainingChanged = stored == null || !stored.equals(live);
        if (remainingChanged) {
            row.setRemainingCount(live);
        }
        boolean amountChanged = applyPrepaidPassAmount(row);
        return remainingChanged || amountChanged;
    }

    private Integer livePassRemaining(OutdoorLessonParticipant row) {
        MemberProduct pass = findPassFor(row);
        if (pass == null) {
            return null;
        }
        return remainingOf(pass);
    }

    public boolean isPrepaidCountPass(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return false;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return false;
        }
        if (remainingAtStart(row, plan) < usageCountOf(plan)) {
            return true;
        }
        return hadPriorCountPassVisit(row);
    }

    private boolean hadPriorCountPassVisit(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null || row.getLessonDate() == null || repository == null) {
            return false;
        }
        List<OutdoorLessonParticipant> prior = repository.findByProductIdAndLessonDateBefore(
                row.getProductId(), row.getLessonDate());
        if (prior == null || prior.isEmpty()) {
            return false;
        }
        String key = personKey(row.getName(), row.getPhone());
        String nameNorm = normalizeName(row.getName());
        for (OutdoorLessonParticipant previous : prior) {
            if (previous == null) {
                continue;
            }
            if (key != null && key.equals(personKey(previous.getName(), previous.getPhone()))) {
                return true;
            }
            if (key == null && !nameNorm.isEmpty() && nameNorm.equals(normalizeName(previous.getName()))) {
                return true;
            }
        }
        return false;
    }

    private boolean applyPrepaidPassAmount(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return false;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return false;
        }
        Integer current = row.getDepositAmount();
        if (isPrepaidCountPass(row)) {
            if (current != null && current == 0) {
                return false;
            }
            row.setDepositAmount(0);
            return true;
        }
        Integer price = plan.getPrice();
        if (price == null) {
            return false;
        }
        if (current != null && current.equals(price)) {
            return false;
        }
        row.setDepositAmount(price);
        return true;
    }

    @Transactional(readOnly = true)
    public List<OutdoorLessonParticipant> suggestCountPassCarryOver(
            LocalDate lessonDate, Booking.Branch branch, LocalDate today) {
        if (lessonDate == null) {
            return List.of();
        }
        if (today == null) {
            today = LocalDate.now();
        }
        Optional<LocalDate> prevDate = repository.findLatestLessonDateBefore(lessonDate);
        if (prevDate.isEmpty() || !prevDate.get().isBefore(today)) {
            return List.of();
        }
        LocalDate previous = prevDate.get();
        List<OutdoorLessonParticipant> previousRows = repository.findByLessonDateOrderBySeqNoAscIdAsc(previous);
        if (previousRows.isEmpty()) {
            return List.of();
        }
        if (branch == null) {
            branch = Booking.Branch.SAHA;
        }
        Set<String> seen = new HashSet<>();
        List<OutdoorLessonParticipant> suggested = new ArrayList<>();
        int seq = 1;
        for (OutdoorLessonParticipant source : previousRows) {
            Product plan = source.getProductId() == null ? null : findPlan(source.getProductId()).orElse(null);
            if (!isCountPass(plan)) {
                continue;
            }
            String key = personKey(source.getName(), source.getPhone());
            if (key == null || !seen.add(key)) {
                continue;
            }
            int prevRemaining = remainingAtStart(source, plan);
            int nextRemaining = Math.max(0, prevRemaining - sessionUsage(source));
            if (nextRemaining <= 0) {
                continue;
            }
            OutdoorLessonParticipant copy = new OutdoorLessonParticipant();
            copy.setLessonDate(lessonDate);
            copy.setBranch(source.getBranch() != null ? source.getBranch() : branch);
            copy.setSeqNo(seq++);
            copy.setName(source.getName());
            copy.setTeam(source.getTeam());
            copy.setPhone(source.getPhone());
            copy.setProductId(source.getProductId());
            copy.setDepositAmount(0);
            copy.setDepositConfirmed(source.isDepositConfirmed());
            copy.setAttended(false);
            copy.setRemainingCount(nextRemaining);
            copy.setPendingDeductDate(null);
            copy.setCountPassApplied(false);
            copy.setHeadcount(source.getHeadcount());
            copy.setTeamBooking(source.isTeamBooking());
            copy.setCarriedFromDate(previous);
            suggested.add(copy);
        }
        return suggested;
    }

    public Integer remainingToShow(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return null;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return null;
        }
        int start = remainingAtStart(row, plan);
        if (row.isCountPassApplied()) {
            return Math.max(0, start - sessionUsage(row));
        }
        Integer live = livePassRemaining(row);
        return live != null ? live : start;
    }

    public Integer remainingAtStartToSend(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return null;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return null;
        }
        if (row.isCountPassApplied()) {
            return remainingAtStart(row, plan);
        }
        Integer live = livePassRemaining(row);
        return live != null ? live : remainingAtStart(row, plan);
    }

    public Integer totalCountToShow(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return null;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return null;
        }
        return usageCountOf(plan);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> lookupMemberCountPass(String name, String phone) {
        return lookupMemberCountPass(name, phone, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> lookupMemberCountPass(String name, String phone, String team) {
        return lookupMemberCountPass(name, phone, team, false);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> lookupMemberCountPass(String name, String phone, String team, boolean teamBooking) {
        return lookupMemberCountPass(name, phone, team, teamBooking, null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> lookupMemberCountPass(String name, String phone, String team, boolean teamBooking,
                                                     LocalDate lessonDate) {
        OutdoorLessonParticipant probe = new OutdoorLessonParticipant();
        probe.setName(clip(text(name), 100));
        probe.setPhone(clip(text(phone), 20));
        probe.setTeam(clip(text(team), 100));
        probe.setTeamBooking(teamBooking);
        probe.setLessonDate(lessonDate);
        if (!applyMemberOutdoorCountPass(probe)) {
            return Map.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", probe.getName() == null ? "" : probe.getName());
        out.put("phone", probe.getPhone() == null ? "" : probe.getPhone());
        out.put("team", probe.getTeam() == null ? "" : probe.getTeam());
        out.put("productId", probe.getProductId());
        out.put("remainingCount", probe.getRemainingCount());
        out.put("totalCount", totalCountToShow(probe));
        out.put("depositConfirmed", probe.isDepositConfirmed());
        out.put("depositAmount", probe.getDepositAmount() == null ? 0 : probe.getDepositAmount());
        out.put("prepaidPass", isPrepaidCountPass(probe));
        Product plan = probe.getProductId() == null ? null : findPlan(probe.getProductId()).orElse(null);
        out.put("teamPackage", isTeamPackage(plan));
        out.put("planName", plan == null || plan.getName() == null ? "" : plan.getName());
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchMembersForRoster(String query) {
        return searchMembersForRoster(query, null);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchMembersForRoster(String query, LocalDate lessonDate) {
        String q = text(query);
        if (q.length() < 1 || memberRepository == null) {
            return List.of();
        }
        LinkedHashMap<Long, Member> byId = new LinkedHashMap<>();
        addMembers(byId, memberRepository.findByNameContaining(q));
        if (q.length() >= 2) {
            addMembers(byId, memberRepository.findBySchoolContainingIgnoreCase(q));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Member member : byId.values()) {
            if (out.size() >= 12) {
                break;
            }
            Map<String, Object> item = toRosterMemberMap(member, lessonDate);
            if (item != null) {
                out.add(item);
            }
        }
        return out;
    }

    private static void addMembers(Map<Long, Member> byId, List<Member> members) {
        if (members == null) {
            return;
        }
        for (Member member : members) {
            if (member == null || member.getId() == null) {
                continue;
            }
            if (member.getStatus() == Member.MemberStatus.PENDING_APPROVAL) {
                continue;
            }
            byId.putIfAbsent(member.getId(), member);
        }
    }

    private Map<String, Object> toRosterMemberMap(Member member, LocalDate lessonDate) {
        if (member == null) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("memberId", member.getId());
        item.put("name", member.getName() == null ? "" : member.getName());
        item.put("phone", member.getPhoneNumber() == null ? "" : member.getPhoneNumber());
        item.put("team", member.getSchool() == null ? "" : member.getSchool());
        MemberProduct pass = findOutdoorPass(member, member.getSchool());
        if (pass != null && pass.getProduct() != null && pass.getProduct().getId() != null) {
            Product product = pass.getProduct();
            OutdoorLessonParticipant probe = new OutdoorLessonParticipant();
            probe.setName(member.getName());
            probe.setPhone(member.getPhoneNumber());
            probe.setTeam(member.getSchool());
            probe.setLessonDate(lessonDate);
            probe.setProductId(product.getId());
            probe.setRemainingCount(remainingOf(pass));
            boolean prepaid = isPrepaidCountPass(probe);
            item.put("productId", product.getId());
            item.put("planName", product.getName() == null ? "" : product.getName());
            item.put("remainingCount", remainingOf(pass));
            item.put("totalCount", totalOf(pass));
            item.put("teamPackage", isTeamPackage(product));
            item.put("depositConfirmed", true);
            item.put("depositAmount", prepaid ? 0 : (product.getPrice() == null ? 0 : product.getPrice()));
            item.put("prepaidPass", prepaid);
        } else {
            item.put("productId", null);
            item.put("planName", "");
            item.put("teamPackage", false);
        }
        return item;
    }

    private boolean applyMemberOutdoorCountPass(OutdoorLessonParticipant participant) {
        if (participant == null || memberRepository == null || memberProductRepository == null) {
            return false;
        }
        Member member = findMemberByNameAndPhone(participant.getName(), participant.getPhone());
        if (member == null) {
            member = findMemberByName(participant.getName());
        }
        MemberProduct pass = participant.isTeamBooking()
                ? findOutdoorPass(member, participant.getTeam())
                : findOutdoorCountPass(member);
        if (pass == null || pass.getProduct() == null || pass.getProduct().getId() == null) {
            return false;
        }
        if (member == null && pass.getMember() != null) {
            member = pass.getMember();
        }
        Product product = pass.getProduct();
        applyPlan(participant, product.getId());
        participant.setRemainingCount(Math.max(0, remainingOf(pass)));
        applyPrepaidPassAmount(participant);
        participant.setDepositConfirmed(true);
        if (member != null) {
            if (text(participant.getPhone()).isEmpty() && text(member.getPhoneNumber()).length() > 0) {
                participant.setPhone(clip(member.getPhoneNumber(), 20));
            }
            if (text(participant.getTeam()).isEmpty() && text(member.getSchool()).length() > 0) {
                participant.setTeam(clip(member.getSchool(), 100));
            }
            if (text(participant.getName()).isEmpty() && text(member.getName()).length() > 0) {
                participant.setName(clip(member.getName(), 100));
            }
        }
        if (isTeamPackage(product) && text(participant.getName()).isEmpty() && text(participant.getTeam()).length() > 0) {
            participant.setName(clip(participant.getTeam(), 100));
        }
        return participant.getProductId() != null;
    }

    private void syncMemberPassRemaining(OutdoorLessonParticipant participant) {
        if (participant == null || memberProductRepository == null || !participant.isCountPassApplied()) {
            return;
        }
        Product plan = participant.getProductId() == null ? null : findPlan(participant.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return;
        }
        MemberProduct pass = findPassFor(participant);
        if (pass == null) {
            return;
        }
        int start = remainingAtStart(participant, plan);
        int shown = Math.max(0, start - sessionUsage(participant));
        pass.setRemainingCount(shown);
        if (shown <= 0) {
            pass.setStatus(MemberProduct.Status.USED_UP);
            if (pass.getEndedAt() == null) {
                pass.setEndedAt(java.time.LocalDateTime.now());
            }
        } else if (pass.getStatus() == MemberProduct.Status.USED_UP) {
            pass.setStatus(MemberProduct.Status.ACTIVE);
            pass.setEndedAt(null);
        }
        memberProductRepository.save(pass);
    }

    private void restoreMemberPassRemaining(OutdoorLessonParticipant participant) {
        if (participant == null || memberProductRepository == null) {
            return;
        }
        Product plan = participant.getProductId() == null ? null : findPlan(participant.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return;
        }
        MemberProduct pass = findPassFor(participant);
        if (pass == null) {
            return;
        }
        int start = remainingAtStart(participant, plan);
        pass.setRemainingCount(Math.max(0, start));
        if (start > 0) {
            pass.setStatus(MemberProduct.Status.ACTIVE);
            pass.setEndedAt(null);
        }
        memberProductRepository.save(pass);
    }

    private MemberProduct findPassFor(OutdoorLessonParticipant participant) {
        Member member = findMemberByNameAndPhone(participant.getName(), participant.getPhone());
        if (member == null) {
            member = findMemberByName(participant.getName());
        }
        return findPassMatchingProduct(member, participant.getProductId(), participant.getTeam());
    }

    private MemberProduct findPassMatchingProduct(Member member, Long productId, String teamName) {
        if (productId != null && member != null && member.getId() != null) {
            List<MemberProduct> passes = memberProductRepository.findByMemberIdWithProduct(member.getId());
            if (passes != null) {
                for (MemberProduct mp : passes) {
                    if (mp == null || mp.getDeletedAt() != null || mp.getStatus() != MemberProduct.Status.ACTIVE) {
                        continue;
                    }
                    if (mp.getProduct() != null && productId.equals(mp.getProduct().getId())) {
                        return mp;
                    }
                }
            }
        }
        MemberProduct teamPass = findTeamPassBySchool(teamName);
        if (teamPass != null && teamPass.getProduct() != null
                && (productId == null || productId.equals(teamPass.getProduct().getId()))) {
            return teamPass;
        }
        return findOutdoorPass(member, teamName);
    }

    private Member findMemberByNameAndPhone(String name, String phone) {
        String key = personKey(name, phone);
        if (key == null) {
            return null;
        }
        int sep = key.indexOf('|');
        String nameNorm = key.substring(0, sep);
        String phoneDigits = key.substring(sep + 1);
        List<Member> candidates = memberRepository.findByName(text(name));
        if (candidates == null || candidates.isEmpty()) {
            candidates = memberRepository.findByNameContaining(text(name));
        }
        Member fallback = null;
        for (Member member : candidates) {
            if (member == null || member.getStatus() == Member.MemberStatus.PENDING_APPROVAL) {
                continue;
            }
            if (!nameNorm.equals(normalizeName(member.getName()))) {
                continue;
            }
            if (!phoneDigits.equals(digitsOnly(member.getPhoneNumber()))) {
                continue;
            }
            if (findOutdoorPass(member, member.getSchool()) != null) {
                return member;
            }
            if (fallback == null) {
                fallback = member;
            }
        }
        return fallback;
    }

    private Member findMemberByName(String name) {
        String nameNorm = normalizeName(name);
        if (nameNorm.isEmpty()) {
            return null;
        }
        List<Member> candidates = memberRepository.findByName(text(name));
        if (candidates == null || candidates.isEmpty()) {
            candidates = memberRepository.findByNameContaining(text(name));
        }
        Member fallback = null;
        for (Member member : candidates) {
            if (member == null || member.getStatus() == Member.MemberStatus.PENDING_APPROVAL) {
                continue;
            }
            if (!nameNorm.equals(normalizeName(member.getName()))) {
                continue;
            }
            if (findOutdoorPass(member, member.getSchool()) != null) {
                return member;
            }
            if (fallback == null) {
                fallback = member;
            }
        }
        return fallback;
    }

    private MemberProduct findOutdoorPass(Member member, String teamName) {
        MemberProduct teamPass = member == null ? null : findActiveTeamPass(member);
        if (teamPass == null) {
            teamPass = findTeamPassBySchool(teamName);
        }
        if (teamPass != null) {
            return teamPass;
        }
        MemberProduct countPass = findOutdoorCountPass(member);
        if (countPass != null) {
            return countPass;
        }
        return findCountPassBySchool(teamName);
    }

    private MemberProduct findActiveTeamPass(Member member) {
        if (member == null || member.getId() == null || memberProductRepository == null) {
            return null;
        }
        return pickBestRemaining(memberProductRepository.findByMemberIdWithProduct(member.getId()), true);
    }

    private MemberProduct findTeamPassBySchool(String teamName) {
        String key = normalizeName(teamName);
        if (key.isEmpty() || memberProductRepository == null) {
            return null;
        }
        List<MemberProduct> passes = memberProductRepository.findActiveTeamPackagesWithMember();
        if (passes == null || passes.isEmpty()) {
            return null;
        }
        MemberProduct best = null;
        int bestRemaining = Integer.MAX_VALUE;
        for (MemberProduct mp : passes) {
            if (mp == null || mp.getDeletedAt() != null || mp.getStatus() != MemberProduct.Status.ACTIVE) {
                continue;
            }
            Member owner = mp.getMember();
            if (owner == null || !key.equals(normalizeName(owner.getSchool()))) {
                continue;
            }
            Product product = mp.getProduct();
            if (!isTeamPackage(product)) {
                continue;
            }
            int remaining = remainingOf(mp);
            if (remaining <= 0) {
                continue;
            }
            if (remaining < bestRemaining) {
                bestRemaining = remaining;
                best = mp;
            }
        }
        return best;
    }

    private MemberProduct findCountPassBySchool(String teamName) {
        String key = normalizeName(teamName);
        if (key.isEmpty() || memberRepository == null) {
            return null;
        }
        List<Member> members = memberRepository.findBySchoolContainingIgnoreCase(teamName);
        if (members == null || members.isEmpty()) {
            return null;
        }
        MemberProduct best = null;
        int bestRemaining = Integer.MAX_VALUE;
        for (Member member : members) {
            if (member == null || member.getStatus() == Member.MemberStatus.PENDING_APPROVAL) {
                continue;
            }
            if (!key.equals(normalizeName(member.getSchool()))) {
                continue;
            }
            MemberProduct pass = findOutdoorCountPass(member);
            if (pass == null) {
                continue;
            }
            int remaining = remainingOf(pass);
            if (remaining <= 0) {
                continue;
            }
            if (remaining < bestRemaining) {
                bestRemaining = remaining;
                best = pass;
            }
        }
        return best;
    }

    private MemberProduct findOutdoorCountPass(Member member) {
        if (member == null || member.getId() == null) {
            return null;
        }
        List<MemberProduct> passes = memberProductRepository.findByMemberIdWithProduct(member.getId());
        MemberProduct best = null;
        int bestRemaining = Integer.MAX_VALUE;
        for (MemberProduct mp : passes) {
            if (mp == null || mp.getDeletedAt() != null || mp.getStatus() != MemberProduct.Status.ACTIVE) {
                continue;
            }
            Product product = mp.getProduct();
            if (isTeamPackage(product) || !isCountPass(product)) {
                continue;
            }
            int remaining = mp.getRemainingCount() != null ? mp.getRemainingCount() : usageCountOf(product);
            if (remaining <= 0) {
                continue;
            }
            if (remaining < bestRemaining) {
                bestRemaining = remaining;
                best = mp;
            }
        }
        return best;
    }

    private static MemberProduct pickBestRemaining(List<MemberProduct> passes, boolean teamPackage) {
        if (passes == null || passes.isEmpty()) {
            return null;
        }
        MemberProduct best = null;
        int bestRemaining = Integer.MAX_VALUE;
        for (MemberProduct mp : passes) {
            if (mp == null || mp.getDeletedAt() != null || mp.getStatus() != MemberProduct.Status.ACTIVE) {
                continue;
            }
            Product product = mp.getProduct();
            if (teamPackage) {
                if (!isTeamPackage(product)) {
                    continue;
                }
            } else if (isTeamPackage(product) || !isCountPass(product)) {
                continue;
            }
            int remaining = remainingOf(mp);
            if (remaining <= 0) {
                continue;
            }
            if (remaining < bestRemaining) {
                bestRemaining = remaining;
                best = mp;
            }
        }
        return best;
    }

    private static int remainingOf(MemberProduct pass) {
        if (pass == null) {
            return 0;
        }
        if (pass.getRemainingCount() != null) {
            return Math.max(0, pass.getRemainingCount());
        }
        return usageCountOf(pass.getProduct());
    }

    private static int totalOf(MemberProduct pass) {
        if (pass == null) {
            return 0;
        }
        if (pass.getTotalCount() != null && pass.getTotalCount() > 0) {
            return pass.getTotalCount();
        }
        return usageCountOf(pass.getProduct());
    }

    private static Integer normalizeHeadcount(Object raw) {
        Integer n = toInt(raw);
        if (n == null || n < 1) {
            return 1;
        }
        return Math.min(n, 99);
    }

    private static String normalizeName(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", "");
    }

    private static String digitsOnly(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    private void applyRowOverrides(OutdoorLessonParticipant participant, Map<String, Object> row) {
        if (row == null) {
            return;
        }
        String name = text(row.get("name"));
        if (!name.isEmpty()) {
            participant.setName(clip(name, 100));
        }
        if (row.containsKey("team")) {
            participant.setTeam(clip(text(row.get("team")), 100));
        }
        if (row.containsKey("phone")) {
            participant.setPhone(clip(text(row.get("phone")), 20));
        }
        if (row.containsKey("headcount")) {
            participant.setHeadcount(normalizeHeadcount(row.get("headcount")));
        }
        if (row.containsKey("teamBooking")) {
            participant.setTeamBooking(bool(row.get("teamBooking")));
        }
        if (!participant.isTeamBooking()) {
            participant.setHeadcount(1);
        }
        if (row.containsKey("depositConfirmed")) {
            participant.setDepositConfirmed(bool(row.get("depositConfirmed")));
        }
        if (row.containsKey("attended")) {
            participant.setAttended(bool(row.get("attended")));
        }
        if (row.containsKey("productId")) {
            applyPlan(participant, row.get("productId"));
        }
        if (row.containsKey("remainingCount")) {
            participant.setRemainingCount(toInt(row.get("remainingCount")));
        }
        if (row.containsKey("pendingDeductDate")) {
            participant.setPendingDeductDate(parseDate(row.get("pendingDeductDate")));
        }
        if (row.containsKey("countPassApplied")) {
            participant.setCountPassApplied(bool(row.get("countPassApplied")));
        }
    }

    @Transactional
    public OutdoorLessonParticipant markAttendance(Long id, boolean attended) {
        if (id == null) {
            throw new IllegalArgumentException("참가자를 찾을 수 없습니다.");
        }
        OutdoorLessonParticipant participant = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("참가자를 찾을 수 없습니다. 명단을 저장한 뒤 다시 시도해 주세요."));
        boolean wasAttended = participant.isAttended();
        participant.setAttended(attended);
        LocalDate today = LocalDate.now();
        if (attended && !wasAttended) {
            applyVisitDeductionIfDue(participant, today, true);
        } else if (!attended && wasAttended) {
            undoVisitDeductionIfSameDay(participant, today);
        }
        return repository.save(participant);
    }

    private int nextSeq(LocalDate lessonDate) {
        List<OutdoorLessonParticipant> dest = repository.findByLessonDateOrderBySeqNoAscIdAsc(lessonDate);
        int next = 1;
        for (OutdoorLessonParticipant existing : dest) {
            if (existing.getSeqNo() != null && existing.getSeqNo() >= next) {
                next = existing.getSeqNo() + 1;
            }
        }
        return next;
    }

    private void renumberDate(LocalDate lessonDate) {
        if (lessonDate == null) {
            return;
        }
        List<OutdoorLessonParticipant> remaining = repository.findByLessonDateOrderBySeqNoAscIdAsc(lessonDate);
        int seq = 1;
        for (OutdoorLessonParticipant p : remaining) {
            if (p.getSeqNo() == null || p.getSeqNo() != seq) {
                p.setSeqNo(seq);
                repository.save(p);
            }
            seq++;
        }
    }

    private void applyPlan(OutdoorLessonParticipant participant, Object productIdRaw) {
        Long productId = toLong(productIdRaw);
        if (productId == null) {
            participant.setProductId(null);
            participant.setDepositAmount(null);
            participant.setRemainingCount(null);
            participant.setPendingDeductDate(null);
            return;
        }
        findPlan(productId).ifPresent(product -> {
            participant.setProductId(product.getId());
            participant.setDepositAmount(product.getPrice());
            if (isCountPass(product)) {
                if (participant.getRemainingCount() == null) {
                    participant.setRemainingCount(usageCountOf(product));
                    participant.setPendingDeductDate(null);
                }
            } else {
                participant.setRemainingCount(null);
                participant.setPendingDeductDate(null);
            }
        });
    }

    private void applyMovedCountPassDeduction(OutdoorLessonParticipant participant,
                                              LocalDate previousDate, LocalDate today) {
        if (participant == null || previousDate == null || today == null) {
            return;
        }
        Product plan = participant.getProductId() == null ? null : findPlan(participant.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            participant.setRemainingCount(null);
            participant.setPendingDeductDate(null);
            return;
        }
        int remaining = remainingAtStart(participant, plan);
        if (previousDate.isBefore(today)) {
            participant.setRemainingCount(Math.max(0, remaining - sessionUsage(participant)));
            participant.setPendingDeductDate(null);
        } else {
            participant.setRemainingCount(remaining);
            participant.setPendingDeductDate(previousDate);
        }
        if (participant.getCarriedFromDate() == null) {
            participant.setCarriedFromDate(previousDate);
        }
    }

    private boolean applyPendingDeduction(OutdoorLessonParticipant row, LocalDate today) {
        return applyVisitDeductionIfDue(row, today, false);
    }

    private void scheduleVisitDeduction(OutdoorLessonParticipant row) {
        if (row == null || row.isCountPassApplied()) {
            return;
        }
        Product plan = row.getProductId() == null ? null : findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return;
        }
        if (row.getPendingDeductDate() == null) {
            row.setPendingDeductDate(row.getLessonDate());
        }
    }

    private void validatePassUsage(OutdoorLessonParticipant row) {
        if (row == null || row.getProductId() == null) {
            return;
        }
        Product plan = findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            return;
        }
        int usage = sessionUsage(row);
        int remaining = remainingAtStart(row, plan);
        if (row.getRemainingCount() == null) {
            MemberProduct pass = findPassFor(row);
            if (pass != null) {
                remaining = remainingOf(pass);
            }
        }
        if (usage > remaining) {
            String who = row.isTeamBooking() && text(row.getTeam()).length() > 0
                    ? text(row.getTeam())
                    : text(row.getName());
            if (who.isEmpty()) {
                who = "이 예약";
            }
            throw new IllegalArgumentException(
                    who + " 잔여 " + remaining + "회인데 인원이 " + usage + "명입니다. 잔여 횟수를 넘을 수 없습니다.");
        }
    }

    private boolean applyVisitDeductionIfDue(OutdoorLessonParticipant row, LocalDate today, boolean fromAttendance) {
        if (row == null || today == null || row.isCountPassApplied()) {
            return false;
        }
        Product plan = row.getProductId() == null ? null : findPlan(row.getProductId()).orElse(null);
        if (!isCountPass(plan)) {
            if (row.getPendingDeductDate() != null) {
                row.setPendingDeductDate(null);
                return true;
            }
            return false;
        }
        LocalDate lessonDate = row.getLessonDate();
        boolean pendingDue = row.getPendingDeductDate() != null && row.getPendingDeductDate().isBefore(today);
        boolean attendedNow = fromAttendance && lessonDate != null && !lessonDate.isAfter(today);
        if (!pendingDue && !attendedNow) {
            return false;
        }
        row.setCountPassApplied(true);
        row.setPendingDeductDate(null);
        syncMemberPassRemaining(row);
        return true;
    }

    private void undoVisitDeductionIfSameDay(OutdoorLessonParticipant row, LocalDate today) {
        if (row == null || today == null || !row.isCountPassApplied()) {
            return;
        }
        LocalDate lessonDate = row.getLessonDate();
        if (lessonDate == null || lessonDate.isBefore(today)) {
            return;
        }
        row.setCountPassApplied(false);
        row.setPendingDeductDate(lessonDate);
        restoreMemberPassRemaining(row);
    }

    static int sessionUsage(OutdoorLessonParticipant row) {
        if (row != null && row.isTeamBooking()) {
            Integer n = row.getHeadcount();
            if (n != null && n > 1) {
                return Math.min(99, n);
            }
            return 1;
        }
        return 1;
    }

    private static int remainingAtStart(OutdoorLessonParticipant row, Product plan) {
        if (row.getRemainingCount() != null) {
            return row.getRemainingCount();
        }
        return usageCountOf(plan);
    }

    static boolean isCountPass(Product product) {
        if (!isOutdoorLessonPlan(product)) {
            return false;
        }
        if (isTeamPackage(product) || product.getType() == Product.ProductType.COUNT_PASS) {
            return true;
        }
        if (product.getUsageCount() != null && product.getUsageCount() > 1) {
            return true;
        }
        String name = product.getName();
        return name != null && name.contains("10회");
    }

    static int usageCountOf(Product product) {
        if (product != null && product.getUsageCount() != null && product.getUsageCount() > 0) {
            return product.getUsageCount();
        }
        if (product != null && product.getName() != null && product.getName().contains("10회")) {
            return 10;
        }
        return 10;
    }

    static String personKey(String name, String phone) {
        String n = name == null ? "" : name.trim().replaceAll("\\s+", "");
        String ph = phone == null ? "" : phone.replaceAll("\\D", "");
        if (n.isEmpty() || ph.isEmpty()) {
            return null;
        }
        return n + "|" + ph;
    }

    private static boolean isOutdoorLessonPlan(Product product) {
        if (product == null) {
            return false;
        }
        return product.getCategory() == Product.ProductCategory.OUTDOOR_LESSON || isTeamPackage(product);
    }

    static boolean isTeamPackage(Product product) {
        return product != null && product.getType() == Product.ProductType.TEAM_PACKAGE;
    }

    private static Map<String, Object> toPlanMap(Product product) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", product.getId());
        map.put("name", product.getName() == null ? "" : product.getName());
        map.put("price", product.getPrice() == null ? 0 : product.getPrice());
        map.put("type", product.getType() != null ? product.getType().name() : null);
        map.put("usageCount", usageCountOf(product));
        map.put("countPass", isCountPass(product));
        map.put("teamPackage", isTeamPackage(product));
        return map;
    }

    private static String text(Object raw) {
        return raw == null ? "" : raw.toString().trim();
    }

    private static String clip(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static boolean bool(Object raw) {
        if (raw instanceof Boolean) {
            return (Boolean) raw;
        }
        if (raw == null) {
            return false;
        }
        String s = raw.toString().trim();
        return "true".equalsIgnoreCase(s) || "1".equals(s) || "Y".equalsIgnoreCase(s);
    }

    private static LocalDate parseDate(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof LocalDate date) {
            return date;
        }
        String s = raw.toString().trim();
        if (s.isEmpty() || "null".equalsIgnoreCase(s)) {
            return null;
        }
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer toInt(Object raw) {
        Long n = toLong(raw);
        return n == null ? null : n.intValue();
    }

    private static Long toLong(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number number) {
            return number.longValue();
        }
        String s = raw.toString().trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 청백전 등 공유 방문: 이름+연락처가 모두 일치할 때만 야외 레슨 횟수권 조회.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> lookupSharedOutdoorCountPass(String name, String phone) {
        if (personKey(name, phone) == null) {
            return Map.of();
        }
        Member member = findMemberByNameAndPhone(name, phone);
        if (member == null) {
            return Map.of();
        }
        MemberProduct pass = findOutdoorCountPass(member);
        if (pass == null || pass.getProduct() == null || pass.getProduct().getId() == null) {
            return Map.of();
        }
        Product product = pass.getProduct();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", member.getName() == null ? text(name) : member.getName());
        out.put("phone", member.getPhoneNumber() == null ? text(phone) : member.getPhoneNumber());
        out.put("team", member.getSchool() == null ? "" : member.getSchool());
        out.put("productId", product.getId());
        out.put("planName", product.getName() == null ? "" : product.getName());
        out.put("remainingCount", remainingOf(pass));
        out.put("totalCount", totalOf(pass));
        out.put("countPass", true);
        OutdoorLessonParticipant probe = new OutdoorLessonParticipant();
        probe.setName(member.getName());
        probe.setPhone(member.getPhoneNumber());
        probe.setProductId(product.getId());
        probe.setRemainingCount(remainingOf(pass));
        boolean prepaid = isPrepaidCountPass(probe);
        out.put("prepaidPass", prepaid);
        out.put("depositConfirmed", true);
        out.put("depositAmount", prepaid ? 0 : (product.getPrice() == null ? 0 : product.getPrice()));
        return out;
    }

    @Transactional
    public void restoreSharedOutdoorCountPassVisit(String name, String phone, Long productId) {
        MemberProduct pass = findSharedOutdoorPass(name, phone, productId);
        if (pass == null) {
            return;
        }
        int rem = remainingOf(pass) + 1;
        pass.setRemainingCount(rem);
        if (rem > 0) {
            pass.setStatus(MemberProduct.Status.ACTIVE);
            pass.setEndedAt(null);
        }
        memberProductRepository.save(pass);
    }

    /**
     * 청백전 명단 저장용: 이름+전화 일치 시 횟수권 연결.
     * visitDate &lt; today 이면 즉시 1회 차감, 아니면 대기(날짜 지난 뒤 조회 시 차감).
     */
    @Transactional
    public Map<String, Object> attachSharedOutdoorCountPassVisit(String name, String phone,
                                                                LocalDate visitDate, LocalDate today) {
        Map<String, Object> lookup = lookupSharedOutdoorCountPass(name, phone);
        if (lookup.isEmpty()) {
            return Map.of();
        }
        int live = ((Number) lookup.get("remainingCount")).intValue();
        Map<String, Object> out = new LinkedHashMap<>(lookup);
        out.put("remainingAtStart", live);
        boolean due = visitDate != null && today != null && visitDate.isBefore(today);
        if (due) {
            if (live <= 0) {
                String who = text(name).isEmpty() ? "참가자" : text(name);
                throw new IllegalArgumentException(who + " 야외 레슨 횟수권 잔여가 없습니다.");
            }
            MemberProduct pass = findSharedOutdoorPass(name, phone, toLong(lookup.get("productId")));
            if (pass == null) {
                return Map.of();
            }
            int after = Math.max(0, live - 1);
            pass.setRemainingCount(after);
            if (after <= 0) {
                pass.setStatus(MemberProduct.Status.USED_UP);
                if (pass.getEndedAt() == null) {
                    pass.setEndedAt(java.time.LocalDateTime.now());
                }
            }
            memberProductRepository.save(pass);
            out.put("countPassApplied", true);
            out.put("pendingDeductDate", null);
            out.put("remainingCount", after);
        } else {
            out.put("countPassApplied", false);
            out.put("pendingDeductDate", visitDate);
            out.put("remainingCount", live);
        }
        return out;
    }

    /**
     * 대기 중인 청백전 차감 적용(경기일이 지난 경우). true면 상태 변경됨.
     */
    @Transactional
    public boolean applyPendingSharedOutdoorPass(String name, String phone, Long productId,
                                                 Integer remainingAtStart, LocalDate pendingDeductDate,
                                                 boolean alreadyApplied, LocalDate today) {
        if (alreadyApplied || today == null || pendingDeductDate == null || !pendingDeductDate.isBefore(today)) {
            return false;
        }
        MemberProduct pass = findSharedOutdoorPass(name, phone, productId);
        if (pass == null) {
            return false;
        }
        int live = remainingOf(pass);
        if (live <= 0 && remainingAtStart != null && remainingAtStart <= 0) {
            return false;
        }
        int after = Math.max(0, live - 1);
        pass.setRemainingCount(after);
        if (after <= 0) {
            pass.setStatus(MemberProduct.Status.USED_UP);
            if (pass.getEndedAt() == null) {
                pass.setEndedAt(java.time.LocalDateTime.now());
            }
        }
        memberProductRepository.save(pass);
        return true;
    }

    private MemberProduct findSharedOutdoorPass(String name, String phone, Long productId) {
        Member member = findMemberByNameAndPhone(name, phone);
        if (member == null || member.getId() == null || memberProductRepository == null) {
            return null;
        }
        List<MemberProduct> passes = memberProductRepository.findByMemberIdWithProduct(member.getId());
        if (passes == null || passes.isEmpty()) {
            return null;
        }
        if (productId != null) {
            for (MemberProduct mp : passes) {
                if (mp == null || mp.getDeletedAt() != null) {
                    continue;
                }
                if (mp.getProduct() != null && productId.equals(mp.getProduct().getId())) {
                    return mp;
                }
            }
        }
        MemberProduct active = findOutdoorCountPass(member);
        if (active != null) {
            return active;
        }
        MemberProduct best = null;
        for (MemberProduct mp : passes) {
            if (mp == null || mp.getDeletedAt() != null) {
                continue;
            }
            Product product = mp.getProduct();
            if (isTeamPackage(product) || !isCountPass(product)) {
                continue;
            }
            if (best == null || remainingOf(mp) > remainingOf(best)) {
                best = mp;
            }
        }
        return best;
    }
}
