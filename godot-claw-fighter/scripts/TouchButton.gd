extends Control
class_name TouchButton

@export var action_name: String = ""
@export var button_color: Color = Color(1, 1, 1, 0.5)

var touch_index: int = -1

func _draw():
	# 간단한 사각형 버튼 시각화 (실제로는 Sprite나 Patch9Rect 사용 권장)
	draw_rect(Rect2(Vector2.ZERO, size), button_color, true)
	draw_string(ThemeDB.get_default_font(), size / 2, action_name, HORIZONTAL_ALIGNMENT_CENTER)

func _gui_input(event):
	if event is InputEventScreenTouch:
		if event.pressed and touch_index == -1:
			# 버튼 영역 내에서 터치가 시작됨
			touch_index = event.index
			Input.action_press(action_name)
			button_color.a = 0.8
			queue_redraw()
		elif not event.pressed and event.index == touch_index:
			# 해당 인덱스의 손가락이 떼어짐
			touch_index = -1
			Input.action_release(action_name)
			button_color.a = 0.5
			queue_redraw()
	
	if event is InputEventScreenDrag and event.index == touch_index:
		# 손가락이 버튼 밖으로 나갔는지 체크
		if not get_rect().has_point(event.position + global_position):
			touch_index = -1
			Input.action_release(action_name)
			button_color.a = 0.5
			queue_redraw()
