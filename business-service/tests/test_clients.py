"""Pruebas del CRUD de clientes y sus validaciones."""

from tests.conftest import ApiHelper


def test_create_client_normalizes_and_returns_201(api: ApiHelper) -> None:
    response = api.request(
        "POST",
        "/api/clients",
        json={
            "name": "  Minera Andina  ",
            "identification_type": "NIT",
            "identification_number": " 900123456-1 ",
            "email": "Contacto@MineraAndina.CO",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Minera Andina"
    assert body["identification_number"] == "900123456-1"
    assert body["email"] == "contacto@mineraandina.co"
    assert body["is_active"] is True
    assert body["id"]


def test_rejects_duplicate_identification_number(api: ApiHelper) -> None:
    api.create_client(identification_number="ABC-123")
    response = api.request(
        "POST",
        "/api/clients",
        json={"name": "Otra", "identification_type": "CC", "identification_number": "abc-123",
              "email": "otra@correo.co"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_validation_errors_are_reported_per_field(api: ApiHelper) -> None:
    response = api.request(
        "POST", "/api/clients", json={"name": "X", "identification_type": "RUT", "email": "no-es-correo"}
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    fields = {d["field"] for d in error["details"]}
    assert {"name", "identification_type", "identification_number", "email"} <= fields


def test_get_client_and_not_found(api: ApiHelper) -> None:
    created = api.create_client()
    assert api.request("GET", f"/api/clients/{created['id']}").json()["id"] == created["id"]

    missing = api.request("GET", "/api/clients/00000000-0000-4000-8000-000000000000")
    assert missing.status_code == 404
    assert api.request("GET", "/api/clients/no-es-uuid").status_code == 422


def test_list_with_search_filter_and_pagination(api: ApiHelper) -> None:
    api.create_client(name="Minera Alfa")
    api.create_client(name="Minera Beta")
      # Correo distinto: la búsqueda también mira el correo y el de ejemplo contiene "minera".
    inactive = api.create_client(name="Transportes Gamma", email="logistica@gamma.co")
    api.request("PATCH", f"/api/clients/{inactive['id']}", json={"is_active": False})

    page = api.request("GET", "/api/clients", params={"size": 2, "page": 1}).json()
    assert page["total"] == 3
    assert page["pages"] == 2
    assert len(page["items"]) == 2

    search = api.request("GET", "/api/clients", params={"q": "minera"}).json()
    assert {c["name"] for c in search["items"]} == {"Minera Alfa", "Minera Beta"}

    only_inactive = api.request("GET", "/api/clients", params={"is_active": False}).json()
    assert [c["name"] for c in only_inactive["items"]] == ["Transportes Gamma"]


def test_update_client(api: ApiHelper) -> None:
    created = api.create_client()
    response = api.request(
        "PATCH", f"/api/clients/{created['id']}", json={"email": "nuevo@correo.co", "is_active": False}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "nuevo@correo.co"
    assert response.json()["is_active"] is False


def test_update_rejects_duplicates_empty_body_and_nulls(api: ApiHelper) -> None:
    first = api.create_client(identification_number="111")
    api.create_client(identification_number="222")
    url = f"/api/clients/{first['id']}"

    assert api.request("PATCH", url, json={"identification_number": "222"}).status_code == 409
    assert api.request("PATCH", url, json={}).status_code == 422
    assert api.request("PATCH", url, json={"name": None}).status_code == 422
    # Reenviar su propio número no es un conflicto.
    assert api.request("PATCH", url, json={"identification_number": "111"}).status_code == 200
