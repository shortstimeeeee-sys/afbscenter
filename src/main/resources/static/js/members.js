// 회원 관리 페이지 JavaScript

let currentPage = 1;
let currentFilters = {};

document.addEventListener('DOMContentLoaded', function() {
    loadMembers();
    loadCoachesForSelect(); // 코치 목록 로드
    loadProductsForSelect(); // 상품 목록 로드
    
    // 검색 이벤트
    document.getElementById('member-search').addEventListener('input', debounce(handleSearch, 300));
    
    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
    
    // 상품 선택 시 스타일 적용 (이벤트에 연결)
    const productSelect = document.getElementById('member-products');
    if (productSelect) {
        // change 이벤트에 스타일 적용 함수 연결
        productSelect.addEventListener('change', function() {
            // 즉시 적용
            applySelectedProductStyles();
            // DOM 업데이트 후 다시 적용
            setTimeout(() => {
                applySelectedProductStyles();
            }, 100);
        });
    }
});

// 코치 목록을 select에 로드
async function loadCoachesForSelect() {
    try {
        const coaches = await App.api.get('/coaches');
        const select = document.getElementById('member-coach');
        select.innerHTML = '<option value="">코치 미지정</option>';
        coaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('코치 목록 로드 실패:', error);
    }
}

// 상품 목록을 select에 로드
async function loadProductsForSelect() {
    try {
        const products = await App.api.get('/products');
        const select = document.getElementById('member-products');
        if (!select) {
            console.warn('loadProductsForSelect: select를 찾을 수 없습니다.');
            return;
        }
        
        // 현재 선택된 값들 저장
        const selectedValues = Array.from(select.selectedOptions).map(opt => String(opt.value));
        
        // 기존 옵션 제거 (첫 번째 빈 옵션 제외)
        while (select.options.length > 0) {
            select.remove(0);
        }
        
        // 상품 옵션 추가
        products.forEach(product => {
            if (product.active !== false) { // 활성 상품만 표시
                const option = document.createElement('option');
                option.value = String(product.id);
                const productText = `${product.name} (${getProductTypeText(product.type)}) - ${App.formatCurrency(product.price)}`;
                option.textContent = productText;
                option.dataset.originalText = productText; // 원본 텍스트 저장 (중요!)
                
                // 이전에 선택되어 있던 항목 복원
                if (selectedValues.includes(String(product.id))) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            }
        });
        
        // 상품 목록 로드 후 선택된 항목 스타일 적용
        setTimeout(() => {
            applySelectedProductStyles();
        }, 100);
    } catch (error) {
        console.error('상품 목록 로드 실패:', error);
    }
}

function getProductTypeText(type) {
    const map = {
        'SINGLE_USE': '단건 대관',
        'TIME_PASS': '시간권',
        'COUNT_PASS': '회차권',
        'MONTHLY_PASS': '월정기',
        'TEAM_PACKAGE': '팀 대관 패키지'
    };
    return map[type] || type;
}

async function loadMembers() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            ...currentFilters
        });
        let members;
        // 검색어가 있으면 검색 API 사용
        if (currentFilters.search) {
            const searchQuery = currentFilters.search;
            // 회원번호 형식인지 확인 (M으로 시작)
            if (searchQuery.toUpperCase().startsWith('M')) {
                members = await App.api.get(`/members/search?memberNumber=${encodeURIComponent(searchQuery)}`);
            } else if (/^\d+$/.test(searchQuery.replace(/[-\s]/g, ''))) {
                // 숫자만 있으면 전화번호로 검색
                members = await App.api.get(`/members/search?phoneNumber=${encodeURIComponent(searchQuery)}`);
            } else {
                // 그 외는 이름으로 검색
                members = await App.api.get(`/members/search?name=${encodeURIComponent(searchQuery)}`);
            }
        } else {
            members = await App.api.get(`/members?${params}`);
        }
        renderMembersTable(members);
    } catch (error) {
        console.error('회원 목록 로드 실패:', error);
    }
}

