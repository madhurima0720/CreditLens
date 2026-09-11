from fastapi.testclient import TestClient
from app.main import app
from app.ocr_engine import extract_document_details

path = r'C:\temp\creditlens\aadhaar_unique.png'
with open(path, 'rb') as f:
    data = f.read()
print('DIRECT_RESULT', extract_document_details(data, 'aadhaar_unique.png', 'aadhaar'))
with TestClient(app) as client:
    with open(path, 'rb') as f:
        resp = client.post('/api/v1/scan-document', files={'file': ('aadhaar_unique.png', f, 'image/png')}, data={'document_type':'aadhaar'})
    print('TESTCLIENT_STATUS', resp.status_code)
    print(resp.json())
