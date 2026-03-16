// 코치/레슨 관리 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadCoaches();
});

async function loadCoaches() {
    try {
        const allCoaches = await App.api.get('/coaches');
        App.log('코치 목록 로드:', allCoaches);
        // 기본: 활성 코치만 표시 (퇴사 처리한 코치는 목록에서 제외)
        const showInactive = document.getElementById('show-inactive-coaches') && document.getElementById('show-inactive-coaches').checked;
        const coaches = showInactive ? allCoaches : (allCoaches || []).filter(c => c.active !== false);
        await renderCoachesTable(coaches);
        renderCoachSelect(coaches);
        updateCoachCount(coaches.length);
        renderCoachStats(coaches);
    } catch (error) {
        App.err('코치 목록 로드 실패:', error);
    }
}

function updateCoachCount(count) {
    const badge = document.getElementById('coach-count-badge');
    if (badge) {
        badge.textContent = `${count}명`;
    }
}

function classifyCoachCategories(coach) {
    const name = (coach.name || '').toLowerCase();
    const spec = (coach.specialties || '').toLowerCase();
    const combined = name + ' ' + spec;
    const baseball = /\[대표\]|\[코치\]|\[포수코치\]|\[투수코치\]|야구|타격|투구|수비|포수|투수|비야구인/.test(combined);
    const pilates = /\[강사\]|필라테스/.test(combined);
    const training = /\[트레이너\]|트레이닝/.test(combined);
    const youth = /유소년/.test(combined);
    const rental = /대관|\[대관담당\]/.test(combined);
    return { baseball, pilates, training, youth, rental };
}

function renderCoachStats(coaches) {
    const container = document.getElementById('coaches-stats-container');
    if (!container) return;
    const list = Array.isArray(coaches) ? coaches : [];
    const total = list.length;
    let baseball = 0, pilates = 0, training = 0, youth = 0, rental = 0;
    list.forEach(c => {
        const cat = classifyCoachCategories(c);
        if (cat.baseball) baseball++;
        if (cat.pilates) pilates++;
        if (cat.training) training++;
        if (cat.youth) youth++;
        if (cat.rental) rental++;
    });
    const items = [
        { label: '총 코치 수', value: total + '명', itemClass: 'coaches-stats-item--total', isTotal: true, filterType: 'all' },
        { label: '⚾ 야구', value: baseball + '명', itemClass: 'coaches-stats-item--baseball', isTotal: false, filterType: 'baseball' },
        { label: '👶 유소년', value: youth + '명', itemClass: 'coaches-stats-item--youth', isTotal: false, filterType: 'youth' },
        { label: '💪 트레이닝', value: training + '명', itemClass: 'coaches-stats-item--training', isTotal: false, filterType: 'training' },
        { label: '🧘 필라테스', value: pilates + '명', itemClass: 'coaches-stats-item--pilates', isTotal: false, filterType: 'pilates' },
        { label: '🏟️ 대관', value: rental + '명', itemClass: 'coaches-stats-item--rental', isTotal: false, filterType: 'rental' }
    ];
    if (total === 0) {
        container.innerHTML = '<p class="coaches-stats-loading">등록된 코치가 없습니다.</p>';
        return;
    }
    container.innerHTML = items.map(item => `
        <div class="coaches-stats-item coaches-stats-item-clickable ${item.itemClass || ''}${item.isTotal ? ' stats-total-item' : ''}"
             data-filter-type="${App.escapeHtml(item.filterType || '')}"
             data-label="${App.escapeHtml(item.label || '')}"
             title="클릭하면 목록 보기">
            <div class="coaches-stats-item-label">${App.escapeHtml(item.label)}</div>
            <div class="coaches-stats-item-value">${App.escapeHtml(item.value)}</div>
        </div>
    `).join('');
    container.querySelectorAll('.coaches-stats-item-clickable').forEach(function(el) {
        el.addEventListener('click', function() {
            var type = el.getAttribute('data-filter-type');
            var label = el.getAttribute('data-label');
            openStatsCoachModal(type, label);
        });
    });
}

