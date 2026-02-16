/**
 * 회원 기본 통계 (로드·카드 렌더·통계 클릭 모달).
 * members.js 로드 후 로드. getGradeText(), getGradeBadge() 는 members.js 에 의존.
 * 등급/코치/상태는 공통 배지·색상 디자인 적용.
 */
// 등급 배지 클래스 (members.js getGradeBadge / dashboard getGradeBadgeClass와 동일)
function getGradeBadgeClass(grade) {
    if (!grade) return 'info';
    var g = String(grade).toUpperCase();
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
function getGradeLabel(grade) {
    if (typeof getGradeText === 'function') return getGradeText(grade) || '-';
    var map = { ELITE_ELEMENTARY: '엘리트 (초)', ELITE_MIDDLE: '엘리트 (중)', ELITE_HIGH: '엘리트 (고)', SOCIAL: '사회인', YOUTH: '유소년', OTHER: '기타 종목' };
    return map[String(grade).toUpperCase()] || grade || '-';
}
// 회원 상태 배지/텍스트 (App.Status.member)
function getMemberStatusBadge(s) {
    return (App.Status && App.Status.member && App.Status.member.getBadge) ? App.Status.member.getBadge(s) : 'info';
}
function getMemberStatusText(s) {
    return (App.Status && App.Status.member && App.Status.member.getText) ? App.Status.member.getText(s) : (s || '-');
}
// 담당 코치 한 줄 표시 (공통 코치 색상)
function renderCoachDisplay(member) {
    var name = (member.coach && member.coach.name) ? member.coach.name : (member.coachNames || '').split('\n')[0];
    if (!name || !String(name).trim()) return '-';
    return renderCoachNameWithColor(String(name).trim());
}
// 코치 이름 문자열에 공통 색상 적용 (회원/비회원 목록 공용)
function renderCoachNameWithColor(coachName) {
    if (!coachName || !String(coachName).trim()) return '-';
    var name = String(coachName).trim();
    var color = (App.CoachColors && App.CoachColors.getColor) ? App.CoachColors.getColor({ name: name }) : null;
    if (!color) color = 'var(--text-primary)';
    return '<span class="coach-name" style="color:' + color + ';font-weight:600;">' + App.escapeHtml(name) + '</span>';
}

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
            var statusBadge = function(s) { return (App.Status && App.Status.booking && App.Status.booking.getBadge) ? App.Status.booking.getBadge(s) : 'info'; };
            var statusText = function(s) { return (App.Status && App.Status.booking && App.Status.booking.getText) ? App.Status.booking.getText(s) : s; };
            var tableHtml = '<div class="table-container" style="max-height: 60vh; overflow: auto;"><table class="table table-booking-list"><thead><tr><th>예약일시</th><th>이름</th><th>연락처</th><th>시설</th><th>담당 코치</th><th>상태</th></tr></thead><tbody>';
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
                var coachName = (b.coach && b.coach.name) ? b.coach.name : (b.coachName || '');
                var coachHtml = coachName ? renderCoachNameWithColor(coachName) : '-';
                var statusKey = (b.status || '').toUpperCase();
                var badge = statusBadge(statusKey);
                var statusLabel = statusText(statusKey);
                tableHtml += '<tr><td>' + App.escapeHtml(start) + '</td><td>' + App.escapeHtml(name) + '</td><td>' + App.escapeHtml(phone) + '</td><td class="cell-facility">' + App.escapeHtml(facilityName) + '</td><td class="cell-coach">' + coachHtml + '</td><td class="cell-status"><span class="badge badge-' + App.escapeHtml(badge) + '">' + App.escapeHtml(statusLabel) + '</span></td></tr>';
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
        var tableHtml = '<div class="table-container" style="max-height: 60vh; overflow: auto;"><table class="table table-booking-list"><thead><tr><th>회원번호</th><th>이름</th><th>등급</th><th>담당 코치</th><th>전화번호</th><th>학교/소속</th><th>상태</th></tr></thead><tbody>';
        members.forEach(function(m) {
            var gradeClass = getGradeBadgeClass(m.grade);
            var gradeLabel = getGradeLabel(m.grade);
            var gradeBadge = '<span class="badge badge-' + gradeClass + '">' + App.escapeHtml(gradeLabel) + '</span>';
            var statusKey = (m.status || 'ACTIVE').toUpperCase();
            var statusBadge = '<span class="badge badge-' + getMemberStatusBadge(statusKey) + '">' + App.escapeHtml(getMemberStatusText(statusKey)) + '</span>';
            var coachHtml = renderCoachDisplay(m);
            tableHtml += '<tr class="stats-member-row" onclick="App.Modal.close(\'stats-members-modal\'); window.location.href=\'/members.html?id=' + (m.id || '') + '\'" style="cursor:pointer;"><td>' + App.escapeHtml(m.memberNumber || '-') + '</td><td>' + App.escapeHtml(m.name || '') + '</td><td class="cell-grade">' + gradeBadge + '</td><td class="cell-coach">' + coachHtml + '</td><td>' + App.escapeHtml(m.phoneNumber || '-') + '</td><td>' + App.escapeHtml(m.school || '-') + '</td><td class="cell-status">' + statusBadge + '</td></tr>';
        });
        tableHtml += '</tbody></table></div>';
        bodyEl.innerHTML = tableHtml;
    } catch (err) {
        App.err('통계 회원 목록 로드 실패:', err);
        bodyEl.innerHTML = '<p style="color: var(--danger); padding: 16px;">목록을 불러오는데 실패했습니다.</p>';
    }
}
