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
        
        // 오늘 예약 수 및 어제 대비 퍼센트 계산
        const todayBookings = kpiData.bookings || 0;
        const yesterdayBookings = kpiData.yesterdayBookings || 0;
        document.getElementById('kpi-bookings').textContent = todayBookings;
        
        const bookingsChangeElement = document.getElementById('kpi-bookings-change');
        if (yesterdayBookings === 0) {
            if (todayBookings === 0) {
                bookingsChangeElement.textContent = '어제 대비';
                bookingsChangeElement.className = 'kpi-change';
            } else {
                bookingsChangeElement.textContent = '신규 예약';
                bookingsChangeElement.className = 'kpi-change positive';
            }
        } else {
            const percentage = ((todayBookings - yesterdayBookings) / yesterdayBookings) * 100;
            const percentageText = percentage >= 0 ? `+${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`;
            bookingsChangeElement.textContent = `${percentageText} 어제 대비`;
            bookingsChangeElement.className = percentage >= 0 ? 'kpi-change positive' : 'kpi-change negative';
        }
        
        // 오늘 매출 및 어제 대비 퍼센트 계산
        const todayRevenue = kpiData.revenue || 0;
        const yesterdayRevenue = kpiData.yesterdayRevenue || 0;
        document.getElementById('kpi-revenue').textContent = App.formatCurrency(todayRevenue);
        
        const revenueChangeElement = document.getElementById('kpi-revenue-change');
        if (yesterdayRevenue === 0) {
            if (todayRevenue === 0) {
                revenueChangeElement.textContent = '어제 대비';
                revenueChangeElement.className = 'kpi-change';
            } else {
                revenueChangeElement.textContent = '신규 매출';
                revenueChangeElement.className = 'kpi-change positive';
            }
        } else {
            const percentage = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
            const percentageText = percentage >= 0 ? `+${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`;
            revenueChangeElement.textContent = `${percentageText} 어제 대비`;
            revenueChangeElement.className = percentage >= 0 ? 'kpi-change positive' : 'kpi-change negative';
        }
        
        document.getElementById('kpi-monthly-revenue').textContent = App.formatCurrency(kpiData.monthlyRevenue || 0);
        // 방문 수는 숨김 처리되어 있지만 데이터는 유지
        document.getElementById('kpi-visits').textContent = kpiData.visits || 0;
        
        // 오늘 일정 로드
        const schedule = await App.api.get('/dashboard/today-schedule');
        renderTodaySchedule(schedule);
        
        // 미처리 알림 로드
        const alerts = await App.api.get('/dashboard/alerts');
        renderPendingAlerts(alerts);
        
        // 활성 공지사항 로드
        const announcements = await App.api.get('/dashboard/announcements');
        renderActiveAnnouncements(announcements);
        
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
        container.innerHTML = '<p style="color: var(--text-muted);">오늘 일정이 없습니다.</p>';
        return;
    }
    
    // 종료된 일정과 남은 일정 분리
    const completedItems = schedule.filter(item => item.isCompleted || item.status === 'COMPLETED');
    const activeItems = schedule.filter(item => !item.isCompleted && item.status !== 'COMPLETED');
    
    // 시간순으로 정렬 (종료된 일정은 오래된 순, 남은 일정은 빠른 순)
    completedItems.sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
    });
    activeItems.sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        return timeA.localeCompare(timeB);
    });
    
    let html = '';
    
    // 남은 일정 표시
    if (activeItems.length > 0) {
        html += '<div style="margin-bottom: 16px;"><strong style="color: var(--accent-primary);">진행 예정 / 진행 중</strong></div>';
        html += renderScheduleGroup(activeItems);
    }
    
    // 종료된 일정 표시
    if (completedItems.length > 0) {
        if (activeItems.length > 0) {
            html += '<div style="margin-top: 24px; margin-bottom: 16px;"><strong style="color: var(--text-muted);">종료된 일정</strong></div>';
        }
        html += renderScheduleGroup(completedItems, true);
    }
    
    container.innerHTML = html;
}

