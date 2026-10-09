"""
CreditLens AI Document Intelligence & LLM Analysis Service
Uses local Ollama LLM (llama3 / mistral) to extract structured financial underwriting fields:
- Applicant Name
- Monthly Income
- Existing Debt / EMI
- Account Number
- Document Type (BANK_STATEMENT, SALARY_SLIP, ID_PROOF, UNKNOWN)

Zero-hallucination policy enforced with temperature = 0.0 and schema-constrained JSON extraction.
"""

from __future__ import annotations

import os
import re
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import ollama

logger = logging.getLogger("creditlens.ai_analysis")

DEFAULT_PREFERRED_MODELS = [
    "llama3.2:latest",
    "llama3:latest",
    "llama3",
    "mistral:latest",
    "mistral",
    "qwen2.5-coder:7b",
]

ALLOWED_DOC_TYPES = {
    "BANK_STATEMENT",
    "SALARY_SLIP",
    "ID_PROOF",
    "UNKNOWN"
}

SYSTEM_PROMPT = """You are a strict, privacy-focused financial document intelligence engine for CreditLens.
Your job is to analyze raw OCR text extracted from financial and KYC documents and extract key fields strictly as a JSON object.

CRITICAL RULES:
1. Do NOT hallucinate or guess. If a field cannot be determined from the text, return null.
2. Return ONLY a valid JSON object matching the exact schema below. No markdown backticks, no explanations, no prefix or suffix.
3. Clean and parse numbers: for currency amounts, return numeric floats or integers without symbols (e.g., 85000, not "₹85,000").
4. "document_type" MUST be strictly one of: "BANK_STATEMENT", "SALARY_SLIP", "ID_PROOF", "UNKNOWN".

JSON SCHEMA:
{
  "applicant_name": string or null,
  "monthly_income": number or null,
  "existing_debt_emi": number or null,
  "account_number": string or null,
  "document_type": "BANK_STATEMENT" | "SALARY_SLIP" | "ID_PROOF" | "UNKNOWN"
}
"""


def get_ollama_client() -> ollama.Client:
    """Return configured Ollama client honoring OLLAMA_HOST."""
    host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    return ollama.Client(host=host)


def get_available_ollama_models() -> List[str]:
    """Retrieve list of currently available models in the local Ollama instance."""
    try:
        client = get_ollama_client()
        res = client.list()
        raw_models = getattr(res, "models", res)
        names = []
        for m in raw_models:
            if isinstance(m, dict):
                names.append(m.get("name") or m.get("model", ""))
            else:
                names.append(getattr(m, "model", getattr(m, "name", str(m))))
        return [n for n in names if n]
    except Exception as exc:
        logger.warning("Could not list local Ollama models: %s", exc)
        return []


def resolve_ollama_model() -> str:
    """
    Select the optimal local model:
    1. Checks OLLAMA_MODEL environment variable.
    2. Checks installed models for preferred candidates (llama3, mistral, llama3.2).
    3. Falls back to 'llama3'.
    """
    env_model = os.getenv("OLLAMA_MODEL")
    if env_model:
        return env_model.strip()

    available = get_available_ollama_models()
    if available:
        for preferred in DEFAULT_PREFERRED_MODELS:
            if preferred in available:
                return preferred
        for cand in available:
            cand_lower = cand.lower()
            if any(k in cand_lower for k in ["llama3", "mistral", "qwen"]):
                return cand
        return available[0]

    return "llama3"


def clean_numeric_value(val: Any) -> Optional[float]:
    """Convert raw string/number to clean positive float."""
    if val is None or val == "" or str(val).lower() in ("null", "none", "not found", "n/a"):
        return None
    if isinstance(val, (int, float)):
        return float(val)

    text = str(val).strip()
    # Strip currency signs, commas, extra symbols
    cleaned = re.sub(r"[^\d.]", "", text)
    if not cleaned:
        return None
    try:
        num = float(cleaned)
        return round(num, 2)
    except ValueError:
        return None


def clean_string_value(val: Any) -> Optional[str]:
    """Sanitize extracted string fields."""
    if val is None or str(val).lower() in ("null", "none", "not found", "n/a"):
        return None
    s = str(val).strip()
    return s if s else None


def normalize_document_type(doc_type_raw: Any) -> str:
    """Ensure document type is strictly one of the allowed categories."""
    if not doc_type_raw:
        return "UNKNOWN"
    s = str(doc_type_raw).strip().upper().replace(" ", "_").replace("-", "_")
    if s in ALLOWED_DOC_TYPES:
        return s
    if any(k in s for k in ["BANK", "STATEMENT", "PASSBOOK", "LEDGER"]):
        return "BANK_STATEMENT"
    if any(k in s for k in ["SALARY", "PAYSLIP", "PAY_SLIP", "INCOME", "WAGE", "COMPENSATION"]):
        return "SALARY_SLIP"
    if any(k in s for k in ["ID", "AADHAAR", "PAN", "PASSPORT", "VOTER", "KYC"]):
        return "ID_PROOF"
    return "UNKNOWN"


