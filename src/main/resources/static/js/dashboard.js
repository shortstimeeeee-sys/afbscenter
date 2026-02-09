// 대시보드 페이지 JavaScript

let memberChart = null;
let revenueChart = null;
let currentMemberDetail = null;

/** 코치·데스크(FRONT)일 때 매출 KPI·차트 숫자만 숨김 (총 회원 수, 예약/가입/만료 임박 등은 표시) */
function dashboardShouldHideNumbers() {
    const role = (App.currentRole || '').toUpperCase();
    return role === 'COACH' || role === 'FRONT';
}

/** 스크린샷 발췌: 해당 구역만 보이도록 나머지 영역은 숨김 (카드/KPI/차트 등 미노출) */
function applyExportCrop() {
    var exportId = window.__dashboardExportId;
    if (!exportId) return;
    var el = document.getElementById(exportId);
    var contentArea = document.querySelector('.content-area');
    if (!el || !contentArea) return;

    // content-area 직계 자식 전부 숨김
    var children = contentArea.children;
    for (var i = 0; i < children.length; i++) {
        children[i].style.display = 'none';
    }
    // export 대상이 속한 직계 자식 찾기
    var directChild = el;
    while (directChild.parentElement && directChild.parentElement !== contentArea) {
        directChild = directChild.parentElement;
    }
    directChild.style.display = ''; // 원래 표시 방식 복원 (block/grid 등)
    // export 대상이 직계 자식이 아니면(예: charts-grid 안의 카드), 형제만 숨김
    if (directChild !== el) {
        var siblings = directChild.children;
        for (var j = 0; j < siblings.length; j++) {
            siblings[j].style.display = siblings[j] === el ? '' : 'none';
        }
    }

    contentArea.style.overflow = '';
    contentArea.style.height = '';
    contentArea.style.transform = '';
    if (window.parent !== window) window.parent.postMessage('screenshot-export-ready', '*');
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 스크린샷 발췌: ?export=id 로 로드된 경우 해당 영역만 표시 (원본과 동일한 레이아웃으로 잘라서 표시)
        var exportId = new URLSearchParams(window.location.search).get('export');
        if (exportId) {
            var sidebar = document.querySelector('.sidebar');
            var topbar = document.querySelector('.topbar');
            var main = document.querySelector('main.main-content');
            var contentArea = document.querySelector('.content-area');
            if (sidebar) sidebar.style.display = 'none';
            if (topbar) topbar.style.display = 'none';
            if (main) {
                main.style.marginLeft = '0';
                main.style.minWidth = '1100px';
            }
            if (contentArea) contentArea.style.minWidth = '1060px';
            document.body.style.overflow = 'hidden';
            document.body.style.minWidth = '1100px';
            if (exportId === 'export-announcements') {
                var cardHeader = document.querySelector('#export-announcements .card-header');
                if (cardHeader) cardHeader.style.display = 'none';
            }
            window.__dashboardExportId = exportId;
            applyExportCrop();
            if (window.parent !== window) window.parent.postMessage('screenshot-export-ready', '*');
        }

        App.log('대시보드 초기화 시작');
        
        // KPI 상세 모달: 바깥 클릭 시 닫기
        const kpiModalEl = document.getElementById('kpi-detail-modal');
        if (kpiModalEl) {
            kpiModalEl.addEventListener('click', function(e) {
                if (e.target === kpiModalEl) closeKpiDetailModal();
            });
        }
        // 비회원 예약 목록 모달: 바깥 클릭 시 닫기
        const nonMemberModalEl = document.getElementById('non-member-bookings-modal');
        if (nonMemberModalEl) {
            nonMemberModalEl.addEventListener('click', function(e) {
                if (e.target === nonMemberModalEl) closeNonMemberBookingsModal();
            });
        }
        // KPI 카드 클릭 시 상세 모달 열기 (총 회원 수, 월/오늘 가입자, 오늘 예약, 오늘/월 매출, 평균 회원당 매출)
        document.querySelectorAll('.kpi-card-clickable[data-kpi]').forEach(function(card) {
            card.addEventListener('click', function() {
                const type = this.getAttribute('data-kpi');
                if (type && typeof openKpiDetailModal === 'function') {
                    openKpiDetailModal(type);
                }
            });
        });
        
        // 만료 임박 회원 카드 클릭 이벤트 리스너 추가
        const expiringMembersCard = document.getElementById('expiring-members-card');
        if (expiringMembersCard) {
            expiringMembersCard.addEventListener('click', function() {
                if (typeof openExpiringMembersModal === 'function') {
                    openExpiringMembersModal();
                } else if (typeof window.openExpiringMembersModal === 'function') {
                    window.openExpiringMembersModal();
                } else {
                    App.err('openExpiringMembersModal 함수를 찾을 수 없습니다.');
                }
            });
        }
        
        // 만료 임박 회원 모달의 탭 버튼 이벤트 리스너 추가
        const tabExpiring = document.getElementById('tab-expiring');
        const tabExpired = document.getElementById('tab-expired');
        const tabNoProduct = document.getElementById('tab-no-product');
        if (tabExpiring) {
            tabExpiring.addEventListener('click', function() {
                if (typeof switchTab === 'function') {
                    switchTab('expiring');
                } else if (typeof window.switchTab === 'function') {
                    window.switchTab('expiring');
                }
            });
        }
        if (tabExpired) {
            tabExpired.addEventListener('click', function() {
                if (typeof switchTab === 'function') {
                    switchTab('expired');
                } else if (typeof window.switchTab === 'function') {
                    window.switchTab('expired');
                }
            });
        }
        if (tabNoProduct) {
            tabNoProduct.addEventListener('click', function() {
                if (typeof switchTab === 'function') {
                    switchTab('noProduct');
                } else if (typeof window.switchTab === 'function') {
                    window.switchTab('noProduct');
                }
            });
        }
        
        // 대시보드 데이터 로드
        try {
            await loadDashboardData();
        } catch (error) {
            App.err('대시보드 데이터 로드 중 오류:', error);
        }
        
        // 차트 초기화
        try {
            await initCharts();
        } catch (error) {
            App.err('차트 초기화 중 오류:', error);
        }

        // 스크린샷 발췌: 데이터/차트 로드 후 해당 영역만 잘라서 표시 (원본과 동일한 화면)
        if (window.__dashboardExportId) {
            setTimeout(applyExportCrop, 100);
        }
        
        App.log('대시보드 초기화 완료');
    } catch (error) {
        App.err('대시보드 초기화 실패:', error);
        App.err('오류 상세:', error.message, error.stack);
        
        // 사용자에게 알림 표시
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification('대시보드 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.', 'danger');
        }
    }
});

async function loadDashboardData() {
    try {
        var exportId = window.__dashboardExportId;
        App.log('대시보드 데이터 로드 시작', exportId ? '(export: ' + exportId + ')' : '');

        // 스크린샷 발췌: 해당 구역만 보이므로 필요한 데이터만 로드
        if (exportId === 'export-announcements') {
            try {
                const announcements = await App.api.get('/dashboard/announcements');
                renderActiveAnnouncements(announcements);
            } catch (error) {
                App.err('활성 공지사항 로드 실패:', error);
            }
            App.log('대시보드 데이터 로드 완료 (공지만)');
            return;
        }
        if (exportId === 'export-today-schedule') {
            try {
                const schedule = await App.api.get('/dashboard/today-schedule');
                renderTodaySchedule(schedule);
            } catch (error) {
                App.err('오늘 일정 로드 실패:', error);
            }
            App.log('대시보드 데이터 로드 완료 (일정만)');
            return;
        }
        if (exportId === 'export-member-chart' || exportId === 'export-revenue-chart') {
            App.log('대시보드 데이터 로드 완료 (차트는 initCharts에서)');
            return;
        }

        // KPI 데이터 로드
        const kpiData = await App.api.get('/dashboard/kpi');
        App.log('KPI 데이터 로드 성공:', kpiData);
        
        // DOM 요소 존재 확인 후 업데이트
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                App.warn(`요소를 찾을 수 없습니다: ${id}`);
            }
        };
        
        const hideRevenueOnly = dashboardShouldHideNumbers();

        // 순서: 총 회원 수, 월 가입자, 오늘 가입 수, 오늘 예약 수, 오늘 매출, 월 매출 — 코치/데스크는 매출만 숨김
        updateElement('kpi-total-members', kpiData.totalMembers || 0);
        updateElement('kpi-monthly-new-members', kpiData.monthlyNewMembers || 0);
        updateElement('kpi-new-members', kpiData.newMembers || 0);
        
        // 오늘 예약 수 및 어제 대비 퍼센트 계산
        const todayBookings = kpiData.bookings || 0;
        const yesterdayBookings = kpiData.yesterdayBookings || 0;
        updateElement('kpi-bookings', todayBookings);
        
        const bookingsChangeElement = document.getElementById('kpi-bookings-change');
        if (bookingsChangeElement) {
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
        }
        
        // 오늘 매출 및 어제 대비 퍼센트 계산 (코치/데스크는 숨김)
        const todayRevenue = kpiData.revenue || 0;
        const yesterdayRevenue = kpiData.yesterdayRevenue || 0;
        updateElement('kpi-revenue', hideRevenueOnly ? '-' : App.formatCurrency(todayRevenue));
        
        const revenueChangeElement = document.getElementById('kpi-revenue-change');
        if (revenueChangeElement) {
            if (hideRevenueOnly) {
                revenueChangeElement.textContent = '-';
                revenueChangeElement.className = 'kpi-change';
            } else if (yesterdayRevenue === 0) {
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
        }
        
        updateElement('kpi-monthly-revenue', hideRevenueOnly ? '-' : App.formatCurrency(kpiData.monthlyRevenue || 0));
        
        // 총 예약 건수 (이번 달, 사하+연산+대관) 및 지점별 — 코치/데스크도 표시
        const totalBookingsMonth = kpiData.totalBookingsMonth != null ? kpiData.totalBookingsMonth : 0;
        const byBranch = kpiData.bookingsByBranch || {};
        const nonMemberByBranch = kpiData.bookingsNonMemberByBranch || {};
        const saha = byBranch.SAHA != null ? byBranch.SAHA : 0;
        const yeonsan = byBranch.YEONSAN != null ? byBranch.YEONSAN : 0;
        const rental = byBranch.RENTAL != null ? byBranch.RENTAL : 0;
        const sahaNonMember = nonMemberByBranch.SAHA != null ? nonMemberByBranch.SAHA : 0;
        const yeonsanNonMember = nonMemberByBranch.YEONSAN != null ? nonMemberByBranch.YEONSAN : 0;
        const rentalNonMember = nonMemberByBranch.RENTAL != null ? nonMemberByBranch.RENTAL : 0;
        const currentMonth = new Date().getMonth() + 1;
        const monthLabelEl = document.getElementById('kpi-total-bookings-month-label');
        if (monthLabelEl) monthLabelEl.textContent = currentMonth + '월 총 예약 건수';
        var totalMembers = kpiData.totalMembers != null ? Number(kpiData.totalMembers) : 0;
        var perMember = totalMembers > 0 ? (totalBookingsMonth / totalMembers) : 0;
        var perMemberStr = totalMembers > 0 ? (Math.round(perMember * 10) / 10).toFixed(1) : '0';
        var valueEl = document.getElementById('kpi-total-bookings-month');
        if (valueEl) valueEl.innerHTML = totalBookingsMonth + '<span class="kpi-change positive" style="margin-left: 0.25em;">(회원 1인당 ' + perMemberStr + '건)</span>';
        const branchEl = document.getElementById('kpi-bookings-by-branch');
        if (branchEl) branchEl.textContent = '사하 ' + saha + ' (비회원 ' + sahaNonMember + ') / 연산 ' + yeonsan + ' (비회원 ' + yeonsanNonMember + ') / 대관 ' + rental + ' (비회원 ' + rentalNonMember + ')';
        
        // 만료 임박 및 종료 회원 수 — 코치/데스크도 표시
        const expiringMembers = kpiData.expiringMembers || 0;
        const expiredMembers = kpiData.expiredMembers || 0;
        const totalCount = expiringMembers + expiredMembers;
        
        App.log('만료 임박 및 종료 회원 데이터:', {
            expiringMembers,
            expiredMembers,
            totalCount,
            kpiData: kpiData
        });
        
        updateElement('kpi-expiring-members', totalCount);
        
        // kpi-change에 상세 정보 표시
        const changeElement = document.getElementById('kpi-expiring-members')?.nextElementSibling;
        if (changeElement && changeElement.classList.contains('kpi-change')) {
            let detailText = '';
            if (totalCount === 0) {
                detailText = '확인 필요';
            } else {
                const parts = [];
                if (expiringMembers > 0) {
                    parts.push(`만료 임박 ${expiringMembers}명`);
                }
                if (expiredMembers > 0) {
                    parts.push(`종료 ${expiredMembers}명`);
                }
                detailText = parts.join(', ');
            }
            changeElement.textContent = detailText;
            changeElement.style.color = 'var(--warning, #F1C40F)';
            changeElement.style.fontWeight = '700';
        }
        
        if (totalCount > 0) {
            const expiringCard = document.getElementById('kpi-expiring-members')?.parentElement;
            if (expiringCard) {
                expiringCard.style.borderLeft = '3px solid var(--warning, #F1C40F)';
            }
        }
        
        // export 모드가 아닐 때만 오늘 일정·알림·공지 추가 로드 (KPI는 위에서 이미 처리)
        if (!exportId) {
            try {
                const schedule = await App.api.get('/dashboard/today-schedule');
                renderTodaySchedule(schedule);
            } catch (error) {
                App.err('오늘 일정 로드 실패:', error);
            }
            try {
                const alerts = await App.api.get('/dashboard/alerts');
                renderPendingAlerts(alerts);
            } catch (error) {
                App.err('미처리 알림 로드 실패:', error);
            }
            try {
                const announcements = await App.api.get('/dashboard/announcements');
                renderActiveAnnouncements(announcements);
            } catch (error) {
                App.err('활성 공지사항 로드 실패:', error);
            }
        } else if (exportId === 'kpi-grid') {
            // KPI만 보이는 export: 일정/알림/공지 스킵
        }
        
        App.log('대시보드 데이터 로드 완료');
        
    } catch (error) {
        App.err('대시보드 데이터 로드 실패:', error);
        App.err('오류 상세:', error.message, error.stack);
        
        // 에러 발생 시 기본값 표시
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };
        
        updateElement('kpi-total-members', '0');
        updateElement('kpi-monthly-new-members', '0');
        updateElement('kpi-new-members', '0');
        updateElement('kpi-bookings', '0');
        updateElement('kpi-revenue', '₩0');
        updateElement('kpi-monthly-revenue', '₩0');
        updateElement('kpi-avg-revenue-per-member', '₩0');
        updateElement('kpi-expiring-members', '0');
        // kpi-change도 업데이트
        const changeElement = document.getElementById('kpi-expiring-members')?.nextElementSibling;
        if (changeElement && changeElement.classList.contains('kpi-change')) {
            changeElement.textContent = '확인 필요';
            changeElement.style.color = 'var(--warning, #F1C40F)';
            changeElement.style.fontWeight = '700';
        }
        
        // 사용자에게 알림 표시
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification('대시보드 데이터를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.', 'danger');
        }
    }
}

