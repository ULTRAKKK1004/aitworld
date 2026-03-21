extends Fighter
class_name Volt

# Volt 특징: 원거리 전기 투사체 발사, 공중 부양

@export var projectile_scene: PackedScene # 에디터에서 전기 구체 씬 할당
var hover_timer: float = 0.0

func _physics_process(delta):
	# 특수키 꾹 누를 시 공중 부양
	if Input.is_action_pressed("jump") and not is_on_floor() and hover_timer > 0:
		velocity.y = 0
		hover_timer -= delta
		play_anim("hover")
	else:
		if is_on_floor():
			hover_timer = 2.0 # 체공 가능 시간 리셋
			
	super._physics_process(delta)

# 특수기: 플라즈마 볼트 (투사체 발사)
func execute_special():
	if projectile_scene:
		var proj = projectile_scene.instantiate()
		proj.global_position = global_position + Vector2(50 if facing_right else -50, 0)
		proj.direction = Vector2.RIGHT if facing_right else Vector2.LEFT
		proj.damage = power * 1.5
		
		# 최상위 노드에 추가
		get_tree().current_scene.add_child(proj)
