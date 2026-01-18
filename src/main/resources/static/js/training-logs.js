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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">기록이 없습니다.</td></tr>';
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
                <button class="btn btn-sm btn-primary" onclick="viewLogDetail(${log.id})">상세보기</button>
            </td>
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
        // 체크인 기록을 선택하면 날짜가 자동으로 설정되므로, 기본값은 오늘 날짜
        // 하지만 체크인 기록을 선택하면 방문한 날짜로 자동 변경됨
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
        weightTraining: null, // 웨이트 트레이닝은 별도 필드가 없으므로 null
        conditionScore: (() => {
            const conditionValue = document.getElementById('log-condition').value;
            if (!conditionValue) return null;
            // 숫자로 변환 가능한 경우만 변환
            const numValue = parseInt(conditionValue);
            return isNaN(numValue) ? null : numValue;
        })(),
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
        // 체크인 기록 목록 다시 로드 (추가/수정된 기록은 목록에서 제외됨)
        loadCheckedInAttendances();
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
        // 체크인 기록 목록 다시 로드 (삭제된 기록의 체크인 기록이 다시 목록에 나타날 수 있음)
        loadCheckedInAttendances();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

function editLog(id) {
    openLogModal(id);
}

// 상세보기 모달 열기
async function viewLogDetail(id) {
    try {
        const log = await App.api.get(`/training-logs/${id}`);
        
        // 기본 정보 표시 (카드 형태)
        const basicInfo = document.getElementById('log-detail-basic');
        basicInfo.innerHTML = `
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">회원</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.member ? log.member.name : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">날짜</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${App.formatDate(log.recordDate || log.date)}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">타입</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.type || '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">타구속도</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.ballSpeed ? log.ballSpeed + ' km/h' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">구속</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.pitchSpeed ? log.pitchSpeed + ' km/h' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">컨택률</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.contactRate ? log.contactRate + '%' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">스트라이크율</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.strikeRate ? log.strikeRate + '%' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">메모</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px; word-break: break-word;">${log.notes || '-'}</div>
            </div>
        `;
        
        // 회원의 모든 훈련 기록 가져오기
        if (log.member && log.member.id) {
            await loadMemberTrainingHistory(log.member.id);
        } else {
            // 회원 정보가 없으면 그래프 영역에 메시지 표시
            document.getElementById('chart-ball-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
            document.getElementById('chart-pitch-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
            document.getElementById('chart-contact-rate').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
            document.getElementById('chart-strike-rate').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
        }
        
        App.Modal.open('log-detail-modal');
    } catch (error) {
        console.error('훈련 기록 상세보기 로드 실패:', error);
        App.showNotification('기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원의 훈련 기록 추이 로드 및 그래프 표시
async function loadMemberTrainingHistory(memberId) {
    try {
        const logs = await App.api.get(`/training-logs?memberId=${memberId}`);
        
        // 날짜순으로 정렬
        logs.sort((a, b) => {
            const dateA = new Date(a.recordDate || a.date);
            const dateB = new Date(b.recordDate || b.date);
            return dateA - dateB;
        });
        
        // 타구속도 추이 그래프
        renderTrainingChart('chart-ball-speed', logs, 'ballSpeed', '타구속도 (km/h)', 'km/h');
        
        // 구속 추이 그래프
        renderTrainingChart('chart-pitch-speed', logs, 'pitchSpeed', '구속 (km/h)', 'km/h');
        
        // 컨택률 추이 그래프
        renderTrainingChart('chart-contact-rate', logs, 'contactRate', '컨택률 (%)', '%');
        
        // 스트라이크율 추이 그래프
        renderTrainingChart('chart-strike-rate', logs, 'strikeRate', '스트라이크율 (%)', '%');
        
    } catch (error) {
        console.error('회원 훈련 기록 추이 로드 실패:', error);
        document.getElementById('chart-ball-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
        document.getElementById('chart-pitch-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
        document.getElementById('chart-contact-rate').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
        document.getElementById('chart-strike-rate').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
    }
}

// 훈련 기록 추이 그래프 렌더링
function renderTrainingChart(containerId, logs, fieldName, title, unit) {
    const container = document.getElementById(containerId);
    
    // 해당 필드가 있는 기록만 필터링
    const dataPoints = logs
        .filter(log => {
            const value = log[fieldName];
            return value != null && value !== '' && !isNaN(value);
        })
        .map(log => ({
            date: log.recordDate || log.date,
            value: parseFloat(log[fieldName])
        }));
    
    if (dataPoints.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터가 없습니다.</p>`;
        return;
    }
    
    // 최소값과 최대값 계산
    const values = dataPoints.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1; // 0으로 나누기 방지
    
    // 그래프 높이와 여백
    const chartHeight = 168;
    const padding = 20;
    const chartAreaHeight = chartHeight - padding * 2;
    
    // 간단한 라인 차트 생성
    let chartHTML = `<div style="position: relative; height: ${chartHeight}px;">`;
    
    // Y축 레이블
    chartHTML += `
        <div style="position: absolute; left: 0; top: ${padding}px; width: 40px; text-align: right; font-size: 10px; color: var(--text-secondary);">
            <div>${maxValue.toFixed(1)}${unit}</div>
            <div style="position: absolute; top: ${chartAreaHeight / 2}px; width: 100%;">${((minValue + maxValue) / 2).toFixed(1)}${unit}</div>
            <div style="position: absolute; top: ${chartAreaHeight}px; width: 100%;">${minValue.toFixed(1)}${unit}</div>
        </div>
    `;
    
    // 차트 영역
    chartHTML += `<div style="margin-left: 50px; position: relative; height: ${chartHeight}px;">`;
    
    // 그리드 라인
    for (let i = 0; i <= 2; i++) {
        const y = padding + (chartAreaHeight / 2) * i;
        chartHTML += `<div style="position: absolute; left: 0; right: 0; top: ${y}px; height: 1px; background-color: var(--border-color); opacity: 0.3;"></div>`;
    }
    
    // 데이터 포인트와 라인
    const pointWidth = Math.max(20, (container.offsetWidth - 50) / dataPoints.length);
    const points = dataPoints.map((point, index) => {
        const x = index * pointWidth + pointWidth / 2;
        const normalizedValue = (point.value - minValue) / range;
        const y = padding + chartAreaHeight - (normalizedValue * chartAreaHeight);
        return { x, y, value: point.value, date: point.date };
    });
    
    // 라인 그리기
    if (points.length > 1) {
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
        chartHTML += `
            <svg style="position: absolute; left: 0; top: 0; width: 100%; height: ${chartHeight}px; pointer-events: none;">
                <path d="${path}" stroke="var(--accent-primary)" stroke-width="2" fill="none"/>
            </svg>
        `;
    }
    
    // 포인트 그리기
    points.forEach((point, index) => {
        const dateStr = App.formatDate(point.date);
        chartHTML += `
            <div style="position: absolute; left: ${point.x - 4}px; top: ${point.y - 4}px; width: 8px; height: 8px; background-color: var(--accent-primary); border-radius: 50%; cursor: pointer;" 
                 title="${dateStr}: ${point.value.toFixed(1)}${unit}"></div>
        `;
    });
    
    // X축 레이블 (날짜)
    if (dataPoints.length <= 10) {
        points.forEach((point, index) => {
            const date = new Date(point.date);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dateLabel = `${month}/${day}`;
            chartHTML += `
                <div style="position: absolute; left: ${point.x - 20}px; top: ${chartHeight - 15}px; width: 40px; font-size: 9px; color: var(--text-secondary); text-align: center; transform: rotate(-45deg); transform-origin: center;">
                    ${dateLabel}
                </div>
            `;
        });
    } else {
        // 데이터가 많으면 일부만 표시
        const step = Math.ceil(dataPoints.length / 5);
        for (let i = 0; i < points.length; i += step) {
            const point = points[i];
            const date = new Date(point.date);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dateLabel = `${month}/${day}`;
            chartHTML += `
                <div style="position: absolute; left: ${point.x - 20}px; top: ${chartHeight - 15}px; width: 40px; font-size: 9px; color: var(--text-secondary); text-align: center; transform: rotate(-45deg); transform-origin: center;">
                    ${dateLabel}
                </div>
            `;
        }
    }
    
    chartHTML += `</div></div>`;
    
    container.innerHTML = chartHTML;
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
            // 예약 날짜 우선 사용, 없으면 체크인 날짜 사용
            let date = '';
            if (attendance.booking && attendance.booking.startTime) {
                const bookingDate = new Date(attendance.booking.startTime);
                if (!isNaN(bookingDate.getTime())) {
                    const year = bookingDate.getFullYear();
                    const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
                    const day = String(bookingDate.getDate()).padStart(2, '0');
                    date = `${year}-${month}-${day}`;
                }
            }
            if (!date && attendance.date) {
                date = attendance.date;
            }
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
        // 체크인 기록이 선택 해제되면 날짜를 오늘로 리셋
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
        return;
    }
    
    try {
        const attendance = await App.api.get(`/attendance/${attendanceId}`);
        
        // 회원 정보 자동 입력
        if (attendance.member && attendance.member.id) {
            document.getElementById('log-member').value = attendance.member.id;
        }
        
        // 날짜 자동 입력 (예약 날짜를 우선 사용, 없으면 체크인 기록 날짜 사용)
        let dateValue = null;
        
        // 예약 정보가 있으면 예약 날짜(booking.startTime)를 우선 사용
        if (attendance.booking && attendance.booking.startTime) {
            const bookingDate = new Date(attendance.booking.startTime);
            if (!isNaN(bookingDate.getTime())) {
                const year = bookingDate.getFullYear();
                const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
                const day = String(bookingDate.getDate()).padStart(2, '0');
                dateValue = `${year}-${month}-${day}`;
            }
        }
        
        // 예약 날짜가 없으면 체크인 기록 날짜 사용
        if (!dateValue && attendance.date) {
            dateValue = attendance.date;
            // 만약 날짜가 다른 형식이면 변환
            if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    dateValue = `${year}-${month}-${day}`;
                }
            }
        }
        
        if (dateValue) {
            document.getElementById('log-date').value = dateValue;
        }
        
        // 예약 정보가 있으면 추가 정보 가져오기
        if (attendance.booking) {
            // 예약 정보는 이미 attendance 객체에 포함되어 있을 수 있음
            // 필요시 추가 정보 표시
        }
        
        const displayDate = dateValue || attendance.date || '-';
        App.showNotification('체크인 기록 정보가 자동으로 입력되었습니다. (예약 날짜: ' + displayDate + ')', 'success');
    } catch (error) {
        console.error('체크인 기록 정보 로드 실패:', error);
        App.showNotification('체크인 기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}
