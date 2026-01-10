package com.afbscenter.service;

import com.afbscenter.model.Coach;
import com.afbscenter.model.Member;
import com.afbscenter.repository.CoachRepository;
import com.afbscenter.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class MemberService {

    private final MemberRepository memberRepository;
    private final CoachRepository coachRepository;
    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public MemberService(MemberRepository memberRepository, CoachRepository coachRepository, JdbcTemplate jdbcTemplate) {
        this.memberRepository = memberRepository;
        this.coachRepository = coachRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    // 회원 생성
    public Member createMember(Member member) {
        // 전화번호 중복 체크
        if (memberRepository.findByPhoneNumber(member.getPhoneNumber()).isPresent()) {
            throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
        }
        // 등록 일자 및 시간 자동 설정
        if (member.getJoinDate() == null) {
            member.setJoinDate(java.time.LocalDate.now());
        }
        // 등록일시 설정 (소급 등록 지원: 프론트엔드에서 설정한 값이 있으면 사용, 없으면 현재 시간)
        if (member.getCreatedAt() == null) {
            member.setCreatedAt(java.time.LocalDateTime.now());
        }
        // 회원번호 자동 생성 (없는 경우만)
        if (member.getMemberNumber() == null || member.getMemberNumber().trim().isEmpty()) {
            String memberNumber = generateMemberNumber(member);
            member.setMemberNumber(memberNumber);
        }
        return memberRepository.save(member);
    }
    
    // 회원번호 자동 생성 (M + 회원등록 순번 + 휴대폰번호(010 제외))
    // 주의: 회원번호의 순번은 ID와 별개로 실제 등록된 회원 수를 기준으로 계산됩니다.
    // ID는 데이터베이스가 자동으로 관리하며 (1, 2, 3...), 회원번호는 별도로 관리됩니다.
    private String generateMemberNumber(Member member) {
        // 회원 등록 순번 계산 (실제 등록된 회원 수 + 1)
        // 이 순번은 ID와 별개이며, 실제 등록 순서를 나타냅니다.
        long totalMembers = memberRepository.count();
        int registrationOrder = (int) (totalMembers + 1);
        
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
        
        // M + 회원등록 순번 + 휴대폰번호(010 제외) 형식
        // 예: M112345678 (M + 등록순번1 + 전화번호12345678)
        return String.format("M%d%s", registrationOrder, phonePart);
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
        
        // 전화번호 변경 시 중복 체크
        if (phoneNumberChanged && updatedMember.getPhoneNumber() != null) {
            Optional<Member> existingMember = memberRepository.findByPhoneNumber(updatedMember.getPhoneNumber());
            if (existingMember.isPresent() && !existingMember.get().getId().equals(id)) {
                throw new IllegalArgumentException("이미 등록된 전화번호입니다.");
            }
        }
        
        // 소급 등록 여부 확인: 가입일/등록일시만 변경하고 전화번호는 변경하지 않은 경우
        boolean isBackdateOnly = (updatedMember.getJoinDate() != null || updatedMember.getCreatedAt() != null) &&
                                 !phoneNumberChanged && !guardianPhoneChanged &&
                                 (member.getName().equals(updatedMember.getName())) &&
                                 (member.getBirthDate().equals(updatedMember.getBirthDate()));
        
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
    public void deleteMember(Long id) {
        if (!memberRepository.existsById(id)) {
            throw new IllegalArgumentException("회원을 찾을 수 없습니다.");
        }
        memberRepository.deleteById(id);
        // ID는 자동 증가하므로 재정렬하지 않음
        // 회원번호는 삭제되어도 기존 순번 유지 (다른 회원의 회원번호 변경 없음)
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
}
