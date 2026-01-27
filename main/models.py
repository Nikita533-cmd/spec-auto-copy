from django.db import models
from .mixins import SettingsModel


class SEOSettings(SettingsModel):
    meta_tags = models.TextField("META тэги", default=str, blank=True)
    counters = models.TextField("Счетчики", default=str, blank=True)

    class Meta:
        verbose_name = verbose_name_plural = "Настройки SEO"
