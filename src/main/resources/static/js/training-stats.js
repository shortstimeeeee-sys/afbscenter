// 훈련 통계 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    setThisMonth();
    loadAllStats();
});

// 이번 달로 설정
function setThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('stats-start-date').value = `${year}-${month}-01`;
    document.getElementById('stats-end-date').value = now.toISOString().split('T')[0];
}

// 지난 달로 설정
function setLastMonth() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, lastMonth.getMonth() + 1, 0).getDate();
    
    document.getElementById('stats-start-date').value = `${year}-${month}-01`;
    document.getElementById('stats-end-date').value = `${year}-${month}-${lastDay}`;
}

// 모든 통계 로드
async function loadAllStats() {
    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;
    
    if (!startDate || !endDate) {
        App.showNotification('조회 기간을 선택해주세요.', 'warning');
        return;
    }
    
    try {
        // 병렬로 모든 데이터 로드
        await Promise.all([
            loadSummaryStats(startDate, endDate),
            loadGradeStats(startDate, endDate),
            loadCoachStats(startDate, endDate),
            loadBranchStats(),
            loadMonthlyAttendance(),
            loadTopRecords()
        ]);
    } catch (error) {
        App.err('통계 로드 실패:', error);
        App.err('오류 상세:', error);
        App.showNotification('통계 데이터 로드에 실패했습니다.', 'danger');
        
        // 에러 발생 시 기본 메시지 표시
        const gradeStatsBody = document.getElementById('grade-stats-body');
        if (gradeStatsBody) {
            gradeStatsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">데이터를 불러올 수 없습니다.</td></tr>';
        }
        const coachStatsBody = document.getElementById('coach-stats-body');
        if (coachStatsBody) {
            coachStatsBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">데이터를 불러올 수 없습니다.</td></tr>';
        }
    }
}

