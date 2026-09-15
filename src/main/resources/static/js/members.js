// 회원 관리 페이지 JavaScript

// 기간권 날짜 포맷 (26. 01. 01. ~ 01. 31.)
function formatPeriodPass(startDate, endDate) {
    if (!startDate || !endDate) return '';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 시작: YY. MM. DD.
    const startYear = String(start.getFullYear()).slice(-2);
    const startMonth = String(start.getMonth() + 1).padStart(2, '0');
    const startDay = String(start.getDate()).padStart(2, '0');
    
    // 종료: MM. DD.
    const endMonth = String(end.getMonth() + 1).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');
    
    return `${startYear}. ${startMonth}. ${startDay}. ~ ${endMonth}. ${endDay}.`;
}

let memberListPage = 1;
let currentFilters = {};
const MEMBER_PAGE_SIZE = 50;
let memberPageIndex = 0;
let memberPaginationInfo = null;
let accumulatedMembersList = [];
// \uD68C\uC6D0 \uC0C1\uC138 \uBAA8\uB2EC \uC5F4 \uB9BC (\uB300\uC2DC\uBCF4\uB4DC index.html\uC5D0\uC11C\uB3C4 \uAC19\uC774 \uC0AC\uC6A9). members.html \uB2E8\uB3C5 \uB85C\uB4DC \uC2DC \uC5EC\uAE30\uC11C \uC120\uC5B8\uD574\uC57C ReferenceError \uC5C6\uC74C.
var currentMemberDetail = null;
let currentEditingMember = null; // 현재 편집 중인 회원 정보 (모달 등)
var memberDetailTabsBound = false;

function ensureMembersDetailStyles() {
    if (!document.head) return;
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        if (href.indexOf('members.css') !== -1) return;
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/members.css?v=mem-detail1';
    link.setAttribute('data-afbs-members-css', '1');
    document.head.appendChild(link);
}

function appendModalHtmlIfMissing(id, html) {
    if (document.getElementById(id) || !document.body) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    while (wrap.firstChild) {
        document.body.appendChild(wrap.firstChild);
    }
}

/** 예약/대관 페이지 등 members.html 마크업이 없을 때도 회원 관리와 같은 상세 모달을 쓴다. */
function ensureMemberDetailModals() {
    ensureMembersDetailStyles();
    if (!document.body) return;
    appendModalHtmlIfMissing('member-detail-modal',
        '<div class="modal-overlay" id="member-detail-modal">' +
        '<div class="modal member-detail-modal-box">' +
        '<div class="modal-header">' +
        '<h2 class="modal-title" id="member-detail-title">회원 상세</h2>' +
        '<button type="button" class="modal-close" aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div class="detail-tabs">' +
        '<button type="button" class="tab-btn active" data-tab="info">기본 정보</button>' +
        '<button type="button" class="tab-btn" data-tab="stats">개인 능력치</button>' +
        '<button type="button" class="tab-btn" data-tab="products">이용권</button>' +
        '<button type="button" class="tab-btn" data-tab="payments">결제 내역</button>' +
        '<button type="button" class="tab-btn" data-tab="bookings">예약 내역</button>' +
        '<button type="button" class="tab-btn" data-tab="attendance">출석 내역</button>' +
        '<button type="button" class="tab-btn" data-tab="product-history">이용권 구매/종료 이력</button>' +
        '<button type="button" class="tab-btn" data-tab="timeline">회원 히스토리</button>' +
        '<button type="button" class="tab-btn" data-tab="memo">코치 메모</button>' +
        '</div>' +
        '<div id="detail-tab-content"></div>' +
        '</div></div></div>');
    appendModalHtmlIfMissing('adjust-count-modal',
        '<div class="modal-overlay" id="adjust-count-modal"><div class="modal">' +
        '<div class="modal-header"><h2 class="modal-title">이용권 횟수 조정</h2>' +
        '<button type="button" class="modal-close">×</button></div>' +
        '<div class="modal-body"><form id="adjust-count-form">' +
        '<input type="hidden" id="adjust-product-id">' +
        '<div class="form-group"><label class="form-label">현재 잔여 횟수</label>' +
        '<div class="form-control" style="background: var(--bg-tertiary); font-weight: 600; color: var(--accent-primary);" id="adjust-current-count">-</div></div>' +
        '<div class="form-group"><label class="form-label">현재 총 횟수</label>' +
        '<div class="form-control" style="background: var(--bg-tertiary);" id="adjust-current-total">-</div></div>' +
        '<div class="form-group"><label class="form-label">조정 방식</label>' +
        '<div style="display: flex; gap: 16px; margin-bottom: 12px;">' +
        '<label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="adjust-mode" value="relative" checked style="margin-right: 6px;"><span>상대 조정 (+/-)</span></label>' +
        '<label style="display: flex; align-items: center; cursor: pointer;"><input type="radio" name="adjust-mode" value="absolute" style="margin-right: 6px;"><span>직접 설정 (잔여 N회로 맞추기)</span></label>' +
        '</div></div>' +
        '<div class="form-group"><label class="form-label" id="adjust-amount-label">조정할 횟수</label>' +
        '<input type="number" class="form-control" id="adjust-amount" placeholder="양수: 추가, 음수: 차감 (예: +5, -3)" required>' +
        '<small style="color: var(--text-muted); font-size: 12px;" id="adjust-amount-hint">양수 입력 시 횟수 추가, 음수 입력 시 횟수 차감</small></div>' +
        '<div class="form-group"><label class="form-label">총 횟수 설정 (선택)</label>' +
        '<input type="number" class="form-control" id="adjust-total" placeholder="비워두면 기존 총 횟수 유지"></div>' +
        '</form></div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" onclick="App.Modal.close(\'adjust-count-modal\')">취소</button>' +
        '<button type="button" class="btn btn-primary" onclick="processAdjustCount()">조정</button>' +
        '</div></div></div>');
    appendModalHtmlIfMissing('edit-period-pass-modal',
        '<div class="modal-overlay" id="edit-period-pass-modal"><div class="modal">' +
        '<div class="modal-header"><h2 class="modal-title">기간권 기간 수정</h2>' +
        '<button type="button" class="modal-close">×</button></div>' +
        '<div class="modal-body"><form id="edit-period-pass-form">' +
        '<input type="hidden" id="edit-period-product-id">' +
        '<div class="form-group"><label class="form-label">시작일 *</label>' +
        '<input type="date" class="form-control" id="edit-period-start-date" required onchange="autoCalculateEndDate()" oninput="autoCalculateEndDate()"></div>' +
        '<div class="form-group"><label class="form-label">종료일 *</label>' +
        '<input type="date" class="form-control" id="edit-period-end-date" required></div>' +
        '</form></div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" onclick="App.Modal.close(\'edit-period-pass-modal\')">취소</button>' +
        '<button type="button" class="btn btn-primary" onclick="processEditPeriodPass()">저장</button>' +
        '</div></div></div>');
    appendModalHtmlIfMissing('extend-product-modal',
        '<div class="modal-overlay" id="extend-product-modal"><div class="modal">' +
        '<div class="modal-header"><h2 class="modal-title">상품/이용권 연장</h2>' +
        '<button type="button" class="modal-close">×</button></div>' +
        '<div class="modal-body"><form id="extend-product-form">' +
        '<input type="hidden" id="extend-member-id">' +
        '<div class="form-group"><label class="form-label">연장할 상품/이용권 선택 *</label>' +
        '<select class="form-control" id="extend-product-select" required><option value="">상품/이용권을 선택하세요...</option></select></div>' +
        '<div class="form-group"><label class="form-label">현재 만료일</label>' +
        '<div class="form-control" style="background: var(--bg-tertiary);" id="extend-current-expiry">-</div></div>' +
        '<div class="form-group"><label class="form-label">구매 금액</label>' +
        '<div class="form-control" style="background: var(--bg-tertiary);" id="extend-purchase-price">-</div></div>' +
        '<div class="form-group"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
        '<label class="form-label" style="margin-bottom:0;">담당 코치/강사</label>' +
        '<button type="button" class="btn btn-sm btn-secondary" id="extend-coach-admin-edit-btn" style="display:none;padding:4px 8px;" title="관리자 전용: 담당 코치 수정">✏️</button></div>' +
        '<div class="form-control" style="background: var(--bg-tertiary);" id="extend-coach">-</div>' +
        '<div id="extend-coach-admin-edit-wrap" style="display:none;margin-top:8px;">' +
        '<select class="form-control" id="extend-coach-admin-select"><option value="">코치를 선택하세요...</option></select>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">' +
        '<button type="button" class="btn btn-sm btn-secondary" id="extend-coach-admin-cancel-btn">취소</button>' +
        '<button type="button" class="btn btn-sm btn-primary" id="extend-coach-admin-save-btn">적용</button>' +
        '</div></div></div>' +
        '<div class="form-group"><label class="form-label">연장 횟수 *</label>' +
        '<input type="number" class="form-control" id="extend-days" min="1" placeholder="추가할 횟수를 입력하세요" required></div>' +
        '<div class="form-group"><label class="form-label">예상 연장 금액</label>' +
        '<div class="form-control" style="background: var(--bg-tertiary); font-weight: 600; color: var(--accent-primary);" id="extend-calculated-price">-</div></div>' +
        '</form></div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" onclick="App.Modal.close(\'extend-product-modal\')">취소</button>' +
        '<button type="button" class="btn btn-primary" onclick="processExtendProduct()">연장</button>' +
        '</div></div></div>');
    bindMemberDetailTabs();
}

function bindMemberDetailTabs() {
    if (memberDetailTabsBound) return;
    var root = document.getElementById('member-detail-modal');
    if (!root) return;
    memberDetailTabsBound = true;
    root.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchTab(this.getAttribute('data-tab'));
        });
    });
}

if (document.body) {
    ensureMemberDetailModals();
} else {
    document.addEventListener('DOMContentLoaded', ensureMemberDetailModals);
}

