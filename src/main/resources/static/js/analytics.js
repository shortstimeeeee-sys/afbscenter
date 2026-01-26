// 통계/분석 페이지 JavaScript

// 매출 추이 필터 기간 (기본값: 일주일)
window.revenueTrendPeriod = 'week';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('analytics-period').addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        document.getElementById('analytics-start-date').disabled = !isCustom;
        document.getElementById('analytics-end-date').disabled = !isCustom;
    });
    
    // 매출 추이 필터 버튼 초기 상태 설정 (약간의 지연 후)
    setTimeout(() => {
        updateRevenueTrendFilterButtons();
    }, 100);
    
    loadAnalytics();
});

async function loadAnalytics() {
    const period = document.getElementById('analytics-period').value;
    const startDate = document.getElementById('analytics-start-date').value;
    const endDate = document.getElementById('analytics-end-date').value;
    
    try {
        const params = new URLSearchParams();
        if (period === 'custom') {
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
        } else {
            params.append('period', period);
        }
        
        const analytics = await App.api.get(`/analytics?${params}`);
        
        console.log('Analytics 데이터 로드:', analytics);
        console.log('매출 지표 데이터:', analytics.revenue);
        console.log('카테고리별 매출:', analytics.revenue?.byCategory);
        
        // 기간 정보 저장 (전역 변수로)
        window.currentAnalyticsPeriod = period;
        window.currentAnalyticsData = analytics;
        
        // 매출 추이 차트는 독립적으로 유지 (페이지 필터 변경 시에도 덮어쓰지 않음)
        renderAnalytics(analytics);
    } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
    }
}

