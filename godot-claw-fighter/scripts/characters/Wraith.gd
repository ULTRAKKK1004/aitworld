extends Fighter
class_name Wraith

# Wraith 특징: 2단 점프, 공중 대시, 특수기(은신/무적)

@export var max_jumps: int = 2
var current_jumps: int = 0
var is_stealthed: bool = false
var stealth_timer: float = 0.0

func _physics_process(delta):
	if is_stealthed:
		stealth_timer -= delta
		if stealth_timer <= 0:
			end_stealth()
			
	super._physics_process(delta)

# 점프 로직 오버라이드 (2단 점프)
func handle_jump():
	if is_on_floor():
		current_jumps = 0
		
	if Input.is_action_just_pressed("jump") and not is_attacking:
		if is_on_floor() or current_jumps < max_jumps:
			velocity.y = jump_velocity
			current_jumps += 1
			play_anim("jump" if current_jumps == 1 else "double_jump")

# 특수기: 무적 은신 및 회피
func execute_special():
	is_stealthed = true
	stealth_timer = 2.5
	
	if has_node("/root/EffectManager"):
		var em = get_node("/root/EffectManager")
		em.play_sound(self, "void_step")
		em.spawn_special_vfx("wraith", global_position, facing_right)
	
	modulate.a = 0.3
	
	# 무적 처리 (콜리전 레이어 비활성화 등)
	set_collision_layer_value(1, false)
	set_collision_mask_value(1, false)

func end_stealth():
	is_stealthed = false
	modulate.a = 1.0
	set_collision_layer_value(1, true)
	set_collision_mask_value(1, true)

# 은신 중 데미지 무시 오버라이드
func take_damage(amount: float, knockback_dir: Vector2):
	if is_stealthed:
		return
	super.take_damage(amount, knockback_dir)
