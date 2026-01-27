from decimal import Decimal

from ninja import Schema

from .services import OTV, Groups


class IntensityIrrigationInputScheme(Schema):
    height: Decimal
    group: Groups
    otv: OTV
    sklad_height: Decimal = Decimal(0)
    thermal_lock: str | None
    mounting_position: str | None
