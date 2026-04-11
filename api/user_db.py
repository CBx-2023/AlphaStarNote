"""
User model and SurrealDB user database adapter for fastapi-users.
Implements BaseUserDatabase interface using the existing repo_* functions.
"""

from datetime import datetime
from enum import Enum
from typing import Any, ClassVar, Dict, List, Optional, Type, TypeVar

from loguru import logger
from pydantic import BaseModel, ConfigDict, Field, field_validator

from open_notebook.database.repository import (
    ensure_record_id,
    repo_create,
    repo_delete,
    repo_query,
    repo_update,
)


class UserRole(str, Enum):
    """User roles for RBAC"""

    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class UserRead(BaseModel):
    """User response model (safe to expose to clients)"""

    id: str
    email: str
    role: str = UserRole.MEMBER.value
    is_active: bool = True
    is_verified: bool = False
    display_name: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None


class UserCreate(BaseModel):
    """User creation request model"""

    email: str
    password: str
    display_name: Optional[str] = None
    role: Optional[str] = None  # Only admin can set this


class UserUpdate(BaseModel):
    """User update request model"""

    email: Optional[str] = None
    password: Optional[str] = None
    display_name: Optional[str] = None


class UserAdminUpdate(BaseModel):
    """Admin user update request model"""

    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    display_name: Optional[str] = None


class User(BaseModel):
    """Internal user model with all fields"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    hashed_password: str
    role: str = UserRole.MEMBER.value
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = False
    display_name: Optional[str] = None
    created: Optional[Any] = None
    updated: Optional[Any] = None

    @field_validator("id", mode="before")
    @classmethod
    def parse_id(cls, value):
        return str(value) if value else None


class SurrealDBUserDatabase:
    """
    SurrealDB user database adapter.
    Implements user CRUD operations using existing repo_* functions.
    """

    async def get(self, user_id: str) -> Optional[User]:
        """Get a user by ID"""
        try:
            result = await repo_query(
                "SELECT * FROM $id", {"id": ensure_record_id(user_id)}
            )
            if result:
                return User(**result[0])
            return None
        except Exception as e:
            logger.error(f"Error fetching user by id {user_id}: {e}")
            return None

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get a user by email"""
        try:
            result = await repo_query(
                "SELECT * FROM user WHERE email = $email", {"email": email}
            )
            if result:
                return User(**result[0])
            return None
        except Exception as e:
            logger.error(f"Error fetching user by email {email}: {e}")
            return None

    async def create(self, create_dict: Dict[str, Any]) -> User:
        """Create a new user"""
        try:
            result = await repo_create("user", create_dict)
            if isinstance(result, list):
                return User(**result[0])
            return User(**result)
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise

    async def update(self, user_id: str, update_dict: Dict[str, Any]) -> Optional[User]:
        """Update a user"""
        try:
            await repo_update("user", user_id, update_dict)
            return await self.get(user_id)
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {e}")
            raise

    async def delete(self, user_id: str) -> None:
        """Delete a user"""
        try:
            await repo_delete(user_id)
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {e}")
            raise

    async def list_users(self, limit: int = 100, offset: int = 0) -> List[User]:
        """List all users with pagination"""
        try:
            result = await repo_query(
                "SELECT * FROM user ORDER BY created DESC LIMIT $limit START $offset",
                {"limit": limit, "offset": offset},
            )
            return [User(**row) for row in result]
        except Exception as e:
            logger.error(f"Error listing users: {e}")
            return []

    async def count(self) -> int:
        """Count total users"""
        try:
            result = await repo_query(
                "SELECT count() as total FROM user GROUP ALL"
            )
            return result[0]["total"] if result else 0
        except Exception as e:
            logger.error(f"Error counting users: {e}")
            return 0


# Singleton instance
user_db = SurrealDBUserDatabase()
