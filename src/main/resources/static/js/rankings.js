// 훈련 랭킹 페이지 JavaScript

let currentDays = 7;
let currentStartDate = null;
let currentEndDate = null;
let currentGrade = 'ALL';

/** 관리자 비밀번호 입력 시 true → 이름/회원번호 마스킹 해제 (관리자 외 등급용) */
let rankingsPrivacyUnlocked = false;

/** 관리자(ADMIN)는 항상 전체 표시, 그 외는 비밀번호 해제 시 또는 마스킹 */
function canShowRankingPrivacy() {
    return (App.currentRole === 'ADMIN') || rankingsPrivacyUnlocked;
}

function maskRankingName(name) {
    if (name == null || name === '') return '-';
    if (canShowRankingPrivacy()) return name;
    return name.charAt(0) + '**';
}

function maskRankingMemberNumber(memberNumber) {
    if (memberNumber == null || memberNumber === '') return '-';
    if (canShowRankingPrivacy()) return String(memberNumber);
    var len = String(memberNumber).length;
    return len > 0 ? '*'.repeat(len) : '***';
}

document.addEventListener('DOMContentLoaded', function() {
    // 관리자는 랭킹에서 이름이 이미 전체 표시되므로 열람 버튼 숨김 / 그 외 등급만 버튼 표시
    var rankingsViewBtn = document.getElementById('rankings-unlock-btn');
    if (rankingsViewBtn) rankingsViewBtn.style.display = (App.currentRole === 'ADMIN') ? 'none' : '';
    // 기본 7일 랭킹 로드
    loadRankings(7);
    
    // 기간 선택 버튼 이벤트
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const days = parseInt(this.getAttribute('data-days'));
            currentDays = days;
            currentStartDate = null;
            currentEndDate = null;
            loadRankings(days);
        });
    });
    
    // 등급 필터 변경 이벤트
    document.getElementById('grade-filter').addEventListener('change', function() {
        currentGrade = this.value;
        if (currentStartDate && currentEndDate) {
            loadRankings(null, currentStartDate, currentEndDate);
        } else {
            loadRankings(currentDays);
        }
    });
});

async function loadRankings(days, startDate = null, endDate = null) {
    try {
        // 기간 계산
        let start, end;
        if (startDate && endDate) {
            start = startDate;
            end = endDate;
        } else {
            end = new Date().toISOString().split('T')[0];
            const startDateObj = new Date();
            startDateObj.setDate(startDateObj.getDate() - days);
            start = startDateObj.toISOString().split('T')[0];
        }
        
        // 회원 목록 로드 (회원 기록 포함 - 스윙 속도용)
        const members = await App.api.get('/members');
        
        // 훈련 기록 랭킹 API 호출 (타구 속도, 구속, 훈련 횟수용)
        const trainingRankingsParams = new URLSearchParams({
            startDate: start,
            endDate: end,
            days: days || Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24))
        });
        if (currentGrade !== 'ALL') {
            trainingRankingsParams.append('grade', currentGrade);
        }
        const trainingRankings = await App.api.get(`/training-logs/rankings?${trainingRankingsParams.toString()}`);
        
        // 디버깅: API 응답 확인
        App.log('훈련 기록 랭킹 API 응답:', trainingRankings);
        App.log('스윙 속도 랭킹:', trainingRankings.swingSpeedRanking);
        App.log('타구 속도 랭킹:', trainingRankings.ballSpeedRanking);
        App.log('구속 랭킹:', trainingRankings.pitchSpeedRanking);
        App.log('훈련 횟수 랭킹:', trainingRankings.recordCountRanking);
        App.log('조회 기간:', start, '~', end);
        App.log('등급 필터:', currentGrade);
        
        // 디버깅: 회원 스윙 속도 확인
        const testMember = members.find(m => m.name === '테스트1');
        if (testMember) {
            App.log('테스트1 회원 정보:', testMember);
            App.log('테스트1 swingSpeed:', testMember.swingSpeed);
        }
        
        // 기간 정보 표시
        updatePeriodInfo({ start, end, days: days || Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) }, currentGrade);
        
        // 등급 필터링
        let filteredMembers = members;
        if (currentGrade !== 'ALL') {
            filteredMembers = members.filter(m => m.grade === currentGrade);
        }
        
        // 스윙 속도 랭킹: 회원 기록 + 훈련 기록 최고값 병합
        const swingSpeedRanking = buildSwingSpeedRanking(filteredMembers, trainingRankings.swingSpeedRanking || []);
        renderSwingSpeedRanking('swing-speed-ranking', swingSpeedRanking);
        
        // 타구 속도: 훈련 기록 기반
        renderTrainingLogRanking('exit-velocity-ranking', trainingRankings.ballSpeedRanking || [], 'ballSpeedMax', '⚡ 타구 속도', 'km/h', '훈련 기록');
        
        // 구속: 훈련 기록 기반
        renderTrainingLogRanking('pitching-speed-ranking', trainingRankings.pitchSpeedRanking || [], 'pitchSpeedMax', '🔥 구속', 'km/h', '훈련 기록');
        
        // 훈련 횟수: 훈련 기록 기반
        renderTrainingCountRanking('attendance-count-ranking', trainingRankings.recordCountRanking || []);
        
    } catch (error) {
        App.err('랭킹 조회 실패:', error);
        App.showNotification('랭킹을 불러오는데 실패했습니다.', 'danger');
    }
}

