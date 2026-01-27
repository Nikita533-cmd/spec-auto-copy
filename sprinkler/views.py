from django.shortcuts import render

from .models import Sprinkler


def calc(request):
    sprinklers = Sprinkler.objects.all()
    return render(request, "calc.html", {"sprinklers": sprinklers})
