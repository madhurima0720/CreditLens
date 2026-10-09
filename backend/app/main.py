from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
import math
import uuid
import logging
from datetime import datetime, timezone
from app.services.document_verifier import verify_documents, validate_upload, DOC_TYPE_LABELS, normalize_doc_type
from app.ocr_engine import extract_document_details, ALL_FIELDS
from app.services.ocr_service import (
    parse_and_validate_document,
    extract_raw_text,
    validate_and_classify_financial_document,
    InvalidDocumentError,
    OCRProcessingError,
    get_tesseract_path,
    is_tesseract_available
)
from app.services.ai_analysis import (
    analyze_document_with_ollama,
    detect_document_anomalies,
    resolve_ollama_model
)
from app.risk_calculator import compute_risk_assessment
import app.database as db_module

logger = logging.getLogger("creditlens.api")
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(fastapi_app: 'FastAPI'):
    """Startup: connect to MongoDB and seed if empty. Shutdown: close connection."""
    try:
        await db_module.connect_db()
        logger.info("CreditLens API ready. MongoDB connected.")
    except Exception as exc:
        logger.error("Startup MongoDB connection failed: %s", exc)
        logger.warning("Running in degraded mode — using in-memory store only.")
    yield
    await db_module.close_db()

app = FastAPI(
    title="CreditLens Financial Risk & Health Assessment API",
    description="AI-driven credit underwriting, OCR document extraction, cross-document fraud detection, and copilot Q&A API.",
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MANDATORY_DOCUMENTS: Dict[str, List[str]] = {
    "Home Loan": ["KYC_ID", "KYC_ADDR", "PAY_SLIP", "BANK_STMT", "ITR_DOC", "PROP_DOC"],
    "home-loan": ["KYC_ID", "KYC_ADDR", "PAY_SLIP", "BANK_STMT", "ITR_DOC", "PROP_DOC"],
    "Vehicle Loan": ["KYC_ID", "KYC_ADDR", "PAY_SLIP", "BANK_STMT", "VEH_QUOTE"],
    "vehicle-loan": ["KYC_ID", "KYC_ADDR", "PAY_SLIP", "BANK_STMT", "VEH_QUOTE"],
    "Education Loan": ["KYC_ID", "ADM_LETTER", "FEE_STRUCT", "ACAD_CERT", "CO_INC", "BANK_STMT"],
    "education-loan": ["KYC_ID", "ADM_LETTER", "FEE_STRUCT", "ACAD_CERT", "CO_INC", "BANK_STMT"],
    "Personal Loan": ["KYC_ID", "KYC_ADDR", "PAY_SLIP", "ITR_DOC", "BANK_STMT"],
    "personal-loan": ["KYC_ID", "KYC_ADDR", "PAY_SLIP", "ITR_DOC", "BANK_STMT"],
    "Business Loan": ["GST_CERT", "KYC_ID", "FIN_STMT", "ITR_DOC", "BANK_STMT"],
    "business-loan": ["GST_CERT", "KYC_ID", "FIN_STMT", "ITR_DOC", "BANK_STMT"],
    "Agricultural Loan": ["KYC_ID", "LAND_REC", "CROP_REC", "BANK_STMT"],
    "agricultural-loan": ["KYC_ID", "LAND_REC", "CROP_REC", "BANK_STMT"],
    "Gold Loan": ["KYC_ID", "KYC_ADDR", "GOLD_VAL"],
    "gold-loan": ["KYC_ID", "KYC_ADDR", "GOLD_VAL"],
    "Loan Against Property": ["PROP_TITLE", "PROP_VAL", "KYC_ID", "ITR_DOC", "BANK_STMT"],
    "lap": ["PROP_TITLE", "PROP_VAL", "KYC_ID", "ITR_DOC", "BANK_STMT"],
    "Consumer Loan": ["KYC_ID", "PAY_SLIP", "PROD_QUOTE"],
    "consumer-loan": ["KYC_ID", "PAY_SLIP", "PROD_QUOTE"],
    "Equipment & Machinery Loan": ["MACH_QUOTE", "GST_CERT", "FIN_STMT", "BANK_STMT"],
    "machinery-loan": ["MACH_QUOTE", "GST_CERT", "FIN_STMT", "BANK_STMT"],
    "Loan Against Securities": ["DEMAT_STMT", "PLEDGE_DOC", "KYC_ID", "BANK_STMT"],
    "securities-loan": ["DEMAT_STMT", "PLEDGE_DOC", "KYC_ID", "BANK_STMT"]
}

DOC_CODE_LABELS = {
    "KYC_ID": "Government ID (Aadhaar / PAN)",
    "KYC_ADDR": "Address Proof",
    "PAY_SLIP": "Salary Slips / Income Proof",
    "BANK_STMT": "Bank Statement",
    "ITR_DOC": "Form 16 / ITR Tax Returns",
    "PROP_DOC": "Property Title & Agreement Documents",
    "VEH_QUOTE": "Vehicle Quotation",
    "ADM_LETTER": "Official Admission Letter",
    "FEE_STRUCT": "Course Fee Structure",
    "ACAD_CERT": "Academic Certificates",
    "CO_INC": "Co-applicant Income Proof",
    "GST_CERT": "Business Registration / GST",
    "FIN_STMT": "Audited Financial Statements",
    "LAND_REC": "Land Ownership / 7/12 Extract",
    "CROP_REC": "Crop Cultivation Record",
    "GOLD_VAL": "Gold Valuation Certificate",
    "PROP_TITLE": "Property Title Deeds",
    "PROP_VAL": "Valuation & Legal Search Report",
    "PROD_QUOTE": "Product Quotation",
    "MACH_QUOTE": "Machinery Supplier Quotation",
    "DEMAT_STMT": "Demat Holding Statement",
    "PLEDGE_DOC": "Pledge Request Form"
}

class RiskAssessmentRequest(BaseModel):
    applicant_name: str = Field(...)
    loan_type: str = Field(default="Home Loan", example="Home Loan")
    monthly_salary: float = Field(..., gt=0, example=165000.0)
    existing_emis: float = Field(..., ge=0, example=32000.0)
    savings_amount: float = Field(..., ge=0, example=1250000.0)
    requested_loan: float = Field(..., gt=0, example=2500000.0)
    loan_tenure_months: int = Field(default=48, gt=0, example=48)
    verified_salary: Optional[float] = Field(default=None, example=165000.0)
    annual_interest_rate: float = Field(default=10.5, gt=0, example=10.5)
    uploaded_documents: List[str] = Field(default_factory=list, example=["KYC_ID", "PAY_SLIP", "BANK_STMT"])
    pay_slip_account_name: Optional[str] = Field(default=None)
    bank_account_holder_name: Optional[str] = Field(default=None)
    simulate_cash_injection_anomaly: bool = Field(default=False)
    simulate_pdf_metadata_tampering: bool = Field(default=False)

class RiskFactorDetail(BaseModel):
    category: str
    severity: str
    message: str

class RiskAssessmentResponse(BaseModel):
    applicant_name: str
    loan_type: str
    dti_ratio_percent: float
    health_score: int
    risk_classification: str
    decision: str
    single_line_explanation: str
    single_line_verdict: str
    estimated_new_emi: float
    total_monthly_debt: float
    disposable_income: float
    safe_credit_limit: float
    income_mismatch_flag: bool
    identity_mismatch_flag: bool
    tamper_flag: bool
    missing_documents: List[str]
    mismatched_fields: List[str]
    confidence_score: float
    positive_signals: List[str]
    risk_factors: List[RiskFactorDetail]
    recommendation: str

class CopilotQueryRequest(BaseModel):
    query: str = Field(..., example="Why was this applicant flagged?")
    loan_type: Optional[str] = Field(default="Home Loan")
    applicant_name: Optional[str] = Field(default=None)
    health_score: Optional[int] = Field(default=78)
    dti_ratio: Optional[float] = Field(default=38.5)
    risk_classification: Optional[str] = Field(default="Low Risk")
    missing_documents: Optional[List[str]] = Field(default_factory=list)
    mismatched_fields: Optional[List[str]] = Field(default_factory=list)

class CopilotQueryResponse(BaseModel):
    query: str
    response: str
    category: str
    suggested_prompts: List[str]

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "CreditLens Financial Risk & Fraud Intelligence API",
        "version": "1.2.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "engine": "CreditLens-XGBoost-v3.4+FraudSentinel"}

@app.get("/health/db")
async def db_health_check():
    """
    MongoDB connectivity health check.
    Returns connection status and collection counts.
    Does NOT expose credentials or connection strings.
    """
    result = await db_module.ping_database()
    status_code = 200 if result["status"] == "connected" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=result, status_code=status_code)

