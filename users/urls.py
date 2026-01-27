from django.contrib.admin.views.decorators import staff_member_required
from django.urls import path

from . import views
from .views import LoginAPI, LogoutAPI, SaveCalculationResultAPI

app_name = "auth"

urlpatterns = [
    path("login/", LoginAPI.as_view(), name="login"),
    path("logout/", LogoutAPI.as_view(), name="logout"),
    path("login-as/<int:user>/", staff_member_required(views.login_as), name="login_as"),
    path("save-calculation/", SaveCalculationResultAPI.as_view(), name="save_calculation"),
    path("calculation-result/<uuid:result_id>/", views.calculation_result_view, name="calculation_result"),
    path("calculation-result/<uuid:result_id>/pdf/", views.calculation_result_pdf, name="calculation_result_pdf"),
]