// ========== KPI 상세 모달 (총 회원 수, 월/오늘 가입자, 오늘 예약, 오늘/월 매출, 평균 회원당 매출) ==========
let kpiDetailCurrentType = null;

function openKpiDetailModal(type) {
    kpiDetailCurrentType = type;
    const modal = document.getElementById('kpi-detail-modal');
    const titleEl = document.getElementById('kpi-detail-modal-title');
    const contentEl = document.getElementById('kpi-detail-content');
    const actionBtn = document.getElementById('kpi-detail-action-btn');
    if (!modal || !titleEl || !contentEl) return;
    const currentMonth = new Date().getMonth() + 1;
    const titles = {
        'total-members': '총 회원 수 상세',
        'monthly-new-members': '월 가입자 상세 (이번 달)',
        'new-members': '오늘 가입 수 상세',
        'bookings': '오늘 예약 수 상세',
        'revenue': '오늘 매출 상세',
        'monthly-revenue': '월 매출 상세 (이번 달)',
        'total-bookings-month': currentMonth + '월 총 예약 건수 상세'
    };
    titleEl.textContent = titles[type] || '상세';
    contentEl.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    actionBtn.style.display = 'none';
    actionBtn.onclick = kpiDetailActionClick;
    modal.style.display = 'flex';
    loadKpiDetail(type);
}

function closeKpiDetailModal() {
    const modal = document.getElementById('kpi-detail-modal');
    if (modal) modal.style.display = 'none';
    kpiDetailCurrentType = null;
}

function openNonMemberBookingsModal(branch, branchLabel, startISO, endISO) {
    const modal = document.getElementById('non-member-bookings-modal');
    const titleEl = document.getElementById('non-member-bookings-modal-title');
    const loadingEl = document.getElementById('non-member-bookings-loading');
    const tableWrap = document.getElementById('non-member-bookings-table-wrap');
    const tbody = document.getElementById('non-member-bookings-tbody');
    const emptyEl = document.getElementById('non-member-bookings-empty');
    if (!modal || !titleEl || !loadingEl || !tableWrap || !tbody || !emptyEl) return;
    var monthNum = new Date().getMonth() + 1;
    titleEl.textContent = monthNum + '월 ' + branchLabel + ' 비회원 예약 목록';
    loadingEl.style.display = 'block';
    tableWrap.style.display = 'none';
    emptyEl.style.display = 'none';
    tbody.innerHTML = '';
    modal.style.display = 'flex';

    var params = 'start=' + encodeURIComponent(startISO) + '&end=' + encodeURIComponent(endISO);
    if (branch) params += '&branch=' + encodeURIComponent(branch);
    App.api.get('/bookings/non-members?' + params).then(function(list) {
        loadingEl.style.display = 'none';
        list = Array.isArray(list) ? list : [];
        if (list.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }
        var branchText = { SAHA: '사하점', YEONSAN: '연산점', RENTAL: '대관' };
        var statusTextMap = { PENDING: '대기', CONFIRMED: '확정', CANCELLED: '취소', COMPLETED: '완료' };
        list.forEach(function(b) {
            var startTime = b.startTime;
            var dateTimeStr = '-';
            if (startTime) {
                if (typeof startTime === 'string') dateTimeStr = startTime.replace('T', ' ').substring(0, 16);
                else if (startTime.year) dateTimeStr = startTime.year + '-' + String(startTime.monthValue || startTime.month || 1).padStart(2, '0') + '-' + String(startTime.dayOfMonth || startTime.day || 1).padStart(2, '0') + ' ' + String(startTime.hour || 0).padStart(2, '0') + ':' + String(startTime.minute || 0).padStart(2, '0');
            }
            var facilityName = (b.facility && b.facility.name) ? b.facility.name : '-';
            var br = (b.branch && branchText[b.branch]) ? branchText[b.branch] : (b.branch || '-');
            var name = b.nonMemberName || '-';
            var phone = b.nonMemberPhone || '-';
            var coach = b.coachName || '-';
            var status = (b.status && statusTextMap[b.status]) ? statusTextMap[b.status] : (b.status || '-');
            tbody.insertAdjacentHTML('beforeend', '<tr><td>' + dateTimeStr + '</td><td>' + facilityName + '</td><td>' + br + '</td><td>' + name + '</td><td>' + phone + '</td><td>' + coach + '</td><td>' + status + '</td></tr>');
        });
        tableWrap.style.display = 'block';
    }).catch(function(err) {
        App.err('비회원 예약 목록 조회 실패:', err);
        loadingEl.style.display = 'none';
        emptyEl.textContent = '목록을 불러오는데 실패했습니다.';
        emptyEl.style.display = 'block';
    });
}

function closeNonMemberBookingsModal() {
    var modal = document.getElementById('non-member-bookings-modal');
    if (modal) modal.style.display = 'none';
}

function kpiDetailActionClick() {
    const t = kpiDetailCurrentType;
    if (t === 'total-members' || t === 'monthly-new-members' || t === 'new-members') {
        window.location.href = '/members.html';
    } else if (t === 'bookings' || t === 'total-bookings-month') {
        window.location.href = '/bookings.html';
    } else if (t === 'revenue' || t === 'monthly-revenue') {
        window.location.href = '/payments.html';
    }
}

async function loadKpiDetail(type) {
    const contentEl = document.getElementById('kpi-detail-content');
    const actionBtn = document.getElementById('kpi-detail-action-btn');
    if (!contentEl) return;
    try {
        const today = new Date();
        const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
        const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        const firstDayOfMonth = new Date(y, m, 1);
        const lastDayOfMonth = new Date(y, m + 1, 0);
        const monthStartStr = firstDayOfMonth.getFullYear() + '-' + String(firstDayOfMonth.getMonth() + 1).padStart(2, '0') + '-' + String(firstDayOfMonth.getDate()).padStart(2, '0');
        const monthEndStr = lastDayOfMonth.getFullYear() + '-' + String(lastDayOfMonth.getMonth() + 1).padStart(2, '0') + '-' + String(lastDayOfMonth.getDate()).padStart(2, '0');
        const startOfTodayISO = new Date(y, m, d, 0, 0, 0, 0).toISOString();
        const endOfTodayISO = new Date(y, m, d, 23, 59, 59, 999).toISOString();
        const startOfMonthISO = new Date(y, m, 1, 0, 0, 0, 0).toISOString();
        const endOfMonthISO = new Date(y, m + 1, 0, 23, 59, 59, 999).toISOString();

        if (type === 'total-members' || type === 'monthly-new-members' || type === 'new-members') {
            const members = await App.api.get('/members');
            let list = Array.isArray(members) ? members : [];
            if (type === 'monthly-new-members') {
                list = list.filter(function(m) {
                    const j = m.joinDate;
                    if (!j) return false;
                    const jd = typeof j === 'string' ? j.split('T')[0] : (j.year + '-' + String(j.monthValue).padStart(2, '0') + '-' + String(j.dayOfMonth).padStart(2, '0'));
                    return jd >= monthStartStr && jd <= todayStr;
                });
            } else if (type === 'new-members') {
                list = list.filter(function(m) {
                    const j = m.joinDate;
                    if (!j) return false;
                    const jd = typeof j === 'string' ? j.split('T')[0] : (j.year + '-' + String(j.monthValue).padStart(2, '0') + '-' + String(j.dayOfMonth).padStart(2, '0'));
                    return jd === todayStr;
                });
            }
            contentEl.innerHTML = renderMembersDetail(list, type);
            actionBtn.textContent = '회원 관리로 이동';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'bookings') {
            const params = new URLSearchParams({ start: startOfTodayISO, end: endOfTodayISO });
            const bookings = await App.api.get('/bookings?' + params.toString());
            const list = Array.isArray(bookings) ? bookings : [];
            contentEl.innerHTML = renderBookingsDetail(list);
            actionBtn.textContent = '예약 관리로 이동';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'revenue') {
            const payments = await App.api.get('/payments?startDate=' + todayStr + '&endDate=' + todayStr);
            const list = (Array.isArray(payments) ? payments : []).filter(function(p) { return p.member != null && p.member.id != null; });
            contentEl.innerHTML = renderPaymentsDetail(list, '오늘');
            actionBtn.textContent = '결제/정산으로 이동';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'total-bookings-month') {
            const kpiData = await App.api.get('/dashboard/kpi');
            const total = kpiData.totalBookingsMonth != null ? kpiData.totalBookingsMonth : 0;
            const byBranch = kpiData.bookingsByBranch || {};
            const nonMemberByBranch = kpiData.bookingsNonMemberByBranch || {};
            const saha = byBranch.SAHA != null ? byBranch.SAHA : 0;
            const yeonsan = byBranch.YEONSAN != null ? byBranch.YEONSAN : 0;
            const rental = byBranch.RENTAL != null ? byBranch.RENTAL : 0;
            const sahaNonMember = nonMemberByBranch.SAHA != null ? nonMemberByBranch.SAHA : 0;
            const yeonsanNonMember = nonMemberByBranch.YEONSAN != null ? nonMemberByBranch.YEONSAN : 0;
            const rentalNonMember = nonMemberByBranch.RENTAL != null ? nonMemberByBranch.RENTAL : 0;
            const monthNum = new Date().getMonth() + 1;
            const now = new Date();
            const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const endISO = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
            var totalMembersModal = kpiData.totalMembers != null ? Number(kpiData.totalMembers) : 0;
            var perMemberModal = totalMembersModal > 0 ? (total / totalMembersModal) : 0;
            var perMemberStrModal = totalMembersModal > 0 ? (Math.round(perMemberModal * 10) / 10).toFixed(1) : '0';
            let html = '<p style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">' + monthNum + '월(1일~말일) 사하점·연산점·대관 예약 합계입니다.</p>';
            html += '<p style="margin-bottom: 12px; font-size: 14px; font-weight: 600;">회원 <strong>' + totalMembersModal + '명</strong> 기준 1인당 예약 <strong>' + perMemberStrModal + '건</strong></p>';
            html += '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
            html += '<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 12px 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);"><a href="/bookings.html" style="text-decoration: none; color: var(--text-primary); font-weight: 600;"><span style="color: var(--text-secondary); margin-right: 6px;">📍 사하점</span>' + saha + '건</a> <span class="non-member-link" role="button" tabindex="0" data-branch="SAHA" data-label="사하점" data-start="' + startISO + '" data-end="' + endISO + '" style="color: var(--primary); cursor: pointer; text-decoration: underline;">(비회원 ' + sahaNonMember + ')</span></span>';
            html += '<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 12px 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);"><a href="/bookings-yeonsan.html" style="text-decoration: none; color: var(--text-primary); font-weight: 600;"><span style="color: var(--text-secondary); margin-right: 6px;">📍 연산점</span>' + yeonsan + '건</a> <span class="non-member-link" role="button" tabindex="0" data-branch="YEONSAN" data-label="연산점" data-start="' + startISO + '" data-end="' + endISO + '" style="color: var(--primary); cursor: pointer; text-decoration: underline;">(비회원 ' + yeonsanNonMember + ')</span></span>';
            html += '<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 12px 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);"><a href="/rentals.html" style="text-decoration: none; color: var(--text-primary); font-weight: 600;"><span style="color: var(--text-secondary); margin-right: 6px;">🏟️ 대관</span>' + rental + '건</a> <span class="non-member-link" role="button" tabindex="0" data-branch="RENTAL" data-label="대관" data-start="' + startISO + '" data-end="' + endISO + '" style="color: var(--primary); cursor: pointer; text-decoration: underline;">(비회원 ' + rentalNonMember + ')</span></span>';
            html += '</div>';
            html += '<p style="margin-top: 16px; font-size: 13px; color: var(--text-muted);">총 <strong>' + total + '</strong>건 (사하 ' + saha + ' + 연산 ' + yeonsan + ' + 대관 ' + rental + ')</p>';
            contentEl.innerHTML = html;
            contentEl.querySelectorAll('.non-member-link').forEach(function(span) {
                function openNonMember() {
                    openNonMemberBookingsModal(span.getAttribute('data-branch'), span.getAttribute('data-label'), span.getAttribute('data-start'), span.getAttribute('data-end'));
                }
                span.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); openNonMember(); });
                span.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNonMember(); } });
            });
            actionBtn.textContent = '사하점 예약으로 이동';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'monthly-revenue') {
            const payments = await App.api.get('/payments?startDate=' + monthStartStr + '&endDate=' + monthEndStr);
            const list = (Array.isArray(payments) ? payments : []).filter(function(p) { return p.member != null && p.member.id != null; });
            contentEl.innerHTML = renderPaymentsDetail(list, '이번 달');
            actionBtn.textContent = '결제/정산으로 이동';
            actionBtn.style.display = 'inline-block';
        }
    } catch (err) {
        App.err('KPI 상세 로드 실패:', err);
        contentEl.innerHTML = '<p style="text-align: center; color: var(--danger);">데이터를 불러오는데 실패했습니다.</p>';
        if (actionBtn) actionBtn.style.display = 'none';
    }
}

