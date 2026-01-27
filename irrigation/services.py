import enum
import logging
from decimal import Decimal
from typing import List, Tuple
from pydantic import BaseModel, computed_field

from django.db.models import Q

from sprinkler.schemes import SprinklerForIntensityScheme

logger = logging.getLogger(__name__)


class ServiceException(Exception):
    pass


class Groups(enum.Enum):
    """
    группы помещений
    """

    one = "1"
    two = "2"
    three = "3"
    four_one = "4.1"
    four_two = "4.2"
    five = "5"
    six = "6"
    seven = "7"


class OTV(enum.Enum):
    water = "water"
    foam = "foam"
    water_plus = "water_plus"


IRRIGATION_INTENSIT_MATRIX_GROUP_1: Tuple[Tuple[float]] = (
    # гр     1     2     2     3     3   4.1   4.1   4.2
    # овт вода  вода  пена  вода  пена  вода  пена   пена
    (0.08, 0.12, 0.08, 0.24, 0.12, 0.30, 0.15, 0.17),  # <  10м
    (0.09, 0.13, 0.09, 0.26, 0.13, 0.33, 0.17, 0.20),  # <= 12м
    (0.10, 0.14, 0.10, 0.29, 0.14, 0.36, 0.18, 0.22),  # <= 14м
    (0.11, 0.16, 0.11, 0.31, 0.16, 0.39, 0.20, 0.25),  # <= 16м
    (0.12, 0.17, 0.12, 0.34, 0.17, 0.42, 0.21, 0.27),  # <= 18м
    (0.13, 0.18, 0.13, 0.36, 0.18, 0.45, 0.23, 0, 30),  # <= 20м
)

IRRIGATION_INTENSIT_MATRIX_GROUP_2: Tuple[Tuple[float]] = (
    # гр     5     5     6     6    7
    # овт вода  пена  вода  пена  пена
    (0.08, 0.04, 0.16, 0.08, 0.1),
    (0.16, 0.08, 0.32, 0.16, 0.2),
    (0.24, 0.12, 0.40, 0.24, 0.3),
    (0.32, 0.16, 0.45, 0.32, 0.4),
    (0.40, 0.32, 0.50, 0.40, 0.5),
)


