// ========================================
// AFBS 센터 - 공통 JavaScript
// ========================================

// 전역 변수
const App = {
    currentUser: null,
    currentRole: null, // Admin, Manager, Coach, Front
    apiBase: '/api',
    authToken: null,
    // 디버그 로그: 작업 편의를 위해 기본 활성화
    debug: true
};
App.log = function() { if (App.debug) console.log.apply(console, arguments); };
App.warn = function() { if (App.debug) console.warn.apply(console, arguments); };
// 에러는 항상 콘솔에 출력 (디버깅·운영 공통)
App.err = function() { console.error.apply(console, arguments); };

// 디버그 토글(브라우저 콘솔에서 사용): App.setDebug(true|false)
App.setDebug = function(enabled) {
    App.debug = !!enabled;
    try {
        localStorage.setItem('afbs_debug', App.debug ? '1' : '0');
    } catch (e) {}
    console.info('[AFBS] debug:', App.debug ? 'ON' : 'OFF');
};

// 저장된 디버그 설정이 있으면 우선 적용
try {
    var savedDebug = localStorage.getItem('afbs_debug');
    if (savedDebug === '0' || savedDebug === '1') {
        App.debug = savedDebug === '1';
    }
} catch (e) {}

/** 회원 예약 페이지: true이면 /api/public/member-announcements + 로컬 읽음 상태로 종 알림 */
App.usePublicMemberAnnouncements = false;

/** XSS 방지: HTML에 넣을 사용자/API 입력 문자열 이스케이프. innerHTML 템플릿에서 변수에 사용 */
App.escapeHtml = function(str) {
    if (str == null) return '';
    var s = String(str);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/** 회원 관리 화면에서 해당 회원으로 검색·상세 열기 위해 이동 (대시보드 승인·이용권 처리 후 등) */
App.goToMembersWithFocus = function(memberId) {
    if (memberId == null || memberId === '') {
        return;
    }
    try {
        sessionStorage.setItem('afbs_members_focus_id', String(memberId));
    } catch (e) { /* ignore */ }
    window.location.href = '/members.html?focusMember=' + encodeURIComponent(String(memberId));
};

/** 대시보드 회원 관리 모달을 승인 대기 탭으로 연 후 이동 (신규 회원 등록 직후 등) */
App.goToDashboardMemberApprovals = function() {
    window.location.href = '/?openMemberApprovals=1';
};

/** 로컬 날짜 yyyy-MM-dd */
App.formatLocalYmd = function(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
    );
};

/**
 * 예약 달력 공휴일·메모(설정에서 관리) — markDate → { memo, redDay }
 */
App.loadCalendarMarksMap = async function(startYmd, endYmd) {
    var map = {};
    if (!startYmd || !endYmd) return map;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/calendar-day-marks?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return map;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.markDate) {
                map[m.markDate] = {
                    memo: m.memo != null ? String(m.memo) : '',
                    redDay: m.redDay !== false
                };
            }
        });
    } catch (e) {
        App.err('달력 표시(공휴일·메모) 로드 실패:', e);
    }
    return map;
};

/**
 * 휴무 그룹 — 사이드바와 동일.
 * 지점 전체(사하 / 연산 / 비 야구파트)와 파트(야구·트레이닝·필라테스·유소년·사회인·대관)
 */
App.studioBranchCode = function(branch) {
    var b = String(branch || '').trim().toUpperCase();
    if (b === 'SAHA' || b === 'YEONSAN') return b;
    return '';
};

App.CLOSURE_GROUP_CODES = [
    'SAHA', 'SAHA_BASEBALL', 'SAHA_TRAINING', 'SAHA_PILATES',
    'YEONSAN', 'YEONSAN_BASEBALL', 'YEONSAN_PILATES',
    'NON_BASEBALL', 'YOUTH', 'SOCIAL', 'RENTAL'
];

App.normalizeClosureGroup = function(group) {
    var g = String(group || '').trim().toUpperCase();
    if (App.CLOSURE_GROUP_CODES.indexOf(g) >= 0) return g;
    return 'SAHA';
};

App.closureGroupFromConfig = function(config) {
    config = config || {};
    var ft = String(config.facilityType || '').trim().toUpperCase();
    var lc = String(config.lessonCategory || '').trim().toUpperCase();
    var grade = String(config.memberGrade || '').trim().toUpperCase();
    var b = String(config.branch || '').trim().toUpperCase();
    if (ft === 'RENTAL' || b === 'RENTAL') return 'RENTAL';
    if (lc === 'YOUTH_BASEBALL' || lc === 'YOUTH' || grade === 'YOUTH') return 'YOUTH';
    if (grade === 'SOCIAL' || lc === 'SOCIAL') return 'SOCIAL';
    if (b === 'YEONSAN') {
        if (lc === 'PILATES' || ft === 'TRAINING_FITNESS') return 'YEONSAN_PILATES';
        return 'YEONSAN_BASEBALL';
    }
    if (b === 'SAHA') {
        if (lc === 'TRAINING') return 'SAHA_TRAINING';
        if (lc === 'PILATES') return 'SAHA_PILATES';
        return 'SAHA_BASEBALL';
    }
    return 'SAHA';
};

App.loadAllBranchClosuresSet = async function(startYmd, endYmd) {
    var groups = ['SAHA', 'YEONSAN', 'NON_BASEBALL'];
    var sets = await Promise.all(groups.map(function (g) {
        return App.loadBranchClosuresSet(g, startYmd, endYmd);
    }));
    return Object.assign({}, sets[0] || {}, sets[1] || {}, sets[2] || {});
};

App.loadBranchClosuresSet = async function(groupOrConfig, startYmd, endYmd) {
    var set = {};
    var group = groupOrConfig;
    if (groupOrConfig && typeof groupOrConfig === 'object') {
        group = typeof App.closureGroupFromConfig === 'function'
            ? App.closureGroupFromConfig(groupOrConfig)
            : 'SAHA';
    }
    group = typeof App.normalizeClosureGroup === 'function'
        ? App.normalizeClosureGroup(group)
        : String(group || 'SAHA').trim().toUpperCase();
    if (!startYmd || !endYmd) return set;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'group=' +
            encodeURIComponent(group) +
            '&startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/branch-closures?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return set;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.closureDate) set[String(m.closureDate)] = true;
        });
    } catch (e) {
        App.err('지점 휴무일 로드 실패:', e);
    }
    return set;
};

App.markBranchClosedDay = function(dayCell, ymd, closuresSet) {
    if (!dayCell || !ymd || !closuresSet || !closuresSet[ymd]) return null;
    dayCell.classList.add('calendar-day-branch-closed');
    var label = document.createElement('span');
    label.className = 'calendar-branch-closed-label';
    label.textContent = '휴무';
    label.title = '지점 휴무';
    return label;
};

App._weekdayMarkInfo = function(row, dateKey) {
    if (!row || !row[dateKey]) return null;
    return {
        timeText: row.timeText != null ? String(row.timeText) : '',
        branch: App.normalizeWeekdayMarkBranch(row.branch),
        place: row.place != null ? String(row.place) : '',
        coachId: row.coachId != null && row.coachId !== '' ? Number(row.coachId) : null
    };
};

App.normalizeWeekdayMarkBranch = function(branch) {
    var v = String(branch || '').trim().toUpperCase();
    if (v === 'YEONSAN') return 'YEONSAN';
    if (v === 'SAHA') return 'SAHA';
    return '';
};

App.weekdayMarkBranchLabel = function(branch) {
    var b = App.normalizeWeekdayMarkBranch(branch);
    if (b === 'YEONSAN') return '연산';
    if (b === 'SAHA') return '사하';
    return '';
};

/** 지점이 지정된 요일 일정은 해당 지점 캘린더에만 표시 (미지정은 공통). */
App.weekdayMarkMatchesPageBranch = function(info) {
    var markBranch = App.normalizeWeekdayMarkBranch(info && info.branch);
    if (!markBranch) return true;
    var pageBranch = '';
    try {
        pageBranch = App.normalizeWeekdayMarkBranch((window.BOOKING_PAGE_CONFIG || {}).branch);
    } catch (e) { /* ignore */ }
    if (!pageBranch) return true;
    return markBranch === pageBranch;
};

App.formatWeekdayMarkTimeDigits = function(raw) {
    var digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
    var out = '';
    if (digits.length <= 2) {
        out = digits;
    } else if (digits.length <= 4) {
        out = digits.slice(0, 2) + ':' + digits.slice(2);
    } else if (digits.length <= 6) {
        out = digits.slice(0, 2) + ':' + digits.slice(2, 4) + ' ~ ' + digits.slice(4);
    } else {
        out = digits.slice(0, 2) + ':' + digits.slice(2, 4) + ' ~ ' + digits.slice(4, 6) + ':' + digits.slice(6);
    }
    return out;
};

App.normalizeWeekdayMarkTimeText = function(raw) {
    var formatted = App.formatWeekdayMarkTimeDigits(raw);
    if (!formatted) return '';
    if (/^\d{2}:\d{2} ~ \d{2}:\d{2}$/.test(formatted)) return formatted;
    return formatted;
};

App.bindWeekdayMarkTimeInput = function(el) {
    if (!el || el.getAttribute('data-weekday-time-bound') === '1') return;
    el.setAttribute('data-weekday-time-bound', '1');
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('placeholder', '00:00 ~ 00:00');
    el.setAttribute('maxlength', '13');
    el.addEventListener('input', function () {
        var next = App.formatWeekdayMarkTimeDigits(el.value);
        if (el.value !== next) el.value = next;
    });
    el.addEventListener('blur', function () {
        el.value = App.normalizeWeekdayMarkTimeText(el.value);
    });
};

App.formatWeekdayMarkEventLabel = function(contentLabel, info) {
    var parts = [];
    var time = info && info.timeText ? String(info.timeText).trim() : '';
    var place = info && info.place ? String(info.place).trim() : '';
    var branch = info ? App.weekdayMarkBranchLabel(info.branch) : '';
    var mid = place || branch;
    if (time) parts.push(time);
    if (mid) parts.push(mid);
    parts.push(contentLabel || '');
    return parts.filter(Boolean).join(' / ');
};

App.loadYouthTrialDaysSet = async function(startYmd, endYmd) {
    var set = {};
    if (!startYmd || !endYmd) return set;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/youth-trial-days?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return set;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.trialDate) set[String(m.trialDate)] = App._weekdayMarkInfo(m, 'trialDate') || { timeText: '', branch: '' };
        });
    } catch (e) {
        App.err('유소년 체험일 로드 실패:', e);
    }
    return set;
};

App.appendYouthTrialEvent = function(dayCell, ymd, trialSet, onChanged) {
    return App.appendWeekdayMarkEvent(dayCell, ymd, trialSet, 'trial', 'calendar-event--youth-trial', onChanged);
};

App.loadSocialOutdoorDaysSet = async function(startYmd, endYmd) {
    var set = {};
    if (!startYmd || !endYmd) return set;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/social-outdoor-days?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return set;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.outdoorDate) set[String(m.outdoorDate)] = App._weekdayMarkInfo(m, 'outdoorDate') || { timeText: '', branch: '' };
        });
    } catch (e) {
        App.err('사회인 야외일 로드 실패:', e);
    }
    return set;
};

App.appendSocialOutdoorEvent = function(dayCell, ymd, outdoorSet, onChanged) {
    return App.appendWeekdayMarkEvent(dayCell, ymd, outdoorSet, 'social-outdoor', 'calendar-event--social-outdoor', onChanged);
};

App.loadSocialScrimmageDaysSet = async function(startYmd, endYmd) {
    var set = {};
    if (!startYmd || !endYmd) return set;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/social-scrimmage-days?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return set;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.scrimmageDate) set[String(m.scrimmageDate)] = App._weekdayMarkInfo(m, 'scrimmageDate') || { timeText: '', branch: '' };
        });
    } catch (e) {
        App.err('사회인 청·백전일 로드 실패:', e);
    }
    return set;
};

App.appendSocialScrimmageEvent = function(dayCell, ymd, scrimmageSet, onChanged) {
    return App.appendWeekdayMarkEvent(dayCell, ymd, scrimmageSet, 'social-scrimmage', 'calendar-event--social-scrimmage', onChanged);
};

App.loadSocialRegularMeetingDaysSet = async function(startYmd, endYmd) {
    var set = {};
    if (!startYmd || !endYmd) return set;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/social-regular-meeting-days?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return set;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.meetingDate) set[String(m.meetingDate)] = App._weekdayMarkInfo(m, 'meetingDate') || { timeText: '', branch: '' };
        });
    } catch (e) {
        App.err('사회인 정회원 모임일 로드 실패:', e);
    }
    return set;
};

App.appendSocialRegularMeetingEvent = function(dayCell, ymd, meetingSet, onChanged) {
    return App.appendWeekdayMarkEvent(dayCell, ymd, meetingSet, 'social-regular-meeting', 'calendar-event--social-regular-meeting', onChanged);
};

App.loadExternalWorkDaysSet = async function(startYmd, endYmd) {
    var set = {};
    if (!startYmd || !endYmd) return set;
    try {
        var base = App.apiBase || '/api';
        var qs =
            'startDate=' +
            encodeURIComponent(startYmd) +
            '&endDate=' +
            encodeURIComponent(endYmd);
        var res = await fetch(base + '/public/external-work-days?' + qs, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return set;
        var arr = await res.json();
        (arr || []).forEach(function (m) {
            if (m && m.workDate) set[String(m.workDate)] = true;
        });
    } catch (e) {
        App.err('외부업무일 로드 실패:', e);
    }
    return set;
};

App.appendExternalWorkEvent = function(dayCell, ymd, workSet, onCancelled) {
    if (!dayCell || !ymd || !workSet || !workSet[ymd]) return null;
    var ev = document.createElement('div');
    ev.className = 'calendar-event calendar-event--external-work';
    ev.textContent = '외부업무';
    ev.title = '외부업무';
    App.bindWeekdayMarkCancel(ev, 'external-work', ymd, onCancelled);
    dayCell.appendChild(ev);
    return ev;
};

App.weekdayMarkMeta = function(kind) {
    if (kind === 'trial') {
        return { label: '유소년 체험', particle: '을', path: '/youth-trial-days/', dateKey: 'trialDate', putPath: '/youth-trial-days' };
    }
    if (kind === 'external-work') {
        return { label: '외부업무', particle: '를', path: '/external-work-days/', dateKey: 'workDate', putPath: '/external-work-days' };
    }
    if (kind === 'social-scrimmage') {
        return { label: '청·백전', particle: '을', path: '/social-scrimmage-days/', dateKey: 'scrimmageDate', putPath: '/social-scrimmage-days' };
    }
    if (kind === 'social-regular-meeting') {
        return { label: '사회인 정회원 모임', particle: '을', path: '/social-regular-meeting-days/', dateKey: 'meetingDate', putPath: '/social-regular-meeting-days' };
    }
    return { label: '사회인 야외', particle: '를', path: '/social-outdoor-days/', dateKey: 'outdoorDate', putPath: '/social-outdoor-days' };
};

App.appendWeekdayMarkEvent = function(dayCell, ymd, markSet, kind, className, onChanged) {
    if (!dayCell || !ymd || !markSet || !markSet[ymd]) return null;
    var info = typeof markSet[ymd] === 'object' ? markSet[ymd] : { timeText: '', branch: '', coachId: null };
    var pageBranch = '';
    try {
        pageBranch = App.normalizeWeekdayMarkBranch((window.BOOKING_PAGE_CONFIG || {}).branch);
    } catch (e) { /* ignore */ }
    // 연산 캘린더에는 사회인 청·백전 표시 안 함
    if (kind === 'social-scrimmage' && pageBranch === 'YEONSAN') return null;
    if (!App.weekdayMarkMatchesPageBranch(info)) return null;
    var meta = App.weekdayMarkMeta(kind);
    var label = App.formatWeekdayMarkEventLabel(meta.label, info);
    var ev = document.createElement('div');
    ev.className = 'calendar-event ' + className;
    ev.textContent = label;
    ev.title = label;
    ev.setAttribute('data-weekday-kind', kind);
    ev.setAttribute('data-ymd', ymd);
    ev.setAttribute('data-time-text', info.timeText || '');
    ev.setAttribute('data-branch', info.branch || '');
    if (info.coachId) ev.setAttribute('data-coach-id', String(info.coachId));
    App.applyWeekdayMarkCoachColor(ev, info);
    App.bindWeekdayMarkOpen(ev, kind, ymd, info, onChanged);
    dayCell.appendChild(ev);
    return ev;
};

App.applyWeekdayMarkCoachColor = function(ev, info) {
    if (!ev || !info || !info.coachId) return;
    if (!(App.CoachColors && typeof App.CoachColors.getColor === 'function')) return;
    var hex = App.CoachColors.getColor({ id: info.coachId });
    if (!hex) return;
    ev.style.backgroundColor = hex;
    ev.style.borderLeft = '3px solid ' + hex;
    ev.classList.add('calendar-event--weekday-coach-color');
};

App.loadWeekdayMarkCoachOptions = async function() {
    if (App._weekdayMarkCoachOptions && App._weekdayMarkCoachOptions.length) {
        return App._weekdayMarkCoachOptions;
    }
    try {
        var list = await App.api.get('/coaches/active');
        App._weekdayMarkCoachOptions = Array.isArray(list) ? list : [];
        if (App.CoachColors && typeof App.CoachColors.registerFromCoaches === 'function') {
            App.CoachColors.registerFromCoaches(App._weekdayMarkCoachOptions);
        }
    } catch (e) {
        App.err('요일 일정 코치 목록 로드 실패:', e);
        App._weekdayMarkCoachOptions = [];
    }
    return App._weekdayMarkCoachOptions;
};

App.fillWeekdayMarkCoachSelect = async function(selectEl, selectedId) {
    if (!selectEl) return;
    var coaches = await App.loadWeekdayMarkCoachOptions();
    var cur = selectedId != null && selectedId !== '' ? String(selectedId) : '';
    var html = '<option value="">미지정</option>';
    coaches.forEach(function (coach) {
        if (!coach || coach.id == null) return;
        var id = String(coach.id);
        var name = coach.name || ('코치 #' + id);
        html += '<option value="' + id + '"' + (id === cur ? ' selected' : '') + '>' +
            String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</option>';
    });
    selectEl.innerHTML = html;
    if (cur) selectEl.value = cur;
};

App.bindWeekdayMarkOpen = function(ev, kind, ymd, info, onChanged) {
    if (!ev || !ymd) return;
    var canEdit = typeof App.canEditCalendarClosures === 'function' && App.canEditCalendarClosures();
    if (!canEdit) return;
    var meta = App.weekdayMarkMeta(kind);
    ev.classList.add('calendar-event--weekday-cancelable');
    ev.title = App.formatWeekdayMarkEventLabel(meta.label, info) + ' · 클릭하면 수정합니다';
    ev.setAttribute('role', 'button');
    ev.tabIndex = 0;
    var run = function (e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        App.openWeekdayMarkEditModal(kind, ymd, info, onChanged);
    };
    ev.addEventListener('click', run);
    ev.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') run(e);
    });
};

App.bindWeekdayMarkCancel = function(ev, kind, ymd, onCancelled) {
    if (!ev || !ymd) return;
    var canEdit = typeof App.canEditCalendarClosures === 'function' && App.canEditCalendarClosures();
    if (!canEdit) return;
    var meta = App.weekdayMarkMeta(kind);
    ev.classList.add('calendar-event--weekday-cancelable');
    ev.title = meta.label + ' · 클릭하면 이 날짜를 취소합니다';
    ev.setAttribute('role', 'button');
    ev.tabIndex = 0;
    var run = function (e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        App.cancelWeekdayCalendarMark(kind, ymd, onCancelled);
    };
    ev.addEventListener('click', run);
    ev.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') run(e);
    });
};

App.cancelWeekdayCalendarMark = async function(kind, ymd, onCancelled) {
    if (typeof App.canEditCalendarClosures === 'function' && !App.canEditCalendarClosures()) return;
    if (App._weekdayMarkCancelBusy) return;
    var meta = App.weekdayMarkMeta(kind);
    if (!confirm(ymd + ' ' + meta.label + meta.particle + ' 취소할까요?')) return;
    App._weekdayMarkCancelBusy = true;
    try {
        await App.api.delete(meta.path + encodeURIComponent(ymd));
        if (App.showNotification) App.showNotification(meta.label + meta.particle + ' 취소했습니다.', 'success');
        if (typeof onCancelled === 'function') await onCancelled();
        else if (typeof window.renderCalendar === 'function') await window.renderCalendar();
    } catch (e) {
        App.err('요일 일정 취소 실패:', e);
        if (typeof App.showApiError === 'function') App.showApiError(e);
        else if (App.showNotification) App.showNotification('취소에 실패했습니다.', 'danger');
    } finally {
        App._weekdayMarkCancelBusy = false;
    }
};

App.ensureWeekdayMarkEditModal = function() {
    var el = document.getElementById('weekday-mark-edit-modal');
    if (el && (!el.querySelector('#weekday-mark-edit-coach') || !el.querySelector('#weekday-mark-edit-place'))) {
        el.remove();
        el = null;
    }
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'weekday-mark-edit-modal';
    el.innerHTML =
        '<div class="modal" style="max-width: 420px; width: 92vw;">' +
            '<div class="modal-header">' +
                '<h2 class="modal-title" id="weekday-mark-edit-title">요일 일정</h2>' +
                '<button type="button" class="modal-close" id="weekday-mark-edit-x">×</button>' +
            '</div>' +
            '<div class="modal-body">' +
                '<p id="weekday-mark-edit-date" class="weekday-picker-lead"></p>' +
                '<div class="form-group">' +
                    '<label class="form-label" for="weekday-mark-edit-time">사용시간</label>' +
                    '<input type="text" class="form-control" id="weekday-mark-edit-time" placeholder="00:00 ~ 00:00" maxlength="13" inputmode="numeric">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label" for="weekday-mark-edit-branch">지점</label>' +
                    '<select class="form-control" id="weekday-mark-edit-branch">' +
                        '<option value="">선택</option>' +
                        '<option value="SAHA">사하</option>' +
                        '<option value="YEONSAN">연산</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-group" id="weekday-mark-edit-place-wrap" hidden>' +
                    '<label class="form-label" for="weekday-mark-edit-place">장소</label>' +
                    '<select class="form-control" id="weekday-mark-edit-place">' +
                        '<option value="">선택</option>' +
                        '<option value="BPA 야구장">BPA 야구장</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label" for="weekday-mark-edit-coach">담당 코치</label>' +
                    '<select class="form-control" id="weekday-mark-edit-coach">' +
                        '<option value="">미지정</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label">내용</label>' +
                    '<input type="text" class="form-control" id="weekday-mark-edit-content" readonly>' +
                '</div>' +
            '</div>' +
            '<div class="modal-footer" style="flex-wrap:wrap;gap:8px;">' +
                '<button type="button" class="btn btn-danger" id="weekday-mark-edit-delete">삭제</button>' +
                '<span style="flex:1;"></span>' +
                '<button type="button" class="btn btn-secondary" id="weekday-mark-edit-cancel">닫기</button>' +
                '<button type="button" class="btn btn-primary" id="weekday-mark-edit-save">저장</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(el);
    var close = function () { App.Modal.close('weekday-mark-edit-modal'); };
    el.querySelector('#weekday-mark-edit-x').addEventListener('click', close);
    el.querySelector('#weekday-mark-edit-cancel').addEventListener('click', close);
    el.addEventListener('click', function (e) {
        if (e.target === el) close();
    });
    el.querySelector('#weekday-mark-edit-save').addEventListener('click', function () {
        App.saveWeekdayMarkEditModal();
    });
    el.querySelector('#weekday-mark-edit-delete').addEventListener('click', function () {
        App.deleteWeekdayMarkEditModal();
    });
    App.bindWeekdayMarkTimeInput(el.querySelector('#weekday-mark-edit-time'));
    return el;
};

App.openWeekdayMarkEditModal = async function(kind, ymd, info, onChanged) {
    if (typeof App.canEditCalendarClosures === 'function' && !App.canEditCalendarClosures()) return;
    var meta = App.weekdayMarkMeta(kind);
    App.ensureWeekdayMarkEditModal();
    App._weekdayMarkEdit = { kind: kind, ymd: ymd, onChanged: onChanged };
    document.getElementById('weekday-mark-edit-title').textContent = meta.label;
    document.getElementById('weekday-mark-edit-date').textContent = ymd;
    var editTimeEl = document.getElementById('weekday-mark-edit-time');
    App.bindWeekdayMarkTimeInput(editTimeEl);
    editTimeEl.value = App.formatWeekdayMarkTimeDigits((info && info.timeText) ? String(info.timeText) : '');
    document.getElementById('weekday-mark-edit-branch').value = App.normalizeWeekdayMarkBranch(info && info.branch) || '';
    var placeWrap = document.getElementById('weekday-mark-edit-place-wrap');
    var placeEl = document.getElementById('weekday-mark-edit-place');
    var showPlace = kind === 'social-outdoor' || kind === 'social-scrimmage';
    if (placeWrap) placeWrap.hidden = !showPlace;
    if (placeEl) placeEl.value = showPlace && info && info.place ? String(info.place) : '';
    document.getElementById('weekday-mark-edit-content').value = meta.label;
    await App.fillWeekdayMarkCoachSelect(
        document.getElementById('weekday-mark-edit-coach'),
        info && info.coachId
    );
    App.Modal.open('weekday-mark-edit-modal');
};

App.saveWeekdayMarkEditModal = async function() {
    var ctx = App._weekdayMarkEdit;
    if (!ctx || App._weekdayMarkCancelBusy) return;
    var meta = App.weekdayMarkMeta(ctx.kind);
    var timeText = App.normalizeWeekdayMarkTimeText(document.getElementById('weekday-mark-edit-time').value);
    var branch = App.normalizeWeekdayMarkBranch(document.getElementById('weekday-mark-edit-branch').value);
    var coachRaw = document.getElementById('weekday-mark-edit-coach').value;
    var coachId = coachRaw ? Number(coachRaw) : null;
    if (!(coachId > 0)) coachId = null;
    var body = {};
    body[meta.dateKey] = ctx.ymd;
    body.timeText = timeText;
    body.branch = branch || null;
    body.coachId = coachId;
    if (ctx.kind === 'social-outdoor' || ctx.kind === 'social-scrimmage') {
        var placeEl = document.getElementById('weekday-mark-edit-place');
        body.place = placeEl ? String(placeEl.value || '').trim() : '';
        if (!body.place) body.place = null;
    }
    App._weekdayMarkCancelBusy = true;
    try {
        await App.api.put(meta.putPath, body);
        if (App.showNotification) App.showNotification(meta.label + '을(를) 저장했습니다.', 'success');
        App.Modal.close('weekday-mark-edit-modal');
        if (typeof ctx.onChanged === 'function') await ctx.onChanged();
        else if (typeof window.renderCalendar === 'function') await window.renderCalendar();
    } catch (e) {
        App.err('요일 일정 저장 실패:', e);
        if (typeof App.showApiError === 'function') App.showApiError(e);
        else if (App.showNotification) App.showNotification('저장에 실패했습니다.', 'danger');
    } finally {
        App._weekdayMarkCancelBusy = false;
    }
};

App.deleteWeekdayMarkEditModal = async function() {
    var ctx = App._weekdayMarkEdit;
    if (!ctx) return;
    App.Modal.close('weekday-mark-edit-modal');
    await App.cancelWeekdayCalendarMark(ctx.kind, ctx.ymd, ctx.onChanged);
};

App.canEditCalendarClosures = function() {
    var role = String(App.currentRole || (App.currentUser && App.currentUser.role) || '').toUpperCase();
    return role === 'ADMIN' || role === 'MANAGER';
};

App.closureTargetLabel = function(group) {
    var labels = {
        SAHA: '사하 (전체)',
        SAHA_BASEBALL: '사하 야구',
        SAHA_TRAINING: '사하 트레이닝',
        SAHA_PILATES: '사하 필라테스',
        YEONSAN: '연산 (전체)',
        YEONSAN_BASEBALL: '연산 야구',
        YEONSAN_PILATES: '연산 필라테스',
        NON_BASEBALL: '비 야구파트 (전체)',
        YOUTH: '유소년',
        SOCIAL: '사회인',
        RENTAL: '대관'
    };
    var g = typeof App.normalizeClosureGroup === 'function'
        ? App.normalizeClosureGroup(group)
        : String(group || 'SAHA').trim().toUpperCase();
    return labels[g] || '이 캘린더';
};

App.ymdDatesForWeekdayInMonth = function(year, monthIndex, dayOfWeek) {
    var dates = [];
    var d = new Date(year, monthIndex, 1);
    while (d.getMonth() === monthIndex) {
        if (d.getDay() === dayOfWeek) {
            dates.push(
                d.getFullYear() +
                    '-' +
                    String(d.getMonth() + 1).padStart(2, '0') +
                    '-' +
                    String(d.getDate()).padStart(2, '0')
            );
        }
        d.setDate(d.getDate() + 1);
    }
    return dates;
};

App.appendCalendarWeekdayHeaders = function(grid, year, monthIndex, closuresSet, onChanged) {
    if (!grid) return;
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    var canEdit = typeof App.canEditCalendarClosures === 'function' && App.canEditCalendarClosures();
    days.forEach(function (day, idx) {
        var header = document.createElement('div');
        header.className =
            'calendar-day-header' +
            (idx === 0 ? ' calendar-day-header-sun' : idx === 6 ? ' calendar-day-header-sat' : '');
        header.textContent = day;
        var dates = App.ymdDatesForWeekdayInMonth(year, monthIndex, idx);
        var allClosed = dates.length > 0 && dates.every(function (ymd) {
            return closuresSet && closuresSet[ymd];
        });
        if (allClosed) header.classList.add('calendar-day-header--closed');
        if (canEdit) {
            header.classList.add('calendar-day-header--clickable');
            header.setAttribute('role', 'button');
            header.tabIndex = 0;
            header.title =
                year +
                '년 ' +
                (monthIndex + 1) +
                '월 ' +
                day +
                '요일(' +
                dates.map(function (ymd) { return String(parseInt(ymd.slice(8), 10)); }).join(', ') +
                '일) 중 유소년 체험·사회인 야외·청·백전·정회원 모임·휴무 날짜를 고릅니다.';
            var run = function () {
                App.openCalendarWeekdayClosurePicker(year, monthIndex, idx, onChanged);
            };
            header.addEventListener('click', run);
            header.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    run();
                }
            });
        }
        grid.appendChild(header);
    });
};

App._fillWeekdayPickerChips = function(wrap, dates, owned, chipClass) {
    if (!wrap) return;
    wrap.innerHTML = '';
    dates.forEach(function (ymd) {
        var on = !!(owned && owned[ymd]);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = chipClass + (on ? ' is-on' : '');
        btn.setAttribute('data-ymd', ymd);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.textContent = String(parseInt(ymd.slice(8), 10)) + '일';
        btn.addEventListener('click', function () {
            var next = !btn.classList.contains('is-on');
            btn.classList.toggle('is-on', next);
            btn.setAttribute('aria-pressed', next ? 'true' : 'false');
        });
        wrap.appendChild(btn);
    });
};

