// 사용자 관리 페이지 JavaScript

let allUsers = [];
let filteredUsers = [];
let allCoaches = [];

// 페이지 로드 시 사용자 목록 로드
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    loadCoaches();
    
    // 검색 기능
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyFilters();
        });
    }
    
    // 필터 변경 시 자동 적용
    const roleFilter = document.getElementById('filter-role');
    const activeFilter = document.getElementById('filter-active');
    if (roleFilter) {
        roleFilter.addEventListener('change', applyFilters);
    }
    if (activeFilter) {
        activeFilter.addEventListener('change', applyFilters);
    }
});

// 코치 목록 로드
async function loadCoaches() {
    try {
        allCoaches = await App.api.get('/coaches');
    } catch (error) {
        console.error('코치 목록 로드 실패:', error);
    }
}

// 사용자 목록 로드
async function loadUsers() {
    try {
        const users = await App.api.get('/users');
        console.log('=== 전체 사용자 목록 로드 ===');
        console.log('전체 사용자 수:', users.length);
        users.forEach(user => {
            console.log(`  - ID: ${user.id}, 사용자명: ${user.username}, 이름: ${user.name}, approved: ${user.approved}, active: ${user.active}`);
        });
        allUsers = users;
        updatePendingCount();
        applyFilters();
    } catch (error) {
        console.error('사용자 목록 로드 실패:', error);
        App.showNotification('사용자 목록을 불러오는데 실패했습니다.', 'error');
    }
}

// 승인 대기 사용자 수 업데이트
function updatePendingCount() {
    const pendingCount = allUsers.filter(user => 
        user.approved === false && user.active === true
    ).length;
    const countElement = document.getElementById('pending-count');
    if (countElement) {
        countElement.textContent = pendingCount;
        if (pendingCount > 0) {
            countElement.parentElement.style.display = 'inline-block';
        }
    }
}

// 승인 대기 사용자 목록 표시
async function showPendingUsers() {
    try {
        console.log('=== 승인 대기 사용자 조회 시작 ===');
        const pendingUsers = await App.api.get('/users/pending');
        console.log('승인 대기 사용자 응답:', pendingUsers);
        console.log('승인 대기 사용자 수:', pendingUsers.length);
        
        if (pendingUsers.length === 0) {
            console.log('승인 대기 사용자가 없습니다.');
            // 전체 사용자 목록에서 승인 대기 사용자 확인
            console.log('전체 사용자 목록 확인:', allUsers);
            const pendingInAll = allUsers.filter(user => user.approved === false && user.active === true);
            console.log('전체 목록에서 승인 대기 사용자:', pendingInAll);
            
            App.showNotification('승인 대기 중인 사용자가 없습니다.', 'info');
            return;
        }
        
        // 승인 대기 사용자만 필터링하여 표시
        filteredUsers = pendingUsers;
        renderUsersTable();
        App.showNotification(`승인 대기 사용자 ${pendingUsers.length}명이 표시됩니다.`, 'info');
    } catch (error) {
        console.error('승인 대기 사용자 로드 실패:', error);
        App.showNotification('승인 대기 사용자 목록을 불러오는데 실패했습니다.', 'error');
    }
}

