# 🚀 Mobile HW Development Portal (AI-TWorld)

모바일 단말 하드웨어 개발 효율화를 위한 멀티 에이전트 기반 자동화 포털입니다.

## 🌟 핵심 기능

### 1. 지능형 멀티 에이전트 시스템 (Big Agent Orchestration)
*   **Situation Analysis Agent**: 프로젝트 일정 및 이슈를 실시간 분석하여 필요한 작업을 도출합니다.
*   **Task Assignment Agent**: 각 TG별 자동화 서버에 최적의 업무를 할당합니다.
*   **Verification Agent**: 작업 결과를 검증하여 추가 조치 필요성을 판단합니다.
*   **Monitoring Agent**: 에이전트들의 상태를 감시하고 이상 발생 시 이메일 알림을 발송합니다.

### 2. TG(Tech Group)별 자동화 서버 연동 (NL-to-Code)
*   사용자가 자연어로 서버의 기능과 API 연동 방식을 입력하면, LLM이 이를 해석하여 구조화된 실행 로직으로 변환합니다.
*   하나의 TG 내에 여러 대의 자동화 서버를 등록하고 관리할 수 있습니다.

### 3. 유려한 대시보드 및 테마
*   **Midnight Blue**, **Light**, **High Contrast Dark** 3종 테마 지원.
*   에이전트들 간의 유기적인 동작을 한눈에 볼 수 있는 Flow Visualization 제공.

## 🛠 기술 스택
*   **Frontend**: React, TypeScript, Vite, Vanilla CSS, Lucide-React
*   **Backend**: Node.js (Express), TypeScript, Prisma (ORM), SQLite
*   **AI Integration**: Ollama, OpenWebUI 지원

## 📂 프로젝트 구조
```
hw-dev-portal/
├── backend/            # Express 서버 및 에이전트 로직
│   ├── prisma/         # DB 스키마 및 마이그레이션
│   └── src/
│       ├── controllers/# API 비즈니스 로직
│       ├── services/   # Big Agent 및 LLM 연동 서비스
│       └── __tests__/  # 테스트 코드
└── frontend/           # React SPA
    └── src/
        ├── components/ # 공통 UI 컴포넌트
        ├── contexts/   # 테마 및 상태 관리
        └── pages/      # 주요 화면 (Dashboard, Members, Agents, etc.)
```

## 🚀 시작하기

### 1. 백엔드 설정
```bash
cd backend
npm install
npx prisma migrate dev  # DB 초기화
npm run dev             # 서버 실행 (Port: 4000)
```

### 2. 프론트엔드 설정
```bash
cd frontend
npm install
npm run dev             # 웹 앱 실행 (Port: 5173)
```

## 📝 사용법 및 설정 가이드

1.  **에이전트 설정**: `Settings` 탭에서 에이전트별 LLM 모델(예: llama3)과 시스템 프롬프트를 설정합니다.
2.  **TG 서버 등록**: 각 TG의 담당자가 `Settings > TG Automation Servers`에서 서버 주소와 처리할 내용을 자연어로 입력합니다. (예: "회로 설계 파일을 받으면 /analyze-artwork로 POST 요청을 보내고 결과를 검증해줘")
3.  **모니터링**: `Agent Status` 메뉴에서 에이전트들의 상세 활동 로그와 실시간 동작 상태를 확인합니다.

## ⚠️ 추가 구성 필요사항 (Production)
*   **SSO 연동**: 추후 `backend/src/controllers/authController.ts`를 생성하여 기업용 SSO(SAML/OAuth) 연동이 필요합니다.
*   **LLM API 엔드포인트**: `Ollama` 또는 `OpenWebUI`가 설치된 서버의 실제 주소를 `.env`에 설정해야 합니다.
*   **Email SMTP**: `bigAgent.ts` 내의 `sendAlertMail` 함수에 실제 SMTP 계정 정보를 입력해야 알림 기능이 작동합니다.

## 🧪 테스트 실행
```bash
cd backend
npm test
```
