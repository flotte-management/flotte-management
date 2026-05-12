from prometheus_client import Counter


MAINTENANCES_CREATED_TOTAL = Counter(
    "fleet_maintenances_created_total",
    "Nombre de maintenances creees",
)
MAINTENANCES_DELETED_TOTAL = Counter(
    "fleet_maintenances_deleted_total",
    "Nombre de maintenances supprimees",
)
MAINTENANCES_STATUS_CHANGED_TOTAL = Counter(
    "fleet_maintenances_status_changed_total",
    "Nombre de changements de statut de maintenance",
    ["status"],
)
MAINTENANCES_PIECES_ADDED_TOTAL = Counter(
    "fleet_maintenances_pieces_added_total",
    "Nombre de pieces ajoutees a une maintenance",
)
MAINTENANCES_PIECES_REMOVED_TOTAL = Counter(
    "fleet_maintenances_pieces_removed_total",
    "Nombre de pieces retirees d'une maintenance",
)


def record_maintenance_created() -> None:
    MAINTENANCES_CREATED_TOTAL.inc()


def record_maintenance_deleted() -> None:
    MAINTENANCES_DELETED_TOTAL.inc()


def record_maintenance_status_changed(status: str) -> None:
    MAINTENANCES_STATUS_CHANGED_TOTAL.labels(status=status).inc()


def record_piece_added() -> None:
    MAINTENANCES_PIECES_ADDED_TOTAL.inc()


def record_piece_removed() -> None:
    MAINTENANCES_PIECES_REMOVED_TOTAL.inc()

