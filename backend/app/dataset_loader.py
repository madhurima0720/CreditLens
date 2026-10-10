"""
CreditLens Dataset Loader
Loads and validates the loan approval prediction dataset from backend/data/
"""

from __future__ import annotations

import os
import csv
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("creditlens.dataset")

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
CANDIDATE_FILENAMES = [
    "loan_approval_dataset.csv",
    "Loan Approval Prediction Dataset.csv",
]


def find_dataset_path() -> Optional[str]:
    """Find the path to the loan approval dataset CSV."""
    for filename in CANDIDATE_FILENAMES:
        path = os.path.join(DATA_DIR, filename)
        if os.path.isfile(path):
            return path
    return None


def load_loan_dataset(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Load rows from the loan approval dataset CSV as a list of dictionaries.
    Casts numeric fields into floats/ints.
    """
    path = find_dataset_path()
    if not path:
        raise FileNotFoundError(
            f"Loan approval dataset not found in {DATA_DIR}. "
            f"Expected one of: {CANDIDATE_FILENAMES}"
        )

    records: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            if limit and idx >= limit:
                break

            record: Dict[str, Any] = {}
            for k, v in row.items():
                k_clean = k.strip()
                v_clean = v.strip() if v else ""
                # Attempt numeric cast
                try:
                    if "." in v_clean:
                        record[k_clean] = float(v_clean)
                    else:
                        record[k_clean] = int(v_clean)
                except ValueError:
                    record[k_clean] = v_clean

            records.append(record)

    logger.info("Loaded %d rows from dataset: %s", len(records), os.path.basename(path))
    return records


def get_dataset_summary() -> Dict[str, Any]:
    """Return summary statistics of the loan approval dataset."""
    path = find_dataset_path()
    if not path:
        return {"loaded": False, "error": "Dataset file not found"}

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader, [])
        row_count = sum(1 for _ in reader)

    file_size_bytes = os.path.getsize(path)

    return {
        "loaded": True,
        "filename": os.path.basename(path),
        "total_rows": row_count,
        "total_columns": len(header),
        "columns": header,
        "file_size_mb": round(file_size_bytes / (1024 * 1024), 2),
    }
