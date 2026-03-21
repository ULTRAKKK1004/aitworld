extends Fighter
class_name Colossus

# Colossus 특징: 느림, 강한 파워, 슈퍼 아머(피격 시 안 밀림), 지진 공격

@export var super_armor_active: bool = false

func _ready():
	super._ready()
	speed = 150.0 # 느린 이동 속도
	power = 25.0  # 강한 공격력
	max_health = 150.0 # 높은 체력
	current_health = max_health

# 특수기: 그라운드 스매시
func execute_special():
	# 강하게 아래로 내려찍는 모션
	velocity.y = 800 # 빠르게 낙하
	play_anim("ground_smash")
	
func _physics_process(delta):
	super._physics_process(delta)
	
	# 그라운드 스매시 착지 판정
	if is_attacking and animation_player.current_animation == "ground_smash" and is_on_floor():
		create_earthquake()
		is_attacking = false # 공격 종료

func create_earthquake():
	if has_node("/root/EffectManager"):
		var em = get_node("/root/EffectManager")
		em.play_sound(self, "ground_smash")
		em.spawn_special_vfx("colossus", global_position, facing_right)
		em.trigger_impact("special") # 강한 흔들림 및 히트스톱


# 피격 처리 오버라이드: 슈퍼 아머 (공격 중 밀리지 않음)
func take_damage(amount: float, knockback_dir: Vector2):
	current_health -= amount
	
	# 공격 중이거나 슈퍼아머 상태면 넉백 무시
	if not is_attacking:
		velocity = knockback_dir * 100 # 밀림도 적게 받음
		
	if current_health <= 0:
		die()
