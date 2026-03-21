extends Node2D

@onready var main_camera = $Camera2D

func _ready():
	# 게임이 시작될 때 EffectManager에 현재 씬의 카메라를 등록하여
	# 화면 흔들림(Screen Shake) 효과가 작동하도록 합니다.
	if has_node("/root/EffectManager"):
		get_node("/root/EffectManager").camera = main_camera
