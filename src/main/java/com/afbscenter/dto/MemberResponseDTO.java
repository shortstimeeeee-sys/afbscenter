package com.afbscenter.dto;

import com.afbscenter.model.Member;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 회원 응답용 DTO
 * Member 엔티티를 안전하게 직렬화하기 위한 DTO
 */
public class MemberResponseDTO {
    private Long id;
    private String memberNumber;
    private String name;
    private String phoneNumber;
    private LocalDate birthDate;
    private Member.Gender gender;
    private Integer height;
    private Integer weight;
    private String address;
    private String memo;
    private Member.MemberGrade grade;
    private Member.MemberStatus status;
    private LocalDate joinDate;
    private LocalDate lastVisitDate;
    private String coachMemo;
    private String guardianName;
    private String guardianPhone;
    private String school;
    private Double swingSpeed;
    private Double exitVelocity;
    private Double pitchingSpeed;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // 코치 정보
    private CoachInfo coach; // 주 담당 코치 (회원의 기본 코치)
    private String coachNames; // 모든 상품의 담당 코치 목록 (예: "김소연 [강사], 이철수 [코치]")
    
    // 집계 데이터
    private Integer totalPayment;
    private LocalDate latestLessonDate;
    private Integer remainingCount;
    
    // 회원 상품 목록
    private List<MemberProductInfo> memberProducts;
    
    // 기간권 정보
    private LocalDate periodPassStartDate;
    private LocalDate periodPassEndDate;
    
    // 생성자
    public MemberResponseDTO() {
        this.memberProducts = new ArrayList<>();
    }
    
