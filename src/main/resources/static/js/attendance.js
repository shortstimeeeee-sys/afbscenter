// 출석/이용 기록 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // 전체 체크인 / 이용중 기록 리셋 버튼은 관리자만 표시
    var bulkBtn = document.getElementById('bulk-checkin-btn');
    var bulkBtnToday = document.getElementById('bulk-checkin-btn-today');
    var resetBtn = document.getElementById('reset-incomplete-attendances-btn');
    if (bulkBtn) bulkBtn.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';
    if (bulkBtnToday) bulkBtnToday.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';
    if (resetBtn) resetBtn.style.display = (App.currentRole === 'ADMIN') ? '' : 'none';
    loadCoachesIntoFilters();
    loadTodayBookings();
    loadAttendanceRecords();
    loadUncheckedBookings();
});

/** 코치 목록 로드 후 세 구역 필터에 채우기 */
async function loadCoachesIntoFilters() {
    try {
        const coaches = await App.api.get('/coaches');
        const list = Array.isArray(coaches) ? coaches : [];
        const optionHtml = list.map(c => `<option value="${c.id || ''}">${App.escapeHtml(c.name || '-')}</option>`).join('');
        ['unchecked-coach-filter', 'today-coach-filter', 'attendance-coach-filter'].forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                const current = sel.value;
                sel.innerHTML = '<option value="">전체</option>' + optionHtml;
                if (current) sel.value = current;
            }
        });
    } catch (e) {
        App.err('코치 목록 로드 실패:', e);
    }
}

/** 시설명으로 지점 고유색용 클래스 반환 (다른 페이지와 동일: 사하점/연산점) */
function getAttendanceFacilityBranchClass(facilityName) {
    if (!facilityName || typeof facilityName !== 'string') return '';
    const n = facilityName.trim();
    if (n.indexOf('사하') !== -1) return 'branch-label--saha';
    if (n.indexOf('연산') !== -1) return 'branch-label--yeonsan';
    if (n === '대관' || n.indexOf('대관') !== -1) return 'branch-label--rental';
    return '';
}

/** 레슨 카테고리 배지 클래스 (다른 페이지와 동일) */
function getAttendanceLessonCategoryBadge(category, purpose) {
    if (purpose === 'RENTAL') return 'rental';
    return (App.LessonCategory && App.LessonCategory.getBadge) ? App.LessonCategory.getBadge(category) : 'secondary';
}

/** 담당 코치 고유색 (App.CoachColors 사용) */
function getAttendanceCoachColorStyle(coach) {
    if (!coach) return '';
    const color = (App.CoachColors && typeof App.CoachColors.getColor === 'function') ? App.CoachColors.getColor(coach) : null;
    return color ? 'color:' + color + ';font-weight:500;' : '';
}

/** 회원 셀 HTML (회원이면 클릭 시 모달, 비회원이면 텍스트만) */
function buildMemberCellHtml(memberId, memberNameDisplay) {
    if (memberId != null && memberId !== '') {
        const id = typeof memberId === 'number' ? memberId : parseInt(memberId, 10);
        if (!isNaN(id)) {
            return '<a href="javascript:void(0)" class="member-name-link" data-member-id="' + id + '" onclick="openMemberInfoModal(' + id + '); return false;">' + App.escapeHtml(memberNameDisplay || '회원') + '</a>';
        }
    }
    return App.escapeHtml(memberNameDisplay || '-');
}

/** 회원 이름 클릭 시 회원 이용권/코치 정보 모달 표시 */
async function openMemberInfoModal(memberId) {
    const contentEl = document.getElementById('member-info-content');
    if (!contentEl) return;
    contentEl.innerHTML = '<p class="text-muted">불러오는 중...</p>';
    if (typeof App.Modal !== 'undefined' && App.Modal.open) App.Modal.open('member-info-modal');
    try {
        const member = await App.api.get('/members/' + memberId);
        if (!member) {
            contentEl.innerHTML = '<p class="text-muted">회원 정보를 찾을 수 없습니다.</p>';
            return;
        }
        const coachName = (member.coach && member.coach.name) ? member.coach.name : '-';
        const products = member.memberProducts || [];
        const getStatusText = function(s) {
            const map = { 'ACTIVE': '이용중', 'EXPIRED': '만료', 'SUSPENDED': '보류', 'USED_UP': '소진' };
            return map[s] || s;
        };
        const rows = products.map(function(mp) {
            const p = mp.product || {};
            const coach = (mp.coach && mp.coach.name) ? mp.coach.name : '-';
            const status = getStatusText(mp.status);
            const purchaseDate = mp.purchaseDate ? App.formatDate(mp.purchaseDate) : '-';
            const expiryDate = mp.expiryDate ? App.formatDate(mp.expiryDate) : '-';
            const remain = (mp.remainingCount != null && mp.totalCount != null) ? mp.remainingCount + ' / ' + mp.totalCount : '-';
            return '<tr><td>' + App.escapeHtml(p.name || '-') + '</td><td>' + status + '</td><td>' + App.escapeHtml(coach) + '</td><td>' + purchaseDate + '</td><td>' + expiryDate + '</td><td>' + remain + '</td></tr>';
        }).join('');
        contentEl.innerHTML =
            '<div class="member-info-section">' +
            '<div class="detail-item"><strong>회원명</strong><span>' + App.escapeHtml(member.name || '-') + '</span></div>' +
            '<div class="detail-item"><strong>회원번호</strong><span>' + App.escapeHtml(member.memberNumber || '-') + '</span></div>' +
            '<div class="detail-item"><strong>담당 코치</strong><span>' + App.escapeHtml(coachName) + '</span></div>' +
            '</div>' +
            '<h3 class="member-info-subtitle">이용권 목록</h3>' +
            '<div class="member-info-table-wrap"><table class="table member-info-table">' +
            '<thead><tr><th>상품명</th><th>상태</th><th>지정 코치</th><th>구매일</th><th>만료일</th><th>잔여</th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="6">이용권이 없습니다.</td></tr>') + '</tbody></table></div>';
    } catch (err) {
        App.err('회원 정보 조회 실패:', err);
        contentEl.innerHTML = '<p class="text-danger">회원 정보를 불러오지 못했습니다.</p>';
    }
}

