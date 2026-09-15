(function() {
    var dirty = false;
    var loadedDate = '';
    var plans = [];
    var FIELD_RENTAL_FEE = 300000;

    function branch() {
        // 야외 레슨 명단은 실내 예약 지점과 무관하게 날짜별로 공유한다.
        // 기존 데이터는 사하 사회인 페이지에서 SAHA로 저장되어 있다.
        return 'SAHA';
    }

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function formatKoDate(iso) {
        if (!iso) return '';
        var p = String(iso).split('-');
        if (p.length < 3) return iso;
        return Number(p[1]) + '월 ' + Number(p[2]) + '일';
    }

    function escapeHtml(s) {
        return typeof App !== 'undefined' && App.escapeHtml ? App.escapeHtml(s) : String(s || '');
    }

    function dateInput() {
        return document.getElementById('outdoor-lesson-date');
    }

    function tbody() {
        return document.getElementById('outdoor-lesson-tbody');
    }

    function clearDateHint() {
        var hint = document.getElementById('outdoor-lesson-date-hint');
        if (hint) hint.textContent = '';
    }

    function notify(msg, type) {
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification(msg, type || 'info');
        }
    }

    function formatWon(amount) {
        if (amount == null || amount === '' || isNaN(Number(amount))) return '-';
        if (typeof App !== 'undefined' && App.formatCurrency) {
            return App.formatCurrency(Number(amount));
        }
        return Number(amount).toLocaleString('ko-KR') + '원';
    }

    function planById(id) {
        if (id == null || id === '') return null;
        var key = String(id);
        for (var i = 0; i < plans.length; i++) {
            if (String(plans[i].id) === key) return plans[i];
        }
        return null;
    }

    function rowPlanPrice(tr) {
        var sel = tr && tr.querySelector('.ol-plan');
        if (!sel || !sel.value) return null;
        var plan = planById(sel.value);
        if (plan && plan.price != null && plan.price !== '') return Number(plan.price);
        var opt = sel.options[sel.selectedIndex];
        if (opt && opt.dataset && opt.dataset.price) return Number(opt.dataset.price);
        return null;
    }

    function updateRowAmount(tr) {
        if (!tr) return;
        var el = tr.querySelector('.ol-amount');
        if (!el) return;
        el.textContent = formatWon(rowPlanPrice(tr));
    }

    function planOptionsHtml(selectedId) {
        var html = '<option value="">요금제 선택</option>';
        var selected = selectedId != null && selectedId !== '' ? String(selectedId) : '';
        var found = false;
        plans.forEach(function(plan) {
            var id = String(plan.id);
            var sel = id === selected ? ' selected' : '';
            if (sel) found = true;
            html += '<option value="' + escapeHtml(id) + '" data-price="' + escapeHtml(plan.price == null ? '' : String(plan.price)) + '"' + sel + '>'
                + escapeHtml(plan.name || ('요금제 #' + id)) + '</option>';
        });
        if (selected && !found) {
            html += '<option value="' + escapeHtml(selected) + '" selected>선택한 요금제</option>';
        }
        return html;
    }

    function setPlans(nextPlans) {
        plans = Array.isArray(nextPlans) ? nextPlans.slice() : [];
    }

    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setAmountText(id, amount) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = formatWon(amount);
        if (Number(amount) < 0) el.classList.add('ol-settle-minus');
        else el.classList.remove('ol-settle-minus');
    }

    function updateSummary() {
        var rows = tbody() ? tbody().querySelectorAll('tr') : [];
        var total = 0;
        var confirmed = 0;
        var confirmedAmount = 0;
        var teams = {};
        rows.forEach(function(tr) {
            var name = ((tr.querySelector('.ol-name') || {}).value || '').trim();
            if (!name) return;
            total++;
            var team = ((tr.querySelector('.ol-team') || {}).value || '').trim();
            if (team) teams[team] = true;
            var cb = tr.querySelector('.ol-deposit');
            if (cb && cb.checked) {
                confirmed++;
                var price = rowPlanPrice(tr);
                if (price != null && !isNaN(price)) confirmedAmount += price;
            }
        });
        var rentalFee = -FIELD_RENTAL_FEE;
        var grandTotal = confirmedAmount + rentalFee;
        var teamCount = Object.keys(teams).length;
        setText('ol-count-total', total + '명');
        setText('ol-count-confirmed', confirmed + '명');
        setText('ol-count-pending', (total - confirmed) + '명');
        setText('ol-count-teams', teamCount + '팀');
        setAmountText('ol-amount-deposit', confirmedAmount);
        setAmountText('ol-amount-rental', rentalFee);
        setAmountText('ol-amount-total', grandTotal);
    }

    function renumber() {
        var rows = tbody().querySelectorAll('tr');
        rows.forEach(function(tr, i) {
            var cell = tr.querySelector('.ol-seq');
            if (cell) cell.textContent = String(i + 1);
        });
        updateSummary();
    }

    function digitsOnly(s) {
        return String(s || '').replace(/\D/g, '');
    }

    function looksLikePhone(s) {
        var d = digitsOnly(s);
        return d.length >= 9 && d.length <= 11 && /^0?1/.test(d);
    }

    function formatPhone(s) {
        var d = digitsOnly(s);
        if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
        if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
        return String(s || '').trim();
    }

    function parseSlashLine(raw) {
        var line = String(raw || '').trim();
        if (!line) return null;
        if (line.indexOf('/') < 0 && /\t/.test(line)) {
            line = line.replace(/\t+/g, '/');
        }
        if (line.indexOf('/') < 0) return null;
        var parts = line.split('/').map(function(p) { return p.trim(); }).filter(Boolean);
        if (parts.length < 2) return null;
        if (parts.length === 2) {
            if (looksLikePhone(parts[1])) {
                return { name: parts[0], team: '', phone: formatPhone(parts[1]) };
            }
            return { name: parts[0], team: parts[1], phone: '' };
        }
        var last = parts[parts.length - 1];
        if (looksLikePhone(last)) {
            return {
                name: parts[0],
                team: parts.slice(1, -1).join('/'),
                phone: formatPhone(last)
            };
        }
        return { name: parts[0], team: parts.slice(1).join('/'), phone: '' };
    }

    function parseSlashBlock(text) {
        return String(text || '').split(/\r?\n/).map(parseSlashLine).filter(Boolean);
    }

    function fillRow(tr, parsed) {
        if (!tr || !parsed) return;
        var n = tr.querySelector('.ol-name');
        var t = tr.querySelector('.ol-team');
        var p = tr.querySelector('.ol-phone');
        if (n) n.value = parsed.name || '';
        if (t) t.value = parsed.team || '';
        if (p) p.value = parsed.phone || '';
        dirty = true;
    }

    function applyParsedList(startTr, list) {
        if (!startTr || !list || !list.length) return;
        fillRow(startTr, list[0]);
        for (var i = 1; i < list.length; i++) {
            addRow(list[i], { skipFocus: true });
        }
        renumber();
    }

    function carryBadgeHtml(fromDate) {
        if (!fromDate) return '';
        return '<span class="ol-carry-badge">' + escapeHtml(formatKoDate(fromDate)) + '에서 이월</span>';
    }

    function addDaysIso(iso, days) {
        var p = String(iso || '').split('-');
        if (p.length < 3) return todayStr();
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        d.setDate(d.getDate() + days);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function addRow(data, opts) {
        data = data || {};
        var tr = document.createElement('tr');
        if (data.id != null && data.id !== '') tr.dataset.id = String(data.id);
        if (data.carriedFromDate) tr.dataset.carriedFromDate = String(data.carriedFromDate);
        if (data.attended) tr.dataset.attended = '1';
        tr.innerHTML =
            '<td class="ol-seq"></td>' +
            '<td class="ol-name-cell" data-label="이름"><input type="text" class="form-control ol-name" maxlength="100" placeholder="이름" value="' + escapeHtml(data.name || '') + '">' +
            carryBadgeHtml(data.carriedFromDate) + '</td>' +
            '<td data-label="팀"><input type="text" class="form-control ol-team" maxlength="100" placeholder="소속 팀" value="' + escapeHtml(data.team || '') + '"></td>' +
            '<td data-label="연락처"><input type="text" class="form-control ol-phone" maxlength="20" placeholder="010-0000-0000" value="' + escapeHtml(data.phone || '') + '"></td>' +
            '<td class="ol-plan-cell" data-label="요금제"><select class="form-control ol-plan">' + planOptionsHtml(data.productId) + '</select></td>' +
            '<td class="ol-amount-cell" data-label="금액"><span class="ol-amount">-</span></td>' +
            '<td class="ol-deposit-cell" data-label="입금"><label class="ol-deposit-label"><input type="checkbox" class="ol-deposit"' + (data.depositConfirmed ? ' checked' : '') + '> 확인</label></td>' +
            '<td class="ol-carry-cell"><button type="button" class="btn btn-secondary btn-sm ol-carry">이월</button></td>' +
            '<td class="ol-remove-cell"><button type="button" class="btn btn-danger btn-sm ol-remove">삭제</button></td>';
        tbody().appendChild(tr);
        dirty = true;
        updateRowAmount(tr);
        renumber();
        var nameInput = tr.querySelector('.ol-name');
        if (nameInput && !data.name && !(opts && opts.skipFocus)) nameInput.focus();
    }

    function collectRow(tr) {
        if (!tr) return null;
        var planSel = tr.querySelector('.ol-plan');
        var productId = null;
        if (planSel && planSel.value) {
            var parsedId = Number(planSel.value);
            if (!isNaN(parsedId)) productId = parsedId;
        }
        var row = {
            name: (tr.querySelector('.ol-name') || {}).value || '',
            team: (tr.querySelector('.ol-team') || {}).value || '',
            phone: (tr.querySelector('.ol-phone') || {}).value || '',
            productId: productId,
            depositConfirmed: !!(tr.querySelector('.ol-deposit') && tr.querySelector('.ol-deposit').checked)
        };
        if (tr.dataset && tr.dataset.id) {
            var idNum = Number(tr.dataset.id);
            if (!isNaN(idNum)) row.id = idNum;
        }
        if (tr.dataset && tr.dataset.carriedFromDate) {
            row.carriedFromDate = tr.dataset.carriedFromDate;
        }
        row.attended = !!(tr.dataset && tr.dataset.attended === '1');
        return row;
    }

    function collectRows() {
        var out = [];
        tbody().querySelectorAll('tr').forEach(function(tr) {
            out.push(collectRow(tr));
        });
        return out;
    }

    function render(participants) {
        tbody().innerHTML = '';
        (participants || []).forEach(function(p) { addRow(p, { skipFocus: true }); });
        if (!participants || !participants.length) {
            addRow({}, { skipFocus: true });
        }
        dirty = false;
        renumber();
    }

    async function loadForDate(dateStr) {
        if (!dateStr) return;
        try {
            var data = await App.api.get('/outdoor-lesson-participants?lessonDate=' + encodeURIComponent(dateStr) + '&branch=' + encodeURIComponent(branch()));
            loadedDate = dateStr;
            setPlans(data.plans);
            render(data.participants || []);
            clearDateHint();
        } catch (e) {
            notify('참가 인원 목록을 불러오지 못했습니다.', 'danger');
        }
    }

    async function save() {
        var dateStr = dateInput().value;
        if (!dateStr) {
            notify('날짜를 선택해 주세요.', 'warning');
            return false;
        }
        var moving = loadedDate && loadedDate !== dateStr;
        var previousDate = loadedDate;
        if (moving) {
            var ok = confirm(formatKoDate(loadedDate) + ' 명단을 ' + formatKoDate(dateStr) + '로 옮길까요?\n원래 날짜 목록은 비워집니다.');
            if (!ok) return false;
        }
        try {
            var payload = {
                lessonDate: dateStr,
                branch: branch(),
                participants: collectRows()
            };
            if (moving) payload.previousLessonDate = previousDate;
            var data = await App.api.put('/outdoor-lesson-participants', payload);
            if (moving && previousDate) {
                try {
                    await App.api.put('/outdoor-lesson-participants', {
                        lessonDate: previousDate,
                        branch: branch(),
                        participants: []
                    });
                } catch (clearErr) {
                    App.err && App.err('이전 날짜 명단 삭제 실패:', clearErr);
                }
            }
            loadedDate = dateStr;
            if (dateInput()) dateInput().value = dateStr;
            setPlans(data.plans);
            render(data.participants || []);
            clearDateHint();
            notify(moving ? '명단을 옮겼고, 원래 날짜 목록은 비웠습니다.' : '야외 레슨 참가 인원을 저장했습니다.', 'success');
            return true;
        } catch (e) {
            notify('저장에 실패했습니다.', 'danger');
            return false;
        }
    }

    function apiErrorMessage(e, fallback) {
        if (e && e.response && e.response.data) {
            return e.response.data.message || e.response.data.error || fallback;
        }
        return fallback;
    }

    function ensureCarryOverlay() {
        if (document.getElementById('ol-carry-overlay')) return;
        var modal = document.querySelector('#outdoor-lesson-modal .modal')
            || document.getElementById('outdoor-lesson-modal');
        if (!modal) return;
        var overlay = document.createElement('div');
        overlay.id = 'ol-carry-overlay';
        overlay.className = 'ol-carry-overlay';
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="ol-carry-dialog" role="dialog" aria-labelledby="ol-carry-who">' +
            '<p id="ol-carry-who"></p>' +
            '<label class="form-label" for="ol-carry-date">이월 날짜</label>' +
            '<input type="date" class="form-control" id="ol-carry-date">' +
            '<p class="ol-carry-help">입금 확인·요금제는 그대로 두고, 이 사람만 선택한 날짜 명단으로 옮깁니다.</p>' +
            '<div class="ol-carry-actions">' +
            '<button type="button" class="btn btn-secondary" id="ol-carry-cancel">취소</button>' +
            '<button type="button" class="btn btn-primary" id="ol-carry-ok">이월</button>' +
            '</div></div>';
        modal.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeCarryOverlay();
        });
        var cancel = document.getElementById('ol-carry-cancel');
        if (cancel) cancel.addEventListener('click', closeCarryOverlay);
        var ok = document.getElementById('ol-carry-ok');
        if (ok) ok.addEventListener('click', confirmCarryOver);
    }

    function closeCarryOverlay() {
        var overlay = document.getElementById('ol-carry-overlay');
        if (overlay) overlay.hidden = true;
        if (overlay) overlay._carryTr = null;
    }

    function openCarryOverlay(tr) {
        ensureCarryOverlay();
        var overlay = document.getElementById('ol-carry-overlay');
        var who = document.getElementById('ol-carry-who');
        var dateEl = document.getElementById('ol-carry-date');
        if (!overlay || !dateEl) return;
        var name = ((tr.querySelector('.ol-name') || {}).value || '').trim() || '이 참가자';
        if (who) who.textContent = '"' + name + '" 님을 어느 날짜로 이월할까요?';
        dateEl.value = addDaysIso(loadedDate || (dateInput() && dateInput().value) || todayStr(), 7);
        overlay._carryTr = tr;
        overlay.hidden = false;
        dateEl.focus();
    }

    async function confirmCarryOver() {
        var overlay = document.getElementById('ol-carry-overlay');
        var tr = overlay && overlay._carryTr;
        var toDate = document.getElementById('ol-carry-date') && document.getElementById('ol-carry-date').value;
        var fromDate = loadedDate || (dateInput() && dateInput().value);
        if (!tr) {
            closeCarryOverlay();
            return;
        }
        var row = collectRow(tr);
        var name = (row && row.name || '').trim();
        if (!name) {
            notify('이름을 입력한 뒤 이월해 주세요.', 'warning');
            return;
        }
        if (!toDate) {
            notify('이월할 날짜를 선택해 주세요.', 'warning');
            return;
        }
        if (!fromDate) {
            notify('현재 레슨 날짜가 없습니다.', 'warning');
            return;
        }
        if (fromDate === toDate) {
            notify('같은 날짜로는 이월할 수 없습니다.', 'warning');
            return;
        }
        try {
            var data = await App.api.post('/outdoor-lesson-participants/carry-over', {
                fromDate: fromDate,
                toDate: toDate,
                branch: branch(),
                participant: row
            });
            closeCarryOverlay();
            tr.remove();
            if (!tbody().querySelector('tr')) addRow({}, { skipFocus: true });
            renumber();
            notify('"' + (data.movedName || name) + '" 님을 ' + formatKoDate(toDate) + '로 이월했습니다.', 'success');
        } catch (e) {
            notify(apiErrorMessage(e, '이월에 실패했습니다.'), 'danger');
        }
    }

    function loadOtherDate() {
        var next = dateInput() && dateInput().value;
        if (!next) {
            notify('날짜를 선택해 주세요.', 'warning');
            return;
        }
        if (next === loadedDate && !dirty) {
            loadForDate(next);
            return;
        }
        if (dirty || next !== loadedDate) {
            if (!confirm('지금 화면의 내용은 저장되지 않습니다. ' + formatKoDate(next) + ' 명단을 불러올까요?')) {
                if (dateInput() && loadedDate) dateInput().value = loadedDate;
                return;
            }
        }
        loadForDate(next);
    }

    function attendanceUrl(dateStr) {
        return '/outdoor-lesson-attendance.html?date=' + encodeURIComponent(dateStr);
    }

    function isMobileView() {
        return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    }

    function goAttendance(url) {
        if (isMobileView()) {
            window.location.href = url;
            return;
        }
        window.open(url, 'ol-attendance');
    }

    function openAttendancePage() {
        var dateStr = dateInput() && dateInput().value;
        if (!dateStr) {
            notify('날짜를 선택해 주세요.', 'warning');
            return;
        }
        var url = attendanceUrl(dateStr);
        if (!dirty) {
            goAttendance(url);
            return;
        }
        if (isMobileView()) {
            save().then(function(ok) {
                if (ok) window.location.href = url;
            });
            return;
        }
        var w = window.open('about:blank', 'ol-attendance');
        if (!w) {
            notify('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 눌러 주세요.', 'warning');
            return;
        }
        try {
            w.document.title = '야외 레슨 출석';
            w.document.body.textContent = '명단을 저장한 뒤 출석 화면을 엽니다...';
        } catch (e) { /* ignore */ }
        save().then(function(ok) {
            if (ok) w.location = url;
            else w.close();
        });
    }

    function openModal() {
        var input = dateInput();
        if (input && !input.value) input.value = todayStr();
        App.Modal.open('outdoor-lesson-modal');
        loadForDate(input.value);
    }

    function bind() {
        var openBtn = document.getElementById('btn-outdoor-lesson-roster');
        if (!openBtn) return;
        openBtn.addEventListener('click', openModal);

        var addBtn = document.getElementById('btn-outdoor-lesson-add');
        if (addBtn) addBtn.addEventListener('click', function() { addRow({}); });

        var attBtn = document.getElementById('btn-outdoor-lesson-attendance');
        if (attBtn) attBtn.addEventListener('click', openAttendancePage);

        var saveBtn = document.getElementById('btn-outdoor-lesson-save');
        if (saveBtn) saveBtn.addEventListener('click', save);

        ensureCarryOverlay();

        var loadBtn = document.getElementById('btn-outdoor-lesson-load');
        if (loadBtn) loadBtn.addEventListener('click', loadOtherDate);

        var closeBtn = document.getElementById('btn-outdoor-lesson-close');
        if (closeBtn) closeBtn.addEventListener('click', function() {
            App.Modal.close('outdoor-lesson-modal');
        });

        if (dateInput()) {
            dateInput().addEventListener('change', function() {
                var next = dateInput().value;
                var hint = document.getElementById('outdoor-lesson-date-hint');
                if (hint) {
                    if (loadedDate && next && next !== loadedDate) {
                        hint.textContent = formatKoDate(loadedDate) + ' 명단을 ' + formatKoDate(next) + '로 옮기려면 저장을 누르세요. 다른 날짜를 보려면 조회를 누르세요.';
                    } else {
                        hint.textContent = '';
                    }
                }
            });
        }

        if (tbody()) {
            tbody().addEventListener('click', function(e) {
                var carryBtn = e.target.closest('.ol-carry');
                if (carryBtn) {
                    var carryTr = carryBtn.closest('tr');
                    if (!carryTr) return;
                    var carryName = ((carryTr.querySelector('.ol-name') || {}).value || '').trim();
                    if (!carryName) {
                        notify('이름을 입력한 뒤 이월해 주세요.', 'warning');
                        return;
                    }
                    openCarryOverlay(carryTr);
                    return;
                }
                var btn = e.target.closest('.ol-remove');
                if (!btn) return;
                var tr = btn.closest('tr');
                if (!tr) return;
                var name = ((tr.querySelector('.ol-name') || {}).value || '').trim();
                var msg = name
                    ? '"' + name + '" 참가자를 삭제할까요?'
                    : '이 줄을 삭제할까요?';
                if (!confirm(msg)) return;
                tr.remove();
                dirty = true;
                if (!tbody().querySelector('tr')) addRow({});
                renumber();
            });
            tbody().addEventListener('paste', function(e) {
                var input = e.target.closest && e.target.closest('.ol-name, .ol-team, .ol-phone');
                if (!input) return;
                var text = (e.clipboardData || window.clipboardData).getData('text');
                var list = parseSlashBlock(text);
                if (!list.length) return;
                e.preventDefault();
                applyParsedList(input.closest('tr'), list);
            });
            tbody().addEventListener('blur', function(e) {
                var input = e.target && e.target.classList && e.target.classList.contains('ol-name') ? e.target : null;
                if (!input) return;
                var parsed = parseSlashLine(input.value);
                if (!parsed) return;
                fillRow(input.closest('tr'), parsed);
            }, true);
            tbody().addEventListener('change', function(e) {
                dirty = true;
                var planSel = e.target && e.target.classList && e.target.classList.contains('ol-plan') ? e.target : null;
                if (planSel) updateRowAmount(planSel.closest('tr'));
                updateSummary();
            });
            tbody().addEventListener('input', function() {
                dirty = true;
                updateSummary();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
    window.openOutdoorLessonRosterModal = openModal;
})();
