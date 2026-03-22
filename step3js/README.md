# Step3JS - 3D CAD Web Viewer

이 프로젝트는 STEP, STP, STL, OBJ 파일을 웹 브라우저에서 시각화하고 편집, 비교, 분석하기 위한 윕앱입니다.

## 주요 기능
- **다양한 포맷 지원**: STEP (.step, .stp), STL (.stl), OBJ (.obj)
- **강력한 STEP 엔진**: `occt-import-js` (Open Cascade Technology WASM)를 사용하여 높은 호환성 제공
- **고급 상호작용**: 
  - 마우스 드래그: 회전
  - 마우스 휠: 확대/축소
  - 마우스 오른쪽/Ctrl+드래그: 이동 (Pan)
- **섹션 뷰 (Section View)**: X, Y, Z축별 실시간 단면 절단 기능
- **백엔드 연동**: 모델 로딩 시 API 호출 및 로깅 기능 포함

## 설정 정보
- **포트**: 4101
- **접속 URL**: `https://ai-tworld.com/step3js`
- **주요 기술 스택**: 
  - Backend: Node.js (Express)
  - Frontend: Three.js, occt-import-js

## 실행 방법
```bash
cd step3js
npm install
node server.js
```

현재 서버는 백그라운드에서 실행 중입니다.
Nginx 설정은 `/etc/nginx/sites-enabled/ai-tworld.com`에서 `/step3js/` 경로가 `localhost:4101`로 프록시되도록 설정되었습니다.