/** 예약 목록 전체 (레슨 카테고리 필터용) */
let _todayBookingsAll = [];

function getTodayBookingCategoryKey(booking) {
    if (!booking) return null;
    if (booking.purpose === 'RENTAL') return 'RENTAL';
    if (booking.purpose === 'LESSON' && booking.lessonCategory) return booking.lessonCategory;
    return null;
}

function getBranchFromBooking(booking) {
    if (!booking || !booking.facility) return '';
    return (booking.facility.name || booking.facility.branch || '').trim();
}

function getCoachIdFromBooking(booking) {
    if (!booking || !booking.coach) return null;
    const id = booking.coach.id;
    return id != null ? Number(id) : null;
}

/** 체크인 대상 회원 예약인지 (비회원·체험은 false → 예약 목록에서 제외) */
function isMemberBookingForCheckin(booking) {
    if (!booking) return false;
    if (!booking.member) return false;
    if (booking.nonMemberName && String(booking.nonMemberName).trim() !== '') return false;
    const name = booking.member.name;
    if (name && String(name).includes('체험')) return false;
    return true;
}

function filterTodayDisplay() {
    const catSelect = document.getElementById('today-lesson-category-filter');
    const branchSelect = document.getElementById('today-branch-filter');
    const coachSelect = document.getElementById('today-coach-filter');
    const catValue = catSelect ? catSelect.value : '';
    const branchValue = branchSelect ? branchSelect.value : '';
    const coachValue = coachSelect ? coachSelect.value : '';
    let list = (_todayBookingsAll || []).filter(isMemberBookingForCheckin);
    if (catValue) list = list.filter(b => getTodayBookingCategoryKey(b) === catValue);
    if (branchValue) list = list.filter(b => getBranchFromBooking(b) === branchValue);
    if (coachValue) {
        const coachId = parseInt(coachValue, 10);
        list = list.filter(b => getCoachIdFromBooking(b) === coachId);
    }
    renderTodayBookings(list);
}

