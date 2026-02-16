// 예약/대관 관리 페이지 JavaScript

let currentDate = new Date();
let currentView = 'calendar';
let currentPage = 1;
let selectedBooking = null; // 현재 선택된 예약
// 대관 지점 필터: null = 전체, 'SAHA' = 사하점만, 'YEONSAN' = 연산점만
window.rentalsFilterBranch = window.rentalsFilterBranch || null;
// 예약 없음 모달 예약 타이머 (지점 변경 시 취소용)
window._rentalsEmptyModalTimeout = null;

function clearRentalsEmptyModalTimeout() {
    if (window._rentalsEmptyModalTimeout) {
        clearTimeout(window._rentalsEmptyModalTimeout);
        window._rentalsEmptyModalTimeout = null;
    }
}

/** 대관 필터 적용 시 예약이 없을 때 모달로 안내 */
function showRentalsEmptyModal(message) {
    if (!message) message = '해당 조건의 대관 예약이 없습니다.';
    const existing = document.getElementById('rentals-empty-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'rentals-empty-modal';
    overlay.className = 'modal-overlay active';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 360px; margin: 20px;">
            <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 16px 20px;">
                <h2 class="modal-title" style="margin: 0; font-size: 18px;">안내</h2>
                <button type="button" class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">×</button>
            </div>
            <div class="modal-body" style="padding: 24px 20px;">
                <p style="margin: 0 0 20px; font-size: 15px; color: var(--text-primary);">${App.escapeHtml(message)}</p>
                <button type="button" class="btn btn-primary" style="width: 100%;">확인</button>
            </div>
        </div>
    `;
    const close = function() {
        overlay.remove();
        document.body.style.overflow = '';
    };
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.btn.btn-primary').onclick = close;
    overlay.onclick = function(e) { if (e.target === overlay) close(); };
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
}

// 목적 변경 시 레슨 카테고리 필드 표시/숨김
function toggleLessonCategory() {
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryGroup = document.getElementById('lesson-category-group');
    if (lessonCategoryGroup) {
        lessonCategoryGroup.style.display = (purpose === 'LESSON') ? 'block' : 'none';
    }
}

// 반복 예약 옵션 표시/숨김
function toggleRepeatOptions() {
    const enabled = document.getElementById('booking-repeat-enabled').checked;
    const repeatOptions = document.getElementById('repeat-options');
    if (repeatOptions) {
        repeatOptions.style.display = enabled ? 'block' : 'none';
    }
}

// 코치별 색상 가져오기 (common.js의 App.CoachColors 사용)
function getCoachColor(coach) {
    return App.CoachColors.getColor(coach);
}

// 날짜의 모든 예약에서 코치 색상 추출하여 배경색 결정
function getCoachColors(bookings) {
    const colors = new Set();
    bookings.forEach(booking => {
        // 예약에 직접 할당된 코치 또는 회원의 코치
        const coach = booking.coach || (booking.member && booking.member.coach ? booking.member.coach : null);
        if (coach) {
            const color = getCoachColor(coach);
            if (color) colors.add(color);
        }
    });
    return Array.from(colors);
}

// 배경색 결정 (여러 코치가 있으면 혼합)
function getDayBackgroundColor(coachColors) {
    if (coachColors.length === 0) return null;
    if (coachColors.length === 1) {
        // 단일 색상이면 투명도 적용
        return coachColors[0] + '20'; // 20 = 약 12% 투명도
    }
    // 여러 색상이면 그라데이션 (간단히 첫 번째 색상 사용)
    return coachColors[0] + '15'; // 15 = 약 8% 투명도
}

// 대관: 시작 시간(HH:MM) 입력 시 종료 시간을 시작+2시간으로 반환
function getRentalEndTimeTwoHoursLater(startTimeStr) {
    if (!startTimeStr || typeof startTimeStr !== 'string') return '';
    const trimmed = startTimeStr.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '';
    let h = parseInt(match[1], 10);
    let m = parseInt(match[2], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return '';
    h = (h + 2) % 24;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

document.addEventListener('DOMContentLoaded', function() {
    // 필터+통계 카드 테두리 (캐시/빌드 무관하게 JS로 적용)
    var statsCard = document.getElementById('filter-stats-card');
    if (!statsCard) {
        var container = document.getElementById('rentals-stats-container');
        if (container) statsCard = container.closest('.card');
    }
    if (statsCard) {
        statsCard.style.setProperty('border', '1px solid #4A5568', 'important');
        statsCard.style.borderRadius = '12px';
    }
    initializeBookings();
    
    // 대관: 시작 시간 입력 시 종료 시간을 무조건 2시간 후로 설정
    const bookingStartTime = document.getElementById('booking-start-time');
    const bookingEndTime = document.getElementById('booking-end-time');
    if (bookingStartTime && bookingEndTime) {
        bookingStartTime.addEventListener('input', function() {
            const end = getRentalEndTimeTwoHoursLater(this.value);
            if (end) bookingEndTime.value = end;
        });
        bookingStartTime.addEventListener('change', function() {
            const end = getRentalEndTimeTwoHoursLater(this.value);
            if (end) bookingEndTime.value = end;
        });
    }
    const quickStartTime = document.getElementById('quick-start-time');
    const quickEndTime = document.getElementById('quick-end-time');
    if (quickStartTime && quickEndTime) {
        quickStartTime.addEventListener('input', function() {
            const end = getRentalEndTimeTwoHoursLater(this.value);
            if (end) quickEndTime.value = end;
        });
        quickStartTime.addEventListener('change', function() {
            const end = getRentalEndTimeTwoHoursLater(this.value);
            if (end) quickEndTime.value = end;
        });
    }
    
    // 필터 셀렉트/날짜 변경 시 적용 버튼 없이 바로 반영
    const filterFacility = document.getElementById('filter-facility');
    const filterStatus = document.getElementById('filter-status');
    const filterDateStart = document.getElementById('filter-date-start');
    const filterDateEnd = document.getElementById('filter-date-end');
    if (filterFacility) filterFacility.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterDateStart) filterDateStart.addEventListener('change', applyFilters);
    if (filterDateEnd) filterDateEnd.addEventListener('change', applyFilters);
    
    // 전체 확인: 현재 필터에 맞는 대기 예약 일괄 확정 (예약 목록 탭에서만 표시)
    const filterResetBtn = document.getElementById('rentals-filter-reset');
    if (filterResetBtn) {
        filterResetBtn.addEventListener('click', function() {
            confirmAllPendingRentals();
        });
    }
    
    // Delete 키로 예약 삭제
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' && selectedBooking) {
            e.preventDefault();
            deleteSelectedBooking();
        }
    });
});

// 필터용 시설 드롭다운 로드 (사하점·연산점만 표시)
async function loadFilterFacilities() {
    const select = document.getElementById('filter-facility');
    if (!select) return;
    try {
        const params = new URLSearchParams();
        const config = window.BOOKING_PAGE_CONFIG || { facilityType: 'RENTAL' };
        if (config.facilityType) params.append('facilityType', config.facilityType);
        const facilities = await App.api.get(`/facilities?${params.toString()}`);
        if (!facilities || !Array.isArray(facilities)) return;
        const allowed = ['SAHA', 'YEONSAN'];
        const filtered = facilities.filter(f => {
            const b = (f.branch && f.branch.toString().toUpperCase()) || '';
            return allowed.includes(b);
        });
        const currentValue = select.value;
        select.innerHTML = '<option value="">전체 시설</option>';
        filtered.forEach(f => {
            if (!f.id || !f.name) return;
            const opt = document.createElement('option');
            opt.value = f.id.toString();
            opt.textContent = f.name;
            select.appendChild(opt);
        });
        if (currentValue && filtered.some(f => f.id.toString() === currentValue)) {
            select.value = currentValue;
        }
    } catch (error) {
        App.err('필터 시설 목록 로드 실패:', error);
    }
}

async function initializeBookings() {
    // 뷰 전환 이벤트
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            switchView(view);
        });
    });
    
    // 필터용 시설 목록 로드 (사하점·연산점만)
    await loadFilterFacilities();
    
    // 시설 목록 로드
    await loadFacilities();
    
    // 코치 목록 로드 (예약 모달용)
    await loadCoachesForBooking();
    
    // 코치 범례 로드
    await loadCoachLegend();
    
    if (currentView === 'calendar') {
        renderCalendar();
    } else {
        loadBookingsList();
    }
    await loadRentalStats();
}

// 대관 통계 로드 (기간 내 총 예약 + 지점별 예약)
async function loadRentalStats() {
    const container = document.getElementById('rentals-stats-container');
    if (!container) return;
    try {
        const filterStart = document.getElementById('filter-date-start')?.value || '';
        const filterEnd = document.getElementById('filter-date-end')?.value || '';
        let startISO, endISO;
        if (filterStart && filterEnd) {
            const start = new Date(filterStart);
            start.setHours(0, 0, 0, 0);
            const end = new Date(filterEnd);
            end.setHours(23, 59, 59, 999);
            startISO = start.toISOString();
            endISO = end.toISOString();
        } else {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            last.setHours(23, 59, 59, 999);
            startISO = first.toISOString();
            endISO = last.toISOString();
        }
        window.rentalsStatsPeriod = { start: startISO, end: endISO };
        const params = new URLSearchParams({ start: startISO, end: endISO });
        const data = await App.api.get(`/bookings/stats/rentals?${params.toString()}`);
        renderRentalStats(data);
    } catch (error) {
        App.err('대관 통계 로드 실패:', error);
        container.innerHTML = '<p class="rentals-stats-loading">대관 통계를 불러올 수 없습니다.</p>';
    }
}

function renderRentalStats(data) {
    const container = document.getElementById('rentals-stats-container');
    if (!container) return;
    window.lastRentalStatsData = data;
    const monthLabel = data.monthLabel || '';
    const total = data.totalCount != null ? data.totalCount : 0;
    const totalConfirmed = data.totalConfirmedCount != null ? data.totalConfirmedCount : 0;
    const totalPending = data.totalPendingCount != null ? data.totalPendingCount : 0;
    const byBranch = Array.isArray(data.byBranch) ? data.byBranch : [];
    const filterBranch = window.rentalsFilterBranch;
    if (!monthLabel && total === 0 && byBranch.length === 0) {
        container.innerHTML = '<p class="rentals-stats-loading">기간을 선택 후 적용하면 통계가 표시됩니다.</p>';
        return;
    }
    const totalStatusText = `확정 : ${totalConfirmed}건 / 대기 : ${totalPending}건`;
    let html = '<div class="rentals-stats-row">';
    html += '<div class="rentals-stats-total-group">';
    const totalSelectedClass = !filterBranch ? ' rentals-stats-total--selected' : '';
    html += `<div class="rentals-stats-total${totalSelectedClass}" data-branch="" role="button" tabindex="0" title="클릭: 전체 보기"><span class="rentals-stats-label">${monthLabel} 총 대관</span><span class="rentals-stats-value">${total}건</span><span class="rentals-stats-status">${totalStatusText}</span></div>`;
    html += '<span class="rentals-stats-pending" role="button" tabindex="0" data-pending-count="' + totalPending + '" title="클릭 시 승인 대기 목록 보기">승인이 완료되지 않은 예약 ' + totalPending + '건</span>';
    html += '</div>';
    if (byBranch.length > 0) {
        const totalForRatio = total > 0 ? total : 0;
        html += '<div class="rentals-stats-by-branch">';
        html += byBranch.map(b => {
            const branchClass = (b.branch === 'SAHA') ? 'rentals-stats-branch--saha' : (b.branch === 'YEONSAN') ? 'rentals-stats-branch--yeonsan' : '';
            const selectedClass = (filterBranch === b.branch) ? ' rentals-stats-branch-item--selected' : '';
            const count = b.count || 0;
            const pct = totalForRatio > 0 ? Math.round((count / totalForRatio) * 100) : 0;
            const ratioText = totalForRatio > 0 ? ` (${pct}%)` : '';
            return `<span class="rentals-stats-branch-item ${branchClass}${selectedClass}" data-branch="${(b.branch || '').replace(/"/g, '&quot;')}" role="button" tabindex="0" title="클릭: 해당 지점만 보기">${App.escapeHtml(b.branchName || b.branch || '')} ${count}건${ratioText}</span>`;
        }).join('');
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    if (!container._rentalsFilterBound) {
        container._rentalsFilterBound = true;
        container.addEventListener('click', function(e) {
            if (e.target.closest('.rentals-stats-pending')) {
                openPendingApprovalModalRentals();
                return;
            }
            const totalEl = e.target.closest('.rentals-stats-total[data-branch]');
            const branchEl = e.target.closest('.rentals-stats-branch-item[data-branch]');
            const branch = totalEl ? '' : (branchEl ? branchEl.getAttribute('data-branch') : null);
            if (totalEl || branchEl) {
                const current = window.rentalsFilterBranch;
                const next = (branch === '' || !branch) ? null : branch;
                window.rentalsFilterBranch = (next && current === next) ? null : next;
                renderRentalStats(window.lastRentalStatsData || {});
                renderCalendar();
                if (currentView === 'list') loadBookingsList();
            }
        });
        container.addEventListener('keydown', function(e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.rentals-stats-pending')) {
                e.preventDefault();
                openPendingApprovalModalRentals();
                return;
            }
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const totalEl = e.target.closest('.rentals-stats-total[data-branch]');
            const branchEl = e.target.closest('.rentals-stats-branch-item[data-branch]');
            const branch = totalEl ? '' : (branchEl ? branchEl.getAttribute('data-branch') : null);
            if (totalEl || branchEl) {
                e.preventDefault();
                const current = window.rentalsFilterBranch;
                const next = (branch === '' || !branch) ? null : branch;
                window.rentalsFilterBranch = (next && current === next) ? null : next;
                renderRentalStats(window.lastRentalStatsData || {});
                renderCalendar();
                if (currentView === 'list') loadBookingsList();
            }
        });
    }
}

function getRentalsStatsParams() {
    var filterStart = document.getElementById('filter-date-start') && document.getElementById('filter-date-start').value;
    var filterEnd = document.getElementById('filter-date-end') && document.getElementById('filter-date-end').value;
    var startISO, endISO;
    if (filterStart && filterEnd) {
        var start = new Date(filterStart);
        start.setHours(0, 0, 0, 0);
        var end = new Date(filterEnd);
        end.setHours(23, 59, 59, 999);
        startISO = start.toISOString();
        endISO = end.toISOString();
    } else {
        var now = new Date();
        var first = new Date(now.getFullYear(), now.getMonth(), 1);
        var last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        last.setHours(23, 59, 59, 999);
        startISO = first.toISOString();
        endISO = last.toISOString();
    }
    return new URLSearchParams({ start: startISO, end: endISO });
}

