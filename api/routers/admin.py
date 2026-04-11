"""
Admin router for Alpha-Note API.
Provides endpoints for user management (admin only).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from pydantic import BaseModel, Field

from api.auth import require_role
from api.user_db import (
    User,
    UserAdminUpdate,
    UserCreate,
    UserRead,
    UserRole,
    user_db,
)
from api.user_manager import user_manager

router = APIRouter(prefix="/admin", tags=["admin"])


# Response models
class UserListResponse(BaseModel):
    users: List[UserRead]
    total: int


# Helper
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


@router.get("/users", response_model=UserListResponse)
async def list_users(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """List all users (admin only)."""
    users = await user_db.list_users(limit=limit, offset=offset)
    total = await user_db.count()
    return UserListResponse(
        users=[_user_to_read(u) for u in users],
        total=total,
    )


@router.get("/users/{user_id}", response_model=UserRead)
async def get_user(
    user_id: str,
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get a specific user by ID (admin only)."""
    user = await user_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_read(user)


@router.post("/users", response_model=UserRead)
async def create_user(
    user_create: UserCreate,
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Create a new user (admin only, bypasses registration mode)."""
    try:
        user = await user_manager.create_user(user_create, is_admin_action=True)
        return _user_to_read(user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user")


@router.put("/users/{user_id}", response_model=UserRead)
async def update_user(
    user_id: str,
    update: UserAdminUpdate,
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Update a user's role, status, or profile (admin only)."""
    user = await user_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if str(user.id) == str(admin.id) and update.role and update.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=400, detail="Cannot change your own role"
        )

    update_dict = {}

    if update.email is not None:
        existing = await user_db.get_by_email(update.email.lower().strip())
        if existing and str(existing.id) != str(user.id):
            raise HTTPException(status_code=400, detail="Email already in use")
        update_dict["email"] = update.email.lower().strip()

    if update.role is not None:
        try:
            role = UserRole(update.role)
            update_dict["role"] = role.value
            update_dict["is_superuser"] = role == UserRole.ADMIN
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {update.role}")

    if update.is_active is not None:
        # Prevent admin from disabling themselves
        if str(user.id) == str(admin.id) and not update.is_active:
            raise HTTPException(
                status_code=400, detail="Cannot disable your own account"
            )
        update_dict["is_active"] = update.is_active

    if update.is_verified is not None:
        update_dict["is_verified"] = update.is_verified

    if update.display_name is not None:
        update_dict["display_name"] = update.display_name

    if not update_dict:
        return _user_to_read(user)

    try:
        updated_user = await user_db.update(str(user.id), update_dict)
        if not updated_user:
            raise HTTPException(status_code=500, detail="Failed to update user")
        return _user_to_read(updated_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user")


@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: str,
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Disable a user account (admin only)."""
    user = await user_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    await user_db.update(str(user.id), {"is_active": False})
    return {"message": f"User {user.email} has been disabled"}


@router.post("/users/{user_id}/enable")
async def enable_user(
    user_id: str,
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Enable a user account (admin only)."""
    user = await user_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await user_db.update(str(user.id), {"is_active": True})
    return {"message": f"User {user.email} has been enabled"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Delete a user and all their data (admin only)."""
    user = await user_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    try:
        # TODO: In Phase 2, also delete all user-owned data (notebooks, sources, notes)
        await user_db.delete(str(user.id))
        return {"message": f"User {user.email} has been deleted"}
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user")