function renderMembersTable(members) {
    const tbody = document.getElementById('members-table-body');
    
    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">회원이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = members.map(member => `
        <tr>
            <td><strong style="color: var(--accent-primary);">${member.memberNumber || '-'}</strong></td>
            <td><a href="#" onclick="openMemberDetail(${member.id}); return false;" style="color: var(--accent-primary);">${member.name}</a></td>
            <td><span class="badge badge-info">${getGradeText(member.grade)}</span></td>
            <td>${member.phoneNumber}</td>
            <td>${member.school || '-'}</td>
            <td>${member.coach?.name || '-'}</td>
            <td><span class="badge badge-${getStatusBadge(member.status)}">${getStatusText(member.status)}</span></td>
            <td>${App.formatDate(member.joinDate || member.createdAt)}</td>
            <td>
                ${member.latestLessonDate ? App.formatDate(member.latestLessonDate) : '-'}
                ${member.remainingCount > 0 ? `<br><small style="color: var(--accent-primary);">${member.remainingCount}회 남음</small>` : ''}
            </td>
            <td>${App.formatCurrency(member.totalPayment || 0)}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editMember(${member.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id})">삭제</button>
            </td>
        </tr>
    `).join('');
}

// 회원 등급 텍스트는 common.js의 App.MemberGrade 사용
function getGradeText(grade) {
    return App.MemberGrade.getText(grade);
}

// 상태 관련 함수는 common.js의 App.Status.member 사용
function getStatusBadge(status) {
    return App.Status.member.getBadge(status);
}

function getStatusText(status) {
    return App.Status.member.getText(status);
}

function handleSearch(e) {
    const query = e.target.value;
    if (query) {
        currentFilters.search = query;
    } else {
        delete currentFilters.search;
    }
    currentPage = 1;
    loadMembers();
}

function applyFilters() {
    const grade = document.getElementById('filter-grade').value;
    const status = document.getElementById('filter-status').value;
    
    currentFilters = {};
    if (grade) currentFilters.grade = grade;
    if (status) currentFilters.status = status;
    
    currentPage = 1;
    loadMembers();
}

function openMemberModal(id = null) {
    const modal = document.getElementById('member-modal');
    const title = document.getElementById('member-modal-title');
    const form = document.getElementById('member-form');
    
    if (id) {
        title.textContent = '회원 수정';
        loadMemberData(id);
    } else {
        title.textContent = '회원 등록';
        form.reset();
        // 신규 등록 시 회원번호 필드 비우기
        document.getElementById('member-number').value = '';
    }
    
    App.Modal.open('member-modal');
    
    // 수정 모달인 경우 loadMemberData가 완료된 후 스타일이 적용됨
    // 추가 안전장치로 모달이 완전히 열린 후에도 스타일 적용
    if (id) {
        setTimeout(() => {
            applySelectedProductStyles();
        }, 800);
    }
}

function editMember(id) {
    openMemberModal(id);
}

async function loadMemberData(id) {
    try {
        const member = await App.api.get(`/members/${id}`);
        // 기본 정보
        document.getElementById('member-id').value = member.id;
        document.getElementById('member-number').value = member.memberNumber || '';
        document.getElementById('member-name').value = member.name;
        document.getElementById('member-phone').value = member.phoneNumber;
        document.getElementById('member-birth').value = member.birthDate;
        document.getElementById('member-gender').value = member.gender;
        document.getElementById('member-height').value = member.height;
        document.getElementById('member-weight').value = member.weight;
        document.getElementById('member-grade').value = member.grade || 'REGULAR';
        document.getElementById('member-status').value = member.status || 'ACTIVE';
        // 주소 및 소속
        document.getElementById('member-address').value = member.address || '';
        document.getElementById('member-school').value = member.school || '';
        // 가입일
        document.getElementById('member-join-date').value = member.joinDate || '';
        // 등록일시 (소급 등록)
        if (member.createdAt) {
            const createdAt = new Date(member.createdAt);
            const year = createdAt.getFullYear();
            const month = String(createdAt.getMonth() + 1).padStart(2, '0');
            const day = String(createdAt.getDate()).padStart(2, '0');
            const hours = String(createdAt.getHours()).padStart(2, '0');
            const minutes = String(createdAt.getMinutes()).padStart(2, '0');
            document.getElementById('member-created-at').value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        // 코치
        document.getElementById('member-coach').value = member.coach?.id || '';
        // 보호자 정보
        document.getElementById('member-guardian-name').value = member.guardianName || '';
        document.getElementById('member-guardian-phone').value = member.guardianPhone || '';
        // 메모
        document.getElementById('member-memo').value = member.memo || '';
        document.getElementById('member-coach-memo').value = member.coachMemo || '';
        
        // 상품 정보 로드 (회원이 보유한 상품)
        await loadMemberProducts(id);
    } catch (error) {
        console.error('회원 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 선택된 옵션에 스타일 적용 함수 (select 박스 내에서 음영 표시)
let isApplyingStyles = false; // 무한 루프 방지 플래그
let lastApplyTime = 0; // 마지막 적용 시간

function applySelectedProductStyles() {
    const productSelect = document.getElementById('member-products');
    if (!productSelect) {
        console.warn('applySelectedProductStyles: productSelect를 찾을 수 없습니다.');
        return;
    }
    
    // 이미 적용 중이면 중단 (단, 200ms 이상 지나면 다시 시도)
    if (isApplyingStyles) {
        const now = Date.now();
        if (now - lastApplyTime < 200) {
            return;
        }
    }
    
    isApplyingStyles = true;
    lastApplyTime = Date.now();
    
    try {
        const options = Array.from(productSelect.options);
        let selectedCount = 0;
        
        console.log('applySelectedProductStyles 실행:', {
            totalOptions: options.length,
            selectedBefore: options.filter(opt => opt.selected).length
        });
        
        // 모든 옵션에 대해 스타일 적용
        options.forEach((option) => {
            // 빈 옵션은 건너뛰기
            if (!option.value || option.value === '') {
                return;
            }
            
            const isSelected = option.selected;
            
            // 원본 텍스트 가져오기 (dataset에 저장된 것 우선)
            let originalText = option.dataset.originalText;
            if (!originalText) {
                // 체크마크가 있으면 제거
                originalText = option.textContent.replace(/^✓ /, '').trim();
                if (originalText) {
                    option.dataset.originalText = originalText; // 저장
                } else {
                    // 원본 텍스트가 없으면 현재 텍스트 사용
                    originalText = option.textContent.trim();
                }
            }
            
            if (isSelected) {
                selectedCount++;
                
                // 선택된 옵션 - 강력한 스타일 적용
                option.style.cssText = `
                    background-color: rgba(94, 106, 210, 0.4) !important;
                    background: rgba(94, 106, 210, 0.4) !important;
                    color: #E6E8EB !important;
                    font-weight: 700 !important;
                    border-left: 4px solid #5E6AD2 !important;
                    padding-left: 10px !important;
                    padding-right: 6px !important;
                    padding-top: 8px !important;
                    padding-bottom: 8px !important;
                    margin: 3px 0 !important;
                `;
                
                option.setAttribute('data-selected', 'true');
                option.setAttribute('class', 'product-option-selected');
                
                // 텍스트 앞에 체크마크 추가 (시각적 표시)
                const currentText = option.textContent.trim();
                if (!currentText.startsWith('✓ ')) {
                    option.textContent = '✓ ' + originalText;
                }
                
                console.log(`선택된 옵션 스타일 적용: ${option.textContent} (ID: ${option.value})`);
            } else {
                // 선택되지 않은 옵션 - 스타일 제거
                option.style.cssText = '';
                option.removeAttribute('data-selected');
                option.removeAttribute('class');
                
                // 체크마크 제거하고 원본 텍스트로 복원
                option.textContent = originalText;
            }
        });
        
        productSelect.style.backgroundColor = 'var(--bg-secondary)';
        productSelect.style.borderColor = 'var(--border-color)';
        
        console.log(`applySelectedProductStyles 완료: 선택된 항목 ${selectedCount}개`);
    } catch (error) {
        console.error('applySelectedProductStyles 오류:', error);
    } finally {
        // 즉시 플래그 해제 (setTimeout 제거)
        isApplyingStyles = false;
    }
}

// 회원이 보유한 상품 목록 로드
async function loadMemberProducts(memberId) {
    try {
        // 상품 목록이 먼저 로드되었는지 확인
        const productSelect = document.getElementById('member-products');
        if (!productSelect) {
            console.warn('loadMemberProducts: productSelect를 찾을 수 없습니다.');
            return;
        }
        
        // 상품 목록이 없으면 먼저 로드
        if (productSelect.options.length === 0) {
            await loadProductsForSelect();
            // 상품 목록 로드 대기
            let attempts = 0;
            while (productSelect.options.length === 0 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
        }
        
        // 상품 목록이 여전히 없으면 종료
        if (productSelect.options.length === 0) {
            console.warn('loadMemberProducts: 상품 목록을 로드할 수 없습니다.');
            return;
        }
        
        // 회원 상세 정보에서 memberProducts 가져오기
        const member = await App.api.get(`/members/${memberId}`);
        
        // 기존 선택 해제
        Array.from(productSelect.options).forEach(option => {
            option.selected = false;
        });
        
        // 회원이 보유한 상품 선택
        if (member.memberProducts && member.memberProducts.length > 0) {
            member.memberProducts.forEach(mp => {
                const productId = String(mp.product?.id || mp.productId);
                const option = Array.from(productSelect.options).find(opt => String(opt.value) === productId);
                if (option) {
                    option.selected = true;
                }
            });
        }
        
        // 선택 후 즉시 스타일 적용 (수정 모달 열 때 이미 선택된 항목 음영 표시)
        applySelectedProductStyles();
        
        // DOM 업데이트 후 여러 번 스타일 적용 (확실하게)
        requestAnimationFrame(() => {
            applySelectedProductStyles();
            requestAnimationFrame(() => {
                applySelectedProductStyles();
            });
        });
        
        // 추가 지연 후에도 스타일 적용 (여러 번 시도)
        const applyTimes = [100, 300, 500, 800, 1200, 2000];
        applyTimes.forEach(delay => {
            setTimeout(() => {
                applySelectedProductStyles();
            }, delay);
        });
        
        // select에 change 이벤트 발생 (브라우저가 선택 상태를 인식하도록)
        productSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) {
        console.error('회원 상품 목록 로드 실패:', error);
    }
}

async function saveMember() {
    const form = document.getElementById('member-form');
    const memberId = document.getElementById('member-id').value;
    const isNewMember = !memberId;
    
    const memberNumber = document.getElementById('member-number').value.trim();
    const data = {
        name: document.getElementById('member-name').value,
        phoneNumber: document.getElementById('member-phone').value,
        memberNumber: memberNumber || null, // 회원번호가 있으면 설정, 없으면 null (자동 생성)
        birthDate: document.getElementById('member-birth').value,
        gender: document.getElementById('member-gender').value,
        height: parseInt(document.getElementById('member-height').value),
        weight: parseInt(document.getElementById('member-weight').value),
        grade: document.getElementById('member-grade').value,
        status: document.getElementById('member-status').value,
        address: document.getElementById('member-address').value,
        school: document.getElementById('member-school').value,
        guardianName: document.getElementById('member-guardian-name').value || null,
        guardianPhone: document.getElementById('member-guardian-phone').value || null,
        memo: document.getElementById('member-memo').value || null,
        coachMemo: document.getElementById('member-coach-memo').value || null
    };
    
    // 가입일 설정 (소급 등록 지원)
    const joinDate = document.getElementById('member-join-date').value;
    if (joinDate) {
        data.joinDate = joinDate;
    } else if (isNewMember) {
        // 신규 회원 등록 시 등록 일자 자동 설정 (가입일이 지정되지 않은 경우)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        data.joinDate = `${year}-${month}-${day}`;
    }
    // 수정 시에도 가입일 변경 가능 (소급 등록 지원)
    
    // 등록일시 설정 (소급 등록 지원)
    const createdAt = document.getElementById('member-created-at').value;
    if (createdAt) {
        // datetime-local 형식을 ISO 8601 형식으로 변환
        data.createdAt = createdAt + ':00'; // 초 추가
    }
    
    // 코치 설정
    const coachId = document.getElementById('member-coach').value;
    if (coachId) {
        data.coach = { id: parseInt(coachId) };
    } else {
        data.coach = null;
    }
    
    try {
        const id = document.getElementById('member-id').value;
        let savedMember;
        
        if (id) {
            savedMember = await App.api.put(`/members/${id}`, data);
            App.showNotification('회원이 수정되었습니다.', 'success');
        } else {
            savedMember = await App.api.post('/members', data);
            App.showNotification('회원이 등록되었습니다.', 'success');
        }
        
        // 선택된 상품 할당 및 결제 생성
        const productSelect = document.getElementById('member-products');
        const selectedProductIds = Array.from(productSelect.selectedOptions)
            .map(option => option.value)
            .filter(id => id && id !== '');
        
        if (selectedProductIds.length > 0) {
            await assignProductsToMember(savedMember.id, selectedProductIds);
        }
        
        App.Modal.close('member-modal');
        loadMembers();
    } catch (error) {
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

// 회원에게 상품 할당 및 결제 생성
async function assignProductsToMember(memberId, productIds) {
    try {
        // 기존 상품 할당 제거 후 새로 할당
        await App.api.delete(`/members/${memberId}/products`);
        
        // 새 상품 할당 및 결제 생성
        for (const productId of productIds) {
            await App.api.post(`/members/${memberId}/products`, { productId: parseInt(productId) });
        }
    } catch (error) {
        console.error('상품 할당 실패:', error);
        // 상품 할당 실패해도 회원 저장은 성공했으므로 경고만 표시
        App.showNotification('상품 할당에 실패했습니다.', 'warning');
    }
}

async function deleteMember(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/members/${id}`);
        App.showNotification('회원이 삭제되었습니다.', 'success');
        loadMembers();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