function openPendingApprovalModalRentals() {
    var modal = document.getElementById('rentals-pending-approval-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('rentals-pending-approval-loading').style.display = 'block';
    document.getElementById('rentals-pending-approval-toolbar').style.display = 'none';
    document.getElementById('rentals-pending-approval-table-wrap').style.display = 'none';
    document.getElementById('rentals-pending-approval-empty').style.display = 'none';
    loadPendingRentalsForModal();
}

function closePendingApprovalModalRentals() {
    var modal = document.getElementById('rentals-pending-approval-modal');
    if (modal) modal.style.display = 'none';
}

async function loadPendingRentalsForModal() {
    var loadingEl = document.getElementById('rentals-pending-approval-loading');
    var toolbarEl = document.getElementById('rentals-pending-approval-toolbar');
    var tableWrap = document.getElementById('rentals-pending-approval-table-wrap');
    var tbody = document.getElementById('rentals-pending-approval-tbody');
    var emptyEl = document.getElementById('rentals-pending-approval-empty');
    if (!tbody) return;
    try {
        var params = getRentalsStatsParams();
        var list = await App.api.get('/bookings/pending/rentals?' + params.toString());
        loadingEl.style.display = 'none';
        if (!list || list.length === 0) {
            tableWrap.style.display = 'none';
            toolbarEl.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';
        toolbarEl.style.display = 'flex';
        tableWrap.style.display = 'block';
        var branchNames = { 'SAHA': '사하점', 'YEONSAN': '연산점', 'RENTAL': '대관' };
        tbody.innerHTML = list.map(function(b) {
            var startStr = b.startTime && typeof b.startTime === 'string' ? b.startTime : (b.startTime ? String(b.startTime) : '');
            var start = startStr ? startStr.replace('T', ' ').slice(0, 16) : '-';
            var facilityName = (b.facility && b.facility.name) ? App.escapeHtml(b.facility.name) : '-';
            var branchName = (b.branch && branchNames[b.branch]) ? branchNames[b.branch] : (b.branch || '-');
            var memberName = (b.memberName != null && b.memberName !== '') ? App.escapeHtml(b.memberName) : '-';
            var coachName = (b.coachName != null && b.coachName !== '') ? App.escapeHtml(b.coachName) : '-';
            return '<tr><td><input type="checkbox" class="rentals-pending-approval-cb" data-booking-id="' + b.id + '"></td><td>' + start + '</td><td>' + facilityName + '</td><td>' + branchName + '</td><td>' + memberName + '</td><td>' + coachName + '</td><td><button type="button" class="btn btn-success btn-sm" data-booking-id="' + b.id + '">승인</button></td></tr>';
        }).join('');
        document.getElementById('rentals-pending-approval-select-all').checked = false;
        document.getElementById('rentals-pending-approval-select-all').onclick = function() {
            tbody.querySelectorAll('.rentals-pending-approval-cb').forEach(function(cb) { cb.checked = this.checked; }.bind(this));
        };
        var rentalsBulkBtn = document.getElementById('rentals-pending-approval-bulk-btn');
        if (rentalsBulkBtn) {
            rentalsBulkBtn.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';
            rentalsBulkBtn.onclick = function() {
                var ids = Array.from(tbody.querySelectorAll('.rentals-pending-approval-cb:checked')).map(function(cb) { return parseInt(cb.getAttribute('data-booking-id'), 10); });
                if (ids.length === 0) {
                    App.showNotification('승인할 예약을 선택해 주세요.', 'warning');
                    return;
                }
                approvePendingRentalIds(ids);
            };
        }
        tbody.querySelectorAll('button[data-booking-id]').forEach(function(btn) {
            btn.onclick = function() {
                var id = parseInt(this.getAttribute('data-booking-id'), 10);
                approvePendingRentalIds([id]);
            };
        });
    } catch (err) {
        App.err('승인 대기 대관 목록 로드 실패:', err);
        loadingEl.style.display = 'none';
        emptyEl.textContent = '목록을 불러오지 못했습니다.';
        emptyEl.style.display = 'block';
    }
}

async function approvePendingRentalIds(bookingIds) {
    if (!bookingIds || bookingIds.length === 0) return;
    try {
        var res = await App.api.post('/bookings/bulk-confirm', { bookingIds: bookingIds });
        var updated = (res && res.updatedCount != null) ? res.updatedCount : 0;
        App.showNotification(updated + '건 승인 완료되었습니다.', 'success');
        await loadPendingRentalsForModal();
        await loadRentalStats();
        if (currentView === 'list') loadBookingsList();
        else await renderCalendar();
    } catch (err) {
        App.err('일괄 승인 실패:', err);
        var msg = '승인 처리에 실패했습니다.';
        if (err && err.response) {
            if (err.response.status === 403) msg = '일괄 승인은 관리자만 사용할 수 있습니다.';
            else if (err.response.data && err.response.data.message) msg = err.response.data.message;
        }
        App.showNotification(msg, 'danger');
    }
}

/** 현재 필터에 맞는 대기 예약 전체 확정 (대관 관리 예약 목록 탭) */
async function confirmAllPendingRentals() {
    try {
        let bookings = await App.api.get('/bookings?branch=RENTAL');
        if (!bookings || !Array.isArray(bookings)) bookings = [];
        var branchFilter = window.rentalsFilterBranch;
        if (branchFilter) {
            bookings = bookings.filter(function(b) {
                var fb = b.facility && b.facility.branch ? String(b.facility.branch).toUpperCase() : '';
                return fb === branchFilter;
            });
        }
        var facilitySelect = document.getElementById('filter-facility');
        var filterFacilityId = facilitySelect ? (facilitySelect.value || '').trim() : '';
        if (filterFacilityId) {
            bookings = bookings.filter(function(b) { return b.facility && String(b.facility.id) === filterFacilityId; });
        }
        var filterStatusEl = document.getElementById('filter-status');
        var filterStatus = filterStatusEl ? (filterStatusEl.value || '').trim() : '';
        if (filterStatus) {
            bookings = bookings.filter(function(b) { return (b.status || '') === filterStatus; });
        }
        var filterDateStart = document.getElementById('filter-date-start');
        var filterDateEnd = document.getElementById('filter-date-end');
        if (filterDateStart && filterDateStart.value) {
            var startDate = new Date(filterDateStart.value);
            bookings = bookings.filter(function(b) {
                var bookingDate = new Date(b.startTime);
                return bookingDate >= startDate;
            });
        }
        if (filterDateEnd && filterDateEnd.value) {
            var endDate = new Date(filterDateEnd.value);
            endDate.setHours(23, 59, 59, 999);
            bookings = bookings.filter(function(b) {
                var bookingDate = new Date(b.startTime);
                return bookingDate <= endDate;
            });
        }
        var pendingBookings = bookings.filter(function(b) { return (b.status || '') === 'PENDING'; });
        if (pendingBookings.length === 0) {
            App.showNotification('확정할 대기 예약이 없습니다.', 'info');
            return;
        }
        if (!confirm('총 ' + pendingBookings.length + '건의 대기 예약을 확정하시겠습니까?')) {
            return;
        }
        var ids = pendingBookings.map(function(b) { return b.id; });
        await approvePendingRentalIds(ids);
    } catch (err) {
        App.err('전체 확인 조회 실패:', err);
        App.showNotification('대기 예약 목록을 불러오지 못했습니다.', 'danger');
    }
}

// 시설 목록 로드
async function loadFacilities() {
    try {
        const select = document.getElementById('booking-facility');
        if (!select) {
            App.err('[시설 로드] 시설 선택 필드를 찾을 수 없습니다.');
            return;
        }
        
        // 대관 페이지: 시설은 무조건 사하점(SAHA)으로 고정
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'RENTAL', facilityType: 'RENTAL' };
        const params = new URLSearchParams();
        params.append('branch', 'SAHA');
        if (config.facilityType) {
            params.append('facilityType', config.facilityType);
        }
        
        const facilities = await App.api.get(`/facilities?${params.toString()}`);
        
        if (!facilities || !Array.isArray(facilities)) {
            App.err('[시설 로드] 시설 목록이 배열이 아닙니다:', facilities);
            select.innerHTML = '<option value="">시설 목록을 불러올 수 없습니다</option>';
            return;
        }
        
        select.innerHTML = '<option value="">시설 선택...</option>';
        facilities.forEach(facility => {
            const option = document.createElement('option');
            option.value = facility.id;
            const branchText = facility.branch ? `[${facility.branch === 'SAHA' ? '사하점' : facility.branch === 'YEONSAN' ? '연산점' : facility.branch}]` : '';
            option.textContent = `${facility.name} ${branchText}`.trim();
            select.appendChild(option);
        });
        // 사하점 시설 1개 이상이면 첫 번째로 고정하고 선택 비활성화
        if (facilities.length > 0) {
            select.selectedIndex = 1;
            select.disabled = true;
        }
        App.log(`[시설 로드] 사하점 대관 시설 ${facilities.length}개 로드됨 (사하점 고정)`);
    } catch (error) {
        App.err('[시설 로드] 시설 목록 로드 실패:', error);
        const select = document.getElementById('booking-facility');
        if (select) {
            select.innerHTML = '<option value="">시설 목록 로드 실패</option>';
        }
    }
}

// 코치 목록 로드 (예약 모달용)
async function loadCoachesForBooking() {
    try {
        const coaches = await App.api.get('/coaches');
        const select = document.getElementById('booking-coach');
        if (!select) return;
        
        // 활성 코치만 필터링
        const activeCoaches = coaches.filter(c => c.active !== false);
        select.innerHTML = '<option value="">코치 미지정</option>';
        activeCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
    } catch (error) {
        App.err('코치 목록 로드 실패:', error);
    }
}

// 비회원 코치 목록 로드 (예약 모달용)
async function loadCoachesForBookingNonMember() {
    try {
        const coaches = await App.api.get('/coaches');
        const select = document.getElementById('booking-coach-nonmember');
        if (!select) return;
        
        // 활성 코치만 필터링
        const activeCoaches = coaches.filter(c => c.active !== false);
        select.innerHTML = '<option value="">코치 미지정</option>';
        activeCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
    } catch (error) {
        App.err('비회원 코치 목록 로드 실패:', error);
    }
}


// 회원의 상품/이용권 목록 로드 (대관 페이지: RENTAL 카테고리만 표시)
async function loadMemberProducts(memberId) {
    try {
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
        const select = document.getElementById('booking-member-product');
        const productInfo = document.getElementById('product-info');
        const productInfoText = document.getElementById('product-info-text');
        
        if (!select) return;
        
        // 활성 상태인 상품만 필터링
        let activeProducts = memberProducts.filter(mp => mp.status === 'ACTIVE');
        // 대관 페이지: 대관(RENTAL) 이용권만 표시 (category는 문자열 또는 객체로 올 수 있음)
        const categoryStr = (mp) => {
            if (!mp.product || mp.product.category == null) return '';
            const c = mp.product.category;
            return (typeof c === 'string' ? c : (c.name || c || '')).toString().toUpperCase();
        };
        const rentalProducts = activeProducts.filter(mp => categoryStr(mp) === 'RENTAL');
        // 대관 페이지: RENTAL 이용권만 표시 (없으면 빈 목록)
        activeProducts = rentalProducts.length > 0 ? rentalProducts : [];
        
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        const eligibleProducts = activeProducts.filter(mp => {
            const type = mp.product?.type;
            return type === 'COUNT_PASS' || type === 'MONTHLY_PASS' || type === 'TIME_PASS';
        });
        // 이용권이 하나라도 있으면 결제방식 무조건 선결제로 고정
        if (paymentMethodSelect && activeProducts.length > 0) {
            paymentMethodSelect.value = 'PREPAID';
            paymentMethodSelect.disabled = true;
        }
        
        select.innerHTML = activeProducts.length === 0 ? '<option value="">대관 이용권 없음</option>' : '<option value="">상품 선택...</option>';
        
        if (activeProducts.length === 0) {
            if (productInfo) productInfo.style.display = 'none';
            return;
        }
        
        activeProducts.forEach(mp => {
            const option = document.createElement('option');
            option.value = mp.id;
            const product = mp.product;
            // 상품 이름과 가격 표시
            let text = product.name || '상품';
            if (product.price) {
                text += ` - ${App.formatCurrency(product.price)}`;
            }
            
            // 잔여 횟수는 dataset에만 저장 (표시는 하지 않음)
            if (product.type === 'COUNT_PASS') {
                // 백엔드에서 계산된 remainingCount 사용 (실제 예약 데이터 기반)
                // remainingCount가 있으면 사용, 없으면 product.usageCount를 우선 사용 (상품의 실제 사용 횟수 반영)
                let remaining;
                if (mp.remainingCount !== null && mp.remainingCount !== undefined) {
                    remaining = mp.remainingCount;
                } else if (product.usageCount !== null && product.usageCount !== undefined) {
                    // 상품의 실제 usageCount를 우선 사용 (데이터 일관성 보장)
                    remaining = product.usageCount;
                } else if (mp.totalCount !== null && mp.totalCount !== undefined) {
                    remaining = mp.totalCount;
                } else {
                    // 모든 값이 없을 때만 기본값 10 사용
                    remaining = 10;
                }
                option.dataset.remainingCount = remaining;
            } else {
                option.dataset.remainingCount = 0;
            }
            
            option.textContent = text;
            option.dataset.productType = product.type;
            if (product.coach && (product.coach.id || product.coach)) {
                option.dataset.coachId = String(product.coach.id || product.coach);
            }
            select.appendChild(option);
        });
        
        // 상품 선택 시 결제 방식 자동 설정, 담당 코치 설정, 정보 표시
        select.onchange = function() {
            const selectedOption = this.options[this.selectedIndex];
            const paymentMethodSelect = document.getElementById('booking-payment-method');
            const coachSelect = document.getElementById('booking-coach');
            
            if (selectedOption.value) {
                // 상품 선택 시 선결제로 자동 설정 및 고정 (이용권 사용 시 무조건 선결제)
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = 'PREPAID';
                    paymentMethodSelect.disabled = true;
                }
                // 이용권 담당 코치가 있으면 코치 선택란에 반영
                if (coachSelect && selectedOption.dataset.coachId) {
                    const coachId = selectedOption.dataset.coachId;
                    if (Array.from(coachSelect.options).some(function(o) { return o.value === coachId; })) {
                        coachSelect.value = coachId;
                    }
                }
                
                // 상품 정보 표시
                const productType = selectedOption.dataset.productType;
                const remainingCount = parseInt(selectedOption.dataset.remainingCount) || 0;
                
                if (productInfo && productInfoText) {
                    if (productType === 'COUNT_PASS') {
                        if (remainingCount > 0) {
                            productInfoText.textContent = `횟수권 사용: 잔여 ${remainingCount}회`;
                            productInfo.style.display = 'block';
                        } else {
                            productInfoText.textContent = `횟수권 사용: 잔여 횟수가 없습니다 (0회)`;
                            productInfo.style.display = 'block';
                            productInfo.style.background = 'var(--danger-light)';
                        }
                    } else {
                        productInfoText.textContent = '상품 사용 예정';
                        productInfo.style.display = 'block';
                    }
                }
            } else {
                // 상품 미선택 시 결제 방식·코치 초기화 및 정보 숨김
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = '';
                    paymentMethodSelect.disabled = false;
                }
                if (coachSelect) {
                    coachSelect.value = '';
                }
                if (productInfo) {
                    productInfo.style.display = 'none';
                }
            }
        };
        
        // 대관: 이용권이 있으면 첫 번째 항목 자동 선택 (다른 예약 페이지처럼)
        if (select.options.length > 1) {
            const firstVal = select.options[1].value;
            select.value = firstVal;
            select.selectedIndex = 1;
            if (paymentMethodSelect) {
                paymentMethodSelect.value = 'PREPAID';
                paymentMethodSelect.disabled = true;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
    } catch (error) {
        App.err('회원 상품 목록 로드 실패:', error);
        const select = document.getElementById('booking-member-product');
        if (select) {
            select.innerHTML = '<option value="">상품 선택...</option>';
        }
    }
}

// 지점별 색상 (대관 관리 페이지 기준 고유색)
function getBranchColor(branch) {
    if (!branch) return null;
    if (branch === 'SAHA' || branch === '사하점') {
        return '#1E8449'; // 사하점 고유색
    } else if (branch === 'YEONSAN' || branch === '연산점') {
        return '#DAA520'; // 연산점 고유색
    }
    return null;
}

// 코치 범례 로드 (코치/레슨 관리의 배정 지점=대관(RENTAL)인 코치와 동일하게 표시)
async function loadCoachLegend() {
    try {
        const config = window.BOOKING_PAGE_CONFIG || {};
        const branch = config.branch || 'RENTAL';
        const url = '/coaches?branch=' + encodeURIComponent(branch);
        const coaches = await App.api.get(url);
        const legendContainer = document.getElementById('coach-legend');
        if (!legendContainer) return;
        
        const activeCoaches = (Array.isArray(coaches) ? coaches : []).filter(c => c.active !== false);
        activeCoaches.sort((a, b) => {
            const orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
            const orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
        });
        
        const sahaColor = getBranchColor('SAHA');
        const yeonsanColor = getBranchColor('YEONSAN');
        const filterBranch = window.rentalsFilterBranch;
        let legendHTML = '<div class="legend-section">';
        legendHTML += '<div class="legend-title">관리 지점:</div>';
        if (sahaColor) {
            const selClass = filterBranch === 'SAHA' ? ' legend-item--selected' : '';
            legendHTML += `<div class="legend-item${selClass}" data-branch="SAHA" role="button" tabindex="0" title="클릭: 사하점만 보기"><span class="legend-color" style="background-color: ${sahaColor}"></span><span class="legend-name">사하점</span></div>`;
        }
        if (yeonsanColor) {
            const selClass = filterBranch === 'YEONSAN' ? ' legend-item--selected' : '';
            legendHTML += `<div class="legend-item${selClass}" data-branch="YEONSAN" role="button" tabindex="0" title="클릭: 연산점만 보기"><span class="legend-color" style="background-color: ${yeonsanColor}"></span><span class="legend-name">연산점</span></div>`;
        }
        legendHTML += '</div>';
        legendHTML += '<div class="legend-divider"></div>';
        legendHTML += '<div class="legend-section">';
        legendHTML += '<div class="legend-title">담당 코치:</div>';
        activeCoaches.forEach(coach => {
            const color = App.CoachColors.getColor(coach);
            legendHTML += `<div class="legend-item"><span class="legend-color" style="background-color: ${color}"></span><span class="legend-name" style="color: ${color}; font-weight: 600;">${App.escapeHtml(coach.name || '')}</span></div>`;
        });
        legendHTML += '</div>';
        legendContainer.innerHTML = legendHTML;
        if (!legendContainer._legendBranchFilterBound) {
            legendContainer._legendBranchFilterBound = true;
            legendContainer.addEventListener('click', function(e) {
                const item = e.target.closest('.legend-item[data-branch]');
                if (!item) return;
                const branch = item.getAttribute('data-branch') || '';
                const current = window.rentalsFilterBranch;
                window.rentalsFilterBranch = (branch && current === branch) ? null : (branch || null);
                loadCoachLegend();
                if (window.lastRentalStatsData) renderRentalStats(window.lastRentalStatsData);
                renderCalendar();
                if (currentView === 'list') loadBookingsList();
            });
            legendContainer.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const item = e.target.closest('.legend-item[data-branch]');
                if (!item) return;
                e.preventDefault();
                const branch = item.getAttribute('data-branch') || '';
                const current = window.rentalsFilterBranch;
                window.rentalsFilterBranch = (branch && current === branch) ? null : (branch || null);
                loadCoachLegend();
                if (window.lastRentalStatsData) renderRentalStats(window.lastRentalStatsData);
                renderCalendar();
                if (currentView === 'list') loadBookingsList();
            });
        }
    } catch (error) {
        App.err('코치 범례 로드 실패:', error);
        // 범례 로드 실패해도 계속 진행
    }
}

