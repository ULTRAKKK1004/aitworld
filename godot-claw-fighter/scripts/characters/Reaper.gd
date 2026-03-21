extends Fighter
class_name Reaper

# Reaper 특징: 거대한 낫 공격, 공격 성공 시 체력 흡수(흡혈)

@export var lifesteal_ratio: float = 0.3 # 데미지의 30% 흡혈

# 특수기: 소울 드레인 (광범위 낫 공격)
func execute_special():
	# 히트박스를 매우 크게 키움
	if hit_box:
		hit_box.scale = Vector2(2.5, 2.5) 
	
	play_anim("soul_drain")
	# 이 애니메이션이 끝날 때 hit_box.scale 을 원래대로 복구하는 것을 AnimationPlayer에서 처리해야 함

# 다른 노드(HitBox Area2D)에서 적을 타격했을 때 호출되도록 설계
func on_attack_hit(target: Node, damage_dealt: float):
	# 데미지 처리 (타겟의 take_damage 호출 등은 HitBox에서 한다고 가정)
	
	# 흡혈 로직
	if current_health < max_health:
		current_health += damage_dealt * lifesteal_ratio
		current_health = min(current_health, max_health) # 최대 체력 초과 방지
		
		# 흡혈 이펙트 생성 (초록색 텍스트 팝업이나 파티클)
