// 시설/슬롯 설정 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadFacilities();
});

async function loadFacilities() {
    try {
        const facilities = await App.api.get('/facilities');
        renderFacilitiesTable(facilities);
        renderFacilitySelect(facilities);
    } catch (error) {
        console.error('시설 목록 로드 실패:', error);
    }
}

function renderFacilitiesTable(facilities) {
    const tbody = document.getElementById('facilities-table-body');
    
    if (!facilities || facilities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">시설이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = facilities.map(facility => `
        <tr>
            <td>${facility.id}</td>
            <td>${facility.name}</td>
            <td>${facility.location || '-'}</td>
            <td>${facility.capacity || '-'}${facility.capacity ? '명' : ''}</td>
            <td>${facility.hourlyRate ? App.formatCurrency(facility.hourlyRate) : '-'}</td>
            <td>${facility.openTime || '-'} ~ ${facility.closeTime || '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editFacility(${facility.id})" title="시설 ID: ${facility.id}">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteFacility(${facility.id})" title="시설 ID: ${facility.id}">삭제</button>
            </td>
        </tr>
    `).join('');
}

function renderFacilitySelect(facilities) {
    const select = document.getElementById('facility-select');
    select.innerHTML = '<option value="">시설 선택...</option>';
    facilities.forEach(facility => {
        const option = document.createElement('option');
        option.value = facility.id;
        option.textContent = facility.name;
        select.appendChild(option);
    });
}

async function loadSlots() {
    const facilityId = document.getElementById('facility-select').value;
    if (!facilityId) {
        document.getElementById('slots-container').innerHTML = '<p style="color: var(--text-muted);">시설을 선택하세요.</p>';
        return;
    }
    
    try {
        const slots = await App.api.get(`/facilities/${facilityId}/slots`);
        renderSlots(slots);
    } catch (error) {
        console.error('슬롯 로드 실패:', error);
    }
}

function renderSlots(slots) {
    const container = document.getElementById('slots-container');
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    
    container.innerHTML = `
        <div class="slot-grid">
            ${days.map((day, index) => {
                const daySlots = slots.filter(s => s.dayOfWeek === index + 1);
                return `
                    <div class="slot-day">
                        <div class="slot-day-header">${day}</div>
                        ${daySlots.length > 0 ? daySlots.map(slot => `
                            <div class="slot-time">${slot.startTime} ~ ${slot.endTime}</div>
                            <span class="slot-status ${slot.isOpen ? 'open' : 'closed'}">${slot.isOpen ? '오픈' : '클로즈'}</span>
                        `).join('') : '<div style="color: var(--text-muted); font-size: 12px;">운영 안함</div>'}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function openFacilityModal(id = null) {
    const modal = document.getElementById('facility-modal');
    const title = document.getElementById('facility-modal-title');
    const form = document.getElementById('facility-form');
    
    if (id) {
        title.textContent = `시설 수정 (ID: ${id})`;
        loadFacilityData(id);
    } else {
        title.textContent = '시설 추가';
        form.reset();
        document.getElementById('facility-id').value = '';
        const idDisplay = document.getElementById('facility-id-display');
        if (idDisplay) {
            idDisplay.style.display = 'none';
        }
    }
    
    App.Modal.open('facility-modal');
}

async function loadFacilityData(id) {
    try {
        const facility = await App.api.get(`/facilities/${id}`);
        
        // ID 확인 로그
        console.log(`시설 수정 - ID: ${id}, 이름: ${facility.name}, 위치: ${facility.location || '없음'}`);
        
        document.getElementById('facility-id').value = facility.id;
        document.getElementById('facility-id-value').textContent = facility.id;
        document.getElementById('facility-id-display').style.display = 'block';
        document.getElementById('facility-name').value = facility.name;
        document.getElementById('facility-location').value = facility.location || '';
        document.getElementById('facility-capacity').value = facility.capacity || '';
        document.getElementById('facility-price').value = facility.hourlyRate || '';
        document.getElementById('facility-open-time').value = facility.openTime || '';
        document.getElementById('facility-close-time').value = facility.closeTime || '';
        
        // 장비 체크박스 설정
        if (facility.equipment) {
            const equipmentList = facility.equipment.split(',').map(e => e.trim());
            document.querySelectorAll('#facility-form input[type="checkbox"]').forEach(cb => {
                cb.checked = equipmentList.includes(cb.value);
            });
        }
        
        // 수정 모달 제목에 ID와 이름 표시
        const title = document.getElementById('facility-modal-title');
        if (title) {
            title.textContent = `시설 수정 (ID: ${facility.id} - ${facility.name})`;
        }
    } catch (error) {
        console.error('시설 정보 로드 실패:', error);
        App.showNotification('시설 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveFacility() {
    const name = document.getElementById('facility-name').value;
    const location = document.getElementById('facility-location').value;
    const capacityValue = document.getElementById('facility-capacity').value;
    const priceValue = document.getElementById('facility-price').value;
    const openTimeValue = document.getElementById('facility-open-time').value;
    const closeTimeValue = document.getElementById('facility-close-time').value;
    
    // 필수 필드 검증
    if (!name) {
        App.showNotification('시설 이름을 입력해주세요.', 'danger');
        return;
    }
    
    const data = {
        name: name,
        location: location || null,
        capacity: capacityValue ? parseInt(capacityValue) : null,
        hourlyRate: priceValue ? parseInt(priceValue) : null,
        openTime: openTimeValue || null,
        closeTime: closeTimeValue || null,
        equipment: Array.from(document.querySelectorAll('#facility-form input[type="checkbox"]:checked'))
            .map(cb => cb.value)
            .join(', ') || null,
        active: true
    };
    
    try {
        const id = document.getElementById('facility-id').value;
        if (id) {
            await App.api.put(`/facilities/${id}`, data);
            App.showNotification('시설이 수정되었습니다.', 'success');
        } else {
            await App.api.post('/facilities', data);
            App.showNotification('시설이 추가되었습니다.', 'success');
        }
        
        App.Modal.close('facility-modal');
        loadFacilities();
    } catch (error) {
        console.error('시설 저장 실패:', error);
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

function editFacility(id) {
    openFacilityModal(id);
}

async function deleteFacility(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/facilities/${id}`);
        App.showNotification('시설이 삭제되었습니다.', 'success');
        loadFacilities();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}