App._setAllWeekdayPickerChips = function(root, selector, on) {
    if (!root) return;
    root.querySelectorAll(selector).forEach(function (btn) {
        btn.classList.toggle('is-on', !!on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
};

App._weekdayPickerMetaHtml = function(prefix, opt) {
    opt = opt || {};
    var placeHtml = '';
    if (opt.withPlace) {
        placeHtml =
            '<div class="form-group weekday-picker-meta-field">' +
                '<label class="form-label" for="' + prefix + '-place">장소</label>' +
                '<select class="form-control" id="' + prefix + '-place">' +
                    '<option value="">선택</option>' +
                    '<option value="BPA 야구장">BPA 야구장</option>' +
                '</select>' +
            '</div>';
    }
    return (
        '<div class="weekday-picker-meta">' +
            '<div class="form-group weekday-picker-meta-field">' +
                '<label class="form-label" for="' + prefix + '-time">사용시간</label>' +
                '<input type="text" class="form-control" id="' + prefix + '-time" placeholder="00:00 ~ 00:00" maxlength="13" inputmode="numeric">' +
            '</div>' +
            '<div class="form-group weekday-picker-meta-field">' +
                '<label class="form-label" for="' + prefix + '-branch">지점</label>' +
                '<select class="form-control" id="' + prefix + '-branch">' +
                    '<option value="">선택</option>' +
                    '<option value="SAHA">사하</option>' +
                    '<option value="YEONSAN">연산</option>' +
                '</select>' +
            '</div>' +
            placeHtml +
            '<div class="form-group weekday-picker-meta-field weekday-picker-meta-field--coach">' +
                '<label class="form-label" for="' + prefix + '-coach">담당 코치</label>' +
                '<select class="form-control" id="' + prefix + '-coach">' +
                    '<option value="">미지정</option>' +
                '</select>' +
            '</div>' +
        '</div>'
    );
};

App._setWeekdayPickerMetaFields = async function(prefix, ownedMap) {
    var timeEl = document.getElementById(prefix + '-time');
    App.bindWeekdayMarkTimeInput(timeEl);
    var branchEl = document.getElementById(prefix + '-branch');
    var coachEl = document.getElementById(prefix + '-coach');
    if (!timeEl || !branchEl) return;
    var sample = null;
    if (ownedMap) {
        Object.keys(ownedMap).some(function (ymd) {
            if (ownedMap[ymd] && typeof ownedMap[ymd] === 'object') {
                sample = ownedMap[ymd];
                return true;
            }
            return false;
        });
    }
    timeEl.value = App.formatWeekdayMarkTimeDigits(sample && sample.timeText ? String(sample.timeText) : '');
    branchEl.value = App.normalizeWeekdayMarkBranch(sample && sample.branch) || '';
    var placeEl = document.getElementById(prefix + '-place');
    if (placeEl) placeEl.value = sample && sample.place ? String(sample.place) : '';
    await App.fillWeekdayMarkCoachSelect(coachEl, sample && sample.coachId);
};

App._readWeekdayPickerMetaFields = function(prefix) {
    var timeEl = document.getElementById(prefix + '-time');
    App.bindWeekdayMarkTimeInput(timeEl);
    var branchEl = document.getElementById(prefix + '-branch');
    var coachEl = document.getElementById(prefix + '-coach');
    var coachId = coachEl && coachEl.value ? Number(coachEl.value) : null;
    if (!(coachId > 0)) coachId = null;
    var placeEl = document.getElementById(prefix + '-place');
    return {
        timeText: timeEl ? App.normalizeWeekdayMarkTimeText(timeEl.value) : '',
        branch: App.normalizeWeekdayMarkBranch(branchEl && branchEl.value),
        place: placeEl ? String(placeEl.value || '').trim() : '',
        coachId: coachId
    };
};

App._ownedMapFromList = function(list, dateKey) {
    var owned = {};
    (list || []).forEach(function (row) {
        if (!row || !row[dateKey]) return;
        owned[String(row[dateKey])] = {
            timeText: row.timeText != null ? String(row.timeText) : '',
            branch: App.normalizeWeekdayMarkBranch(row.branch),
            place: row.place != null ? String(row.place) : '',
            coachId: row.coachId != null && row.coachId !== '' ? Number(row.coachId) : null
        };
    });
    return owned;
};

App.ensureWeekdayClosurePickerModal = function() {
    var el = document.getElementById('weekday-closure-picker-modal');
    if (el && (!el.querySelector('#weekday-trial-picker-dates')
            || !el.querySelector('#weekday-social-outdoor-picker-dates')
            || !el.querySelector('#weekday-social-scrimmage-picker-dates')
            || !el.querySelector('#weekday-social-regular-meeting-picker-dates')
            || !el.querySelector('#weekday-trial-time')
            || !el.querySelector('#weekday-trial-coach')
            || !el.querySelector('#weekday-social-outdoor-place')
            || !el.querySelector('#weekday-social-scrimmage-place')
            || !el.querySelector('#weekday-social-outdoor-time')
            || !el.querySelector('#weekday-external-work-picker-dates')
            || !el.querySelector('.weekday-picker-section--external-work[hidden]'))) {
        el.remove();
        el = null;
    }
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'weekday-closure-picker-modal';
    el.innerHTML =
        '<div class="modal" style="max-width: 480px; width: 94vw;">' +
            '<div class="modal-header">' +
                '<h2 class="modal-title" id="weekday-closure-picker-title">요일 일정</h2>' +
                '<button type="button" class="modal-close" id="weekday-closure-picker-x">×</button>' +
            '</div>' +
            '<div class="modal-body">' +
                '<p id="weekday-closure-picker-hint" class="weekday-picker-lead"></p>' +
                '<section class="weekday-picker-section weekday-picker-section--trial">' +
                    '<h3 class="weekday-picker-section-title">유소년 체험</h3>' +
                    '<p class="weekday-picker-section-hint">전 지점 공통 반복 일정입니다. 파란 칸이 체험일입니다.</p>' +
                    '<div id="weekday-trial-picker-dates" class="weekday-closure-dates"></div>' +
                    App._weekdayPickerMetaHtml('weekday-trial') +
                    '<div class="weekday-picker-section-actions">' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-trial-picker-all">모두 선택</button>' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-trial-picker-none">모두 해제</button>' +
                    '</div>' +
                '</section>' +
                '<section class="weekday-picker-section weekday-picker-section--social-outdoor">' +
                    '<h3 class="weekday-picker-section-title">사회인 야외</h3>' +
                    '<p class="weekday-picker-section-hint">전 지점 공통 반복 일정입니다. 파란 칸이 사회인 야외일입니다.</p>' +
                    '<div id="weekday-social-outdoor-picker-dates" class="weekday-closure-dates"></div>' +
                    App._weekdayPickerMetaHtml('weekday-social-outdoor', { withPlace: true }) +
                    '<div class="weekday-picker-section-actions">' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-social-outdoor-picker-all">모두 선택</button>' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-social-outdoor-picker-none">모두 해제</button>' +
                    '</div>' +
                '</section>' +
                '<section class="weekday-picker-section weekday-picker-section--social-scrimmage">' +
                    '<h3 class="weekday-picker-section-title">청·백전</h3>' +
                    '<p class="weekday-picker-section-hint">전 지점 공통 반복 일정입니다. 파란 칸이 청·백전일입니다.</p>' +
                    '<div id="weekday-social-scrimmage-picker-dates" class="weekday-closure-dates"></div>' +
                    App._weekdayPickerMetaHtml('weekday-social-scrimmage', { withPlace: true }) +
                    '<div class="weekday-picker-section-actions">' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-social-scrimmage-picker-all">모두 선택</button>' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-social-scrimmage-picker-none">모두 해제</button>' +
                    '</div>' +
                '</section>' +
                '<section class="weekday-picker-section weekday-picker-section--social-regular-meeting">' +
                    '<h3 class="weekday-picker-section-title">사회인 정회원 모임</h3>' +
                    '<p class="weekday-picker-section-hint">전 지점 공통 반복 일정입니다. 파란 칸이 정회원 모임일입니다.</p>' +
                    '<div id="weekday-social-regular-meeting-picker-dates" class="weekday-closure-dates"></div>' +
                    App._weekdayPickerMetaHtml('weekday-social-regular-meeting') +
                    '<div class="weekday-picker-section-actions">' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-social-regular-meeting-picker-all">모두 선택</button>' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-social-regular-meeting-picker-none">모두 해제</button>' +
                    '</div>' +
                '</section>' +
                '<section class="weekday-picker-section weekday-picker-section--external-work" hidden>' +
                    '<h3 class="weekday-picker-section-title">외부업무</h3>' +
                    '<p class="weekday-picker-section-hint">전 지점 공통 반복 일정입니다. 주황 칸이 외부업무일입니다.</p>' +
                    '<div id="weekday-external-work-picker-dates" class="weekday-closure-dates"></div>' +
                    '<div class="weekday-picker-section-actions">' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-external-work-picker-all">모두 선택</button>' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-external-work-picker-none">모두 해제</button>' +
                    '</div>' +
                '</section>' +
                '<section class="weekday-picker-section weekday-picker-section--closure">' +
                    '<h3 class="weekday-picker-section-title">휴무</h3>' +
                    '<p class="weekday-picker-section-hint" id="weekday-closure-picker-group-hint"></p>' +
                    '<div id="weekday-closure-picker-dates" class="weekday-closure-dates"></div>' +
                    '<div class="weekday-picker-section-actions">' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-closure-picker-all">모두 선택</button>' +
                        '<button type="button" class="btn btn-secondary weekday-picker-mini-btn" id="weekday-closure-picker-none">모두 해제</button>' +
                    '</div>' +
                '</section>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button type="button" class="btn btn-primary" id="weekday-closure-picker-save">저장</button>' +
                '<button type="button" class="btn btn-secondary" id="weekday-closure-picker-cancel">취소</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(el);
    var close = function () { App.Modal.close('weekday-closure-picker-modal'); };
    el.querySelector('#weekday-closure-picker-x').addEventListener('click', close);
    el.querySelector('#weekday-closure-picker-cancel').addEventListener('click', close);
    el.addEventListener('click', function (e) {
        if (e.target === el) close();
    });
    el.querySelector('#weekday-trial-picker-all').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-trial-picker-dates .weekday-trial-date', true);
    });
    el.querySelector('#weekday-trial-picker-none').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-trial-picker-dates .weekday-trial-date', false);
    });
    el.querySelector('#weekday-social-outdoor-picker-all').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-social-outdoor-picker-dates .weekday-social-outdoor-date', true);
    });
    el.querySelector('#weekday-social-outdoor-picker-none').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-social-outdoor-picker-dates .weekday-social-outdoor-date', false);
    });
    el.querySelector('#weekday-social-scrimmage-picker-all').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-social-scrimmage-picker-dates .weekday-social-scrimmage-date', true);
    });
    el.querySelector('#weekday-social-scrimmage-picker-none').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-social-scrimmage-picker-dates .weekday-social-scrimmage-date', false);
    });
    el.querySelector('#weekday-social-regular-meeting-picker-all').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-social-regular-meeting-picker-dates .weekday-social-regular-meeting-date', true);
    });
    el.querySelector('#weekday-social-regular-meeting-picker-none').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-social-regular-meeting-picker-dates .weekday-social-regular-meeting-date', false);
    });
    el.querySelector('#weekday-external-work-picker-all').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-external-work-picker-dates .weekday-external-work-date', true);
    });
    el.querySelector('#weekday-external-work-picker-none').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-external-work-picker-dates .weekday-external-work-date', false);
    });
    el.querySelector('#weekday-closure-picker-all').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-closure-picker-dates .weekday-closure-date', true);
    });
    el.querySelector('#weekday-closure-picker-none').addEventListener('click', function () {
        App._setAllWeekdayPickerChips(el, '#weekday-closure-picker-dates .weekday-closure-date', false);
    });
    el.querySelector('#weekday-closure-picker-save').addEventListener('click', function () {
        App.saveCalendarWeekdayClosurePicker();
    });
    return el;
};

App.openCalendarWeekdayClosurePicker = async function(year, monthIndex, dayOfWeek, onChanged) {
    if (App._weekdayClosureBusy) return;
    if (!App.canEditCalendarClosures || !App.canEditCalendarClosures()) {
        if (App.showNotification) App.showNotification('관리자·매니저만 요일 일정을 지정할 수 있습니다.', 'warning');
        return;
    }
    var names = ['일', '월', '화', '수', '목', '금', '토'];
    var dates = App.ymdDatesForWeekdayInMonth(year, monthIndex, dayOfWeek);
    if (!dates.length) return;
    var group = typeof App.closureGroupFromConfig === 'function'
        ? App.closureGroupFromConfig(window.BOOKING_PAGE_CONFIG || {})
        : 'SAHA';
    group = typeof App.normalizeClosureGroup === 'function' ? App.normalizeClosureGroup(group) : group;
    var start = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-01';
    var last = new Date(year, monthIndex + 1, 0).getDate();
    var end = year + '-' + String(monthIndex + 1).padStart(2, '0') + '-' + String(last).padStart(2, '0');
    var label = App.closureTargetLabel(group);
    var weekdayName = names[dayOfWeek] || '';
    App._weekdayClosureBusy = true;
    try {
        var closureUrl =
            '/branch-closures?group=' +
            encodeURIComponent(group) +
            '&startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        var trialUrl =
            '/youth-trial-days?startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        var socialOutdoorUrl =
            '/social-outdoor-days?startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        var socialScrimmageUrl =
            '/social-scrimmage-days?startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        var socialRegularMeetingUrl =
            '/social-regular-meeting-days?startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        var externalWorkUrl =
            '/external-work-days?startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        var results = await Promise.all([
            App.api.get(closureUrl),
            App.api.get(trialUrl).catch(function () { return []; }),
            App.api.get(socialOutdoorUrl).catch(function () { return []; }),
            App.api.get(socialScrimmageUrl).catch(function () { return []; }),
            App.api.get(socialRegularMeetingUrl).catch(function () { return []; }),
            App.api.get(externalWorkUrl).catch(function () { return []; })
        ]);
        var list = results[0];
        var trialOwned = App._ownedMapFromList(results[1], 'trialDate');
        var socialOutdoorOwned = App._ownedMapFromList(results[2], 'outdoorDate');
        var socialScrimmageOwned = App._ownedMapFromList(results[3], 'scrimmageDate');
        var socialRegularMeetingOwned = App._ownedMapFromList(results[4], 'meetingDate');
        var externalWorkOwned = {};
        (results[5] || []).forEach(function (row) {
            if (row && row.workDate) externalWorkOwned[String(row.workDate)] = true;
        });
        var owned = {};
        (list || []).forEach(function (row) {
            if (row && row.closureDate) owned[String(row.closureDate)] = true;
        });
        App.ensureWeekdayClosurePickerModal();
        document.getElementById('weekday-closure-picker-title').textContent =
            year + '년 ' + (monthIndex + 1) + '월 ' + weekdayName + '요일';
        document.getElementById('weekday-closure-picker-hint').textContent =
            weekdayName + '요일 날짜·사용시간·지점을 구역별로 고르세요. 체험·야외·청·백전·정회원 모임은 전 지점 공통입니다.';
        document.getElementById('weekday-closure-picker-group-hint').textContent =
            label + '에서 휴무로 둘 날짜만 고르세요. 빨간 칸이 휴무입니다.';
        App._fillWeekdayPickerChips(
            document.getElementById('weekday-trial-picker-dates'),
            dates,
            trialOwned,
            'weekday-closure-date weekday-trial-date'
        );
        App._fillWeekdayPickerChips(
            document.getElementById('weekday-social-outdoor-picker-dates'),
            dates,
            socialOutdoorOwned,
            'weekday-closure-date weekday-social-outdoor-date'
        );
        App._fillWeekdayPickerChips(
            document.getElementById('weekday-social-scrimmage-picker-dates'),
            dates,
            socialScrimmageOwned,
            'weekday-closure-date weekday-social-scrimmage-date'
        );
        App._fillWeekdayPickerChips(
            document.getElementById('weekday-social-regular-meeting-picker-dates'),
            dates,
            socialRegularMeetingOwned,
            'weekday-closure-date weekday-social-regular-meeting-date'
        );
        App._fillWeekdayPickerChips(
            document.getElementById('weekday-external-work-picker-dates'),
            dates,
            externalWorkOwned,
            'weekday-closure-date weekday-external-work-date'
        );
        App._fillWeekdayPickerChips(
            document.getElementById('weekday-closure-picker-dates'),
            dates,
            owned,
            'weekday-closure-date'
        );
        await App._setWeekdayPickerMetaFields('weekday-trial', trialOwned);
        await App._setWeekdayPickerMetaFields('weekday-social-outdoor', socialOutdoorOwned);
        await App._setWeekdayPickerMetaFields('weekday-social-scrimmage', socialScrimmageOwned);
        await App._setWeekdayPickerMetaFields('weekday-social-regular-meeting', socialRegularMeetingOwned);
        App._weekdayClosurePicker = {
            group: group,
            dates: dates,
            owned: owned,
            trialOwned: trialOwned,
            socialOutdoorOwned: socialOutdoorOwned,
            socialScrimmageOwned: socialScrimmageOwned,
            socialRegularMeetingOwned: socialRegularMeetingOwned,
            externalWorkOwned: externalWorkOwned,
            label: label,
            weekdayName: weekdayName,
            onChanged: onChanged
        };
        App.Modal.open('weekday-closure-picker-modal');
    } catch (e) {
        App.err('요일 일정 목록 로드 실패:', e);
        if (App.showNotification) App.showNotification('요일 일정을 불러오지 못했습니다.', 'danger');
    } finally {
        App._weekdayClosureBusy = false;
    }
};

App.saveCalendarWeekdayClosurePicker = async function() {
    var ctx = App._weekdayClosurePicker;
    if (!ctx || App._weekdayClosureBusy) return;
    var selected = {};
    document.querySelectorAll('#weekday-closure-picker-dates .weekday-closure-date.is-on').forEach(function (btn) {
        var ymd = btn.getAttribute('data-ymd');
        if (ymd) selected[ymd] = true;
    });
    var selectedTrial = {};
    document.querySelectorAll('#weekday-trial-picker-dates .weekday-trial-date.is-on').forEach(function (btn) {
        var ymd = btn.getAttribute('data-ymd');
        if (ymd) selectedTrial[ymd] = true;
    });
    var selectedSocialOutdoor = {};
    document.querySelectorAll('#weekday-social-outdoor-picker-dates .weekday-social-outdoor-date.is-on').forEach(function (btn) {
        var ymd = btn.getAttribute('data-ymd');
        if (ymd) selectedSocialOutdoor[ymd] = true;
    });
    var selectedSocialScrimmage = {};
    document.querySelectorAll('#weekday-social-scrimmage-picker-dates .weekday-social-scrimmage-date.is-on').forEach(function (btn) {
        var ymd = btn.getAttribute('data-ymd');
        if (ymd) selectedSocialScrimmage[ymd] = true;
    });
    var selectedSocialRegularMeeting = {};
    document.querySelectorAll('#weekday-social-regular-meeting-picker-dates .weekday-social-regular-meeting-date.is-on').forEach(function (btn) {
        var ymd = btn.getAttribute('data-ymd');
        if (ymd) selectedSocialRegularMeeting[ymd] = true;
    });
    var trialOwned = ctx.trialOwned || {};
    var socialOutdoorOwned = ctx.socialOutdoorOwned || {};
    var socialScrimmageOwned = ctx.socialScrimmageOwned || {};
    var socialRegularMeetingOwned = ctx.socialRegularMeetingOwned || {};
    var trialMeta = App._readWeekdayPickerMetaFields('weekday-trial');
    var outdoorMeta = App._readWeekdayPickerMetaFields('weekday-social-outdoor');
    var scrimmageMeta = App._readWeekdayPickerMetaFields('weekday-social-scrimmage');
    var meetingMeta = App._readWeekdayPickerMetaFields('weekday-social-regular-meeting');
    var toAdd = ctx.dates.filter(function (ymd) { return selected[ymd] && !ctx.owned[ymd]; });
    var toDel = ctx.dates.filter(function (ymd) { return !selected[ymd] && ctx.owned[ymd]; });
    var trialKeep = ctx.dates.filter(function (ymd) { return selectedTrial[ymd]; });
    var trialDel = ctx.dates.filter(function (ymd) { return !selectedTrial[ymd] && trialOwned[ymd]; });
    var socialKeep = ctx.dates.filter(function (ymd) { return selectedSocialOutdoor[ymd]; });
    var socialDel = ctx.dates.filter(function (ymd) { return !selectedSocialOutdoor[ymd] && socialOutdoorOwned[ymd]; });
    var scrimmageKeep = ctx.dates.filter(function (ymd) { return selectedSocialScrimmage[ymd]; });
    var scrimmageDel = ctx.dates.filter(function (ymd) { return !selectedSocialScrimmage[ymd] && socialScrimmageOwned[ymd]; });
    var meetingKeep = ctx.dates.filter(function (ymd) { return selectedSocialRegularMeeting[ymd]; });
    var meetingDel = ctx.dates.filter(function (ymd) { return !selectedSocialRegularMeeting[ymd] && socialRegularMeetingOwned[ymd]; });
    if (!toAdd.length && !toDel.length && !trialKeep.length && !trialDel.length
            && !socialKeep.length && !socialDel.length
            && !scrimmageKeep.length && !scrimmageDel.length
            && !meetingKeep.length && !meetingDel.length) {
        App.Modal.close('weekday-closure-picker-modal');
        return;
    }
    App._weekdayClosureBusy = true;
    try {
        var jobs = toAdd.map(function (ymd) {
            return App.api.put('/branch-closures', { group: ctx.group, closureDate: ymd });
        }).concat(toDel.map(function (ymd) {
            return App.api.delete(
                '/branch-closures/' + encodeURIComponent(ctx.group) + '/' + encodeURIComponent(ymd)
            );
        })).concat(trialKeep.map(function (ymd) {
            return App.api.put('/youth-trial-days', {
                trialDate: ymd,
                timeText: trialMeta.timeText,
                branch: trialMeta.branch || null,
                coachId: trialMeta.coachId
            });
        })).concat(trialDel.map(function (ymd) {
            return App.api.delete('/youth-trial-days/' + encodeURIComponent(ymd));
        })).concat(socialKeep.map(function (ymd) {
            return App.api.put('/social-outdoor-days', {
                outdoorDate: ymd,
                timeText: outdoorMeta.timeText,
                branch: outdoorMeta.branch || null,
                place: outdoorMeta.place || null,
                coachId: outdoorMeta.coachId
            });
        })).concat(socialDel.map(function (ymd) {
            return App.api.delete('/social-outdoor-days/' + encodeURIComponent(ymd));
        })).concat(scrimmageKeep.map(function (ymd) {
            return App.api.put('/social-scrimmage-days', {
                scrimmageDate: ymd,
                timeText: scrimmageMeta.timeText,
                branch: scrimmageMeta.branch || null,
                place: scrimmageMeta.place || null,
                coachId: scrimmageMeta.coachId
            });
        })).concat(scrimmageDel.map(function (ymd) {
            return App.api.delete('/social-scrimmage-days/' + encodeURIComponent(ymd));
        })).concat(meetingKeep.map(function (ymd) {
            return App.api.put('/social-regular-meeting-days', {
                meetingDate: ymd,
                timeText: meetingMeta.timeText,
                branch: meetingMeta.branch || null,
                coachId: meetingMeta.coachId
            });
        })).concat(meetingDel.map(function (ymd) {
            return App.api.delete('/social-regular-meeting-days/' + encodeURIComponent(ymd));
        }));
        await Promise.all(jobs);
        var parts = [];
        if (trialKeep.length || trialDel.length) {
            parts.push('유소년 체험 ' + (trialKeep.length + trialDel.length) + '일');
        }
        if (socialKeep.length || socialDel.length) {
            parts.push('사회인 야외 ' + (socialKeep.length + socialDel.length) + '일');
        }
        if (scrimmageKeep.length || scrimmageDel.length) {
            parts.push('청·백전 ' + (scrimmageKeep.length + scrimmageDel.length) + '일');
        }
        if (meetingKeep.length || meetingDel.length) {
            parts.push('사회인 정회원 모임 ' + (meetingKeep.length + meetingDel.length) + '일');
        }
        if (toAdd.length || toDel.length) {
            parts.push(ctx.label + ' 휴무 ' + (toAdd.length + toDel.length) + '일');
        }
        if (App.showNotification) {
            App.showNotification(
                ctx.weekdayName + '요일 일정을 저장했습니다. (' + parts.join(' · ') + ')',
                'success'
            );
        }
        App.Modal.close('weekday-closure-picker-modal');
        if (typeof ctx.onChanged === 'function') await ctx.onChanged();
    } catch (e) {
        App.err('요일 일정 저장 실패:', e);
        var err = '일정 저장에 실패했습니다.';
        if (e && e.response && e.response.data && e.response.data.error) err = e.response.data.error;
        if (App.showNotification) App.showNotification(err, 'danger');
    } finally {
        App._weekdayClosureBusy = false;
    }
};

/**
 * 이용권 잔여 "표시용" 숫자 — 회원목록·상세·대시보드·예약 등 동일 규칙.
 * - USED_UP → 0
 * - remainingCount가 null/undefined가 아니면 그대로(0 포함)
 * - 없으면 product.usageCount → mp.totalCount 순
 * @param {object} mp - { remainingCount, totalCount, status, product?: { usageCount } }
 * @param {object} [opt]
 * @param {'null'|'zero'|'ten'} [opt.whenAllUnknown='null'] - 위 값이 모두 없을 때
 */
App.resolveDisplayRemainingCount = function(mp, opt) {
    opt = opt || {};
    const whenAll = opt.whenAllUnknown != null ? opt.whenAllUnknown : 'null';
    if (!mp || typeof mp !== 'object') {
        if (whenAll === 'ten') return 10;
        if (whenAll === 'zero') return 0;
        return null;
    }
    const rc = mp.remainingCount;
    if (rc !== null && rc !== undefined && rc !== '') return Number(rc);
    const st = mp.status || 'ACTIVE';
    if (st === 'USED_UP' || st === 'EXPIRED') return 0;
    const product = mp.product || {};
    const uc = product.usageCount;
    if (uc !== null && uc !== undefined) return Number(uc);
    const tc = mp.totalCount;
    if (tc !== null && tc !== undefined) return Number(tc);
    if (whenAll === 'ten') return 10;
    if (whenAll === 'zero') return 0;
    return null;
};

App.assertMemberPassForSave = function(opts) {
    opts = opts || {};
    if (!opts.isMember) return null;
    var id = opts.memberProductId;
    if (id == null || String(id).trim() === '' || String(id).trim().toLowerCase() === 'null') {
        return '이용권을 확인해 주세요.';
    }
    var total = parseInt(opts.totalCount, 10);
    if (!isNaN(total) && total >= 999) return null;
    var type = opts.productType;
    var rem = parseInt(opts.remainingCount, 10);
    if (isNaN(rem)) rem = 0;
    if (type === 'COUNT_PASS') {
        if (opts.isCopy && rem < 2) {
            return '복사는 이용권 잔여 횟수가 2회 이상이어야 합니다.';
        }
            if (opts.isNew && rem <= 0) {
                return '선택한 횟수권의 잔여 횟수가 없습니다.';
            }
            var occupied = parseInt(opts.occupiedHoldCount, 10);
            if (!isNaN(occupied) && rem < occupied + 1) {
                return '이미 잡혀 있는 예약을 포함하면 횟수권 잔여 횟수를 초과합니다.';
            }
    }
    return null;
};

App.bookingMissingMemberProduct = function(booking) {
    if (!booking) return false;
    var hasMember = booking.member && (booking.member.id != null || booking.member.memberNumber);
    if (!hasMember) return false;
    var mp = booking.memberProduct;
    if (!mp || mp.id == null) return true;
    if (mp.deletedAt) return true;
    return false;
};

App.bookingNeedsPassAlert = function(booking) {
    if (typeof App.bookingMissingMemberProduct === 'function' && App.bookingMissingMemberProduct(booking)) {
        return 'missing';
    }
    if (booking && booking.countPassFullyHeld) {
        return 'held';
    }
    return null;
};

App.bookingMissingPassRowAttr = function(booking) {
    var kind = typeof App.bookingNeedsPassAlert === 'function' ? App.bookingNeedsPassAlert(booking) : null;
    if (!kind) return '';
    var title = kind === 'held'
        ? '횟수권 잔여가 부족합니다. 가까운 날짜부터 잔여가 채워집니다.'
        : '이용권이 삭제되었거나 전액 환불되어 연결이 해제된 예약입니다.';
    return ' class="booking-missing-pass" title="' + title + '"';
};

App.applyMissingPassCalendarStyle = function(eventEl, booking) {
    if (!eventEl || typeof App.bookingNeedsPassAlert !== 'function') return;
    var kind = App.bookingNeedsPassAlert(booking);
    if (!kind) return;
    eventEl.classList.add('booking-missing-pass');
    eventEl.style.backgroundColor = '#E74C3C';
    eventEl.style.borderLeft = '3px solid #c0392b';
    eventEl.style.color = '#fff';
    var hint = kind === 'held'
        ? '횟수권 잔여가 부족합니다. 가까운 날짜부터 잔여가 채워집니다.'
        : '이용권이 삭제되었거나 전액 환불되어 연결이 해제된 예약입니다.';
    eventEl.title = eventEl.title ? (eventEl.title + ' · ' + hint) : hint;
};

App.syncAuthCookie = function(token) {
    try {
        if (token) {
            document.cookie = 'afbs_auth=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';
        } else {
            document.cookie = 'afbs_auth=; path=/; max-age=0; SameSite=Lax';
        }
    } catch (e) { /* ignore */ }
};

// 인증 토큰 관리
App.setAuthToken = function(token) {
    this.authToken = token;
    if (token) {
        localStorage.setItem('authToken', token);
        this.syncAuthCookie(token);
    } else {
        localStorage.removeItem('authToken');
        this.syncAuthCookie(null);
    }
};

App.getAuthToken = function() {
    if (!this.authToken) {
        this.authToken = localStorage.getItem('authToken');
    }
    return this.authToken;
};

App.clearAuth = function() {
    this.authToken = null;
    this.currentUser = null;
    this.currentRole = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.syncAuthCookie(null);
    // 로그인·공개 페이지에서는 리다이렉트하지 않음 (401 프리로드 등으로 무한 새로고침 방지)
    if (!isLoginPagePath()) {
        window.location.href = '/login.html';
    }
};

App.isAuthenticated = function() {
    return !!this.getAuthToken();
};

