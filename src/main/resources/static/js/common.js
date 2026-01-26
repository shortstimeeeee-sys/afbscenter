// ========================================
// AFBS 센터 - 공통 JavaScript
// ========================================

// 전역 변수
const App = {
    currentUser: null,
    currentRole: null, // Admin, Manager, Coach, Front
    apiBase: '/api',
    authToken: null
};

// 인증 토큰 관리
App.setAuthToken = function(token) {
    this.authToken = token;
    if (token) {
        localStorage.setItem('authToken', token);
    } else {
        localStorage.removeItem('authToken');
    }
};

App.getAuthToken = function() {
    if (!this.authToken) {
        this.authToken = localStorage.getItem('authToken');
    }
    return this.authToken;
};

App.clearAuth = function() {
    this.authToken = null;
    this.currentUser = null;
    this.currentRole = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/login.html';
};

App.isAuthenticated = function() {
    return !!this.getAuthToken();
};

// 페이지 로드 시 인증 정보 복원
App.restoreAuth = function() {
    const token = this.getAuthToken();
    console.log('인증 정보 복원 시도, 토큰 존재:', !!token);
    
    if (token) {
        const userStr = localStorage.getItem('currentUser');
        console.log('사용자 정보 존재:', !!userStr);
        
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                this.currentRole = this.currentUser.role;
                console.log('인증 정보 복원 성공:', {
                    username: this.currentUser.username,
                    role: this.currentRole
                });
            } catch (e) {
                console.error('사용자 정보 복원 실패:', e);
                this.clearAuth();
            }
        } else {
            console.warn('사용자 정보가 localStorage에 없습니다');
        }
    } else {
        console.warn('인증 토큰이 localStorage에 없습니다');
    }
};

// 인증 헤더 가져오기
App.getAuthHeaders = function() {
    const headers = {
        'ngrok-skip-browser-warning': 'true'
    };
    const token = this.getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('인증 헤더 추가됨, 토큰 길이:', token.length);
    } else {
        console.warn('인증 토큰이 없습니다!');
    }
    return headers;
};

// 권한 데이터 캐시
App.rolePermissions = null;

// 권한 데이터 로드
App.loadRolePermissions = async function() {
    try {
        const response = await this.api.get('/role-permissions');
        this.rolePermissions = response.permissions || {};
        console.log('권한 데이터 로드 완료:', this.rolePermissions);
        return this.rolePermissions;
    } catch (error) {
        console.warn('권한 데이터 로드 실패, 기본 역할 계층 사용:', error);
        this.rolePermissions = null;
        return null;
    }
};

// 세부 권한 체크
App.hasDetailPermission = function(permissionKey) {
    if (!App.currentRole || !App.rolePermissions) {
        return false;
    }
    
    const role = App.currentRole.toUpperCase();
    const rolePermission = App.rolePermissions[role];
    
    if (!rolePermission) {
        return false;
    }
    
    // 권한 키가 있으면 해당 권한 반환, 없으면 false
    return rolePermission[permissionKey] === true;
};

// 권한 체크 (역할 계층 또는 세부 권한)
App.hasPermission = function(requiredRole, permissionKey) {
    if (!App.currentRole) {
        console.warn('권한 체크 실패: currentRole이 없습니다');
        return false;
    }
    
    // 세부 권한이 지정된 경우 세부 권한 체크
    if (permissionKey) {
        return App.hasDetailPermission(permissionKey);
    }
    
    // 역할 계층 체크 (기존 로직)
    const roleHierarchy = {
        'FRONT': 1,
        'COACH': 2,
        'MANAGER': 3,
        'ADMIN': 4
    };
    
    const currentRoleUpper = App.currentRole.toUpperCase();
    const requiredRoleUpper = requiredRole ? requiredRole.toUpperCase() : '';
    
    // data-role 속성 매핑 (프론트엔드에서 사용하는 값)
    const roleMapping = {
        'FRONT': 'FRONT',
        'COACH': 'COACH',
        'MANAGER': 'MANAGER',
        'ADMIN': 'ADMIN',
        'Front': 'FRONT',
        'Coach': 'COACH',
        'Manager': 'MANAGER',
        'Admin': 'ADMIN'
    };
    
    const mappedCurrentRole = roleMapping[currentRoleUpper] || currentRoleUpper;
    const mappedRequiredRole = roleMapping[requiredRoleUpper] || requiredRoleUpper;
    
    const currentLevel = roleHierarchy[mappedCurrentRole] || 0;
    const requiredLevel = roleHierarchy[mappedRequiredRole] || 0;
    
    const hasPermission = currentLevel >= requiredLevel;
    
    return hasPermission;
};

// 메뉴-권한 매핑 (메뉴 URL과 필요한 권한)
const menuPermissionMap = {
    '/': 'dashboardView', // 대시보드
    '/members.html': 'memberView',
    '/coaches.html': 'coachView',
    '/bookings.html': 'bookingView',
    '/bookings-saha-training.html': 'bookingView',
    '/bookings-yeonsan.html': 'bookingView',
    '/bookings-yeonsan-training.html': 'bookingView',
    '/rentals.html': 'bookingView',
    '/attendance.html': 'attendanceView',
    '/training-logs.html': 'trainingLogView',
    '/rankings.html': 'trainingLogView',
    '/training-stats.html': 'trainingLogView',
    '/products.html': 'productView',
    '/payments.html': 'paymentView',
    '/facilities.html': 'settingsView',
    '/analytics.html': 'analyticsView',
    '/announcements.html': 'announcementView',
    '/users.html': 'userView',
    '/permissions.html': 'userView', // 권한 관리도 사용자 관리 권한 필요
    '/settings.html': 'settingsView'
};

