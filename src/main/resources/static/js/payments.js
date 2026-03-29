// 결제/정산 페이지 JavaScript

let currentPage = 1;
let currentFilters = {};
let currentSortBy = 'date';
let currentSortOrder = 'desc';
let allPayments = []; // 클라이언트 측 정렬/검색용

function getMonthRangeStrings() {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const pad = function(n) { return String(n).padStart(2, '0'); };
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
        start: y + '-' + pad(m + 1) + '-01',
        end: y + '-' + pad(m + 1) + '-' + pad(lastDay)
    };
}

function syncPeriodUi() {
    var sel = document.getElementById('filter-period');
    var startEl = document.getElementById('filter-date-start');
    var endEl = document.getElementById('filter-date-end');
    if (!sel) return;
    var v = sel.value;
    if (v === 'month') {
        var r = getMonthRangeStrings();
        if (startEl) { startEl.value = r.start; startEl.disabled = true; }
        if (endEl) { endEl.value = r.end; endEl.disabled = true; }
    } else if (v === 'all') {
        if (startEl) { startEl.value = ''; startEl.disabled = true; }
        if (endEl) { endEl.value = ''; endEl.disabled = true; }
    } else {
        if (startEl) startEl.disabled = false;
        if (endEl) endEl.disabled = false;
    }
}

function initPaymentPeriodAndLoad() {
    currentFilters.period = 'month';
    var r = getMonthRangeStrings();
    currentFilters.startDate = r.start;
    currentFilters.endDate = r.end;
    var periodSel = document.getElementById('filter-period');
    if (periodSel) periodSel.value = 'month';
    syncPeriodUi();
    loadPayments();
    loadPaymentSummary();
    loadPaymentMethodStatistics();
}

document.addEventListener('DOMContentLoaded', function() {
    // 기존 상품 할당 결제 생성 버튼은 관리자만 표시
    var createMissingBtn = document.getElementById('payments-create-missing-btn');
    if (createMissingBtn) createMissingBtn.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';

    var periodSel = document.getElementById('filter-period');
    if (periodSel) {
        periodSel.addEventListener('change', function() {
            syncPeriodUi();
            currentFilters.period = periodSel.value;
            if (periodSel.value === 'month') {
                var mr = getMonthRangeStrings();
                currentFilters.startDate = mr.start;
                currentFilters.endDate = mr.end;
            } else if (periodSel.value === 'all') {
                delete currentFilters.startDate;
                delete currentFilters.endDate;
            }
            currentPage = 1;
            loadPayments();
            loadPaymentMethodStatistics();
        });
    }

    initPaymentPeriodAndLoad();
    
    // 검색 기능
    const searchInput = document.getElementById('payment-search');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = e.target.value;
                currentPage = 1;
                loadPayments();
            }, 300); // 300ms 디바운스
        });
    }
    
    // 결제 테이블에서 회원 이름 클릭 시 이용권/코치 정보 모달
    const tableBody = document.getElementById('payments-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const link = e.target.closest('.member-name-link');
            if (link) {
                e.preventDefault();
                const memberId = link.getAttribute('data-member-id');
                if (memberId) openMemberInfoModal(parseInt(memberId, 10));
            }
        });
    }
});

