// 예약/대관 관리 페이지 JavaScript

let currentDate = new Date();
let currentView = 'calendar';
let currentPage = 1;
let selectedBooking = null; // 현재 선택된 예약

// 목적 변경 시 레슨 카테고리 필드 표시/숨김
function toggleLessonCategory() {
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryGroup = document.getElementById('lesson-category-group');
    if (lessonCategoryGroup) {
        lessonCategoryGroup.style.display = (purpose === 'LESSON') ? 'block' : 'none';
        // 레슨 종목이 표시될 때 필터링 적용
        if (purpose === 'LESSON') {
            filterLessonCategoryOptions();
        }
    }
}

// 반복 예약 옵션 표시/숨김
function toggleRepeatOptions() {
    const enabled = document.getElementById('booking-repeat-enabled').checked;
    const repeatOptions = document.getElementById('repeat-options');
    if (repeatOptions) {
        repeatOptions.style.display = enabled ? 'block' : 'none';
    }
}

// 코치별 색상 가져오기 (common.js의 App.CoachColors 사용)
function getCoachColor(coach) {
    return App.CoachColors.getColor(coach);
}

// 날짜의 모든 예약에서 코치 색상 추출하여 배경색 결정
function getCoachColors(bookings) {
    const colors = new Set();
    bookings.forEach(booking => {
        // 예약에 직접 할당된 코치 또는 회원의 코치
        const coach = booking.coach || (booking.member && booking.member.coach ? booking.member.coach : null);
        if (coach) {
            const color = getCoachColor(coach);
            if (color) colors.add(color);
        }
    });
    return Array.from(colors);
}

// 배경색 결정 (여러 코치가 있으면 혼합)
function getDayBackgroundColor(coachColors) {
    if (coachColors.length === 0) return null;
    if (coachColors.length === 1) {
        // 단일 색상이면 투명도 적용
        return coachColors[0] + '20'; // 20 = 약 12% 투명도
    }
    // 여러 색상이면 그라데이션 (간단히 첫 번째 색상 사용)
    return coachColors[0] + '15'; // 15 = 약 8% 투명도
}

document.addEventListener('DOMContentLoaded', function() {
    initializeBookings();
    
    // 레슨 종목 필터링 (페이지 타입에 따라)
    filterLessonCategoryOptions();
    
    // 초기 뷰에 따라 전체 확인 버튼 표시/숨김
    const confirmAllBtn = document.getElementById('btn-confirm-all');
    if (confirmAllBtn) {
        confirmAllBtn.style.display = (currentView === 'list') ? 'inline-block' : 'none';
    }
    
    // Delete 키로 예약 삭제
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' && selectedBooking) {
            e.preventDefault();
            deleteSelectedBooking();
        }
    });
});

// 원본 레슨 종목 옵션 저장
let originalLessonCategoryOptions = null;

// 원본 레슨 종목 옵션 초기화 (필요시)
function initializeOriginalLessonCategoryOptions() {
    const lessonCategorySelect = document.getElementById('booking-lesson-category');
    if (!lessonCategorySelect) return;
    
    // 원본 옵션이 없으면 현재 옵션을 원본으로 저장
    if (!originalLessonCategoryOptions || originalLessonCategoryOptions.length === 0) {
        originalLessonCategoryOptions = Array.from(lessonCategorySelect.options).map(opt => ({
            value: opt.value,
            text: opt.text
        }));
        console.log('[레슨 종목] 원본 옵션 초기화:', originalLessonCategoryOptions);
    }
}

// 레슨 종목 옵션 필터링
function filterLessonCategoryOptions() {
    const config = window.BOOKING_PAGE_CONFIG || {};
    const facilityType = config.facilityType;
    const lessonCategorySelect = document.getElementById('booking-lesson-category');
    
    if (!lessonCategorySelect) return;
    
    // 원본 옵션 초기화 (필요시)
    initializeOriginalLessonCategoryOptions();
    
    // 원본 옵션이 없으면 필터링 불가
    if (!originalLessonCategoryOptions || originalLessonCategoryOptions.length === 0) {
        console.warn('[레슨 종목 필터링] 원본 옵션이 없어 필터링 불가');
        return;
    }
    
    // facilityType에 따라 필터링
    if (facilityType === 'BASEBALL') {
        // 야구만 표시하고 자동 선택 및 고정
        lessonCategorySelect.innerHTML = '';
        const baseballOption = originalLessonCategoryOptions.find(opt => opt.value === 'BASEBALL');
        if (baseballOption) {
            const option = document.createElement('option');
            option.value = baseballOption.value;
            option.textContent = baseballOption.text;
            option.selected = true; // 자동 선택
            lessonCategorySelect.appendChild(option);
        }
        // 야구로 고정 (변경 불가능)
        lessonCategorySelect.disabled = true;
        lessonCategorySelect.style.backgroundColor = 'var(--bg-secondary)';
        lessonCategorySelect.style.color = 'var(--text-muted)';
    } else if (facilityType === 'TRAINING_FITNESS') {
        // 필라테스와 트레이닝만 표시
        lessonCategorySelect.innerHTML = '<option value="">레슨 종목 선택...</option>';
        const pilatesOption = originalLessonCategoryOptions.find(opt => opt.value === 'PILATES');
        const trainingOption = originalLessonCategoryOptions.find(opt => opt.value === 'TRAINING');
        if (pilatesOption) {
            const option = document.createElement('option');
            option.value = pilatesOption.value;
            option.textContent = pilatesOption.text;
            lessonCategorySelect.appendChild(option);
        }
        if (trainingOption) {
            const option = document.createElement('option');
            option.value = trainingOption.value;
            option.textContent = trainingOption.text;
            lessonCategorySelect.appendChild(option);
        }
    }
    // RENTAL이나 기타는 모든 옵션 유지
}

async function initializeBookings() {
    // 뷰 전환 이벤트
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            switchView(view);
        });
    });
    
    // 시설 목록 로드
    await loadFacilities();
    
    // 코치 목록 로드 (예약 모달용)
    await loadCoachesForBooking();
    
    // 코치 범례 로드
    await loadCoachLegend();
    
    if (currentView === 'calendar') {
        renderCalendar();
    } else {
        loadBookingsList();
    }
}

// 시설 목록 로드
async function loadFacilities() {
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
        const expectedBranch = config.branch?.toUpperCase();
        
        console.log(`[시설 로드] ========================================`);
        console.log(`[시설 로드] 페이지 설정:`, config);
        console.log(`[시설 로드] 요청 - 지점: ${expectedBranch} (모든 타입의 시설 표시)`);
        console.log(`[시설 로드] ========================================`);
        
        // API 호출 시 지점만 필터링 (타입 필터링 제거 - 모든 시설이 모든 타입 지원)
        const params = new URLSearchParams();
        if (expectedBranch) params.append('branch', expectedBranch);
        // facilityType 파라미터 제거 - 모든 타입의 시설 표시
        
        const apiUrl = `/facilities?${params.toString()}`;
        console.log(`[시설 로드] API 호출: ${apiUrl}`);
        
        const facilities = await App.api.get(apiUrl);
        console.log(`[시설 로드] API 응답 시설 ${facilities.length}개:`, facilities);
        console.log(`[시설 로드] API 응답 상세:`, facilities.map(f => ({ 
            id: f.id, 
            name: f.name, 
            branch: f.branch, 
            type: f.facilityType
        })));
        
        // API 응답에 잘못된 지점의 시설이 포함되어 있는지 확인
        const wrongBranchInResponse = facilities.filter(f => {
            const fb = f.branch?.toString()?.toUpperCase();
            return fb !== expectedBranch;
        });
        if (wrongBranchInResponse.length > 0) {
            console.error(`[시설 로드] ⚠️ API 응답에 잘못된 지점의 시설 포함됨!`, wrongBranchInResponse.map(f => ({ 
                id: f.id, 
                name: f.name, 
                branch: f.branch, 
                expected: expectedBranch 
            })));
            console.error(`[시설 로드] API URL: ${apiUrl}`);
            console.error(`[시설 로드] 요청한 지점: ${expectedBranch}`);
        }
        
        // 해당 지점의 모든 시설만 필터링 (타입 무관)
        const filteredFacilities = facilities.filter(facility => {
            if (!facility) {
                console.warn('[시설 로드] null 또는 undefined 시설 발견');
                return false;
            }
            
            const facilityBranch = facility.branch?.toString()?.toUpperCase();
            
            // null 체크
            if (!facilityBranch) {
                console.warn(`[시설 로드] 시설 데이터 불완전: ${facility.name} (branch: ${facilityBranch})`);
                return false;
            }
            
            const branchMatch = facilityBranch === expectedBranch;
            
            if (!branchMatch) {
                console.log(`[시설 로드] ❌ 지점 불일치 제외: ${facility.name} (지점: ${facilityBranch}, 예상: ${expectedBranch})`);
            } else {
                console.log(`[시설 로드] ✅ 포함: ${facility.name} (지점: ${facilityBranch}, 타입: ${facility.facilityType})`);
            }
            
            return branchMatch;
        });
        
        console.log(`[시설 로드] 최종 필터링된 시설 ${filteredFacilities.length}개:`, filteredFacilities.map(f => ({ id: f.id, name: f.name, branch: f.branch, type: f.facilityType })));
        
        // 필터링 후에도 잘못된 지점의 시설이 있는지 확인
        const wrongBranchFacilities = filteredFacilities.filter(f => {
            const fb = f.branch?.toString()?.toUpperCase();
            return fb !== expectedBranch;
        });
        if (wrongBranchFacilities.length > 0) {
            console.error(`[시설 로드] ⚠️ 필터링 후에도 잘못된 지점의 시설 발견:`, wrongBranchFacilities.map(f => ({ name: f.name, branch: f.branch })));
        }
        
        // 해당 지점의 모든 시설 사용
        const facilitiesToUse = filteredFacilities;
        if (filteredFacilities.length === 0 && facilities.length > 0) {
            console.error(`[시설 로드] ⚠️ ${expectedBranch} 지점에 해당하는 시설이 없습니다!`);
            console.error(`[시설 로드] API 응답 전체 시설:`, facilities.map(f => ({ id: f.id, name: f.name, branch: f.branch, type: f.facilityType })));
        }
        
        const select = document.getElementById('booking-facility');
        if (!select) {
            console.warn('[시설 로드] 시설 select 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 기존 옵션 모두 제거
        select.innerHTML = '<option value="">시설 선택...</option>';
        
        // 필터링된 시설만 추가
        if (facilitiesToUse.length === 0) {
            console.error(`[시설 로드] ❌ ${expectedBranch} 지점에 해당하는 시설이 없습니다!`);
            console.error(`[시설 로드] API 응답 전체 시설 (${facilities.length}개):`, facilities.map(f => ({ 
                id: f.id, 
                name: f.name, 
                branch: f.branch, 
                type: f.facilityType 
            })));
            console.error(`[시설 로드] 필터링 조건: 지점=${expectedBranch} (모든 타입)`);
            
            // 에러 옵션 추가
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = `⚠️ ${expectedBranch} 지점 시설 없음`;
            errorOption.disabled = true;
            select.appendChild(errorOption);
            
            // 사용자에게 알림
            if (facilities.length > 0) {
                const availableBranches = [...new Set(facilities.map(f => f.branch))];
                console.warn(`[시설 로드] 사용 가능한 지점: ${availableBranches.join(', ')}`);
            }
            return;
        }
        
        // 시설 옵션 추가
        console.log(`[시설 로드] 시설 옵션 추가 시작. 시설 수: ${facilitiesToUse.length}`);
        facilitiesToUse.forEach((facility, index) => {
            if (!facility || !facility.id || !facility.name) {
                console.error(`[시설 로드] 잘못된 시설 데이터 (인덱스 ${index}):`, facility);
                return;
            }
            
            const option = document.createElement('option');
            option.value = facility.id.toString();
            option.textContent = facility.name;
            // 시설의 지점 정보를 data 속성에 저장
            if (facility.branch) {
                option.dataset.branch = facility.branch;
            }
            select.appendChild(option);
            console.log(`[시설 로드] 옵션 추가: ${facility.name} (ID: ${facility.id}, 지점: ${facility.branch}, 값: ${option.value})`);
        });
        
        console.log(`[시설 로드] 옵션 추가 완료. 총 옵션 수: ${select.options.length}`);
        console.log(`[시설 로드] 드롭다운 현재 상태:`, {
            value: select.value,
            selectedIndex: select.selectedIndex,
            options: Array.from(select.options).map(opt => ({ value: opt.value, text: opt.textContent }))
        });
        
        // 각 지점별로 첫 번째 시설 자동 선택 및 고정 (새 예약 등록 모드일 때만)
        if (facilitiesToUse.length > 0) {
            const bookingId = document.getElementById('booking-id')?.value;
            // 새 예약 등록 모드일 때만 자동 선택 및 비활성화
            if (!bookingId || bookingId === '') {
                // 필터링된 시설 중에서 올바른 지점의 시설만 다시 필터링 (이중 검증)
                const verifiedFacilities = facilitiesToUse.filter(f => {
                    const fb = f.branch?.toString()?.toUpperCase();
                    const match = fb === expectedBranch;
                    if (!match) {
                        console.error(`[시설 로드] ❌ 필터링된 시설 중 잘못된 지점 발견: ${f.name} (지점: ${fb}, 예상: ${expectedBranch})`);
                    }
                    return match;
                });
                
                if (verifiedFacilities.length === 0) {
                    console.error(`[시설 로드] ❌ 올바른 지점(${expectedBranch})의 시설이 없습니다!`);
                    console.error(`[시설 로드] 필터링된 시설 목록:`, facilitiesToUse.map(f => ({ name: f.name, branch: f.branch })));
                    return;
                }
                
                const selectedFacility = verifiedFacilities[0];
                console.log(`[시설 로드] 첫 번째 시설 선택 시도:`, selectedFacility);
                console.log(`[시설 로드] 선택된 시설 지점 검증: ${selectedFacility.branch} === ${expectedBranch}? ${selectedFacility.branch?.toString()?.toUpperCase() === expectedBranch}`);
                
                // 값 설정 (문자열로 변환)
                const facilityIdStr = selectedFacility.id.toString();
                select.value = facilityIdStr;
                
                console.log(`[시설 로드] 값 설정 후 확인 - 설정값: ${facilityIdStr}, 현재값: ${select.value}, selectedIndex: ${select.selectedIndex}`);
                
                // 선택이 제대로 되었는지 확인
                if (select.value !== facilityIdStr) {
                    console.warn(`[시설 로드] 선택 실패, selectedIndex로 재시도... (설정값: ${facilityIdStr}, 현재값: ${select.value})`);
                    // 강제로 선택 (첫 번째 옵션은 "시설 선택..."이므로 인덱스 1이 첫 번째 시설)
                    if (select.options.length > 1) {
                        select.selectedIndex = 1;
                        console.log(`[시설 로드] selectedIndex 설정 후 - 값: ${select.value}, 텍스트: ${select.options[select.selectedIndex]?.textContent}`);
                    }
                }
                
                // 최종 확인
                if (select.value && select.value !== '') {
                    // 선택된 시설의 지점 정보 확인 및 검증
                    const selectedFacilityBranch = selectedFacility.branch?.toString()?.toUpperCase();
                    const expectedBranchUpper = expectedBranch?.toUpperCase();
                    
                    // 지점 불일치 검증 - 절대 허용하지 않음
                    if (selectedFacilityBranch !== expectedBranchUpper) {
                        console.error(`[시설 로드] ❌❌❌ 심각한 오류: 선택된 시설의 지점이 페이지 설정과 불일치!`);
                        console.error(`[시설 로드] 시설: ${selectedFacility.name}`);
                        console.error(`[시설 로드] 시설 지점: ${selectedFacilityBranch}`);
                        console.error(`[시설 로드] 예상 지점: ${expectedBranchUpper}`);
                        console.error(`[시설 로드] 올바른 지점의 시설을 찾는 중...`);
                        
                        // 올바른 지점의 첫 번째 시설 찾기 (필터링된 목록에서)
                        const correctFacility = facilitiesToUse.find(f => {
                            const fb = f.branch?.toString()?.toUpperCase();
                            const match = fb === expectedBranchUpper;
                            if (match) {
                                console.log(`[시설 로드] ✅ 올바른 시설 발견: ${f.name} (ID: ${f.id}, 지점: ${f.branch})`);
                            }
                            return match;
                        });
                        
                        if (correctFacility) {
                            console.log(`[시설 로드] 올바른 시설로 교체: ${correctFacility.name} (지점: ${correctFacility.branch})`);
                            // 올바른 시설로 변경
                            select.value = correctFacility.id.toString();
                            // 선택이 제대로 되었는지 확인
                            if (select.value !== correctFacility.id.toString() && select.options.length > 1) {
                                // 옵션에서 올바른 시설 찾기
                                for (let i = 0; i < select.options.length; i++) {
                                    const opt = select.options[i];
                                    if (opt.value === correctFacility.id.toString()) {
                                        select.selectedIndex = i;
                                        console.log(`[시설 로드] 옵션 인덱스 ${i}로 선택됨`);
                                        break;
                                    }
                                }
                            }
                            // 올바른 시설 정보로 업데이트
                            const updatedFacility = correctFacility;
                            const updatedText = select.options[select.selectedIndex]?.textContent || updatedFacility.name;
                            
                            // 시설 자동 선택 및 고정 (비활성화)
                            select.disabled = true;
                            select.classList.add('facility-fixed');
                            // 오버레이에 선택된 시설명 표시
                            const displayDiv = document.getElementById('facility-selected-display');
                            const nameSpan = document.getElementById('facility-selected-name');
                            if (displayDiv && nameSpan) {
                                nameSpan.textContent = updatedText;
                                displayDiv.style.display = 'flex';
                            }
                            // 시설의 지점 정보로 booking-branch 업데이트
                            const branchInput = document.getElementById('booking-branch');
                            if (branchInput && updatedFacility.branch) {
                                branchInput.value = updatedFacility.branch.toUpperCase();
                                console.log(`[시설 로드] booking-branch 업데이트: ${updatedFacility.branch.toUpperCase()}`);
                            }
                            console.log(`[시설 로드] ✅✅✅ 올바른 시설로 자동 선택 및 고정 완료: ${updatedText} (ID: ${updatedFacility.id}, 지점: ${updatedFacility.branch})`);
                            return;
                        } else {
                            console.error(`[시설 로드] ❌❌❌ 치명적 오류: 올바른 지점(${expectedBranchUpper})의 시설을 찾을 수 없습니다!`);
                            console.error(`[시설 로드] 필터링된 시설 목록:`, facilitiesToUse.map(f => ({ id: f.id, name: f.name, branch: f.branch })));
                            // 시설 선택을 비활성화하고 에러 메시지 표시
                            select.disabled = false;
                            select.classList.remove('facility-fixed');
                            const displayDiv = document.getElementById('facility-selected-display');
                            if (displayDiv) {
                                displayDiv.style.display = 'none';
                            }
                            App.showNotification(`⚠️ ${expectedBranch === 'SAHA' ? '사하점' : '연산점'} 시설을 찾을 수 없습니다. 시설 관리 페이지에서 시설의 지점 정보를 확인해주세요.`, 'danger');
                            return;
                        }
                    }
                    
                    // 지점이 일치하는 경우 정상 처리
                    // 시설 자동 선택 및 고정 (비활성화)
                    select.disabled = true;
                    select.classList.add('facility-fixed');
                    const selectedText = select.options[select.selectedIndex]?.textContent || selectedFacility.name;
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        nameSpan.textContent = selectedText;
                        displayDiv.style.display = 'flex';
                    }
                    // 시설의 지점 정보로 booking-branch 업데이트
                    const branchInput = document.getElementById('booking-branch');
                    if (branchInput && selectedFacility.branch) {
                        branchInput.value = selectedFacility.branch.toUpperCase();
                        console.log(`[시설 로드] 지점 업데이트: ${selectedFacility.branch.toUpperCase()}`);
                    }
                    console.log(`[시설 로드] ✅ 자동 선택 및 고정 완료: ${selectedText} (ID: ${selectedFacility.id}, 선택값: ${select.value}, 지점: ${selectedFacility.branch}, 옵션 수: ${select.options.length})`);
                } else {
                    console.error(`[시설 로드] ❌ 시설 선택 실패! 선택값이 비어있음.`);
                }
            } else {
                // 수정 모드일 때는 활성화 (기존 시설 유지)
                select.disabled = false;
                select.classList.remove('facility-fixed');
                // 오버레이 숨기기
                const displayDiv = document.getElementById('facility-selected-display');
                if (displayDiv) {
                    displayDiv.style.display = 'none';
                }
                console.log(`[시설 로드] 수정 모드 - 시설 필드 활성화`);
            }
        } else {
            console.warn(`[시설 로드] ${config.branch} 지점에 해당하는 시설이 없습니다.`);
        }
        
        console.log(`[시설 로드] 완료: ${config.branch} 지점 시설 ${facilitiesToUse.length}개 (모든 타입)`);
    } catch (error) {
        console.error('[시설 로드] 시설 목록 로드 실패:', error);
    }
}