// 메뉴 필터링 (권한 기반)
App.filterMenuByRole = async function() {
    console.log('메뉴 필터링 시작, 현재 권한:', App.currentRole);
    
    // 권한 데이터가 없으면 로드 시도
    if (!App.rolePermissions) {
        await App.loadRolePermissions();
    }
    
    // menu-section의 data-role 처리
    const menuSections = document.querySelectorAll('.menu-section[data-role]');
    menuSections.forEach(section => {
        const requiredRole = section.getAttribute('data-role');
        const hasPermission = App.hasPermission(requiredRole);
        console.log('메뉴 섹션 권한 체크:', requiredRole, '->', hasPermission);
        if (!hasPermission) {
            section.style.display = 'none';
        } else {
            section.style.display = ''; // 권한이 있으면 표시
        }
    });
    
    // menu-item의 data-role 및 data-permission 처리
    const menuItems = document.querySelectorAll('.menu-item[data-role]');
    menuItems.forEach(item => {
        const requiredRole = item.getAttribute('data-role');
        const permissionKey = item.getAttribute('data-permission');
        const href = item.getAttribute('href');
        
        let hasPermission = false;
        
        // 권한 데이터가 있는 경우에만 세부 권한 체크
        if (App.rolePermissions) {
            // 세부 권한이 지정된 경우 세부 권한 체크
            if (permissionKey) {
                hasPermission = App.hasPermission(requiredRole, permissionKey);
            } 
            // href 기반으로 권한 매핑 확인
            else if (href && menuPermissionMap[href]) {
                const requiredPermission = menuPermissionMap[href];
                hasPermission = App.hasPermission(requiredRole, requiredPermission);
            }
            // 기본 역할 계층 체크
            else {
                hasPermission = App.hasPermission(requiredRole);
            }
        } else {
            // 권한 데이터가 없으면 기본 역할 계층만 체크
            hasPermission = App.hasPermission(requiredRole);
        }
        
        if (!hasPermission) {
            item.style.display = 'none';
            item.style.pointerEvents = 'none'; // 클릭 비활성화
            item.style.opacity = '0.5'; // 시각적 표시
        } else {
            item.style.display = '';
            item.style.pointerEvents = '';
            item.style.opacity = '';
        }
        
        console.log('메뉴 항목 권한 체크:', {
            href: href,
            requiredRole: requiredRole,
            permissionKey: permissionKey,
            hasPermission: hasPermission,
            rolePermissionsLoaded: !!App.rolePermissions
        });
    });
    
    console.log('메뉴 필터링 완료');
};

// API 호출 헬퍼
App.api = {
    get: async function(url) {
        try {
            const headers = App.getAuthHeaders();
            console.log('API GET 요청:', `${App.apiBase}${url}`, '헤더:', headers);
            
            const response = await fetch(`${App.apiBase}${url}`, {
                headers: headers
            });
            
            console.log('API GET 응답 상태:', response.status, response.statusText);
            
            if (response.status === 401) {
                console.error('401 Unauthorized - 인증 실패');
                App.clearAuth();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API GET 오류 응답:', errorText);
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: errorText };
                throw error;
            }
            return await response.json();
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    },
    
    post: async function(url, data) {
        try {
            const headers = App.getAuthHeaders();
            headers['Content-Type'] = 'application/json';
            
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(data)
            });
            
            if (response.status === 401) {
                App.clearAuth();
                throw new Error('인증이 만료되었습니다.');
            }
            
            let responseData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseData = await response.json();
                } catch (e) {
                    console.warn('JSON 파싱 실패:', e);
                    responseData = { error: '응답 파싱 실패' };
                }
            } else {
                const text = await response.text();
                responseData = { error: text || `HTTP ${response.status}` };
            }
            
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: responseData };
                throw error;
            }
            return responseData;
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    },
    
    put: async function(url, data) {
        try {
            const headers = App.getAuthHeaders();
            headers['Content-Type'] = 'application/json';
            
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(data)
            });
            
            if (response.status === 401) {
                App.clearAuth();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API PUT Error:', error);
            throw error;
        }
    },
    
    delete: async function(url) {
        try {
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'DELETE',
                headers: App.getAuthHeaders()
            });
            
            if (response.status === 401) {
                App.clearAuth();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.status === 204 ? null : await response.json();
        } catch (error) {
            console.error('API DELETE Error:', error);
            throw error;
        }
    }
};

// 알림 표시
App.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background-color: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        z-index: 3000;
        box-shadow: var(--shadow-lg);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// 모달 관리
