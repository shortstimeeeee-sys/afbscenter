# GitHub 연동 가이드

## 1. Git 설치

Git이 설치되어 있지 않습니다. 다음 중 하나의 방법으로 설치하세요:

### 방법 1: Git 공식 웹사이트
1. https://git-scm.com/download/win 방문
2. 다운로드 후 설치
3. 설치 시 "Add Git to PATH" 옵션 선택

### 방법 2: Winget 사용 (Windows 10/11)
```powershell
winget install --id Git.Git -e --source winget
```

### 방법 3: Chocolatey 사용
```powershell
choco install git
```

## 2. Git 설치 확인

설치 후 PowerShell을 재시작하고 다음 명령어로 확인:
```powershell
git --version
```

## 3. GitHub 연동 명령어

Git 설치 후 다음 명령어를 순서대로 실행하세요:

```powershell
# 프로젝트 디렉토리로 이동
cd "c:\Users\dlfgi\OneDrive\Desktop\afbscenter"

# Git 저장소 초기화
git init

# 사용자 정보 설정 (처음 한 번만)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: AFBS Center project"

# GitHub에서 새 저장소 생성 후 아래 명령어 실행
# (GitHub에서 저장소를 먼저 생성해야 합니다)
git remote add origin https://github.com/YOUR_USERNAME/afbscenter.git
git branch -M main
git push -u origin main
```

## 4. GitHub 저장소 생성

1. https://github.com 접속
2. 로그인
3. 우측 상단 "+" 버튼 클릭 → "New repository"
4. Repository name: `afbscenter` (또는 원하는 이름)
5. Public 또는 Private 선택
6. "Create repository" 클릭
7. 생성된 저장소 URL을 위 명령어의 `YOUR_USERNAME` 부분에 입력

## 5. 이후 작업 흐름

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

## 주의사항

- `.gitignore` 파일에 민감한 정보가 포함된 파일은 제외되어 있습니다
- `application.properties`에 데이터베이스 비밀번호 등이 있다면 별도로 관리하세요
- 한글 파일명은 Git에서 문제가 될 수 있으므로 영어 파일명 사용을 권장합니다
