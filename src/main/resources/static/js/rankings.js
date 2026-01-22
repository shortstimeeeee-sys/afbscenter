// 훈련 랭킹 페이지 JavaScript

let currentDays = 7;
let currentStartDate = null;
let currentEndDate = null;
let currentGrade = 'ALL';

document.addEventListener('DOMContentLoaded', function() {
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
        
        // 회원 목록 로드 (회원 기록 포함)
        const members = await App.api.get('/members');
        
        // 출석 기록 로드 (훈련 횟수 계산용)
        const attendances = await App.api.get(`/attendance?startDate=${start}&endDate=${end}`);
        
        // 기간 정보 표시
        updatePeriodInfo({ start, end, days: days || Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) }, currentGrade);
        
        // 등급 필터링
        let filteredMembers = members;
        if (currentGrade !== 'ALL') {
            filteredMembers = members.filter(m => m.grade === currentGrade);
        }
        
        // 각 랭킹 렌더링 (회원 기록 기반)
        renderMemberRecordRanking('swing-speed-ranking', filteredMembers, 'swingSpeed', '💨 스윙 속도', 'mph');
        renderMemberRecordRanking('exit-velocity-ranking', filteredMembers, 'exitVelocity', '⚡ 타구 속도', 'mph');
        renderMemberRecordRanking('pitching-speed-ranking', filteredMembers, 'pitchingSpeed', '🔥 구속', 'km/h');
        renderAttendanceCountRanking('attendance-count-ranking', filteredMembers, attendances);
        
    } catch (error) {
        console.error('랭킹 조회 실패:', error);
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
        'YOUTH': '유소년'
    }[filterGrade || 'ALL'];
    
    periodInfo.innerHTML = `
        <strong>${period.start}</strong> ~ <strong>${period.end}</strong> 
        (${period.days}일간) 
        <span style="margin-left: 16px; padding: 4px 12px; background: var(--accent-primary); color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">${gradeLabel}</span>
        <span style="margin-left: 8px; color: var(--text-muted);">최종 업데이트: ${new Date().toLocaleString('ko-KR')}</span>
    `;
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
        'YOUTH': '유소년'
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
        const grade = member.grade;
        
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${member.name}
                        <span style="margin-left: 6px; padding: 2px 6px; background: var(--bg-hover); border-radius: 4px; font-size: 9px; color: var(--text-secondary);">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${member.memberNumber || '-'}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${typeof value === 'number' ? value.toFixed(1) : value} ${unit}</div>
                    <div class="ranking-sub-value">회원 등록 기록</div>
                </div>
            </div>
        `;
    }).join('');
}

// 훈련 횟수 랭킹 렌더링 (출석 기록 기반)
function renderAttendanceCountRanking(containerId, members, attendances) {
    const container = document.getElementById(containerId);
    
    if (!members || members.length === 0) {
        container.innerHTML = '<div class="ranking-empty">회원이 없습니다.</div>';
        return;
    }
    
    // 회원별 출석 횟수 계산
    const memberAttendanceCount = {};
    attendances.forEach(attendance => {
        const memberId = attendance.memberId;
        if (memberId) {
            memberAttendanceCount[memberId] = (memberAttendanceCount[memberId] || 0) + 1;
        }
    });
    
    // 출석 횟수로 정렬
    const rankedMembers = members
        .map(member => ({
            ...member,
            attendanceCount: memberAttendanceCount[member.id] || 0
        }))
        .filter(m => m.attendanceCount > 0)
        .sort((a, b) => b.attendanceCount - a.attendanceCount)
        .slice(0, 10);
    
    if (rankedMembers.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 출석 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트(초)',
        'ELITE_MIDDLE': '엘리트(중)',
        'ELITE_HIGH': '엘리트(고)',
        'YOUTH': '유소년'
    };
    
    // 동률 처리를 위한 순위 계산
    let currentRank = 1;
    let previousCount = null;
    
    container.innerHTML = rankedMembers.map((member, index) => {
        const count = member.attendanceCount;
        
        // 이전 값과 다르면 현재 인덱스+1이 새로운 순위
        if (previousCount !== null && previousCount !== count) {
            currentRank = index + 1;
        }
        previousCount = count;
        
        const rank = currentRank;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const grade = member.grade;
        
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${member.name}
                        <span style="margin-left: 6px; padding: 2px 6px; background: var(--bg-hover); border-radius: 4px; font-size: 9px; color: var(--text-secondary);">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${member.memberNumber || '-'}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${count}회</div>
                    <div class="ranking-sub-value">출석 기록</div>
                </div>
            </div>
        `;
    }).join('');
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
