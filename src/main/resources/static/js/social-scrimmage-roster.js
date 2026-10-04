(function() {
    'use strict';

    var POSITIONS = [
        { value: '', label: '선택' },
        { value: 'P', label: '투수(P)' },
        { value: 'C', label: '포수(C)' },
        { value: '1B', label: '1루(1B)' },
        { value: '2B', label: '2루(2B)' },
        { value: '3B', label: '3루(3B)' },
        { value: 'SS', label: '유격(SS)' },
        { value: 'LF', label: '좌익(LF)' },
        { value: 'CF', label: '중견(CF)' },
        { value: 'RF', label: '우익(RF)' },
        { value: 'DH', label: '지명(DH)' },
        { value: 'BENCH', label: '벤치' }
    ];

    var FIELD_SPOTS = [
        { key: 'P',  left: '50%', top: '58%', short: 'P' },
        { key: 'C',  left: '50%', top: '88%', short: 'C' },
        { key: '1B', left: '78%', top: '55%', short: '1B' },
        { key: '2B', left: '66%', top: '38%', short: '2B' },
        { key: '3B', left: '22%', top: '55%', short: '3B' },
        { key: 'SS', left: '34%', top: '38%', short: 'SS' },
        { key: 'LF', left: '18%', top: '18%', short: 'LF' },
        { key: 'CF', left: '50%', top: '12%', short: 'CF' },
        { key: 'RF', left: '82%', top: '18%', short: 'RF' }
    ];

    var DIAMOND_SVG =
        '<svg class="ss-diamond-svg" viewBox="0 0 200 210" aria-hidden="true">' +
            '<ellipse cx="100" cy="95" rx="92" ry="88" fill="#43a047" opacity="0.35"/>' +
            '<path d="M100 175 L165 110 L100 45 L35 110 Z" fill="#c8a165" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>' +
            '<path d="M100 175 L165 110 L100 45 L35 110 Z" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.5"/>' +
            '<circle cx="100" cy="110" r="7" fill="#efebe9" stroke="rgba(0,0,0,0.2)"/>' +
            '<rect x="92" y="168" width="16" height="10" rx="2" fill="#efebe9"/>' +
            '<circle cx="100" cy="45" r="4" fill="#fff"/>' +
            '<circle cx="165" cy="110" r="4" fill="#fff"/>' +
            '<circle cx="35" cy="110" r="4" fill="#fff"/>' +
            '<circle cx="100" cy="175" r="4" fill="#fff"/>' +
        '</svg>';

    var state = {
        loadedDate: '',
        bound: false,
        suggestTimer: null
    };

    function branch() {
        return 'SAHA';
    }

    function dateEl() {
        return document.getElementById('social-scrimmage-date');
    }

    function tbody() {
        return document.getElementById('social-scrimmage-tbody');
    }

    function notify(msg, type) {
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification(msg, type || 'info');
        }
    }

    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function positionOptionsHtml(selected) {
        return POSITIONS.map(function(p) {
            return '<option value="' + p.value + '"' + (p.value === (selected || '') ? ' selected' : '') + '>' + p.label + '</option>';
        }).join('');
    }

    function sideOptionsHtml(selected) {
        var s = selected || '';
        return ''
            + '<option value="">미정</option>'
            + '<option value="BLUE"' + (s === 'BLUE' ? ' selected' : '') + '>청</option>'
            + '<option value="WHITE"' + (s === 'WHITE' ? ' selected' : '') + '>백</option>';
    }

    function applySideClass(select) {
        if (!select) return;
        select.classList.remove('ss-blue', 'ss-white');
        if (select.value === 'BLUE') select.classList.add('ss-blue');
        if (select.value === 'WHITE') select.classList.add('ss-white');
    }

    function renumber() {
        var rows = tbody() ? tbody().querySelectorAll('tr') : [];
        rows.forEach(function(tr, i) {
            var seq = tr.querySelector('.ss-seq');
            if (seq) seq.textContent = String(i + 1);
        });
    }

    function addRow(data) {
        data = data || {};
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="ss-seq"></td>' +
            '<td class="ss-name-cell" data-label="이름">' +
                '<input type="text" class="form-control ss-name" value="' + escapeAttr(data.name || '') + '" autocomplete="off" placeholder="이름 또는 이름/팀/연락처">' +
                '<div class="ss-suggest" hidden></div>' +
            '</td>' +
            '<td data-label="소속 팀">' +
                '<input type="text" class="form-control ss-team" value="' + escapeAttr(data.team || '') + '" placeholder="소속 팀">' +
            '</td>' +
            '<td data-label="연락처">' +
                '<input type="text" class="form-control ss-phone" value="' + escapeAttr(data.phone || '') + '" placeholder="연락처">' +
            '</td>' +
            '<td data-label="금액">' +
                '<input type="number" class="form-control ss-amount" min="0" step="1000" inputmode="numeric" placeholder="0" value="' + escapeAttr(amountValue(data)) + '">' +
            '</td>' +
            '<td data-label="입금">' +
                '<label class="ss-deposit-label"><input type="checkbox" class="ss-deposit"' + (data.depositConfirmed ? ' checked' : '') + '> 확인</label>' +
            '</td>' +
            '<td data-label="희망 포지션">' +
                '<select class="form-control ss-hoped">' + positionOptionsHtml(data.hopedPosition) + '</select>' +
            '</td>' +
            '<td data-label="청/백">' +
                '<select class="form-control ss-side-select ss-side">' + sideOptionsHtml(data.side) + '</select>' +
            '</td>' +
            '<td data-label="배치 포지션">' +
                '<select class="form-control ss-assigned">' + positionOptionsHtml(data.assignedPosition) + '</select>' +
            '</td>' +
            '<td data-label="삭제" style="text-align:center;">' +
                '<button type="button" class="ss-remove" title="삭제">×</button>' +
            '</td>';
        tbody().appendChild(tr);
        applySideClass(tr.querySelector('.ss-side'));
        bindRow(tr);
        applyPassDisplay(tr, data);
        applyDepositFromPass(tr, data);
        if ((data.name || '').trim() && digitsOnly(data.phone).length >= 9) {
            schedulePassLookup(tr);
        }
        renumber();
        updateSummary();
        return tr;
    }

    function formatWon(n) {
        var num = Number(n);
        if (isNaN(num)) num = 0;
        return '₩' + Math.round(num).toLocaleString('ko-KR');
    }

    function amountValue(data) {
        if (!data) return '';
        if (data.prepaidPass) return '0';
        if (data.depositAmount != null && data.depositAmount !== '') return String(data.depositAmount);
        return '';
    }

    function applyDepositFromPass(tr, data) {
        if (!tr || !data) return;
        var amountEl = tr.querySelector('.ss-amount');
        var depositEl = tr.querySelector('.ss-deposit');
        if (amountEl) {
            if (data.prepaidPass) {
                amountEl.value = '0';
            } else if (data.depositAmount != null && data.depositAmount !== '') {
                amountEl.value = String(data.depositAmount);
            }
        }
        if (depositEl && (data.prepaidPass || data.depositConfirmed)) {
            depositEl.checked = true;
        }
        if (data.prepaidPass) tr.dataset.prepaidPass = '1';
        else delete tr.dataset.prepaidPass;
    }

    function escapeAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function digitsOnly(s) {
        return String(s || '').replace(/\D/g, '');
    }

    function looksLikePhone(s) {
        var d = digitsOnly(s);
        if (d.indexOf('82') === 0 && d.length >= 11) d = '0' + d.slice(2);
        if (d.length === 10 && d.indexOf('10') === 0) d = '0' + d;
        return d.length >= 9 && d.length <= 11;
    }

    function formatPhone(s) {
        var d = digitsOnly(s);
        if (d.indexOf('82') === 0 && d.length >= 11) d = '0' + d.slice(2);
        if (d.length === 10 && d.indexOf('10') === 0) d = '0' + d;
        if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
        if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
        return String(s || '').trim();
    }

    /** 이름/팀/연락처 또는 탭 구분 한 줄 */
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
        var n = tr.querySelector('.ss-name');
        var t = tr.querySelector('.ss-team');
        var p = tr.querySelector('.ss-phone');
        if (n) n.value = parsed.name || '';
        if (t) t.value = parsed.team || '';
        if (p) p.value = parsed.phone || '';
        updateSummary();
        lookupPassForRow(tr);
    }

    function remainingHtml(data) {
        if (!data || data.remainingCount == null || data.remainingCount === '') return '';
        var total = data.totalCount != null && data.totalCount !== '' ? ('/' + data.totalCount) : '';
        var empty = Number(data.remainingCount) <= 0 ? ' is-empty' : '';
        return '<div class="ss-pass-remaining' + empty + '">잔여 ' + escapeAttr(String(data.remainingCount)) + total + '회</div>';
    }

    function applyPassDisplay(tr, data) {
        if (!tr) return;
        data = data || {};
        var cell = tr.querySelector('.ss-name-cell');
        if (!cell) return;
        var old = cell.querySelector('.ss-pass-remaining');
        if (old) old.remove();
        var html = remainingHtml(data);
        if (!html) {
            delete tr.dataset.productId;
            delete tr.dataset.remainingCount;
            delete tr.dataset.totalCount;
            return;
        }
        if (data.productId != null) tr.dataset.productId = String(data.productId);
        tr.dataset.remainingCount = String(data.remainingCount);
        if (data.totalCount != null) tr.dataset.totalCount = String(data.totalCount);
        var suggest = cell.querySelector('.ss-suggest');
        if (suggest) suggest.insertAdjacentHTML('afterend', html);
        else cell.insertAdjacentHTML('beforeend', html);
    }

    async function lookupPassForRow(tr) {
        if (!tr) return;
        var name = ((tr.querySelector('.ss-name') || {}).value || '').trim();
        var phone = ((tr.querySelector('.ss-phone') || {}).value || '').trim();
        if (!name || digitsOnly(phone).length < 9) {
            return;
        }
        try {
            // 야외 레슨과 동일한 공유 횟수권 API (이름+연락처)
            var data = await App.api.get('/outdoor-lesson-participants/pass-lookup?name='
                + encodeURIComponent(name)
                + '&phone=' + encodeURIComponent(phone)
                + '&teamBooking=false');
            if (!data || (data.remainingCount == null && data.productId == null)) {
                data = await App.api.get('/social-scrimmage-participants/pass-lookup?name='
                    + encodeURIComponent(name)
                    + '&phone=' + encodeURIComponent(phone));
            }
            if (!data || data.remainingCount == null) {
                return;
            }
            var teamEl = tr.querySelector('.ss-team');
            if (teamEl && !(teamEl.value || '').trim() && data.team) {
                teamEl.value = data.team;
            }
            var phoneEl = tr.querySelector('.ss-phone');
            if (phoneEl && data.phone && digitsOnly(phoneEl.value) === digitsOnly(data.phone)) {
                phoneEl.value = formatPhone(data.phone);
            }
            applyPassDisplay(tr, data);
            applyDepositFromPass(tr, data);
            updateSummary();
        } catch (e) {
            App.err('청백전 횟수권 조회 실패:', e);
        }
    }

    function schedulePassLookup(tr) {
        clearTimeout(tr._ssPassTimer);
        tr._ssPassTimer = setTimeout(function() { lookupPassForRow(tr); }, 220);
    }

    function applyParsedList(startTr, list) {
        if (!startTr || !list || !list.length) return;
        fillRow(startTr, list[0]);
        for (var i = 1; i < list.length; i++) {
            addRow(list[i]);
        }
        renumber();
        updateSummary();
    }

    function bindRow(tr) {
        var removeBtn = tr.querySelector('.ss-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                tr.remove();
                renumber();
                updateSummary();
            });
        }
        var side = tr.querySelector('.ss-side');
        if (side) {
            side.addEventListener('change', function() {
                applySideClass(side);
                updateSummary();
            });
        }
        var assigned = tr.querySelector('.ss-assigned');
        if (assigned) {
            assigned.addEventListener('change', updateSummary);
        }
        var hoped = tr.querySelector('.ss-hoped');
        if (hoped) {
            hoped.addEventListener('change', function() {
                var a = tr.querySelector('.ss-assigned');
                if (a && !a.value && hoped.value && hoped.value !== 'DH' && hoped.value !== 'BENCH') {
                    a.value = hoped.value;
                }
                updateSummary();
            });
        }
        var nameInput = tr.querySelector('.ss-name');
        if (nameInput) {
            nameInput.addEventListener('input', function() {
                scheduleSuggest(tr, nameInput.value);
                schedulePassLookup(tr);
                updateSummary();
            });
            nameInput.addEventListener('blur', function() {
                var parsed = parseSlashLine(nameInput.value);
                if (parsed) fillRow(tr, parsed);
                else lookupPassForRow(tr);
                setTimeout(function() {
                    var box = tr.querySelector('.ss-suggest');
                    if (box) box.hidden = true;
                }, 180);
            });
        }
        ['ss-team', 'ss-phone', 'ss-amount'].forEach(function(cls) {
            var el = tr.querySelector('.' + cls);
            if (el) {
                el.addEventListener('input', function() {
                    updateSummary();
                    if (cls === 'ss-phone') schedulePassLookup(tr);
                });
                if (cls === 'ss-phone') {
                    el.addEventListener('blur', function() { lookupPassForRow(tr); });
                }
            }
        });
        var deposit = tr.querySelector('.ss-deposit');
        if (deposit) deposit.addEventListener('change', updateSummary);
    }

    function scheduleSuggest(tr, q) {
        clearTimeout(state.suggestTimer);
        var box = tr.querySelector('.ss-suggest');
        if (!box) return;
        q = (q || '').trim();
        if (q.length < 1) {
            box.hidden = true;
            box.innerHTML = '';
            return;
        }
        state.suggestTimer = setTimeout(async function() {
            try {
                var list = await App.api.get('/social-scrimmage-participants/member-lookup?q=' + encodeURIComponent(q));
                if (!Array.isArray(list) || list.length === 0) {
                    box.hidden = true;
                    box.innerHTML = '';
                    return;
                }
                box.innerHTML = list.map(function(m) {
                    var team = m.team || m.school || '';
                    var rem = m.remainingCount != null ? (' · 잔여 ' + m.remainingCount + '회') : '';
                    var label = (m.name || '') + (team ? ' · ' + team : '') + (m.phone ? ' · ' + m.phone : '') + rem;
                    return '<button type="button" data-name="' + escapeAttr(m.name || '') +
                        '" data-team="' + escapeAttr(team) +
                        '" data-phone="' + escapeAttr(m.phone || '') + '">' + escapeAttr(label) + '</button>';
                }).join('');
                box.hidden = false;
                box.querySelectorAll('button').forEach(function(btn) {
                    btn.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        tr.querySelector('.ss-name').value = btn.getAttribute('data-name') || '';
                        tr.querySelector('.ss-team').value = btn.getAttribute('data-team') || '';
                        tr.querySelector('.ss-phone').value = btn.getAttribute('data-phone') || '';
                        box.hidden = true;
                        updateSummary();
                        lookupPassForRow(tr);
                    });
                });
            } catch (err) {
                box.hidden = true;
            }
        }, 220);
    }

    function collectRows() {
        var out = [];
        var rows = tbody() ? tbody().querySelectorAll('tr') : [];
        rows.forEach(function(tr) {
            var name = (tr.querySelector('.ss-name')?.value || '').trim();
            if (!name) return;
            out.push({
                name: name,
                team: (tr.querySelector('.ss-team')?.value || '').trim() || null,
                phone: (tr.querySelector('.ss-phone')?.value || '').trim() || null,
                side: (tr.querySelector('.ss-side')?.value || '').trim() || null,
                hopedPosition: (tr.querySelector('.ss-hoped')?.value || '').trim() || null,
                assignedPosition: (tr.querySelector('.ss-assigned')?.value || '').trim() || null,
                depositAmount: (function() {
                    var raw = (tr.querySelector('.ss-amount') || {}).value;
                    if (raw == null || String(raw).trim() === '') return null;
                    var n = Number(raw);
                    return isNaN(n) ? null : Math.max(0, Math.round(n));
                })(),
                depositConfirmed: !!(tr.querySelector('.ss-deposit') && tr.querySelector('.ss-deposit').checked)
            });
        });
        return out;
    }

    function render(participants) {
        var body = tbody();
        if (!body) return;
        body.innerHTML = '';
        (participants || []).forEach(function(p) { addRow(p); });
        if (!participants || participants.length === 0) {
            addRow({});
        }
        updateSummary();
    }

    function playersBySide(side) {
        return collectRows().filter(function(p) { return p.side === side; });
    }

    function renderDiamond(host, side, players) {
        if (!host) return;
        var byPos = {};
        var bench = [];
        players.forEach(function(p) {
            var pos = p.assignedPosition || '';
            if (!pos || pos === 'BENCH' || pos === 'DH') {
                bench.push(p);
                return;
            }
            if (!byPos[pos]) byPos[pos] = p;
            else bench.push(p);
        });
        var spotsHtml = FIELD_SPOTS.map(function(spot) {
            var p = byPos[spot.key];
            var empty = !p;
            return '<div class="ss-spot' + (empty ? ' is-empty' : '') + '" style="left:' + spot.left + ';top:' + spot.top + ';">' +
                '<span class="ss-spot-pos">' + spot.short + '</span>' +
                '<span class="ss-spot-name">' + escapeAttr(p ? p.name : '—') + '</span>' +
                '</div>';
        }).join('');
        var dh = players.filter(function(p) { return p.assignedPosition === 'DH'; });
        var benchNames = bench.concat(dh).map(function(p) {
            var tag = p.assignedPosition === 'DH' ? 'DH' : (p.hopedPosition || '벤치');
            return p.name + '(' + tag + ')';
        });
        host.innerHTML =
            '<div class="ss-diamond-label">' + (side === 'BLUE' ? '청팀' : '백팀') + '</div>' +
            '<div class="ss-diamond">' + DIAMOND_SVG + spotsHtml + '</div>' +
            '<div class="ss-bench"><strong>벤치·지명</strong>' +
            (benchNames.length ? escapeAttr(benchNames.join(', ')) : '없음') +
            '</div>';
    }

    function updateSummary() {
        var rows = collectRows();
        var blue = rows.filter(function(p) { return p.side === 'BLUE'; });
        var white = rows.filter(function(p) { return p.side === 'WHITE'; });
        var unset = rows.filter(function(p) { return !p.side; });
        var confirmed = rows.filter(function(p) { return p.depositConfirmed; });
        var depositSum = confirmed.reduce(function(sum, p) {
            var n = Number(p.depositAmount);
            return sum + (isNaN(n) ? 0 : n);
        }, 0);
        var setText = function(id, text) {
            var el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        setText('ss-count-total', rows.length + '명');
        setText('ss-count-blue', blue.length + '명');
        setText('ss-count-white', white.length + '명');
        setText('ss-count-unset', unset.length + '명');
        setText('ss-count-confirmed', confirmed.length + '명');
        setText('ss-count-pending', Math.max(0, rows.length - confirmed.length) + '명');
        setText('ss-amount-deposit', formatWon(depositSum));
        renderDiamond(document.getElementById('ss-ground-blue'), 'BLUE', blue);
        renderDiamond(document.getElementById('ss-ground-white'), 'WHITE', white);
    }

    async function loadForDate(dateStr) {
        if (!dateStr) return;
        try {
            var data = await App.api.get('/social-scrimmage-participants?matchDate='
                + encodeURIComponent(dateStr) + '&branch=' + encodeURIComponent(branch()));
            state.loadedDate = dateStr;
            render(data.participants || []);
            var hint = document.getElementById('social-scrimmage-date-hint');
            if (hint) {
                hint.textContent = (data.participants && data.participants.length)
                    ? (dateStr + ' 명단 ' + data.participants.length + '명')
                    : (dateStr + ' 명단이 비어 있습니다. 추가 후 저장하세요.');
            }
        } catch (err) {
            App.err('청백전 명단 조회 실패:', err);
            notify(typeof App.getApiErrorMessage === 'function' ? App.getApiErrorMessage(err) : '명단 조회에 실패했습니다.', 'danger');
        }
    }

    async function save() {
        var dateInput = dateEl();
        var dateStr = dateInput ? dateInput.value : '';
        if (!dateStr) {
            notify('날짜를 선택해 주세요.', 'warning');
            return;
        }
        var participants = collectRows();
        try {
            var data = await App.api.put('/social-scrimmage-participants', {
                matchDate: dateStr,
                branch: branch(),
                participants: participants
            });
            state.loadedDate = dateStr;
            render(data.participants || []);
            notify('사회인 청백전 명단을 저장했습니다.', 'success');
        } catch (err) {
            App.err('청백전 명단 저장 실패:', err);
            notify(typeof App.getApiErrorMessage === 'function' ? App.getApiErrorMessage(err) : '명단 저장에 실패했습니다.', 'danger');
        }
    }

    function openModal() {
        bind();
        var d = dateEl();
        if (d && !d.value) d.value = todayStr();
        App.Modal.open('social-scrimmage-modal');
        loadForDate(d ? d.value : todayStr());
    }

    function bind() {
        if (state.bound) return;
        state.bound = true;
        var addBtn = document.getElementById('btn-social-scrimmage-add');
        if (addBtn) addBtn.addEventListener('click', function() { addRow({}); });
        var saveBtn = document.getElementById('btn-social-scrimmage-save');
        if (saveBtn) saveBtn.addEventListener('click', save);
        var loadBtn = document.getElementById('btn-social-scrimmage-load');
        if (loadBtn) loadBtn.addEventListener('click', function() {
            var d = dateEl();
            loadForDate(d ? d.value : '');
        });
        var closeBtn = document.getElementById('btn-social-scrimmage-close');
        if (closeBtn) closeBtn.addEventListener('click', function() {
            App.Modal.close('social-scrimmage-modal');
        });
        var dateInput = dateEl();
        if (dateInput) {
            dateInput.addEventListener('change', function() {
                loadForDate(dateInput.value);
            });
        }
        var fillHoped = document.getElementById('btn-social-scrimmage-fill-hoped');
        if (fillHoped) {
            fillHoped.addEventListener('click', function() {
                var rows = tbody() ? tbody().querySelectorAll('tr') : [];
                rows.forEach(function(tr) {
                    var hoped = tr.querySelector('.ss-hoped');
                    var assigned = tr.querySelector('.ss-assigned');
                    if (hoped && assigned && hoped.value && !assigned.value) {
                        assigned.value = hoped.value;
                    }
                });
                updateSummary();
                notify('비어 있는 배치 포지션에 희망 포지션을 채웠습니다.', 'success');
            });
        }
        var histBtn = document.getElementById('btn-social-scrimmage-history');
        if (histBtn) {
            histBtn.addEventListener('click', function() {
                if (typeof window.openOutdoorLessonHistoryOverlay === 'function') {
                    window.openOutdoorLessonHistoryOverlay();
                    return;
                }
                notify('누적 명단을 열 수 없습니다. 페이지를 새로고침해 주세요.', 'warning');
            });
        }
        var body = tbody();
        if (body) {
            body.addEventListener('paste', function(e) {
                var input = e.target && e.target.closest
                    ? e.target.closest('.ss-name, .ss-team, .ss-phone')
                    : null;
                if (!input) return;
                var text = (e.clipboardData || window.clipboardData).getData('text');
                var list = parseSlashBlock(text);
                if (!list.length) return;
                e.preventDefault();
                applyParsedList(input.closest('tr'), list);
            });
        }
    }

    window.openSocialScrimmageRosterModal = openModal;
})();
