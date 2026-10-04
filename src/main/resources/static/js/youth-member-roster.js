(function() {
    'use strict';

    var CACHE_TTL_MS = 5 * 60 * 1000;
    var state = {
        bound: false,
        members: [],
        coaches: [],
        products: [],
        history: [],
        suggestTimer: null,
        suggestTr: null,
        cacheAt: { coaches: 0, products: 0, members: 0 },
        membersLoadPromise: null,
        metaLoadPromise: null
    };

    function historyKey() {
        var branch = (window.BOOKING_PAGE_CONFIG && window.BOOKING_PAGE_CONFIG.branch) || 'ALL';
        return 'afbs.youthRosterHistory.' + branch;
    }

    function loadHistory() {
        try {
            var raw = localStorage.getItem(historyKey());
            var list = raw ? JSON.parse(raw) : [];
            state.history = Array.isArray(list) ? list : [];
        } catch (e) {
            state.history = [];
        }
    }

    function persistHistory() {
        try {
            localStorage.setItem(historyKey(), JSON.stringify(state.history || []));
        } catch (e) { /* ignore quota */ }
        updateSummary();
    }

    function coachNameById(id) {
        if (id == null) return '';
        var found = (state.coaches || []).find(function(c) { return String(c.id) === String(id); });
        return found ? (found.name || '') : '';
    }

    function upsertHistoryEntry(entry) {
        if (!entry || !entry.name) return;
        var list = state.history || [];
        var idx = -1;
        if (entry.id != null) {
            idx = list.findIndex(function(h) { return h && String(h.id) === String(entry.id); });
        }
        if (idx < 0) {
            idx = list.findIndex(function(h) {
                return h && !h.id && h.name === entry.name && (h.phoneNumber || '') === (entry.phoneNumber || '');
            });
        }
        var next = Object.assign({}, idx >= 0 ? list[idx] : {}, entry, {
            savedAt: entry.savedAt || new Date().toISOString()
        });
        // 등록 순 유지: 신규는 뒤에 추가, 기존은 자리 유지
        if (idx >= 0) list[idx] = next;
        else list.push(next);
        state.history = list;
        persistHistory();
    }

    function removeHistoryEntry(id, name, phone) {
        state.history = (state.history || []).filter(function(h) {
            if (!h) return false;
            if (id != null && h.id != null && String(h.id) === String(id)) return false;
            if (id == null && name && h.name === name && (h.phoneNumber || '') === (phone || '')) return false;
            return true;
        });
        persistHistory();
    }

    function historyToRowData(h) {
        if (!h) return {};
        return {
            id: h.id,
            name: h.name,
            guardianName: h.guardianName,
            phoneNumber: h.phoneNumber,
            school: h.school,
            schoolYear: h.schoolYear,
            gender: h.gender,
            memberNumber: h.memberNumber,
            status: h.status,
            coachId: h.coachId,
            coach: h.coachId != null ? { id: h.coachId } : null
        };
    }

    /** 이 화면에서 등록·저장한 목록을 표에 유지 + 맨 아래 수기 입력 줄 */
    function renderRegisteredTable(opts) {
        opts = opts || {};
        var body = tbody();
        if (!body) return;
        body.innerHTML = '';
        (state.history || []).forEach(function(h) {
            addRow(historyToRowData(h), { skipFocus: true });
        });
        addRow({}, { skipFocus: !opts.focusNew });
        setHint('이름·학교·연락처만 붙여넣으면 됩니다. (엑셀: 이름 / 학교 / 학년 / 연락처도 가능)');
        updateSummary();
    }

    function notify(msg, type) {
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification(msg, type || 'info');
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;');
    }

    function formatPhoneInput(value) {
        var d = String(value == null ? '' : value).replace(/\D/g, '').slice(0, 11);
        if (d.length <= 3) return d;
        if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3);
        return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    }

    function bindPhoneFormat(input) {
        if (!input || input.dataset.ymPhoneBound === '1') return;
        input.dataset.ymPhoneBound = '1';
        input.addEventListener('input', function() {
            var formatted = formatPhoneInput(input.value);
            if (input.value !== formatted) {
                var start = input.selectionStart;
                var prevLen = input.value.length;
                input.value = formatted;
                var nextLen = formatted.length;
                var pos = Math.max(0, (start || 0) + (nextLen - prevLen));
                try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
            }
            updateSummary();
        });
        input.addEventListener('blur', function() {
            input.value = formatPhoneInput(input.value);
        });
    }

    function looksLikePhone(s) {
        var d = String(s == null ? '' : s).replace(/\D/g, '');
        return d.length >= 9 && d.length <= 11;
    }

    function looksLikeSchool(s) {
        return /초등|중학|고등|학교|유치원|학원/.test(String(s || ''));
    }

    function parseSchoolYear(s) {
        var raw = String(s == null ? '' : s).trim();
        if (!raw) return null;
        var m = raw.match(/(\d)\s*학년/);
        if (m) {
            var y = parseInt(m[1], 10);
            return y >= 1 && y <= 6 ? y : null;
        }
        if (/^[1-6]$/.test(raw)) return parseInt(raw, 10);
        return null;
    }

    function isHeaderToken(s) {
        var t = String(s || '').replace(/\s+/g, '');
        return /^(순번|이름|보호자|연락처|학교|학교\/소속|소속|학년|성별|담당코치|코치|이용권|삭제|유소년명단|명단)$/.test(t)
            || /유소년명단|학교\/소속/.test(t);
    }

    function splitPasteLine(line) {
        var raw = String(line == null ? '' : line);
        if (raw.indexOf('\t') >= 0) return raw.split('\t');
        if (raw.indexOf('|') >= 0) return raw.split('|');
        if (raw.indexOf('/') >= 0 && looksLikePhone(raw.split('/').pop())) return raw.split('/');
        if (/\s{2,}/.test(raw)) return raw.split(/\s{2,}/);
        return [raw];
    }

    function normalizeParsedRow(obj) {
        if (!obj || !obj.name) return null;
        var name = String(obj.name).trim();
        if (!name || isHeaderToken(name) || looksLikeSchool(name) || looksLikePhone(name)) return null;
        var phone = obj.phoneNumber ? formatPhoneInput(obj.phoneNumber) : '';
        var school = obj.school ? String(obj.school).trim() : '';
        if (school && isHeaderToken(school)) school = '';
        return {
            name: name,
            school: school || null,
            phoneNumber: phone || null
        };
    }

    /** 탭/한 줄에 여러 칸: 이름 · 학교 · (학년) · 연락처 */
    function parseTabRow(parts) {
        var cells = (parts || []).map(function(p) { return String(p || '').trim(); }).filter(function(p) {
            return !!p && !isHeaderToken(p);
        });
        if (!cells.length) return null;
        var phone = '';
        var phoneIdx = -1;
        for (var i = cells.length - 1; i >= 0; i--) {
            if (looksLikePhone(cells[i])) {
                phone = formatPhoneInput(cells[i]);
                phoneIdx = i;
                break;
            }
        }
        var rest = cells.filter(function(_c, i) { return i !== phoneIdx; });
        rest = rest.filter(function(c) { return parseSchoolYear(c) == null; });
        if (rest.length && /^\d+$/.test(rest[0])) rest = rest.slice(1);
        return normalizeParsedRow({
            name: rest[0] || '',
            school: rest.slice(1).join(' ').trim(),
            phoneNumber: phone
        });
    }

    /**
     * 칸이 줄바꿈으로만 온 경우(이름/학교가 번갈아 쌓이는 문제):
     * 이름 → 학교 → (학년) → 연락처 묶음으로 합침
     */
    function parseVerticalCells(lines) {
        var tokens = [];
        lines.forEach(function(line) {
            splitPasteLine(line).forEach(function(p) {
                var t = String(p || '').trim();
                if (t) tokens.push(t);
            });
        });
        var out = [];
        var i = 0;
        while (i < tokens.length) {
            if (isHeaderToken(tokens[i])) { i++; continue; }
            if (looksLikePhone(tokens[i]) || parseSchoolYear(tokens[i]) != null) { i++; continue; }

            var name = tokens[i++];
            if (looksLikeSchool(name)) {
                // 앞에 이름 없이 학교만 온 경우 → 이전 행에 붙이거나 스킵
                if (out.length && !out[out.length - 1].school) {
                    out[out.length - 1].school = name;
                }
                continue;
            }

            var school = '';
            var phone = '';
            if (i < tokens.length && looksLikeSchool(tokens[i])) {
                school = tokens[i++];
            }
            if (i < tokens.length && parseSchoolYear(tokens[i]) != null) {
                i++;
            }
            if (i < tokens.length && looksLikePhone(tokens[i])) {
                phone = formatPhoneInput(tokens[i++]);
            }

            var row = normalizeParsedRow({ name: name, school: school, phoneNumber: phone });
            if (row) out.push(row);
        }
        return out;
    }

    function parseYouthBlock(text) {
        var raw = String(text || '').replace(/\r/g, '');
        var lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
        if (!lines.length) return [];

        var hasTab = lines.some(function(l) { return l.indexOf('\t') >= 0; });
        var hasPipe = lines.some(function(l) { return l.indexOf('|') >= 0; });

        // 엑셀 정상: 한 줄에 탭으로 여러 칸
        if (hasTab || hasPipe) {
            return lines.map(function(line) {
                return parseTabRow(splitPasteLine(line));
            }).filter(Boolean);
        }

        // 줄마다 값이 하나씩인 경우(스크린샷처럼 이름/학교가 따로 줄로 들어옴)
        var multiCellLines = lines.filter(function(l) {
            return splitPasteLine(l).filter(Boolean).length > 1;
        }).length;
        if (multiCellLines === 0 && lines.length >= 2) {
            return parseVerticalCells(lines);
        }

        return lines.map(function(line) {
            return parseTabRow(splitPasteLine(line));
        }).filter(Boolean);
    }

    function fillYouthRow(tr, parsed) {
        if (!tr || !parsed) return;
        delete tr.dataset.id;
        var nameInput = tr.querySelector('.ym-name');
        var phoneInput = tr.querySelector('.ym-phone');
        var schoolInput = tr.querySelector('.ym-school');
        var productSel = tr.querySelector('.ym-product');
        if (nameInput) nameInput.value = parsed.name || '';
        if (schoolInput) schoolInput.value = parsed.school || '';
        if (phoneInput) phoneInput.value = formatPhoneInput(parsed.phoneNumber || '');
        if (productSel) productSel.disabled = false;
        updateSummary();
    }

    function applyParsedList(startTr, list) {
        if (!startTr || !list || !list.length) return;
        fillYouthRow(startTr, list[0]);
        for (var i = 1; i < list.length; i++) {
            addRow({
                name: list[i].name,
                school: list[i].school,
                phoneNumber: list[i].phoneNumber
            }, { skipFocus: true });
        }
        renumber();
        notify(list.length + '줄 붙여넣기 완료 (이름·학교·연락처).', 'success');
    }

    function tbody() {
        return document.getElementById('youth-member-tbody');
    }

    function coachOptionsHtml(selectedId) {
        var opts = '<option value="">미지정</option>';
        (state.coaches || []).forEach(function(c) {
            if (!c || c.id == null) return;
            var sel = String(selectedId || '') === String(c.id) ? ' selected' : '';
            opts += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.name || '') + '</option>';
        });
        return opts;
    }

    function productOptionsHtml(selectedId) {
        var opts = '<option value="">상품 선택...</option>';
        (state.products || []).forEach(function(p) {
            if (!p || p.id == null) return;
            var sel = String(selectedId || '') === String(p.id) ? ' selected' : '';
            var label = (p.name || '상품') + (p.price != null ? (' · ₩' + Number(p.price).toLocaleString()) : '');
            opts += '<option value="' + p.id + '"' + sel + '>' + escapeHtml(label) + '</option>';
        });
        return opts;
    }

    function genderOptionsHtml(selected) {
        var g = selected === 'FEMALE' ? 'FEMALE' : 'MALE';
        return '<option value="MALE"' + (g === 'MALE' ? ' selected' : '') + '>남</option>'
            + '<option value="FEMALE"' + (g === 'FEMALE' ? ' selected' : '') + '>여</option>';
    }

    function schoolYearOptionsHtml(selected) {
        var cur = selected != null && selected !== '' ? String(selected) : '';
        var opts = '<option value="">-</option>';
        for (var y = 1; y <= 6; y++) {
            var sel = cur === String(y) ? ' selected' : '';
            opts += '<option value="' + y + '"' + sel + '>' + y + '</option>';
        }
        return opts;
    }

    function normalizeList(response) {
        if (Array.isArray(response)) return response;
        if (response && Array.isArray(response.content)) return response.content;
        if (response && Array.isArray(response.members)) return response.members;
        return [];
    }

    async function loadCoaches() {
        try {
            // 지점 배정과 무관하게 전체 조회 — 박근엽 등은 SAHA만 배정이어도 유소년 등록에 필요
            var list = await App.api.get('/coaches');
            var active = (list || []).filter(function(c) { return c && c.active !== false; });
            // 야구 파트: BASEBALL + YOUTH (유소년 담당은 YOUTH로 분류되어 BASEBALL 필터에서 빠질 수 있음)
            if (typeof App.categorizeCoachBySubject === 'function') {
                active = active.filter(function(c) {
                    var cat = App.categorizeCoachBySubject(c);
                    return cat === 'BASEBALL' || cat === 'YOUTH';
                });
            } else if (typeof App.filterCoachesForBookingCalendar === 'function') {
                active = App.filterCoachesForBookingCalendar(active, {
                    facilityType: 'BASEBALL',
                    lessonCategory: 'YOUTH_BASEBALL'
                });
            }
            // 유소년 회원 등록 코치 목록에서 공인욱·이원준 제외
            active = active.filter(function(c) {
                var n = c.name || '';
                return n.indexOf('공인욱') < 0 && n.indexOf('이원준') < 0;
            });
            if (typeof App.isOutdoorLessonPlaceholderCoach === 'function') {
                active = active.filter(function(c) {
                    return !App.isOutdoorLessonPlaceholderCoach(c);
                });
            }
            var seen = {};
            state.coaches = active.filter(function(c) {
                if (c.id == null || seen[c.id]) return false;
                seen[c.id] = true;
                return true;
            });
            if (typeof App.CoachSortOrder === 'function') {
                state.coaches.sort(function(a, b) {
                    var oa = App.CoachSortOrder(a);
                    var ob = App.CoachSortOrder(b);
                    if (oa !== ob) return oa - ob;
                    return (a.name || '').localeCompare(b.name || '');
                });
            }
        } catch (e) {
            state.coaches = [];
        }
    }

    async function loadProducts() {
        try {
            var list = await App.api.get('/products');
            state.products = (list || []).filter(function(p) {
                if (!p || p.active === false) return false;
                var cat = (p.category && (p.category.name || p.category) || '').toString().toUpperCase();
                return cat === 'BASEBALL' || cat === 'GENERAL' || cat === 'YOUTH' || !cat;
            });
        } catch (e) {
            state.products = [];
        }
    }

    async function loadMembersCache() {
        try {
            // 검색용 캐시만 유지(표에 자동 나열하지 않음). allStatuses는 승인대기 제외 → 승인대기도 검색되게 병합
            var results = await Promise.all([
                App.api.get('/members?grade=YOUTH&allStatuses=true'),
                App.api.get('/members?grade=YOUTH&status=PENDING_APPROVAL')
            ]);
            var merged = normalizeList(results[0]).concat(normalizeList(results[1]));
            var seen = {};
            state.members = merged.filter(function(m) {
                if (!m || m.id == null || seen[m.id]) return false;
                seen[m.id] = true;
                return true;
            });
            state.cacheAt.members = Date.now();
            updateSummary();
        } catch (e) {
            state.members = [];
            App.err('유소년 회원 목록 실패:', e);
        }
    }

    function cacheFresh(key) {
        return state.cacheAt[key] > 0 && (Date.now() - state.cacheAt[key] < CACHE_TTL_MS);
    }

    async function ensureCoaches(force) {
        if (!force && cacheFresh('coaches')) return;
        await loadCoaches();
        state.cacheAt.coaches = Date.now();
    }

    async function ensureProducts(force) {
        if (!force && cacheFresh('products')) return;
        await loadProducts();
        state.cacheAt.products = Date.now();
    }

    function ensureMembersCache(force) {
        if (!force && cacheFresh('members')) return Promise.resolve();
        if (state.membersLoadPromise) return state.membersLoadPromise;
        state.membersLoadPromise = loadMembersCache().finally(function() {
            state.membersLoadPromise = null;
        });
        return state.membersLoadPromise;
    }

    function ensureMeta(force) {
        if (!force && cacheFresh('coaches') && cacheFresh('products')) return Promise.resolve();
        if (state.metaLoadPromise && !force) return state.metaLoadPromise;
        state.metaLoadPromise = Promise.all([ensureCoaches(force), ensureProducts(force)]).finally(function() {
            state.metaLoadPromise = null;
        });
        return state.metaLoadPromise;
    }

    /** 코치/상품 로드 후 열린 표의 select 옵션만 갱신 (값 유지) */
    function refreshSelectOptionsInTable() {
        var body = tbody();
        if (!body) return;
        body.querySelectorAll('tr').forEach(function(tr) {
            var coachSel = tr.querySelector('.ym-coach');
            var productSel = tr.querySelector('.ym-product');
            if (coachSel) {
                var curCoach = coachSel.value;
                coachSel.innerHTML = coachOptionsHtml(curCoach);
            }
            if (productSel) {
                var curProd = productSel.value;
                productSel.innerHTML = productOptionsHtml(curProd);
                productSel.disabled = false;
            }
        });
    }

    function prefetchMembersIdle() {
        var run = function() { ensureMembersCache(); };
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(run, { timeout: 2500 });
        } else {
            setTimeout(run, 400);
        }
    }

    function resetTable() {
        renderRegisteredTable({ focusNew: true });
    }

    function renumber() {
        var rows = tbody() ? tbody().querySelectorAll('tr') : [];
        rows.forEach(function(tr, i) {
            var seq = tr.querySelector('.ym-seq');
            if (seq) seq.textContent = String(i + 1);
        });
        updateSummary();
    }

    function updateSummary() {
        var rows = collectRows().filter(function(r) { return (r.name || '').trim(); });
        var linked = rows.filter(function(r) { return r.id; }).length;
        var draft = rows.length - linked;
        var set = function(id, text) {
            var el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        set('ym-count-registered', (state.history || []).length + '명');
        set('ym-count-rows', rows.length + '줄');
        set('ym-count-linked', linked + '명');
        set('ym-count-draft', draft + '줄');
    }

    function setHint(text) {
        var hint = document.getElementById('youth-member-hint');
        if (hint) hint.textContent = text || '';
    }

    function hideSuggest() {
        var boxes = document.querySelectorAll('#youth-member-modal .ym-suggest');
        boxes.forEach(function(box) {
            box.hidden = true;
            box.innerHTML = '';
        });
        state.suggestTr = null;
    }

    function addRow(data, opts) {
        data = data || {};
        var tr = document.createElement('tr');
        if (data.id != null && data.id !== '') tr.dataset.id = String(data.id);
        var coachId = data.coach && data.coach.id != null ? data.coach.id : (data.coachId || '');
        var productId = data.productId || '';
        tr.innerHTML =
            '<td class="ym-seq"></td>' +
            '<td class="ym-name-cell" data-label="이름">' +
                '<input type="text" class="form-control ym-name" maxlength="100" placeholder="이름·회원 검색" autocomplete="off" value="' + escapeHtml(data.name || '') + '">' +
                '<div class="ym-suggest" hidden></div>' +
            '</td>' +
            '<td class="ym-student-cell" data-label="보호자">' +
                '<input type="text" class="form-control ym-student" maxlength="100" placeholder="보호자" value="' + escapeHtml(data.guardianName || data.student || '') + '">' +
            '</td>' +
            '<td class="ym-phone-cell" data-label="연락처">' +
                '<input type="text" class="form-control ym-phone" maxlength="13" inputmode="numeric" placeholder="000-0000-0000" value="' + escapeHtml(formatPhoneInput(data.phoneNumber || data.phone || '')) + '">' +
            '</td>' +
            '<td class="ym-school-cell" data-label="학교">' +
                '<input type="text" class="form-control ym-school" maxlength="100" placeholder="학교/소속" value="' + escapeHtml(data.school || '') + '">' +
            '</td>' +
            '<td class="ym-year-cell" data-label="학년">' +
                '<select class="form-control ym-year">' + schoolYearOptionsHtml(data.schoolYear) + '</select>' +
            '</td>' +
            '<td class="ym-gender-cell" data-label="성별">' +
                '<select class="form-control ym-gender">' + genderOptionsHtml(data.gender) + '</select>' +
            '</td>' +
            '<td class="ym-coach-cell" data-label="코치">' +
                '<select class="form-control ym-coach">' + coachOptionsHtml(coachId) + '</select>' +
            '</td>' +
            '<td class="ym-product-cell" data-label="이용권">' +
                '<select class="form-control ym-product">' +
                productOptionsHtml(productId) + '</select>' +
            '</td>' +
            '<td class="ym-remove-cell">' +
                '<button type="button" class="ym-remove" title="삭제">×</button>' +
            '</td>';
        tbody().appendChild(tr);
        bindRow(tr);
        renumber();
        var nameInput = tr.querySelector('.ym-name');
        if (nameInput && !data.name && !(opts && opts.skipFocus)) nameInput.focus();
        return tr;
    }

    function bindRow(tr) {
        var removeBtn = tr.querySelector('.ym-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', function() {
                var rid = tr.dataset.id ? Number(tr.dataset.id) : null;
                var rname = (tr.querySelector('.ym-name')?.value || '').trim();
                var rphone = formatPhoneInput(tr.querySelector('.ym-phone')?.value || '');
                if (rid || rname) removeHistoryEntry(rid, rname, rphone);
                tr.remove();
                hideSuggest();
                renumber();
                if (!tbody().querySelector('tr')) addRow({}, { skipFocus: true });
            });
        }
        var nameInput = tr.querySelector('.ym-name');
        if (nameInput) {
            nameInput.addEventListener('input', function() {
                // 수기 입력 시 기존 연결 해제
                if (tr.dataset.id) {
                    delete tr.dataset.id;
                }
                scheduleSuggest(tr);
                updateSummary();
            });
            nameInput.addEventListener('focus', function() { scheduleSuggest(tr); });
            nameInput.addEventListener('blur', function() {
                setTimeout(function() {
                    if (state.suggestTr === tr) hideSuggest();
                }, 180);
            });
        }
        ['ym-student', 'ym-phone', 'ym-school', 'ym-year', 'ym-gender', 'ym-coach', 'ym-product'].forEach(function(cls) {
            var el = tr.querySelector('.' + cls);
            if (el) el.addEventListener('change', updateSummary);
            if (el && cls !== 'ym-phone') el.addEventListener('input', updateSummary);
        });
        bindPhoneFormat(tr.querySelector('.ym-phone'));
    }

    function scheduleSuggest(tr) {
        clearTimeout(state.suggestTimer);
        state.suggestTimer = setTimeout(function() {
            ensureMembersCache().then(function() { searchMembers(tr); });
        }, 180);
    }

    function searchMembers(tr) {
        if (!tr) return;
        var input = tr.querySelector('.ym-name');
        var box = tr.querySelector('.ym-suggest');
        if (!input || !box) return;
        var q = (input.value || '').trim().toLowerCase();
        if (q.length < 1) {
            box.hidden = true;
            box.innerHTML = '';
            return;
        }
        var list = state.members.filter(function(m) {
            var blob = [m.name, m.guardianName, m.phoneNumber, m.school, m.memberNumber]
                .map(function(x) { return (x || '').toString().toLowerCase(); }).join(' ');
            return blob.indexOf(q) >= 0;
        }).slice(0, 12);
        if (!list.length) {
            box.hidden = true;
            box.innerHTML = '';
            return;
        }
        state.suggestTr = tr;
        box.innerHTML = list.map(function(m, i) {
            var meta = [m.guardianName ? ('보호자 ' + m.guardianName) : '', m.phoneNumber, m.school]
                .filter(Boolean).join(' · ');
            return '<button type="button" data-ym-idx="' + i + '">' +
                '<strong>' + escapeHtml(m.name || '') + '</strong>' +
                (meta ? '<span>' + escapeHtml(meta) + '</span>' : '') +
                '</button>';
        }).join('');
        box.hidden = false;
        box.querySelectorAll('button').forEach(function(btn) {
            btn.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var idx = Number(btn.getAttribute('data-ym-idx'));
                var m = list[idx];
                if (m) applyMemberToRow(tr, m);
                hideSuggest();
            });
        });
    }

    function applyMemberToRow(tr, member) {
        if (!tr || !member) return;
        tr.dataset.id = String(member.id);
        var nameInput = tr.querySelector('.ym-name');
        var studentInput = tr.querySelector('.ym-student');
        var phoneInput = tr.querySelector('.ym-phone');
        var schoolInput = tr.querySelector('.ym-school');
        var yearSel = tr.querySelector('.ym-year');
        var genderSel = tr.querySelector('.ym-gender');
        var coachSel = tr.querySelector('.ym-coach');
        var productSel = tr.querySelector('.ym-product');
        if (nameInput) nameInput.value = member.name || '';
        if (studentInput) studentInput.value = member.guardianName || '';
        if (phoneInput) phoneInput.value = formatPhoneInput(member.phoneNumber || '');
        if (schoolInput) schoolInput.value = member.school || '';
        if (yearSel) yearSel.value = member.schoolYear != null ? String(member.schoolYear) : '';
        if (genderSel) genderSel.value = member.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
        if (coachSel) coachSel.value = member.coach && member.coach.id != null ? String(member.coach.id) : '';
        if (productSel) {
            productSel.value = '';
            productSel.disabled = false;
        }
        updateSummary();
    }

    function collectRows() {
        var out = [];
        var rows = tbody() ? tbody().querySelectorAll('tr') : [];
        rows.forEach(function(tr) {
            var name = (tr.querySelector('.ym-name')?.value || '').trim();
            var coachVal = (tr.querySelector('.ym-coach')?.value || '').trim();
            var productVal = (tr.querySelector('.ym-product')?.value || '').trim();
            var yearVal = (tr.querySelector('.ym-year')?.value || '').trim();
            var id = tr.dataset.id ? Number(tr.dataset.id) : null;
            var schoolYear = yearVal ? parseInt(yearVal, 10) : null;
            if (schoolYear != null && (isNaN(schoolYear) || schoolYear < 1 || schoolYear > 6)) schoolYear = null;
            out.push({
                id: id && !isNaN(id) ? id : null,
                name: name,
                guardianName: (tr.querySelector('.ym-student')?.value || '').trim() || null,
                phoneNumber: formatPhoneInput(tr.querySelector('.ym-phone')?.value || '') || null,
                school: (tr.querySelector('.ym-school')?.value || '').trim() || null,
                schoolYear: schoolYear,
                gender: (tr.querySelector('.ym-gender')?.value || 'MALE').trim(),
                coachId: coachVal ? parseInt(coachVal, 10) : null,
                productId: productVal ? parseInt(productVal, 10) : null
            });
        });
        return out;
    }

    function apiErrorMessage(e) {
        if (typeof App.getApiErrorMessage === 'function') {
            return App.getApiErrorMessage(e);
        }
        if (e && e.response && e.response.data) {
            var d = e.response.data;
            if (d.message) return d.message;
            if (d.error) return d.error;
            if (d.fieldErrors) {
                var keys = Object.keys(d.fieldErrors);
                if (keys.length) return d.fieldErrors[keys[0]];
            }
        }
        return (e && e.message) || '저장에 실패했습니다.';
    }

    function positiveOrNull(v) {
        if (v == null || v === '') return null;
        var n = Number(v);
        return (isFinite(n) && n > 0) ? n : null;
    }

    async function saveAll() {
        var rows = collectRows().filter(function(r) { return (r.name || '').trim(); });
        if (!rows.length) {
            notify('저장할 내용이 없습니다. 이름을 입력해 주세요.', 'warning');
            return;
        }
        var ok = 0;
        var fail = 0;
        var lastErr = '';
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var rowLabel = (i + 1) + '번째 줄' + (r.name ? (' (' + r.name + ')') : '');
            if (!r.phoneNumber) {
                fail++;
                lastErr = rowLabel + ': 연락처가 필요합니다.';
                notify(lastErr, 'warning');
                continue;
            }
            try {
                if (r.id) {
                    var current = await App.api.get('/members/' + encodeURIComponent(r.id));
                    var payload = {
                        name: r.name,
                        phoneNumber: r.phoneNumber,
                        guardianName: r.guardianName,
                        school: r.school,
                        schoolYear: r.schoolYear,
                        gender: r.gender || 'MALE',
                        grade: 'YOUTH',
                        status: current.status || 'ACTIVE',
                        joinDate: current.joinDate || null,
                        memberNumber: current.memberNumber || null,
                        birthDate: current.birthDate || null,
                        height: positiveOrNull(current.height),
                        weight: positiveOrNull(current.weight),
                        address: current.address || null,
                        memo: current.memo || null,
                        guardianPhone: current.guardianPhone || null,
                        coach: r.coachId ? { id: r.coachId } : null
                    };
                    await App.api.put('/members/' + encodeURIComponent(r.id), payload);
                    if (r.productId) {
                        if (!r.coachId) {
                            fail++;
                            lastErr = rowLabel + ': 이용권 배정 시 담당 코치가 필요합니다.';
                            notify(lastErr, 'warning');
                            continue;
                        }
                        try {
                            await App.api.post('/members/' + encodeURIComponent(r.id) + '/products', {
                                productId: r.productId,
                                coachId: r.coachId,
                                productSelectionIntent: 'MEMBER_FORM'
                            });
                        } catch (assignErr) {
                            fail++;
                            lastErr = rowLabel + ': ' + apiErrorMessage(assignErr);
                            App.err('유소년 이용권 배정 실패:', assignErr);
                            notify(lastErr, 'danger');
                            continue;
                        }
                    }
                    upsertHistoryEntry({
                        id: r.id,
                        name: r.name,
                        guardianName: r.guardianName,
                        phoneNumber: r.phoneNumber,
                        school: r.school,
                        schoolYear: r.schoolYear,
                        gender: r.gender,
                        coachId: r.coachId,
                        coachName: coachNameById(r.coachId),
                        source: 'update'
                    });
                    ok++;
                } else {
                    if (!r.coachId || !r.productId) {
                        fail++;
                        lastErr = rowLabel + '(신규): 담당 코치와 이용권을 선택해 주세요.';
                        notify(lastErr, 'warning');
                        continue;
                    }
                    var today = new Date();
                    var joinDate = today.getFullYear() + '-'
                        + String(today.getMonth() + 1).padStart(2, '0') + '-'
                        + String(today.getDate()).padStart(2, '0');
                    var created = await App.api.post('/members', {
                        name: r.name,
                        phoneNumber: r.phoneNumber,
                        guardianName: r.guardianName,
                        school: r.school,
                        schoolYear: r.schoolYear,
                        gender: r.gender || 'MALE',
                        grade: 'YOUTH',
                        status: 'ACTIVE',
                        joinDate: joinDate,
                        coach: { id: r.coachId },
                        initialProductAssignments: [{
                            productId: r.productId,
                            coachId: r.coachId
                        }]
                    });
                    // 회원 행 생성 후 이용권 실제 배정 (회원 관리 화면과 동일)
                    if (created && created.id) {
                        try {
                            await App.api.post('/members/' + encodeURIComponent(created.id) + '/products', {
                                productId: r.productId,
                                coachId: r.coachId,
                                productSelectionIntent: 'MEMBER_FORM'
                            });
                        } catch (assignErr) {
                            App.err('유소년 이용권 배정 실패(회원은 등록됨):', assignErr);
                            notify(rowLabel + ': 회원은 등록됐지만 이용권 배정에 실패했습니다. 회원 관리에서 이용권을 추가해 주세요.', 'warning');
                        }
                    }
                    upsertHistoryEntry({
                        id: created && created.id != null ? created.id : null,
                        name: r.name,
                        guardianName: r.guardianName,
                        phoneNumber: r.phoneNumber,
                        school: r.school,
                        schoolYear: r.schoolYear,
                        gender: r.gender,
                        memberNumber: created && created.memberNumber ? created.memberNumber : null,
                        status: created && created.status ? created.status : 'PENDING_APPROVAL',
                        coachId: r.coachId,
                        coachName: coachNameById(r.coachId),
                        source: 'create'
                    });
                    ok++;
                }
            } catch (e) {
                fail++;
                lastErr = rowLabel + ': ' + apiErrorMessage(e);
                App.err('유소년 회원 저장 실패:', e);
                notify(lastErr, 'danger');
            }
        }
        if (ok) {
            notify(ok + '건 저장했습니다.' + (fail ? (' (실패 ' + fail + '건)') : ''), fail ? 'warning' : 'success');
            await loadMembersCache();
            renderRegisteredTable({ focusNew: true });
        } else if (fail) {
            notify(lastErr || '저장에 실패했습니다.', 'danger');
        }
    }

    function bind() {
        if (state.bound) return;
        state.bound = true;
        var addBtn = document.getElementById('btn-youth-member-add');
        if (addBtn) addBtn.addEventListener('click', function() { addRow({}); });
        var saveBtn = document.getElementById('btn-youth-member-save');
        if (saveBtn) saveBtn.addEventListener('click', saveAll);
        var closeBtn = document.getElementById('btn-youth-member-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                App.Modal.close('youth-member-modal');
            });
        }
        var clearBtn = document.getElementById('btn-youth-member-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                resetTable();
            });
        }
        var body = tbody();
        if (body && !body.dataset.ymPasteBound) {
            body.dataset.ymPasteBound = '1';
            body.addEventListener('paste', function(e) {
                var input = e.target && e.target.closest
                    ? e.target.closest('.ym-name, .ym-student, .ym-phone, .ym-school')
                    : null;
                if (!input) return;
                var clip = e.clipboardData || window.clipboardData;
                var text = clip.getData('text');
                try {
                    var html = clip.getData('text/html') || '';
                    if (html && /<table/i.test(html)) {
                        var doc = new DOMParser().parseFromString(html, 'text/html');
                        var trs = doc.querySelectorAll('tr');
                        if (trs && trs.length) {
                            text = Array.prototype.map.call(trs, function(tr) {
                                return Array.prototype.map.call(tr.querySelectorAll('th,td'), function(td) {
                                    return (td.textContent || '').trim();
                                }).join('\t');
                            }).join('\n');
                        }
                    }
                } catch (err) { /* text 그대로 */ }
                if (!text) return;
                if (text.indexOf('\n') < 0 && text.indexOf('\t') < 0) return;
                var list = parseYouthBlock(text);
                if (!list.length) return;
                e.preventDefault();
                applyParsedList(input.closest('tr'), list);
            });
        }
    }

    async function openModal() {
        bind();
        loadHistory();
        App.Modal.open('youth-member-modal');
        // 로컬 등록 목록은 즉시 표시 — 안 쓰는 검색용 회원 API는 대기하지 않음
        renderRegisteredTable({ focusNew: true });
        await ensureMeta();
        refreshSelectOptionsInTable();
        prefetchMembersIdle();
    }

    window.openYouthMemberRosterModal = openModal;
})();
