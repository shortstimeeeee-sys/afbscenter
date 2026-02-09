// 권한 관리 페이지 JavaScript

let allPermissions = {};
let currentRole = 'ADMIN';

// 권한 그룹 정의
const permissionGroups = [
    {
        title: '회원 관리',
        icon: '👥',
        permissions: [
            { key: 'memberView', label: '회원 조회' },
            { key: 'memberCreate', label: '회원 등록' },
            { key: 'memberEdit', label: '회원 수정' },
            { key: 'memberDelete', label: '회원 삭제' }
        ]
    },
    {
        title: '예약 관리',
        icon: '📅',
        permissions: [
            { key: 'bookingView', label: '예약 조회' },
            { key: 'bookingCreate', label: '예약 등록' },
            { key: 'bookingEdit', label: '예약 수정' },
            { key: 'bookingDelete', label: '예약 삭제' }
        ]
    },
    {
        title: '코치 관리',
        icon: '🏃',
        permissions: [
            { key: 'coachView', label: '코치 조회' },
            { key: 'coachCreate', label: '코치 등록' },
            { key: 'coachEdit', label: '코치 수정' },
            { key: 'coachDelete', label: '코치 삭제' }
        ]
    },
    {
        title: '상품 관리',
        icon: '🎁',
        permissions: [
            { key: 'productView', label: '상품 조회' },
            { key: 'productCreate', label: '상품 등록' },
            { key: 'productEdit', label: '상품 수정' },
            { key: 'productDelete', label: '상품 삭제' }
        ]
    },
    {
        title: '결제 관리',
        icon: '💳',
        permissions: [
            { key: 'paymentView', label: '결제 조회' },
            { key: 'paymentCreate', label: '결제 처리' },
            { key: 'paymentEdit', label: '결제 수정' },
            { key: 'paymentRefund', label: '환불 처리' }
        ]
    },
    {
        title: '통계/분석',
        icon: '📈',
        permissions: [
            { key: 'analyticsView', label: '통계 조회' }
        ]
    },
    {
        title: '대시보드',
        icon: '📊',
        permissions: [
            { key: 'dashboardView', label: '대시보드 조회' }
        ]
    },
    {
        title: '설정 관리',
        icon: '⚙️',
        permissions: [
            { key: 'settingsView', label: '설정 조회' },
            { key: 'settingsEdit', label: '설정 수정' }
        ]
    },
    {
        title: '사용자 관리',
        icon: '👤',
        permissions: [
            { key: 'userView', label: '사용자 조회' },
            { key: 'userCreate', label: '사용자 등록' },
            { key: 'userEdit', label: '사용자 수정' },
            { key: 'userDelete', label: '사용자 삭제' }
        ]
    },
    {
        title: '공지사항',
        icon: '📢',
        permissions: [
            { key: 'announcementView', label: '공지 조회' },
            { key: 'announcementCreate', label: '공지 등록' },
            { key: 'announcementEdit', label: '공지 수정' },
            { key: 'announcementDelete', label: '공지 삭제' }
        ]
    },
    {
        title: '출석 관리',
        icon: '✓',
        permissions: [
            { key: 'attendanceView', label: '출석 조회' },
            { key: 'attendanceEdit', label: '출석 수정' }
        ]
    },
    {
        title: '훈련 기록',
        icon: '📝',
        permissions: [
            { key: 'trainingLogView', label: '훈련 기록 조회' },
            { key: 'trainingLogCreate', label: '훈련 기록 등록' },
            { key: 'trainingLogEdit', label: '훈련 기록 수정' }
        ]
    }
];

// 페이지 로드 시 권한 목록 로드
document.addEventListener('DOMContentLoaded', function() {
    loadPermissions();
});

// 권한 목록 로드
async function loadPermissions() {
    try {
        const response = await App.api.get('/role-permissions');
        allPermissions = response.permissions || {};
        renderPermissions('ADMIN');
    } catch (error) {
        App.err('권한 목록 로드 실패:', error);
        App.showNotification('권한 목록을 불러오는데 실패했습니다.', 'error');
    }
}

// 역할 전환
function switchRole(role) {
    currentRole = role;
    
    // 탭 활성화
    document.querySelectorAll('.role-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-role') === role) {
            tab.classList.add('active');
        }
    });
    
    renderPermissions(role);
}

// 권한 렌더링
function renderPermissions(role) {
    const content = document.getElementById('permissions-content');
    const rolePermission = allPermissions[role] || {};
    
    let html = '';
    
    permissionGroups.forEach(group => {
        html += `
            <div class="permission-section">
                <div class="permission-section-title">
                    <span>${group.icon}</span>
                    <span>${group.title}</span>
                </div>
                <div class="permission-group">
        `;
        
        group.permissions.forEach(perm => {
            const value = rolePermission[perm.key] !== undefined ? rolePermission[perm.key] : false;
            html += `
                <div class="permission-item">
                    <input type="checkbox" 
                           id="${role}-${perm.key}" 
                           data-role="${role}" 
                           data-key="${perm.key}"
                           ${value ? 'checked' : ''}
                           onchange="updatePermission('${role}', '${perm.key}', this.checked)">
                    <label for="${role}-${perm.key}">${perm.label}</label>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

// 권한 업데이트 (체크박스 변경 시)
function updatePermission(role, key, value) {
    if (!allPermissions[role]) {
        allPermissions[role] = {};
    }
    allPermissions[role][key] = value;
}

// 권한 저장
async function savePermissions() {
    try {
        // 현재 선택된 역할의 권한 저장
        const rolePermission = allPermissions[currentRole] || {};
        
        // role 필드를 제거하고 Boolean 값만 있는 객체 생성
        const permissionsToSave = {};
        for (const key in rolePermission) {
            if (key !== 'role' && key !== 'id' && key !== 'updatedAt' && typeof rolePermission[key] === 'boolean') {
                permissionsToSave[key] = rolePermission[key];
            }
        }
        
        App.log('저장할 권한 데이터:', permissionsToSave);
        await App.api.put(`/role-permissions/${currentRole}`, permissionsToSave);
        App.showNotification(`${getRoleName(currentRole)} 권한이 저장되었습니다.`, 'success');
        
        // 권한 목록 다시 로드
        await loadPermissions();
    } catch (error) {
        App.err('권한 저장 실패:', error);
        const errorMsg = error.response?.data?.error || error.response?.data?.message || '권한 저장에 실패했습니다.';
        App.showNotification(errorMsg, 'error');
    }
}

// 권한 초기화
async function resetPermissions() {
    if (!confirm('권한을 기본값으로 초기화하시겠습니까?')) {
        return;
    }
    
    try {
        // 서버에서 기본 권한 다시 로드
        await loadPermissions();
        App.showNotification('권한이 초기화되었습니다.', 'success');
    } catch (error) {
        App.err('권한 초기화 실패:', error);
        App.showNotification('권한 초기화에 실패했습니다.', 'error');
    }
}

// 역할명 가져오기
function getRoleName(role) {
    const roleNames = {
        'ADMIN': '관리자',
        'MANAGER': '매니저',
        'COACH': '코치',
        'FRONT': '데스크'
    };
    return roleNames[role] || role;
}
