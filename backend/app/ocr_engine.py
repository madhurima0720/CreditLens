import io
import json
import os
import re
from typing import Dict, Any, Optional

import pypdf
import requests
from PIL import Image, ImageOps
import pytesseract

try:
    from pdf2image import convert_from_bytes
except Exception:  # pragma: no cover
    convert_from_bytes = None

ALL_FIELDS = [
    "name",
    "dob",
    "gender",
    "aadhaar",
    "pan",
    "phone",
    "email",
    "address",
    "loan_type",
    "loan_amount",
    "interest_rate",
    "tenure",
    "emi",
    "loan_account_number",
    "dates",
    "outstanding_amount",
    "income",
    "existing_loans_emis",
    "bank_details",
    "assets",
    "liabilities",
    "collateral",
]


def _clean_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _normalize_numeric_digits(value: str) -> str:
    digits = re.sub(r"\D+", "", value or "")
    return digits


def _extract_json_payload(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = text[start:end + 1]
            return json.loads(candidate)
    except Exception:
        pass
    try:
        return json.loads(text)
    except Exception:
        return None


def extract_text_from_bytes(file_bytes: bytes, filename: str, doc_type: str = "") -> str:
    fn_lower = filename.lower()
    text = ""

    if fn_lower.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                extracted = page.extract_text() or ""
                if extracted:
                    text += extracted + "\n"
        except Exception:
            pass

    if not text.strip() and fn_lower.endswith(".pdf") and convert_from_bytes:
        try:
            pages = convert_from_bytes(file_bytes)
            for page in pages:
                page = ImageOps.grayscale(page)
                text += pytesseract.image_to_string(page) + "\n"
        except Exception:
            pass

    if not text.strip() and fn_lower.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff")):
        try:
            image = Image.open(io.BytesIO(file_bytes))
            image = ImageOps.grayscale(image)
            text = pytesseract.image_to_string(image)
        except Exception:
            pass

    if not text.strip():
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except Exception:
                pass

    if not text.strip():
        try:
            strings = re.findall(rb"[A-Za-z0-9\s.,:;@#\-\(\)\/\$%\+]{4,}", file_bytes)
            text = " ".join(s.decode("latin-1", errors="ignore") for s in strings)
        except Exception:
            pass

    if not text.strip():
        try:
            import subprocess
            if os.name == "nt":
                import tempfile
                with tempfile.NamedTemporaryFile(suffix=os.path.splitext(filename)[1] or ".png", delete=False) as tmp:
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                try:
                    text = subprocess.check_output(['tesseract', tmp_path, 'stdout'], stderr=subprocess.DEVNULL, text=True)
                except Exception:
                    text = ""
                finally:
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass
        except Exception:
            pass

    return _clean_text(text)


def _first_match(patterns, text: str, flags: int = 0) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            return _clean_text(match.group(1))
    return None


def _candidate_name(text: str) -> Optional[str]:
    lines = [line.strip() for line in text.replace("\r", "\n").split("\n") if line.strip()]
    label_patterns = [
        "Applicant Name", "Customer Name", "Cardholder Name", "Policyholder Name",
        "Account Holder", "Name of Applicant", "Name"
    ]
    for line in lines:
        for label in label_patterns:
            if line.lower().startswith(label.lower()):
                remainder = line[len(label):].lstrip(":- ")
                remainder = re.split(r"\s+(?:DOB|Date of Birth|D\.O\.B|Gender|Address|Mobile|Phone|PAN|Aadhaar|UID|Email)\b", remainder, flags=re.IGNORECASE)[0].strip()
                if len(remainder) > 2 and not re.search(r"\b(statement|bank|invoice|receipt|limited|pvt|private|company|corporation)\b", remainder, re.IGNORECASE):
                    return remainder

    patterns = [
        r"(?:Applicant Name|Customer Name|Cardholder Name|Policyholder Name|Account Holder|Name of Applicant|Name)[\s:]+([A-Z][A-Za-z.\s]{2,60})(?=\s*(?:DOB|Date of Birth|D\.O\.B|Gender|Address|Mobile|Phone|PAN|Aadhaar|UID|Email|Token|$))",
        r"(?:Mr\.|Ms\.|Mrs\.)\s*([A-Z][A-Za-z.\s]{2,60})(?=\s*(?:DOB|Date of Birth|D\.O\.B|Gender|Address|Mobile|Phone|PAN|Aadhaar|UID|Email|[A-Z]{2,}|$))",
        r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,5})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = _clean_text(match.group(1))
            candidate = re.split(r"\s+(?:DOB|Date of Birth|D\.O\.B|Gender|Address|Mobile|Phone|PAN|Aadhaar|UID|Email)\b", candidate, flags=re.IGNORECASE)[0].strip()
            if len(candidate) > 2 and not re.search(r"\b(statement|bank|invoice|receipt|limited|pvt|private|company|corporation)\b", candidate, re.IGNORECASE):
                return candidate
    return None


