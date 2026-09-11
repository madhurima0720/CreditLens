from __future__ import annotations
from typing import List, Dict, Any, Tuple
import re, os

DOC_TYPE_LABELS: Dict[str, str] = {
    "bank_statement": "Bank Statement",
    "pay_slip":       "Salary / Pay Slip",
    "kyc_id":         "Government ID (KYC)",
    "kyc_addr":       "Address Proof",
    "itr_doc":        "Form 16 / ITR Tax Return",
    "prop_doc":       "Property Documents",
    "veh_quote":      "Vehicle Quotation",
    "adm_letter":     "Admission Letter",
    "gst_cert":       "GST / Business Registration Certificate",
    "fin_stmt":       "Audited Financial Statement",
    "demat_stmt":     "Demat Holding Statement",
    "pledge_doc":     "Pledge Request Form",
    "land_rec":       "Land / 7-12 Extract",
    "crop_rec":       "Crop Cultivation Record",
    "gold_val":       "Gold Valuation Certificate",
    "prop_title":     "Property Title Deeds",
    "prod_quote":     "Product Quotation",
    "mach_quote":     "Machinery Supplier Quotation",
    "co_inc":         "Co-applicant Income Proof",
    "fee_struct":     "Course Fee Structure",
    "acad_cert":      "Academic Certificates",
}

IDENTITY_DOC_TYPES = {"bank_statement", "pay_slip", "kyc_id", "itr_doc", "kyc_addr"}

VALID_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"}

INVALID_CONTENT_SIGNALS = [
    "screenshot", "meme", "photo", "selfie", "picture", "holiday",
    "vacation", "random", "test_file", "sample123", "junk", "temp",
    "untitled", "image001", "scan001", "noname",
]