async function loadPaymentSummary() {
    try {
        const summary = await App.api.get('/payments/summary');
        if (!summary) {
            App.warn('결제 요약 데이터가 없습니다.');
            return;
        }
        
        // 오늘 매출
        const todayRevenue = summary.todayRevenue || 0;
        document.getElementById('kpi-today-revenue').textContent = App.formatCurrency(todayRevenue);
        
        // 전일 대비 증감률 표시
        const todayChangeRate = summary.todayChangeRate || 0;
        const todayChangeElement = document.querySelector('#kpi-today-revenue').nextElementSibling;
        if (todayChangeElement && todayChangeElement.classList.contains('kpi-change')) {
            const sign = todayChangeRate >= 0 ? '+' : '';
            const color = todayChangeRate >= 0 ? 'positive' : 'negative';
            todayChangeElement.textContent = `전일 대비 ${sign}${todayChangeRate.toFixed(1)}%`;
            todayChangeElement.className = `kpi-change ${color}`;
        }
        
        // 이번 달 매출
        const monthRevenue = summary.monthRevenue || 0;
        document.getElementById('kpi-month-revenue').textContent = App.formatCurrency(monthRevenue);
        
        // 전월 대비 증감률 표시
        const monthChangeRate = summary.monthChangeRate || 0;
        const monthChangeElement = document.querySelector('#kpi-month-revenue').nextElementSibling;
        if (monthChangeElement && monthChangeElement.classList.contains('kpi-change')) {
            const sign = monthChangeRate >= 0 ? '+' : '';
            const color = monthChangeRate >= 0 ? 'positive' : 'negative';
            monthChangeElement.textContent = `전월 대비 ${sign}${monthChangeRate.toFixed(1)}%`;
            monthChangeElement.className = `kpi-change ${color}`;
        }
        
        // 미수금
        const unpaid = summary.unpaid || 0;
        document.getElementById('kpi-unpaid').textContent = App.formatCurrency(unpaid);
        
        // 환불 대기 (숫자 옆에 "건" 표시, "건"은 작은 글씨)
        const refundPending = summary.refundPending || 0;
        const el = document.getElementById('kpi-refund-pending');
        el.innerHTML = refundPending + '<span class="kpi-unit">건</span>';
        
        App.log('결제 요약 로드 완료:', summary);
    } catch (error) {
        App.err('정산 요약 로드 실패:', error);
        // 오류 시에도 기본값 표시
        document.getElementById('kpi-today-revenue').textContent = App.formatCurrency(0);
        document.getElementById('kpi-month-revenue').textContent = App.formatCurrency(0);
        document.getElementById('kpi-unpaid').textContent = App.formatCurrency(0);
        document.getElementById('kpi-refund-pending').innerHTML = '0<span class="kpi-unit">건</span>';
    }
}

async function loadPayments() {
    try {
        const params = new URLSearchParams();
        if (currentPage) {
            params.append('page', currentPage);
        }
        if (currentFilters.period) {
            params.append('period', currentFilters.period);
        }
        
        // 필터 파라미터 추가
        if (currentFilters.paymentMethod) {
            params.append('paymentMethod', currentFilters.paymentMethod);
        }
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        if (currentFilters.category) {
            params.append('category', currentFilters.category);
        }
        if (currentFilters.startDate) {
            params.append('startDate', currentFilters.startDate);
        }
        if (currentFilters.endDate) {
            params.append('endDate', currentFilters.endDate);
        }
        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        if (currentSortBy) {
            params.append('sortBy', currentSortBy);
        }
        if (currentSortOrder) {
            params.append('sortOrder', currentSortOrder);
        }
        
        const payments = await App.api.get(`/payments?${params.toString()}`);
        
        if (!payments) {
            App.warn('결제 목록 데이터가 없습니다.');
            renderPaymentsTable([]);
            return;
        }
        
        App.log('결제 목록 로드 완료:', payments.length, '건');
        renderPaymentsTable(payments);
        updateSortIndicators();
    } catch (error) {
        App.err('결제 목록 로드 실패:', error);
        const tbody = document.getElementById('payments-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">결제 목록을 불러오는데 실패했습니다.</td></tr>';
        }
    }
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    allPayments = payments || []; // 클라이언트 측 정렬/검색용 저장
    
    const unassignedCount = (payments || []).filter(p => !p.coach || !p.coach.id).length;
    const summaryEl = document.getElementById('payment-list-summary');
    const countEl = document.getElementById('payment-coach-unassigned-count');
    if (summaryEl && countEl) {
        countEl.textContent = unassignedCount;
        summaryEl.style.display = unassignedCount > 0 ? 'block' : 'none';
    }
    renderPaymentsTableBody(payments);
}