function switchView(view) {
    currentView = view;
    
    // 모든 뷰 버튼의 active 클래스 제거
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 클릭된 버튼에 active 클래스 추가
    const clickedBtn = document.querySelector(`[data-view="${view}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // 예약 등록 버튼의 active 클래스 제거
    const bookingBtn = document.getElementById('btn-booking-new');
    if (bookingBtn) {
        bookingBtn.classList.remove('active');
    }
    
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.toggle('active', container.id === `${view}-view`);
    });
    
    // 전체 확인 버튼: 예약 목록 탭에서만 표시, 달력 탭에서는 숨김
    const filterResetBtn = document.getElementById('rentals-filter-reset');
    if (filterResetBtn) {
        filterResetBtn.style.display = view === 'list' ? '' : 'none';
    }
    
    if (view === 'calendar') {
        renderCalendar();
    } else {
        loadBookingsList();
    }
}

async function renderCalendar() {
    clearRentalsEmptyModalTimeout();
    // 캘린더 렌더링 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
    await reorderBookingIdsSilent();
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('calendar-month-year').textContent = 
        `${year}년 ${month + 1}월`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 주의 첫날 (일요일)
    // 해당 달 + 빈칸만 채우는 최소 행 수 (다음달 2줄 넘게 나오지 않도록)
    const blankAtStart = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const numRows = Math.ceil((blankAtStart + daysInMonth) / 7);
    const totalCells = numRows * 7;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalCells - 1);
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // 요일 헤더 (일: 빨간색, 토: 파란색)
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach((day, idx) => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header' + (idx === 0 ? ' calendar-day-header-sun' : idx === 6 ? ' calendar-day-header-sat' : '');
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // 해당 월의 예약 데이터 로드
    // 캘린더에 표시되는 주 범위를 고려하여 앞뒤 일주일 추가
    
    // 조회 범위를 캘린더 표시 범위로 확장
    const queryStart = new Date(startDate);
    queryStart.setHours(0, 0, 0, 0);
    const queryEnd = new Date(endDate);
    queryEnd.setHours(23, 59, 59, 999);
    
    let bookings = [];
    try {
        // ISO 형식으로 변환 (UTC 시간대 포함)
        const startISO = queryStart.toISOString();
        const endISO = queryEnd.toISOString();
        App.log(`예약 데이터 요청: ${startISO} ~ ${endISO}`);
        App.log(`현재 월: ${year}년 ${month + 1}월`);
        App.log(`조회 범위: ${queryStart.toLocaleDateString()} ~ ${queryEnd.toLocaleDateString()}`);
        
        const response = await App.api.get(`/bookings?start=${startISO}&end=${endISO}&branch=RENTAL`);
        bookings = (response && Array.isArray(response) ? response : (response && Array.isArray(response.data) ? response.data : [])) || [];
        const branchFilter = window.rentalsFilterBranch;
        if (branchFilter) {
            bookings = bookings.filter(b => {
                const fb = b.facility && b.facility.branch ? String(b.facility.branch).toUpperCase() : '';
                return fb === branchFilter;
            });
            App.log(`캘린더 지점 필터 적용 (${branchFilter}): ${bookings.length}건`);
        }
        const facilitySelect = document.getElementById('filter-facility');
        const filterFacilityId = facilitySelect ? (facilitySelect.value || '').trim() : '';
        if (filterFacilityId) {
            bookings = bookings.filter(b => b.facility && String(b.facility.id) === filterFacilityId);
            App.log(`캘린더 시설 필터 적용 (facilityId=${filterFacilityId}): ${bookings.length}건`);
        }
        App.log(`캘린더 로드: ${bookings.length}개의 예약 발견`, bookings);
        if (bookings.length === 0 && (branchFilter || filterFacilityId)) {
            clearRentalsEmptyModalTimeout();
            var msg = branchFilter && filterFacilityId ? '해당 지점·시설의 대관 예약이 없습니다.' : (branchFilter ? '해당 지점의 대관 예약이 없습니다.' : '해당 시설의 대관 예약이 없습니다.');
            window._rentalsEmptyModalTimeout = setTimeout(function() {
                window._rentalsEmptyModalTimeout = null;
                showRentalsEmptyModal(msg);
            }, 80);
        }
        // 예약이 없으면 전체 예약도 확인 (디버깅용, 지점/시설 필터 중일 때는 제외)
        if (bookings.length === 0 && !branchFilter && !filterFacilityId) {
            App.log('날짜 범위 내 예약 없음, 전체 예약 확인 중...');
            try {
                const allBookings = await App.api.get('/bookings?branch=RENTAL');
                App.log(`전체 예약 (대관): ${allBookings ? allBookings.length : 0}개`, allBookings);
                // 전체 예약 중 현재 월에 해당하는 예약 찾기
                if (allBookings && allBookings.length > 0) {
                    const monthBookings = allBookings.filter(b => {
                        if (!b || !b.startTime) return false;
                        try {
                            const bookingDate = new Date(b.startTime);
                            const bookingYear = bookingDate.getFullYear();
                            const bookingMonth = bookingDate.getMonth();
                            App.log(`예약 날짜 확인: ${bookingYear}-${bookingMonth + 1}-${bookingDate.getDate()}, 현재 월: ${year}-${month + 1}`);
                            return bookingYear === year && bookingMonth === month;
                        } catch (e) {
                            App.err('예약 날짜 파싱 오류:', b.startTime, e);
                            return false;
                        }
                    });
                    App.log(`현재 월에 해당하는 예약: ${monthBookings.length}개`, monthBookings);
                    // 현재 월 예약이 있으면 사용
                    if (monthBookings.length > 0) {
                        bookings = monthBookings;
                    } else if (allBookings && allBookings.length > 0) {
                        // 현재 월에 예약이 없고 다른 월에 예약이 있으면 안내
                        const otherMonthBookings = allBookings.filter(b => {
                            if (!b || !b.startTime) return false;
                            try {
                                const bookingDate = new Date(b.startTime);
                                return bookingDate.getFullYear() !== year || bookingDate.getMonth() !== month;
                            } catch (e) {
                                return false;
                            }
                        });
                        if (otherMonthBookings.length > 0) {
                            const earliestBooking = otherMonthBookings.sort((a, b) => 
                                new Date(a.startTime) - new Date(b.startTime)
                            )[0];
                            const earliestDate = new Date(earliestBooking.startTime);
                            App.log(`현재 월에 예약 없음. 가장 가까운 예약: ${earliestDate.getFullYear()}년 ${earliestDate.getMonth() + 1}월`);
                        }
                    }
                }
            } catch (e) {
                App.err('전체 예약 조회 실패:', e);
            }
        }
    } catch (error) {
        App.err('예약 데이터 로드 실패:', error);
    }
    
    // 날짜 셀
    const today = new Date();
    const current = new Date(startDate);
    
    for (let i = 0; i < totalCells; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        const dayOfWeek = current.getDay();
        if (dayOfWeek === 0) dayCell.classList.add('calendar-day-sun');
        else if (dayOfWeek === 6) dayCell.classList.add('calendar-day-sat');
        
        if (current.getMonth() !== month) {
            dayCell.classList.add('other-month');
        }
        
        if (current.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }
        
        // 해당 날짜의 예약 표시 (날짜만 비교, 시간 무시) - 먼저 계산
        const dayBookings = bookings.filter(b => {
            if (!b || !b.startTime) return false;
            try {
                const bookingDate = new Date(b.startTime);
                // 날짜만 비교 (년, 월, 일) - 로컬 시간 기준
                const bookingYear = bookingDate.getFullYear();
                const bookingMonth = bookingDate.getMonth();
                const bookingDay = bookingDate.getDate();
                const currentYear = current.getFullYear();
                const currentMonth = current.getMonth();
                const currentDay = current.getDate();
                
                const matches = bookingYear === currentYear &&
                               bookingMonth === currentMonth &&
                               bookingDay === currentDay;
                
                if (matches) {
                    App.log(`예약 매칭: ${bookingYear}-${bookingMonth + 1}-${bookingDay} === ${currentYear}-${currentMonth + 1}-${currentDay}`);
                }
                
                return matches;
            } catch (e) {
                App.err('날짜 파싱 오류:', b, e);
                return false;
            }
        });
        
        // 디버깅: 예약이 있는 날짜 로그
        if (dayBookings.length > 0) {
            App.log(`날짜 ${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}에 ${dayBookings.length}개 예약 발견:`, dayBookings);
        }
        
        // 날짜 헤더 생성 (날짜 번호 + 스케줄 아이콘)
        const dayHeader = document.createElement('div');
        dayHeader.style.display = 'flex';
        dayHeader.style.justifyContent = 'space-between';
        dayHeader.style.alignItems = 'center';
        dayHeader.style.width = '100%';
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = current.getDate();
        dayHeader.appendChild(dayNumber);
        
        // 날짜별 스케줄 보기 아이콘 (예약이 있는 날짜에만 표시)
        if (dayBookings.length > 0) {
            const scheduleIcon = document.createElement('div');
            scheduleIcon.className = 'day-schedule-icon';
            scheduleIcon.innerHTML = '📋';
            scheduleIcon.style.cssText = 'cursor: pointer; font-size: 14px; padding: 2px 4px; opacity: 0.7; transition: opacity 0.2s;';
            scheduleIcon.title = '스케줄 보기';
            scheduleIcon.onmouseover = () => scheduleIcon.style.opacity = '1';
            scheduleIcon.onmouseout = () => scheduleIcon.style.opacity = '0.7';
            
            // 클로저 문제 해결: 날짜 값 고정
            const iconYear = current.getFullYear();
            const iconMonth = current.getMonth();
            const iconDay = current.getDate();
            const iconDateStr = `${iconYear}-${String(iconMonth + 1).padStart(2, '0')}-${String(iconDay).padStart(2, '0')}`;
            
            scheduleIcon.onclick = (e) => {
                e.stopPropagation(); // 날짜 클릭 이벤트 전파 방지
                openDayScheduleModal(iconDateStr);
            };
            
            dayHeader.appendChild(scheduleIcon);
        }
        
        dayCell.appendChild(dayHeader);
        
        // 각 예약을 시간대별로 표시
        dayBookings.forEach(booking => {
            try {
                const event = document.createElement('div');
                event.className = 'calendar-event';
                
                // 시간 추출
                const startTime = new Date(booking.startTime);
                const endTime = new Date(booking.endTime);
                const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                
                // 이름 추출
                const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
                
                // 대관 횟수권 회차: 서버 sessionNumber 사용. 체크인 직후 서버가 1로 내려오는 경우(7→1) 잔여 기준으로 보정
                let sessionLabel = '';
                const mp = booking.memberProduct;
                if (mp) {
                    const total = (Number(mp.totalCount) || Number(mp.total_count) || 0);
                    let remaining = Number(mp.remainingCount);
                    if (Number.isNaN(remaining)) remaining = Number(mp.remaining_count);
                    if (Number.isNaN(remaining) && total > 0) remaining = total;
                    const usedCount = total > 0 && !Number.isNaN(remaining) && remaining >= 0 ? (total - remaining) : 0;
                    let n = (mp.sessionNumber != null && mp.sessionNumber !== '') ? parseInt(mp.sessionNumber, 10) : 0;
                    if (n < 1) {
                        const fromRemaining = total > 0 && remaining < total ? (usedCount + 1) : 0;
                        n = Math.max(fromRemaining, 1);
                    }
                    // 서버가 1회차로 내려왔는데 실제 사용 횟수(usedCount)가 더 크면 → usedCount로 표시 (체크인 후 7→1 방지)
                    if (total > 0 && usedCount >= 1 && usedCount <= total && n === 1 && usedCount > 1) {
                        n = usedCount;
                    }
                    if (n > 0) sessionLabel = ' (' + n + '회차)';
                }
                const displayName = memberName + sessionLabel;
                
                // 지점 색상 적용 (시설의 지점 정보 사용)
                let eventColor = '#5E6AD2'; // 기본 색상
                if (booking.facility && booking.facility.branch) {
                    const branchColor = getBranchColor(booking.facility.branch);
                    if (branchColor) {
                        eventColor = branchColor;
                        App.log(`[대관 예약 색상] 예약 ID: ${booking.id}, 지점: ${booking.facility.branch}, 색상: ${branchColor}`);
                    }
                } else {
                    App.warn(`[대관 예약 색상] 예약 ID: ${booking.id}, 시설 정보 없음 또는 지점 정보 없음`, booking.facility);
                }
                
                event.style.backgroundColor = eventColor;
                event.style.borderLeft = `3px solid ${eventColor}`;
                
                // 상태에 따라 아이콘 표시 추가 (완료 동그라미는 COMPLETED일 때만 표시 — 삭제 후 재예약 시 종료시간만 지났다고 표시 안 함)
                const status = booking.status || 'PENDING';
                let statusIcon = '';
                let statusIconStyle = '';
                if (status === 'COMPLETED') {
                    // 서버에서 완료 처리된 예약만: 초록색 원형 배경(동그라미)
                    statusIcon = '';
                    statusIconStyle = 'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; min-width: 16px; min-height: 16px; background-color: #2ECC71; border-radius: 50%; margin-right: 5px; vertical-align: middle; flex-shrink: 0; position: relative;';
                } else if (status === 'CONFIRMED') {
                    // 확정된 예약: 파란색 원형 배경에 흰색 체크 표시
                    statusIcon = '✓';
                    statusIconStyle = 'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background-color: #3498DB; border-radius: 50%; color: white; font-size: 11px; font-weight: 900; margin-right: 5px; vertical-align: middle; flex-shrink: 0;';
                }
                
                // 이벤트 내용 설정 (한 줄로 표시: 아이콘 + 시간 / 이름 또는 이름 N회차)
                if (statusIcon || statusIconStyle) {
                    if (status === 'COMPLETED') {
                        event.innerHTML = `<span style="${statusIconStyle}"></span>${timeStr} / ${displayName}`;
                    } else {
                        event.innerHTML = `<span style="${statusIconStyle}">${statusIcon}</span>${timeStr} / ${displayName}`;
                    }
                } else {
                    event.innerHTML = `${timeStr} / ${displayName}`;
                }
                
                // 드래그 앤 드롭 기능 추가
                event.draggable = true;
                event.setAttribute('data-booking-id', booking.id);
                
                // 드래그 시작
                event.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        bookingId: booking.id,
                        booking: booking
                    }));
                    event.style.opacity = '0.5';
                });
                
                // 드래그 종료
                event.addEventListener('dragend', (e) => {
                    event.style.opacity = '1';
                });
                
                // 클릭 시 예약 상세 보기 (드래그가 아닐 때만)
                let dragStartX = 0;
                let dragStartY = 0;
                let isDragging = false;
                
                event.addEventListener('mousedown', (e) => {
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    isDragging = false;
                });
                
                event.addEventListener('mousemove', (e) => {
                    if (dragStartX !== 0 || dragStartY !== 0) {
                        const deltaX = Math.abs(e.clientX - dragStartX);
                        const deltaY = Math.abs(e.clientY - dragStartY);
                        if (deltaX > 5 || deltaY > 5) {
                            isDragging = true;
                        }
                    }
                });
                
                event.addEventListener('click', (e) => {
                    // 드래그가 아닐 때만 처리
                    if (!isDragging) {
                        e.stopPropagation();
                        
                        // Shift 또는 Ctrl 키를 누른 상태면 선택만 (모달 열지 않음)
                        if (e.shiftKey || e.ctrlKey) {
                            selectBooking(booking, event);
                        } else {
                            // 일반 클릭은 모달 열기
                            editBooking(booking.id);
                        }
                    }
                    // 리셋
                    dragStartX = 0;
                    dragStartY = 0;
                    isDragging = false;
                });
                
                dayCell.appendChild(event);
            } catch (error) {
                App.err('예약 표시 오류:', booking, error);
            }
        });
        
        // 클로저 문제 해결: 각 셀에 대해 날짜 값을 고정
        const cellYear = current.getFullYear();
        const cellMonth = current.getMonth();
        const cellDay = current.getDate();
        const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
        
        // 드래그 앤 드롭 이벤트 추가
        dayCell.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dayCell.style.backgroundColor = 'rgba(94, 106, 210, 0.2)';
        });
        
        dayCell.addEventListener('dragleave', (e) => {
            // 다른 셀로 이동한 경우에만 배경색 복원
            if (!dayCell.contains(e.relatedTarget)) {
                dayCell.style.backgroundColor = '';
            }
        });
        
        dayCell.addEventListener('drop', async (e) => {
            e.preventDefault();
            dayCell.style.backgroundColor = '';
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const sourceBookingId = data.bookingId;
                const sourceBooking = data.booking;
                
                // 드롭된 날짜로 예약 복사
                await copyBookingToDateAndRefresh(sourceBookingId, sourceBooking, cellDateStr);
            } catch (error) {
                App.err('예약 복사 실패:', error);
                App.showNotification('예약 복사에 실패했습니다.', 'danger');
            }
        });
        
        dayCell.onclick = (e) => {
            // 아이콘 클릭이 아닐 때만 빠른 예약 모달 열기
            if (!e.target.classList.contains('day-schedule-icon') && 
                !e.target.closest('.day-schedule-icon') &&
                !e.target.classList.contains('calendar-event')) {
                // 고정된 날짜 값 사용 (클로저 문제 해결)
                App.log('캘린더 날짜 클릭:', cellDateStr, '년:', cellYear, '월:', cellMonth + 1, '일:', cellDay);
                openQuickBookingModal(cellDateStr);
            }
        };
        
        grid.appendChild(dayCell);
        current.setDate(current.getDate() + 1);
    }
}

// 날짜별 스케줄 모달 열기
async function openDayScheduleModal(dateStr) {
    try {
        // 날짜 포맷팅
        const date = new Date(dateStr + 'T00:00:00');
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const formattedDate = `${year}년 ${month}월 ${day}일`;
        
        document.getElementById('day-schedule-modal-title').textContent = `${formattedDate} 스케줄`;
        
        // 해당 날짜의 예약 로드
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        const bookings = await App.api.get(`/bookings?start=${startISO}&end=${endISO}&branch=RENTAL`);
        
        // 코치 목록 로드 (필터용)
        const coaches = await App.api.get('/coaches');
        const coachSelect = document.getElementById('schedule-filter-coach');
        coachSelect.innerHTML = '<option value="">전체 코치</option>';
        coaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            coachSelect.appendChild(option);
        });
        
        // 전체 예약 저장 (필터링용)
        window.dayScheduleBookings = bookings;
        
        // 초기 렌더링
        renderDaySchedule(bookings);
        
        App.Modal.open('day-schedule-modal');
    } catch (error) {
        App.err('스케줄 로드 실패:', error);
        App.showNotification('스케줄을 불러오는데 실패했습니다.', 'danger');
    }
}

// 날짜별 스케줄 필터링
function filterDaySchedule() {
    if (!window.dayScheduleBookings) return;
    
    const coachId = document.getElementById('schedule-filter-coach').value;
    const status = document.getElementById('schedule-filter-status').value;
    
    let filtered = [...window.dayScheduleBookings];
    
    if (coachId) {
        filtered = filtered.filter(booking => {
            const bookingCoachId = booking.coach ? booking.coach.id : 
                                  (booking.member && booking.member.coach ? booking.member.coach.id : null);
            return bookingCoachId && bookingCoachId.toString() === coachId;
        });
    }
    
    if (status) {
        filtered = filtered.filter(booking => booking.status === status);
    }
    
    renderDaySchedule(filtered);
}

// 날짜별 스케줄 렌더링
function renderDaySchedule(bookings) {
    const tbody = document.getElementById('day-schedule-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    // 시간순으로 정렬
    bookings.sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
    });
    
    tbody.innerHTML = bookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            App.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
        }
        
        // 날짜 포맷팅 (체크인 미처리 현황과 동일한 형식)
        const dateStr = App.formatDate ? App.formatDate(booking.startTime) : startTime.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\./g, '.').replace(/\s/g, ' ');
        
        // 시간 포맷팅 (HH:mm 형식)
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 시설 이름
        const facilityName = booking.facility?.name || booking.facilityName || '-';
        
        // 회원 이름
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || booking.memberName || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 상태
        const status = booking.status || 'PENDING';
        const statusBadge = App.Status.booking.getBadge(status);
        const statusText = App.Status.booking.getText(status);
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${facilityName}</td>
                <td>${memberName}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                <td>
                    ${status === 'PENDING' ? `<button class="btn btn-xs btn-success ml-2" onclick="approveBooking(${booking.id})" title="확인">✓</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="editBookingFromSchedule(${booking.id})">수정</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 스케줄 모달에서 예약 수정
function editBookingFromSchedule(bookingId) {
    App.Modal.close('day-schedule-modal');
    openBookingModal(bookingId);
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

async function loadBookingsList() {
    try {
        clearRentalsEmptyModalTimeout();
        // 예약 목록 로드 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
        await reorderBookingIdsSilent();
        
        // page 파라미터 제거 (백엔드에서 처리하지 않음)
        let bookings = await App.api.get(`/bookings?branch=RENTAL`);
        const branchFilter = window.rentalsFilterBranch;
        if (branchFilter) {
            bookings = (bookings || []).filter(b => {
                const fb = b.facility && b.facility.branch ? String(b.facility.branch).toUpperCase() : '';
                return fb === branchFilter;
            });
            App.log('목록 뷰 지점 필터 적용:', bookings.length, '건');
        }
        const facilitySelect = document.getElementById('filter-facility');
        const filterFacilityId = facilitySelect ? (facilitySelect.value || '').trim() : '';
        if (filterFacilityId) {
            bookings = (bookings || []).filter(b => b.facility && String(b.facility.id) === filterFacilityId);
            App.log('목록 뷰 시설 필터 적용:', bookings.length, '건');
        }
        App.log('예약 목록 조회 결과:', bookings?.length || 0, '건');
        renderBookingsTable(bookings);
        updateRentalsRecordVerification(bookings || [], branchFilter, filterFacilityId);
        if ((bookings || []).length === 0 && (branchFilter || filterFacilityId)) {
            clearRentalsEmptyModalTimeout();
            var msg = branchFilter && filterFacilityId ? '해당 지점·시설의 대관 예약이 없습니다.' : (branchFilter ? '해당 지점의 대관 예약이 없습니다.' : '해당 시설의 대관 예약이 없습니다.');
            window._rentalsEmptyModalTimeout = setTimeout(function() {
                window._rentalsEmptyModalTimeout = null;
                showRentalsEmptyModal(msg);
            }, 80);
        }
    } catch (error) {
        App.err('예약 목록 로드 실패:', error);
    }
}

/** 통계 기간 내 목록 건수와 통계 건수 비교 후 기록 검증 문구 표시 */
function updateRentalsRecordVerification(bookings, branchFilter, filterFacilityId) {
    const el = document.getElementById('rentals-record-verification');
    if (!el) return;
    const stats = window.lastRentalStatsData;
    const period = window.rentalsStatsPeriod;
    if (!stats || !period || !period.start || !period.end) {
        el.style.display = 'none';
        return;
    }
    const periodStart = new Date(period.start).getTime();
    const periodEnd = new Date(period.end).getTime();
    let inPeriod = (bookings || []).filter(b => {
        if (!b.startTime) return false;
        const t = new Date(b.startTime).getTime();
        return t >= periodStart && t <= periodEnd;
    });
    if (branchFilter) {
        inPeriod = inPeriod.filter(b => {
            const fb = b.facility && b.facility.branch ? String(b.facility.branch).toUpperCase() : '';
            return fb === branchFilter;
        });
    }
    if (filterFacilityId) {
        inPeriod = inPeriod.filter(b => b.facility && String(b.facility.id) === filterFacilityId);
    }
    const listCount = inPeriod.length;
    const listConfirmed = inPeriod.filter(b => (b.status || '') === 'CONFIRMED').length;
    const statTotal = stats.totalCount != null ? stats.totalCount : 0;
    const statConfirmed = stats.totalConfirmedCount != null ? stats.totalConfirmedCount : 0;
    const monthLabel = stats.monthLabel || '';
    const match = (listCount === statTotal && listConfirmed === statConfirmed);
    el.style.display = 'block';
    if (match) {
        el.innerHTML = '<span class="rentals-verification-ok">✓ 기록 검증: 통계와 목록 일치 (' + monthLabel + ' 기준 ' + statTotal + '건, 확정 ' + statConfirmed + '건)</span>';
        el.className = 'rentals-record-verification rentals-record-verification--ok';
    } else {
        el.innerHTML = '<span class="rentals-verification-warn">⚠ 통계 ' + statTotal + '건 (확정 ' + statConfirmed + '건) / 목록(기간 내) ' + listCount + '건 (확정 ' + listConfirmed + '건) - 불일치 시 기간·지점 필터를 확인하세요.</span>';
        el.className = 'rentals-record-verification rentals-record-verification--warn';
    }
}

function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            App.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
        }
        
        // 날짜 포맷팅 (체크인 미처리 현황과 동일한 형식)
        const dateStr = App.formatDate ? App.formatDate(booking.startTime) : startTime.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\./g, '.').replace(/\s/g, ' ');
        
        // 시간 포맷팅 (HH:mm 형식)
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 시설 이름
        const facilityName = booking.facility?.name || booking.facilityName || '-';
        
        // 회원 이름
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || booking.memberName || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 상태
        const status = booking.status || 'PENDING';
        
        return `
        <tr>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${facilityName}</td>
            <td>${memberName}</td>
            <td>${booking.participants || 1}명</td>
            <td>
                <span class="badge badge-${getStatusBadge(status)}">${getStatusText(status)}</span>
                ${status === 'PENDING' ? `<button class="btn btn-xs btn-success ml-2" onclick="approveBooking(${booking.id})" title="확인">✓</button>` : ''}
            </td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editBooking(${booking.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBooking(${booking.id})">삭제</button>
            </td>
        </tr>
        `;
    }).join('');
}

