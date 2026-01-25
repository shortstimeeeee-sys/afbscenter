// 결제/정산 페이지 JavaScript

let currentPage = 1;
let currentFilters = {};
let currentSortBy = 'date';
let currentSortOrder = 'desc';
let allPayments = []; // 클라이언트 측 정렬/검색용

document.addEventListener('DOMContentLoaded', function() {
    loadPayments();
    loadPaymentSummary();
    loadPaymentMethodStatistics();
    
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
});

async function loadPaymentSummary() {
    try {
        const summary = await App.api.get('/payments/summary');
        if (!summary) {
            console.warn('결제 요약 데이터가 없습니다.');
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
        
        // 환불 대기
        const refundPending = summary.refundPending || 0;
        document.getElementById('kpi-refund-pending').textContent = refundPending;
        
        console.log('결제 요약 로드 완료:', summary);
    } catch (error) {
        console.error('정산 요약 로드 실패:', error);
        // 오류 시에도 기본값 표시
        document.getElementById('kpi-today-revenue').textContent = App.formatCurrency(0);
        document.getElementById('kpi-month-revenue').textContent = App.formatCurrency(0);
        document.getElementById('kpi-unpaid').textContent = App.formatCurrency(0);
        document.getElementById('kpi-refund-pending').textContent = '0';
    }
}

async function loadPayments() {
    try {
        const params = new URLSearchParams();
        if (currentPage) {
            params.append('page', currentPage);
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
            console.warn('결제 목록 데이터가 없습니다.');
            renderPaymentsTable([]);
            return;
        }
        
        console.log('결제 목록 로드 완료:', payments.length, '건');
        renderPaymentsTable(payments);
        updateSortIndicators();
    } catch (error) {
        console.error('결제 목록 로드 실패:', error);
        const tbody = document.getElementById('payments-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">결제 목록을 불러오는데 실패했습니다.</td></tr>';
        }
    }
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    allPayments = payments || []; // 클라이언트 측 정렬/검색용 저장
    
    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">결제 내역이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.id}</td>
            <td>${App.formatDateTime(payment.paidAt)}</td>
            <td>${payment.member ? payment.member.name : (payment.memberName || '비회원')}</td>
            <td>${payment.coach ? payment.coach.name : '-'}</td>
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

function applyFilters() {
    const method = document.getElementById('filter-payment-method').value;
    const status = document.getElementById('filter-status').value;
    const category = document.getElementById('filter-category').value;
    const startDate = document.getElementById('filter-date-start').value;
    const endDate = document.getElementById('filter-date-end').value;
    
    currentFilters = {};
    if (method) currentFilters.paymentMethod = method;
    if (status) currentFilters.status = status;
    if (category) currentFilters.category = category;
    if (startDate) currentFilters.startDate = startDate;
    if (endDate) currentFilters.endDate = endDate;
    
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
        console.error('엑셀 다운로드 실패:', error);
        App.showNotification('엑셀 다운로드에 실패했습니다.', 'danger');
    }
}

// 결제 방법별 통계 로드
async function loadPaymentMethodStatistics() {
    try {
        const params = new URLSearchParams();
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
        console.error('결제 방법별 통계 로드 실패:', error);
    }
}

// 결제 방법별 통계 렌더링
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
        'MOBILE': '간편결제'
    };
    
    let html = '<div class="statistics-grid">';
    for (const [method, count] of Object.entries(methodCount)) {
        const amount = methodAmount[method] || 0;
        const percentage = totalAmount > 0 ? ((amount / totalAmount) * 100).toFixed(1) : 0;
        html += `
            <div class="stat-card">
                <div class="stat-label">${methodNames[method] || method}</div>
                <div class="stat-value">${App.formatCurrency(amount)}</div>
                <div class="stat-detail">${count}건 (${percentage}%)</div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
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
        console.error('결제 상세 정보 로드 실패:', error);
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
                    <div>${payment.coach ? payment.coach.name : '-'}</div>
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
        console.error('미수금 상세 내역 로드 실패:', error);
        App.showNotification('미수금 상세 내역을 불러오는데 실패했습니다.', 'danger');
    }
}

// 미수금 상세 내역 렌더링
function renderUnpaidDetails(details) {
    const container = document.getElementById('unpaid-details-content');
    if (!container) return;
    
    if (!details || details.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">미수금 내역이 없습니다.<br><small style="color: var(--text-secondary);">이용권을 사용한 예약이나 후불 예약은 미수금에서 제외됩니다.</small></p>';
        return;
    }
    
    let html = `
        <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; font-size: 0.9em; color: var(--text-secondary);">
            <strong>💡 미수금 안내:</strong><br>
            • 선결제(PREPAID) 예약 중 결제가 없는 예약만 표시됩니다.<br>
            • 이용권(MemberProduct)을 사용한 예약은 별도 결제가 필요 없어 제외됩니다.<br>
            • 후불(ON_SITE, POSTPAID) 예약은 아직 결제하지 않았을 수 있어 제외됩니다.
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
        
        html += `
            <tr>
                <td>${detail.bookingId || '-'}</td>
                <td>${memberName}${detail.nonMemberPhone ? ` (${detail.nonMemberPhone})` : ''}</td>
                <td>${detail.facility ? detail.facility.name : '-'}</td>
                <td>${purposeText}</td>
                <td><span class="badge badge-warning">${paymentMethodText}</span></td>
                <td>${detail.startTime ? App.formatDateTime(detail.startTime) : '-'} ~ ${detail.endTime ? App.formatDateTime(detail.endTime) : '-'}</td>
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
        
        console.log('결제 생성 시작...');
        const result = await App.api.post('/members/batch/create-missing-payments');
        console.log('결제 생성 결과:', result);
        
        if (result && result.success) {
            const message = `결제 생성 완료!\n생성: ${result.totalCreated || 0}건\n건너뜀: ${result.totalSkipped || 0}건\n오류: ${result.totalErrors || 0}건`;
            const notificationType = (result.totalErrors || 0) > 0 ? 'warning' : 'success';
            App.showNotification(message, notificationType);
            
            // 오류가 발생한 경우 상세 정보 표시
            if (result.totalErrors > 0) {
                console.error('결제 생성 중 오류 발생:', result);
                console.error('서버 콘솔에서 다음 정보를 확인하세요:');
                console.error('- 각 회원별 처리 결과 로그');
                console.error('- "회원 ID=X의 MemberProduct 조회 실패" 메시지');
                console.error('- 예외 타입과 메시지');
                console.error('- 스택 트레이스');
                
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
            console.error('결제 생성 실패:', errorMsg, result);
            App.showNotification(errorMsg, 'danger');
        }
    } catch (error) {
        console.error('결제 생성 실패:', error);
        let errorMessage = '결제 생성 중 오류가 발생했습니다.';
        if (error.message) {
            errorMessage += '\n' + error.message;
        }
        App.showNotification(errorMessage, 'danger');
    }
}
