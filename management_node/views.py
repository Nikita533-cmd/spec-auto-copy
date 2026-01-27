from django.shortcuts import render
from django.http import JsonResponse
from .models import ControlUnit
from ninja import Router


router = Router()

@router.get("/list", response=list[dict])
def control_unit_list_json(request):
    data = list(ControlUnit.objects.values(
        "id",
        "diameter",
        "control_unit_name__name"
    ))
    return JsonResponse(data, safe=False)

