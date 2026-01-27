from django.shortcuts import render
from management_node.models import ControlUnit
from tubes.models import TubeType


def index(request):
    return render(request, "index.html", {})


def new_view(request):
    control_unit = ControlUnit.objects.all()
    tube_name = TubeType.objects.all()
    return render(request, 'new.html', {"view": "new",
                                        'control_unit': control_unit,
                                        'tube_name': tube_name})


def editor_view(request):
    return render(request, 'editor.html', {"view": "editor"})
