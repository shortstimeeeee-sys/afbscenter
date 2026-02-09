// 상품/이용권 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // 이용권 데이터 일괄 수정 버튼은 관리자만 표시
    var batchBtn = document.getElementById('products-batch-update-btn');
    if (batchBtn) batchBtn.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';
    // 필터 초기화
    const filterType = document.getElementById('filter-type');
    if (filterType) {
        filterType.value = ''; // 전체 유형 선택
    }
    loadProducts();
    
    // 유형 변경 시 월정기 권 선택 시 자동 계산
    const productTypeSelect = document.getElementById('product-type');
    if (productTypeSelect) {
        productTypeSelect.addEventListener('change', function() {
            handleProductTypeChange();
        });
    }
});

// 유형 변경 시 처리 (월정기 권 선택 시 자동 계산)
function handleProductTypeChange() {
    const type = document.getElementById('product-type').value;
    const validityInput = document.getElementById('product-validity');
    const conditionsInput = document.getElementById('product-conditions');
    const packageItemsContainer = document.getElementById('package-items-container');
    const addPackageItemBtn = document.querySelector('button[onclick="addPackageItem()"]');
    const usageCountGroup = document.getElementById('usage-count-group');
    const usageCountInput = document.getElementById('product-usage-count');
    const usageConditionsGroup = document.getElementById('usage-conditions-group');
    
    // 회차권인 경우 사용 조건(레슨명/횟수) 입력 필드 표시
    if (type === 'COUNT_PASS') {
        if (usageConditionsGroup) {
            usageConditionsGroup.style.display = 'block';
        }
        if (usageCountGroup) {
            usageCountGroup.style.display = 'none'; // 사용 횟수 필드는 숨김 (사용 조건에서 입력)
        }
        if (usageCountInput) {
            usageCountInput.required = false;
        }
    } else {
        if (usageConditionsGroup) {
            usageConditionsGroup.style.display = 'none';
        }
        if (usageCountGroup) {
            usageCountGroup.style.display = 'none';
        }
        if (usageCountInput) {
            usageCountInput.required = false;
        }
    }
    
    if (type === 'MONTHLY_PASS') {
        // 유효기간 필수 표시
        const validityRequired = document.getElementById('validity-required');
        const validityHint = document.getElementById('validity-hint');
        if (validityRequired) {
            validityRequired.style.display = 'inline';
        }
        if (validityHint) {
            validityHint.textContent = '기간제 상품은 필수 입력 항목입니다. (1 이상)';
            validityHint.style.color = '#dc3545';
        }
        if (validityInput) {
            validityInput.required = true;
            validityInput.min = 1;
            validityInput.value = '30';
        }
        
        // 사용조건에 "시작일로부터 30일" 자동 입력
        if (conditionsInput) {
            const validDays = validityInput ? (validityInput.value || '30') : '30';
            
            // 기존 사용조건이 없거나 비어있으면 자동 입력
            if (!conditionsInput.value || conditionsInput.value.trim() === '') {
                conditionsInput.value = `시작일로부터 ${validDays}일`;
            } else {
                // 기존 값이 날짜 형식이면 "시작일로부터 X일" 형식으로 변경
                const currentValue = conditionsInput.value.trim();
                const datePattern = /~\s*\d{4}\.\s*\d{2}\.\s*\d{2}\./;
                if (datePattern.test(currentValue)) {
                    conditionsInput.value = `시작일로부터 ${validDays}일`;
                } else if (currentValue.startsWith('~')) {
                    // 다른 날짜 형식도 처리
                    conditionsInput.value = `시작일로부터 ${validDays}일`;
                }
                // 이미 "시작일로부터" 형식이면 그대로 유지
            }
        }
        
        // 월정기 권인 경우 사용 조건 섹션 숨김
        const usageConditionsGroup = document.getElementById('usage-conditions-group');
        if (usageConditionsGroup) {
            usageConditionsGroup.style.display = 'none';
        }
    } else {
        // 기간제가 아닌 경우 유효기간 필수 해제
        const validityRequired = document.getElementById('validity-required');
        const validityHint = document.getElementById('validity-hint');
        const validityInput = document.getElementById('product-validity');
        if (validityRequired) {
            validityRequired.style.display = 'none';
        }
        if (validityHint) {
            validityHint.textContent = '0 = 무제한';
            validityHint.style.color = 'var(--text-muted)';
        }
        if (validityInput) {
            validityInput.required = false;
            validityInput.min = 0;
        }
    }
    
    if (type === 'COUNT_PASS') {
        // 회차권인 경우 사용 조건 섹션 표시 및 활성화
        const usageConditionsGroup = document.getElementById('usage-conditions-group');
        if (usageConditionsGroup) {
            usageConditionsGroup.style.display = 'block';
        }
        if (addPackageItemBtn) {
            addPackageItemBtn.disabled = false;
            addPackageItemBtn.style.opacity = '1';
            addPackageItemBtn.style.cursor = 'pointer';
        }
        if (packageItemsContainer) {
            const countSelects = packageItemsContainer.querySelectorAll('.package-item-count');
            countSelects.forEach(select => {
                select.disabled = false;
                select.style.opacity = '1';
                select.style.cursor = 'default';
            });
        }
    } else {
        // 기타 유형인 경우 사용 조건 섹션 숨김
        const usageConditionsGroup = document.getElementById('usage-conditions-group');
        if (usageConditionsGroup) {
            usageConditionsGroup.style.display = 'none';
        }
    }
}

