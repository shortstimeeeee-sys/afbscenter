/**
 * 비로그인 회원 예약 (회원번호 + 이용권 맞춤 캘린더)
 */
(function () {
    /** v5: 선택 이용권(memberProductId) 세션 유지 · 사이드바는 이용권의 지점·종목으로 필터 */
    var STORAGE_KEY = 'afb_member_booking_ctx_v5';

    function apiUrl(path) {
        var base =
            typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
        return base + '/public/member-booking' + path;
    }

    /**
     * 설정에서 등록한 공휴일·메모(관리자 달력 마크) — 운영 예약 달력과 동일 API.
     * common.js의 App.loadCalendarMarksMap이 있으면 위임하고, 없거나 실패해도 여기서 직접 조회한다.
     */
    function mbLoadCalendarMarksMap(startYmd, endYmd) {
        if (typeof App !== 'undefined' && App && typeof App.loadCalendarMarksMap === 'function') {
            return App.loadCalendarMarksMap(startYmd, endYmd);
        }
        var map = {};
        if (!startYmd || !endYmd) return Promise.resolve(map);
        var base = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
        return fetch(
            base +
                '/public/calendar-day-marks?startDate=' +
                encodeURIComponent(startYmd) +
                '&endDate=' +
                encodeURIComponent(endYmd),
            { headers: { 'ngrok-skip-browser-warning': 'true' } }
        )
            .then(function (res) {
                if (!res.ok) return [];
                return res.json();
            })
            .then(function (arr) {
                (arr || []).forEach(function (m) {
                    if (m && m.markDate) {
                        map[m.markDate] = {
                            memo: m.memo != null ? String(m.memo) : '',
                            redDay: m.redDay !== false
                        };
                    }
                });
                return map;
            })
            .catch(function (e) {
                if (typeof App !== 'undefined' && App && App.err) App.err('달력 공휴일·메모 로드 실패:', e);
                return map;
            });
    }

    /** 이용권이 없을 때 달력 조회용 기본 필터 (사하 야구 캘린더와 동일) */
    var DEFAULT_PASS_VIEW = {
        facilityType: 'BASEBALL',
        lessonCategory: null,
        purpose: 'LESSON',
        memberProductId: null,
        productName: null
    };

    var ctx = null;
    /** 현재 화면: verify | calendar | rankings */
    var mbView = 'verify';
    var currentDate = new Date();
    var branch = 'SAHA';
    /** 사이드바·URL로 고른 캘린더 뷰. null이면 이용권(pass) 기준으로 조회 */
    var viewOverride = null;
    /** URL에 branch/facility 없음 → 종합 달력(본인 예약 전체) */
    var aggregateCalendar = true;

    /** 원본 예약 페이지와 동일: 코치 칩 필터 (본인 예약에 나온 코치만 통계에 표시) */
    var mbCalendarFilterCoachIds = new Set();
    var mbLastRawBookings = null;
    /** 설정(공휴일·메모) — 달력 셀에 반영 */
    var mbCalendarMarksMap = null;
    var mbLastStatsData = null;
    var mbCalGridState = null;
    var mbStatsEventsBound = false;

    function saveCtx(data) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
    }

    function loadCtx() {
        try {
            var raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function clearCtx() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }

    function showStep(which) {
        var v = document.getElementById('step-verify');
        var c = document.getElementById('step-calendar');
        var r = document.getElementById('step-rankings');
        var ann = document.getElementById('step-announcements');
        if (!v) return;
        mbView = which;
        function hideAllSteps() {
            v.style.display = 'none';
            if (c) c.style.display = 'none';
            if (r) r.style.display = 'none';
            if (ann) ann.style.display = 'none';
        }
        if (which === 'calendar') {
            hideAllSteps();
            if (c) c.style.display = 'block';
        } else if (which === 'rankings') {
            hideAllSteps();
            if (r) r.style.display = 'block';
        } else if (which === 'announcements') {
            hideAllSteps();
            if (ann) ann.style.display = 'block';
        } else {
            hideAllSteps();
            v.style.display = 'block';
        }
        updatePageTitle();
        highlightSidebarMenus();
    }

    /** 운영 랭킹 페이지와 동일 마크업이 붙은 경우 관리자 열람 UI 제거 */
    function stripPublicRankingsAdminUi() {
        var unlock = document.getElementById('rankings-unlock-btn');
        if (unlock && unlock.parentNode) unlock.parentNode.removeChild(unlock);
        var modal = document.getElementById('rankings-view-modal');
        if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    }

    function gradeLabelKo(grade) {
        var g = {
            SOCIAL: '사회인',
            ELITE_ELEMENTARY: '엘리트(초)',
            ELITE_MIDDLE: '엘리트(중)',
            ELITE_HIGH: '엘리트(고)',
            YOUTH: '유소년',
            OTHER: '기타 종목'
        };
        return grade && g[grade] ? g[grade] : grade || '전체';
    }

    /** rankings.css 의 ranking-grade-* 와 맞춤 (엘리트 초·중·고 고유색) */
    function mbMemberGradeRankClass(gradeKey) {
        var g = gradeKey && String(gradeKey).trim().toUpperCase();
        if (!g) return 'social';
        var fixed = {
            ELITE_ELEMENTARY: 'elite-elementary',
            ELITE_MIDDLE: 'elite-middle',
            ELITE_HIGH: 'elite-high',
            SOCIAL: 'social',
            YOUTH: 'youth',
            OTHER: 'other'
        };
        var tail = String(gradeKey).trim().toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
        return fixed[g] || tail || 'other';
    }

    /** 회원번호 확인 후 members.js가 호출하는 API를 공개 위임 URL로 연결 */
    function syncMbPublicBookingContext() {
        if (ctx && ctx.memberNumber != null && ctx.memberId != null) {
            window.mbPublicBookingContext = {
                memberNumber: String(ctx.memberNumber).trim(),
                memberId: ctx.memberId
            };
        } else {
            window.mbPublicBookingContext = null;
        }
    }

    function mbShowMemberAnnouncementModal(announcement) {
        var title = announcement && announcement.title ? announcement.title : '공지';
        var body = announcement && announcement.content ? announcement.content : '';
        var esc =
            typeof App !== 'undefined' && App && App.escapeHtml
                ? App.escapeHtml
                : function (s) {
                      return String(s != null ? s : '');
                  };
        var modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.innerHTML =
            '<div class="modal" style="max-width: 520px; width: 92vw;">' +
            '<div class="modal-header">' +
            '<h2 class="modal-title">' +
            esc(title) +
            '</h2>' +
            '<button type="button" class="modal-close" aria-label="닫기">&times;</button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<div style="white-space: pre-wrap; line-height: 1.6; color: var(--text-primary);">' +
            esc(body) +
            '</div></div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary modal-close-btn">닫기</button>' +
            '</div></div>';
        document.body.appendChild(modal);
        function close() {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
        }
        modal.querySelector('.modal-close').addEventListener('click', close);
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) close();
        });
    }

    function mbSetupMemberNotifications() {
        if (typeof App === 'undefined' || !App) return;
        App.usePublicMemberAnnouncements = true;
        App.getPublicMemberAnnouncementMemberNumber = function () {
            return ctx && ctx.memberNumber ? String(ctx.memberNumber).trim() : '';
        };
        App.resolveAnnouncementView = function (id) {
            if (!ctx || !ctx.memberNumber) return false;
            var n = Number(id);
            if (n === -1 || Number.isNaN(n)) return false;
            var base = App.apiBase || '/api';
            fetch(base + '/public/member-announcements/' + n)
                .then(function (r) {
                    if (!r.ok) throw new Error();
                    return r.json();
                })
                .then(function (a) {
                    mbShowMemberAnnouncementModal(a);
                })
                .catch(function () {
                    if (App.showNotification) App.showNotification('알림을 불러올 수 없습니다.', 'danger');
                });
            return true;
        };
        // 회원번호 입력 전에도 종 UI를 붙인다(common.js는 이 페이지에서 initNotifications를 생략함)
        if (typeof App.initNotifications === 'function' && !document.getElementById('notification-dropdown')) {
            App.initNotifications();
        } else if (typeof App.updateNotificationBadge === 'function') {
            App.updateNotificationBadge();
        }
        if (!window.mbNotificationPollInterval && typeof App.updateNotificationBadge === 'function') {
            window.mbNotificationPollInterval = setInterval(function () {
                App.updateNotificationBadge();
            }, 60 * 1000);
        }
        mbRefreshDeskMenuUnread();
    }

    /** 공지 목록을 확인한 것으로 간주 — 종 배지용 mb_ann_seenMax 갱신 */
    function mbMarkAnnouncementsSeenFromList(list) {
        if (!ctx || !ctx.memberNumber || !list || !list.length) return;
        var mn = String(ctx.memberNumber).trim();
        var key = 'mb_ann_seenMax_' + mn;
        var max = localStorage.getItem(key) || '';
        list.forEach(function (a) {
            var t = a.updatedAt || a.createdAt;
            if (t && (!max || new Date(t) > new Date(max))) {
                max = t;
            }
        });
        if (max) {
            localStorage.setItem(key, max);
        }
        if (typeof App !== 'undefined' && App && typeof App.updateNotificationBadge === 'function') {
            App.updateNotificationBadge();
        }
    }

    function loadMbAnnouncementsList() {
        var container = document.getElementById('mb-announcements-list');
        if (!container) return;
        var base = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
        container.innerHTML = '<p style="color:var(--text-secondary);">불러오는 중…</p>';
        fetch(base + '/public/member-announcements')
            .then(function (r) {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then(function (list) {
                mbMarkAnnouncementsSeenFromList(list || []);
                var esc =
                    typeof App !== 'undefined' && App && App.escapeHtml
                        ? App.escapeHtml
                        : function (s) {
                              return String(s != null ? s : '');
                          };
                var fmt =
                    typeof App !== 'undefined' && App && App.formatDateTime
                        ? App.formatDateTime
                        : function (d) {
                              return d ? String(d) : '';
                          };
                if (!list || !list.length) {
                    container.innerHTML =
                        '<p style="color:var(--text-secondary);">표시할 공지가 없습니다. 운영 «공지/메시지»에서 «회원 예약 페이지에 공개»로 등록된 안내만 여기에 나타납니다.</p>';
                    return;
                }
                container.innerHTML = list
                    .map(function (a) {
                        var icon = a.source === 'SETTINGS_MEMBERSHIP_DUES' ? '🏦' : '📢';
                        var title = esc(a.title || '');
                        var time = fmt(a.createdAt);
                        var idAttr = a.id != null ? String(a.id) : '';
                        return (
                            '<button type="button" class="mb-ann-item" data-ann-id="' +
                            esc(idAttr) +
                            '">' +
                            '<span class="mb-ann-item-icon" aria-hidden="true">' +
                            icon +
                            '</span><span class="mb-ann-item-body"><span class="mb-ann-item-title">' +
                            title +
                            '</span><span class="mb-ann-item-meta">' +
                            time +
                            '</span></span></button>'
                        );
                    })
                    .join('');
                container.querySelectorAll('.mb-ann-item').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var idStr = btn.getAttribute('data-ann-id');
                        var found = (list || []).find(function (x) {
                            return String(x.id) === String(idStr);
                        });
                        if (found) {
                            mbShowMemberAnnouncementModal(found);
                            return;
                        }
                        var n = Number(idStr);
                        if (Number.isNaN(n)) return;
                        fetch(base + '/public/member-announcements/' + n)
                            .then(function (r) {
                                if (!r.ok) throw new Error();
                                return r.json();
                            })
                            .then(function (data) {
                                mbShowMemberAnnouncementModal(data);
                            })
                            .catch(function () {
                                if (typeof App !== 'undefined' && App.showNotification) {
                                    App.showNotification('내용을 불러올 수 없습니다.', 'danger');
                                }
                            });
                    });
                });
            })
            .catch(function () {
                container.innerHTML =
                    '<p style="color:#f56565;">공지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
            })
            .finally(function () {
                loadMbDeskThread();
                mbRefreshDeskMenuUnread();
            });
    }

    function mbRefreshDeskMenuUnreadFromData(data) {
        var el = document.getElementById('mb-desk-menu-unread');
        if (!el) return;
        var n = data && data.unreadFromAdminCount != null ? Number(data.unreadFromAdminCount) : 0;
        if (n > 0) {
            el.style.display = 'inline-block';
            el.textContent = n > 9 ? '9+' : String(n);
        } else {
            el.style.display = 'none';
        }
    }

    function mbRefreshDeskMenuUnread() {
        if (!ctx || !ctx.memberNumber) return;
        var base = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
        fetch(
            base +
                '/public/member-desk-messages/unread-count?memberNumber=' +
                encodeURIComponent(String(ctx.memberNumber).trim())
        )
            .then(function (r) {
                return r.json();
            })
            .then(function (d) {
                var el = document.getElementById('mb-desk-menu-unread');
                if (!el) return;
                var n = d.count != null ? Number(d.count) : 0;
                if (n > 0) {
                    el.style.display = 'inline-block';
                    el.textContent = n > 9 ? '9+' : String(n);
                } else {
                    el.style.display = 'none';
                }
            })
            .catch(function () {});
    }

    function loadMbDeskThread() {
        var threadEl = document.getElementById('mb-desk-thread');
        if (!threadEl || !ctx || !ctx.memberNumber) return;
        var base = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
        var mn = encodeURIComponent(String(ctx.memberNumber).trim());
        threadEl.innerHTML = '<p style="color:var(--text-secondary);">불러오는 중…</p>';
        fetch(base + '/public/member-desk-messages?memberNumber=' + mn)
            .then(function (r) {
                if (!r.ok) throw new Error();
                return r.json();
            })
            .then(function (data) {
                mbRefreshDeskMenuUnreadFromData(data);
                var msgs = data.messages || [];
                var esc =
                    typeof App !== 'undefined' && App && App.escapeHtml
                        ? App.escapeHtml
                        : function (s) {
                              return String(s != null ? s : '');
                          };
                var fmt =
                    typeof App !== 'undefined' && App && App.formatDateTime
                        ? App.formatDateTime
                        : function (d) {
                              return d ? String(d) : '';
                          };
                if (!msgs.length) {
                    threadEl.innerHTML =
                        '<p style="color:var(--text-secondary);">아직 쪽지가 없습니다. 아래에 문의를 남기면 데스크에서 답장합니다.</p>';
                    return;
                }
                threadEl.innerHTML = msgs
                    .map(function (m) {
                        var who = m.fromMember ? '나' : '데스크';
                        var al = m.fromMember ? 'right' : 'left';
                        var bg = m.fromMember ? 'rgba(237,137,54,0.18)' : 'rgba(255,255,255,0.07)';
                        return (
                            '<div style="margin-bottom:10px;text-align:' +
                            al +
                            ';">' +
                            '<span style="display:inline-block;max-width:92%;padding:10px 12px;border-radius:10px;background:' +
                            bg +
                            ';border:1px solid rgba(255,255,255,0.08);text-align:left;">' +
                            '<span style="font-size:11px;opacity:0.8;">' +
                            who +
                            ' · ' +
                            fmt(m.createdAt) +
                            '</span>' +
                            '<div style="white-space:pre-wrap;margin-top:4px;">' +
                            esc(m.content || '') +
                            '</div></span></div>'
                        );
                    })
                    .join('');
            })
            .catch(function () {
                threadEl.innerHTML = '<p style="color:#f56565;">쪽지를 불러오지 못했습니다.</p>';
            });
    }

    /** 관리자·회원 쪽지 스레드 전체 삭제 (공개 DELETE API) */
    function mbClearDeskThreadWithConfirm() {
        if (!ctx || !ctx.memberNumber) {
            if (typeof App !== 'undefined' && App && App.showNotification) {
                App.showNotification('회원번호 확인 후 이용해 주세요.', 'danger');
            } else {
                alert('회원번호 확인 후 이용해 주세요.');
            }
            return;
        }
        if (
            !confirm(
                '이 화면에서 이전 쪽지를 숨길까요?\n\n' +
                    '센터 데스크(관리자) 쪽지함에는 그대로 남습니다. 이후 새로 주고받는 쪽지만 여기에 보입니다.'
            )
        ) {
            return;
        }
        var base = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
        var mn = encodeURIComponent(String(ctx.memberNumber).trim());
        fetch(base + '/public/member-desk-messages/thread?memberNumber=' + mn, {
            method: 'DELETE',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(function (r) {
                return r.text().then(function (t) {
                    var j = {};
                    try {
                        if (t && t.trim().charAt(0) === '{') j = JSON.parse(t);
                    } catch (_) {}
                    return { ok: r.ok, body: j };
                });
            })
            .then(function (x) {
                if (!x.ok) {
                    var err = (x.body && x.body.error) || '초기화에 실패했습니다.';
                    throw new Error(err);
                }
                var okMsg =
                    (x.body && x.body.message) ||
                    '회원 화면에서 이전 쪽지가 숨겨졌습니다. 데스크에는 기록이 남아 있습니다.';
                if (typeof App !== 'undefined' && App && App.showNotification) {
                    App.showNotification(okMsg, 'success');
                }
                loadMbDeskThread();
                mbRefreshDeskMenuUnread();
            })
            .catch(function (e) {
                var msg = e && e.message ? e.message : '초기화에 실패했습니다.';
                if (typeof App !== 'undefined' && App && App.showNotification) {
                    App.showNotification(msg, 'danger');
                } else {
                    alert(msg);
                }
            });
    }

    function patchAppApiForPublicMemberBooking() {
        if (typeof App === 'undefined' || !App.api || App.__mbApiPatched) return;
        App.__mbApiPatched = true;
        var origGet = App.api.get;
        var origDelete = App.api.delete;
        App.api.get = async function (url) {
            var c = window.mbPublicBookingContext;
            if (!c || url == null || typeof url !== 'string') {
                return origGet.call(App.api, url);
            }
            var mnQ = 'memberNumber=' + encodeURIComponent(c.memberNumber);
            var midStr = String(c.memberId);

            var bid = url.match(/^\/bookings\/(\d+)$/);
            if (bid) {
                return origGet.call(App.api, '/public/member-booking/bookings/' + bid[1] + '?' + mnQ);
            }

            if (url.indexOf('/member-products?') === 0) {
                try {
                    var qs = url.slice('/member-products?'.length);
                    var params = new URLSearchParams(qs);
                    var mid = params.get('memberId');
                    if (mid != null && String(mid) === midStr) {
                        return origGet.call(App.api, '/public/member-booking/member-products?' + qs + '&' + mnQ);
                    }
                } catch (e) {}
            }

            var m = url.match(
                /^\/members\/(\d+)\/(payments|bookings|attendance|product-history|timeline|products|ability-stats-context)$/
            );
            if (m && m[1] === midStr) {
                return origGet.call(
                    App.api,
                    '/public/member-booking/members/' + m[1] + '/' + m[2] + '?' + mnQ
                );
            }

            return origGet.call(App.api, url);
        };
        App.api.delete = async function (url) {
            var c = window.mbPublicBookingContext;
            if (!c || url == null || typeof url !== 'string') {
                return origDelete.call(App.api, url);
            }
            var mnQ = 'memberNumber=' + encodeURIComponent(c.memberNumber);
            var bid = url.match(/^\/bookings\/(\d+)$/);
            if (bid) {
                return origDelete.call(
                    App.api,
                    '/public/member-booking/bookings/' + bid[1] + '?' + mnQ
                );
            }
            return origDelete.call(App.api, url);
        };
    }
    patchAppApiForPublicMemberBooking();

    function mbBranchFromBooking(booking) {
        if (!booking) return 'SAHA';
        if (booking.facility && booking.facility.branch) return String(booking.facility.branch);
        if (booking.branch != null && booking.branch !== '') return String(booking.branch);
        return 'SAHA';
    }

    /** 예약 단건 조회 시 시설 목록 필터 (운영 loadFacilities와 동일한 분기) */
    function mbInferFacilityTypeFromBooking(booking) {
        if (!booking) return null;
        var p = booking.purpose;
        if (p === 'RENTAL') return 'RENTAL';
        var lc = booking.lessonCategory;
        if (lc === 'PILATES' || lc === 'TRAINING') return 'TRAINING_FITNESS';
        if (lc === 'BASEBALL' || lc === 'YOUTH_BASEBALL') return 'BASEBALL';
        return 'BASEBALL';
    }

    function mbFetchFacilitiesForModal(branch, facilityType) {
        var q = 'branch=' + encodeURIComponent(branch || 'SAHA');
        if (facilityType) q += '&facilityType=' + encodeURIComponent(facilityType);
        return fetch(apiUrl('/facilities?' + q), {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(function (r) {
                return r.json();
            })
            .then(function (list) {
                var sel = document.getElementById('booking-facility');
                if (!sel) return list;
                sel.innerHTML = '<option value="">시설 선택...</option>';
                (list || []).forEach(function (f) {
                    var o = document.createElement('option');
                    o.value = String(f.id);
                    o.textContent = f.name || '시설 #' + f.id;
                    sel.appendChild(o);
                });
                return list;
            });
    }

    function mbFetchCoachesForModal(branch) {
        var q = branch ? '?branch=' + encodeURIComponent(branch) : '';
        return fetch(apiUrl('/coaches' + q), { headers: { 'ngrok-skip-browser-warning': 'true' } })
            .then(function (r) {
                return r.json();
            })
            .then(function (list) {
                var sel = document.getElementById('booking-coach');
                if (!sel) return list;
                sel.innerHTML = '<option value="">코치 미지정</option>';
                (list || []).forEach(function (c) {
                    var o = document.createElement('option');
                    o.value = String(c.id);
                    o.textContent = c.name || '코치 #' + c.id;
                    sel.appendChild(o);
                });
                return list;
            });
    }

    function mbGradeText(grade) {
        if (typeof App !== 'undefined' && App.MemberGrade && typeof App.MemberGrade.getText === 'function') {
            return App.MemberGrade.getText(grade) || '-';
        }
        return grade || '-';
    }

    /** 해당 연도 4월 1일 이상이면 회원 예약 등록 시 30분 단위 시작 슬롯(09:00~21:00, 기본 1시간) 시간표 UI */
    function mbIsTimetableBookingDate(d) {
        if (!d || isNaN(d.getTime())) return false;
        var y = d.getFullYear();
        return d >= new Date(y, 3, 1);
    }

    function mbParseBookingModalDate() {
        var dateEl = document.getElementById('booking-date');
        if (!dateEl || !dateEl.value) return null;
        var parts = dateEl.value.split('-');
        if (parts.length !== 3) return null;
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        if (isNaN(y) || isNaN(m) || isNaN(day)) return null;
        return new Date(y, m, day);
    }

    function mbRenderBookingTimeSlots() {
        var wrap = document.getElementById('mb-booking-time-slots');
        var stEl = document.getElementById('booking-start-time');
        var enEl = document.getElementById('booking-end-time');
        if (!wrap || !stEl || !enEl) return;

        function minutesFromClock(hh, mm) {
            return hh * 60 + mm;
        }
        function addMinutesToClock(startMin, addMin) {
            var t = startMin + addMin;
            var h = Math.floor(t / 60) % 24;
            var m = t % 60;
            return pad(h) + ':' + pad(m);
        }

        var selMin = 10 * 60;
        var mx = /^(\d{1,2}):(\d{2})$/.exec((stEl.value || '').trim());
        if (mx) {
            var h0 = parseInt(mx[1], 10);
            var m0 = parseInt(mx[2], 10);
            if (!isNaN(h0) && !isNaN(m0)) selMin = minutesFromClock(h0, m0);
        }

        var fidEl = document.getElementById('booking-facility');
        var dateEl = document.getElementById('booking-date');
        var fid = fidEl && fidEl.value;
        var dateStr = dateEl && dateEl.value;
        var localExtra = mbHalfHourStartMinutesFromCalendarBookings(fid, dateStr);

        function buildAndRender(extraHalfMins) {
            var starts = [];
            var h;
            /** 기본: 정시(:00)만 — 9:00~21:00 */
            for (h = 9; h <= 21; h++) starts.push(h * 60);
            (extraHalfMins || []).forEach(function (m) {
                if (starts.indexOf(m) < 0) starts.push(m);
            });
            starts.sort(function (a, b) {
                return a - b;
            });

            wrap.innerHTML = '';
            starts.forEach(function (startMin) {
                var hh = Math.floor(startMin / 60);
                var mm = startMin % 60;
                var endStr = addMinutesToClock(startMin, 60);
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mb-time-slot-btn';
                if (mm === 30) btn.classList.add('mb-time-slot-btn--half-follow');
                btn.setAttribute('data-start-min', String(startMin));
                if (startMin === selMin) btn.classList.add('mb-time-slot-btn--selected');
                btn.textContent = pad(hh) + ':' + pad(mm) + ' – ' + endStr;
                btn.addEventListener('click', function () {
                    stEl.value = pad(hh) + ':' + pad(mm);
                    enEl.value = endStr;
                    wrap.querySelectorAll('.mb-time-slot-btn').forEach(function (b) {
                        b.classList.toggle('mb-time-slot-btn--selected', b.getAttribute('data-start-min') === String(startMin));
                    });
                });
                wrap.appendChild(btn);
            });
        }

        if (fid && dateStr && ctx && ctx.memberNumber) {
            var q = new URLSearchParams({
                facilityId: String(fid),
                date: dateStr,
                memberNumber: String(ctx.memberNumber)
            });
            fetch(apiUrl('/occupancy-half-hour-starts') + '?' + q.toString(), {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            })
                .then(function (r) {
                    return r.ok ? r.json() : null;
                })
                .then(function (data) {
                    var extra = localExtra.slice();
                    var list = data && data.halfHourStartTimes ? data.halfHourStartTimes : [];
                    list.forEach(function (iso) {
                        var dt = new Date(iso);
                        if (isNaN(dt.getTime())) return;
                        var sm = dt.getHours() * 60 + dt.getMinutes();
                        if (extra.indexOf(sm) < 0) extra.push(sm);
                    });
                    buildAndRender(extra);
                })
                .catch(function () {
                    buildAndRender(localExtra);
                });
        } else {
            buildAndRender(localExtra);
        }
    }

    /**
     * 예약 등록(data-mb-mode=new)에서만: 4/1 이후는 시간표 슬롯, 그 전은 직접 입력.
     * 상세(detail) 등에서는 항상 직접 입력 영역만 표시.
     */
    function mbSyncBookingModalTimeUI() {
        var bm = document.getElementById('booking-modal');
        var classicWrap = document.getElementById('mb-booking-time-classic-wrap');
        var ttWrap = document.getElementById('mb-booking-time-timetable-wrap');
        if (!classicWrap || !ttWrap) return;

        if (!bm || bm.getAttribute('data-mb-mode') !== 'new') {
            classicWrap.style.display = '';
            ttWrap.style.display = 'none';
            return;
        }

        var d = mbParseBookingModalDate();
        if (!d) {
            classicWrap.style.display = '';
            ttWrap.style.display = 'none';
            return;
        }

        if (mbIsTimetableBookingDate(d)) {
            classicWrap.style.display = 'none';
            ttWrap.style.display = 'block';
            mbRenderBookingTimeSlots();
        } else {
            classicWrap.style.display = '';
            ttWrap.style.display = 'none';
        }
    }

    function mbLoadMemberProductsForModal(memberId) {
        return App.api.get('/member-products?memberId=' + encodeURIComponent(memberId)).then(function (memberProducts) {
            var select = document.getElementById('booking-member-product');
            if (!select) return memberProducts;
            select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
            (memberProducts || [])
                .filter(function (mp) {
                    return mp.status === 'ACTIVE';
                })
                .forEach(function (mp) {
                    var o = document.createElement('option');
                    o.value = String(mp.id);
                    o.textContent = (mp.product && mp.product.name) ? mp.product.name : '이용권 #' + mp.id;
                    if (mp.product && mp.product.type) o.dataset.productType = mp.product.type;
                    select.appendChild(o);
                });
            return memberProducts;
        });
    }

    function mbSetBookingModalReadonly(on) {
        var form = document.getElementById('booking-form');
        if (!form) return;
        form.querySelectorAll('input, select, textarea').forEach(function (el) {
            if (el.id === 'booking-repeat-enabled') el.disabled = !!on;
            else el.disabled = !!on;
        });
        form.querySelectorAll('#mb-booking-time-slots button.mb-time-slot-btn').forEach(function (btn) {
            btn.disabled = !!on;
        });
    }

    function mbFillBookingModalFromBooking(booking) {
        if (!booking) return Promise.resolve();
        document.getElementById('booking-id').value = booking.id != null ? String(booking.id) : '';
        var br = mbBranchFromBooking(booking);
        var branchEl = document.getElementById('booking-branch');
        if (branchEl) branchEl.value = br;

        document.getElementById('member-select-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';

        var fs0 = document.getElementById('booking-facility');
        var fd0 = document.getElementById('facility-selected-display');
        if (fs0) {
            fs0.classList.remove('facility-fixed');
            fs0.disabled = false;
        }
        if (fd0) fd0.style.display = 'none';

        if (booking.member) {
            document.getElementById('member-info-section').style.display = 'block';
            document.getElementById('member-info-name').textContent = booking.member.name || '-';
            document.getElementById('member-info-phone').textContent = booking.member.phoneNumber || '-';
            document.getElementById('member-info-grade').textContent = mbGradeText(booking.member.grade);
            document.getElementById('member-info-school').textContent = booking.member.school || '-';
            document.getElementById('selected-member-id').value = booking.member.id != null ? String(booking.member.id) : '';
            document.getElementById('selected-member-number').value = booking.member.memberNumber || '';
        } else {
            document.getElementById('member-info-section').style.display = 'none';
        }

        return mbFetchFacilitiesForModal(br, mbInferFacilityTypeFromBooking(booking))
            .then(function () {
                return mbFetchCoachesForModal(br);
            })
            .then(function () {
                var facilitySelect = document.getElementById('booking-facility');
                var facilityOverlay = document.getElementById('facility-selected-display');
                var facilityNameSpan = document.getElementById('facility-selected-name');
                if (facilitySelect && booking.facility && booking.facility.id != null) {
                    facilitySelect.value = String(booking.facility.id);
                    if (!facilitySelect.value) {
                        var o = document.createElement('option');
                        o.value = String(booking.facility.id);
                        o.textContent = booking.facility.name || '시설 #' + booking.facility.id;
                        facilitySelect.appendChild(o);
                        facilitySelect.value = o.value;
                    }
                    /* common.css: disabled 시설 셀렉트는 글자가 transparent — 운영 화면과 같이 오버레이로 이름 표시 */
                    var fn = booking.facility.name || '시설 #' + booking.facility.id;
                    if (facilityNameSpan) facilityNameSpan.textContent = fn;
                    if (facilityOverlay) {
                        facilityOverlay.style.display = 'flex';
                    }
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                } else {
                    if (facilityOverlay) facilityOverlay.style.display = 'none';
                }
            })
            .then(function () {
                if (!booking.member || !booking.member.id) return null;
                return mbLoadMemberProductsForModal(booking.member.id);
            })
            .then(function () {
                var productInfo = document.getElementById('product-info');
                var productInfoText = document.getElementById('product-info-text');
                if (productInfo) productInfo.style.display = 'none';
                if (booking.memberProduct && booking.memberProduct.id && booking.member) {
                    var select = document.getElementById('booking-member-product');
                    var pid = String(booking.memberProduct.id);
                    if (select) {
                        var opt = Array.from(select.options).find(function (o) {
                            return o.value === pid;
                        });
                        if (!opt) {
                            var o = document.createElement('option');
                            o.value = pid;
                            o.textContent =
                                booking.memberProduct.product && booking.memberProduct.product.name
                                    ? booking.memberProduct.product.name
                                    : '이용권 #' + pid;
                            if (booking.memberProduct.product && booking.memberProduct.product.type) {
                                o.dataset.productType = booking.memberProduct.product.type;
                            }
                            select.appendChild(o);
                        }
                        select.value = pid;
                    }
                    if (
                        productInfo &&
                        productInfoText &&
                        booking.memberProduct.product &&
                        booking.memberProduct.product.type === 'COUNT_PASS'
                    ) {
                        var rem =
                            booking.memberProduct.remainingCount != null ? booking.memberProduct.remainingCount : 0;
                        productInfoText.textContent = '횟수권 사용: 잔여 ' + rem + '회';
                        productInfo.style.display = 'block';
                    } else if (productInfo && productInfoText && booking.memberProduct.product) {
                        productInfoText.textContent = '상품 사용 예정';
                        productInfo.style.display = 'block';
                    }
                }
                var startDate = booking.startTime ? new Date(booking.startTime) : new Date();
                document.getElementById('booking-date').value = startDate.toISOString().split('T')[0];
                document.getElementById('booking-start-time').value = startDate.toTimeString().slice(0, 5);
                var endDate = booking.endTime ? new Date(booking.endTime) : new Date();
                document.getElementById('booking-end-time').value = endDate.toTimeString().slice(0, 5);

                document.getElementById('booking-participants').value = booking.participants || 1;
                var purposeEl = document.getElementById('booking-purpose');
                if (purposeEl) {
                    purposeEl.value = booking.purpose || 'LESSON';
                    if (purposeEl.value && !Array.from(purposeEl.options).some(function (o) { return o.value === purposeEl.value; })) {
                        var po = document.createElement('option');
                        po.value = String(booking.purpose);
                        po.textContent = String(booking.purpose);
                        purposeEl.appendChild(po);
                        purposeEl.value = po.value;
                    }
                }
                if (typeof window.toggleLessonCategory === 'function') {
                    window.toggleLessonCategory();
                }
                var lessonEl = document.getElementById('booking-lesson-category');
                if (lessonEl && booking.lessonCategory) {
                    lessonEl.value = booking.lessonCategory;
                    if (!lessonEl.value) {
                        var lo = document.createElement('option');
                        lo.value = String(booking.lessonCategory);
                        lo.textContent = String(booking.lessonCategory);
                        lessonEl.appendChild(lo);
                        lessonEl.value = lo.value;
                    }
                }
                var coachSel = document.getElementById('booking-coach');
                if (coachSel && booking.coach && booking.coach.id != null) {
                    coachSel.value = String(booking.coach.id);
                    if (!coachSel.value) {
                        var co = document.createElement('option');
                        co.value = String(booking.coach.id);
                        co.textContent = booking.coach.name || '코치 #' + booking.coach.id;
                        coachSel.appendChild(co);
                        coachSel.value = co.value;
                    }
                }
                var loadedStatus = booking.status || 'PENDING';
                document.getElementById('booking-status').value =
                    !booking.member && loadedStatus === 'PENDING' ? 'CONFIRMED' : loadedStatus;
                document.getElementById('booking-payment-method').value = booking.paymentMethod || '';
                document.getElementById('booking-notes').value = booking.memo || '';
                mbSyncBookingModalTimeUI();
            });
    }

    function mbOpenBookingDetailModal(bookingId) {
        if (!ctx || !ctx.memberNumber || ctx.memberId == null) {
            alert('회원번호 확인 후 이용해 주세요.');
            return;
        }
        syncMbPublicBookingContext();
        var overlay = document.getElementById('booking-modal');
        if (overlay) overlay.setAttribute('data-mb-mode', 'detail');
        var titleEl = document.getElementById('booking-modal-title');
        if (titleEl) titleEl.textContent = '예약 상세';
        var delBtn = document.getElementById('booking-delete-btn');
        if (delBtn) {
            delBtn.style.display = 'none';
            delBtn.removeAttribute('data-booking-id');
        }
        mbSetBookingModalReadonly(false);
        App.api.get('/bookings/' + bookingId)
            .then(function (booking) {
                return mbFillBookingModalFromBooking(booking).then(function () {
                    return booking;
                });
            })
            .then(function (booking) {
                mbSetBookingModalReadonly(true);
                if (delBtn) {
                    if (booking.status === 'PENDING') {
                        delBtn.style.display = 'block';
                        delBtn.setAttribute('data-booking-id', String(bookingId));
                    } else {
                        delBtn.style.display = 'none';
                    }
                }
                if (App.Modal) App.Modal.open('booking-modal');
                else {
                    var mo = document.getElementById('booking-modal');
                    if (mo) {
                        mo.classList.add('active');
                        mo.style.display = '';
                    }
                }
            })
            .catch(function (e) {
                var msg = '예약을 불러오지 못했습니다.';
                if (e && e.response && e.response.data) {
                    if (typeof e.response.data === 'object' && e.response.data.error) msg = e.response.data.error;
                }
                if (App.showNotification) App.showNotification(msg, 'danger');
                else alert(msg);
            });
    }

    function openMemberDetailModal() {
        if (!ctx || !ctx.memberNumber || ctx.memberId == null) {
            alert('회원번호 확인 후 이용해 주세요.');
            return;
        }
        syncMbPublicBookingContext();
        var titleEl = document.getElementById('member-detail-title');
        if (titleEl) titleEl.textContent = '불러오는 중…';
        var contentEl = document.getElementById('detail-tab-content');
        if (contentEl) {
            contentEl.innerHTML = '<p style="color:var(--text-muted);padding:12px;">불러오는 중…</p>';
        }
        fetch(
            apiUrl(
                '/member-detail?memberNumber=' +
                    encodeURIComponent(String(ctx.memberNumber).trim()) +
                    '&memberId=' +
                    encodeURIComponent(String(ctx.memberId))
            ),
            { headers: { 'ngrok-skip-browser-warning': 'true' } }
        )
            .then(function (r) {
                return r.json().then(function (j) {
                    if (!r.ok) throw new Error(j.error || '회원 정보를 불러오지 못했습니다.');
                    return j;
                });
            })
            .then(function (member) {
                window.currentMemberDetail = member;
                if (titleEl) titleEl.textContent = (member.name || '회원') + ' 상세 정보';
                if (typeof switchTab === 'function') {
                    switchTab('info', member);
                }
                App.Modal.open('member-detail-modal');
            })
            .catch(function (e) {
                if (titleEl) titleEl.textContent = '회원 상세';
                if (contentEl) {
                    contentEl.innerHTML =
                        '<p class="mb-error">' + App.escapeHtml(e.message || '오류') + '</p>';
                }
                App.Modal.open('member-detail-modal');
                if (typeof App !== 'undefined' && App.showNotification) {
                    App.showNotification(e.message || '회원 정보를 불러오지 못했습니다.', 'danger');
                } else {
                    alert(e.message || '회원 정보를 불러오지 못했습니다.');
                }
            });
    }

    function mbMaskName(name) {
        if (name == null || name === '') return '-';
        return String(name).charAt(0) + '**';
    }

    function mbMaskMemberNumber(num) {
        if (num == null || num === '') return '-';
        var s = String(num);
        return s.length ? '*'.repeat(s.length) : '-';
    }

    function mbEscHtml(s) {
        if (typeof App !== 'undefined' && App && typeof App.escapeHtml === 'function') {
            return App.escapeHtml(s);
        }
        return String(s != null ? s : '');
    }

    var MB_RANK_TOP_N = 5;

    function mbRankingParseValue(raw, valueKey, unit) {
        var num =
            typeof raw === 'number' && !isNaN(raw)
                ? raw
                : raw != null && raw !== ''
                  ? parseFloat(raw)
                  : NaN;
        var displayVal =
            valueKey === 'totalRecords'
                ? (isNaN(num) ? String(raw != null ? raw : '-') : Math.round(num) + '회')
                : !isNaN(num)
                  ? num.toFixed(1) + (unit ? ' ' + unit : '')
                  : String(raw != null ? raw : '-');
        return { num: num, displayVal: displayVal };
    }

    /**
     * 상위 5명 + 하단 본인 순위·1위 대비 비교. 상위 5 안 본인은 이름·회원번호 마스킹 해제.
     */
    function mbRenderRankingTop5AndSelf(containerId, fullRows, valueKey, unit, subLabel, myMemberId) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!fullRows || !fullRows.length) {
            el.innerHTML = '<div class="ranking-empty">해당 기간에 기록이 없습니다.</div>';
            return;
        }
        var myId = myMemberId != null ? String(myMemberId) : '';
        var top = fullRows.slice(0, MB_RANK_TOP_N);
        var gl = {
            SOCIAL: '사회인',
            ELITE_ELEMENTARY: '엘리트(초)',
            ELITE_MIDDLE: '엘리트(중)',
            ELITE_HIGH: '엘리트(고)',
            YOUTH: '유소년',
            OTHER: '기타 종목'
        };
        var html = '';
        top.forEach(function (item, index) {
            var raw = item[valueKey];
            var parsed = mbRankingParseValue(raw, valueKey, unit);
            var rank = index + 1;
            var posClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            var bgClass = rank === 1 ? 'ranking-item-gold' : rank === 2 ? 'ranking-item-silver' : rank === 3 ? 'ranking-item-bronze' : '';
            var grade = item.memberGrade || 'SOCIAL';
            var gclass = (grade || 'SOCIAL').toLowerCase().replace(/_/g, '-');
            var isMe = myId && String(item.memberId) === myId;
            var nameShown = isMe ? mbEscHtml(String(item.memberName || '-')) : mbMaskName(item.memberName);
            var numShown = isMe ? mbEscHtml(String(item.memberNumber || '-')) : mbMaskMemberNumber(item.memberNumber);
            html +=
                '<div class="ranking-item ' +
                bgClass +
                '">' +
                '<div class="ranking-position ' +
                posClass +
                '">' +
                rank +
                '</div>' +
                '<div class="ranking-member-info">' +
                '<div class="ranking-member-name">' +
                nameShown +
                ' <span class="ranking-grade-badge ranking-grade-' +
                gclass +
                '">' +
                (gl[grade] || grade) +
                '</span></div>' +
                '<div class="ranking-member-number">' +
                numShown +
                '</div></div>' +
                '<div class="ranking-value">' +
                '<div class="ranking-main-value">' +
                parsed.displayVal +
                '</div>' +
                '<div class="ranking-sub-value">' +
                (item.source != null && item.source !== '' ? item.source : subLabel || '') +
                '</div></div></div>';
        });

        var myIndex = -1;
        var myItem = null;
        for (var i = 0; i < fullRows.length; i++) {
            if (myId && String(fullRows[i].memberId) === myId) {
                myIndex = i;
                myItem = fullRows[i];
                break;
            }
        }

        var selfHtml = '<div class="mb-ranking-my-wrap">';
        if (!myId) {
            selfHtml +=
                '<div class="mb-ranking-my-line" style="font-size:13px;color:var(--text-secondary);">본인 순위를 표시할 수 없습니다.</div></div>';
            el.innerHTML = html + selfHtml;
            return;
        }
        if (myIndex < 0 || !myItem) {
            selfHtml +=
                '<div class="mb-ranking-my-line" style="font-size:14px;color:var(--text-secondary);">이 항목에서 집계된 <strong>본인 기록이 없습니다</strong>.</div></div>';
            el.innerHTML = html + selfHtml;
            return;
        }

        var myRank = myIndex + 1;
        var myRaw = myItem[valueKey];
        var myParsed = mbRankingParseValue(myRaw, valueKey, unit);
        var first = fullRows[0];
        var firstRaw = first ? first[valueKey] : null;
        var firstParsed = mbRankingParseValue(firstRaw, valueKey, unit);
        var cmpLine = '';
        if (myRank === 1) {
            cmpLine = '1위입니다. 잘하고 있어요!';
        } else if (!isNaN(myParsed.num) && !isNaN(firstParsed.num) && valueKey === 'totalRecords') {
            var diff = myParsed.num - firstParsed.num;
            cmpLine =
                '1위(' +
                mbMaskName(first.memberName) +
                ', ' +
                firstParsed.displayVal +
                ') 대비 <strong>' +
                (diff >= 0 ? '+' : '') +
                Math.round(diff) +
                '회</strong>';
        } else if (!isNaN(myParsed.num) && !isNaN(firstParsed.num)) {
            var d = myParsed.num - firstParsed.num;
            cmpLine =
                '1위 기록(' +
                firstParsed.displayVal +
                ') 대비 <strong>' +
                (d >= 0 ? '+' : '') +
                d.toFixed(1) +
                (unit ? ' ' + unit : '') +
                '</strong>';
        }

        selfHtml +=
            '<div class="mb-ranking-my-line" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">내 기록</div>' +
            '<div style="font-size:15px;font-weight:600;color:var(--text-primary);">' +
            mbEscHtml(String(ctx.name || myItem.memberName || '나')) +
            ' · <span style="color:var(--accent-primary);">' +
            myRank +
            '위</span> · ' +
            myParsed.displayVal +
            '</div>';
        if (cmpLine) {
            selfHtml += '<div style="font-size:13px;color:var(--text-secondary);margin-top:8px;line-height:1.5;">' + cmpLine + '</div>';
        }
        selfHtml += '</div></div>';

        el.innerHTML = html + selfHtml;
    }

    function mapSwingFromApi(rows) {
        return (rows || [])
            .filter(function (s) {
                var m =
                    typeof s.swingSpeedMax === 'number'
                        ? s.swingSpeedMax
                        : s.swingSpeedMax != null
                          ? parseFloat(s.swingSpeedMax)
                          : NaN;
                return !isNaN(m) && m > 0;
            })
            .map(function (s) {
                return {
                    memberId: s.memberId,
                    memberName: s.memberName,
                    memberNumber: s.memberNumber,
                    memberGrade: s.memberGrade,
                    swingSpeedMax: s.swingSpeedMax,
                    source: '훈련 기록'
                };
            })
            .sort(function (a, b) {
                return b.swingSpeedMax - a.swingSpeedMax;
            });
    }

    function mbFilterTrainingRowsByGrade(rows, g) {
        if (!g || !rows || !rows.length) return rows || [];
        return rows.filter(function (r) {
            return (r.memberGrade || '') === g;
        });
    }

    /** 운영 rankings.js 와 동일: 동일 등급 회원 등록 스윙 + 훈련 로그 최고값 병합 */
    function mbBuildSwingSpeedRanking(members, trainingLogRanking) {
        var memberMap = new Map();
        (members || []).forEach(function (member) {
            if (member.swingSpeed != null && member.swingSpeed > 0) {
                memberMap.set(member.id, {
                    memberId: member.id,
                    memberName: member.name,
                    memberNumber: member.memberNumber,
                    memberGrade: member.grade,
                    swingSpeed: member.swingSpeed,
                    source: '회원 등록 기록'
                });
            }
        });
        (trainingLogRanking || []).forEach(function (training) {
            var memberId = training.memberId;
            var trainingSwingSpeed = training.swingSpeedMax || 0;
            if (trainingSwingSpeed > 0) {
                var existing = memberMap.get(memberId);
                if (!existing || trainingSwingSpeed > existing.swingSpeed) {
                    memberMap.set(memberId, {
                        memberId: memberId,
                        memberName: training.memberName,
                        memberNumber: training.memberNumber,
                        memberGrade: training.memberGrade,
                        swingSpeed: trainingSwingSpeed,
                        source: '훈련 기록'
                    });
                }
            }
        });
        return Array.from(memberMap.values()).sort(function (a, b) {
            return b.swingSpeed - a.swingSpeed;
        });
    }

    function mbBuildTeeBallSpeedRanking(members, trainingLogRanking) {
        var memberMap = new Map();
        (members || []).forEach(function (member) {
            if (member.exitVelocity != null && member.exitVelocity > 0) {
                memberMap.set(member.id, {
                    memberId: member.id,
                    memberName: member.name,
                    memberNumber: member.memberNumber,
                    memberGrade: member.grade,
                    ballSpeedMax: member.exitVelocity,
                    source: '회원 등록 기록'
                });
            }
        });
        (trainingLogRanking || []).forEach(function (training) {
            var memberId = training.memberId;
            var trainingBallSpeed = training.ballSpeedMax || 0;
            if (trainingBallSpeed > 0) {
                var existing = memberMap.get(memberId);
                if (!existing || trainingBallSpeed > existing.ballSpeedMax) {
                    memberMap.set(memberId, {
                        memberId: memberId,
                        memberName: training.memberName,
                        memberNumber: training.memberNumber,
                        memberGrade: training.memberGrade,
                        ballSpeedMax: trainingBallSpeed,
                        source: '훈련 기록'
                    });
                }
            }
        });
        return Array.from(memberMap.values()).sort(function (a, b) {
            return b.ballSpeedMax - a.ballSpeedMax;
        });
    }

    function mbMergedSwingForDisplay(members, trainingRows) {
        return mbBuildSwingSpeedRanking(members, trainingRows).map(function (x) {
            return {
                memberId: x.memberId,
                memberName: x.memberName,
                memberNumber: x.memberNumber,
                memberGrade: x.memberGrade,
                swingSpeedMax: x.swingSpeed,
                source: x.source
            };
        });
    }

    function mbMergedTeeForDisplay(members, trainingRows) {
        return mbBuildTeeBallSpeedRanking(members, trainingRows).map(function (x) {
            return {
                memberId: x.memberId,
                memberName: x.memberName,
                memberNumber: x.memberNumber,
                memberGrade: x.memberGrade,
                ballSpeedMax: x.ballSpeedMax,
                source: x.source
            };
        });
    }

    function mbRankingsDataEmpty(data) {
        if (!data) return true;
        if (mapSwingFromApi(data.swingSpeedRanking || []).length) return false;
        if ((data.ballSpeedRanking || []).length) return false;
        if ((data.pitchSpeedRanking || []).length) return false;
        if ((data.recordCountRanking || []).length) return false;
        return true;
    }

    /** 세션에 등급이 빠진 경우 등 — verify로 이름·등급 최신화 */
    async function mbRefreshCtxFromVerifyForRankings() {
        if (!ctx || !ctx.memberNumber) return;
        try {
            var fresh = await postVerify(String(ctx.memberNumber).trim());
            if (fresh && fresh.memberId != null) {
                ctx.memberId = fresh.memberId;
                if (fresh.name != null) ctx.name = fresh.name;
                if (fresh.grade != null) ctx.grade = String(fresh.grade).trim();
                saveCtx(ctx);
                syncMbPublicBookingContext();
                mbUpdateMemberUserMenuHint();
            }
        } catch (e) {
            /* 기존 ctx 유지 */
        }
    }

    async function loadMbRankings() {
        stripPublicRankingsAdminUi();
        if (!ctx || !ctx.memberNumber) {
            return;
        }
        await mbRefreshCtxFromVerifyForRankings();

        var nameEl = document.getElementById('mb-rankings-name');
        var numEl = document.getElementById('mb-rankings-num');
        var gradeDisplayEl = document.getElementById('mb-rankings-grade-display');
        var noteEl = document.getElementById('mb-rankings-grade-note');
        var periodEl = document.getElementById('mb-rankings-period');
        if (nameEl) nameEl.textContent = ctx.name || '회원';
        if (numEl) numEl.textContent = ctx.memberNumber ? '(' + ctx.memberNumber + ')' : '';

        var grade = (ctx.grade && String(ctx.grade).trim()) || '';
        if (gradeDisplayEl) {
            gradeDisplayEl.textContent = grade ? gradeLabelKo(grade) : '정보 없음';
        }

        var end = new Date().toISOString().split('T')[0];
        var start = '2000-01-01';

        var loading = '<p style="color: var(--text-muted); text-align: center;">불러오는 중…</p>';
        ['mb-swing-speed-ranking', 'mb-exit-velocity-ranking', 'mb-pitching-speed-ranking', 'mb-attendance-count-ranking'].forEach(
            function (id) {
                var n = document.getElementById(id);
                if (n) n.innerHTML = loading;
            }
        );

        if (!grade) {
            if (noteEl) {
                noteEl.textContent =
                    '회원 등급을 확인할 수 없습니다. 아래는 전체 등급 기준 랭킹입니다.';
            }
        } else if (noteEl) {
            noteEl.textContent =
                '본인 등급만 대상입니다. 스윙·타구는 운영 랭킹과 같이 «회원 등록 기록 + 훈련 기록»을 병합합니다. 해당 등급 훈련 기록이 없으면 전체 등급 기준으로 보조 표시할 수 있습니다.';
        }

        function buildParams(withGrade) {
            var p = new URLSearchParams({
                startDate: start,
                endDate: end,
                days: '99999'
            });
            if (withGrade && grade) p.append('grade', grade);
            return p;
        }

        try {
            var apiBase = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
            var urlRankings = apiBase + '/training-logs/rankings?';

            async function fetchRankings(params) {
                var res = await fetch(urlRankings + params.toString(), {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (!res.ok) {
                    var msg = '랭킹을 불러오지 못했습니다.';
                    try {
                        var errBody = await res.json();
                        if (errBody && (errBody.error || errBody.message)) {
                            msg = String(errBody.error || errBody.message);
                        }
                    } catch (e2) {}
                    throw new Error(msg);
                }
                return res.json();
            }

            var data = await fetchRankings(buildParams(!!grade));

            var usedFallback = false;
            if (grade && mbRankingsDataEmpty(data)) {
                var dataAll = await fetchRankings(buildParams(false));
                if (!mbRankingsDataEmpty(dataAll)) {
                    data = dataAll;
                    usedFallback = true;
                    if (noteEl) {
                        noteEl.textContent =
                            '본인 등급(' +
                            gradeLabelKo(grade) +
                            ')으로 집계된 훈련 기록이 없어, 전체 등급 기준 상위 랭킹을 표시합니다.';
                    }
                }
            }

            if (periodEl) {
                if (usedFallback) {
                    periodEl.innerHTML =
                        '<strong>전체 기간</strong> · 구속·훈련 횟수: 전체 등급 · 스윙·타구: ' +
                        (grade
                            ? '<strong>' + mbEscHtml(gradeLabelKo(grade)) + '</strong> 등급만 (등록+훈련 병합)'
                            : '전체 등급');
                } else if (grade) {
                    periodEl.innerHTML =
                        '<strong>전체 기간</strong> · <strong>' +
                        mbEscHtml(gradeLabelKo(grade)) +
                        '</strong> 등급 — 스윙·타구: 등록+훈련 병합 / 구속·횟수: 훈련 기록';
                } else {
                    periodEl.innerHTML = '<strong>전체 기간</strong> · 전체 등급 집계 (훈련 기록)';
                }
            }

            var peerMembers = [];
            if (grade) {
                try {
                    var pr = await fetch(
                        apiUrl('/ranking-peers?memberNumber=' + encodeURIComponent(String(ctx.memberNumber).trim())),
                        { headers: { 'ngrok-skip-browser-warning': 'true' } }
                    );
                    if (pr.ok) {
                        var pj = await pr.json();
                        peerMembers = pj.members || [];
                    }
                } catch (ePeer) {}
            }

            var swingTraining = data.swingSpeedRanking || [];
            var ballTraining = data.ballSpeedRanking || [];
            if (usedFallback && grade) {
                swingTraining = mbFilterTrainingRowsByGrade(swingTraining, grade);
                ballTraining = mbFilterTrainingRowsByGrade(ballTraining, grade);
            }

            var swingRows;
            var teeRows;
            if (grade) {
                swingRows = mbMergedSwingForDisplay(peerMembers, swingTraining);
                teeRows = mbMergedTeeForDisplay(peerMembers, ballTraining);
            } else {
                swingRows = mapSwingFromApi(data.swingSpeedRanking || []);
                teeRows = data.ballSpeedRanking || [];
            }

            var myMid = ctx.memberId != null ? ctx.memberId : null;
            mbRenderRankingTop5AndSelf(
                'mb-swing-speed-ranking',
                swingRows,
                'swingSpeedMax',
                'mph',
                grade ? '' : '훈련 기록',
                myMid
            );

            mbRenderRankingTop5AndSelf(
                'mb-exit-velocity-ranking',
                teeRows,
                'ballSpeedMax',
                'mph',
                grade ? '' : '훈련 기록',
                myMid
            );

            mbRenderRankingTop5AndSelf(
                'mb-pitching-speed-ranking',
                data.pitchSpeedRanking || [],
                'pitchSpeedMax',
                'km/h',
                '훈련 기록',
                myMid
            );

            mbRenderRankingTop5AndSelf(
                'mb-attendance-count-ranking',
                data.recordCountRanking || [],
                'totalRecords',
                '',
                '훈련 기록',
                myMid
            );
        } catch (e) {
            var err = '<div class="ranking-empty">' + mbEscHtml(e.message || '랭킹을 불러오지 못했습니다.') + '</div>';
            ['mb-swing-speed-ranking', 'mb-exit-velocity-ranking', 'mb-pitching-speed-ranking', 'mb-attendance-count-ranking'].forEach(
                function (id) {
                    var n = document.getElementById(id);
                    if (n) n.innerHTML = err;
                }
            );
        }
    }

    function getSelectedPass() {
        var sel = document.getElementById('pass-select');
        if (!ctx) return DEFAULT_PASS_VIEW;
        if (!ctx.passes || !ctx.passes.length) return DEFAULT_PASS_VIEW;
        if (!sel) return ctx.passes[0];
        var i = parseInt(sel.value, 10);
        if (isNaN(i) || !ctx.passes[i]) return ctx.passes[0];
        return ctx.passes[i];
    }

    function hasBookablePass() {
        return !!(ctx && ctx.passes && ctx.passes.length > 0);
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function mbLocalDateStrFromIso(isoStr) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    /** 달력에 이미 로드된 예약으로 :30 종료 시각 추출(보조). 전체 반영은 occupancy-half-hour-starts API 사용 */
    function mbHalfHourStartMinutesFromCalendarBookings(facilityId, dateStr) {
        var extra = [];
        if (!facilityId || !dateStr || !mbLastRawBookings || !mbLastRawBookings.length) return extra;
        mbLastRawBookings.forEach(function (b) {
            if (!b || !b.endTime || !b.facility || !b.facility.id) return;
            if (String(b.facility.id) !== String(facilityId)) return;
            if (b.status === 'CANCELLED') return;
            if (mbLocalDateStrFromIso(b.endTime) !== dateStr) return;
            var et = new Date(b.endTime);
            if (isNaN(et.getTime())) return;
            if (et.getMinutes() !== 30) return;
            var startMin = et.getHours() * 60 + et.getMinutes();
            if (extra.indexOf(startMin) < 0) extra.push(startMin);
        });
        return extra;
    }

    function localDateTimeStr(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
    }

    async function postVerify(memberNumber) {
        var res = await fetch(apiUrl('/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ memberNumber: memberNumber })
        });
        var data = null;
        try {
            data = await res.json();
        } catch (e) {
            data = { error: '응답을 읽을 수 없습니다.' };
        }
        if (!res.ok) {
            throw new Error(data.error || '회원 확인에 실패했습니다.');
        }
        return data;
    }

    /** API memberProduct에 실어준 coachId/coachName (이용권·상품 담당 코치) */
    function mbCoachFromMemberProductBooking(booking) {
        var mp = booking.memberProduct;
        if (!mp || mp.coachId == null || mp.coachId === '') return null;
        return { id: mp.coachId, name: mp.coachName || '' };
    }

    /** 이용권(ctx.passes)에 연결된 코치 — 예약에 coach가 비어 있을 때 운영 캘린더와 동일 색상 */
    function mbCoachFromPassForBooking(booking) {
        if (!ctx || !ctx.passes || !booking.memberProduct || booking.memberProduct.id == null) return null;
        var mid = booking.memberProduct.id;
        for (var i = 0; i < ctx.passes.length; i++) {
            var p = ctx.passes[i];
            if (p.memberProductId != null && String(p.memberProductId) === String(mid) && p.coachId != null) {
                return { id: p.coachId, name: p.coachName || p.coachDisplayName || '' };
            }
        }
        return null;
    }

    /**
     * 운영 bookings.js: booking.coach → member.coach 와 동일 우선순위,
     * 그다음 이용권(회원상품)·상품 코치(API) → 세션 passes 보강.
     */
    function mbResolveCoachForBooking(booking) {
        if (!booking) return null;
        var a = booking.coach;
        var b = booking.member && booking.member.coach;
        var passC = mbCoachFromPassForBooking(booking);
        var mpC = mbCoachFromMemberProductBooking(booking);
        if (a && a.id != null && (!a.name || String(a.name).trim() === '')) {
            if (b && b.id != null && String(a.id) === String(b.id) && b.name) {
                return { id: a.id, name: b.name, specialties: a.specialties != null ? a.specialties : b.specialties };
            }
            if (passC && passC.id != null && String(passC.id) === String(a.id) && passC.name) {
                return { id: a.id, name: passC.name, specialties: a.specialties != null ? a.specialties : undefined };
            }
            if (mpC && mpC.id != null && String(mpC.id) === String(a.id) && mpC.name) {
                return { id: a.id, name: mpC.name };
            }
        }
        if (a) return a;
        if (b) return b;
        if (mpC) return mpC;
        return passC || null;
    }

    /** 캘린더 블록: 보유 이용권에 연결된 코치만 시간 옆에 표시 (다른 코치 슬롯은 이름 생략) */
    function mbCoachLabelSuffix(booking) {
        var passCoachIds = getPassCoachIdSetFromCtx();
        if (!passCoachIds.size) return '';
        var c = mbResolveCoachForBooking(booking);
        if (!c || c.id == null) return '';
        if (!passCoachIds.has(String(c.id))) return '';
        var idStr = String(c.id);
        var label = '';
        if (ctx && ctx.passes) {
            for (var i = 0; i < ctx.passes.length; i++) {
                var p = ctx.passes[i];
                if (p.coachId != null && String(p.coachId) === idStr) {
                    label = (p.coachDisplayName || p.coachName || '').trim();
                    break;
                }
            }
        }
        if (!label && c.name) label = String(c.name).trim();
        return label ? ' · ' + label : '';
    }

    /** 예약 객체에서 코치 식별 (원본 bookings.js + mbResolveCoachForBooking) */
    function bookingCoachKey(b) {
        if (!b) return 'unassigned';
        var coach = mbResolveCoachForBooking(b);
        return coach && coach.id != null ? coach.id : 'unassigned';
    }

    function bookingCoachKeyStr(b) {
        var k = bookingCoachKey(b);
        return k === 'unassigned' ? 'unassigned' : String(k);
    }

    function filterBookingsByCoachSet(bookings) {
        if (!mbCalendarFilterCoachIds || mbCalendarFilterCoachIds.size === 0) return bookings || [];
        return (bookings || []).filter(function (b) {
            return mbCalendarFilterCoachIds.has(bookingCoachKeyStr(b));
        });
    }

    function bookingsInCalendarMonth(bookings, y, m) {
        return (bookings || []).filter(function (b) {
            if (!b || !b.startTime) return false;
            var d = new Date(b.startTime);
            return d.getFullYear() === y && d.getMonth() === m;
        });
    }

    function buildMbStatsByCoach(bookingsInMonth) {
        var map = {};
        bookingsInMonth.forEach(function (b) {
            var coach = mbResolveCoachForBooking(b);
            var key = coach && coach.id != null ? String(coach.id) : 'unassigned';
            if (!map[key]) {
                map[key] = {
                    coachId: coach && coach.id != null ? coach.id : null,
                    coachName: coach ? coach.name || '(미배정)' : '(미배정)',
                    specialties: coach && coach.specialties ? coach.specialties : '',
                    count: 0
                };
            }
            map[key].count++;
        });
        var arr = Object.keys(map).map(function (k) {
            return map[k];
        });
        arr.sort(function (a, b) {
            return b.count - a.count;
        });
        return arr;
    }

    function getPassCoachIdSetFromCtx() {
        var s = new Set();
        if (!ctx || !ctx.passes || !ctx.passes.length) return s;
        ctx.passes.forEach(function (p) {
            if (p.coachId != null && p.coachId !== undefined) {
                s.add(String(p.coachId));
            }
        });
        return s;
    }

    /** 코치 칩: 보유 회원권(이용권)에 담당 코치로 연결된 경우만 표시 */
    function filterByCoachByPasses(byCoachArr) {
        var allowed = getPassCoachIdSetFromCtx();
        if (!allowed.size) return [];
        return (byCoachArr || []).filter(function (c) {
            if (c.coachId == null) return false;
            return allowed.has(String(c.coachId));
        });
    }

    function mbPassSpecialtiesForCoachId(coachId) {
        if (!ctx || !ctx.passes || coachId == null) return '';
        for (var i = 0; i < ctx.passes.length; i++) {
            var p = ctx.passes[i];
            if (p.coachId != null && String(p.coachId) === String(coachId) && p.coachSpecialties) {
                return p.coachSpecialties;
            }
        }
        return '';
    }

    /** 회원권에 없는 코치·미배정은 칩 필터에서 제거 */
    function mbPruneCoachFilterSet() {
        var allowed = getPassCoachIdSetFromCtx();
        if (!mbCalendarFilterCoachIds || mbCalendarFilterCoachIds.size === 0) return;
        var toRemove = [];
        mbCalendarFilterCoachIds.forEach(function (k) {
            if (k === 'unassigned') toRemove.push(k);
            else if (!allowed.has(String(k))) toRemove.push(k);
        });
        toRemove.forEach(function (k) {
            mbCalendarFilterCoachIds.delete(k);
        });
    }

    /** 본인 예약만 통계에 포함 (타인 비식별 슬롯 제외) — 같은 회원이면 운영·회원 예약 모두 포함 */
    function isViewerBooking(b) {
        if (!b) return false;
        if (b.calendarPrivacyMasked) return false;
        if (ctx && ctx.memberId != null && b.member && String(b.member.id) === String(ctx.memberId)) return true;
        return false;
    }

    /** 회원 공개 페이지에서 본인이 직접 예약한 건만(M 배지). 코치가 운영 페이지에서 잡은 예약(ADMIN)은 false */
    function isMemberWebSelfBooking(b) {
        if (!isViewerBooking(b)) return false;
        var src = b.bookingSource != null ? String(b.bookingSource).trim().toUpperCase() : '';
        return src === 'MEMBER_WEB';
    }

    function computeMbStats(rawBookings, y, m) {
        var inMonth = bookingsInCalendarMonth(rawBookings, y, m);
        var mineOnly = inMonth.filter(isViewerBooking);
        var total = mineOnly.length;
        var pendingCount = mineOnly.filter(function (b) {
            return b.status === 'PENDING';
        }).length;
        var byCoach = filterByCoachByPasses(buildMbStatsByCoach(mineOnly));
        return {
            monthLabel: y + '년 ' + (m + 1) + '월',
            totalCount: total,
            pendingCount: pendingCount,
            byCoach: byCoach
        };
    }

    function mbCoachChipLabelText(c) {
        var name = c.coachName || '(미배정)';
        var count = c.count || 0;
        var specRaw = c.specialties || mbPassSpecialtiesForCoachId(c.coachId) || '';
        var spec = specRaw.split(/[,，]/)[0].trim();
        var role = spec ? ' [' + spec + '] ' : ' ';
        return name + role + count + '건';
    }

    function redrawMbCalendarCellsOnly() {
        var grid = document.getElementById('calendar-grid');
        if (!grid || !mbLastRawBookings || !mbCalGridState) return;
        var st = mbCalGridState;
        renderMbBookingStats(mbLastStatsData);
        grid.innerHTML = '';
        var days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach(function (day, idx) {
            var header = document.createElement('div');
            header.className =
                'calendar-day-header' + (idx === 0 ? ' calendar-day-header-sun' : idx === 6 ? ' calendar-day-header-sat' : '');
            header.textContent = day;
            grid.appendChild(header);
        });
        var filtered = filterBookingsByCoachSet(mbLastRawBookings);
        var endD = new Date(st.startDate);
        endD.setDate(endD.getDate() + st.totalCells - 1);
        var ymd =
            typeof App === 'undefined' || !App.formatLocalYmd
                ? function (d) {
                      return (
                          d.getFullYear() +
                          '-' +
                          String(d.getMonth() + 1).padStart(2, '0') +
                          '-' +
                          String(d.getDate()).padStart(2, '0')
                      );
                  }
                : App.formatLocalYmd;
        mbLoadCalendarMarksMap(ymd(st.startDate), ymd(endD)).then(function (m) {
            mbCalendarMarksMap = m;
            mbPaintCalendarCells(grid, filtered, st.startDate, st.month, st.totalCells, m);
        });
    }

    function renderMbBookingStats(stats) {
        var container = document.getElementById('mb-bookings-stats-container');
        if (!container) return;
        mbLastStatsData = stats;
        var monthLabel = stats.monthLabel || '';
        var total = stats.totalCount != null ? stats.totalCount : 0;
        var pendingCount = stats.pendingCount != null ? stats.pendingCount : 0;
        var confirmedCount = Math.max(0, total - pendingCount);
        var byCoach = Array.isArray(stats.byCoach) ? stats.byCoach : [];
        var filterSet = mbCalendarFilterCoachIds;

        var totalStatusText = '확정 : ' + confirmedCount + '건 / 대기 : ' + pendingCount + '건';
        var html = '<div class="bookings-stats-row">';
        html += '<div class="bookings-stats-total-group">';
        html +=
            '<div class="bookings-stats-total"><span class="bookings-stats-label">' +
            App.escapeHtml(monthLabel) +
            ' 본인 예약</span><span class="bookings-stats-value">' +
            total +
            '건</span><span class="bookings-stats-status">' +
            totalStatusText +
            '</span></div>';
        html +=
            ' <span class="bookings-stats-pending" role="button" tabindex="0" data-pending-count="' +
            pendingCount +
            '" title="클릭 시 본인 승인 대기 예약 안내">승인이 완료되지 않은 본인 예약 ' +
            pendingCount +
            '건</span>';
        html += '</div>';
        if (byCoach.length > 0) {
            html += '<div class="bookings-stats-by-coach">';
            byCoach.forEach(function (c) {
                var coachKey = c.coachId != null ? c.coachId : 'unassigned';
                var selKey = coachKey === 'unassigned' ? 'unassigned' : String(coachKey);
                var isSelected = filterSet.has(selKey);
                var coachColor =
                    c.coachId && App.CoachColors && App.CoachColors.getColor({ id: c.coachId, name: c.coachName })
                        ? App.CoachColors.getColor({ id: c.coachId, name: c.coachName })
                        : null;
                var style = coachColor
                    ? 'border-left: 4px solid ' +
                      coachColor +
                      '; background: ' +
                      coachColor +
                      '22; color: ' +
                      coachColor +
                      ';'
                    : '';
                var selectedClass = isSelected ? ' bookings-stats-coach-item--selected' : '';
                var label = mbCoachChipLabelText(c);
                html +=
                    '<span class="bookings-stats-coach-item' +
                    selectedClass +
                    '" data-coach-id="' +
                    coachKey +
                    '" role="button" tabindex="0" title="클릭: 해당 코치만 보기, Ctrl+클릭: 다중 선택"' +
                    (style ? ' style="' + style + '"' : '') +
                    '>' +
                    App.escapeHtml(label) +
                    '</span>';
            });
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;

        if (!mbStatsEventsBound) {
            mbStatsEventsBound = true;
            container.addEventListener('click', function (e) {
                if (e.target.closest('.bookings-stats-pending')) {
                    var y = currentDate.getFullYear();
                    var mo = currentDate.getMonth();
                    var pend = bookingsInCalendarMonth(mbLastRawBookings || [], y, mo).filter(function (b) {
                        return b.status === 'PENDING' && isViewerBooking(b);
                    });
                    if (pend.length === 0) {
                        alert('승인 대기 예약이 없습니다.');
                        return;
                    }
                    var lines = pend.slice(0, 12).map(function (b) {
                        var st = new Date(b.startTime);
                        return (
                            st.getMonth() +
                            1 +
                            '/' +
                            st.getDate() +
                            ' ' +
                            pad(st.getHours()) +
                            ':' +
                            pad(st.getMinutes()) +
                            ' (대기)'
                        );
                    });
                    alert(
                        '승인 대기 ' +
                            pend.length +
                            '건\n\n데스크에서 승인되면 확정됩니다.\n\n' +
                            lines.join('\n')
                    );
                    return;
                }
                var item = e.target.closest('.bookings-stats-coach-item');
                if (!item) return;
                var rawId = item.getAttribute('data-coach-id');
                var coachKey = rawId === 'unassigned' ? 'unassigned' : String(parseInt(rawId, 10) || rawId);
                if (e.ctrlKey || e.metaKey) {
                    if (mbCalendarFilterCoachIds.has(coachKey)) mbCalendarFilterCoachIds.delete(coachKey);
                    else mbCalendarFilterCoachIds.add(coachKey);
                } else {
                    if (mbCalendarFilterCoachIds.size === 1 && mbCalendarFilterCoachIds.has(coachKey)) {
                        mbCalendarFilterCoachIds.clear();
                    } else {
                        mbCalendarFilterCoachIds.clear();
                        mbCalendarFilterCoachIds.add(coachKey);
                    }
                }
                redrawMbCalendarCellsOnly();
            });
            container.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                var pendingEl = e.target.closest('.bookings-stats-pending');
                if (pendingEl) {
                    e.preventDefault();
                    pendingEl.click();
                    return;
                }
                var item = e.target.closest('.bookings-stats-coach-item');
                if (!item) return;
                e.preventDefault();
                item.click();
            });
        }
    }

    function mbBranchLabel(br) {
        if (br == null || br === '') return '';
        var u = String(br).toUpperCase();
        if (u === 'YEONSAN') return '연산';
        if (u === 'RENTAL') return '대관';
        return '사하';
    }

    /** 원본 bookings.js getCoachColor 와 동일 — 캘린더 블록 배경·테두리 */
    function mbGetCoachColor(coach) {
        try {
            if (!coach) return null;
            /* bookings.js getCoachColor 와 동일 — window.App 은 const App 에서 비어 있을 수 있음 */
            if (typeof App !== 'undefined' && App.CoachColors && typeof App.CoachColors.getColor === 'function') {
                return App.CoachColors.getColor(coach);
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function mbPaintCalendarCells(grid, bookings, startDate, month, totalCells, marksMap) {
        marksMap = marksMap || {};
        var ymd =
            typeof App === 'undefined' || !App.formatLocalYmd
                ? function (d) {
                      return (
                          d.getFullYear() +
                          '-' +
                          String(d.getMonth() + 1).padStart(2, '0') +
                          '-' +
                          String(d.getDate()).padStart(2, '0')
                      );
                  }
                : App.formatLocalYmd;
        var current = new Date(startDate);
        for (var i = 0; i < totalCells; i++) {
            (function (cellDate) {
                var dayCell = document.createElement('div');
                dayCell.className = 'calendar-day';
                var dow = cellDate.getDay();
                if (dow === 0) dayCell.classList.add('calendar-day-sun');
                else if (dow === 6) dayCell.classList.add('calendar-day-sat');
                if (cellDate.getMonth() !== month) dayCell.classList.add('other-month');

                var dayBookings = (bookings || []).filter(function (b) {
                    if (!b || !b.startTime) return false;
                    var bd = new Date(b.startTime);
                    return (
                        bd.getFullYear() === cellDate.getFullYear() &&
                        bd.getMonth() === cellDate.getMonth() &&
                        bd.getDate() === cellDate.getDate()
                    );
                });

                var dayHeader = document.createElement('div');
                dayHeader.className = 'mb-cal-day-header';
                dayHeader.style.display = 'flex';
                dayHeader.style.justifyContent = 'space-between';
                var dayNumber = document.createElement('div');
                dayNumber.className = 'calendar-day-number mb-cal-day-num';
                dayNumber.textContent = cellDate.getDate();
                var dk = ymd(cellDate);
                var mk = marksMap[dk];
                var markMemo = mk ? String(mk.memo || '').trim() : '';
                if (mk) {
                    if (mk.redDay) dayNumber.classList.add('calendar-day-number--holiday-red');
                    if (markMemo) {
                        dayNumber.title = markMemo + ' · 이 날짜로 새 예약 등록';
                    } else {
                        dayNumber.title = '이 날짜로 새 예약 등록';
                    }
                } else {
                    dayNumber.title = '이 날짜로 새 예약 등록';
                }
                dayNumber.setAttribute('role', 'button');
                dayNumber.setAttribute('tabindex', '0');
                dayNumber.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openBookingModal(cellDate, true);
                });
                dayNumber.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        openBookingModal(cellDate, true);
                    }
                });
                var dayNumCol = document.createElement('div');
                dayNumCol.style.display = 'flex';
                dayNumCol.style.flexDirection = 'column';
                dayNumCol.style.alignItems = 'flex-start';
                dayNumCol.style.minWidth = '0';
                dayNumCol.appendChild(dayNumber);
                if (markMemo) {
                    var memoLine = document.createElement('div');
                    memoLine.className = 'mb-cal-mark-memo';
                    memoLine.textContent = markMemo.length > 24 ? markMemo.slice(0, 24) + '…' : markMemo;
                    memoLine.title = markMemo;
                    memoLine.setAttribute('aria-hidden', 'true');
                    dayNumCol.appendChild(memoLine);
                }
                dayHeader.appendChild(dayNumCol);
                dayCell.appendChild(dayHeader);

                dayBookings.sort(function (a, b) {
                    return new Date(a.startTime) - new Date(b.startTime);
                });
                dayBookings.forEach(function (booking) {
                    var ev = document.createElement('div');
                    ev.className = 'calendar-event';
                    var st = new Date(booking.startTime);
                    var et = new Date(booking.endTime);
                    var timeStr =
                        pad(st.getHours()) +
                        ':' +
                        pad(st.getMinutes()) +
                        ' - ' +
                        pad(et.getHours()) +
                        ':' +
                        pad(et.getMinutes());

                    var name = booking.member ? booking.member.name : booking.nonMemberName || '비회원';
                    var brL = mbBranchLabel(booking.branch);
                    var coachSuffix = mbCoachLabelSuffix(booking);
                    var isMine = isViewerBooking(booking);
                    var showMSelfBadge = isMemberWebSelfBooking(booking);
                    var brPrefix = aggregateCalendar && brL ? '[' + brL + '] ' : '';
                    /** 타인 예약: 시간·코치 / 이름. 본인 예약(운영·회원웹): 회원 캘린더에서 이름 미표시 */
                    var lineRestFull = timeStr + coachSuffix + ' / ' + name;
                    var lineRestMine = timeStr + coachSuffix;
                    /** 텍스트 fallback(타인·마스크 등) */
                    var line =
                        (showMSelfBadge ? 'M ' : '') + brPrefix + (isMine ? lineRestMine : lineRestFull);

                    /* 본인(회원번호로 조회된 본인) 예약만 코치 색 — 타인·비식별은 회색만 */
                    if (!isMine) {
                        ev.classList.add('mb-cal-event--masked');
                        ev.style.cursor = 'default';
                        if (booking.calendarPrivacyMasked) {
                            ev.textContent = timeStr + coachSuffix;
                            ev.title = coachSuffix
                                ? '다른 회원 예약 · 코치 기준으로 시간대 확인'
                                : '다른 회원 예약 · 시간만 표시';
                        } else {
                            ev.textContent = line;
                            ev.title = '';
                        }
                        ev.addEventListener('click', function (e) {
                            e.stopPropagation();
                        });
                        dayCell.appendChild(ev);
                        return;
                    }

                    var coach = mbResolveCoachForBooking(booking);
                    var coachColor = mbGetCoachColor(coach);
                    if (coachColor) {
                        /* bookings.css .booking-event--unassigned 가 background !important 이므로 동일 우선순위로 덮음 */
                        ev.style.setProperty('background-color', coachColor, 'important');
                        ev.style.setProperty('border-left', '3px solid ' + coachColor, 'important');
                        ev.style.setProperty('color', 'rgba(255,255,255,0.95)', 'important');
                    } else {
                        ev.style.setProperty('background-color', '#22242b', 'important');
                        ev.style.setProperty('border-left', '3px solid #3d4152', 'important');
                        ev.style.setProperty('color', '#e8e8e8', 'important');
                        ev.classList.add('booking-event--unassigned');
                    }

                    ev.style.cursor = 'pointer';
                    ev.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (booking.id != null) mbOpenBookingDetailModal(booking.id);
                    });
                    if (showMSelfBadge) {
                        var badge = document.createElement('span');
                        badge.className = 'mb-cal-mine-badge';
                        badge.setAttribute('aria-label', '회원 페이지에서 본인이 예약');
                        badge.textContent = 'M';
                        ev.appendChild(badge);
                    } else {
                        var badgeSlot = document.createElement('span');
                        badgeSlot.className = 'mb-cal-mine-badge-slot';
                        badgeSlot.setAttribute('aria-hidden', 'true');
                        ev.appendChild(badgeSlot);
                    }
                    if (brPrefix) {
                        ev.appendChild(document.createTextNode(brPrefix));
                    }
                    ev.appendChild(document.createTextNode(lineRestMine));
                    dayCell.appendChild(ev);
                });

                dayCell.addEventListener('click', function () {
                    openBookingModal(cellDate, true);
                });

                grid.appendChild(dayCell);
            })(new Date(current));
            current.setDate(current.getDate() + 1);
        }
    }

    function fillPassSelect() {
        var sel = document.getElementById('pass-select');
        if (!sel || !ctx) return;
        sel.innerHTML = '';
        if (!ctx.passes || !ctx.passes.length) {
            var opt0 = document.createElement('option');
            opt0.value = '-1';
            opt0.textContent = '보유 이용권 없음 (일정 확인만 가능)';
            sel.appendChild(opt0);
            sel.disabled = true;
            return;
        }
        sel.disabled = false;
        ctx.passes.forEach(function (p, idx) {
            var opt = document.createElement('option');
            opt.value = String(idx);
            // 서버가 회원 목록과 동일 규칙으로 만든 문구 (야구레슨 10회권 : 10회, 트레이닝 요금제 : ~ 2026. 04. 05., …)
            var coachFallback = p.coachDisplayName || p.coachName;
            var branchFallback = p.coachBranchLabel || '';
            var fallbackLine =
                (p.productName || '이용권') +
                (coachFallback ? ', ' + coachFallback : '') +
                (branchFallback ? ', ' + branchFallback : '');
            opt.textContent = p.optionLabel || p.displayLine || fallbackLine;
            sel.appendChild(opt);
        });
    }

    /** 현재 셀렉트된 이용권의 코치 담당 지점 코드만 (SAHA / YEONSAN / RENTAL) */
    function mbBranchCodesForSelectedPass() {
        var set = new Set();
        if (!ctx || !ctx.passes || !ctx.passes.length) return set;
        var p = getSelectedPass();
        if (!p || !Array.isArray(p.coachBranchCodes)) return set;
        p.coachBranchCodes.forEach(function (c) {
            if (c != null && String(c).trim() !== '') set.add(String(c).trim().toUpperCase());
        });
        return set;
    }

    /** 이용권에 실린 coachBranchCodes에 대관(RENTAL)이 포함되는지 */
    function mbPassCoachBranchCodesIncludeRental(p) {
        if (!p || !Array.isArray(p.coachBranchCodes)) return false;
        return p.coachBranchCodes.some(function (c) {
            return String(c != null ? c : '')
                .trim()
                .toUpperCase() === 'RENTAL';
        });
    }

    /**
     * 이용권(pass)과 사이드바 링크(href의 branch·facilityType·lessonCategory)가 같은 예약 종목인지.
     * 담당 코치 지점에 대관이 있으면 대관 메뉴도 함께 표시(coachBranchCodes에 RENTAL).
     */
    function mbPassMatchesCalMenuLink(p, anchorEl) {
        if (!p || !anchorEl) return true;
        var href = anchorEl.getAttribute('href') || '';
        var ft;
        var lc;
        try {
            var u = new URL(href, window.location.origin);
            ft = (u.searchParams.get('facilityType') || '').toUpperCase();
            lc = (u.searchParams.get('lessonCategory') || '').toUpperCase();
        } catch (e) {
            return true;
        }
        var pFt = (p.facilityType || '').toUpperCase();
        var pLc = (p.lessonCategory || '').toUpperCase();
        var purpose = (p.purpose || '').toUpperCase();

        if (purpose === 'RENTAL' || pFt === 'RENTAL') {
            return ft === 'RENTAL';
        }
        if (ft === 'RENTAL') {
            return mbPassCoachBranchCodesIncludeRental(p);
        }
        if (ft === 'TRAINING_FITNESS') {
            return pFt === 'TRAINING_FITNESS';
        }
        if (ft === 'BASEBALL') {
            if (pFt !== 'BASEBALL') return false;
            if (lc === 'YOUTH_BASEBALL') {
                return pLc === 'YOUTH_BASEBALL';
            }
            return pLc !== 'YOUTH_BASEBALL';
        }
        return true;
    }

    /**
     * 선택 이용권 기준: coachBranchCodes에 있는 지점만 표시, 그 안에서 이용권 종목(야구/유소년/트레이닝/대관)에 맞는 링크만 표시.
     * 접기 UI 없음(<details> 사용 안 함).
     * coachBranchCodes 없음(구 API) → 지점 블록 전체 숨김.
     */
    function applySidebarBranchMenusVisibility() {
        var groups = document.querySelectorAll('.mb-cal-menu-group[data-mb-branch-group]');
        if (!ctx || !ctx.passes || !ctx.passes.length) {
            groups.forEach(function (g) {
                g.style.display = '';
                g.querySelectorAll('a[data-mb-cal]').forEach(function (a) {
                    a.style.display = '';
                });
            });
            return;
        }
        var p = getSelectedPass();
        if (!p || !Array.isArray(p.coachBranchCodes)) {
            groups.forEach(function (g) {
                g.style.display = 'none';
            });
            return;
        }
        var allowed = mbBranchCodesForSelectedPass();
        var hasAny = allowed.size > 0;
        groups.forEach(function (g) {
            var code = (g.getAttribute('data-mb-branch-group') || '').toUpperCase();
            var branchOk = hasAny && allowed.has(code);
            if (!branchOk) {
                g.style.display = 'none';
                return;
            }
            var anyShown = false;
            g.querySelectorAll('a[data-mb-cal]').forEach(function (a) {
                var show = mbPassMatchesCalMenuLink(p, a);
                a.style.display = show ? '' : 'none';
                if (show) anyShown = true;
            });
            g.style.display = anyShown ? '' : 'none';
        });
    }

    function updateBookingButtonsEnabled() {
        var btnNew = document.getElementById('btn-booking-new');
        if (!btnNew) return;
        if (aggregateCalendar) {
            btnNew.disabled = true;
            btnNew.title =
                '회원 예약 종합에서는 일정만 확인할 수 있습니다. 왼쪽 메뉴에서 지점·종목을 선택한 뒤 예약해 주세요.';
            return;
        }
        var canBook = hasBookablePass();
        btnNew.disabled = !canBook;
        btnNew.title = canBook ? '' : '사용 가능한 이용권이 있을 때만 예약할 수 있습니다.';
    }

    function setBranchTab(b) {
        branch = b;
        document.querySelectorAll('.mb-branch-tabs button').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-branch') === b);
        });
    }

    function hasUrlCalendarParams() {
        var q = new URLSearchParams(window.location.search);
        return q.has('branch') || q.has('facilityType');
    }

    /** URL ?branch=&facilityType=&lessonCategory= 반영 */
    function syncFromUrl() {
        var q = new URLSearchParams(window.location.search);
        if (!q.has('branch') && !q.has('facilityType')) {
            viewOverride = null;
            aggregateCalendar = true;
            return;
        }
        aggregateCalendar = false;
        branch = (q.get('branch') || 'SAHA').toUpperCase();
        var ft = (q.get('facilityType') || 'BASEBALL').toUpperCase();
        viewOverride = { facilityType: ft };
        if (q.has('lessonCategory')) {
            var lc = q.get('lessonCategory');
            viewOverride.lessonCategory = lc && lc.length ? lc.toUpperCase() : undefined;
        } else {
            viewOverride.lessonCategory = undefined;
        }
        setBranchTab(branch);
    }

    function getEffectiveFacilityType() {
        var pass = getSelectedPass();
        if (viewOverride && viewOverride.facilityType) return viewOverride.facilityType;
        return pass.facilityType || 'BASEBALL';
    }

    function getEffectiveLessonCategoryForCalendar() {
        var pass = getSelectedPass();
        if (viewOverride) {
            return viewOverride.lessonCategory;
        }
        return pass.lessonCategory || null;
    }

    function updatePageTitle() {
        var el = document.getElementById('mb-page-title');
        if (!el) return;
        if (mbView === 'rankings') {
            el.textContent = '🏆 훈련 랭킹 · 회원 등급';
            return;
        }
        if (mbView === 'announcements') {
            el.textContent = '📢 공지 · 메시지';
            return;
        }
        var calEl = document.getElementById('step-calendar');
        if (!ctx || !calEl || calEl.style.display === 'none') {
            el.textContent = '회원 예약 · 이용권';
            return;
        }
        if (aggregateCalendar) {
            el.textContent = '📋 회원 예약 종합 · 내 예약 전체';
            return;
        }
        var b = branch;
        var ft = getEffectiveFacilityType();
        var lc = getEffectiveLessonCategoryForCalendar();
        var branchLabel = b === 'YEONSAN' ? '연산점' : b === 'RENTAL' ? '대관' : '사하점';
        if (b === 'RENTAL' || ft === 'RENTAL') {
            el.textContent = '📍 ' + branchLabel + ' - 🏟️ 대관 예약';
            return;
        }
        if (ft === 'TRAINING_FITNESS') {
            el.textContent = '📍 ' + branchLabel + ' - 💪 트레이닝+필라테스';
            return;
        }
        if (lc === 'YOUTH_BASEBALL') {
            el.textContent = '📍 ' + branchLabel + ' - 👶 야구(유소년)';
            return;
        }
        el.textContent = '📍 ' + branchLabel + ' - ⚾ 야구 예약';
    }

    function highlightSidebarMenus() {
        var path = window.location.pathname || '';
        var cur = path + (window.location.search || '');
        document.querySelectorAll('a[data-mb-cal]').forEach(function (a) {
            var href = a.getAttribute('href');
            if (!href) return;
            try {
                var u = new URL(href, window.location.origin);
                var abs = u.pathname + u.search;
                a.classList.toggle('active', mbView === 'calendar' && cur === abs);
            } catch (e) {}
        });
        document.querySelectorAll('a[data-mb-home]').forEach(function (a) {
            var qs = window.location.search || '';
            var noQuery = qs.length === 0;
            a.classList.toggle('active', mbView === 'calendar' && noQuery && path.indexOf('member-booking') !== -1);
        });
        document.querySelectorAll('a[data-mb-rankings]').forEach(function (a) {
            a.classList.toggle('active', mbView === 'rankings');
        });
        document.querySelectorAll('a[data-mb-announcements]').forEach(function (a) {
            a.classList.toggle('active', mbView === 'announcements');
        });
    }

    function selectPassMatchingView() {
        if (!viewOverride || !ctx || !ctx.passes || !ctx.passes.length) return;
        var sel = document.getElementById('pass-select');
        if (!sel || sel.disabled) return;
        var ft = viewOverride.facilityType;
        var lc = viewOverride.lessonCategory;
        var best = -1;
        ctx.passes.forEach(function (p, i) {
            if (p.facilityType !== ft) return;
            if (lc === undefined) {
                if (p.lessonCategory === 'BASEBALL' || !p.lessonCategory) {
                    if (best < 0) best = i;
                }
            } else if (p.lessonCategory === lc) {
                if (best < 0) best = i;
            }
        });
        if (best < 0) {
            ctx.passes.forEach(function (p, i) {
                if (p.facilityType === ft && best < 0) best = i;
            });
        }
        if (best >= 0) sel.value = String(best);
    }

    /**
     * 회원이 고른 요금제(이용권)를 지점·종목 캘린더 전환 시에도 유지.
     * 세션에 저장된 memberProductId가 있으면 우선, 없으면 URL 뷰에 맞는 항목(selectPassMatchingView).
     */
    function applyPassSelectionFromStoredPreference() {
        var sel = document.getElementById('pass-select');
        if (!sel || sel.disabled || !ctx || !ctx.passes || !ctx.passes.length) return;
        var pref = ctx.selectedMemberProductId;
        if (pref != null && pref !== '') {
            for (var i = 0; i < ctx.passes.length; i++) {
                var p = ctx.passes[i];
                if (p.memberProductId != null && String(p.memberProductId) === String(pref)) {
                    sel.value = String(i);
                    return;
                }
            }
        }
        selectPassMatchingView();
    }

    function applyBranchForPass() {
        if (hasUrlCalendarParams()) return;
        var p = getSelectedPass();
        if (p && p.purpose === 'RENTAL') {
            setBranchTab('RENTAL');
            branch = 'RENTAL';
        }
    }

    function updatePassBanner() {
        var banner = document.getElementById('mb-pass-banner');
        if (!banner) return;
        if (ctx && ctx.passes && ctx.passes.length === 0) {
            banner.style.display = 'block';
            banner.textContent =
                '현재 사용 가능한 이용권이 없습니다. 예약 등록은 데스크에 문의해 주세요. 아래 달력에서는 일정만 확인할 수 있습니다.';
        } else {
            banner.style.display = 'none';
            banner.textContent = '';
        }
    }

    async function loadCalendarBookings() {
        var year = currentDate.getFullYear();
        var month = currentDate.getMonth();
        var firstDay = new Date(year, month, 1);
        var lastDay = new Date(year, month + 1, 0);
        var startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        var blankAtStart = firstDay.getDay();
        var daysInMonth = lastDay.getDate();
        var numRows = Math.ceil((blankAtStart + daysInMonth) / 7);
        var totalCells = numRows * 7;
        var endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + totalCells - 1);

        /**
         * API 조회: 달력 그리드 앞쪽(전월 회색 칸)은 범위에서 제외해도 됨 — 익월 초 며칠(다음 행)은 포함.
         * 예) 4월 화면에서 3월 말 칸에는 예약이 안 나와도 되고, 3월 화면에서 4월 초 며칠은 그대로 조회.
         */
        var queryStart = new Date(year, month, 1);
        queryStart.setHours(0, 0, 0, 0);
        var queryEnd = new Date(endDate);
        queryEnd.setHours(23, 59, 59, 999);

        var params = new URLSearchParams({
            start: queryStart.toISOString(),
            end: queryEnd.toISOString()
        });
        /** 항상 회원번호로 본인 예약만 조회 (지점·시설 필터는 추가로 적용) */
        if (ctx && ctx.memberNumber) {
            params.append('memberNumber', String(ctx.memberNumber).trim());
        }
        if (!aggregateCalendar) {
            var ft = getEffectiveFacilityType();
            var lc = getEffectiveLessonCategoryForCalendar();
            params.append('branch', branch);
            params.append('facilityType', ft || 'BASEBALL');
            if (lc) params.append('lessonCategory', lc);
        }

        var res = await fetch(apiUrl('/calendar') + '?' + params.toString(), {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) {
            throw new Error('예약 목록을 불러오지 못했습니다.');
        }
        return await res.json();
    }

    function renderCalendar() {
        var grid = document.getElementById('calendar-grid');
        var titleEl = document.getElementById('calendar-month-year');
        var stc = document.getElementById('mb-bookings-stats-container');
        if (!grid) return;

        if (stc) {
            stc.innerHTML = '<p class="bookings-stats-loading">불러오는 중…</p>';
        }

        var year = currentDate.getFullYear();
        var month = currentDate.getMonth();
        if (titleEl) titleEl.textContent = year + '년 ' + (month + 1) + '월';

        var firstDay = new Date(year, month, 1);
        var lastDay = new Date(year, month + 1, 0);
        var startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        var blankAtStart = firstDay.getDay();
        var daysInMonth = lastDay.getDate();
        var numRows = Math.ceil((blankAtStart + daysInMonth) / 7);
        var totalCells = numRows * 7;

        var ymdForMarks =
            typeof App === 'undefined' || !App.formatLocalYmd
                ? function (d) {
                      return (
                          d.getFullYear() +
                          '-' +
                          String(d.getMonth() + 1).padStart(2, '0') +
                          '-' +
                          String(d.getDate()).padStart(2, '0')
                      );
                  }
                : App.formatLocalYmd;

        loadCalendarBookings()
            .then(function (bookings) {
                mbLastRawBookings = bookings || [];
                mbCalGridState = { startDate: new Date(startDate), month: month, totalCells: totalCells };
                mbPruneCoachFilterSet();
                var stats = computeMbStats(mbLastRawBookings, year, month);
                renderMbBookingStats(stats);
                var filtered = filterBookingsByCoachSet(mbLastRawBookings);
                grid.innerHTML = '';
                var days = ['일', '월', '화', '수', '목', '금', '토'];
                days.forEach(function (day, idx) {
                    var header = document.createElement('div');
                    header.className =
                        'calendar-day-header' +
                        (idx === 0 ? ' calendar-day-header-sun' : idx === 6 ? ' calendar-day-header-sat' : '');
                    header.textContent = day;
                    grid.appendChild(header);
                });
                var endD = new Date(startDate);
                endD.setDate(endD.getDate() + totalCells - 1);
                return mbLoadCalendarMarksMap(ymdForMarks(startDate), ymdForMarks(endD)).then(function (m) {
                    mbCalendarMarksMap = m;
                    mbPaintCalendarCells(grid, filtered, startDate, month, totalCells, m);
                });
            })
            .catch(function (err) {
                if (stc) {
                    stc.innerHTML =
                        '<p class="bookings-stats-loading">' + (err.message || '달력을 불러오지 못했습니다.') + '</p>';
                }
                if (App.showNotification) App.showNotification(err.message || '달력 로드 실패', 'error');
                else alert(err.message || '달력 로드 실패');
            });
    }

    /** 👤 아래 글자 없음 — 클릭 시에만 회원 정보 모달. 이전 버전에서 붙은 라벨·래퍼 제거 */
    function mbCleanupMemberTopbarUserUi() {
        var usernameEl = document.getElementById('user-username');
        if (usernameEl && usernameEl.parentNode) {
            usernameEl.parentNode.removeChild(usernameEl);
        }
        var btn =
            document.getElementById('user-menu-btn') ||
            document.querySelector('.mb-member-topbar .user-menu-btn');
        if (!btn) return;
        var parent = btn.parentElement;
        if (parent && parent.classList.contains('user-info-container')) {
            var g = parent.parentElement;
            if (g) {
                g.insertBefore(btn, parent);
                parent.remove();
            }
        }
    }

    function mbUpdateMemberUserMenuHint() {
        var btn =
            document.getElementById('user-menu-btn') ||
            document.querySelector('.mb-member-topbar .user-menu-btn');
        if (!btn) return;
        if (ctx && ctx.memberNumber) {
            var name = (ctx.name && String(ctx.name).trim()) || '회원';
            btn.title = name + ' — 클릭하면 회원 정보';
        } else {
            btn.title = '클릭하면 안내';
        }
    }

    function mbCloseMemberUserModal() {
        var m = document.getElementById('mb-user-menu-modal');
        if (m) m.remove();
    }

    function mbShowMemberUserModal() {
        mbCloseMemberUserModal();
        var esc =
            typeof App !== 'undefined' && App && App.escapeHtml
                ? App.escapeHtml
                : function (s) {
                      return String(s != null ? s : '');
                  };
        var hasCtx = ctx && ctx.memberNumber;
        var footerBtns =
            '<button type="button" class="btn btn-secondary" id="mb-user-menu-close">닫기</button>';
        if (hasCtx) {
            footerBtns +=
                '<button type="button" class="btn btn-secondary" id="mb-user-menu-reset">회원번호 다시 입력</button>';
        }
        var nameHtml = '';
        var subHtml = '';
        if (!hasCtx) {
            subHtml =
                '<p style="font-size:14px;color:var(--text-secondary);line-height:1.5;margin:0 0 8px 0;">아직 회원번호를 입력하지 않았습니다.</p>' +
                '<p style="font-size:13px;color:var(--text-muted);line-height:1.45;margin:0;">1단계에서 회원번호를 확인하면 예약·공지·쪽지를 이용할 수 있습니다.</p>';
        } else {
            var dispName = esc((ctx.name && String(ctx.name).trim()) || '회원');
            var num = esc(String(ctx.memberNumber).trim());
            nameHtml =
                '<div style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px;">' +
                dispName +
                '</div>';
            subHtml =
                '<div style="font-size: 15px; color: var(--text-secondary); margin-bottom: 6px;">회원번호 <strong>' +
                num +
                '</strong></div>';
            var g = ctx.grade && String(ctx.grade).trim();
            if (g) {
                var gc = mbMemberGradeRankClass(g);
                subHtml +=
                    '<div style="margin-bottom: 12px;">' +
                    '<span class="ranking-grade-badge mb-user-modal-grade ranking-grade-' +
                    gc +
                    '">' +
                    esc(gradeLabelKo(g)) +
                    '</span></div>';
            }
            subHtml +=
                '<div style="font-size: 13px; color: var(--text-muted); margin-top: 12px;">회원 예약 페이지에서 확인 중인 본인 정보입니다.</div>';
        }
        var html =
            '<div id="mb-user-menu-modal" class="modal-overlay active" style="display: flex; align-items: center; justify-content: center;">' +
            '<div class="modal modal-compact" style="max-width: 400px;">' +
            '<div class="modal-header">' +
            '<h2 class="modal-title">회원 정보</h2>' +
            '<button type="button" class="modal-close" id="mb-user-menu-x" aria-label="닫기">&times;</button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<div class="user-menu-modal-body-inner" style="text-align:center;">' +
            '<div style="font-size: 52px; margin-bottom: 18px;">👤</div>' +
            nameHtml +
            subHtml +
            '</div></div>' +
            '<div class="modal-footer user-menu-modal-footer" style="justify-content:center;flex-wrap:wrap;gap:8px;">' +
            footerBtns +
            '</div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        var root = document.getElementById('mb-user-menu-modal');
        if (!root) return;
        function wireClose() {
            mbCloseMemberUserModal();
        }
        var c1 = document.getElementById('mb-user-menu-close');
        var x1 = document.getElementById('mb-user-menu-x');
        if (c1) c1.addEventListener('click', wireClose);
        if (x1) x1.addEventListener('click', wireClose);
        root.addEventListener('click', function (e) {
            if (e.target === root) wireClose();
        });
        var rst = document.getElementById('mb-user-menu-reset');
        if (rst) {
            rst.addEventListener('click', function () {
                mbCloseMemberUserModal();
                var b = document.getElementById('btn-reset-member');
                if (b) b.click();
            });
        }
    }

    function mbSetupMemberUserMenu() {
        var userMenuBtn =
            document.getElementById('user-menu-btn') ||
            document.querySelector('.mb-member-topbar .user-menu-btn');
        if (!userMenuBtn) return;
        mbCleanupMemberTopbarUserUi();
        if (userMenuBtn.getAttribute('data-mb-member-user-menu') !== '1') {
            userMenuBtn.setAttribute('data-mb-member-user-menu', '1');
            userMenuBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                mbShowMemberUserModal();
            });
        }
        mbUpdateMemberUserMenuHint();
    }

    function goToCalendarAfterVerify(data) {
        var prevCtx = loadCtx();
        ctx = data;
        if (!ctx.passes) ctx.passes = [];
        if (
            prevCtx &&
            prevCtx.memberNumber &&
            String(prevCtx.memberNumber) === String(ctx.memberNumber) &&
            prevCtx.selectedMemberProductId != null
        ) {
            ctx.selectedMemberProductId = prevCtx.selectedMemberProductId;
        }
        saveCtx(ctx);
        syncMbPublicBookingContext();
        document.getElementById('mb-name').textContent = ctx.name || '';
        document.getElementById('mb-num').textContent = '(' + (ctx.memberNumber || '') + ')';
        mbUpdateMemberUserMenuHint();
        syncFromUrl();
        fillPassSelect();
        applyPassSelectionFromStoredPreference();
        applyBranchForPass();
        updatePassBanner();
        updateBookingButtonsEnabled();
        var vm = document.getElementById('verify-msg');
        if (vm) {
            vm.textContent = '';
            vm.className = '';
        }
        mbCalendarFilterCoachIds.clear();
        showStep('calendar');
        applySidebarBranchMenusVisibility();
        updatePageTitle();
        highlightSidebarMenus();
        renderCalendar();
        mbSetupMemberNotifications();
    }

    function mbShowProductInfoForPass(pass) {
        var productInfo = document.getElementById('product-info');
        var productInfoText = document.getElementById('product-info-text');
        if (!productInfo || !productInfoText || !pass) return;
        if (pass.productType === 'COUNT_PASS' && pass.remainingCount != null) {
            productInfoText.textContent = '횟수권 사용: 잔여 ' + pass.remainingCount + '회';
        } else {
            productInfoText.textContent =
                '선택 이용권: ' + (pass.displayLine || pass.productName || pass.optionLabel || '이용권');
        }
        productInfo.style.display = 'block';
    }

    function mbSubmitMemberBookingInternal() {
        var errMsg = function (msg) {
            if (App.showNotification) App.showNotification(msg, 'danger');
            else alert(msg);
        };
        var bm = document.getElementById('booking-modal');
        if (bm && bm.getAttribute('data-mb-mode') === 'detail') {
            errMsg('조회 전용입니다. 수정·저장은 데스크에 문의해 주세요.');
            return;
        }
        if (aggregateCalendar) {
            errMsg('회원 예약 종합에서는 예약할 수 없습니다. 왼쪽 메뉴에서 지점·종목을 선택한 뒤 예약해 주세요.');
            return;
        }
        if (!ctx || !ctx.memberNumber) {
            errMsg('회원번호 확인 후 이용해 주세요.');
            return;
        }
        var pass = getSelectedPass();
        if (!pass || pass.memberProductId == null) {
            errMsg('이용권을 선택해 주세요.');
            return;
        }
        var fid = document.getElementById('booking-facility').value;
        var dateStr = document.getElementById('booking-date').value;
        var st = document.getElementById('booking-start-time').value;
        var en = document.getElementById('booking-end-time').value;
        var purposeEl = document.getElementById('booking-purpose');
        var purpose = purposeEl ? purposeEl.value : pass.purpose || 'LESSON';
        var lessonEl = document.getElementById('booking-lesson-category');
        var lessonCategory =
            purpose === 'LESSON' && lessonEl && lessonEl.value ? lessonEl.value : null;
        /** 상단(pass-select)에서 고른 이용권만 사용 — 폼 셀렉트 조작 무시 */
        var mpId = pass.memberProductId;
        if (!fid || !dateStr || !st || !en) {
            errMsg('시설·날짜·시간을 모두 입력해 주세요.');
            return;
        }
        var startDt = new Date(dateStr + 'T' + st + ':00');
        var endDt = new Date(dateStr + 'T' + en + ':00');
        if (endDt <= startDt) {
            errMsg('종료 시간이 시작보다 이후여야 합니다.');
            return;
        }
        var brInput = document.getElementById('booking-branch');
        var brVal = brInput && brInput.value ? brInput.value : branch;

        var body = {
            memberNumber: ctx.memberNumber,
            memberProductId: parseInt(String(mpId), 10),
            facility: { id: parseInt(fid, 10) },
            startTime: localDateTimeStr(startDt),
            endTime: localDateTimeStr(endDt),
            purpose: purpose,
            branch: brVal,
            status: 'PENDING',
            bookingSource: 'MEMBER_WEB'
        };
        if (lessonCategory) body.lessonCategory = lessonCategory;
        var partsEl = document.getElementById('booking-participants');
        if (partsEl && partsEl.value) {
            var pi = parseInt(partsEl.value, 10);
            if (!isNaN(pi) && pi > 0) {
                if (pi > 3) {
                    errMsg('동반 인원은 최대 3명까지 선택할 수 있습니다.');
                    return;
                }
                body.participants = pi;
            }
        }
        var pmEl = document.getElementById('booking-payment-method');
        if (pmEl && pass && pass.memberProductId != null) {
            pmEl.value = 'PREPAID';
            pmEl.disabled = true;
            pmEl.setAttribute('title', '이용권 예약은 선결제로 고정됩니다.');
            body.paymentMethod = 'PREPAID';
        } else if (pmEl && pmEl.value) {
            body.paymentMethod = pmEl.value;
        }
        var memoEl = document.getElementById('booking-notes');
        if (memoEl && memoEl.value && memoEl.value.trim()) body.memo = memoEl.value.trim();
        var coachSel = document.getElementById('booking-coach');
        if (coachSel && coachSel.value) {
            body.coach = { id: parseInt(coachSel.value, 10) };
        }

        fetch(apiUrl('/bookings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(body)
        })
            .then(function (r) {
                return r.json().then(function (data) {
                    return { ok: r.ok, status: r.status, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok) {
                    var msg =
                        (result.data && result.data.message) ||
                        result.data.error ||
                        '예약에 실패했습니다.';
                    errMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
                    return;
                }
                if (App.Modal) App.Modal.close('booking-modal');
                else {
                    var mo = document.getElementById('booking-modal');
                    if (mo) {
                        mo.classList.remove('active');
                        mo.style.display = 'none';
                    }
                }
                if (App.showNotification) App.showNotification('예약이 접수되었습니다. (승인 대기)', 'success');
                else alert('예약이 접수되었습니다.');
                renderCalendar();
            })
            .catch(function (e) {
                errMsg(e.message || '요청 실패');
            });
    }

    function openBookingModal(prefillDate, silentNoPass) {
        if (aggregateCalendar) {
            if (!silentNoPass) {
                alert(
                    '회원 예약 종합 화면에서는 예약할 수 없습니다.\n왼쪽 메뉴에서 지점·캘린더(야구·트레이닝 등)를 선택한 뒤 예약해 주세요.'
                );
            }
            return;
        }
        if (!hasBookablePass()) {
            if (!silentNoPass) {
                alert('사용 가능한 이용권이 있을 때만 예약할 수 있습니다. 데스크에 문의해 주세요.');
            }
            return;
        }
        var pass = getSelectedPass();
        if (!pass || pass.memberProductId == null) {
            if (!silentNoPass) alert('이용권을 선택해 주세요.');
            return;
        }
        syncMbPublicBookingContext();
        var overlay = document.getElementById('booking-modal');
        if (overlay) overlay.setAttribute('data-mb-mode', 'new');
        var titleEl = document.getElementById('booking-modal-title');
        if (titleEl) titleEl.textContent = '예약 등록';
        var delBtn = document.getElementById('booking-delete-btn');
        if (delBtn) {
            delBtn.style.display = 'none';
            delBtn.removeAttribute('data-booking-id');
        }
        document.getElementById('booking-id').value = '';

        window.BOOKING_PAGE_CONFIG = {
            branch: branch,
            facilityType: getEffectiveFacilityType(),
            lessonCategory: getEffectiveLessonCategoryForCalendar()
        };

        document.getElementById('member-select-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-info-section').style.display = 'block';
        document.getElementById('member-info-name').textContent = ctx.name || '-';
        document.getElementById('member-info-phone').textContent = '-';
        document.getElementById('member-info-grade').textContent = mbGradeText(ctx.grade);
        document.getElementById('member-info-school').textContent = '-';
        document.getElementById('selected-member-id').value = ctx.memberId != null ? String(ctx.memberId) : '';
        document.getElementById('selected-member-number').value = ctx.memberNumber || '';

        var fs = document.getElementById('booking-facility');
        if (fs) {
            fs.classList.remove('facility-fixed');
            fs.disabled = false;
        }
        var fd = document.getElementById('facility-selected-display');
        if (fd) fd.style.display = 'none';

        document.getElementById('booking-branch').value = branch;

        var d = prefillDate ? new Date(prefillDate) : new Date();
        var y = d.getFullYear();
        var m = pad(d.getMonth() + 1);
        var day = pad(d.getDate());
        document.getElementById('booking-date').value = y + '-' + m + '-' + day;
        document.getElementById('booking-start-time').value = '10:00';
        document.getElementById('booking-end-time').value = '11:00';
        document.getElementById('booking-participants').value = 1;
        document.getElementById('booking-status').value = 'PENDING';
        document.getElementById('booking-notes').value = '';
        document.getElementById('booking-repeat-enabled').checked = false;
        if (typeof window.toggleRepeatOptions === 'function') window.toggleRepeatOptions();

        var productInfo = document.getElementById('product-info');
        if (productInfo) productInfo.style.display = 'none';

        var effFt = getEffectiveFacilityType() || 'BASEBALL';

        mbFetchFacilitiesForModal(branch, effFt)
            .then(function () {
                return mbFetchCoachesForModal(branch);
            })
            .then(function () {
                var facilitySelect = document.getElementById('booking-facility');
                if (facilitySelect && facilitySelect.options.length > 1 && !facilitySelect.value) {
                    facilitySelect.selectedIndex = 1;
                }
                var sel = document.getElementById('booking-member-product');
                if (sel && pass.memberProductId != null) {
                    sel.innerHTML = '';
                    var o = document.createElement('option');
                    o.value = String(pass.memberProductId);
                    o.textContent =
                        pass.displayLine ||
                        pass.productName ||
                        pass.optionLabel ||
                        '이용권 #' + pass.memberProductId;
                    if (pass.productType) o.dataset.productType = pass.productType;
                    sel.appendChild(o);
                    sel.value = o.value;
                }
                mbShowProductInfoForPass(pass);

                var purposeEl = document.getElementById('booking-purpose');
                if (purposeEl) {
                    purposeEl.value = pass.purpose || 'LESSON';
                    if (
                        purposeEl.value &&
                        !Array.from(purposeEl.options).some(function (o) {
                            return o.value === purposeEl.value;
                        })
                    ) {
                        var po = document.createElement('option');
                        po.value = String(pass.purpose);
                        po.textContent = String(pass.purpose);
                        purposeEl.appendChild(po);
                        purposeEl.value = po.value;
                    }
                }
                if (typeof window.toggleLessonCategory === 'function') window.toggleLessonCategory();
                var lessonEl = document.getElementById('booking-lesson-category');
                if (lessonEl && pass.lessonCategory) {
                    lessonEl.value = pass.lessonCategory;
                    if (!lessonEl.value) {
                        var lo = document.createElement('option');
                        lo.value = String(pass.lessonCategory);
                        lo.textContent = String(pass.lessonCategory);
                        lessonEl.appendChild(lo);
                        lessonEl.value = lo.value;
                    }
                }
                var pm = document.getElementById('booking-payment-method');
                if (pm && pass.memberProductId != null) {
                    pm.value = 'PREPAID';
                    pm.disabled = true;
                    pm.setAttribute('title', '이용권 예약은 선결제로 고정됩니다.');
                } else if (pm) {
                    pm.value = '';
                    pm.disabled = false;
                    pm.removeAttribute('title');
                }

                var coachSel = document.getElementById('booking-coach');
                if (coachSel && pass.coachId != null) {
                    coachSel.value = String(pass.coachId);
                    if (!coachSel.value) {
                        var co = document.createElement('option');
                        co.value = String(pass.coachId);
                        co.textContent = pass.coachName || pass.coachDisplayName || '코치';
                        coachSel.appendChild(co);
                        coachSel.value = co.value;
                    }
                }
                mbSyncBookingModalTimeUI();
            })
            .then(function () {
                mbSetBookingModalReadonly(false);
                var mps = document.getElementById('booking-member-product');
                if (mps) {
                    mps.disabled = true;
                    mps.setAttribute('title', '상단에서 선택한 이용권으로 고정됩니다. 변경은 이용권 셀렉트에서 선택 후 다시 열어 주세요.');
                }
                if (App.Modal) App.Modal.open('booking-modal');
                else {
                    var mo = document.getElementById('booking-modal');
                    if (mo) {
                        mo.classList.add('active');
                        mo.style.display = '';
                    }
                }
            })
            .catch(function (e) {
                if (!silentNoPass) {
                    if (App.showNotification) {
                        App.showNotification(e.message || '예약 창을 열 수 없습니다.', 'danger');
                    } else alert(e.message || '예약 창을 열 수 없습니다.');
                }
            });
    }

    function closeBookingModal() {
        if (App.Modal) App.Modal.close('member-booking-modal');
        else {
            var mo = document.getElementById('member-booking-modal');
            if (mo) {
                mo.classList.remove('active');
                mo.style.display = 'none';
            }
        }
    }

    function submitBooking() {
        var pass = getSelectedPass();
        var err = document.getElementById('mb-modal-err');
        err.textContent = '';
        if (aggregateCalendar) {
            err.textContent = '회원 예약 종합에서는 예약할 수 없습니다. 지점 메뉴에서 예약해 주세요.';
            return;
        }
        if (!ctx || !pass || !hasBookablePass() || pass.memberProductId == null) {
            err.textContent = '예약 가능한 이용권이 없습니다.';
            return;
        }
        var fid = document.getElementById('mb-facility').value;
        var dateStr = document.getElementById('mb-date').value;
        var st = document.getElementById('mb-start').value;
        var en = document.getElementById('mb-end').value;
        if (!fid || !dateStr || !st || !en) {
            err.textContent = '시설·날짜·시간을 모두 입력해 주세요.';
            return;
        }
        var startDt = new Date(dateStr + 'T' + st + ':00');
        var endDt = new Date(dateStr + 'T' + en + ':00');
        if (endDt <= startDt) {
            err.textContent = '종료 시간이 시작보다 이후여야 합니다.';
            return;
        }

        var body = {
            memberNumber: ctx.memberNumber,
            memberProductId: pass.memberProductId,
            facility: { id: parseInt(fid, 10) },
            startTime: localDateTimeStr(startDt),
            endTime: localDateTimeStr(endDt),
            purpose: pass.purpose || 'LESSON',
            branch: branch,
            status: 'PENDING',
            bookingSource: 'MEMBER_WEB'
        };
        if (pass.lessonCategory) body.lessonCategory = pass.lessonCategory;

        fetch(apiUrl('/bookings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify(body)
        })
            .then(function (r) {
                return r.json().then(function (data) {
                    return { ok: r.ok, status: r.status, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok) {
                    var msg = (result.data && result.data.message) || result.data.error || '예약에 실패했습니다.';
                    err.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
                    return;
                }
                closeBookingModal();
                if (App.showNotification) App.showNotification('예약이 접수되었습니다. (승인 대기)', 'success');
                else alert('예약이 접수되었습니다.');
                renderCalendar();
            })
            .catch(function (e) {
                err.textContent = e.message || '요청 실패';
            });
    }

    function init() {
        window.mbRefreshMemberCalendar = function () {
            renderCalendar();
        };
        var stored = loadCtx();
        if (stored && stored.memberNumber) {
            ctx = stored;
            if (!ctx.passes) ctx.passes = [];
            syncMbPublicBookingContext();
            document.getElementById('mb-name').textContent = ctx.name || '';
            document.getElementById('mb-num').textContent = '(' + (ctx.memberNumber || '') + ')';
            syncFromUrl();
            fillPassSelect();
            applyPassSelectionFromStoredPreference();
            applyBranchForPass();
            updatePassBanner();
            updateBookingButtonsEnabled();
            showStep('calendar');
            updatePageTitle();
            highlightSidebarMenus();
            applySidebarBranchMenusVisibility();
            mbCalendarFilterCoachIds.clear();
            renderCalendar();
        } else {
            showStep('verify');
            syncMbPublicBookingContext();
            syncFromUrl();
            highlightSidebarMenus();
            applySidebarBranchMenusVisibility();
        }
        mbSetupMemberNotifications();
        mbSetupMemberUserMenu();
        document.documentElement.classList.remove('mb-boot-calendar', 'mb-boot-verify');

        document.getElementById('btn-verify').addEventListener('click', async function () {
            var input = document.getElementById('member-number-input');
            var msg = document.getElementById('verify-msg');
            msg.textContent = '';
            msg.className = '';
            var num = input && input.value ? input.value.trim() : '';
            if (!num) {
                msg.textContent = '회원번호를 입력해 주세요.';
                msg.className = 'mb-error';
                return;
            }
            try {
                var data = await postVerify(num);
                goToCalendarAfterVerify(data);
            } catch (e) {
                msg.textContent = e.message || '확인 실패';
                msg.className = 'mb-error';
            }
        });

        document.getElementById('btn-reset-member').addEventListener('click', function () {
            clearCtx();
            ctx = null;
            syncMbPublicBookingContext();
            updatePassBanner();
            updateBookingButtonsEnabled();
            applySidebarBranchMenusVisibility();
            showStep('verify');
            mbUpdateMemberUserMenuHint();
            if (typeof App !== 'undefined' && App && typeof App.updateNotificationBadge === 'function') {
                App.updateNotificationBadge();
            }
        });

        document.getElementById('pass-select').addEventListener('change', function () {
            var p = getSelectedPass();
            if (ctx && p && p.memberProductId != null) {
                ctx.selectedMemberProductId = p.memberProductId;
                saveCtx(ctx);
            }
            if (!viewOverride) {
                if (p && p.purpose === 'RENTAL') {
                    setBranchTab('RENTAL');
                    branch = 'RENTAL';
                } else if (branch === 'RENTAL') setBranchTab('SAHA');
            }
            applySidebarBranchMenusVisibility();
            mbCalendarFilterCoachIds.clear();
            renderCalendar();
        });

        document.getElementById('cal-prev').addEventListener('click', function () {
            currentDate.setMonth(currentDate.getMonth() - 1);
            mbCalendarFilterCoachIds.clear();
            renderCalendar();
        });
        document.getElementById('cal-next').addEventListener('click', function () {
            currentDate.setMonth(currentDate.getMonth() + 1);
            mbCalendarFilterCoachIds.clear();
            renderCalendar();
        });

        document.getElementById('btn-booking-new').addEventListener('click', function () {
            openBookingModal(new Date(), false);
        });

        var bookingDateEl = document.getElementById('booking-date');
        if (bookingDateEl) {
            bookingDateEl.addEventListener('change', function () {
                mbSyncBookingModalTimeUI();
            });
        }
        var bookingFacilityEl = document.getElementById('booking-facility');
        if (bookingFacilityEl) {
            bookingFacilityEl.addEventListener('change', function () {
                mbSyncBookingModalTimeUI();
            });
        }

        document.getElementById('mb-modal-close').addEventListener('click', closeBookingModal);
        document.getElementById('mb-modal-cancel').addEventListener('click', closeBookingModal);
        document.getElementById('mb-modal-submit').addEventListener('click', submitBooking);

        var mbNameBtn = document.getElementById('mb-name-btn');
        if (mbNameBtn) mbNameBtn.addEventListener('click', openMemberDetailModal);
        var mbRankNameBtn = document.getElementById('mb-rankings-name-btn');
        if (mbRankNameBtn) mbRankNameBtn.addEventListener('click', openMemberDetailModal);

        var rankLink = document.getElementById('mb-link-rankings');
        if (rankLink) {
            rankLink.addEventListener('click', function (e) {
                e.preventDefault();
                if (!ctx || !ctx.memberNumber) {
                    alert('회원번호 확인 후 이용해 주세요.');
                    return;
                }
                showStep('rankings');
                loadMbRankings();
            });
        }
        var annLink = document.getElementById('mb-link-announcements');
        if (annLink) {
            annLink.addEventListener('click', function (e) {
                e.preventDefault();
                if (!ctx || !ctx.memberNumber) {
                    alert('회원번호 확인 후 이용해 주세요.');
                    return;
                }
                showStep('announcements');
                loadMbAnnouncementsList();
            });
        }
        var backFromAnn = document.getElementById('btn-mb-back-from-announcements');
        if (backFromAnn) {
            backFromAnn.addEventListener('click', function () {
                showStep('calendar');
                renderCalendar();
            });
        }

        window.mbScrollToDeskFromBell = function () {
            var dd = document.getElementById('notification-dropdown');
            if (dd) dd.classList.remove('active');
            if (!ctx || !ctx.memberNumber) {
                alert('회원번호 확인 후 이용해 주세요.');
                return;
            }
            showStep('announcements');
            loadMbAnnouncementsList();
            setTimeout(function () {
                var el = document.getElementById('mb-desk-section');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 450);
        };
        var backCal = document.getElementById('btn-mb-back-calendar');
        if (backCal) {
            backCal.addEventListener('click', function () {
                showStep('calendar');
                renderCalendar();
            });
        }

        stripPublicRankingsAdminUi();

        setInterval(function () {
            if (
                typeof App !== 'undefined' &&
                App &&
                App.usePublicMemberAnnouncements &&
                ctx &&
                ctx.memberNumber &&
                typeof App.updateNotificationBadge === 'function'
            ) {
                App.updateNotificationBadge();
            }
            if (ctx && ctx.memberNumber) {
                mbRefreshDeskMenuUnread();
            }
        }, 3 * 60 * 1000);

        var deskClear = document.getElementById('btn-mb-desk-clear-thread');
        if (deskClear) {
            deskClear.addEventListener('click', function () {
                mbClearDeskThreadWithConfirm();
            });
        }

        var deskSend = document.getElementById('btn-mb-desk-send');
        if (deskSend) {
            deskSend.addEventListener('click', function () {
                var ta = document.getElementById('mb-desk-input');
                var text = ta && ta.value ? ta.value.trim() : '';
                if (!text) {
                    if (typeof App !== 'undefined' && App.showNotification) {
                        App.showNotification('내용을 입력해 주세요.', 'warning');
                    }
                    return;
                }
                if (!ctx || !ctx.memberNumber) return;
                var base = typeof App !== 'undefined' && App && App.apiBase ? App.apiBase : '/api';
                fetch(base + '/public/member-desk-messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        memberNumber: String(ctx.memberNumber).trim(),
                        content: text
                    })
                })
                    .then(function (r) {
                        if (!r.ok) {
                            return r.json().then(function (d) {
                                throw new Error((d && d.error) || '전송에 실패했습니다.');
                            });
                        }
                        return r.json();
                    })
                    .then(function () {
                        if (ta) ta.value = '';
                        if (typeof App !== 'undefined' && App.showNotification) {
                            App.showNotification('전달되었습니다.', 'success');
                        }
                        loadMbDeskThread();
                        mbRefreshDeskMenuUnread();
                    })
                    .catch(function (e) {
                        if (typeof App !== 'undefined' && App.showNotification) {
                            App.showNotification(e.message || '전송 실패', 'danger');
                        }
                    });
            });
        }
    }

    window.mbSubmitMemberBookingModal = function () {
        mbSubmitMemberBookingInternal();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

/** booking-modal(bookings.html 동일 마크업)용 — 인라인 onclick */
(function () {
    window.toggleLessonCategory = function () {
        var purpose = document.getElementById('booking-purpose');
        var lessonCategoryGroup = document.getElementById('lesson-category-group');
        if (!purpose || !lessonCategoryGroup) return;
        lessonCategoryGroup.style.display = purpose.value === 'LESSON' ? 'block' : 'none';
    };
    window.toggleRepeatOptions = function () {
        var cb = document.getElementById('booking-repeat-enabled');
        var enabled = cb && cb.checked;
        var repeatOptions = document.getElementById('repeat-options');
        if (repeatOptions) repeatOptions.style.display = enabled ? 'block' : 'none';
    };
    window.changeMember = function () {};
    window.openMemberSelectModal = function () {};
    window.selectNonMember = function () {};
    window.saveBooking = function () {
        if (typeof App !== 'undefined' && App.showNotification) {
            App.showNotification('회원 화면에서는 예약 수정·저장은 데스크에 문의해 주세요.', 'info');
        }
    };
    window.deleteBookingFromModal = async function () {
        var delBtn = document.getElementById('booking-delete-btn');
        var bookingId = delBtn && delBtn.getAttribute('data-booking-id');
        if (!bookingId) {
            if (typeof App !== 'undefined' && App.showNotification) {
                App.showNotification('삭제할 예약을 찾을 수 없습니다.', 'danger');
            }
            return;
        }
        if (!confirm('정말 이 예약을 삭제(취소)하시겠습니까?')) return;
        try {
            await App.api.delete('/bookings/' + bookingId);
            if (typeof App !== 'undefined' && App.Modal) App.Modal.close('booking-modal');
            if (typeof App !== 'undefined' && App.showNotification) {
                App.showNotification('예약이 취소되었습니다.', 'success');
            }
            if (typeof window.mbRefreshMemberCalendar === 'function') window.mbRefreshMemberCalendar();
        } catch (e) {
            var msg = '취소에 실패했습니다.';
            if (e && e.response && e.response.data) {
                if (typeof e.response.data === 'object' && e.response.data.error) msg = e.response.data.error;
                else if (typeof e.response.data === 'string') msg = e.response.data;
            }
            if (typeof App !== 'undefined' && App.showNotification) App.showNotification(msg, 'danger');
        }
    };
})();