def _trim_contact_tail(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    cleaned = re.split(r"\s+(?:Phone|Mobile|Contact|Tel|Email)\b", value, flags=re.IGNORECASE)[0].strip()
    return cleaned if cleaned else value


def extract_field_values(raw_text: str, filename: str = "", doc_type: str = "") -> Dict[str, str]:
    res: Dict[str, str] = {field: "Not Found" for field in ALL_FIELDS}
    if not raw_text or not raw_text.strip():
        return res

    text = raw_text.replace("\r", "\n")
    doc_label = (doc_type or filename or "").lower()

    pan_match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    if pan_match:
        res["pan"] = pan_match.group(1)
    else:
        pan_alt = _first_match([r"(?:PAN|Permanent Account Number)[\s:]*([A-Z]{5}[0-9]{4}[A-Z])", r"\b([A-Z]{5}[0-9]{4}[A-Z])\b"], text, re.IGNORECASE)
        if pan_alt:
            res["pan"] = pan_alt

    aadhaar_digits = _first_match([
        r"(?:Aadhaar|UID|UIDAI|Aadhaar No\.?|Aadhaar Number)[\s:]*([0-9]{12})",
        r"\b([0-9]{4}\s[0-9]{4}\s[0-9]{4})\b",
        r"\b([0-9]{12})\b",
    ], text, re.IGNORECASE)
    if aadhaar_digits:
        clean_aadhaar = re.sub(r"\D+", "", aadhaar_digits)
        if len(clean_aadhaar) == 12:
            res["aadhaar"] = clean_aadhaar

    dob_match = _first_match([
        r"(?:DOB|Date of Birth|D\.O\.B|Birth Date)[\s:]*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.]\d{4})",
        r"(?:DOB|Date of Birth)[\s:]*([A-Za-z]+\s\d{1,2},?\s\d{4})",
        r"\b([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.]\d{4})\b",
    ], text, re.IGNORECASE)
    if dob_match:
        res["dob"] = dob_match

    gender_match = _first_match([
        r"(?:Gender|Sex)[\s:]*([A-Za-z]+)",
    ], text, re.IGNORECASE)
    if gender_match:
        gender = gender_match.strip()
        normalized = gender.lower()
        if normalized in {"male", "female", "transgender", "other"}:
            res["gender"] = gender.capitalize()

    name_match = _candidate_name(text)
    if name_match:
        res["name"] = name_match

    address_match = _first_match([
        r"(?:Address|Current Address|Permanent Address|Residential Address|Communication Address)[\s:]+([^\n]{20,200})",
        r"(?:(?:House|Flat|Building|Street|Road|Village|Town|City|State|Pin|Pincode).{15,180})",
    ], text, re.IGNORECASE)
    if address_match:
        address = _trim_contact_tail(address_match)
        if address:
            res["address"] = address

    email_match = _first_match([r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b"], text)
    if email_match:
        res["email"] = email_match

    phone_match = _first_match([
        r"(?:Phone|Mobile|Contact|Tel)[\s:]*\+?91[\s\-]?([6-9]\d{9})",
        r"(?:Phone|Mobile|Contact|Tel)[\s:]*([6-9]\d{9})",
        r"\b(?:\+?91[\s\-]?)?([6-9]\d{9})\b",
    ], text, re.IGNORECASE)
    if phone_match:
        res["phone"] = phone_match

    loan_types = [
        "Home Loan", "Vehicle Loan", "Education Loan", "Personal Loan",
        "Business Loan", "Agricultural Loan", "Gold Loan", "Loan Against Property",
        "Consumer Loan", "Equipment & Machinery Loan", "Loan Against Securities", "Auto Loan"
    ]
    for lt in loan_types:
        if re.search(r"\b" + re.escape(lt) + r"\b", text, re.IGNORECASE):
            res["loan_type"] = lt
            break

    loan_amount_match = _first_match([
        r"(?:Loan Amount|Sanctioned Amount|Principal Amount|Requested Loan)[\s:]*[\-:]*\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)",
        r"(?:Amount\s+Sanctioned|Sanctioned\s+Amount)[\s:]*[\-:]*\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)",
    ], text, re.IGNORECASE)
    if loan_amount_match:
        res["loan_amount"] = f"₹{loan_amount_match}"

    roi_match = _first_match([
        r"(?:Interest Rate|Rate of Interest|ROI|Annual Interest)[\s:]*([\d.]+\s*%)",
        r"\b([\d.]+)%\s*(?:p\.a\.|per annum|interest)",
    ], text, re.IGNORECASE)
    if roi_match:
        res["interest_rate"] = roi_match if "%" in roi_match else f"{roi_match}%"

    tenure_match = _first_match([
        r"(?:Tenure|Term|Loan Duration|Repayment Period)[\s:]*([\d]+\s*(?:months?|years?|yrs?|mths?))",
    ], text, re.IGNORECASE)
    if tenure_match:
        res["tenure"] = tenure_match

    emi_match = _first_match([
        r"(?:EMI|Monthly Installment|Installment Amount)[\s:]*[\-:]*\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)",
    ], text, re.IGNORECASE)
    if emi_match:
        res["emi"] = f"₹{emi_match}"

    account_match = _first_match([
        r"(?:Loan Account Number|Loan A/c No\.?|LAN|Loan Ref No\.?|Loan No\.?)[\s:]*([A-Za-z0-9\-]{6,20})",
    ], text, re.IGNORECASE)
    if account_match:
        res["loan_account_number"] = account_match

    dates_match = _first_match([
        r"(?:Sanction Date|Agreement Date|Disbursal Date|Statement Date|Issue Date|Date)[\s:]*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.]\d{4})",
    ], text, re.IGNORECASE)
    if dates_match:
        res["dates"] = dates_match

    outstanding_match = _first_match([
        r"(?:Outstanding Amount|Outstanding Balance|Principal Outstanding|Current Balance|Closing Balance)[\s:]*[\-:]*\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)",
    ], text, re.IGNORECASE)
    if outstanding_match:
        res["outstanding_amount"] = f"₹{outstanding_match}"

    income_match = _first_match([
        r"(?:Gross Salary|Net Salary|Monthly Income|Gross Income|Verified Income|Basic Pay|Total Earnings)[\s:]*[\-:]*\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)",
    ], text, re.IGNORECASE)
    if income_match:
        res["income"] = f"₹{income_match}"

    return res


def extract_document_details(file_bytes: bytes, filename: str, doc_type: str = "") -> Dict[str, Any]:
    raw_text = extract_text_from_bytes(file_bytes, filename, doc_type)
    extracted = extract_field_values(raw_text, filename, doc_type)
    detected_count = sum(1 for v in extracted.values() if v not in ("Not Found", None, ""))
    total_fields = len(extracted)

    return {
        "filename": filename,
        "raw_text_length": len(raw_text),
        "detected_count": detected_count,
        "total_fields": total_fields,
        "fields": extracted,
    }
