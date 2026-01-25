package com.afbscenter.controller;

import com.afbscenter.model.Settings;
import com.afbscenter.repository.SettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private static final Logger logger = LoggerFactory.getLogger(SettingsController.class);

    private final SettingsRepository settingsRepository;
    
    // Settings 기본값 (application.properties에서 주입)
    @Value("${settings.default.center-name:AFBS 야구센터}")
    private String defaultCenterName;
    
    @Value("${settings.default.phone:02-1234-5678}")
    private String defaultPhone;
    
    @Value("${settings.default.address:서울특별시 강남구}")
    private String defaultAddress;
    
    @Value("${settings.default.open-time:09:00}")
    private String defaultOpenTime;
    
    @Value("${settings.default.close-time:22:00}")
    private String defaultCloseTime;
    
    @Value("${settings.default.holiday-info:연중무휴}")
    private String defaultHolidayInfo;
    
    @Value("${settings.default.session-duration:60}")
    private Integer defaultSessionDuration;
    
    @Value("${settings.default.max-advance-booking-days:30}")
    private Integer defaultMaxAdvanceBookingDays;
    
    @Value("${settings.default.cancellation-deadline-hours:24}")
    private Integer defaultCancellationDeadlineHours;
    
    @Value("${settings.default.tax-rate:10.0}")
    private Double defaultTaxRate;
    
    @Value("${settings.default.refund-policy:예약 24시간 전까지 전액 환불}")
    private String defaultRefundPolicy;
    
    @Value("${settings.default.sms-enabled:true}")
    private Boolean defaultSmsEnabled;
    
    @Value("${settings.default.email-enabled:false}")
    private Boolean defaultEmailEnabled;
    
    @Value("${settings.default.reminder-hours:24}")
    private Integer defaultReminderHours;

    public SettingsController(SettingsRepository settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings() {
        try {
            List<Settings> settingsList = settingsRepository.findAll();
            
            // 설정이 없으면 기본값 생성
            Settings settings;
            if (settingsList.isEmpty()) {
                logger.info("설정이 없어 기본 설정을 생성합니다.");
                settings = createAndSaveDefaultSettings();
                if (settings == null) {
                    // 기본값 생성 실패 시 임시 객체 반환
                    settings = createTempSettings();
                }
            } else {
                settings = settingsList.get(0); // 첫 번째 설정 사용
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", settings.getId());
            // 지점별 센터명
            response.put("centerNameSaha", settings.getCenterNameSaha() != null ? settings.getCenterNameSaha() : "");
            response.put("centerNameYeonsan", settings.getCenterNameYeonsan() != null ? settings.getCenterNameYeonsan() : "");
            // 지점별 연락처
            response.put("phoneNumberSaha", settings.getPhoneNumberSaha() != null ? settings.getPhoneNumberSaha() : "");
            response.put("phoneNumberYeonsan", settings.getPhoneNumberYeonsan() != null ? settings.getPhoneNumberYeonsan() : "");
            // 지점별 주소
            response.put("addressSaha", settings.getAddressSaha() != null ? settings.getAddressSaha() : "");
            response.put("addressYeonsan", settings.getAddressYeonsan() != null ? settings.getAddressYeonsan() : "");
            // 운영시간 (한 줄)
            response.put("operatingHours", settings.getOperatingHours() != null ? settings.getOperatingHours() : "");
            // 하위 호환성
            response.put("centerName", settings.getCenterName() != null ? settings.getCenterName() : "");
            response.put("phoneNumber", settings.getPhoneNumber() != null ? settings.getPhoneNumber() : "");
            response.put("address", settings.getAddress() != null ? settings.getAddress() : "");
            response.put("businessNumber", settings.getBusinessNumber() != null ? settings.getBusinessNumber() : "");
            response.put("holidayInfo", settings.getHolidayInfo() != null ? settings.getHolidayInfo() : defaultHolidayInfo);
            response.put("defaultSessionDuration", settings.getDefaultSessionDuration() != null ? settings.getDefaultSessionDuration() : defaultSessionDuration);
            response.put("maxAdvanceBookingDays", settings.getMaxAdvanceBookingDays() != null ? settings.getMaxAdvanceBookingDays() : defaultMaxAdvanceBookingDays);
            response.put("cancellationDeadlineHours", settings.getCancellationDeadlineHours() != null ? settings.getCancellationDeadlineHours() : defaultCancellationDeadlineHours);
            response.put("taxRate", settings.getTaxRate() != null ? settings.getTaxRate() : defaultTaxRate);
            response.put("refundPolicy", settings.getRefundPolicy() != null ? settings.getRefundPolicy() : defaultRefundPolicy);
            response.put("smsEnabled", settings.getSmsEnabled() != null ? settings.getSmsEnabled() : defaultSmsEnabled);
            response.put("emailEnabled", settings.getEmailEnabled() != null ? settings.getEmailEnabled() : defaultEmailEnabled);
            response.put("reminderHours", settings.getReminderHours() != null ? settings.getReminderHours() : defaultReminderHours);
            response.put("notes", settings.getNotes() != null ? settings.getNotes() : "");
            response.put("updatedAt", settings.getUpdatedAt());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("설정 조회 중 오류 발생: {}", e.getMessage(), e);
            
            // 에러 발생 시 빈 기본값 반환 (application.properties에서 주입받은 기본값 사용)
            Map<String, Object> defaultResponse = new HashMap<>();
            defaultResponse.put("id", null);
            defaultResponse.put("centerNameSaha", "");
            defaultResponse.put("centerNameYeonsan", "");
            defaultResponse.put("phoneNumberSaha", "");
            defaultResponse.put("phoneNumberYeonsan", "");
            defaultResponse.put("addressSaha", "");
            defaultResponse.put("addressYeonsan", "");
            defaultResponse.put("operatingHours", "");
            defaultResponse.put("centerName", defaultCenterName);
            defaultResponse.put("phoneNumber", "");
            defaultResponse.put("address", defaultAddress);
            defaultResponse.put("businessNumber", "");
            defaultResponse.put("holidayInfo", defaultHolidayInfo);
            defaultResponse.put("defaultSessionDuration", defaultSessionDuration);
            defaultResponse.put("maxAdvanceBookingDays", defaultMaxAdvanceBookingDays);
            defaultResponse.put("cancellationDeadlineHours", defaultCancellationDeadlineHours);
            defaultResponse.put("taxRate", defaultTaxRate);
            defaultResponse.put("refundPolicy", defaultRefundPolicy);
            defaultResponse.put("smsEnabled", defaultSmsEnabled);
            defaultResponse.put("emailEnabled", defaultEmailEnabled);
            defaultResponse.put("reminderHours", defaultReminderHours);
            defaultResponse.put("notes", "");
            defaultResponse.put("updatedAt", null);
            
            return ResponseEntity.ok(defaultResponse);
        }
    }

    @PutMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> updateSettings(@RequestBody Map<String, Object> settingsData) {
        try {
            List<Settings> settingsList = settingsRepository.findAll();
            
            Settings settings;
            if (settingsList.isEmpty()) {
                settings = new Settings();
            } else {
                settings = settingsList.get(0);
            }
            
            // 센터 기본 정보 업데이트 (지점별)
            if (settingsData.get("centerNameSaha") != null) {
                settings.setCenterNameSaha(settingsData.get("centerNameSaha").toString());
            }
            if (settingsData.get("centerNameYeonsan") != null) {
                settings.setCenterNameYeonsan(settingsData.get("centerNameYeonsan").toString());
            }
            if (settingsData.get("phoneNumberSaha") != null) {
                settings.setPhoneNumberSaha(settingsData.get("phoneNumberSaha").toString());
            }
            if (settingsData.get("phoneNumberYeonsan") != null) {
                settings.setPhoneNumberYeonsan(settingsData.get("phoneNumberYeonsan").toString());
            }
            if (settingsData.get("addressSaha") != null) {
                settings.setAddressSaha(settingsData.get("addressSaha").toString());
            }
            if (settingsData.get("addressYeonsan") != null) {
                settings.setAddressYeonsan(settingsData.get("addressYeonsan").toString());
            }
            // 운영시간 (한 줄 텍스트)
            if (settingsData.get("operatingHours") != null) {
                settings.setOperatingHours(settingsData.get("operatingHours").toString());
            }
            // 하위 호환성
            if (settingsData.get("centerName") != null) {
                settings.setCenterName(settingsData.get("centerName").toString());
            }
            if (settingsData.get("phoneNumber") != null) {
                settings.setPhoneNumber(settingsData.get("phoneNumber").toString());
            }
            if (settingsData.get("address") != null) {
                settings.setAddress(settingsData.get("address").toString());
            }
            if (settingsData.get("businessNumber") != null) {
                settings.setBusinessNumber(settingsData.get("businessNumber").toString());
            }
            if (settingsData.get("holidayInfo") != null) {
                settings.setHolidayInfo(settingsData.get("holidayInfo").toString());
            }
            
            // 예약 설정 업데이트
            if (settingsData.get("defaultSessionDuration") != null) {
                settings.setDefaultSessionDuration(
                    Integer.parseInt(settingsData.get("defaultSessionDuration").toString())
                );
            }
            if (settingsData.get("maxAdvanceBookingDays") != null) {
                settings.setMaxAdvanceBookingDays(
                    Integer.parseInt(settingsData.get("maxAdvanceBookingDays").toString())
                );
            }
            if (settingsData.get("cancellationDeadlineHours") != null) {
                settings.setCancellationDeadlineHours(
                    Integer.parseInt(settingsData.get("cancellationDeadlineHours").toString())
                );
            }
            
            // 결제 설정 업데이트
            if (settingsData.get("taxRate") != null) {
                settings.setTaxRate(Double.parseDouble(settingsData.get("taxRate").toString()));
            }
            if (settingsData.get("refundPolicy") != null) {
                settings.setRefundPolicy(settingsData.get("refundPolicy").toString());
            }
            
            // 알림 설정 업데이트
            if (settingsData.get("smsEnabled") != null) {
                settings.setSmsEnabled(Boolean.parseBoolean(settingsData.get("smsEnabled").toString()));
            }
            if (settingsData.get("emailEnabled") != null) {
                settings.setEmailEnabled(Boolean.parseBoolean(settingsData.get("emailEnabled").toString()));
            }
            if (settingsData.get("reminderHours") != null) {
                settings.setReminderHours(
                    Integer.parseInt(settingsData.get("reminderHours").toString())
                );
            }
            
            // 기타
            if (settingsData.get("notes") != null) {
                settings.setNotes(settingsData.get("notes").toString());
            }
            
            settings.setUpdatedAt(LocalDateTime.now());
            
            Settings saved = settingsRepository.save(settings);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("centerName", saved.getCenterName());
            response.put("phoneNumber", saved.getPhoneNumber());
            response.put("address", saved.getAddress());
            response.put("message", "설정이 저장되었습니다.");
            
            logger.info("설정 저장 완료: ID={}", saved.getId());
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("설정 저장 중 오류 발생", e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "설정 저장 중 오류가 발생했습니다: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    // 기본 설정 생성 및 저장 (application.properties에서 주입받은 기본값 사용)
    private Settings createAndSaveDefaultSettings() {
        try {
            Settings settings = new Settings();
            settings.setCenterNameSaha("");
            settings.setCenterNameYeonsan("");
            settings.setPhoneNumberSaha("");
            settings.setPhoneNumberYeonsan("");
            settings.setAddressSaha("");
            settings.setAddressYeonsan("");
            settings.setOperatingHours("");
            // 하위 호환성
            settings.setCenterName(defaultCenterName);
            settings.setPhoneNumber(defaultPhone);
            settings.setAddress(defaultAddress);
            settings.setHolidayInfo(defaultHolidayInfo);
            settings.setDefaultSessionDuration(defaultSessionDuration);
            settings.setMaxAdvanceBookingDays(defaultMaxAdvanceBookingDays);
            settings.setCancellationDeadlineHours(defaultCancellationDeadlineHours);
            settings.setTaxRate(defaultTaxRate);
            settings.setRefundPolicy(defaultRefundPolicy);
            settings.setSmsEnabled(defaultSmsEnabled);
            settings.setEmailEnabled(defaultEmailEnabled);
            settings.setReminderHours(defaultReminderHours);
            settings.setUpdatedAt(LocalDateTime.now());
            
            logger.info("기본 설정 저장 시도...");
            Settings saved = settingsRepository.save(settings);
            logger.info("기본 설정 저장 완료: ID={}", saved.getId());
            return saved;
        } catch (Exception e) {
            logger.error("기본 설정 생성 실패: {}", e.getMessage(), e);
            return null;
        }
    }
    
    // 임시 설정 객체 생성 (DB 저장 없음, application.properties에서 주입받은 기본값 사용)
    private Settings createTempSettings() {
        Settings settings = new Settings();
        settings.setId(null);
        settings.setCenterNameSaha("");
        settings.setCenterNameYeonsan("");
        settings.setPhoneNumberSaha("");
        settings.setPhoneNumberYeonsan("");
        settings.setAddressSaha("");
        settings.setAddressYeonsan("");
        settings.setOperatingHours("");
        // 하위 호환성
        settings.setCenterName(defaultCenterName);
        settings.setPhoneNumber("");
        settings.setAddress(defaultAddress);
        settings.setHolidayInfo(defaultHolidayInfo);
        settings.setDefaultSessionDuration(defaultSessionDuration);
        settings.setMaxAdvanceBookingDays(defaultMaxAdvanceBookingDays);
        settings.setCancellationDeadlineHours(defaultCancellationDeadlineHours);
        settings.setTaxRate(defaultTaxRate);
        settings.setRefundPolicy(defaultRefundPolicy);
        settings.setSmsEnabled(defaultSmsEnabled);
        settings.setEmailEnabled(defaultEmailEnabled);
        settings.setReminderHours(defaultReminderHours);
        settings.setNotes("");
        settings.setUpdatedAt(LocalDateTime.now());
        return settings;
    }
}
