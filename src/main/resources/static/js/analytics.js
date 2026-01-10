// 통계/분석 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('analytics-period').addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        document.getElementById('analytics-start-date').disabled = !isCustom;
        document.getElementById('analytics-end-date').disabled = !isCustom;
    });
    
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
        renderAnalytics(analytics);
    } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
    }
}

function renderAnalytics(data) {
    // 운영 지표
    document.getElementById('cancel-rate').textContent = 
        data.operational?.cancelRate ? (data.operational.cancelRate * 100).toFixed(1) + '%' : '-';
    document.getElementById('no-show-rate').textContent = 
        data.operational?.noShowRate ? (data.operational.noShowRate * 100).toFixed(1) + '%' : '-';
    
    // 매출 지표는 차트로 표시 (추후 차트 라이브러리 연동)
    renderSimpleChart('category-revenue-chart', data.revenue?.byCategory || []);
    renderSimpleChart('revenue-trend-chart', data.revenue?.trend || []);
    
    // 회원 지표
    document.getElementById('active-members').textContent = 
        data.members?.activeCount || 0;
    renderSimpleChart('member-trend-chart', data.members?.trend || []);
}

function renderSimpleChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!data || data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">데이터가 없습니다.</p>';
        return;
    }
    
    // 간단한 텍스트 기반 차트 (추후 Chart.js 등으로 교체 가능)
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${data.map(item => `
                <div style="display: flex; align-items: center; gap: 12px;">
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

function exportAnalytics() {
    App.showNotification('CSV 다운로드 기능은 준비 중입니다.', 'info');
}
