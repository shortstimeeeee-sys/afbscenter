package com.afbscenter.constants;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CoachColorPaletteTest {

    @Test
    void jeongYeongSamPreferredColorIsPurple() {
        assertEquals("#673AB7", CoachColorPalette.preferredColorForName("정영삼 [트레이너 센터장]"));
        assertEquals("#673AB7", CoachColorPalette.preferredColorForName("정영삼"));
    }

    @Test
    void jeongJinHwanPreferredColorIsBlueGray() {
        assertEquals("#455A64", CoachColorPalette.preferredColorForName("정진환 [유소년]"));
        assertEquals("#455A64", CoachColorPalette.preferredColorForName("정진환"));
    }

    @Test
    void outdoorLessonPreferredColorIsRoyalBlue() {
        assertEquals("#2962FF", CoachColorPalette.preferredColorForName("야외레슨"));
    }

    @Test
    void outdoorLessonPlaceholderName() {
        assertEquals(true, CoachColorPalette.isOutdoorLessonPlaceholderName("야외레슨"));
        assertEquals(true, CoachColorPalette.isOutdoorLessonPlaceholderName("야외레슨 [코치]"));
        assertEquals(false, CoachColorPalette.isOutdoorLessonPlaceholderName("서정민 [대표]"));
    }
}