async def _persist_risk_assessment(resp: RiskAssessmentResponse, payload_dict: Optional[Dict[str, Any]] = None) -> str:
    """Helper to persist completed risk assessment and audit event to MongoDB Atlas."""
    now = _now_iso()
    asm_id = f"ASM-{uuid.uuid4().hex[:8].upper()}"
    record = {
        "id": asm_id,
        "applicant_name": resp.applicant_name,
        "loan_type": resp.loan_type,
        "health_score": resp.health_score,
        "risk_classification": resp.risk_classification,
        "decision": resp.decision,
        "dti_ratio_percent": resp.dti_ratio_percent,
        "single_line_explanation": resp.single_line_explanation,
        "single_line_verdict": resp.single_line_verdict,
        "estimated_new_emi": resp.estimated_new_emi,
        "total_monthly_debt": resp.total_monthly_debt,
        "disposable_income": resp.disposable_income,
        "safe_credit_limit": resp.safe_credit_limit,
        "income_mismatch_flag": resp.income_mismatch_flag,
        "identity_mismatch_flag": resp.identity_mismatch_flag,
        "tamper_flag": resp.tamper_flag,
        "missing_documents": resp.missing_documents,
        "mismatched_fields": resp.mismatched_fields,
        "confidence_score": resp.confidence_score,
        "positive_signals": resp.positive_signals,
        "risk_factors": [rf.model_dump() if hasattr(rf, "model_dump") else dict(rf) for rf in resp.risk_factors],
        "recommendation": resp.recommendation,
        "created_at": now,
    }
    try:
        await db_module.save_assessment_record(record)
        if db_module.audit_log_collection is not None:
            await db_module.audit_log_collection.insert_one({
                "event_type": "RISK_ASSESSMENT_COMPLETED",
                "assessment_id": asm_id,
                "actor": "RISK_ENGINE",
                "actor_role": "Automated Underwriter",
                "description": f"Risk assessment performed for {resp.applicant_name}: Verdict '{resp.decision}', Health Score {resp.health_score}/100.",
                "metadata": {"health_score": resp.health_score, "decision": resp.decision, "risk_tier": resp.risk_classification},
                "timestamp": now,
            })
    except Exception as exc:
        logger.warning("Assessment MongoDB logging warning: %s", exc)
    return asm_id


