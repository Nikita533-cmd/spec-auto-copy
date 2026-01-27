from django.contrib import admin

from .models import Sprinkler


@admin.register(Sprinkler)
class SprinklerAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "otv_type",
        "Pmin",
        "Pmax",
        "groups",
        "S",
        "thermal_lock",
        "mounting_position",
        "K",
    )
    list_editable = (
        "otv_type",
        "Pmin",
        "Pmax",
        "groups",
        "S",
        "thermal_lock",
        "mounting_position",
    )
    search_fields = ("name",)
    readonly_fields = (
        "intensity_Pmin",
        "intensity_Pmax",
    )
