// 공지/메시지 페이지 JavaScript

function syncAnnouncementHideFromStaffCheckbox() {
    var vis = document.getElementById('announcement-visible-to-members');
    var hide = document.getElementById('announcement-hide-from-staff-feed');
    if (!hide) return;
    if (!vis || !vis.checked) {
        hide.checked = false;
        hide.disabled = true;
    } else {
        hide.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var visMb = document.getElementById('announcement-visible-to-members');
    if (visMb) {
        visMb.addEventListener('change', syncAnnouncementHideFromStaffCheckbox);
    }
    Promise.all([
        loadMembershipDuesHandover(),
        loadAnnouncements(),
        loadMessages(),
        initDeskInboxSection()
    ]).catch(function() {});
    var deskThreadPin = document.getElementById('desk-thread-unlock-pin');
    if (deskThreadPin) {
        deskThreadPin.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') submitDeskThreadUnlock();
        });
    }
    if (window.location.hash === '#desk-inbox-card') {
        setTimeout(function () {
            var el = document.getElementById('desk-inbox-card');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
    }
    if (window.location.hash === '#mb-messages-card') {
        setTimeout(function () {
            var el = document.getElementById('mb-messages-card');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
    }
});

async function loadMembershipDuesHandover() {
    try {
        const settings = await App.api.get('/settings');
        document.getElementById('membership-dues-notice').value = settings.membershipDuesAccountNotice || '';
        document.getElementById('membership-dues-bell').checked = settings.showMembershipDuesInBell !== false;
    } catch (error) {
        App.err('회비 입금 전달 사항 로드 실패:', error);
    }
}

async function saveMembershipDuesHandover() {
    const notice = document.getElementById('membership-dues-notice').value.trim();
    const showBell = document.getElementById('membership-dues-bell').checked;
    try {
        await App.api.put('/settings', {
            membershipDuesAccountNotice: notice || null,
            showMembershipDuesInBell: showBell
        });
        App.showNotification('전달 사항이 저장되었습니다.', 'success');
        if (typeof App.updateNotificationBadge === 'function') {
            App.updateNotificationBadge();
        }
        loadAnnouncements();
    } catch (error) {
        App.err('전달 사항 저장 실패:', error);
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

async function loadAnnouncements() {
    try {
        const announcements = await App.api.get('/announcements');
        const tableRows = (announcements || []).filter(function(a) {
            return a && a.id !== -1 && a.source !== 'SETTINGS_MEMBERSHIP_DUES';
        });
        renderAnnouncementsTable(tableRows);
    } catch (error) {
        App.err('공지 목록 로드 실패:', error);
    }
}

function renderAnnouncementsTable(announcements) {
    const tbody = document.getElementById('announcements-table-body');
    
    if (!announcements || announcements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">공지가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = announcements.map(announcement => `
        <tr>
            <td>${App.escapeHtml(announcement.title || '')}</td>
            <td>${App.formatDate(announcement.createdAt)}</td>
            <td>${announcement.startDate ? App.formatDate(announcement.startDate) : '-'} ~ ${announcement.endDate ? App.formatDate(announcement.endDate) : '-'}</td>
            <td><span class="badge badge-${announcement.isActive ? 'success' : 'warning'}">${announcement.isActive ? '노출중' : '비노출'}</span></td>
            <td><span class="badge badge-${announcement.visibleToMembers ? 'info' : 'secondary'}">${announcement.visibleToMembers ? '예' : '아니오'}</span></td>
            <td><span class="badge badge-${announcement.hideFromStaffFeed ? 'info' : 'secondary'}">${announcement.hideFromStaffFeed ? '예' : '아니오'}</span></td>
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
        App.err('메시지 목록 로드 실패:', error);
    }
}

function renderMessagesTable(messages) {
    const tbody = document.getElementById('messages-table-body');
    
    if (!messages || messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">발송된 메시지가 없습니다.</td></tr>';
        mbSyncSmsBellSeenFromMessages([]);
        return;
    }
    
    tbody.innerHTML = messages.map(message => `
        <tr>
            <td>${App.formatDateTime(message.sentAt)}</td>
            <td>${App.escapeHtml(message.recipient || getMessageTargetText(message.target) || '')}</td>
            <td>${App.escapeHtml((message.content || '').substring(0, 50))}${(message.content || '').length > 50 ? '...' : ''}</td>
            <td><span class="badge badge-${message.status === 'SENT' ? 'success' : 'warning'}">${message.status === 'SENT' ? '발송완료' : '대기'}</span></td>
        </tr>
    `).join('');
    mbSyncSmsBellSeenFromMessages(messages);
}

/** 메시지 발송 목록을 본 것으로 처리 → 종 배지에서 SMS 신규 건 제거 */
function mbSyncSmsBellSeenFromMessages(messages) {
    var maxId = 0;
    (messages || []).forEach(function (m) {
        if (m && m.id != null && Number(m.id) > maxId) maxId = Number(m.id);
    });
    try {
        if (maxId > 0) {
            localStorage.setItem('staff_sms_last_seen_message_id', String(maxId));
        }
        if (typeof App !== 'undefined' && App && typeof App.updateNotificationBadge === 'function') {
            App.updateNotificationBadge();
        }
    } catch (e) {}
}

function getMessageTargetText(target) {
    const map = {
        'ALL': '전체',
        'GRADE': '등급별',
        'BOOKING': '예약자',
        'MEMBER': '회원 개인'
    };
    return map[target] || target;
}

/** API의 LocalDate → input[type=date] 값 (문자열·배열 형태 모두 대응) */
function announcementDateToInputValue(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') {
        return v.length >= 10 ? v.substring(0, 10) : v;
    }
    if (Array.isArray(v) && v.length >= 3) {
        var y = v[0];
        var m = Number(v[1]);
        var d = Number(v[2]);
        return (
            String(y) +
            '-' +
            (m < 10 ? '0' : '') +
            m +
            '-' +
            (d < 10 ? '0' : '') +
            d
        );
    }
    return '';
}

async function openAnnouncementModal(id = null) {
    const form = document.getElementById('announcement-form');
    if (form) {
        form.dataset.editId = id != null && id !== '' ? String(id) : '';
    }

    if (id) {
        const ok = await loadAnnouncementData(id);
        if (!ok) return;
    } else {
        form.reset();
        var vis = document.getElementById('announcement-visible-to-members');
        if (vis) vis.checked = false;
        var hide = document.getElementById('announcement-hide-from-staff-feed');
        if (hide) hide.checked = false;
        syncAnnouncementHideFromStaffCheckbox();
    }

    App.Modal.open('announcement-modal');
}

async function loadAnnouncementData(id) {
    try {
        const announcement = await App.api.get(`/announcements/${id}`);
        document.getElementById('announcement-title').value = announcement.title || '';
        document.getElementById('announcement-content').value = announcement.content || '';
        document.getElementById('announcement-start-date').value = announcementDateToInputValue(
            announcement.startDate
        );
        document.getElementById('announcement-end-date').value = announcementDateToInputValue(
            announcement.endDate
        );
        var vis = document.getElementById('announcement-visible-to-members');
        if (vis) vis.checked = !!announcement.visibleToMembers;
        var hide = document.getElementById('announcement-hide-from-staff-feed');
        if (hide) hide.checked = !!announcement.hideFromStaffFeed;
        syncAnnouncementHideFromStaffCheckbox();
        return true;
    } catch (error) {
        App.showNotification('공지 정보를 불러오는데 실패했습니다.', 'danger');
        return false;
    }
}

async function saveAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const content = document.getElementById('announcement-content').value.trim();
    const startDateInput = document.getElementById('announcement-start-date').value;
    const endDateInput = document.getElementById('announcement-end-date').value;
    const visEl = document.getElementById('announcement-visible-to-members');
    const visibleToMembers = visEl ? !!visEl.checked : false;
    const hideEl = document.getElementById('announcement-hide-from-staff-feed');
    const hideFromStaffFeed = visibleToMembers && hideEl ? !!hideEl.checked : false;
    
    const data = {
        title: title,
        content: content,
        startDate: startDateInput && startDateInput.trim() !== '' ? startDateInput.trim() : null,
        endDate: endDateInput && endDateInput.trim() !== '' ? endDateInput.trim() : null,
        visibleToMembers: visibleToMembers,
        hideFromStaffFeed: hideFromStaffFeed
    };
    
    const form = document.getElementById('announcement-form');
    const editId = form && form.dataset.editId ? form.dataset.editId.trim() : '';
    
    try {
        if (editId) {
            await App.api.put('/announcements/' + encodeURIComponent(editId), data);
            App.showNotification('공지가 수정되었습니다.', 'success');
        } else {
            await App.api.post('/announcements', data);
            App.showNotification('공지가 등록되었습니다.', 'success');
        }
        App.Modal.close('announcement-modal');
        if (form) form.dataset.editId = '';
        loadAnnouncements();
        if (typeof App.updateNotificationBadge === 'function') {
            App.updateNotificationBadge();
        }
    } catch (error) {
        App.err('공지 저장 오류:', error);
        App.err('오류 상세:', error.response);
        let errorMessage = '저장에 실패했습니다.';
        if (error.response && error.response.data) {
            const errorData = error.response.data;
            App.err('오류 데이터 전체:', JSON.stringify(errorData, null, 2));
            errorMessage = errorData.error || errorData.message || errorMessage;
            if (errorData.cause) {
                App.err('오류 원인:', errorData.cause);
                errorMessage += ' - ' + errorData.cause;
            }
            if (errorData.stackTrace) {
                App.err('스택 트레이스:', errorData.stackTrace);
            }
            if (errorData.errorClass) {
                App.err('오류 클래스:', errorData.errorClass);
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

function onMessageTargetChange() {
    var sel = document.getElementById('message-target');
    var grpMn = document.getElementById('message-member-number-group');
    var grpGr = document.getElementById('message-grade-group');
    var inp = document.getElementById('message-member-number');
    if (!sel) return;
    var v = sel.value;
    var isMember = v === 'MEMBER';
    var isGrade = v === 'GRADE';
    if (grpMn) grpMn.style.display = isMember ? 'block' : 'none';
    if (grpGr) grpGr.style.display = isGrade ? 'block' : 'none';
    if (inp && !isMember) inp.value = '';
}

function openMessageModal() {
    var mn = document.getElementById('message-member-number');
    if (mn) mn.value = '';
    var gr = document.getElementById('message-grade');
    if (gr) gr.value = 'SOCIAL';
    var sel = document.getElementById('message-target');
    if (sel) sel.value = 'ALL';
    onMessageTargetChange();
    App.Modal.open('message-modal');
}

async function sendMessage() {
    var target = document.getElementById('message-target').value;
    var content = document.getElementById('message-content').value;
    var data = {
        target: target,
        content: content
    };
    if (target === 'MEMBER') {
        var mn = document.getElementById('message-member-number');
        var num = mn && mn.value ? mn.value.trim() : '';
        if (!num) {
            App.showNotification('회원번호를 입력해 주세요.', 'warning');
            return;
        }
        data.memberNumber = num;
    }
    if (target === 'GRADE') {
        var gEl = document.getElementById('message-grade');
        var gv = gEl && gEl.value ? gEl.value.trim() : '';
        if (!gv) {
            App.showNotification('등급을 선택해 주세요.', 'warning');
            return;
        }
        data.grade = gv;
    }

    try {
        await App.api.post('/messages', data);
        App.showNotification('메시지가 발송되었습니다.', 'success');
        App.Modal.close('message-modal');
        loadMessages();
    } catch (error) {
        var msg = '메시지 발송에 실패했습니다.';
        if (error.response && error.response.data) {
            var d = error.response.data;
            if (typeof d === 'object' && d.error) msg = d.error;
            else if (typeof d === 'string') msg = d;
        }
        App.showNotification(msg, 'danger');
    }
}

async function editAnnouncement(id) {
    await openAnnouncementModal(id);
}

var deskThreadMemberId = null;

/** 회원 쪽지 스레드 API용 — sessionStorage deskThreadUnlock_{memberId} */
function deskThreadOpts(memberId) {
    if (memberId == null || memberId === '') return undefined;
    return { deskThreadUnlockMemberId: Number(memberId) };
}

function handleThreadLockError(e, memberId) {
    var st = e.response && e.response.status;
    var d = e.response && e.response.data;
    if (st === 403 && d && typeof d === 'object' && d.threadLockRequired) {
        try {
            sessionStorage.removeItem('deskThreadUnlock_' + memberId);
        } catch (err) {}
        var gate = document.getElementById('desk-thread-lock-gate');
        var main = document.getElementById('desk-thread-main-area');
        if (gate) gate.style.display = 'block';
        if (main) main.style.display = 'none';
        App.showNotification('이 대화 잠금을 다시 입력해 주세요.', 'warning');
        return true;
    }
    return false;
}

async function initDeskInboxSection() {
    loadDeskInbox();
}

async function submitDeskThreadUnlock() {
    if (!deskThreadMemberId) return;
    var pinEl = document.getElementById('desk-thread-unlock-pin');
    var pin = pinEl && pinEl.value ? pinEl.value : '';
    try {
        var u = await App.api.post('/member-desk-messages/member/' + encodeURIComponent(deskThreadMemberId) + '/unlock', {
            pin: pin
        });
        if (u && u.deskThreadUnlockToken) {
            sessionStorage.setItem('deskThreadUnlock_' + deskThreadMemberId, u.deskThreadUnlockToken);
        }
        if (pinEl) pinEl.value = '';
        await loadDeskThreadContent(deskThreadMemberId);
    } catch (e) {
        var msg = 'PIN이 올바르지 않습니다.';
        if (e.response && e.response.data && typeof e.response.data === 'object' && e.response.data.error) {
            msg = e.response.data.error;
        }
        App.showNotification(msg, 'danger');
    }
}

async function saveDeskThreadLock() {
    if (!deskThreadMemberId) return;
    var pinEl = document.getElementById('desk-thread-lock-pin-set');
    var raw = pinEl && pinEl.value ? pinEl.value.trim() : '';
    try {
        await App.api.put(
            '/member-desk-messages/member/' + encodeURIComponent(deskThreadMemberId) + '/thread-lock',
            { pin: raw },
            deskThreadOpts(deskThreadMemberId)
        );
        try {
            sessionStorage.removeItem('deskThreadUnlock_' + deskThreadMemberId);
        } catch (e2) {}
        if (pinEl) pinEl.value = '';
        App.showNotification(raw ? '이 대화 잠금이 저장되었습니다.' : '이 대화 잠금이 해제되었습니다.', 'success');
        await loadDeskThreadContent(deskThreadMemberId);
        loadDeskInbox();
    } catch (e) {
        if (handleThreadLockError(e, deskThreadMemberId)) return;
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

async function openDeskThreadByMemberNumber() {
    var input = document.getElementById('desk-lookup-member-number');
    var raw = input && input.value ? input.value.trim() : '';
    if (!raw) {
        App.showNotification('회원번호를 입력해 주세요.', 'warning');
        return;
    }
    try {
        var data = await App.api.get('/member-desk-messages/lookup?memberNumber=' + encodeURIComponent(raw));
        if (!data || data.memberId == null) {
            App.showNotification('회원을 찾을 수 없습니다.', 'danger');
            return;
        }
        await openDeskThreadModal(data.memberId);
        if (input) input.value = '';
    } catch (e) {
        var msg = '등록된 회원번호가 아니거나 조회에 실패했습니다.';
        if (e.response && e.response.data && typeof e.response.data === 'object' && e.response.data.error) {
            msg = e.response.data.error;
        }
        App.showNotification(msg, 'danger');
    }
}

async function loadDeskInbox() {
    try {
        const data = await App.api.get('/member-desk-messages/inbox');
        const threads = data.threads || [];
        const total = data.totalUnreadFromMembers != null ? data.totalUnreadFromMembers : 0;
        const badge = document.getElementById('desk-inbox-badge');
        if (badge) {
            if (total > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = total > 99 ? '99+' : String(total);
            } else {
                badge.style.display = 'none';
            }
        }
        const tbody = document.getElementById('desk-inbox-table-body');
        if (!tbody) return;
        if (!threads.length) {
            tbody.innerHTML =
                '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">쪽지가 없습니다.</td></tr>';
            if (typeof App.updateNotificationBadge === 'function') App.updateNotificationBadge();
            return;
        }
        tbody.innerHTML = threads
            .map(function (t) {
                var tag =
                    t.lastFromMember === true
                        ? '<span style="font-size:10px;opacity:0.8;margin-right:4px;">[회원]</span>'
                        : '<span style="font-size:10px;opacity:0.8;margin-right:4px;">[데스크]</span>';
                var lockCell =
                    t.threadLocked === true
                        ? '<span title="이 대화에 잠금됨">🔒</span>'
                        : '—';
                return (
                    '<tr>' +
                    '<td>' +
                    App.escapeHtml(t.memberName || '') +
                    '</td>' +
                    '<td>' +
                    App.escapeHtml(t.memberNumber || '') +
                    '</td>' +
                    '<td style="text-align:center;">' +
                    lockCell +
                    '</td>' +
                    '<td>' +
                    tag +
                    App.escapeHtml(t.lastMessagePreview || '') +
                    '</td>' +
                    '<td>' +
                    (t.unreadFromMemberCount > 0
                        ? '<span class="badge badge-danger">' + t.unreadFromMemberCount + '</span>'
                        : '—') +
                    '</td>' +
                    '<td><button type="button" class="btn btn-sm btn-primary" onclick="openDeskThreadModal(' +
                    t.memberId +
                    ')">보기</button></td>' +
                    '<td><button type="button" class="btn btn-sm btn-danger" onclick="deleteDeskThreadRow(' +
                    t.memberId +
                    ')">전체 삭제</button></td>' +
                    '</tr>'
                );
            })
            .join('');
        if (typeof App.updateNotificationBadge === 'function') App.updateNotificationBadge();
    } catch (e) {
        App.err('쪽지함 로드 실패:', e);
    }
}

function renderDeskThreadMessages(msgs) {
    const box = document.getElementById('desk-thread-messages');
    if (!box) return;
    if (!msgs.length) {
        box.innerHTML =
            '<p style="color:var(--text-secondary);font-size:14px;margin:0;">아직 쪽지가 없습니다. 아래에 첫 답장을 작성해 주세요.</p>';
        return;
    }
    box.innerHTML = msgs
        .map(function (m) {
            var who = m.fromMember ? '회원' : '데스크';
            var mid = m.id != null ? String(m.id) : '';
            return (
                '<div style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.06);">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;">' +
                '<span style="font-size:11px;opacity:0.75;">' +
                who +
                ' · ' +
                App.formatDateTime(m.createdAt) +
                '</span>' +
                '<button type="button" class="btn btn-sm btn-danger" style="font-size:11px;padding:2px 8px;" onclick="deleteDeskMessage(' +
                mid +
                ')">삭제</button>' +
                '</div>' +
                '<div style="white-space:pre-wrap;">' +
                App.escapeHtml(m.content || '') +
                '</div></div>'
            );
        })
        .join('');
}

async function loadDeskThreadContent(memberId) {
    var gate = document.getElementById('desk-thread-lock-gate');
    var main = document.getElementById('desk-thread-main-area');
    var pinUnlock = document.getElementById('desk-thread-unlock-pin');
    try {
        const data = await App.api.get('/member-desk-messages/member/' + encodeURIComponent(memberId), deskThreadOpts(memberId));
        if (gate) gate.style.display = 'none';
        if (main) main.style.display = 'block';
        if (pinUnlock) pinUnlock.value = '';
        var titleEl = document.getElementById('desk-thread-modal-title');
        if (titleEl) {
            titleEl.textContent = (data.memberName || '') + ' (' + (data.memberNumber || '') + ')';
        }
        const msgs = data.messages || [];
        renderDeskThreadMessages(msgs);
        var lockSet = document.getElementById('desk-thread-lock-pin-set');
        if (lockSet) lockSet.value = '';
        var lockPanel = document.getElementById('desk-thread-lock-settings');
        if (lockPanel) lockPanel.style.display = 'block';
        if (msgs.length) {
            const box = document.getElementById('desk-thread-messages');
            if (box) {
                var scrollLatest = function () {
                    box.scrollTop = box.scrollHeight;
                };
                requestAnimationFrame(function () {
                    requestAnimationFrame(scrollLatest);
                });
                setTimeout(scrollLatest, 80);
            }
        }
        loadDeskInbox();
    } catch (e) {
        var st = e.response && e.response.status;
        var d = e.response && e.response.data;
        if (st === 403 && d && typeof d === 'object' && d.threadLockRequired) {
            if (gate) gate.style.display = 'block';
            if (main) main.style.display = 'none';
            var titleEl2 = document.getElementById('desk-thread-modal-title');
            if (titleEl2 && memberId) titleEl2.textContent = '쪽지 (잠금)';
            return;
        }
        App.showNotification('쪽지를 불러오지 못했습니다.', 'danger');
    }
}

async function openDeskThreadModal(memberId) {
    deskThreadMemberId = memberId;
    var replyEl = document.getElementById('desk-thread-reply');
    if (replyEl) replyEl.value = '';
    var gate = document.getElementById('desk-thread-lock-gate');
    var main = document.getElementById('desk-thread-main-area');
    if (gate) gate.style.display = 'none';
    if (main) main.style.display = 'block';
    App.Modal.open('desk-thread-modal');
    await loadDeskThreadContent(memberId);
}

async function deleteDeskMessage(messageId) {
    if (!messageId) return;
    if (!confirm('이 쪽지 한 건을 삭제할까요?')) return;
    try {
        await App.api.delete('/member-desk-messages/' + encodeURIComponent(messageId), deskThreadOpts(deskThreadMemberId));
        App.showNotification('삭제되었습니다.', 'success');
        await loadDeskThreadContent(deskThreadMemberId);
        loadDeskInbox();
    } catch (e) {
        if (handleThreadLockError(e, deskThreadMemberId)) return;
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

async function deleteDeskThreadRow(memberId) {
    if (!memberId) return;
    if (!confirm('이 회원과 주고받은 쪽지를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
        await App.api.delete('/member-desk-messages/member/' + encodeURIComponent(memberId) + '/thread', deskThreadOpts(memberId));
        App.showNotification('삭제되었습니다.', 'success');
        loadDeskInbox();
    } catch (e) {
        if (handleThreadLockError(e, memberId)) return;
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

async function deleteDeskThreadFromModal() {
    if (!deskThreadMemberId) return;
    if (!confirm('이 회원과 주고받은 쪽지를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
        await App.api.delete(
            '/member-desk-messages/member/' + encodeURIComponent(deskThreadMemberId) + '/thread',
            deskThreadOpts(deskThreadMemberId)
        );
        App.showNotification('삭제되었습니다.', 'success');
        App.Modal.close('desk-thread-modal');
        loadDeskInbox();
    } catch (e) {
        if (handleThreadLockError(e, deskThreadMemberId)) return;
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

async function sendDeskReply() {
    if (!deskThreadMemberId) return;
    var ta = document.getElementById('desk-thread-reply');
    var text = ta && ta.value ? ta.value.trim() : '';
    if (!text) {
        App.showNotification('답장 내용을 입력해 주세요.', 'warning');
        return;
    }
    try {
        await App.api.post(
            '/member-desk-messages/reply',
            { memberId: deskThreadMemberId, content: text },
            deskThreadOpts(deskThreadMemberId)
        );
        App.showNotification('답장이 전달되었습니다.', 'success');
        if (ta) ta.value = '';
        await loadDeskThreadContent(deskThreadMemberId);
        loadDeskInbox();
    } catch (e) {
        if (handleThreadLockError(e, deskThreadMemberId)) return;
        App.showNotification('답장 저장에 실패했습니다.', 'danger');
    }
}
