"""
CreditLens Document Intelligence & OCR Service
Local, privacy-focused document parsing pipeline using Tesseract OCR, PIL, and pdf2image.
Dynamically resolves local Tesseract & Poppler binary paths.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import logging
from typing import Dict, Any, Optional, List, Tuple
from PIL import Image, ImageOps, ImageEnhance
import pytesseract

try:
    from pdf2image import convert_from_bytes
except ImportError:
    convert_from_bytes = None

try:
    import pypdfium2
except ImportError:
    pypdfium2 = None

try:
    import pypdf
except ImportError:
    pypdf = None

logger = logging.getLogger("creditlens.ocr_service")

# Curated financial keyword taxonomy for document validation
FINANCIAL_KEYWORDS = {
    # Income & Salary
    "salary", "payslip", "pay", "slip", "earning", "earnings", "wages", "basic pay",
    "net pay", "gross pay", "take home", "ctc", "allowance", "hra", "da", "reimbursement",
    "bonus", "incentive", "deduction", "provident fund", "pf", "epf", "tds", "perquisites",
    # Banking & Accounts
    "bank", "account", "statement", "balance", "credit", "debit", "deposit", "withdrawal",
    "transaction", "transactions", "closing balance", "opening balance", "available balance",
    "ifsc", "branch", "cheque", "clearing", "holder", "account holder", "ledger",
    "passbook", "cr", "dr", "neft", "rtgs", "imps", "upi",
    # Tax & Government Identity
    "pan", "aadhaar", "income tax", "tax", "itr", "form 16", "assessment year", "ay", "financial year", "fy",
    "cibil", "credit bureau", "experian", "crif",
    # Loans & Debt
    "loan", "emi", "interest", "principal", "tenure", "collateral", "asset", "liability",
    "sanction", "disbursement", "outstanding", "due date", "overdue", "mortgage", "repayment",
    # Currency & Amount Markers
    "rupees", "inr", "rs.", "rs", "amount", "total", "inward", "outward"
}

MIN_TEXT_LENGTH = 15
MIN_WORD_COUNT = 4
MIN_FINANCIAL_KEYWORDS = 1


class OCRProcessingError(Exception):
    """Raised when an uploaded document cannot be processed or converted by OCR."""
    pass


class InvalidDocumentError(Exception):
    """Raised when the extracted document text contains insufficient or non-financial content."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


