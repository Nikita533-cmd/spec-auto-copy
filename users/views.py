from django.contrib.auth import authenticate, login, logout
from django.shortcuts import redirect, render, get_object_or_404
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from weasyprint import HTML
import tempfile

from .models import User, CalculateResult
from .serializers import UserSerializer


class LoginAPI(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        if request.user.is_authenticated:
            serializer = UserSerializer(request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_401_UNAUTHORIZED)

    def post(self, request, *args, **kwargs):
        data = request.data

        username = data.get("username", None)
        password = data.get("password", None)

        user = authenticate(username=username, password=password)
        if user:
            login(request, user)
            serializer = UserSerializer(request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_400_BAD_REQUEST)


class LogoutAPI(APIView):
    permission_classes = [
        AllowAny,
    ]

    def post(self, request, *args, **kwargs):
        logout(request)
        return Response(status=status.HTTP_200_OK)


def login_as(request, user):
    if request.user.is_superuser:
        user = User.objects.get(pk=user)
        login(request, user)
    return redirect("/admin/")


class SaveCalculationResultAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data

        # Создаем запись с результатами расчета
        calculate_result = CalculateResult.objects.create(
            user=request.user if request.user.is_authenticated else None,
            data=data
        )

        return Response(
            {
                "id": str(calculate_result.id),
                "message": "Результаты успешно сохранены",
                "redirect_url": f"/users/calculation-result/{calculate_result.id}/pdf/"
            },
            status=status.HTTP_201_CREATED
        )


def calculation_result_view(request, result_id):
    """Отображение сохраненных результатов расчета"""
    result = get_object_or_404(CalculateResult, id=result_id)
    return render(request, 'users/calculation_result_pdf.html', {'result': result})


def calculation_result_pdf(request, result_id):
    """Экспорт результатов расчета в PDF"""
    result = get_object_or_404(CalculateResult, id=result_id)

    # Рендерим HTML шаблон
    html_string = render_to_string('users/calculation_result_pdf.html', {'result': result})

    # Создаем PDF из HTML
    try:
        # Создаем HTML объект и генерируем PDF
        html_obj = HTML(string=html_string, base_url=request.build_absolute_uri('/'))
        pdf_bytes = html_obj.write_pdf()
    except Exception as e:
        # В случае ошибки возвращаем сообщение с деталями
        import traceback
        error_detail = traceback.format_exc()
        return HttpResponse(f"Ошибка при генерации PDF: {str(e)}\n\n{error_detail}", status=500, content_type='text/plain')

    # Формируем имя файла
    filename = f"calculation_result_{result.id}.pdf"

    # Возвращаем PDF файл
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    return response
