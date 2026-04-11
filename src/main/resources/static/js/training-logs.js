// 훈련 기록 페이지 JavaScript

/** API 응답: 배열 또는 { content: [] } */
function normalizeMembersList(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.content)) return raw.content;
    return [];
}

/** 오늘 포함 최근 30일(시작~끝 YYYY-MM-DD) */
function getLast30DaysInclusiveRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    function fmt(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    return { startDate: fmt(start), endDate: fmt(end) };
}

/** 최근 30일 안에 훈련 기록이 한 건도 없는 활성 회원 (기록 입력 필요 후보) */
async function fetchMembersNeedingTrainingLogLast30Days() {
    const { startDate, endDate } = getLast30DaysInclusiveRange();
    const membersRaw = await App.api.get('/members');
    const members = normalizeMembersList(membersRaw);
    const logsRaw = await App.api.get(
        '/training-logs?startDate=' + encodeURIComponent(startDate) + '&endDate=' + encodeURIComponent(endDate)
    );
    const logs = normalizeMembersList(logsRaw);
    const withLog = new Set();
    logs.forEach(function (log) {
        if (log.member && log.member.id != null) withLog.add(Number(log.member.id));
    });
    return members.filter(function (m) {
        if (!m || m.id == null) return false;
        if (m.status && String(m.status).toUpperCase() !== 'ACTIVE') return false;
        return !withLog.has(Number(m.id));
    });
}

