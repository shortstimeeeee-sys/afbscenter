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
const MEMBER_PAGE_SIZE = 50;
let memberPageIndex = 0;
let memberPaginationInfo = null;
let accumulatedMembersList = [];
// currentMemberDetail은 dashboard.js에서 선언됨 (전역 변수로 공유)
let currentEditingMember = null; // 현재 수정 중인 회원 정보 (코치 선택용)

document.addEventListener('DOMContentLoaded', function() {
    // 회원 기본 통계는 목록과 별도로 먼저 로드 (목록 오류와 무관하게 표시)
    if (document.getElementById('members-stats-container')) {
        loadMemberStats();
    }
    // members.html 페이지에서만 실행
    if (document.getElementById('members-table-body')) {
        loadMembers();
        loadProductsForSelect(); // 상품 목록 로드
    }
    
    // 관리자만 삭제 버튼 표시
    if (App.currentUser && App.currentUser.role === 'ADMIN') {
        const deleteAllBtn = document.getElementById('delete-all-members-btn');
        if (deleteAllBtn) {
            deleteAllBtn.style.display = 'inline-flex';
        }
    }
    
    // 검색 이벤트
    const searchInput = document.getElementById('member-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });
    
    // 상품 선택 시 스타일 적용 및 총 금액 계산 (이벤트에 연결)
    const productSelect = document.getElementById('member-products');
    if (productSelect) {
        // change 이벤트에 스타일 적용 함수 및 총 금액 계산 함수 연결
        productSelect.addEventListener('change', function() {
            // 즉시 적용
            applySelectedProductStyles();
            updateTotalPrice();
            updateProductCoachSelection(); // 코치 선택 UI 업데이트
            // DOM 업데이트 후 다시 적용
            setTimeout(() => {
                applySelectedProductStyles();
                updateTotalPrice();
                updateProductCoachSelection();
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
    const openMember = urlParams.get('openMember');
    
    if (memberId && action === 'extend') {
        // 페이지 로드 후 연장 모달 열기
        setTimeout(() => {
            openExtendProductModal(parseInt(memberId));
            // URL에서 action 파라미터 제거
            window.history.replaceState({}, document.title, `/members.html?id=${memberId}`);
        }, 500);
    }
    // 랭킹 페이지에서 회원 클릭 시 회원 상세 모달 자동 열기
    if (openMember) {
        const id = parseInt(openMember, 10);
        if (!isNaN(id)) {
            setTimeout(() => {
                openMemberDetail(id);
            }, 300);
            window.history.replaceState({}, document.title, window.location.pathname || '/members.html');
        }
    }
});


// 상품 목록을 select에 로드
async function loadProductsForSelect() {
    try {
        const select = document.getElementById('member-products');
        if (!select) {
            App.warn('loadProductsForSelect: select를 찾을 수 없습니다.');
            return;
        }
        
        // 현재 선택된 값들 저장
        const selectedValues = Array.from(select.selectedOptions).map(opt => String(opt.value));
        
        // 기존 옵션 제거
        while (select.options.length > 0) {
            select.remove(0);
        }
        
        // 상품 목록 조회
        const products = await App.api.get('/products');
        
        if (!products || !Array.isArray(products)) {
            App.warn('상품 목록이 배열이 아닙니다:', products);
            return;
        }
        
        App.log('로드된 상품 수:', products.length);
        
        // 상품 옵션 추가
        if (products.length === 0) {
            // 상품이 없을 때 안내 메시지
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '등록된 상품이 없습니다';
            option.disabled = true;
            select.appendChild(option);
        } else {
            products.forEach(product => {
                if (product && product.active !== false) { // 활성 상품만 표시
                    const option = document.createElement('option');
                    option.value = String(product.id);
                    const productText = `${product.name || '상품명 없음'} (${getProductTypeText(product.type)}) - ${App.formatCurrency(product.price || 0)}`;
                    option.textContent = productText;
                    option.dataset.originalText = productText; // 원본 텍스트 저장 (중요!)
                    option.dataset.price = product.price || 0; // 가격 정보 저장
                    
                    // 상품의 코치 정보 저장 (필터링용)
                    if (product.coach && product.coach.id) {
                        option.dataset.coachId = String(product.coach.id);
                    } else if (product.coachId) {
                        option.dataset.coachId = String(product.coachId);
                    }
                    
                    // 상품의 카테고리 저장 (필터링용)
                    if (product.category) {
                        option.dataset.category = product.category;
                    }
                    
                    // 이전에 선택되어 있던 항목 복원
                    if (selectedValues.includes(String(product.id))) {
                        option.selected = true;
                    }
                    
                    select.appendChild(option);
                }
            });
        }
        
        // 상품 목록 로드 후 선택된 항목 스타일 적용 및 총 금액 계산
        setTimeout(() => {
            applySelectedProductStyles();
            updateTotalPrice();
        }, 100);
    } catch (error) {
        App.err('상품 목록 로드 실패:', error);
        const select = document.getElementById('member-products');
        if (select) {
            // 에러 발생 시 안내 메시지
            while (select.options.length > 0) {
                select.remove(0);
            }
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '상품 목록을 불러올 수 없습니다';
            option.disabled = true;
            select.appendChild(option);
        }
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

// 회원 통계(로드·카드·모달)는 members-stats.js 에서 처리

async function loadMembers(append) {
    try {
        const tbody = document.getElementById('members-table-body');
        if (!tbody) {
            App.warn('members-table-body 요소를 찾을 수 없습니다.');
            return;
        }
        
        if (!append) {
            memberPageIndex = 0;
            accumulatedMembersList = [];
            memberPaginationInfo = null;
        }
        
        // 로딩 표시 (첫 페이지일 때만 테이블 비우기)
        if (!append) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-muted);">로딩 중...</td></tr>';
        }
        
        let members;
        // 검색어가 있으면 검색 API 사용 (페이지네이션 없음)
        if (currentFilters.search) {
            const searchQuery = currentFilters.search;
            if (searchQuery.toUpperCase().startsWith('M')) {
                members = await App.api.get(`/members/search?memberNumber=${encodeURIComponent(searchQuery)}`);
            } else if (/^\d+$/.test(searchQuery.replace(/[-\s]/g, ''))) {
                members = await App.api.get(`/members/search?phoneNumber=${encodeURIComponent(searchQuery)}`);
            } else {
                members = await App.api.get(`/members/search?name=${encodeURIComponent(searchQuery)}`);
            }
            if (currentFilters.grade) members = members.filter(m => m.grade === currentFilters.grade);
            if (currentFilters.status) members = members.filter(m => m.status === currentFilters.status);
            accumulatedMembersList = Array.isArray(members) ? members : [];
            memberPaginationInfo = null;
        } else {
            const params = new URLSearchParams({
                page: memberPageIndex,
                size: MEMBER_PAGE_SIZE,
                ...currentFilters
            });
            const response = await App.api.get(`/members?${params}`);
            // 페이지네이션 응답 { content, totalElements, totalPages } 또는 기존 배열
            if (response && typeof response === 'object' && Array.isArray(response.content)) {
                if (append) {
                    accumulatedMembersList = accumulatedMembersList.concat(response.content);
                } else {
                    accumulatedMembersList = response.content;
                }
                memberPaginationInfo = {
                    totalElements: response.totalElements,
                    totalPages: response.totalPages,
                    number: response.number
                };
            } else if (Array.isArray(response)) {
                accumulatedMembersList = response;
                memberPaginationInfo = null;
            } else {
                App.err('회원 목록 API 응답이 배열이 아닙니다:', response);
                tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">회원 목록을 불러오는데 실패했습니다. (응답 형식 오류)</td></tr>';
                return;
            }
        }
        
        members = accumulatedMembersList;
        App.log('회원 목록 로드 성공:', members.length, '명');
        renderMembersTable(members, !!memberPaginationInfo);
        loadMemberStats();
    } catch (error) {
        App.err('회원 목록 로드 실패:', error);
        const tbody = document.getElementById('members-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">회원 목록을 불러오는데 실패했습니다. 페이지를 새로고침해주세요.</td></tr>';
        }
        App.showApiError(error);
    }
}

function renderMembersTable(members, showLoadMore) {
    try {
        const tbody = document.getElementById('members-table-body');
        const paginationContainer = document.getElementById('pagination-container');
        
        if (!tbody) {
            App.warn('members-table-body 요소를 찾을 수 없습니다. members.html 페이지가 아닐 수 있습니다.');
            return;
        }
        
        if (!Array.isArray(members)) {
            App.err('renderMembersTable: members가 배열이 아닙니다:', members);
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">데이터 형식 오류가 발생했습니다.</td></tr>';
            return;
        }
        
        if (!members || members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-muted);">회원이 없습니다.</td></tr>';
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        
        var totalDisplay = memberPaginationInfo ? memberPaginationInfo.totalElements : members.length;
        var hasMore = showLoadMore && memberPaginationInfo && (memberPageIndex + 1) < memberPaginationInfo.totalPages;
        if (paginationContainer) {
            paginationContainer.innerHTML = `
            <div style="text-align: center; padding: 16px; font-weight: 600; color: var(--text-primary);">
                총 <span style="color: var(--accent-primary); font-size: 18px;">${totalDisplay}</span>명 중 <span style="color: var(--text-secondary);">${members.length}명</span> 표시
            </div>
            ${hasMore ? '<div style="text-align: center; margin-bottom: 16px;"><button type="button" class="btn btn-secondary" id="members-load-more-btn">더 보기</button></div>' : ''}
        `;
            var loadMoreBtn = document.getElementById('members-load-more-btn');
            if (loadMoreBtn) loadMoreBtn.onclick = function() { memberPageIndex++; loadMembers(true); };
        }
        
        tbody.innerHTML = members.map(member => {
        const isExpiring = checkMemberExpiring(member);
        const hasExpired = checkMemberHasExpired(member);
        const expiringBadge = isExpiring ? '<span class="badge badge-expiring" style="margin-left: 4px; font-size: 11px;">⚠️ 만료 임박</span>' : '';
        const expiredBadge = hasExpired ? '<span class="badge badge-expired" style="margin-left: 4px; font-size: 11px;">종료</span>' : '';
        const badgesHtml = [expiringBadge, expiredBadge].filter(Boolean).join(' ');
        
        let rowStyle = '';
        if (hasExpired) {
            rowStyle = 'background-color: rgba(220, 38, 38, 0.06); border-left: 3px solid var(--danger, #DC2626);';
        }
        
        return `
        <tr ${rowStyle ? 'style="' + rowStyle + '"' : ''}>
            <td><strong style="color: var(--accent-primary);">${App.escapeHtml(member.memberNumber || '-')}</strong></td>
            <td>
                <div>
                    <a href="#" onclick="openMemberDetail(${member.id}); return false;" style="color: var(--accent-primary); display: block;">${App.escapeHtml(member.name || '')}</a>
                    ${badgesHtml ? `<div style="margin-top: 4px;">${badgesHtml}</div>` : ''}
                </div>
            </td>
            <td><span class="badge badge-${getGradeBadge(member.grade)}">${App.escapeHtml(getGradeText(member.grade))}</span></td>
            <td style="display: none;">${App.escapeHtml(member.phoneNumber || '')}</td>
            <td>${App.escapeHtml(member.school || '-')}</td>
            <td style="white-space: pre-line; line-height: 1.6;">${renderCoachNamesWithColors(member)}</td>
            <td style="white-space: pre-line; line-height: 1.6; font-size: 13px;">${renderMemberProducts(member)}</td>
            <td><span class="badge badge-${getStatusBadge(member.status)}">${getStatusText(member.status)}</span></td>
            <td>${member.latestLessonDate ? App.formatDate(member.latestLessonDate) : '-'}</td>
            <td>${App.formatCurrency(member.totalPayment || 0)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openExtendProductModal(${member.id})" title="이용권 연장" style="margin-right: 4px;">연장</button>
                <button class="btn btn-sm btn-secondary" onclick="editMember(${member.id})">수정</button>
                ${App.currentUser && App.currentUser.role === 'ADMIN' ? `<button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id})">삭제</button>` : ''}
            </td>
        </tr>
    `;
    }).join('');
    } catch (error) {
        App.err('renderMembersTable 오류:', error);
        const tbody = document.getElementById('members-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">회원 목록을 표시하는 중 오류가 발생했습니다.</td></tr>';
        }
    }
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
        case 'YOUTH':
            return 'youth';             // 유소년: 초록색
        case 'OTHER':
            return 'other';             // 기타 종목: 청록
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
                
                // remainingCount 계산 (상태가 USED_UP이면 0으로 표시)
                let remaining = mp.remainingCount;
                const mpStatus = mp.status || 'ACTIVE';
                
                // 상태가 USED_UP이면 잔여 횟수는 0
                if (mpStatus === 'USED_UP') {
                    remaining = 0;
                }
                // remainingCount가 null이나 undefined일 때만 대체값 사용 (0은 유효한 값)
                else if (remaining === null || remaining === undefined) {
                    // 상품의 실제 usageCount를 우선 사용 (데이터 일관성 보장)
                    remaining = mp.product?.usageCount;
                    // product.usageCount가 없으면 totalCount 사용
                    if (remaining === null || remaining === undefined) {
                        remaining = mp.totalCount;
                    }
                    // 그것도 없으면 기본값 10 사용
                    if (remaining === null || remaining === undefined) {
                        remaining = 10;
                    }
                }
                // remainingCount가 0이면 0으로 유지 (대체값 사용하지 않음)
                
                const color = getRemainingCountColor(remaining);
                const weight = remaining <= 3 ? '700' : '600';
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

// 코치명에 색상 적용하여 표시
function renderCoachNamesWithColors(member) {
    if (!member.coachNames && !member.coach?.name) {
        return '-';
    }
    
    const coachNames = member.coachNames || member.coach?.name || '';
    if (!coachNames) {
        return '-';
    }
    
    // 줄바꿈으로 구분된 코치명들을 각각 색상 적용
    const coachNameList = coachNames.split('\n').filter(name => name.trim());
    
    if (coachNameList.length === 0) {
        return '-';
    }
    
    const coloredNames = coachNameList.map(coachName => {
        const trimmedName = coachName.trim();
        if (!trimmedName) return '';
        
        // 코치 색상 가져오기 (고정 색상 우선 적용)
        let coachColor = App.CoachColors.getColor({ name: trimmedName });
        
        // 고정 색상이 없으면 기본 색상 사용
        if (!coachColor) {
            coachColor = 'var(--text-primary)';
        }
        
        return `<span style="color: ${coachColor}; font-weight: 600;">${App.escapeHtml(trimmedName)}</span>`;
    }).filter(name => name).join('<br>');
    
    return coloredNames || '-';
}

function normalizeCoachNameForColor(rawName) {
    if (!rawName) return '';
    let normalized = String(rawName).replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    normalized = normalized.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim();
    normalized = normalized.replace(/(대표|코치|강사|트레이너)/g, '').replace(/\s+/g, ' ').trim();
    return normalized;
}

const COACH_FIXED_COLORS_FALLBACK = {
    '서정민 [대표]': '#FF9800',
    '서정민': '#FF9800',
    '조장우 [코치]': '#4CAF50',
    '조장우': '#4CAF50',
    '최성훈 [코치]': '#E91E63',
    '최성훈': '#E91E63',
    '김우경 [투수코치]': '#9C27B0',
    '김우경': '#9C27B0',
    '이원준 [포수코치]': '#00BCD4',
    '이원준': '#00BCD4',
    '박준현 [트레이너]': '#5E6AD2',
    '박준현': '#5E6AD2',
    '이소연 [강사]': '#FFC107',
    '이소연': '#FFC107',
    '이서현 [강사]': '#F06292',
    '이서현': '#F06292',
    '김가영 [강사]': '#795548',
    '김가영': '#795548',
    '김소연 [강사]': '#009688',
    '김소연': '#009688',
    '조혜진 [강사]': '#673AB7',
    '조혜진': '#673AB7'
};

function renderCoachNamesWithColorsFromText(rawText) {
    if (!rawText) return '미지정';
    const text = String(rawText).trim();
    if (!text || text === '미지정') return '미지정';
    const nameParts = text.split(/\s*[\n,;/|]+\s*/).filter(part => part && part.trim());
    if (nameParts.length === 0) return '미지정';
    const rendered = nameParts.map(part => {
        const trimmed = part.trim();
        if (!trimmed) return '';
        const match = trimmed.match(/^(.+?)\s*[\[\(]([^\]\)]+)[\]\)]\s*$/);
        const namePart = match ? match[1].trim() : trimmed;
        const rolePart = match ? match[2].trim() : '';
        const normalizedBaseName = normalizeCoachNameForColor(namePart);
        let coachColor = null;
        if (window.App && App.CoachColors) {
            const fixed = App.CoachColors.fixedColors || COACH_FIXED_COLORS_FALLBACK;
            const normalizedTrimmed = normalizeCoachNameForColor(trimmed);
            const nameCandidates = [
                trimmed,
                namePart,
                normalizedBaseName,
                normalizedTrimmed,
                String(namePart || '').replace(/\s+/g, ''),
                String(trimmed || '').replace(/\s+/g, '')
            ].filter(v => v);
            for (const candidate of nameCandidates) {
                if (fixed[candidate]) {
                    coachColor = fixed[candidate];
                    break;
                }
            }
            if (!coachColor && typeof App.CoachColors.getColor === 'function') {
                coachColor =
                    App.CoachColors.getColor({ name: normalizedBaseName || namePart }) ||
                    App.CoachColors.getColor({ name: trimmed }) ||
                    null;
            }
        } else {
            const fixed = COACH_FIXED_COLORS_FALLBACK;
            const normalizedTrimmed = normalizeCoachNameForColor(trimmed);
            const nameCandidates = [
                trimmed,
                namePart,
                normalizedBaseName,
                normalizedTrimmed,
                String(namePart || '').replace(/\s+/g, ''),
                String(trimmed || '').replace(/\s+/g, '')
            ].filter(v => v);
            for (const candidate of nameCandidates) {
                if (fixed[candidate]) {
                    coachColor = fixed[candidate];
                    break;
                }
            }
        }
        coachColor = coachColor || 'var(--text-secondary)';
        const nameSpan = `<span class="coach-name" data-coach-name="${normalizedBaseName || namePart}" style="color: ${coachColor} !important; font-weight: 600;">${namePart}</span>`;
        return rolePart
            ? `${nameSpan} <span style="color: var(--text-muted); font-weight: 600;">[${rolePart}]</span>`
            : nameSpan;
    }).filter(item => item).join('<br>');
    return rendered || '미지정';
}

function getMemberCoachDisplayFromProducts(member) {
    if (!member) return '-';
    const memberProducts = Array.isArray(member.memberProducts) ? member.memberProducts : [];
    const getCategoryKey = (mp) => {
        const product = mp?.product || {};
        const category = String(product.category || '').toUpperCase();
        const nameLower = String(product.name || '').toLowerCase();
        if (category === 'BASEBALL' || nameLower.includes('야구') || nameLower.includes('baseball')) {
            return 'BASEBALL';
        }
        if (category === 'PILATES' || nameLower.includes('필라테스') || nameLower.includes('pilates')) {
            return 'PILATES';
        }
        if (category === 'TRAINING' || category === 'TRAINING_FITNESS' || nameLower.includes('트레이닝') || nameLower.includes('training')) {
            return 'TRAINING';
        }
        return 'OTHER';
    };
    const collectCoachNamesByCategory = (products) => {
        const map = {
            BASEBALL: new Set(),
            PILATES: new Set(),
            TRAINING: new Set(),
            OTHER: new Set()
        };
        products.forEach(mp => {
            if (!mp) return;
            const coachName = mp.coachName || mp.coach?.name || mp.product?.coach?.name;
            if (!coachName) return;
            const categoryKey = getCategoryKey(mp);
            map[categoryKey].add(String(coachName).trim());
        });
        return map;
    };
    let categoryMap = null;
    if (memberProducts.length > 0) {
        const activeProducts = memberProducts.filter(mp => !mp?.status || mp.status === 'ACTIVE');
        categoryMap = collectCoachNamesByCategory(activeProducts);
        const totalActive = Object.values(categoryMap).reduce((sum, set) => sum + set.size, 0);
        if (totalActive === 0) {
            categoryMap = collectCoachNamesByCategory(memberProducts);
        }
    }
    if (categoryMap) {
        const orderedNames = [
            ...Array.from(categoryMap.BASEBALL),
            ...Array.from(categoryMap.PILATES),
            ...Array.from(categoryMap.TRAINING),
            ...Array.from(categoryMap.OTHER)
        ];
        const representativeNames = orderedNames.filter(name => /\[대표\]|\(대표\)|대표/.test(name));
        const otherNames = orderedNames.filter(name => !/\[대표\]|\(대표\)|대표/.test(name));
        const finalOrdered = [...representativeNames, ...otherNames];
        if (orderedNames.length > 0) {
            return renderCoachNamesWithColorsFromText(finalOrdered.join('\n'));
        }
    }
    const fallback = member.coachNames || member.coach?.name || '';
    return fallback ? renderCoachNamesWithColorsFromText(fallback) : '-';
}

// 회원이 만료 임박인지 확인
function checkMemberExpiring(member) {
    if (!member || !member.memberProducts || member.memberProducts.length === 0) {
        return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryThreshold = new Date(today);
    expiryThreshold.setDate(expiryThreshold.getDate() + 7); // 7일 이내
    
    // 활성 상태인 상품만 확인
    const activeProducts = member.memberProducts.filter(mp => mp && mp.status === 'ACTIVE');
    
    if (activeProducts.length === 0) {
        return false;
    }
    
    for (const mp of activeProducts) {
        try {
            const product = mp.product || {};
            const productType = product ? product.type : null;
            
            if (!productType) {
                continue;
            }
            
            // 횟수권: 남은 횟수 3회 이하
            if (productType === 'COUNT_PASS') {
                let remainingCount = mp.remainingCount;
                // remainingCount가 null/undefined인 경우 totalCount 사용
                if (remainingCount === null || remainingCount === undefined) {
                    remainingCount = mp.totalCount;
                }
                // remainingCount가 여전히 null이면 계산 불가능하므로 건너뜀
                if (remainingCount !== null && remainingCount !== undefined && 
                    remainingCount <= 3 && remainingCount > 0) {
                    // 만료 임박 (횟수권)
                    return true;
                }
            }
            
            // 기간권: 만료일이 7일 이내
            if (productType === 'MONTHLY_PASS' && mp.expiryDate) {
                let expiryDate;
                // expiryDate가 문자열인 경우 Date 객체로 변환
                if (typeof mp.expiryDate === 'string') {
                    expiryDate = new Date(mp.expiryDate);
                } else {
                    expiryDate = new Date(mp.expiryDate);
                }
                
                // 유효하지 않은 날짜인 경우 건너뜀
                if (isNaN(expiryDate.getTime())) {
                    continue;
                }
                
                expiryDate.setHours(0, 0, 0, 0);
                
                // 만료일이 오늘 이후이고 7일 이내인 경우
                if (expiryDate >= today && expiryDate <= expiryThreshold) {
                    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                    // 만료 임박 (기간권)
                    return true;
                }
            }
        } catch (e) {
            // 개별 상품 확인 실패해도 계속 진행
            continue;
        }
    }
    
    return false;
}

// 회원에게 종료/사용완료된 이용권이 있는지 확인 (종료 배지 표시용)
function checkMemberHasExpired(member) {
    if (!member || !member.memberProducts || member.memberProducts.length === 0) {
        return false;
    }
    return member.memberProducts.some(function(mp) {
        var s = (mp && mp.status) ? String(mp.status).toUpperCase() : '';
        return s === 'USED_UP' || s === 'EXPIRED';
    });
}

// 만료일까지 남은 일수에 따른 색상 반환
function getExpiryDateColor(expiryDate) {
    if (!expiryDate) {
        return 'var(--text-secondary)';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let expiry;
    if (typeof expiryDate === 'string') {
        expiry = new Date(expiryDate);
    } else {
        expiry = new Date(expiryDate);
    }
    
    if (isNaN(expiry.getTime())) {
        return 'var(--text-secondary)';
    }
    
    expiry.setHours(0, 0, 0, 0);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
        return '#DC3545'; // 빨간색 (이미 만료)
    } else if (daysUntilExpiry <= 2) {
        return '#DC3545'; // 빨간색 (2일 이내)
    } else if (daysUntilExpiry <= 5) {
        return '#FD7E14'; // 주황색 (3~5일)
    } else if (daysUntilExpiry <= 7) {
        return '#F59E0B'; // 노란색 (6~7일)
    } else {
        return 'var(--accent-primary)'; // 기본 색상 (7일 초과)
    }
}

// 회원의 모든 상품/이용권 표시 (상품/이용권 컬럼용)
function renderMemberProducts(member) {
    // 디버깅: 회원 상품 데이터 전체 확인
    if (!member.memberProducts || member.memberProducts.length === 0) {
        App.log('회원 상품 없음:', {
            memberId: member.id,
            memberNumber: member.memberNumber,
            memberName: member.name,
            memberProducts: member.memberProducts
        });
        return '<span style="color: var(--text-muted);">-</span>';
    }
    
    // 활성 상태인 상품만 필터링
    let activeProducts = member.memberProducts.filter(mp => {
        return mp.status === 'ACTIVE';
    });
    
    if (activeProducts.length === 0) {
        App.warn('활성 상품 없음:', {
            memberId: member.id,
            memberNumber: member.memberNumber,
            memberName: member.name,
            totalProducts: member.memberProducts.length,
            allStatuses: member.memberProducts.map(mp => mp.status)
        });
        return '<span style="color: var(--text-muted);">-</span>';
    }
    
    // 디버깅: 활성 상품 데이터 확인
    if (activeProducts.length > 0) {
        activeProducts.forEach((mp, index) => {
            if (!mp.product || !mp.product.name) {
                App.warn(`활성 상품 ${index + 1} - 상품 정보 없음:`, {
                    memberId: member.id,
                    memberName: member.name,
                    memberProduct: mp
                });
            }
        });
    }
    
    // 카테고리별로 정렬 (야구 > 트레이닝 > 필라테스 > 기타)
    activeProducts.sort((a, b) => {
        const categoryA = (a.product && a.product.category) || '';
        const categoryB = (b.product && b.product.category) || '';
        const nameA = (a.product && a.product.name) || '';
        const nameB = (b.product && b.product.name) || '';
        
        // 카테고리 우선순위 함수
        const getCategoryPriority = (category, productName) => {
            const nameLower = (productName || '').toLowerCase();
            if (category === 'BASEBALL' || nameLower.includes('야구') || nameLower.includes('baseball')) {
                return 1; // 야구
            } else if (category === 'TRAINING' || category === 'TRAINING_FITNESS' || 
                      nameLower.includes('트레이닝') || nameLower.includes('training')) {
                return 2; // 트레이닝
            } else if (category === 'PILATES' || nameLower.includes('필라테스') || nameLower.includes('pilates')) {
                return 3; // 필라테스
            }
            return 4; // 기타
        };
        
        const priorityA = getCategoryPriority(categoryA, nameA);
        const priorityB = getCategoryPriority(categoryB, nameB);
        
        // 우선순위로 정렬
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        // 같은 우선순위면 상품명으로 정렬
        return nameA.localeCompare(nameB);
    });
    
    // 각 상품별로 표시: 횟수권은 "상품명 : 남은 횟수", 기간권은 "상품명 : 시작일 ~ 종료일"
    const productLines = activeProducts.map(mp => {
        // product 정보가 없어도 최소한 표시
        if (!mp.product) {
            App.warn('상품 정보가 없는 MemberProduct:', {
                memberId: member.id,
                memberName: member.name,
                memberProductId: mp.id,
                status: mp.status,
                remainingCount: mp.remainingCount,
                totalCount: mp.totalCount
            });
            // product 정보가 없어도 MemberProduct ID라도 표시
            const productName = App.escapeHtml(`상품 ID: ${mp.id || '알 수 없음'}`);
            const displayText = `<span style="color: #ff9800; font-weight: 600;">${productName}</span> <span style="color: var(--text-muted); font-size: 11px;">(상품 정보 없음)</span>`;
            return displayText;
        }
        
        const product = mp.product;
        // product가 없거나 name이 없으면 '알 수 없음' 표시 (XSS 방지 이스케이프)
        const productName = App.escapeHtml(product.name || `상품 ID: ${product.id || '알 수 없음'}`);
        const productType = product.type || '';
        
        // 이용권 이름은 초록색으로 통일
        const productNameColor = '#4CAF50'; // 초록색
        
        // 기간권(MONTHLY_PASS)인 경우: 구매일로부터 30일 계산된 날짜 표시
        if (productType === 'MONTHLY_PASS') {
            let expiryDate = null;
            
            // expiryDate가 있으면 그대로 사용 (구매일 + 30일로 이미 계산된 값)
            if (mp.expiryDate) {
                expiryDate = mp.expiryDate;
            } else if (mp.purchaseDate) {
                // expiryDate가 없으면 purchaseDate + 30일 계산
                let purchaseDate = null;
                if (typeof mp.purchaseDate === 'string') {
                    // ISO 문자열인 경우
                    purchaseDate = mp.purchaseDate.includes('T') ? mp.purchaseDate.split('T')[0] : mp.purchaseDate;
                } else {
                    purchaseDate = mp.purchaseDate;
                }
                
                if (purchaseDate) {
                    const purchase = new Date(purchaseDate);
                    const expiry = new Date(purchase);
                    // 상품의 validDays가 있으면 사용, 없으면 기본 30일
                    const validDays = (product.validDays && product.validDays > 0) ? product.validDays : 30;
                    expiry.setDate(expiry.getDate() + validDays);
                    expiryDate = expiry;
                }
            }
            
            let periodText = '';
            let periodColor = 'var(--accent-primary)';
            
            if (expiryDate) {
                const endDateStr = App.formatDate(expiryDate);
                periodText = `~ ${endDateStr}`;
                // 만료일까지 남은 일수에 따라 색상 결정
                periodColor = getExpiryDateColor(expiryDate);
            } else {
                periodText = '기간 정보 없음';
            }
            
            const displayText = `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : <span style="color: ${periodColor}; font-weight: 600;">${App.escapeHtml(periodText)}</span>`;
            return displayText;
        }
        
        // 횟수권(COUNT_PASS)인 경우: 남은 횟수 표시
        // 남은 횟수 계산 (상태가 USED_UP이면 0으로 표시)
        let remaining = mp.remainingCount;
        const mpStatus = mp.status || 'ACTIVE';
        
        // 상태가 USED_UP이면 잔여 횟수는 0
        if (mpStatus === 'USED_UP') {
            remaining = 0;
        }
        // remainingCount가 null이나 undefined일 때만 대체값 사용 (0은 유효한 값)
        else if (remaining === null || remaining === undefined) {
            // 우선순위: product.usageCount > totalCount (상품의 실제 사용 횟수 반영)
            remaining = product.usageCount;
            if (remaining === null || remaining === undefined) {
                remaining = mp.totalCount;
            }
            
            // remaining이 여전히 null이면 경고 로그 출력
            if (remaining === null || remaining === undefined) {
                App.warn('회원 상품 잔여 횟수 정보 없음 - 상품의 usageCount가 설정되지 않음:', {
                    memberId: member.id,
                    memberName: member.name,
                    memberProductId: mp.id,
                    productId: product.id,
                    productName: product.name,
                    remainingCount: mp.remainingCount,
                    totalCount: mp.totalCount,
                    usageCount: product.usageCount
                });
                // 모든 값이 null이면 "정보 없음" 표시
                remaining = null;
            }
        }
        // remainingCount가 0이면 0으로 유지 (대체값 사용하지 않음)
        
        // 상품에 지정된 코치 찾기 (MemberProductInfo.coachName 사용)
        let assignedCoachName = mp.coachName || null;
        
        // coachName이 없으면 담당 코치 목록에서 해당 상품 카테고리에 맞는 코치 찾기
        if (!assignedCoachName && member.coachNames) {
            const coachNamesList = member.coachNames.split('\n').filter(name => name.trim());
            const productCategory = product.category || '';
            const productNameLower = productName.toLowerCase();
            
            // 상품 카테고리나 상품명으로 코치 매칭 시도
            if (productCategory === 'BASEBALL' || productNameLower.includes('야구') || productNameLower.includes('baseball')) {
                // 야구 관련 코치 찾기
                assignedCoachName = coachNamesList.find(name => 
                    name.includes('서정민') || name.includes('김우경') || name.includes('이원준')
                ) || coachNamesList[0];
            } else if (productCategory === 'PILATES' || productNameLower.includes('필라테스') || productNameLower.includes('pilates')) {
                // 필라테스 관련 코치 찾기
                assignedCoachName = coachNamesList.find(name => 
                    name.includes('김소연') || name.includes('이서현') || name.includes('이소연')
                ) || coachNamesList[0];
            } else if (productCategory === 'TRAINING' || productNameLower.includes('트레이닝') || productNameLower.includes('training')) {
                // 트레이닝 관련 코치 찾기
                assignedCoachName = coachNamesList.find(name => 
                    name.includes('박준현')
                ) || coachNamesList[0];
            } else if (coachNamesList.length > 0) {
                assignedCoachName = coachNamesList[0];
            }
        }
        
        // 항상 "상품명 : 남은 횟수" 형식으로 표시
        // 남은 횟수에 따라 색상 적용 (이미 getRemainingCountColor 함수 사용)
        let remainingDisplay = '';
        if (remaining === null || remaining === undefined) {
            remainingDisplay = '<span style="color: #ff9800; font-weight: 600;">정보 없음</span>';
        } else {
            const remainingColor = getRemainingCountColor(remaining);
            const weight = remaining <= 3 ? '700' : '600';
            remainingDisplay = `<span style="color: ${remainingColor}; font-weight: ${weight};">${remaining}회</span>`;
        }
        const displayText = `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : ${remainingDisplay}`;
        
        return displayText;
    }).filter(line => line !== null).join('<br>');
    
    // 상품이 하나도 없으면 '-' 표시
    if (productLines.length === 0) {
        return '<span style="color: var(--text-muted);">-</span>';
    }
    
    return `<div style="line-height: 1.6;">${productLines}</div>`;
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
    // 모달 열 때 총 금액 초기화
    const totalPriceElement = document.getElementById('member-total-price');
    if (totalPriceElement) {
        totalPriceElement.textContent = '₩0';
    }
    
    // 코치 선택 UI 초기화
    const coachSelectionContainer = document.getElementById('product-coach-selection');
    if (coachSelectionContainer) {
        coachSelectionContainer.innerHTML = '';
    }
    
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
        App.log('회원 등록 모달 열림 - ID 및 회원번호 초기화 완료');
        // 신규 등록 시 회원번호 필드 비우기
        document.getElementById('member-number').value = '';
        // 신규 등록 시 현재 수정 중인 회원 정보 초기화
        currentEditingMember = null;
    }
    
    App.Modal.open('member-modal');
    
    // 수정 모달인 경우 loadMemberData가 완료된 후 스타일이 적용됨
    // 추가 안전장치로 모달이 완전히 열린 후에도 스타일 적용
    if (id) {
        setTimeout(() => {
            applySelectedProductStyles();
            updateProductCoachSelection();
        }, 800);
    }
}

/** 1~5단계 라디오 그룹 값 설정 (name으로 선택, 기존 상/중/하 호환) */
function setRadioStage(radioName, value, isStringLevel) {
    var radios = document.querySelectorAll('input[name="' + radioName + '"]');
    if (!radios.length) return;
    var s = '';
    if (value != null && value !== '') {
        if (isStringLevel) {
            var u = String(value).toUpperCase();
            if (u === 'HIGH' || u === '상') s = '5';
            else if (u === 'MID' || u === 'MIDDLE' || u === '중') s = '3';
            else if (u === 'LOW' || u === '하') s = '1';
            else if (/^[1-5]$/.test(String(value))) s = String(value);
        } else {
            var n = Number(value);
            if (n >= 1 && n <= 5) s = String(Math.round(n));
        }
    }
    radios.forEach(function(r) {
        r.checked = r.value === s;
    });
}

/** 1~5단계 select 값 설정 (기존 상/중/하 또는 숫자 호환) */
function setStageSelect(elementId, value, isStringLevel) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var s = '';
    if (value != null && value !== '') {
        if (isStringLevel) {
            var u = String(value).toUpperCase();
            if (u === 'HIGH' || u === '상') s = '5';
            else if (u === 'MID' || u === 'MIDDLE' || u === '중') s = '3';
            else if (u === 'LOW' || u === '하') s = '1';
            else if (/^[1-5]$/.test(String(value))) s = String(value);
        } else {
            var n = Number(value);
            if (n >= 1 && n <= 5) s = String(Math.round(n));
        }
    }
    el.value = s;
}

function editMember(id) {
    openMemberModal(id);
}

async function loadMemberData(id) {
    try {
        const member = await App.api.get(`/members/${id}`);
        // 현재 수정 중인 회원 정보 저장 (코치 선택용)
        currentEditingMember = member;
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
        // 투수 / 타자 기록 (파워는 타자만 입력, 투수와 공유)
        document.getElementById('member-pitching-speed').value = member.pitchingSpeed ?? '';
        setRadioStage('member-pitcher-control', member.pitcherControl, true);
        setRadioStage('member-running-speed', member.runningSpeed);
        document.getElementById('member-swing-speed').value = member.swingSpeed ?? '';
        document.getElementById('member-exit-velocity').value = member.exitVelocity ?? '';
        setRadioStage('member-batter-power', member.batterPower);
        setRadioStage('member-flexibility', member.pitcherFlexibility || member.batterFlexibility, true);
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
        // 보호자 정보
        document.getElementById('member-guardian-name').value = member.guardianName || '';
        document.getElementById('member-guardian-phone').value = member.guardianPhone || '';
        // 메모
        document.getElementById('member-memo').value = member.memo || '';
        document.getElementById('member-coach-memo').value = member.coachMemo || '';
        
        // 상품 정보 로드 (회원이 보유한 상품)
        // loadMemberProducts 내부에서 updateProductCoachSelection을 호출하므로 여기서는 호출하지 않음
        await loadMemberProducts(id);
    } catch (error) {
        App.err('회원 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 선택된 옵션에 스타일 적용 함수 (select 박스 내에서 음영 표시)
let isApplyingStyles = false; // 무한 루프 방지 플래그
let lastApplyTime = 0; // 마지막 적용 시간

function applySelectedProductStyles() {
    const productSelect = document.getElementById('member-products');
    if (!productSelect) {
        App.warn('applySelectedProductStyles: productSelect를 찾을 수 없습니다.');
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
        
        App.log('applySelectedProductStyles 실행:', {
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
                
                App.log(`선택된 옵션 스타일 적용: ${option.textContent} (ID: ${option.value})`);
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
        
        App.log(`applySelectedProductStyles 완료: 선택된 항목 ${selectedCount}개`);
    } catch (error) {
        App.err('applySelectedProductStyles 오류:', error);
    } finally {
        // 즉시 플래그 해제 (setTimeout 제거)
        isApplyingStyles = false;
    }
}

// 선택된 상품들의 총 금액 계산 및 표시
function updateTotalPrice() {
    try {
        const productSelect = document.getElementById('member-products');
        const totalPriceElement = document.getElementById('member-total-price');
        
        if (!productSelect || !totalPriceElement) {
            return;
        }
        
        const selectedOptions = Array.from(productSelect.selectedOptions);
        let totalPrice = 0;
        
        selectedOptions.forEach(option => {
            if (option.value && option.value !== '') {
                const price = parseFloat(option.dataset.price) || 0;
                totalPrice += price;
            }
        });
        
        totalPriceElement.textContent = App.formatCurrency(totalPrice);
    } catch (error) {
        App.err('총 금액 계산 오류:', error);
    }
}

// 선택된 상품별 코치 선택 UI 업데이트
async function updateProductCoachSelection() {
    App.log('[updateProductCoachSelection] 시작');
    App.log('[updateProductCoachSelection] currentEditingMember:', currentEditingMember);
    
    const container = document.getElementById('product-coach-selection');
    if (!container) {
        App.warn('[updateProductCoachSelection] container를 찾을 수 없습니다.');
        return;
    }
    
    const productSelect = document.getElementById('member-products');
    if (!productSelect) {
        App.warn('[updateProductCoachSelection] productSelect를 찾을 수 없습니다.');
        return;
    }
    
    const selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    App.log('[updateProductCoachSelection] 선택된 상품 개수:', selectedOptions.length);
    
    // 기존 내용 제거
    container.innerHTML = '';
    
    if (selectedOptions.length === 0) {
        App.log('[updateProductCoachSelection] 선택된 상품이 없어 종료');
        return;
    }
    
    // 코치 목록 로드
    let allCoaches = [];
    try {
        allCoaches = await App.api.get('/coaches');
        allCoaches = allCoaches.filter(c => c.active !== false);
    } catch (error) {
        App.err('코치 목록 로드 실패:', error);
        return;
    }
    
    // 선택된 상품들의 카테고리 수집 (필터링용)
    const selectedProductCategories = new Set();
    selectedOptions.forEach(option => {
        const category = option.dataset.category;
        if (category) {
            selectedProductCategories.add(category);
        }
    });
    
    App.log(`[updateProductCoachSelection] 선택된 상품들의 카테고리:`, Array.from(selectedProductCategories));
    
    // 각 선택된 상품에 대해 코치 선택 드롭다운 생성
    selectedOptions.forEach((option, index) => {
        const productId = option.value;
        const productName = option.textContent.replace(/^✓ /, '').trim();
        const productCategory = option.dataset.category; // 이 상품의 카테고리
        
        // 현재 수정 중인 회원의 상품에서 해당 상품의 코치 찾기
        let selectedCoachId = '';
        
        // 방법 1: currentEditingMember에서 찾기
        if (currentEditingMember && currentEditingMember.memberProducts) {
            const memberProduct = currentEditingMember.memberProducts.find(mp => {
                // 여러 방법으로 productId 비교
                const mpProductId1 = mp.product?.id ? String(mp.product.id) : '';
                const mpProductId2 = mp.productId ? String(mp.productId) : '';
                const targetProductId = String(productId);
                return mpProductId1 === targetProductId || mpProductId2 === targetProductId;
            });
            
            if (memberProduct) {
                // coachName이 있으면 사용 (가장 우선)
                let coachNameToFind = null;
                if (memberProduct.coachName) {
                    // 공백 정규화 (여러 공백을 하나로)
                    coachNameToFind = String(memberProduct.coachName).replace(/\s+/g, ' ').trim();
                    App.log(`[방법1-1] coachName에서 찾음: "${coachNameToFind}"`);
                } 
                // coachName이 없으면 product.coach에서 찾기
                else if (memberProduct.product && memberProduct.product.coach) {
                    const productCoach = memberProduct.product.coach;
                    if (typeof productCoach === 'object' && productCoach.name) {
                        coachNameToFind = String(productCoach.name).trim();
                    } else if (typeof productCoach === 'string') {
                        coachNameToFind = productCoach.trim();
                    }
                    App.log(`[방법1-2] product.coach에서 찾음: "${coachNameToFind}"`);
                }
                // memberProduct.coach에서 직접 찾기
                else if (memberProduct.coach) {
                    const mpCoach = memberProduct.coach;
                    if (typeof mpCoach === 'object' && mpCoach.name) {
                        coachNameToFind = String(mpCoach.name).trim();
                    } else if (typeof mpCoach === 'string') {
                        coachNameToFind = mpCoach.trim();
                    }
                    App.log(`[방법1-3] memberProduct.coach에서 찾음: "${coachNameToFind}"`);
                }
                
                if (coachNameToFind) {
                    App.log(`[방법1] 상품 ID ${productId}의 코치 찾기: "${coachNameToFind}"`);
                    
                    // 코치명으로 코치 ID 찾기 (정확한 매칭 또는 부분 매칭)
                    const coach = allCoaches.find(c => {
                        // 공백 정규화 (여러 공백을 하나로)
                        const coachName = String(c.name || '').replace(/\s+/g, ' ').trim();
                        const searchName = coachNameToFind.replace(/\s+/g, ' ').trim();
                        
                        // 정확한 매칭
                        if (coachName === searchName) return true;
                        
                        // 부분 매칭 (예: "서정민 [대표]" vs "서정민")
                        if (coachName.includes(searchName) || searchName.includes(coachName)) return true;
                        
                        // 대괄호 제거 후 비교
                        const coachNameWithoutBracket = coachName.replace(/\s*\[.*?\]\s*/g, '').trim();
                        const searchNameWithoutBracket = searchName.replace(/\s*\[.*?\]\s*/g, '').trim();
                        if (coachNameWithoutBracket === searchNameWithoutBracket) return true;
                        
                        // 공백 제거 후 비교
                        const coachNameNoSpace = coachName.replace(/\s+/g, '');
                        const searchNameNoSpace = searchName.replace(/\s+/g, '');
                        if (coachNameNoSpace === searchNameNoSpace) return true;
                        
                        return false;
                    });
                    
                    if (coach) {
                        selectedCoachId = String(coach.id);
                        App.log(`[방법1] 코치 찾음: ${coach.name} (ID: ${coach.id}), selectedCoachId: "${selectedCoachId}"`);
                    } else {
                        App.warn(`[방법1] 코치를 찾을 수 없음: "${coachNameToFind}"`);
                        App.warn(`[방법1] 사용 가능한 코치 목록:`, allCoaches.map(c => c.name));
                    }
                } else {
                    App.warn(`[방법1] 상품 ID ${productId}에 코치 정보가 없음 (coachName, product.coach, coach 모두 없음)`);
                    App.warn(`[방법1] memberProduct 전체:`, memberProduct);
                }
            }
        }
        
        // 방법 2: option의 data-coachName 속성에서 찾기 (fallback)
        if (!selectedCoachId && option.dataset.coachName) {
            // 공백 정규화 (여러 공백을 하나로)
            const coachNameToFind = String(option.dataset.coachName).replace(/\s+/g, ' ').trim();
            App.log(`[방법2] 상품 ID ${productId}의 코치 찾기 (data 속성): "${coachNameToFind}"`);
            
            const coach = allCoaches.find(c => {
                // 공백 정규화
                const coachName = String(c.name || '').replace(/\s+/g, ' ').trim();
                const searchName = coachNameToFind.replace(/\s+/g, ' ').trim();
                
                // 정확한 매칭
                if (coachName === searchName) return true;
                
                // 부분 매칭
                if (coachName.includes(searchName) || searchName.includes(coachName)) return true;
                
                // 대괄호 제거 후 비교
                const coachNameWithoutBracket = coachName.replace(/\s*\[.*?\]\s*/g, '').trim();
                const searchNameWithoutBracket = searchName.replace(/\s*\[.*?\]\s*/g, '').trim();
                if (coachNameWithoutBracket === searchNameWithoutBracket) return true;
                
                // 공백 제거 후 비교
                const coachNameNoSpace = coachName.replace(/\s+/g, '');
                const searchNameNoSpace = searchName.replace(/\s+/g, '');
                if (coachNameNoSpace === searchNameNoSpace) return true;
                
                return false;
            });
            
            if (coach) {
                selectedCoachId = String(coach.id);
                App.log(`[방법2] 코치 찾음: ${coach.name} (ID: ${coach.id}), selectedCoachId: "${selectedCoachId}"`);
            }
        }
        
        // 디버깅: currentEditingMember 상태 확인
        if (!selectedCoachId) {
            App.log(`[디버깅] 상품 ID ${productId}의 코치를 찾지 못함`);
            App.log(`[디버깅] currentEditingMember:`, currentEditingMember);
            if (currentEditingMember && currentEditingMember.memberProducts) {
                App.log(`[디버깅] memberProducts:`, currentEditingMember.memberProducts);
                const memberProduct = currentEditingMember.memberProducts.find(mp => 
                    String(mp.product?.id || mp.productId || '') === String(productId)
                );
                App.log(`[디버깅] 찾은 memberProduct:`, memberProduct);
                App.log(`[디버깅] memberProduct.coachName:`, memberProduct?.coachName);
                App.log(`[디버깅] memberProduct 전체 키:`, memberProduct ? Object.keys(memberProduct) : 'null');
                // coachName이 없으면 다른 경로로 찾기 시도
                if (memberProduct && !memberProduct.coachName) {
                    // product.coach 또는 다른 경로 확인
                    App.log(`[디버깅] memberProduct.product:`, memberProduct.product);
                    if (memberProduct.product && memberProduct.product.coach) {
                        App.log(`[디버깅] product.coach 발견:`, memberProduct.product.coach);
                    }
                }
            }
        }
        
        // selectedCoachId와 coach.id를 문자열로 비교하여 정확하게 매칭
        const selectedCoachIdStr = String(selectedCoachId || '');
        App.log(`[드롭다운 생성] 상품 ID ${productId}, selectedCoachId: "${selectedCoachIdStr}"`);
        
        const coachGroup = document.createElement('div');
        coachGroup.className = 'form-group';
        coachGroup.style.marginBottom = '12px';
        
        // Label 생성
        const label = document.createElement('label');
        label.className = 'form-label';
        label.style.fontSize = '13px';
        label.style.fontWeight = '600';
        label.style.color = 'var(--text-primary)';
        label.innerHTML = `${productName} - 담당 코치 <span class="required-asterisk">*</span>`;
        
        // Select 생성
        const select = document.createElement('select');
        select.className = 'form-control product-coach-select';
        select.setAttribute('data-product-id', productId);
        select.required = true;
        select.style.fontSize = '14px';
        
        // 기본 옵션 추가
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '코치를 선택하세요';
        select.appendChild(defaultOption);
        
        // 코치 필터링: 상품 카테고리에 맞는 코치만 표시
        let filteredCoaches = allCoaches;
        
        // 상품 카테고리와 코치 담당 종목/지점 매핑 함수
        const matchesCategory = (coach, category) => {
            const categoryLower = (category || '').toLowerCase();
            
            // 대관(RENTAL): RENTAL 지점에 배정된 담당자만 표시
            if (categoryLower === 'rental') {
                var branches = (coach.availableBranches || '').toUpperCase();
                return branches.indexOf('RENTAL') !== -1;
            }
            
            if (!coach.specialties || !category) return false;
            var specialties = (coach.specialties || '').toLowerCase();
            
            // 카테고리별 매핑
            if (categoryLower === 'baseball') {
                return specialties.includes('야구') || specialties.includes('baseball');
            } else if (categoryLower === 'training' || categoryLower === 'training_fitness') {
                return specialties.includes('트레이닝') || specialties.includes('training');
            } else if (categoryLower === 'pilates') {
                return specialties.includes('필라테스') || specialties.includes('pilates');
            }
            
            return false;
        };
        
        // 이 상품의 카테고리에 맞는 코치만 필터링
        if (productCategory) {
            filteredCoaches = allCoaches.filter(function(coach) {
                return matchesCategory(coach, productCategory);
            });
            App.log('[드롭다운 필터링] 상품 ID ' + productId + ' (카테고리: ' + productCategory + '): 전체 코치 ' + allCoaches.length + '명 중 ' + filteredCoaches.length + '명 필터링됨');
        } else {
            // 상품에 카테고리가 없는 경우 모든 코치 표시
            App.log('[드롭다운 필터링] 상품 ID ' + productId + ': 카테고리가 없어 모든 코치 표시');
        }
        
        // 필터링된 코치 옵션 추가
        filteredCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = String(coach.id || '');
            option.textContent = coach.name;
            
            const coachIdStr = String(coach.id || '');
            if (coachIdStr === selectedCoachIdStr) {
                option.selected = true;
                App.log(`[드롭다운] 상품 ID ${productId}에 코치 "${coach.name}" (ID: ${coach.id}) 선택됨`);
            }
            
            select.appendChild(option);
        });
        
        // DOM에 추가
        coachGroup.appendChild(label);
        coachGroup.appendChild(select);
        container.appendChild(coachGroup);
        
        // 선택된 값 명시적으로 설정
        if (selectedCoachIdStr) {
            // select.value를 설정하면 브라우저가 자동으로 해당 옵션을 선택함
            select.value = selectedCoachIdStr;
            
            // 선택 확인 (디버깅용)
            const selectedOption = select.querySelector(`option[value="${selectedCoachIdStr}"]`);
            if (selectedOption && (selectedOption.selected || select.value === selectedCoachIdStr)) {
                App.log(`[확인] 상품 ID ${productId}의 드롭다운에서 코치 ID ${selectedCoachIdStr}가 선택됨 (value: "${select.value}")`);
            } else {
                App.warn(`[경고] 상품 ID ${productId}의 드롭다운에서 코치 ID ${selectedCoachIdStr}가 선택되지 않음`);
                App.warn(`[경고] select.value: "${select.value}", selectedIndex: ${select.selectedIndex}`);
                // 재시도
                setTimeout(() => {
                    select.value = selectedCoachIdStr;
                    App.log(`[재시도] 상품 ID ${productId}의 드롭다운 value를 ${selectedCoachIdStr}로 설정`);
                }, 10);
            }
        }
        
        // 드롭다운 변경 이벤트 리스너 추가 (디버깅용)
        select.addEventListener('change', function() {
            App.log(`[드롭다운 변경] 상품 ID ${productId}의 코치가 "${this.value}"로 변경됨 (이전: "${selectedCoachIdStr}")`);
        });
    });
}

// 회원이 보유한 상품 목록 로드
async function loadMemberProducts(memberId) {
    try {
        // 상품 목록이 먼저 로드되었는지 확인
        const productSelect = document.getElementById('member-products');
        if (!productSelect) {
            App.warn('loadMemberProducts: productSelect를 찾을 수 없습니다.');
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
            App.warn('loadMemberProducts: 상품 목록을 로드할 수 없습니다.');
            return;
        }
        
        // currentEditingMember가 이미 있으면 그것을 사용, 없으면 API 호출
        let memberProducts = null;
        if (currentEditingMember && currentEditingMember.memberProducts) {
            memberProducts = currentEditingMember.memberProducts;
            App.log('loadMemberProducts - currentEditingMember에서 상품 정보 사용:', memberProducts);
        } else {
            // 회원 상세 정보에서 memberProducts 가져오기
            const member = await App.api.get(`/members/${memberId}`);
            memberProducts = member.memberProducts || [];
            
            // currentEditingMember 업데이트 (코치 정보 포함)
            if (currentEditingMember) {
                currentEditingMember.memberProducts = memberProducts;
            } else {
                // currentEditingMember가 없으면 새로 설정
                currentEditingMember = { memberProducts: memberProducts };
            }
            App.log('loadMemberProducts - API에서 회원 상품 정보 로드:', memberProducts);
        }
        
        App.log('loadMemberProducts - 최종 currentEditingMember:', currentEditingMember);
        
        // 기존 선택 해제
        Array.from(productSelect.options).forEach(option => {
            option.selected = false;
            // 기존 코치 정보 제거
            delete option.dataset.coachName;
        });
        
        // 회원이 보유한 상품 선택
        if (memberProducts && memberProducts.length > 0) {
            memberProducts.forEach(mp => {
                const productId = String(mp.product?.id || mp.productId || '');
                const option = Array.from(productSelect.options).find(opt => String(opt.value) === productId);
                if (option) {
                    option.selected = true;
                    // 코치 정보를 option의 data 속성에 저장
                    if (mp.coachName) {
                        option.dataset.coachName = mp.coachName;
                        App.log(`상품 ID ${productId}에 코치 정보 저장: "${mp.coachName}"`);
                    } else {
                        App.warn(`상품 ID ${productId}에 코치 정보가 없음. memberProduct:`, mp);
                    }
                } else {
                    App.warn(`상품 ID ${productId}에 해당하는 option을 찾을 수 없음`);
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
        
        // 상품 로드 완료 후 코치 선택 UI 업데이트
        setTimeout(() => {
            updateProductCoachSelection();
        }, 200);
    } catch (error) {
        App.err('회원 상품 목록 로드 실패:', error);
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
            App.warn('전화번호 중복 체크 실패:', error);
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
        pitchingSpeed: document.getElementById('member-pitching-speed').value ? parseFloat(document.getElementById('member-pitching-speed').value) : null,
        pitcherPower: (function() { var v = document.querySelector('input[name="member-batter-power"]:checked')?.value; return v ? parseFloat(v) : null; })(),
        pitcherControl: document.querySelector('input[name="member-pitcher-control"]:checked')?.value || null,
        pitcherFlexibility: document.querySelector('input[name="member-flexibility"]:checked')?.value || null,
        runningSpeed: (function() { var v = document.querySelector('input[name="member-running-speed"]:checked')?.value; return v ? parseFloat(v) : null; })(),
        swingSpeed: document.getElementById('member-swing-speed').value ? parseFloat(document.getElementById('member-swing-speed').value) : null,
        exitVelocity: document.getElementById('member-exit-velocity').value ? parseFloat(document.getElementById('member-exit-velocity').value) : null,
        batterPower: (function() { var v = document.querySelector('input[name="member-batter-power"]:checked')?.value; return v ? parseFloat(v) : null; })(),
        batterFlexibility: (function() { var v = document.querySelector('input[name="member-flexibility"]:checked')?.value; return v ? parseFloat(v) : null; })(),
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
    
    // 코치는 상품 할당 시 자동 배정되므로 null로 설정
    data.coach = null;
    
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
            App.log('회원 등록 요청 - ID 없음 확인:', data);
            savedMember = await App.api.post('/members', data);
            App.showNotification('회원이 등록되었습니다.', 'success');
        }
        
        // 선택된 상품 할당 및 결제 생성
        const productSelect = document.getElementById('member-products');
        const selectedProductIds = Array.from(productSelect.selectedOptions)
            .map(option => option.value)
            .filter(id => id && id !== '');
        
        App.log(`[saveMember] 선택된 상품 IDs:`, selectedProductIds);
        App.log(`[saveMember] 회원 ID:`, savedMember.id);
        
        // 이용권 선택 시 코치 미선택 방지: 모든 선택 이용권에 담당 코치가 선택되어 있어야 저장 가능
        if (selectedProductIds.length > 0) {
            const coachSelects = document.querySelectorAll('.product-coach-select');
            let firstEmptySelect = null;
            for (const productId of selectedProductIds) {
                const select = Array.from(coachSelects).find(el => String(el.dataset.productId) === String(productId));
                if (select && (!select.value || String(select.value).trim() === '')) {
                    if (!firstEmptySelect) firstEmptySelect = select;
                }
            }
            if (firstEmptySelect) {
                App.showNotification('이용권별로 담당 코치를 선택해 주세요.', 'warning');
                firstEmptySelect.focus();
                firstEmptySelect.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return; // 코치 미선택 시 저장 중단 (이용권 구매 불가)
            }
        }
        
        if (id) {
            // 수정 모드: 상품이 변경되었거나 코치가 변경되었을 수 있으므로 항상 재할당
            if (selectedProductIds.length > 0) {
                App.log(`[saveMember] 수정 모드 - 상품 할당 시작 (코치 변경 포함)`);
                await assignProductsToMember(savedMember.id, selectedProductIds);
                App.log(`[saveMember] 수정 모드 - 상품 할당 완료`);
            } else {
                // 상품이 모두 제거된 경우
                App.log(`[saveMember] 수정 모드 - 모든 상품 제거`);
                await App.api.delete(`/members/${savedMember.id}/products`);
            }
        } else {
            // 신규 등록: 상품이 있으면 할당
            if (selectedProductIds.length > 0) {
                App.log(`[saveMember] 신규 등록 - 상품 할당 시작`);
                await assignProductsToMember(savedMember.id, selectedProductIds);
                App.log(`[saveMember] 신규 등록 - 상품 할당 완료`);
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
    App.log(`[assignProductsToMember] 시작 - memberId: ${memberId}, productIds:`, productIds);
    try {
        // 기존 상품 할당 제거 후 새로 할당
        App.log(`[assignProductsToMember] 기존 상품 할당 제거 시작`);
        await App.api.delete(`/members/${memberId}/products`);
        App.log(`[assignProductsToMember] 기존 상품 할당 제거 완료`);
        
        // 선택된 상품별 코치 정보 수집
        const productCoachMap = {};
        const coachSelects = document.querySelectorAll('.product-coach-select');
        App.log(`[assignProductsToMember] 찾은 코치 드롭다운 개수: ${coachSelects.length}`);
        
        coachSelects.forEach((select, index) => {
            const productId = select.dataset.productId;
            const coachId = select.value;
            App.log(`[assignProductsToMember] 드롭다운 ${index + 1}: productId="${productId}", coachId="${coachId}", selectedIndex=${select.selectedIndex}`);
            
            if (productId && coachId) {
                productCoachMap[productId] = parseInt(coachId);
                App.log(`[assignProductsToMember] 상품 ID ${productId}에 코치 ID ${coachId} 매핑됨`);
            } else {
                App.warn(`[assignProductsToMember] 상품 ID ${productId}에 코치가 선택되지 않음 (coachId: "${coachId}")`);
            }
        });
        
        App.log(`[assignProductsToMember] 최종 productCoachMap:`, productCoachMap);
        
        // 새 상품 할당 및 결제 생성
        for (const productId of productIds) {
            try {
                const requestData = { productId: parseInt(productId) };
                // 코치가 선택된 경우 추가
                if (productCoachMap[productId]) {
                    requestData.coachId = productCoachMap[productId];
                    App.log(`[assignProductsToMember] 상품 ID ${productId}에 코치 ID ${productCoachMap[productId]} 포함하여 할당`);
                } else {
                    App.warn(`[assignProductsToMember] 상품 ID ${productId}에 코치가 없음`);
                }
                App.log(`[assignProductsToMember] 상품 할당 요청:`, requestData);
                await App.api.post(`/members/${memberId}/products`, requestData);
                App.log(`[assignProductsToMember] 상품 ID ${productId} 할당 완료`);
            } catch (error) {
                // 에러 응답의 상세 정보 로깅
                if (error.response && error.response.data) {
                    App.err('상품 할당 실패 상세:', {
                        productId: productId,
                        error: error.response.data.error,
                        message: error.response.data.message,
                        errorType: error.response.data.errorType,
                        cause: error.response.data.cause,
                        memberId: error.response.data.memberId,
                        productIdFromServer: error.response.data.productId
                    });
                } else {
                    App.err('상품 할당 실패:', error);
                }
                throw error; // 상위로 전파하여 전체 프로세스 중단
            }
        }
    } catch (error) {
        App.err('상품 할당 실패:', error);
        // 상품 할당 실패해도 회원 저장은 성공했으므로 경고만 표시
        App.showNotification('상품 할당에 실패했습니다.', 'warning');
    }
}

async function deleteMember(id) {
    // 관리자 권한 확인
    if (!App.currentUser || App.currentUser.role !== 'ADMIN') {
        App.showNotification('회원 삭제는 관리자만 가능합니다.', 'danger');
        return;
    }
    
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/members/${id}`);
        App.showNotification('회원이 삭제되었습니다.', 'success');
        loadMembers();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

async function deleteAllMembers() {
    // 관리자 권한 확인
    if (!App.currentUser || App.currentUser.role !== 'ADMIN') {
        App.showNotification('회원 전체 삭제는 관리자만 가능합니다.', 'danger');
        return;
    }
    
    // 이중 확인 (위험한 작업이므로)
    const firstConfirm = confirm('⚠️ 경고: 모든 회원 데이터가 삭제됩니다!\n\n이 작업은 되돌릴 수 없습니다.\n\n정말 모든 회원을 삭제하시겠습니까?');
    if (!firstConfirm) return;
    
    const secondConfirm = confirm('⚠️ 최종 확인\n\n모든 회원 정보, 상품 할당, 결제 내역, 예약 내역 등이 영구적으로 삭제됩니다.\n\n정말 진행하시겠습니까?');
    if (!secondConfirm) return;
    
    const finalConfirm = prompt('최종 확인을 위해 "DELETE ALL"을 정확히 입력하세요:');
    if (finalConfirm !== 'DELETE ALL') {
        App.showNotification('입력이 일치하지 않아 취소되었습니다.', 'warning');
        return;
    }
    
    try {
        App.showNotification('회원 전체 삭제 중...', 'info');
        await App.api.delete('/members/all');
        App.showNotification('모든 회원이 삭제되었습니다.', 'success');
        loadMembers();
    } catch (error) {
        App.err('회원 전체 삭제 실패:', error);
        App.showNotification('회원 전체 삭제에 실패했습니다.', 'danger');
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
        case 'product-history':
            if (member?.id) {
                loadMemberProductHistory(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">회원 정보를 불러올 수 없습니다.</p>';
            }
            break;
        case 'stats':
            content.innerHTML = '<p class="member-stats-loading">능력치 정보 로딩 중...</p>';
            if (member && member.id) {
                App.api.get('/members/' + member.id + '/ability-stats-context').then(function(ctx) {
                    content.innerHTML = renderMemberStats(member, ctx);
                    setupMemberStatsLegendToggles(content);
                }).catch(function() {
                    content.innerHTML = renderMemberStats(member, null);
                    setupMemberStatsLegendToggles(content);
                });
            } else {
                content.innerHTML = renderMemberStats(member, null);
                setupMemberStatsLegendToggles(content);
            }
            break;
        case 'memo':
            content.innerHTML = renderMemberMemo(member);
            break;
    }
}

/** 1~5단계 표시: 숫자면 "N단계", 아니면 기존 상/중/하 등 */
function fmtStageDisplay(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    if (n >= 1 && n <= 5) return Math.round(n) + '단계';
    return v;
}
function fmtLevelOrStage(s) {
    if (!s) return null;
    var u = String(s).toUpperCase();
    if (u === 'HIGH' || u === '상') return '상';
    if (u === 'MID' || u === 'MIDDLE' || u === '중') return '중';
    if (u === 'LOW' || u === '하') return '하';
    if (/^[1-5]$/.test(String(s))) return String(s) + '단계';
    return s;
}

/** 기본 정보 탭용: 투수/타자 등록 능력치 요약 (담당 코치 위에 표시) */
function renderMemberAbilitySummary(member) {
    if (!member) return '';
    var fmtNum = function(v) { return v != null && v !== '' ? Number(v) : null; };
    var run = fmtNum(member.runningSpeed);
    var pitcherItems = [
        { label: '구속', val: member.pitchingSpeed != null ? member.pitchingSpeed + ' km/h' : '-' },
        { label: '제구력', val: fmtLevelOrStage(member.pitcherControl) || '-' },
        { label: '유연성', val: fmtLevelOrStage(member.pitcherFlexibility) || '-' },
        { label: '주력', val: fmtStageDisplay(run) || (run != null ? run : '-') }
    ];
    var runB = run != null ? run : fmtNum(member.runningSpeed);
    var batterItems = [
        { label: '스윙 스피드', val: member.swingSpeed != null ? member.swingSpeed + ' mph' : '-' },
        { label: '타구 스피드', val: member.exitVelocity != null ? member.exitVelocity + ' mph' : '-' },
        { label: '파워', val: fmtStageDisplay(member.batterPower) || '-' },
        { label: '주력', val: fmtStageDisplay(runB) || (runB != null ? runB : '-') },
        { label: '유연성', val: fmtStageDisplay(member.batterFlexibility) || '-' }
    ];
    var hasAny = pitcherItems.some(function(p) { return p.val !== '-'; }) || batterItems.some(function(p) { return p.val !== '-'; });
    if (!hasAny) return '';
    var row = function(items) {
        return items.map(function(p) {
            var v = p.val !== '-' && App.escapeHtml ? App.escapeHtml(String(p.val)) : (p.val !== '-' ? String(p.val) : '-');
            return '<span class="member-ability-item"><span class="member-ability-label">' + p.label + '</span> ' + (p.val !== '-' ? '<span class="member-ability-value">' + v + '</span>' : '-') + '</span>';
        }).join('');
    };
    return `
        <div class="form-row member-ability-summary-row">
            <div class="form-group member-ability-summary-col">
                <label class="form-label">투수 기록</label>
                <div class="member-ability-summary-block">${row(pitcherItems)}</div>
            </div>
            <div class="form-group member-ability-summary-col">
                <label class="form-label">타자 기록</label>
                <div class="member-ability-summary-block">${row(batterItems)}</div>
            </div>
        </div>
    `;
}

function renderMemberInfo(member) {
    if (!member) return '<p>로딩 중...</p>';
    const coachDisplay = getMemberCoachDisplayFromProducts(member);
    return `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">이름</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${App.escapeHtml(member.name || '')}</div>
            </div>
            <div class="form-group">
                <label class="form-label">전화번호</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${App.escapeHtml(member.phoneNumber || '')}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">학교/소속</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${App.escapeHtml(member.school || '-')}</div>
            </div>
            <div class="form-group">
                <label class="form-label">등급</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getGradeText(member.grade)}</div>
            </div>
        </div>
        ${renderMemberAbilitySummary(member)}
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">담당 코치</label>
                <div class="form-control" style="background: var(--bg-tertiary); white-space: pre-line; line-height: 1.6;">${coachDisplay}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">누적 결제</label>
                <div class="form-control" style="background: var(--bg-tertiary); font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(member.totalPayment || 0)}</div>
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
        App.log('이용권 목록 로드:', products);
        content.innerHTML = renderProductsList(products);
        if (typeof window.applyCoachNameColors === 'function') {
            window.applyCoachNameColors(content);
        }
    } catch (error) {
        App.err('이용권 로드 실패:', error);
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
                const status = p.status || 'UNKNOWN';
                
                // remainingCount 계산 (상태가 USED_UP이면 0으로 표시)
                let remaining = p.remainingCount;
                
                // 상태가 USED_UP이면 잔여 횟수는 0
                if (status === 'USED_UP') {
                    remaining = 0;
                }
                // remainingCount가 null이나 undefined일 때만 대체값 사용 (0은 유효한 값)
                else if (remaining === null || remaining === undefined) {
                    // 상품의 실제 usageCount를 우선 사용 (데이터 일관성 보장)
                    remaining = product.usageCount;
                    if (remaining === null || remaining === undefined) {
                        remaining = p.totalCount;
                    }
                    if (remaining === null || remaining === undefined) {
                        remaining = 0;
                    }
                }
                // remainingCount가 0이면 0으로 유지 (대체값 사용하지 않음)
                remaining = remaining !== null && remaining !== undefined ? remaining : 0;
                
                // totalCount 계산 (totalCount가 null이면 product.usageCount 사용)
                let total = p.totalCount;
                if (total === null || total === undefined || total === 0) {
                    total = product.usageCount;
                }
                total = total !== null && total !== undefined ? total : 0;
                
                const expiryDate = p.expiryDate ? App.formatDate(p.expiryDate) : '-';
                const productId = p.id;
                const isCountPass = product.type === 'COUNT_PASS';
                const isMonthlyPass = product.type === 'MONTHLY_PASS';
                const startDate = p.purchaseDate ? App.formatDate(p.purchaseDate.split('T')[0]) : '-';
                
                const rawCoachName = p.coachName || (p.coach && p.coach.name) || (product.coach && product.coach.name) || '미지정';
                const coachDisplay = renderCoachNamesWithColorsFromText(rawCoachName);
                
                // 패키지 항목별 잔여 횟수 표시
                let remainingDisplay = '';
                let displayColor = 'var(--text-secondary)';
                
                if (p.packageItemsRemaining) {
                    try {
                        const packageItems = JSON.parse(p.packageItemsRemaining);
                        const itemsText = packageItems.map(item => `${item.name} ${item.remaining}회`).join(', ');
                        remainingDisplay = `<strong style="color: var(--accent-primary);">[패키지]</strong> ${itemsText}`;
                    } catch (e) {
                        // 횟수권인 경우 색상 적용
                        if (isCountPass) {
                            // 잔여 횟수가 0이면 빨간색으로 "이용권 마감" 표시
                            if (remaining === 0 || status === 'USED_UP') {
                                displayColor = '#dc3545'; // 빨간색
                                remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">이용권 마감</span>';
                            } else {
                                displayColor = getRemainingCountColor(remaining);
                                // total이 0이면 "잔여: X회" 형식으로 표시
                                if (total > 0) {
                                    remainingDisplay = `잔여: ${remaining}/${total}`;
                                } else {
                                    remainingDisplay = `잔여: ${remaining}회`;
                                }
                            }
                        } else {
                            // total이 0이면 "잔여: X회" 형식으로 표시
                            if (total > 0) {
                                remainingDisplay = `잔여: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `잔여: ${remaining}회`;
                            }
                        }
                    }
                } else {
                    // 횟수권인 경우 색상 적용
                    if (isCountPass) {
                        // 잔여 횟수가 0이면 빨간색으로 "이용권 마감" 표시
                        if (remaining === 0 || status === 'USED_UP') {
                            displayColor = '#dc3545'; // 빨간색
                            remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">이용권 마감</span>';
                        } else {
                            displayColor = getRemainingCountColor(remaining);
                            // total이 0이면 "잔여: X회" 형식으로 표시
                            if (total > 0) {
                                remainingDisplay = `잔여: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `잔여: ${remaining}회`;
                            }
                        }
                    } else if (isMonthlyPass && p.expiryDate) {
                        displayColor = getExpiryDateColor(p.expiryDate);
                        // total이 0이면 "잔여: X회" 형식으로 표시
                        if (total > 0) {
                            remainingDisplay = `잔여: ${remaining}/${total}`;
                        } else {
                            remainingDisplay = `잔여: ${remaining}회`;
                        }
                    } else {
                        // total이 0이면 "잔여: X회" 형식으로 표시
                        if (total > 0) {
                            remainingDisplay = `잔여: ${remaining}/${total}`;
                        } else {
                            remainingDisplay = `잔여: ${remaining}회`;
                        }
                    }
                }
                
                // 기간권인 경우 만료일 정보 추가 및 색상 적용
                let periodInfo = '';
                if (isMonthlyPass) {
                    if (p.expiryDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const expiry = new Date(p.expiryDate);
                        expiry.setHours(0, 0, 0, 0);
                        const remainingDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                        
                        if (remainingDays >= 0) {
                            periodInfo = ` | 시작일: ${startDate} | 유효기간: ${expiryDate} (${remainingDays}일 남음)`;
                        } else {
                            periodInfo = ` | 시작일: ${startDate} | 유효기간: ${expiryDate} (만료됨)`;
                        }
                        displayColor = getExpiryDateColor(p.expiryDate);
                    } else {
                        periodInfo = ` | 시작일: ${startDate} | 유효기간: -`;
                    }
                }
                
                // 상태를 한글로 변환
                const statusText = {
                    'ACTIVE': '활성',
                    'EXPIRED': '만료',
                    'USED_UP': '사용 완료',
                    'INACTIVE': '비활성'
                };
                const statusDisplay = statusText[status] || status;
                
                return `
                <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border-color); gap: 12px;">
                    <div class="product-info" style="flex: 1;">
                        <div class="product-name" style="font-weight: 600; margin-bottom: 6px;">${productName}</div>
                        <div class="product-detail" style="font-size: 14px; color: ${displayColor}; font-weight: 600;">
                            ${remainingDisplay}${periodInfo}
                        </div>
                        <div class="product-coach" style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
                            담당 코치/강사: ${coachDisplay}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="badge badge-${status === 'ACTIVE' ? 'success' : status === 'EXPIRED' ? 'warning' : 'secondary'}">${statusDisplay}</span>
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
                        <button class="btn btn-sm btn-danger" onclick="deleteMemberProduct(${productId}, '${productName}')" title="이용권 삭제">
                            삭제
                        </button>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

// 전역에서 접근 가능하도록 window 객체에 할당
window.renderProductsList = renderProductsList;
window.getRemainingCountColor = getRemainingCountColor;
window.getExpiryDateColor = getExpiryDateColor;
window.applyCoachNameColors = applyCoachNameColors;
window.getMemberCoachDisplayFromProducts = getMemberCoachDisplayFromProducts;

// 코치 이름 고유색 재적용 (동적 렌더링 후 사용)
function applyCoachNameColors(container) {
    const root = container || document;
    const coachNameNodes = root.querySelectorAll('.coach-name[data-coach-name]');
    if (!coachNameNodes || coachNameNodes.length === 0) {
        // continue to fallback parsing below
    } else {
        coachNameNodes.forEach(node => {
            const coachName = (node.getAttribute('data-coach-name') || '').trim();
            if (!coachName || !window.App || !App.CoachColors || typeof App.CoachColors.getColor !== 'function') {
                return;
            }
            const color = App.CoachColors.getColor({ name: coachName });
            if (color) {
                node.style.setProperty('--coach-color', color);
                node.style.color = color;
                node.style.fontWeight = '600';
            }
        });
    }

    // fallback: if plain text is rendered, wrap coach names with spans
    const coachLineNodes = root.querySelectorAll('.product-coach');
    if (!coachLineNodes || coachLineNodes.length === 0) {
        return;
    }
    coachLineNodes.forEach(node => {
        if (node.querySelector('.coach-name')) {
            return;
        }
        const text = (node.textContent || '').trim();
        const match = text.match(/담당\s*코치\/강사:\s*(.+)$/);
        if (!match) {
            return;
        }
        const rawCoachText = match[1].trim();
        if (!rawCoachText) {
            return;
        }
        const rendered = renderCoachNamesWithColorsFromText(rawCoachText);
        node.innerHTML = `담당 코치/강사: ${rendered}`;
    });
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
        App.log('입력 필드를 찾을 수 없습니다.');
        return;
    }
    
    const value = startDateInput.value;
    App.log('시작일 변경됨:', value);
    
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
                App.log('종료일 자동 설정:', endDateStr);
            } else {
                App.log('유효하지 않은 날짜');
            }
        } catch (e) {
            App.err('날짜 파싱 오류:', e);
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
            App.log('시작일 input에 이벤트 리스너 추가');
            
            // 기존 이벤트 제거 후 새로 추가
            startDateInput.onchange = null;
            startDateInput.oninput = null;
            
            startDateInput.addEventListener('change', function() {
                App.log('change 이벤트 발생');
                autoCalculateEndDate();
            });
            
            startDateInput.addEventListener('input', function() {
                App.log('input 이벤트 발생');
                autoCalculateEndDate();
            });
            
            // 캘린더를 클릭할 때마다 계산 (이미 선택된 날짜를 다시 클릭해도)
            startDateInput.addEventListener('click', function() {
                App.log('시작일 필드 클릭됨');
                // 약간의 지연 후 계산 (캘린더에서 날짜 선택 완료 후)
                setTimeout(() => {
                    if (this.value) {
                        App.log('클릭 후 값 있음, 종료일 계산');
                        autoCalculateEndDate();
                    }
                }, 50);
            });
            
            // 모달 열릴 때 시작일이 이미 있으면 즉시 종료일 계산
            if (startDateInput.value) {
                App.log('모달 열릴 때 시작일 있음, 즉시 종료일 계산');
                autoCalculateEndDate();
            }
        } else {
            App.err('시작일 input을 찾을 수 없음');
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
        App.err('결제 내역 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">결제 내역을 불러올 수 없습니다.</p>';
    }
}

function renderPaymentsList(payments) {
    if (!payments || payments.length === 0) {
        return '<p style="text-align: center; color: var(--text-muted); padding: 40px;">결제 내역이 없습니다.</p>';
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

// 전역에서 접근 가능하도록 window 객체에 할당
window.openAdjustCountModal = openAdjustCountModal;
window.openEditPeriodPassModal = openEditPeriodPassModal;
window.deleteMemberProduct = deleteMemberProduct;

// 이용권 삭제
async function deleteMemberProduct(memberProductId, productName) {
    if (!confirm(`"${productName}" 이용권을 삭제하시겠습니까?\n\n주의: 관련된 예약과 결제 정보도 함께 삭제됩니다.`)) {
        return;
    }
    
    try {
        const response = await App.api.delete(`/member-products/${memberProductId}`);
        
        if (response && response.success) {
            App.showNotification('이용권이 삭제되었습니다.', 'success');
            
            // 회원 상세 모달이 열려있으면 이용권 목록 새로고침
            const memberDetailModal = document.getElementById('member-detail-modal');
            if (memberDetailModal && memberDetailModal.style.display !== 'none' && currentMemberDetail) {
                // 현재 활성화된 탭 확인
                const activeTab = document.querySelector('#member-detail-modal .tab-btn.active');
                if (activeTab && activeTab.getAttribute('data-tab') === 'products') {
                    // 이용권 탭이 활성화되어 있으면 목록 새로고침
                    loadMemberProductsForDetail(currentMemberDetail.id);
                }
            }
            
            // 회원 수정 모달이 열려있으면 상품 목록도 새로고침
            const memberModal = document.getElementById('member-modal');
            if (memberModal && memberModal.style.display === 'flex' && currentEditingMember) {
                // 회원 수정 모달이 열려있으면 상품 목록 새로고침
                if (typeof loadMemberProducts === 'function') {
                    loadMemberProducts(currentEditingMember.id);
                }
            }
        } else {
            App.showNotification(response?.error || '이용권 삭제에 실패했습니다.', 'danger');
        }
    } catch (error) {
        App.err('이용권 삭제 실패:', error);
        const errorMsg = error.response?.data?.error || '이용권 삭제에 실패했습니다.';
        App.showNotification(errorMsg, 'danger');
    }
}

async function loadMemberBookings(memberId) {
    const content = document.getElementById('detail-tab-content');
    try {
        const bookings = await App.api.get(`/members/${memberId}/bookings`);
        content.innerHTML = renderBookingsList(bookings);
        if (typeof window.applyCoachNameColors === 'function') {
            window.applyCoachNameColors(content);
        }
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
                        <th>상품/이용권</th>
                        <th>코치</th>
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
                        const productName = b.memberProduct?.productName || '-';
                        const coachName = b.coach?.name || b.coachName || '-';
                        const coachDisplay = coachName !== '-' ? renderCoachNamesWithColorsFromText(coachName) : '-';
                        
                        return `
                        <tr>
                            <td>${b.id || '-'}</td>
                            <td>${productName}</td>
                            <td>${coachDisplay}</td>
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
                        <th>출석 내용</th>
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendance.map(a => {
                        const facilityName = a.facility?.name || a.facilityName || '-';
                        const date = a.date ? App.formatDate(a.date) : '-';
                        const checkInTime = a.checkInTime ? App.formatDateTime(a.checkInTime) : (a.status === 'PRESENT' ? '<span style="color: var(--text-muted);">체크인 안 함</span>' : '-');
                        const checkOutTime = a.checkOutTime ? App.formatDateTime(a.checkOutTime) : (a.checkInTime ? '<span style="color: var(--text-muted);">체크아웃 안 함</span>' : '-');
                        const status = a.status || 'UNKNOWN';
                        const statusText = getAttendanceStatusText(status);
                        const statusBadge = getAttendanceStatusBadge(status);
                        
                        // 이용권 정보 표시
                        let productInfo = '-';
                        if (a.productHistory) {
                            const productName = a.productHistory.productName || '이용권';
                            const changeAmount = a.productHistory.changeAmount || 0;
                            const remaining = a.productHistory.remainingCountAfter || 0;
                            if (changeAmount < 0) {
                                productInfo = `${productName} ${changeAmount} (잔여: ${remaining}회)`;
                            } else {
                                productInfo = `${productName} +${changeAmount} (잔여: ${remaining}회)`;
                            }
                        } else if (a.booking?.memberProduct) {
                            const productName = a.booking.memberProduct.product?.name || '이용권';
                            productInfo = `${productName} (사용됨)`;
                        }
                        
                        return `
                        <tr>
                            <td>${date}</td>
                            <td>${facilityName}</td>
                            <td>${checkInTime}</td>
                            <td>${checkOutTime}</td>
                            <td>${productInfo}</td>
                            <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadMemberProductHistory(memberId) {
    const content = document.getElementById('detail-tab-content');
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">로딩 중...</p>';
    
    try {
        const [products, history] = await Promise.all([
            App.api.get(`/members/${memberId}/products`),
            App.api.get(`/members/${memberId}/product-history`)
        ]);
        content.innerHTML = renderPurchaseHistorySection(products) + renderProductHistory(history);
    } catch (error) {
        App.err('이용권 히스토리 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">이용권 히스토리를 불러올 수 없습니다.</p>';
    }
}

/** 이용권 구매/종료 이력 테이블 (언제 뭘 샀고, 언제 종료되었는지) */
function renderPurchaseHistorySection(products) {
    if (!products || products.length === 0) {
        return `
        <div class="card" style="margin-bottom: 20px;">
            <div class="card-header"><h3 class="card-title">이용권 구매/종료 이력</h3></div>
            <div class="card-body">
                <p style="text-align: center; color: var(--text-muted); padding: 24px;">구매 이력이 없습니다.</p>
            </div>
        </div>`;
    }
    const statusText = (s) => ({ 'ACTIVE': '활성', 'EXPIRED': '만료', 'USED_UP': '소진' }[s] || s || '-');
    const sorted = [...products].sort((a, b) => {
        const d1 = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        const d2 = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        return d2 - d1;
    });
    const rows = sorted.map(p => {
        const product = p.product || {};
        const name = product.name || '상품';
        const type = getProductTypeText(product.type) || '-';
        const purchaseDate = p.purchaseDate ? App.formatDateTime(p.purchaseDate) : '-';
        const status = statusText(p.status);
        const statusBadge = p.status === 'ACTIVE' ? 'success' : (p.status === 'USED_UP' ? 'warning' : 'secondary');
        let endDisplay = '-';
        if (product.type === 'MONTHLY_PASS' && p.expiryDate) {
            endDisplay = App.formatDate(p.expiryDate) + ' (만료일)';
        } else if (p.status === 'USED_UP') {
            endDisplay = '횟수 소진';
        } else if (p.status === 'EXPIRED') {
            endDisplay = p.expiryDate ? App.formatDate(p.expiryDate) + ' 만료' : '만료';
        }
        const price = p.actualPurchasePrice != null ? App.formatCurrency(p.actualPurchasePrice) : '-';
        return `
        <tr>
            <td>${purchaseDate}</td>
            <td>${name}</td>
            <td>${type}</td>
            <td><span class="badge badge-${statusBadge}">${status}</span></td>
            <td>${endDisplay}</td>
            <td>${price}</td>
        </tr>`;
    }).join('');
    return `
    <div class="card" style="margin-bottom: 20px;">
        <div class="card-header"><h3 class="card-title">이용권 구매/종료 이력</h3></div>
        <div class="card-body">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">언제 어떤 이용권을 구매했고, 만료/소진 시점을 한눈에 볼 수 있습니다.</p>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>구매일시</th>
                            <th>상품명</th>
                            <th>유형</th>
                            <th>상태</th>
                            <th>종료/만료</th>
                            <th>구매 금액</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function renderProductHistory(history) {
    function getTransactionTypeText(type, description) {
        if (type === 'CHARGE' && description && (description + '').indexOf('연장') !== -1) return '연장';
        const typeMap = { 'CHARGE': '구매/충전', 'DEDUCT': '차감', 'ADJUST': '조정' };
        return typeMap[type] || type;
    }
    function getTransactionTypeBadge(type, description) {
        if (type === 'CHARGE' && description && (description + '').indexOf('연장') !== -1) return 'info';
        const badgeMap = { 'CHARGE': 'success', 'DEDUCT': 'danger', 'ADJUST': 'warning' };
        return badgeMap[type] || 'secondary';
    }
    function getBranchDisplay(branch, facilityName) {
        if (facilityName) return facilityName;
        const branchNames = { SAHA: '사하점', YEONSAN: '연산점', RENTAL: '대관' };
        return (branch && branchNames[branch]) ? branchNames[branch] : '-';
    }
    const list = history && history.length ? history : [];
    const rows = list.map(h => {
        const bookingId = h.bookingId != null ? h.bookingId : '-';
        const date = h.transactionDate ? App.formatDateTime(h.transactionDate) : '-';
        const productName = (h.memberProduct && (h.memberProduct.name || h.memberProduct.product?.name || h.memberProduct.productName)) || '이용권';
        const branchDisplay = getBranchDisplay(h.branch, h.facilityName);
        const type = h.type || 'UNKNOWN';
        const desc = h.description || '';
        const typeText = getTransactionTypeText(type, desc);
        const typeBadge = getTransactionTypeBadge(type, desc);
        const changeAmount = h.changeAmount || 0;
        const changeDisplay = changeAmount > 0 ? `+${changeAmount}` : `${changeAmount}`;
        const remaining = h.remainingCountAfter !== null && h.remainingCountAfter !== undefined ? h.remainingCountAfter : '-';
        const description = desc || '-';
        return `
        <tr>
            <td>${bookingId}</td>
            <td>${date}</td>
            <td>${productName}</td>
            <td>${branchDisplay}</td>
            <td><span class="badge badge-${typeBadge}">${typeText}</span></td>
            <td style="font-weight: ${changeAmount < 0 ? '600' : '400'}; color: ${changeAmount < 0 ? 'var(--danger)' : 'var(--success)'};">${changeDisplay}</td>
            <td>${remaining}회</td>
            <td>${description}</td>
        </tr>`;
    }).join('');
    return `
    <div class="card">
        <div class="card-header"><h3 class="card-title">변동 내역 (충전/차감/연장 등)</h3></div>
        <div class="card-body">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">이용권 횟수 충전(구매/연장), 차감(사용), 조정 기록입니다.</p>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>예약번호</th>
                            <th>일시</th>
                            <th>이용권</th>
                            <th>지점</th>
                            <th>유형</th>
                            <th>변경량</th>
                            <th>변경 후 잔여</th>
                            <th>설명</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">변동 내역이 없습니다.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function setupMemberStatsLegendToggles(container) {
    var wrap = container && container.querySelector ? container.querySelector('.member-stats-ability-wrap') : null;
    if (!wrap) return;
    [].forEach.call(wrap.querySelectorAll('.legend-toggle'), function(cb) {
        cb.addEventListener('change', function() {
            var layer = this.getAttribute('data-layer');
            var cls = 'radar-polygon-' + (layer || '');
            var visible = this.checked;
            [].forEach.call(wrap.querySelectorAll('.' + cls), function(el) {
                el.style.visibility = visible ? 'visible' : 'hidden';
            });
        });
    });
}

function renderMemberStats(member, context) {
    if (!member) return '<p>로딩 중...</p>';
    var fmtNum = function(v) { return v != null && v !== '' ? Number(v) : null; };
    var fmtLevel = function(s) {
        if (!s) return null;
        var u = String(s).toUpperCase();
        if (u === 'HIGH' || u === '상') return '상';
        if (u === 'MID' || u === 'MIDDLE' || u === '중') return '중';
        if (u === 'LOW' || u === '하') return '하';
        if (/^[1-5]$/.test(String(s))) return String(s) + '단계';
        return s;
    };
    /** 1~5단계 또는 상/중/하 -> 0~1 비율 (레이더용) */
    var levelToRatio = function(s) {
        if (!s) return 0;
        var u = String(s).toUpperCase();
        if (u === 'HIGH' || u === '상') return 1;
        if (u === 'MID' || u === 'MIDDLE' || u === '중') return 0.6;
        if (u === 'LOW' || u === '하') return 0.3;
        var n = parseInt(s, 10);
        if (n >= 1 && n <= 5) return n / 5;
        return 0.5;
    };
    /** 숫자 값이 1~5면 /5, 아니면 기존 스케일(예: /100, /30) 적용 */
    var toRatio = function(v, max) {
        if (v == null) return 0;
        var n = Number(v);
        if (n >= 1 && n <= 5) return n / 5;
        return max ? Math.min(1, n / max) : 0;
    };
    var pitchVel = fmtNum(member.pitchingSpeed);
    var pitchPower = fmtNum(member.batterPower);
    var pitchCtrl = fmtLevel(member.pitcherControl);
    var pitchFlex = fmtLevel(member.pitcherFlexibility);
    var runSpeed = fmtNum(member.runningSpeed);
    var swingVel = fmtNum(member.swingSpeed);
    var exitVel = fmtNum(member.exitVelocity);
    var batPower = fmtNum(member.batterPower);
    var batFlex = fmtNum(member.batterFlexibility);
    var runSpeedB = runSpeed != null ? runSpeed : fmtNum(member.runningSpeed);
    var maxPitchVel = 160; var maxPower = 100; var maxRun = 30;
    var p1 = pitchVel != null ? Math.min(1, pitchVel / maxPitchVel) : 0;
    var p2 = toRatio(pitchPower, maxPower);
    var p3 = levelToRatio(member.pitcherControl);
    var p4 = levelToRatio(member.pitcherFlexibility);
    var p5 = toRatio(runSpeed, maxRun);
    var cx = 80; var cy = 80; var r = 70;
    var labelGap = 10;
    var rLabel = r + labelGap;
    var pentagonOutline = [0,1,2,3,4].map(function(i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        return (cx + r * Math.cos(rad)).toFixed(1) + ',' + (cy + r * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var fillPoints = [p1, p2, p3, p4, p5].map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var avgToRatio = function(v, max) {
        if (v == null) return 0;
        var n = Number(v);
        if (n >= 1 && n <= 5) return n / 5;
        return max ? Math.min(1, n / max) : Math.min(1, n);
    };
    var avgPitcher = context && context.averages && context.averages.pitcher ? context.averages.pitcher : null;
    var a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0;
    if (avgPitcher) {
        a1 = avgPitcher.velocity != null ? Math.min(1, Number(avgPitcher.velocity) / maxPitchVel) : 0;
        a2 = avgToRatio(avgPitcher.power, maxPower);
        a3 = avgToRatio(avgPitcher.controlRatio, null);
        a4 = avgToRatio(avgPitcher.flexibilityRatio, null);
        a5 = avgToRatio(avgPitcher.runningSpeed, maxRun);
    }
    var avgFillPoints = [a1, a2, a3, a4, a5].map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var rankPitcher = context && context.rankings && context.rankings.pitcher ? context.rankings.pitcher : {};
    var pitcherRankKeys = ['velocity', 'power', 'control', 'flexibility', 'runningSpeed'];
    var pitcherLabels = ['구속', '파워', '제구력', '유연성', '주력'];
    var pitcherVals = [
        pitchVel != null ? pitchVel + ' km/h' : '-',
        pitchPower != null ? (pitchPower >= 1 && pitchPower <= 5 ? pitchPower + '단계' : pitchPower) : '-',
        pitchCtrl || '-',
        pitchFlex || '-',
        runSpeed != null ? (runSpeed >= 1 && runSpeed <= 5 ? runSpeed + '단계' : runSpeed) : '-'
    ];
    var rankToPercentText = function(val) {
        if (val == null) return '';
        var rank = 0, total = 0;
        if (typeof val === 'object' && val.rank != null && val.total != null) {
            rank = Number(val.rank);
            total = Number(val.total);
        } else if (typeof val === 'number') {
            rank = val;
            total = 0;
        }
        if (total <= 0) return '';
        var pct = total <= 1 ? 100 : (rank / total) * 100;
        var bands = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
        var band = 100;
        for (var b = 0; b < bands.length; b++) {
            if (pct <= bands[b]) { band = bands[b]; break; }
        }
        var cls = band <= 10 ? 'stat-rank stat-rank-gold' : 'stat-rank';
        return ' <span class="' + cls + '">(상위 ' + band + '% 이내)</span>';
    };
    var rankSuffix = function(i) {
        var val = rankPitcher[pitcherRankKeys[i]];
        return rankToPercentText(val);
    };
    // 타자: 가장 바깥 오각형 = 기준(중학생) 최대치. 스윙75, 타구150, 파워·주력·유연성 1~5단계 → 꼭짓점 5.
    var refSwing = 75, refExit = 150, refStage = 5;
    var toRefRatio = function(val, refMax) {
        if (val == null || refMax == null) return 0;
        return Math.min(1, Number(val) / refMax);
    };
    var b1 = toRefRatio(swingVel, refSwing);
    var b2 = toRefRatio(exitVel, refExit);
    var b3 = toRefRatio(batPower != null ? (batPower >= 1 && batPower <= 5 ? batPower : batPower) : null, refStage);
    var b4 = toRefRatio(runSpeedB, refStage);
    var b5 = toRefRatio(batFlex, refStage);
    // 바깥 오각형 = 기준(1,1,1,1,1) = 최대치 꼭짓점
    var pentagonOutlineB = [0,1,2,3,4].map(function(i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        return (cx + r * Math.cos(rad)).toFixed(1) + ',' + (cy + r * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var bVals = [b1, b2, b3, b4, b5];
    var fillPointsB = bVals.map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var avgBatter = context && context.averages && context.averages.batter ? context.averages.batter : null;
    var ba1 = 0, ba2 = 0, ba3 = 0, ba4 = 0, ba5 = 0;
    if (avgBatter) {
        ba1 = toRefRatio(avgBatter.swingSpeed, refSwing);
        ba2 = toRefRatio(avgBatter.exitVelocity, refExit);
        ba3 = toRefRatio(avgBatter.power, refStage);
        ba4 = toRefRatio(avgBatter.runningSpeed, refStage);
        ba5 = toRefRatio(avgBatter.flexibility, refStage);
    }
    var avgFillPointsB = [ba1, ba2, ba3, ba4, ba5].map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    // 타자 레이더: concentric 그리드 + 축선 (클래스로 스타일 → 테마 대비)
    var radarGridB = [0.25, 0.5, 0.75].map(function(ratio) {
        var pts = [0,1,2,3,4].map(function(i) {
            var a = -90 + i * 72;
            var rad = a * Math.PI / 180;
            var r2 = r * ratio;
            return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
        }).join(' ');
        return '<polygon points="' + pts + '" fill="none" class="radar-grid"/>';
    }).join('\n                        ');
    var radarAxesB = [0,1,2,3,4].map(function(i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var x2 = cx + r * Math.cos(rad);
        var y2 = cy + r * Math.sin(rad);
        return '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" class="radar-axis"/>';
    }).join('\n                        ');
    var rankBatter = context && context.rankings && context.rankings.batter ? context.rankings.batter : {};
    var batterRankKeys = ['swingSpeed', 'exitVelocity', 'power', 'runningSpeed', 'flexibility'];
    var batterLabels = ['스윙 스피드', '타구 스피드', '파워', '주력', '유연성'];
    var batterVals = [
        swingVel != null ? swingVel + ' mph' : '-',
        exitVel != null ? exitVel + ' mph' : '-',
        batPower != null ? (batPower >= 1 && batPower <= 5 ? batPower + '단계' : batPower) : '-',
        runSpeedB != null ? (runSpeedB >= 1 && runSpeedB <= 5 ? runSpeedB + '단계' : runSpeedB) : '-',
        batFlex != null ? (batFlex >= 1 && batFlex <= 5 ? batFlex + '단계' : batFlex) : '-'
    ];
    var rankSuffixB = function(i) {
        var val = rankBatter[batterRankKeys[i]];
        return rankToPercentText(val);
    };
    /** 꼭짓점 라벨: 글자 수가 많아도 그래프~한글 간격이 동일하도록, 텍스트 박스 안쪽까지 거리를 보정 */
    var labelFontH = 10;
    var labelCharW = 6;
    var vertexTexts = function(vals) {
        return [0, 1, 2, 3, 4].map(function(i) {
            var a = -90 + i * 72;
            var rad = a * Math.PI / 180;
            var text = (vals[i] != null && vals[i] !== '') ? String(vals[i]) : '-';
            var len = text.length;
            var w = len * labelCharW;
            var depth = (w / 2) * Math.abs(Math.cos(rad)) + (labelFontH / 2) * Math.abs(Math.sin(rad));
            var rL = r + labelGap + depth;
            var x = cx + rL * Math.cos(rad);
            var y = cy + rL * Math.sin(rad);
            return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" class="radar-vertex-value" text-anchor="middle" dominant-baseline="middle">' + (App.escapeHtml ? App.escapeHtml(text) : text) + '</text>';
        }).join('\n                        ');
    };
    var pitcherVertexLabels = vertexTexts(pitcherLabels);
    var batterVertexLabels = vertexTexts(batterLabels);
    var gradeHtml = (context && context.gradeLabel) ? '<p class="member-stats-grade">소속 등급: <strong>' + (App.escapeHtml ? App.escapeHtml(context.gradeLabel) : context.gradeLabel) + '</strong></p>' : '';
    var refGradeLabel = (context && context.gradeLabel) ? context.gradeLabel : '중학생';
    var legendHtml = '<p class="member-stats-legend">' +
        '<span class="legend-item legend-item-fixed"><span class="legend-dot legend-ref"></span> 기준: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + '</span>' +
        ' <label class="legend-item legend-item-avg"><input type="checkbox" class="legend-toggle" data-layer="avg" checked><span class="legend-dot legend-avg"></span> 동일 등급 평균</label>' +
        ' <label class="legend-item legend-item-member"><input type="checkbox" class="legend-toggle" data-layer="member" checked><span class="legend-dot legend-member"></span> 본인</label>' +
        '</p>';
    return `
        <div class="member-stats-ability-wrap">
            ${gradeHtml}
            ${legendHtml}
            <div class="member-stats-ability-col">
                <h3 class="member-stats-ability-title">투수</h3>
                <div class="member-stats-radar">
                    <svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-pitcher">
                        ${radarGridB}
                        ${radarAxesB}
                        <polygon points="${pentagonOutline}" fill="none" class="radar-polygon-ref"/>
                        ${avgPitcher ? '<polygon points="' + avgFillPoints + '" class="radar-polygon-avg"/>' : ''}
                        <polygon points="${fillPoints}" class="radar-polygon-member"/>
                        ${pitcherVertexLabels}
                    </svg>
                </div>
                <ul class="member-stats-list">
                    ${pitcherLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (pitcherVals[i] || '-') + rankSuffix(i) + '</span></li>'; }).join('')}
                </ul>
            </div>
            <div class="member-stats-ability-col">
                <h3 class="member-stats-ability-title">타자</h3>
                <div class="member-stats-radar">
                    <svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter">
                        ${radarGridB}
                        ${radarAxesB}
                        <polygon points="${pentagonOutlineB}" class="radar-polygon-ref" fill="none"/>
                        ${avgBatter ? '<polygon points="' + avgFillPointsB + '" class="radar-polygon-avg"/>' : ''}
                        <polygon points="${fillPointsB}" class="radar-polygon-member"/>
                        ${batterVertexLabels}
                    </svg>
                </div>
                <p class="member-stats-batter-ref-caption">기준: ${App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel} (스윙 75, 타구 150, 파워·주력·유연성 5단계)</p>
                <p class="member-stats-batter-ref-hint" style="color: #22c55e; font-size: 13px; margin-top: 4px;">표시된 영역이 바깥 5각형(기준선)에 가깝게 채워질수록 동일 등급 내 상위 수준에 해당합니다.</p>
                <ul class="member-stats-list">
                    ${batterLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (batterVals[i] || '-') + rankSuffixB(i) + '</span></li>'; }).join('')}
                </ul>
            </div>
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
        
        App.log('연장 모달 - 회원 보유 상품 개수:', memberProducts?.length || 0);
        App.log('연장 모달 - 구매 가능한 상품 개수:', allProducts?.length || 0);
        
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
        
        App.log('연장 모달 - 드롭다운에 추가된 옵션 개수:', freshSelect.options.length - 1); // -1은 기본 옵션 제외
        
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
        App.err('상품/이용권 목록 로드 실패:', error);
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
                    App.warn('상품 생성 실패, 기존 상품 확인 중:', error);
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
        App.err('상품/이용권 연장 실패:', error);
        App.showNotification('상품/이용권 연장에 실패했습니다.', 'danger');
    }
}

// 누락된 결제 생성 함수 제거됨 - 이제 자동으로 계산됩니다

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
