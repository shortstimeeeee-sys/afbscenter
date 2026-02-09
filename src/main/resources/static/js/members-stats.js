/**
 * 회원 기본 통계 (로드·카드 렌더·통계 클릭 모달).
 * members.js 로드 후 로드. getGradeText() 는 members.js 에 의존.
 */

async function loadMemberStats() {
    const container = document.getElementById('members-stats-container');
    if (!container) return;
    const STATS_TIMEOUT_MS = 15000;
    try {
        const statsPromise = App.api.get('/members/stats');
        const timeoutPromise = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('TIMEOUT')); }, STATS_TIMEOUT_MS);
        });
        const stats = await Promise.race([statsPromise, timeoutPromise]);
        if (!stats || typeof stats !== 'object') {
            container.innerHTML = '<p class="members-stats-loading">통계를 불러올 수 없습니다.</p><button type="button" class="btn btn-secondary" style="margin-top:8px;" onclick="loadMemberStats()">다시 시도</button>';
            return;
        }
        renderMembersStatsCard(stats);
    } catch (error) {
        App.err('회원 통계 로드 실패:', error);
        var msg = '통계를 불러오는데 실패했습니다.';
        if (error && error.message === 'TIMEOUT') {
            msg = '요청 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.';
        }
        container.innerHTML = '<p class="members-stats-loading">' + App.escapeHtml(msg) + '</p><button type="button" class="btn btn-secondary" style="margin-top:8px;" onclick="loadMemberStats()">다시 시도</button>';
    }
}

function renderMembersStatsCard(stats) {
    const container = document.getElementById('members-stats-container');
    if (!container) return;
    const total = Number(stats.total) || 0;
    const activeCount = Number(stats.activeCount) || 0;
    const byGrade = stats.byGrade || {};
    const byStatus = stats.byStatus || {};
    const gradeLabels = {
        SOCIAL: '사회인',
        ELITE_ELEMENTARY: '엘리트 (초)',
        ELITE_MIDDLE: '엘리트 (중)',
        ELITE_HIGH: '엘리트 (고)',
        YOUTH: '유소년',
        OTHER: '기타 종목'
    };
    const statusLabels = {
        ACTIVE: '활성',
        INACTIVE: '휴면',
        WITHDRAWN: '탈퇴'
    };
    const gradeOrder = ['SOCIAL', 'ELITE_ELEMENTARY', 'ELITE_MIDDLE', 'ELITE_HIGH', 'YOUTH', 'OTHER'];
    const statusOrder = ['INACTIVE', 'WITHDRAWN'];
    const inactiveCount = Number(byStatus.INACTIVE) || 0;
    const nonMemberCount = Number(stats.nonMemberCount) || 0;
    const gradeItems = gradeOrder.filter(k => (byGrade[k] || 0) > 0).map(k => ({
        label: gradeLabels[k] || k,
        count: byGrade[k],
        gradeKey: k,
        filterType: 'grade',
        filterValue: k
    }));
    const statusItems = statusOrder.filter(k => (byStatus[k] || 0) > 0).map(k => ({
        label: statusLabels[k] || k,
        count: byStatus[k],
        filterType: 'status',
        filterValue: k
    }));
    const items = [
        { label: '총 회원 수', value: total + '명', accent: true, gradeClass: '', isTotal: true, filterType: 'all', filterValue: null },
        { label: '활성', value: activeCount + '명', accent: false, gradeClass: 'members-stats-item--active', isTotal: false, filterType: 'status', filterValue: 'ACTIVE' },
        { label: '휴면', value: inactiveCount + '명', accent: false, gradeClass: 'members-stats-item--inactive', isTotal: false, filterType: 'status', filterValue: 'INACTIVE' }
    ].concat(
        gradeItems.map(c => ({ label: c.label, value: c.count + '명', accent: false, gradeClass: 'members-stats-item--' + (c.gradeKey ? c.gradeKey.toLowerCase() : ''), filterType: 'grade', filterValue: c.gradeKey })),
        statusItems.filter(s => s.label !== '휴면').map(c => ({ label: c.label, value: c.count + '명', accent: false, gradeClass: '', filterType: 'status', filterValue: c.filterValue })),
        [{ label: '비회원', value: nonMemberCount + '건', accent: false, gradeClass: 'members-stats-item--nonmember', isTotal: false, filterType: 'nonMember', filterValue: 'nonMember' }]
    ).flat();
    container.innerHTML = items.map(item => `
        <div class="members-stats-item members-stats-item-clickable ${item.gradeClass || ''}${item.isTotal ? ' stats-total-item' : ''}"
             data-filter-type="${App.escapeHtml(item.filterType || '')}"
             data-filter-value="${App.escapeHtml(item.filterValue != null ? item.filterValue : '')}"
             data-label="${App.escapeHtml(item.label || '')}"
             title="클릭하면 목록 보기">
            <div class="members-stats-item-label">${App.escapeHtml(item.label)}</div>
            <div class="members-stats-item-value${item.accent ? ' accent' : ''}">${App.escapeHtml(item.value)}</div>
        </div>
    `).join('');
    container.querySelectorAll('.members-stats-item-clickable').forEach(function(el) {
        el.addEventListener('click', function() {
            var type = el.getAttribute('data-filter-type');
            var value = el.getAttribute('data-filter-value');
            var label = el.getAttribute('data-label');
            openStatsMemberModal(type, value, label);
        });
    });
}

