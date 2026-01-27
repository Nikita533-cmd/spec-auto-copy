from django.core.exceptions import ValidationError


def only_digits_validator(value) -> str:
    if not value.isdigit():
        raise ValidationError("Разрешены только цифры")
    return value


def cadastre_number_validator(value) -> str:
    return value
