(function() {
    var year = new Date().getFullYear();
    var month = new Date().getMonth() + 1;
    var coaches = [];
    var amounts = {};
    var payerCounts = {};
    var saving = {};
    var payerTarget = null;

    function pad(n) {
        return n < 10 ? '0' + n : String(n);
    }
    function daysInMonth(y, m) {
        return new Date(y, m, 0).getDate();
    }
    function cellKey(coachId, day) {
        return String(coachId) + '-' + String(day);
    }
    function formatAmount(n) {
        if (n == null || n === '' || !isFinite(Number(n)) || Number(n) <= 0) return '';
        return Number(n).toLocaleString('ko-KR');
    }
    function parseAmount(s) {
        var t = String(s == null ? '' : s).replace(/[^\d]/g, '');
        if (!t) return null;
        var n = parseInt(t, 10);
        if (!isFinite(n) || n <= 0) return null;
        return n;
    }
    function coachName(coachId) {
        for (var i = 0; i < coaches.length; i++) {
            if (Number(coaches[i].id) === Number(coachId)) {
                return coaches[i].displayName || coaches[i].name || '';
            }
        }
        return '';
    }
    function apiError(err) {
        return (err && err.response && err.response.data && (err.response.data.message || err.response.data.error))
            || (err && err.message) || '처리에 실패했습니다.';
    }
    function setStatus(text) {
        var el = document.getElementById('profit-sheet-save-status');
        if (el) el.textContent = text || '';
    }
    function coachTotal(coachId) {
        var total = 0;
        var dim = daysInMonth(year, month);
        for (var d = 1; d <= dim; d++) {
            var v = amounts[cellKey(coachId, d)];
            if (v) total += Number(v);
        }
        return total;
    }
    function dayTotal(day) {
        var total = 0;
        coaches.forEach(function(c) {
            var v = amounts[cellKey(c.id, day)];
            if (v) total += Number(v);
        });
        return total;
    }
    function grandTotal() {
        var total = 0;
        coaches.forEach(function(c) {
            total += coachTotal(c.id);
        });
        return total;
    }
    function updateTotals() {
        coaches.forEach(function(c) {
            var el = document.getElementById('ps-col-total-' + c.id);
            if (el) el.textContent = formatAmount(coachTotal(c.id));
        });
        var dim = daysInMonth(year, month);
        for (var d = 1; d <= dim; d++) {
            var dayEl = document.getElementById('ps-day-total-' + d);
            if (dayEl) dayEl.textContent = formatAmount(dayTotal(d));
        }
        var grand = grandTotal();
        var grandEl = document.getElementById('profit-sheet-grand');
        var grandCell = document.getElementById('ps-grand-cell');
        var text = formatAmount(grand) || '0';
        if (grandEl) grandEl.textContent = text;
        if (grandCell) grandCell.textContent = text;
    }
    function fillTd(td, coachId, day) {
        if (!td) return;
        var key = cellKey(coachId, day);
        var val = amounts[key];
        if (val) {
            var extra = payerCounts[key] > 0 ? ' has-payers' : '';
            td.innerHTML = '<button type="button" class="ps-amount' + extra + '" data-coach-id="'
                + coachId + '" data-day="' + day + '">' + formatAmount(val) + '</button>';
            bindAmount(td.querySelector('.ps-amount'));
        } else {
            td.innerHTML = '<input class="ps-input" inputmode="numeric" autocomplete="off" data-coach-id="'
                + coachId + '" data-day="' + day + '" value="">';
            bindInput(td.querySelector('.ps-input'));
        }
    }
    function render() {
        var wrap = document.getElementById('profit-sheet-table-wrap');
        var monthEl = document.getElementById('profit-sheet-month-label');
        if (monthEl) monthEl.textContent = year + '년 ' + pad(month) + '월';
        if (!wrap) return;
        if (!coaches.length) {
            wrap.innerHTML = '<div class="profit-sheet-empty">표시할 코치가 없습니다.</div>';
            updateTotals();
            return;
        }
        var dim = daysInMonth(year, month);
        var html = '<div class="profit-sheet-caption">AF베이스볼클럽 수익 정산</div>';
        html += '<table class="profit-sheet-table"><thead>';
        html += '<tr><th class="col-date">구분</th>';
        coaches.forEach(function(c) {
            html += '<th class="col-coach">' + App.escapeHtml(c.displayName || c.name || '') + '</th>';
        });
        html += '<th class="col-sum">합계</th></tr></thead><tbody>';
        for (var d = 1; d <= dim; d++) {
            html += '<tr><td class="col-date">' + d + '</td>';
            coaches.forEach(function(c) {
                html += '<td></td>';
            });
            html += '<td class="ps-day-total" id="ps-day-total-' + d + '">' + formatAmount(dayTotal(d)) + '</td></tr>';
        }
        html += '<tr class="row-total"><td class="col-date">합계</td>';
        coaches.forEach(function(c) {
            html += '<td class="ps-total-cell" id="ps-col-total-' + c.id + '">' + formatAmount(coachTotal(c.id)) + '</td>';
        });
        html += '<td class="ps-total-cell ps-grand-cell" id="ps-grand-cell">' + (formatAmount(grandTotal()) || '0') + '</td>';
        html += '</tr></tbody></table>';
        wrap.innerHTML = html;
        var rows = wrap.querySelectorAll('tbody tr:not(.row-total)');
        for (var i = 0; i < rows.length; i++) {
            var day = i + 1;
            var tds = rows[i].querySelectorAll('td');
            coaches.forEach(function(c, ci) {
                fillTd(tds[ci + 1], c.id, day);
            });
        }
        updateTotals();
    }
    function bindInput(input) {
        if (!input) return;
        input.addEventListener('focus', function() {
            var coachId = input.getAttribute('data-coach-id');
            var day = input.getAttribute('data-day');
            var raw = amounts[cellKey(coachId, day)];
            input.value = raw ? String(raw) : '';
            input.select();
        });
        input.addEventListener('keydown', function(ev) {
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            var coachId = input.getAttribute('data-coach-id');
            var day = Number(input.getAttribute('data-day'));
            var parsed = parseAmount(input.value);
            input.value = formatAmount(parsed);
            saveCell(input, parsed).then(function() {
                var next = document.querySelector(
                    '.ps-input[data-coach-id="' + coachId + '"][data-day="' + (day + 1) + '"],'
                    + '.ps-amount[data-coach-id="' + coachId + '"][data-day="' + (day + 1) + '"]'
                );
                if (next) next.focus();
            });
        });
        input.addEventListener('blur', function() {
            var parsed = parseAmount(input.value);
            input.value = formatAmount(parsed);
            saveCell(input, parsed);
        });
    }
    function bindAmount(btn) {
        if (!btn) return;
        btn.addEventListener('click', function() {
            openPayerModal(Number(btn.getAttribute('data-coach-id')), Number(btn.getAttribute('data-day')));
        });
    }
    async function saveCell(input, parsed) {
        var coachId = Number(input.getAttribute('data-coach-id'));
        var day = Number(input.getAttribute('data-day'));
        var key = cellKey(coachId, day);
        var prev = amounts[key] || null;
        var next = parsed || null;
        var td = input.closest('td');
        if (prev === next || (prev == null && next == null)) {
            updateTotals();
            return;
        }
        if (saving[key]) return;
        saving[key] = true;
        setStatus('저장 중…');
        try {
            await App.api.put('/profit-sheet', {
                year: year,
                month: month,
                day: day,
                coachId: coachId,
                amount: next
            });
            if (next) amounts[key] = next;
            else {
                delete amounts[key];
                delete payerCounts[key];
            }
            setStatus('저장됨');
            if (td && td.contains(input)) fillTd(td, coachId, day);
            updateTotals();
        } catch (err) {
            if (input.isConnected) input.value = formatAmount(prev);
            App.showNotification(apiError(err), 'error');
            setStatus('저장 실패');
        } finally {
            saving[key] = false;
        }
    }
    function payerRowHtml(name, amount) {
        return '<div class="ps-payer-row">'
            + '<input type="text" class="form-control ps-payer-name" maxlength="100" placeholder="이름" value="' + App.escapeHtml(name || '') + '">'
            + '<input type="text" class="form-control ps-payer-amount" inputmode="numeric" placeholder="금액" value="' + App.escapeHtml(amount ? formatAmount(amount) : '') + '">'
            + '<button type="button" class="btn btn-secondary btn-sm ps-payer-del">삭제</button>'
            + '</div>';
    }
    function bindPayerRow(row) {
        var del = row.querySelector('.ps-payer-del');
        if (del) del.addEventListener('click', function() {
            row.remove();
            updatePayerSum();
        });
        var amt = row.querySelector('.ps-payer-amount');
        if (amt) {
            amt.addEventListener('blur', function() {
                var parsed = parseAmount(amt.value);
                amt.value = formatAmount(parsed);
                updatePayerSum();
            });
            amt.addEventListener('input', updatePayerSum);
        }
    }
    function updatePayerSum() {
        var sum = 0;
        document.querySelectorAll('#ps-payer-list .ps-payer-amount').forEach(function(el) {
            var n = parseAmount(el.value);
            if (n) sum += n;
        });
        var el = document.getElementById('ps-payer-sum');
        var cellInput = document.getElementById('ps-payer-cell-input');
        var hint = document.getElementById('ps-payer-match');
        if (el) el.textContent = formatAmount(sum) || '0';
        var cellAmt = parseAmount(cellInput && cellInput.value);
        if (hint) {
            if (!sum) {
                hint.textContent = '';
                hint.className = 'ps-payer-match';
            } else if (cellAmt && sum === Number(cellAmt)) {
                hint.textContent = '칸 금액과 같습니다.';
                hint.className = 'ps-payer-match is-ok';
            } else {
                hint.textContent = '칸 금액과 다릅니다.';
                hint.className = 'ps-payer-match is-diff';
            }
        }
    }
    async function openPayerModal(coachId, day) {
        payerTarget = { coachId: coachId, day: day };
        var title = document.getElementById('ps-payer-title');
        if (title) title.textContent = coachName(coachId) + ' · ' + month + '월 ' + day + '일';
        var list = document.getElementById('ps-payer-list');
        if (list) list.innerHTML = '<div class="ps-payer-empty">불러오는 중…</div>';
        App.Modal.open('ps-payer-modal');
        try {
            var data = await App.api.get('/profit-sheet/payers?year=' + year + '&month=' + month + '&day=' + day + '&coachId=' + coachId);
            var payers = (data && data.payers) || [];
            if (list) {
                list.innerHTML = '';
                if (!payers.length) {
                    list.innerHTML = payerRowHtml('', '');
                    bindPayerRow(list.querySelector('.ps-payer-row'));
                } else {
                    payers.forEach(function(p) {
                        list.insertAdjacentHTML('beforeend', payerRowHtml(p.name, p.amount));
                    });
                    list.querySelectorAll('.ps-payer-row').forEach(bindPayerRow);
                }
            }
            var cellInput = document.getElementById('ps-payer-cell-input');
            var cellAmt = (data && data.cellAmount) || amounts[cellKey(coachId, day)];
            if (cellInput) {
                cellInput.value = formatAmount(cellAmt);
            }
            updatePayerSum();
        } catch (err) {
            if (list) list.innerHTML = '<div class="ps-payer-empty">' + App.escapeHtml(apiError(err)) + '</div>';
            App.showNotification(apiError(err), 'error');
        }
    }
    function addPayerRow() {
        var list = document.getElementById('ps-payer-list');
        if (!list) return;
        var empty = list.querySelector('.ps-payer-empty');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', payerRowHtml('', ''));
        var row = list.lastElementChild;
        bindPayerRow(row);
        var name = row.querySelector('.ps-payer-name');
        if (name) name.focus();
    }
    async function savePayers() {
        if (!payerTarget) return;
        var cellInput = document.getElementById('ps-payer-cell-input');
        var cellAmt = parseAmount(cellInput && cellInput.value);
        var payers = [];
        document.querySelectorAll('#ps-payer-list .ps-payer-row').forEach(function(row) {
            var name = (row.querySelector('.ps-payer-name') || {}).value || '';
            var amount = parseAmount((row.querySelector('.ps-payer-amount') || {}).value);
            if (name.trim() && amount) {
                payers.push({ name: name.trim(), amount: amount });
            }
        });
        var key = cellKey(payerTarget.coachId, payerTarget.day);
        var td = document.querySelector(
            '.ps-amount[data-coach-id="' + payerTarget.coachId + '"][data-day="' + payerTarget.day + '"],'
            + '.ps-input[data-coach-id="' + payerTarget.coachId + '"][data-day="' + payerTarget.day + '"]'
        );
        td = td ? td.closest('td') : null;
        try {
            await App.api.put('/profit-sheet', {
                year: year,
                month: month,
                day: payerTarget.day,
                coachId: payerTarget.coachId,
                amount: cellAmt
            });
            if (!cellAmt) {
                delete amounts[key];
                delete payerCounts[key];
                if (td) fillTd(td, payerTarget.coachId, payerTarget.day);
                updateTotals();
                App.Modal.close('ps-payer-modal');
                setStatus('저장됨');
                return;
            }
            amounts[key] = cellAmt;
            var out = await App.api.put('/profit-sheet/payers', {
                year: year,
                month: month,
                day: payerTarget.day,
                coachId: payerTarget.coachId,
                payers: payers
            });
            payerCounts[key] = (out && out.payerCount) || payers.length;
            if (td) fillTd(td, payerTarget.coachId, payerTarget.day);
            updateTotals();
            App.Modal.close('ps-payer-modal');
            setStatus('저장됨');
        } catch (err) {
            App.showNotification(apiError(err), 'error');
        }
    }
    async function loadSheet() {
        setStatus('');
        try {
            var data = await App.api.get('/profit-sheet?year=' + year + '&month=' + month);
            coaches = (data && data.coaches) || [];
            amounts = {};
            payerCounts = {};
            ((data && data.entries) || []).forEach(function(row) {
                if (row && row.coachId != null && row.day != null && row.amount) {
                    var key = cellKey(row.coachId, row.day);
                    amounts[key] = Number(row.amount);
                    payerCounts[key] = Number(row.payerCount) || 0;
                }
            });
            render();
        } catch (err) {
            var wrap = document.getElementById('profit-sheet-table-wrap');
            if (wrap) wrap.innerHTML = '<div class="profit-sheet-empty">' + App.escapeHtml(apiError(err)) + '</div>';
            App.showNotification(apiError(err), 'error');
        }
    }
    function shiftMonth(delta) {
        var dt = new Date(year, month - 1 + delta, 1);
        year = dt.getFullYear();
        month = dt.getMonth() + 1;
        loadSheet();
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (typeof App.canSeeProfitSheet === 'function' && !App.canSeeProfitSheet()) {
            window.location.href = '/';
            return;
        }
        var prev = document.getElementById('profit-sheet-prev');
        var next = document.getElementById('profit-sheet-next');
        if (prev) prev.addEventListener('click', function() { shiftMonth(-1); });
        if (next) next.addEventListener('click', function() { shiftMonth(1); });
        var addBtn = document.getElementById('ps-payer-add');
        var saveBtn = document.getElementById('ps-payer-save');
        var cellInput = document.getElementById('ps-payer-cell-input');
        if (addBtn) addBtn.addEventListener('click', addPayerRow);
        if (saveBtn) saveBtn.addEventListener('click', savePayers);
        if (cellInput) {
            cellInput.addEventListener('focus', function() {
                var raw = parseAmount(cellInput.value);
                cellInput.value = raw ? String(raw) : '';
                cellInput.select();
            });
            cellInput.addEventListener('blur', function() {
                cellInput.value = formatAmount(parseAmount(cellInput.value));
                updatePayerSum();
            });
            cellInput.addEventListener('input', updatePayerSum);
        }
        loadSheet();
    });
})();
