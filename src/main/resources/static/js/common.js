// ========================================
// AFBS 센터 - 공통 JavaScript
// ========================================

// 전역 변수
const App = {
    currentUser: null,
    currentRole: null, // Admin, Manager, Coach, Front
    apiBase: '/api',
    authToken: null,
    // 디버그 로그: true면 콘솔 출력, false면 생략(운영 시 로그/토큰 노출 방지)
    debug: (function() {
        try {
            const h = window.location.hostname || '';
            return h === 'localhost' || h === '127.0.0.1';
        } catch (e) {
            return false;
        }
    })()
};
App.log = function() { if (App.debug) console.log.apply(console, arguments); };
App.warn = function() { if (App.debug) console.warn.apply(console, arguments); };
// 에러는 항상 콘솔에 출력 (디버깅·운영 공통)
App.err = function() { console.error.apply(console, arguments); };

/** XSS 방지: HTML에 넣을 사용자/API 입력 문자열 이스케이프. innerHTML 템플릿에서 변수에 사용 */
App.escapeHtml = function(str) {
    if (str == null) return '';
    var s = String(str);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
    App.log('인증 정보 복원 시도, 토큰 존재:', !!token);
    
    if (token) {
        const userStr = localStorage.getItem('currentUser');
        App.log('사용자 정보 존재:', !!userStr);
        
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                this.currentRole = this.currentUser.role;
                App.log('인증 정보 복원 성공:', {
                    username: this.currentUser.username,
                    role: this.currentRole
                });
                // 사용자명 표시 업데이트
                this.updateUserDisplay();
            } catch (e) {
                App.err('사용자 정보 복원 실패:', e);
                this.clearAuth();
            }
        } else {
            // 토큰은 있지만 사용자 정보가 없으면 세션 불일치 → 재로그인 유도
            App.warn('토큰은 있으나 사용자 정보가 localStorage에 없습니다. 재로그인이 필요합니다.');
            this.clearAuth();
        }
    } else {
        App.warn('인증 토큰이 localStorage에 없습니다');
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
        App.log('인증 헤더 추가됨, 토큰 길이:', token.length);
    } else {
        App.warn('인증 토큰이 없습니다!');
    }
    return headers;
};

// 401 발생 시 공통 처리: 인증 제거, 알림, 로그인 페이지로 이동
App.handle401 = function() {
    App.clearAuth();
    if (typeof App.showNotification === 'function') {
        App.showNotification('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', 'info');
    }
    setTimeout(function() {
        window.location.href = '/login.html';
    }, 600);
};

// 권한 데이터 캐시
App.rolePermissions = null;