// 전체 요약 통계 (병렬 로드)
async function loadSummaryStats(startDate, endDate) {
    try {
        const [members, attendances, trainingLogs] = await Promise.all([
            App.api.get('/members'),
            App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`),
            App.api.get(`/training-logs?startDate=${startDate}&endDate=${endDate}`)
        ]);
        document.getElementById('total-members').textContent = members.length;
        document.getElementById('total-attendance').textContent = attendances.length;
        document.getElementById('total-training-logs').textContent = trainingLogs.length;
        
        // 평균 출석률 계산 (기간 내 출석 / 전체 회원 수)
        const avgRate = members.length > 0 ? ((attendances.length / members.length) * 100).toFixed(1) : 0;
        document.getElementById('avg-attendance-rate').textContent = avgRate + '%';
    } catch (error) {
        App.err('요약 통계 로드 실패:', error);
    }
}

// 등급별 평균 기록 (회원/출석/랭킹 병렬 로드)
async function loadGradeStats(startDate, endDate) {
    try {
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const trainingRankingsParams = new URLSearchParams({ startDate: startDate, endDate: endDate, days: days });
        const [members, attendances, trainingRankingsResp] = await Promise.all([
            App.api.get('/members'),
            App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`),
            App.api.get(`/training-logs/rankings?${trainingRankingsParams.toString()}`).catch(function() { return { swingSpeedRanking: [], ballSpeedRanking: [], pitchSpeedRanking: [] }; })
        ]);
        let trainingRankings = trainingRankingsResp && trainingRankingsResp.swingSpeedRanking ? trainingRankingsResp : { swingSpeedRanking: [], ballSpeedRanking: [], pitchSpeedRanking: [] };
        
        // 회원별 최고 기록 맵 생성 (훈련 기록 기준)
        const memberTrainingRecords = new Map();
        if (trainingRankings.swingSpeedRanking) {
            trainingRankings.swingSpeedRanking.forEach(item => {
                memberTrainingRecords.set(item.memberId, {
                    swingSpeed: item.swingSpeedMax || 0,
                    ballSpeed: 0,
                    pitchSpeed: 0
                });
            });
        }
        if (trainingRankings.ballSpeedRanking) {
            trainingRankings.ballSpeedRanking.forEach(item => {
                const existing = memberTrainingRecords.get(item.memberId) || { swingSpeed: 0, ballSpeed: 0, pitchSpeed: 0 };
                existing.ballSpeed = item.ballSpeedMax || 0;
                memberTrainingRecords.set(item.memberId, existing);
            });
        }
        if (trainingRankings.pitchSpeedRanking) {
            trainingRankings.pitchSpeedRanking.forEach(item => {
                const existing = memberTrainingRecords.get(item.memberId) || { swingSpeed: 0, ballSpeed: 0, pitchSpeed: 0 };
                existing.pitchSpeed = item.pitchSpeedMax || 0;
                memberTrainingRecords.set(item.memberId, existing);
            });
        }
        
        // 등급별 그룹화
        const gradeGroups = {};
        members.forEach(member => {
            const grade = member.grade || 'SOCIAL';
            if (!gradeGroups[grade]) {
                gradeGroups[grade] = {
                    members: [],
                    swingSpeeds: [],
                    exitVelocities: [],
                    pitchingSpeeds: []
                };
            }
            gradeGroups[grade].members.push(member);
            
            // 회원 기본 기록과 훈련 기록 병합 (더 높은 값 사용)
            const trainingRecord = memberTrainingRecords.get(member.id) || { swingSpeed: 0, ballSpeed: 0, pitchSpeed: 0 };
            
            // 스윙 속도: 회원 기본 기록 또는 훈련 기록 중 더 높은 값
            const swingSpeed = Math.max(
                member.swingSpeed || 0,
                trainingRecord.swingSpeed || 0
            );
            if (swingSpeed > 0) {
                gradeGroups[grade].swingSpeeds.push(swingSpeed);
            }
            
            // 타구 속도: 회원 기본 기록 또는 훈련 기록 중 더 높은 값
            const exitVelocity = Math.max(
                member.exitVelocity || 0,
                trainingRecord.ballSpeed || 0
            );
            if (exitVelocity > 0) {
                gradeGroups[grade].exitVelocities.push(exitVelocity);
            }
            
            // 구속: 회원 기본 기록 또는 훈련 기록 중 더 높은 값
            const pitchingSpeed = Math.max(
                member.pitchingSpeed || 0,
                trainingRecord.pitchSpeed || 0
            );
            if (pitchingSpeed > 0) {
                gradeGroups[grade].pitchingSpeeds.push(pitchingSpeed);
            }
        });
        
        const tbody = document.getElementById('grade-stats-body');
        // 등급 순서: 고 -> 중 -> 초 -> 사회인
        const gradeOrder = ['ELITE_HIGH', 'ELITE_MIDDLE', 'ELITE_ELEMENTARY', 'SOCIAL', 'YOUTH', 'OTHER'];
        const grades = Object.keys(gradeGroups).sort((a, b) => {
            const aIndex = gradeOrder.indexOf(a);
            const bIndex = gradeOrder.indexOf(b);
            // 등급 순서에 없는 경우 맨 뒤로
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
        
        if (grades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">데이터가 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = grades.map(grade => {
            const group = gradeGroups[grade];
            const memberCount = group.members.length;
            
            // 평균 계산
            const avgSwing = group.swingSpeeds.length > 0 
                ? group.swingSpeeds.reduce((a, b) => a + b, 0) / group.swingSpeeds.length
                : null;
            const avgExit = group.exitVelocities.length > 0 
                ? group.exitVelocities.reduce((a, b) => a + b, 0) / group.exitVelocities.length
                : null;
            const avgPitch = group.pitchingSpeeds.length > 0 
                ? group.pitchingSpeeds.reduce((a, b) => a + b, 0) / group.pitchingSpeeds.length
                : null;
            
            // 각 항목별 평균 대비 분포 계산
            let swingDistribution = '-';
            let exitDistribution = '-';
            let pitchDistribution = '-';
            
            // 스윙속도 분포
            if (avgSwing !== null && group.swingSpeeds.length > 0) {
                let swingAbove = 0, swingBelow = 0;
                group.swingSpeeds.forEach(speed => {
                    if (speed >= avgSwing) swingAbove++;
                    else swingBelow++;
                });
                const swingRecordCount = group.swingSpeeds.length;
                swingDistribution = `${avgSwing.toFixed(1)} mph<br><span style="font-size: 11px;"><span style="color: #16a34a; font-weight: 600;">↑${swingAbove}명</span> / <span style="color: #dc2626; font-weight: 600;">↓${swingBelow}명</span><br><span style="color: var(--text-muted);">(${swingRecordCount}/${memberCount}명 기록)</span></span>`;
            }
            
            // 타구속도 분포
            if (avgExit !== null && group.exitVelocities.length > 0) {
                let exitAbove = 0, exitBelow = 0;
                group.exitVelocities.forEach(speed => {
                    if (speed >= avgExit) exitAbove++;
                    else exitBelow++;
                });
                const exitRecordCount = group.exitVelocities.length;
                exitDistribution = `${avgExit.toFixed(1)} mph<br><span style="font-size: 11px;"><span style="color: #16a34a; font-weight: 600;">↑${exitAbove}명</span> / <span style="color: #dc2626; font-weight: 600;">↓${exitBelow}명</span><br><span style="color: var(--text-muted);">(${exitRecordCount}/${memberCount}명 기록)</span></span>`;
            }
            
            // 구속 분포
            if (avgPitch !== null && group.pitchingSpeeds.length > 0) {
                let pitchAbove = 0, pitchBelow = 0;
                group.pitchingSpeeds.forEach(speed => {
                    if (speed >= avgPitch) pitchAbove++;
                    else pitchBelow++;
                });
                const pitchRecordCount = group.pitchingSpeeds.length;
                pitchDistribution = `${avgPitch.toFixed(1)} km/h<br><span style="font-size: 11px;"><span style="color: #16a34a; font-weight: 600;">↑${pitchAbove}명</span> / <span style="color: #dc2626; font-weight: 600;">↓${pitchBelow}명</span><br><span style="color: var(--text-muted);">(${pitchRecordCount}/${memberCount}명 기록)</span></span>`;
            }
            
            return `
                <tr>
                    <td><span class="badge badge-${getGradeBadge(grade)}">${App.MemberGrade.getText(grade)}</span></td>
                    <td>${memberCount}명</td>
                    <td>${swingDistribution}</td>
                    <td>${exitDistribution}</td>
                    <td>${pitchDistribution}</td>
                </tr>
            `;
        }).join('');
        
        // 테이블이 비어있으면 메시지 표시
        if (tbody.innerHTML.trim() === '') {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">데이터가 없습니다.</td></tr>';
        }
    } catch (error) {
        App.err('등급별 통계 로드 실패:', error);
        App.err('오류 상세:', error);
        const tbody = document.getElementById('grade-stats-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">데이터를 불러올 수 없습니다.</td></tr>';
        }
    }
}

