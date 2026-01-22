// 상품/이용권 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // 필터 초기화
    const filterType = document.getElementById('filter-type');
    if (filterType) {
        filterType.value = ''; // 전체 유형 선택
    }
    loadProducts();
});

let allProducts = []; // 전체 상품 저장

async function loadProducts() {
    try {
        allProducts = await App.api.get('/products');
        console.log('전체 상품 수:', allProducts.length);
        applyFilters(); // 필터 적용하여 렌더링
    } catch (error) {
        console.error('상품 목록 로드 실패:', error);
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
                    conditionsDisplay += `<br><small style="color: var(--text-muted);">${product.conditions}</small>`;
                }
            } catch (e) {
                conditionsDisplay = product.conditions || '-';
            }
        } else {
            conditionsDisplay = product.conditions || '-';
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
        'TRAINING_FITNESS': '💪 트레이닝+필라테스',
        'RENTAL': '🏟️ 대관',
        'GENERAL': '일반'
    };
    return map[category] || '미분류';
}

function getCategoryBadgeClass(category) {
    const map = {
        'BASEBALL': 'badge-primary',
        'TRAINING_FITNESS': 'badge-success',
        'RENTAL': 'badge-warning',
        'GENERAL': 'badge-secondary'
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
}

// 패키지 항목 추가
function addPackageItem(itemName = '', itemCount = '') {
    const container = document.getElementById('package-items-container');
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
        <select class="form-control package-item-count" style="flex: 1;">
            <option value="">횟수 선택</option>
            <option value="1" ${itemCount == 1 ? 'selected' : ''}>1회권</option>
            <option value="10" ${itemCount == 10 ? 'selected' : ''}>10회권</option>
        </select>
        <button type="button" class="btn btn-sm btn-danger" onclick="removePackageItem(this)" style="padding: 8px 12px;">삭제</button>
    `;
    
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
        packageItems: packageItemsArray.length > 0 ? JSON.stringify(packageItemsArray) : null,
        conditions: conditions || null,
        refundPolicy: refundPolicy || null
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
            App.showNotification('상품이 추가되었습니다.', 'success');
        }
        
        App.Modal.close('product-modal');
        await loadProducts(); // await 추가
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
    
    console.log('필터링된 상품 수:', filteredProducts.length, '(전체:', allProducts.length + ')');
    renderProductsTable(filteredProducts);
}
