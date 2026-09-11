from __future__ import annotations
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

class DocumentRecord(BaseModel):
    type:             str
    file_name:        str
    extracted_name:   Optional[str] = None
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    confidence:       float = 0.0

class RiskFactorRecord(BaseModel):
    category:  str
    severity:  str
    message:   str

class ApplicationRecord(BaseModel):
    id:                str    = Field(default_factory=lambda: f"APP-{uuid.uuid4().hex[:4].upper()}")
    applicant_name:    str
    loan_type:         str
    amount:            float
    amount_display:    str    = ""
    salary:            float
    dti:               float
    health_score:      int    = 0
    risk_tier:         str    = "Pending AI Review"
    ai_status:         str    = "AI Reviewed – Awaiting Decision"

    human_decision:      Optional[Literal["APPROVED", "REJECTED"]] = None
    underwriter_remarks: Optional[str]  = None
    decided_by:          Optional[str]  = None
    decided_at:          Optional[str]  = None

    created_at:        str   = Field(default_factory=_utcnow)
    updated_at:        str   = Field(default_factory=_utcnow)

    positive_signals:  List[str]              = Field(default_factory=list)
    risk_factors:      List[RiskFactorRecord] = Field(default_factory=list)
    documents:         List[DocumentRecord]   = Field(default_factory=list)
    extracted_details: Dict[str, Any]         = Field(default_factory=dict)

    class Config:
        extra = "allow"

class AssessmentRecord(BaseModel):
    id:                  str   = Field(default_factory=new_id)
    application_id:      str
    applicant_name:      str
    loan_type:           str

    dti_ratio_percent:   float
    health_score:        int
    risk_classification: str
    ai_recommendation:   str
    single_line_explanation: str = ""
    single_line_verdict:     str = ""
    estimated_new_emi:       float = 0.0
    total_monthly_debt:      float = 0.0
    disposable_income:       float = 0.0
    safe_credit_limit:       float = 0.0
    income_mismatch_flag:    bool  = False
    identity_mismatch_flag:  bool  = False
    tamper_flag:             bool  = False
    missing_documents:       List[str] = Field(default_factory=list)
    mismatched_fields:       List[str] = Field(default_factory=list)
    confidence_score:        float = 0.0
    positive_signals:        List[str] = Field(default_factory=list)
    risk_factors:            List[Dict[str, Any]] = Field(default_factory=list)
    recommendation:          str = ""
    created_at:              str = Field(default_factory=_utcnow)

    class Config:
        extra = "allow"

class DocumentMetaRecord(BaseModel):
    id:               str  = Field(default_factory=new_id)
    application_id:   str
    applicant_name:   str
    doc_type:         str
    file_name:        str
    file_size_bytes:  int  = 0
    ocr_confidence:   float = 0.0
    extracted_name:   Optional[str] = None
    extracted_fields: Dict[str, Any] = Field(default_factory=dict)
    validation_status: str = "PENDING"
    rejection_reason: Optional[str] = None
    uploaded_at:      str = Field(default_factory=_utcnow)

    class Config:
        extra = "allow"

class AuditLogRecord(BaseModel):
    id:            str  = Field(default_factory=new_id)
    event_type:    str
    application_id: Optional[str] = None
    actor:         str  = "SYSTEM"
    actor_role:    str  = "System"
    description:   str
    metadata:      Dict[str, Any] = Field(default_factory=dict)
    timestamp:     str = Field(default_factory=_utcnow)

    class Config:
        extra = "allow"

class UserRecord(BaseModel):
    id:           str  = Field(default_factory=new_id)
    name:         str
    email:        str
    role_id:      str
    role_title:   str
    institution:  str
    is_active:    bool = True
    created_at:   str  = Field(default_factory=_utcnow)

    class Config:
        extra = "allow"

class HumanDecisionRecord(BaseModel):
    id:             str  = Field(default_factory=new_id)
    application_id: str
    applicant_name: str
    loan_type:      str
    health_score:   int
    risk_tier:      str
    decision:       Literal["APPROVED", "REJECTED"]
    statement:      str
    officer_name:   str
    officer_role:   str = "Credit Underwriter"
    decided_at:     str = Field(default_factory=_utcnow)
    source:         str = "HUMAN_OFFICER"
    ai_advisory_only: bool = True

    class Config:
        extra = "allow"
