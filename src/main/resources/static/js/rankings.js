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
        let url = `/training-logs/rankings?days=${days}&grade=${currentGrade}`;
        if (startDate && endDate) {
            url = `/training-logs/rankings?startDate=${startDate}&endDate=${endDate}&grade=${currentGrade}`;
        }
        
        const data = await App.api.get(url);
        
        // 기간 정보 표시
        updatePeriodInfo(data.period, data.filterGrade);
        
        // 각 랭킹 렌더링
        renderRanking('ball-speed-ranking', data.ballSpeedRanking, 'ballSpeedMax', 'km/h', 'ballSpeedAvg');
        renderRanking('pitch-speed-ranking', data.pitchSpeedRanking, 'pitchSpeedMax', 'km/h', 'pitchSpeedAvg');
        renderRanking('contact-rate-ranking', data.contactRateRanking, 'contactRateMax', '%', 'contactRateAvg');
        renderRanking('strike-rate-ranking', data.strikeRateRanking, 'strikeRateMax', '%', 'strikeRateAvg');
        renderRecordCountRanking('record-count-ranking', data.recordCountRanking);
        
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

function renderRanking(containerId, rankings, valueField, unit, avgField) {
    const container = document.getElementById(containerId);
    
    if (!rankings || rankings.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE': '엘리트',
        'YOUTH': '유소년'
    };
    
    container.innerHTML = rankings.slice(0, 10).map((member, index) => {
        const rank = index + 1;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const value = member[valueField];
        const avgValue = member[avgField];
        const records = member.totalRecords;
        const grade = member.memberGrade;
        
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${member.memberName}
                        <span style="margin-left: 6px; padding: 2px 6px; background: var(--bg-hover); border-radius: 4px; font-size: 9px; color: var(--text-secondary);">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${member.memberNumber || '-'}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${value.toFixed(1)}${unit}</div>
                    <div class="ranking-sub-value">평균: ${avgValue.toFixed(1)}${unit} · ${records}회</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecordCountRanking(containerId, rankings) {
    const container = document.getElementById(containerId);
    
    if (!rankings || rankings.length === 0) {
        container.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
        return;
    }
    
    const gradeLabel = {
        'SOCIAL': '사회인',
        'ELITE': '엘리트',
        'YOUTH': '유소년'
    };
    
    container.innerHTML = rankings.slice(0, 10).map((member, index) => {
        const rank = index + 1;
        const positionClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const totalRecords = member.totalRecords;
        const grade = member.memberGrade;
        
        // 기록 분포 계산
        const ballSpeedCount = member.ballSpeedCount || 0;
        const pitchSpeedCount = member.pitchSpeedCount || 0;
        const contactRateCount = member.contactRateCount || 0;
        const strikeRateCount = member.strikeRateCount || 0;
        
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">${rank}</div>
                <div class="ranking-member-info">
                    <div class="ranking-member-name">
                        ${member.memberName}
                        <span style="margin-left: 6px; padding: 2px 6px; background: var(--bg-hover); border-radius: 4px; font-size: 9px; color: var(--text-secondary);">${gradeLabel[grade] || grade}</span>
                    </div>
                    <div class="ranking-member-number">${member.memberNumber || '-'}</div>
                </div>
                <div class="ranking-value">
                    <div class="ranking-main-value">${totalRecords}회</div>
                    <div class="ranking-sub-value">
                        ${ballSpeedCount > 0 ? `타격 ${ballSpeedCount}` : ''}
                        ${pitchSpeedCount > 0 ? ` · 투구 ${pitchSpeedCount}` : ''}
                    </div>
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
