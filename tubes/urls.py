from django.contrib.admin.views.decorators import staff_member_required
from django.urls import path
from ninja import NinjaAPI

from .views import router

api = NinjaAPI(docs_decorator=staff_member_required, version="1.0.0")
api.add_router("/", router)


urlpatterns = [
    path("", api.urls),
]