// 필터 적용
function applyFilters() {
    const roleFilter = document.getElementById('filter-role').value;
    const activeFilter = document.getElementById('filter-active').value;
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    
    filteredUsers = allUsers.filter(user => {
        // 권한 필터
        if (roleFilter && user.role !== roleFilter) {
            return false;
        }
        
        // 활성 상태 필터
        if (activeFilter !== '') {
            const isActive = activeFilter === 'true';
            if (user.active !== isActive) {
                return false;
            }
        }
        
        // 검색어 필터
        if (searchTerm) {
            const username = (user.username || '').toLowerCase();
            const name = (user.name || '').toLowerCase();
            if (!username.includes(searchTerm) && !name.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
    
    renderUsersTable();
}

// 사용자 테이블 렌더링
function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
                                    사용자가 없습니다.
                                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => {
        const roleNames = {
            'ADMIN': '관리자',
            'MANAGER': '매니저',
            'COACH': '코치',
            'FRONT': '데스크'
        };
        
        const roleBadges = {
            'ADMIN': '<span class="badge badge-danger">관리자</span>',
            'MANAGER': '<span class="badge badge-warning">매니저</span>',
            'COACH': '<span class="badge badge-info">코치</span>',
            'FRONT': '<span class="badge badge-secondary">데스크</span>'
        };
        
        const lastLogin = user.lastLogin 
            ? new Date(user.lastLogin).toLocaleString('ko-KR')
            : '-';
        
        // 모든 사용자에 대해 수정 버튼 활성화 (관리자 포함)
        return `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.name || '-'}</td>
                <td>${roleBadges[user.role] || user.role}</td>
                <td>${user.phoneNumber || '-'}</td>
                <td>
                    ${user.active 
                        ? '<span class="badge badge-success">활성</span>' 
                        : '<span class="badge badge-danger">비활성</span>'}
                </td>
                <td>
                    ${user.approved === false && user.active === true 
                        ? '<span class="badge badge-warning">승인 대기</span>' 
                        : user.approved 
                            ? '<span class="badge badge-success">승인됨</span>' 
                            : '<span class="badge badge-secondary">-</span>'}
                </td>
                <td>${lastLogin}</td>
                <td>
                    <div class="action-buttons">
                        ${user.approved === false && user.active === true ? `
                            <button class="btn btn-sm btn-success" onclick="approveUser(${user.id})" type="button">승인</button>
                            <button class="btn btn-sm btn-danger" onclick="rejectUser(${user.id})" type="button">거부</button>
                        ` : `
                            <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})" data-user-id="${user.id}" type="button">수정</button>
                            <button class="btn btn-sm btn-secondary" onclick="openPasswordModal(${user.id})" type="button">비밀번호</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" ${!user.active ? 'disabled' : ''} type="button">삭제</button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // 이벤트 리스너 재등록 (동적으로 생성된 버튼에 대해)
    setTimeout(() => {
        const editButtons = document.querySelectorAll('.action-buttons .btn-primary[data-user-id]');
        editButtons.forEach(btn => {
            const userId = btn.getAttribute('data-user-id');
            // 기존 onclick이 있으면 제거하고 새로 등록
            btn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('수정 버튼 클릭 (이벤트 리스너):', userId);
                editUser(parseInt(userId));
            };
        });
    }, 100);
}

// 코치 선택 UI 업데이트
function updateCoachSelection() {
    const role = document.getElementById('user-role').value;
    const coachGroup = document.getElementById('coach-selection-group');
    const coachSelect = document.getElementById('user-coach');
    
    if (role === 'COACH') {
        coachGroup.style.display = 'block';
        // 코치 목록 채우기
        coachSelect.innerHTML = '<option value="">코치 선택 안함</option>';
        allCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            coachSelect.appendChild(option);
        });
    } else {
        coachGroup.style.display = 'none';
        coachSelect.value = '';
    }
}