function fillLogMemberSelect(members) {
    const logSelect = document.getElementById('log-member');
    if (!logSelect) return;
    while (logSelect.children.length > 1) {
        logSelect.removeChild(logSelect.lastChild);
    }
    if (!members || members.length === 0) {
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '\uCD5C\uADFC 30\uC77C \uB0B4 \uD6C8\uB828 \uAE30\uB85D \uBBF8\uC785\uB825 \uD65C\uC131 \uD68C\uC6D0 \uC5C6\uC74C';
        emptyOpt.disabled = true;
        logSelect.appendChild(emptyOpt);
        return;
    }
    members.forEach(function (member) {
        logSelect.appendChild(new Option(member.name, member.id));
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadMembersForSelect();
    loadTrainingLogs();
    loadUnregisteredCount();
    loadCheckedInAttendances();
});

async function loadMembersForSelect() {
    try {
        const membersRaw = await App.api.get('/members');
        const allMembers = normalizeMembersList(membersRaw);
        var filterSelect = document.getElementById('filter-member');
        if (filterSelect) {
            while (filterSelect.children.length > 1) {
                filterSelect.removeChild(filterSelect.lastChild);
            }
            allMembers.forEach(function (m) {
                filterSelect.appendChild(new Option(m.name, m.id));
            });
        }
        var needing = await fetchMembersNeedingTrainingLogLast30Days();
        fillLogMemberSelect(needing);
        App.log('\uD68C\uC6D0 \uD544\uD130 \uBAA9\uB85D + \uAE30\uB85D \uCD94\uAC00\uC6A9(\uCD5C\uADFC 30\uC77C \uBBF8\uC785\uB825): ' + needing.length + '\uBA85');
    } catch (error) {
        App.err('\uD68C\uC6D0 \uBAA9\uB85D \uB85C\uB4DC \uC2E4\uD328:', error);
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
        App.err('훈련 기록 로드 실패:', error);
    }
}

// 최근 30일 기준 활성 회원 중 훈련 기록이 한 건도 없는 인원 수 (서버 /training-logs/unregistered-count 와 동일 기간)
async function loadUnregisteredCount() {
    const wrap = document.getElementById('training-logs-unregistered-wrap');
    if (!wrap) return;
    try {
        const range = getLast30DaysInclusiveRange();
        const res = await App.api.get(
            '/training-logs/unregistered-count?startDate=' + encodeURIComponent(range.startDate) +
            '&endDate=' + encodeURIComponent(range.endDate)
        );
        var n = res && res.unregisteredCount != null ? Number(res.unregisteredCount) : 0;
        if (isNaN(n)) n = 0;
        wrap.innerHTML = '<span class="training-logs-unregistered-text">\uCD5C\uADFC 30\uC77C \uAE30\uB85D \uD544\uC694 <strong>' + n + '</strong>\uBA85</span>';
    } catch (error) {
        App.err('\uAE30\uB85D \uD544\uC694 \uC778\uC6D0 \uC218 \uB85C\uB4DC \uC2E4\uD328:', error);
        wrap.innerHTML = '<span class="training-logs-unregistered-text">\uCD5C\uADFC 30\uC77C \uAE30\uB85D \uD544\uC694 -</span>';
    }
}

function renderTrainingLogs(logs) {
    const tbody = document.getElementById('training-logs-body');
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">기록이 없습니다.</td></tr>';
        return;
    }
    
    // 타입 한글 변환 함수
    const getTypeLabel = (type) => {
        if (!type) return '-';
        const typeMap = {
            'BATTING': '⚾ 타격',
            'PITCHING': '🎯 투구',
            'FITNESS': '💪 체력'
        };
        return typeMap[type] || type;
    };
    
    tbody.innerHTML = logs.map(log => {
        const memberName = log.member ? log.member.name : '-';
        const date = log.recordDate || log.date;
        const ballSpeed = log.ballSpeed || log.batSpeed;
        // 스윙속도: mph, 타구·구속: km/h
        const formatSwingMph = (speed) => speed ? (typeof speed === 'number' ? speed.toFixed(1) : speed) + ' mph' : '-';
        const formatSpeedKmh = (speed) => speed ? (typeof speed === 'number' ? speed.toFixed(1) : speed) + ' km/h' : '-';
        return `
        <tr>
            <td>${App.formatDate(date)}</td>
            <td>${memberName}</td>
            <td>${getTypeLabel(log.type)}</td>
            <td>${formatSwingMph(log.swingSpeed)}</td>
            <td>${formatSpeedKmh(ballSpeed)}</td>
            <td>${formatSpeedKmh(log.pitchSpeed)}</td>
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

async function openLogModal(id = null) {
    const modal = document.getElementById('log-modal');
    const title = document.getElementById('log-modal-title');
    const form = document.getElementById('log-form');
    
    if (id) {
        title.textContent = '\uD6C8\uB828 \uAE30\uB85D \uC218\uC815';
        document.getElementById('log-attendance').disabled = true;
        try {
            const allRaw = await App.api.get('/members');
            fillLogMemberSelect(normalizeMembersList(allRaw));
        } catch (e) {
            App.err('\uD68C\uC6D0 \uBAA9\uB85D \uB85C\uB4DC \uC2E4\uD328:', e);
        }
        await loadLogData(id);
    } else {
        title.textContent = '\uD6C8\uB828 \uAE30\uB85D \uCD94\uAC00';
        form.reset();
        
        // 중요: log-id를 명시적으로 초기화 (이전 수정 ID가 남아있으면 안됨)
        document.getElementById('log-id').value = '';
        
        // 체크인 기록을 선택하면 날짜가 자동으로 설정되므로, 기본값은 오늘 날짜
        // 하지만 체크인 기록을 선택하면 방문한 날짜로 자동 변경됨
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
        // 추가 모드에서는 체크인 기록 선택 활성화
        document.getElementById('log-attendance').disabled = false;
        document.getElementById('log-attendance').value = '';
        try {
            var needing = await fetchMembersNeedingTrainingLogLast30Days();
            fillLogMemberSelect(needing);
        } catch (e) {
            App.err('\uAE30\uB85D \uCD94\uAC00 \uB300\uC0C1 \uD68C\uC6D0 \uB85C\uB4DC \uC2E4\uD328:', e);
        }
        await loadCheckedInAttendances();
        
        // hidden input 초기화
        document.getElementById('log-member-value').value = '';
        
        // 모든 필드 초기화
        document.getElementById('log-swing-speed').value = '';
        document.getElementById('log-bat-speed').value = '';
        document.getElementById('log-pitch-speed').value = '';
        document.getElementById('log-coach').value = '';
        document.getElementById('log-notes').value = '';
    }
    
    App.Modal.open('log-modal');
}

// 회원 선택 시 코치 정보 자동 로드 (활성 이용권의 코치)
async function onMemberSelected() {
    let memberId = document.getElementById('log-member').value;
    // disabled된 경우 hidden input에서 가져오기
    if (!memberId) {
        memberId = document.getElementById('log-member-value').value;
    }
    
    const coachInput = document.getElementById('log-coach');
    
    if (!memberId) {
        coachInput.value = '';
        return;
    }
    
    // hidden input에도 값 설정
    document.getElementById('log-member-value').value = memberId;
    
    // 이미 코치 정보가 입력되어 있으면 (체크인 기록에서 가져온 경우) 변경하지 않음
    if (coachInput.value && coachInput.value !== '-') {
        return;
    }
    
    try {
        // 회원 정보 조회 (이용권 정보 포함)
        const member = await App.api.get(`/members/${memberId}`);
        
        // 활성 이용권에서 코치 정보 찾기
        let coachName = '';
        if (member.memberProducts && member.memberProducts.length > 0) {
            // 활성 상태인 이용권 중 코치가 있는 것 찾기
            const activeProduct = member.memberProducts.find(mp => 
                mp.status === 'ACTIVE' && (mp.coach || mp.coachName)
            );
            
            if (activeProduct) {
                // MemberProduct의 coach 객체 또는 coachName 사용
                if (activeProduct.coach && activeProduct.coach.name) {
                    coachName = activeProduct.coach.name;
                } else if (activeProduct.coachName) {
                    coachName = activeProduct.coachName;
                } else if (member.coach) {
                    // 이용권에 코치가 없으면 회원의 기본 코치 사용
                    coachName = member.coach.name || '';
                }
            } else if (member.coach) {
                // 활성 이용권이 없으면 회원의 기본 코치 사용
                coachName = member.coach.name || '';
            }
        } else if (member.coach) {
            // 이용권이 없으면 회원의 기본 코치 사용
            coachName = member.coach.name || '';
        }
        
        coachInput.value = coachName || '-';
    } catch (error) {
        App.err('회원 코치 정보 로드 실패:', error);
        coachInput.value = '-';
    }
}

async function loadLogData(id) {
    try {
        const log = await App.api.get(`/training-logs/${id}`);
        document.getElementById('log-id').value = log.id;
        const memberId = log.member ? log.member.id : '';
        document.getElementById('log-member').value = memberId;
        document.getElementById('log-member-value').value = memberId;
        document.getElementById('log-date').value = log.recordDate || log.date;
        
        // 모든 필드 입력
        const swingSpeedEl = document.getElementById('log-swing-speed');
        if (swingSpeedEl) {
            swingSpeedEl.value = log.swingSpeed || '';
        }
        document.getElementById('log-bat-speed').value = log.ballSpeed || log.batSpeed || '';
        document.getElementById('log-pitch-speed').value = log.pitchSpeed || '';
        document.getElementById('log-notes').value = log.notes || '';
        
        // 코치 정보 로드
        await onMemberSelected();
    } catch (error) {
        App.showNotification('기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveTrainingLog() {
    // disabled된 select의 값은 hidden input에서 가져오기
    let memberId = parseInt(document.getElementById('log-member').value);
    if (!memberId) {
        // hidden input에서도 확인
        memberId = parseInt(document.getElementById('log-member-value').value);
    }
    
    if (!memberId) {
        App.showNotification('회원을 선택해주세요.', 'danger');
        return;
    }
    
    // 입력된 값에 따라 타입 자동 결정
    const swingSpeed = document.getElementById('log-swing-speed').value;
    const batSpeed = document.getElementById('log-bat-speed').value;
    const pitchSpeed = document.getElementById('log-pitch-speed').value;
    
    // 최소한 하나의 기록은 있어야 함
    if (!swingSpeed && !batSpeed && !pitchSpeed) {
        App.showNotification('스윙속도, 타구속도, 구속 중 최소 하나는 입력해주세요.', 'warning');
        return;
    }
    
    // 타입 결정: 타구속도나 스윙속도가 있으면 타격, 구속이 있으면 투구
    let recordType = 'BATTING';
    let recordPart = 'BASEBALL_BATTING';
    
    if (pitchSpeed && !swingSpeed && !batSpeed) {
        // 구속만 있으면 투구
        recordType = 'PITCHING';
        recordPart = 'BASEBALL_PITCHING';
    } else if (swingSpeed || batSpeed) {
        // 스윙속도나 타구속도가 있으면 타격
        recordType = 'BATTING';
        recordPart = 'BASEBALL_BATTING';
    }
    
    const data = {
        member: { id: memberId },
        recordDate: document.getElementById('log-date').value,
        type: recordType,
        part: recordPart,
        swingCount: null,
        ballSpeed: null,
        launchAngle: null,
        hitDirection: null,
        contactRate: null,
        pitchSpeed: null,
        spinRate: null,
        pitchType: null,
        strikeRate: null,
        notes: document.getElementById('log-notes').value || null
    };
    
    // 스윙속도
    if (swingSpeed) {
        data.swingSpeed = parseFloat(swingSpeed);
    }
    
    // 타구속도
    if (batSpeed) {
        data.ballSpeed = parseFloat(batSpeed);
    }
    
    // 구속
    if (pitchSpeed) {
        data.pitchSpeed = parseFloat(pitchSpeed);
    }
    
    
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
        loadCheckedInAttendances();
        loadUnregisteredCount();
        loadMembersForSelect();
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
        loadCheckedInAttendances();
        loadUnregisteredCount();
        loadMembersForSelect();
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
        
        // 타입 한글 변환 함수
        const getTypeLabel = (type) => {
            if (!type) return '-';
            const typeMap = {
                'BATTING': '⚾ 타격',
                'PITCHING': '🎯 투구',
                'FITNESS': '💪 체력'
            };
            return typeMap[type] || type;
        };
        
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
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${getTypeLabel(log.type)}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">스윙속도</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.swingSpeed ? log.swingSpeed.toFixed(1) + ' mph' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">타구속도</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.ballSpeed ? log.ballSpeed.toFixed(1) + ' km/h' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">구속</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.pitchSpeed ? log.pitchSpeed.toFixed(1) + ' km/h' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">컨택률</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px;">${log.contactRate ? log.contactRate.toFixed(1) + '%' : '-'}</div>
            </div>
            <div style="background-color: var(--bg-hover); border-radius: 8px; padding: 16px; border: 1px solid var(--border-color);">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px;">메모</div>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 16px; word-break: break-word;">${log.notes || '-'}</div>
            </div>
        `;
        
        // 회원의 모든 훈련 기록 가져오기
        if (log.member && log.member.id) {
            // 회원 기본 정보도 함께 가져오기 (기본 기록 포함)
            const member = await App.api.get(`/members/${log.member.id}`);
            await loadMemberTrainingHistory(log.member.id, member);
        } else {
            // 회원 정보가 없으면 그래프 영역에 메시지 표시
            document.getElementById('chart-ball-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
            document.getElementById('chart-pitch-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
            document.getElementById('chart-swing-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
            document.getElementById('chart-contact-rate').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">회원 정보가 없습니다.</p>';
        }
        
        App.Modal.open('log-detail-modal');
    } catch (error) {
        App.err('훈련 기록 상세보기 로드 실패:', error);
        App.showNotification('기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원의 훈련 기록 추이 로드 및 그래프 표시
async function loadMemberTrainingHistory(memberId, member = null) {
    try {
        // 회원 정보가 없으면 가져오기
        if (!member) {
            member = await App.api.get(`/members/${memberId}`);
        }
        
        const logs = await App.api.get(`/training-logs?memberId=${memberId}`);
        
        // 회원 기본 기록을 첫 번째 데이터 포인트로 추가 (없어도 0으로 시작)
        const baseRecord = {
            recordDate: member.joinDate || member.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            swingSpeed: member.swingSpeed || 0,  // 회원 기본 기록 (없으면 0)
            ballSpeed: member.exitVelocity || 0,  // exitVelocity를 ballSpeed로 사용
            pitchSpeed: member.pitchingSpeed || 0,  // 회원 기본 기록 (없으면 0)
            contactRate: null  // 기본 기록에는 없음
        };
        
        // 기본 기록이 있는지 확인 (0이 아닌 값이 있는 경우)
        const hasBaseRecord = (baseRecord.swingSpeed > 0 || baseRecord.ballSpeed > 0 || baseRecord.pitchSpeed > 0);
        
        // 기본 기록을 항상 첫 번째로 추가 (0이어도 시작점으로 사용)
        const allRecords = [baseRecord, ...logs];
        
        // 날짜순으로 정렬
        allRecords.sort((a, b) => {
            const dateA = new Date(a.recordDate || a.date);
            const dateB = new Date(b.recordDate || b.date);
            return dateA - dateB;
        });
        
        // 스윙속도 추이 그래프 (기본 기록 포함, 0부터 시작)
        renderTrainingChart('chart-swing-speed', allRecords, 'swingSpeed', '스윙속도 (mph)', 'mph', true);
        
        // 타구속도 추이 그래프 (기본 기록 포함, 0부터 시작)
        renderTrainingChart('chart-ball-speed', allRecords, 'ballSpeed', '타구속도 (km/h)', 'km/h', true);
        
        // 구속 추이 그래프 (기본 기록 포함, 0부터 시작)
        renderTrainingChart('chart-pitch-speed', allRecords, 'pitchSpeed', '구속 (km/h)', 'km/h', true);
        
        // 컨택률 추이 그래프 (기본 기록 없음 - 훈련 기록만)
        renderTrainingChart('chart-contact-rate', logs, 'contactRate', '컨택률 (%)', '%', false);
        
    } catch (error) {
        App.err('회원 훈련 기록 추이 로드 실패:', error);
        document.getElementById('chart-swing-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
        document.getElementById('chart-ball-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
        document.getElementById('chart-pitch-speed').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
        document.getElementById('chart-contact-rate').innerHTML = '<p style="color: var(--text-muted); text-align: center; line-height: 168px;">데이터를 불러올 수 없습니다.</p>';
    }
}

// 훈련 기록 추이 그래프 렌더링
function renderTrainingChart(containerId, logs, fieldName, title, unit, hasBaseRecord = false) {
    const container = document.getElementById(containerId);
    
    // 해당 필드가 있는 기록만 필터링 (0도 포함)
    const dataPoints = logs
        .filter(log => {
            const value = log[fieldName];
            return value != null && value !== '' && !isNaN(value) && value >= 0;
        })
        .map((log, index) => ({
            date: log.recordDate || log.date,
            value: parseFloat(log[fieldName]),
            isBaseRecord: hasBaseRecord && index === 0  // 첫 번째가 기본 기록인지 표시
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
        // 기본 기록은 다른 색상으로 표시
        const isBaseRecord = point.isBaseRecord;
        const pointColor = isBaseRecord ? '#28a745' : 'var(--accent-primary)';
        const pointSize = isBaseRecord ? 10 : 8;
        const pointLabel = isBaseRecord ? ' (기본 기록)' : '';
        chartHTML += `
            <div style="position: absolute; left: ${point.x - pointSize/2}px; top: ${point.y - pointSize/2}px; width: ${pointSize}px; height: ${pointSize}px; background-color: ${pointColor}; border-radius: 50%; cursor: pointer; border: ${isBaseRecord ? '2px solid white' : 'none'};" 
                 title="${dateStr}: ${point.value.toFixed(1)}${unit}${pointLabel}"></div>
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

// 체크인된 출석 기록 목록 로드 (최근 30일 예약·체크인 구간만)
async function loadCheckedInAttendances() {
    try {
        const range = getLast30DaysInclusiveRange();
        const attendancesRaw = await App.api.get(
            '/attendance/checked-in?startDate=' + encodeURIComponent(range.startDate) +
            '&endDate=' + encodeURIComponent(range.endDate)
        );
        const attendances = Array.isArray(attendancesRaw) ? attendancesRaw : [];
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
        App.err('체크인 기록 로드 실패:', error);
    }
}

// 체크인 기록 선택 시 자동으로 정보 입력
async function loadAttendanceData(attendanceId) {
    const memberSelect = document.getElementById('log-member');
    const dateInput = document.getElementById('log-date');
    
    if (!attendanceId) {
        // 체크인 기록이 선택 해제되면 날짜를 오늘로 리셋
        dateInput.value = new Date().toISOString().split('T')[0];
        dateInput.disabled = false;
        dateInput.style.opacity = '1';
        dateInput.style.cursor = 'pointer';
        // hidden input 초기화
        document.getElementById('log-member-value').value = '';
        // 회원 선택이 해제되면 기록 타입 섹션도 숨김
        if (!memberSelect.value) {
            var rts = document.getElementById('record-type-section');
            if (rts) rts.style.display = 'none';
            var bs = document.getElementById('batter-section');
            if (bs) bs.style.display = 'none';
            var ps = document.getElementById('pitcher-section');
            if (ps) ps.style.display = 'none';
        }
        return;
    }
    
    try {
        const attendance = await App.api.get(`/attendance/${attendanceId}`);
        
        // 중요: 체크인 기록에서 자동 입력할 때도 log-id는 비워야 함 (새 기록 추가)
        document.getElementById('log-id').value = '';
        
        // 회원 정보 자동 입력 (비활성화하지 않음)
        if (attendance.member && attendance.member.id) {
            var mid = String(attendance.member.id);
            var exists = Array.from(memberSelect.options).some(function (o) { return o.value === mid; });
            if (!exists) {
                memberSelect.appendChild(new Option(attendance.member.name || ('\uD68C\uC6D0 #' + mid), mid));
            }
            memberSelect.value = mid;
            // hidden input에도 값 설정
            document.getElementById('log-member-value').value = attendance.member.id;
            // 회원 필드는 활성화 상태 유지 (사용자가 변경 가능)
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
            dateInput.value = dateValue;
            // 날짜는 활성화 상태 유지 (사용자가 변경 가능)
        }
        
        // 코치 정보 표시 (우선순위: 이용권 코치 -> 예약 코치 -> 회원 기본 코치)
        let coachInfo = '';
        let productInfo = '';
        
        // 1순위: 이용권(MemberProduct)에 지정된 코치
        if (attendance.booking && attendance.booking.memberProduct) {
            const memberProduct = attendance.booking.memberProduct;
            
            // 이용권 정보 표시
            if (memberProduct.product) {
                productInfo = memberProduct.product.name || '';
            }
            
            // 이용권에 지정된 코치
            if (memberProduct.coach) {
                coachInfo = memberProduct.coach.name || '';
                let displayText = coachInfo;
                if (productInfo) {
                    displayText += ` (이용권: ${productInfo})`;
                }
                document.getElementById('log-coach').value = displayText;
            }
            // 이용권에 코치가 없으면 예약 코치 확인
            else if (attendance.booking.coach) {
                coachInfo = attendance.booking.coach.name || '';
                let displayText = coachInfo;
                if (productInfo) {
                    displayText += ` (이용권: ${productInfo})`;
                }
                document.getElementById('log-coach').value = displayText;
            }
            // 둘 다 없으면 회원 기본 코치
            else {
                await onMemberSelected();
                coachInfo = document.getElementById('log-coach').value || '';
                if (coachInfo && coachInfo !== '-' && productInfo) {
                    document.getElementById('log-coach').value = coachInfo + ` (이용권: ${productInfo})`;
                }
            }
        }
        // 2순위: 예약에 지정된 코치 (이용권 정보 없음)
        else if (attendance.booking && attendance.booking.coach) {
            coachInfo = attendance.booking.coach.name || '';
            document.getElementById('log-coach').value = coachInfo;
        }
        // 3순위: 회원 선택 시 로드된 코치 정보 (이용권 또는 회원 기본 코치)
        else {
            await onMemberSelected();
            coachInfo = document.getElementById('log-coach').value || '';
        }
        
        const displayDate = dateValue || attendance.date || '-';
        let notificationMsg = '체크인 기록 정보가 자동으로 입력되었습니다. (예약 날짜: ' + displayDate + ')';
        if (coachInfo && coachInfo !== '-') {
            notificationMsg += ', 코치: ' + coachInfo;
        }
        if (productInfo) {
            notificationMsg += ', 이용권: ' + productInfo;
        }
        App.showNotification(notificationMsg, 'success');
    } catch (error) {
        App.err('체크인 기록 정보 로드 실패:', error);
        App.showNotification('체크인 기록 정보를 불러오는데 실패했습니다.', 'danger');
    }
}
