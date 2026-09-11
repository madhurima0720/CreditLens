import io
import re
from typing import Dict, Any, Optional
import pypdf

ALL_FIELDS = [
    "name",
    "dob",
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

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    fn_lower = filename.lower()
    text = ""
    if fn_lower.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
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

    return text

def extract_field_values(raw_text: str, filename: str = "", doc_type: str = "") -> Dict[str, str]:
    res: Dict[str, str] = {field: "Not Found" for field in ALL_FIELDS}
    if not raw_text or not raw_text.strip():
        return res

    text = raw_text

    # 1. PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
    pan_match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    if pan_match:
        res["pan"] = pan_match.group(1)

    # 2. Aadhaar: 12 digits (often 4 4 4)
    aadhaar_match = re.search(r"\b(\d{4}\s\d{4}\s\d{4})\b", text)
    if not aadhaar_match:
        aadhaar_match = re.search(r"\b(?:Aadhaar|UID|UIDAI)[\s:]*(\d{12})\b", text, re.IGNORECASE)
    if aadhaar_match:
        res["aadhaar"] = aadhaar_match.group(1)

    # 3. Email
    email_match = re.search(r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b", text)
    if email_match:
        res["email"] = email_match.group(1)

    # 4. Phone
    phone_match = re.search(r"\b(?:Phone|Mobile|Contact|Tel)[\s:]*(?:(?:\+91|91)[\-\s]?)?([6-9]\d{9})\b", text, re.IGNORECASE)
    if not phone_match:
        phone_match = re.search(r"\b(?:\+91[\-\s]?)?([6-9]\d{9})\b", text)
    if phone_match:
        res["phone"] = phone_match.group(1)

    # 5. DOB
    dob_match = re.search(r"\b(?:DOB|Date of Birth|Birth Date)[\s:]*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.]\d{4})\b", text, re.IGNORECASE)
    if not dob_match:
        dob_match = re.search(r"\b(?:Born|DOB)[\s:]*([A-Za-z]+\s\d{1,2},?\s\d{4})\b", text, re.IGNORECASE)
    if dob_match:
        res["dob"] = dob_match.group(1).strip()

    # 6. Name
    name_match = re.search(r"\b(?:Applicant Name|Account Holder|Customer Name|Employee Name|Taxpayer Name|Name)[\s:]+([A-Za-z\s.]{3,35})(?=\n|$|,|;|\t)", text, re.IGNORECASE)
    if name_match:
        clean_name = name_match.group(1).strip()
        if len(clean_name) > 2 and not any(k in clean_name.lower() for k in ["statement", "bank", "invoice", "receipt", "limited", "pvt"]):
            res["name"] = clean_name

    # 7. Address
    addr_match = re.search(r"\b(?:Address|Current Address|Permanent Address|Residing at)[\s:]+([^\n\r]{10,120})", text, re.IGNORECASE)
    if addr_match:
        res["address"] = addr_match.group(1).strip()

    # 8. Loan Type
    loan_types = [
        "Home Loan", "Vehicle Loan", "Education Loan", "Personal Loan",
        "Business Loan", "Agricultural Loan", "Gold Loan", "Loan Against Property",
        "Consumer Loan", "Equipment & Machinery Loan", "Loan Against Securities", "Auto Loan"
    ]
    for lt in loan_types:
        if re.search(r"\b" + re.escape(lt) + r"\b", text, re.IGNORECASE):
            res["loan_type"] = lt
            break

    # 9. Loan Amount
    amount_match = re.search(r"\b(?:Loan Amount|Sanctioned Amount|Principal Amount|Requested Loan)[\s:]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if amount_match:
        res["loan_amount"] = f"₹{amount_match.group(1).strip()}"

    # 10. Interest Rate
    roi_match = re.search(r"\b(?:Interest Rate|Rate of Interest|ROI|Annual Interest)[\s:]*([\d.]+\s*%)", text, re.IGNORECASE)
    if not roi_match:
        roi_match = re.search(r"\b([\d.]+)%\s*(?:p\.a\.|per annum|interest)", text, re.IGNORECASE)
    if roi_match:
        res["interest_rate"] = roi_match.group(1).strip() if "%" in roi_match.group(1) else f"{roi_match.group(1).strip()}%"

    # 11. Tenure
    tenure_match = re.search(r"\b(?:Tenure|Term|Loan Duration|Repayment Period)[\s:]*(\d+\s*(?:months?|years?|yrs?|mths?))", text, re.IGNORECASE)
    if tenure_match:
        res["tenure"] = tenure_match.group(1).strip()

    # 12. EMI
    emi_match = re.search(r"\b(?:EMI|Monthly Installment|Installment Amount)[\s:]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if emi_match:
        res["emi"] = f"₹{emi_match.group(1).strip()}"

    # 13. Loan Account Number
    lan_match = re.search(r"\b(?:Loan Account Number|Loan A\/c No\.?|LAN|Loan Ref No\.?|Loan No\.?)[\s:]*([A-Za-z0-9\-]{6,20})\b", text, re.IGNORECASE)
    if lan_match:
        res["loan_account_number"] = lan_match.group(1).strip()

    # 14. Dates
    dates_match = re.search(r"\b(?:Sanction Date|Agreement Date|Disbursal Date|Statement Date|Issue Date|Date)[\s:]*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.]\d{4})\b", text, re.IGNORECASE)
    if dates_match:
        res["dates"] = dates_match.group(1).strip()

    # 15. Outstanding Amount
    out_match = re.search(r"\b(?:Outstanding Amount|Outstanding Balance|Principal Outstanding|Current Balance|Closing Balance)[\s:]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if out_match:
        res["outstanding_amount"] = f"₹{out_match.group(1).strip()}"

    # 16. Income
    inc_match = re.search(r"\b(?:Gross Salary|Net Salary|Monthly Income|Gross Income|Verified Income|Basic Pay|Total Earnings)[\s:]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
    if inc_match:
        res["income"] = f"₹{inc_match.group(1).strip()}"

    # 17. Existing Loans/EMIs
    exist_match = re.search(r"\b(?:Existing Loans?|Existing EMIs?|Other Running Loans?|Active Borrowings)[\s:]*([^\n\r,;]{3,80})", text, re.IGNORECASE)
    if exist_match:
        res["existing_loans_emis"] = exist_match.group(1).strip()

    # 18. Bank Details
    bank_name = None
    known_banks = ["HDFC Bank", "State Bank of India", "SBI", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda", "Canara Bank"]
    for b in known_banks:
        if re.search(r"\b" + re.escape(b) + r"\b", text, re.IGNORECASE):
            bank_name = b
            break
    ifsc_match = re.search(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", text)
    acct_match = re.search(r"\b(?:A\/C|Account No\.?|Acc No\.?)[\s:]*([0-9]{9,18})\b", text, re.IGNORECASE)

    bank_parts = []
    if bank_name:
        bank_parts.append(bank_name)
    if acct_match:
        bank_parts.append(f"A/C: {acct_match.group(1)}")
    if ifsc_match:
        bank_parts.append(f"IFSC: {ifsc_match.group(1)}")
    if bank_parts:
        res["bank_details"] = " | ".join(bank_parts)

    # 19. Assets
    asset_match = re.search(r"\b(?:Assets?|Total Assets|Property Valuation|Gold Weight|Vehicle Value|Securities Value)[\s:]*([^\n\r,;]{3,80})", text, re.IGNORECASE)
    if asset_match:
        res["assets"] = asset_match.group(1).strip()

    # 20. Liabilities
    liab_match = re.search(r"\b(?:Liabilities|Total Liabilities|Existing Obligations|Total Debt)[\s:]*([^\n\r,;]{3,80})", text, re.IGNORECASE)
    if liab_match:
        res["liabilities"] = liab_match.group(1).strip()

    # 21. Collateral
    coll_match = re.search(r"\b(?:Collateral|Security Offered|Pledged Property|Hypothecation|Mortgage Details)[\s:]*([^\n\r,;]{3,80})", text, re.IGNORECASE)
    if coll_match:
        res["collateral"] = coll_match.group(1).strip()

    return res

def extract_document_details(file_bytes: bytes, filename: str, doc_type: str = "") -> Dict[str, Any]:
    raw_text = extract_text_from_bytes(file_bytes, filename)
    extracted = extract_field_values(raw_text, filename, doc_type)
    detected_count = sum(1 for v in extracted.values() if v != "Not Found")
    total_fields = len(extracted)

    return {
        "filename": filename,
        "raw_text_length": len(raw_text),
        "detected_count": detected_count,
        "total_fields": total_fields,
        "fields": extracted,
    }