// 로그인·회원 공개 예약 등 인증 리다이렉트/경고에서 제외할 페이지
function isLoginPagePath() {
    var p = (window.location.pathname || '').toLowerCase();
    if (p.indexOf('login') !== -1) return true;
    if (p === '/member-booking.html' || p.endsWith('/member-booking.html')) return true;
    if (p === '/rankings.html' || p.endsWith('/rankings.html')) return true;
    return false;
}

// 페이지 로드 시 인증 정보 복원
// ※ 갑자기 로그인 문제: JWT 만료(401), localStorage 삭제(시크릿/다른 기기), 다른 브라우저 접속 등
App.restoreAuth = function() {
    var onLoginPage = isLoginPagePath();
    var token = this.getAuthToken();

    if (token) {
        this.syncAuthCookie(token);
        var userStr = localStorage.getItem('currentUser');
        if (!onLoginPage) App.log('인증 정보 복원 시도, 토큰 존재:', true);
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                this.currentRole = this.currentUser.role;
                if (!onLoginPage) App.log('인증 정보 복원 성공:', this.currentUser.username);
                this.updateUserDisplay();
            } catch (e) {
                App.err('사용자 정보 복원 실패:', e);
                this.clearAuth();
            }
        } else {
            App.warn('토큰은 있으나 사용자 정보가 없습니다. 다시 로그인해 주세요.');
            this.clearAuth();
        }
    } else {
        if (!onLoginPage) App.warn('인증 토큰이 localStorage에 없습니다.');
    }
};

// 인증 헤더 가져오기
App.getAuthHeaders = function() {
    var headers = { 'ngrok-skip-browser-warning': 'true' };
    var token = this.getAuthToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
        if (App.debug) App.log('인증 헤더 추가됨');
    } else if (!isLoginPagePath()) {
        App.warn('인증 토큰이 없습니다.');
    }
    return headers;
};

// 401 발생 시 공통 처리: 인증 제거, 알림, 로그인 페이지로 이동
App.handle401 = function() {
    // 이미 로그인/공개 페이지면 토큰만 정리하고 리다이렉트·알림 생략 (무한 새로고침 방지)
    if (isLoginPagePath()) {
        this.authToken = null;
        this.currentUser = null;
        this.currentRole = null;
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            this.syncAuthCookie(null);
        } catch (e) { /* ignore */ }
        return;
    }
    App.clearAuth();
    if (typeof App.showNotification === 'function') {
        App.showNotification('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', 'info');
    }
    setTimeout(function() {
        if (!isLoginPagePath()) {
            window.location.href = '/login.html';
        }
    }, 600);
};

// 권한 데이터 캐시
App.rolePermissions = null;

// 권한 데이터 로드
App.loadRolePermissions = async function() {
    try {
        const response = await this.api.get('/role-permissions');
        this.rolePermissions = response.permissions || {};
        App.log('권한 데이터 로드 완료:', this.rolePermissions);
        return this.rolePermissions;
    } catch (error) {
        App.warn('권한 데이터 로드 실패, 기본 역할 계층 사용:', error);
        this.rolePermissions = null;
        return null;
    }
};

// 세부 권한 체크
App.hasDetailPermission = function(permissionKey) {
    if (!App.currentRole || !App.rolePermissions) {
        return false;
    }
    
    const role = App.currentRole.toUpperCase();
    const rolePermission = App.rolePermissions[role];
    
    if (!rolePermission) {
        return false;
    }
    
    // 권한 키가 있으면 해당 권한 반환, 없으면 false
    return rolePermission[permissionKey] === true;
};

// 권한 체크 (역할 계층 또는 세부 권한)
App.hasPermission = function(requiredRole, permissionKey) {
    if (!App.currentRole) {
        App.warn('권한 체크 실패: currentRole이 없습니다');
        return false;
    }
    
    // 세부 권한이 지정된 경우 세부 권한 체크
    if (permissionKey) {
        return App.hasDetailPermission(permissionKey);
    }
    
    // 역할 계층 체크 (기존 로직)
    const roleHierarchy = {
        'FRONT': 1,
        'COACH': 2,
        'MANAGER': 3,
        'ADMIN': 4
    };
    
    const currentRoleUpper = App.currentRole.toUpperCase();
    const requiredRoleUpper = requiredRole ? requiredRole.toUpperCase() : '';
    
    // data-role 속성 매핑 (프론트엔드에서 사용하는 값)
    const roleMapping = {
        'FRONT': 'FRONT',
        'COACH': 'COACH',
        'MANAGER': 'MANAGER',
        'ADMIN': 'ADMIN',
        'Front': 'FRONT',
        'Coach': 'COACH',
        'Manager': 'MANAGER',
        'Admin': 'ADMIN'
    };
    
    const mappedCurrentRole = roleMapping[currentRoleUpper] || currentRoleUpper;
    const mappedRequiredRole = roleMapping[requiredRoleUpper] || requiredRoleUpper;
    
    const currentLevel = roleHierarchy[mappedCurrentRole] || 0;
    const requiredLevel = roleHierarchy[mappedRequiredRole] || 0;
    
    const hasPermission = currentLevel >= requiredLevel;
    
    return hasPermission;
};

// 메뉴-권한 매핑 (메뉴 URL과 필요한 권한)
// 야구와 야구(유소년)는 공유 메뉴가 아닌 별도 메뉴임 (동일 권한 bookingView 사용)
const menuPermissionMap = {
    '/': 'dashboardView', // 대시보드
    '/index.html': 'dashboardView',
    '/members.html': 'memberView',
    '/coaches.html': 'coachView',
    '/bookings.html': 'bookingView',           // 야구 (사하/연산 각각 별도 페이지)
    '/bookings-saha-youth.html': 'bookingView', // 야구(유소년) 사하점 - 별도 메뉴
    '/bookings-saha-social.html': 'bookingView', // 야구(사회인) 사하점 - 별도 메뉴
    '/bookings-saha-training.html': 'bookingView',
    '/bookings-saha-pilates.html': 'bookingView',
    '/bookings-yeonsan.html': 'bookingView',   // 야구 연산점
    '/bookings-yeonsan-youth.html': 'bookingView', // 야구(유소년) 연산점 - 별도 메뉴
    '/bookings-yeonsan-social.html': 'bookingView', // 야구(사회인) 연산점 - 별도 메뉴
    '/bookings-yeonsan-training.html': 'bookingView',
    '/rentals.html': 'bookingView',
    '/attendance.html': 'attendanceView',
    '/training-logs.html': 'trainingLogView',
    '/rankings.html': 'trainingLogView',
    '/training-stats.html': 'trainingLogView',
    '/products.html': 'productView',
    '/payments.html': 'paymentView',
    '/facilities.html': 'settingsView',
    '/analytics.html': 'analyticsView',
    '/announcements.html': 'announcementView',
    '/users.html': 'userView',
    '/permissions.html': 'userView', // 권한 관리도 사용자 관리 권한 필요
    '/settings.html': 'settingsView',
    '/coach-home.html': 'memberView'
};

/** 코치: 현재 예약 페이지(BOOKING_PAGE_CONFIG)에서 회원 실명을 표시할지 — 소속 캘린더만 true */
App._coachCalendarNameVisible = undefined;

/**
 * 코치 로그인 시 예약 캘린더·목록에서 회원 실명 표시 여부.
 * - 일반 코치: 항상 숨김(시간·코치만 — GET /bookings 에서도 비식별 처리).
 * - 운영형 코치(서정훈/서정민 등, 서버 operationalCoachView·이름 매칭): 실명 표시.
 */
App.refreshCoachBookingNameVisibilityCache = async function() {
    App._coachCalendarNameVisible = undefined;
    if ((App.currentRole || '').toUpperCase() !== 'COACH') {
        App._coachCalendarNameVisible = true;
        return true;
    }
    if (typeof App.isOperationalCoachViewer === 'function' && App.isOperationalCoachViewer()) {
        App._coachCalendarNameVisible = true;
        return true;
    }
    App._coachCalendarNameVisible = false;
    return false;
};

App.shouldShowMemberNameOnBookingCalendar = function() {
    if ((App.currentRole || '').toUpperCase() !== 'COACH') return true;
    return App._coachCalendarNameVisible === true;
};

App.PAST_MIDNIGHT_BOOKING_LOCK_MSG = '자정이 지난 예약은 관리자만 수정하거나 삭제할 수 있습니다.';

App.isAdminRole = function() {
    return String(App.currentRole || (App.currentUser && App.currentUser.role) || '').toUpperCase() === 'ADMIN';
};

App.bookingDayHasPassedMidnight = function(startTime) {
    if (!startTime) return false;
    var d = startTime instanceof Date ? startTime : new Date(startTime);
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    var startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return startDay < today;
};

App.isPastMidnightBookingLocked = function(booking) {
    if (App.isAdminRole()) return false;
    if (!booking) return false;
    if (String(booking.status || '').toUpperCase() === 'PENDING') return false;
    return App.bookingDayHasPassedMidnight(booking.startTime);
};

App.applyPastMidnightBookingLock = function(booking, options) {
    options = options || {};
    var modal = document.getElementById(options.modalId || 'booking-modal');
    if (!modal) return false;
    var locked = !!(booking && App.isPastMidnightBookingLocked(booking));
    var note = modal.querySelector('.past-midnight-booking-lock-note');
    if (!note) {
        note = document.createElement('div');
        note.className = 'past-midnight-booking-lock-note';
        note.style.cssText = 'margin:0 0 12px;padding:10px 12px;border-radius:8px;background:rgba(231,76,60,0.12);color:var(--text-primary);font-size:13px;line-height:1.4;';
        var body = modal.querySelector('.modal-body');
        if (body) {
            body.insertBefore(note, body.firstChild);
        } else {
            modal.appendChild(note);
        }
    }
    note.textContent = App.PAST_MIDNIGHT_BOOKING_LOCK_MSG;
    note.style.display = locked ? 'block' : 'none';
    var deleteBtn = document.getElementById(options.deleteBtnId || 'booking-delete-btn');
    var saveBtn = modal.querySelector('.modal-footer .btn-primary');
    if (deleteBtn) {
        if (locked) {
            deleteBtn.style.display = 'none';
        } else if (booking && (booking.id != null || deleteBtn.getAttribute('data-booking-id'))) {
            deleteBtn.style.display = 'block';
        }
    }
    if (saveBtn) {
        saveBtn.style.display = locked ? 'none' : '';
    }
    return locked;
};

/**
 * 캘린더 예약 모달의 담당 코치 선택.
 * 관리자(ADMIN)는 항상 변경 가능.
 * 필라테스 코치는 트레이닝·필라테스 캘린더에서 미지정 비회원 필라테스 예약의 담당만 지정할 수 있다.
 */
App._bookingModalCoachPolicyBooking = null;

App.isCurrentUserPilatesCoach = function() {
    var u = App.currentUser || {};
    var fake = {
        name: u.linkedCoachName || u.name || '',
        specialties: u.linkedCoachSpecialties || ''
    };
    return typeof App.categorizeCoachBySubject === 'function'
        && App.categorizeCoachBySubject(fake) === 'PILATES';
};

/** 운영 계정 afsh: 대소문자 무시. JWT sub 도 확인. */
App.getLoginUsername = function() {
    var u = App.currentUser || {};
    var fromUser = String(u.username || u.userName || u.loginId || '').trim();
    if (fromUser) {
        return fromUser;
    }
    try {
        var token = typeof App.getAuthToken === 'function' ? App.getAuthToken() : '';
        if (!token) {
            return '';
        }
        var payload = token.split('.')[1];
        if (!payload) {
            return '';
        }
        var json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return String(json.sub || json.username || '').trim();
    } catch (e) {
        return '';
    }
};

App.isAfshUser = function() {
    return App.getLoginUsername().toLowerCase() === 'afsh';
};

/** 관리자처럼 상단 코치 홈 버튼을 쓰는 운영 아이디 */
App.isCoachHomeOperator = function() {
    var u = App.currentUser || {};
    if (u.coachHomeOperator === true) {
        return true;
    }
    return App.getLoginUsername().toLowerCase() === 'xorhko12';
};

/** 수기 수익 정산표. 관리자 또는 xorho12 / xorhko12 */
App.canSeeProfitSheet = function() {
    var u = App.currentUser || {};
    if (u.profitSheetAllowed === true) {
        return true;
    }
    var role = String((u.role || App.currentRole || '')).toUpperCase();
    if (role === 'ADMIN') {
        return true;
    }
    var name = App.getLoginUsername().toLowerCase();
    return name === 'xorho12' || name === 'xorhko12';
};

App.canPilatesCoachAssignUnassignedCoach = function(booking) {
    if ((App.currentRole || (App.currentUser && App.currentUser.role) || '').toUpperCase() === 'ADMIN') {
        return false;
    }
    var cfg = window.BOOKING_PAGE_CONFIG || {};
    if (cfg.facilityType !== 'TRAINING_FITNESS') {
        return false;
    }
    var pilatesCoach = typeof App.isCurrentUserPilatesCoach === 'function' && App.isCurrentUserPilatesCoach();
    var afsh = typeof App.isAfshUser === 'function' && App.isAfshUser();
    var operational = typeof App.isOperationalCoachViewer === 'function' && App.isOperationalCoachViewer();
    if (!pilatesCoach && !afsh && !operational) {
        return false;
    }
    if (booking && booking.member && booking.member.id) {
        return false;
    }
    var cat = booking ? booking.lessonCategory : '';
    if (cat && typeof cat === 'object') {
        cat = cat.name || cat;
    }
    cat = String(cat || '').toUpperCase();
    if (cat === 'BASEBALL' || cat === 'YOUTH_BASEBALL') {
        return false;
    }
    return true;
};

App.isOutdoorLessonPlaceholderCoach = function(coachOrName) {
    var name = '';
    if (!coachOrName) return false;
    if (typeof coachOrName === 'string') name = coachOrName;
    else name = coachOrName.name || coachOrName.textContent || '';
    name = String(name).replace(/\s*\[[^\]]*\]\s*/g, '').replace(/\s+/g, '');
    return name.indexOf('야외레슨') !== -1;
};

App.bookingFormBlocksOutdoorLessonPlaceholder = function() {
    var pass = document.getElementById('booking-member-product');
    var hasPass = !!(pass && String(pass.value || '').trim());
    var hasCardCoach = !!window._selectedMemberCardCoachId;
    return hasPass || hasCardCoach;
};

App.applyOutdoorLessonPlaceholderCoachFilter = function() {
    var select = document.getElementById('booking-coach');
    if (!select || typeof App.isOutdoorLessonPlaceholderCoach !== 'function') return;
    if (!App.bookingFormBlocksOutdoorLessonPlaceholder()) return;
    var current = String(select.value || '');
    var toRemove = [];
    var currentWasPlaceholder = false;
    Array.from(select.options).forEach(function (opt) {
        if (!opt.value) return;
        if (!App.isOutdoorLessonPlaceholderCoach(opt.textContent)) return;
        if (String(opt.value) === current) currentWasPlaceholder = true;
        toRemove.push(opt);
    });
    toRemove.forEach(function (opt) { opt.remove(); });
    if (currentWasPlaceholder) select.value = '';
};

App.outdoorLessonCalendarColor = function() {
    if (App.CoachColors && typeof App.CoachColors.getColor === 'function') {
        var hex = App.CoachColors.getColor({ name: '야외레슨' });
        if (hex) return hex;
    }
    return '#2962FF';
};

App.isOutdoorTypedPurpose = function(purposeOrBooking) {
    var p = purposeOrBooking;
    if (p && typeof p === 'object') p = p.purpose;
    return String(p || '').toUpperCase().indexOf('OUTDOOR') !== -1;
};

App.calendarColorForBooking = function(booking, coach) {
    if (App.isOutdoorTypedPurpose(booking)) {
        return App.outdoorLessonCalendarColor();
    }
    if (coach && App.CoachColors && typeof App.CoachColors.getColor === 'function') {
        return App.CoachColors.getColor(coach);
    }
    return null;
};

App.applyBookingCoachEditPolicy = function(booking) {
    if (arguments.length > 0) {
        App._bookingModalCoachPolicyBooking = booking || null;
    } else {
        booking = App._bookingModalCoachPolicyBooking || null;
    }
    var role = String(App.currentRole || (App.currentUser && App.currentUser.role) || '').toUpperCase();
    var isAdmin = role === 'ADMIN';
    var pilatesAssign = !isAdmin && typeof App.canPilatesCoachAssignUnassignedCoach === 'function'
        && App.canPilatesCoachAssignUnassignedCoach(booking);
    var canEdit = isAdmin || pilatesAssign;
    var hint = '담당 코치 변경은 관리자만 가능합니다.';
    if (pilatesAssign) {
        hint = '비회원 예약의 담당 코치를 지정할 수 있습니다.';
    } else if (isAdmin) {
        hint = '';
    }
    ['booking-coach', 'booking-coach-nonmember'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) {
            return;
        }
        if (canEdit) {
            el.disabled = false;
            el.removeAttribute('disabled');
        } else {
            el.disabled = true;
        }
        el.title = hint;
    });
    var grp = document.getElementById('coach-group');
    if (grp) {
        grp.classList.toggle('booking-coach-readonly', !canEdit);
    }
};

/** 예약 한 건 기준 표시용 이름 (코치·타 캘린더일 때 마스킹) — 회원은 빈 문자열(달력에서는 시간만), 비회원만 '비회원' */
App.formatBookingMemberDisplayName = function(booking) {
    if (!booking || typeof booking !== 'object') return '';
    var raw = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
    var isNonMember = !booking.member || !booking.member.id || (booking.nonMemberName && String(booking.nonMemberName).trim() !== '');
    if (typeof App.shouldShowMemberNameOnBookingCalendar === 'function' && !App.shouldShowMemberNameOnBookingCalendar()) {
        if (isNonMember) return '비회원';
        return '';
    }
    return raw;
};

/** 코치: 연동된 계정이면 전용 홈, 아니면 담당 회원·예약·훈련 중 허용된 첫 화면 */
App.coachHomePath = '/coach-home.html';
App.hasLinkedCoach = function() {
    return !!(App.currentUser && App.currentUser.linkedCoachId);
};
App.coachAccessibleFallbackPath = function() {
    if (App.hasLinkedCoach()) return App.coachHomePath;
    if (App.hasDetailPermission('memberView')) return '/members.html';
    if (App.hasDetailPermission('bookingView')) return '/bookings.html';
    if (App.hasDetailPermission('trainingLogView')) return '/training-logs.html';
    return '/login.html';
};

/**
 * 코치 계정이 세부 권한 없는 페이지(URL 직접 입력 등)로 들어온 경우 허용 화면으로 이동
 */
App.enforceCoachPageAccess = async function() {
    if ((App.currentRole || '').toUpperCase() !== 'COACH') return;
    var p = window.location.pathname || '';
    var norm = p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
    if (norm === '/coach-home.html' || p.endsWith('/coach-home.html')) {
        return;
    }
    if (norm === '/bookings-without-product.html' || p.endsWith('/bookings-without-product.html')) {
        window.location.replace(App.coachAccessibleFallbackPath());
        return;
    }
    var key = menuPermissionMap[norm];
    if ((norm === '/' || norm === '') && menuPermissionMap['/']) {
        key = menuPermissionMap['/'];
    }
    if (!key && (norm.indexOf('bookings') !== -1 || p.indexOf('bookings') !== -1) && norm.indexOf('without-product') === -1 && p.indexOf('without-product') === -1) {
        key = 'bookingView';
    }
    if (!key) return;
    if (!App.hasDetailPermission(key)) {
        window.location.replace(App.coachAccessibleFallbackPath());
    }
};

// 메뉴 필터링 (권한 기반)
App.filterMenuByRole = async function() {
    App.log('메뉴 필터링 시작, 현재 권한:', App.currentRole);
    
    // 권한 데이터가 없으면 로드 시도
    if (!App.rolePermissions) {
        await App.loadRolePermissions();
    }
    
    // menu-section의 data-role 처리
    const menuSections = document.querySelectorAll('.menu-section[data-role]');
    menuSections.forEach(section => {
        const requiredRole = section.getAttribute('data-role');
        const hasPermission = App.hasPermission(requiredRole);
        if (!hasPermission) {
            section.style.display = 'none';
        } else {
            section.style.display = ''; // 권한이 있으면 표시
        }
    });
    
    // menu-item의 data-role 및 data-permission 처리
    const menuItems = document.querySelectorAll('.menu-item[data-role]');
    menuItems.forEach(item => {
        const requiredRole = item.getAttribute('data-role');
        const permissionKey = item.getAttribute('data-permission');
        let href = item.getAttribute('href') || '';
        // href 정규화: 풀 URL이면 pathname만 사용, 상대경로면 앞에 / 붙임 (매핑 일치용)
        const path = href.startsWith('http') ? (function(u) { try { return new URL(u).pathname; } catch (_) { return href; } })(href) : (href.startsWith('/') ? href : '/' + href);
        
        let hasPermission = false;
        
        // 권한 데이터가 있는 경우에만 세부 권한 체크
        if (App.rolePermissions) {
            // 세부 권한이 지정된 경우 세부 권한 체크
            if (permissionKey) {
                hasPermission = App.hasPermission(requiredRole, permissionKey);
            } 
            // 스크린샷 발췌: 관리자(Admin)만 노출
            else if (path === '/screenshot-export.html' || path === '/staff-attendance.html') {
                hasPermission = (App.currentRole || '').toUpperCase() === 'ADMIN';
            }
            // href 기반으로 권한 매핑 확인 (정규화된 path 사용)
            else if (path && menuPermissionMap[path]) {
                const requiredPermission = menuPermissionMap[path];
                hasPermission = App.hasPermission(requiredRole, requiredPermission);
            }
            // 예약 관련 path(youth 포함)는 bookingView와 동일하게 처리하여 유소년 메뉴가 항상 야구와 함께 표시되도록
            else if (path && (path.includes('bookings') && path.includes('youth'))) {
                hasPermission = App.hasPermission(requiredRole, 'bookingView');
            }
            // 기본 역할 계층 체크
            else {
                hasPermission = App.hasPermission(requiredRole);
            }
        } else {
            // 권한 데이터가 없으면 기본 역할 계층만 체크
            hasPermission = App.hasPermission(requiredRole);
        }
        
        if (!hasPermission) {
            item.style.display = 'none';
            item.style.pointerEvents = 'none'; // 클릭 비활성화
            item.style.opacity = '0.5'; // 시각적 표시
        } else {
            item.style.display = '';
            item.style.pointerEvents = '';
            item.style.opacity = '';
        }
    });
    
    App.log('메뉴 필터링 완료');
    if (typeof App.ensureCoachHomeMenuItem === 'function') {
        App.ensureCoachHomeMenuItem();
    }
};

App.ensureCoachHomeMenuItem = function() {
    if ((App.currentRole || '').toUpperCase() !== 'COACH' || !App.hasLinkedCoach()) return;
    var path = window.location.pathname || '';
    if (path === '/coach-home.html' || path.endsWith('/coach-home.html')) return;
    var nav = document.querySelector('.sidebar-menu');
    if (!nav || document.getElementById('coach-home-menu-item')) return;
    var section = document.createElement('div');
    section.className = 'menu-section';
    section.id = 'coach-home-menu-section';
    section.innerHTML = '<div class="menu-section-title">코치 전용</div>'
        + '<a href="/coach-home.html" class="menu-item" id="coach-home-menu-item">'
        + '<span class="menu-item-icon">🏠</span><span>코치 홈</span></a>';
    nav.insertBefore(section, nav.firstChild);
};

// API 호출 헬퍼
// options.deskInboxUnlock === true 이면 sessionStorage의 deskInboxUnlockToken을 X-Desk-Inbox-Unlock 헤더로 전송
// options.deskThreadUnlockMemberId === 회원 id 이면 deskThreadUnlock_{id} 토큰을 X-Desk-Thread-Unlock 로 전송
function applyDeskThreadUnlockHeader(headers, options) {
    if (!options || options.deskThreadUnlockMemberId == null) return;
    var mid = options.deskThreadUnlockMemberId;
    var t = sessionStorage.getItem('deskThreadUnlock_' + mid);
    if (t) headers['X-Desk-Thread-Unlock'] = t;
}
/**
 * 운영 코치 뷰(사용자 모달 담당 코치 체크, viewCoachIds 붙임).
 * 1) 서버 플래그(로그인·GET /auth/me) 우선
 * 2) 구 localStorage·users.name 미동기 시: 표시명이 서정훈(역할 접미사 제거)이면 표시 — 서버 OperationalCoachViewService 와 동일 취지
 */
App.isOperationalCoachViewer = function() {
    var u = App.currentUser;
    if (!u || String(u.role || '').toUpperCase() !== 'COACH') {
        return false;
    }
    if (u.operationalCoachView === true) {
        return true;
    }
    var n = (u.name || '').trim();
    var base = n.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    return n === '서정훈' || base === '서정훈' || n === '서정민' || base === '서정민';
};

/** 서버와 operationalCoachView 동기화 — 오래된 localStorage 복원 시 필수 */
App.syncOperationalCoachViewFromServer = async function() {
    try {
        var data = await App.api.get('/auth/me');
        if (!data || !App.currentUser) {
            return;
        }
        App.currentUser.operationalCoachView = data.operationalCoachView === true;
        App.currentUser.coachHomeOperator = data.coachHomeOperator === true;
        if (data.linkedCoachId) {
            App.currentUser.linkedCoachId = data.linkedCoachId;
            App.currentUser.linkedCoachName = data.linkedCoachName || null;
            App.currentUser.linkedCoachSpecialties = data.linkedCoachSpecialties || null;
        } else {
            App.currentUser.linkedCoachId = null;
            App.currentUser.linkedCoachName = null;
            App.currentUser.linkedCoachSpecialties = null;
        }
        try {
            localStorage.setItem('currentUser', JSON.stringify(App.currentUser));
        } catch (e) {}
        try {
            document.dispatchEvent(new CustomEvent('afbs-operational-coach-flag-synced'));
        } catch (e2) {}
    } catch (err) {
        App.warn('운영 코치 여부 동기화 실패:', err);
    }
};

App.OPERATIONAL_VIEW_COACH_IDS_KEY = 'afbs_operational_view_coach_ids';

App.appendViewCoachIdsToUrl = function(url) {
    if (typeof url !== 'string') {
        return url;
    }
    var membersPath = url.indexOf('/members') === 0;
    var bookingsPath = url.indexOf('/bookings') === 0;
    if (!membersPath && !bookingsPath) {
        return url;
    }
    if (url.startsWith('/members/stats')) {
        return url;
    }
    if (url.indexOf('/member-products') === 0 || url.indexOf('/memberships') === 0) {
        return url;
    }
    if (url.startsWith('/bookings/non-members')) {
        return url;
    }
    // 모달에서 선택한 코치 id는 sessionStorage에만 의존. localStorage 역할 문자열과 JWT 불일치 시 COACH만 보던 기존 로직 때문에 viewCoachIds가 빠지는 문제가 있었음 → 붙이기만 하고, 실제 필터는 서버가 COACH 요청에만 적용
    if (url.indexOf('viewCoachIds=') !== -1) {
        return url;
    }
    var raw = sessionStorage.getItem(App.OPERATIONAL_VIEW_COACH_IDS_KEY);
    var ids = [];
    try {
        ids = raw ? JSON.parse(raw) : [];
    } catch (e) {
        ids = [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
        return url;
    }
    var compact = ids.filter(function(id) {
        return id != null && id !== '';
    }).map(function(id) {
        return String(id).trim();
    }).filter(function(s) {
        return s.length > 0;
    });
    if (compact.length === 0) {
        return url;
    }
    var q = 'viewCoachIds=' + encodeURIComponent(compact.join(','));
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + q;
};

/** 코치가 모달에서 담당 코치를 선택한 상태면 서버가 이미 viewCoachIds로 필터함. 범례(calendarFilterCoachIds)와 이중 필터되면 캘린더가 비는 문제가 생길 수 있어 구분용. */
App.isOperationalViewCoachFilterActive = function() {
    if (!App.currentUser || String(App.currentUser.role || '').toUpperCase() !== 'COACH') {
        return false;
    }
    try {
        var raw = sessionStorage.getItem(App.OPERATIONAL_VIEW_COACH_IDS_KEY);
        var ids = raw ? JSON.parse(raw) : [];
        return Array.isArray(ids) && ids.length > 0;
    } catch (e) {
        return false;
    }
};

/** 운영 모달에서 체크한 코치 id 목록(sessionStorage JSON → 정규화된 문자열 id 배열). */
App.getOperationalViewCoachIdsNormalized = function() {
    try {
        var raw = sessionStorage.getItem(App.OPERATIONAL_VIEW_COACH_IDS_KEY);
        var ids = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(ids)) {
            return [];
        }
        return ids.map(function(id) {
            return id != null ? String(id).trim() : '';
        }).filter(function(s) {
            return s.length > 0;
        });
    } catch (e2) {
        return [];
    }
};

/**
 * 일별 스케줄·보내기 코치 필터: 회원이면 담당 코치 id, 담당 없으면 예약 코치. 비회원이면 예약 코치.
 */
App.getBookingRelatedCoachIds = function(booking) {
    if (!booking) {
        return [];
    }
    var out = [];
    function push(id) {
        if (id == null || id === '') {
            return;
        }
        var k = String(id);
        var i;
        for (i = 0; i < out.length; i++) {
            if (String(out[i]) === k) {
                return;
            }
        }
        out.push(typeof id === 'number' ? id : (isNaN(Number(id)) ? id : Number(id)));
    }
    if (booking.member) {
        if (booking.member.coach && booking.member.coach.id != null) {
            push(booking.member.coach.id);
        } else if (booking.coach && booking.coach.id != null) {
            push(booking.coach.id);
        }
    } else if (booking.coach && booking.coach.id != null) {
        push(booking.coach.id);
    }
    return out;
};

App.isWorkingCoach = function(coach) {
    if (!coach || typeof coach !== 'object') {
        return false;
    }
    if (coach.active === false) {
        return false;
    }
    if (App.CoachColors && typeof App.CoachColors.isRetiredId === 'function' && App.CoachColors.isRetiredId(coach.id)) {
        return false;
    }
    return true;
};

/** 근무 중이거나, 퇴사여도 현직 코치 색과 안 비슷한 고유색이면 칸 색으로 쓴다. */
App.coachOkForCalendarColor = function(coach) {
    if (!coach || typeof coach !== 'object') {
        return false;
    }
    if (typeof App.isWorkingCoach === 'function' && App.isWorkingCoach(coach)) {
        return true;
    }
    return !!(App.CoachColors && typeof App.CoachColors.retiredColorDistinctFromWorking === 'function'
        && App.CoachColors.retiredColorDistinctFromWorking(coach));
};