App.Modal = {
    open: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // 인라인 스타일 제거 (display: none 등)
            modal.style.display = '';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            // 드래그로 인한 뒤로가기 방지
            this.preventDragNavigation(modal);
        }
    },
    
    close: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
            // 이벤트 리스너 제거
            this.removeDragPrevention(modal);
        }
    },
    
    closeAll: function() {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
            modal.style.display = 'none';
            this.removeDragPrevention(modal);
        });
        document.body.style.overflow = '';
    },
    
    // 드래그로 인한 뒤로가기 방지
    preventDragNavigation: function(modal) {
        if (modal._dragPreventionAdded) return;
        
        let startX = 0;
        let startY = 0;
        let isDragging = false;
        
        // 터치 시작
        const touchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = false;
        };
        
        // 터치 이동
        const touchMove = (e) => {
            if (!startX || !startY) return;
            
            const deltaX = Math.abs(e.touches[0].clientX - startX);
            const deltaY = Math.abs(e.touches[0].clientY - startY);
            
            // 수평 이동이 수직 이동보다 크면 드래그로 판단
            if (deltaX > 10 && deltaX > deltaY) {
                isDragging = true;
                e.preventDefault(); // 기본 동작 방지 (뒤로가기 포함)
            }
        };
        
        // 마우스 드래그 방지
        const mouseDown = (e) => {
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
        };
        
        const mouseMove = (e) => {
            if (!startX || !startY) return;
            
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            
            // 수평 이동이 수직 이동보다 크면 드래그로 판단
            if (deltaX > 10 && deltaX > deltaY) {
                isDragging = true;
                e.preventDefault();
            }
        };
        
        // 모달 오버레이에서만 이벤트 처리
        modal.addEventListener('touchstart', touchStart, { passive: false });
        modal.addEventListener('touchmove', touchMove, { passive: false });
        modal.addEventListener('mousedown', mouseDown);
        modal.addEventListener('mousemove', mouseMove);
        
        // 전역 터치 이벤트 차단 (모달이 열려있을 때)
        const preventGlobalTouch = (e) => {
            // 모달이 열려있고, 모달 외부에서 시작된 터치면 차단
            if (document.querySelector('.modal-overlay.active')) {
                e.preventDefault();
            }
        };
        
        // 모달이 열려있을 때만 전역 이벤트 차단
        document.addEventListener('touchmove', preventGlobalTouch, { passive: false });
        
        // 이벤트 리스너를 모달 객체에 저장 (나중에 제거하기 위해)
        modal._dragPreventionAdded = true;
        modal._touchStart = touchStart;
        modal._touchMove = touchMove;
        modal._mouseDown = mouseDown;
        modal._mouseMove = mouseMove;
        modal._preventGlobalTouch = preventGlobalTouch;
    },
    
    // 드래그 방지 이벤트 제거
    removeDragPrevention: function(modal) {
        if (!modal._dragPreventionAdded) return;
        
        modal.removeEventListener('touchstart', modal._touchStart);
        modal.removeEventListener('touchmove', modal._touchMove);
        modal.removeEventListener('mousedown', modal._mouseDown);
        modal.removeEventListener('mousemove', modal._mouseMove);
        document.removeEventListener('touchmove', modal._preventGlobalTouch);
        
        modal._dragPreventionAdded = false;
        delete modal._touchStart;
        delete modal._touchMove;
        delete modal._mouseDown;
        delete modal._mouseMove;
        delete modal._preventGlobalTouch;
    }
};

// 날짜 포맷팅
App.formatDate = function(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

App.formatDateTime = function(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 숫자 포맷팅
App.formatNumber = function(num) {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('ko-KR').format(num);
};

App.formatCurrency = function(amount) {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
    }).format(amount);
};

// 페이지네이션
App.Pagination = {
    render: function(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        // 이전 버튼
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '이전';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => onPageChange(currentPage - 1);
        container.appendChild(prevBtn);
        
        // 페이지 번호
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => onPageChange(i);
            container.appendChild(pageBtn);
        }
        
        // 다음 버튼
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = '다음';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => onPageChange(currentPage + 1);
        container.appendChild(nextBtn);
    }
};

// ========================================
// 코치 색상 관리
// ========================================
App.CoachColors = {
    // 확장된 색상 팔레트 (중복 방지)
    // 빨간색(#F44336) 제거 - 고정 색상과 충돌 방지
    default: [
        '#5E6AD2', '#4CAF50', '#FF9800', '#E91E63', '#00BCD4', 
        '#9C27B0', '#795548', '#2196F3', '#FF5722',
        '#009688', '#FFC107', '#673AB7', '#CDDC39', '#FF4081',
        '#3F51B5', '#8BC34A', '#FF6B6B', '#4ECDC4', '#45B7D1'
    ],
    
    // 특정 코치 이름에 대한 고정 색상 (모든 페이지에서 동일)
    // 11명 모두 고유한 색상 할당 (중복 없음)
    fixedColors: {
        // 대표
        '서정민 [대표]': '#FF9800',          // 1. 오렌지
        '서정민': '#FF9800',
        
        // 코치
        '조장우 [코치]': '#4CAF50',          // 2. 초록
        '조장우': '#4CAF50',
        '최성훈 [코치]': '#E91E63',          // 3. 핫핑크
        '최성훈': '#E91E63',
        
        // 분야별 코치
        '김우경 [투수코치]': '#9C27B0',      // 4. 보라
        '김우경': '#9C27B0',
        '이원준 [포수코치]': '#00BCD4',      // 5. 청록
        '이원준': '#00BCD4',
        
        // 트레이너
        '박준현 [트레이너]': '#5E6AD2',      // 6. 남색
        '박준현': '#5E6AD2',
        
        // 연산점 강사
        '이소연 [강사]': '#FFC107',          // 7. 노란색
        '이소연': '#FFC107',
        '이서현 [강사]': '#F06292',          // 8. 밝은핑크
        '이서현': '#F06292',
        
        // 사하점 강사
        '김가영 [강사]': '#795548',          // 9. 브라운
        '김가영': '#795548',
        '김소연 [강사]': '#009688',          // 10. 틸 (이원준 청록과 구분되는 색상)
        '김소연': '#009688',
        '조혜진 [강사]': '#673AB7',          // 11. 진보라
        '조혜진': '#673AB7'
    },
    
    // 코치별 색상 캐시 (ID -> 색상 매핑)
    colorCache: {},
    
    // 코치별 색상 가져오기 (중복 방지)
    getColor: function(coach) {
        if (!coach) return null;
        const coachId = coach.id || coach;
        let coachName = coach.name || '';
        
        // 고정 색상이 있으면 우선 사용 (캐시 완전히 무시하고 항상 고정 색상 사용)
        // 먼저 정확한 이름으로 찾기
        if (coachName && this.fixedColors[coachName]) {
            const fixedColor = this.fixedColors[coachName];
            // 고정 색상은 항상 캐시에 저장하여 일관성 유지 (기존 캐시 덮어쓰기)
            this.colorCache[coachId] = fixedColor;
            return fixedColor;
        }
        
        // 이름에 공백이나 특수문자가 있을 수 있으므로 trim 처리
        const trimmedName = coachName.trim();
        if (trimmedName && this.fixedColors[trimmedName]) {
            const fixedColor = this.fixedColors[trimmedName];
            // 고정 색상은 항상 캐시에 저장하여 일관성 유지 (기존 캐시 덮어쓰기)
            this.colorCache[coachId] = fixedColor;
            return fixedColor;
        }
        
        // 부분 일치 검색 (예: "김소연 [강사]"에서 "김소연" 추출)
        if (trimmedName) {
            // 대괄호 앞의 이름만 추출
            const nameWithoutTitle = trimmedName.split(' [')[0].trim();
            if (nameWithoutTitle && this.fixedColors[nameWithoutTitle]) {
                const fixedColor = this.fixedColors[nameWithoutTitle];
                this.colorCache[coachId] = fixedColor;
                return fixedColor;
            }
            
            // 대괄호 포함 전체 이름도 확인
            if (this.fixedColors[trimmedName]) {
                const fixedColor = this.fixedColors[trimmedName];
                this.colorCache[coachId] = fixedColor;
                return fixedColor;
            }
        }
        
        // 고정 색상이 없을 때만 캐시 확인
        if (this.colorCache[coachId]) {
            return this.colorCache[coachId];
        }
        
        // 사용 중인 색상 확인 (고정 색상 제외)
        const usedColors = Object.values(this.colorCache);
        const fixedColorValues = Object.values(this.fixedColors);
        const availableColors = this.default.filter(c => 
            !usedColors.includes(c) && !fixedColorValues.includes(c)
        );
        
        // 사용 가능한 색상이 있으면 사용, 없으면 순환
        let color;
        if (availableColors.length > 0) {
            color = availableColors[0];
        } else {
            // 고정 색상과 겹치지 않는 색상 찾기
            const allUsedColors = [...usedColors, ...fixedColorValues];
            const remainingColors = this.default.filter(c => !allUsedColors.includes(c));
            if (remainingColors.length > 0) {
                color = remainingColors[0];
            } else {
                const colorIndex = Object.keys(this.colorCache).length % this.default.length;
                color = this.default[colorIndex];
            }
        }
        
        // 캐시에 저장
        this.colorCache[coachId] = color;
        return color;
    },
    
    // 코치 ID로 색상 가져오기
    getColorById: function(coachId) {
        if (!coachId) return null;
        return this.getColor({ id: coachId });
    },
    
    // 색상 캐시 초기화
    resetCache: function() {
        this.colorCache = {};
    },
    
    // 고정 색상 강제 적용 (캐시 무시)
    forceFixedColor: function(coachName) {
        if (!coachName) return null;
        const trimmedName = coachName.trim();
        return this.fixedColors[trimmedName] || null;
    }
};