// 시설 로드 및 자동 선택 함수 (모달용)
async function loadAndSelectFacility() {
    const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
    const bookingId = document.getElementById('booking-id')?.value;
    const facilitySelect = document.getElementById('booking-facility');
    
    if (!facilitySelect) {
        console.warn('[시설 로드] 시설 select 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 새 예약 등록 모드가 아니면 건너뛰기
    if (bookingId) {
        return;
    }
    
    try {
        // 직접 API 호출하여 시설 로드 (지점만 필터링, 타입 무관)
        const params = new URLSearchParams();
        params.append('branch', config.branch?.toUpperCase());
        // facilityType 파라미터 제거 - 모든 타입의 시설 표시
        const facilities = await App.api.get(`/facilities?${params.toString()}`);
        
        const expectedBranch = config.branch?.toUpperCase();
        const filteredFacilities = facilities.filter(f => {
            return f.branch?.toUpperCase() === expectedBranch;
        });
        
        console.log(`[시설 로드] ${expectedBranch} 지점 시설 ${filteredFacilities.length}개 로드됨 (모든 타입):`, filteredFacilities.map(f => f.name));
        
        if (filteredFacilities.length > 0) {
            // 기존 옵션 모두 제거
            facilitySelect.innerHTML = '<option value="">시설 선택...</option>';
            
            // 시설 옵션 추가
            filteredFacilities.forEach(facility => {
                const option = document.createElement('option');
                option.value = facility.id;
                option.textContent = facility.name;
                facilitySelect.appendChild(option);
            });
            
            console.log(`[시설 로드] 옵션 추가 완료. 총 옵션 수: ${facilitySelect.options.length}`);
            
            // 첫 번째 시설 자동 선택 및 고정
            const firstFacility = filteredFacilities[0];
            
            // 값 설정
            facilitySelect.value = firstFacility.id;
            
            // 선택이 제대로 되었는지 확인하고 재시도
            if (facilitySelect.value !== firstFacility.id.toString()) {
                console.warn(`[시설 로드] 선택 실패, selectedIndex로 재시도...`);
                facilitySelect.selectedIndex = 1; // 첫 번째 옵션(시설 선택...) 다음이 첫 번째 시설
            }
            
            // 시설 자동 선택 및 고정 (비활성화)
            facilitySelect.disabled = true;
            facilitySelect.classList.add('facility-fixed');
            // 최종 확인
            const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent || firstFacility.name;
            // 오버레이에 선택된 시설명 표시
            const displayDiv = document.getElementById('facility-selected-display');
            const nameSpan = document.getElementById('facility-selected-name');
            if (displayDiv && nameSpan) {
                nameSpan.textContent = selectedText;
                displayDiv.style.display = 'flex';
            }
            // 시설의 지점 정보로 booking-branch 업데이트
            const branchInput = document.getElementById('booking-branch');
            if (branchInput && firstFacility.branch) {
                branchInput.value = firstFacility.branch.toUpperCase();
                console.log(`[시설 로드] 지점 업데이트: ${firstFacility.branch.toUpperCase()}`);
            }
            console.log(`[시설 로드] 자동 선택 및 고정 완료: ${firstFacility.name} (선택값: ${facilitySelect.value}, 지점: ${firstFacility.branch}, 표시값: ${selectedText})`);
        } else {
            console.error(`[시설 로드] ${expectedBranch} 지점에 해당하는 시설이 없습니다!`);
            facilitySelect.innerHTML = '<option value="">⚠️ 해당 지점 시설 없음</option>';
        }
    } catch (error) {
        console.error('[시설 로드] 시설 로드 실패:', error);
    }
}

// 코치 목록 로드 (예약 모달용)
async function loadCoachesForBooking() {
    try {
        const coaches = await App.api.get('/coaches');
        const select = document.getElementById('booking-coach');
        if (!select) return;
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || {};
        const allowedCoaches = config.allowedCoaches || null;
        
        // 활성 코치만 필터링
        let activeCoaches = coaches.filter(c => c.active !== false);
        
        // 페이지별 허용된 코치만 필터링
        if (allowedCoaches && allowedCoaches.length > 0) {
            activeCoaches = activeCoaches.filter(c => {
                const coachName = c.name || '';
                return allowedCoaches.some(allowed => coachName.includes(allowed));
            });
            
            // 설정된 순서대로 정렬
            activeCoaches.sort((a, b) => {
                const aIndex = allowedCoaches.findIndex(name => (a.name || '').includes(name));
                const bIndex = allowedCoaches.findIndex(name => (b.name || '').includes(name));
                return aIndex - bIndex;
            });
        }
        
        select.innerHTML = '<option value="">코치 미지정</option>';
        activeCoaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            select.appendChild(option);
        });
        
        console.log(`코치 ${activeCoaches.length}명 로드됨:`, activeCoaches.map(c => c.name));
    } catch (error) {
        console.error('코치 목록 로드 실패:', error);
    }
}


