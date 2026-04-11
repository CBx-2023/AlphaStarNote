"""
User manager: handles registration, password hashing, and user lifecycle.
"""

import base64
import hashlib
import hmac
import os
import secrets
from typing import Optional

from loguru import logger

from api.user_db import SurrealDBUserDatabase, User, UserCreate, UserRole, user_db

try:
    import bcrypt
except ImportError:  # pragma: no cover - exercised only in minimal envs
    bcrypt = None


PBKDF2_PREFIX = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 600_000


class UserManager:
    """Manages user registration, authentication, and lifecycle."""

    def __init__(self, db: SurrealDBUserDatabase):
        self.db = db

    def _get_registration_mode(self) -> str:
        """Get registration mode from environment variable."""
        return os.getenv("ALPHA_NOTE_REGISTRATION_MODE", "open").lower()

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        if bcrypt is not None:
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
            return hashed.decode("utf-8")

        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            PBKDF2_ITERATIONS,
        )
        return (
            f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$"
            f"{base64.b64encode(salt).decode('ascii')}$"
            f"{base64.b64encode(digest).decode('ascii')}"
        )

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        try:
            if hashed_password.startswith(f"{PBKDF2_PREFIX}$"):
                _, iterations, salt_b64, digest_b64 = hashed_password.split("$", 3)
                salt = base64.b64decode(salt_b64.encode("ascii"))
                expected = base64.b64decode(digest_b64.encode("ascii"))
                candidate = hashlib.pbkdf2_hmac(
                    "sha256",
                    plain_password.encode("utf-8"),
                    salt,
                    int(iterations),
                )
                return hmac.compare_digest(candidate, expected)

            if bcrypt is None:
                return False

            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        except Exception:
            return False

    async def create_user(
        self,
        user_create: UserCreate,
        is_admin_action: bool = False,
    ) -> User:
        """
        Create a new user.

        Args:
            user_create: User creation data
            is_admin_action: Whether this is being done by an admin (allows role setting)
        """
        # Check registration mode
        if not is_admin_action:
            mode = self._get_registration_mode()
            if mode == "disabled":
                raise ValueError("Registration is disabled")
            if mode == "invite":
                raise ValueError("Registration requires admin invitation")

        # Check if email already exists
        existing = await self.db.get_by_email(user_create.email)
        if existing:
            raise ValueError("A user with this email already exists")

        # Determine role
        role = UserRole.MEMBER.value
        if is_admin_action and user_create.role:
            # Validate role
            try:
                role = UserRole(user_create.role).value
            except ValueError:
                raise ValueError(f"Invalid role: {user_create.role}")

        # Hash password
        hashed_password = self.hash_password(user_create.password)

        # Create user record
        create_dict = {
            "email": user_create.email.lower().strip(),
            "hashed_password": hashed_password,
            "role": role,
            "is_active": True,
            "is_superuser": role == UserRole.ADMIN.value,
            "is_verified": is_admin_action,  # Auto-verify if created by admin
            "display_name": user_create.display_name,
        }

        user = await self.db.create(create_dict)
        logger.info(f"Created user {user.email} with role {user.role}")
        return user

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """
        Authenticate a user by email and password.
        Returns User if valid, None if invalid.
        """
        user = await self.db.get_by_email(email.lower().strip())
        if not user:
            return None

        if not user.is_active:
            return None

        if not self.verify_password(password, user.hashed_password):
            return None

        return user

    async def update_password(self, user_id: str, new_password: str) -> Optional[User]:
        """Update a user's password."""
        hashed = self.hash_password(new_password)
        return await self.db.update(user_id, {"hashed_password": hashed})

    async def ensure_admin_exists(self) -> None:
        """
        Ensure at least one admin user exists.
        Called during startup to create initial admin from env vars.
        """
        count = await self.db.count()
        if count > 0:
            return  # Users exist, skip

        # Get initial admin credentials from environment
        admin_email = os.getenv("ALPHA_NOTE_ADMIN_EMAIL", "admin@alpha-note.local")
        admin_password = os.getenv("ALPHA_NOTE_ADMIN_PASSWORD")

        # Fall back to legacy OPEN_NOTEBOOK_PASSWORD
        if not admin_password:
            from open_notebook.utils.encryption import get_secret_from_env

            admin_password = get_secret_from_env("OPEN_NOTEBOOK_PASSWORD")

        if not admin_password:
            admin_password = "admin"  # Default password, should be changed
            logger.warning(
                "No admin password configured! Using default 'admin'. "
                "Set ALPHA_NOTE_ADMIN_PASSWORD or OPEN_NOTEBOOK_PASSWORD to change."
            )

        try:
            admin_create = UserCreate(
                email=admin_email,
                password=admin_password,
                display_name="Administrator",
                role=UserRole.ADMIN.value,
            )
            await self.create_user(admin_create, is_admin_action=True)
            logger.success(
                f"Created initial admin user: {admin_email} "
                f"(password from {'env' if os.getenv('ALPHA_NOTE_ADMIN_PASSWORD') else 'default'})"
            )
        except Exception as e:
            logger.error(f"Failed to create initial admin user: {e}")
            raise


# Singleton instance
user_manager = UserManager(user_db)