/** 캘린더 칸 색: 배정 코치 → 없으면 회원 카드 담당. 퇴사 색은 현직과 안 비슷할 때만. */
App.coachForCalendarStripeColor = function(booking) {
    if (!booking) {
        return null;
    }
    if (typeof App.coachOkForCalendarColor === 'function') {
        if (App.coachOkForCalendarColor(booking.coach)) {
            return booking.coach;
        }
        if (booking.member && App.coachOkForCalendarColor(booking.member.coach)) {
            return booking.member.coach;
        }
        return null;
    }
    if (typeof App.isWorkingCoach === 'function' && App.isWorkingCoach(booking.coach)) {
        return booking.coach;
    }
    if (booking.member && typeof App.isWorkingCoach === 'function' && App.isWorkingCoach(booking.member.coach)) {
        return booking.member.coach;
    }
    return booking.coach || (booking.member && booking.member.coach) || null;
};

/**
 * 캘린더·목록 색/라벨: 기본은 예약 배정 코치 우선, 없으면 회원 카드 담당.
 * 퇴사 코치는 현직과 비슷한 색이면 미지정(또는 근무 중 카드 담당)으로 본다.
 * 현직과 안 비슷한 퇴사 고유색은 그대로 쓴다.
 * 운영 모달(viewCoachIds) 사용 시 서버는 "카드 담당 OR 예약 배정"으로 걸러 주므로,
 * 표시도 선택한 코치 id와 맞는 쪽을 우선한다. 예전에는 항상 카드 담당만 써서
 * "공인욱만 선택했는데 칸에는 다른 담당 코치"처럼 보이는 불일치가 났다.
 */
App.resolveCoachForCalendarDisplay = function(booking) {
    if (!booking) {
        return null;
    }
    var bCoach = booking.coach || null;
    var mCoach = booking.member && booking.member.coach ? booking.member.coach : null;
    if (typeof App.coachOkForCalendarColor === 'function') {
        if (!App.coachOkForCalendarColor(bCoach)) bCoach = null;
        if (!App.coachOkForCalendarColor(mCoach)) mCoach = null;
    } else if (typeof App.isWorkingCoach === 'function') {
        if (!App.isWorkingCoach(bCoach)) bCoach = null;
        if (!App.isWorkingCoach(mCoach)) mCoach = null;
    }
    if (typeof App.isOperationalViewCoachFilterActive === 'function' && App.isOperationalViewCoachFilterActive()) {
        var viewList = typeof App.getOperationalViewCoachIdsNormalized === 'function'
            ? App.getOperationalViewCoachIdsNormalized()
            : [];
        if (viewList.length > 0) {
            function inView(coach) {
                if (!coach || coach.id == null) {
                    return false;
                }
                var cid = String(coach.id);
                var i;
                for (i = 0; i < viewList.length; i++) {
                    if (viewList[i] === cid) {
                        return true;
                    }
                }
                return false;
            }
            if (inView(bCoach)) {
                return bCoach;
            }
            if (inView(mCoach)) {
                return mCoach;
            }
        }
    }
    return bCoach || mCoach || null;
};

/** 범례/통계 코치 칩 필터(Set)에 id가 포함되는지 — Set에 숫자/문자열이 섞여도 매칭 */
App.calendarCoachIdInFilterSet = function(filterSet, coachIdOrUnassigned) {
    if (!filterSet || filterSet.size === 0) {
        return true;
    }
    if (coachIdOrUnassigned === 'unassigned' || coachIdOrUnassigned == null) {
        return filterSet.has('unassigned');
    }
    try {
        var it = filterSet.values();
        var step;
        while (!(step = it.next()).done) {
            var k = step.value;
            if (k === 'unassigned') {
                continue;
            }
            if (Number(k) === Number(coachIdOrUnassigned)) {
                return true;
            }
            if (String(k) === String(coachIdOrUnassigned)) {
                return true;
            }
        }
    } catch (e2) {
        return filterSet.has(coachIdOrUnassigned);
    }
    return filterSet.has(coachIdOrUnassigned);
};

/**
 * 캘린더·목록·통계 칩 코치 필터.
 * 칸 스트라이프 색(레슨 배정 → 없으면 회원 카드 담당)과 같은 "한 명"만 본다.
 * 예전 OR(담당·배정 중 하나만 맞으면 통과)이면 서정민만 골라도 레슨이 다른 코치인 예약이 남아 다른 색이 섞여 보였음.
 */
App.bookingMatchesLegendCoachFilterSet = function(booking, filterSet) {
    if (!filterSet || filterSet.size === 0) {
        return true;
    }
    if (!booking) {
        return false;
    }
    var stripe = typeof App.coachForCalendarStripeColor === 'function'
        ? App.coachForCalendarStripeColor(booking)
        : (booking.coach && booking.coach.active !== false
            ? booking.coach
            : (booking.member && booking.member.coach && booking.member.coach.active !== false
                ? booking.member.coach
                : null));
    var stripeId = stripe && stripe.id != null ? stripe.id : null;
    if (stripeId == null) {
        return typeof App.calendarCoachIdInFilterSet === 'function'
            ? App.calendarCoachIdInFilterSet(filterSet, 'unassigned')
            : filterSet.has('unassigned');
    }
    return typeof App.calendarCoachIdInFilterSet === 'function'
        ? App.calendarCoachIdInFilterSet(filterSet, stripeId)
        : filterSet.has(stripeId);
};

/**
 * 범례·드롭다운에서 코치 id를 Set에 넣을 때 숫자/문자열이 섞이면 filterSet.has()·삭제 토글이 어긋난다.
 * 항상 숫자(또는 'unassigned')로 맞춘다.
 */
App.normalizeCalendarCoachFilterKey = function(raw) {
    if (raw === 'unassigned' || raw === null || raw === undefined || raw === '') {
        return 'unassigned';
    }
    if (String(raw).trim() === 'unassigned') {
        return 'unassigned';
    }
    var n = Number(raw);
    if (!isNaN(n) && isFinite(n)) {
        return n;
    }
    return raw;
};

/** 기존 Set 내용을 정규화(제자리). */
App.normalizeCalendarFilterCoachIdsSet = function(set) {
    if (!set || set.size === 0 || typeof App.normalizeCalendarCoachFilterKey !== 'function') {
        return;
    }
    var keys = Array.from(set).map(function(k) {
        return App.normalizeCalendarCoachFilterKey(k);
    });
    set.clear();
    keys.forEach(function(k) {
        set.add(k);
    });
};

App.refreshOperationalCoachDependentViews = function() {
    // 예전에는 여기서 calendarFilterCoachIds 를 비웠는데, 운영 코치 체크만 바꿔도 범례 필터가 통째로 풀려
    // "캘린더 필터가 안 먹는다"로 느껴짐. 서버 viewCoachIds 와 범례 이중 필터는 사용자가 범례 해제로 조정.
    try {
        document.dispatchEvent(new CustomEvent('afbs-operational-coach-filter-changed'));
    } catch (e) {}
};

/**
 * 코치 "그룹"이 코드에 여러 층으로 나뉘어 있음 (필터가 헷갈리지 않게 한곳에서 정리):
 *
 * 1) DB(코치/레슨 관리): availableBranches = 어느 지점 예약·캘린더에 올릴지. specialties + 이름 접미사([코치] 등).
 * 2) API: GET /coaches?branch=SAHA|YEONSAN|RENTAL → 지점 배정 필터.
 *    필라테스 강사(`[강사]`/필라테스)는 사하·연산 중 한 곳에만 있어도 양쪽에서 선택 가능.
 * 3) 예약 페이지 범례·예약 모달: `App.filterCoachesForBookingCalendar` 로 페이지 종목(야구/유소년/트레이닝)에 맞게 한 번 더 필터.
 * 4) 운영(서정훈) 계정 모달: `App.categorizeCoachBySubject` 로 종목별 섹션(야구/필라테스…) 표시 — 표시용 그룹.
 * 5) BOOKING_PAGE_CONFIG.allowedCoaches: 레거시. 실명 표시는 운영형 코치 여부(`App.isOperationalCoachViewer`·서버 플래그)로 통일됨.
 *
 * 조직도(org chart)와 동일 규칙: specialties·이름 기준 종목 키
 * MANAGER | RENTAL | BASEBALL | YOUTH | TRAINING | PILATES | OTHER
 */
App.categorizeCoachBySubject = function(coach) {
    var spec = ((coach && coach.specialties) ? coach.specialties : '') + ' ' + ((coach && coach.name) ? coach.name : '');
    if (/매니저|\[매니저\]/.test(spec)) {
        return 'MANAGER';
    }
    if (/대관|\[대관담당\]/.test(spec)) {
        return 'RENTAL';
    }
    if (/\[트레이너\]|트레이닝/.test(spec)) {
        return 'TRAINING';
    }
    if (/\[강사\]|필라테스/.test(spec)) {
        return 'PILATES';
    }
    if (/유소년/.test(spec)) {
        return 'YOUTH';
    }
    if (/\[대표\]|\[코치\]|\[포수코치\]|\[투수코치\]|야구|타격|투구|수비|포수|투수/.test(spec)) {
        return 'BASEBALL';
    }
    return 'OTHER';
};

/**
 * 예약 캘린더 범례·예약 등록 시 코치 드롭다운에 넣을 사람만 남김.
 * 예전에는 specialties 문자열만 봐서, 이름만 "○○ [코치]"이고 담당 종목에 '야구' 글자가 없으면 범례에서 빠지는 경우가 있었음.
 */
App.filterCoachesForBookingCalendar = function(coaches, config) {
    config = config || {};
    var list = Array.isArray(coaches)
        ? coaches.filter(function(c) {
            return c && c.active !== false;
        })
        : [];
    var lessonCategory = config.lessonCategory;
    var facilityType = config.facilityType;
    var combined = function(c) {
        return ((c.specialties || '') + ' ' + (c.name || '')).toLowerCase();
    };
    var hasToken = function(c, keys) {
        var t = combined(c);
        for (var i = 0; i < keys.length; i++) {
            if (t.indexOf(String(keys[i]).toLowerCase()) !== -1) {
                return true;
            }
        }
        return false;
    };
    if (lessonCategory === 'YOUTH_BASEBALL') {
        return list.filter(function(c) {
            return hasToken(c, ['유소년', '야구']);
        });
    }
    if (facilityType === 'BASEBALL') {
        return list.filter(function(c) {
            if (typeof App.categorizeCoachBySubject === 'function' && App.categorizeCoachBySubject(c) === 'BASEBALL') {
                return true;
            }
            return hasToken(c, ['야구', '타격', '투구', '수비', '포수', '투수', '코치', '대표', '포수코치', '투수코치', '비야구인']);
        });
    }
    if (facilityType === 'TRAINING_FITNESS') {
        return list.filter(function(c) {
            var cat = typeof App.categorizeCoachBySubject === 'function' ? App.categorizeCoachBySubject(c) : 'OTHER';
            if (lessonCategory === 'TRAINING') return cat === 'TRAINING';
            if (lessonCategory === 'PILATES') return cat === 'PILATES';
            return cat === 'TRAINING' || cat === 'PILATES';
        });
    }
    return list;
};

/** 운영 코치 필터 UI — 사용자 정보 모달의 host 요소 안에만 삽입 */
App.mountOperationalCoachFilterBar = function(hostEl) {
    if (!hostEl) {
        return;
    }
    if (typeof App.isOperationalCoachViewer !== 'function' || !App.isOperationalCoachViewer()) {
        return;
    }
    var legacyTop = document.querySelector('.user-info-container #operational-coach-filter-bar');
    if (legacyTop) {
        legacyTop.remove();
    }
    var existing = document.getElementById('operational-coach-filter-bar');
    if (existing) {
        existing.remove();
    }
    hostEl.innerHTML = '';
    var bar = document.createElement('div');
    bar.id = 'operational-coach-filter-bar';
    bar.className = 'operational-coach-filter-bar operational-coach-filter-bar--modal';
    bar.innerHTML = '<div class="ocb-loading">코치 목록 로딩…</div>';
    hostEl.appendChild(bar);

    App.api.get('/coaches').then(function(list) {
        var coaches = Array.isArray(list) ? list : [];
        coaches = coaches.filter(function(c) {
            return c && c.active !== false && c.id != null;
        });
        coaches.sort(function(a, b) {
            return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
        });
        var subjectOrder = ['MANAGER', 'RENTAL', 'BASEBALL', 'YOUTH', 'TRAINING', 'PILATES', 'OTHER'];
        var subjectLabels = {
            MANAGER: '매니저',
            RENTAL: '대관',
            BASEBALL: '야구',
            YOUTH: '유소년',
            TRAINING: '트레이닝',
            PILATES: '필라테스',
            OTHER: '기타'
        };
        var buckets = { MANAGER: [], RENTAL: [], BASEBALL: [], YOUTH: [], TRAINING: [], PILATES: [], OTHER: [] };
        coaches.forEach(function(c) {
            var k = App.categorizeCoachBySubject(c);
            if (buckets[k]) {
                buckets[k].push(c);
            } else {
                buckets.OTHER.push(c);
            }
        });
        var saved = [];
        try {
            saved = JSON.parse(sessionStorage.getItem(App.OPERATIONAL_VIEW_COACH_IDS_KEY) || '[]');
        } catch (e2) {
            saved = [];
        }
        if (!Array.isArray(saved)) {
            saved = [];
        }
        if (saved.length > 1) {
            saved = [saved[saved.length - 1]];
            try {
                sessionStorage.setItem(App.OPERATIONAL_VIEW_COACH_IDS_KEY, JSON.stringify(saved));
            } catch (eNorm) {}
        }
        var savedSet = {};
        saved.forEach(function(id) {
            savedSet[String(id)] = true;
        });

        function renderChecks(arr) {
            if (!arr.length) {
                return '<span class="ocb-empty">없음</span>';
            }
            return arr.map(function(c) {
                var cid = String(c.id);
                var checked = savedSet[cid] ? ' checked' : '';
                var label = App.escapeHtml((c.name || '').replace(/\s*\[[^\]]*\]\s*$/,'').trim() || cid);
                return '<label class="ocb-cb-label"><input type="checkbox" class="ocb-coach-cb" data-coach-id="' +
                    App.escapeHtml(cid) + '" value="' + App.escapeHtml(cid) + '"' + checked + '><span class="ocb-cb-text">' + label + '</span></label>';
            }).join('');
        }

        var sectionsHtml = '';
        subjectOrder.forEach(function(key) {
            var arr = buckets[key] || [];
            if (arr.length === 0) {
                return;
            }
            sectionsHtml +=
                '<div class="ocb-section ocb-section--subject" data-subject="' + key + '">' +
                '<div class="ocb-section-title">' + subjectLabels[key] + '</div>' +
                '<div class="ocb-chips ocb-chips--row">' + renderChecks(arr) + '</div></div>';
        });
        if (!sectionsHtml) {
            sectionsHtml = '<div class="ocb-section"><span class="ocb-empty">등록된 코치가 없습니다.</span></div>';
        }
        bar.innerHTML =
            '<p class="ocb-hint" style="margin:0 0 10px 0;font-size:12px;color:var(--text-muted);line-height:1.45;">' +
            '섹션(야구·필라테스 등)은 <strong>이름·담당 종목</strong>으로 자동 분류됩니다. 예약 목록은 체크한 코치와 연결된 건만 보입니다 ' +
            '(회원 카드 담당 또는 그날 예약 배정 코치).</p>' +
            sectionsHtml;

        function persistFromDom() {
            var boxes = bar.querySelectorAll('.ocb-coach-cb:checked');
            var ids = [];
            boxes.forEach(function(cb) {
                var v = cb.getAttribute('data-coach-id') || cb.value;
                if (v) {
                    ids.push(v);
                }
            });
            try {
                sessionStorage.setItem(App.OPERATIONAL_VIEW_COACH_IDS_KEY, JSON.stringify(ids));
            } catch (e3) {}
            App.refreshOperationalCoachDependentViews();
        }

        bar.querySelectorAll('.ocb-coach-cb').forEach(function(cb) {
            cb.addEventListener('change', function() {
                if (!cb.checked) {
                    var n = bar.querySelectorAll('.ocb-coach-cb:checked').length;
                    if (n === 0) {
                        cb.checked = true;
                        return;
                    }
                }
                if (cb.checked) {
                    bar.querySelectorAll('.ocb-coach-cb').forEach(function(other) {
                        if (other !== cb) {
                            other.checked = false;
                        }
                    });
                }
                persistFromDom();
            });
        });
    }).catch(function(err) {
        App.err('운영 코치 필터 바 로드 실패:', err);
        bar.innerHTML = '<div class="ocb-error">코치 목록을 불러오지 못했습니다.</div>';
    });
};

App.api = {
    get: async function(url, options) {
        try {
            var reqUrl = url;
            if (typeof App.appendViewCoachIdsToUrl === 'function') {
                reqUrl = App.appendViewCoachIdsToUrl(url);
            }
            const headers = App.getAuthHeaders();
            if (options && options.deskInboxUnlock) {
                var deskTok = sessionStorage.getItem('deskInboxUnlockToken');
                if (deskTok) headers['X-Desk-Inbox-Unlock'] = deskTok;
            }
            applyDeskThreadUnlockHeader(headers, options);
            const response = await fetch(`${App.apiBase}${reqUrl}`, {
                headers: headers
            });
            
            if (response.status === 401) {
                App.err('401 Unauthorized - 인증 실패');
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                App.err('API GET 오류 응답:', errorText);
                let data = errorText;
                try {
                    if (errorText && errorText.trim().startsWith('{')) data = JSON.parse(errorText);
                } catch (_) {}
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: data };
                throw error;
            }
            const json = await response.json();
            if (App.CoachColors && typeof App.CoachColors.registerFromCoaches === 'function') {
                var pathOnly = String(reqUrl || url || '').split('?')[0];
                if (pathOnly === '/coaches' || pathOnly === '/coaches/active') {
                    App.CoachColors.registerFromCoaches(json);
                } else if (/^\/coaches\/\d+$/.test(pathOnly) && json && json.color) {
                    App.CoachColors.registerFromCoaches([json]);
                }
            }
            return json;
        } catch (error) {
            App.err('API GET Error:', error);
            throw error;
        }
    },
    
    post: async function(url, data, options) {
        try {
            const headers = App.getAuthHeaders();
            headers['Content-Type'] = 'application/json';
            if (options && options.deskInboxUnlock) {
                var deskTokP = sessionStorage.getItem('deskInboxUnlockToken');
                if (deskTokP) headers['X-Desk-Inbox-Unlock'] = deskTokP;
            }
            applyDeskThreadUnlockHeader(headers, options);
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });
            
            if (response.status === 401) {
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            let responseData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseData = await response.json();
                } catch (e) {
                    App.warn('JSON 파싱 실패:', e);
                    responseData = { error: '응답 파싱 실패' };
                }
            } else {
                const text = await response.text();
                responseData = { error: text || `HTTP ${response.status}` };
            }
            
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: responseData };
                throw error;
            }
            return responseData;
        } catch (error) {
            App.err('API POST Error:', error);
            throw error;
        }
    },
    
    put: async function(url, data, options) {
        try {
            const headers = App.getAuthHeaders();
            headers['Content-Type'] = 'application/json';
            applyDeskThreadUnlockHeader(headers, options);
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(data)
            });
            
            if (response.status === 401) {
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            let responseData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseData = await response.json();
                } catch (e) {
                    App.warn('JSON 파싱 실패:', e);
                    responseData = { error: '응답 파싱 실패' };
                }
            } else {
                const text = await response.text();
                responseData = { error: text || `HTTP ${response.status}` };
            }
            
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: responseData };
                throw error;
            }
            return responseData;
        } catch (error) {
            App.err('API PUT Error:', error);
            throw error;
        }
    },

    patch: async function(url, data) {
        try {
            const headers = App.getAuthHeaders();
            headers['Content-Type'] = 'application/json';
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify(data)
            });
            if (response.status === 401) {
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            let responseData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try { responseData = await response.json(); } catch (e) { responseData = { error: '응답 파싱 실패' }; }
            } else {
                responseData = { error: (await response.text()) || `HTTP ${response.status}` };
            }
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: responseData };
                throw error;
            }
            return responseData;
        } catch (error) {
            App.err('API PATCH Error:', error);
            throw error;
        }
    },
    
    delete: async function(url, options) {
        try {
            const delHeaders = App.getAuthHeaders();
            if (options && options.deskInboxUnlock) {
                var deskTokD = sessionStorage.getItem('deskInboxUnlockToken');
                if (deskTokD) delHeaders['X-Desk-Inbox-Unlock'] = deskTokD;
            }
            applyDeskThreadUnlockHeader(delHeaders, options);
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'DELETE',
                headers: delHeaders
            });
            
            if (response.status === 401) {
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) {
                let responseData = null;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    try {
                        responseData = await response.json();
                    } catch (e) {
                        App.warn('JSON 파싱 실패:', e);
                        responseData = { error: '응답 파싱 실패' };
                    }
                } else {
                    const text = await response.text();
                    responseData = { error: text || `HTTP ${response.status}` };
                }
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: responseData };
                throw error;
            }
            return response.status === 204 || response.status === 205 ? null : (async function() {
                const text = await response.text();
                if (!text || !text.trim()) return null;
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { message: text };
                }
            })();
        } catch (error) {
            App.err('API DELETE Error:', error);
            throw error;
        }
    }
};

// ---------- 3.1 API 에러 메시지 사용자 노출 / 3.4 로딩·에러 UI ----------
// API 에러 응답의 message를 사용자 친화 문구로 매핑 (운영에서는 상세/스택 미노출)
App.apiErrorMessages = {
    '인증이 만료되었습니다.': '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
    '시설을 찾을 수 없습니다': '선택한 시설 정보를 찾을 수 없습니다.',
    '회원을 찾을 수 없습니다': '회원 정보를 찾을 수 없습니다.',
    '예약을 찾을 수 없습니다': '예약 정보를 찾을 수 없습니다.',
    '입력 데이터 검증에 실패했습니다.': '입력값을 확인해 주세요.',
    '서버 내부 오류가 발생했습니다.': '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    'Data Integrity Violation': '저장 조건을 만족하지 않습니다. 중복 또는 필수값을 확인해 주세요.',
    'Constraint Violation': '저장 조건을 만족하지 않습니다. 입력값을 확인해 주세요.'
};

App.getApiErrorMessage = function(err) {
    if (!err) return '요청 처리 중 오류가 발생했습니다.';
    let data = err.response && err.response.data;
    if (data && typeof data === 'object') {
        let msg = data.message || data.error || '';
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
            const fieldStr = Object.entries(data.fieldErrors).map(([f, m]) => f + ': ' + m).join(', ');
            if (fieldStr) msg = msg ? msg + ' (' + fieldStr + ')' : fieldStr;
        }
        if (msg) {
            let friendly = App.apiErrorMessages[msg] || msg;
            if (!App.debug && (data.stackTrace || data.errorClass || data.cause))
                friendly = friendly.replace(/\s*[:：].*$/, '').trim() || friendly;
            if (App.debug && (data.stackTrace || data.cause))
                friendly += ' [개발: ' + (data.stackTrace || data.cause || '') + ']';
            return friendly;
        }
    }
    if (err.message) {
        if (err.message.indexOf('인증이 만료') !== -1) return App.apiErrorMessages['인증이 만료되었습니다.'] || err.message;
        if (App.debug) return err.message;
        return '요청 처리 중 오류가 발생했습니다.';
    }
    return '요청 처리 중 오류가 발생했습니다.';
};

App.showApiError = function(err) {
    App.showNotification(App.getApiErrorMessage(err), 'error');
};

var _loadingCount = 0;
App.showLoading = function() {
    _loadingCount++;
    var el = document.getElementById('app-loading-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'app-loading-overlay';
        el.innerHTML = '<div class="app-loading-spinner"></div>';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
        document.body.appendChild(el);
    }
    el.style.display = 'flex';
};
App.hideLoading = function() {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount === 0) {
        var el = document.getElementById('app-loading-overlay');
        if (el) el.style.display = 'none';
    }
};

// 알림 표시
App.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background-color: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        z-index: 3000;
        box-shadow: var(--shadow-lg);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// 모달 관리
App.Modal = {
    open: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // 인라인 스타일 제거 (display: none 등)
            modal.style.display = '';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            // 드래그로 인한 뒤로가기 방지
            this.preventDragNavigation(modal);
        }
    },
    
    close: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            this.removeDragPrevention(modal);
            if (!document.querySelector('.modal-overlay.active')) {
                document.body.style.overflow = '';
            }
        }
    },
    
    closeAll: function() {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
            modal.style.display = 'none';
            this.removeDragPrevention(modal);
        });
        document.body.style.overflow = '';
    },
    
    // 드래그로 인한 뒤로가기 방지
    preventDragNavigation: function(modal) {
        if (modal._dragPreventionAdded) return;
        
        let startX = 0;
        let startY = 0;
        let isDragging = false;
        const isInsideModalBox = (target) => !!(target && target.closest && target.closest('.modal'));
        
        // 터치 시작
        const touchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = false;
        };
        
        // 터치 이동 — 모달 본문 스크롤은 허용, 배경 가로 스와이프만 차단
        const touchMove = (e) => {
            if (!startX || !startY) return;
            
            const deltaX = Math.abs(e.touches[0].clientX - startX);
            const deltaY = Math.abs(e.touches[0].clientY - startY);
            
            if (deltaX > 10 && deltaX > deltaY) {
                isDragging = true;
                if (!isInsideModalBox(e.target)) {
                    e.preventDefault();
                }
            }
        };
        
        // 마우스 드래그 방지
        const mouseDown = (e) => {
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
        };
        
        const mouseMove = (e) => {
            if (!startX || !startY) return;
            
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            
            if (deltaX > 10 && deltaX > deltaY) {
                isDragging = true;
                if (!isInsideModalBox(e.target)) {
                    e.preventDefault();
                }
            }
        };

        modal.addEventListener('touchstart', touchStart, { passive: false });
        modal.addEventListener('touchmove', touchMove, { passive: false });
        modal.addEventListener('mousedown', mouseDown);
        modal.addEventListener('mousemove', mouseMove);
        
        // 전역 터치 이벤트 차단 (모달 배경만 — 본문 스크롤은 허용)
        const preventGlobalTouch = (e) => {
            if (!document.querySelector('.modal-overlay.active')) return;
            if (isInsideModalBox(e.target)) return;
            e.preventDefault();
        };
        
        document.addEventListener('touchmove', preventGlobalTouch, { passive: false });
        
        modal._dragPreventionAdded = true;
        modal._touchStart = touchStart;
        modal._touchMove = touchMove;
        modal._mouseDown = mouseDown;
        modal._mouseMove = mouseMove;
        modal._preventGlobalTouch = preventGlobalTouch;
    },
    
    // 드래그 방지 이벤트 제거
    removeDragPrevention: function(modal) {
        if (!modal._dragPreventionAdded) return;
        
        modal.removeEventListener('touchstart', modal._touchStart);
        modal.removeEventListener('touchmove', modal._touchMove);
        modal.removeEventListener('mousedown', modal._mouseDown);
        modal.removeEventListener('mousemove', modal._mouseMove);
        document.removeEventListener('touchmove', modal._preventGlobalTouch);
        
        modal._dragPreventionAdded = false;
        delete modal._touchStart;
        delete modal._touchMove;
        delete modal._mouseDown;
        delete modal._mouseMove;
        delete modal._preventGlobalTouch;
    }
};

// 날짜 포맷팅
App.formatDate = function(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

App.formatDateTime = function(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 숫자 포맷팅
App.formatNumber = function(num) {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('ko-KR').format(num);
};

App.formatCurrency = function(amount) {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
    }).format(amount);
};

/** 예약 이용권 선택에 넣을 수 있는지. 소진·만료·잔여 0·상품 없는 이용권은 제외. */
App.isSelectableMemberProductForBooking = function(mp) {
    if (!mp || mp.deletedAt) return false;
    if (!mp.product || mp.product.id == null) return false;
    var st = String(mp.status || 'ACTIVE').toUpperCase();
    if (st !== 'ACTIVE') return false;
    if (mp.product.type === 'COUNT_PASS') {
        var rem = typeof App.resolveDisplayRemainingCount === 'function'
            ? App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'zero' })
            : Number(mp.remainingCount);
        if (!(rem > 0)) return false;
    }
    return true;
};

/** 회원 예약 등: 이용권 드롭다운 옵션 한 줄 라벨 (상품명·가격·잔여·코치·만료) */
App.formatMemberProductOptionLabel = function(mp) {
    if (!mp) return '';
    const product = mp.product || {};
    let text = product.name || '상품';
    if (product.price != null && product.price !== '') {
        text += ' · ' + App.formatCurrency(product.price);
    }
    const type = product.type;
    if (type === 'COUNT_PASS') {
        const remaining = App.resolveDisplayRemainingCount
            ? App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'ten' })
            : (mp.remainingCount != null ? mp.remainingCount : '?');
        text += ' · 잔여 ' + remaining + '회';
    } else if (type === 'MONTHLY_PASS') {
        text += ' · 월정액';
    } else if (type === 'DAY_PASS') {
        text += ' · 1일권';
    } else if (type === 'TIME_PASS') {
        text += ' · 기간권';
    }
    const coachName = (mp.coach && mp.coach.name) || (product.coach && product.coach.name);
    if (coachName) {
        text += ' · 코치 ' + coachName;
    }
    if (mp.expiryDate) {
        text += ' · 만료 ' + App.formatDate(mp.expiryDate);
    }
    return text;
};

/** 회원 이용권 상태 라벨 (결제·출석 모달 공통) */
App.memberProductStatusLabel = function(status) {
    const map = { ACTIVE: '사용중', EXPIRED: '만료', USED_UP: '소진' };
    return map[status] || (status || '-');
};

/**
 * DB는 ACTIVE인데 횟수권 잔여 0(전부 소진 표시) — 3일 유예·만료 배지에 USED_UP과 동일 취급.
 */
App.isActiveCountPassExhaustedForGrace = function(mp) {
    if (!mp || !mp.product || mp.product.type !== 'COUNT_PASS') {
        return false;
    }
    const st = mp.status && String(mp.status).toUpperCase();
    if (st !== 'ACTIVE') {
        return false;
    }
    if (!App.resolveDisplayRemainingCount) {
        const rc = mp.remainingCount;
        return rc !== null && rc !== undefined && Number(rc) === 0;
    }
    return App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'zero' }) === 0;
};

/**
 * API·Jackson이 LocalDateTime/LocalDate를 배열·객체로 줄 때 new Date()가 Invalid가 되는 경우 보정
 */
