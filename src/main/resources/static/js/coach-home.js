(function() {
    var workYear = new Date().getFullYear();
    var workMonth = new Date().getMonth() + 1;
    var settleYear = workYear;
    var settleMonth = workMonth;
    var membersCache = [];
    var selectedWorkDate = null;
    var selectedMemberId = null;
    var adminCoachId = null;
    var isAdmin = false;
    var calendarPaymentsByDate = {};

    function portalUrl(path) {
        var id = adminCoachId;
        if (!id) {
            var sel = document.getElementById('admin-coach-select');
            if (sel && sel.value) id = sel.value;
        }
        if (!id) return path;
        if (path.indexOf('coachId=') !== -1) return path;
        return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'coachId=' + encodeURIComponent(id);
    }

    function hasAdminCoachParam() {
        return !isAdmin || portalUrl('/coach-portal/summary').indexOf('coachId=') !== -1;
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }
    function ymLabel(y, m) {
        return y + '년 ' + pad(m) + '월';
    }
    function fmtTime(v) {
        if (!v) return '-';
        var s = String(v);
        if (s.length >= 16) return s.substring(11, 16);
        return s;
    }
    function fmtDate(v) {
        if (!v) return '-';
        return String(v).substring(0, 10);
    }
    function fmtMoney(n) {
        var v = Number(n) || 0;
        return v.toLocaleString('ko-KR') + '원';
    }
    function fmtMinutes(min) {
        var m = Number(min) || 0;
        var h = Math.floor(m / 60);
        var r = m % 60;
        if (h <= 0) return r + '분';
        if (r === 0) return h + '시간';
        return h + '시간 ' + r + '분';
    }
    function statusText(s) {
        var map = { CONFIRMED: '확정', COMPLETED: '완료', CANCELLED: '취소', NO_SHOW: '노쇼', PENDING: '대기', PRESENT: '출석', ABSENT: '결석', LATE: '지각' };
        return map[s] || s || '-';
    }
    function payMethodText(s) {
        var map = { CASH: '현금', CARD: '카드', BANK_TRANSFER: '계좌이체', EASY_PAY: '간편결제' };
        return map[s] || s || '-';
    }
    function payCategoryText(s) {
        var map = { RENTAL: '대관', LESSON: '레슨', PRODUCT_SALE: '상품판매' };
        return map[s] || s || '-';
    }
    function payStatusText(s, refundAmount) {
        if (s === 'REFUNDED') return '환불';
        if (s === 'PARTIAL' || (Number(refundAmount) || 0) > 0) return '부분환불';
        if (s === 'COMPLETED' || !s) return '완료';
        if (s === 'PENDING') return '대기';
        if (s === 'CANCELLED') return '취소';
        return s || '-';
    }
    function parseWonInput(raw) {
        var s = String(raw == null ? '' : raw).replace(/[^\d]/g, '');
        if (!s) return null;
        var n = parseInt(s, 10);
        return Number.isFinite(n) ? n : null;
    }
    function formatWonInput(n) {
        if (n == null || n === '') return '';
        var v = Number(n);
        if (!Number.isFinite(v)) return '';
        return String(Math.trunc(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function updateNetProfitFromInputs() {
        var inputs = document.querySelectorAll('.settle-received-input');
        var sum = 0;
        var count = 0;
        inputs.forEach(function(el) {
            var n = parseWonInput(el.value);
            if (n == null) return;
            sum += n;
            count += 1;
        });
        var profitEl = document.getElementById('settle-net-profit');
        var countEl = document.getElementById('settle-received-count');
        if (profitEl) profitEl.textContent = fmtMoney(sum);
        if (countEl) countEl.textContent = '기록 ' + count + '건';
    }
    async function saveReceivedInput(input) {
        if (!input || input.dataset.saving === '1') return;
        var id = input.getAttribute('data-payment-id');
        if (!id) return;
        var amount = parseWonInput(input.value);
        var prev = input.getAttribute('data-saved');
        var next = amount == null ? '' : String(amount);
        if (prev === next) {
            input.value = formatWonInput(amount);
            return;
        }
        input.dataset.saving = '1';
        input.classList.add('is-saving');
        try {
            await App.api.put(portalUrl('/coach-portal/settlement/payments/' + id + '/received'), {
                receivedAmount: amount
            });
            input.setAttribute('data-saved', next);
            input.value = formatWonInput(amount);
            input.classList.add('is-saved');
            setTimeout(function() { input.classList.remove('is-saved'); }, 800);
            updateNetProfitFromInputs();
        } catch (err) {
            App.showNotification(apiError(err), 'error');
            var rollback = prev === '' ? null : parseInt(prev, 10);
            input.value = formatWonInput(Number.isFinite(rollback) ? rollback : null);
            updateNetProfitFromInputs();
        } finally {
            input.dataset.saving = '';
            input.classList.remove('is-saving');
        }
    }
    function apiError(err) {
        return (err && err.response && err.response.data && (err.response.data.message || err.response.data.error))
            || (err && err.message) || '처리에 실패했습니다.';
    }

    function currentTab() {
        var h = (location.hash || '#work').replace('#', '');
        if (h === 'members' || h === 'settlement') return h;
        return 'work';
    }

    function showTab(tab) {
        document.querySelectorAll('.coach-tab').forEach(function(el) {
            el.classList.toggle('active', el.id === 'tab-' + tab);
        });
        document.querySelectorAll('.sidebar-menu a[data-tab]').forEach(function(el) {
            el.classList.toggle('active', el.getAttribute('data-tab') === tab);
        });
        var titles = { work: '출근부', members: '내 회원', settlement: '정산' };
        var titleEl = document.getElementById('coach-home-title');
        if (titleEl) titleEl.textContent = titles[tab] || '코치 홈';
        if (tab === 'members') loadMembers();
        if (tab === 'settlement') loadSettlement();
        if (tab === 'work') loadWork();
    }

    async function loadWork() {
        var monthLabel = document.getElementById('work-month-label');
        if (monthLabel) monthLabel.textContent = ymLabel(workYear, workMonth);
        if (!hasAdminCoachParam()) {
            return;
        }
        try {
            var data = await App.api.get(portalUrl('/coach-portal/summary?year=' + workYear + '&month=' + workMonth));
            renderWork(data);
        } catch (err) {
            App.err('출근부 로드 실패:', err);
            App.showNotification(apiError(err), 'error');
        }
    }

    function renderWork(data) {
        var today = data.todayRecord || {};
        var month = data.month || {};
        var statusEl = document.getElementById('kpi-today-status');
        var timesEl = document.getElementById('kpi-today-times');
        var clockedIn = !!today.checkInTime;
        var clockedOut = !!today.checkOutTime;
        if (today.dayType === 'OFF') {
            statusEl.textContent = '휴무';
        } else if (today.dayType === 'SICK') {
            statusEl.textContent = '병가';
        } else if (today.dayType === 'OUTDOOR') {
            statusEl.textContent = '야외레슨';
        } else if (today.dayType === 'EXTERNAL_WORK') {
            statusEl.textContent = '외부업무';
        } else if (clockedOut) {
            statusEl.textContent = '퇴근';
        } else if (clockedIn) {
            statusEl.textContent = '근무 중';
        } else {
            statusEl.textContent = '미출근';
        }
        timesEl.textContent = '출근 ' + fmtTime(today.checkInTime) + ' · 퇴근 ' + fmtTime(today.checkOutTime);
        document.getElementById('kpi-work-days').textContent = (month.workDays || 0) + '일';
        document.getElementById('kpi-work-hours').textContent = '근무 ' + fmtMinutes(month.workedMinutes);
        document.getElementById('kpi-off-days').textContent = (month.offDays || 0) + '일';
        document.getElementById('kpi-sick-days').textContent = '병가 ' + (month.sickDays || 0) + '일';
        document.getElementById('kpi-today-lessons').textContent = (data.todayLessonCount || 0) + '건';
        renderCalendar(workYear, workMonth, month.days || []);
        var inBtn = document.getElementById('btn-clock-in');
        var outBtn = document.getElementById('btn-clock-out');
        if (inBtn) inBtn.disabled = clockedIn || today.dayType === 'OFF' || today.dayType === 'SICK' || today.dayType === 'OUTDOOR' || today.dayType === 'EXTERNAL_WORK';
        if (outBtn) outBtn.disabled = !clockedIn || clockedOut;
        var name = data.coachName ? data.coachName + ' 코치 홈' : '코치 홈';
        if (currentTab() === 'work') {
            var titleEl = document.getElementById('coach-home-title');
            if (titleEl) titleEl.textContent = name.replace(' 코치 홈', ' · 출근부');
        }
    }

    function renderCalendar(year, month, days) {
        var byDate = {};
        calendarPaymentsByDate = {};
        (days || []).forEach(function(d) {
            if (d && d.date) {
                var k = String(d.date).substring(0, 10);
                byDate[k] = d;
                calendarPaymentsByDate[k] = Array.isArray(d.payments) ? d.payments : [];
            }
        });
        var first = new Date(year, month - 1, 1);
        var lastDate = new Date(year, month, 0).getDate();
        var startDow = first.getDay();
        var todayStr = new Date().getFullYear() + '-' + pad(new Date().getMonth() + 1) + '-' + pad(new Date().getDate());
        var html = ['일', '월', '화', '수', '목', '금', '토'].map(function(w) {
            var extra = w === '일' ? ' is-sun' : (w === '토' ? ' is-sat' : '');
            return '<div class="coach-cal-head' + extra + '">' + w + '</div>';
        }).join('');
        for (var i = 0; i < startDow; i++) html += '<div class="coach-cal-day is-empty"></div>';
        for (var day = 1; day <= lastDate; day++) {
            var key = year + '-' + pad(month) + '-' + pad(day);
            var rec = byDate[key];
            var cls = 'coach-cal-day';
            var dow = new Date(year, month - 1, day).getDay();
            if (dow === 0) cls += ' is-sun';
            else if (dow === 6) cls += ' is-sat';
            if (key === todayStr) cls += ' is-today';
            var meta = '';
            if (rec) {
                if (rec.dayType === 'OFF') {
                    cls += ' is-off';
                    meta = '휴무';
                } else if (rec.dayType === 'SICK') {
                    cls += ' is-sick';
                    meta = '병가';
                } else if (rec.dayType === 'OUTDOOR') {
                    cls += ' is-work';
                    meta = '야외레슨';
                } else if (rec.dayType === 'EXTERNAL_WORK') {
                    cls += ' is-work';
                    meta = '외부업무';
                } else if (rec.checkInTime || rec.checkOutTime) {
                    cls += ' is-work';
                    var times = [];
                    if (rec.checkInTime) times.push('출 ' + fmtTime(rec.checkInTime));
                    if (rec.checkOutTime) times.push('퇴 ' + fmtTime(rec.checkOutTime));
                    meta = '<span class="coach-cal-times">' + times.join(' ') + '</span>';
                }
                var revenue = Number(rec.revenue) || 0;
                var pays = Array.isArray(rec.payments) ? rec.payments : [];
                if (rec.checkInTime || rec.checkOutTime || revenue !== 0) {
                    if (pays.length || revenue !== 0) {
                        meta += '<button type="button" class="coach-cal-revenue is-clickable" data-revenue-date="' + key + '">' + fmtMoney(revenue) + '</button>';
                    } else {
                        meta += '<span class="coach-cal-revenue">' + fmtMoney(revenue) + '</span>';
                    }
                }
                if (rec.memo) meta += '<span class="coach-cal-memo">' + App.escapeHtml(rec.memo) + '</span>';
            }
            html += '<div class="' + cls + '" data-date="' + key + '"><div class="coach-cal-num">' + day + '</div><div class="coach-cal-meta">' + (meta || '') + '</div></div>';
        }
        document.getElementById('work-calendar').innerHTML = html;
        document.querySelectorAll('.coach-cal-day[data-date]').forEach(function(el) {
            el.addEventListener('click', function() {
                openDayModal(el.getAttribute('data-date'), byDate[el.getAttribute('data-date')]);
            });
        });
        document.querySelectorAll('.coach-cal-revenue.is-clickable').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openRevenueModal(btn.getAttribute('data-revenue-date'));
            });
        });
    }

    async function openRevenueModal(dateStr) {
        var pays = calendarPaymentsByDate[dateStr] || [];
        if (!pays.length && dateStr) {
            try {
                var y = Number(dateStr.substring(0, 4));
                var m = Number(dateStr.substring(5, 7));
                var settle = await App.api.get(portalUrl('/coach-portal/settlement?year=' + y + '&month=' + m));
                pays = (settle.payments || []).filter(function(p) {
                    var sameDay = String(p.paidAt || '').substring(0, 10) === dateStr;
                    var st = p.status;
                    var completed = !st || st === 'COMPLETED';
                    return sameDay && completed;
                });
                calendarPaymentsByDate[dateStr] = pays;
            } catch (err) {
                pays = [];
            }
        }
        var title = document.getElementById('work-revenue-modal-title');
        var sumEl = document.getElementById('work-revenue-modal-sum');
        var body = document.getElementById('work-revenue-modal-body');
        if (title) title.textContent = dateStr + ' 수익 내역';
        var total = 0;
        pays.forEach(function(p) { total += Number(p.netAmount) || 0; });
        if (sumEl) {
            sumEl.textContent = pays.length
                ? ('이 코치로 연결된 결제 ' + pays.length + '건 · 합계 ' + fmtMoney(total))
                : '이 날짜에 연결된 결제가 없습니다.';
        }
        if (!body) return;
        if (!pays.length) {
            body.innerHTML = '<tr><td colspan="5">내역이 없습니다.</td></tr>';
        } else {
            body.innerHTML = pays.map(function(p) {
                var what = p.productName || payCategoryText(p.category);
                if (p.facilityName) what += ' · ' + p.facilityName;
                var src = p.source || '';
                if (p.method) src = (src ? src + ' · ' : '') + payMethodText(p.method);
                return '<tr><td>' + App.escapeHtml(fmtTime(p.paidAt)) + '</td>'
                    + '<td>' + App.escapeHtml(p.memberName || '-') + '</td>'
                    + '<td>' + App.escapeHtml(what || '-') + '</td>'
                    + '<td>' + App.escapeHtml(src || '-') + '</td>'
                    + '<td>' + fmtMoney(p.netAmount) + '</td></tr>';
            }).join('');
        }
        App.Modal.open('work-revenue-modal');
    }

    function openDayModal(dateStr, rec) {
        selectedWorkDate = dateStr;
        document.getElementById('work-day-modal-title').textContent = dateStr + ' 일정';
        document.getElementById('work-day-type').value = (rec && (rec.dayType === 'SICK' || rec.dayType === 'OFF' || rec.dayType === 'OUTDOOR' || rec.dayType === 'EXTERNAL_WORK')) ? rec.dayType : 'OFF';
        document.getElementById('work-day-memo').value = (rec && rec.memo) ? rec.memo : '';
        App.Modal.open('work-day-modal');
    }

    async function loadMembers() {
        if (!hasAdminCoachParam()) {
            return;
        }
        try {
            membersCache = await App.api.get(portalUrl('/coach-portal/members'));
            if (!Array.isArray(membersCache)) membersCache = [];
            renderMembers();
        } catch (err) {
            App.err('담당 회원 로드 실패:', err);
            membersCache = [];
            updateMembersCount();
            document.getElementById('coach-members-body').innerHTML = '<div class="coach-members-empty">목록을 불러오지 못했습니다.</div>';
        }
    }

    function purchaseDateOf(pass) {
        var v = pass && (pass.purchaseDate || pass.createdAt);
        return v ? fmtDate(v) : '-';
    }

    function fmtCompactDate(v) {
        var s = fmtDate(v);
        if (!s || s === '-' || s.length < 10) return s || '-';
        var md = Number(s.substring(5, 7)) + '/' + Number(s.substring(8, 10));
        var y = s.substring(0, 4);
        return y === String(new Date().getFullYear()) ? md : (y + '/' + md);
    }

    function usedTotalLabel(p) {
        var total = p.totalCount;
        var remain = p.remainingCount;
        var used = (total != null && remain != null) ? Math.max(0, total - remain) : (p.usageDates || []).length;
        if (total != null) return '사용 ' + used + '/' + total;
        if (remain != null) return '잔여 ' + remain + '회';
        return '';
    }

    function usageDatesHtml(dates) {
        var list = (dates || []).slice().filter(function(d) { return d; });
        list.sort(function(a, b) {
            return String(fmtDate(a)).localeCompare(String(fmtDate(b)));
        });
        if (!list.length) {
            return '<span class="coach-member-empty">아직 방문/사용 기록이 없습니다</span>';
        }
        return '<div class="coach-usage-dates">' + list.map(function(d) {
            return '<span class="coach-usage-date">' + App.escapeHtml(fmtCompactDate(d)) + '</span>';
        }).join('') + '</div>';
    }

    function passStatusBadge(p) {
        var st = String((p && p.status) || 'ACTIVE').toUpperCase();
        var remain = p && p.remainingCount;
        var type = p && p.productType;
        if (st === 'ACTIVE' && type === 'COUNT_PASS' && remain != null && Number(remain) === 0) {
            st = 'USED_UP';
        }
        if (st === 'ACTIVE' && p && p.expiryDate) {
            var exp = fmtDate(p.expiryDate);
            var today = new Date().getFullYear() + '-' + pad(new Date().getMonth() + 1) + '-' + pad(new Date().getDate());
            if (exp && exp !== '-' && exp < today) st = 'EXPIRED';
        }
        if (st === 'ACTIVE') {
            return '<span class="badge badge-success">활성</span>';
        }
        if (st === 'EXPIRED') {
            return '<span class="badge badge-warning">만료</span>';
        }
        if (st === 'USED_UP') {
            return '<span class="badge badge-danger">전부 소진</span>';
        }
        return '<span class="badge badge-secondary">' + App.escapeHtml(st) + '</span>';
    }

    function remainingCountHtml(p) {
        if (!p || p.remainingCount == null || p.remainingCount === '') {
            return '<span class="coach-member-remain">-</span>';
        }
        var n = parseInt(p.remainingCount, 10);
        if (isNaN(n)) {
            return '<span class="coach-member-remain">-</span>';
        }
        var cls = 'coach-member-remain' + (n <= 0 ? ' is-zero' : '');
        return '<span class="' + cls + '">' + n + '</span>';
    }

    function memberPassRows(member) {
        var passes = (member && member.activePasses) || [];
        var fallback = (member && member.usageDates) || [];
        if (!passes.length) {
            return [{ purchase: '-', name: '-', status: '-', dates: usageDatesHtml(fallback), remain: '<span class="coach-member-remain">-</span>' }];
        }
        return passes.map(function(p) {
            var dates = (p.usageDates && p.usageDates.length)
                ? p.usageDates
                : ((p.taughtDates && p.taughtDates.length) ? p.taughtDates : []);
            return {
                purchase: purchaseDateOf(p),
                name: p.productName || '이용권',
                status: passStatusBadge(p),
                dates: usageDatesHtml(dates),
                remain: remainingCountHtml(p)
            };
        });
    }

    function memberPassCellsHtml(row, follow) {
        var extra = follow ? ' is-follow' : '';
        return '<div class="col-purchase' + extra + '">' + App.escapeHtml(row.purchase) + '</div>'
            + '<div class="col-pass' + extra + '">' + App.escapeHtml(row.name) + '</div>'
            + '<div class="col-status' + extra + '">' + (row.status || '-') + '</div>'
            + '<div class="col-dates' + extra + '">' + row.dates + '</div>'
            + '<div class="col-remain' + extra + '">' + (row.remain || '-') + '</div>';
    }

    function memberUsageSummaryHtml(member) {
        var rows = memberPassRows(member);
        var cells = rows.map(function(row, i) {
            return memberPassCellsHtml(row, i > 0);
        }).join('');
        return '<div class="coach-members-head coach-members-summary-head">'
            + '<div class="col-purchase">구매일</div><div class="col-pass">이용권</div><div class="col-status">상태</div>'
            + '<div class="col-dates">나온 날짜</div><div class="col-remain">남은 횟수</div>'
            + '</div>'
            + '<div class="coach-member-card coach-member-summary-card" style="--pass-rows:' + rows.length + '">'
            + cells
            + '</div>';
    }

    function updateMembersCount() {
        var el = document.getElementById('coach-members-count');
        if (!el) return;
        el.textContent = (membersCache.length || 0) + '명';
    }

    function detachVisitsPanel() {
        var panel = document.getElementById('member-visits-card');
        var host = document.getElementById('member-visits-host');
        if (panel && host && panel.parentNode !== host) {
            host.appendChild(panel);
        }
    }

    function attachVisitsPanel() {
        var panel = document.getElementById('member-visits-card');
        if (!panel) return;
        if (!selectedMemberId) {
            panel.style.display = 'none';
            detachVisitsPanel();
            return;
        }
        var card = document.querySelector('#coach-members-body .coach-member-card[data-member-id="' + selectedMemberId + '"]');
        var block = card && card.closest('.coach-member-block');
        if (!block) {
            panel.style.display = 'none';
            detachVisitsPanel();
            return;
        }
        panel.style.display = '';
        block.appendChild(panel);
    }

    function renderMembers() {
        updateMembersCount();
        var q = (document.getElementById('member-search').value || '').trim().toLowerCase();
        var rows = membersCache.filter(function(m) {
            if (!q) return true;
            return String(m.name || '').toLowerCase().indexOf(q) >= 0
                || String(m.phoneNumber || '').indexOf(q) >= 0
                || String(m.memberNumber || '').toLowerCase().indexOf(q) >= 0;
        });
        var body = document.getElementById('coach-members-body');
        detachVisitsPanel();
        if (!rows.length) {
            body.innerHTML = '<div class="coach-members-empty">담당 회원이 없습니다.</div>';
            attachVisitsPanel();
            return;
        }
        body.innerHTML = rows.map(function(m) {
            var sel = String(m.id) === String(selectedMemberId) ? ' is-selected' : '';
            var passRows = memberPassRows(m);
            var nameCell = '<div class="coach-member-card-name" style="grid-row: 1 / span ' + passRows.length + '">'
                + '<div class="coach-member-name">' + App.escapeHtml(m.name || '-') + '</div>'
                + (m.memberNumber ? '<div class="coach-member-secondary">' + App.escapeHtml(m.memberNumber) + '</div>' : '')
                + '</div>';
            var cells = passRows.map(function(row, i) {
                return memberPassCellsHtml(row, i > 0);
            }).join('');
            return '<div class="coach-member-block">'
                + '<article class="coach-member-card' + sel + '" data-member-id="' + m.id + '" style="--pass-rows:' + passRows.length + '">'
                + nameCell
                + cells
                + '</article></div>';
        }).join('');
        body.querySelectorAll('.coach-member-card[data-member-id]').forEach(function(card) {
            card.addEventListener('click', function() {
                var id = Number(card.getAttribute('data-member-id'));
                if (String(selectedMemberId) === String(id)) {
                    selectedMemberId = null;
                    renderMembers();
                    return;
                }
                loadVisits(id);
            });
        });
        attachVisitsPanel();
    }

    function usageRowsFromPayload(data) {
        if (!data) return [];
        if (Array.isArray(data)) {
            var withPass = data.filter(function(v) { return v && (v.productName || v.changeAmount != null); });
            return withPass.length ? withPass : data;
        }
        if (Array.isArray(data.usages) && data.usages.length) return data.usages;
        if (Array.isArray(data.visits)) return data.visits;
        return [];
    }

    function renderVisitRows(rows) {
        var body = document.getElementById('member-visits-body');
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="4">아직 방문/사용 기록이 없습니다.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(function(v, i) {
            var count = '-';
            if (v.remainingBefore != null && v.remainingAfter != null) {
                count = v.remainingBefore + '회 → ' + v.remainingAfter + '회';
            } else if (v.remainingAfter != null) {
                count = v.remainingAfter + '회 남음';
            }
            var session = v.sessionNumber != null ? (v.sessionNumber + '회') : (v.startTime ? '수업' : ((rows.length - i) + '회'));
            var time = fmtTime(v.checkInTime || v.startTime);
            var dateCell = App.escapeHtml(fmtDate(v.date))
                + (time && time !== '-' ? '<div class="coach-member-secondary">' + App.escapeHtml(time) + '</div>' : '');
            return '<tr><td>' + dateCell + '</td>'
                + '<td>' + App.escapeHtml(session) + '</td>'
                + '<td>' + App.escapeHtml(v.productName || '-') + '</td>'
                + '<td>' + App.escapeHtml(count) + '</td></tr>';
        }).join('');
    }

    async function loadVisits(memberId) {
        selectedMemberId = memberId;
        renderMembers();
        var member = membersCache.find(function(m) { return Number(m.id) === Number(memberId); });
        var panel = document.getElementById('member-visits-card');
        var title = document.getElementById('member-visits-title');
        var body = document.getElementById('member-visits-body');
        if (title) title.textContent = '이용 이력';
        if (body) body.innerHTML = '<tr><td colspan="4">로딩 중...</td></tr>';
        if (panel) {
            panel.style.display = '';
            try { panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
        }
        try {
            var data = await App.api.get(portalUrl('/coach-portal/members/' + memberId + '/visits'));
            if (String(selectedMemberId) !== String(memberId)) return;
            if (data && !Array.isArray(data) && member) {
                if (data.joinDate) member.joinDate = data.joinDate;
                if (data.createdAt) member.createdAt = data.createdAt;
            }
            var rows = usageRowsFromPayload(data);
            rows.sort(function(a, b) {
                var da = String(fmtDate(a && a.date));
                var db = String(fmtDate(b && b.date));
                if (da !== db) return da.localeCompare(db);
                return String(fmtTime((a && (a.checkInTime || a.startTime)) || '')).localeCompare(String(fmtTime((b && (b.checkInTime || b.startTime)) || '')));
            });
            renderVisitRows(rows);
            if (member && rows.length && (!member.usageDates || !member.usageDates.length)) {
                member.usageDates = rows.map(function(v) { return fmtDate(v.date); }).filter(function(d) { return d && d !== '-'; });
                renderMembers();
            }
        } catch (err) {
            if (String(selectedMemberId) !== String(memberId)) return;
            document.getElementById('member-visits-body').innerHTML = '<tr><td colspan="4">이력을 불러오지 못했습니다.</td></tr>';
        }
    }

    async function loadSettlement() {
        if (!hasAdminCoachParam()) {
            return;
        }
        var label = document.getElementById('settle-month-label');
        if (label) label.textContent = ymLabel(settleYear, settleMonth);
        try {
            var data = await App.api.get(portalUrl('/coach-portal/settlement?year=' + settleYear + '&month=' + settleMonth));
            var payments = (data.payments || []).slice();
            payments.sort(function(a, b) {
                return String(b.paidAt || '').localeCompare(String(a.paidAt || ''));
            });
            var methodCounts = {};
            var refundTotal = 0;
            payments.forEach(function(p) {
                var method = p.method || '';
                if (method) methodCounts[method] = (methodCounts[method] || 0) + 1;
                refundTotal += Number(p.refundAmount) || 0;
            });
            var refundedCount = data.refundedCount != null
                ? Number(data.refundedCount) || 0
                : payments.filter(function(p) {
                    return p.status === 'REFUNDED' || (Number(p.refundAmount) || 0) > 0;
                }).length;
            var methodParts = Object.keys(methodCounts).map(function(k) {
                return payMethodText(k) + ' ' + methodCounts[k] + '건';
            });
            document.getElementById('settle-revenue').textContent = fmtMoney(data.revenue);
            document.getElementById('settle-payments').textContent = '완료 ' + (data.paymentCount || 0) + '건';
            var netProfitEl = document.getElementById('settle-net-profit');
            if (netProfitEl) netProfitEl.textContent = fmtMoney(data.netProfit);
            var receivedCountEl = document.getElementById('settle-received-count');
            if (receivedCountEl) receivedCountEl.textContent = '기록 ' + (data.receivedCount || 0) + '건';
            document.getElementById('settle-payment-count').textContent = payments.length + '건';
            document.getElementById('settle-methods').textContent = methodParts.length ? methodParts.join(' · ') : '결제 없음';
            document.getElementById('settle-refunds').textContent = fmtMoney(refundTotal);
            document.getElementById('settle-refund-count').textContent = '환불 ' + refundedCount + '건';
            var pBody = document.getElementById('settle-payments-body');
            pBody.innerHTML = payments.length ? payments.map(function(p) {
                var what = p.productName || payCategoryText(p.category);
                if (p.facilityName) what += ' · ' + p.facilityName;
                var when = fmtDate(p.paidAt);
                var tm = fmtTime(p.paidAt);
                if (tm && tm !== '-') when += ' ' + tm;
                var received = (p.receivedAmount == null || p.receivedAmount === '') ? '' : p.receivedAmount;
                var saved = received === '' ? '' : String(received);
                return '<tr><td>' + App.escapeHtml(when) + '</td>'
                    + '<td>' + App.escapeHtml(p.memberName || '-') + '</td>'
                    + '<td>' + App.escapeHtml(what || '-') + '</td>'
                    + '<td>' + App.escapeHtml(payMethodText(p.method)) + '</td>'
                    + '<td>' + App.escapeHtml(payStatusText(p.status, p.refundAmount)) + '</td>'
                    + '<td>' + fmtMoney(p.netAmount) + '</td>'
                    + '<td class="settle-received-cell"><input type="text" inputmode="numeric" class="form-control settle-received-input" data-payment-id="'
                    + App.escapeHtml(String(p.id || '')) + '" data-saved="' + App.escapeHtml(saved)
                    + '" value="' + App.escapeHtml(formatWonInput(received === '' ? null : received))
                    + '" placeholder="받은 금액"></td></tr>';
            }).join('') : '<tr><td colspan="7">해당 월에 이 코치로 연결된 결제가 없습니다.</td></tr>';
        } catch (err) {
            App.err('정산 로드 실패:', err);
            App.showNotification(apiError(err), 'error');
        }
    }

    function shiftMonth(which, delta) {
        if (which === 'work') {
            workMonth += delta;
            if (workMonth < 1) { workMonth = 12; workYear -= 1; }
            if (workMonth > 12) { workMonth = 1; workYear += 1; }
            loadWork();
        } else {
            settleMonth += delta;
            if (settleMonth < 1) { settleMonth = 12; settleYear -= 1; }
            if (settleMonth > 12) { settleMonth = 1; settleYear += 1; }
            loadSettlement();
        }
    }

    document.addEventListener('DOMContentLoaded', async function() {
        var role = (App.currentRole || (App.currentUser && App.currentUser.role) || '').toUpperCase();
        var operator = typeof App.isCoachHomeOperator === 'function' && App.isCoachHomeOperator();
        isAdmin = role === 'ADMIN' || role === 'MANAGER' || operator;
        if (role !== 'COACH' && !isAdmin) {
            document.getElementById('coach-unlinked-banner').style.display = '';
            document.querySelector('#coach-unlinked-banner .card-title').textContent = '코치 전용 페이지';
            document.querySelector('#coach-unlinked-banner .coach-home-hint').textContent = '코치 계정으로 로그인하면 출근부·담당 회원·정산을 볼 수 있습니다.';
            document.getElementById('coach-home-body').style.display = 'none';
            return;
        }
        if (isAdmin) {
            await setupAdminCoachSelect();
            if (!adminCoachId) {
                document.getElementById('coach-unlinked-banner').style.display = '';
                document.querySelector('#coach-unlinked-banner .card-title').textContent = '코치를 선택해 주세요';
                document.querySelector('#coach-unlinked-banner .coach-home-hint').textContent = '상단에서 코치를 고르면 해당 코치의 출근부·회원·정산을 볼 수 있습니다.';
                document.getElementById('coach-home-body').style.display = 'none';
                return;
            }
        } else {
            var linked = App.currentUser && App.currentUser.linkedCoachId;
            if (!linked) {
                try {
                    var me = await App.api.get('/auth/me');
                    if (me && App.currentUser) {
                        App.currentUser.linkedCoachId = me.linkedCoachId || null;
                        App.currentUser.linkedCoachName = me.linkedCoachName || null;
                        localStorage.setItem('currentUser', JSON.stringify(App.currentUser));
                        linked = App.currentUser.linkedCoachId;
                    }
                } catch (e) {}
            }
            if (!linked) {
                document.getElementById('coach-unlinked-banner').style.display = '';
                document.getElementById('coach-home-body').style.display = 'none';
                return;
            }
        }
        bindPortalEvents();
        showTab(currentTab());
    });

    async function setupAdminCoachSelect() {
        var sel = document.getElementById('admin-coach-select');
        if (!sel) return;
        try {
            var list = await App.api.get('/coaches/active');
            if (!Array.isArray(list)) list = [];
            list = list.slice().sort(function(a, b) {
                var oa = (typeof App.CoachSortOrder === 'function') ? App.CoachSortOrder(a) : 9;
                var ob = (typeof App.CoachSortOrder === 'function') ? App.CoachSortOrder(b) : 9;
                if (oa !== ob) return oa - ob;
                return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
            });
            var saved = null;
            try { saved = sessionStorage.getItem('afbs_admin_coach_home_id'); } catch (e) {}
            sel.innerHTML = list.map(function(c) {
                return '<option value="' + c.id + '">' + App.escapeHtml(c.name || ('코치 ' + c.id)) + '</option>';
            }).join('');
            if (!list.length) {
                sel.style.display = 'none';
                return;
            }
            if (saved && list.some(function(c) { return String(c.id) === String(saved); })) {
                sel.value = saved;
            }
            adminCoachId = sel.value || null;
            try { sessionStorage.setItem('afbs_admin_coach_home_id', adminCoachId || ''); } catch (e) {}
            sel.style.display = '';
            sel.addEventListener('change', function() {
                adminCoachId = sel.value || null;
                try { sessionStorage.setItem('afbs_admin_coach_home_id', adminCoachId || ''); } catch (e) {}
                document.getElementById('coach-unlinked-banner').style.display = 'none';
                document.getElementById('coach-home-body').style.display = '';
                selectedMemberId = null;
                var visitsCard = document.getElementById('member-visits-card');
                if (visitsCard) visitsCard.style.display = 'none';
                showTab(currentTab());
            });
        } catch (err) {
            App.err('코치 목록 로드 실패:', err);
        }
    }

    function bindPortalEvents() {
        document.querySelectorAll('.sidebar-menu a[data-tab]').forEach(function(a) {
            a.addEventListener('click', function(e) {
                e.preventDefault();
                var tab = a.getAttribute('data-tab');
                location.hash = tab;
                showTab(tab);
            });
        });
        window.addEventListener('hashchange', function() { showTab(currentTab()); });
        document.getElementById('btn-clock-in').addEventListener('click', async function() {
            try {
                await App.api.post(portalUrl('/coach-portal/work/clock-in'), {});
                App.showNotification('출근 체크되었습니다.', 'success');
                loadWork();
            } catch (err) {
                App.showNotification(apiError(err), 'error');
            }
        });
        document.getElementById('btn-clock-out').addEventListener('click', async function() {
            try {
                await App.api.post(portalUrl('/coach-portal/work/clock-out'), {});
                App.showNotification('퇴근 체크되었습니다.', 'success');
                loadWork();
            } catch (err) {
                App.showNotification(apiError(err), 'error');
            }
        });
        document.getElementById('btn-month-prev').addEventListener('click', function() { shiftMonth('work', -1); });
        document.getElementById('btn-month-next').addEventListener('click', function() { shiftMonth('work', 1); });
        document.getElementById('btn-settle-prev').addEventListener('click', function() { shiftMonth('settle', -1); });
        document.getElementById('btn-settle-next').addEventListener('click', function() { shiftMonth('settle', 1); });
        var settleBody = document.getElementById('settle-payments-body');
        if (settleBody) {
            settleBody.addEventListener('input', function(e) {
                var input = e.target && e.target.classList && e.target.classList.contains('settle-received-input') ? e.target : null;
                if (input) updateNetProfitFromInputs();
            });
            settleBody.addEventListener('focusout', function(e) {
                var input = e.target && e.target.classList && e.target.classList.contains('settle-received-input') ? e.target : null;
                if (input) saveReceivedInput(input);
            });
            settleBody.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('settle-received-input')) {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        }
        document.getElementById('member-search').addEventListener('input', renderMembers);
        document.getElementById('work-day-modal-close').addEventListener('click', function() { App.Modal.close('work-day-modal'); });
        document.getElementById('work-revenue-modal-close').addEventListener('click', function() { App.Modal.close('work-revenue-modal'); });
        document.getElementById('work-day-save').addEventListener('click', async function() {
            try {
                await App.api.put(portalUrl('/coach-portal/work/days'), {
                    date: selectedWorkDate,
                    dayType: document.getElementById('work-day-type').value,
                    memo: document.getElementById('work-day-memo').value
                });
                App.Modal.close('work-day-modal');
                App.showNotification('일정이 저장되었습니다.', 'success');
                loadWork();
            } catch (err) {
                App.showNotification(apiError(err), 'error');
            }
        });
        document.getElementById('work-day-clear').addEventListener('click', async function() {
            try {
                await App.api.delete(portalUrl('/coach-portal/work/days/' + selectedWorkDate));
                App.Modal.close('work-day-modal');
                App.showNotification('일정을 해제했습니다.', 'success');
                loadWork();
            } catch (err) {
                App.showNotification(apiError(err), 'error');
            }
        });
    }
})();