// 회원의 상품/이용권 목록 로드
async function loadMemberProducts(memberId) {
    try {
        const memberProducts = await App.api.get(`/member-products?memberId=${memberId}`);
        const select = document.getElementById('booking-member-product');
        const productInfo = document.getElementById('product-info');
        const productInfoText = document.getElementById('product-info-text');
        
        if (!select) return [];
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || {};
        const facilityType = config.facilityType;
        
        // facilityType에 맞는 productCategory 매핑
        let productCategory = null;
        if (facilityType === 'BASEBALL') {
            productCategory = 'BASEBALL';
        } else if (facilityType === 'TRAINING_FITNESS') {
            productCategory = 'TRAINING_FITNESS';
        }
        
        // 활성 상태인 상품만 필터링
        let activeProducts = memberProducts.filter(mp => mp.status === 'ACTIVE');
        
        // 페이지별 허용된 코치 확인
        const allowedCoaches = config.allowedCoaches || null;
        let allowedCoachIds = null;
        
        // allowedCoaches가 설정되어 있으면 코치 ID 목록 가져오기
        if (allowedCoaches && allowedCoaches.length > 0) {
            try {
                const allCoaches = await App.api.get('/coaches');
                allowedCoachIds = allCoaches
                    .filter(c => {
                        const coachName = c.name || '';
                        return allowedCoaches.some(allowed => coachName.includes(allowed));
                    })
                    .map(c => c.id);
                console.log('[상품 필터링] 허용된 코치 ID 목록:', allowedCoachIds);
            } catch (error) {
                console.error('[상품 필터링] 코치 목록 로드 실패:', error);
            }
        }
        
        // 카테고리별 필터링 (해당 카테고리 또는 GENERAL 또는 null인 이용권만)
        if (productCategory) {
            activeProducts = activeProducts.filter(mp => {
                const category = mp.product?.category;
                // category가 null이거나 GENERAL이면 모든 곳에서 사용 가능
                if (!category || category === 'GENERAL') return true;
                
                // 정확히 일치하는 경우
                if (category === productCategory) return true;
                
                // TRAINING_FITNESS 요청 시: TRAINING_FITNESS, TRAINING, PILATES 모두 포함
                if (productCategory === 'TRAINING_FITNESS') {
                    return category === 'TRAINING_FITNESS' || 
                           category === 'TRAINING' || 
                           category === 'PILATES';
                }
                
                return false;
            });
        }
        
        // 코치 필터링: 해당 강사가 소속되지 않은 지점이면 이용권 제외
        if (allowedCoachIds && allowedCoachIds.length > 0) {
            activeProducts = activeProducts.filter(mp => {
                const product = mp.product;
                // 상품의 코치 ID 확인 (MemberProduct의 코치 우선, 없으면 상품의 코치)
                const coachId = (mp.coach && mp.coach.id) || (product.coach && product.coach.id);
                
                // 코치가 없는 상품은 표시 (코치 필터링 없음)
                if (!coachId) {
                    return true;
                }
                
                // 코치가 있으면 허용된 코치 목록에 포함되어 있는지 확인
                const isAllowed = allowedCoachIds.includes(coachId);
                if (!isAllowed) {
                    console.log(`[상품 필터링] 코치 ID ${coachId}가 허용 목록에 없어 상품 제외:`, product.name);
                }
                return isAllowed;
            });
        }
        
        select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
        
        if (activeProducts.length === 0) {
            if (productInfo) productInfo.style.display = 'none';
            return activeProducts; // 빈 배열 반환
        }
        
        activeProducts.forEach(mp => {
            const option = document.createElement('option');
            option.value = mp.id;
            const product = mp.product;
            // 상품 이름과 가격 표시
            let text = product.name || '상품';
            if (product.price) {
                text += ` - ${App.formatCurrency(product.price)}`;
            }
            
            // 잔여 횟수는 dataset에만 저장 (표시는 하지 않음)
            if (product.type === 'COUNT_PASS') {
                // 백엔드에서 계산된 remainingCount 사용 (실제 예약 데이터 기반)
                // remainingCount가 있으면 사용, 없으면 totalCount 사용, 그것도 없으면 product.usageCount 사용
                let remaining;
                if (mp.remainingCount !== null && mp.remainingCount !== undefined) {
                    remaining = mp.remainingCount;
                } else if (mp.totalCount !== null && mp.totalCount !== undefined) {
                    remaining = mp.totalCount;
                } else if (product.usageCount !== null && product.usageCount !== undefined) {
                    remaining = product.usageCount;
                } else {
                    // 모든 값이 없을 때만 기본값 10 사용
                    remaining = 10;
                }
                option.dataset.remainingCount = remaining;
            } else {
                option.dataset.remainingCount = 0;
            }
            
            option.textContent = text;
            option.dataset.productType = product.type;
            // 상품 카테고리 저장 (레슨 종목 자동 선택용)
            // product.category가 문자열이면 그대로 사용, 객체면 name 속성 사용
            let productCategory = null;
            if (product.category) {
                if (typeof product.category === 'string') {
                    productCategory = product.category;
                } else if (product.category.name) {
                    productCategory = product.category.name;
                } else {
                    productCategory = product.category;
                }
            }
            if (productCategory) {
                option.dataset.productCategory = productCategory;
                console.log(`[상품 로드] 상품 "${product.name}" 카테고리: ${productCategory}`);
            } else {
                console.warn(`[상품 로드] 상품 "${product.name}" 카테고리 없음`);
            }
            // MemberProduct의 코치 ID 저장 (담당 코치 자동 배정용)
            if (mp.coach && mp.coach.id) {
                option.dataset.coachId = mp.coach.id;
            } else if (product.coach && product.coach.id) {
                // MemberProduct에 코치가 없으면 상품의 코치 사용
                option.dataset.coachId = product.coach.id;
            }
            select.appendChild(option);
        });
        
        // 상품 선택 시 결제 방식 자동 설정 및 정보 표시, 레슨 종목 및 코치 자동 설정
        select.onchange = async function() {
            const selectedOption = this.options[this.selectedIndex];
            const paymentMethodSelect = document.getElementById('booking-payment-method');
            const lessonCategorySelect = document.getElementById('booking-lesson-category');
            const coachSelect = document.getElementById('booking-coach');
            
            if (selectedOption.value) {
                // 상품 선택 시 선결제로 자동 설정
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = 'PREPAID';
                }
                
                // 담당 코치 ID 먼저 가져오기 (레슨 종목 결정에 사용)
                const coachId = selectedOption.dataset.coachId;
                
                // 상품 카테고리에 따라 레슨 종목 자동 선택
                const productCategory = selectedOption.dataset.productCategory;
                console.log('[상품 선택] 상품 카테고리:', productCategory, '코치 ID:', coachId, '선택된 옵션:', selectedOption);
                
                let lessonCategory = null;
                let coachInfo = null;
                
                // 방법 1: 상품 카테고리로 레슨 종목 결정
                if (productCategory) {
                    // 카테고리 → 레슨 종목 매핑
                    if (productCategory === 'BASEBALL') {
                        lessonCategory = 'BASEBALL';
                    } else if (productCategory === 'TRAINING' || productCategory === 'TRAINING_FITNESS') {
                        lessonCategory = 'TRAINING';
                    } else if (productCategory === 'PILATES') {
                        lessonCategory = 'PILATES';
                    }
                    console.log('[상품 선택] 카테고리로 레슨 종목 결정:', lessonCategory);
                }
                
                // 방법 2: 상품 카테고리가 없으면 코치 정보로 레슨 종목 결정
                if (!lessonCategory && coachId) {
                    try {
                        // 코치 정보 가져오기
                        coachInfo = await App.api.get(`/coaches/${coachId}`);
                        if (coachInfo && coachInfo.specialties && coachInfo.specialties.length > 0) {
                            lessonCategory = App.LessonCategory.fromCoachSpecialties(coachInfo.specialties);
                            console.log('[상품 선택] 코치 정보로 레슨 종목 결정:', lessonCategory, '코치:', coachInfo.name);
                        }
                    } catch (error) {
                        console.error('[상품 선택] 코치 정보 로드 실패:', error);
                    }
                }
                
                // 레슨 종목 설정
                if (lessonCategory && lessonCategorySelect) {
                    // 목적이 레슨이 아니면 먼저 설정 (레슨 종목 필드가 표시되도록)
                    const purposeEl = document.getElementById('booking-purpose');
                    if (purposeEl && !purposeEl.value) {
                        purposeEl.value = 'LESSON';
                        toggleLessonCategory();
                        // 레슨 종목 필드가 표시될 때까지 대기
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                    // 원본 옵션 초기화 (필요시)
                    initializeOriginalLessonCategoryOptions();
                    
                    // 레슨 종목 필터링 먼저 실행 (옵션이 제대로 로드되도록)
                    filterLessonCategoryOptions();
                    
                    // 필터링 완료 대기 (옵션이 추가될 때까지 재시도)
                    let attempts = 0;
                    let optionExists = false;
                    while (attempts < 30) {
                        optionExists = Array.from(lessonCategorySelect.options).some(
                            opt => opt.value === lessonCategory
                        );
                        if (optionExists) {
                            break;
                        }
                        // 필터링 재실행 (옵션이 제대로 추가되지 않았을 수 있음)
                        if (attempts % 5 === 0) {
                            filterLessonCategoryOptions();
                        }
                        await new Promise(resolve => setTimeout(resolve, 50));
                        attempts++;
                    }
                    
                    if (optionExists) {
                        lessonCategorySelect.value = lessonCategory;
                        console.log(`[상품 선택] ✅ 레슨 종목 자동 선택: ${lessonCategory} (카테고리: ${productCategory || '없음'}, 코치: ${coachInfo?.name || coachId || '없음'})`);
                        
                        // change 이벤트 발생 (다른 로직이 반응하도록)
                        lessonCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        console.warn(`[상품 선택] ❌ 레슨 종목 옵션 없음: ${lessonCategory}`, {
                            availableOptions: Array.from(lessonCategorySelect.options).map(opt => ({ value: opt.value, text: opt.text })),
                            productCategory,
                            lessonCategory,
                            coachId,
                            facilityType: config.facilityType,
                            originalOptions: originalLessonCategoryOptions,
                            lessonCategorySelectHTML: lessonCategorySelect.innerHTML
                        });
                    }
                } else if (!lessonCategory) {
                    console.warn('[상품 선택] ⚠️ 레슨 종목을 결정할 수 없음:', {
                        productCategory,
                        coachId,
                        hasCoachSelect: !!coachSelect,
                        selectedOptionDataset: {
                            productCategory: selectedOption.dataset.productCategory,
                            coachId: selectedOption.dataset.coachId
                        },
                        product: selectedOption ? {
                            text: selectedOption.textContent,
                            value: selectedOption.value
                        } : null
                    });
                }
                
                // 담당 코치 자동 배정 (MemberProduct 또는 Product의 코치)
                if (coachSelect && coachId) {
                    // 코치 드롭다운이 로드되지 않았으면 먼저 로드
                    if (coachSelect.options.length <= 1) {
                        console.log(`[상품 선택] 코치 드롭다운 로드 중...`);
                        await loadCoachesForBooking();
                        // 코치 목록이 로드될 때까지 대기 (최대 1초)
                        let attempts = 0;
                        while (coachSelect.options.length <= 1 && attempts < 20) {
                            await new Promise(resolve => setTimeout(resolve, 50));
                            attempts++;
                        }
                    }
                    
                    // 코치 드롭다운에서 해당 코치 찾기
                    const coachOptionExists = Array.from(coachSelect.options).some(
                        opt => opt.value == coachId || opt.value === String(coachId)
                    );
                    if (coachOptionExists) {
                        coachSelect.value = coachId;
                        console.log(`[상품 선택] 담당 코치 자동 배정: 코치 ID ${coachId}`);
                        
                        // 코치 변경 이벤트 발생 (레슨 종목 자동 선택을 위해)
                        coachSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        console.warn(`[상품 선택] 코치 옵션 없음: 코치 ID ${coachId}`);
                    }
                }
                
                // 상품 정보 표시
                const productType = selectedOption.dataset.productType;
                const remainingCount = parseInt(selectedOption.dataset.remainingCount) || 0;
                
                if (productInfo && productInfoText) {
                    if (productType === 'COUNT_PASS') {
                        if (remainingCount > 0) {
                            productInfoText.textContent = `횟수권 사용: 잔여 ${remainingCount}회`;
                            productInfo.style.display = 'block';
                        } else {
                            productInfoText.textContent = `횟수권 사용: 잔여 횟수가 없습니다 (0회)`;
                            productInfo.style.display = 'block';
                            productInfo.style.background = 'var(--danger-light)';
                        }
                    } else {
                        productInfoText.textContent = '상품 사용 예정';
                        productInfo.style.display = 'block';
                    }
                }
            } else {
                // 상품 미선택 시 결제 방식 초기화 및 정보 숨김
                if (paymentMethodSelect) {
                    paymentMethodSelect.value = '';
                }
                if (productInfo) {
                    productInfo.style.display = 'none';
                }
            }
        };
        
        // 상품 목록 반환 (자동 선택을 위해)
        return activeProducts;
        
    } catch (error) {
        console.error('회원 상품 목록 로드 실패:', error);
        const select = document.getElementById('booking-member-product');
        if (select) {
            select.innerHTML = '<option value="">상품 미선택 (일반 예약)</option>';
        }
        return []; // 빈 배열 반환
    }
}

