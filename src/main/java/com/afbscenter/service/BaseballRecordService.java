package com.afbscenter.service;

import com.afbscenter.model.BaseballRecord;
import com.afbscenter.model.Member;
import com.afbscenter.repository.BaseballRecordRepository;
import com.afbscenter.repository.MemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class BaseballRecordService {

    private final BaseballRecordRepository baseballRecordRepository;
    private final MemberRepository memberRepository;

    // 생성자 주입 (Spring 4.3+에서는 @Autowired 불필요)
    public BaseballRecordService(BaseballRecordRepository baseballRecordRepository, 
                                 MemberRepository memberRepository) {
        this.baseballRecordRepository = baseballRecordRepository;
        this.memberRepository = memberRepository;
    }

    // 기록 생성
    public BaseballRecord createRecord(Long memberId, BaseballRecord record) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다."));
        record.setMember(member);
        return baseballRecordRepository.save(record);
    }

    // 전체 기록 조회
    @Transactional(readOnly = true)
    public List<BaseballRecord> getAllRecords() {
        return baseballRecordRepository.findAll();
    }

    // 기록 조회 (ID)
    @Transactional(readOnly = true)
    public Optional<BaseballRecord> getRecordById(Long id) {
        return baseballRecordRepository.findById(id);
    }

    // 회원의 모든 기록 조회
    @Transactional(readOnly = true)
    public List<BaseballRecord> getRecordsByMember(Long memberId) {
        return baseballRecordRepository.findByMemberIdOrderByRecordDateDesc(memberId);
    }

    // 기간별 기록 조회
    @Transactional(readOnly = true)
    public List<BaseballRecord> getRecordsByDateRange(LocalDate startDate, LocalDate endDate) {
        return baseballRecordRepository.findByRecordDateBetween(startDate, endDate);
    }

    // 기록 수정
    public BaseballRecord updateRecord(Long id, BaseballRecord updatedRecord) {
        BaseballRecord record = baseballRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("기록을 찾을 수 없습니다."));
        
        record.setRecordDate(updatedRecord.getRecordDate());
        record.setPosition(updatedRecord.getPosition());
        record.setAtBats(updatedRecord.getAtBats());
        record.setHits(updatedRecord.getHits());
        record.setHomeRuns(updatedRecord.getHomeRuns());
        record.setRunsBattedIn(updatedRecord.getRunsBattedIn());
        record.setStrikeouts(updatedRecord.getStrikeouts());
        record.setWalks(updatedRecord.getWalks());
        record.setInningsPitched(updatedRecord.getInningsPitched());
        record.setEarnedRuns(updatedRecord.getEarnedRuns());
        record.setStrikeoutsPitched(updatedRecord.getStrikeoutsPitched());
        record.setWalksPitched(updatedRecord.getWalksPitched());
        record.setHitsAllowed(updatedRecord.getHitsAllowed());
        record.setNotes(updatedRecord.getNotes());
        
        return baseballRecordRepository.save(record);
    }

    // 기록 삭제
    public void deleteRecord(Long id) {
        if (!baseballRecordRepository.existsById(id)) {
            throw new IllegalArgumentException("기록을 찾을 수 없습니다.");
        }
        baseballRecordRepository.deleteById(id);
    }

    // 평균 타율 계산
    @Transactional(readOnly = true)
    public Double calculateAverageBattingAverage(Long memberId) {
        return baseballRecordRepository.calculateAverageBattingAverage(memberId);
    }
}
