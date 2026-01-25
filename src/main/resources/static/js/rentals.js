// 예약/대관 관리 페이지 JavaScript

let currentDate = new Date();
let currentView = 'calendar';
let currentPage = 1;
let selectedBooking = null; // 현재 선택된 예약

// 목적 변경 시 레슨 카테고리 필드 표시/숨김
function toggleLessonCategory() {
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryGroup = document.getElementById('lesson-category-group');
    if (lessonCategoryGroup) {
        lessonCategoryGroup.style.display = (purpose === 'LESSON') ? 'block' : 'none';
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
    return App.CoachColors.getColor(coach);
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
    
    // Delete 키로 예약 삭제
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' && selectedBooking) {
            e.preventDefault();
            deleteSelectedBooking();
        }
    });
});

async function initializeBookings() {
    // 뷰 전환 이벤트
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            switchView(view);
        });
    });
    
    // 시설 목록 로드
    await loadFacilities();
    
    // 코치 목록 로드 (예약 모달용)
    await loadCoachesForBooking();
    
    // 코치 범례 로드
    await loadCoachLegend();
    
    if (currentView === 'calendar') {
        renderCalendar();
    } else {
        loadBookingsList();
    }
}

// 시설 목록 로드
async function loadFacilities() {
    try {
        const select = document.getElementById('booking-facility');
        if (!select) {
            console.error('[시설 로드] 시설 선택 필드를 찾을 수 없습니다.');
            return;
        }
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'RENTAL', facilityType: 'RENTAL' };
        
        // 대관 페이지에서는 branch 필터링하지 않음 (모든 지점의 대관 시설 표시)
        // facilityType만 필터링
        const params = new URLSearchParams();
        if (config.facilityType) {
            params.append('facilityType', config.facilityType);
        }
        // branch는 대관 페이지에서는 보내지 않음 (모든 지점의 시설 표시)
        
        const facilities = await App.api.get(`/facilities?${params.toString()}`);
        
        if (!facilities || !Array.isArray(facilities)) {
            console.error('[시설 로드] 시설 목록이 배열이 아닙니다:', facilities);
            select.innerHTML = '<option value="">시설 목록을 불러올 수 없습니다</option>';
            return;
        }
        
        select.innerHTML = '<option value="">시설 선택...</option>';
        facilities.forEach(facility => {
            const option = document.createElement('option');
            option.value = facility.id;
            // 지점 정보도 함께 표시 (대관은 모든 지점의 시설이 표시되므로)
            const branchText = facility.branch ? `[${facility.branch === 'SAHA' ? '사하점' : facility.branch === 'YEONSAN' ? '연산점' : facility.branch}]` : '';
            option.textContent = `${facility.name} ${branchText}`.trim();
            select.appendChild(option);
        });
        console.log(`[시설 로드] ${config.facilityType} 시설 ${facilities.length}개 로드됨 (모든 지점)`);
    } catch (error) {
        console.error('[시설 로드] 시설 목록 로드 실패:', error);
        const select = document.getElementById('booking-facility');
        if (select) {
            select.innerHTML = '<option value="">시설 목록 로드 실패</option>';
        }
    }
}

// 코치 목록 로드 (예약 모달용)
async function loadCoachesForBooking() {
    try {
        const coaches = await App.api.get('/coaches');
        const select = document.getElementById('booking-coach');
        if (!select) return;
        
        // 활성 코치만 필터링
        const activeCoaches = coaches.filter(c => c.active !== false);
        select.innerHTML = '<option value="">코치 미지정</option>';
        activeCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('코치 목록 로드 실패:', error);
    }
}

// 비회원 코치 목록 로드 (예약 모달용)
async function loadCoachesForBookingNonMember() {
    try {
        const coaches = await App.api.get('/coaches');
        const select = document.getElementById('booking-coach-nonmember');
        if (!select) return;
        
        // 활성 코치만 필터링
        const activeCoaches = coaches.filter(c => c.active !== false);
        select.innerHTML = '<option value="">코치 미지정</option>';
        activeCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('비회원 코치 목록 로드 실패:', error);
    }
}


// 회원의 상품/이용권 목록 로드
async function loadMemberProducts(memberId) {
    try {
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
        const select = document.getElementById('booking-member-product');
        const productInfo = document.getElementById('product-info');
        const productInfoText = document.getElementById('product-info-text');
        
        if (!select) return;
        
        // 활성 상태인 상품만 필터링
        const activeProducts = memberProducts.filter(mp => mp.status === 'ACTIVE');
        
        select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
        
        if (activeProducts.length === 0) {
            if (productInfo) productInfo.style.display = 'none';
            return;
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
                const remaining = mp.remainingCount !== null && mp.remainingCount !== undefined 
                    ? mp.remainingCount 
                    : (mp.totalCount !== null && mp.totalCount !== undefined 
                        ? mp.totalCount 
                        : (product.usageCount || 10));
                option.dataset.remainingCount = remaining;
            } else {
                option.dataset.remainingCount = 0;
            }
            
            option.textContent = text;
            option.dataset.productType = product.type;
            select.appendChild(option);
        });
        
        // 상품 선택 시 결제 방식 자동 설정 및 정보 표시
        select.onchange = function() {
            const selectedOption = this.options[this.selectedIndex];
            const paymentMethodSelect = document.getElementById('booking-payment-method');
            
            if (selectedOption.value) {
                // 상품 선택 시 선결제로 자동 설정
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = 'PREPAID';
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
        
    } catch (error) {
        console.error('회원 상품 목록 로드 실패:', error);
        const select = document.getElementById('booking-member-product');
        if (select) {
            select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
        }
    }
}

// 지점별 색상 가져오기
function getBranchColor(branch) {
    if (!branch) return null;
    if (branch === 'SAHA' || branch === '사하점') {
        return '#1E8449'; // 더 진한 초록색
    } else if (branch === 'YEONSAN' || branch === '연산점') {
        return '#DAA520'; // 골드색
    }
    return null;
}

