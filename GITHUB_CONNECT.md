# GitHub 연결 가이드

## 현재 상태
✅ Git 저장소 초기화 완료
✅ 첫 커밋 완료 (129개 파일, 16,913줄 추가)
✅ 브랜치: master

## 다음 단계: GitHub 저장소 연결

### 1. GitHub에서 새 저장소 생성

1. https://github.com 접속 및 로그인
2. 우측 상단 "+" 버튼 클릭 → "New repository"
3. Repository name: `afbscenter` (또는 원하는 이름)
4. Description: "AFBS Center - 야구 센터 관리 시스템"
5. Public 또는 Private 선택
6. **중요**: "Initialize this repository with a README" 체크하지 않기
7. "Create repository" 클릭

### 2. GitHub 저장소 연결

GitHub에서 저장소를 생성한 후, 아래 명령어를 실행하세요:

```powershell
cd "c:\Users\dlfgi\OneDrive\Desktop\afbscenter"

# GitHub 저장소 URL 추가 (YOUR_USERNAME을 실제 GitHub 사용자명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/afbscenter.git

# 브랜치 이름을 main으로 변경 (GitHub 기본 브랜치)
git branch -M main

# GitHub에 푸시
git push -u origin main
```

### 3. 인증 방법

#### 방법 1: Personal Access Token (권장)
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" 클릭
3. Note: "AFBS Center Project"
4. Expiration: 원하는 기간 선택
5. Scopes: `repo` 체크
6. "Generate token" 클릭 후 토큰 복사
7. 푸시 시 사용자명은 GitHub 사용자명, 비밀번호는 토큰 입력

#### 방법 2: GitHub Desktop 사용
- GitHub Desktop 앱을 설치하여 GUI로 관리

#### 방법 3: SSH 키 사용
```powershell
# SSH 키 생성
ssh-keygen -t ed25519 -C "your_email@example.com"

# 공개 키 복사
cat ~/.ssh/id_ed25519.pub

# GitHub → Settings → SSH and GPG keys → New SSH key에 추가
```

### 4. 연결 확인

```powershell
# 원격 저장소 확인
git remote -v

# GitHub에 푸시
git push -u origin main
```

## 이후 작업 흐름

```powershell
# 변경사항 확인
git status

# 변경사항 추가
git add .

# 커밋
git commit -m "커밋 메시지"

# GitHub에 푸시
git push
```

## 현재 커밋 정보
- 커밋 해시: 7e19bc3
- 커밋 메시지: "Initial commit: AFBS Center project with server control panel"
- 파일 수: 129개
- 추가된 줄: 16,913줄
