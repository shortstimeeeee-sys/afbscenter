// 만료 임박 회원 관리

async function loadExpiringMembers() {
    try {
        const members = await App.api.get('/members');
        const today = new Date();
        
        const expiringMembers = [];
        
        members.forEach(member => {
            let urgencyLevel = 0;
            let reason = '';
            let daysLeft = null;
            let countLeft = null;
            
            // 횟수 5회 이하 체크
            if (member.remainingCount && member.remainingCount > 0 && member.remainingCount <= 5) {
                urgencyLevel = 2;
                countLeft = member.remainingCount;
                reason = `${member.remainingCount}회 남음`;
            }
            
            // 기간 7일 이하 체크
            if (member.periodPassEndDate) {
                const endDate = new Date(member.periodPassEndDate);
                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays <= 7) {
                    daysLeft = diffDays;
                    if (urgencyLevel === 2) {
                        reason = `${member.remainingCount}회 남음 / ${diffDays}일 남음`;
                    } else {
                        urgencyLevel = 1;
                        reason = `${diffDays}일 남음`;
                    }
                }
            }
            
            if (urgencyLevel > 0) {
                expiringMembers.push({
                    ...member,
                    urgencyLevel,
                    reason,
                    daysLeft,
                    countLeft
                });
            }
        });
        
        // 긴급도 순으로 정렬
        expiringMembers.sort((a, b) => {
            if (a.countLeft && b.countLeft) {
                return a.countLeft - b.countLeft;
            } else if (a.countLeft && !b.countLeft) {
                return -1;
            } else if (!a.countLeft && b.countLeft) {
                return 1;
            }
            if (a.daysLeft !== null && b.daysLeft !== null) {
                return a.daysLeft - b.daysLeft;
            }
            return 0;
        });
        
        renderExpiringMembers(expiringMembers);
    } catch (error) {
        console.error('만료 임박 회원 로드 실패:', error);
        document.getElementById('expiring-members').innerHTML = '<p style="color: var(--text-muted);">데이터 로드 실패</p>';
    }
}

function renderExpiringMembers(members) {
    const container = document.getElementById('expiring-members');
    
    if (!members || members.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 16px; text-align: center;">만료 임박 회원이 없습니다.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>회원명</th>
                        <th>등급</th>
                        <th>담당 코치</th>
                        <th>상태</th>
                        <th>전화번호</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(member => {
                        let statusColor = '#28a745';
                        let statusWeight = '600';
                        
                        if (member.countLeft) {
                            if (member.countLeft >= 1 && member.countLeft <= 2) {
                                statusColor = '#dc3545';
                                statusWeight = '700';
                            } else if (member.countLeft >= 3 && member.countLeft <= 5) {
                                statusColor = '#fd7e14';
                                statusWeight = '700';
                            }
                        } else if (member.daysLeft !== null) {
                            if (member.daysLeft >= 0 && member.daysLeft <= 3) {
                                statusColor = '#dc3545';
                                statusWeight = '700';
                            } else if (member.daysLeft >= 4 && member.daysLeft <= 7) {
                                statusColor = '#fd7e14';
                                statusWeight = '700';
                            }
                        }
                        
                        return `
                            <tr>
                                <td><strong>${member.name}</strong></td>
                                <td><span class="badge badge-${getGradeBadgeForExpiring(member.grade)}">${getGradeTextForExpiring(member.grade)}</span></td>
                                <td>${member.coach ? member.coach.name : '미배정'}</td>
                                <td><span style="color: ${statusColor}; font-weight: ${statusWeight};">${member.reason}</span></td>
                                <td>${member.phoneNumber}</td>
                                <td>
                                    <button class="btn btn-sm btn-success" onclick="handleExtendFromDashboard(${member.id})">연장</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getGradeBadgeForExpiring(grade) {
    const badgeMap = {
        'ELITE_ELEMENTARY': 'elite-elementary',
        'ELITE_MIDDLE': 'elite-middle',
        'ELITE_HIGH': 'elite-high',
        'YOUTH': 'youth',
        'SOCIAL': 'social'
    };
    return badgeMap[grade] || 'social';
}

function getGradeTextForExpiring(grade) {
    if (typeof App !== 'undefined' && App.MemberGrade) {
        return App.MemberGrade.getText(grade);
    }
    const gradeMap = {
        'ELITE_ELEMENTARY': '엘리트(초)',
        'ELITE_MIDDLE': '엘리트(중)',
        'ELITE_HIGH': '엘리트(고)',
        'YOUTH': '유소년',
        'SOCIAL': '사회인'
    };
    return gradeMap[grade] || grade;
}

// 대시보드에서 연장 처리
function handleExtendFromDashboard(memberId) {
    // 회원 관리 페이지로 이동하면서 연장 모달 열기
    window.location.href = `/members.html?id=${memberId}&action=extend`;
}
