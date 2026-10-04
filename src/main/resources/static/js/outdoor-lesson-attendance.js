(function() {
    var BRANCH = 'SAHA';
    var rows = [];

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

    function notify(msg, type) {
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification(msg, type || 'info');
        }
    }

    function queryDate() {
        try {
            return new URLSearchParams(window.location.search).get('date') || '';
        } catch (e) {
            return '';
        }
    }

    function setUrlDate(dateStr) {
        try {
            var url = new URL(window.location.href);
            url.searchParams.set('date', dateStr);
            window.history.replaceState({}, '', url.toString());
        } catch (e) { /* ignore */ }
    }

    function rowHeadcount(p) {
        if (!p || !p.teamBooking) return 1;
        var n = Number(p.headcount);
        if (!isNaN(n) && n >= 1) return Math.min(99, Math.floor(n));
        return 1;
    }

    function notesFor(p) {
        if (p && Array.isArray(p.notes) && p.notes.length) return p.notes;
        var notes = [];
        if (!p || !p.depositConfirmed) notes.push('입금 확인 할 것');
        var teamMode = !!(p && p.teamBooking);
        var phone = String((p && p.phone) || '').replace(/\D/g, '');
        if (!teamMode && !phone) notes.push('연락처 확인 할 것');
        if (!p || p.productId == null || p.productId === '') notes.push('요금제 확인 할 것');
        return notes;
    }

    function namedRows() {
        return rows.filter(function(p) {
            return String((p && p.name) || '').trim();
        });
    }

    function updateSummary() {
        var list = namedRows();
        var present = 0;
        var needNote = 0;
        var total = 0;
        list.forEach(function(p) {
            var people = rowHeadcount(p);
            total += people;
            if (p.attended) present += people;
            if (notesFor(p).length) needNote += people;
        });
        setText('ol-att-total', total + '명');
        setText('ol-att-present', present + '명');
        setText('ol-att-absent', (total - present) + '명');
        setText('ol-att-notes', needNote + '명');
        setText('ol-att-date-label', formatKoDate(dateInput().value) || '-');
        document.title = '야외 레슨 출석 ' + (formatKoDate(dateInput().value) || '') + ' - AFBS 센터';
    }

    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function dateInput() {
        return document.getElementById('ol-att-date');
    }

    function listEl() {
        return document.getElementById('ol-att-list');
    }

    function render() {
        var host = listEl();
        if (!host) return;
        var list = namedRows();
        if (!list.length) {
            host.innerHTML = '<p class="ol-att-empty">이 날짜에 저장된 최종 인원이 없습니다. 야외 레슨 참가 인원에서 명단을 저장한 뒤 다시 열어 주세요.</p>';
            updateSummary();
            return;
        }
        var body = list.map(function(p, i) {
            var notes = notesFor(p);
            var attended = !!p.attended;
            var noteHtml = notes.length
                ? notes.map(function(n) { return '<span class="ol-att-note">' + escapeHtml(n) + '</span>'; }).join('')
                : '<span style="color:var(--text-muted);">-</span>';
            return '<tr class="ol-att-row' + (attended ? ' is-attended' : '') + (notes.length ? ' is-note' : '') + '" data-id="' + escapeHtml(p.id) + '">' +
                '<td class="ol-att-seq">' + (p.seqNo != null ? p.seqNo : (i + 1)) + '</td>' +
                '<td class="ol-att-name" data-label="이름">' + escapeHtml(p.name) + '</td>' +
                '<td class="ol-att-team" data-label="팀">' + escapeHtml(p.team || '-') + '</td>' +
                '<td class="ol-att-phone" data-label="연락처">' + escapeHtml(p.phone || '-') + '</td>' +
                '<td class="ol-att-count" data-label="인원">' + rowHeadcount(p) + '명</td>' +
                '<td class="ol-att-check" data-label="출석"><button type="button" class="ol-att-toggle' + (attended ? ' is-on' : '') + '" aria-pressed="' + (attended ? 'true' : 'false') + '">' +
                (attended ? '출석' : '미출석') + '</button></td>' +
                '<td class="ol-att-note-cell" data-label="비고"><div class="ol-att-notes">' + noteHtml + '</div></td>' +
                '</tr>';
        }).join('');
        host.innerHTML =
            '<div class="table-container" style="max-height:none;overflow:visible;">' +
            '<table class="ol-att-table">' +
            '<thead><tr><th class="ol-att-seq">순번</th><th>이름</th><th>팀</th><th>연락처</th><th>인원</th><th>출석</th><th>비고</th></tr></thead>' +
            '<tbody>' + body + '</tbody></table></div>';
        updateSummary();
    }

    async function loadForDate(dateStr) {
        if (!dateStr) return;
        var host = listEl();
        if (host) host.innerHTML = '<p class="ol-att-empty">불러오는 중...</p>';
        try {
            var data = await App.api.get('/outdoor-lesson-participants?lessonDate=' + encodeURIComponent(dateStr) + '&branch=' + encodeURIComponent(BRANCH));
            rows = Array.isArray(data.participants) ? data.participants : [];
            setUrlDate(dateStr);
            render();
        } catch (e) {
            rows = [];
            if (host) host.innerHTML = '<p class="ol-att-error">명단을 불러오지 못했습니다.</p>';
            notify('출석 명단을 불러오지 못했습니다.', 'danger');
            updateSummary();
        }
    }

    async function toggleAttendance(id, next) {
        var row = rows.find(function(p) { return String(p.id) === String(id); });
        if (!row) return;
        var prev = !!row.attended;
        row.attended = next;
        render();
        try {
            await App.api.patch('/outdoor-lesson-participants/' + encodeURIComponent(id) + '/attendance', { attended: next });
        } catch (e) {
            row.attended = prev;
            render();
            notify('출석 저장에 실패했습니다.', 'danger');
        }
    }

    function bind() {
        var input = dateInput();
        var initial = queryDate() || todayStr();
        if (input) {
            input.value = initial;
            input.addEventListener('change', function() {
                loadForDate(input.value);
            });
        }
        var reload = document.getElementById('ol-att-reload');
        if (reload) reload.addEventListener('click', function() {
            loadForDate(dateInput() && dateInput().value);
        });
        var closeBtn = document.getElementById('ol-att-close');
        if (closeBtn) closeBtn.addEventListener('click', function() {
            if (window.opener && !window.opener.closed) {
                window.close();
                return;
            }
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            window.location.href = '/bookings-saha-social.html';
        });
        var host = listEl();
        if (host) {
            host.addEventListener('click', function(e) {
                var tr = e.target.closest && e.target.closest('.ol-att-row');
                if (!tr || !tr.dataset.id) return;
                var row = rows.find(function(p) { return String(p.id) === String(tr.dataset.id); });
                if (!row) return;
                toggleAttendance(tr.dataset.id, !row.attended);
            });
        }
        loadForDate(initial);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