    // Static factory method
    public static MemberResponseDTO fromMember(Member member, Integer totalPayment, 
                                               LocalDate latestLessonDate, Integer remainingCount,
                                               List<MemberProduct> allMemberProducts,
                                               MemberProduct activePeriodPass) {
        MemberResponseDTO dto = new MemberResponseDTO();
        
        // 기본 회원 정보
        dto.id = member.getId();
        dto.memberNumber = member.getMemberNumber();
        dto.name = member.getName();
        dto.phoneNumber = member.getPhoneNumber();
        dto.birthDate = member.getBirthDate();
        dto.gender = member.getGender();
        dto.height = member.getHeight();
        dto.weight = member.getWeight();
        dto.address = member.getAddress();
        dto.memo = member.getMemo();
        dto.grade = member.getGrade();
        dto.status = member.getStatus();
        dto.joinDate = member.getJoinDate();
        dto.lastVisitDate = member.getLastVisitDate();
        dto.coachMemo = member.getCoachMemo();
        dto.guardianName = member.getGuardianName();
        dto.guardianPhone = member.getGuardianPhone();
        dto.school = member.getSchool();
        dto.swingSpeed = member.getSwingSpeed();
        dto.exitVelocity = member.getExitVelocity();
        dto.pitchingSpeed = member.getPitchingSpeed();
        dto.createdAt = member.getCreatedAt();
        dto.updatedAt = member.getUpdatedAt();
        
        // 코치 정보
        if (member.getCoach() != null) {
            dto.coach = new CoachInfo();
            dto.coach.id = member.getCoach().getId();
            dto.coach.name = member.getCoach().getName();
        }
        
        // 모든 상품의 담당 코치를 카테고리별로 수집 (중복 제거)
        // 코치명과 카테고리 정보를 함께 저장
        class CoachWithCategory {
            String coachName;
            Product.ProductCategory category;
            int priority; // 정렬 우선순위
            
            CoachWithCategory(String coachName, Product.ProductCategory category) {
                this.coachName = coachName;
                this.category = category;
                // 정렬 우선순위: 야구(1) > 트레이닝(2) > 필라테스(3) > 기타(4)
                if (category == Product.ProductCategory.BASEBALL) {
                    this.priority = 1;
                } else if (category == Product.ProductCategory.TRAINING || 
                          category == Product.ProductCategory.TRAINING_FITNESS) {
                    this.priority = 2;
                } else if (category == Product.ProductCategory.PILATES) {
                    this.priority = 3;
                } else {
                    this.priority = 4;
                }
            }
        }
        
        List<CoachWithCategory> coachList = new ArrayList<>();
        if (allMemberProducts != null) {
            for (MemberProduct mp : allMemberProducts) {
                try {
                    if (mp.getStatus() == MemberProduct.Status.ACTIVE) {
                        String tempCoachName = null;
                        Product.ProductCategory tempCategory = null;
                        
                        // MemberProduct의 코치 우선 사용
                        try {
                            if (mp.getCoach() != null) {
                                tempCoachName = mp.getCoach().getName();
                            }
                        } catch (Exception e) {
                            // coach 필드가 아직 로드되지 않았거나 없을 수 있음
                        }
                        
                        // MemberProduct에 코치가 없으면 상품의 코치 사용
                        if (tempCoachName == null && mp.getProduct() != null) {
                            try {
                                if (mp.getProduct().getCoach() != null) {
                                    tempCoachName = mp.getProduct().getCoach().getName();
                                }
                                // 상품 카테고리 가져오기
                                if (mp.getProduct().getCategory() != null) {
                                    tempCategory = mp.getProduct().getCategory();
                                }
                            } catch (Exception e) {
                                // 상품의 코치 로드 실패 시 무시
                            }
                        }
                        
                        // 둘 다 없으면 회원의 기본 코치 사용
                        if (tempCoachName == null && member.getCoach() != null) {
                            tempCoachName = member.getCoach().getName();
                        }
                        
                        // 람다 표현식에서 사용하기 위해 final 변수로 복사
                        final String coachName = tempCoachName;
                        Product.ProductCategory category = tempCategory;
                        
                        // 코치명과 카테고리 정보 추가 (중복 제거)
                        if (coachName != null && !coachName.trim().isEmpty()) {
                            // 이미 같은 코치명이 있는지 확인
                            boolean exists = coachList.stream()
                                .anyMatch(c -> c.coachName.equals(coachName));
                            
                            if (!exists) {
                                // 카테고리가 없으면 상품명에서 추론 시도
                                if (category == null && mp.getProduct() != null) {
                                    String productName = mp.getProduct().getName() != null ? 
                                        mp.getProduct().getName().toLowerCase() : "";
                                    if (productName.contains("야구") || productName.contains("baseball")) {
                                        category = Product.ProductCategory.BASEBALL;
                                    } else if (productName.contains("필라테스") || productName.contains("pilates")) {
                                        category = Product.ProductCategory.PILATES;
                                    } else if (productName.contains("트레이닝") || productName.contains("training")) {
                                        category = Product.ProductCategory.TRAINING;
                                    }
                                }
                                
                                final Product.ProductCategory finalCategory = category;
                                coachList.add(new CoachWithCategory(coachName, finalCategory));
                            }
                        }
                    }
                } catch (Exception e) {
                    // 코치 정보 로드 실패 시 무시
                }
            }
        }
        
        // 회원의 기본 코치도 추가 (없으면, 카테고리는 null)
        if (member.getCoach() != null && member.getCoach().getName() != null) {
            String mainCoachName = member.getCoach().getName();
            boolean exists = coachList.stream()
                .anyMatch(c -> c.coachName.equals(mainCoachName));
            if (!exists) {
                coachList.add(new CoachWithCategory(mainCoachName, null));
            }
        }
        
        // 카테고리별로 정렬 (야구 > 트레이닝 > 필라테스 > 기타)
        coachList.sort((a, b) -> {
            // 우선순위로 정렬
            int priorityCompare = Integer.compare(a.priority, b.priority);
            if (priorityCompare != 0) {
                return priorityCompare;
            }
            // 같은 우선순위면 코치명으로 정렬
            return a.coachName.compareTo(b.coachName);
        });
        
        // 코치 목록을 문자열로 변환 (줄바꿈으로 구분)
        if (!coachList.isEmpty()) {
            dto.coachNames = coachList.stream()
                .map(c -> c.coachName)
                .collect(java.util.stream.Collectors.joining("\n"));
        } else {
            dto.coachNames = null;
        }
        
        // 집계 데이터
        dto.totalPayment = totalPayment != null ? totalPayment : 0;
        dto.latestLessonDate = latestLessonDate;
        dto.remainingCount = remainingCount != null ? remainingCount : 0;
        
        // 회원 상품 목록
        if (allMemberProducts != null) {
            dto.memberProducts = allMemberProducts.stream()
                .map(mp -> {
                    MemberProductInfo info = new MemberProductInfo();
                    info.id = mp.getId();
                    info.purchaseDate = mp.getPurchaseDate();
                    info.expiryDate = mp.getExpiryDate();
                    info.remainingCount = mp.getRemainingCount();
                    info.totalCount = mp.getTotalCount();
                    info.status = mp.getStatus() != null ? mp.getStatus().name() : null;
                    
                    // Product 정보
                    if (mp.getProduct() != null) {
                        ProductInfo productInfo = new ProductInfo();
                        productInfo.id = mp.getProduct().getId();
                        productInfo.name = mp.getProduct().getName();
                        productInfo.type = mp.getProduct().getType() != null ? mp.getProduct().getType().name() : null;
                        productInfo.price = mp.getProduct().getPrice();
                        productInfo.category = mp.getProduct().getCategory() != null ? mp.getProduct().getCategory().name() : null;
                        productInfo.usageCount = mp.getProduct().getUsageCount(); // 상품의 usageCount 추가
                        productInfo.validDays = mp.getProduct().getValidDays(); // 상품의 validDays 추가
                        
                        // 상품의 담당 코치 정보 추가
                        if (mp.getProduct().getCoach() != null) {
                            try {
                                CoachInfo productCoachInfo = new CoachInfo();
                                productCoachInfo.id = mp.getProduct().getCoach().getId();
                                productCoachInfo.name = mp.getProduct().getCoach().getName();
                                productInfo.coach = productCoachInfo;
                            } catch (Exception e) {
                                // 코치 정보 로드 실패 시 무시
                            }
                        }
                        
                        info.product = productInfo;
                    }
                    
                    // 코치 정보 (MemberProduct.coach -> Product.coach -> Member.coach 순서)
                    String coachName = null;
                    try {
                        if (mp.getCoach() != null) {
                            coachName = mp.getCoach().getName();
                        }
                    } catch (Exception e) {
                        // coach 필드가 아직 로드되지 않았거나 없을 수 있음
                    }
                    
                    if (coachName == null && mp.getProduct() != null) {
                        try {
                            if (mp.getProduct().getCoach() != null) {
                                coachName = mp.getProduct().getCoach().getName();
                            }
                        } catch (Exception e) {
                            // 상품의 코치 로드 실패 시 무시
                        }
                    }
                    
                    if (coachName == null && member.getCoach() != null) {
                        coachName = member.getCoach().getName();
                    }
                    
                    if (coachName != null) {
                        info.coachName = coachName;
                    }
                    
                    return info;
                })
                .collect(Collectors.toList());
        }
        
        // 기간권 정보
        if (activePeriodPass != null) {
            dto.periodPassStartDate = activePeriodPass.getPurchaseDate() != null ? 
                activePeriodPass.getPurchaseDate().toLocalDate() : null;
            dto.periodPassEndDate = activePeriodPass.getExpiryDate();
        }
        
        return dto;
    }
    
