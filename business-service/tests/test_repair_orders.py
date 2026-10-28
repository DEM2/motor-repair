"""Pruebas de órdenes de reparación: creación, reglas de negocio y ciclo de vida completo."""

from datetime import date, timedelta

from tests.conftest import ApiHelper, make_token


def test_create_order_derives_owner_numbers_and_audits(api: ApiHelper, client) -> None:
    owner = api.create_client(name="Minera Alfa")
    engine = api.create_engine(client_id=owner["id"])

    token = make_token(sub="user-123", email="ana@taller.local")
    response = client.post(
        "/api/repair-orders",
        headers={"Authorization": f"Bearer {token}"},
        json={"engine_id": engine["id"], "reception_date": "2026-03-01", "estimated_delivery_date": "2026-03-20",
              "reported_problem": "Sobrecalentamiento", "technician": "Carlos Pérez"},
    )
    assert response.status_code == 201, response.text
    order = response.json()

    assert order["order_number"] == "OT-2026-000001"
    assert order["status"] == "RECEIVED"
    assert order["client_id"] == owner["id"]  # el cliente se toma del propietario del motor
    assert order["created_by_user_id"] == "user-123"
    assert order["allowed_next_statuses"] == ["IN_DIAGNOSIS"]
    assert len(order["status_history"]) == 1
    assert order["status_history"][0]["from_status"] is None
    assert order["status_history"][0]["to_status"] == "RECEIVED"
    assert order["status_history"][0]["changed_by_email"] == "ana@taller.local"


def test_order_numbers_are_sequential(api: ApiHelper) -> None:
    first = api.create_order()
    second = api.create_order()
    assert first["order_number"].endswith("000001")
    assert second["order_number"].endswith("000002")


def test_rejects_invalid_dates(api: ApiHelper) -> None:
    engine = api.create_engine()
    base = {"engine_id": engine["id"], "reported_problem": "Falla", "technician": "Carlos Pérez"}

    before = api.request("POST", "/api/repair-orders",
                         json={**base, "reception_date": "2026-03-10", "estimated_delivery_date": "2026-03-01"})
    assert before.status_code == 422

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    future = api.request("POST", "/api/repair-orders",
                         json={**base, "reception_date": tomorrow, "estimated_delivery_date": tomorrow})
    assert future.status_code == 422


def test_rejects_unknown_or_inactive_engine(api: ApiHelper) -> None:
    missing = api.request("POST", "/api/repair-orders", json={
        "engine_id": "00000000-0000-4000-8000-000000000000", "reported_problem": "Falla",
        "technician": "Carlos Pérez", "estimated_delivery_date": date.today().isoformat()})
    assert missing.status_code == 404

    engine = api.create_engine()
    api.request("PATCH", f"/api/engines/{engine['id']}", json={"is_active": False})
    inactive = api.request("POST", "/api/repair-orders", json={
        "engine_id": engine["id"], "reported_problem": "Falla", "technician": "Carlos Pérez",
        "estimated_delivery_date": date.today().isoformat()})
    assert inactive.status_code == 409


def test_engine_cannot_have_two_open_orders(api: ApiHelper) -> None:
    engine = api.create_engine()
    api.create_order(engine_id=engine["id"])
    response = api.request("POST", "/api/repair-orders", json={
        "engine_id": engine["id"], "reported_problem": "Otra falla", "technician": "Carlos Pérez",
        "reception_date": "2026-01-10", "estimated_delivery_date": "2026-01-30"})
    assert response.status_code == 409
    assert "orden de reparación abierta" in response.json()["error"]["message"]