document.addEventListener('DOMContentLoaded', async function() {
    if (App.currentUser && String(App.currentUser.role || '').toUpperCase() === 'COACH'
            && typeof App.syncOperationalCoachViewFromServer === 'function') {
        await App.syncOperationalCoachViewFromServer();
    }
    // 초기 로드: 통계 / 목록 / 상품 선택 병행. 목록만 먼저일 때 통계 재호출 생략(refreshStats: false).
    const statsEl = document.getElementById('members-stats-container');
    const tableEl = document.getElementById('members-table-body');
    var focusParam = null;
    try {
        var qs = new URLSearchParams(window.location.search);
        focusParam = qs.get('focusMember');
        if (focusParam) {
            try {
                sessionStorage.removeItem('afbs_members_focus_id');
            } catch (e2) { /* ignore */ }
        } else {
            focusParam = sessionStorage.getItem('afbs_members_focus_id');
            if (focusParam) {
                sessionStorage.removeItem('afbs_members_focus_id');
            }
        }
    } catch (e) {
        focusParam = null;
    }
    const initialLoads = [];
    if (statsEl) initialLoads.push(loadMemberStats());
    if (tableEl) {
        if (focusParam) {
            initialLoads.push(applyFocusMemberFromUrl(focusParam));
        } else {
            initialLoads.push(loadMembers(false, { refreshStats: false }));
        }
        initialLoads.push(loadProductsForSelect());
    }
    if (initialLoads.length) {
        Promise.all(initialLoads).catch(function(e) {
            App.err('\uCD08\uAE30 \uB85C\uB529 \uC911 \uC77C\uBD80 \uC2E4\uD328:', e);
        });
    }
    
    // 관리자만 전체 삭제 버튼 표시
    if (App.currentUser && App.currentUser.role === 'ADMIN') {
        const deleteAllBtn = document.getElementById('delete-all-members-btn');
        if (deleteAllBtn) {
            deleteAllBtn.style.display = 'inline-flex';
        }
    }

    const reassignBtn = document.getElementById('member-coach-reassign-submit-btn');
    if (reassignBtn) {
        reassignBtn.addEventListener('click', submitCoachReassignRequest);
    }
    const reassignMpSel = document.getElementById('member-coach-reassign-mp');
    if (reassignMpSel) {
        reassignMpSel.addEventListener('change', handleCoachReassignMpChange);
    }
    
    // 검색 입력
    const searchInput = document.getElementById('member-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    ensureMemberDetailModals();
    bindMemberDetailTabs();
    
    // 상품 선택 시 스타일·총액·담당 코치 UI 갱신
    const productSelect = document.getElementById('member-products');
    if (productSelect) {
        // 드래그로 다중 선택 방지(클릭·Ctrl+클릭은 유지)
        (function() {
            var dragSelect = false;
            var savedSelection = [];
            productSelect.addEventListener('mousedown', function() {
                dragSelect = false;
                savedSelection = Array.from(productSelect.selectedOptions).map(function(o) { return o.value; });
            }, true);
            productSelect.addEventListener('mousemove', function(e) {
                dragSelect = true;
                e.preventDefault();
            }, true);
            productSelect.addEventListener('mouseup', function(e) {
                if (dragSelect) {
                    e.preventDefault();
                    Array.from(productSelect.options).forEach(function(opt) {
                        opt.selected = savedSelection.indexOf(opt.value) !== -1;
                    });
                }
                dragSelect = false;
            }, true);
        })();
        // change 시 스타일·금액·코치 반영
        productSelect.addEventListener('change', function() {
            applySelectedProductStyles();
            updateTotalPrice();
            updateProductCoachSelection(); // 담당 코치 UI
            // DOM 갱신 후 한 번 더
            setTimeout(() => {
                applySelectedProductStyles();
                updateTotalPrice();
                updateProductCoachSelection();
            }, 100);
        });
    }
    
    // 조정 모드(절대/증감) 변경
    document.addEventListener('change', function(e) {
        if (e.target.name === 'adjust-mode') {
            const mode = e.target.value;
            const amountInput = document.getElementById('adjust-amount');
            const amountLabel = document.getElementById('adjust-amount-label');
            const amountHint = document.getElementById('adjust-amount-hint');
            
            if (mode === 'absolute') {
                amountLabel.textContent = '\uBAA9\uD45C \uD68C\uC218';
                amountInput.placeholder = '\uBAA9\uD45C \uD68C\uC218 \uC785\uB825 (\uC608: 10)';
                amountInput.value = '';
                amountHint.textContent = '\uC800\uC7A5 \uC2DC \uC774 \uD68C\uC218\uB85C \uB9DE\uCDA5\uB2C8\uB2E4 (0 \uD5C8\uC6A9)';
            } else {
                amountLabel.textContent = '\uC99D\uAC10';
                amountInput.placeholder = '+\uBA74 \uC99D\uAC00, -\uBA74 \uAC10\uC18C (\uC608: +5, -3)';
                amountInput.value = '';
                amountHint.textContent = '\uD604\uC7AC \uD68C\uC218\uC5D0 \uB354\uD558\uAC70\uB098 \uBBA8\uB2C5\uB2C8\uB2E4';
            }
        }
    });
    
    // URL 파라미터: 연장 모달 / 상세 모달
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get('id');
    const action = urlParams.get('action');
    const openMember = urlParams.get('openMember');
    
    if (memberId && action === 'extend') {
        // 로드 후 연장 모달
        setTimeout(() => {
            openExtendProductModal(parseInt(memberId));
            // URL에서 action 파라미터 제거
            window.history.replaceState({}, document.title, `/members.html?id=${memberId}`);
        }, 500);
    }
    // openMember= 로 대시보드 등에서 회원 상세 자동 열기
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


/** DB/API 등에서 온 상품명 정리: U+FFFD·선행 '?' 등 제거 후 표시용 */
function sanitizeProductDisplayName(name) {
    if (name == null || name === '') return '';
    return String(name)
        .replace(/\uFEFF/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/^[\s\u200B-\u200D\u2060]+/g, '')
        .replace(/^[\u2022\u2023\u25E6\u2043\u2024\u2025\u00B7]+(?:\s*)/g, '')
        .replace(/^\?+\s*(?=[\uAC00-\uD7A3])/u, '')
        .trim();
}

// 회원 등록·수정 폼: 상품 다중 선택 셀렉트 옵션 채우기
async function loadProductsForSelect() {
    try {
        const select = document.getElementById('member-products');
        if (!select) {
            App.warn('loadProductsForSelect: member-products \uC5F4\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
            return;
        }

        // 기존 선택값 유지용
        const selectedValues = Array.from(select.selectedOptions).map(opt => String(opt.value));

        // 옵션 전부 비우고 다시 구성
        while (select.options.length > 0) {
            select.remove(0);
        }

        const products = await App.api.get('/products');

        if (!products || !Array.isArray(products)) {
            App.warn('\uC0C1\uD488 \uBAA9\uB85D \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4:', products);
            return;
        }

        App.log('\uC0C1\uD488 \uAC1C\uC218:', products.length);

        if (products.length === 0) {
            // 등록된 상품 없음
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '\uB4F1\uB85D\uB41C \uC0C1\uD488\uC774 \uC5C6\uC2B5\uB2C8\uB2E4';
            option.disabled = true;
            select.appendChild(option);
        } else {
            products.forEach(product => {
                if (product && product.active !== false) { // 비활성 상품 제외
                    const option = document.createElement('option');
                    option.value = String(product.id);
                    const displayName = sanitizeProductDisplayName(product.name) || '\uC774\uB984 \uC5C6\uC74C';
                    const productText = `${displayName} (${getProductTypeText(product.type)}) - ${App.formatCurrency(product.price || 0)}`;
                    option.textContent = productText;
                    option.dataset.productName = displayName;
                    option.dataset.originalText = productText; // 스타일 복원용 원문
                    option.dataset.price = product.price || 0; // 총액 계산용

                    // 담당 코치 ID (상품에 연결된 경우)
                    if (product.coach && product.coach.id) {
                        option.dataset.coachId = String(product.coach.id);
                    } else if (product.coachId) {
                        option.dataset.coachId = String(product.coachId);
                    }

                    // 카테고리 (코치 매칭 등)
                    if (product.category) {
                        option.dataset.category = product.category;
                    }

                    // 이전에 선택돼 있던 항목이면 다시 선택
                    if (selectedValues.includes(String(product.id))) {
                        option.selected = true;
                    }

                    select.appendChild(option);
                }
            });
        }

        // 옵션 반영 후 스타일·금액 갱신
        setTimeout(() => {
            applySelectedProductStyles();
            updateTotalPrice();
        }, 100);
    } catch (error) {
        App.err('\uC0C1\uD488 \uBAA9\uB85D \uB85C\uB529 \uC624\uB958:', error);
        const select = document.getElementById('member-products');
        if (select) {
            // 오류 시 빈 셀렉트 + 안내 옵션
            while (select.options.length > 0) {
                select.remove(0);
            }
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '\uC0C1\uD488 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4';
            option.disabled = true;
            select.appendChild(option);
        }
    }
}

function getProductTypeText(type) {
    const map = {
        'SINGLE_USE': '\uD68C\uC6D0\uAD8C',
        'TIME_PASS': '\uAE30\uAC04\uAD8C',
        'COUNT_PASS': '\uD68C\uCC28\uAD8C',
        'MONTHLY_PASS': '\uC6D4\uC815\uC561',
        'DAY_PASS': '1\uC77C\uAD8C',
        'TEAM_PACKAGE': '\uD300 \uD328\uD0A4\uC9C0'
    };
    return map[type] || type;
}

// 목록 갱신 시 상단 통계(members-stats.js)는 선택적으로 다시 로드

/**
 * @param {boolean} append true면 다음 페이지를 이어붙임
 * @param {{ refreshStats?: boolean }} [options] refreshStats가 false면 통계만 생략(초기 로드 등)
 */
async function loadMembers(append, options) {
    const refreshStats = options && options.refreshStats === false ? false : true;
    try {
        const tbody = document.getElementById('members-table-body');
        if (!tbody) {
            App.warn('members-table-body \uC5F4\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
            return;
        }
        
        if (!append) {
            memberPageIndex = 0;
            accumulatedMembersList = [];
            memberPaginationInfo = null;
        }
        
        // 첫 로드 시에만 로딩 행 표시
        if (!append) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-muted);">\uB85C\uB529 \uC911...</td></tr>';
        }

        const coachesReady = (App.CoachColors && typeof App.CoachColors.ensureLoaded === 'function')
            ? App.CoachColors.ensureLoaded()
            : Promise.resolve();

        let members;
        // 검색어가 있으면 검색 API, 없으면 페이지 목록 API
        if (currentFilters.search) {
            const searchQuery = currentFilters.search;
            const statusQs = currentFilters.status ? '&status=' + encodeURIComponent(currentFilters.status) : '';
            if (searchQuery.toUpperCase().startsWith('M')) {
                members = await App.api.get(`/members/search?memberNumber=${encodeURIComponent(searchQuery)}${statusQs}`);
            } else if (/^\d+$/.test(searchQuery.replace(/[-\s]/g, ''))) {
                members = await App.api.get(`/members/search?phoneNumber=${encodeURIComponent(searchQuery)}${statusQs}`);
            } else {
                members = await App.api.get(`/members/search?name=${encodeURIComponent(searchQuery)}${statusQs}`);
            }
            if (currentFilters.grade) members = members.filter(m => m.grade === currentFilters.grade);
            if (currentFilters.status) members = members.filter(m => m.status === currentFilters.status);
            else members = (members || []).filter(m => m && m.status !== 'PENDING_APPROVAL');
            accumulatedMembersList = Array.isArray(members) ? members : [];
            memberPaginationInfo = null;
        } else {
            const params = new URLSearchParams({
                page: memberPageIndex,
                size: MEMBER_PAGE_SIZE,
                ...currentFilters
            });
            if (!params.get('status')) {
                params.set('status', 'ACTIVE');
            }
            const response = await App.api.get(`/members?${params}`);
            // 페이지 응답: { content, totalElements, totalPages, number }
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
                App.err('\uD68C\uC6D0 \uBAA9\uB85D API \uC751\uB2F5 \uD615\uC2DD \uC624\uB958:', response);
                tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">\uD68C\uC6D0 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. (\uC751\uB2F5 \uD615\uC2DD \uC624\uB958)</td></tr>';
                return;
            }
        }
        
        members = accumulatedMembersList;
        App.log('\uD68C\uC6D0 \uBAA9\uB85D \uAC74\uC218:', members.length);
        try { await coachesReady; } catch (e0) { /* 코치 색 프리로드 실패해도 목록은 표시 */ }
        renderMembersTable(members, !!memberPaginationInfo);
        if (typeof applyCoachNameColors === 'function') {
            applyCoachNameColors(document.getElementById('members-table-body'));
        }
        if (refreshStats) loadMemberStats();
    } catch (error) {
        App.err('\uD68C\uC6D0 \uBAA9\uB85D \uB85C\uB529 \uC624\uB958:', error);
        const tbody = document.getElementById('members-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">\uD68C\uC6D0 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB124\uD2B8\uC6CC\uD06C \uB610\uB294 \uAD8C\uD55C\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.</td></tr>';
        }
        App.showApiError(error);
    }
}

/** 등급·상태 필터는 검색과 함께 쓰이면 승인 직후 회원이 목록에서 빠질 수 있어 검색 전용으로 맞춤 */
function resetMemberTableFiltersForSearch(searchQuery) {
    currentFilters = {};
    if (searchQuery) {
        currentFilters.search = searchQuery;
    }
    var fg = document.getElementById('filter-grade');
    if (fg) {
        fg.value = '';
    }
}

/** URL ?focusMember= — 대시보드 승인 후 회원 관리로 올 때 검색·목록·상세 */
async function applyFocusMemberFromUrl(focusId) {
    const id = parseInt(String(focusId).trim(), 10);
    if (isNaN(id) || id <= 0) {
        await loadMembers(false, { refreshStats: false });
        return;
    }
    try {
        const m = await App.api.get('/members/' + id);
        const searchInput = document.getElementById('member-search');
        const q = (m.memberNumber && String(m.memberNumber).trim())
            ? String(m.memberNumber).trim()
            : (m.name || String(id));
        if (searchInput) {
            searchInput.value = q;
        }
        resetMemberTableFiltersForSearch(q);
        await loadMembers(false, { refreshStats: true });
        await openMemberDetail(id);
        if (currentMemberDetail && currentMemberDetail.id === id) {
            switchTab('products', currentMemberDetail);
            loadMemberProductsForDetail(id);
        }
        try {
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname + window.location.hash);
            }
        } catch (e1) { /* ignore */ }
        setTimeout(function() {
            var row = document.querySelector('tr[data-member-id="' + id + '"]');
            if (row) {
                row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 150);
    } catch (e) {
        App.warn('applyFocusMemberFromUrl', e);
        await loadMembers(false, { refreshStats: true });
    }
}

/** 같은 페이지에서 이용권 처리 후 해당 회원만 검색·상세 */
async function focusMemberRowInPage(memberId) {
    if (memberId == null || memberId === '') {
        return;
    }
    const id = typeof memberId === 'string' ? parseInt(memberId, 10) : memberId;
    if (isNaN(id) || id <= 0) {
        return;
    }
    try {
        const m = await App.api.get('/members/' + id);
        const searchInput = document.getElementById('member-search');
        const q = (m.memberNumber && String(m.memberNumber).trim())
            ? String(m.memberNumber).trim()
            : (m.name || String(id));
        if (searchInput) {
            searchInput.value = q;
        }
        resetMemberTableFiltersForSearch(q);
        await loadMembers(false, { refreshStats: true });
        await openMemberDetail(id);
        setTimeout(function() {
            var row = document.querySelector('tr[data-member-id="' + id + '"]');
            if (row) {
                row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 150);
    } catch (e) {
        App.warn('focusMemberRowInPage', e);
        loadMembers(false, { refreshStats: true });
    }
}

function renderMembersTable(members, showLoadMore) {
    try {
        const tbody = document.getElementById('members-table-body');
        const paginationContainer = document.getElementById('pagination-container');
        
        if (!tbody) {
            App.warn('members-table-body \uC5F4\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. members.html \uAD6C\uC870\uB97C \uD655\uC778\uD558\uC138\uC694.');
            return;
        }
        
        if (!Array.isArray(members)) {
            App.err('renderMembersTable: members\uAC00 \uBC30\uC5F4\uC774 \uC544\uB2D9\uB2C8\uB2E4:', members);
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">\uD45C\uC2DC\uD560 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
            return;
        }
        
        if (!members || members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-muted);">\uB4F1\uB85D\uB41C \uD68C\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        
        var totalDisplay = memberPaginationInfo ? memberPaginationInfo.totalElements : members.length;
        var hasMore = showLoadMore && memberPaginationInfo && (memberPageIndex + 1) < memberPaginationInfo.totalPages;
        if (paginationContainer) {
            paginationContainer.innerHTML = `
            <div style="text-align: center; padding: 16px; font-weight: 600; color: var(--text-primary);">
                \uCD1D <span style="color: var(--accent-primary); font-size: 18px;">${totalDisplay}</span>\uBA85 \uC911 <span style="color: var(--text-secondary);">${members.length}\uBA85</span> \uD45C\uC2DC
            </div>
            ${hasMore ? '<div style="text-align: center; margin-bottom: 16px;"><button type="button" class="btn btn-secondary" id="members-load-more-btn">\uB354 \uBCF4\uAE30</button></div>' : ''}
        `;
            var loadMoreBtn = document.getElementById('members-load-more-btn');
            if (loadMoreBtn) loadMoreBtn.onclick = function() { memberPageIndex++; loadMembers(true); };
        }
        
        tbody.innerHTML = members.map(member => {
        const isExpiring = checkMemberExpiring(member);
        const hasExpired = checkMemberHasExpired(member);
        const expiredBadge = hasExpired ? '<span class="badge badge-expired" style="margin-left: 4px; font-size: 11px;">\uB9C8\uAC10</span>' : '';
        const expiringBadge =
            !hasExpired && isExpiring
                ? '<span class="badge badge-expiring" style="margin-left: 4px; font-size: 11px;">\uB9CC\uB8CC \uC784\uBC15</span>'
                : '';
        const badgesHtml = [expiredBadge, expiringBadge].filter(Boolean).join(' ');
        
        let rowStyle = '';
        if (hasExpired) {
            rowStyle = 'background-color: rgba(220, 38, 38, 0.06); border-left: 3px solid var(--danger, #DC2626);';
        }
        
        return `
        <tr data-member-id="${member.id}" ${rowStyle ? 'style="' + rowStyle + '"' : ''}>
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
            <td>${renderCoachNamesWithColors(member)}</td>
            <td>${renderMemberProducts(member)}</td>
            <td><span class="badge badge-${getStatusBadge(member.status)}">${getStatusText(member.status)}</span></td>
            <td>${member.latestLessonDate ? App.formatDate(member.latestLessonDate) : '-'}</td>
            <td>${App.formatCurrency(member.totalPayment || 0)}</td>
            <td>
                <div class="members-row-actions">
                    <button class="btn btn-sm btn-primary" onclick="openExtendProductModal(${member.id})" title="\uC774\uC6A9\uAD8C \uCD94\uAC00 \uB610\uB294 \uC5F0\uC7A5">\uC774\uC6A9\uAD8C \uCD94\uAC00/\uC5F0\uC7A5</button>
                    <button class="btn btn-sm btn-secondary" onclick="editMember(${member.id})">\uC218\uC815</button>
                    ${member.status === 'INACTIVE'
                        ? `<button class="btn btn-sm btn-success" onclick="toggleMemberDormantStatus(${member.id}, 'INACTIVE')" title="\uD65C\uC131 \uCC98\uB9AC">\uD65C\uC131</button>`
                        : `<button class="btn btn-sm btn-warning" onclick="toggleMemberDormantStatus(${member.id}, '${member.status || 'ACTIVE'}')" title="\uD734\uBA74 \uCC98\uB9AC">\uD734\uBA74</button>`}
                    ${App.currentUser && App.currentUser.role === 'ADMIN' ? `<button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id})">\uC0AD\uC81C</button>` : ''}
                </div>
            </td>
        </tr>
    `;
    }).join('');
    } catch (error) {
        App.err('renderMembersTable \uC624\uB958:', error);
        const tbody = document.getElementById('members-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--danger);">\uD45C\uB97C \uB9C8\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C\uACE0\uCE68 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.</td></tr>';
        }
    }
}

// 등급 표시 문구: common.js App.MemberGrade
function getGradeText(grade) {
    return App.MemberGrade.getText(grade);
}

function getGradeBadge(grade) {
    switch(grade) {
        case 'ELITE_ELEMENTARY':
            return 'elite-elementary';  // 엘리트 초등
        case 'ELITE_MIDDLE':
            return 'elite-middle';      // 엘리트 중등
        case 'ELITE_HIGH':
            return 'elite-high';        // 엘리트 고등
        case 'SOCIAL':
            return 'secondary';         // 사회인
        case 'YOUTH':
            return 'youth';             // 유소년
        case 'OTHER':
            return 'other';             // 기타
        default:
            return 'info';              // 미분류
    }
}

// 상태 뱃지: common.js App.Status.member
function getStatusBadge(status) {
    return App.Status.member.getBadge(status);
}

function getStatusText(status) {
    return App.Status.member.getText(status);
}

function getRemainingCountColor(count) {
    const n = count !== null && count !== undefined ? Number(count) : NaN;
    if (n === 0) {
        return '#dc3545'; // 소진
    }
    if (n >= 1 && n <= 2) {
        return '#dc3545'; // 잔여 1~2회: 위험(빨강)
    } else if (n >= 3 && n <= 5) {
        return '#fd7e14'; // 잔여 3~5회: 주의(주황)
    } else {
        return '#28a745'; // 잔여 6회 이상: 여유(초록)
    }
}

/**
 * 회원 목록 표 등: 상세 「이용권」 탭과 동일하게 중복·소진 행을 정리한 목록.
 * (DB에 ACTIVE로 남은 잔여 0 행이 같이 오면 한 줄로 합침)
 */
function getMemberProductsForTableDisplay(member) {
    if (!member || !Array.isArray(member.memberProducts) || member.memberProducts.length === 0) {
        return [];
    }
    if (typeof App.filterMemberProductsForDisplayList === 'function') {
        return App.filterMemberProductsForDisplayList(member.memberProducts.slice(), { applyEndedGraceFilter: true });
    }
    return member.memberProducts.slice();
}

/**
 * 횟수권: DB는 ACTIVE인데 화면 잔여가 0이면 목록·배지에서 소진(마감)과 동일하게 취급.
 */
function isCountPassExhaustedForMemberTable(mp) {
    if (!mp || !mp.product || mp.product.type !== 'COUNT_PASS') {
        return false;
    }
    const st = mp.status && String(mp.status).toUpperCase();
    if (st !== 'ACTIVE') {
        return false;
    }
    if (typeof App.resolveDisplayRemainingCount !== 'function') {
        const rc = mp.remainingCount;
        return rc !== null && rc !== undefined && Number(rc) === 0;
    }
    return App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'zero' }) === 0;
}

function renderMemberProductsRemaining(member) {
    let html = '';
    
    const tableMps = getMemberProductsForTableDisplay(member);
    if (tableMps.length > 0) {
        const countPassProducts = tableMps.filter(mp =>
            mp.product && mp.product.type === 'COUNT_PASS' &&
            mp.status === 'ACTIVE' &&
            !isCountPassExhaustedForMemberTable(mp)
        );
        
        if (countPassProducts.length > 0) {
            const productLines = countPassProducts.map(mp => {
                const productName = mp.product.name || '\uC0C1\uD488\uBA85 \uC5C6\uC74C';
                
                let remaining = App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'ten' });

                const color = getRemainingCountColor(remaining);
                const weight = remaining <= 3 ? '700' : '600';
                return `<span style="color: ${color}; font-weight: ${weight};">${productName}: ${remaining}\uD68C</span>`;
            }).join('<br>');
            
            html += `<br><small>${productLines}</small>`;
        }
    }
    
    if (member.periodPassEndDate) {
        html += `<br><small style="color: var(--accent-success);">${formatPeriodPass(member.periodPassStartDate, member.periodPassEndDate)}</small>`;
    }
    
    return html;
}

/** 야구/필라테스 등 카테고리 순으로 정렬된 활성 이용권 (목록 담당 코치 열과 동일 순서) */
function getSortedActiveProductsForMember(member) {
    const tableMps = getMemberProductsForTableDisplay(member);
    if (tableMps.length === 0) return [];
    let list = tableMps.filter(mp => mp && mp.status === 'ACTIVE' && !isCountPassExhaustedForMemberTable(mp));
    const getCategoryPriority = (category, productName) => {
        const nameLower = (productName || '').toLowerCase();
        if (category === 'BASEBALL' || nameLower.includes('\uC57C\uAD6C') || nameLower.includes('baseball')) return 1;
        if (category === 'TRAINING' || category === 'TRAINING_FITNESS' || nameLower.includes('\uD2B8\uB808\uC774\uB2DD') || nameLower.includes('training')) return 2;
        if (category === 'PILATES' || nameLower.includes('\uD544\uB77C\uD14C\uC2A4') || nameLower.includes('pilates')) return 3;
        return 4;
    };
    list.sort((a, b) => {
        const categoryA = (a.product && a.product.category) || '';
        const categoryB = (b.product && b.product.category) || '';
        const nameA = (a.product && a.product.name) || '';
        const nameB = (b.product && b.product.name) || '';
        const pa = getCategoryPriority(categoryA, nameA);
        const pb = getCategoryPriority(categoryB, nameB);
        if (pa !== pb) return pa - pb;
        return nameA.localeCompare(nameB);
    });
    return list;
}

function formatUnspecifiedCoachHtml() {
    return '<span style="color: var(--text-muted);">미지정</span>';
}

function isWorkingCoachRecord(coach) {
    if (!coach || typeof coach !== 'object') {
        return false;
    }
    return coach.active !== false;
}

/** 회원 상품에서 표시할 코치 이름 추출. 퇴사(active=false) 코치는 제외 → 미지정 */
function getCoachNameForMemberProduct(mp, member) {
    if (!mp) return null;
    if (mp.coach && typeof mp.coach === 'object' && mp.coach.active === false) {
        return null;
    }
    // 직접 배정된 코치가 있으나 근무 중이 아니면(이름 숨김) 상품 기본 코치로 대체하지 않음
    if (mp.coachId && !mp.coachName && !(mp.coach && mp.coach.name)) {
        return null;
    }
    const product = mp.product || {};
    let name = mp.coachName
        || (isWorkingCoachRecord(mp.coach) && (mp.coach.name || mp.coach))
        || (isWorkingCoachRecord(product.coach) && (product.coach.name || product.coach));
    if (name) return String(name).trim();
    return null;
}

/** 활성 상품 순서대로 코치 HTML (상품당 한 줄). 근무 중 코치가 없으면 미지정 */
function getMemberCoachDisplayInProductOrder(member) {
    const sorted = getSortedActiveProductsForMember(member);
    if (sorted.length === 0) return null;
    const names = sorted.map(mp => getCoachNameForMemberProduct(mp, member));
    if (names.every(name => !name)) {
        return formatUnspecifiedCoachHtml();
    }
    return names.map(coachName =>
        coachName ? renderCoachNamesWithColorsFromText(coachName) : formatUnspecifiedCoachHtml()
    ).join('<br>');
}

function renderCoachNamesWithColors(member) {
    const byProductOrder = getMemberCoachDisplayInProductOrder(member);
    if (byProductOrder) return byProductOrder;

    const coachNames = member.coachNames || member.coach?.name || '';
    if (!coachNames || !String(coachNames).trim()) {
        return formatUnspecifiedCoachHtml();
    }
    return renderCoachNamesWithColorsFromText(coachNames);
}

function normalizeCoachNameForColor(rawName) {
    if (!rawName) return '';
    let normalized = String(rawName).replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    normalized = normalized.replace(/\s*[\[\(].*?[\]\)]\s*$/, '').trim();
    normalized = normalized.replace(/(\[[^\]]*\]|\([^)]*\))/g, '').replace(/\s+/g, ' ').trim();
    return normalized;
}

function splitCoachDisplayNames(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw) return [];
    const chunks = raw.split(/\s*[\n;|]+\s*/).map(s => s.trim()).filter(Boolean);
    const result = [];
    chunks.forEach(function(chunk) {
        var buf = '';
        var depth = 0;
        for (var i = 0; i < chunk.length; i++) {
            var ch = chunk[i];
            if (ch === '[' || ch === '(') depth++;
            else if ((ch === ']' || ch === ')') && depth > 0) depth--;
            if (ch === ',' && depth === 0) {
                if (buf.trim()) result.push(buf.trim());
                buf = '';
            } else {
                buf += ch;
            }
        }
        if (buf.trim()) result.push(buf.trim());
    });
    return result;
}

function renderCoachNamesWithColorsFromText(rawText) {
    if (!rawText) return '-';
    const text = String(rawText).trim();
    if (!text) return '-';
    const nameParts = splitCoachDisplayNames(text);
    if (nameParts.length === 0) return '-';
    const rendered = nameParts.map(part => {
        const trimmed = part.trim();
        if (!trimmed) return '';
        let coachColor = 'var(--text-primary)';
        if (window.App && App.CoachColors && typeof App.CoachColors.getColor === 'function') {
            // 코치/레슨 관리와 동일: 전체 이름(직함 포함)으로 DB 고유색 조회
            coachColor = App.CoachColors.getColor({ name: trimmed }) || 'var(--text-primary)';
        }
        const dataName = App.escapeHtml(trimmed);
        return `<span class="coach-name" data-coach-name="${dataName}" style="--coach-color: ${coachColor}; color: ${coachColor}; font-weight: 600;">${App.escapeHtml(trimmed)}</span>`;
    }).filter(item => item).join('<br>');
    return rendered || formatUnspecifiedCoachHtml();
}

function getMemberCoachDisplayFromProducts(member) {
    if (!member) return formatUnspecifiedCoachHtml();
    const memberProducts = getMemberProductsForTableDisplay(member);
    const getCategoryKey = (mp) => {
        const product = mp?.product || {};
        const category = String(product.category || '').toUpperCase();
        const nameLower = String(product.name || '').toLowerCase();
        if (category === 'BASEBALL' || nameLower.includes('\uC57C\uAD6C') || nameLower.includes('baseball')) {
            return 'BASEBALL';
        }
        if (category === 'PILATES' || nameLower.includes('\uD544\uB77C\uD14C\uC2A4') || nameLower.includes('pilates')) {
            return 'PILATES';
        }
        if (category === 'TRAINING' || category === 'TRAINING_FITNESS' || nameLower.includes('\uD2B8\uB808\uC774\uB2DD') || nameLower.includes('training')) {
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
            const coachName = getCoachNameForMemberProduct(mp, member);
            if (!coachName) return;
            const categoryKey = getCategoryKey(mp);
            map[categoryKey].add(String(coachName).trim());
        });
        return map;
    };
    let categoryMap = null;
    if (memberProducts.length > 0) {
        // 담당 코치 열: ACTIVE면 잔여 0 횟수권도 담당에 포함(박시후처럼 DB·운영필터와 표시 정합). 잔여/소진 구분은 상품·잔여 열·배지에서 처리.
        const activeProducts = memberProducts.filter(mp => {
            if (!mp) return false;
            const st = mp.status && String(mp.status).toUpperCase();
            return !st || st === 'ACTIVE';
        });
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
        const representativeNames = orderedNames.filter(name => /\[[^\]]*\]|\([^)]*\)/.test(name));
        const otherNames = orderedNames.filter(name => !/\[[^\]]*\]|\([^)]*\)/.test(name));
        const finalOrdered = [...representativeNames, ...otherNames];
        if (orderedNames.length > 0) {
            return renderCoachNamesWithColorsFromText(finalOrdered.join('\n'));
        }
    }
    const fallback = member.coachNames || member.coach?.name || '';
    return fallback ? renderCoachNamesWithColorsFromText(fallback) : formatUnspecifiedCoachHtml();
}

function checkMemberExpiring(member) {
    if (!member || !member.memberProducts || member.memberProducts.length === 0) {
        return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryThreshold = new Date(today);
    expiryThreshold.setDate(expiryThreshold.getDate() + 3); // 오늘부터 3일 이내 만료면 '만료 임박'
    
    const activeProducts = getMemberProductsForTableDisplay(member).filter(mp =>
        mp && mp.status === 'ACTIVE' && !isCountPassExhaustedForMemberTable(mp)
    );

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
            
            // 횟수권: 잔여 1~3회면 임박(표시용 잔여는 resolveDisplayRemainingCount)
            if (productType === 'COUNT_PASS') {
                const remainingCount = App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'null' });
                if (remainingCount !== null && remainingCount !== undefined &&
                    remainingCount <= 2 && remainingCount > 0) {
                    return true;
                }
            }
            
            // 월정액: 만료일이 오늘~3일 이내면 임박
            if ((productType === 'MONTHLY_PASS' || productType === 'DAY_PASS') && mp.expiryDate) {
                let expiryDate;
                if (typeof mp.expiryDate === 'string') {
                    expiryDate = new Date(mp.expiryDate);
                } else {
                    expiryDate = new Date(mp.expiryDate);
                }
                
                if (isNaN(expiryDate.getTime())) {
                    continue;
                }
                
                expiryDate.setHours(0, 0, 0, 0);

                if (expiryDate >= today && expiryDate <= expiryThreshold) {
                    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                    return true;
                }
            }
        } catch (e) {
            continue;
        }
    }
    
    return false;
}

/** 연장·추가구매로 잔여 횟수·유효 기간이 살아 있는 ACTIVE 이용권이 있으면 종료/마감 표시 안 함 */
function memberHasUsableActivePass(member) {
    if (!member || !member.memberProducts || member.memberProducts.length === 0) {
        return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < member.memberProducts.length; i++) {
        const mp = member.memberProducts[i];
        if (!mp || String(mp.status || '').toUpperCase() !== 'ACTIVE') {
            continue;
        }
        const product = mp.product || {};
        const pt = product.type;
        if (pt === 'COUNT_PASS') {
            const rem = typeof App.resolveDisplayRemainingCount === 'function'
                ? App.resolveDisplayRemainingCount(mp, { whenAllUnknown: 'zero' })
                : (mp.remainingCount != null ? Number(mp.remainingCount) : 0);
            if (rem > 0) {
                return true;
            }
        } else if (pt === 'MONTHLY_PASS' || pt === 'DAY_PASS' || pt === 'TIME_PASS') {
            if (!mp.expiryDate) {
                return true;
            }
            const ex = new Date(mp.expiryDate);
            if (isNaN(ex.getTime())) {
                continue;
            }
            ex.setHours(0, 0, 0, 0);
            if (ex >= today) {
                return true;
            }
        } else {
            return true;
        }
    }
    return false;
}

// '마감' 배지: 종료된 이용권이 있고, 가장 늦은 종료 시각 기준 3일 이내일 때만 (상세·목록 이용권 노출과 동일)
function checkMemberHasExpired(member) {
    if (memberHasUsableActivePass(member)) {
        return false;
    }
    if (!member || !member.memberProducts || member.memberProducts.length === 0) {
        return false;
    }
    var list = member.memberProducts;
    var ended = list.filter(function(mp) {
        var s = (mp && mp.status) ? String(mp.status).toUpperCase() : '';
        if (s === 'USED_UP' || s === 'EXPIRED') {
            return true;
        }
        return typeof App.isActiveCountPassExhaustedForGrace === 'function' && App.isActiveCountPassExhaustedForGrace(mp);
    });
    if (ended.length === 0) {
        return false;
    }
    var latestEndedAt = null;
    for (var i = 0; i < ended.length; i++) {
        var d = typeof App.resolveMemberProductEndedAtForGrace === 'function'
            ? App.resolveMemberProductEndedAtForGrace(ended[i])
            : null;
        if (d && !isNaN(d.getTime()) && (!latestEndedAt || d > latestEndedAt)) {
            latestEndedAt = d;
        }
    }
    if (!latestEndedAt) {
        return false;
    }
    var threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    return (Date.now() - latestEndedAt.getTime()) <= threeDaysMs;
}

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
        return '#DC3545'; // 이미 만료
    } else if (daysUntilExpiry <= 2) {
        return '#DC3545'; // 만료 임박(2일 이내)
    } else if (daysUntilExpiry <= 5) {
        return '#FD7E14'; // 임박(3~5일)
    } else if (daysUntilExpiry <= 7) {
        return '#F59E0B'; // 주의(6~7일)
    } else {
        return 'var(--accent-primary)'; // 여유(7일 초과)
    }
}

// 회원 목록 테이블「상품/이용권」열 HTML — 활성 + 상세와 동일하게 노출 중인 종료(소진/만료, 3일 유예) 이용권
function renderMemberProducts(member) {
    const sourceProducts = getMemberProductsForTableDisplay(member);
    if (!sourceProducts || sourceProducts.length === 0) {
        App.log('\uC774\uC6A9\uAD8C \uC5C6\uC74C:', {
            memberId: member.id,
            memberNumber: member.memberNumber,
            memberName: member.name,
            memberProducts: member.memberProducts
        });
        return '<span style="color: var(--text-muted);">-</span>';
    }
    
    const activeProducts = sourceProducts.filter(mp =>
        mp && mp.status === 'ACTIVE' && !isCountPassExhaustedForMemberTable(mp)
    );
    let endedProducts = sourceProducts.filter(mp => {
        if (!mp || !mp.status) return false;
        const s = String(mp.status).toUpperCase();
        if (s === 'USED_UP' || s === 'EXPIRED') return true;
        return isCountPassExhaustedForMemberTable(mp);
    });
    // 다른 상품(야구 vs 트레이닝 등)은 displayKey가 달라 common.js 중복 제거에 안 걸림.
    // 잔여·기간이 남은 이용권이 하나라도 있으면 횟수권「전부 소진」줄만 목록에서 생략(상세 탭은 그대로).
    if (memberHasUsableActivePass(member)) {
        endedProducts = endedProducts.filter(mp => {
            const pt = mp && mp.product && mp.product.type;
            return pt !== 'COUNT_PASS';
        });
    }

    if (activeProducts.length === 0 && endedProducts.length === 0) {
        App.warn('\uD45C\uC2DC\uD560 \uC774\uC6A9\uAD8C \uC5C6\uC74C:', {
            memberId: member.id,
            memberNumber: member.memberNumber,
            memberName: member.name,
            totalProducts: member.memberProducts.length,
            allStatuses: member.memberProducts.map(mp => mp.status)
        });
        return '<span style="color: var(--text-muted);">-</span>';
    }

    const rowsToShow = activeProducts.concat(endedProducts);
    rowsToShow.forEach((mp, index) => {
        if (!mp.product || !mp.product.name) {
            App.warn(`\uC774\uC6A9\uAD8C ${index + 1} - \uC0C1\uD488 \uC774\uB984 \uC5C6\uC74C:`, {
                memberId: member.id,
                memberName: member.name,
                memberProduct: mp
            });
        }
    });
    
    // 표시 순서: 야구 > 트레이닝 > 필라테스 > 기타, 같은 그룹은 상품명
    rowsToShow.sort((a, b) => {
        const categoryA = (a.product && a.product.category) || '';
        const categoryB = (b.product && b.product.category) || '';
        const nameA = (a.product && a.product.name) || '';
        const nameB = (b.product && b.product.name) || '';
        
        const getCategoryPriority = (category, productName) => {
            const nameLower = (productName || '').toLowerCase();
            if (category === 'BASEBALL' || nameLower.includes('\uC57C\uAD6C') || nameLower.includes('baseball')) {
                return 1;
            } else if (category === 'TRAINING' || category === 'TRAINING_FITNESS' ||
                      nameLower.includes('\uD2B8\uB808\uC774\uB2DD') || nameLower.includes('training')) {
                return 2;
            } else if (category === 'PILATES' || nameLower.includes('\uD544\uB77C\uD14C\uC2A4') || nameLower.includes('pilates')) {
                return 3;
            }
            return 4;
        };
        
        const priorityA = getCategoryPriority(categoryA, nameA);
        const priorityB = getCategoryPriority(categoryB, nameB);
        
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        return nameA.localeCompare(nameB);
    });
    
    const productLines = rowsToShow.map(mp => {
        if (!mp.product) {
            App.warn('\uC0C1\uD488 \uC5C6\uB294 MemberProduct:', {
                memberId: member.id,
                memberName: member.name,
                memberProductId: mp.id,
                status: mp.status,
                remainingCount: mp.remainingCount,
                totalCount: mp.totalCount
            });
            const productName = App.escapeHtml(`\uC0C1\uD488 ID: ${mp.id || '-'}`);
            const displayText = `<span style="color: #ff9800; font-weight: 600;">${productName}</span> <span style="color: var(--text-muted); font-size: 11px;">(\uC0C1\uD488 \uC815\uBCF4 \uC5C6\uC74C)</span>`;
            return displayText;
        }

        const st = mp.status && String(mp.status).toUpperCase();
        const product = mp.product;
        const productName = App.escapeHtml(product.name || `\uC0C1\uD488 ID: ${product.id || '-'}`);
        const productNameColor = '#4CAF50';

        if (st === 'USED_UP' || st === 'EXPIRED' || isCountPassExhaustedForMemberTable(mp)) {
            const productType = product.type || '';
            if (productType === 'COUNT_PASS') {
                const line =
                    st === 'EXPIRED'
                        ? '<span style="color: #dc3545; font-weight: 700;">\uB9CC\uB8CC</span>'
                        : '<span style="color: #dc3545; font-weight: 700;">\uC804\uBD80 \uC18C\uC9C4</span>';
                return `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : ${line}`;
            }
            if (productType === 'MONTHLY_PASS' || productType === 'DAY_PASS' || productType === 'TIME_PASS') {
                let expiryDate = null;
                if (mp.expiryDate) {
                    expiryDate = mp.expiryDate;
                } else if (mp.purchaseDate) {
                    let purchaseDate = typeof mp.purchaseDate === 'string'
                        ? (mp.purchaseDate.includes('T') ? mp.purchaseDate.split('T')[0] : mp.purchaseDate)
                        : mp.purchaseDate;
                    if (purchaseDate) {
                        const purchase = new Date(purchaseDate);
                        const expiry = new Date(purchase);
                        const validDays = (product.validDays && product.validDays > 0) ? product.validDays : 30;
                        expiry.setDate(expiry.getDate() + validDays);
                        expiryDate = expiry;
                    }
                }
                if (expiryDate) {
                    const endDateStr = App.formatDate(expiryDate);
                    return `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : <span style="color: #dc3545; font-weight: 600;">~ ${App.escapeHtml(endDateStr)} (\uAE30\uAC04 \uC885\uB8CC)</span>`;
                }
                return `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : <span style="color: #dc3545; font-weight: 600;">\uAE30\uAC04 \uC885\uB8CC</span>`;
            }
            return `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : <span style="color: #dc3545; font-weight: 600;">${st === 'EXPIRED' ? '\uB9CC\uB8CC' : '\uC804\uBD80 \uC18C\uC9C4'}</span>`;
        }
        
        const productType = product.type || '';

        // 월정액·기간권: 기간 표시(만료일 없으면 구매일+validDays, 기본 30일)
        if (productType === 'MONTHLY_PASS' || productType === 'DAY_PASS' || productType === 'TIME_PASS') {
            let expiryDate = null;

            if (mp.expiryDate) {
                expiryDate = mp.expiryDate;
            } else if (mp.purchaseDate) {
                let purchaseDate = null;
                if (typeof mp.purchaseDate === 'string') {
                    purchaseDate = mp.purchaseDate.includes('T') ? mp.purchaseDate.split('T')[0] : mp.purchaseDate;
                } else {
                    purchaseDate = mp.purchaseDate;
                }

                if (purchaseDate) {
                    const purchase = new Date(purchaseDate);
                    const expiry = new Date(purchase);
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
                periodColor = getExpiryDateColor(expiryDate);
            } else {
                periodText = '\uAE30\uAC04 \uBBF8\uC124\uC815';
            }
            
            const displayText = `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : <span style="color: ${periodColor}; font-weight: 600;">${App.escapeHtml(periodText)}</span>`;
            return displayText;
        }
        
        // 횟수권: 잔여 회차 표시
        let remaining = mp.remainingCount;
        const mpStatus = mp.status || 'ACTIVE';

        if (mpStatus === 'USED_UP') {
            remaining = 0;
        } else if (remaining === null || remaining === undefined) {
            remaining = product.usageCount;
            if (remaining === null || remaining === undefined) {
                remaining = mp.totalCount;
            }

            if (remaining === null || remaining === undefined) {
                App.warn('\uD68C\uCC28\uAD8C \uC794\uC5EC \uACC4\uC0B0 \uBD88\uAC00 - \uC0C1\uD488 usageCount\uB97C \uD655\uC778\uD558\uC138\uC694:', {
                    memberId: member.id,
                    memberName: member.name,
                    memberProductId: mp.id,
                    productId: product.id,
                    productName: product.name,
                    remainingCount: mp.remainingCount,
                    totalCount: mp.totalCount,
                    usageCount: product.usageCount
                });
                remaining = null;
            }
        }

        let assignedCoachName = mp.coachName || null;

        if (!assignedCoachName && member.coachNames) {
            const coachNamesList = member.coachNames.split('\n').filter(name => name.trim());
            const productCategory = product.category || '';
            const productNameLower = productName.toLowerCase();
            
            if (productCategory === 'BASEBALL' || productNameLower.includes('\uC57C\uAD6C') || productNameLower.includes('baseball')) {
                assignedCoachName = coachNamesList.find(name =>
                    name.includes('\uD22C\uC218') || name.includes('\uD3EC\uC218') || name.includes('\uC57C\uAD6C')
                ) || coachNamesList[0];
            } else if (productCategory === 'PILATES' || productNameLower.includes('\uD544\uB77C\uD14C\uC2A4') || productNameLower.includes('pilates')) {
                assignedCoachName = coachNamesList.find(name =>
                    name.includes('\uD544\uB77C\uD14C\uC2A4') || name.includes('\uAC15\uC0AC')
                ) || coachNamesList[0];
            } else if (productCategory === 'TRAINING' || productNameLower.includes('\uD2B8\uB808\uC774\uB2DD') || productNameLower.includes('training')) {
                assignedCoachName = coachNamesList.find(name =>
                    name.includes('\uD2B8\uB808\uC774\uB108') || name.includes('\uD2B8\uB808\uC774\uB2DD')
                ) || coachNamesList[0];
            } else if (coachNamesList.length > 0) {
                assignedCoachName = coachNamesList[0];
            }
        }
        
        let remainingDisplay = '';
        if (remaining === null || remaining === undefined) {
            remainingDisplay = '<span style="color: #ff9800; font-weight: 600;">\uD69F\uC218 \uBBF8\uD655\uC778</span>';
        } else if (
            productType === 'COUNT_PASS' &&
            mpStatus !== 'EXPIRED' &&
            Number(remaining) === 0
        ) {
            remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">\uC804\uBD80 \uC18C\uC9C4</span>';
        } else {
            const remainingColor = getRemainingCountColor(remaining);
            const weight = remaining <= 3 ? '700' : '600';
            remainingDisplay = `<span style="color: ${remainingColor}; font-weight: ${weight};">${remaining}\uD68C</span>`;
        }
        const displayText = `<span style="color: ${productNameColor}; font-weight: 600;">${productName}</span> : ${remainingDisplay}`;
        
        return displayText;
    }).filter(line => line !== null).join('<br>');

    if (productLines.length === 0) {
        return '<span style="color: var(--text-muted);">-</span>';
    }
    
    return `<div class="members-table-stack">${productLines}</div>`;
}

function handleSearch(e) {
    const query = e.target.value;
    if (query) {
        currentFilters.search = query;
        delete currentFilters.status;
    } else {
        delete currentFilters.search;
    }
    memberListPage = 1;
    loadMembers();
}

function applyFilters() {
    const gradeEl = document.getElementById('filter-grade');
    const grade = gradeEl ? gradeEl.value : '';
    const searchKeep = currentFilters.search;
    currentFilters = {};
    if (grade) currentFilters.grade = grade;
    if (searchKeep) currentFilters.search = searchKeep;
    memberListPage = 1;
    loadMembers();
}

function openMemberModal(id = null) {
    const totalPriceElement = document.getElementById('member-total-price');
    if (totalPriceElement) {
        totalPriceElement.textContent = '\u20A90';
    }
    
    const coachSelectionContainer = document.getElementById('product-coach-selection');
    if (coachSelectionContainer) {
        coachSelectionContainer.innerHTML = '';
    }
    
    const modal = document.getElementById('member-modal');
    const title = document.getElementById('member-modal-title');
    const form = document.getElementById('member-form');
    
    if (id) {
        title.textContent = '\uD68C\uC6D0 \uC218\uC815';
        loadMemberData(id);
    } else {
        title.textContent = '\uD68C\uC6D0 \uB4F1\uB85D';
        currentEditingMember = null;
        form.reset();
        document.getElementById('member-id').value = '';
        document.getElementById('member-number').value = '';
        document.getElementById('member-name').value = '';
        document.getElementById('member-phone').value = '';
        document.getElementById('member-birth').value = '';
        document.getElementById('member-gender').value = 'MALE';
        document.getElementById('member-height').value = '';
        document.getElementById('member-weight').value = '';
        document.getElementById('member-grade').value = 'SOCIAL';
        document.getElementById('member-status').value = 'ACTIVE';
        document.getElementById('member-address').value = '';
        document.getElementById('member-school').value = '';
        document.getElementById('member-pitching-speed').value = '';
        document.getElementById('member-swing-speed').value = '';
        document.getElementById('member-exit-velocity').value = '';
        document.getElementById('member-join-date').value = '';
        document.getElementById('member-created-at').value = '';
        document.getElementById('member-guardian-name').value = '';
        document.getElementById('member-guardian-phone').value = '';
        document.getElementById('member-memo').value = '';
        document.getElementById('member-coach-memo').value = '';
        // 상품 선택 초기화
        const productSelect = document.getElementById('member-products');
        if (productSelect) {
            Array.from(productSelect.options).forEach(opt => { opt.selected = false; });
        }
        // 투/타/수비 등 0~7 미선택 시 0 (신규 회원)
        setRadioStage('member-pitcher-control', 0, true, true);
        setRadioStage('member-pitcher-breaking-ball', 0, true, true);
        setRadioStage('member-defense-handling', 0, false, true);
        setRadioStage('member-defense-step', 0, false, true);
        setRadioStage('member-defense-throwing', 0, false, true);
        setRadioStage('member-defense-quickness', 0, false, true);
        setRadioStage('member-catcher-blocking', 0, false, true);
        setRadioStage('member-catcher-throwing', 0, false, true);
        setRadioStage('member-catcher-framing', 0, false, true);
        setRadioStage('member-batter-power', 0, false, true);
        setRadioStage('member-running-speed', 0, false, true);
        setRadioStage('member-flexibility', 0, true, true);
        App.log('회원 모달 초기화 - 능력치 단계 0');
        const crs = document.getElementById('member-coach-reassign-section');
        if (crs) {
            crs.style.display = 'none';
        }
    }
    
    App.Modal.open('member-modal');
    
    // 편집 시 스타일·코치 UI 동기화
    if (id) {
        setTimeout(() => {
            applySelectedProductStyles();
            updateProductCoachSelection();
        }, 800);
    }
}

/** 0~7 단계 라디오 (name=그룹, HIGH/MID/LOW 또는 숫자). allowZero면 빈 값일 때 0 */
function setRadioStage(radioName, value, isStringLevel, allowZero) {
    var radios = document.querySelectorAll('input[name="' + radioName + '"]');
    if (!radios.length) return;
    var s = '';
    if (value != null && value !== '') {
        if (isStringLevel) {
            var u = String(value).toUpperCase();
            if (u === 'HIGH' || u === '?') s = '7';
            else if (u === 'MID' || u === 'MIDDLE' || u === '?') s = '4';
            else if (u === 'LOW' || u === '?') s = '1';
            else if (/^[0-7]$/.test(String(value))) s = String(value);
        } else {
            var n = Number(value);
            if (n >= 0 && n <= 7) s = String(Math.round(n));
        }
    } else if (allowZero) {
        s = '0';
    }
    radios.forEach(function(r) {
        r.checked = r.value === s;
    });
}

/** 0~7 단계 select (문자 단계·숫자 공통) */
function setStageSelect(elementId, value, isStringLevel) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var s = '';
    if (value != null && value !== '') {
        if (isStringLevel) {
            var u = String(value).toUpperCase();
            if (u === 'HIGH' || u === '?') s = '7';
            else if (u === 'MID' || u === 'MIDDLE' || u === '?') s = '4';
            else if (u === 'LOW' || u === '?') s = '1';
            else if (/^[0-7]$/.test(String(value))) s = String(value);
        } else {
            var n = Number(value);
            if (n >= 0 && n <= 7) s = String(Math.round(n));
        }
    } else {
        s = '0';
    }
    el.value = s;
}

function editMember(id) {
    openMemberModal(id);
}

async function toggleMemberDormantStatus(id, currentStatus) {
    const isDormant = currentStatus === 'INACTIVE';
    const nextStatus = isDormant ? 'ACTIVE' : 'INACTIVE';
    const nextLabel = isDormant ? '활성' : '휴면';
    if (!confirm('이 회원을 ' + nextLabel + ' 처리하시겠습니까?')) {
        return;
    }
    try {
        await App.api.patch('/members/' + id + '/status', { status: nextStatus });
        App.showNotification(nextLabel + ' 처리되었습니다.', 'success');
        loadMembers();
    } catch (error) {
        App.err('회원 상태 변경 오류:', error);
        if (typeof App.showApiError === 'function') {
            App.showApiError(error);
        } else {
            App.showNotification('회원 상태 변경에 실패했습니다.', 'danger');
        }
    }
}

async function loadMemberData(id) {
    try {
        const member = await App.api.get(`/members/${id}`);
        // 편집 중인 회원 캐시
        currentEditingMember = member;
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
        document.getElementById('member-address').value = member.address || '';
        document.getElementById('member-school').value = member.school || '';
        // 구속·스윙·타구속도는 숫자 필드 / 나머지는 라디오 단계
        document.getElementById('member-pitching-speed').value = member.pitchingSpeed ?? '';
        setRadioStage('member-pitcher-control', member.pitcherControl, true, true);
        setRadioStage('member-pitcher-breaking-ball', member.pitcherBreakingBall, true, true);
        setRadioStage('member-running-speed', member.runningSpeed, false, true);
        document.getElementById('member-swing-speed').value = member.swingSpeed ?? '';
        document.getElementById('member-exit-velocity').value = member.exitVelocity ?? '';
        setRadioStage('member-batter-power', member.batterPower, false, true);
        setRadioStage('member-flexibility', member.pitcherFlexibility || member.batterFlexibility, true, true);
        setRadioStage('member-defense-handling', member.defenseHandling != null ? member.defenseHandling : 0, false, true);
        setRadioStage('member-defense-step', member.defenseStep != null ? member.defenseStep : 0, false, true);
        setRadioStage('member-defense-throwing', member.defenseThrowing != null ? member.defenseThrowing : 0, false, true);
        setRadioStage('member-defense-quickness', member.defenseQuickness != null ? member.defenseQuickness : 0, false, true);
        setRadioStage('member-catcher-blocking', member.catcherBlocking != null ? member.catcherBlocking : 0, false, true);
        setRadioStage('member-catcher-throwing', member.catcherThrowing != null ? member.catcherThrowing : 0, false, true);
        setRadioStage('member-catcher-framing', member.catcherFraming != null ? member.catcherFraming : 0, false, true);
        document.getElementById('member-join-date').value = member.joinDate || '';
        //  ( )
        if (member.createdAt) {
            const createdAt = new Date(member.createdAt);
            const year = createdAt.getFullYear();
            const month = String(createdAt.getMonth() + 1).padStart(2, '0');
            const day = String(createdAt.getDate()).padStart(2, '0');
            const hours = String(createdAt.getHours()).padStart(2, '0');
            const minutes = String(createdAt.getMinutes()).padStart(2, '0');
            document.getElementById('member-created-at').value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        document.getElementById('member-guardian-name').value = member.guardianName || '';
        document.getElementById('member-guardian-phone').value = member.guardianPhone || '';
        document.getElementById('member-memo').value = member.memo || '';
        document.getElementById('member-coach-memo').value = member.coachMemo || '';
        
        // 상품·담당 코치 UI: 방금 GET 한 member 기준으로 채움(currentEditingMember 외부 참조와 불일치 방지)
        await loadMemberProducts(id, member);
        await setupCoachReassignSection(currentEditingMember || member);
    } catch (error) {
        App.err('\uD68C\uC6D0 \uC815\uBCF4 \uB85C\uB529 \uC624\uB958:', error);
        App.showNotification('\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'danger');
    }
}

/** 담당 코치 변경 UI: /coaches 캐시 (이용권 종목별 필터용) */
var coachReassignAllCoachesCache = [];

function productCategoryShortLabel(cat) {
    if (!cat) {
        return '';
    }
    var m = {
        BASEBALL: '\uC57C\uAD6C',
        OUTDOOR_LESSON: '\uC57C\uC678\uB808\uC2A8',
        TRAINING_FITNESS: '\uD2B8\uB808\uC774\uB2DD\u00B7\uD544\uB77C\uD14C\uC2A4',
        TRAINING: '\uD2B8\uB808\uC774\uB2DD',
        PILATES: '\uD544\uB77C\uD14C\uC2A4',
        GENERAL: '\uC77C\uBC18',
        RENTAL: '\uB300\uAD00'
    };
    return m[cat] || String(cat);
}

/**
 * 담당 코치 변경 드롭다운용 종목 키.
 * DB category가 GENERAL이어도 상품명에 '야구' 등이 있으면 BASEBALL로 본다 (목록 담당 코치 열과 동일 취지).
 */
function resolveCoachFilterCategoryFromMemberProduct(mp) {
    if (!mp || !mp.product) {
        return '';
    }
    var product = mp.product;
    var category = String(product.category || '')
        .trim()
        .toUpperCase()
        .replace(/-/g, '_');
    var nameLower = String(product.name || '').toLowerCase();
    if (category === 'BASEBALL' || category === 'OUTDOOR_LESSON' || nameLower.includes('\uC57C\uAD6C') || nameLower.includes('baseball')) {
        return 'BASEBALL';
    }
    if (category === 'PILATES' || nameLower.includes('\uD544\uB77C\uD14C\uC2A4') || nameLower.includes('pilates')) {
        return 'PILATES';
    }
    if (category === 'TRAINING_FITNESS') {
        return 'TRAINING_FITNESS';
    }
    if (category === 'TRAINING' || nameLower.includes('\uD2B8\uB808\uC774\uB2DD') || nameLower.includes('training')) {
        return 'TRAINING';
    }
    if (category === 'RENTAL' || nameLower.includes('\uB300\uAD00')) {
        return 'RENTAL';
    }
    if (category === 'GENERAL' || category === '') {
        return 'GENERAL';
    }
    return category;
}

/**
 * 상품 category와 같은 종목 코치만 (App.categorizeCoachBySubject 기준).
 * 목록이 비면 filterCoachesByProductCategory로 폴백.
 */
function filterCoachesForProductReassignment(allCoaches, productCategory) {
    var active = (allCoaches || []).filter(function (c) {
        return c && c.active !== false;
    });
    if (!active.length) {
        return [];
    }
    var cat = (productCategory || '').toString().trim().toUpperCase().replace(/-/g, '_');
    if (!cat || cat === 'GENERAL') {
        return active.slice();
    }
    if (typeof App.categorizeCoachBySubject !== 'function') {
        return filterCoachesByProductCategory(allCoaches, productCategory);
    }
    function subj(c) {
        return App.categorizeCoachBySubject(c);
    }
    var filtered;
    if (cat === 'BASEBALL') {
        if (typeof App.filterCoachesForBookingCalendar === 'function') {
            filtered = App.filterCoachesForBookingCalendar(active, { facilityType: 'BASEBALL' });
        } else {
            filtered = [];
        }
        if (!filtered || !filtered.length) {
            filtered = active.filter(function (c) {
                var s = subj(c);
                return s === 'BASEBALL' || s === 'YOUTH';
            });
        }
    } else if (cat === 'TRAINING_FITNESS') {
        filtered = active.filter(function (c) {
            var s = subj(c);
            return s === 'TRAINING' || s === 'PILATES';
        });
    } else if (cat === 'TRAINING') {
        filtered = active.filter(function (c) {
            return subj(c) === 'TRAINING';
        });
    } else if (cat === 'PILATES') {
        filtered = active.filter(function (c) {
            return subj(c) === 'PILATES';
        });
    } else if (cat === 'RENTAL') {
        filtered = active.filter(function (c) {
            return subj(c) === 'RENTAL';
        });
    } else {
        return filterCoachesByProductCategory(allCoaches, productCategory);
    }
    if (!filtered.length) {
        return filterCoachesByProductCategory(allCoaches, productCategory);
    }
    return filtered;
}

function getCurrentCoachIdForMemberProduct(mp) {
    if (!mp) {
        return null;
    }
    if (mp.coach && mp.coach.id != null) {
        return Number(mp.coach.id);
    }
    if (mp.coachId != null) {
        return Number(mp.coachId);
    }
    return null;
}

function refillCoachReassignTargetSelect(productCategory, memberProduct) {
    var targetSel = document.getElementById('member-coach-reassign-target');
    if (!targetSel) {
        return;
    }
    var list = filterCoachesForProductReassignment(coachReassignAllCoachesCache, productCategory);
    var curCoachId = getCurrentCoachIdForMemberProduct(memberProduct);
    targetSel.innerHTML = '<option value="">\uBCC0\uACBD\uD560 \uCF54\uCE58 \uC120\uD0DD\u2026</option>';
    var added = 0;
    list.forEach(function (c) {
        if (curCoachId != null && Number(c.id) === curCoachId) {
            return;
        }
        var o = document.createElement('option');
        o.value = String(c.id);
        o.textContent = c.name || ('ID ' + c.id);
        targetSel.appendChild(o);
        added++;
    });
    if (added === 0) {
        var hint = document.createElement('option');
        hint.value = '';
        hint.disabled = true;
        hint.textContent =
            list.length === 0
                ? '\uC774 \uC0C1\uD488 \uC885\uBAA9\uC5D0 \uB9DE\uB294 \uCF54\uCE58\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'
                : '\uAC19\uC740 \uC885\uBAA9\uC5D0 \uBC30\uC815 \uAC00\uB2A5\uD55C \uB2E4\uB978 \uCF54\uCE58\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.';
        targetSel.appendChild(hint);
    }
}

function handleCoachReassignMpChange() {
    var member = currentEditingMember;
    var mpSel = document.getElementById('member-coach-reassign-mp');
    var currentPill = document.getElementById('member-coach-reassign-current');
    if (!mpSel || !member) {
        return;
    }
    var activeMps = getSortedActiveProductsForMember(member);
    var mp = activeMps.find(function (m) {
        return String(m.id) === String(mpSel.value);
    });
    var effectiveCat = mp ? resolveCoachFilterCategoryFromMemberProduct(mp) : '';
    if (currentPill) {
        var nm = mp ? getCoachNameForMemberProduct(mp, member) : null;
        currentPill.textContent = nm ? nm : '(\uBBF8\uC9C0\uC815)';
        currentPill.title = nm ? String(nm) : '';
    }
    refillCoachReassignTargetSelect(effectiveCat, mp || null);
}

async function setupCoachReassignSection(member) {
    var sec = document.getElementById('member-coach-reassign-section');
    var emptyEl = document.getElementById('member-coach-reassign-empty');
    var fieldsEl = document.getElementById('member-coach-reassign-fields');
    var mpSel = document.getElementById('member-coach-reassign-mp');
    var targetSel = document.getElementById('member-coach-reassign-target');
    var noteEl = document.getElementById('member-coach-reassign-note');
    if (!sec) {
        return;
    }
    if (!member || !member.id) {
        sec.style.display = 'none';
        coachReassignAllCoachesCache = [];
        return;
    }
    sec.style.display = 'block';
    try {
        coachReassignAllCoachesCache = (await App.api.get('/coaches')) || [];
    } catch (e) {
        App.err('\uCF54\uCE58 \uBAA9\uB85D \uB85C\uB4DC \uC2E4\uD328:', e);
        coachReassignAllCoachesCache = [];
    }
    var activeMps = getSortedActiveProductsForMember(member);
    if (mpSel) {
        mpSel.innerHTML = '';
        activeMps.forEach(function (mp) {
            var opt = document.createElement('option');
            opt.value = String(mp.id);
            var pn = mp.product && mp.product.name ? mp.product.name : '\uC774\uC6A9\uAD8C';
            var resolved = resolveCoachFilterCategoryFromMemberProduct(mp);
            opt.dataset.category = resolved;
            var catLabel = productCategoryShortLabel(resolved);
            opt.textContent = catLabel ? pn + ' \u00B7 ' + catLabel : pn;
            mpSel.appendChild(opt);
        });
    }
    if (noteEl) {
        noteEl.value = '';
    }
    if (activeMps.length === 0) {
        if (emptyEl) {
            emptyEl.style.display = 'block';
        }
        if (fieldsEl) {
            fieldsEl.style.display = 'none';
        }
        if (targetSel) {
            targetSel.innerHTML = '<option value="">\uD65C\uC131 \uC774\uC6A9\uAD8C \uC5C6\uC74C</option>';
        }
        return;
    }
    if (emptyEl) {
        emptyEl.style.display = 'none';
    }
    if (fieldsEl) {
        fieldsEl.style.display = '';
    }
    if (mpSel && mpSel.options.length) {
        mpSel.selectedIndex = 0;
    }
    handleCoachReassignMpChange();
}

async function submitCoachReassignRequest() {
    var memberId = document.getElementById('member-id').value;
    var mpSel = document.getElementById('member-coach-reassign-mp');
    var sel = document.getElementById('member-coach-reassign-target');
    var noteEl = document.getElementById('member-coach-reassign-note');
    if (!memberId) {
        App.showNotification('\uD68C\uC6D0 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.', 'warning');
        return;
    }
    var mpid = mpSel && mpSel.value ? parseInt(mpSel.value, 10) : NaN;
    if (!mpid || isNaN(mpid)) {
        App.showNotification('\uB300\uC0C1 \uC774\uC6A9\uAD8C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.', 'warning');
        return;
    }
    if (!sel || !sel.value) {
        App.showNotification('\uBCC0\uACBD\uD560 \uCF54\uCE58\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.', 'warning');
        return;
    }
    try {
        var body = {
            memberId: parseInt(memberId, 10),
            requestType: 'COACH_REASSIGNMENT',
            memberProductId: mpid,
            newCoachId: parseInt(sel.value, 10),
            detailSummary: noteEl && noteEl.value ? String(noteEl.value).trim() : null
        };
        var res = await App.api.post('/member-approvals', body);
        if (res && res.created === false) {
            App.showNotification('\uC774\uBBF8 \uB300\uAE30 \uC911\uC778 \uCF54\uCE58 \uBCC0\uACBD \uC694\uCCAD\uC774 \uC788\uC2B5\uB2C8\uB2E4.', 'info');
            return;
        }
        if (res && res.autoApproved) {
            App.showNotification(
                '\uAD00\uB9AC\uC790(ADMIN) \uAD8C\uD55C\uC73C\uB85C \uB2F4\uB2F9 \uCF54\uCE58\uAC00 \uC989\uC2DC \uBC18\uC601\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
                'success'
            );
            sel.value = '';
            if (noteEl) {
                noteEl.value = '';
            }
            await loadMemberData(parseInt(memberId, 10));
            try {
                await updateProductCoachSelection();
            } catch (e) {
                App.err('updateProductCoachSelection after coach reassign:', e);
            }
            if (typeof loadMembers === 'function') {
                await loadMembers(false, { refreshStats: false });
            }
            return;
        }
        App.showNotification('\uAD00\uB9AC\uC790 \uC2B9\uC778 \uC694\uCCAD\uC774 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB300\uC2DC\uBCF4\uB4DC\uC5D0\uC11C \uC2B9\uC778\uB418\uBA74 \uBC18\uC601\uB429\uB2C8\uB2E4.', 'success');
        sel.value = '';
        if (noteEl) {
            noteEl.value = '';
        }
        handleCoachReassignMpChange();
    } catch (error) {
        if (typeof App.showApiError === 'function') {
            App.showApiError(error);
        } else {
            App.showNotification('\uC694\uCCAD \uC2E4\uD328', 'danger');
        }
    }
}

// 선택된 상품 옵션 강조 스타일 (중복 호출 throttle)
let isApplyingStyles = false;
let lastApplyTime = 0;

function applySelectedProductStyles() {
    const productSelect = document.getElementById('member-products');
    if (!productSelect) {
        App.warn('applySelectedProductStyles: member-products \uC5F4\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
        return;
    }
    
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
        
        App.log('applySelectedProductStyles:', {
            totalOptions: options.length,
            selectedBefore: options.filter(opt => opt.selected).length
        });
        
        options.forEach((option) => {
            if (!option.value || option.value === '') {
                return;
            }
            
            const isSelected = option.selected;
            
            let originalText = option.dataset.originalText;
            if (!originalText) {
                originalText = option.textContent.trim();
                //   ( ' ',  '[] ')    
                originalText = originalText.replace(/^(?:\?\s+|\[\?\?\]\s+)/, '');
                if (originalText) {
                    option.dataset.originalText = originalText;
                } else {
                    originalText = option.textContent.trim();
                }
            }
            
            if (isSelected) {
                selectedCount++;
                
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
                
                option.textContent = originalText;
                
                App.log(`선택된 상품 옵션: ${option.textContent} (ID: ${option.value})`);
            } else {
                option.style.cssText = '';
                option.removeAttribute('data-selected');
                option.removeAttribute('class');
                
                option.textContent = originalText;
            }
        });
        
        productSelect.style.backgroundColor = 'var(--bg-secondary)';
        productSelect.style.borderColor = 'var(--border-color)';
        
        App.log(`applySelectedProductStyles \uC644\uB8CC: \uC120\uD0DD ${selectedCount}\uAC1C`);
    } catch (error) {
        App.err('applySelectedProductStyles \uC624\uB958:', error);
    } finally {
        //    (setTimeout )
        isApplyingStyles = false;
    }
}

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
        App.err('updateTotalPrice \uC624\uB958:', error);
    }
}

/** 상품별 담당 코치 선택 UI 갱신 */
async function updateProductCoachSelection() {
    App.log('[updateProductCoachSelection] start');
    App.log('[updateProductCoachSelection] currentEditingMember:', currentEditingMember);
    
    const container = document.getElementById('product-coach-selection');
    if (!container) {
        App.warn('[updateProductCoachSelection] product-coach-selection \uC5F4 \uC5C6\uC74C');
        return;
    }
    
    const productSelect = document.getElementById('member-products');
    if (!productSelect) {
        App.warn('[updateProductCoachSelection] member-products select 없음');
        return;
    }
    
    let selectedOptions = Array.from(productSelect.selectedOptions).filter(opt => opt.value && opt.value !== '');
    const seenProductIds = new Set();
    selectedOptions = selectedOptions.filter(opt => {
        const pid = String(opt.value);
        if (seenProductIds.has(pid)) return false;
        seenProductIds.add(pid);
        return true;
    });
    App.log('[updateProductCoachSelection] 선택된 상품 수:', selectedOptions.length);
    
    if (selectedOptions.length === 0) {
        container.innerHTML = '';
        App.log('[updateProductCoachSelection] 선택 없음 — 비움');
        return;
    }
    
    let allCoaches = [];
    try {
        allCoaches = await App.api.get('/coaches');
        allCoaches = allCoaches.filter(c => c.active !== false);
    } catch (error) {
        App.err('코치 목록 로드 실패:', error);
        return;
    }
    
    container.innerHTML = '';
    
    const selectedProductCategories = new Set();
    selectedOptions.forEach(option => {
        const category = option.dataset.category;
        if (category) {
            selectedProductCategories.add(category);
        }
    });
    
    App.log('[updateProductCoachSelection] 선택 상품 카테고리:', Array.from(selectedProductCategories));
    
    selectedOptions.forEach((option, index) => {
        const productId = option.value;
        const productName = sanitizeProductDisplayName(
            option.dataset.productName || option.textContent.split(' (')[0]
        ) || '\uC774\uB984 \uC5C6\uC74C';
        const productCategory = option.dataset.category;
        
        let selectedCoachId = '';
        
        if (currentEditingMember && currentEditingMember.memberProducts) {
            const memberProduct = currentEditingMember.memberProducts.find(mp => {
                const mpProductId1 = mp.product?.id ? String(mp.product.id) : '';
                const mpProductId2 = mp.productId ? String(mp.productId) : '';
                const targetProductId = String(productId);
                return mpProductId1 === targetProductId || mpProductId2 === targetProductId;
            });
            
            if (memberProduct) {
                let coachNameToFind = null;
                if (memberProduct.coachName) {
                    coachNameToFind = String(memberProduct.coachName).replace(/\s+/g, ' ').trim();
                    App.log(`[코치1-1] coachName: "${coachNameToFind}"`);
                } 
                else if (memberProduct.product && memberProduct.product.coach) {
                    const productCoach = memberProduct.product.coach;
                    if (typeof productCoach === 'object' && productCoach.name) {
                        coachNameToFind = String(productCoach.name).trim();
                    } else if (typeof productCoach === 'string') {
                        coachNameToFind = productCoach.trim();
                    }
                    App.log(`[코치1-2] product.coach: "${coachNameToFind}"`);
                }
                else if (memberProduct.coach) {
                    const mpCoach = memberProduct.coach;
                    if (typeof mpCoach === 'object' && mpCoach.name) {
                        coachNameToFind = String(mpCoach.name).trim();
                    } else if (typeof mpCoach === 'string') {
                        coachNameToFind = mpCoach.trim();
                    }
                    App.log(`[코치1-3] memberProduct.coach: "${coachNameToFind}"`);
                }
                
                if (coachNameToFind) {
                    App.log(`[코치1] 상품 ID ${productId} 매칭 이름: "${coachNameToFind}"`);
                    
                    const coach = allCoaches.find(c => {
                        const coachName = String(c.name || '').replace(/\s+/g, ' ').trim();
                        const searchName = coachNameToFind.replace(/\s+/g, ' ').trim();
                        
                        if (coachName === searchName) return true;
                        
                        if (coachName.includes(searchName) || searchName.includes(coachName)) return true;
                        
                        const coachNameWithoutBracket = coachName.replace(/\s*\[.*?\]\s*/g, '').trim();
                        const searchNameWithoutBracket = searchName.replace(/\s*\[.*?\]\s*/g, '').trim();
                        if (coachNameWithoutBracket === searchNameWithoutBracket) return true;
                        
                        const coachNameNoSpace = coachName.replace(/\s+/g, '');
                        const searchNameNoSpace = searchName.replace(/\s+/g, '');
                        if (coachNameNoSpace === searchNameNoSpace) return true;
                        
                        return false;
                    });
                    
                    if (coach) {
                        selectedCoachId = String(coach.id);
                        App.log(`[코치1] 매칭: ${coach.name} (ID: ${coach.id}), selectedCoachId: "${selectedCoachId}"`);
                    } else {
                        App.warn(`[코치1] 이름으로 코치를 찾지 못함: "${coachNameToFind}"`);
                        App.warn(`[코치1] 전체 코치 이름:`, allCoaches.map(c => c.name));
                    }
                } else {
                    App.warn(`[코치1] 상품 ID ${productId}에 코치 이름 없음 (coachName, product.coach, coach)`);
                    App.warn(`[코치1] memberProduct:`, memberProduct);
                }
            }
        }
        
        if (!selectedCoachId && option.dataset.coachName) {
            const coachNameToFind = String(option.dataset.coachName).replace(/\s+/g, ' ').trim();
            App.log(`[코치2] 상품 ID ${productId} 옵션 data-coachName: "${coachNameToFind}"`);
            
            const coach = allCoaches.find(c => {
                const coachName = String(c.name || '').replace(/\s+/g, ' ').trim();
                const searchName = coachNameToFind.replace(/\s+/g, ' ').trim();
                
                if (coachName === searchName) return true;
                
                if (coachName.includes(searchName) || searchName.includes(coachName)) return true;
                
                const coachNameWithoutBracket = coachName.replace(/\s*\[.*?\]\s*/g, '').trim();
                const searchNameWithoutBracket = searchName.replace(/\s*\[.*?\]\s*/g, '').trim();
                if (coachNameWithoutBracket === searchNameWithoutBracket) return true;
                
                const coachNameNoSpace = coachName.replace(/\s+/g, '');
                const searchNameNoSpace = searchName.replace(/\s+/g, '');
                if (coachNameNoSpace === searchNameNoSpace) return true;
                
                return false;
            });
            
            if (coach) {
                selectedCoachId = String(coach.id);
                App.log(`[코치2] 매칭: ${coach.name} (ID: ${coach.id}), selectedCoachId: "${selectedCoachId}"`);
            }
        }
        
        if (!selectedCoachId) {
            App.log(`[코치디버그] 상품 ID ${productId} — 아직 코치 미선택`);
            App.log(`[코치디버그] currentEditingMember:`, currentEditingMember);
            if (currentEditingMember && currentEditingMember.memberProducts) {
                App.log(`[코치디버그] memberProducts:`, currentEditingMember.memberProducts);
                const memberProduct = currentEditingMember.memberProducts.find(mp => 
                    String(mp.product?.id || mp.productId || '') === String(productId)
                );
                App.log(`[코치디버그] 해당 memberProduct:`, memberProduct);
                App.log(`[코치디버그] memberProduct.coachName:`, memberProduct?.coachName);
                App.log(`[코치디버그] memberProduct 키:`, memberProduct ? Object.keys(memberProduct) : 'null');
                if (memberProduct && !memberProduct.coachName) {
                    App.log(`[코치디버그] memberProduct.product:`, memberProduct.product);
                    if (memberProduct.product && memberProduct.product.coach) {
                        App.log(`[코치디버그] product.coach:`, memberProduct.product.coach);
                    }
                }
            }
        }
        
        const selectedCoachIdStr = String(selectedCoachId || '');
        App.log(`[코치선택] 상품 ID ${productId}, selectedCoachId: "${selectedCoachIdStr}"`);
        
        const coachGroup = document.createElement('div');
        coachGroup.className = 'form-group';
        coachGroup.style.marginBottom = '12px';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.style.fontSize = '13px';
        label.style.fontWeight = '600';
        label.style.color = 'var(--text-primary)';
        label.innerHTML = `${productName} - \uB2F4\uB2F9 \uCF54\uCE58 <span class="required-asterisk">*</span>`;
        
        const select = document.createElement('select');
        select.className = 'form-control product-coach-select';
        select.setAttribute('data-product-id', productId);
        select.required = true;
        select.style.fontSize = '14px';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694';
        select.appendChild(defaultOption);
        
        let filteredCoaches = allCoaches;
        
        const matchesCategory = (coach, category) => {
            const categoryLower = (category || '').toLowerCase();
            
            // \uB300\uAD00(RENTAL): availableBranches\uC5D0 RENTAL \uD3EC\uD568
            if (categoryLower === 'rental') {
                var branches = (coach.availableBranches || '').toUpperCase();
                return branches.indexOf('RENTAL') !== -1;
            }
            if (categoryLower === 'pilates') {
                if (typeof App.categorizeCoachBySubject === 'function') {
                    return App.categorizeCoachBySubject(coach) === 'PILATES';
                }
                var pilatesText = ((coach.specialties || '') + ' ' + (coach.name || '')).toLowerCase();
                return pilatesText.indexOf('pilates') !== -1
                    || pilatesText.indexOf('\ud544\ub77c\ud14c\uc2a4') !== -1
                    || (coach.name || '').indexOf('[\uac15\uc0ac]') !== -1;
            }
            
            if (!coach.specialties || !category) return false;
            var specialties = (coach.specialties || '').toLowerCase();
            
            if (categoryLower === 'baseball') {
                return specialties.includes('baseball') || specialties.includes('\uc57c\uad6c');
            }
            if (categoryLower === 'training' || categoryLower === 'training_fitness') {
                return specialties.includes('training') || specialties.includes('\ud2b8\ub808\uc774\ub2dd') || specialties.includes('training_fitness');
            }
            // GENERAL \uB4F1 \uBBF8\uBD84\uB958 \uC0C1\uD488\uC740 \uC804\uC6D0 \uC5D4\uC9C4 \uC911 \uC120\uD0DD
            if (categoryLower === 'general' || categoryLower === 'other') {
                return true;
            }
            
            return false;
        };
        
        if (productCategory) {
            filteredCoaches = allCoaches.filter(function(coach) {
                return matchesCategory(coach, productCategory);
            });
            if (filteredCoaches.length === 0) {
                App.warn('[product-coach] \uCE74\uD14C\uACE0\uB9AC \uB9DE\uB294 \uCF54\uCE58\uAC00 \uC5C6\uC5B4 \uC804\uCCB4 \uCF54\uCE58 \uBAA9\uB85D\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4:', productCategory);
                filteredCoaches = allCoaches;
            }
            App.log('[코치필터] 상품 ID ' + productId + ' (카테고리: ' + productCategory + '): 전체 ' + allCoaches.length + '명 중 ' + filteredCoaches.length + '명');
        } else {
            App.log('[코치필터] 상품 ID ' + productId + ': 카테고리 없음 — 전체 코치');
        }
        
        filteredCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = String(coach.id || '');
            option.textContent = coach.name;
            
            const coachIdStr = String(coach.id || '');
            if (coachIdStr === selectedCoachIdStr) {
                option.selected = true;
                App.log(`[코치매칭] 상품 ID ${productId} 선택 "${coach.name}" (ID: ${coach.id})`);
            }
            
            select.appendChild(option);
        });
        
        coachGroup.appendChild(label);
        coachGroup.appendChild(select);
        container.appendChild(coachGroup);
        
        if (selectedCoachIdStr) {
            select.value = selectedCoachIdStr;
            
            const selectedOption = select.querySelector(`option[value="${selectedCoachIdStr}"]`);
            if (selectedOption && (selectedOption.selected || select.value === selectedCoachIdStr)) {
                App.log(`[검증] 상품 ID ${productId} select에 코치 ID ${selectedCoachIdStr} 반영 (value: "${select.value}")`);
            } else {
                App.warn(`[검증] 상품 ID ${productId} select에 코치 ID ${selectedCoachIdStr} 반영 실패`);
                App.warn(`[검증] select.value: "${select.value}", selectedIndex: ${select.selectedIndex}`);
                setTimeout(() => {
                    select.value = selectedCoachIdStr;
                    App.log(`[재시도] 상품 ID ${productId} select.value를 ${selectedCoachIdStr}로 재설정`);
                }, 10);
            }
        }
        
        select.addEventListener('change', function() {
            App.log(`[코치변경] 상품 ID ${productId} 값 "${this.value}" (이전 선택: "${selectedCoachIdStr}")`);
        });
    });
}

/**
 * @param {number|string} memberId
 * @param {object} [memberSnapshot] loadMemberData 등에서 방금 받은 회원 객체 — 있으면 그 memberProducts 로 상품 선택·coachName 동기화(캐시와 서버 불일치 방지)
 */
async function loadMemberProducts(memberId, memberSnapshot) {
    try {
        const productSelect = document.getElementById('member-products');
        if (!productSelect) {
            App.warn('loadMemberProducts: member-products select 없음');
            return;
        }
        
        if (productSelect.options.length === 0) {
            await loadProductsForSelect();
            let attempts = 0;
            while (productSelect.options.length === 0 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
        }
        
        if (productSelect.options.length === 0) {
            App.warn('loadMemberProducts: 상품 옵션을 불러오지 못함');
            return;
        }
        
        let memberProducts = null;
        if (memberSnapshot != null && Array.isArray(memberSnapshot.memberProducts)) {
            memberProducts = memberSnapshot.memberProducts;
            App.log('loadMemberProducts - memberSnapshot 기준 memberProducts:', memberProducts);
        } else if (currentEditingMember && currentEditingMember.memberProducts) {
            memberProducts = currentEditingMember.memberProducts;
            App.log('loadMemberProducts - currentEditingMember 기준 memberProducts:', memberProducts);
        } else {
            const member = await App.api.get(`/members/${memberId}`);
            memberProducts = member.memberProducts || [];
            
            if (currentEditingMember) {
                currentEditingMember.memberProducts = memberProducts;
            } else {
                currentEditingMember = { memberProducts: memberProducts };
            }
            App.log('loadMemberProducts - API로 불러온 memberProducts:', memberProducts);
        }
        
        App.log('loadMemberProducts - 갱신된 currentEditingMember:', currentEditingMember);
        
        Array.from(productSelect.options).forEach(option => {
            option.selected = false;
            delete option.dataset.coachName;
        });
        
        if (memberProducts && memberProducts.length > 0) {
            memberProducts.forEach(mp => {
                const productId = String(mp.product?.id || mp.productId || '');
                const option = Array.from(productSelect.options).find(opt => String(opt.value) === productId);
                if (option) {
                    option.selected = true;
                    if (mp.coachName) {
                        option.dataset.coachName = mp.coachName;
                        App.log(`상품 ID ${productId} 옵션 coachName: "${mp.coachName}"`);
                    } else {
                        App.warn(`상품 ID ${productId} coachName 없음. memberProduct:`, mp);
                    }
                } else {
                    App.warn(`상품 ID ${productId}에 해당하는 select 옵션 없음`);
                }
            });
        }
        
        applySelectedProductStyles();
        
        requestAnimationFrame(() => {
            applySelectedProductStyles();
            requestAnimationFrame(() => {
                applySelectedProductStyles();
            });
        });
        
        const applyTimes = [100, 300, 500, 800, 1200, 2000];
        applyTimes.forEach(delay => {
            setTimeout(() => {
                applySelectedProductStyles();
            }, delay);
        });
        
        productSelect.dispatchEvent(new Event('change', { bubbles: true }));
        
        setTimeout(() => {
            updateProductCoachSelection();
        }, 200);
    } catch (error) {
        App.err('loadMemberProducts 실패:', error);
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
    
    if (!memberId && phoneNumber) {
        try {
            const existingMembers = await App.api.get(`/members/search?phoneNumber=${encodeURIComponent(phoneNumber)}&includePendingApproval=true`);
            
            if (existingMembers && existingMembers.length > 0) {
                const memberNames = existingMembers.map(m => m.name).join(', ');
                App.showNotification(
                    `전화번호 '${phoneNumber}'는 이미 등록된 회원이 사용 중입니다. (${memberNames}) 다른 번호를 입력하거나, 동일 번호로 가족 회원 등록이 필요하면 관리자에게 문의해 주세요.`,
                    'warning'
                );
                return;
            }
        } catch (error) {
            App.warn('전화번호 중복 검사 중 오류:', error);
        }
    }
    
    const data = {
        name: document.getElementById('member-name').value,
        phoneNumber: phoneNumber,
        allowDuplicatePhone: allowDuplicatePhone,
        memberNumber: memberNumber || null,
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
        pitcherBreakingBall: document.querySelector('input[name="member-pitcher-breaking-ball"]:checked')?.value || null,
        pitcherFlexibility: document.querySelector('input[name="member-flexibility"]:checked')?.value || null,
        runningSpeed: (function() { var v = document.querySelector('input[name="member-running-speed"]:checked')?.value; return v ? parseFloat(v) : null; })(),
        swingSpeed: document.getElementById('member-swing-speed').value ? parseFloat(document.getElementById('member-swing-speed').value) : null,
        exitVelocity: document.getElementById('member-exit-velocity').value ? parseFloat(document.getElementById('member-exit-velocity').value) : null,
        batterPower: (function() { var v = document.querySelector('input[name="member-batter-power"]:checked')?.value; return v ? parseFloat(v) : null; })(),
        batterFlexibility: (function() { var v = document.querySelector('input[name="member-flexibility"]:checked')?.value; return v ? parseFloat(v) : null; })(),
        defenseHandling: (function() { var v = document.querySelector('input[name="member-defense-handling"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        defenseStep: (function() { var v = document.querySelector('input[name="member-defense-step"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        defenseThrowing: (function() { var v = document.querySelector('input[name="member-defense-throwing"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        defenseQuickness: (function() { var v = document.querySelector('input[name="member-defense-quickness"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        catcherBlocking: (function() { var v = document.querySelector('input[name="member-catcher-blocking"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        catcherThrowing: (function() { var v = document.querySelector('input[name="member-catcher-throwing"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        catcherFraming: (function() { var v = document.querySelector('input[name="member-catcher-framing"]:checked')?.value; return v != null && v !== '' ? parseFloat(v) : null; })(),
        guardianName: document.getElementById('member-guardian-name').value || null,
        guardianPhone: document.getElementById('member-guardian-phone').value || null,
        memo: document.getElementById('member-memo').value || null,
        coachMemo: document.getElementById('member-coach-memo').value || null
    };
    
    const joinDate = document.getElementById('member-join-date').value;
    if (joinDate) {
        data.joinDate = joinDate;
    } else if (isNewMember) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        data.joinDate = `${year}-${month}-${day}`;
    }
    
    const createdAt = document.getElementById('member-created-at').value;
    if (createdAt) {
        data.createdAt = createdAt + ':00';
    }
    
    const memberFormIdEarly = document.getElementById('member-id').value;
    if (memberFormIdEarly && currentEditingMember && currentEditingMember.coach && currentEditingMember.coach.id != null) {
        data.coach = { id: currentEditingMember.coach.id };
    } else {
        data.coach = null;
    }
    
    const memberFormId = document.getElementById('member-id').value;
    const productSelectEl = document.getElementById('member-products');
    const selectedProductIds = productSelectEl
        ? Array.from(productSelectEl.selectedOptions)
            .map(option => option.value)
            .filter(pid => pid && pid !== '')
        : [];

    // \uC2E0\uADDC \uB4F1\uB85D: \uD68C\uC6D0 \uD589\uC740 \uC774\uC6A9\uAD8C\uACFC \uBD84\uB9AC\uB418\uC5B4 POST\uB9CC \uD558\uBA74 \uC0C1\uD488/\uCF54\uCE58 \uC5C6\uC774 \uC0DD\uC131\uB428. API \uC804\uC5D0 \uC774\uC6A9\uAD8C+\uCF54\uCE58 \uD544\uC218.
    if (!memberFormId) {
        if (selectedProductIds.length === 0) {
            App.showNotification(
                '\uC2E0\uADDC \uB4F1\uB85D\uC740 \uC774\uC6A9\uAD8C(\uC0C1\uD488)\uC744 1\uAC1C \uC774\uC0C1 \uC120\uD0DD\uD558\uACE0, \uC0C1\uD488\uBCC4 \uB2F4\uB2F9 \uCF54\uCE58\uB97C \uC9C0\uC815\uD574 \uC8FC\uC138\uC694.',
                'warning'
            );
            return;
        }
        const coachSelects = document.querySelectorAll('.product-coach-select');
        for (const productId of selectedProductIds) {
            const select = Array.from(coachSelects).find(el => String(el.dataset.productId) === String(productId));
            if (!select || !select.value || String(select.value).trim() === '') {
                App.showNotification(
                    '\uC120\uD0DD\uD55C \uC0C1\uD488\uB9C8\uB2E4 \uB2F4\uB2F9 \uCF54\uCE58\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
                    'warning'
                );
                if (select) {
                    select.focus();
                    select.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return;
            }
        }
    }

    if (!memberFormId) {
        data.initialProductAssignments = selectedProductIds.map(function (pid) {
            const select = Array.from(document.querySelectorAll('.product-coach-select')).find(function (el) {
                return String(el.dataset.productId) === String(pid);
            });
            return {
                productId: parseInt(pid, 10),
                coachId: parseInt(select.value, 10)
            };
        });
    }
    
    try {
        const id = memberFormId;
        let savedMember;
        
        if (id) {
            savedMember = await App.api.put(`/members/${id}`, data);
            App.showNotification('\uD68C\uC6D0 \uC815\uBCF4\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        } else {
            delete data.id;
            App.log('[saveMember] \uC2E0\uADDC \uB4F1\uB85D:', data);
            savedMember = await App.api.post('/members', data);
            // \uC774\uC6A9\uAD8C \uBC30\uC815\uC774 \uC788\uC73C\uBA74 assignProductsToMember\uC5D0\uC11C \uD569\uC0B0 \uC54C\uB9BC(\uC2B9\uC778 \uB300\uAE30/\uC644\uB8CC)\uB9CC \uD45C\uC2DC — \uC911\uBCF5 \uD1A0\uC2A4\uD2B8 \uBC29\uC9C0
            if (!selectedProductIds || selectedProductIds.length === 0) {
                App.showNotification('\uD68C\uC6D0\uC774 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
            }
        }
        
        App.log('[saveMember] \uC120\uD0DD \uC0C1\uD488 IDs:', selectedProductIds);
        App.log('[saveMember] \uD68C\uC6D0 ID:', savedMember.id);
        
        // \uC218\uC815: \uC0C1\uD488 \uC788\uC73C\uBA74 \uCF54\uCE58 \uBB34\uB8CC \uC5C6\uB294\uC9C0 (\uC2E0\uADDC\uB294 \uC704\uC5D0\uC11C \uC774\uBBF8 \uAC80\uC99D)
        if (id && selectedProductIds.length > 0) {
            const coachSelects = document.querySelectorAll('.product-coach-select');
            let firstEmptySelect = null;
            for (const productId of selectedProductIds) {
                const select = Array.from(coachSelects).find(el => String(el.dataset.productId) === String(productId));
                if (select && (!select.value || String(select.value).trim() === '')) {
                    if (!firstEmptySelect) firstEmptySelect = select;
                }
            }
            if (firstEmptySelect) {
                App.showNotification(
                    '\uC120\uD0DD\uD55C \uC0C1\uD488\uB9C8\uB2E4 \uB2F4\uB2F9 \uCF54\uCE58\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.',
                    'warning'
                );
                firstEmptySelect.focus();
                firstEmptySelect.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
        }
        
        var assignPendingCount = 0;
        if (id) {
            const existingMemberProducts = (currentEditingMember && currentEditingMember.memberProducts) ? currentEditingMember.memberProducts : [];
            if (selectedProductIds.length > 0) {
                App.log('[saveMember] 수정 — 상품 배정 (기존 대비 추가·삭제)');
                var assignResEdit = await assignProductsToMember(savedMember.id, selectedProductIds, existingMemberProducts);
                assignPendingCount = (assignResEdit && assignResEdit.pendingApprovalCount) || 0;
                App.log('[saveMember] 수정 — 배정 완료');
            } else {
                App.log('[saveMember] 수정 — 상품 없음, 전체 삭제');
                await App.api.delete(`/members/${savedMember.id}/products`);
            }
        } else {
            if (selectedProductIds.length > 0) {
                App.log('[saveMember] 신규 — 상품 배정');
                var assignResNew = await assignProductsToMember(savedMember.id, selectedProductIds, null, { afterRegistration: true });
                assignPendingCount = (assignResNew && assignResNew.pendingApprovalCount) || 0;
                App.log('[saveMember] 신규 — 배정 완료');
            }
        }
        
        App.Modal.close('member-modal');
        var roleUpForApproval = (App.currentRole || '').toUpperCase();
        var canOpenApprovalMenu =
            (roleUpForApproval === 'ADMIN' || roleUpForApproval === 'MANAGER') &&
            typeof App.goToDashboardMemberApprovals === 'function';
        // \uC2E0\uADDC \uB4F1\uB85D \uB610\uB294 \uC774\uC6A9\uAD8C \uCD94\uAC00\uAC00 \uC2B9\uC778 \uB300\uAE30\uC778 \uACBD\uC6B0 \uB300\uC2DC\uBCF4\uB4DC \uC2B9\uC778 \uBA54\uB274
        if (canOpenApprovalMenu && (!id || assignPendingCount > 0)) {
            App.goToDashboardMemberApprovals();
            return;
        }
        if (selectedProductIds.length > 0) {
            await focusMemberRowInPage(savedMember.id);
            if (currentMemberDetail && currentMemberDetail.id === savedMember.id) {
                switchTab('products', currentMemberDetail);
                loadMemberProductsForDetail(savedMember.id);
            }
        } else {
            loadMembers();
        }
    } catch (error) {
        if (typeof App.showApiError === 'function') {
            App.showApiError(error);
        } else {
            App.showNotification('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
        }
    }
}

// existingMemberProducts: 편집 시 기존 회원 상품 목록(추가·삭제 diff용, 신규는 null)
/**
 * @param {object} [options]
 * @param {boolean} [options.afterRegistration] \uC2E0\uADDC \uD68C\uC6D0 \uC800\uC7A5 \uC9C1\uD6C4 \uC774\uC6A9\uAD8C POST \uC77C\uAD04 — \uC2B9\uC778 \uB300\uAE30 \uC5C6\uC774 \uC644\uB8CC\uB418\uBA74 \uB4F1\uB85D \uC644\uB8CC \uD1A0\uC2A4\uD2B8 1\uD68C
 */
async function assignProductsToMember(memberId, productIds, existingMemberProducts, options) {
    options = options || {};
    const afterRegistration = options.afterRegistration === true;
    App.log(`[assignProductsToMember] 시작 - memberId: ${memberId}, productIds:`, productIds, 'existingMemberProducts:', existingMemberProducts?.length ?? 0);
    try {
        const selectedSet = new Set(productIds.map(pid => String(pid)));
        let toAdd = productIds;
        let toRemove = [];

        if (existingMemberProducts && existingMemberProducts.length > 0) {
            const existingProductIds = new Set();
            toRemove = existingMemberProducts.filter(mp => {
                const pid = String(mp.product?.id || mp.productId || '');
                if (!pid) return false;
                existingProductIds.add(pid);
                return !selectedSet.has(pid);
            });
            toAdd = productIds.filter(pid => !existingProductIds.has(String(pid)));

            for (const mp of toRemove) {
                try {
                    await App.api.delete(`/member-products/${mp.id}`);
                    App.log(`[assignProductsToMember] 삭제: MemberProduct ID=${mp.id}, 상품 ID=${mp.product?.id || mp.productId}`);
                } catch (e) {
                    App.warn(`[assignProductsToMember] 삭제 실패 MemberProduct ID=${mp.id}:`, e);
                }
            }
            App.log(`[assignProductsToMember] 제거 ${toRemove.length}건, 신규 추가 ${toAdd.length}건`);
        } else {
            App.log('[assignProductsToMember] 기존 목록 없음 — 전체 삭제 후 재추가');
            await App.api.delete(`/members/${memberId}/products`);
        }

        const productCoachMap = {};
        const coachSelects = document.querySelectorAll('.product-coach-select');
        coachSelects.forEach((select) => {
            const productId = select.dataset.productId;
            const coachId = select.value;
            if (productId && coachId) productCoachMap[productId] = parseInt(coachId);
        });

        let pendingApprovalCount = 0;
        let pendingMessage = '';
        for (const productId of toAdd) {
            try {
                const requestData = {
                    productId: parseInt(productId),
                    productSelectionIntent: 'MEMBER_FORM'
                };
                if (productCoachMap[productId]) requestData.coachId = productCoachMap[productId];
                const postRes = await App.api.post(`/members/${memberId}/products`, requestData);
                if (postRes && postRes.pendingApproval) {
                    pendingApprovalCount++;
                    if (!pendingMessage && postRes.message) {
                        pendingMessage = postRes.message;
                    }
                }
                App.log(`[assignProductsToMember] 상품 ID ${productId} POST 완료`);
            } catch (error) {
                if (error.response && error.response.data) {
                    App.err('상품 배정 실패:', { productId, ...error.response.data });
                } else {
                    App.err('상품 배정 오류:', error);
                }
                throw error;
            }
        }
        const defaultPendingMsg = '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC774\uC6A9\uAD8C\uC774 \uBC18\uC601\uB429\uB2C8\uB2E4.';
        if (pendingApprovalCount > 0) {
            const base = pendingMessage || defaultPendingMsg;
            const suffix = pendingApprovalCount > 1 ? ' (\uC2B9\uC778 \uB300\uAE30 ' + pendingApprovalCount + '\uAC74)' : '';
            App.showNotification(base + suffix, 'info');
        } else if (afterRegistration && toAdd.length > 0) {
            App.showNotification(
                '\uD68C\uC6D0\uC774 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC774\uC6A9\uAD8C\uC774 \uBC30\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
                'success'
            );
        }
        return { pendingApprovalCount: pendingApprovalCount };
    } catch (error) {
        App.err('\uC0C1\uD488 \uBC30\uC815 \uC624\uB958:', error);
        App.showNotification('\uC0C1\uD488 \uBC30\uC815 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.', 'warning');
    }
    return { pendingApprovalCount: 0 };
}

async function deleteMember(id) {
    if (!App.currentUser || App.currentUser.role !== 'ADMIN') {
        App.showNotification('\uAD00\uB9AC\uC790\uB9CC \uD68C\uC6D0\uC744 \uC0AD\uC81C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.', 'danger');
        return;
    }
    
    if (!confirm('\uC774 \uD68C\uC6D0\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
    
    try {
        await App.api.delete(`/members/${id}`);
        App.showNotification('\uD68C\uC6D0\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        loadMembers();
    } catch (error) {
        App.err('\uD68C\uC6D0 \uC0AD\uC81C \uC624\uB958:', error);
        if (typeof App.showApiError === 'function') {
            App.showApiError(error);
        } else {
            const msg = error && error.response && error.response.data && (error.response.data.message || error.response.data.error);
            App.showNotification(msg || '\uD68C\uC6D0 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
        }
    }
}

async function deleteAllMembers() {
    if (!App.currentUser || App.currentUser.role !== 'ADMIN') {
        App.showNotification('\uAD00\uB9AC\uC790\uB9CC \uC804\uCCB4 \uC0AD\uC81C\uB97C \uC2E4\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.', 'danger');
        return;
    }
    
    const firstConfirm = confirm(
        '\uACBD\uACE0: \uBAA8\uB4E0 \uD68C\uC6D0\uC774 \uC601\uAD6C \uC0AD\uC81C\uB429\uB2C8\uB2E4!\n\n' +
        '\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.\n\n' +
        '\uC815\uB9D0\uB85C \uC9C4\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'
    );
    if (!firstConfirm) return;
    
    const secondConfirm = confirm(
        '\uCD5C\uC885 \uD655\uC778\n\n' +
        '\uC608\uC57D, \uACB0\uC81C, \uCD9C\uC11D, \uC774\uC6A9\uAD8C \uB4F1 \uBAA8\uB4E0 \uAD00\uB828 \uB370\uC774\uD130\uAC00 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.\n\n' +
        '\uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'
    );
    if (!secondConfirm) return;
    
    const finalConfirm = prompt('\uD655\uC778\uC744 \uC704\uD574 "DELETE ALL"\uC744 \uC815\uD655\uD788 \uC785\uB825\uD558\uC138\uC694:');
    if (finalConfirm !== 'DELETE ALL') {
        App.showNotification('\uC785\uB825\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0AD\uC81C\uAC00 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'warning');
        return;
    }
    
    try {
        App.showNotification('\uC804\uCCB4 \uC0AD\uC81C \uCC98\uB9AC \uC911...', 'info');
        await App.api.delete('/members/all');
        App.showNotification('\uBAA8\uB4E0 \uD68C\uC6D0\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        loadMembers();
    } catch (error) {
        App.err('\uC804\uCCB4 \uC0AD\uC81C \uC624\uB958:', error);
        App.showNotification('\uC804\uCCB4 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
    }
}

async function openMemberDetail(id) {
    try {
        ensureMemberDetailModals();
        const member = await App.api.get(`/members/${id}`);
        currentMemberDetail = member;
        const titleEl = document.getElementById('member-detail-title');
        if (titleEl) titleEl.textContent = `${member.name} \uC0C1\uC138 \uC815\uBCF4`;
        
        switchTab('info', member);
        App.Modal.open('member-detail-modal');
    } catch (error) {
        if (typeof App.showApiError === 'function') {
            App.showApiError(error);
        } else {
            App.showNotification('\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'danger');
        }
    }
}

function switchTab(tab, member = null) {
    document.querySelectorAll('#member-detail-modal .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    var modalBox = document.querySelector('#member-detail-modal .member-detail-modal-box');
    if (modalBox) modalBox.setAttribute('data-detail-tab', tab || '');
    if (!member && currentMemberDetail) {
        member = currentMemberDetail;
    }
    
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    
    switch(tab) {
        case 'info':
            content.innerHTML = renderMemberInfo(member);
            break;
        case 'timeline':
            if (member?.id) {
                loadMemberTimeline(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            }
            break;
        case 'products':
            if (member?.id) {
                loadMemberProductsForDetail(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            }
            break;
        case 'payments':
            if (member?.id) {
                loadMemberPayments(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            }
            break;
        case 'bookings':
            if (member?.id) {
                loadMemberBookings(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            }
            break;
        case 'attendance':
            if (member?.id) {
                loadMemberAttendance(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            }
            break;
        case 'product-history':
            if (member?.id) {
                loadMemberProductHistory(member.id);
            } else {
                content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
            }
            break;
        case 'stats':
            content.innerHTML = '<p class="member-stats-loading">\uAC1C\uC778 \uB2A5\uB825\uCE58\uB97C \uBD88\uB7EC\uC624\uB294 \uC911...</p>';
            if (member && member.id) {
                App.api.get('/members/' + member.id + '/ability-stats-context').then(function(ctx) {
                    content.innerHTML = renderMemberStats(member, ctx);
                    setupMemberStatsLegendToggles(content);
                    setupMemberStatsMemos(content, member);
                }).catch(function() {
                    content.innerHTML = renderMemberStats(member, null);
                    setupMemberStatsLegendToggles(content);
                    setupMemberStatsMemos(content, member);
                });
            } else {
                content.innerHTML = renderMemberStats(member, null);
                setupMemberStatsLegendToggles(content);
                setupMemberStatsMemos(content, member);
            }
            break;
        case 'memo':
            content.innerHTML = renderMemberMemo(member);
            setupMemberMemoTabSave(content, member);
            break;
    }
}

/** 0~7 단계 표시: 숫자면 "N단계", 문자면 상/중/하 그대로 */
function fmtStageDisplay(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    if (n >= 0 && n <= 7) return Math.round(n) + '\uB2E8\uACC4';
    return v;
}
function fmtLevelOrStage(s) {
    if (!s && s !== 0) return null;
    var u = String(s).toUpperCase();
    if (u === 'HIGH') return '\uC0C1';
    if (u === 'MID' || u === 'MIDDLE') return '\uC911';
    if (u === 'LOW') return '\uD558';
    if (/^[0-7]$/.test(String(s))) return String(s) + '\uB2E8\uACC4';
    return s;
}

/** 상세 모달 요약: 투수/타자/수비/포수 능력 칸 (회원 상세 탭) */
function renderMemberAbilitySummary(member) {
    if (!member) return '';
    var fmtNum = function(v) { return v != null && v !== '' ? Number(v) : null; };
    var run = fmtNum(member.runningSpeed);
    var pitcherItems = [
        { label: '\uD3EC\uC2EC', val: member.pitchingSpeed != null ? member.pitchingSpeed + ' km/h' : '-' },
        { label: '\uC81C\uAD6C', val: fmtLevelOrStage(member.pitcherControl) || '-' },
        { label: '\uBCC0\uD654\uAD6C', val: fmtLevelOrStage(member.pitcherBreakingBall) || '-' }
    ];
    var runB = run != null ? run : fmtNum(member.runningSpeed);
    var commonItems = [
        { label: '\uD30C\uC6CC', val: fmtStageDisplay(member.batterPower) || '-' },
        { label: '\uC8FC\uB8E8', val: fmtStageDisplay(runB) || (runB != null ? runB : '-') },
        { label: '\uC720\uC5F0\uC131', val: fmtStageDisplay(member.batterFlexibility) || '-' }
    ];
    var batterItems = [
        { label: '\uC2A4\uC719 \uC2A4\uD53C\uB4DC', val: member.swingSpeed != null ? member.swingSpeed + ' mph' : '-' },
        { label: 'Tee \uCD5C\uACE0 \uD0C0\uAD6C\uC18D', val: member.exitVelocity != null ? member.exitVelocity + ' km/h' : '-' }
    ];
    var defenseItems = [
        { label: '\uD578\uB4E4\uB9C1', val: member.defenseHandling != null ? (fmtStageDisplay(member.defenseHandling) || '-') : '-' },
        { label: '\uC2A4\uD15D', val: member.defenseStep != null ? (fmtStageDisplay(member.defenseStep) || '-') : '-' },
        { label: '\uC1A1\uAD6C(\uAC15\uB3C4)', val: member.defenseThrowing != null ? (fmtStageDisplay(member.defenseThrowing) || '-') : '-' },
        { label: '\uD034\uC2A4\uD15D', val: member.defenseQuickness != null ? (fmtStageDisplay(member.defenseQuickness) || '-') : '-' }
    ];
    var catcherItems = [
        { label: '\uBE14\uB85C\uD0B9', val: member.catcherBlocking != null ? (fmtStageDisplay(member.catcherBlocking) || '-') : '-' },
        { label: '\uC1A1\uAD6C(\uAC15\uB3C4)', val: member.catcherThrowing != null ? (fmtStageDisplay(member.catcherThrowing) || '-') : '-' },
        { label: '\uD504\uB808\uC774\uBC0D', val: member.catcherFraming != null ? (fmtStageDisplay(member.catcherFraming) || '-') : '-' }
    ];
    var row = function(items) {
        return items.map(function(p) {
            var v = p.val !== '-' && App.escapeHtml ? App.escapeHtml(String(p.val)) : (p.val !== '-' ? String(p.val) : '-');
            return '<span class="member-ability-item"><span class="member-ability-label">' + p.label + '</span> ' + (p.val !== '-' ? '<span class="member-ability-value">' + v + '</span>' : '-') + '</span>';
        }).join('');
    };
    return `
        <div class="form-row member-ability-summary-row">
            <div class="form-group member-ability-summary-col member-ability-summary-col-pitcher-common">
                <label class="form-label">\uD22C\uC218 \uB2A5\uB825</label>
                <div class="member-ability-summary-block">${row(pitcherItems)}</div>
                <label class="form-label" style="margin-top: 12px;">\uACF5\uD1B5</label>
                <div class="member-ability-summary-block">${row(commonItems)}</div>
            </div>
            <div class="form-group member-ability-summary-col">
                <label class="form-label">\uD0C0\uACA9 \uB2A5\uB825</label>
                <div class="member-ability-summary-block">${row(batterItems)}</div>
            </div>
            <div class="form-group member-ability-summary-col">
                <label class="form-label">\uC218\uBE44 \uB2A5\uB825</label>
                <div class="member-ability-summary-block">${row(defenseItems)}</div>
            </div>
            <div class="form-group member-ability-summary-col">
                <label class="form-label">\uD3EC\uC218 \uB2A5\uB825</label>
                <div class="member-ability-summary-block">${row(catcherItems)}</div>
            </div>
        </div>
    `;
}

function renderMemberInfo(member) {
    if (!member) return '<p>\uB85C\uB529 \uC911...</p>';
    const coachDisplay = getMemberCoachDisplayFromProducts(member);
    return `
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uC774\uB984</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${App.escapeHtml(member.name || '')}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uC804\uD654\uBC88\uD638</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${App.escapeHtml(member.phoneNumber || '')}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uD559\uAD50/\uC18C\uC18D</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${App.escapeHtml(member.school || '-')}</div>
            </div>
            <div class="form-group">
                <label class="form-label">\uB4F1\uAE09</label>
                <div class="form-control" style="background: var(--bg-tertiary);">${getGradeText(member.grade)}</div>
            </div>
        </div>
        ${renderMemberAbilitySummary(member)}
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uB2F4\uB2F9 \uCF54\uCE58</label>
                <div class="form-control" style="background: var(--bg-tertiary); white-space: pre-line; line-height: 1.6;">${coachDisplay}</div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">\uB204\uC801 \uACB0\uC81C</label>
                <div class="form-control" style="background: var(--bg-tertiary); font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(member.totalPayment || 0)}</div>
            </div>
        </div>
    `;
}

/** 회원 상세 모달에서 비동기 응답 시점에도 해당 탭이면 본문만 갱신 */
function isMemberDetailModalTab(expectedTab) {
    const box = document.querySelector('#member-detail-modal .member-detail-modal-box');
    return !!(box && box.getAttribute('data-detail-tab') === expectedTab);
}

async function loadMemberProductsForDetail(memberId) {
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    if (!memberId) {
        content.innerHTML = '<p style="color: var(--text-muted);">\uD68C\uC6D0 ID\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
    }
    try {
        const products = await App.api.get(`/member-products?memberId=${memberId}&forMemberDetailUi=true`);
        if (!isMemberDetailModalTab('products')) return;
        App.log('이용권 목록:', products);
        content.innerHTML = renderProductsList(products, memberId);
        if (typeof window.applyCoachNameColors === 'function') {
            window.applyCoachNameColors(content);
        }
    } catch (error) {
        if (!isMemberDetailModalTab('products')) return;
        App.err('이용권 로드 실패:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">\uC774\uC6A9\uAD8C \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

/** 공개 예약(회원번호) 읽기 전용 모드 */
function isPublicMemberBookingReadOnly() {
    try {
        const c = typeof window !== 'undefined' ? window.mbPublicBookingContext : null;
        return !!(c && c.memberId != null && c.memberNumber);
    } catch (e) {
        return false;
    }
}

/**
 * @param {Array} products GET /member-products 응답 (coachName·coach·product.coach 등)
 * @param {number|string|null} memberId
 */
function renderProductsList(products, memberId) {
    let list = App.filterMemberProductsForDisplayList
        ? App.filterMemberProductsForDisplayList(products || [], { applyEndedGraceFilter: false })
        : (products || []);
    if (typeof App.sortMemberProductsRemainingFirst === 'function' && list && list.length > 1) {
        list = App.sortMemberProductsRemainingFirst(list);
    }
    const hideProductActions = isPublicMemberBookingReadOnly();
    if (!list || list.length === 0) {
        return '<p style="color: var(--text-muted);">\uB4F1\uB85D\uB41C \uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    const extendBtn = !hideProductActions && (memberId != null && memberId !== '') ? `
                            <button class="btn btn-sm btn-primary" onclick="openExtendProductModal(${memberId})" title="\uC774\uC6A9\uAD8C \uC5F0\uC7A5" style="margin-right: 4px;">
                                \uC5F0\uC7A5
                            </button>
                        ` : '';
    return `
        <div class="product-list">
            ${list.map(p => {
                const product = p.product || {};
                const productName = product.name || '\uC0C1\uD488\uBA85 \uC5C6\uC74C';
                const status = p.status || 'UNKNOWN';
                
                let remaining = App.resolveDisplayRemainingCount(p, { whenAllUnknown: 'zero' });
                
                // 총 횟수: totalCount 없으면 product.usageCount
                let total = p.totalCount;
                if (total === null || total === undefined || total === 0) {
                    total = product.usageCount;
                }
                total = total !== null && total !== undefined ? total : 0;
                
                const expiryDate = p.expiryDate ? App.formatDate(p.expiryDate) : '-';
                const productId = p.id;
                const voucherNumber = p.voucherNumber || '';
                const isCountPass = product.type === 'COUNT_PASS';
                const isMonthlyPass = product.type === 'MONTHLY_PASS' || product.type === 'DAY_PASS';
                const isPeriodPass = isMonthlyPass || product.type === 'TIME_PASS';
                const graceExhausted =
                    typeof App.isActiveCountPassExhaustedForGrace === 'function' &&
                    App.isActiveCountPassExhaustedForGrace(p);
                const countPassExhaustedByUse =
                    isCountPass &&
                    status !== 'EXPIRED' &&
                    (remaining === 0 || status === 'USED_UP' || graceExhausted);
                const startDate = p.purchaseDate ? App.formatDate(p.purchaseDate.split('T')[0]) : '-';
                
                // 담당 코치 표시용 이름(서버에서 채움)
                const rawCoachName = getCoachNameForMemberProduct(p, null);
                const coachDisplay = rawCoachName
                    ? renderCoachNamesWithColorsFromText(rawCoachName)
                    : formatUnspecifiedCoachHtml();
                
                let remainingDisplay = '';
                let displayColor = 'var(--text-secondary)';
                
                if (p.packageItemsRemaining) {
                    try {
                        const packageItems = JSON.parse(p.packageItemsRemaining);
                        const itemsText = packageItems.map(item => `${item.name} ${item.remaining}\uD68C`).join(', ');
                        remainingDisplay = `<strong style="color: var(--accent-primary);">[\uD328\uD0A4\uC9C0]</strong> ${itemsText}`;
                    } catch (e) {
                        if (isCountPass) {
                            if (status === 'EXPIRED') {
                                displayColor = '#dc3545';
                                remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">\uB9CC\uB8CC</span>';
                            } else if (countPassExhaustedByUse) {
                                displayColor = '#dc3545'; // 소진 강조
                                remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">\uC804\uBD80 \uC18C\uC9C4</span>';
                            } else {
                                displayColor = getRemainingCountColor(remaining);
                                if (total > 0) {
                                    remainingDisplay = `\uC794\uC5EC: ${remaining}/${total}`;
                                } else {
                                    remainingDisplay = `\uC794\uC5EC: ${remaining}\uD68C`;
                                }
                            }
                        } else {
                            if (total > 0) {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}\uD68C`;
                            }
                        }
                    }
                } else {
                    if (isCountPass) {
                        if (status === 'EXPIRED') {
                            displayColor = '#dc3545';
                            remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">\uB9CC\uB8CC</span>';
                        } else if (countPassExhaustedByUse) {
                            displayColor = '#dc3545'; // 소진 강조
                            remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">\uC804\uBD80 \uC18C\uC9C4</span>';
                        } else {
                            displayColor = getRemainingCountColor(remaining);
                            if (total > 0) {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}\uD68C`;
                            }
                        }
                    } else if (isPeriodPass) {
                        if (status === 'EXPIRED') {
                            displayColor = '#dc3545';
                            remainingDisplay = '<span style="color: #dc3545; font-weight: 700;">\uAE30\uAC04 \uC885\uB8CC</span>';
                        } else if (p.expiryDate) {
                            displayColor = getExpiryDateColor(p.expiryDate);
                            if (total > 0) {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}\uD68C`;
                            }
                        } else {
                            if (total > 0) {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}/${total}`;
                            } else {
                                remainingDisplay = `\uC794\uC5EC: ${remaining}\uD68C`;
                            }
                        }
                    } else {
                        if (total > 0) {
                            remainingDisplay = `\uC794\uC5EC: ${remaining}/${total}`;
                        } else {
                            remainingDisplay = `\uC794\uC5EC: ${remaining}\uD68C`;
                        }
                    }
                }

                const voucherText = voucherNumber
                    ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">\uBC14\uC6B0\uCC98 \uBC88\uD638: ${App.escapeHtml ? App.escapeHtml(voucherNumber) : voucherNumber}</div>`
                    : '';

                let dbVerifyHtml = '';
                if (p.dbStatus != null || p.dbRemainingCount != null) {
                    const ds = p.dbStatus != null ? (App.escapeHtml ? App.escapeHtml(String(p.dbStatus)) : String(p.dbStatus)) : '\u2014';
                    const dr =
                        p.dbRemainingCount != null && p.dbRemainingCount !== ''
                            ? String(p.dbRemainingCount)
                            : '\u2014';
                    const pid = p.id != null ? String(p.id) : '\u2014';
                    dbVerifyHtml =
                        '<div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; line-height: 1.45; padding: 6px 8px; background: rgba(128,128,128,0.08); border-radius: 4px;" title="\uD654\uBA74 \uC794\uC5EC\uB294 MemberProductCountPassHelper \uB4F1 \uC870\uD68C \uADDC\uCE59 \uBC18\uC601\uAC12\uC785\uB2C8\uB2E4. USED_UP\uC774\uBA74 \uC794\uC5EC\uB294 \uD56D\uC0C1 0\uC73C\uB85C \uBCF4\uC5EC \uC9D1\uB2C8\uB2E4.">' +
                        '<strong style="color: var(--text-secondary);">DB \uD655\uC778</strong> \u00B7 \uC800\uC7A5 \uC0C1\uD0DC ' +
                        ds +
                        ' \u00B7 \uC800\uC7A5 \uC794\uC5EC ' +
                        dr +
                        '\uD68C \u00B7 \uC774\uC6A9\uAD8C ID ' +
                        pid +
                        '</div>';
                }

                let ledgerHtml = '';
                if (isCountPass && Array.isArray(p.ledgerLines) && p.ledgerLines.length > 0) {
                    const rows = p.ledgerLines.map(function (line) {
                        const lab = line.label != null ? String(line.label) : '';
                        const d = line.delta != null ? Number(line.delta) : 0;
                        const sign = d > 0 ? '+' : '';
                        const atStr = line.at
                            ? (typeof App.formatDateTime === 'function' ? App.formatDateTime(line.at) : String(line.at))
                            : '';
                        const escLab = App.escapeHtml ? App.escapeHtml(lab) : lab;
                        const escAt = App.escapeHtml ? App.escapeHtml(atStr) : atStr;
                        return '<div style="margin-top: 2px;">' + escLab + ' ' + sign + d + '\uD68C' + (atStr ? ' \u00B7 ' + escAt : '') + '</div>';
                    }).join('');
                    ledgerHtml =
                        '<div class="product-ledger-lines" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color);">' +
                        '<div style="font-weight: 600; margin-bottom: 4px; color: var(--text-muted); font-size: 11px;">\uC774\uC6A9\uAD8C \uBCC0\uB3D9 (\uCDA9\uC804/\uC5F0\uC7A5/\uC870\uC815)</div>' +
                        rows +
                        '</div>';
                }
                
                let periodInfo = '';
                if (isPeriodPass) {
                    if (p.expiryDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const expiry = new Date(p.expiryDate);
                        expiry.setHours(0, 0, 0, 0);
                        const remainingDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                        
                        if (remainingDays >= 0) {
                            periodInfo = ` | \uAD6C\uB9E4\uC77C: ${startDate} | \uB9CC\uB8CC\uC77C: ${expiryDate} (${remainingDays}\uC77C \uB0A8\uC74C)`;
                        } else {
                            periodInfo = ` | \uAD6C\uB9E4\uC77C: ${startDate} | \uB9CC\uB8CC\uC77C: ${expiryDate} (\uAE30\uAC04 \uC885\uB8CC)`;
                        }
                        displayColor = getExpiryDateColor(p.expiryDate);
                    } else {
                        periodInfo = ` | \uAD6C\uB9E4\uC77C: ${startDate} | \uB9CC\uB8CC\uC77C: -`;
                    }
                }
                
                const statusText = {
                    'ACTIVE': '\uD65C\uC131',
                    'EXPIRED': '\uB9CC\uB8CC',
                    'USED_UP': '\uC804\uBD80 \uC18C\uC9C4',
                    'INACTIVE': '\uBE44\uD65C\uC131'
                };
                const statusForBadge =
                    status === 'ACTIVE' && isCountPass && countPassExhaustedByUse
                        ? 'USED_UP'
                        : status;
                const statusDisplay = countPassExhaustedByUse
                    ? '\uB9C8\uAC10'
                    : (status === 'EXPIRED' && isPeriodPass
                        ? '\uAE30\uAC04 \uC885\uB8CC'
                        : (statusText[statusForBadge] || statusForBadge));

                return `
                <div class="product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border-color); gap: 12px;">
                    <div class="product-info" style="flex: 1;">
                        <div class="product-name" style="font-weight: 600; margin-bottom: 6px;">${productName}</div>
                        <div class="product-detail" style="font-size: 14px; color: ${displayColor}; font-weight: 600;">
                            ${remainingDisplay}${periodInfo}
                        </div>
                        ${voucherText}
                        ${dbVerifyHtml}
                        ${ledgerHtml}
                        <div class="product-coach" style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
                            \uB2F4\uB2F9 \uCF54\uCE58: ${coachDisplay}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${extendBtn}
                        <span class="badge badge-${statusForBadge === 'ACTIVE' ? 'success' : statusForBadge === 'EXPIRED' ? 'warning' : 'secondary'}">${statusDisplay}</span>
                        ${!hideProductActions && isCountPass ? `
                            <button class="btn btn-sm btn-secondary" onclick="openAdjustCountModal(${productId}, ${remaining}, ${total})" title="\uD69F\uC218 \uC870\uC815">
                                \uC870\uC815
                            </button>
                        ` : ''}
                        ${!hideProductActions && isMonthlyPass ? `
                            <button class="btn btn-sm btn-secondary" onclick="openEditPeriodPassModal(${productId}, '${p.purchaseDate?.split('T')[0] || ''}', '${p.expiryDate || ''}')" title="\uAE30\uAC04 \uC218\uC815">
                                \uAE30\uAC04 \uC218\uC815
                            </button>
                        ` : ''}
                        ${!hideProductActions ? `<button class="btn btn-sm btn-danger" onclick="deleteMemberProduct(${productId}, '${productName}')" title="\uC774\uC6A9\uAD8C \uC0AD\uC81C">
                            \uC0AD\uC81C
                        </button>` : ''}
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
}

//    window  
window.renderProductsList = renderProductsList;
window.getRemainingCountColor = getRemainingCountColor;
window.getExpiryDateColor = getExpiryDateColor;
window.applyCoachNameColors = applyCoachNameColors;
window.getMemberCoachDisplayFromProducts = getMemberCoachDisplayFromProducts;

//     (   )
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
                node.style.setProperty('color', color);
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
        const colonIdx = text.indexOf(':');
        if (colonIdx < 0) {
            return;
        }
        const label = text.slice(0, colonIdx).trim() || '담당 코치';
        const rawCoachText = text.slice(colonIdx + 1).trim();
        if (!rawCoachText) {
            return;
        }
        const rendered = renderCoachNamesWithColorsFromText(rawCoachText);
        node.innerHTML = `${label}: ${rendered}`;
    });
}

async function openAdjustCountModal(productId, currentRemaining, currentTotal) {
    document.getElementById('adjust-product-id').value = productId;
    document.getElementById('adjust-current-count').textContent = `\uD604\uC7AC \uC794\uC5EC: ${currentRemaining}\uD68C`;
    document.getElementById('adjust-current-total').textContent = currentTotal != null && currentTotal !== undefined ? String(currentTotal) + '\uD68C' : '-';
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-total').value = currentTotal != null && currentTotal !== undefined ? String(currentTotal) : '';
    App.Modal.open('adjust-count-modal');
}

// 횟수 조정: 정수만 허용 (부호는 상대 모드에서만)
const NUMERIC_ONLY_MSG = '\uC22B\uC790\uB9CC \uC785\uB825\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
function isStrictUnsignedIntString(s) {
    const t = String(s).trim();
    return t !== '' && /^\d+$/.test(t);
}
function isStrictSignedIntString(s) {
    const t = String(s).trim();
    return t !== '' && /^-?\d+$/.test(t) && t !== '-';
}

async function processAdjustCount() {
    const productId = document.getElementById('adjust-product-id').value;
    const amountInputRaw = document.getElementById('adjust-amount').value;
    const totalInput = document.getElementById('adjust-total').value;
    const adjustMode = document.querySelector('input[name="adjust-mode"]:checked').value;
    const currentCount = parseInt(document.getElementById('adjust-current-count').textContent.replace(/[^0-9]/g, '')) || 0;
    
    const amountInput = amountInputRaw ? amountInputRaw.trim() : '';
    
    try {
        let result;
        
        let mode = adjustMode;
        if (totalInput && totalInput.trim() !== '' && mode === 'relative') {
            mode = 'absolute';
        }

        if (mode === 'absolute') {
            if ((!amountInput || amountInput === '') && (!totalInput || totalInput.trim() === '')) {
                App.showNotification('\uC794\uC5EC \uD69F\uC218\uC640 \uCD1D \uD69F\uC218 \uC911 \uD558\uB098 \uC774\uC0C1 \uC785\uB825\uD574 \uC8FC\uC138\uC694.', 'warning');
                return;
            }

            let effectiveCount;
            if (!amountInput || amountInput === '') {
                effectiveCount = currentCount;
            } else {
                if (!isStrictUnsignedIntString(amountInput)) {
                    App.showNotification(NUMERIC_ONLY_MSG, 'warning');
                    return;
                }
                const parsed = parseInt(amountInput, 10);
                if (parsed < 0) {
                    App.showNotification('\uC794\uC5EC \uD69F\uC218\uB294 0 \uC774\uC0C1\uC758 \uC815\uC218\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.', 'warning');
                    return;
                }
                effectiveCount = parsed;
            }

            let totalPayload = null;
            if (totalInput && totalInput.trim() !== '') {
                if (!isStrictUnsignedIntString(totalInput)) {
                    App.showNotification(NUMERIC_ONLY_MSG, 'warning');
                    return;
                }
                const totalVal = parseInt(totalInput.trim(), 10);
                if (totalVal <= 0) {
                    App.showNotification('\uCD1D \uD69F\uC218\uB294 1 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.', 'warning');
                    return;
                }
                totalPayload = totalVal;
            }
            
            result = await App.api.put(`/member-products/${productId}/set-count`, {
                count: effectiveCount,
                total: totalPayload
            });
        } else {
            if (!amountInput || amountInput === '') {
                App.showNotification('\uBCC0\uB3D9\uB7C9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694. (\uC608: +1, -2)', 'warning');
                return;
            }
            if (!isStrictSignedIntString(amountInput)) {
                App.showNotification(NUMERIC_ONLY_MSG, 'warning');
                return;
            }
            const inputValue = parseInt(amountInput.trim(), 10);
            if (Number.isNaN(inputValue)) {
                App.showNotification(NUMERIC_ONLY_MSG, 'warning');
                return;
            }
            if (inputValue === 0) {
                App.showNotification('0\uC740 \uC785\uB825\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. (\uC591\uC218/\uC74C\uC218 \uC911 \uD558\uB098)', 'warning');
                return;
            }

            result = await App.api.put(`/member-products/${productId}/adjust-count`, {
                amount: inputValue
            });
        }
        
        App.showNotification(result.message || '\uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        App.Modal.close('adjust-count-modal');
        
        if (currentMemberDetail && currentMemberDetail.id) {
            loadMemberProductsForDetail(currentMemberDetail.id);
            const activeTab = document.querySelector('#member-detail-modal .tab-btn.active');
            if (activeTab && activeTab.getAttribute('data-tab') === 'product-history') {
                loadMemberProductHistory(currentMemberDetail.id);
            }
        }
        
        loadMembers();
    } catch (error) {
        const serverErr = error && error.response && error.response.data && error.response.data.error;
        const msg = serverErr || (error && error.message) || '\uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.';
        App.showNotification(typeof msg === 'string' ? msg : '\uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
    }
}

/** 시작일 기준 종료일 자동 (+30일) */
function autoCalculateEndDate() {
    const startDateInput = document.getElementById('edit-period-start-date');
    const endDateInput = document.getElementById('edit-period-end-date');
    
    if (!startDateInput || !endDateInput) {
        App.log('기간 편집: 시작일 입력 없음');
        return;
    }
    
    const value = startDateInput.value;
    App.log('기간 편집 시작일:', value);
    
    if (value && value.length >= 10) {
        try {
            const start = new Date(value);
            if (!isNaN(start.getTime())) {
                const end = new Date(start);
                end.setDate(end.getDate() + 30);
                
                const endDateStr = end.toISOString().split('T')[0];
                endDateInput.value = endDateStr;
                App.log('기간 편집 종료일:', endDateStr);
            } else {
                App.log('시작일 파싱 실패');
            }
        } catch (e) {
            App.err('종료일 계산 오류:', e);
        }
    }
}

async function openEditPeriodPassModal(productId, startDate, endDate) {
    document.getElementById('edit-period-product-id').value = productId;
    document.getElementById('edit-period-start-date').value = startDate || '';
    document.getElementById('edit-period-end-date').value = endDate || '';
    
    App.Modal.open('edit-period-pass-modal');
    
    setTimeout(() => {
        const startDateInput = document.getElementById('edit-period-start-date');
        if (startDateInput) {
            App.log('기간 편집: 시작일 input 바인딩');
            
            startDateInput.onchange = null;
            startDateInput.oninput = null;
            
            startDateInput.addEventListener('change', function() {
                App.log('기간 편집 change');
                autoCalculateEndDate();
            });
            
            startDateInput.addEventListener('input', function() {
                App.log('기간 편집 input');
                autoCalculateEndDate();
            });
            
            startDateInput.addEventListener('click', function() {
                App.log('기간 편집 시작일 클릭');
                setTimeout(() => {
                    if (this.value) {
                        App.log('기간 편집: 값 있음, 종료일 갱신');
                        autoCalculateEndDate();
                    }
                }, 50);
            });
            
            if (startDateInput.value) {
                App.log('기간 편집: 초기 값 있음, 종료일 계산');
                autoCalculateEndDate();
            }
        } else {
            App.err('기간 편집: 시작일 input 없음');
        }
    }, 100);
}

async function processEditPeriodPass() {
    const productId = document.getElementById('edit-period-product-id').value;
    const startDate = document.getElementById('edit-period-start-date').value;
    const endDate = document.getElementById('edit-period-end-date').value;
    
    if (!startDate || !endDate) {
        App.showNotification('\uC2DC\uC791\uC77C\uACFC \uC885\uB8CC\uC77C\uC744 \uBAA8\uB450 \uC785\uB825\uD574 \uC8FC\uC138\uC694.', 'warning');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        App.showNotification('\uC885\uB8CC\uC77C\uC740 \uC2DC\uC791\uC77C \uC774\uD6C4\uC5EC\uC57C \uD569\uB2C8\uB2E4.', 'warning');
        return;
    }
    
    try {
        const result = await App.api.put(`/member-products/${productId}/update-period`, {
            startDate: startDate,
            endDate: endDate
        });
        
        App.showNotification(result.message || '\uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        App.Modal.close('edit-period-pass-modal');
        
        if (currentMemberDetail && currentMemberDetail.id) {
            loadMemberProductsForDetail(currentMemberDetail.id);
        }
        
        loadMembers();
    } catch (error) {
        App.showNotification('\uAE30\uAC04 \uC218\uC815\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
    }
}

async function loadMemberPayments(memberId) {
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    try {
        const payments = await App.api.get(`/members/${memberId}/payments`);
        if (!isMemberDetailModalTab('payments')) return;
        content.innerHTML = renderPaymentsList(payments);
    } catch (error) {
        if (!isMemberDetailModalTab('payments')) return;
        App.err('\uACB0\uC81C \uB0B4\uC5ED \uB85C\uB529 \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">\uACB0\uC81C \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

/** \uD68C\uC6D0 \uC0C1\uC138 \uACB0\uC81C \uD14C\uC774\uBE14: \uACB0\uC81C\uC5D0 \uC5F0\uACB0\uB41C \uC774\uC6A9\uAD8C(ID) \uD45C\uC2DC */
function formatPaymentMemberProductLinkCell(p) {
    var mp = p && p.memberProduct;
    if (mp && mp.id != null) {
        if (mp.deletedAt) {
            return '<span style="color:var(--warning);" title="\uC0AD\uC81C\uB41C \uC774\uC6A9\uAD8C \uD589\">\uC0AD\uC81C\uB428 #' + mp.id + '</span>';
        }
        return '<span style="color:var(--success);" title="\uC774\uC6A9\uAD8C \uC5F0\uACB0\uB428">#' + mp.id + '</span>';
    }
    var isProductSale = p && p.category === 'PRODUCT_SALE';
    if (isProductSale) {
        return '<span style="color:var(--danger);" title="\uC0C1\uD488\uD310\uB9E4 \uACB0\uC81C\uC778\uB370 member_product\uC5D0 \uC5F0\uACB0\uB41C \uD589\uC774 \uC5C6\uC74C">\uBBF8\uC5F0\uACB0</span>';
    }
    return '<span style="color:var(--text-muted);">\u2014</span>';
}

function renderPaymentsList(payments) {
    if (!payments || payments.length === 0) {
        return '<p style="text-align: center; color: var(--text-muted); padding: 40px;">\uACB0\uC81C \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    
    function getPaymentMethodText(method) {
        const methodMap = {
            'CASH': '\uD604\uAE08',
            'CARD': '\uCE74\uB4DC',
            'BANK_TRANSFER': '\uACC4\uC88C\uC774\uCCB4',
            'EASY_PAY': '\uAC04\uD3B8\uACB0\uC81C'
        };
        return methodMap[method] || method;
    }
    
    function getCategoryText(category) {
        const categoryMap = {
            'RENTAL': '\uB300\uC5EC',
            'LESSON': '\uB808\uC2A8',
            'PRODUCT_SALE': '\uC0C1\uD488\uD310\uB9E4'
        };
        return categoryMap[category] || category;
    }
    
    function getStatusText(status) {
        const statusMap = {
            'COMPLETED': '\uC644\uB8CC',
            'PARTIAL': '\uBD80\uBD84',
            'REFUNDED': '\uD658\uBD88'
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
                        <th>\uACB0\uC81C\uC77C\uC2DC</th>
                        <th>\uC0C1\uD488</th>
                        <th>\uBD84\uB958</th>
                        <th>\uC774\uC6A9\uAD8C \uC5F0\uACB0</th>
                        <th>\uB2F4\uB2F9 \uCF54\uCE58</th>
                        <th>\uACB0\uC81C\uC218\uB2E8</th>
                        <th>\uAE08\uC561</th>
                        <th>\uC0C1\uD0DC</th>
                        <th>\uBE44\uACE0</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => {
                        const paidAt = p.paidAt ? App.formatDateTime(p.paidAt) : '-';
                        const productName = p.product?.name || '-';
                        const category = getCategoryText(p.category);
                        const mpLink = formatPaymentMemberProductLinkCell(p);
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
                            <td>${mpLink}</td>
                            <td>${coachName}</td>
                            <td>${method}</td>
                            <td style="font-weight: 600; color: var(--accent-primary);">
                                ${amount}
                                ${refundAmount > 0 ? `<br><small style="color: var(--danger);">\uD658\uBD88: ${App.formatCurrency(refundAmount)}</small>` : ''}
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

//    window  
window.openMemberDetail = openMemberDetail;
window.openAdjustCountModal = openAdjustCountModal;
window.openEditPeriodPassModal = openEditPeriodPassModal;
window.deleteMemberProduct = deleteMemberProduct;

async function deleteMemberProduct(memberProductId, productName) {
    if (!confirm(
        '"' + productName + '" \uC774\uC6A9\uAD8C\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\n' +
        '\uC8FC\uC758: \uAD00\uB828 \uC608\uC57D\uC774 \uC788\uC73C\uBA74 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
    )) {
        return;
    }
    
    try {
        const response = await App.api.delete(`/member-products/${memberProductId}`);
        
        if (response && response.success) {
            App.showNotification('\uC774\uC6A9\uAD8C\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
            
            //    (   )
            if (typeof loadMembers === 'function') {
                loadMembers();
            }
            
            const memberDetailModal = document.getElementById('member-detail-modal');
            if (memberDetailModal && memberDetailModal.style.display !== 'none' && currentMemberDetail) {
                loadMemberProductsForDetail(currentMemberDetail.id);
            }
            
            const memberModal = document.getElementById('member-modal');
            if (memberModal && memberModal.style.display === 'flex' && currentEditingMember) {
                if (typeof loadMemberProducts === 'function') {
                    loadMemberProducts(currentEditingMember.id);
                }
            }
        } else {
            App.showNotification(response?.error || '\uC774\uC6A9\uAD8C \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
        }
    } catch (error) {
        App.err('\uC774\uC6A9\uAD8C \uC0AD\uC81C \uC624\uB958:', error);
        const errorMsg = error.response?.data?.error || '\uC774\uC6A9\uAD8C \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.';
        App.showNotification(errorMsg, 'danger');
    }
}

async function loadMemberBookings(memberId) {
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    try {
        const bookings = await App.api.get(`/members/${memberId}/bookings`);
        if (!isMemberDetailModalTab('bookings')) return;
        content.innerHTML = renderBookingsList(bookings);
        if (typeof window.applyCoachNameColors === 'function') {
            window.applyCoachNameColors(content);
        }
    } catch (error) {
        if (!isMemberDetailModalTab('bookings')) return;
        content.innerHTML = '<p style="color: var(--text-muted);">\uC608\uC57D \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

function renderBookingsList(bookings) {
    if (!bookings || bookings.length === 0) {
        return '<p style="color: var(--text-muted);">\uC608\uC57D \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    
    function getBookingStatusText(status) {
        const statusMap = {
            'PENDING': '\uB300\uAE30',
            'CONFIRMED': '\uD655\uC815',
            'CANCELLED': '\uCDE8\uC18C',
            'NO_SHOW': '\uB178\uC1FC',
            'COMPLETED': '\uC644\uB8CC'
        };
        return statusMap[status] || status;
    }
    
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
                        <th>\uC608\uC57D ID</th>
                        <th>\uC774\uC6A9\uAD8C/\uC0C1\uD488</th>
                        <th>\uCF54\uCE58</th>
                        <th>\uC2DC\uC124</th>
                        <th>\uC2DC\uC791/\uC885\uB8CC</th>
                        <th>\uC0C1\uD0DC</th>
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
    if (!content) return;
    try {
        const attendance = await App.api.get(`/members/${memberId}/attendance`);
        if (!isMemberDetailModalTab('attendance')) return;
        content.innerHTML = renderAttendanceList(attendance);
    } catch (error) {
        if (!isMemberDetailModalTab('attendance')) return;
        content.innerHTML = '<p style="color: var(--text-muted);">\uCD9C\uC11D \uB0B4\uC5ED\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

function renderAttendanceList(attendance) {
    if (!attendance || attendance.length === 0) {
        return '<p style="color: var(--text-muted);">\uCD9C\uC11D \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    
    function getAttendanceStatusText(status) {
        const statusMap = {
            'PRESENT': '\uCD9C\uC11D',
            'ABSENT': '\uACB0\uC11D',
            'LATE': '\uC9C0\uAC01',
            'NO_SHOW': '\uB178\uC1FC'
        };
        return statusMap[status] || status;
    }
    
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
                        <th>\uC77C\uC790</th>
                        <th>\uC2DC\uC124</th>
                        <th>\uC785\uC7A5 \uC2DC\uAC01</th>
                        <th>\uD1F4\uC7A5 \uC2DC\uAC01</th>
                        <th>\uC774\uC6A9\uAD8C \uC815\uBCF4</th>
                        <th>\uC0C1\uD0DC</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendance.map(a => {
                        const facilityName = a.facility?.name || a.facilityName || '-';
                        const date = a.date ? App.formatDate(a.date) : '-';
                        const checkInTime = a.checkInTime ? App.formatDateTime(a.checkInTime) : (a.status === 'PRESENT' ? '<span style="color: var(--text-muted);">\uAE30\uB85D \uC5C6\uC74C</span>' : '-');
                        const checkOutTime = a.checkOutTime ? App.formatDateTime(a.checkOutTime) : (a.checkInTime ? '<span style="color: var(--text-muted);">\uAE30\uB85D \uC5C6\uC74C</span>' : '-');
                        const status = a.status || 'UNKNOWN';
                        const statusText = getAttendanceStatusText(status);
                        const statusBadge = getAttendanceStatusBadge(status);
                        
                        let productInfo = '-';
                        if (a.productHistory) {
                            const productName = a.productHistory.productName || '\uC0C1\uD488\uBA85 \uC5C6\uC74C';
                            const changeAmount = a.productHistory.changeAmount || 0;
                            const remaining = a.productHistory.remainingCountAfter || 0;
                            if (changeAmount < 0) {
                                productInfo = `${productName} ${changeAmount} (\uC794\uC5EC: ${remaining}\uD68C)`;
                            } else {
                                productInfo = `${productName} +${changeAmount} (\uC794\uC5EC: ${remaining}\uD68C)`;
                            }
                        } else if (a.booking?.memberProduct) {
                            const productName = a.booking.memberProduct.product?.name || '\uC0C1\uD488\uBA85 \uC5C6\uC74C';
                            productInfo = `${productName} (\uC608\uC57D)`;
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

/** 회원 타임라인(상세 모달 탭) */
async function loadMemberTimeline(memberId) {
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uBD88\uB7EC\uC624\uB294 \uC911...</p>';
    try {
        const events = await App.api.get(`/members/${memberId}/timeline`);
        if (!isMemberDetailModalTab('timeline')) return;
        content.innerHTML = renderMemberTimelineContent(events, memberId);
    } catch (error) {
        if (!isMemberDetailModalTab('timeline')) return;
        App.err('\uD0C0\uC784\uB77C\uC778 \uB85C\uB529 \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">\uD0C0\uC784\uB77C\uC778\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

function renderMemberTimelineContent(events, memberId) {
    const hideTimelineDelete = isPublicMemberBookingReadOnly();
    if (!events || events.length === 0) {
        return `
        <div class="card">
            <div class="card-header"><h3 class="card-title">\uD68C\uC6D0 \uD788\uC2A4\uD1A0\uB9AC</h3></div>
            <div class="card-body">
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">\uAC00\uC785, \uACB0\uC81C, \uC608\uC57D, \uCD9C\uC11D, \uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uB0B4\uC5ED\uC744 \uC21C\uCC28\uC801\uC73C\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>
                <p style="text-align: center; color: var(--text-muted); padding: 24px;">\uD45C\uC2DC\uD560 \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
            </div>
        </div>`;
    }
    const badgeMap = {
        SIGNUP: { text: '\uD68C\uC6D0 \uAC00\uC785', class: 'primary' },
        PAYMENT: { text: '\uAD6C\uB9E4', class: 'success' },
        BOOKING: { text: '\uC608\uC57D', class: 'booking' },
        CHECKIN: { text: '\uCD9C\uC11D', class: 'warning' },
        PRODUCT_HISTORY: { text: '\uC774\uC6A9\uAD8C', class: 'secondary' }
    };
    const greenStyle = 'color: var(--success, #198754); font-weight: 600;';
    const timelineTimeMs = function(ev) {
        if (!ev || ev.date == null) return 0;
        if (typeof App.parseFlexibleDate === 'function') {
            const parsed = App.parseFlexibleDate(ev.date);
            if (parsed && !isNaN(parsed.getTime())) return parsed.getTime();
        }
        const fallback = new Date(ev.date);
        return isNaN(fallback.getTime()) ? 0 : fallback.getTime();
    };
    const orderedEvents = events.slice().sort(function(a, b) {
        return timelineTimeMs(b) - timelineTimeMs(a);
    });
    const rows = orderedEvents.map(ev => {
        const date = ev.date ? App.formatDateTime(ev.date) : '-';
        const badge = badgeMap[ev.eventType];
        const badgeClass = ev.eventType === 'PRODUCT_HISTORY'
            ? (ev.label === '\uCC28\uAC10' ? 'danger' : ev.label === '\uCDA9\uC804' ? 'charge' : 'warning')
            : (badge ? badge.class : 'secondary');
        const badgeText = ev.label || (badge ? badge.text : ev.eventType) || '-';
        let detail = (ev.detail || ev.description || '').toString();
        let remaining = '';
        if (ev.eventType === 'CHECKIN') {
            const recorded = ev.remainingAfter != null ? Number(ev.remainingAfter) : null;
            const corrected = ev.remainingAfterCorrected != null ? Number(ev.remainingAfterCorrected) : null;
            if (corrected != null && corrected !== recorded) {
                detail = (ev.facilityName || '') + (ev.productName ? ' / ' + ev.productName : '') + ' / \uC794\uC5EC \uD69F\uC218 ' + (recorded != null ? recorded + '\uD68C' : '-') + ' -> <span class="timeline-change" style="' + greenStyle + '">' + corrected + '\uD68C</span> (\uAD50\uC815 \uC801\uC6A9)';
            } else if (corrected != null || recorded != null) {
                const val = corrected != null ? corrected : recorded;
                detail = (ev.facilityName || '') + (ev.productName ? ' / ' + ev.productName : '') + ' / \uC794\uC5EC \uD69F\uC218 <span class="timeline-change" style="' + greenStyle + '">' + val + '\uD68C</span>';
            }
        } else {
            if (ev.remainingAfter != null && detail.indexOf('\uC794\uC5EC') === -1) {
                remaining = ' / \uC794\uC5EC <span class="timeline-change" style="' + greenStyle + '">' + ev.remainingAfter + '\uD68C</span>';
            }
        }
        let descLine = (ev.description && (ev.eventType === 'PRODUCT_HISTORY' || ev.eventType === 'CHECKIN')) ? ev.description : '';
        descLine = descLine ? '<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">' + descLine + '</div>' : '';
        const processedByLine = (ev.processedBy && String(ev.processedBy).trim()) ? '<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">\uCC98\uB9AC\uC790: ' + (App.escapeHtml ? App.escapeHtml(ev.processedBy) : ev.processedBy) + '</div>' : '';
        const hasHistoryId = ev.historyId != null;
        var checkCellInner = '';
        if (!hideTimelineDelete && hasHistoryId) {
            checkCellInner = '<span class="timeline-entry-check-wrap" style="display: none;"><label style="margin: 0; cursor: pointer;"><input type="checkbox" class="timeline-entry-checkbox" data-history-id="' + ev.historyId + '"></label></span>';
        }
        const checkCol = hideTimelineDelete ? '' : '<div style="width: 28px; min-width: 28px; flex-shrink: 0;">' + checkCellInner + '</div>';
        return `
        <div class="timeline-row" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border-color, #2D3441);">
            ${checkCol}
            <div style="width: 165px; min-width: 165px; flex-shrink: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${date}</div>
            <div style="width: 80px; min-width: 80px; flex-shrink: 0;"><span class="badge badge-${badgeClass}">${badgeText}</span></div>
            <div style="flex: 1; min-width: 0; font-size: 13px; line-height: 1.4; text-align: left;">
                <div>${detail || '-'} ${remaining}</div>
                ${descLine}
                ${processedByLine}
            </div>
        </div>`;
    }).join('');
    const deleteBtnHtml = memberId && !hideTimelineDelete
        ? '<button type="button" id="timeline-delete-btn" class="btn btn-sm btn-danger" onclick="toggleTimelineSelectOrDelete(' + memberId + ')" style="margin-left: auto;">\uC120\uD0DD \uC0AD\uC81C</button>'
        : '';
    const timelineHelpHtml = hideTimelineDelete
        ? '<p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">\uAC00\uC785, \uACB0\uC81C, \uC608\uC57D, \uCD9C\uC11D, \uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uB0B4\uC5ED\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.</p>'
        : '<p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">\uAC00\uC785, \uACB0\uC81C, \uC608\uC57D, \uCD9C\uC11D, \uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uB0B4\uC5ED\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4. <strong>\uC120\uD0DD \uC0AD\uC81C</strong>\uB85C \uC120\uD0DD\uD55C \uC774\uB825\uC744 \uC77C\uAD04 \uC0AD\uC81C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>';
    return `
        <div class="card">
            <div class="card-header" style="display: flex; align-items: center; flex-wrap: wrap;">
                <h3 class="card-title">\uD68C\uC6D0 \uD788\uC2A4\uD1A0\uB9AC</h3>
                ${deleteBtnHtml}
            </div>
            <div class="card-body">
                ${timelineHelpHtml}
                <div class="member-timeline-list" style="max-height: 60vh; overflow-y: auto;">
                    ${rows}
                </div>
            </div>
        </div>
        <style>.member-timeline-list.timeline-select-mode .timeline-entry-check-wrap { display: inline-block !important; }</style>`;
}

/** 타임라인 선택 삭제: 첫 클릭 모드 전환, 재클릭 시 삭제 */
async function toggleTimelineSelectOrDelete(memberId) {
    if (isPublicMemberBookingReadOnly()) return;
    const list = document.querySelector('#detail-tab-content .member-timeline-list');
    const btn = document.getElementById('timeline-delete-btn');
    if (!list) return;

    if (list.classList.contains('timeline-select-mode')) {
        const checkboxes = document.querySelectorAll('.member-timeline-list .timeline-entry-checkbox:checked');
        if (!checkboxes || checkboxes.length === 0) {
            App.showNotification('\uC0AD\uC81C\uD560 \uD56D\uBAA9\uC744 \uD558\uB098 \uC774\uC0C1 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.', 'warning');
            return;
        }
        const historyIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-history-id')).filter(Boolean).map(Number);
        if (historyIds.length === 0) {
            App.showNotification('\uC0AD\uC81C\uD560 \uD56D\uBAA9\uC744 \uD558\uB098 \uC774\uC0C1 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.', 'warning');
            return;
        }
        if (!confirm('\uC120\uD0DD\uD55C ' + historyIds.length + '\uAC1C \uC774\uB825\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
        try {
            const res = await App.api.delete(`/members/${memberId}/timeline-entries?historyIds=${historyIds.join(',')}`);
            const deleted = (res && res.deletedCount != null) ? res.deletedCount : 0;
            App.showNotification((res && res.message) || deleted + '\uAC1C \uD56D\uBAA9\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.', 'success');
            if (deleted > 0) loadMemberTimeline(memberId);
        } catch (error) {
            App.showNotification(error?.response?.data?.error || '\uC774\uB825 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
        }
        return;
    }

    list.classList.add('timeline-select-mode');
    if (btn) btn.textContent = '\uC120\uD0DD \uD655\uC815 \uC0AD\uC81C';
    App.showNotification('\uC0AD\uC81C\uD560 \uD56D\uBAA9\uC744 \uC120\uD0DD\uD55C \uB4A4 "\uC120\uD0DD \uD655\uC815 \uC0AD\uC81C"\uB97C \uB204\uB974\uC138\uC694.', 'info');
}

async function loadMemberProductHistory(memberId) {
    const content = document.getElementById('detail-tab-content');
    if (!content) return;
    content.innerHTML = '<p style="text-align: center; color: var(--text-muted);">\uBD88\uB7EC\uC624\uB294 \uC911...</p>';
    
    try {
        const [products, history] = await Promise.all([
            App.api.get(`/members/${memberId}/products`),
            App.api.get(`/members/${memberId}/product-history`)
        ]);
        if (!isMemberDetailModalTab('product-history')) return;
        content.innerHTML = renderPurchaseHistorySection(products) + renderProductHistory(history);
    } catch (error) {
        if (!isMemberDetailModalTab('product-history')) return;
        App.err('\uC774\uC6A9\uAD8C \uC774\uB825 \uB85C\uB529 \uC624\uB958:', error);
        content.innerHTML = '<p style="color: var(--text-muted);">\uC774\uC6A9\uAD8C \uC774\uB825\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
}

/** 구매/변경 이력 상단 카드 (상품 목록 + 상태) */
function renderPurchaseHistorySection(products) {
    if (!products || products.length === 0) {
        return `
        <div class="card" style="margin-bottom: 20px;">
            <div class="card-header"><h3 class="card-title">\uC774\uC6A9\uAD8C \uAD6C\uB9E4/\uC885\uB8CC \uC774\uB825</h3></div>
            <div class="card-body">
                <p style="text-align: center; color: var(--text-muted); padding: 24px;">\uB4F1\uB85D\uB41C \uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
            </div>
        </div>`;
    }
    const statusLabelForHistory = (mp) => {
        const s = mp.status;
        const pt = (mp.product && mp.product.type) || '';
        if (s === 'EXPIRED' && (pt === 'MONTHLY_PASS' || pt === 'DAY_PASS' || pt === 'TIME_PASS')) {
            return '\uAE30\uAC04 \uC885\uB8CC';
        }
        return ({ 'ACTIVE': '\uC774\uC6A9\uC911', 'EXPIRED': '\uB9CC\uB8CC', 'USED_UP': '\uC18C\uC9C4' }[s] || s || '-');
    };
    const sorted = [...products].sort((a, b) => {
        const d1 = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        const d2 = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        return d2 - d1;
    });
    const rows = sorted.map(p => {
        const product = p.product || {};
        const name = product.name || '\uC774\uB984 \uC5C6\uC74C';
        const type = getProductTypeText(product.type) || '-';
        const purchaseDate = p.purchaseDate ? App.formatDateTime(p.purchaseDate) : '-';
        const status = statusLabelForHistory(p);
        const statusBadge = p.status === 'ACTIVE' ? 'success' : (p.status === 'USED_UP' ? 'warning' : 'secondary');
        let endDisplay = '-';
        if ((product.type === 'MONTHLY_PASS' || product.type === 'DAY_PASS' || product.type === 'TIME_PASS') && p.expiryDate) {
            endDisplay = App.formatDate(p.expiryDate) + ' (\uB9CC\uB8CC\uC77C)';
        } else if (p.status === 'USED_UP') {
            endDisplay = '\uC804\uBD80 \uC18C\uC9C4';
        } else if (p.status === 'EXPIRED') {
            if (product.type === 'MONTHLY_PASS' || product.type === 'DAY_PASS' || product.type === 'TIME_PASS') {
                endDisplay = p.expiryDate
                    ? App.formatDate(p.expiryDate) + ' \uAE30\uAC04 \uC885\uB8CC'
                    : '\uAE30\uAC04 \uC885\uB8CC';
            } else {
                endDisplay = p.expiryDate ? App.formatDate(p.expiryDate) + ' \uB9CC\uB8CC' : '\uB9CC\uB8CC';
            }
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
        <div class="card-header"><h3 class="card-title">\uC774\uC6A9\uAD8C \uAD6C\uB9E4/\uC885\uB8CC \uC774\uB825</h3></div>
        <div class="card-body">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">\uAC01 \uC774\uC6A9\uAD8C\uC758 \uAD6C\uB9E4\uC77C\uC790\uC640 \uC885\uB8CC\u00B7\uB9CC\uB8CC \uC0C1\uD669\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>\uAD6C\uB9E4\uC77C</th>
                            <th>\uC0C1\uD488\uBA85</th>
                            <th>\uC720\uD615</th>
                            <th>\uC0C1\uD0DC</th>
                            <th>\uC885\uB8CC/\uB9CC\uB8CC</th>
                            <th>\uAD6C\uB9E4 \uAE08\uC561</th>
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
        if (type === 'CHARGE' && description && (description + '').indexOf('\uC5F0\uC7A5') !== -1) return '\uC5F0\uC7A5';
        const typeMap = { 'CHARGE': '\uCDA9\uC804/\uC5F0\uC7A5', 'DEDUCT': '\uCC28\uAC10', 'ADJUST': '\uC870\uC815' };
        return typeMap[type] || type;
    }
    function getTransactionTypeBadge(type, description) {
        if (type === 'CHARGE' && description && (description + '').indexOf('\uC5F0\uC7A5') !== -1) return 'info';
        const badgeMap = { 'CHARGE': 'success', 'DEDUCT': 'danger', 'ADJUST': 'warning' };
        return badgeMap[type] || 'secondary';
    }
    function getBranchDisplay(branch, facilityName) {
        if (facilityName) return facilityName;
        const branchNames = { SAHA: '\uC0AC\uD558', YEONSAN: '\uC5F0\uC0B0', RENTAL: '\uB300\uC5EC' };
        return (branch && branchNames[branch]) ? branchNames[branch] : '-';
    }
    const list = history && history.length ? history : [];
    const rows = list.map(h => {
        const bookingId = h.bookingId != null ? h.bookingId : '-';
        const date = h.transactionDate ? App.formatDateTime(h.transactionDate) : '-';
        const productName = (h.memberProduct && (h.memberProduct.name || h.memberProduct.product?.name || h.memberProduct.productName)) || '\uC774\uB984 \uC5C6\uC74C';
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
            <td>${remaining}\uD68C</td>
            <td>${description}</td>
        </tr>`;
    }).join('');
    return `
    <div class="card">
        <div class="card-header"><h3 class="card-title">\uC774\uC6A9\uAD8C \uBCC0\uB3D9 \uC774\uB825 (\uC608\uC57D/\uCD9C\uC11D \uB4F1)</h3></div>
        <div class="card-body">
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">\uC608\uC57D\u00B7\uCD9C\uC11D \uB4F1\uC5D0 \uB530\uB978 \uC774\uC6A9\uAD8C \uCC28\uAC10\u00B7\uCDA9\uC804 \uB0B4\uC5ED\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>\uC608\uC57D ID</th>
                            <th>\uC77C\uC2DC</th>
                            <th>\uC0C1\uD488</th>
                            <th>\uC9C0\uC810</th>
                            <th>\uC720\uD615</th>
                            <th>\uBCC0\uB3D9</th>
                            <th>\uC794\uC5EC</th>
                            <th>\uBE44\uACE0</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">\uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>'}
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

function getCoachMemoStatsObject(member) {
    if (!member) return { pitcher: [], batter: [], defense: [], catcher: [] };
    var raw = member.coachMemoStats;
    var stats = (typeof raw === 'string' && raw) ? (function() { try { return JSON.parse(raw); } catch (e) { return {}; } })() : (raw && typeof raw === 'object' ? raw : {});
    var keys = ['pitcher', 'batter', 'defense', 'catcher'];
    keys.forEach(function(k) {
        if (!Array.isArray(stats[k])) stats[k] = [];
        while (stats[k].length < 5) stats[k].push('');
    });
    return stats;
}

function setupMemberStatsMemos(container, member) {
    if (!container || !member || !member.id) return;
    if (isPublicMemberBookingReadOnly()) return;
    var icons = container.querySelectorAll('.member-field-memo-icon');
    icons.forEach(function(icon) {
        var field = icon.getAttribute('data-field') || '';
        var statIndexStr = icon.getAttribute('data-stat-index');
        var statIndex = (statIndexStr !== '' && statIndexStr != null) ? parseInt(statIndexStr, 10) : null;
        var statLabel = icon.getAttribute('data-stat-label') || '';
        icon.addEventListener('click', function() {
            var m = (currentMemberDetail && currentMemberDetail.id === member.id) ? currentMemberDetail : member;
            var initialMemo = '';
            if (statIndex != null && !isNaN(statIndex)) {
                var stats = getCoachMemoStatsObject(m);
                initialMemo = (stats[field] && stats[field][statIndex] != null) ? String(stats[field][statIndex]) : '';
                openGradeMemoModal(member.id, initialMemo, field, statIndex, statLabel);
            } else {
                if (field === 'pitcher') initialMemo = m.coachMemoPitcher != null ? String(m.coachMemoPitcher) : '';
                else if (field === 'batter') initialMemo = m.coachMemoBatter != null ? String(m.coachMemoBatter) : '';
                else if (field === 'defense') initialMemo = m.coachMemoDefense != null ? String(m.coachMemoDefense) : '';
                else if (field === 'catcher') initialMemo = m.coachMemoCatcher != null ? String(m.coachMemoCatcher) : '';
                openGradeMemoModal(member.id, initialMemo, field);
            }
        });
    });
}

function openGradeMemoModal(memberId, initialMemo, field, statIndex, statLabel) {
    if (isPublicMemberBookingReadOnly()) return;
    var overlay = document.createElement('div');
    overlay.className = 'member-grade-memo-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    var box = document.createElement('div');
    box.className = 'member-grade-memo-modal';
    box.style.cssText = 'background:var(--bg-secondary, #1e2530);border-radius:12px;padding:20px;min-width:320px;max-width:480px;width:90%;box-shadow:0 8px 24px rgba(0,0,0,0.3);';
    var fieldLabels = { pitcher: '\uD22C\uC218', batter: '\uD0C0\uC790', defense: '\uC218\uBE44', catcher: '\uD3EC\uC218' };
    var fieldLabel = (field && fieldLabels[field]) ? fieldLabels[field] : '';
    var placeholder;
    if (statIndex != null && !isNaN(statIndex) && statLabel) {
        placeholder = fieldLabel + ' - ' + statLabel + ' \uC9C0\uD45C\uC5D0 \uB300\uD55C \uCF54\uCE58 \uBA54\uBAA8';
    } else {
        placeholder = fieldLabel ? fieldLabel + ' \uAD6C\uC5ED \uCF54\uCE58 \uBA54\uBAA8' : '\uCF54\uCE58 \uBA54\uBAA8\uB97C \uC785\uB825\uD558\uC138\uC694';
    }
    var textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.rows = 5;
    textarea.placeholder = placeholder;
    textarea.value = initialMemo != null ? String(initialMemo) : '';
    textarea.style.cssText = 'width:100%;margin-bottom:12px;resize:vertical;';
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = '\uC800\uC7A5';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-secondary btn-sm';
    closeBtn.textContent = '\uB2EB\uAE30';
    function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    saveBtn.addEventListener('click', function() {
        var body = {};
        var isPerStat = (statIndex != null && !isNaN(statIndex));
        if (isPerStat && field) {
            var stats = getCoachMemoStatsObject(currentMemberDetail && currentMemberDetail.id === memberId ? currentMemberDetail : {});
            if (!Array.isArray(stats[field])) stats[field] = [];
            while (stats[field].length <= statIndex) stats[field].push('');
            stats[field][statIndex] = textarea.value;
            body.coachMemoStats = stats;
        } else if (field === 'pitcher') body.coachMemoPitcher = textarea.value;
        else if (field === 'batter') body.coachMemoBatter = textarea.value;
        else if (field === 'defense') body.coachMemoDefense = textarea.value;
        else if (field === 'catcher') body.coachMemoCatcher = textarea.value;
        else body.coachMemo = textarea.value;
        saveBtn.disabled = true;
        App.api.patch('/members/' + memberId + '/memos', body).then(function(res) {
            saveBtn.disabled = false;
            if (currentMemberDetail && currentMemberDetail.id === memberId) {
                if (res.coachMemoStats != null) currentMemberDetail.coachMemoStats = typeof res.coachMemoStats === 'string' ? res.coachMemoStats : JSON.stringify(res.coachMemoStats);
                else if (field === 'pitcher') currentMemberDetail.coachMemoPitcher = res.coachMemoPitcher;
                else if (field === 'batter') currentMemberDetail.coachMemoBatter = res.coachMemoBatter;
                else if (field === 'defense') currentMemberDetail.coachMemoDefense = res.coachMemoDefense;
                else if (field === 'catcher') currentMemberDetail.coachMemoCatcher = res.coachMemoCatcher;
                else currentMemberDetail.coachMemo = res.coachMemo;
            }
            App.showNotification('\uBA54\uBAA8\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
            close();
        }).catch(function() {
            saveBtn.disabled = false;
            App.showNotification('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
        });
    });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    btnWrap.appendChild(closeBtn);
    btnWrap.appendChild(saveBtn);
    box.appendChild(textarea);
    box.appendChild(btnWrap);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function renderMemberStats(member, context) {
    if (!member) return '<p>\uB85C\uB529 \uC911...</p>';
    var eliteGrades = ['ELITE_ELEMENTARY', 'ELITE_MIDDLE', 'ELITE_HIGH'];
    var isElite = member.grade && eliteGrades.indexOf(member.grade) !== -1;
    if (!isElite) {
        return '<div class="member-stats-ability-wrap" style="padding: 32px 24px; text-align: center;">' +
            '<p style="color: var(--text-muted); font-size: 15px; margin: 0;">\uAC1C\uC778 \uB2A5\uB825\uCE58\uB294 \uC5D8\uB9AC\uD2B8 \uB4F1\uAE09 \uD68C\uC6D0\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4.</p>' +
            '</div>';
    }
    var fmtNum = function(v) { return v != null && v !== '' ? Number(v) : null; };
    var fmtLevel = function(s) {
        if (!s) return null;
        var u = String(s).toUpperCase();
        if (u === 'HIGH' || u === '?') return '\uC0C1';
        if (u === 'MID' || u === 'MIDDLE' || u === '?') return '\uC911';
        if (u === 'LOW' || u === '?') return '\uD558';
        if (/^[0-7]$/.test(String(s))) return String(s) + '\uB2E8\uACC4';
        return s;
    };
    /** 문자 단계(HIGH/MID/LOW) 또는 0~7 → 0~1 비율 */
    var levelToRatio = function(s) {
        if (s === null || s === undefined || s === '') return 0;
        var u = String(s).toUpperCase();
        if (u === 'HIGH' || u === '\uC0C1') return 1;
        if (u === 'MID' || u === 'MIDDLE' || u === '\uC911') return 4 / 7;
        if (u === 'LOW' || u === '\uD558') return 1 / 7;
        var n = parseInt(s, 10);
        if (n >= 0 && n <= 7) return n / 7;
        return 0.5;
    };
    /** 숫자 1~7 또는 max===7인 0~7 → /7, 그 외 속도 등은 max로 정규화 */
    var toRatio = function(v, max) {
        if (v == null) return 0;
        var n = Number(v);
        if (max === 7) return Math.min(1, n / 7);
        if (n >= 1 && n <= 7) return n / 7;
        return max ? Math.min(1, n / max) : 0;
    };
    var pitchVel = fmtNum(member.pitchingSpeed);
    var pitchCtrl = fmtLevel(member.pitcherControl);
    var pitchBreaking = fmtLevel(member.pitcherBreakingBall);
    var pitchFlex = fmtLevel(member.pitcherFlexibility);
    var pitchPower = fmtNum(member.batterPower);
    var runSpeed = fmtNum(member.runningSpeed);
    var swingVel = fmtNum(member.swingSpeed);
    var exitVel = fmtNum(member.exitVelocity);
    var batPower = fmtNum(member.batterPower);
    var batFlex = fmtNum(member.batterFlexibility);
    var runSpeedB = runSpeed != null ? runSpeed : fmtNum(member.runningSpeed);
    var ref = (context && context.reference) ? context.reference : {};
    var refVelocity = (ref.refVelocity != null ? Number(ref.refVelocity) : 135);
    var maxPower = 100; var maxRun = 30;
    // 투수 5축: 구속·제구·변화구·유연성·파워(단계) — 구속 기준 refVelocity
    var p1 = pitchVel != null && refVelocity > 0 ? Math.min(1, pitchVel / refVelocity) : 0;
    var p2 = levelToRatio(member.pitcherControl);
    var p3 = levelToRatio(member.pitcherBreakingBall);
    var p4 = levelToRatio(member.pitcherFlexibility);
    var p5 = toRatio(pitchPower, maxPower);
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
        if (n >= 1 && n <= 7) return n / 7;
        if (max === 7) return Math.min(1, n / 7);
        return max ? Math.min(1, n / max) : Math.min(1, n);
    };
    var avgPitcher = context && context.averages && context.averages.pitcher ? context.averages.pitcher : null;
    var a1 = 0, a2 = 0, a3 = 0, a4 = 0, a5 = 0;
    if (avgPitcher) {
        a1 = avgPitcher.velocity != null && refVelocity > 0 ? Math.min(1, Number(avgPitcher.velocity) / refVelocity) : 0;
        a2 = avgToRatio(avgPitcher.controlRatio, null);
        a3 = avgToRatio(avgPitcher.breakingBallRatio, null);
        a4 = avgToRatio(avgPitcher.flexibilityRatio, null);
        a5 = avgToRatio(avgPitcher.power, maxPower);
    }
    var avgFillPoints = [a1, a2, a3, a4, a5].map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var rankPitcher = context && context.rankings && context.rankings.pitcher ? context.rankings.pitcher : {};
    var pitcherRankKeys = ['velocity', 'control', 'breakingBall', 'flexibility', 'power'];
    var pitcherLabels = ['\uAD6C\uC18D', '\uC81C\uAD6C', '\uBCC0\uD654\uAD6C', '\uC720\uC5F0\uC131', '\uD30C\uC6CC'];
    var pitcherVals = [
        pitchVel != null ? pitchVel + ' km/h' : '-',
        pitchCtrl || '-',
        pitchBreaking || '-',
        pitchFlex || '-',
        pitchPower != null ? (pitchPower >= 0 && pitchPower <= 7 ? pitchPower + '\uB2E8\uACC4' : pitchPower) : '-'
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
        return ' <span class="' + cls + '">(\uC0C1\uC704 ' + band + '% \uB0B4)</span>';
    };
    var rankSuffix = function(i) {
        var val = rankPitcher[pitcherRankKeys[i]];
        return rankToPercentText(val);
    };
    // 타자: 스윙·Tee 타구속·파워·주력·유연성(0~7 단계 정규화)
    var refSwing = (ref.refSwing != null ? Number(ref.refSwing) : 75);
    var refExit = (ref.refExit != null ? Number(ref.refExit) : Math.round(150 * 1.609344));
    var refStage = (ref.refStage != null ? Number(ref.refStage) : 7);
    var toRefRatio = function(val, refMax) {
        if (val == null || refMax == null) return 0;
        return Math.min(1, Number(val) / refMax);
    };
    var b1 = toRefRatio(swingVel, refSwing);
    var b2 = toRefRatio(exitVel, refExit);
    var b3 = toRefRatio(batPower != null ? (batPower >= 0 && batPower <= 7 ? batPower : batPower) : null, refStage);
    var b4 = toRefRatio(runSpeedB, refStage);
    var b5 = toRefRatio(batFlex, refStage);
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
    // 타자 레이더 격자: 1/7~6/7 동심 오각형
    var gridRatios = [1/7, 2/7, 3/7, 4/7, 5/7, 6/7];
    var radarGridB = gridRatios.map(function(ratio) {
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
    var batterLabels = ['\uC2A4\uC789 \uC18D\uB3C4', 'Tee \uD0C0\uAD6C \uC18D\uB3C4', '\uD30C\uC6CC', '\uC8FC\uB825', '\uC720\uC5F0\uC131'];
    var batterVals = [
        swingVel != null ? swingVel + ' mph' : '-',
        exitVel != null ? exitVel + ' km/h' : '-',
        batPower != null ? (batPower >= 0 && batPower <= 7 ? batPower + '\uB2E8\uACC4' : batPower) : '-',
        runSpeedB != null ? (runSpeedB >= 0 && runSpeedB <= 7 ? runSpeedB + '\uB2E8\uACC4' : runSpeedB) : '-',
        batFlex != null ? (batFlex >= 0 && batFlex <= 7 ? batFlex + '\uB2E8\uACC4' : batFlex) : '-'
    ];
    var defHand = fmtNum(member.defenseHandling);
    var defStep = fmtNum(member.defenseStep);
    var defThrow = fmtNum(member.defenseThrowing);
    var defQuick = fmtNum(member.defenseQuickness);
    var defenseLabels = ['\uD578\uB4E4\uB9C1', '\uC2A4\uD15D', '\uC1A1\uAD6C(\uC815\uD655)', '\uD034\uB2C8\uC2A4', '\uC720\uC5F0\uC131'];
    var defenseVals = [
        defHand != null ? (defHand >= 0 && defHand <= 7 ? defHand + '\uB2E8\uACC4' : defHand) : '-',
        defStep != null ? (defStep >= 0 && defStep <= 7 ? defStep + '\uB2E8\uACC4' : defStep) : '-',
        defThrow != null ? (defThrow >= 0 && defThrow <= 7 ? defThrow + '\uB2E8\uACC4' : defThrow) : '-',
        defQuick != null ? (defQuick >= 0 && defQuick <= 7 ? defQuick + '\uB2E8\uACC4' : defQuick) : '-',
        batFlex != null ? (batFlex >= 0 && batFlex <= 7 ? batFlex + '\uB2E8\uACC4' : batFlex) : '-'
    ];
    var d1 = defHand != null ? toRatio(defHand, 7) : 0;
    var d2 = defStep != null ? toRatio(defStep, 7) : 0;
    var d3 = defThrow != null ? toRatio(defThrow, 7) : 0;
    var d4 = toRatio(defQuick, 7);
    var d5 = toRatio(batFlex, 7);
    var fillPointsD = [d1, d2, d3, d4, d5].map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var catBlock = fmtNum(member.catcherBlocking);
    var catThrow = fmtNum(member.catcherThrowing);
    var catFrame = fmtNum(member.catcherFraming);
    var catcherLabels = ['\uBE14\uB85C\uD0B9', '\uC1A1\uAD6C(\uB3C4)', '\uD504\uB808\uC774\uC789', '\uD30C\uC6CC', '\uC720\uC5F0\uC131'];
    var catcherVals = [
        catBlock != null ? (catBlock >= 0 && catBlock <= 7 ? catBlock + '\uB2E8\uACC4' : catBlock) : '-',
        catThrow != null ? (catThrow >= 0 && catThrow <= 7 ? catThrow + '\uB2E8\uACC4' : catThrow) : '-',
        catFrame != null ? (catFrame >= 0 && catFrame <= 7 ? catFrame + '\uB2E8\uACC4' : catFrame) : '-',
        batPower != null ? (batPower >= 0 && batPower <= 7 ? batPower + '\uB2E8\uACC4' : batPower) : '-',
        batFlex != null ? (batFlex >= 0 && batFlex <= 7 ? batFlex + '\uB2E8\uACC4' : batFlex) : '-'
    ];
    var c1 = catBlock != null ? toRatio(catBlock, 7) : 0;
    var c2 = catThrow != null ? toRatio(catThrow, 7) : 0;
    var c3 = catFrame != null ? toRatio(catFrame, 7) : 0;
    var c4 = toRatio(batPower, 7);
    var c5 = toRatio(batFlex, 7);
    var pentagonOutlineC = [0,1,2,3,4].map(function(i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        return (cx + r * Math.cos(rad)).toFixed(1) + ',' + (cy + r * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var fillPointsC = [c1, c2, c3, c4, c5].map(function(v, i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        var r2 = r * (v || 0);
        return (cx + r2 * Math.cos(rad)).toFixed(1) + ',' + (cy + r2 * Math.sin(rad)).toFixed(1);
    }).join(' ');
    /** 의미 없는 0단계/0속도는 "데이터 없음"으로 취급 */
    function isMeaningfulVal(v) {
        if (v == null || v === '' || v === '-') return false;
        var s = String(v);
        if (s === '0\uB2E8\uACC4' || s === '0 km/h' || s === '0 mph') return false;
        return true;
    }
    var hasPitcher = [0, 1, 2].some(function(i) { return isMeaningfulVal(pitcherVals[i]); });
    var hasBatter = [0, 1, 2].some(function(i) { return isMeaningfulVal(batterVals[i]); });
    var hasDefense = [0, 1, 2].some(function(i) { return isMeaningfulVal(defenseVals[i]); });
    var hasCatcher = [0, 1, 2].some(function(i) { return isMeaningfulVal(catcherVals[i]); });
    var hasAnyAbility = hasPitcher || hasBatter || hasDefense || hasCatcher;
    if (!hasAnyAbility) {
        return '<p class="member-stats-empty" style="color: var(--text-muted); text-align: center; padding: 32px 16px;">\uB4F1\uB85D\uB41C \uB2A5\uB825\uCE58 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    }
    var rankSuffixB = function(i) {
        var val = rankBatter[batterRankKeys[i]];
        return rankToPercentText(val);
    };
    /** 꼭짓점 라벨: 값 길이에 따라 반지름 방향 오프셋 */
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
    var defenseVertexLabels = vertexTexts(defenseLabels);
    var catcherVertexLabels = vertexTexts(catcherLabels);
    var pitcherRefVertexLabels = '';
    var batterRefVertexLabels = '';
    var gradeLabelEsc = (context && context.gradeLabel) ? (App.escapeHtml ? App.escapeHtml(context.gradeLabel) : context.gradeLabel) : '';
    var gradeHtml = gradeLabelEsc ? '<p class="member-stats-grade">\uB4F1\uAE09 \uAE30\uC900: <strong>' + gradeLabelEsc + '</strong></p>' : '';
    var fieldLabel = { pitcher: '\uD22C\uC218', batter: '\uD0C0\uC790', defense: '\uC218\uBE44', catcher: '\uD3EC\uC218' };
    var memoReadOnly = isPublicMemberBookingReadOnly();
    var memoIconHtml = function(field, statIndex, statLabel) {
        if (memoReadOnly) return '';
        var title = (fieldLabel[field] || field) + ' - ' + (statLabel || '') + ' \uBA54\uBAA8';
        return ' <button type="button" class="member-field-memo-icon" title="' + title + '" data-member-id="' + (member.id || '') + '" data-field="' + field + '" data-stat-index="' + (statIndex != null ? statIndex : '') + '" data-stat-label="' + (statLabel ? String(statLabel).replace(/"/g, '&quot;') : '') + '" style="margin-left:6px;padding:0 4px;background:transparent;border:none;cursor:pointer;font-size:14px;vertical-align:middle;opacity:0.85;">&#128221;</button>';
    };
    var refGradeLabel = (context && context.gradeLabel) ? context.gradeLabel : '\uB3D9\uAE09';
    var pitcherRefCaption = '\uCC38\uACE0: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + ' (\uD3C9\uADE0 ' + refVelocity + ' km/h, \uBCC0\uD654\uAD6C\u00B7\uC720\uC5F0\uC131\u00B7\uD30C\uC6CC\uB294 7\uB2E8\uACC4)';
    var legendHtml = '<p class="member-stats-legend">' +
        '<span class="legend-item legend-item-fixed"><span class="legend-dot legend-ref"></span> \uCC38\uACE0: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + '</span>' +
        ' <label class="legend-item legend-item-avg"><input type="checkbox" class="legend-toggle" data-layer="avg" checked><span class="legend-dot legend-avg"></span> \uB3D9\uAE09 \uD3C9\uADE0 \uACE1\uC120</label>' +
        ' <label class="legend-item legend-item-member"><input type="checkbox" class="legend-toggle" data-layer="member" checked><span class="legend-dot legend-member"></span> \uD68C\uC6D0</label>' +
        '</p>';
    var colCount = (hasPitcher ? 1 : 0) + (hasBatter ? 1 : 0) + (hasDefense ? 1 : 0) + (hasCatcher ? 1 : 0);
    var isSingle = colCount === 1;
    var singleClass = isSingle ? ' member-stats-ability-wrap--single' : '';
    var pitcherCol = hasPitcher ? (
        isSingle
            ? ('<div class="member-stats-ability-col member-stats-ability-col--single">' +
                '<h3 class="member-stats-ability-title">\uD22C\uC218</h3>' +
                '<div class="member-stats-ability-inner">' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-pitcher">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutline + '" fill="none" class="radar-polygon-ref"/>' +
                (avgPitcher ? '<polygon points="' + avgFillPoints + '" class="radar-polygon-avg"/>' : '') +
                '<polygon points="' + fillPoints + '" class="radar-polygon-member"/>' +
                pitcherVertexLabels +
                '</svg></div>' +
                '<div class="member-stats-detail">' +
                '<p class="member-stats-batter-ref-caption">' + pitcherRefCaption + '</p>' +
                '<ul class="member-stats-list">' +
                pitcherLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (pitcherVals[i] || '-') + rankSuffix(i) + '</span>' + memoIconHtml('pitcher', i, l) + '</li>'; }).join('') +
                '</ul></div></div></div>')
            : ('<div class="member-stats-ability-col">' +
                '<h3 class="member-stats-ability-title">\uD22C\uC218</h3>' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-pitcher">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutline + '" fill="none" class="radar-polygon-ref"/>' +
                (avgPitcher ? '<polygon points="' + avgFillPoints + '" class="radar-polygon-avg"/>' : '') +
                '<polygon points="' + fillPoints + '" class="radar-polygon-member"/>' +
                pitcherVertexLabels +
                '</svg></div>' +
                '<p class="member-stats-batter-ref-caption">' + pitcherRefCaption + '</p>' +
                '<ul class="member-stats-list">' +
                pitcherLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (pitcherVals[i] || '-') + rankSuffix(i) + '</span>' + memoIconHtml('pitcher', i, l) + '</li>'; }).join('') +
                '</ul></div>')
    ) : '';
    var batterCol = hasBatter ? (
        isSingle
            ? ('<div class="member-stats-ability-col member-stats-ability-col--single">' +
                '<h3 class="member-stats-ability-title">\uD0C0\uC790</h3>' +
                '<div class="member-stats-ability-inner">' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutlineB + '" class="radar-polygon-ref" fill="none"/>' +
                (avgBatter ? '<polygon points="' + avgFillPointsB + '" class="radar-polygon-avg"/>' : '') +
                '<polygon points="' + fillPointsB + '" class="radar-polygon-member"/>' +
                batterVertexLabels +
                '</svg></div>' +
                '<div class="member-stats-detail">' +
                '<p class="member-stats-batter-ref-caption">\uCC38\uACE0: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + ' (\uC2A4\uC789 \uC18D\uB3C4 ' + refSwing + ', Tee \uD0C0\uAD6C \uC18D\uB3C4 ' + refExit + ', \uD30C\uC6CC\u00B7\uC8FC\uB825\u00B7\uC720\uC5F0\uC131\uC740 ' + refStage + '\uB2E8\uACC4)</p>' +
                '<ul class="member-stats-list">' +
                batterLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (batterVals[i] || '-') + rankSuffixB(i) + '</span>' + memoIconHtml('batter', i, l) + '</li>'; }).join('') +
                '</ul></div></div></div>')
            : ('<div class="member-stats-ability-col">' +
                '<h3 class="member-stats-ability-title">\uD0C0\uC790</h3>' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutlineB + '" class="radar-polygon-ref" fill="none"/>' +
                (avgBatter ? '<polygon points="' + avgFillPointsB + '" class="radar-polygon-avg"/>' : '') +
                '<polygon points="' + fillPointsB + '" class="radar-polygon-member"/>' +
                batterVertexLabels +
                '</svg></div>' +
                '<p class="member-stats-batter-ref-caption">\uCC38\uACE0: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + ' (\uC2A4\uC789 \uC18D\uB3C4 ' + refSwing + ', Tee \uD0C0\uAD6C \uC18D\uB3C4 ' + refExit + ', \uD30C\uC6CC\u00B7\uC8FC\uB825\u00B7\uC720\uC5F0\uC131\uC740 ' + refStage + '\uB2E8\uACC4)</p>' +
                '<ul class="member-stats-list">' +
                batterLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (batterVals[i] || '-') + rankSuffixB(i) + '</span>' + memoIconHtml('batter', i, l) + '</li>'; }).join('') +
                '</ul></div>')
    ) : '';
    // 수비/포수 레이더 외곽선(타자와 동일 SVG 격자 재사용)
    var pentagonOutlineD = [0,1,2,3,4].map(function(i) {
        var a = -90 + i * 72;
        var rad = a * Math.PI / 180;
        return (cx + r * Math.cos(rad)).toFixed(1) + ',' + (cy + r * Math.sin(rad)).toFixed(1);
    }).join(' ');
    var defenseRefCaption = '\uCC38\uACE0: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + ' (\uC218\uBE44 \uB2A5\uB825\uC740 \uB3D9\uAE09 \uD3C9\uADE0 \uAE30\uC900 7\uB2E8\uACC4)';
    var catcherRefCaption = '\uCC38\uACE0: ' + (App.escapeHtml ? App.escapeHtml(refGradeLabel) : refGradeLabel) + ' (\uD3EC\uC218 \uB2A5\uB825\uC740 \uB3D9\uAE09 \uD3C9\uADE0 \uAE30\uC900 7\uB2E8\uACC4)';
    var defenseCol = hasDefense ? (
        isSingle
            ? ('<div class="member-stats-ability-col member-stats-ability-col--single">' +
                '<h3 class="member-stats-ability-title">\uC218\uBE44</h3>' +
                '<div class="member-stats-ability-inner">' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter radar-svg-defense">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutlineD + '" class="radar-polygon-ref" fill="none"/>' +
                '<polygon points="' + fillPointsD + '" class="radar-polygon-member"/>' +
                defenseVertexLabels +
                '</svg></div>' +
                '<div class="member-stats-detail">' +
                '<p class="member-stats-batter-ref-caption">' + defenseRefCaption + '</p>' +
                '<ul class="member-stats-list">' +
                defenseLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (defenseVals[i] || '-') + '</span>' + memoIconHtml('defense', i, l) + '</li>'; }).join('') +
                '</ul></div></div></div>')
            : ('<div class="member-stats-ability-col">' +
                '<h3 class="member-stats-ability-title">\uC218\uBE44</h3>' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter radar-svg-defense">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutlineD + '" class="radar-polygon-ref" fill="none"/>' +
                '<polygon points="' + fillPointsD + '" class="radar-polygon-member"/>' +
                defenseVertexLabels +
                '</svg></div>' +
                '<p class="member-stats-batter-ref-caption">' + defenseRefCaption + '</p>' +
                '<ul class="member-stats-list">' +
                defenseLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (defenseVals[i] || '-') + '</span>' + memoIconHtml('defense', i, l) + '</li>'; }).join('') +
                '</ul></div>')
    ) : '';
    var catcherCol = hasCatcher ? (
        isSingle
            ? ('<div class="member-stats-ability-col member-stats-ability-col--single">' +
                '<h3 class="member-stats-ability-title">\uD3EC\uC218</h3>' +
                '<div class="member-stats-ability-inner">' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter radar-svg-defense">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutlineC + '" class="radar-polygon-ref" fill="none"/>' +
                '<polygon points="' + fillPointsC + '" class="radar-polygon-member"/>' +
                catcherVertexLabels +
                '</svg></div>' +
                '<div class="member-stats-detail">' +
                '<p class="member-stats-batter-ref-caption">' + catcherRefCaption + '</p>' +
                '<ul class="member-stats-list">' +
                catcherLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (catcherVals[i] || '-') + '</span>' + memoIconHtml('catcher', i, l) + '</li>'; }).join('') +
                '</ul></div></div></div>')
            : ('<div class="member-stats-ability-col">' +
                '<h3 class="member-stats-ability-title">\uD3EC\uC218</h3>' +
                '<div class="member-stats-radar">' +
                '<svg viewBox="-12 -12 184 184" class="radar-svg radar-svg-batter radar-svg-defense">' +
                radarGridB + radarAxesB +
                '<polygon points="' + pentagonOutlineC + '" class="radar-polygon-ref" fill="none"/>' +
                '<polygon points="' + fillPointsC + '" class="radar-polygon-member"/>' +
                catcherVertexLabels +
                '</svg></div>' +
                '<p class="member-stats-batter-ref-caption">' + catcherRefCaption + '</p>' +
                '<ul class="member-stats-list">' +
                catcherLabels.map(function(l, i) { return '<li><span class="stat-label">' + l + '</span><span class="stat-value">' + (catcherVals[i] || '-') + '</span>' + memoIconHtml('catcher', i, l) + '</li>'; }).join('') +
                '</ul></div>')
    ) : '';
    var abilityWrap = '<div class="member-stats-ability-wrap' + singleClass + '">' + gradeHtml + legendHtml + pitcherCol + batterCol + defenseCol + catcherCol + '</div>';
    return abilityWrap;
}

function setupMemberMemoTabSave(container, member) {
    if (!container || !member || !member.id) return;
    if (isPublicMemberBookingReadOnly()) return;
    var btn = container.querySelector('.member-memo-tab-save');
    if (!btn) return;
    btn.addEventListener('click', function() {
        var coachMemoEl = container.querySelector('.member-coach-memo-input');
        var stats = getCoachMemoStatsObject(currentMemberDetail && currentMemberDetail.id === member.id ? currentMemberDetail : member);
        var inputs = container.querySelectorAll('.member-memo-stat-input');
        inputs.forEach(function(input) {
            var field = input.getAttribute('data-field');
            var idxStr = input.getAttribute('data-stat-index');
            var idx = idxStr != null && idxStr !== '' ? parseInt(idxStr, 10) : -1;
            if (field && idx >= 0 && !isNaN(idx)) {
                if (!Array.isArray(stats[field])) stats[field] = [];
                while (stats[field].length <= idx) stats[field].push('');
                stats[field][idx] = input.value || '';
            }
        });
        var payload = {
            coachMemo: coachMemoEl ? coachMemoEl.value : '',
            coachMemoStats: stats
        };
        btn.disabled = true;
        App.api.patch('/members/' + member.id + '/memos', payload).then(function(res) {
            btn.disabled = false;
            if (currentMemberDetail && currentMemberDetail.id === member.id) {
                currentMemberDetail.coachMemo = res.coachMemo;
                if (res.coachMemoStats != null) currentMemberDetail.coachMemoStats = typeof res.coachMemoStats === 'string' ? res.coachMemoStats : JSON.stringify(res.coachMemoStats);
            }
            App.showNotification('\uBA54\uBAA8\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
        }).catch(function() {
            btn.disabled = false;
            App.showNotification('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
        });
    });
}

function renderMemberMemo(member) {
    if (!member) return '<p>\uB85C\uB529 \uC911...</p>';
    var ro = isPublicMemberBookingReadOnly();
    var esc = function(s) { return (s != null ? String(s) : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var coachMemoVal = esc(member.coachMemo);
    var stats = getCoachMemoStatsObject(member);
    var statLabels = {
        pitcher: ['\uAD6C\uC18D', '\uC81C\uAD6C', '\uBCC0\uD654\uAD6C', '\uC720\uC5F0\uC131', '\uD30C\uC6CC'],
        batter: ['\uC2A4\uC789 \uC18D\uB3C4', 'Tee \uD0C0\uAD6C \uC18D\uB3C4', '\uD30C\uC6CC', '\uC8FC\uB825', '\uC720\uC5F0\uC131'],
        defense: ['\uD578\uB4E4\uB9C1', '\uC2A4\uD15D', '\uC1A1\uAD6C(\uC815\uD655)', '\uD034\uB2C8\uC2A4', '\uC720\uC5F0\uC131'],
        catcher: ['\uBE14\uB85C\uD0B9', '\uC1A1\uAD6C(\uB3C4)', '\uD504\uB808\uC774\uC789', '\uD30C\uC6CC', '\uC720\uC5F0\uC131']
    };
    var sectionTitles = { pitcher: '\uD22C\uC218', batter: '\uD0C0\uC790', defense: '\uC218\uBE44', catcher: '\uD3EC\uC218' };
    var sectionsHtml = '';
    ['pitcher', 'batter', 'defense', 'catcher'].forEach(function(field) {
        var title = sectionTitles[field];
        var labels = statLabels[field];
        var arr = stats[field] || [];
        sectionsHtml += '<div class="member-memo-stat-section">' +
            '<div class="member-memo-stat-section-title">' + title + '</div>' +
            '<div class="member-memo-stat-rows">';
        for (var i = 0; i < 5; i++) {
            var val = (Array.isArray(arr) && arr[i] != null) ? esc(String(arr[i])) : '';
            var label = labels[i] || '\uD56D\uBAA9 ' + (i + 1);
            var rowClass = val ? 'member-memo-stat-row has-memo' : 'member-memo-stat-row';
            if (ro) {
                var displayMemo = val || '\u2014';
                sectionsHtml += '<div class="' + rowClass + '">' +
                    '<span class="member-memo-stat-label">' + label + '</span>' +
                    '<div class="form-control member-memo-stat-readonly" style="background: var(--bg-tertiary); white-space: pre-wrap; min-height: 38px;">' + displayMemo + '</div>' +
                    '</div>';
            } else {
                sectionsHtml += '<div class="' + rowClass + '">' +
                    '<span class="member-memo-stat-label">' + label + '</span>' +
                    '<input type="text" class="form-control member-memo-stat-input" value="' + val + '" data-field="' + field + '" data-stat-index="' + i + '" placeholder="\uC218\uCE58" maxlength="200" />' +
                    '</div>';
            }
        }
        sectionsHtml += '</div></div>';
    });
    return '<div class="member-memo-tab-wrap" data-member-id="' + (member.id || '') + '">' +
        '<div class="member-memo-top">' +
        '<div class="form-group">' +
        '<label class="form-label">\uCF54\uCE58 \uBA54\uBAA8 <small class="text-muted">(\uB4F1\uAE09 \uC0AC\uC720 \uB4F1 \uC790\uC720 \uC785\uB825)</small></label>' +
        '<textarea class="form-control member-coach-memo-input" rows="4" placeholder="\uCF54\uCE58 \uBA54\uBAA8\uC744 \uC785\uB825\uD558\uC138\uC694."' + (ro ? ' readonly' : '') + '>' + coachMemoVal + '</textarea>' +
        '</div>' +
        (ro ? '' : '<button type="button" class="btn btn-primary member-memo-tab-save">\uC800\uC7A5</button>') +
        '</div>' +
        '<div class="member-memo-bottom">' +
        '<label class="form-label member-memo-stat-heading">\uBD84\uC57C\uBCC4 \uC218\uCE58 \uBA54\uBAA8</label>' +
        '<div class="member-memo-stat-sections">' + sectionsHtml + '</div>' +
        '</div>' +
        '</div>';
}

function csvEscapeCell(val) {
    if (val == null) return '';
    var s = String(val);
    if (/[",\n\r]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function memberCoachPlainForExport(member) {
    if (!member) return '미지정';
    if (member.coachNames) return String(member.coachNames).replace(/\n/g, ', ').trim();
    if (member.coach && member.coach.name) return String(member.coach.name).trim();
    try {
        var sorted = getSortedActiveProductsForMember(member);
        if (sorted && sorted.length) {
            var names = sorted.map(function (mp) {
                return getCoachNameForMemberProduct(mp, member) || '';
            }).filter(Boolean);
            if (names.length) return names.join(', ');
        }
    } catch (e) { /* ignore */ }
    return '미지정';
}

function memberProductsPlainForExport(member) {
    if (!member || !member.memberProducts || !member.memberProducts.length) return '';
    return member.memberProducts.map(function (mp) {
        var n = (mp.product && mp.product.name) ? mp.product.name : '';
        var st = mp.status || '';
        return st ? (n + '(' + st + ')') : n;
    }).filter(Boolean).join('; ');
}

function exportCSV() {
    var list = Array.isArray(accumulatedMembersList) ? accumulatedMembersList : [];
    if (list.length === 0) {
        App.showNotification('\uB0B4\uBCF4\uB0BC \uD68C\uC6D0 \uBAA9\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC628 \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.', 'warning');
        return;
    }
    var headers = [
        '\uD68C\uC6D0\uBC88\uD638',
        '\uC774\uB984',
        '\uB4F1\uAE09',
        '\uC804\uD654\uBC88\uD638',
        '\uD559\uAD50/\uC18C\uC18D',
        '\uB2F4\uB2F9 \uCF54\uCE58',
        '\uC0C1\uD488/\uC774\uC6A9\uAD8C',
        '\uC0C1\uD0DC',
        '\uCD5C\uADFC \uBC29\uBB38',
        '\uB204\uC801 \uACB0\uC81C'
    ];
    var lines = [headers.map(csvEscapeCell).join(',')];
    list.forEach(function (m) {
        var row = [
            m.memberNumber || '',
            m.name || '',
            getGradeText(m.grade),
            m.phoneNumber || '',
            m.school || '',
            memberCoachPlainForExport(m),
            memberProductsPlainForExport(m),
            getStatusText(m.status),
            m.latestLessonDate ? App.formatDate(m.latestLessonDate) : '',
            m.totalPayment != null ? String(m.totalPayment) : '0'
        ];
        lines.push(row.map(csvEscapeCell).join(','));
    });
    var csv = '\uFEFF' + lines.join('\r\n');
    var now = new Date();
    var fname = 'members_' + now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0') + '.csv';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.style.visibility = 'hidden';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    var msg = '\uCD1D ' + list.length + '\uBA85\uC774 CSV\uB85C \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.';
    if (memberPaginationInfo && (memberPageIndex + 1) < memberPaginationInfo.totalPages) {
        msg += ' (\uD604\uC7AC \uD654\uBA74\uC5D0 \uB85C\uB4DC\uB41C \uC778\uC6D0\uB9CC \uD3EC\uD568\uB429\uB2C8\uB2E4. \uC804\uCCB8\uC744 \uBC1B\uC73C\uB824\uBA74 \u300C\uB354 \uBCF4\uAE30\u300D\uB85C \uBAA8\uB450 \uBD88\uB7EC\uC628 \uD6C4 \uB2E4\uC2DC \uB2E4\uC6B4\uB85C\uB4DC\uD558\uC138\uC694.)';
    }
    App.showNotification(msg, 'success');
}

/**
 * \uD68C\uC6D0 \uB4F1\uB85D \uC0C1\uD488\uBCC4 \uCF54\uCE58 \uC120\uD0DD(updateProductCoachSelection)\uACFC \uB3D9\uC77C: \uC0C1\uD488 category\uC5D0 \uB9DE\uB294 \uB2F4\uB2F9\uC8FC\uC81C(specialties)\uB9CC.
 * \uB9DE\uB294 \uC0AC\uB78C\uC774 \uC5C6\uC73C\uBA74 \uC804\uCCB4 \uBAA9\uB85D\uC73C\uB85C \uD3F4\uBC31(\uC704 \uB85C\uC9C1\uACFC \uB3D9\uC77C).
 */
function filterCoachesByProductCategory(allCoaches, productCategory) {
    if (!allCoaches || !allCoaches.length) {
        return [];
    }
    var active = allCoaches.filter(function (c) {
        return c && c.active !== false;
    });
    var cat = (productCategory || '').toString();
    if (!cat || !String(cat).trim()) {
        return active.slice();
    }
    var categoryLower = cat.toLowerCase();
    function matchesCategory(coach, category) {
        var cLower = (category || '').toLowerCase();
        if (cLower === 'rental') {
            var branches = (coach.availableBranches || '').toUpperCase();
            return branches.indexOf('RENTAL') !== -1;
        }
        if (cLower === 'pilates') {
            if (typeof App.categorizeCoachBySubject === 'function') {
                return App.categorizeCoachBySubject(coach) === 'PILATES';
            }
            var pilatesText = ((coach.specialties || '') + ' ' + (coach.name || '')).toLowerCase();
            return pilatesText.indexOf('pilates') !== -1
                || pilatesText.indexOf('\ud544\ub77c\ud14c\uc2a4') !== -1
                || (coach.name || '').indexOf('[\uac15\uc0ac]') !== -1;
        }
        if (!coach.specialties || !category) {
            return false;
        }
        var specialties = (coach.specialties || '').toLowerCase();
        if (cLower === 'baseball' || cLower === 'outdoor_lesson') {
            return specialties.indexOf('baseball') !== -1 || specialties.indexOf('\uc57c\uad6c') !== -1;
        }
        if (cLower === 'training' || cLower === 'training_fitness') {
            return (
                specialties.indexOf('training') !== -1 ||
                specialties.indexOf('\ud2b8\ub808\uc774\ub2dd') !== -1 ||
                specialties.indexOf('training_fitness') !== -1
            );
        }
        if (cLower === 'general' || cLower === 'other') {
            return true;
        }
        return false;
    }
    var filtered = active.filter(function (coach) {
        return matchesCategory(coach, categoryLower);
    });
    if (filtered.length === 0) {
        return [];
    }
    return filtered;
}

/** \uC5F0\uC7A5 \uBAA8\uB2EC: \uBCF4\uC720 \uC774\uC6A9\uAD8C\uC740 \uCF54\uCE58 \uD45C\uC2DC, \uC2E0\uADDC \uC0C1\uD488\uC740 \uCF54\uCE58 \uC120\uD0DD \uD544\uB4DC */
function toggleExtendCoachPickUi(showCoachSelect) {
    var ro = document.getElementById('extend-coach-readonly-wrap');
    var sw = document.getElementById('extend-coach-select-wrap');
    if (!ro || !sw) {
        return;
    }
    if (showCoachSelect) {
        ro.style.display = 'none';
        sw.style.display = '';
    } else {
        ro.style.display = '';
        sw.style.display = 'none';
    }
}

// 이용권 연장 모달
// options.memberProductId: 미리 선택할 보유 이용권 ID
// options.defaultExtendDays: 일수 입력 기본값(공개 예약 등)
async function openExtendProductModal(memberId, options) {
    options = options || {};
    const preselectMemberProductId =
        options.memberProductId != null && options.memberProductId !== ''
            ? Number(options.memberProductId)
            : null;
    const defaultExtendDays =
        options.defaultExtendDays != null && options.defaultExtendDays !== ''
            ? Number(options.defaultExtendDays)
            : null;
    const isAdminForCoachEdit = ((App.currentRole || '').toUpperCase() === 'ADMIN');

    if (!document.getElementById('extend-member-id')) {
        App.warn('openExtendProductModal: extend-product-modal \uC5C6\uC74C');
        App.showNotification('\uC774\uC6A9\uAD8C \uC5F0\uC7A5 \uBAA8\uB2EC\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD68C\uC6D0 \uAD00\uB9AC \uD654\uBA74\uC5D0\uC11C \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.', 'warning');
        return;
    }

    document.getElementById('extend-member-id').value = memberId;
    document.getElementById('extend-product-select').innerHTML = '<option value="">\uB85C\uB529 \uC911...</option>';
        document.getElementById('extend-current-expiry').textContent = '-';
        document.getElementById('extend-purchase-price').textContent = '-';
        document.getElementById('extend-coach').textContent = '-';
        document.getElementById('extend-calculated-price').textContent = '-';
        document.getElementById('extend-days').value = '';
        toggleExtendCoachPickUi(false);
        var ecs0 = document.getElementById('extend-coach-select');
        if (ecs0) {
            ecs0.innerHTML = '<option value="">\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694...</option>';
            ecs0.value = '';
        }
        var coachEditBtn0 = document.getElementById('extend-coach-admin-edit-btn');
        var coachEditWrap0 = document.getElementById('extend-coach-admin-edit-wrap');
        var coachEditSel0 = document.getElementById('extend-coach-admin-select');
        if (coachEditBtn0) coachEditBtn0.style.display = 'none';
        if (coachEditWrap0) coachEditWrap0.style.display = 'none';
        if (coachEditSel0) coachEditSel0.innerHTML = '<option value="">\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694...</option>';

    function toggleExtendDaysField(productType) {
        const daysInput = document.getElementById('extend-days');
        const daysGroup = daysInput ? daysInput.closest('.form-group') : null;
        if (!daysInput || !daysGroup) return;
        if (productType === 'MONTHLY_PASS' || productType === 'DAY_PASS') {
            daysGroup.style.display = 'none';
            daysInput.value = '1';
            daysInput.required = false;
        } else {
            daysGroup.style.display = '';
            daysInput.required = true;
            if (String(daysInput.value).trim() === '1') {
                daysInput.value = '';
            }
        }
    }
    
    try {
        const [memberProducts, allProducts, coachesRaw] = await Promise.all([
            App.api.get(`/member-products?memberId=${memberId}`),
            App.api.get('/products'),
            App.api.get('/coaches')
        ]);

        /** 상세·목록과 동일 규칙 — 소진 중복 행은 연장 선택 목록에서 제외 */
        let memberProductsForSelect =
            Array.isArray(memberProducts) && memberProducts.length > 0 && typeof App.filterMemberProductsForDisplayList === 'function'
                ? App.filterMemberProductsForDisplayList(memberProducts.slice(), { applyEndedGraceFilter: false })
                : Array.isArray(memberProducts)
                  ? memberProducts.slice()
                  : [];
        if (typeof App.sortMemberProductsRemainingFirst === 'function' && memberProductsForSelect.length > 1) {
            memberProductsForSelect = App.sortMemberProductsRemainingFirst(memberProductsForSelect);
        }

        const extendModalAllCoaches = (Array.isArray(coachesRaw) ? coachesRaw : []).filter(function (c) {
            return c && c.active !== false;
        });
        const coachSelectFill = document.getElementById('extend-coach-select');
        if (coachSelectFill) {
            coachSelectFill.innerHTML = '<option value="">\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694...</option>';
        }

        function refillExtendCoachSelectForNewProduct(selectedProduct) {
            var coachSel = document.getElementById('extend-coach-select');
            if (!coachSel || !selectedProduct) {
                return;
            }
            var list = filterCoachesByProductCategory(extendModalAllCoaches, selectedProduct.category);
            coachSel.innerHTML = '<option value="">\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694...</option>';
            list.forEach(function (c) {
                if (c && c.id != null) {
                    coachSel.appendChild(new Option(c.name || ('#' + c.id), String(c.id)));
                }
            });
            var pc = selectedProduct.coach;
            if (pc && pc.id != null) {
                var pid = String(pc.id);
                if (!coachSel.querySelector('option[value="' + pid + '"]')) {
                    var oc = extendModalAllCoaches.find(function (x) {
                        return String(x.id) === pid;
                    });
                    if (oc) {
                        coachSel.appendChild(
                            new Option((oc.name || '') + ' (\uC0C1\uD488 \uAE30\uBCF8)', pid)
                        );
                    }
                }
            }
        }

        function hideAdminCoachEditor() {
            var btn = document.getElementById('extend-coach-admin-edit-btn');
            var wrap = document.getElementById('extend-coach-admin-edit-wrap');
            if (btn) btn.style.display = 'none';
            if (wrap) wrap.style.display = 'none';
        }

        function showAdminCoachEditor(selectedMemberProduct, selectedProduct) {
            var btn = document.getElementById('extend-coach-admin-edit-btn');
            var wrap = document.getElementById('extend-coach-admin-edit-wrap');
            var sel = document.getElementById('extend-coach-admin-select');
            var cancelBtn = document.getElementById('extend-coach-admin-cancel-btn');
            var saveBtn = document.getElementById('extend-coach-admin-save-btn');
            if (!btn || !wrap || !sel || !cancelBtn || !saveBtn || !isAdminForCoachEdit || !selectedMemberProduct || !selectedMemberProduct.id) {
                hideAdminCoachEditor();
                return;
            }
            var coachList = filterCoachesByProductCategory(extendModalAllCoaches, selectedProduct ? selectedProduct.category : null);
            sel.innerHTML = '<option value="">\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694...</option>';
            coachList.forEach(function (c) {
                if (c && c.id != null) {
                    sel.appendChild(new Option(c.name || ('#' + c.id), String(c.id)));
                }
            });
            var currentCoachId =
                selectedMemberProduct.coach && selectedMemberProduct.coach.id != null
                    ? selectedMemberProduct.coach.id
                    : (selectedProduct && selectedProduct.coach && selectedProduct.coach.id != null ? selectedProduct.coach.id : null);
            if (currentCoachId != null && sel.querySelector('option[value="' + String(currentCoachId) + '"]')) {
                sel.value = String(currentCoachId);
            } else {
                sel.value = '';
            }
            btn.style.display = '';
            wrap.style.display = 'none';
            btn.onclick = function () {
                wrap.style.display = '';
            };
            cancelBtn.onclick = function () {
                wrap.style.display = 'none';
            };
            saveBtn.onclick = async function () {
                var coachIdValue = sel.value ? parseInt(sel.value, 10) : null;
                if (!coachIdValue || isNaN(coachIdValue)) {
                    App.showNotification('\uCF54\uCE58\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.', 'warning');
                    return;
                }
                saveBtn.disabled = true;
                try {
                    await App.api.put('/member-products/' + selectedMemberProduct.id + '/coach', { coachId: coachIdValue });
                    var selectedCoach = extendModalAllCoaches.find(function (c) { return String(c.id) === String(coachIdValue); });
                    if (selectedCoach) {
                        selectedMemberProduct.coach = { id: selectedCoach.id, name: selectedCoach.name };
                        selectedMemberProduct.coachName = selectedCoach.name;
                        var coachTextEl = document.getElementById('extend-coach');
                        if (coachTextEl) {
                            coachTextEl.textContent = selectedCoach.name || '-';
                        }
                        var activeSelect = document.getElementById('extend-product-select');
                        if (activeSelect && activeSelect.value === ('memberProduct_' + selectedMemberProduct.id)) {
                            var activeOpt = activeSelect.options[activeSelect.selectedIndex];
                            if (activeOpt) {
                                activeOpt.dataset.coachId = String(selectedCoach.id);
                                activeOpt.dataset.coachName = String(selectedCoach.name || '');
                            }
                        }
                    }
                    wrap.style.display = 'none';
                    App.showNotification('\uB2F4\uB2F9 \uCF54\uCE58\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
                } catch (e) {
                    App.err('\uC774\uC6A9\uAD8C \uCF54\uCE58 \uC218\uC815 \uC2E4\uD328:', e);
                    var msg = e && e.response && e.response.data && e.response.data.error ? e.response.data.error : '\uB2F4\uB2F9 \uCF54\uCE58 \uC218\uC815\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.';
                    App.showNotification(msg, 'danger');
                } finally {
                    saveBtn.disabled = false;
                }
            };
        }

        const select = document.getElementById('extend-product-select');
        
        App.log('연장 모달 - 원본 memberProducts:', memberProducts?.length || 0, '(표시용:', memberProductsForSelect.length, ')');
        App.log('연장 모달 - 전체 상품 수:', allProducts?.length || 0);
        
        select.innerHTML = '<option value="">\uC0C1\uD488/\uC774\uC6A9\uAD8C\uC744 \uC120\uD0DD\uD558\uC138\uC694...</option>';
        
        if (memberProductsForSelect.length === 0 && (!allProducts || allProducts.length === 0)) {
            select.innerHTML = '<option value="">\uC0C1\uD488/\uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</option>';
            select.disabled = true;
            App.showNotification('\uC120\uD0DD\uD560 \uC0C1\uD488/\uC774\uC6A9\uAD8C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.', 'warning');
            return;
        }
        
        select.disabled = false;
        
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        const freshSelect = document.getElementById('extend-product-select');
        
        const allAvailableProducts = [];
        
        if (memberProductsForSelect.length > 0) {
            memberProductsForSelect.forEach(mp => {
                const productName = mp.product?.name || '\uC774\uB984 \uC5C6\uC74C';
                const productType = mp.product?.type || '';
                const expiryDate = mp.expiryDate ? App.formatDate(mp.expiryDate) : '\uBBF8\uC124\uC815';
                const status = mp.status || 'ACTIVE';
                const statusLabelKr = {
                    ACTIVE: '\uC774\uC6A9\uC911',
                    USED_UP: '\uC18C\uC9C4',
                    EXPIRED: '\uB9CC\uB8CC',
                    INACTIVE: '\uBE44\uD65C\uC131',
                    CANCELLED: '\uCDE8\uC18C'
                };
                const statusDisplay =
                    status === 'EXPIRED' && (productType === 'MONTHLY_PASS' || productType === 'DAY_PASS' || productType === 'TIME_PASS')
                        ? '\uAE30\uAC04 \uC885\uB8CC'
                        : (statusLabelKr[status] || status);
                const remainingCount = mp.remainingCount !== undefined ? mp.remainingCount : '-';
                const actualPurchasePrice = mp.actualPurchasePrice || mp.product?.price || 0;
                const totalCount = mp.totalCount || mp.product?.usageCount || 10;
                /** 회당 단가용 묶음 횟수: 카탈로그 usageCount 우선, 없으면 totalCount */
                const catalogUsage =
                    mp.product && mp.product.usageCount != null && Number(mp.product.usageCount) > 0
                        ? Number(mp.product.usageCount)
                        : null;
                const bundleForUnitPrice =
                    catalogUsage != null
                        ? catalogUsage
                        : totalCount > 0
                          ? Number(totalCount)
                          : 10;
                
                let typeText = '';
                if (productType === 'COUNT_PASS') {
                    typeText = '[\uD68C\uCC28\uAD8C]';
                } else if (productType === 'TIME_PASS') {
                    typeText = '[\uAE30\uAC04\uAD8C]';
                } else if (productType === 'MONTHLY_PASS') {
                    typeText = '[\uC6D4\uC815\uC561]';
                } else if (productType === 'DAY_PASS') {
                    typeText = '[\uC77C\uC77C\uAD8C]';
                }
                
                const priceText = App.formatCurrency(actualPurchasePrice);
                
                const optionText = `[\uBCF4\uC720] ${typeText} ${productName} - ${priceText} (\uB9CC\uB8CC\uC77C: ${expiryDate}, \uC0C1\uD0DC: ${statusDisplay}${productType === 'COUNT_PASS' ? `, \uB0A8\uC740 \uD68C\uC218: ${remainingCount}\uD68C` : ''})`;
                const option = new Option(optionText, `memberProduct_${mp.id}`);
                option.dataset.isMemberProduct = 'true';
                option.dataset.memberProductId = mp.id;
                option.dataset.productType = productType;
                option.dataset.productId = mp.product && mp.product.id != null ? String(mp.product.id) : '';
                option.dataset.actualPurchasePrice = actualPurchasePrice;
                option.dataset.totalCount = totalCount;
                option.dataset.bundleUsageCount = String(bundleForUnitPrice);
                option.dataset.expiryDate = mp.expiryDate || '';
                const coachName = (mp.coach && mp.coach.name) || (mp.product && mp.product.coach && mp.product.coach.name) || '\uBBF8\uC9C0\uC815';
                const coachId = (mp.coach && mp.coach.id != null)
                    ? mp.coach.id
                    : (mp.product && mp.product.coach && mp.product.coach.id != null ? mp.product.coach.id : '');
                option.dataset.coachId = coachId != null ? String(coachId) : '';
                option.dataset.coachName = coachName;
                allAvailableProducts.push({
                    type: 'memberProduct',
                    id: mp.id,
                    memberProduct: mp,
                    product: mp.product
                });
                freshSelect.appendChild(option);
            });
        }
        
        if (allProducts && allProducts.length > 0) {
            const countPassProducts = allProducts.filter(
                p => (p.type === 'COUNT_PASS' || p.type === 'MONTHLY_PASS' || p.type === 'DAY_PASS') && p.active !== false
            );
            
            if (countPassProducts.length > 0) {
                const separatorOption = new Option('\u2500\u2500 \uC0C1\uD488 \uBAA9\uB85D\uC5D0\uC11C \uC2E0\uADDC \uB4F1\uB85D \u2500\u2500', '');
                separatorOption.disabled = true;
                freshSelect.appendChild(separatorOption);
                
                countPassProducts.forEach(product => {
                    const productName = product.name || '\uC774\uB984 \uC5C6\uC74C';
                    const productType = product.type || '';
                    const productPrice = product.price || 0;
                    const totalCount = product.usageCount || 10;
                    
                    let typeTextNew = '[\uC0C1\uD488]';
                    if (productType === 'COUNT_PASS') typeTextNew = '[\uD68C\uCC28\uAD8C]';
                    else if (productType === 'TIME_PASS') typeTextNew = '[\uAE30\uAC04\uAD8C]';
                    else if (productType === 'MONTHLY_PASS') typeTextNew = '[\uC6D4\uC815\uC561]';
                    else if (productType === 'DAY_PASS') typeTextNew = '[\uC77C\uC77C\uAD8C]';
                    const priceText = App.formatCurrency(productPrice);
                    
                    const optionText = `[\uC2E0\uADDC] ${typeTextNew} ${productName} - ${priceText}`;
                    const option = new Option(optionText, `product_${product.id}`);
                    option.dataset.isMemberProduct = 'false';
                    option.dataset.productId = product.id;
                    option.dataset.productType = productType;
                    option.dataset.actualPurchasePrice = productPrice;
                    option.dataset.totalCount = totalCount;
                    const bundleNew =
                        product.usageCount != null && Number(product.usageCount) > 0
                            ? Number(product.usageCount)
                            : totalCount > 0
                              ? totalCount
                              : 10;
                    option.dataset.bundleUsageCount = String(bundleNew);
                    option.dataset.expiryDate = '';
                    const pc = product.coach;
                    option.dataset.coachId = pc && pc.id != null ? String(pc.id) : '';
                    option.dataset.coachName = pc && pc.name ? String(pc.name) : '';
                    option.dataset.category = product.category || '';
                    allAvailableProducts.push({
                        type: 'product',
                        id: product.id,
                        product: product
                    });
                    freshSelect.appendChild(option);
                });
            }
        }
        
        App.log('연장 모달 - select 옵션 수:', freshSelect.options.length - 1);
        
        const daysInput = document.getElementById('extend-days');
        daysInput.addEventListener('input', function() {
            updateExtendPrice();
        });
        
        function updateExtendPrice() {
            const selectedValue = freshSelect.value;
            const selectedOption = selectedValue ? freshSelect.options[freshSelect.selectedIndex] : null;
            const selectedType = selectedOption ? selectedOption.dataset.productType : '';
            const daysValue = (selectedType === 'MONTHLY_PASS' || selectedType === 'DAY_PASS') ? 1 : (parseInt(daysInput.value) || 0);
            
            if (selectedValue && daysValue > 0) {
                const selectedOption = freshSelect.options[freshSelect.selectedIndex];
                const actualPurchasePrice = parseInt(selectedOption.dataset.actualPurchasePrice, 10) || 0;
                const bundleCount = parseInt(selectedOption.dataset.bundleUsageCount, 10);
                const divisor =
                    bundleCount > 0 ? bundleCount : parseInt(selectedOption.dataset.totalCount, 10) || 10;
                
                if (divisor > 0 && actualPurchasePrice > 0) {
                    const unitPrice = Math.floor(actualPurchasePrice / divisor);
                    const totalPrice = unitPrice * daysValue;
                    document.getElementById('extend-calculated-price').textContent = App.formatCurrency(totalPrice);
                } else {
                    document.getElementById('extend-calculated-price').textContent = '\u20A9' + '0';
                }
            } else {
                document.getElementById('extend-calculated-price').textContent = '-';
            }
        }
        
        freshSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (selectedValue) {
                const selectedOption = this.options[this.selectedIndex];
                const isMemberProduct = selectedOption.dataset.isMemberProduct === 'true';
                toggleExtendDaysField(selectedOption.dataset.productType || '');
                
                if (isMemberProduct) {
                    toggleExtendCoachPickUi(false);
                    const memberProductId = selectedOption.dataset.memberProductId;
                    const selectedMemberProduct = memberProducts.find(mp => mp.id == memberProductId);
                    
                    if (selectedMemberProduct) {
                        if (selectedMemberProduct.expiryDate) {
                            document.getElementById('extend-current-expiry').textContent = App.formatDate(selectedMemberProduct.expiryDate);
                        } else {
                            document.getElementById('extend-current-expiry').textContent = '\uBBF8\uC124\uC815';
                        }
                        
                        const actualPurchasePrice = selectedMemberProduct.actualPurchasePrice || selectedMemberProduct.product?.price || 0;
                        document.getElementById('extend-purchase-price').textContent = App.formatCurrency(actualPurchasePrice);
                        const coachName = (selectedMemberProduct.coach && selectedMemberProduct.coach.name)
                            || (selectedMemberProduct.product && selectedMemberProduct.product.coach && selectedMemberProduct.product.coach.name)
                            || selectedOption.dataset.coachName
                            || '\uBBF8\uC9C0\uC815';
                        document.getElementById('extend-coach').textContent = coachName;
                        showAdminCoachEditor(selectedMemberProduct, selectedMemberProduct.product || null);

                        const mpType = selectedMemberProduct.product?.type || '';
                        const mpStatus = selectedMemberProduct.status || '';
                        const mpRemaining = selectedMemberProduct.remainingCount != null ? Number(selectedMemberProduct.remainingCount) : null;
                        const mpTotal = selectedMemberProduct.totalCount || selectedMemberProduct.product?.usageCount || 0;
                        if (mpType === 'COUNT_PASS' && mpTotal > 0 && (mpStatus === 'USED_UP' || mpRemaining === 0)) {
                            daysInput.value = mpTotal;
                        } else {
                            daysInput.value = '';
                        }
                    } else {
                        document.getElementById('extend-coach').textContent = '-';
                        hideAdminCoachEditor();
                    }
                } else {
                    // \uC2E0\uADDC \uC0C1\uD488: \uC0C1\uD488 category\uBCC4 \uCF54\uCE58 \uBAA9\uB85D \uD544\uD130 + \uAE30\uBCF8\uAC12 \uC790\uB3D9 \uC120\uD0DD
                    toggleExtendCoachPickUi(true);
                    const productId = selectedOption.dataset.productId;
                    const selectedProduct = allProducts.find(p => p.id == productId);
                    
                    if (selectedProduct) {
                        refillExtendCoachSelectForNewProduct(selectedProduct);
                        const coachSel = document.getElementById('extend-coach-select');
                        document.getElementById('extend-current-expiry').textContent = '\uC2E0\uADDC \uB4F1\uB85D';
                        document.getElementById('extend-purchase-price').textContent = App.formatCurrency(selectedProduct.price || 0);
                        const productType = selectedProduct.type || '';
                        const usageCount = selectedProduct.usageCount || parseInt(selectedOption.dataset.totalCount) || 0;
                        if (productType === 'COUNT_PASS' && usageCount > 0) {
                            daysInput.value = usageCount;
                        } else {
                            daysInput.value = '';
                        }
                        var prefCoachId =
                            (selectedProduct.coach && selectedProduct.coach.id != null)
                                ? selectedProduct.coach.id
                                : (selectedOption.dataset.coachId ? parseInt(selectedOption.dataset.coachId, 10) : null);
                        if (coachSel) {
                            var prefStr = prefCoachId != null && !isNaN(prefCoachId) ? String(prefCoachId) : '';
                            if (prefStr && coachSel.querySelector('option[value="' + prefStr + '"]')) {
                                coachSel.value = prefStr;
                            } else if (prefStr) {
                                coachSel.value = '';
                            } else {
                                coachSel.value = '';
                            }
                        }
                    } else {
                        var coachSelEmpty = document.getElementById('extend-coach-select');
                        if (coachSelEmpty) {
                            coachSelEmpty.innerHTML = '<option value="">\uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uC138\uC694...</option>';
                            coachSelEmpty.value = '';
                        }
                    }
                    hideAdminCoachEditor();
                }
                
                updateExtendPrice();
            } else {
                toggleExtendDaysField('');
                toggleExtendCoachPickUi(false);
                document.getElementById('extend-current-expiry').textContent = '-';
                document.getElementById('extend-purchase-price').textContent = '-';
                document.getElementById('extend-coach').textContent = '-';
                document.getElementById('extend-calculated-price').textContent = '-';
                daysInput.value = '';
                hideAdminCoachEditor();
            }
        });

        if (preselectMemberProductId != null && !isNaN(preselectMemberProductId)) {
            const wanted = 'memberProduct_' + preselectMemberProductId;
            for (let i = 0; i < freshSelect.options.length; i++) {
                if (freshSelect.options[i].value === wanted) {
                    freshSelect.selectedIndex = i;
                    freshSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
            }
        }
        if (defaultExtendDays != null && !isNaN(defaultExtendDays) && defaultExtendDays > 0) {
            const di = document.getElementById('extend-days');
            if (di && String(di.value).trim() === '') {
                di.value = String(defaultExtendDays);
                updateExtendPrice();
            }
        }

        App.Modal.open('extend-product-modal');
    } catch (error) {
        App.err('\uC5F0\uC7A5 \uBAA8\uB2EC \uB85C\uB529 \uC624\uB958:', error);
        App.showNotification('\uC0C1\uD488/\uC774\uC6A9\uAD8C \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
    }
}

async function processExtendProduct() {
    const selectedValue = document.getElementById('extend-product-select').value;
    const daysInput = document.getElementById('extend-days').value;
    const memberId = document.getElementById('extend-member-id').value;
    
    if (!selectedValue) {
        App.showNotification('\uC0C1\uD488/\uC774\uC6A9\uAD8C\uC744 \uC120\uD0DD\uD558\uC138\uC694.', 'warning');
        return;
    }
    
    const selectElement = document.getElementById('extend-product-select');
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const isMemberProduct = selectedOption.dataset.isMemberProduct === 'true';
    const productType = selectedOption.dataset.productType;
    
    if (productType && productType !== 'COUNT_PASS' && productType !== 'MONTHLY_PASS' && productType !== 'DAY_PASS') {
        App.showNotification('\uD68C\uCC28\uAD8C, \uC6D4\uC815\uC561, \uC77C\uC77C\uAD8C\uB9CC \uC5F0\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.', 'warning');
        return;
    }
    
    const effectiveDaysInput = (productType === 'MONTHLY_PASS' || productType === 'DAY_PASS') ? '1' : daysInput;
    if (!effectiveDaysInput || effectiveDaysInput.trim() === '') {
        App.showNotification('\uC5F0\uC7A5 \uD68C\uC218\uB97C \uC785\uB825\uD558\uC138\uC694.', 'warning');
        return;
    }
    const daysTrim = effectiveDaysInput.trim();
    if (!isStrictUnsignedIntString(daysTrim)) {
        App.showNotification(NUMERIC_ONLY_MSG, 'warning');
        return;
    }
    const days = parseInt(daysTrim, 10);
    if (days <= 0) {
        App.showNotification('\uC5F0\uC7A5 \uD68C\uC218\uB294 1 \uC774\uC0C1\uC73C\uB85C \uC785\uB825\uD558\uC138\uC694.', 'warning');
        return;
    }
    
    var extendNeedsApprovalNav = false;
    try {
        if (isMemberProduct) {
            const memberProductId = selectedOption.dataset.memberProductId;
            if (productType === 'MONTHLY_PASS' || productType === 'DAY_PASS') {
                const baseProductId = parseInt(selectedOption.dataset.productId, 10);
                if (!baseProductId) {
                    App.showNotification('\uAE30\uC900 \uC0C1\uD488 \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.', 'warning');
                    return;
                }
                let coachId = parseInt(selectedOption.dataset.coachId, 10);
                if (!coachId) {
                    const products = await App.api.get('/products');
                    const p = Array.isArray(products) ? products.find(pr => pr.id === baseProductId) : null;
                    if (p && p.coach && p.coach.id) coachId = p.coach.id;
                }
                if (!coachId) {
                    App.showNotification('\uB2F4\uB2F9 \uCF54\uCE58\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD68C\uC6D0 \uCF54\uCE58 \uB610\uB294 \uC0C1\uD488 \uCF54\uCE58\uB97C \uC124\uC815\uD55C \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.', 'warning');
                    return;
                }
                const monthlyPost = await App.api.post(`/members/${memberId}/products`, {
                    productId: baseProductId,
                    skipPayment: true,
                    coachId: coachId,
                    extendDays: days,
                    productSelectionIntent: 'OWNED_PASS'
                });
                if (monthlyPost && monthlyPost.pendingApproval) {
                    extendNeedsApprovalNav = true;
                    App.showNotification(
                        monthlyPost.message || '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC774\uC6A9\uAD8C\uC774 \uBC18\uC601\uB429\uB2C8\uB2E4.',
                        'info'
                    );
                } else {
                    App.showNotification(
                        productType === 'DAY_PASS'
                            ? '\uC77C\uC77C\uAD8C\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'
                            : '\uC6D4\uC815\uC561 \uC774\uC6A9\uAD8C\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
                        'success'
                    );
                }
            } else {
                const result = await App.api.put(`/member-products/${memberProductId}/extend`, {
                    days: days
                });
                if (result && result.pendingApproval) {
                    extendNeedsApprovalNav = true;
                    App.showNotification(result.message || '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC5F0\uC7A5\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.', 'info');
                } else {
                    App.showNotification(result.message || '\uC0C1\uD488/\uC774\uC6A9\uAD8C\uC774 \uC5F0\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
                }
            }
        } else {
            // \uC0C1\uD488 \uBAA9\uB85D\uC5D0\uC11C \uC2E0\uADDC \uAD6C\uB9E4: \uBAA8\uB2EC\uC758 \uCF54\uCE58 \uC120\uD0DD\uC774 \uCD5C\uC6B0\uC120
            const productId = parseInt(selectedOption.dataset.productId, 10);

            var extendCoachId = null;
            var coachPick = document.getElementById('extend-coach-select');
            if (coachPick && coachPick.value) {
                extendCoachId = parseInt(coachPick.value, 10);
            }
            if (!extendCoachId) {
                const products = await App.api.get('/products');
                const p = Array.isArray(products) ? products.find(pr => pr.id === productId) : null;
                if (p && p.coach && p.coach.id) {
                    extendCoachId = p.coach.id;
                }
            }
            if (!extendCoachId || isNaN(extendCoachId)) {
                App.showNotification(
                    '\uB2F4\uB2F9 \uCF54\uCE58\uB97C \uC120\uD0DD\uD558\uAC70\uB098, \uD68C\uC6D0/\uC0C1\uD488\uC5D0 \uB2F4\uB2F9 \uCF54\uCE58\uB97C \uC124\uC815\uD574 \uC8FC\uC138\uC694.',
                    'warning'
                );
                return;
            }

            const result = await App.api.post(`/members/${memberId}/products`, {
                productId: productId,
                skipPayment: true,
                coachId: extendCoachId,
                extendDays: days,
                productSelectionIntent: 'NEW_CATALOG'
            });

            if (result && result.pendingApproval) {
                extendNeedsApprovalNav = true;
                App.showNotification(
                    result.message || '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC774\uC6A9\uAD8C\uC774 \uBC18\uC601\uB429\uB2C8\uB2E4.',
                    'info'
                );
            } else if (result && result.id && productType !== 'MONTHLY_PASS' && productType !== 'DAY_PASS') {
                const extendResult = await App.api.put(`/member-products/${result.id}/extend`, {
                    days: days
                });
                if (extendResult && extendResult.pendingApproval) {
                    extendNeedsApprovalNav = true;
                    App.showNotification(extendResult.message || '\uAD00\uB9AC\uC790·\uB9E4\uB2C8\uC800 \uC2B9\uC778 \uD6C4 \uC5F0\uC7A5\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.', 'info');
                } else {
                    App.showNotification(extendResult.message || '\uC774\uC6A9\uAD8C\uC774 \uC5F0\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
                }
            } else {
                App.showNotification(
                    productType === 'MONTHLY_PASS'
                        ? '\uC6D4\uC815\uC561 \uC774\uC6A9\uAD8C\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'
                        : productType === 'DAY_PASS'
                        ? '\uC77C\uC77C\uAD8C\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'
                        : '\uCC98\uB9AC\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
                    'success'
                );
            }
        }
        
        App.Modal.close('extend-product-modal');

        var roleExt = (App.currentRole || '').toUpperCase();
        if (
            extendNeedsApprovalNav &&
            (roleExt === 'ADMIN' || roleExt === 'MANAGER') &&
            typeof App.goToDashboardMemberApprovals === 'function'
        ) {
            App.goToDashboardMemberApprovals();
            return;
        }

        try {
            const expEl = document.getElementById('expiringMembersModal');
            if (expEl && expEl.style.display === 'flex' && typeof window.openExpiringMembersModal === 'function') {
                await window.openExpiringMembersModal();
            }
        } catch (refreshErr) {
                App.warn('expiring modal refresh', refreshErr);
        }
        
        var extendMidEl = document.getElementById('extend-member-id');
        var extendMid = extendMidEl && extendMidEl.value ? parseInt(extendMidEl.value, 10) : NaN;
        if (!isNaN(extendMid)) {
            await focusMemberRowInPage(extendMid);
            if (currentMemberDetail && currentMemberDetail.id === extendMid) {
                switchTab('products', currentMemberDetail);
                loadMemberProductsForDetail(extendMid);
            }
        } else {
            loadMembers();
        }
    } catch (error) {
        App.err('extend product submit', error);
        const serverErr = error && error.response && error.response.data && error.response.data.error;
        const msg = serverErr || '\uC0C1\uD488/\uC774\uC6A9\uAD8C \uC5F0\uC7A5 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.';
        App.showNotification(typeof msg === 'string' ? msg : '\uC0C1\uD488/\uC774\uC6A9\uAD8C \uC5F0\uC7A5 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.', 'danger');
    }
}

document.addEventListener('afbs-coach-colors-ready', function() {
    var tbody = document.getElementById('members-table-body');
    if (tbody && typeof applyCoachNameColors === 'function') {
        applyCoachNameColors(tbody);
    }
});

document.addEventListener('afbs-operational-coach-filter-changed', function() {
    if (document.getElementById('members-table-body') && typeof loadMembers === 'function') {
        loadMembers(false);
    }
});

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
