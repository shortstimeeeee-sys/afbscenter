// \uB300\uC2DC\uBCF4\uB4DC \uD398\uC774\uC9C0 JavaScript

let memberChart = null;
let revenueChart = null;
// currentMemberDetail — members.js \uC5D0\uC11C var \uC120\uC5B8 (index.html: members.js \u2192 dashboard.js \uC21C\uC11C)

/** ??????(FRONT)? ?? KPI??? ?? ?? */
function dashboardShouldHideNumbers() {
    const role = (App.currentRole || '').toUpperCase();
    return role === 'COACH' || role === 'FRONT';
}

/** ???? ??: ?? ??? ?? */
function applyExportCrop() {
    var exportId = window.__dashboardExportId;
    if (!exportId) return;
    var el = document.getElementById(exportId);
    var contentArea = document.querySelector('.content-area');
    if (!el || !contentArea) return;

    var children = contentArea.children;
    for (var i = 0; i < children.length; i++) {
        children[i].style.display = 'none';
    }
    var directChild = el;
    while (directChild.parentElement && directChild.parentElement !== contentArea) {
        directChild = directChild.parentElement;
    }
    directChild.style.display = '';
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
        // ???? ??: ?export=id ? ???? ?? (iframe ???)
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

        App.log('???? ???');
        
        const kpiModalEl = document.getElementById('kpi-detail-modal');
        if (kpiModalEl) {
            kpiModalEl.addEventListener('click', function(e) {
                if (e.target === kpiModalEl) closeKpiDetailModal();
            });
        }
        const nonMemberModalEl = document.getElementById('non-member-bookings-modal');
        if (nonMemberModalEl) {
            nonMemberModalEl.addEventListener('click', function(e) {
                if (e.target === nonMemberModalEl) closeNonMemberBookingsModal();
            });
        }
        document.querySelectorAll('.kpi-card-clickable[data-kpi]').forEach(function(card) {
            card.addEventListener('click', function() {
                const type = this.getAttribute('data-kpi');
                if (type && typeof openKpiDetailModal === 'function') {
                    openKpiDetailModal(type);
                }
            });
        });
        
        const expiringMembersCard = document.getElementById('expiring-members-card');
        if (expiringMembersCard) {
            expiringMembersCard.addEventListener('click', function() {
                if (typeof openExpiringMembersModal === 'function') {
                    openExpiringMembersModal();
                } else if (typeof window.openExpiringMembersModal === 'function') {
                    window.openExpiringMembersModal();
                } else {
                    App.err('openExpiringMembersModal ?(?) ?? ? ????.');
                }
            });
        }
        
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
        const tabApproval = document.getElementById('tab-approval');
        if (tabApproval) {
            tabApproval.addEventListener('click', function() {
                if (typeof switchTab === 'function') {
                    switchTab('approval');
                } else if (typeof window.switchTab === 'function') {
                    window.switchTab('approval');
                }
            });
        }
        
        try {
            await loadDashboardData();
        } catch (error) {
            App.err('???? ??? ?? ??:', error);
        }
        
        try {
            await initCharts();
        } catch (error) {
            App.err('?? ??? ??:', error);
        }

        if (window.__dashboardExportId) {
            setTimeout(applyExportCrop, 100);
        }

        var openMemberAp = new URLSearchParams(window.location.search).get('openMemberApprovals');
        if ((openMemberAp === '1' || openMemberAp === 'true') && !window.__dashboardExportId) {
            try {
                if (typeof openExpiringMembersModal === 'function') {
                    await openExpiringMembersModal('approval');
                }
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
                }
            } catch (openApErr) {
                App.warn('openMemberApprovals', openApErr);
            }
        }
        
        App.log('???? ??? ??');
    } catch (error) {
        App.err('???? ??? ??:', error);
        App.err('?? ??:', error.message, error.stack);
        
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification('????? ???? ? ??? ??????. ???? ????? ???.', 'danger');
        }
    }
});

async function loadDashboardData() {
    try {
        var exportId = window.__dashboardExportId;
        App.log('???? ??? ??', exportId ? '(export: ' + exportId + ')' : '');

        if (exportId === 'export-announcements') {
            try {
                const announcements = await App.api.get('/dashboard/announcements');
                renderActiveAnnouncements(announcements);
            } catch (error) {
                App.err('???? ?? ??:', error);
            }
            App.log('???? ??? ?? ?? (???)');
            return;
        }
        if (exportId === 'export-today-schedule') {
            try {
                const schedule = await App.api.get('/dashboard/today-schedule');
                renderTodaySchedule(schedule);
            } catch (error) {
                App.err('?? ?? ?? ??:', error);
            }
            App.log('???? ??? ?? ?? (???)');
            return;
        }
        if (exportId === 'export-member-chart' || exportId === 'export-revenue-chart') {
            App.log('???? ??? ?? ?? (??? initCharts??)');
            return;
        }

        const [kpiData, schedule, alerts, announcements] = await Promise.all([
            App.api.get('/dashboard/kpi'),
            exportId ? null : App.api.get('/dashboard/today-schedule').catch(function(e) { App.err('?? ?? ?? ??:', e); return []; }),
            exportId ? null : App.api.get('/dashboard/alerts').catch(function(e) { App.err('??? ?? ?? ??:', e); return []; }),
            exportId ? null : App.api.get('/dashboard/announcements').catch(function(e) { App.err('???? ?? ??:', e); return []; })
        ]);
        App.log('KPI ?? ???:', kpiData);
        
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                App.warn(`DOM ??? ?? ? ??: ${id}`);
            }
        };
        
        const hideRevenueOnly = dashboardShouldHideNumbers();

        updateElement('kpi-total-members', kpiData.totalMembers || 0);
        updateElement('kpi-monthly-new-members', kpiData.monthlyNewMembers || 0);
        updateElement('kpi-new-members', kpiData.newMembers || 0);
        
        const todayBookings = kpiData.bookings || 0;
        const yesterdayBookings = kpiData.yesterdayBookings || 0;
        updateElement('kpi-bookings', todayBookings);
        
        const bookingsChangeElement = document.getElementById('kpi-bookings-change');
        if (bookingsChangeElement) {
            if (yesterdayBookings === 0) {
                if (todayBookings === 0) {
                    bookingsChangeElement.textContent = '\uC5B4\uC81C 0\uAC74';
                    bookingsChangeElement.className = 'kpi-change';
                } else {
                    bookingsChangeElement.textContent = '\uC804\uC77C 0\uAC74 \uB300\uBE44 \uC99D\uAC00';
                    bookingsChangeElement.className = 'kpi-change positive';
                }
            } else {
                const percentage = ((todayBookings - yesterdayBookings) / yesterdayBookings) * 100;
                const percentageText = percentage >= 0 ? `+${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`;
                bookingsChangeElement.textContent = `${percentageText} \uC804\uC77C \uB300\uBE44`;
                bookingsChangeElement.className = percentage >= 0 ? 'kpi-change positive' : 'kpi-change negative';
            }
        }
        
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
                    revenueChangeElement.textContent = '\uC5B4\uC81C 0\uC6D0';
                    revenueChangeElement.className = 'kpi-change';
                } else {
                    revenueChangeElement.textContent = '\uC804\uC77C 0\uC6D0 \uB300\uBE44 \uC99D\uAC00';
                    revenueChangeElement.className = 'kpi-change positive';
                }
            } else {
                const percentage = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
                const percentageText = percentage >= 0 ? `+${percentage.toFixed(1)}%` : `${percentage.toFixed(1)}%`;
                revenueChangeElement.textContent = `${percentageText} \uC804\uC77C \uB300\uBE44`;
                revenueChangeElement.className = percentage >= 0 ? 'kpi-change positive' : 'kpi-change negative';
            }
        }
        
        updateElement('kpi-monthly-revenue', hideRevenueOnly ? '-' : App.formatCurrency(kpiData.monthlyRevenue || 0));
        
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
        if (monthLabelEl) monthLabelEl.textContent = currentMonth + '\uC6D4 \uCD1D \uC608\uC57D \uAC74\uC218';
        var totalMembers = kpiData.totalMembers != null ? Number(kpiData.totalMembers) : 0;
        var perMember = totalMembers > 0 ? (totalBookingsMonth / totalMembers) : 0;
        var perMemberStr = totalMembers > 0 ? (Math.round(perMember * 10) / 10).toFixed(1) : '0';
        var valueEl = document.getElementById('kpi-total-bookings-month');
        if (valueEl) valueEl.innerHTML = totalBookingsMonth + '<span class="kpi-change positive" style="margin-left: 0.25em;">(\uD68C\uC6D0 1\uBA85\uB2F9 \uD3C9\uADE0 ' + perMemberStr + '\uAC74)</span>';
        const branchEl = document.getElementById('kpi-bookings-by-branch');
        if (branchEl) branchEl.textContent = '\uC0AC\uD558 ' + saha + ' (\uBE44\uD68C\uC6D0 ' + sahaNonMember + ') / \uC5F0\uC0B0 ' + yeonsan + ' (\uBE44\uD68C\uC6D0 ' + yeonsanNonMember + ') / \uB300\uAD00 ' + rental + ' (\uBE44\uD68C\uC6D0 ' + rentalNonMember + ')';
        
        const expiringMembers = kpiData.expiringMembers || 0;
        const expiredMembers = kpiData.expiredMembers || 0;
        const pendingApprovals = kpiData.pendingMemberApprovals != null ? Number(kpiData.pendingMemberApprovals) : 0;
        const totalCount = expiringMembers + expiredMembers + pendingApprovals;
        
        App.log('?? ????? ?? ?:', {
            expiringMembers,
            expiredMembers,
            pendingApprovals,
            totalCount,
            kpiData: kpiData
        });
        
        updateElement('kpi-expiring-members', totalCount);
        
        const changeElement = document.getElementById('kpi-member-mgmt-sub');
        if (changeElement && changeElement.classList.contains('kpi-change')) {
            // \uC2B9\uC778 \uB300\uAE30·\uB9CC\uB8CC \uC784\uBC15·\uC885\uB8CC \uBAA8\uB450 \uD45C\uC2DC (\uD0ED \uC21C\uC11C\uC640 \uB3D9\uC77C)
            let detailText = '';
            if (totalCount === 0) {
                detailText = '\uC2B9\uC778 \uB300\uAE30 0\uAC74, \uB9CC\uB8CC \uC784\uBC15 0\uBA85, \uC885\uB8CC 0\uBA85';
            } else {
                detailText =
                    '\uC2B9\uC778 \uB300\uAE30 ' + pendingApprovals + '\uAC74, ' +
                    '\uB9CC\uB8CC \uC784\uBC15 ' + expiringMembers + '\uBA85, ' +
                    '\uC885\uB8CC ' + expiredMembers + '\uBA85';
            }
            changeElement.textContent = detailText;
            changeElement.style.color = 'var(--warning, #F1C40F)';
            changeElement.style.fontWeight = '700';
        }
        
        if (totalCount > 0) {
            const expiringCard = document.getElementById('kpi-expiring-members')?.parentElement;
            if (expiringCard) {
                expiringCard.style.borderLeft = pendingApprovals > 0
                    ? '3px solid var(--accent-primary, #3498db)'
                    : '3px solid var(--warning, #F1C40F)';
            }
        }
        
        if (!exportId) {
            if (schedule != null) renderTodaySchedule(schedule);
            if (alerts != null) renderPendingAlerts(alerts);
            if (announcements != null) renderActiveAnnouncements(announcements);
        }
        
        App.log('loadDashboardData ok');
        
    } catch (error) {
        App.err('loadDashboardData', error);
        App.err('stack', error.message, error.stack);
        
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
        updateElement('kpi-revenue', typeof App !== 'undefined' && App.formatCurrency ? App.formatCurrency(0) : ('\u20A9' + '0'));
        updateElement('kpi-monthly-revenue', typeof App !== 'undefined' && App.formatCurrency ? App.formatCurrency(0) : ('\u20A9' + '0'));
        updateElement('kpi-avg-revenue-per-member', typeof App !== 'undefined' && App.formatCurrency ? App.formatCurrency(0) : ('\u20A9' + '0'));
        updateElement('kpi-expiring-members', '0');
        const changeElementFallback = document.getElementById('kpi-member-mgmt-sub');
        if (changeElementFallback && changeElementFallback.classList.contains('kpi-change')) {
            changeElementFallback.textContent = '\uD655\uC778 \uD544\uC694';
            changeElementFallback.style.color = 'var(--warning, #F1C40F)';
            changeElementFallback.style.fontWeight = '700';
        }
        
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification('\uB300\uC2DC\uBCF4\uB4DC \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD574 \uC8FC\uC138\uC694.', 'danger');
        }
    }
}

// ========== KPI detail modal ==========
let kpiDetailCurrentType = null;

function openKpiDetailModal(type) {
    kpiDetailCurrentType = type;
    const modal = document.getElementById('kpi-detail-modal');
    const titleEl = document.getElementById('kpi-detail-modal-title');
    const contentEl = document.getElementById('kpi-detail-content');
    const actionBtn = document.getElementById('kpi-detail-action-btn');
    if (!modal || !titleEl || !contentEl) return;
    const modalBox = modal.querySelector('.modal');
    if (modalBox) {
        if (type === 'monthly-revenue') {
            modalBox.style.maxWidth = 'min(1120px, 96vw)';
            modalBox.style.width = '96vw';
        } else {
            modalBox.style.maxWidth = '900px';
            modalBox.style.width = '';
        }
    }
    const currentMonth = new Date().getMonth() + 1;
    const titles = {
        'total-members': '\uCD1D \uD68C\uC6D0 \uC218',
        'monthly-new-members': '\uC6D4 \uAC00\uC785 \uC218 (\uC774\uBC88 \uB2EC)',
        'new-members': '\uC624\uB298 \uAC00\uC785 \uC218',
        'bookings': '\uC624\uB298 \uC608\uC57D \uC218',
        'revenue': '\uC624\uB298 \uB9E4\uCD9C',
        'monthly-revenue': '\uC6D4 \uB9E4\uCD9C (\uC774\uBC88 \uB2EC)',
        'total-bookings-month': currentMonth + '\uC6D4 \uCD1D \uC608\uC57D \uAC74\uC218'
    };
    titleEl.textContent = titles[type] || '\uC0C1\uC138';
    contentEl.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uB85C\uB529 \uC911...</p>';
    actionBtn.style.display = 'none';
    actionBtn.onclick = kpiDetailActionClick;
    if (modal) {
        if (type === 'monthly-revenue') modal.classList.add('kpi-detail-modal--monthly-revenue');
        else modal.classList.remove('kpi-detail-modal--monthly-revenue');
    }
    modal.style.display = 'flex';
    loadKpiDetail(type);
}

