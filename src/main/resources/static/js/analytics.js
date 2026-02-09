// 통계/분석 페이지 JavaScript

// 매출 추이 필터 기간 (기본값: 일주일)
window.revenueTrendPeriod = 'week';

// 학교/소속 클릭 시 상세에 쓸 회원 목록 (loadSchoolStats에서 설정)
let _schoolStatsMembers = [];

document.addEventListener('DOMContentLoaded', function() {
    buildAnalyticsMonthPicker();
    buildTopSpendersMonthPicker();
    updateTopSpendersFilterVisibility();
    
    document.getElementById('analytics-period').addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        document.getElementById('analytics-start-date').disabled = !isCustom;
        document.getElementById('analytics-end-date').disabled = !isCustom;
        document.getElementById('analytics-month-picker').value = '';
    });
    
    document.getElementById('analytics-month-picker').addEventListener('change', function() {
        const val = this.value;
        if (!val) return;
        const [y, m] = val.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        document.getElementById('analytics-start-date').value = `${y}-${String(m).padStart(2, '0')}-01`;
        document.getElementById('analytics-end-date').value = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        document.getElementById('analytics-period').value = 'custom';
        document.getElementById('analytics-start-date').disabled = false;
        document.getElementById('analytics-end-date').disabled = false;
        loadAnalytics();
    });
    document.getElementById('analytics-top-spenders-scope')?.addEventListener('change', function() {
        updateTopSpendersFilterVisibility();
        var scope = document.getElementById('analytics-top-spenders-scope')?.value;
        if (scope === 'period') {
            var now = new Date();
            var y = now.getFullYear(), m = now.getMonth() + 1;
            var lastDay = new Date(y, m, 0).getDate();
            document.getElementById('analytics-top-spenders-start').value = y + '-' + String(m).padStart(2, '0') + '-01';
            document.getElementById('analytics-top-spenders-end').value = y + '-' + String(m).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
        }
        if (scope === 'month' || scope === 'all') loadAnalytics();
    });
    document.getElementById('analytics-top-spenders-month')?.addEventListener('change', loadAnalytics);
    document.getElementById('analytics-top-spenders-apply')?.addEventListener('click', loadAnalytics);
    
    // 매출 추이 필터 버튼 초기 상태 설정 (약간의 지연 후)
    setTimeout(() => {
        updateRevenueTrendFilterButtons();
    }, 100);
    
    loadAnalytics();
});

/** 2026년 1월 ~ 현재월까지 월별 보기 옵션 생성 */
function buildAnalyticsMonthPicker() {
    const picker = document.getElementById('analytics-month-picker');
    if (!picker) return;
    const startYear = 2026;
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;
    let opts = '<option value="">월별 보기</option>';
    for (let y = startYear; y <= endYear; y++) {
        const monthEnd = (y === endYear) ? endMonth : 12;
        for (let m = 1; m <= monthEnd; m++) {
            const v = `${y}-${String(m).padStart(2, '0')}`;
            opts += `<option value="${v}">${y}년 ${m}월</option>`;
        }
    }
    picker.innerHTML = opts;
}

/** 개인 결제 TOP: 해당 월 선택 옵션 (2026년 1월 ~ 현재월) */
function buildTopSpendersMonthPicker() {
    const sel = document.getElementById('analytics-top-spenders-month');
    if (!sel) return;
    const startYear = 2026;
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;
    const currentVal = `${endYear}-${String(endMonth).padStart(2, '0')}`;
    let opts = '';
    for (let y = startYear; y <= endYear; y++) {
        const monthEnd = (y === endYear) ? endMonth : 12;
        for (let m = 1; m <= monthEnd; m++) {
            const v = `${y}-${String(m).padStart(2, '0')}`;
            opts += `<option value="${v}"${v === currentVal ? ' selected' : ''}>${y}년 ${m}월</option>`;
        }
    }
    sel.innerHTML = opts;
}

/** 개인 결제 TOP: scope에 따라 월/기간 UI 표시 */
function updateTopSpendersFilterVisibility() {
    const scope = document.getElementById('analytics-top-spenders-scope')?.value || 'all';
    const monthWrap = document.getElementById('analytics-top-spenders-month-wrap');
    const periodWrap = document.getElementById('analytics-top-spenders-period-wrap');
    const applyBtn = document.getElementById('analytics-top-spenders-apply');
    if (monthWrap) monthWrap.style.display = scope === 'month' ? 'inline' : 'none';
    if (periodWrap) periodWrap.style.display = scope === 'period' ? 'inline' : 'none';
    if (applyBtn) applyBtn.style.display = scope === 'period' ? 'inline-block' : 'none';
}

async function loadAnalytics() {
    const period = document.getElementById('analytics-period').value;
    let startDate = document.getElementById('analytics-start-date').value;
    let endDate = document.getElementById('analytics-end-date').value;
    
    try {
        const params = new URLSearchParams();
        if (period === 'all') {
            const now = new Date();
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            startDate = '2026-01-01';
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            params.append('period', 'custom');
            params.append('startDate', startDate);
            params.append('endDate', endDate);
        } else if (period === 'custom') {
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
        } else {
            params.append('period', period);
        }
        const topSpendersScopeEl = document.getElementById('analytics-top-spenders-scope');
        const topSpendersScope = topSpendersScopeEl ? topSpendersScopeEl.value : 'all';
        params.append('topSpendersScope', topSpendersScope);
        if (topSpendersScope === 'month') {
            const monthEl = document.getElementById('analytics-top-spenders-month');
            if (monthEl && monthEl.value) params.append('topSpendersMonth', monthEl.value);
        } else if (topSpendersScope === 'period') {
            const startEl = document.getElementById('analytics-top-spenders-start');
            const endEl = document.getElementById('analytics-top-spenders-end');
            if (startEl && endEl && startEl.value && endEl.value) {
                params.append('topSpendersStartDate', startEl.value);
                params.append('topSpendersEndDate', endEl.value);
            }
        }
        
        const analytics = await App.api.get(`/analytics?${params}`);
        
        App.log('Analytics 데이터 로드:', analytics);
        App.log('매출 지표 데이터:', analytics.revenue);
        App.log('카테고리별 매출:', analytics.revenue?.byCategory);
        
        // 기간 정보 저장 (전역 변수로)
        window.currentAnalyticsPeriod = period;
        window.currentAnalyticsData = analytics;
        
        // 매출 추이 차트는 독립적으로 유지 (페이지 필터 변경 시에도 덮어쓰지 않음)
        renderAnalytics(analytics);
    } catch (error) {
        App.err('통계 데이터 로드 실패:', error);
    }
}

