"""
Authentication router for Open Notebook API.
Provides endpoints for JWT-based login, registration, and current-user lookup.
"""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import create_access_token, get_current_user
from api.user_db import User, UserCreate, UserRead
from api.user_manager import user_manager
from open_notebook.utils.encryption import get_secret_from_env

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=3)
    display_name: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


def _user_to_read(user: User) -> UserRead:
    return UserRead(
        id=str(user.id),
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        display_name=user.display_name,
        created=str(user.created) if user.created else None,
        updated=str(user.updated) if user.updated else None,
    )


@router.get("/status")
async def get_auth_status():
    """
    Check if account authentication is enabled.
    Returns the registration mode and whether legacy password auth is also configured.
    """
    registration_mode = os.getenv("ALPHA_NOTE_REGISTRATION_MODE", "open").lower()
    legacy_password_enabled = bool(get_secret_from_env("OPEN_NOTEBOOK_PASSWORD"))

    return {
        "auth_enabled": True,
        "registration_mode": registration_mode,
        "legacy_password_enabled": legacy_password_enabled,
        "message": "Authentication is enabled",
    }


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    user = await user_manager.authenticate(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
    )
    return AuthResponse(access_token=token, user=_user_to_read(user))


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    try:
        user = await user_manager.create_user(
            UserCreate(
                email=request.email,
                password=request.password,
                display_name=request.display_name,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    token = create_access_token(
        user_id=str(user.id),
        email=user.email,
        role=user.role,
    )
    return AuthResponse(access_token=token, user=_user_to_read(user))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return _user_to_read(current_user)