App.parseFlexibleDate = function(val) {
    if (val == null || val === '') {
        return null;
    }
    if (typeof val === 'number' && !isNaN(val)) {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (Array.isArray(val) && val.length >= 3) {
        var y = Number(val[0]);
        var mo = Number(val[1]);
        var day = Number(val[2]);
        var h = val.length > 3 ? Number(val[3]) : 0;
        var mi = val.length > 4 ? Number(val[4]) : 0;
        var s = val.length > 5 ? Number(val[5]) : 0;
        if (mo >= 1 && mo <= 12) {
            mo = mo - 1;
        }
        var dArr = new Date(y, mo, day, h, mi, s);
        return isNaN(dArr.getTime()) ? null : dArr;
    }
    if (typeof val === 'object' && val !== null && (val.year != null || val.year === 0)) {
        try {
            var y2 = Number(val.year);
            var mo2 = Number(val.monthValue != null ? val.monthValue : val.month) - 1;
            var day2 = Number(val.dayOfMonth != null ? val.dayOfMonth : val.day);
            var dObj = new Date(y2, mo2, day2);
            return isNaN(dObj.getTime()) ? null : dObj;
        } catch (e) {
            return null;
        }
    }
    var dStr = new Date(val);
    return isNaN(dStr.getTime()) ? null : dStr;
};

/**
 * 종료(소진/만료) 이용권의 UI 기준 시각 — 회원 목록「만료」배지와 상세「전부 소진」행을 같은 3일 규칙으로 맞춤.
 * endedAt 우선.
 * ※ 횟수만 소진·유효기간(만료일)은 아직 미래인 경우, 만료일을 종료 시각으로 쓰면 (now-end)이 음수가 되어 3일 숨김이 영원히 동작하지 않는다 → 구매일 우선.
 */
App.resolveMemberProductEndedAtForGrace = function(mp) {
    if (!mp) {
        return null;
    }
    if (mp.endedAt) {
        const d = App.parseFlexibleDate(mp.endedAt);
        return d;
    }
    function expiryOnOrBeforeToday(expiryVal) {
        if (!expiryVal) {
            return false;
        }
        const e = App.parseFlexibleDate(expiryVal);
        if (!e) {
            return false;
        }
        const endOfDay = new Date(e);
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay.getTime() <= Date.now();
    }
    const st = mp.status && String(mp.status).toUpperCase();
    if (st === 'EXPIRED') {
        if (mp.expiryDate && expiryOnOrBeforeToday(mp.expiryDate)) {
            return App.parseFlexibleDate(mp.expiryDate);
        }
        if (mp.purchaseDate) {
            return App.parseFlexibleDate(mp.purchaseDate);
        }
        if (mp.expiryDate) {
            return App.parseFlexibleDate(mp.expiryDate);
        }
        return null;
    }
    if (st === 'USED_UP') {
        if (mp.expiryDate && expiryOnOrBeforeToday(mp.expiryDate)) {
            return App.parseFlexibleDate(mp.expiryDate);
        }
        if (mp.purchaseDate) {
            return App.parseFlexibleDate(mp.purchaseDate);
        }
        if (mp.expiryDate) {
            return App.parseFlexibleDate(mp.expiryDate);
        }
        return null;
    }
    if (typeof App.isActiveCountPassExhaustedForGrace === 'function' && App.isActiveCountPassExhaustedForGrace(mp)) {
        if (mp.expiryDate && expiryOnOrBeforeToday(mp.expiryDate)) {
            return App.parseFlexibleDate(mp.expiryDate);
        }
        if (mp.purchaseDate) {
            return App.parseFlexibleDate(mp.purchaseDate);
        }
        return null;
    }
    return null;
};

/**
 * endedAt·만료일·구매일 기준 3일이 지난 종료 행을 목록에서 제거.
 * @param {Array} rows
 * @param {Object} [options]
 * @param {boolean} [options.includeActiveExhaustedInGrace] true: 회원 목록 상품/이용권 열 전용 — DB가 ACTIVE인 횟수권 잔여 0(전부 소진)도 USED_UP과 같이 3일 후 숨김.
 *   false/미지정: USED_UP·EXPIRED만 (회원 상세 이용권 탭은 applyEndedGraceFilter false로 이 경로를 타지 않음)
 */
App.filterEndedMemberProductsPastGraceDays = function(rows, options) {
    options = options || {};
    const includeActiveExhaustedInGrace = options.includeActiveExhaustedInGrace === true;
    if (!rows || rows.length === 0) {
        return rows || [];
    }
    const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return rows.filter(function(p) {
        const st = p && p.status ? String(p.status).toUpperCase() : '';
        let inGraceWindow = st === 'USED_UP' || st === 'EXPIRED';
        if (includeActiveExhaustedInGrace && typeof App.isActiveCountPassExhaustedForGrace === 'function' && App.isActiveCountPassExhaustedForGrace(p)) {
            inGraceWindow = true;
        }
        if (!inGraceWindow) {
            return true;
        }
        const end = App.resolveMemberProductEndedAtForGrace(p);
        if (!end) {
            // 종료 시각을 못 잡으면(날짜 파싱 실패 등) 목록에서 영원히 남지 않게 제거. 상세 이용권 탭은 이 필터를 쓰지 않음.
            if (includeActiveExhaustedInGrace) {
                return false;
            }
            return true;
        }
        return (now - end.getTime()) <= GRACE_MS;
    });
};

/**
 * 이용권 목록: 잔여가 남은 행을 위로(잔여 많은 순), 소진·만료 등은 아래로.
 * renderProductsList·연장 선택·회원 정보 패널 등에서 공통 사용.
 */
App.sortMemberProductsRemainingFirst = function(rows) {
    if (!rows || rows.length < 2) {
        return rows ? rows.slice() : [];
    }
    function packageRemainingSum(p) {
        if (!p || !p.packageItemsRemaining) {
            return null;
        }
        try {
            const pkg = JSON.parse(p.packageItemsRemaining);
            if (!Array.isArray(pkg) || pkg.length === 0) {
                return null;
            }
            return pkg.reduce(function(s, it) {
                return s + (Number(it && it.remaining) || 0);
            }, 0);
        } catch (e) {
            return null;
        }
    }
    function hasUsableRemaining(p) {
        if (!p) {
            return false;
        }
        const st = String(p.status || '').toUpperCase();
        const pkgSum = packageRemainingSum(p);
        if (pkgSum !== null) {
            return pkgSum > 0;
        }
        if (st === 'USED_UP' || st === 'EXPIRED') {
            return false;
        }
        if (st === 'INACTIVE') {
            return false;
        }
        const product = p.product || {};
        const pt = product.type;
        if (pt === 'COUNT_PASS') {
            if (typeof App.isActiveCountPassExhaustedForGrace === 'function' && App.isActiveCountPassExhaustedForGrace(p)) {
                return false;
            }
            const rem = App.resolveDisplayRemainingCount
                ? App.resolveDisplayRemainingCount(p, { whenAllUnknown: 'zero' })
                : 0;
            return rem > 0;
        }
        if (pt === 'MONTHLY_PASS' || pt === 'DAY_PASS' || pt === 'TIME_PASS') {
            return st === 'ACTIVE';
        }
        return st === 'ACTIVE';
    }
    function sortKeyDescending(p) {
        const pkgSum = packageRemainingSum(p);
        if (pkgSum !== null) {
            return pkgSum;
        }
        if (App.resolveDisplayRemainingCount) {
            return App.resolveDisplayRemainingCount(p, { whenAllUnknown: 'zero' });
        }
        const rc = p && p.remainingCount;
        return rc != null ? Number(rc) : 0;
    }
    return rows.slice().sort(function(a, b) {
        const ua = hasUsableRemaining(a);
        const ub = hasUsableRemaining(b);
        if (ua !== ub) {
            return ua ? -1 : 1;
        }
        if (ua) {
            return sortKeyDescending(b) - sortKeyDescending(a);
        }
        const ida = Number(a && a.id) || 0;
        const idb = Number(b && b.id) || 0;
        return idb - ida;
    });
};

/**
 * 회원 상세 이용권 목록 정리:
 * - 신규 구매: 같은 상품·같은 바우처로 꼬인 옛 줄(소진)은 숨기고, 지금 쓰는 이용권 한 줄만.
 * - 연장: 새 행이 extendedFromMemberProductId로 직전 행을 가리키면 직전 소진 줄+새 줄 2줄 유지(바우처 번호가 달라도 동일 상품+링크면 동일).
 * - 동일 바우처 번호가 두 행: 연장 링크가 있으면 2줄, 없으면 잔여 많은(같으면 id 큰) 한 줄만.
 * @param {Object} [options]
 * @param {boolean} [options.applyEndedGraceFilter] true일 때만 종료 행 3일 유예 후 목록에서 제거(회원 목록 테이블). 상세 이용권 탭·모달 등은 false.
 */
App.filterMemberProductsForDisplayList = function(products, options) {
    options = options || {};
    const applyEndedGraceFilter = options.applyEndedGraceFilter === true;
    /** 회원 목록 상품/이용권 열: 같은 상품에 연장(새 줄)이 있어도 직전 소진 줄은 숨김 — 상세 탭은 연장 짝을 유지 */
    const strictHideExhaustedWhenFreshExists = applyEndedGraceFilter === true;
    if (!products || products.length === 0) {
        return products || [];
    }
    function getPid(p) {
        if (p && p.product && p.product.id != null) {
            return String(p.product.id);
        }
        if (p && p.productId != null) {
            return String(p.productId);
        }
        return null;
    }
    /** 회원 상세 목록(renderProductsList)과 동일한 잔여 기준 — 'null'만 쓰면 UI는 'zero'로 0회로 보이는데 필터는 비소진으로 남는 불일치가 난다 */
    function isExhaustedLikeRow(p) {
        if (!p) {
            return false;
        }
        if (p.status === 'USED_UP' || p.status === 'EXPIRED') {
            return true;
        }
        const pt = p.product && p.product.type;
        if (pt !== 'COUNT_PASS') {
            return false;
        }
        if (p.packageItemsRemaining) {
            try {
                const pkg = JSON.parse(p.packageItemsRemaining);
                if (Array.isArray(pkg) && pkg.length > 0) {
                    const sum = pkg.reduce(function(s, it) {
                        return s + (Number(it && it.remaining) || 0);
                    }, 0);
                    return sum === 0;
                }
            } catch (e) {
                /* fall through */
            }
        }
        if (!App.resolveDisplayRemainingCount) {
            const rc = p.remainingCount;
            return rc !== null && rc !== undefined && Number(rc) === 0;
        }
        const remUi = App.resolveDisplayRemainingCount(p, { whenAllUnknown: 'zero' });
        return remUi === 0;
    }
    function isNonExhaustedSameProductRow(o) {
        return !!o && !isExhaustedLikeRow(o);
    }
    function rowRemainingForDedupe(p) {
        if (!App.resolveDisplayRemainingCount) {
            const rc = p && p.remainingCount;
            return rc != null ? Number(rc) : 0;
        }
        const r = App.resolveDisplayRemainingCount(p, { whenAllUnknown: 'zero' });
        return r != null ? Number(r) : 0;
    }
    /** 동일 바우처가 두 행 이상: 연장(extendedFrom이 그룹 내 다른 id)이면 유지, 아니면 잔여↑ 한 줄만 */
    function dedupeIdenticalVoucherNumber(rows) {
        const byV = new Map();
        for (let i = 0; i < rows.length; i++) {
            const p = rows[i];
            const v = p && p.voucherNumber ? String(p.voucherNumber).trim() : '';
            if (!v) {
                continue;
            }
            if (!byV.has(v)) {
                byV.set(v, []);
            }
            byV.get(v).push(p);
        }
        const sup2 = new Set();
        byV.forEach(function(list) {
            if (list.length < 2) {
                return;
            }
            const idSet = new Set();
            list.forEach(function(x) {
                if (x && x.id != null) {
                    idSet.add(String(x.id));
                }
            });
            const hasExtensionPair = list.some(function(a) {
                if (!a || a.status !== 'ACTIVE') {
                    return false;
                }
                const ext = a.extendedFromMemberProductId;
                if (ext == null) {
                    return false;
                }
                if (!idSet.has(String(ext))) {
                    return false;
                }
                const parent = list.find(function(x) {
                    return x && String(x.id) === String(ext);
                });
                if (!parent) {
                    return false;
                }
                const va = a.voucherNumber ? String(a.voucherNumber).trim() : '';
                const vp = parent.voucherNumber ? String(parent.voucherNumber).trim() : '';
                if (va && vp && va === vp) {
                    return false;
                }
                // 목록 API 등 바우처 미포함 시 extendedFrom 만으로 연장으로 오인하지 않음
                if (!va || !vp) {
                    return false;
                }
                return true;
            });
            if (hasExtensionPair) {
                return;
            }
            let best = list[0];
            let bestRem = rowRemainingForDedupe(best);
            let bestId = Number(best && best.id) || 0;
            for (let j = 1; j < list.length; j++) {
                const q = list[j];
                const rem = rowRemainingForDedupe(q);
                const qid = Number(q && q.id) || 0;
                if (rem > bestRem || (rem === bestRem && qid > bestId)) {
                    best = q;
                    bestRem = rem;
                    bestId = qid;
                }
            }
            list.forEach(function(p) {
                if (p !== best) {
                    sup2.add(p);
                }
            });
        });
        return rows.filter(function(p) {
            return !sup2.has(p);
        });
    }
    /** 바우처 번호 없이도 같은 상품에 소진 줄 + 정상 줄이 있으면 소진만 제거(연장 링크 있을 때만 유지) */
    function hideExhaustedWhenNonExhaustedExistsSameProduct(rows) {
        const byPid = new Map();
        for (let i = 0; i < rows.length; i++) {
            const p = rows[i];
            const pid = getPid(p);
            if (!pid) {
                continue;
            }
            if (!byPid.has(pid)) {
                byPid.set(pid, []);
            }
            byPid.get(pid).push(p);
        }
        const sup3 = new Set();
        byPid.forEach(function(list) {
            if (list.length < 2) {
                return;
            }
            const exhausted = list.filter(isExhaustedLikeRow);
            if (exhausted.length === 0) {
                return;
            }
            const fresh = list.filter(isNonExhaustedSameProductRow);
            if (fresh.length === 0) {
                return;
            }
            const linked =
                !strictHideExhaustedWhenFreshExists &&
                fresh.some(function(g) {
                    const ext = g.extendedFromMemberProductId;
                    if (ext == null) {
                        return false;
                    }
                    return exhausted.some(function(b) {
                        if (String(b.id) !== String(ext)) {
                            return false;
                        }
                        const vg = g.voucherNumber ? String(g.voucherNumber).trim() : '';
                        const vb = b.voucherNumber ? String(b.voucherNumber).trim() : '';
                        if (vg && vb && vg === vb) {
                            return false;
                        }
                        if (!vg || !vb) {
                            return false;
                        }
                        return true;
                    });
                });
            if (linked) {
                return;
            }
            exhausted.forEach(function(b) {
                sup3.add(b);
            });
        });
        return rows.filter(function(p) {
            return !sup3.has(p);
        });
    }
    /**
     * 회원 목록 전용: product.id가 달라도 상품명·카테고리가 같으면「전부 소진」줄 + 잔여 줄 동시 노출 방지
     * (야구 10회권이 카탈로그에 두 개로 잡힌 경우 등)
     */
    function hideExhaustedWhenFreshExistsSameProductName(rows) {
        function displayKey(p) {
            if (!p || !p.product) {
                return '';
            }
            const name = (p.product.name || '').trim().toLowerCase();
            if (!name) {
                return '';
            }
            const cat = (p.product.category || '').trim();
            return cat + '\u0001' + name;
        }
        const byKey = new Map();
        for (let i = 0; i < rows.length; i++) {
            const p = rows[i];
            const k = displayKey(p);
            if (!k) {
                continue;
            }
            if (!byKey.has(k)) {
                byKey.set(k, []);
            }
            byKey.get(k).push(p);
        }
        const supN = new Set();
        byKey.forEach(function(list) {
            if (list.length < 2) {
                return;
            }
            const exhausted = list.filter(isExhaustedLikeRow);
            const fresh = list.filter(isNonExhaustedSameProductRow);
            if (exhausted.length === 0 || fresh.length === 0) {
                return;
            }
            exhausted.forEach(function(b) {
                supN.add(b);
            });
        });
        return rows.filter(function(p) {
            return !supN.has(p);
        });
    }
    const suppressed = new Set();
    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const pid = getPid(p);
        if (pid == null || !isExhaustedLikeRow(p)) {
            continue;
        }
        const hasBetterRow = products.some(function(o) {
            if (!o || String(o.id) === String(p.id)) {
                return false;
            }
            if (getPid(o) !== pid) {
                return false;
            }
            return isNonExhaustedSameProductRow(o);
        });
        if (!hasBetterRow) {
            continue;
        }
        const linkedByExtension = products.some(function(o) {
            if (!o || o.status !== 'ACTIVE') {
                return false;
            }
            const ext = o.extendedFromMemberProductId;
            if (ext == null || String(ext) !== String(p.id)) {
                return false;
            }
            const vo = o.voucherNumber ? String(o.voucherNumber).trim() : '';
            const vp = p.voucherNumber ? String(p.voucherNumber).trim() : '';
            if (vo && vp && vo === vp) {
                return false;
            }
            if (!vo || !vp) {
                return false;
            }
            return true;
        });
        if (strictHideExhaustedWhenFreshExists || !linkedByExtension) {
            suppressed.add(p);
        }
    }
    let out = products.filter(function(row) {
        return !suppressed.has(row);
    });
    out = dedupeIdenticalVoucherNumber(out);
    out = hideExhaustedWhenNonExhaustedExistsSameProduct(out);
    if (strictHideExhaustedWhenFreshExists) {
        out = hideExhaustedWhenFreshExistsSameProductName(out);
    }
    if (applyEndedGraceFilter && typeof App.filterEndedMemberProductsPastGraceDays === 'function') {
        return App.filterEndedMemberProductsPastGraceDays(out, { includeActiveExhaustedInGrace: true });
    }
    return out;
};

/**
 * 회원 API 응답 → 「회원 · 이용권」 모달 본문 HTML
 */
App.renderMemberInfoPanelHtml = function(member) {
    if (!member) {
        return '<p class="text-muted">회원 정보가 없습니다.</p>';
    }
    const coachName = member.coach && member.coach.name ? member.coach.name : '-';
    const rawProducts = member.memberProducts || [];
    let products = App.filterMemberProductsForDisplayList
        ? App.filterMemberProductsForDisplayList(rawProducts, { applyEndedGraceFilter: false })
        : rawProducts;
    if (typeof App.sortMemberProductsRemainingFirst === 'function' && products && products.length > 1) {
        products = App.sortMemberProductsRemainingFirst(products);
    }
    const rows = products
        .map(function(mp) {
            const p = mp.product || {};
            const coach = mp.coach && mp.coach.name ? mp.coach.name : '-';
            const status = App.memberProductStatusLabel(mp.status);
            const purchaseDate = mp.purchaseDate ? App.formatDate(mp.purchaseDate) : '-';
            const expiryDate = mp.expiryDate ? App.formatDate(mp.expiryDate) : '-';
            const remain =
                mp.remainingCount != null && mp.totalCount != null
                    ? mp.remainingCount + ' / ' + mp.totalCount
                    : '-';
            let stClass = 'mp-status';
            if (mp.status === 'ACTIVE') stClass += ' mp-status--active';
            else if (mp.status === 'EXPIRED') stClass += ' mp-status--expired';
            else if (mp.status === 'USED_UP') stClass += ' mp-status--usedup';
            return (
                '<tr>' +
                '<td class="member-info-col-product">' +
                App.escapeHtml(p.name || '-') +
                '</td>' +
                '<td class="member-info-col-status"><span class="' +
                stClass +
                '">' +
                App.escapeHtml(status) +
                '</span></td>' +
                '<td class="member-info-col-coach">' +
                App.escapeHtml(coach) +
                '</td>' +
                '<td class="member-info-col-date">' +
                purchaseDate +
                '</td>' +
                '<td class="member-info-col-date">' +
                expiryDate +
                '</td>' +
                '<td class="member-info-col-remain">' +
                App.escapeHtml(remain) +
                '</td>' +
                '</tr>'
            );
        })
        .join('');
    const count = products.length;
    const tbody = rows
        ? rows
        : '<tr><td colspan="6" class="member-info-empty">등록된 이용권이 없습니다.</td></tr>';
    return (
        '<div class="member-info-panel">' +
        '<div class="member-info-summary">' +
        '<div class="member-info-summary-item">' +
        '<span class="member-info-summary-label">회원명</span>' +
        '<span class="member-info-summary-value">' +
        App.escapeHtml(member.name || '-') +
        '</span></div>' +
        '<div class="member-info-summary-item">' +
        '<span class="member-info-summary-label">회원번호</span>' +
        '<span class="member-info-summary-value member-info-mono">' +
        App.escapeHtml(member.memberNumber || '-') +
        '</span></div>' +
        '<div class="member-info-summary-item">' +
        '<span class="member-info-summary-label">담당 코치</span>' +
        '<span class="member-info-summary-value">' +
        App.escapeHtml(coachName) +
        '</span></div>' +
        '</div>' +
        '<div class="member-info-list-bar">' +
        '<span class="member-info-list-title">보유 이용권</span>' +
        '<span class="member-info-list-badge">' +
        count +
        '건</span>' +
        '</div>' +
        '<div class="member-info-table-wrap">' +
        '<table class="table member-info-table">' +
        '<thead><tr><th>상품명</th><th>상태</th><th>지정 코치</th><th>구매일</th><th>만료일</th><th>잔여</th></tr></thead>' +
        '<tbody>' +
        tbody +
        '</tbody></table></div></div>'
    );
};

/** 예약 수정 모달 등에도 회원 정보 레이어가 없으면 삽입 */
App.ensureMemberInfoModal = function() {
    if (document.getElementById('member-info-modal')) return;
    var wrap = document.createElement('div');
    wrap.className = 'modal-overlay';
    wrap.id = 'member-info-modal';
    wrap.innerHTML =
        '<div class="modal member-info-modal-box">' +
        '<div class="modal-header member-info-modal-header">' +
        '<h2 class="modal-title">회원 이용권 및 코치 정보</h2>' +
        '<button type="button" class="modal-close" onclick="App.Modal.close(\'member-info-modal\')">×</button>' +
        '</div>' +
        '<div class="modal-body member-info-modal-body">' +
        '<div id="member-info-content"></div>' +
        '</div>' +
        '<div class="modal-footer member-info-modal-footer">' +
        '<button type="button" class="btn btn-secondary" onclick="App.Modal.close(\'member-info-modal\')">닫기</button>' +
        '</div></div>';
    document.body.appendChild(wrap);
};

/** 예약 모달 이름칸: 회원 ID가 있으면 클릭해서 회원 정보 모달 */
App.setBookingModalMemberName = function(name, memberId) {
    var el = document.getElementById('member-info-name');
    if (!el) return;
    var text = name || '-';
    var id = memberId != null && memberId !== '' ? parseInt(memberId, 10) : NaN;
    if (!isNaN(id) && id > 0 && text !== '-') {
        el.innerHTML = '<button type="button" class="booking-member-name-link" data-member-id="' +
            id + '" title="회원 상세 보기">' + App.escapeHtml(text) + '</button>';
    } else {
        el.textContent = text;
    }
};

/**
 * 결제·출석·예약 모달 등 회원명 클릭 시 (#member-info-content, #member-info-modal)
 */
App.openMemberInfoModal = async function(memberId) {
    if (memberId == null || memberId === '') return;
    App.ensureMemberInfoModal();
    const contentEl = document.getElementById('member-info-content');
    if (!contentEl) return;
    contentEl.innerHTML = '<p class="member-info-loading text-muted">불러오는 중...</p>';
    if (typeof App.Modal !== 'undefined' && App.Modal.open) {
        App.Modal.open('member-info-modal');
    }
    try {
        const member = await App.api.get('/members/' + memberId);
        if (!member) {
            contentEl.innerHTML = '<p class="text-muted">회원 정보를 찾을 수 없습니다.</p>';
            return;
        }
        contentEl.innerHTML = App.renderMemberInfoPanelHtml(member);
    } catch (err) {
        App.err('회원 정보 조회 실패:', err);
        contentEl.innerHTML = '<p class="text-danger">회원 정보를 불러오지 못했습니다.</p>';
    }
};

// 페이지네이션
App.Pagination = {
    render: function(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        // 이전 버튼
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '이전';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => onPageChange(currentPage - 1);
        container.appendChild(prevBtn);
        
        // 페이지 번호
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => onPageChange(i);
            container.appendChild(pageBtn);
        }
        
        // 다음 버튼
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = '다음';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => onPageChange(currentPage + 1);
        container.appendChild(nextBtn);
    }
};

// ========================================
// 코치 색상 관리
// ========================================
App.CoachColors = {
    // 확장된 색상 팔레트 (DB 색 없을 때 폴백용)
    default: [
        '#5E6AD2', '#4CAF50', '#FF9800', '#E91E63', '#00BCD4',
        '#9C27B0', '#795548', '#2196F3', '#FF5722',
        '#009688', '#FFC107', '#673AB7', '#CDDC39', '#FF4081',
        '#3F51B5', '#8BC34A', '#FF6B6B', '#4ECDC4', '#45B7D1',
        '#1976D2', '#F57C00', '#00897B', '#8E24AA', '#D32F2F',
        '#0288D1', '#F9A825', '#558B2F', '#C2185B'
    ],

    // 특정 코치 이름에 대한 고정 색상 (DB color 로드 전 폴백 · 마이그레이션 선호색과 동기)
    // 공인욱·박근엽·이원준·이유진은 서로 다른 색상 계열로 고정
    fixedColors: {
        '서정민 [대표]': '#FF9800',
        '서정민': '#FF9800',
        '서정훈': '#FFFFFF',
        '서정훈[운영/대관담당]': '#FFFFFF',
        '서정훈 [운영/대관담당]': '#FFFFFF',
        '서정훈[대관담당]': '#FFFFFF',
        '서정훈 [대관담당]': '#FFFFFF',
        '조장우 [코치]': '#4CAF50',
        '조장우': '#4CAF50',
        '최성훈 [코치]': '#E91E63',
        '최성훈': '#E91E63',
        '김우경 [투수코치]': '#9C27B0',
        '김우경': '#9C27B0',
        '이원준 [포수코치]': '#00897B',
        '이원준': '#00897B',
        '박준현 [트레이너]': '#5E6AD2',
        '박준현': '#5E6AD2',
        '공인욱': '#1976D2',
        '공인욱[코치]': '#1976D2',
        '공인욱 [코치]': '#1976D2',
        '공인욱[대관담당]': '#1976D2',
        '이소연 [강사]': '#E0C05A',
        '이소연  [강사]': '#E0C05A',
        '이소연': '#E0C05A',
        '김유진[강사]': '#4ECDC4',
        '김유진 [강사]': '#4ECDC4',
        '김유진': '#4ECDC4',
        '이서현 [강사]': '#F06292',
        '이서현': '#F06292',
        '김가영 [강사]': '#795548',
        '김가영': '#795548',
        '김소연 [강사]': '#009688',
        '김소연': '#009688',
        '정영삼': '#673AB7',
        '정영삼 [트레이너 센터장]': '#673AB7',
        '정영삼[트레이너 센터장]': '#673AB7',
        '정진환': '#455A64',
        '정진환 [유소년]': '#455A64',
        '정진환[유소년]': '#455A64',
        '박근엽': '#C0CA33',
        '박근엽[투수코치]': '#C0CA33',
        '박근엽 [투수코치]': '#C0CA33',
        '이유진': '#8E24AA',
        '이유진[강사]': '#8E24AA',
        '이유진 [강사]': '#8E24AA',
        '야외레슨': '#2962FF'
    },

    // 코치별 색상 캐시 (ID / 이름 → 색상). DB color 등록 시 채워짐
    colorCache: {},
    nameColorCache: {},
    retiredIds: {},

    isRetiredId: function(id) {
        if (id == null || id === '') return false;
        return !!this.retiredIds[String(id)];
    },

    _normalizeHex: function(hex) {
        if (!hex) return '';
        var n = String(hex).trim().toUpperCase();
        if (!n) return '';
        if (n.charAt(0) !== '#') n = '#' + n;
        return /^#[0-9A-F]{6}$/.test(n) ? n : '';
    },

    /** Java CoachColorPalette.familyKey 와 맞춤: 비슷한 hue는 같은 키 */
    familyKey: function(hex) {
        var n = this._normalizeHex(hex);
        if (!n) return 'UNKNOWN';
        var r = parseInt(n.slice(1, 3), 16) / 255;
        var g = parseInt(n.slice(3, 5), 16) / 255;
        var b = parseInt(n.slice(5, 7), 16) / 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var l = (max + min) / 2;
        var h = 0;
        var s = 0;
        if (max !== min) {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        h = h * 360;
        if (s < 0.18 || (s < 0.28 && l < 0.35)) {
            return 'NEUTRAL_' + Math.min(4, Math.max(0, Math.floor(l * 5)));
        }
        var bucket = Math.floor(h / 30) % 12;
        if (bucket < 0) bucket += 12;
        return 'HUE_' + bucket;
    },

    conflictsWithWorkingColors: function(hex) {
        var n = this._normalizeHex(hex);
        if (!n) return true;
        var key = this.familyKey(n);
        var id;
        for (id in this.colorCache) {
            if (!Object.prototype.hasOwnProperty.call(this.colorCache, id)) continue;
            if (this.retiredIds[id]) continue;
            var other = this._normalizeHex(this.colorCache[id]);
            if (!other) continue;
            if (other === n || this.familyKey(other) === key) return true;
        }
        return false;
    },

    /** 퇴사 강사 색이 현직 코치 색과 안 비슷하면 칸에 써도 된다. */
    retiredColorDistinctFromWorking: function(coach) {
        if (!coach || typeof coach !== 'object') return false;
        if (coach.active !== false && !this.isRetiredId(coach.id)) return false;
        var hex = coach.color ? String(coach.color).trim() : '';
        if (!hex && coach.id != null) hex = this.colorCache[String(coach.id)] || '';
        if (!hex) return false;
        return !this.conflictsWithWorkingColors(hex);
    },

    /** 근무 중 고유색만 ID/이름 캐시에 넣는다. 퇴사 색은 현직과 안 비슷할 때만 화면에 쓴다. */
    registerFromCoaches: function(coaches) {
        if (!Array.isArray(coaches)) return;
        var self = this;
        var working = [];
        coaches.forEach(function(c) {
            if (!c) return;
            if (c.active === false) {
                if (c.id != null) {
                    self.retiredIds[String(c.id)] = true;
                    delete self.colorCache[String(c.id)];
                }
                return;
            }
            var color = c.color ? String(c.color).trim() : '';
            if (!color) return;
            if (c.id != null) {
                self.colorCache[String(c.id)] = color;
            }
            working.push(c);
        });
        working.forEach(function(c) {
            var color = String(c.color).trim();
            var full = String(c.name || '').replace(/\s+/g, ' ').trim();
            if (!full) return;
            self.nameColorCache[full] = color;
            self.nameColorCache[full.replace(/\s+/g, '')] = color;
            var base = full.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim();
            if (base) {
                self.nameColorCache[base] = color;
                self.nameColorCache[base.replace(/\s+/g, '')] = color;
            }
        });
        if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
            try {
                document.dispatchEvent(new CustomEvent('afbs-coach-colors-ready'));
            } catch (e) { /* ignore */ }
        }
    },

    /** 숫자 코치 ID만 ID 캐시 키로 쓴다. 이름 문자열을 ID처럼 넣으면 고정색이 DB 고유색을 가린다. */
    _cacheKeyFromId: function(rawId) {
        if (rawId == null || rawId === '') return '';
        var s = String(rawId).trim();
        return /^\d+$/.test(s) ? s : '';
    },

    // 코치별 색상 가져오기 (DB color → ID 캐시 → 이름 캐시 → 고정색 → 폴백)
    getColor: function(coach) {
        if (!coach) return null;
        var rawId = null;
        var coachName = '';
        var objectColor = '';
        if (typeof coach === 'object') {
            rawId = coach.id;
            coachName = coach.name || '';
            objectColor = coach.color ? String(coach.color).trim() : '';
        } else if (typeof coach === 'number') {
            rawId = coach;
        } else if (typeof coach === 'string') {
            var s = coach.trim();
            if (/^\d+$/.test(s)) rawId = s;
            else coachName = s;
        }
        const coachCacheKey = this._cacheKeyFromId(rawId);
        var retired = (typeof coach === 'object' && coach.active === false) || this.isRetiredId(rawId);
        if (retired) {
            if (objectColor && !this.conflictsWithWorkingColors(objectColor)) {
                return objectColor;
            }
            return null;
        }
        const normalizeName = (name) => {
            if (!name) return '';
            let normalized = String(name).replace(/\s+/g, ' ').trim();
            if (!normalized) return '';
            normalized = normalized.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim();
            normalized = normalized.replace(/(대표|코치|강사|트레이너)/g, '').replace(/\s+/g, ' ').trim();
            return normalized;
        };
        const nameCandidates = [];
        if (coachName) {
            const trimmed = String(coachName).replace(/\s+/g, ' ').trim();
            nameCandidates.push(trimmed);
            nameCandidates.push(trimmed.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim());
            const normalized = normalizeName(trimmed);
            if (normalized) nameCandidates.push(normalized);
            nameCandidates.push(trimmed.replace(/\s+/g, ''));
        }

        // 1) API 객체에 color가 있으면 최우선 (DB 고유색)
        if (objectColor) {
            if (coachCacheKey) this.colorCache[coachCacheKey] = objectColor;
            nameCandidates.forEach((n) => { if (n) this.nameColorCache[n] = objectColor; });
            return objectColor;
        }

        // 2) ID 캐시 (registerFromCoaches)
        if (coachCacheKey && this.colorCache[coachCacheKey]) {
            return this.colorCache[coachCacheKey];
        }

        // 3) 이름 캐시
        for (const candidate of nameCandidates) {
            if (candidate && this.nameColorCache[candidate]) {
                const cached = this.nameColorCache[candidate];
                if (coachCacheKey) this.colorCache[coachCacheKey] = cached;
                return cached;
            }
        }

        // 4) 고정 색상 폴백
        if (coachName) {
            for (const candidate of nameCandidates) {
                if (candidate && this.fixedColors[candidate]) {
                    const fixedColor = this.fixedColors[candidate];
                    if (coachCacheKey) this.colorCache[coachCacheKey] = fixedColor;
                    return fixedColor;
                }
            }
        }

        // 5) 결정론적 폴백 (DB 미반영·오프라인 등)
        const fixedValues = Object.values(this.fixedColors);
        const availablePalette = this.default.filter(c => !fixedValues.includes(c));
        const palette = availablePalette.length > 0 ? availablePalette : this.default;
        let seed = 0;
        let idForSeed = rawId;
        if (typeof idForSeed === 'string' && idForSeed.trim() !== '' && !isNaN(Number(idForSeed))) {
            idForSeed = Number(idForSeed);
        }
        if (typeof idForSeed === 'number' && !isNaN(idForSeed)) {
            seed = Math.abs(Math.floor(idForSeed));
        } else if (coachName) {
            for (let i = 0; i < coachName.length; i++) {
                seed = ((seed << 5) - seed) + coachName.charCodeAt(i);
                seed = seed & 0x7fffffff;
            }
            seed = Math.abs(seed);
        }
        const colorIndex = seed % palette.length;
        const color = palette[colorIndex];

        if (coachCacheKey) {
            this.colorCache[coachCacheKey] = color;
        }
        return color;
    },

    // 코치 ID로 색상 가져오기
    getColorById: function(coachId) {
        if (!coachId) return null;
        return this.getColor({ id: coachId });
    },

    // 색상 캐시 초기화
    resetCache: function() {
        this.colorCache = {};
        this.nameColorCache = {};
        this.retiredIds = {};
        this._loadPromise = null;
    },

    /** DB 코치 고유색을 한 번 불러 캐시에 넣는다. 회원 관리 등 이름만 있는 화면에서 목록 그리기 전에 호출. */
    ensureLoaded: function() {
        if (this._loadPromise) return this._loadPromise;
        if (typeof isLoginPagePath === 'function' && isLoginPagePath()) {
            return Promise.resolve();
        }
        if (!(App.isAuthenticated && App.isAuthenticated() && App.api && typeof App.api.get === 'function')) {
            return Promise.resolve();
        }
        var self = this;
        this._loadPromise = App.api.get('/coaches').then(function(list) {
            self.registerFromCoaches(list);
            return list;
        }).catch(function() {
            self._loadPromise = null;
        });
        return this._loadPromise;
    },

    // 고정 색상 강제 적용 (캐시 무시)
    forceFixedColor: function(coachName) {
        if (!coachName) return null;
        const trimmedName = coachName.trim();
        return this.fixedColors[trimmedName] || this.nameColorCache[trimmedName] || null;
    }
};

