// 야구 기록 관리 JavaScript

let members = [];

document.addEventListener('DOMContentLoaded', function() {
    loadMembers();
    loadRecords();
    
    // 폼 제출 이벤트
    document.getElementById('record-form').addEventListener('submit', handleFormSubmit);
});

// 회원 목록 로드
async function loadMembers() {
    try {
        members = await App.api.get('/members');
        
        // 필터 셀렉트 박스
        const filterSelect = document.getElementById('filter-member');
        filterSelect.innerHTML = '<option value="">전체</option>';
        
        // 모달 셀렉트 박스
        const modalSelect = document.getElementById('record-member');
        modalSelect.innerHTML = '<option value="">선택하세요</option>';
        
        members.forEach(member => {
            const option = `<option value="${member.id}">${member.name} (${member.memberNumber})</option>`;
            filterSelect.innerHTML += option;
            modalSelect.innerHTML += option;
        });
    } catch (error) {
        App.err('회원 목록 로드 실패:', error);
    }
}

// 기록 목록 로드
async function loadRecords() {
    try {
        const memberId = document.getElementById('filter-member').value;
        const position = document.getElementById('filter-position').value;
        const startDate = document.getElementById('filter-start-date').value;
        const endDate = document.getElementById('filter-end-date').value;
        
        let url = '/baseball-records';
        const params = [];
        
        if (memberId) params.push(`memberId=${memberId}`);
        if (position) params.push(`position=${position}`);
        if (startDate) params.push(`startDate=${startDate}`);
        if (endDate) params.push(`endDate=${endDate}`);
        
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        
        const records = await App.api.get(url);
        renderRecordsTable(records);
    } catch (error) {
        App.err('기록 목록 로드 실패:', error);
    }
}

// 기록 테이블 렌더링
function renderRecordsTable(records) {
    const tbody = document.getElementById('records-table-body');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">기록이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = records.map(record => {
        const battingAvg = record.battingAverage != null ? record.battingAverage.toFixed(3) : '-';
        const era = record.earnedRunAverage != null ? record.earnedRunAverage.toFixed(2) : '-';
        
        return `
            <tr>
                <td>${App.formatDate(record.recordDate)}</td>
                <td>${record.member?.name || '-'}</td>
                <td>${formatPosition(record.position)}</td>
                <td>${record.atBats || 0} / ${record.hits || 0}</td>
                <td>${battingAvg}</td>
                <td>${record.inningsPitched || 0} / ${record.earnedRuns || 0}</td>
                <td>${era}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editRecord(${record.id})">수정</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRecord(${record.id})">삭제</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 포지션 한글 변환
function formatPosition(position) {
    const positions = {
        'PITCHER': '투수',
        'CATCHER': '포수',
        'FIRST_BASE': '1루수',
        'SECOND_BASE': '2루수',
        'THIRD_BASE': '3루수',
        'SHORTSTOP': '유격수',
        'LEFT_FIELD': '좌익수',
        'CENTER_FIELD': '중견수',
        'RIGHT_FIELD': '우익수',
        'DESIGNATED_HITTER': '지명타자'
    };
    return positions[position] || position;
}

// 모달 열기
function openRecordModal() {
    document.getElementById('modal-title').textContent = '야구 기록 등록';
    document.getElementById('record-form').reset();
    document.getElementById('record-id').value = '';
    document.getElementById('record-date').value = new Date().toISOString().split('T')[0];
    App.Modal.open('record-modal');
}

// 모달 닫기 (하위 호환성 유지)
function closeRecordModal() {
    App.Modal.close('record-modal');
}

// 기록 수정
async function editRecord(id) {
    try {
        const record = await App.api.get(`/baseball-records/${id}`);
        
        document.getElementById('modal-title').textContent = '야구 기록 수정';
        document.getElementById('record-id').value = record.id;
        document.getElementById('record-member').value = record.member?.id || '';
        document.getElementById('record-date').value = record.recordDate;
        document.getElementById('record-position').value = record.position;
        
        // 타격 기록
        document.getElementById('record-at-bats').value = record.atBats || '';
        document.getElementById('record-hits').value = record.hits || '';
        document.getElementById('record-home-runs').value = record.homeRuns || '';
        document.getElementById('record-rbis').value = record.runsBattedIn || '';
        document.getElementById('record-strikeouts').value = record.strikeouts || '';
        document.getElementById('record-walks').value = record.walks || '';
        
        // 투구 기록
        document.getElementById('record-innings').value = record.inningsPitched || '';
        document.getElementById('record-earned-runs').value = record.earnedRuns || '';
        document.getElementById('record-strikeouts-pitched').value = record.strikeoutsPitched || '';
        document.getElementById('record-walks-pitched').value = record.walksPitched || '';
        document.getElementById('record-hits-allowed').value = record.hitsAllowed || '';
        
        document.getElementById('record-notes').value = record.notes || '';
        
        App.Modal.open('record-modal');
    } catch (error) {
        App.err('기록 조회 실패:', error);
        alert('기록을 불러오는 데 실패했습니다');
    }
}

// 폼 제출 처리
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('record-id').value;
    const memberId = document.getElementById('record-member').value;
    
    if (!memberId) {
        alert('회원을 선택해주세요');
        return;
    }
    
    const data = {
        recordDate: document.getElementById('record-date').value,
        position: document.getElementById('record-position').value,
        atBats: parseInt(document.getElementById('record-at-bats').value) || null,
        hits: parseInt(document.getElementById('record-hits').value) || null,
        homeRuns: parseInt(document.getElementById('record-home-runs').value) || null,
        runsBattedIn: parseInt(document.getElementById('record-rbis').value) || null,
        strikeouts: parseInt(document.getElementById('record-strikeouts').value) || null,
        walks: parseInt(document.getElementById('record-walks').value) || null,
        inningsPitched: parseFloat(document.getElementById('record-innings').value) || null,
        earnedRuns: parseInt(document.getElementById('record-earned-runs').value) || null,
        strikeoutsPitched: parseInt(document.getElementById('record-strikeouts-pitched').value) || null,
        walksPitched: parseInt(document.getElementById('record-walks-pitched').value) || null,
        hitsAllowed: parseInt(document.getElementById('record-hits-allowed').value) || null,
        notes: document.getElementById('record-notes').value || null
    };
    
    try {
        if (id) {
            // 수정
            await App.api.put(`/baseball-records/${id}`, data);
            alert('기록이 수정되었습니다');
        } else {
            // 등록
            await App.api.post(`/baseball-records/member/${memberId}`, data);
            alert('기록이 등록되었습니다');
        }
        
        App.Modal.close('record-modal');
        loadRecords();
    } catch (error) {
        App.err('기록 저장 실패:', error);
        alert('기록 저장에 실패했습니다');
    }
}

// 기록 삭제
async function deleteRecord(id) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        await App.api.delete(`/baseball-records/${id}`);
        alert('기록이 삭제되었습니다');
        loadRecords();
    } catch (error) {
        App.err('기록 삭제 실패:', error);
        alert('기록 삭제에 실패했습니다');
    }
}