// 코치 범례 로드
async function loadCoachLegend() {
    try {
        // 모든 코치를 조회
        const coaches = await App.api.get('/coaches');
        const legendContainer = document.getElementById('coach-legend');
        if (!legendContainer) return;
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || {};
        const allowedCoaches = config.allowedCoaches || null;
        const facilityType = config.facilityType;
        
        // 활성 코치만 필터링
        let activeCoaches = coaches.filter(c => c.active !== false);
        
        // 야구 페이지에서는 박준현 트레이너 제외
        if (facilityType === 'BASEBALL') {
            activeCoaches = activeCoaches.filter(c => {
                const coachName = c.name || '';
                return !coachName.includes('박준현');
            });
        }
        
        // 페이지별 허용된 코치만 필터링
        if (allowedCoaches && allowedCoaches.length > 0) {
            activeCoaches = activeCoaches.filter(c => {
                const coachName = c.name || '';
                return allowedCoaches.some(allowed => coachName.includes(allowed));
            });
            
            // 설정된 순서대로 정렬
            activeCoaches.sort((a, b) => {
                const aIndex = allowedCoaches.findIndex(name => (a.name || '').includes(name));
                const bIndex = allowedCoaches.findIndex(name => (b.name || '').includes(name));
                return aIndex - bIndex;
            });
        }
        
        if (activeCoaches.length === 0) {
            legendContainer.innerHTML = '';
            return;
        }
        
        let legendHTML = '<div class="legend-title">범례:</div>';
        activeCoaches.forEach(coach => {
            const color = App.CoachColors.getColor(coach);
            legendHTML += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${color}"></span>
                    <span class="legend-name">${coach.name}</span>
                </div>
            `;
        });
        
        legendContainer.innerHTML = legendHTML;
        console.log(`범례 ${activeCoaches.length}명 표시됨:`, activeCoaches.map(c => c.name));
    } catch (error) {
        console.error('코치 범례 로드 실패:', error);
        // 범례 로드 실패해도 계속 진행
    }
}

function switchView(view) {
    currentView = view;
    
    // 모든 뷰 버튼의 active 클래스 제거
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 클릭된 버튼에 active 클래스 추가
    const clickedBtn = document.querySelector(`[data-view="${view}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }
    
    // 예약 등록 버튼의 active 클래스 제거
    const bookingBtn = document.getElementById('btn-booking-new');
    if (bookingBtn) {
        bookingBtn.classList.remove('active');
    }
    
    // 전체 확인 버튼 표시/숨김 (목록 뷰에서만 표시)
    const confirmAllBtn = document.getElementById('btn-confirm-all');
    if (confirmAllBtn) {
        confirmAllBtn.style.display = (view === 'list') ? 'inline-block' : 'none';
    }
    
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.toggle('active', container.id === `${view}-view`);
    });
    
    if (view === 'calendar') {
        renderCalendar();
    } else {
        loadBookingsList();
    }
}

async function renderCalendar() {
    // 캘린더 렌더링 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
    await reorderBookingIdsSilent();
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('calendar-month-year').textContent = 
        `${year}년 ${month + 1}월`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // 주의 첫날 (일요일)
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // 주의 마지막날 (토요일)
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // 요일 헤더
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    // 해당 월의 예약 데이터 로드
    // 캘린더에 표시되는 주 범위를 고려하여 앞뒤 일주일 추가
    
    // 조회 범위를 캘린더 표시 범위로 확장
    const queryStart = new Date(startDate);
    queryStart.setHours(0, 0, 0, 0);
    const queryEnd = new Date(endDate);
    queryEnd.setHours(23, 59, 59, 999);
    
    let bookings = [];
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
        
        // ISO 형식으로 변환 (UTC 시간대 포함)
        const startISO = queryStart.toISOString();
        const endISO = queryEnd.toISOString();
        console.log(`예약 데이터 요청: ${startISO} ~ ${endISO}`);
        console.log(`현재 월: ${year}년 ${month + 1}월`);
        console.log(`조회 범위: ${queryStart.toLocaleDateString()} ~ ${queryEnd.toLocaleDateString()}`);
        
        // branch와 facilityType 파라미터 추가
        const params = new URLSearchParams({
            start: startISO,
            end: endISO,
            branch: config.branch,
            facilityType: config.facilityType
        });
        
        const response = await App.api.get(`/bookings?${params.toString()}`);
        bookings = response || [];
        console.log(`캘린더 로드 (${config.branch} - ${config.facilityType}): ${bookings.length}개의 예약 발견`, bookings);
        
        // 예약이 없으면 전체 예약도 확인 (디버깅용)
        if (bookings.length === 0) {
            console.log('날짜 범위 내 예약 없음, 전체 예약 확인 중...');
            try {
                const allParams = new URLSearchParams({
                    branch: config.branch,
                    facilityType: config.facilityType
                });
                const allBookings = await App.api.get(`/bookings?${allParams.toString()}`);
                console.log(`전체 예약 (연산점): ${allBookings ? allBookings.length : 0}개`, allBookings);
                // 전체 예약 중 현재 월에 해당하는 예약 찾기
                if (allBookings && allBookings.length > 0) {
                    const monthBookings = allBookings.filter(b => {
                        if (!b || !b.startTime) return false;
                        try {
                            const bookingDate = new Date(b.startTime);
                            const bookingYear = bookingDate.getFullYear();
                            const bookingMonth = bookingDate.getMonth();
                            console.log(`예약 날짜 확인: ${bookingYear}-${bookingMonth + 1}-${bookingDate.getDate()}, 현재 월: ${year}-${month + 1}`);
                            return bookingYear === year && bookingMonth === month;
                        } catch (e) {
                            console.error('예약 날짜 파싱 오류:', b.startTime, e);
                            return false;
                        }
                    });
                    console.log(`현재 월에 해당하는 예약: ${monthBookings.length}개`, monthBookings);
                    // 현재 월 예약이 있으면 사용
                    if (monthBookings.length > 0) {
                        bookings = monthBookings;
                    } else if (allBookings && allBookings.length > 0) {
                        // 현재 월에 예약이 없고 다른 월에 예약이 있으면 안내
                        const otherMonthBookings = allBookings.filter(b => {
                            if (!b || !b.startTime) return false;
                            try {
                                const bookingDate = new Date(b.startTime);
                                return bookingDate.getFullYear() !== year || bookingDate.getMonth() !== month;
                            } catch (e) {
                                return false;
                            }
                        });
                        if (otherMonthBookings.length > 0) {
                            const earliestBooking = otherMonthBookings.sort((a, b) => 
                                new Date(a.startTime) - new Date(b.startTime)
                            )[0];
                            const earliestDate = new Date(earliestBooking.startTime);
                            console.log(`현재 월에 예약 없음. 가장 가까운 예약: ${earliestDate.getFullYear()}년 ${earliestDate.getMonth() + 1}월`);
                        }
                    }
                }
            } catch (e) {
                console.error('전체 예약 조회 실패:', e);
            }
        }
    } catch (error) {
        console.error('예약 데이터 로드 실패:', error);
    }
    
    // 날짜 셀
    const today = new Date();
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        if (current.getMonth() !== month) {
            dayCell.classList.add('other-month');
        }
        
        if (current.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }
        
        // 해당 날짜의 예약 표시 (날짜만 비교, 시간 무시) - 먼저 계산
        const dayBookings = bookings.filter(b => {
            if (!b || !b.startTime) return false;
            try {
                const bookingDate = new Date(b.startTime);
                // 날짜만 비교 (년, 월, 일) - 로컬 시간 기준
                const bookingYear = bookingDate.getFullYear();
                const bookingMonth = bookingDate.getMonth();
                const bookingDay = bookingDate.getDate();
                const currentYear = current.getFullYear();
                const currentMonth = current.getMonth();
                const currentDay = current.getDate();
                
                const matches = bookingYear === currentYear &&
                               bookingMonth === currentMonth &&
                               bookingDay === currentDay;
                
                if (matches) {
                    console.log(`예약 매칭: ${bookingYear}-${bookingMonth + 1}-${bookingDay} === ${currentYear}-${currentMonth + 1}-${currentDay}`);
                }
                
                return matches;
            } catch (e) {
                console.error('날짜 파싱 오류:', b, e);
                return false;
            }
        });
        
        // 디버깅: 예약이 있는 날짜 로그
        if (dayBookings.length > 0) {
            console.log(`날짜 ${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}에 ${dayBookings.length}개 예약 발견:`, dayBookings);
        }
        
        // 날짜 헤더 생성 (날짜 번호 + 스케줄 아이콘)
        const dayHeader = document.createElement('div');
        dayHeader.style.display = 'flex';
        dayHeader.style.justifyContent = 'space-between';
        dayHeader.style.alignItems = 'center';
        dayHeader.style.width = '100%';
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = current.getDate();
        dayHeader.appendChild(dayNumber);
        
        // 날짜별 스케줄 보기 아이콘 (예약이 있는 날짜에만 표시)
        if (dayBookings.length > 0) {
            const scheduleIcon = document.createElement('div');
            scheduleIcon.className = 'day-schedule-icon';
            scheduleIcon.innerHTML = '📋';
            scheduleIcon.style.cssText = 'cursor: pointer; font-size: 14px; padding: 2px 4px; opacity: 0.7; transition: opacity 0.2s;';
            scheduleIcon.title = '스케줄 보기';
            scheduleIcon.onmouseover = () => scheduleIcon.style.opacity = '1';
            scheduleIcon.onmouseout = () => scheduleIcon.style.opacity = '0.7';
            
            // 클로저 문제 해결: 날짜 값 고정
            const iconYear = current.getFullYear();
            const iconMonth = current.getMonth();
            const iconDay = current.getDate();
            const iconDateStr = `${iconYear}-${String(iconMonth + 1).padStart(2, '0')}-${String(iconDay).padStart(2, '0')}`;
            
            scheduleIcon.onclick = (e) => {
                e.stopPropagation(); // 날짜 클릭 이벤트 전파 방지
                openDayScheduleModal(iconDateStr);
            };
            
            dayHeader.appendChild(scheduleIcon);
        }
        
        dayCell.appendChild(dayHeader);
        
        // 예약이 있으면 배경 음영 적용
        if (dayBookings.length > 0) {
            // 코치별 색상 매핑
            const coachColors = getCoachColors(dayBookings);
            const backgroundColor = getDayBackgroundColor(coachColors);
            if (backgroundColor) {
                dayCell.style.backgroundColor = backgroundColor;
            } else {
                // 코치가 없어도 배경 음영 적용 (기본 색상)
                dayCell.style.backgroundColor = 'rgba(94, 106, 210, 0.1)';
            }
        }
        
        // 각 예약을 시간대별로 표시
        dayBookings.forEach(booking => {
            try {
                const event = document.createElement('div');
                event.className = 'calendar-event';
                
                // 시간 추출
                const startTime = new Date(booking.startTime);
                const endTime = new Date(booking.endTime);
                const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                
                // 이름 추출
                const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
                
                // 코치 정보 추출 (예약에 직접 할당된 코치 우선, 없으면 회원의 코치)
                const coach = booking.coach || (booking.member && booking.member.coach ? booking.member.coach : null);
                
                // 코치별 색상 적용 (코치가 없으면 기본 색상 사용)
                const coachColor = getCoachColor(coach) || '#5E6AD2';
                event.style.backgroundColor = coachColor;
                event.style.borderLeft = `3px solid ${coachColor}`;
                
                // 상태에 따라 아이콘 표시 추가
                const status = booking.status || 'PENDING';
                const now = new Date();
                const isEnded = endTime < now; // 종료 시간이 지났는지 확인
                
                let statusIcon = '';
                let statusIconStyle = '';
                if (status === 'COMPLETED' || isEnded) {
                    // 완료된 예약 또는 종료된 예약: 초록색 원형 배경에 흰색 원 표시
                    statusIcon = '';
                    statusIconStyle = 'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; min-width: 16px; min-height: 16px; background-color: #2ECC71; border-radius: 50%; margin-right: 5px; vertical-align: middle; flex-shrink: 0; position: relative;';
                } else if (status === 'CONFIRMED') {
                    // 확정된 예약: 파란색 원형 배경에 흰색 체크 표시
                    statusIcon = '✓';
                    statusIconStyle = 'display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background-color: #3498DB; border-radius: 50%; color: white; font-size: 11px; font-weight: 900; margin-right: 5px; vertical-align: middle; flex-shrink: 0;';
                }
                
                // 이벤트 내용 설정 (한 줄로 표시: 아이콘 + 시간 / 이름)
                if (statusIcon || statusIconStyle) {
                    if (status === 'COMPLETED' || isEnded) {
                        // 완료된 예약: CSS ::after로 흰색 원 추가
                        event.innerHTML = `<span style="${statusIconStyle}"></span>${timeStr} / ${memberName}`;
                    } else {
                        event.innerHTML = `<span style="${statusIconStyle}">${statusIcon}</span>${timeStr} / ${memberName}`;
                    }
                } else {
                    event.innerHTML = `${timeStr} / ${memberName}`;
                }
                
                // 드래그 앤 드롭 기능 추가
                event.draggable = true;
                event.setAttribute('data-booking-id', booking.id);
                
                // 드래그 시작
                event.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        bookingId: booking.id,
                        booking: booking
                    }));
                    event.style.opacity = '0.5';
                });
                
                // 드래그 종료
                event.addEventListener('dragend', (e) => {
                    event.style.opacity = '1';
                });
                
                // 클릭 시 예약 상세 보기 (드래그가 아닐 때만)
                let dragStartX = 0;
                let dragStartY = 0;
                let isDragging = false;
                
                event.addEventListener('mousedown', (e) => {
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    isDragging = false;
                });
                
                event.addEventListener('mousemove', (e) => {
                    if (dragStartX !== 0 || dragStartY !== 0) {
                        const deltaX = Math.abs(e.clientX - dragStartX);
                        const deltaY = Math.abs(e.clientY - dragStartY);
                        if (deltaX > 5 || deltaY > 5) {
                            isDragging = true;
                        }
                    }
                });
                
                event.addEventListener('click', (e) => {
                    // 드래그가 아닐 때만 처리
                    if (!isDragging) {
                        e.stopPropagation();
                        
                        // Shift 또는 Ctrl 키를 누른 상태면 선택만 (모달 열지 않음)
                        if (e.shiftKey || e.ctrlKey) {
                            selectBooking(booking, event);
                        } else {
                            // 일반 클릭은 모달 열기
                            editBooking(booking.id);
                        }
                    }
                    // 리셋
                    dragStartX = 0;
                    dragStartY = 0;
                    isDragging = false;
                });
                
                dayCell.appendChild(event);
            } catch (error) {
                console.error('예약 표시 오류:', booking, error);
            }
        });
        
        // 클로저 문제 해결: 각 셀에 대해 날짜 값을 고정
        const cellYear = current.getFullYear();
        const cellMonth = current.getMonth();
        const cellDay = current.getDate();
        const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
        
        // 드래그 앤 드롭 이벤트 추가
        dayCell.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dayCell.style.backgroundColor = 'rgba(94, 106, 210, 0.2)';
        });
        
        dayCell.addEventListener('dragleave', (e) => {
            // 다른 셀로 이동한 경우에만 배경색 복원
            if (!dayCell.contains(e.relatedTarget)) {
                dayCell.style.backgroundColor = '';
            }
        });
        
        dayCell.addEventListener('drop', async (e) => {
            e.preventDefault();
            dayCell.style.backgroundColor = '';
            
            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const sourceBookingId = data.bookingId;
                const sourceBooking = data.booking;
                
                // 드롭된 날짜로 예약 복사
                await copyBookingToDate(sourceBookingId, sourceBooking, cellDateStr);
            } catch (error) {
                console.error('예약 복사 실패:', error);
                App.showNotification('예약 복사에 실패했습니다.', 'danger');
            }
        });
        
        dayCell.onclick = (e) => {
            // 아이콘 클릭이 아닐 때만 회원 선택 모달 열기
            if (!e.target.classList.contains('day-schedule-icon') && 
                !e.target.closest('.day-schedule-icon') &&
                !e.target.classList.contains('calendar-event')) {
                // 고정된 날짜 값 사용 (클로저 문제 해결)
                console.log('캘린더 날짜 클릭:', cellDateStr, '년:', cellYear, '월:', cellMonth + 1, '일:', cellDay);
                openMemberSelectModal(cellDateStr);
            }
        };
        
        grid.appendChild(dayCell);
        current.setDate(current.getDate() + 1);
    }
}

// 날짜별 스케줄 모달 열기
async function openDayScheduleModal(dateStr) {
    try {
        // 날짜 포맷팅
        const date = new Date(dateStr + 'T00:00:00');
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const formattedDate = `${year}년 ${month}월 ${day}일`;
        
        document.getElementById('day-schedule-modal-title').textContent = `${formattedDate} 스케줄`;
        
        // 해당 날짜의 예약 로드
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
        const branch = config.branch || 'YEONSAN';
        const facilityType = config.facilityType;
        
        // API 파라미터 구성
        const params = new URLSearchParams();
        params.append('start', startISO);
        params.append('end', endISO);
        params.append('branch', branch);
        if (facilityType) {
            params.append('facilityType', facilityType);
        }
        
        const bookings = await App.api.get(`/bookings?${params.toString()}`);
        console.log(`날짜별 스케줄 로드 (${branch}, ${facilityType || '전체'}):`, bookings?.length || 0, '건');
        
        // 코치 목록 로드 (필터용)
        const coaches = await App.api.get('/coaches');
        const coachSelect = document.getElementById('schedule-filter-coach');
        coachSelect.innerHTML = '<option value="">전체 코치</option>';
        coaches.forEach(coach => {
            const option = document.createElement('option');
            option.value = coach.id;
            option.textContent = coach.name;
            coachSelect.appendChild(option);
        });
        
        // 전체 예약 저장 (필터링용)
        window.dayScheduleBookings = bookings;
        
        // 초기 렌더링
        renderDaySchedule(bookings);
        
        App.Modal.open('day-schedule-modal');
    } catch (error) {
        console.error('스케줄 로드 실패:', error);
        App.showNotification('스케줄을 불러오는데 실패했습니다.', 'danger');
    }
}

// 날짜별 스케줄 필터링
function filterDaySchedule() {
    if (!window.dayScheduleBookings) return;
    
    const coachId = document.getElementById('schedule-filter-coach').value;
    const status = document.getElementById('schedule-filter-status').value;
    
    let filtered = [...window.dayScheduleBookings];
    
    if (coachId) {
        filtered = filtered.filter(booking => {
            const bookingCoachId = booking.coach ? booking.coach.id : 
                                  (booking.member && booking.member.coach ? booking.member.coach.id : null);
            return bookingCoachId && bookingCoachId.toString() === coachId;
        });
    }
    
    if (status) {
        filtered = filtered.filter(booking => booking.status === status);
    }
    
    renderDaySchedule(filtered);
}