    // Map으로 변환
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("id", id);
        map.put("memberNumber", memberNumber);
        map.put("name", name);
        map.put("phoneNumber", phoneNumber);
        map.put("birthDate", birthDate);
        map.put("gender", gender);
        map.put("height", height);
        map.put("weight", weight);
        map.put("address", address);
        map.put("memo", memo);
        map.put("grade", grade);
        map.put("status", status);
        map.put("joinDate", joinDate);
        map.put("lastVisitDate", lastVisitDate);
        map.put("coachMemo", coachMemo);
        map.put("guardianName", guardianName);
        map.put("guardianPhone", guardianPhone);
        map.put("school", school);
        map.put("swingSpeed", swingSpeed);
        map.put("exitVelocity", exitVelocity);
        map.put("pitchingSpeed", pitchingSpeed);
        map.put("createdAt", createdAt);
        map.put("updatedAt", updatedAt);
        
        // 코치 정보
        if (coach != null) {
            Map<String, Object> coachMap = new HashMap<>();
            coachMap.put("id", coach.id);
            coachMap.put("name", coach.name);
            map.put("coach", coachMap);
        } else {
            map.put("coach", null);
        }
        
        // 모든 상품의 담당 코치 목록
        map.put("coachNames", coachNames);
        
        // 집계 데이터
        map.put("totalPayment", totalPayment);
        map.put("latestLessonDate", latestLessonDate);
        map.put("remainingCount", remainingCount);
        