// 회원 등급 배지 클래스 (common.css / members.js와 동일: badge-elite-elementary, badge-youth 등)
function getGradeBadgeClass(grade) {
    var g = (grade || 'OTHER').toUpperCase();
    switch (g) {
        case 'ELITE_ELEMENTARY': return 'elite-elementary';
        case 'ELITE_MIDDLE': return 'elite-middle';
        case 'ELITE_HIGH': return 'elite-high';
        case 'SOCIAL': return 'secondary';
        case 'YOUTH': return 'youth';
        case 'OTHER': return 'other';
        default: return 'info';
    }
}
function statusText(status) {
    if (!status) return '-';
    var s = String(status).toUpperCase();
    if (App.Status && App.Status.member && App.Status.member.getText) return App.Status.member.getText(s);
    var map = { 'ACTIVE': '활성', 'INACTIVE': '휴면', 'WITHDRAWN': '탈퇴' };
    return map[s] || status;
}

function renderMembersDetail(members, type) {
    const gradeText = function(g) {
        if (!g) return '-';
        return App.MemberGrade && App.MemberGrade.getText ? App.MemberGrade.getText(g) : g;
    };
    if (!members || members.length === 0) {
        return '<p style="color: var(--text-muted);">해당 기간 회원이 없습니다.</p>';
    }
    let summary = '';
    if (type === 'total-members') {
        const byGrade = {};
        members.forEach(function(m) {
            const g = m.grade || 'OTHER';
            byGrade[g] = (byGrade[g] || 0) + 1;
        });
        summary = '<p style="margin-bottom: 14px; font-size: 13px; color: var(--text-secondary);">등급별: </p><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">' +
            Object.keys(byGrade).map(function(g) {
                var badgeClass = getGradeBadgeClass(g);
                return '<span class="badge badge-' + badgeClass + '" style="padding: 6px 12px; font-size: 13px;">' + gradeText(g) + ' ' + byGrade[g] + '명</span>';
            }).join('') + '</div>';
    }
    const rows = members.slice(0, 200).map(function(m) {
        let jd = '-';
        if (m.joinDate) {
            if (typeof m.joinDate === 'string') jd = m.joinDate.split('T')[0];
            else if (m.joinDate.year != null) jd = m.joinDate.year + '-' + String(m.joinDate.monthValue != null ? m.joinDate.monthValue : m.joinDate.month || 1).padStart(2, '0') + '-' + String(m.joinDate.dayOfMonth != null ? m.joinDate.dayOfMonth : m.joinDate.day || 1).padStart(2, '0');
        }
        var badgeClass = getGradeBadgeClass(m.grade);
        var gradeBadge = '<span class="badge badge-' + badgeClass + '">' + gradeText(m.grade) + '</span>';
        return '<tr><td>' + (m.name || '-') + '</td><td>' + (m.memberNumber || '-') + '</td><td>' + gradeBadge + '</td><td>' + statusText(m.status) + '</td><td>' + jd + '</td></tr>';
    });
    const more = members.length > 200 ? '<p style="margin-top: 8px; color: var(--text-muted); font-size: 13px;">외 ' + (members.length - 200) + '명</p>' : '';
    return summary + '<div style="overflow-x: auto;"><table class="table" style="width: 100%; font-size: 13px;"><thead><tr><th>이름</th><th>회원번호</th><th>등급</th><th>상태</th><th>가입일</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' + more;
}

function bookingStatusText(status) {
    if (!status) return '-';
    var s = String(status).toUpperCase();
    if (App.Status && App.Status.booking && App.Status.booking.getText) return App.Status.booking.getText(s);
    var map = { 'CONFIRMED': '확정', 'PENDING': '대기', 'CANCELLED': '취소', 'COMPLETED': '완료', 'NO_SHOW': '노쇼', 'CHECKED_IN': '체크인' };
    return map[s] || status;
}

function renderBookingsDetail(bookings) {
    if (!bookings || bookings.length === 0) {
        return '<p style="color: var(--text-muted);">오늘 예약이 없습니다.</p>';
    }
    const fmtTime = function(d) {
        if (!d) return '-';
        const s = typeof d === 'string' ? d : (d.dateTime || '');
        if (!s) return '-';
        return s.replace('T', ' ').substring(0, 16);
    };
    const rows = bookings.map(function(b) {
        const memberName = App.escapeHtml((b.member && b.member.name) ? b.member.name : (b.nonMemberName || '-'));
        const facilityName = App.escapeHtml((b.facility && b.facility.name) ? b.facility.name : '-');
        const coachName = App.escapeHtml((b.coach && b.coach.name) ? b.coach.name : '-');
        return '<tr><td>' + fmtTime(b.startTime) + '</td><td>' + memberName + '</td><td>' + facilityName + '</td><td>' + coachName + '</td><td>' + App.escapeHtml(bookingStatusText(b.status)) + '</td></tr>';
    });
    return '<div style="overflow-x: auto;"><table class="table" style="width: 100%; font-size: 13px;"><thead><tr><th>시작 시간</th><th>회원/비회원</th><th>시설</th><th>코치</th><th>상태</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}

function paymentMethodText(method) {
    if (!method) return '-';
    var s = String(method).toUpperCase();
    var map = { 'CASH': '현금', 'CARD': '카드', 'BANK_TRANSFER': '계좌이체', 'EASY_PAY': '간편결제' };
    if (map[s]) return map[s];
    if (App.PaymentMethod && App.PaymentMethod.getText) return App.PaymentMethod.getText(s);
    return method;
}

function renderPaymentsDetail(payments, periodLabel) {
    if (!payments || payments.length === 0) {
        return '<p style="color: var(--text-muted);">' + periodLabel + ' 결제 내역이 없습니다.</p>';
    }
    let total = 0;
    const rows = payments.map(function(p) {
        const amt = p.amount != null ? p.amount : 0;
        total += amt;
        const paidAt = p.paidAt ? (typeof p.paidAt === 'string' ? p.paidAt.split('T')[0] : '-') : '-';
        const memberName = App.escapeHtml((p.member && p.member.name) ? p.member.name : '-');
        const productName = App.escapeHtml((p.product && p.product.name) ? p.product.name : '-');
        return '<tr><td>' + paidAt + '</td><td>' + memberName + '</td><td>' + (productName || '-') + '</td><td>' + App.formatCurrency(amt) + '</td><td>' + App.escapeHtml(paymentMethodText(p.paymentMethod)) + '</td></tr>';
    });
    const totalRow = '<tr style="font-weight: 700; background: var(--bg-tertiary);"><td colspan="3">합계</td><td>' + App.formatCurrency(total) + '</td><td></td></tr>';
    return '<div style="overflow-x: auto;"><table class="table" style="width: 100%; font-size: 13px;"><thead><tr><th>결제일</th><th>회원</th><th>상품</th><th>금액</th><th>결제 수단</th></tr></thead><tbody>' + rows.join('') + totalRow + '</tbody></table></div>';
}

// 코치별 색상 가져오기 (common.js의 App.CoachColors 사용)
function getCoachColorForSchedule(coachId) {
    return App.CoachColors.getColorById(coachId);
}

function renderTodaySchedule(schedule) {
    const container = document.getElementById('today-schedule');
    if (!container) {
        App.warn('today-schedule 요소를 찾을 수 없습니다.');
        return;
    }
    
    if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
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
    if (!container) {
        App.warn('pending-alerts 요소를 찾을 수 없습니다.');
        return;
    }
    
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">미처리 알림이 없습니다.</p>';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.type || 'info'}">
            <div class="alert-title">${App.escapeHtml(alert.title || '')}</div>
            <div class="alert-detail">${alert.message}</div>
        </div>
    `).join('');
}

function renderActiveAnnouncements(announcements) {
    const container = document.getElementById('active-announcements');
    if (!container) {
        App.warn('active-announcements 요소를 찾을 수 없습니다.');
        return;
    }
    
    const countElement = document.getElementById('announcement-count');
    
    if (!announcements || !Array.isArray(announcements) || announcements.length === 0) {
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
            App.err('공지사항 상세 조회 실패:', error);
            App.showNotification('공지사항을 불러오는데 실패했습니다.', 'danger');
        });
}

// ========================================
// 차트 초기화
// ========================================

async function initCharts() {
    var exportId = window.__dashboardExportId;
    try {
        App.log('차트 초기화 시작', exportId ? '(export: ' + exportId + ')' : '');
        if (exportId && exportId !== 'export-member-chart' && exportId !== 'export-revenue-chart') {
            App.log('차트 초기화 스킵 (해당 구역 아님)');
            return;
        }
        var needMemberChart = !exportId || exportId === 'export-member-chart';
        var needRevenueChart = !exportId || exportId === 'export-revenue-chart';

        var memberGrowthData = [];
        var revenueData = [];
        if (needMemberChart) {
            let members = [];
            try {
                members = await App.api.get('/members');
                if (!Array.isArray(members)) members = [];
            } catch (error) {
                App.err('회원 데이터 조회 실패:', error);
            }
            memberGrowthData = calculateMonthlyGrowth(members);
        }
        if (needRevenueChart) {
            let payments = [];
            try {
                payments = await App.api.get('/payments');
                if (!Array.isArray(payments)) payments = [];
            } catch (error) {
                App.warn('Payment 데이터 조회 실패:', error);
            }
            if (!payments || payments.length === 0) {
                try {
                    revenueData = await calculateMonthlyRevenueFromMemberProducts();
                } catch (error) {
                    revenueData = [];
                }
            } else {
                revenueData = calculateMonthlyRevenue(payments);
            }
        }

        if (needMemberChart) {
            try {
                createMemberChart(memberGrowthData);
            } catch (error) {
                App.err('회원 증가 추이 차트 생성 실패:', error);
            }
        }
        if (needRevenueChart) {
            try {
                createRevenueChart(revenueData);
            } catch (error) {
                App.err('월별 매출 차트 생성 실패:', error);
            }
        }
        
        App.log('차트 초기화 완료');
    } catch (error) {
        App.err('차트 초기화 실패:', error);
        App.err('오류 상세:', error.message, error.stack);
    }
}

// 매출 지표 렌더링 함수는 제거됨 (통계/분석 페이지로 이동)

// 현재 활성 탭
let currentTab = 'expiring';

// 탭 전환 (만료 임박 회원 모달용)
function switchTab(tab) {
    currentTab = tab;
    const expiringTab = document.getElementById('tab-expiring');
    const expiredTab = document.getElementById('tab-expired');
    const noProductTab = document.getElementById('tab-no-product');
    const activeStyle = { borderBottomColor: 'var(--accent-primary)', color: 'var(--accent-primary)' };
    const inactiveStyle = { borderBottomColor: 'transparent', color: 'var(--text-secondary)' };
    
    if (expiringTab && expiredTab && noProductTab) {
        expiringTab.classList.toggle('active', tab === 'expiring');
        expiringTab.style.borderBottomColor = tab === 'expiring' ? activeStyle.borderBottomColor : inactiveStyle.borderBottomColor;
        expiringTab.style.color = tab === 'expiring' ? activeStyle.color : inactiveStyle.color;
        expiredTab.classList.toggle('active', tab === 'expired');
        expiredTab.style.borderBottomColor = tab === 'expired' ? activeStyle.borderBottomColor : inactiveStyle.borderBottomColor;
        expiredTab.style.color = tab === 'expired' ? activeStyle.color : inactiveStyle.color;
        noProductTab.classList.toggle('active', tab === 'noProduct');
        noProductTab.style.borderBottomColor = tab === 'noProduct' ? activeStyle.borderBottomColor : inactiveStyle.borderBottomColor;
        noProductTab.style.color = tab === 'noProduct' ? activeStyle.color : inactiveStyle.color;
    }
    
    renderMembersList();
}

// 회원 목록 렌더링
let membersData = { expiring: [], expired: [], noProduct: [] };

// 탭에 숫자 표시 업데이트
function updateTabCounts(expiringCount, expiredCount, noProductCount) {
    const expiringTab = document.getElementById('tab-expiring');
    const expiredTab = document.getElementById('tab-expired');
    const noProductTab = document.getElementById('tab-no-product');
    
    if (expiringTab) {
        if (expiringCount > 0) {
            expiringTab.textContent = `만료 임박 (${expiringCount})`;
        } else {
            expiringTab.textContent = '만료 임박';
        }
    }
    
    if (expiredTab) {
        if (expiredCount > 0) {
            expiredTab.textContent = `종료 회원 (${expiredCount})`;
        } else {
            expiredTab.textContent = '종료 회원';
        }
    }
    
    if (noProductTab) {
        if (noProductCount > 0) {
            noProductTab.textContent = `이용권 없음 (${noProductCount})`;
        } else {
            noProductTab.textContent = '이용권 없음';
        }
    }
}

function renderMembersList() {
    const listContainer = document.getElementById('expiring-members-list');
    if (!listContainer) {
        App.warn('expiring-members-list 요소를 찾을 수 없습니다.');
        return;
    }
    
    const members = currentTab === 'expiring' ? membersData.expiring : (currentTab === 'expired' ? membersData.expired : membersData.noProduct);
    const productsKey = currentTab === 'expiring' ? 'expiringProducts' : 'expiredProducts';
    const titleMap = { expiring: '만료 임박 이용권', expired: '종료된 이용권', noProduct: '이용권 없음' };
    const title = titleMap[currentTab] || '이용권';
    const borderColorMap = { expiring: 'var(--warning, #F1C40F)', expired: 'var(--danger, #E74C3C)', noProduct: 'var(--text-muted, #6c757d)' };
    const borderColor = borderColorMap[currentTab] || 'var(--border-color)';
    const emptyMsgMap = { expiring: '만료 임박 회원이', expired: '종료된 회원이', noProduct: '이용권이 없는 회원이' };
    const emptyMsg = emptyMsgMap[currentTab] || '회원이';
    
    if (!members || members.length === 0) {
        listContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 40px;">${emptyMsg} 없습니다.</p>`;
        return;
    }
    
    listContainer.innerHTML = members.map(member => {
        const products = member[productsKey] || [];
        const productsHtml = products.map(product => {
            // 이용권이 없는 경우(NONE)는 '추가 상품 구매'만 표시, 그 외는 연장/재구매/추가 상품 구매
            const isNoProduct = product.id === null || product.productType === 'NONE';
            const hasButtons = !isNoProduct;
            const noProductOnlyButton = isNoProduct ? `
                <div style="display: flex; gap: 8px; margin-left: 12px; flex-wrap: wrap;">
                    <button class="btn btn-sm" onclick="openNewProductModal(${member.id})" style="background-color: var(--info, #17a2b8); color: white; padding: 6px 12px; font-size: 12px;">
                        추가 상품 구매
                    </button>
                </div>
            ` : '';
            const buttonsHtml = hasButtons ? `
                <div style="display: flex; gap: 8px; margin-left: 12px; flex-wrap: wrap;">
                    <button class="btn btn-sm" onclick="openExtendModal(${member.id}, ${product.id}, '${product.productType}', '${product.productName || ''}')" style="background-color: var(--success); color: white; padding: 6px 12px; font-size: 12px;">
                        연장
                    </button>
                    <button class="btn btn-sm" onclick="openRepurchaseModal(${member.id}, ${product.id}, '${product.productType}', '${product.productName || ''}')" style="background-color: var(--accent-primary); color: white; padding: 6px 12px; font-size: 12px;">
                        재구매
                    </button>
                    <button class="btn btn-sm" onclick="openNewProductModal(${member.id})" style="background-color: var(--info, #17a2b8); color: white; padding: 6px 12px; font-size: 12px;">
                        추가 상품 구매
                    </button>
                </div>
            ` : noProductOnlyButton;
            
            return `
                <div style="padding: 8px; margin: 4px 0; background-color: var(--bg-secondary); border-radius: 4px; border-left: 3px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary);">${product.productName || '알 수 없음'}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${product.expiryReason || ''}</div>
                    </div>
                    ${buttonsHtml}
                </div>
            `;
        }).join('');
        
        return `
            <div style="padding: 16px; margin-bottom: 12px; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; border-left: 4px solid ${borderColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                            ${member.name || '이름 없음'} (${member.memberNumber || '-'})
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary);">
                            ${member.phoneNumber || '-'} | ${(App.MemberGrade && App.MemberGrade.getText(member.grade)) || member.grade || '-'} | ${member.school || '-'}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="openMemberDetailFromDashboard(${member.id})" style="margin-left: 12px;">
                        상세보기
                    </button>
                </div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">${title}:</div>
                    ${productsHtml || '<div style="color: var(--text-muted); font-size: 12px;">이용권 정보 없음</div>'}
                </div>
            </div>
        `;
    }).join('');
}

