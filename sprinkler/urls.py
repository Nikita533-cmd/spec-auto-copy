from django.urls import path

from . import views

app_name = "sprinkler"


urlpatterns = [
    path("calc/", views.calc),
]