@app.post("/api/v1/scan-document")
async def scan_document(
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(default="bank_statement"),
    loan_type: Optional[str] = Form(default="Home Loan"),
    requested_loan: Optional[float] = Form(default=None),
    loan_tenure_months: Optional[int] = Form(default=48),
    annual_interest_rate: Optional[float] = Form(default=10.5),
    savings_amount: Optional[float] = Form(default=None),
    declared_salary: Optional[float] = Form(default=None),
    declared_applicant_name: Optional[str] = Form(default=None),
):
    """
    Local privacy-focused Document Intelligence & OCR Pipeline:
    1. Tesseract OCR + PIL / pdf2image: extracts raw text dynamically.
    2. Financial keyword validation: checks sufficient financial terminology.
    3. Ollama LLM Analysis: extracts Applicant Name, Monthly Income, Debt / EMI, Account No, Doc Type (temperature=0.0).
    4. Anomaly detection against declared fields.
    5. Risk Scoring Engine evaluation.
    6. Persists document metrics, anomalies, and assessment to MongoDB Atlas (creditlens_db).
    """
    filename = file.filename or "uploaded_document.pdf"
    file_size_bytes = 0

    content = b""
    try:
        content = await file.read()
        file_size_bytes = len(content)
    except Exception as exc:
        logger.error("Failed reading uploaded file bytes: %s", exc)

    normalized_doc_type = normalize_doc_type(document_type)
    validation = validate_upload(normalized_doc_type, filename, confidence=90.0)
    if not validation["valid"]:
        raise HTTPException(
            status_code=422,
            detail={
                "error": validation["error"],
                "file_name": filename,
                "doc_type": normalized_doc_type,
                "badge": "INVALID_DOCUMENT",
            }
        )

    # 1 & 2: Local Tesseract OCR & Financial Classification Check
    try:
        raw_ocr_text, classification = parse_and_validate_document(content, filename, strict=True)
    except InvalidDocumentError as inv_err:
        logger.warning("Document failed financial keyword validation: %s", inv_err)
        raise HTTPException(
            status_code=422,
            detail={
                "error": inv_err.message,
                "classification": inv_err.details,
                "file_name": filename,
                "doc_type": normalized_doc_type,
                "badge": "INVALID_DOCUMENT",
            }
        )
    except OCRProcessingError as ocr_err:
        logger.error("OCR extraction processing failed: %s", ocr_err)
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"OCR processing failure: {ocr_err}",
                "file_name": filename,
                "doc_type": normalized_doc_type,
                "badge": "CORRUPTED_DOCUMENT",
            }
        )
    except Exception as exc:
        logger.error("Unexpected document extraction error: %s", exc)
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Failed to extract document contents: {exc}",
                "file_name": filename,
                "badge": "EXTRACTION_FAILED",
            }
        )

    # 3. Local Ollama LLM Entity Extraction (temperature=0.0)
    llm_result = analyze_document_with_ollama(raw_ocr_text)

    # Secondary regex extraction for identity / contact fields (Aadhaar, PAN, Phone, Email, Address)
    regex_extraction = extract_document_details(content, filename, normalized_doc_type or "")
    fields = dict(regex_extraction.get("fields", {}))

    # Merge LLM extracted fields into standardized underwriting fields
    applicant_name = llm_result.get("applicant_name")
    if applicant_name:
        fields["name"] = applicant_name

    monthly_income = llm_result.get("monthly_income")
    if monthly_income is not None:
        fields["income"] = f"INR {monthly_income:,.2f}"

    existing_debt = llm_result.get("existing_debt_emi")
    if existing_debt is not None:
        fields["existing_loans_emis"] = f"INR {existing_debt:,.2f}"

    account_no = llm_result.get("account_number")
    if account_no:
        if normalized_doc_type in ("bank_statement", "BANK_STMT"):
            fields["bank_details"] = f"A/C: {account_no}"
        else:
            fields["loan_account_number"] = account_no

    detected_doc_type = llm_result.get("document_type", "UNKNOWN")

    # 4. Anomaly detection on document entities
    anomalies = detect_document_anomalies(
        llm_result,
        declared_applicant_name=declared_applicant_name,
        declared_salary=declared_salary
    )

    detected_count = sum(1 for v in fields.values() if v and v != "Not Found")
    total_fields = len(ALL_FIELDS)

    extracted_data = {
        "document_category": DOC_TYPE_LABELS.get(document_type, "Financial Document"),
        "account_holder_name": applicant_name or fields.get("name", "Not Found"),
        "pan_identifier": fields.get("pan", "Not Found"),
        "aadhaar": fields.get("aadhaar", "Not Found"),
        "verified_monthly_income": f"INR {monthly_income:,.2f}" if monthly_income is not None else fields.get("income", "Not Found"),
        "existing_debt_emi": f"INR {existing_debt:,.2f}" if existing_debt is not None else fields.get("existing_loans_emis", "Not Found"),
        "account_number": account_no or "Not Found",
        "detected_document_type": detected_doc_type,
        "loan_amount": fields.get("loan_amount", "Not Found"),
        "confidence_score": llm_result.get("confidence", 95.0),
        "anomaly_detected": len(anomalies) > 0,
        "anomalies": anomalies,
        "llm_engine": llm_result.get("model_used"),
        "llm_used": llm_result.get("llm_used", False),
        "ocr_engine": "Tesseract OCR (Local)",
    }

    # 5. Persist document metrics & anomalies into MongoDB Atlas
    now = _now_iso()
    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    document_record = {
        "id": doc_id,
        "file_name": filename,
        "size_bytes": file_size_bytes,
        "doc_type": normalized_doc_type,
        "detected_doc_type": detected_doc_type,
        "extracted_name": applicant_name or fields.get("name"),
        "verified_monthly_income": monthly_income,
        "existing_debt_emi": existing_debt,
        "account_number": account_no,
        "confidence": llm_result.get("confidence", 95.0),
        "anomalies": anomalies,
        "classification": classification,
        "extracted_fields": fields,
        "ocr_raw_snippet": raw_ocr_text[:2000] if raw_ocr_text else "",
        "created_at": now,
    }

    try:
        await db_module.save_document_record(document_record)
        if db_module.audit_log_collection is not None:
            await db_module.audit_log_collection.insert_one({
                "event_type": "DOCUMENT_SCANNED_AND_ANALYZED",
                "document_id": doc_id,
                "actor": "OCR_PIPELINE",
                "actor_role": "Document Intelligence Engine",
                "description": f"Document '{filename}' parsed via Tesseract OCR + Ollama ({llm_result.get('model_used')}). Extracted: Name='{applicant_name}', Income={monthly_income}.",
                "metadata": {"doc_id": doc_id, "anomalies_count": len(anomalies), "llm_used": llm_result.get("llm_used")},
                "timestamp": now,
            })
    except Exception as exc:
        logger.warning("MongoDB document logging warning: %s", exc)

    # 6. Route extracted metrics to Risk Scoring Engine
    calc_salary = monthly_income if (monthly_income is not None and monthly_income > 0) else (declared_salary or 85000.0)
    calc_emis = existing_debt if existing_debt is not None else 0.0
    calc_name = applicant_name or declared_applicant_name or fields.get("name") or "Applicant"
    calc_savings = savings_amount if savings_amount is not None else max(100000.0, calc_salary * 4.0)
    calc_loan = requested_loan if requested_loan is not None else max(200000.0, calc_salary * 15.0)

    scoring_res = compute_risk_assessment(
        applicant_name=calc_name,
        loan_type=loan_type or "Home Loan",
        monthly_salary=calc_salary,
        existing_emis=calc_emis,
        savings_amount=calc_savings,
        requested_loan=calc_loan,
        loan_tenure_months=loan_tenure_months or 48,
        annual_interest_rate=annual_interest_rate or 10.5,
        verified_salary=monthly_income,
        anomalies=anomalies,
    )
    risk_resp = RiskAssessmentResponse(**scoring_res.model_dump())
    assessment_id = await _persist_risk_assessment(risk_resp, {
        "source": "DOCUMENT_SCAN_PIPELINE",
        "document_id": doc_id,
        "filename": filename,
    })

    return {
        "status": "success",
        "message": "Document parsed and analyzed successfully by CreditLens Tesseract OCR + Ollama LLM Pipeline",
        "filename": filename,
        "document_id": doc_id,
        "assessment_id": assessment_id,
        "size_bytes": file_size_bytes,
        "detected_count": detected_count,
        "total_fields": total_fields,
        "extracted_details": fields,
        "extracted_data": extracted_data,
        "llm_analysis": llm_result,
        "anomalies": anomalies,
        "classification": classification,
        "risk_assessment": risk_resp.model_dump(),
    }


