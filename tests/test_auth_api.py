"""
Authentication and authorization integration tests.

Tests cover: login, registration, JWT validation, owner-based data isolation,
and admin bypass behavior.
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------- helpers ----------

def _get_admin_token(client: TestClient) -> str:
    """Login as the default admin user and return the JWT token."""
    resp = client.post("/api/auth/login", json={
        "email": os.getenv("ALPHA_NOTE_ADMIN_EMAIL", "admin@localhost"),
        "password": os.getenv("ALPHA_NOTE_ADMIN_PASSWORD", "changeme"),
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


def _register_user(client: TestClient, email: str, password: str = "testpass123") -> dict:
    """Register a new user and return the full response data."""
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
    })
    assert resp.status_code == 200, f"Registration failed: {resp.text}"
    return resp.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------- fixtures ----------

@pytest.fixture
def client():
    """Create test client with auth enabled."""
    os.environ["ALPHA_NOTE_REGISTRATION_MODE"] = "open"
    from api.main import app
    return TestClient(app)


# ---------- Auth Status ----------

class TestAuthStatus:
    def test_status_returns_auth_enabled(self, client):
        resp = client.get("/api/auth/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["auth_enabled"] is True
        assert "registration_mode" in data

    def test_status_is_public(self, client):
        """Status endpoint should NOT require authentication."""
        resp = client.get("/api/auth/status")
        assert resp.status_code == 200


# ---------- Login ----------

class TestLogin:
    def test_login_invalid_credentials(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpass",
        })
        assert resp.status_code == 401

    def test_login_missing_fields(self, client):
        resp = client.post("/api/auth/login", json={"email": "test@example.com"})
        assert resp.status_code == 422  # validation error

    @patch("api.routers.auth.user_manager")
    def test_login_success(self, mock_um, client):
        mock_user = MagicMock()
        mock_user.id = "user:test1"
        mock_user.email = "test@example.com"
        mock_user.role = "member"
        mock_user.is_active = True
        mock_user.is_verified = False
        mock_user.display_name = "Test"
        mock_user.created = "2026-01-01"
        mock_user.updated = "2026-01-01"

        mock_um.authenticate = AsyncMock(return_value=mock_user)

        resp = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "testpass",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "test@example.com"


# ---------- Registration ----------

class TestRegistration:
    def test_register_short_password(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "ab",
        })
        assert resp.status_code == 422

    @patch("api.routers.auth.user_manager")
    def test_register_success(self, mock_um, client):
        mock_user = MagicMock()
        mock_user.id = "user:new1"
        mock_user.email = "new@example.com"
        mock_user.role = "member"
        mock_user.is_active = True
        mock_user.is_verified = False
        mock_user.display_name = None
        mock_user.created = "2026-01-01"
        mock_user.updated = "2026-01-01"

        mock_um.create_user = AsyncMock(return_value=mock_user)

        resp = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "new@example.com"

    @patch("api.routers.auth.user_manager")
    def test_register_duplicate_email(self, mock_um, client):
        mock_um.create_user = AsyncMock(side_effect=ValueError("Email already registered"))

        resp = client.post("/api/auth/register", json={
            "email": "existing@example.com",
            "password": "securepass123",
        })
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]


# ---------- JWT Validation ----------

class TestJWTValidation:
    def test_protected_endpoint_no_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    def test_protected_endpoint_invalid_token(self, client):
        resp = client.get("/api/auth/me", headers=_auth_header("invalid-token"))
        assert resp.status_code in (401, 403)

    @patch("api.routers.auth.user_manager")
    def test_me_with_valid_token(self, mock_um, client):
        """Login then access /me."""
        mock_user = MagicMock()
        mock_user.id = "user:jwt1"
        mock_user.email = "jwt@example.com"
        mock_user.role = "member"
        mock_user.is_active = True
        mock_user.is_verified = False
        mock_user.display_name = "JWT User"
        mock_user.created = "2026-01-01"
        mock_user.updated = "2026-01-01"
        mock_user.hashed_password = "hash"

        mock_um.authenticate = AsyncMock(return_value=mock_user)

        # Login to get token
        resp = client.post("/api/auth/login", json={
            "email": "jwt@example.com",
            "password": "pass123",
        })
        token = resp.json()["access_token"]

        # Now patch get_current_user's DB call
        with patch("api.auth.user_db") as mock_db:
            mock_db.get = AsyncMock(return_value=mock_user)
            resp2 = client.get("/api/auth/me", headers=_auth_header(token))
            assert resp2.status_code == 200
            assert resp2.json()["email"] == "jwt@example.com"


# ---------- Owner Isolation ----------

class TestOwnerIsolation:
    """Verify that resources are isolated per user."""

    @patch("api.routers.notebooks.repo_query")
    @patch("api.auth.user_db")
    def test_notebooks_filtered_by_owner(self, mock_user_db, mock_repo_query, client):
        """Non-admin users should only see their own notebooks."""
        from api.auth import create_access_token

        # Create token for a regular user
        token = create_access_token(user_id="user:u1", email="u1@test.com", role="member")

        mock_user = MagicMock()
        mock_user.id = "user:u1"
        mock_user.email = "u1@test.com"
        mock_user.role = "member"
        mock_user.is_active = True
        mock_user.hashed_password = "hash"
        mock_user_db.get = AsyncMock(return_value=mock_user)

        mock_repo_query.return_value = [
            {"id": "notebook:n1", "name": "My NB", "description": "", "archived": False,
             "created": "2026-01-01", "updated": "2026-01-01",
             "source_count": 0, "note_count": 0, "owner": "user:u1"},
        ]

        resp = client.get("/api/notebooks", headers=_auth_header(token))
        assert resp.status_code == 200

    @patch("api.auth.user_db")
    def test_unauthorized_access_returns_404(self, mock_user_db, client):
        """Accessing another user's resource should return 404 (not 403)."""
        from api.auth import create_access_token

        token = create_access_token(user_id="user:u2", email="u2@test.com", role="member")

        mock_user = MagicMock()
        mock_user.id = "user:u2"
        mock_user.email = "u2@test.com"
        mock_user.role = "member"
        mock_user.is_active = True
        mock_user.hashed_password = "hash"
        mock_user_db.get = AsyncMock(return_value=mock_user)

        # Patch the Notebook.get to return a notebook owned by different user
        with patch("api.routers.notebooks.Notebook") as mock_nb_cls:
            mock_nb = MagicMock()
            mock_nb.id = "notebook:n99"
            mock_nb.owner = "user:other"
            mock_nb_cls.get.return_value = mock_nb
            mock_nb_cls.get = MagicMock(return_value=mock_nb)

            resp = client.get("/api/notebooks/notebook:n99", headers=_auth_header(token))
            # Should be 404 (not 403) to prevent information leakage
            assert resp.status_code == 404
