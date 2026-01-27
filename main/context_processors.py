from typing import Any

from main.models import SEOSettings


def default(request) -> dict[str, Any]:
    seo_settings = SEOSettings.load()
    print(f"{seo_settings.meta_tags=}")
    return {
        "seo_settings": seo_settings,
    }