let allProducts = []; // 전체 상품 저장

async function loadProducts() {
    try {
        App.log('상품 목록 로드 시작...');
        const response = await App.api.get('/products');
        App.log('API 응답:', response);
        App.log('응답 타입:', typeof response);
        App.log('배열 여부:', Array.isArray(response));
        
        if (Array.isArray(response)) {
            allProducts = response;
            App.log('전체 상품 수:', allProducts.length);
            if (allProducts.length > 0) {
                App.log('첫 번째 상품:', allProducts[0]);
            }
        } else {
            App.err('상품 목록이 배열이 아닙니다:', response);
            allProducts = [];
        }
        
        renderProductStats(allProducts);
        applyFilters(); // 필터 적용하여 렌더링
    } catch (error) {
        App.err('상품 목록 로드 실패:', error);
        App.err('에러 상세:', error.message, error.stack);
        allProducts = [];
        renderProductStats([]);
        applyFilters(); // 빈 목록으로라도 렌더링
    }
}

function renderProductStats(products) {
    const container = document.getElementById('products-stats-container');
    if (!container) return;
    const list = Array.isArray(products) ? products : [];
    const total = list.length;
    const byType = {};
    const byCategory = {};
    list.forEach(p => {
        const t = p.type || 'UNKNOWN';
        byType[t] = (byType[t] || 0) + 1;
        const c = p.category || 'GENERAL';
        byCategory[c] = (byCategory[c] || 0) + 1;
    });
    const typeOrder = ['COUNT_PASS', 'MONTHLY_PASS', 'TIME_PASS', 'SINGLE_USE', 'TEAM_PACKAGE'];
    const typeLabels = {
        'SINGLE_USE': '단건 대관',
        'TIME_PASS': '시간권',
        'COUNT_PASS': '회차권',
        'MONTHLY_PASS': '월정기',
        'TEAM_PACKAGE': '팀 대관',
        'UNKNOWN': '미분류'
    };
    const categoryOrder = ['BASEBALL', 'TRAINING', 'PILATES', 'TRAINING_FITNESS', 'RENTAL', 'GENERAL'];
    const categoryLabels = {
        'BASEBALL': '⚾ 야구',
        'TRAINING': '💪 트레이닝',
        'PILATES': '🧘 필라테스',
        'TRAINING_FITNESS': '트레이닝+필라테스',
        'RENTAL': '🏟️ 대관',
        'GENERAL': '일반',
        'UNKNOWN': '미분류'
    };
    const typeItems = typeOrder.filter(t => byType[t] > 0).map(t => ({
        label: typeLabels[t] || t,
        count: byType[t],
        itemClass: 'products-stats-item--' + t.toLowerCase().replace(/_/g, '-'),
        filterType: 'type',
        filterValue: t
    }));
    const categoryItems = categoryOrder.filter(c => byCategory[c] > 0).map(c => ({
        label: categoryLabels[c] || c,
        count: byCategory[c],
        itemClass: 'products-stats-item--' + c.toLowerCase().replace(/_/g, '-'),
        filterType: 'category',
        filterValue: c
    }));
    const items = [
        { label: '총 이용권 수', value: total + '개', accent: true, itemClass: '', isTotal: true, filterType: 'all', filterValue: null }
    ].concat(
        typeItems.map(c => ({ label: c.label, value: c.count + '개', accent: false, itemClass: c.itemClass, isTotal: false, filterType: 'type', filterValue: c.filterValue })),
        categoryItems.map(c => ({ label: c.label, value: c.count + '개', accent: false, itemClass: c.itemClass, isTotal: false, filterType: 'category', filterValue: c.filterValue }))
    );
    if (items.length === 1 && items[0].label === '총 이용권 수' && total === 0) {
        container.innerHTML = '<p class="products-stats-loading">등록된 이용권이 없습니다.</p>';
        return;
    }
    container.innerHTML = items.map(item => `
        <div class="products-stats-item products-stats-item-clickable ${item.itemClass || ''}${item.isTotal ? ' stats-total-item' : ''}"
             data-filter-type="${App.escapeHtml(item.filterType || '')}"
             data-filter-value="${App.escapeHtml(item.filterValue != null ? item.filterValue : '')}"
             data-label="${App.escapeHtml(item.label || '')}"
             title="클릭하면 목록 보기"
             role="button"
             tabindex="0">
            <div class="products-stats-item-label">${App.escapeHtml(item.label)}</div>
            <div class="products-stats-item-value${item.accent ? ' accent' : ''}">${App.escapeHtml(item.value)}</div>
        </div>
    `).join('');
    // 이벤트 위임: 컨테이너에서 클릭 처리 (재렌더 후에도 동작 보장)
    if (!container._productsStatsClickBound) {
        container._productsStatsClickBound = true;
        container.addEventListener('click', function(e) {
            var el = e.target.closest('.products-stats-item-clickable');
            if (!el) return;
            var type = el.getAttribute('data-filter-type');
            var value = el.getAttribute('data-filter-value');
            var label = el.getAttribute('data-label');
            openStatsProductModal(type, value, label);
        });
        container.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var el = e.target.closest('.products-stats-item-clickable');
            if (!el) return;
            e.preventDefault();
            var type = el.getAttribute('data-filter-type');
            var value = el.getAttribute('data-filter-value');
            var label = el.getAttribute('data-label');
            openStatsProductModal(type, value, label);
        });
    }
}

