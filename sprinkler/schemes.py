from typing import Optional
from decimal import Decimal

from ninja import Schema


class SprinklerForIntensityScheme(Schema):
    id: int
    name: str
    p_min: Decimal
    p_max: Decimal
    intensity: Decimal
    p_work: Decimal
    thermal_lock: str
    mounting_position: str
    K: Optional[Decimal]
