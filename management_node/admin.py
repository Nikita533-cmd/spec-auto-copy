from django.contrib import admin
from .models import ControlUnitName, ControlUnit

@admin.register(ControlUnitName)
class ControlUnitNameAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(ControlUnit)
class ControlUnitAdmin(admin.ModelAdmin):
    list_display = ("control_unit_name", "designation", "installation_type", "diameter", "pressure_loss")
    list_editable = ("installation_type", "designation", "diameter", "pressure_loss")
    list_filter = ("control_unit_name",)
    search_fields = ("control_unit_name__name", "designation")