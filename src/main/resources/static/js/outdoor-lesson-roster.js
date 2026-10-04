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

    function formatChipDate(iso) {
        if (!iso) return '';
        var p = String(iso).split('-');
        if (p.length < 3) return iso;
        return Number(p[1]) + '/' + Number(p[2]);
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
        var plan = planBySelect(tr);
        if (plan && plan.price != null && plan.price !== '') return Number(plan.price);
        var opt = sel.options[sel.selectedIndex];
        if (opt && opt.dataset && opt.dataset.price) return Number(opt.dataset.price);
        return null;
    }

    function isPrepaidPassRow(tr) {
        if (!tr) return false;
        if (tr.dataset.prepaidPass === '0') return false;
        if (tr.dataset.prepaidPass === '1') return true;
        if (!isCountPassPlan(planBySelect(tr))) return false;
        var rem = remainingAtStartOf(tr);
        var total = Number(tr.dataset.totalCount);
        return rem != null && !isNaN(total) && total > 1 && rem < total;
    }

    function setPrepaidPassFlag(tr, prepaid) {
        if (!tr) return;
        if (prepaid === false) tr.dataset.prepaidPass = '0';
        else if (prepaid) tr.dataset.prepaidPass = '1';
        else delete tr.dataset.prepaidPass;
    }

    function rowChargeAmount(tr) {
        if (isPrepaidPassRow(tr)) return 0;
        return rowPlanPrice(tr);
    }

    function updateRowAmount(tr) {
        if (!tr) return;
        var el = tr.querySelector('.ol-amount');
        if (!el) return;
        el.textContent = formatWon(rowChargeAmount(tr));
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
            var people = rowHeadcount(tr);
            total += people;
            if (isTeamRow(tr)) {
                var team = ((tr.querySelector('.ol-team') || {}).value || '').trim()
                    || ((tr.querySelector('.ol-name') || {}).value || '').trim();
                if (team) teams[team] = true;
            }
            var cb = tr.querySelector('.ol-deposit');
            if (cb && cb.checked) {
                confirmed += people;
                var price = rowChargeAmount(tr);
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
        updateRowNotes(tr);
        lookupPassForRow(tr);
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

    function notesForRow(tr) {
        var notes = [];
        var name = ((tr.querySelector('.ol-name') || {}).value || '').trim();
        if (!name) return notes;
        var cb = tr.querySelector('.ol-deposit');
        if (!cb || !cb.checked) notes.push('입금 확인 할 것');
        var teamMode = isTeamRow(tr);
        var phone = digitsOnly((tr.querySelector('.ol-phone') || {}).value || '');
        if (!teamMode && !phone) notes.push('연락처 확인 할 것');
        var planSel = tr.querySelector('.ol-plan');
        if (!planSel || !planSel.value) notes.push('요금제 확인 할 것');
        return notes;
    }

    function notesHtml(notes) {
        if (!notes || !notes.length) return '';
        return '<div class="ol-notes">' + notes.map(function(n) {
            return '<span class="ol-note">' + escapeHtml(n) + '</span>';
        }).join('') + '</div>';
    }

    function updateRowNotes(tr) {
        if (!tr) return;
        var cell = tr.querySelector('.ol-name-cell');
        if (!cell) return;
        var box = cell.querySelector('.ol-notes');
        var html = notesHtml(notesForRow(tr));
        if (!html) {
            if (box) box.remove();
            return;
        }
        if (box) box.outerHTML = html;
        else cell.insertAdjacentHTML('beforeend', html);
    }

    function remainingHtml(data) {
        if (!data || data.remainingCount == null || data.remainingCount === '') return '';
        var total = data.totalCount != null && data.totalCount !== '' ? ('/' + data.totalCount) : '';
        var empty = Number(data.remainingCount) <= 0 ? ' is-empty' : '';
        return '<div class="ol-pass-remaining' + empty + '">잔여 ' + escapeHtml(String(data.remainingCount)) + total + '회</div>';
    }

    function isTeamPlan(plan) {
        if (!plan) return false;
        if (plan.teamPackage || plan.type === 'TEAM_PACKAGE') return true;
        var name = String(plan.name || '');
        return name.indexOf('팀') >= 0 && (name.indexOf('대관') >= 0 || name.indexOf('패키지') >= 0);
    }

    function isTeamRow(tr) {
        var cb = tr && tr.querySelector('.ol-team-check');
        return !!(cb && cb.checked);
    }

    function rowHeadcount(tr) {
        if (!isTeamRow(tr)) return 1;
        var el = tr && tr.querySelector('.ol-headcount');
        var n = Number(el && el.value);
        if (!isNaN(n) && n >= 1) return Math.min(99, Math.floor(n));
        return 1;
    }

    function remainingAtStartOf(tr) {
        if (!tr || !tr.dataset) return null;
        var start = tr.dataset.remainingAtStart;
        if (start == null || start === '') start = tr.dataset.remainingCount;
        var n = Number(start);
        return isNaN(n) ? null : n;
    }

    function overflowMessage(tr) {
        if (!tr || !isTeamRow(tr) || !isCountPassPlan(planBySelect(tr))) return '';
        var remaining = remainingAtStartOf(tr);
        if (remaining == null) return '';
        var hc = rowHeadcount(tr);
        if (hc <= remaining) return '';
        var team = ((tr.querySelector('.ol-team') || {}).value || '').trim();
        var name = ((tr.querySelector('.ol-name') || {}).value || '').trim();
        var who = team || name || '이 예약';
        return who + ' 잔여 ' + remaining + '회인데 인원이 ' + hc + '명입니다. 잔여 횟수를 넘을 수 없습니다.';
    }

    function markHeadcountOverflow(tr, notifyNow) {
        if (!tr) return '';
        var msg = overflowMessage(tr);
        var input = tr.querySelector('.ol-headcount');
        if (input) input.classList.toggle('is-overflow', !!msg);
        if (notifyNow && msg) notify(msg, 'warning');
        return msg;
    }

    function firstHeadcountOverflow() {
        var msg = '';
        tbody().querySelectorAll('tr').forEach(function(tr) {
            if (msg) return;
            msg = markHeadcountOverflow(tr, false);
        });
        return msg;
    }

    function headcountOf(data) {
        var n = Number(data && data.headcount);
        if (!isNaN(n) && n >= 1) return Math.min(99, Math.floor(n));
        return 1;
    }

    function isCountPassPlan(plan) {
        if (!plan) return false;
        if (plan.countPass) return true;
        if (plan.teamPackage || plan.type === 'TEAM_PACKAGE' || plan.type === 'COUNT_PASS') return true;
        return String(plan.name || '').indexOf('10회') >= 0;
    }

    function updateRowHeadcountMode(tr) {
        if (!tr) return;
        var input = tr.querySelector('.ol-headcount');
        if (!input) return;
        var teamMode = isTeamRow(tr);
        if (teamMode) {
            input.disabled = false;
            input.placeholder = '인원';
            tr.classList.add('is-team');
        } else {
            input.value = '1';
            input.disabled = true;
            tr.classList.remove('is-team');
        }
    }

    function planBySelect(tr) {
        var sel = tr && tr.querySelector('.ol-plan');
        if (!sel || !sel.value) return null;
        for (var i = 0; i < plans.length; i++) {
            if (String(plans[i].id) === String(sel.value)) return plans[i];
        }
        return null;
    }

    function updateRowRemaining(tr) {
        if (!tr) return;
        var cell = tr.querySelector('.ol-name-cell');
        if (!cell) return;
        var remaining = tr.dataset.remainingCount;
        var total = tr.dataset.totalCount;
        var plan = planBySelect(tr);
        if (!isCountPassPlan(plan)) {
            remaining = '';
            total = '';
            delete tr.dataset.remainingCount;
            delete tr.dataset.remainingAtStart;
            delete tr.dataset.totalCount;
        }
        var html = remainingHtml({ remainingCount: remaining, totalCount: total });
        var box = cell.querySelector('.ol-pass-remaining');
        if (!html) {
            if (box) box.remove();
            markHeadcountOverflow(tr, false);
            updateRowAmount(tr);
            return;
        }
        if (box) box.outerHTML = html;
        else {
            var nameInput = cell.querySelector('.ol-name');
            if (nameInput && nameInput.insertAdjacentHTML) nameInput.insertAdjacentHTML('afterend', html);
            else cell.insertAdjacentHTML('beforeend', html);
        }
        markHeadcountOverflow(tr, false);
        updateRowAmount(tr);
    }

    async function lookupPassForRow(tr) {
        if (!tr) return;
        var name = ((tr.querySelector('.ol-name') || {}).value || '').trim();
        var phone = ((tr.querySelector('.ol-phone') || {}).value || '').trim();
        var team = ((tr.querySelector('.ol-team') || {}).value || '').trim();
        if (!name && !team) return;
        try {
            var data = await App.api.get('/outdoor-lesson-participants/pass-lookup?name='
                + encodeURIComponent(name)
                + '&phone=' + encodeURIComponent(phone)
                + '&team=' + encodeURIComponent(team)
                + '&teamBooking=' + (isTeamRow(tr) ? 'true' : 'false')
                + (dateInput() && dateInput().value ? '&lessonDate=' + encodeURIComponent(dateInput().value) : ''));
            applyPassToRow(tr, data, { fillEmpty: true });
        } catch (e) { /* ignore */ }
    }

    function applyPassToRow(tr, data, opts) {
        if (!tr || !data) return;
        var fillEmpty = !!(opts && opts.fillEmpty);
        function fill(sel, val) {
            var el = tr.querySelector(sel);
            if (!el || val == null || val === '') return;
            if (fillEmpty && String(el.value || '').trim()) return;
            el.value = val;
        }
        fill('.ol-name', data.name);
        fill('.ol-phone', data.phone);
        fill('.ol-team', data.team);
        if (data.productId != null) {
            var planSel = tr.querySelector('.ol-plan');
            if (planSel) {
                var id = String(data.productId);
                var found = false;
                for (var i = 0; i < planSel.options.length; i++) {
                    if (planSel.options[i].value === id) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    var opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = data.planName || '팀 이용권';
                    planSel.appendChild(opt);
                    if (!planById(data.productId)) {
                        plans.push({
                            id: data.productId,
                            name: data.planName || '팀 이용권',
                            type: data.teamPackage ? 'TEAM_PACKAGE' : null,
                            teamPackage: !!data.teamPackage,
                            countPass: true,
                            price: data.depositAmount != null ? data.depositAmount : 0
                        });
                    }
                }
                planSel.value = id;
            }
        }
        if (data.remainingCount != null) tr.dataset.remainingCount = String(data.remainingCount);
        if (data.remainingAtStart != null) tr.dataset.remainingAtStart = String(data.remainingAtStart);
        else if (data.remainingCount != null) tr.dataset.remainingAtStart = String(data.remainingCount);
        if (data.totalCount != null) tr.dataset.totalCount = String(data.totalCount);
        setPrepaidPassFlag(tr, data.prepaidPass);
        var cb = tr.querySelector('.ol-deposit');
        if (cb && data.depositConfirmed) cb.checked = true;
        updateRowAmount(tr);
        updateRowRemaining(tr);
        updateRowHeadcountMode(tr);
        updateRowNotes(tr);
        updateSummary();
        dirty = true;
        if (isTeamRow(tr) && opts && opts.focusHeadcount) {
            var head = tr.querySelector('.ol-headcount');
            if (head && !head.disabled) head.focus();
        }
    }

    function applyMemberToRow(tr, member) {
        if (!tr || !member) return;
        var nameInput = tr.querySelector('.ol-name');
        var teamInput = tr.querySelector('.ol-team');
        var phoneInput = tr.querySelector('.ol-phone');
        if (nameInput) nameInput.value = member.name || '';
        if (teamInput) teamInput.value = member.team || '';
        if (phoneInput) phoneInput.value = member.phone || '';
        applyPassToRow(tr, member, { fillEmpty: false });
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
        if (data.remainingCount != null) tr.dataset.remainingCount = String(data.remainingCount);
        if (data.remainingAtStart != null) tr.dataset.remainingAtStart = String(data.remainingAtStart);
        else if (data.remainingCount != null && !data.countPassApplied) {
            tr.dataset.remainingAtStart = String(data.remainingCount);
        }
        if (data.totalCount != null) tr.dataset.totalCount = String(data.totalCount);
        if (data.pendingDeductDate) tr.dataset.pendingDeductDate = String(data.pendingDeductDate);
        if (data.countPassApplied) tr.dataset.countPassApplied = '1';
        setPrepaidPassFlag(tr, data.prepaidPass);
        var teamMode = !!(data.teamBooking);
        var hc = teamMode ? headcountOf(data) : 1;
        tr.innerHTML =
            '<td class="ol-seq"></td>' +
            '<td class="ol-name-cell" data-label="이름"><div class="ol-suggest-wrap">' +
            '<input type="text" class="form-control ol-name" maxlength="100" placeholder="이름·회원 검색" autocomplete="off" value="' + escapeHtml(data.name || '') + '">' +
            '</div>' + remainingHtml(data) + carryBadgeHtml(data.carriedFromDate) + notesHtml(data.notes) + '</td>' +
            '<td class="ol-team-flag-cell" data-label="팀"><label class="ol-team-flag"><input type="checkbox" class="ol-team-check" aria-label="팀"' + (teamMode ? ' checked' : '') + '></label></td>' +
            '<td class="ol-team-cell" data-label="소속 팀"><input type="text" class="form-control ol-team" maxlength="100" placeholder="소속 팀" autocomplete="off" value="' + escapeHtml(data.team || '') + '"></td>' +
            '<td class="ol-phone-cell" data-label="연락처"><input type="text" class="form-control ol-phone" maxlength="20" placeholder="010-0000-0000" value="' + escapeHtml(data.phone || '') + '"></td>' +
            '<td class="ol-headcount-cell" data-label="인원"><input type="number" class="form-control ol-headcount" min="1" max="99" inputmode="numeric" value="' + escapeHtml(String(hc)) + '"' + (teamMode ? '' : ' disabled') + '></td>' +
            '<td class="ol-plan-cell" data-label="요금제"><select class="form-control ol-plan">' + planOptionsHtml(data.productId) + '</select></td>' +
            '<td class="ol-amount-cell" data-label="금액"><span class="ol-amount">-</span></td>' +
            '<td class="ol-deposit-cell" data-label="입금"><label class="ol-deposit-label"><input type="checkbox" class="ol-deposit"' + (data.depositConfirmed ? ' checked' : '') + '> 확인</label></td>' +
            '<td class="ol-carry-cell"><button type="button" class="btn btn-secondary btn-sm ol-carry">이월</button></td>' +
            '<td class="ol-remove-cell"><button type="button" class="btn btn-danger btn-sm ol-remove">삭제</button></td>';
        tbody().appendChild(tr);
        dirty = true;
        updateRowAmount(tr);
        updateRowRemaining(tr);
        updateRowHeadcountMode(tr);
        updateRowNotes(tr);
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
            headcount: rowHeadcount(tr),
            teamBooking: isTeamRow(tr),
            productId: productId,
            depositConfirmed: !!(tr.querySelector('.ol-deposit') && tr.querySelector('.ol-deposit').checked)
        };
        if (tr.dataset && tr.dataset.remainingAtStart) {
            var start = Number(tr.dataset.remainingAtStart);
            if (!isNaN(start)) row.remainingCount = start;
        } else if (tr.dataset && tr.dataset.remainingCount) {
            var rem = Number(tr.dataset.remainingCount);
            if (!isNaN(rem)) row.remainingCount = rem;
        }
        if (tr.dataset && tr.dataset.totalCount) {
            var tot = Number(tr.dataset.totalCount);
            if (!isNaN(tot)) row.totalCount = tot;
        }
        if (tr.dataset && tr.dataset.pendingDeductDate) {
            row.pendingDeductDate = tr.dataset.pendingDeductDate;
        }
        row.countPassApplied = !!(tr.dataset && tr.dataset.countPassApplied === '1');
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
            if (data.seededFromPrevious) dirty = true;
            var hint = document.getElementById('outdoor-lesson-date-hint');
            if (hint) {
                if (data.seededFromPrevious) {
                    hint.textContent = '이전 야외일의 횟수권 잔여 인원을 불러왔습니다. 확인 후 저장하세요.';
                } else if (data.socialOutdoorDay === false) {
                    hint.textContent = '이 날짜는 달력에 사회인 야외일로 표시되지 않았습니다. 명단은 비어 있습니다.';
                } else {
                    hint.textContent = '';
                }
            }
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
        var overflow = firstHeadcountOverflow();
        if (overflow) {
            notify(overflow, 'warning');
            return false;
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
            notify(apiErrorMessage(e, '저장에 실패했습니다.'), 'danger');
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
        closeHistoryOverlay();
        var input = dateInput();
        if (input && !input.value) input.value = todayStr();
        App.Modal.open('outdoor-lesson-modal');
        loadForDate(input.value);
    }

    function ensureHistoryOverlay() {
        var existing = document.getElementById('ol-history-overlay');
        if (existing && !existing.querySelector('#ol-history-date-filter')) {
            existing.remove();
            existing = null;
        }
        // 야외 레슨 모달 안에 있으면 청백전 모달 위에 안 보임 → body로 이동
        if (existing && existing.parentElement !== document.body) {
            document.body.appendChild(existing);
        }
        if (document.getElementById('ol-history-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'ol-history-overlay';
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="ol-history-head">' +
            '<h3>사회인 누적 명단</h3>' +
            '<p class="ol-history-sub">야외 레슨 · 청백전 참가가 이름·연락처 기준으로 함께 집계됩니다.</p>' +
            '<select class="form-control ol-history-filter" id="ol-history-date-filter" aria-label="날짜 필터">' +
            '<option value="">전체 날짜</option></select>' +
            '<select class="form-control ol-history-filter" id="ol-history-amount-filter" aria-label="결제 금액 필터">' +
            '<option value="">전체 금액</option></select>' +
            '<input type="search" class="form-control ol-history-search" id="ol-history-search" placeholder="이름·팀·연락처 검색">' +
            '<button type="button" class="btn btn-secondary ol-history-close" id="ol-history-close">닫기</button>' +
            '</div>' +
            '<div class="ol-history-body" id="ol-history-body"></div>';
        document.body.appendChild(overlay);
        var closeBtn = document.getElementById('ol-history-close');
        if (closeBtn) closeBtn.addEventListener('click', closeHistoryOverlay);
        ['ol-history-search', 'ol-history-date-filter', 'ol-history-amount-filter'].forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(id === 'ol-history-search' ? 'input' : 'change', function() {
                renderHistory(overlay._data);
            });
        });
    }

    function closeHistoryOverlay() {
        var overlay = document.getElementById('ol-history-overlay');
        if (overlay) overlay.hidden = true;
    }

    function historyDigits(phone) {
        var d = String(phone || '').replace(/\D/g, '');
        if (d.indexOf('82') === 0 && d.length >= 12) d = '0' + d.slice(2);
        if (d.length === 10 && d.indexOf('10') === 0) d = '0' + d;
        return d;
    }

    function historyPersonKeyJs(name, phone) {
        var n = String(name || '').trim().replace(/\s+/g, '');
        var ph = historyDigits(phone);
        if (!n) return '';
        return ph ? n + '|' + ph : n;
    }

    function mergeVisitLists(targetVisits, extraVisits) {
        var seen = {};
        var out = [];
        (targetVisits || []).concat(extraVisits || []).forEach(function(v) {
            if (!v || !v.lessonDate || seen[v.lessonDate]) return;
            seen[v.lessonDate] = true;
            out.push(v);
        });
        out.sort(function(a, b) {
            return String(a.lessonDate || '').localeCompare(String(b.lessonDate || ''));
        });
        return out;
    }

    function mergeTwoMembers(target, extra) {
        if (!target) return extra;
        if (!extra) return target;
        target.visits = mergeVisitLists(target.visits, extra.visits);
        var extraPaid = Number(extra.paidAmount) || 0;
        var targetPaid = Number(target.paidAmount) || 0;
        if (extraPaid > 0) {
            if (!targetPaid) target.paidAmount = extraPaid;
            else if (targetPaid !== extraPaid) target.paidAmount = targetPaid + extraPaid;
        }
        if (!target.team && extra.team) target.team = extra.team;
        if (extra.phone) target.phone = extra.phone;
        if (extra.phoneDigits) target.phoneDigits = extra.phoneDigits;
        if (extra.remainingCount != null) {
            target.remainingCount = extra.remainingCount;
            target.totalCount = extra.totalCount;
        }
        if (extra.remainingAtStart != null) target.remainingAtStart = extra.remainingAtStart;
        if (extra.planName) target.planName = extra.planName;
        if (extra.productId != null) target.productId = extra.productId;
        if (extra.countPass) target.countPass = true;
        if (extra.totalCount != null && (target.totalCount == null || Number(extra.totalCount) > Number(target.totalCount))) {
            target.totalCount = extra.totalCount;
        }
        return target;
    }

    function finishMergedMember(m) {
        m.visits = mergeVisitLists(m.visits, []);
        m.visitCount = m.visits.length;
        m.attendedCount = m.visits.filter(function(v) { return v && v.attended; }).length;
        return m;
    }

    function historyPassKeyJs(raw) {
        var pid = raw && raw.productId != null ? raw.productId : 'x';
        if (raw && (raw.countPass || Number(raw.totalCount) > 1 || String(raw.planName || '').indexOf('10회') >= 0)) {
            return 'p:' + pid;
        }
        var first = ((raw && raw.visits) || [])[0] || {};
        return 's:' + pid + ':' + (first.lessonDate || '');
    }

    function mergeHistoryMembers(list) {
        var byKey = {};
        (list || []).forEach(function(raw) {
            if (!raw || !raw.name) return;
            var person = historyPersonKeyJs(raw.name, raw.phone || raw.phoneDigits);
            if (!person) return;
            var key = person + '#' + historyPassKeyJs(raw);
            var copy = {
                name: String(raw.name).trim().replace(/\s+/g, ''),
                team: raw.team || '',
                phone: raw.phone || '',
                phoneDigits: historyDigits(raw.phone || raw.phoneDigits),
                planName: raw.planName || '',
                productId: raw.productId,
                remainingCount: raw.remainingCount,
                remainingAtStart: raw.remainingAtStart,
                totalCount: raw.totalCount,
                countPass: !!raw.countPass,
                paidAmount: Number(raw.paidAmount) || 0,
                visits: (raw.visits || []).slice()
            };
            byKey[key] = byKey[key] ? mergeTwoMembers(byKey[key], copy) : copy;
        });
        var byPass = {};
        Object.keys(byKey).forEach(function(key) {
            var hash = key.lastIndexOf('#');
            var person = hash < 0 ? key : key.slice(0, hash);
            var pass = hash < 0 ? '' : key.slice(hash + 1);
            var name = person.indexOf('|') >= 0 ? person.slice(0, person.indexOf('|')) : person;
            var group = name + '#' + pass;
            if (!byPass[group]) byPass[group] = [];
            byPass[group].push(key);
        });
        Object.keys(byPass).forEach(function(group) {
            var keys = byPass[group];
            var withPhone = keys.filter(function(k) {
                var person = k.slice(0, k.lastIndexOf('#'));
                return person.indexOf('|') >= 0;
            });
            var noPhone = keys.filter(function(k) {
                var person = k.slice(0, k.lastIndexOf('#'));
                return person.indexOf('|') < 0;
            });
            if (withPhone.length !== 1 || !noPhone.length) return;
            noPhone.forEach(function(extraKey) {
                mergeTwoMembers(byKey[withPhone[0]], byKey[extraKey]);
                delete byKey[extraKey];
            });
        });
        fillMissingPhoneFromSameNameJs(byKey);
        return Object.keys(byKey).map(function(key) {
            return finishMergedMember(byKey[key]);
        }).sort(function(a, b) {
            var byName = String(a.name || '').localeCompare(String(b.name || ''), 'ko');
            if (byName) return byName;
            var da = ((a.visits || [])[0] || {}).lessonDate || '';
            var db = ((b.visits || [])[0] || {}).lessonDate || '';
            return String(da).localeCompare(String(db));
        });
    }

    function historyFilters() {
        var search = document.getElementById('ol-history-search');
        var dateEl = document.getElementById('ol-history-date-filter');
        var amountEl = document.getElementById('ol-history-amount-filter');
        return {
            query: search ? String(search.value || '').trim().toLowerCase() : '',
            date: dateEl ? String(dateEl.value || '') : '',
            amount: amountEl && amountEl.value !== '' ? Number(amountEl.value) : null
        };
    }

    function fillHistoryFilters(data) {
        var dateEl = document.getElementById('ol-history-date-filter');
        var amountEl = document.getElementById('ol-history-amount-filter');
        var keepDate = dateEl ? dateEl.value : '';
        var keepAmount = amountEl ? amountEl.value : '';
        var dates = {};
        var amounts = {};
        (data.expenses || []).forEach(function(e) {
            if (e && e.lessonDate) dates[e.lessonDate] = true;
        });
        (data.members || []).forEach(function(m) {
            if (m && m.paidAmount != null && m.paidAmount !== '') amounts[Number(m.paidAmount)] = true;
            (m.visits || []).forEach(function(v) {
                if (v && v.lessonDate) dates[v.lessonDate] = true;
                if (v && v.amount != null && v.amount !== '') amounts[Number(v.amount)] = true;
            });
        });
        if (dateEl) {
            dateEl.innerHTML = '<option value="">전체 날짜</option>' + Object.keys(dates).sort().map(function(ymd) {
                return '<option value="' + escapeHtml(ymd) + '"' + (ymd === keepDate ? ' selected' : '') + '>'
                    + escapeHtml(formatKoDate(ymd)) + '</option>';
            }).join('');
        }
        if (amountEl) {
            amountEl.innerHTML = '<option value="">전체 금액</option>' + Object.keys(amounts).map(Number).filter(function(n) {
                return !isNaN(n);
            }).sort(function(a, b) { return a - b; }).map(function(n) {
                var val = String(n);
                return '<option value="' + escapeHtml(val) + '"' + (val === keepAmount ? ' selected' : '') + '>'
                    + escapeHtml(formatWon(n)) + '</option>';
            }).join('');
        }
    }

    function memberMatchesAmount(member, amount) {
        if (amount == null || isNaN(amount)) return true;
        if (Number(member.paidAmount) === amount) return true;
        return (member.visits || []).some(function(v) {
            return Number(v && v.amount) === amount;
        });
    }

    function memberMatchesDate(member, date) {
        if (!date) return true;
        return (member.visits || []).some(function(v) {
            return v && v.lessonDate === date;
        });
    }

    function isCountPassMember(member) {
        if (!member) return false;
        if (member.countPass) return true;
        if (Number(member.totalCount) > 1) return true;
        return String(member.planName || '').indexOf('10회') >= 0;
    }

    function sessionTotal(member) {
        if (isCountPassMember(member)) {
            var total = Number(member.totalCount);
            return total > 1 ? total : 10;
        }
        return 1;
    }

    function todayYmd() {
        var d = new Date();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    function visitConsumed(v) {
        if (!v || !v.lessonDate) return false;
        var today = todayYmd();
        if (v.lessonDate < today) return true;
        if (v.lessonDate === today) return !!v.attended;
        return false;
    }

    function consumedCount(member) {
        return ((member && member.visits) || []).filter(visitConsumed).length;
    }

    function passRemaining(member) {
        if (!member || member.remainingCount == null || member.remainingCount === '') return null;
        var n = Number(member.remainingCount);
        return isNaN(n) ? null : n;
    }

    function passComplete(member) {
        var total = sessionTotal(member);
        var remaining = passRemaining(member);
        if (remaining != null && remaining <= 0 && total > 1) return true;
        return consumedCount(member) >= total;
    }

    function countLabel(member) {
        var total = sessionTotal(member);
        var booked = ((member && member.visits) || []).length;
        var remaining = passRemaining(member);
        var usedFromVisits = consumedCount(member);
        var used = remaining != null && total > 1
            ? Math.max(usedFromVisits, Math.max(0, total - remaining))
            : usedFromVisits;
        var html = '<span class="ol-history-count">' + used + '/' + total + '회</span>';
        if (passComplete(member)) {
            html += '<span class="ol-history-remain is-done">사용 완료</span>';
        } else if (total > 1) {
            var remainShow = remaining != null ? Math.max(0, remaining) : Math.max(0, total - used);
            html += '<span class="ol-history-remain">잔여 ' + remainShow + '/' + total + '</span>';
        } else if (booked > usedFromVisits) {
            html += '<span class="ol-history-remain">참가 예정</span>';
        }
        if (member && member.planName) {
            html += '<span class="ol-history-plan">' + escapeHtml(member.planName) + '</span>';
        }
        return html;
    }

    function priorUsedCount(member) {
        var total = sessionTotal(member);
        if (total <= 1) return 0;
        var start = member && member.remainingAtStart != null && member.remainingAtStart !== ''
            ? Number(member.remainingAtStart) : passRemaining(member);
        if (start == null || isNaN(start)) return 0;
        return Math.max(0, Math.min(total, total - start));
    }

    function visitChipDone(member, v) {
        if (!visitConsumed(v)) return false;
        if (!isCountPassMember(member)) return true;
        return passComplete(member);
    }

    function visitChips(member) {
        var visits = (member && member.visits) || [];
        var total = sessionTotal(member);
        var prior = priorUsedCount(member);
        var html = [];
        var visitIdx = 0;
        for (var i = 0; i < total; i++) {
            if (i < prior) {
                html.push('<span class="ol-history-date is-done" title="이전 사용 · ' + (i + 1) + '회">'
                    + escapeHtml((i + 1) + '회') + '</span>');
                continue;
            }
            var v = visits[visitIdx++];
            if (v && v.lessonDate) {
                var done = visitChipDone(member, v);
                var cls = 'ol-history-date' + (done ? ' is-done' : '');
                var title = done ? '이용권 사용 완료' : (v.attended ? '출석' : (visitConsumed(v) ? '참가' : '참가 예정'));
                if (v.source === 'SCRIMMAGE') title = (done ? '청백전 사용' : '청백전') + ' · ' + formatKoDate(v.lessonDate);
                else if (v.alsoScrimmage) title = title + ' · 청백전 포함';
                else title = title + ' · ' + formatKoDate(v.lessonDate);
                var chipLabel = v.source === 'SCRIMMAGE'
                    ? ('청 ' + formatChipDate(v.lessonDate))
                    : formatChipDate(v.lessonDate);
                html.push('<span class="' + cls + (v.source === 'SCRIMMAGE' ? ' is-scrimmage' : '') + '" title="'
                    + escapeHtml(title) + '">'
                    + escapeHtml(chipLabel) + '</span>');
            } else {
                html.push('<span class="ol-history-date is-empty" title="미참석">' + escapeHtml((i + 1) + '회') + '</span>');
            }
        }
        return '<div class="ol-history-dates">' + html.join('') + '</div>';
    }

    function historySearchHay(member) {
        return [
            member && member.name,
            member && member.team,
            member && member.phone,
            member && member.planName
        ].join(' ').toLowerCase();
    }

    function fillMissingPhoneFromSameNameJs(byKey) {
        var phoneByName = {};
        var unique = {};
        Object.keys(byKey).forEach(function(key) {
            var m = byKey[key];
            var name = String(m && m.name || '').trim().replace(/\s+/g, '');
            var phone = historyDigits(m && (m.phoneDigits || m.phone));
            if (!name || !phone) return;
            if (!phoneByName[name]) {
                phoneByName[name] = phone;
                unique[name] = true;
            } else if (phoneByName[name] !== phone) {
                unique[name] = false;
            }
        });
        Object.keys(byKey).forEach(function(key) {
            var m = byKey[key];
            var name = String(m && m.name || '').trim().replace(/\s+/g, '');
            if (!unique[name] || historyDigits(m && (m.phoneDigits || m.phone))) return;
            m.phoneDigits = phoneByName[name];
            var d = phoneByName[name];
            m.phone = d.length === 11 ? d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7) : d;
        });
    }

    function uniqueMemberCount(members) {
        var seen = {};
        (members || []).forEach(function(m) {
            var key = historyPersonKeyJs(m && m.name, (m && (m.phone || m.phoneDigits)) || '');
            if (key) seen[key] = true;
        });
        return Object.keys(seen).length;
    }

    function firstVisitDateOf(member) {
        return ((member && member.visits) || [])[0] && member.visits[0].lessonDate || '';
    }

    function groupHistoryPeople(passList) {
        var byKey = {};
        var order = [];
        (passList || []).forEach(function(pass) {
            if (!pass || !pass.name) return;
            var key = historyPersonKeyJs(pass.name, pass.phone || pass.phoneDigits) || String(pass.name);
            if (!byKey[key]) {
                byKey[key] = {
                    name: pass.name,
                    team: pass.team || '',
                    phone: pass.phone || '',
                    phoneDigits: pass.phoneDigits || '',
                    passes: []
                };
                order.push(key);
            }
            var person = byKey[key];
            person.passes.push(pass);
            if (pass.team) person.team = pass.team;
            if (pass.phone) person.phone = pass.phone;
            if (pass.phoneDigits) person.phoneDigits = pass.phoneDigits;
        });
        return order.map(function(key) {
            var person = byKey[key];
            person.passes.sort(function(a, b) {
                return String(firstVisitDateOf(a)).localeCompare(String(firstVisitDateOf(b)));
            });
            return person;
        }).sort(function(a, b) {
            return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
        });
    }

    function personSearchHay(person) {
        var parts = [person && person.name, person && person.team, person && person.phone];
        ((person && person.passes) || []).forEach(function(pass) {
            parts.push(pass.planName);
        });
        return parts.join(' ').toLowerCase();
    }

    function renderPersonRows(people) {
        var seq = 0;
        return people.map(function(person) {
            var passes = person.passes || [];
            if (!passes.length) return '';
            seq += 1;
            var span = passes.length;
            return passes.map(function(pass, pi) {
                var html = '<tr class="' + (pi === 0 ? 'ol-history-person-start' : 'ol-history-pass-follow') + '">';
                if (pi === 0) {
                    html += '<td class="ol-history-person" rowspan="' + span + '">' + seq + '</td>';
                    html += '<td class="ol-history-person" rowspan="' + span + '"><strong>'
                        + escapeHtml(person.name || '') + '</strong></td>';
                    html += '<td class="ol-history-person" rowspan="' + span + '">'
                        + escapeHtml(person.team || '-') + '</td>';
                    html += '<td class="ol-history-person" rowspan="' + span + '">'
                        + escapeHtml(person.phone || '-') + '</td>';
                }
                html += '<td>' + countLabel(pass) + '</td>';
                html += '<td>' + visitChips(pass) + '</td>';
                html += '<td class="num">' + formatWon(pass.paidAmount) + '</td>';
                html += '</tr>';
                return html;
            }).join('');
        }).join('');
    }

    function renderHistory(data) {
        var body = document.getElementById('ol-history-body');
        if (!body) return;
        data = data || {};
        var filters = historyFilters();
        var passes = mergeHistoryMembers(data.members || []);
        var expenses = (data.expenses || []).slice();
        if (filters.date) {
            passes = passes.filter(function(m) { return memberMatchesDate(m, filters.date); });
            expenses = expenses.filter(function(e) { return e && e.lessonDate === filters.date; });
        }
        if (filters.amount != null && !isNaN(filters.amount)) {
            passes = passes.filter(function(m) { return memberMatchesAmount(m, filters.amount); });
        }
        var people = groupHistoryPeople(passes);
        if (filters.query) {
            people = people.filter(function(person) {
                return personSearchHay(person).indexOf(filters.query) >= 0;
            });
        }
        var visiblePasses = [];
        people.forEach(function(person) {
            visiblePasses = visiblePasses.concat(person.passes || []);
        });
        var paidTotal = 0;
        visiblePasses.forEach(function(m) {
            if (filters.date) {
                (m.visits || []).forEach(function(v) {
                    if (v && v.lessonDate === filters.date && v.depositConfirmed && v.amount) {
                        paidTotal += Number(v.amount) || 0;
                    }
                });
            } else {
                paidTotal += Number(m.paidAmount) || 0;
            }
        });
        var expenseTotal = 0;
        expenses.forEach(function(e) { expenseTotal += Number(e.amount) || 0; });
        var net = paidTotal - expenseTotal;
        var memberRows = people.length
            ? renderPersonRows(people)
            : '<tr><td colspan="7" class="ol-history-empty">해당하는 참가자가 없습니다.</td></tr>';
        var expenseRows = expenses.length ? expenses.map(function(e) {
            return '<tr>' +
                '<td title="' + escapeHtml(formatKoDate(e.lessonDate)) + '">' + escapeHtml(formatChipDate(e.lessonDate)) + '</td>' +
                '<td>' + escapeHtml(e.label || '경기장 대여비') + '</td>' +
                '<td class="num">' + formatWon(-(Number(e.amount) || 0)) + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="3" class="ol-history-empty">지출 내역이 없습니다.</td></tr>';
        body.innerHTML =
            '<div class="ol-history-kpis">' +
            '<div class="ol-history-kpi"><span>참가 인원</span><strong>' + people.length + '명</strong></div>' +
            '<div class="ol-history-kpi"><span>발생 금액</span><strong>' + formatWon(paidTotal) + '</strong></div>' +
            '<div class="ol-history-kpi is-minus"><span>지출</span><strong>' + formatWon(-expenseTotal) + '</strong></div>' +
            '<div class="ol-history-kpi' + (net < 0 ? ' is-minus' : '') + '"><span>합계</span><strong>' + formatWon(net) + '</strong></div>' +
            '</div>' +
            '<div class="ol-history-grid">' +
            '<section class="ol-history-panel">' +
            '<h4>참가 명단</h4>' +
            '<div class="ol-history-table-wrap"><table class="ol-history-table ol-history-members"><colgroup>' +
            '<col class="ol-col-seq"><col class="ol-col-name"><col class="ol-col-team"><col class="ol-col-phone">' +
            '<col class="ol-col-count"><col class="ol-col-dates"><col class="ol-col-paid"></colgroup><thead><tr>' +
            '<th>순번</th><th>이름</th><th>팀</th><th>연락처</th><th>횟수</th><th>참가 날짜</th><th>결제 금액</th>' +
            '</tr></thead><tbody>' + memberRows + '</tbody></table></div></section>' +
            '<section class="ol-history-panel">' +
            '<h4>지출 내용</h4>' +
            '<div class="ol-history-table-wrap"><table class="ol-history-table ol-history-expenses"><colgroup>' +
            '<col class="ol-exp-date"><col class="ol-exp-label"><col class="ol-exp-amount"></colgroup><thead><tr>' +
            '<th>날짜</th><th>내용</th><th>금액</th>' +
            '</tr></thead><tbody>' + expenseRows + '</tbody></table></div>' +
            '<div class="ol-history-expense-total is-minus"><span>지출 합계</span><span>' +
            formatWon(-expenseTotal) + '</span></div>' +
            '</section></div>';
    }

    async function openHistoryOverlay() {
        ensureHistoryOverlay();
        var overlay = document.getElementById('ol-history-overlay');
        var body = document.getElementById('ol-history-body');
        var search = document.getElementById('ol-history-search');
        if (!overlay || !body) return;
        if (search) search.value = '';
        var dateEl = document.getElementById('ol-history-date-filter');
        var amountEl = document.getElementById('ol-history-amount-filter');
        if (dateEl) dateEl.value = '';
        if (amountEl) amountEl.value = '';
        overlay.hidden = false;
        body.innerHTML = '<p class="ol-history-empty">불러오는 중...</p>';
        try {
            var data = await App.api.get('/outdoor-lesson-participants/history');
            overlay._data = data;
            fillHistoryFilters(data);
            renderHistory(data);
        } catch (e) {
            body.innerHTML = '<p class="ol-history-empty">누적 명단을 불러오지 못했습니다.</p>';
            notify('누적 명단을 불러오지 못했습니다.', 'danger');
        }
    }

    var suggestTimer = null;
    var suggestInput = null;
    var suggestItems = [];

    function suggestBox() {
        var box = document.getElementById('ol-member-suggest');
        if (box) return box;
        var modal = document.querySelector('#outdoor-lesson-modal .modal');
        box = document.createElement('div');
        box.id = 'ol-member-suggest';
        box.className = 'ol-suggest';
        box.hidden = true;
        (modal || document.body).appendChild(box);
        box.addEventListener('mousedown', function(e) {
            var btn = e.target.closest('[data-ol-idx]');
            if (!btn) return;
            e.preventDefault();
            var idx = Number(btn.getAttribute('data-ol-idx'));
            var member = suggestItems[idx];
            var tr = suggestInput && suggestInput.closest('tr');
            hideSuggest();
            if (tr && member) applyMemberToRow(tr, member);
        });
        return box;
    }

    function hideSuggest() {
        var box = document.getElementById('ol-member-suggest');
        if (box) box.hidden = true;
        suggestInput = null;
        suggestItems = [];
    }

    function positionSuggest(input) {
        var box = suggestBox();
        var host = box.parentElement;
        if (!input || !host) return;
        var ir = input.getBoundingClientRect();
        var hr = host.getBoundingClientRect();
        box.style.left = Math.max(8, ir.left - hr.left) + 'px';
        box.style.top = (ir.bottom - hr.top + 4) + 'px';
        box.style.minWidth = Math.max(220, ir.width) + 'px';
        box.style.width = Math.max(300, ir.width + 120) + 'px';
    }

    async function searchMembers(input) {
        var q = (input && input.value || '').trim();
        if (q.length < 1) {
            hideSuggest();
            return;
        }
        suggestInput = input;
        try {
            var list = await App.api.get('/outdoor-lesson-participants/member-lookup?q=' + encodeURIComponent(q)
                + (dateInput() && dateInput().value ? '&lessonDate=' + encodeURIComponent(dateInput().value) : ''));
            if (suggestInput !== input) return;
            renderSuggest(input, Array.isArray(list) ? list : []);
        } catch (e) {
            hideSuggest();
        }
    }

    function renderSuggest(input, list) {
        var box = suggestBox();
        suggestItems = list || [];
        if (!suggestItems.length) {
            box.hidden = true;
            return;
        }
        box.innerHTML = suggestItems.map(function(m, i) {
            var pass = m.planName
                ? escapeHtml(m.planName) + (m.remainingCount != null ? ' · 잔여 ' + m.remainingCount + '회' : '')
                : '이용권 없음';
            var meta = [m.team, m.phone].filter(Boolean).map(escapeHtml).join(' · ');
            return '<button type="button" class="ol-suggest-item" data-ol-idx="' + i + '">' +
                '<strong>' + escapeHtml(m.name || '') + '</strong>' +
                (meta ? '<span>' + meta + '</span>' : '') +
                '<em>' + pass + '</em></button>';
        }).join('');
        positionSuggest(input);
        box.hidden = false;
    }

    function scheduleMemberSearch(input) {
        clearTimeout(suggestTimer);
        suggestTimer = setTimeout(function() { searchMembers(input); }, 180);
    }

    function bind() {
        var openBtn = document.getElementById('btn-outdoor-lesson-roster');
        if (!openBtn) return;
        openBtn.addEventListener('click', openModal);

        var addBtn = document.getElementById('btn-outdoor-lesson-add');
        if (addBtn) addBtn.addEventListener('click', function() { addRow({}); });

        var attBtn = document.getElementById('btn-outdoor-lesson-attendance');
        if (attBtn) attBtn.addEventListener('click', openAttendancePage);

        var histBtn = document.getElementById('btn-outdoor-lesson-history');
        if (histBtn) histBtn.addEventListener('click', openHistoryOverlay);

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
                var input = e.target && e.target.classList && (
                    e.target.classList.contains('ol-name')
                    || e.target.classList.contains('ol-phone')
                    || e.target.classList.contains('ol-team')
                ) ? e.target : null;
                if (!input) return;
                var tr = input.closest('tr');
                if (input.classList.contains('ol-name')) {
                    var parsed = parseSlashLine(input.value);
                    if (parsed) fillRow(tr, parsed);
                }
                setTimeout(function() {
                    if (suggestInput === input) hideSuggest();
                }, 180);
                lookupPassForRow(tr);
            }, true);
            tbody().addEventListener('change', function(e) {
                dirty = true;
                var tr = e.target && e.target.closest ? e.target.closest('tr') : null;
                var planSel = e.target && e.target.classList && e.target.classList.contains('ol-plan') ? e.target : null;
                if (planSel) {
                    updateRowAmount(planSel.closest('tr'));
                    if (tr) {
                        delete tr.dataset.prepaidPass;
                        if (!isCountPassPlan(planBySelect(tr))) {
                            delete tr.dataset.remainingCount;
                            delete tr.dataset.remainingAtStart;
                            delete tr.dataset.totalCount;
                        } else {
                            lookupPassForRow(tr);
                        }
                        updateRowRemaining(tr);
                    }
                }
                var teamCheck = e.target && e.target.classList && e.target.classList.contains('ol-team-check') ? e.target : null;
                if (teamCheck && tr) {
                    updateRowHeadcountMode(tr);
                    if (isTeamRow(tr)) {
                        lookupPassForRow(tr);
                        var head = tr.querySelector('.ol-headcount');
                        if (head && !head.disabled) head.focus();
                    }
                    markHeadcountOverflow(tr, true);
                }
                var headInput = e.target && e.target.classList && e.target.classList.contains('ol-headcount') ? e.target : null;
                if (headInput && tr) {
                    markHeadcountOverflow(tr, true);
                }
                if (tr) updateRowNotes(tr);
                updateSummary();
            });
            tbody().addEventListener('input', function(e) {
                dirty = true;
                var tr = e.target && e.target.closest ? e.target.closest('tr') : null;
                var target = e.target;
                if (target && target.classList && (target.classList.contains('ol-name') || target.classList.contains('ol-team'))) {
                    scheduleMemberSearch(target);
                }
                if (target && target.classList && target.classList.contains('ol-headcount') && tr) {
                    var prev = tr.dataset.headcountOverflow === '1';
                    var msg = markHeadcountOverflow(tr, false);
                    var now = !!msg;
                    tr.dataset.headcountOverflow = now ? '1' : '';
                    if (now && !prev) notify(msg, 'warning');
                }
                if (tr) {
                    updateRowNotes(tr);
                }
                updateSummary();
            });
        }
        document.addEventListener('mousedown', function(e) {
            var box = document.getElementById('ol-member-suggest');
            if (!box || box.hidden) return;
            if (box.contains(e.target)) return;
            if (e.target && e.target.closest && e.target.closest('.ol-name, .ol-team')) return;
            hideSuggest();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
    window.openOutdoorLessonRosterModal = openModal;
    window.openOutdoorLessonHistoryOverlay = openHistoryOverlay;
})();
