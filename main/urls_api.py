from django.contrib.admin.views.decorators import staff_member_required
from ninja import NinjaAPI

from irrigation.views import router as irrigation_router
from tubes.views import router as tubes_router
from management_node.views import router as control_router

api = NinjaAPI(docs_decorator=staff_member_required, version="1.0.0")
api.add_router("/irrigation", irrigation_router)
api.add_router("/tubes", tubes_router)
api.add_router("/control-units", control_router)
