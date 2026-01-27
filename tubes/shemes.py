from decimal import Decimal
from ninja import Schema


class TubeSchema(Schema):
    id: int
    nom_size: int
    ext_size: Decimal
    thickness: Decimal
    k_t: Decimal