@app.post("/api/v1/assess-loan-document", response_model=RiskAssessmentResponse)
async def assess_loan_document(
    file: UploadFile = File(...),
    loan_type: str = Form(default="Home Loan"),
    requested_loan: float = Form(default=2500000.0),
    loan_tenure_months: int = Form(default=48),
    annual_interest_rate: float = Form(default=10.5),
    savings_amount: float = Form(default=1250000.0),
    applicant_name: Optional[str] = Form(default=None),
    declared_salary: Optional[float] = Form(default=None),
    document_type: Optional[str] = Form(default="bank_statement"),
):
    """
    Dedicated endpoint routing Document Upload -> Tesseract OCR -> Ollama Analysis -> Risk Scoring Engine.
    Persists document metrics, anomalies, and risk assessment to MongoDB Atlas (creditlens_db).
    """
    scan_result = await scan_document(
        file=file,
        document_type=document_type,
        loan_type=loan_type,
        requested_loan=requested_loan,
        loan_tenure_months=loan_tenure_months,
        annual_interest_rate=annual_interest_rate,
        savings_amount=savings_amount,
        declared_salary=declared_salary,
        declared_applicant_name=applicant_name,
    )
    risk_dict = scan_result["risk_assessment"]
    return RiskAssessmentResponse(**risk_dict)


@app.post("/api/v1/assess-risk", response_model=RiskAssessmentResponse)
async def assess_risk(payload: RiskAssessmentRequest):
    """
    1. Cross-checks mandatory document completeness per loan_type.
    2. Performs Cross-Document Identity & Fraud Analysis (Name mismatch, Tampering, Sudden Cash Deposits).
    3. If identity mismatch or tampering is detected -> Sets decision to REJECTED - FRAUD / MISMATCH DETECTED.
    4. If documentation is complete and clean -> Computes DTI, CIBIL, Health Score, and outputs APPROVE or REJECT.
    5. Persists assessment result to MongoDB Atlas assessments collection.
    """
    loan_type_key = payload.loan_type
    required_doc_codes = MANDATORY_DOCUMENTS.get(
        loan_type_key,
        MANDATORY_DOCUMENTS.get("Home Loan", [])
    )

    uploaded_set = set(payload.uploaded_documents)
    missing_codes = [code for code in required_doc_codes if code not in uploaded_set]
    missing_doc_names = [DOC_CODE_LABELS.get(code, code) for code in missing_codes]

    scoring_res = compute_risk_assessment(
        applicant_name=payload.applicant_name,
        loan_type=payload.loan_type,
        monthly_salary=payload.monthly_salary,
        existing_emis=payload.existing_emis,
        savings_amount=payload.savings_amount,
        requested_loan=payload.requested_loan,
        loan_tenure_months=payload.loan_tenure_months,
        annual_interest_rate=payload.annual_interest_rate,
        verified_salary=payload.verified_salary,
        pay_slip_account_name=payload.pay_slip_account_name,
        bank_account_holder_name=payload.bank_account_holder_name,
        missing_documents=missing_doc_names,
        simulate_cash_injection_anomaly=payload.simulate_cash_injection_anomaly,
        simulate_pdf_metadata_tampering=payload.simulate_pdf_metadata_tampering,
    )

    resp = RiskAssessmentResponse(**scoring_res.model_dump())
    await _persist_risk_assessment(resp, payload.model_dump())
    return resp


LOAN_DOC_DESCRIPTIONS: Dict[str, str] = {
    "Home Loan":                "Government ID (Aadhaar/PAN), Address Proof, Salary Slips, 6-month Bank Statement, Form 16 / ITR, Property Title & Agreement Documents.",
    "Vehicle Loan":             "Government ID, Address Proof, Salary Slips / ITR, 3-month Bank Statement, Vehicle Dealer Quotation.",
    "Education Loan":           "Government ID, Official Admission Letter, Course Fee Structure, Academic Certificates, Co-applicant Income Proof, Bank Statement.",
    "Personal Loan":            "Government ID, Address Proof, Latest Salary Slips, ITR for 2 years, 6-month Bank Statement.",
    "Business Loan":            "Business GST Certificate / Registration, Promoter KYC (PAN/Aadhaar), Audited Financial Statements, 2-year Business ITR, 12-month Bank Statement.",
    "Agricultural Loan":        "Government ID, Land Ownership / 7-12 Extract, Crop Cultivation Record, 6-month Bank Statement.",
    "Gold Loan":                "Government ID, Address Proof, Gold Valuation Certificate from certified appraiser.",
    "Loan Against Property":    "Property Title Deeds, Valuation & Legal Search Report, Government ID, 2-year ITR, 12-month Bank Statement.",
    "Consumer Loan":            "Government ID, Salary Slip (latest), Product Quotation from authorized dealer.",
    "Equipment & Machinery Loan": "Machinery Supplier Quotation, GST Certificate, Audited Financial Statements, 12-month Bank Statement.",
    "Loan Against Securities":  "Demat Holding Statement, Pledge Request Form, Government ID, 6-month Bank Statement.",
}