async function openStatsMemberModal(filterType, filterValue, titleLabel) {
    var modal = document.getElementById('stats-members-modal');
    var titleEl = document.getElementById('stats-members-modal-title');
    var bodyEl = document.getElementById('stats-members-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = (titleLabel || '회원') + ' 목록';
    bodyEl.innerHTML = '<p class="members-stats-loading">로딩 중...</p>';
    App.Modal.open('stats-members-modal');

    if (filterType === 'nonMember') {
        try {
            var list = await App.api.get('/bookings/non-members');
            var bookings = Array.isArray(list) ? list : [];
            if (bookings.length === 0) {
                bodyEl.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">비회원 예약이 없습니다.</p>';
                return;
            }
            var statusLabels = { 'PENDING': '대기', 'CONFIRMED': '확정', 'CANCELLED': '취소' };
            var tableHtml = '<div class="table-container" style="max-height: 60vh; overflow: auto;"><table class="table"><thead><tr><th>예약일시</th><th>이름</th><th>연락처</th><th>시설</th><th>상태</th></tr></thead><tbody>';
            bookings.forEach(function(b) {
                var start = '-';
                if (b.startTime) {
                    var raw = typeof b.startTime === 'string' ? b.startTime : '';
                    if (raw.length >= 16) {
                        var datePart = raw.substring(0, 10).replace(/-/g, '. ');
                        var timePart = raw.substring(11, 16);
                        start = datePart + '. ' + timePart;
                    } else if (raw.length > 0) {
                        start = raw.substring(0, 16);
                    }
                }
                var name = (b.nonMemberName || '-');
                var phone = (b.nonMemberPhone || '-');
                var facilityName = (b.facility && b.facility.name) ? b.facility.name : '-';
                var statusKey = (b.status || '').toUpperCase();
                var status = statusLabels[statusKey] || b.status || '-';
                tableHtml += '<tr><td>' + App.escapeHtml(start) + '</td><td>' + App.escapeHtml(name) + '</td><td>' + App.escapeHtml(phone) + '</td><td>' + App.escapeHtml(facilityName) + '</td><td>' + App.escapeHtml(status) + '</td></tr>';
            });
            tableHtml += '</tbody></table></div>';
            bodyEl.innerHTML = tableHtml;
        } catch (err) {
            App.err('비회원 예약 목록 로드 실패:', err);
            bodyEl.innerHTML = '<p style="color: var(--danger); padding: 16px;">목록을 불러오는데 실패했습니다.</p>';
        }
        return;
    }

    var params = new URLSearchParams();
    if (filterType === 'status' && filterValue) params.set('status', filterValue);
    if (filterType === 'grade' && filterValue) params.set('grade', filterValue);
    try {
        var list = await App.api.get('/members?' + params.toString());
        var members = Array.isArray(list) ? list : (list && list.content ? list.content : []);
        if (members.length === 0) {
            bodyEl.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">해당 조건의 회원이 없습니다.</p>';
            return;
        }
        var tableHtml = '<div class="table-container" style="max-height: 60vh; overflow: auto;"><table class="table"><thead><tr><th>회원번호</th><th>이름</th><th>등급</th><th>전화번호</th><th>학교/소속</th></tr></thead><tbody>';
        members.forEach(function(m) {
            tableHtml += '<tr onclick="App.Modal.close(\'stats-members-modal\'); window.location.href=\'/members.html?id=' + (m.id || '') + '\'"><td>' + App.escapeHtml(m.memberNumber || '-') + '</td><td>' + App.escapeHtml(m.name || '') + '</td><td>' + App.escapeHtml(typeof getGradeText === 'function' ? getGradeText(m.grade) : (m.grade || '-')) + '</td><td>' + App.escapeHtml(m.phoneNumber || '-') + '</td><td>' + App.escapeHtml(m.school || '-') + '</td></tr>';
        });
        tableHtml += '</tbody></table></div>';
        bodyEl.innerHTML = tableHtml;
    } catch (err) {
        App.err('통계 회원 목록 로드 실패:', err);
        bodyEl.innerHTML = '<p style="color: var(--danger); padding: 16px;">목록을 불러오는데 실패했습니다.</p>';
    }
}