// 코치 표시 순서: 대표 → 이사 → 센터장 → 지점장 → 투수 → 유소년 → 재활 → 트레이너 → 강사
App.CoachSortOrder = function(coach) {
    var name = (coach.name || '') + ' ' + (coach.specialties || '');
    if (/야외레슨/.test(name)) return 99;
    if (/대표/.test(name)) return 0;
    if (/이사/.test(name)) return 1;
    if (/센터장/.test(name)) return 2;
    if (/지점장/.test(name)) return 3;
    if (/투수/.test(name)) return 4;
    if (/유소년/.test(name)) return 5;
    if (/재활/.test(name)) return 6;
    if (/트레이너|트레이닝/.test(name)) return 7;
    if (/강사|필라테스/.test(name)) return 8;
    return 9;
};

// 페이지 로드 시 색상 캐시 초기화 후 DB 코치 고유색 프리로드 (인증된 페이지만)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        if (App.CoachColors) {
            App.CoachColors.resetCache();
            if (typeof isLoginPagePath === 'function' && isLoginPagePath()) {
                return;
            }
            if (App.isAuthenticated && App.isAuthenticated()
                    && App.api && typeof App.api.get === 'function'
                    && typeof App.CoachColors.ensureLoaded === 'function') {
                App.CoachColors.ensureLoaded();
            }
        }
    });
}

// ========================================
// 상태 관리 유틸리티
// ========================================
App.Status = {
    // 예약 상태
    booking: {
        getBadge: function(status) {
            const map = {
                'CONFIRMED': 'success',
                'PENDING': 'warning',
                'CANCELLED': 'danger',
                'COMPLETED': 'info',
                'NO_SHOW': 'danger',
                'CHECKED_IN': 'info'
            };
            return map[status] || 'info';
        },
        getText: function(status) {
            const map = {
                'CONFIRMED': '확정',
                'PENDING': '대기',
                'CANCELLED': '취소',
                'COMPLETED': '완료',
                'NO_SHOW': '노쇼',
                'CHECKED_IN': '체크인'
            };
            return map[status] || status;
        }
    },
    
    // 회원 상태
    member: {
        getBadge: function(status) {
            const map = {
                'PENDING_APPROVAL': 'warning',
                'ACTIVE': 'success',
                'INACTIVE': 'warning',
                'WITHDRAWN': 'danger'
            };
            return map[status] || 'info';
        },
        getText: function(status) {
            const map = {
                'PENDING_APPROVAL': '승인 대기',
                'ACTIVE': '활성',
                'INACTIVE': '휴면',
                'WITHDRAWN': '탈퇴'
            };
            return map[status] || status;
        }
    }
};

// ========================================
// 레슨 카테고리 관리
// ========================================
App.LessonCategory = {
    getText: function(category) {
        const map = {
            'BASEBALL': '야구 레슨',
            'YOUTH_BASEBALL': '유소년 야구',
            'PILATES': '필라테스 레슨',
            'TRAINING': '트레이닝 파트'
        };
        return map[category] || category || '-';
    },
    
    getBadge: function(category) {
        const map = {
            'BASEBALL': 'info',
            'YOUTH_BASEBALL': 'info',
            'PILATES': 'success',
            'TRAINING': 'warning'
        };
        return map[category] || 'secondary';
    },
    
    // 코치의 specialties에서 레슨 카테고리 추출
    fromCoachSpecialties: function(specialties) {
        if (!specialties) return null;
        const specialtiesLower = specialties.toLowerCase();
        if (specialtiesLower.includes('야구') || specialtiesLower.includes('baseball')) {
            return 'BASEBALL';
        } else if (specialtiesLower.includes('필라테스') || specialtiesLower.includes('pilates')) {
            return 'PILATES';
        } else if (specialtiesLower.includes('트레이닝') || specialtiesLower.includes('training')) {
            return 'TRAINING';
        }
        return null;
    }
};

// ========================================
// 결제 방법 관리
// ========================================
App.PaymentMethod = {
    getText: function(method) {
        if (!method) return '미결제';
        const map = {
            'PREPAID': '선결제',
            'ON_SITE': '현장',
            'POSTPAID': '후불',
            'ONSITE': '현장', // 하위 호환성
            'DEFERRED': '후불' // 하위 호환성
        };
        return map[method] || method;
    }
};

// ========================================
// 회원 등급 관리
// ========================================
App.MemberGrade = {
    getText: function(grade) {
        const map = {
            'SOCIAL': '사회인',
            'ELITE_ELEMENTARY': '엘리트 (초)',
            'ELITE_MIDDLE': '엘리트 (중)',
            'ELITE_HIGH': '엘리트 (고)',
            'YOUTH': '유소년',
            'OTHER': '기타 종목'
        };
        return map[grade] || grade || '-';
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 인증 정보 복원 후 메뉴 필터링 (restoreAuth는 다른 리스너에서 처리됨)
    // 여기서는 restoreAuth가 완료된 후 필터링하도록 약간의 지연 추가
    setTimeout(function() {
        if (App.currentRole) {
            App.filterMenuByRole();
        }
    }, 100);
    
    // 시간 입력 필드 자동 포맷팅 (HH:MM)
    document.addEventListener('input', function(e) {
        const target = e.target;
        
        // 시간 입력 필드 감지 (id에 'time'이 포함되고 type이 text인 경우)
        if (target.type === 'text' && 
            (target.id.includes('time') || target.id.includes('Time')) &&
            target.pattern && target.pattern.includes('0-9')) {
            
            let value = target.value.replace(/[^0-9]/g, ''); // 숫자만 추출
            
            if (value.length >= 2) {
                // 2자리 이상이면 HH:MM 형식으로 변환
                let hours = value.substring(0, 2);
                let minutes = value.substring(2, 4);
                
                // 시간 검증 (0~23)
                if (parseInt(hours) > 23) {
                    hours = '23';
                }
                
                // 분 검증 (0~59)
                if (minutes && parseInt(minutes) > 59) {
                    minutes = '59';
                }
                
                target.value = minutes ? `${hours}:${minutes}` : hours;
            } else {
                target.value = value;
            }
        }
    });
    
    // 모달 닫기 이벤트
    document.addEventListener('click', function(e) {
        // 모달 외부 클릭으로 닫기 비활성화 (닫기 버튼만 작동)
        // if (e.target.classList.contains('modal-overlay')) {
        //     App.Modal.closeAll();
        // }
        if (e.target.classList.contains('modal-close')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                App.Modal.close(modal.id);
            }
        }
        var nameBtn = e.target.closest && e.target.closest('.booking-member-name-link');
        if (nameBtn) {
            var mid = parseInt(nameBtn.getAttribute('data-member-id'), 10);
            if (!isNaN(mid)) {
                e.preventDefault();
                if (typeof window.openMemberDetail === 'function') {
                    window.openMemberDetail(mid);
                } else {
                    App.openMemberInfoModal(mid);
                }
            }
        }
    });
    
    // 모달 내부에서의 드래그로 인한 뒤로가기 방지 (추가 보호)
    document.addEventListener('touchstart', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal && activeModal.contains(e.target)) {
            // 모달 내부 터치는 허용하되, 수평 스와이프는 차단
            const touch = e.touches[0];
            activeModal._touchStartX = touch.clientX;
            activeModal._touchStartY = touch.clientY;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal && activeModal._touchStartX !== undefined) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - activeModal._touchStartX);
            const deltaY = Math.abs(touch.clientY - activeModal._touchStartY);
            
            // 수평 스와이프가 수직 스와이프보다 크면 차단 (뒤로가기 방지)
            // 모달 본문·표 스크롤은 허용
            if (deltaX > 30 && deltaX > deltaY * 2) {
                if (e.target && e.target.closest && e.target.closest('.modal')) return;
                e.preventDefault();
            }
        }
    }, { passive: false });
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            App.Modal.closeAll();
        }
    });
    
    // 현재 페이지 메뉴 활성화 (href 정규화하여 비교: 야구/야구(유소년) 별도 메뉴 동일 처리)
    const currentPath = (window.location.pathname || '/').replace(/\/$/, '') || '/';
    document.querySelectorAll('.menu-item').forEach(item => {
        let h = item.getAttribute('href') || '';
        const itemPath = h.startsWith('http') ? (function(u) { try { return new URL(u).pathname; } catch (_) { return h; } })(h) : (h.startsWith('/') ? h : '/' + h);
        if (itemPath === currentPath) {
            item.classList.add('active');
        }
    });
});

// ========================================
// 알림 시스템
// ========================================

App.getNotificationButton = function() {
    var btn = document.getElementById('notification-btn');
    if (btn) return btn;
    btn = document.querySelector('.topbar-right .notification-btn');
    if (btn && !btn.id) btn.id = 'notification-btn';
    return btn;
};

// 알림 드롭다운 초기화
App.initNotifications = function() {
    const notificationBtn = App.getNotificationButton();
    if (!notificationBtn) return;
    if (document.getElementById('notification-dropdown')) {
        return;
    }
    
    // 알림 드롭다운 생성
    const dropdown = document.createElement('div');
    dropdown.className = 'notification-dropdown';
    dropdown.id = 'notification-dropdown';
    dropdown.innerHTML = `
        <div class="notification-header">
            <h3>알림</h3>
            <button class="mark-all-read" onclick="App.markAllNotificationsRead()">모두 읽음</button>
        </div>
        <div class="notification-list" id="notification-list">
            <div class="notification-loading">로딩 중...</div>
        </div>
    `;
    notificationBtn.parentElement.style.position = 'relative';
    notificationBtn.parentElement.appendChild(dropdown);
    
    // 클릭 이벤트
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            App.loadNotifications();
        }
    });

    // 드롭다운·종 버튼 바깥 클릭 시에만 닫기 (같은 클릭에서 바로 닫히는 현상 방지)
    document.addEventListener('click', function (e) {
        if (!dropdown.classList.contains('active')) return;
        var t = e.target;
        if (notificationBtn.contains(t) || dropdown.contains(t)) return;
        dropdown.classList.remove('active');
    });
    
    // 초기 로드
    App.updateNotificationBadge();
};

// 알림 개수 업데이트
App.updateNotificationBadge = async function() {
    try {
        const notificationBtn = App.getNotificationButton();
        const badgeEl = document.getElementById('notification-badge');

        if (App.usePublicMemberAnnouncements) {
            const mn =
                typeof App.getPublicMemberAnnouncementMemberNumber === 'function'
                    ? App.getPublicMemberAnnouncementMemberNumber()
                    : null;
            if (!mn) {
                if (badgeEl) {
                    badgeEl.remove();
                }
                return;
            }
            const res = await fetch((App.apiBase || '/api') + '/public/member-announcements');
            if (!res.ok) {
                throw new Error('public announcements');
            }
            const announcements = await res.json();
            const seenKey = 'mb_ann_seenMax_' + mn;
            let seenMax = localStorage.getItem(seenKey) || '';
            let unreadCount = 0;
            (announcements || []).forEach((a) => {
                if (!a || !a.isActive) {
                    return;
                }
                const t = a.updatedAt || a.createdAt;
                if (!t) {
                    unreadCount++;
                    return;
                }
                if (!seenMax || new Date(t) > new Date(seenMax)) {
                    unreadCount++;
                }
            });

            let deskUnreadMb = 0;
            try {
                const ur = await fetch(
                    (App.apiBase || '/api') +
                        '/public/member-desk-messages/unread-count?memberNumber=' +
                        encodeURIComponent(mn)
                );
                if (ur.ok) {
                    const ud = await ur.json();
                    deskUnreadMb = Number(ud.count) || 0;
                }
            } catch (e) {
                App.err('회원 데스크 미읽음 카운트 생략:', e);
            }

            var prevMbDesk = sessionStorage.getItem('mb_desk_unread_last');
            if (
                prevMbDesk !== null &&
                deskUnreadMb > Number(prevMbDesk) &&
                typeof App.showNotification === 'function'
            ) {
                App.showNotification('데스크에서 쪽지가 도착했습니다.', 'info');
            }
            sessionStorage.setItem('mb_desk_unread_last', String(deskUnreadMb));

            const totalBell = unreadCount + deskUnreadMb;
            if (totalBell > 0) {
                const label = totalBell > 9 ? '9+' : String(totalBell);
                if (!badgeEl && notificationBtn) {
                    const newBadge = document.createElement('span');
                    newBadge.id = 'notification-badge';
                    newBadge.className = 'notification-badge';
                    newBadge.textContent = label;
                    notificationBtn.appendChild(newBadge);
                } else if (badgeEl) {
                    badgeEl.textContent = label;
                }
            } else if (badgeEl) {
                badgeEl.remove();
            }
            return;
        }

        const announcements = await App.api.get('/announcements');
        const annCount = announcements.filter(
            (a) => a.isActive && a.hideFromStaffFeed !== true
        ).length;

        let deskCount = 0;
        try {
            const desk = await App.api.get('/member-desk-messages/badge-count');
            if (desk && desk.totalUnreadFromMembers != null) {
                deskCount = Number(desk.totalUnreadFromMembers) || 0;
            }
        } catch (deskErr) {
            App.err('회원 쪽지 배지 카운트 생략:', deskErr);
        }

        var prevDesk = sessionStorage.getItem('desk_unread_last');
        if (
            prevDesk !== null &&
            deskCount > Number(prevDesk) &&
            typeof App.showNotification === 'function'
        ) {
            App.showNotification('새 회원 쪽지가 있습니다.', 'info');
        }
        sessionStorage.setItem('desk_unread_last', String(deskCount));

        let smsNew = 0;
        try {
            const afterSms = parseInt(localStorage.getItem('staff_sms_last_seen_message_id') || '0', 10);
            const st = await App.api.get('/messages/stats/bell?afterId=' + afterSms);
            if (st && st.newCount != null) {
                smsNew = Number(st.newCount) || 0;
            }
        } catch (smsErr) {
            App.err('SMS 발송 종 알림 생략:', smsErr);
        }

        var prevSms = sessionStorage.getItem('sms_bell_last_count');
        if (
            prevSms !== null &&
            smsNew > Number(prevSms) &&
            typeof App.showNotification === 'function'
        ) {
            App.showNotification('새 메시지 발송 기록이 있습니다.', 'info');
        }
        sessionStorage.setItem('sms_bell_last_count', String(smsNew));

        const unreadCount = annCount + deskCount + smsNew;

        if (unreadCount > 0) {
            const label = unreadCount > 9 ? '9+' : String(unreadCount);
            if (!badgeEl && notificationBtn) {
                const newBadge = document.createElement('span');
                newBadge.id = 'notification-badge';
                newBadge.className = 'notification-badge';
                newBadge.textContent = label;
                notificationBtn.appendChild(newBadge);
            } else if (badgeEl) {
                badgeEl.textContent = label;
            }
        } else if (badgeEl) {
            badgeEl.remove();
        }
    } catch (error) {
        App.err('알림 개수 업데이트 실패:', error);
    }
};

// 알림 목록 로드
App.loadNotifications = async function() {
    const listElement = document.getElementById('notification-list');
    if (!listElement) return;
    
    try {
        function normalizeAnnouncementTitle(rawTitle, source) {
            if (source === 'SETTINGS_MEMBERSHIP_DUES') {
                return '회비 입금 전용계좌';
            }
            var title = String(rawTitle || '').trim();
            if (!title) return '공지사항';
            // 인코딩 깨짐으로 '2?' 같은 꼬리가 보일 때 보정
            title = title.replace(/(\d)\?$/g, '$1건');
            // 깨진 접두사 제거
            title = title.replace(/^\[\?\?\]\s*/, '');
            if (/^\?+(?:\s*\?+)*$/.test(title)) {
                return '공지사항';
            }
            return title || '공지사항';
        }

        let announcements;
        if (App.usePublicMemberAnnouncements) {
            const mn =
                typeof App.getPublicMemberAnnouncementMemberNumber === 'function'
                    ? App.getPublicMemberAnnouncementMemberNumber()
                    : null;
            if (!mn) {
                listElement.innerHTML =
                    '<div class="notification-empty">회원번호 확인 후 이용할 수 있습니다</div>';
                return;
            }
            const res = await fetch((App.apiBase || '/api') + '/public/member-announcements');
            if (!res.ok) {
                throw new Error('public announcements');
            }
            announcements = await res.json();
        } else {
            announcements = await App.api.get('/announcements');
        }

        const activeAnnouncements = announcements
            .filter((a) => a.isActive && a.hideFromStaffFeed !== true)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (App.usePublicMemberAnnouncements) {
            const mnPub =
                typeof App.getPublicMemberAnnouncementMemberNumber === 'function'
                    ? App.getPublicMemberAnnouncementMemberNumber()
                    : null;
            let publicDeskHtml = '';
            if (mnPub) {
                try {
                    const pr = await fetch(
                        (App.apiBase || '/api') +
                            '/public/member-desk-messages/unread-preview?memberNumber=' +
                            encodeURIComponent(mnPub)
                    );
                    if (pr.ok) {
                        const pd = await pr.json();
                        (pd.items || []).forEach(function (it) {
                            publicDeskHtml +=
                                '<div class="notification-item" onclick="if(typeof window.mbScrollToDeskFromBell===\'function\')window.mbScrollToDeskFromBell();">' +
                                '<div class="notification-icon">💬</div>' +
                                '<div class="notification-content">' +
                                '<div class="notification-title">데스크 쪽지</div>' +
                                '<div class="notification-time">' +
                                App.formatDateTime(it.createdAt) +
                                '</div>' +
                                '<div style="font-size:13px;opacity:0.92;margin-top:6px;line-height:1.45;white-space:pre-wrap;word-break:break-word;">' +
                                App.escapeHtml(it.contentPreview || '') +
                                '</div>' +
                                '</div></div>';
                        });
                    }
                } catch (e) {
                    App.err('데스크 쪽지 미리보기 생략:', e);
                }
            }
            if (!publicDeskHtml && activeAnnouncements.length === 0) {
                listElement.innerHTML = '<div class="notification-empty">새 알림이 없습니다</div>';
                return;
            }
            listElement.innerHTML =
                publicDeskHtml +
                activeAnnouncements
                    .map((announcement) => {
                        var icon = announcement.source === 'SETTINGS_MEMBERSHIP_DUES' ? '🏦' : '📢';
                        return (
                            '<div class="notification-item" onclick="App.viewAnnouncement(' +
                            announcement.id +
                            ')">' +
                            '<div class="notification-icon">' +
                            icon +
                            '</div>' +
                            '<div class="notification-content">' +
                            '<div class="notification-title">' +
                            App.escapeHtml(normalizeAnnouncementTitle(announcement.title, announcement.source)) +
                            '</div>' +
                            '<div class="notification-time">' +
                            App.formatDateTime(announcement.createdAt) +
                            '</div>' +
                            '</div></div>'
                        );
                    })
                    .join('');
            return;
        }

        // 회원 예약(비로그인 JWT)에서는 직원 전용 API 호출 시 401 → 로그인 이동 방지
        let deskUnread = 0;
        let smsNew = 0;
        if (!App.usePublicMemberAnnouncements) {
            try {
                const bc = await App.api.get('/member-desk-messages/badge-count');
                if (bc && bc.totalUnreadFromMembers != null) {
                    deskUnread = Number(bc.totalUnreadFromMembers) || 0;
                }
            } catch (e) {
                App.err('쪽지 배지 조회 생략:', e);
            }
            try {
                const afterSms = parseInt(localStorage.getItem('staff_sms_last_seen_message_id') || '0', 10);
                const st = await App.api.get('/messages/stats/bell?afterId=' + afterSms);
                if (st && st.newCount != null) {
                    smsNew = Number(st.newCount) || 0;
                }
            } catch (e2) {
                App.err('SMS 종 목록 생략:', e2);
            }
        }

        var deskBlock = '';
        if (!App.usePublicMemberAnnouncements && deskUnread > 0) {
            deskBlock =
                '<div class="notification-item" onclick="window.location.href=\'/announcements.html#desk-inbox-card\'">' +
                '<div class="notification-icon">💬</div>' +
                '<div class="notification-content">' +
                '<div class="notification-title">회원 쪽지 미읽음 ' +
                deskUnread +
                '건</div>' +
                '<div class="notification-time">공지/메시지 → 회원 쪽지함에서 확인</div>' +
                '</div></div>';
        }

        var smsBlock = '';
        if (!App.usePublicMemberAnnouncements && smsNew > 0) {
            smsBlock =
                '<div class="notification-item" onclick="window.location.href=\'/announcements.html#mb-messages-card\'">' +
                '<div class="notification-icon">📨</div>' +
                '<div class="notification-content">' +
                '<div class="notification-title">메시지 발송 신규 ' +
                smsNew +
                '건</div>' +
                '<div class="notification-time">공지/메시지 → 메시지 발송에서 확인</div>' +
                '</div></div>';
        }

        if (deskUnread === 0 && smsNew === 0 && activeAnnouncements.length === 0) {
            listElement.innerHTML = '<div class="notification-empty">새 알림이 없습니다</div>';
            return;
        }

        listElement.innerHTML =
            deskBlock +
            smsBlock +
            activeAnnouncements
                .map((announcement) => {
                    var icon = announcement.source === 'SETTINGS_MEMBERSHIP_DUES' ? '🏦' : '📢';
                    return (
                        '<div class="notification-item" onclick="App.viewAnnouncement(' +
                        announcement.id +
                        ')">' +
                        '<div class="notification-icon">' +
                        icon +
                        '</div>' +
                        '<div class="notification-content">' +
                        '<div class="notification-title">' +
                        App.escapeHtml(normalizeAnnouncementTitle(announcement.title, announcement.source)) +
                        '</div>' +
                        '<div class="notification-time">' +
                        App.formatDateTime(announcement.createdAt) +
                        '</div>' +
                        '</div></div>'
                    );
                })
                .join('');
    } catch (error) {
        App.err('알림 로드 실패:', error);
        listElement.innerHTML = '<div class="notification-empty">알림을 불러올 수 없습니다</div>';
    }
};

// 공지사항 보기
App.viewAnnouncement = function(id) {
    if (typeof App.resolveAnnouncementView === 'function' && App.resolveAnnouncementView(id)) {
        return;
    }
    var n = Number(id);
    if (n === -1) {
        var p =
            App.usePublicMemberAnnouncements && App.getPublicMemberAnnouncementMemberNumber
                ? fetch((App.apiBase || '/api') + '/public/member-announcements/-1').then((r) => {
                      if (!r.ok) {
                          throw new Error();
                      }
                      return r.json();
                  })
                : App.api.get('/announcements/-1');
        p.then(function(announcement) {
                App.showMembershipDuesAnnouncementModal(announcement);
            })
            .catch(function() {
                App.showNotification('알림 내용을 불러올 수 없습니다.', 'danger');
            });
        return;
    }
    window.location.href = '/announcements.html#' + id;
};

/** 회비 입금 전용계좌(설정 연동) 상세 모달 */
App.showMembershipDuesAnnouncementModal = function(announcement) {
    var title = (announcement && announcement.title) ? announcement.title : '회비 입금 전용계좌';
    var body = (announcement && announcement.content) ? announcement.content : '';
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.innerHTML = '<div class="modal" style="max-width: 520px; width: 92vw;">' +
        '<div class="modal-header">' +
        '<h2 class="modal-title">' + App.escapeHtml(title) + '</h2>' +
        '<button type="button" class="modal-close" aria-label="닫기">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div style="white-space: pre-wrap; line-height: 1.6; color: var(--text-primary);">' + App.escapeHtml(body) + '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary modal-close-btn">닫기</button>' +
        '</div></div>';
    document.body.appendChild(modal);
    function close() {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.modal-close-btn').addEventListener('click', close);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            close();
        }
    });
};

// 모두 읽음 처리
App.markAllNotificationsRead = async function() {
    if (App.usePublicMemberAnnouncements) {
        const mn =
            typeof App.getPublicMemberAnnouncementMemberNumber === 'function'
                ? App.getPublicMemberAnnouncementMemberNumber()
                : null;
        if (mn) {
            const seenKey = 'mb_ann_seenMax_' + mn;
            fetch((App.apiBase || '/api') + '/public/member-announcements')
                .then((r) => (r.ok ? r.json() : []))
                .then(function (list) {
                    let max = '';
                    (list || []).forEach(function (a) {
                        const t = a.updatedAt || a.createdAt;
                        if (t && (!max || new Date(t) > new Date(max))) {
                            max = t;
                        }
                    });
                    if (max) {
                        localStorage.setItem(seenKey, max);
                    }
                })
                .catch(function () {});
        }
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.remove();
        }
        App.showNotification('모든 알림을 읽음 처리했습니다', 'success');
        return;
    }
    try {
        await App.api.post('/member-desk-messages/mark-all-read', {});
    } catch (e) {
        App.err('회원 쪽지 일괄 읽음 실패:', e);
    }
    sessionStorage.setItem('desk_unread_last', '0');
    try {
        const st = await App.api.get('/messages/stats/bell?afterId=0');
        if (st && st.maxId != null) {
            localStorage.setItem('staff_sms_last_seen_message_id', String(st.maxId));
        }
    } catch (e) {
        App.err('SMS 발송 읽음 처리 생략:', e);
    }
    sessionStorage.setItem('sms_bell_last_count', '0');
    await App.updateNotificationBadge();
    App.showNotification('알림을 갱신했습니다. (회원 쪽지·메시지 발송 반영)', 'success');
};

// ========================================
// 다크 모드 시스템
// ========================================

