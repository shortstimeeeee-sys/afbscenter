package com.afbscenter.service;

import com.afbscenter.dto.MemberResponseDTO;
import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.model.Member.MemberGrade;
import com.afbscenter.model.Member.MemberStatus;
import com.afbscenter.model.MemberProduct;
import com.afbscenter.model.Product;
import com.afbscenter.repository.AttendanceRepository;
import com.afbscenter.repository.BookingRepository;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberProductRepository;
import com.afbscenter.repository.MemberRepository;
import com.afbscenter.repository.PaymentRepository;
import com.afbscenter.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class MemberService {

    private static final Logger logger = LoggerFactory.getLogger(MemberService.class);

    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberProductRepository memberProductRepository;
    private final ProductRepository productRepository;
    private final JdbcTemplate jdbcTemplate;

    // 생성자 주입 (Spring 4.3+에서는 @Autowired 불필요)
    public MemberService(MemberRepository memberRepository, 
                        CoachRepository coachRepository,
                        PaymentRepository paymentRepository,
                        BookingRepository bookingRepository,
                        AttendanceRepository attendanceRepository,
                        MemberProductRepository memberProductRepository,
                        ProductRepository productRepository,
                        JdbcTemplate jdbcTemplate) {
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberProductRepository = memberProductRepository;
        this.productRepository = productRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    // 회원 생성
    @Transactional(rollbackFor = Exception.class)
    public Member createMember(Member member) {
        try {
            logger.debug("회원 생성 시작: 이름={}, 전화번호={}, 성별={}", 
                member.getName(), member.getPhoneNumber(), member.getGender());
            
            // 필수 필드 검증
            if (member.getName() == null || member.getName().trim().isEmpty()) {
                throw new IllegalArgumentException("이름은 필수입니다.");
            }
            if (member.getPhoneNumber() == null || member.getPhoneNumber().trim().isEmpty()) {
                throw new IllegalArgumentException("전화번호는 필수입니다.");
            }
            if (member.getGender() == null) {
                throw new IllegalArgumentException("성별은 필수입니다.");
            }
            
            // 전화번호 중복 허용 (형제/가족이 같은 번호 사용 가능)
            // 프론트엔드에서 이미 확인 다이얼로그를 통해 사용자에게 경고함
            logger.debug("전화번호 중복 체크 생략 (형제/가족 등록 지원)");
            
            // 등록 일자 및 시간 자동 설정
            if (member.getJoinDate() == null) {
                member.setJoinDate(java.time.LocalDate.now());
            }
            
            // 등록일시 설정 (소급 등록 지원: 프론트엔드에서 설정한 값이 있으면 사용, 없으면 현재 시간)
            if (member.getCreatedAt() == null) {
                member.setCreatedAt(java.time.LocalDateTime.now());
            }
            
            // 등급 기본값 설정
            if (member.getGrade() == null) {
                member.setGrade(MemberGrade.SOCIAL);
            }
            
            // 상태 기본값 설정
            if (member.getStatus() == null) {
                member.setStatus(MemberStatus.ACTIVE);
            }
            
            // 코치 설정 (Coach 엔티티가 제대로 로드되지 않은 경우 처리)
            if (member.getCoach() != null && member.getCoach().getId() != null) {
                Long coachId = member.getCoach().getId();
                Optional<Coach> coachOpt = coachRepository.findById(coachId);
                if (coachOpt.isPresent()) {
                    member.setCoach(coachOpt.get());
                } else {
                    logger.warn("코치를 찾을 수 없습니다. ID: {}, 코치 참조 제거", coachId);
                    member.setCoach(null);
                }
            } else {
                member.setCoach(null);
            }
            
            // 회원번호 자동 생성 (없는 경우만)
            String currentMemberNumber = member.getMemberNumber();
            if (currentMemberNumber == null || (currentMemberNumber != null && currentMemberNumber.trim().isEmpty())) {
                try {
                    logger.debug("회원번호 자동 생성 시작");
                    String memberNumber = generateMemberNumber(member);
                    logger.debug("생성된 회원번호: {}", memberNumber);
                    
                    // 회원번호 중복 체크
                    try {
                        // JdbcTemplate으로 중복 체크 (enum 변환 오류 방지)
                        Integer count = jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM members WHERE member_number = ?", 
                            Integer.class, 
                            memberNumber
                        );
                        if (count != null && count > 0) {
                            // 중복 발견 시 바로 오류 발생
                            logger.error("회원번호 중복: {}", memberNumber);
                            throw new IllegalArgumentException(
                                String.format("회원번호 '%s'이(가) 이미 사용 중입니다. 시스템 오류일 수 있으니 관리자에게 문의하세요.", memberNumber)
                            );
                        }
                        logger.info("회원번호 중복 체크 완료: {}", memberNumber);
                    } catch (IllegalArgumentException e) {
                        throw e; // IllegalArgumentException은 그대로 던짐
                    } catch (Exception e) {
                        logger.warn("회원번호 중복 체크 중 오류 (계속 진행): {}", e.getMessage());
                        // 중복 체크 실패 시 그대로 진행 (데이터베이스 제약 조건이 막아줌)
                    }
                    
                    member.setMemberNumber(memberNumber);
                    logger.info("회원번호 자동 생성 완료: {}", memberNumber);
                } catch (IllegalArgumentException e) {
                    throw e;
                } catch (Exception e) {
                    logger.error("회원번호 생성 실패: {}", e.getMessage(), e);
                    logger.error("회원번호 생성 실패 스택 트레이스:", e);
                    throw new IllegalArgumentException("회원번호 생성 중 오류가 발생했습니다: " + e.getMessage());
                }
            }
            
            // Bean Validation을 피하기 위해 @Past, @Positive 검증 위반 가능성 제거
            // 생년월일이 미래 날짜인 경우 null로 설정
            if (member.getBirthDate() != null && member.getBirthDate().isAfter(java.time.LocalDate.now())) {
                logger.warn("생년월일이 미래 날짜입니다. null로 설정: {}", member.getBirthDate());
                member.setBirthDate(null);
            }
            
            // 키와 몸무게가 0 이하인 경우 null로 설정 (@Positive 검증 위반 방지)
            if (member.getHeight() != null && member.getHeight() <= 0) {
                logger.warn("키가 0 이하입니다. null로 설정: {}", member.getHeight());
                member.setHeight(null);
            }
            if (member.getWeight() != null && member.getWeight() <= 0) {
                logger.warn("몸무게가 0 이하입니다. null로 설정: {}", member.getWeight());
                member.setWeight(null);
            }
            
            logger.info("회원 저장 실행: 이름={}, 전화번호={}, 회원번호={}, 등급={}, 상태={}, 가입일={}, 등록일시={}, 생년월일={}, 키={}, 몸무게={}", 
                member.getName(), member.getPhoneNumber(), member.getMemberNumber(), 
                member.getGrade(), member.getStatus(), member.getJoinDate(), member.getCreatedAt(),
                member.getBirthDate(), member.getHeight(), member.getWeight());
            
            // 새 회원 등록이므로 ID를 명시적으로 null로 설정 (덮어쓰기 방지)
            member.setId(null);
            logger.info("회원 ID를 null로 설정하여 새 등록 강제");
            
            try {
                Member savedMember = memberRepository.save(member);
                logger.info("회원 저장 성공: ID={}, 회원번호={}", savedMember.getId(), savedMember.getMemberNumber());
                return savedMember;
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                logger.error("회원 저장 중 데이터 무결성 오류: {}", e.getMessage(), e);
                logger.error("회원 정보: 이름={}, 전화번호={}, 회원번호={}, 등급={}, 상태={}", 
                    member.getName(), member.getPhoneNumber(), member.getMemberNumber(), 
                    member.getGrade(), member.getStatus());
                
                String errorMessage = e.getMessage() != null ? e.getMessage() : "";
                if (errorMessage.contains("member_number") || errorMessage.contains("MEMBER_NUMBER")) {
                    // 회원번호 중복 - 재생성하지 않고 바로 오류
                    logger.error("회원번호 중복 오류: {}", member.getMemberNumber());
                    throw new IllegalArgumentException(
                        String.format("회원번호 '%s'이(가) 이미 사용 중입니다. 시스템 오류일 수 있으니 관리자에게 문의하세요.", member.getMemberNumber())
                    );
                }
                // 전화번호 중복은 허용 (형제/가족 등록)
                throw new IllegalArgumentException("데이터 저장 중 오류가 발생했습니다: " + errorMessage);
            } catch (Exception e) {
                logger.error("회원 저장 중 예상치 못한 오류: {}", e.getMessage(), e);
                logger.error("회원 저장 오류 클래스: {}", e.getClass().getName());
                logger.error("회원 정보: 이름={}, 전화번호={}, 회원번호={}, 등급={}, 상태={}", 
                    member.getName(), member.getPhoneNumber(), member.getMemberNumber(), 
                    member.getGrade(), member.getStatus());
                e.printStackTrace();
                throw new RuntimeException("회원 저장 중 오류가 발생했습니다: " + e.getMessage(), e);
            }
        } catch (IllegalArgumentException e) {
            logger.warn("회원 등록 실패 (IllegalArgumentException): {}", e.getMessage());
            throw e;
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            logger.error("회원 등록 중 데이터 무결성 오류: {}", e.getMessage(), e);
            logger.error("회원 정보: 이름={}, 전화번호={}, 회원번호={}, 등급={}, 상태={}", 
                member.getName(), member.getPhoneNumber(), member.getMemberNumber(), 
                member.getGrade(), member.getStatus());
            
            String errorMessage = e.getMessage() != null ? e.getMessage() : "";
            if (errorMessage.contains("member_number") || errorMessage.contains("MEMBER_NUMBER")) {
                throw new IllegalArgumentException(
                    "회원번호가 이미 사용 중입니다. 시스템 오류일 수 있으니 관리자에게 문의하세요."
                );
            }
            // 전화번호 중복은 허용 (형제/가족 등록)
            throw new IllegalArgumentException("데이터 저장 중 오류가 발생했습니다: " + errorMessage);
        } catch (Exception e) {
            logger.error("회원 등록 중 예상치 못한 오류: {}", e.getMessage(), e);
            logger.error("회원 등록 오류 클래스: {}", e.getClass().getName());
            logger.error("회원 정보: 이름={}, 전화번호={}, 회원번호={}, 등급={}, 상태={}, 가입일={}, 등록일시={}", 
                member != null ? member.getName() : "null",
                member != null ? member.getPhoneNumber() : "null",
                member != null ? member.getMemberNumber() : "null",
                member != null ? member.getGrade() : "null",
                member != null ? member.getStatus() : "null",
                member != null ? member.getJoinDate() : "null",
                member != null ? member.getCreatedAt() : "null");
            e.printStackTrace();
            throw new RuntimeException("회원 등록 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
    
    // 회원번호 자동 생성 (M + 회원등록 순번 + 휴대폰번호(010 제외))
    // 주의: 회원번호의 순번은 ID와 별개로 실제 등록된 회원 수를 기준으로 계산됩니다.
    // ID는 데이터베이스가 자동으로 관리하며 (1, 2, 3...), 회원번호는 별도로 관리됩니다.
    private String generateMemberNumber(Member member) {
        try {
            logger.debug("회원번호 생성 시작");
            // 회원 등록 순번 계산 (실제 등록된 회원 수 + 1)
            // 이 순번은 ID와 별개이며, 실제 등록 순서를 나타냅니다.
            long totalMembers = 0;
            try {
                totalMembers = memberRepository.count();
                logger.debug("현재 회원 수: {}", totalMembers);
            } catch (Exception e) {
                logger.warn("회원 수 조회 실패, 기본값 0 사용: {}", e.getMessage());
                totalMembers = 0;
            }
            int registrationOrder = (int) (totalMembers + 1);
            logger.debug("회원 등록 순번: {}", registrationOrder);
            
            String phonePart = extractPhonePart(member);
            logger.debug("전화번호 부분: {}", phonePart);
            
            // M + 회원등록 순번 + 휴대폰번호(010 제외) 형식
            // 예: M112345678 (M + 등록순번1 + 전화번호12345678)
            String memberNumber = String.format("M%d%s", registrationOrder, phonePart);
            logger.info("생성된 회원번호: {}", memberNumber);
            return memberNumber;
        } catch (Exception e) {
            logger.error("회원번호 생성 중 오류: {}", e.getMessage(), e);
            logger.error("회원번호 생성 오류 스택 트레이스:", e);
            // 기본 회원번호 생성 (타임스탬프 기반)
            long timestamp = System.currentTimeMillis() % 100000000; // 마지막 8자리
            String fallbackNumber = String.format("M%d%08d", 1, timestamp);
            logger.warn("기본 회원번호 생성: {}", fallbackNumber);
            return fallbackNumber;
        }
    }
    
    // 전화번호에서 8자리 추출 (010 제외)
    private String extractPhonePart(Member member) {
        // 전화번호 추출 (회원 전화번호 우선, 없으면 보호자 번호)
        String phoneNumber = member.getPhoneNumber();
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            phoneNumber = member.getGuardianPhone();
        }
        
        // 전화번호가 없으면 기본값 사용 (00000000)
        String phonePart = "00000000";
        if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
            // 숫자만 추출
            String digitsOnly = phoneNumber.replaceAll("[^0-9]", "");
            
            // 010으로 시작하면 제거
            if (digitsOnly.startsWith("010") && digitsOnly.length() > 3) {
                digitsOnly = digitsOnly.substring(3);
            }
            
            // 8자리로 맞추기 (부족하면 앞에 0 추가, 넘치면 뒤에서 8자리만)
            if (digitsOnly.length() > 8) {
                phonePart = digitsOnly.substring(digitsOnly.length() - 8);
            } else if (digitsOnly.length() > 0 && digitsOnly.length() < 8) {
                try {
                    phonePart = String.format("%08d", Long.parseLong(digitsOnly));
                } catch (NumberFormatException e) {
                    logger.warn("전화번호 파싱 실패: {}, 기본값 사용", digitsOnly);
                    phonePart = "00000000";
                }
            } else if (digitsOnly.length() == 8) {
                phonePart = digitsOnly;
            }
            // digitsOnly가 빈 문자열이면 기본값 "00000000" 사용
        }
        return phonePart;
    }

    // 회원 조회 (ID)
    @Transactional(readOnly = true)
    public Optional<Member> getMemberById(Long id) {
        return memberRepository.findByIdWithCoachAndProducts(id);
    }

    // 회원 조회 (전화번호)
    @Transactional(readOnly = true)
    public Optional<Member> getMemberByPhoneNumber(String phoneNumber) {
        return memberRepository.findByPhoneNumber(phoneNumber);
    }

    // 전체 회원 조회
    @Transactional(readOnly = true)
    public List<Member> getAllMembers() {
        return memberRepository.findAllOrderByName();
    }
    
    /**
     * 필터링된 회원 목록을 DTO로 변환하여 반환
     * Controller의 비즈니스 로직을 Service로 이동
     */
    @Transactional(readOnly = true)
    public List<MemberResponseDTO> getAllMembersWithFilters(String productCategory, String grade, String status, String branch) {
        List<Member> members = memberRepository.findAllOrderByName();
        
        // 등급별 필터링
        if (grade != null && !grade.trim().isEmpty()) {
            try {
                MemberGrade gradeEnum = MemberGrade.valueOf(grade.toUpperCase());
                members = members.stream()
                        .filter(member -> member.getGrade() == gradeEnum)
                        .collect(Collectors.toList());
                logger.info("회원 목록 등급 필터링: {} - {}명", gradeEnum, members.size());
            } catch (IllegalArgumentException e) {
                logger.warn("잘못된 등급 파라미터: {}", grade);
            }
        }
        
        // 상태별 필터링
        if (status != null && !status.trim().isEmpty()) {
            try {
                MemberStatus statusEnum = MemberStatus.valueOf(status.toUpperCase());
                members = members.stream()
                        .filter(member -> member.getStatus() == statusEnum)
                        .collect(Collectors.toList());
                logger.info("회원 목록 상태 필터링: {} - {}명", statusEnum, members.size());
            } catch (IllegalArgumentException e) {
                logger.warn("잘못된 상태 파라미터: {}", status);
            }
        }
        
        // 각 회원을 DTO로 변환
        List<MemberResponseDTO> memberDTOs = new java.util.ArrayList<>();
        for (Member member : members) {
            try {
                // 누적 결제 금액 계산
                // 1. 먼저 Payment 테이블에서 계산
                Integer totalPayment = null;
                try {
                    totalPayment = paymentRepository.sumTotalAmountByMemberId(member.getId());
                    if (totalPayment == null) {
                        totalPayment = 0;
                    }
                } catch (Exception e) {
                    logger.warn("결제 금액 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage(), e);
                    totalPayment = 0;
                }
                
                // 2. Payment가 0이거나 없으면 MemberProduct를 기반으로 자동 계산
                // (누락된 결제가 있는 경우를 대비)
                if (totalPayment == null || totalPayment == 0) {
                    try {
                        List<MemberProduct> memberProducts = memberProductRepository.findByMemberIdWithProduct(member.getId());
                        if (memberProducts != null && !memberProducts.isEmpty()) {
                            int calculatedTotal = 0;
                            for (MemberProduct mp : memberProducts) {
                                if (mp.getProduct() != null && mp.getProduct().getPrice() != null) {
                                    Integer price = mp.getProduct().getPrice();
                                    if (price > 0) {
                                        calculatedTotal += price;
                                    }
                                }
                            }
                            if (calculatedTotal > 0) {
                                logger.debug("Payment가 없어 MemberProduct 기반으로 누적 결제 금액 계산: Member ID={}, 계산된 금액={}", 
                                    member.getId(), calculatedTotal);
                                totalPayment = calculatedTotal;
                            }
                        }
                    } catch (Exception e) {
                        logger.warn("MemberProduct 기반 결제 금액 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                    }
                }
                
                logger.debug("회원 누적 결제 금액 계산 완료: Member ID={}, Total Payment={}", member.getId(), totalPayment);
                
                // 최근 레슨 날짜 계산
                LocalDate latestLessonDate = null;
                try {
                    List<com.afbscenter.model.Booking> latestLessons = bookingRepository.findLatestLessonByMemberId(member.getId());
                    if (latestLessons != null && !latestLessons.isEmpty()) {
                        latestLessonDate = latestLessons.get(0).getStartTime().toLocalDate();
                    }
                } catch (Exception e) {
                    logger.warn("최근 레슨 날짜 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }
                
                // 회원 상품 정보 (lazy loading 방지를 위해 JOIN FETCH 사용) - 먼저 조회
                List<MemberProduct> allMemberProducts = null;
                try {
                    allMemberProducts = memberProductRepository.findByMemberIdWithProduct(member.getId());
                } catch (Exception e) {
                    logger.warn("회원 상품 조회 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                    allMemberProducts = new java.util.ArrayList<>();
                }
                
                // 횟수권 남은 횟수 계산 (allMemberProducts 사용)
                int remainingCount = 0;
                try {
                    // allMemberProducts에서 횟수권 필터링 (이미 product가 로드되어 있음)
                    if (allMemberProducts != null) {
                        for (MemberProduct mp : allMemberProducts) {
                            try {
                                // 횟수권인지 확인
                                if (mp.getProduct() == null || 
                                    mp.getProduct().getType() != Product.ProductType.COUNT_PASS ||
                                    mp.getStatus() != MemberProduct.Status.ACTIVE) {
                                    continue;
                                }
                                
                                Integer mpRemainingCount = mp.getRemainingCount();
                                
                                // remainingCount가 null이거나 0인 경우 재계산
                                // (0인 경우도 재계산하여 실제 사용 횟수 기반으로 정확한 값 확인)
                                if (mpRemainingCount == null || mpRemainingCount == 0) {
                                    Integer totalCount = mp.getTotalCount();
                                    if (totalCount == null || totalCount <= 0) {
                                        try {
                                            if (mp.getProduct() != null) {
                                                totalCount = mp.getProduct().getUsageCount();
                                            }
                                        } catch (Exception e) {
                                            logger.warn("Product 정보 로드 실패 (MemberProduct ID: {}): {}", 
                                                mp.getId(), e.getMessage());
                                        }
                                        if (totalCount == null || totalCount <= 0) {
                                            totalCount = com.afbscenter.constants.ProductDefaults.DEFAULT_TOTAL_COUNT;
                                        }
                                    }
                                    
                                    // 체크인된 출석 기록 수 (가장 정확한 데이터)
                                    Long usedCountByAttendance = attendanceRepository.countCheckedInAttendancesByMemberAndProduct(member.getId(), mp.getId());
                                    if (usedCountByAttendance == null) {
                                        usedCountByAttendance = 0L;
                                    }
                                    
                                    // 체크인된 예약 수 (출석 기록이 없는 경우를 대비)
                                    // 주의: countConfirmedBookingsByMemberProductId는 이제 체크인된 예약만 카운트하므로
                                    // 출석 기록과 중복될 수 있음. 출석 기록을 우선 사용
                                    Long usedCountByBooking = bookingRepository.countConfirmedBookingsByMemberProductId(mp.getId());
                                    if (usedCountByBooking == null) {
                                        usedCountByBooking = 0L;
                                    }
                                    
                                    // 출석 기록이 있으면 출석 기록 사용, 없으면 예약 기록 사용 (중복 방지)
                                    Long actualUsedCount = usedCountByAttendance > 0 ? usedCountByAttendance : usedCountByBooking;
                                    mpRemainingCount = totalCount - actualUsedCount.intValue();
                                    if (mpRemainingCount < 0) {
                                        mpRemainingCount = 0;
                                    }
                                    
                                    // 계산된 값을 MemberProduct 객체에 반영 (DTO에 전달되도록)
                                    mp.setRemainingCount(mpRemainingCount);
                                    if (mp.getTotalCount() == null || mp.getTotalCount() <= 0) {
                                        mp.setTotalCount(totalCount);
                                    }
                                }
                                
                                if (mpRemainingCount < 0) {
                                    mpRemainingCount = 0;
                                }
                                
                                remainingCount += mpRemainingCount;
                            } catch (Exception e) {
                                logger.warn("회원 상품 잔여 횟수 계산 실패 (Member ID: {}, MemberProduct ID: {}): {}", 
                                        member.getId(), mp != null ? mp.getId() : "null", e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    logger.warn("횟수권 계산 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }
                
                // 기간권 정보
                MemberProduct activePeriodPass = null;
                try {
                    // allMemberProducts에서 기간권 필터링 (이미 product가 로드되어 있음)
                    if (allMemberProducts != null) {
                        activePeriodPass = allMemberProducts.stream()
                            .filter(mp -> {
                                try {
                                    return mp.getProduct() != null && 
                                           mp.getProduct().getType() == Product.ProductType.MONTHLY_PASS &&
                                           mp.getStatus() == MemberProduct.Status.ACTIVE && 
                                           mp.getExpiryDate() != null;
                                } catch (Exception e) {
                                    logger.warn("기간권 필터링 중 오류 (MemberProduct ID: {}): {}", 
                                        mp != null ? mp.getId() : "null", e.getMessage());
                                    return false;
                                }
                            })
                            .filter(mp -> {
                                try {
                                    return mp.getExpiryDate().isAfter(LocalDate.now()) || 
                                           mp.getExpiryDate().isEqual(LocalDate.now());
                                } catch (Exception e) {
                                    return false;
                                }
                            })
                            .findFirst()
                            .orElse(null);
                    }
                } catch (Exception e) {
                    logger.warn("기간권 조회 실패 (Member ID: {}): {}", member.getId(), e.getMessage());
                }
                
                MemberResponseDTO dto = MemberResponseDTO.fromMember(member, totalPayment, latestLessonDate, 
                        remainingCount, allMemberProducts, activePeriodPass);
                memberDTOs.add(dto);
            } catch (Exception e) {
                logger.error("회원 DTO 변환 실패 (Member ID: {}): {}", 
                    member != null ? member.getId() : "null", e.getMessage(), e);
                // 개별 회원 변환 실패해도 계속 진행
            }
        }
        
        // 상품 카테고리별 필터링
        if (productCategory != null && !productCategory.trim().isEmpty()) {
            try {
                Product.ProductCategory categoryEnum = Product.ProductCategory.valueOf(productCategory.toUpperCase());
                
                memberDTOs = memberDTOs.stream()
                    .filter(memberDTO -> {
                        List<MemberResponseDTO.MemberProductInfo> memberProducts = memberDTO.getMemberProducts();
                        
                        if (memberProducts == null || memberProducts.isEmpty()) {
                            return false;
                        }
                        
                        return memberProducts.stream().anyMatch(mp -> {
                            if (!"ACTIVE".equals(mp.getStatus())) return false;
                            
                            MemberResponseDTO.ProductInfo product = mp.getProduct();
                            if (product == null) return false;
                            
                            String productCategoryStr = product.getCategory();
                            if (productCategoryStr == null || "GENERAL".equals(productCategoryStr)) return true;
                            
                            // 정확히 일치하는 경우
                            if (categoryEnum.name().equals(productCategoryStr)) {
                                return true;
                            }
                            
                            // TRAINING_FITNESS 요청 시: TRAINING_FITNESS, TRAINING, PILATES 모두 포함
                            if (categoryEnum == Product.ProductCategory.TRAINING_FITNESS) {
                                return "TRAINING_FITNESS".equals(productCategoryStr) ||
                                       "TRAINING".equals(productCategoryStr) ||
                                       "PILATES".equals(productCategoryStr);
                            }
                            
                            return false;
                        });
                    })
                    .collect(Collectors.toList());
                
                logger.info("회원 목록 카테고리 필터링: {} - {}명", categoryEnum, memberDTOs.size());
            } catch (IllegalArgumentException e) {
                logger.warn("잘못된 상품 카테고리 파라미터: {}", productCategory);
            }
        }
        
        // 지점별 필터링 (코치의 배정 지점 기준)
        // 야구(BASEBALL)는 모든 지점에서 가능하므로 필터링하지 않음
        // 트레이닝+필라테스(TRAINING_FITNESS)만 지점별로 필터링
        if (branch != null && !branch.trim().isEmpty() && 
            productCategory != null && !productCategory.trim().isEmpty() &&
            !productCategory.toUpperCase().equals("BASEBALL")) {
            try {
                String branchUpper = branch.trim().toUpperCase();
                memberDTOs = memberDTOs.stream()
                    .filter(memberDTO -> {
                        // 회원의 담당 코치 확인
                        if (memberDTO.getCoach() != null && memberDTO.getCoach().getId() != null) {
                            try {
                                Optional<Coach> coachOpt = coachRepository.findById(memberDTO.getCoach().getId());
                                if (coachOpt.isPresent()) {
                                    Coach coach = coachOpt.get();
                                    if (coach.getAvailableBranches() != null) {
                                        String[] branches = coach.getAvailableBranches().split(",");
                                        for (String b : branches) {
                                            if (b.trim().toUpperCase().equals(branchUpper)) {
                                                return true; // 회원의 담당 코치가 해당 지점에 배정됨
                                            }
                                        }
                                    }
                                }
                            } catch (Exception e) {
                                logger.warn("코치 정보 조회 실패 (Coach ID: {}): {}", 
                                    memberDTO.getCoach().getId(), e.getMessage());
                            }
                        }
                        
                        // 회원의 활성 상품의 담당 코치 확인 (트레이닝+필라테스 관련 상품만)
                        List<MemberResponseDTO.MemberProductInfo> memberProducts = memberDTO.getMemberProducts();
                        if (memberProducts != null && !memberProducts.isEmpty()) {
                            for (MemberResponseDTO.MemberProductInfo mp : memberProducts) {
                                if (!"ACTIVE".equals(mp.getStatus())) continue;
                                
                                MemberResponseDTO.ProductInfo product = mp.getProduct();
                                if (product == null) continue;
                                
                                // 트레이닝+필라테스 관련 상품만 확인 (BASEBALL 제외)
                                String productCategoryStr = product.getCategory();
                                if (productCategoryStr != null && 
                                    ("BASEBALL".equals(productCategoryStr) || "RENTAL".equals(productCategoryStr))) {
                                    continue; // 야구/대관 상품은 지점 필터링 대상 아님
                                }
                                
                                // 상품의 담당 코치 확인
                                if (product.getCoach() != null && product.getCoach().getId() != null) {
                                    try {
                                        Optional<Coach> coachOpt = coachRepository.findById(product.getCoach().getId());
                                        if (coachOpt.isPresent()) {
                                            Coach coach = coachOpt.get();
                                            if (coach.getAvailableBranches() != null) {
                                                String[] branches = coach.getAvailableBranches().split(",");
                                                for (String b : branches) {
                                                    if (b.trim().toUpperCase().equals(branchUpper)) {
                                                        return true; // 상품의 담당 코치가 해당 지점에 배정됨
                                                    }
                                                }
                                            }
                                        }
                                    } catch (Exception e) {
                                        logger.warn("상품 코치 정보 조회 실패 (Coach ID: {}): {}", 
                                            product.getCoach().getId(), e.getMessage());
                                    }
                                }
                            }
                        }
                        
                        return false; // 해당 지점에 배정된 코치가 없음
                    })
                    .collect(Collectors.toList());
                
                logger.info("회원 목록 지점 필터링: {} (카테고리: {}) - {}명", branchUpper, productCategory, memberDTOs.size());
            } catch (Exception e) {
                logger.warn("지점 필터링 실패: {}", e.getMessage());
            }
        }
        
        return memberDTOs;
    }
    
    // 회원 등급 마이그레이션 (별도 트랜잭션으로 실행)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void migrateMemberGradesInSeparateTransaction() {
        migrateMemberGradesIfNeeded();
    }
    
    // NULL 허용 컬럼 마이그레이션 (별도 트랜잭션으로 실행)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void migrateNullableColumnsInSeparateTransaction() {
        migrateNullableColumnsIfNeeded();
    }
    
    // 회원 등급 마이그레이션 (필요한 경우)
    private void migrateMemberGradesIfNeeded() {
        try {
            logger.debug("마이그레이션: 기존 등급 값 확인 시작");
            // 기존 등급 값이 있는지 확인
            Integer regularCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM members WHERE grade = 'REGULAR'", 
                Integer.class
            );
            Integer regularMemberCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM members WHERE grade = 'REGULAR_MEMBER'", 
                Integer.class
            );
            Integer playerCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM members WHERE grade = 'PLAYER'", 
                Integer.class
            );

            int totalOldGrades = (regularCount != null ? regularCount : 0) + 
                                (regularMemberCount != null ? regularMemberCount : 0) + 
                                (playerCount != null ? playerCount : 0);

            logger.info("마이그레이션: 기존 등급 값 확인 완료 - REGULAR: {}, REGULAR_MEMBER: {}, PLAYER: {}, 총: {}건", 
                regularCount, regularMemberCount, playerCount, totalOldGrades);

            if (totalOldGrades > 0) {
                logger.info("회원 등급 마이그레이션 시작: {}건의 레코드 발견", totalOldGrades);

                try {
                    // CHECK 제약 조건 삭제 시도 (H2에서 enum에 대한 CHECK 제약 조건이 있을 수 있음)
                    // H2에서는 오류 메시지에 나온 제약 조건 이름을 직접 삭제 시도
                    String[] possibleConstraintNames = {
                        "CONSTRAINT_635", "CONSTRAINT_636", "CONSTRAINT_637",
                        "CHECK_GRADE", "MEMBERS_GRADE_CHECK"
                    };
                    
                    for (String constraintName : possibleConstraintNames) {
                        try {
                            jdbcTemplate.execute("ALTER TABLE members DROP CONSTRAINT IF EXISTS " + constraintName);
                            logger.debug("제약 조건 삭제 시도: {}", constraintName);
                        } catch (Exception e) {
                            // 제약 조건이 없거나 다른 이름일 수 있음 (무시)
                            logger.debug("제약 조건 삭제 실패 (무시): {} - {}", constraintName, e.getMessage());
                        }
                    }
                    
                    // H2에서 제약 조건 목록 조회 시도 (다양한 방법)
                    try {
                        List<Map<String, Object>> constraints = jdbcTemplate.queryForList(
                            "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
                            "WHERE TABLE_NAME = 'MEMBERS' AND CONSTRAINT_TYPE = 'CHECK'"
                        );
                        for (Map<String, Object> constraint : constraints) {
                            String constraintName = (String) constraint.get("CONSTRAINT_NAME");
                            if (constraintName != null) {
                                try {
                                    jdbcTemplate.execute("ALTER TABLE members DROP CONSTRAINT " + constraintName);
                                    logger.info("CHECK 제약 조건 삭제: {}", constraintName);
                                } catch (Exception e) {
                                    logger.debug("제약 조건 삭제 실패 (무시): {}", constraintName);
                                }
                            }
                        }
                    } catch (Exception e) {
                        logger.debug("제약 조건 목록 조회 실패 (무시): {}", e.getMessage());
                    }

                    // REGULAR -> SOCIAL (사회인)
                    if (regularCount != null && regularCount > 0) {
                        int updated = jdbcTemplate.update("UPDATE members SET grade = 'SOCIAL' WHERE grade = 'REGULAR'");
                        logger.info("REGULAR -> SOCIAL 마이그레이션 완료: {}건", updated);
                    }

                    // REGULAR_MEMBER -> ELITE (엘리트)
                    if (regularMemberCount != null && regularMemberCount > 0) {
                        int updated = jdbcTemplate.update("UPDATE members SET grade = 'ELITE' WHERE grade = 'REGULAR_MEMBER'");
                        logger.info("REGULAR_MEMBER -> ELITE 마이그레이션 완료: {}건", updated);
                    }

                    // PLAYER -> YOUTH (유소년)
                    if (playerCount != null && playerCount > 0) {
                        int updated = jdbcTemplate.update("UPDATE members SET grade = 'YOUTH' WHERE grade = 'PLAYER'");
                        logger.info("PLAYER -> YOUTH 마이그레이션 완료: {}건", updated);
                    }

                    logger.info("회원 등급 마이그레이션 완료");
                } catch (Exception e) {
                    logger.error("마이그레이션 실행 중 오류: {}", e.getMessage(), e);
                    throw e;
                }
            } else {
                logger.debug("마이그레이션: 변환할 등급 값이 없습니다.");
            }
        } catch (Exception e) {
            // 테이블이 아직 생성되지 않았거나 다른 오류가 발생한 경우 무시
            logger.warn("마이그레이션 실행 중 오류: {}", e.getMessage(), e);
        }
    }
    
    // NULL 허용 컬럼 마이그레이션 (필요한 경우)
    private void migrateNullableColumnsIfNeeded() {
        try {
            logger.debug("마이그레이션: NULL 허용 컬럼 마이그레이션 시작");
            
            // H2에서 컬럼 정보 확인
            try {
                List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME, IS_NULLABLE, TYPE_NAME " +
                    "FROM INFORMATION_SCHEMA.COLUMNS " +
                    "WHERE TABLE_NAME = 'MEMBERS' AND COLUMN_NAME IN ('BIRTH_DATE', 'HEIGHT', 'WEIGHT')"
                );
                
                for (Map<String, Object> column : columns) {
                    String columnName = (String) column.get("COLUMN_NAME");
                    String isNullable = (String) column.get("IS_NULLABLE");
                    String typeName = (String) column.get("TYPE_NAME");
                    
                    if ("NO".equals(isNullable)) {
                        logger.info("컬럼 {}이 NOT NULL로 설정되어 있음. NULL 허용으로 변경 시도", columnName);
                        try {
                            // H2 2.x에서 컬럼을 NULL 허용으로 변경
                            // 여러 방법을 시도
                            String[] alterStatements = {
                                // 방법 1: SET NULL (H2 2.x)
                                String.format("ALTER TABLE members ALTER COLUMN %s SET NULL", columnName),
                                // 방법 2: 컬럼 타입 재지정 (H2 2.x)
                                String.format("ALTER TABLE members ALTER COLUMN %s %s NULL", columnName, typeName),
                                // 방법 3: DROP NOT NULL (일부 H2 버전)
                                String.format("ALTER TABLE members ALTER COLUMN %s DROP NOT NULL", columnName)
                            };
                            
                            boolean success = false;
                            for (String sql : alterStatements) {
                                try {
                                    jdbcTemplate.execute(sql);
                                    logger.info("컬럼 {}을 NULL 허용으로 변경 완료: {}", columnName, sql);
                                    success = true;
                                    break;
                                } catch (Exception e) {
                                    logger.debug("컬럼 {} NULL 허용 변경 시도 실패: {} - {}", columnName, sql, e.getMessage());
                                }
                            }
                            
                            if (!success) {
                                logger.warn("컬럼 {} NULL 허용 변경 실패: 모든 방법 시도 실패", columnName);
                            }
                        } catch (Exception e) {
                            logger.warn("컬럼 {} NULL 허용 변경 중 오류: {}", columnName, e.getMessage());
                        }
                    } else {
                        logger.debug("컬럼 {}은 이미 NULL 허용", columnName);
                    }
                }
            } catch (Exception e) {
                logger.debug("컬럼 정보 확인 실패 (무시): {}", e.getMessage());
            }
            
            logger.info("NULL 허용 컬럼 마이그레이션 완료");
        } catch (Exception e) {
            // 테이블이 아직 생성되지 않았거나 다른 오류가 발생한 경우 무시
            logger.warn("NULL 허용 컬럼 마이그레이션 실행 중 오류: {}", e.getMessage(), e);
        }
    }

    // 회원 검색 (이름)
    @Transactional(readOnly = true)
    public List<Member> searchMembersByName(String name) {
        return memberRepository.findByNameContaining(name);
    }
    
    // 회원 검색 (회원번호)
    @Transactional(readOnly = true)
    public List<Member> searchMembersByMemberNumber(String memberNumber) {
        return memberRepository.findByMemberNumberContaining(memberNumber);
    }
    
    // 회원 검색 (전화번호)
    @Transactional(readOnly = true)
    public List<Member> searchMembersByPhoneNumber(String phoneNumber) {
        return memberRepository.findByPhoneNumberContaining(phoneNumber);
    }

    // 회원 수정
    public Member updateMember(Long id, Member updatedMember) {
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        
        // 기존 회원번호 저장 (소급 등록 시 불변 유지용)
        String originalMemberNumber = member.getMemberNumber();
        
        // 전화번호 변경 여부 확인 (null-safe)
        boolean phoneNumberChanged = (member.getPhoneNumber() == null && updatedMember.getPhoneNumber() != null) ||
                                     (member.getPhoneNumber() != null && !member.getPhoneNumber().equals(updatedMember.getPhoneNumber()));
        boolean guardianPhoneChanged = (member.getGuardianPhone() == null && updatedMember.getGuardianPhone() != null) ||
                                      (member.getGuardianPhone() != null && !member.getGuardianPhone().equals(updatedMember.getGuardianPhone()));
        
        // 전화번호 중복 체크 제거 (형제/가족이 같은 번호 사용 가능)
        logger.debug("전화번호 중복 체크 생략 (형제/가족 등록 지원)");
        
        // 소급 등록 여부 확인: 가입일/등록일시만 변경하고 전화번호는 변경하지 않은 경우
        boolean isBackdateOnly = (updatedMember.getJoinDate() != null || updatedMember.getCreatedAt() != null) &&
                                 !phoneNumberChanged && !guardianPhoneChanged &&
                                 (member.getName() != null && member.getName().equals(updatedMember.getName())) &&
                                 ((member.getBirthDate() == null && updatedMember.getBirthDate() == null) ||
                                  (member.getBirthDate() != null && updatedMember.getBirthDate() != null && 
                                   member.getBirthDate().equals(updatedMember.getBirthDate())));
        
        member.setName(updatedMember.getName());
        member.setPhoneNumber(updatedMember.getPhoneNumber());
        member.setBirthDate(updatedMember.getBirthDate());
        member.setGender(updatedMember.getGender());
        member.setHeight(updatedMember.getHeight());
        member.setWeight(updatedMember.getWeight());
        member.setAddress(updatedMember.getAddress());
        member.setMemo(updatedMember.getMemo());
        
        // 가입일 소급 변경 지원
        if (updatedMember.getJoinDate() != null) {
            member.setJoinDate(updatedMember.getJoinDate());
        }
        
        // 등록일시 소급 변경 지원
        if (updatedMember.getCreatedAt() != null) {
            member.setCreatedAt(updatedMember.getCreatedAt());
        }
        if (updatedMember.getGrade() != null) {
            member.setGrade(updatedMember.getGrade());
        }
        if (updatedMember.getStatus() != null) {
            member.setStatus(updatedMember.getStatus());
        }
        if (updatedMember.getCoachMemo() != null) {
            member.setCoachMemo(updatedMember.getCoachMemo());
        }
        if (updatedMember.getGuardianName() != null) {
            member.setGuardianName(updatedMember.getGuardianName());
        }
        if (updatedMember.getGuardianPhone() != null) {
            member.setGuardianPhone(updatedMember.getGuardianPhone());
        }
        if (updatedMember.getSchool() != null) {
            member.setSchool(updatedMember.getSchool());
        }
        // 훈련 기록 (야구 기록)
        member.setSwingSpeed(updatedMember.getSwingSpeed());
        member.setExitVelocity(updatedMember.getExitVelocity());
        member.setPitchingSpeed(updatedMember.getPitchingSpeed());
        // 코치 설정
        if (updatedMember.getCoach() != null && updatedMember.getCoach().getId() != null) {
            Coach coach = coachRepository.findById(updatedMember.getCoach().getId())
                    .orElseThrow(() -> new IllegalArgumentException("코치를 찾을 수 없습니다."));
            member.setCoach(coach);
        } else {
            member.setCoach(null);
        }
        
        // 소급 등록 시 회원번호는 절대 변경하지 않음 (불변)
        if (isBackdateOnly) {
            // 소급 등록 시 기존 회원번호 유지
            member.setMemberNumber(originalMemberNumber);
        } else if (phoneNumberChanged || guardianPhoneChanged) {
            // 전화번호가 변경된 경우에만 회원번호 업데이트
            String newMemberNumber = updateMemberNumber(member);
            member.setMemberNumber(newMemberNumber);
        } else {
            // 전화번호가 변경되지 않았으면 기존 회원번호 유지
            member.setMemberNumber(originalMemberNumber);
        }
        
        return memberRepository.save(member);
    }
    
    // 회원번호 업데이트 (전화번호 변경 시)
    // 주의: 회원번호의 순번 부분은 유지하고, 전화번호 부분만 업데이트합니다.
    // 이는 회원번호의 순번이 ID와 별개이며, 등록 순서를 나타내기 때문입니다.
    private String updateMemberNumber(Member member) {
        // 기존 회원번호에서 회원등록 순번 추출 (순번은 유지)
        String currentMemberNumber = member.getMemberNumber();
        int registrationOrder = 1;
        
        if (currentMemberNumber != null && currentMemberNumber.startsWith("M") && currentMemberNumber.length() > 1) {
            try {
                // M112345678 형식에서 순번 추출 (M 다음부터 전화번호 시작 전까지)
                // 전화번호는 8자리이므로, M 다음부터 8자리 전까지가 순번
                String numberPart = currentMemberNumber.substring(1);
                if (numberPart.length() > 8) {
                    // 순번 부분 추출 (전체 길이 - 8자리 전화번호)
                    String orderPart = numberPart.substring(0, numberPart.length() - 8);
                    registrationOrder = Integer.parseInt(orderPart);
                } else {
                    // 기존 형식이 아니면 기존 회원번호의 순번을 유지할 수 없으므로 새로 생성
                    // 이 경우는 기존 회원번호가 잘못된 형식인 경우
                    long totalMembers = memberRepository.count();
                    registrationOrder = (int) (totalMembers + 1);
                }
            } catch (NumberFormatException e) {
                // 파싱 실패 시 기존 회원번호의 순번을 유지할 수 없으므로 새로 생성
                long totalMembers = memberRepository.count();
                registrationOrder = (int) (totalMembers + 1);
            }
        } else {
            // 회원번호가 없거나 형식이 잘못된 경우 새로 생성
            long totalMembers = memberRepository.count();
            registrationOrder = (int) (totalMembers + 1);
        }
        
        // 전화번호 추출 (회원 전화번호 우선, 없으면 보호자 번호)
        String phoneNumber = member.getPhoneNumber();
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            phoneNumber = member.getGuardianPhone();
        }
        
        // 전화번호가 없으면 기본값 사용 (00000000)
        String phonePart = "00000000";
        if (phoneNumber != null && !phoneNumber.trim().isEmpty()) {
            // 숫자만 추출
            String digitsOnly = phoneNumber.replaceAll("[^0-9]", "");
            
            // 010으로 시작하면 제거
            if (digitsOnly.startsWith("010")) {
                digitsOnly = digitsOnly.substring(3);
            }
            
            // 8자리로 맞추기 (부족하면 앞에 0 추가, 넘치면 뒤에서 8자리만)
            if (digitsOnly.length() > 8) {
                phonePart = digitsOnly.substring(digitsOnly.length() - 8);
            } else if (digitsOnly.length() < 8) {
                phonePart = String.format("%08d", Long.parseLong(digitsOnly));
            } else {
                phonePart = digitsOnly;
            }
        }
        
        // M + 회원등록 순번(기존 유지) + 휴대폰번호(새로 업데이트) 형식
        return String.format("M%d%s", registrationOrder, phonePart);
    }

    // 회원 삭제
    // 주의: ID는 자동 증가하므로 재정렬하지 않습니다.
    // 회원번호는 삭제되어도 기존 순번을 유지합니다 (다른 회원의 회원번호는 변경되지 않음).
    @Transactional(rollbackFor = Exception.class)
    public void deleteMember(Long id) {
        // 회원 존재 여부 확인 (JdbcTemplate 사용)
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM members WHERE id = ?", 
                Integer.class, 
                id
            );
            if (count == null || count == 0) {
                throw new IllegalArgumentException("회원을 찾을 수 없습니다.");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            logger.warn("회원 존재 여부 확인 실패: {}", e.getMessage());
            // JPA로 재시도
            if (!memberRepository.existsById(id)) {
                throw new IllegalArgumentException("회원을 찾을 수 없습니다.");
            }
        }
        
        logger.info("회원 삭제 시작: ID={}", id);
        
        try {
            // JPA deleteById는 내부적으로 엔티티를 로드할 수 있으므로,
            // enum 변환 오류를 방지하기 위해 JdbcTemplate으로 직접 삭제
            // H2 MODE=MySQL이므로 테이블/컬럼 이름은 대소문자 구분 없음
            
            // 관련 엔티티 삭제 (외래키 제약 조건을 고려한 순서)
            // Payment와 Attendance가 Booking을 참조하므로, Booking 삭제 전에 먼저 삭제해야 함
            
            // 1. Payment 삭제 (Booking을 참조하므로 먼저 삭제)
            try {
                jdbcTemplate.update("DELETE FROM payments WHERE member_id = ?", id);
                logger.info("Payment 삭제 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("Payment 삭제 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 2. Attendance 삭제 (Booking을 참조하므로 Booking 삭제 전에 먼저 삭제)
            try {
                jdbcTemplate.update("DELETE FROM attendances WHERE member_id = ?", id);
                logger.info("Attendance 삭제 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("Attendance 삭제 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 3. Booking의 memberProduct 참조를 null로 설정 (외래키 제약 조건 해제)
            try {
                jdbcTemplate.update("UPDATE bookings SET member_product_id = NULL WHERE member_id = ?", id);
                logger.info("Booking의 memberProduct 참조 제거 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("Booking의 memberProduct 참조 제거 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 4. Booking 삭제 (Payment와 Attendance가 이미 삭제되었으므로 안전)
            try {
                jdbcTemplate.update("DELETE FROM bookings WHERE member_id = ?", id);
                logger.info("Booking 삭제 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("Booking 삭제 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 5. TrainingLog 삭제
            try {
                jdbcTemplate.update("DELETE FROM training_logs WHERE member_id = ?", id);
                logger.info("TrainingLog 삭제 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("TrainingLog 삭제 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 6. BaseballRecord 삭제
            try {
                jdbcTemplate.update("DELETE FROM baseball_records WHERE member_id = ?", id);
                logger.info("BaseballRecord 삭제 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("BaseballRecord 삭제 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 7. MemberProduct 삭제
            try {
                jdbcTemplate.update("DELETE FROM member_products WHERE member_id = ?", id);
                logger.info("MemberProduct 삭제 완료: Member ID={}", id);
            } catch (Exception e) {
                logger.warn("MemberProduct 삭제 실패 (무시): Member ID={}, 오류: {}", id, e.getMessage());
            }
            
            // 8. 마지막으로 Member 삭제 (이것만 실패하면 안됨)
            int deleted = jdbcTemplate.update("DELETE FROM members WHERE id = ?", id);
            if (deleted == 0) {
                throw new IllegalArgumentException("회원을 찾을 수 없습니다.");
            }
            logger.info("회원 삭제 성공: ID={}", id);
            
            // ID는 자동 증가하므로 재정렬하지 않음
            // 회원번호는 삭제되어도 기존 순번 유지 (다른 회원의 회원번호 변경 없음)
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            logger.error("회원 삭제 중 외래키 제약 조건 위반: ID={}, 오류: {}", id, e.getMessage(), e);
            throw new IllegalArgumentException("회원을 삭제할 수 없습니다. 관련 데이터가 존재합니다: " + e.getMessage(), e);
        } catch (Exception e) {
            logger.error("회원 삭제 중 오류 발생: ID={}, 오류: {}", id, e.getMessage(), e);
            throw new RuntimeException("회원 삭제 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
    
    // 참고: ID 재정렬 기능은 제거되었습니다.
    // ID는 데이터베이스가 자동으로 관리하며 (1, 2, 3... 순서대로 증가),
    // 회원번호(memberNumber)는 별도로 관리됩니다.
    // 
    // ID와 회원번호의 차이:
    // - ID: 데이터베이스 기본키, 자동 증가 (삭제 후에도 증가)
    // - 회원번호: M + 등록순번 + 전화번호 형식, 실제 등록 순서를 나타냄
    // 
    // 예시:
    // - 회원1 등록: ID=1, 회원번호=M112345678
    // - 회원2 등록: ID=2, 회원번호=M212345678
    // - 회원1 삭제 후 회원3 등록: ID=3, 회원번호=M312345678
    //   (ID는 3이지만, 회원번호의 순번은 3번째 등록을 의미)
    
    /**
     * 모든 회원 삭제 (위험한 작업 - 주의 필요)
     * 관련된 모든 데이터도 함께 삭제됩니다.
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteAllMembers() {
        try {
            logger.warn("⚠️ 회원 전체 삭제 시작");
            
            // H2에서 외래키 제약 조건 일시적으로 비활성화
            jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY FALSE");
            
            try {
                // 관련 데이터 삭제 순서 (외래키 제약 조건 고려)
                // 1. Payments
                int paymentsDeleted = jdbcTemplate.update("DELETE FROM payments");
                logger.info("Payment 삭제 완료: {} 건", paymentsDeleted);
                
                // 2. Attendances
                int attendancesDeleted = jdbcTemplate.update("DELETE FROM attendances");
                logger.info("Attendance 삭제 완료: {} 건", attendancesDeleted);
                
                // 3. Bookings
                int bookingsDeleted = jdbcTemplate.update("DELETE FROM bookings");
                logger.info("Booking 삭제 완료: {} 건", bookingsDeleted);
                
                // 4. TrainingLogs
                int trainingLogsDeleted = jdbcTemplate.update("DELETE FROM training_logs");
                logger.info("TrainingLog 삭제 완료: {} 건", trainingLogsDeleted);
                
                // 5. BaseballRecords
                int baseballRecordsDeleted = jdbcTemplate.update("DELETE FROM baseball_records");
                logger.info("BaseballRecord 삭제 완료: {} 건", baseballRecordsDeleted);
                
                // 6. MemberProducts
                int memberProductsDeleted = jdbcTemplate.update("DELETE FROM member_products");
                logger.info("MemberProduct 삭제 완료: {} 건", memberProductsDeleted);
                
                // 7. Messages
                int messagesDeleted = jdbcTemplate.update("DELETE FROM messages");
                logger.info("Message 삭제 완료: {} 건", messagesDeleted);
                
                // 8. 마지막으로 Members 삭제
                int membersDeleted = jdbcTemplate.update("DELETE FROM members");
                logger.warn("⚠️ Member 삭제 완료: {} 건", membersDeleted);
                
            } finally {
                // 외래키 제약 조건 다시 활성화
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
            }
            
            logger.warn("⚠️ 회원 전체 삭제 완료");
        } catch (Exception e) {
            logger.error("회원 전체 삭제 중 오류 발생: {}", e.getMessage(), e);
            // 오류 발생 시에도 외래키 제약 조건 다시 활성화 시도
            try {
                jdbcTemplate.execute("SET REFERENTIAL_INTEGRITY TRUE");
            } catch (Exception ex) {
                logger.warn("외래키 제약 조건 재활성화 실패: {}", ex.getMessage());
            }
            throw new RuntimeException("회원 전체 삭제 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }
}