function renderAnalytics(data) {
    // 기간 표시 업데이트
    const period = window.currentAnalyticsPeriod || 'month';
    const periodLabels = {
        'day': '일별',
        'week': '주별',
        'month': '월별',
        'year': '년별',
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
    console.log('매출 지표 렌더링 - byCategory:', data.revenue?.byCategory);
    console.log('매출 지표 렌더링 - byProduct:', data.revenue?.byProduct);
    console.log('매출 지표 렌더링 - trend:', data.revenue?.trend);
    
    renderRevenueChart('category-revenue-chart', data.revenue?.byCategory || [], data.revenue?.byProduct || [], data.revenue?.byCoach || [], monthLabel, data.revenue || {});
    
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
        <!-- 시설별 가동률 카드 -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; width: 100%;">
            ${sortedData.map((item, index) => {
                const usedDays = item.usedDays || 0;
                const totalDays = item.totalDays || periodDays || 0;
                const bookingCount = item.bookingCount || 0;
                const totalHours = item.totalHours || 0;
                const availableHours = item.availableHours || 0;
                const utilizationRate = item.value || 0;
                const hourlyStats = item.hourlyStats || [];
                
                // 시간대별 그래프 데이터
                const maxMinutes = hourlyStats.length > 0 ? Math.max(...hourlyStats.map(h => h.minutes || 0)) : 0;
                
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
                    
                    <!-- 통계 정보 카드 (2x2 그리드) -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px;">
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 9px; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">사용 일수</div>
                            <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2;">
                                <span style="color: var(--accent-primary);">${usedDays}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">/ ${totalDays}일</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 9px; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">예약/훈련</div>
                            <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2;">
                                <span style="color: var(--accent-primary);">${bookingCount}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">회</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 9px; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">총 운영 시간</div>
                            <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2;">
                                <span>${availableHours.toFixed(1)}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">시간</span>
                            </div>
                        </div>
                        <div style="padding: 13px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; min-width: 0;"
                             onmouseover="this.style.background='var(--bg-primary)'; this.style.borderColor='var(--accent-primary)'"
                             onmouseout="this.style.background='var(--bg-hover)'; this.style.borderColor='var(--border-color)'">
                            <div style="font-size: 9px; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">실제 사용 시간</div>
                            <div style="font-size: 20px; font-weight: 800; color: var(--accent-primary); line-height: 1.2;">
                                <span>${totalHours.toFixed(1)}</span>
                                <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-left: 3px;">시간</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 시간대별 운영 현황 -->
                    ${hourlyStats.length > 0 ? `
                    <div style="padding-top: 20px; border-top: 2px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <div style="font-size: 12px; color: var(--text-primary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">⏰ 시간대별 운영 현황</div>
                            <div style="font-size: 9px; color: var(--text-muted);">24시간 기준</div>
                        </div>
                        
                        <!-- 시간대별 그래프 -->
                        <div style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; height: 90px; margin-bottom: 14px; padding: 8px; background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-primary) 100%); border-radius: 8px; border: 1px solid var(--border-color);">
                            ${Array.from({length: 24}, (_, hour) => {
                                const hourData = hourlyStats.find(h => h.hour === hour);
                                const minutes = hourData ? (hourData.minutes || 0) : 0;
                                const count = hourData ? (hourData.count || 0) : 0;
                                
                                // 높이 계산: maxMinutes가 0보다 크면 비율 계산, 아니면 count 기준으로 최소 높이 보장
                                let height = 0;
                                if (maxMinutes > 0) {
                                    height = (minutes / maxMinutes * 100);
                                } else if (count > 0) {
                                    // maxMinutes가 0이지만 count가 있으면 최소 높이 보장
                                    height = 10; // 최소 10%
                                }
                                
                                // 최소 높이 보장 (데이터가 있으면 최소 8px)
                                const minHeightPx = (count > 0 || minutes > 0) ? 8 : 0;
                                const finalHeight = Math.max(height, minHeightPx > 0 ? (minHeightPx / 90 * 100) : 0);
                                
                                return `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; position: relative; cursor: pointer;" 
                                     onclick="showHourlyDetail(${hour}, ${count}, ${minutes})"
                                     onmouseover="this.style.transform='scale(1.2)'; this.style.zIndex='10';"
                                     onmouseout="this.style.transform='scale(1)'; this.style.zIndex='1';"
                                     title="${String(hour).padStart(2, '0')}:00 - ${count}회 예약, ${(minutes/60).toFixed(1)}시간 운영">
                                    <div style="width: 100%; height: ${finalHeight}%; min-height: ${minHeightPx}px; background: linear-gradient(180deg, var(--accent-primary) 0%, rgba(94, 106, 210, 0.85) 100%); border-radius: 2px 2px 0 0; transition: all 0.2s; position: relative; box-shadow: 0 -1px 3px rgba(0,0,0,0.1);">
                                        ${finalHeight > 15 ? `<div style="position: absolute; top: -22px; left: 50%; transform: translateX(-50%); font-size: 8px; color: var(--text-primary); white-space: nowrap; background-color: var(--bg-primary); padding: 3px 5px; border-radius: 4px; border: 1px solid var(--border-color); opacity: 0; transition: opacity 0.2s; pointer-events: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-weight: 600;" class="hour-tooltip">${count}회</div>` : ''}
                                        ${count > 0 && finalHeight <= 15 ? `<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 7px; color: var(--accent-primary); white-space: nowrap; font-weight: 700; pointer-events: none;">${count}회</div>` : ''}
                                    </div>
                                    <div style="font-size: 8px; color: var(--text-muted); margin-top: 4px; font-weight: 600;">${String(hour).padStart(2, '0')}</div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <!-- 상위 시간대 정보 -->
                        ${hourlyStats.length > 0 ? `
                        <div style="padding: 12px 14px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color);">
                            <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🏆 상위 운영 시간대</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${hourlyStats.sort((a, b) => (b.minutes || 0) - (a.minutes || 0)).slice(0, 5).map((h, idx) => 
                                    `<div style="padding: 6px 10px; background-color: var(--bg-primary); border-radius: 6px; border: 1px solid var(--border-color); font-size: 10px; line-height: 1.4; transition: all 0.2s;"
                                          onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.transform='translateY(-1px)'"
                                          onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'">
                                        <span style="color: var(--accent-primary); font-weight: 800;">${idx + 1}위</span> 
                                        <span style="color: var(--text-primary); font-weight: 700;">${h.label}</span> 
                                        <span style="color: var(--text-secondary);">(${(h.minutes/60).toFixed(1)}h, ${h.count}회)</span>
                                    </div>`
                                ).join('')}
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
function renderRevenueChart(containerId, categoryData, productData, coachData, monthLabel = '', revenueMetrics = {}) {
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
    
    container.innerHTML = `
        ${bestRevenueDate ? `
        <div style="margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, var(--accent-primary)15, var(--bg-hover)); border-radius: 8px; border: 1px solid var(--border-color); flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">최고 매출일</div>
                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${bestDateLabel} <span style="color: var(--accent-primary);">${App.formatCurrency(bestRevenueAmount)}</span></div>
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
        const paddingTop = 30;
        const paddingBottom = 40;
        const chartAreaHeight = chartHeight - paddingTop - paddingBottom;
        
        const trendAvg = revenueMetrics.trendAvg || 0;
        const trendMaxDate = revenueMetrics.trendMaxDate;
        const trendMaxValue = revenueMetrics.trendMaxValue || 0;
        const trendMinDate = revenueMetrics.trendMinDate;
        const trendMinValue = revenueMetrics.trendMinValue || 0;
        const weekdayPattern = revenueMetrics.weekdayPattern || [];
        
        // 평균선 Y 위치
        const avgY = paddingTop + chartAreaHeight - (trendAvg / maxValue) * chartAreaHeight;
        
        // 누적 매출 최대값 (별도 스케일)
        const maxCumulative = Math.max(...data.map(item => item.cumulative || 0), 1);
        
        container.innerHTML = `
            <div style="position: relative; height: ${chartHeight}px; padding: 16px 0; flex-shrink: 0;">
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
                    <text 
                        x="5" 
                        y="${avgY - 3}" 
                        font-size="9" 
                        fill="var(--warning)"
                        font-weight="600"
                    >평균: ${App.formatCurrency(Math.round(trendAvg))}</text>
                    ` : ''}
                    
                    ${data.map((item, index) => {
                        const x = (index / Math.max(data.length - 1, 1)) * 100;
                        // 데이터 개수에 따라 막대 폭 조정 (일주일일 때 더 좁게)
                        // 일주일 필터는 8일 데이터를 반환하므로 (오늘 포함 7일 전부터)
                        const isWeekView = window.revenueTrendPeriod === 'week' || data.length <= 8;
                        let barWidth;
                        if (isWeekView) {
                            // 일주일 이하: 더 좁은 막대 (약 4-5%)
                            barWidth = Math.max(100 / data.length - 8, 4);
                        } else {
                            // 한달 이상: 기존 방식 유지
                            barWidth = Math.max(100 / data.length - 2, 3);
                        }
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
                        const barColor = isMax ? 'var(--success)' : isMin ? 'var(--danger)' : 'var(--accent-primary)';
                        
                        // 날짜 포맷팅
                        const dateLabel = item.label ? item.label.split('-').slice(1).join('/') : '';
                        
                        return `
                            <g>
                                <!-- 전월 비교 선 (점선) -->
                                ${prevValue > 0 ? `
                                <line 
                                    x1="${x + barWidth/2}%" 
                                    y1="${prevY}" 
                                    x2="${index < data.length - 1 ? ((index + 1) / Math.max(data.length - 1, 1) * 100 + barWidth/2) + '%' : x + barWidth/2 + '%'}" 
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
                                    x1="${((index - 1) / Math.max(data.length - 1, 1) * 100 + barWidth/2)}%" 
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
                                    title="${item.label}: ${App.formatCurrency(value)}${prevValue > 0 ? ' (전월: ' + App.formatCurrency(prevValue) + ')' : ''}"
                                />
                                
                                <!-- 최고/최저 표시 -->
                                ${isMax ? `
                                <circle 
                                    cx="${x + barWidth/2}%" 
                                    cy="${y}" 
                                    r="4" 
                                    fill="var(--success)" 
                                    stroke="white" 
                                    stroke-width="2"
                                />
                                <text 
                                    x="${x + barWidth/2}%" 
                                    y="${y - 8}" 
                                    text-anchor="middle" 
                                    font-size="8" 
                                    fill="var(--success)"
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
                                
                                <!-- 성장률 표시 (최고 표시가 있으면 더 위로) -->
                                ${index > 0 && growthRate !== 0 ? `
                                <text 
                                    x="${x + barWidth/2}%" 
                                    y="${isMax ? (y - 20) : (y - 12)}" 
                                    text-anchor="middle" 
                                    font-size="8" 
                                    fill="${growthRate > 0 ? 'var(--success)' : 'var(--danger)'}"
                                    font-weight="700"
                                >${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%</text>
                                ` : ''}
                                
                                <!-- 날짜 라벨 -->
                                <text 
                                    x="${x + barWidth/2}%" 
                                    y="${chartHeight - 10}" 
                                    text-anchor="middle" 
                                    font-size="8" 
                                    fill="var(--text-muted)"
                                    style="pointer-events: none;"
                                >${dateLabel}</text>
                            </g>
                        `;
                    }).join('')}
                </svg>
                
                <!-- 범례 및 정보 -->
                <div style="position: absolute; top: 0; right: 0; font-size: 9px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; text-align: right;">
                    ${trendMaxValue > 0 ? `<div>최고: ${App.formatCurrency(trendMaxValue)}</div>` : ''}
                    ${trendMinValue > 0 ? `<div>최저: ${App.formatCurrency(trendMinValue)}</div>` : ''}
                </div>
            </div>
            
            <!-- 요일별 패턴 -->
            ${weekdayPattern.length > 0 ? `
            <div style="margin-top: 16px; padding: 12px; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border-color); flex-shrink: 0;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">요일별 평균 매출</div>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
                    ${weekdayPattern.map(day => `
                        <div style="text-align: center; padding: 6px; background: var(--bg-primary); border-radius: 4px;">
                            <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 4px;">${day.weekday}</div>
                            <div style="font-size: 12px; font-weight: 700; color: var(--accent-primary);">${App.formatCurrency(Math.round(day.avgRevenue))}</div>
                            <div style="font-size: 8px; color: var(--text-muted); margin-top: 2px;">${day.count}일</div>
                        </div>
                    `).join('')}
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

// 카테고리별 회원 통계 렌더링
function renderCategoryMemberChart(containerId, categoryData) {
    const container = document.getElementById(containerId);
    const { memberCount, activeProducts } = categoryData;
    
    if (!memberCount || Object.keys(memberCount).length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">데이터가 없습니다.</p>';
        return;
    }
    
    const categoryLabels = {
        'BASEBALL': '야구',
        'TRAINING': '트레이닝',
        'TRAINING_FITNESS': '트레이닝+필라테스',
        'PILATES': '필라테스',
        'GENERAL': '일반',
        'RENTAL': '대관'
    };
    
    const sortedCategories = Object.entries(memberCount)
        .sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${sortedCategories.map(([category, count]) => {
                const label = categoryLabels[category] || category;
                const products = activeProducts[category] || 0;
                const avgProducts = count > 0 ? (products / count).toFixed(1) : '0.0';
                
                return `
                    <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <div style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${label}</div>
                            <div style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">${count}명</div>
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
        'YOUTH': '유소년'
    };
    
    const sortedGrades = Object.entries(gradeStatusDistribution)
        .sort((a, b) => {
            const totalA = Object.values(a[1]).reduce((sum, val) => sum + val, 0);
            const totalB = Object.values(b[1]).reduce((sum, val) => sum + val, 0);
            return totalB - totalA;
        });
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${sortedGrades.map(([grade, statusMap]) => {
                const label = gradeLabels[grade] || grade;
                const active = statusMap['ACTIVE'] || 0;
                const inactive = statusMap['INACTIVE'] || 0;
                const withdrawn = statusMap['WITHDRAWN'] || 0;
                const total = active + inactive + withdrawn;
                const recentVisitors = gradeRecentVisitors[grade] || 0;
                
                return `
                    <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                        <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${label}</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;">
                            <div>
                                <div style="color: var(--text-secondary);">활성</div>
                                <div style="font-weight: 700; color: var(--accent-primary);">${active}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary);">휴면</div>
                                <div style="font-weight: 700; color: var(--warning);">${inactive}</div>
                            </div>
                            <div>
                                <div style="color: var(--text-secondary);">이탈</div>
                                <div style="font-weight: 700; color: var(--danger);">${withdrawn}</div>
                            </div>
                        </div>
                        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-color); font-size: 10px; color: var(--text-secondary);">
                            최근 방문: <span style="font-weight: 600; color: var(--info);">${recentVisitors}명</span> (30일 내)
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// 등급별 분포 차트 렌더링
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
        'YOUTH': '유소년'
    };
    
    const total = Object.values(gradeDistribution).reduce((sum, count) => sum + count, 0);
    const sortedGrades = Object.entries(gradeDistribution)
        .sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
            ${sortedGrades.map(([grade, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const label = gradeLabels[grade] || grade;
                return `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 4px; background: var(--bg-secondary);">
                        <div style="min-width: 90px; font-size: 11px; color: var(--text-primary); font-weight: 600;">${label}</div>
                        <div style="flex: 1; height: 18px; background-color: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${percentage}%; background-color: var(--accent-primary); transition: width 0.3s;"></div>
                        </div>
                        <div style="min-width: 55px; text-align: right;">
                            <span style="font-weight: 700; color: var(--text-primary); font-size: 12px;">${count}</span>
                            <span style="font-size: 10px; color: var(--text-secondary); margin-left: 3px;">(${percentage}%)</span>
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
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                <div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 3px;">활성</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--accent-primary);">${active}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">${total > 0 ? ((active / total) * 100).toFixed(1) : 0}%</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--warning);">
                <div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 3px;">휴면</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--warning);">${inactive}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">${total > 0 ? ((inactive / total) * 100).toFixed(1) : 0}%</div>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--danger);">
                <div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 3px;">이탈</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--danger);">${withdrawn}</div>
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
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-primary);">
                <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">평균 이용권 수</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--accent-primary);">${avgProductsPerMember.toFixed(1)}</div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">회원당 평균</div>
            </div>
            <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--info);">
                <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">활성 이용권</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--info);">${totalActiveProducts || 0}</div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">${membersWithProducts || 0}명 보유</div>
            </div>
            <div style="padding: 10px; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--success);">
                <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">이용권 보유율</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--success);">
                    ${activeCount > 0 ? ((membersWithProducts / activeCount) * 100).toFixed(1) : 0}%
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">활성 회원 중 보유</div>
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

function exportAnalytics() {
    App.showNotification('CSV 다운로드 기능은 준비 중입니다.', 'info');
}

// 세부 내역 모달 열기
async function openDetailModal(chartType, index, value, displayLabel) {
    const period = document.getElementById('analytics-period').value;
    const startDate = document.getElementById('analytics-start-date').value;
    const endDate = document.getElementById('analytics-end-date').value;
    
    // displayLabel이 없으면 value를 사용 (하위 호환성)
    const label = displayLabel || value;
    
    let title = '';
    let data = [];
    
    try {
        if (chartType === 'category-revenue-chart') {
            // 카테고리별 매출 세부 내역
            title = `${label} 세부 내역`;
            const params = new URLSearchParams();
            if (period === 'custom' && startDate && endDate) {
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
            if (period === 'custom' && startDate && endDate) {
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }
            data = await App.api.get(`/analytics/members/details?${params}`);
        } else if (chartType === 'facility-utilization-chart' || chartType === 'hourly-demand-chart' || chartType === 'operational-details') {
            // 운영 지표 세부 내역
            title = '운영 지표 세부 내역';
            const params = new URLSearchParams();
            if (period === 'custom' && startDate && endDate) {
                params.append('startDate', startDate);
                params.append('endDate', endDate);
            }
            const details = await App.api.get(`/analytics/operational/details?${params}`);
            renderOperationalDetailModal(title, details);
            return;
        }
        
        renderDetailModal(title, data, chartType);
    } catch (error) {
        console.error('세부 내역 로드 실패:', error);
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
                                    <td>${m.grade || '-'}</td>
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
        console.log('학교/소속 현황 - 총 회원 수:', totalCount, '집계된 회원 수:', sumCount);
        
        container.innerHTML = sortedSchools.map(([school, count]) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                <span style="font-size: 13px; color: var(--text-primary);">${school}</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--accent-primary);">${count}명</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('학교/소속 현황 로드 실패:', error);
        const container = document.getElementById('school-stats-container');
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; font-size: 12px;">데이터를 불러올 수 없습니다.</p>';
    }
}

// 매출 추이 차트 필터 기간 설정
function setRevenueTrendPeriod(period) {
    console.log('매출 추이 필터 변경:', period);
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
        console.warn('매출 추이 필터 버튼을 찾을 수 없습니다.');
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
        
        console.log('매출 추이 차트 로드:', period, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
        
        const analytics = await App.api.get(`/analytics?${params}`);
        
        // 매출 추이 차트만 렌더링
        if (analytics.revenue) {
            console.log('매출 추이 데이터:', analytics.revenue.trend?.length, '일');
            renderSimpleChart('revenue-trend-chart', analytics.revenue.trend || [], analytics.revenue || {});
        }
    } catch (error) {
        console.error('매출 추이 차트 로드 실패:', error);
    }
}