// 코치 범례 로드
async function loadCoachLegend() {
    try {
        // 모든 코치를 조회 (branch 필터 제거)
        const coaches = await App.api.get('/coaches');
        const legendContainer = document.getElementById('coach-legend');
        if (!legendContainer) return;
        
        // 활성 코치 중 서정민, 박준현만 필터링
        const activeCoaches = coaches.filter(c => {
            if (c.active === false) return false;
            const name = c.name || '';
            return name.includes('서정민') || name.includes('박준현');
        });
        
        let legendHTML = '<div class="legend-title">범례:</div>';
        
        // 지점 색상 범례 추가
        const sahaColor = getBranchColor('SAHA');
        const yeonsanColor = getBranchColor('YEONSAN');
        
        if (sahaColor) {
            legendHTML += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${sahaColor}"></span>
                    <span class="legend-name">사하점</span>
                </div>
            `;
        }
        
        if (yeonsanColor) {
            legendHTML += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${yeonsanColor}"></span>
                    <span class="legend-name">연산점</span>
                </div>
            `;
        }
        
        // 코치 범례 추가
        activeCoaches.forEach(coach => {
            const color = App.CoachColors.getColor(coach);
            legendHTML += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${color}"></span>
                    <span class="legend-name">${coach.name}</span>
                </div>
            `;
        });
        
        legendContainer.innerHTML = legendHTML;
    } catch (error) {
        console.error('코치 범례 로드 실패:', error);
        // 범례 로드 실패해도 계속 진행
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
    // 캘린더 렌더링 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
    await reorderBookingIdsSilent();
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('calendar-month-year').textContent = 
        `${year}년 ${month + 1}월`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 주의 첫날 (일요일)
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // 주의 마지막날 (토요일)
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // 요일 헤더
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
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
        // ISO 형식으로 변환 (UTC 시간대 포함)
        const startISO = queryStart.toISOString();
        const endISO = queryEnd.toISOString();
        console.log(`예약 데이터 요청: ${startISO} ~ ${endISO}`);
        console.log(`현재 월: ${year}년 ${month + 1}월`);
        console.log(`조회 범위: ${queryStart.toLocaleDateString()} ~ ${queryEnd.toLocaleDateString()}`);
        
        const response = await App.api.get(`/bookings?start=${startISO}&end=${endISO}&branch=RENTAL`);
        bookings = response || [];
        console.log(`캘린더 로드: ${bookings.length}개의 예약 발견`, bookings);
        
        // 예약이 없으면 전체 예약도 확인 (디버깅용)
        if (bookings.length === 0) {
            console.log('날짜 범위 내 예약 없음, 전체 예약 확인 중...');
            try {
                const allBookings = await App.api.get('/bookings?branch=RENTAL');
                console.log(`전체 예약 (대관): ${allBookings ? allBookings.length : 0}개`, allBookings);
                // 전체 예약 중 현재 월에 해당하는 예약 찾기
                if (allBookings && allBookings.length > 0) {
                    const monthBookings = allBookings.filter(b => {
                        if (!b || !b.startTime) return false;
                        try {
                            const bookingDate = new Date(b.startTime);
                            const bookingYear = bookingDate.getFullYear();
                            const bookingMonth = bookingDate.getMonth();
                            console.log(`예약 날짜 확인: ${bookingYear}-${bookingMonth + 1}-${bookingDate.getDate()}, 현재 월: ${year}-${month + 1}`);
                            return bookingYear === year && bookingMonth === month;
                        } catch (e) {
                            console.error('예약 날짜 파싱 오류:', b.startTime, e);
                            return false;
                        }
                    });
                    console.log(`현재 월에 해당하는 예약: ${monthBookings.length}개`, monthBookings);
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
                            console.log(`현재 월에 예약 없음. 가장 가까운 예약: ${earliestDate.getFullYear()}년 ${earliestDate.getMonth() + 1}월`);
                        }
                    }
                }
            } catch (e) {
                console.error('전체 예약 조회 실패:', e);
            }
        }
    } catch (error) {
        console.error('예약 데이터 로드 실패:', error);
    }
    
    // 날짜 셀
    const today = new Date();
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
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
                    console.log(`예약 매칭: ${bookingYear}-${bookingMonth + 1}-${bookingDay} === ${currentYear}-${currentMonth + 1}-${currentDay}`);
                }
                
                return matches;
            } catch (e) {
                console.error('날짜 파싱 오류:', b, e);
                return false;
            }
        });
        
        // 디버깅: 예약이 있는 날짜 로그
        if (dayBookings.length > 0) {
            console.log(`날짜 ${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}에 ${dayBookings.length}개 예약 발견:`, dayBookings);
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
        
        // 예약이 있으면 배경 음영 적용 (기본 색상만)
        if (dayBookings.length > 0) {
            dayCell.style.backgroundColor = 'rgba(94, 106, 210, 0.1)';
        }
        
        // 각 예약을 시간대별로 표시
        dayBookings.forEach(booking => {
            try {
                const event = document.createElement('div');
                event.className = 'calendar-event';
                
                // 시간 추출
                const startTime = new Date(booking.startTime);
                const endTime = new Date(booking.endTime);
                const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                
                // 이름 추출
                const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
                
                // 지점 색상 적용 (시설의 지점 정보 사용)
                let eventColor = '#5E6AD2'; // 기본 색상
                if (booking.facility && booking.facility.branch) {
                    const branchColor = getBranchColor(booking.facility.branch);
                    if (branchColor) {
                        eventColor = branchColor;
                        console.log(`[대관 예약 색상] 예약 ID: ${booking.id}, 지점: ${booking.facility.branch}, 색상: ${branchColor}`);
                    }
                } else {
                    console.warn(`[대관 예약 색상] 예약 ID: ${booking.id}, 시설 정보 없음 또는 지점 정보 없음`, booking.facility);
                }
                
                event.style.backgroundColor = eventColor;
                event.style.borderLeft = `3px solid ${eventColor}`;
                
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
                console.error('예약 표시 오류:', booking, error);
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
                await copyBookingToDate(sourceBookingId, sourceBooking, cellDateStr);
            } catch (error) {
                console.error('예약 복사 실패:', error);
                App.showNotification('예약 복사에 실패했습니다.', 'danger');
            }
        });
        
        dayCell.onclick = (e) => {
            // 아이콘 클릭이 아닐 때만 빠른 예약 모달 열기
            if (!e.target.classList.contains('day-schedule-icon') && 
                !e.target.closest('.day-schedule-icon') &&
                !e.target.classList.contains('calendar-event')) {
                // 고정된 날짜 값 사용 (클로저 문제 해결)
                console.log('캘린더 날짜 클릭:', cellDateStr, '년:', cellYear, '월:', cellMonth + 1, '일:', cellDay);
                openQuickBookingModal(cellDateStr);
            }
        };
        
        grid.appendChild(dayCell);
        current.setDate(current.getDate() + 1);
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
        
        const bookings = await App.api.get(`/bookings?start=${startISO}&end=${endISO}&branch=RENTAL`);
        
        // 코치 목록 로드 (필터용)
        const coaches = await App.api.get('/coaches');
        const coachSelect = document.getElementById('schedule-filter-coach');
        coachSelect.innerHTML = '<option value="">전체 코치</option>';
        coaches.forEach(coach => {
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
        console.error('스케줄 로드 실패:', error);
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
        if (!booking.startTime) {
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            console.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
        }
        
        // 날짜 포맷팅 (체크인 미처리 현황과 동일한 형식)
        const dateStr = App.formatDate ? App.formatDate(booking.startTime) : startTime.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\./g, '.').replace(/\s/g, ' ');
        
        // 시간 포맷팅 (HH:mm 형식)
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 시설 이름
        const facilityName = booking.facility?.name || booking.facilityName || '-';
        
        // 회원 이름
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || booking.memberName || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 상태
        const status = booking.status || 'PENDING';
        const statusBadge = App.Status.booking.getBadge(status);
        const statusText = App.Status.booking.getText(status);
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${facilityName}</td>
                <td>${memberName}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                <td>
                    ${status === 'PENDING' ? `<button class="btn btn-xs btn-success ml-2" onclick="approveBooking(${booking.id})" title="확인">✓</button>` : ''}
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
        
        // page 파라미터 제거 (백엔드에서 처리하지 않음)
        const bookings = await App.api.get(`/bookings?branch=RENTAL`);
        console.log('예약 목록 조회 결과:', bookings?.length || 0, '건');
        renderBookingsTable(bookings);
    } catch (error) {
        console.error('예약 목록 로드 실패:', error);
    }
}

function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            console.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
        }
        
        // 날짜 포맷팅 (체크인 미처리 현황과 동일한 형식)
        const dateStr = App.formatDate ? App.formatDate(booking.startTime) : startTime.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\./g, '.').replace(/\s/g, ' ');
        
        // 시간 포맷팅 (HH:mm 형식)
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 시설 이름
        const facilityName = booking.facility?.name || booking.facilityName || '-';
        
        // 회원 이름
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || booking.memberName || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 상태
        const status = booking.status || 'PENDING';
        
        return `
        <tr>
            <td>${dateStr}</td>
            <td>${timeStr}</td>
            <td>${facilityName}</td>
            <td>${memberName}</td>
            <td>${booking.participants || 1}명</td>
            <td>
                <span class="badge badge-${getStatusBadge(status)}">${getStatusText(status)}</span>
                ${status === 'PENDING' ? `<button class="btn btn-xs btn-success ml-2" onclick="approveBooking(${booking.id})" title="확인">✓</button>` : ''}
            </td>
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
    console.log('회원 선택 모달 열기 - selectedBookingDate 설정:', selectedBookingDate, '입력된 date:', date);
    
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

// 회원 목록 로드
async function loadMembersForSelect() {
    try {
        const members = await App.api.get('/members');
        renderMemberSelectTable(members);
    } catch (error) {
        console.error('회원 목록 로드 실패:', error);
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
        const memberNumber = member.memberNumber || '-';
        return `
            <tr style="cursor: pointer;" onclick="selectMemberForBooking('${memberNumber}', '${member.name}', '${member.phoneNumber || ''}')">
                <td>${member.name}</td>
                <td>${memberNumber}</td>
                <td>${member.phoneNumber || '-'}</td>
                <td><span class="badge badge-info">${gradeText}</span></td>
                <td>${member.school || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectMemberForBooking('${memberNumber}', '${member.name}', '${member.phoneNumber || ''}')">선택</button>
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
    console.log('회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
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
        document.getElementById('booking-modal-title').textContent = '대관 등록';
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
        const coachSelect = document.getElementById('booking-coach');
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
        console.log('회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
        
        setFieldValue('booking-facility', '');
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
            console.log('예약 날짜 설정 완료:', dateToSet);
        }
        
        // 회원의 상품/이용권 목록 로드
        await loadMemberProducts(member.id);
        
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
        
        // 결제 방식 초기화
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        if (paymentMethodSelect) {
            paymentMethodSelect.value = '';
        }
        
        // 코치 정보 저장 및 미리 로드 (모달 열기 전에)
        const coachIdToSet = member.coach ? (member.coach.id || member.coach) : null;
        let coachInfo = member.coach;
        
        // 코치 상세 정보 미리 가져오기 (필요한 경우)
        if (coachIdToSet && (!coachInfo.name || !coachInfo.specialties)) {
            try {
                coachInfo = await App.api.get(`/coaches/${coachIdToSet}`);
            } catch (error) {
                console.error('코치 정보 로드 실패:', error);
            }
        }
        
        // 코치 설정 함수 (모달 열기 전에 준비)
        const setCoachAndLessonCategory = async () => {
            if (!coachIdToSet) return;
            
            // 메인 폼의 코치 필드 찾기 (coach-group 내부)
            const coachGroup = document.getElementById('coach-group');
            if (!coachGroup) {
                console.error('❌ coach-group을 찾을 수 없습니다.');
                return;
            }
            
            const coachSelectEl = coachGroup.querySelector('#booking-coach');
            if (!coachSelectEl) {
                console.error('❌ 코치 선택 필드를 찾을 수 없습니다.');
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
                console.error('❌ 코치 옵션을 찾을 수 없습니다. 코치 ID:', coachIdToSet);
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
                console.log('✅ 코치 설정 완료:', coachOption.textContent);
                
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
                console.warn('⚠️ 코치 설정 확인 실패, 재시도...');
                // 재시도
                coachSelectEl.selectedIndex = optionIndex;
                coachSelectEl.value = coachOption.value;
                coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        
        // 모달을 먼저 열기
        App.Modal.open('booking-modal');
        
        // 모달이 완전히 열린 후 코치 설정
        if (coachIdToSet) {
            // 여러 방법으로 시도
            requestAnimationFrame(() => {
                requestAnimationFrame(async () => {
                    await setCoachAndLessonCategory();
                });
            });
            
            setTimeout(async () => {
                const coachGroup = document.getElementById('coach-group');
                if (coachGroup) {
                    const coachSelectEl = coachGroup.querySelector('#booking-coach');
                    if (coachSelectEl && (!coachSelectEl.value || coachSelectEl.value === '')) {
                        await setCoachAndLessonCategory();
                    }
                }
            }, 300);
        }
    } catch (error) {
        console.error('회원 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 비회원 예약 모달 열기
function openNonMemberBookingModal() {
    App.Modal.close('member-select-modal');
    selectNonMember();
}

// 비회원 선택
function selectNonMember() {
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    console.log('비회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 예약 모달 열기
    document.getElementById('booking-modal-title').textContent = '대관 등록';
    document.getElementById('selected-member-id').value = '';
    document.getElementById('selected-member-number').value = '';
    
    // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
    document.getElementById('booking-id').value = '';
    console.log('비회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
    
    // 폼 리셋 (날짜 필드는 제외)
    const bookingForm = document.getElementById('booking-form');
    bookingForm.reset();
    
    // reset 후 날짜 필드에 선택한 날짜 설정 (약간의 지연을 두어 확실히 설정)
    setTimeout(() => {
        document.getElementById('booking-date').value = dateToSet;
        console.log('예약 날짜 설정 완료 (비회원):', dateToSet);
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
    
    App.Modal.open('booking-modal');
}

// 회원 변경
function changeMember() {
    // 회원 선택 모달 열기
    openMemberSelectModal(selectedBookingDate || document.getElementById('booking-date').value);
}

// 빠른 예약 모달 열기 (날짜 클릭 시)
async function openQuickBookingModal(dateStr) {
    selectedBookingDate = dateStr;
    console.log('빠른 예약 모달 열기:', dateStr);
    
    // 날짜 포맷팅
    const date = new Date(dateStr + 'T00:00:00');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const formattedDate = `${year}년 ${month}월 ${day}일`;
    
    document.getElementById('quick-booking-title').textContent = `대관 등록 - ${formattedDate}`;
    
        // 폼 초기화
        document.getElementById('quick-booking-form').reset();
        document.getElementById('quick-booking-date').value = dateStr;
        
        // 수정 모드가 아님을 표시
        const quickBookingId = document.getElementById('quick-booking-id');
        if (quickBookingId) {
            quickBookingId.value = '';
        }
        
        // 삭제 버튼 숨기기 (신규 등록 모드)
        const quickDeleteBtn = document.getElementById('quick-booking-delete-btn');
        if (quickDeleteBtn) {
            quickDeleteBtn.style.display = 'none';
        }
        
        // 시설 목록 로드
        try {
            await loadFacilities();
            // 시설 목록을 quick-facility에도 복사
            const facilitySelect = document.getElementById('booking-facility');
            const quickFacilitySelect = document.getElementById('quick-facility');
            if (facilitySelect && quickFacilitySelect) {
                quickFacilitySelect.innerHTML = facilitySelect.innerHTML;
            }
        } catch (error) {
            console.error('시설 목록 로드 실패:', error);
        }
        
        App.Modal.open('quick-booking-modal');
}

// 빠른 예약 모달로 수정 모드 열기
async function openQuickBookingModalForEdit(id) {
    try {
        console.log('빠른 예약 모달로 수정 모드 열기:', id);
        
        // 예약 데이터 가져오기
        const booking = await App.api.get(`/bookings/${id}`);
        
        // 날짜 포맷팅
        const startDate = new Date(booking.startTime);
        const dateStr = startDate.toISOString().split('T')[0];
        const year = startDate.getFullYear();
        const month = startDate.getMonth() + 1;
        const day = startDate.getDate();
        const formattedDate = `${year}년 ${month}월 ${day}일`;
        
        document.getElementById('quick-booking-title').textContent = `빠른 예약 수정 - ${formattedDate}`;
        
        // 예약 ID 저장
        const quickBookingId = document.getElementById('quick-booking-id');
        if (quickBookingId) {
            quickBookingId.value = id;
        }
        
        // 삭제 버튼 표시 (수정 모드)
        const quickDeleteBtn = document.getElementById('quick-booking-delete-btn');
        if (quickDeleteBtn) {
            quickDeleteBtn.style.display = 'block';
            quickDeleteBtn.setAttribute('data-booking-id', id);
        }
        
        // 시설 목록 로드
        await loadFacilities();
        const facilitySelect = document.getElementById('booking-facility');
        const quickFacilitySelect = document.getElementById('quick-facility');
        if (facilitySelect && quickFacilitySelect) {
            quickFacilitySelect.innerHTML = facilitySelect.innerHTML;
        }
        
        // 시설 목록이 로드될 때까지 대기
        let attempts = 0;
        while (quickFacilitySelect && quickFacilitySelect.options.length <= 1 && attempts < 40) {
            await new Promise(resolve => setTimeout(resolve, 50));
            attempts++;
        }
        
        // 데이터 채우기
        document.getElementById('quick-booking-date').value = dateStr;
        document.getElementById('quick-name').value = booking.nonMemberName || '';
        document.getElementById('quick-phone').value = booking.nonMemberPhone || '';
        document.getElementById('quick-start-time').value = startDate.toTimeString().slice(0, 5);
        
        const endDate = new Date(booking.endTime);
        document.getElementById('quick-end-time').value = endDate.toTimeString().slice(0, 5);
        
        if (booking.facility && booking.facility.id) {
            quickFacilitySelect.value = booking.facility.id;
            // 값이 제대로 설정되었는지 확인
            if (quickFacilitySelect.value !== String(booking.facility.id)) {
                await new Promise(resolve => setTimeout(resolve, 100));
                quickFacilitySelect.value = booking.facility.id;
            }
        }
        
        // 메모에서 [복사] 접두사 제거 (UI에만 표시, DB에는 원본 유지)
        let memoValue = booking.memo || '';
        if (memoValue) {
            // [복사] 접두사 제거 (여러 개일 수 있음)
            memoValue = memoValue.replace(/^\[복사\]\s*/g, '').trim();
        }
        document.getElementById('quick-memo').value = memoValue;
        
        App.Modal.open('quick-booking-modal');
        
        console.log('[빠른 예약 수정] 데이터 로드 완료:', {
            name: booking.nonMemberName,
            phone: booking.nonMemberPhone,
            dateStr,
            startTime: startDate.toTimeString().slice(0, 5),
            endTime: endDate.toTimeString().slice(0, 5),
            facilityId: booking.facility?.id,
            memo: booking.memo
        });
    } catch (error) {
        console.error('빠른 예약 모달로 수정 모드 열기 실패:', error);
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 빠른 예약 저장
async function saveQuickBooking() {
    const bookingId = document.getElementById('quick-booking-id')?.value;
    const isEditMode = bookingId && bookingId.trim() !== '';
    
    const name = document.getElementById('quick-name').value.trim();
    const startTime = document.getElementById('quick-start-time').value;
    const endTime = document.getElementById('quick-end-time').value;
    const facilityId = document.getElementById('quick-facility').value;
    const phone = document.getElementById('quick-phone').value.trim();
    const memo = document.getElementById('quick-memo').value.trim();
    const dateStr = document.getElementById('quick-booking-date').value;
    
    // 필수 필드 검증
    if (!name) {
        App.showNotification('이름을 입력해주세요.', 'danger');
        return;
    }
    if (!startTime || !endTime) {
        App.showNotification('시작/종료 시간을 입력해주세요.', 'danger');
        return;
    }
    if (!facilityId) {
        App.showNotification('시설을 선택해주세요.', 'danger');
        return;
    }
    
    // 시간 검증
    if (startTime >= endTime) {
        App.showNotification('종료 시간은 시작 시간보다 늦어야 합니다.', 'danger');
        return;
    }
    
    // 날짜와 시간 결합
    const startDateTime = `${dateStr}T${startTime}:00`;
    const endDateTime = `${dateStr}T${endTime}:00`;
    
    // 예약 데이터 생성 (비회원 대관 예약)
    const data = {
        facility: { id: parseInt(facilityId) },
        nonMemberName: name,
        nonMemberPhone: phone || null,
        startTime: startDateTime,
        endTime: endDateTime,
        participants: 1,
        purpose: 'RENTAL', // 대관으로 고정
        branch: 'RENTAL', // 대관 관리 전용 지점 코드
        status: isEditMode ? undefined : 'PENDING', // 수정 모드면 기존 상태 유지, 새 예약은 항상 PENDING
        paymentMethod: 'ON_SITE', // 현장 결제
        memo: memo ? memo.trim() : null
    };
    
    console.log('빠른 예약 저장:', isEditMode ? '(수정 모드)' : '(신규)', data);
    
    try {
        if (isEditMode) {
            // 수정 모드
            await App.api.put(`/bookings/${bookingId}`, data);
            App.showNotification('대관이 수정되었습니다.', 'success');
        } else {
            // 신규 등록
            await App.api.post('/bookings', data);
            App.showNotification('대관이 등록되었습니다.', 'success');
        }
        
        App.Modal.close('quick-booking-modal');
        
        // 캘린더 새로고침
        await renderCalendar();
    } catch (error) {
        console.error('빠른 예약 저장 실패:', error);
        App.showNotification(isEditMode ? '대관 수정에 실패했습니다.' : '대관 등록에 실패했습니다.', 'danger');
    }
}

// 상세 입력 모달로 전환
async function openDetailBookingModal() {
    // 빠른 예약 모달 데이터 가져오기
    const name = document.getElementById('quick-name').value.trim();
    const startTime = document.getElementById('quick-start-time').value;
    const endTime = document.getElementById('quick-end-time').value;
    const facilityId = document.getElementById('quick-facility').value;
    const phone = document.getElementById('quick-phone').value.trim();
    const memo = document.getElementById('quick-memo').value.trim();
    const dateStr = document.getElementById('quick-booking-date').value;
    
    // 빠른 예약 모달 닫기
    App.Modal.close('quick-booking-modal');
    
    // 기존 예약 모달 열기
    selectedBookingDate = dateStr;
    openBookingModal(null);
    
    // 모달이 열릴 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 시설 목록 로드 대기
    await loadFacilities();
    
    // 시설 목록이 로드될 때까지 대기
    let attempts = 0;
    const facilitySelect = document.getElementById('booking-facility');
    while (facilitySelect && facilitySelect.options.length <= 1 && attempts < 40) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
    }
    
    // 비회원 섹션 활성화
    if (name) {
        selectNonMember();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 입력된 데이터 설정
    if (name) {
        document.getElementById('booking-non-member-name').value = name;
    }
    if (phone) {
        document.getElementById('booking-phone').value = phone;
    }
    if (dateStr) {
        document.getElementById('booking-date').value = dateStr;
    }
    if (startTime) {
        document.getElementById('booking-start-time').value = startTime;
    }
    if (endTime) {
        document.getElementById('booking-end-time').value = endTime;
    }
    if (memo) {
        document.getElementById('booking-notes').value = memo;
    }
    
    // 시설 설정 (목록이 로드된 후)
    if (facilityId && facilitySelect) {
        facilitySelect.value = facilityId;
        // 값이 제대로 설정되었는지 확인
        if (facilitySelect.value !== facilityId) {
            await new Promise(resolve => setTimeout(resolve, 100));
            facilitySelect.value = facilityId;
        }
    }
    
    // 목적 설정
    const purposeSelect = document.getElementById('booking-purpose');
    if (purposeSelect) {
        purposeSelect.value = 'RENTAL';
        purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
        purposeSelect.style.display = 'block';
    }
    
    // 레슨 카테고리 필드 숨김 (대관이므로)
    toggleLessonCategory();
    
    console.log('[상세 입력] 빠른 예약 데이터 전달 완료:', {
        name, phone, dateStr, startTime, endTime, facilityId, memo
    });
}

// 날짜 클릭으로 예약 모달 열기 (기존 함수 - 예약 등록 버튼용)
function openBookingModalFromDate(dateStr) {
    selectedBookingDate = dateStr;
    console.log('날짜 클릭으로 예약 모달 열기:', dateStr);
    openBookingModal(null);
}

function openBookingModal(id = null) {
    const modal = document.getElementById('booking-modal');
    const title = document.getElementById('booking-modal-title');
    const deleteBtn = document.getElementById('booking-delete-btn');
    const form = document.getElementById('booking-form');
    
    if (id) {
        // 대관 수정 모달
        title.textContent = '대관 수정';
        
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
        // 목적 필드를 "대관"으로 고정 (수정 시에도)
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.value = 'RENTAL';
            purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
            purposeSelect.style.display = 'block';
        }
        
        // 모달 먼저 열기
        App.Modal.open('booking-modal');
        
        // 모달이 열린 후 예약 데이터 로드
        setTimeout(() => {
            loadBookingData(id);
        }, 100);
    } else {
        // 대관 등록 모달
        title.textContent = '대관 등록';
        
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
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지) - reset 전에
        const bookingIdElement = document.getElementById('booking-id');
        if (bookingIdElement) {
            bookingIdElement.value = '';
        }
        
        // 상태 필드를 먼저 PENDING으로 초기화 (reset 전에)
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.value = 'PENDING';
            console.log('[예약 모달] reset 전 상태 필드 PENDING으로 설정');
        }
        
        form.reset();
        
        // reset 후 필수 값들 다시 설정
        if (bookingIdElement) {
            bookingIdElement.value = '';
        }
        document.getElementById('selected-member-id').value = '';
        document.getElementById('selected-member-number').value = '';
        document.getElementById('booking-date').value = selectedBookingDate || new Date().toISOString().split('T')[0];
        console.log('[예약 모달] 예약 등록 모달 - booking-id 초기화 완료');
        
        // 목적 필드를 "대관"으로 고정
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.value = 'RENTAL';
            purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
            purposeSelect.style.display = 'block';
        }
        
        // 레슨 카테고리 필드 초기화 (대관이므로 숨김)
        toggleLessonCategory();
        
        // 모든 섹션 초기화 (대관용)
        document.getElementById('member-info-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        
        // 대관용 필드 초기화
        const renterNameInput = document.getElementById('booking-renter-name');
        const renterPhoneInput = document.getElementById('booking-renter-phone');
        if (renterNameInput) renterNameInput.value = '';
        if (renterPhoneInput) renterPhoneInput.value = '';
        
        // 상태 필드 활성화 및 PENDING으로 명시적 설정 (reset 후 다시 설정)
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING'; // 새 예약은 항상 PENDING으로 시작
            console.log('[예약 모달] reset 후 상태 필드 PENDING으로 재설정, 현재 값:', statusSelect.value);
            
            // 추가 확인: 만약 여전히 다른 값이면 강제로 PENDING 설정
            if (statusSelect.value !== 'PENDING') {
                console.warn('[예약 모달] 상태 필드가 PENDING이 아님, 강제로 PENDING 설정');
                statusSelect.value = 'PENDING';
            }
        }
    }
    
    App.Modal.open('booking-modal');
    
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
        // 시설 선택 필드 확인
        const facilitySelect = document.getElementById('booking-facility');
        if (!facilitySelect) {
            console.error('[예약 수정] 시설 선택 필드를 찾을 수 없습니다.');
            // 필드가 없으면 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 200));
            const retrySelect = document.getElementById('booking-facility');
            if (!retrySelect) {
                App.showNotification('시설 선택 필드를 찾을 수 없습니다.', 'danger');
                return;
            }
        }
        
        // 시설 목록 먼저 로드 (시설 드롭다운이 비어있을 수 있으므로)
        await loadFacilities();
        
        const booking = await App.api.get(`/bookings/${id}`);
        // 폼에 데이터 채우기
        document.getElementById('booking-id').value = booking.id;
        
        // 시설 선택 필드에 값 설정
        const facilitySelectAfter = document.getElementById('booking-facility');
        if (facilitySelectAfter) {
            // 시설 목록이 로드될 때까지 대기 (최대 2초)
            let attempts = 0;
            while (facilitySelectAfter.options.length <= 1 && attempts < 40) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
            
            // 시설 목록이 여전히 없으면 다시 로드 시도
            if (facilitySelectAfter.options.length <= 1) {
                console.warn('[예약 수정] 시설 목록이 비어있어 재로드 시도');
                await loadFacilities();
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            if (booking.facility && booking.facility.id) {
                facilitySelectAfter.value = booking.facility.id;
                console.log('[예약 수정] 시설 설정:', booking.facility.id, booking.facility.name);
                
                // 값이 제대로 설정되었는지 확인
                if (facilitySelectAfter.value !== String(booking.facility.id)) {
                    console.warn('[예약 수정] 시설 값 설정 실패, 재시도');
                    await new Promise(resolve => setTimeout(resolve, 100));
                    facilitySelectAfter.value = booking.facility.id;
                }
            } else {
                facilitySelectAfter.value = '';
                console.warn('[예약 수정] 시설 정보 없음');
            }
        } else {
            console.error('[예약 수정] 시설 선택 필드를 찾을 수 없습니다.');
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
            
            // 회원의 상품 목록 로드 (비동기로 완료 대기)
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
            
            // 비회원 코치 목록 로드
            if (document.getElementById('booking-coach-nonmember') && document.getElementById('booking-coach-nonmember').options.length <= 1) {
                await loadCoachesForBookingNonMember();
            }
            
            // 비회원 코치 선택 설정
            const coachSelectNonMember = document.getElementById('booking-coach-nonmember');
            if (coachSelectNonMember && booking.coach && booking.coach.id) {
                coachSelectNonMember.value = booking.coach.id;
            }
        }
        
        const startDate = new Date(booking.startTime);
        document.getElementById('booking-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('booking-start-time').value = startDate.toTimeString().slice(0, 5);
        
        const endDate = new Date(booking.endTime);
        document.getElementById('booking-end-time').value = endDate.toTimeString().slice(0, 5);
        
        document.getElementById('booking-participants').value = booking.participants || 1;
        // 목적을 항상 "대관"으로 고정
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.value = 'RENTAL';
            purposeSelect.disabled = true; // 변경 불가능하도록 비활성화
        }
        // 목적 변경 시 레슨 카테고리 필드 표시/숨김 처리
        toggleLessonCategory();
        // 레슨 카테고리 설정
        if (booking.lessonCategory) {
            const lessonCategoryEl = document.getElementById('booking-lesson-category');
            if (lessonCategoryEl) {
                lessonCategoryEl.value = booking.lessonCategory;
            }
        }
        document.getElementById('booking-status').value = booking.status || 'PENDING';
        document.getElementById('booking-payment-method').value = booking.paymentMethod || '';
        const memoValue = booking.memo || '';
        
        // 메모에서 [복사] 접두사 제거 (UI에만 표시, DB에는 원본 유지)
        let displayMemo = memoValue;
        if (displayMemo) {
            // [복사] 접두사 제거 (여러 개일 수 있음)
            displayMemo = displayMemo.replace(/^\[복사\]\s*/g, '').trim();
        }
        document.getElementById('booking-notes').value = displayMemo;
        
        // 메모에 "[복사]" 접두사가 있으면 복사된 메모로 표시 (복사 기능용)
        if (memoValue && memoValue.startsWith('[복사]')) {
            const copiedContent = memoValue.replace(/^\[복사\]\s*/, '');
            if (copiedContent) {
                copiedMemo = copiedContent;
                localStorage.setItem('copiedMemo', copiedContent);
                showCopiedMemo(copiedContent);
            }
        }
        
        // MemberProduct 정보 설정 (있는 경우)
        // loadMemberProducts가 완료된 후에 설정
        if (booking.memberProduct && booking.memberProduct.id && booking.member) {
            // 회원의 상품 목록이 로드될 때까지 대기
            let attempts = 0;
            const select = document.getElementById('booking-member-product');
            while (select && (select.options.length <= 1 || !Array.from(select.options).some(opt => opt.value === String(booking.memberProduct.id))) && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            // 상품 선택 설정
            if (select) {
                const memberProductOption = Array.from(select.options).find(opt => opt.value === String(booking.memberProduct.id));
                if (memberProductOption) {
                    select.value = booking.memberProduct.id;
                    console.log('[예약 수정] 상품 설정:', booking.memberProduct.id);
                    
                    // 상품 정보 표시
                    const productInfo = document.getElementById('product-info');
                    const productInfoText = document.getElementById('product-info-text');
                    if (productInfo && productInfoText) {
                        const productType = memberProductOption.dataset.productType;
                        const remainingCount = parseInt(memberProductOption.dataset.remainingCount) || 0;
                        
                        if (productType === 'COUNT_PASS') {
                            productInfoText.textContent = `횟수권 사용: 잔여 ${remainingCount}회`;
                            productInfo.style.display = 'block';
                        } else {
                            productInfoText.textContent = '상품 사용 예정';
                            productInfo.style.display = 'block';
                        }
                    }
                    
                    // 상품 선택 이벤트 발생 (결제 방식 자동 설정 등)
                    select.dispatchEvent(new Event('change'));
                } else {
                    console.warn('[예약 수정] 상품을 찾을 수 없음:', booking.memberProduct.id);
                }
            }
        }
        
        // 코치 선택 필드 설정 (비회원 예약 시에도 사용)
        if (document.getElementById('booking-coach')) {
            document.getElementById('booking-coach').value = booking.coach?.id || '';
        }
    } catch (error) {
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

function editBooking(id) {
    // 빠른 예약 모달로 수정
    openQuickBookingModalForEdit(id);
}

async function saveBooking() {
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start-time').value;
    const endTime = document.getElementById('booking-end-time').value;
    
    // 날짜 검증
    if (!date || date.trim() === '') {
        console.warn('[saveBooking] 날짜가 없음');
        App.showNotification('날짜를 선택해주세요.', 'danger');
        return;
    }
    
    // 시작 시간 검증
    if (!startTime || startTime.trim() === '') {
        console.warn('[saveBooking] 시작 시간이 없음');
        App.showNotification('시작 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 종료 시간 검증
    if (!endTime || endTime.trim() === '') {
        console.warn('[saveBooking] 종료 시간이 없음');
        App.showNotification('종료 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 시작 시간과 종료 시간 비교
    if (startTime && endTime && startTime >= endTime) {
        App.showNotification('종료 시간은 시작 시간보다 늦어야 합니다.', 'danger');
        return;
    }
    const facilityId = document.getElementById('booking-facility').value;
    const memberNumber = document.getElementById('selected-member-number').value; // MEMBER_NUMBER 사용
    const memberId = document.getElementById('selected-member-id').value; // 하위 호환성
    
    // 대관 페이지용: 예약자 정보 (우선순위: renterName > nonMemberName)
    const renterName = document.getElementById('booking-renter-name')?.value?.trim() || '';
    const renterPhone = document.getElementById('booking-renter-phone')?.value?.trim() || '';
    const nonMemberName = renterName || document.getElementById('booking-non-member-name')?.value?.trim() || '';
    const nonMemberPhone = renterPhone || document.getElementById('booking-phone')?.value?.trim() || '';
    const coachIdElement = document.getElementById('booking-coach');
    const coachId = coachIdElement ? coachIdElement.value : '';
    const participants = document.getElementById('booking-participants').value;
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryElement = document.getElementById('booking-lesson-category');
    const lessonCategory = lessonCategoryElement ? lessonCategoryElement.value : null;
    const paymentMethod = document.getElementById('booking-payment-method').value;
    const memo = document.getElementById('booking-notes').value.trim();
    const memberProductId = document.getElementById('booking-member-product')?.value || null;
    
    // 필수 필드 검증
    if (!date || !startTime || !endTime || !facilityId) {
        App.showNotification('필수 항목(날짜, 시간, 시설)을 모두 입력해주세요.', 'danger');
        return;
    }
    
    if (!purpose) {
        App.showNotification('목적을 선택해주세요.', 'danger');
        return;
    }
    
    // 레슨인 경우 레슨 카테고리 필수
    if (purpose === 'LESSON') {
        const lessonCategory = document.getElementById('booking-lesson-category')?.value;
        if (!lessonCategory) {
            App.showNotification('레슨인 경우 레슨 종목을 선택해주세요.', 'danger');
            return;
        }
    }
    
    // 대관 페이지용: 예약자 정보 검증
    // 대관은 예약자 이름 필수 (회원이 선택되지 않은 경우)
    if (!memberNumber && !memberId && !nonMemberName) {
        App.showNotification('예약자 이름을 입력해주세요.', 'danger');
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
    
    // 날짜와 시간 결합 (ISO 8601 형식)
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;
    
    // 디버깅: 시간 값 확인
    console.log('예약 시간 확인:', {
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
        console.log('[예약 저장] 수정 모드 - 상태 유지:', bookingStatus);
    } else {
        // 새 예약: 항상 PENDING으로 설정
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        console.log('[예약 저장] 새 예약 - 상태 PENDING으로 설정');
    }
    
    // 최종 상태 확인 및 강제 설정 (새 예약인 경우)
    if (isNewBooking) {
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        console.log('[예약 저장] 최종 확인 - 새 예약이므로 PENDING으로 강제 설정');
    }
    
    // 추가 안전장치: statusSelect의 실제 값을 다시 확인
    if (statusSelect && statusSelect.value !== bookingStatus) {
        console.warn('[예약 저장] 상태 불일치 감지! statusSelect.value:', statusSelect.value, 'bookingStatus:', bookingStatus);
        bookingStatus = 'PENDING'; // 새 예약은 무조건 PENDING
        statusSelect.value = 'PENDING';
    }
    
    console.log('[예약 저장] 최종 상태:', {
        bookingId: bookingId,
        isNewBooking: isNewBooking,
        bookingStatus: bookingStatus,
        statusSelectValue: statusSelect ? statusSelect.value : 'N/A'
    });
    
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
        status: bookingStatus, // 새 예약은 항상 PENDING
        branch: 'RENTAL', // 대관 관리 전용 지점 코드
        // paymentMethod 값 변환 (프론트엔드 -> 백엔드 enum 형식)
        paymentMethod: paymentMethod ? (paymentMethod === 'ONSITE' ? 'ON_SITE' : (paymentMethod === 'DEFERRED' ? 'POSTPAID' : paymentMethod)) : null,
        memo: memo ? memo.trim() : null // 빈 문자열도 null로 변환하여 명시적으로 삭제
    };
    
    console.log('예약 저장 데이터:', JSON.stringify(data, null, 2));
    
    try {
        const id = document.getElementById('booking-id').value;
        let savedBooking;
        if (id) {
            savedBooking = await App.api.put(`/bookings/${id}`, data);
            App.showNotification('대관이 수정되었습니다.', 'success');
        } else {
            savedBooking = await App.api.post('/bookings', data);
            console.log('예약 저장 성공:', savedBooking);
            
            // 반복 예약 처리
            const repeatEnabled = document.getElementById('booking-repeat-enabled').checked;
            if (repeatEnabled) {
                const repeatType = document.getElementById('booking-repeat-type').value;
                const repeatCount = parseInt(document.getElementById('booking-repeat-count').value) || 1;
                
                await createRepeatBookings(data, repeatType, repeatCount);
                App.showNotification(`대관이 등록되었습니다 (반복 ${repeatCount}회 포함).`, 'success');
            } else {
                App.showNotification('대관이 등록되었습니다.', 'success');
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
                        console.log(`예약 날짜로 캘린더 이동: ${bookingYear}년 ${bookingMonth + 1}월`);
                    }
                } catch (e) {
                    console.error('예약 날짜 파싱 오류:', savedBooking.startTime, e);
                }
            }
            console.log('캘린더 새로고침 시작...');
            await renderCalendar();
        }
    } catch (error) {
        console.error('예약 저장 실패:', error);
        App.showNotification('저장에 실패했습니다. 필수 정보를 확인해주세요.', 'danger');
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
            endTime: `${dateStr}T${endTime}`,
            status: 'PENDING' // 반복 예약도 새 예약이므로 대기 상태로 시작
        };
        
        try {
            await App.api.post('/bookings', repeatData);
            successCount++;
        } catch (error) {
            console.error(`반복 예약 생성 실패 (${i}회차):`, error);
            failCount++;
        }
    }
    
    console.log(`반복 예약 생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

// 예약 확인 (승인) - 대관 예약을 CONFIRMED 상태로 변경
async function approveBooking(id) {
    if (!confirm('이 대관 예약을 확인하시겠습니까?\n\n확인 후 체크인 미처리 현황에 표시됩니다.')) {
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
        App.showNotification('대관 예약이 확인되었습니다. 체크인 미처리 현황에 표시됩니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
            // 날짜별 스케줄 모달이 열려있으면 새로고침
            const dayScheduleModal = document.getElementById('day-schedule-modal');
            if (dayScheduleModal && dayScheduleModal.style.display !== 'none') {
                const dateStr = document.getElementById('day-schedule-modal-title')?.textContent;
                if (dateStr) {
                    // 날짜 추출하여 다시 로드
                    const dateMatch = dateStr.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
                    if (dateMatch) {
                        const year = dateMatch[1];
                        const month = String(dateMatch[2]).padStart(2, '0');
                        const day = String(dateMatch[3]).padStart(2, '0');
                        const dateStrForReload = `${year}-${month}-${day}`;
                        await openDayScheduleModal(dateStrForReload);
                    }
                }
            }
        }
    } catch (error) {
        console.error('예약 확인 실패:', error);
        App.showNotification('확인에 실패했습니다.', 'danger');
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
        console.error('예약 삭제 실패:', error);
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

// 빠른 예약 모달에서 삭제
async function deleteQuickBooking() {
    const quickBookingId = document.getElementById('quick-booking-id')?.value;
    if (!quickBookingId || quickBookingId.trim() === '') {
        App.showNotification('삭제할 예약을 찾을 수 없습니다.', 'danger');
        return;
    }
    
    if (confirm('정말 이 예약을 삭제하시겠습니까?')) {
        await deleteBooking(parseInt(quickBookingId));
        // 삭제 후 모달 닫기
        App.Modal.close('quick-booking-modal');
    }
}

// 예약을 다른 날짜로 복사
async function copyBookingToDate(sourceBookingId, sourceBooking, targetDateStr) {
    try {
        // 원본 예약 데이터 로드
        const booking = await App.api.get(`/bookings/${sourceBookingId}`);
        
        // 새 날짜로 시간 계산
        const targetDate = new Date(targetDateStr + 'T00:00:00');
        const originalStartTime = new Date(booking.startTime);
        const originalEndTime = new Date(booking.endTime);
        
        // 시간 부분 유지
        const hours = originalStartTime.getHours();
        const minutes = originalStartTime.getMinutes();
        const duration = originalEndTime.getTime() - originalStartTime.getTime();
        
        // 새 날짜에 시간 적용
        const newStartTime = new Date(targetDate);
        newStartTime.setHours(hours, minutes, 0, 0);
        const newEndTime = new Date(newStartTime.getTime() + duration);
        
        // LocalDateTime 형식으로 변환 (YYYY-MM-DDTHH:mm:ss)
        const formatLocalDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        };
        
        // 새 예약 데이터 생성
        const newBooking = {
            facility: booking.facility ? { id: booking.facility.id } : null,
            memberNumber: booking.memberNumber || null, // MEMBER_NUMBER 사용
            member: booking.member ? { id: booking.member.id } : null, // 하위 호환성
            nonMemberName: booking.nonMemberName || null,
            nonMemberPhone: booking.nonMemberPhone || null,
            coach: booking.coach ? { id: booking.coach.id } : null,
            memberProductId: booking.memberProductId || null, // 상품/이용권 ID
            startTime: formatLocalDateTime(newStartTime),
            endTime: formatLocalDateTime(newEndTime),
            participants: booking.participants || 1,
            purpose: booking.purpose,
            lessonCategory: booking.lessonCategory || null,
            branch: 'RENTAL', // 대관 관리 전용 지점 코드
            status: 'PENDING', // 복사된 예약은 대기 상태로
            paymentMethod: booking.paymentMethod || null,
            memo: booking.memo ? `[복사] ${booking.memo}` : '[복사]'
        };
        
        // 디버깅: 전송할 데이터 확인
        console.log('예약 복사 데이터:', JSON.stringify(newBooking, null, 2));
        console.log('원본 예약 데이터:', JSON.stringify(booking, null, 2));
        
        // 새 예약 생성
        const saved = await App.api.post('/bookings', newBooking);
        App.showNotification('예약이 복사되었습니다.', 'success');
        
        // 캘린더 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        console.error('예약 복사 실패:', error);
        App.showNotification('예약 복사에 실패했습니다.', 'danger');
    }
}

// 복사된 메모 저장 (localStorage)
let copiedMemo = null;

// 메모를 클립보드에 복사
function copyMemoToClipboard() {
    const memoTextarea = document.getElementById('booking-notes');
    if (!memoTextarea) return;
    
    const memoText = memoTextarea.value.trim();
    if (!memoText) {
        App.showNotification('복사할 메모가 없습니다.', 'warning');
        return;
    }
    
    // 클립보드에 복사
    navigator.clipboard.writeText(memoText).then(() => {
        // 복사된 메모 저장
        copiedMemo = memoText;
        localStorage.setItem('copiedMemo', memoText);
        
        // 복사된 메모 표시
        showCopiedMemo(memoText);
        
        App.showNotification('메모가 클립보드에 복사되었습니다.', 'success');
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        // 폴백: 수동 복사
        memoTextarea.select();
        document.execCommand('copy');
        copiedMemo = memoText;
        localStorage.setItem('copiedMemo', memoText);
        showCopiedMemo(memoText);
        App.showNotification('메모가 복사되었습니다.', 'success');
    });
}

// 복사된 메모 표시
function showCopiedMemo(memoText) {
    const displayDiv = document.getElementById('copied-memo-display');
    const contentDiv = document.getElementById('copied-memo-content');
    
    if (displayDiv && contentDiv) {
        contentDiv.textContent = memoText;
        displayDiv.style.display = 'block';
    }
}

// 복사된 메모 붙여넣기
function pasteCopiedMemo() {
    const memoTextarea = document.getElementById('booking-notes');
    if (!memoTextarea) return;
    
    if (!copiedMemo) {
        // localStorage에서 가져오기
        copiedMemo = localStorage.getItem('copiedMemo');
    }
    
    if (!copiedMemo) {
        App.showNotification('붙여넣을 메모가 없습니다.', 'warning');
        return;
    }
    
    // 현재 커서 위치에 붙여넣기
    const start = memoTextarea.selectionStart;
    const end = memoTextarea.selectionEnd;
    const currentText = memoTextarea.value;
    const newText = currentText.substring(0, start) + copiedMemo + currentText.substring(end);
    
    memoTextarea.value = newText;
    memoTextarea.focus();
    memoTextarea.setSelectionRange(start + copiedMemo.length, start + copiedMemo.length);
    
    App.showNotification('메모가 붙여넣어졌습니다.', 'success');
}

// 복사된 메모 삭제
function clearCopiedMemo() {
    copiedMemo = null;
    localStorage.removeItem('copiedMemo');
    
    const displayDiv = document.getElementById('copied-memo-display');
    if (displayDiv) {
        displayDiv.style.display = 'none';
    }
    
    App.showNotification('복사된 메모가 삭제되었습니다.', 'info');
}

// 메모 템플릿 관리 모달 열기
function openMemoTemplates() {
    // 간단한 템플릿 관리 (localStorage 사용)
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    
    let templateList = '';
    if (templates.length > 0) {
        templateList = templates.map((template, index) => {
            const escapedContent = (template.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `
            <div style="padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 8px;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">${(template.name || '템플릿 ' + (index + 1)).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div style="font-size: 13px; color: var(--text-primary); white-space: pre-wrap; margin-bottom: 4px; max-height: 100px; overflow-y: auto;">${escapedContent}</div>
                <div style="display: flex; gap: 4px;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="useMemoTemplate(${index})" style="padding: 2px 8px; font-size: 11px;">사용</button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="deleteMemoTemplate(${index})" style="padding: 2px 8px; font-size: 11px;">삭제</button>
                </div>
            </div>
        `;
        }).join('');
    } else {
        templateList = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">저장된 템플릿이 없습니다.</div>';
    }
    
    const modalContent = `
        <div>
            <div style="margin-bottom: 16px;">
                <div class="form-group">
                    <label class="form-label">템플릿 이름</label>
                    <input type="text" class="form-control" id="template-name" placeholder="예: 배팅 연습">
                </div>
                <div class="form-group">
                    <label class="form-label">템플릿 내용</label>
                    <textarea class="form-control" id="template-content" rows="3" placeholder="메모 내용을 입력하세요"></textarea>
                </div>
                <button type="button" class="btn btn-primary" onclick="saveMemoTemplate()">템플릿 저장</button>
            </div>
            <div style="max-height: 300px; overflow-y: auto; border-top: 1px solid var(--border-color); padding-top: 16px;">
                <h4 style="margin-bottom: 12px; font-size: 14px; font-weight: 600;">저장된 템플릿 (${templates.length}개)</h4>
                ${templateList}
            </div>
        </div>
    `;
    
    // 모달 body에 내용 채우기
    const modalBody = document.getElementById('memo-templates-modal-body');
    if (modalBody) {
        modalBody.innerHTML = modalContent;
    }
    
    App.Modal.open('memo-templates-modal');
}

// 메모 템플릿 저장
function saveMemoTemplate() {
    const name = document.getElementById('template-name').value.trim();
    const content = document.getElementById('template-content').value.trim();
    
    if (!name || !content) {
        App.showNotification('템플릿 이름과 내용을 모두 입력해주세요.', 'warning');
        return;
    }
    
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    templates.push({ name, content, createdAt: new Date().toISOString() });
    localStorage.setItem('memoTemplates', JSON.stringify(templates));
    
    App.showNotification('템플릿이 저장되었습니다.', 'success');
    openMemoTemplates(); // 목록 새로고침
}

// 메모 템플릿 사용
function useMemoTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    if (index >= 0 && index < templates.length) {
        const template = templates[index];
        const memoTextarea = document.getElementById('booking-notes');
        if (memoTextarea) {
            memoTextarea.value = template.content;
            App.Modal.close('memo-templates-modal');
            App.showNotification('템플릿이 적용되었습니다.', 'success');
        }
    }
}

// 메모 템플릿 삭제
function deleteMemoTemplate(index) {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    
    const templates = JSON.parse(localStorage.getItem('memoTemplates') || '[]');
    if (index >= 0 && index < templates.length) {
        templates.splice(index, 1);
        localStorage.setItem('memoTemplates', JSON.stringify(templates));
        App.showNotification('템플릿이 삭제되었습니다.', 'success');
        openMemoTemplates(); // 목록 새로고침
    }
}

// 페이지 로드 시 복사된 메모 복원
document.addEventListener('DOMContentLoaded', function() {
    const savedMemo = localStorage.getItem('copiedMemo');
    if (savedMemo) {
        copiedMemo = savedMemo;
        // 모달이 열릴 때 복사된 메모 표시
        const observer = new MutationObserver((mutations) => {
            const displayDiv = document.getElementById('copied-memo-display');
            if (displayDiv && savedMemo) {
                showCopiedMemo(savedMemo);
            }
        });
        
        const modal = document.getElementById('booking-modal');
        if (modal) {
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        }
    }
});

// 예약 번호를 날짜/시간 기준으로 재할당 (조용히, 알림 없이)
async function reorderBookingIdsSilent() {
    try {
        await App.api.post('/bookings/reorder');
        // 알림 없이 조용히 재정렬
    } catch (error) {
        console.error('예약 번호 재할당 실패:', error);
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
        console.error('예약 번호 재할당 실패:', error);
        App.showNotification('예약 번호 재할당에 실패했습니다.', 'danger');
    }
}

function applyFilters() {
    // 필터 적용 로직
    if (currentView === 'list') {
        loadBookingsList();
    } else {
        renderCalendar();
    }
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
        console.log('예약 선택 해제됨');
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
    
    console.log('예약 선택됨:', booking.id, booking);
    App.showNotification('예약이 선택되었습니다. Delete 키를 눌러 삭제할 수 있습니다.', 'info');
}

// 선택된 예약 삭제
async function deleteSelectedBooking() {
    if (!selectedBooking) {
        console.log('선택된 예약이 없습니다.');
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
        console.error('예약 삭제 실패:', error);
        App.showNotification('예약 삭제에 실패했습니다.', 'danger');
    }
}
