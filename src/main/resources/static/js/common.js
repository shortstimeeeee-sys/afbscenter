// ========================================
// AFBS 센터 - 공통 JavaScript
// ========================================

// 전역 변수
const App = {
    currentUser: null,
    currentRole: 'Manager', // Admin, Manager, Coach, Front
    apiBase: '/api'
};

// 권한 체크
App.hasPermission = function(requiredRole) {
    const roleHierarchy = {
        'Front': 1,
        'Coach': 2,
        'Manager': 3,
        'Admin': 4
    };
    
    return roleHierarchy[App.currentRole] >= roleHierarchy[requiredRole];
};

// 메뉴 필터링 (권한 기반)
App.filterMenuByRole = function() {
    const menuItems = document.querySelectorAll('.menu-item[data-role]');
    menuItems.forEach(item => {
        const requiredRole = item.getAttribute('data-role');
        if (!App.hasPermission(requiredRole)) {
            item.style.display = 'none';
        }
    });
};

// API 호출 헬퍼
App.api = {
    get: async function(url) {
        try {
            const response = await fetch(`${App.apiBase}${url}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    },
    
    post: async function(url, data) {
        try {
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
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
            const response = await fetch(`${App.apiBase}${url}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
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
                method: 'DELETE'
            });
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
            document.body.style.overflow = '';
            // 이벤트 리스너 제거
            this.removeDragPrevention(modal);
        }
    },
    
    closeAll: function() {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
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
    default: [
        '#5E6AD2', '#4CAF50', '#FF9800', '#E91E63', '#00BCD4', 
        '#9C27B0', '#F44336', '#795548', '#2196F3', '#FF5722',
        '#009688', '#FFC107', '#673AB7', '#CDDC39', '#FF4081',
        '#3F51B5', '#8BC34A', '#FF6B6B', '#4ECDC4', '#45B7D1'
    ],
    
    // 특정 코치 이름에 대한 고정 색상 (빨간색 계열 제외)
    fixedColors: {
        '이원준 [포수담당]': '#00BCD4',      // 청록색
        '필라테스 이소연': '#9C27B0',        // 보라색
        '필라테스 이서현': '#FFC0CB',        // 핑크색
        '김승진 [유소년]': '#13C7A3',        // 민트색
        '이원준': '#00BCD4',                 // 포수담당과 동일
        '이소연': '#9C27B0',                 // 필라테스 이소연과 동일
        '이서현': '#FFC0CB',                 // 필라테스 이서현과 동일
        '김승진': '#13C7A3'                  // 유소년과 동일
    },
    
    // 코치별 색상 캐시 (ID -> 색상 매핑)
    colorCache: {},
    
    // 코치별 색상 가져오기 (중복 방지)
    getColor: function(coach) {
        if (!coach) return null;
        const coachId = coach.id || coach;
        const coachName = coach.name || '';
        
        // 고정 색상이 있으면 우선 사용
        if (this.fixedColors[coachName]) {
            const fixedColor = this.fixedColors[coachName];
            this.colorCache[coachId] = fixedColor;
            return fixedColor;
        }
        
        // 캐시에 있으면 반환
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
    }
};

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
            'ELITE': '엘리트',
            'YOUTH': '유소년'
        };
        return map[grade] || grade || '-';
    }
};

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 메뉴 필터링
    App.filterMenuByRole();
    
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

// 애니메이션 CSS 추가
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
`;
document.head.appendChild(style);