App.initDarkMode = function() {
    // localStorage에서 테마 불러오기
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 초기 테마 설정 (저장된 값 > 시스템 설정 > 다크 모드)
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.body.classList.remove('green-gold-white-theme');
    } else if (savedTheme === 'green-gold-white') {
        document.body.classList.remove('light-mode');
        document.body.classList.add('green-gold-white-theme');
    } else {
        // 다크 모드 (기본값)
        document.body.classList.remove('light-mode');
        document.body.classList.remove('green-gold-white-theme');
    }
    
    // 토글 버튼 추가
    App.addDarkModeToggle();
    
    // MutationObserver로 topbar-right가 나타날 때 버튼 추가
    if (!App.themeObserver) {
        App.themeObserver = new MutationObserver((mutations) => {
            var p = window.location.pathname || '';
            if (p.indexOf('member-booking') !== -1) return;
            const topbarRight = document.querySelector('.topbar-right');
            if (topbarRight && !document.getElementById('theme-toggle-btn')) {
                App.addDarkModeToggle();
            }
        });
        
        // body를 관찰하여 DOM 변경 감지
        App.themeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 시스템 테마 변경 감지 (저장된 테마가 없을 때만)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                document.body.classList.remove('light-mode');
                document.body.classList.remove('green-gold-white-theme');
            } else {
                document.body.classList.add('light-mode');
                document.body.classList.remove('green-gold-white-theme');
            }
            App.updateDarkModeIcon();
        }
    });
};

App.addDarkModeToggle = function() {
    // 로그인 페이지에서는 실행하지 않음
    if (window.location.pathname === '/login.html' || window.location.pathname === '/login') {
        return;
    }
    // 회원 예약 공개 페이지: 상단 테마(모드) 전환 버튼 없음
    var path = window.location.pathname || '';
    if (path.indexOf('member-booking') !== -1) {
        return;
    }

    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) {
        // topbar-right가 아직 없으면 잠시 후 다시 시도 (최대 10번)
        if (!App.addDarkModeToggle.retryCount) {
            App.addDarkModeToggle.retryCount = 0;
        }
        if (App.addDarkModeToggle.retryCount < 10) {
            App.addDarkModeToggle.retryCount++;
            setTimeout(() => App.addDarkModeToggle(), 200);
        }
        return;
    }
    
    // 성공했으면 재시도 카운터 리셋
    App.addDarkModeToggle.retryCount = 0;
    
    // 이미 테마 영역이 있으면 컨테이너 통째로 제거 (버튼만 제거하면 라벨만 남아 아이콘이 사라짐)
    const existingContainer = document.querySelector('.theme-toggle-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.title = '테마 전환';
    
    // 현재 테마에 따라 아이콘 설정 (버튼이 DOM에 추가되기 전에 설정)
    const isLightMode = document.body.classList.contains('light-mode');
    const isGreenGoldWhite = document.body.classList.contains('green-gold-white-theme');
    
    if (isGreenGoldWhite) {
        toggleBtn.innerHTML = '🌙';
        toggleBtn.title = '다크 모드로 전환';
    } else if (isLightMode) {
        toggleBtn.innerHTML = '🎨';
        toggleBtn.title = '초록색-금색-흰색 테마로 전환';
    } else {
        toggleBtn.innerHTML = '☀️';
        toggleBtn.title = '라이트 모드로 전환';
    }
    
    toggleBtn.addEventListener('click', () => {
        App.toggleDarkMode();
    });
    
    // 테마 버튼을 컨테이너로 감싸고 "테마" 라벨 추가 (아이콘 박스 밖 아래에 표시)
    const themeContainer = document.createElement('div');
    themeContainer.className = 'theme-toggle-container';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'theme-toggle-label';
    themeLabel.textContent = '테마';
    themeContainer.appendChild(toggleBtn);
    themeContainer.appendChild(themeLabel);
    
    // topbar-right에 삽입 (알림이 감싸져 있으면 컨테이너 앞에, 아니면 버튼 앞에)
    const notificationBtn = document.getElementById('notification-btn');
    let insertBeforeRef = null;
    if (notificationBtn) {
        const notifContainer = notificationBtn.closest('.notification-btn-container');
        insertBeforeRef = (notifContainer && notifContainer.parentNode === topbarRight)
            ? notifContainer
            : (notificationBtn.parentNode === topbarRight ? notificationBtn : null);
        if (insertBeforeRef) {
            topbarRight.insertBefore(themeContainer, insertBeforeRef);
        } else {
            topbarRight.prepend(themeContainer);
        }
        App.wrapNotificationWithLabel(topbarRight);
    } else {
        topbarRight.prepend(themeContainer);
    }
    
    App.log('테마 토글 버튼 추가 완료');
    App.addAdminMemoButton();
    App.addOrgChartButton();
    App.addAdminCoachHomeButton();
    App.addProfitSheetButton();
    App.addCoachHomeDashboardButton();
};

/** 관리자 전용 메모 버튼 (대시보드 제목 표시줄, 테마 왼쪽) - 관리자만 표시 */
App.addAdminMemoButton = function() {
    const path = (window.location.pathname || '').replace(/\/$/, '') || '/';
    if (path !== '/' && path !== '/index.html') return;
    if (!App.currentUser || !App.currentUser.role || App.currentUser.role.toUpperCase() !== 'ADMIN') return;
    if (document.getElementById('admin-memo-btn')) return;
    const topbarRight = document.querySelector('.topbar-right');
    const themeContainer = document.querySelector('.theme-toggle-container');
    if (!topbarRight) return;
    const memoContainer = document.createElement('div');
    memoContainer.className = 'admin-memo-container';
    const memoBtn = document.createElement('button');
    memoBtn.type = 'button';
    memoBtn.className = 'admin-memo-btn';
    memoBtn.id = 'admin-memo-btn';
    memoBtn.title = '관리자 메모';
    memoBtn.innerHTML = '&#128221;';
    memoBtn.setAttribute('aria-label', '관리자 메모');
    const memoLabel = document.createElement('span');
    memoLabel.className = 'admin-memo-label';
    memoLabel.textContent = '메모';
    memoContainer.appendChild(memoBtn);
    memoContainer.appendChild(memoLabel);
    if (themeContainer && themeContainer.parentNode === topbarRight) {
        topbarRight.insertBefore(memoContainer, themeContainer);
    } else {
        topbarRight.prepend(memoContainer);
    }
    memoBtn.addEventListener('click', function() { App.openAdminMemoModal(); });
};

/** 관리자 전용 조직도 버튼 (메모 옆) - 관리자만 표시 */
App.addOrgChartButton = function() {
    const path = (window.location.pathname || '').replace(/\/$/, '') || '/';
    if (path !== '/' && path !== '/index.html') return;
    if (!App.currentUser || !App.currentUser.role || App.currentUser.role.toUpperCase() !== 'ADMIN') return;
    if (document.getElementById('org-chart-btn')) return;
    const topbarRight = document.querySelector('.topbar-right');
    const memoContainer = document.querySelector('.admin-memo-container');
    if (!topbarRight) return;
    const orgContainer = document.createElement('div');
    orgContainer.className = 'admin-memo-container org-chart-container';
    const orgBtn = document.createElement('button');
    orgBtn.type = 'button';
    orgBtn.className = 'admin-memo-btn org-chart-btn';
    orgBtn.id = 'org-chart-btn';
    orgBtn.title = '조직도';
    orgBtn.innerHTML = '&#127970;';
    orgBtn.setAttribute('aria-label', '조직도');
    const orgLabel = document.createElement('span');
    orgLabel.className = 'admin-memo-label org-chart-label';
    orgLabel.textContent = '조직도';
    orgContainer.appendChild(orgBtn);
    orgContainer.appendChild(orgLabel);
    if (memoContainer) {
        topbarRight.insertBefore(orgContainer, memoContainer);
    } else {
        const themeContainer = document.querySelector('.theme-toggle-container');
        if (themeContainer) topbarRight.insertBefore(orgContainer, themeContainer);
        else topbarRight.prepend(orgContainer);
    }
    orgBtn.addEventListener('click', function() { App.openOrgChartModal(); });
};

/** 관리자 전용: 운영 관리 화면 상단에 출근부(코치 홈)로 이동 */
App.addAdminCoachHomeButton = function() {
    const path = (window.location.pathname || '').replace(/\/$/, '') || '/';
    if (path === '/login.html' || path === '/login') return;
    if (path.indexOf('member-booking') !== -1) return;
    if (path === '/coach-home.html' || path.endsWith('/coach-home.html')) return;
    var subtitle = document.querySelector('.sidebar-subtitle');
    var isOps = subtitle && String(subtitle.textContent || '').indexOf('운영 관리') !== -1;
    if (!isOps) return;
    var role = String((App.currentUser && App.currentUser.role) || App.currentRole || '').toUpperCase();
    var operator = typeof App.isCoachHomeOperator === 'function' && App.isCoachHomeOperator();
    if (role !== 'ADMIN' && !operator) return;
    if (document.getElementById('admin-coach-home-btn')) return;
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;
    const wrap = document.createElement('div');
    wrap.className = 'admin-memo-container admin-coach-home-container';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-memo-btn';
    btn.id = 'admin-coach-home-btn';
    btn.title = '코치 홈';
    btn.innerHTML = '&#127968;';
    btn.setAttribute('aria-label', '코치 홈');
    const label = document.createElement('span');
    label.className = 'admin-memo-label';
    label.textContent = '코치 홈';
    wrap.appendChild(btn);
    wrap.appendChild(label);
    const orgContainer = document.querySelector('.org-chart-container');
    const memoContainer = document.querySelector('.admin-memo-container:not(.org-chart-container):not(.admin-coach-home-container)');
    if (orgContainer && orgContainer.parentNode === topbarRight) {
        topbarRight.insertBefore(wrap, orgContainer);
    } else if (memoContainer && memoContainer.parentNode === topbarRight) {
        topbarRight.insertBefore(wrap, memoContainer);
    } else {
        const themeContainer = document.querySelector('.theme-toggle-container');
        if (themeContainer && themeContainer.parentNode === topbarRight) {
            topbarRight.insertBefore(wrap, themeContainer);
        } else {
            topbarRight.prepend(wrap);
        }
    }
    btn.addEventListener('click', function() {
        window.location.href = '/coach-home.html';
    });
};

/** 관리자·지정 아이디 전용: 코치 홈 오른쪽 수기 정산표 */
App.addProfitSheetButton = function() {
    const path = (window.location.pathname || '').replace(/\/$/, '') || '/';
    if (path === '/login.html' || path === '/login') return;
    if (path.indexOf('member-booking') !== -1) return;
    if (path === '/profit-sheet.html' || path.endsWith('/profit-sheet.html')) return;
    var subtitle = document.querySelector('.sidebar-subtitle');
    var isOps = subtitle && String(subtitle.textContent || '').indexOf('운영 관리') !== -1;
    if (!isOps) return;
    if (typeof App.canSeeProfitSheet !== 'function' || !App.canSeeProfitSheet()) return;
    if (document.getElementById('admin-profit-sheet-btn')) return;
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;
    const wrap = document.createElement('div');
    wrap.className = 'admin-memo-container admin-profit-sheet-container';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-memo-btn';
    btn.id = 'admin-profit-sheet-btn';
    btn.title = '정산표';
    btn.innerHTML = '&#128212;';
    btn.setAttribute('aria-label', '정산표');
    const label = document.createElement('span');
    label.className = 'admin-memo-label';
    label.textContent = '정산표';
    wrap.appendChild(btn);
    wrap.appendChild(label);
    const homeWrap = document.querySelector('.admin-coach-home-container');
    if (homeWrap && homeWrap.parentNode === topbarRight) {
        homeWrap.insertAdjacentElement('afterend', wrap);
    } else {
        const orgContainer = document.querySelector('.org-chart-container');
        const memoContainer = document.querySelector('.admin-memo-container:not(.org-chart-container):not(.admin-coach-home-container):not(.admin-profit-sheet-container)');
        if (orgContainer && orgContainer.parentNode === topbarRight) {
            topbarRight.insertBefore(wrap, orgContainer);
        } else if (memoContainer && memoContainer.parentNode === topbarRight) {
            topbarRight.insertBefore(wrap, memoContainer);
        } else {
            const themeContainer = document.querySelector('.theme-toggle-container');
            if (themeContainer && themeContainer.parentNode === topbarRight) {
                topbarRight.insertBefore(wrap, themeContainer);
            } else {
                topbarRight.prepend(wrap);
            }
        }
    }
    btn.addEventListener('click', function() {
        window.location.href = '/profit-sheet.html';
    });
};

/** 코치 홈: 대시보드로 돌아가기 (대시보드의 코치 홈 아이콘과 대칭) */
App.addCoachHomeDashboardButton = function() {
    const path = (window.location.pathname || '').replace(/\/$/, '') || '/';
    if (path !== '/coach-home.html' && !path.endsWith('/coach-home.html')) return;
    const role = String((App.currentUser && App.currentUser.role) || App.currentRole || '').toUpperCase();
    var operator = typeof App.isCoachHomeOperator === 'function' && App.isCoachHomeOperator();
    if (role !== 'ADMIN' && role !== 'MANAGER' && !operator) return;
    if (document.getElementById('coach-home-dashboard-btn')) return;
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;
    const wrap = document.createElement('div');
    wrap.className = 'admin-memo-container coach-home-dashboard-container';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-memo-btn';
    btn.id = 'coach-home-dashboard-btn';
    btn.title = '대시보드';
    btn.innerHTML = '&#128202;';
    btn.setAttribute('aria-label', '대시보드');
    const label = document.createElement('span');
    label.className = 'admin-memo-label';
    label.textContent = '대시보드';
    wrap.appendChild(btn);
    wrap.appendChild(label);
    const themeContainer = document.querySelector('.theme-toggle-container');
    if (themeContainer && themeContainer.parentNode === topbarRight) {
        topbarRight.insertBefore(wrap, themeContainer);
    } else {
        const notificationBtn = document.querySelector('.notification-btn');
        if (notificationBtn && notificationBtn.parentNode === topbarRight) {
            topbarRight.insertBefore(wrap, notificationBtn);
        } else {
            topbarRight.prepend(wrap);
        }
    }
    btn.addEventListener('click', function() {
        window.location.href = '/';
    });
};

var _adminMemoSaveTimeout = null;
var ADMIN_MEMO_STORAGE_KEY = 'afbs_dashboard_admin_memo';

App.openAdminMemoModal = function() {
    let modal = document.getElementById('admin-memo-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-memo-modal';
        modal.className = 'admin-memo-modal-overlay';
        modal.innerHTML = '<div class="admin-memo-modal">' +
            '<div class="admin-memo-modal-header">' +
            '<h3 class="admin-memo-modal-title">관리자 메모</h3>' +
            '<span class="admin-memo-saved" id="admin-memo-saved"></span>' +
            '<button type="button" class="admin-memo-modal-close" aria-label="닫기">&times;</button>' +
            '</div>' +
            '<textarea class="admin-memo-textarea" id="admin-memo-textarea" placeholder="메모를 입력하세요. 자동으로 저장됩니다."></textarea>' +
            '</div>';
        document.body.appendChild(modal);
        var textarea = document.getElementById('admin-memo-textarea');
        var savedEl = document.getElementById('admin-memo-saved');
        try {
            textarea.value = localStorage.getItem(ADMIN_MEMO_STORAGE_KEY) || '';
        } catch (e) { textarea.value = ''; }
        function saveMemo() {
            try {
                localStorage.setItem(ADMIN_MEMO_STORAGE_KEY, textarea.value);
                if (savedEl) {
                    savedEl.textContent = '저장됨';
                    savedEl.classList.add('visible');
                    setTimeout(function() { savedEl.classList.remove('visible'); savedEl.textContent = ''; }, 1500);
                }
            } catch (e) {}
        }
        textarea.addEventListener('input', function() {
            clearTimeout(_adminMemoSaveTimeout);
            _adminMemoSaveTimeout = setTimeout(saveMemo, 500);
        });
        textarea.addEventListener('blur', saveMemo);
        modal.querySelector('.admin-memo-modal-close').addEventListener('click', App.closeAdminMemoModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) App.closeAdminMemoModal();
        });
    }
    var textarea = document.getElementById('admin-memo-textarea');
    if (textarea) {
        try { textarea.value = localStorage.getItem(ADMIN_MEMO_STORAGE_KEY) || ''; } catch (e) { textarea.value = ''; }
    }
    modal.classList.add('open');
    if (textarea) { textarea.focus(); }
    var onEscape = function(e) {
        if (e.key === 'Escape') {
            App.closeAdminMemoModal();
            document.removeEventListener('keydown', onEscape);
        }
    };
    document.addEventListener('keydown', onEscape);
    modal._adminMemoEscape = onEscape;
};

App.closeAdminMemoModal = function() {
    var modal = document.getElementById('admin-memo-modal');
    if (modal) {
        clearTimeout(_adminMemoSaveTimeout);
        _adminMemoSaveTimeout = null;
        var textarea = document.getElementById('admin-memo-textarea');
        if (textarea) try { localStorage.setItem(ADMIN_MEMO_STORAGE_KEY, textarea.value); } catch (e) {}
        if (modal._adminMemoEscape) document.removeEventListener('keydown', modal._adminMemoEscape);
        modal.classList.remove('open');
    }
};

/** 조직도: 코치 이름별 고정 직책 (관리자용) */
var ORG_CHART_ROLES = {
    '서정민': '대표',
    '서정훈': '이사',
    '조장우': '메인코치',
    '이원준': '메인코치',
    '박준현': '메인 트레이너',
    '김가영': '메인 필라테스'
};
var ORG_CHART_ORDER = ['서정민', '서정훈', '조장우', '이원준', '박준현', '김가영'];

App.openOrgChartModal = function() {
    var modal = document.getElementById('org-chart-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'org-chart-modal';
        modal.className = 'admin-memo-modal-overlay org-chart-modal-overlay';
        modal.innerHTML = '<div class="admin-memo-modal org-chart-modal">' +
            '<div class="admin-memo-modal-header">' +
            '<h3 class="admin-memo-modal-title">AF Baseball Center Organization Chart</h3>' +
            '<button type="button" class="admin-memo-modal-close" aria-label="닫기">&times;</button>' +
            '</div>' +
            '<div class="org-chart-body" id="org-chart-body">로딩 중...</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.querySelector('.admin-memo-modal-close').addEventListener('click', App.closeOrgChartModal);
        modal.addEventListener('click', function(e) { if (e.target === modal) App.closeOrgChartModal(); });
    }
    modal.classList.add('open');
    var body = document.getElementById('org-chart-body');
    if (body) body.innerHTML = '로딩 중...';
    (async function() {
        try {
            function baseName(full) {
                var s = (full || '').trim();
                var idx = s.indexOf(' [');
                return (idx >= 0 ? s.substring(0, idx) : s).trim();
            }
            var list = await App.api.get('/coaches');
            var coaches = Array.isArray(list) ? list : [];
            var byBaseName = {};
            coaches.forEach(function(c) {
                var b = baseName(c.name);
                if (b) byBaseName[b] = c;
            });
            function getCategory(spec, name) {
                var s = ((spec || '') + ' ' + (name || '')).toLowerCase();
                if (/대관|\[대관담당\]/.test(s)) return '대관';
                if (/\[트레이너\]|트레이닝/.test(s)) return '트레이닝';
                if (/\[강사\]|필라테스/.test(s)) return '필라테스';
                if (/유소년/.test(s)) return '유소년';
                if (/\[대표\]|\[코치\]|\[포수코치\]|\[투수코치\]|야구|타격|투구|수비|포수|투수/.test(s)) return '야구';
                return '기타';
            }
            var top = [];
            var directorRow = [];
            var mainRow = [];
            var restByBase = {};
            var first = ORG_CHART_ORDER[0];
            if (first) {
                var c = byBaseName[first];
                var title = ORG_CHART_ROLES[first] || '';
                top.push({ name: c ? c.name : first, title: title, coach: c });
            }
            var second = ORG_CHART_ORDER[1];
            if (second) {
                var c = byBaseName[second];
                var title = ORG_CHART_ROLES[second] || '';
                directorRow.push({ name: c ? c.name : second, title: title, coach: c });
            }
            for (var i = 2; i < ORG_CHART_ORDER.length; i++) {
                var name = ORG_CHART_ORDER[i];
                var c = byBaseName[name];
                var title = ORG_CHART_ROLES[name] || '';
                mainRow.push({ name: c ? c.name : name, title: title, coach: c });
            }
            coaches.forEach(function(c) {
                var n = (c.name || '').trim();
                var b = baseName(n);
                if (!b || ORG_CHART_ORDER.indexOf(b) >= 0) return;
                if (!restByBase[b]) {
                    restByBase[b] = { name: n, title: (c.specialties || '').replace(/\s*\[.*?\]\s*/g, ' ').trim() || '코치', coach: c };
                }
            });
            var rest = Object.keys(restByBase).map(function(b) { return restByBase[b]; });
            rest.sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'ko'); });
            var byCategory = { '야구': [], '유소년': [], '필라테스': [], '트레이닝': [], '대관': [], '기타': [] };
            var catOrder = ['야구', '유소년', '트레이닝', '필라테스', '기타'];
            rest.forEach(function(item) {
                var cat = getCategory(item.coach ? item.coach.specialties : '', item.name);
                if (byCategory[cat]) byCategory[cat].push(item);
                else byCategory['기타'].push(item);
            });
            function nameWithTitle(name, title) {
                var n = (name || '').replace(/\s*\[[^\]]*\]\s*$/, '').trim() || (name || '').trim();
                var t = (title || '').trim();
                return t ? n + ' ' + t : n;
            }
            var html = '';
            if (top.length) {
                var ceoLine = nameWithTitle(top[0].name, top[0].title);
                html += '<div class="org-chart-level org-chart-level-1">';
                html += '<div class="org-chart-one-cell org-chart-one-cell-ceo">';
                html += '<div class="org-chart-one-cell-head org-chart-node-ceo">' + App.escapeHtml(ceoLine) + '</div>';
                html += '<div class="org-chart-one-cell-divider"></div>';
                html += '<div class="org-chart-one-cell-body org-chart-one-cell-body-ceo">야구 총괄</div>';
                html += '</div></div>';
            }
            var rentalList = byCategory['대관'] || [];
            if (directorRow.length) {
                html += '<div class="org-chart-connector-wrap">';
                html += '<div class="org-chart-connector"></div>';
                html += '<div class="org-chart-level org-chart-level-2">';
                directorRow.forEach(function(item) {
                    var directorLine = nameWithTitle(item.name, item.title);
                    html += '<div class="org-chart-one-cell">';
                    html += '<div class="org-chart-one-cell-head">' + App.escapeHtml(directorLine) + '</div>';
                    html += '<div class="org-chart-one-cell-divider"></div>';
                    html += '<div class="org-chart-one-cell-body">';
                    html += '<div class="org-chart-level-label">운영/대관</div>';
                    rentalList.filter(function(r) {
                        var n = (r.name || '').trim();
                        var b = baseName(n);
                        if (b === '서정훈') return false;
                        if (n.indexOf('서정훈') === 0) return false;
                        return true;
                    }).forEach(function(r) {
                        var spec = r.title ? ('<span class="org-chart-role">' + App.escapeHtml(r.title) + '</span>') : '';
                        html += '<div class="org-chart-node org-chart-node-rest org-chart-node-vertical"><span class="org-chart-name">' + App.escapeHtml(r.name) + '</span>' + spec + '</div>';
                    });
                    html += '</div></div>';
                });
                html += '</div></div>';
            }
            if (mainRow.length) {
                html += '<div class="org-chart-connector-wrap">';
                html += '<div class="org-chart-connector"></div>';
                html += '<div class="org-chart-level org-chart-level-3">';
                mainRow.forEach(function(item) {
                    var displayName = (baseName(item.name) === '김가영') ? '김가영 [필라테스]' : item.name;
                    html += '<div class="org-chart-node"><span class="org-chart-name">' + App.escapeHtml(displayName) + '</span><span class="org-chart-role">' + App.escapeHtml(item.title) + '</span></div>';
                });
                html += '</div></div>';
            }
            var catLabels = { '유소년': '야구(유소년)', '트레이닝': '트레이너' };
            var hasRest = catOrder.some(function(cat) { var list = byCategory[cat]; return (list && list.length > 0) || cat === '트레이닝'; });
            if (hasRest) {
                html += '<div class="org-chart-connector-wrap">';
                html += '<div class="org-chart-connector"></div>';
                html += '<div class="org-chart-level org-chart-level-4 org-chart-by-category">';
                var catsWithContent = catOrder.filter(function(cat) { var list = byCategory[cat]; return (list && list.length > 0) || cat === '트레이닝'; });
                catsWithContent.forEach(function(cat) {
                    var list = byCategory[cat] || [];
                    html += '<div class="org-chart-category-column">';
                    html += '<div class="org-chart-level-label">' + App.escapeHtml(catLabels[cat] || cat) + '</div>';
                    list.forEach(function(item) {
                        html += '<div class="org-chart-node org-chart-node-rest org-chart-node-vertical"><span class="org-chart-name">' + App.escapeHtml(item.name) + '</span></div>';
                    });
                    if (cat === '트레이닝') {
                        html += '<div class="org-chart-node org-chart-node-rest org-chart-node-vertical org-chart-empty-slot" aria-hidden="true">&nbsp;</div>';
                    }
                    html += '</div>';
                });
                html += '</div></div>';
            }
            if (body) body.innerHTML = html || '<p class="org-chart-empty">등록된 코치가 없습니다.</p>';
        } catch (e) {
            App.err('조직도 로드 실패:', e);
            if (body) body.innerHTML = '<p class="org-chart-error">조직도를 불러오지 못했습니다.</p>';
        }
    })();
    var onEscape = function(e) {
        if (e.key === 'Escape') { App.closeOrgChartModal(); document.removeEventListener('keydown', onEscape); }
    };
    document.addEventListener('keydown', onEscape);
    modal._orgChartEscape = onEscape;
};

App.closeOrgChartModal = function() {
    var modal = document.getElementById('org-chart-modal');
    if (modal) {
        if (modal._orgChartEscape) document.removeEventListener('keydown', modal._orgChartEscape);
        modal.classList.remove('open');
    }
};

/** 알림 버튼을 컨테이너로 감싸고 "알림" 라벨을 아이콘 박스 밖 아래에 추가 (모든 페이지 공통) */
App.wrapNotificationWithLabel = function(topbarRight) {
    const notificationBtn = document.getElementById('notification-btn') || document.querySelector('.topbar-right .notification-btn');
    if (!notificationBtn || notificationBtn.closest('.notification-btn-container')) return;
    const container = document.createElement('div');
    container.className = 'notification-btn-container';
    const label = document.createElement('span');
    label.className = 'notification-btn-label';
    label.textContent = '알림';
    notificationBtn.parentNode.insertBefore(container, notificationBtn);
    container.appendChild(notificationBtn);
    container.appendChild(label);
};

App.toggleDarkMode = function() {
    const body = document.body;
    const isLightMode = body.classList.contains('light-mode');
    const isGreenGoldWhite = body.classList.contains('green-gold-white-theme');
    
    // 테마 순환: 다크 모드 -> 라이트 모드 -> 초록색-금색-흰색 -> 다크 모드
    if (isGreenGoldWhite) {
        // 초록색-금색-흰색 -> 다크 모드
        body.classList.remove('green-gold-white-theme');
        body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
    } else if (isLightMode) {
        // 라이트 모드 -> 초록색-금색-흰색
        body.classList.remove('light-mode');
        body.classList.add('green-gold-white-theme');
        localStorage.setItem('theme', 'green-gold-white');
    } else {
        // 다크 모드 -> 라이트 모드
        body.classList.add('light-mode');
        body.classList.remove('green-gold-white-theme');
        localStorage.setItem('theme', 'light');
    }
    
    App.updateDarkModeIcon();
    
    // 부드러운 전환 효과
    body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        body.style.transition = '';
    }, 300);
};

App.updateDarkModeIcon = function() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        const isLightMode = document.body.classList.contains('light-mode');
        const isGreenGoldWhite = document.body.classList.contains('green-gold-white-theme');
        
        if (isGreenGoldWhite) {
            toggleBtn.innerHTML = '🌙';
            toggleBtn.title = '다크 모드로 전환';
        } else if (isLightMode) {
            toggleBtn.innerHTML = '🎨';
            toggleBtn.title = '초록색-금색-흰색 테마로 전환';
        } else {
            toggleBtn.innerHTML = '☀️';
            toggleBtn.title = '라이트 모드로 전환';
        }
    }
};

