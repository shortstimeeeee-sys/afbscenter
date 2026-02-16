package com.afbscenter.model.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * facility_slots.day_of_week 컬럼용 변환기.
 * DB에는 기존에 'MONDAY', 'TUESDAY' 등 문자열 또는 '1'~'7'이 저장될 수 있음.
 * 엔티티에서는 1(월)~7(일) Integer로 통일.
 */
@Converter(autoApply = false)
public class DayOfWeekIntegerConverter implements AttributeConverter<Integer, String> {

    private static final java.util.Map<String, Integer> NAME_TO_VALUE = java.util.Map.of(
        "MONDAY", 1, "TUESDAY", 2, "WEDNESDAY", 3, "THURSDAY", 4,
        "FRIDAY", 5, "SATURDAY", 6, "SUNDAY", 7
    );

    @Override
    public String convertToDatabaseColumn(Integer attribute) {
        if (attribute == null) return null;
        return String.valueOf(attribute);
    }

    @Override
    public Integer convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) return null;
        String key = dbData.trim().toUpperCase();
        if (NAME_TO_VALUE.containsKey(key)) return NAME_TO_VALUE.get(key);
        try {
            int n = Integer.parseInt(dbData.trim());
            if (n >= 1 && n <= 7) return n;
        } catch (NumberFormatException ignored) { }
        return null;
    }
}