function getPurposeText(purpose) {
    const map = {
        'LESSON': '레슨',
        'RENTAL': '대관',
        'PERSONAL_TRAINING': '개인훈련'
    };
    return map[purpose] || purpose || '-';
}

// 레슨 카테고리 관련 함수는 common.js의 App.LessonCategory 사용
function getLessonCategoryText(category) {
    return App.LessonCategory.getText(category);
}

function getLessonCategoryBadge(category) {
    return App.LessonCategory.getBadge(category);
}

// 상태 관련 함수는 common.js의 App.Status.booking 사용
function getStatusBadge(status) {
    return App.Status.booking.getBadge(status);
}

function getStatusText(status) {
    return App.Status.booking.getText(status);
}

// 결제 방법 텍스트는 common.js의 App.PaymentMethod 사용
function getBookingPaymentMethodText(method) {
    return App.PaymentMethod.getText(method);
}

let selectedBookingDate = null;

// 회원 선택 모달 열기
async function openMemberSelectModal(date = null) {
    selectedBookingDate = date || new Date().toISOString().split('T')[0];
    App.log('회원 선택 모달 열기 - selectedBookingDate 설정:', selectedBookingDate, '입력된 date:', date);
    
    // 회원 목록 로드
    await loadMembersForSelect();
    
    // 검색 기능
    const searchInput = document.getElementById('member-search-input');
    searchInput.value = '';
    searchInput.oninput = function() {
        filterMembers(this.value);
    };
    
    App.Modal.open('member-select-modal');
}

