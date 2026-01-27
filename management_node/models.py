from django.db import models


class InstallationType(models.TextChoices):
    SPRINKLER_WATER = "sprinkler_water", "Спринклерная водозаполненная"
    SPRINKLER_AIR = "sprinkler_air", "Спринклерная воздушная"
    DRENCH = "drench", "Дренчерная"


class ControlUnitName(models.Model):
    name = models.CharField(max_length=255, verbose_name="Наименование узла управления")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "наименование узла управления"
        verbose_name_plural = "наименование узлов управления"


class ControlUnit(models.Model):
    control_unit_name = models.ForeignKey(
        ControlUnitName,
        on_delete=models.CASCADE,
        verbose_name="Наименование узла управления",
        related_name="units"
    )
    designation = models.CharField(max_length=255, verbose_name="Обозначение узла управления")
    diameter = models.DecimalField(max_digits=10, decimal_places=1, verbose_name="Диаметр узла управления, DN, мм")
    pressure_loss = models.DecimalField(max_digits=15, decimal_places=15, verbose_name="Коэффициент потерь давления")
    installation_type = models.CharField(
        max_length=50,
        choices=InstallationType.choices,
        default=InstallationType.SPRINKLER_WATER,
        verbose_name="Тип установки"
    )

    def __str__(self):
        return f"{self.control_unit_name.name} ({self.designation})"

    class Meta:
        verbose_name = "узел управления"
        verbose_name_plural = "узлы управления"