INTEREST_RATE_TABLE: Dict[str, str] = {
    "Home Loan": "8.50% p.a.",
    "Vehicle Loan": "9.25% p.a.",
    "Education Loan": "9.75% p.a.",
    "Personal Loan": "11.50% p.a.",
    "Business Loan": "12.00% p.a.",
    "Agricultural Loan": "7.00% p.a.",
    "Gold Loan": "9.00% p.a.",
    "Loan Against Property": "10.00% p.a.",
    "Consumer Loan": "13.00% p.a.",
    "Equipment & Machinery Loan": "11.00% p.a.",
    "Loan Against Securities": "10.50% p.a.",
}

@app.post("/api/v1/copilot-chat", response_model=CopilotQueryResponse)
def copilot_chat(payload: CopilotQueryRequest):
    """
    Dynamic AI Q&A Copilot: resolves greetings, farewells, document requirements,
    DTI/CIBIL formulas, fraud flag explanations, interest rates, and general eligibility
    queries — with context from the active applicant session when available.
    """
    q = payload.query.lower().strip()
    applicant = payload.applicant_name or "the applicant"
    loan_type = payload.loan_type or "General"

    greetings  = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy"}
    farewells  = {"bye", "byee", "goodbye", "see you", "farewell", "take care", "later", "thanks bye"}

    if any(w in q for w in farewells):
        resp = "Goodbye! 👋 Thank you for using CreditLens AI Copilot. Come back anytime for credit risk assessments, fraud analysis, or document queries."
        cat  = "FAREWELL"
        suggested_prompts = [
            "Start a new risk assessment",
            "How is DTI calculated?",
            "What documents are required for Home Loan?",
            "What interest rates apply for Business Loans?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(w in q for w in greetings):
        resp = (
            f"Hello! 👋 I'm the CreditLens AI Copilot — your intelligent financial policy engine. "
            f"I can help you with applicant eligibility, mandatory document checklists, DTI ratio calculations, "
            f"fraud flag explanations, interest rate benchmarks, and CIBIL score analysis. "
            f"What would you like to explore today?"
        )
        cat  = "GREETING"
        suggested_prompts = [
            "What documents are required for Home Loan?",
            "How is DTI calculated?",
            "Why was this applicant flagged?",
            "What interest rates apply for Personal Loans?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(kw in q for kw in ["flag", "why reject", "fraud", "mismatch", "tamper", "anomaly", "suspicious"]):
        if payload.mismatched_fields:
            details = "; ".join(payload.mismatched_fields)
            resp = (
                f"⚠️ Applicant '{applicant}' was rejected due to cross-document fraud or identity mismatch.\n\n"
                f"Detected anomalies:\n• {details}\n\n"
                f"The CreditLens Fraud Sentinel automatically escalated this application to the Fraud Investigation Unit. "
                f"No credit score or health score is computed until all anomalies are cleared."
            )
            cat = "FRAUD_EXPLANATION"
        elif payload.missing_documents:
            missing_list = ", ".join(payload.missing_documents)
            resp = (
                f"📋 Application for '{applicant}' ({loan_type}) is incomplete.\n\n"
                f"Missing {len(payload.missing_documents)} mandatory document(s): {missing_list}.\n\n"
                f"Per CreditLens policy, risk scoring is blocked until all required documents are submitted and verified."
            )
            cat = "DOCUMENTS"
        else:
            score = payload.health_score or 0
            dti   = payload.dti_ratio or 0.0
            classification = payload.risk_classification or "Unknown"
            if score < 50:
                reason = f"a low Financial Health Score of {score}/100 and an elevated post-loan DTI ratio of {dti}%"
            elif dti > 45:
                reason = f"a post-loan DTI ratio of {dti}% which exceeds the institutional ceiling of 45%"
            else:
                reason = f"an income mismatch between declared salary and verified bank statement credits"
            resp = (
                f"🔍 Applicant '{applicant}' ({loan_type}) was flagged because of {reason}.\n\n"
                f"Current Financial Health Score: {score}/100 | DTI: {dti}% | Classification: {classification}.\n\n"
                f"Recommendation: Consider reducing the requested loan amount or extending the tenure to lower the EMI burden."
            )
            cat = "ELIGIBILITY"
        suggested_prompts = [
            "How is DTI calculated?",
            f"What documents are required for {loan_type}?",
            "What is CIBIL and how does it affect approval?",
            "What interest rates apply for this loan type?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(kw in q for kw in ["document", "require", "upload", "mandatory", "checklist", "kyc", "paperwork", "proof"]):
        matched_loan = None
        for ln in LOAN_DOC_DESCRIPTIONS:
            if ln.lower() in q:
                matched_loan = ln
                break

        if matched_loan:
            docs = LOAN_DOC_DESCRIPTIONS[matched_loan]
            resp = f"📁 Mandatory documents for **{matched_loan}**:\n\n{docs}"
        elif loan_type in LOAN_DOC_DESCRIPTIONS:
            docs = LOAN_DOC_DESCRIPTIONS[loan_type]
            resp = (
                f"📁 Based on the active application ({loan_type}), the mandatory documents required are:\n\n"
                f"{docs}\n\n"
                f"All documents must be verified before the AI risk scoring engine can generate a verdict."
            )
        else:
            lines = "\n".join([f"• **{k}**: {v}" for k, v in LOAN_DOC_DESCRIPTIONS.items()])
            resp = f"📋 Document requirements by loan category:\n\n{lines}"

        cat = "DOCUMENTS"
        suggested_prompts = [
            "How is DTI calculated?",
            "What interest rates apply for this loan type?",
            "Why was this applicant flagged?",
            "What is CIBIL and how does it affect approval?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(kw in q for kw in ["dti", "debt to income", "debt-to-income", "ratio", "emi calculation", "how is dti", "how dti"]):
        dti = payload.dti_ratio or 0.0
        score = payload.health_score or 0
        resp = (
            "📊 **DTI (Debt-to-Income) Ratio Formula**\n\n"
            "DTI = (Total Monthly Debt Obligations ÷ Net Monthly Salary) × 100\n\n"
            "Where Total Monthly Debt = Existing EMIs + New Proposed EMI.\n\n"
            "**CreditLens Risk Thresholds:**\n"
            "• DTI ≤ 40% → Low Risk ✅\n"
            "• DTI 40–50% → Medium Risk ⚠️\n"
            "• DTI > 50% → High Risk / Rejection ❌\n\n"
        )
        if dti > 0:
            resp += f"Active session DTI for '{applicant}': **{dti}%** | Health Score: **{score}/100**."
        cat = "DTI_CALCULATION"
        suggested_prompts = [
            "What is CIBIL and how does it affect approval?",
            f"What documents are required for {loan_type}?",
            "What interest rates apply for Personal Loans?",
            "Why was this applicant flagged?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(kw in q for kw in ["cibil", "credit score", "credit rating", "score", "bureau"]):
        score = payload.health_score or 0
        resp = (
            "📈 **CIBIL Score & Credit Rating**\n\n"
            "CIBIL (Credit Information Bureau India Ltd.) scores range from 300–900.\n\n"
            "**CreditLens Benchmark Mapping:**\n"
            "• 750–900 → Excellent (Auto-approve eligible)\n"
            "• 700–749 → Good (Standard processing)\n"
            "• 650–699 → Fair (Manual review required)\n"
            "• 600–649 → Poor (High-risk; collateral required)\n"
            "• Below 600 → Very Poor (Likely rejection)\n\n"
            "CreditLens Financial Health Score (FHS) is a composite metric combining CIBIL, DTI, savings buffer, and document integrity signals."
        )
        if score > 0:
            resp += f"\n\nActive session FHS for '{applicant}': **{score}/100**."
        cat = "CIBIL"
        suggested_prompts = [
            "How is DTI calculated?",
            f"What documents are required for {loan_type}?",
            "What interest rates apply for Home Loans?",
            "Why was this applicant flagged?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(kw in q for kw in ["interest", "rate", "apr", "percent", "benchmark"]):
        matched_rate_loan = None
        for ln in INTEREST_RATE_TABLE:
            if ln.lower() in q:
                matched_rate_loan = ln
                break

        if matched_rate_loan:
            rate = INTEREST_RATE_TABLE[matched_rate_loan]
            resp = f"💰 Institutional benchmark interest rate for **{matched_rate_loan}**: **{rate}**\n\nRates are subject to RBI policy revisions and applicant risk classification."
        else:
            lines = "\n".join([f"• **{k}**: {v}" for k, v in INTEREST_RATE_TABLE.items()])
            resp = f"💰 **CreditLens Institutional Benchmark Interest Rates:**\n\n{lines}\n\nAll rates are indicative annual rates subject to credit profile and RBI guidelines."
        cat = "INTEREST_RATES"
        suggested_prompts = [
            "How is DTI calculated?",
            f"What documents are required for {loan_type}?",
            "What is CIBIL and how does it affect approval?",
            "Why was this applicant flagged?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    if any(kw in q for kw in ["eligible", "eligibility", "approve", "qualify", "condition", "criteria"]):
        score = payload.health_score or 0
        dti   = payload.dti_ratio or 0.0
        classification = payload.risk_classification or "Unknown"
        resp = (
            f"✅ **Loan Eligibility Criteria — CreditLens Policy:**\n\n"
            f"• Financial Health Score ≥ 75 → Low Risk → Auto-Approved\n"
            f"• Financial Health Score 50–74 → Medium Risk → Conditionally Approved\n"
            f"• Financial Health Score < 50 → High Risk → Rejected\n"
            f"• Post-loan DTI ≤ 40% is required for standard approval\n"
            f"• All mandatory documents must be verified (zero missing)\n"
            f"• No identity mismatches or PDF tampering detected\n\n"
        )
        if score > 0:
            verdict_str = "Eligible ✅" if score >= 50 and dti <= 50 else "Not eligible ❌"
            resp += f"Active session — '{applicant}' ({loan_type}): FHS {score}/100, DTI {dti}%, Classification: {classification} → **{verdict_str}**"
        cat = "ELIGIBILITY"
        suggested_prompts = [
            "How is DTI calculated?",
            f"What documents are required for {loan_type}?",
            "What is CIBIL and how does it affect approval?",
            "What interest rates apply for this loan type?",
        ]
        return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

    score = payload.health_score or 0
    dti   = payload.dti_ratio or 0.0
    classification = payload.risk_classification or "N/A"

    if score > 0:
        resp = (
            f"🤖 CreditLens AI Copilot analyzed your query: \"{payload.query}\"\n\n"
            f"Active session context — Applicant: **{applicant}** | Loan Type: **{loan_type}**\n"
            f"• Financial Health Score: **{score}/100**\n"
            f"• Post-loan DTI Ratio: **{dti}%**\n"
            f"• Risk Classification: **{classification}**\n\n"
            f"Please ask me about document requirements, DTI formula, fraud flags, CIBIL scores, "
            f"interest rate benchmarks, or loan eligibility conditions for a precise answer."
        )
    else:
        resp = (
            f"🤖 CreditLens AI Copilot is ready to assist with: **{payload.query}**\n\n"
            f"I can answer questions about:\n"
            f"• 📋 Mandatory document checklists per loan type\n"
            f"• 📊 DTI ratio formula and risk thresholds\n"
            f"• 🔍 Fraud flag explanations and mismatch analysis\n"
            f"• 💰 Institutional benchmark interest rates\n"
            f"• 📈 CIBIL score interpretation and credit benchmarks\n"
            f"• ✅ Loan eligibility conditions and approval criteria\n\n"
            f"Try one of the quick prompts below to get started!"
        )
    cat = "GENERAL"
    suggested_prompts = [
        "Why was this applicant flagged?",
        f"What documents are required for {loan_type}?",
        "How is DTI calculated?",
        "What interest rates apply for Personal Loans?",
    ]
    return CopilotQueryResponse(query=payload.query, response=resp, category=cat, suggested_prompts=suggested_prompts)

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

APPLICATIONS_DB: List[Dict[str, Any]] = []

class DecisionRequest(BaseModel):
    decision: Literal["APPROVED", "REJECTED"] = Field(..., example="APPROVED")
    remarks: str = Field(..., min_length=5, example="Verified income and property documents. Profile meets all criteria.")
    officer_name: str = Field(..., example="Alex Reynolds")

class ApplicationCreateRequest(BaseModel):
    applicant_name: str
    loan_type: str
    amount: float
    salary: float
    dti: float
    health_score: int
    risk_tier: str
    positive_signals: List[str] = Field(default_factory=list)
    risk_factors: List[Dict[str, Any]] = Field(default_factory=list)
    documents: List[Dict[str, Any]] = Field(default_factory=list)
    extracted_details: Optional[Dict[str, Any]] = Field(default_factory=dict)

def _display_status(app: Dict[str, Any]) -> str:
    if app.get("human_decision") == "APPROVED":
        return "Approved"
    if app.get("human_decision") == "REJECTED":
        return "Rejected"
    return app.get("ai_status", "Pending AI Review")

def _enrich(app: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of the record with computed display fields and doc verification."""
    record = dict(app)
    record["status_display"] = _display_status(app)
    verification = verify_documents(app.get("applicant_name", ""), app.get("documents", []))
    record["doc_verification"] = verification
    raw_extracted = record.get("extracted_details") or {}
    full_extracted = {f: raw_extracted.get(f) if raw_extracted.get(f) and raw_extracted.get(f) != "Not Found" else "Not Found" for f in ALL_FIELDS}
    record["extracted_details"] = full_extracted
    return record

async def _generate_unique_id() -> str:
    """
    Generate a strictly unique sequential APP-XXXX ID.
    Guarantees no applicant ever overwrites a previous record.
    """
    existing_ids = set()
    if db_module.applicant_collection is not None:
        try:
            cursor = db_module.applicant_collection.find({}, {"id": 1, "_id": 0})
            docs = await cursor.to_list(length=10000)
            for d in docs:
                if d.get("id"):
                    existing_ids.add(d["id"])
        except Exception as exc:
            logger.warning("Error fetching IDs from MongoDB: %s", exc)

    for a in APPLICATIONS_DB:
        if a.get("id"):
            existing_ids.add(a["id"])

    nums = []
    for eid in existing_ids:
        if eid.startswith("APP-"):
            raw_num = eid[4:]
            if raw_num.isdigit():
                nums.append(int(raw_num))

    next_num = (max(nums) + 1) if nums else 1001
    candidate = f"APP-{next_num}"
    while candidate in existing_ids:
        next_num += 1
        candidate = f"APP-{next_num}"
    return candidate

@app.get("/api/v1/applications")
async def list_applications(
    search: Optional[str] = Query(default=None, description="Case-insensitive search on name, ID, or loan type"),
    status: Optional[str] = Query(default=None, description="Filter by human_decision: APPROVED, REJECTED, or PENDING"),
):
    """
    Return all applications from MongoDB with optional search and status filters.
    Queue data is strictly database-driven — zero hardcoded or mock applicants.
    """
    results: List[Dict[str, Any]] = []
    if db_module.applicant_collection is not None:
        try:
            mongo_query: Dict[str, Any] = {}
            if status and status.upper() != "ALL":
                upper = status.upper()
                if upper == "PENDING":
                    mongo_query["human_decision"] = None
                else:
                    mongo_query["human_decision"] = upper

            cursor = db_module.applicant_collection.find(mongo_query, {"_id": 0}).sort("created_at", -1)
            all_docs = await cursor.to_list(length=None)

            if search:
                s = search.lower().strip()
                results = [
                    a for a in all_docs
                    if s in a.get("applicant_name", "").lower()
                    or s in a.get("id", "").lower()
                    or s in a.get("loan_type", "").lower()
                ]
            else:
                results = all_docs
        except Exception as exc:
            logger.warning("MongoDB list failed (%s) — using session cache.", exc)
            results = list(APPLICATIONS_DB)
    else:
        results = list(APPLICATIONS_DB)
        if search and results:
            s = search.lower().strip()
            results = [
                a for a in results
                if s in a.get("applicant_name", "").lower()
                or s in a.get("id", "").lower()
                or s in a.get("loan_type", "").lower()
            ]
        if status and status.upper() not in ("ALL", "") and results:
            upper = status.upper()
            if upper == "PENDING":
                results = [a for a in results if not a.get("human_decision")]
            else:
                results = [a for a in results if a.get("human_decision") == upper]

    return {"applications": [_enrich(a) for a in results], "total": len(results)}

@app.post("/api/v1/applicants/clean")
async def clean_applicants():
    """
    Remove all applicant records from MongoDB 'applicants' collection and reset in-memory cache.
    Does NOT delete the database or user/authentication data.
    """
    APPLICATIONS_DB.clear()
    res = await db_module.clean_applicants_collection()
    return {"message": "Applicants collection cleaned successfully", "result": res}

@app.get("/api/v1/applications/{app_id}")
async def get_application(app_id: str):
    """Return a single application by ID. Reads from MongoDB first, falls back to session cache."""
    try:
        if db_module.applicant_collection is not None:
            doc = await db_module.applicant_collection.find_one(
                {"id": app_id.upper()}, {"_id": 0}
            )
            if doc:
                return _enrich(doc)
    except Exception as exc:
        logger.warning("MongoDB get failed (%s).", exc)

    for rec in APPLICATIONS_DB:
        if rec.get("id", "").upper() == app_id.upper():
            return _enrich(rec)

    raise HTTPException(status_code=404, detail=f"Application '{app_id}' not found.")

@app.post("/api/v1/applications", status_code=201)
async def create_application(payload: ApplicationCreateRequest):
    """
    Create a NEW application document in MongoDB.
    Each submission creates a NEW document with a unique ID and never overwrites previous records.
    AI status = 'AI Reviewed – Awaiting Decision'.
    Human decision fields are ALWAYS None until a human officer reviews it.
    """
    now = _now_iso()
    new_id = await _generate_unique_id()

    new_record: Dict[str, Any] = {
        "id":                  new_id,
        "applicant_name":      payload.applicant_name,
        "loan_type":           payload.loan_type,
        "amount":              payload.amount,
        "amount_display":      f"₹{payload.amount:,.0f}",
        "salary":              payload.salary,
        "dti":                 payload.dti,
        "health_score":        payload.health_score,
        "risk_tier":           payload.risk_tier,
        "ai_status":           "AI Reviewed – Awaiting Decision",
        "human_decision":      None,
        "underwriter_remarks": None,
        "decided_by":          None,
        "decided_at":          None,
        "created_at":          now,
        "updated_at":          now,
        "positive_signals":    payload.positive_signals,
        "risk_factors":        payload.risk_factors,
        "documents":           payload.documents,
        "extracted_details":   payload.extracted_details or {},
    }

    mongo_error = None
    if db_module.applicant_collection is not None:
        try:
            await db_module.applicant_collection.insert_one(dict(new_record))
            logger.info("Successfully inserted NEW MongoDB document for applicant %s (%s).", new_id, payload.applicant_name)

            if db_module.audit_log_collection is not None:
                await db_module.audit_log_collection.insert_one({
                    "event_type":    "APPLICATION_CREATED",
                    "application_id": new_id,
                    "actor":          "SYSTEM_INTAKE",
                    "actor_role":     "Intake Wizard",
                    "description":    f"New application {new_id} created for {payload.applicant_name} ({payload.loan_type}).",
                    "metadata":       {"health_score": payload.health_score, "risk_tier": payload.risk_tier},
                    "timestamp":      now,
                })
        except Exception as exc:
            mongo_error = str(exc)
            logger.warning("MongoDB write failed: %s", exc)

    APPLICATIONS_DB.append(dict(new_record))

    enriched = _enrich(new_record)
    if mongo_error:
        enriched["mongo_warning"] = f"Stored in session only. MongoDB write failed: {mongo_error}"
    return enriched

@app.post("/api/v1/applicants/clean")
async def clean_applicants():
    """
    Remove all applicant records from MongoDB 'applicants' collection and reset session cache.
    Does NOT delete the database or user/authentication data.
    """
    APPLICATIONS_DB.clear()
    res = await db_module.clean_applicants_collection()
    return {"status": "success", "message": "Applicants collection cleaned successfully.", "result": res}

@app.post("/api/v1/applications/{app_id}/decision")
async def submit_decision(app_id: str, payload: DecisionRequest):
    """
    Legacy decision endpoint (kept for backwards compatibility).
    Delegates to the full human-decision handler.
    """
    from pydantic import ValidationError
    human_payload = HumanDecisionRequest(
        decision=payload.decision,
        statement=payload.remarks,
        officer_name=payload.officer_name,
    )
    return await human_decision(app_id, human_payload)

class HumanDecisionRequest(BaseModel):
    """
    Payload from the Human Underwriter Decision Panel.
    AI MUST NEVER call this endpoint — only authenticated human officers may.
    """
    decision: Literal["APPROVED", "REJECTED"] = Field(
        ..., example="APPROVED",
        description="Final human underwriter verdict. AI is NOT permitted to set this."
    )
    statement: str = Field(
        ..., min_length=10,
        example="Income verified. DTI within acceptable limits. Approved with standard terms.",
        description="Mandatory single-line underwriter reason for the decision."
    )
    officer_name: str = Field(..., example="Alex Reynolds")
    officer_role: Optional[str] = Field(default="Credit Underwriter", example="Senior Credit Officer")

@app.post("/api/v1/applications/{app_id}/human-decision")
async def human_decision(app_id: str, payload: HumanDecisionRequest):
    """
    Record the human underwriter's final APPROVED / REJECTED decision.

    Writes to both:
      • APPLICATIONS_DB (in-memory, for real-time UI sync)
      • MongoDB human_decisions collection (persistent audit log)

    STRICT: AI engines are forbidden from calling this endpoint.
    """
    target_app = None
    if db_module.applicant_collection is not None:
        try:
            target_app = await db_module.applicant_collection.find_one({"id": app_id.upper()}, {"_id": 0})
        except Exception as exc:
            logger.warning("MongoDB find failed in human_decision: %s", exc)

    if target_app is None:
        for app in APPLICATIONS_DB:
            if app.get("id", "").upper() == app_id.upper():
                target_app = app
                break

    if target_app is None:
        raise HTTPException(status_code=404, detail=f"Application '{app_id}' not found.")

    if target_app.get("human_decision") is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Decision already recorded as '{target_app['human_decision']}' "
                f"by {target_app['decided_by']} at {target_app['decided_at']}. "
                f"Contact a supervisor to override."
            )
        )

    decided_at = _now_iso()

    target_app["human_decision"]      = payload.decision
    target_app["underwriter_remarks"] = payload.statement.strip()
    target_app["decided_by"]          = payload.officer_name
    target_app["decided_at"]          = decided_at
    target_app["ai_status"]           = "Decision Recorded by Human Officer"
    target_app["updated_at"]          = decided_at

    mongo_error = None
    try:
        if db_module.human_decisions_collection is None:
            raise RuntimeError("MongoDB not connected")

        await db_module.human_decisions_collection.insert_one({
            "application_id":  app_id,
            "applicant_name":  target_app["applicant_name"],
            "loan_type":       target_app["loan_type"],
            "health_score":    target_app["health_score"],
            "risk_tier":       target_app["risk_tier"],
            "decision":        payload.decision,
            "statement":       payload.statement.strip(),
            "officer_name":    payload.officer_name,
            "officer_role":    payload.officer_role or "Credit Underwriter",
            "decided_at":      decided_at,
            "source":          "HUMAN_OFFICER",
            "ai_advisory_only": True,
        })

        await db_module.applicant_collection.update_one(
            {"id": app_id.upper()},
            {"$set": {
                "human_decision":      payload.decision,
                "underwriter_remarks": payload.statement.strip(),
                "decided_by":          payload.officer_name,
                "decided_at":          decided_at,
                "ai_status":           "Decision Recorded by Human Officer",
                "updated_at":          decided_at,
            }}
        )

        await db_module.audit_log_collection.insert_one({
            "event_type":     "HUMAN_DECISION_RECORDED",
            "application_id": app_id,
            "actor":          payload.officer_name,
            "actor_role":     payload.officer_role or "Credit Underwriter",
            "description":    f"Underwriter {payload.officer_name} recorded '{payload.decision}' for {app_id}.",
            "metadata":       {"decision": payload.decision, "statement": payload.statement},
            "timestamp":      decided_at,
        })

        logger.info("Human decision '%s' for %s persisted to MongoDB.", payload.decision, app_id)

    except Exception as e:
        mongo_error = str(e)
        logger.warning("MongoDB decision write failed (%s) — recorded in-memory only.", e)

    response = {
        "message": f"Decision '{payload.decision}' recorded for {app_id} by {payload.officer_name}.",
        "decided_at": decided_at,
        "application": _enrich(target_app),
    }
    if mongo_error:
        response["mongo_warning"] = f"Decision saved in-memory only. MongoDB write failed: {mongo_error}"

    return response

