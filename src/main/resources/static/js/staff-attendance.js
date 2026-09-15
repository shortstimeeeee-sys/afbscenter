(function() {
    var year = new Date().getFullYear();
    var month = new Date().getMonth() + 1;
    var roster = null;
    var selected = null;
    var selectedDayMark = null;
    var calendarMarksMap = {};
    var branchClosuresSet = {};
    /** 출근부 명부에서 당분간 숨김 (이름 앞부분 기준, 직함 무시) */
    var STAFF_ROSTER_HIDDEN_BASE_NAMES = {
        '서정민': true,
        '정영삼': true,
        '공인욱': true,
        '이원준': true,
        '김가영': true,
        '김유진': true,
        '이소연': true
    };

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }
    function ymLabel(y, m) {
        return y + '년 ' + pad(m) + '월';
    }
    function fmtTime(v) {
        if (v == null || v === '') return '';
        if (Array.isArray(v) && v.length >= 5) return pad(v[3]) + ':' + pad(v[4]);
        var s = String(v);
        if (s.length >= 16 && s.indexOf('T') !== -1) return s.substring(11, 16);
        if (s.length >= 5 && s.indexOf(':') !== -1) return s.substring(0, 5);
        return s;
    }
    function normalizeTime(v) {
        var s = String(v == null ? '' : v).trim().replace(/[．。：.]/g, ':');
        if (!s) return '';
        var digits = s.replace(/[^\d]/g, '');
        if (digits.length === 3) digits = '0' + digits;
        if (digits.length === 4) s = digits.slice(0, 2) + ':' + digits.slice(2);
        var m = String(s).match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        var h = Number(m[1]);
        var min = Number(m[2]);
        if (h > 23 || min > 59) return null;
        return pad(h) + ':' + pad(min);
    }
    function addHoursToTime(hhmm, hours) {
        var p = String(hhmm || '').split(':');
        if (p.length < 2) return '';
        var total = Number(p[0]) * 60 + Number(p[1]) + Number(hours) * 60;
        if (total >= 24 * 60) total = 24 * 60 - 1;
        if (total < 0) total = 0;
        return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
    }
    function fillCheckoutFromCheckIn() {
        var inEl = document.getElementById('staff-att-in');
        var outEl = document.getElementById('staff-att-out');
        if (!inEl || !outEl || inEl.disabled) return;
        var n = normalizeTime(inEl.value);
        if (!n) return;
        outEl.value = addHoursToTime(n, 8);
    }
    function isoDate(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function apiError(err) {
        return (err && err.response && err.response.data && (err.response.data.message || err.response.data.error))
            || (err && err.message) || '처리에 실패했습니다.';
    }
    function daysInMonth(y, m) {
        return new Date(y, m, 0).getDate();
    }
    function dayMap(staff) {
        var map = {};
        var days = (staff && staff.days) || [];
        days.forEach(function(d) {
            var key = String(d.date || '').substring(0, 10);
            if (key) map[key] = d;
        });
        return map;
    }
    function cellStatus(rec) {
        if (!rec) return 'empty';
        if (rec.dayType === 'OFF') return 'off';
        if (rec.dayType === 'OUTDOOR') return 'outdoor';
        if (rec.dayType === 'SICK') return 'sick';
        if (rec.checkOutTime) return 'work';
        if (rec.checkInTime) return 'working';
        return 'empty';
    }
    function cellLabel(rec, columnOutdoor) {
        var st = cellStatus(rec);
        if (st === 'off') return '휴무';
        if (st === 'outdoor') return columnOutdoor ? '·' : '야외레슨';
        if (st === 'sick') return '병가';
        if (st === 'work') return fmtTime(rec.checkInTime) + '-' + fmtTime(rec.checkOutTime);
        if (st === 'working') return fmtTime(rec.checkInTime) + '~';
        return '·';
    }

    async function loadRoster() {
        var label = document.getElementById('staff-att-month-label');
        if (label) label.textContent = ymLabel(year, month);
        var start = year + '-' + pad(month) + '-01';
        var end = year + '-' + pad(month) + '-' + pad(daysInMonth(year, month));
        try {
            var rosterP = App.api.get('/coach-portal/work/roster?year=' + year + '&month=' + month);
            var marksP = (typeof App.loadCalendarMarksMap === 'function')
                ? App.loadCalendarMarksMap(start, end)
                : Promise.resolve({});
            var closP = (typeof App.loadAllBranchClosuresSet === 'function')
                ? App.loadAllBranchClosuresSet(start, end)
                : (typeof App.loadBranchClosuresSet === 'function'
                    ? Promise.all(['SAHA', 'YEONSAN', 'NON_BASEBALL'].map(function (g) {
                        return App.loadBranchClosuresSet(g, start, end);
                    })).then(function (sets) {
                        return Object.assign({}, sets[0] || {}, sets[1] || {}, sets[2] || {});
                    })
                    : Promise.resolve({}));
            roster = await rosterP;
            calendarMarksMap = (await marksP) || {};
            branchClosuresSet = (await closP) || {};
            render();
        } catch (err) {
            App.err('직원 출퇴근 로드 실패:', err);
            App.showNotification(apiError(err), 'error');
        }
    }

    function staffBaseName(name) {
        return displayName(name).split(/\s+/)[0] || '';
    }
    function isHiddenFromStaffRoster(name) {
        return !!STAFF_ROSTER_HIDDEN_BASE_NAMES[staffBaseName(name)];
    }
    function rosterStaffVisible() {
        return ((roster && roster.staff) || []).filter(function(s) {
            return !isHiddenFromStaffRoster(s.coachName);
        });
    }
    function filteredStaff() {
        var q = (document.getElementById('staff-att-search') || {}).value || '';
        q = q.trim().toLowerCase();
        var list = sortStaffForRoster(rosterStaffVisible());
        if (!q) return list;
        return list.filter(function(s) {
            var name = String(s.coachName || '').toLowerCase();
            var spec = String(s.specialties || '').toLowerCase();
            return name.indexOf(q) !== -1 || spec.indexOf(q) !== -1;
        });
    }
    var STAFF_ROSTER_LEAD_ORDER = {
        '서정훈': 0,
        '박근엽': 1,
        '정진환': 2,
        '이용준': 3,
        '손희진': 4
    };
    function staffRosterRank(s) {
        var rank = STAFF_ROSTER_LEAD_ORDER[staffBaseName(s && s.coachName)];
        return rank == null ? 100 : rank;
    }
    function isSeparateStaff(s) {
        return staffBaseName(s && s.coachName) === '손희진';
    }
    function isLeadStaff(s) {
        var base = staffBaseName(s && s.coachName);
        return base === '서정훈' || base === '박근엽' || base === '정진환' || base === '이용준';
    }
    function sortStaffForRoster(list) {
        return (list || []).map(function(s, i) {
            return { s: s, i: i };
        }).sort(function(a, b) {
            var ra = staffRosterRank(a.s);
            var rb = staffRosterRank(b.s);
            if (ra !== rb) return ra - rb;
            return a.i - b.i;
        }).map(function(x) {
            return x.s;
        });
    }

    function render() {
        if (!roster) return;
        var visible = rosterStaffVisible();
        var workingNow = 0;
        var clockedOut = 0;
        var offToday = 0;
        var notIn = 0;
        visible.forEach(function(s) {
            var st = s.todayStatus;
            if (st === '근무 중') workingNow++;
            else if (st === '퇴근') clockedOut++;
            else if (st === '휴무' || st === '병가' || st === '야외레슨') offToday++;
            else notIn++;
        });
        setText('kpi-working-now', workingNow);
        setText('kpi-clocked-out', clockedOut);
        setText('kpi-off-today', offToday);
        setText('kpi-not-in', notIn);
        setText('kpi-staff-count', visible.length);
        renderGrid();
    }

    function setText(id, v) {
        var el = document.getElementById(id);
        if (el) el.textContent = v;
    }

    function holidayMark(dateStr) {
        return calendarMarksMap && calendarMarksMap[dateStr] ? calendarMarksMap[dateStr] : null;
    }
    function isHolidayRed(dateStr) {
        var mk = holidayMark(dateStr);
        return !!(mk && mk.redDay);
    }
    function holidayMemo(dateStr) {
        var mk = holidayMark(dateStr);
        return mk && mk.memo ? String(mk.memo).trim() : '';
    }
    function isSettingsClosed(dateStr) {
        return !!(branchClosuresSet && branchClosuresSet[dateStr]);
    }
    function dayColorClass(dateStr, wd) {
        if (isHolidayRed(dateStr)) return 'is-holiday';
        if (wd === 0) return 'is-sun';
        if (wd === 6) return 'is-sat';
        return '';
    }
    var WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

    function renderGrid() {
        var wrap = document.getElementById('staff-att-table-wrap');
        if (!wrap) return;
        var last = daysInMonth(year, month);
        var todayStr = roster.today || isoDate(new Date());
        var staff = filteredStaff();
        if (!staff.length) {
            wrap.innerHTML = '<table class="staff-att-table"><thead><tr>'
                + '<th class="staff-att-name">직원</th><th class="staff-att-month-sum">이번 달</th></tr></thead>'
                + '<tbody><tr><td class="staff-att-name" colspan="2">표시할 직원이 없습니다.</td></tr></tbody></table>';
            return;
        }
        var lead = [];
        var separate = [];
        var rest = [];
        staff.forEach(function(s) {
            if (isSeparateStaff(s)) separate.push(s);
            else if (isLeadStaff(s)) lead.push(s);
            else rest.push(s);
        });
        var html = '<table class="staff-att-table">' + buildDayHeader(last, todayStr, 'main') + '<tbody>';
        lead.forEach(function(s) {
            html += buildStaffRow(s, last, todayStr, 'main');
        });
        if (separate.length) {
            html += '<tr class="staff-att-gap"><td class="staff-att-name"></td><td colspan="' + (last + 1) + '"></td></tr>';
            separate.forEach(function(s) {
                html += buildStaffRow(s, last, todayStr, 'separate');
            });
        }
        rest.forEach(function(s) {
            html += buildStaffRow(s, last, todayStr, 'main');
        });
        html += '</tbody></table>';
        wrap.innerHTML = html;
        wrap.querySelectorAll('.staff-att-cell').forEach(function(td) {
            td.addEventListener('click', function() {
                openEditor(Number(td.getAttribute('data-coach-id')), td.getAttribute('data-date'));
            });
        });
        wrap.querySelectorAll('th.staff-att-day').forEach(function(th) {
            th.addEventListener('click', function() {
                toggleDayMarkPicker(th.getAttribute('data-date'), th.getAttribute('data-group') || 'main');
            });
        });
    }

    function buildDayHeader(last, todayStr, group) {
        var html = '<thead><tr>';
        html += '<th class="staff-att-name">직원</th>';
        html += '<th class="staff-att-month-sum">이번 달</th>';
        for (var d = 1; d <= last; d++) {
            var dt = new Date(year, month - 1, d);
            var wd = dt.getDay();
            var dateStr = isoDate(dt);
            var cls = [];
            var colorCls = dayColorClass(dateStr, wd);
            if (colorCls) cls.push(colorCls);
            if (dateStr === todayStr) cls.push('is-today');
            var allOff = isColumnAllOff(dateStr, group);
            var outdoor = isColumnOutdoor(dateStr, group);
            var settingsClosed = isSettingsClosed(dateStr);
            var memo = holidayMemo(dateStr);
            if (!outdoor && (allOff || settingsClosed)) cls.push('is-all-off');
            cls.push('staff-att-day');
            var titleBits = [formatDayLabel(dateStr)];
            if (memo) titleBits.push(memo);
            if (settingsClosed || allOff) titleBits.push('휴무');
            if (outdoor) titleBits.push('야외레슨');
            titleBits.push('클릭하면 변경');
            var extra = '';
            if (outdoor) {
                extra += '<span class="staff-att-day-mark">야외레슨</span>';
            }
            if (memo) {
                extra += '<span class="staff-att-day-memo" title="' + escapeHtml(memo) + '">'
                    + escapeHtml(memo.length > 6 ? memo.slice(0, 6) + '…' : memo) + '</span>';
            }
            html += '<th class="' + cls.join(' ') + '" data-date="' + dateStr + '" data-group="' + group + '" title="' + escapeHtml(titleBits.join(' · ')) + '">'
                + d + '(' + WEEKDAY_LABELS[wd] + ')'
                + extra
                + '</th>';
        }
        html += '</tr></thead>';
        return html;
    }

    function staffColor(s) {
        var fromPalette = (App.CoachColors && typeof App.CoachColors.getColor === 'function')
            ? App.CoachColors.getColor({ id: s && s.coachId, name: s && s.coachName, color: s && s.color })
            : '';
        var raw = String(fromPalette || (s && s.color) || '').trim();
        if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
            return '#' + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2) + raw.charAt(3) + raw.charAt(3);
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
        return '#5E6AD2';
    }
    function buildStaffRow(s, last, todayStr, group) {
        var recs = dayMap(s);
        var color = staffColor(s);
        var html = '<tr' + (isSeparateStaff(s) ? ' class="staff-att-row-separate"' : '') + '>';
        html += '<td class="staff-att-name"><span class="staff-att-name-dot" style="background:' + color + '"></span>'
            + escapeHtml(displayName(s.coachName))
                + '<span class="staff-att-name-sub">출근 ' + (s.workDays || 0) + ' · 휴무 ' + (s.offDays || 0)
                + (s.outdoorDays ? ' · 야외 ' + s.outdoorDays : '')
                + (s.sickDays ? ' · 병가 ' + s.sickDays : '') + '</span></td>';
        html += '<td class="staff-att-month-sum">' + fmtMinutes(s.workedMinutes) + '</td>';
        for (var day = 1; day <= last; day++) {
            var dateObj = new Date(year, month - 1, day);
            var key = isoDate(dateObj);
            var rec = recs[key];
            var st = cellStatus(rec);
            var columnOutdoor = isColumnOutdoor(key, group);
            var cls = ['staff-att-cell'];
            var colorCls = dayColorClass(key, dateObj.getDay());
            if (colorCls) cls.push(colorCls);
            if (key === todayStr) cls.push('is-today');
            if (st === 'work') cls.push('is-work');
            if (st === 'working') cls.push('is-working');
            if (st === 'off') cls.push('is-off');
            if (st === 'sick') cls.push('is-sick');
            if (isColumnAllOff(key, group)) cls.push('is-all-off');
            var text = cellLabel(rec, columnOutdoor);
            var labelCls = (st === 'empty' || text === '·') ? 'staff-att-empty' : 'staff-att-time';
            var style = (st === 'work' || st === 'working') ? ' style="--staff-color:' + color + '"' : '';
            html += '<td class="' + cls.join(' ') + '"' + style + ' data-coach-id="' + s.coachId + '" data-date="' + key + '">'
                + '<span class="' + labelCls + '">' + escapeHtml(text) + '</span></td>';
        }
        html += '</tr>';
        return html;
    }

    function formatDayLabel(dateStr) {
        var p = String(dateStr || '').split('-');
        if (p.length < 3) return dateStr || '';
        var dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return Number(p[1]) + '월 ' + Number(p[2]) + '일(' + WEEKDAY_LABELS[dt.getDay()] + ')';
    }
    function columnStaff(group) {
        return rosterStaffVisible().filter(function(s) {
            return group === 'separate' ? isSeparateStaff(s) : !isSeparateStaff(s);
        });
    }
    function isColumnAllOff(dateStr, group) {
        var target = columnStaff(group);
        if (!target.length) return false;
        return target.every(function(s) {
            return cellStatus(dayMap(s)[dateStr]) === 'off';
        });
    }
    function isColumnOutdoor(dateStr, group) {
        var target = columnStaff(group);
        if (!target.length) return false;
        return target.every(function(s) {
            return cellStatus(dayMap(s)[dateStr]) === 'outdoor';
        });
    }
    function toggleDayMarkPicker(dateStr, group) {
        if (!dateStr) return;
        group = group === 'separate' ? 'separate' : 'main';
        selectedDayMark = { date: dateStr, group: group };
        var label = formatDayLabel(dateStr);
        var title = document.getElementById('staff-att-day-mark-title');
        var hint = document.getElementById('staff-att-day-mark-hint');
        if (title) title.textContent = label;
        if (hint) {
            var extra = '';
            var memo = holidayMemo(dateStr);
            if (memo) extra += ' 설정 표시: ' + memo + '.';
            if (isSettingsClosed(dateStr)) extra += ' 설정에서 지점 휴무로 지정된 날입니다.';
            hint.textContent = (group === 'separate'
                ? '손희진 출근부에만 적용됩니다.'
                : '손희진은 그대로 두고, 위쪽 출근부에만 적용됩니다. 휴무는 설정의 지점 휴무와 같이 반영됩니다.')
                + extra;
        }
        var current = isColumnOutdoor(dateStr, group) ? 'OUTDOOR'
            : ((isColumnAllOff(dateStr, group) || isSettingsClosed(dateStr)) ? 'OFF' : '');
        document.querySelectorAll('#staff-att-day-mark-modal [data-mark]').forEach(function(btn) {
            if (btn.getAttribute('data-mark') === current) btn.classList.add('is-current');
            else btn.classList.remove('is-current');
        });
        var clearBtn = document.getElementById('staff-att-mark-clear');
        if (clearBtn) clearBtn.style.display = current ? '' : 'none';
        selectedDayMark.current = current;
        App.Modal.open('staff-att-day-mark-modal');
    }
    var CLOSURE_GROUPS = ['SAHA', 'YEONSAN', 'NON_BASEBALL'];
    async function syncSettingsClosures(dateStr, closed) {
        if (!dateStr || !App.api) return;
        try {
            if (closed) {
                await Promise.all(CLOSURE_GROUPS.map(function (g) {
                    return App.api.put('/branch-closures', { group: g, closureDate: dateStr });
                }));
            } else {
                await Promise.all(CLOSURE_GROUPS.map(function (g) {
                    return App.api.delete('/branch-closures/' + encodeURIComponent(g) + '/' + dateStr);
                }));
            }
        } catch (e) {
            App.err('설정 휴무 연동 실패:', e);
            App.showNotification('출근부는 반영됐지만 설정 휴무 연동에 실패했습니다.', 'warning');
        }
    }
    async function applyDayMark(mark) {
        if (!selectedDayMark) return;
        var dateStr = selectedDayMark.date;
        var group = selectedDayMark.group;
        var label = formatDayLabel(dateStr);
        try {
            var res = await App.api.post('/coach-portal/work/roster/days/' + dateStr + '/all-off?group=' + group + '&mark=' + mark, {});
            if (group === 'main' && mark === 'OFF') {
                await syncSettingsClosures(dateStr, true);
            }
            App.Modal.close('staff-att-day-mark-modal');
            var updated = (res && res.updated) || 0;
            var skippedSet = (res && res.skipped) || 0;
            var kind = mark === 'OUTDOOR' ? '야외레슨' : '휴무';
            if (updated) App.showNotification(label + '을 ' + kind + '으로 지정했습니다. (' + updated + '명)', 'success');
            else App.showNotification(label + '에 바꿀 사람이 없습니다.', 'info');
            if (skippedSet) {
                App.showNotification(((res.skippedNames || []).join(', ') || skippedSet + '명') + '은 그대로 두었습니다.', 'warning');
            }
            await loadRoster();
        } catch (err) {
            App.showNotification(apiError(err), 'error');
        }
    }
    async function clearDayMark() {
        if (!selectedDayMark) return;
        var dateStr = selectedDayMark.date;
        var group = selectedDayMark.group;
        var label = formatDayLabel(dateStr);
        var wasOff = selectedDayMark.current === 'OFF';
        try {
            var cleared = await App.api.delete('/coach-portal/work/roster/days/' + dateStr + '/all-off?group=' + group);
            if (group === 'main' && wasOff) {
                await syncSettingsClosures(dateStr, false);
            }
            App.Modal.close('staff-att-day-mark-modal');
            var n = (cleared && cleared.cleared) || 0;
            var skipped = (cleared && cleared.skipped) || 0;
            if (n) App.showNotification(label + ' 지정을 해제했습니다. (' + n + '명)', 'success');
            else if (wasOff && group === 'main') App.showNotification(label + ' 지점 휴무를 해제했습니다.', 'success');
            if (skipped) {
                App.showNotification(((cleared.skippedNames || []).join(', ') || skipped + '명') + '은 그대로 두었습니다.', 'warning');
            }
            await loadRoster();
        } catch (err) {
            App.showNotification(apiError(err), 'error');
        }
    }

    function displayName(name) {
        return String(name || '').replace(/\s*\[.*?\]\s*/g, ' ').trim() || (name || '-');
    }
    function fmtMinutes(min) {
        var m = Number(min) || 0;
        var h = Math.floor(m / 60);
        var r = m % 60;
        if (h <= 0) return r + '분';
        if (r === 0) return h + '시간';
        return h + '시간 ' + r + '분';
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function findStaff(id) {
        var list = (roster && roster.staff) || [];
        for (var i = 0; i < list.length; i++) {
            if (Number(list[i].coachId) === Number(id)) return list[i];
        }
        return null;
    }

    function openEditor(coachId, date) {
        var staff = findStaff(coachId);
        if (!staff) return;
        var rec = dayMap(staff)[date] || {};
        selected = { coachId: coachId, date: date, name: staff.coachName };
        document.getElementById('staff-att-edit-title').textContent = displayName(staff.coachName) + ' · ' + date;
        document.getElementById('staff-att-day-type').value = rec.dayType || 'WORK';
        document.getElementById('staff-att-in').value = fmtTime(rec.checkInTime);
        document.getElementById('staff-att-out').value = fmtTime(rec.checkOutTime);
        document.getElementById('staff-att-memo').value = rec.memo || '';
        var today = roster.today || isoDate(new Date());
        var todayBtns = document.getElementById('staff-att-today-actions');
        if (todayBtns) todayBtns.style.display = date === today ? 'flex' : 'none';
        toggleTimeFields();
        document.getElementById('staff-att-in').readOnly = false;
        document.getElementById('staff-att-out').readOnly = false;
        App.Modal.open('staff-att-edit-modal');
    }

    function toggleTimeFields() {
        var type = document.getElementById('staff-att-day-type').value;
        var disabled = type === 'OFF' || type === 'SICK' || type === 'OUTDOOR';
        var inEl = document.getElementById('staff-att-in');
        var outEl = document.getElementById('staff-att-out');
        inEl.disabled = disabled;
        outEl.disabled = disabled;
        inEl.readOnly = false;
        outEl.readOnly = false;
        if (disabled) {
            inEl.value = '';
            outEl.value = '';
        }
    }

    function bindTimeInput(el) {
        if (!el || el.getAttribute('data-time-bound')) return;
        el.setAttribute('data-time-bound', '1');
        el.addEventListener('blur', function() {
            var n = normalizeTime(el.value);
            if (n) el.value = n;
            if (el.id === 'staff-att-in') fillCheckoutFromCheckIn();
        });
        if (el.id === 'staff-att-in') {
            el.addEventListener('input', function() {
                var n = normalizeTime(el.value);
                if (n) fillCheckoutFromCheckIn();
            });
        }
    }

    async function saveEditor() {
        if (!selected) return;
        var type = document.getElementById('staff-att-day-type').value;
        var inRaw = document.getElementById('staff-att-in').value;
        var outRaw = document.getElementById('staff-att-out').value;
        var inTime = type === 'WORK' ? normalizeTime(inRaw) : '';
        var outTime = type === 'WORK' ? normalizeTime(outRaw) : '';
        if (type === 'WORK' && String(inRaw || '').trim() && inTime === null) {
            App.showNotification('출근 시각은 09:00 형식으로 입력해 주세요.', 'error');
            return;
        }
        if (type === 'WORK' && String(outRaw || '').trim() && outTime === null) {
            App.showNotification('퇴근 시각은 18:00 형식으로 입력해 주세요.', 'error');
            return;
        }
        var body = {
            date: selected.date,
            dayType: type,
            memo: document.getElementById('staff-att-memo').value,
            checkInTime: type === 'WORK' ? (inTime || '') : '',
            checkOutTime: type === 'WORK' ? (outTime || '') : ''
        };
        try {
            await App.api.put('/coach-portal/work/roster/' + selected.coachId + '/days', body);
            App.Modal.close('staff-att-edit-modal');
            await loadRoster();
        } catch (err) {
            App.showNotification(apiError(err), 'error');
        }
    }

    async function clearEditor() {
        if (!selected) return;
        try {
            await App.api.delete('/coach-portal/work/roster/' + selected.coachId + '/days/' + selected.date);
            App.Modal.close('staff-att-edit-modal');
            await loadRoster();
        } catch (err) {
            App.showNotification(apiError(err), 'error');
        }
    }

    async function clock(kind) {
        if (!selected) return;
        try {
            await App.api.post('/coach-portal/work/roster/' + selected.coachId + '/' + kind, {});
            App.Modal.close('staff-att-edit-modal');
            await loadRoster();
        } catch (err) {
            App.showNotification(apiError(err), 'error');
        }
    }

    function shiftMonth(delta) {
        var dt = new Date(year, month - 1 + delta, 1);
        year = dt.getFullYear();
        month = dt.getMonth() + 1;
        loadRoster();
    }

    document.addEventListener('DOMContentLoaded', function() {
        var prev = document.getElementById('staff-att-prev');
        var next = document.getElementById('staff-att-next');
        var search = document.getElementById('staff-att-search');
        var typeEl = document.getElementById('staff-att-day-type');
        if (prev) prev.addEventListener('click', function() { shiftMonth(-1); });
        if (next) next.addEventListener('click', function() { shiftMonth(1); });
        if (search) search.addEventListener('input', renderGrid);
        if (typeEl) typeEl.addEventListener('change', toggleTimeFields);
        bindTimeInput(document.getElementById('staff-att-in'));
        bindTimeInput(document.getElementById('staff-att-out'));
        var saveBtn = document.getElementById('staff-att-save');
        var clearBtn = document.getElementById('staff-att-clear');
        var inBtn = document.getElementById('staff-att-clock-in');
        var outBtn = document.getElementById('staff-att-clock-out');
        if (saveBtn) saveBtn.addEventListener('click', saveEditor);
        if (clearBtn) clearBtn.addEventListener('click', clearEditor);
        if (inBtn) inBtn.addEventListener('click', function() { clock('clock-in'); });
        if (outBtn) outBtn.addEventListener('click', function() { clock('clock-out'); });
        document.querySelectorAll('#staff-att-day-mark-modal [data-mark]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                applyDayMark(btn.getAttribute('data-mark'));
            });
        });
        var markClear = document.getElementById('staff-att-mark-clear');
        if (markClear) markClear.addEventListener('click', clearDayMark);
        loadRoster();
    });
})();
