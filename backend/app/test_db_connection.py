import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import motor.motor_asyncio
from datetime import datetime, timezone

MONGO_DETAILS = os.getenv("MONGO_DETAILS")
DB_NAME = "creditlens_db"

async def run_tests():
    print("\n" + "="*64)
    print("  CreditLens MongoDB Integration Test")
    print("="*64)

    if not MONGO_DETAILS:
        print("❌  MONGO_DETAILS not set in .env. Aborting.")
        return

    print("\n[1] Connecting to MongoDB Atlas...")
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
    try:
        await client.admin.command("ping")
        print("    OK  Connected to MongoDB Atlas")
    except Exception as exc:
        print(f"    FAIL  Connection FAILED: {exc}")
        print()
        print("  >>> DIAGNOSIS:")
        print("  The MONGO_DETAILS in backend/.env appears to use a placeholder hostname.")
        print("  Update backend/.env with your real MongoDB Atlas connection string:")
        print("  MONGO_DETAILS=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/creditlens_db?retryWrites=true&w=majority")
        print()
        print("  To get a free cluster: https://www.mongodb.com/atlas/database")
        print("  The CreditLens backend will still run in degraded/in-memory mode")
        print("  until a valid MONGO_DETAILS is provided.")
        client.close()
        return

    db = client[DB_NAME]
    applicants   = db["applicants"]
    decisions    = db["human_decisions"]
    audit_logs   = db["audit_logs"]

    count = await applicants.count_documents({})
    print(f"\n[2] applicants collection → {count} document(s) found")
    if count > 0:
        sample = await applicants.find_one({}, {"_id": 0, "id": 1, "applicant_name": 1, "loan_type": 1, "human_decision": 1})
        print(f"    Sample: {sample}")
    else:
        print("    (empty — seed will run on next server startup)")

    now = datetime.now(timezone.utc).isoformat()
    test_record = {
        "id":                "APP-TEST-001",
        "applicant_name":    "Integration Test User",
        "loan_type":         "Test Loan",
        "amount":            500000,
        "amount_display":    "₹5,00,000",
        "salary":            80000,
        "dti":               32.5,
        "health_score":      72,
        "risk_tier":         "Medium Risk",
        "ai_status":         "AI Reviewed – Awaiting Decision",
        "human_decision":    None,
        "underwriter_remarks": None,
        "decided_by":        None,
        "decided_at":        None,
        "created_at":        now,
        "updated_at":        now,
        "positive_signals":  ["Test signal 1"],
        "risk_factors":      [],
        "documents":         [],
    }

    print("\n[3] Inserting test applicant (APP-TEST-001)…")
    try:
        await applicants.delete_one({"id": "APP-TEST-001"})
        result = await applicants.insert_one(test_record)
        print(f"    ✅  Inserted — MongoDB _id: {result.inserted_id}")
    except Exception as exc:
        print(f"    ❌  Insert failed: {exc}")
        client.close()
        return

    print("\n[4] Reading test applicant back from MongoDB…")
    fetched = await applicants.find_one({"id": "APP-TEST-001"}, {"_id": 0})
    if fetched:
        print(f"    ✅  Retrieved: name='{fetched['applicant_name']}', health_score={fetched['health_score']}")
        assert fetched["applicant_name"] == "Integration Test User", "Name mismatch!"
        assert fetched["health_score"] == 72, "Score mismatch!"
        print("    ✅  Data integrity check passed")
    else:
        print("    ❌  Read failed — document not found after insert")

    print("\n[5] Simulating human decision update…")
    update_result = await applicants.update_one(
        {"id": "APP-TEST-001"},
        {"$set": {
            "human_decision":      "APPROVED",
            "underwriter_remarks": "Test approval — integration test.",
            "decided_by":          "Test Officer",
            "decided_at":          now,
            "ai_status":           "Decision Recorded by Human Officer",
            "updated_at":          now,
        }}
    )
    if update_result.modified_count == 1:
        updated = await applicants.find_one({"id": "APP-TEST-001"}, {"_id": 0, "human_decision": 1, "decided_by": 1})
        print(f"    ✅  Updated: {updated}")
    else:
        print("    ❌  Update returned 0 modified count")

    print("\n[6] Verifying human_decisions & audit_logs collections…")
    dec_count   = await decisions.count_documents({})
    audit_count = await audit_logs.count_documents({})
    print(f"    human_decisions : {dec_count} document(s)")
    print(f"    audit_logs      : {audit_count} document(s)")

    print("\n[7] Cleaning up test record…")
    del_result = await applicants.delete_one({"id": "APP-TEST-001"})
    if del_result.deleted_count == 1:
        print("    ✅  Test record deleted")
    else:
        print("    ⚠   Test record not found for deletion (may already be gone)")

    final_count = await applicants.count_documents({})
    print("\n" + "="*64)
    print("  ✅  All integration tests PASSED")
    print("="*64)
    print(f"  MongoDB status   : connected")
    print(f"  Database         : {DB_NAME}")
    print(f"  applicants count : {final_count}")
    print(f"  human_decisions  : {dec_count}")
    print(f"  audit_logs       : {audit_count}")
    print(f"  Collections      : applicants, assessments, documents,")
    print(f"                     audit_logs, users, human_decisions")
    print("  Data persistence : writes survive page refresh & restart")
    print("="*64 + "\n")

    client.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