// 페이지 로드 시 색상 캐시 초기화 (고정 색상 우선 적용 보장)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        if (App.CoachColors) {
            App.CoachColors.resetCache();
        }
    });
}

// ========================================
// 상태 관리 유틸리티
// ========================================
App.Status = {
    // 예약 상태
    booking: {
        getBadge: function(status) {
            const map = {
                'CONFIRMED': 'success',
                'PENDING': 'warning',
                'CANCELLED': 'danger',
                'COMPLETED': 'info',
                'NO_SHOW': 'danger',
                'CHECKED_IN': 'info'
            };
            return map[status] || 'info';
        },
        getText: function(status) {
            const map = {
                'CONFIRMED': '확정',
                'PENDING': '대기',
                'CANCELLED': '취소',
                'COMPLETED': '완료',
                'NO_SHOW': '노쇼',
                'CHECKED_IN': '체크인'
            };
            return map[status] || status;
        }
    },
    
    // 회원 상태
    member: {
        getBadge: function(status) {
            const map = {
                'ACTIVE': 'success',
                'INACTIVE': 'warning',
                'WITHDRAWN': 'danger'
            };
            return map[status] || 'info';
        },
        getText: function(status) {
            const map = {
                'ACTIVE': '활성',
                'INACTIVE': '휴면',
                'WITHDRAWN': '탈퇴'
            };
            return map[status] || status;
        }
    }
};

// ========================================
// 레슨 카테고리 관리
// ========================================
App.LessonCategory = {
    getText: function(category) {
        const map = {
            'BASEBALL': '야구 레슨',
            'PILATES': '필라테스 레슨',
            'TRAINING': '트레이닝 파트'
        };
        return map[category] || category || '-';
    },
    
    getBadge: function(category) {
        const map = {
            'BASEBALL': 'info',
            'PILATES': 'success',
            'TRAINING': 'warning'
        };
        return map[category] || 'secondary';
    },
    
    // 코치의 specialties에서 레슨 카테고리 추출
    fromCoachSpecialties: function(specialties) {
        if (!specialties) return null;
        const specialtiesLower = specialties.toLowerCase();
        if (specialtiesLower.includes('야구') || specialtiesLower.includes('baseball')) {
            return 'BASEBALL';
        } else if (specialtiesLower.includes('필라테스') || specialtiesLower.includes('pilates')) {
            return 'PILATES';
        } else if (specialtiesLower.includes('트레이닝') || specialtiesLower.includes('training')) {
            return 'TRAINING';
        }
        return null;
    }
};

// ========================================
// 결제 방법 관리
// ========================================
App.PaymentMethod = {
    getText: function(method) {
        if (!method) return '미결제';
        const map = {
            'PREPAID': '선결제',
            'ON_SITE': '현장',
            'POSTPAID': '후불',
            'ONSITE': '현장', // 하위 호환성
            'DEFERRED': '후불' // 하위 호환성
        };
        return map[method] || method;
    }
};