// 만료 임박 및 종료 회원 모달 열기
async function openExpiringMembersModal() {
    const modal = document.getElementById('expiringMembersModal');
    const listContainer = document.getElementById('expiring-members-list');
    
    if (!modal || !listContainer) {
        App.err('만료 임박 회원 모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    modal.style.display = 'flex';
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    currentTab = 'expiring';
    switchTab('expiring');
    
    // 초기 탭 숫자 표시 (로딩 중에는 0으로 표시)
    updateTabCounts(0, 0, 0);
    
    try {
        const response = await App.api.get('/dashboard/expiring-members');
        
        App.log('만료 임박 및 종료 회원 데이터:', response);
        App.log('만료 임박 회원 수:', response.expiring?.length || 0);
        App.log('종료된 회원 수:', response.expired?.length || 0);
        App.log('이용권 없음 회원 수:', response.noProduct?.length || 0);
        
        membersData = {
            expiring: response.expiring || [],
            expired: response.expired || [],
            noProduct: response.noProduct || []
        };
        
        App.log('membersData 설정 완료:', membersData);
        
        // 탭에 숫자 표시 업데이트
        updateTabCounts(membersData.expiring.length, membersData.expired.length, membersData.noProduct.length);
        
        renderMembersList();
    } catch (error) {
        App.err('만료 임박 및 종료 회원 목록 로드 실패:', error);
        listContainer.innerHTML = '<p style="text-align: center; color: var(--danger, #E74C3C); padding: 40px;">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

// 전역에서 접근 가능하도록 window 객체에 즉시 할당
window.openExpiringMembersModal = openExpiringMembersModal;
window.switchTab = switchTab;

// 만료 임박 회원 모달 닫기
function closeExpiringMembersModal() {
    const modal = document.getElementById('expiringMembersModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 전역에서 접근 가능하도록 window 객체에 할당
window.closeExpiringMembersModal = closeExpiringMembersModal;

// 연장/재구매 모달 관련 변수
let extendRepurchaseData = {
    memberId: null,
    memberProductId: null,
    productType: null,
    productName: null,
    action: null // 'extend' or 'repurchase' or 'new'
};

// 연장 모달 열기
async function openExtendModal(memberId, memberProductId, productType, productName) {
    extendRepurchaseData = {
        memberId: memberId,
        memberProductId: memberProductId,
        productType: productType,
        productName: productName,
        action: 'extend'
    };
    
    const modal = document.getElementById('extendRepurchaseModal');
    const title = document.getElementById('extend-repurchase-title');
    const content = document.getElementById('extend-repurchase-content');
    const submitBtn = document.getElementById('extend-repurchase-submit-btn');
    
    title.textContent = '상품 연장';
    submitBtn.textContent = '연장하기';
    
    if (productType === 'COUNT_PASS') {
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">연장할 횟수 *</label>
                <input type="number" id="extend-count" class="form-control" min="1" value="10" required>
                <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                    추가할 횟수를 입력하세요.
                </small>
            </div>
            <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">상품명</div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName || '알 수 없음'}</div>
            </div>
        `;
    } else if (productType === 'MONTHLY_PASS') {
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">연장할 일수 *</label>
                <input type="number" id="extend-days" class="form-control" min="1" value="30" required>
                <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                    추가할 일수를 입력하세요.
                </small>
            </div>
            <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">상품명</div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName || '알 수 없음'}</div>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
}

// 재구매 모달 열기
async function openRepurchaseModal(memberId, memberProductId, productType, productName) {
    extendRepurchaseData = {
        memberId: memberId,
        memberProductId: memberProductId,
        productType: productType,
        productName: productName,
        action: 'repurchase'
    };
    
    const modal = document.getElementById('extendRepurchaseModal');
    const title = document.getElementById('extend-repurchase-title');
    const content = document.getElementById('extend-repurchase-content');
    const submitBtn = document.getElementById('extend-repurchase-submit-btn');
    
    title.textContent = '상품 재구매';
    submitBtn.textContent = '재구매하기';
    
    // 기존 상품 정보 조회
    try {
        const memberProduct = await App.api.get(`/member-products/${memberProductId}`);
        if (!memberProduct) {
            App.err('MemberProduct를 찾을 수 없습니다:', memberProductId);
            return;
        }
        
        const product = memberProduct.product;
        if (!product) {
            App.err('Product 정보를 찾을 수 없습니다:', memberProductId);
            return;
        }
        
        const productName = product.name || '알 수 없음';
        
        if (productType === 'COUNT_PASS') {
            content.innerHTML = `
                <div class="form-group">
                    <label class="form-label">구매할 횟수 *</label>
                    <input type="number" id="repurchase-count" class="form-control" min="1" value="${product.usageCount || 10}" required>
                    <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                        구매할 횟수를 입력하세요.
                    </small>
                </div>
                <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">상품명</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName}</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">가격: ${App.formatCurrency(product.price || 0)}</div>
                </div>
            `;
        } else if (productType === 'MONTHLY_PASS') {
            content.innerHTML = `
                <div class="form-group">
                    <label class="form-label">구매할 기간 (일) *</label>
                    <input type="number" id="repurchase-days" class="form-control" min="1" value="30" required>
                    <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                        구매할 기간을 일수로 입력하세요.
                    </small>
                </div>
                <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">상품명</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName || '알 수 없음'}</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">가격: ${App.formatCurrency(product.price || 0)}</div>
                </div>
            `;
        }
    } catch (error) {
        App.err('상품 정보 조회 실패:', error);
        content.innerHTML = '<p style="color: var(--danger);">상품 정보를 불러오는데 실패했습니다.</p>';
        return;
    }
    
    modal.style.display = 'flex';
}

// 연장/재구매 모달 닫기
function closeExtendRepurchaseModal() {
    const modal = document.getElementById('extendRepurchaseModal');
    if (modal) {
        modal.style.display = 'none';
    }
    extendRepurchaseData = {
        memberId: null,
        memberProductId: null,
        productType: null,
        productName: null,
        action: null
    };
}

// 추가 상품 구매 모달 열기
async function openNewProductModal(memberId) {
    const modal = document.getElementById('newProductPurchaseModal');
    const memberIdInput = document.getElementById('new-product-member-id');
    const productSelect = document.getElementById('new-product-select');
    const coachSelectionContainer = document.getElementById('new-product-coach-selection');
    const totalPriceElement = document.getElementById('new-product-total-price');
    const currentProductsList = document.getElementById('current-member-products-list');
    
    if (!modal || !memberIdInput || !productSelect) {
        App.err('추가 상품 구매 모달 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 회원 ID 설정
    memberIdInput.value = memberId;
    
    // 초기화
    productSelect.innerHTML = '<option value="">로딩 중...</option>';
    coachSelectionContainer.innerHTML = '';
    totalPriceElement.textContent = '₩0';
    if (currentProductsList) {
        currentProductsList.innerHTML = '로딩 중...';
    }
    
    try {
        // 회원 정보 가져오기
        const member = await App.api.get(`/members/${memberId}`);
        App.log('추가 상품 구매 모달 - 회원 정보:', member);
        
        // 현재 회원이 가진 상품 목록 가져오기
        try {
            const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
            if (currentProductsList) {
                if (!memberProducts || memberProducts.length === 0) {
                    currentProductsList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">보유한 상품/이용권이 없습니다.</div>';
                } else {
                    currentProductsList.innerHTML = renderCurrentMemberProducts(memberProducts);
                }
            }
        } catch (error) {
            App.err('현재 보유 상품 목록 로드 실패:', error);
            if (currentProductsList) {
                currentProductsList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">보유 상품 목록을 불러올 수 없습니다.</div>';
            }
        }
        
        // 모든 상품 목록 가져오기
        const allProducts = await App.api.get('/products');
        const activeProducts = allProducts.filter(p => p.active !== false);
        App.log('추가 상품 구매 모달 - 활성 상품 개수:', activeProducts.length);
        
        // 상품 선택 드롭다운 채우기
        productSelect.innerHTML = '<option value="">상품을 선택하세요</option>';
        activeProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} - ${App.formatCurrency(product.price || 0)}`;
            option.dataset.price = product.price || 0;
            option.dataset.category = product.category || '';
            App.log(`상품 추가: ID=${product.id}, name=${product.name}, category=${product.category || '없음'}`);
            productSelect.appendChild(option);
        });
        
        // 상품 선택 시 코치 선택 UI 업데이트 및 총 금액 계산
        productSelect.onchange = async function() {
            await updateNewProductCoachSelection(memberId);
            updateNewProductTotalPrice();
        };
        
        // 모달 열기
        modal.style.display = 'flex';
        
    } catch (error) {
        App.err('추가 상품 구매 모달 열기 실패:', error);
        App.showNotification('상품 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

// 현재 보유 상품 목록 간단 렌더링 (모달용)
function renderCurrentMemberProducts(memberProducts) {
    if (!memberProducts || memberProducts.length === 0) {
        return '<div style="color: var(--text-muted); font-size: 12px;">보유한 상품/이용권이 없습니다.</div>';
    }
    
    const statusText = {
        'ACTIVE': '활성',
        'EXPIRED': '만료',
        'USED_UP': '사용 완료',
        'INACTIVE': '비활성'
    };
    
    const statusColor = {
        'ACTIVE': '#28a745',
        'EXPIRED': '#6c757d',
        'USED_UP': '#dc3545',
        'INACTIVE': '#6c757d'
    };
    
    return memberProducts.map(mp => {
        const product = mp.product || {};
        const productName = product.name || '알 수 없음';
        const status = mp.status || 'UNKNOWN';
        const statusDisplay = statusText[status] || status;
        const statusColorValue = statusColor[status] || '#6c757d';
        
        // 잔여 횟수 계산
        let remaining = mp.remainingCount;
        if (status === 'USED_UP') {
            remaining = 0;
        } else if (remaining === null || remaining === undefined) {
            remaining = product.usageCount || mp.totalCount || 0;
        }
        
        // 만료일 표시
        let expiryText = '';
        if (mp.expiryDate) {
            const expiryDate = new Date(mp.expiryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expiryDate.setHours(0, 0, 0, 0);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
                expiryText = ` (만료됨)`;
            } else if (daysUntilExpiry === 0) {
                expiryText = ` (오늘 만료)`;
            } else {
                expiryText = ` (${daysUntilExpiry}일 후 만료)`;
            }
        }
        
        // 상품 타입에 따라 표시 및 색상 적용
        let detailText = '';
        let detailColor = 'var(--text-secondary)';
        
        if (product.type === 'MONTHLY_PASS' || product.type === 'TIME_PASS') {
            // 기간권 - 만료일까지 남은 일수에 따른 색상 적용
            if (mp.expiryDate) {
                const expiryDate = new Date(mp.expiryDate);
                const formattedDate = `${expiryDate.getFullYear()}. ${String(expiryDate.getMonth() + 1).padStart(2, '0')}. ${String(expiryDate.getDate()).padStart(2, '0')}.`;
                detailColor = getExpiryDateColor(mp.expiryDate);
                detailText = `만료일: ${formattedDate}${expiryText}`;
            }
        } else if (product.type === 'COUNT_PASS') {
            // 횟수권 - 잔여 횟수에 따른 색상 적용
            const total = mp.totalCount || product.usageCount || 0;
            if (remaining === 0 || status === 'USED_UP') {
                detailColor = '#dc3545'; // 빨간색
                detailText = '<span style="color: #dc3545; font-weight: 700;">이용권 마감</span>';
            } else {
                detailColor = getRemainingCountColor(remaining);
                detailText = `잔여: ${remaining}/${total}회`;
            }
        }
        
        return `
            <div style="padding: 8px; margin: 6px 0; background: var(--bg-primary); border-radius: 6px; border-left: 3px solid ${statusColorValue};">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; margin-bottom: 4px;">
                            ${productName}
                        </div>
                        <div style="font-size: 12px; color: ${detailColor}; font-weight: ${remaining === 0 || status === 'USED_UP' ? '700' : '500'};">
                            ${detailText}
                        </div>
                    </div>
                    <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: ${statusColorValue}20; color: ${statusColorValue}; font-weight: 600;">
                        ${statusDisplay}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// 추가 상품 구매 모달의 코치 선택 UI 업데이트
async function updateNewProductCoachSelection(memberId) {
    const productSelect = document.getElementById('new-product-select');
    const coachSelectionContainer = document.getElementById('new-product-coach-selection');
    
    if (!productSelect || !coachSelectionContainer) {
        return;
    }
    
    const selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    App.log('추가 상품 구매 - 선택된 상품 개수:', selectedOptions.length);
    
    // 기존 내용 제거
    coachSelectionContainer.innerHTML = '';
    
    if (selectedOptions.length === 0) {
        return;
    }
    
    // 코치 목록 로드
    let allCoaches = [];
    try {
        allCoaches = await App.api.get('/coaches');
        App.log('추가 상품 구매 - 전체 코치 개수 (필터링 전):', allCoaches.length);
        allCoaches = allCoaches.filter(c => c.active !== false);
        App.log('추가 상품 구매 - 활성 코치 개수:', allCoaches.length);
        
        if (allCoaches.length === 0) {
            App.warn('활성 코치가 없습니다!');
            coachSelectionContainer.innerHTML = '<div style="color: var(--text-muted); padding: 12px;">활성 코치가 없습니다.</div>';
            return;
        }
    } catch (error) {
        App.err('코치 목록 로드 실패:', error);
        coachSelectionContainer.innerHTML = '<div style="color: var(--danger); padding: 12px;">코치 목록을 불러오는데 실패했습니다.</div>';
        return;
    }
    
    // 선택된 상품들의 카테고리 수집
    const selectedProductCategories = new Set();
    selectedOptions.forEach(option => {
        const category = option.dataset.category;
        if (category) {
            selectedProductCategories.add(category);
        }
    });
    
    App.log(`추가 상품 구매 - 전체 코치 개수: ${allCoaches.length}`);
    
    // 각 선택된 상품에 대해 코치 선택 드롭다운 생성
    selectedOptions.forEach((option, index) => {
        const productId = option.value;
        const productName = option.textContent.replace(/^✓ /, '').trim();
        const productCategory = option.dataset.category || '';
        
        App.log(`상품 ${index + 1}: ID=${productId}, name=${productName}, category="${productCategory}"`);
        
        const coachGroup = document.createElement('div');
        coachGroup.className = 'form-group';
        coachGroup.style.marginBottom = '12px';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = `${productName} 담당 코치`;
        
        const select = document.createElement('select');
        select.className = 'form-control product-coach-select';
        select.dataset.productId = productId;
        select.required = false; // 코치는 선택사항
        
        // 기본 옵션
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '코치 선택 (선택사항)';
        select.appendChild(defaultOption);
        
        // 카테고리에 맞는 코치 필터링 (카테고리가 없거나 특기가 없으면 모든 코치 표시)
        let relevantCoaches = allCoaches;
        
        if (productCategory && productCategory.trim() !== '') {
            relevantCoaches = allCoaches.filter(coach => {
                // 특기가 없으면 모두 표시
                if (!coach.specialties || coach.specialties.trim().length === 0) {
                    return true;
                }
                
                // specialties를 소문자로 변환하여 비교 (유연한 매칭)
                const specialtiesLower = coach.specialties.toLowerCase();
                
                // 카테고리와 코치 특기 매칭
                if (productCategory === 'BASEBALL') {
                    return specialtiesLower.includes('baseball') || specialtiesLower.includes('야구');
                } else if (productCategory === 'TRAINING' || productCategory === 'TRAINING_FITNESS') {
                    // 트레이닝 카테고리는 트레이닝 전문 코치만 (필라테스 제외)
                    return (specialtiesLower.includes('training') || specialtiesLower.includes('트레이닝')) &&
                           !specialtiesLower.includes('pilates') && !specialtiesLower.includes('필라테스');
                } else if (productCategory === 'PILATES') {
                    return specialtiesLower.includes('pilates') || specialtiesLower.includes('필라테스');
                }
                
                // 매칭되는 카테고리가 없으면 모든 코치 표시
                return true;
            });
            
            // 필터링 후 코치가 없으면 모든 코치 표시 (안전장치)
            if (relevantCoaches.length === 0) {
                App.warn(`카테고리 "${productCategory}"에 맞는 코치가 없어 모든 코치를 표시합니다.`);
                relevantCoaches = allCoaches;
            }
        } else {
            App.log(`상품 "${productName}"의 카테고리가 없어 모든 코치를 표시합니다.`);
        }
        
        App.log(`상품 "${productName}" (카테고리: ${productCategory || '없음'})에 대한 코치 개수: ${relevantCoaches.length}`);
        
        // 코치 옵션 추가
        if (relevantCoaches.length > 0) {
            relevantCoaches.forEach(coach => {
                const coachOption = document.createElement('option');
                coachOption.value = coach.id;
                coachOption.textContent = coach.name || '이름 없음';
                select.appendChild(coachOption);
            });
        } else {
            App.err(`상품 "${productName}"에 대한 코치가 없습니다!`);
            const noCoachOption = document.createElement('option');
            noCoachOption.value = '';
            noCoachOption.textContent = '코치 없음';
            noCoachOption.disabled = true;
            select.appendChild(noCoachOption);
        }
        
        coachGroup.appendChild(label);
        coachGroup.appendChild(select);
        coachSelectionContainer.appendChild(coachGroup);
    });
}

// 추가 상품 구매 모달의 총 금액 계산
function updateNewProductTotalPrice() {
    const productSelect = document.getElementById('new-product-select');
    const totalPriceElement = document.getElementById('new-product-total-price');
    
    if (!productSelect || !totalPriceElement) {
        return;
    }
    
    const selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    let totalPrice = 0;
    
    selectedOptions.forEach(option => {
        const price = parseInt(option.dataset.price) || 0;
        totalPrice += price;
    });
    
    totalPriceElement.textContent = App.formatCurrency(totalPrice);
}

// 추가 상품 구매 모달 닫기
function closeNewProductPurchaseModal() {
    const modal = document.getElementById('newProductPurchaseModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // 폼 초기화
    const form = document.getElementById('new-product-purchase-form');
    if (form) {
        form.reset();
    }
    
    const coachSelectionContainer = document.getElementById('new-product-coach-selection');
    if (coachSelectionContainer) {
        coachSelectionContainer.innerHTML = '';
    }
    
    const totalPriceElement = document.getElementById('new-product-total-price');
    if (totalPriceElement) {
        totalPriceElement.textContent = '₩0';
    }
}

// 추가 상품 구매 제출
async function submitNewProductPurchase() {
    const memberIdInput = document.getElementById('new-product-member-id');
    const productSelect = document.getElementById('new-product-select');
    
    if (!memberIdInput || !productSelect) {
        App.showNotification('필수 정보가 없습니다.', 'danger');
        return;
    }
    
    const memberId = memberIdInput.value;
    const selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    
    if (selectedOptions.length === 0) {
        App.showNotification('구매할 상품을 선택해주세요.', 'danger');
        return;
    }
    
    const productIds = selectedOptions.map(opt => opt.value);
    
    // 선택된 상품별 코치 정보 수집
    const productCoachMap = {};
    const coachSelects = document.querySelectorAll('#new-product-coach-selection .product-coach-select');
    
    coachSelects.forEach(select => {
        const productId = select.dataset.productId;
        const coachId = select.value;
        
        if (productId && coachId) {
            productCoachMap[productId] = parseInt(coachId);
        }
    });
    
    try {
        let successCount = 0;
        let conflictCount = 0;
        
        // 각 상품 할당
        for (const productId of productIds) {
            try {
                const requestData = { productId: parseInt(productId) };
                
                // 코치가 선택된 경우 추가
                if (productCoachMap[productId]) {
                    requestData.coachId = productCoachMap[productId];
                }
                
                // skipPayment는 false로 설정 (새 구매이므로 결제 생성 필요)
                requestData.skipPayment = false;
                
                await App.api.post(`/members/${memberId}/products`, requestData);
                successCount++;
                App.log(`상품 ID ${productId} 구매 성공`);
            } catch (error) {
                // 409 Conflict: 같은 상품이 이미 있는 경우
                if (error.response && error.response.status === 409) {
                    conflictCount++;
                    App.warn(`상품 ID ${productId}는 이미 구매된 상품입니다.`);
                    // 같은 상품이 있어도 계속 진행 (다른 상품은 구매 가능)
                } else {
                    App.err(`상품 ID ${productId} 구매 실패:`, error);
                    if (error.response && error.response.data && error.response.data.error) {
                        App.showNotification(`상품 구매 실패: ${error.response.data.error}`, 'danger');
                    } else {
                        App.showNotification(`상품 구매에 실패했습니다. (상품 ID: ${productId})`, 'danger');
                    }
                    return; // 하나라도 실패하면 중단
                }
            }
        }
        
        if (successCount > 0) {
            let message = `${successCount}개 상품 구매가 완료되었습니다.`;
            if (conflictCount > 0) {
                message += ` (${conflictCount}개는 이미 구매된 상품입니다)`;
            }
            App.showNotification(message, successCount > 0 && conflictCount === 0 ? 'success' : 'warning');
        } else if (conflictCount > 0) {
            App.showNotification('선택한 상품은 이미 구매된 상품입니다. 연장 기능을 사용해주세요.', 'warning');
        }
        
        closeNewProductPurchaseModal();
        
        // 만료 임박/종료 회원 목록 새로고침 (모달이 열려있으면)
        const expiringMembersModal = document.getElementById('expiringMembersModal');
        if (expiringMembersModal && expiringMembersModal.style.display !== 'none') {
            if (typeof window.openExpiringMembersModal === 'function') {
                await window.openExpiringMembersModal();
            }
        }
        
        // 모달이 열려있으면 목록 새로고침
        if (typeof renderMembersList === 'function') {
            renderMembersList();
        }
        
        // 회원 상세 모달 열기 및 이용권 탭으로 전환
        try {
            const updatedMember = await App.api.get(`/members/${memberId}`);
            currentMemberDetail = updatedMember;
            
            // 회원 상세 모달 열기
            document.getElementById('member-detail-title').textContent = `${updatedMember.name} 상세 정보`;
            const memberDetailModal = document.getElementById('member-detail-modal');
            if (memberDetailModal) {
                memberDetailModal.style.display = 'flex';
            }
            
            // 탭 버튼 클릭 이벤트 리스너 추가 (이미 있으면 스킵)
            document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
                // 기존 리스너가 없으면 추가
                if (!btn.hasAttribute('data-listener-added')) {
                    btn.setAttribute('data-listener-added', 'true');
                    btn.addEventListener('click', function() {
                        const tab = this.getAttribute('data-tab');
                        switchMemberDetailTab(tab, updatedMember);
                    });
                }
            });
            
            // 이용권 탭으로 전환
            switchMemberDetailTab('products', updatedMember);
        } catch (error) {
            App.err('회원 정보 새로고침 실패:', error);
            // 에러가 발생해도 회원 상세 모달 열기 시도
            if (currentMemberDetail) {
                const memberDetailModal = document.getElementById('member-detail-modal');
                if (memberDetailModal) {
                    memberDetailModal.style.display = 'flex';
                }
                switchMemberDetailTab('products', currentMemberDetail);
            }
        }
        
    } catch (error) {
        App.err('추가 상품 구매 실패:', error);
        if (error.response && error.response.data && error.response.data.error) {
            App.showNotification(error.response.data.error, 'danger');
        } else {
            App.showNotification('상품 구매에 실패했습니다.', 'danger');
        }
    }
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', function(event) {
    const newProductModal = document.getElementById('newProductPurchaseModal');
    if (newProductModal && event.target === newProductModal) {
        closeNewProductPurchaseModal();
    }
});

// 연장/재구매 제출
async function submitExtendRepurchase() {
    const { memberId, memberProductId, productType, action } = extendRepurchaseData;
    
    if (!memberId || !action) {
        App.showNotification('필수 정보가 누락되었습니다.', 'danger');
        return;
    }
    
    // 연장의 경우 memberProductId가 필요
    if (action === 'extend' && !memberProductId) {
        App.showNotification('연장할 이용권 정보가 없습니다.', 'danger');
        return;
    }
    
    const submitBtn = document.getElementById('extend-repurchase-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '처리 중...';
    
    try {
        if (action === 'extend') {
            // 연장 처리
            let extendValue;
            if (productType === 'COUNT_PASS') {
                extendValue = parseInt(document.getElementById('extend-count').value);
            } else if (productType === 'MONTHLY_PASS') {
                extendValue = parseInt(document.getElementById('extend-days').value);
            }
            
            if (!extendValue || extendValue <= 0) {
                App.showNotification('연장할 값은 1 이상이어야 합니다.', 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = action === 'extend' ? '연장하기' : '재구매하기';
                return;
            }
            
            const result = await App.api.put(`/member-products/${memberProductId}/extend`, {
                days: extendValue
            });
            
            App.showNotification(result.message || '상품이 연장되었습니다.', 'success');
            closeExtendRepurchaseModal();
            // 모달 새로고침
            await openExpiringMembersModal();
        } else if (action === 'repurchase') {
            // 재구매 처리 - 기존 상품과 동일한 상품으로 새로 구매
            const memberProduct = await App.api.get(`/member-products/${memberProductId}`);
            if (!memberProduct || !memberProduct.product || !memberProduct.product.id) {
                App.err('MemberProduct 또는 Product 정보를 찾을 수 없습니다:', memberProductId);
                App.showNotification('상품 정보를 불러올 수 없습니다.', 'danger');
                return;
            }
            const productId = memberProduct.product.id;
            
            let purchaseData = {
                productId: productId,
                skipPayment: false
            };
            
            if (productType === 'COUNT_PASS') {
                const count = parseInt(document.getElementById('repurchase-count').value);
                purchaseData.count = count;
            } else if (productType === 'MONTHLY_PASS') {
                const days = parseInt(document.getElementById('repurchase-days').value);
                purchaseData.days = days;
            }
            
            const result = await App.api.post(`/members/${memberId}/products`, purchaseData);
            
            App.showNotification('상품이 재구매되었습니다.', 'success');
            closeExtendRepurchaseModal();
            // 모달 새로고침
            await openExpiringMembersModal();
        }
    } catch (error) {
        App.err('연장/재구매 실패:', error);
        let errorMsg = '처리 중 오류가 발생했습니다.';
        if (error.response && error.response.data && error.response.data.error) {
            errorMsg = error.response.data.error;
        }
        App.showNotification(errorMsg, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = action === 'extend' ? '연장하기' : '재구매하기';
    }
}

// 대시보드에서 회원 상세 모달 열기
async function openMemberDetailFromDashboard(memberId) {
    try {
        const member = await App.api.get(`/members/${memberId}`);
        currentMemberDetail = member;
        document.getElementById('member-detail-title').textContent = `${member.name} 상세 정보`;
        
        switchMemberDetailTab('info', member);
        
        const modal = document.getElementById('member-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // 탭 버튼 클릭 이벤트 리스너 추가
        document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
            // 기존 리스너 제거 후 새로 추가
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', function() {
                const tab = this.getAttribute('data-tab');
                switchMemberDetailTab(tab, member);
            });
        });
    } catch (error) {
        App.err('회원 상세 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원 상세 모달 닫기
function closeMemberDetailModal() {
    const modal = document.getElementById('member-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentMemberDetail = null;
}

// 회원 상세 탭 전환
function switchMemberDetailTab(tab, member = null) {
    // 탭 버튼 활성화 상태 업데이트
    document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    
    // member가 전달되지 않았으면 저장된 currentMemberDetail 사용
    if (!member && currentMemberDetail) {
        member = currentMemberDetail;
    }
    
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    
    switch(tab) {
        case 'info':
            content.innerHTML = renderMemberDetailInfo(member);
            break;
        case 'products':
            if (member?.id) {
                loadMemberProductsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'payments':
            if (member?.id) {
                loadMemberPaymentsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'bookings':
            if (member?.id) {
                loadMemberBookingsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'attendance':
            if (member?.id) {
                loadMemberAttendanceForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'product-history':
            if (member?.id) {
                loadMemberProductHistoryForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'stats':
            content.innerHTML = (typeof renderMemberStats === 'function' ? renderMemberStats(member) : '<p style="color: var(--text-muted);">개인 능력치를 불러올 수 없습니다.</p>');
            break;
        case 'memo':
            content.innerHTML = renderMemberMemo(member);
            break;
    }
}

// 회원 상세 기본 정보 렌더링
function renderMemberDetailInfo(member) {
    if (!member) return '<p>로딩 중...</p>';
    const coachDisplay = (window.getMemberCoachDisplayFromProducts && typeof window.getMemberCoachDisplayFromProducts === 'function')
        ? window.getMemberCoachDisplayFromProducts(member)
        : (member.coach?.name || '-');
    return `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">회원번호</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.memberNumber || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">이름</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.name || '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">전화번호</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.phoneNumber || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">등급</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getGradeText(member.grade) || '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">학교/소속</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.school || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">상태</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getStatusText(member.status) || '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">담당 코치</label>
                <div class="form-control" style="background: var(--bg-tertiary); white-space: pre-line; line-height: 1.6;">${coachDisplay}</div>
            </div>
            <div class="form-group">
                <label class="form-label">가입일</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.joinDate ? App.formatDate(member.joinDate) : '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">최근 방문</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.latestLessonDate ? App.formatDate(member.latestLessonDate) : '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">누적 결제</label>
                <div class="form-control" style="background: var(--bg-tertiary); font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(member.totalPayment || 0)}</div>
            </div>
        </div>
    `;
}

// 회원 메모 렌더링
function renderMemberMemo(member) {
    if (!member) return '<p>로딩 중...</p>';
    return `
        <div class="form-group">
            <label class="form-label">코치 메모</label>
            <div class="form-control" style="background: var(--bg-tertiary); min-height: 200px; white-space: pre-wrap; padding: 12px;">${member.memo || '메모가 없습니다.'}</div>
        </div>
    `;
}

// 회원 등급 텍스트 변환
function getGradeText(grade) {
    const gradeMap = {
        'SOCIAL': '사회인',
        'YOUTH': '유소년',
        'ELEMENTARY': '초등부',
        'MIDDLE': '중등부',
        'HIGH': '고등부',
        'ADULT': '성인',
        'OTHER': '기타 종목'
    };
    return gradeMap[grade] || grade || '-';
}

// 회원 상태 텍스트 변환
function getStatusText(status) {
    const statusMap = {
        'ACTIVE': '활성',
        'INACTIVE': '휴면',
        'WITHDRAWN': '탈퇴'
    };
    return statusMap[status] || status || '-';
}

// 남은 횟수에 따른 색상 반환
function getRemainingCountColor(count) {
    // members.js에서 등록된 함수가 있으면 사용, 없으면 직접 구현
    if (typeof window.getRemainingCountColor === 'function' && window.getRemainingCountColor !== getRemainingCountColor) {
        return window.getRemainingCountColor(count);
    }
    // 직접 구현 (무한 재귀 방지)
    if (count >= 1 && count <= 2) {
        return '#dc3545'; // 빨간색 (1~2회)
    } else if (count >= 3 && count <= 5) {
        // CSS 변수 --warning과 동일한 색상 사용 (다크모드: #F1C40F, 라이트모드: #FFC107)
        return getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#F1C40F'; // 노란색 (3~5회)
    } else {
        return '#28a745'; // 초록색 (6회 이상)
    }
}

// 만료일까지 남은 일수에 따른 색상 반환 (members.js의 함수 사용)
function getExpiryDateColor(expiryDate) {
    // window.getExpiryDateColor가 존재하고 현재 함수가 아닌 경우에만 호출
    if (typeof window.getExpiryDateColor === 'function' && window.getExpiryDateColor !== getExpiryDateColor) {
        return window.getExpiryDateColor(expiryDate);
    }
    // fallback
    if (!expiryDate) {
        return 'var(--text-secondary)';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let expiry;
    if (typeof expiryDate === 'string') {
        expiry = new Date(expiryDate);
    } else {
        expiry = new Date(expiryDate);
    }
    
    if (isNaN(expiry.getTime())) {
        return 'var(--text-secondary)';
    }
    
    expiry.setHours(0, 0, 0, 0);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
        return '#DC3545'; // 빨간색 (이미 만료)
    } else if (daysUntilExpiry <= 2) {
        return '#DC3545'; // 빨간색 (2일 이내)
    } else if (daysUntilExpiry <= 5) {
        // CSS 변수 --warning과 동일한 색상 사용 (다크모드: #F1C40F, 라이트모드: #FFC107)
        return getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#F1C40F'; // 노란색 (3~5일)
    } else if (daysUntilExpiry <= 7) {
        // CSS 변수 --warning과 동일한 색상 사용
        return getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#F1C40F'; // 노란색 (6~7일)
    } else {
        return 'var(--accent-primary)'; // 기본 색상 (7일 초과)
    }
}

// 이용권 목록 렌더링 함수 (members.js와 동일한 로직)
function renderProductsListForDashboard(products) {
    if (!products || products.length === 0) {
        return '<p style="color: var(--text-muted);">이용권이 없습니다.</p>';
    }
    return `
        <div class="product-list">
            ${products.map(p => {
                const product = p.product || {};
                const productName = product.name || '알 수 없음';
                
                // remainingCount 계산 (상태가 USED_UP이면 0으로 표시)
                let remaining = p.remainingCount;
                const status = p.status || 'UNKNOWN';
                
                // 상태가 USED_UP이면 잔여 횟수는 0
                if (status === 'USED_UP') {
                    remaining = 0;
                }
                // remainingCount가 null이나 undefined일 때만 대체값 사용 (0은 유효한 값)
                else if (remaining === null || remaining === undefined) {
                    remaining = p.totalCount;
                    if (remaining === null || remaining === undefined) {
                        remaining = product.usageCount;
                    }
                    if (remaining === null || remaining === undefined) {
                        remaining = 0;
                    }
                }
                // remainingCount가 0이면 0으로 유지 (대체값 사용하지 않음)
                remaining = remaining !== null && remaining !== undefined ? remaining : 0;
                
                // totalCount 계산 (totalCount가 null이면 product.usageCount 사용)
                let total = p.totalCount;
                if (total === null || total === undefined || total === 0) {
                    total = product.usageCount;
                }
                total = total !== null && total !== undefined ? total : 0;
                
                const expiryDate = p.expiryDate ? App.formatDate(p.expiryDate) : '-';
                const productId = p.id;
                const isCountPass = product.type === 'COUNT_PASS';
                const isMonthlyPass = product.type === 'MONTHLY_PASS';
                const startDate = p.purchaseDate ? App.formatDate(p.purchaseDate.split('T')[0]) : '-';
                
                // 패키지 항목별 잔여 횟수 표시
                let remainingDisplay = '';
                let displayColor = 'var(--text-secondary)';
                
                if (p.packageItemsRemaining) {
                    try {
                        const packageItems = JSON.parse(p.packageItemsRemaining);
                        const itemsText = packageItems.map(item => `${item.name} ${item.remaining}회`).join(', ');
                        remainingDisplay = `<strong style="color: var(--accent-primary);">[패키지]</strong> ${itemsText}`;
                    } catch (e) {
                        // 횟수권인 경우 색상 적용
                        if (isCountPass) {
                            // 잔여 횟수가 0이면 빨간색으로 "이용권 마감" 표시
                            if (remaining === 0 || status === 'USED_UP') {
                                displayColor = '#dc3545'; // 빨간색
                                remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">이용권 마감</span>';
                            } else {
                                displayColor = getRemainingCountColor(remaining);
                                // total이 0이면 "잔여: X회" 형식으로 표시
                                if (total > 0) {
                                    remainingDisplay = `잔여: ${remaining}/${total}`;
                                } else {
                                    remainingDisplay = `잔여: ${remaining}회`;
                                }
                            }
                        } else {
                            // total이 0이면 "잔여: X회" 형식으로 표시
                            if (total > 0) {
                                remainingDisplay = `잔여: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `잔여: ${remaining}회`;
                            }
                        }
                    }
                } else {
                    // 횟수권인 경우 색상 적용
                    if (isCountPass) {
                        // 잔여 횟수가 0이면 빨간색으로 "이용권 마감" 표시
                        if (remaining === 0 || status === 'USED_UP') {
                            displayColor = '#dc3545'; // 빨간색
                            remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">이용권 마감</span>';
                        } else {
                            displayColor = getRemainingCountColor(remaining);
                            // total이 0이면 "잔여: X회" 형식으로 표시
                            if (total > 0) {
                                remainingDisplay = `잔여: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `잔여: ${remaining}회`;
                            }
                        }
                    } else if (isMonthlyPass && p.expiryDate) {
                        displayColor = getExpiryDateColor(p.expiryDate);
                        // total이 0이면 "잔여: X회" 형식으로 표시
                        if (total > 0) {
                            remainingDisplay = `잔여: ${remaining}/${total}`;
                        } else {
                            remainingDisplay = `잔여: ${remaining}회`;
                        }
                    } else {
                        // total이 0이면 "잔여: X회" 형식으로 표시
                        if (total > 0) {
                            remainingDisplay = `잔여: ${remaining}/${total}`;
                        } else {
                            remainingDisplay = `잔여: ${remaining}회`;
                        }
                    }
                }
                
                // 기간권인 경우 만료일 정보 추가 및 색상 적용
                let periodInfo = '';
                if (isMonthlyPass) {
                    if (p.expiryDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const expiry = new Date(p.expiryDate);
                        expiry.setHours(0, 0, 0, 0);
                        const remainingDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                        
                        if (remainingDays >= 0) {
                            periodInfo = ` | 시작일: ${startDate} | 유효기간: ${expiryDate} (${remainingDays}일 남음)`;
                        } else {
                            periodInfo = ` | 시작일: ${startDate} | 유효기간: ${expiryDate} (만료됨)`;
                        }
                        displayColor = getExpiryDateColor(p.expiryDate);
                    } else {
                        periodInfo = ` | 시작일: ${startDate} | 유효기간: -`;
                    }
                }
                
                // 상태를 한글로 변환
                const statusText = {
                    'ACTIVE': '활성',
                    'EXPIRED': '만료',
                    'USED_UP': '사용 완료',
                    'INACTIVE': '비활성'
                };
                const statusDisplay = statusText[status] || status;
                
                return `
                <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border-color);">
                    <div class="product-info" style="flex: 1;">
                        <div class="product-name" style="font-weight: 600; margin-bottom: 4px;">${productName}</div>
                        <div class="product-detail" style="font-size: 14px; color: ${displayColor}; font-weight: 600;">
                            ${remainingDisplay}${periodInfo}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge badge-${status === 'ACTIVE' ? 'success' : status === 'EXPIRED' ? 'warning' : 'secondary'}">${statusDisplay}</span>
                        ${isCountPass ? `
                            <button class="btn btn-sm btn-secondary" onclick="if(typeof window.openAdjustCountModal==='function'){window.openAdjustCountModal(${productId}, ${remaining});}else if(typeof openAdjustCountModal==='function'){openAdjustCountModal(${productId}, ${remaining});}" title="횟수 조정">
                                조정
                            </button>
                        ` : ''}
                        ${isMonthlyPass ? `
                            <button class="btn btn-sm btn-secondary" onclick="if(typeof window.openEditPeriodPassModal==='function'){window.openEditPeriodPassModal(${productId}, '${p.purchaseDate?.split('T')[0] || ''}', '${p.expiryDate || ''}');}else if(typeof openEditPeriodPassModal==='function'){openEditPeriodPassModal(${productId}, '${p.purchaseDate?.split('T')[0] || ''}', '${p.expiryDate || ''}');}" title="기간 수정">
                                기간 수정
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" onclick="if(typeof window.deleteMemberProduct==='function'){window.deleteMemberProduct(${productId}, '${productName}');}else if(typeof deleteMemberProduct==='function'){deleteMemberProduct(${productId}, '${productName}');}" title="이용권 삭제">
                            삭제
                        </button>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

// 회원 상세 - 이용권 목록 로드
async function loadMemberProductsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    
    try {
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
        
        if (!memberProducts || memberProducts.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">이용권이 없습니다.</p>';
            return;
        }
        
        // dashboard.js의 renderProductsListForDashboard 함수 사용 또는 members.js의 함수 사용
        if (typeof window.renderProductsList === 'function') {
            content.innerHTML = window.renderProductsList(memberProducts);
            if (typeof window.applyCoachNameColors === 'function') {
                window.applyCoachNameColors(content);
            }
        } else {
            content.innerHTML = renderProductsListForDashboard(memberProducts);
        }
    } catch (error) {
        App.err('이용권 목록 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--danger);">이용권 목록을 불러오는데 실패했습니다.</p>';
    }
}

// 회원 상세 - 결제 내역 로드
async function loadMemberPaymentsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    
    try {
        const payments = await App.api.get(`/members/${memberId}/payments`);
        
        if (!payments || payments.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">결제 내역이 없습니다.</p>';
            return;
        }
        
        content.innerHTML = renderPaymentsList(payments);
    } catch (error) {
        App.err('결제 내역 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--danger);">결제 내역을 불러오는데 실패했습니다.</p>';
    }
}

// 결제 내역 목록 렌더링
function renderPaymentsList(payments) {
    if (!payments || payments.length === 0) {
        return '<p style="text-align: center; color: var(--text-muted); padding: 40px;">결제 내역이 없습니다.</p>';
    }
    
    function getPaymentMethodText(method) {
        const methodMap = {
            'CASH': '현금',
            'CARD': '카드',
            'BANK_TRANSFER': '계좌이체',
            'EASY_PAY': '간편결제'
        };
        return methodMap[method] || method || '-';
    }
    
    function getCategoryText(category) {
        const categoryMap = {
            'RENTAL': '대관',
            'LESSON': '레슨',
            'PRODUCT_SALE': '상품판매'
        };
        return categoryMap[category] || category || '-';
    }
    
    function getStatusText(status) {
        const statusMap = {
            'COMPLETED': '완료',
            'PARTIAL': '부분 결제',
            'REFUNDED': '환불'
        };
        return statusMap[status] || status || '-';
    }
    
    function getStatusBadge(status) {
        const badgeMap = {
            'COMPLETED': 'success',
            'PARTIAL': 'warning',
            'REFUNDED': 'danger'
        };
        return badgeMap[status] || 'secondary';
    }
    
    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>결제일시</th>
                        <th>상품명</th>
                        <th>카테고리</th>
                        <th>코치</th>
                        <th>결제방법</th>
                        <th>금액</th>
                        <th>상태</th>
                        <th>메모</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => {
                        const paidAt = p.paidAt ? App.formatDateTime(p.paidAt) : '-';
                        const productName = p.product?.name || '-';
                        const category = getCategoryText(p.category);
                        const method = getPaymentMethodText(p.paymentMethod);
                        const amount = App.formatCurrency(p.amount || 0);
                        const status = getStatusText(p.status);
                        const statusBadge = getStatusBadge(p.status);
                        const memo = p.memo || '-';
                        const refundAmount = p.refundAmount || 0;
                        const coachName = p.coach?.name || '-';
                        
                        return `
                        <tr>
                            <td>${paidAt}</td>
                            <td>${productName}</td>
                            <td>${category}</td>
                            <td>${coachName}</td>
                            <td>${method}</td>
                            <td style="font-weight: 600; color: var(--accent-primary);">
                                ${amount}
                                ${refundAmount > 0 ? `<br><small style="color: var(--danger);">환불: ${App.formatCurrency(refundAmount)}</small>` : ''}
                            </td>
                            <td><span class="badge badge-${statusBadge}">${status}</span></td>
                            <td>${memo}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 회원 상세 - 예약 내역 로드
async function loadMemberBookingsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    
    try {
        const bookings = await App.api.get(`/members/${memberId}/bookings`);
        
        if (!bookings || bookings.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">예약 내역이 없습니다.</p>';
            return;
        }
        
        // members.js의 renderBookingsList와 동일한 형식 사용
        function getBookingStatusText(status) {
            const statusMap = {
                'PENDING': '대기',
                'CONFIRMED': '확정',
                'CANCELLED': '취소',
                'NO_SHOW': '노쇼',
                'COMPLETED': '완료'
            };
            return statusMap[status] || status;
        }
        
        function getBookingStatusBadge(status) {
            const badgeMap = {
                'PENDING': 'warning',
                'CONFIRMED': 'success',
                'CANCELLED': 'secondary',
                'NO_SHOW': 'danger',
                'COMPLETED': 'info'
            };
            return badgeMap[status] || 'secondary';
        }
        
        function renderCoachNamesWithColorsFromText(coachName) {
            if (typeof window.renderCoachNamesWithColorsFromText === 'function') {
                return window.renderCoachNamesWithColorsFromText(coachName);
            }
            return coachName;
        }
        
        const bookingsHtml = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>예약번호</th>
                            <th>상품/이용권</th>
                            <th>코치</th>
                            <th>시설</th>
                            <th>날짜/시간</th>
                            <th>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => {
                            const facilityName = b.facility?.name || b.facilityName || '-';
                            const startTime = b.startTime ? App.formatDateTime(b.startTime) : '-';
                            const status = b.status || 'UNKNOWN';
                            const statusText = getBookingStatusText(status);
                            const statusBadge = getBookingStatusBadge(status);
                            const productName = b.memberProduct?.productName || '-';
                            const coachName = b.coach?.name || b.coachName || '-';
                            const coachDisplay = coachName !== '-' ? renderCoachNamesWithColorsFromText(coachName) : '-';
                            
                            return `
                            <tr>
                                <td>${b.id || '-'}</td>
                                <td>${productName}</td>
                                <td>${coachDisplay}</td>
                                <td>${facilityName}</td>
                                <td>${startTime}</td>
                                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        content.innerHTML = bookingsHtml;
        
        // 코치 이름 색상 적용
        if (typeof window.applyCoachNameColors === 'function') {
            window.applyCoachNameColors(content);
        }
    } catch (error) {
        App.err('예약 내역 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--danger);">예약 내역을 불러오는데 실패했습니다.</p>';
    }
}

// 회원 상세 - 출석 내역 로드
async function loadMemberAttendanceForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    
    try {
        const attendance = await App.api.get(`/members/${memberId}/attendance`);
        
        if (!attendance || attendance.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">출석 내역이 없습니다.</p>';
            return;
        }
        
        // members.js의 renderAttendanceList와 동일한 형식 사용
        function getAttendanceStatusText(status) {
            const statusMap = {
                'PRESENT': '출석',
                'ABSENT': '결석',
                'LATE': '지각',
                'NO_SHOW': '노쇼'
            };
            return statusMap[status] || status;
        }
        
        function getAttendanceStatusBadge(status) {
            const badgeMap = {
                'PRESENT': 'success',
                'ABSENT': 'secondary',
                'LATE': 'warning',
                'NO_SHOW': 'danger'
            };
            return badgeMap[status] || 'secondary';
        }
        
        const attendanceHtml = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>날짜</th>
                            <th>시설</th>
                            <th>체크인 시간</th>
                            <th>체크아웃 시간</th>
                            <th>출석 내용</th>
                            <th>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${attendance.map(a => {
                            const facilityName = a.facility?.name || a.facilityName || '-';
                            const date = a.date ? App.formatDate(a.date) : '-';
                            const checkInTime = a.checkInTime ? App.formatDateTime(a.checkInTime) : (a.status === 'PRESENT' ? '<span style="color: var(--text-muted);">체크인 안 함</span>' : '-');
                            const checkOutTime = a.checkOutTime ? App.formatDateTime(a.checkOutTime) : (a.checkInTime ? '<span style="color: var(--text-muted);">체크아웃 안 함</span>' : '-');
                            const status = a.status || 'UNKNOWN';
                            const statusText = getAttendanceStatusText(status);
                            const statusBadge = getAttendanceStatusBadge(status);
                            
                            // 이용권 정보 표시
                            let productInfo = '-';
                            if (a.productHistory) {
                                const productName = a.productHistory.productName || '이용권';
                                const changeAmount = a.productHistory.changeAmount || 0;
                                const remaining = a.productHistory.remainingCountAfter || 0;
                                if (changeAmount < 0) {
                                    productInfo = `${productName} ${changeAmount} (잔여: ${remaining}회)`;
                                } else {
                                    productInfo = `${productName} +${changeAmount} (잔여: ${remaining}회)`;
                                }
                            } else if (a.booking?.memberProduct) {
                                const productName = a.booking.memberProduct.product?.name || '이용권';
                                productInfo = `${productName} (사용됨)`;
                            }
                            
                            return `
                            <tr>
                                <td>${date}</td>
                                <td>${facilityName}</td>
                                <td>${checkInTime}</td>
                                <td>${checkOutTime}</td>
                                <td>${productInfo}</td>
                                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        content.innerHTML = attendanceHtml;
    } catch (error) {
        App.err('출석 내역 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--danger);">출석 내역을 불러오는데 실패했습니다.</p>';
    }
}

// 회원 상세 - 이용권 히스토리 로드
async function loadMemberProductHistoryForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    
    try {
        const history = await App.api.get(`/members/${memberId}/product-history`);
        
        if (!history || history.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">이용권 히스토리가 없습니다.</p>';
            return;
        }
        
        function getTransactionTypeText(type) {
            const typeMap = {
                'CHARGE': '충전',
                'DEDUCT': '차감',
                'ADJUST': '조정'
            };
            return typeMap[type] || type;
        }
        
        function getTransactionTypeBadge(type) {
            const badgeMap = {
                'CHARGE': 'success',
                'DEDUCT': 'danger',
                'ADJUST': 'warning'
            };
            return badgeMap[type] || 'secondary';
        }
        
        function getBranchDisplay(branch, facilityName) {
            if (facilityName) return facilityName;
            const branchNames = { SAHA: '사하점', YEONSAN: '연산점', RENTAL: '대관' };
            return (branch && branchNames[branch]) ? branchNames[branch] : '-';
        }
        
        const historyHtml = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>예약번호</th>
                            <th>날짜</th>
                            <th>이용권</th>
                            <th>지점</th>
                            <th>유형</th>
                            <th>변경량</th>
                            <th>잔여 횟수</th>
                            <th>설명</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(h => {
                            const bookingId = h.bookingId != null ? h.bookingId : '-';
                            const productName = (h.memberProduct && (h.memberProduct.name || h.memberProduct.product?.name || h.memberProduct.productName)) || '이용권';
                            const branchDisplay = getBranchDisplay(h.branch, h.facilityName);
                            const type = h.type || 'UNKNOWN';
                            const typeText = getTransactionTypeText(type);
                            const typeBadge = getTransactionTypeBadge(type);
                            const changeAmount = h.changeAmount || 0;
                            const remaining = h.remainingCountAfter !== null && h.remainingCountAfter !== undefined ? h.remainingCountAfter : '-';
                            const transactionDate = h.transactionDate ? App.formatDateTime(h.transactionDate) : '-';
                            const description = h.description || '-';
                            
                            return `
                            <tr>
                                <td>${bookingId}</td>
                                <td>${transactionDate}</td>
                                <td>${productName}</td>
                                <td>${branchDisplay}</td>
                                <td><span class="badge badge-${typeBadge}">${typeText}</span></td>
                                <td>${changeAmount > 0 ? '+' : ''}${changeAmount}</td>
                                <td>${remaining !== '-' && remaining !== null && remaining !== undefined ? remaining + '회' : '-'}</td>
                                <td>${description}</td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        content.innerHTML = historyHtml;
    } catch (error) {
        App.err('이용권 히스토리 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--danger);">이용권 히스토리를 불러오는데 실패했습니다.</p>';
    }
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', function(event) {
    const expiringModal = document.getElementById('expiringMembersModal');
    const extendModal = document.getElementById('extendRepurchaseModal');
    const newProductModal = document.getElementById('newProductPurchaseModal');
    const memberDetailModal = document.getElementById('member-detail-modal');
    
    if (event.target === expiringModal) {
        closeExpiringMembersModal();
    }
    if (event.target === extendModal) {
        closeExtendRepurchaseModal();
    }
    if (event.target === newProductModal) {
        closeNewProductPurchaseModal();
    }
    if (event.target === memberDetailModal) {
        closeMemberDetailModal();
    }
});

// 월별 회원 증가 계산
function calculateMonthlyGrowth(members) {
    const labels = [];
    const data = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // 연도가 현재와 다르면 연도 표시
        if (date.getFullYear() !== currentYear) {
            labels.push(`${date.getFullYear()}년 ${date.getMonth() + 1}월`);
        } else {
            labels.push(`${date.getMonth() + 1}월`);
        }
        
        const count = members.filter(m => {
            if (!m.joinDate) return false;
            const joinMonth = m.joinDate.substring(0, 7);
            return joinMonth === monthStr;
        }).length;
        
        data.push(count);
    }
    
    return { labels, data };
}

// 월별 매출 계산
function calculateMonthlyRevenue(payments) {
    const labels = [];
    const data = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // 연도가 현재와 다르면 연도 표시
        if (date.getFullYear() !== currentYear) {
            labels.push(`${date.getFullYear()}년 ${date.getMonth() + 1}월`);
        } else {
            labels.push(`${date.getMonth() + 1}월`);
        }
        
        const revenue = payments
            .filter(p => {
                if (!p.paidAt || p.status !== 'COMPLETED') return false;
                // paidAt은 "2026-01-17T21:35:00" 형식
                const payMonth = p.paidAt.substring(0, 7);
                return payMonth === monthStr;
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        data.push(revenue);
    }
    
    return { labels, data };
}

// 회원 증가 추이 차트 생성
function createMemberChart(data) {
    const ctx = document.getElementById('memberChart');
    if (!ctx) return;
    
    if (memberChart) {
        memberChart.destroy();
    }
    
    const isDark = !document.body.classList.contains('light-mode');
    const values = data.data;
    const maxValue = values.length ? Math.max(...values) : 0;
    const maxIndex = maxValue > 0 ? values.indexOf(maxValue) : -1;
    const pointBg = values.map((_, i) => i === maxIndex ? '#f0c000' : '#5E6AD2');
    const pointBorder = values.map((_, i) => i === maxIndex ? '#f0c000' : '#5E6AD2');
    const pointRadius = values.map((_, i) => i === maxIndex ? 4 : 2.5);
    
    const hideChartNumbers = typeof dashboardShouldHideNumbers === 'function' && dashboardShouldHideNumbers();
    memberChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: '신규 가입',
                data: data.data,
                borderColor: '#5E6AD2',
                backgroundColor: 'rgba(94, 106, 210, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                segment: {
                    borderColor: function(ctx) {
                        const y0 = ctx.p0.parsed.y;
                        const y1 = ctx.p1.parsed.y;
                        return y1 > y0 ? '#f0c000' : '#5E6AD2';
                    },
                    backgroundColor: function(ctx) {
                        const y0 = ctx.p0.parsed.y;
                        const y1 = ctx.p1.parsed.y;
                        return y1 > y0 ? 'rgba(240, 192, 0, 0.2)' : 'rgba(94, 106, 210, 0.1)';
                    }
                },
                pointBackgroundColor: pointBg,
                pointBorderColor: pointBorder,
                pointBorderWidth: 1.5,
                pointRadius: pointRadius,
                pointHoverRadius: values.map((_, i) => i === maxIndex ? 6 : 4)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: !hideChartNumbers,
                    backgroundColor: isDark ? '#1C2130' : '#FFFFFF',
                    titleColor: isDark ? '#E6E8EB' : '#212529',
                    bodyColor: isDark ? '#A1A6B3' : '#495057',
                    borderColor: isDark ? '#2D3441' : '#DEE2E6',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDark ? '#6B7280' : '#6C757D',
                        stepSize: 1,
                        callback: hideChartNumbers ? function() { return ''; } : undefined
                    },
                    grid: {
                        color: isDark ? '#2D3441' : '#DEE2E6'
                    }
                },
                x: {
                    ticks: {
                        color: isDark ? '#6B7280' : '#6C757D'
                    },
                    grid: {
                        color: isDark ? '#2D3441' : '#DEE2E6'
                    }
                }
            }
        }
    });
}

// 월별 매출 차트 생성
function createRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    const isDark = !document.body.classList.contains('light-mode');
    const values = data.data;
    const maxValue = values.length ? Math.max(...values) : 0;
    const maxIndex = maxValue > 0 ? values.indexOf(maxValue) : -1;
    const defaultBg = 'rgba(94, 106, 210, 0.8)';
    const defaultBorder = '#5E6AD2';
    const maxBg = 'rgba(240, 192, 0, 0.9)';
    const maxBorder = '#f0c000';
    const backgroundColor = values.map((_, i) => i === maxIndex ? maxBg : defaultBg);
    const borderColor = values.map((_, i) => i === maxIndex ? maxBorder : defaultBorder);
    
    const hideChartNumbers = typeof dashboardShouldHideNumbers === 'function' && dashboardShouldHideNumbers();
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: '매출',
                data: data.data,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 50  // 막대 최대 폭 제한 (픽셀)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: !hideChartNumbers,
                    backgroundColor: isDark ? '#1C2130' : '#FFFFFF',
                    titleColor: isDark ? '#E6E8EB' : '#212529',
                    bodyColor: isDark ? '#A1A6B3' : '#495057',
                    borderColor: isDark ? '#2D3441' : '#DEE2E6',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return '매출: ₩' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDark ? '#6B7280' : '#6C757D',
                        callback: hideChartNumbers ? function() { return ''; } : function(value) {
                            return '₩' + (value / 10000).toFixed(0) + '만';
                        }
                    },
                    grid: {
                        color: isDark ? '#2D3441' : '#DEE2E6'
                    }
                },
                x: {
                    ticks: {
                        color: isDark ? '#6B7280' : '#6C757D'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// MemberProduct 기반 월별 매출 계산
async function calculateMonthlyRevenueFromMemberProducts() {
    const labels = [];
    const data = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    try {
        // 모든 회원 조회
        const members = await App.api.get('/members');
        
        // 각 회원의 MemberProduct 정보를 가져와서 월별 매출 계산
        const monthlyRevenueMap = new Map();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // 연도가 현재와 다르면 연도 표시
            if (date.getFullYear() !== currentYear) {
                labels.push(`${date.getFullYear()}년 ${date.getMonth() + 1}월`);
            } else {
                labels.push(`${date.getMonth() + 1}월`);
            }
            
            monthlyRevenueMap.set(monthStr, 0);
        }
        
        // 각 회원의 MemberProduct에서 월별 매출 계산
        for (const member of members) {
            if (member.memberProducts && Array.isArray(member.memberProducts)) {
                for (const mp of member.memberProducts) {
                    if (mp.purchaseDate && mp.product && mp.product.price) {
                        // purchaseDate는 "2026-01-24T13:00:00" 형식
                        const purchaseMonth = mp.purchaseDate.substring(0, 7);
                        if (monthlyRevenueMap.has(purchaseMonth)) {
                            const currentRevenue = monthlyRevenueMap.get(purchaseMonth);
                            monthlyRevenueMap.set(purchaseMonth, currentRevenue + (mp.product.price || 0));
                        }
                    }
                }
            }
        }
        
        // 월별 매출 데이터 생성
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            data.push(monthlyRevenueMap.get(monthStr) || 0);
        }
        
    } catch (error) {
        App.err('MemberProduct 기반 월별 매출 계산 실패:', error);
        // 오류 시 빈 데이터 반환
        for (let i = 5; i >= 0; i--) {
            data.push(0);
        }
    }
    
    return { labels, data };
}
