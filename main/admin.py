from django.urls import path
from django.shortcuts import redirect
from django.contrib import admin

from .models import SEOSettings


class SettingsAdminMixin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [path("", self.admin_site.admin_view(self.change_view), {"object_id": "1"})]
        return custom_urls + urls

    def response_change(self, request, obj):
        if not request.POST.get("_continue"):
            return redirect("/admin/")
        return super().response_change(request, obj)

    def get_object(self, *args, **kwargs):
        return self.model.load()


@admin.register(SEOSettings)
class SEOSettingssAdmin(SettingsAdminMixin, admin.ModelAdmin):
    pass
