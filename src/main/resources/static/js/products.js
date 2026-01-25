// 상품/이용권 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
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
    
    if (type === 'MONTHLY_PASS') {
        // 유효기간에 30일 자동 입력
        if (validityInput) {
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
        
        // 패키지 항목 추가 버튼 비활성화
        if (addPackageItemBtn) {
            addPackageItemBtn.disabled = true;
            addPackageItemBtn.style.opacity = '0.5';
            addPackageItemBtn.style.cursor = 'not-allowed';
        }
        
        // 기존 패키지 항목의 횟수 입력 필드 비활성화
        if (packageItemsContainer) {
            const countSelects = packageItemsContainer.querySelectorAll('.package-item-count');
            countSelects.forEach(select => {
                select.disabled = true;
                select.style.opacity = '0.5';
                select.style.cursor = 'not-allowed';
            });
        }
    } else {
        // 월정기 권이 아닌 경우 패키지 항목 추가 버튼 활성화
        if (addPackageItemBtn) {
            addPackageItemBtn.disabled = false;
            addPackageItemBtn.style.opacity = '1';
            addPackageItemBtn.style.cursor = 'pointer';
        }
        
        // 기존 패키지 항목의 횟수 입력 필드 활성화
        if (packageItemsContainer) {
            const countSelects = packageItemsContainer.querySelectorAll('.package-item-count');
            countSelects.forEach(select => {
                select.disabled = false;
                select.style.opacity = '1';
                select.style.cursor = 'default';
            });
        }
    }
}

let allProducts = []; // 전체 상품 저장

