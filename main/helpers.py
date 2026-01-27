import re

from django.core.paginator import InvalidPage
from rest_framework.authentication import SessionAuthentication
from rest_framework.pagination import PageNumberPagination


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return


class DefaultApiPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "limit"
    max_page_size = 100000

    def paginate_queryset(self, queryset, request, view=None):
        page_size = self.get_page_size(request)

        if request.GET.get("format") in ("print", "xlsx"):
            page_size = self.max_page_size

        if not page_size:
            return None

        paginator = self.django_paginator_class(queryset, page_size)
        page_number = request.query_params.get(self.page_query_param, 1)
        if page_number in self.last_page_strings:
            page_number = paginator.num_pages

        try:
            self.page = paginator.page(page_number)
        except InvalidPage:
            self.page = paginator.page(1)

        if paginator.num_pages > 1 and self.template is not None:
            self.display_page_controls = True

        self.request = request
        return list(self.page)


def format_thousands(value: int) -> str:
    """добавляет пробелы для разделения тысяч"""
    orig = str(value)
    new = re.sub(r"^(-?\d+)(\d{3})", r"\g<1> \g<2>", orig)
    if new == orig:
        return new
    else:
        return format_thousands(new)


def limit_string(value: str, limit: int) -> str:
    if len(value) < limit:
        return value
    return value[:limit] + "..."