// 사용자 추가 모달 열기
function openUserModal(userId = null) {
    console.log('openUserModal 호출, userId:', userId);
    const modal = document.getElementById('userModal');
    if (!modal) {
        console.error('userModal 요소를 찾을 수 없습니다.');
        App.showNotification('모달을 찾을 수 없습니다.', 'error');
        return;
    }
    
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    const passwordInput = document.getElementById('user-password');
    const passwordLabel = document.getElementById('password-label');
    const passwordHint = document.getElementById('password-hint');
    
    form.reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-active').checked = true;
    document.getElementById('user-approved').checked = true;
    document.getElementById('coach-selection-group').style.display = 'none';
    
    if (userId) {
        // 수정 모드
        console.log('수정 모드, userId:', userId, 'allUsers:', allUsers);
        const user = allUsers.find(u => u.id == userId);
        if (!user) {
            console.error('사용자를 찾을 수 없습니다. userId:', userId);
            App.showNotification('사용자를 찾을 수 없습니다.', 'error');
            return;
        }
        
        console.log('사용자 정보 로드:', user);
        title.textContent = '사용자 수정';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-username').value = user.username;
        document.getElementById('user-name').value = user.name || '';
        document.getElementById('user-phone').value = user.phoneNumber || '';
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-active').checked = user.active !== false;
        document.getElementById('user-approved').checked = user.approved !== false;
        
        // 코치 연결 정보는 Coach에서 찾아야 함
        updateCoachSelection();
        
        // 해당 사용자 ID를 가진 코치 찾기
        if (user.role === 'COACH') {
            const connectedCoach = allCoaches.find(c => c.userId == userId);
            if (connectedCoach) {
                document.getElementById('user-coach').value = connectedCoach.id;
            }
        }
        
        // 수정 모드에서는 비밀번호를 선택사항으로
        passwordInput.required = false;
        passwordLabel.textContent = '비밀번호 (변경 시에만 입력)';
        passwordHint.textContent = '비밀번호를 변경하지 않으려면 비워두세요.';
    } else {
        // 추가 모드
        title.textContent = '사용자 추가';
        passwordInput.required = true;
        passwordLabel.textContent = '비밀번호 *';
        passwordHint.textContent = '최소 4자 이상';
        updateCoachSelection();
    }
    
    console.log('모달 열기 시도, modal:', modal);
    App.Modal.open('userModal');
    console.log('모달 열기 완료');
}

// 사용자 모달 닫기
function closeUserModal() {
    App.Modal.close('userModal');
    document.getElementById('user-form').reset();
}

