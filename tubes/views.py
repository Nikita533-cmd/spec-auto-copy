from typing import List
from ninja import Router, Schema
from .models import Type, TubeType
from .shemes import TubeSchema

router = Router(tags=["Tubes"])


class TubeTypeSchema(Schema):
    id: int
    name: str


@router.get("types/", response=List[TubeTypeSchema])
def tube_types_list(request):
    return TubeType.objects.all()


@router.get("list/", response=List[TubeSchema])
def tubes_list(request, type_id: int):
    data = Type.objects.filter(tube_type=type_id)
    return data