// 스크린샷 발췌 미리보기: 개인정보 마스킹 — 이름/회원번호 컬럼인 td만 마스킹 (헤더 기준)
App.applyPageMask = function() {
    function getHeaderText(thOrTd) {
        return (thOrTd && thOrTd.textContent || '').trim();
    }
    function isNameColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /이름|회원명|코치|담당|성명|작성자/.test(h);
    }
    function isMemberNoColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /회원번호/.test(h) || (h === '번호');
    }
    function isSchoolGradeColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /학교|소속|등급/.test(h);
    }
    function isCumulativePaymentColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /누적결제|누적\s*결제/.test(h);
    }
    function maskCellText(td, doName, doMemberNo, doSchoolGrade, doCumulativePayment) {
        var walk = function(node) {
            if (!node) return;
            if (node.nodeType === 3) {
                var text = node.textContent;
                if (!text) return;
                var s = text;
                if ((doSchoolGrade || doCumulativePayment)) {
                    s = '*'.repeat(text.length);
                }
                if (doMemberNo) {
                    s = s.replace(/\bM(\d+)\b/g, function(_, digits) {
                        return 'M' + '*'.repeat(digits.length);
                    });
                }
                if (doName) {
                    var brackets = [];
                    s = s.replace(/\[[^\]]*\]/g, function(m) {
                        brackets.push(m);
                        return '\uFFFC' + (brackets.length - 1) + '\uFFFC';
                    });
                    var surnameFirst = '김이박최정강조윤장임한오서신권황안송류전홍문양손배백허유남심노하곽성차주우구선설마사방위봉탁연공반옥추변석염지진현알';
                    var skipWords = '임박';
                    s = s.replace(/([가-힣])([가-힣]{1,2})/g, function(match, first, rest) {
                        if (skipWords.indexOf(match) >= 0) return match;
                        if (surnameFirst.indexOf(first) === -1) return match;
                        return first + '*'.repeat(rest.length);
                    });
                    s = s.replace(/\uFFFC(\d+)\uFFFC/g, function(_, i) {
                        return brackets[parseInt(i, 10)] || '';
                    });
                }
                if (s !== text) node.textContent = s;
                return;
            }
            if ((node.tagName || '').toUpperCase() === 'SCRIPT' || (node.tagName || '').toUpperCase() === 'STYLE') return;
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        };
        walk(td);
    }
    var tables = document.body.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
        var table = tables[t];
        var headerRow = table.querySelector('thead tr') || table.rows[0];
        if (!headerRow || !headerRow.cells) continue;
        var headers = [];
        for (var c = 0; c < headerRow.cells.length; c++) {
            headers.push(getHeaderText(headerRow.cells[c]));
        }
        var rows = table.querySelectorAll('tbody tr');
        if (!rows.length) rows = [];
        for (var r = 0; r < table.rows.length; r++) {
            var row = table.rows[r];
            if (row === headerRow) continue;
            for (var col = 0; col < row.cells.length; col++) {
                var cell = row.cells[col];
                if ((cell.tagName || '').toUpperCase() !== 'TD') continue;
                var colIndex = cell.cellIndex;
                if (colIndex < 0 || colIndex >= headers.length) continue;
                var header = headers[colIndex];
                var doName = isNameColumn(header);
                var doMemberNo = isMemberNoColumn(header);
                var doSchoolGrade = isSchoolGradeColumn(header);
                var doCumulativePayment = isCumulativePaymentColumn(header);
                if (doName || doMemberNo || doSchoolGrade || doCumulativePayment) maskCellText(cell, doName, doMemberNo, doSchoolGrade, doCumulativePayment);
            }
        }
    }
    function isInsideTd(node) {
        var p = node && (node.nodeType === 1 ? node : node.parentElement);
        while (p) {
            if ((p.tagName || '').toUpperCase() === 'TD') return true;
            p = p.parentElement;
        }
        return false;
    }
    function isInsideTitle(node) {
        var p = node && (node.nodeType === 1 ? node : node.parentElement);
        while (p) {
            var tag = (p.tagName || '').toUpperCase();
            if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') return true;
            if (p.classList && p.classList.contains('card-title')) return true;
            p = p.parentElement;
        }
        return false;
    }
    function isInsideRankingsFilter(node) {
        var p = node && (node.nodeType === 1 ? node : node.parentElement);
        while (p) {
            if (p.classList && p.classList.contains('rankings-filter-card')) return true;
            p = p.parentElement;
        }
        return false;
    }
    function applyInlineMask(text) {
        var s = text;
        s = s.replace(/\bM(\d+)\b/g, function(_, digits) { return 'M' + '*'.repeat(digits.length); });
        var brackets = [];
        s = s.replace(/\[[^\]]*\]/g, function(m) { brackets.push(m); return '\uFFFC' + (brackets.length - 1) + '\uFFFC'; });
        var surnameFirst = '김이박최정강조윤장임한오서신권황안송류전홍문양손배백허유남심노하곽성차주우구선설마사방위봉탁연공반옥추변석염지진현알';
        var skipWords = '임박';
        s = s.replace(/([가-힣])([가-힣]{1,2})/g, function(match, first, rest) {
            if (skipWords.indexOf(match) >= 0) return match;
            if (surnameFirst.indexOf(first) === -1) return match;
            return first + '*'.repeat(rest.length);
        });
        s = s.replace(/\uFFFC(\d+)\uFFFC/g, function(_, i) { return brackets[parseInt(i, 10)] || ''; });
        return s;
    }
    var skipTags = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1 };
    function walkNonTable(node) {
        if (!node) return;
        if (node.nodeType === 3) {
            var parent = node.parentElement;
            if (!parent || skipTags[(parent.tagName || '').toUpperCase()]) return;
            if (isInsideTd(node)) return;
            if (isInsideTitle(node)) return;
            if (isInsideRankingsFilter(node)) return;
            var text = node.textContent;
            if (!text || !text.trim()) return;
            var s = applyInlineMask(text);
            if (s !== text) node.textContent = s;
            return;
        }
        if (skipTags[(node.tagName || '').toUpperCase()]) return;
        for (var i = 0; i < node.childNodes.length; i++) walkNonTable(node.childNodes[i]);
    }
    walkNonTable(document.body);
};

// 모바일: 사이드바 토글 버튼·오버레이 추가 (고정 사이드바로 인한 본문 가림 해결)
function initMobileSidebar() {
    if (window.location.search.indexOf('embed=1') >= 0) return;
    var sidebar = document.querySelector('.sidebar');
    var topbarLeft = document.querySelector('.topbar-left');
    if (!sidebar || !topbarLeft) return;
    if (document.getElementById('sidebar-toggle')) return;
    var overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', function() { document.body.classList.remove('sidebar-open'); });
    document.body.appendChild(overlay);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-toggle-btn';
    btn.id = 'sidebar-toggle';
    btn.title = '메뉴';
    btn.innerHTML = '\u2630';
    btn.setAttribute('aria-label', '메뉴 열기');
    btn.addEventListener('click', function() { document.body.classList.toggle('sidebar-open'); });
    topbarLeft.insertBefore(btn, topbarLeft.firstChild);
    sidebar.querySelectorAll('.menu-item').forEach(function(link) {
        link.addEventListener('click', function() { document.body.classList.remove('sidebar-open'); });
    });
}

// 스크린샷 발췌 미리보기: iframe에서 embed=1 로 열리면 사이드바/상단바 숨기고 본문만 표시
document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('embed') === '1') {
        var sidebar = document.querySelector('.sidebar');
        var topbar = document.querySelector('.topbar');
        var main = document.querySelector('main.main-content');
        if (sidebar) sidebar.style.display = 'none';
        if (topbar) topbar.style.display = 'none';
        if (main) {
            main.style.marginLeft = '0';
            main.style.maxWidth = 'none';
        }
        document.body.style.overflow = 'auto';
        if (window.parent !== window) {
            setTimeout(function() { window.parent.postMessage('screenshot-export-ready', '*'); }, 0);
        }
    }
    if (params.get('mask') === '1' && typeof App.applyPageMask === 'function') {
        var maskTimer = null;
        function runMask() {
            App.applyPageMask();
            if (window.parent !== window) {
                window.parent.postMessage('screenshot-export-ready', '*');
            }
        }
        setTimeout(runMask, 100);
        setTimeout(runMask, 1500);
        try {
            var maskObserver = new MutationObserver(function(mutations) {
                var hasAdd = false;
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length) { hasAdd = true; break; }
                }
                if (!hasAdd) return;
                if (maskTimer) clearTimeout(maskTimer);
                maskTimer = setTimeout(runMask, 80);
            });
            maskObserver.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    var pathOnly = window.location.pathname || '';
    // 로그인·회원 공개 예약 — 생략 / 랭킹은 비로그인일 때만 생략 (로그인 직원은 검색·알림 유지)
    var isMbPath = pathOnly === '/member-booking.html' || pathOnly.endsWith('/member-booking.html');
    var isRankPath = pathOnly === '/rankings.html' || pathOnly.endsWith('/rankings.html');
    var hasToken = !!(typeof App.getAuthToken === 'function' && App.getAuthToken());
    var skipHeavyInit =
        pathOnly === '/login.html' ||
        pathOnly === '/login' ||
        isMbPath ||
        (isRankPath && !hasToken);
    if (!skipHeavyInit) {
        App.initDarkMode();
        App.initNotifications();
        App.initSearch();
        initMobileSidebar();
        // 1분마다 알림 개수(공지 + 회원 쪽지 미읽음) 갱신
        setInterval(() => App.updateNotificationBadge(), 60 * 1000);
        
        // topbar-right: 테마·알림·사용자 아이콘+글씨 (모든 페이지 동일 적용)
        setTimeout(() => {
            App.addDarkModeToggle();
            const tr = document.querySelector('.topbar-right');
            if (tr) App.wrapNotificationWithLabel(tr);
        }, 100);
        setTimeout(() => {
            if (!document.getElementById('theme-toggle-btn')) App.addDarkModeToggle();
            const tr = document.querySelector('.topbar-right');
            if (tr) App.wrapNotificationWithLabel(tr);
        }, 300);
        setTimeout(() => {
            if (!document.getElementById('theme-toggle-btn')) App.addDarkModeToggle();
            const tr = document.querySelector('.topbar-right');
            if (tr) App.wrapNotificationWithLabel(tr);
        }, 800);
    } else if (pathOnly === '/member-booking.html' || pathOnly.endsWith('/member-booking.html')) {
        App.initDarkMode();
        initMobileSidebar();
    }
});

// ========================================
// 전역 검색 시스템
// ========================================

App.initSearch = function() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;
    
    // 검색 결과 드롭다운 생성
    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.id = 'search-dropdown';
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(dropdown);
    
    let searchTimeout;
    
    // 입력 이벤트
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            dropdown.classList.remove('active');
            return;
        }
        
        searchTimeout = setTimeout(() => {
            App.performSearch(query);
        }, 300);
    });
    
    // 포커스 이벤트
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
            dropdown.classList.add('active');
        }
    });
    
    // Enter 키 이벤트
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                App.performSearch(query);
            }
        }
    });
    
    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (!searchInput.parentElement.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
};

// 검색 실행
App.performSearch = async function(query) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<div class="search-loading">검색 중...</div>';
    dropdown.classList.add('active');
    
    try {
        // 병렬로 검색
        const [members, bookings] = await Promise.all([
            App.api.get('/members').catch(() => []),
            App.api.get('/bookings').catch(() => [])
        ]);
        
        // 회원 검색 (이름, 전화번호, 회원번호)
        const memberResults = members.filter(m => 
            m.name?.toLowerCase().includes(query.toLowerCase()) ||
            m.phoneNumber?.includes(query) ||
            m.memberNumber?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
        
        // 예약 검색 (회원명)
        const bookingResults = bookings.filter(b =>
            b.memberName?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);
        
        // 결과 렌더링
        let html = '';
        
        if (memberResults.length > 0) {
            html += '<div class="search-section">';
            html += '<div class="search-section-title">회원</div>';
            html += memberResults.map(m => `
                <div class="search-item" onclick="window.location.href='/members.html#${m.id}'">
                    <div class="search-icon">👤</div>
                    <div class="search-content">
                        <div class="search-title">${App.escapeHtml(m.name || '')}</div>
                        <div class="search-subtitle">${App.escapeHtml(m.phoneNumber || '')} • ${App.escapeHtml(m.memberNumber || '')}</div>
                    </div>
                </div>
            `).join('');
            html += '</div>';
        }
        
        if (bookingResults.length > 0) {
            html += '<div class="search-section">';
            html += '<div class="search-section-title">예약</div>';
            html += bookingResults.map(b => `
                <div class="search-item" onclick="window.location.href='/bookings.html#${b.id}'">
                    <div class="search-icon">📅</div>
                    <div class="search-content">
                        <div class="search-title">${App.escapeHtml(b.memberName || '이름 없음')}</div>
                        <div class="search-subtitle">${App.formatDate(b.bookingDate)} • ${App.escapeHtml(b.facilityName || '')}</div>
                    </div>
                </div>
            `).join('');
            html += '</div>';
        }
        
        if (html === '') {
            html = '<div class="search-empty">검색 결과가 없습니다</div>';
        }
        
        dropdown.innerHTML = html;
        
    } catch (error) {
        App.err('검색 실패:', error);
        dropdown.innerHTML = '<div class="search-empty">검색 중 오류가 발생했습니다</div>';
    }
};

// ========================================
// 애니메이션 CSS
// ========================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    /* 알림 드롭다운 스타일 */
    .notification-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 360px;
        max-height: 480px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        display: none;
        flex-direction: column;
        z-index: 1000;
    }
    
    .notification-dropdown.active {
        display: flex;
    }
    
    .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .notification-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .mark-all-read {
        background: none;
        border: none;
        color: var(--primary-color);
        font-size: 13px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: var(--radius-md);
    }
    
    .mark-all-read:hover {
        background: var(--bg-tertiary);
    }
    
    .notification-list {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
    }
    
    .notification-item {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .notification-item:hover {
        background: var(--bg-secondary);
    }
    
    .notification-item:last-child {
        border-bottom: none;
    }
    
    .notification-icon {
        font-size: 24px;
        flex-shrink: 0;
    }
    
    .notification-content {
        flex: 1;
        min-width: 0;
    }
    
    .notification-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .notification-time {
        font-size: 12px;
        color: var(--text-muted);
    }
    
    .notification-empty,
    .notification-loading {
        padding: 40px 16px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
    }
    
    .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: var(--accent-primary);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 5px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
    }
    
    .notification-btn {
        position: relative;
    }
    
    /* 검색 드롭다운 스타일 */
    .search-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        max-height: 480px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        display: none;
        flex-direction: column;
        overflow-y: auto;
        z-index: 1000;
    }
    
    .search-dropdown.active {
        display: flex;
    }
    
    .search-section {
        padding: 8px 0;
    }
    
    .search-section + .search-section {
        border-top: 1px solid var(--border-color);
    }
    
    .search-section-title {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
    }
    
    .search-item {
        display: flex;
        gap: 12px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .search-item:hover {
        background: var(--bg-secondary);
    }
    
    .search-icon {
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .search-content {
        flex: 1;
        min-width: 0;
    }
    
    .search-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .search-subtitle {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .search-empty,
    .search-loading {
        padding: 40px 16px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
    }
    
    /* 다크 모드 토글 버튼 - 알림/사용자 버튼과 같은 행·같은 크기 */
    .theme-toggle-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: var(--radius-md);
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        flex-shrink: 0;
    }
    
    .theme-toggle-btn:hover {
        background: var(--bg-tertiary);
    }

    .calendar-event.booking-missing-pass {
        background-color: #E74C3C !important;
        border-left-color: #c0392b !important;
        color: #fff !important;
    }
    .table tbody tr.booking-missing-pass td {
        background-color: #E74C3C !important;
        color: #fff;
    }
    .table tbody tr.booking-missing-pass:hover td {
        background-color: #c0392b !important;
        color: #fff;
    }
    body.unlinked-pass-admin .table tbody tr.booking-missing-pass td {
        background-color: transparent !important;
        color: var(--text-primary) !important;
    }
    body.unlinked-pass-admin .table tbody tr.booking-missing-pass:hover td {
        background-color: var(--bg-tertiary) !important;
        color: var(--text-primary) !important;
    }
`;

// ========================================
// 예약 복사 유틸리티 함수
// ========================================

/**
 * 예약을 다른 날짜로 복사하는 공통 함수
 * @param {number} sourceBookingId - 원본 예약 ID
 * @param {object} sourceBooking - 원본 예약 객체 (선택적)
 * @param {string} targetDateStr - 대상 날짜 (YYYY-MM-DD 형식)
 * @param {string} branch - 지점 코드 (SAHA, YEONSAN, RENTAL 등)
 * @param {function} onSuccess - 성공 시 콜백 (선택적)
 */
window.copyBookingToDate = async function(sourceBookingId, sourceBooking, targetDateStr, branch, onSuccess) {
    try {
        // 원본 예약 데이터 로드
        const booking = await App.api.get(`/bookings/${sourceBookingId}`);
        
        const memberProductId = booking.memberProductId != null ? booking.memberProductId : (booking.memberProduct && booking.memberProduct.id != null ? booking.memberProduct.id : null);
        if (booking.member && booking.member.id) {
            let mp = booking.memberProduct || {};
            if (memberProductId) {
                try {
                    const fetched = await App.api.get('/member-products/' + memberProductId);
                    if (fetched) mp = fetched;
                } catch (e) {
                    /* 원본 예약의 이용권 정보로 검사 */
                }
            }
            const productType = (mp.product && mp.product.type) || mp.productType || null;
            const passErr = App.assertMemberPassForSave({
                isMember: true,
                memberProductId: memberProductId,
                productType: productType,
                remainingCount: mp.remainingCount,
                totalCount: mp.totalCount != null ? mp.totalCount : (mp.product && mp.product.usageCount),
                isNew: true,
                isCopy: true
            });
            if (passErr) {
                App.showNotification(passErr, 'danger');
                return;
            }
        }
        
        // 새 날짜로 시간 계산
        const targetDate = new Date(targetDateStr + 'T00:00:00');
        const originalStartTime = new Date(booking.startTime);
        const originalEndTime = new Date(booking.endTime);
        
        // 시간 부분 유지
        const hours = originalStartTime.getHours();
        const minutes = originalStartTime.getMinutes();
        const duration = originalEndTime.getTime() - originalStartTime.getTime();
        
        // 새 날짜에 시간 적용
        let newStartTime = new Date(targetDate);
        newStartTime.setHours(hours, minutes, 0, 0);
        // 복사본이 원본보다 이전이면 회차가 꼬이므로, 원본보다 뒤로만 생성 (원본 다음 날로 보정)
        if (newStartTime.getTime() <= originalStartTime.getTime()) {
            newStartTime = new Date(originalStartTime.getTime());
            newStartTime.setDate(newStartTime.getDate() + 1);
            newStartTime.setHours(hours, minutes, 0, 0);
            App.showNotification('선택한 날짜가 원본보다 이전이라, 원본 다음 날로 복사되었습니다.', 'info');
        }
        const newEndTime = new Date(newStartTime.getTime() + duration);
        
        // LocalDateTime 형식으로 변환 (YYYY-MM-DDTHH:mm:ss)
        const formatLocalDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        };
        
        // 새 예약 데이터 생성 (이용권은 memberProduct.id 또는 memberProductId로 전달해 복사본도 같은 회차 표시)
        // 대관 페이지에서 복사 시 purpose는 반드시 RENTAL
        const purpose = (branch === 'RENTAL' ? 'RENTAL' : (booking.purpose || null));
        const newBooking = {
            facility: booking.facility ? { id: booking.facility.id } : null,
            memberNumber: booking.memberNumber || null,
            member: booking.member ? { id: booking.member.id } : null,
            nonMemberName: booking.nonMemberName || null,
            nonMemberPhone: booking.nonMemberPhone || null,
            coach: booking.coach ? { id: booking.coach.id } : null,
            memberProductId: memberProductId,
            startTime: formatLocalDateTime(newStartTime),
            endTime: formatLocalDateTime(newEndTime),
            participants: booking.participants || 1,
            purpose: purpose,
            lessonCategory: booking.lessonCategory || null,
            branch: branch || (window.BOOKING_PAGE_CONFIG || {}).branch || 'SAHA',
            status: 'PENDING',
            paymentMethod: booking.paymentMethod || null,
            memo: booking.memo || null,
            sourceBookingId: sourceBookingId
        };
        
        // 새 예약 생성
        const saved = await App.api.post('/bookings', newBooking);
        App.showNotification('예약이 복사되었습니다.', 'success');
        
        // 성공 콜백 호출
        if (onSuccess && typeof onSuccess === 'function') {
            onSuccess();
        }
        
        return saved;
    } catch (error) {
        App.err('예약 복사 실패:', error);
        App.showNotification(typeof App.getApiErrorMessage === 'function'
            ? App.getApiErrorMessage(error)
            : '예약 복사에 실패했습니다.', 'danger');
        throw error;
    }
};
document.head.appendChild(style);

// 사용자명 표시 업데이트
App.updateUserDisplay = function() {
    // user-menu-btn 요소 찾기
    const userMenuBtn = document.getElementById('user-menu-btn') || document.querySelector('.user-menu-btn');
    if (!userMenuBtn) {
        App.warn('사용자 메뉴 버튼을 찾을 수 없습니다.');
        return;
    }
    
    // user-info-container가 있는지 확인
    let userInfoContainer = userMenuBtn.closest('.user-info-container');
    
    // user-info-container가 없으면 생성
    if (!userInfoContainer) {
        // 부모 요소 확인
        const parent = userMenuBtn.parentElement;
        if (parent && parent.classList.contains('topbar-right')) {
            // topbar-right 내부에 user-info-container 생성
            userInfoContainer = document.createElement('div');
            userInfoContainer.className = 'user-info-container';
            
            // user-menu-btn을 user-info-container로 이동
            parent.insertBefore(userInfoContainer, userMenuBtn);
            userInfoContainer.appendChild(userMenuBtn);
        } else {
            // 부모가 topbar-right가 아니면 user-menu-btn을 감싸기
            userInfoContainer = document.createElement('div');
            userInfoContainer.className = 'user-info-container';
            userMenuBtn.parentNode.insertBefore(userInfoContainer, userMenuBtn);
            userInfoContainer.appendChild(userMenuBtn);
        }
    }
    
    // user-username 요소 찾기 또는 생성 (아이콘 아래에 표시되도록 뒤에 삽입)
    let usernameElement = document.getElementById('user-username');
    if (!usernameElement) {
        usernameElement = document.createElement('span');
        usernameElement.className = 'user-username';
        usernameElement.id = 'user-username';
        // 아이콘 뒤에 삽입 (아래에 표시)
        userInfoContainer.appendChild(usernameElement);
    } else {
        // 이미 존재하는 경우에도 순서 확인 (아이콘 뒤에 있어야 함)
        if (usernameElement.previousSibling !== userMenuBtn) {
            userInfoContainer.appendChild(usernameElement);
        }
    }
    
    // 사용자명 표시 (이름 우선, 없으면 역할에 따른 표시명 사용)
    if (App.currentUser) {
        let displayName = '';
        
        // 1. name 필드가 있으면 name 사용
        if (App.currentUser.name && App.currentUser.name.trim()) {
            displayName = App.currentUser.name;
        } 
        // 2. 역할에 따른 표시명 사용
        else if (App.currentUser.role) {
            const roleDisplayNames = {
                'ADMIN': '관리자',
                'MANAGER': '매니저',
                'COACH': '코치',
                'FRONT': '데스크'
            };
            displayName = roleDisplayNames[App.currentUser.role.toUpperCase()] || App.currentUser.role;
        }
        // 3. 그것도 없으면 username 사용
        else if (App.currentUser.username) {
            displayName = App.currentUser.username;
        }
        
        if (displayName) {
            usernameElement.textContent = displayName;
            usernameElement.style.display = 'block';
        } else {
            usernameElement.style.display = 'none';
        }
    } else {
        usernameElement.style.display = 'none';
    }

};

// 페이지 로드 시 인증 체크 (로그인·회원 공개 예약 페이지 제외)
document.addEventListener('DOMContentLoaded', function() {
    var path = window.location.pathname || '';
    var isRankingsPage = path === '/rankings.html' || path.endsWith('/rankings.html');
    // 로그인 / 회원번호 공개 예약 — JWT 없이 접근 가능해야 함 (리다이렉트 금지)
    if (path === '/login.html' || path === '/login' || path === '/member-booking.html' || path.endsWith('/member-booking.html')) {
        App.restoreAuth();
        return;
    }

    // 먼저 인증 정보 복원 (중요: filterMenuByRole 전에 실행)
    App.restoreAuth();
    
    // 사용자명 표시 업데이트
    App.updateUserDisplay();

    // 인증되지 않은 경우 — 훈련 랭킹은 비로그인 열람 가능 (회원 예약 사이드 메뉴)
    if (!App.isAuthenticated()) {
        if (isRankingsPage) {
            App.initDarkMode();
            setTimeout(function() {
                App.addDarkModeToggle();
            }, 100);
            initMobileSidebar();
            return;
        }
        window.location.href = '/login.html';
        return;
    }

    // 스크린샷 발췌·직원 출퇴근은 관리자(Admin)만 접근 가능
    var pathNow = window.location.pathname || '';
    if ((pathNow === '/screenshot-export.html' || pathNow === '/staff-attendance.html'
            || pathNow.endsWith('/screenshot-export.html') || pathNow.endsWith('/staff-attendance.html'))
            && (App.currentRole || '').toUpperCase() !== 'ADMIN') {
        var scrRole = (App.currentRole || '').toUpperCase();
        window.location.href = scrRole === 'COACH' ? '/bookings.html' : '/';
        return;
    }
    if ((pathNow === '/profit-sheet.html' || pathNow.endsWith('/profit-sheet.html'))
            && typeof App.canSeeProfitSheet === 'function' && !App.canSeeProfitSheet()) {
        var psRole = (App.currentRole || '').toUpperCase();
        window.location.href = psRole === 'COACH' ? '/bookings.html' : '/';
        return;
    }

    // 권한 데이터 로드 후 코치 페이지 접근 제한 → 메뉴 필터링
    (async function() {
        if (App.currentUser && String(App.currentUser.role || '').toUpperCase() === 'COACH'
                && typeof App.syncOperationalCoachViewFromServer === 'function') {
            await App.syncOperationalCoachViewFromServer();
        }
        await App.loadRolePermissions();
        await App.enforceCoachPageAccess();
        // 약간의 지연을 두어 DOM이 완전히 로드된 후 필터링
        setTimeout(function() {
            App.filterMenuByRole();
        }, 0);
    })();
    
    // 테마 초기화 및 버튼 추가 시도 (인증 후 DOM이 완전히 로드된 후)
    // 여러 시점에서 시도하여 확실히 추가되도록
    App.initDarkMode();
    setTimeout(() => {
        App.addDarkModeToggle();
    }, 50);
    setTimeout(() => {
        if (!document.getElementById('theme-toggle-btn')) {
            App.addDarkModeToggle();
        }
    }, 300);
    setTimeout(() => {
        if (!document.getElementById('theme-toggle-btn')) {
            App.addDarkModeToggle();
        }
    }, 800);
    setTimeout(() => {
        if (!document.getElementById('theme-toggle-btn')) {
            App.addDarkModeToggle();
        }
    }, 1500);

    // 사용자 정보 표시 및 로그아웃 기능 추가
    // 모든 user-menu-btn 요소에 이벤트 리스너 추가 (id가 없어도 작동하도록)
    function setupUserMenuButtons() {
        const userMenuButtons = document.querySelectorAll('.user-menu-btn');
        App.log('사용자 메뉴 버튼 찾기:', userMenuButtons.length, '개');
        
        // 사용자명 표시 업데이트
        App.updateUserDisplay();
        
        userMenuButtons.forEach(function(btn) {
            // 이미 이벤트 리스너가 등록되어 있는지 확인
            if (btn.hasAttribute('data-logout-setup')) {
                return;
            }
            
            App.log('사용자 메뉴 버튼 이벤트 리스너 등록');
            
            // 사용자 정보가 있으면 툴팁 설정
            if (App.currentUser && App.currentUser.name) {
                btn.title = `${App.currentUser.name} (${App.currentUser.role})`;
            }
            
            // 사용자 메뉴 클릭 시 사용자 정보 모달 표시
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                App.log('사용자 메뉴 버튼 클릭됨');
                showUserMenuModal();
            });
            
            // 중복 등록 방지 플래그
            btn.setAttribute('data-logout-setup', 'true');
        });
    }
    
    // 즉시 실행 및 약간의 지연 후에도 실행 (동적 로드 대응)
    setupUserMenuButtons();
    setTimeout(setupUserMenuButtons, 100);
    setTimeout(setupUserMenuButtons, 500);
    setTimeout(() => {
        App.updateUserDisplay();
    }, 1000);
});

// window.onload에서도 테마 버튼 추가 시도
window.addEventListener('load', () => {
    if (!document.getElementById('theme-toggle-btn')) {
        App.addDarkModeToggle();
    }
});

// 사용자 메뉴 모달 표시
async function showUserMenuModal() {
    if (!App.currentUser) {
        return;
    }
    
    const userName = App.currentUser.name || App.currentUser.username;
    let coachInfo = null;
    
    // 코치 정보 가져오기 (ADMIN, MANAGER는 조회하지 않음)
    if (App.currentUser.id && (App.currentUser.role === 'COACH' || App.currentUser.role === 'FRONT')) {
        try {
            const coach = await App.api.get(`/coaches/by-user/${App.currentUser.id}`);
            if (coach) {
                coachInfo = coach;
                App.log('코치 정보 조회 성공:', coach);
            }
        } catch (error) {
            // 404는 코치 정보가 없는 것이므로 정상 (모달은 계속 표시)
            if (error.response && error.response.status === 404) {
                App.log('코치 정보 없음 (정상) - 사용자 ID:', App.currentUser.id);
            } else {
                App.log('코치 정보 조회 실패:', error);
            }
            // 에러가 발생해도 모달은 계속 표시
        }
    }
    
    // 모달 HTML 생성
    let coachText = '';
    if (coachInfo && coachInfo.specialties) {
        // specialties가 있으면 포지션으로 표시
        coachText = coachInfo.specialties;
    } else if (App.currentUser.role === 'COACH') {
        // 코치 역할이지만 코치 정보가 없으면 "코치"로만 표시
        coachText = '코치';
    }
    
    const opFilter = (typeof App.isOperationalCoachViewer === 'function' && App.isOperationalCoachViewer())
        ? `
                        <div class="user-menu-operational-filter-wrap">
                            <div class="user-menu-op-filter-heading">담당 코치별로 회원 보기</div>
                            <p class="user-menu-op-filter-hint">체크한 코치 담당 회원만 목록에 표시됩니다. 미선택 시 전체입니다.</p>
                            <div id="user-menu-operational-filter-host"></div>
                        </div>
        `
        : '';

    const modalHtml = `
        <div id="user-menu-modal" class="modal-overlay active" style="display: flex;">
            <div class="modal modal-compact ${opFilter ? 'modal-user-menu--with-op-filter' : ''}">
                <div class="modal-header">
                    <h2 class="modal-title">사용자 정보</h2>
                    <button class="modal-close" onclick="closeUserMenuModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="user-menu-modal-body-inner">
                        <div style="font-size: 52px; margin-bottom: 18px;">👤</div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px;">
                            ${userName}
                        </div>
                        ${coachText ? `
                        <div style="font-size: 15px; color: var(--text-secondary); margin-bottom: 18px;">
                            ${coachText}
                        </div>
                        ` : ''}
                        <div style="font-size: 13px; color: var(--text-muted);">
                            ${App.currentUser.role === 'ADMIN' ? '관리자' : 
                              App.currentUser.role === 'MANAGER' ? '매니저' : 
                              App.currentUser.role === 'COACH' ? '코치' : 
                              App.currentUser.role === 'FRONT' ? '데스크' : App.currentUser.role}
                        </div>
                        ${opFilter}
                    </div>
                </div>
                <div class="modal-footer user-menu-modal-footer">
                    <button class="btn btn-secondary" onclick="closeUserMenuModal()">닫기</button>
                    <button class="btn btn-danger" onclick="logoutUser()">로그아웃</button>
                </div>
            </div>
        </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('user-menu-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var filterHost = document.getElementById('user-menu-operational-filter-host');
    if (filterHost && typeof App.mountOperationalCoachFilterBar === 'function') {
        App.mountOperationalCoachFilterBar(filterHost);
    }
    
    // 모달 배경 클릭 시 닫기
    const modal = document.getElementById('user-menu-modal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeUserMenuModal();
        }
    });
}

// 사용자 메뉴 모달 닫기
function closeUserMenuModal() {
    const modal = document.getElementById('user-menu-modal');
    if (modal) {
        modal.remove();
    }
}

// 로그아웃
function logoutUser() {
    if (confirm('로그아웃 하시겠습니까?')) {
        App.clearAuth();
    }
}

/** const App 는 window 프로퍼티가 아니므로, 다른 스크립트의 window.App 검사가 실패하지 않도록 연결 */
if (typeof window !== 'undefined' && typeof App !== 'undefined') {
    window.App = App;
    window.openMemberInfoModal = function(memberId) {
        return App.openMemberInfoModal(memberId);
    };
}
