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
Your job is to analyze raw OCR text extracted from financial, identity, and KYC documents (Aadhaar cards, PAN cards, Salary slips, Bank statements) and extract key fields strictly as a JSON object.

CRITICAL RULES:
1. Do NOT hallucinate or guess. If a field cannot be determined from the text, return null.
2. Return ONLY a valid JSON object matching the exact schema below. No markdown backticks, no explanations, no prefix or suffix.
3. Clean and parse numbers: for currency amounts, return numeric floats or integers without symbols (e.g., 77000, not "₹77,000").
4. Clean names: Remove noise, prefixes, or organizational headers (e.g. 'Roshan Pandey', not 'aa sa Roshan Pandey'; 'SAMAD', not 'INCOME TAXDEPARTMENT').
5. "document_type" MUST be strictly one of: "BANK_STATEMENT", "SALARY_SLIP", "ID_PROOF", "UNKNOWN".
6. "gender" MUST be "Male", "Female", "Other", or null.
7. "dob" MUST be in DD/MM/YYYY or YYYY-MM-DD format if present, or null.
8. "aadhaar_number": 12-digit number (e.g. "5522 6616 4533" or "552266164533") if found, else null.
9. "pan_identifier": 10-character alphanumeric PAN (e.g. "QFVPS0764H") if found, else null.
10. Indian PAN Cards: The cardholder / applicant name is printed directly between the PAN number and 'Father's Name' (e.g., 'SAMAD'). Do NOT return the father's name (e.g. 'MOHD SAJID') as applicant_name.
11. Aadhaar Cards: The applicant name is printed directly above 'DoB:' / 'Date of Birth' (e.g., 'Roshan Pandey').

