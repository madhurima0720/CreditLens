"""
Unit & End-to-End Tests for CreditLens Document Intelligence & OCR Pipeline:
1. Dynamic Tesseract path resolution & availability.
2. Document Parsing with Tesseract OCR & PIL / pdf2image.
3. Financial keyword classification & non-financial rejection.
4. Ollama LLM structured extraction with temperature = 0.0.
5. Integration with Loan Assessment endpoints & MongoDB Atlas persistence.
"""

import io
import sys
import os
import unittest
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.services.ocr_service import (
    find_tesseract_binary,
    is_tesseract_available,
    get_tesseract_path,
    extract_raw_text_from_image,
    extract_raw_text_from_pdf,
    validate_and_classify_financial_document,
    parse_and_validate_document,
    InvalidDocumentError,
    OCRProcessingError,
)
from app.services.ai_analysis import (
    analyze_document_with_ollama,
    detect_document_anomalies,
    resolve_ollama_model,
)
from app.risk_calculator import compute_risk_assessment


class TestDocumentIntelligencePipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_dynamic_tesseract_resolution(self):
        """Verify Tesseract OCR executable path is dynamically discovered."""
        tess_path = get_tesseract_path()
        self.assertIsNotNone(tess_path, "Tesseract path should be resolved dynamically")
        self.assertTrue(os.path.isfile(tess_path), f"Binary at {tess_path} must exist")
        self.assertTrue(is_tesseract_available(), "Tesseract OCR should report available")

    def test_02_non_financial_document_rejection(self):
        """Verify basic classification flags/raises error on non-financial or insufficient text."""
        # 1. Too short
        with self.assertRaises(InvalidDocumentError):
            validate_and_classify_financial_document("Short txt", strict=True)

        # 2. Insufficient financial keywords
        with self.assertRaises(InvalidDocumentError):
            validate_and_classify_financial_document(
                "This is a recipe for chocolate cake with sugar, flour, butter and baking powder.",
                strict=True,
            )

        # 3. Soft check returns valid=False
        res = validate_and_classify_financial_document(
            "This is a random note about travel plans to Paris.", strict=False
        )
        self.assertFalse(res["is_valid"])

    def test_03_financial_keyword_validation(self):
        """Verify valid financial documents pass keyword validation taxonomy."""
        sample_text = (
            "STATE BANK OF INDIA\n"
            "Account Statement for John Doe\n"
            "Account Number: 1234567890\n"
            "Monthly Salary Credit: INR 85,000\n"
            "Closing Balance: INR 3,40,000"
        )
        res = validate_and_classify_financial_document(sample_text, strict=True)
        self.assertTrue(res["is_valid"])
        self.assertGreaterEqual(res["matched_count"], 2)
        self.assertIn("statement", res["matched_keywords"])

    def test_04_tesseract_image_ocr_parsing(self):
        """Verify OCR extraction from synthetic image using PIL and Tesseract."""
        img = Image.new("RGB", (700, 250), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text(
            (20, 20),
            "PAYSLIP FOR RAJESH KHANNA\n"
            "Net Pay: Rs. 92,000\n"
            "Deductions: Rs. 8,000\n"
            "Bank Account: 4098234156",
            fill=(0, 0, 0),
        )
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        raw_text, classification = parse_and_validate_document(buf.getvalue(), "payslip.png")
        self.assertIn("RAJESH", raw_text.upper())
        self.assertTrue(classification["is_valid"])

    def test_05_tesseract_pdf_ocr_parsing(self):
        """Verify OCR extraction from PDF bytes using rendering and Tesseract."""
        img = Image.new("RGB", (700, 250), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text(
            (20, 20),
            "AXIS BANK STATEMENT\n"
            "Account Holder: Sunita Rao\n"
            "Salary Credit: Rs. 1,05,000\n"
            "Closing Balance: Rs. 4,50,000",
            fill=(0, 0, 0),
        )
        buf = io.BytesIO()
        img.save(buf, format="PDF")

        raw_text, classification = parse_and_validate_document(buf.getvalue(), "statement.pdf")
        self.assertIn("SUNITA", raw_text.upper())
        self.assertTrue(classification["is_valid"])

    def test_06_ollama_llm_json_extraction(self):
        """Verify Ollama analysis strictly extracts key fields as JSON with temperature=0.0."""
        ocr_text = (
            "HDFC BANK STATEMENT\n"
            "Account Holder: Kavita Menon\n"
            "Account Number: 50100445566778\n"
            "Monthly Salary Credit: INR 1,15,000.00\n"
            "Existing Loan EMI: INR 16,000.00\n"
            "Closing Balance: INR 5,20,000.00"
        )
        result = analyze_document_with_ollama(ocr_text)
        self.assertIn("applicant_name", result)
        self.assertIn("monthly_income", result)
        self.assertIn("existing_debt_emi", result)
        self.assertIn("account_number", result)
        self.assertIn("document_type", result)
        self.assertEqual(result["document_type"], "BANK_STATEMENT")
        self.assertEqual(result["monthly_income"], 115000.0)
        self.assertEqual(result["existing_debt_emi"], 16000.0)

    def test_07_underwriting_anomaly_detection(self):
        """Verify underwriting anomalies trigger on identity and salary deviations."""
        extracted = {
            "applicant_name": "Rohan Gupta",
            "monthly_income": 45000.0,
            "existing_debt_emi": 32000.0,
            "document_type": "SALARY_SLIP",
        }
        # Name mismatch
        anomalies = detect_document_anomalies(
            extracted, declared_applicant_name="Vikram Singh", declared_salary=90000.0
        )
        categories = [a["category"] for a in anomalies]
        self.assertIn("IDENTITY_MISMATCH", categories)
        self.assertIn("INCOME_MISMATCH", categories)
        self.assertIn("EXTREME_DEBT_EXPOSURE", categories)

    def test_08_risk_scoring_engine(self):
        """Verify Risk Scoring Engine calculates DTI, Health Score, and verdict."""
        res = compute_risk_assessment(
            applicant_name="Deepak Joshi",
            loan_type="Home Loan",
            monthly_salary=150000.0,
            existing_emis=20000.0,
            savings_amount=1200000.0,
            requested_loan=2000000.0,
            loan_tenure_months=60,
            annual_interest_rate=9.5,
        )
        self.assertEqual(res.decision, "APPROVE")
        self.assertGreater(res.health_score, 70)
        self.assertLess(res.dti_ratio_percent, 45.0)

    def test_09_e2e_scan_document_endpoint_integration(self):
        """Verify /api/v1/scan-document pipeline routes OCR -> Ollama -> Risk Scoring -> MongoDB."""
        img = Image.new("RGB", (800, 300), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text(
            (20, 20),
            "KOTAK MAHINDRA BANK STATEMENT\n"
            "Account Holder: Sneha Roy\n"
            "Account Number: 701234567890\n"
            "Monthly Salary Deposit: Rs. 130,000.00\n"
            "Loan EMI: Rs. 18,000.00\n"
            "Closing Balance: Rs. 7,00,000.00",
            fill=(0, 0, 0),
        )
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        res = self.client.post(
            "/api/v1/scan-document",
            files={"file": ("sneha_bank_statement.png", buf.getvalue(), "image/png")},
            data={"loan_type": "Home Loan", "requested_loan": 2500000.0},
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "success")
        self.assertTrue(body["document_id"].startswith("DOC-"))
        self.assertTrue(body["assessment_id"].startswith("ASM-"))
        self.assertIn("risk_assessment", body)
        self.assertIn(body["risk_assessment"]["decision"], ["APPROVE", "REJECT"])

    def test_10_e2e_assess_loan_document_endpoint(self):
        """Verify /api/v1/assess-loan-document dedicated pipeline endpoint."""
        img = Image.new("RGB", (800, 300), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text(
            (20, 20),
            "PAYSLIP - TATA CONSULTANCY SERVICES\n"
            "Employee Name: Aman Varma\n"
            "Gross Salary: Rs. 1,40,000.00\n"
            "Net Pay: Rs. 1,25,000.00\n"
            "Existing Loan EMI: Rs. 15,000.00",
            fill=(0, 0, 0),
        )
        buf = io.BytesIO()
        img.save(buf, format="PNG")

        res = self.client.post(
            "/api/v1/assess-loan-document",
            files={"file": ("aman_salary.png", buf.getvalue(), "image/png")},
            data={
                "loan_type": "Personal Loan",
                "requested_loan": 400000.0,
                "loan_tenure_months": 36,
                "savings_amount": 600000.0,
                "document_type": "salary_slip",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("decision", data)
        self.assertIn("health_score", data)
        self.assertIn("dti_ratio_percent", data)


if __name__ == "__main__":
    unittest.main()
