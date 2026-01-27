from adminsortable.models import SortableMixin as DefaultSortableMixin
from django.db import models
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer

from .renderers import PrintRenderer, XLSXRenderer


class NamedMixin(models.Model):
    name = models.CharField("Name", max_length=500)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ("name",)
        abstract = True


class ActiveQuerySet(models.QuerySet):
    def active_only(self):
        return self.filter(active=True)

    active_only.queryset_only = False

    def inactive_only(self):
        return self.exclude(active=True)

    inactive_only.queryset_only = False


class ActiveMixin(models.Model):
    active = models.BooleanField("Active", default=True)

    objects = ActiveQuerySet.as_manager()

    class Meta:
        ordering = ("name",)
        abstract = True


class SortableMixin(DefaultSortableMixin):
    order = models.PositiveIntegerField(default=0, editable=False, db_index=True)

    class Meta:
        abstract = True
        ordering = ("order",)


class SortableNamedMixin(SortableMixin, NamedMixin, ActiveMixin):
    class Meta:
        abstract = True


class SettingsModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        self.__class__.objects.exclude(id=self.id).delete()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    def __str__(self):
        return ""

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class DataListingMixin:
    """
    добавляет в ответ дрф листинга поля для показа заголовков таблицы и пагинации
    """

    def _pages_generator(self, pages, page):
        """
        список номеров страниц, которые мы показыаем в пагинаторе
        пример: 1, 2, 3, ... , 55, 56, 57, ...  90, 91
        """

        return [
            p
            for p in sorted(
                set(list(range(1, 4)) + list(range(page - 3, page + 3)) + list(range(pages - 3, pages + 1)))
            )
            if 0 < p <= pages
        ]

    def _has_add_perm(self) -> bool:
        qs = super().get_queryset()
        perms_code_name = f"{qs.model._meta.app_label}.add_{qs.model._meta.model_name}"
        user = self.request.user
        return user.is_authenticated and user.has_perm(perms_code_name)

    def list(self, request, *args, **kwargs):
        response = super().list(request, args, kwargs)
        results = response.data["results"]

        num_pages = self.paginator.page.paginator.num_pages
        page_number = self.paginator.page.number

        all_page = 7  # только не четные, количество показаных Page
        midl_page = int(all_page / 2) + 1
        if num_pages <= all_page or page_number <= midl_page:
            pages = [x for x in range(1, min(num_pages + 1, all_page + 1))]
        elif page_number > num_pages - midl_page:
            pages = [x for x in range(num_pages - (all_page - 1), num_pages + 1)]
        else:
            pages = [x for x in range(page_number - (midl_page - 1), page_number + midl_page)]

        response.data["meta"] = {
            "paginator": {
                "links": {
                    "previous": self.paginator.page.number - 1,
                    "next": self.paginator.page.number + 1,
                },
                "pages_visible": pages,
                "total": response.data["count"],
                "limit": self.paginator.get_page_size(request),
                "page": self.paginator.page.number,
                "last_page": self.paginator.page.paginator.num_pages,
                "has_next": self.paginator.page.has_next(),
                "has_previous": self.paginator.page.has_previous(),
                "page_sizes": [50, 100, 200, 500, 1000, 10000],
                "pages": self._pages_generator(self.paginator.page.paginator.num_pages, self.paginator.page.number),
                "show": len(results),
            },
            "has_add_perm": self._has_add_perm(),
        }

        return response


class PrintXLSXRendererMixin:
    renderer_classes = JSONRenderer, BrowsableAPIRenderer, PrintRenderer, XLSXRenderer

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.accepted_renderer.format == "xlsx":
            response["content-disposition"] = "attachment; filename=export.xlsx"
        return response