function updatePeriodInfo(period, filterGrade) {
    const periodInfo = document.getElementById('period-info');
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    
    const gradeLabel = {
        'ALL': '전체',
        'SOCIAL': '사회인',
        'ELITE': '엘리트',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    }[filterGrade || 'ALL'];
    
    periodInfo.innerHTML = `
        <strong>${period.start}</strong> ~ <strong>${period.end}</strong> 
        (${period.days}일간) 
        <span style="margin-left: 16px; padding: 4px 12px; background: var(--accent-primary); color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">${gradeLabel}</span>
        <span style="margin-left: 8px; color: var(--text-muted);">최종 업데이트: ${new Date().toLocaleString('ko-KR')}</span>
    `;
}

// 스윙 속도 랭킹: 회원 기록과 훈련 기록 병합
function buildSwingSpeedRanking(members, trainingLogRanking) {
    // 회원 ID를 키로 하는 맵 생성
    const memberMap = new Map();
    
    // 1. 회원 기본 기록 추가
    members.forEach(member => {
        if (member.swingSpeed != null && member.swingSpeed > 0) {
            memberMap.set(member.id, {
                memberId: member.id,
                memberName: member.name,
                memberNumber: member.memberNumber,
                memberGrade: member.grade,
                swingSpeed: member.swingSpeed,
                source: '회원 등록 기록'
            });
        }
    });
    
    // 2. 훈련 기록의 최고값과 병합 (훈련 기록이 더 높으면 업데이트)
    trainingLogRanking.forEach(training => {
        const memberId = training.memberId;
        const trainingSwingSpeed = training.swingSpeedMax || 0;
        
        if (trainingSwingSpeed > 0) {
            const existing = memberMap.get(memberId);
            if (!existing || trainingSwingSpeed > existing.swingSpeed) {
                memberMap.set(memberId, {
                    memberId: memberId,
                    memberName: training.memberName,
                    memberNumber: training.memberNumber,
                    memberGrade: training.memberGrade,
                    swingSpeed: trainingSwingSpeed,
                    source: '훈련 기록'
                });
            }
        }
    });
    
    // 배열로 변환하고 정렬
    return Array.from(memberMap.values())
        .sort((a, b) => b.swingSpeed - a.swingSpeed)
        .slice(0, 10);
}