// ========================================
// 회원 등급 관리
// ========================================
App.MemberGrade = {
    getText: function(grade) {
        const map = {
            'SOCIAL': '사회인',
            'ELITE_ELEMENTARY': '엘리트 (초)',
            'ELITE_MIDDLE': '엘리트 (중)',
            'ELITE_HIGH': '엘리트 (고)',
            'YOUTH': '유소년'
        };
        return map[grade] || grade || '-';
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 인증 정보 복원 후 메뉴 필터링 (restoreAuth는 다른 리스너에서 처리됨)
    // 여기서는 restoreAuth가 완료된 후 필터링하도록 약간의 지연 추가
    setTimeout(function() {
        if (App.currentRole) {
            App.filterMenuByRole();
        }
    }, 100);
    
    // 시간 입력 필드 자동 포맷팅 (HH:MM)
    document.addEventListener('input', function(e) {
        const target = e.target;
        
        // 시간 입력 필드 감지 (id에 'time'이 포함되고 type이 text인 경우)
        if (target.type === 'text' && 
            (target.id.includes('time') || target.id.includes('Time')) &&
            target.pattern && target.pattern.includes('0-9')) {
            
            let value = target.value.replace(/[^0-9]/g, ''); // 숫자만 추출
            
            if (value.length >= 2) {
                // 2자리 이상이면 HH:MM 형식으로 변환
                let hours = value.substring(0, 2);
                let minutes = value.substring(2, 4);
                
                // 시간 검증 (0~23)
                if (parseInt(hours) > 23) {
                    hours = '23';
                }
                
                // 분 검증 (0~59)
                if (minutes && parseInt(minutes) > 59) {
                    minutes = '59';
                }
                
                target.value = minutes ? `${hours}:${minutes}` : hours;
            } else {
                target.value = value;
            }
        }
    });
    
    // 모달 닫기 이벤트
    document.addEventListener('click', function(e) {
        // 모달 외부 클릭으로 닫기 비활성화 (닫기 버튼만 작동)
        // if (e.target.classList.contains('modal-overlay')) {
        //     App.Modal.closeAll();
        // }
        if (e.target.classList.contains('modal-close')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) {
                App.Modal.close(modal.id);
            }
        }
    });
    
    // 모달 내부에서의 드래그로 인한 뒤로가기 방지 (추가 보호)
    document.addEventListener('touchstart', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal && activeModal.contains(e.target)) {
            // 모달 내부 터치는 허용하되, 수평 스와이프는 차단
            const touch = e.touches[0];
            activeModal._touchStartX = touch.clientX;
            activeModal._touchStartY = touch.clientY;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal && activeModal._touchStartX !== undefined) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - activeModal._touchStartX);
            const deltaY = Math.abs(touch.clientY - activeModal._touchStartY);
            
            // 수평 스와이프가 수직 스와이프보다 크면 차단 (뒤로가기 방지)
            if (deltaX > 30 && deltaX > deltaY * 2) {
                e.preventDefault();
            }
        }
    }, { passive: false });
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            App.Modal.closeAll();
        }
    });
    
    // 현재 페이지 메뉴 활성화
    const currentPath = window.location.pathname;
    document.querySelectorAll('.menu-item').forEach(item => {
        if (item.getAttribute('href') === currentPath) {
            item.classList.add('active');
        }
    });
});

// ========================================
// 알림 시스템
// ========================================

// 알림 드롭다운 초기화
App.initNotifications = function() {
    const notificationBtn = document.getElementById('notification-btn');
    if (!notificationBtn) return;
    
    // 알림 드롭다운 생성
    const dropdown = document.createElement('div');
    dropdown.className = 'notification-dropdown';
    dropdown.id = 'notification-dropdown';
    dropdown.innerHTML = `
        <div class="notification-header">
            <h3>알림</h3>
            <button class="mark-all-read" onclick="App.markAllNotificationsRead()">모두 읽음</button>
        </div>
        <div class="notification-list" id="notification-list">
            <div class="notification-loading">로딩 중...</div>
        </div>
    `;
    notificationBtn.parentElement.style.position = 'relative';
    notificationBtn.parentElement.appendChild(dropdown);
    
    // 클릭 이벤트
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            App.loadNotifications();
        }
    });
    
    // 외부 클릭 시 닫기
    document.addEventListener('click', () => {
        dropdown.classList.remove('active');
    });
    
    // 초기 로드
    App.updateNotificationBadge();
};

// 알림 개수 업데이트
App.updateNotificationBadge = async function() {
    try {
        const announcements = await App.api.get('/announcements');
        const unreadCount = announcements.filter(a => a.isActive).length;
        
        const badge = document.getElementById('notification-badge');
        const notificationBtn = document.getElementById('notification-btn');
        
        if (unreadCount > 0) {
            if (!badge) {
                const newBadge = document.createElement('span');
                newBadge.id = 'notification-badge';
                newBadge.className = 'notification-badge';
                newBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                notificationBtn.appendChild(newBadge);
            } else {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            }
        } else if (badge) {
            badge.remove();
        }
    } catch (error) {
        console.error('알림 개수 업데이트 실패:', error);
    }
};

