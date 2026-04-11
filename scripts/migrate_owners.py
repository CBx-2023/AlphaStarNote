"""
Data Migration Script: Assign owner to existing records.

Scans all notebook, source, note, and chat_session records that have
no owner set and assigns them to the first admin user found in the database.

Usage:
    # From project root, with venv activated:
    python scripts/migrate_owners.py

    # Or specify a particular user email to assign ownership to:
    python scripts/migrate_owners.py --owner admin@localhost
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path

# Ensure project root is in path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# (dotenv removed for docker compatibility)

from loguru import logger


TABLES = ["notebook", "source", "note", "chat_session"]


async def run_migration(owner_email: str | None = None):
    """
    Migrate existing records to be owned by a specific user.

    Steps:
    1. Connect to SurrealDB
    2. Find the target owner user
    3. For each table, find records with owner = NONE
    4. Update them to set owner = target user
    """
    # Initialize database connection
    from open_notebook.database.repository import repo_query, repo_update

    # Find target owner
    if owner_email:
        results = await repo_query(
            "SELECT * FROM user WHERE email = $email",
            {"email": owner_email.lower().strip()},
        )
    else:
        # Default: find the first admin user
        results = await repo_query(
            "SELECT * FROM user WHERE role = 'admin' ORDER BY created ASC LIMIT 1"
        )

    if not results:
        logger.error(
            "No admin user found. Please create one first by starting the API, "
            "or specify --owner with an existing user email."
        )
        sys.exit(1)

    owner = results[0]
    owner_id = owner["id"]
    logger.info(f"Target owner: {owner.get('email', '?')} ({owner_id})")

    total_updated = 0

    for table in TABLES:
        # Find records without owner
        unowned = await repo_query(
            f"SELECT id FROM {table} WHERE owner = NONE OR owner IS NULL"
        )

        if not unowned:
            logger.info(f"  {table}: 0 records to migrate")
            continue

        count = len(unowned)
        logger.info(f"  {table}: {count} records to update...")

        # Batch update
        updated = await repo_query(
            f"UPDATE {table} SET owner = $owner WHERE owner = NONE OR owner IS NULL",
            {"owner": owner_id},
        )

        actual = len(updated) if updated else 0
        total_updated += actual
        logger.info(f"  {table}: {actual} records updated ✓")

    logger.info(f"\nMigration complete: {total_updated} records assigned to {owner.get('email', owner_id)}")


def main():
    parser = argparse.ArgumentParser(description="Assign owner to existing records")
    parser.add_argument(
        "--owner",
        type=str,
        default=None,
        help="Email of the user to assign as owner (default: first admin user)",
    )
    args = parser.parse_args()

    # Need to initialize the DB before we can query
    logger.info("Connecting to database...")

    asyncio.run(_init_and_migrate(args.owner))


async def _init_and_migrate(owner_email: str | None):
    """Run migration."""
    # Ensure database connection is initialized by doing a simple query
    from open_notebook.database.repository import repo_query
    try:
        await repo_query("INFO FOR DB")
    except Exception as e:
        logger.warning(f"DB connection initial ping failed, continuing anyway: {e}")

    await run_migration(owner_email)


if __name__ == "__main__":
    main()
