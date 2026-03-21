extends Fighter
class_name Vanguard

# Vanguard 특징: 빠른 대시와 검(Sword)을 활용한 약간 긴 리치의 기본 공격

@export var dash_speed: float = 800.0
@export var dash_duration: float = 0.2
var is_dashing: bool = false
var dash_timer: float = 0.0

func _physics_process(delta):
	if is_dead: return
	
	if is_dashing:
		handle_dash(delta)
		move_and_slide()
		return
		
	# 부모 클래스의 물리 처리 호출
	super._physics_process(delta)
	
	# 대시 입력 처리 (특수키와 다르게 특정 키나 더블탭으로 구현 가능하지만, 여기선 특수기로 대시+공격 연계 구현)

func handle_dash(delta):
	dash_timer -= delta
	velocity.y = 0 # 대시 중에는 중력 무시
	velocity.x = dash_speed if facing_right else -dash_speed
	
	if dash_timer <= 0:
		is_dashing = false
		velocity.x = 0

# 오버라이드: 특수기 - 사이버 슬래시 (전방으로 빠르게 대시하며 베기)
func execute_special():
	is_dashing = true
	dash_timer = dash_duration
	play_anim("special_slash")
	
	if has_node("/root/EffectManager"):
		var em = get_node("/root/EffectManager")
		em.play_sound(self, "cyber_slash")
		em.spawn_special_vfx("vanguard", global_position, facing_right)
	
	if hit_box:
		hit_box.scale.x = 1.5
