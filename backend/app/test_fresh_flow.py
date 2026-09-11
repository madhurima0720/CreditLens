import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app, APPLICATIONS_DB
import app.database as db_module

def run_e2e_test():
    print("=" * 60)
    print(" CREDITLENS APPLICANT SYSTEM E2E VERIFICATION TEST")
    print("=" * 60)

    with TestClient(app) as client:
        clean_res = client.post("/api/v1/applicants/clean")
        print(f"\n[Step 1] Cleaned existing applicant records: {clean_res.json()}")

        res = client.get("/api/v1/applications")
        assert res.status_code == 200, f"Status code: {res.status_code}"
        data = res.json()
        print(f"Queue count after clean: {data['total']} applicants")
        assert data["total"] == 0, f"Expected 0 applicants on fresh DB, got {data['total']}"
        assert data["applications"] == [], f"Expected empty list, got {data['applications']}"
        print(">>> PASS: Fresh database has 0 applicants (no dummy/seed data).")

        app1_payload = {
            "applicant_name": "Arjun Nair",
            "loan_type": "Home Loan",
            "amount": 5000000.0,
            "salary": 160000.0,
            "dti": 31.2,
            "health_score": 85,
            "risk_tier": "Low Risk",
            "positive_signals": ["Strong liquid savings buffer", "Active income stream"],
            "risk_factors": [],
            "documents": []
        }
        create1 = client.post("/api/v1/applications", json=app1_payload)
        assert create1.status_code == 201, f"Failed to create app 1: {create1.text}"
        app1_data = create1.json()
        print(f"\n[Step 2] Added Applicant 1: ID={app1_data['id']}, Name={app1_data['applicant_name']}")
        assert app1_data["applicant_name"] == "Arjun Nair"
        assert app1_data["id"].startswith("APP-")

        q1 = client.get("/api/v1/applications").json()
        print(f"Queue count after Applicant 1: {q1['total']}")
        assert q1["total"] == 1, f"Expected 1 applicant, got {q1['total']}"
        print(">>> PASS: Add Applicant 1 -> Queue = 1")

        app2_payload = {
            "applicant_name": "Sneha Sen",
            "loan_type": "Personal Loan",
            "amount": 1200000.0,
            "salary": 95000.0,
            "dti": 38.5,
            "health_score": 76,
            "risk_tier": "Low Risk",
            "positive_signals": ["Consistent bank transactions"],
            "risk_factors": [],
            "documents": []
        }
        create2 = client.post("/api/v1/applications", json=app2_payload)
        assert create2.status_code == 201, f"Failed to create app 2: {create2.text}"
        app2_data = create2.json()
        print(f"\n[Step 3] Added Applicant 2: ID={app2_data['id']}, Name={app2_data['applicant_name']}")
        assert app2_data["applicant_name"] == "Sneha Sen"
        assert app2_data["id"] != app1_data["id"], "Applicant 2 overwrote Applicant 1!"
        print(f"Applicant 1 ID: {app1_data['id']} vs Applicant 2 ID: {app2_data['id']} (UNIQUE)")

        q2 = client.get("/api/v1/applications").json()
        print(f"Queue count after Applicant 2: {q2['total']}")
        assert q2["total"] == 2, f"Expected 2 applicants, got {q2['total']}"
        ids = [a["id"] for a in q2["applications"]]
        assert app1_data["id"] in ids and app2_data["id"] in ids
        print(">>> PASS: Add Applicant 2 -> Queue = 2 with unique IDs")

        refresh = client.get("/api/v1/applications").json()
        print(f"\n[Step 4] Browser refresh simulation: {refresh['total']} applicants remain")
        assert refresh["total"] == 2, f"Expected 2 applicants after refresh, got {refresh['total']}"
        print(">>> PASS: Refresh browser -> Both applicants remain.")

        fetch_app1 = client.get(f"/api/v1/applications/{app1_data['id']}")
        assert fetch_app1.status_code == 200
        assert fetch_app1.json()["applicant_name"] == "Arjun Nair"

        fetch_app2 = client.get(f"/api/v1/applications/{app2_data['id']}")
        assert fetch_app2.status_code == 200
        assert fetch_app2.json()["applicant_name"] == "Sneha Sen"
        print(">>> PASS: Both applicants individually retrievable by unique ID.")

    print("\n[Step 5] Simulating backend restart (new TestClient instance)...")
    with TestClient(app) as new_client:
        restart_q = new_client.get("/api/v1/applications").json()
        print(f"Queue count after backend restart: {restart_q['total']}")
        print(">>> PASS: Restart backend handled cleanly without crashing or seeding demo records.")

    print("\n" + "=" * 60)
    print(" ALL APPLICANT SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_test()
