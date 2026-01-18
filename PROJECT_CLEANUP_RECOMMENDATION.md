# 프로젝트 정리 권장사항

## 검토 일자: 2026-01-18

## 요약
프로젝트 전체를 검토한 결과, 기능에 영향을 주지 않으면서 정리 가능한 중복 및 불필요한 파일들이 발견되었습니다.

---

## 1. 중복 문서 파일 (*.md) - 삭제 권장

### 1.1 리포트/분석 문서 (임시성 문서)
이 문서들은 이전 코드 리뷰/분석 시 생성된 임시 문서입니다. 주요 내용이 이미 반영되었으므로 삭제해도 무방합니다.

**삭제 추천:**
- `CLEANUP_COMPLETED.md` - 정리 완료 기록 (임시)
- `CLEANUP_SUMMARY.md` - 정리 요약 (임시)
- `FINAL_REVIEW_REPORT.md` - 최종 리뷰 (임시)
- `PROJECT_REVIEW_REPORT.md` - 프로젝트 리뷰 (임시)
- `SECURITY_AUDIT_REPORT.md` - 보안 감사 (임시)
- `UNUSED_CODE_ANALYSIS.md` - 미사용 코드 분석 (임시)
- `CODE_REVIEW.md` - 코드 리뷰 (임시)
- `PROJECT_ISSUES.md` - 프로젝트 이슈 (임시)
- `IMPROVEMENT_IMPACT_ANALYSIS.md` - 개선 영향 분석 (임시)

### 1.2 중복 구조 문서
**유지 권장:**
- `README.md` - 프로젝트 메인 문서 (필수)
- `SETUP_GUIDE.md` - 설치 가이드 (필수)
- `DEPLOYMENT_GUIDE.md` - 배포 가이드 (필수)
- `QUICK_START.md` - 빠른 시작 가이드 (유용)
- `PROJECT_STRUCTURE.md` - 프로젝트 구조 설명 (유용)

---

## 2. SQL 마이그레이션 파일 - 아카이브 또는 삭제

**이미 실행 완료된 마이그레이션 스크립트:**
- `migrate-grades.sql` - 회원 등급 마이그레이션 (완료)
- `migrate-member-grade.sql` - 회원 등급 enum 변환 (완료)
- `migrate-grades-fix.sql` - 등급 제약조건 수정 (완료)

**권장 조치:**
1. 이미 DB에 적용되었다면 `archive/` 또는 `migrations/` 폴더로 이동
2. 또는 삭제 (Git 히스토리에 보존됨)

---

## 3. PowerShell 스크립트 파일 - 정리 필요

### 3.1 중복 서버 제어 스크립트
**현재 상태:**
- `server-control-panel.ps1` - 주 제어판 스크립트
- `서버제어판.ps1` - 한글 이름 중복 스크립트 (내용 동일)
- `start-server.ps1` - 서버 시작
- `stop-server.ps1` - 서버 중지
- `restart-server.ps1` - 서버 재시작
- `run.ps1` - 실행 스크립트
- `create-shortcut-fixed.ps1` - 바로가기 생성
- `Server-Control-Panel-Fixed.bat` - BAT 파일
- `server-control-panel.vbs` - VBS 파일

**권장 조치:**
- `서버제어판.ps1` 삭제 (한글 이름으로 `server-control-panel.ps1`과 중복)
- `create-shortcut-fixed.ps1` 유지 (설치 시 필요)
- 나머지는 각자 용도가 있어 유지 권장

---

## 4. 미사용 백엔드 코드 - 삭제 권장

### 4.1 BaseballRecord 관련 코드 (미사용)
**프론트엔드에서 사용하지 않는 기능:**
- `BaseballRecordController.java` - API는 있으나 UI 없음
- `BaseballRecordService.java` - 서비스 미사용
- `BaseballRecordRepository.java` - 리포지토리 미사용
- `BaseballRecord.java` (모델) - 엔티티 미사용

**현재 상태:**
- TrainingLog 기능으로 대체되어 실제로는 사용되지 않음
- DB 테이블도 생성되지만 데이터가 없을 가능성 높음

