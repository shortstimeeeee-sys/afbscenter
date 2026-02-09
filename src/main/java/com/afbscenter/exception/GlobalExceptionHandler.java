package com.afbscenter.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.HashMap;
import java.util.Map;

/**
 * 전역 예외 핸들러
 * 모든 컨트롤러에서 발생하는 예외를 일관되게 처리
 */
@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Bean Validation 예외 처리
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException e) {
        logger.warn("입력 검증 실패: {}", e.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        Map<String, String> fieldErrors = new HashMap<>();
        
        for (FieldError error : e.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        
        errorResponse.put("error", "Validation Failed");
        errorResponse.put("message", "입력 데이터 검증에 실패했습니다.");
        errorResponse.put("fieldErrors", fieldErrors);
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * 잘못된 인자 예외 처리
     */
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(IllegalArgumentException e) {
        logger.warn("잘못된 요청: {}", e.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Bad Request");
        errorResponse.put("message", e.getMessage());
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * Null 포인터 예외 처리
     */
    @ExceptionHandler(NullPointerException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseEntity<Map<String, Object>> handleNullPointerException(NullPointerException e) {
        logger.error("Null 포인터 예외 발생", e);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Internal Server Error");
        errorResponse.put("message", "서버 내부 오류가 발생했습니다.");
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }

    /**
     * 타입 변환 예외 처리
     */
    @ExceptionHandler(ClassCastException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleClassCastException(ClassCastException e) {
        logger.warn("타입 변환 오류: {}", e.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Bad Request");
        errorResponse.put("message", "요청 데이터 형식이 올바르지 않습니다.");
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * 숫자 형식 예외 처리
     */
    @ExceptionHandler(NumberFormatException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleNumberFormatException(NumberFormatException e) {
        logger.warn("숫자 형식 오류: {}", e.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Bad Request");
        errorResponse.put("message", "숫자 형식이 올바르지 않습니다.");
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * HTTP 메시지 읽기 예외 처리 (JSON 파싱 오류 등)
     */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleHttpMessageNotReadableException(
            org.springframework.http.converter.HttpMessageNotReadableException e) {
        logger.warn("HTTP 메시지 읽기 오류: {}", e.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        String errorMessage = "요청 데이터 형식이 올바르지 않습니다.";
        if (e.getMessage() != null && e.getMessage().contains("Boolean")) {
            errorMessage = "요청 데이터에 잘못된 형식이 포함되어 있습니다. Boolean 값은 true 또는 false만 가능합니다.";
        }
        errorResponse.put("error", "Bad Request");
        errorResponse.put("message", errorMessage);
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * 데이터 무결성 예외 처리
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolationException(
            org.springframework.dao.DataIntegrityViolationException e) {
        logger.error("데이터 무결성 위반: {}", e.getMessage(), e);
        Map<String, Object> errorResponse = new HashMap<>();
        String errorMessage = "데이터 저장 중 제약 조건 위반이 발생했습니다.";
        if (e.getCause() != null && e.getCause().getMessage() != null) {
            errorMessage = e.getCause().getMessage();
        }
        errorResponse.put("error", "Data Integrity Violation");
        errorResponse.put("message", errorMessage);
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * 제약 조건 위반 예외 처리
     */
    @ExceptionHandler(org.hibernate.exception.ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleConstraintViolationException(
            org.hibernate.exception.ConstraintViolationException e) {
        logger.error("제약 조건 위반: {}", e.getMessage(), e);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Constraint Violation");
        errorResponse.put("message", "데이터 저장 중 제약 조건 위반이 발생했습니다: " + e.getMessage());
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * 정적 리소스를 찾을 수 없는 예외 처리 (Chrome DevTools 등)
     * .well-known 경로는 조용히 무시
     */
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ResponseEntity<Map<String, Object>> handleNoResourceFoundException(
            org.springframework.web.servlet.resource.NoResourceFoundException e) {
        // .well-known 경로는 Chrome DevTools 등이 자동으로 요청하는 파일이므로 조용히 무시
        if (e.getMessage() != null && e.getMessage().contains(".well-known")) {
            // 조용히 404 반환 (로그 없음, 빈 응답)
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new HashMap<>());
        }
        // 다른 리소스는 경고 로그만 출력
        logger.debug("리소스를 찾을 수 없음: {}", e.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Not Found");
        errorResponse.put("message", "요청한 리소스를 찾을 수 없습니다.");
        errorResponse.put("status", HttpStatus.NOT_FOUND.value());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    /**
     * 기타 예외 처리
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception e) {
        // NoResourceFoundException은 이미 위에서 처리했으므로 여기서는 제외
        if (e instanceof org.springframework.web.servlet.resource.NoResourceFoundException) {
            return handleNoResourceFoundException((org.springframework.web.servlet.resource.NoResourceFoundException) e);
        }
        
        logger.error("예상치 못한 오류 발생", e);
        logger.error("오류 클래스: {}", e.getClass().getName());
        logger.error("오류 메시지: {}", e.getMessage(), e);
        
        // 원인 체인 전체 출력
        Throwable cause = e.getCause();
        int depth = 0;
        while (cause != null && depth < 5) {
            logger.error("원인 {}: {} - {}", depth + 1, cause.getClass().getName(), cause.getMessage());
            cause = cause.getCause();
            depth++;
        }
        
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Internal Server Error");
        errorResponse.put("message", "서버 내부 오류가 발생했습니다: " + (e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
        errorResponse.put("errorClass", e.getClass().getName());
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        if (e.getCause() != null) {
            errorResponse.put("cause", e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
        }
        // 스택 트레이스의 첫 번째 줄도 포함
        if (e.getStackTrace() != null && e.getStackTrace().length > 0) {
            errorResponse.put("stackTrace", e.getStackTrace()[0].toString());
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
}
