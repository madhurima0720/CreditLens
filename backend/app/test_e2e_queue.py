import urllib.request
import json

BASE = "http://localhost:8000"

def test_api():
    print("1. Testing initial clean state (0 applicants)...")
    req = urllib.request.Request(f"{BASE}/api/v1/applicants/clean", method="POST")
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print("   Clean response:", res)

    req = urllib.request.Request(f"{BASE}/api/v1/applications")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"   Initial count: {data['total']}, applications: {len(data['applications'])}")
        assert data['total'] == 0, f"Expected 0, got {data['total']}"
        assert len(data['applications']) == 0, f"Expected 0 apps, got {len(data['applications'])}"

    print("2. Adding Applicant 1 (Aarav Patel)...")
    app1_payload = {
        "applicant_name": "Aarav Patel",
        "loan_type": "Home Loan",
        "amount": 2500000.0,
        "salary": 165000.0,
        "dti": 32.5,
        "health_score": 88,
        "risk_tier": "Low Risk",
        "positive_signals": ["Strong liquid savings buffer", "Verified IT returns"],
        "risk_factors": [],
        "documents": []
    }
    req = urllib.request.Request(
        f"{BASE}/api/v1/applications",
        data=json.dumps(app1_payload).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        app1 = json.loads(resp.read().decode())
        print(f"   Created applicant 1 with ID: {app1['id']}, Status: {app1['status_display']}")
        assert app1['id'] == 'APP-1001', f"Expected APP-1001, got {app1['id']}"

    print("3. Checking queue after Applicant 1...")
    req = urllib.request.Request(f"{BASE}/api/v1/applications")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"   Queue total: {data['total']}, applicant: {data['applications'][0]['applicant_name']}")
        assert data['total'] == 1
        assert data['applications'][0]['id'] == 'APP-1001'

    print("4. Adding Applicant 2 (Priya Sharma)...")
    app2_payload = {
        "applicant_name": "Priya Sharma",
        "loan_type": "Vehicle Loan",
        "amount": 850000.0,
        "salary": 95000.0,
        "dti": 28.0,
        "health_score": 92,
        "risk_tier": "Low Risk",
        "positive_signals": ["Clean bureau history"],
        "risk_factors": [],
        "documents": []
    }
    req = urllib.request.Request(
        f"{BASE}/api/v1/applications",
        data=json.dumps(app2_payload).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        app2 = json.loads(resp.read().decode())
        print(f"   Created applicant 2 with ID: {app2['id']}")
        assert app2['id'] == 'APP-1002'

    print("5. Checking queue after Applicant 2...")
    req = urllib.request.Request(f"{BASE}/api/v1/applications")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"   Queue total: {data['total']}, IDs: {[a['id'] for a in data['applications']]}")
        assert data['total'] == 2
        assert {a['id'] for a in data['applications']} == {'APP-1001', 'APP-1002'}

    print("6. Testing search filter...")
    req = urllib.request.Request(f"{BASE}/api/v1/applications?search=Priya")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"   Search 'Priya' total: {data['total']}")
        assert data['total'] == 1
        assert data['applications'][0]['applicant_name'] == 'Priya Sharma'

    print("7. Testing human decision recording...")
    dec_payload = {
        "decision": "APPROVED",
        "statement": "Verified all documents. Excellent credit profile.",
        "officer_name": "Alex Reynolds",
        "officer_role": "Credit Underwriter"
    }
    req = urllib.request.Request(
        f"{BASE}/api/v1/applications/APP-1001/human-decision",
        data=json.dumps(dec_payload).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        dec_resp = json.loads(resp.read().decode())
        print(f"   Decision recorded: {dec_resp['message']}")
        assert dec_resp['application']['human_decision'] == 'APPROVED'

    print("\n[PASS] All End-to-End API and Queue tests PASSED successfully!")

if __name__ == "__main__":
    test_api()