def find_tesseract_binary() -> Optional[str]:
    """
    Dynamically locate the local Tesseract-OCR binary on Windows, Linux, or macOS.
    Checks environment variables (TESSERACT_PATH, TESSERACT_CMD), system PATH,
    and canonical installation paths. Handles both direct binary paths and directories.
    """
    # 1. Environment variable overrides: check both TESSERACT_PATH and TESSERACT_CMD
    for env_var in ["TESSERACT_PATH", "TESSERACT_CMD"]:
        env_val = os.getenv(env_var)
        if env_val:
            # Direct binary path
            if os.path.isfile(env_val):
                return env_val
            # Directory path containing tesseract binary
            if os.path.isdir(env_val):
                for binary_name in ["tesseract.exe", "tesseract"]:
                    cand = os.path.join(env_val, binary_name)
                    if os.path.isfile(cand):
                        return cand

    # 2. System PATH lookup
    which_path = shutil.which("tesseract") or shutil.which("tesseract.exe")
    if which_path and os.path.isfile(which_path):
        return which_path

    # 3. Canonical Windows candidate paths
    local_app_data = os.getenv("LOCALAPPDATA", "")
    app_data = os.getenv("APPDATA", "")
    program_files = os.getenv("ProgramFiles", r"C:\Program Files")
    program_files_x86 = os.getenv("ProgramFiles(x86)", r"C:\Program Files (x86)")
    user_home = os.path.expanduser("~")

    windows_candidates = [
        os.path.join(local_app_data, "Programs", "Tesseract-OCR", "tesseract.exe"),
        os.path.join(user_home, "AppData", "Local", "Programs", "Tesseract-OCR", "tesseract.exe"),
        os.path.join(app_data, "Local", "Programs", "Tesseract-OCR", "tesseract.exe"),
        os.path.join(program_files, "Tesseract-OCR", "tesseract.exe"),
        os.path.join(program_files_x86, "Tesseract-OCR", "tesseract.exe"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\tools\tesseract\tesseract.exe",
        r"C:\Tesseract-OCR\tesseract.exe",
    ]

    for candidate in windows_candidates:
        if candidate and os.path.isfile(candidate):
            return candidate

    # 4. Canonical POSIX candidate paths
    posix_candidates = [
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
        "/opt/homebrew/bin/tesseract",
        "/usr/pkg/bin/tesseract",
    ]

    for candidate in posix_candidates:
        if os.path.isfile(candidate):
            return candidate

    return None


def configure_tesseract() -> Optional[str]:
    """
    Configures pytesseract with the dynamically discovered binary path.
    Returns the resolved path or None if not found.
    """
    binary_path = find_tesseract_binary()
    if binary_path:
        pytesseract.pytesseract.tesseract_cmd = binary_path
        logger.info("Tesseract OCR configured at: %s", binary_path)
    else:
        logger.warning(
            "Tesseract OCR binary not found on standard paths or PATH. "
            "Set TESSERACT_CMD in your environment or install Tesseract OCR."
        )
    return binary_path


# Initialize on module load
_RESOLVED_TESSERACT_PATH = configure_tesseract()


def get_tesseract_path() -> Optional[str]:
    """Return the currently configured Tesseract executable path."""
    global _RESOLVED_TESSERACT_PATH
    if not _RESOLVED_TESSERACT_PATH:
        _RESOLVED_TESSERACT_PATH = configure_tesseract()
    return _RESOLVED_TESSERACT_PATH


def is_tesseract_available() -> bool:
    """Check if Tesseract OCR is currently configured and operational."""
    path = get_tesseract_path()
    if not path or not os.path.isfile(path):
        return False
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def find_poppler_path() -> Optional[str]:
    """
    Dynamically locate the Poppler bin directory for pdf2image.
    """
    env_path = os.getenv("POPPLER_PATH")
    if env_path and os.path.isdir(env_path):
        return env_path

    which_pdftoppm = shutil.which("pdftoppm") or shutil.which("pdftoppm.exe")
    if which_pdftoppm:
        return os.path.dirname(which_pdftoppm)

    local_app_data = os.getenv("LOCALAPPDATA", "")
    user_home = os.path.expanduser("~")

    candidates = [
        os.path.join(local_app_data, "Programs", "poppler", "bin"),
        os.path.join(user_home, "AppData", "Local", "Programs", "poppler", "bin"),
        r"C:\Program Files\poppler\bin",
        r"C:\Program Files (x86)\poppler\bin",
        r"C:\tools\poppler\bin",
        r"C:\poppler\bin",
    ]

    for c in candidates:
        if c and os.path.isdir(c):
            return c
    return None


def preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """
    Enhance document image contrast and convert to grayscale for optimal Tesseract OCR accuracy.
    """
    try:
        if image.mode != "L":
            gray = ImageOps.grayscale(image)
        else:
            gray = image

        # Enhance contrast
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.4)
        return enhanced
    except Exception:
        return image


def extract_raw_text_from_image(file_bytes: bytes) -> str:
    """Extract raw text from an image byte stream using PIL and pytesseract."""
    configure_tesseract()
    try:
        image = Image.open(io.BytesIO(file_bytes))
        processed = preprocess_image_for_ocr(image)
        text = pytesseract.image_to_string(processed)
        return text or ""
    except Exception as exc:
        logger.error("Failed to extract text from image with Tesseract: %s", exc)
        raise OCRProcessingError(f"Image OCR processing failed: {exc}") from exc