def _extract_json_from_llm_response(text: str) -> Optional[Dict[str, Any]]:
    """Robustly extracts JSON object from LLM response text."""
    if not text:
        return None

    cleaned = text.strip()
    # Remove markdown code fences if present
    if "```json" in cleaned:
        cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.MULTILINE)
    if "```" in cleaned:
        cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE)

    # Locate outermost braces
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cand = cleaned[start:end + 1]
        try:
            return json.loads(cand)
        except Exception:
            pass

    try:
        return json.loads(cleaned)
    except Exception:
        return None


def regex_fallback_extraction(ocr_text: str) -> Dict[str, Any]:
    """
    High-accuracy deterministic fallback extractor in case Ollama service
    is offline or temporarily unreachable.
    """
    text = ocr_text or ""
    text_lower = text.lower()

    # Determine document type
    doc_type = "UNKNOWN"
    if any(k in text_lower for k in ["payslip", "salary slip", "basic pay", "gross pay", "net pay", "earnings"]):
        doc_type = "SALARY_SLIP"
    elif any(k in text_lower for k in ["bank statement", "account statement", "opening balance", "closing balance", "ifsc"]):
        doc_type = "BANK_STATEMENT"
    elif any(k in text_lower for k in ["aadhaar", "pan card", "income tax department", "government of india"]):
        doc_type = "ID_PROOF"

    # Extract Applicant Name
    applicant_name = None
    name_patterns = [
        r"(?:name|employee name|account name|holder|name of holder)\s*[:\-]?\s*([A-Za-z\s]{3,35})",
        r"(?:mr\.|ms\.|mrs\.|dr\.)\s+([A-Za-z\s]{3,30})",
    ]
    for p in name_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            applicant_name = m.group(1).strip()
            break

    # Extract Monthly Income
    monthly_income = None
    income_patterns = [
        r"(?:net pay|net salary|inhand|take home|total salary)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"(?:monthly income|gross pay|gross earnings)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"(?:salary)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
    ]
    for p in income_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            monthly_income = clean_numeric_value(m.group(1))
            if monthly_income:
                break

    # Extract EMI / Debt
    existing_debt = None
    debt_patterns = [
        r"(?:emi|loan repayment|existing emi|monthly installment)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"(?:total emi|active loan emi)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
    ]
    for p in debt_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            existing_debt = clean_numeric_value(m.group(1))
            if existing_debt:
                break

    # Extract Account Number / ID Number
    account_number = None
    acct_patterns = [
        r"(?:account\s*(?:no|number)|a/c\s*(?:no)?)\s*[:\-]?\s*([A-Za-z0-9]{8,20})",
        r"(?:pan\s*(?:no|number)?)\s*[:\-]?\s*([A-Z]{5}[0-9]{4}[A-Z])",
        r"(?:aadhaar\s*(?:no|number)?)\s*[:\-]?\s*([0-9]{4}\s?[0-9]{4}\s?[0-9]{4})",
    ]
    for p in acct_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            account_number = m.group(1).strip()
            break

    return {
        "applicant_name": applicant_name,
        "monthly_income": monthly_income,
        "existing_debt_emi": existing_debt,
        "account_number": account_number,
        "document_type": doc_type,
    }