/** 결제 시 코치 미지정 목록 모달 (해당 결제들만 표시) */
function openPaymentCoachUnassignedModal() {
    const list = (allPayments || []).filter(p => !p.coach || !p.coach.id);
    const container = document.getElementById('payment-coach-unassigned-list');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">미지정 결제가 없습니다.</p>';
    } else {
        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>결제번호</th>
                        <th>날짜/시간</th>
                        <th>회원</th>
                        <th>분류</th>
                        <th>결제수단</th>
                        <th>금액</th>
                        <th>상태</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(p => `
                        <tr>
                            <td>${p.id}</td>
                            <td>${App.formatDateTime(p.paidAt)}</td>
                            <td>${p.member && p.member.id ? `<a href="javascript:void(0)" class="member-name-link" data-member-id="${p.member.id}" onclick="App.Modal.close('payment-coach-unassigned-modal'); openMemberInfoModal(${p.member.id}); return false;">${App.escapeHtml(p.member.name)}</a>` : App.escapeHtml(p.member ? p.member.name : '비회원')}</td>
                            <td>${getCategoryText(p.category || p.paymentCategory)}</td>
                            <td>${getPaymentMethodText(p.paymentMethod)}</td>
                            <td style="font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(p.amount || 0)}</td>
                            <td><span class="badge badge-${getPaymentStatusBadge(p.status)}">${getPaymentStatusText(p.status)}</span></td>
                            <td>
                                <button type="button" class="btn btn-sm btn-info" onclick="App.Modal.close('payment-coach-unassigned-modal'); openPaymentDetailModal(${p.id});">상세</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    App.Modal.open('payment-coach-unassigned-modal');
}

/** 코치 이름에 고유색 적용 (결제 테이블·상세 공용) */
function getCoachNameWithColor(coach) {
    if (!coach || !coach.name || !String(coach.name).trim()) return '-';
    var name = String(coach.name).trim();
    var color = (App.CoachColors && App.CoachColors.getColor) ? App.CoachColors.getColor(coach) : null;
    if (!color) color = (App.CoachColors && App.CoachColors.getColor) ? App.CoachColors.getColor({ name: name }) : 'var(--text-primary)';
    if (!color || color === true) color = 'var(--text-primary)';
    return '<span class="coach-name" style="color:' + color + ';font-weight:600;">' + App.escapeHtml(name) + '</span>';
}

function renderPaymentsTableBody(payments) {
    const tbody = document.getElementById('payments-table-body');
    if (!tbody) return;
    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">결제 내역이 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.id}</td>
            <td>${App.formatDateTime(payment.paidAt)}</td>
            <td>${payment.member && payment.member.id ? `<a href="javascript:void(0)" class="member-name-link" data-member-id="${payment.member.id}">${App.escapeHtml(payment.member.name)}</a>` : App.escapeHtml(payment.member ? payment.member.name : (payment.memberName || '비회원'))}</td>
            <td class="cell-coach">${getCoachNameWithColor(payment.coach)}</td>
            <td>${getCategoryText(payment.category || payment.paymentCategory)}</td>
            <td>${getPaymentMethodText(payment.paymentMethod)}</td>
            <td style="font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(payment.amount)}</td>
            <td><span class="badge badge-${getPaymentStatusBadge(payment.status)}">${getPaymentStatusText(payment.status)}</span></td>
            <td>
                <button class="btn btn-sm btn-info" onclick="openPaymentDetailModal(${payment.id})" style="margin-right: 5px;">상세</button>
                ${payment.status === 'COMPLETED' ? `<button class="btn btn-sm btn-danger" onclick="openRefundModal(${payment.id})">환불</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function getCategoryText(category) {
    if (!category) return '-';
    const map = {
        'RENTAL': '대관',
        'LESSON': '레슨',
        'PRODUCT': '상품판매',
        'PRODUCT_SALE': '상품판매' // 하위 호환성
    };
    return map[category] || category;
}

function getPaymentMethodText(method) {
    if (!method) return '-';
    const map = {
        'CASH': '현금',
        'CARD': '카드',
        'BANK': '계좌이체',
        'BANK_TRANSFER': '계좌이체', // 하위 호환성
        'MOBILE': '간편결제',
        'EASY_PAY': '간편결제' // 하위 호환성
    };
    return map[method] || method;
}

function getPaymentStatusBadge(status) {
    const map = {
        'COMPLETED': 'success',
        'PARTIAL': 'warning',
        'REFUNDED': 'danger'
    };
    return map[status] || 'info';
}

function getPaymentStatusText(status) {
    const map = {
        'COMPLETED': '완료',
        'PARTIAL': '부분',
        'REFUNDED': '환불'
    };
    return map[status] || status;
}

/** 이용권 상태 한글 */
function getMemberProductStatusText(status) {
    if (!status) return '-';
    const map = {
        'ACTIVE': '사용중',
        'EXPIRED': '만료',
        'USED_UP': '소진'
    };
    return map[status] || status;
}

/**
 * 결제 목록에서 회원 이름 클릭 시 호출. 회원 상세(이용권·코치) 조회 후 모달 표시.
 */
async function openMemberInfoModal(memberId) {
    const contentEl = document.getElementById('member-info-content');
    if (!contentEl) return;
    contentEl.innerHTML = '<p class="text-muted">불러오는 중...</p>';
    App.Modal.open('member-info-modal');
    try {
        const member = await App.api.get('/members/' + memberId);
        if (!member) {
            contentEl.innerHTML = '<p class="text-muted">회원 정보를 찾을 수 없습니다.</p>';
            return;
        }
        const coachName = (member.coach && member.coach.name) ? member.coach.name : '-';
        const products = member.memberProducts || [];
        const rows = products.map(mp => {
            const p = mp.product || {};
            const coach = (mp.coach && mp.coach.name) ? mp.coach.name : '-';
            const status = getMemberProductStatusText(mp.status);
            const purchaseDate = mp.purchaseDate ? App.formatDate(mp.purchaseDate) : '-';
            const expiryDate = mp.expiryDate ? App.formatDate(mp.expiryDate) : '-';
            const remain = mp.remainingCount != null && mp.totalCount != null ? mp.remainingCount + ' / ' + mp.totalCount : '-';
            return `<tr>
                <td>${App.escapeHtml(p.name || '-')}</td>
                <td>${status}</td>
                <td>${coach}</td>
                <td>${purchaseDate}</td>
                <td>${expiryDate}</td>
                <td>${remain}</td>
            </tr>`;
        }).join('');
        contentEl.innerHTML = `
            <div class="member-info-section">
                <div class="detail-item"><strong>회원명</strong><span>${App.escapeHtml(member.name || '-')}</span></div>
                <div class="detail-item"><strong>회원번호</strong><span>${App.escapeHtml(member.memberNumber || '-')}</span></div>
                <div class="detail-item"><strong>담당 코치</strong><span>${App.escapeHtml(coachName)}</span></div>
            </div>
            <h3 class="member-info-subtitle">이용권 목록</h3>
            <div class="member-info-table-wrap">
                <table class="table member-info-table">
                    <thead><tr><th>상품명</th><th>상태</th><th>지정 코치</th><th>구매일</th><th>만료일</th><th>잔여</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6">이용권이 없습니다.</td></tr>'}</tbody>
                </table>
            </div>
        `;
    } catch (err) {
        App.err('회원 정보 조회 실패:', err);
        contentEl.innerHTML = '<p class="text-danger">회원 정보를 불러오지 못했습니다.</p>';
    }
}

function applyFilters() {
    const searchInput = document.getElementById('payment-search');
    const searchVal = searchInput && searchInput.value ? searchInput.value.trim() : '';
    const periodEl = document.getElementById('filter-period');
    const period = periodEl ? periodEl.value : 'month';
    const method = document.getElementById('filter-payment-method').value;
    const status = document.getElementById('filter-status').value;
    const category = document.getElementById('filter-category').value;
    const startDate = document.getElementById('filter-date-start').value;
    const endDate = document.getElementById('filter-date-end').value;

    currentFilters = {};
    if (searchVal) currentFilters.search = searchVal;
    currentFilters.period = period;
    if (method) currentFilters.paymentMethod = method;
    if (status) currentFilters.status = status;
    if (category) currentFilters.category = category;
    if (period === 'month') {
        const mr = getMonthRangeStrings();
        currentFilters.startDate = mr.start;
        currentFilters.endDate = mr.end;
        syncPeriodUi();
    } else if (period === 'all') {
        delete currentFilters.startDate;
        delete currentFilters.endDate;
    } else if (period === 'custom') {
        if (startDate) currentFilters.startDate = startDate;
        if (endDate) currentFilters.endDate = endDate;
    }

    currentPage = 1;
    loadPayments();
    loadPaymentMethodStatistics(); // 필터 변경 시 통계도 업데이트
}

function openPaymentModal() {
    App.Modal.open('payment-modal');
}

async function processPayment() {
    const memberId = document.getElementById('payment-member').value;
    const bookingId = document.getElementById('payment-booking-id').value;
    const productId = document.getElementById('payment-product') ? document.getElementById('payment-product').value : null;
    
    const data = {
        member: memberId ? { id: parseInt(memberId) } : null,
        booking: bookingId ? { id: parseInt(bookingId) } : null,
        product: productId ? { id: parseInt(productId) } : null,
        category: document.getElementById('payment-category').value || null,
        paymentMethod: document.getElementById('payment-method').value,
        amount: parseInt(document.getElementById('payment-amount').value),
        memo: document.getElementById('payment-notes').value || null
    };
    
    try {
        await App.api.post('/payments', data);
        App.showNotification('결제가 처리되었습니다.', 'success');
        App.Modal.close('payment-modal');
        loadPayments();
        loadPaymentSummary();
    } catch (error) {
        App.showNotification('결제 처리에 실패했습니다.', 'danger');
    }
}

function openRefundModal(paymentId) {
    document.getElementById('refund-payment-id').value = paymentId;
    App.Modal.open('refund-modal');
}

async function processRefund() {
    const paymentId = document.getElementById('refund-payment-id').value;
    const data = {
        amount: parseFloat(document.getElementById('refund-amount').value),
        reason: document.getElementById('refund-reason').value
    };
    
    try {
        await App.api.post(`/payments/${paymentId}/refund`, data);
        App.showNotification('환불이 처리되었습니다.', 'success');
        App.Modal.close('refund-modal');
        loadPayments();
        loadPaymentSummary();
    } catch (error) {
        App.showNotification('환불 처리에 실패했습니다.', 'danger');
    }
}

async function exportReport() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.paymentMethod) {
            params.append('paymentMethod', currentFilters.paymentMethod);
        }
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        if (currentFilters.category) {
            params.append('category', currentFilters.category);
        }
        if (currentFilters.startDate) {
            params.append('startDate', currentFilters.startDate);
        }
        if (currentFilters.endDate) {
            params.append('endDate', currentFilters.endDate);
        }
        
        const url = `/api/payments/export/excel?${params.toString()}`;
        window.open(url, '_blank');
        App.showNotification('엑셀 파일 다운로드가 시작되었습니다.', 'success');
    } catch (error) {
        App.err('엑셀 다운로드 실패:', error);
        App.showNotification('엑셀 다운로드에 실패했습니다.', 'danger');
    }
}

