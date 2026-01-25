// 설정 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    // loadUsers(); // 사용자 관리 기능 비활성화 (미구현)
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
        console.error('설정 로드 실패:', error);
        // 에러 발생 시 기본값 설정
        document.getElementById('setting-center-name-saha').value = '';
        document.getElementById('setting-center-name-yeonsan').value = '';
        document.getElementById('setting-phone-saha').value = '';
        document.getElementById('setting-phone-yeonsan').value = '';
        document.getElementById('setting-address-saha').value = '';
        document.getElementById('setting-address-yeonsan').value = '';
        document.getElementById('setting-operating-hours').value = '';
        
        // 알림은 표시하지 않음 (개발 중이므로)
        console.warn('설정을 불러올 수 없어 기본값을 사용합니다.');
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
        console.error('설정 저장 실패:', error);
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

async function loadUsers() {
    try {
        const users = await App.api.get('/users');
        renderUsersTable(users);
    } catch (error) {
        console.error('사용자 목록 로드 실패:', error);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">사용자가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td><span class="badge badge-info">${getRoleText(user.role)}</span></td>
            <td>${user.permissions?.join(', ') || '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editUser(${user.id})">수정</button>
            </td>
        </tr>
    `).join('');
}

function getRoleText(role) {
    const map = {
        'Admin': '관리자',
        'Manager': '매니저',
        'Coach': '코치',
        'Front': '데스크'
    };
    return map[role] || role;
}

function editUser(id) {
    App.showNotification('사용자 수정 기능은 준비 중입니다.', 'info');
}
