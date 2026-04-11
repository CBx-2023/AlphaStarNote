from datetime import datetime, timedelta, timezone
import os
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from api.user_db import User, user_db
from open_notebook.utils.encryption import get_secret_from_env

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("ALPHA_NOTE_JWT_EXPIRE_MINUTES", "10080"))
JWT_SECRET_ENV = "ALPHA_NOTE_JWT_SECRET"
FALLBACK_JWT_SECRET = "alpha-note-dev-secret"


def _get_jwt_secret() -> str:
    return (
        get_secret_from_env(JWT_SECRET_ENV)
        or get_secret_from_env("OPEN_NOTEBOOK_ENCRYPTION_KEY")
        or FALLBACK_JWT_SECRET
    )


def _looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "user_id": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)


def _decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])


class PasswordAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to check password authentication for all API requests.
    Always active with default password if OPEN_NOTEBOOK_PASSWORD is not set.
    Supports Docker secrets via OPEN_NOTEBOOK_PASSWORD_FILE.
    """

    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.password = get_secret_from_env("OPEN_NOTEBOOK_PASSWORD")
        self.excluded_paths = excluded_paths or [
            "/",
            "/health",
            "/docs",
            "/openapi.json",
            "/redoc",
        ]

    async def dispatch(self, request: Request, call_next):
        # Skip authentication if no password is set
        if not self.password:
            return await call_next(request)

        # Skip authentication for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)

        # Skip authentication for CORS preflight requests (OPTIONS)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check authorization header
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authorization header"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Expected format: "Bearer {password}"
        try:
            scheme, credentials = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                raise ValueError("Invalid authentication scheme")
        except ValueError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization header format"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        if credentials == self.password:
            return await call_next(request)

        if _looks_like_jwt(credentials):
            try:
                _decode_access_token(credentials)
                return await call_next(request)
            except jwt.PyJWTError:
                pass

        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid password"},
            headers={"WWW-Authenticate": "Bearer"},
        )


# Optional: HTTPBearer security scheme for OpenAPI documentation
security = HTTPBearer(auto_error=False)


def check_api_password(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> bool:
    """
    Utility function to check API password.
    Can be used as a dependency in individual routes if needed.
    Supports Docker secrets via OPEN_NOTEBOOK_PASSWORD_FILE.
    Returns True without checking credentials if OPEN_NOTEBOOK_PASSWORD is not configured.
    Raises 401 if credentials are missing or don't match the configured password.
    """
    password = get_secret_from_env("OPEN_NOTEBOOK_PASSWORD")

    # No password configured - skip authentication
    if not password:
        return True

    # No credentials provided
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check password
    if credentials.credentials != password:
        raise HTTPException(
            status_code=401,
            detail="Invalid password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[User]:
    if not credentials:
        return None

    token = credentials.credentials
    if not _looks_like_jwt(token):
        return None

    try:
        payload = _decode_access_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("user_id") or payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await user_db.get(user_id)
    if not user or not getattr(user, "is_active", False):
        raise HTTPException(
            status_code=401,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user(
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> User:
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def require_role(required_role):
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        role_value = (
            required_role.value if hasattr(required_role, "value") else str(required_role)
        )
        if current_user.role != role_value:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency
