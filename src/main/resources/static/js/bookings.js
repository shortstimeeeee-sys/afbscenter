// 예약 관리 페이지 JavaScript (사하/연산 공통)
// 각 HTML에서 스크립트 로드 전에 window.BOOKING_PAGE_CONFIG = { branch, facilityType, ... } 설정 필수.

let currentDate = new Date();
let currentView = 'calendar';
let currentPage = 1;
let selectedBooking = null; // 현재 선택된 예약
// 캘린더 코치 필터 (비어있으면 전체, 클릭 시 해당 코치만, Ctrl+클릭 다중선택)
window.calendarFilterCoachIds = window.calendarFilterCoachIds || new Set();

/** 코치 선택 시 해당 코치 예약이 없을 때 모달로 안내 */
function showCoachEmptyModal() {
    const existing = document.getElementById('coach-empty-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'coach-empty-modal';
    overlay.className = 'modal-overlay active';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '9999';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 360px; margin: 20px;">
            <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 16px 20px;">
                <h2 class="modal-title" style="margin: 0; font-size: 18px;">안내</h2>
                <button type="button" class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); line-height: 1;">×</button>
            </div>
            <div class="modal-body" style="padding: 24px 20px;">
                <p style="margin: 0 0 20px; font-size: 15px; color: var(--text-primary);">해당 코치의 예약이 없습니다.</p>
                <button type="button" class="btn btn-primary" style="width: 100%;">확인</button>
            </div>
        </div>
    `;
    const close = () => {
        overlay.remove();
        document.body.style.overflow = '';
    };
    overlay.querySelector('.modal-close').onclick = close;
    overlay.querySelector('.btn.btn-primary').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
}

// 목적 변경 시 레슨 카테고리 필드 표시/숨김
function toggleLessonCategory() {
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryGroup = document.getElementById('lesson-category-group');
    if (lessonCategoryGroup) {
        lessonCategoryGroup.style.display = (purpose === 'LESSON') ? 'block' : 'none';
        // 레슨 종목이 표시될 때 필터링 적용
        if (purpose === 'LESSON') {
            filterLessonCategoryOptions();
        }
    }
}

// 반복 예약 옵션 표시/숨김
function toggleRepeatOptions() {
    const enabled = document.getElementById('booking-repeat-enabled').checked;
    const repeatOptions = document.getElementById('repeat-options');
    if (repeatOptions) {
        repeatOptions.style.display = enabled ? 'block' : 'none';
    }
}

// 코치별 색상 가져오기 (common.js의 App.CoachColors 사용)
function getCoachColor(coach) {
    try {
        if (!coach) return null;
        if (App && App.CoachColors && typeof App.CoachColors.getColor === 'function') {
            return App.CoachColors.getColor(coach);
        }
        return null;
    } catch (error) {
        App.warn('코치 색상 가져오기 실패:', error);
        return null;
    }
}

// 날짜의 모든 예약에서 코치 색상 추출하여 배경색 결정
function getCoachColors(bookings) {
    const colors = new Set();
    bookings.forEach(booking => {
        // 예약에 직접 할당된 코치 또는 회원의 코치
        const coach = booking.coach || (booking.member && booking.member.coach ? booking.member.coach : null);
        if (coach) {
            const color = getCoachColor(coach);
            if (color) colors.add(color);
        }
    });
    return Array.from(colors);
}

// 배경색 결정 (여러 코치가 있으면 혼합)
function getDayBackgroundColor(coachColors) {
    if (coachColors.length === 0) return null;
    if (coachColors.length === 1) {
        // 단일 색상이면 투명도 적용
        return coachColors[0] + '20'; // 20 = 약 12% 투명도
    }
    // 여러 색상이면 그라데이션 (간단히 첫 번째 색상 사용)
    return coachColors[0] + '15'; // 15 = 약 8% 투명도
}

document.addEventListener('DOMContentLoaded', function() {
    initializeBookings();
    
    // 레슨 종목 필터링 (페이지 타입에 따라)
    filterLessonCategoryOptions();
    
    // 필터 셀렉트/날짜 변경 시 적용 버튼 없이 바로 반영
    const filterCoach = document.getElementById('filter-coach');
    const filterStatus = document.getElementById('filter-status');
    const filterDateStart = document.getElementById('filter-date-start');
    const filterDateEnd = document.getElementById('filter-date-end');
    if (filterCoach) filterCoach.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (filterDateStart) filterDateStart.addEventListener('change', applyFilters);
    if (filterDateEnd) filterDateEnd.addEventListener('change', applyFilters);
    
    // 초기 뷰에 따라 전체 확인 버튼 표시/숨김
    const confirmAllBtn = document.getElementById('btn-confirm-all');
    if (confirmAllBtn) {
        confirmAllBtn.style.display = (currentView === 'list') ? 'inline-block' : 'none';
    }
    
    // Delete 키로 예약 삭제
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' && selectedBooking) {
            e.preventDefault();
            deleteSelectedBooking();
        }
    });
});

// 원본 레슨 종목 옵션 저장
let originalLessonCategoryOptions = null;

// 원본 레슨 종목 옵션 초기화 (필요시)
function initializeOriginalLessonCategoryOptions() {
    const lessonCategorySelect = document.getElementById('booking-lesson-category');
    if (!lessonCategorySelect) return;
    
    // 원본 옵션이 없으면 현재 옵션을 원본으로 저장
    if (!originalLessonCategoryOptions || originalLessonCategoryOptions.length === 0) {
        originalLessonCategoryOptions = Array.from(lessonCategorySelect.options).map(opt => ({
            value: opt.value,
            text: opt.text
        }));
        App.log('[레슨 종목] 원본 옵션 초기화:', originalLessonCategoryOptions);
    }
}

// 레슨 종목 옵션 필터링
function filterLessonCategoryOptions() {
    const config = window.BOOKING_PAGE_CONFIG || {};
    const facilityType = config.facilityType;
    const lessonCategorySelect = document.getElementById('booking-lesson-category');
    
    if (!lessonCategorySelect) return;
    
    // 이미 선택된 유효한 값 보존 (상품 선택 등으로 설정된 경우)
    const previousValue = lessonCategorySelect.value;
    const hadValidSelection = previousValue && previousValue.length > 0;
    
    // 원본 옵션 초기화 (필요시)
    initializeOriginalLessonCategoryOptions();
    
    // 원본 옵션이 없으면 필터링 불가
    if (!originalLessonCategoryOptions || originalLessonCategoryOptions.length === 0) {
        App.warn('[레슨 종목 필터링] 원본 옵션이 없어 필터링 불가');
        return;
    }
    
    // facilityType 또는 lessonCategory에 따라 필터링
    const lessonCategoryFilter = config.lessonCategory || (facilityType === 'YOUTH_BASEBALL' ? 'YOUTH_BASEBALL' : null);
    if (lessonCategoryFilter === 'YOUTH_BASEBALL') {
        // 유소년 야구만 표시하고 고정
        lessonCategorySelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = 'YOUTH_BASEBALL';
        option.textContent = '유소년 야구';
        option.selected = true;
        lessonCategorySelect.appendChild(option);
        lessonCategorySelect.disabled = true;
        lessonCategorySelect.style.backgroundColor = 'var(--bg-secondary)';
        lessonCategorySelect.style.color = 'var(--text-muted)';
    } else if (facilityType === 'BASEBALL') {
        // 야구만 표시하고 자동 선택 및 고정
        lessonCategorySelect.innerHTML = '';
        const baseballOption = originalLessonCategoryOptions.find(opt => opt.value === 'BASEBALL');
        if (baseballOption) {
            const option = document.createElement('option');
            option.value = baseballOption.value;
            option.textContent = baseballOption.text;
            option.selected = true; // 자동 선택
            lessonCategorySelect.appendChild(option);
        }
        // 야구로 고정 (변경 불가능)
        lessonCategorySelect.disabled = true;
        lessonCategorySelect.style.backgroundColor = 'var(--bg-secondary)';
        lessonCategorySelect.style.color = 'var(--text-muted)';
    } else if (facilityType === 'TRAINING_FITNESS') {
        // 필라테스와 트레이닝만 표시
        lessonCategorySelect.innerHTML = '<option value="">레슨 종목 선택...</option>';
        const pilatesOption = originalLessonCategoryOptions.find(opt => opt.value === 'PILATES');
        const trainingOption = originalLessonCategoryOptions.find(opt => opt.value === 'TRAINING');
        if (pilatesOption) {
            const option = document.createElement('option');
            option.value = pilatesOption.value;
            option.textContent = pilatesOption.text;
            lessonCategorySelect.appendChild(option);
        }
        if (trainingOption) {
            const option = document.createElement('option');
            option.value = trainingOption.value;
            option.textContent = trainingOption.text;
            lessonCategorySelect.appendChild(option);
        }
        // 이전에 유효한 값이 있었으면 복원 (상품 선택으로 설정된 레슨 종목 유지)
        if (hadValidSelection && (previousValue === 'TRAINING' || previousValue === 'PILATES')) {
            const optionExists = Array.from(lessonCategorySelect.options).some(opt => opt.value === previousValue);
            if (optionExists) {
                lessonCategorySelect.value = previousValue;
            }
        }
    }
    // RENTAL이나 기타는 모든 옵션 유지
}

// 필터용 코치 드롭다운 로드 (대관 제외 페이지: 해당 페이지 지정 코치만)
async function loadFilterCoaches() {
    const select = document.getElementById('filter-coach');
    if (!select) return;
    try {
        const config = window.BOOKING_PAGE_CONFIG || {};
        const branch = config.branch;
        const facilityType = config.facilityType;
        const lessonCategory = config.lessonCategory;
        const url = branch ? '/coaches?branch=' + encodeURIComponent(branch) : '/coaches';
        const coaches = await App.api.get(url);
        let activeCoaches = (Array.isArray(coaches) ? coaches : []).filter(c => c.active !== false);
        const spec = (c) => (c.specialties || '').toLowerCase();
        const hasSpec = (c, ...keywords) => keywords.some(k => spec(c).includes(k.toLowerCase()));
        if (lessonCategory === 'YOUTH_BASEBALL') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '유소년', '야구'));
        } else if (facilityType === 'BASEBALL') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '야구'));
        } else if (facilityType === 'TRAINING_FITNESS') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '트레이닝', '필라테스'));
        }
        activeCoaches.sort((a, b) => {
            const orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
            const orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
        });
        const currentValue = select.value;
        select.innerHTML = '<option value="">전체 코치</option>';
        activeCoaches.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id != null ? c.id : 'unassigned';
            opt.textContent = c.name || '(미배정)';
            select.appendChild(opt);
        });
        if (currentValue && activeCoaches.some(c => (c.id != null ? c.id : 'unassigned').toString() === currentValue)) {
            select.value = currentValue;
        }
    } catch (error) {
        App.err('필터 코치 목록 로드 실패:', error);
    }
}

async function initializeBookings() {
    try {
        // 뷰 전환 이벤트
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', function() {
                const view = this.getAttribute('data-view');
                switchView(view);
            });
        });
        
        // 필터용 코치 목록 로드 (해당 페이지 지정 코치만, 대관 제외)
        try {
            await loadFilterCoaches();
        } catch (error) {
            App.err('필터 코치 목록 로드 실패:', error);
        }
        
        // 시설 목록 로드
        try {
            await loadFacilities();
        } catch (error) {
            App.err('시설 목록 로드 실패:', error);
        }
        
        // 코치 목록 로드 (예약 모달용)
        try {
            await loadCoachesForBooking();
        } catch (error) {
            App.err('코치 목록 로드 실패:', error);
        }
        
        // 코치 범례 로드
        try {
            await loadCoachLegend();
        } catch (error) {
            App.err('코치 범례 로드 실패:', error);
        }
        
        if (currentView === 'calendar') {
            try {
                await renderCalendar();
            } catch (error) {
                App.err('달력 렌더링 실패:', error);
                const grid = document.getElementById('calendar-grid');
                if (grid) {
                    grid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger);">달력을 불러오는 중 오류가 발생했습니다.<br>페이지를 새로고침해주세요.</div>';
                }
            }
        } else {
            try {
                loadBookingsList();
            } catch (error) {
                App.err('예약 목록 로드 실패:', error);
            }
        }
        await loadBookingStats();
        // 미수금 등에서 예약 수정 링크로 진입한 경우 (?edit=예약ID) 수정 모달 자동 오픈
        var params = new URLSearchParams(window.location.search);
        var editId = params.get('edit');
        if (editId && /^\d+$/.test(editId)) {
            setTimeout(function() { editBooking(parseInt(editId, 10)); }, 600);
        }
    } catch (error) {
        App.err('예약 페이지 초기화 실패:', error);
    }
}

// 예약 통계 로드 (기간 내 총 예약 + 코치별 예약)
async function loadBookingStats() {
    const container = document.getElementById('bookings-stats-container');
    if (!container) return;
    try {
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
        const filterStart = document.getElementById('filter-date-start')?.value || '';
        const filterEnd = document.getElementById('filter-date-end')?.value || '';
        let startISO, endISO;
        if (filterStart && filterEnd) {
            const start = new Date(filterStart);
            start.setHours(0, 0, 0, 0);
            const end = new Date(filterEnd);
            end.setHours(23, 59, 59, 999);
            startISO = start.toISOString();
            endISO = end.toISOString();
        } else {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            last.setHours(23, 59, 59, 999);
            startISO = first.toISOString();
            endISO = last.toISOString();
        }
        const params = new URLSearchParams({ start: startISO, end: endISO });
        if (config.branch) params.append('branch', config.branch);
        if (config.facilityType) params.append('facilityType', config.facilityType);
        if (config.lessonCategory) params.append('lessonCategory', config.lessonCategory);
        const data = await App.api.get(`/bookings/stats?${params.toString()}`);
        renderBookingStats(data);
    } catch (error) {
        App.err('예약 통계 로드 실패:', error);
        container.innerHTML = '<p class="bookings-stats-loading">예약 통계를 불러올 수 없습니다.</p>';
    }
}

function renderBookingStats(data) {
    const container = document.getElementById('bookings-stats-container');
    if (!container) return;
    window.lastBookingStatsData = data;
    const monthLabel = data.monthLabel || '';
    const total = data.totalCount != null ? data.totalCount : 0;
    const pendingCount = data.pendingCount != null ? data.pendingCount : 0;
    const byCoach = Array.isArray(data.byCoach) ? data.byCoach : [];
    const filterSet = window.calendarFilterCoachIds || new Set();
    if (!monthLabel && total === 0 && byCoach.length === 0) {
        container.innerHTML = '<p class="bookings-stats-loading">기간을 선택 후 적용하면 통계가 표시됩니다.</p>';
        return;
    }
    let html = '<div class="bookings-stats-row">';
    html += `<div class="bookings-stats-total"><span class="bookings-stats-label">${monthLabel} 총 예약</span><span class="bookings-stats-value">${total}건</span>`;
    html += ` <span class="bookings-stats-pending" role="button" tabindex="0" data-pending-count="${pendingCount}" title="클릭 시 승인 대기 목록 보기">승인이 완료되지 않은 예약 ${pendingCount}건</span></div>`;
    if (byCoach.length > 0) {
        html += '<div class="bookings-stats-by-coach">';
        html += byCoach.map(c => {
            const coachKey = c.coachId != null ? c.coachId : 'unassigned';
            const isSelected = filterSet.has(coachKey);
            const coachColor = (c.coachId && App.CoachColors && App.CoachColors.getColor({ id: c.coachId, name: c.coachName })) || null;
            const style = coachColor ? `border-left: 4px solid ${coachColor}; background: ${coachColor}22; color: ${coachColor};` : '';
            const selectedClass = isSelected ? ' bookings-stats-coach-item--selected' : '';
            return `<span class="bookings-stats-coach-item${selectedClass}" data-coach-id="${coachKey}" role="button" tabindex="0" title="클릭: 해당 코치만 보기, Ctrl+클릭: 다중 선택"${style ? ` style="${style}"` : ''}>${App.escapeHtml(c.coachName || '(미배정)')} ${c.count || 0}건</span>`;
        }).join('');
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    if (!container._coachFilterBound) {
        container._coachFilterBound = true;
        container.addEventListener('click', function(e) {
            if (e.target.closest('.bookings-stats-pending')) {
                openPendingApprovalModal();
                return;
            }
            const item = e.target.closest('.bookings-stats-coach-item');
            if (!item) return;
            const rawId = item.getAttribute('data-coach-id');
            const coachKey = rawId === 'unassigned' ? 'unassigned' : (parseInt(rawId, 10) || rawId);
            const set = window.calendarFilterCoachIds;
            if (e.ctrlKey || e.metaKey) {
                if (set.has(coachKey)) set.delete(coachKey);
                else set.add(coachKey);
            } else {
                if (set.size === 1 && set.has(coachKey)) {
                    set.clear();
                } else {
                    set.clear();
                    set.add(coachKey);
                }
            }
            applyCoachFilterFromStats();
        });
        container.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                const pendingEl = e.target.closest('.bookings-stats-pending');
                if (pendingEl) {
                    e.preventDefault();
                    openPendingApprovalModal();
                    return;
                }
            }
            const item = e.target.closest('.bookings-stats-coach-item');
            if (!item) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            const rawId = item.getAttribute('data-coach-id');
            const coachKey = rawId === 'unassigned' ? 'unassigned' : (parseInt(rawId, 10) || rawId);
            const set = window.calendarFilterCoachIds;
            if (e.ctrlKey || e.metaKey) {
                if (set.has(coachKey)) set.delete(coachKey);
                else set.add(coachKey);
            } else {
                if (set.size === 1 && set.has(coachKey)) set.clear();
                else { set.clear(); set.add(coachKey); }
            }
            applyCoachFilterFromStats();
        });
    }

    function applyCoachFilterFromStats() {
        if (window.lastBookingStatsData) renderBookingStats(window.lastBookingStatsData);
        var coachSelect = document.getElementById('filter-coach');
        var set = window.calendarFilterCoachIds;
        if (coachSelect && set) {
            if (set.size === 0) {
                coachSelect.value = '';
            } else if (set.size === 1) {
                var single = set.has('unassigned') ? 'unassigned' : Array.from(set)[0];
                var opt = coachSelect.querySelector('option[value="' + single + '"]');
                coachSelect.value = (opt ? String(single) : '');
            }
        }
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            renderCalendar();
        }
    }
}

// 시설 목록 로드
async function loadFacilities() {
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
        const expectedBranch = config.branch?.toUpperCase();
        
        App.log(`[시설 로드] ========================================`);
        App.log(`[시설 로드] 페이지 설정:`, config);
        App.log(`[시설 로드] 요청 - 지점: ${expectedBranch} (모든 타입의 시설 표시)`);
        App.log(`[시설 로드] ========================================`);
        
        // API 호출 시 지점만 필터링 (타입 필터링 제거 - 모든 시설이 모든 타입 지원)
        const params = new URLSearchParams();
        if (expectedBranch) params.append('branch', expectedBranch);
        // facilityType 파라미터 제거 - 모든 타입의 시설 표시
        
        const apiUrl = `/facilities?${params.toString()}`;
        App.log(`[시설 로드] API 호출: ${apiUrl}`);
        
        const facilities = await App.api.get(apiUrl);
        App.log(`[시설 로드] API 응답 시설 ${facilities.length}개:`, facilities);
        App.log(`[시설 로드] API 응답 상세:`, facilities.map(f => ({ 
            id: f.id, 
            name: f.name, 
            branch: f.branch, 
            type: f.facilityType
        })));
        
        // API 응답에 잘못된 지점의 시설이 포함되어 있는지 확인
        const wrongBranchInResponse = facilities.filter(f => {
            const fb = f.branch?.toString()?.toUpperCase();
            return fb !== expectedBranch;
        });
        if (wrongBranchInResponse.length > 0) {
            App.err(`[시설 로드] ⚠️ API 응답에 잘못된 지점의 시설 포함됨!`, wrongBranchInResponse.map(f => ({ 
                id: f.id, 
                name: f.name, 
                branch: f.branch, 
                expected: expectedBranch 
            })));
            App.err(`[시설 로드] API URL: ${apiUrl}`);
            App.err(`[시설 로드] 요청한 지점: ${expectedBranch}`);
        }
        
        // 해당 지점의 모든 시설만 필터링 (타입 무관)
        const filteredFacilities = facilities.filter(facility => {
            if (!facility) {
                App.warn('[시설 로드] null 또는 undefined 시설 발견');
                return false;
            }
            
            const facilityBranch = facility.branch?.toString()?.toUpperCase();
            
            // null 체크
            if (!facilityBranch) {
                App.warn(`[시설 로드] 시설 데이터 불완전: ${facility.name} (branch: ${facilityBranch})`);
                return false;
            }
            
            const branchMatch = facilityBranch === expectedBranch;
            
            if (!branchMatch) {
                App.log(`[시설 로드] ❌ 지점 불일치 제외: ${facility.name} (지점: ${facilityBranch}, 예상: ${expectedBranch})`);
            } else {
                App.log(`[시설 로드] ✅ 포함: ${facility.name} (지점: ${facilityBranch}, 타입: ${facility.facilityType})`);
            }
            
            return branchMatch;
        });
        
        App.log(`[시설 로드] 최종 필터링된 시설 ${filteredFacilities.length}개:`, filteredFacilities.map(f => ({ id: f.id, name: f.name, branch: f.branch, type: f.facilityType })));
        
        // 필터링 후에도 잘못된 지점의 시설이 있는지 확인
        const wrongBranchFacilities = filteredFacilities.filter(f => {
            const fb = f.branch?.toString()?.toUpperCase();
            return fb !== expectedBranch;
        });
        if (wrongBranchFacilities.length > 0) {
            App.err(`[시설 로드] ⚠️ 필터링 후에도 잘못된 지점의 시설 발견:`, wrongBranchFacilities.map(f => ({ name: f.name, branch: f.branch })));
        }
        
        // 해당 지점의 모든 시설 사용
        const facilitiesToUse = filteredFacilities;
        if (filteredFacilities.length === 0 && facilities.length > 0) {
            App.err(`[시설 로드] ⚠️ ${expectedBranch} 지점에 해당하는 시설이 없습니다!`);
            App.err(`[시설 로드] API 응답 전체 시설:`, facilities.map(f => ({ id: f.id, name: f.name, branch: f.branch, type: f.facilityType })));
        }
        
        const select = document.getElementById('booking-facility');
        if (!select) {
            App.warn('[시설 로드] 시설 select 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 기존 옵션 모두 제거
        select.innerHTML = '<option value="">시설 선택...</option>';
        
        // 필터링된 시설만 추가
        if (facilitiesToUse.length === 0) {
            App.err(`[시설 로드] ❌ ${expectedBranch} 지점에 해당하는 시설이 없습니다!`);
            App.err(`[시설 로드] API 응답 전체 시설 (${facilities.length}개):`, facilities.map(f => ({ 
                id: f.id, 
                name: f.name, 
                branch: f.branch, 
                type: f.facilityType 
            })));
            App.err(`[시설 로드] 필터링 조건: 지점=${expectedBranch} (모든 타입)`);
            
            // 에러 옵션 추가
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = `⚠️ ${expectedBranch} 지점 시설 없음`;
            errorOption.disabled = true;
            select.appendChild(errorOption);
            
            // 사용자에게 알림
            if (facilities.length > 0) {
                const availableBranches = [...new Set(facilities.map(f => f.branch))];
                App.warn(`[시설 로드] 사용 가능한 지점: ${availableBranches.join(', ')}`);
            }
            return;
        }
        
        // 시설 옵션 추가
        App.log(`[시설 로드] 시설 옵션 추가 시작. 시설 수: ${facilitiesToUse.length}`);
        facilitiesToUse.forEach((facility, index) => {
            if (!facility || !facility.id || !facility.name) {
                App.err(`[시설 로드] 잘못된 시설 데이터 (인덱스 ${index}):`, facility);
                return;
            }
            
            const option = document.createElement('option');
            option.value = facility.id.toString();
            option.textContent = facility.name;
            // 시설의 지점 정보를 data 속성에 저장
            if (facility.branch) {
                option.dataset.branch = facility.branch;
            }
            select.appendChild(option);
            App.log(`[시설 로드] 옵션 추가: ${facility.name} (ID: ${facility.id}, 지점: ${facility.branch}, 값: ${option.value})`);
        });
        
        App.log(`[시설 로드] 옵션 추가 완료. 총 옵션 수: ${select.options.length}`);
        App.log(`[시설 로드] 드롭다운 현재 상태:`, {
            value: select.value,
            selectedIndex: select.selectedIndex,
            options: Array.from(select.options).map(opt => ({ value: opt.value, text: opt.textContent }))
        });
        
        // 각 지점별로 첫 번째 시설 자동 선택 및 고정 (새 예약 등록 모드일 때만)
        if (facilitiesToUse.length > 0) {
            const bookingId = document.getElementById('booking-id')?.value;
            // 새 예약 등록 모드일 때만 자동 선택 및 비활성화
            if (!bookingId || bookingId === '') {
                // 필터링된 시설 중에서 올바른 지점의 시설만 다시 필터링 (이중 검증)
                const verifiedFacilities = facilitiesToUse.filter(f => {
                    const fb = f.branch?.toString()?.toUpperCase();
                    const match = fb === expectedBranch;
                    if (!match) {
                        App.err(`[시설 로드] ❌ 필터링된 시설 중 잘못된 지점 발견: ${f.name} (지점: ${fb}, 예상: ${expectedBranch})`);
                    }
                    return match;
                });
                
                if (verifiedFacilities.length === 0) {
                    App.err(`[시설 로드] ❌ 올바른 지점(${expectedBranch})의 시설이 없습니다!`);
                    App.err(`[시설 로드] 필터링된 시설 목록:`, facilitiesToUse.map(f => ({ name: f.name, branch: f.branch })));
                    return;
                }
                
                const selectedFacility = verifiedFacilities[0];
                App.log(`[시설 로드] 첫 번째 시설 선택 시도:`, selectedFacility);
                App.log(`[시설 로드] 선택된 시설 지점 검증: ${selectedFacility.branch} === ${expectedBranch}? ${selectedFacility.branch?.toString()?.toUpperCase() === expectedBranch}`);
                
                // 값 설정 (문자열로 변환)
                const facilityIdStr = selectedFacility.id.toString();
                select.value = facilityIdStr;
                
                App.log(`[시설 로드] 값 설정 후 확인 - 설정값: ${facilityIdStr}, 현재값: ${select.value}, selectedIndex: ${select.selectedIndex}`);
                
                // 선택이 제대로 되었는지 확인
                if (select.value !== facilityIdStr) {
                    App.warn(`[시설 로드] 선택 실패, selectedIndex로 재시도... (설정값: ${facilityIdStr}, 현재값: ${select.value})`);
                    // 강제로 선택 (첫 번째 옵션은 "시설 선택..."이므로 인덱스 1이 첫 번째 시설)
                    if (select.options.length > 1) {
                        select.selectedIndex = 1;
                        App.log(`[시설 로드] selectedIndex 설정 후 - 값: ${select.value}, 텍스트: ${select.options[select.selectedIndex]?.textContent}`);
                    }
                }
                
                // 최종 확인
                if (select.value && select.value !== '') {
                    // 선택된 시설의 지점 정보 확인 및 검증
                    const selectedOption = select.options[select.selectedIndex];
                    const selectedFacilityBranch = selectedFacility.branch?.toString()?.toUpperCase();
                    const expectedBranchUpper = expectedBranch?.toUpperCase();
                    
                    // 지점 불일치 검증 - 절대 허용하지 않음
                    if (selectedFacilityBranch !== expectedBranchUpper) {
                        App.err(`[시설 로드] ❌❌❌ 심각한 오류: 선택된 시설의 지점이 페이지 설정과 불일치!`);
                        App.err(`[시설 로드] 시설: ${selectedFacility.name}`);
                        App.err(`[시설 로드] 시설 지점: ${selectedFacilityBranch}`);
                        App.err(`[시설 로드] 예상 지점: ${expectedBranchUpper}`);
                        App.err(`[시설 로드] 올바른 지점의 시설을 찾는 중...`);
                        
                        // 올바른 지점의 첫 번째 시설 찾기 (필터링된 목록에서)
                        const correctFacility = facilitiesToUse.find(f => {
                            const fb = f.branch?.toString()?.toUpperCase();
                            const match = fb === expectedBranchUpper;
                            if (match) {
                                App.log(`[시설 로드] ✅ 올바른 시설 발견: ${f.name} (ID: ${f.id}, 지점: ${f.branch})`);
                            }
                            return match;
                        });
                        
                        if (correctFacility) {
                            App.log(`[시설 로드] 올바른 시설로 교체: ${correctFacility.name} (지점: ${correctFacility.branch})`);
                            // 올바른 시설로 변경
                            select.value = correctFacility.id.toString();
                            // 선택이 제대로 되었는지 확인
                            if (select.value !== correctFacility.id.toString() && select.options.length > 1) {
                                // 옵션에서 올바른 시설 찾기
                                for (let i = 0; i < select.options.length; i++) {
                                    const opt = select.options[i];
                                    if (opt.value === correctFacility.id.toString()) {
                                        select.selectedIndex = i;
                                        App.log(`[시설 로드] 옵션 인덱스 ${i}로 선택됨`);
                                        break;
                                    }
                                }
                            }
                            // 올바른 시설 정보로 업데이트
                            const updatedFacility = correctFacility;
                            const updatedText = select.options[select.selectedIndex]?.textContent || updatedFacility.name;
                            
                            // 시설 자동 선택 및 고정 (비활성화)
                            select.disabled = true;
                            select.classList.add('facility-fixed');
                            // 오버레이에 선택된 시설명 표시
                            const displayDiv = document.getElementById('facility-selected-display');
                            const nameSpan = document.getElementById('facility-selected-name');
                            if (displayDiv && nameSpan) {
                                nameSpan.textContent = updatedText;
                                displayDiv.style.display = 'flex';
                            }
                            // 시설의 지점 정보로 booking-branch 업데이트
                            const branchInput = document.getElementById('booking-branch');
                            if (branchInput && updatedFacility.branch) {
                                branchInput.value = updatedFacility.branch.toUpperCase();
                                App.log(`[시설 로드] booking-branch 업데이트: ${updatedFacility.branch.toUpperCase()}`);
                            }
                            App.log(`[시설 로드] ✅✅✅ 올바른 시설로 자동 선택 및 고정 완료: ${updatedText} (ID: ${updatedFacility.id}, 지점: ${updatedFacility.branch})`);
                            return;
                        } else {
                            App.err(`[시설 로드] ❌❌❌ 치명적 오류: 올바른 지점(${expectedBranchUpper})의 시설을 찾을 수 없습니다!`);
                            App.err(`[시설 로드] 필터링된 시설 목록:`, facilitiesToUse.map(f => ({ id: f.id, name: f.name, branch: f.branch })));
                            // 시설 선택을 비활성화하고 에러 메시지 표시
                            select.disabled = false;
                            select.classList.remove('facility-fixed');
                            const displayDiv = document.getElementById('facility-selected-display');
                            if (displayDiv) {
                                displayDiv.style.display = 'none';
                            }
                            App.showNotification(`⚠️ ${expectedBranch === 'SAHA' ? '사하점' : '연산점'} 시설을 찾을 수 없습니다. 시설 관리 페이지에서 시설의 지점 정보를 확인해주세요.`, 'danger');
                            return;
                        }
                    }
                    
                    // 지점이 일치하는 경우 정상 처리
                    // 시설 자동 선택 및 고정 (비활성화)
                    select.disabled = true;
                    // CSS 클래스 추가로 스타일 적용
                    select.classList.add('facility-fixed');
                    const selectedText = select.options[select.selectedIndex]?.textContent || selectedFacility.name;
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        nameSpan.textContent = selectedText;
                        displayDiv.style.display = 'flex';
                    }
                    // 시설의 지점 정보로 booking-branch 업데이트
                    const branchInput = document.getElementById('booking-branch');
                    if (branchInput && selectedFacility.branch) {
                        branchInput.value = selectedFacility.branch.toUpperCase();
                        App.log(`[시설 로드] 지점 업데이트: ${selectedFacility.branch.toUpperCase()}`);
                    }
                    App.log(`[시설 로드] ✅ 자동 선택 및 고정 완료: ${selectedText} (ID: ${selectedFacility.id}, 선택값: ${select.value}, 지점: ${selectedFacility.branch}, 옵션 수: ${select.options.length})`);
                } else {
                    App.err(`[시설 로드] ❌ 시설 선택 실패! 선택값이 비어있음.`);
                }
            } else {
                // 수정 모드일 때는 활성화 (기존 시설 유지)
                select.disabled = false;
                select.classList.remove('facility-fixed');
                // 오버레이 숨기기
                const displayDiv = document.getElementById('facility-selected-display');
                if (displayDiv) {
                    displayDiv.style.display = 'none';
                }
                App.log(`[시설 로드] 수정 모드 - 시설 필드 활성화`);
            }
        } else {
            App.warn(`[시설 로드] ${config.branch} 지점에 해당하는 시설이 없습니다.`);
        }
        
        App.log(`[시설 로드] 완료: ${config.branch} 지점 시설 ${facilitiesToUse.length}개 (모든 타입)`);
    } catch (error) {
        App.err('[시설 로드] 시설 목록 로드 실패:', error);
    }
}

// 시설 로드 및 자동 선택 함수 (모달용)
async function loadAndSelectFacility() {
    const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
    const bookingId = document.getElementById('booking-id')?.value;
    const facilitySelect = document.getElementById('booking-facility');
    
    if (!facilitySelect) {
        App.warn('[시설 로드] 시설 select 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 새 예약 등록 모드가 아니면 건너뛰기
    if (bookingId) {
        return;
    }
    
    try {
        // 직접 API 호출하여 시설 로드 (지점만 필터링, 타입 무관)
        const params = new URLSearchParams();
        params.append('branch', config.branch?.toUpperCase());
        // facilityType 파라미터 제거 - 모든 타입의 시설 표시
        const facilities = await App.api.get(`/facilities?${params.toString()}`);
        
        const expectedBranch = config.branch?.toUpperCase();
        const filteredFacilities = facilities.filter(f => {
            return f.branch?.toUpperCase() === expectedBranch;
        });
        
        App.log(`[시설 로드] ${expectedBranch} 지점 시설 ${filteredFacilities.length}개 로드됨 (모든 타입):`, filteredFacilities.map(f => f.name));
        
        if (filteredFacilities.length > 0) {
            // 기존 옵션 모두 제거
            facilitySelect.innerHTML = '<option value="">시설 선택...</option>';
            
            // 시설 옵션 추가
            filteredFacilities.forEach(facility => {
                const option = document.createElement('option');
                option.value = facility.id.toString();
                option.textContent = facility.name;
                // 시설의 지점 정보를 data 속성에 저장
                if (facility.branch) {
                    option.dataset.branch = facility.branch;
                }
                facilitySelect.appendChild(option);
                App.log(`[시설 로드] 옵션 추가: ${facility.name} (ID: ${facility.id}, 지점: ${facility.branch})`);
            });
            
            App.log(`[시설 로드] 옵션 추가 완료. 총 옵션 수: ${facilitySelect.options.length}`);
            
            // 첫 번째 시설 자동 선택 및 고정
            const firstFacility = filteredFacilities[0];
            
            // 값 설정
            facilitySelect.value = firstFacility.id;
            
            // 선택이 제대로 되었는지 확인하고 재시도
            if (facilitySelect.value !== firstFacility.id.toString()) {
                App.warn(`[시설 로드] 선택 실패, selectedIndex로 재시도...`);
                facilitySelect.selectedIndex = 1; // 첫 번째 옵션(시설 선택...) 다음이 첫 번째 시설
            }
            
            // 시설 자동 선택 및 고정 (비활성화)
            facilitySelect.disabled = true;
            facilitySelect.classList.add('facility-fixed');
            // 최종 확인
            const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent || firstFacility.name;
            // 오버레이에 선택된 시설명 표시
            const displayDiv = document.getElementById('facility-selected-display');
            const nameSpan = document.getElementById('facility-selected-name');
            if (displayDiv && nameSpan) {
                nameSpan.textContent = selectedText;
                displayDiv.style.display = 'flex';
            }
            // 시설의 지점 정보로 booking-branch 업데이트
            const branchInput = document.getElementById('booking-branch');
            if (branchInput && firstFacility.branch) {
                branchInput.value = firstFacility.branch.toUpperCase();
                App.log(`[시설 로드] 지점 업데이트: ${firstFacility.branch.toUpperCase()}`);
            }
            App.log(`[시설 로드] 자동 선택 및 고정 완료: ${firstFacility.name} (선택값: ${facilitySelect.value}, 지점: ${firstFacility.branch}, 표시값: ${selectedText})`);
        } else {
            App.err(`[시설 로드] ${expectedBranch} 지점에 해당하는 시설이 없습니다!`);
            facilitySelect.innerHTML = '<option value="">⚠️ 해당 지점 시설 없음</option>';
        }
    } catch (error) {
        App.err('[시설 로드] 시설 로드 실패:', error);
    }
}

// 코치 목록 로드 (예약 모달용, 배정 지점 + 담당 종목 기준으로 범례와 동일)
async function loadCoachesForBooking() {
    try {
        const config = window.BOOKING_PAGE_CONFIG || {};
        const branch = config.branch;
        const facilityType = config.facilityType;
        const lessonCategory = config.lessonCategory;
        const url = branch ? '/coaches?branch=' + encodeURIComponent(branch) : '/coaches';
        const coaches = await App.api.get(url);
        const select = document.getElementById('booking-coach');
        if (!select) return;
        
        let activeCoaches = (Array.isArray(coaches) ? coaches : []).filter(c => c.active !== false);
        const spec = (c) => (c.specialties || '').toLowerCase();
        const hasSpec = (c, ...keywords) => keywords.some(k => spec(c).includes(k.toLowerCase()));
        if (lessonCategory === 'YOUTH_BASEBALL') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '유소년', '야구'));
        } else if (facilityType === 'BASEBALL') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '야구'));
        } else if (facilityType === 'TRAINING_FITNESS') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '트레이닝', '필라테스'));
        }
        activeCoaches.sort((a, b) => {
            const orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
            const orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
        });
        
        select.innerHTML = '<option value="">코치 미지정</option>';
        activeCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
        
        App.log(`코치 ${activeCoaches.length}명 로드됨:`, activeCoaches.map(c => c.name));
    } catch (error) {
        App.err('코치 목록 로드 실패:', error);
    }
}


// 회원의 상품/이용권 목록 로드
async function loadMemberProducts(memberId) {
    try {
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
        const select = document.getElementById('booking-member-product');
        const productInfo = document.getElementById('product-info');
        const productInfoText = document.getElementById('product-info-text');
        
        if (!select) return [];
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || {};
        const facilityType = config.facilityType;
        
        // facilityType에 맞는 productCategory 매핑
        let productCategory = null;
        if (facilityType === 'BASEBALL') {
            productCategory = 'BASEBALL';
        } else if (facilityType === 'TRAINING_FITNESS') {
            productCategory = 'TRAINING_FITNESS';
        }
        
        // 활성 상태인 상품만 필터링
        let activeProducts = memberProducts.filter(mp => mp.status === 'ACTIVE');
        
        // 지점별 필터링: 선택된 지점에 배정된 코치의 이용권만 표시
        const facilitySelect = document.getElementById('booking-facility');
        let allowedCoachIds = null;
        if (facilitySelect && facilitySelect.value) {
            try {
                // 선택된 시설 정보 가져오기
                const facilities = await App.api.get('/facilities');
                const selectedFacility = facilities.find(f => f.id == facilitySelect.value);
                if (selectedFacility && selectedFacility.branch) {
                    const branch = selectedFacility.branch;
                    App.log(`[상품 필터링] 선택된 지점: ${branch}`);
                    
                    // 해당 지점에 배정된 코치 목록 가져오기
                    const branchCoaches = await App.api.get(`/coaches?branch=${branch}`);
                    allowedCoachIds = branchCoaches.map(c => String(c.id));
                    App.log(`[상품 필터링] 지점 "${branch}"에 배정된 코치 ID 목록:`, allowedCoachIds);
                    
                    // 코치가 배정된 이용권만 필터링
                    activeProducts = activeProducts.filter(mp => {
                        // 코치가 없는 이용권은 제외 (지점에 배정된 코치가 없으므로)
                        let coachId = null;
                        if (mp.coach && mp.coach.id) {
                            coachId = String(mp.coach.id);
                        } else if (mp.product?.coach && mp.product.coach.id) {
                            coachId = String(mp.product.coach.id);
                        }
                        
                        if (!coachId) {
                            App.log(`[상품 필터링] ❌ 상품 "${mp.product?.name || '이름 없음'}" 코치 없음 - 제외`);
                            return false;
                        }
                        
                        const isAllowed = allowedCoachIds.includes(coachId);
                        if (!isAllowed) {
                            App.log(`[상품 필터링] ❌ 상품 "${mp.product?.name || '이름 없음'}" 코치 ID ${coachId}가 지점 "${branch}"에 배정되지 않음 - 제외`);
                        } else {
                            App.log(`[상품 필터링] ✅ 상품 "${mp.product?.name || '이름 없음'}" 코치 ID ${coachId}가 지점 "${branch}"에 배정됨 - 포함`);
                        }
                        return isAllowed;
                    });
                }
            } catch (error) {
                App.err('[상품 필터링] 지점별 필터링 실패:', error);
                // 오류 발생 시 필터링하지 않고 계속 진행
            }
        }
        
        // 카테고리별 필터링 (해당 카테고리 또는 GENERAL 또는 null인 이용권만)
        if (productCategory) {
            activeProducts = activeProducts.filter(mp => {
                const category = mp.product?.category;
                // category가 null이거나 GENERAL이면 모든 곳에서 사용 가능
                if (!category || category === 'GENERAL') return true;
                
                // 정확히 일치하는 경우
                if (category === productCategory) return true;
                
                // TRAINING_FITNESS 요청 시: TRAINING_FITNESS, TRAINING, PILATES 모두 포함
                if (productCategory === 'TRAINING_FITNESS') {
                    return category === 'TRAINING_FITNESS' || 
                           category === 'TRAINING' || 
                           category === 'PILATES';
                }
                
                return false;
            });
        }
        
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        const eligibleProducts = activeProducts.filter(mp => {
            const type = mp.product?.type;
            return type === 'COUNT_PASS' || type === 'MONTHLY_PASS' || type === 'TIME_PASS';
        });
        if (paymentMethodSelect && eligibleProducts.length > 0 && !paymentMethodSelect.value) {
            paymentMethodSelect.value = 'PREPAID';
        }

        select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
        
        if (activeProducts.length === 0) {
            if (productInfo) productInfo.style.display = 'none';
            return activeProducts; // 빈 배열 반환
        }
        
        activeProducts.forEach(mp => {
            const option = document.createElement('option');
            option.value = mp.id;
            const product = mp.product;
            // 상품 이름과 가격 표시
            let text = product.name || '상품';
            if (product.price) {
                text += ` - ${App.formatCurrency(product.price)}`;
            }
            
            // 잔여 횟수는 dataset에만 저장 (표시는 하지 않음)
            if (product.type === 'COUNT_PASS') {
                // 백엔드에서 계산된 remainingCount 사용 (실제 예약 데이터 기반)
                // remainingCount가 있으면 사용, 없으면 product.usageCount를 우선 사용 (상품의 실제 사용 횟수 반영)
                let remaining;
                if (mp.remainingCount !== null && mp.remainingCount !== undefined) {
                    remaining = mp.remainingCount;
                } else if (product.usageCount !== null && product.usageCount !== undefined) {
                    // 상품의 실제 usageCount를 우선 사용 (데이터 일관성 보장)
                    remaining = product.usageCount;
                } else if (mp.totalCount !== null && mp.totalCount !== undefined) {
                    remaining = mp.totalCount;
                } else {
                    // 모든 값이 없을 때만 기본값 10 사용
                    remaining = 10;
                }
                option.dataset.remainingCount = remaining;
            } else {
                option.dataset.remainingCount = 0;
            }
            
            option.textContent = text;
            option.dataset.productType = product.type;
            // 상품 카테고리 저장 (레슨 종목 자동 선택용)
            // product.category가 문자열이면 그대로 사용, 객체면 name 속성 사용
            let productCategory = null;
            if (product.category) {
                if (typeof product.category === 'string') {
                    productCategory = product.category;
                } else if (product.category.name) {
                    productCategory = product.category.name;
                } else {
                    productCategory = product.category;
                }
            }
            
            // 상품명으로 카테고리 추론 (카테고리가 없거나 GENERAL일 때)
            if ((!productCategory || productCategory === 'GENERAL') && product.name) {
                const productName = product.name.toLowerCase();
                if (productName.includes('트레이닝') || productName.includes('training')) {
                    productCategory = 'TRAINING';
                    App.log(`[상품 로드] 상품명으로 카테고리 추론: "${product.name}" → TRAINING`);
                } else if (productName.includes('필라테스') || productName.includes('pilates')) {
                    productCategory = 'PILATES';
                    App.log(`[상품 로드] 상품명으로 카테고리 추론: "${product.name}" → PILATES`);
                } else if (productName.includes('야구') || productName.includes('baseball')) {
                    productCategory = 'BASEBALL';
                    App.log(`[상품 로드] 상품명으로 카테고리 추론: "${product.name}" → BASEBALL`);
                }
            }
            
            if (productCategory) {
                option.dataset.productCategory = productCategory;
                App.log(`[상품 로드] 상품 "${product.name}" 최종 카테고리: ${productCategory}`);
            } else {
                App.warn(`[상품 로드] 상품 "${product.name}" 카테고리 없음`);
            }
            // MemberProduct의 코치 ID 저장 (담당 코치 자동 배정용)
            let coachId = null;
            if (mp.coach && mp.coach.id) {
                coachId = String(mp.coach.id); // 문자열로 변환
                App.log(`[상품 로드] MemberProduct에서 코치 찾음: "${product.name}" → 코치 ID ${coachId} (${mp.coach.name || '이름 없음'})`);
            } else if (product.coach && product.coach.id) {
                // MemberProduct에 코치가 없으면 상품의 코치 사용
                coachId = String(product.coach.id); // 문자열로 변환
                App.log(`[상품 로드] Product에서 코치 찾음: "${product.name}" → 코치 ID ${coachId} (${product.coach.name || '이름 없음'})`);
            }
            
            if (coachId) {
                option.dataset.coachId = coachId;
                App.log(`[상품 로드] ✅ 상품 "${product.name}" 코치 ID 저장: ${coachId}`);
            } else {
                App.warn(`[상품 로드] ⚠️ 상품 "${product.name}" 코치 없음`, {
                    mpCoach: mp.coach,
                    productCoach: product.coach,
                    mp: mp,
                    product: product
                });
            }
            select.appendChild(option);
        });
        
        // 상품 선택 시 결제 방식 자동 설정 및 정보 표시, 레슨 종목 및 코치 자동 설정
        select.onchange = async function() {
            const selectedOption = this.options[this.selectedIndex];
            const paymentMethodSelect = document.getElementById('booking-payment-method');
            const coachSelect = document.getElementById('booking-coach');
            const config = window.BOOKING_PAGE_CONFIG || {};
            
            if (selectedOption.value) {
                // 상품 선택 시 선결제로 자동 설정
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = 'PREPAID';
                }
                
                // 담당 코치 ID 먼저 가져오기 (레슨 종목 결정에 사용)
                let coachId = selectedOption.dataset.coachId;
                App.log(`[상품 선택] 초기 코치 ID (dataset): ${coachId || '없음'}`);
                
                // coachId가 없으면 상품 데이터에서 직접 가져오기 시도
                if (!coachId && selectedOption.value) {
                    try {
                        const memberId = document.getElementById('selected-member-id')?.value;
                        App.log(`[상품 선택] 코치 ID가 없어 API에서 가져오기 시도: memberId=${memberId}, productId=${selectedOption.value}`);
                        // 선택된 상품의 실제 데이터 가져오기
                        const memberProducts = await App.api.get(`/member-products?memberId=${memberId || ''}`);
                        const selectedMemberProduct = memberProducts?.find(mp => mp.id == selectedOption.value);
                        if (selectedMemberProduct) {
                            App.log('[상품 선택] API 응답:', selectedMemberProduct);
                            if (selectedMemberProduct.coach && selectedMemberProduct.coach.id) {
                                coachId = String(selectedMemberProduct.coach.id);
                                selectedOption.dataset.coachId = coachId;
                                App.log('[상품 선택] ✅ MemberProduct에서 코치 ID 가져옴:', coachId, selectedMemberProduct.coach.name);
                            } else if (selectedMemberProduct.product && selectedMemberProduct.product.coach && selectedMemberProduct.product.coach.id) {
                                coachId = String(selectedMemberProduct.product.coach.id);
                                selectedOption.dataset.coachId = coachId;
                                App.log('[상품 선택] ✅ Product에서 코치 ID 가져옴:', coachId, selectedMemberProduct.product.coach.name);
                            } else {
                                App.warn('[상품 선택] ⚠️ API 응답에 코치 정보 없음:', selectedMemberProduct);
                            }
                        } else {
                            App.warn('[상품 선택] ⚠️ 선택된 상품을 찾을 수 없음:', selectedOption.value);
                        }
                    } catch (error) {
                        App.err('[상품 선택] ❌ 상품 데이터에서 코치 ID 가져오기 실패:', error);
                    }
                }
                
                App.log(`[상품 선택] 최종 코치 ID: ${coachId || '없음'}`);
                
                // 상품 카테고리에 따라 레슨 종목 자동 선택
                const productCategory = selectedOption.dataset.productCategory;
                const productName = selectedOption.textContent || '';
                // 상품명에서 가격 부분 제거 (예: "트레이닝 10회권 - ₩700,000" → "트레이닝 10회권")
                const productNameOnly = productName.split(' - ')[0].trim();
                App.log('[상품 선택] 상품 선택됨:', {
                    productName: productName,
                    productNameOnly: productNameOnly,
                    productCategory: productCategory,
                    coachId: coachId,
                    dataset: {
                        coachId: selectedOption.dataset.coachId,
                        productCategory: selectedOption.dataset.productCategory,
                        productType: selectedOption.dataset.productType
                    }
                });
                
                let lessonCategory = null;
                let coachInfo = null;
                
                // 방법 1: dataset.productCategory 우선 사용 (가장 확실함)
                if (productCategory) {
                    // 카테고리 → 레슨 종목 매핑
                    if (productCategory === 'BASEBALL') {
                        lessonCategory = 'BASEBALL';
                    } else if (productCategory === 'TRAINING' || productCategory === 'TRAINING_FITNESS') {
                        lessonCategory = 'TRAINING';
                    } else if (productCategory === 'PILATES') {
                        lessonCategory = 'PILATES';
                    }
                    App.log('[상품 선택] 카테고리로 레슨 종목 결정:', lessonCategory, '상품 카테고리:', productCategory);
                }
                
                // 방법 2: 상품명으로 레슨 종목 추론 (카테고리가 없을 때)
                if (!lessonCategory && productNameOnly) {
                    const productNameLower = productNameOnly.toLowerCase();
                    if (productNameLower.includes('트레이닝') || productNameLower.includes('training')) {
                        lessonCategory = 'TRAINING';
                        App.log('[상품 선택] 상품명으로 레슨 종목 결정: TRAINING');
                    } else if (productNameLower.includes('필라테스') || productNameLower.includes('pilates')) {
                        lessonCategory = 'PILATES';
                        App.log('[상품 선택] 상품명으로 레슨 종목 결정: PILATES');
                    } else if (productNameLower.includes('야구') || productNameLower.includes('baseball')) {
                        lessonCategory = 'BASEBALL';
                        App.log('[상품 선택] 상품명으로 레슨 종목 결정: BASEBALL');
                    }
                }
                
                // 방법 3: 상품 카테고리와 상품명으로도 결정되지 않았으면 코치 정보로 레슨 종목 결정
                if (!lessonCategory && coachId) {
                    try {
                        // 코치 정보 가져오기
                        coachInfo = await App.api.get(`/coaches/${coachId}`);
                        if (coachInfo && coachInfo.specialties && coachInfo.specialties.length > 0) {
                            lessonCategory = App.LessonCategory.fromCoachSpecialties(coachInfo.specialties);
                            App.log('[상품 선택] 코치 정보로 레슨 종목 결정:', lessonCategory, '코치:', coachInfo.name);
                        }
                    } catch (error) {
                        App.err('[상품 선택] 코치 정보 로드 실패:', error);
                    }
                }
                
                // 레슨 종목 설정
                if (lessonCategory) {
                    // 목적이 레슨이 아니면 먼저 설정 (레슨 종목 필드가 표시되도록)
                    const purposeEl = document.getElementById('booking-purpose');
                    if (purposeEl && purposeEl.value !== 'LESSON') {
                        purposeEl.value = 'LESSON';
                        toggleLessonCategory();
                        // 레슨 종목 필드가 표시될 때까지 대기
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }
                    
                    // 레슨 종목 셀렉트 다시 가져오기 (DOM이 업데이트되었을 수 있음)
                    const lessonCategorySelect = document.getElementById('booking-lesson-category');
                    if (!lessonCategorySelect) {
                        App.warn('[상품 선택] 레슨 종목 셀렉트를 찾을 수 없음');
                    } else {
                        // 원본 옵션 초기화 (필요시)
                        initializeOriginalLessonCategoryOptions();
                        
                        // 레슨 종목 필터링 먼저 실행 (옵션이 제대로 로드되도록)
                        filterLessonCategoryOptions();
                        
                        // 필터링 완료 대기 (옵션이 추가될 때까지 재시도)
                        let attempts = 0;
                        let optionExists = false;
                        while (attempts < 100) {
                            // 필터링 재실행 (옵션이 제대로 추가되지 않았을 수 있음)
                            if (attempts % 10 === 0) {
                                filterLessonCategoryOptions();
                            }
                            
                            optionExists = Array.from(lessonCategorySelect.options).some(
                                opt => opt.value === lessonCategory
                            );
                            if (optionExists) {
                                break;
                            }
                            await new Promise(resolve => setTimeout(resolve, 30));
                            attempts++;
                        }
                        
                        if (optionExists) {
                            lessonCategorySelect.value = lessonCategory;
                            App.log(`[상품 선택] ✅ 레슨 종목 자동 선택: ${lessonCategory} (상품: ${productNameOnly}, 카테고리: ${productCategory || '없음'})`);
                            
                            // change 이벤트 발생 (다른 로직이 반응하도록)
                            lessonCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            // 모달 열 때 100ms 후 filterLessonCategoryOptions()가 호출되면 값이 리셋될 수 있으므로, 여러 번 재적용
                            const valueToKeep = lessonCategory;
                            [150, 250, 350].forEach(delay => {
                                setTimeout(() => {
                                    const el = document.getElementById('booking-lesson-category');
                                    if (el && Array.from(el.options).some(opt => opt.value === valueToKeep)) {
                                        if (el.value !== valueToKeep) {
                                            el.value = valueToKeep;
                                            App.log(`[상품 선택] 레슨 종목 재적용 (${delay}ms): ${valueToKeep}`);
                                        }
                                    }
                                }, delay);
                            });
                        } else {
                        App.warn(`[상품 선택] ❌ 레슨 종목 옵션 없음: ${lessonCategory}`, {
                            availableOptions: Array.from(lessonCategorySelect.options).map(opt => ({ value: opt.value, text: opt.text })),
                            productCategory,
                            productName: productNameOnly,
                            lessonCategory,
                            coachId,
                            facilityType: config.facilityType,
                            originalOptions: originalLessonCategoryOptions,
                            lessonCategorySelectHTML: lessonCategorySelect.innerHTML
                        });
                        
                        // 옵션이 없어도 강제로 설정 시도 (필터링 문제일 수 있음)
                        // 원본 옵션에서 찾아서 추가
                        if (originalLessonCategoryOptions && originalLessonCategoryOptions.length > 0) {
                            const originalOption = originalLessonCategoryOptions.find(opt => opt.value === lessonCategory);
                            if (originalOption) {
                                const option = document.createElement('option');
                                option.value = originalOption.value;
                                option.textContent = originalOption.text;
                                lessonCategorySelect.appendChild(option);
                                lessonCategorySelect.value = lessonCategory;
                                App.log(`[상품 선택] ⚠️ 레슨 종목 옵션 강제 추가: ${lessonCategory}`);
                                lessonCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                            } else {
                                // 원본에도 없으면 직접 추가
                                const option = document.createElement('option');
                                option.value = lessonCategory;
                                option.textContent = App.LessonCategory ? App.LessonCategory.getText(lessonCategory) : lessonCategory;
                                lessonCategorySelect.appendChild(option);
                                lessonCategorySelect.value = lessonCategory;
                                App.log(`[상품 선택] ⚠️ 레슨 종목 옵션 직접 추가: ${lessonCategory}`);
                                lessonCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        } else if (lessonCategorySelect.options.length > 0) {
                            // 직접 옵션 추가 시도
                            const option = document.createElement('option');
                            option.value = lessonCategory;
                            option.textContent = App.LessonCategory ? App.LessonCategory.getText(lessonCategory) : lessonCategory;
                            lessonCategorySelect.appendChild(option);
                            lessonCategorySelect.value = lessonCategory;
                            App.log(`[상품 선택] ⚠️ 레슨 종목 옵션 강제 추가: ${lessonCategory}`);
                            lessonCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        // 강제 추가한 경우에도 150ms 후 한 번 더 적용 (모달 타이머 대비)
                        const valueToKeepFallback = lessonCategory;
                        setTimeout(() => {
                            const el = document.getElementById('booking-lesson-category');
                            if (el && (el.value !== valueToKeepFallback && Array.from(el.options).some(opt => opt.value === valueToKeepFallback))) {
                                el.value = valueToKeepFallback;
                            }
                        }, 150);
                    }
                    }
                } else if (!lessonCategory) {
                    App.warn('[상품 선택] ⚠️ 레슨 종목을 결정할 수 없음:', {
                        productCategory,
                        coachId,
                        hasCoachSelect: !!coachSelect,
                        selectedOptionDataset: {
                            productCategory: selectedOption.dataset.productCategory,
                            coachId: selectedOption.dataset.coachId
                        },
                        product: selectedOption ? {
                            text: selectedOption.textContent,
                            value: selectedOption.value
                        } : null
                    });
                }
                
                // 담당 코치 자동 배정 (MemberProduct 또는 Product의 코치)
                // 상품 변경 시 코치도 항상 업데이트
                const coachSelect = document.getElementById('booking-coach');
                if (coachSelect) {
                    const previousCoachId = coachSelect.value;
                    
                    if (coachId && coachId !== 'null' && coachId !== 'undefined') {
                        App.log(`[상품 선택] 코치 설정 시작: 상품="${selectedOption.textContent}", 코치 ID=${coachId}, 이전 코치 ID=${previousCoachId}`);
                        
                        // 코치 드롭다운이 로드되지 않았으면 먼저 로드
                        if (coachSelect.options.length <= 1) {
                            App.log(`[상품 선택] 코치 드롭다운 로드 중...`);
                            await loadCoachesForBooking();
                            // 코치 목록이 로드될 때까지 대기 (최대 1초)
                            let attempts = 0;
                            while (coachSelect.options.length <= 1 && attempts < 20) {
                                await new Promise(resolve => setTimeout(resolve, 50));
                                attempts++;
                            }
                        }
                        
                        // 코치 ID를 문자열로 변환 (일관성 유지)
                        const coachIdStr = String(coachId).trim();
                        
                        // 유효한 코치 ID인지 확인
                        if (!coachIdStr || coachIdStr === 'null' || coachIdStr === 'undefined' || coachIdStr === '') {
                            App.warn(`[상품 선택] ⚠️ 유효하지 않은 코치 ID: ${coachId}`);
                        } else {
                            // 코치 드롭다운에서 해당 코치 찾기 (문자열 비교)
                            let coachOption = Array.from(coachSelect.options).find(
                                opt => {
                                    const optValue = String(opt.value).trim();
                                    return optValue === coachIdStr || optValue == coachIdStr;
                                }
                            );
                            
                            // 코치가 드롭다운에 없으면 API에서 가져와서 추가 (allowedCoaches에 없어도 상품에 지정된 코치는 추가)
                            if (!coachOption) {
                                App.log(`[상품 선택] 코치가 드롭다운에 없어 API에서 가져와 추가: 코치 ID ${coachIdStr}`);
                                try {
                                    const coachData = await App.api.get(`/coaches/${coachIdStr}`);
                                    if (coachData && coachData.id) {
                                        // 코치 옵션 추가 (코치 미지정 옵션 다음에 추가)
                                        const option = document.createElement('option');
                                        option.value = String(coachData.id);
                                        option.textContent = coachData.name || `코치 ID ${coachData.id}`;
                                        // 코치 미지정 옵션 다음에 삽입
                                        if (coachSelect.options.length > 0) {
                                            coachSelect.insertBefore(option, coachSelect.options[1]);
                                        } else {
                                            coachSelect.appendChild(option);
                                        }
                                        coachOption = option;
                                        App.log(`[상품 선택] ✅ 코치 드롭다운에 추가: ${coachData.name} (ID: ${coachData.id})`);
                                    } else {
                                        App.warn(`[상품 선택] ⚠️ API 응답에 코치 데이터 없음:`, coachData);
                                    }
                                } catch (error) {
                                    App.err(`[상품 선택] ❌ 코치 정보 가져오기 실패: 코치 ID ${coachIdStr}`, error);
                                }
                            }
                            
                            if (coachOption) {
                                // 상품 변경 시 코치도 변경되도록 항상 업데이트 (현재 값과 관계없이)
                                coachSelect.value = coachIdStr;
                                App.log(`[상품 선택] ✅ 담당 코치 자동 배정: 코치 ID ${coachIdStr} (이전: ${previousCoachId || '없음'})`);
                                
                                // 코치가 변경되었을 때만 change 이벤트 발생
                                if (String(previousCoachId).trim() !== coachIdStr) {
                                    coachSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                    App.log(`[상품 선택] 코치 변경 이벤트 발생: ${previousCoachId || '없음'} → ${coachIdStr}`);
                                } else {
                                    App.log(`[상품 선택] 코치 변경 없음 (이미 설정됨): ${coachIdStr}`);
                                }
                            } else {
                                App.warn(`[상품 선택] ❌ 코치 옵션 없음: 코치 ID ${coachIdStr}`, {
                                    availableOptions: Array.from(coachSelect.options).map(opt => ({ value: opt.value, text: opt.text })),
                                    coachId: coachIdStr,
                                    selectedOptionText: selectedOption.textContent,
                                    selectedOptionDataset: {
                                        coachId: selectedOption.dataset.coachId,
                                        productCategory: selectedOption.dataset.productCategory
                                    }
                                });
                            }
                        }
                    } else {
                        // 상품에 코치가 없으면 코치 필드 초기화
                        coachSelect.value = '';
                        App.log(`[상품 선택] 상품에 코치가 없어 코치 필드 초기화`);
                    }
                } else {
                    App.warn(`[상품 선택] ❌ 코치 선택 필드를 찾을 수 없음`);
                }
                
                // 상품 정보 표시
                const productType = selectedOption.dataset.productType;
                const remainingCount = parseInt(selectedOption.dataset.remainingCount) || 0;
                
                if (productInfo && productInfoText) {
                    if (productType === 'COUNT_PASS') {
                        if (remainingCount > 0) {
                            productInfoText.textContent = `횟수권 사용: 잔여 ${remainingCount}회`;
                            productInfo.style.display = 'block';
                        } else {
                            productInfoText.textContent = `횟수권 사용: 잔여 횟수가 없습니다 (0회)`;
                            productInfo.style.display = 'block';
                            productInfo.style.background = 'var(--danger-light)';
                        }
                    } else {
                        productInfoText.textContent = '상품 사용 예정';
                        productInfo.style.display = 'block';
                    }
                }
            } else {
                // 상품 미선택 시 결제 방식 초기화 및 정보 숨김
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = '';
                }
                if (productInfo) {
                    productInfo.style.display = 'none';
                }
            }
        };
        
        // 상품 목록 반환 (자동 선택을 위해)
        return activeProducts;
        
    } catch (error) {
        App.err('회원 상품 목록 로드 실패:', error);
        const select = document.getElementById('booking-member-product');
        if (select) {
            select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
        }
        return []; // 빈 배열 반환
    }
}

// 코치 범례 로드 (배정 지점 + 담당 종목 기준, 코치/레슨 관리 목록과 동일하게)
async function loadCoachLegend() {
    try {
        const config = window.BOOKING_PAGE_CONFIG || {};
        const branch = config.branch;
        const facilityType = config.facilityType;
        const lessonCategory = config.lessonCategory;
        const url = branch ? '/coaches?branch=' + encodeURIComponent(branch) : '/coaches';
        const coaches = await App.api.get(url);
        const legendContainer = document.getElementById('coach-legend');
        if (!legendContainer) return;
        
        let activeCoaches = (Array.isArray(coaches) ? coaches : []).filter(c => c.active !== false);
        
        // 담당 종목(specialties) 기준 필터: 코치/레슨 관리의 담당 종목·배정 지점에 따라 표시
        const spec = (c) => (c.specialties || '').toLowerCase();
        const hasSpec = (c, ...keywords) => keywords.some(k => spec(c).includes(k.toLowerCase()));
        if (lessonCategory === 'YOUTH_BASEBALL') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '유소년', '야구'));
        } else if (facilityType === 'BASEBALL') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '야구'));
        } else if (facilityType === 'TRAINING_FITNESS') {
            activeCoaches = activeCoaches.filter(c => hasSpec(c, '트레이닝', '필라테스'));
        } else if (facilityType === 'RENTAL') {
            // 대관은 배정 지점만 적용 (이미 branch=RENTAL로 조회됨)
        }
        
        activeCoaches.sort((a, b) => {
            const orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
            const orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
        });
        
        if (activeCoaches.length === 0) {
            legendContainer.innerHTML = '';
            return;
        }
        
        const filterSet = window.calendarFilterCoachIds || new Set();
        let legendHTML = '<div class="legend-title">담당 코치:</div>';
        activeCoaches.forEach(coach => {
            const color = App.CoachColors.getColor(coach);
            const coachKey = coach.id != null ? coach.id : 'unassigned';
            const selectedClass = filterSet.has(coachKey) ? ' legend-item--selected' : '';
            legendHTML += `
                <div class="legend-item${selectedClass}" data-coach-id="${coachKey}" role="button" tabindex="0" title="클릭: 해당 코치만 보기, Ctrl+클릭: 다중 선택">
                    <span class="legend-color" style="background-color: ${color}"></span>
                    <span class="legend-name" style="color: ${color}; font-weight: 600;">${App.escapeHtml(coach.name || '')}</span>
                </div>
            `;
        });
        
        legendContainer.innerHTML = legendHTML;
        if (!legendContainer._legendFilterBound) {
            legendContainer._legendFilterBound = true;
            legendContainer.addEventListener('click', function(e) {
                const item = e.target.closest('.legend-item[data-coach-id]');
                if (!item) return;
                const rawId = item.getAttribute('data-coach-id');
                const coachKey = rawId === 'unassigned' ? 'unassigned' : (parseInt(rawId, 10) || rawId);
                const set = window.calendarFilterCoachIds;
                if (e.ctrlKey || e.metaKey) {
                    if (set.has(coachKey)) set.delete(coachKey);
                    else set.add(coachKey);
                } else {
                    if (set.size === 1 && set.has(coachKey)) set.clear();
                    else { set.clear(); set.add(coachKey); }
                }
                loadCoachLegend();
                if (window.lastBookingStatsData) renderBookingStats(window.lastBookingStatsData);
                renderCalendar();
            });
            legendContainer.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const item = e.target.closest('.legend-item[data-coach-id]');
                if (!item) return;
                e.preventDefault();
                const rawId = item.getAttribute('data-coach-id');
                const coachKey = rawId === 'unassigned' ? 'unassigned' : (parseInt(rawId, 10) || rawId);
                const set = window.calendarFilterCoachIds;
                if (e.ctrlKey || e.metaKey) {
                    if (set.has(coachKey)) set.delete(coachKey);
                    else set.add(coachKey);
                } else {
                    if (set.size === 1 && set.has(coachKey)) set.clear();
                    else { set.clear(); set.add(coachKey); }
                }
                loadCoachLegend();
                if (window.lastBookingStatsData) renderBookingStats(window.lastBookingStatsData);
                renderCalendar();
            });
        }
        // 코치 필터 드롭다운과 동기화 (단일 선택일 때만)
        const coachSelect = document.getElementById('filter-coach');
        if (coachSelect && filterSet) {
            if (filterSet.size === 0) coachSelect.value = '';
            else if (filterSet.size === 1) {
                const one = Array.from(filterSet)[0];
                const val = one === 'unassigned' ? 'unassigned' : String(one);
                if (Array.from(coachSelect.options).some(o => o.value === val)) coachSelect.value = val;
            }
        }
        App.log(`범례 ${activeCoaches.length}명 표시됨:`, activeCoaches.map(c => c.name));
    } catch (error) {
        App.err('코치 범례 로드 실패:', error);
    }
}

function switchView(view) {
    currentView = view;
    
    // 모든 뷰 버튼의 active 클래스 제거
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 클릭된 버튼에 active 클래스 추가
    const clickedBtn = document.querySelector(`[data-view="${view}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // 예약 등록 버튼의 active 클래스 제거
    const bookingBtn = document.getElementById('btn-booking-new');
    if (bookingBtn) {
        bookingBtn.classList.remove('active');
    }
    
    // 전체 확인 버튼 표시/숨김 (목록 뷰에서만 표시)
    const confirmAllBtn = document.getElementById('btn-confirm-all');
    if (confirmAllBtn) {
        confirmAllBtn.style.display = (view === 'list') ? 'inline-block' : 'none';
    }
    
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.toggle('active', container.id === `${view}-view`);
    });
    
    if (view === 'calendar') {
        renderCalendar();
    } else {
        loadBookingsList();
    }
}

async function renderCalendar() {
    try {
        // 캘린더 렌더링 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
        try {
            await reorderBookingIdsSilent();
        } catch (error) {
            App.warn('예약 번호 재정렬 실패 (무시):', error);
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const monthYearEl = document.getElementById('calendar-month-year');
        if (monthYearEl) {
            monthYearEl.textContent = `${year}년 ${month + 1}월`;
        } else {
            App.warn('calendar-month-year 요소를 찾을 수 없습니다');
        }
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // 주의 첫날 (일요일)
        // 해당 달 + 빈칸만 채우는 최소 행 수 (다음달 2줄 넘게 나오지 않도록)
        const blankAtStart = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const numRows = Math.ceil((blankAtStart + daysInMonth) / 7);
        const totalCells = numRows * 7;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + totalCells - 1);
        
        const grid = document.getElementById('calendar-grid');
        if (!grid) {
            App.err('calendar-grid 요소를 찾을 수 없습니다. 달력을 렌더링할 수 없습니다.');
            return;
        }
        grid.innerHTML = '';
    
    // 요일 헤더 (일: 빨간색, 토: 파란색)
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach((day, idx) => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header' + (idx === 0 ? ' calendar-day-header-sun' : idx === 6 ? ' calendar-day-header-sat' : '');
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // 해당 월의 예약 데이터 로드
    // 캘린더에 표시되는 주 범위를 고려하여 앞뒤 일주일 추가
    
    // 조회 범위를 캘린더 표시 범위로 확장
    const queryStart = new Date(startDate);
    queryStart.setHours(0, 0, 0, 0);
    const queryEnd = new Date(endDate);
    queryEnd.setHours(23, 59, 59, 999);
    
    let bookings = [];
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
        
        // ISO 형식으로 변환 (UTC 시간대 포함)
        const startISO = queryStart.toISOString();
        const endISO = queryEnd.toISOString();
        App.log(`예약 데이터 요청: ${startISO} ~ ${endISO}`);
        App.log(`현재 월: ${year}년 ${month + 1}월`);
        App.log(`조회 범위: ${queryStart.toLocaleDateString()} ~ ${queryEnd.toLocaleDateString()}`);
        
        // branch, facilityType, lessonCategory 파라미터 추가
        const params = new URLSearchParams({ start: startISO, end: endISO, branch: config.branch });
        if (config.facilityType) params.append('facilityType', config.facilityType);
        if (config.lessonCategory) params.append('lessonCategory', config.lessonCategory);
        
        const response = await App.api.get(`/bookings?${params.toString()}`);
        bookings = response || [];
        const filterSet = window.calendarFilterCoachIds;
        if (filterSet && filterSet.size > 0) {
            bookings = bookings.filter(b => {
                const coach = b.coach || (b.member && b.member.coach ? b.member.coach : null);
                const cid = (coach && coach.id != null) ? coach.id : 'unassigned';
                return filterSet.has(cid);
            });
            App.log(`캘린더 코치 필터 적용: ${bookings.length}건`);
            if (bookings.length === 0 && App.showNotification) {
                App.showNotification('해당 코치의 예약이 없습니다.', 'info');
            }
        }
        App.log(`캘린더 로드 (${config.branch} - ${config.facilityType}): ${bookings.length}개의 예약 발견`, bookings);
        
        // 예약이 없으면 전체 예약도 확인 (디버깅용, 코치 필터 중일 때는 제외)
        if (bookings.length === 0 && (!filterSet || filterSet.size === 0)) {
            App.log('날짜 범위 내 예약 없음, 전체 예약 확인 중...');
            try {
                const allParams = new URLSearchParams({ branch: config.branch });
                if (config.facilityType) allParams.append('facilityType', config.facilityType);
                if (config.lessonCategory) allParams.append('lessonCategory', config.lessonCategory);
                const allBookings = await App.api.get(`/bookings?${allParams.toString()}`);
                App.log(`전체 예약 (사하점): ${allBookings ? allBookings.length : 0}개`, allBookings);
                // 전체 예약 중 현재 월에 해당하는 예약 찾기
                if (allBookings && allBookings.length > 0) {
                    const monthBookings = allBookings.filter(b => {
                        if (!b || !b.startTime) return false;
                        try {
                            const bookingDate = new Date(b.startTime);
                            const bookingYear = bookingDate.getFullYear();
                            const bookingMonth = bookingDate.getMonth();
                            App.log(`예약 날짜 확인: ${bookingYear}-${bookingMonth + 1}-${bookingDate.getDate()}, 현재 월: ${year}-${month + 1}`);
                            return bookingYear === year && bookingMonth === month;
                        } catch (e) {
                            App.err('예약 날짜 파싱 오류:', b.startTime, e);
                            return false;
                        }
                    });
                    App.log(`현재 월에 해당하는 예약: ${monthBookings.length}개`, monthBookings);
                    // 현재 월 예약이 있으면 사용
                    if (monthBookings.length > 0) {
                        bookings = monthBookings;
                    } else if (allBookings && allBookings.length > 0) {
                        // 현재 월에 예약이 없고 다른 월에 예약이 있으면 안내
                        const otherMonthBookings = allBookings.filter(b => {
                            if (!b || !b.startTime) return false;
                            try {
                                const bookingDate = new Date(b.startTime);
                                return bookingDate.getFullYear() !== year || bookingDate.getMonth() !== month;
                            } catch (e) {
                                return false;
                            }
                        });
                        if (otherMonthBookings.length > 0) {
                            const earliestBooking = otherMonthBookings.sort((a, b) => 
                                new Date(a.startTime) - new Date(b.startTime)
                            )[0];
                            const earliestDate = new Date(earliestBooking.startTime);
                            App.log(`현재 월에 예약 없음. 가장 가까운 예약: ${earliestDate.getFullYear()}년 ${earliestDate.getMonth() + 1}월`);
                        }
                    }
                }
            } catch (e) {
                App.err('전체 예약 조회 실패:', e);
            }
        }
    } catch (error) {
        App.err('예약 데이터 로드 실패:', error);
    }
    
    // 코치 필터 시 예약 없음 안내: 달력 그리기 전에 메시지 박스 먼저 표시
    const container = grid.parentElement;
    const coachFilterSet = window.calendarFilterCoachIds;
    const shouldShowEmpty = !!(coachFilterSet && coachFilterSet.size > 0 && bookings.length === 0);
    let emptyMsg = document.getElementById('calendar-empty-message');
    if (shouldShowEmpty) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.id = 'calendar-empty-message';
            emptyMsg.className = 'calendar-empty-message';
            container.insertBefore(emptyMsg, grid);
        }
        emptyMsg.textContent = '해당 코치의 예약이 없습니다.';
        emptyMsg.setAttribute('style', 'display: block !important; padding: 20px 24px; margin-bottom: 16px; text-align: center; font-size: 16px; font-weight: 500; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px;');
        // 모달도 띄워서 확실히 보이게 (다음 프레임에서 열기)
        setTimeout(function() { showCoachEmptyModal(); }, 80);
    } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }
    
    // 날짜 셀
    const today = new Date();
    const current = new Date(startDate);
    
    for (let i = 0; i < totalCells; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        const dayOfWeek = current.getDay();
        if (dayOfWeek === 0) dayCell.classList.add('calendar-day-sun');
        else if (dayOfWeek === 6) dayCell.classList.add('calendar-day-sat');
        
        if (current.getMonth() !== month) {
            dayCell.classList.add('other-month');
        }
        
        if (current.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }
        
        // 해당 날짜의 예약 표시 (날짜만 비교, 시간 무시) - 먼저 계산
        const dayBookings = bookings.filter(b => {
            if (!b || !b.startTime) return false;
            try {
                const bookingDate = new Date(b.startTime);
                // 날짜만 비교 (년, 월, 일) - 로컬 시간 기준
                const bookingYear = bookingDate.getFullYear();
                const bookingMonth = bookingDate.getMonth();
                const bookingDay = bookingDate.getDate();
                const currentYear = current.getFullYear();
                const currentMonth = current.getMonth();
                const currentDay = current.getDate();
                
                const matches = bookingYear === currentYear &&
                               bookingMonth === currentMonth &&
                               bookingDay === currentDay;
                
                if (matches) {
                    App.log(`예약 매칭: ${bookingYear}-${bookingMonth + 1}-${bookingDay} === ${currentYear}-${currentMonth + 1}-${currentDay}`);
                }
                
                return matches;
            } catch (e) {
                App.err('날짜 파싱 오류:', b, e);
                return false;
            }
        });
        
        // 디버깅: 예약이 있는 날짜 로그
        if (dayBookings.length > 0) {
            App.log(`날짜 ${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}에 ${dayBookings.length}개 예약 발견:`, dayBookings);
        }
        
        // 날짜 헤더 생성 (날짜 번호 + 스케줄 아이콘)
        const dayHeader = document.createElement('div');
        dayHeader.style.display = 'flex';
        dayHeader.style.justifyContent = 'space-between';
        dayHeader.style.alignItems = 'center';
        dayHeader.style.width = '100%';
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = current.getDate();
        dayHeader.appendChild(dayNumber);
        
        // 날짜별 스케줄 보기 아이콘 (예약이 있는 날짜에만 표시)
        if (dayBookings.length > 0) {
            const scheduleIcon = document.createElement('div');
            scheduleIcon.className = 'day-schedule-icon';
            scheduleIcon.innerHTML = '📋';
            scheduleIcon.style.cssText = 'cursor: pointer; font-size: 14px; padding: 2px 4px; opacity: 0.7; transition: opacity 0.2s;';
            scheduleIcon.title = '스케줄 보기';
            scheduleIcon.onmouseover = () => scheduleIcon.style.opacity = '1';
            scheduleIcon.onmouseout = () => scheduleIcon.style.opacity = '0.7';
            
            // 클로저 문제 해결: 날짜 값 고정
            const iconYear = current.getFullYear();
            const iconMonth = current.getMonth();
            const iconDay = current.getDate();
            const iconDateStr = `${iconYear}-${String(iconMonth + 1).padStart(2, '0')}-${String(iconDay).padStart(2, '0')}`;
            
            scheduleIcon.onclick = (e) => {
                e.stopPropagation(); // 날짜 클릭 이벤트 전파 방지
                openDayScheduleModal(iconDateStr);
            };
            
            dayHeader.appendChild(scheduleIcon);
        }
        
        dayCell.appendChild(dayHeader);
        
        // 각 예약을 시간대별로 표시
        dayBookings.forEach(booking => {
            try {
                const event = document.createElement('div');
                event.className = 'calendar-event';
                
                // 시간 추출
                const startTime = new Date(booking.startTime);
                const endTime = new Date(booking.endTime);
                const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                
                // 이름 추출 (XSS 방지 이스케이프)
                const memberName = App.escapeHtml(booking.member ? booking.member.name : (booking.nonMemberName || '비회원'));
                
                // 코치 정보 추출 (예약에 직접 할당된 코치 우선, 없으면 회원의 코치)
                const coach = booking.coach || (booking.member && booking.member.coach ? booking.member.coach : null);
                
                // 코치별 색상 적용 (코치가 없으면 기본 색상 사용)
                const coachColor = getCoachColor(coach) || '#5E6AD2';
                event.style.backgroundColor = coachColor;
                event.style.borderLeft = `3px solid ${coachColor}`;
                
                // 상태에 따라 아이콘 표시 추가
                const status = booking.status || 'PENDING';
                const now = new Date();
                const isEnded = endTime < now; // 종료 시간이 지났는지 확인
                
                let statusIcon = '';
                let statusIconStyle = '';
                if (status === 'COMPLETED' || isEnded) {
                    // 완료된 예약 또는 종료된 예약: 초록색 원형 배경에 흰색 원 표시
                    statusIcon = '';
                    statusIconStyle = 'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; min-width: 16px; min-height: 16px; background-color: #2ECC71; border-radius: 50%; margin-right: 5px; vertical-align: middle; flex-shrink: 0; position: relative;';
                } else if (status === 'CONFIRMED') {
                    // 확정된 예약: 파란색 원형 배경에 흰색 체크 표시
                    statusIcon = '✓';
                    statusIconStyle = 'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background-color: #3498DB; border-radius: 50%; color: white; font-size: 11px; font-weight: 900; margin-right: 5px; vertical-align: middle; flex-shrink: 0;';
                }
                
                // 이벤트 내용 설정 (한 줄로 표시: 아이콘 + 시간 / 이름)
                if (statusIcon || statusIconStyle) {
                    if (status === 'COMPLETED' || isEnded) {
                        // 완료된 예약: CSS ::after로 흰색 원 추가
                        event.innerHTML = `<span style="${statusIconStyle}"></span>${timeStr} / ${memberName}`;
                    } else {
                        event.innerHTML = `<span style="${statusIconStyle}">${statusIcon}</span>${timeStr} / ${memberName}`;
                    }
                } else {
                    event.innerHTML = `${timeStr} / ${memberName}`;
                }
                
                // 드래그 앤 드롭 기능 추가
                event.draggable = true;
                event.setAttribute('data-booking-id', booking.id);
                
                // 드래그 시작
                event.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        bookingId: booking.id,
                        booking: booking
                    }));
                    event.style.opacity = '0.5';
                });
                
                // 드래그 종료
                event.addEventListener('dragend', (e) => {
                    event.style.opacity = '1';
                });
                
                // 클릭 시 예약 상세 보기 (드래그가 아닐 때만)
                let dragStartX = 0;
                let dragStartY = 0;
                let isDragging = false;
                
                event.addEventListener('mousedown', (e) => {
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    isDragging = false;
                });
                
                event.addEventListener('mousemove', (e) => {
                    if (dragStartX !== 0 || dragStartY !== 0) {
                        const deltaX = Math.abs(e.clientX - dragStartX);
                        const deltaY = Math.abs(e.clientY - dragStartY);
                        if (deltaX > 5 || deltaY > 5) {
                            isDragging = true;
                        }
                    }
                });
                
                event.addEventListener('click', (e) => {
                    // 드래그가 아닐 때만 처리
                    if (!isDragging) {
                        e.stopPropagation();
                        
                        // Shift 또는 Ctrl 키를 누른 상태면 선택만 (모달 열지 않음)
                        if (e.shiftKey || e.ctrlKey) {
                            selectBooking(booking, event);
                        } else {
                            // 일반 클릭은 모달 열기
                            editBooking(booking.id);
                        }
                    }
                    // 리셋
                    dragStartX = 0;
                    dragStartY = 0;
                    isDragging = false;
                });
                
                dayCell.appendChild(event);
            } catch (error) {
                App.err('예약 표시 오류:', booking, error);
            }
        });
        
        // 클로저 문제 해결: 각 셀에 대해 날짜 값을 고정
        const cellYear = current.getFullYear();
        const cellMonth = current.getMonth();
        const cellDay = current.getDate();
        const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
        
        // 드래그 앤 드롭 이벤트 추가
        dayCell.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dayCell.style.backgroundColor = 'rgba(94, 106, 210, 0.2)';
        });
        
        dayCell.addEventListener('dragleave', (e) => {
            // 다른 셀로 이동한 경우에만 배경색 복원
            if (!dayCell.contains(e.relatedTarget)) {
                dayCell.style.backgroundColor = '';
            }
        });
        
        dayCell.addEventListener('drop', async (e) => {
            e.preventDefault();
            dayCell.style.backgroundColor = '';
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const sourceBookingId = data.bookingId;
                const sourceBooking = data.booking;
                
                // 드롭된 날짜로 예약 복사
                await copyBookingToDateAndRefresh(sourceBookingId, sourceBooking, cellDateStr);
            } catch (error) {
                App.err('예약 복사 실패:', error);
                App.showNotification('예약 복사에 실패했습니다.', 'danger');
            }
        });
        
        dayCell.onclick = (e) => {
            // 아이콘 클릭이 아닐 때만 회원 선택 모달 열기
            if (!e.target.classList.contains('day-schedule-icon') && 
                !e.target.closest('.day-schedule-icon') &&
                !e.target.classList.contains('calendar-event')) {
                // 고정된 날짜 값 사용 (클로저 문제 해결)
                App.log('캘린더 날짜 클릭:', cellDateStr, '년:', cellYear, '월:', cellMonth + 1, '일:', cellDay);
                openMemberSelectModal(cellDateStr);
            }
        };
        
        grid.appendChild(dayCell);
        current.setDate(current.getDate() + 1);
    }
    } catch (error) {
        App.err('달력 렌더링 오류:', error);
        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger);">달력을 불러오는 중 오류가 발생했습니다.<br>페이지를 새로고침해주세요.</div>';
        }
    }
}

// 날짜별 스케줄 모달 열기
async function openDayScheduleModal(dateStr) {
    try {
        // 날짜 포맷팅
        const date = new Date(dateStr + 'T00:00:00');
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const formattedDate = `${year}년 ${month}월 ${day}일`;
        
        document.getElementById('day-schedule-modal-title').textContent = `${formattedDate} 스케줄`;
        
        // 해당 날짜의 예약 로드
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
        const branch = config.branch || 'SAHA';
        const facilityType = config.facilityType;
        
        // API 파라미터 구성
        const params = new URLSearchParams();
        params.append('start', startISO);
        params.append('end', endISO);
        params.append('branch', branch);
        if (facilityType) params.append('facilityType', facilityType);
        if (config.lessonCategory) params.append('lessonCategory', config.lessonCategory);
        
        const bookings = await App.api.get(`/bookings?${params.toString()}`);
        App.log(`날짜별 스케줄 로드 (${branch}, ${facilityType || config.lessonCategory || '전체'}):`, bookings?.length || 0, '건');
        
        // 코치 목록 로드 (필터용, 배정 지점 + 담당 종목 기준)
        const coachesUrl = branch ? '/coaches?branch=' + encodeURIComponent(branch) : '/coaches';
        const coachesRes = await App.api.get(coachesUrl);
        let scheduleCoaches = (Array.isArray(coachesRes) ? coachesRes : []).filter(c => c.active !== false);
        const spec = (c) => (c.specialties || '').toLowerCase();
        const hasSpec = (c, ...kw) => kw.some(k => spec(c).includes(k.toLowerCase()));
        if (config.lessonCategory === 'YOUTH_BASEBALL') {
            scheduleCoaches = scheduleCoaches.filter(c => hasSpec(c, '유소년', '야구'));
        } else if (config.facilityType === 'BASEBALL') {
            scheduleCoaches = scheduleCoaches.filter(c => hasSpec(c, '야구'));
        } else if (config.facilityType === 'TRAINING_FITNESS') {
            scheduleCoaches = scheduleCoaches.filter(c => hasSpec(c, '트레이닝', '필라테스'));
        }
        scheduleCoaches.sort((a, b) => {
            const orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
            const orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
        });
        const coachSelect = document.getElementById('schedule-filter-coach');
        coachSelect.innerHTML = '<option value="">전체 코치</option>';
        scheduleCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            coachSelect.appendChild(option);
        });
        
        // 전체 예약 저장 (필터링용)
        window.dayScheduleBookings = bookings;
        
        // 초기 렌더링
        renderDaySchedule(bookings);
        
        App.Modal.open('day-schedule-modal');
    } catch (error) {
        App.err('스케줄 로드 실패:', error);
        App.showNotification('스케줄을 불러오는데 실패했습니다.', 'danger');
    }
}

// 날짜별 스케줄 필터링
function filterDaySchedule() {
    if (!window.dayScheduleBookings) return;
    
    const coachId = document.getElementById('schedule-filter-coach').value;
    const status = document.getElementById('schedule-filter-status').value;
    
    let filtered = [...window.dayScheduleBookings];
    
    if (coachId) {
        filtered = filtered.filter(booking => {
            const bookingCoachId = booking.coach ? booking.coach.id : 
                                  (booking.member && booking.member.coach ? booking.member.coach.id : null);
            return bookingCoachId && bookingCoachId.toString() === coachId;
        });
    }
    
    if (status) {
        filtered = filtered.filter(booking => booking.status === status);
    }
    
    renderDaySchedule(filtered);
}

// 날짜별 스케줄 렌더링
function renderDaySchedule(bookings) {
    const tbody = document.getElementById('day-schedule-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    // 시간순으로 정렬
    bookings.sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
    });
    
    tbody.innerHTML = bookings.map(booking => {
        // 시간 포맷팅
        let timeStr = '-';
        if (booking.startTime && booking.endTime) {
            const start = new Date(booking.startTime);
            const end = new Date(booking.endTime);
            const startTime = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const endTime = end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            timeStr = `${startTime} - ${endTime}`;
        }
        
        // 회원/이름
        const memberName = booking.member ? booking.member.name : 
                          (booking.nonMemberName || '비회원');
        
        // 코치 이름
        const coachName = booking.coach ? booking.coach.name : 
                         (booking.member && booking.member.coach ? booking.member.coach.name : '-');
        
        // 레슨 종목
        const lessonCategory = booking.lessonCategory ? App.LessonCategory.getText(booking.lessonCategory) : '-';
        
        // 상태
        const statusBadge = App.Status.booking.getBadge(booking.status);
        const statusText = App.Status.booking.getText(booking.status);
        
        return `
            <tr>
                <td>${timeStr}</td>
                <td>${booking.facility ? booking.facility.name : '-'}</td>
                <td>${memberName}</td>
                <td>${coachName}</td>
                <td>${lessonCategory}</td>
                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editBookingFromSchedule(${booking.id})">수정</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 스케줄 모달에서 예약 수정
function editBookingFromSchedule(bookingId) {
    App.Modal.close('day-schedule-modal');
    openBookingModal(bookingId);
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

async function loadBookingsList() {
    try {
        // 예약 목록 로드 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
        await reorderBookingIdsSilent();
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
        const branch = config.branch || 'SAHA';
        const facilityType = config.facilityType;
        
        // API 파라미터 구성
        const params = new URLSearchParams();
        params.append('branch', branch);
        if (facilityType) params.append('facilityType', facilityType);
        if (config.lessonCategory) params.append('lessonCategory', config.lessonCategory);
        
        let bookings = await App.api.get(`/bookings?${params.toString()}`);
        const filterSet = window.calendarFilterCoachIds;
        if (filterSet && filterSet.size > 0) {
            bookings = (bookings || []).filter(b => {
                const coach = b.coach || (b.member && b.member.coach ? b.member.coach : null);
                const cid = (coach && coach.id != null) ? coach.id : 'unassigned';
                return filterSet.has(cid);
            });
            App.log('목록 뷰 코치 필터 적용:', bookings.length, '건');
            if (bookings.length === 0 && App.showNotification) {
                App.showNotification('해당 코치의 예약이 없습니다.', 'info');
            }
        }
        App.log(`예약 목록 조회 결과 (${branch}, ${facilityType || config.lessonCategory || '전체'}):`, bookings?.length || 0, '건');
        renderBookingsTable(bookings);
    } catch (error) {
        App.err('예약 목록 로드 실패:', error);
    }
}

function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        const facilityName = booking.facility ? booking.facility.name : '-';
        const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
        const startTime = booking.startTime ? new Date(booking.startTime).toLocaleString('ko-KR') : '-';
        const status = booking.status || 'PENDING';
        const purpose = getPurposeText(booking.purpose);
        const lessonCategory = booking.lessonCategory ? getLessonCategoryText(booking.lessonCategory) : '-';
        const coachName = (booking.coach && booking.coach.name) ? App.escapeHtml(booking.coach.name) : (booking.member && booking.member.coach && booking.member.coach.name ? App.escapeHtml(booking.member.coach.name) : '-');
        
        return `
        <tr>
            <td>${booking.id}</td>
            <td>${facilityName}</td>
            <td>${startTime}</td>
            <td>${memberName}</td>
            <td>${coachName}</td>
            <td>${purpose}</td>
            <td>${booking.purpose === 'LESSON' && booking.lessonCategory ? `<span class="badge badge-${getLessonCategoryBadge(booking.lessonCategory)}">${lessonCategory}</span>` : '-'}</td>
            <td>${booking.participants || 1}</td>
            <td>
                <span class="badge badge-${getStatusBadge(status)}">${getStatusText(status)}</span>
                ${status === 'PENDING' ? `<button class="btn btn-xs btn-success ml-2" onclick="approveBooking(${booking.id})" title="승인">✓</button>` : ''}
            </td>
            <td>${getBookingPaymentMethodText(booking.paymentMethod)}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editBooking(${booking.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBooking(${booking.id})">삭제</button>
            </td>
        </tr>
        `;
    }).join('');
}

function getPurposeText(purpose) {
    const map = {
        'LESSON': '레슨',
        'RENTAL': '대관',
        'PERSONAL_TRAINING': '개인훈련'
    };
    return map[purpose] || purpose || '-';
}

// 레슨 카테고리 관련 함수는 common.js의 App.LessonCategory 사용
function getLessonCategoryText(category) {
    return App.LessonCategory.getText(category);
}

function getLessonCategoryBadge(category) {
    return App.LessonCategory.getBadge(category);
}

// 상태 관련 함수는 common.js의 App.Status.booking 사용
function getStatusBadge(status) {
    return App.Status.booking.getBadge(status);
}

function getStatusText(status) {
    return App.Status.booking.getText(status);
}

// 결제 방법 텍스트는 common.js의 App.PaymentMethod 사용
function getBookingPaymentMethodText(method) {
    return App.PaymentMethod.getText(method);
}

let selectedBookingDate = null;

// 회원 선택 모달 열기
async function openMemberSelectModal(date = null) {
    selectedBookingDate = date || new Date().toISOString().split('T')[0];
    App.log('회원 선택 모달 열기 - selectedBookingDate 설정:', selectedBookingDate, '입력된 date:', date);
    
    // 회원 목록 로드
    await loadMembersForSelect();
    
    // 검색 기능
    const searchInput = document.getElementById('member-search-input');
    searchInput.value = '';
    searchInput.oninput = function() {
        filterMembers(this.value);
    };
    
    App.Modal.open('member-select-modal');
}

// 회원 목록 로드 (전체 회원)
async function loadMembersForSelect() {
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || {};
        const facilityType = config.facilityType;
        const branch = config.branch;
        
        // facilityType에 맞는 productCategory 매핑
        let productCategory = null;
        if (facilityType === 'BASEBALL') {
            productCategory = 'BASEBALL';
        } else if (facilityType === 'TRAINING_FITNESS') {
            productCategory = 'TRAINING_FITNESS';
        }
        
        // API 파라미터 구성
        // 야구는 모든 지점에서 가능하므로 branch 파라미터 전달 안 함
        // 트레이닝+필라테스만 지점별 필터링
        const params = new URLSearchParams();
        if (productCategory) {
            params.append('productCategory', productCategory);
        }
        // 트레이닝+필라테스만 지점 필터링 적용
        if (branch && productCategory === 'TRAINING_FITNESS') {
            params.append('branch', branch);
        }
        // 유소년 야구 페이지: 유소년 등급 회원만 예약 가능
        if (config.lessonCategory === 'YOUTH_BASEBALL') {
            params.append('grade', 'YOUTH');
        }
        
        const url = params.toString() ? `/members?${params.toString()}` : '/members';
        const members = await App.api.get(url);
        renderMemberSelectTable(members);
        App.log(`회원 ${members.length}명 로드됨 (카테고리: ${productCategory || '전체'}, 지점: ${productCategory === 'TRAINING_FITNESS' ? (branch || '전체') : '모든 지점'}${config.lessonCategory === 'YOUTH_BASEBALL' ? ', 등급: 유소년' : ''})`);
    } catch (error) {
        App.err('회원 목록 로드 실패:', error);
        App.showNotification('회원 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원 선택 테이블 렌더링
function renderMemberSelectTable(members, filterText = '') {
    const tbody = document.getElementById('member-select-table-body');
    
    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">회원이 없습니다.</td></tr>';
        return;
    }
    
    // 필터링 (이름, 회원번호, 전화번호로 검색)
    let filteredMembers = members;
    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filteredMembers = members.filter(m => 
            m.name.toLowerCase().includes(lowerFilter) || 
            (m.memberNumber && m.memberNumber.toLowerCase().includes(lowerFilter)) ||
            (m.phoneNumber && m.phoneNumber.includes(filterText))
        );
    }
    
    if (filteredMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">검색 결과가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredMembers.map(member => {
        const gradeText = getGradeText(member.grade);
        const memberNumber = App.escapeHtml(member.memberNumber || '-');
        const nameEsc = App.escapeHtml(member.name || '');
        const phoneEsc = App.escapeHtml(member.phoneNumber || '');
        const schoolEsc = App.escapeHtml(member.school || '-');
        return `
            <tr style="cursor: pointer;" onclick="selectMemberForBooking('${memberNumber}', '${nameEsc}', '${phoneEsc}')">
                <td>${nameEsc}</td>
                <td>${memberNumber}</td>
                <td>${phoneEsc}</td>
                <td><span class="badge badge-info">${App.escapeHtml(gradeText)}</span></td>
                <td>${schoolEsc}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectMemberForBooking('${memberNumber}', '${nameEsc}', '${phoneEsc}')">선택</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 회원 필터링
function filterMembers(filterText) {
    // 이미 로드된 회원 목록을 필터링
    const tbody = document.getElementById('member-select-table-body');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const lowerFilter = filterText.toLowerCase();
        row.style.display = text.includes(lowerFilter) ? '' : 'none';
    });
}

// 등급 텍스트 변환
// 회원 등급 텍스트는 common.js의 App.MemberGrade 사용
function getGradeText(grade) {
    return App.MemberGrade.getText(grade);
}

// 회원 선택 시 예약 모달 열기 (memberNumber로 회원 찾기)
async function selectMemberForBooking(memberNumber, memberName, memberPhone) {
    App.Modal.close('member-select-modal');
    
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    App.log('회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 회원번호로 회원 상세 정보 로드
    try {
        // 회원번호로 회원 찾기
        const members = await App.api.get('/members/search?memberNumber=' + encodeURIComponent(memberNumber));
        if (!members || members.length === 0) {
            App.showNotification('회원을 찾을 수 없습니다.', 'danger');
            return;
        }
        
        const member = members[0]; // 첫 번째 결과 사용
        
        // 예약 모달 열기
        document.getElementById('booking-modal-title').textContent = '예약 등록';
        document.getElementById('selected-member-number').value = memberNumber; // memberNumber 저장
        
        // 회원 정보 표시
        document.getElementById('member-info-name').textContent = member.name || '-';
        document.getElementById('member-info-phone').textContent = member.phoneNumber || '-';
        document.getElementById('member-info-grade').textContent = getGradeText(member.grade) || '-';
        document.getElementById('member-info-school').textContent = member.school || '-';
        
        // selected-member-id도 설정 (하위 호환성)
        document.getElementById('selected-member-id').value = member.id || '';
        document.getElementById('selected-member-number').value = member.memberNumber || '';
        
        // 회원 정보 섹션 표시, 비회원 섹션 및 선택 섹션 숨기기
        document.getElementById('member-info-section').style.display = 'block';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'none';
        
        // 코치 목록 로드 (먼저 로드 완료 대기)
        let coachSelect = document.getElementById('booking-coach');
        if (coachSelect) {
            // 코치 목록이 없으면 먼저 로드
            if (coachSelect.options.length <= 1) {
                await loadCoachesForBooking();
            }
            
            // 코치 목록이 로드될 때까지 대기 (최대 1초)
            let attempts = 0;
            while (coachSelect.options.length <= 1 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
        }
        
        // 필요한 필드만 개별적으로 초기화 (폼 리셋 대신)
        // 날짜는 나중에 설정하므로 여기서는 초기화하지 않음
        const setFieldValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) {
                field.value = value;
            }
        };
        
        const setFieldStyle = (id, property, value) => {
            const field = document.getElementById(id);
            if (field) {
                field.style[property] = value;
            }
        };
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
        setFieldValue('booking-id', '');
        App.log('회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
        
        // 시설은 나중에 로드하므로 여기서 초기화하지 않음
        setFieldValue('booking-start-time', '');
        setFieldValue('booking-end-time', '');
        setFieldValue('booking-participants', '1');
        setFieldValue('booking-purpose', '');
        setFieldValue('booking-lesson-category', '');
        setFieldValue('booking-status', 'PENDING');
        setFieldValue('booking-payment-method', '');
        setFieldValue('booking-notes', ''); // 메모 필드 ID는 booking-notes
        setFieldValue('booking-non-member-name', '');
        setFieldValue('booking-phone', '');
        setFieldValue('booking-member-product', '');
        setFieldStyle('product-info', 'display', 'none');
        
        // 코치는 나중에 설정하므로 여기서는 초기화하지 않음
        // 날짜 필드에 선택한 날짜 설정
        const dateField = document.getElementById('booking-date');
        if (dateField) {
            dateField.value = dateToSet;
            App.log('예약 날짜 설정 완료:', dateToSet);
        }
        
        // 시설 로드 및 자동 선택 (모달이 열린 후)
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            // 시설이 선택되지 않았거나 옵션이 없으면 로드
            if (!facilitySelect.value || facilitySelect.options.length <= 1) {
                App.log('[회원 선택] 시설 로드 시작');
                await loadFacilities();
                App.log('[회원 선택] 시설 로드 완료');
            }
        }
        
        // 회원의 상품/이용권 목록 로드
        const memberProducts = await loadMemberProducts(member.id);
        
        // 해당 페이지에 맞는 첫 번째 상품 자동 선택
        if (memberProducts && memberProducts.length > 0) {
            const productSelect = document.getElementById('booking-member-product');
            if (productSelect && productSelect.options.length > 1) {
                // 첫 번째 상품 선택 (상품 미선택 옵션 제외)
                const firstProductOption = productSelect.options[1]; // 인덱스 0은 "상품 미선택"
                if (firstProductOption && firstProductOption.value) {
                    productSelect.value = firstProductOption.value;
                    App.log('[회원 선택] 첫 번째 상품 자동 선택:', firstProductOption.textContent);
                    
                    // 상품 선택 이벤트 처리 대기 (비동기 처리)
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // 상품 선택 이벤트 발생 (코치, 레슨 종목 자동 설정을 위해)
                    // 이벤트를 나중에 발생시켜서 필드들이 준비된 후에 실행되도록 함
                    productSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // 이벤트 처리 대기
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
        
        // 회원의 등급에 따라 기본값 설정
        // 유소년 회원은 기본적으로 레슨으로 설정
        if (member.grade === 'YOUTH' && !document.getElementById('booking-purpose').value) {
            document.getElementById('booking-purpose').value = 'LESSON';
            toggleLessonCategory();
        }
        
        // 회원 예약은 상태를 기본값 PENDING으로 설정
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING';
        }
        
        // 결제 방식 설정 (이용권 보유 시 선결제)
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        if (paymentMethodSelect) {
            const eligibleProducts = (memberProducts || []).filter(mp => {
                const type = mp.product?.type;
                return type === 'COUNT_PASS' || type === 'MONTHLY_PASS' || type === 'TIME_PASS';
            });
            paymentMethodSelect.value = eligibleProducts.length > 0 ? 'PREPAID' : '';
        }
        
        // 상품 선택 이벤트가 코치를 설정했는지 확인
        // 상품 선택 이벤트가 이미 코치를 설정했으므로 여기서는 추가 설정하지 않음
        // 단, 상품 선택 이벤트가 코치를 설정하지 못한 경우에만 회원의 기본 코치 사용
        const productSelect = document.getElementById('booking-member-product');
        // coachSelect는 위에서 이미 선언되었으므로 재선언하지 않음
        if (!coachSelect) {
            coachSelect = document.getElementById('booking-coach');
        }
        
        // 상품 선택 이벤트가 코치를 제대로 설정했는지 확인
        let coachIdToSet = null;
        let coachInfo = null;
        
        if (productSelect && productSelect.value && coachSelect) {
            const selectedOption = productSelect.options[productSelect.selectedIndex];
            const productCoachId = selectedOption.dataset.coachId;
            const currentCoachId = coachSelect.value;
            
            App.log('[회원 선택] 코치 설정 확인:', {
                productName: selectedOption.textContent,
                productCoachId: productCoachId,
                currentCoachId: currentCoachId,
                match: productCoachId && currentCoachId == productCoachId
            });
            
            // 상품의 코치가 설정되어 있으면 그대로 사용 (추가 설정 불필요)
            if (productCoachId && currentCoachId == productCoachId) {
                App.log('[회원 선택] ✅ 상품 선택 이벤트로 코치가 이미 올바르게 설정됨:', productCoachId);
                coachIdToSet = null; // 이미 설정되었으므로 다시 설정하지 않음
            } else if (productCoachId && currentCoachId != productCoachId) {
                // 상품의 코치가 있는데 현재 코치와 다르면 상품의 코치로 설정
                App.log('[회원 선택] ⚠️ 상품의 코치와 현재 코치가 다름. 상품의 코치로 재설정:', {
                    productCoachId: productCoachId,
                    currentCoachId: currentCoachId
                });
                coachIdToSet = productCoachId;
            } else if (!productCoachId && member.coach) {
                // 상품에 코치가 없으면 회원의 기본 코치 사용
                coachIdToSet = member.coach.id || member.coach;
                coachInfo = member.coach;
                App.log('[회원 선택] 상품에 코치가 없어 회원의 기본 코치 사용:', coachIdToSet);
            }
        } else if (!productSelect || !productSelect.value) {
            // 상품이 선택되지 않았고 회원의 기본 코치가 있으면 사용
            if (member.coach) {
                coachIdToSet = member.coach.id || member.coach;
                coachInfo = member.coach;
                App.log('[회원 선택] 상품 미선택, 회원의 기본 코치 사용:', coachIdToSet);
            }
        }
        
        // 코치 상세 정보 미리 가져오기 (필요한 경우)
        if (coachIdToSet && (!coachInfo || !coachInfo.name || !coachInfo.specialties)) {
            try {
                coachInfo = await App.api.get(`/coaches/${coachIdToSet}`);
            } catch (error) {
                App.err('코치 정보 로드 실패:', error);
            }
        }
        
        // 코치 설정 함수 (모달 열기 전에 준비)
        // 상품 선택 이벤트가 코치를 설정하지 못한 경우에만 실행
        const setCoachAndLessonCategory = async () => {
            if (!coachIdToSet) {
                App.log('[회원 선택] 코치 설정 불필요 (상품 선택 이벤트가 이미 처리함)');
                return;
            }
            
            // 메인 폼의 코치 필드 찾기 (coach-group 내부)
            const coachGroup = document.getElementById('coach-group');
            if (!coachGroup) {
                App.err('❌ coach-group을 찾을 수 없습니다.');
                return;
            }
            
            const coachSelectEl = coachGroup.querySelector('#booking-coach');
            if (!coachSelectEl) {
                App.err('❌ 코치 선택 필드를 찾을 수 없습니다.');
                return;
            }
            
            // 코치 목록이 로드되었는지 확인
            if (coachSelectEl.options.length <= 1) {
                await loadCoachesForBooking();
                let attempts = 0;
                while (coachSelectEl.options.length <= 1 && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }
            }
            
            // 코치 ID가 옵션에 있는지 확인
            const coachOption = Array.from(coachSelectEl.options).find(opt => {
                const optValue = opt.value;
                return optValue == coachIdToSet || optValue === String(coachIdToSet);
            });
            
            if (!coachOption) {
                App.err('❌ 코치 옵션을 찾을 수 없습니다. 코치 ID:', coachIdToSet);
                return;
            }
            
            // 코치 설정
            const optionIndex = Array.from(coachSelectEl.options).indexOf(coachOption);
            coachSelectEl.selectedIndex = optionIndex;
            coachSelectEl.value = coachOption.value;
            
            // 이벤트 발생
            coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 설정 확인
            await new Promise(resolve => setTimeout(resolve, 100));
            const finalValue = coachSelectEl.value;
            if (finalValue == coachIdToSet || finalValue === String(coachIdToSet)) {
                App.log('✅ 코치 설정 완료:', coachOption.textContent);
                
                // 레슨 종목 설정
                if (coachInfo && coachInfo.specialties && coachInfo.specialties.length > 0) {
                    const lessonCategory = App.LessonCategory.fromCoachSpecialties(coachInfo.specialties);
                    if (lessonCategory) {
                        const lessonCategoryEl = document.getElementById('booking-lesson-category');
                        const purposeEl = document.getElementById('booking-purpose');
                        
                        if (lessonCategoryEl) {
                            lessonCategoryEl.value = lessonCategory;
                        }
                        
                        if (purposeEl && !purposeEl.value) {
                            purposeEl.value = 'LESSON';
                            toggleLessonCategory();
                        }
                    }
                }
            } else {
                App.warn('⚠️ 코치 설정 확인 실패, 재시도...');
                // 재시도
                coachSelectEl.selectedIndex = optionIndex;
                coachSelectEl.value = coachOption.value;
                coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        
        // 모달을 먼저 열기
        App.Modal.open('booking-modal');
    // 모달이 열린 후 레슨 종목 필터링 적용
    setTimeout(() => filterLessonCategoryOptions(), 100);
    
    // 모달이 열린 후 시설 확인 및 자동 선택
    setTimeout(async () => {
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            // 시설이 선택되지 않았거나 옵션이 없으면 로드
            if (!facilitySelect.value || facilitySelect.options.length <= 1) {
                App.log('[회원 선택] 모달 열림 후 시설 재로드');
                await loadFacilities();
            }
            
            // 시설이 여전히 선택되지 않았으면 첫 번째 시설 선택
            if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                const firstOption = facilitySelect.options[1]; // 첫 번째는 "시설 선택..."
                if (firstOption && firstOption.value) {
                    facilitySelect.value = firstOption.value;
                    App.log('[회원 선택] 모달 열림 후 첫 번째 시설 자동 선택:', firstOption.textContent);
                }
            }
        }
    }, 200);
        
        // 모달이 완전히 열린 후 코치 설정 확인 및 필요시 재설정
        // 상품 선택 이벤트가 코치를 제대로 설정했는지 최종 확인
        setTimeout(async () => {
            const finalProductSelect = document.getElementById('booking-member-product');
            const finalCoachSelect = document.getElementById('booking-coach');
            
            if (finalProductSelect && finalProductSelect.value && finalCoachSelect) {
                const selectedOption = finalProductSelect.options[finalProductSelect.selectedIndex];
                const productCoachId = selectedOption.dataset.coachId;
                const currentCoachId = finalCoachSelect.value;
                
                App.log('[회원 선택] 모달 열림 후 코치 최종 확인:', {
                    productName: selectedOption.textContent,
                    productCoachId: productCoachId,
                    currentCoachId: currentCoachId,
                    needUpdate: productCoachId && currentCoachId != productCoachId
                });
                
                // 상품의 코치가 있는데 현재 코치와 다르면 재설정
                if (productCoachId && currentCoachId != productCoachId) {
                    App.log('[회원 선택] ⚠️ 코치 불일치 감지, 상품 선택 이벤트 재발생:', {
                        productCoachId: productCoachId,
                        currentCoachId: currentCoachId
                    });
                    // 상품 선택 이벤트를 다시 발생시켜서 코치를 설정
                    finalProductSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 재설정 후 다시 확인
                    const updatedCoachId = finalCoachSelect.value;
                    if (updatedCoachId == productCoachId) {
                        App.log('[회원 선택] ✅ 코치 재설정 성공:', productCoachId);
                    } else {
                        App.warn('[회원 선택] ❌ 코치 재설정 실패:', {
                            expected: productCoachId,
                            actual: updatedCoachId
                        });
                    }
                } else if (productCoachId && currentCoachId == productCoachId) {
                    App.log('[회원 선택] ✅ 코치가 올바르게 설정됨:', productCoachId);
                } else if (!productCoachId && coachIdToSet) {
                    // 상품에 코치가 없고 회원의 기본 코치를 설정해야 하는 경우
                    App.log('[회원 선택] 상품에 코치 없음, 회원 기본 코치 설정:', coachIdToSet);
                    await setCoachAndLessonCategory();
                }
            } else if (coachIdToSet) {
                // 상품이 선택되지 않았고 회원의 기본 코치를 설정해야 하는 경우
                App.log('[회원 선택] 상품 미선택, 회원 기본 코치 설정:', coachIdToSet);
                await setCoachAndLessonCategory();
            }
        }, 500);
    } catch (error) {
        App.err('회원 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 비회원 예약 모달 열기
function openNonMemberBookingModal() {
    App.Modal.close('member-select-modal');
    selectNonMember();
}

// 비회원 선택
async function selectNonMember() {
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    App.log('비회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 예약 모달 열기
    document.getElementById('booking-modal-title').textContent = '예약 등록 (비회원)';
    document.getElementById('selected-member-id').value = '';
    document.getElementById('selected-member-number').value = '';
    
    // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
    document.getElementById('booking-id').value = '';
    App.log('비회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
    
    // 폼 리셋 (날짜 필드는 제외)
    const bookingForm = document.getElementById('booking-form');
    bookingForm.reset();
    
    // reset 후 날짜 필드에 선택한 날짜 설정 (약간의 지연을 두어 확실히 설정)
    setTimeout(() => {
        document.getElementById('booking-date').value = dateToSet;
        App.log('예약 날짜 설정 완료 (비회원):', dateToSet);
    }, 10);
    
    // 비회원 섹션 표시, 회원 정보 섹션 및 선택 섹션 숨기기
    document.getElementById('non-member-section').style.display = 'block';
    document.getElementById('member-info-section').style.display = 'none';
    document.getElementById('member-select-section').style.display = 'none';
    
    // 비회원 예약은 항상 'PENDING' 상태로 고정 (승인 필요)
    const statusSelect = document.getElementById('booking-status');
    if (statusSelect) {
        statusSelect.value = 'PENDING';
        statusSelect.disabled = true; // 비회원은 상태 변경 불가
    }
    
    // 비회원 예약 모달에서도 시설 즉시 로드 및 선택
    const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
    const facilitySelect = document.getElementById('booking-facility');
    
    if (facilitySelect) {
        try {
            const params = new URLSearchParams();
            params.append('branch', config.branch?.toUpperCase());
            // facilityType 파라미터 제거 - 모든 타입의 시설 표시
            const facilities = await App.api.get(`/facilities?${params.toString()}`);
            
            const expectedBranch = config.branch?.toUpperCase();
            const filteredFacilities = facilities.filter(f => {
                return f.branch?.toUpperCase() === expectedBranch;
            });
            
            if (filteredFacilities.length > 0) {
                facilitySelect.innerHTML = '<option value="">시설 선택...</option>';
                filteredFacilities.forEach(facility => {
                    const option = document.createElement('option');
                    option.value = facility.id.toString();
                    option.textContent = facility.name;
                    // 시설의 지점 정보를 data 속성에 저장
                    if (facility.branch) {
                        option.dataset.branch = facility.branch;
                    }
                    facilitySelect.appendChild(option);
                });
                
                // 첫 번째 시설 즉시 선택 및 고정
                const firstFacility = filteredFacilities[0];
                facilitySelect.value = firstFacility.id.toString();
                facilitySelect.disabled = true;
                facilitySelect.classList.add('facility-fixed');
                // 오버레이에 선택된 시설명 표시
                const displayDiv = document.getElementById('facility-selected-display');
                const nameSpan = document.getElementById('facility-selected-name');
                if (displayDiv && nameSpan) {
                    nameSpan.textContent = firstFacility.name;
                    displayDiv.style.display = 'flex';
                }
                // 시설의 지점 정보로 booking-branch 업데이트
                const branchInput = document.getElementById('booking-branch');
                if (branchInput && firstFacility.branch) {
                    branchInput.value = firstFacility.branch.toUpperCase();
                    App.log(`[비회원 예약] 지점 업데이트: ${firstFacility.branch.toUpperCase()}`);
                }
                App.log(`[시설 로드] 비회원 예약 - 즉시 선택 및 고정: ${firstFacility.name} (지점: ${firstFacility.branch})`);
            } else {
                App.err(`[비회원 예약] ${config.branch} 지점에 해당하는 시설이 없습니다!`);
            }
        } catch (error) {
            App.err('[시설 로드] 시설 로드 실패:', error);
        }
    }
    
    App.Modal.open('booking-modal');
    // 모달이 열린 후 레슨 종목 필터링 적용
    setTimeout(() => filterLessonCategoryOptions(), 100);
}

// 회원 변경
function changeMember() {
    // 회원 선택 모달 열기
    openMemberSelectModal(selectedBookingDate || document.getElementById('booking-date').value);
}

async function openBookingModal(id = null) {
    const modal = document.getElementById('booking-modal');
    const title = document.getElementById('booking-modal-title');
    const deleteBtn = document.getElementById('booking-delete-btn');
    const form = document.getElementById('booking-form');
    
    // 오버레이 초기화
    const displayDiv = document.getElementById('facility-selected-display');
    if (displayDiv) {
        displayDiv.style.display = 'none';
    }
    
    if (id) {
        // 예약 수정 모달
        title.textContent = '예약 수정';
        
        // 삭제 버튼 표시
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
            deleteBtn.setAttribute('data-booking-id', id);
        }
        
        // 예약 등록 버튼 active 제거 (수정 모달이므로)
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.remove('active');
        }
        
        // 현재 뷰 버튼 유지
        // 목적 필드 활성화 (수정 시에도 선택 가능하도록)
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.disabled = false;
            purposeSelect.style.display = 'block';
        }
        
        // 지점 필드 설정 (페이지별로 고정, hidden input)
        const branchInput = document.getElementById('booking-branch');
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA' };
            branchInput.value = config.branch;
        }
        
        loadBookingData(id);
    } else {
        // 예약 등록 모달
        title.textContent = '예약 등록';
        
        // 삭제 버튼 숨김
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
            deleteBtn.removeAttribute('data-booking-id');
        }
        
        // 예약 등록 버튼에 active 클래스 추가
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.add('active');
        }
        
        // 다른 뷰 버튼들의 active 클래스 제거
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 지점 필드 설정 (페이지별로 고정, hidden input) - reset 전에 설정
        const branchInput = document.getElementById('booking-branch');
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA' };
            branchInput.value = config.branch;
        }
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지) - reset 전에
        document.getElementById('booking-id').value = '';
        
        // 상태 필드를 먼저 PENDING으로 초기화 (reset 전에)
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        
        form.reset();
        
        // reset 후 필수 값들 다시 설정
        document.getElementById('booking-id').value = '';
        document.getElementById('selected-member-id').value = '';
        document.getElementById('selected-member-number').value = '';
        document.getElementById('booking-date').value = selectedBookingDate || new Date().toISOString().split('T')[0];
        
        // 지점 필드 다시 설정 (reset 후)
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA' };
            branchInput.value = config.branch;
        }
        
        App.log('예약 등록 모달 - booking-id 초기화 완료');
        
        // 목적 필드 활성화
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.disabled = false;
            purposeSelect.style.display = 'block';
        }
        
        // 레슨 카테고리 필드 초기화
        toggleLessonCategory();
        
        // 모든 섹션 초기화
        document.getElementById('member-info-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        
        // 상태 필드 활성화 및 PENDING으로 명시적 설정 (reset 후 다시 설정)
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING'; // 새 예약은 항상 PENDING으로 시작
        }
        
        // form.reset() 후 시설 다시 로드 및 선택 (reset이 시설 드롭다운을 초기화하므로)
        // booking-id가 빈 값이므로 loadFacilities()가 자동으로 첫 번째 시설을 선택함
        await loadFacilities();
        
        // 추가 확인: 시설이 확실히 선택되었는지 확인하고 강제 선택
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            if (!facilitySelect.value || facilitySelect.options.length <= 1) {
                App.warn('[시설 로드] 시설이 선택되지 않음, 재시도...');
                await loadFacilities();
            }
            
            // 강제로 첫 번째 시설 선택 및 고정 (옵션이 있으면)
            if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                const firstFacilityOption = facilitySelect.options[1]; // 첫 번째는 "시설 선택..."
                if (firstFacilityOption && firstFacilityOption.value) {
                    facilitySelect.value = firstFacilityOption.value;
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        nameSpan.textContent = firstFacilityOption.textContent;
                        displayDiv.style.display = 'flex';
                    }
                    App.log(`[시설 로드] 강제 선택 및 고정: ${firstFacilityOption.textContent} (값: ${firstFacilityOption.value})`);
                }
            }
        }
    }
    
    // 수정 모드일 때도 시설 로드
    if (id) {
        await loadFacilities();
    }
    
    // 지점 선택 시 상품 목록 다시 로드 (모달이 열리기 전에 이벤트 리스너 추가)
    const facilitySelectForEvent = document.getElementById('booking-facility');
    if (facilitySelectForEvent) {
        // 기존 이벤트 리스너 제거를 위해 함수를 별도로 정의
        const handleFacilityChange = async function() {
            const memberId = document.getElementById('selected-member-id')?.value;
            if (memberId) {
                App.log('[지점 변경] 상품 목록 다시 로드:', memberId, '지점:', this.value);
                await loadMemberProducts(memberId);
            }
        };
        
        // 기존 이벤트 리스너 제거 후 새로 추가
        facilitySelectForEvent.removeEventListener('change', handleFacilityChange);
        facilitySelectForEvent.addEventListener('change', handleFacilityChange);
    }
    
    App.Modal.open('booking-modal');
    
    // 모달이 열린 직후 시설이 선택되어 있는지 여러 번 확인하고, 없으면 강제 선택
    if (!id) {
        // 즉시 확인 및 강제 선택 및 고정
        setTimeout(() => {
            const facilitySelect = document.getElementById('booking-facility');
            if (facilitySelect) {
                if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                    // 첫 번째 시설 강제 선택 및 고정
                    const firstOption = facilitySelect.options[1]; // 첫 번째는 "시설 선택..."
                    if (firstOption && firstOption.value) {
                        facilitySelect.value = firstOption.value;
                        facilitySelect.disabled = true;
                        facilitySelect.classList.add('facility-fixed');
                        // 오버레이에 선택된 시설명 표시
                        const displayDiv = document.getElementById('facility-selected-display');
                        const nameSpan = document.getElementById('facility-selected-name');
                        if (displayDiv && nameSpan) {
                            nameSpan.textContent = firstOption.textContent;
                            displayDiv.style.display = 'flex';
                        }
                        App.log(`[시설 로드] 모달 열린 후 즉시 강제 선택 및 고정: ${firstOption.textContent}`);
                    }
                } else if (!facilitySelect.value && facilitySelect.options.length <= 1) {
                    App.log('[시설 로드] 모달 열린 후 즉시 확인 - 시설 재로드 필요');
                    loadFacilities();
                } else if (facilitySelect.value && !facilitySelect.disabled) {
                    // 시설이 선택되어 있지만 활성화되어 있으면 고정
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent;
                        nameSpan.textContent = selectedText || '';
                        displayDiv.style.display = 'flex';
                    }
                    App.log(`[시설 로드] 모달 열린 후 즉시 확인 - 시설 고정: ${facilitySelect.options[facilitySelect.selectedIndex]?.textContent}`);
                }
            }
        }, 50);
        
        // 추가 확인 및 강제 선택 및 고정 (150ms 후)
        setTimeout(() => {
            const facilitySelect = document.getElementById('booking-facility');
            if (facilitySelect) {
                if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                    const firstOption = facilitySelect.options[1];
                    if (firstOption && firstOption.value) {
                        facilitySelect.value = firstOption.value;
                        facilitySelect.disabled = true;
                        facilitySelect.classList.add('facility-fixed');
                        // 오버레이에 선택된 시설명 표시
                        const displayDiv = document.getElementById('facility-selected-display');
                        const nameSpan = document.getElementById('facility-selected-name');
                        if (displayDiv && nameSpan) {
                            nameSpan.textContent = firstOption.textContent;
                            displayDiv.style.display = 'flex';
                        }
                        App.log(`[시설 로드] 모달 열린 후 추가 강제 선택 및 고정: ${firstOption.textContent}`);
                    }
                } else if (!facilitySelect.value && facilitySelect.options.length <= 1) {
                    App.log('[시설 로드] 모달 열린 후 추가 확인 - 시설 재로드 필요');
                    loadFacilities();
                } else if (facilitySelect.value && !facilitySelect.disabled) {
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent;
                        nameSpan.textContent = selectedText || '';
                        displayDiv.style.display = 'flex';
                    }
                }
            }
        }, 150);
        
        // 최종 확인 및 강제 선택 및 고정 (300ms 후)
        setTimeout(() => {
            const facilitySelect = document.getElementById('booking-facility');
            if (facilitySelect) {
                if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                    const firstOption = facilitySelect.options[1];
                    if (firstOption && firstOption.value) {
                        facilitySelect.value = firstOption.value;
                        facilitySelect.disabled = true;
                        facilitySelect.classList.add('facility-fixed');
                        // 오버레이에 선택된 시설명 표시
                        const displayDiv = document.getElementById('facility-selected-display');
                        const nameSpan = document.getElementById('facility-selected-name');
                        if (displayDiv && nameSpan) {
                            nameSpan.textContent = firstOption.textContent;
                            displayDiv.style.display = 'flex';
                        }
                        App.log(`[시설 로드] 모달 열린 후 최종 강제 선택 및 고정: ${firstOption.textContent}`);
                    }
                } else if (!facilitySelect.value && facilitySelect.options.length <= 1) {
                    App.log('[시설 로드] 모달 열린 후 최종 확인 - 시설 재로드 필요');
                    loadFacilities();
                } else if (facilitySelect.value && !facilitySelect.disabled) {
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent;
                        nameSpan.textContent = selectedText || '';
                        displayDiv.style.display = 'flex';
                    }
                    App.log(`[시설 로드] ✅ 최종 확인 완료 - 시설 고정: ${facilitySelect.options[facilitySelect.selectedIndex]?.textContent}`);
                }
            }
        }, 300);
    }
    
    // 모달이 열린 후 레슨 종목 필터링 적용
    setTimeout(() => filterLessonCategoryOptions(), 200);
    
    // 모달 닫기 이벤트 리스너 추가
    setupBookingModalCloseHandler();
}

