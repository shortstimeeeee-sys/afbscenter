// 코치/레슨 관리 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadCoaches();
});

async function loadCoaches() {
    try {
        const coaches = await App.api.get('/coaches');
        await renderCoachesTable(coaches);
        renderCoachSelect(coaches);
        updateCoachCount(coaches.length);
    } catch (error) {
        console.error('코치 목록 로드 실패:', error);
    }
}

function updateCoachCount(count) {
    const badge = document.getElementById('coach-count-badge');
    if (badge) {
        badge.textContent = `${count}명`;
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
        console.error('수강 인원 로드 실패:', error);
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
    
    // 코치 정렬: 대표 -> 코치 -> 분야별코치 -> 트레이너 -> 강사
    const sortedCoaches = coaches.sort((a, b) => {
        const aName = a.name || '';
        const bName = b.name || '';
        
        // 카테고리 분류 함수
        const getCategory = (coach) => {
            const name = coach.name || '';
            
            // 1. 대표: [대표] 포함
            if (name.includes('[대표]')) {
                return 1;
            }
            // 2. 코치: [코치] 포함 (하지만 분야별코치는 제외)
            if (name.includes('[코치]') && 
                !name.includes('[유소년코치]') && 
                !name.includes('[투수코치]') && 
                !name.includes('[포수코치]') &&
                !name.includes('[타격코치]') &&
                !name.includes('[수비코치]') &&
                !name.includes('[주루코치]')) {
                return 2;
            }
            // 3. 분야별코치: [유소년코치], [투수코치], [포수코치] 등
            if (name.includes('[유소년코치]') || 
                name.includes('[투수코치]') || 
                name.includes('[포수코치]') ||
                name.includes('[타격코치]') ||
                name.includes('[수비코치]') ||
                name.includes('[주루코치]')) {
                return 3;
            }
            // 4. 트레이너: 트레이너 또는 트레이닝 포함
            if (name.includes('트레이너') || name.includes('트레이닝')) {
                return 4;
            }
            // 5. 강사: [강사] 포함
            if (name.includes('[강사]')) {
                return 5;
            }
            // 기타: 이름만 있는 경우는 코치로 간주 (2번 카테고리)
            return 2;
        };
        
        const aCat = getCategory(a);
        const bCat = getCategory(b);
        
        // 카테고리 순서대로 정렬
        if (aCat !== bCat) {
            return aCat - bCat;
        }
        
        // 같은 카테고리 내에서는 이름순 정렬 (대괄호 제거 후 비교)
        const aNameForSort = aName.replace(/\s*\[.*?\]\s*/g, '').trim();
        const bNameForSort = bName.replace(/\s*\[.*?\]\s*/g, '').trim();
        return aNameForSort.localeCompare(bNameForSort, 'ko');
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
    
    tbody.innerHTML = coachesWithCount.map(coach => `
        <tr>
            <td>${coach.name}</td>
            <td>${coach.specialties || '-'}</td>
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
    `).join('');
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
        console.error('레슨 목록 로드 실패:', error);
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
        
        // 체크박스 처리 (specialties가 쉼표로 구분된 문자열)
        const checkboxes = document.querySelectorAll('#coach-form input[type="checkbox"]');
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
    } catch (error) {
        App.showNotification('코치 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

async function saveCoach() {
    const checkedSpecialties = Array.from(document.querySelectorAll('#coach-form input[type="checkbox"]:checked'))
        .map(cb => cb.value);
    
    const data = {
        name: document.getElementById('coach-name').value,
        specialties: checkedSpecialties.length > 0 ? checkedSpecialties.join(', ') : null,
        availableTimes: document.getElementById('coach-available-time').value || null
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
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
        await App.api.delete(`/coaches/${id}`);
        App.showNotification('코치가 삭제되었습니다.', 'success');
        await loadCoaches();
    } catch (error) {
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}