def extract_raw_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract raw text from PDF files using pdf2image + Tesseract OCR.
    Gracefully falls back to pypdfium2 image rendering or pypdf text extraction
    if poppler is unavailable.
    """
    configure_tesseract()
    extracted_text = ""
    poppler_dir = find_poppler_path()

    # Primary method: pdf2image
    if convert_from_bytes is not None:
        try:
            pages = convert_from_bytes(
                file_bytes,
                dpi=200,
                poppler_path=poppler_dir
            )
            for page in pages:
                processed = preprocess_image_for_ocr(page)
                page_text = pytesseract.image_to_string(processed)
                if page_text:
                    extracted_text += page_text + "\n"
            if extracted_text.strip():
                return extracted_text
        except Exception as exc:
            logger.debug("pdf2image conversion skipped or failed (%s); trying fallback engines", exc)

    # Fallback 1: pypdfium2 renders PDF pages to PIL images without external Poppler binaries
    if pypdfium2 is not None:
        try:
            pdf = pypdfium2.PdfDocument(file_bytes)
            for page in pdf:
                pil_image = page.render(scale=2.0).to_pil()
                processed = preprocess_image_for_ocr(pil_image)
                page_text = pytesseract.image_to_string(processed)
                if page_text:
                    extracted_text += page_text + "\n"
            if extracted_text.strip():
                return extracted_text
        except Exception as exc:
            logger.debug("pypdfium2 OCR fallback failed: %s", exc)

    # Fallback 2: Direct text extraction via pypdf
    if pypdf is not None:
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text = page.extract_text() or ""
                if text:
                    extracted_text += text + "\n"
            if extracted_text.strip():
                return extracted_text
        except Exception as exc:
            logger.debug("pypdf text extraction fallback failed: %s", exc)

    # If text is still empty, raise OCRProcessingError
    if not extracted_text.strip():
        raise OCRProcessingError("Could not extract any legible text from the PDF document.")

    return extracted_text


def extract_raw_text(file_bytes: bytes, filename: str) -> str:
    """
    Unified entry point: extract raw text from image (PNG, JPG, TIFF) or PDF bytes.
    """
    fn_lower = filename.lower()

    if fn_lower.endswith(".pdf"):
        return extract_raw_text_from_pdf(file_bytes)
    elif fn_lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp")):
        return extract_raw_text_from_image(file_bytes)
    else:
        # Attempt text decode or image fallback
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return extract_raw_text_from_image(file_bytes)
            except Exception as exc:
                raise OCRProcessingError(f"Unsupported file format or unparseable content for '{filename}': {exc}")


def validate_and_classify_financial_document(
    raw_text: str,
    strict: bool = True
) -> Dict[str, Any]:
    """
    Basic classification check:
    If extracted text contains insufficient or non-financial keywords,
    flags as invalid file or raises InvalidDocumentError.
    """
    cleaned = (raw_text or "").strip()
    char_count = len(cleaned)
    words = re.findall(r"\b[A-Za-z0-9]+\b", cleaned)
    word_count = len(words)

    # Check for empty or insufficient raw text
    if char_count < MIN_TEXT_LENGTH or word_count < MIN_WORD_COUNT:
        detail = {
            "is_valid": False,
            "character_count": char_count,
            "word_count": word_count,
            "matched_keywords": [],
            "matched_count": 0,
            "reason": "Document text is insufficient, illegible, or empty (less than minimum required characters/words)."
        }
        if strict:
            raise InvalidDocumentError(detail["reason"], details=detail)
        return detail

    # Match financial keywords
    text_lower = cleaned.lower()
    matched_keywords: List[str] = []
    for kw in FINANCIAL_KEYWORDS:
        # Match whole word or exact pattern
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, text_lower):
            matched_keywords.append(kw)

    matched_count = len(matched_keywords)

    if matched_count < MIN_FINANCIAL_KEYWORDS:
        detail = {
            "is_valid": False,
            "character_count": char_count,
            "word_count": word_count,
            "matched_keywords": [],
            "matched_count": 0,
            "reason": "Document contains non-financial or unrelated content. No recognized banking, income, or KYC financial keywords were detected."
        }
        if strict:
            raise InvalidDocumentError(detail["reason"], details=detail)
        return detail

    return {
        "is_valid": True,
        "character_count": char_count,
        "word_count": word_count,
        "matched_keywords": sorted(list(set(matched_keywords))),
        "matched_count": matched_count,
        "reason": None
    }


def parse_and_validate_document(
    file_bytes: bytes,
    filename: str,
    strict: bool = True
) -> Tuple[str, Dict[str, Any]]:
    """
    Complete Step 2 OCR & Classification Pipeline:
    1. Extracts raw text via local Tesseract OCR & PIL / pdf2image.
    2. Runs financial keyword classification validation.
    Returns: (raw_text, classification_result_dict)
    """
    raw_text = extract_raw_text(file_bytes, filename)
    classification = validate_and_classify_financial_document(raw_text, strict=strict)
    return raw_text, classification
