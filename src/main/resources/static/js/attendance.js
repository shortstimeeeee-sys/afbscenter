// 출석/이용 기록 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadTodayBookings();
    loadAttendanceRecords();
});

async function loadTodayBookings() {
    const dateInput = document.getElementById('attendance-date');
    let date = dateInput ? dateInput.value : null;
    
    // 날짜가 없으면 오늘 날짜로 설정
    if (!date) {
        const today = new Date();
        date = today.toISOString().split('T')[0];
        if (dateInput) {
            dateInput.value = date;
        }
    }
    
    try {
        const bookings = await App.api.get(`/bookings?date=${date}`);
        renderTodayBookings(bookings);
    } catch (error) {
        console.error('오늘 예약 로드 실패:', error);
        App.showNotification('예약 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

function renderTodayBookings(bookings) {
    const tbody = document.getElementById('today-bookings-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        const startTime = new Date(booking.startTime);
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
        
        // 상태 추출
        const status = booking.status || 'PENDING';
        
        return `
            <tr>
                <td>${timeStr}</td>
                <td>${facilityName}</td>
                <td>${memberName}</td>
                <td>${booking.participants || 1}명</td>
                <td><span class="badge badge-${getBookingStatusBadge(status)}">${getBookingStatusText(status)}</span></td>
                <td>
                    ${status === 'CONFIRMED' ? `
                        <button class="btn btn-sm btn-primary" onclick="openCheckinModal(${booking.id})">체크인</button>
                    ` : ''}
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
        
        const records = await App.api.get(`/attendance?${params}`);
        renderAttendanceRecords(records);
    } catch (error) {
        console.error('출석 기록 로드 실패:', error);
    }
}

function renderAttendanceRecords(records) {
    const tbody = document.getElementById('attendance-records-body');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">출석 기록이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = records.map(record => {
        const checkIn = record.checkInTime ? new Date(record.checkInTime) : null;
        const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
        const duration = checkIn && checkOut ? 
            Math.round((checkOut - checkIn) / (1000 * 60)) + '분' : '-';
        
        return `
            <tr>
                <td>${App.formatDate(record.date)}</td>
                <td>${record.memberName}</td>
                <td>${record.facilityName}</td>
                <td>${checkIn ? checkIn.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>${checkOut ? checkOut.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>${duration}</td>
                <td><span class="badge badge-${record.status === 'COMPLETED' ? 'success' : 'warning'}">${record.status === 'COMPLETED' ? '완료' : '이용중'}</span></td>
            </tr>
        `;
    }).join('');
}