function renderAnalytics(data) {
    // 기간 표시 업데이트
    const period = window.currentAnalyticsPeriod || 'month';
    const periodLabels = {
        'day': '일별',
        'today': '일별',
        'week': '주별',
        'month': '월별',
        'year': '전체',
        'all': '현재까지',
        'custom': '기간 선택'
    };
    
    // 월 정보 추출
    let monthLabel = '';
    if (data.operational?.periodStart) {
        const startDate = new Date(data.operational.periodStart + 'T00:00:00');
        const month = startDate.getMonth() + 1;
        const year = startDate.getFullYear();
        if (period === 'month') {
            monthLabel = `${year}년 ${month}월`;
        } else if (period === 'year') {
            monthLabel = `${year}년`;
        } else if (period === 'week' || period === 'day') {
            const endDate = data.operational?.periodEnd ? new Date(data.operational.periodEnd + 'T00:00:00') : startDate;
            monthLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} ~ ${endDate.getMonth() + 1}/${endDate.getDate()}`;
        }
    }
    
    const periodLabel = periodLabels[period] || '월별';
    if (period === 'all' && !monthLabel && data.operational?.periodStart) {
        monthLabel = '2026년 1월 ~ ' + (data.operational.periodEnd ? data.operational.periodEnd.replace(/-/g,'.').slice(0,7) : '현재');
    }
    
    // 취소율 및 노쇼율 데이터 추출
    const cancelRate = data.operational?.cancelRate ? (data.operational.cancelRate * 100) : 0;
    const noShowRate = data.operational?.noShowRate ? (data.operational.noShowRate * 100) : 0;
    
    // 운영 지표 헤더에 취소율/노쇼율 표시 (오른쪽 끝에 배치)
    const operationalHeader = document.getElementById('operational-header');
    if (operationalHeader) {
        operationalHeader.innerHTML = `
            <h2 class="card-title" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; width: 100%;">
                <span>운영 지표</span>
                <div style="display: flex; gap: 12px; margin-left: auto;">
                    <div style="padding: 10px 20px; background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, var(--bg-primary) 100%); border-radius: 8px; border: 1px solid var(--border-color); border-left: 3px solid var(--warning); display: flex; align-items: center; gap: 12px; min-width: 140px;">
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px; font-weight: 500;">전체 취소율</div>
                            <div style="font-size: 18px; font-weight: 800; color: var(--warning); line-height: 1;">${cancelRate.toFixed(1)}%</div>
                        </div>
                    </div>
                    <div style="padding: 10px 20px; background: linear-gradient(135deg, rgba(220, 53, 69, 0.1) 0%, var(--bg-primary) 100%); border-radius: 8px; border: 1px solid var(--border-color); border-left: 3px solid var(--error); display: flex; align-items: center; gap: 12px; min-width: 140px;">
                        <div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px; font-weight: 500;">전체 노쇼율</div>
                            <div style="font-size: 18px; font-weight: 800; color: var(--error); line-height: 1;">${noShowRate.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            </h2>
        `;
    }
    
    // 시설별 가동률 차트 (상세 정보 포함 - 시간대별 정보 포함)
    renderFacilityUtilizationChart('facility-utilization-chart', data.operational?.facilityUtilization || [], data.operational?.periodDays || 0, periodLabel, monthLabel);
    
    // 매출 지표 렌더링 (상세 정보 포함)
    App.log('매출 지표 렌더링 - byCategory:', data.revenue?.byCategory);
    App.log('매출 지표 렌더링 - byProduct:', data.revenue?.byProduct);
    App.log('매출 지표 렌더링 - trend:', data.revenue?.trend);
    
    renderRevenueChart('category-revenue-chart', data.revenue?.byCategory || [], data.revenue?.byProduct || [], data.revenue?.byCoach || [], monthLabel, data.revenue || {}, periodLabel);
    
    // 매출 추이 차트는 별도 기간으로 로드 (초기 로드 시에만, 또는 필터 버튼 클릭 시)
    // 페이지 전체 기간 필터가 변경되어도 매출 추이 차트는 독립적으로 유지
    if (!window.revenueTrendChartLoaded) {
        loadRevenueTrendChart();
        window.revenueTrendChartLoaded = true;
    }
    
    // 회원 지표
    const memberMetrics = data.members || {};
    
    // 회원 KPI
    document.getElementById('total-members').textContent = memberMetrics.totalCount || 0;
    document.getElementById('active-members').textContent = memberMetrics.activeCount || 0;
    document.getElementById('new-members-period').textContent = memberMetrics.newMembersInPeriod || 0;
    
    // 순증감 표시 (색상 적용)
    const netChange = memberMetrics.netChange || 0;
    const netChangeEl = document.getElementById('net-change-members');
    netChangeEl.textContent = netChange >= 0 ? `+${netChange}` : `${netChange}`;
    netChangeEl.style.color = netChange >= 0 ? 'var(--success)' : 'var(--danger)';
    
    // 카테고리별 회원 통계
    renderCategoryMemberChart('category-member-chart', {
        memberCount: memberMetrics.categoryMemberCount || {},
        activeProducts: memberMetrics.categoryActiveProducts || {}
    });
    
    // 등급별 분포 차트
    renderGradeDistributionChart('grade-distribution-chart', memberMetrics.gradeDistribution || {});
    
    // 등급별 상세 통계
    renderGradeDetailChart('grade-detail-chart', {
        gradeStatusDistribution: memberMetrics.gradeStatusDistribution || {},
        gradeActiveCount: memberMetrics.gradeActiveCount || {},
        gradeRecentVisitors: memberMetrics.gradeRecentVisitors || {}
    });
    
    // 회원 상태 차트
    renderMemberStatusChart('member-status-chart', {
        active: memberMetrics.activeCount || 0,
        inactive: memberMetrics.inactiveCount || 0,
        withdrawn: memberMetrics.withdrawnCount || 0
    });
    
    // 이용권 통계
    renderMemberProductStats('member-product-stats', {
        avgProductsPerMember: memberMetrics.avgProductsPerMember || 0,
        totalActiveProducts: memberMetrics.totalActiveProducts || 0,
        membersWithProducts: memberMetrics.membersWithProducts || 0,
        activeCount: memberMetrics.activeCount || 0
    });
    
    // 학교/소속 현황
    loadSchoolStats();
    
    // 신규/이탈 추이 차트
    renderMemberTrendChart('member-trend-chart', memberMetrics.trend || []);
    
    // 개인 결제 TOP (scope: all=전체 누적, month=해당 월, period=기간)
    renderMemberTopSpenders('member-top-spenders', memberMetrics.topSpenders || [], memberMetrics.topSpendersScope || 'all');
    
    // 클릭 가능하게 설정
    const activeMembersEl = document.getElementById('active-members');
    activeMembersEl.style.cursor = 'pointer';
    activeMembersEl.onclick = () => openDetailModal('member-trend-chart', -1, '');
}

// 시설별 가동률 차트 렌더링 (상세 정보 포함)
function renderFacilityUtilizationChart(containerId, data, periodDays, periodLabel = '월별', monthLabel = '') {
    const container = document.getElementById(containerId);
    
    // 기간 표시 텍스트
    const periodText = periodDays > 0 ? `총 ${periodDays}일 중` : '';
    
    // 시설 순서 정렬: 사하(본점) 먼저, 그 다음 연제(시청점)
    const sortedData = [...data].sort((a, b) => {
        const aLabel = a.label || '';
        const bLabel = b.label || '';
        // 사하가 포함된 경우 먼저, 연제가 포함된 경우 나중에
        if (aLabel.includes('사하') || aLabel.includes('본점')) return -1;
        if (bLabel.includes('사하') || bLabel.includes('본점')) return 1;
        if (aLabel.includes('연제') || aLabel.includes('시청점')) return 1;
        if (bLabel.includes('연제') || bLabel.includes('시청점')) return -1;
        return 0;
    });
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">시설 데이터가 없습니다.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="metric-content-subtitle">시간대별 예약·사용률 (운영시간 기준)</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; width: 100%;">
            ${sortedData.map((item, index) => {
                const usedDays = item.usedDays || 0;
                const totalDays = item.totalDays || periodDays || 0;
                const bookingCount = item.bookingCount || 0;
                const totalHours = item.totalHours || 0;
                const availableHours = item.availableHours || 0;
                const utilizationRate = item.value || 0;
                const rentalCount = item.rentalCount || 0;
                const rentalCompletedCount = item.rentalCompletedCount != null ? Number(item.rentalCompletedCount) : 0;
                const rentalHours = item.rentalHours != null ? Number(item.rentalHours) : 0;
                const hourlyStats = item.hourlyStats || [];
                const openHour = item.openHour != null ? item.openHour : 0;
                const closeHour = item.closeHour != null ? item.closeHour : 23;
                // 08·23 제외, 그 사이 시간만 표시 (09~22)
                const operatingHours = [];
                if (closeHour >= openHour && closeHour - openHour >= 2) {
                    for (let h = openHour + 1; h < closeHour; h++) operatingHours.push(h);
                } else if (closeHour >= openHour) {
                    for (let h = openHour; h <= closeHour; h++) operatingHours.push(h);
                } else {
                    for (let h = openHour + 1; h <= 23; h++) operatingHours.push(h);
                    for (let h = 0; h < closeHour; h++) operatingHours.push(h);
                }
                
                const maxMinutes = hourlyStats.length > 0 ? Math.max(...hourlyStats.map(h => h.minutes || 0)) : 0;
                const maxCountInRange = operatingHours.length > 0 ? Math.max(...operatingHours.map(h => (hourlyStats.find(x => x.hour === h) || {}).count || 0)) : 0;
                const totalCountInRange = operatingHours.reduce((s, h) => s + ((hourlyStats.find(x => x.hour === h) || {}).count || 0), 0);
                const avgCountInRange = operatingHours.length > 0 ? totalCountInRange / operatingHours.length : 0;
                const barHeight = 48;
                function renderHourBar(hour) {
                    const hourData = hourlyStats.find(h => h.hour === hour);
                    const minutes = hourData ? (hourData.minutes || 0) : 0;
                    const count = hourData ? (hourData.count || 0) : 0;
                    const isMaxHour = maxCountInRange > 0 && count === maxCountInRange;
                    const aboveAvg = avgCountInRange > 0 && count >= avgCountInRange;
                    const belowAvg = avgCountInRange > 0 && count < avgCountInRange;
                    let pct = 0;
                    if (maxMinutes > 0) pct = (minutes / maxMinutes * 100);
                    else if (count > 0) pct = 12;
                    const minPct = (count > 0 || minutes > 0) ? 8 : 0;
                    const finalPct = Math.max(pct, minPct);
                    const barColor = isMaxHour ? '#f0c000' : (aboveAvg ? 'var(--success)' : belowAvg ? 'var(--danger)' : 'var(--accent-primary)');
                    const textColor = isMaxHour ? '#f0c000' : (aboveAvg ? 'var(--success)' : belowAvg ? 'var(--danger)' : 'var(--text-secondary)');
                    const timeColor = isMaxHour ? '#f0c000' : (aboveAvg ? 'var(--success)' : belowAvg ? 'var(--danger)' : 'var(--text-muted)');
                    return `<div class="hour-bar-cell" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;cursor:pointer;min-height:${barHeight}px" onclick="showHourlyDetail(${hour},${count},${minutes})" title="${String(hour).padStart(2,'0')}:00 · ${count}회 예약"><div style="font-size:9px;color:${textColor};margin-bottom:2px;font-weight:${isMaxHour ? '700' : '400'}">${count > 0 ? count + '회' : '-'}</div><div style="width:48%;max-width:20px;height:${finalPct}%;min-height:${(count || minutes) ? '6' : '0'}px;background:${barColor};border-radius:2px 2px 0 0;opacity:${(count || minutes) ? '1' : '0.2'}"></div><div style="font-size:10px;color:${timeColor};margin-top:4px;font-weight:${isMaxHour ? '700' : '400'}">${String(hour).padStart(2,'0')}:00</div></div>`;
                }
                const hourBarsHtml = operatingHours.map(renderHourBar).join('');
                
                return `
                <div style="border: 1px solid var(--border-color); border-radius: 12px; padding: 18px; background-color: var(--bg-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s; position: relative; overflow: hidden; width: 100%; box-sizing: border-box;" 
                     onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'"
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'">
                    
                    <!-- 상단 가동률 강조 영역 -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px solid var(--border-color);">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 14px; color: var(--text-primary); margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${periodLabel} 가동률${monthLabel ? ` <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: none;">(${monthLabel})</span>` : ''}
                            </div>
                            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); cursor: pointer; line-height: 1.3; word-break: break-word;" 
                                 onclick="openDetailModal('${containerId}', ${index}, '${item.label}', '${item.label}')"
                                 onmouseover="this.style.color='var(--accent-primary)'"
                                 onmouseout="this.style.color='var(--text-primary)'">${item.label}</div>
                        </div>
                        <div style="text-align: right; margin-left: 12px; flex-shrink: 0;">
                            <div style="font-size: 32px; font-weight: 900; color: var(--accent-primary); line-height: 1;">${utilizationRate.toFixed(1)}<span style="font-size: 18px; font-weight: 600;">%</span></div>
                        </div>
                    </div>
                    
                    <!-- 가동률 진행 바 -->
                    <div style="margin-bottom: 14px; cursor: pointer;" 
                         onclick="openDetailModal('${containerId}', ${index}, '${item.label}', '${item.label}')"
                         onmouseover="this.style.opacity='0.9'"
                         onmouseout="this.style.opacity='1'">
                        <div style="height: 10px; background-color: var(--bg-hover); border-radius: 5px; overflow: hidden; position: relative; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1); width: 100%;">
                            <div style="height: 100%; width: ${Math.min(item.percentage || 0, 100)}%; background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-primary) 100%); transition: width 0.5s ease; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                        </div>
                    </div>
                    
                    <!-- 통계 정보 카드: 총 운영 시간|예약 있는 일수 / 예약/훈련|실제 사용 시간 / 대관 발생|대관 사용 시간 -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px;">
                        <div style="padding: 13px; background: linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, var(--bg-hover) 100%); border-radius: 8px; border: 1px solid var(--border-color); border-left: 3px solid var(--warning); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='linear-gradient(135deg, rgba(255, 193, 7, 0.18) 0%, var(--bg-primary) 100%)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, var(--bg-hover) 100%)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 12px; color: var(--success); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">총 운영 시간</div>
                            <div style="font-size: 20px; font-weight: 800; line-height: 1.2;">
                                <span style="color: #fff;">${availableHours.toFixed(1)}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">시간</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 12px; color: var(--success); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;" title="기간 중 예약이 1건이라도 있었던 날의 수">예약 있는 일수</div>
                            <div style="font-size: 20px; font-weight: 800; line-height: 1.2;">
                                <span style="color: #fff;">${usedDays}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">/ ${totalDays}일</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 12px; color: var(--success); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">예약/훈련</div>
                            <div style="font-size: 20px; font-weight: 800; line-height: 1.2;">
                                <span style="color: #fff;">${bookingCount}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">회</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 12px; color: var(--success); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">실제 사용 시간</div>
                            <div style="font-size: 20px; font-weight: 800; line-height: 1.2;">
                                <span style="color: #fff;">${totalHours.toFixed(1)}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">시간</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 12px; color: var(--success); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">대관 발생</div>
                            <div style="font-size: 16px; font-weight: 800; line-height: 1.4;">
                                <div><span style="color: #fff;">${rentalCount}</span><span style="font-size: 11px; font-weight: 500; color: var(--text-secondary); margin-left: 2px;">확정</span></div>
                                <div style="margin-top: 2px;"><span style="color: #fff;">${rentalCompletedCount}</span><span style="font-size: 11px; font-weight: 500; color: var(--text-secondary); margin-left: 2px;">완료</span></div>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 12px; color: var(--success); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">대관 사용 시간</div>
                            <div style="font-size: 20px; font-weight: 800; line-height: 1.2;">
                                <span style="color: #fff;">${rentalHours.toFixed(1)}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">시간</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 시간대별 운영 현황 -->
                    ${hourlyStats.length > 0 ? `
                    <div style="padding-top: 20px; border-top: 2px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">시간대별 운영 현황</div>
                            <div style="font-size: 10px; color: var(--success); font-weight: 600;">${operatingHours.length > 0 ? ('운영 시간 : ' + String(operatingHours[0]).padStart(2, '0') + '~' + String(operatingHours[operatingHours.length - 1]).padStart(2, '0') + '시') : ''}</div>
                        </div>
                        <div style="margin-bottom: 14px; padding: 14px 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); max-width: 100%; overflow-x: auto;">
                            <div style="display: grid; grid-template-columns: repeat(${operatingHours.length}, minmax(28px, 1fr)); gap: 6px 8px; min-height: ${barHeight + 28}px;">
                                ${hourBarsHtml}
                            </div>
                        </div>
                        
                        ${hourlyStats.length > 0 ? `
                        <div style="margin-bottom: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                            <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">상위 시간대</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                ${(function() {
                                    const totalCount = hourlyStats.reduce((s, x) => s + (x.count || 0), 0);
                                    const top5 = [...hourlyStats].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 5);
                                    return top5.map((h) => {
                                        const pct = totalCount > 0 ? ((h.count || 0) / totalCount * 100) : 0;
                                        const count = h.count || 0;
                                        const isMaxHour = maxCountInRange > 0 && count === maxCountInRange;
                                        const aboveAvg = avgCountInRange > 0 && count >= avgCountInRange;
                                        const belowAvg = avgCountInRange > 0 && count < avgCountInRange;
                                        const bg = isMaxHour ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.28) 0%, rgba(255, 215, 0, 0.1) 50%, rgba(255, 215, 0, 0.05) 100%)' : 'transparent';
                                        const borderLeft = isMaxHour ? '3px solid #f0c000' : aboveAvg ? '3px solid var(--success)' : belowAvg ? '3px solid var(--danger)' : '3px solid var(--border-color)';
                                        const accentColor = isMaxHour ? '#f0c000' : (aboveAvg ? 'var(--success)' : belowAvg ? 'var(--danger)' : 'var(--accent-primary)');
                                        return `<div style="padding: 4px 8px; background: ${bg}; border-radius: 4px; border: 1px solid var(--border-color); border-left: ${borderLeft}; font-size: 9px;">
                                        <span style="color: ${accentColor}; font-weight: 600;">${h.label}</span>
                                        <span style="color: ${accentColor}; margin-left: 4px;">${count}회</span>
                                        <span style="color: var(--text-muted); margin-left: 4px;">(${pct.toFixed(1)}%)</span>
                                    </div>`;
                                    }).join('');
                                })()}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ` : `
                    <div style="padding-top: 20px; border-top: 2px solid var(--border-color); text-align: center; padding: 20px;">
                        <div style="font-size: 11px; color: var(--text-muted);">시간대별 운영 데이터가 없습니다.</div>
                    </div>
                    `}
                </div>
                `;
                }).join('')}
        </div>
        
        <style>
            .hour-tooltip {
                pointer-events: none;
            }
            div[onmouseover*="scale(1.1)"]:hover .hour-tooltip {
                opacity: 1 !important;
            }
        </style>
    `;
}

// 시간대별 상세 정보 표시
function showHourlyDetail(hour, count, minutes) {
    const hours = (minutes / 60).toFixed(1);
    App.showNotification(`${String(hour).padStart(2, '0')}:00 - 예약 ${count}회, 운영 ${hours}시간`, 'info');
}

// 매출 지표 차트 렌더링 (상세 정보 포함, 간소화)
function renderRevenueChart(containerId, categoryData, productData, coachData, monthLabel = '', revenueMetrics = {}, periodLabel = '월별') {
    const container = document.getElementById(containerId);
    if (!categoryData || categoryData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">데이터가 없습니다.</p>';
        return;
    }
    
    const totalRevenue = revenueMetrics.totalRevenue || categoryData.reduce((sum, item) => sum + (item.value || 0), 0);
    const avgDailyRevenue = revenueMetrics.avgDailyRevenue || 0;
    const bestRevenueDate = revenueMetrics.bestRevenueDate;
    const bestRevenueAmount = revenueMetrics.bestRevenueAmount || 0;
    const periodDays = revenueMetrics.periodDays || 1;
    
    // 최고 매출일 포맷팅
    let bestDateLabel = '';
    if (bestRevenueDate) {
        const date = new Date(bestRevenueDate);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        bestDateLabel = `${month}월 ${day}일`;
    }
    
    const bestRevenueTitle = (periodLabel || '월별') + ' 최고 매출일';
    
    container.innerHTML = `
        <div class="metric-content-subtitle">기간 내 카테고리별 매출</div>
        ${bestRevenueDate ? `
        <div style="margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, var(--bg-hover) 100%); border-radius: 8px; border: 1px solid var(--border-color); border-left: 3px solid var(--warning); flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 12px; color: var(--success); font-weight: 600;">${bestRevenueTitle}</div>
                <div style="font-size: 13px; font-weight: 700;"><span style="color: #f0c000;">${App.formatCurrency(bestRevenueAmount)}</span> <span style="color: #fff; font-size: 9px;">(${bestDateLabel})</span></div>
            </div>
            <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-secondary);">
                <span>평균 일일: <strong style="color: var(--text-primary);">${App.formatCurrency(Math.round(avgDailyRevenue))}</strong></span>
                <span>기간: ${periodDays}일</span>
            </div>
        </div>
        ` : ''}
        <div style="display: flex; flex-direction: column; gap: 12px; flex: 1;">
            ${categoryData.map((item, index) => {
                const categoryValue = {
                    '대관': 'RENTAL',
                    '레슨': 'LESSON',
                    '상품판매': 'PRODUCT_SALE'
                }[item.label] || item.label;
                
                // 해당 카테고리의 상품별 매출 정보 필터링
                const categoryProducts = productData ? productData.filter(p => {
                    // 상품판매 카테고리인 경우에만 상품 정보 표시
                    return item.label === '상품판매';
                }) : [];
                
                // 전월 대비 증감률
                const changeRate = item.changeRate || 0;
                const changeAmount = item.changeAmount || 0;
                const prevAmount = item.prevAmount || 0;
                const changeColor = changeRate > 0 ? 'var(--success)' : changeRate < 0 ? 'var(--danger)' : 'var(--text-muted)';
                const changeIcon = changeRate > 0 ? '↑' : changeRate < 0 ? '↓' : '→';
                
                // 평균 일일 매출
                const categoryAvgDaily = item.avgDailyRevenue || 0;
                
                // 코치별 기여도
                const topCoaches = item.topCoaches || [];
                
                return `
                <div style="border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; background-color: var(--bg-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.2s; cursor: pointer;" 
                     onclick="openDetailModal('${containerId}', ${index}, '${categoryValue}', '${item.label}')"
                     onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'"
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'">
                    
                    <!-- 카테고리 헤더 -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="font-size: 13px; color: var(--text-primary); font-weight: 700;">
                            ${item.label}${monthLabel ? ` <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">(${monthLabel})</span>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 22px; font-weight: 900; color: var(--accent-primary); line-height: 1;">${App.formatCurrency(item.value)}</div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${item.percentage ? item.percentage.toFixed(1) : 0}%</div>
                        </div>
                    </div>
                    
                    <!-- 전월 대비 증감률 -->
                    ${prevAmount > 0 || changeAmount !== 0 ? `
                    <div style="margin-bottom: 8px; padding: 6px 8px; background: var(--bg-hover); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
                        <span style="color: var(--text-secondary);">전월 대비</span>
                        <span style="color: ${changeColor}; font-weight: 700;">
                            ${changeIcon} ${Math.abs(changeRate).toFixed(1)}% 
                            <span style="margin-left: 4px; color: var(--text-primary);">(${changeAmount >= 0 ? '+' : ''}${App.formatCurrency(changeAmount)})</span>
                        </span>
                    </div>
                    ` : ''}
                    
                    <!-- 평균 일일 매출 -->
                    ${categoryAvgDaily > 0 ? `
                    <div style="margin-bottom: 8px; font-size: 10px; color: var(--text-secondary);">
                        평균 일일: <strong style="color: var(--text-primary);">${App.formatCurrency(Math.round(categoryAvgDaily))}</strong>
                    </div>
                    ` : ''}
                    
                    <!-- 매출 진행 바 -->
                    <div style="margin-bottom: 8px;">
                        <div style="height: 8px; background-color: var(--bg-hover); border-radius: 4px; overflow: hidden; position: relative; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1); width: 100%;">
                            <div style="height: 100%; width: ${Math.min(item.percentage || 0, 100)}%; background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-primary) 100%); transition: width 0.5s ease; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                        </div>
                    </div>
                    
                    <!-- 코치별 기여도 -->
                    ${topCoaches.length > 0 ? `
                    <div style="margin-bottom: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">코치별 기여도</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${topCoaches.map(coach => `
                                <div style="padding: 4px 8px; background: var(--bg-hover); border-radius: 4px; font-size: 9px;">
                                    <span style="color: var(--text-primary); font-weight: 600;">${coach.name}</span>
                                    <span style="color: var(--text-secondary); margin-left: 4px;">${App.formatCurrency(coach.amount)}</span>
                                    <span style="color: var(--text-muted); margin-left: 4px;">(${coach.percentage.toFixed(1)}%)</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${item.label === '상품판매' && categoryProducts && categoryProducts.length > 0 ? `
                    <!-- 상품별 상세 정보 (간소화) -->
                    <div style="padding-top: 8px; border-top: 1px solid var(--border-color);">
                        <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">상품별 매출</div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${categoryProducts.slice(0, 3).map((product, pIndex) => {
                                const productCoaches = product.coaches || [];
                                return `
                                <div style="padding: 8px; background: var(--bg-hover); border-radius: 6px; border: 1px solid var(--border-color);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="font-size: 11px; font-weight: 700; color: var(--text-primary);">${product.productName || '상품명 없음'}</div>
                                        <div style="font-size: 14px; font-weight: 800; color: var(--accent-primary);">${App.formatCurrency(product.totalAmount || 0)}</div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: var(--text-secondary);">
                                        <span>판매: <strong style="color: var(--text-primary);">${product.count || 0}회</strong></span>
                                        ${productCoaches.length > 0 ? `
                                        <span>${productCoaches.slice(0, 2).map(c => `<strong style="color: var(--text-primary);">${c.coachName}</strong> (${c.count})`).join(', ')}${productCoaches.length > 2 ? ` +${productCoaches.length - 2}` : ''}</span>
                                        ` : '<span>미지정</span>'}
                                    </div>
                                </div>
                                `;
                            }).join('')}
                            ${categoryProducts.length > 3 ? `<div style="font-size: 9px; color: var(--text-muted); text-align: center; padding: 4px;">외 ${categoryProducts.length - 3}개 상품</div>` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
                `;
            }).join('')}
        </div>
    `;
    
    // 차트 데이터 저장 (모달에서 사용)
    window.categoryRevenueData = categoryData;
}

// 운영 지표 차트 렌더링 (클릭 가능)
function renderOperationalChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">데이터가 없습니다.</p>';
        return;
    }
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${data.map((item, index) => `
                <div style="display: flex; align-items: center; gap: 12px; padding: 4px; border-radius: 4px; cursor: pointer;" 
                     onclick="openDetailModal('${containerId}', ${index}, '${item.label}', '${item.label}')"
                     onmouseover="this.style.backgroundColor='var(--bg-hover)'"
                     onmouseout="this.style.backgroundColor='transparent'">
                    <div style="min-width: 100px; font-size: 12px; color: var(--text-secondary);">${item.label}</div>
                    <div style="flex: 1; height: 20px; background-color: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${item.percentage || 0}%; background-color: var(--accent-primary);"></div>
                    </div>
                    <div style="min-width: 60px; text-align: right; font-weight: 600; color: var(--text-primary);">${App.formatNumber(item.value)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderSimpleChart(containerId, data, revenueMetrics = {}) {
    const container = document.getElementById(containerId);
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">데이터가 없습니다.</p>';
        return;
    }
    
    // 매출 추이 차트만 처리 (그래프로 표시)
    const isTrendChart = containerId === 'revenue-trend-chart';
    
    if (isTrendChart) {
        // 매출 추이를 그래프로 표시 (평균선, 전월 비교, 최고/최저, 성장률, 누적 매출 포함)
        const maxValue = Math.max(...data.map(item => Math.max(item.value || 0, item.prevValue || 0, item.cumulative || 0)), 1);
        const chartHeight = 250;
        const paddingTop = 42;
        const paddingBottom = 40;
        const chartAreaHeight = chartHeight - paddingTop - paddingBottom;
        
        const trendAvg = revenueMetrics.trendAvg || 0;
        const trendMaxDate = revenueMetrics.trendMaxDate;
        const trendMaxValue = revenueMetrics.trendMaxValue || 0;
        const trendMinDate = revenueMetrics.trendMinDate;
        const trendMinValue = revenueMetrics.trendMinValue;
        const weekdayPattern = revenueMetrics.weekdayPattern || [];
        const maxWeekdayAvg = weekdayPattern.length ? Math.max(...weekdayPattern.map(d => d.avgRevenue || 0)) : 0;
        const minWeekdayAvg = weekdayPattern.length ? Math.min(...weekdayPattern.map(d => d.avgRevenue || 0)) : 0;
        
        // 평균선 Y 위치
        const avgY = paddingTop + chartAreaHeight - (trendAvg / maxValue) * chartAreaHeight;
        
        // 누적 매출 최대값 (별도 스케일)
        const maxCumulative = Math.max(...data.map(item => item.cumulative || 0), 1);
        // 데이터 많을 때 글자 잘리지 않도록 최소 너비 보장 (가로 스크롤로 전부 보임)
        const chartMinWidth = Math.max(380, data.length * 32);
        
        container.innerHTML = `
            <div class="metric-content-subtitle">일별·한달 매출 추이</div>
            <div style="min-width: ${chartMinWidth}px; position: relative; height: ${chartHeight}px; padding: 24px 28px 16px; flex-shrink: 0; overflow: visible;">
                <svg width="100%" height="${chartHeight}" style="overflow: visible;">
                    <!-- 배경 그리드 -->
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--border-color)" stroke-width="0.5" opacity="0.3"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="${chartAreaHeight}" y="${paddingTop}" fill="url(#grid)" opacity="0.2"/>
                    
                    <!-- 평균선 -->
                    ${trendAvg > 0 ? `
                    <line 
                        x1="0" 
                        y1="${avgY}" 
                        x2="100%" 
                        y2="${avgY}" 
                        stroke="var(--warning)" 
                        stroke-width="2" 
                        stroke-dasharray="5,5"
                        opacity="0.7"
                    />
                    ` : ''}
                    
                    ${data.map((item, index) => {
                        // 데이터 개수에 따라 막대 폭 조정 (일주일일 때 더 좁게)
                        const isWeekView = window.revenueTrendPeriod === 'week' || data.length <= 8;
                        let barWidth;
                        if (isWeekView) {
                            barWidth = Math.max(100 / data.length - 10, 4);
                        } else {
                            barWidth = Math.max(100 / data.length - 5, 2.5);
                        }
                        // 마지막 막대가 잘리지 않도록 0~(100-barWidth) 구간에 배치
                        const x = (index / Math.max(data.length - 1, 1)) * (100 - barWidth);
                        const value = item.value || 0;
                        const prevValue = item.prevValue || 0;
                        const cumulative = item.cumulative || 0;
                        const growthRate = item.growthRate || 0;
                        
                        const height = maxValue > 0 ? (value / maxValue) * chartAreaHeight : 0;
                        const y = paddingTop + chartAreaHeight - height;
                        
                        const prevHeight = maxValue > 0 ? (prevValue / maxValue) * chartAreaHeight : 0;
                        const prevY = paddingTop + chartAreaHeight - prevHeight;
                        
                        // 누적 매출선 (별도 스케일)
                        const cumulativeHeight = maxCumulative > 0 ? (cumulative / maxCumulative) * chartAreaHeight : 0;
                        const cumulativeY = paddingTop + chartAreaHeight - cumulativeHeight;
                        
                        const isMax = item.isMax;
                        const isMin = item.isMin;
                        // 최고 → 노란 고정, + 성장률 → 초록, - 성장률 → 빨강, 그외 accent/최저
                        const barColor = isMax ? '#f0c000' : (index > 0 && growthRate > 0 ? 'var(--success)' : index > 0 && growthRate < 0 ? 'var(--danger)' : (isMin ? 'var(--danger)' : 'var(--accent-primary)'));
                        
                        // 날짜 포맷팅 (MM/DD + 요일)
                        const weekdays = ['일','월','화','수','목','금','토'];
                        const dateLabel = item.label ? (() => {
                            const mmdd = item.label.split('-').slice(1).join('/');
                            const dayNum = new Date(item.label + 'T12:00:00').getDay();
                            return `${mmdd} (${weekdays[dayNum]})`;
                        })() : '';
                        
                        return `
                            <g>
                                <!-- 전월 비교 선 (점선) -->
                                ${prevValue > 0 ? `
                                <line 
                                    x1="${x + barWidth/2}%" 
                                    y1="${prevY}" 
                                    x2="${index < data.length - 1 ? ((index + 1) / Math.max(data.length - 1, 1) * (100 - barWidth) + barWidth/2) + '%' : x + barWidth/2 + '%'}" 
                                    y2="${index < data.length - 1 ? (paddingTop + chartAreaHeight - ((data[index + 1].prevValue || 0) / maxValue) * chartAreaHeight) : prevY}" 
                                    stroke="var(--text-muted)" 
                                    stroke-width="1.5" 
                                    stroke-dasharray="3,3"
                                    opacity="0.5"
                                />
                                ` : ''}
                                
                                <!-- 누적 매출선 (점선) -->
                                ${index > 0 ? `
                                <line 
                                    x1="${((index - 1) / Math.max(data.length - 1, 1) * (100 - barWidth) + barWidth/2)}%" 
                                    y1="${paddingTop + chartAreaHeight - ((data[index - 1].cumulative || 0) / maxCumulative) * chartAreaHeight}" 
                                    x2="${x + barWidth/2}%" 
                                    y2="${cumulativeY}" 
                                    stroke="var(--info)" 
                                    stroke-width="1.5" 
                                    stroke-dasharray="2,2"
                                    opacity="0.6"
                                />
                                ` : ''}
                                
                                <!-- 매출 막대 -->
                                <rect 
                                    x="${x}%" 
                                    y="${y}" 
                                    width="${barWidth}%" 
                                    height="${height}" 
                                    fill="${barColor}" 
                                    rx="2"
                                    style="cursor: pointer; transition: all 0.2s;"
                                    onmouseover="this.style.opacity='0.8'; this.setAttribute('y', ${y - 2}); this.setAttribute('height', ${height + 4});"
                                    onmouseout="this.style.opacity='1'; this.setAttribute('y', ${y}); this.setAttribute('height', ${height});"
                                    onclick="openDetailModal('${containerId}', ${index}, '', '${item.label}')"
                                    title="${App.formatCurrency(value)} (${item.label})${prevValue > 0 ? ' · 전월: ' + App.formatCurrency(prevValue) : ''}"
                                />
                                
                                <!-- 최고/최저 표시 -->
                                ${isMax ? `
                                <circle 
                                    cx="${x + barWidth/2}%" 
                                    cy="${y}" 
                                    r="4" 
                                    fill="#f0c000" 
                                    stroke="white" 
                                    stroke-width="2"
                                />
                                <text 
                                    x="${x + barWidth/2}%" 
                                    y="${y - 8}" 
                                    text-anchor="middle" 
                                    font-size="8" 
                                    fill="#f0c000"
                                    font-weight="700"
                                >최고</text>
                                ` : ''}
                                ${isMin && value > 0 ? `
                                <circle 
                                    cx="${x + barWidth/2}%" 
                                    cy="${y + height}" 
                                    r="3" 
                                    fill="var(--danger)" 
                                    stroke="white" 
                                    stroke-width="1.5"
                                />
                                ` : ''}
                                
                                <!-- 성장률 표시 (막대 색에 맞춤) -->
                                ${index > 0 && growthRate !== 0 ? `
                                <text 
                                    x="${x + barWidth/2}%" 
                                    y="${isMax ? (y - 20) : (y - 12)}" 
                                    text-anchor="middle" 
                                    font-size="8" 
                                    fill="${barColor}"
                                    font-weight="700"
                                >${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%</text>
                                ` : ''}
                                
                                <!-- 날짜 라벨 (막대 아래~하단 여백 중간) -->
                                <text 
                                    x="${x + barWidth/2}%" 
                                    y="${paddingTop + chartAreaHeight + paddingBottom / 2}" 
                                    text-anchor="middle" 
                                    font-size="8" 
                                    fill="${barColor}"
                                    style="pointer-events: none;"
                                >${dateLabel}</text>
                            </g>
                        `;
                    }).join('')}
                </svg>
                
                <!-- 범례: 최고 / 최저 / 평균 (위에서 아래로) -->
                <div style="position: absolute; top: 0; right: 0; font-size: 12px; display: flex; flex-direction: column; gap: 4px; text-align: right;">
                    ${trendMaxValue > 0 ? `<div style="color: #f0c000;">최고: ${App.formatCurrency(trendMaxValue)}</div>` : ''}
                    ${trendMinValue != null ? `<div style="color: #e74c3c;">최저: ${App.formatCurrency(trendMinValue)}</div>` : ''}
                    ${trendAvg > 0 ? `<div style="color: var(--success);">평균: ${App.formatCurrency(Math.round(trendAvg))}</div>` : ''}
                </div>
            </div>
            
            <!-- 요일별 패턴 -->
            ${weekdayPattern.length > 0 ? `
            <div style="margin-top: 16px; padding: 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); flex-shrink: 0;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">요일별 평균 매출</div>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
                    ${(function() {
                        return weekdayPattern.map(day => {
                            const val = day.avgRevenue || 0;
                            const isMaxDay = maxWeekdayAvg > 0 && val === maxWeekdayAvg;
                            const isMinDay = weekdayPattern.length && val === minWeekdayAvg;
                            const bg = isMaxDay ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.28) 0%, rgba(255, 215, 0, 0.1) 50%, rgba(255, 215, 0, 0.05) 100%)' : 'transparent';
                            const borderLeft = isMaxDay ? '3px solid #f0c000' : isMinDay ? '3px solid var(--danger)' : '3px solid var(--accent-primary)';
                            const amountColor = isMaxDay ? '#f0c000' : (isMinDay ? 'var(--danger)' : 'var(--accent-primary)');
                            return `
                        <div style="text-align: center; padding: 6px; background: ${bg}; border-radius: 4px; border: 1px solid var(--border-color); border-left: ${borderLeft}">
                            <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 4px;">${day.weekday}</div>
                            <div style="font-size: 12px; font-weight: 700; color: ${amountColor};">${App.formatCurrency(Math.round(day.avgRevenue))}</div>
                            <div style="font-size: 8px; color: var(--text-muted); margin-top: 2px;">${day.count}일</div>
                        </div>
                    `; }).join(''); })()}
                </div>
            </div>
            ` : ''}
        `;
        
        window.revenueTrendData = data;
    } else {
        // 기타 차트는 기존 방식 유지
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${data.map((item, index) => `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 4px; border-radius: 4px;">
                        <div style="min-width: 100px; font-size: 12px; color: var(--text-secondary);">${item.label}</div>
                        <div style="flex: 1; height: 20px; background-color: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${item.percentage || 0}%; background-color: var(--accent-primary);"></div>
                        </div>
                        <div style="min-width: 60px; text-align: right; font-weight: 600; color: var(--text-primary);">${App.formatCurrency(item.value)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

// 카테고리별 회원 통계 렌더링 (대관 포함, 카테고리별 고유색)
function renderCategoryMemberChart(containerId, categoryData) {
    const container = document.getElementById(containerId);
    const { memberCount = {}, activeProducts = {} } = categoryData;
    
    const categoryLabels = {
        'BASEBALL': '야구',
        'TRAINING': '트레이닝',
        'PILATES': '필라테스',
        'GENERAL': '일반',
        'RENTAL': '대관'
    };
    // 다른 페이지와 동일한 카테고리 고유색 (products.js / 코치 배지 기준)
    const categoryColors = {
        'BASEBALL': { border: 'var(--accent-primary)', text: 'var(--accent-primary)' },           // 야구 - 파란
        'TRAINING': { border: 'var(--success)', text: 'var(--success)' },                         // 트레이닝 - 초록
        'PILATES': { border: 'var(--info)', text: 'var(--info)' },                                 // 필라테스 - 하늘
        'RENTAL': { border: 'var(--rental)', text: 'var(--rental)' },                             // 대관 - 보라
        'GENERAL': { border: 'var(--border-color)', text: 'var(--text-secondary)' }
    };
    const displayOrder = ['BASEBALL', 'TRAINING', 'PILATES', 'RENTAL'];
    const excludedCategories = ['TRAINING_FITNESS'];
    const extraCategories = Object.keys(memberCount)
        .filter(c => !displayOrder.includes(c) && !excludedCategories.includes(c));
    const categoriesToShow = [...displayOrder, ...extraCategories];
    
    const sortedCategories = categoriesToShow
        .map(cat => [cat, memberCount[cat] || 0])
        .sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = `
        <div class="metric-content-subtitle">카테고리별 회원 수·활성 이용권</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${sortedCategories.map(([category, count]) => {
                const label = categoryLabels[category] || category;
                const products = activeProducts[category] || 0;
                const avgProducts = count > 0 ? (products / count).toFixed(1) : '0.0';
                const colors = categoryColors[category] || categoryColors['GENERAL'];
                return `
                    <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid ${colors.border};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${label}</div>
                            <div style="font-size: 18px; font-weight: 800; color: ${colors.text};">${count}명</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-secondary);">
                            <span>활성 이용권: ${products}개</span>
                            <span>평균: ${avgProducts}개/명</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 등급 고유색 (members.css / common.css 배지와 동일)
const GRADE_COLORS = {
    'SOCIAL': '#6c757d',
    'ELITE_ELEMENTARY': '#8e44ad',
    'ELITE_MIDDLE': '#2980b9',
    'ELITE_HIGH': '#f39c12',
    'YOUTH': '#84cc16',           // 유소년 - 라임 (다른 등급과 겹치지 않게)
    'OTHER': '#009688'
};

// 등급별 상세 통계 렌더링
function renderGradeDetailChart(containerId, gradeData) {
    const container = document.getElementById(containerId);
    const { gradeStatusDistribution, gradeActiveCount, gradeRecentVisitors } = gradeData;
    
    if (!gradeStatusDistribution || Object.keys(gradeStatusDistribution).length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">데이터가 없습니다.</p>';
        return;
    }
    
    const gradeLabels = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트 (초)',
        'ELITE_MIDDLE': '엘리트 (중)',
        'ELITE_HIGH': '엘리트 (고)',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    };
    
    const sortedGrades = Object.entries(gradeStatusDistribution)
        .sort((a, b) => {
            const totalA = Object.values(a[1]).reduce((sum, val) => sum + val, 0);
            const totalB = Object.values(b[1]).reduce((sum, val) => sum + val, 0);
            return totalB - totalA;
        });
    
    container.innerHTML = `
        <div class="metric-content-subtitle">등급별 활성·휴면·이탈·최근 방문</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${sortedGrades.map(([grade, statusMap]) => {
                const label = gradeLabels[grade] || grade;
                const color = GRADE_COLORS[grade] || 'var(--accent-primary)';
                const active = statusMap['ACTIVE'] || 0;
                const inactive = statusMap['INACTIVE'] || 0;
                const withdrawn = statusMap['WITHDRAWN'] || 0;
                const total = active + inactive + withdrawn;
                const recentVisitors = gradeRecentVisitors[grade] || 0;
                
                return `
                    <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid ${color};">
                        <div style="font-size: 13px; font-weight: 700; color: ${color}; margin-bottom: 6px;">${label}</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 13px;">
                            <div>
                                <div style="color: var(--success);">활성</div>
                                <div style="font-weight: 700; color: ${color};">${active}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary);">휴면</div>
                                <div style="font-weight: 700; color: #fff;">${inactive}</div>
                            </div>
                            <div>
                                <div style="color: var(--danger);">이탈</div>
                                <div style="font-weight: 700; color: var(--danger);">${withdrawn}</div>
                            </div>
                        </div>
                        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-color); font-size: 11px; color: var(--text-secondary);">
                            최근 방문: <span style="font-weight: 600; color: var(--info);">${recentVisitors}명</span> (30일 내)
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 등급별 분포 차트 렌더링 (회원/대시보드와 동일한 등급 고유색)
function renderGradeDistributionChart(containerId, gradeDistribution) {
    const container = document.getElementById(containerId);
    if (!gradeDistribution || Object.keys(gradeDistribution).length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">데이터가 없습니다.</p>';
        return;
    }
    
    const gradeLabels = {
        'SOCIAL': '사회인',
        'ELITE_ELEMENTARY': '엘리트 (초)',
        'ELITE_MIDDLE': '엘리트 (중)',
        'ELITE_HIGH': '엘리트 (고)',
        'YOUTH': '유소년',
        'OTHER': '기타 종목'
    };
    
    const total = Object.values(gradeDistribution).reduce((sum, count) => sum + count, 0);
    const sortedGrades = Object.entries(gradeDistribution)
        .sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = `
        <div class="metric-content-subtitle">등급별 회원 분포</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
            ${sortedGrades.map(([grade, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const label = gradeLabels[grade] || grade;
                const color = GRADE_COLORS[grade] || 'var(--accent-primary)';
                return `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 4px; background: var(--bg-secondary); border-left: 3px solid ${color};">
                        <div style="min-width: 90px; font-size: 13px; color: var(--text-primary); font-weight: 600;">${label}</div>
                        <div style="flex: 1; height: 18px; background-color: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${percentage}%; background-color: ${color}; transition: width 0.3s;"></div>
                        </div>
                        <div style="min-width: 55px; text-align: right;">
                            <span style="font-weight: 700; color: ${color}; font-size: 18px;">${count}</span>
                            <span style="font-size: 11px; color: var(--text-secondary); margin-left: 3px;">(${percentage}%)</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 회원 상태 차트 렌더링
function renderMemberStatusChart(containerId, statusData) {
    const container = document.getElementById(containerId);
    const { active, inactive, withdrawn } = statusData;
    const total = active + inactive + withdrawn;
    
    if (total === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">데이터가 없습니다.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="metric-content-subtitle">활성·휴면·이탈 비율</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--success);">
                <div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">활성</div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--success);">${active}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">${total > 0 ? ((active / total) * 100).toFixed(1) : 0}%</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid #e9ecef;">
                <div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">휴면</div>
                    <div style="font-size: 18px; font-weight: 800; color: #fff;">${inactive}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">${total > 0 ? ((inactive / total) * 100).toFixed(1) : 0}%</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--danger);">
                <div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">이탈</div>
                    <div style="font-size: 18px; font-weight: 800; color: var(--danger);">${withdrawn}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">${total > 0 ? ((withdrawn / total) * 100).toFixed(1) : 0}%</div>
            </div>
        </div>
    `;
}

// 이용권 통계 렌더링
function renderMemberProductStats(containerId, stats) {
    const container = document.getElementById(containerId);
    const { avgProductsPerMember, totalActiveProducts, membersWithProducts, activeCount } = stats;
    
    container.innerHTML = `
        <div class="metric-content-subtitle">회원당 평균·활성 이용권·보유율</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">평균 이용권 수</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">${avgProductsPerMember.toFixed(1)}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">회원당 평균</div>
            </div>
            <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--success);">
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">활성 이용권</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--success);">${totalActiveProducts || 0}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${membersWithProducts || 0}명 보유</div>
            </div>
            <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--info);">
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">이용권 보유율</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--info);">
                    ${activeCount > 0 ? ((membersWithProducts / activeCount) * 100).toFixed(1) : 0}%
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">활성 회원 중 보유</div>
            </div>
        </div>
    `;
}

function renderMemberTrendChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">데이터가 없습니다.</p>';
        return;
    }
    
    // 신규/이탈 추이 차트 (신규: 파란색 +숫자, 이탈: 빨간색 -숫자, 클릭 가능)
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${data.map((item, index) => {
                const newCount = item.newCount || 0;
                const withdrawnCount = item.withdrawnCount || 0;
                const netChange = item.netChange || 0;
                
                let content = '';
                if (newCount > 0) {
                    content += `<span style="color: var(--info); font-weight: 600;">+${newCount}</span>`;
                }
                if (withdrawnCount > 0) {
                    if (content) content += ' / ';
                    content += `<span style="color: var(--danger); font-weight: 600;">-${withdrawnCount}</span>`;
                }
                if (!content) {
                    content = '<span style="color: var(--text-muted);">0</span>';
                }
                
                return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 4px; border-radius: 4px; cursor: pointer;" 
                         onclick="openDetailModal('${containerId}', ${index}, '${item.label}', '${item.label}')"
                         onmouseover="this.style.backgroundColor='var(--bg-hover)'"
                         onmouseout="this.style.backgroundColor='transparent'">
                        <div style="min-width: 100px; font-size: 12px; color: var(--text-secondary);">${item.label}</div>
                        <div style="flex: 1; display: flex; align-items: center; gap: 8px;">
                            ${content}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // 차트 데이터 저장
    window.memberTrendData = data;
}

function renderMemberTopSpenders(containerId, data, scope) {
    scope = scope || 'all';
    window.memberTopSpendersScope = scope;
    const container = document.getElementById(containerId);
    if (!container) return;
    var subtitle = '전체 누적 결제 금액 순 (5위·공동 5위까지)';
    if (scope === 'month') {
        var monthEl = document.getElementById('analytics-top-spenders-month');
        if (monthEl && monthEl.options[monthEl.selectedIndex]) subtitle = monthEl.options[monthEl.selectedIndex].text + ' 결제 금액 순 (5위·공동 5위까지)';
        else subtitle = '해당 월 결제 금액 순 (5위·공동 5위까지)';
    } else if (scope === 'period') {
        var startEl = document.getElementById('analytics-top-spenders-start');
        var endEl = document.getElementById('analytics-top-spenders-end');
        if (startEl && endEl && startEl.value && endEl.value) subtitle = startEl.value.replace(/-/g, '.') + ' ~ ' + endEl.value.replace(/-/g, '.') + ' 결제 금액 순 (5위·공동 5위까지)';
        else subtitle = '선택 기간 내 결제 금액 순 (5위·공동 5위까지)';
    }
    if (!data || data.length === 0) {
        const emptyMsg = scope === 'all' ? '결제 내역이 없습니다.' : scope === 'month' ? '해당 월 결제 내역이 없습니다.' : '선택한 기간 내 결제 내역이 없습니다.';
        container.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">' + emptyMsg + '</p>';
        window.memberTopSpendersFull = [];
        return;
    }
    window.memberTopSpendersFull = data;
    const formatAmount = (n) => {
        if (n == null) return '₩0';
        return '₩' + Number(n).toLocaleString();
    };
    // 순위 부여: 금액 동일 시 같은 순위
    let prevAmount = null;
    let rank = 0;
    const withRank = data.map((item, index) => {
        const amount = item.totalAmount != null ? item.totalAmount : 0;
        if (prevAmount === null || amount !== prevAmount) {
            rank = index + 1;
            prevAmount = amount;
        }
        return { ...item, rank, totalAmount: amount };
    });
    // 5위까지 표시 (공동 5위 포함)
    const top5 = withRank.filter((item) => item.rank <= 5);
    container.innerHTML = `
        <div style="padding: 8px 0;">
            <div class="metric-content-subtitle">${subtitle}</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${top5.map((item) => {
                    const name = item.memberName || '-';
                    const number = item.memberNumber || '-';
                    const amount = item.totalAmount;
                    const rankText = item.rank;
                    const rankClass = item.rank === 1 ? 'top-spender-row--gold' : item.rank === 2 ? 'top-spender-row--silver' : item.rank === 3 ? 'top-spender-row--bronze' : '';
                    return `
                        <div class="top-spender-row ${rankClass}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                            <span class="top-spender-rank">${rankText}</span>
                            <div style="flex: 1; min-width: 0;">
                                <div class="top-spender-name">${name}</div>
                                <div class="top-spender-number">${number}</div>
                            </div>
                            <span class="top-spender-amount">${formatAmount(amount)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <button type="button" class="btn btn-secondary" style="font-size: 12px; padding: 6px 14px;" onclick="openTopSpendersFullModal()">전체 보기 (${data.length}명)</button>
            </div>
        </div>
    `;
}

function openTopSpendersFullModal() {
    const data = window.memberTopSpendersFull || [];
    const scope = window.memberTopSpendersScope || 'all';
    var modalTitle = '개인 결제 TOP 전체 (누적)';
    if (scope === 'month') {
        var monthEl = document.getElementById('analytics-top-spenders-month');
        if (monthEl && monthEl.options[monthEl.selectedIndex]) modalTitle = '개인 결제 TOP ' + monthEl.options[monthEl.selectedIndex].text;
        else modalTitle = '개인 결제 TOP 해당 월';
    } else if (scope === 'period') {
        var startEl = document.getElementById('analytics-top-spenders-start');
        var endEl = document.getElementById('analytics-top-spenders-end');
        if (startEl && endEl && startEl.value && endEl.value) modalTitle = '개인 결제 TOP ' + startEl.value.replace(/-/g, '.') + ' ~ ' + endEl.value.replace(/-/g, '.');
        else modalTitle = '개인 결제 TOP 선택 기간';
    }
    const modalId = 'analytics-top-spenders-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 560px; width: 95%;">
                <div class="modal-header">
                    <h2 class="modal-title" id="analytics-top-spenders-modal-title">${modalTitle}</h2>
                    <button class="modal-close" onclick="App.Modal.close('${modalId}')">×</button>
                </div>
                <div class="modal-body" id="analytics-top-spenders-content" style="overflow-y: auto; max-height: 70vh;"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    const titleEl = document.getElementById('analytics-top-spenders-modal-title');
    if (titleEl) titleEl.textContent = modalTitle;
    const formatAmount = (n) => {
        if (n == null) return '₩0';
        return '₩' + Number(n).toLocaleString();
    };
    let prevAmount = null;
    let rank = 0;
    const withRank = data.map((item, index) => {
        const amount = item.totalAmount != null ? item.totalAmount : 0;
        if (prevAmount === null || amount !== prevAmount) {
            rank = index + 1;
            prevAmount = amount;
        }
        return { ...item, rank, totalAmount: amount };
    });
    const content = document.getElementById('analytics-top-spenders-content');
    if (!content) return;
    if (data.length === 0) {
        content.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">데이터가 없습니다.</p>';
    } else {
        content.innerHTML = `
            <div style="padding: 8px 0;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${withRank.map((item) => {
                        const name = item.memberName || '-';
                        const number = item.memberNumber || '-';
                        const amount = item.totalAmount;
                        const rankText = item.rank;
                        const rankClass = item.rank === 1 ? 'top-spender-row--gold' : item.rank === 2 ? 'top-spender-row--silver' : item.rank === 3 ? 'top-spender-row--bronze' : '';
                        return `
                            <div class="top-spender-row ${rankClass}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                                <span class="top-spender-rank" style="min-width: 28px;">${rankText}</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div class="top-spender-name">${name}</div>
                                    <div class="top-spender-number">${number}</div>
                                </div>
                                <span class="top-spender-amount">${formatAmount(amount)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    App.Modal.open(modalId);
}

function exportAnalytics() {
    App.showNotification('CSV 다운로드 기능은 준비 중입니다.', 'info');
}

// 세부 내역 모달 열기
async function openDetailModal(chartType, index, value, displayLabel) {
    let period = document.getElementById('analytics-period').value;
    let startDate = document.getElementById('analytics-start-date').value;
    let endDate = document.getElementById('analytics-end-date').value;
    if (period === 'all') {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        startDate = '2026-01-01';
        endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    // displayLabel이 없으면 value를 사용 (하위 호환성)
    const label = displayLabel || value;
    
    let title = '';
    let data = [];
    
    try {
        if (chartType === 'category-revenue-chart') {
            // 카테고리별 매출 세부 내역
            title = `${label} 세부 내역`;
            const params = new URLSearchParams();
            if ((period === 'custom' || period === 'all') && startDate && endDate) {
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }
            // 영문 카테고리명 사용 (한글 대신)
            data = await App.api.get(`/analytics/revenue/category/${value}?${params}`);
        } else if (chartType === 'revenue-trend-chart') {
            // 날짜별 매출 세부 내역
            title = `${label} 결제 내역`;
            // 날짜는 일반적으로 URL 인코딩이 필요 없지만 안전을 위해 인코딩
            const encodedDate = encodeURIComponent(label);
            data = await App.api.get(`/analytics/revenue/date/${encodedDate}`);
        } else if (chartType === 'member-trend-chart') {
            // 회원 지표 세부 내역
            title = '회원 지표 세부 내역';
            const params = new URLSearchParams();
            if ((period === 'custom' || period === 'all') && startDate && endDate) {
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }
            data = await App.api.get(`/analytics/members/details?${params}`);
        } else if (chartType === 'facility-utilization-chart' || chartType === 'hourly-demand-chart' || chartType === 'operational-details') {
            // 운영 지표 세부 내역
            title = '운영 지표 세부 내역';
            const params = new URLSearchParams();
            if ((period === 'custom' || period === 'all') && startDate && endDate) {
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }
            const details = await App.api.get(`/analytics/operational/details?${params}`);
            renderOperationalDetailModal(title, details);
            return;
        }
        
        renderDetailModal(title, data, chartType);
    } catch (error) {
        App.err('세부 내역 로드 실패:', error);
        App.showNotification('세부 내역을 불러오는데 실패했습니다.', 'danger');
    }
}

// 세부 내역 모달 렌더링
function renderDetailModal(title, data, chartType) {
    const modalId = 'analytics-detail-modal';
    
    // 모달이 없으면 생성
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 1400px; max-height: 85vh; width: 95%;">
                <div class="modal-header">
                    <h2 class="modal-title" id="analytics-detail-title">${title}</h2>
                    <button class="modal-close" onclick="App.Modal.close('${modalId}')">×</button>
                </div>
                <div class="modal-body" id="analytics-detail-content" style="overflow-y: auto; max-height: 70vh; overflow-x: auto;">
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('analytics-detail-title').textContent = title;
    const content = document.getElementById('analytics-detail-content');
    
    if (!data || data.length === 0) {
        content.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">세부 내역이 없습니다.</p>';
    } else {
        if (chartType === 'category-revenue-chart' || chartType === 'revenue-trend-chart') {
            // 결제 내역 테이블
            content.innerHTML = `
                <div class="table-container" style="overflow-x: auto;">
                    <table class="table" style="min-width: 1000px; width: 100%;">
                        <thead>
                            <tr>
                                <th style="min-width: 150px;">결제일시</th>
                                <th style="min-width: 80px;">회원</th>
                                <th style="min-width: 200px;">상품명</th>
                                <th style="min-width: 100px;">코치</th>
                                <th style="min-width: 100px;">결제방법</th>
                                <th style="min-width: 120px;">금액</th>
                                <th style="min-width: 250px;">메모</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(p => `
                                <tr>
                                    <td style="white-space: nowrap;">${p.paidAt ? App.formatDateTime(p.paidAt) : '-'}</td>
                                    <td>${p.member ? p.member.name : '비회원'}</td>
                                    <td>${p.product ? p.product.name : '-'}</td>
                                    <td>${p.coach ? p.coach.name : '-'}</td>
                                    <td>${getPaymentMethodText(p.paymentMethod)}</td>
                                    <td style="font-weight: 600; color: var(--accent-primary); white-space: nowrap;">
                                        ${App.formatCurrency(p.amount || 0)}
                                        ${p.refundAmount > 0 ? `<br><small style="color: var(--danger);">환불: ${App.formatCurrency(p.refundAmount)}</small>` : ''}
                                    </td>
                                    <td style="word-break: break-word; max-width: 300px;">${p.memo || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (chartType === 'member-trend-chart') {
            // 회원 내역 테이블
            content.innerHTML = `
                <div class="table-container" style="overflow-x: auto;">
                    <table class="table" style="min-width: 900px; width: 100%;">
                        <thead>
                            <tr>
                                <th style="min-width: 120px;">회원번호</th>
                                <th style="min-width: 80px;">이름</th>
                                <th style="min-width: 120px;">전화번호</th>
                                <th style="min-width: 100px;">등급</th>
                                <th style="min-width: 150px;">학교/소속</th>
                                <th style="min-width: 100px;">담당 코치</th>
                                <th style="min-width: 150px;">가입일</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(m => `
                                <tr>
                                    <td>${m.memberNumber || '-'}</td>
                                    <td>${m.name || '-'}</td>
                                    <td style="white-space: nowrap;">${m.phoneNumber || '-'}</td>
                                    <td>${m.grade ? (App.MemberGrade && App.MemberGrade.getText ? App.MemberGrade.getText(m.grade) : m.grade) : '-'}</td>
                                    <td>${m.school || '-'}</td>
                                    <td>${m.coach ? m.coach.name : '-'}</td>
                                    <td style="white-space: nowrap;">${m.createdAt ? App.formatDateTime(m.createdAt) : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }
    
    App.Modal.open(modalId);
}

// 운영 지표 세부 내역 모달
function renderOperationalDetailModal(title, details) {
    const modalId = 'analytics-detail-modal';
    
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 1400px; max-height: 85vh; width: 95%;">
                <div class="modal-header">
                    <h2 class="modal-title" id="analytics-detail-title">${title}</h2>
                    <button class="modal-close" onclick="App.Modal.close('${modalId}')">×</button>
                </div>
                <div class="modal-body" id="analytics-detail-content" style="overflow-y: auto; max-height: 70vh; overflow-x: auto;">
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('analytics-detail-title').textContent = title;
    const content = document.getElementById('analytics-detail-content');
    
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 10px;">예약 통계</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                <div class="metric-card">
                    <div class="metric-label">전체 예약</div>
                    <div class="metric-value">${details.totalBookings || 0}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">확정 예약</div>
                    <div class="metric-value">${details.confirmedBookings || 0}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">완료 예약</div>
                    <div class="metric-value">${details.completedBookings || 0}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">취소 예약</div>
                    <div class="metric-value">${details.cancelledBookings || 0}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">노쇼 예약</div>
                    <div class="metric-value">${details.noShowBookings || 0}</div>
                </div>
            </div>
        </div>
        <div>
            <h3 style="margin-bottom: 10px;">시설별 상세</h3>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>시설명</th>
                            <th>전체 예약</th>
                            <th>확정 예약</th>
                            <th>완료 예약</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(details.facilities || []).map(f => `
                            <tr>
                                <td>${f.name || '-'}</td>
                                <td>${f.totalBookings || 0}</td>
                                <td>${f.confirmedBookings || 0}</td>
                                <td>${f.completedBookings || 0}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    App.Modal.open(modalId);
}

function getPaymentMethodText(method) {
    if (!method) return '-';
    const map = {
        'CASH': '현금',
        'CARD': '카드',
        'BANK_TRANSFER': '계좌이체',
        'EASY_PAY': '간편결제'
    };
    return map[method] || method;
}

// 학교/소속 현황 로드
async function loadSchoolStats() {
    try {
        const members = await App.api.get('/members');
        _schoolStatsMembers = members || [];
        
        // 학교/소속별 그룹화
        const schoolGroups = {};
        let totalCount = 0;
        members.forEach(member => {
            totalCount++;
            // 학교 필드가 null, undefined, 빈 문자열, 공백만 있는 경우 '미입력'으로 처리
            let school = member.school;
            if (!school || (typeof school === 'string' && school.trim() === '')) {
                school = '미입력';
            } else {
                school = school.trim();
            }
            
            if (!schoolGroups[school]) {
                schoolGroups[school] = 0;
            }
            schoolGroups[school]++;
        });
        
        // 회원 수가 많은 순으로 정렬
        const sortedSchools = Object.entries(schoolGroups)
            .sort((a, b) => b[1] - a[1]);
        
        const container = document.getElementById('school-stats-container');
        
        if (sortedSchools.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center; font-size: 12px;">데이터가 없습니다.</p>';
            return;
        }
        
        // 총합 확인 (디버깅용)
        const sumCount = sortedSchools.reduce((sum, [, count]) => sum + count, 0);
        App.log('학교/소속 현황 - 총 회원 수:', totalCount, '집계된 회원 수:', sumCount);
        
        container.innerHTML = `
            <div class="metric-content-subtitle">회원 소속별 현황</div>
            ${sortedSchools.map(([school, count]) => `
            <div class="school-stat-row" data-school="${App.escapeHtml(school)}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color); cursor: pointer;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" title="클릭하면 해당 소속 회원 목록 보기">
                <span style="font-size: 13px; color: var(--text-primary);">${App.escapeHtml(school)}</span>
                <span style="font-size: 18px; font-weight: 600; color: var(--accent-primary);">${count}명</span>
            </div>
        `).join('')}`;
        container.querySelectorAll('.school-stat-row').forEach(el => {
            el.addEventListener('click', function() {
                const school = this.getAttribute('data-school');
                if (school) showSchoolDetail(school);
            });
        });
    } catch (error) {
        App.err('학교/소속 현황 로드 실패:', error);
        const container = document.getElementById('school-stats-container');
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; font-size: 12px;">데이터를 불러올 수 없습니다.</p>';
    }
}

// 학교/소속 클릭 시 해당 소속 회원 현황 모달
function showSchoolDetail(schoolName) {
    const normalized = schoolName === '미입력' ? '' : schoolName;
    const list = _schoolStatsMembers.filter(m => {
        const s = (m.school || '').trim();
        if (schoolName === '미입력') return !s;
        return s === schoolName;
    });
    const titleEl = document.getElementById('school-detail-modal-title');
    const bodyEl = document.getElementById('school-detail-modal-body');
    if (!titleEl || !bodyEl) return;
    titleEl.textContent = (schoolName || '소속') + ' 회원 현황';
    if (list.length === 0) {
        bodyEl.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 16px;">해당 소속 회원이 없습니다.</p>';
    } else {
        const gradeLabels = { 'SOCIAL': '사회인', 'ELITE_ELEMENTARY': '엘리트(초)', 'ELITE_MIDDLE': '엘리트(중)', 'ELITE_HIGH': '엘리트(고)', 'YOUTH': '유소년', 'OTHER': '기타 종목' };
        bodyEl.innerHTML = `
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;"><strong>${App.escapeHtml(String(schoolName))}</strong> · 총 ${list.length}명</p>
            <div class="table-container" style="max-height: 42vh; overflow-y: auto;">
                <table class="table">
                    <thead><tr><th>회원번호</th><th>이름</th><th>등급</th><th>담당 코치</th></tr></thead>
                    <tbody>
                        ${list.map(m => `
                            <tr>
                                <td>${App.escapeHtml(m.memberNumber || '-')}</td>
                                <td>${App.escapeHtml(m.name || '-')}</td>
                                <td>${App.escapeHtml(gradeLabels[m.grade] || m.grade || '-')}</td>
                                <td>${App.escapeHtml((m.coach && m.coach.name) || (m.coachNames || '-'))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    App.Modal.open('school-detail-modal');
}

// 매출 추이 차트 필터 기간 설정
function setRevenueTrendPeriod(period) {
    App.log('매출 추이 필터 변경:', period);
    window.revenueTrendPeriod = period;
    updateRevenueTrendFilterButtons();
    loadRevenueTrendChart();
}

// 매출 추이 필터 버튼 상태 업데이트
function updateRevenueTrendFilterButtons() {
    const weekBtn = document.getElementById('revenue-trend-filter-week');
    const monthBtn = document.getElementById('revenue-trend-filter-month');
    
    if (weekBtn && monthBtn) {
        const period = window.revenueTrendPeriod || 'week';
        if (period === 'week') {
            weekBtn.className = 'btn btn-sm btn-primary';
            monthBtn.className = 'btn btn-sm btn-secondary';
        } else {
            weekBtn.className = 'btn btn-sm btn-secondary';
            monthBtn.className = 'btn btn-sm btn-primary';
        }
    } else {
        App.warn('매출 추이 필터 버튼을 찾을 수 없습니다.');
    }
}

// 매출 추이 차트만 별도로 로드
async function loadRevenueTrendChart() {
    try {
        const period = window.revenueTrendPeriod || 'week';
        const params = new URLSearchParams();
        
        // 일주일 또는 한달 기간 계산
        const today = new Date();
        const endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        
        let startDate = new Date(today);
        if (period === 'week') {
            // 최근 7일
            startDate.setDate(today.getDate() - 6);
        } else {
            // 최근 30일
            startDate.setDate(today.getDate() - 29);
        }
        startDate.setHours(0, 0, 0, 0);
        
        // 백엔드가 startDate/endDate를 인식하도록 period=custom 추가
        params.append('period', 'custom');
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', endDate.toISOString().split('T')[0]);
        
        App.log('매출 추이 차트 로드:', period, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
        
        const analytics = await App.api.get(`/analytics?${params}`);
        
        // 매출 추이 차트만 렌더링
        if (analytics.revenue) {
            let trend = analytics.revenue.trend || [];
            const rev = { ...analytics.revenue };
            // 한달일 때: 데이터가 있는 첫 날 이전 구간 제거 (앞쪽 빈 기간 축소)
            if (period === 'month' && trend.length > 0) {
                const firstWithData = trend.findIndex(item => (item.value || 0) > 0);
                if (firstWithData > 0) {
                    trend = trend.slice(firstWithData);
                    const sum = trend.reduce((s, item) => s + (item.value || 0), 0);
                    const maxVal = Math.max(...trend.map(item => item.value || 0), 0);
                    const maxDate = trend.find(item => (item.value || 0) === maxVal)?.label || null;
                    trend = trend.map(item => ({
                        ...item,
                        isMax: (item.value || 0) === maxVal
                    }));
                    rev.trend = trend;
                    rev.trendAvg = trend.length > 0 ? sum / trend.length : 0;
                    rev.trendMaxDate = maxDate;
                    rev.trendMaxValue = maxVal;
                }
            }
            // 최저: 0원 제외한 일별 매출 중 최소값
            const positiveItems = trend.filter(item => (item.value || 0) > 0);
            const minVal = positiveItems.length > 0 ? Math.min(...positiveItems.map(item => item.value)) : null;
            const minDate = minVal != null ? (trend.find(item => (item.value || 0) === minVal)?.label || null) : null;
            rev.trendMinValue = minVal;
            rev.trendMinDate = minDate;
            trend = trend.map(item => ({ ...item, isMin: minVal != null && (item.value || 0) === minVal }));
            rev.trend = trend;
            App.log('매출 추이 데이터:', trend.length, '일');
            renderSimpleChart('revenue-trend-chart', trend, rev);
        }
    } catch (error) {
        App.err('매출 추이 차트 로드 실패:', error);
    }
}