/** 통계 항목 클릭 시 해당 조건의 코치 목록 모달 */
async function openStatsCoachModal(filterType, titleLabel) {
    var modal = document.getElementById('stats-coaches-modal');
    var titleEl = document.getElementById('stats-coaches-modal-title');
    var bodyEl = document.getElementById('stats-coaches-modal-body');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = (titleLabel || '코치') + ' 목록';
    bodyEl.innerHTML = '<p class="coaches-stats-loading">로딩 중...</p>';
    App.Modal.open('stats-coaches-modal');
    try {
        var list = await App.api.get('/coaches');
        var coaches = Array.isArray(list) ? list : [];
        coaches = coaches.filter(function(c) { return c.active !== false; });
        if (filterType && filterType !== 'all') {
            coaches = coaches.filter(function(c) {
                var cat = classifyCoachCategories(c);
                return cat[filterType];
            });
        }
        if (coaches.length === 0) {
            bodyEl.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">해당 조건의 코치가 없습니다.</p>';
            return;
        }
        // 코치별 수강 인원 조회 (GET /coaches는 studentCount 미포함)
        var coachesWithCount = await Promise.all(coaches.map(async function(c) {
            try {
                var count = await App.api.get('/coaches/' + (c.id || '') + '/student-count');
                return Object.assign({}, c, { studentCount: count != null ? count : 0 });
            } catch (e) {
                return Object.assign({}, c, { studentCount: 0 });
            }
        }));
        // 코치 고유 순번 정렬: 위(대표) → 아래(기타) 순 (0→1→2→3→4→5→6, 동일 순번이면 이름)
        coachesWithCount.sort(function(a, b) {
            var orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
            var orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
            if (orderA !== orderB) return orderA - orderB;
            var aName = (a.name || '').replace(/\s*\[.*?\]\s*/g, '').trim();
            var bName = (b.name || '').replace(/\s*\[.*?\]\s*/g, '').trim();
            return aName.localeCompare(bName, 'ko');
        });
        var tableHtml = '<div class="table-container stats-coaches-modal-table" style="max-height: 60vh; overflow: auto;"><table class="table"><thead><tr><th>이름</th><th>담당 종목</th><th>배정 지점</th><th>수강 인원</th></tr></thead><tbody>';
        var branchConfig = { 'SAHA': { label: '사하점', class: 'branch-label--saha' }, 'YEONSAN': { label: '연산점', class: 'branch-label--yeonsan' }, 'RENTAL': { label: '대관', class: 'branch-label--rental' } };
        function formatBranchesWithColors(availableBranches) {
            if (availableBranches == null) return '-';
            var codes = [];
            if (Array.isArray(availableBranches)) {
                codes = availableBranches.map(function(x) { return String(x).trim().toUpperCase(); });
            } else if (typeof availableBranches === 'string') {
                codes = availableBranches.split(',').map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean);
            } else if (typeof availableBranches === 'object') {
                codes = Object.keys(availableBranches).filter(function(k) { return availableBranches[k]; }).map(function(k) { return k.toUpperCase(); });
            }
            if (codes.length === 0) return '-';
            var spans = codes.map(function(k) {
                var cfg = branchConfig[k] || { label: k, class: '' };
                return cfg.class ? '<span class="branch-label ' + cfg.class + '">' + App.escapeHtml(cfg.label) + '</span>' : '<span class="branch-label">' + App.escapeHtml(cfg.label) + '</span>';
            });
            return spans.join(', ');
        }
        function formatSpecialtyWithColors(specialties, name) {
            var raw = (specialties || '').trim();
            if (!raw) return '-';
            var specText = (specialties || '').toLowerCase();
            var nameText = (name || '').toLowerCase();
            var combined = nameText + ' ' + specText;
            var cellClass = 'coach-specialty-cell';
            if (/대관/.test(specText)) cellClass += ' coach-specialty--rental';
            else if (/필라테스|\[강사\]/.test(combined)) cellClass += ' coach-specialty--pilates';
            else if (/트레이닝|\[트레이너\]/.test(combined)) cellClass += ' coach-specialty--training';
            else if (/야구|유소년|\[대표\]|\[코치\]|\[포수코치\]|\[투수코치\]|타격|투구|수비|포수|투수|비야구인/.test(combined)) cellClass += ' coach-specialty--baseball';
            var parts = raw.split(',').map(function(s) {
                var part = s.trim();
                if (!part) return '';
                var colorClass = '';
                if (/^야구$/i.test(part)) colorClass = 'spec-color--baseball';
                else if (/^유소년$/i.test(part)) colorClass = 'spec-color--youth';
                else if (/^트레이닝$/i.test(part)) colorClass = 'spec-color--training';
                else if (/^필라테스$/i.test(part)) colorClass = 'spec-color--pilates';
                else if (/^대관$/i.test(part)) colorClass = 'spec-color--rental';
                return colorClass ? '<span class="spec-item ' + colorClass + '">' + App.escapeHtml(part) + '</span>' : App.escapeHtml(part);
            }).filter(Boolean);
            return { cellClass: cellClass, html: parts.length ? parts.join(', ') : '-' };
        }
        coachesWithCount.forEach(function(c) {
            var coachColor = (App.CoachColors && App.CoachColors.getColor) ? App.CoachColors.getColor(c) : 'var(--text-primary)';
            var coachNameHtml = '<span style="color:' + coachColor + ';font-weight:600;">' + App.escapeHtml(c.name || '-') + '</span>';
            var specOut = formatSpecialtyWithColors(c.specialties, c.name);
            var branchesHtml = formatBranchesWithColors(c.availableBranches);
            var studentCount = c.studentCount != null ? c.studentCount : 0;
            tableHtml += '<tr class="stats-coach-row" onclick="App.Modal.close(\'stats-coaches-modal\'); window.location.href=\'/coaches.html#coach-' + (c.id || '') + '\'" style="cursor:pointer;"><td class="cell-coach-name">' + coachNameHtml + '</td><td class="' + specOut.cellClass + '">' + specOut.html + '</td><td class="cell-branches">' + branchesHtml + '</td><td>' + App.escapeHtml(String(studentCount)) + '명</td></tr>';
        });
        tableHtml += '</tbody></table></div>';
        bodyEl.innerHTML = tableHtml;
    } catch (err) {
        App.err('통계 코치 목록 로드 실패:', err);
        bodyEl.innerHTML = '<p style="color: var(--danger); padding: 16px;">목록을 불러오는데 실패했습니다.</p>';
    }
}