def test_full_lifecycle_with_business_rules(api: ApiHelper) -> None:
    order = api.create_order()
    url = f"/api/repair-orders/{order['id']}/status"

    # No se puede saltar estados.
    skip = api.request("PATCH", url, json={"status": "IN_REPAIR"})
    assert skip.status_code == 409
    assert skip.json()["error"]["details"]["allowed"] == ["IN_DIAGNOSIS"]

    assert api.request("PATCH", url, json={"status": "IN_DIAGNOSIS"}).status_code == 200

    # Sin diagnóstico no se puede pedir aprobación.
    assert api.request("PATCH", url, json={"status": "AWAITING_APPROVAL"}).status_code == 409
    approved = api.request("PATCH", url, json={
        "status": "AWAITING_APPROVAL", "diagnosis": "Desgaste de anillos y camisas", "note": "Cotización enviada"})
    assert approved.status_code == 200
    assert approved.json()["diagnosis"] == "Desgaste de anillos y camisas"

    assert api.request("PATCH", url, json={"status": "IN_REPAIR"}).status_code == 200
    assert api.request("PATCH", url, json={"status": "IN_TESTING"}).status_code == 200

    # Si las pruebas fallan, puede volver a reparación.
    back = api.request("PATCH", url, json={"status": "IN_REPAIR", "note": "Fuga en banco de pruebas"})
    assert back.status_code == 200
    assert api.request("PATCH", url, json={"status": "IN_TESTING"}).status_code == 200

    # Sin trabajo realizado no se puede finalizar.
    assert api.request("PATCH", url, json={"status": "COMPLETED"}).status_code == 409
    completed = api.request("PATCH", url, json={"status": "COMPLETED", "work_performed": "Overhaul completo"})
    assert completed.status_code == 200
    assert completed.json()["actual_delivery_date"] is None

    delivered = api.request("PATCH", url, json={"status": "DELIVERED", "actual_delivery_date": "2026-01-28"})
    assert delivered.status_code == 200
    body = delivered.json()
    assert body["status"] == "DELIVERED"
    assert body["actual_delivery_date"] == "2026-01-28"
    assert body["allowed_next_statuses"] == []

    history = [(h["from_status"], h["to_status"]) for h in body["status_history"]]
    assert history == [
        (None, "RECEIVED"),
        ("RECEIVED", "IN_DIAGNOSIS"),
        ("IN_DIAGNOSIS", "AWAITING_APPROVAL"),
        ("AWAITING_APPROVAL", "IN_REPAIR"),
        ("IN_REPAIR", "IN_TESTING"),
        ("IN_TESTING", "IN_REPAIR"),
        ("IN_REPAIR", "IN_TESTING"),
        ("IN_TESTING", "COMPLETED"),
        ("COMPLETED", "DELIVERED"),
    ]
    assert body["status_history"][2]["note"] == "Cotización enviada"

    # Estado final: no admite más cambios.
    assert api.request("PATCH", url, json={"status": "RECEIVED"}).status_code == 409

    # Tras la entrega, el motor puede recibir una nueva orden.
    api.create_order(engine_id=order["engine"]["id"])


def test_delivery_date_rules(api: ApiHelper) -> None:
    order = api.create_order(diagnosis="Diagnóstico inicial", work_performed="Cambio de inyectores")
    url = f"/api/repair-orders/{order['id']}/status"

    # La fecha real de entrega solo se envía al entregar.
    early = api.request("PATCH", url, json={"status": "IN_DIAGNOSIS", "actual_delivery_date": "2026-01-20"})
    assert early.status_code == 409

    for status in ("IN_DIAGNOSIS", "AWAITING_APPROVAL", "IN_REPAIR", "IN_TESTING", "COMPLETED"):
        assert api.request("PATCH", url, json={"status": status}).status_code == 200

    before_reception = api.request("PATCH", url, json={"status": "DELIVERED", "actual_delivery_date": "2026-01-01"})
    assert before_reception.status_code == 409

    # Si no se envía la fecha, se registra la fecha actual.
    delivered = api.request("PATCH", url, json={"status": "DELIVERED"})
    assert delivered.json()["actual_delivery_date"] == date.today().isoformat()


def test_list_filters_search_and_summary(api: ApiHelper) -> None:
    alfa = api.create_client(name="Minera Alfa")
    beta = api.create_client(name="Carbones Beta")
    engine_a = api.create_engine(client_id=alfa["id"], serial_number="ALFA-1")
    engine_b = api.create_engine(client_id=beta["id"], serial_number="BETA-1")
    order_a = api.create_order(engine_id=engine_a["id"])
    api.create_order(engine_id=engine_b["id"], technician="Laura Gómez")
    api.request("PATCH", f"/api/repair-orders/{order_a['id']}/status", json={"status": "IN_DIAGNOSIS"})

    def ids(params: dict) -> list[str]:
        return [o["order_number"] for o in api.request("GET", "/api/repair-orders", params=params).json()["items"]]

    assert ids({"status": "IN_DIAGNOSIS"}) == [order_a["order_number"]]
    assert ids({"client_id": alfa["id"]}) == [order_a["order_number"]]
    assert len(ids({"engine_id": engine_b["id"]})) == 1
    assert len(ids({"q": "beta-1"})) == 1  # por serie del motor
    assert len(ids({"q": "carbones"})) == 1  # por nombre del cliente
    assert len(ids({"q": "laura"})) == 1  # por técnico
    assert len(ids({})) == 2

    summary = api.request("GET", "/api/repair-orders/summary").json()
    assert summary["total"] == 2
    assert summary["by_status"]["RECEIVED"] == 1
    assert summary["by_status"]["IN_DIAGNOSIS"] == 1
    assert summary["by_status"]["DELIVERED"] == 0
    assert len(summary["by_status"]) == 7


def test_invalid_status_value_is_rejected(api: ApiHelper) -> None:
    order = api.create_order()
    response = api.request("PATCH", f"/api/repair-orders/{order['id']}/status", json={"status": "PERDIDO"})
    assert response.status_code == 422
