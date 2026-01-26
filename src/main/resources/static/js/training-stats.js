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
        console.error('통계 로드 실패:', error);
        App.showNotification('통계 데이터 로드에 실패했습니다.', 'danger');
    }
}

// 전체 요약 통계
async function loadSummaryStats(startDate, endDate) {
    try {
        const members = await App.api.get('/members');
        const attendances = await App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`);
        const trainingLogs = await App.api.get(`/training-logs?startDate=${startDate}&endDate=${endDate}`);
        
        document.getElementById('total-members').textContent = members.length;
        document.getElementById('total-attendance').textContent = attendances.length;
        document.getElementById('total-training-logs').textContent = trainingLogs.length;
        
        // 평균 출석률 계산 (기간 내 출석 / 전체 회원 수)
        const avgRate = members.length > 0 ? ((attendances.length / members.length) * 100).toFixed(1) : 0;
        document.getElementById('avg-attendance-rate').textContent = avgRate + '%';
    } catch (error) {
        console.error('요약 통계 로드 실패:', error);
    }
}

// 등급별 평균 기록
async function loadGradeStats(startDate, endDate) {
    try {
        const members = await App.api.get('/members');
        const attendances = await App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`);
        
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
            
            // 기록 수집
            if (member.swingSpeed) gradeGroups[grade].swingSpeeds.push(member.swingSpeed);
            if (member.exitVelocity) gradeGroups[grade].exitVelocities.push(member.exitVelocity);
            if (member.pitchingSpeed) gradeGroups[grade].pitchingSpeeds.push(member.pitchingSpeed);
        });
        
        const tbody = document.getElementById('grade-stats-body');
        // 등급 순서: 고 -> 중 -> 초 -> 사회인
        const gradeOrder = ['ELITE_HIGH', 'ELITE_MIDDLE', 'ELITE_ELEMENTARY', 'SOCIAL'];
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
    } catch (error) {
        console.error('등급별 통계 로드 실패:', error);
    }
}

// 등급별 배지 색상
function getGradeBadge(grade) {
    switch(grade) {
        case 'ELITE_ELEMENTARY': return 'elite-elementary';
        case 'ELITE_MIDDLE': return 'elite-middle';
        case 'ELITE_HIGH': return 'elite-high';
        case 'YOUTH': return 'youth';
        case 'SOCIAL': return 'social';
        default: return 'social';
    }
}

// 코치별 통계
async function loadCoachStats(startDate, endDate) {
    try {
        const members = await App.api.get('/members');
        const attendances = await App.api.get(`/attendance/checked-in?startDate=${startDate}&endDate=${endDate}`);
        
        // 코치별 그룹화
        const coachGroups = {};
        members.forEach(member => {
            const coachName = member.coach ? member.coach.name : '미배정';
            if (!coachGroups[coachName]) {
                coachGroups[coachName] = {
                    memberCount: 0,
                    attendanceCount: 0
                };
            }
            coachGroups[coachName].memberCount++;
        });
        
        // 코치별 출석 수 계산
        attendances.forEach(att => {
            if (att.member && att.member.coach) {
                const coachName = att.member.coach.name;
                if (coachGroups[coachName]) {
                    coachGroups[coachName].attendanceCount++;
                }
            } else {
                if (coachGroups['미배정']) {
                    coachGroups['미배정'].attendanceCount++;
                }
            }
        });
        
        const tbody = document.getElementById('coach-stats-body');
        // 담당 회원 수가 많은 순으로 정렬
        const coaches = Object.keys(coachGroups).sort((a, b) => {
            return coachGroups[b].memberCount - coachGroups[a].memberCount;
        });
        
        if (coaches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">데이터가 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = coaches.map(coachName => {
            const group = coachGroups[coachName];
            return `
                <tr>
                    <td>${coachName}</td>
                    <td>${group.memberCount}명</td>
                    <td>${group.attendanceCount}회</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('코치별 통계 로드 실패:', error);
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
            <div class="branch-stat-item">
                <div class="branch-stat-label">📍 전체</div>
                <div class="branch-stat-value">${totalMembers}</div>
                <div class="branch-stat-unit">명</div>
            </div>
            <div class="branch-stat-item">
                <div class="branch-stat-label">📍 사하점</div>
                <div class="branch-stat-value">${sahaCount}</div>
                <div class="branch-stat-unit">명</div>
            </div>
            <div class="branch-stat-item">
                <div class="branch-stat-label">📍 연산점</div>
                <div class="branch-stat-value">${yeonsanCount}</div>
                <div class="branch-stat-unit">명</div>
            </div>
        `;
    } catch (error) {
        console.error('지점별 통계 로드 실패:', error);
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
        console.error('월별 추이 로드 실패:', error);
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
        
        console.log('훈련 기록 수:', trainingLogs.length);
        console.log('전체 회원 수:', members.length);
        
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
        console.log('기록 있는 회원 수:', recordsArray.length);
        
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
        console.error('TOP 기록 로드 실패:', error);
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
        
        return `
            <div class="top-record-item">
                <div class="top-record-rank ${rankClass}">${rank}</div>
                <div class="top-record-info">
                    <div class="top-record-name">${member.name}</div>
                    <div class="top-record-grade">${App.MemberGrade.getText(member.grade || 'SOCIAL')}</div>
                </div>
                <div class="top-record-value">${value} ${unit}</div>
            </div>
        `;
    }).join('');
}
