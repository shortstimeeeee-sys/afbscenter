// 대시보드 페이지 JavaScript

document.addEventListener('DOMContentLoaded', async function() {
    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        // KPI 데이터 로드
        const kpiData = await App.api.get('/dashboard/kpi');
        
        // 순서: 총 회원 수, 월 가입자, 빈칸, 빈칸, 오늘 가입 수, 오늘 예약 수, 오늘 매출, 월 매출
        document.getElementById('kpi-total-members').textContent = kpiData.totalMembers || 0;
        document.getElementById('kpi-monthly-new-members').textContent = kpiData.monthlyNewMembers || 0;
        document.getElementById('kpi-new-members').textContent = kpiData.newMembers || 0;
        document.getElementById('kpi-bookings').textContent = kpiData.bookings || 0;
        document.getElementById('kpi-revenue').textContent = App.formatCurrency(kpiData.revenue || 0);
        document.getElementById('kpi-monthly-revenue').textContent = App.formatCurrency(kpiData.monthlyRevenue || 0);
        // 방문 수는 숨김 처리되어 있지만 데이터는 유지
        document.getElementById('kpi-visits').textContent = kpiData.visits || 0;
        
        // 오늘 일정 로드
        const schedule = await App.api.get('/dashboard/today-schedule');
        renderTodaySchedule(schedule);
        
        // 미처리 알림 로드
        const alerts = await App.api.get('/dashboard/alerts');
        renderPendingAlerts(alerts);
        
    } catch (error) {
        console.error('대시보드 데이터 로드 실패:', error);
        // 에러 발생 시 기본값 표시
        document.getElementById('kpi-total-members').textContent = '0';
        document.getElementById('kpi-monthly-new-members').textContent = '0';
        document.getElementById('kpi-new-members').textContent = '0';
        document.getElementById('kpi-bookings').textContent = '0';
        document.getElementById('kpi-revenue').textContent = '₩0';
        document.getElementById('kpi-monthly-revenue').textContent = '₩0';
        document.getElementById('kpi-visits').textContent = '0';
    }
}

// 코치별 색상 가져오기 (common.js의 App.CoachColors 사용)
function getCoachColorForSchedule(coachId) {
    return App.CoachColors.getColorById(coachId);
}

function renderTodaySchedule(schedule) {
    const container = document.getElementById('today-schedule');
    
    if (!schedule || schedule.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">오늘 확정된 일정이 없습니다.</p>';
        return;
    }
    
    // 시설별로 그룹화
    const facilityGroups = {};
    schedule.forEach(item => {
        const facility = item.facility || '-';
        if (!facilityGroups[facility]) {
            facilityGroups[facility] = [];
        }
        facilityGroups[facility].push(item);
    });
    
    // 각 시설별로 하나의 줄에 표시
    container.innerHTML = Object.keys(facilityGroups).map(facility => {
        const items = facilityGroups[facility];
        
        // 코치 색상 결정 (첫 번째 예약의 코치 색상 사용)
        const firstItem = items[0];
        const coachColor = firstItem.coachId ? getCoachColorForSchedule(firstItem.coachId) : null;
        const backgroundColor = coachColor ? coachColor + '20' : 'transparent';
        const borderColor = coachColor || 'var(--border-color)';
        
        // 시간들을 모아서 표시
        const times = items.map(item => item.time).join(', ');
        
        // 각 예약의 상세 정보를 형식화
        const details = items.map(item => {
            const parts = [];
            // 선수명
            if (item.memberName) {
                parts.push(item.memberName);
            }
            // 레슨명
            if (item.lessonCategory && item.lessonCategory.trim() !== '') {
                parts.push(item.lessonCategory);
            }
            // 코치이름
            if (item.coachName && item.coachName.trim() !== '') {
                parts.push(item.coachName);
            }
            return parts.join(' / ');
        }).join(' | ');
        
        return `
        <div class="schedule-item" style="background-color: ${backgroundColor}; border-left: 3px solid ${borderColor};">
            <div class="schedule-time">${times}</div>
            <div class="schedule-info">
                <div class="schedule-title">${facility}</div>
                <div class="schedule-detail">${details}</div>
            </div>
            <span class="badge badge-success">확정</span>
        </div>
        `;
    }).join('');
}

function renderPendingAlerts(alerts) {
    const container = document.getElementById('pending-alerts');
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">미처리 알림이 없습니다.</p>';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.type || 'info'}">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-detail">${alert.message}</div>
        </div>
    `).join('');
}
