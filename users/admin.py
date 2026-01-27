from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group
from .models import User, CalculateResult

admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(UserAdmin):
    model = User

    list_display = (
        "email",
        "last_name",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    list_filter = (
        "email",
        "is_staff",
        "is_active",
    )
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Персональные данные", {"fields": ("first_name", "parent_name", "last_name")}),
        (
            "Разрешения",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                )
            },
        ),
        ("Информация о входе", {"fields": ("last_login", "date_joined")}),
    )
    filter_horizontal = ("groups",)
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                    "is_superuser",
                ),
            },
        ),
    )
    search_fields = ("email",)
    ordering = ("email",)


@admin.register(CalculateResult)
class CalculateResultAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at")
    list_filter = ("created_at", "user")
    readonly_fields = ("id", "created_at", "data")
    search_fields = ("user__email", "user__last_name")
