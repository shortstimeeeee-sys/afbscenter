// 공지/메시지 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadAnnouncements();
    loadMessages();
});

async function loadAnnouncements() {
    try {
        const announcements = await App.api.get('/announcements');
        renderAnnouncementsTable(announcements);
    } catch (error) {
        console.error('공지 목록 로드 실패:', error);
    }
}

function renderAnnouncementsTable(announcements) {
    const tbody = document.getElementById('announcements-table-body');
    
    if (!announcements || announcements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">공지가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = announcements.map(announcement => `
        <tr>
            <td>${announcement.title}</td>
            <td>${App.formatDate(announcement.createdAt)}</td>
            <td>${announcement.startDate ? App.formatDate(announcement.startDate) : '-'} ~ ${announcement.endDate ? App.formatDate(announcement.endDate) : '-'}</td>
            <td><span class="badge badge-${announcement.isActive ? 'success' : 'warning'}">${announcement.isActive ? '노출중' : '비노출'}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editAnnouncement(${announcement.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement(${announcement.id})">삭제</button>
            </td>
        </tr>
    `).join('');
}

async function loadMessages() {
    try {
        const messages = await App.api.get('/messages');
        renderMessagesTable(messages);
    } catch (error) {
        console.error('메시지 목록 로드 실패:', error);
    }
}

function renderMessagesTable(messages) {
    const tbody = document.getElementById('messages-table-body');
    
    if (!messages || messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">발송된 메시지가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = messages.map(message => `
        <tr>
            <td>${App.formatDateTime(message.sentAt)}</td>
            <td>${getMessageTargetText(message.target)}</td>
            <td>${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}</td>
            <td><span class="badge badge-${message.status === 'SENT' ? 'success' : 'warning'}">${message.status === 'SENT' ? '발송완료' : '대기'}</span></td>
        </tr>
    `).join('');
}

function getMessageTargetText(target) {
    const map = {
        'ALL': '전체',
        'GRADE': '등급별',
        'BOOKING': '예약자'
    };
    return map[target] || target;
}

function openAnnouncementModal(id = null) {
    const modal = document.getElementById('announcement-modal');
    const form = document.getElementById('announcement-form');
    
    if (id) {
        loadAnnouncementData(id);
    } else {
        form.reset();
    }
    
    App.Modal.open('announcement-modal');
}

async function loadAnnouncementData(id) {
    try {
        const announcement = await App.api.get(`/announcements/${id}`);
        document.getElementById('announcement-title').value = announcement.title;
        document.getElementById('announcement-content').value = announcement.content;
        document.getElementById('announcement-start-date').value = announcement.startDate || '';
        document.getElementById('announcement-end-date').value = announcement.endDate || '';
    } catch (error) {
        App.showNotification('공지 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const content = document.getElementById('announcement-content').value.trim();
    const startDateInput = document.getElementById('announcement-start-date').value;
    const endDateInput = document.getElementById('announcement-end-date').value;
    
    const data = {
        title: title,
        content: content,
        startDate: startDateInput && startDateInput.trim() !== '' ? startDateInput.trim() : null,
        endDate: endDateInput && endDateInput.trim() !== '' ? endDateInput.trim() : null
    };
    
    try {
        const response = await App.api.post('/announcements', data);
        App.showNotification('공지가 등록되었습니다.', 'success');
        App.Modal.close('announcement-modal');
        loadAnnouncements();
    } catch (error) {
        console.error('공지 저장 오류:', error);
        console.error('오류 상세:', error.response);
        let errorMessage = '저장에 실패했습니다.';
        if (error.response && error.response.data) {
            const errorData = error.response.data;
            console.error('오류 데이터 전체:', JSON.stringify(errorData, null, 2));
            errorMessage = errorData.error || errorData.message || errorMessage;
            if (errorData.cause) {
                console.error('오류 원인:', errorData.cause);
                errorMessage += ' - ' + errorData.cause;
            }
            if (errorData.stackTrace) {
                console.error('스택 트레이스:', errorData.stackTrace);
            }
            if (errorData.errorClass) {
                console.error('오류 클래스:', errorData.errorClass);
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        App.showNotification(errorMessage, 'danger');
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/announcements/${id}`);
        App.showNotification('공지가 삭제되었습니다.', 'success');
        loadAnnouncements();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

function openMessageModal() {
    App.Modal.open('message-modal');
}

async function sendMessage() {
    const data = {
        target: document.getElementById('message-target').value,
        content: document.getElementById('message-content').value
    };
    
    try {
        await App.api.post('/messages', data);
        App.showNotification('메시지가 발송되었습니다.', 'success');
        App.Modal.close('message-modal');
        loadMessages();
    } catch (error) {
        App.showNotification('메시지 발송에 실패했습니다.', 'danger');
    }
}

function editAnnouncement(id) {
    openAnnouncementModal(id);
}