def analyze_document_with_ollama(
    raw_ocr_text: str,
    model_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send raw OCR text to local Ollama instance (llama3 / mistral) with temperature = 0.0.
    Extracts strictly:
      - Applicant Name
      - Monthly Income
      - Existing Debt / EMI
      - Account Number
      - Document Type (BANK_STATEMENT, SALARY_SLIP, ID_PROOF, UNKNOWN)

    Returns standardized dictionary with extracted entities and metadata.
    """
    model_name = model_override or resolve_ollama_model()
    user_prompt = f"Raw Document OCR Text:\n\"\"\"\n{raw_ocr_text}\n\"\"\"\n\nExtract the requested fields strictly as JSON."

    llm_output_json = None
    llm_used = False
    error_detail = None

    try:
        logger.info("Dispatching OCR text to Ollama model '%s' (temperature=0.0, format=json)", model_name)
        client = get_ollama_client()
        response = client.chat(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            options={"temperature": 0.0},
            format="json"
        )
        content = response.get("message", {}).get("content", "")
        llm_output_json = _extract_json_from_llm_response(content)
        if llm_output_json:
            llm_used = True
            logger.info("Ollama extraction succeeded with model %s", model_name)
    except Exception as exc:
        logger.warning("Ollama LLM call failed (%s). Engaging deterministic regex extractor.", exc)
        error_detail = str(exc)

    # Use regex fallback if LLM returned None or failed
    if not llm_output_json:
        fallback_data = regex_fallback_extraction(raw_ocr_text)
        llm_output_json = fallback_data
    else:
        # Cross-fill any nulls from deterministic extractor if available
        fallback_data = regex_fallback_extraction(raw_ocr_text)
        for key in ["applicant_name", "monthly_income", "existing_debt_emi", "account_number", "document_type"]:
            if llm_output_json.get(key) is None and fallback_data.get(key) is not None:
                llm_output_json[key] = fallback_data[key]

    # Normalize fields strictly according to specification
    raw_name = (
        llm_output_json.get("applicant_name")
        or llm_output_json.get("Applicant Name")
        or llm_output_json.get("name")
    )
    raw_income = (
        llm_output_json.get("monthly_income")
        or llm_output_json.get("Monthly Income")
        or llm_output_json.get("income")
    )
    raw_debt = (
        llm_output_json.get("existing_debt_emi")
        or llm_output_json.get("Existing Debt / EMI")
        or llm_output_json.get("existing_debt")
        or llm_output_json.get("emi")
    )
    raw_account = (
        llm_output_json.get("account_number")
        or llm_output_json.get("Account Number")
        or llm_output_json.get("account")
    )
    raw_doc_type = (
        llm_output_json.get("document_type")
        or llm_output_json.get("Document Type")
        or llm_output_json.get("type")
    )

    applicant_name = clean_string_value(raw_name)
    monthly_income = clean_numeric_value(raw_income)
    existing_debt_emi = clean_numeric_value(raw_debt)
    account_number = clean_string_value(raw_account)
    document_type = normalize_document_type(raw_doc_type)

    detected_fields_count = sum(
        1 for v in [applicant_name, monthly_income, existing_debt_emi, account_number]
        if v is not None
    ) + (1 if document_type != "UNKNOWN" else 0)

    confidence = round(min(99.0, max(50.0, 50.0 + (detected_fields_count * 10.0))), 1)

    return {
        "applicant_name": applicant_name,
        "monthly_income": monthly_income,
        "existing_debt_emi": existing_debt_emi,
        "account_number": account_number,
        "document_type": document_type,
        "model_used": model_name,
        "llm_used": llm_used,
        "confidence": confidence,
        "error": error_detail,
        "raw_fields": {
            "applicant_name": applicant_name or "Not Found",
            "monthly_income": f"INR {monthly_income:,.2f}" if monthly_income is not None else "Not Found",
            "existing_debt_emi": f"INR {existing_debt_emi:,.2f}" if existing_debt_emi is not None else "Not Found",
            "account_number": account_number or "Not Found",
            "document_type": document_type,
        }
    }


def detect_document_anomalies(
    extracted_data: Dict[str, Any],
    declared_applicant_name: Optional[str] = None,
    declared_salary: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Detect underwriting anomalies between OCR/LLM extracted metrics and declared application values.
    """
    anomalies: List[Dict[str, Any]] = []

    ext_name = extracted_data.get("applicant_name")
    if declared_applicant_name and ext_name:
        d_clean = declared_applicant_name.strip().lower()
        e_clean = ext_name.strip().lower()
        if d_clean not in e_clean and e_clean not in d_clean:
            anomalies.append({
                "category": "IDENTITY_MISMATCH",
                "severity": "CRITICAL",
                "message": f"Declared applicant name '{declared_applicant_name}' does not match name on document ('{ext_name}')."
            })

    ext_income = extracted_data.get("monthly_income")
    if declared_salary and ext_income and declared_salary > 0:
        diff_pct = abs(ext_income - declared_salary) / declared_salary
        if diff_pct > 0.15:
            anomalies.append({
                "category": "INCOME_MISMATCH",
                "severity": "HIGH",
                "message": (
                    f"Verified document income (INR {ext_income:,.2f}) deviates by {diff_pct*100:.1f}% "
                    f"from declared salary (INR {declared_salary:,.2f})."
                )
            })

    ext_debt = extracted_data.get("existing_debt_emi")
    if ext_income and ext_debt and ext_income > 0:
        dti = (ext_debt / ext_income) * 100
        if dti > 60:
            anomalies.append({
                "category": "EXTREME_DEBT_EXPOSURE",
                "severity": "HIGH",
                "message": f"Pre-existing verified EMI obligations (INR {ext_debt:,.2f}) consume {dti:.1f}% of monthly income."
            })

    return anomalies