// 회원 목록 로드 (대관 예약용: 대관권 보유 회원만 표시)
async function loadMembersForSelect() {
    try {
        const members = await App.api.get('/members?productCategory=RENTAL');
        renderMemberSelectTable(members);
    } catch (error) {
        App.err('회원 목록 로드 실패:', error);
        App.showNotification('회원 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원 선택 테이블 렌더링
function renderMemberSelectTable(members, filterText = '') {
    const tbody = document.getElementById('member-select-table-body');
    
    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">회원이 없습니다.</td></tr>';
        return;
    }
    
    // 필터링 (이름, 회원번호, 전화번호로 검색)
    let filteredMembers = members;
    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filteredMembers = members.filter(m => 
            m.name.toLowerCase().includes(lowerFilter) || 
            (m.memberNumber && m.memberNumber.toLowerCase().includes(lowerFilter)) ||
            (m.phoneNumber && m.phoneNumber.includes(filterText))
        );
    }
    
    if (filteredMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">검색 결과가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredMembers.map(member => {
        const gradeText = getGradeText(member.grade);
        const memberNumber = member.memberNumber || '-';
        return `
            <tr style="cursor: pointer;" onclick="selectMemberForBooking('${memberNumber}', '${member.name}', '${member.phoneNumber || ''}')">
                <td>${member.name}</td>
                <td>${memberNumber}</td>
                <td>${member.phoneNumber || '-'}</td>
                <td><span class="badge badge-info">${gradeText}</span></td>
                <td>${member.school || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectMemberForBooking('${memberNumber}', '${member.name}', '${member.phoneNumber || ''}')">선택</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 회원 필터링
function filterMembers(filterText) {
    // 이미 로드된 회원 목록을 필터링
    const tbody = document.getElementById('member-select-table-body');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const lowerFilter = filterText.toLowerCase();
        row.style.display = text.includes(lowerFilter) ? '' : 'none';
    });
}

// 등급 텍스트 변환
// 회원 등급 텍스트는 common.js의 App.MemberGrade 사용
function getGradeText(grade) {
    return App.MemberGrade.getText(grade);
}

// 회원 선택 시 예약 모달 열기 (memberNumber로 회원 찾기)
async function selectMemberForBooking(memberNumber, memberName, memberPhone) {
    App.Modal.close('member-select-modal');
    
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    App.log('회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 회원번호로 회원 상세 정보 로드
    try {
        // 회원번호로 회원 찾기
        const members = await App.api.get('/members/search?memberNumber=' + encodeURIComponent(memberNumber));
        if (!members || members.length === 0) {
            App.showNotification('회원을 찾을 수 없습니다.', 'danger');
            return;
        }
        
        const member = members[0]; // 첫 번째 결과 사용
        
        // 빠른 예약 모달에서 회원 선택한 경우: 이용권만 로드하고 빠른 예약 모달에 반영
        if (window.rentalsMemberSelectReturnToQuick) {
            window.rentalsMemberSelectReturnToQuick = false;
            setQuickModalMember(member);
            await loadMemberProductsForQuickModal(member.id);
            return;
        }
        
        // 예약 모달 열기
        document.getElementById('booking-modal-title').textContent = '대관 등록';
        document.getElementById('selected-member-number').value = memberNumber; // memberNumber 저장
        
        // 회원 정보 표시
        document.getElementById('member-info-name').textContent = member.name || '-';
        document.getElementById('member-info-phone').textContent = member.phoneNumber || '-';
        document.getElementById('member-info-grade').textContent = getGradeText(member.grade) || '-';
        document.getElementById('member-info-school').textContent = member.school || '-';
        
        // selected-member-id도 설정 (하위 호환성)
        document.getElementById('selected-member-id').value = member.id || '';
        document.getElementById('selected-member-number').value = member.memberNumber || '';
        
        // 회원 정보 섹션 표시, 비회원 섹션 숨기기 (비회원 입력 구역은 유지하고 락만 걸기)
        document.getElementById('member-info-section').style.display = 'block';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        
        // 회원 선택 시 비회원 입력 필드 락: 비활성화·읽기전용·값 비우기
        const renterNameEl = document.getElementById('booking-renter-name');
        const renterPhoneEl = document.getElementById('booking-renter-phone');
        if (renterNameEl) {
            renterNameEl.value = '';
            renterNameEl.disabled = true;
            renterNameEl.readOnly = true;
            renterNameEl.setAttribute('aria-label', '회원 선택 시 비회원 입력 불가');
        }
        if (renterPhoneEl) {
            renterPhoneEl.value = '';
            renterPhoneEl.disabled = true;
            renterPhoneEl.readOnly = true;
            renterPhoneEl.setAttribute('aria-label', '회원 선택 시 비회원 입력 불가');
        }
        const memberSelectNotice = document.getElementById('rental-member-select-notice');
        if (memberSelectNotice) memberSelectNotice.style.display = 'block';
        
        // 코치 목록 로드 (먼저 로드 완료 대기)
        const coachSelect = document.getElementById('booking-coach');
        if (coachSelect) {
            // 코치 목록이 없으면 먼저 로드
            if (coachSelect.options.length <= 1) {
                await loadCoachesForBooking();
            }
            
            // 코치 목록이 로드될 때까지 대기 (최대 1초)
            let attempts = 0;
            while (coachSelect.options.length <= 1 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
        }
        
        // 필요한 필드만 개별적으로 초기화 (폼 리셋 대신)
        // 날짜는 나중에 설정하므로 여기서는 초기화하지 않음
        const setFieldValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) {
                field.value = value;
            }
        };
        
        const setFieldStyle = (id, property, value) => {
            const field = document.getElementById(id);
            if (field) {
                field.style[property] = value;
            }
        };
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
        setFieldValue('booking-id', '');
        App.log('회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
        
        setFieldValue('booking-facility', '');
        setFieldValue('booking-start-time', '');
        setFieldValue('booking-end-time', '');
        setFieldValue('booking-participants', '1');
        setFieldValue('booking-purpose', '');
        setFieldValue('booking-lesson-category', '');
        setFieldValue('booking-status', 'PENDING');
        setFieldValue('booking-payment-method', '');
        setFieldValue('booking-notes', ''); // 메모 필드 ID는 booking-notes
        setFieldValue('booking-non-member-name', '');
        setFieldValue('booking-phone', '');
        setFieldValue('booking-member-product', '');
        setFieldStyle('product-info', 'display', 'none');
        
        // 코치는 나중에 설정하므로 여기서는 초기화하지 않음
        // 날짜 필드에 선택한 날짜 설정
        const dateField = document.getElementById('booking-date');
        if (dateField) {
            dateField.value = dateToSet;
            App.log('예약 날짜 설정 완료:', dateToSet);
        }
        
        // 회원의 상품/이용권 목록 로드
        const memberProducts = await loadMemberProducts(member.id);
        
        // 회원의 등급에 따라 기본값 설정
        // 유소년 회원은 기본적으로 레슨으로 설정
        if (member.grade === 'YOUTH' && !document.getElementById('booking-purpose').value) {
            document.getElementById('booking-purpose').value = 'LESSON';
            toggleLessonCategory();
        }
        
        // 회원 예약은 상태를 기본값 PENDING으로 설정
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING';
        }
        
        // 결제 방식 설정 (이용권 보유 시 선결제)
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        if (paymentMethodSelect) {
            const eligibleProducts = (memberProducts || []).filter(mp => {
                const type = mp.product?.type;
                return type === 'COUNT_PASS' || type === 'MONTHLY_PASS' || type === 'TIME_PASS';
            });
            paymentMethodSelect.value = eligibleProducts.length > 0 ? 'PREPAID' : '';
        }
        
        // 코치 정보 저장 및 미리 로드 (모달 열기 전에)
        const coachIdToSet = member.coach ? (member.coach.id || member.coach) : null;
        let coachInfo = member.coach;
        
        // 코치 상세 정보 미리 가져오기 (필요한 경우)
        if (coachIdToSet && (!coachInfo.name || !coachInfo.specialties)) {
            try {
                coachInfo = await App.api.get(`/coaches/${coachIdToSet}`);
            } catch (error) {
                App.err('코치 정보 로드 실패:', error);
            }
        }
        
        // 코치 설정 함수 (모달 열기 전에 준비)
        const setCoachAndLessonCategory = async () => {
            if (!coachIdToSet) return;
            
            // 메인 폼의 코치 필드 찾기 (coach-group 내부)
            const coachGroup = document.getElementById('coach-group');
            if (!coachGroup) {
                App.err('❌ coach-group을 찾을 수 없습니다.');
                return;
            }
            
            const coachSelectEl = coachGroup.querySelector('#booking-coach');
            if (!coachSelectEl) {
                App.err('❌ 코치 선택 필드를 찾을 수 없습니다.');
                return;
            }
            
            // 코치 목록이 로드되었는지 확인
            if (coachSelectEl.options.length <= 1) {
                await loadCoachesForBooking();
                let attempts = 0;
                while (coachSelectEl.options.length <= 1 && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }
            }
            
            // 코치 ID가 옵션에 있는지 확인
            const coachOption = Array.from(coachSelectEl.options).find(opt => {
                const optValue = opt.value;
                return optValue == coachIdToSet || optValue === String(coachIdToSet);
            });
            
            if (!coachOption) {
                App.err('❌ 코치 옵션을 찾을 수 없습니다. 코치 ID:', coachIdToSet);
                return;
            }
            
            // 코치 설정
            const optionIndex = Array.from(coachSelectEl.options).indexOf(coachOption);
            coachSelectEl.selectedIndex = optionIndex;
            coachSelectEl.value = coachOption.value;
            
            // 이벤트 발생
            coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 설정 확인
            await new Promise(resolve => setTimeout(resolve, 100));
            const finalValue = coachSelectEl.value;
            if (finalValue == coachIdToSet || finalValue === String(coachIdToSet)) {
                App.log('✅ 코치 설정 완료:', coachOption.textContent);
                
                // 레슨 종목 설정
                if (coachInfo && coachInfo.specialties && coachInfo.specialties.length > 0) {
                    const lessonCategory = App.LessonCategory.fromCoachSpecialties(coachInfo.specialties);
                    if (lessonCategory) {
                        const lessonCategoryEl = document.getElementById('booking-lesson-category');
                        const purposeEl = document.getElementById('booking-purpose');
                        
                        if (lessonCategoryEl) {
                            lessonCategoryEl.value = lessonCategory;
                        }
                        
                        if (purposeEl && !purposeEl.value) {
                            purposeEl.value = 'LESSON';
                            toggleLessonCategory();
                        }
                    }
                }
            } else {
                App.warn('⚠️ 코치 설정 확인 실패, 재시도...');
                // 재시도
                coachSelectEl.selectedIndex = optionIndex;
                coachSelectEl.value = coachOption.value;
                coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        
        // 모달을 먼저 열기
        App.Modal.open('booking-modal');
        
        // 모달이 완전히 열린 후 코치 설정
        if (coachIdToSet) {
            // 여러 방법으로 시도
            requestAnimationFrame(() => {
                requestAnimationFrame(async () => {
                    await setCoachAndLessonCategory();
                });
            });
            
            setTimeout(async () => {
                const coachGroup = document.getElementById('coach-group');
                if (coachGroup) {
                    const coachSelectEl = coachGroup.querySelector('#booking-coach');
                    if (coachSelectEl && (!coachSelectEl.value || coachSelectEl.value === '')) {
                        await setCoachAndLessonCategory();
                    }
                }
            }, 300);
        }
    } catch (error) {
        App.err('회원 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 비회원 예약 모달 열기
function openNonMemberBookingModal() {
    App.Modal.close('member-select-modal');
    selectNonMember();
}

// 비회원 선택
function selectNonMember() {
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    App.log('비회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 예약 모달 열기
    document.getElementById('booking-modal-title').textContent = '대관 등록';
    document.getElementById('selected-member-id').value = '';
    document.getElementById('selected-member-number').value = '';
    
    // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
    document.getElementById('booking-id').value = '';
    App.log('비회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
    
    // 폼 리셋 (날짜 필드는 제외)
    const bookingForm = document.getElementById('booking-form');
    bookingForm.reset();
    
    // reset 후 날짜 필드에 선택한 날짜 설정 (약간의 지연을 두어 확실히 설정)
    setTimeout(() => {
        document.getElementById('booking-date').value = dateToSet;
        App.log('예약 날짜 설정 완료 (비회원):', dateToSet);
    }, 10);
    
    // 비회원 섹션 표시, 회원 정보 섹션 및 선택 섹션 숨기기
    document.getElementById('non-member-section').style.display = 'block';
    document.getElementById('member-info-section').style.display = 'none';
    document.getElementById('member-select-section').style.display = 'none';
    
    // 비회원은 결제 방식 선택 가능
    const paymentMethodSelect = document.getElementById('booking-payment-method');
    if (paymentMethodSelect) { paymentMethodSelect.disabled = false; }
    
    // 비회원 예약은 항상 'PENDING' 상태로 고정 (승인 필요)
    const statusSelect = document.getElementById('booking-status');
    if (statusSelect) {
        statusSelect.value = 'PENDING';
        statusSelect.disabled = true; // 비회원은 상태 변경 불가
    }
    
    App.Modal.open('booking-modal');
}

// 회원 변경
function changeMember() {
    // 회원 선택 모달 열기
    openMemberSelectModal(selectedBookingDate || document.getElementById('booking-date').value);
}

// 빠른 예약 모달: 선택한 회원 정보 표시
function setQuickModalMember(member) {
    if (!member) return;
    document.getElementById('quick-selected-member-id').value = member.id || '';
    document.getElementById('quick-selected-member-number').value = member.memberNumber || '';
    document.getElementById('quick-member-info-text').textContent = (member.name || '-') + ' (' + (member.memberNumber || '') + ')';
    document.getElementById('quick-member-info-wrap').style.display = 'block';
    document.getElementById('quick-product-wrap').style.display = 'block';
    var quickName = document.getElementById('quick-name');
    var quickPhone = document.getElementById('quick-phone');
    if (quickName) {
        quickName.value = '';
        quickName.disabled = true;
        quickName.readOnly = true;
        quickName.placeholder = '회원 선택 시 입력 불가';
        quickName.setAttribute('aria-label', '회원 선택 시 비회원 입력 불가');
    }
    if (quickPhone) {
        quickPhone.value = '';
        quickPhone.disabled = true;
        quickPhone.readOnly = true;
        quickPhone.setAttribute('aria-label', '회원 선택 시 비회원 입력 불가');
    }
}

// 빠른 예약 모달: 회원/이용권 선택 취소
function clearQuickModalMember() {
    document.getElementById('quick-selected-member-id').value = '';
    document.getElementById('quick-selected-member-number').value = '';
    document.getElementById('quick-member-info-wrap').style.display = 'none';
    document.getElementById('quick-product-wrap').style.display = 'none';
    var sel = document.getElementById('quick-booking-member-product');
    if (sel) {
        sel.innerHTML = '<option value="">상품 선택...</option>';
    }
    document.getElementById('quick-product-info').style.display = 'none';
    var quickName = document.getElementById('quick-name');
    var quickPhone = document.getElementById('quick-phone');
    if (quickName) {
        quickName.value = '';
        quickName.disabled = false;
        quickName.readOnly = false;
        quickName.placeholder = '비회원일 때만 입력';
        quickName.removeAttribute('aria-label');
    }
    if (quickPhone) {
        quickPhone.value = '';
        quickPhone.disabled = false;
        quickPhone.readOnly = false;
        quickPhone.removeAttribute('aria-label');
    }
}

// 빠른 예약 모달: 회원의 이용권 목록 로드 (대관: RENTAL만 표시, 첫 항목 자동 선택, 선결제 고정)
async function loadMemberProductsForQuickModal(memberId) {
    var select = document.getElementById('quick-booking-member-product');
    var productInfo = document.getElementById('quick-product-info');
    if (!select) return;
    try {
        var memberProducts = await App.api.get('/member-products?memberId=' + memberId);
        var activeProducts = (memberProducts || []).filter(function(mp) { return mp.status === 'ACTIVE'; });
        function categoryStr(mp) {
            if (!mp.product || mp.product.category == null) return '';
            var c = mp.product.category;
            return (typeof c === 'string' ? c : (c.name || c || '')).toString().toUpperCase();
        }
        var rentalProducts = activeProducts.filter(function(mp) { return categoryStr(mp) === 'RENTAL'; });
        activeProducts = rentalProducts.length > 0 ? rentalProducts : [];
        select.innerHTML = activeProducts.length === 0 ? '<option value="">대관 이용권 없음</option>' : '<option value="">상품 선택...</option>';
        if (activeProducts.length === 0) {
            if (productInfo) {
                productInfo.textContent = '사용 가능한 대관 이용권이 없습니다.';
                productInfo.style.display = 'block';
            }
            return;
        }
        activeProducts.forEach(function(mp) {
            var opt = document.createElement('option');
            opt.value = mp.id;
            var product = mp.product || {};
            var text = product.name || '상품';
            if (product.price) text += ' - ' + (App.formatCurrency ? App.formatCurrency(product.price) : ('₩' + Number(product.price).toLocaleString()));
            opt.textContent = text;
            opt.dataset.productType = product.type || '';
            opt.dataset.remainingCount = (mp.remainingCount != null ? mp.remainingCount : (product.type === 'COUNT_PASS' ? (product.usageCount != null ? product.usageCount : 10) : 0));
            select.appendChild(opt);
        });
        select.onchange = function() {
            var chosen = this.options[this.selectedIndex];
            var paymentEl = document.getElementById('quick-booking-payment-method');
            if (chosen.value) {
                if (paymentEl) { paymentEl.value = 'PREPAID'; paymentEl.disabled = true; }
                if (productInfo) {
                    var type = chosen.dataset.productType;
                    var remaining = parseInt(chosen.dataset.remainingCount, 10) || 0;
                    if (type === 'COUNT_PASS') {
                        productInfo.textContent = remaining > 0 ? '횟수권 사용: 잔여 ' + remaining + '회' : '잔여 횟수가 없습니다.';
                        productInfo.style.display = 'block';
                    } else {
                        productInfo.textContent = '상품 사용 예정';
                        productInfo.style.display = 'block';
                    }
                }
            } else {
                if (paymentEl) { paymentEl.value = ''; paymentEl.disabled = false; }
                if (productInfo) productInfo.style.display = 'none';
            }
        };
        if (select.options.length > 1) {
            var firstVal = select.options[1].value;
            select.value = firstVal;
            select.selectedIndex = 1;
            var paymentEl = document.getElementById('quick-booking-payment-method');
            if (paymentEl) { paymentEl.value = 'PREPAID'; paymentEl.disabled = true; }
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } catch (err) {
        App.err('빠른 예약 이용권 로드 실패:', err);
        if (select) select.innerHTML = '<option value="">상품 선택...</option>';
    }
}

// 빠른 예약 모달 열기 (날짜 클릭 시)
async function openQuickBookingModal(dateStr) {
    selectedBookingDate = dateStr;
    App.log('빠른 예약 모달 열기:', dateStr);
    
    // 날짜 포맷팅
    const date = new Date(dateStr + 'T00:00:00');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const formattedDate = `${year}년 ${month}월 ${day}일`;
    
    document.getElementById('quick-booking-title').textContent = `대관 등록 - ${formattedDate}`;
    
    // 폼 초기화
    document.getElementById('quick-booking-form').reset();
    document.getElementById('quick-booking-date').value = dateStr;
    document.getElementById('quick-selected-member-id').value = '';
    document.getElementById('quick-selected-member-number').value = '';
    clearQuickModalMember();
    
    // 수정 모드가 아님을 표시
    const quickBookingId = document.getElementById('quick-booking-id');
    if (quickBookingId) {
        quickBookingId.value = '';
    }
    
    // 삭제 버튼 숨기기 (신규 등록 모드)
    const quickDeleteBtn = document.getElementById('quick-booking-delete-btn');
    if (quickDeleteBtn) {
        quickDeleteBtn.style.display = 'none';
    }
    
    // 회원 선택 버튼: 빠른 예약 모달로 돌아오도록 플래그 설정 후 회원 선택 모달 열기
    const quickMemberSelectBtn = document.getElementById('quick-member-select-btn');
    if (quickMemberSelectBtn && !quickMemberSelectBtn._bound) {
        quickMemberSelectBtn._bound = true;
        quickMemberSelectBtn.onclick = function() {
            window.rentalsMemberSelectReturnToQuick = true;
            openMemberSelectModal(document.getElementById('quick-booking-date').value || selectedBookingDate);
        };
    }
    
    // 시설 목록 로드 (사하점 고정)
    try {
        await loadFacilities();
        const facilitySelect = document.getElementById('booking-facility');
        const quickFacilitySelect = document.getElementById('quick-facility');
        if (facilitySelect && quickFacilitySelect) {
            quickFacilitySelect.innerHTML = facilitySelect.innerHTML;
            quickFacilitySelect.selectedIndex = facilitySelect.selectedIndex;
            quickFacilitySelect.disabled = facilitySelect.disabled;
        }
    } catch (error) {
        App.err('시설 목록 로드 실패:', error);
    }
    
    App.Modal.open('quick-booking-modal');
}

// 빠른 예약 모달로 수정 모드 열기
async function openQuickBookingModalForEdit(id) {
    try {
        App.log('빠른 예약 모달로 수정 모드 열기:', id);
        
        // 예약 데이터 가져오기
        const booking = await App.api.get(`/bookings/${id}`);
        
        // 날짜 포맷팅
        const startDate = new Date(booking.startTime);
        const dateStr = startDate.toISOString().split('T')[0];
        const year = startDate.getFullYear();
        const month = startDate.getMonth() + 1;
        const day = startDate.getDate();
        const formattedDate = `${year}년 ${month}월 ${day}일`;
        
        document.getElementById('quick-booking-title').textContent = `빠른 예약 수정 - ${formattedDate}`;
        
        // 예약 ID 저장
        const quickBookingId = document.getElementById('quick-booking-id');
        if (quickBookingId) {
            quickBookingId.value = id;
        }
        
        // 삭제 버튼 표시 (수정 모드)
        const quickDeleteBtn = document.getElementById('quick-booking-delete-btn');
        if (quickDeleteBtn) {
            quickDeleteBtn.style.display = 'block';
            quickDeleteBtn.setAttribute('data-booking-id', id);
        }
        
        // 시설 목록 로드 (사하점 고정)
        await loadFacilities();
        const facilitySelect = document.getElementById('booking-facility');
        const quickFacilitySelect = document.getElementById('quick-facility');
        if (facilitySelect && quickFacilitySelect) {
            quickFacilitySelect.innerHTML = facilitySelect.innerHTML;
            quickFacilitySelect.selectedIndex = facilitySelect.selectedIndex;
            quickFacilitySelect.disabled = facilitySelect.disabled;
        }
        
        // 시설 목록이 로드될 때까지 대기
        let attempts = 0;
        while (quickFacilitySelect && quickFacilitySelect.options.length <= 1 && attempts < 40) {
            await new Promise(resolve => setTimeout(resolve, 50));
            attempts++;
        }
        
        // 데이터 채우기
        document.getElementById('quick-booking-date').value = dateStr;
        document.getElementById('quick-name').value = booking.nonMemberName || '';
        document.getElementById('quick-phone').value = booking.nonMemberPhone || '';
        document.getElementById('quick-start-time').value = startDate.toTimeString().slice(0, 5);
        
        const endDate = new Date(booking.endTime);
        document.getElementById('quick-end-time').value = endDate.toTimeString().slice(0, 5);
        
        // 회원 예약인 경우 회원/이용권 UI 표시 + 비회원 입력 필드 비활성화
        if (booking.member && (booking.member.id || booking.member.memberNumber)) {
            var mem = booking.member;
            document.getElementById('quick-selected-member-id').value = mem.id || '';
            document.getElementById('quick-selected-member-number').value = mem.memberNumber || '';
            document.getElementById('quick-member-info-text').textContent = (mem.name || '-') + ' (' + (mem.memberNumber || '') + ')';
            document.getElementById('quick-member-info-wrap').style.display = 'block';
            document.getElementById('quick-product-wrap').style.display = 'block';
            // 회원 선택 시 비회원 입력란 비활성화 (클릭/입력 불가)
            var quickNameEl = document.getElementById('quick-name');
            var quickPhoneEl = document.getElementById('quick-phone');
            if (quickNameEl) {
                quickNameEl.value = '';
                quickNameEl.disabled = true;
                quickNameEl.readOnly = true;
                quickNameEl.placeholder = '회원 선택 시 입력 불가';
                quickNameEl.setAttribute('aria-label', '회원 선택 시 비회원 입력 불가');
            }
            if (quickPhoneEl) {
                quickPhoneEl.value = '';
                quickPhoneEl.disabled = true;
                quickPhoneEl.readOnly = true;
                quickPhoneEl.setAttribute('aria-label', '회원 선택 시 비회원 입력 불가');
            }
            await loadMemberProductsForQuickModal(mem.id);
            if (booking.memberProduct && booking.memberProduct.id) {
                var qsel = document.getElementById('quick-booking-member-product');
                if (qsel) qsel.value = booking.memberProduct.id;
                // 수정 시: 예약 단건 API 잔여와 목록(회원 상품) API 잔여 중 더 작은 값 표시 (체크인 후 4→3인데 9회로 나오는 것 방지)
                var quickProductInfo = document.getElementById('quick-product-info');
                if (quickProductInfo) {
                    var fromBooking = (booking.memberProduct.remainingCount != null && booking.memberProduct.remainingCount !== undefined)
                        ? (parseInt(booking.memberProduct.remainingCount, 10) || 0) : null;
                    var fromList = null;
                    var opt = qsel && qsel.options ? Array.prototype.find.call(qsel.options, function(o) { return o.value === String(booking.memberProduct.id); }) : null;
                    if (opt && opt.dataset && opt.dataset.remainingCount != null) fromList = parseInt(opt.dataset.remainingCount, 10);
                    if (fromList === null && opt && opt.dataset && opt.dataset.remainingCount !== undefined) fromList = parseInt(opt.dataset.remainingCount, 10);
                    var r = (fromBooking != null && fromList != null) ? Math.min(fromBooking, fromList) : (fromBooking != null ? fromBooking : (fromList != null ? fromList : 0));
                    quickProductInfo.textContent = r > 0 ? '횟수권 사용: 잔여 ' + r + '회' : '잔여 횟수가 없습니다.';
                    quickProductInfo.style.display = 'block';
                }
            }
        } else {
            clearQuickModalMember();
        }
        
        if (booking.facility && booking.facility.id) {
            quickFacilitySelect.value = booking.facility.id;
            // 값이 제대로 설정되었는지 확인
            if (quickFacilitySelect.value !== String(booking.facility.id)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                quickFacilitySelect.value = booking.facility.id;
            }
        }
        
        // 메모에서 [복사] 접두사 제거 (UI에만 표시, DB에는 원본 유지)
        let memoValue = booking.memo || '';
        if (memoValue) {
            // [복사] 접두사 제거 (여러 개일 수 있음)
            memoValue = memoValue.replace(/^\[복사\]\s*/g, '').trim();
        }
        document.getElementById('quick-memo').value = memoValue;
        
        var quickPaymentSelect = document.getElementById('quick-booking-payment-method');
        if (quickPaymentSelect) {
            var pm = booking.paymentMethod || '';
            if (pm === 'DEFERRED') pm = 'POSTPAID';
            if (pm === 'ONSITE') pm = 'ON_SITE';
            quickPaymentSelect.value = pm || '';
        }
        
        App.Modal.open('quick-booking-modal');
        
        App.log('[빠른 예약 수정] 데이터 로드 완료:', {
            name: booking.nonMemberName,
            phone: booking.nonMemberPhone,
            dateStr,
            startTime: startDate.toTimeString().slice(0, 5),
            endTime: endDate.toTimeString().slice(0, 5),
            facilityId: booking.facility?.id,
            memo: booking.memo,
            paymentMethod: booking.paymentMethod
        });
    } catch (error) {
        App.err('빠른 예약 모달로 수정 모드 열기 실패:', error);
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 빠른 예약 저장 (모달에 입력한 모든 값을 그대로 반영)
async function saveQuickBooking() {
    const bookingId = document.getElementById('quick-booking-id')?.value?.trim();
    const isEditMode = !!bookingId;
    
    // 저장 시점에 폼에서 직접 읽어 반영
    const quickMemberId = (document.getElementById('quick-selected-member-id')?.value || '').trim();
    const quickMemberNumber = (document.getElementById('quick-selected-member-number')?.value || '').trim();
    const memberProductId = (document.getElementById('quick-booking-member-product')?.value || '').trim();
    const name = (document.getElementById('quick-name')?.value || '').trim();
    const startTime = (document.getElementById('quick-start-time')?.value || '').trim();
    const endTime = (document.getElementById('quick-end-time')?.value || '').trim();
    const facilityId = (document.getElementById('quick-facility')?.value || '').trim();
    const phone = (document.getElementById('quick-phone')?.value || '').trim();
    const memo = (document.getElementById('quick-memo')?.value || '').trim();
    const dateStr = (document.getElementById('quick-booking-date')?.value || '').trim();
    let paymentMethod = (document.getElementById('quick-booking-payment-method')?.value || '').trim();
    if (paymentMethod === 'ONSITE') paymentMethod = 'ON_SITE';
    if (paymentMethod === 'DEFERRED') paymentMethod = 'POSTPAID';
    if (!paymentMethod) paymentMethod = 'ON_SITE'; // 기본값: 현장
    const dataPaymentMethod = paymentMethod === 'ON_SITE' ? 'ON_SITE' : (paymentMethod === 'POSTPAID' ? 'POSTPAID' : paymentMethod);
    
    const isMemberBooking = !!(quickMemberId || quickMemberNumber);
    
    // 필수 필드 검증: 회원 선택 시 이용권 필수, 비회원 시 이름 필수
    if (isMemberBooking) {
        if (!memberProductId) {
            App.showNotification('사용할 상품/이용권을 선택해주세요.', 'danger');
            return;
        }
    } else {
        if (!name) {
            App.showNotification('이름을 입력하거나 회원을 선택해주세요.', 'danger');
            return;
        }
    }
    if (!startTime || !endTime) {
        App.showNotification('시작/종료 시간을 입력해주세요.', 'danger');
        return;
    }
    if (!facilityId) {
        App.showNotification('시설을 선택해주세요.', 'danger');
        return;
    }
    if (!dateStr) {
        App.showNotification('예약 날짜가 없습니다.', 'danger');
        return;
    }
    
    // 시간 검증
    if (startTime >= endTime) {
        App.showNotification('종료 시간은 시작 시간보다 늦어야 합니다.', 'danger');
        return;
    }
    
    // 날짜와 시간 결합 (ISO 형식, 초 없으면 :00 추가)
    const padSeconds = (t) => (t.length === 4 || t.length === 5) ? t + ':00' : t;
    const startDateTime = dateStr + 'T' + padSeconds(startTime);
    const endDateTime = dateStr + 'T' + padSeconds(endTime);
    
    // 예약 데이터: 회원 예약이면 memberNumber + memberProductId, 비회원이면 nonMemberName + nonMemberPhone
    const data = {
        facility: { id: parseInt(facilityId, 10) },
        startTime: startDateTime,
        endTime: endDateTime,
        participants: 1,
        purpose: 'RENTAL',
        branch: 'RENTAL',
        paymentMethod: dataPaymentMethod,
        memo: memo || null
    };
    if (isMemberBooking) {
        data.memberNumber = quickMemberNumber || null;
        data.member = quickMemberId ? { id: parseInt(quickMemberId, 10) } : null;
        data.memberProductId = memberProductId ? parseInt(memberProductId, 10) : null;
        data.nonMemberName = null;
        data.nonMemberPhone = null;
    } else {
        data.nonMemberName = name || null;
        data.nonMemberPhone = phone || null;
    }
    if (!isEditMode) {
        data.status = 'PENDING';
    }
    
    App.log('빠른 예약 저장:', isEditMode ? '(수정 모드)' : '(신규)', data);
    
    try {
        if (isEditMode) {
            // 수정 모드
            await App.api.put(`/bookings/${bookingId}`, data);
            App.showNotification('대관이 수정되었습니다.', 'success');
        } else {
            // 신규 등록
            await App.api.post('/bookings', data);
            App.showNotification('대관이 등록되었습니다.', 'success');
        }
        
        App.Modal.close('quick-booking-modal');
        
        // 캘린더 새로고침
        await renderCalendar();
    } catch (error) {
        App.err('빠른 예약 저장 실패:', error);
        App.showNotification(isEditMode ? '대관 수정에 실패했습니다.' : '대관 등록에 실패했습니다.', 'danger');
    }
}

// 상세 입력 모달로 전환
async function openDetailBookingModal() {
    // 빠른 예약 모달 데이터 가져오기
    const quickMemberId = document.getElementById('quick-selected-member-id')?.value?.trim();
    const quickMemberNumber = document.getElementById('quick-selected-member-number')?.value?.trim();
    const name = document.getElementById('quick-name').value.trim();
    const startTime = document.getElementById('quick-start-time').value;
    const endTime = document.getElementById('quick-end-time').value;
    const facilityId = document.getElementById('quick-facility').value;
    const phone = document.getElementById('quick-phone').value.trim();
    const memo = document.getElementById('quick-memo').value.trim();
    const dateStr = document.getElementById('quick-booking-date').value;
    
    // 빠른 예약 모달 닫기
    App.Modal.close('quick-booking-modal');
    
    // 기존 예약 모달 열기
    selectedBookingDate = dateStr;
    openBookingModal(null);
    
    // 모달이 열릴 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 시설 목록 로드 대기
    await loadFacilities();
    
    // 시설 목록이 로드될 때까지 대기
    let attempts = 0;
    const facilitySelect = document.getElementById('booking-facility');
    while (facilitySelect && facilitySelect.options.length <= 1 && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    
    var isMemberSelected = !!(quickMemberId || quickMemberNumber);
    if (isMemberSelected) {
        document.getElementById('selected-member-id').value = quickMemberId || '';
        document.getElementById('selected-member-number').value = quickMemberNumber || '';
        document.getElementById('member-info-section').style.display = 'block';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        var renterNameEl = document.getElementById('booking-renter-name');
        var renterPhoneEl = document.getElementById('booking-renter-phone');
        if (renterNameEl) { renterNameEl.value = ''; renterNameEl.disabled = true; renterNameEl.readOnly = true; }
        if (renterPhoneEl) { renterPhoneEl.value = ''; renterPhoneEl.disabled = true; renterPhoneEl.readOnly = true; }
        var memberSelectNotice = document.getElementById('rental-member-select-notice');
        if (memberSelectNotice) memberSelectNotice.style.display = 'block';
        if (quickMemberId) {
            var mem = await App.api.get('/members/' + quickMemberId).catch(function() { return null; });
            if (mem) {
                document.getElementById('member-info-name').textContent = mem.name || '-';
                document.getElementById('member-info-phone').textContent = mem.phoneNumber || '-';
                document.getElementById('member-info-grade').textContent = getGradeText(mem.grade) || '-';
                document.getElementById('member-info-school').textContent = mem.school || '-';
                await loadMemberProducts(mem.id);
            }
        }
    } else if (name) {
        selectNonMember();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 입력된 데이터 설정 (비회원인 경우만 이름/연락처)
    if (name && !isMemberSelected) {
        document.getElementById('booking-non-member-name').value = name;
    }
    if (phone && !isMemberSelected) {
        document.getElementById('booking-phone').value = phone;
    }
    if (dateStr) {
        document.getElementById('booking-date').value = dateStr;
    }
    if (startTime) {
        document.getElementById('booking-start-time').value = startTime;
    }
    if (endTime) {
        document.getElementById('booking-end-time').value = endTime;
    }
    if (memo) {
        document.getElementById('booking-notes').value = memo;
    }
    
    // 시설 설정 (목록이 로드된 후)
    if (facilityId && facilitySelect) {
        facilitySelect.value = facilityId;
        // 값이 제대로 설정되었는지 확인
        if (facilitySelect.value !== facilityId) {
            await new Promise(resolve => setTimeout(resolve, 100));
            facilitySelect.value = facilityId;
        }
    }
    
    // 목적 설정
    const purposeSelect = document.getElementById('booking-purpose');
    if (purposeSelect) {
        purposeSelect.value = 'RENTAL';
        purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
        purposeSelect.style.display = 'block';
    }
    
    // 결제 방식 복사 (빠른 예약 → 상세 입력)
    var quickPaymentEl = document.getElementById('quick-booking-payment-method');
    var detailPaymentEl = document.getElementById('booking-payment-method');
    if (quickPaymentEl && detailPaymentEl && quickPaymentEl.value) {
        detailPaymentEl.value = quickPaymentEl.value;
    }
    
    // 레슨 카테고리 필드 숨김 (대관이므로)
    toggleLessonCategory();
    
    App.log('[상세 입력] 빠른 예약 데이터 전달 완료:', {
        name, phone, dateStr, startTime, endTime, facilityId, memo
    });
}

// 날짜 클릭으로 예약 모달 열기 (기존 함수 - 예약 등록 버튼용)
function openBookingModalFromDate(dateStr) {
    selectedBookingDate = dateStr;
    App.log('날짜 클릭으로 예약 모달 열기:', dateStr);
    openBookingModal(null);
}

function openBookingModal(id = null) {
    const modal = document.getElementById('booking-modal');
    const title = document.getElementById('booking-modal-title');
    const deleteBtn = document.getElementById('booking-delete-btn');
    const form = document.getElementById('booking-form');
    
    if (id) {
        // 대관 수정 모달
        title.textContent = '대관 수정';
        
        // 삭제 버튼 표시
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
            deleteBtn.setAttribute('data-booking-id', id);
        }
        
        // 예약 등록 버튼 active 제거 (수정 모달이므로)
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.remove('active');
        }
        
        // 현재 뷰 버튼 유지
        // 목적 필드를 "대관"으로 고정 (수정 시에도)
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.value = 'RENTAL';
            purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
            purposeSelect.style.display = 'block';
        }
        
        // 모달 먼저 열기
        App.Modal.open('booking-modal');
        
        // 모달이 열린 후 예약 데이터 로드
        setTimeout(() => {
            loadBookingData(id);
        }, 100);
    } else {
        // 대관 등록 모달
        title.textContent = '대관 등록';
        
        // 삭제 버튼 숨김
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
            deleteBtn.removeAttribute('data-booking-id');
        }
        
        // 예약 등록 버튼에 active 클래스 추가
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.add('active');
        }
        
        // 다른 뷰 버튼들의 active 클래스 제거
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지) - reset 전에
        const bookingIdElement = document.getElementById('booking-id');
        if (bookingIdElement) {
            bookingIdElement.value = '';
        }
        
        // 상태 필드를 먼저 PENDING으로 초기화 (reset 전에)
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.value = 'PENDING';
            App.log('[예약 모달] reset 전 상태 필드 PENDING으로 설정');
        }
        
        form.reset();
        
        // reset 후 필수 값들 다시 설정
        if (bookingIdElement) {
            bookingIdElement.value = '';
        }
        document.getElementById('selected-member-id').value = '';
        document.getElementById('selected-member-number').value = '';
        document.getElementById('booking-date').value = selectedBookingDate || new Date().toISOString().split('T')[0];
        App.log('[예약 모달] 예약 등록 모달 - booking-id 초기화 완료');
        
        // 목적 필드를 "대관"으로 고정
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.value = 'RENTAL';
            purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
            purposeSelect.style.display = 'block';
        }
        
        // 레슨 카테고리 필드 초기화 (대관이므로 숨김)
        toggleLessonCategory();
        
        // 모든 섹션 초기화 (대관용)
        document.getElementById('member-info-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        
        // 대관용 필드 초기화 및 비회원 입력 필드 재활성화
        const renterNameInput = document.getElementById('booking-renter-name');
        const renterPhoneInput = document.getElementById('booking-renter-phone');
        if (renterNameInput) { renterNameInput.value = ''; renterNameInput.disabled = false; renterNameInput.readOnly = false; renterNameInput.removeAttribute('aria-label'); }
        if (renterPhoneInput) { renterPhoneInput.value = ''; renterPhoneInput.disabled = false; renterPhoneInput.readOnly = false; renterPhoneInput.removeAttribute('aria-label'); }
        const memberSelectNotice = document.getElementById('rental-member-select-notice');
        if (memberSelectNotice) memberSelectNotice.style.display = 'none';
        
        // 결제 방식 초기화 (비회원 선택 시 선택 가능하도록)
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        if (paymentMethodSelect) { paymentMethodSelect.value = ''; paymentMethodSelect.disabled = false; }
        
        // 상태 필드 활성화 및 PENDING으로 명시적 설정 (reset 후 다시 설정)
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING'; // 새 예약은 항상 PENDING으로 시작
            App.log('[예약 모달] reset 후 상태 필드 PENDING으로 재설정, 현재 값:', statusSelect.value);
            
            // 추가 확인: 만약 여전히 다른 값이면 강제로 PENDING 설정
            if (statusSelect.value !== 'PENDING') {
                App.warn('[예약 모달] 상태 필드가 PENDING이 아님, 강제로 PENDING 설정');
                statusSelect.value = 'PENDING';
            }
        }
    }
    
    App.Modal.open('booking-modal');
    
    // 모달 닫기 이벤트 리스너 추가
    setupBookingModalCloseHandler();
}

// 예약 모달 닫기 핸들러 설정
function setupBookingModalCloseHandler() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;
    
    const closeHandler = () => {
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.remove('active');
        }
        
        // 현재 뷰에 맞는 버튼에 active 클래스 추가
        if (currentView === 'calendar') {
            document.getElementById('btn-calendar')?.classList.add('active');
        } else if (currentView === 'list') {
            document.getElementById('btn-list')?.classList.add('active');
        }
    };
    
    // MutationObserver로 모달의 active 클래스 제거 감지
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!modal.classList.contains('active')) {
                    closeHandler();
                }
            }
        });
    });
    
    observer.observe(modal, {
        attributes: true,
        attributeFilter: ['class']
    });
}

async function loadBookingData(id) {
    try {
        // 시설 선택 필드 확인
        const facilitySelect = document.getElementById('booking-facility');
        if (!facilitySelect) {
            App.err('[예약 수정] 시설 선택 필드를 찾을 수 없습니다.');
            // 필드가 없으면 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 200));
            const retrySelect = document.getElementById('booking-facility');
            if (!retrySelect) {
                App.showNotification('시설 선택 필드를 찾을 수 없습니다.', 'danger');
                return;
            }
        }
        
        // 시설 목록 먼저 로드 (시설 드롭다운이 비어있을 수 있으므로)
        await loadFacilities();
        
        const booking = await App.api.get(`/bookings/${id}`);
        // 폼에 데이터 채우기
        document.getElementById('booking-id').value = booking.id;
        
        // 시설 선택 필드에 값 설정
        const facilitySelectAfter = document.getElementById('booking-facility');
        if (facilitySelectAfter) {
            // 시설 목록이 로드될 때까지 대기 (최대 2초)
            let attempts = 0;
            while (facilitySelectAfter.options.length <= 1 && attempts < 40) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
            
            // 시설 목록이 여전히 없으면 다시 로드 시도
            if (facilitySelectAfter.options.length <= 1) {
                App.warn('[예약 수정] 시설 목록이 비어있어 재로드 시도');
                await loadFacilities();
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            if (booking.facility && booking.facility.id) {
                facilitySelectAfter.value = booking.facility.id;
                App.log('[예약 수정] 시설 설정:', booking.facility.id, booking.facility.name);
                
                // 값이 제대로 설정되었는지 확인
                if (facilitySelectAfter.value !== String(booking.facility.id)) {
                    App.warn('[예약 수정] 시설 값 설정 실패, 재시도');
                    await new Promise(resolve => setTimeout(resolve, 100));
                    facilitySelectAfter.value = booking.facility.id;
                }
            } else {
                facilitySelectAfter.value = '';
                App.warn('[예약 수정] 시설 정보 없음');
            }
        } else {
            App.err('[예약 수정] 시설 선택 필드를 찾을 수 없습니다.');
        }
        document.getElementById('selected-member-id').value = booking.member?.id || '';
        document.getElementById('selected-member-number').value = booking.member?.memberNumber || '';
        
        if (booking.member) {
            // 회원 정보 표시
            document.getElementById('member-info-name').textContent = booking.member.name || '-';
            document.getElementById('member-info-phone').textContent = booking.member.phoneNumber || '-';
            document.getElementById('member-info-grade').textContent = getGradeText(booking.member.grade) || '-';
            document.getElementById('member-info-school').textContent = booking.member.school || '-';
            
            document.getElementById('member-info-section').style.display = 'block';
            document.getElementById('non-member-section').style.display = 'none';
            document.getElementById('member-select-section').style.display = 'none';
            
            // 회원의 상품 목록 로드 (비동기로 완료 대기)
            await loadMemberProducts(booking.member.id);
            
            // 코치 목록 로드
            if (document.getElementById('booking-coach') && document.getElementById('booking-coach').options.length <= 1) {
                await loadCoachesForBooking();
            }
            
            // 코치 선택 설정
            const coachSelect = document.getElementById('booking-coach');
            if (coachSelect && booking.coach && booking.coach.id) {
                coachSelect.value = booking.coach.id;
            }
        } else {
            // 비회원 정보 표시
            document.getElementById('booking-non-member-name').value = booking.nonMemberName || '';
            document.getElementById('booking-phone').value = booking.nonMemberPhone || '';
            
            document.getElementById('member-info-section').style.display = 'none';
            document.getElementById('non-member-section').style.display = 'block';
            document.getElementById('member-select-section').style.display = 'none';
            
            // 비회원 코치 목록 로드
            if (document.getElementById('booking-coach-nonmember') && document.getElementById('booking-coach-nonmember').options.length <= 1) {
                await loadCoachesForBookingNonMember();
            }
            
            // 비회원 코치 선택 설정
            const coachSelectNonMember = document.getElementById('booking-coach-nonmember');
            if (coachSelectNonMember && booking.coach && booking.coach.id) {
                coachSelectNonMember.value = booking.coach.id;
            }
        }
        
        const startDate = new Date(booking.startTime);
        document.getElementById('booking-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('booking-start-time').value = startDate.toTimeString().slice(0, 5);
        
        const endDate = new Date(booking.endTime);
        document.getElementById('booking-end-time').value = endDate.toTimeString().slice(0, 5);
        
        document.getElementById('booking-participants').value = booking.participants || 1;
        // 목적을 항상 "대관"으로 고정
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.value = 'RENTAL';
            purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
        }
        // 목적 변경 시 레슨 카테고리 필드 표시/숨김 처리
        toggleLessonCategory();
        // 레슨 카테고리 설정
        if (booking.lessonCategory) {
            const lessonCategoryEl = document.getElementById('booking-lesson-category');
            if (lessonCategoryEl) {
                lessonCategoryEl.value = booking.lessonCategory;
            }
        }
        document.getElementById('booking-status').value = booking.status || 'PENDING';
        document.getElementById('booking-payment-method').value = booking.paymentMethod || '';
        const memoValue = booking.memo || '';
        
        // 메모에서 [복사] 접두사 제거 (UI에만 표시, DB에는 원본 유지)
        let displayMemo = memoValue;
        if (displayMemo) {
            // [복사] 접두사 제거 (여러 개일 수 있음)
            displayMemo = displayMemo.replace(/^\[복사\]\s*/g, '').trim();
        }
        document.getElementById('booking-notes').value = displayMemo;
        
        // 메모에 "[복사]" 접두사가 있으면 복사된 메모로 표시 (복사 기능용)
        if (memoValue && memoValue.startsWith('[복사]')) {
            const copiedContent = memoValue.replace(/^\[복사\]\s*/, '');
            if (copiedContent) {
                copiedMemo = copiedContent;
                localStorage.setItem('copiedMemo', copiedContent);
                showCopiedMemo(copiedContent);
            }
        }
        
        // MemberProduct 정보 설정 (있는 경우)
        // loadMemberProducts가 완료된 후에 설정
        if (booking.memberProduct && booking.memberProduct.id && booking.member) {
            // 회원의 상품 목록이 로드될 때까지 대기
            let attempts = 0;
            const select = document.getElementById('booking-member-product');
            while (select && (select.options.length <= 1 || !Array.from(select.options).some(opt => opt.value === String(booking.memberProduct.id))) && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            // 상품 선택 설정
            if (select) {
                const memberProductOption = Array.from(select.options).find(opt => opt.value === String(booking.memberProduct.id));
                if (memberProductOption) {
                    select.value = booking.memberProduct.id;
                    App.log('[예약 수정] 상품 설정:', booking.memberProduct.id);
                    
                    // 상품 정보 표시 (수정 시: 이 예약 시점 잔여를 API에서 내려준 값 우선 사용)
                    const productInfo = document.getElementById('product-info');
                    const productInfoText = document.getElementById('product-info-text');
                    if (productInfo && productInfoText) {
                        const productType = memberProductOption.dataset.productType;
                        const remainingFromBooking = booking.memberProduct.remainingCount != null && booking.memberProduct.remainingCount !== undefined
                            ? parseInt(booking.memberProduct.remainingCount, 10) : null;
                        const remainingCount = remainingFromBooking !== null ? remainingFromBooking : (parseInt(memberProductOption.dataset.remainingCount) || 0);
                        
                        if (productType === 'COUNT_PASS') {
                            productInfoText.textContent = `횟수권 사용: 잔여 ${remainingCount}회`;
                            productInfo.style.display = 'block';
                        } else {
                            productInfoText.textContent = '상품 사용 예정';
                            productInfo.style.display = 'block';
                        }
                    }
                    
                    // 상품 선택 이벤트 발생 (결제 방식 자동 설정 등)
                    select.dispatchEvent(new Event('change'));
                } else {
                    App.warn('[예약 수정] 상품을 찾을 수 없음:', booking.memberProduct.id);
                }
            }
        }
        
        // 코치 선택 필드 설정 (비회원 예약 시에도 사용)
        if (document.getElementById('booking-coach')) {
            document.getElementById('booking-coach').value = booking.coach?.id || '';
        }
    } catch (error) {
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

function editBooking(id) {
    // 빠른 예약 모달로 수정
    openQuickBookingModalForEdit(id);
}

async function saveBooking() {
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start-time').value;
    const endTime = document.getElementById('booking-end-time').value;
    
    // 날짜 검증
    if (!date || date.trim() === '') {
        App.warn('[saveBooking] 날짜가 없음');
        App.showNotification('날짜를 선택해주세요.', 'danger');
        return;
    }
    
    // 시작 시간 검증
    if (!startTime || startTime.trim() === '') {
        App.warn('[saveBooking] 시작 시간이 없음');
        App.showNotification('시작 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 종료 시간 검증
    if (!endTime || endTime.trim() === '') {
        App.warn('[saveBooking] 종료 시간이 없음');
        App.showNotification('종료 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 시작 시간과 종료 시간 비교
    if (startTime && endTime && startTime >= endTime) {
        App.showNotification('종료 시간은 시작 시간보다 늦어야 합니다.', 'danger');
        return;
    }
    const facilityId = document.getElementById('booking-facility').value;
    const memberNumber = document.getElementById('selected-member-number').value; // MEMBER_NUMBER 사용
    const memberId = document.getElementById('selected-member-id').value; // 하위 호환성
    
    // 대관 페이지용: 예약자 정보 (우선순위: renterName > nonMemberName)
    const renterName = document.getElementById('booking-renter-name')?.value?.trim() || '';
    const renterPhone = document.getElementById('booking-renter-phone')?.value?.trim() || '';
    const nonMemberName = renterName || document.getElementById('booking-non-member-name')?.value?.trim() || '';
    const nonMemberPhone = renterPhone || document.getElementById('booking-phone')?.value?.trim() || '';
    const coachIdElement = document.getElementById('booking-coach');
    const coachId = coachIdElement ? coachIdElement.value : '';
    const participants = document.getElementById('booking-participants').value;
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryElement = document.getElementById('booking-lesson-category');
    const lessonCategory = lessonCategoryElement ? lessonCategoryElement.value : null;
    const paymentMethod = document.getElementById('booking-payment-method').value;
    const memo = document.getElementById('booking-notes').value.trim();
    const memberProductId = document.getElementById('booking-member-product')?.value || null;
    
    // 필수 필드 검증
    if (!date || !startTime || !endTime || !facilityId) {
        App.showNotification('필수 항목(날짜, 시간, 시설)을 모두 입력해주세요.', 'danger');
        return;
    }
    
    if (!purpose) {
        App.showNotification('목적을 선택해주세요.', 'danger');
        return;
    }
    
    // 레슨인 경우 레슨 카테고리 필수
    if (purpose === 'LESSON') {
        const lessonCategory = document.getElementById('booking-lesson-category')?.value;
        if (!lessonCategory) {
            App.showNotification('레슨인 경우 레슨 종목을 선택해주세요.', 'danger');
            return;
        }
    }
    
    // 대관 페이지용: 예약자 정보 검증
    // 대관은 예약자 이름 필수 (회원이 선택되지 않은 경우)
    if (!memberNumber && !memberId && !nonMemberName) {
        App.showNotification('예약자 이름을 입력해주세요.', 'danger');
        return;
    }
    
    // 회원 예약인 경우 상품/이용권 선택 필수
    if ((memberNumber || memberId) && !memberProductId) {
        App.showNotification('사용할 상품/이용권을 선택해주세요.', 'danger');
        return;
    }
    
    // 상품 선택 시 횟수권 잔여 횟수 확인
    if (memberProductId) {
        const productSelect = document.getElementById('booking-member-product');
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        const productType = selectedOption.dataset.productType;
        const remainingCount = parseInt(selectedOption.dataset.remainingCount) || 0;
        
        if (productType === 'COUNT_PASS' && remainingCount <= 0) {
            App.showNotification('선택한 횟수권의 잔여 횟수가 없습니다.', 'danger');
            return;
        }
    }
    
    // 날짜와 시간 결합 (ISO 8601 형식)
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;
    
    // 디버깅: 시간 값 확인
    App.log('예약 시간 확인:', {
        date: date,
        startTime: startTime,
        endTime: endTime,
        startDateTime: startDateTime,
        endDateTime: endDateTime
    });
    
    // 회원 예약은 항상 PENDING 상태로 시작 (확인 후 CONFIRMED로 변경)
    const statusSelect = document.getElementById('booking-status');
    const bookingIdElement = document.getElementById('booking-id');
    const bookingId = bookingIdElement ? bookingIdElement.value.trim() : '';
    
    // 새 예약인지 확인 (bookingId가 없거나 빈 문자열이면 새 예약)
    const isNewBooking = !bookingId || bookingId === '';
    
    let bookingStatus = 'PENDING';
    
    // 수정 모드인 경우에만 기존 상태 유지, 새 예약은 항상 PENDING
    if (!isNewBooking && statusSelect && statusSelect.value) {
        // 수정 모드: 기존 상태 유지
        bookingStatus = statusSelect.value;
        App.log('[예약 저장] 수정 모드 - 상태 유지:', bookingStatus);
    } else {
        // 새 예약: 항상 PENDING으로 설정
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        App.log('[예약 저장] 새 예약 - 상태 PENDING으로 설정');
    }
    
    // 최종 상태 확인 및 강제 설정 (새 예약인 경우)
    if (isNewBooking) {
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        App.log('[예약 저장] 최종 확인 - 새 예약이므로 PENDING으로 강제 설정');
    }
    
    // 추가 안전장치: statusSelect의 실제 값을 다시 확인
    if (statusSelect && statusSelect.value !== bookingStatus) {
        App.warn('[예약 저장] 상태 불일치 감지! statusSelect.value:', statusSelect.value, 'bookingStatus:', bookingStatus);
        bookingStatus = 'PENDING'; // 새 예약은 무조건 PENDING
        statusSelect.value = 'PENDING';
    }
    
    App.log('[예약 저장] 최종 상태:', {
        bookingId: bookingId,
        isNewBooking: isNewBooking,
        bookingStatus: bookingStatus,
        statusSelectValue: statusSelect ? statusSelect.value : 'N/A'
    });
    
    const data = {
        facility: { id: parseInt(facilityId) },
        memberNumber: memberNumber || null, // MEMBER_NUMBER 사용
        member: memberId ? { id: parseInt(memberId) } : null, // 하위 호환성
        nonMemberName: (memberNumber || memberId) ? null : (nonMemberName || null),
        nonMemberPhone: (memberNumber || memberId) ? null : (nonMemberPhone || null),
        coach: coachId ? { id: parseInt(coachId) } : null,
        memberProductId: memberProductId ? parseInt(memberProductId) : null, // 상품/이용권 ID
        startTime: startDateTime,
        endTime: endDateTime,
        participants: parseInt(participants) || 1,
        purpose: purpose,
        lessonCategory: (purpose === 'LESSON' && lessonCategory) ? lessonCategory : null,
        status: bookingStatus, // 새 예약은 항상 PENDING
        branch: 'RENTAL', // 대관 관리 전용 지점 코드
        // paymentMethod 값 변환 (프론트엔드 -> 백엔드 enum 형식)
        paymentMethod: paymentMethod ? (paymentMethod === 'ONSITE' ? 'ON_SITE' : (paymentMethod === 'DEFERRED' ? 'POSTPAID' : paymentMethod)) : null,
        memo: memo ? memo.trim() : null // 빈 문자열도 null로 변환하여 명시적으로 삭제
    };
    
    App.log('예약 저장 데이터:', JSON.stringify(data, null, 2));
    
    try {
        const id = document.getElementById('booking-id').value;
        let savedBooking;
        if (id) {
            savedBooking = await App.api.put(`/bookings/${id}`, data);
            App.showNotification('대관이 수정되었습니다.', 'success');
        } else {
            savedBooking = await App.api.post('/bookings', data);
            App.log('예약 저장 성공:', savedBooking);
            
            // 반복 예약 처리
            const repeatEnabled = document.getElementById('booking-repeat-enabled').checked;
            if (repeatEnabled) {
                const repeatType = document.getElementById('booking-repeat-type').value;
                const repeatCount = parseInt(document.getElementById('booking-repeat-count').value) || 1;
                
                await createRepeatBookings(data, repeatType, repeatCount);
                App.showNotification(`대관이 등록되었습니다 (반복 ${repeatCount}회 포함).`, 'success');
            } else {
                App.showNotification('대관이 등록되었습니다.', 'success');
            }
        }
        
        App.Modal.close('booking-modal');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            // 캘린더 뷰인 경우 예약 날짜로 이동 후 새로고침
            if (savedBooking && savedBooking.startTime) {
                try {
                    const bookingDate = new Date(savedBooking.startTime);
                    const bookingYear = bookingDate.getFullYear();
                    const bookingMonth = bookingDate.getMonth();
                    
                    // 예약이 있는 월로 캘린더 이동
                    if (currentDate.getFullYear() !== bookingYear || currentDate.getMonth() !== bookingMonth) {
                        currentDate = new Date(bookingYear, bookingMonth, 1);
                        App.log(`예약 날짜로 캘린더 이동: ${bookingYear}년 ${bookingMonth + 1}월`);
                    }
                } catch (e) {
                    App.err('예약 날짜 파싱 오류:', savedBooking.startTime, e);
                }
            }
            App.log('캘린더 새로고침 시작...');
            await renderCalendar();
        }
    } catch (error) {
        App.err('예약 저장 실패:', error);
        App.showNotification('저장에 실패했습니다. 필수 정보를 확인해주세요.', 'danger');
    }
}

// 반복 예약 생성
async function createRepeatBookings(baseData, repeatType, repeatCount) {
    const baseDate = new Date(baseData.startTime);
    const startTime = baseData.startTime.split('T')[1];
    const endTime = baseData.endTime.split('T')[1];
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 1; i < repeatCount; i++) {
        const newDate = new Date(baseDate);
        
        // 반복 주기에 따라 날짜 계산
        switch (repeatType) {
            case 'DAILY':
                newDate.setDate(newDate.getDate() + i);
                break;
            case 'WEEKLY':
                newDate.setDate(newDate.getDate() + (i * 7));
                break;
            case 'MONTHLY':
                newDate.setMonth(newDate.getMonth() + i);
                break;
        }
        
        const dateStr = newDate.toISOString().split('T')[0];
        const repeatData = {
            ...baseData,
            startTime: `${dateStr}T${startTime}`,
            endTime: `${dateStr}T${endTime}`,
            status: 'PENDING' // 반복 예약도 새 예약이므로 대기 상태로 시작
        };
        
        try {
            await App.api.post('/bookings', repeatData);
            successCount++;
        } catch (error) {
            App.err(`반복 예약 생성 실패 (${i}회차):`, error);
            failCount++;
        }
    }
    
    App.log(`반복 예약 생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

// 예약 확인 (승인) - 대관 예약을 CONFIRMED 상태로 변경
async function approveBooking(id) {
    if (!confirm('이 대관 예약을 확인하시겠습니까?\n\n확인 후 체크인 미처리 현황에 표시됩니다.')) {
        return;
    }
    
    try {
        // 먼저 예약 정보를 가져온 후 status만 변경
        const booking = await App.api.get(`/bookings/${id}`);
        
        // 상태만 업데이트 (기존 데이터 유지)
        const updateData = {
            ...booking,
            status: 'CONFIRMED'
        };
        
        // 객체 참조 제거 (순환 참조 방지)
        if (updateData.facility) {
            updateData.facility = { id: updateData.facility.id };
        }
        if (updateData.member) {
            updateData.member = updateData.member.id ? { id: updateData.member.id } : null;
        }
        if (updateData.coach) {
            updateData.coach = updateData.coach.id ? { id: updateData.coach.id } : null;
        }
        // 컬렉션 필드 제거
        delete updateData.payments;
        delete updateData.attendances;
        
        await App.api.put(`/bookings/${id}`, updateData);
        App.showNotification('대관 예약이 확인되었습니다. 체크인 미처리 현황에 표시됩니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
            // 날짜별 스케줄 모달이 열려있으면 새로고침
            const dayScheduleModal = document.getElementById('day-schedule-modal');
            if (dayScheduleModal && dayScheduleModal.style.display !== 'none') {
                const dateStr = document.getElementById('day-schedule-modal-title')?.textContent;
                if (dateStr) {
                    // 날짜 추출하여 다시 로드
                    const dateMatch = dateStr.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
                    if (dateMatch) {
                        const year = dateMatch[1];
                        const month = String(dateMatch[2]).padStart(2, '0');
                        const day = String(dateMatch[3]).padStart(2, '0');
                        const dateStrForReload = `${year}-${month}-${day}`;
                        await openDayScheduleModal(dateStrForReload);
                    }
                }
            }
        }
    } catch (error) {
        App.err('예약 확인 실패:', error);
        App.showNotification('확인에 실패했습니다.', 'danger');
    }
}

// 예약 모달에서 삭제
async function deleteBookingFromModal() {
    const deleteBtn = document.getElementById('booking-delete-btn');
    const bookingId = deleteBtn.getAttribute('data-booking-id');
    if (!bookingId) {
        App.showNotification('삭제할 예약을 찾을 수 없습니다.', 'danger');
        return;
    }
    
    if (confirm('정말 이 예약을 삭제하시겠습니까?')) {
        await deleteBooking(parseInt(bookingId));
        // 삭제 후 모달 닫기
        App.Modal.close('booking-modal');
    }
}

async function deleteBooking(id) {
    try {
        await App.api.delete(`/bookings/${id}`);
        App.showNotification('예약이 삭제되었습니다.', 'success');
        
        // 캘린더 뷰인 경우 캘린더 새로고침, 리스트 뷰인 경우 리스트 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        App.err('예약 삭제 실패:', error);
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

// 빠른 예약 모달에서 삭제
async function deleteQuickBooking() {
    const quickBookingId = document.getElementById('quick-booking-id')?.value;
    if (!quickBookingId || quickBookingId.trim() === '') {
        App.showNotification('삭제할 예약을 찾을 수 없습니다.', 'danger');
        return;
    }
    
    if (confirm('정말 이 예약을 삭제하시겠습니까?')) {
        await deleteBooking(parseInt(quickBookingId));
        // 삭제 후 모달 닫기
        App.Modal.close('quick-booking-modal');
    }
}

// 예약을 다른 날짜로 복사 (common.js의 window.copyBookingToDate 사용. 이 함수명을 copyBookingToDate로 쓰면 전역을 덮어써 재귀 발생)
async function copyBookingToDateAndRefresh(sourceBookingId, sourceBooking, targetDateStr) {
    const doCopy = window.copyBookingToDate;
    if (typeof doCopy !== 'function') {
        App.err('예약 복사: window.copyBookingToDate를 찾을 수 없습니다.');
        return;
    }
    await doCopy(sourceBookingId, sourceBooking, targetDateStr, 'RENTAL', async () => {
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    });
}

// 복사된 메모 저장 (localStorage)
let copiedMemo = null;

// 메모를 클립보드에 복사
function copyMemoToClipboard() {
    const memoTextarea = document.getElementById('booking-notes');
    if (!memoTextarea) return;
    
    const memoText = memoTextarea.value.trim();
    if (!memoText) {
        App.showNotification('복사할 메모가 없습니다.', 'warning');
        return;
    }
    
    // 클립보드에 복사
    navigator.clipboard.writeText(memoText).then(() => {
        // 복사된 메모 저장
        copiedMemo = memoText;
        localStorage.setItem('copiedMemo', memoText);
        
        // 복사된 메모 표시
        showCopiedMemo(memoText);
        
        App.showNotification('메모가 클립보드에 복사되었습니다.', 'success');
    }).catch(err => {
        App.err('클립보드 복사 실패:', err);
        // 폴백: 수동 복사
        memoTextarea.select();
        document.execCommand('copy');
        copiedMemo = memoText;
        localStorage.setItem('copiedMemo', memoText);
        showCopiedMemo(memoText);
        App.showNotification('메모가 복사되었습니다.', 'success');
    });
}

// 복사된 메모 표시
function showCopiedMemo(memoText) {
    const displayDiv = document.getElementById('copied-memo-display');
    const contentDiv = document.getElementById('copied-memo-content');
    
    if (displayDiv && contentDiv) {
        contentDiv.textContent = memoText;
        displayDiv.style.display = 'block';
    }
}

// 복사된 메모 붙여넣기
function pasteCopiedMemo() {
    const memoTextarea = document.getElementById('booking-notes');
    if (!memoTextarea) return;
    
    if (!copiedMemo) {
        // localStorage에서 가져오기
        copiedMemo = localStorage.getItem('copiedMemo');
    }
    
    if (!copiedMemo) {
        App.showNotification('붙여넣을 메모가 없습니다.', 'warning');
        return;
    }
    
    // 현재 커서 위치에 붙여넣기
    const start = memoTextarea.selectionStart;
    const end = memoTextarea.selectionEnd;
    const currentText = memoTextarea.value;
    const newText = currentText.substring(0, start) + copiedMemo + currentText.substring(end);
    
    memoTextarea.value = newText;
    memoTextarea.focus();
    memoTextarea.setSelectionRange(start + copiedMemo.length, start + copiedMemo.length);
    
    App.showNotification('메모가 붙여넣어졌습니다.', 'success');
}

// 복사된 메모 삭제
function clearCopiedMemo() {
    copiedMemo = null;
    localStorage.removeItem('copiedMemo');
    
    const displayDiv = document.getElementById('copied-memo-display');
    if (displayDiv) {
        displayDiv.style.display = 'none';
    }
    
    App.showNotification('복사된 메모가 삭제되었습니다.', 'info');
}

// 메모 템플릿 관리 모달 열기
function openMemoTemplates() {
    // 간단한 템플릿 관리 (localStorage 사용)
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    
    let templateList = '';
    if (templates.length > 0) {
        templateList = templates.map((template, index) => {
            const escapedContent = (template.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `
            <div style="padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 8px;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${(template.name || '템플릿 ' + (index + 1)).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div style="font-size: 13px; color: var(--text-primary); white-space: pre-wrap; margin-bottom: 4px; max-height: 100px; overflow-y: auto;">${escapedContent}</div>
                <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="useMemoTemplate(${index})" style="padding: 2px 8px; font-size: 11px;">사용</button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="deleteMemoTemplate(${index})" style="padding: 2px 8px; font-size: 11px;">삭제</button>
                </div>
            </div>
        `;
        }).join('');
    } else {
        templateList = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">저장된 템플릿이 없습니다.</div>';
    }
    
    const modalContent = `
        <div>
            <div style="margin-bottom: 16px;">
                <div class="form-group">
                    <label class="form-label">템플릿 이름</label>
                    <input type="text" class="form-control" id="template-name" placeholder="예: 배팅 연습">
                </div>
                <div class="form-group">
                    <label class="form-label">템플릿 내용</label>
                    <textarea class="form-control" id="template-content" rows="3" placeholder="메모 내용을 입력하세요"></textarea>
                </div>
                <button type="button" class="btn btn-primary" onclick="saveMemoTemplate()">템플릿 저장</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto; border-top: 1px solid var(--border-color); padding-top: 16px;">
                <h4 style="margin-bottom: 12px; font-size: 14px; font-weight: 600;">저장된 템플릿 (${templates.length}개)</h4>
                ${templateList}
            </div>
        </div>
    `;
    
    // 모달 body에 내용 채우기
    const modalBody = document.getElementById('memo-templates-modal-body');
    if (modalBody) {
        modalBody.innerHTML = modalContent;
    }
    
    App.Modal.open('memo-templates-modal');
}

// 메모 템플릿 저장
function saveMemoTemplate() {
    const name = document.getElementById('template-name').value.trim();
    const content = document.getElementById('template-content').value.trim();
    
    if (!name || !content) {
        App.showNotification('템플릿 이름과 내용을 모두 입력해주세요.', 'warning');
        return;
    }
    
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    templates.push({ name, content, createdAt: new Date().toISOString() });
    localStorage.setItem('memoTemplates', JSON.stringify(templates));
    
    App.showNotification('템플릿이 저장되었습니다.', 'success');
    openMemoTemplates(); // 목록 새로고침
}

// 메모 템플릿 사용
function useMemoTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    if (index >= 0 && index < templates.length) {
        const template = templates[index];
        const memoTextarea = document.getElementById('booking-notes');
        if (memoTextarea) {
            memoTextarea.value = template.content;
            App.Modal.close('memo-templates-modal');
            App.showNotification('템플릿이 적용되었습니다.', 'success');
        }
    }
}

// 메모 템플릿 삭제
function deleteMemoTemplate(index) {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    if (index >= 0 && index < templates.length) {
        templates.splice(index, 1);
        localStorage.setItem('memoTemplates', JSON.stringify(templates));
        App.showNotification('템플릿이 삭제되었습니다.', 'success');
        openMemoTemplates(); // 목록 새로고침
    }
}

// 페이지 로드 시 복사된 메모 복원
document.addEventListener('DOMContentLoaded', function() {
    const savedMemo = localStorage.getItem('copiedMemo');
    if (savedMemo) {
        copiedMemo = savedMemo;
        // 모달이 열릴 때 복사된 메모 표시
        const observer = new MutationObserver((mutations) => {
            const displayDiv = document.getElementById('copied-memo-display');
            if (displayDiv && savedMemo) {
                showCopiedMemo(savedMemo);
            }
        });
        
        const modal = document.getElementById('booking-modal');
        if (modal) {
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        }
    }
});

// 예약 번호를 날짜/시간 기준으로 재할당 (조용히, 알림 없이)
async function reorderBookingIdsSilent() {
    try {
        await App.api.post('/bookings/reorder');
        // 알림 없이 조용히 재정렬
    } catch (error) {
        App.err('예약 번호 재할당 실패:', error);
        // 조용히 실패 (사용자에게 알림하지 않음)
    }
}

// 예약 번호를 날짜/시간 기준으로 재할당 (수동 호출용, 현재는 사용하지 않음)
async function reorderBookingIds() {
    if (!confirm('예약 번호를 날짜/시간 순서대로 재할당하시겠습니까?\n\n주의: 이 작업은 모든 예약의 번호를 변경합니다.')) {
        return;
    }
    
    try {
        const response = await App.api.post('/bookings/reorder');
        App.showNotification('예약 번호가 날짜/시간 순서대로 재할당되었습니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        App.err('예약 번호 재할당 실패:', error);
        App.showNotification('예약 번호 재할당에 실패했습니다.', 'danger');
    }
}

function applyFilters() {
    // 적용 버튼을 누르면 지점 클릭 필터는 해제하고, 시설/날짜/상태만 적용
    window.rentalsFilterBranch = null;
    if (window.lastRentalStatsData) renderRentalStats(window.lastRentalStatsData);
    loadCoachLegend();
    if (currentView === 'list') {
        loadBookingsList();
    } else {
        renderCalendar();
    }
    loadRentalStats();
}

// 예약 선택 기능
function selectBooking(booking, eventElement) {
    // 이전 선택 해제
    if (selectedBooking && selectedBooking.element) {
        selectedBooking.element.style.outline = '';
        selectedBooking.element.style.boxShadow = '';
    }
    
    // 같은 예약을 다시 클릭하면 선택 해제
    if (selectedBooking && selectedBooking.id === booking.id) {
        selectedBooking = null;
        App.log('예약 선택 해제됨');
        return;
    }
    
    // 새로운 예약 선택
    selectedBooking = {
        id: booking.id,
        booking: booking,
        element: eventElement
    };
    
    // 선택된 예약 스타일 변경
    eventElement.style.outline = '3px solid #FFD700';
    eventElement.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
    
    App.log('예약 선택됨:', booking.id, booking);
    App.showNotification('예약이 선택되었습니다. Delete 키를 눌러 삭제할 수 있습니다.', 'info');
}

// 선택된 예약 삭제
async function deleteSelectedBooking() {
    if (!selectedBooking) {
        App.log('선택된 예약이 없습니다.');
        return;
    }
    
    const booking = selectedBooking.booking;
    const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
    const startTime = new Date(booking.startTime);
    const timeStr = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')} ${startTime.getHours()}:${String(startTime.getMinutes()).padStart(2, '0')}`;
    
    if (!confirm(`예약을 삭제하시겠습니까?\n\n회원: ${memberName}\n시간: ${timeStr}`)) {
        return;
    }
    
    try {
        await deleteBooking(selectedBooking.id);
        
        // 선택 해제
        selectedBooking = null;
        
        App.showNotification('예약이 삭제되었습니다.', 'success');
        
        // 캘린더 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        App.err('예약 삭제 실패:', error);
        App.showNotification('예약 삭제에 실패했습니다.', 'danger');
    }
}
