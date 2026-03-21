extends CharacterBody2D
class_name Fighter

# 기본 능력치
@export var max_health: float = 100.0
@export var speed: float = 300.0
@export var jump_velocity: float = -500.0
@export var gravity: float = 980.0
@export var power: float = 10.0

var current_health: float
var skill_power: float = 0.0
var is_attacking: bool = false
var is_dead: bool = false
var facing_right: bool = true

@onready var animation_player = $AnimationPlayer
@onready var hit_box = $HitBox

func _ready():
	current_health = max_health

func _physics_process(delta):
	if is_dead:
		return
		
	handle_gravity(delta)
	handle_movement()
	handle_jump()
	handle_attacks()
	
	move_and_slide()

func handle_gravity(delta):
	if not is_on_floor():
		velocity.y += gravity * delta

func handle_movement():
	if is_attacking:
		velocity.x = move_toward(velocity.x, 0, speed)
		return
		
	var direction = Input.get_axis("move_left", "move_right")
	if direction:
		velocity.x = direction * speed
		update_facing(direction > 0)
		play_anim("run")
	else:
		velocity.x = move_toward(velocity.x, 0, speed)
		if is_on_floor():
			play_anim("idle")

func handle_jump():
	if Input.is_action_just_pressed("jump") and is_on_floor() and not is_attacking:
		velocity.y = jump_velocity
		play_anim("jump")

func handle_attacks():
	if is_attacking:
		return
		
	if Input.is_action_just_pressed("attack_punch"):
		perform_attack("punch")
	elif Input.is_action_just_pressed("attack_special") and skill_power >= 100:
		perform_attack("special")

func perform_attack(type: String):
	is_attacking = true
	if type == "punch":
		play_anim("punch")
	elif type == "special":
		skill_power = 0
		play_anim("special")
		execute_special()

# 애니메이션 플레이어에서 호출할 콜백 함수
func set_attacking_false():
	is_attacking = false

# 히트박스 충돌 감지 로직
func _on_hitbox_body_entered(body):
	if body != self and body.has_method("take_damage"):
		var knockback = Vector2.RIGHT if facing_right else Vector2.LEFT
		body.take_damage(power, knockback)

# 캐릭터별로 오버라이드할 특수기 함수
func execute_special():
	pass

func update_facing(right: bool):
	if facing_right != right:
		facing_right = right
		scale.x = -1 # 캐릭터 좌우 반전

func play_anim(anim_name: String):
	if animation_player and animation_player.has_animation(anim_name):
		animation_player.play(anim_name)

func take_damage(amount: float, knockback_dir: Vector2):
	current_health -= amount
	velocity = knockback_dir * 300 # 피격 밀림
	
	# --- 게임성(Juice) 효과 적용 ---
	# 1. 히트 플래시 (순간적으로 하얗게 번쩍임)
	modulate = Color(10, 10, 10, 1) # HDR Color를 활용한 발광 효과
	var flash_timer = get_tree().create_timer(0.05)
	flash_timer.timeout.connect(func(): modulate = Color(1, 1, 1, 1))
	
	# 2. 히트스톱 및 화면 흔들림 호출 (EffectManager가 Autoload로 등록되어 있다고 가정)
	if has_node("/root/EffectManager"):
		var hit_type = "heavy" if amount > 15 else "light"
		get_node("/root/EffectManager").trigger_impact(hit_type)
		get_node("/root/EffectManager").spawn_hit_spark(global_position + Vector2(0, -50), Color(1, 0.8, 0)) # 노란색 불꽃
	
	if current_health <= 0:
		die()

func die():
	is_dead = true
	play_anim("death")
