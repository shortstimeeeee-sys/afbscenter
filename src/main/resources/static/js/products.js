// 상품/이용권 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
});

async function loadProducts() {
    try {
        const products = await App.api.get('/products');
        renderProductsTable(products);
    } catch (error) {
        console.error('상품 목록 로드 실패:', error);
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-table-body');
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">상품이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.name}</td>
            <td><span class="badge badge-info">${getProductTypeText(product.type)}</span></td>
            <td style="font-weight: 600; color: var(--accent-primary);">${App.formatCurrency(product.price)}</td>
            <td>${(product.validDays || product.validityDays) ? (product.validDays || product.validityDays) + '일' : '무제한'}</td>
            <td>${product.conditions || '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editProduct(${product.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">삭제</button>
            </td>
        </tr>
    `).join('');
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

function openProductModal(id = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    
    if (id) {
        title.textContent = '상품 수정';
        loadProductData(id);
    } else {
        title.textContent = '상품 추가';
        form.reset();
    }
    
    App.Modal.open('product-modal');
}

function editProduct(id) {
    openProductModal(id);
}

async function loadProductData(id) {
    try {
        const product = await App.api.get(`/products/${id}`);
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-type').value = product.type;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-validity').value = product.validDays || product.validityDays || '';
        document.getElementById('product-conditions').value = product.conditions || '';
        document.getElementById('product-refund-policy').value = product.refundPolicy || '';
    } catch (error) {
        App.showNotification('상품 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const type = document.getElementById('product-type').value;
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
    
    const data = {
        name: name,
        type: type,
        price: parseInt(priceStr),
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
        if (id) {
            await App.api.put(`/products/${id}`, data);
            App.showNotification('상품이 수정되었습니다.', 'success');
        } else {
            await App.api.post('/products', data);
            App.showNotification('상품이 추가되었습니다.', 'success');
        }
        
        App.Modal.close('product-modal');
        loadProducts();
    } catch (error) {
        App.showNotification('저장에 실패했습니다.', 'danger');
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
    // 필터 적용 로직
    loadProducts();
}