// 날짜별 스케줄 렌더링
function renderDaySchedule(bookings) {
    const tbody = document.getElementById('day-schedule-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    // 시간순으로 정렬
    bookings.sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
    });
    
    tbody.innerHTML = bookings.map(booking => {
        // 시간 포맷팅
        let timeStr = '-';
        if (booking.startTime && booking.endTime) {
            const start = new Date(booking.startTime);
            const end = new Date(booking.endTime);
            const startTime = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            const endTime = end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            timeStr = `${startTime} - ${endTime}`;
        }
        
        // 회원/이름
        const memberName = booking.member ? booking.member.name : 
                          (booking.nonMemberName || '비회원');
        
        // 코치 이름
        const coachName = booking.coach ? booking.coach.name : 
                         (booking.member && booking.member.coach ? booking.member.coach.name : '-');
        
        // 레슨 종목
        const lessonCategory = booking.lessonCategory ? App.LessonCategory.getText(booking.lessonCategory) : '-';
        
        // 상태
        const statusBadge = App.Status.booking.getBadge(booking.status);
        const statusText = App.Status.booking.getText(booking.status);
        
        return `
            <tr>
                <td>${timeStr}</td>
                <td>${booking.facility ? booking.facility.name : '-'}</td>
                <td>${memberName}</td>
                <td>${coachName}</td>
                <td>${lessonCategory}</td>
                <td><span class="badge badge-${statusBadge}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editBookingFromSchedule(${booking.id})">수정</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 스케줄 모달에서 예약 수정
function editBookingFromSchedule(bookingId) {
    App.Modal.close('day-schedule-modal');
    openBookingModal(bookingId);
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

async function loadBookingsList() {
    try {
        // 예약 목록 로드 전에 자동으로 날짜/시간 기준으로 예약 번호 재정렬
        await reorderBookingIdsSilent();
        
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
        const branch = config.branch || 'YEONSAN';
        const facilityType = config.facilityType;
        
        // API 파라미터 구성
        const params = new URLSearchParams();
        params.append('branch', branch);
        if (facilityType) {
            params.append('facilityType', facilityType);
        }
        
        const bookings = await App.api.get(`/bookings?${params.toString()}`);
        console.log(`예약 목록 조회 결과 (${branch}, ${facilityType || '전체'}):`, bookings?.length || 0, '건');
        renderBookingsTable(bookings);
    } catch (error) {
        console.error('예약 목록 로드 실패:', error);
    }
}

function renderBookingsTable(bookings) {
    const tbody = document.getElementById('bookings-table-body');
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">예약이 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => {
        const facilityName = booking.facility ? booking.facility.name : '-';
        const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
        const startTime = booking.startTime ? new Date(booking.startTime).toLocaleString('ko-KR') : '-';
        const status = booking.status || 'PENDING';
        const purpose = getPurposeText(booking.purpose);
        const lessonCategory = booking.lessonCategory ? getLessonCategoryText(booking.lessonCategory) : '-';
        
        return `
        <tr>
            <td>${booking.id}</td>
            <td>${facilityName}</td>
            <td>${startTime}</td>
            <td>${memberName}</td>
            <td>${purpose}</td>
            <td>${booking.purpose === 'LESSON' && booking.lessonCategory ? `<span class="badge badge-${getLessonCategoryBadge(booking.lessonCategory)}">${lessonCategory}</span>` : '-'}</td>
            <td>${booking.participants || 1}</td>
            <td>
                <span class="badge badge-${getStatusBadge(status)}">${getStatusText(status)}</span>
                ${status === 'PENDING' ? `<button class="btn btn-xs btn-success ml-2" onclick="approveBooking(${booking.id})" title="승인">✓</button>` : ''}
            </td>
            <td>${getBookingPaymentMethodText(booking.paymentMethod)}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editBooking(${booking.id})">수정</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBooking(${booking.id})">삭제</button>
            </td>
        </tr>
        `;
    }).join('');
}

function getPurposeText(purpose) {
    const map = {
        'LESSON': '레슨',
        'RENTAL': '대관',
        'PERSONAL_TRAINING': '개인훈련'
    };
    return map[purpose] || purpose || '-';
}

// 레슨 카테고리 관련 함수는 common.js의 App.LessonCategory 사용
function getLessonCategoryText(category) {
    return App.LessonCategory.getText(category);
}

function getLessonCategoryBadge(category) {
    return App.LessonCategory.getBadge(category);
}

// 상태 관련 함수는 common.js의 App.Status.booking 사용
function getStatusBadge(status) {
    return App.Status.booking.getBadge(status);
}

function getStatusText(status) {
    return App.Status.booking.getText(status);
}

// 결제 방법 텍스트는 common.js의 App.PaymentMethod 사용
function getBookingPaymentMethodText(method) {
    return App.PaymentMethod.getText(method);
}

let selectedBookingDate = null;

// 회원 선택 모달 열기
async function openMemberSelectModal(date = null) {
    selectedBookingDate = date || new Date().toISOString().split('T')[0];
    console.log('회원 선택 모달 열기 - selectedBookingDate 설정:', selectedBookingDate, '입력된 date:', date);
    
    // 회원 목록 로드
    await loadMembersForSelect();
    
    // 검색 기능
    const searchInput = document.getElementById('member-search-input');
    searchInput.value = '';
    searchInput.oninput = function() {
        filterMembers(this.value);
    };
    
    App.Modal.open('member-select-modal');
}

// 회원 목록 로드
// 예약용 회원 목록 로드 (전체 회원)
async function loadMembersForSelect() {
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || {};
        const facilityType = config.facilityType;
        const branch = config.branch;
        
        // facilityType에 맞는 productCategory 매핑
        let productCategory = null;
        if (facilityType === 'BASEBALL') {
            productCategory = 'BASEBALL';
        } else if (facilityType === 'TRAINING_FITNESS') {
            productCategory = 'TRAINING_FITNESS';
        }
        
        // API 파라미터 구성
        // 야구는 모든 지점에서 가능하므로 branch 파라미터 전달 안 함
        // 트레이닝+필라테스만 지점별 필터링
        const params = new URLSearchParams();
        if (productCategory) {
            params.append('productCategory', productCategory);
        }
        // 트레이닝+필라테스만 지점 필터링 적용
        if (branch && productCategory === 'TRAINING_FITNESS') {
            params.append('branch', branch);
        }
        
        const url = params.toString() ? `/members?${params.toString()}` : '/members';
        const members = await App.api.get(url);
        renderMemberSelectTable(members);
        console.log(`회원 ${members.length}명 로드됨 (카테고리: ${productCategory || '전체'}, 지점: ${productCategory === 'TRAINING_FITNESS' ? (branch || '전체') : '모든 지점'})`);
    } catch (error) {
        console.error('회원 목록 로드 실패:', error);
        App.showNotification('회원 목록을 불러오는데 실패했습니다.', 'danger');
    }
}

// 회원 선택 테이블 렌더링
function renderMemberSelectTable(members, filterText = '') {
    const tbody = document.getElementById('member-select-table-body');
    
    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">회원이 없습니다.</td></tr>';
        return;
    }
    
    // 필터링 (이름, 회원번호, 전화번호로 검색)
    let filteredMembers = members;
    if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filteredMembers = members.filter(m => 
            m.name.toLowerCase().includes(lowerFilter) || 
            (m.memberNumber && m.memberNumber.toLowerCase().includes(lowerFilter)) ||
            (m.phoneNumber && m.phoneNumber.includes(filterText))
        );
    }
    
    if (filteredMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">검색 결과가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredMembers.map(member => {
        const gradeText = getGradeText(member.grade);
        const memberNumber = member.memberNumber || '-';
        return `
            <tr style="cursor: pointer;" onclick="selectMemberForBooking('${memberNumber}', '${member.name}', '${member.phoneNumber || ''}')">
                <td>${member.name}</td>
                <td>${memberNumber}</td>
                <td>${member.phoneNumber || '-'}</td>
                <td><span class="badge badge-info">${gradeText}</span></td>
                <td>${member.school || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectMemberForBooking('${memberNumber}', '${member.name}', '${member.phoneNumber || ''}')">선택</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 회원 필터링
function filterMembers(filterText) {
    // 이미 로드된 회원 목록을 필터링
    const tbody = document.getElementById('member-select-table-body');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const lowerFilter = filterText.toLowerCase();
        row.style.display = text.includes(lowerFilter) ? '' : 'none';
    });
}

// 등급 텍스트 변환
// 회원 등급 텍스트는 common.js의 App.MemberGrade 사용
function getGradeText(grade) {
    return App.MemberGrade.getText(grade);
}

// 회원 선택 시 예약 모달 열기 (memberNumber로 회원 찾기)
async function selectMemberForBooking(memberNumber, memberName, memberPhone) {
    App.Modal.close('member-select-modal');
    
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    console.log('회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 회원번호로 회원 상세 정보 로드
    try {
        // 회원번호로 회원 찾기
        const members = await App.api.get('/members/search?memberNumber=' + encodeURIComponent(memberNumber));
        if (!members || members.length === 0) {
            App.showNotification('회원을 찾을 수 없습니다.', 'danger');
            return;
        }
        
        const member = members[0]; // 첫 번째 결과 사용
        
        // 예약 모달 열기
        document.getElementById('booking-modal-title').textContent = '예약 등록';
        document.getElementById('selected-member-number').value = memberNumber; // memberNumber 저장
        
        // 회원 정보 표시
        document.getElementById('member-info-name').textContent = member.name || '-';
        document.getElementById('member-info-phone').textContent = member.phoneNumber || '-';
        document.getElementById('member-info-grade').textContent = getGradeText(member.grade) || '-';
        document.getElementById('member-info-school').textContent = member.school || '-';
        
        // selected-member-id도 설정 (하위 호환성)
        document.getElementById('selected-member-id').value = member.id || '';
        document.getElementById('selected-member-number').value = member.memberNumber || '';
        
        // 회원 정보 섹션 표시, 비회원 섹션 및 선택 섹션 숨기기
        document.getElementById('member-info-section').style.display = 'block';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'none';
        
        // 코치 목록 로드 (먼저 로드 완료 대기)
        const coachSelect = document.getElementById('booking-coach');
        if (coachSelect) {
            // 코치 목록이 없으면 먼저 로드
            if (coachSelect.options.length <= 1) {
                await loadCoachesForBooking();
            }
            
            // 코치 목록이 로드될 때까지 대기 (최대 1초)
            let attempts = 0;
            while (coachSelect.options.length <= 1 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
        }
        
        // 필요한 필드만 개별적으로 초기화 (폼 리셋 대신)
        // 날짜는 나중에 설정하므로 여기서는 초기화하지 않음
        const setFieldValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) {
                field.value = value;
            }
        };
        
        const setFieldStyle = (id, property, value) => {
            const field = document.getElementById(id);
            if (field) {
                field.style[property] = value;
            }
        };
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
        setFieldValue('booking-id', '');
        console.log('회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
        
        setFieldValue('booking-facility', '');
        setFieldValue('booking-start-time', '');
        setFieldValue('booking-end-time', '');
        setFieldValue('booking-participants', '1');
        setFieldValue('booking-purpose', '');
        setFieldValue('booking-lesson-category', '');
        setFieldValue('booking-status', 'PENDING');
        setFieldValue('booking-payment-method', '');
        setFieldValue('booking-notes', ''); // 메모 필드 ID는 booking-notes
        setFieldValue('booking-non-member-name', '');
        setFieldValue('booking-phone', '');
        setFieldValue('booking-member-product', '');
        setFieldStyle('product-info', 'display', 'none');
        
        // 코치는 나중에 설정하므로 여기서는 초기화하지 않음
        // 날짜 필드에 선택한 날짜 설정
        const dateField = document.getElementById('booking-date');
        if (dateField) {
            dateField.value = dateToSet;
            console.log('예약 날짜 설정 완료:', dateToSet);
        }
        
        // 시설 로드 및 자동 선택 (모달이 열린 후)
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            // 시설이 선택되지 않았거나 옵션이 없으면 로드
            if (!facilitySelect.value || facilitySelect.options.length <= 1) {
                console.log('[회원 선택] 시설 로드 시작');
                await loadFacilities();
                console.log('[회원 선택] 시설 로드 완료');
            }
        }
        
        // 회원의 상품/이용권 목록 로드
        const memberProducts = await loadMemberProducts(member.id);
        
        // 해당 페이지에 맞는 첫 번째 상품 자동 선택
        if (memberProducts && memberProducts.length > 0) {
            const productSelect = document.getElementById('booking-member-product');
            if (productSelect && productSelect.options.length > 1) {
                // 첫 번째 상품 선택 (상품 미선택 옵션 제외)
                const firstProductOption = productSelect.options[1]; // 인덱스 0은 "상품 미선택"
                if (firstProductOption && firstProductOption.value) {
                    productSelect.value = firstProductOption.value;
                    // 상품 선택 이벤트 발생 (코치, 레슨 종목 자동 설정을 위해)
                    productSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('[회원 선택] 첫 번째 상품 자동 선택:', firstProductOption.textContent);
                    
                    // 상품 선택 이벤트 처리 대기 (비동기 처리)
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }
        
        // 회원의 등급에 따라 기본값 설정
        // 유소년 회원은 기본적으로 레슨으로 설정
        if (member.grade === 'YOUTH' && !document.getElementById('booking-purpose').value) {
            document.getElementById('booking-purpose').value = 'LESSON';
            toggleLessonCategory();
        }
        
        // 회원 예약은 상태를 기본값 PENDING으로 설정
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING';
        }
        
        // 결제 방식 초기화
        const paymentMethodSelect = document.getElementById('booking-payment-method');
        if (paymentMethodSelect) {
            paymentMethodSelect.value = '';
        }
        
        // 상품이 자동 선택되었으면 상품의 코치를 사용, 없으면 회원의 기본 코치 사용
        let coachIdToSet = null;
        let coachInfo = null;
        
        // 상품이 선택되었는지 확인
        const productSelect = document.getElementById('booking-member-product');
        if (productSelect && productSelect.value) {
            const selectedOption = productSelect.options[productSelect.selectedIndex];
            const productCoachId = selectedOption.dataset.coachId;
            if (productCoachId) {
                coachIdToSet = productCoachId;
                console.log('[회원 선택] 상품의 코치 사용:', coachIdToSet);
            }
        }
        
        // 상품에 코치가 없으면 회원의 기본 코치 사용
        if (!coachIdToSet && member.coach) {
            coachIdToSet = member.coach.id || member.coach;
            coachInfo = member.coach;
            console.log('[회원 선택] 회원의 기본 코치 사용:', coachIdToSet);
        }
        
        // 코치 상세 정보 미리 가져오기 (필요한 경우)
        if (coachIdToSet && (!coachInfo || !coachInfo.name || !coachInfo.specialties)) {
            try {
                coachInfo = await App.api.get(`/coaches/${coachIdToSet}`);
            } catch (error) {
                console.error('코치 정보 로드 실패:', error);
            }
        }
        
        // 코치 설정 함수 (모달 열기 전에 준비)
        const setCoachAndLessonCategory = async () => {
            if (!coachIdToSet) return;
            
            // 메인 폼의 코치 필드 찾기 (coach-group 내부)
            const coachGroup = document.getElementById('coach-group');
            if (!coachGroup) {
                console.error('❌ coach-group을 찾을 수 없습니다.');
                return;
            }
            
            const coachSelectEl = coachGroup.querySelector('#booking-coach');
            if (!coachSelectEl) {
                console.error('❌ 코치 선택 필드를 찾을 수 없습니다.');
                return;
            }
            
            // 코치 목록이 로드되었는지 확인
            if (coachSelectEl.options.length <= 1) {
                await loadCoachesForBooking();
                let attempts = 0;
                while (coachSelectEl.options.length <= 1 && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }
            }
            
            // 코치 ID가 옵션에 있는지 확인
            const coachOption = Array.from(coachSelectEl.options).find(opt => {
                const optValue = opt.value;
                return optValue == coachIdToSet || optValue === String(coachIdToSet);
            });
            
            if (!coachOption) {
                console.error('❌ 코치 옵션을 찾을 수 없습니다. 코치 ID:', coachIdToSet);
                return;
            }
            
            // 코치 설정
            const optionIndex = Array.from(coachSelectEl.options).indexOf(coachOption);
            coachSelectEl.selectedIndex = optionIndex;
            coachSelectEl.value = coachOption.value;
            
            // 이벤트 발생
            coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 설정 확인
            await new Promise(resolve => setTimeout(resolve, 100));
            const finalValue = coachSelectEl.value;
            if (finalValue == coachIdToSet || finalValue === String(coachIdToSet)) {
                console.log('✅ 코치 설정 완료:', coachOption.textContent);
                
                // 레슨 종목 설정
                if (coachInfo && coachInfo.specialties && coachInfo.specialties.length > 0) {
                    const lessonCategory = App.LessonCategory.fromCoachSpecialties(coachInfo.specialties);
                    if (lessonCategory) {
                        const lessonCategoryEl = document.getElementById('booking-lesson-category');
                        const purposeEl = document.getElementById('booking-purpose');
                        
                        if (lessonCategoryEl) {
                            // 해당 레슨 종목 옵션이 있는지 확인
                            const optionExists = Array.from(lessonCategoryEl.options).some(
                                opt => opt.value === lessonCategory
                            );
                            if (optionExists) {
                                lessonCategoryEl.value = lessonCategory;
                                console.log(`[코치 선택] 레슨 종목 자동 선택: ${lessonCategory}`);
                            } else {
                                console.warn(`[코치 선택] 레슨 종목 옵션 없음: ${lessonCategory}`);
                            }
                        }
                        
                        if (purposeEl && !purposeEl.value) {
                            purposeEl.value = 'LESSON';
                            toggleLessonCategory();
                        }
                    }
                }
            } else {
                console.warn('⚠️ 코치 설정 확인 실패, 재시도...');
                // 재시도
                coachSelectEl.selectedIndex = optionIndex;
                coachSelectEl.value = coachOption.value;
                coachSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        
        // 모달을 먼저 열기
        App.Modal.open('booking-modal');
        
        // 모달이 열린 후 레슨 종목 필터링 적용
        setTimeout(() => filterLessonCategoryOptions(), 100);
        
        // 모달이 완전히 열린 후 코치 설정
        if (coachIdToSet) {
            // 여러 방법으로 시도
            requestAnimationFrame(() => {
                requestAnimationFrame(async () => {
                    await setCoachAndLessonCategory();
                });
            });
            
            setTimeout(async () => {
                const coachGroup = document.getElementById('coach-group');
                if (coachGroup) {
                    const coachSelectEl = coachGroup.querySelector('#booking-coach');
                    if (coachSelectEl && (!coachSelectEl.value || coachSelectEl.value === '')) {
                        await setCoachAndLessonCategory();
                    }
                }
            }, 300);
        }
    } catch (error) {
        console.error('회원 정보 로드 실패:', error);
        App.showNotification('회원 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

// 비회원 예약 모달 열기
function openNonMemberBookingModal() {
    App.Modal.close('member-select-modal');
    selectNonMember();
}

// 비회원 선택
async function selectNonMember() {
    // 날짜 저장 (reset 전에 저장)
    const dateToSet = selectedBookingDate || new Date().toISOString().split('T')[0];
    console.log('비회원 선택 - 설정할 날짜:', dateToSet, 'selectedBookingDate:', selectedBookingDate);
    
    // 예약 모달 열기
    document.getElementById('booking-modal-title').textContent = '예약 등록 (비회원)';
    document.getElementById('selected-member-id').value = '';
    document.getElementById('selected-member-number').value = '';
    
    // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지)
    document.getElementById('booking-id').value = '';
    console.log('비회원 선택 - booking-id 초기화 완료 (새로운 예약 등록)');
    
    // 폼 리셋 (날짜 필드는 제외)
    const bookingForm = document.getElementById('booking-form');
    bookingForm.reset();
    
    // reset 후 날짜 필드에 선택한 날짜 설정 (약간의 지연을 두어 확실히 설정)
    setTimeout(() => {
        document.getElementById('booking-date').value = dateToSet;
        console.log('예약 날짜 설정 완료 (비회원):', dateToSet);
    }, 10);
    
    // 비회원 섹션 표시, 회원 정보 섹션 및 선택 섹션 숨기기
    document.getElementById('non-member-section').style.display = 'block';
    document.getElementById('member-info-section').style.display = 'none';
    document.getElementById('member-select-section').style.display = 'none';
    
    // 비회원 예약은 항상 'PENDING' 상태로 고정 (승인 필요)
    const statusSelect = document.getElementById('booking-status');
    if (statusSelect) {
        statusSelect.value = 'PENDING';
        statusSelect.disabled = true; // 비회원은 상태 변경 불가
    }
    
    // 비회원 예약 모달에서도 시설 즉시 로드 및 선택
    const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
    const facilitySelect = document.getElementById('booking-facility');
    
    if (facilitySelect) {
        try {
            const params = new URLSearchParams();
            params.append('branch', config.branch?.toUpperCase());
            // facilityType 파라미터 제거 - 모든 타입의 시설 표시
            const facilities = await App.api.get(`/facilities?${params.toString()}`);
            
            const expectedBranch = config.branch?.toUpperCase();
            const filteredFacilities = facilities.filter(f => {
                return f.branch?.toUpperCase() === expectedBranch;
            });
            
            if (filteredFacilities.length > 0) {
                facilitySelect.innerHTML = '<option value="">시설 선택...</option>';
                filteredFacilities.forEach(facility => {
                    const option = document.createElement('option');
                    option.value = facility.id.toString();
                    option.textContent = facility.name;
                    // 시설의 지점 정보를 data 속성에 저장
                    if (facility.branch) {
                        option.dataset.branch = facility.branch;
                    }
                    facilitySelect.appendChild(option);
                });
                
                // 첫 번째 시설 즉시 선택 및 고정
                const firstFacility = filteredFacilities[0];
                facilitySelect.value = firstFacility.id.toString();
                facilitySelect.disabled = true;
                facilitySelect.classList.add('facility-fixed');
                // 오버레이에 선택된 시설명 표시
                const displayDiv = document.getElementById('facility-selected-display');
                const nameSpan = document.getElementById('facility-selected-name');
                if (displayDiv && nameSpan) {
                    nameSpan.textContent = firstFacility.name;
                    displayDiv.style.display = 'flex';
                }
                // 시설의 지점 정보로 booking-branch 업데이트
                const branchInput = document.getElementById('booking-branch');
                if (branchInput && firstFacility.branch) {
                    branchInput.value = firstFacility.branch.toUpperCase();
                    console.log(`[비회원 예약] 지점 업데이트: ${firstFacility.branch.toUpperCase()}`);
                }
                console.log(`[시설 로드] 비회원 예약 - 즉시 선택 및 고정: ${firstFacility.name} (지점: ${firstFacility.branch})`);
            } else {
                console.error(`[비회원 예약] ${config.branch} 지점에 해당하는 시설이 없습니다!`);
            }
        } catch (error) {
            console.error('[시설 로드] 시설 로드 실패:', error);
        }
    }
    
    App.Modal.open('booking-modal');
    // 모달이 열린 후 레슨 종목 필터링 적용
    setTimeout(() => filterLessonCategoryOptions(), 100);
}

// 회원 변경
function changeMember() {
    // 회원 선택 모달 열기
    openMemberSelectModal(selectedBookingDate || document.getElementById('booking-date').value);
}

async function openBookingModal(id = null) {
    const modal = document.getElementById('booking-modal');
    const title = document.getElementById('booking-modal-title');
    const deleteBtn = document.getElementById('booking-delete-btn');
    const form = document.getElementById('booking-form');
    
    // 오버레이 초기화
    const displayDiv = document.getElementById('facility-selected-display');
    if (displayDiv) {
        displayDiv.style.display = 'none';
    }
    
    if (id) {
        // 예약 수정 모달
        title.textContent = '예약 수정';
        
        // 삭제 버튼 표시
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
            deleteBtn.setAttribute('data-booking-id', id);
        }
        
        // 예약 등록 버튼 active 제거 (수정 모달이므로)
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.remove('active');
        }
        
        // 현재 뷰 버튼 유지
        // 목적 필드 활성화 (수정 시에도 선택 가능하도록)
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.disabled = false;
            purposeSelect.style.display = 'block';
        }
        
        // 지점 필드 설정 (페이지별로 고정, hidden input)
        const branchInput = document.getElementById('booking-branch');
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN' };
            branchInput.value = config.branch;
        }
        
        loadBookingData(id);
    } else {
        // 예약 등록 모달
        title.textContent = '예약 등록';
        
        // 삭제 버튼 숨김
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
            deleteBtn.removeAttribute('data-booking-id');
        }
        
        // 예약 등록 버튼에 active 클래스 추가
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.add('active');
        }
        
        // 다른 뷰 버튼들의 active 클래스 제거
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 지점 필드 설정 (페이지별로 고정, hidden input) - reset 전에 설정
        const branchInput = document.getElementById('booking-branch');
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN' };
            branchInput.value = config.branch;
        }
        
        // 중요: booking-id를 빈 값으로 초기화 (기존 예약 수정 방지) - reset 전에
        const bookingIdElement = document.getElementById('booking-id');
        if (bookingIdElement) {
            bookingIdElement.value = '';
        }
        
        // 상태 필드를 먼저 PENDING으로 초기화 (reset 전에)
        const statusSelect = document.getElementById('booking-status');
        if (statusSelect) {
            statusSelect.value = 'PENDING';
            console.log('[예약 모달] reset 전 상태 필드 PENDING으로 설정');
        }
        
        form.reset();
        
        // reset 후 필수 값들 다시 설정
        if (bookingIdElement) {
            bookingIdElement.value = '';
        }
        document.getElementById('selected-member-id').value = '';
        document.getElementById('selected-member-number').value = '';
        document.getElementById('booking-date').value = selectedBookingDate || new Date().toISOString().split('T')[0];
        
        // 지점 필드 다시 설정 (reset 후)
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN' };
            branchInput.value = config.branch;
        }
        
        console.log('[예약 모달] 예약 등록 모달 - booking-id 초기화 완료');
        
        // 목적 필드 활성화
        const purposeSelect = document.getElementById('booking-purpose');
        if (purposeSelect) {
            purposeSelect.disabled = false;
            purposeSelect.style.display = 'block';
        }
        
        // 레슨 카테고리 필드 초기화
        toggleLessonCategory();
        
        // 모든 섹션 초기화
        document.getElementById('member-info-section').style.display = 'none';
        document.getElementById('non-member-section').style.display = 'none';
        document.getElementById('member-select-section').style.display = 'block';
        
        // 상태 필드 활성화 및 PENDING으로 명시적 설정 (reset 후 다시 설정)
        if (statusSelect) {
            statusSelect.disabled = false;
            statusSelect.value = 'PENDING'; // 새 예약은 항상 PENDING으로 시작
            console.log('[예약 모달] reset 후 상태 필드 PENDING으로 재설정, 현재 값:', statusSelect.value);
            
            // 추가 확인: 만약 여전히 다른 값이면 강제로 PENDING 설정
            if (statusSelect.value !== 'PENDING') {
                console.warn('[예약 모달] 상태 필드가 PENDING이 아님, 강제로 PENDING 설정');
                statusSelect.value = 'PENDING';
            }
        }
        
        // form.reset() 후 시설 다시 로드 및 선택 (reset이 시설 드롭다운을 초기화하므로)
        // booking-id가 빈 값이므로 loadFacilities()가 자동으로 첫 번째 시설을 선택함
        await loadFacilities();
        
        // 추가 확인: 시설이 확실히 선택되었는지 확인하고 강제 선택
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            if (!facilitySelect.value || facilitySelect.options.length <= 1) {
                console.warn('[시설 로드] 시설이 선택되지 않음, 재시도...');
                await loadFacilities();
            }
            
            // 강제로 첫 번째 시설 선택 및 고정 (옵션이 있으면)
            if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                const firstFacilityOption = facilitySelect.options[1]; // 첫 번째는 "시설 선택..."
                if (firstFacilityOption && firstFacilityOption.value) {
                    facilitySelect.value = firstFacilityOption.value;
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        nameSpan.textContent = firstFacilityOption.textContent;
                        displayDiv.style.display = 'flex';
                    }
                    console.log(`[시설 로드] 강제 선택 및 고정: ${firstFacilityOption.textContent} (값: ${firstFacilityOption.value})`);
                }
            }
        }
    }
    
    // 수정 모드일 때도 시설 로드
    if (id) {
        await loadFacilities();
    }
    
    App.Modal.open('booking-modal');
    
    // 모달이 열린 직후 시설이 선택되어 있는지 여러 번 확인하고, 없으면 강제 선택
    if (!id) {
        // 즉시 확인 및 강제 선택 및 고정
        setTimeout(() => {
            const facilitySelect = document.getElementById('booking-facility');
            if (facilitySelect) {
                if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                    // 첫 번째 시설 강제 선택 및 고정
                    const firstOption = facilitySelect.options[1]; // 첫 번째는 "시설 선택..."
                    if (firstOption && firstOption.value) {
                        facilitySelect.value = firstOption.value;
                        facilitySelect.disabled = true;
                        facilitySelect.classList.add('facility-fixed');
                        // 오버레이에 선택된 시설명 표시
                        const displayDiv = document.getElementById('facility-selected-display');
                        const nameSpan = document.getElementById('facility-selected-name');
                        if (displayDiv && nameSpan) {
                            nameSpan.textContent = firstOption.textContent;
                            displayDiv.style.display = 'flex';
                        }
                        console.log(`[시설 로드] 모달 열린 후 즉시 강제 선택 및 고정: ${firstOption.textContent}`);
                    }
                } else if (!facilitySelect.value && facilitySelect.options.length <= 1) {
                    console.log('[시설 로드] 모달 열린 후 즉시 확인 - 시설 재로드 필요');
                    loadFacilities();
                } else if (facilitySelect.value && !facilitySelect.disabled) {
                    // 시설이 선택되어 있지만 활성화되어 있으면 고정
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent;
                        nameSpan.textContent = selectedText || '';
                        displayDiv.style.display = 'flex';
                    }
                    console.log(`[시설 로드] 모달 열린 후 즉시 확인 - 시설 고정: ${facilitySelect.options[facilitySelect.selectedIndex]?.textContent}`);
                }
            }
        }, 50);
        
        // 추가 확인 및 강제 선택 및 고정 (150ms 후)
        setTimeout(() => {
            const facilitySelect = document.getElementById('booking-facility');
            if (facilitySelect) {
                if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                    const firstOption = facilitySelect.options[1];
                    if (firstOption && firstOption.value) {
                        facilitySelect.value = firstOption.value;
                        facilitySelect.disabled = true;
                        facilitySelect.classList.add('facility-fixed');
                        // 오버레이에 선택된 시설명 표시
                        const displayDiv = document.getElementById('facility-selected-display');
                        const nameSpan = document.getElementById('facility-selected-name');
                        if (displayDiv && nameSpan) {
                            nameSpan.textContent = firstOption.textContent;
                            displayDiv.style.display = 'flex';
                        }
                        console.log(`[시설 로드] 모달 열린 후 추가 강제 선택 및 고정: ${firstOption.textContent}`);
                    }
                } else if (!facilitySelect.value && facilitySelect.options.length <= 1) {
                    console.log('[시설 로드] 모달 열린 후 추가 확인 - 시설 재로드 필요');
                    loadFacilities();
                } else if (facilitySelect.value && !facilitySelect.disabled) {
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent;
                        nameSpan.textContent = selectedText || '';
                        displayDiv.style.display = 'flex';
                    }
                }
            }
        }, 150);
        
        // 최종 확인 및 강제 선택 및 고정 (300ms 후)
        setTimeout(() => {
            const facilitySelect = document.getElementById('booking-facility');
            if (facilitySelect) {
                if (facilitySelect.options.length > 1 && !facilitySelect.value) {
                    const firstOption = facilitySelect.options[1];
                    if (firstOption && firstOption.value) {
                        facilitySelect.value = firstOption.value;
                        facilitySelect.disabled = true;
                        facilitySelect.classList.add('facility-fixed');
                        // 오버레이에 선택된 시설명 표시
                        const displayDiv = document.getElementById('facility-selected-display');
                        const nameSpan = document.getElementById('facility-selected-name');
                        if (displayDiv && nameSpan) {
                            nameSpan.textContent = firstOption.textContent;
                            displayDiv.style.display = 'flex';
                        }
                        console.log(`[시설 로드] 모달 열린 후 최종 강제 선택 및 고정: ${firstOption.textContent}`);
                    }
                } else if (!facilitySelect.value && facilitySelect.options.length <= 1) {
                    console.log('[시설 로드] 모달 열린 후 최종 확인 - 시설 재로드 필요');
                    loadFacilities();
                } else if (facilitySelect.value && !facilitySelect.disabled) {
                    facilitySelect.disabled = true;
                    facilitySelect.classList.add('facility-fixed');
                    // 오버레이에 선택된 시설명 표시
                    const displayDiv = document.getElementById('facility-selected-display');
                    const nameSpan = document.getElementById('facility-selected-name');
                    if (displayDiv && nameSpan) {
                        const selectedText = facilitySelect.options[facilitySelect.selectedIndex]?.textContent;
                        nameSpan.textContent = selectedText || '';
                        displayDiv.style.display = 'flex';
                    }
                    console.log(`[시설 로드] ✅ 최종 확인 완료 - 시설 고정: ${facilitySelect.options[facilitySelect.selectedIndex]?.textContent}`);
                }
            }
        }, 300);
    }
    
    // 모달이 열린 후 레슨 종목 필터링 적용
    setTimeout(() => filterLessonCategoryOptions(), 200);
    
    // 모달 닫기 이벤트 리스너 추가
    setupBookingModalCloseHandler();
}