// 코치 수강 인원 보기
async function showCoachStudents(coachId) {
    try {
        // 코치 정보 가져오기
        const coach = await App.api.get(`/coaches/${coachId}`);
        document.getElementById('coach-students-modal-title').textContent = `${coach.name} 코치 수강 인원`;
        
        // 수강 인원 목록 가져오기
        const students = await App.api.get(`/coaches/${coachId}/students`);
        
        const listContainer = document.getElementById('coach-students-list');
        
        if (!students || students.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">수강 인원이 없습니다.</p>';
        } else {
            listContainer.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>총 ${students.length}명</strong>
                </div>
                <div class="table-container">
                    <table class="table" style="margin-top: 10px;">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>이름</th>
                                <th>전화번호</th>
                                <th>등급</th>
                                <th>학교/소속</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => `
                                <tr>
                                    <td>${student.id}</td>
                                    <td>${student.name}</td>
                                    <td>${student.phoneNumber}</td>
                                    <td>${getStudentGradeText(student.grade)}</td>
                                    <td>${student.school || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        App.Modal.open('coach-students-modal');
    } catch (error) {
        App.err('수강 인원 로드 실패:', error);
        App.showNotification('수강 인원을 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원 등급 텍스트는 common.js의 App.MemberGrade 사용
function getStudentGradeText(grade) {
    return App.MemberGrade.getText(grade);
}

async function renderCoachesTable(coaches) {
    const tbody = document.getElementById('coaches-table-body');
    
    if (!coaches || coaches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">코치가 없습니다.</td></tr>';
        return;
    }
    
    // 코치 정렬: 대표 → 대관 담당 → 메인 코치 → 야구 관련 → 트레이닝 강사 → 필라테스 강사 (common.js CoachSortOrder와 동일)
    const sortedCoaches = coaches.sort((a, b) => {
        const orderA = App.CoachSortOrder ? App.CoachSortOrder(a) : 6;
        const orderB = App.CoachSortOrder ? App.CoachSortOrder(b) : 6;
        if (orderA !== orderB) return orderA - orderB;
        const aName = (a.name || '').replace(/\s*\[.*?\]\s*/g, '').trim();
        const bName = (b.name || '').replace(/\s*\[.*?\]\s*/g, '').trim();
        return aName.localeCompare(bName, 'ko');
    });
    
    // 각 코치의 수강 인원 수를 가져오기
    const coachesWithCount = await Promise.all(sortedCoaches.map(async (coach) => {
        try {
            const count = await App.api.get(`/coaches/${coach.id}/student-count`);
            return { ...coach, studentCount: count };
        } catch (error) {
            return { ...coach, studentCount: 0 };
        }
    }));
    
    tbody.innerHTML = coachesWithCount.map(coach => {
        // 배정 지점 표시 (사하점·연산점 고유색, 대관은 흰색 유지)
        let branches = '-';
        if (coach.availableBranches) {
            try {
                const branchArray = coach.availableBranches.split(',').map(b => b.trim().toUpperCase());
                const branchConfig = {
                    'SAHA': { label: '사하점', class: 'branch-label--saha' },
                    'YEONSAN': { label: '연산점', class: 'branch-label--yeonsan' },
                    'RENTAL': { label: '대관', class: 'branch-label--rental' }
                };
                const branchSpans = branchArray.map(b => {
                    const cfg = branchConfig[b];
                    if (!cfg) return '';
                    return cfg.class
                        ? `<span class="branch-label ${cfg.class}">${cfg.label}</span>`
                        : `<span class="branch-label">${cfg.label}</span>`;
                }).filter(Boolean);
                branches = branchSpans.length > 0 ? branchSpans.join(', ') : '-';
            } catch (e) {
                App.warn('배정 지점 파싱 오류:', coach.name, coach.availableBranches, e);
                branches = '-';
            }
        }
        
        // 코치 이름 색상 가져오기
        const coachColor = App.CoachColors ? App.CoachColors.getColor(coach) : 'var(--text-primary)';
        const coachNameHtml = `<span style="color: ${coachColor}; font-weight: 600;">${coach.name}</span>`;
        
        // 담당 종목: 항목별 글자색 적용 + 셀 테두리/배경 유지
        const rawSpec = (coach.specialties || '').trim();
        const specText = (coach.specialties || '').toLowerCase();
        const nameText = (coach.name || '').toLowerCase();
        const combined = nameText + ' ' + specText;
        let specialtyCellClass = 'coach-specialty-cell';
        if (/대관/.test(specText)) specialtyCellClass += ' coach-specialty--rental';
        else if (/필라테스|\[강사\]/.test(combined)) specialtyCellClass += ' coach-specialty--pilates';
        else if (/트레이닝|\[트레이너\]/.test(combined)) specialtyCellClass += ' coach-specialty--training';
        else if (/야구|유소년|\[대표\]|\[코치\]|\[포수코치\]|\[투수코치\]|타격|투구|수비|포수|투수|비야구인/.test(combined)) specialtyCellClass += ' coach-specialty--baseball';
        const displayedSpecHtml = rawSpec
            ? rawSpec.split(',').map(function(s) {
                const part = s.trim();
                if (!part) return '';
                var colorClass = '';
                if (/^야구$/i.test(part)) colorClass = 'spec-color--baseball';
                else if (/^유소년$/i.test(part)) colorClass = 'spec-color--youth';
                else if (/^트레이닝$/i.test(part)) colorClass = 'spec-color--training';
                else if (/^필라테스$/i.test(part)) colorClass = 'spec-color--pilates';
                else if (/^대관$/i.test(part)) colorClass = 'spec-color--rental';
                return colorClass
                    ? '<span class="spec-item ' + colorClass + '">' + App.escapeHtml(part) + '</span>'
                    : App.escapeHtml(part);
            }).filter(Boolean).join(', ')
            : '-';
        
        return `
            <tr>
                <td>${coachNameHtml}</td>
                <td class="${specialtyCellClass}">${displayedSpecHtml}</td>
                <td>${branches}</td>
                <td>${coach.availableTimes || '-'}</td>
                <td>
                    <a href="#" onclick="showCoachStudents(${coach.id}); return false;" 
                       style="color: var(--accent-primary); text-decoration: underline; cursor: pointer;">
                        ${coach.studentCount}명
                    </a>
                </td>
                <td>${coach.active ? '활성' : '비활성'}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editCoach(${coach.id})">수정</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCoach(${coach.id})">삭제</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCoachSelect(coaches) {
    const select = document.getElementById('coach-select');
    select.innerHTML = '<option value="">전체 코치</option>';
    coaches.forEach(coach => {
        const option = document.createElement('option');
        option.value = coach.id;
        option.textContent = coach.name;
        select.appendChild(option);
    });
}

async function loadLessons() {
    const coachId = document.getElementById('coach-select').value;
    const category = document.getElementById('category-filter').value;
    try {
        let params = [];
        if (coachId) params.push(`coachId=${coachId}`);
        if (category) params.push(`category=${category}`);
        const queryString = params.length > 0 ? '?' + params.join('&') : '';
        const lessons = await App.api.get(`/lessons${queryString}`);
        renderLessons(lessons);
    } catch (error) {
        App.err('레슨 목록 로드 실패:', error);
        renderLessons([]);
    }
}

function renderLessons(lessons) {
    const container = document.getElementById('lessons-container');
    
    if (!lessons || lessons.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">레슨이 없습니다.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>날짜/시간</th>
                        <th>코치</th>
                        <th>회원</th>
                        <th>레슨 카테고리</th>
                        <th>레슨 타입</th>
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${lessons.map(lesson => `
                        <tr>
                            <td>${App.formatDateTime(lesson.startTime)}</td>
                            <td>${lesson.coach?.name || lesson.coachName || '-'}</td>
                            <td>${lesson.member?.name || lesson.memberName || '-'}</td>
                            <td><span class="badge badge-${getCategoryBadge(lesson.category)}">${getCategoryText(lesson.category)}</span></td>
                            <td>${getLessonTypeText(lesson.type)}</td>
                            <td><span class="badge badge-${getLessonStatusBadge(lesson.status)}">${getLessonStatusText(lesson.status)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getLessonTypeText(type) {
    const map = {
        'INDIVIDUAL': '개인',
        'GROUP': '그룹',
        'CLINIC': '클리닉'
    };
    return map[type] || type;
}

// 레슨 카테고리 관련 함수는 common.js의 App.LessonCategory 사용
function getCategoryText(category) {
    return App.LessonCategory.getText(category);
}

function getCategoryBadge(category) {
    return App.LessonCategory.getBadge(category);
}

function getLessonStatusBadge(status) {
    const map = {
        'SCHEDULED': 'info',
        'COMPLETED': 'success',
        'CANCELLED': 'danger'
    };
    return map[status] || 'info';
}

function getLessonStatusText(status) {
    const map = {
        'SCHEDULED': '예정',
        'COMPLETED': '완료',
        'CANCELLED': '취소'
    };
    return map[status] || status;
}

function openCoachModal(id = null) {
    const modal = document.getElementById('coach-modal');
    const title = document.getElementById('coach-modal-title');
    const form = document.getElementById('coach-form');
    
    if (id) {
        title.textContent = '코치 수정';
        loadCoachData(id);
    } else {
        title.textContent = '코치 추가';
        form.reset();
        // 체크박스 초기화
        document.querySelectorAll('#coach-form input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        // 지점 체크박스 기본값 설정 (사하점만 체크)
        document.getElementById('branch-saha').checked = true;
        document.getElementById('branch-yeonsan').checked = false;
        document.getElementById('branch-rental').checked = false;
    }
    
    App.Modal.open('coach-modal');
}

function editCoach(id) {
    openCoachModal(id);
}

async function loadCoachData(id) {
    try {
        const coach = await App.api.get(`/coaches/${id}`);
        document.getElementById('coach-id').value = coach.id;
        document.getElementById('coach-name').value = coach.name;
        document.getElementById('coach-available-time').value = coach.availableTimes || '';
        
        // 담당 종목 체크박스 처리
        const checkboxes = document.querySelectorAll('#coach-form .checkbox-group:first-of-type input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        
        if (coach.specialties) {
            const specialties = coach.specialties.split(',').map(s => s.trim());
            checkboxes.forEach(cb => {
                if (specialties.includes(cb.value)) {
                    cb.checked = true;
                }
            });
        }
        
        // 배정 지점 체크박스 처리
        const branches = coach.availableBranches ? coach.availableBranches.split(',').map(s => s.trim().toUpperCase()) : [];
        document.getElementById('branch-saha').checked = branches.includes('SAHA');
        document.getElementById('branch-yeonsan').checked = branches.includes('YEONSAN');
        document.getElementById('branch-rental').checked = branches.includes('RENTAL');
        
        // 만약 배정된 지점이 없으면 기본값으로 사하점 체크
        if (branches.length === 0) {
            document.getElementById('branch-saha').checked = true;
        }
    } catch (error) {
        App.showNotification('코치 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveCoach() {
    const checkedSpecialties = Array.from(document.querySelectorAll('#coach-form input[type="checkbox"]:checked'))
        .filter(cb => cb.value !== 'SAHA' && cb.value !== 'YEONSAN' && cb.value !== 'RENTAL')
        .map(cb => cb.value);
    
    const checkedBranches = [];
    if (document.getElementById('branch-saha').checked) checkedBranches.push('SAHA');
    if (document.getElementById('branch-yeonsan').checked) checkedBranches.push('YEONSAN');
    if (document.getElementById('branch-rental').checked) checkedBranches.push('RENTAL');
    
    if (checkedBranches.length === 0) {
        App.showNotification('최소 1개 이상의 지점을 선택해야 합니다.', 'warning');
        return;
    }
    
    const data = {
        name: document.getElementById('coach-name').value,
        specialties: checkedSpecialties.length > 0 ? checkedSpecialties.join(', ') : null,
        availableTimes: document.getElementById('coach-available-time').value || null,
        availableBranches: checkedBranches.join(',')
    };
    
    try {
        const id = document.getElementById('coach-id').value;
        if (id) {
            await App.api.put(`/coaches/${id}`, data);
            App.showNotification('코치가 수정되었습니다.', 'success');
        } else {
            await App.api.post('/coaches', data);
            App.showNotification('코치가 추가되었습니다.', 'success');
        }
        
        App.Modal.close('coach-modal');
        await loadCoaches();
    } catch (error) {
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

async function deleteCoach(id) {
    if (!confirm('퇴사 처리하시겠습니까? 목록에서 제외되며, 예약·이용권 기록은 유지됩니다.')) return;
    
    try {
        await App.api.delete(`/coaches/${id}`);
        App.showNotification('코치가 퇴사 처리되었습니다.', 'success');
        await loadCoaches();
    } catch (error) {
        App.showNotification('퇴사 처리에 실패했습니다.', 'danger');
    }
}