function closeKpiDetailModal() {
    const modal = document.getElementById('kpi-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('kpi-detail-modal--monthly-revenue');
        const modalBox = modal.querySelector('.modal');
        if (modalBox) {
            modalBox.style.maxWidth = '900px';
            modalBox.style.width = '';
        }
    }
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
    titleEl.textContent = monthNum + '\uC6D4 ' + branchLabel + ' \uBE44\uD68C\uC6D0 \uC608\uC57D \uB0B4\uC5ED';
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
        var branchText = { SAHA: '\uC0AC\uD558', YEONSAN: '\uC5F0\uC0B0', RENTAL: '\uB300\uC5EC' };
        var statusBadgeFn = (App.Status && App.Status.booking && App.Status.booking.getBadge) ? function(s) { return App.Status.booking.getBadge(s); } : function() { return 'info'; };
        var statusTextFn = (App.Status && App.Status.booking && App.Status.booking.getText) ? function(s) { return App.Status.booking.getText(s); } : function(s) { return s; };
        function coachCellHtml(coachName) {
            if (!coachName || !String(coachName).trim()) return '';
            var name = String(coachName).trim();
            var color = (App.CoachColors && App.CoachColors.getColor) ? App.CoachColors.getColor({ name: name }) : null;
            if (!color) color = 'var(--text-primary)';
            return '<span class="coach-name" style="color:' + color + ';font-weight:600;">' + (App.escapeHtml ? App.escapeHtml(name) : name) + '</span>';
        }
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
            var coach = b.coachName || '';
            var coachHtml = coach ? coachCellHtml(coach) : '';
            var statusKey = (b.status || '').toUpperCase();
            var badge = statusBadgeFn(statusKey);
            var statusLabel = statusTextFn(statusKey);
            var statusHtml = '<span class="badge badge-' + badge + '">' + (App.escapeHtml ? App.escapeHtml(statusLabel) : statusLabel) + '</span>';
            tbody.insertAdjacentHTML('beforeend', '<tr><td>' + (App.escapeHtml ? App.escapeHtml(dateTimeStr) : dateTimeStr) + '</td><td class="cell-facility">' + (App.escapeHtml ? App.escapeHtml(facilityName) : facilityName) + '</td><td>' + (App.escapeHtml ? App.escapeHtml(br) : br) + '</td><td>' + (App.escapeHtml ? App.escapeHtml(name) : name) + '</td><td>' + (App.escapeHtml ? App.escapeHtml(phone) : phone) + '</td><td class="cell-coach">' + coachHtml + '</td><td class="cell-status">' + statusHtml + '</td></tr>');
        });
        tableWrap.style.display = 'block';
    }).catch(function(err) {
        App.err('\uBE44\uD68C\uC6D0 \uC608\uC57D \uC870\uD68C \uC624\uB958:', err);
        loadingEl.style.display = 'none';
        emptyEl.textContent = '\uC608\uC57D \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.';
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
            actionBtn.textContent = '\uD68C\uC6D0 \uBAA9\uB85D';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'bookings') {
            const params = new URLSearchParams({ start: startOfTodayISO, end: endOfTodayISO });
            const bookings = await App.api.get('/bookings?' + params.toString());
            const list = Array.isArray(bookings) ? bookings : [];
            contentEl.innerHTML = renderBookingsDetail(list);
            actionBtn.textContent = '\uC608\uC57D \uD398\uC774\uC9C0 \uC774\uB3D9';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'revenue') {
            const payments = await App.api.get('/payments?startDate=' + todayStr + '&endDate=' + todayStr);
            const list = (Array.isArray(payments) ? payments : []).filter(function(p) { return p.member != null && p.member.id != null; });
            contentEl.innerHTML = renderPaymentsDetail(list, '\uC624\uB298');
            actionBtn.textContent = '\uACB0\uC81C \uB0B4\uC5ED';
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
            let html = '<p style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);">' + monthNum + '\uC6D4(1\uC77C~\uD604\uC7AC) \uB204\uC801 \uC608\uC57D \uAC74\uC218\uC785\uB2C8\uB2E4. \uC9C0\uC810\uBCC4 \uD604\uD669\uC744 \uD655\uC778\uD574 \uBCF4\uC138\uC694.</p>';
            html += '<p style="margin-bottom: 12px; font-size: 14px; font-weight: 600;">\uCD1D \uD68C\uC6D0 <strong>' + totalMembersModal + '\uBA85</strong> \uAE30\uC900 1\uBA85\uB2F9 \uD3C9\uADE0 <strong>' + perMemberStrModal + '\uAC74</strong></p>';
            html += '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
            html += '<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 12px 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);"><a href="/bookings.html" style="text-decoration: none; color: var(--text-primary); font-weight: 600;"><span style="color: var(--text-secondary); margin-right: 6px;">\uC0AC\uD558 \uC608\uC57D</span>' + saha + '\uAC74</a> <span class="non-member-link" role="button" tabindex="0" data-branch="SAHA" data-label="\uC0AC\uD558" data-start="' + startISO + '" data-end="' + endISO + '" style="color: var(--primary); cursor: pointer; text-decoration: underline;">(\uBE44\uD68C\uC6D0 ' + sahaNonMember + ')</span></span>';
            html += '<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 12px 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);"><a href="/bookings-yeonsan.html" style="text-decoration: none; color: var(--text-primary); font-weight: 600;"><span style="color: var(--text-secondary); margin-right: 6px;">\uC5F0\uC0B0 \uC608\uC57D</span>' + yeonsan + '\uAC74</a> <span class="non-member-link" role="button" tabindex="0" data-branch="YEONSAN" data-label="\uC5F0\uC0B0" data-start="' + startISO + '" data-end="' + endISO + '" style="color: var(--primary); cursor: pointer; text-decoration: underline;">(\uBE44\uD68C\uC6D0 ' + yeonsanNonMember + ')</span></span>';
            html += '<span style="display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 12px 20px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border-color);"><a href="/rentals.html" style="text-decoration: none; color: var(--text-primary); font-weight: 600;"><span style="color: var(--text-secondary); margin-right: 6px;">\uB300\uC5EC \uC608\uC57D</span>' + rental + '\uAC74</a> <span class="non-member-link" role="button" tabindex="0" data-branch="RENTAL" data-label="\uB300\uC5EC" data-start="' + startISO + '" data-end="' + endISO + '" style="color: var(--primary); cursor: pointer; text-decoration: underline;">(\uBE44\uD68C\uC6D0 ' + rentalNonMember + ')</span></span>';
            html += '</div>';
            html += '<p style="margin-top: 16px; font-size: 13px; color: var(--text-muted);">\uCD1D <strong>' + total + '</strong>\uAC74 (\uC0AC\uD558 ' + saha + ' + \uC5F0\uC0B0 ' + yeonsan + ' + \uB300\uC5EC ' + rental + ')</p>';
            contentEl.innerHTML = html;
            contentEl.querySelectorAll('.non-member-link').forEach(function(span) {
                function openNonMember() {
                    openNonMemberBookingsModal(span.getAttribute('data-branch'), span.getAttribute('data-label'), span.getAttribute('data-start'), span.getAttribute('data-end'));
                }
                span.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); openNonMember(); });
                span.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNonMember(); } });
            });
            actionBtn.textContent = '\uC608\uC57D \uD398\uC774\uC9C0 \uC774\uB3D9';
            actionBtn.style.display = 'inline-block';
        } else if (type === 'monthly-revenue') {
            const [kpiData, payments] = await Promise.all([
                App.api.get('/dashboard/kpi'),
                App.api.get('/payments?period=month')
            ]);
            const list = (Array.isArray(payments) ? payments : []).filter(function(p) { return p.member != null && p.member.id != null; });
            var kpiTotal = kpiData && kpiData.monthlyRevenue != null ? Number(kpiData.monthlyRevenue) : null;
            var kpiCnt = kpiData && kpiData.monthlyRevenuePaymentCount != null ? Number(kpiData.monthlyRevenuePaymentCount) : null;
            contentEl.innerHTML = renderMonthlyRevenueDetail(list, '\uC774\uBC88 \uB2EC', kpiTotal, kpiCnt);
            actionBtn.textContent = '\uACB0\uC81C \uB0B4\uC5ED';
            actionBtn.style.display = 'inline-block';
        }
    } catch (err) {
        App.err('KPI \uC0C1\uC138 \uB85C\uB4DC \uC624\uB958:', err);
        contentEl.innerHTML = '<p style="text-align: center; color: var(--danger);">\uC0C1\uC138 \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.</p>';
        if (actionBtn) actionBtn.style.display = 'none';
    }
}

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
    var map = { 'ACTIVE': '\uD65C\uC131', 'INACTIVE': '\uBE44\uD65C\uC131', 'WITHDRAWN': '\uD0C8\uD1F4' };
    return map[s] || status;
}