// 예약 모달 닫기 핸들러 설정
function setupBookingModalCloseHandler() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;
    
    const closeHandler = () => {
        const bookingBtn = document.getElementById('btn-booking-new');
        if (bookingBtn) {
            bookingBtn.classList.remove('active');
        }
        
        // 현재 뷰에 맞는 버튼에 active 클래스 추가
        if (currentView === 'calendar') {
            document.getElementById('btn-calendar')?.classList.add('active');
        } else if (currentView === 'list') {
            document.getElementById('btn-list')?.classList.add('active');
        }
    };
    
    // MutationObserver로 모달의 active 클래스 제거 감지
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!modal.classList.contains('active')) {
                    closeHandler();
                }
            }
        });
    });
    
    observer.observe(modal, {
        attributes: true,
        attributeFilter: ['class']
    });
}

async function loadBookingData(id) {
    try {
        // 시설 목록 다시 로드 (각 지점에 맞게 필터링)
        await loadFacilities();
        
        const booking = await App.api.get(`/bookings/${id}`);
        // 폼에 데이터 채우기
        document.getElementById('booking-id').value = booking.id;
        const facilitySelect = document.getElementById('booking-facility');
        if (facilitySelect) {
            facilitySelect.value = booking.facility?.id || '';
            // 시설 필드가 비활성화되어 있으면 다시 활성화 (수정 모드이므로)
            if (facilitySelect.disabled) {
                facilitySelect.disabled = false;
                facilitySelect.classList.remove('facility-fixed');
                // 오버레이 숨기기
                const displayDiv = document.getElementById('facility-selected-display');
                if (displayDiv) {
                    displayDiv.style.display = 'none';
                }
            }
        }
        document.getElementById('selected-member-id').value = booking.member?.id || '';
        document.getElementById('selected-member-number').value = booking.member?.memberNumber || '';
        
        if (booking.member) {
            // 회원 정보 표시
            document.getElementById('member-info-name').textContent = booking.member.name || '-';
            document.getElementById('member-info-phone').textContent = booking.member.phoneNumber || '-';
            document.getElementById('member-info-grade').textContent = getGradeText(booking.member.grade) || '-';
            document.getElementById('member-info-school').textContent = booking.member.school || '-';
            
            document.getElementById('member-info-section').style.display = 'block';
            document.getElementById('non-member-section').style.display = 'none';
            document.getElementById('member-select-section').style.display = 'none';
            
            // 회원의 상품 목록 로드
            loadMemberProducts(booking.member.id);
            
            // 코치 목록 로드
            if (document.getElementById('booking-coach') && document.getElementById('booking-coach').options.length <= 1) {
                await loadCoachesForBooking();
            }
            
            // 코치 선택 설정
            const coachSelect = document.getElementById('booking-coach');
            if (coachSelect && booking.coach && booking.coach.id) {
                coachSelect.value = booking.coach.id;
            }
        } else {
            // 비회원 정보 표시
            document.getElementById('booking-non-member-name').value = booking.nonMemberName || '';
            document.getElementById('booking-phone').value = booking.nonMemberPhone || '';
            
            document.getElementById('member-info-section').style.display = 'none';
            document.getElementById('non-member-section').style.display = 'block';
            document.getElementById('member-select-section').style.display = 'none';
        }
        
        const startDate = new Date(booking.startTime);
        document.getElementById('booking-date').value = startDate.toISOString().split('T')[0];
        document.getElementById('booking-start-time').value = startDate.toTimeString().slice(0, 5);
        
        const endDate = new Date(booking.endTime);
        document.getElementById('booking-end-time').value = endDate.toTimeString().slice(0, 5);
        
        document.getElementById('booking-participants').value = booking.participants || 1;
        document.getElementById('booking-purpose').value = booking.purpose || 'RENTAL';
        
        // 지점 필드 설정 (페이지별로 고정, hidden input)
        const branchInput = document.getElementById('booking-branch');
        if (branchInput) {
            const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN' };
            branchInput.value = config.branch;
        }
        
        // 목적 변경 시 레슨 카테고리 필드 표시/숨김 처리
        toggleLessonCategory();
        // 레슨 카테고리 설정
        const lessonCategoryEl = document.getElementById('booking-lesson-category');
        if (lessonCategoryEl) {
            // 야구 예약 페이지에서는 항상 야구로 고정
            const config = window.BOOKING_PAGE_CONFIG || {};
            if (config.facilityType === 'BASEBALL') {
                lessonCategoryEl.value = 'BASEBALL';
                lessonCategoryEl.disabled = true;
                lessonCategoryEl.style.backgroundColor = 'var(--bg-secondary)';
                lessonCategoryEl.style.color = 'var(--text-muted)';
            } else if (booking.lessonCategory) {
                lessonCategoryEl.value = booking.lessonCategory;
            }
        }
        document.getElementById('booking-status').value = booking.status || 'PENDING';
        document.getElementById('booking-payment-method').value = booking.paymentMethod || '';
        document.getElementById('booking-notes').value = booking.memo || '';
        
        // MemberProduct 정보 설정 (있는 경우)
        if (booking.memberProduct && booking.memberProduct.id && booking.member) {
            // 회원의 상품 목록이 로드된 후에 설정
            setTimeout(async () => {
                const memberProducts = await App.api.get(`/member-products?memberId=${booking.member.id}`);
                const select = document.getElementById('booking-member-product');
                if (select && memberProducts) {
                    const memberProduct = memberProducts.find(mp => mp.id === booking.memberProduct.id);
                    if (memberProduct) {
                        select.value = memberProduct.id;
                        // 상품 정보 표시
                        const productInfo = document.getElementById('product-info');
                        const productInfoText = document.getElementById('product-info-text');
                        if (productInfo && productInfoText && memberProduct.product) {
                            if (memberProduct.product.type === 'COUNT_PASS') {
                                const remaining = memberProduct.remainingCount || 0;
                                productInfoText.textContent = `횟수권 사용: 잔여 ${remaining}회`;
                                productInfo.style.display = 'block';
                            } else {
                                productInfoText.textContent = '상품 사용 예정';
                                productInfo.style.display = 'block';
                            }
                        }
                    }
                }
            }, 500);
        }
        
        // 코치 선택 필드 설정 (비회원 예약 시에도 사용)
        if (document.getElementById('booking-coach')) {
            document.getElementById('booking-coach').value = booking.coach?.id || '';
        }
    } catch (error) {
        App.showNotification('예약 정보를 불러오는데 실패했습니다.', 'danger');
    }
}

