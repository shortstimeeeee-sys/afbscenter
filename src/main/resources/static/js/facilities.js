// 시설/슬롯 설정 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadFacilities();
    
    // 시설 타입 체크박스 변경 이벤트 리스너
    const facilityTypeCheckboxes = document.querySelectorAll('#facility-type-group input[type="checkbox"]');
    facilityTypeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateFacilityType);
    });
});

// 시설 타입 체크박스 변경 시 호출되는 함수
function updateFacilityType() {
    const checkboxes = document.querySelectorAll('#facility-type-group input[type="checkbox"]:checked');
    const hiddenInput = document.getElementById('facility-type');
    
    if (checkboxes.length === 0) {
        hiddenInput.value = '';
        return;
    }
    
    // 모두 선택되면 "ALL"
    if (checkboxes.length === 3) {
        hiddenInput.value = 'ALL';
    } else {
        // 하나만 선택된 경우
        if (checkboxes.length === 1) {
            const value = checkboxes[0].value;
            // 필라테스나 트레이닝은 TRAINING_FITNESS로 매핑
            if (value === 'PILATES' || value === 'TRAINING') {
                hiddenInput.value = 'TRAINING_FITNESS';
            } else {
                hiddenInput.value = value;
            }
        } else {
            // 여러 개 선택된 경우 (2개) - ALL로 처리
            hiddenInput.value = 'ALL';
        }
    }
}

async function loadFacilities() {
    try {
        const facilities = await App.api.get('/facilities');
        renderFacilitiesTable(facilities);
        renderFacilitySelect(facilities);
    } catch (error) {
        App.err('시설 목록 로드 실패:', error);
    }
}

