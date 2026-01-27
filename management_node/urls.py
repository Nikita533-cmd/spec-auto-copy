from django.urls import path
from .views import control_unit_list_json

urlpatterns = [
    path('api/control-units/', control_unit_list_json, name='control-unit-list-json'),
]