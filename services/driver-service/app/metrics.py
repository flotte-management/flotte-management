from prometheus_client import Gauge


DRIVERS_ACTIVE = Gauge(
    "fleet_drivers_active",
    "Nombre de conducteurs actifs",
)


def set_drivers_active(count: int) -> None:
    DRIVERS_ACTIVE.set(count)

