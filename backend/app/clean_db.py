import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv()
MONGO_DETAILS = os.getenv("MONGO_DETAILS")
DB_NAME = "creditlens_db"

print(f"MONGO_DETAILS: {MONGO_DETAILS}")

async def main():
    if not MONGO_DETAILS:
        print("MONGO_DETAILS is not set in .env")
        return
    import motor.motor_asyncio
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command("ping")
        print("Successfully connected to MongoDB!")
        db = client[DB_NAME]

        coll = db["applicants"]
        count_before = await coll.count_documents({})
        print(f"Existing applicants count: {count_before}")

        result = await coll.delete_many({})
        print(f"Deleted {result.deleted_count} applicant records.")

        count_after = await coll.count_documents({})
        print(f"Applicants count now: {count_after}")

        if "users" in await db.list_collection_names():
            user_count = await db["users"].count_documents({})
            print(f"Users collection intact: {user_count} documents.")

        print("MongoDB applicants collection cleaned successfully.")
    except Exception as e:
        print(f"MongoDB connection or execution error: {type(e).__name__}: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