async function loadTodayBookings() {
    // 오늘 날짜로 고정
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    
    try {
        const bookings = await App.api.get(`/bookings?date=${date}`);
        App.log('예약 목록 조회 결과:', bookings?.length || 0, '건', bookings);
        _todayBookingsAll = Array.isArray(bookings) ? bookings : [];
        filterTodayDisplay();
    } catch (error) {
        App.err('오늘 예약 로드 실패:', error);
        App.showNotification('예약 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

function renderTodayBookings(bookings) {
    const tbody = document.getElementById('today-bookings-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    // 중복 제거: 같은 예약 ID는 하나만 표시 (JOIN FETCH로 인한 중복 방지)
    const uniqueBookings = [];
    const seenIds = new Set();
    
    for (const booking of bookings) {
        if (!booking.id) {
            App.warn('예약 ID가 없음:', booking);
            continue;
        }
        
        // 예약 ID로 중복 체크
        if (seenIds.has(booking.id)) {
            App.warn('중복 예약 ID 발견 (같은 예약이 여러 번 반환됨):', booking.id, {
                startTime: booking.startTime,
                facility: booking.facility?.name,
                member: booking.member?.name || booking.nonMemberName
            });
            continue;
        }
        
        seenIds.add(booking.id);
        uniqueBookings.push(booking);
    }
    
    if (bookings.length !== uniqueBookings.length) {
        App.warn(`중복 제거: 원본 ${bookings.length}건 → ${uniqueBookings.length}건 (JOIN FETCH로 인한 중복)`);
    }
    
    // 오늘 날짜 (시간 제외)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    tbody.innerHTML = uniqueBookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            App.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
        }
        
        const bookingDate = new Date(startTime);
        bookingDate.setHours(0, 0, 0, 0);
        
        // 예약 날짜가 오늘인지, 과거인지, 미래인지 확인
        const isToday = bookingDate.getTime() === today.getTime();
        const isPast = bookingDate.getTime() < today.getTime();
        const isFuture = bookingDate.getTime() > today.getTime();
        
        // 날짜 포맷팅 (체크인 미처리 현황과 동일한 형식)
        const dateStr = App.formatDate(booking.startTime);
        
        // 시간 포맷팅 (HH:mm 형식)
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 시설 이름 추출
        const facilityName = booking.facility ? (booking.facility.name || '-') : '-';
        
        // 회원 이름 추출 (회원이 있으면 회원 이름, 없으면 비회원 이름 또는 전화번호)
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 레슨 카테고리 (배지 + 고유색)
        let lessonCategoryHtml = '-';
        if (booking.purpose === 'LESSON' && booking.lessonCategory) {
            const text = App.LessonCategory ? App.LessonCategory.getText(booking.lessonCategory) : booking.lessonCategory;
            const badge = getAttendanceLessonCategoryBadge(booking.lessonCategory, 'LESSON');
            lessonCategoryHtml = '<span class="badge badge-' + badge + '">' + App.escapeHtml(text) + '</span>';
        } else if (booking.purpose === 'RENTAL') {
            lessonCategoryHtml = '<span class="badge badge-rental">대관</span>';
        }
        
        const coachStyle = getAttendanceCoachColorStyle(booking.coach);
        const coachNameRaw = (booking.coach && booking.coach.name) ? booking.coach.name : '';
        const coachHtml = coachNameRaw ? '<span style="' + coachStyle + '">' + App.escapeHtml(coachNameRaw) + '</span>' : '-';
        
        const branchClass = getAttendanceFacilityBranchClass(facilityName);
        const facilityHtml = branchClass ? '<span class="branch-label ' + branchClass + '">' + App.escapeHtml(facilityName) + '</span>' : App.escapeHtml(facilityName);
        
        const memberHtml = buildMemberCellHtml(booking.member ? booking.member.id : null, memberName);
        
        const status = booking.status || 'PENDING';
        const isNonMemberOrTrial = !booking.member || (booking.nonMemberName && String(booking.nonMemberName).trim() !== '') || (booking.member && booking.member.name && String(booking.member.name).includes('체험'));
        const canCheckin = (status === 'CONFIRMED' || status === 'COMPLETED') && !isNonMemberOrTrial;
        const showCheckinButton = canCheckin && (isToday || isPast);
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${memberHtml}</td>
                <td>${coachHtml}</td>
                <td>${lessonCategoryHtml}</td>
                <td>${facilityHtml}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${getBookingStatusBadge(status)}">${getBookingStatusText(status)}</span></td>
                <td>
                    ${showCheckinButton ? `
                        <button class="btn btn-sm btn-primary" onclick="openCheckinModal(${booking.id})">체크인</button>
                    ` : isFuture ? '<span style="color: var(--text-muted); font-size: 12px;">예약 당일 체크인 가능</span>' : (isNonMemberOrTrial ? '<span style="color: var(--text-muted); font-size: 12px;">자동 체크인</span>' : '')}
                </td>
            </tr>
        `;
    }).join('');
}

// 예약 상태 관련 함수는 common.js의 App.Status.booking 사용
function getBookingStatusBadge(status) {
    return App.Status.booking.getBadge(status);
}

function getBookingStatusText(status) {
    return App.Status.booking.getText(status);
}

async function openCheckinModal(bookingId) {
    try {
        const booking = await App.api.get(`/bookings/${bookingId}`);
        document.getElementById('checkin-booking-id').value = bookingId;
        
        // 회원 이름 추출
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 시설 이름 추출
        const facilityName = booking.facility ? (booking.facility.name || '-') : '-';
        
        document.getElementById('checkin-member-name').value = memberName;
        document.getElementById('checkin-facility-name').value = facilityName;
        document.getElementById('checkin-booking-time').value = App.formatDateTime(booking.startTime);
        App.Modal.open('checkin-modal');
    } catch (error) {
        App.err('체크인 모달 오류:', error);
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function processCheckin() {
    const bookingIdEl = document.getElementById('checkin-booking-id');
    const bookingId = bookingIdEl ? bookingIdEl.value.trim() : '';
    const autoDeduct = document.getElementById('checkin-auto-deduct').checked;
    
    if (!bookingId) {
        App.showNotification('예약 정보가 없습니다. 체크인 창을 닫았다가 다시 시도해 주세요.', 'warning');
        return;
    }
    
    try {
        const response = await App.api.post(`/attendance/checkin`, {
            bookingId: parseInt(bookingId, 10),
            autoDeduct: autoDeduct
        });
        
        App.log('체크인 응답 전체:', JSON.stringify(response, null, 2)); // 디버깅용
        App.log('productDeducted 존재 여부:', !!response?.productDeducted); // 디버깅용
        App.log('deductSkipped:', response?.deductSkipped); // 디버깅용
        App.log('deductFailed:', response?.deductFailed); // 디버깅용
        
        // 이용권 차감 정보가 있으면 상세 메시지 표시
        if (response && response.productDeducted) {
            const product = response.productDeducted;
            App.log('이용권 차감 정보:', product); // 디버깅용
            
            // 상세 메시지창 표시
            showDeductMessage(product);
        } else {
            // 차감이 안 된 이유 확인
            let message = '체크인이 완료되었습니다.';
            if (response?.deductSkipped) {
                message += `\n\n⚠️ 이용권 차감 건너뜀: ${response.deductSkipReason || '알 수 없는 이유'}`;
                App.warn('이용권 차감 건너뜀:', response.deductSkipReason);
            } else if (response?.deductFailed) {
                message += `\n\n❌ 이용권 차감 실패: ${response.deductFailReason || '알 수 없는 이유'}`;
                App.err('이용권 차감 실패:', response.deductFailReason);
            } else {
                App.log('이용권 차감 정보 없음 - 응답:', response); // 디버깅용
            }
            App.showNotification(message, response?.deductFailed ? 'warning' : 'success');
        }
        
        App.Modal.close('checkin-modal');
        loadTodayBookings();
        loadAttendanceRecords();
        loadUncheckedBookings();
    } catch (error) {
        const data = error.response && error.response.data ? error.response.data : (error.data || {});
        let msg = (data && data.error) ? data.error : '체크인 처리에 실패했습니다.';
        if (error.response && error.response.status === 500) {
            const step = data.failedStep || '(알 수 없음)';
            const errType = data.errorType || '';
            const cause = data.cause || '';
            console.error('[체크인 500] 실패 단계:', step, '| errorType:', errType, '| cause:', cause, '| 전체:', JSON.stringify(data));
            App.err('[체크인 500] 실패 단계(failedStep):', step);
            App.err('[체크인 500] 서버 응답:', data);
            msg = '체크인 실패 (단계: ' + step + '). ' + msg;
        }
        if (error.response && error.response.status === 400) {
            App.err('[체크인 400] 서버 응답:', data);
            loadTodayBookings();
            loadUncheckedBookings();
            loadAttendanceRecords();
        }
        App.showNotification(msg, 'danger');
    }
}

// 이용권 차감 상세 메시지창 표시
function showDeductMessage(productInfo) {
    App.log('showDeductMessage 호출됨:', productInfo); // 디버깅용
    
    // 기존 메시지창이 있으면 제거
    const existingModal = document.getElementById('deduct-message-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // CSS 변수 가져오기
    const root = getComputedStyle(document.documentElement);
    const bgSecondary = root.getPropertyValue('--bg-secondary').trim() || '#151924';
    const bgTertiary = root.getPropertyValue('--bg-tertiary').trim() || '#1C2130';
    const textPrimary = root.getPropertyValue('--text-primary').trim() || '#E6E8EB';
    const textSecondary = root.getPropertyValue('--text-secondary').trim() || '#A1A6B3';
    const textMuted = root.getPropertyValue('--text-muted').trim() || '#6B7280';
    const accentPrimary = root.getPropertyValue('--accent-primary').trim() || '#5E6AD2';
    const accentHover = root.getPropertyValue('--accent-hover').trim() || '#4C56B8';
    const borderColor = root.getPropertyValue('--border-color').trim() || '#2D3441';
    const success = root.getPropertyValue('--success').trim() || '#2ECC71';
    const danger = root.getPropertyValue('--danger').trim() || '#E74C3C';
    const radiusMd = root.getPropertyValue('--radius-md').trim() || '8px';
    const radiusLg = root.getPropertyValue('--radius-lg').trim() || '12px';
    const shadowLg = root.getPropertyValue('--shadow-lg').trim() || '0 8px 16px rgba(0, 0, 0, 0.5)';
    
    // 메시지창 HTML 생성
    const modalHtml = `
        <div id="deduct-message-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;">
            <div class="modal-backdrop" onclick="closeDeductMessage()" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7);"></div>
            <div class="modal-content" style="position: relative; max-width: 500px; width: 90%; background: ${bgSecondary}; border: 1px solid ${borderColor}; border-radius: ${radiusLg}; box-shadow: ${shadowLg}; transform: scale(0.9); transition: transform 0.3s; z-index: 10001;">
                <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid ${borderColor}; background: ${bgTertiary}; border-radius: ${radiusLg} ${radiusLg} 0 0;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: ${textPrimary}; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px; color: ${success};">✓</span>
                        체크인 완료
                    </h2>
                </div>
                <div class="modal-body" style="padding: 24px; background: ${bgSecondary};">
                    <p style="margin: 0 0 20px 0; color: ${textPrimary}; font-size: 16px; line-height: 1.6;">
                        체크인이 완료되었습니다.
                    </p>
                    <div style="background: ${bgTertiary}; border-left: 4px solid ${accentPrimary}; padding: 16px; border-radius: ${radiusMd}; margin-bottom: 0;">
                        <h3 style="margin: 0 0 16px 0; color: ${accentPrimary}; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <span>📋</span>
                            이용권 차감 정보
                        </h3>
                        <div style="display: grid; gap: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                                <span style="font-weight: 500; color: ${textSecondary};">이용권:</span>
                                <span style="color: ${textPrimary}; font-weight: 600;">${productInfo.productName || '-'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                                <span style="font-weight: 500; color: ${textSecondary};">차감 전:</span>
                                <span style="color: ${textPrimary}; font-weight: 600;">${productInfo.beforeCount !== null && productInfo.beforeCount !== undefined ? productInfo.beforeCount + '회' : '-'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid ${borderColor}; border-bottom: 1px solid ${borderColor};">
                                <span style="font-weight: 500; color: ${textSecondary};">차감 후:</span>
                                <span style="color: ${danger}; font-weight: 700; font-size: 18px;">${productInfo.remainingCount !== null && productInfo.remainingCount !== undefined ? productInfo.remainingCount + '회' : '-'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                                <span style="font-weight: 500; color: ${textSecondary};">총 횟수:</span>
                                <span style="color: ${textPrimary}; font-weight: 600;">${productInfo.totalCount !== null && productInfo.totalCount !== undefined ? productInfo.totalCount + '회' : '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px 24px; background: ${bgSecondary}; border-radius: 0 0 ${radiusLg} ${radiusLg}; text-align: right; border-top: 1px solid ${borderColor};">
                    <button onclick="closeDeductMessage()" class="btn btn-primary" style="background: ${accentPrimary}; color: white; border: none; padding: 10px 24px; border-radius: ${radiusMd}; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;" 
                            onmouseover="this.style.background='${accentHover}'; this.style.transform='translateY(-1px)';" 
                            onmouseout="this.style.background='${accentPrimary}'; this.style.transform='';">
                        확인
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 메시지창 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 애니메이션 효과
    const modal = document.getElementById('deduct-message-modal');
    if (modal) {
        setTimeout(() => {
            modal.style.opacity = '1';
            const content = modal.querySelector('.modal-content');
            if (content) {
                content.style.transform = 'scale(1)';
            }
        }, 10);
        App.log('메시지창 표시 완료'); // 디버깅용
    } else {
        App.err('메시지창 요소를 찾을 수 없음'); // 디버깅용
    }
}

// 이용권 차감 메시지창 닫기 (전역 함수로 등록)
window.closeDeductMessage = function() {
    const modal = document.getElementById('deduct-message-modal');
    if (modal) {
        modal.style.opacity = '0';
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.style.transform = 'scale(0.9)';
        }
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

// 일괄 체크인 시 이용권 차감 메시지창 표시
function showBulkDeductMessage(deductedProducts, successCount, failCount = 0) {
    App.log('일괄 체크인 차감 정보:', deductedProducts);
    
    // 기존 메시지창이 있으면 제거
    const existingModal = document.getElementById('deduct-message-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // CSS 변수 가져오기
    const root = getComputedStyle(document.documentElement);
    const bgSecondary = root.getPropertyValue('--bg-secondary').trim() || '#151924';
    const bgTertiary = root.getPropertyValue('--bg-tertiary').trim() || '#1C2130';
    const textPrimary = root.getPropertyValue('--text-primary').trim() || '#E6E8EB';
    const textSecondary = root.getPropertyValue('--text-secondary').trim() || '#A1A6B3';
    const textMuted = root.getPropertyValue('--text-muted').trim() || '#6B7280';
    const accentPrimary = root.getPropertyValue('--accent-primary').trim() || '#5E6AD2';
    const accentHover = root.getPropertyValue('--accent-hover').trim() || '#4C56B8';
    const borderColor = root.getPropertyValue('--border-color').trim() || '#2D3441';
    const success = root.getPropertyValue('--success').trim() || '#2ECC71';
    const danger = root.getPropertyValue('--danger').trim() || '#E74C3C';
    const radiusMd = root.getPropertyValue('--radius-md').trim() || '8px';
    const radiusLg = root.getPropertyValue('--radius-lg').trim() || '12px';
    const shadowLg = root.getPropertyValue('--shadow-lg').trim() || '0 8px 16px rgba(0, 0, 0, 0.5)';
    
    // 차감 정보를 회원별로 그룹화
    const memberProducts = {};
    deductedProducts.forEach(item => {
        const key = `${item.memberName}_${item.product.productName}`;
        if (!memberProducts[key]) {
            memberProducts[key] = {
                memberName: item.memberName,
                productName: item.product.productName,
                beforeCount: item.product.beforeCount,
                afterCount: item.product.remainingCount,
                totalCount: item.product.totalCount,
                count: 0
            };
        }
        memberProducts[key].count++;
    });
    
    const productListHtml = Object.values(memberProducts).map(mp => `
        <div style="background: ${bgTertiary}; border-radius: ${radiusMd}; padding: 12px; margin-bottom: 10px; border-left: 3px solid ${accentPrimary}; border: 1px solid ${borderColor};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 600; color: ${textPrimary};">${mp.memberName}</span>
                <span style="font-size: 12px; color: ${textMuted};">${mp.count}회 차감</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                <div>
                    <span style="color: ${textSecondary};">이용권:</span>
                    <span style="font-weight: 500; color: ${textPrimary}; margin-left: 8px;">${mp.productName}</span>
                </div>
                <div>
                    <span style="color: ${textSecondary};">차감 전:</span>
                    <span style="font-weight: 500; color: ${textPrimary}; margin-left: 8px;">${mp.beforeCount !== null && mp.beforeCount !== undefined ? mp.beforeCount + '회' : '-'}</span>
                </div>
                <div>
                    <span style="color: ${textSecondary};">차감 후:</span>
                    <span style="font-weight: 600; color: ${danger}; margin-left: 8px;">${mp.afterCount !== null && mp.afterCount !== undefined ? mp.afterCount + '회' : '-'}</span>
                </div>
                <div>
                    <span style="color: ${textSecondary};">총 횟수:</span>
                    <span style="font-weight: 500; color: ${textPrimary}; margin-left: 8px;">${mp.totalCount !== null && mp.totalCount !== undefined ? mp.totalCount + '회' : '-'}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    const modalHtml = `
        <div id="deduct-message-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;">
            <div class="modal-backdrop" onclick="closeDeductMessage()" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7);"></div>
            <div class="modal-content" style="position: relative; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; background: ${bgSecondary}; border: 1px solid ${borderColor}; border-radius: ${radiusLg}; box-shadow: ${shadowLg}; transform: scale(0.9); transition: transform 0.3s; z-index: 10001;">
                <div class="modal-header" style="padding: 20px 24px; border-bottom: 1px solid ${borderColor}; background: ${bgTertiary}; border-radius: ${radiusLg} ${radiusLg} 0 0;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: ${textPrimary}; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px; color: ${success};">✓</span>
                        일괄 체크인 완료
                    </h2>
                </div>
                <div class="modal-body" style="padding: 24px; background: ${bgSecondary};">
                    <p style="margin: 0 0 20px 0; color: ${textPrimary}; font-size: 16px; line-height: 1.6;">
                        총 ${successCount}개 예약이 체크인되었습니다.${failCount > 0 ? ` <span style="color: ${danger};">(${failCount}개 실패)</span>` : ''}
                    </p>
                    <div style="background: ${bgTertiary}; border-left: 4px solid ${accentPrimary}; padding: 16px; border-radius: ${radiusMd}; margin-bottom: 0;">
                        <h3 style="margin: 0 0 16px 0; color: ${accentPrimary}; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <span>📋</span>
                            이용권 차감 정보 (${Object.keys(memberProducts).length}건)
                        </h3>
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${productListHtml}
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px 24px; background: ${bgSecondary}; border-radius: 0 0 ${radiusLg} ${radiusLg}; text-align: right; border-top: 1px solid ${borderColor};">
                    <button onclick="closeDeductMessage()" class="btn btn-primary" style="background: ${accentPrimary}; color: white; border: none; padding: 10px 24px; border-radius: ${radiusMd}; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;" 
                            onmouseover="this.style.background='${accentHover}'; this.style.transform='translateY(-1px)';" 
                            onmouseout="this.style.background='${accentPrimary}'; this.style.transform='';">
                        확인
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 메시지창 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 애니메이션 효과
    const modal = document.getElementById('deduct-message-modal');
    if (modal) {
        setTimeout(() => {
            modal.style.opacity = '1';
            const content = modal.querySelector('.modal-content');
            if (content) {
                content.style.transform = 'scale(1)';
            }
        }, 10);
    }
}

/** 출석 기록 전체 (레슨 카테고리 필터용) */
let _attendanceRecordsAll = [];

function getAttendanceRecordCategoryKey(record) {
    if (!record) return null;
    if (record.purpose === 'RENTAL') return 'RENTAL';
    if (record.lessonCategory) return record.lessonCategory;
    return null;
}

function getBranchFromAttendanceRecord(record) {
    return (record.facilityName || '').trim();
}

function filterAttendanceDisplay() {
    const catSelect = document.getElementById('attendance-lesson-category-filter');
    const branchSelect = document.getElementById('attendance-branch-filter');
    const coachSelect = document.getElementById('attendance-coach-filter');
    const catValue = catSelect ? catSelect.value : '';
    const branchValue = branchSelect ? branchSelect.value : '';
    const coachValue = coachSelect ? coachSelect.value : '';
    let list = _attendanceRecordsAll || [];
    if (catValue) list = list.filter(r => getAttendanceRecordCategoryKey(r) === catValue);
    if (branchValue) list = list.filter(r => getBranchFromAttendanceRecord(r) === branchValue);
    if (coachValue) {
        const coachId = parseInt(coachValue, 10);
        list = list.filter(r => (r.coachId != null ? Number(r.coachId) : null) === coachId);
    }
    renderAttendanceRecords(list);
}

async function loadAttendanceRecords() {
    const startDate = document.getElementById('filter-date-start').value;
    const endDate = document.getElementById('filter-date-end').value;
    
    try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        // 쿼리 파라미터가 있을 때만 ? 추가
        const queryString = params.toString();
        const url = queryString ? `/attendance?${queryString}` : '/attendance';
        
        const records = await App.api.get(url);
        _attendanceRecordsAll = Array.isArray(records) ? records : [];
        filterAttendanceDisplay();
    } catch (error) {
        App.err('출석 기록 로드 실패:', error);
    }
}

function renderAttendanceRecords(records) {
    const tbody = document.getElementById('attendance-records-body');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">출석 기록이 없습니다.</td></tr>';
        return;
    }
    
    // 날짜 및 체크인 시간 기준으로 정렬 (최신이 위로)
    const sortedRecords = [...records].sort((a, b) => {
        // 날짜 비교 (최신 날짜가 위로)
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB - dateA;
        }
        
        // 같은 날짜면 체크인 시간으로 비교 (최신이 위로)
        const checkInA = a.checkInTime ? new Date(a.checkInTime) : new Date(0);
        const checkInB = b.checkInTime ? new Date(b.checkInTime) : new Date(0);
        return checkInB - checkInA;
    });
    
    tbody.innerHTML = sortedRecords.map(record => {
        const checkIn = record.checkInTime ? new Date(record.checkInTime) : null;
        const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
        const duration = checkIn && checkOut ? 
            Math.round((checkOut - checkIn) / (1000 * 60)) + '분' : '-';
        
        // 체크인은 했지만 체크아웃은 안 한 경우 "이용중"
        const isInUse = checkIn && !checkOut;
        const statusText = isInUse ? '이용중' : (checkOut ? '완료' : '-');
        const statusBadge = isInUse ? 'warning' : (checkOut ? 'success' : 'secondary');
        let lessonCategoryHtml = '-';
        if (record.purpose === 'RENTAL') {
            lessonCategoryHtml = '<span class="badge badge-rental">대관</span>';
        } else if (record.lessonCategory && App.LessonCategory) {
            const text = App.LessonCategory.getText(record.lessonCategory);
            const badge = getAttendanceLessonCategoryBadge(record.lessonCategory, 'LESSON');
            lessonCategoryHtml = '<span class="badge badge-' + badge + '">' + App.escapeHtml(text) + '</span>';
        }
        const coachObj = record.coachId != null ? { id: record.coachId, name: record.coachName } : null;
        const coachStyle = getAttendanceCoachColorStyle(coachObj);
        const coachHtml = record.coachName ? '<span style="' + coachStyle + '">' + App.escapeHtml(record.coachName) + '</span>' : '-';
        const memberHtml = buildMemberCellHtml(record.memberId, record.memberName);
        const checkInStr = checkIn ? checkIn.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';
        return `
            <tr>
                <td>${App.formatDate(record.date)}</td>
                <td>${memberHtml}</td>
                <td>${coachHtml}</td>
                <td>${lessonCategoryHtml}</td>
                <td>${checkInStr}</td>
                <td>${duration}</td>
                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                <td>
                    ${isInUse ? `
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-secondary" onclick="processCheckout(${record.id})">체크아웃</button>
                            <button class="btn btn-sm btn-danger" onclick="resetAttendance(${record.id})" title="체크인 전 상태로 리셋">리셋</button>
                        </div>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// 체크아웃 처리
async function processCheckout(attendanceId) {
    if (!confirm('체크아웃을 처리하시겠습니까?')) {
        return;
    }
    
    try {
        await App.api.post(`/attendance/checkout`, {
            attendanceId: attendanceId
        });
        App.showNotification('체크아웃이 완료되었습니다.', 'success');
        loadAttendanceRecords();
    } catch (error) {
        App.err('체크아웃 처리 실패:', error);
        App.showNotification('체크아웃 처리에 실패했습니다.', 'danger');
    }
}

// 개별 출석 기록 리셋 (체크인 전 상태로 되돌림)
async function resetAttendance(attendanceId) {
    if (!confirm('이 출석 기록을 체크인 전 상태로 되돌리시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    try {
        await App.api.delete(`/attendance/${attendanceId}`);
        App.showNotification('출석 기록이 삭제되었습니다.', 'success');
        loadAttendanceRecords();
        loadUncheckedBookings();
    } catch (error) {
        App.err('출석 기록 리셋 실패:', error);
        App.showNotification('출석 기록 리셋에 실패했습니다.', 'danger');
    }
}

// 이용중인 출석 기록 모두 리셋 (체크인 전 상태로 되돌림)
async function resetIncompleteAttendances() {
    if (!confirm('체크인만 있고 체크아웃이 없는 모든 출석 기록을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    try {
        const response = await App.api.delete('/attendance/reset-incomplete');
        const deletedCount = response.deletedCount || 0;
        
        if (deletedCount > 0) {
            App.showNotification(`${deletedCount}개의 이용중 출석 기록이 삭제되었습니다.`, 'success');
        } else {
            App.showNotification('리셋할 출석 기록이 없습니다.', 'info');
        }
        
        // 목록 새로고침
        loadAttendanceRecords();
        loadUncheckedBookings();
    } catch (error) {
        App.err('이용중 출석 기록 리셋 실패:', error);
        var msg = '이용중 출석 기록 리셋에 실패했습니다.';
        if (error && error.response) {
            if (error.response.status === 403) msg = '이용중 출석 기록 리셋은 관리자만 사용할 수 있습니다.';
            else if (error.response.data && error.response.data.error) msg = error.response.data.error;
        }
        App.showNotification(msg, 'danger');
    }
}

// 전체 체크인 모달용 저장 (구역별 선택 후 실행 시 사용)
let _bulkCheckinUnchecked = [];
let _bulkCheckinToday = [];
/** 체크인 미처리 전체 목록 (레슨 카테고리 필터용) */
let _uncheckedBookingsAll = [];

/** 예약의 레슨 카테고리 키 반환 (필터 비교용: BASEBALL, YOUTH_BASEBALL, TRAINING, PILATES, RENTAL) */
function getUncheckedBookingCategoryKey(booking) {
    if (!booking) return null;
    if (booking.purpose === 'RENTAL') return 'RENTAL';
    if (booking.purpose === 'LESSON' && booking.lessonCategory) return booking.lessonCategory;
    return null;
}

/** 시설+코치+레슨 카테고리 필터 적용 후 테이블 다시 그리기 */
function filterUncheckedDisplay() {
    var catSelect = document.getElementById('unchecked-lesson-category-filter');
    var branchSelect = document.getElementById('unchecked-branch-filter');
    var coachSelect = document.getElementById('unchecked-coach-filter');
    var catValue = catSelect ? catSelect.value : '';
    var branchValue = branchSelect ? branchSelect.value : '';
    var coachValue = coachSelect ? coachSelect.value : '';
    var list = _uncheckedBookingsAll || [];
    if (catValue) list = list.filter(function(b) { return getUncheckedBookingCategoryKey(b) === catValue; });
    if (branchValue) list = list.filter(function(b) { return getBranchFromBooking(b) === branchValue; });
    if (coachValue) {
        var coachId = parseInt(coachValue, 10);
        list = list.filter(function(b) { return getCoachIdFromBooking(b) === coachId; });
    }
    renderUncheckedBookings(list);
}

// 체크인 미처리 예약 목록 로드
async function loadUncheckedBookings() {
    try {
        const bookings = await App.api.get('/attendance/unchecked-bookings');
        _uncheckedBookingsAll = Array.isArray(bookings) ? bookings : [];
        filterUncheckedDisplay();
    } catch (error) {
        App.err('체크인 미처리 예약 로드 실패:', error);
        const tbody = document.getElementById('unchecked-bookings-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">로드 실패</td></tr>';
        }
    }
}

// 전체 체크인 범위 선택 모달 열기 (origin: 'unchecked' | 'today' - 어느 버튼으로 열었는지)
async function openBulkCheckinModal(origin) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const [unchecked, todayBookings] = await Promise.all([
            App.api.get('/attendance/unchecked-bookings'),
            App.api.get(`/bookings?date=${todayStr}`)
        ]);
        _bulkCheckinUnchecked = unchecked && Array.isArray(unchecked) ? unchecked : [];
        const uniqueToday = [];
        const seen = new Set();
        if (todayBookings && Array.isArray(todayBookings)) {
            for (const b of todayBookings) {
                if (b && b.id && !seen.has(b.id)) {
                    seen.add(b.id);
                    uniqueToday.push(b);
                }
            }
        }
        _bulkCheckinToday = uniqueToday;
        const uncheckedIds = new Set((_bulkCheckinUnchecked || []).map(b => b.id).filter(Boolean));
        const todayUncheckedCount = _bulkCheckinToday.filter(b => uncheckedIds.has(b.id)).length;
        const countUnchecked = _bulkCheckinUnchecked.length;
        const countToday = todayUncheckedCount;
        const countAll = countUnchecked;
        document.querySelectorAll('.bulk-checkin-count[data-scope="unchecked"]').forEach(el => { el.textContent = countUnchecked + '건'; });
        document.querySelectorAll('.bulk-checkin-count[data-scope="today"]').forEach(el => { el.textContent = countToday + '건'; });
        document.querySelectorAll('.bulk-checkin-count[data-scope="all"]').forEach(el => { el.textContent = countAll + '건'; });
        // 열기 출처에 따라 라디오 옵션 순서: 클릭한 구역이 1번, 나머지는 고정 순서
        const order = (origin === 'today') ? ['today', 'unchecked', 'all'] : (origin === 'unchecked' ? ['unchecked', 'today', 'all'] : ['unchecked', 'today', 'all']);
        const container = document.querySelector('.bulk-checkin-options');
        if (container) {
            const options = Array.from(container.querySelectorAll('.bulk-checkin-option'));
            const byScope = {};
            options.forEach(function (el) { byScope[el.getAttribute('data-scope')] = el; });
            order.forEach(function (scope) {
                if (byScope[scope]) container.appendChild(byScope[scope]);
            });
        }
        const defaultScope = order[0];
        const radio = document.querySelector('input[name="bulk-checkin-scope"][value="' + defaultScope + '"]');
        if (radio) radio.checked = true;
        if (countUnchecked === 0 && countToday === 0) {
            App.showNotification('체크인할 예약이 없습니다.', 'info');
            return;
        }
        if (typeof App !== 'undefined' && App.Modal && App.Modal.open) {
            App.Modal.open('bulk-checkin-modal');
        } else {
            const overlay = document.getElementById('bulk-checkin-modal');
            if (overlay) overlay.classList.add('active');
        }
    } catch (error) {
        App.err('전체 체크인 모달 로드 실패:', error);
        App.showNotification('데이터를 불러오는 중 실패했습니다.', 'danger');
    }
}

// 선택한 구역으로 일괄 체크인 실행
async function confirmBulkCheckin() {
    const scope = document.querySelector('input[name="bulk-checkin-scope"]:checked');
    if (!scope || !scope.value) {
        App.showNotification('체크인할 구역을 선택해 주세요.', 'warning');
        return;
    }
    if (typeof App !== 'undefined' && App.Modal && App.Modal.close) {
        App.Modal.close('bulk-checkin-modal');
    } else {
        const overlay = document.getElementById('bulk-checkin-modal');
        if (overlay) overlay.classList.remove('active');
    }
    const uncheckedIds = new Set((_bulkCheckinUnchecked || []).map(b => b.id).filter(Boolean));
    let toProcess = [];
    if (scope.value === 'unchecked' || scope.value === 'all') {
        toProcess = _bulkCheckinUnchecked.slice();
    } else if (scope.value === 'today') {
        toProcess = _bulkCheckinToday.filter(b => uncheckedIds.has(b.id));
    }
    if (!toProcess.length) {
        App.showNotification('선택한 구역에 체크인할 예약이 없습니다.', 'info');
        return;
    }
    const confirmMsg = `선택한 구역 총 ${toProcess.length}건을 체크인 처리하시겠습니까?`;
    if (!confirm(confirmMsg)) return;
    try {
        const { successCount, failCount, deductedProducts } = await doBulkCheckin(toProcess);
        if (failCount === 0) {
            if (deductedProducts.length > 0) {
                showBulkDeductMessage(deductedProducts, successCount);
            } else {
                App.showNotification(`모든 예약(${successCount}개)이 체크인되었습니다.`, 'success');
            }
        } else {
            if (deductedProducts.length > 0) {
                showBulkDeductMessage(deductedProducts, successCount, failCount);
            } else {
                App.showNotification(`${successCount}개 체크인 완료, ${failCount}개 실패`, 'warning');
            }
        }
        loadTodayBookings();
        loadAttendanceRecords();
        loadUncheckedBookings();
    } catch (error) {
        App.err('일괄 체크인 실패:', error);
        App.showNotification('일괄 체크인 처리에 실패했습니다.', 'danger');
    }
}

// 공통: 예약 배열에 대해 일괄 체크인 후 결과 반환
async function doBulkCheckin(bookings) {
    let successCount = 0;
    let failCount = 0;
    const deductedProducts = [];
    for (const booking of bookings) {
        try {
            const response = await App.api.post(`/attendance/checkin`, {
                bookingId: booking.id,
                autoDeduct: true
            });
            if (response && response.productDeducted) {
                deductedProducts.push({
                    bookingId: booking.id,
                    memberName: booking.member?.name || booking.nonMemberName || '알 수 없음',
                    product: response.productDeducted
                });
            }
            successCount++;
        } catch (error) {
            App.err(`예약 ${booking.id} 체크인 실패:`, error);
            failCount++;
        }
    }
    return { successCount, failCount, deductedProducts };
}

function renderUncheckedBookings(bookings) {
    const tbody = document.getElementById('unchecked-bookings-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">체크인 미처리 예약이 없습니다.</td></tr>';
        return;
    }
    
    // 오늘 날짜 (시간 제외)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    tbody.innerHTML = bookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            App.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
        }
        
        const bookingDate = new Date(startTime);
        bookingDate.setHours(0, 0, 0, 0);
        
        // 예약 날짜가 오늘인지, 과거인지, 미래인지 확인
        const isToday = bookingDate.getTime() === today.getTime();
        const isPast = bookingDate.getTime() < today.getTime();
        const isFuture = bookingDate.getTime() > today.getTime();
        
        const dateStr = App.formatDate(booking.startTime);
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // 시설 이름 추출
        const facilityName = booking.facility?.name || booking.facilityName || '-';
        
        // 회원 이름 추출
        let memberName = '비회원';
        if (booking.member) {
            memberName = booking.member.name || booking.memberName || '비회원';
        } else if (booking.nonMemberName) {
            memberName = booking.nonMemberName;
        } else if (booking.nonMemberPhone) {
            memberName = booking.nonMemberPhone;
        }
        
        // 상태 추출
        const status = booking.status || 'PENDING';
        
        // 비회원·체험은 자동 체크인 → 체크인 버튼 숨김
        const isNonMemberOrTrial = !booking.member || (booking.nonMemberName && String(booking.nonMemberName).trim() !== '') || (booking.member && booking.member.name && String(booking.member.name).includes('체험'));
        const canCheckin = (status === 'CONFIRMED' || status === 'COMPLETED') && !isNonMemberOrTrial;
        const showCheckinButton = canCheckin && (isToday || isPast);
        
        // 디버깅 로그 (필요시 주석 해제)
        // if (booking.id === 1 || booking.id === 2) {
        //     App.log('예약 체크인 가능 여부:', {
        //         bookingId: booking.id,
        //         bookingDate: bookingDate.toISOString().split('T')[0],
        //         today: today.toISOString().split('T')[0],
        //         isToday, isPast, isFuture,
        //         status, canCheckin, showCheckinButton
        //     });
        // }
        
        // 레슨 카테고리 추출
        let lessonCategoryHtml = '-';
        if (booking.purpose === 'LESSON' && booking.lessonCategory) {
            const text = App.LessonCategory ? App.LessonCategory.getText(booking.lessonCategory) : booking.lessonCategory;
            const badge = getAttendanceLessonCategoryBadge(booking.lessonCategory, 'LESSON');
            lessonCategoryHtml = '<span class="badge badge-' + badge + '">' + App.escapeHtml(text) + '</span>';
        } else if (booking.purpose === 'RENTAL') {
            lessonCategoryHtml = '<span class="badge badge-rental">대관</span>';
        }
        
        const coachStyle = getAttendanceCoachColorStyle(booking.coach);
        const coachNameRaw = (booking.coach && booking.coach.name) ? booking.coach.name : '';
        const coachHtml = coachNameRaw ? '<span style="' + coachStyle + '">' + App.escapeHtml(coachNameRaw) + '</span>' : '-';
        
        const branchClass = getAttendanceFacilityBranchClass(facilityName);
        const facilityHtml = branchClass ? '<span class="branch-label ' + branchClass + '">' + App.escapeHtml(facilityName) + '</span>' : App.escapeHtml(facilityName);
        
        const memberHtml = buildMemberCellHtml(booking.member ? booking.member.id : null, memberName);
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${memberHtml}</td>
                <td>${coachHtml}</td>
                <td>${lessonCategoryHtml}</td>
                <td>${facilityHtml}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${getBookingStatusBadge(status)}">${getBookingStatusText(status)}</span></td>
                <td>
                    ${showCheckinButton ? `
                        <button class="btn btn-sm btn-primary" onclick="openCheckinModal(${booking.id})">체크인</button>
                    ` : isFuture ? '<span style="color: var(--text-muted); font-size: 12px;">예약 당일 체크인 가능</span>' : (isNonMemberOrTrial ? '<span style="color: var(--text-muted); font-size: 12px;">자동 체크인</span>' : '')}
                </td>
            </tr>
        `;
    }).join('');
}
