# 배포 가이드 (Deployment Guide)

이 프로젝트를 다른 사람이 인터넷을 통해 접근할 수 있게 하는 방법을 안내합니다.

## 방법 1: ngrok 사용 (가장 간단, 개발/테스트용)

### 장점
- 빠른 설정 (5분 이내)
- 별도 서버 불필요
- 무료 플랜 제공

### 단계

1. **ngrok 다운로드 및 설치**
   - https://ngrok.com/download 에서 다운로드
   - 또는 PowerShell에서:
   ```powershell
   # Chocolatey 사용 시
   choco install ngrok
   ```

2. **Spring Boot 서버 실행**
   ```powershell
   .\run.ps1
   ```
   서버가 `http://localhost:8080`에서 실행되는지 확인

3. **ngrok 터널 생성**
   ```powershell
   ngrok http 8080
   ```

4. **공유 링크 확인**
   - 터널이 생성되면 다음과 같은 링크가 표시됩니다:
   ```
   Forwarding: https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:8080
   ```
   - 이 `https://xxxx-xx-xx-xx-xx.ngrok-free.app` 링크를 다른 사람에게 공유

### 주의사항
- 무료 플랜은 세션이 2시간마다 만료됨 (재시작 필요)
- 무료 플랜은 링크가 매번 변경됨
- 프로덕션 환경에는 부적합

---

## 방법 2: 공유기 포트 포워딩 (로컬 네트워크 외부 접근)

### 장점
- 무료
- 안정적 (링크 변경 없음)

### 단계

1. **공인 IP 확인**
   - https://www.whatismyip.com/ 에서 확인
   - 또는 PowerShell에서:
   ```powershell
   (Invoke-WebRequest -Uri "https://api.ipify.org").Content
   ```

2. **공유기 설정**
   - 공유기 관리 페이지 접속 (보통 `192.168.0.1` 또는 `192.168.1.1`)
   - 포트 포워딩 설정:
     - 외부 포트: 8080 (또는 원하는 포트)
     - 내부 IP: 본인 PC의 로컬 IP (예: `192.168.0.100`)
     - 내부 포트: 8080
     - 프로토콜: TCP

3. **Windows 방화벽 설정**
   ```powershell
   # 관리자 권한으로 실행
   New-NetFirewallRule -DisplayName "Spring Boot Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
   ```

4. **application.properties 수정**
   ```properties
   server.address=0.0.0.0
   server.port=8080
   ```

5. **접근**
   - 다른 사람은 `http://공인IP:8080`으로 접근

### 주의사항
- 공인 IP가 변경될 수 있음 (동적 IP)
- 보안 설정 필요 (방화벽, 인증 등)
- ISP가 포트 차단할 수 있음

---

## 방법 3: 클라우드 서비스 배포 (프로덕션 권장)

### 3-1. Railway (추천 - 간단함)

1. **Railway 계정 생성**
   - https://railway.app/ 접속 및 GitHub 연동

2. **프로젝트 배포**
   ```powershell
   # Railway CLI 설치
   npm install -g @railway/cli
   
   # 로그인
   railway login
   
   # 프로젝트 초기화
   railway init
   
   # 배포
   railway up
   ```

3. **환경 변수 설정**
   - Railway 대시보드에서 설정
   - `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8`

### 3-2. Heroku

1. **Heroku CLI 설치**
   ```powershell
   # Chocolatey 사용 시
   choco install heroku-cli
   ```

2. **배포**
   ```powershell
   # 로그인
   heroku login
   
   # 앱 생성
   heroku create afbscenter
   
   # 배포
   git push heroku main
   ```

### 3-3. AWS EC2 / Azure / Google Cloud

- 더 복잡하지만 더 많은 제어권
- 프로덕션 환경에 적합
- 별도 가이드 필요

---

## 방법 4: GitHub Codespaces (개발/데모용)

1. **GitHub에 프로젝트 푸시**
2. **Codespaces 활성화**
   - GitHub 저장소에서 "Code" > "Codespaces" > "Create codespace"
3. **포트 포워딩**
   - Codespaces에서 자동으로 공개 URL 생성

---

## 보안 고려사항

### 배포 전 필수 체크리스트

- [ ] **인증/권한 시스템 추가**
  - 현재는 로그인 없이 접근 가능
  - Spring Security 추가 권장

- [ ] **HTTPS 사용**
  - ngrok은 자동으로 HTTPS 제공
  - 다른 방법 사용 시 Let's Encrypt 등으로 SSL 인증서 설정

- [ ] **민감 정보 보호**
  - `application.properties`의 DB 정보 등
  - 환경 변수로 관리

- [ ] **CORS 설정**
  - 현재는 `@CrossOrigin(origins = "*")`로 모든 도메인 허용
  - 프로덕션에서는 특정 도메인만 허용

- [ ] **방화벽 설정**
  - 필요한 포트만 열기
  - 관리자 페이지 접근 제한

---

## 추천 방법

### 개발/테스트 목적
→ **ngrok** (가장 빠르고 간단)

### 프로덕션/안정적 서비스
→ **Railway** 또는 **Heroku** (무료 플랜 있음)

### 완전한 제어 필요
→ **AWS EC2** 또는 **Azure VM**

---

## 빠른 시작 (ngrok)

```powershell
# 1. 서버 실행
.\run.ps1

# 2. 새 터미널에서 ngrok 실행
ngrok http 8080

# 3. 생성된 링크 공유
# 예: https://abc123.ngrok-free.app
```

---

## 문제 해결

### 포트가 이미 사용 중
```powershell
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :8080

# 프로세스 종료
taskkill /PID [PID번호] /F
```

### 외부에서 접근 불가
- 방화벽 확인
- 공유기 포트 포워딩 확인
- ISP 포트 차단 여부 확인

### ngrok 연결 실패
- 인터넷 연결 확인
- ngrok 계정 생성 및 인증 토큰 설정