/** 통계 항목 클릭 시 해당 조건의 이용권 목록 모달 */
async function openStatsProductModal(filterType, filterValue, titleLabel) {
    var modal = document.getElementById('stats-products-modal');
    var titleEl = document.getElementById('stats-products-modal-title');
    var bodyEl = document.getElementById('stats-products-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = (titleLabel || '이용권') + ' 목록';
    bodyEl.innerHTML = '<p class="products-stats-loading">로딩 중...</p>';
    App.Modal.open('stats-products-modal');
    var typeLabels = { 'SINGLE_USE': '단건 대관', 'TIME_PASS': '시간권', 'COUNT_PASS': '회차권', 'MONTHLY_PASS': '월정기', 'TEAM_PACKAGE': '팀 대관', 'UNKNOWN': '미분류' };
    var categoryLabels = { 'BASEBALL': '야구', 'TRAINING': '트레이닝', 'PILATES': '필라테스', 'TRAINING_FITNESS': '트레이닝+필라테스', 'RENTAL': '대관', 'GENERAL': '일반', 'UNKNOWN': '미분류' };
    try {
        var list = await App.api.get('/products');
        var products = Array.isArray(list) ? list : [];
        if (filterType === 'type' && filterValue) {
            products = products.filter(function(p) { return (p.type || '') === filterValue; });
        } else if (filterType === 'category' && filterValue) {
            products = products.filter(function(p) { return (p.category || 'GENERAL') === filterValue; });
        }
        if (products.length === 0) {
            bodyEl.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">해당 조건의 이용권이 없습니다.</p>';
            return;
        }
        var tableHtml = '<div class="table-container" style="max-height: 60vh; overflow: auto;"><table class="table"><thead><tr><th>이용권명</th><th>유형</th><th>카테고리</th><th>가격</th></tr></thead><tbody>';
        products.forEach(function(p) {
            var typeText = typeLabels[p.type] || p.type || '-';
            var categoryText = categoryLabels[p.category] || p.category || '-';
            tableHtml += '<tr onclick="App.Modal.close(\'stats-products-modal\'); document.getElementById(\'filter-type\').value=\'' + (p.type || '') + '\'; applyFilters();"><td>' + App.escapeHtml(p.name || '-') + '</td><td>' + App.escapeHtml(typeText) + '</td><td>' + App.escapeHtml(categoryText) + '</td><td>' + App.formatCurrency(p.price || 0) + '</td></tr>';
        });
        tableHtml += '</tbody></table></div>';
        bodyEl.innerHTML = tableHtml;
    } catch (err) {
        App.err('통계 이용권 목록 로드 실패:', err);
        bodyEl.innerHTML = '<p style="color: var(--danger); padding: 16px;">목록을 불러오는데 실패했습니다.</p>';
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">이용권이 없습니다.</td></tr>';
        return;
    }
    
    App.log('테이블 렌더링 - 상품 수:', products.length);
    
    tbody.innerHTML = products.map(product => {
        if (!product.id) {
            App.warn('상품 ID가 없습니다:', product);
        }
        
        // 패키지 구성 표시
        let conditionsDisplay = '';
        if (product.packageItems) {
            try {
                const packageItems = JSON.parse(product.packageItems);
                const itemsText = packageItems.map(item => `${item.name} ${item.count}회`).join(', ');
                conditionsDisplay = `<strong style="color: var(--accent-primary);">[패키지]</strong> ${itemsText}`;
                if (product.conditions) {
                    // 월정기 상품의 경우 날짜 표시를 "시작일로부터 X일" 형식으로 변경
                    let conditionsText = product.conditions;
                    if (product.type === 'MONTHLY_PASS' && product.validDays) {
                        // 날짜 패턴 제거하고 "시작일로부터 X일" 형식으로 변경
                        const datePattern = /~\s*\d{4}\.\s*\d{2}\.\s*\d{2}\./g;
                        if (datePattern.test(conditionsText)) {
                            conditionsText = `시작일로부터 ${product.validDays}일`;
                        } else if (conditionsText.trim().startsWith('~')) {
                            // 다른 날짜 형식도 처리
                            conditionsText = `시작일로부터 ${product.validDays}일`;
                        }
                    }
                    conditionsDisplay += `<br><small style="color: var(--text-muted);">${conditionsText}</small>`;
                }
            } catch (e) {
                // 월정기 상품의 경우 날짜 표시를 "시작일로부터 X일" 형식으로 변경
                let conditionsText = product.conditions || '-';
                if (product.type === 'MONTHLY_PASS' && product.validDays) {
                    const datePattern = /~\s*\d{4}\.\s*\d{2}\.\s*\d{2}\./g;
                    if (datePattern.test(conditionsText)) {
                        conditionsText = `시작일로부터 ${product.validDays}일`;
                    } else if (conditionsText.trim().startsWith('~')) {
                        conditionsText = `시작일로부터 ${product.validDays}일`;
                    }
                }
                conditionsDisplay = conditionsText;
            }
        } else {
            // 월정기 상품의 경우 날짜 표시를 "시작일로부터 X일" 형식으로 변경
            let conditionsText = product.conditions || '-';
            if (product.type === 'MONTHLY_PASS' && product.validDays) {
                const datePattern = /~\s*\d{4}\.\s*\d{2}\.\s*\d{2}\./g;
                if (datePattern.test(conditionsText)) {
                    conditionsText = `시작일로부터 ${product.validDays}일`;
                } else if (conditionsText.trim().startsWith('~')) {
                    conditionsText = `시작일로부터 ${product.validDays}일`;
                }
            }
            conditionsDisplay = conditionsText;
        }
        
        return `
        <tr>
            <td>${product.name || '이름 없음'}</td>
            <td><span class="badge badge-info">${getProductTypeText(product.type)}</span></td>
            <td><span class="badge ${getCategoryBadgeClass(product.category)}">${getCategoryText(product.category)}</span></td>
            <td style="font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(product.price || 0)}</td>
            <td>${product.validDays ? product.validDays + '일' : '무제한'}</td>
            <td>${conditionsDisplay}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editProduct(${product.id})" ${!product.id ? 'disabled' : ''}>수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})" ${!product.id ? 'disabled' : ''}>삭제</button>
            </td>
        </tr>
        `;
    }).join('');
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

function getCategoryText(category) {
    const map = {
        'BASEBALL': '⚾ 야구',
        'TRAINING': '💪 트레이닝',
        'PILATES': '🧘 필라테스',
        'TRAINING_FITNESS': '💪 트레이닝+필라테스',
        'RENTAL': '🏟️ 대관',
        'GENERAL': '일반'
    };
    return map[category] || '미분류';
}

function getCategoryBadgeClass(category) {
    const map = {
        'BASEBALL': 'badge-primary',        // 야구 - 파란색
        'TRAINING': 'badge-success',        // 트레이닝 - 초록색
        'PILATES': 'badge-info',            // 필라테스 - 하늘색
        'TRAINING_FITNESS': 'badge-success', // 트레이닝+필라테스 - 초록색
        'RENTAL': 'badge-rental',          // 대관 - 보라색
        'GENERAL': 'badge-secondary'        // 일반 - 회색
    };
    return map[category] || 'badge-secondary';
}

function openProductModal(id = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    
    // 폼 초기화 (항상 실행)
    form.reset();
    document.getElementById('product-id').value = ''; // hidden field 명시적 초기화
    
    // 패키지 항목 컨테이너 초기화
    document.getElementById('package-items-container').innerHTML = '';
    
    if (id) {
        App.log('상품 수정 모드 - ID:', id);
        title.textContent = '이용권 수정';
        loadProductData(id);
    } else {
        App.log('상품 추가 모드');
        title.textContent = '이용권 추가';
        // 추가 모드에서는 이미 초기화되었으므로 추가 작업 불필요
    }
    
    App.Modal.open('product-modal');
    
    // 모달이 열린 후 유형에 따라 필드 표시/숨김 처리
    setTimeout(() => {
        handleProductTypeChange(); // 유형에 따라 필드 표시/숨김 처리
    }, 100);
}

// 패키지 항목 추가
function addPackageItem(itemName = '', itemCount = '') {
    const container = document.getElementById('package-items-container');
    const productType = document.getElementById('product-type')?.value;
    const isMonthlyPass = productType === 'MONTHLY_PASS';
    
    // itemCount를 숫자로 변환하여 비교
    const countValue = itemCount ? parseInt(itemCount) : '';
    const isSelected1 = (countValue === 1 || countValue === '1');
    const isSelected10 = (countValue === 10 || countValue === '10');
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'package-item';
    itemDiv.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
    
    itemDiv.innerHTML = `
        <select class="form-control package-item-name" style="flex: 2;">
            <option value="">레슨명 선택</option>
            <option value="야구" ${itemName === '야구' ? 'selected' : ''}>야구</option>
            <option value="필라테스" ${itemName === '필라테스' ? 'selected' : ''}>필라테스</option>
            <option value="트레이닝" ${itemName === '트레이닝' ? 'selected' : ''}>트레이닝</option>
            <option value="대관" ${itemName === '대관' ? 'selected' : ''}>대관</option>
        </select>
        <select class="form-control package-item-count" style="flex: 1;" ${isMonthlyPass ? 'disabled' : ''}>
            <option value="">횟수 선택</option>
            <option value="1" ${isSelected1 ? 'selected' : ''}>1회권</option>
            <option value="10" ${isSelected10 ? 'selected' : ''}>10회권</option>
        </select>
        <button type="button" class="btn btn-sm btn-danger" onclick="removePackageItem(this)" style="padding: 8px 12px;">삭제</button>
    `;
    
    // 월정기 권인 경우 횟수 입력 필드 비활성화 스타일 적용
    if (isMonthlyPass) {
        const countSelect = itemDiv.querySelector('.package-item-count');
        if (countSelect) {
            countSelect.style.opacity = '0.5';
            countSelect.style.cursor = 'not-allowed';
        }
    }
    
    container.appendChild(itemDiv);
}

// 패키지 항목 삭제
function removePackageItem(button) {
    button.closest('.package-item').remove();
}

function editProduct(id) {
    App.log('상품 수정 시작 - ID:', id);
    if (!id) {
        App.err('상품 ID가 없습니다!');
        App.showNotification('상품 ID를 찾을 수 없습니다.', 'danger');
        return;
    }
    openProductModal(id);
}

async function loadProductData(id) {
    try {
        App.log('상품 데이터 로드 시작 - ID:', id);
        const product = await App.api.get(`/products/${id}`);
        App.log('로드된 상품 데이터:', product);
        
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-type').value = product.type || '';
        document.getElementById('product-category').value = product.category || '';
        document.getElementById('product-price').value = product.price || '';
        document.getElementById('product-validity').value = product.validDays || '';
        
        // usageCount 설정 (회차권인 경우)
        const usageCountInput = document.getElementById('product-usage-count');
        if (usageCountInput) {
            usageCountInput.value = product.usageCount || '';
            App.log('상품 usageCount 로드:', {
                productId: product.id,
                productName: product.name,
                productType: product.type,
                usageCount: product.usageCount
            });
        }
        
        // 회차권인 경우 사용 조건(레슨명/횟수) 로드
        if (product.type === 'COUNT_PASS' && product.packageItems) {
            try {
                const packageItems = JSON.parse(product.packageItems);
                packageItems.forEach(item => {
                    addPackageItem(item.name, item.count);
                });
                // 사용 조건에서 추가 안내사항 추출 (예: "야구 1회권 | 평일만 사용 가능" → "평일만 사용 가능")
                if (product.conditions) {
                    const conditionsParts = product.conditions.split('|');
                    if (conditionsParts.length > 1) {
                        // "|"로 구분되어 있으면 첫 번째 부분은 사용 조건, 나머지는 추가 안내사항
                        const additionalConditions = conditionsParts.slice(1).join('|').trim();
                        document.getElementById('product-conditions').value = additionalConditions;
                    } else {
                        // "|"로 구분되지 않은 경우, "레슨명 N회권" 패턴인지 확인
                        const usageConditionPattern = /^[\w\s]+\s+\d+회권\s*$/;
                        const isUsageConditionPattern = usageConditionPattern.test(product.conditions.trim());
                        if (!isUsageConditionPattern) {
                            // 패턴이 아니면 추가 안내사항으로 간주
                            document.getElementById('product-conditions').value = product.conditions;
                        } else {
                            // 패턴이면 추가 안내사항 필드는 비워둠 (사용 조건에서 이미 로드됨)
                            document.getElementById('product-conditions').value = '';
                        }
                    }
                } else {
                    // conditions가 없으면 추가 안내사항 필드도 비움
                    document.getElementById('product-conditions').value = '';
                }
            } catch (e) {
                App.warn('사용 조건 항목 파싱 실패:', e);
                // 파싱 실패 시에도 추가 안내사항 필드는 비워둠
                document.getElementById('product-conditions').value = '';
            }
        } else {
            // 회차권이 아닌 경우에만 conditions를 추가 안내사항 필드에 넣음
            document.getElementById('product-conditions').value = product.conditions || '';
        }
        
        document.getElementById('product-refund-policy').value = product.refundPolicy || '';
        
        // 수정 모드에서도 유형이 월정기 권이면 날짜 자동 계산 (기존 값이 없을 때만)
        if (product.type === 'MONTHLY_PASS') {
            const validityInput = document.getElementById('product-validity');
            const conditionsInput = document.getElementById('product-conditions');
            
            // 유효기간이 없으면 30일로 설정
            if (validityInput && (!validityInput.value || validityInput.value.trim() === '')) {
                validityInput.value = '30';
            }
            
            // 사용조건에 날짜가 없으면 "시작일로부터 X일" 형식으로 설정
            // 기존 값이 없거나 "-"이거나 비어있거나 날짜 형식이면 자동 설정
            if (conditionsInput) {
                const currentValue = conditionsInput.value ? conditionsInput.value.trim() : '';
                const validDays = product.validDays || 30;
                
                if (!currentValue || currentValue === '' || currentValue === '-') {
                    conditionsInput.value = `시작일로부터 ${validDays}일`;
                } else {
                    // 날짜 형식이면 "시작일로부터 X일" 형식으로 변경
                    const datePattern = /~\s*\d{4}\.\s*\d{2}\.\s*\d{2}\./;
                    if (datePattern.test(currentValue)) {
                        conditionsInput.value = `시작일로부터 ${validDays}일`;
                    } else if (currentValue.startsWith('~')) {
                        conditionsInput.value = `시작일로부터 ${validDays}일`;
                    }
                    // 이미 "시작일로부터" 형식이면 그대로 유지
                }
            }
        }
        
        App.log('상품 데이터 로드 완료');
    } catch (error) {
        App.err('상품 데이터 로드 실패:', error);
        App.showNotification('상품 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 상품 데이터 일괄 수정 (정합성 수정 + 기간제 상품 conditions 업데이트)
async function updateAllProducts() {
    if (!confirm('모든 상품의 데이터를 일괄 수정하시겠습니까?\n\n수정 내용:\n- 회차권: VALID_DAYS null → 0으로 설정\n- 기간제: USAGE_COUNT 설정됨 → null로 설정\n- 기간제: PACKAGE_ITEMS 빈 문자열 → null로 설정\n- 기간제: conditions를 "시작일로부터 X일" 형식으로 업데이트')) {
        return;
    }
    
    try {
        App.showNotification('상품 데이터 일괄 수정 중...', 'info');
        const response = await App.api.post('/products/batch-update-all', {});
        
        if (response && response.success) {
            const totalCount = response.totalCount || 0;
            const fixedCount = response.fixedCount || 0;
            const conditionsUpdatedCount = response.conditionsUpdatedCount || 0;
            const errorCount = response.errorCount || 0;
            
            let message = `전체 ${totalCount}개 상품 중 ${fixedCount}개 수정 완료`;
            if (conditionsUpdatedCount > 0) {
                message += ` (기간제 conditions: ${conditionsUpdatedCount}개)`;
            }
            if (errorCount > 0) {
                message += ` (오류: ${errorCount}개)`;
            }
            
            if (response.fixDetails && response.fixDetails.length > 0) {
                App.log('수정 상세 정보:', response.fixDetails);
            }
            
            if (errorCount === 0) {
                App.showNotification(message, 'success');
            } else {
                App.showNotification(message, 'warning');
            }
            
            // 상품 목록 새로고침
            loadProducts();
        } else if (response && response.error) {
            App.showNotification(`수정 실패: ${response.error}`, 'danger');
        } else {
            App.showNotification('수정 중 오류가 발생했습니다.', 'danger');
        }
    } catch (error) {
        App.err('상품 데이터 일괄 수정 실패:', error);
        var msg = '상품 데이터 일괄 수정에 실패했습니다.';
        if (error && error.response) {
            if (error.response.status === 403) msg = '상품 데이터 일괄 수정은 관리자만 사용할 수 있습니다.';
            else if (error.response.data && error.response.data.error) msg = error.response.data.error;
        }
        App.showNotification(msg, 'danger');
    }
}

// 기간제 상품의 conditions 일괄 업데이트 (레거시 - 사용 안 함)
async function updateMonthlyPassConditions() {
    if (!confirm('기간제 상품(MONTHLY_PASS)의 모든 사용 조건을 "시작일로부터 X일" 형식으로 일괄 업데이트하시겠습니까?\n\n모든 기간제 상품의 conditions가 정확하게 업데이트됩니다.')) {
        return;
    }
    
    try {
        App.showNotification('기간제 상품 업데이트 중...', 'info');
        const response = await App.api.post('/products/batch-update-monthly-pass-conditions', {});
        
        if (response && response.success) {
            const totalCount = response.totalCount || 0;
            const updatedCount = response.updatedCount || 0;
            const errorCount = response.errorCount || 0;
            const verifiedCount = response.verifiedCount || 0;
            
            let message = `기간제 상품 ${totalCount}개 중 ${updatedCount}개 업데이트 완료`;
            if (verifiedCount > 0) {
                message += ` (검증 완료: ${verifiedCount}개)`;
            }
            if (errorCount > 0) {
                message += ` (오류: ${errorCount}개)`;
            }
            
            // 상세 정보가 있으면 콘솔에 출력
            if (response.updateDetails && response.updateDetails.length > 0) {
                App.log('업데이트 상세 정보:', response.updateDetails);
                const errorDetails = response.updateDetails.filter(d => d.status === 'error' || d.status === 'failed');
                if (errorDetails.length > 0) {
                    App.warn('업데이트 실패 항목:', errorDetails);
                }
            }
            
            if (errorCount === 0 && verifiedCount === updatedCount) {
                App.showNotification(message, 'success');
            } else if (errorCount === 0) {
                App.showNotification(message, 'warning');
            } else {
                App.showNotification(message, 'warning');
            }
            
            // 상품 목록 새로고침
            loadProducts();
        } else if (response && response.error) {
            App.showNotification(`업데이트 실패: ${response.error}`, 'danger');
            if (response.updateDetails) {
                App.err('업데이트 상세 정보:', response.updateDetails);
            }
        } else {
            App.showNotification('업데이트 중 오류가 발생했습니다.', 'danger');
        }
    } catch (error) {
        App.err('기간제 상품 업데이트 실패:', error);
        App.showNotification('기간제 상품 업데이트에 실패했습니다: ' + (error.message || '알 수 없는 오류'), 'danger');
    }
}

async function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const type = document.getElementById('product-type').value;
    const category = document.getElementById('product-category').value;
    const priceStr = document.getElementById('product-price').value;
    const validDaysStr = document.getElementById('product-validity').value;
    const additionalConditions = document.getElementById('product-conditions').value.trim(); // 추가 안내사항
    const refundPolicy = document.getElementById('product-refund-policy').value.trim();
    
    // 필수 필드 검증
    if (!name || name.trim() === '') {
        App.showNotification('⚠️ 상품명은 필수 입력 항목입니다. 상품명을 입력해주세요.', 'danger');
        document.getElementById('product-name').focus();
        return;
    }
    
    if (!type) {
        App.showNotification('⚠️ 상품 유형은 필수 선택 항목입니다. 유형을 선택해주세요.', 'danger');
        document.getElementById('product-type').focus();
        return;
    }
    
    if (!category) {
        App.showNotification('⚠️ 카테고리는 필수 선택 항목입니다. 카테고리를 선택해주세요.', 'danger');
        document.getElementById('product-category').focus();
        return;
    }
    
    if (!priceStr || isNaN(parseInt(priceStr)) || parseInt(priceStr) < 0) {
        App.showNotification('⚠️ 가격은 필수 입력 항목이며 0 이상의 숫자여야 합니다. 올바른 가격을 입력해주세요.', 'danger');
        document.getElementById('product-price').focus();
        return;
    }
    
    const data = {
        name: name,
        type: type,
        category: category,
        price: parseInt(priceStr),
        refundPolicy: refundPolicy || ""
    };
    
    // 기간제(MONTHLY_PASS)인 경우 validDays 필수 검증
    if (type === 'MONTHLY_PASS') {
        if (!validDaysStr || validDaysStr.trim() === '' || isNaN(parseInt(validDaysStr)) || parseInt(validDaysStr) <= 0) {
            App.showNotification('⚠️ 기간제 상품은 유효기간(일)이 필수 입력 항목입니다. 1 이상의 숫자를 입력해주세요.', 'danger');
            document.getElementById('product-validity').focus();
            return;
        }
        const validDays = parseInt(validDaysStr);
        if (validDays <= 0) {
            App.showNotification('⚠️ 유효기간(일)은 1 이상이어야 합니다. 올바른 값을 입력해주세요.', 'danger');
            document.getElementById('product-validity').focus();
            return;
        }
        data.validDays = validDays;
    } else {
        // 기간제가 아닌 경우 validDays는 0 또는 null
        if (validDaysStr && validDaysStr.trim() !== '') {
            const validDays = parseInt(validDaysStr);
            if (!isNaN(validDays) && validDays >= 0) {
                data.validDays = validDays;
            }
        } else {
            // 회차권인 경우 0으로 설정
            if (type === 'COUNT_PASS') {
                data.validDays = 0;
            }
        }
    }
    
    // 회차권인 경우 사용 조건(레슨명/횟수) 수집
    if (type === 'COUNT_PASS') {
        const packageItemElements = document.querySelectorAll('.package-item');
        if (packageItemElements.length === 0) {
            App.showNotification('회차권인 경우 사용 조건(레슨명과 횟수)을 최소 1개 이상 입력해주세요.', 'danger');
            return;
        }
        
        const packageItemsArray = [];
        for (let i = 0; i < packageItemElements.length; i++) {
            const item = packageItemElements[i];
            const itemName = item.querySelector('.package-item-name').value.trim();
            const itemCountStr = item.querySelector('.package-item-count').value;
            
            // 레슨명과 횟수 모두 필수
            if (!itemName) {
                App.showNotification(`사용 조건 ${i + 1}번 항목의 레슨명을 선택해주세요.`, 'danger');
                return;
            }
            if (!itemCountStr) {
                App.showNotification(`사용 조건 ${i + 1}번 항목의 횟수를 선택해주세요.`, 'danger');
                return;
            }
            
            const itemCount = parseInt(itemCountStr);
            if (isNaN(itemCount) || itemCount <= 0) {
                App.showNotification(`사용 조건 ${i + 1}번 항목의 횟수가 올바르지 않습니다.`, 'danger');
                return;
            }
            
            packageItemsArray.push({
                name: itemName,
                count: itemCount
            });
        }
        
        // usageCount는 사용 조건의 모든 항목 횟수 합계
        const usageCount = packageItemsArray.reduce((sum, item) => sum + (item.count || 0), 0);
        if (usageCount <= 0) {
            App.showNotification('회차권인 경우 사용 조건의 횟수 합계가 1 이상이어야 합니다.', 'danger');
            return;
        }
        
        // 사용 조건을 텍스트로 변환 (예: "야구 1회권")
        const conditionsText = packageItemsArray.map(item => `${item.name} ${item.count}회권`).join(', ');
        
        data.packageItems = JSON.stringify(packageItemsArray); // JSON 형태로도 저장
        data.conditions = conditionsText; // 사용 조건 텍스트로 저장
        data.usageCount = usageCount; // 횟수 합계를 usageCount로 저장
        
        // 추가 안내사항이 있으면 사용 조건에 추가
        if (additionalConditions && additionalConditions.trim() !== '') {
            data.conditions = conditionsText + (conditionsText ? ' | ' : '') + additionalConditions;
        }
        
        App.log('상품 저장 - usageCount 설정:', {
            type: type,
            usageCount: usageCount,
            packageItems: packageItemsArray,
            conditions: data.conditions
        });
    } else {
        // 회차권이 아닌 경우
        data.packageItems = "";
        data.conditions = additionalConditions || "";
    }
    
    // 최종 필수 필드 재검증 (데이터 구성 후)
    if (!data.name || data.name.trim() === '') {
        App.showNotification('⚠️ 상품명은 필수 입력 항목입니다.', 'danger');
        return;
    }
    if (!data.type) {
        App.showNotification('⚠️ 상품 유형은 필수 선택 항목입니다.', 'danger');
        return;
    }
    if (!data.category) {
        App.showNotification('⚠️ 카테고리는 필수 선택 항목입니다.', 'danger');
        return;
    }
    if (data.price == null || data.price < 0) {
        App.showNotification('⚠️ 가격은 필수 입력 항목이며 0 이상이어야 합니다.', 'danger');
        return;
    }
    if (data.type === 'MONTHLY_PASS' && (data.validDays == null || data.validDays <= 0)) {
        App.showNotification('⚠️ 기간제 상품은 유효기간(일)이 필수이며 1 이상이어야 합니다.', 'danger');
        return;
    }
    if (data.type === 'COUNT_PASS' && (!data.usageCount || data.usageCount <= 0)) {
        App.showNotification('⚠️ 회차권 상품은 사용 횟수가 필수이며 1 이상이어야 합니다.', 'danger');
        return;
    }
    
    try {
        const id = document.getElementById('product-id').value;
        const idValue = id ? id.trim() : '';
        App.log('상품 저장 시작 - ID:', idValue, 'ID 타입:', typeof idValue, 'Data:', data);
        
        if (idValue && idValue !== '' && idValue !== 'undefined') {
            // 수정 모드
            App.log(`수정 API 호출: PUT /products/${idValue}`);
            App.log('전송할 데이터:', JSON.stringify(data, null, 2));
            const response = await App.api.put(`/products/${idValue}`, data);
            App.log('상품 수정 완료:', response);
            App.log('응답의 usageCount:', response.usageCount);
            App.showNotification('상품이 수정되었습니다.', 'success');
        } else {
            // 추가 모드
            App.log('추가 API 호출: POST /products');
            const response = await App.api.post('/products', data);
            App.log('상품 추가 완료:', response);
            
            // 응답 확인
            if (response && response.id) {
                App.showNotification('상품이 추가되었습니다.', 'success');
            } else if (response && response.error) {
                throw new Error(response.message || response.error);
            } else {
                App.warn('상품 추가 응답에 ID가 없습니다:', response);
                App.showNotification('상품이 추가되었습니다.', 'success');
            }
        }
        
        App.Modal.close('product-modal');
        
        // 상품 목록 즉시 새로고침
        await loadProducts();
    } catch (error) {
        App.err('상품 저장 실패:', error);
        App.showNotification('저장에 실패했습니다: ' + (error.message || '알 수 없는 오류'), 'danger');
    }
}

async function deleteProduct(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/products/${id}`);
        App.showNotification('상품이 삭제되었습니다.', 'success');
        loadProducts();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

function applyFilters() {
    const filterType = document.getElementById('filter-type')?.value || '';
    
    let filteredProducts = allProducts;
    
    // 유형 필터 적용
    if (filterType) {
        filteredProducts = filteredProducts.filter(p => p.type === filterType);
    }
    
    // 카테고리 기준 정렬 (야구 → 필라테스 → 트레이닝 순서)
    filteredProducts.sort((a, b) => {
        const categoryOrder = {
            'BASEBALL': 1,      // 야구
            'PILATES': 2,      // 필라테스
            'TRAINING': 3,      // 트레이닝
            'TRAINING_FITNESS': 3, // 트레이닝+필라테스
            'RENTAL': 4,       // 대관
            'GENERAL': 5       // 일반
        };
        
        const orderA = categoryOrder[a.category] || 99;
        const orderB = categoryOrder[b.category] || 99;
        
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        
        // 같은 카테고리 내에서는 상품명으로 정렬
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'ko');
    });
    
    App.log('필터링된 상품 수:', filteredProducts.length, '(전체:', allProducts.length + ')');
    renderProductsTable(filteredProducts);
}
