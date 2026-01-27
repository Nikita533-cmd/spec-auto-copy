from ninja import Router

from .schemes import IntensityIrrigationInputScheme
from .services import GraphData, IntensityIrrigation

router = Router(tags=["Irrigation"])


@router.post("intensity/", response=IntensityIrrigation)
def intensity_calc(request, data: IntensityIrrigationInputScheme):
    return IntensityIrrigation(**data.dict())


@router.get("graph-data/{sprinkler_id}/", response=GraphData)
def graph_data(request, sprinkler_id: int):
    return GraphData(sprinkler_id=sprinkler_id)