// 예약 모달 닫기 핸들러 설정
function setupBookingModalCloseHandler() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;
    
    const closeHandler = () => {
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.remove('active');
        }
        
        // 현재 뷰에 맞는 버튼에 active 클래스 추가
        if (currentView === 'calendar') {
            document.getElementById('btn-calendar')?.classList.add('active');
        } else if (currentView === 'list') {
            document.getElementById('btn-list')?.classList.add('active');
        }
    };
    
    // MutationObserver로 모달의 active 클래스 제거 감지
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!modal.classList.contains('active')) {
                    closeHandler();
                }
            }
        });
    });
    
    observer.observe(modal, {
        attributes: true,
        attributeFilter: ['class']
    });
}

async function loadBookingData(id) {
    try {
        // 시설 목록 다시 로드 (각 지점에 맞게 필터링)
        await loadFacilities();
        
        const booking = await App.api.get(`/bookings/${id}`);
        // 폼에 데이터 채우기
        document.getElementById('booking-id').value = booking.id;
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            facilitySelect.value = booking.facility?.id || '';
            // 시설 필드가 비활성화되어 있으면 다시 활성화 (수정 모드이므로)
            if (facilitySelect.disabled) {
                facilitySelect.disabled = false;
                facilitySelect.classList.remove('facility-fixed');
                // 오버레이 숨기기
                const displayDiv = document.getElementById('facility-selected-display');
                if (displayDiv) {
                    displayDiv.style.display = 'none';
                }
            }
        }
        document.getElementById('selected-member-id').value = booking.member?.id || '';
        document.getElementById('selected-member-number').value = booking.member?.memberNumber || '';
        
        if (booking.member) {
            // 회원 정보 표시
            document.getElementById('member-info-name').textContent = booking.member.name || '-';
            document.getElementById('member-info-phone').textContent = booking.member.phoneNumber || '-';
            document.getElementById('member-info-grade').textContent = getGradeText(booking.member.grade) || '-';
            document.getElementById('member-info-school').textContent = booking.member.school || '-';
            
            document.getElementById('member-info-section').style.display = 'block';
            document.getElementById('non-member-section').style.display = 'none';
            document.getElementById('member-select-section').style.display = 'none';
            
            // 회원의 상품 목록 로드 후 예약에 연결된 상품 선택 (수정 시 상품이 보이도록)
            await loadMemberProducts(booking.member.id);
            
            // 코치 목록 로드
            if (document.getElementById('booking-coach') && document.getElementById('booking-coach').options.length <= 1) {
                await loadCoachesForBooking();
            }
            
            // 코치 선택 설정
            const coachSelect = document.getElementById('booking-coach');
            if (coachSelect && booking.coach && booking.coach.id) {
                coachSelect.value = booking.coach.id;
            }
        } else {
            // 비회원 정보 표시
            document.getElementById('booking-non-member-name').value = booking.nonMemberName || '';
            document.getElementById('booking-phone').value = booking.nonMemberPhone || '';
            
            document.getElementById('member-info-section').style.display = 'none';
            document.getElementById('non-member-section').style.display = 'block';
            document.getElementById('member-select-section').style.display = 'none';
        }
        
        const startDate = new Date(booking.startTime);
        document.getElementById('booking-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('booking-start-time').value = startDate.toTimeString().slice(0, 5);
        
        const endDate = new Date(booking.endTime);
        document.getElementById('booking-end-time').value = endDate.toTimeString().slice(0, 5);
        
        document.getElementById('booking-participants').value = booking.participants || 1;
        document.getElementById('booking-purpose').value = booking.purpose || 'RENTAL';
        
        // 지점 필드 설정 (페이지별로 고정, hidden input)
        const branchInput = document.getElementById('booking-branch');
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA' };
            branchInput.value = config.branch;
        }
        
        // 목적 변경 시 레슨 카테고리 필드 표시/숨김 처리
        toggleLessonCategory();
        // 레슨 카테고리 설정
        const lessonCategoryEl = document.getElementById('booking-lesson-category');
        if (lessonCategoryEl) {
            // 야구 예약 페이지에서는 항상 야구로 고정
            const config = window.BOOKING_PAGE_CONFIG || {};
            if (config.facilityType === 'BASEBALL') {
                lessonCategoryEl.value = 'BASEBALL';
                lessonCategoryEl.disabled = true;
                lessonCategoryEl.style.backgroundColor = 'var(--bg-secondary)';
                lessonCategoryEl.style.color = 'var(--text-muted)';
            } else if (booking.lessonCategory) {
                lessonCategoryEl.value = booking.lessonCategory;
            }
        }
        document.getElementById('booking-status').value = booking.status || 'PENDING';
        document.getElementById('booking-payment-method').value = booking.paymentMethod || '';
        document.getElementById('booking-notes').value = booking.memo || '';
        
        // MemberProduct 정보 설정 (있는 경우) - loadMemberProducts 완료 후 바로 설정
        if (booking.memberProduct && booking.memberProduct.id && booking.member) {
            const select = document.getElementById('booking-member-product');
            const productId = booking.memberProduct.id;
            const productIdStr = String(productId);
            if (select) {
                const opt = Array.from(select.options).find(o => o.value === productIdStr);
                if (opt) {
                    select.value = productIdStr;
                    const productInfo = document.getElementById('product-info');
                    const productInfoText = document.getElementById('product-info-text');
                    const memberProduct = booking.memberProduct;
                    if (productInfo && productInfoText && memberProduct.product) {
                        if (memberProduct.product.type === 'COUNT_PASS') {
                            const remaining = memberProduct.remainingCount ?? 0;
                            productInfoText.textContent = `횟수권 사용: 잔여 ${remaining}회`;
                            productInfo.style.display = 'block';
                        } else {
                            productInfoText.textContent = '상품 사용 예정';
                            productInfo.style.display = 'block';
                        }
                    }
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    App.log('[예약 수정] 상품 선택 적용:', productIdStr);
                } else {
                    // 옵션에 없으면(필터로 제외됐을 수 있음) API로 해당 상품 확인 후 옵션 추가
                    try {
                        const mp = await App.api.get(`/member-products/${productId}`);
                        if (mp && mp.member && String(mp.member.id) === String(booking.member.id)) {
                            const option = document.createElement('option');
                            option.value = String(mp.id);
                            option.textContent = (mp.product && mp.product.name) ? mp.product.name : `이용권 #${mp.id}`;
                            if (mp.product && mp.product.type) option.dataset.productType = mp.product.type;
                            option.dataset.remainingCount = (mp.remainingCount != null) ? mp.remainingCount : '';
                            if (mp.coach && mp.coach.id) option.dataset.coachId = String(mp.coach.id);
                            select.appendChild(option);
                            select.value = String(mp.id);
                            const productInfo = document.getElementById('product-info');
                            const productInfoText = document.getElementById('product-info-text');
                            if (productInfo && productInfoText && mp.product) {
                                if (mp.product.type === 'COUNT_PASS') {
                                    const remaining = mp.remainingCount ?? 0;
                                    productInfoText.textContent = `횟수권 사용: 잔여 ${remaining}회`;
                                    productInfo.style.display = 'block';
                                } else {
                                    productInfoText.textContent = '상품 사용 예정';
                                    productInfo.style.display = 'block';
                                }
                            }
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            App.log('[예약 수정] 상품 옵션 추가 후 선택:', mp.id);
                        }
                    } catch (e) {
                        App.err('[예약 수정] 예약 연결 상품 로드 실패:', e);
                    }
                }
            }
        } else {
            // 상품이 없는 경우에만 기존 코치 설정
            // 코치 선택 필드 설정 (비회원 예약 시에도 사용)
            if (document.getElementById('booking-coach')) {
                document.getElementById('booking-coach').value = booking.coach?.id || '';
            }
        }
    } catch (error) {
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

function editBooking(id) {
    openBookingModal(id);
}

async function saveBooking() {
    App.log('[saveBooking] 예약 저장 시작');
    
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start-time').value;
    const endTime = document.getElementById('booking-end-time').value;
    
    App.log('[saveBooking] 기본 필드:', { date, startTime, endTime });
    
    // 날짜 검증
    if (!date || date.trim() === '') {
        App.warn('[saveBooking] 날짜가 없음');
        App.showNotification('날짜를 선택해주세요.', 'danger');
        return;
    }
    
    // 시작 시간 검증
    if (!startTime || startTime.trim() === '') {
        App.warn('[saveBooking] 시작 시간이 없음');
        App.showNotification('시작 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 종료 시간 검증
    if (!endTime || endTime.trim() === '') {
        App.warn('[saveBooking] 종료 시간이 없음');
        App.showNotification('종료 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 시작 시간과 종료 시간 비교
    if (startTime && endTime && startTime >= endTime) {
        App.warn('[saveBooking] 종료 시간이 시작 시간보다 이전임');
        App.showNotification('종료 시간은 시작 시간보다 늦어야 합니다.', 'danger');
        return;
    }
    let facilityId = document.getElementById('booking-facility').value;
    const facilitySelect = document.getElementById('booking-facility');
    
    // 시설이 선택되지 않았으면 첫 번째 시설 자동 선택
    if (!facilityId && facilitySelect && facilitySelect.options.length > 1) {
        const firstOption = facilitySelect.options[1]; // 첫 번째는 "시설 선택..."
        if (firstOption && firstOption.value) {
            facilitySelect.value = firstOption.value;
            facilityId = firstOption.value;
            App.log('[saveBooking] 시설이 없어 첫 번째 시설 자동 선택:', firstOption.textContent);
        }
    }
    
    const memberNumber = document.getElementById('selected-member-number').value; // MEMBER_NUMBER 사용
    const memberId = document.getElementById('selected-member-id').value; // 하위 호환성
    const nonMemberName = document.getElementById('booking-non-member-name').value;
    const nonMemberPhone = document.getElementById('booking-phone').value;
    const coachIdElement = document.getElementById('booking-coach');
    const coachId = coachIdElement ? coachIdElement.value : '';
    const participants = document.getElementById('booking-participants').value;
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryElement = document.getElementById('booking-lesson-category');
    const lessonCategory = lessonCategoryElement ? lessonCategoryElement.value : null;
    const paymentMethod = document.getElementById('booking-payment-method').value;
    const memo = document.getElementById('booking-notes').value;
    const memberProductId = document.getElementById('booking-member-product')?.value || null;
    
    App.log('[saveBooking] 모든 필드 값:', {
        date, startTime, endTime, facilityId, memberNumber, memberId,
        coachId, participants, purpose, lessonCategory, paymentMethod, memo, memberProductId
    });
    
    // 필수 필드 검증
    if (!date || !startTime || !endTime || !facilityId) {
        App.err('[saveBooking] 필수 필드 누락:', {
            date: !!date,
            startTime: !!startTime,
            endTime: !!endTime,
            facilityId: !!facilityId,
            facilitySelectOptions: facilitySelect ? facilitySelect.options.length : 0
        });
        App.showNotification('필수 항목(날짜, 시간, 시설)을 모두 입력해주세요.', 'danger');
        return;
    }
    
    if (!purpose) {
        App.err('[saveBooking] 목적이 선택되지 않음');
        App.showNotification('목적을 선택해주세요.', 'danger');
        return;
    }
    
    // 레슨인 경우 레슨 카테고리 필수
    if (purpose === 'LESSON') {
        const lessonCategory = document.getElementById('booking-lesson-category')?.value;
        if (!lessonCategory) {
            App.err('[saveBooking] 레슨인데 레슨 종목이 선택되지 않음');
            App.showNotification('레슨인 경우 레슨 종목을 선택해주세요.', 'danger');
            return;
        }
    }
    
    // 회원/비회원 검증
    if (!memberNumber && !memberId && (!nonMemberName || !nonMemberPhone)) {
        App.showNotification('회원을 선택하거나 비회원 정보를 입력해주세요.', 'danger');
        return;
    }
    
    // 비회원인 경우 이름과 전화번호 필수
    if ((!memberNumber && !memberId) && (!nonMemberName || !nonMemberPhone)) {
        App.showNotification('비회원인 경우 이름과 연락처를 모두 입력해주세요.', 'danger');
        return;
    }
    
    // 회원 예약인 경우 상품/이용권 선택 필수
    if ((memberNumber || memberId) && !memberProductId) {
        App.showNotification('사용할 상품/이용권을 선택해주세요.', 'danger');
        return;
    }
    
    // 상품 선택 시 횟수권 잔여 횟수 확인
    if (memberProductId) {
        const productSelect = document.getElementById('booking-member-product');
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        const productType = selectedOption.dataset.productType;
        const remainingCount = parseInt(selectedOption.dataset.remainingCount) || 0;
        
        if (productType === 'COUNT_PASS' && remainingCount <= 0) {
            App.showNotification('선택한 횟수권의 잔여 횟수가 없습니다.', 'danger');
            return;
        }
    }
    
    // 종료 시간 재검증 (날짜와 시간 결합 전)
    if (!endTime || endTime.trim() === '') {
        App.warn('[saveBooking] 종료 시간이 없음 (날짜/시간 결합 전)');
        App.showNotification('종료 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 날짜와 시간 결합 (ISO 8601 형식)
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;
    
    // 디버깅: 시간 값 확인
    App.log('예약 시간 확인:', {
        date: date,
        startTime: startTime,
        endTime: endTime,
        startDateTime: startDateTime,
        endDateTime: endDateTime
    });
    
    // 회원 예약은 항상 PENDING 상태로 시작 (확인 후 CONFIRMED로 변경)
    const statusSelect = document.getElementById('booking-status');
    const bookingIdElement = document.getElementById('booking-id');
    const bookingId = bookingIdElement ? bookingIdElement.value.trim() : '';
    
    // 새 예약인지 확인 (bookingId가 없거나 빈 문자열이면 새 예약)
    const isNewBooking = !bookingId || bookingId === '';
    
    let bookingStatus = 'PENDING';
    
    // 수정 모드인 경우에만 기존 상태 유지, 새 예약은 항상 PENDING
    if (!isNewBooking && statusSelect && statusSelect.value) {
        // 수정 모드: 기존 상태 유지
        bookingStatus = statusSelect.value;
        App.log('[예약 저장] 수정 모드 - 상태 유지:', bookingStatus);
    } else {
        // 새 예약: 항상 PENDING으로 설정
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        App.log('[예약 저장] 새 예약 - 상태 PENDING으로 설정');
    }
    
    // 시설 선택 시 시설의 지점 정보를 우선적으로 사용
    // facilitySelect는 이미 위에서 선언됨
    let branchValue = document.getElementById('booking-branch')?.value || (window.BOOKING_PAGE_CONFIG || {}).branch || 'SAHA';
    
    // 시설이 선택되어 있으면 시설의 지점 정보를 사용
    if (facilitySelect && facilitySelect.value) {
        const selectedOption = facilitySelect.options[facilitySelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.branch) {
            branchValue = selectedOption.dataset.branch.toUpperCase();
            App.log(`[예약 저장] 시설의 지점 정보 사용: ${branchValue}`);
            // booking-branch도 업데이트
            const branchInput = document.getElementById('booking-branch');
            if (branchInput) {
                branchInput.value = branchValue;
            }
        }
    }
    
    const data = {
        facility: { id: parseInt(facilityId) },
        memberNumber: memberNumber || null, // MEMBER_NUMBER 사용
        member: memberId ? { id: parseInt(memberId) } : null, // 하위 호환성
        nonMemberName: (memberNumber || memberId) ? null : (nonMemberName || null),
        nonMemberPhone: (memberNumber || memberId) ? null : (nonMemberPhone || null),
        coach: coachId ? { id: parseInt(coachId) } : null,
        memberProductId: memberProductId ? parseInt(memberProductId) : null, // 상품/이용권 ID
        startTime: startDateTime,
        endTime: endDateTime,
        participants: parseInt(participants) || 1,
        purpose: purpose,
        lessonCategory: (purpose === 'LESSON' && lessonCategory) ? lessonCategory : null,
        status: bookingStatus, // 회원 예약은 기본적으로 PENDING
        branch: branchValue, // 시설의 지점 정보 우선 사용
        // paymentMethod 값 변환 (프론트엔드 -> 백엔드 enum 형식)
        paymentMethod: paymentMethod ? (paymentMethod === 'ONSITE' ? 'ON_SITE' : (paymentMethod === 'DEFERRED' ? 'POSTPAID' : paymentMethod)) : null,
        memo: memo || null
    };
    
    App.log('예약 저장 데이터:', JSON.stringify(data, null, 2));
    
    try {
        const id = document.getElementById('booking-id').value;
        let savedBooking;
        if (id) {
            savedBooking = await App.api.put(`/bookings/${id}`, data);
            App.showNotification('예약이 수정되었습니다.', 'success');
        } else {
            savedBooking = await App.api.post('/bookings', data);
            App.log('예약 저장 성공:', savedBooking);
            
            // 반복 예약 처리
            const repeatEnabled = document.getElementById('booking-repeat-enabled').checked;
            if (repeatEnabled) {
                const repeatType = document.getElementById('booking-repeat-type').value;
                const repeatCount = parseInt(document.getElementById('booking-repeat-count').value) || 1;
                
                await createRepeatBookings(data, repeatType, repeatCount);
                App.showNotification(`예약이 등록되었습니다 (반복 ${repeatCount}회 포함).`, 'success');
            } else {
                App.showNotification('예약이 등록되었습니다.', 'success');
            }
        }
        
        App.Modal.close('booking-modal');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            // 캘린더 뷰인 경우 예약 날짜로 이동 후 새로고침
            if (savedBooking && savedBooking.startTime) {
                try {
                    const bookingDate = new Date(savedBooking.startTime);
                    const bookingYear = bookingDate.getFullYear();
                    const bookingMonth = bookingDate.getMonth();
                    
                    // 예약이 있는 월로 캘린더 이동
                    if (currentDate.getFullYear() !== bookingYear || currentDate.getMonth() !== bookingMonth) {
                        currentDate = new Date(bookingYear, bookingMonth, 1);
                        App.log(`예약 날짜로 캘린더 이동: ${bookingYear}년 ${bookingMonth + 1}월`);
                    }
                } catch (e) {
                    App.err('예약 날짜 파싱 오류:', savedBooking.startTime, e);
                }
            }
            App.log('캘린더 새로고침 시작...');
            await renderCalendar();
        }
    } catch (error) {
        App.err('[saveBooking] 예약 저장 실패:', error);
        App.err('[saveBooking] 에러 상세:', {
            message: error.message,
            response: error.response,
            data: error.response?.data,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        // 에러 응답의 상세 정보 확인
        if (error.response && error.response.data) {
            App.err('[saveBooking] 서버 에러 응답:', JSON.stringify(error.response.data, null, 2));
        }
        
        let errorMessage = '저장에 실패했습니다. 필수 정보를 확인해주세요.';
        if (error.response && error.response.data) {
            if (error.response.data.message) {
                errorMessage = error.response.data.message;
            } else if (error.response.data.error) {
                errorMessage = error.response.data.error;
            } else if (typeof error.response.data === 'string') {
                errorMessage = error.response.data;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        App.showNotification(errorMessage, 'danger');
    }
}

// 반복 예약 생성
async function createRepeatBookings(baseData, repeatType, repeatCount) {
    const baseDate = new Date(baseData.startTime);
    const startTime = baseData.startTime.split('T')[1];
    const endTime = baseData.endTime.split('T')[1];
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 1; i < repeatCount; i++) {
        const newDate = new Date(baseDate);
        
        // 반복 주기에 따라 날짜 계산
        switch (repeatType) {
            case 'DAILY':
                newDate.setDate(newDate.getDate() + i);
                break;
            case 'WEEKLY':
                newDate.setDate(newDate.getDate() + (i * 7));
                break;
            case 'MONTHLY':
                newDate.setMonth(newDate.getMonth() + i);
                break;
        }
        
        const dateStr = newDate.toISOString().split('T')[0];
        const repeatData = {
            ...baseData,
            startTime: `${dateStr}T${startTime}`,
            endTime: `${dateStr}T${endTime}`
        };
        
        try {
            await App.api.post('/bookings', repeatData);
            successCount++;
        } catch (error) {
            App.err(`반복 예약 생성 실패 (${i}회차):`, error);
            failCount++;
        }
    }
    
    App.log(`반복 예약 생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

// 예약 승인 (빠른 승인)
async function approveBooking(id) {
    if (!confirm('이 예약을 승인하시겠습니까?')) {
        return;
    }
    
    try {
        // 먼저 예약 정보를 가져온 후 status만 변경
        const booking = await App.api.get(`/bookings/${id}`);
        
        // 상태만 업데이트 (기존 데이터 유지)
        const updateData = {
            ...booking,
            status: 'CONFIRMED'
        };
        
        // 객체 참조 제거 (순환 참조 방지)
        if (updateData.facility) {
            updateData.facility = { id: updateData.facility.id };
        }
        if (updateData.member) {
            updateData.member = updateData.member.id ? { id: updateData.member.id } : null;
        }
        if (updateData.coach) {
            updateData.coach = updateData.coach.id ? { id: updateData.coach.id } : null;
        }
        // 컬렉션 필드 제거
        delete updateData.payments;
        delete updateData.attendances;
        
        await App.api.put(`/bookings/${id}`, updateData);
        App.showNotification('예약이 승인되었습니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        App.err('예약 승인 실패:', error);
        App.showNotification('승인에 실패했습니다.', 'danger');
    }
}

// 전체 대기 예약 확인 (한 번에 처리)
async function confirmAllPendingBookings() {
    if (!confirm('현재 필터 조건에 맞는 모든 대기 예약을 확정하시겠습니까?')) {
        return;
    }
    
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
        const branch = config.branch || 'SAHA';
        const facilityType = config.facilityType;
        
        // 필터 조건 가져오기 (코치 필터: 예약 페이지 / 시설 필터: 대관 페이지)
        const filterCoach = document.getElementById('filter-coach')?.value || '';
        const filterFacility = document.getElementById('filter-facility')?.value || '';
        const filterStatus = document.getElementById('filter-status')?.value || '';
        const filterDateStart = document.getElementById('filter-date-start')?.value || '';
        const filterDateEnd = document.getElementById('filter-date-end')?.value || '';
        
        // API 파라미터 구성
        const params = new URLSearchParams();
        params.append('branch', branch);
        if (facilityType) {
            params.append('facilityType', facilityType);
        }
        
        // 예약 목록 가져오기
        let bookings = await App.api.get(`/bookings?${params.toString()}`);
        
        // 필터 적용
        if (filterCoach) {
            const coachKey = filterCoach === 'unassigned' ? 'unassigned' : (parseInt(filterCoach, 10) || filterCoach);
            bookings = bookings.filter(b => {
                const c = b.coach || (b.member && b.member.coach ? b.member.coach : null);
                const cid = (c && c.id != null) ? c.id : 'unassigned';
                return cid === coachKey || cid.toString() === filterCoach;
            });
        } else if (filterFacility) {
            bookings = bookings.filter(b => b.facility && b.facility.id.toString() === filterFacility);
        }
        if (filterDateStart) {
            const startDate = new Date(filterDateStart);
            bookings = bookings.filter(b => {
                const bookingDate = new Date(b.startTime);
                return bookingDate >= startDate;
            });
        }
        if (filterDateEnd) {
            const endDate = new Date(filterDateEnd);
            endDate.setHours(23, 59, 59, 999);
            bookings = bookings.filter(b => {
                const bookingDate = new Date(b.startTime);
                return bookingDate <= endDate;
            });
        }
        
        // PENDING 상태인 예약만 필터링
        const pendingBookings = bookings.filter(b => b.status === 'PENDING');
        
        if (pendingBookings.length === 0) {
            App.showNotification('확정할 대기 예약이 없습니다.', 'info');
            return;
        }
        
        // 확인 메시지
        if (!confirm(`총 ${pendingBookings.length}개의 대기 예약을 확정하시겠습니까?`)) {
            return;
        }
        
        // 모든 대기 예약을 확정으로 변경
        let successCount = 0;
        let failCount = 0;
        
        for (const booking of pendingBookings) {
            try {
                // 예약 정보 가져오기
                const fullBooking = await App.api.get(`/bookings/${booking.id}`);
                
                // 상태만 업데이트 (기존 데이터 유지)
                const updateData = {
                    ...fullBooking,
                    status: 'CONFIRMED'
                };
                
                // 객체 참조 제거 (순환 참조 방지)
                if (updateData.facility) {
                    updateData.facility = { id: updateData.facility.id };
                }
                if (updateData.member) {
                    updateData.member = updateData.member.id ? { id: updateData.member.id } : null;
                }
                if (updateData.coach) {
                    updateData.coach = updateData.coach.id ? { id: updateData.coach.id } : null;
                }
                // 컬렉션 필드 제거
                delete updateData.payments;
                delete updateData.attendances;
                
                await App.api.put(`/bookings/${booking.id}`, updateData);
                successCount++;
            } catch (error) {
                App.err(`예약 ${booking.id} 승인 실패:`, error);
                failCount++;
            }
        }
        
        // 결과 알림
        if (failCount === 0) {
            App.showNotification(`모든 예약(${successCount}개)이 확정되었습니다.`, 'success');
        } else {
            App.showNotification(`${successCount}개 확정 완료, ${failCount}개 실패`, 'warning');
        }
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        App.err('전체 확인 실패:', error);
        App.showNotification('전체 확인 처리에 실패했습니다.', 'danger');
    }
}

// 승인 대기 예약 모달: 통계와 동일한 기간/필터로 열기
function getStatsParams() {
    const config = window.BOOKING_PAGE_CONFIG || { branch: 'SAHA', facilityType: 'BASEBALL' };
    const filterStart = document.getElementById('filter-date-start')?.value || '';
    const filterEnd = document.getElementById('filter-date-end')?.value || '';
    let startISO, endISO;
    if (filterStart && filterEnd) {
        const start = new Date(filterStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterEnd);
        end.setHours(23, 59, 59, 999);
        startISO = start.toISOString();
        endISO = end.toISOString();
    } else {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        last.setHours(23, 59, 59, 999);
        startISO = first.toISOString();
        endISO = last.toISOString();
    }
    const params = new URLSearchParams({ start: startISO, end: endISO });
    if (config.branch) params.append('branch', config.branch);
    if (config.facilityType) params.append('facilityType', config.facilityType);
    if (config.lessonCategory) params.append('lessonCategory', config.lessonCategory);
    return params;
}

function openPendingApprovalModal() {
    const modal = document.getElementById('pending-approval-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('pending-approval-loading').style.display = 'block';
    document.getElementById('pending-approval-toolbar').style.display = 'none';
    document.getElementById('pending-approval-table-wrap').style.display = 'none';
    document.getElementById('pending-approval-empty').style.display = 'none';

    var pendingCoachSelect = document.getElementById('pending-approval-filter-coach');
    if (pendingCoachSelect) {
        pendingCoachSelect.innerHTML = '<option value="">전체 코치</option>';
        pendingCoachSelect.onchange = function() { loadPendingBookingsForModal(); };
    }

    loadPendingBookingsForModal();
}

function closePendingApprovalModal() {
    const modal = document.getElementById('pending-approval-modal');
    if (modal) modal.style.display = 'none';
}

async function loadPendingBookingsForModal() {
    const loadingEl = document.getElementById('pending-approval-loading');
    const toolbarEl = document.getElementById('pending-approval-toolbar');
    const tableWrap = document.getElementById('pending-approval-table-wrap');
    const tbody = document.getElementById('pending-approval-tbody');
    const emptyEl = document.getElementById('pending-approval-empty');
    if (!tbody) return;
    try {
        const params = getStatsParams();
        var coachSelect = document.getElementById('pending-approval-filter-coach');
        if (coachSelect && coachSelect.value && coachSelect.value !== 'unassigned') {
            var cid = parseInt(coachSelect.value, 10);
            if (!isNaN(cid)) params.append('coachId', cid);
        }
        const list = await App.api.get('/bookings/pending?' + params.toString());
        loadingEl.style.display = 'none';
        window._pendingApprovalList = list || [];
        if (!list || list.length === 0) {
            tableWrap.style.display = 'none';
            toolbarEl.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';
        toolbarEl.style.display = 'flex';
        tableWrap.style.display = 'block';

        var coachSelectEl = document.getElementById('pending-approval-filter-coach');
        var currentCoachValue = coachSelectEl ? coachSelectEl.value : '';
        if (coachSelectEl && !params.has('coachId')) {
            var coachMap = {};
            list.forEach(function(b) {
                if (b.coachId != null && b.coachName != null) {
                    coachMap[b.coachId] = b.coachName;
                }
            });
            coachSelectEl.innerHTML = '<option value="">전체 코치</option>';
            Object.keys(coachMap).sort(function(a, b) { return String(coachMap[a]).localeCompare(String(coachMap[b])); }).forEach(function(cid) {
                var opt = document.createElement('option');
                opt.value = cid;
                opt.textContent = coachMap[cid];
                coachSelectEl.appendChild(opt);
            });
            if (currentCoachValue && coachSelectEl.querySelector('option[value="' + currentCoachValue + '"]')) {
                coachSelectEl.value = currentCoachValue;
            }
        }

        tbody.innerHTML = list.map(b => {
            const startStr = b.startTime && typeof b.startTime === 'string' ? b.startTime : (b.startTime ? String(b.startTime) : '');
            const start = startStr ? startStr.replace('T', ' ').slice(0, 16) : '-';
            const facilityName = (b.facility && b.facility.name) ? App.escapeHtml(b.facility.name) : '-';
            const memberName = (b.memberName != null && b.memberName !== '') ? App.escapeHtml(b.memberName) : '-';
            const coachName = (b.coachName != null && b.coachName !== '') ? App.escapeHtml(b.coachName) : '-';
            return `<tr>
                <td><input type="checkbox" class="pending-approval-cb" data-booking-id="${b.id}"></td>
                <td>${start}</td>
                <td>${facilityName}</td>
                <td>${memberName}</td>
                <td>${coachName}</td>
                <td><button type="button" class="btn btn-success btn-sm" data-booking-id="${b.id}">승인</button></td>
            </tr>`;
        }).join('');

        document.getElementById('pending-approval-select-all').checked = false;
        document.getElementById('pending-approval-select-all').onclick = function() {
            tbody.querySelectorAll('.pending-approval-cb').forEach(cb => cb.checked = this.checked);
        };
        var pendingBulkBtn = document.getElementById('pending-approval-bulk-btn');
        if (pendingBulkBtn) {
            pendingBulkBtn.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';
            pendingBulkBtn.onclick = function() {
                const ids = Array.from(tbody.querySelectorAll('.pending-approval-cb:checked')).map(cb => parseInt(cb.getAttribute('data-booking-id'), 10));
                if (ids.length === 0) {
                    App.showNotification('승인할 예약을 선택해 주세요.', 'warning');
                    return;
                }
                approvePendingBookingIds(ids);
            };
        }
        tbody.querySelectorAll('button[data-booking-id]').forEach(btn => {
            btn.onclick = function() {
                const id = parseInt(this.getAttribute('data-booking-id'), 10);
                approvePendingBookingIds([id]);
            };
        });
    } catch (err) {
        App.err('승인 대기 목록 로드 실패:', err);
        loadingEl.style.display = 'none';
        emptyEl.textContent = '목록을 불러오지 못했습니다.';
        emptyEl.style.display = 'block';
    }
}

async function approvePendingBookingIds(bookingIds) {
    if (!bookingIds || bookingIds.length === 0) return;
    try {
        const res = await App.api.post('/bookings/bulk-confirm', { bookingIds });
        const updated = (res && res.updatedCount != null) ? res.updatedCount : 0;
        App.showNotification(updated + '건 승인 완료되었습니다.', 'success');
        await loadPendingBookingsForModal();
        await loadBookingStats();
        if (currentView === 'list') loadBookingsList();
        else await renderCalendar();
    } catch (err) {
        App.err('일괄 승인 실패:', err);
        var msg = '승인 처리에 실패했습니다.';
        if (err && err.response) {
            if (err.response.status === 403) msg = '일괄 승인은 관리자만 사용할 수 있습니다.';
            else if (err.response.data && err.response.data.message) msg = err.response.data.message;
        }
        App.showNotification(msg, 'danger');
    }
}

// 예약 모달에서 삭제
async function deleteBookingFromModal() {
    const deleteBtn = document.getElementById('booking-delete-btn');
    const bookingId = deleteBtn.getAttribute('data-booking-id');
    if (!bookingId) {
        App.showNotification('삭제할 예약을 찾을 수 없습니다.', 'danger');
        return;
    }
    
    if (confirm('정말 이 예약을 삭제하시겠습니까?')) {
        await deleteBooking(parseInt(bookingId));
        // 삭제 후 모달 닫기
        App.Modal.close('booking-modal');
    }
}

async function deleteBooking(id) {
    try {
        await App.api.delete(`/bookings/${id}`);
        App.showNotification('예약이 삭제되었습니다.', 'success');
        
        // 캘린더 뷰인 경우 캘린더 새로고침, 리스트 뷰인 경우 리스트 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        App.err('예약 삭제 실패:', error);
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

// 예약을 다른 날짜로 복사 후 캘린더/목록 새로고침. common.js의 window.copyBookingToDate 사용.
// (이 함수명을 copyBookingToDate로 두면 전역으로 등록되어 window.copyBookingToDate를 덮어써 재귀가 발생하므로 별도 이름 사용)
async function copyBookingToDateAndRefresh(sourceBookingId, sourceBooking, targetDateStr) {
    const branch = (window.BOOKING_PAGE_CONFIG || {}).branch || 'SAHA';
    const doCopy = window.copyBookingToDate;
    if (typeof doCopy !== 'function') {
        App.err('예약 복사: window.copyBookingToDate를 찾을 수 없습니다.');
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification('예약 복사에 실패했습니다.', 'danger');
        }
        return;
    }
    await doCopy(sourceBookingId, sourceBooking, targetDateStr, branch, async () => {
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    });
}

// 예약 번호를 날짜/시간 기준으로 재할당 (조용히, 알림 없이)
async function reorderBookingIdsSilent() {
    try {
        await App.api.post('/bookings/reorder');
        // 알림 없이 조용히 재정렬
    } catch (error) {
        App.err('예약 번호 재할당 실패:', error);
        // 조용히 실패 (사용자에게 알림하지 않음)
    }
}

// 예약 번호를 날짜/시간 기준으로 재할당 (수동 호출용, 현재는 사용하지 않음)
async function reorderBookingIds() {
    if (!confirm('예약 번호를 날짜/시간 순서대로 재할당하시겠습니까?\n\n주의: 이 작업은 모든 예약의 번호를 변경합니다.')) {
        return;
    }
    
    try {
        const response = await App.api.post('/bookings/reorder');
        App.showNotification('예약 번호가 날짜/시간 순서대로 재할당되었습니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        App.err('예약 번호 재할당 실패:', error);
        App.showNotification('예약 번호 재할당에 실패했습니다.', 'danger');
    }
}

function applyFilters() {
    // 코치 필터 드롭다운 값 반영 (대관 제외 페이지)
    const coachSelect = document.getElementById('filter-coach');
    if (coachSelect) {
        const set = window.calendarFilterCoachIds;
        set.clear();
        const v = (coachSelect.value || '').trim();
        if (v) {
            const coachKey = v === 'unassigned' ? 'unassigned' : (parseInt(v, 10) || v);
            set.add(coachKey);
        }
        loadCoachLegend();
    }
    if (currentView === 'list') {
        loadBookingsList();
    } else {
        renderCalendar();
    }
    loadBookingStats();
}

// 예약 선택 기능
function selectBooking(booking, eventElement) {
    // 이전 선택 해제
    if (selectedBooking && selectedBooking.element) {
        selectedBooking.element.style.outline = '';
        selectedBooking.element.style.boxShadow = '';
    }
    
    // 같은 예약을 다시 클릭하면 선택 해제
    if (selectedBooking && selectedBooking.id === booking.id) {
        selectedBooking = null;
        App.log('예약 선택 해제됨');
        return;
    }
    
    // 새로운 예약 선택
    selectedBooking = {
        id: booking.id,
        booking: booking,
        element: eventElement
    };
    
    // 선택된 예약 스타일 변경
    eventElement.style.outline = '3px solid #FFD700';
    eventElement.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
    
    App.log('예약 선택됨:', booking.id, booking);
    App.showNotification('예약이 선택되었습니다. Delete 키를 눌러 삭제할 수 있습니다.', 'info');
}

// 선택된 예약 삭제
async function deleteSelectedBooking() {
    if (!selectedBooking) {
        App.log('선택된 예약이 없습니다.');
        return;
    }
    
    const booking = selectedBooking.booking;
    const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
    const startTime = new Date(booking.startTime);
    const timeStr = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')} ${startTime.getHours()}:${String(startTime.getMinutes()).padStart(2, '0')}`;
    
    if (!confirm(`예약을 삭제하시겠습니까?\n\n회원: ${memberName}\n시간: ${timeStr}`)) {
        return;
    }
    
    try {
        await deleteBooking(selectedBooking.id);
        
        // 선택 해제
        selectedBooking = null;
        
        App.showNotification('예약이 삭제되었습니다.', 'success');
        
        // 캘린더 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        App.err('예약 삭제 실패:', error);
        App.showNotification('예약 삭제에 실패했습니다.', 'danger');
    }
}