async function openMemberDetail(id) {
    try {
        const member = await App.api.get(`/members/${id}`);
        document.getElementById('member-detail-title').textContent = `${member.name} 상세 정보`;
        
        switchTab('info', member);
        App.Modal.open('member-detail-modal');
    } catch (error) {
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

function switchTab(tab, member = null) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    
    const content = document.getElementById('detail-tab-content');
    
    switch(tab) {
        case 'info':
            content.innerHTML = renderMemberInfo(member);
            break;
        case 'products':
            loadMemberProductsForDetail(member?.id);
            break;
        case 'bookings':
            loadMemberBookings(member?.id);
            break;
        case 'attendance':
            loadMemberAttendance(member?.id);
            break;
        case 'memo':
            content.innerHTML = renderMemberMemo(member);
            break;
    }
}

function renderMemberInfo(member) {
    if (!member) return '<p>로딩 중...</p>';
    return `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">이름</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.name}</div>
            </div>
            <div class="form-group">
                <label class="form-label">전화번호</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.phoneNumber}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">학교/소속</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.school || '-'}</div>
            </div>
            <div class="form-group">
                <label class="form-label">등급</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getGradeText(member.grade)}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">담당 코치</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${member.coach?.name || '-'}</div>
            </div>
        </div>
        <!-- 추가 정보 표시 -->
    `;
}

// 회원 상세 정보 탭에서 상품 목록 표시 (회원 수정 모달의 loadMemberProducts와 구분)
async function loadMemberProductsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    try {
        const products = await App.api.get(`/members/${memberId}/products`);
        content.innerHTML = renderProductsList(products);
    } catch (error) {
        content.innerHTML = '<p style="color: var(--text-muted);">이용권 내역을 불러올 수 없습니다.</p>';
    }
}

