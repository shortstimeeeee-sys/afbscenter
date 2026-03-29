// 설정 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    initCalendarDayMarksAdminSection();
});

async function loadSettings() {
    try {
        const settings = await App.api.get('/settings');
        // 지점별 센터명
        document.getElementById('setting-center-name-saha').value = settings.centerNameSaha || '';
        document.getElementById('setting-center-name-yeonsan').value = settings.centerNameYeonsan || '';
        // 지점별 연락처
        document.getElementById('setting-phone-saha').value = settings.phoneNumberSaha || '';
        document.getElementById('setting-phone-yeonsan').value = settings.phoneNumberYeonsan || '';
        // 지점별 주소
        document.getElementById('setting-address-saha').value = settings.addressSaha || '';
        document.getElementById('setting-address-yeonsan').value = settings.addressYeonsan || '';
        // 운영시간 (한 줄)
        document.getElementById('setting-operating-hours').value = settings.operatingHours || '';
    } catch (error) {
        App.err('설정 로드 실패:', error);
        // 에러 발생 시 기본값 설정
        document.getElementById('setting-center-name-saha').value = '';
        document.getElementById('setting-center-name-yeonsan').value = '';
        document.getElementById('setting-phone-saha').value = '';
        document.getElementById('setting-phone-yeonsan').value = '';
        document.getElementById('setting-address-saha').value = '';
        document.getElementById('setting-address-yeonsan').value = '';
        document.getElementById('setting-operating-hours').value = '';
        
        // 알림은 표시하지 않음 (개발 중이므로)
        App.warn('설정을 불러올 수 없어 기본값을 사용합니다.');
    }
}

async function saveSettings() {
    const data = {
        centerNameSaha: document.getElementById('setting-center-name-saha').value,
        centerNameYeonsan: document.getElementById('setting-center-name-yeonsan').value,
        phoneNumberSaha: document.getElementById('setting-phone-saha').value,
        phoneNumberYeonsan: document.getElementById('setting-phone-yeonsan').value,
        addressSaha: document.getElementById('setting-address-saha').value,
        addressYeonsan: document.getElementById('setting-address-yeonsan').value,
        operatingHours: document.getElementById('setting-operating-hours').value
    };
    
    try {
        await App.api.put('/settings', data);
        App.showNotification('설정이 저장되었습니다.', 'success');
    } catch (error) {
        App.err('설정 저장 실패:', error);
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

// 사용자 목록은 사용자 관리(users.html) 페이지에서 이용하세요.

/** 관리자·매니저 — 예약 달력 공휴일·메모·빨간날 */
function initCalendarDayMarksAdminSection() {
    var card = document.getElementById('calendar-day-marks-card');
    if (!card) return;
    var role = App.currentUser ? String(App.currentUser.role || '').toUpperCase() : '';
    if (role !== 'ADMIN' && role !== 'MANAGER') {
        return;
    }
    card.style.display = '';
    var monthInput = document.getElementById('calendar-marks-month');
    if (monthInput && !monthInput.value) {
        var d = new Date();
        monthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    if (monthInput) {
        monthInput.addEventListener('change', function () {
            refreshCalendarMarksList();
        });
    }
    refreshCalendarMarksList();
}

async function refreshCalendarMarksList() {
    var tbody = document.getElementById('calendar-marks-list-body');
    var monthEl = document.getElementById('calendar-marks-month');
    if (!tbody || !monthEl) return;
    var ym = monthEl.value;
    if (!ym) {
        tbody.innerHTML =
            '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">월을 선택하세요.</td></tr>';
        return;
    }
    tbody.innerHTML =
        '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">불러오는 중…</td></tr>';
    var y = parseInt(ym.slice(0, 4), 10);
    var mo = parseInt(ym.slice(5, 7), 10);
    var start = ym + '-01';
    var lastDay = new Date(y, mo, 0).getDate();
    var end = ym + '-' + String(lastDay).padStart(2, '0');
    try {
        var map = await App.loadCalendarMarksMap(start, end);
        var keys = Object.keys(map).sort();
        tbody.innerHTML = '';
        if (keys.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">등록된 날짜가 없습니다.</td></tr>';
            return;
        }
        keys.forEach(function (k) {
            var row = map[k];
            var tr = document.createElement('tr');
            var tdDate = document.createElement('td');
            tdDate.textContent = k;
            var tdRed = document.createElement('td');
            tdRed.textContent = row.redDay !== false ? '예' : '아니오';
            var tdMemo = document.createElement('td');
            var memo = (row.memo || '').trim();
            tdMemo.textContent = memo.length > 80 ? memo.slice(0, 80) + '…' : memo || '—';
            tdMemo.title = memo;
            var tdAct = document.createElement('td');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary';
            btn.style.padding = '4px 10px';
            btn.style.fontSize = '12px';
            btn.textContent = '불러오기';
            btn.addEventListener('click', function () {
                document.getElementById('calendar-mark-date').value = k;
                document.getElementById('calendar-mark-memo').value = memo;
                document.getElementById('calendar-mark-red').checked = row.redDay !== false;
            });
            tdAct.appendChild(btn);
            tr.appendChild(tdDate);
            tr.appendChild(tdRed);
            tr.appendChild(tdMemo);
            tr.appendChild(tdAct);
            tbody.appendChild(tr);
        });
    } catch (e) {
        App.err('달력 표시 목록 로드 실패:', e);
        tbody.innerHTML =
            '<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 12px;">목록을 불러오지 못했습니다.</td></tr>';
    }
}

function clearCalendarMarkForm() {
    var d = document.getElementById('calendar-mark-date');
    var m = document.getElementById('calendar-mark-memo');
    var r = document.getElementById('calendar-mark-red');
    if (d) d.value = '';
    if (m) m.value = '';
    if (r) r.checked = true;
}

async function saveCalendarDayMark() {
    var dateStr = document.getElementById('calendar-mark-date') && document.getElementById('calendar-mark-date').value;
    if (!dateStr) {
        App.showNotification('날짜를 선택하세요.', 'warning');
        return;
    }
    var memo = document.getElementById('calendar-mark-memo') ? document.getElementById('calendar-mark-memo').value.trim() : '';
    var redDay = document.getElementById('calendar-mark-red') ? document.getElementById('calendar-mark-red').checked : true;
    if (!redDay && !memo) {
        App.showNotification('빨간날을 끄려면 메모를 남기거나, 삭제 버튼을 사용하세요.', 'warning');
        return;
    }
    try {
        await App.api.put('/calendar-day-marks', { markDate: dateStr, memo: memo, redDay: redDay });
        App.showNotification('저장되었습니다.', 'success');
        await refreshCalendarMarksList();
    } catch (error) {
        App.err('달력 표시 저장 실패:', error);
        var msg = '저장에 실패했습니다.';
        if (error.response && error.response.data && error.response.data.error) msg = error.response.data.error;
        App.showNotification(msg, 'danger');
    }
}

async function deleteCalendarDayMark() {
    var dateStr = document.getElementById('calendar-mark-date') && document.getElementById('calendar-mark-date').value;
    if (!dateStr) {
        App.showNotification('삭제할 날짜를 선택하세요.', 'warning');
        return;
    }
    if (!confirm('이 날짜의 달력 표시(메모·빨간날)를 삭제할까요?')) return;
    try {
        await App.api.delete('/calendar-day-marks/' + encodeURIComponent(dateStr));
        App.showNotification('삭제되었습니다.', 'success');
        clearCalendarMarkForm();
        await refreshCalendarMarksList();
    } catch (error) {
        App.err('달력 표시 삭제 실패:', error);
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}