// 등급별 배지 색상 (common.css / members.js와 동일)
function getGradeBadge(grade) {
    switch(grade) {
        case 'ELITE_ELEMENTARY': return 'elite-elementary';
        case 'ELITE_MIDDLE': return 'elite-middle';
        case 'ELITE_HIGH': return 'elite-high';
        case 'YOUTH': return 'youth';
        case 'SOCIAL': return 'secondary';
        case 'OTHER': return 'other';
        default: return 'info';
    }
}

// MemberProduct 기준으로 코치별 회원 목록 보기
async function showCoachStudentsByMemberProduct(coachId) {
    try {
        // 코치 정보 가져오기
        const coach = await App.api.get(`/coaches/${coachId}`);
        document.getElementById('coach-students-modal-title').textContent = `${coach.name} 코치 담당 회원 (이용권 기준)`;
        
        // 모든 활성 이용권 가져오기
        const allMemberProducts = await App.api.get('/member-products?status=ACTIVE');
        
        // 해당 코치의 이용권을 가진 회원 필터링
        const memberIds = new Set();
        const membersMap = new Map();
        
        allMemberProducts.forEach(mp => {
            // MemberProduct의 coach 우선, 없으면 Product의 coach
            let mpCoach = null;
            if (mp.coach && mp.coach.id) {
                mpCoach = mp.coach;
            } else if (mp.product && mp.product.coach && mp.product.coach.id) {
                mpCoach = mp.product.coach;
            }
            
            if (mpCoach && mpCoach.id === coachId && mp.member && mp.member.id) {
                const memberId = mp.member.id;
                if (!memberIds.has(memberId)) {
                    memberIds.add(memberId);
                    membersMap.set(memberId, {
                        id: mp.member.id,
                        memberNumber: mp.member.memberNumber || mp.member.id,
                        name: mp.member.name,
                        phoneNumber: mp.member.phoneNumber,
                        grade: mp.member.grade,
                        school: mp.member.school
                    });
                }
            }
        });
        
        const students = Array.from(membersMap.values());
        const listContainer = document.getElementById('coach-students-list');
        
        if (!students || students.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">담당 회원이 없습니다.</p>';
        } else {
            listContainer.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>총 ${students.length}명</strong>
                </div>
                <div class="table-container">
                    <table class="table" style="margin-top: 10px;">
                        <thead>
                            <tr>
                                <th>회원번호</th>
                                <th>이름</th>
                                <th>전화번호</th>
                                <th>등급</th>
                                <th>학교/소속</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => `
                                <tr>
                                    <td>${student.memberNumber || student.id || '-'}</td>
                                    <td>${student.name || '-'}</td>
                                    <td>${student.phoneNumber || '-'}</td>
                                    <td>${student.grade ? (App.MemberGrade ? App.MemberGrade.getText(student.grade) : student.grade) : '-'}</td>
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
        App.err('담당 회원 로드 실패:', error);
        App.showNotification('담당 회원을 불러오는데 실패했습니다.', 'danger');
    }
}

// 미배정 회원 목록 보기 (활성 이용권에 코치가 없는 회원)
async function showUnassignedMembers() {
    try {
        // 모든 활성 이용권 가져오기
        const allMemberProducts = await App.api.get('/member-products?status=ACTIVE');
        
        // 코치가 없는 활성 이용권을 가진 회원 ID 수집
        const unassignedMemberIds = new Set();
        const memberProductsMap = new Map(); // 회원 ID -> MemberProduct 배열
        
        allMemberProducts.forEach(mp => {
            if (!mp.member || !mp.member.id) return;
            
            // MemberProduct의 coach 우선, 없으면 Product의 coach
            let coach = null;
            if (mp.coach && mp.coach.id) {
                coach = mp.coach;
            } else if (mp.product && mp.product.coach && mp.product.coach.id) {
                coach = mp.product.coach;
            }
            
            // 코치가 없으면 미배정 회원으로 추가
            if (!coach || !coach.id) {
                unassignedMemberIds.add(mp.member.id);
                
                // 회원별 이용권 목록 저장
                if (!memberProductsMap.has(mp.member.id)) {
                    memberProductsMap.set(mp.member.id, []);
                }
                memberProductsMap.get(mp.member.id).push(mp);
            }
        });
        
        // 회원 정보 가져오기
        const allMembers = await App.api.get('/members');
        const unassignedMembers = allMembers.filter(m => unassignedMemberIds.has(m.id));
        
        // 미배정 = 활성 이용권에 코치가 없는 회원. 동일 회원이 이용권 여러 개 보유 시 1명으로 집계.
        const unassignedProductCount = Array.from(memberProductsMap.values()).reduce((sum, arr) => sum + arr.length, 0);
        document.getElementById('coach-students-modal-title').textContent = '미배정 회원 (이용권 기준)';
        
        const listContainer = document.getElementById('coach-students-list');
        
        if (!unassignedMembers || unassignedMembers.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">미배정 회원이 없습니다.</p>';
        } else {
            // 코치 목록 가져오기
            const allCoaches = await App.api.get('/coaches');
            
            // 각 회원의 활성 이용권 정보 (이미 가져온 데이터 사용)
            const membersWithProducts = unassignedMembers.map(member => {
                const activeProducts = memberProductsMap.get(member.id) || [];
                return {
                    ...member,
                    activeProducts: activeProducts
                };
            });
            
            listContainer.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <strong>미배정 회원 ${unassignedMembers.length}명</strong>
                    ${unassignedProductCount !== unassignedMembers.length ? ` <span style="color: var(--text-secondary); font-weight: normal;">(코치가 없는 활성 이용권 ${unassignedProductCount}개)</span>` : ''}
                    <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                        활성 이용권에 코치가 배정되지 않은 회원입니다. 아래에서 이용권별로 코치를 지정할 수 있습니다.
                    </div>
                </div>
                <div style="max-height: 600px; overflow-y: auto;">
                    ${membersWithProducts.map((member, memberIndex) => {
                        const activeProducts = member.activeProducts || [];
                        return `
                        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary);">
                            <div style="font-weight: 600; margin-bottom: 10px; font-size: 14px;">
                                ${member.memberNumber || member.id} - ${member.name}
                                <span style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">
                                    (${member.grade ? (App.MemberGrade ? App.MemberGrade.getText(member.grade) : member.grade) : '-'})
                                </span>
                            </div>
                            ${activeProducts.length > 0 ? `
                                <div style="margin-top: 10px;">
                                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">활성 이용권:</div>
                                    ${activeProducts.map((mp, productIndex) => {
                                        const uniqueId = `coach-select-${member.id}-${mp.id}`;
                                        // MemberProduct의 코치 우선, 없으면 Product의 코치 사용
                                        let currentCoachId = '';
                                        if (mp.coach && mp.coach.id) {
                                            currentCoachId = String(mp.coach.id);
                                        } else if (mp.product && mp.product.coach && mp.product.coach.id) {
                                            currentCoachId = String(mp.product.coach.id);
                                        }
                                        
                                        // Product의 코치 이름 표시용
                                        const productCoachName = (mp.product && mp.product.coach && mp.product.coach.name) 
                                            ? ` (${mp.product.coach.name})` 
                                            : '';
                                        
                                        return `
                                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px; background: var(--bg-primary); border-radius: 4px;">
                                            <div style="flex: 1; font-size: 13px;">
                                                <strong>${mp.product?.name || '이용권'}${productCoachName}</strong>
                                                ${mp.remainingCount !== null && mp.remainingCount !== undefined ? `<span style="color: var(--text-secondary); font-size: 11px;"> (잔여 ${mp.remainingCount}회)</span>` : ''}
                                            </div>
                                            <select id="${uniqueId}" class="form-control" style="width: 200px; font-size: 12px;" data-member-product-id="${mp.id}">
                                                <option value="">코치 미지정</option>
                                                ${allCoaches.map(coach => {
                                                    const selected = currentCoachId && String(coach.id) === String(currentCoachId) ? 'selected' : '';
                                                    return `<option value="${coach.id}" ${selected}>${coach.name}</option>`;
                                                }).join('')}
                                            </select>
                                        </div>
                                    `;
                                    }).join('')}
                                </div>
                            ` : `
                                <div style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
                                    활성 이용권이 없습니다.
                                </div>
                            `}
                        </div>
                    `;
                    }).join('')}
                </div>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-primary" onclick="saveUnassignedMemberCoaches()">코치 배정 저장</button>
                    <button class="btn btn-secondary" onclick="App.Modal.close('coach-students-modal')" style="margin-left: 10px;">닫기</button>
                </div>
            `;
        }
        
        App.Modal.open('coach-students-modal');
    } catch (error) {
        App.err('미배정 회원 로드 실패:', error);
        App.showNotification('미배정 회원을 불러오는데 실패했습니다.', 'danger');
    }
}

