extends Node

# EffectManager (Autoload 권장)
# 게임 전반의 타격감(Juice) 효과를 관리합니다.

var shake_strength: float = 0.0
var shake_decay: float = 5.0
var camera: Camera2D

func _ready():
	process_mode = Node.PROCESS_MODE_ALWAYS # 히트스톱 중에도 동작하도록 설정

func _process(delta):
	# 카메라 흔들림 로직
	if shake_strength > 0.0 and camera:
		shake_strength = lerp(shake_strength, 0.0, shake_decay * delta)
		var offset = Vector2(
			randf_range(-shake_strength, shake_strength),
			randf_range(-shake_strength, shake_strength)
		)
		camera.offset = offset
	elif camera:
		camera.offset = Vector2.ZERO

# 사운드 재생 (파일이 없어도 에러가 나지 않도록 처리)
func play_sound(node: Node, sound_name: String):
	var player = node.get_node_or_null("AudioStreamPlayer2D")
	if player:
		var stream = load("res://assets/sounds/" + sound_name + ".wav")
		if stream:
			player.stream = stream
			player.play()

# 캐릭터별 특수 기술 이펙트 생성
func spawn_special_vfx(type: String, pos: Vector2, facing_right: bool):
	match type:
		"vanguard": # 사이버 슬래시: 전방으로 뻗어나가는 민트색 잔상
			spawn_trail_vfx(pos, Color(0, 1, 0.8), facing_right)
		"wraith":   # 보이드 스텝: 보라색 연기와 함께 사라짐
			spawn_burst_vfx(pos, Color(0.5, 0, 1), 30)
		"colossus": # 그라운드 스매시: 지면 충격파 (갈색 파편)
			spawn_shockwave_vfx(pos, Color(0.4, 0.2, 0))
		"reaper":   # 소울 드레인: 검은색/빨간색 소용돌이
			spawn_vortex_vfx(pos, Color(0.2, 0, 0))

func spawn_trail_vfx(pos: Vector2, color: Color, facing_right: bool):
	var p = CPUParticles2D.new()
	p.global_position = pos
	p.amount = 20
	p.lifetime = 0.3
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(10, 50)
	p.direction = Vector2.LEFT if facing_right else Vector2.RIGHT
	p.spread = 0.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = 100.0
	p.initial_velocity_max = 200.0
	p.scale_amount_min = 5.0
	p.scale_amount_max = 10.0
	p.color = color
	p.one_shot = true
	add_cleanup_timer(p)

func spawn_shockwave_vfx(pos: Vector2, color: Color):
	var p = CPUParticles2D.new()
	p.global_position = pos
	p.amount = 50
	p.explosiveness = 1.0
	p.spread = 180.0
	p.gravity = Vector2(0, 500) # 파편이 아래로 떨어짐
	p.initial_velocity_min = 300.0
	p.initial_velocity_max = 600.0
	p.scale_amount_min = 4.0
	p.scale_amount_max = 12.0
	p.color = color
	p.one_shot = true
	add_cleanup_timer(p)

func spawn_burst_vfx(pos: Vector2, color: Color, amount: int):
	var p = CPUParticles2D.new()
	p.global_position = pos
	p.amount = amount
	p.explosiveness = 0.9
	p.spread = 180.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = 100.0
	p.initial_velocity_max = 300.0
	p.scale_amount_min = 2.0
	p.scale_amount_max = 6.0
	p.color = color
	p.one_shot = true
	add_cleanup_timer(p)

func spawn_vortex_vfx(pos: Vector2, color: Color):
	var p = CPUParticles2D.new()
	p.global_position = pos
	p.amount = 40
	p.lifetime = 0.5
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RING
	p.emission_ring_radius = 100.0
	p.gravity = Vector2.ZERO
	p.orbit_velocity_min = 2.0
	p.orbit_velocity_max = 5.0
	p.scale_amount_min = 3.0
	p.scale_amount_max = 8.0
	p.color = color
	p.one_shot = true
	add_cleanup_timer(p)

func add_cleanup_timer(node: Node):
	get_tree().current_scene.add_child(node)
	var t = get_tree().create_timer(1.5)
	t.timeout.connect(node.queue_free)