// 권한 데이터 로드
App.loadRolePermissions = async function() {
    try {
        const response = await this.api.get('/role-permissions');
        this.rolePermissions = response.permissions || {};
        App.log('권한 데이터 로드 완료:', this.rolePermissions);
        return this.rolePermissions;
    } catch (error) {
        App.warn('권한 데이터 로드 실패, 기본 역할 계층 사용:', error);
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
        App.warn('권한 체크 실패: currentRole이 없습니다');
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
// 야구와 야구(유소년)는 공유 메뉴가 아닌 별도 메뉴임 (동일 권한 bookingView 사용)
const menuPermissionMap = {
    '/': 'dashboardView', // 대시보드
    '/members.html': 'memberView',
    '/coaches.html': 'coachView',
    '/bookings.html': 'bookingView',           // 야구 (사하/연산 각각 별도 페이지)
    '/bookings-saha-youth.html': 'bookingView', // 야구(유소년) 사하점 - 별도 메뉴
    '/bookings-saha-training.html': 'bookingView',
    '/bookings-yeonsan.html': 'bookingView',   // 야구 연산점
    '/bookings-yeonsan-youth.html': 'bookingView', // 야구(유소년) 연산점 - 별도 메뉴
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
    App.log('메뉴 필터링 시작, 현재 권한:', App.currentRole);
    
    // 권한 데이터가 없으면 로드 시도
    if (!App.rolePermissions) {
        await App.loadRolePermissions();
    }
    
    // menu-section의 data-role 처리
    const menuSections = document.querySelectorAll('.menu-section[data-role]');
    menuSections.forEach(section => {
        const requiredRole = section.getAttribute('data-role');
        const hasPermission = App.hasPermission(requiredRole);
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
        let href = item.getAttribute('href') || '';
        // href 정규화: 풀 URL이면 pathname만 사용, 상대경로면 앞에 / 붙임 (매핑 일치용)
        const path = href.startsWith('http') ? (function(u) { try { return new URL(u).pathname; } catch (_) { return href; } })(href) : (href.startsWith('/') ? href : '/' + href);
        
        let hasPermission = false;
        
        // 권한 데이터가 있는 경우에만 세부 권한 체크
        if (App.rolePermissions) {
            // 세부 권한이 지정된 경우 세부 권한 체크
            if (permissionKey) {
                hasPermission = App.hasPermission(requiredRole, permissionKey);
            } 
            // 스크린샷 발췌: 관리자(Admin)만 노출
            else if (path === '/screenshot-export.html') {
                hasPermission = (App.currentRole || '').toUpperCase() === 'ADMIN';
            }
            // href 기반으로 권한 매핑 확인 (정규화된 path 사용)
            else if (path && menuPermissionMap[path]) {
                const requiredPermission = menuPermissionMap[path];
                hasPermission = App.hasPermission(requiredRole, requiredPermission);
            }
            // 예약 관련 path(youth 포함)는 bookingView와 동일하게 처리하여 유소년 메뉴가 항상 야구와 함께 표시되도록
            else if (path && (path.includes('bookings') && path.includes('youth'))) {
                hasPermission = App.hasPermission(requiredRole, 'bookingView');
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
    });
    
    App.log('메뉴 필터링 완료');
};

// API 호출 헬퍼
App.api = {
    get: async function(url) {
        try {
            const headers = App.getAuthHeaders();
            
            const response = await fetch(`${App.apiBase}${url}`, {
                headers: headers
            });
            
            if (response.status === 401) {
                App.err('401 Unauthorized - 인증 실패');
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                App.err('API GET 오류 응답:', errorText);
                let data = errorText;
                try {
                    if (errorText && errorText.trim().startsWith('{')) data = JSON.parse(errorText);
                } catch (_) {}
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: data };
                throw error;
            }
            return await response.json();
        } catch (error) {
            App.err('API GET Error:', error);
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
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            let responseData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseData = await response.json();
                } catch (e) {
                    App.warn('JSON 파싱 실패:', e);
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
            App.err('API POST Error:', error);
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
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            let responseData = null;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseData = await response.json();
                } catch (e) {
                    App.warn('JSON 파싱 실패:', e);
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
            App.err('API PUT Error:', error);
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
                App.handle401();
                throw new Error('인증이 만료되었습니다.');
            }
            
            if (!response.ok) {
                let responseData = null;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    try {
                        responseData = await response.json();
                    } catch (e) {
                        App.warn('JSON 파싱 실패:', e);
                        responseData = { error: '응답 파싱 실패' };
                    }
                } else {
                    const text = await response.text();
                    responseData = { error: text || `HTTP ${response.status}` };
                }
                const error = new Error(`HTTP ${response.status}`);
                error.response = { status: response.status, data: responseData };
                throw error;
            }
            return response.status === 204 ? null : await response.json();
        } catch (error) {
            App.err('API DELETE Error:', error);
            throw error;
        }
    }
};

// ---------- 3.1 API 에러 메시지 사용자 노출 / 3.4 로딩·에러 UI ----------
// API 에러 응답의 message를 사용자 친화 문구로 매핑 (운영에서는 상세/스택 미노출)
App.apiErrorMessages = {
    '인증이 만료되었습니다.': '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
    '시설을 찾을 수 없습니다': '선택한 시설 정보를 찾을 수 없습니다.',
    '회원을 찾을 수 없습니다': '회원 정보를 찾을 수 없습니다.',
    '예약을 찾을 수 없습니다': '예약 정보를 찾을 수 없습니다.',
    '입력 데이터 검증에 실패했습니다.': '입력값을 확인해 주세요.',
    '서버 내부 오류가 발생했습니다.': '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    'Data Integrity Violation': '저장 조건을 만족하지 않습니다. 중복 또는 필수값을 확인해 주세요.',
    'Constraint Violation': '저장 조건을 만족하지 않습니다. 입력값을 확인해 주세요.'
};

App.getApiErrorMessage = function(err) {
    if (!err) return '요청 처리 중 오류가 발생했습니다.';
    let data = err.response && err.response.data;
    if (data && typeof data === 'object') {
        let msg = data.message || data.error || '';
        if (data.fieldErrors && typeof data.fieldErrors === 'object') {
            const fieldStr = Object.entries(data.fieldErrors).map(([f, m]) => f + ': ' + m).join(', ');
            if (fieldStr) msg = msg ? msg + ' (' + fieldStr + ')' : fieldStr;
        }
        if (msg) {
            let friendly = App.apiErrorMessages[msg] || msg;
            if (!App.debug && (data.stackTrace || data.errorClass || data.cause))
                friendly = friendly.replace(/\s*[:：].*$/, '').trim() || friendly;
            if (App.debug && (data.stackTrace || data.cause))
                friendly += ' [개발: ' + (data.stackTrace || data.cause || '') + ']';
            return friendly;
        }
    }
    if (err.message) {
        if (err.message.indexOf('인증이 만료') !== -1) return App.apiErrorMessages['인증이 만료되었습니다.'] || err.message;
        if (App.debug) return err.message;
        return '요청 처리 중 오류가 발생했습니다.';
    }
    return '요청 처리 중 오류가 발생했습니다.';
};

App.showApiError = function(err) {
    App.showNotification(App.getApiErrorMessage(err), 'error');
};

var _loadingCount = 0;
App.showLoading = function() {
    _loadingCount++;
    var el = document.getElementById('app-loading-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'app-loading-overlay';
        el.innerHTML = '<div class="app-loading-spinner"></div>';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
        document.body.appendChild(el);
    }
    el.style.display = 'flex';
};
App.hideLoading = function() {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount === 0) {
        var el = document.getElementById('app-loading-overlay');
        if (el) el.style.display = 'none';
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
        
        // 대관 담당 등
        '공인욱': '#2196F3',                 // 밝은 파랑
        '공인욱[대관담당]': '#2196F3',
        
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
        const coachId = coach.id ?? coach.name ?? coach;
        const coachCacheKey = coachId !== undefined && coachId !== null ? String(coachId) : '';
        let coachName = coach.name || '';
        const normalizeName = (name) => {
            if (!name) return '';
            let normalized = String(name).replace(/\s+/g, ' ').trim();
            if (!normalized) return '';
            normalized = normalized.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim();
            normalized = normalized.replace(/(대표|코치|강사|트레이너)/g, '').replace(/\s+/g, ' ').trim();
            return normalized;
        };
        const nameCandidates = [];
        if (coachName) {
            const trimmed = String(coachName).replace(/\s+/g, ' ').trim();
            nameCandidates.push(trimmed);
            nameCandidates.push(trimmed.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim());
            const normalized = normalizeName(trimmed);
            if (normalized) nameCandidates.push(normalized);
            nameCandidates.push(trimmed.replace(/\s+/g, ''));
        }
        
        // 고정 색상이 있으면 우선 사용 (캐시 완전히 무시하고 항상 고정 색상 사용)
        // 먼저 정확한 이름으로 찾기
        if (coachName) {
            for (const candidate of nameCandidates) {
                if (candidate && this.fixedColors[candidate]) {
                    const fixedColor = this.fixedColors[candidate];
                    if (coachCacheKey) {
                        this.colorCache[coachCacheKey] = fixedColor;
                    }
                    return fixedColor;
                }
            }
        }
        
        // 고정 색상이 없을 때만 캐시 확인
        if (coachCacheKey && this.colorCache[coachCacheKey]) {
            return this.colorCache[coachCacheKey];
        }
        
        // 코치 ID(또는 이름 해시)로 결정론적 인덱스 계산 → 코치/레슨·대관 등 모든 페이지에서 동일 코치 동일 색
        // 고정 색상은 제외한 팔레트 사용 → 박준현(#5E6AD2) 등과 겹치지 않도록
        const fixedValues = Object.values(this.fixedColors);
        const availablePalette = this.default.filter(c => !fixedValues.includes(c));
        const palette = availablePalette.length > 0 ? availablePalette : this.default;
        let seed = 0;
        if (typeof coach.id === 'number' && !isNaN(coach.id)) {
            seed = Math.abs(coach.id);
        } else if (coachName) {
            for (let i = 0; i < coachName.length; i++) {
                seed = ((seed << 5) - seed) + coachName.charCodeAt(i);
                seed = seed & 0x7fffffff;
            }
            seed = Math.abs(seed);
        }
        const colorIndex = seed % palette.length;
        const color = palette[colorIndex];
        
        if (coachCacheKey) {
            this.colorCache[coachCacheKey] = color;
        }
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

// 코치 표시 순서: 대표 → 대관 담당 → 메인 코치 → 야구 관련 코치 → 트레이닝 강사 → 필라테스 강사
App.CoachSortOrder = function(coach) {
    var name = (coach.name || '') + ' ' + (coach.specialties || '');
    var n = name.toLowerCase();
    if (/대표/.test(name)) return 0;
    if (/대관\s*담당|대관담당/.test(name)) return 1;
    if ((/\[코치\]|코치/.test(name)) && !/투수코치|포수코치/.test(name)) return 2;
    if (/투수코치|포수코치|야구|타격|투구|수비|포수|투수/.test(name)) return 3;
    if (/트레이너|트레이닝/.test(name)) return 4;
    if (/필라테스|강사/.test(name)) return 5;
    return 6;
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
            'YOUTH_BASEBALL': '유소년 야구',
            'PILATES': '필라테스 레슨',
            'TRAINING': '트레이닝 파트'
        };
        return map[category] || category || '-';
    },
    
    getBadge: function(category) {
        const map = {
            'BASEBALL': 'info',
            'YOUTH_BASEBALL': 'info',
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
            'YOUTH': '유소년',
            'OTHER': '기타 종목'
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
    
    // 현재 페이지 메뉴 활성화 (href 정규화하여 비교: 야구/야구(유소년) 별도 메뉴 동일 처리)
    const currentPath = (window.location.pathname || '/').replace(/\/$/, '') || '/';
    document.querySelectorAll('.menu-item').forEach(item => {
        let h = item.getAttribute('href') || '';
        const itemPath = h.startsWith('http') ? (function(u) { try { return new URL(u).pathname; } catch (_) { return h; } })(h) : (h.startsWith('/') ? h : '/' + h);
        if (itemPath === currentPath) {
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
        App.err('알림 개수 업데이트 실패:', error);
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
                    <div class="notification-title">${App.escapeHtml(announcement.title || '')}</div>
                    <div class="notification-time">${App.formatDateTime(announcement.createdAt)}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        App.err('알림 로드 실패:', error);
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
    
    // 이미 테마 영역이 있으면 컨테이너 통째로 제거 (버튼만 제거하면 라벨만 남아 아이콘이 사라짐)
    const existingContainer = document.querySelector('.theme-toggle-container');
    if (existingContainer) {
        existingContainer.remove();
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
    
    // 테마 버튼을 컨테이너로 감싸고 "테마" 라벨 추가 (아이콘 박스 밖 아래에 표시)
    const themeContainer = document.createElement('div');
    themeContainer.className = 'theme-toggle-container';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'theme-toggle-label';
    themeLabel.textContent = '테마';
    themeContainer.appendChild(toggleBtn);
    themeContainer.appendChild(themeLabel);
    
    // topbar-right에 삽입 (알림이 감싸져 있으면 컨테이너 앞에, 아니면 버튼 앞에)
    const notificationBtn = document.getElementById('notification-btn');
    let insertBeforeRef = null;
    if (notificationBtn) {
        const notifContainer = notificationBtn.closest('.notification-btn-container');
        insertBeforeRef = (notifContainer && notifContainer.parentNode === topbarRight)
            ? notifContainer
            : (notificationBtn.parentNode === topbarRight ? notificationBtn : null);
        if (insertBeforeRef) {
            topbarRight.insertBefore(themeContainer, insertBeforeRef);
        } else {
            topbarRight.prepend(themeContainer);
        }
        App.wrapNotificationWithLabel(topbarRight);
    } else {
        topbarRight.prepend(themeContainer);
    }
    
    App.log('테마 토글 버튼 추가 완료');
};

/** 알림 버튼을 컨테이너로 감싸고 "알림" 라벨을 아이콘 박스 밖 아래에 추가 (모든 페이지 공통) */
App.wrapNotificationWithLabel = function(topbarRight) {
    const notificationBtn = document.getElementById('notification-btn') || document.querySelector('.topbar-right .notification-btn');
    if (!notificationBtn || notificationBtn.closest('.notification-btn-container')) return;
    const container = document.createElement('div');
    container.className = 'notification-btn-container';
    const label = document.createElement('span');
    label.className = 'notification-btn-label';
    label.textContent = '알림';
    notificationBtn.parentNode.insertBefore(container, notificationBtn);
    container.appendChild(notificationBtn);
    container.appendChild(label);
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

// 스크린샷 발췌 미리보기: 개인정보 마스킹 — 이름/회원번호 컬럼인 td만 마스킹 (헤더 기준)
App.applyPageMask = function() {
    function getHeaderText(thOrTd) {
        return (thOrTd && thOrTd.textContent || '').trim();
    }
    function isNameColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /이름|회원명|코치|담당|성명|작성자/.test(h);
    }
    function isMemberNoColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /회원번호/.test(h) || (h === '번호');
    }
    function isSchoolGradeColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /학교|소속|등급/.test(h);
    }
    function isCumulativePaymentColumn(header) {
        if (!header) return false;
        var h = header.replace(/\s/g, '');
        return /누적결제|누적\s*결제/.test(h);
    }
    function maskCellText(td, doName, doMemberNo, doSchoolGrade, doCumulativePayment) {
        var walk = function(node) {
            if (!node) return;
            if (node.nodeType === 3) {
                var text = node.textContent;
                if (!text) return;
                var s = text;
                if ((doSchoolGrade || doCumulativePayment)) {
                    s = '*'.repeat(text.length);
                }
                if (doMemberNo) {
                    s = s.replace(/\bM(\d+)\b/g, function(_, digits) {
                        return 'M' + '*'.repeat(digits.length);
                    });
                }
                if (doName) {
                    var brackets = [];
                    s = s.replace(/\[[^\]]*\]/g, function(m) {
                        brackets.push(m);
                        return '\uFFFC' + (brackets.length - 1) + '\uFFFC';
                    });
                    var surnameFirst = '김이박최정강조윤장임한오서신권황안송류전홍문양손배백허유남심노하곽성차주우구선설마사방위봉탁연공반옥추변석염지진현알';
                    var skipWords = '임박';
                    s = s.replace(/([가-힣])([가-힣]{1,2})/g, function(match, first, rest) {
                        if (skipWords.indexOf(match) >= 0) return match;
                        if (surnameFirst.indexOf(first) === -1) return match;
                        return first + '*'.repeat(rest.length);
                    });
                    s = s.replace(/\uFFFC(\d+)\uFFFC/g, function(_, i) {
                        return brackets[parseInt(i, 10)] || '';
                    });
                }
                if (s !== text) node.textContent = s;
                return;
            }
            if ((node.tagName || '').toUpperCase() === 'SCRIPT' || (node.tagName || '').toUpperCase() === 'STYLE') return;
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
        };
        walk(td);
    }
    var tables = document.body.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
        var table = tables[t];
        var headerRow = table.querySelector('thead tr') || table.rows[0];
        if (!headerRow || !headerRow.cells) continue;
        var headers = [];
        for (var c = 0; c < headerRow.cells.length; c++) {
            headers.push(getHeaderText(headerRow.cells[c]));
        }
        var rows = table.querySelectorAll('tbody tr');
        if (!rows.length) rows = [];
        for (var r = 0; r < table.rows.length; r++) {
            var row = table.rows[r];
            if (row === headerRow) continue;
            for (var col = 0; col < row.cells.length; col++) {
                var cell = row.cells[col];
                if ((cell.tagName || '').toUpperCase() !== 'TD') continue;
                var colIndex = cell.cellIndex;
                if (colIndex < 0 || colIndex >= headers.length) continue;
                var header = headers[colIndex];
                var doName = isNameColumn(header);
                var doMemberNo = isMemberNoColumn(header);
                var doSchoolGrade = isSchoolGradeColumn(header);
                var doCumulativePayment = isCumulativePaymentColumn(header);
                if (doName || doMemberNo || doSchoolGrade || doCumulativePayment) maskCellText(cell, doName, doMemberNo, doSchoolGrade, doCumulativePayment);
            }
        }
    }
    function isInsideTd(node) {
        var p = node && (node.nodeType === 1 ? node : node.parentElement);
        while (p) {
            if ((p.tagName || '').toUpperCase() === 'TD') return true;
            p = p.parentElement;
        }
        return false;
    }
    function isInsideTitle(node) {
        var p = node && (node.nodeType === 1 ? node : node.parentElement);
        while (p) {
            var tag = (p.tagName || '').toUpperCase();
            if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') return true;
            if (p.classList && p.classList.contains('card-title')) return true;
            p = p.parentElement;
        }
        return false;
    }
    function isInsideRankingsFilter(node) {
        var p = node && (node.nodeType === 1 ? node : node.parentElement);
        while (p) {
            if (p.classList && p.classList.contains('rankings-filter-card')) return true;
            p = p.parentElement;
        }
        return false;
    }
    function applyInlineMask(text) {
        var s = text;
        s = s.replace(/\bM(\d+)\b/g, function(_, digits) { return 'M' + '*'.repeat(digits.length); });
        var brackets = [];
        s = s.replace(/\[[^\]]*\]/g, function(m) { brackets.push(m); return '\uFFFC' + (brackets.length - 1) + '\uFFFC'; });
        var surnameFirst = '김이박최정강조윤장임한오서신권황안송류전홍문양손배백허유남심노하곽성차주우구선설마사방위봉탁연공반옥추변석염지진현알';
        var skipWords = '임박';
        s = s.replace(/([가-힣])([가-힣]{1,2})/g, function(match, first, rest) {
            if (skipWords.indexOf(match) >= 0) return match;
            if (surnameFirst.indexOf(first) === -1) return match;
            return first + '*'.repeat(rest.length);
        });
        s = s.replace(/\uFFFC(\d+)\uFFFC/g, function(_, i) { return brackets[parseInt(i, 10)] || ''; });
        return s;
    }
    var skipTags = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1 };
    function walkNonTable(node) {
        if (!node) return;
        if (node.nodeType === 3) {
            var parent = node.parentElement;
            if (!parent || skipTags[(parent.tagName || '').toUpperCase()]) return;
            if (isInsideTd(node)) return;
            if (isInsideTitle(node)) return;
            if (isInsideRankingsFilter(node)) return;
            var text = node.textContent;
            if (!text || !text.trim()) return;
            var s = applyInlineMask(text);
            if (s !== text) node.textContent = s;
            return;
        }
        if (skipTags[(node.tagName || '').toUpperCase()]) return;
        for (var i = 0; i < node.childNodes.length; i++) walkNonTable(node.childNodes[i]);
    }
    walkNonTable(document.body);
};