        // 회원 상품 목록
        if (memberProducts != null) {
            List<Map<String, Object>> productsList = memberProducts.stream()
                .map(mp -> {
                    Map<String, Object> mpMap = new HashMap<>();
                    mpMap.put("id", mp.id);
                    mpMap.put("purchaseDate", mp.purchaseDate);
                    mpMap.put("expiryDate", mp.expiryDate);
                    mpMap.put("remainingCount", mp.remainingCount);
                    mpMap.put("totalCount", mp.totalCount);
                    mpMap.put("status", mp.status);
                    mpMap.put("coachName", mp.coachName); // 상품에 지정된 코치명
                    
                    if (mp.product != null) {
                        Map<String, Object> productMap = new HashMap<>();
                        productMap.put("id", mp.product.id);
                        productMap.put("name", mp.product.name);
                        productMap.put("type", mp.product.type);
                        productMap.put("price", mp.product.price);
                        productMap.put("category", mp.product.category);
                        productMap.put("usageCount", mp.product.usageCount); // 상품의 usageCount 추가
                        productMap.put("validDays", mp.product.validDays); // 상품의 validDays 추가
                        
                        // 상품의 담당 코치 정보 추가
                        if (mp.product.coach != null) {
                            Map<String, Object> coachMap = new HashMap<>();
                            coachMap.put("id", mp.product.coach.id);
                            coachMap.put("name", mp.product.coach.name);
                            productMap.put("coach", coachMap);
                        } else {
                            productMap.put("coach", null);
                        }
                        
                        mpMap.put("product", productMap);
                    } else {
                        mpMap.put("product", null);
                    }
                    
                    return mpMap;
                })
                .collect(Collectors.toList());
            map.put("memberProducts", productsList);
        } else {
            map.put("memberProducts", new ArrayList<>());
        }
        
        // 기간권 정보
        map.put("periodPassStartDate", periodPassStartDate);
        map.put("periodPassEndDate", periodPassEndDate);
        
        return map;
    }
    
    // Getter 메서드들
    public Long getId() {
        return id;
    }
    
    public CoachInfo getCoach() {
        return coach;
    }
    
    public List<MemberProductInfo> getMemberProducts() {
        return memberProducts;
    }
    
    // 내부 클래스: 코치 정보
    public static class CoachInfo {
        public Long id;
        public String name;
        
        public Long getId() { return id; }
        public String getName() { return name; }
    }
    
    // 내부 클래스: 회원 상품 정보
    public static class MemberProductInfo {
        public Long id;
        public LocalDateTime purchaseDate;
        public LocalDate expiryDate;
        public Integer remainingCount;
        public Integer totalCount;
        public String status;
        public ProductInfo product;
        public String coachName; // 상품에 지정된 코치명
        
        public Long getId() { return id; }
        public LocalDateTime getPurchaseDate() { return purchaseDate; }
        public LocalDate getExpiryDate() { return expiryDate; }
        public Integer getRemainingCount() { return remainingCount; }
        public Integer getTotalCount() { return totalCount; }
        public String getStatus() { return status; }
        public ProductInfo getProduct() { return product; }
        public String getCoachName() { return coachName; }
    }
    
    // 내부 클래스: 상품 정보
    public static class ProductInfo {
        public Long id;
        public String name;
        public String type;
        public Integer price;
        public String category;
        public Integer usageCount; // 상품의 사용 횟수
        public Integer validDays; // 상품의 유효기간
        public CoachInfo coach; // 상품의 담당 코치
        
        public Long getId() { return id; }
        public String getName() { return name; }
        public String getType() { return type; }
        public Integer getPrice() { return price; }
        public String getCategory() { return category; }
        public Integer getUsageCount() { return usageCount; }
        public Integer getValidDays() { return validDays; }
        public CoachInfo getCoach() { return coach; }
    }
}