function renderProductsList(products) {
    if (!products || products.length === 0) {
        return '<p style="color: var(--text-muted);">이용권이 없습니다.</p>';
    }
    return `
        <div class="product-list">
            ${products.map(p => `
                <div class="product-item">
                    <div class="product-info">
                        <div class="product-name">${p.name}</div>
                        <div class="product-detail">잔여: ${p.remaining}/${p.total} | 유효기간: ${App.formatDate(p.expiryDate)}</div>
                    </div>
                    <span class="badge badge-${p.status === 'ACTIVE' ? 'success' : 'warning'}">${p.status}</span>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadMemberBookings(memberId) {
    const content = document.getElementById('detail-tab-content');
    try {
        const bookings = await App.api.get(`/members/${memberId}/bookings`);
        content.innerHTML = renderBookingsList(bookings);
    } catch (error) {
        content.innerHTML = '<p style="color: var(--text-muted);">예약 내역을 불러올 수 없습니다.</p>';
    }
}

function renderBookingsList(bookings) {
    if (!bookings || bookings.length === 0) {
        return '<p style="color: var(--text-muted);">예약 내역이 없습니다.</p>';
    }
    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>예약번호</th>
                        <th>시설</th>
                        <th>날짜/시간</th>
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookings.map(b => `
                        <tr>
                            <td>${b.id}</td>
                            <td>${b.facilityName}</td>
                            <td>${App.formatDateTime(b.startTime)}</td>
                            <td><span class="badge badge-${getStatusBadge(b.status)}">${getStatusText(b.status)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadMemberAttendance(memberId) {
    const content = document.getElementById('detail-tab-content');
    try {
        const attendance = await App.api.get(`/members/${memberId}/attendance`);
        content.innerHTML = renderAttendanceList(attendance);
    } catch (error) {
        content.innerHTML = '<p style="color: var(--text-muted);">출석 내역을 불러올 수 없습니다.</p>';
    }
}

function renderAttendanceList(attendance) {
    if (!attendance || attendance.length === 0) {
        return '<p style="color: var(--text-muted);">출석 내역이 없습니다.</p>';
    }
    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>날짜</th>
                        <th>시설</th>
                        <th>체크인 시간</th>
                        <th>체크아웃 시간</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendance.map(a => `
                        <tr>
                            <td>${App.formatDate(a.date)}</td>
                            <td>${a.facilityName}</td>
                            <td>${a.checkInTime || '-'}</td>
                            <td>${a.checkOutTime || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderMemberMemo(member) {
    if (!member) return '<p>로딩 중...</p>';
    return `
        <div class="form-group">
            <label class="form-label">코치 메모</label>
            <textarea class="form-control" rows="10" readonly style="background: var(--bg-tertiary);">${member.coachMemo || '메모가 없습니다.'}</textarea>
        </div>
    `;
}

function exportCSV() {
    App.showNotification('CSV 다운로드 기능은 준비 중입니다.', 'info');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
