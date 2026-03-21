# Claw Fighter - Godot Engine Version

이 프로젝트는 `ai-tworld-portal`의 웹 기반 파이터 게임을 **Godot Engine 4.x**용으로 재구성한 버전입니다.
각 캐릭터의 고유한 움직임과 특수 공격이 `GDScript`의 객체 지향 구조를 통해 구현되었습니다.

## 실행 방법
1. Godot Engine 4.x 버전을 다운로드하고 실행합니다.
2. `Import` 버튼을 눌러 이 폴더(`godot-claw-fighter`)의 `project.godot` 파일을 선택합니다.
3. 프로젝트를 엽니다.

## 구조 안내
*   **`scripts/Fighter.gd`**: 모든 캐릭터의 뼈대가 되는 베이스 클래스 (`CharacterBody2D` 상속). 기본 이동, 점프, 중력, 공격 입력 처리를 담당합니다.
*   **`scripts/characters/`**: 베이스 클래스를 상속받아 캐릭터별 특수 로직을 구현한 스크립트들.
    *   **`Vanguard.gd`**: 전방 고속 대시 이동 (`handle_dash` 구현)
    *   **`Wraith.gd`**: 공중 2단 점프 및 피격 무시 은신 (`handle_jump` 오버라이드)
    *   **`Colossus.gd`**: 묵직한 이동, 피격 시 밀리지 않는 슈퍼 아머 (`take_damage` 오버라이드), 낙하형 지진 공격
    *   **`Volt.gd`**: 점프 키 유지 시 공중 부양, 원거리 투사체 생성
    *   **`Reaper.gd`**: 거대 낫 (히트박스 크기 증가), 타격 시 체력 흡수 (Lifesteal)

## 씬(Scene) 구성 가이드 (Godot 에디터에서 해야 할 일)
스크립트가 완성되었으므로, Godot 에디터에서 다음 씬들을 만들어 스크립트를 연결해야 합니다.
1.  **캐릭터 씬 생성**: `CharacterBody2D` 노드를 생성하고 자식으로 `Sprite2D`(캐릭터 이미지), `CollisionShape2D`(충돌체), `AnimationPlayer`(애니메이션), `Area2D`(HitBox - 무기 판정)를 추가합니다.
2.  **스크립트 연결**: 생성한 캐릭터 최상위 노드에 `Vanguard.gd` 등 원하는 스크립트를 드래그 앤 드롭으로 연결합니다.
3.  **애니메이션 세팅**: `AnimationPlayer`에 "idle", "run", "jump", "punch", "special" 등의 애니메이션을 만들고, 무기(HitBox)의 활성화/비활성화 타이밍을 조절합니다.
4.  **입력 맵핑 확인**: `프로젝트 -> 프로젝트 설정 -> 입력 맵`에 `move_left`, `move_right`, `jump`, `attack_punch`, `attack_special`이 기본으로 추가되어 있습니다. 키보드 키(예: 방향키, Z, X, C)를 할당해주세요.