// 미배정 회원의 이용권 코치 배정 저장
async function saveUnassignedMemberCoaches() {
    try {
        const coachSelects = document.querySelectorAll('[id^="coach-select-"]');
        const updates = [];
        
        for (const select of coachSelects) {
            const memberProductId = select.dataset.memberProductId;
            const coachId = select.value;
            
            if (memberProductId) {
                updates.push({
                    memberProductId: memberProductId,
                    coachId: coachId || null
                });
            }
        }
        
        if (updates.length === 0) {
            App.showNotification('변경된 내용이 없습니다.', 'info');
            return;
        }
        
        // 각 이용권의 코치 업데이트
        let successCount = 0;
        let failCount = 0;
        
        for (const update of updates) {
            try {
                const response = await App.api.put(`/member-products/${update.memberProductId}/coach`, {
                    coachId: update.coachId
                });
                if (response && response.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                App.err(`이용권 ${update.memberProductId} 코치 업데이트 실패:`, error);
                failCount++;
            }
        }
        
        if (successCount > 0) {
            App.showNotification(`${successCount}개의 이용권 코치가 업데이트되었습니다.`, 'success');
            // 모달 새로고침
            setTimeout(() => {
                showUnassignedMembers();
            }, 500);
        } else {
            App.showNotification('코치 업데이트에 실패했습니다.', 'danger');
        }
    } catch (error) {
        App.err('코치 배정 저장 실패:', error);
        App.showNotification('코치 배정 저장 중 오류가 발생했습니다.', 'danger');
    }
}

// 코치별 통계
async function loadCoachStats(startDate, endDate) {
    try {
        // 모든 활성 이용권 가져오기 (MemberProduct 기준)
        const allMemberProducts = await App.api.get('/member-products?status=ACTIVE');
        const attendances = await App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`);
        
        // 코치별 그룹화 (MemberProduct의 coach 기준)
        const coachGroups = {};
        const coachNameToId = {}; // 코치 이름 -> 코치 ID 매핑
        const memberIdSet = new Set(); // 중복 카운트 방지용 (회원별로 한 번만 카운트)
        
        // 활성 이용권 기준으로 코치별 회원 수 계산
        const unassignedMemberIds = new Set(); // 코치가 없는 이용권을 가진 회원
        
        // 미배정 = 이용권에 직접 배정된 코치 없음 (API의 coachId 기준, product.coach 무관)
        const unassignedProducts = [];
        allMemberProducts.forEach(mp => {
            const coachIdOnTicket = mp.coachId != null ? mp.coachId : (mp.coach && mp.coach.id);
            const hasCoachOnTicket = coachIdOnTicket != null && coachIdOnTicket !== '';
            if (!hasCoachOnTicket) {
                if (mp.member && mp.member.id) unassignedMemberIds.add(mp.member.id);
                unassignedProducts.push({
                    memberProductId: mp.id,
                    memberId: mp.member?.id,
                    memberName: mp.member?.name,
                    memberNumber: mp.member?.memberNumber,
                    productName: mp.product?.name,
                    productId: mp.product?.id
                });
            }
        });
        
        allMemberProducts.forEach(mp => {
            // 코치별 집계: 이용권에 코치가 직접 배정된 건만 (coachId 기준)
            const coachIdOnTicket = mp.coachId != null ? mp.coachId : (mp.coach && mp.coach.id);
            if (coachIdOnTicket == null || coachIdOnTicket === '') return;
            const coach = mp.coach && mp.coach.id ? mp.coach : null;
            if (!coach || !coach.id) return;
            
            const coachName = coach.name;
            const coachId = coach.id;
            
            if (!coachGroups[coachName]) {
                coachGroups[coachName] = {
                    memberCount: 0,
                    attendanceCount: 0,
                    coachId: coachId,
                    memberIds: new Set(),
                    memberTicketCounts: {} // 회원별 이용권 개수 (중복 회원 수 계산용)
                };
                coachNameToId[coachName] = coachId;
            }
            if (mp.member && mp.member.id) {
                const mid = mp.member.id;
                coachGroups[coachName].memberIds.add(mid);
                coachGroups[coachName].memberCount++;
                coachGroups[coachName].memberTicketCounts[mid] = (coachGroups[coachName].memberTicketCounts[mid] || 0) + 1;
            }
        });
        
        // 코치별로 이용권 2개 이상 보유 회원 수(중복 회원 수) 계산
        Object.keys(coachGroups).forEach(name => {
            const g = coachGroups[name];
            g.duplicateMemberCount = Object.values(g.memberTicketCounts || {}).filter(c => c > 1).length;
        });
        
        if (unassignedProducts.length > 0) {
            App.warn(`[코치별 통계] ⚠️ 코치가 없는 활성 이용권 ${unassignedProducts.length}개 발견:`, unassignedProducts);
            App.warn(`[코치별 통계] 코치가 없는 이용권을 가진 회원 ${unassignedMemberIds.size}명:`, Array.from(unassignedMemberIds));
        } else {
            App.log(`[코치별 통계] ✅ 모든 활성 이용권에 코치가 배정되어 있습니다.`);
        }
        
        // 코치별 출석 수 계산 (출석의 booking.memberProduct.coach 기준)
        let unassignedAttendanceCount = 0; // 코치를 찾지 못한 출석 수 (디버깅용)
        attendances.forEach(att => {
            let coach = null;
            
            // 출석의 booking.memberProduct에서 코치 찾기
            if (att.booking && att.booking.memberProduct) {
                const mp = att.booking.memberProduct;
                if (mp.coach && mp.coach.id) {
                    coach = mp.coach;
                } else if (mp.product && mp.product.coach && mp.product.coach.id) {
                    coach = mp.product.coach;
                }
            }
            
            if (coach && coach.id && coach.name) {
                const coachName = coach.name;
                if (coachGroups[coachName]) {
                    coachGroups[coachName].attendanceCount++;
                } else {
                    // 코치는 있지만 그룹에 없는 경우 (이용권이 만료되었을 수 있음)
                    App.log(`[코치별 통계] 출석의 코치 "${coachName}"가 그룹에 없음 (이용권 만료 가능성)`);
                }
            } else {
                // 코치를 찾지 못한 출석
                unassignedAttendanceCount++;
                App.log(`[코치별 통계] 출석 ID ${att.id}에서 코치를 찾을 수 없음:`, {
                    hasBooking: !!att.booking,
                    hasMemberProduct: !!(att.booking && att.booking.memberProduct),
                    memberProduct: att.booking?.memberProduct
                });
            }
        });
        
        // 코치를 찾지 못한 출석이 있으면 로그
        if (unassignedAttendanceCount > 0) {
            App.warn(`[코치별 통계] ⚠️ 코치를 찾을 수 없는 출석 ${unassignedAttendanceCount}건 발견`);
        }
        
        // 코치가 없는 이용권이 있거나, 코치를 찾을 수 없는 출석이 있으면 "미배정" 그룹 추가 (건수 = 활성 이용권 개수)
        if (unassignedProducts.length > 0 || unassignedAttendanceCount > 0) {
            const unassignedTicketCounts = {};
            unassignedProducts.forEach(p => {
                if (p.memberId) {
                    unassignedTicketCounts[p.memberId] = (unassignedTicketCounts[p.memberId] || 0) + 1;
                }
            });
            const unassignedDuplicateCount = Object.values(unassignedTicketCounts).filter(c => c > 1).length;
            coachGroups['미배정'] = {
                memberCount: unassignedProducts.length,
                attendanceCount: unassignedAttendanceCount,
                coachId: null,
                memberIds: unassignedMemberIds,
                memberTicketCounts: unassignedTicketCounts,
                duplicateMemberCount: unassignedDuplicateCount
            };
        }
        
        const tbody = document.getElementById('coach-stats-body');
        
        // 코치가 없는 이용권이 있으면 경고 메시지 추가 (회원 수 vs 이용권 수 구분 명시)
        let warningMessage = '';
        if (unassignedProducts.length > 0) {
            warningMessage = `
                <tr style="background-color: var(--warning-bg, #fff3cd);">
                    <td colspan="3" style="text-align: center; color: var(--warning, #856404); padding: 12px;">
                        ⚠️ 코치가 없는 활성 이용권 <strong>${unassignedProducts.length}개</strong> 발견
                        (해당 이용권을 가진 회원 <strong>${unassignedMemberIds.size}명</strong>)
                        <br><small>아래 숫자는 모두 활성 이용권 건수 기준입니다. 1명이 여러 이용권을 보유하면 이용권 수만큼 집계됩니다.</small>
                        <br><small>콘솔에서 상세 정보를 확인하세요.</small>
                    </td>
                </tr>
            `;
        }
        
        // 담당 회원 수가 많은 순으로 정렬
        const coaches = Object.keys(coachGroups).sort((a, b) => {
            // "미배정"은 항상 마지막에
            if (a === '미배정') return 1;
            if (b === '미배정') return -1;
            return coachGroups[b].memberCount - coachGroups[a].memberCount;
        });
        
        if (coaches.length === 0) {
            tbody.innerHTML = warningMessage + '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">데이터가 없습니다.</td></tr>';
            return;
        }
        
        // 코치 목록 가져오기 (색상 및 ID 매핑용)
        let allCoaches = [];
        try {
            allCoaches = await App.api.get('/coaches');
        } catch (error) {
            App.warn('코치 목록 로드 실패 (색상 적용 건너뜀):', error);
        }
        
        // 코치 이름 -> 코치 객체 매핑 (색상 적용용)
        const coachNameToCoach = {};
        allCoaches.forEach(coach => {
            if (coach.name && !coachNameToCoach[coach.name]) {
                coachNameToCoach[coach.name] = coach;
            }
        });
        
        tbody.innerHTML = warningMessage + coaches.map(coachName => {
            const group = coachGroups[coachName];
            const coachId = group.coachId || coachNameToId[coachName];
            
            // 코치 이름에 색상 적용
            let coachNameDisplay = coachName;
            const coach = coachNameToCoach[coachName];
            if (coach && App.CoachColors && typeof App.CoachColors.getColor === 'function') {
                const color = App.CoachColors.getColor(coach);
                if (color) {
                    coachNameDisplay = `<span style="color: ${color}; font-weight: 600;">${coachName}</span>`;
                }
            }
            
            // 담당 회원(이용권 건수) + 중복 회원 수 표시 (이용권 2개 이상 보유 회원이 있으면 +N명)
            const dupCount = group.duplicateMemberCount || 0;
            const suffix = dupCount > 0 ? ` <span style="color: var(--text-secondary); font-weight: normal;">(+${dupCount}명)</span>` : '';
            let memberCountDisplay = `${group.memberCount}건${suffix}`;
            if (coachName === '미배정') {
                memberCountDisplay = `<a href="#" onclick="showUnassignedMembers(); return false;" style="color: var(--accent-primary); text-decoration: underline; cursor: pointer; font-weight: 600;">${group.memberCount}건</a>${suffix}`;
            } else if (coachId) {
                memberCountDisplay = `<a href="#" onclick="showCoachStudentsByMemberProduct(${coachId}); return false;" style="color: var(--accent-primary); text-decoration: underline; cursor: pointer; font-weight: 600;">${group.memberCount}건</a>${suffix}`;
            }
            
            return `
                <tr>
                    <td>${coachNameDisplay}</td>
                    <td>${memberCountDisplay}</td>
                    <td>${group.attendanceCount}회</td>
                </tr>
            `;
        }).join('');
        
        // 테이블이 비어있으면 메시지 표시
        if (tbody.innerHTML.trim() === '') {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">데이터가 없습니다.</td></tr>';
        }
    } catch (error) {
        App.err('코치별 통계 로드 실패:', error);
        const tbody = document.getElementById('coach-stats-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">데이터를 불러올 수 없습니다.</td></tr>';
        }
    }
}

// 지점별 통계
async function loadBranchStats() {
    try {
        const members = await App.api.get('/members');
        
        // 간단한 막대 차트 형식으로 표시
        const container = document.getElementById('branch-stats-container');
        
        // 현재는 사하점만 운영 중
        const totalMembers = members.length;
        const sahaCount = totalMembers;  // 전체가 사하점
        const yeonsanCount = 0;           // 연산점은 아직 없음
        
        container.innerHTML = `
            <div class="branch-stat-item branch-stat-item--all">
                <div class="branch-stat-label">📍 전체</div>
                <div class="branch-stat-value">${totalMembers}</div>
                <div class="branch-stat-unit">명</div>
            </div>
            <div class="branch-stat-item branch-stat-item--saha">
                <div class="branch-stat-label">📍 사하점</div>
                <div class="branch-stat-value">${sahaCount}</div>
                <div class="branch-stat-unit">명</div>
            </div>
            <div class="branch-stat-item branch-stat-item--yeonsan">
                <div class="branch-stat-label">📍 연산점</div>
                <div class="branch-stat-value">${yeonsanCount}</div>
                <div class="branch-stat-unit">명</div>
            </div>
        `;
    } catch (error) {
        App.err('지점별 통계 로드 실패:', error);
    }
}

// 월별 출석 추이 (간단한 텍스트 기반)
async function loadMonthlyAttendance() {
    try {
        // 최근 6개월 데이터
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                year: month.getFullYear(),
                month: month.getMonth() + 1,
                label: `${month.getFullYear()}.${String(month.getMonth() + 1).padStart(2, '0')}`
            });
        }
        
        const monthlyData = [];
        for (const month of months) {
            const startDate = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
            const lastDay = new Date(month.year, month.month, 0).getDate();
            const endDate = `${month.year}-${String(month.month).padStart(2, '0')}-${lastDay}`;
            
            try {
                const attendances = await App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`);
                monthlyData.push({
                    label: month.label,
                    count: attendances.length
                });
            } catch (error) {
                monthlyData.push({
                    label: month.label,
                    count: 0
                });
            }
        }
        
        // 깔끔한 막대 차트
        const container = document.getElementById('monthly-chart');
        const maxCount = Math.max(...monthlyData.map(d => d.count), 1);
        
        container.innerHTML = `
            <div style="padding: 24px 20px;">
                <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 240px; gap: 16px; border-bottom: 2px solid var(--border-color); padding-bottom: 0;">
                    ${monthlyData.map(data => {
                        let height = 0;
                        let barColor = '';
                        let textColor = '';
                        
                        if (data.count > 0) {
                            // 최소 40px, 최대 200px로 스케일링
                            height = Math.max(40, (data.count / maxCount) * 200);
                            barColor = '#4F46E5';
                            textColor = '#4F46E5';
                        } else {
                            // 0일 때는 매우 작은 막대
                            height = 5;
                            barColor = '#E5E7EB';
                            textColor = '#9CA3AF';
                        }
                        
                        return `
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                                <div style="font-size: 14px; font-weight: 600; color: ${textColor}; min-height: 20px;">
                                    ${data.count > 0 ? data.count + '회' : ''}
                                </div>
                                <div style="
                                    width: 100%; 
                                    max-width: 60px;
                                    height: ${height}px; 
                                    background-color: ${barColor};
                                    border-radius: 6px 6px 0 0;
                                    transition: all 0.2s ease;
                                    cursor: pointer;
                                " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"></div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 12px; padding: 0 8px;">
                    ${monthlyData.map(data => `
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 11px; color: var(--text-secondary); font-weight: 500;">${data.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        App.err('월별 추이 로드 실패:', error);
    }
}

// TOP 3 추출 (동점자 포함)
function getTop3WithTies(records, getValueFn) {
    if (records.length === 0) return [];
    
    // 내림차순 정렬
    const sorted = records.sort((a, b) => getValueFn(b) - getValueFn(a));
    
    const result = [];
    let currentRank = 1;
    let currentValue = getValueFn(sorted[0]);
    
    for (let i = 0; i < sorted.length; i++) {
        const value = getValueFn(sorted[i]);
        
        // 값이 바뀌면 등수 업데이트
        if (value !== currentValue) {
            currentRank = i + 1;
            currentValue = value;
            
            // 4등 이상은 제외
            if (currentRank > 3) break;
        }
        
        result.push(sorted[i]);
    }
    
    return result;
}

// TOP 기록 보유자 (훈련 기록 + 회원 기록 모두 포함)
async function loadTopRecords() {
    try {
        const [trainingLogs, members] = await Promise.all([
            App.api.get('/training-logs'),
            App.api.get('/members')
        ]);
        
        App.log('훈련 기록 수:', trainingLogs.length);
        App.log('전체 회원 수:', members.length);
        
        // 회원별 최고 기록 집계
        const memberRecords = {};
        
        // 1. 회원 기본 정보의 기록 수집
        members.forEach(member => {
            if (!memberRecords[member.id]) {
                memberRecords[member.id] = {
                    member: member,
                    maxSwingSpeed: 0,
                    maxBallSpeed: 0,
                    maxPitchSpeed: 0
                };
            }
            
            // 회원 정보에 저장된 기록 반영
            if (member.swingSpeed && member.swingSpeed > memberRecords[member.id].maxSwingSpeed) {
                memberRecords[member.id].maxSwingSpeed = member.swingSpeed;
            }
            if (member.exitVelocity && member.exitVelocity > memberRecords[member.id].maxBallSpeed) {
                memberRecords[member.id].maxBallSpeed = member.exitVelocity;
            }
            if (member.pitchingSpeed && member.pitchingSpeed > memberRecords[member.id].maxPitchSpeed) {
                memberRecords[member.id].maxPitchSpeed = member.pitchingSpeed;
            }
        });
        
        // 2. 훈련 기록의 최고 기록 수집
        trainingLogs.forEach(log => {
            if (!log.member) return;
            
            const memberId = log.member.id;
            if (!memberRecords[memberId]) {
                memberRecords[memberId] = {
                    member: log.member,
                    maxSwingSpeed: 0,
                    maxBallSpeed: 0,
                    maxPitchSpeed: 0
                };
            }
            
            // 훈련 기록의 최고 기록 업데이트
            if (log.swingSpeed && log.swingSpeed > memberRecords[memberId].maxSwingSpeed) {
                memberRecords[memberId].maxSwingSpeed = log.swingSpeed;
            }
            if (log.ballSpeed && log.ballSpeed > memberRecords[memberId].maxBallSpeed) {
                memberRecords[memberId].maxBallSpeed = log.ballSpeed;
            }
            if (log.pitchSpeed && log.pitchSpeed > memberRecords[memberId].maxPitchSpeed) {
                memberRecords[memberId].maxPitchSpeed = log.pitchSpeed;
            }
        });
        
        // 배열로 변환
        const recordsArray = Object.values(memberRecords);
        App.log('기록 있는 회원 수:', recordsArray.length);
        
        // 스윙속도 TOP 3 (동점자 포함)
        const topSwing = getTop3WithTies(
            recordsArray.filter(r => r.maxSwingSpeed > 0),
            r => r.maxSwingSpeed
        ).map(r => ({
            ...r.member,
            recordValue: r.maxSwingSpeed
        }));
        renderTopRecordsFromLogs('top-swing-speed', topSwing, 'mph');
        
        // 타구속도 TOP 3 (동점자 포함)
        const topBall = getTop3WithTies(
            recordsArray.filter(r => r.maxBallSpeed > 0),
            r => r.maxBallSpeed
        ).map(r => ({
            ...r.member,
            recordValue: r.maxBallSpeed
        }));
        renderTopRecordsFromLogs('top-exit-velocity', topBall, 'mph');
        
        // 구속 TOP 3 (동점자 포함)
        const topPitch = getTop3WithTies(
            recordsArray.filter(r => r.maxPitchSpeed > 0),
            r => r.maxPitchSpeed
        ).map(r => ({
            ...r.member,
            recordValue: r.maxPitchSpeed
        }));
        renderTopRecordsFromLogs('top-pitching-speed', topPitch, 'km/h');
    } catch (error) {
        App.err('TOP 기록 로드 실패:', error);
    }
}

function renderTopRecordsFromLogs(containerId, members, unit) {
    const container = document.getElementById(containerId);
    
    if (members.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">기록이 없습니다.</p>';
        return;
    }
    
    container.innerHTML = members.map((member, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'other';
        const value = typeof member.recordValue === 'number' ? member.recordValue.toFixed(1) : member.recordValue;
        const grade = member.grade || 'SOCIAL';
        const gradeBadgeClass = getGradeBadge(grade);
        const gradeText = App.MemberGrade ? App.MemberGrade.getText(grade) : grade;
        const gradeHtml = `<span class="badge badge-${gradeBadgeClass}">${App.escapeHtml ? App.escapeHtml(gradeText) : gradeText}</span>`;

        return `
            <div class="top-record-item">
                <div class="top-record-rank ${rankClass}">${rank}</div>
                <div class="top-record-info">
                    <div class="top-record-name">${App.escapeHtml ? App.escapeHtml(member.name) : member.name}</div>
                    <div class="top-record-grade">${gradeHtml}</div>
                </div>
                <div class="top-record-value">${value} ${unit}</div>
            </div>
        `;
    }).join('');
}
