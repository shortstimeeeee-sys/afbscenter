// 결제/정산 페이지 JavaScript

let currentPage = 1;
let currentFilters = {};

document.addEventListener('DOMContentLoaded', function() {
    loadPayments();
    loadPaymentSummary();
});

async function loadPaymentSummary() {
    try {
        const summary = await App.api.get('/payments/summary');
        document.getElementById('kpi-today-revenue').textContent = App.formatCurrency(summary.todayRevenue || 0);
        document.getElementById('kpi-month-revenue').textContent = App.formatCurrency(summary.monthRevenue || 0);
        document.getElementById('kpi-unpaid').textContent = App.formatCurrency(summary.unpaid || 0);
        document.getElementById('kpi-refund-pending').textContent = summary.refundPending || 0;
    } catch (error) {
        console.error('정산 요약 로드 실패:', error);
    }
}

async function loadPayments() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            ...currentFilters
        });
        const payments = await App.api.get(`/payments?${params}`);
        renderPaymentsTable(payments);
    } catch (error) {
        console.error('결제 목록 로드 실패:', error);
    }
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table-body');
    
    if (!payments || payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">결제 내역이 없습니다.</td></tr>';
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

function exportReport() {
    App.showNotification('정산 리포트 다운로드 기능은 준비 중입니다.', 'info');
}