async function loadProducts() {
    try {
        console.log('상품 목록 로드 시작...');
        const response = await App.api.get('/products');
        console.log('API 응답:', response);
        console.log('응답 타입:', typeof response);
        console.log('배열 여부:', Array.isArray(response));
        
        if (Array.isArray(response)) {
            allProducts = response;
            console.log('전체 상품 수:', allProducts.length);
            if (allProducts.length > 0) {
                console.log('첫 번째 상품:', allProducts[0]);
            }
        } else {
            console.error('상품 목록이 배열이 아닙니다:', response);
            allProducts = [];
        }
        
        applyFilters(); // 필터 적용하여 렌더링
    } catch (error) {
        console.error('상품 목록 로드 실패:', error);
        console.error('에러 상세:', error.message, error.stack);
        allProducts = [];
        applyFilters(); // 빈 목록으로라도 렌더링
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">상품이 없습니다.</td></tr>';
        return;
    }
    
    console.log('테이블 렌더링 - 상품 수:', products.length);
    
    tbody.innerHTML = products.map(product => {
        if (!product.id) {
            console.warn('상품 ID가 없습니다:', product);
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
        'RENTAL': 'badge-warning',          // 대관 - 노란색
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
        console.log('상품 수정 모드 - ID:', id);
        title.textContent = '상품 수정';
        loadProductData(id);
    } else {
        console.log('상품 추가 모드');
        title.textContent = '상품 추가';
        // 추가 모드에서는 이미 초기화되었으므로 추가 작업 불필요
    }
    
    App.Modal.open('product-modal');
    
    // 모달이 열린 후 유형이 월정기 권이면 자동 계산 및 횟수 입력 비활성화
    setTimeout(() => {
        const type = document.getElementById('product-type').value;
        if (type === 'MONTHLY_PASS') {
            handleProductTypeChange();
        } else {
            // 월정기 권이 아닌 경우 활성화 상태로 초기화
            handleProductTypeChange();
        }
    }, 100);
}

// 패키지 항목 추가
function addPackageItem(itemName = '', itemCount = '') {
    const container = document.getElementById('package-items-container');
    const productType = document.getElementById('product-type')?.value;
    const isMonthlyPass = productType === 'MONTHLY_PASS';
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'package-item';
    itemDiv.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
    
    itemDiv.innerHTML = `
        <select class="form-control package-item-name" style="flex: 2;">
            <option value="">레슨명 선택</option>
            <option value="야구" ${itemName === '야구' ? 'selected' : ''}>야구</option>
            <option value="필라테스" ${itemName === '필라테스' ? 'selected' : ''}>필라테스</option>
            <option value="트레이닝" ${itemName === '트레이닝' ? 'selected' : ''}>트레이닝</option>
        </select>
        <select class="form-control package-item-count" style="flex: 1;" ${isMonthlyPass ? 'disabled' : ''}>
            <option value="">횟수 선택</option>
            <option value="1" ${itemCount == 1 ? 'selected' : ''}>1회권</option>
            <option value="10" ${itemCount == 10 ? 'selected' : ''}>10회권</option>
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
    console.log('상품 수정 시작 - ID:', id);
    if (!id) {
        console.error('상품 ID가 없습니다!');
        App.showNotification('상품 ID를 찾을 수 없습니다.', 'danger');
        return;
    }
    openProductModal(id);
}

async function loadProductData(id) {
    try {
        console.log('상품 데이터 로드 시작 - ID:', id);
        const product = await App.api.get(`/products/${id}`);
        console.log('로드된 상품 데이터:', product);
        
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name || '';
        document.getElementById('product-type').value = product.type || '';
        document.getElementById('product-category').value = product.category || '';
        document.getElementById('product-price').value = product.price || '';
        document.getElementById('product-validity').value = product.validDays || '';
        document.getElementById('product-conditions').value = product.conditions || '';
        document.getElementById('product-refund-policy').value = product.refundPolicy || '';
        
        // 패키지 항목 로드
        if (product.packageItems) {
            try {
                const packageItems = JSON.parse(product.packageItems);
                packageItems.forEach(item => {
                    addPackageItem(item.name, item.count);
                });
            } catch (e) {
                console.warn('패키지 항목 파싱 실패:', e);
            }
        }
        
        // 수정 모드에서도 유형이 월정기 권이면 날짜 자동 계산 (기존 값이 없을 때만)
        if (product.type === 'MONTHLY_PASS') {
            const validityInput = document.getElementById('product-validity');
            const conditionsInput = document.getElementById('product-conditions');
            const packageItemsContainer = document.getElementById('package-items-container');
            const addPackageItemBtn = document.querySelector('button[onclick="addPackageItem()"]');
            
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
            
            // 패키지 항목 추가 버튼 비활성화
            if (addPackageItemBtn) {
                addPackageItemBtn.disabled = true;
                addPackageItemBtn.style.opacity = '0.5';
                addPackageItemBtn.style.cursor = 'not-allowed';
            }
            
            // 기존 패키지 항목의 횟수 입력 필드 비활성화
            if (packageItemsContainer) {
                const countSelects = packageItemsContainer.querySelectorAll('.package-item-count');
                countSelects.forEach(select => {
                    select.disabled = true;
                    select.style.opacity = '0.5';
                    select.style.cursor = 'not-allowed';
                });
            }
        }
        
        console.log('상품 데이터 로드 완료');
    } catch (error) {
        console.error('상품 데이터 로드 실패:', error);
        App.showNotification('상품 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const type = document.getElementById('product-type').value;
    const category = document.getElementById('product-category').value;
    const priceStr = document.getElementById('product-price').value;
    const validDaysStr = document.getElementById('product-validity').value;
    const conditions = document.getElementById('product-conditions').value.trim();
    const refundPolicy = document.getElementById('product-refund-policy').value.trim();
    
    // 필수 필드 검증
    if (!name) {
        App.showNotification('상품명을 입력해주세요.', 'danger');
        return;
    }
    
    if (!type) {
        App.showNotification('유형을 선택해주세요.', 'danger');
        return;
    }
    
    if (!priceStr || isNaN(parseInt(priceStr)) || parseInt(priceStr) < 0) {
        App.showNotification('올바른 가격을 입력해주세요.', 'danger');
        return;
    }
    
    // 패키지 항목 수집
    const packageItemsArray = [];
    const packageItemElements = document.querySelectorAll('.package-item');
    packageItemElements.forEach(item => {
        const itemName = item.querySelector('.package-item-name').value.trim();
        const itemCountStr = item.querySelector('.package-item-count').value;
        
        if (itemName && itemCountStr) {
            const itemCount = parseInt(itemCountStr);
            if (!isNaN(itemCount) && itemCount > 0) {
                packageItemsArray.push({
                    name: itemName,
                    count: itemCount
                });
            }
        }
    });
    
    const data = {
        name: name,
        type: type,
        category: category || null,
        price: parseInt(priceStr),
        packageItems: packageItemsArray.length > 0 ? JSON.stringify(packageItemsArray) : "",
        conditions: conditions || "",
        refundPolicy: refundPolicy || ""
    };
    
    // validDays는 값이 있을 때만 추가
    if (validDaysStr && validDaysStr.trim() !== '') {
        const validDays = parseInt(validDaysStr);
        if (!isNaN(validDays) && validDays >= 0) {
            data.validDays = validDays;
        }
    }
    
    try {
        const id = document.getElementById('product-id').value;
        const idValue = id ? id.trim() : '';
        console.log('상품 저장 시작 - ID:', idValue, 'ID 타입:', typeof idValue, 'Data:', data);
        
        if (idValue && idValue !== '' && idValue !== 'undefined') {
            // 수정 모드
            console.log(`수정 API 호출: PUT /products/${idValue}`);
            const response = await App.api.put(`/products/${idValue}`, data);
            console.log('상품 수정 완료:', response);
            App.showNotification('상품이 수정되었습니다.', 'success');
        } else {
            // 추가 모드
            console.log('추가 API 호출: POST /products');
            const response = await App.api.post('/products', data);
            console.log('상품 추가 완료:', response);
            
            // 응답 확인
            if (response && response.id) {
                App.showNotification('상품이 추가되었습니다.', 'success');
            } else if (response && response.error) {
                throw new Error(response.message || response.error);
            } else {
                console.warn('상품 추가 응답에 ID가 없습니다:', response);
                App.showNotification('상품이 추가되었습니다.', 'success');
            }
        }
        
        App.Modal.close('product-modal');
        
        // 상품 목록 즉시 새로고침
        await loadProducts();
    } catch (error) {
        console.error('상품 저장 실패:', error);
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
    
    console.log('필터링된 상품 수:', filteredProducts.length, '(전체:', allProducts.length + ')');
    renderProductsTable(filteredProducts);
}