// 결제 방법별 통계 로드
async function loadPaymentMethodStatistics() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.period) {
            params.append('period', currentFilters.period);
        }
        if (currentFilters.startDate) {
            params.append('startDate', currentFilters.startDate);
        }
        if (currentFilters.endDate) {
            params.append('endDate', currentFilters.endDate);
        }
        
        const statistics = await App.api.get(`/payments/statistics/method?${params.toString()}`);
        if (statistics) {
            renderPaymentMethodStatistics(statistics);
        }
    } catch (error) {
        App.err('결제 방법별 통계 로드 실패:', error);
    }
}

// 결제 방법별 통계 렌더링 (코치 기본 통계와 동일 카드 형태)
function renderPaymentMethodStatistics(statistics) {
    const container = document.getElementById('payment-method-statistics');
    if (!container) return;
    
    const methodCount = statistics.methodCount || {};
    const methodAmount = statistics.methodAmount || {};
    const totalAmount = statistics.totalAmount || 0;
    
    const methodNames = {
        'CASH': '현금',
        'CARD': '카드',
        'BANK': '계좌이체',
        'BANK_TRANSFER': '계좌이체',
        'MOBILE': '간편결제',
        'EASY_PAY': '간편결제'
    };
    const methodItemClass = {
        'CASH': 'payment-method-stats-item--cash',
        'CARD': 'payment-method-stats-item--card',
        'BANK': 'payment-method-stats-item--bank',
        'BANK_TRANSFER': 'payment-method-stats-item--bank',
        'MOBILE': 'payment-method-stats-item--mobile',
        'EASY_PAY': 'payment-method-stats-item--mobile'
    };
    
    const entries = Object.entries(methodCount);
    if (entries.length === 0) {
        container.innerHTML = '<p class="payment-method-stats-loading">결제 데이터가 없습니다.</p>';
        container.className = 'payment-method-stats-body';
        return;
    }
    
    let html = '';
    // 총계 카드 (클릭 시 전체 목록)
    html += `<div class="payment-method-stats-item payment-method-stats-item-clickable payment-method-stats-item--total" data-filter-method="" data-filter-label="총 결제" role="button" tabindex="0" title="클릭하면 해당 결제 목록 보기">
        <div class="payment-method-stats-item-label">총 결제</div>
        <div class="payment-method-stats-item-value">${App.formatCurrency(totalAmount)}</div>
        <div class="payment-method-stats-item-detail">${Object.values(methodCount).reduce((a, b) => a + b, 0)}건</div>
    </div>`;
    for (const [method, count] of entries) {
        const amount = methodAmount[method] || 0;
        const percentage = totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0;
        const itemClass = methodItemClass[method] || '';
        const label = methodNames[method] || method;
        html += `
            <div class="payment-method-stats-item payment-method-stats-item-clickable ${itemClass}" data-filter-method="${App.escapeHtml(method)}" data-filter-label="${App.escapeHtml(label)}" role="button" tabindex="0" title="클릭하면 해당 결제 목록 보기">
                <div class="payment-method-stats-item-label">${App.escapeHtml(label)}</div>
                <div class="payment-method-stats-item-value">${App.formatCurrency(amount)}</div>
                <div class="payment-method-stats-item-detail">${count}건 (${percentage}%)</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.className = 'payment-method-stats-body';
    
    container.querySelectorAll('.payment-method-stats-item-clickable').forEach(function(el) {
        el.addEventListener('click', function() {
            var method = el.getAttribute('data-filter-method') || '';
            var label = el.getAttribute('data-filter-label') || '결제';
            openPaymentMethodListModal(method, label);
        });
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                var method = el.getAttribute('data-filter-method') || '';
                var label = el.getAttribute('data-filter-label') || '결제';
                openPaymentMethodListModal(method, label);
            }
        });
    });
}

/** 결제 방법별 통계 카드 클릭 시 해당 조건의 결제 목록 모달 */
async function openPaymentMethodListModal(filterMethod, titleLabel) {
    var titleEl = document.getElementById('payment-method-list-modal-title');
    var bodyEl = document.getElementById('payment-method-list-modal-body');
    if (!titleEl || !bodyEl) return;
    titleEl.textContent = (titleLabel || '결제') + ' 목록';
    bodyEl.innerHTML = '<p class="payment-method-stats-loading">로딩 중...</p>';
    App.Modal.open('payment-method-list-modal');
    try {
        var params = new URLSearchParams();
        if (currentFilters.period) params.append('period', currentFilters.period);
        if (currentFilters.startDate) params.append('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.append('endDate', currentFilters.endDate);
        if (filterMethod) params.append('paymentMethod', filterMethod);
        var list = await App.api.get('/payments?' + params.toString());
        var payments = Array.isArray(list) ? list : (list && Array.isArray(list.content) ? list.content : []);
        if (payments.length === 0) {
            bodyEl.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">해당 조건의 결제가 없습니다.</p>';
            return;
        }
        var thead = '<thead><tr><th>날짜/시간</th><th>회원</th><th>분류</th><th>결제수단</th><th>금액</th><th>상태</th></tr></thead>';
        var tbody = '<tbody>' + payments.map(function(p) {
            var memberName = (p.member && (p.member.name || p.member.id)) ? p.member.name : (p.memberName || '-');
            var paidAt = p.paidAt ? App.formatDateTime(p.paidAt) : (p.createdAt ? App.formatDateTime(p.createdAt) : '-');
            return '<tr><td>' + App.escapeHtml(paidAt) + '</td><td>' + App.escapeHtml(memberName) + '</td><td>' + App.escapeHtml(getCategoryText(p.category)) + '</td><td>' + App.escapeHtml(getPaymentMethodText(p.paymentMethod)) + '</td><td>' + App.formatCurrency(p.amount) + '</td><td><span class="badge badge-' + getPaymentStatusBadge(p.status) + '">' + App.escapeHtml(getPaymentStatusText(p.status)) + '</span></td></tr>';
        }).join('') + '</tbody>';
        bodyEl.innerHTML = '<table class="table">' + thead + tbody + '</table>';
    } catch (error) {
        App.err('결제 목록 로드 실패:', error);
        bodyEl.innerHTML = '<p style="color: var(--danger); padding: 16px;">목록을 불러오는데 실패했습니다.</p>';
    }
}

// 결제 상세 정보 모달 열기
async function openPaymentDetailModal(paymentId) {
    try {
        const payment = await App.api.get(`/payments/${paymentId}`);
        if (payment) {
            renderPaymentDetail(payment);
            App.Modal.open('payment-detail-modal');
        }
    } catch (error) {
        App.err('결제 상세 정보 로드 실패:', error);
        App.showNotification('결제 상세 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 결제 상세 정보 렌더링
function renderPaymentDetail(payment) {
    const container = document.getElementById('payment-detail-content');
    if (!container) return;
    
    const html = `
        <div class="detail-section">
            <h3>기본 정보</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>결제번호</label>
                    <div>${payment.id || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>관리번호</label>
                    <div>${payment.paymentNumber || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>결제일시</label>
                    <div>${App.formatDateTime(payment.paidAt)}</div>
                </div>
                <div class="detail-item">
                    <label>생성일시</label>
                    <div>${App.formatDateTime(payment.createdAt)}</div>
                </div>
            </div>
        </div>
        <div class="detail-section">
            <h3>결제 정보</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>금액</label>
                    <div style="font-weight: 600; color: var(--accent-primary); font-size: 1.2em;">${App.formatCurrency(payment.amount)}</div>
                </div>
                <div class="detail-item">
                    <label>결제수단</label>
                    <div>${getPaymentMethodText(payment.paymentMethod)}</div>
                </div>
                <div class="detail-item">
                    <label>상태</label>
                    <div><span class="badge badge-${getPaymentStatusBadge(payment.status)}">${getPaymentStatusText(payment.status)}</span></div>
                </div>
                <div class="detail-item">
                    <label>분류</label>
                    <div>${getCategoryText(payment.category)}</div>
                </div>
            </div>
        </div>
        <div class="detail-section">
            <h3>관련 정보</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>회원</label>
                    <div>${payment.member ? payment.member.name : '비회원'}</div>
                </div>
                <div class="detail-item">
                    <label>코치</label>
                    <div>${getCoachNameWithColor(payment.coach)}</div>
                </div>
                <div class="detail-item">
                    <label>상품</label>
                    <div>${payment.product ? payment.product.name : '-'}</div>
                </div>
                <div class="detail-item">
                    <label>예약번호</label>
                    <div>${payment.booking ? payment.booking.id : '-'}</div>
                </div>
            </div>
        </div>
        ${payment.refundAmount && payment.refundAmount > 0 ? `
        <div class="detail-section">
            <h3>환불 정보</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>환불 금액</label>
                    <div style="color: var(--danger);">${App.formatCurrency(payment.refundAmount)}</div>
                </div>
                <div class="detail-item full-width">
                    <label>환불 사유</label>
                    <div>${payment.refundReason || '-'}</div>
                </div>
            </div>
        </div>
        ` : ''}
        ${payment.memo ? `
        <div class="detail-section">
            <h3>메모</h3>
            <div>${payment.memo}</div>
        </div>
        ` : ''}
    `;
    container.innerHTML = html;
}

// 정렬 기능
function sortPayments(sortBy) {
    if (currentSortBy === sortBy) {
        // 같은 컬럼 클릭 시 정렬 순서 토글
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortBy = sortBy;
        currentSortOrder = 'desc'; // 기본값
    }
    loadPayments();
}

// 미수금 상세 내역 보기
async function showUnpaidDetails() {
    try {
        const details = await App.api.get('/payments/unpaid/details');
        if (details) {
            renderUnpaidDetails(details);
            App.Modal.open('unpaid-details-modal');
        }
    } catch (error) {
        App.err('미수금 상세 내역 로드 실패:', error);
        App.showNotification('미수금 상세 내역을 불러오는데 실패했습니다.', 'danger');
    }
}

// 미수금 상세 내역 렌더링
function renderUnpaidDetails(details) {
    const container = document.getElementById('unpaid-details-content');
    if (!container) return;
    
    if (!details || details.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">미수금 내역이 없습니다.<br><small style="color: var(--text-secondary);">선결제(이용권) 예약은 미수금에 포함되지 않습니다.</small></p>';
        return;
    }
    
    let html = `
        <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; font-size: 0.9em; color: var(--text-secondary);">
            <strong>💡 미수금 안내</strong><br>
            • 이용권 구매 시점에 이미 선결제이므로 <strong>선결제(PREPAID) 예약은 미수금에 포함되지 않습니다.</strong><br>
            • 아래 목록은 후불(현장/후불) 예약 중 결제 기록이 없는 건만 표시됩니다.
        </div>
        <table class="table">
            <thead>
                <tr>
                    <th>예약번호</th>
                    <th>회원/비회원</th>
                    <th>시설</th>
                    <th>목적</th>
                    <th>결제방식</th>
                    <th>예약 시간</th>
                    <th>조치</th>
                </tr>
            </thead>
            <tbody>
    `;
    details.forEach(detail => {
        const memberName = detail.member ? detail.member.name : (detail.nonMemberName || '비회원');
        const purposeText = {
            'LESSON': '레슨',
            'RENTAL': '대관',
            'PERSONAL_TRAINING': '개인훈련'
        }[detail.purpose] || detail.purpose || '-';
        const paymentMethodText = {
            'PREPAID': '선결제',
            'ON_SITE': '현장결제',
            'POSTPAID': '후불'
        }[detail.paymentMethod] || detail.paymentMethod || '-';
        
        var branchHint = (detail.facility && detail.facility.name) ? (detail.facility.name.indexOf('사하') !== -1 ? 'bookings' : 'bookings-yeonsan') : 'bookings';
        var editUrl = '/' + (branchHint === 'bookings-yeonsan' ? 'bookings-yeonsan.html' : 'bookings.html') + '?edit=' + (detail.bookingId || '');
        html += `
            <tr>
                <td>${detail.bookingId || '-'}</td>
                <td>${App.escapeHtml(memberName)}${detail.nonMemberPhone ? ' (' + App.escapeHtml(detail.nonMemberPhone) + ')' : ''}</td>
                <td>${detail.facility ? App.escapeHtml(detail.facility.name) : '-'}</td>
                <td>${purposeText}</td>
                <td><span class="badge badge-warning">${paymentMethodText}</span></td>
                <td>${detail.startTime ? App.formatDateTime(detail.startTime) : '-'} ~ ${detail.endTime ? App.formatDateTime(detail.endTime) : '-'}</td>
                <td><a href="${editUrl}" class="btn btn-sm btn-secondary" target="_blank" rel="noopener">예약 수정</a></td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// 정렬 인디케이터 업데이트
function updateSortIndicators() {
    // 모든 인디케이터 초기화
    document.querySelectorAll('[id^="sort-"]').forEach(el => {
        el.textContent = '';
    });
    
    // 현재 정렬 컬럼에 인디케이터 표시
    const indicatorId = `sort-${currentSortBy}-indicator`;
    const indicator = document.getElementById(indicatorId);
    if (indicator) {
        indicator.textContent = currentSortOrder === 'asc' ? '↑' : '↓';
    }
}

// 기존 상품 할당에 대한 결제 생성
async function createMissingPayments() {
    if (!confirm('모든 회원의 기존 상품 할당에 대한 결제를 생성하시겠습니까?\n\n이 작업은 시간이 걸릴 수 있습니다.')) {
        return;
    }
    
    try {
        App.showNotification('결제 생성 중... 잠시만 기다려주세요.', 'info');
        
        App.log('결제 생성 시작...');
        const result = await App.api.post('/members/batch/create-missing-payments');
        App.log('결제 생성 결과:', result);
        
        if (result && result.success) {
            const message = `결제 생성 완료!\n생성: ${result.totalCreated || 0}건\n건너뜀: ${result.totalSkipped || 0}건\n오류: ${result.totalErrors || 0}건`;
            const notificationType = (result.totalErrors || 0) > 0 ? 'warning' : 'success';
            App.showNotification(message, notificationType);
            
            // 오류가 발생한 경우 상세 정보 표시
            if (result.totalErrors > 0) {
                App.err('결제 생성 중 오류 발생:', result);
                App.err('서버 콘솔에서 다음 정보를 확인하세요:');
                App.err('- 각 회원별 처리 결과 로그');
                App.err('- "회원 ID=X의 MemberProduct 조회 실패" 메시지');
                App.err('- 예외 타입과 메시지');
                App.err('- 스택 트레이스');
                
                // 사용자에게 더 자세한 안내
                if (result.totalErrors === result.totalMembers) {
                    App.showNotification(
                        '모든 회원에서 오류가 발생했습니다.\n서버 콘솔 로그를 확인하여 원인을 파악하세요.',
                        'danger'
                    );
                }
            }
            
            // 잠시 대기 후 목록 새로고침 (데이터베이스 반영 시간 확보)
            setTimeout(() => {
                loadPayments();
                loadPaymentSummary();
            }, 500);
        } else {
            const errorMsg = result?.message || '결제 생성에 실패했습니다.';
            App.err('결제 생성 실패:', errorMsg, result);
            App.showNotification(errorMsg, 'danger');
        }
    } catch (error) {
        App.err('결제 생성 실패:', error);
        var errorMessage = '결제 생성 중 오류가 발생했습니다.';
        if (error && error.response) {
            if (error.response.status === 403) errorMessage = '기존 상품 할당 결제 생성은 관리자만 사용할 수 있습니다.';
            else if (error.response.data && error.response.data.message) errorMessage = error.response.data.message;
        } else if (error && error.message) {
            errorMessage += '\n' + error.message;
        }
        App.showNotification(errorMessage, 'danger');
    }
}