// 스크린샷 발췌 미리보기: iframe에서 embed=1 로 열리면 사이드바/상단바 숨기고 본문만 표시
document.addEventListener('DOMContentLoaded', function() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('embed') === '1') {
        var sidebar = document.querySelector('.sidebar');
        var topbar = document.querySelector('.topbar');
        var main = document.querySelector('main.main-content');
        if (sidebar) sidebar.style.display = 'none';
        if (topbar) topbar.style.display = 'none';
        if (main) {
            main.style.marginLeft = '0';
            main.style.maxWidth = 'none';
        }
        document.body.style.overflow = 'auto';
        if (window.parent !== window) {
            setTimeout(function() { window.parent.postMessage('screenshot-export-ready', '*'); }, 0);
        }
    }
    if (params.get('mask') === '1' && typeof App.applyPageMask === 'function') {
        var maskTimer = null;
        function runMask() {
            App.applyPageMask();
            if (window.parent !== window) {
                window.parent.postMessage('screenshot-export-ready', '*');
            }
        }
        setTimeout(runMask, 100);
        setTimeout(runMask, 1500);
        try {
            var maskObserver = new MutationObserver(function(mutations) {
                var hasAdd = false;
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length) { hasAdd = true; break; }
                }
                if (!hasAdd) return;
                if (maskTimer) clearTimeout(maskTimer);
                maskTimer = setTimeout(runMask, 80);
            });
            maskObserver.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 페이지는 제외
    if (window.location.pathname !== '/login.html' && window.location.pathname !== '/login') {
        App.initDarkMode();
        App.initNotifications();
        App.initSearch();
        // 5분마다 알림 개수 업데이트
        setInterval(() => App.updateNotificationBadge(), 5 * 60 * 1000);
        
        // topbar-right: 테마·알림·사용자 아이콘+글씨 (모든 페이지 동일 적용)
        setTimeout(() => {
            App.addDarkModeToggle();
            const tr = document.querySelector('.topbar-right');
            if (tr) App.wrapNotificationWithLabel(tr);
        }, 100);
        setTimeout(() => {
            if (!document.getElementById('theme-toggle-btn')) App.addDarkModeToggle();
            const tr = document.querySelector('.topbar-right');
            if (tr) App.wrapNotificationWithLabel(tr);
        }, 300);
        setTimeout(() => {
            if (!document.getElementById('theme-toggle-btn')) App.addDarkModeToggle();
            const tr = document.querySelector('.topbar-right');
            if (tr) App.wrapNotificationWithLabel(tr);
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
                        <div class="search-title">${App.escapeHtml(m.name || '')}</div>
                        <div class="search-subtitle">${App.escapeHtml(m.phoneNumber || '')} • ${App.escapeHtml(m.memberNumber || '')}</div>
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
                        <div class="search-title">${App.escapeHtml(b.memberName || '이름 없음')}</div>
                        <div class="search-subtitle">${App.formatDate(b.bookingDate)} • ${App.escapeHtml(b.facilityName || '')}</div>
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
        App.err('검색 실패:', error);
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
    
    /* 다크 모드 토글 버튼 - 알림/사용자 버튼과 같은 행·같은 크기 */
    .theme-toggle-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: var(--radius-md);
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        flex-shrink: 0;
    }
    
    .theme-toggle-btn:hover {
        background: var(--bg-tertiary);
    }
`;

// ========================================
// 예약 복사 유틸리티 함수
// ========================================

/**
 * 예약을 다른 날짜로 복사하는 공통 함수
 * @param {number} sourceBookingId - 원본 예약 ID
 * @param {object} sourceBooking - 원본 예약 객체 (선택적)
 * @param {string} targetDateStr - 대상 날짜 (YYYY-MM-DD 형식)
 * @param {string} branch - 지점 코드 (SAHA, YEONSAN, RENTAL 등)
 * @param {function} onSuccess - 성공 시 콜백 (선택적)
 */
window.copyBookingToDate = async function(sourceBookingId, sourceBooking, targetDateStr, branch, onSuccess) {
    try {
        // 원본 예약 데이터 로드
        const booking = await App.api.get(`/bookings/${sourceBookingId}`);
        
        // 새 날짜로 시간 계산
        const targetDate = new Date(targetDateStr + 'T00:00:00');
        const originalStartTime = new Date(booking.startTime);
        const originalEndTime = new Date(booking.endTime);
        
        // 시간 부분 유지
        const hours = originalStartTime.getHours();
        const minutes = originalStartTime.getMinutes();
        const duration = originalEndTime.getTime() - originalStartTime.getTime();
        
        // 새 날짜에 시간 적용
        let newStartTime = new Date(targetDate);
        newStartTime.setHours(hours, minutes, 0, 0);
        // 복사본이 원본보다 이전이면 회차가 꼬이므로, 원본보다 뒤로만 생성 (원본 다음 날로 보정)
        if (newStartTime.getTime() <= originalStartTime.getTime()) {
            newStartTime = new Date(originalStartTime.getTime());
            newStartTime.setDate(newStartTime.getDate() + 1);
            newStartTime.setHours(hours, minutes, 0, 0);
            App.showNotification('선택한 날짜가 원본보다 이전이라, 원본 다음 날로 복사되었습니다.', 'info');
        }
        const newEndTime = new Date(newStartTime.getTime() + duration);
        
        // LocalDateTime 형식으로 변환 (YYYY-MM-DDTHH:mm:ss)
        const formatLocalDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        };
        
        // 새 예약 데이터 생성 (이용권은 memberProduct.id 또는 memberProductId로 전달해 복사본도 같은 회차 표시)
        const memberProductId = booking.memberProductId != null ? booking.memberProductId : (booking.memberProduct && booking.memberProduct.id != null ? booking.memberProduct.id : null);
        // 대관 페이지에서 복사 시 purpose는 반드시 RENTAL
        const purpose = (branch === 'RENTAL' ? 'RENTAL' : (booking.purpose || null));
        const newBooking = {
            facility: booking.facility ? { id: booking.facility.id } : null,
            memberNumber: booking.memberNumber || null,
            member: booking.member ? { id: booking.member.id } : null,
            nonMemberName: booking.nonMemberName || null,
            nonMemberPhone: booking.nonMemberPhone || null,
            coach: booking.coach ? { id: booking.coach.id } : null,
            memberProductId: memberProductId,
            startTime: formatLocalDateTime(newStartTime),
            endTime: formatLocalDateTime(newEndTime),
            participants: booking.participants || 1,
            purpose: purpose,
            lessonCategory: booking.lessonCategory || null,
            branch: branch || (window.BOOKING_PAGE_CONFIG || {}).branch || 'SAHA',
            status: 'PENDING',
            paymentMethod: booking.paymentMethod || null,
            memo: booking.memo || null,
            sourceBookingId: sourceBookingId
        };
        
        // 새 예약 생성
        const saved = await App.api.post('/bookings', newBooking);
        App.showNotification('예약이 복사되었습니다.', 'success');
        
        // 성공 콜백 호출
        if (onSuccess && typeof onSuccess === 'function') {
            onSuccess();
        }
        
        return saved;
    } catch (error) {
        App.err('예약 복사 실패:', error);
        App.showNotification('예약 복사에 실패했습니다.', 'danger');
        throw error;
    }
};
document.head.appendChild(style);

// 사용자명 표시 업데이트
App.updateUserDisplay = function() {
    // user-menu-btn 요소 찾기
    const userMenuBtn = document.getElementById('user-menu-btn') || document.querySelector('.user-menu-btn');
    if (!userMenuBtn) {
        App.warn('사용자 메뉴 버튼을 찾을 수 없습니다.');
        return;
    }
    
    // user-info-container가 있는지 확인
    let userInfoContainer = userMenuBtn.closest('.user-info-container');
    
    // user-info-container가 없으면 생성
    if (!userInfoContainer) {
        // 부모 요소 확인
        const parent = userMenuBtn.parentElement;
        if (parent && parent.classList.contains('topbar-right')) {
            // topbar-right 내부에 user-info-container 생성
            userInfoContainer = document.createElement('div');
            userInfoContainer.className = 'user-info-container';
            
            // user-menu-btn을 user-info-container로 이동
            parent.insertBefore(userInfoContainer, userMenuBtn);
            userInfoContainer.appendChild(userMenuBtn);
        } else {
            // 부모가 topbar-right가 아니면 user-menu-btn을 감싸기
            userInfoContainer = document.createElement('div');
            userInfoContainer.className = 'user-info-container';
            userMenuBtn.parentNode.insertBefore(userInfoContainer, userMenuBtn);
            userInfoContainer.appendChild(userMenuBtn);
        }
    }
    
    // user-username 요소 찾기 또는 생성 (아이콘 아래에 표시되도록 뒤에 삽입)
    let usernameElement = document.getElementById('user-username');
    if (!usernameElement) {
        usernameElement = document.createElement('span');
        usernameElement.className = 'user-username';
        usernameElement.id = 'user-username';
        // 아이콘 뒤에 삽입 (아래에 표시)
        userInfoContainer.appendChild(usernameElement);
    } else {
        // 이미 존재하는 경우에도 순서 확인 (아이콘 뒤에 있어야 함)
        if (usernameElement.previousSibling !== userMenuBtn) {
            userInfoContainer.appendChild(usernameElement);
        }
    }
    
    // 사용자명 표시 (이름 우선, 없으면 역할에 따른 표시명 사용)
    if (App.currentUser) {
        let displayName = '';
        
        // 1. name 필드가 있으면 name 사용
        if (App.currentUser.name && App.currentUser.name.trim()) {
            displayName = App.currentUser.name;
        } 
        // 2. 역할에 따른 표시명 사용
        else if (App.currentUser.role) {
            const roleDisplayNames = {
                'ADMIN': '관리자',
                'MANAGER': '매니저',
                'COACH': '코치',
                'FRONT': '데스크'
            };
            displayName = roleDisplayNames[App.currentUser.role.toUpperCase()] || App.currentUser.role;
        }
        // 3. 그것도 없으면 username 사용
        else if (App.currentUser.username) {
            displayName = App.currentUser.username;
        }
        
        if (displayName) {
            usernameElement.textContent = displayName;
            usernameElement.style.display = 'block';
        } else {
            usernameElement.style.display = 'none';
        }
    } else {
        usernameElement.style.display = 'none';
    }
};

// 페이지 로드 시 인증 체크 (로그인 페이지 제외)
document.addEventListener('DOMContentLoaded', function() {
    // 로그인 페이지는 제외
    if (window.location.pathname === '/login.html' || window.location.pathname === '/login') {
        App.restoreAuth();
        return;
    }

    // 먼저 인증 정보 복원 (중요: filterMenuByRole 전에 실행)
    App.restoreAuth();
    
    // 사용자명 표시 업데이트
    App.updateUserDisplay();

    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    if (!App.isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }

    // 스크린샷 발췌 페이지는 관리자(Admin)만 접근 가능
    if (window.location.pathname === '/screenshot-export.html' && (App.currentRole || '').toUpperCase() !== 'ADMIN') {
        window.location.href = '/';
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
        App.log('사용자 메뉴 버튼 찾기:', userMenuButtons.length, '개');
        
        // 사용자명 표시 업데이트
        App.updateUserDisplay();
        
        userMenuButtons.forEach(function(btn) {
            // 이미 이벤트 리스너가 등록되어 있는지 확인
            if (btn.hasAttribute('data-logout-setup')) {
                return;
            }
            
            App.log('사용자 메뉴 버튼 이벤트 리스너 등록');
            
            // 사용자 정보가 있으면 툴팁 설정
            if (App.currentUser && App.currentUser.name) {
                btn.title = `${App.currentUser.name} (${App.currentUser.role})`;
            }
            
            // 사용자 메뉴 클릭 시 사용자 정보 모달 표시
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                App.log('사용자 메뉴 버튼 클릭됨');
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
    setTimeout(() => {
        App.updateUserDisplay();
    }, 1000);
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
                App.log('코치 정보 조회 성공:', coach);
            }
        } catch (error) {
            // 404는 코치 정보가 없는 것이므로 정상 (모달은 계속 표시)
            if (error.response && error.response.status === 404) {
                App.log('코치 정보 없음 (정상) - 사용자 ID:', App.currentUser.id);
            } else {
                App.log('코치 정보 조회 실패:', error);
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
