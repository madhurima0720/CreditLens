from __future__ import annotations

import os
import logging
from typing import Optional

import motor.motor_asyncio
from pymongo import IndexModel, ASCENDING, DESCENDING
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("creditlens.db")

MONGO_DETAILS: Optional[str] = os.getenv("MONGO_DETAILS")

if not MONGO_DETAILS:
    raise EnvironmentError(
        "MONGO_DETAILS is not set. Add it to backend/.env before starting the server.\n"
        "Example: MONGO_DETAILS=mongodb+srv://user:pass@cluster.mongodb.net/creditlens_db"
    )

_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_database = None

DB_NAME = "creditlens_db"

applicant_collection        = None
assessment_collection       = None
document_collection         = None
audit_log_collection        = None
users_collection            = None
human_decisions_collection  = None

DOCUMENTS_DB: list[dict] = []
ASSESSMENTS_DB: list[dict] = []
SEED_APPLICANTS = []

async def connect_db() -> None:
    global _client, _database
    global applicant_collection, assessment_collection, document_collection
    global audit_log_collection, users_collection, human_decisions_collection

    logger.info("Connecting to MongoDB (%s)…", DB_NAME)
    _client   = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
    _database = _client[DB_NAME]

    try:
        await _client.admin.command("ping")
        logger.info("✅  MongoDB connected — database: %s", DB_NAME)
    except Exception as exc:
        logger.error("❌  MongoDB connection FAILED: %s", exc)
        raise

    applicant_collection       = _database.get_collection("applicants")
    assessment_collection      = _database.get_collection("assessments")
    document_collection        = _database.get_collection("documents")
    audit_log_collection       = _database.get_collection("audit_logs")
    users_collection           = _database.get_collection("users")
    human_decisions_collection = _database.get_collection("human_decisions")

    await _ensure_indexes()
    logger.info("MongoDB ready. Automatic applicant seeding is disabled.")

async def _ensure_indexes() -> None:
    try:
        await applicant_collection.create_indexes([
            IndexModel([("id", ASCENDING)],             unique=True, name="idx_app_id"),
            IndexModel([("applicant_name", ASCENDING)], name="idx_app_name"),
            IndexModel([("loan_type", ASCENDING)],       name="idx_loan_type"),
            IndexModel([("human_decision", ASCENDING)], name="idx_human_dec"),
            IndexModel([("created_at", DESCENDING)],     name="idx_created_at"),
        ])
        await assessment_collection.create_indexes([
            IndexModel([("application_id", ASCENDING)], name="idx_assessment_app"),
        ])
        await document_collection.create_indexes([
            IndexModel([("application_id", ASCENDING)], name="idx_doc_app"),
        ])
        await audit_log_collection.create_indexes([
            IndexModel([("application_id", ASCENDING)], name="idx_audit_app"),
            IndexModel([("timestamp", DESCENDING)],         name="idx_audit_ts"),
        ])
        await human_decisions_collection.create_indexes([
            IndexModel([("application_id", ASCENDING)], name="idx_dec_app"),
            IndexModel([("decided_at", DESCENDING)],       name="idx_dec_ts"),
        ])
        logger.info("✅  MongoDB indexes ensured.")
    except Exception as exc:
        logger.warning("Index creation warning (non-fatal): %s", exc)

async def seed_initial_data() -> None:
    logger.info("Automatic demo seeding is disabled.")
    return

async def clean_applicants_collection() -> dict:
    if applicant_collection is None:
        return {"status": "error", "message": "MongoDB not connected"}
    result = await applicant_collection.delete_many({})
    logger.info("Cleaned applicants collection: removed %d records.", result.deleted_count)
    return {"status": "success", "deleted_count": result.deleted_count}

async def save_document_record(record: dict) -> str:
    """Save document record to MongoDB Atlas 'documents' collection or in-memory fallback."""
    DOCUMENTS_DB.append(dict(record))
    if document_collection is not None:
        try:
            await document_collection.insert_one(dict(record))
            logger.info("Saved document record %s to MongoDB Atlas.", record.get("id"))
        except Exception as exc:
            logger.warning("MongoDB Atlas document write failed (%s) — saved in-memory.", exc)
    return record.get("id", "")


async def save_assessment_record(record: dict) -> str:
    """Save assessment record to MongoDB Atlas 'assessments' collection or in-memory fallback."""
    ASSESSMENTS_DB.append(dict(record))
    if assessment_collection is not None:
        try:
            await assessment_collection.insert_one(dict(record))
            logger.info("Saved assessment record %s to MongoDB Atlas.", record.get("id"))
        except Exception as exc:
            logger.warning("MongoDB Atlas assessment write failed (%s) — saved in-memory.", exc)
    return record.get("id", "")


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed.")


async def ping_database() -> dict:
    global _client, _database
    if _client is None:
        return {"status": "not_initialized", "database": DB_NAME}
    try:
        await _client.admin.command("ping")
        apps_count    = await applicant_collection.count_documents({})
        decs_count    = await human_decisions_collection.count_documents({})
        audit_count   = await audit_log_collection.count_documents({})
        docs_count    = await document_collection.count_documents({})
        assess_count  = await assessment_collection.count_documents({})
        return {
            "status":    "connected",
            "database":  DB_NAME,
            "host":      "Atlas Cluster (credentials from .env)",
            "collections": {
                "applicants":       apps_count,
                "human_decisions":  decs_count,
                "audit_logs":       audit_count,
                "documents":        docs_count,
                "assessments":      assess_count,
            }
        }
    except Exception as exc:
        return {"status": "error", "database": DB_NAME, "detail": str(exc)}

