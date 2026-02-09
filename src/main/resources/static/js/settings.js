// 설정 페이지 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
});

async function loadSettings() {
    try {
        const settings = await App.api.get('/settings');
        // 지점별 센터명
        document.getElementById('setting-center-name-saha').value = settings.centerNameSaha || '';
        document.getElementById('setting-center-name-yeonsan').value = settings.centerNameYeonsan || '';
        // 지점별 연락처
        document.getElementById('setting-phone-saha').value = settings.phoneNumberSaha || '';
        document.getElementById('setting-phone-yeonsan').value = settings.phoneNumberYeonsan || '';
        // 지점별 주소
        document.getElementById('setting-address-saha').value = settings.addressSaha || '';
        document.getElementById('setting-address-yeonsan').value = settings.addressYeonsan || '';
        // 운영시간 (한 줄)
        document.getElementById('setting-operating-hours').value = settings.operatingHours || '';
    } catch (error) {
        App.err('설정 로드 실패:', error);
        // 에러 발생 시 기본값 설정
        document.getElementById('setting-center-name-saha').value = '';
        document.getElementById('setting-center-name-yeonsan').value = '';
        document.getElementById('setting-phone-saha').value = '';
        document.getElementById('setting-phone-yeonsan').value = '';
        document.getElementById('setting-address-saha').value = '';
        document.getElementById('setting-address-yeonsan').value = '';
        document.getElementById('setting-operating-hours').value = '';
        
        // 알림은 표시하지 않음 (개발 중이므로)
        App.warn('설정을 불러올 수 없어 기본값을 사용합니다.');
    }
}

async function saveSettings() {
    const data = {
        centerNameSaha: document.getElementById('setting-center-name-saha').value,
        centerNameYeonsan: document.getElementById('setting-center-name-yeonsan').value,
        phoneNumberSaha: document.getElementById('setting-phone-saha').value,
        phoneNumberYeonsan: document.getElementById('setting-phone-yeonsan').value,
        addressSaha: document.getElementById('setting-address-saha').value,
        addressYeonsan: document.getElementById('setting-address-yeonsan').value,
        operatingHours: document.getElementById('setting-operating-hours').value
    };
    
    try {
        await App.api.put('/settings', data);
        App.showNotification('설정이 저장되었습니다.', 'success');
    } catch (error) {
        App.err('설정 저장 실패:', error);
        App.showNotification('저장에 실패했습니다.', 'danger');
    }
}

// 사용자 목록은 사용자 관리(users.html) 페이지에서 이용하세요.