function renderFacilitiesTable(facilities) {
    const tbody = document.getElementById('facilities-table-body');
    
    if (!facilities || facilities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">시설이 없습니다.</td></tr>';
        return;
    }
    
    // 지점 한글 변환
    const getBranchText = (branch) => {
        if (!branch) return '-';
        switch(branch.toUpperCase()) {
            case 'SAHA': return '사하점';
            case 'YEONSAN': return '연산점';
            case 'RENTAL': return '대관';
            default: return branch;
        }
    };
    
    // 시설 타입 한글 변환
    const getFacilityTypeText = (type) => {
        if (!type) return '-';
        switch(type.toUpperCase()) {
            case 'BASEBALL': return '야구';
            case 'TRAINING_FITNESS': return '트레이닝+필라테스';
            case 'RENTAL': return '대관';
            case 'ALL': return '전체';
            default: return type;
        }
    };
    
    tbody.innerHTML = facilities.map(facility => `
        <tr>
            <td>${facility.id}</td>
            <td><strong>${facility.name}</strong></td>
            <td>${getBranchText(facility.branch)}</td>
            <td>${getFacilityTypeText(facility.facilityType)}</td>
            <td>${facility.location || '-'}</td>
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

let lastLoadedSlots = [];

async function loadSlots() {
    const facilityId = document.getElementById('facility-select').value;
    if (!facilityId) {
        document.getElementById('slots-container').innerHTML = '<p style="color: var(--text-muted);">시설을 선택하세요.</p>';
        return;
    }
    
    try {
        const slots = await App.api.get(`/facilities/${facilityId}/slots`);
        lastLoadedSlots = Array.isArray(slots) ? slots : [];
        renderSlots(lastLoadedSlots);
    } catch (error) {
        App.err('슬롯 로드 실패:', error);
    }
}

async function saveSlots() {
    const facilityId = document.getElementById('facility-select').value;
    if (!facilityId || lastLoadedSlots.length === 0) {
        App.showNotification('시설을 선택하고 슬롯을 로드한 뒤 저장해 주세요.', 'info');
        return;
    }
    const body = lastLoadedSlots.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime || null,
        endTime: s.endTime || null,
        isOpen: s.isOpen !== false
    }));
    try {
        await App.api.put(`/facilities/${facilityId}/slots`, body);
        App.showNotification('슬롯이 저장되었습니다. 예약은 이 운영시간 내에서만 가능합니다.', 'success');
        loadSlots();
    } catch (error) {
        App.showApiError(error);
    }
}

function renderSlots(slots) {
    const container = document.getElementById('slots-container');
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    const facilityId = document.getElementById('facility-select').value;
    
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
        ${facilityId ? '<div style="margin-top: 16px;"><button type="button" class="btn btn-primary" onclick="saveSlots()">현재 슬롯을 DB에 저장</button></div>' : ''}
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
        // 체크박스 초기화
        document.querySelectorAll('#facility-type-group input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.getElementById('facility-type').value = '';
        // 소속 지점 초기화 (시설명 입력 시 자동 설정됨)
        document.getElementById('facility-branch').value = 'SAHA';
    }
    
    App.Modal.open('facility-modal');
}

async function loadFacilityData(id) {
    try {
        const facility = await App.api.get(`/facilities/${id}`);
        
        // ID 확인 로그
        App.log(`시설 수정 - ID: ${id}, 이름: ${facility.name}, 위치: ${facility.location || '없음'}`);
        
        document.getElementById('facility-id').value = facility.id;
        document.getElementById('facility-id-value').textContent = facility.id;
        document.getElementById('facility-id-display').style.display = 'block';
        document.getElementById('facility-name').value = facility.name;
        document.getElementById('facility-location').value = facility.location || '';
        // 소속 지점은 시설명 기반으로 자동 설정 (변경 불가)
        const branch = determineBranchFromName(facility.name);
        document.getElementById('facility-branch').value = branch;
        
        // 시설 타입 체크박스 설정
        const facilityType = facility.facilityType || 'BASEBALL';
        const checkboxes = document.querySelectorAll('#facility-type-group input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        
        if (facilityType === 'ALL') {
            // 모두 선택
            checkboxes.forEach(cb => cb.checked = true);
            document.getElementById('facility-type').value = 'ALL';
        } else if (facilityType === 'BASEBALL') {
            document.querySelector('#facility-type-group input[value="BASEBALL"]').checked = true;
            document.getElementById('facility-type').value = 'BASEBALL';
        } else if (facilityType === 'TRAINING_FITNESS') {
            // 필라테스와 트레이닝 모두 체크
            document.querySelector('#facility-type-group input[value="PILATES"]').checked = true;
            document.querySelector('#facility-type-group input[value="TRAINING"]').checked = true;
            document.getElementById('facility-type').value = 'TRAINING_FITNESS';
        } else {
            // 기본값
            document.querySelector('#facility-type-group input[value="BASEBALL"]').checked = true;
            document.getElementById('facility-type').value = 'BASEBALL';
        }
        
        document.getElementById('facility-price').value = facility.hourlyRate || '';
        document.getElementById('facility-open-time').value = facility.openTime || '';
        document.getElementById('facility-close-time').value = facility.closeTime || '';
        
        // 수정 모달 제목에 ID와 이름 표시
        const title = document.getElementById('facility-modal-title');
        if (title) {
            title.textContent = `시설 수정 (ID: ${facility.id} - ${facility.name})`;
        }
    } catch (error) {
        App.err('시설 정보 로드 실패:', error);
        App.showNotification('시설 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 시설명 기반으로 지점 자동 결정
function determineBranchFromName(name) {
    if (!name) return 'SAHA';
    const nameUpper = name.toUpperCase();
    if (nameUpper.includes('연산')) {
        return 'YEONSAN';
    } else if (nameUpper.includes('사하')) {
        return 'SAHA';
    } else {
        // 기본값은 사하점
        return 'SAHA';
    }
}

// 시설명 변경 시 지점 자동 업데이트
function updateBranchFromName() {
    const name = document.getElementById('facility-name').value;
    const branch = determineBranchFromName(name);
    document.getElementById('facility-branch').value = branch;
}

async function saveFacility() {
    const name = document.getElementById('facility-name').value;
    const location = document.getElementById('facility-location').value;
    const priceValue = document.getElementById('facility-price').value;
    const openTimeValue = document.getElementById('facility-open-time').value;
    const closeTimeValue = document.getElementById('facility-close-time').value;
    
    // 필수 필드 검증
    if (!name) {
        App.showNotification('시설 이름을 입력해주세요.', 'danger');
        return;
    }
    
    // 시설 타입 검증
    const facilityType = document.getElementById('facility-type').value;
    if (!facilityType) {
        App.showNotification('시설 타입을 최소 1개 이상 선택해주세요.', 'danger');
        return;
    }
    
    // 소속 지점은 시설명 기반으로 자동 결정 (변경 불가)
    const branch = determineBranchFromName(name);
    document.getElementById('facility-branch').value = branch;
    
    const data = {
        name: name,
        location: location || null,
        branch: branch,
        facilityType: facilityType,
        hourlyRate: priceValue ? parseInt(priceValue) : null,
        openTime: openTimeValue || null,
        closeTime: closeTimeValue || null,
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
        App.err('시설 저장 실패:', error);
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
