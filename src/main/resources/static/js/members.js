// 회원 관리 페이지 JavaScript

// 기간권 날짜 포맷 (26. 01. 01. ~ 01. 31.)
function formatPeriodPass(startDate, endDate) {
    if (!startDate || !endDate) return '';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 시작일: YY. MM. DD.
    const startYear = String(start.getFullYear()).slice(-2);
    const startMonth = String(start.getMonth() + 1).padStart(2, '0');
    const startDay = String(start.getDate()).padStart(2, '0');
    
    // 종료일: MM. DD.
    const endMonth = String(end.getMonth() + 1).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');
    
    return `${startYear}. ${startMonth}. ${startDay}. ~ ${endMonth}. ${endDay}.`;
}

let currentPage = 1;
let currentFilters = {};
let currentMemberDetail = null; // 현재 상세 정보 모달에 표시 중인 회원 정보

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
    
    // 횟수 조정 모드 변경 이벤트
    document.addEventListener('change', function(e) {
        if (e.target.name === 'adjust-mode') {
            const mode = e.target.value;
            const amountInput = document.getElementById('adjust-amount');
            const amountLabel = document.getElementById('adjust-amount-label');
            const amountHint = document.getElementById('adjust-amount-hint');
            
            if (mode === 'absolute') {
                // 직접 설정 모드
                amountLabel.textContent = '설정할 횟수';
                amountInput.placeholder = '원하는 횟수 입력 (예: 10)';
                amountInput.value = '';
                amountHint.textContent = '직접 입력한 값으로 횟수가 설정됩니다 (0 이상)';
            } else {
                // 상대 조정 모드
                amountLabel.textContent = '조정할 횟수';
                amountInput.placeholder = '양수: 추가, 음수: 차감 (예: +5, -3)';
                amountInput.value = '';
                amountHint.textContent = '양수 입력 시 횟수 추가, 음수 입력 시 횟수 차감';
            }
        }
    });
    
    // URL 파라미터 확인하여 연장 모달 자동 열기
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get('id');
    const action = urlParams.get('action');
    
    if (memberId && action === 'extend') {
        // 페이지 로드 후 연장 모달 열기
        setTimeout(() => {
            openExtendProductModal(parseInt(memberId));
            // URL에서 action 파라미터 제거
            window.history.replaceState({}, document.title, `/members.html?id=${memberId}`);
        }, 500);
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
            
            // 검색 결과에 필터 적용 (클라이언트 측에서)
            if (currentFilters.grade) {
                members = members.filter(m => m.grade === currentFilters.grade);
            }
            if (currentFilters.status) {
                members = members.filter(m => m.status === currentFilters.status);
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
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-muted);">회원이 없습니다.</td></tr>';
        document.getElementById('pagination-container').innerHTML = '';
        return;
    }
    
    // 회원 수 표시
    document.getElementById('pagination-container').innerHTML = `
        <div style="text-align: center; padding: 16px; font-weight: 600; color: var(--text-primary);">
            총 <span style="color: var(--accent-primary); font-size: 18px;">${members.length}</span>명의 회원이 등록되어 있습니다.
        </div>
    `;
    
    tbody.innerHTML = members.map(member => `
        <tr>
            <td><strong style="color: var(--accent-primary);">${member.memberNumber || '-'}</strong></td>
            <td><a href="#" onclick="openMemberDetail(${member.id}); return false;" style="color: var(--accent-primary);">${member.name}</a></td>
            <td><span class="badge badge-${getGradeBadge(member.grade)}">${getGradeText(member.grade)}</span></td>
            <td>${member.phoneNumber}</td>
            <td>${member.school || '-'}</td>
            <td>${member.coach?.name || '-'}</td>
            <td><span class="badge badge-${getStatusBadge(member.status)}">${getStatusText(member.status)}</span></td>
            <td>${App.formatDate(member.joinDate || member.createdAt)}</td>
            <td>
                ${member.latestLessonDate ? App.formatDate(member.latestLessonDate) : '-'}
                ${renderMemberProductsRemaining(member)}
            </td>
            <td>${App.formatCurrency(member.totalPayment || 0)}</td>
            <td style="text-align: center;">
                <button class="btn btn-sm btn-primary" onclick="openExtendProductModal(${member.id})">연장</button>
            </td>
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

// 회원 등급별 배지 색상
function getGradeBadge(grade) {
    switch(grade) {
        case 'ELITE_ELEMENTARY':
            return 'elite-elementary';  // 초등: 밝은 녹색
        case 'ELITE_MIDDLE':
            return 'elite-middle';      // 중등: 밝은 파란색
        case 'ELITE_HIGH':
            return 'elite-high';        // 고등: 밝은 주황색
        case 'SOCIAL':
            return 'secondary';         // 일반: 회색
        default:
            return 'info';              // 기본: 하늘색
    }
}

// 상태 관련 함수는 common.js의 App.Status.member 사용
function getStatusBadge(status) {
    return App.Status.member.getBadge(status);
}

function getStatusText(status) {
    return App.Status.member.getText(status);
}

// 남은 횟수에 따른 색상 반환
function getRemainingCountColor(count) {
    if (count >= 1 && count <= 2) {
        return '#dc3545'; // 빨간색 (1~2회)
    } else if (count >= 3 && count <= 5) {
        return '#fd7e14'; // 주황색 (3~5회)
    } else {
        return '#28a745'; // 초록색 (6회 이상)
    }
}

// 회원의 상품별 남은 횟수 표시
function renderMemberProductsRemaining(member) {
    let html = '';
    
    // 횟수권 상품들 표시
    if (member.memberProducts && member.memberProducts.length > 0) {
        const countPassProducts = member.memberProducts.filter(mp => 
            mp.product && mp.product.type === 'COUNT_PASS' && 
            mp.status === 'ACTIVE'
        );
        
        if (countPassProducts.length > 0) {
            const productLines = countPassProducts.map(mp => {
                const productName = mp.product.name || '상품';
                
                // remainingCount가 null이면 totalCount 또는 product.usageCount 사용
                let remaining = mp.remainingCount;
                if (remaining === null || remaining === undefined) {
                    remaining = mp.totalCount || mp.product.usageCount || 10;
                }
                
                const color = getRemainingCountColor(remaining);
                const weight = remaining <= 5 ? '700' : '600';
                return `<span style="color: ${color}; font-weight: ${weight};">${productName}: ${remaining}회</span>`;
            }).join('<br>');
            
            html += `<br><small>${productLines}</small>`;
        }
    }
    
    // 기간권 표시
    if (member.periodPassEndDate) {
        html += `<br><small style="color: var(--accent-success);">${formatPeriodPass(member.periodPassStartDate, member.periodPassEndDate)}</small>`;
    }
    
    return html;
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
        // 회원 ID와 회원번호를 명시적으로 빈 값으로 설정 (덮어쓰기 방지)
        document.getElementById('member-id').value = '';
        document.getElementById('member-number').value = '';
        console.log('회원 등록 모달 열림 - ID 및 회원번호 초기화 완료');
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
        document.getElementById('member-grade').value = member.grade || 'SOCIAL';
        document.getElementById('member-status').value = member.status || 'ACTIVE';
        // 주소 및 소속
        document.getElementById('member-address').value = member.address || '';
        document.getElementById('member-school').value = member.school || '';
        // 야구 기록
        document.getElementById('member-swing-speed').value = member.swingSpeed || '';
        document.getElementById('member-exit-velocity').value = member.exitVelocity || '';
        document.getElementById('member-pitching-speed').value = member.pitchingSpeed || '';
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

async function saveMember(allowDuplicatePhone = false) {
    const form = document.getElementById('member-form');
    const memberId = document.getElementById('member-id').value;
    const isNewMember = !memberId;
    
    const memberNumber = document.getElementById('member-number').value.trim();
    const birthDateValue = document.getElementById('member-birth').value;
    const heightValue = document.getElementById('member-height').value;
    const weightValue = document.getElementById('member-weight').value;
    const phoneNumber = document.getElementById('member-phone').value.trim();
    
    // 전화번호 중복 체크 (신규 등록이고 아직 확인하지 않은 경우)
    if (!memberId && !allowDuplicatePhone && phoneNumber) {
        try {
            const existingMembers = await App.api.get(`/members/search?phoneNumber=${encodeURIComponent(phoneNumber)}`);
            
            if (existingMembers && existingMembers.length > 0) {
                // 중복된 전화번호가 있음
                const memberNames = existingMembers.map(m => m.name).join(', ');
                const confirmed = confirm(
                    `전화번호 '${phoneNumber}'은(는) 이미 등록되어 있습니다.\n` +
                    `등록된 회원: ${memberNames}\n\n` +
                    `형제 또는 가족으로 같은 전화번호를 사용하시겠습니까?\n\n` +
                    `[확인]: 같은 전화번호로 등록\n` +
                    `[취소]: 전화번호 수정`
                );
                
                if (!confirmed) {
                    App.showNotification('전화번호를 다시 확인해주세요.', 'warning');
                    return;
                }
                
                // 사용자가 확인했으므로 중복 허용
                return saveMember(true);
            }
        } catch (error) {
            console.warn('전화번호 중복 체크 실패:', error);
            // 체크 실패해도 저장은 시도
        }
    }
    
    const data = {
        name: document.getElementById('member-name').value,
        phoneNumber: phoneNumber,
        allowDuplicatePhone: allowDuplicatePhone, // 중복 허용 플래그
        memberNumber: memberNumber || null, // 회원번호가 있으면 설정, 없으면 null (자동 생성)
        birthDate: birthDateValue || null,
        gender: document.getElementById('member-gender').value,
        height: heightValue ? parseInt(heightValue) : null,
        weight: weightValue ? parseInt(weightValue) : null,
        grade: document.getElementById('member-grade').value,
        status: document.getElementById('member-status').value,
        address: document.getElementById('member-address').value,
        school: document.getElementById('member-school').value,
        swingSpeed: document.getElementById('member-swing-speed').value ? parseFloat(document.getElementById('member-swing-speed').value) : null,
        exitVelocity: document.getElementById('member-exit-velocity').value ? parseFloat(document.getElementById('member-exit-velocity').value) : null,
        pitchingSpeed: document.getElementById('member-pitching-speed').value ? parseFloat(document.getElementById('member-pitching-speed').value) : null,
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
            // 수정 모드
            savedMember = await App.api.put(`/members/${id}`, data);
            App.showNotification('회원이 수정되었습니다.', 'success');
        } else {
            // 등록 모드 - data 객체에 id가 있으면 제거 (덮어쓰기 방지)
            delete data.id;
            console.log('회원 등록 요청 - ID 없음 확인:', data);
            savedMember = await App.api.post('/members', data);
            App.showNotification('회원이 등록되었습니다.', 'success');
        }
        
        // 선택된 상품 할당 및 결제 생성 (변경된 경우에만)
        const productSelect = document.getElementById('member-products');
        const selectedProductIds = Array.from(productSelect.selectedOptions)
            .map(option => option.value)
            .filter(id => id && id !== '');
        
        // 기존 상품과 비교하여 변경된 경우에만 재할당
        if (id) {
            // 수정 모드: 기존 상품과 비교
            const member = await App.api.get(`/members/${id}`);
            const existingProductIds = (member.memberProducts || [])
                .map(mp => String(mp.product?.id || mp.productId))
                .filter(id => id && id !== '')
                .sort();
            const newProductIds = selectedProductIds.map(id => String(id)).sort();
            
            // 상품이 변경된 경우에만 재할당
            const productsChanged = JSON.stringify(existingProductIds) !== JSON.stringify(newProductIds);
            if (productsChanged) {
                if (selectedProductIds.length > 0) {
                    await assignProductsToMember(savedMember.id, selectedProductIds);
                } else {
                    // 상품이 모두 제거된 경우
                    await App.api.delete(`/members/${savedMember.id}/products`);
                }
            }
        } else {
            // 신규 등록: 상품이 있으면 할당
            if (selectedProductIds.length > 0) {
                await assignProductsToMember(savedMember.id, selectedProductIds);
            }
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
        currentMemberDetail = member; // 현재 회원 정보 저장
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
    
    // member가 전달되지 않았으면 저장된 currentMemberDetail 사용
    if (!member && currentMemberDetail) {
        member = currentMemberDetail;
    }
    
    const content = document.getElementById('detail-tab-content');
    
    switch(tab) {
        case 'info':
            content.innerHTML = renderMemberInfo(member);
            break;
        case 'products':
            if (member?.id) {
                loadMemberProductsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'payments':
            if (member?.id) {
                loadMemberPayments(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'bookings':
            if (member?.id) {
                loadMemberBookings(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'attendance':
            if (member?.id) {
                loadMemberAttendance(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
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
    if (!memberId) {
        content.innerHTML = '<p style="color: var(--text-muted);">회원 ID가 없습니다.</p>';
        return;
    }
    try {
        const products = await App.api.get(`/member-products?memberId=${memberId}`);
        console.log('이용권 목록 로드:', products);
        content.innerHTML = renderProductsList(products);
    } catch (error) {
        console.error('이용권 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">이용권 내역을 불러올 수 없습니다.</p>';
    }
}

function renderProductsList(products) {
    if (!products || products.length === 0) {
        return '<p style="color: var(--text-muted);">이용권이 없습니다.</p>';
    }
    return `
        <div class="product-list">
            ${products.map(p => {
                const product = p.product || {};
                const productName = product.name || '알 수 없음';
                const remaining = p.remainingCount !== undefined ? p.remainingCount : p.remaining || 0;
                const total = p.totalCount !== undefined ? p.totalCount : p.total || 0;
                const expiryDate = p.expiryDate ? App.formatDate(p.expiryDate) : '-';
                const status = p.status || 'UNKNOWN';
                const productId = p.id;
                const isCountPass = product.type === 'COUNT_PASS';
                const isMonthlyPass = product.type === 'MONTHLY_PASS';
                const startDate = p.purchaseDate ? App.formatDate(p.purchaseDate.split('T')[0]) : '-';
                
                // 패키지 항목별 잔여 횟수 표시
                let remainingDisplay = '';
                if (p.packageItemsRemaining) {
                    try {
                        const packageItems = JSON.parse(p.packageItemsRemaining);
                        const itemsText = packageItems.map(item => `${item.name} ${item.remaining}회`).join(', ');
                        remainingDisplay = `<strong style="color: var(--accent-primary);">[패키지]</strong> ${itemsText}`;
                    } catch (e) {
                        remainingDisplay = `잔여: ${remaining}/${total}`;
                    }
                } else {
                    remainingDisplay = `잔여: ${remaining}/${total}`;
                }
                
                return `
                <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border-color);">
                    <div class="product-info" style="flex: 1;">
                        <div class="product-name" style="font-weight: 600; margin-bottom: 4px;">${productName}</div>
                        <div class="product-detail" style="font-size: 14px; color: var(--text-secondary);">
                            ${remainingDisplay} | ${isMonthlyPass ? `시작일: ${startDate} | ` : ''}유효기간: ${expiryDate}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge badge-${status === 'ACTIVE' ? 'success' : status === 'EXPIRED' ? 'warning' : 'secondary'}">${status}</span>
                        ${isCountPass ? `
                            <button class="btn btn-sm btn-secondary" onclick="openAdjustCountModal(${productId}, ${remaining})" title="횟수 조정">
                                조정
                            </button>
                        ` : ''}
                        ${isMonthlyPass ? `
                            <button class="btn btn-sm btn-secondary" onclick="openEditPeriodPassModal(${productId}, '${p.purchaseDate?.split('T')[0] || ''}', '${p.expiryDate || ''}')" title="기간 수정">
                                기간 수정
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

// 횟수 조정 모달 열기
async function openAdjustCountModal(productId, currentRemaining) {
    document.getElementById('adjust-product-id').value = productId;
    document.getElementById('adjust-current-count').textContent = `현재 잔여 횟수: ${currentRemaining}회`;
    document.getElementById('adjust-amount').value = '';
    App.Modal.open('adjust-count-modal');
}

// 횟수 조정 처리
async function processAdjustCount() {
    const productId = document.getElementById('adjust-product-id').value;
    const amountInput = document.getElementById('adjust-amount').value;
    const adjustMode = document.querySelector('input[name="adjust-mode"]:checked').value;
    const currentCount = parseInt(document.getElementById('adjust-current-count').textContent.replace(/[^0-9]/g, '')) || 0;
    
    if (!amountInput || amountInput.trim() === '') {
        App.showNotification('횟수를 입력해주세요.', 'warning');
        return;
    }
    
    const inputValue = parseInt(amountInput);
    if (isNaN(inputValue)) {
        App.showNotification('유효한 숫자를 입력해주세요.', 'warning');
        return;
    }
    
    try {
        let result;
        
        if (adjustMode === 'absolute') {
            // 절대값 설정 모드: 직접 입력한 값으로 설정
            if (inputValue < 0) {
                App.showNotification('직접 설정 모드에서는 0 이상의 값을 입력해주세요.', 'warning');
                return;
            }
            
            result = await App.api.put(`/member-products/${productId}/set-count`, {
                count: inputValue
            });
        } else {
            // 상대 조정 모드: +/- 방식
            if (inputValue === 0) {
                App.showNotification('0이 아닌 값을 입력해주세요. (양수: 추가, 음수: 차감)', 'warning');
                return;
            }
            
            result = await App.api.put(`/member-products/${productId}/adjust-count`, {
                amount: inputValue
            });
        }
        
        App.showNotification(result.message || '횟수가 조정되었습니다.', 'success');
        App.Modal.close('adjust-count-modal');
        
        // 이용권 목록 새로고침
        if (currentMemberDetail && currentMemberDetail.id) {
            loadMemberProductsForDetail(currentMemberDetail.id);
        }
        
        // 회원 목록도 새로고침 (잔여 횟수 업데이트)
        loadMembers();
    } catch (error) {
        App.showNotification('횟수 조정에 실패했습니다.', 'danger');
    }
}

// 종료일 자동 계산 함수 (시작일 + 30일)
function autoCalculateEndDate() {
    const startDateInput = document.getElementById('edit-period-start-date');
    const endDateInput = document.getElementById('edit-period-end-date');
    
    if (!startDateInput || !endDateInput) {
        console.log('입력 필드를 찾을 수 없습니다.');
        return;
    }
    
    const value = startDateInput.value;
    console.log('시작일 변경됨:', value);
    
    // 유효한 날짜가 입력되었는지 확인
    if (value && value.length >= 10) {
        try {
            const start = new Date(value);
            // 유효한 날짜인지 확인
            if (!isNaN(start.getTime())) {
                const end = new Date(start);
                end.setDate(end.getDate() + 30); // 30일 추가
                
                // YYYY-MM-DD 형식으로 변환
                const endDateStr = end.toISOString().split('T')[0];
                endDateInput.value = endDateStr;
                console.log('종료일 자동 설정:', endDateStr);
            } else {
                console.log('유효하지 않은 날짜');
            }
        } catch (e) {
            console.error('날짜 파싱 오류:', e);
        }
    }
}

// 기간권 기간 수정 모달 열기
async function openEditPeriodPassModal(productId, startDate, endDate) {
    document.getElementById('edit-period-product-id').value = productId;
    document.getElementById('edit-period-start-date').value = startDate || '';
    document.getElementById('edit-period-end-date').value = endDate || '';
    
    App.Modal.open('edit-period-pass-modal');
    
    // 모달이 열린 후 이벤트 리스너 추가 및 초기 계산
    setTimeout(() => {
        const startDateInput = document.getElementById('edit-period-start-date');
        if (startDateInput) {
            console.log('시작일 input에 이벤트 리스너 추가');
            
            // 기존 이벤트 제거 후 새로 추가
            startDateInput.onchange = null;
            startDateInput.oninput = null;
            
            startDateInput.addEventListener('change', function() {
                console.log('change 이벤트 발생');
                autoCalculateEndDate();
            });
            
            startDateInput.addEventListener('input', function() {
                console.log('input 이벤트 발생');
                autoCalculateEndDate();
            });
            
            // 캘린더를 클릭할 때마다 계산 (이미 선택된 날짜를 다시 클릭해도)
            startDateInput.addEventListener('click', function() {
                console.log('시작일 필드 클릭됨');
                // 약간의 지연 후 계산 (캘린더에서 날짜 선택 완료 후)
                setTimeout(() => {
                    if (this.value) {
                        console.log('클릭 후 값 있음, 종료일 계산');
                        autoCalculateEndDate();
                    }
                }, 50);
            });
            
            // 모달 열릴 때 시작일이 이미 있으면 즉시 종료일 계산
            if (startDateInput.value) {
                console.log('모달 열릴 때 시작일 있음, 즉시 종료일 계산');
                autoCalculateEndDate();
            }
        } else {
            console.error('시작일 input을 찾을 수 없음');
        }
    }, 100);
}

// 기간권 기간 수정 처리
async function processEditPeriodPass() {
    const productId = document.getElementById('edit-period-product-id').value;
    const startDate = document.getElementById('edit-period-start-date').value;
    const endDate = document.getElementById('edit-period-end-date').value;
    
    if (!startDate || !endDate) {
        App.showNotification('시작일과 종료일을 모두 입력해주세요.', 'warning');
        return;
    }
    
    // 시작일이 종료일보다 늦으면 안됨
    if (new Date(startDate) > new Date(endDate)) {
        App.showNotification('시작일은 종료일보다 늦을 수 없습니다.', 'warning');
        return;
    }
    
    try {
        const result = await App.api.put(`/member-products/${productId}/update-period`, {
            startDate: startDate,
            endDate: endDate
        });
        
        App.showNotification(result.message || '기간이 수정되었습니다.', 'success');
        App.Modal.close('edit-period-pass-modal');
        
        // 이용권 목록 새로고침
        if (currentMemberDetail && currentMemberDetail.id) {
            loadMemberProductsForDetail(currentMemberDetail.id);
        }
        
        // 회원 목록도 새로고침
        loadMembers();
    } catch (error) {
        App.showNotification('기간 수정에 실패했습니다.', 'danger');
    }
}

async function loadMemberPayments(memberId) {
    const content = document.getElementById('detail-tab-content');
    try {
        const payments = await App.api.get(`/members/${memberId}/payments`);
        content.innerHTML = renderPaymentsList(payments);
    } catch (error) {
        console.error('결제 내역 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">결제 내역을 불러올 수 없습니다.</p>';
    }
}

function renderPaymentsList(payments) {
    if (!payments || payments.length === 0) {
        return '<p style="color: var(--text-muted);">결제 내역이 없습니다.</p>';
    }
    
    function getPaymentMethodText(method) {
        const methodMap = {
            'CASH': '현금',
            'CARD': '카드',
            'BANK_TRANSFER': '계좌이체',
            'EASY_PAY': '간편결제'
        };
        return methodMap[method] || method;
    }
    
    function getCategoryText(category) {
        const categoryMap = {
            'RENTAL': '대관',
            'LESSON': '레슨',
            'PRODUCT_SALE': '상품판매'
        };
        return categoryMap[category] || category;
    }
    
    function getStatusText(status) {
        const statusMap = {
            'COMPLETED': '완료',
            'PARTIAL': '부분 결제',
            'REFUNDED': '환불'
        };
        return statusMap[status] || status;
    }
    
    function getStatusBadge(status) {
        const badgeMap = {
            'COMPLETED': 'success',
            'PARTIAL': 'warning',
            'REFUNDED': 'danger'
        };
        return badgeMap[status] || 'secondary';
    }
    
    return `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>결제일시</th>
                        <th>상품명</th>
                        <th>카테고리</th>
                        <th>코치</th>
                        <th>결제방법</th>
                        <th>금액</th>
                        <th>상태</th>
                        <th>메모</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => {
                        const paidAt = p.paidAt ? App.formatDateTime(p.paidAt) : '-';
                        const productName = p.product?.name || '-';
                        const category = getCategoryText(p.category);
                        const method = getPaymentMethodText(p.paymentMethod);
                        const amount = App.formatCurrency(p.amount || 0);
                        const status = getStatusText(p.status);
                        const statusBadge = getStatusBadge(p.status);
                        const memo = p.memo || '-';
                        const refundAmount = p.refundAmount || 0;
                        
                        const coachName = p.coach?.name || '-';
                        
                        return `
                        <tr>
                            <td>${paidAt}</td>
                            <td>${productName}</td>
                            <td>${category}</td>
                            <td>${coachName}</td>
                            <td>${method}</td>
                            <td style="font-weight: 600; color: var(--accent-primary);">
                                ${amount}
                                ${refundAmount > 0 ? `<br><small style="color: var(--danger);">환불: ${App.formatCurrency(refundAmount)}</small>` : ''}
                            </td>
                            <td><span class="badge badge-${statusBadge}">${status}</span></td>
                            <td>${memo}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
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
    
    // 예약 상태 텍스트 변환 함수
    function getBookingStatusText(status) {
        const statusMap = {
            'PENDING': '대기',
            'CONFIRMED': '확정',
            'CANCELLED': '취소',
            'NO_SHOW': '노쇼',
            'COMPLETED': '완료'
        };
        return statusMap[status] || status;
    }
    
    // 예약 상태 배지 색상 함수
    function getBookingStatusBadge(status) {
        const badgeMap = {
            'PENDING': 'warning',
            'CONFIRMED': 'success',
            'CANCELLED': 'secondary',
            'NO_SHOW': 'danger',
            'COMPLETED': 'info'
        };
        return badgeMap[status] || 'secondary';
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
                    ${bookings.map(b => {
                        const facilityName = b.facility?.name || b.facilityName || '-';
                        const startTime = b.startTime ? App.formatDateTime(b.startTime) : '-';
                        const status = b.status || 'UNKNOWN';
                        const statusText = getBookingStatusText(status);
                        const statusBadge = getBookingStatusBadge(status);
                        
                        return `
                        <tr>
                            <td>${b.id || '-'}</td>
                            <td>${facilityName}</td>
                            <td>${startTime}</td>
                            <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                        </tr>
                    `;
                    }).join('')}
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
    
    // 출석 상태 텍스트 변환 함수
    function getAttendanceStatusText(status) {
        const statusMap = {
            'PRESENT': '출석',
            'ABSENT': '결석',
            'LATE': '지각',
            'NO_SHOW': '노쇼'
        };
        return statusMap[status] || status;
    }
    
    // 출석 상태 배지 색상 함수
    function getAttendanceStatusBadge(status) {
        const badgeMap = {
            'PRESENT': 'success',
            'ABSENT': 'secondary',
            'LATE': 'warning',
            'NO_SHOW': 'danger'
        };
        return badgeMap[status] || 'secondary';
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
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendance.map(a => {
                        const facilityName = a.facility?.name || a.facilityName || '-';
                        const date = a.date ? App.formatDate(a.date) : '-';
                        const checkInTime = a.checkInTime ? App.formatDateTime(a.checkInTime) : '-';
                        const checkOutTime = a.checkOutTime ? App.formatDateTime(a.checkOutTime) : '-';
                        const status = a.status || 'UNKNOWN';
                        const statusText = getAttendanceStatusText(status);
                        const statusBadge = getAttendanceStatusBadge(status);
                        
                        return `
                        <tr>
                            <td>${date}</td>
                            <td>${facilityName}</td>
                            <td>${checkInTime}</td>
                            <td>${checkOutTime}</td>
                            <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                        </tr>
                    `;
                    }).join('')}
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

// 상품/이용권 연장 모달 열기
async function openExtendProductModal(memberId) {
    document.getElementById('extend-member-id').value = memberId;
    document.getElementById('extend-product-select').innerHTML = '<option value="">로딩 중...</option>';
    document.getElementById('extend-current-expiry').textContent = '-';
    document.getElementById('extend-purchase-price').textContent = '-';
    document.getElementById('extend-calculated-price').textContent = '-';
    document.getElementById('extend-days').value = '';
    
    try {
        // 회원의 보유 상품/이용권 목록 가져오기 (기존 구매한 것들)
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
        
        // 새로 구매 가능한 모든 상품 목록 가져오기 (할인 상품 포함)
        const allProducts = await App.api.get('/products');
        
        const select = document.getElementById('extend-product-select');
        
        console.log('연장 모달 - 회원 보유 상품 개수:', memberProducts?.length || 0);
        console.log('연장 모달 - 구매 가능한 상품 개수:', allProducts?.length || 0);
        
        select.innerHTML = '<option value="">상품/이용권을 선택하세요...</option>';
        
        // 보유 상품과 구매 가능한 상품이 모두 없으면
        if ((!memberProducts || memberProducts.length === 0) && (!allProducts || allProducts.length === 0)) {
            select.innerHTML = '<option value="">상품/이용권이 없습니다</option>';
            select.disabled = true;
            App.showNotification('상품/이용권이 없습니다.', 'warning');
            return;
        }
        
        select.disabled = false;
        
        // 기존 이벤트 리스너 제거 (중복 방지)
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        const freshSelect = document.getElementById('extend-product-select');
        
        // 모든 상품을 저장할 배열 (기존 보유 + 새로 구매 가능)
        const allAvailableProducts = [];
        
        // 1. 기존 보유 상품권 추가 (MemberProduct - 연장용)
        if (memberProducts && memberProducts.length > 0) {
            memberProducts.forEach(mp => {
                const productName = mp.product?.name || '상품';
                const productType = mp.product?.type || '';
                const expiryDate = mp.expiryDate ? App.formatDate(mp.expiryDate) : '만료일 없음';
                const status = mp.status || 'ACTIVE';
                const remainingCount = mp.remainingCount !== undefined ? mp.remainingCount : '-';
                const actualPurchasePrice = mp.actualPurchasePrice || mp.product?.price || 0;
                const totalCount = mp.totalCount || mp.product?.usageCount || 10;
                
                // 상품 타입에 따른 표시
                let typeText = '';
                if (productType === 'COUNT_PASS') {
                    typeText = `[횟수권]`;
                } else if (productType === 'TIME_PASS') {
                    typeText = `[시간권]`;
                } else if (productType === 'MONTHLY_PASS') {
                    typeText = `[월정기]`;
                }
                
                // 실제 구매 금액 표시
                const priceText = App.formatCurrency(actualPurchasePrice);
                
                const optionText = `[보유] ${typeText} ${productName} - ${priceText} (만료일: ${expiryDate}, 상태: ${status}${productType === 'COUNT_PASS' ? `, 잔여: ${remainingCount}회` : ''})`;
                const option = new Option(optionText, `memberProduct_${mp.id}`);
                option.dataset.isMemberProduct = 'true';
                option.dataset.memberProductId = mp.id;
                option.dataset.productType = productType;
                option.dataset.actualPurchasePrice = actualPurchasePrice;
                option.dataset.totalCount = totalCount;
                option.dataset.expiryDate = mp.expiryDate || '';
                allAvailableProducts.push({
                    type: 'memberProduct',
                    id: mp.id,
                    memberProduct: mp,
                    product: mp.product
                });
                freshSelect.appendChild(option);
            });
        }
        
        // 2. 새로 구매 가능한 모든 상품 추가 (Product - 새 구매용, 할인 상품 포함)
        if (allProducts && allProducts.length > 0) {
            // 횟수권만 필터링 (연장은 횟수권만 가능)
            const countPassProducts = allProducts.filter(p => p.type === 'COUNT_PASS' && p.active !== false);
            
            if (countPassProducts.length > 0) {
                // 구분선 추가
                const separatorOption = new Option('────────── 새로 구매 가능 ──────────', '');
                separatorOption.disabled = true;
                freshSelect.appendChild(separatorOption);
                
                countPassProducts.forEach(product => {
                    const productName = product.name || '상품';
                    const productType = product.type || '';
                    const productPrice = product.price || 0;
                    const totalCount = product.usageCount || 10;
                    
                    const typeText = `[횟수권]`;
                    const priceText = App.formatCurrency(productPrice);
                    
                    const optionText = `[신규] ${typeText} ${productName} - ${priceText}`;
                    const option = new Option(optionText, `product_${product.id}`);
                    option.dataset.isMemberProduct = 'false';
                    option.dataset.productId = product.id;
                    option.dataset.productType = productType;
                    option.dataset.actualPurchasePrice = productPrice;
                    option.dataset.totalCount = totalCount;
                    option.dataset.expiryDate = '';
                    allAvailableProducts.push({
                        type: 'product',
                        id: product.id,
                        product: product
                    });
                    freshSelect.appendChild(option);
                });
            }
        }
        
        console.log('연장 모달 - 드롭다운에 추가된 옵션 개수:', freshSelect.options.length - 1); // -1은 기본 옵션 제외
        
        // 상품/이용권 선택 시 만료일 및 구매 금액 표시, 연장 금액 계산
        freshSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (selectedValue) {
                const selectedOption = this.options[this.selectedIndex];
                const isMemberProduct = selectedOption.dataset.isMemberProduct === 'true';
                
                if (isMemberProduct) {
                    // 기존 보유 상품권 선택
                    const memberProductId = selectedOption.dataset.memberProductId;
                    const selectedMemberProduct = memberProducts.find(mp => mp.id == memberProductId);
                    
                    if (selectedMemberProduct) {
                        // 만료일 표시
                        if (selectedMemberProduct.expiryDate) {
                            document.getElementById('extend-current-expiry').textContent = App.formatDate(selectedMemberProduct.expiryDate);
                        } else {
                            document.getElementById('extend-current-expiry').textContent = '만료일 없음';
                        }
                        
                        // 구매 금액 표시
                        const actualPurchasePrice = selectedMemberProduct.actualPurchasePrice || selectedMemberProduct.product?.price || 0;
                        document.getElementById('extend-purchase-price').textContent = App.formatCurrency(actualPurchasePrice);
                    }
                } else {
                    // 새 상품 선택
                    const productId = selectedOption.dataset.productId;
                    const selectedProduct = allProducts.find(p => p.id == productId);
                    
                    if (selectedProduct) {
                        document.getElementById('extend-current-expiry').textContent = '신규 구매';
                        document.getElementById('extend-purchase-price').textContent = App.formatCurrency(selectedProduct.price || 0);
                    }
                }
                
                // 연장 금액 계산 초기화
                updateExtendPrice();
            } else {
                document.getElementById('extend-current-expiry').textContent = '-';
                document.getElementById('extend-purchase-price').textContent = '-';
                document.getElementById('extend-calculated-price').textContent = '-';
            }
        });
        
        // 연장 횟수 입력 시 연장 금액 계산
        const daysInput = document.getElementById('extend-days');
        daysInput.addEventListener('input', function() {
            updateExtendPrice();
        });
        
        // 연장 금액 계산 함수
        function updateExtendPrice() {
            const selectedValue = freshSelect.value;
            const daysValue = parseInt(daysInput.value) || 0;
            
            if (selectedValue && daysValue > 0) {
                const selectedOption = freshSelect.options[freshSelect.selectedIndex];
                const actualPurchasePrice = parseInt(selectedOption.dataset.actualPurchasePrice) || 0;
                const totalCount = parseInt(selectedOption.dataset.totalCount) || 10;
                
                if (totalCount > 0 && actualPurchasePrice > 0) {
                    const unitPrice = Math.floor(actualPurchasePrice / totalCount);
                    const totalPrice = unitPrice * daysValue;
                    document.getElementById('extend-calculated-price').textContent = App.formatCurrency(totalPrice);
                } else {
                    document.getElementById('extend-calculated-price').textContent = '₩0';
                }
            } else {
                document.getElementById('extend-calculated-price').textContent = '-';
            }
        }
        
        App.Modal.open('extend-product-modal');
    } catch (error) {
        console.error('상품/이용권 목록 로드 실패:', error);
        App.showNotification('상품/이용권 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

// 상품/이용권 연장 처리
async function processExtendProduct() {
    const selectedValue = document.getElementById('extend-product-select').value;
    const daysInput = document.getElementById('extend-days').value;
    const memberId = document.getElementById('extend-member-id').value;
    
    if (!selectedValue) {
        App.showNotification('상품/이용권을 선택해주세요.', 'warning');
        return;
    }
    
    // 선택된 상품의 타입 확인
    const selectElement = document.getElementById('extend-product-select');
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const isMemberProduct = selectedOption.dataset.isMemberProduct === 'true';
    const productType = selectedOption.dataset.productType;
    
    // 횟수권이 아닌 경우 경고
    if (productType && productType !== 'COUNT_PASS') {
        App.showNotification('횟수권만 연장할 수 있습니다.', 'warning');
        return;
    }
    
    if (!daysInput || daysInput.trim() === '') {
        App.showNotification('연장 횟수를 입력해주세요.', 'warning');
        return;
    }
    
    const days = parseInt(daysInput);
    if (isNaN(days) || days <= 0) {
        App.showNotification('연장 횟수는 1 이상의 숫자여야 합니다.', 'warning');
        return;
    }
    
    try {
        if (isMemberProduct) {
            // 기존 보유 상품권 연장
            const memberProductId = selectedOption.dataset.memberProductId;
            const result = await App.api.put(`/member-products/${memberProductId}/extend`, {
                days: days
            });
            
            App.showNotification(result.message || '상품/이용권이 연장되었습니다.', 'success');
        } else {
            // 새 상품 선택 - 같은 상품이 있으면 연장, 없으면 새로 생성
            const productId = parseInt(selectedOption.dataset.productId);
            const actualPurchasePrice = parseInt(selectedOption.dataset.actualPurchasePrice) || 0;
            const totalCount = parseInt(selectedOption.dataset.totalCount) || 10;
            
            // 먼저 같은 Product ID를 가진 기존 MemberProduct가 있는지 확인
            const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
            const existingMemberProduct = memberProducts.find(mp => {
                const mpProductId = mp.product?.id || mp.productId;
                return mpProductId != null && parseInt(mpProductId) === productId;
            });
            
            if (existingMemberProduct) {
                // 같은 상품이 있으면 기존 MemberProduct에 연장
                const extendResult = await App.api.put(`/member-products/${existingMemberProduct.id}/extend`, {
                    days: days
                });
                App.showNotification(extendResult.message || '상품이 연장되었습니다.', 'success');
            } else {
                // 같은 상품이 없으면 새로 생성 시도 (결제 생성을 건너뛰고 연장 시에만 결제 생성)
                try {
                    const result = await App.api.post(`/members/${memberId}/products`, {
                        productId: productId,
                        skipPayment: true  // 연장 모달에서 호출하므로 결제 생성을 건너뜀
                    });
                    
                    // 생성된 MemberProduct에 횟수 추가 (연장 시 결제 생성됨)
                    if (result && result.id) {
                        const extendResult = await App.api.put(`/member-products/${result.id}/extend`, {
                            days: days
                        });
                        App.showNotification(extendResult.message || '새 상품이 구매되고 연장되었습니다.', 'success');
                    } else {
                        App.showNotification('상품 구매 및 연장이 완료되었습니다.', 'success');
                    }
                } catch (error) {
                    // POST 실패 시 (409 Conflict 또는 500 에러) 같은 상품이 있는지 다시 확인하고 연장
                    console.warn('상품 생성 실패, 기존 상품 확인 중:', error);
                    const retryMemberProducts = await App.api.get(`/members/${memberId}/products`);
                    const retryExistingMemberProduct = retryMemberProducts.find(mp => {
                        const mpProductId = mp.product?.id || mp.productId;
                        return mpProductId != null && parseInt(mpProductId) === productId;
                    });
                    
                    if (retryExistingMemberProduct) {
                        // 같은 상품이 있으면 연장
                        const extendResult = await App.api.put(`/member-products/${retryExistingMemberProduct.id}/extend`, {
                            days: days
                        });
                        App.showNotification(extendResult.message || '상품이 연장되었습니다.', 'success');
                    } else {
                        // 여전히 없으면 에러
                        throw error;
                    }
                }
            }
        }
        
        App.Modal.close('extend-product-modal');
        
        // 회원 목록 새로고침 (누적 결제 금액 업데이트)
        loadMembers();
        
        // 회원 상세 모달이 열려있으면 결제 내역과 이용권 목록도 새로고침
        if (currentMemberDetail && currentMemberDetail.id) {
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                const activeTabName = activeTab.getAttribute('data-tab');
                if (activeTabName === 'payments') {
                    // 결제 내역 탭이 활성화되어 있으면 새로고침
                    loadMemberPayments(currentMemberDetail.id);
                } else if (activeTabName === 'products') {
                    // 이용권 탭이 활성화되어 있으면 새로고침
                    loadMemberProductsForDetail(currentMemberDetail.id);
                }
            }
        }
    } catch (error) {
        console.error('상품/이용권 연장 실패:', error);
        App.showNotification('상품/이용권 연장에 실패했습니다.', 'danger');
    }
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