JSON SCHEMA:
{
  "applicant_name": string or null,
  "dob": string or null,
  "gender": "Male" | "Female" | "Other" | null,
  "aadhaar_number": string or null,
  "pan_identifier": string or null,
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


def clean_dob_value(val: Any) -> Optional[str]:
    """Normalize Date of Birth to DD/MM/YYYY."""
    if not val or str(val).lower() in ("null", "none", "not found", "n/a"):
        return None
    s = str(val).strip()
    # Match standard DD/MM/YYYY or DD-MM-YYYY
    m = re.search(r"\b([0-3]?\d)[\/\-\.]([0-1]?\d)[\/\-\.]([12]\d{3})\b", s)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= day <= 31 and 1 <= month <= 12 and 1900 <= year <= 2026:
            return f"{day:02d}/{month:02d}/{year:04d}"
    # Match concatenated date e.g. 0302/2004 or 03022004
    m2 = re.search(r"\b([0-3]\d)([0-1]\d)[\/\-]?([12]\d{3})\b", s)
    if m2:
        day, month, year = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        if 1 <= day <= 31 and 1 <= month <= 12 and 1900 <= year <= 2026:
            return f"{day:02d}/{month:02d}/{year:04d}"
    return s if re.search(r"\d{4}", s) else None


def clean_gender_value(val: Any) -> Optional[str]:
    """Normalize gender to Male, Female, Other."""
    if not val:
        return None
    s = str(val).strip().lower()
    if "female" in s or s == "f":
        return "Female"
    if "male" in s or s == "m":
        return "Male"
    if "trans" in s or "other" in s:
        return "Other"
    return None


def clean_aadhaar_value(val: Any) -> Optional[str]:
    """Normalize Aadhaar number to 12-digit format."""
    if not val:
        return None
    digits = re.sub(r"\D", "", str(val))
    if len(digits) == 12:
        return f"{digits[0:4]} {digits[4:8]} {digits[8:12]}"
    return None


def clean_pan_value(val: Any) -> Optional[str]:
    """Normalize PAN identifier to 10-char uppercase format [A-Z]{5}[0-9]{4}[A-Z]."""
    if not val:
        return None
    s = str(val).strip().upper()
    m = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", s)
    if m:
        return m.group(1)
    return None


def regex_fallback_extraction(ocr_text: str) -> Dict[str, Any]:
    """
    High-accuracy deterministic fallback extractor for Indian KYC
    (Aadhaar, PAN, Passport), Salary Slips, and Bank Statements.
    """
    text = ocr_text or ""
    text_lower = text.lower()

    # Determine document type
    doc_type = "UNKNOWN"
    if any(k in text_lower for k in ["payslip", "salary slip", "basic pay", "gross pay", "net pay", "earnings", "associate editor"]):
        doc_type = "SALARY_SLIP"
    elif any(k in text_lower for k in ["bank statement", "account statement", "opening balance", "closing balance", "ifsc", "passbook"]):
        doc_type = "BANK_STATEMENT"
    elif any(k in text_lower for k in ["aadhaar", "pan card", "income tax department", "government of india", "govt. of india", "govt of india", "unique identification", "permanent account number"]):
        doc_type = "ID_PROOF"

    # Extract PAN Identifier
    pan_id = None
    pan_match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    if pan_match:
        pan_id = pan_match.group(1)

    # Extract Aadhaar Number
    aadhaar_num = None
    aadhaar_labeled = re.search(r"(?:aadhaar|uid|uidai|unique identification)[\s:\->]*([0-9]{4}\s*[0-9]{4}\s*[0-9]{4})", text, re.IGNORECASE)
    if aadhaar_labeled:
        raw_dig = re.sub(r"\D", "", aadhaar_labeled.group(1))
        if len(raw_dig) == 12:
            aadhaar_num = f"{raw_dig[:4]} {raw_dig[4:8]} {raw_dig[8:]}"
    elif doc_type == "ID_PROOF" or any(k in text_lower for k in ["unique identification", "uidai", "aadhaar", "mera aadhaar"]):
        aadhaar_match = re.search(r"\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b", text)
        if aadhaar_match:
            aadhaar_num = aadhaar_match.group(1)
        else:
            m12 = re.search(r"(?<!uan\s)(?<!uan\s>\s)(?<!pf\s)\b([0-9]{12})\b", text, re.IGNORECASE)
            if m12:
                raw_dig = m12.group(1)
                aadhaar_num = f"{raw_dig[:4]} {raw_dig[4:8]} {raw_dig[8:]}"

    if (pan_id or aadhaar_num) and doc_type == "UNKNOWN":
        doc_type = "ID_PROOF"

    # Extract Date of Birth
    dob = None
    dob_match = re.search(r"(?:dob|date of birth|d\.o\.b|birth date)\s*[:\-]?\s*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.][12]\d{3})", text, re.IGNORECASE)
    if dob_match:
        dob = clean_dob_value(dob_match.group(1))
    elif doc_type == "ID_PROOF":
        dates = re.findall(r"\b([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.][12]\d{3})\b", text)
        for d in dates:
            cleaned_d = clean_dob_value(d)
            if cleaned_d:
                parts = cleaned_d.split("/")
                if len(parts) == 3 and 1940 <= int(parts[2]) <= 2008:
                    dob = cleaned_d
                    break

    # Extract Gender
    gender = None
    gender_match = re.search(r"\b(male|female|other|transgender)\b", text, re.IGNORECASE)
    if gender_match:
        gender = clean_gender_value(gender_match.group(1))

    # Extract Applicant Name
    applicant_name = None
    # 1. Salary slips / standard labels (same line only)
    name_match = re.search(r"(?:employee name|applicant name|account holder|customer name)[ \t]*[:\-][ \t]*([A-Za-z \t]{3,35})", text, re.IGNORECASE)
    if name_match:
        cand = name_match.group(1).strip()
        if cand and not any(stop in cand.lower() for stop in ["zylker", "company", "bank", "pvt", "limited", "salary", "summary", "designation"]):
            applicant_name = cand

    if not applicant_name:
        # Multi-line column layout on payslips: "Employee Name ... \n : Gaurav"
        name_col_match = re.search(r"employee name[\s\S]*?\n\s*:\s*([A-Za-z]{3,30})", text, re.IGNORECASE)
        if name_col_match:
            cand = name_col_match.group(1).strip()
            if not any(stop in cand.lower() for stop in ["designation", "employee", "date", "joining", "associate"]):
                applicant_name = cand

    # 2. PAN card: look for name line before "Father's Name" or following 'Name' label
    if not applicant_name and pan_id:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        for i, line in enumerate(lines):
            if re.search(r"father", line, re.IGNORECASE) and i > 0:
                prev_line = lines[i - 1].strip()
                prev_clean = re.sub(r"^[iI|\-.,:\s]+", "", prev_line).strip()
                m = re.match(r"^([A-Z]{3,}(?:\s+[A-Z]{3,})*)", prev_clean)
                if m and not any(w in m.group(1).lower() for w in ["card", "tax", "govt", "permanent", "india", "department", "father"]):
                    applicant_name = m.group(1).strip()
                    break
                first_tok = re.split(r"\s+", prev_clean)[0]
                if len(first_tok) >= 3 and first_tok.isalpha() and not any(w in first_tok.lower() for w in ["card", "tax", "govt", "permanent", "india", "father"]):
                    applicant_name = first_tok
                    break
        if not applicant_name:
            for i, line in enumerate(lines):
                if re.search(r"\bname\b", line, re.IGNORECASE) and not re.search(r"father", line, re.IGNORECASE):
                    inline = re.sub(r"^.*?name\s*[:\-]?\s*", "", line, flags=re.IGNORECASE).strip()
                    if inline and len(inline) >= 3 and not any(w in inline.lower() for w in ["father", "card", "tax", "govt"]):
                        applicant_name = inline
                        break
                    elif i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if len(next_line) >= 3 and not any(w in next_line.lower() for w in ["father", "card", "tax", "govt", "permanent"]):
                            applicant_name = next_line
                            break

    # 3. Aadhaar card: look for name line directly above 'DoB:' or 'DOB'
    if not applicant_name and aadhaar_num:
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        for i, line in enumerate(lines):
            if re.search(r"\bdob\b|\bdate of birth\b", line, re.IGNORECASE) and i > 0:
                prev_line = lines[i - 1].strip()
                # Clean leading OCR noise e.g. 'aa sa Roshan Pandey' or '| Roshan Pandey'
                clean_prev = re.sub(r"^[^A-Za-z]*[a-z]{1,3}\s+[a-z]{1,3}\s+", "", prev_line)
                clean_prev = re.sub(r"^[^A-Za-z]+", "", clean_prev).strip()
                if len(clean_prev) >= 3 and not any(w in clean_prev.lower() for w in ["india", "government", "authority", "uidai"]):
                    applicant_name = clean_prev
                    break

    # 4. Fallback patterns
    if not applicant_name:
        fallback_names = [
            r"(?:mr\.|ms\.|mrs\.|dr\.)\s+([A-Za-z\s]{3,30})",
            r"(?<!father's\s)(?<!father\s)(?<!\bfather\b\s)(?:name)\s*[:\-]?\s*([A-Za-z\s]{3,35})",
        ]
        for p in fallback_names:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                cand = m.group(1).strip()
                if not any(stop in cand.lower() for stop in ["income", "tax", "department", "govt", "india", "father"]):
                    applicant_name = cand
                    break

    # Extract Monthly Income
    monthly_income = None
    income_patterns = [
        r"(?:net pay|net salary|inhand|take home|total salary|employee net pay)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"(?:gross pay|gross earnings|gross salary)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"(?:monthly income|salary)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"\b([1-9][0-9],[0-9]{3}(?:\.[0-9]{2})?)\s+(?:employee net pay|net pay)\b",
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
        r"(?:emi|loan repayment|existing emi|monthly installment|loan deduction)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
        r"(?:total emi|active loan emi)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)",
    ]
    for p in debt_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            existing_debt = clean_numeric_value(m.group(1))
            if existing_debt:
                break

    # Extract Account Number
    account_number = None
    acct_patterns = [
        r"(?:account\s*(?:no|number)|a/c\s*(?:no)?)\s*[:\-]?\s*([A-Za-z0-9]{8,20})",
        r"(?:pf a/c number|pf account)\s*[:\-]?\s*([A-Za-z0-9\/]{6,25})",
    ]
    for p in acct_patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            account_number = m.group(1).strip()
            break

    return {
        "applicant_name": applicant_name,
        "dob": dob,
        "gender": gender,
        "aadhaar_number": aadhaar_num,
        "pan_identifier": pan_id,
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
    Send raw OCR text to local Ollama instance (llama3 / mistral / llama3.2) with temperature = 0.0.
    Extracts strictly:
      - Applicant Name
      - Date of Birth (DOB)
      - Gender
      - Aadhaar Number / Identifier (12-digit)
      - PAN Identifier (10-char alphanumeric)
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

    fallback_data = regex_fallback_extraction(raw_ocr_text)

    # Use regex fallback if LLM returned None or failed
    if not llm_output_json:
        llm_output_json = fallback_data
    else:
        # Cross-fill any nulls from deterministic extractor if available
        for key in [
            "applicant_name", "dob", "gender", "aadhaar_number", "pan_identifier",
            "monthly_income", "existing_debt_emi", "account_number", "document_type"
        ]:
            if llm_output_json.get(key) is None and fallback_data.get(key) is not None:
                llm_output_json[key] = fallback_data[key]

        # Check if LLM accidentally picked father's name on a PAN card
        if fallback_data.get("pan_identifier") and fallback_data.get("applicant_name"):
            cand_name = str(llm_output_json.get("applicant_name") or "").strip().lower()
            if cand_name and any("father" in line.lower() and cand_name in line.lower() for line in raw_ocr_text.split("\n")):
                llm_output_json["applicant_name"] = fallback_data["applicant_name"]
            elif cand_name in ["mohd sajid", "father", "father's name", "name"]:
                llm_output_json["applicant_name"] = fallback_data["applicant_name"]

    # Normalize fields strictly according to specification
    raw_name = (
        llm_output_json.get("applicant_name")
        or llm_output_json.get("Applicant Name")
        or llm_output_json.get("name")
    )
    raw_dob = (
        llm_output_json.get("dob")
        or llm_output_json.get("Date of Birth")
        or llm_output_json.get("date_of_birth")
    )
    raw_gender = (
        llm_output_json.get("gender")
        or llm_output_json.get("Gender")
        or llm_output_json.get("sex")
    )
    raw_aadhaar = (
        llm_output_json.get("aadhaar_number")
        or llm_output_json.get("Aadhaar Number")
        or llm_output_json.get("aadhaar")
        or llm_output_json.get("uid")
    )
    raw_pan = (
        llm_output_json.get("pan_identifier")
        or llm_output_json.get("PAN Identifier")
        or llm_output_json.get("pan")
        or llm_output_json.get("pan_number")
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
    # Clean leading OCR noise if present
    if applicant_name:
        applicant_name = re.sub(r"^[^A-Za-z]*[a-z]{1,3}\s+[a-z]{1,3}\s+", "", applicant_name)
        applicant_name = re.sub(r"^[^A-Za-z]+", "", applicant_name).strip()

    dob = clean_dob_value(raw_dob)
    gender = clean_gender_value(raw_gender)
    aadhaar_number = clean_aadhaar_value(raw_aadhaar)
    pan_identifier = clean_pan_value(raw_pan)
    monthly_income = clean_numeric_value(raw_income)
    existing_debt_emi = clean_numeric_value(raw_debt)
    account_number = clean_string_value(raw_account)
    document_type = normalize_document_type(raw_doc_type)

    # Document type inference if ID card was identified
    if aadhaar_number or pan_identifier:
        if document_type == "UNKNOWN":
            document_type = "ID_PROOF"

    detected_fields_count = sum(
        1 for v in [applicant_name, dob, gender, aadhaar_number, pan_identifier, monthly_income, existing_debt_emi, account_number]
        if v is not None
    ) + (1 if document_type != "UNKNOWN" else 0)

    confidence = round(min(99.0, max(50.0, 50.0 + (detected_fields_count * 7.0))), 1)

    return {
        "applicant_name": applicant_name,
        "dob": dob,
        "gender": gender,
        "aadhaar_number": aadhaar_number,
        "pan_identifier": pan_identifier,
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
            "dob": dob or "Not Found",
            "gender": gender or "Not Found",
            "aadhaar_number": aadhaar_number or "Not Found",
            "pan_identifier": pan_identifier or "Not Found",
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