def _normalize_name(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"[^a-z\s]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name

def _name_match_score(a: str, b: str) -> float:
    a_tok = set(_normalize_name(a).split())
    b_tok = set(_normalize_name(b).split())
    if not a_tok or not b_tok:
        return 0.0
    return len(a_tok & b_tok) / len(a_tok | b_tok)

def _classify_file(doc_type: str, file_name: str, confidence: float) -> Tuple[bool, str]:
    fn_lower = (file_name or "").lower()
    ext = os.path.splitext(fn_lower)[-1]

    if ext and ext not in VALID_EXTENSIONS:
        return False, (
            f"'{file_name}' has an unsupported file type ('{ext}'). "
            f"Accepted formats: PDF, JPG, PNG, TIFF."
        )

    if doc_type not in DOC_TYPE_LABELS:
        return False, (
            f"'{file_name}' was classified as an unrecognised document type ('{doc_type}'). "
            f"Only financial and identity documents are accepted."
        )

    if confidence == 0.0 and not ext:
        return False, (
            f"'{file_name}' could not be read. Provide a clear, non-password-protected document."
        )

    for signal in INVALID_CONTENT_SIGNALS:
        if signal in fn_lower:
            return False, (
                f"'{file_name}' does not appear to be a financial or identity document. "
                f"Please upload a valid bank statement, salary slip, tax return, or ID proof."
            )

    return True, ""

def validate_upload(doc_type: str, file_name: str, confidence: float = 90.0) -> Dict[str, Any]:
    is_valid, reason = _classify_file(doc_type, file_name, confidence)
    if not is_valid:
        return {
            "valid": False,
            "error": f"Provide valid document file. {reason}",
            "file_name": file_name,
            "doc_type": doc_type,
        }
    return {"valid": True, "file_name": file_name, "doc_type": doc_type}

def verify_documents(applicant_name: str, uploaded_docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    cross_match_results: List[Dict[str, Any]] = []
    anomalies:           List[Dict[str, Any]] = []
    rejected_files:      List[Dict[str, Any]] = []
    verified_count = 0

    for doc in uploaded_docs:
        doc_type   = (doc.get("type") or "unknown").lower()
        file_name  = doc.get("file_name") or "unknown_file"
        ext_name   = doc.get("extracted_name") or ""
        ext_fields = doc.get("extracted_fields") or {}
        confidence = float(doc.get("confidence") or 0.0)
        doc_label  = DOC_TYPE_LABELS.get(doc_type, doc_type.replace("_", " ").title())

        is_valid, reject_reason = _classify_file(doc_type, file_name, confidence)
        if not is_valid:
            rejected_files.append({
                "file_name": file_name,
                "doc_type":  doc_label,
                "error":     f"Provide valid document file. {reject_reason}",
                "severity":  "CRITICAL",
            })
            anomalies.append({
                "severity":  "CRITICAL",
                "field":     "classification",
                "doc_type":  doc_label,
                "file_name": file_name,
                "message":   f"Provide valid document file. {reject_reason}",
            })
            continue

        doc_flags:  List[Dict[str, str]] = []
        name_match  = False
        match_score = 0.0

        if confidence < 40.0:
            doc_flags.append({
                "severity": "CRITICAL",
                "field":    "readability",
                "message":  (
                    f"Document '{file_name}' could not be parsed "
                    f"(OCR confidence {confidence:.0f}%). "
                    f"File may be blurred, corrupt, image-only PDF, or password-protected."
                ),
            })
            anomalies.append(doc_flags[-1] | {"doc_type": doc_label, "file_name": file_name})

        if doc_type in IDENTITY_DOC_TYPES:
            if not ext_name:
                doc_flags.append({
                    "severity": "HIGH",
                    "field":    "extracted_name",
                    "message":  f"No applicant name extracted from '{file_name}'. Manual verification required.",
                })
                anomalies.append(doc_flags[-1] | {"doc_type": doc_label, "file_name": file_name})
            else:
                match_score = _name_match_score(applicant_name, ext_name)
                if match_score >= 0.75:
                    name_match     = True
                    verified_count += 1
                elif match_score >= 0.4:
                    doc_flags.append({
                        "severity": "HIGH",
                        "field":    "name",
                        "message":  (
                            f"Partial name mismatch in {doc_label}: application name "
                            f"'{applicant_name}' vs. document name '{ext_name}' "
                            f"({match_score*100:.0f}% similarity). "
                            f"Possible initials / nickname — requires manual review."
                        ),
                    })
                    anomalies.append(doc_flags[-1] | {"doc_type": doc_label, "file_name": file_name})
                else:
                    doc_flags.append({
                        "severity": "CRITICAL",
                        "field":    "name",
                        "message":  (
                            f"Identity mismatch in {doc_label}: application name "
                            f"'{applicant_name}' does NOT match document name '{ext_name}' "
                            f"({match_score*100:.0f}% similarity). "
                            f"Potential fraudulent submission — escalate to Fraud Investigation Unit."
                        ),
                    })
                    anomalies.append(doc_flags[-1] | {"doc_type": doc_label, "file_name": file_name})
        else:
            if confidence >= 40.0:
                verified_count += 1

        if 40.0 <= confidence < 70.0:
            doc_flags.append({
                "severity": "MEDIUM",
                "field":    "confidence",
                "message":  f"Low OCR confidence ({confidence:.0f}%) for '{file_name}'. Extracted values may be partially inaccurate.",
            })

        cross_match_results.append({
            "doc_type":       doc_label,
            "doc_type_code":  doc_type,
            "file_name":      file_name,
            "extracted_name": ext_name or None,
            "name_match":     name_match,
            "match_score":    round(match_score * 100, 1),
            "accuracy":       round(confidence, 1),
            "fields":         ext_fields,
            "flags":          doc_flags,
            "status": (
                "VERIFIED" if not doc_flags else (
                    "CRITICAL" if any(f["severity"] == "CRITICAL" for f in doc_flags)
                    else "WARNING"
                )
            ),
        })

    critical_count = sum(1 for a in anomalies if a["severity"] == "CRITICAL")
    high_count     = sum(1 for a in anomalies if a["severity"] == "HIGH")
    total          = len(uploaded_docs)

    if len(rejected_files) > 0:
        overall_status = "INVALID_FILES_DETECTED"
    elif critical_count > 0:
        overall_status = "MISMATCH_DETECTED"
    elif high_count > 0:
        overall_status = "REVIEW_REQUIRED"
    elif total == 0:
        overall_status = "INCOMPLETE"
    else:
        overall_status = "VERIFIED"

    summary = (
        f"{verified_count}/{total} documents verified."
        + (f" {len(rejected_files)} invalid file(s) rejected." if rejected_files else "")
        + (f" {critical_count} critical flag(s) detected." if critical_count else "")
        + (f" {high_count} high-severity flag(s) require human review." if high_count else "")
        + (" All identity checks passed." if overall_status == "VERIFIED" else "")
    )

    return {
        "ai_status":           "PENDING HUMAN REVIEW",
        "overall_status":      overall_status,
        "cross_match_results": cross_match_results,
        "rejected_files":      rejected_files,
        "anomalies":           anomalies,
        "verified_count":      verified_count,
        "total_docs":          total,
        "critical_flags":      critical_count,
        "high_flags":          high_count,
        "summary":             summary,
    }