class IntensityIrrigation(BaseModel):
    height: Decimal
    group: Groups
    otv: OTV
    sklad_height: Decimal = Decimal(0)
    thermal_lock: str = ""
    mounting_position: str = ""

    @computed_field
    @property
    def required_irrigation_intensity(self) -> Decimal:
        logger.debug(
            f"start calculate irrigation_intensity {self.height=}, {self.group=}, {self.otv=}, {self.sklad_height=}"
        )
        if self.group in (
            Groups.one,
            Groups.two,
            Groups.three,
            Groups.four_one,
            Groups.four_two,
        ):
            raw_value = self._get_raw_value_for_first_groups()
        elif self.group in (Groups.five, Groups.six, Groups.seven):
            raw_value = self._get_raw_value_for_last_groups()
        else:
            raise ValueError("Неверная группа помещений")
        if self.otv == OTV.water_plus:
            raw_value *= 2 / 3
        return Decimal(str(raw_value)).quantize(Decimal("1.00"))

    @computed_field
    @property
    def sprinklers(self) -> List[SprinklerForIntensityScheme]:
        from sprinkler.models import Sprinkler

        intensity = self.required_irrigation_intensity

        otv_type = self.otv.value
        if otv_type == OTV.water_plus.value:
            otv_type = OTV.water.value

        result = []
        sprinklers_qs = Sprinkler.objects.filter(groups__contains=[self.group.value])
        if self.thermal_lock:
            sprinklers_qs = sprinklers_qs.filter(Q(thermal_lock=self.thermal_lock) | Q(thermal_lock__isnull=True))
        if self.mounting_position:
            sprinklers_qs = sprinklers_qs.filter(Q(mounting_position=self.mounting_position) | Q(mounting_position__isnull=True))
        for data in sprinklers_qs.find_by_irrigation_intensity(intensity=intensity, otv_type=otv_type):
            sprinkler = data["sprinkler"]
            result.append(
                SprinklerForIntensityScheme(
                    id=sprinkler.id,
                    name=sprinkler.__str__(),
                    p_min=sprinkler.Pmin,
                    p_max=sprinkler.Pmax,
                    intensity=data["intensity"].quantize(Decimal("1.00")),
                    p_work=data["p_work"],
                    thermal_lock=sprinkler.thermal_lock,
                    mounting_position=sprinkler.mounting_position,
                    K=sprinkler.K,
                )
            )
        return result

    def _get_raw_Q(self) -> float:
        """
        Расход ОТВ для группы помещений, л/с
        """

        k = 1
        if self.otv == OTV.water_plus:
            # для установок пожаротушения, в которых используется вода
            # с добавкой смачивателя на основе пенообразователя общего назначения,
            # интенсивность орошения и расход принимаются в 1,5 раза меньше, чем для водяных
            k = 1.5

        if self.group == Groups.one:
            return 10 / k
        elif self.group == Groups.two:
            if self.otv == OTV.foam:
                return 20
            else:
                return 30 / k

        elif self.group == Groups.three:
            if self.otv == OTV.foam:
                return 30
            else:
                return 60 / k

        elif self.group == Groups.four_one:
            if self.otv == OTV.foam:
                return 55
            else:
                return 110 / k

        elif self.group == Groups.four_two:
            if self.otv == OTV.foam:
                return 65

        height_ranges = [
            (0, 1), (1, 2), (2, 3), (3, 4), (4, 5.5)
        ]

        flow_data = {
            Groups.five: {
                OTV.water: [15, 30, 45, 60, 75],
                OTV.foam: [7.5, 15.0, 22.5, 30.0, 37.5]
            },
            Groups.six: {
                OTV.water: [30, 60, 75, 85, 90],
                OTV.foam: [15, 30, 45, 55, 75]
            },
            Groups.seven: {
                OTV.foam: [18, 36, 54, 75, 90]
            }
        }

        # Поиск соответствующего индекса диапазона высот
        index = next((i for i, (low, high) in enumerate(height_ranges) if low < self.sklad_height <= high or (self.sklad_height == 1 and high == 1)), None)
        if index:
            try:
                return flow_data[self.group][self.otv][index] / k
            except KeyError:
                logger.error(f"Невозможно рассчитать расход: {self.group}, {self.otv}, {self.sklad_height}, {index}")
                pass
        else:
            logger.error(f"Невозможно рассчитать расход: {self.group}, {self.otv}, {self.sklad_height}, {index}")

        return None

    @computed_field
    @property
    def Q(self) -> int | None:
        """
        Расход ОТВ для группы помещений, л/с
        """

        if q := self._get_raw_Q():
            return int(q)
        return None


    @computed_field
    @property
    def S(self) -> int:
        """
        Минимальная площадь орошения для группы помещений, м2
        """

        if self.group == Groups.one:
            return 60
        elif self.group in (Groups.two, Groups.three):
            return 120
        elif self.group in (Groups.four_one, Groups.four_two):
            return 180
        elif self.group in (Groups.five, Groups.six, Groups.seven):
            return 90

    @computed_field
    @property
    def duration_min(self) -> int:
        """
        Продолжительность подачи воды, мин, не менее
        """

        if self.group == Groups.one:
            return 30
        return 60

    @computed_field
    @property
    def distance_max(self) -> float:
        """
        Максимальное расстояние между спринклерными оросителями, м
        """

        if self.group in (Groups.one, Groups.two, Groups.three, Groups.four_one):
            return 3.5
        return 3

    def _get_raw_value_for_first_groups(self) -> float:
        # определяем строку в матрице
        if self.height < 10:
            row = 0
        elif self.height <= 12:
            row = 1
        elif self.height <= 14:
            row = 2
        elif self.height <= 16:
            row = 3
        elif self.height <= 18:
            row = 4
        else:
            row = 5

        # определяем колонку в матрице
        match self.group, self.otv:
            case Groups.one, _:
                col = 0
            case Groups.two, OTV.water | OTV.water_plus:
                col = 1
            case Groups.two, OTV.foam:
                col = 2
            case Groups.three, OTV.water | OTV.water_plus:
                col = 3
            case Groups.three, OTV.foam:
                col = 4
            case Groups.four_one, OTV.water | OTV.water_plus:
                col = 5
            case Groups.four_one, OTV.foam:
                col = 6
            case Groups.four_two, _:
                col = 7
            case _, _:
                raise ValueError("Неправильные входные данные")

        logger.debug(f"first group, matrix: {row=} {col=}")

        return IRRIGATION_INTENSIT_MATRIX_GROUP_1[row][col]

    def _get_raw_value_for_last_groups(self) -> float:
        # определяем строку в матрице
        if self.sklad_height < 1:
            row = 0
        elif self.sklad_height <= 2:
            row = 1
        elif self.sklad_height <= 3:
            row = 2
        elif self.sklad_height <= 4:
            row = 3
        else:
            row = 4

        # определяем колонку в матрице
        match self.group, self.otv:
            case Groups.five, OTV.water | OTV.water_plus:
                col = 0
            case Groups.five, OTV.foam:
                col = 1
            case Groups.six, OTV.water | OTV.water_plus:
                col = 2
            case Groups.six, OTV.foam:
                col = 3
            case Groups.seven, OTV.foam:
                col = 4
            case _, _:
                raise ValueError("Неправильные входные данные")

        raw_value = IRRIGATION_INTENSIT_MATRIX_GROUP_2[row][col]
        logger.debug(f"second group, matrix: {row=} {col=}, {raw_value=}")

        if self.height > 10:
            k = 1 + 0.05 * (float(self.height) - 10)
            logger.debug(f"{self.height=} > 10, multiply on {k=}")
            raw_value *= k

        return raw_value


class GraphData(BaseModel):
    sprinkler_id: int

    @computed_field
    @property
    def data(self) -> List:
        from sprinkler.models import Sprinkler

        if sprinkler := Sprinkler.objects.filter(pk=self.sprinkler_id).first():
            return sprinkler.get_graph_data()
        return []