// 알림 목록 로드
App.loadNotifications = async function() {
    const listElement = document.getElementById('notification-list');
    if (!listElement) return;
    
    try {
        const announcements = await App.api.get('/announcements');
        const activeAnnouncements = announcements
            .filter(a => a.isActive)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
        
        if (activeAnnouncements.length === 0) {
            listElement.innerHTML = '<div class="notification-empty">새 알림이 없습니다</div>';
            return;
        }
        
        listElement.innerHTML = activeAnnouncements.map(announcement => `
            <div class="notification-item" onclick="App.viewAnnouncement(${announcement.id})">
                <div class="notification-icon">📢</div>
                <div class="notification-content">
                    <div class="notification-title">${announcement.title}</div>
                    <div class="notification-time">${App.formatDateTime(announcement.createdAt)}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('알림 로드 실패:', error);
        listElement.innerHTML = '<div class="notification-empty">알림을 불러올 수 없습니다</div>';
    }
};

// 공지사항 보기
App.viewAnnouncement = function(id) {
    window.location.href = '/announcements.html#' + id;
};

// 모두 읽음 처리
App.markAllNotificationsRead = function() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.remove();
    }
    App.showNotification('모든 알림을 읽음 처리했습니다', 'success');
};

// ========================================
// 다크 모드 시스템
// ========================================

App.initDarkMode = function() {
    // localStorage에서 테마 불러오기
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 초기 테마 설정 (저장된 값 > 시스템 설정 > 다크 모드)
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.body.classList.remove('green-gold-white-theme');
    } else if (savedTheme === 'green-gold-white') {
        document.body.classList.remove('light-mode');
        document.body.classList.add('green-gold-white-theme');
    } else {
        // 다크 모드 (기본값)
        document.body.classList.remove('light-mode');
        document.body.classList.remove('green-gold-white-theme');
    }
    
    // 토글 버튼 추가
    App.addDarkModeToggle();
    
    // MutationObserver로 topbar-right가 나타날 때 버튼 추가
    if (!App.themeObserver) {
        App.themeObserver = new MutationObserver((mutations) => {
            const topbarRight = document.querySelector('.topbar-right');
            if (topbarRight && !document.getElementById('theme-toggle-btn')) {
                App.addDarkModeToggle();
            }
        });
        
        // body를 관찰하여 DOM 변경 감지
        App.themeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 시스템 테마 변경 감지 (저장된 테마가 없을 때만)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                document.body.classList.remove('light-mode');
                document.body.classList.remove('green-gold-white-theme');
            } else {
                document.body.classList.add('light-mode');
                document.body.classList.remove('green-gold-white-theme');
            }
            App.updateDarkModeIcon();
        }
    });
};

App.addDarkModeToggle = function() {
    // 로그인 페이지에서는 실행하지 않음
    if (window.location.pathname === '/login.html' || window.location.pathname === '/login') {
        return;
    }
    
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) {
        // topbar-right가 아직 없으면 잠시 후 다시 시도 (최대 10번)
        if (!App.addDarkModeToggle.retryCount) {
            App.addDarkModeToggle.retryCount = 0;
        }
        if (App.addDarkModeToggle.retryCount < 10) {
            App.addDarkModeToggle.retryCount++;
            setTimeout(() => App.addDarkModeToggle(), 200);
        }
        return;
    }
    
    // 성공했으면 재시도 카운터 리셋
    App.addDarkModeToggle.retryCount = 0;
    
    // 이미 버튼이 있으면 제거
    const existingBtn = document.getElementById('theme-toggle-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.title = '테마 전환';
    
    // 현재 테마에 따라 아이콘 설정 (버튼이 DOM에 추가되기 전에 설정)
    const isLightMode = document.body.classList.contains('light-mode');
    const isGreenGoldWhite = document.body.classList.contains('green-gold-white-theme');
    
    if (isGreenGoldWhite) {
        toggleBtn.innerHTML = '🌙';
        toggleBtn.title = '다크 모드로 전환';
    } else if (isLightMode) {
        toggleBtn.innerHTML = '🎨';
        toggleBtn.title = '초록색-금색-흰색 테마로 전환';
    } else {
        toggleBtn.innerHTML = '☀️';
        toggleBtn.title = '라이트 모드로 전환';
    }
    
    toggleBtn.addEventListener('click', () => {
        App.toggleDarkMode();
    });
    
    // 알림 버튼 앞에 삽입
    const notificationBtn = document.getElementById('notification-btn');
    if (notificationBtn) {
        topbarRight.insertBefore(toggleBtn, notificationBtn);
    } else {
        topbarRight.prepend(toggleBtn);
    }
    
    console.log('테마 토글 버튼 추가 완료');
};

App.toggleDarkMode = function() {
    const body = document.body;
    const isLightMode = body.classList.contains('light-mode');
    const isGreenGoldWhite = body.classList.contains('green-gold-white-theme');
    
    // 테마 순환: 다크 모드 -> 라이트 모드 -> 초록색-금색-흰색 -> 다크 모드
    if (isGreenGoldWhite) {
        // 초록색-금색-흰색 -> 다크 모드
        body.classList.remove('green-gold-white-theme');
        body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
    } else if (isLightMode) {
        // 라이트 모드 -> 초록색-금색-흰색
        body.classList.remove('light-mode');
        body.classList.add('green-gold-white-theme');
        localStorage.setItem('theme', 'green-gold-white');
    } else {
        // 다크 모드 -> 라이트 모드
        body.classList.add('light-mode');
        body.classList.remove('green-gold-white-theme');
        localStorage.setItem('theme', 'light');
    }
    
    App.updateDarkModeIcon();
    
    // 부드러운 전환 효과
    body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        body.style.transition = '';
    }, 300);
};

App.updateDarkModeIcon = function() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        const isLightMode = document.body.classList.contains('light-mode');
        const isGreenGoldWhite = document.body.classList.contains('green-gold-white-theme');
        
        if (isGreenGoldWhite) {
            toggleBtn.innerHTML = '🌙';
            toggleBtn.title = '다크 모드로 전환';
        } else if (isLightMode) {
            toggleBtn.innerHTML = '🎨';
            toggleBtn.title = '초록색-금색-흰색 테마로 전환';
        } else {
            toggleBtn.innerHTML = '☀️';
            toggleBtn.title = '라이트 모드로 전환';
        }
    }
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 페이지는 제외
    if (window.location.pathname !== '/login.html' && window.location.pathname !== '/login') {
        App.initDarkMode();
        App.initNotifications();
        App.initSearch();
        // 5분마다 알림 개수 업데이트
        setInterval(() => App.updateNotificationBadge(), 5 * 60 * 1000);
        
        // topbar-right가 늦게 로드될 수 있으므로 여러 시점에서 시도
        setTimeout(() => {
            App.addDarkModeToggle();
        }, 100);
        setTimeout(() => {
            if (!document.getElementById('theme-toggle-btn')) {
                App.addDarkModeToggle();
            }
        }, 300);
        setTimeout(() => {
            if (!document.getElementById('theme-toggle-btn')) {
                App.addDarkModeToggle();
            }
        }, 800);
    }
});

// ========================================
// 전역 검색 시스템
// ========================================

App.initSearch = function() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;
    
    // 검색 결과 드롭다운 생성
    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.id = 'search-dropdown';
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(dropdown);
    
    let searchTimeout;
    
    // 입력 이벤트
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            dropdown.classList.remove('active');
            return;
        }
        
        searchTimeout = setTimeout(() => {
            App.performSearch(query);
        }, 300);
    });
    
    // 포커스 이벤트
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
            dropdown.classList.add('active');
        }
    });
    
    // Enter 키 이벤트
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                App.performSearch(query);
            }
        }
    });
    
    // 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (!searchInput.parentElement.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
};

// 검색 실행
App.performSearch = async function(query) {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<div class="search-loading">검색 중...</div>';
    dropdown.classList.add('active');
    
    try {
        // 병렬로 검색
        const [members, bookings] = await Promise.all([
            App.api.get('/members').catch(() => []),
            App.api.get('/bookings').catch(() => [])
        ]);
        
        // 회원 검색 (이름, 전화번호, 회원번호)
        const memberResults = members.filter(m => 
            m.name?.toLowerCase().includes(query.toLowerCase()) ||
            m.phoneNumber?.includes(query) ||
            m.memberNumber?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
        
        // 예약 검색 (회원명)
        const bookingResults = bookings.filter(b =>
            b.memberName?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);
        
        // 결과 렌더링
        let html = '';
        
        if (memberResults.length > 0) {
            html += '<div class="search-section">';
            html += '<div class="search-section-title">회원</div>';
            html += memberResults.map(m => `
                <div class="search-item" onclick="window.location.href='/members.html#${m.id}'">
                    <div class="search-icon">👤</div>
                    <div class="search-content">
                        <div class="search-title">${m.name}</div>
                        <div class="search-subtitle">${m.phoneNumber || ''} • ${m.memberNumber || ''}</div>
                    </div>
                </div>
            `).join('');
            html += '</div>';
        }
        
        if (bookingResults.length > 0) {
            html += '<div class="search-section">';
            html += '<div class="search-section-title">예약</div>';
            html += bookingResults.map(b => `
                <div class="search-item" onclick="window.location.href='/bookings.html#${b.id}'">
                    <div class="search-icon">📅</div>
                    <div class="search-content">
                        <div class="search-title">${b.memberName || '이름 없음'}</div>
                        <div class="search-subtitle">${App.formatDate(b.bookingDate)} • ${b.facilityName || ''}</div>
                    </div>
                </div>
            `).join('');
            html += '</div>';
        }
        
        if (html === '') {
            html = '<div class="search-empty">검색 결과가 없습니다</div>';
        }
        
        dropdown.innerHTML = html;
        
    } catch (error) {
        console.error('검색 실패:', error);
        dropdown.innerHTML = '<div class="search-empty">검색 중 오류가 발생했습니다</div>';
    }
};

// ========================================
// 애니메이션 CSS
// ========================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    /* 알림 드롭다운 스타일 */
    .notification-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 360px;
        max-height: 480px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        display: none;
        flex-direction: column;
        z-index: 1000;
    }
    
    .notification-dropdown.active {
        display: flex;
    }
    
    .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .notification-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .mark-all-read {
        background: none;
        border: none;
        color: var(--primary-color);
        font-size: 13px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: var(--radius-md);
    }
    
    .mark-all-read:hover {
        background: var(--bg-tertiary);
    }
    
    .notification-list {
        flex: 1;
        overflow-y: auto;
        max-height: 400px;
    }
    
    .notification-item {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .notification-item:hover {
        background: var(--bg-secondary);
    }
    
    .notification-item:last-child {
        border-bottom: none;
    }
    
    .notification-icon {
        font-size: 24px;
        flex-shrink: 0;
    }
    
    .notification-content {
        flex: 1;
        min-width: 0;
    }
    
    .notification-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .notification-time {
        font-size: 12px;
        color: var(--text-muted);
    }
    
    .notification-empty,
    .notification-loading {
        padding: 40px 16px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
    }
    
    .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: var(--accent-primary);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 5px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
    }
    
    .notification-btn {
        position: relative;
    }
    
    /* 검색 드롭다운 스타일 */
    .search-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        max-height: 480px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        display: none;
        flex-direction: column;
        overflow-y: auto;
        z-index: 1000;
    }
    
    .search-dropdown.active {
        display: flex;
    }
    
    .search-section {
        padding: 8px 0;
    }
    
    .search-section + .search-section {
        border-top: 1px solid var(--border-color);
    }
    
    .search-section-title {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
    }
    
    .search-item {
        display: flex;
        gap: 12px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .search-item:hover {
        background: var(--bg-secondary);
    }
    
    .search-icon {
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .search-content {
        flex: 1;
        min-width: 0;
    }
    
    .search-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .search-subtitle {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .search-empty,
    .search-loading {
        padding: 40px 16px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
    }
    
    /* 다크 모드 토글 버튼 */
    .theme-toggle-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 8px;
        border-radius: var(--radius-md);
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-center;
        line-height: 1;
    }
    
    .theme-toggle-btn:hover {
        background: var(--bg-tertiary);
    }
`;
document.head.appendChild(style);

// 페이지 로드 시 인증 체크 (로그인 페이지 제외)
document.addEventListener('DOMContentLoaded', function() {
    // 로그인 페이지는 제외
    if (window.location.pathname === '/login.html' || window.location.pathname === '/login') {
        App.restoreAuth();
        return;
    }

    // 먼저 인증 정보 복원 (중요: filterMenuByRole 전에 실행)
    App.restoreAuth();

    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    if (!App.isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    // 권한 데이터 로드 후 메뉴 필터링
    (async function() {
        await App.loadRolePermissions();
        // 약간의 지연을 두어 DOM이 완전히 로드된 후 필터링
        setTimeout(function() {
            App.filterMenuByRole();
        }, 0);
    })();
    
    // 테마 초기화 및 버튼 추가 시도 (인증 후 DOM이 완전히 로드된 후)
    // 여러 시점에서 시도하여 확실히 추가되도록
    App.initDarkMode();
    setTimeout(() => {
        App.addDarkModeToggle();
    }, 50);
    setTimeout(() => {
        if (!document.getElementById('theme-toggle-btn')) {
            App.addDarkModeToggle();
        }
    }, 300);
    setTimeout(() => {
        if (!document.getElementById('theme-toggle-btn')) {
            App.addDarkModeToggle();
        }
    }, 800);
    setTimeout(() => {
        if (!document.getElementById('theme-toggle-btn')) {
            App.addDarkModeToggle();
        }
    }, 1500);

    // 사용자 정보 표시 및 로그아웃 기능 추가
    // 모든 user-menu-btn 요소에 이벤트 리스너 추가 (id가 없어도 작동하도록)
    function setupUserMenuButtons() {
        const userMenuButtons = document.querySelectorAll('.user-menu-btn');
        console.log('사용자 메뉴 버튼 찾기:', userMenuButtons.length, '개');
        
        userMenuButtons.forEach(function(btn) {
            // 이미 이벤트 리스너가 등록되어 있는지 확인
            if (btn.hasAttribute('data-logout-setup')) {
                return;
            }
            
            console.log('사용자 메뉴 버튼 이벤트 리스너 등록');
            
            // 사용자 정보가 있으면 툴팁 설정
            if (App.currentUser && App.currentUser.name) {
                btn.title = `${App.currentUser.name} (${App.currentUser.role})`;
            }
            
            // 사용자 메뉴 클릭 시 사용자 정보 모달 표시
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('사용자 메뉴 버튼 클릭됨');
                showUserMenuModal();
            });
            
            // 중복 등록 방지 플래그
            btn.setAttribute('data-logout-setup', 'true');
        });
    }
    
    // 즉시 실행 및 약간의 지연 후에도 실행 (동적 로드 대응)
    setupUserMenuButtons();
    setTimeout(setupUserMenuButtons, 100);
    setTimeout(setupUserMenuButtons, 500);
});

// window.onload에서도 테마 버튼 추가 시도
window.addEventListener('load', () => {
    if (!document.getElementById('theme-toggle-btn')) {
        App.addDarkModeToggle();
    }
});

// 사용자 메뉴 모달 표시
async function showUserMenuModal() {
    if (!App.currentUser) {
        return;
    }
    
    const userName = App.currentUser.name || App.currentUser.username;
    let coachInfo = null;
    
    // 코치 정보 가져오기 (ADMIN, MANAGER는 조회하지 않음)
    if (App.currentUser.id && (App.currentUser.role === 'COACH' || App.currentUser.role === 'FRONT')) {
        try {
            const coach = await App.api.get(`/coaches/by-user/${App.currentUser.id}`);
            if (coach) {
                coachInfo = coach;
                console.log('코치 정보 조회 성공:', coach);
            }
        } catch (error) {
            // 404는 코치 정보가 없는 것이므로 정상 (모달은 계속 표시)
            if (error.response && error.response.status === 404) {
                console.log('코치 정보 없음 (정상) - 사용자 ID:', App.currentUser.id);
            } else {
                console.log('코치 정보 조회 실패:', error);
            }
            // 에러가 발생해도 모달은 계속 표시
        }
    }
    
    // 모달 HTML 생성
    let coachText = '';
    if (coachInfo && coachInfo.specialties) {
        // specialties가 있으면 포지션으로 표시
        coachText = coachInfo.specialties;
    } else if (App.currentUser.role === 'COACH') {
        // 코치 역할이지만 코치 정보가 없으면 "코치"로만 표시
        coachText = '코치';
    }
    
    const modalHtml = `
        <div id="user-menu-modal" class="modal-overlay active" style="display: flex;">
            <div class="modal" style="max-width: 350px;">
                <div class="modal-header">
                    <h2 class="modal-title">사용자 정보</h2>
                    <button class="modal-close" onclick="closeUserMenuModal()">×</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 48px; margin-bottom: 16px;">👤</div>
                        <div style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
                            ${userName}
                        </div>
                        ${coachText ? `
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
                            ${coachText}
                        </div>
                        ` : ''}
                        <div style="font-size: 12px; color: var(--text-muted);">
                            ${App.currentUser.role === 'ADMIN' ? '관리자' : 
                              App.currentUser.role === 'MANAGER' ? '매니저' : 
                              App.currentUser.role === 'COACH' ? '코치' : 
                              App.currentUser.role === 'FRONT' ? '데스크' : App.currentUser.role}
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="justify-content: center; gap: 12px;">
                    <button class="btn btn-secondary" onclick="closeUserMenuModal()">닫기</button>
                    <button class="btn btn-danger" onclick="logoutUser()">로그아웃</button>
                </div>
            </div>
        </div>
    `;
    
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById('user-menu-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 모달 배경 클릭 시 닫기
    const modal = document.getElementById('user-menu-modal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeUserMenuModal();
        }
    });
}

// 사용자 메뉴 모달 닫기
function closeUserMenuModal() {
    const modal = document.getElementById('user-menu-modal');
    if (modal) {
        modal.remove();
    }
}

// 로그아웃
function logoutUser() {
    if (confirm('로그아웃 하시겠습니까?')) {
        App.clearAuth();
    }
}