// 사용자 저장
async function saveUser() {
    const form = document.getElementById('user-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const userId = document.getElementById('user-id').value;
    const userData = {
        username: document.getElementById('user-username').value.trim(),
        password: document.getElementById('user-password').value,
        name: document.getElementById('user-name').value.trim() || null,
        phoneNumber: document.getElementById('user-phone').value.trim() || null,
        role: document.getElementById('user-role').value,
        active: document.getElementById('user-active').checked,
        approved: document.getElementById('user-approved').checked
    };
    
    // 비밀번호가 비어있고 수정 모드인 경우 비밀번호 필드 제거
    if (userId && !userData.password) {
        delete userData.password;
    }
    
    // 코치 연결 (COACH 권한이고 코치가 선택된 경우)
    const selectedCoachId = document.getElementById('user-coach').value;
    if (userData.role === 'COACH' && selectedCoachId) {
        // 코치와 사용자 연결은 별도 API로 처리
        try {
            if (userId) {
                // 수정
                await App.api.put(`/users/${userId}`, userData);
                // 코치 연결 업데이트
                await updateCoachUserConnection(selectedCoachId, userId);
            } else {
                // 추가
                const response = await App.api.post('/users', userData);
                const newUserId = response.user.id;
                // 코치 연결
                await updateCoachUserConnection(selectedCoachId, newUserId);
            }
            App.showNotification('사용자 정보가 저장되었습니다.', 'success');
        } catch (error) {
            console.error('사용자 저장 실패:', error);
            const errorMsg = error.response?.data?.error || '사용자 저장에 실패했습니다.';
            App.showNotification(errorMsg, 'error');
            return;
        }
    } else {
        // 코치 연결 없이 저장
        try {
            if (userId) {
                await App.api.put(`/users/${userId}`, userData);
                App.showNotification('사용자 정보가 수정되었습니다.', 'success');
            } else {
                await App.api.post('/users', userData);
                App.showNotification('사용자가 추가되었습니다.', 'success');
            }
        } catch (error) {
            console.error('사용자 저장 실패:', error);
            const errorMsg = error.response?.data?.error || '사용자 저장에 실패했습니다.';
            App.showNotification(errorMsg, 'error');
            return;
        }
    }
    
    closeUserModal();
    loadUsers();
}

// 코치와 사용자 연결 업데이트
async function updateCoachUserConnection(coachId, userId) {
    try {
        // 기존에 연결된 코치가 있으면 연결 해제
        const existingCoach = allCoaches.find(c => c.userId == userId && c.id != coachId);
        if (existingCoach) {
            existingCoach.userId = null;
            await App.api.put(`/coaches/${existingCoach.id}`, existingCoach);
        }
        
        // 새 코치 연결
        if (coachId) {
            const coach = allCoaches.find(c => c.id == coachId);
            if (coach) {
                coach.userId = userId;
                await App.api.put(`/coaches/${coachId}`, coach);
            }
        }
        
        // 코치 목록 다시 로드
        await loadCoaches();
    } catch (error) {
        console.error('코치 연결 업데이트 실패:', error);
        // 코치 연결 실패는 경고만 표시
        App.showNotification('코치 연결 업데이트에 실패했습니다.', 'warning');
    }
}

// 사용자 수정
function editUser(userId) {
    console.log('사용자 수정 버튼 클릭:', userId);
    const user = allUsers.find(u => u.id == userId);
    if (!user) {
        console.error('사용자를 찾을 수 없습니다:', userId);
        App.showNotification('사용자를 찾을 수 없습니다.', 'error');
        return;
    }
    console.log('수정할 사용자 정보:', user);
    openUserModal(userId);
}

// 사용자 승인
async function approveUser(userId) {
    if (!confirm('이 사용자를 승인하시겠습니까?')) {
        return;
    }
    
    try {
        await App.api.post(`/users/${userId}/approve`, {});
        App.showNotification('사용자가 승인되었습니다.', 'success');
        await loadUsers();
    } catch (error) {
        console.error('사용자 승인 실패:', error);
        const errorMsg = error.response?.data?.error || '사용자 승인에 실패했습니다.';
        App.showNotification(errorMsg, 'error');
    }
}

// 사용자 승인 거부
async function rejectUser(userId) {
    if (!confirm('이 사용자의 승인을 거부하시겠습니까? 계정이 비활성화됩니다.')) {
        return;
    }
    
    try {
        await App.api.post(`/users/${userId}/reject`, {});
        App.showNotification('사용자 승인이 거부되었습니다.', 'success');
        await loadUsers();
    } catch (error) {
        console.error('사용자 승인 거부 실패:', error);
        const errorMsg = error.response?.data?.error || '사용자 승인 거부에 실패했습니다.';
        App.showNotification(errorMsg, 'error');
    }
}

// 사용자 삭제
async function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        App.showNotification('사용자를 찾을 수 없습니다.', 'error');
        return;
    }
    
    if (!confirm(`정말로 "${user.username}" 사용자를 비활성화하시겠습니까?`)) {
        return;
    }
    
    try {
        await App.api.delete(`/users/${userId}`);
        App.showNotification('사용자가 비활성화되었습니다.', 'success');
        loadUsers();
    } catch (error) {
        console.error('사용자 삭제 실패:', error);
        const errorMsg = error.response?.data?.error || '사용자 삭제에 실패했습니다.';
        App.showNotification(errorMsg, 'error');
    }
}

// 비밀번호 변경 모달 열기
function openPasswordModal(userId) {
    const modal = document.getElementById('passwordModal');
    document.getElementById('password-user-id').value = userId;
    document.getElementById('password-form').reset();
    App.Modal.open('passwordModal');
}

// 비밀번호 변경 모달 닫기
function closePasswordModal() {
    App.Modal.close('passwordModal');
    document.getElementById('password-form').reset();
}

// 비밀번호 변경
async function changePassword() {
    const form = document.getElementById('password-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const userId = document.getElementById('password-user-id').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        App.showNotification('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }
    
    if (newPassword.length < 4) {
        App.showNotification('비밀번호는 최소 4자 이상이어야 합니다.', 'error');
        return;
    }
    
    try {
        await App.api.post(`/users/${userId}/change-password`, { password: newPassword });
        App.showNotification('비밀번호가 변경되었습니다.', 'success');
        closePasswordModal();
    } catch (error) {
        console.error('비밀번호 변경 실패:', error);
        const errorMsg = error.response?.data?.error || '비밀번호 변경에 실패했습니다.';
        App.showNotification(errorMsg, 'error');
    }
}