function editBooking(id) {
    openBookingModal(id);
}

async function saveBooking() {
    const date = document.getElementById('booking-date').value;
    const startTime = document.getElementById('booking-start-time').value;
    const endTime = document.getElementById('booking-end-time').value;
    
    // 날짜 검증
    if (!date || date.trim() === '') {
        console.warn('[saveBooking] 날짜가 없음');
        App.showNotification('날짜를 선택해주세요.', 'danger');
        return;
    }
    
    // 시작 시간 검증
    if (!startTime || startTime.trim() === '') {
        console.warn('[saveBooking] 시작 시간이 없음');
        App.showNotification('시작 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 종료 시간 검증
    if (!endTime || endTime.trim() === '') {
        console.warn('[saveBooking] 종료 시간이 없음');
        App.showNotification('종료 시간을 입력해주세요.', 'danger');
        return;
    }
    
    // 시작 시간과 종료 시간 비교
    if (startTime && endTime && startTime >= endTime) {
        App.showNotification('종료 시간은 시작 시간보다 늦어야 합니다.', 'danger');
        return;
    }
    const facilityId = document.getElementById('booking-facility').value;
    const memberNumber = document.getElementById('selected-member-number').value; // MEMBER_NUMBER 사용
    const memberId = document.getElementById('selected-member-id').value; // 하위 호환성
    const nonMemberName = document.getElementById('booking-non-member-name').value;
    const nonMemberPhone = document.getElementById('booking-phone').value;
    const coachIdElement = document.getElementById('booking-coach');
    const coachId = coachIdElement ? coachIdElement.value : '';
    const participants = document.getElementById('booking-participants').value;
    const purpose = document.getElementById('booking-purpose').value;
    const lessonCategoryElement = document.getElementById('booking-lesson-category');
    const lessonCategory = lessonCategoryElement ? lessonCategoryElement.value : null;
    const paymentMethod = document.getElementById('booking-payment-method').value;
    const memo = document.getElementById('booking-notes').value;
    const memberProductId = document.getElementById('booking-member-product')?.value || null;
    
    // 필수 필드 검증
    if (!date || !startTime || !endTime || !facilityId) {
        App.showNotification('필수 항목(날짜, 시간, 시설)을 모두 입력해주세요.', 'danger');
        return;
    }
    
    if (!purpose) {
        App.showNotification('목적을 선택해주세요.', 'danger');
        return;
    }
    
    // 레슨인 경우 레슨 카테고리 필수
    if (purpose === 'LESSON') {
        const lessonCategory = document.getElementById('booking-lesson-category')?.value;
        if (!lessonCategory) {
            App.showNotification('레슨인 경우 레슨 종목을 선택해주세요.', 'danger');
            return;
        }
    }
    
    // 회원/비회원 검증
    if (!memberNumber && !memberId && (!nonMemberName || !nonMemberPhone)) {
        App.showNotification('회원을 선택하거나 비회원 정보를 입력해주세요.', 'danger');
        return;
    }
    
    // 비회원인 경우 이름과 전화번호 필수
    if ((!memberNumber && !memberId) && (!nonMemberName || !nonMemberPhone)) {
        App.showNotification('비회원인 경우 이름과 연락처를 모두 입력해주세요.', 'danger');
        return;
    }
    
    // 상품 선택 시 횟수권 잔여 횟수 확인
    if (memberProductId) {
        const productSelect = document.getElementById('booking-member-product');
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        const productType = selectedOption.dataset.productType;
        const remainingCount = parseInt(selectedOption.dataset.remainingCount) || 0;
        
        if (productType === 'COUNT_PASS' && remainingCount <= 0) {
            App.showNotification('선택한 횟수권의 잔여 횟수가 없습니다.', 'danger');
            return;
        }
    }
    
    // 날짜와 시간 결합 (ISO 8601 형식)
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;
    
    // 디버깅: 시간 값 확인
    console.log('예약 시간 확인:', {
        date: date,
        startTime: startTime,
        endTime: endTime,
        startDateTime: startDateTime,
        endDateTime: endDateTime
    });
    
    // 회원 예약은 항상 PENDING 상태로 시작 (확인 후 CONFIRMED로 변경)
    const statusSelect = document.getElementById('booking-status');
    const bookingIdElement = document.getElementById('booking-id');
    const bookingId = bookingIdElement ? bookingIdElement.value.trim() : '';
    
    // 새 예약인지 확인 (bookingId가 없거나 빈 문자열이면 새 예약)
    const isNewBooking = !bookingId || bookingId === '';
    
    let bookingStatus = 'PENDING';
    
    // 수정 모드인 경우에만 기존 상태 유지, 새 예약은 항상 PENDING
    if (!isNewBooking && statusSelect && statusSelect.value) {
        // 수정 모드: 기존 상태 유지
        bookingStatus = statusSelect.value;
        console.log('[예약 저장] 수정 모드 - 상태 유지:', bookingStatus);
    } else {
        // 새 예약: 항상 PENDING으로 설정
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        console.log('[예약 저장] 새 예약 - 상태 PENDING으로 설정');
    }
    
    // 시설 선택 시 시설의 지점 정보를 우선적으로 사용
    const facilitySelect = document.getElementById('booking-facility');
    let branchValue = document.getElementById('booking-branch')?.value || (window.BOOKING_PAGE_CONFIG || {}).branch || 'YEONSAN';
    
    // 시설이 선택되어 있으면 시설의 지점 정보를 사용
    if (facilitySelect && facilitySelect.value) {
        const selectedOption = facilitySelect.options[facilitySelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.branch) {
            branchValue = selectedOption.dataset.branch.toUpperCase();
            console.log(`[예약 저장] 시설의 지점 정보 사용: ${branchValue}`);
            // booking-branch도 업데이트
            const branchInput = document.getElementById('booking-branch');
            if (branchInput) {
                branchInput.value = branchValue;
            }
        }
    }
    
    // 최종 상태 확인 및 강제 설정 (새 예약인 경우)
    if (isNewBooking) {
        bookingStatus = 'PENDING';
        if (statusSelect) {
            statusSelect.value = 'PENDING';
        }
        console.log('[예약 저장] 최종 확인 - 새 예약이므로 PENDING으로 강제 설정');
    }
    
    console.log('[예약 저장] 최종 상태:', {
        bookingId: bookingId,
        isNewBooking: isNewBooking,
        bookingStatus: bookingStatus,
        statusSelectValue: statusSelect ? statusSelect.value : 'N/A'
    });
    
    const data = {
        facility: { id: parseInt(facilityId) },
        memberNumber: memberNumber || null, // MEMBER_NUMBER 사용
        member: memberId ? { id: parseInt(memberId) } : null, // 하위 호환성
        nonMemberName: (memberNumber || memberId) ? null : (nonMemberName || null),
        nonMemberPhone: (memberNumber || memberId) ? null : (nonMemberPhone || null),
        coach: coachId ? { id: parseInt(coachId) } : null,
        memberProductId: memberProductId ? parseInt(memberProductId) : null, // 상품/이용권 ID
        startTime: startDateTime,
        endTime: endDateTime,
        participants: parseInt(participants) || 1,
        purpose: purpose,
        lessonCategory: (purpose === 'LESSON' && lessonCategory) ? lessonCategory : null,
        status: bookingStatus, // 새 예약은 항상 PENDING
        branch: branchValue, // 시설의 지점 정보 우선 사용
        // paymentMethod 값 변환 (프론트엔드 -> 백엔드 enum 형식)
        paymentMethod: paymentMethod ? (paymentMethod === 'ONSITE' ? 'ON_SITE' : (paymentMethod === 'DEFERRED' ? 'POSTPAID' : paymentMethod)) : null,
        memo: memo || null
    };
    
    console.log('예약 저장 데이터:', JSON.stringify(data, null, 2));
    
    try {
        const id = document.getElementById('booking-id').value;
        let savedBooking;
        if (id) {
            savedBooking = await App.api.put(`/bookings/${id}`, data);
            App.showNotification('예약이 수정되었습니다.', 'success');
        } else {
            savedBooking = await App.api.post('/bookings', data);
            console.log('예약 저장 성공:', savedBooking);
            
            // 반복 예약 처리
            const repeatEnabled = document.getElementById('booking-repeat-enabled').checked;
            if (repeatEnabled) {
                const repeatType = document.getElementById('booking-repeat-type').value;
                const repeatCount = parseInt(document.getElementById('booking-repeat-count').value) || 1;
                
                await createRepeatBookings(data, repeatType, repeatCount);
                App.showNotification(`예약이 등록되었습니다 (반복 ${repeatCount}회 포함).`, 'success');
            } else {
                App.showNotification('예약이 등록되었습니다.', 'success');
            }
        }
        
        App.Modal.close('booking-modal');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            // 캘린더 뷰인 경우 예약 날짜로 이동 후 새로고침
            if (savedBooking && savedBooking.startTime) {
                try {
                    const bookingDate = new Date(savedBooking.startTime);
                    const bookingYear = bookingDate.getFullYear();
                    const bookingMonth = bookingDate.getMonth();
                    
                    // 예약이 있는 월로 캘린더 이동
                    if (currentDate.getFullYear() !== bookingYear || currentDate.getMonth() !== bookingMonth) {
                        currentDate = new Date(bookingYear, bookingMonth, 1);
                        console.log(`예약 날짜로 캘린더 이동: ${bookingYear}년 ${bookingMonth + 1}월`);
                    }
                } catch (e) {
                    console.error('예약 날짜 파싱 오류:', savedBooking.startTime, e);
                }
            }
            console.log('캘린더 새로고침 시작...');
            await renderCalendar();
        }
    } catch (error) {
        console.error('예약 저장 실패:', error);
        App.showNotification('저장에 실패했습니다. 필수 정보를 확인해주세요.', 'danger');
    }
}

// 반복 예약 생성
async function createRepeatBookings(baseData, repeatType, repeatCount) {
    const baseDate = new Date(baseData.startTime);
    const startTime = baseData.startTime.split('T')[1];
    const endTime = baseData.endTime.split('T')[1];
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 1; i < repeatCount; i++) {
        const newDate = new Date(baseDate);
        
        // 반복 주기에 따라 날짜 계산
        switch (repeatType) {
            case 'DAILY':
                newDate.setDate(newDate.getDate() + i);
                break;
            case 'WEEKLY':
                newDate.setDate(newDate.getDate() + (i * 7));
                break;
            case 'MONTHLY':
                newDate.setMonth(newDate.getMonth() + i);
                break;
        }
        
        const dateStr = newDate.toISOString().split('T')[0];
        const repeatData = {
            ...baseData,
            startTime: `${dateStr}T${startTime}`,
            endTime: `${dateStr}T${endTime}`
        };
        
        try {
            await App.api.post('/bookings', repeatData);
            successCount++;
        } catch (error) {
            console.error(`반복 예약 생성 실패 (${i}회차):`, error);
            failCount++;
        }
    }
    
    console.log(`반복 예약 생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

// 예약 승인 (빠른 승인)
async function approveBooking(id) {
    if (!confirm('이 예약을 승인하시겠습니까?')) {
        return;
    }
    
    try {
        // 먼저 예약 정보를 가져온 후 status만 변경
        const booking = await App.api.get(`/bookings/${id}`);
        
        // 상태만 업데이트 (기존 데이터 유지)
        const updateData = {
            ...booking,
            status: 'CONFIRMED'
        };
        
        // 객체 참조 제거 (순환 참조 방지)
        if (updateData.facility) {
            updateData.facility = { id: updateData.facility.id };
        }
        if (updateData.member) {
            updateData.member = updateData.member.id ? { id: updateData.member.id } : null;
        }
        if (updateData.coach) {
            updateData.coach = updateData.coach.id ? { id: updateData.coach.id } : null;
        }
        // 컬렉션 필드 제거
        delete updateData.payments;
        delete updateData.attendances;
        
        await App.api.put(`/bookings/${id}`, updateData);
        App.showNotification('예약이 승인되었습니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        console.error('예약 승인 실패:', error);
        App.showNotification('승인에 실패했습니다.', 'danger');
    }
}

// 전체 대기 예약 확인 (한 번에 처리)
async function confirmAllPendingBookings() {
    if (!confirm('현재 필터 조건에 맞는 모든 대기 예약을 확정하시겠습니까?')) {
        return;
    }
    
    try {
        // 페이지별 설정 읽기
        const config = window.BOOKING_PAGE_CONFIG || { branch: 'YEONSAN', facilityType: 'BASEBALL' };
        const branch = config.branch || 'YEONSAN';
        const facilityType = config.facilityType;
        
        // 필터 조건 가져오기
        const filterFacility = document.getElementById('filter-facility')?.value || '';
        const filterStatus = document.getElementById('filter-status')?.value || '';
        const filterDateStart = document.getElementById('filter-date-start')?.value || '';
        const filterDateEnd = document.getElementById('filter-date-end')?.value || '';
        
        // API 파라미터 구성
        const params = new URLSearchParams();
        params.append('branch', branch);
        if (facilityType) {
            params.append('facilityType', facilityType);
        }
        
        // 예약 목록 가져오기
        let bookings = await App.api.get(`/bookings?${params.toString()}`);
        
        // 필터 적용
        if (filterFacility) {
            bookings = bookings.filter(b => b.facility && b.facility.id.toString() === filterFacility);
        }
        if (filterDateStart) {
            const startDate = new Date(filterDateStart);
            bookings = bookings.filter(b => {
                const bookingDate = new Date(b.startTime);
                return bookingDate >= startDate;
            });
        }
        if (filterDateEnd) {
            const endDate = new Date(filterDateEnd);
            endDate.setHours(23, 59, 59, 999);
            bookings = bookings.filter(b => {
                const bookingDate = new Date(b.startTime);
                return bookingDate <= endDate;
            });
        }
        
        // PENDING 상태인 예약만 필터링
        const pendingBookings = bookings.filter(b => b.status === 'PENDING');
        
        if (pendingBookings.length === 0) {
            App.showNotification('확정할 대기 예약이 없습니다.', 'info');
            return;
        }
        
        // 확인 메시지
        if (!confirm(`총 ${pendingBookings.length}개의 대기 예약을 확정하시겠습니까?`)) {
            return;
        }
        
        // 모든 대기 예약을 확정으로 변경
        let successCount = 0;
        let failCount = 0;
        
        for (const booking of pendingBookings) {
            try {
                // 예약 정보 가져오기
                const fullBooking = await App.api.get(`/bookings/${booking.id}`);
                
                // 상태만 업데이트 (기존 데이터 유지)
                const updateData = {
                    ...fullBooking,
                    status: 'CONFIRMED'
                };
                
                // 객체 참조 제거 (순환 참조 방지)
                if (updateData.facility) {
                    updateData.facility = { id: updateData.facility.id };
                }
                if (updateData.member) {
                    updateData.member = updateData.member.id ? { id: updateData.member.id } : null;
                }
                if (updateData.coach) {
                    updateData.coach = updateData.coach.id ? { id: updateData.coach.id } : null;
                }
                // 컬렉션 필드 제거
                delete updateData.payments;
                delete updateData.attendances;
                
                await App.api.put(`/bookings/${booking.id}`, updateData);
                successCount++;
            } catch (error) {
                console.error(`예약 ${booking.id} 승인 실패:`, error);
                failCount++;
            }
        }
        
        // 결과 알림
        if (failCount === 0) {
            App.showNotification(`모든 예약(${successCount}개)이 확정되었습니다.`, 'success');
        } else {
            App.showNotification(`${successCount}개 확정 완료, ${failCount}개 실패`, 'warning');
        }
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        console.error('전체 확인 실패:', error);
        App.showNotification('전체 확인 처리에 실패했습니다.', 'danger');
    }
}

// 예약 모달에서 삭제
async function deleteBookingFromModal() {
    const deleteBtn = document.getElementById('booking-delete-btn');
    const bookingId = deleteBtn.getAttribute('data-booking-id');
    if (!bookingId) {
        App.showNotification('삭제할 예약을 찾을 수 없습니다.', 'danger');
        return;
    }
    
    if (confirm('정말 이 예약을 삭제하시겠습니까?')) {
        await deleteBooking(parseInt(bookingId));
        // 삭제 후 모달 닫기
        App.Modal.close('booking-modal');
    }
}

async function deleteBooking(id) {
    try {
        await App.api.delete(`/bookings/${id}`);
        App.showNotification('예약이 삭제되었습니다.', 'success');
        
        // 캘린더 뷰인 경우 캘린더 새로고침, 리스트 뷰인 경우 리스트 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        console.error('예약 삭제 실패:', error);
        App.showNotification('삭제에 실패했습니다.', 'danger');
    }
}

// 예약을 다른 날짜로 복사
async function copyBookingToDate(sourceBookingId, sourceBooking, targetDateStr) {
    try {
        // 원본 예약 데이터 로드
        const booking = await App.api.get(`/bookings/${sourceBookingId}`);
        
        // 새 날짜로 시간 계산
        const targetDate = new Date(targetDateStr + 'T00:00:00');
        const originalStartTime = new Date(booking.startTime);
        const originalEndTime = new Date(booking.endTime);
        
        // 시간 부분 유지
        const hours = originalStartTime.getHours();
        const minutes = originalStartTime.getMinutes();
        const duration = originalEndTime.getTime() - originalStartTime.getTime();
        
        // 새 날짜에 시간 적용
        const newStartTime = new Date(targetDate);
        newStartTime.setHours(hours, minutes, 0, 0);
        const newEndTime = new Date(newStartTime.getTime() + duration);
        
        // LocalDateTime 형식으로 변환 (YYYY-MM-DDTHH:mm:ss)
        const formatLocalDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            const second = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        };
        
        // 새 예약 데이터 생성
        const newBooking = {
            facility: booking.facility ? { id: booking.facility.id } : null,
            memberNumber: booking.memberNumber || null, // MEMBER_NUMBER 사용
            member: booking.member ? { id: booking.member.id } : null, // 하위 호환성
            nonMemberName: booking.nonMemberName || null,
            nonMemberPhone: booking.nonMemberPhone || null,
            coach: booking.coach ? { id: booking.coach.id } : null,
            memberProductId: booking.memberProductId || null, // 상품/이용권 ID
            startTime: formatLocalDateTime(newStartTime),
            endTime: formatLocalDateTime(newEndTime),
            participants: booking.participants || 1,
            purpose: booking.purpose,
            lessonCategory: booking.lessonCategory || null,
            branch: (window.BOOKING_PAGE_CONFIG || {}).branch || 'YEONSAN', // 페이지별 지점 코드
            status: 'PENDING', // 복사된 예약은 대기 상태로
            paymentMethod: booking.paymentMethod || null,
            memo: booking.memo ? `[복사] ${booking.memo}` : '[복사]'
        };
        
        // 디버깅: 전송할 데이터 확인
        console.log('예약 복사 데이터:', JSON.stringify(newBooking, null, 2));
        console.log('원본 예약 데이터:', JSON.stringify(booking, null, 2));
        
        // 새 예약 생성
        const saved = await App.api.post('/bookings', newBooking);
        App.showNotification('예약이 복사되었습니다.', 'success');
        
        // 캘린더 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        console.error('예약 복사 실패:', error);
        App.showNotification('예약 복사에 실패했습니다.', 'danger');
    }
}

// 예약 번호를 날짜/시간 기준으로 재할당 (조용히, 알림 없이)
async function reorderBookingIdsSilent() {
    try {
        await App.api.post('/bookings/reorder');
        // 알림 없이 조용히 재정렬
    } catch (error) {
        console.error('예약 번호 재할당 실패:', error);
        // 조용히 실패 (사용자에게 알림하지 않음)
    }
}

// 예약 번호를 날짜/시간 기준으로 재할당 (수동 호출용, 현재는 사용하지 않음)
async function reorderBookingIds() {
    if (!confirm('예약 번호를 날짜/시간 순서대로 재할당하시겠습니까?\n\n주의: 이 작업은 모든 예약의 번호를 변경합니다.')) {
        return;
    }
    
    try {
        const response = await App.api.post('/bookings/reorder');
        App.showNotification('예약 번호가 날짜/시간 순서대로 재할당되었습니다.', 'success');
        
        // 뷰에 따라 새로고침
        if (currentView === 'list') {
            loadBookingsList();
        } else {
            await renderCalendar();
        }
    } catch (error) {
        console.error('예약 번호 재할당 실패:', error);
        App.showNotification('예약 번호 재할당에 실패했습니다.', 'danger');
    }
}

function applyFilters() {
    // 필터 적용 로직
    if (currentView === 'list') {
        loadBookingsList();
    } else {
        renderCalendar();
    }
}

// 예약 선택 기능
function selectBooking(booking, eventElement) {
    // 이전 선택 해제
    if (selectedBooking && selectedBooking.element) {
        selectedBooking.element.style.outline = '';
        selectedBooking.element.style.boxShadow = '';
    }
    
    // 같은 예약을 다시 클릭하면 선택 해제
    if (selectedBooking && selectedBooking.id === booking.id) {
        selectedBooking = null;
        console.log('예약 선택 해제됨');
        return;
    }
    
    // 새로운 예약 선택
    selectedBooking = {
        id: booking.id,
        booking: booking,
        element: eventElement
    };
    
    // 선택된 예약 스타일 변경
    eventElement.style.outline = '3px solid #FFD700';
    eventElement.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
    
    console.log('예약 선택됨:', booking.id, booking);
    App.showNotification('예약이 선택되었습니다. Delete 키를 눌러 삭제할 수 있습니다.', 'info');
}

// 선택된 예약 삭제
async function deleteSelectedBooking() {
    if (!selectedBooking) {
        console.log('선택된 예약이 없습니다.');
        return;
    }
    
    const booking = selectedBooking.booking;
    const memberName = booking.member ? booking.member.name : (booking.nonMemberName || '비회원');
    const startTime = new Date(booking.startTime);
    const timeStr = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')} ${startTime.getHours()}:${String(startTime.getMinutes()).padStart(2, '0')}`;
    
    if (!confirm(`예약을 삭제하시겠습니까?\n\n회원: ${memberName}\n시간: ${timeStr}`)) {
        return;
    }
    
    try {
        await deleteBooking(selectedBooking.id);
        
        // 선택 해제
        selectedBooking = null;
        
        App.showNotification('예약이 삭제되었습니다.', 'success');
        
        // 캘린더 새로고침
        if (currentView === 'calendar') {
            await renderCalendar();
        } else {
            loadBookingsList();
        }
    } catch (error) {
        console.error('예약 삭제 실패:', error);
        App.showNotification('예약 삭제에 실패했습니다.', 'danger');
    }
}
