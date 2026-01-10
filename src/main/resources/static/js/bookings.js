// 예약/대관 관리 페이지 JavaScript

let currentDate = new Date();
let currentView = 'calendar';
let currentPage = 1;

// 목적 변경 시 레슨 카테고리 필드 표시/숨김
function toggleLessonCategory() {
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryGroup = document.getElementById('lesson-category-group');
    if (lessonCategoryGroup) {
        lessonCategoryGroup.style.display = (purpose === 'LESSON') ? 'block' : 'none';
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
        const facilities = await App.api.get('/facilities');
        const select = document.getElementById('booking-facility');
        select.innerHTML = '<option value="">시설 선택...</option>';
        facilities.forEach(facility => {
            const option = document.createElement('option');
            option.value = facility.id;
            option.textContent = facility.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('시설 목록 로드 실패:', error);
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


// 회원의 상품/이용권 목록 로드
async function loadMemberProducts(memberId) {
    try {
        const memberProducts = await App.api.get(`/members/${memberId}/products`);
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
            // 상품 이름만 표시 (잔여 횟수는 아래 정보 영역에만 표시)
            let text = product.name || '상품';
            
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

// 코치 범례 로드
async function loadCoachLegend() {
    try {
        const coaches = await App.api.get('/coaches');
        const legendContainer = document.getElementById('coach-legend');
        if (!legendContainer) return;
        
        // 활성 코치만 필터링
        const activeCoaches = coaches.filter(c => c.active !== false);
        
        if (activeCoaches.length === 0) {
            legendContainer.innerHTML = '';
            return;
        }
        
        // 색상 캐시 초기화
        App.CoachColors.resetCache();
        
        // 코치 정렬: 이름만 -> 야구 담당 -> 필라테스 -> 트레이닝
        const sortedCoaches = activeCoaches.sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            
            // specialties가 배열이면 join, 문자열이면 그대로 사용
            const getSpecialtiesString = (coach) => {
                if (!coach.specialties) return '';
                if (Array.isArray(coach.specialties)) {
                    return coach.specialties.join(' ').toLowerCase();
                }
                return String(coach.specialties).toLowerCase();
            };
            
            // 카테고리 분류 함수
            const getCategory = (coach) => {
                const name = coach.name || '';
                const specialties = getSpecialtiesString(coach);
                
                // 필라테스 체크 (이름에 "필라테스" 포함 또는 specialties에 필라테스)
                if (name.includes('필라테스') || specialties.includes('pilates') || specialties.includes('필라테스')) {
                    return 3;
                }
                // 트레이닝 체크 (이름에 "트레이닝" 포함 또는 specialties에 트레이닝)
                if (name.includes('트레이닝') || specialties.includes('training') || specialties.includes('트레이닝')) {
                    return 4;
                }
                // 야구 담당 체크 (이름에 [담당] 형식 포함)
                if (name.includes('[') && name.includes(']')) {
                    return 2;
                }
                // 이름만 있는 코치 (필라테스, 트레이닝, [담당] 형식이 없는 경우)
                return 1;
            };
            
            const aCat = getCategory(a);
            const bCat = getCategory(b);
            
            // 카테고리 순서대로 정렬
            if (aCat !== bCat) {
                return aCat - bCat;
            }
            
            // 같은 카테고리 내에서는 이름순 정렬
            // 1. 이름만 있는 코치: 이름 그대로 비교
            if (aCat === 1) {
                return aName.localeCompare(bName, 'ko');
            }
            
            // 2. 야구 담당: 담당 표시 제거 후 비교
            if (aCat === 2) {
                const aNameForSort = aName.replace(/\s*\[.*?\]\s*/g, '').trim();
                const bNameForSort = bName.replace(/\s*\[.*?\]\s*/g, '').trim();
                return aNameForSort.localeCompare(bNameForSort, 'ko');
            }
            
            // 3, 4. 필라테스/트레이닝: 접두사 제거 후 비교
            const aNameForSort = aName.replace(/^(필라테스|트레이닝)\s*/i, '').trim();
            const bNameForSort = bName.replace(/^(필라테스|트레이닝)\s*/i, '').trim();
            return aNameForSort.localeCompare(bNameForSort, 'ko');
        });
        
        let legendHTML = '<div class="legend-title">범례:</div>';
        sortedCoaches.forEach(coach => {
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
        
        const response = await App.api.get(`/bookings?start=${startISO}&end=${endISO}`);
        bookings = response || [];
        console.log(`캘린더 로드: ${bookings.length}개의 예약 발견`, bookings);
        
        // 예약이 없으면 전체 예약도 확인 (디버깅용)
        if (bookings.length === 0) {
            console.log('날짜 범위 내 예약 없음, 전체 예약 확인 중...');
            try {
                const allBookings = await App.api.get('/bookings');
                console.log(`전체 예약: ${allBookings ? allBookings.length : 0}개`, allBookings);
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
        
        // 예약이 있으면 배경 음영 적용
        if (dayBookings.length > 0) {
            // 코치별 색상 매핑
            const coachColors = getCoachColors(dayBookings);
            const backgroundColor = getDayBackgroundColor(coachColors);
            if (backgroundColor) {
                dayCell.style.backgroundColor = backgroundColor;
            } else {
                // 코치가 없어도 배경 음영 적용 (기본 색상)
                dayCell.style.backgroundColor = 'rgba(94, 106, 210, 0.1)';
            }
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
                
                // 코치 정보 추출 (예약에 직접 할당된 코치 우선, 없으면 회원의 코치)
                const coach = booking.coach || (booking.member && booking.member.coach ? booking.member.coach : null);
                
                // 코치별 색상 적용 (코치가 없으면 기본 색상 사용)
                const coachColor = getCoachColor(coach) || '#5E6AD2';
                event.style.backgroundColor = coachColor;
                event.style.borderLeft = `3px solid ${coachColor}`;
                
                // 상태에 따라 체크 표시 추가
                const status = booking.status || 'PENDING';
                const checkIcon = status === 'CONFIRMED' ? '✓ ' : '';
                
                // 이벤트 내용 설정 (한 줄로 표시: 체크표시 + 시간 / 이름)
                event.innerHTML = `${checkIcon}${timeStr} / ${memberName}`;
                
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
                    // 드래그가 아닐 때만 모달 열기
                    if (!isDragging) {
                        e.stopPropagation();
                        editBooking(booking.id);
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
            // 아이콘 클릭이 아닐 때만 회원 선택 모달 열기
            if (!e.target.classList.contains('day-schedule-icon') && 
                !e.target.closest('.day-schedule-icon') &&
                !e.target.classList.contains('calendar-event')) {
                // 고정된 날짜 값 사용 (클로저 문제 해결)
                console.log('캘린더 날짜 클릭:', cellDateStr, '년:', cellYear, '월:', cellMonth + 1, '일:', cellDay);
                openMemberSelectModal(cellDateStr);
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
        
        const bookings = await App.api.get(`/bookings?start=${startISO}&end=${endISO}`);
        
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
        
        const bookings = await App.api.get(`/bookings?page=${currentPage}`);
        renderBookingsTable(bookings);
    } catch (error) {
        console.error('예약 목록 로드 실패:', error);
    }
}

function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        const facilityName = booking.facility ? booking.facility.name : '-';
        const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
        const startTime = booking.startTime ? new Date(booking.startTime).toLocaleString('ko-KR') : '-';
        const status = booking.status || 'PENDING';
        const purpose = getPurposeText(booking.purpose);
        const lessonCategory = booking.lessonCategory ? getLessonCategoryText(booking.lessonCategory) : '-';
        
        return `
        <tr>
            <td>${booking.id}</td>
            <td>${facilityName}</td>
            <td>${startTime}</td>
            <td>${memberName}</td>
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
        // 선수반 회원은 기본적으로 레슨으로 설정
        if (member.grade === 'PLAYER' && !document.getElementById('booking-purpose').value) {
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
    document.getElementById('booking-modal-title').textContent = '예약 등록 (비회원)';
    document.getElementById('selected-member-id').value = '';
    document.getElementById('selected-member-number').value = '';
    
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

function openBookingModal(id = null) {
    const modal = document.getElementById('booking-modal');
    const title = document.getElementById('booking-modal-title');
    const deleteBtn = document.getElementById('booking-delete-btn');
    const form = document.getElementById('booking-form');
    
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
        
        form.reset();
        document.getElementById('selected-member-id').value = '';
        document.getElementById('selected-member-number').value = '';
        document.getElementById('booking-date').value = selectedBookingDate || new Date().toISOString().split('T')[0];
        
        // 레슨 카테고리 필드 초기화
        toggleLessonCategory();
        
        // 모든 섹션 초기화
        document.getElementById('member-info-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        
        // 상태 필드 활성화 (회원/비회원 선택 전까지는 기본 상태)
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING';
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
        const booking = await App.api.get(`/bookings/${id}`);
        // 폼에 데이터 채우기
        document.getElementById('booking-id').value = booking.id;
        document.getElementById('booking-facility').value = booking.facility?.id || '';
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
            
            // 회원의 상품 목록 로드
            loadMemberProducts(booking.member.id);
            
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
        document.getElementById('booking-status').value = booking.status || 'PENDING';
        document.getElementById('booking-payment-method').value = booking.paymentMethod || '';
        document.getElementById('booking-notes').value = booking.memo || '';
        
        // MemberProduct 정보 설정 (있는 경우)
        if (booking.memberProduct && booking.memberProduct.id && booking.member) {
            // 회원의 상품 목록이 로드된 후에 설정
            setTimeout(async () => {
                const memberProducts = await App.api.get(`/members/${booking.member.id}/products`);
                const select = document.getElementById('booking-member-product');
                if (select && memberProducts) {
                    const memberProduct = memberProducts.find(mp => mp.id === booking.memberProduct.id);
                    if (memberProduct) {
                        select.value = memberProduct.id;
                        // 상품 정보 표시
                        const productInfo = document.getElementById('product-info');
                        const productInfoText = document.getElementById('product-info-text');
                        if (productInfo && productInfoText && memberProduct.product) {
                            if (memberProduct.product.type === 'COUNT_PASS') {
                                const remaining = memberProduct.remainingCount || 0;
                                productInfoText.textContent = `횟수권 사용: 잔여 ${remaining}회`;
                                productInfo.style.display = 'block';
                            } else {
                                productInfoText.textContent = '상품 사용 예정';
                                productInfo.style.display = 'block';
                            }
                        }
                    }
                }
            }, 500);
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
    openBookingModal(id);
}

async function saveBooking() {
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start-time').value;
    const endTime = document.getElementById('booking-end-time').value;
    
    // 종료 시간 검증
    if (!endTime || endTime.trim() === '') {
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
    let bookingStatus = 'PENDING';
    if (statusSelect && statusSelect.value) {
        // 수정 모드인 경우 기존 상태 유지 가능
        bookingStatus = statusSelect.value;
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
        // paymentMethod 값 변환 (프론트엔드 -> 백엔드 enum 형식)
        paymentMethod: paymentMethod ? (paymentMethod === 'ONSITE' ? 'ON_SITE' : (paymentMethod === 'DEFERRED' ? 'POSTPAID' : paymentMethod)) : null,
        memo: memo || null
    };
    
    console.log('예약 저장 데이터:', JSON.stringify(data, null, 2));
    
    try {
        const id = document.getElementById('booking-id').value;
        let savedBooking;
        if (id) {
            savedBooking = await App.api.put(`/bookings/${id}`, data);
            App.showNotification('예약이 수정되었습니다.', 'success');
        } else {
            savedBooking = await App.api.post('/bookings', data);
            console.log('예약 저장 성공:', savedBooking);
            App.showNotification('예약이 등록되었습니다.', 'success');
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
        console.error('예약 승인 실패:', error);
        App.showNotification('승인에 실패했습니다.', 'danger');
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
        
        // 새 예약 데이터 생성
        const newBooking = {
            facility: booking.facility ? { id: booking.facility.id } : null,
            member: booking.member ? { id: booking.member.id } : null,
            nonMemberName: booking.nonMemberName || null,
            nonMemberPhone: booking.nonMemberPhone || null,
            coach: booking.coach ? { id: booking.coach.id } : null,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
            participants: booking.participants || 1,
            purpose: booking.purpose,
            lessonCategory: booking.lessonCategory || null,
            status: 'PENDING', // 복사된 예약은 대기 상태로
            paymentMethod: booking.paymentMethod || null,
            memo: booking.memo ? `[복사] ${booking.memo}` : '[복사]'
        };
        
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
