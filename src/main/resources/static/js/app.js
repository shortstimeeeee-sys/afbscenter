// API 기본 URL
const API_BASE = '/api';

// 페이지 전환
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        switchPage(page);
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`).classList.add('active');
    
    if (page === 'members') {
        loadMembers();
    } else if (page === 'records') {
        loadMembersForSelect();
    }
}

// 회원 관리
async function loadMembers() {
    try {
        const response = await fetch(`${API_BASE}/members`);
        const members = await response.json();
        renderMembers(members);
    } catch (error) {
        console.error('회원 로드 실패:', error);
        alert('회원 목록을 불러오는데 실패했습니다.');
    }
}

function renderMembers(members) {
    const tbody = document.getElementById('members-table-body');
    tbody.innerHTML = members.map(member => `
        <tr>
            <td>${member.id}</td>
            <td>${member.name}</td>
            <td>${member.phoneNumber}</td>
            <td>${member.birthDate}</td>
            <td>${member.gender === 'MALE' ? '남성' : '여성'}</td>
            <td>${member.height}</td>
            <td>${member.weight}</td>
            <td>${member.address || '-'}</td>
            <td>
                <button class="btn btn-secondary" onclick="editMember(${member.id})">수정</button>
                <button class="btn btn-danger" onclick="deleteMember(${member.id})">삭제</button>
            </td>
        </tr>
    `).join('');
}

async function searchMembers() {
    const query = document.getElementById('member-search').value;
    if (!query) {
        loadMembers();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/members/search?name=${encodeURIComponent(query)}`);
        const members = await response.json();
        renderMembers(members);
    } catch (error) {
        console.error('검색 실패:', error);
    }
}

function showAddMemberForm() {
    document.getElementById('member-modal-title').textContent = '회원 추가';
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    document.getElementById('member-modal').classList.add('active');
}

async function editMember(id) {
    try {
        const response = await fetch(`${API_BASE}/members/${id}`);
        const member = await response.json();
        
        document.getElementById('member-modal-title').textContent = '회원 수정';
        document.getElementById('member-id').value = member.id;
        document.getElementById('member-name').value = member.name;
        document.getElementById('member-phone').value = member.phoneNumber;
        document.getElementById('member-birth').value = member.birthDate;
        document.getElementById('member-gender').value = member.gender;
        document.getElementById('member-height').value = member.height;
        document.getElementById('member-weight').value = member.weight;
        document.getElementById('member-address').value = member.address || '';
        document.getElementById('member-memo').value = member.memo || '';
        
        document.getElementById('member-modal').classList.add('active');
    } catch (error) {
        console.error('회원 로드 실패:', error);
        alert('회원 정보를 불러오는데 실패했습니다.');
    }
}