// 스윙 속도 랭킹 렌더링
function renderSwingSpeedRanking(containerId, rankingData) {
    const container = document.getElementById(containerId);
    
    if (!rankingData || rankingData.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트(초)',
        'ELITE_MIDDLE': '엘리트(중)',
        'ELITE_HIGH': '엘리트(고)',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    };
    
    // 동률 처리를 위한 순위 계산
    let currentRank = 1;
    let previousValue = null;
    
    container.innerHTML = rankingData.map((item, index) => {
        const value = item.swingSpeed;
        
        // 이전 값과 다르면 현재 인덱스+1이 새로운 순위
        if (previousValue !== null && previousValue !== value) {
            currentRank = index + 1;
        }
        previousValue = value;
        
        const rank = currentRank;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const itemBgClass = rank === 1 ? 'ranking-item-gold' : rank === 2 ? 'ranking-item-silver' : rank === 3 ? 'ranking-item-bronze' : '';
        const grade = item.memberGrade || 'SOCIAL';
        
        const memberId = item.memberId;
        const nameDisplay = maskRankingName(item.memberName);
        const numberDisplay = maskRankingMemberNumber(item.memberNumber);
        const memberLink = memberId ? `<a href="/members.html?openMember=${memberId}" class="ranking-member-link" title="회원 개인정보 보기">${nameDisplay}</a>` : nameDisplay;
        const numberLink = memberId ? `<a href="/members.html?openMember=${memberId}" class="ranking-member-link" title="회원 개인정보 보기">${numberDisplay}</a>` : numberDisplay;
        return `
            <div class="ranking-item ${itemBgClass}">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${memberLink}
                        <span class="ranking-grade-badge ranking-grade-${(grade || 'SOCIAL').toLowerCase().replace(/_/g, '-')}">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${numberLink}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${typeof value === 'number' ? value.toFixed(1) : value} mph</div>
                    <div class="ranking-sub-value">${item.source || '회원 등록 기록'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// 회원 기록 기반 랭킹 렌더링 (스윙속도, 타구속도, 구속)
function renderMemberRecordRanking(containerId, members, field, title, unit) {
    const container = document.getElementById(containerId);
    
    // 해당 필드에 값이 있는 회원만 필터링 및 정렬
    const rankedMembers = members
        .filter(m => m[field] != null && m[field] > 0)
        .sort((a, b) => b[field] - a[field])
        .slice(0, 10);
    
    if (rankedMembers.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트(초)',
        'ELITE_MIDDLE': '엘리트(중)',
        'ELITE_HIGH': '엘리트(고)',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    };
    
    // 동률 처리를 위한 순위 계산
    let currentRank = 1;
    let previousValue = null;
    
    container.innerHTML = rankedMembers.map((member, index) => {
        const value = member[field];
        
        // 이전 값과 다르면 현재 인덱스+1이 새로운 순위
        if (previousValue !== null && previousValue !== value) {
            currentRank = index + 1;
        }
        previousValue = value;
        
        const rank = currentRank;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const itemBgClass = rank === 1 ? 'ranking-item-gold' : rank === 2 ? 'ranking-item-silver' : rank === 3 ? 'ranking-item-bronze' : '';
        const grade = member.grade;
        
        return `
            <div class="ranking-item ${itemBgClass}">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${maskRankingName(member.name)}
                        <span class="ranking-grade-badge ranking-grade-${(grade || 'SOCIAL').toLowerCase().replace(/_/g, '-')}">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${maskRankingMemberNumber(member.memberNumber)}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${typeof value === 'number' ? value.toFixed(1) : value} ${unit}</div>
                    <div class="ranking-sub-value">회원 등록 기록</div>
                </div>
            </div>
        `;
    }).join('');
}

// 훈련 기록 기반 랭킹 렌더링 (타구 속도, 구속)
function renderTrainingLogRanking(containerId, rankingData, field, title, unit, sourceLabel) {
    const container = document.getElementById(containerId);
    
    // subtitle 업데이트
    if (containerId === 'exit-velocity-ranking') {
        const subtitle = document.getElementById('exit-velocity-subtitle');
        if (subtitle) subtitle.textContent = sourceLabel || '훈련 기록 기준';
    } else if (containerId === 'pitching-speed-ranking') {
        const subtitle = document.getElementById('pitching-speed-subtitle');
        if (subtitle) subtitle.textContent = sourceLabel || '훈련 기록 기준';
    }
    
    if (!rankingData || rankingData.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트(초)',
        'ELITE_MIDDLE': '엘리트(중)',
        'ELITE_HIGH': '엘리트(고)',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    };
    
    // 상위 10개만 표시
    const topRankings = rankingData.slice(0, 10);
    
    // 동률 처리를 위한 순위 계산
    let currentRank = 1;
    let previousValue = null;
    
    container.innerHTML = topRankings.map((item, index) => {
        const value = item[field];
        
        // 이전 값과 다르면 현재 인덱스+1이 새로운 순위
        if (previousValue !== null && previousValue !== value) {
            currentRank = index + 1;
        }
        previousValue = value;
        
        const rank = currentRank;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const itemBgClass = rank === 1 ? 'ranking-item-gold' : rank === 2 ? 'ranking-item-silver' : rank === 3 ? 'ranking-item-bronze' : '';
        const grade = item.memberGrade || 'SOCIAL';
        const memberId = item.memberId;
        const nameDisplay = maskRankingName(item.memberName);
        const numberDisplay = maskRankingMemberNumber(item.memberNumber);
        const memberLink = memberId ? `<a href="/members.html?openMember=${memberId}" class="ranking-member-link" title="회원 개인정보 보기">${nameDisplay}</a>` : nameDisplay;
        const numberLink = memberId ? `<a href="/members.html?openMember=${memberId}" class="ranking-member-link" title="회원 개인정보 보기">${numberDisplay}</a>` : numberDisplay;
        return `
            <div class="ranking-item ${itemBgClass}">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${memberLink}
                        <span class="ranking-grade-badge ranking-grade-${(grade || 'SOCIAL').toLowerCase().replace(/_/g, '-')}">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${numberLink}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${typeof value === 'number' ? value.toFixed(1) : value} ${unit}</div>
                    <div class="ranking-sub-value">${sourceLabel}</div>
                </div>
            </div>
        `;
    }).join('');
}

// 훈련 횟수 랭킹 렌더링 (훈련 기록 기반)
function renderTrainingCountRanking(containerId, rankingData) {
    const container = document.getElementById(containerId);
    
    if (!rankingData || rankingData.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트(초)',
        'ELITE_MIDDLE': '엘리트(중)',
        'ELITE_HIGH': '엘리트(고)',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    };
    
    // 상위 10개만 표시
    const topRankings = rankingData.slice(0, 10);
    
    // 동률 처리를 위한 순위 계산
    let currentRank = 1;
    let previousCount = null;
    
    container.innerHTML = topRankings.map((item, index) => {
        const count = item.totalRecords || 0;
        
        // 이전 값과 다르면 현재 인덱스+1이 새로운 순위
        if (previousCount !== null && previousCount !== count) {
            currentRank = index + 1;
        }
        previousCount = count;
        
        const rank = currentRank;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const itemBgClass = rank === 1 ? 'ranking-item-gold' : rank === 2 ? 'ranking-item-silver' : rank === 3 ? 'ranking-item-bronze' : '';
        const grade = item.memberGrade || 'SOCIAL';
        const memberId = item.memberId;
        const nameDisplay = maskRankingName(item.memberName);
        const numberDisplay = maskRankingMemberNumber(item.memberNumber);
        const memberLink = memberId ? `<a href="/members.html?openMember=${memberId}" class="ranking-member-link" title="회원 개인정보 보기">${nameDisplay}</a>` : nameDisplay;
        const numberLink = memberId ? `<a href="/members.html?openMember=${memberId}" class="ranking-member-link" title="회원 개인정보 보기">${numberDisplay}</a>` : numberDisplay;
        return `
            <div class="ranking-item ${itemBgClass}">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${memberLink}
                        <span class="ranking-grade-badge ranking-grade-${(grade || 'SOCIAL').toLowerCase().replace(/_/g, '-')}">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${numberLink}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${count}회</div>
                    <div class="ranking-sub-value">훈련 기록</div>
                </div>
            </div>
        `;
    }).join('');
}

function openRankingsViewModal() {
    var passwordEl = document.getElementById('rankings-view-password');
    if (passwordEl) passwordEl.value = '';
    var errorEl = document.getElementById('rankings-view-error');
    if (errorEl) errorEl.textContent = '';
    if (typeof App !== 'undefined' && App.Modal && App.Modal.open) {
        App.Modal.open('rankings-view-modal');
    } else {
        var el = document.getElementById('rankings-view-modal');
        if (el) el.classList.add('active');
    }
}

async function confirmRankingsViewPassword() {
    var passwordEl = document.getElementById('rankings-view-password');
    var errorEl = document.getElementById('rankings-view-error');
    var password = passwordEl && passwordEl.value ? passwordEl.value : '';
    if (!password) {
        if (errorEl) errorEl.textContent = '관리자 비밀번호를 입력해 주세요.';
        return;
    }
    try {
        var res = await App.api.post('/auth/verify-admin-password', { password: password });
        if (res && res.valid) {
            rankingsPrivacyUnlocked = true;
            if (typeof App !== 'undefined' && App.Modal && App.Modal.close) {
                App.Modal.close('rankings-view-modal');
            } else {
                var el = document.getElementById('rankings-view-modal');
                if (el) el.classList.remove('active');
            }
            App.showNotification('이름·회원번호가 표시됩니다.', 'success');
            if (currentStartDate && currentEndDate) {
                loadRankings(null, currentStartDate, currentEndDate);
            } else {
                loadRankings(currentDays);
            }
        } else {
            if (errorEl) errorEl.textContent = '관리자 비밀번호가 일치하지 않습니다.';
        }
    } catch (e) {
        App.err('랭킹 보기 인증 실패:', e);
        if (errorEl) errorEl.textContent = '확인 중 오류가 발생했습니다.';
    }
}

function loadCustomPeriod() {
    const startDate = document.getElementById('custom-start-date').value;
    const endDate = document.getElementById('custom-end-date').value;
    
    if (!startDate || !endDate) {
        App.showNotification('시작일과 종료일을 선택해주세요.', 'warning');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        App.showNotification('시작일은 종료일보다 이전이어야 합니다.', 'warning');
        return;
    }
    
    // 모든 기간 버튼 비활성화
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    
    currentStartDate = startDate;
    currentEndDate = endDate;
    loadRankings(null, startDate, endDate);
}
