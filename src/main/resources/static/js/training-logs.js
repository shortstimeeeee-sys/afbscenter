// 훈련 기록 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadMembersForSelect();
    loadTrainingLogs();
    loadCheckedInAttendances();
});

async function loadMembersForSelect() {
    try {
        const members = await App.api.get('/members');
        const select = document.getElementById('filter-member');
        const logSelect = document.getElementById('log-member');
        
        members.forEach(member => {
            const option1 = new Option(member.name, member.id);
            const option2 = new Option(member.name, member.id);
            select.appendChild(option1);
            logSelect.appendChild(option2);
        });
    } catch (error) {
        console.error('회원 목록 로드 실패:', error);
    }
}

async function loadTrainingLogs() {
    const memberId = document.getElementById('filter-member').value;
    const startDate = document.getElementById('filter-date-start').value;
    const endDate = document.getElementById('filter-date-end').value;
    
    try {
        const params = new URLSearchParams();
        if (memberId) params.append('memberId', memberId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const logs = await App.api.get(`/training-logs?${params}`);
        renderTrainingLogs(logs);
    } catch (error) {
        console.error('훈련 기록 로드 실패:', error);
    }
}

function renderTrainingLogs(logs) {
    const tbody = document.getElementById('training-logs-body');
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">기록이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = logs.map(log => {
        const memberName = log.member ? log.member.name : '-';
        const date = log.recordDate || log.date;
        const ballSpeed = log.ballSpeed || log.batSpeed;
        return `
        <tr>
            <td>${App.formatDate(date)}</td>
            <td>${memberName}</td>
            <td>${log.type || '-'}</td>
            <td>${ballSpeed ? ballSpeed + ' km/h' : '-'}</td>
            <td>${log.pitchSpeed ? log.pitchSpeed + ' km/h' : '-'}</td>
            <td>${log.contactRate ? log.contactRate + '%' : '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editLog(${log.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteLog(${log.id})">삭제</button>
            </td>
        </tr>
    `;
    }).join('');
}

function openLogModal(id = null) {
    const modal = document.getElementById('log-modal');
    const title = document.getElementById('log-modal-title');
    const form = document.getElementById('log-form');
    
    if (id) {
        title.textContent = '훈련 기록 수정';
        loadLogData(id);
        // 수정 모드에서는 체크인 기록 선택 비활성화
        document.getElementById('log-attendance').disabled = true;
    } else {
        title.textContent = '훈련 기록 추가';
        form.reset();
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
        // 추가 모드에서는 체크인 기록 선택 활성화
        document.getElementById('log-attendance').disabled = false;
        document.getElementById('log-attendance').value = '';
        // 체크인 기록 목록 다시 로드
        loadCheckedInAttendances();
    }
    
    App.Modal.open('log-modal');
}