function renderScheduleGroup(items, isCompleted = false) {
    // 시설별로 그룹화
    const facilityGroups = {};
    items.forEach(item => {
        const facility = item.facility || '-';
        if (!facilityGroups[facility]) {
            facilityGroups[facility] = [];
        }
        facilityGroups[facility].push(item);
    });
    
    // 각 시설별로 표시
    return Object.keys(facilityGroups).map(facility => {
        const groupItems = facilityGroups[facility];
        
        return groupItems.map(item => {
            // 코치 색상 결정
            const coachColor = item.coachId ? getCoachColorForSchedule(item.coachId) : null;
            const backgroundColor = coachColor ? coachColor + '20' : 'transparent';
            const borderColor = coachColor || 'var(--border-color)';
            
            // 시간 표시 (시작 시간 ~ 종료 시간)
            let timeDisplay = item.time || '';
            if (item.endTime) {
                timeDisplay += ` ~ ${item.endTime}`;
            }
            
            // 상세 정보
            const parts = [];
            if (item.memberName) {
                parts.push(item.memberName);
            }
            if (item.lessonCategory && item.lessonCategory.trim() !== '') {
                parts.push(item.lessonCategory);
            }
            if (item.coachName && item.coachName.trim() !== '') {
                parts.push(item.coachName);
            }
            const details = parts.join(' / ');
            
            // 상태 배지
            let statusBadge = '';
            if (isCompleted || item.isCompleted) {
                statusBadge = '<span class="badge badge-secondary" style="opacity: 0.7;">완료</span>';
            } else {
                statusBadge = '<span class="badge badge-success">확정</span>';
            }
            
            // 종료된 일정은 약간 투명하게 표시
            const opacity = isCompleted || item.isCompleted ? '0.7' : '1';
            
            return `
            <div class="schedule-item" style="background-color: ${backgroundColor}; border-left: 3px solid ${borderColor}; opacity: ${opacity}; margin-bottom: 8px;">
                <div class="schedule-time">${timeDisplay}</div>
                <div class="schedule-info">
                    <div class="schedule-title">${facility}</div>
                    <div class="schedule-detail">${details}</div>
                </div>
                ${statusBadge}
            </div>
            `;
        }).join('');
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

function renderActiveAnnouncements(announcements) {
    const container = document.getElementById('active-announcements');
    const countElement = document.getElementById('announcement-count');
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<div style="padding: 16px; text-align: center;"><p style="color: var(--text-muted); font-size: 13px;">표시할 공지사항이 없습니다.</p></div>';
        if (countElement) countElement.textContent = '0개';
        return;
    }
    
    if (countElement) {
        countElement.textContent = `${announcements.length}개`;
    }
    
    container.innerHTML = announcements.map((announcement, index) => {
        const content = announcement.content || '';
        const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
        const dateRange = announcement.startDate && announcement.endDate 
            ? `${App.formatDate(announcement.startDate)} ~ ${App.formatDate(announcement.endDate)}`
            : announcement.startDate 
                ? `${App.formatDate(announcement.startDate)}부터`
                : announcement.endDate
                    ? `${App.formatDate(announcement.endDate)}까지`
                    : '';
        
        const isLast = index === announcements.length - 1;
        
        return `
            <div class="announcement-item" 
                 style="padding: 12px 16px; 
                        ${!isLast ? 'border-bottom: 1px solid var(--border-color);' : ''} 
                        cursor: pointer; 
                        transition: all 0.2s ease;" 
                 onmouseover="this.style.backgroundColor='var(--bg-hover)';" 
                 onmouseout="this.style.backgroundColor='transparent';"
                 onclick="showAnnouncementDetail(${announcement.id})">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                    <h3 style="margin: 0; 
                               color: var(--text-primary); 
                               font-size: 15px; 
                               font-weight: 600; 
                               flex: 1; 
                               min-width: 0;
                               line-height: 1.2;
                               background-color: var(--accent-primary);
                               color: white;
                               padding: 6px 12px;
                               border-radius: 6px;
                               display: inline-block;">
                        ${announcement.title || '제목 없음'}
                    </h3>
                    ${dateRange ? `
                        <span style="color: var(--text-muted); 
                                    font-size: 11px; 
                                    white-space: nowrap; 
                                    background-color: var(--bg-tertiary); 
                                    padding: 3px 8px; 
                                    border-radius: 6px;
                                    font-weight: 500;">
                            ${dateRange}
                        </span>
                    ` : ''}
                </div>
                <p style="margin: 0 0 8px 0; 
                          color: var(--text-secondary); 
                          font-size: 13px; 
                          line-height: 1.5;">
                    ${truncatedContent}
                </p>
                <div style="color: var(--accent-primary); font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                    <span>자세히 보기</span>
                    <span style="font-size: 10px;">→</span>
                </div>
            </div>
        `;
    }).join('');
}

function showAnnouncementDetail(id) {
    // 공지사항 상세 내용을 모달로 표시
    App.api.get(`/announcements/${id}`)
        .then(announcement => {
            const dateRange = announcement.startDate && announcement.endDate 
                ? `${App.formatDate(announcement.startDate)} ~ ${App.formatDate(announcement.endDate)}`
                : announcement.startDate 
                    ? `${App.formatDate(announcement.startDate)}부터`
                    : announcement.endDate
                        ? `${App.formatDate(announcement.endDate)}까지`
                        : '기간 제한 없음';
            
            const modalContent = `
                <div style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: var(--accent-primary);">${announcement.title || '제목 없음'}</h2>
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 14px;">
                        <div>작성일: ${App.formatDate(announcement.createdAt)}</div>
                        ${dateRange ? `<div>노출 기간: ${dateRange}</div>` : ''}
                    </div>
                    <div style="padding: 16px; background-color: var(--bg-secondary); border-radius: 8px; white-space: pre-wrap; line-height: 1.6; color: var(--text-primary);">
                        ${announcement.content || '내용 없음'}
                    </div>
                </div>
            `;
            
            // 간단한 모달 표시 (common.js의 App.Modal 사용)
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'announcement-detail-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>공지사항</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    ${modalContent}
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        })
        .catch(error => {
            console.error('공지사항 상세 조회 실패:', error);
            App.showNotification('공지사항을 불러오는데 실패했습니다.', 'danger');
        });
}
