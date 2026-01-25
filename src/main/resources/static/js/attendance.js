// 출석/이용 기록 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadTodayBookings();
    loadAttendanceRecords();
    loadUncheckedBookings();
});

async function loadTodayBookings() {
    // 오늘 날짜로 고정
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    
    try {
        const bookings = await App.api.get(`/bookings?date=${date}`);
        console.log('예약 목록 조회 결과:', bookings?.length || 0, '건', bookings);
        // 대관 예약 확인
        const rentalBookings = bookings?.filter(b => b.purpose === 'RENTAL') || [];
        if (rentalBookings.length > 0) {
            console.log('대관 예약:', rentalBookings.length, '건', rentalBookings);
        }
        renderTodayBookings(bookings);
    } catch (error) {
        console.error('오늘 예약 로드 실패:', error);
        App.showNotification('예약 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

function renderTodayBookings(bookings) {
    const tbody = document.getElementById('today-bookings-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    // 중복 제거: 같은 예약 ID는 하나만 표시 (JOIN FETCH로 인한 중복 방지)
    const uniqueBookings = [];
    const seenIds = new Set();
    
    for (const booking of bookings) {
        if (!booking.id) {
            console.warn('예약 ID가 없음:', booking);
            continue;
        }
        
        // 예약 ID로 중복 체크
        if (seenIds.has(booking.id)) {
            console.warn('중복 예약 ID 발견 (같은 예약이 여러 번 반환됨):', booking.id, {
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
        console.warn(`중복 제거: 원본 ${bookings.length}건 → ${uniqueBookings.length}건 (JOIN FETCH로 인한 중복)`);
    }
    
    // 오늘 날짜 (시간 제외)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    tbody.innerHTML = uniqueBookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            console.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
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
        
        // 레슨 카테고리 추출
        let lessonCategoryDisplay = '-';
        if (booking.purpose === 'LESSON' && booking.lessonCategory) {
            const lessonCategory = booking.lessonCategory ? (App.LessonCategory ? App.LessonCategory.getText(booking.lessonCategory) : booking.lessonCategory) : '-';
            lessonCategoryDisplay = lessonCategory;
        } else if (booking.purpose === 'RENTAL') {
            lessonCategoryDisplay = '대관';
        }
        
        // 상태 추출
        const status = booking.status || 'PENDING';
        
        // 체크인 버튼: 상태가 CONFIRMED 또는 COMPLETED이고, 오늘 날짜이거나 과거 날짜인 경우 표시
        // 미래 날짜는 체크인 불가
        const canCheckin = (status === 'CONFIRMED' || status === 'COMPLETED');
        const showCheckinButton = canCheckin && (isToday || isPast);
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${facilityName}</td>
                <td>${memberName}</td>
                <td>${lessonCategoryDisplay}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${getBookingStatusBadge(status)}">${getBookingStatusText(status)}</span></td>
                <td>
                    ${showCheckinButton ? `
                        <button class="btn btn-sm btn-primary" onclick="openCheckinModal(${booking.id})">체크인</button>
                    ` : isFuture ? '<span style="color: var(--text-muted); font-size: 12px;">예약 당일 체크인 가능</span>' : ''}
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
        console.error('체크인 모달 오류:', error);
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function processCheckin() {
    const bookingId = document.getElementById('checkin-booking-id').value;
    const autoDeduct = document.getElementById('checkin-auto-deduct').checked;
    
    try {
        await App.api.post(`/attendance/checkin`, {
            bookingId: bookingId,
            autoDeduct: autoDeduct
        });
        App.showNotification('체크인이 완료되었습니다.', 'success');
        App.Modal.close('checkin-modal');
        loadTodayBookings();
        loadAttendanceRecords();
        loadUncheckedBookings();
    } catch (error) {
        App.showNotification('체크인 처리에 실패했습니다.', 'danger');
    }
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
        renderAttendanceRecords(records);
    } catch (error) {
        console.error('출석 기록 로드 실패:', error);
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
        
        return `
            <tr>
                <td>${App.formatDate(record.date)}</td>
                <td>${record.memberName}</td>
                <td>${record.facilityName}</td>
                <td>${checkIn ? checkIn.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>${checkOut ? checkOut.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
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
        console.error('체크아웃 처리 실패:', error);
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
        console.error('출석 기록 리셋 실패:', error);
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
        console.error('이용중 출석 기록 리셋 실패:', error);
        App.showNotification('이용중 출석 기록 리셋에 실패했습니다.', 'danger');
    }
}

// 체크인 미처리 예약 목록 로드
async function loadUncheckedBookings() {
    try {
        const bookings = await App.api.get('/attendance/unchecked-bookings');
        renderUncheckedBookings(bookings);
    } catch (error) {
        console.error('체크인 미처리 예약 로드 실패:', error);
        const tbody = document.getElementById('unchecked-bookings-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">로드 실패</td></tr>';
        }
    }
}

// 전체 체크인 완료 (한 번에 처리) - 오늘 날짜 예약만 체크인
async function checkinAllUncheckedBookings() {
    try {
        // 체크인 미처리 예약 목록 가져오기
        const bookings = await App.api.get('/attendance/unchecked-bookings');
        
        if (!bookings || bookings.length === 0) {
            App.showNotification('체크인할 예약이 없습니다.', 'info');
            return;
        }
        
        // 오늘 날짜 (시간 제외)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 오늘 날짜 예약만 필터링
        const todayBookings = bookings.filter(booking => {
            if (!booking.startTime) return false;
            const bookingDate = new Date(booking.startTime);
            bookingDate.setHours(0, 0, 0, 0);
            return bookingDate.getTime() === today.getTime();
        });
        
        if (todayBookings.length === 0) {
            App.showNotification('오늘 날짜 예약이 없습니다. 오늘 날짜 예약만 체크인할 수 있습니다.', 'info');
            return;
        }
        
        const skippedCount = bookings.length - todayBookings.length;
        let confirmMessage = `총 ${todayBookings.length}개의 오늘 날짜 예약을 체크인 처리하시겠습니까?`;
        if (skippedCount > 0) {
            confirmMessage += `\n(미래 날짜 예약 ${skippedCount}개는 제외됩니다)`;
        }
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // 오늘 날짜 예약만 체크인 처리
        let successCount = 0;
        let failCount = 0;
        
        for (const booking of todayBookings) {
            try {
                const response = await App.api.post(`/attendance/checkin`, {
                    bookingId: booking.id,
                    autoDeduct: true
                });
                console.log(`예약 ${booking.id} 체크인 성공:`, response);
                successCount++;
            } catch (error) {
                console.error(`예약 ${booking.id} 체크인 실패:`, {
                    bookingId: booking.id,
                    bookingInfo: {
                        member: booking.member?.name || booking.nonMemberName || '알 수 없음',
                        facility: booking.facility?.name || '알 수 없음',
                        startTime: booking.startTime,
                        status: booking.status
                    },
                    error: error.message || error,
                    errorDetails: error.response || error
                });
                failCount++;
            }
        }
        
        // 결과 알림
        if (failCount === 0) {
            App.showNotification(`모든 예약(${successCount}개)이 체크인되었습니다.`, 'success');
        } else {
            App.showNotification(`${successCount}개 체크인 완료, ${failCount}개 실패`, 'warning');
        }
        
        // 목록 새로고침
        loadTodayBookings();
        loadAttendanceRecords();
        loadUncheckedBookings();
    } catch (error) {
        console.error('전체 체크인 실패:', error);
        App.showNotification('전체 체크인 처리에 실패했습니다.', 'danger');
    }
}

function renderUncheckedBookings(bookings) {
    const tbody = document.getElementById('unchecked-bookings-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">체크인 미처리 예약이 없습니다.</td></tr>';
        return;
    }
    
    // 오늘 날짜 (시간 제외)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    tbody.innerHTML = bookings.map(booking => {
        if (!booking.startTime) {
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 정보 없음</td></tr>';
        }
        
        const startTime = new Date(booking.startTime);
        if (isNaN(startTime.getTime())) {
            console.warn('유효하지 않은 예약 시간:', booking.startTime);
            return '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약 시간 오류</td></tr>';
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
        
        // 체크인 버튼: 상태가 CONFIRMED 또는 COMPLETED이고, 오늘 날짜이거나 과거 날짜인 경우 표시
        // 미래 날짜는 체크인 불가
        const canCheckin = (status === 'CONFIRMED' || status === 'COMPLETED');
        const showCheckinButton = canCheckin && (isToday || isPast);
        
        // 디버깅 로그 (필요시 주석 해제)
        // if (booking.id === 1 || booking.id === 2) {
        //     console.log('예약 체크인 가능 여부:', {
        //         bookingId: booking.id,
        //         bookingDate: bookingDate.toISOString().split('T')[0],
        //         today: today.toISOString().split('T')[0],
        //         isToday, isPast, isFuture,
        //         status, canCheckin, showCheckinButton
        //     });
        // }
        
        // 레슨 카테고리 추출
        let lessonCategoryDisplay = '-';
        if (booking.purpose === 'LESSON' && booking.lessonCategory) {
            const lessonCategory = booking.lessonCategory ? (App.LessonCategory ? App.LessonCategory.getText(booking.lessonCategory) : booking.lessonCategory) : '-';
            lessonCategoryDisplay = lessonCategory;
        } else if (booking.purpose === 'RENTAL') {
            lessonCategoryDisplay = '대관';
        }
        
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${timeStr}</td>
                <td>${facilityName}</td>
                <td>${memberName}</td>
                <td>${lessonCategoryDisplay}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${getBookingStatusBadge(status)}">${getBookingStatusText(status)}</span></td>
                <td>
                    ${showCheckinButton ? `
                        <button class="btn btn-sm btn-primary" onclick="openCheckinModal(${booking.id})">체크인</button>
                    ` : isFuture ? '<span style="color: var(--text-muted); font-size: 12px;">예약 당일 체크인 가능</span>' : ''}
                </td>
            </tr>
        `;
    }).join('');
}