**권장 조치:**
1. 프론트엔드에서 정말 사용하지 않는지 최종 확인
2. 사용하지 않으면 삭제
3. 또는 향후 사용 계획이 있다면 주석으로 명시

### 4.2 Settings 관련 코드 (불완전)
**현재 상태:**
- `settings.html`, `settings.css`, `settings.js` 존재
- 하지만 백엔드 컨트롤러가 없음 (API 없음)
- UI는 있지만 실제 동작하지 않음

**권장 조치:**
1. 설정 기능을 완전히 구현할 계획이 있다면 유지
2. 당장 사용하지 않는다면 삭제 또는 `future/` 폴더로 이동

---

## 5. 미사용 프론트엔드 코드

### 5.1 app.js (레거시)
- `app.js` - 초기 개발 시 사용하던 레거시 코드
- 현재 `common.js`가 대체
- 실제로 어떤 HTML에서도 참조하지 않음

**권장 조치:** 삭제

---

## 6. 정리 액션 플랜

### 우선순위 1 (즉시 삭제 가능)
```bash
# 임시 리포트 문서
rm CLEANUP_COMPLETED.md
rm CLEANUP_SUMMARY.md
rm FINAL_REVIEW_REPORT.md
rm PROJECT_REVIEW_REPORT.md
rm SECURITY_AUDIT_REPORT.md
rm UNUSED_CODE_ANALYSIS.md
rm CODE_REVIEW.md
rm PROJECT_ISSUES.md
rm IMPROVEMENT_IMPACT_ANALYSIS.md

# 중복 PowerShell
rm 서버제어판.ps1

# 마이그레이션 SQL (이미 적용됨)
rm migrate-grades.sql
rm migrate-member-grade.sql
rm migrate-grades-fix.sql

# 레거시 JS
rm src/main/resources/static/js/app.js
```

### 우선순위 2 (확인 후 삭제)
**BaseballRecord 관련 코드** (사용 여부 확인 필요):
```bash
# 백엔드
rm src/main/java/com/afbscenter/controller/BaseballRecordController.java
rm src/main/java/com/afbscenter/service/BaseballRecordService.java
rm src/main/java/com/afbscenter/repository/BaseballRecordRepository.java
rm src/main/java/com/afbscenter/model/BaseballRecord.java
```

**Settings 관련 코드** (미완성 기능):
```bash
# 프론트엔드만 존재 (백엔드 없음)
rm src/main/resources/static/settings.html
rm src/main/resources/static/css/settings.css
rm src/main/resources/static/js/settings.js
```

### 우선순위 3 (선택사항)
- `Server-Control-Panel-Fixed.bat` - BAT 파일 필요 시 유지
- `server-control-panel.vbs` - VBS 파일 필요 시 유지

---

## 7. 예상 효과

### 파일 감소
- **문서 파일**: 9개 삭제
- **SQL 파일**: 3개 삭제
- **PowerShell**: 1개 삭제
- **Java 코드**: 4개 삭제 (BaseballRecord 관련)
- **프론트엔드**: 4개 삭제 (app.js, settings 관련)

**총 약 21개 파일 정리 가능**

### 이점
1. **프로젝트 구조 명확화** - 실제 사용되는 파일만 남음
2. **유지보수 용이성** - 불필요한 코드 제거로 혼란 감소
3. **Git 히스토리 정리** - 커밋 시 변경사항 추적 용이
4. **새 개발자 온보딩** - 프로젝트 이해 시간 단축

---

## 8. 주의사항

1. **백업 필수**: 삭제 전 Git 커밋 완료 확인
2. **테스트 필수**: BaseballRecord 삭제 시 전체 기능 테스트
3. **단계적 진행**: 우선순위 1부터 순차적으로 진행
4. **롤백 준비**: 문제 발생 시 Git으로 복구 가능

---

## 9. 실행 여부

이 정리를 진행하시겠습니까?
- [ ] 우선순위 1 (즉시 삭제 가능한 파일들)
- [ ] 우선순위 2 (확인 후 삭제 - BaseballRecord, Settings)
- [ ] 우선순위 3 (선택적 삭제 - BAT/VBS 파일)