async function saveMember(event) {
    event.preventDefault();
    
    const id = document.getElementById('member-id').value;
    const member = {
        name: document.getElementById('member-name').value,
        phoneNumber: document.getElementById('member-phone').value,
        birthDate: document.getElementById('member-birth').value,
        gender: document.getElementById('member-gender').value,
        height: parseInt(document.getElementById('member-height').value),
        weight: parseInt(document.getElementById('member-weight').value),
        address: document.getElementById('member-address').value,
        memo: document.getElementById('member-memo').value
    };
    
    try {
        const url = id ? `${API_BASE}/members/${id}` : `${API_BASE}/members`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(member)
        });
        
        if (response.ok) {
            closeMemberModal();
            loadMembers();
            alert(id ? '회원이 수정되었습니다.' : '회원이 추가되었습니다.');
        } else {
            alert('저장에 실패했습니다.');
        }
    } catch (error) {
        console.error('저장 실패:', error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

async function deleteMember(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/members/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadMembers();
            alert('회원이 삭제되었습니다.');
        } else {
            alert('삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('삭제 실패:', error);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

function closeMemberModal() {
    document.getElementById('member-modal').classList.remove('active');
}

// 야구 기록 관리
let currentMemberId = null;

async function loadMembersForSelect() {
    try {
        const response = await fetch(`${API_BASE}/members`);
        const members = await response.json();
        
        const memberSelect = document.getElementById('member-select');
        const recordMemberSelect = document.getElementById('record-member');
        
        memberSelect.innerHTML = '<option value="">회원 선택...</option>';
        recordMemberSelect.innerHTML = '<option value="">선택...</option>';
        
        members.forEach(member => {
            const option1 = new Option(member.name, member.id);
            const option2 = new Option(member.name, member.id);
            memberSelect.appendChild(option1);
            recordMemberSelect.appendChild(option2);
        });
    } catch (error) {
        console.error('회원 로드 실패:', error);
    }
}

async function loadRecords() {
    const memberId = document.getElementById('member-select').value;
    if (!memberId) {
        document.getElementById('records-table-body').innerHTML = '';
        return;
    }
    
    currentMemberId = memberId;
    
    try {
        const response = await fetch(`${API_BASE}/baseball-records/member/${memberId}`);
        const records = await response.json();
        renderRecords(records);
    } catch (error) {
        console.error('기록 로드 실패:', error);
        alert('기록 목록을 불러오는데 실패했습니다.');
    }
}

function renderRecords(records) {
    const tbody = document.getElementById('records-table-body');
    tbody.innerHTML = records.map(record => {
        const battingAvg = record.battingAverage ? record.battingAverage.toFixed(3) : '-';
        return `
            <tr>
                <td>${record.recordDate}</td>
                <td>${getPositionName(record.position)}</td>
                <td>${record.atBats || '-'}</td>
                <td>${record.hits || '-'}</td>
                <td>${record.homeRuns || '-'}</td>
                <td>${record.runsBattedIn || '-'}</td>
                <td>${battingAvg}</td>
                <td>
                    <button class="btn btn-secondary" onclick="editRecord(${record.id})">수정</button>
                    <button class="btn btn-danger" onclick="deleteRecord(${record.id})">삭제</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getPositionName(position) {
    const names = {
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
    return names[position] || position;
}

function showAddRecordForm() {
    document.getElementById('record-modal-title').textContent = '기록 추가';
    document.getElementById('record-form').reset();
    document.getElementById('record-id').value = '';
    document.getElementById('record-date').value = new Date().toISOString().split('T')[0];
    if (currentMemberId) {
        document.getElementById('record-member').value = currentMemberId;
    }
    document.getElementById('record-modal').classList.add('active');
}

async function editRecord(id) {
    try {
        const response = await fetch(`${API_BASE}/baseball-records/${id}`);
        const record = await response.json();
        
        document.getElementById('record-modal-title').textContent = '기록 수정';
        document.getElementById('record-id').value = record.id;
        document.getElementById('record-member').value = record.member.id;
        document.getElementById('record-date').value = record.recordDate;
        document.getElementById('record-position').value = record.position;
        document.getElementById('record-atbats').value = record.atBats || '';
        document.getElementById('record-hits').value = record.hits || '';
        document.getElementById('record-homeruns').value = record.homeRuns || '';
        document.getElementById('record-rbi').value = record.runsBattedIn || '';
        document.getElementById('record-strikeouts').value = record.strikeouts || '';
        document.getElementById('record-walks').value = record.walks || '';
        document.getElementById('record-innings').value = record.inningsPitched || '';
        document.getElementById('record-earnedruns').value = record.earnedRuns || '';
        document.getElementById('record-strikeoutspitched').value = record.strikeoutsPitched || '';
        document.getElementById('record-notes').value = record.notes || '';
        
        document.getElementById('record-modal').classList.add('active');
    } catch (error) {
        console.error('기록 로드 실패:', error);
        alert('기록 정보를 불러오는데 실패했습니다.');
    }
}

async function saveRecord(event) {
    event.preventDefault();
    
    const id = document.getElementById('record-id').value;
    const memberId = document.getElementById('record-member').value;
    const record = {
        recordDate: document.getElementById('record-date').value,
        position: document.getElementById('record-position').value,
        atBats: parseInt(document.getElementById('record-atbats').value) || null,
        hits: parseInt(document.getElementById('record-hits').value) || null,
        homeRuns: parseInt(document.getElementById('record-homeruns').value) || null,
        runsBattedIn: parseInt(document.getElementById('record-rbi').value) || null,
        strikeouts: parseInt(document.getElementById('record-strikeouts').value) || null,
        walks: parseInt(document.getElementById('record-walks').value) || null,
        inningsPitched: parseFloat(document.getElementById('record-innings').value) || null,
        earnedRuns: parseInt(document.getElementById('record-earnedruns').value) || null,
        strikeoutsPitched: parseInt(document.getElementById('record-strikeoutspitched').value) || null,
        notes: document.getElementById('record-notes').value
    };
    
    try {
        let response;
        if (id) {
            response = await fetch(`${API_BASE}/baseball-records/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(record)
            });
        } else {
            response = await fetch(`${API_BASE}/baseball-records/member/${memberId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(record)
            });
        }
        
        if (response.ok) {
            closeRecordModal();
            loadRecords();
            alert(id ? '기록이 수정되었습니다.' : '기록이 추가되었습니다.');
        } else {
            alert('저장에 실패했습니다.');
        }
    } catch (error) {
        console.error('저장 실패:', error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

async function deleteRecord(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/baseball-records/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadRecords();
            alert('기록이 삭제되었습니다.');
        } else {
            alert('삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('삭제 실패:', error);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

function closeRecordModal() {
    document.getElementById('record-modal').classList.remove('active');
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadMembers();
});
