package com.afbscenter.service;

import com.afbscenter.model.Booking;
import com.afbscenter.model.OutdoorLessonParticipant;
import com.afbscenter.model.Product;
import com.afbscenter.repository.OutdoorLessonParticipantRepository;
import com.afbscenter.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class OutdoorLessonParticipantService {

    private final OutdoorLessonParticipantRepository repository;
    private final ProductRepository productRepository;

    public OutdoorLessonParticipantService(OutdoorLessonParticipantRepository repository,
                                           ProductRepository productRepository) {
        this.repository = repository;
        this.productRepository = productRepository;
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
            p.setDepositConfirmed(bool(row.get("depositConfirmed")));
            p.setAttended(bool(row.get("attended")));
            p.setCarriedFromDate(parseDate(row.get("carriedFromDate")));
            applyPlan(p, row.get("productId"));
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
            created.setProductId(source.getProductId());
            created.setDepositAmount(source.getDepositAmount());
            created.setDepositConfirmed(source.isDepositConfirmed());
        }
        applyRowOverrides(created, row);
        if (text(created.getName()).isEmpty()) {
            throw new IllegalArgumentException("이름을 입력해 주세요.");
        }
        created.setCarriedFromDate(source != null && source.getLessonDate() != null
                ? source.getLessonDate()
                : fromDate);
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
        if (row.containsKey("depositConfirmed")) {
            participant.setDepositConfirmed(bool(row.get("depositConfirmed")));
        }
        if (row.containsKey("attended")) {
            participant.setAttended(bool(row.get("attended")));
        }
        if (row.containsKey("productId")) {
            applyPlan(participant, row.get("productId"));
        }
    }

    @Transactional
    public OutdoorLessonParticipant markAttendance(Long id, boolean attended) {
        if (id == null) {
            throw new IllegalArgumentException("참가자를 찾을 수 없습니다.");
        }
        OutdoorLessonParticipant participant = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("참가자를 찾을 수 없습니다. 명단을 저장한 뒤 다시 시도해 주세요."));
        participant.setAttended(attended);
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
            return;
        }
        findPlan(productId).ifPresent(product -> {
            participant.setProductId(product.getId());
            participant.setDepositAmount(product.getPrice());
        });
    }

    private static boolean isOutdoorLessonPlan(Product product) {
        return product != null && product.getCategory() == Product.ProductCategory.OUTDOOR_LESSON;
    }

    private static Map<String, Object> toPlanMap(Product product) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", product.getId());
        map.put("name", product.getName() == null ? "" : product.getName());
        map.put("price", product.getPrice() == null ? 0 : product.getPrice());
        map.put("type", product.getType() != null ? product.getType().name() : null);
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
}