function renderMembersDetail(members, type) {
    const gradeText = function(g) {
        if (!g) return '-';
        return App.MemberGrade && App.MemberGrade.getText ? App.MemberGrade.getText(g) : g;
    };
    if (!members || members.length === 0) {
        return '<p style="color: var(--text-muted);">\uD574\uB2F9 \uC870\uAC74\uC5D0 \uB9DE\uB294 \uD68C\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    let summary = '';
    if (type === 'total-members') {
        const byGrade = {};
        members.forEach(function(m) {
            const g = m.grade || 'OTHER';
            byGrade[g] = (byGrade[g] || 0) + 1;
        });
        summary = '<p style="margin-bottom: 14px; font-size: 13px; color: var(--text-secondary);">\uB4F1\uAE09\uBCC4: </p><div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">' +
            Object.keys(byGrade).map(function(g) {
                var badgeClass = getGradeBadgeClass(g);
                return '<span class="badge badge-' + badgeClass + '" style="padding: 6px 12px; font-size: 13px;">' + gradeText(g) + ' ' + byGrade[g] + '\uBA85</span>';
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
    const more = members.length > 200 ? '<p style="margin-top: 8px; color: var(--text-muted); font-size: 13px;">\uC678 ' + (members.length - 200) + '\uBA85 \uB354 \uC788\uC2B5\uB2C8\uB2E4.</p>' : '';
    return summary + '<div style="overflow-x: auto;"><table class="table" style="width: 100%; font-size: 13px;"><thead><tr><th>\uC774\uB984</th><th>\uD68C\uC6D0\uBC88\uD638</th><th>\uB4F1\uAE09</th><th>\uC0C1\uD0DC</th><th>\uAC00\uC785\uC77C</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' + more;
}

function bookingStatusText(status) {
    if (!status) return '-';
    var s = String(status).toUpperCase();
    if (App.Status && App.Status.booking && App.Status.booking.getText) return App.Status.booking.getText(s);
    var map = { 'CONFIRMED': '\uD655\uC815', 'PENDING': '\uB300\uAE30', 'CANCELLED': '\uCDE8\uC18C', 'COMPLETED': '\uC644\uB8CC', 'NO_SHOW': '\uB178\uC1FC', 'CHECKED_IN': '\uCD9C\uC11D' };
    return map[s] || status;
}

function renderBookingsDetail(bookings) {
    if (!bookings || bookings.length === 0) {
        return '<p style="color: var(--text-muted);">\uC608\uC57D \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
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
    return '<div style="overflow-x: auto;"><table class="table" style="width: 100%; font-size: 13px;"><thead><tr><th>\uC608\uC57D \uC77C\uC2DC</th><th>\uD68C\uC6D0/\uBE44\uD68C\uC6D0</th><th>\uC2DC\uC124</th><th>\uCF54\uCE58</th><th>\uC0C1\uD0DC</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}

function paymentMethodText(method) {
    if (!method) return '-';
    var s = String(method).toUpperCase();
    var map = { 'CASH': '\uD604\uAE08', 'CARD': '\uCE74\uB4DC', 'BANK_TRANSFER': '\uACC4\uC88C\uC774\uCCB4', 'EASY_PAY': '\uAC04\uD3B8\uACB0\uC81C' };
    if (map[s]) return map[s];
    if (App.PaymentMethod && App.PaymentMethod.getText) return App.PaymentMethod.getText(s);
    return method;
}

/** ?? category ? ? ?? ??? ?? (??/????/????/??) */
function getProductSportBucket(p) {
    var cat = p.product && p.product.category ? String(p.product.category).toUpperCase() : '';
    if (cat === 'BASEBALL') return 'baseball';
    if (cat === 'TRAINING' || cat === 'TRAINING_FITNESS') return 'training';
    if (cat === 'PILATES') return 'pilates';
    return 'other';
}

function coachKeyForPayment(p) {
    if (p.coach && p.coach.id != null) return 'id:' + p.coach.id;
    if (p.coach && p.coach.name) return 'name:' + p.coach.name;
    return '_none';
}

function coachLabelForPayment(p) {
    if (p.coach && p.coach.name) return p.coach.name;
    return '\uBBF8\uC9C0\uC815 \uCF54\uCE58';
}

function buildPaymentDetailRow(p) {
    var amt = p.amount != null ? p.amount : 0;
    var paidAt = p.paidAt ? (typeof p.paidAt === 'string' ? p.paidAt.split('T')[0] : '-') : '-';
    var memberName = App.escapeHtml((p.member && p.member.name) ? p.member.name : '-');
    var productName = App.escapeHtml((p.product && p.product.name) ? p.product.name : '-');
    return '<tr><td>' + paidAt + '</td><td>' + memberName + '</td><td>' + (productName || '-') + '</td><td>' + App.formatCurrency(amt) + '</td><td>' + App.escapeHtml(paymentMethodText(p.paymentMethod)) + '</td></tr>';
}

/** ? ?? KPI ?? (??? ???? KPI? ?? ??) */
function renderMonthlyRevenueDetail(payments, periodLabel, kpiMonthlyTotal, kpiPaymentCount) {
    var list = payments || [];
    if (list.length === 0 && (kpiMonthlyTotal == null || kpiMonthlyTotal === 0 || isNaN(Number(kpiMonthlyTotal)))) {
        return '<p style="color: var(--text-muted);">' + periodLabel + ' \uB9E4\uCD9C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    var buckets = [
        { key: 'baseball', title: '\uC57C\uAD6C', icon: '\u26BE' },
        { key: 'training', title: '\uD2B8\uB808\uC774\uB2DD', icon: '\uD83C\uDFCB' },
        { key: 'pilates', title: '\uD544\uB77C\uD14C\uC2A4', icon: '\uD83E\uDD38' },
        { key: 'other', title: '\uAE30\uD0C0', icon: '\uD83D\uDCC1' }
    ];
    var totalHero = 0;
    if (kpiMonthlyTotal != null && !isNaN(Number(kpiMonthlyTotal))) {
        totalHero = Number(kpiMonthlyTotal);
    } else {
        list.forEach(function(p) { totalHero += (p.amount != null ? p.amount : 0); });
    }
    var countHero = list.length;
    if (kpiPaymentCount != null && !isNaN(Number(kpiPaymentCount))) {
        countHero = Number(kpiPaymentCount);
    }
    var monthNum = new Date().getMonth() + 1;
    var html = '';
    html += '<div class="monthly-revenue-detail">';
    html += '<div class="mr-total-card">';
    html += '<div class="mr-total-label">' + monthNum + '\uC6D4 \uC6D4\uAC04 \uB9E4\uCD9C (KPI \uAE30\uC900)</div>';
    html += '<div class="mr-total-amount">' + App.formatCurrency(totalHero) + '</div>';
    html += '<div class="mr-total-meta">' + countHero + '\uAC74 \uACB0\uC81C(\uD658\uBD88 \uC81C\uC678)\uAC00 \uC9D1\uACC4\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uCE74\uD14C\uACE0\uB9AC \uC0C1\uC138\uB97C \uD655\uC778\uD574 \uBCF4\uC138\uC694.</div>';
    html += '</div>';

    html += '<div class="mr-category-grid">';
    buckets.forEach(function(b) {
        var catList = list.filter(function(p) { return getProductSportBucket(p) === b.key; });
        var sub = 0;
        catList.forEach(function(p) { sub += (p.amount != null ? p.amount : 0); });
        html += '<details class="mr-category-details">';
        html += '<summary class="mr-category-summary">';
        html += '<div class="mr-category-face">';
        html += '<span class="mr-category-icon" aria-hidden="true">' + b.icon + '</span>';
        html += '<div class="mr-category-text">';
        html += '<span class="mr-category-title">' + App.escapeHtml(b.title) + '</span>';
        if (b.sub) {
            html += '<span class="mr-category-sub">' + App.escapeHtml(b.sub) + '</span>';
        }
        html += '<span class="mr-category-sum">' + App.formatCurrency(sub) + '</span>';
        html += '<span class="mr-category-count">' + catList.length + '\uAC74</span>';
        html += '</div>';
        html += '<span class="mr-category-chevron" aria-hidden="true"></span>';
        html += '</div>';
        html += '</summary>';
        html += '<div class="mr-category-panel">';
        if (catList.length === 0) {
            html += '<p class="mr-empty-msg">\uD574\uB2F9 \uCE74\uD14C\uACE0\uB9AC \uB9E4\uCD9C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        } else {
            var coachMap = {};
            catList.forEach(function(p) {
                var k = coachKeyForPayment(p);
                if (!coachMap[k]) coachMap[k] = { label: coachLabelForPayment(p), payments: [] };
                coachMap[k].payments.push(p);
            });
            var coachKeys = Object.keys(coachMap);
            coachKeys.sort(function(a, b) {
                var sumA = 0, sumB = 0;
                coachMap[a].payments.forEach(function(x) { sumA += x.amount || 0; });
                coachMap[b].payments.forEach(function(x) { sumB += x.amount || 0; });
                return sumB - sumA;
            });
            coachKeys.forEach(function(k) {
                var cg = coachMap[k];
                var csum = 0;
                cg.payments.forEach(function(x) { csum += x.amount || 0; });
                html += '<details class="mr-coach-details">';
                html += '<summary class="mr-coach-summary">';
                html += '<span class="mr-coach-name">' + App.escapeHtml(cg.label) + '</span>';
                html += '<span class="mr-coach-sum">' + App.formatCurrency(csum) + '</span>';
                html += '<span class="mr-coach-count">' + cg.payments.length + '\uAC74</span>';
                html += '<span class="mr-coach-chevron" aria-hidden="true"></span>';
                html += '</summary>';
                html += '<div class="mr-coach-table-wrap">';
                html += '<table class="table mr-coach-table"><thead><tr><th>\uC77C\uC790</th><th>\uD68C\uC6D0</th><th>\uC0C1\uD488</th><th>\uAE08\uC561</th><th>\uACB0\uC81C \uC218\uB2E8</th></tr></thead><tbody>';
                cg.payments.forEach(function(p) { html += buildPaymentDetailRow(p); });
                html += '</tbody></table></div></details>';
            });
        }
        html += '</div></details>';
    });
    html += '</div>';

    html += '<details class="mr-full-details">';
    html += '<summary class="mr-full-summary">';
    html += '<div class="mr-full-face">';
    html += '<span class="mr-full-title">\uC804\uCCB4 \uACB0\uC81C \uB0B4\uC5ED</span>';
    html += '<span class="mr-full-meta">' + list.length + '\uAC74 \uACB0\uC81C \uB0B4\uC5ED</span>';
    html += '<span class="mr-category-chevron" aria-hidden="true"></span>';
    html += '</div>';
    html += '</summary>';
    html += '<div class="mr-full-panel">' + renderPaymentsDetail(list, periodLabel) + '</div>';
    html += '</details>';
    html += '</div>';
    return html;
}

function renderPaymentsDetail(payments, periodLabel) {
    if (!payments || payments.length === 0) {
        return '<p style="color: var(--text-muted);">' + periodLabel + ' \uACB0\uC81C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    let total = 0;
    const rows = payments.map(function(p) {
        const amt = p.amount != null ? p.amount : 0;
        total += amt;
        return buildPaymentDetailRow(p);
    });
    const totalRow = '<tr style="font-weight: 700; background: var(--bg-tertiary);"><td colspan="3">\uD569\uACC4</td><td>' + App.formatCurrency(total) + '</td><td></td></tr>';
    return '<div style="overflow-x: auto;"><table class="table" style="width: 100%; font-size: 13px;"><thead><tr><th>\uC77C\uC790</th><th>\uD68C\uC6D0</th><th>\uC0C1\uD488</th><th>\uAE08\uC561</th><th>\uACB0\uC81C \uC218\uB2E8</th></tr></thead><tbody>' + rows.join('') + totalRow + '</tbody></table></div>';
}

function getCoachColorForSchedule(coachId) {
    return App.CoachColors.getColorById(coachId);
}

function renderTodaySchedule(schedule) {
    const container = document.getElementById('today-schedule');
    if (!container) {
        App.warn('today-schedule ??? ?? ? ????.');
        return;
    }
    
    if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">\uC624\uB298 \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
    }
    
    // ??? ??? ?? ?? ??
    const completedItems = schedule.filter(item => item.isCompleted || item.status === 'COMPLETED');
    const activeItems = schedule.filter(item => !item.isCompleted && item.status !== 'COMPLETED');
    
    // ????? ?? (??? ??? ??? ?, ?? ??? ?? ?)
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
    
    // ?? ?? ??
    if (activeItems.length > 0) {
        html += '<div style="margin-bottom: 16px;"><strong style="color: var(--accent-primary);">\uC608\uC815 \uC77C\uC815 / \uC9C4\uD589 \uC911</strong></div>';
        html += renderScheduleGroup(activeItems);
    }
    
    // ??? ?? ??
    if (completedItems.length > 0) {
        if (activeItems.length > 0) {
            html += '<div style="margin-top: 24px; margin-bottom: 16px;"><strong style="color: var(--text-muted);">\uC644\uB8CC \uC77C\uC815</strong></div>';
        }
        html += renderScheduleGroup(completedItems, true);
    }
    
    container.innerHTML = html;
}

function renderScheduleGroup(items, isCompleted = false) {
    // ??? ??
    const facilityGroups = {};
    items.forEach(item => {
        const facility = item.facility || '-';
        if (!facilityGroups[facility]) {
            facilityGroups[facility] = [];
        }
        facilityGroups[facility].push(item);
    });
    
    // ? ???? ??
    return Object.keys(facilityGroups).map(facility => {
        const groupItems = facilityGroups[facility];
        
        return groupItems.map(item => {
            const coachColor = item.coachId ? getCoachColorForSchedule(item.coachId) : null;
            const backgroundColor = coachColor ? coachColor + '20' : 'transparent';
            const borderColor = coachColor || 'var(--border-color)';
            
            let timeDisplay = item.time || '';
            if (item.endTime) {
                timeDisplay += ` ~ ${item.endTime}`;
            }
            
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
            
            let statusBadge = '';
            if (isCompleted || item.isCompleted) {
                statusBadge = '<span class="badge badge-secondary" style="opacity: 0.7;">\uC644\uB8CC</span>';
            } else {
                statusBadge = '<span class="badge badge-success">\uC608\uC815</span>';
            }
            
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
        App.warn('pending-alerts ??? ?? ? ????.');
        return;
    }
    
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">??? ??? ????.</p>';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.type || 'info'}">
            <div class="alert-title">${App.escapeHtml(alert.title || '')}</div>
            <div class="alert-detail">${alert.message}</div>
        </div>
    `).join('');
}

/** \uB300\uC2DC\uBCF4\uB4DC \uACF5\uC9C0 \uC81C\uBAA9 \uD45C\uC2DC \uBCF4\uC815 (common.js \uC640 \uB3D9\uC77C \uADDC\uCE59) */
function normalizeDashboardAnnouncementTitle(rawTitle, source) {
    if (source === 'SETTINGS_MEMBERSHIP_DUES') {
        return '\uD68C\uBE44 \uC785\uAE08 \uC804\uC6A9\uACC4\uC88C';
    }
    let title = String(rawTitle || '').trim();
    if (!title) return '\uACF5\uC9C0\uC0AC\uD56D';
    title = title.replace(/(\d)\?$/g, '$1\uAC74');
    title = title.replace(/^\[\?\?\]\s*/, '');
    if (/^\?+(?:\s*\?+)*$/.test(title)) {
        return '\uACF5\uC9C0\uC0AC\uD56D';
    }
    return title || '\uACF5\uC9C0\uC0AC\uD56D';
}

function renderActiveAnnouncements(announcements) {
    const container = document.getElementById('active-announcements');
    if (!container) {
        App.warn('active-announcements \uCEE8\uD14C\uC774\uB108\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
        return;
    }
    
    const countElement = document.getElementById('announcement-count');
    
    if (!announcements || !Array.isArray(announcements) || announcements.length === 0) {
        container.innerHTML = '<div style="padding: 16px; text-align: center;"><p style="color: var(--text-muted); font-size: 13px;">\uD65C\uC131 \uACF5\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p></div>';
        if (countElement) countElement.textContent = '0\uAC74';
        return;
    }
    
    if (countElement) {
        countElement.textContent = String(announcements.length) + '\uAC74';
    }
    
    container.innerHTML = announcements.map((announcement, index) => {
        const content = announcement.content || '';
        const truncatedRaw = content.length > 100 ? content.substring(0, 100) + '...' : content;
        const truncatedContent = App.escapeHtml ? App.escapeHtml(truncatedRaw) : truncatedRaw;
        const displayTitle = normalizeDashboardAnnouncementTitle(announcement.title, announcement.source);
        const safeTitle = App.escapeHtml ? App.escapeHtml(displayTitle) : displayTitle;
        const dateRange = announcement.startDate && announcement.endDate 
            ? `${App.formatDate(announcement.startDate)} ~ ${App.formatDate(announcement.endDate)}`
            : announcement.startDate 
                ? `${App.formatDate(announcement.startDate)}\uBD80\uD130`
                : announcement.endDate
                    ? `${App.formatDate(announcement.endDate)}\uAE4C\uC9C0`
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
                        ${safeTitle}
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
                    <span>\uC790\uC138\uD788 \uBCF4\uAE30</span>
                    <span style="font-size: 10px;">\u25B6</span>
                </div>
            </div>
        `;
    }).join('');
}

function showAnnouncementDetail(id) {
    if (Number(id) === -1) {
        App.api.get('/announcements/-1')
            .then(function(announcement) {
                if (typeof App.showMembershipDuesAnnouncementModal === 'function') {
                    App.showMembershipDuesAnnouncementModal(announcement);
                }
            })
            .catch(function(error) {
                App.err('\uACF5\uC9C0 \uC870\uD68C \uC624\uB958:', error);
                App.showNotification('\uACF5\uC9C0\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'danger');
            });
        return;
    }
    App.api.get(`/announcements/${id}`)
        .then(announcement => {
            const dateRange = announcement.startDate && announcement.endDate 
                ? `${App.formatDate(announcement.startDate)} ~ ${App.formatDate(announcement.endDate)}`
                : announcement.startDate 
                    ? `${App.formatDate(announcement.startDate)}\uBD80\uD130`
                    : announcement.endDate
                        ? `${App.formatDate(announcement.endDate)}\uAE4C\uC9C0`
                        : '';
            const titleText = normalizeDashboardAnnouncementTitle(announcement.title, announcement.source);
            const safeTitle = App.escapeHtml ? App.escapeHtml(titleText) : titleText;
            let bodyRaw = announcement.content != null ? String(announcement.content) : '';
            if (!bodyRaw.trim()) bodyRaw = '\uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.';
            const safeBody = App.escapeHtml ? App.escapeHtml(bodyRaw) : bodyRaw;
            
            const modalContent = `
                <div style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: var(--accent-primary);">${safeTitle}</h2>
                    <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 14px;">
                        <div>\uB4F1\uB85D\uC77C: ${App.formatDate(announcement.createdAt)}</div>
                        ${dateRange ? `<div>\uB178\uCD9C \uAE30\uAC04: ${dateRange}</div>` : ''}
                    </div>
                    <div style="padding: 16px; background-color: var(--bg-secondary); border-radius: 8px; white-space: pre-wrap; line-height: 1.6; color: var(--text-primary);">
                        ${safeBody}
                    </div>
                </div>
            `;
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'announcement-detail-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>\uACF5\uC9C0 \uC0C1\uC138</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">\u00D7</button>
                    </div>
                    ${modalContent}
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">\uB2F5\uAE30</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.style.display = 'flex';
        })
        .catch(error => {
            App.err('\uACF5\uC9C0 \uC0C1\uC138 \uC870\uD68C \uC624\uB958:', error);
            App.showNotification('\uACF5\uC9C0\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'danger');
        });
}

// ========================================
// ??
// ========================================

async function initCharts() {
    var exportId = window.__dashboardExportId;
    try {
        App.log('?? ???', exportId ? '(export: ' + exportId + ')' : '');
        if (exportId && exportId !== 'export-member-chart' && exportId !== 'export-revenue-chart') {
            App.log('?? ??? ?? (export ?? ??)');
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
                App.err('?? ?? ?? ??:', error);
            }
            memberGrowthData = calculateMonthlyGrowth(members);
        }
        if (needRevenueChart) {
            let payments = [];
            try {
                payments = await App.api.get('/payments');
                if (!Array.isArray(payments)) payments = [];
            } catch (error) {
                App.warn('Payment ?? ?? ??:', error);
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
                App.err('?? ?? ?? ?? ??:', error);
            }
        }
        if (needRevenueChart) {
            try {
                createRevenueChart(revenueData);
            } catch (error) {
                App.err('?? ?? ?? ??:', error);
            }
        }
        
        App.log('?? ??? ??');
    } catch (error) {
        App.err('?? ??? ??:', error);
        App.err('?? ??:', error.message, error.stack);
    }
}

let currentTab = 'expiring';

function canReviewMemberApprovals() {
    var r = (typeof App !== 'undefined' && App.currentRole) ? String(App.currentRole).toUpperCase() : '';
    return r === 'ADMIN' || r === 'MANAGER';
}

function switchTab(tab) {
    currentTab = tab;
    const expiringTab = document.getElementById('tab-expiring');
    const expiredTab = document.getElementById('tab-expired');
    const noProductTab = document.getElementById('tab-no-product');
    const approvalTab = document.getElementById('tab-approval');
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
    if (approvalTab && approvalTab.style.display !== 'none') {
        approvalTab.classList.toggle('active', tab === 'approval');
        approvalTab.style.borderBottomColor = tab === 'approval' ? activeStyle.borderBottomColor : inactiveStyle.borderBottomColor;
        approvalTab.style.color = tab === 'approval' ? activeStyle.color : inactiveStyle.color;
    }
    
    renderMembersList();
}

let membersData = { expiring: [], expired: [], noProduct: [] };
let pendingApprovalsData = [];
let memberApprovalRejectPendingId = null;

function updateTabCounts(expiringCount, expiredCount, noProductCount) {
    const expiringTab = document.getElementById('tab-expiring');
    const expiredTab = document.getElementById('tab-expired');
    const noProductTab = document.getElementById('tab-no-product');
    
    if (expiringTab) {
        if (expiringCount > 0) {
            expiringTab.textContent = `\uB9CC\uB8CC \uC784\uBC15 (${expiringCount})`;
        } else {
            expiringTab.textContent = '\uB9CC\uB8CC \uC784\uBC15';
        }
    }
    
    if (expiredTab) {
        if (expiredCount > 0) {
            expiredTab.textContent = `\uC885\uB8CC (${expiredCount})`;
        } else {
            expiredTab.textContent = '\uC885\uB8CC';
        }
    }
    
    if (noProductTab) {
        if (noProductCount > 0) {
            noProductTab.textContent = `\uC774\uC6A9\uAD8C \uC5C6\uC74C (${noProductCount})`;
        } else {
            noProductTab.textContent = '\uC774\uC6A9\uAD8C \uC5C6\uC74C';
        }
    }
}

function updateApprovalTabCount(approvalCount) {
    const approvalTab = document.getElementById('tab-approval');
    if (!approvalTab || approvalTab.style.display === 'none') {
        return;
    }
    if (approvalCount > 0) {
        approvalTab.textContent = '\uC2B9\uC778 \uB300\uAE30 (' + approvalCount + ')';
    } else {
        approvalTab.textContent = '\uC2B9\uC778 \uB300\uAE30';
    }
}

/** onclick="fn(..., 'HERE', ...)" ?? ?? ? ?????????????? ????? */
function escapeForJsSingleQuotedString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

/** 회원 관리 모달 — 이름 검색(부분 일치, 대소문자 무시) */
function getDashboardMemberModalNameFilterQuery() {
    var el = document.getElementById('expiring-members-name-filter');
    if (!el || !el.value) {
        return '';
    }
    return String(el.value).trim().toLowerCase();
}

function filterMembersByNameForModal(members, query) {
    if (!query || !members || !members.length) {
        return members || [];
    }
    return members.filter(function (m) {
        var n = m && m.name != null ? String(m.name).toLowerCase() : '';
        return n.indexOf(query) !== -1;
    });
}

function filterApprovalRowsByMemberName(rows, query) {
    if (!query || !rows || !rows.length) {
        return rows || [];
    }
    return rows.filter(function (req) {
        var n = req && req.memberName != null ? String(req.memberName).toLowerCase() : '';
        return n.indexOf(query) !== -1;
    });
}

/**
 * 승인 유형 표시 라벨.
 * RE_REGISTER는 서버상 이용권 할당 승인(POST /members/{id}/products) 전부에 쓰이므로
 * "재등록"으로 고정하면 회원 재가입과 혼동됨. detailSummary에 요약이 있으면 접두어 생략.
 */
function memberApprovalRequestTypeLabel(type, detailSummary) {
    var t = (type || '').toString().toUpperCase();
    if (t === 'NEW_MEMBER') return '\uC2E0\uADDC \uB4F1\uB85D';
    if (t === 'EXTENSION') return '\uC5F0\uC7A5';
    if (t === 'RE_REGISTER') {
        var s = (detailSummary != null && detailSummary !== undefined) ? String(detailSummary).trim() : '';
        if (s) {
            return '';
        }
        return '\uC774\uC6A9\uAD8C \uBC18\uC601';
    }
    return type || '-';
}

function renderApprovalPendingList() {
    const listContainer = document.getElementById('expiring-members-list');
    if (!listContainer) {
        return;
    }
    const rowsRaw = pendingApprovalsData || [];
    const q = getDashboardMemberModalNameFilterQuery();
    const rows = filterApprovalRowsByMemberName(rowsRaw, q);
    if (rowsRaw.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uC2B9\uC778 \uB300\uAE30 \uC694\uCCAD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
    }
    if (rows.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uAC80\uC0C9 \uC870\uAC74\uC5D0 \uB9DE\uB294 \uD68C\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
    }
    listContainer.innerHTML = rows.map(function(req) {
        var id = req.id;
        var name = App.escapeHtml ? App.escapeHtml(req.memberName || '') : (req.memberName || '');
        var num = App.escapeHtml ? App.escapeHtml(req.memberNumber || '-') : (req.memberNumber || '-');
        var phone = App.escapeHtml ? App.escapeHtml(req.phoneNumber || '-') : (req.phoneNumber || '-');
        var by = App.escapeHtml ? App.escapeHtml(req.requestedBy || '-') : (req.requestedBy || '-');
        var at = req.requestedAt ? (typeof App.formatDateTime === 'function' ? App.formatDateTime(req.requestedAt) : String(req.requestedAt)) : '-';
        var summary = App.escapeHtml ? App.escapeHtml(req.detailSummary || '') : (req.detailSummary || '');
        var typeLabel = memberApprovalRequestTypeLabel(req.requestType, req.detailSummary);
        var summaryLine = typeLabel
            ? ('<strong>' + typeLabel + '</strong>' + (summary ? ' · ' + summary : ''))
            : (summary || '<span style="color: var(--text-muted);">(\uC694\uC57D \uC5C6\uC74C)</span>');
        return (
            '<div style="padding: 16px; margin-bottom: 12px; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; border-left: 4px solid var(--accent-primary, #3498db);">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">' +
            '<div style="flex: 1; min-width: 200px;">' +
            '<div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">' + name + ' <span style="color: var(--text-secondary); font-weight: 500;">(' + num + ')</span></div>' +
            '<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">' + phone + '</div>' +
            '<div style="font-size: 13px; color: var(--text-primary);">' + summaryLine + '</div>' +
            '<div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">\uC694\uCCAD: ' + by + ' · ' + at + '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 8px; flex-shrink: 0;">' +
            '<button type="button" class="btn btn-sm btn-primary" onclick="dashboardApproveMemberRequest(' + id + ')">\uC2B9\uC778</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" onclick="dashboardRejectMemberRequest(' + id + ')">\uBC18\uB824</button>' +
            (req.memberId != null
                ? '<button type="button" class="btn btn-sm btn-outline" onclick="openMemberDetailFromDashboard(' + req.memberId + ')">\uC0C1\uC138</button>'
                : '') +
            '</div></div></div>'
        );
    }).join('');
}

async function dashboardApproveMemberRequest(requestId) {
    var req = (pendingApprovalsData || []).find(function(r) {
        return Number(r.id) === Number(requestId);
    });
    try {
        var res = await App.api.post('/member-approvals/' + requestId + '/approve', {});
        App.showNotification('\uC2B9\uC778\uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        var memberId = null;
        if (res && res.request && res.request.memberId != null) {
            memberId = res.request.memberId;
        }
        if (memberId == null && req && req.memberId != null) {
            memberId = req.memberId;
        }
        if (memberId != null) {
            if (typeof App.goToMembersWithFocus === 'function') {
                App.goToMembersWithFocus(memberId);
            } else {
                window.location.href = '/members.html?focusMember=' + encodeURIComponent(String(memberId));
            }
            return;
        }
        await reloadApprovalPendingInModal();
        try {
            await loadDashboardData();
        } catch (e1) { /* ignore */ }
    } catch (e) {
        var st = e && e.response && e.response.status;
        var msg = (e && e.message) ? e.message : '';
        if (st === 403 || msg.indexOf('403') !== -1) {
            App.showNotification('\uAD00\uB9AC\uC790/\uB9E4\uB2C8\uC800\uB9CC \uC2B9\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.', 'warning');
        } else {
            App.showNotification('\uC2B9\uC778 \uC2E4\uD328: ' + msg, 'danger');
        }
    }
}

function openMemberApprovalRejectModal(requestId) {
    memberApprovalRejectPendingId = requestId;
    var ta = document.getElementById('member-approval-reject-note');
    if (ta) {
        ta.value = '';
    }
    App.Modal.open('member-approval-reject-modal');
    setTimeout(function () {
        if (ta) {
            ta.focus();
        }
    }, 80);
}

function closeMemberApprovalRejectModal() {
    memberApprovalRejectPendingId = null;
    App.Modal.close('member-approval-reject-modal');
}

async function confirmMemberApprovalReject() {
    var requestId = memberApprovalRejectPendingId;
    if (!requestId) {
        return;
    }
    var noteEl = document.getElementById('member-approval-reject-note');
    var note = noteEl ? (noteEl.value || '').trim() : '';
    App.Modal.close('member-approval-reject-modal');
    memberApprovalRejectPendingId = null;
    try {
        await App.api.post('/member-approvals/' + requestId + '/reject', { note: note });
        App.showNotification('\uBC18\uB824\uCC98\uB9AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'info');
        await reloadApprovalPendingInModal();
        try {
            await loadDashboardData();
        } catch (e1) { /* ignore */ }
    } catch (e) {
        var st = e && e.response && e.response.status;
        var msg = (e && e.message) ? e.message : '';
        if (st === 403 || msg.indexOf('403') !== -1) {
            App.showNotification('\uAD00\uB9AC\uC790/\uB9E4\uB2C8\uC800\uB9CC \uBC18\uB824\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.', 'warning');
        } else {
            App.showNotification('\uBC18\uB824 \uC2E4\uD328: ' + msg, 'danger');
        }
    }
}

function dashboardRejectMemberRequest(requestId) {
    openMemberApprovalRejectModal(requestId);
}

async function reloadApprovalPendingInModal() {
    if (!canReviewMemberApprovals()) {
        pendingApprovalsData = [];
        updateApprovalTabCount(0);
        renderMembersList();
        return;
    }
    try {
        pendingApprovalsData = await App.api.get('/member-approvals/pending') || [];
        if (!Array.isArray(pendingApprovalsData)) {
            pendingApprovalsData = [];
        }
    } catch (e) {
        pendingApprovalsData = [];
    }
    updateApprovalTabCount(pendingApprovalsData.length);
    renderMembersList();
}

window.dashboardApproveMemberRequest = dashboardApproveMemberRequest;
window.dashboardRejectMemberRequest = dashboardRejectMemberRequest;
window.closeMemberApprovalRejectModal = closeMemberApprovalRejectModal;
window.confirmMemberApprovalReject = confirmMemberApprovalReject;

function renderMembersList() {
    const listContainer = document.getElementById('expiring-members-list');
    if (!listContainer) {
        App.warn('\uBAA8\uB2EC \uBAA9\uB85D \uC601\uC5ED\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
        return;
    }

    if (currentTab === 'approval') {
        renderApprovalPendingList();
        return;
    }
    
    const membersRaw = currentTab === 'expiring' ? membersData.expiring : (currentTab === 'expired' ? membersData.expired : membersData.noProduct);
    const q = getDashboardMemberModalNameFilterQuery();
    const members = filterMembersByNameForModal(membersRaw, q);
    const productsKey = currentTab === 'expiring' ? 'expiringProducts' : 'expiredProducts';
    const titleMap = { expiring: '\uB9CC\uB8CC \uC784\uBC15 \uC774\uC6A9\uAD8C', expired: '\uC885\uB8CC \uC774\uC6A9\uAD8C', noProduct: '\uC774\uC6A9\uAD8C \uC5C6\uC74C' };
    const title = titleMap[currentTab] || '\uC774\uC6A9\uAD8C';
    const borderColorMap = { expiring: 'var(--warning, #F1C40F)', expired: 'var(--danger, #E74C3C)', noProduct: 'var(--text-muted, #6c757d)' };
    const borderColor = borderColorMap[currentTab] || 'var(--border-color)';
    const emptyMsgMap = { expiring: '\uB9CC\uB8CC \uC784\uBC15 \uD68C\uC6D0', expired: '\uC885\uB8CC \uD68C\uC6D0', noProduct: '\uC774\uC6A9\uAD8C \uC5C6\uB294 \uD68C\uC6D0' };
    const emptyMsg = emptyMsgMap[currentTab] || '\uD68C\uC6D0';
    
    if (!membersRaw || membersRaw.length === 0) {
        listContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 40px;">${emptyMsg}\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>`;
        return;
    }
    if (!members || members.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uAC80\uC0C9 \uC870\uAC74\uC5D0 \uB9DE\uB294 \uD68C\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
    }
    
    listContainer.innerHTML = members.map(member => {
        const products = member[productsKey] || [];
        const productsHtml = products.map(product => {
            // ???? ?? ??(NONE)? '?? ?? ??'? ??, ? ?? ??/???/?? ?? ??
            const isNoProduct = product.id === null || product.productType === 'NONE';
            const hasButtons = !isNoProduct;
            const noProductOnlyButton = isNoProduct ? `
                <div style="display: flex; gap: 8px; margin-left: 12px; flex-wrap: wrap;">
                    <button class="btn btn-sm" onclick="openNewProductModal(${member.id})" style="background-color: var(--info, #17a2b8); color: white; padding: 6px 12px; font-size: 12px;">
                        \uC2E0\uADDC \uB4F1\uB85D
                    </button>
                </div>
            ` : '';
            const ptSafe = escapeForJsSingleQuotedString(product.productType || '');
            const pnSafe = escapeForJsSingleQuotedString(product.productName || '');
            const usageDefault = product.usageCount != null && product.usageCount > 0 ? product.usageCount : 'null';
            const buttonsHtml = hasButtons ? `
                <div style="display: flex; gap: 8px; margin-left: 12px; flex-wrap: wrap;">
                    <button class="btn btn-sm" onclick="openUnifiedExtendRepurchaseModal(${member.id}, ${product.id}, '${ptSafe}', '${pnSafe}', ${usageDefault})" style="background: linear-gradient(135deg, var(--success) 0%, var(--accent-primary) 100%); color: white; padding: 6px 12px; font-size: 12px; font-weight: 600;" title="\uC5F0\uC7A5 \uB610\uB294 \uC7AC\uAD6C\uB9E4, \uC2E0\uADDC \uC774\uC6A9\uAD8C \uB4F1\uB85D \uC120\uD0DD">
                        \uC5F0\uC7A5/\uC7AC\uAD6C\uB9E4
                    </button>
                    <button class="btn btn-sm" onclick="openNewProductModal(${member.id})" style="background-color: var(--info, #17a2b8); color: white; padding: 6px 12px; font-size: 12px;">
                        \uC2E0\uADDC \uB4F1\uB85D
                    </button>
                </div>
            ` : noProductOnlyButton;
            
            return `
                <div style="padding: 8px; margin: 4px 0; background-color: var(--bg-secondary); border-radius: 4px; border-left: 3px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary);">${product.productName || '\uC774\uC6A9\uAD8C \uC5C6\uC74C'}</div>
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
                            ${member.name || '\uC774\uB984 \uC5C6\uC74C'} (${member.memberNumber || '-'})
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary);">
                            ${member.phoneNumber || '-'} | ${(App.MemberGrade && App.MemberGrade.getText(member.grade)) || member.grade || '-'} | ${member.school || '-'}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="openMemberDetailFromDashboard(${member.id})" style="margin-left: 12px;">
                        \uD68C\uC6D0 \uC0C1\uC138
                    </button>
                </div>
                <div style="margin-top: 12px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">${title}:</div>
                    ${productsHtml || '<div style="color: var(--text-muted); font-size: 12px;">\uD45C\uC2DC\uD560 \uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>'}
                </div>
            </div>
        `;
    }).join('');
}

// ?? ??/?? ?? ?? ??
// @param {string} [initialTab] 'expiring' | 'approval' — 승인 대기 탭으로 바로 열 때 'approval'
async function openExpiringMembersModal(initialTab) {
    const modal = document.getElementById('expiringMembersModal');
    const listContainer = document.getElementById('expiring-members-list');
    const approvalTabEl = document.getElementById('tab-approval');
    
    if (!modal || !listContainer) {
        App.err('\uB9CC\uB8CC \uD68C\uC6D0 \uBAA8\uB2EC \uC694\uC18C \uB204\uB77D');
        return;
    }

    var canApproval = canReviewMemberApprovals();
    var wantApprovalTab = initialTab === 'approval' && canApproval;
    if (approvalTabEl) {
        approvalTabEl.style.display = canApproval ? '' : 'none';
    }
    modal.style.display = 'flex';
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uB85C\uB529 \uC911...</p>';
    currentTab = 'expiring';
    switchTab('expiring');
    
    // ?? ? ?? ?? (?? ??? 0?? ??)
    updateTabCounts(0, 0, 0);
    if (canApproval) {
        updateApprovalTabCount(0);
    }
    
    try {
        const response = await App.api.get('/dashboard/expiring-members');
        
        App.log('?? ?? ??? ??:', response);
        App.log('?? ?? ?? ?:', response.expiring?.length || 0);
        App.log('?? ?? ?:', response.expired?.length || 0);
        App.log('??? ?? ?? ?:', response.noProduct?.length || 0);
        
        membersData = {
            expiring: response.expiring || [],
            expired: response.expired || [],
            noProduct: response.noProduct || []
        };
        
        App.log('membersData ?? ??:', membersData);
        
        // ?? ?? ?? ????
        updateTabCounts(membersData.expiring.length, membersData.expired.length, membersData.noProduct.length);

        pendingApprovalsData = [];
        if (canApproval) {
            try {
                pendingApprovalsData = await App.api.get('/member-approvals/pending') || [];
                if (!Array.isArray(pendingApprovalsData)) {
                    pendingApprovalsData = [];
                }
            } catch (apErr) {
                App.warn('\uC2B9\uC778 \uB300\uAE30 \uBAA9\uB85D \uB85C\uB4DC \uC2E4\uD328:', apErr);
                pendingApprovalsData = [];
            }
            updateApprovalTabCount(pendingApprovalsData.length);
        }
        
        renderMembersList();
        if (wantApprovalTab) {
            switchTab('approval');
        }
    } catch (error) {
        App.err('\uB9CC\uB8CC \uD68C\uC6D0 \uBAA9\uB85D \uB85C\uB4DC \uC2E4\uD328:', error);
        listContainer.innerHTML = '<p style="text-align: center; color: var(--danger, #E74C3C); padding: 40px;">\uBAA9\uB85D \uBD88\uB7EC\uC624\uAE30 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.</p>';
    }
}

// ???? ?? ????? window ??? ?? ??
window.openExpiringMembersModal = openExpiringMembersModal;
window.switchTab = switchTab;

// ?? ?? ?? ?? ??
function closeExpiringMembersModal() {
    const modal = document.getElementById('expiringMembersModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ???? ?? ????? window ??? ??
window.closeExpiringMembersModal = closeExpiringMembersModal;

// ??/??? ?? ?? ??
let extendRepurchaseData = {
    memberId: null,
    memberProductId: null,
    productType: null,
    productName: null,
    action: null // 'extend' or 'repurchase' or 'new'
};

/**
 * ?? ?? ? ? ??(?? ?? ????????? ??), ?? ? ? ???(? ??? ?). ??? ? API?? ??/??.
 */
async function openUnifiedExtendRepurchaseModal(memberId, memberProductId, productType, productName, usageCountDefault) {
    if (memberProductId == null || productType === 'NONE') {
        App.showNotification('???? ????. ???? ?? ?? ??? ??? ???.', 'warning');
        return;
    }
    // ??????? ?? ??/?? ?? ?? ?? ??? ?? ??
    if (document.getElementById('extend-product-modal') && typeof openExtendProductModal === 'function') {
        await openExtendProductModal(memberId, {
            memberProductId: memberProductId,
            defaultExtendDays: typeof usageCountDefault === 'number' && usageCountDefault > 0 ? usageCountDefault : undefined
        });
        return;
    }
    if (currentTab === 'expiring') {
        // ??? ??? ?? ??? ??????/??? ????? ??
        if (productType === 'COUNT_PASS' && document.getElementById('extend-product-modal') && typeof openExtendProductModal === 'function') {
            await openExtendProductModal(memberId, {
                memberProductId: memberProductId,
                defaultExtendDays: typeof usageCountDefault === 'number' && usageCountDefault > 0 ? usageCountDefault : undefined
            });
            return;
        }
        await openExtendModal(memberId, memberProductId, productType, productName, usageCountDefault);
        const titleEl = document.getElementById('extend-repurchase-title');
        const sub = document.getElementById('extend-repurchase-subtitle');
        if (titleEl) titleEl.textContent = '??? ??';
        if (sub) sub.textContent = '?? ??? ?? ?: ?? ???? ??? ???? ?? ??? ?????. (?: 1/10?? 10? ?? ? 11/20)';
    } else {
        await openRepurchaseModal(memberId, memberProductId, productType, productName);
        const titleEl = document.getElementById('extend-repurchase-title');
        const sub = document.getElementById('extend-repurchase-subtitle');
        if (titleEl) titleEl.textContent = '??? ???';
        if (sub) sub.textContent = '????? ?: ?? ??? ? ???? ????. ?? ??? ??? ????. (?: 0/10 ? 10/10)';
    }
}

window.openUnifiedExtendRepurchaseModal = openUnifiedExtendRepurchaseModal;

// ?? ?? ??
async function openExtendModal(memberId, memberProductId, productType, productName, defaultUsageCount) {
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
    
    title.textContent = '?? ??';
    submitBtn.textContent = '????';
    const sub = document.getElementById('extend-repurchase-subtitle');
    if (sub) sub.textContent = '';

    const countDefault = (typeof defaultUsageCount === 'number' && defaultUsageCount > 0) ? defaultUsageCount : 10;
    const daysDefault = 30;
    
    if (productType === 'COUNT_PASS') {
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">??? ?? *</label>
                <input type="number" id="extend-count" class="form-control" min="1" value="${countDefault}" required>
                <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                    10???? ?? ?? ??(?: 10)?? ?????. ??????? ?????.
                </small>
            </div>
            <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">???</div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName || '? ? ??'}</div>
            </div>
        `;
    } else if (productType === 'MONTHLY_PASS') {
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">??? ?? *</label>
                <input type="number" id="extend-days" class="form-control" min="1" value="${daysDefault}" required>
                <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                    ??? ??? ?????.
                </small>
            </div>
            <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">???</div>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName || '? ? ??'}</div>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
}

// ??? ?? ??
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
    
    title.textContent = '?? ???';
    submitBtn.textContent = '?????';
    const subEl = document.getElementById('extend-repurchase-subtitle');
    if (subEl) subEl.textContent = '';

    // ?? ?? ?? ??
    try {
        const memberProduct = await App.api.get(`/member-products/${memberProductId}`);
        if (!memberProduct) {
            App.err('MemberProduct? ?? ? ????:', memberProductId);
            return;
        }
        
        const product = memberProduct.product;
        if (!product) {
            App.err('Product ??? ?? ? ????:', memberProductId);
            return;
        }
        
        const productName = product.name || '? ? ??';
        
        if (productType === 'COUNT_PASS') {
            content.innerHTML = `
                <div class="form-group">
                    <label class="form-label">??? ?? *</label>
                    <input type="number" id="repurchase-count" class="form-control" min="1" value="${product.usageCount || 10}" required>
                    <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                        ??? ??? ?????.
                    </small>
                </div>
                <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">???</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName}</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">??: ${App.formatCurrency(product.price || 0)}</div>
                </div>
            `;
        } else if (productType === 'MONTHLY_PASS') {
            content.innerHTML = `
                <div class="form-group">
                    <label class="form-label">??? ?? (?) *</label>
                    <input type="number" id="repurchase-days" class="form-control" min="1" value="30" required>
                    <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                        ??? ??? ??? ?????.
                    </small>
                </div>
                <div style="padding: 12px; background-color: var(--bg-secondary); border-radius: 8px; margin-top: 16px;">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">???</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${productName || '? ? ??'}</div>
                    <div style="font-size: 14px; color: var(--text-secondary); margin-top: 8px;">??: ${App.formatCurrency(product.price || 0)}</div>
                </div>
            `;
        }
    } catch (error) {
        App.err('?? ?? ?? ??:', error);
        content.innerHTML = '<p style="color: var(--danger);">?? ??? ????? ??????.</p>';
        return;
    }
    
    modal.style.display = 'flex';
}

// ??/??? ?? ??
function closeExtendRepurchaseModal() {
    const modal = document.getElementById('extendRepurchaseModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const sub = document.getElementById('extend-repurchase-subtitle');
    if (sub) sub.textContent = '';
    extendRepurchaseData = {
        memberId: null,
        memberProductId: null,
        productType: null,
        productName: null,
        action: null
    };
}

// ?? ?? ?? ?? ??
async function openNewProductModal(memberId) {
    const modal = document.getElementById('newProductPurchaseModal');
    const memberIdInput = document.getElementById('new-product-member-id');
    const productSelect = document.getElementById('new-product-select');
    const coachSelectionContainer = document.getElementById('new-product-coach-selection');
    const totalPriceElement = document.getElementById('new-product-total-price');
    const currentProductsList = document.getElementById('current-member-products-list');
    
    if (!modal || !memberIdInput || !productSelect) {
        App.err('\uC0C1\uD488 \uAD6C\uB9E4 \uBAA8\uB2EC \uC694\uC18C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
        return;
    }
    
    // ?? ID ??
    memberIdInput.value = memberId;
    
    // ???
    productSelect.innerHTML = '<option value="">\uB85C\uB529 \uC911...</option>';
    coachSelectionContainer.innerHTML = '';
    totalPriceElement.textContent = '\u20A90';
    if (currentProductsList) {
        currentProductsList.innerHTML = '\uB85C\uB529 \uC911...';
    }
    
    try {
        // ?? ?? ????
        const member = await App.api.get(`/members/${memberId}`);
        App.log('?? ?? ?? ?? - ?? ??:', member);
        
        // ?? ??? ?? ?? ?? ????
        try {
            const memberProducts = await App.api.get(`/member-products?memberId=${memberId}&forMemberDetailUi=true`);
            if (currentProductsList) {
                if (!memberProducts || memberProducts.length === 0) {
                    currentProductsList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">\uBCF4\uC720 \uC0C1\uD488/\uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
                } else {
                    currentProductsList.innerHTML = renderCurrentMemberProducts(memberProducts);
                }
            }
        } catch (error) {
            App.err('?? ?? ?? ?? ?? ??:', error);
            if (currentProductsList) {
                currentProductsList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">\uBCF4\uC720 \uC0C1\uD488 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
            }
        }
        
        // ?? ?? ?? ????
        const allProducts = await App.api.get('/products');
        const activeProducts = allProducts.filter(p => p.active !== false);
        App.log('?? ?? ?? ?? - ?? ?? ??:', activeProducts.length);
        
        // ?? ?? ???? ???
        productSelect.innerHTML = '<option value="">\uC0C1\uD488\uC744 \uC120\uD0DD\uD558\uC138\uC694</option>';
        activeProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} - ${App.formatCurrency(product.price || 0)}`;
            option.dataset.price = product.price || 0;
            option.dataset.category = product.category || '';
            App.log(`?? ??: ID=${product.id}, name=${product.name}, category=${product.category || '??'}`);
            productSelect.appendChild(option);
        });
        
        // ?? ?? ? ?? ?? UI ???? ? ? ?? ??
        productSelect.onchange = async function() {
            await updateNewProductCoachSelection(memberId);
            updateNewProductTotalPrice();
        };
        
        // ?? ??
        modal.style.display = 'flex';
        
    } catch (error) {
        App.err('?? ?? ?? ?? ?? ??:', error);
        App.showNotification('?? ??? ????? ??????.', 'danger');
    }
}

// ?? ?? ?? ?? ?? ??? (???)
function renderCurrentMemberProducts(memberProducts) {
    const list = App.filterMemberProductsForDisplayList
        ? App.filterMemberProductsForDisplayList(memberProducts || [])
        : (memberProducts || []);
    if (!list || list.length === 0) {
        return '<div style="color: var(--text-muted); font-size: 12px;">\uBCF4\uC720 \uC0C1\uD488/\uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
    }
    
    const statusText = {
        'ACTIVE': '\uC774\uC6A9\uC911',
        'EXPIRED': '\uB9CC\uB8CC',
        'USED_UP': '\uC804\uBD80 \uC18C\uC9C4',
        'INACTIVE': '\uBE44\uD65C\uC131'
    };
    
    const statusColor = {
        'ACTIVE': '#28a745',
        'EXPIRED': '#6c757d',
        'USED_UP': '#dc3545',
        'INACTIVE': '#6c757d'
    };
    
    return list.map(mp => {
        const product = mp.product || {};
        const productName = product.name || '\uC0C1\uD488\uBA85 \uC5C6\uC74C';
        const status = mp.status || 'UNKNOWN';
        let remaining = App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'zero' });

        const isCountPass = product.type === 'COUNT_PASS';
        const isPeriodPass = product.type === 'MONTHLY_PASS' || product.type === 'TIME_PASS';
        const graceExhausted =
            typeof App.isActiveCountPassExhaustedForGrace === 'function' &&
            App.isActiveCountPassExhaustedForGrace(mp);
        const countPassExhaustedByUse =
            isCountPass &&
            status !== 'EXPIRED' &&
            (remaining === 0 || status === 'USED_UP' || graceExhausted);

        let statusDisplay = statusText[status] || status;
        if (countPassExhaustedByUse) {
            statusDisplay = '\uB9C8\uAC10';
        } else if (status === 'EXPIRED' && isPeriodPass) {
            statusDisplay = '\uAE30\uAC04 \uC885\uB8CC';
        }

        let statusColorKey = status;
        if (countPassExhaustedByUse) {
            statusColorKey = 'USED_UP';
        }
        const statusColorValue = statusColor[statusColorKey] || '#6c757d';

        let detailText = '';
        let detailColor = 'var(--text-secondary)';
        let detailWeight = '500';

        if (isPeriodPass) {
            if (mp.expiryDate) {
                const expiryDate = new Date(mp.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                expiryDate.setHours(0, 0, 0, 0);
                const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                const formattedDate = `${expiryDate.getFullYear()}. ${String(expiryDate.getMonth() + 1).padStart(2, '0')}. ${String(expiryDate.getDate()).padStart(2, '0')}.`;
                const periodEnded = status === 'EXPIRED' || daysUntilExpiry < 0;
                if (periodEnded) {
                    detailColor = '#dc3545';
                    detailWeight = '700';
                    detailText =
                        '<span style="color: #dc3545; font-weight: 700;">\uAE30\uAC04 \uC885\uB8CC</span> \u00B7 \uB9CC\uB8CC\uC77C: ' +
                        formattedDate;
                } else {
                    detailColor = getExpiryDateColor(mp.expiryDate);
                    let suffix = '';
                    if (daysUntilExpiry === 0) {
                        suffix = ' (\uC624\uB298 \uB9CC\uB8CC)';
                    } else {
                        suffix = ` (${daysUntilExpiry}\uC77C \uD6C4 \uB9CC\uB8CC)`;
                    }
                    detailText = `\uB9CC\uB8CC\uC77C: ${formattedDate}${suffix}`;
                }
            }
        } else if (isCountPass) {
            const total = mp.totalCount || product.usageCount || 0;
            if (countPassExhaustedByUse) {
                detailColor = '#dc3545';
                detailWeight = '700';
                detailText = '<span style="color: #dc3545; font-weight: 700;">\uC804\uBD80 \uC18C\uC9C4</span>';
            } else if (status === 'EXPIRED') {
                detailColor = '#dc3545';
                detailWeight = '700';
                detailText = '<span style="color: #dc3545; font-weight: 700;">\uB9CC\uB8CC</span>';
            } else {
                detailColor = getRemainingCountColor(remaining);
                detailText = `\uC794\uC5EC: ${remaining}/${total}\uD68C`;
            }
        }

        return `
            <div style="padding: 8px; margin: 6px 0; background: var(--bg-primary); border-radius: 6px; border-left: 3px solid ${statusColorValue};">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; margin-bottom: 4px;">
                            ${productName}
                        </div>
                        <div style="font-size: 12px; color: ${detailColor}; font-weight: ${detailWeight};">
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

// ?? ?? ?? ??? ?? ?? UI ????
async function updateNewProductCoachSelection(memberId) {
    const productSelect = document.getElementById('new-product-select');
    const coachSelectionContainer = document.getElementById('new-product-coach-selection');
    
    if (!productSelect || !coachSelectionContainer) {
        return;
    }
    
    const selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    App.log('?? ?? ?? - ??? ?? ??:', selectedOptions.length);
    
    // ?? ?? ??
    coachSelectionContainer.innerHTML = '';
    
    if (selectedOptions.length === 0) {
        return;
    }
    
    // ?? ?? ??
    let allCoaches = [];
    try {
        allCoaches = await App.api.get('/coaches');
        App.log('?? ?? ?? - ?? ?? ?? (??? ?):', allCoaches.length);
        allCoaches = allCoaches.filter(c => c.active !== false);
        App.log('?? ?? ?? - ?? ?? ??:', allCoaches.length);
        
        if (allCoaches.length === 0) {
            App.warn('?? ??? ????!');
            coachSelectionContainer.innerHTML = '<div style="color: var(--text-muted); padding: 12px;">?? ??? ????.</div>';
            return;
        }
    } catch (error) {
        App.err('?? ?? ?? ??:', error);
        coachSelectionContainer.innerHTML = '<div style="color: var(--danger); padding: 12px;">?? ??? ????? ??????.</div>';
        return;
    }
    
    // ??? ???? ???? ??
    const selectedProductCategories = new Set();
    selectedOptions.forEach(option => {
        const category = option.dataset.category;
        if (category) {
            selectedProductCategories.add(category);
        }
    });
    
    App.log(`?? ?? ?? - ?? ?? ??: ${allCoaches.length}`);
    
    // ? ??? ??? ?? ?? ?? ???? ??
    selectedOptions.forEach((option, index) => {
        const productId = option.value;
        const productName = option.textContent.trim();
        const productCategory = option.dataset.category || '';
        
        App.log(`?? ${index + 1}: ID=${productId}, name=${productName}, category="${productCategory}"`);
        
        const coachGroup = document.createElement('div');
        coachGroup.className = 'form-group';
        coachGroup.style.marginBottom = '12px';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = `${productName} \uB2F4\uB2F9 \uCF54\uCE58`;
        
        const select = document.createElement('select');
        select.className = 'form-control product-coach-select';
        select.dataset.productId = productId;
        select.required = false; // ??? ????
        
        // ?? ??
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '\uCF54\uCE58 \uBBF8\uC9C0\uC815 (\uC120\uD0DD\uC548\uD568)';
        select.appendChild(defaultOption);
        
        // ????? ?? ?? ??? (????? ??? ??? ??? ?? ?? ??)
        let relevantCoaches = allCoaches;
        
        if (productCategory && productCategory.trim() !== '') {
            relevantCoaches = allCoaches.filter(coach => {
                // ??? ??? ?? ??
                if (!coach.specialties || coach.specialties.trim().length === 0) {
                    return true;
                }
                
                // specialties? ???? ???? ?? (??? ??)
                const specialtiesLower = coach.specialties.toLowerCase();
                
                // ????? ?? ?? ??
                if (productCategory === 'BASEBALL') {
                    return specialtiesLower.includes('baseball') || specialtiesLower.includes('??');
                } else if (productCategory === 'TRAINING' || productCategory === 'TRAINING_FITNESS') {
                    // ???? ????? ???? ?? ??? (???? ??)
                    return (specialtiesLower.includes('training') || specialtiesLower.includes('????')) &&
                           !specialtiesLower.includes('pilates') && !specialtiesLower.includes('????');
                } else if (productCategory === 'PILATES') {
                    return specialtiesLower.includes('pilates') || specialtiesLower.includes('????');
                }
                
                // ???? ????? ??? ?? ?? ??
                return true;
            });
            
            // ??? ? ??? ??? ?? ?? ?? (????)
            if (relevantCoaches.length === 0) {
                App.warn(`???? "${productCategory}"? ?? ??? ?? ?? ??? ?????.`);
                relevantCoaches = allCoaches;
            }
        } else {
            App.log(`?? "${productName}"? ????? ?? ?? ??? ?????.`);
        }
        
        App.log(`?? "${productName}" (????: ${productCategory || '??'})? ?? ?? ??: ${relevantCoaches.length}`);
        
        // ?? ?? ??
        if (relevantCoaches.length > 0) {
            relevantCoaches.forEach(coach => {
                const coachOption = document.createElement('option');
                coachOption.value = coach.id;
                coachOption.textContent = coach.name || '?? ??';
                select.appendChild(coachOption);
            });
        } else {
            App.err(`?? "${productName}"? ?? ??? ????!`);
            const noCoachOption = document.createElement('option');
            noCoachOption.value = '';
            noCoachOption.textContent = '?? ??';
            noCoachOption.disabled = true;
            select.appendChild(noCoachOption);
        }
        
        coachGroup.appendChild(label);
        coachGroup.appendChild(select);
        coachSelectionContainer.appendChild(coachGroup);
    });
}

// ?? ?? ?? ??? ? ?? ??
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

// ?? ?? ?? ?? ??
function closeNewProductPurchaseModal() {
    const modal = document.getElementById('newProductPurchaseModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // ? ???
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
        totalPriceElement.textContent = '?0';
    }
}

// ?? ?? ?? ??
async function submitNewProductPurchase() {
    const memberIdInput = document.getElementById('new-product-member-id');
    const productSelect = document.getElementById('new-product-select');
    
    if (!memberIdInput || !productSelect) {
        App.showNotification('?? ??? ????.', 'danger');
        return;
    }
    
    const memberId = memberIdInput.value;
    const selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    
    if (selectedOptions.length === 0) {
        App.showNotification('??? ??? ??????.', 'danger');
        return;
    }
    
    const productIds = selectedOptions.map(opt => opt.value);
    
    // ??? ??? ?? ?? ??
    const productCoachMap = {};
    const coachSelects = document.querySelectorAll('#new-product-coach-selection .product-coach-select');
    
    coachSelects.forEach(select => {
        const productId = select.dataset.productId;
        const coachId = select.value;
        
        if (productId && coachId) {
            productCoachMap[productId] = parseInt(coachId);
        }
    });

    for (const productId of productIds) {
        if (!productCoachMap[productId]) {
            App.showNotification('??? ???? ?? ??? ??? ???.', 'warning');
            return;
        }
    }
    
    try {
        let successCount = 0;
        let conflictCount = 0;
        let pendingApprovalCount = 0;
        
        // ? ?? ??
        for (const productId of productIds) {
            try {
                const requestData = {
                    productId: parseInt(productId),
                    productSelectionIntent: 'NEW_CATALOG'
                };
                
                requestData.coachId = productCoachMap[productId];
                
                // skipPayment? false? ?? (? ????? ?? ?? ??)
                requestData.skipPayment = false;
                
                const postRes = await App.api.post(`/members/${memberId}/products`, requestData);
                if (postRes && postRes.pendingApproval) {
                    pendingApprovalCount++;
                } else {
                    successCount++;
                }
                App.log(`?? ID ${productId} ?? ??`);
            } catch (error) {
                // 409 Conflict: ?? ??? ?? ?? ??
                if (error.response && error.response.status === 409) {
                    conflictCount++;
                    App.warn(`?? ID ${productId}? ?? ??? ?????.`);
                    // ?? ??? ??? ?? ?? (?? ??? ?? ??)
                } else {
                    App.err(`?? ID ${productId} ?? ??:`, error);
                    if (error.response && error.response.data && error.response.data.error) {
                        App.showNotification(`?? ?? ??: ${error.response.data.error}`, 'danger');
                    } else {
                        App.showNotification(`?? ??? ??????. (?? ID: ${productId})`, 'danger');
                    }
                    return; // ???? ???? ??
                }
            }
        }
        
        if (pendingApprovalCount > 0) {
            App.showNotification(
                '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC774\uC6A9\uAD8C\uC774 \uBC18\uC601\uB429\uB2C8\uB2E4. (\uC2B9\uC778 \uB300\uAE30 ' + pendingApprovalCount + '\uAC74)',
                'info'
            );
        }
        if (successCount > 0) {
            let message = `${successCount}? ?? ??? ???????.`;
            if (conflictCount > 0) {
                message += ` (${conflictCount}?? ?? ??? ?????)`;
            }
            App.showNotification(message, successCount > 0 && conflictCount === 0 ? 'success' : 'warning');
        } else if (conflictCount > 0) {
            App.showNotification('??? ??? ?? ??? ?????. ?? ??? ??????.', 'warning');
        }
        
        closeNewProductPurchaseModal();

        var roleNewProd = (App.currentRole || '').toUpperCase();
        if (
            pendingApprovalCount > 0 &&
            (roleNewProd === 'ADMIN' || roleNewProd === 'MANAGER') &&
            typeof App.goToDashboardMemberApprovals === 'function'
        ) {
            App.goToDashboardMemberApprovals();
            return;
        }

        if (memberId && typeof App.goToMembersWithFocus === 'function') {
            App.goToMembersWithFocus(memberId);
            return;
        }

        // ?? ??/?? ?? ?? ???? (??? ?????)
        const expiringMembersModal = document.getElementById('expiringMembersModal');
        if (expiringMembersModal && expiringMembersModal.style.display !== 'none') {
            if (typeof window.openExpiringMembersModal === 'function') {
                await window.openExpiringMembersModal();
            }
        }
        
        // ??? ????? ?? ????
        if (typeof renderMembersList === 'function') {
            renderMembersList();
        }
        
        // ?? ?? ?? ?? ? ??? ??? ??
        try {
            const updatedMember = await App.api.get(`/members/${memberId}`);
            currentMemberDetail = updatedMember;
            
            // ?? ?? ?? ??
            document.getElementById('member-detail-title').textContent = `${updatedMember.name} ?? ??`;
            const memberDetailModal = document.getElementById('member-detail-modal');
            if (memberDetailModal) {
                memberDetailModal.style.display = 'flex';
            }
            
            // ? ?? ?? ??? ??? ?? (?? ??? ??)
            document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
                // ?? ???? ??? ??
                if (!btn.hasAttribute('data-listener-added')) {
                    btn.setAttribute('data-listener-added', 'true');
                    btn.addEventListener('click', function() {
                        const tab = this.getAttribute('data-tab');
                        switchMemberDetailTab(tab, updatedMember);
                    });
                }
            });
            
            // ??? ??? ??
            switchMemberDetailTab('products', updatedMember);
        } catch (error) {
            App.err('?? ?? ???? ??:', error);
            // ??? ???? ?? ?? ?? ?? ??
            if (currentMemberDetail) {
                const memberDetailModal = document.getElementById('member-detail-modal');
                if (memberDetailModal) {
                    memberDetailModal.style.display = 'flex';
                }
                switchMemberDetailTab('products', currentMemberDetail);
            }
        }
        
    } catch (error) {
        App.err('?? ?? ?? ??:', error);
        if (error.response && error.response.data && error.response.data.error) {
            App.showNotification(error.response.data.error, 'danger');
        } else {
            App.showNotification('?? ??? ??????.', 'danger');
        }
    }
}

// ?? ?? ?? ? ??
document.addEventListener('click', function(event) {
    const newProductModal = document.getElementById('newProductPurchaseModal');
    if (newProductModal && event.target === newProductModal) {
        closeNewProductPurchaseModal();
    }
});

// ??/??? ??
async function submitExtendRepurchase() {
    const { memberId, memberProductId, productType, action } = extendRepurchaseData;
    
    if (!memberId || !action) {
        App.showNotification('?? ??? ???????.', 'danger');
        return;
    }
    
    // ??? ?? memberProductId? ??
    if (action === 'extend' && !memberProductId) {
        App.showNotification('??? ??? ??? ????.', 'danger');
        return;
    }
    
    const submitBtn = document.getElementById('extend-repurchase-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '?? ?...';
    
    try {
        if (action === 'extend') {
            // ?? ?? (??? ?? ? ????? ?? ? ??)
            let rawInput = '';
            if (productType === 'COUNT_PASS') {
                const el = document.getElementById('extend-count');
                rawInput = el ? el.value : '';
            } else if (productType === 'MONTHLY_PASS') {
                const el = document.getElementById('extend-days');
                rawInput = el ? el.value : '';
            } else {
                App.showNotification('??? ?? ??? ??? ? ????.', 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = action === 'extend' ? '????' : '?????';
                return;
            }
            const t = String(rawInput).trim();
            if (t === '') {
                App.showNotification('?? ?? ??? ???.', 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = action === 'extend' ? '????' : '?????';
                return;
            }
            if (!/^\d+$/.test(t)) {
                App.showNotification('??? ??? ???.', 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = action === 'extend' ? '????' : '?????';
                return;
            }
            const extendValue = parseInt(t, 10);
            if (!extendValue || extendValue <= 0) {
                App.showNotification('??? ?? 1 ????? ???.', 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = action === 'extend' ? '????' : '?????';
                return;
            }
            
            const result = await App.api.put(`/member-products/${memberProductId}/extend`, {
                days: extendValue
            });
            
            if (result && result.pendingApproval) {
                App.showNotification(result.message || '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC5F0\uC7A5\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.', 'info');
            } else {
                App.showNotification(result.message || '??? ???????.', 'success');
            }
            closeExtendRepurchaseModal();
            var roleExtDash = (App.currentRole || '').toUpperCase();
            if (
                result &&
                result.pendingApproval &&
                (roleExtDash === 'ADMIN' || roleExtDash === 'MANAGER') &&
                typeof App.goToDashboardMemberApprovals === 'function'
            ) {
                App.goToDashboardMemberApprovals();
                return;
            }
            if (memberId && typeof App.goToMembersWithFocus === 'function') {
                App.goToMembersWithFocus(memberId);
                return;
            }
            await openExpiringMembersModal();
        } else if (action === 'repurchase') {
            // ??? ?? - ?? ??? ??? ???? ?? ??
            const memberProduct = await App.api.get(`/member-products/${memberProductId}`);
            if (!memberProduct || !memberProduct.product || !memberProduct.product.id) {
                App.err('MemberProduct ?? Product ??? ?? ? ????:', memberProductId);
                App.showNotification('?? ??? ??? ? ????.', 'danger');
                return;
            }
            const productId = memberProduct.product.id;

            let coachIdForPurchase =
                memberProduct.coachId ||
                (memberProduct.coach && memberProduct.coach.id) ||
                (memberProduct.product && memberProduct.product.coach && memberProduct.product.coach.id);
            if (!coachIdForPurchase) {
                App.showNotification('? ???? ?? ??? ?? ???? ? ????. ?? ???? ??? ??? ? ?? ??? ???.', 'warning');
                submitBtn.disabled = false;
                submitBtn.textContent = action === 'extend' ? '????' : '?????';
                return;
            }
            
            let purchaseData = {
                productId: productId,
                skipPayment: false,
                coachId: coachIdForPurchase,
                productSelectionIntent: 'NEW_CATALOG'
            };
            
            if (productType === 'COUNT_PASS') {
                const count = parseInt(document.getElementById('repurchase-count').value);
                purchaseData.count = count;
            } else if (productType === 'MONTHLY_PASS') {
                const days = parseInt(document.getElementById('repurchase-days').value);
                purchaseData.days = days;
            }
            
            const result = await App.api.post(`/members/${memberId}/products`, purchaseData);
            
            if (result && result.pendingApproval) {
                App.showNotification(
                    result.message || '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC774\uC6A9\uAD8C\uC774 \uBC18\uC601\uB429\uB2C8\uB2E4.',
                    'info'
                );
            } else {
                App.showNotification('??? ????????.', 'success');
            }
            closeExtendRepurchaseModal();
            var roleRepDash = (App.currentRole || '').toUpperCase();
            if (
                result &&
                result.pendingApproval &&
                (roleRepDash === 'ADMIN' || roleRepDash === 'MANAGER') &&
                typeof App.goToDashboardMemberApprovals === 'function'
            ) {
                App.goToDashboardMemberApprovals();
                return;
            }
            if (memberId && typeof App.goToMembersWithFocus === 'function') {
                App.goToMembersWithFocus(memberId);
                return;
            }
            await openExpiringMembersModal();
        }
    } catch (error) {
        App.err('??/??? ??:', error);
        let errorMsg = '?? ? ??? ??????.';
        if (error.response && error.response.data && error.response.data.error) {
            errorMsg = error.response.data.error;
        }
        App.showNotification(errorMsg, 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = action === 'extend' ? '????' : '?????';
    }
}

// ?????? ?? ?? ?? ??
async function openMemberDetailFromDashboard(memberId) {
    try {
        const member = await App.api.get(`/members/${memberId}`);
        currentMemberDetail = member;
        document.getElementById('member-detail-title').textContent = `${member.name} \uC0C1\uC138 \uC815\uBCF4`;
        
        switchMemberDetailTab('info', member);
        
        const modal = document.getElementById('member-detail-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // ? ?? ?? ??? ??? ??
        document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
            // ?? ??? ?? ? ?? ??
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', function() {
                const tab = this.getAttribute('data-tab');
                switchMemberDetailTab(tab, member);
            });
        });
    } catch (error) {
        App.err('?? ?? ?? ?? ??:', error);
        App.showNotification('?? ??? ????? ??????.', 'danger');
    }
}

// ?? ?? ?? ??
function closeMemberDetailModal() {
    const modal = document.getElementById('member-detail-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentMemberDetail = null;
}

// ?? ?? ? ??
function switchMemberDetailTab(tab, member = null) {
    // ? ?? ??? ?? ????
    document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    var modalBox = document.querySelector('#member-detail-modal .member-detail-modal-box');
    if (modalBox) modalBox.setAttribute('data-detail-tab', tab || '');
    // member? ???? ???? ??? currentMemberDetail ??
    if (!member && currentMemberDetail) {
        member = currentMemberDetail;
    }
    
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    
    switch(tab) {
        case 'info':
            content.innerHTML = renderMemberDetailInfo(member);
            break;
        case 'timeline':
            if (member?.id && typeof loadMemberTimeline === 'function') {
                loadMemberTimeline(member.id);
            } else if (member?.id) {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ?...</p>';
                App.api.get('/members/' + member.id + '/timeline').then(events => {
                    content.innerHTML = typeof renderMemberTimelineContent === 'function' ? renderMemberTimelineContent(events) : '<pre>' + JSON.stringify(events, null, 2) + '</pre>';
                }).catch(() => {
                    content.innerHTML = '<p style="color: var(--text-muted);">?? ????? ??? ? ????.</p>';
                });
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ??? ??? ? ????.</p>';
            }
            break;
        case 'products':
            if (member?.id) {
                loadMemberProductsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ??? ??? ? ????.</p>';
            }
            break;
        case 'payments':
            if (member?.id) {
                loadMemberPaymentsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ??? ??? ? ????.</p>';
            }
            break;
        case 'bookings':
            if (member?.id) {
                loadMemberBookingsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ??? ??? ? ????.</p>';
            }
            break;
        case 'attendance':
            if (member?.id) {
                loadMemberAttendanceForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ??? ??? ? ????.</p>';
            }
            break;
        case 'product-history':
            if (member?.id) {
                loadMemberProductHistoryForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">?? ??? ??? ? ????.</p>';
            }
            break;
        case 'stats':
            content.innerHTML = (typeof renderMemberStats === 'function' ? renderMemberStats(member) : '<p style="color: var(--text-muted);">?? ???? ??? ? ????.</p>');
            break;
        case 'memo':
            content.innerHTML = renderMemberMemo(member);
            break;
    }
}

// ?? ?? ?? ?? ???
function renderMemberDetailInfo(member) {
    if (!member) return '<p>\uB85C\uB529 \uC911...</p>';
    const coachDisplay = (window.getMemberCoachDisplayFromProducts && typeof window.getMemberCoachDisplayFromProducts === 'function')
        ? window.getMemberCoachDisplayFromProducts(member)
        : (member.coach?.name || '-');
    return `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uD68C\uC6D0\uBC88\uD638</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.memberNumber || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uC774\uB984</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.name || '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uC804\uD654\uBC88\uD638</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.phoneNumber || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uB4F1\uAE09</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getGradeText(member.grade) || '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uD559\uAD50/\uC18C\uC18D</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.school || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uC0C1\uD0DC</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getStatusText(member.status) || '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uB2F4\uB2F9 \uCF54\uCE58</label>
                <div class="form-control" style="background: var(--bg-tertiary); white-space: pre-line; line-height: 1.6;">${coachDisplay}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uAC00\uC785\uC77C</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.joinDate ? App.formatDate(member.joinDate) : '-'}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uCD5C\uADFC \uBC29\uBB38</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.latestLessonDate ? App.formatDate(member.latestLessonDate) : '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uB204\uC801 \uACB0\uC81C</label>
                <div class="form-control" style="background: var(--bg-tertiary); font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(member.totalPayment || 0)}</div>
            </div>
        </div>
    `;
}

// ?? ?? ???
function renderMemberMemo(member) {
    if (!member) return '<p>\uB85C\uB529 \uC911...</p>';
    return `
        <div class="form-group">
            <label class="form-label">\uCF54\uCE58 \uBA54\uBAA8</label>
            <div class="form-control" style="background: var(--bg-tertiary); min-height: 200px; white-space: pre-wrap; padding: 12px;">${member.memo || '\uB4F1\uB85D\uB41C \uBA54\uBAA8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div>
        </div>
    `;
}

// ?? ?? ??? ??
function getGradeText(grade) {
    if (App.MemberGrade && typeof App.MemberGrade.getText === 'function') {
        return App.MemberGrade.getText(grade);
    }
    const gradeMap = {
        'SOCIAL': '\uC0AC\uD68C\uC778',
        'YOUTH': '\uC720\uC2A4',
        'ELEMENTARY': '\uCD08\uB4F1',
        'MIDDLE': '\uC911\uB4F1',
        'HIGH': '\uACE0\uB4F1',
        'ADULT': '\uC131\uC778',
        'OTHER': '\uAE30\uD0C0 \uC885\uBAA9',
        'ELITE_ELEMENTARY': '\uC5D8\uB9AC\uD2B8 (\uCD08)',
        'ELITE_MIDDLE': '\uC5D8\uB9AC\uD2B8 (\uC911)',
        'ELITE_HIGH': '\uC5D8\uB9AC\uD2B8 (\uACE0)'
    };
    return gradeMap[grade] || grade || '-';
}

// ?? ?? ??? ??
function getStatusText(status) {
    if (App.Status && App.Status.member && typeof App.Status.member.getText === 'function') {
        return App.Status.member.getText(status);
    }
    const statusMap = {
        'ACTIVE': '\uD65C\uC131',
        'INACTIVE': '\uBE44\uD65C\uC131',
        'WITHDRAWN': '\uD0C8\uD1F4'
    };
    return statusMap[status] || status || '-';
}

// ?? ??? ?? ?? ??
function getRemainingCountColor(count) {
    // members.js?? ??? ??? ??? ??, ??? ?? ??
    if (typeof window.getRemainingCountColor === 'function' && window.getRemainingCountColor !== getRemainingCountColor) {
        return window.getRemainingCountColor(count);
    }
    // ?? ?? (?? ?? ??)
    if (count >= 1 && count <= 2) {
        return '#dc3545'; // ??? (1~2?)
    } else if (count >= 3 && count <= 5) {
        // CSS ?? --warning? ??? ?? ?? (????: #F1C40F, ?????: #FFC107)
        return getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#F1C40F'; // ??? (3~5?)
    } else {
        return '#28a745'; // ??? (6? ??)
    }
}

// ????? ?? ??? ?? ?? ?? (members.js? ?? ??)
function getExpiryDateColor(expiryDate) {
    // window.getExpiryDateColor? ???? ?? ??? ?? ???? ??
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
        return '#DC3545'; // ??? (?? ??)
    } else if (daysUntilExpiry <= 2) {
        return '#DC3545'; // ??? (2? ??)
    } else if (daysUntilExpiry <= 5) {
        // CSS ?? --warning? ??? ?? ?? (????: #F1C40F, ?????: #FFC107)
        return getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#F1C40F'; // ??? (3~5?)
    } else if (daysUntilExpiry <= 7) {
        // CSS ?? --warning? ??? ?? ??
        return getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#F1C40F'; // ??? (6~7?)
    } else {
        return 'var(--accent-primary)'; // ?? ?? (7? ??)
    }
}

// members.js renderProductsList\uC640 \uB3D9\uC77C \uADDC\uCE59(\uC720\uC608 \uC18C\uC9C4\u00B7\uAE30\uAC04 \uC885\uB8CC\u00B7\uB9C8\uAC10)\uC73C\uB85C \uD1B5\uC77C
function renderProductsListForDashboard(products) {
    if (typeof window.renderProductsList === 'function') {
        return window.renderProductsList(products, null);
    }
    const list = App.filterMemberProductsForDisplayList
        ? App.filterMemberProductsForDisplayList(products || [])
        : (products || []);
    if (!list || list.length === 0) {
        return '<p style="color: var(--text-muted);">\uB4F1\uB85D\uB41C \uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    return (
        '<p style="color: var(--text-muted);">\uC774\uC6A9\uAD8C \uBAA9\uB85D\uC744 \uB744\uC6B0\uB824\uBA74 members.js\uAC00 \uB85C\uB4DC\uB418\uC5B4\uC57C \uD569\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.</p>'
    );
}

// ?? ?? - ??? ?? ??
async function loadMemberProductsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">?? ?...</p>';
    
    try {
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}&forMemberDetailUi=true`);
        
        if (!memberProducts || memberProducts.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">???? ????.</p>';
            return;
        }
        
        // dashboard.js? renderProductsListForDashboard ?? ?? ?? members.js? ?? ??
        if (typeof window.renderProductsList === 'function') {
            content.innerHTML = window.renderProductsList(memberProducts, memberId);
            if (typeof window.applyCoachNameColors === 'function') {
                window.applyCoachNameColors(content);
            }
        } else {
            content.innerHTML = renderProductsListForDashboard(memberProducts);
        }
    } catch (error) {
        App.err('??? ?? ?? ??:', error);
        content.innerHTML = '<p style="color: var(--danger);">??? ??? ????? ??????.</p>';
    }
}

// \uB300\uC2DC\uBCF4\uB4DC \uD68C\uC6D0 \uC0C1\uC138 - \uACB0\uC81C \uB0B4\uC5ED \uD0ED
async function loadMemberPaymentsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uBD88\uB7EC\uC624\uB294 \uC911...</p>';
    
    try {
        const payments = await App.api.get(`/members/${memberId}/payments`);
        
        if (!payments || payments.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uACB0\uC81C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            return;
        }
        
        content.innerHTML = renderPaymentsList(payments);
    } catch (error) {
        App.err('\uACB0\uC81C \uB0B4\uC5ED \uC870\uD68C \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--danger);">\uACB0\uC81C \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

// \uB300\uC2DC\uBCF4\uB4DC \uD68C\uC6D0 \uC0C1\uC138 \uACB0\uC81C \uD14C\uC774\uBE14 (\uACB0\uC81C\uC77C\uC2DC, \uBD84\uB958, \uC218\uB2E8 \uB4F1)
function renderPaymentsList(payments) {
    if (!payments || payments.length === 0) {
        return '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uACB0\uC81C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    
    function getPaymentMethodText(method) {
        const methodMap = {
            'CASH': '\uD604\uAE08',
            'CARD': '\uCE74\uB4DC',
            'BANK_TRANSFER': '\uACC4\uC88C\uC774\uCCB4',
            'EASY_PAY': '\uAC04\uD3B8\uACB0\uC81C'
        };
        return methodMap[method] || method || '-';
    }
    
    function getCategoryText(category) {
        const categoryMap = {
            'RENTAL': '\uB300\uC5EC',
            'LESSON': '\uB808\uC2A8',
            'PRODUCT_SALE': '\uC0C1\uD488\uD310\uB9E4'
        };
        return categoryMap[category] || category || '-';
    }
    
    function getStatusText(status) {
        const statusMap = {
            'COMPLETED': '\uC644\uB8CC',
            'PARTIAL': '\uBD80\uBD84',
            'REFUNDED': '\uD658\uBD88'
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
                        <th>\uACB0\uC81C\uC77C\uC2DC</th>
                        <th>\uC0C1\uD488</th>
                        <th>\uBD84\uB958</th>
                        <th>\uB2F4\uB2F9 \uCF54\uCE58</th>
                        <th>\uACB0\uC81C\uC218\uB2E8</th>
                        <th>\uAE08\uC561</th>
                        <th>\uC0C1\uD0DC</th>
                        <th>\uBE44\uACE0</th>
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
                                ${refundAmount > 0 ? `<br><small style="color: var(--danger);">\uD658\uBD88: ${App.formatCurrency(refundAmount)}</small>` : ''}
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

// \uB300\uC2DC\uBCF4\uB4DC \uD68C\uC6D0 \uC0C1\uC138 - \uC608\uC57D \uB0B4\uC5ED \uD0ED
async function loadMemberBookingsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uBD88\uB7EC\uC624\uB294 \uC911...</p>';
    
    try {
        const bookings = await App.api.get(`/members/${memberId}/bookings`);
        
        if (!bookings || bookings.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uC608\uC57D \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            return;
        }
        
        // members.js? renderBookingsList? ??? ?? ??
        function getBookingStatusText(status) {
            const statusMap = {
                'PENDING': '\uB300\uAE30',
                'CONFIRMED': '\uD655\uC815',
                'CANCELLED': '\uCDE8\uC18C',
                'NO_SHOW': '\uB178\uC1FC',
                'COMPLETED': '\uC644\uB8CC'
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
                            <th>\uC608\uC57D ID</th>
                            <th>\uC0C1\uD488/\uC774\uC6A9\uAD8C</th>
                            <th>\uCF54\uCE58</th>
                            <th>\uC2DC\uC124</th>
                            <th>\uC77C\uC2DC</th>
                            <th>\uC0C1\uD0DC</th>
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
        
        // ?? ?? ?? ??
        if (typeof window.applyCoachNameColors === 'function') {
            window.applyCoachNameColors(content);
        }
    } catch (error) {
        App.err('\uC608\uC57D \uB0B4\uC5ED \uC870\uD68C \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--danger);">\uC608\uC57D \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

// \uB300\uC2DC\uBCF4\uB4DC \uD68C\uC6D0 \uC0C1\uC138 - \uCD9C\uC11D \uB0B4\uC5ED \uD0ED
async function loadMemberAttendanceForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uBD88\uB7EC\uC624\uB294 \uC911...</p>';
    
    try {
        const attendance = await App.api.get(`/members/${memberId}/attendance`);
        
        if (!attendance || attendance.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uCD9C\uC11D \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            return;
        }
        
        // members.js? renderAttendanceList? ??? ?? ??
        function getAttendanceStatusText(status) {
            const statusMap = {
                'PRESENT': '\uCD9C\uC11D',
                'ABSENT': '\uACB0\uC11D',
                'LATE': '\uC9C0\uAC01',
                'NO_SHOW': '\uB178\uC1FC'
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
                            <th>\uC77C\uC790</th>
                            <th>\uC2DC\uC124</th>
                            <th>\uC785\uC7A5 \uC2DC\uAC01</th>
                            <th>\uD1F4\uC7A5 \uC2DC\uAC01</th>
                            <th>\uC774\uC6A9\uAD8C \uC815\uBCF4</th>
                            <th>\uC0C1\uD0DC</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${attendance.map(a => {
                            const facilityName = a.facility?.name || a.facilityName || '-';
                            const date = a.date ? App.formatDate(a.date) : '-';
                            const checkInTime = a.checkInTime ? App.formatDateTime(a.checkInTime) : (a.status === 'PRESENT' ? '<span style="color: var(--text-muted);">\uAE30\uB85D \uC5C6\uC74C</span>' : '-');
                            const checkOutTime = a.checkOutTime ? App.formatDateTime(a.checkOutTime) : (a.checkInTime ? '<span style="color: var(--text-muted);">\uAE30\uB85D \uC5C6\uC74C</span>' : '-');
                            const status = a.status || 'UNKNOWN';
                            const statusText = getAttendanceStatusText(status);
                            const statusBadge = getAttendanceStatusBadge(status);
                            
                            // ??? ?? ??
                            let productInfo = '-';
                            if (a.productHistory) {
                                const productName = a.productHistory.productName || '\uC774\uC6A9\uAD8C';
                                const changeAmount = a.productHistory.changeAmount || 0;
                                const remaining = a.productHistory.remainingCountAfter || 0;
                                if (changeAmount < 0) {
                                    productInfo = `${productName} ${changeAmount} (\uC794\uC5EC: ${remaining}\uD68C)`;
                                } else {
                                    productInfo = `${productName} +${changeAmount} (\uC794\uC5EC: ${remaining}\uD68C)`;
                                }
                            } else if (a.booking?.memberProduct) {
                                const productName = a.booking.memberProduct.product?.name || '\uC774\uC6A9\uAD8C';
                                productInfo = `${productName} (\uCC28\uAC10 \uB0B4\uC5ED \uC5C6\uC74C)`;
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
        App.err('\uCD9C\uC11D \uB0B4\uC5ED \uC870\uD68C \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--danger);">\uCD9C\uC11D \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

// \uB300\uC2DC\uBCF4\uB4DC \uD68C\uC6D0 \uC0C1\uC138 - \uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uC774\uB825 \uD0ED
async function loadMemberProductHistoryForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uBD88\uB7EC\uC624\uB294 \uC911...</p>';
    
    try {
        const history = await App.api.get(`/members/${memberId}/product-history`);
        
        if (!history || history.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uC774\uB825\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            return;
        }
        
        function getTransactionTypeText(type) {
            const typeMap = {
                'CHARGE': '\uCDA9\uC804/\uC5F0\uC7A5',
                'DEDUCT': '\uCC28\uAC10',
                'ADJUST': '\uC870\uC815'
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
            const branchNames = { SAHA: '\uC0AC\uD558', YEONSAN: '\uC5F0\uC0B0', RENTAL: '\uB300\uC5EC' };
            return (branch && branchNames[branch]) ? branchNames[branch] : '-';
        }
        
        const historyHtml = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>\uC608\uC57D ID</th>
                            <th>\uC77C\uC2DC</th>
                            <th>\uC774\uC6A9\uAD8C</th>
                            <th>\uC9C0\uC810</th>
                            <th>\uAD6C\uBD84</th>
                            <th>\uBCC0\uB3D9\uB7C9</th>
                            <th>\uC794\uC5EC \uD69F\uC218</th>
                            <th>\uBE44\uACE0</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(h => {
                            const bookingId = h.bookingId != null ? h.bookingId : '-';
                            const productName = (h.memberProduct && (h.memberProduct.name || h.memberProduct.product?.name || h.memberProduct.productName)) || '\uC774\uB984 \uC5C6\uC74C';
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
                                <td>${remaining !== '-' && remaining !== null && remaining !== undefined ? remaining + '\uD68C' : '-'}</td>
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
        App.err('\uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uC774\uB825 \uC870\uD68C \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--danger);">\uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uC774\uB825\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

// ?? ?? ?? ? ??
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

// ?? ?? ?? ??
function calculateMonthlyGrowth(members) {
    const labels = [];
    const data = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // ??? ??? ??? ?? ??
        if (date.getFullYear() !== currentYear) {
            labels.push(`${date.getFullYear()}\uB144 ${date.getMonth() + 1}\uC6D4`);
        } else {
            labels.push(`${date.getMonth() + 1}\uC6D4`);
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

// ?? ?? ??
function calculateMonthlyRevenue(payments) {
    const labels = [];
    const data = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // ??? ??? ??? ?? ??
        if (date.getFullYear() !== currentYear) {
            labels.push(`${date.getFullYear()}\uB144 ${date.getMonth() + 1}\uC6D4`);
        } else {
            labels.push(`${date.getMonth() + 1}\uC6D4`);
        }
        
        const revenue = payments
            .filter(p => {
                if (!p.paidAt || p.status !== 'COMPLETED') return false;
                // paidAt? "2026-01-17T21:35:00" ??
                const payMonth = p.paidAt.substring(0, 7);
                return payMonth === monthStr;
            })
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        data.push(revenue);
    }
    
    return { labels, data };
}

// ?? ?? ?? ?? ??
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
                label: '\uD68C\uC6D0 \uC218',
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

// ?? ?? ?? ??
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
                label: '\uB9E4\uCD9C',
                data: data.data,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 50  // ?? ?? ? ?? (??)
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
                            return '\uB9E4\uCD9C: \u20A9' + context.parsed.y.toLocaleString();
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
                            return (value / 10000).toFixed(0) + '\uB9CC\uC6D0';
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

// MemberProduct ?? ?? ?? ??
async function calculateMonthlyRevenueFromMemberProducts() {
    const labels = [];
    const data = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    try {
        // ?? ?? ??
        const members = await App.api.get('/members');
        
        // ? ??? MemberProduct ??? ???? ?? ?? ??
        const monthlyRevenueMap = new Map();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // ??? ??? ??? ?? ??
            if (date.getFullYear() !== currentYear) {
                labels.push(`${date.getFullYear()}\uB144 ${date.getMonth() + 1}\uC6D4`);
            } else {
                labels.push(`${date.getMonth() + 1}\uC6D4`);
            }
            
            monthlyRevenueMap.set(monthStr, 0);
        }
        
        // ? ??? MemberProduct?? ?? ?? ??
        for (const member of members) {
            if (member.memberProducts && Array.isArray(member.memberProducts)) {
                for (const mp of member.memberProducts) {
                    if (mp.purchaseDate && mp.product && mp.product.price) {
                        // purchaseDate? "2026-01-24T13:00:00" ??
                        const purchaseMonth = mp.purchaseDate.substring(0, 7);
                        if (monthlyRevenueMap.has(purchaseMonth)) {
                            const currentRevenue = monthlyRevenueMap.get(purchaseMonth);
                            monthlyRevenueMap.set(purchaseMonth, currentRevenue + (mp.product.price || 0));
                        }
                    }
                }
            }
        }
        
        // ?? ?? ??? ??
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            data.push(monthlyRevenueMap.get(monthStr) || 0);
        }
        
    } catch (error) {
        App.err('MemberProduct ?? ?? ?? ?? ??:', error);
        // ??? ?? ??? ?? ? ??? ???.
        if (labels.length === 0) {
            for (let i = 5; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                if (date.getFullYear() !== currentYear) {
                    labels.push(`${date.getFullYear()}\uB144 ${date.getMonth() + 1}\uC6D4`);
                } else {
                    labels.push(`${date.getMonth() + 1}\uC6D4`);
                }
            }
        }
        // ???? 0?? ???.
        for (let i = 5; i >= 0; i--) {
            data.push(0);
        }
    }
    
    return { labels, data };
}

(function wireExpiringMembersModalNameFilter() {
    function onFilterInput() {
        if (typeof renderMembersList === 'function') {
            renderMembersList();
        }
    }
    function tryWire() {
        var el = document.getElementById('expiring-members-name-filter');
        if (el && !el.getAttribute('data-name-filter-wired')) {
            el.setAttribute('data-name-filter-wired', '1');
            el.addEventListener('input', onFilterInput);
            el.addEventListener('search', onFilterInput);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryWire);
    } else {
        tryWire();
    }
})();

document.addEventListener('afbs-operational-coach-filter-changed', function() {
    if (typeof loadDashboardData === 'function' && document.getElementById('kpi-grid')) {
        loadDashboardData();
    }
});
