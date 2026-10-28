"""Pruebas del CRUD de motores y sus reglas."""

from tests.conftest import ApiHelper


def test_create_engine_includes_owner_and_registration_date(api: ApiHelper) -> None:
    owner = api.create_client(name="Minera Alfa")
    engine = api.create_engine(client_id=owner["id"], serial_number="  cat-001 ")
    assert engine["serial_number"] == "CAT-001"
    assert engine["client"]["name"] == "Minera Alfa"
    assert engine["registered_at"]
    assert engine["is_active"] is True


def test_rejects_duplicate_serial_number_case_insensitive(api: ApiHelper) -> None:
    owner = api.create_client()
    api.create_engine(client_id=owner["id"], serial_number="KOM-555")
    response = api.request(
        "POST",
        "/api/engines",
        json={"serial_number": "kom-555", "manufacturer": "Komatsu", "model": "SAA12V140",
              "engine_type": "Diésel", "power": "1200 HP", "client_id": owner["id"]},
    )
    assert response.status_code == 409


def test_rejects_unknown_or_inactive_owner(api: ApiHelper) -> None:
    payload = {"serial_number": "X-1", "manufacturer": "MTU", "model": "16V4000", "engine_type": "Diésel",
               "power": "3000 kW", "client_id": "00000000-0000-4000-8000-000000000000"}
    assert api.request("POST", "/api/engines", json=payload).status_code == 404

    inactive = api.create_client()
    api.request("PATCH", f"/api/clients/{inactive['id']}", json={"is_active": False})
    response = api.request("POST", "/api/engines", json={**payload, "client_id": inactive["id"]})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "BUSINESS_RULE_VIOLATION"


def test_list_filters_by_client_and_search(api: ApiHelper) -> None:
    alfa = api.create_client(name="Alfa")
    beta = api.create_client(name="Beta")
    api.create_engine(client_id=alfa["id"], manufacturer="Caterpillar")
    api.create_engine(client_id=alfa["id"], manufacturer="Komatsu")
    api.create_engine(client_id=beta["id"], manufacturer="Cummins")

    by_client = api.request("GET", "/api/engines", params={"client_id": alfa["id"]}).json()
    assert by_client["total"] == 2

    by_text = api.request("GET", "/api/engines", params={"q": "cumm"}).json()
    assert [e["manufacturer"] for e in by_text["items"]] == ["Cummins"]


def test_update_engine_owner_and_rejects_duplicate_serial(api: ApiHelper) -> None:
    alfa = api.create_client()
    beta = api.create_client()
    engine = api.create_engine(client_id=alfa["id"], serial_number="E-1")
    api.create_engine(client_id=alfa["id"], serial_number="E-2")

    moved = api.request("PATCH", f"/api/engines/{engine['id']}", json={"client_id": beta["id"], "power": "2500 HP"})
    assert moved.status_code == 200
    assert moved.json()["client"]["id"] == beta["id"]
    assert moved.json()["power"] == "2500 HP"

    duplicate = api.request("PATCH", f"/api/engines/{engine['id']}", json={"serial_number": "e-2"})
    assert duplicate.status_code == 409


def test_get_engine_not_found(api: ApiHelper) -> None:
    assert api.request("GET", "/api/engines/00000000-0000-4000-8000-000000000000").status_code == 404