async function loadLogData(id) {
    try {
        const log = await App.api.get(`/training-logs/${id}`);
        document.getElementById('log-id').value = log.id;
        document.getElementById('log-member').value = log.member ? log.member.id : '';
        document.getElementById('log-date').value = log.recordDate || log.date;
        document.getElementById('log-swings').value = log.swingCount || log.swings || '';
        document.getElementById('log-bat-speed').value = log.ballSpeed || log.batSpeed || '';
        document.getElementById('log-launch-angle').value = log.launchAngle || '';
        document.getElementById('log-hit-direction').value = log.hitDirection || '';
        document.getElementById('log-contact-rate').value = log.contactRate || '';
        document.getElementById('log-pitch-speed').value = log.pitchSpeed || '';
        document.getElementById('log-spin-rate').value = log.spinRate || '';
        document.getElementById('log-pitch-type').value = log.pitchType || '';
        document.getElementById('log-strike-rate').value = log.strikeRate || '';
        document.getElementById('log-running').value = log.runningDistance || log.running || '';
        document.getElementById('log-condition').value = log.conditionScore || log.condition || '';
        document.getElementById('log-notes').value = log.notes || '';
    } catch (error) {
        App.showNotification('기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveTrainingLog() {
    const memberId = parseInt(document.getElementById('log-member').value);
    if (!memberId) {
        App.showNotification('회원을 선택해주세요.', 'danger');
        return;
    }
    
    const data = {
        member: { id: memberId },
        recordDate: document.getElementById('log-date').value,
        type: 'BATTING', // 기본값 (필수 필드)
        part: 'BASEBALL_BATTING', // 기본값 (필수 필드)
        swingCount: document.getElementById('log-swings').value ? parseInt(document.getElementById('log-swings').value) : null,
        ballSpeed: document.getElementById('log-bat-speed').value ? parseFloat(document.getElementById('log-bat-speed').value) : null,
        launchAngle: document.getElementById('log-launch-angle').value ? parseFloat(document.getElementById('log-launch-angle').value) : null,
        hitDirection: document.getElementById('log-hit-direction').value || null,
        contactRate: document.getElementById('log-contact-rate').value ? parseFloat(document.getElementById('log-contact-rate').value) : null,
        pitchSpeed: document.getElementById('log-pitch-speed').value ? parseFloat(document.getElementById('log-pitch-speed').value) : null,
        spinRate: document.getElementById('log-spin-rate').value ? parseInt(document.getElementById('log-spin-rate').value) : null,
        pitchType: document.getElementById('log-pitch-type').value || null,
        strikeRate: document.getElementById('log-strike-rate').value ? parseFloat(document.getElementById('log-strike-rate').value) : null,
        runningDistance: document.getElementById('log-running').value ? parseFloat(document.getElementById('log-running').value) : null,
        conditionScore: document.getElementById('log-condition').value ? parseInt(document.getElementById('log-condition').value) : null,
        notes: document.getElementById('log-notes').value || null
    };
    
    try {
        const id = document.getElementById('log-id').value;
        if (id) {
            await App.api.put(`/training-logs/${id}`, data);
            App.showNotification('기록이 수정되었습니다.', 'success');
        } else {
            await App.api.post('/training-logs', data);
            App.showNotification('기록이 추가되었습니다.', 'success');
        }
        
        App.Modal.close('log-modal');
        loadTrainingLogs();
    } catch (error) {
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

async function deleteLog(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/training-logs/${id}`);
        App.showNotification('기록이 삭제되었습니다.', 'success');
        loadTrainingLogs();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

function editLog(id) {
    openLogModal(id);
}

// 체크인된 출석 기록 목록 로드
async function loadCheckedInAttendances() {
    try {
        const attendances = await App.api.get('/attendance/checked-in');
        const select = document.getElementById('log-attendance');
        
        // 기존 옵션 제거 (첫 번째 옵션 제외)
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        attendances.forEach(attendance => {
            const memberName = attendance.member ? attendance.member.name : '-';
            const date = attendance.date || '';
            const facilityName = attendance.facility ? attendance.facility.name : '';
            const optionText = `${date} - ${memberName}${facilityName ? ' (' + facilityName + ')' : ''}`;
            const option = new Option(optionText, attendance.id);
            select.appendChild(option);
        });
    } catch (error) {
        console.error('체크인 기록 로드 실패:', error);
    }
}

// 체크인 기록 선택 시 자동으로 정보 입력
async function loadAttendanceData(attendanceId) {
    if (!attendanceId) {
        return;
    }
    
    try {
        const attendance = await App.api.get(`/attendance/${attendanceId}`);
        
        // 회원 정보 자동 입력
        if (attendance.member && attendance.member.id) {
            document.getElementById('log-member').value = attendance.member.id;
        }
        
        // 날짜 자동 입력
        if (attendance.date) {
            document.getElementById('log-date').value = attendance.date;
        }
        
        // 예약 정보가 있으면 추가 정보 가져오기
        if (attendance.booking) {
            // 예약 정보는 이미 attendance 객체에 포함되어 있을 수 있음
            // 필요시 추가 정보 표시
        }
        
        App.showNotification('체크인 기록 정보가 자동으로 입력되었습니다.', 'success');
    } catch (error) {
        console.error('체크인 기록 정보 로드 실패:', error);
        App.showNotification('체크인 기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}
