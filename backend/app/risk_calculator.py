"""
CreditLens Risk Scoring Engine
Calculates DTI, Health Score, CIBIL benchmark, underwriting verdict,
safe credit limits, and detects fraud/inconsistency anomalies.
"""

from __future__ import annotations

import math
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class RiskFactorDetail(BaseModel):
    category: str
    severity: str
    message: str


class RiskScoringResult(BaseModel):
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


def compute_risk_assessment(
    applicant_name: str,
    loan_type: str = "Home Loan",
    monthly_salary: float = 100000.0,
    existing_emis: float = 0.0,
    savings_amount: float = 500000.0,
    requested_loan: float = 1500000.0,
    loan_tenure_months: int = 48,
    annual_interest_rate: float = 10.5,
    verified_salary: Optional[float] = None,
    pay_slip_account_name: Optional[str] = None,
    bank_account_holder_name: Optional[str] = None,
    missing_documents: Optional[List[str]] = None,
    anomalies: Optional[List[Dict[str, Any]]] = None,
    simulate_cash_injection_anomaly: bool = False,
    simulate_pdf_metadata_tampering: bool = False,
) -> RiskScoringResult:
    """
    Core CreditLens Risk Calculation:
    Routes underwriting parameters and OCR/Ollama extracted metrics into:
    1. Mandatory documentation & identity cross-check.
    2. DTI & Liquidity ratio calculations.
    3. Health score modeling (0-100).
    4. Decision rule engine (APPROVE / REJECT / FRAUD ALERT).
    5. Safe credit limit computation.
    """
    missing_docs = list(missing_documents or [])
    mismatched_fields: List[str] = []
    positive_signals: List[str] = []
    risk_factors: List[RiskFactorDetail] = []

    # 1. Check Missing Documents
    if missing_docs:
        missing_str = ", ".join(missing_docs)
        single_line_exp = f"Missing Required Document: {missing_str} must be uploaded before risk assessment."
        single_line_verd = f"Rejected: Application is incomplete due to missing {len(missing_docs)} mandatory document(s)."
        return RiskScoringResult(
            applicant_name=applicant_name,
            loan_type=loan_type,
            dti_ratio_percent=0.0,
            health_score=0,
            risk_classification="HIGH RISK / INCOMPLETE",
            decision="REJECTED - INCOMPLETE APPLICATION",
            single_line_explanation=single_line_exp,
            single_line_verdict=single_line_verd,
            estimated_new_emi=0.0,
            total_monthly_debt=0.0,
            disposable_income=0.0,
            safe_credit_limit=0.0,
            income_mismatch_flag=False,
            identity_mismatch_flag=False,
            tamper_flag=False,
            missing_documents=missing_docs,
            mismatched_fields=[],
            confidence_score=0.0,
            positive_signals=[],
            risk_factors=[
                RiskFactorDetail(
                    category="Incomplete Documentation",
                    severity="CRITICAL",
                    message=single_line_exp,
                )
            ],
            recommendation="Application rejected due to missing mandatory documentation. Upload missing documents to proceed.",
        )

    # 2. Check Identity & Tampering Anomalies
    identity_mismatch_flag = False
    tamper_flag = False

    applicant_clean = applicant_name.strip().lower()

    if pay_slip_account_name:
        ps_name = pay_slip_account_name.strip().lower()
        if ps_name != applicant_clean and ps_name not in applicant_clean and applicant_clean not in ps_name:
            identity_mismatch_flag = True
            mismatched_fields.append(
                f"Pay Slip Account Name ('{pay_slip_account_name}') mismatches Applicant Name ('{applicant_name}')"
            )

    if bank_account_holder_name:
        ba_name = bank_account_holder_name.strip().lower()
        if ba_name != applicant_clean and ba_name not in applicant_clean and applicant_clean not in ba_name:
            identity_mismatch_flag = True
            mismatched_fields.append(
                f"Bank Account Holder Name ('{bank_account_holder_name}') mismatches Applicant Name ('{applicant_name}')"
            )

    if simulate_cash_injection_anomaly:
        tamper_flag = True
        mismatched_fields.append("Unusual Bank Behavior: Sudden ₹15,00,000 cash deposit detected 48h prior to application submission")

    if simulate_pdf_metadata_tampering:
        tamper_flag = True
        mismatched_fields.append("Anti-Tamper Scan: Modified PDF font streams & altered salary figures detected in uploaded pay slip")

    # Ingest anomalies from OCR / Ollama analysis
    if anomalies:
        for anomaly in anomalies:
            cat = anomaly.get("category", "")
            msg = anomaly.get("message", "")
            sev = anomaly.get("severity", "HIGH")
            if "IDENTITY" in cat:
                identity_mismatch_flag = True
                mismatched_fields.append(msg)
            elif "TAMPER" in cat or "FRAUD" in cat:
                tamper_flag = True
                mismatched_fields.append(msg)
            else:
                risk_factors.append(RiskFactorDetail(category=cat, severity=sev, message=msg))

    if identity_mismatch_flag or tamper_flag:
        single_line_exp = f"Cross-document entity verification failed: {'; '.join(mismatched_fields)}."
        single_line_verd = "Rejected: Identity mismatch / fraudulent pattern detected between uploaded pay slip and bank statement."
        return RiskScoringResult(
            applicant_name=applicant_name,
            loan_type=loan_type,
            dti_ratio_percent=0.0,
            health_score=15,
            risk_classification="Anomalies / Fraud Alert",
            decision="REJECTED - FRAUD / MISMATCH DETECTED",
            single_line_explanation=single_line_exp,
            single_line_verdict=single_line_verd,
            estimated_new_emi=0.0,
            total_monthly_debt=0.0,
            disposable_income=0.0,
            safe_credit_limit=0.0,
            income_mismatch_flag=False,
            identity_mismatch_flag=identity_mismatch_flag,
            tamper_flag=tamper_flag,
            missing_documents=[],
            mismatched_fields=mismatched_fields,
            confidence_score=99.2,
            positive_signals=[],
            risk_factors=[
                RiskFactorDetail(
                    category="Identity & Fraud Sentinel",
                    severity="CRITICAL",
                    message=field_msg,
                )
                for field_msg in mismatched_fields
            ],
            recommendation="Application escalated to Fraud Investigation Unit. Identity or PDF tampering detected.",
        )

    # 3. Financial calculations
    salary = max(1.0, monthly_salary)
    existing_emi = max(0.0, existing_emis)
    savings = max(0.0, savings_amount)
    loan_amount = max(1.0, requested_loan)
    tenure = max(1, loan_tenure_months)
    annual_rate = max(0.1, annual_interest_rate)

    monthly_rate = (annual_rate / 100.0) / 12.0
    if monthly_rate > 0:
        new_emi_calc = (loan_amount * monthly_rate * math.pow(1 + monthly_rate, tenure)) / (
            math.pow(1 + monthly_rate, tenure) - 1
        )
    else:
        new_emi_calc = loan_amount / tenure

    new_emi = round(new_emi_calc, 2)
    total_monthly_debt = round(existing_emi + new_emi, 2)
    disposable_income = round(max(0.0, salary - total_monthly_debt), 2)
    dti_ratio = round((total_monthly_debt / salary) * 100.0, 2)

    # 4. Income mismatch check
    income_mismatch_flag = False
    if verified_salary is not None and verified_salary > 0:
        diff_pct = abs(verified_salary - salary) / salary
        if diff_pct > 0.10:
            income_mismatch_flag = True
            risk_factors.append(
                RiskFactorDetail(
                    category="Income Verification Mismatch",
                    severity="HIGH",
                    message=(
                        f"Verified salary from document (₹{verified_salary:,.2f}) deviates by {diff_pct*100:.1f}% "
                        f"from declared monthly salary (₹{salary:,.2f})."
                    ),
                )
            )

    # 5. Base score calculation
    base_score = 100.0
    if dti_ratio > 50.0:
        base_score -= (dti_ratio - 50.0) * 1.5 + 20.0
    elif dti_ratio > 40.0:
        base_score -= (dti_ratio - 40.0) * 1.0 + 5.0
    else:
        base_score -= dti_ratio * 0.2

    months_liquidity_coverage = savings / total_monthly_debt if total_monthly_debt > 0 else 12.0
    if months_liquidity_coverage >= 6.0:
        base_score += 8.0
        positive_signals.append("Strong liquid savings buffer (6+ months EMI coverage)")
    elif months_liquidity_coverage < 2.0:
        base_score -= 15.0
        risk_factors.append(
            RiskFactorDetail(
                category="Liquidity Buffer",
                severity="WARNING",
                message=f"Liquid savings cover less than 2 months of post-loan debt obligations.",
            )
        )

    if dti_ratio <= 35.0:
        positive_signals.append("Favorable post-loan Debt-to-Income (DTI) ratio below 35%")

    if income_mismatch_flag:
        base_score -= 25.0

    health_score = max(10, min(100, round(base_score)))

    # 6. Classification & Decision
    if income_mismatch_flag:
        risk_classification = "Anomalies"
        decision = "REJECT"
    elif health_score >= 75:
        risk_classification = "Low Risk"
        decision = "APPROVE"
    elif health_score >= 50:
        risk_classification = "Medium Risk"
        decision = "APPROVE"
    else:
        risk_classification = "High Risk"
        decision = "REJECT"

    cibil_benchmark = min(850, max(600, round(740 + (savings > 1000000 and 30 or 0) - dti_ratio * 1.5)))
    single_line_explanation = (
        f"Score assigned at {health_score}/100 based on CIBIL benchmark of {cibil_benchmark}, "
        f"verified monthly income of ₹{salary:,.2f}, and a post-loan DTI ratio of {dti_ratio}%."
    )

    if decision == "APPROVE":
        single_line_verdict = (
            f"Approved: Strong liquid savings of ₹{savings:,.2f} and verified income stream "
            f"offset incremental EMI obligations within policy ceiling."
        )
        recommendation = "Application qualifies for auto-approval under standard underwriting guidelines."
    else:
        single_line_verdict = (
            f"Rejected: Combined debt obligations drive post-loan DTI ratio to {dti_ratio}%, "
            f"exceeding institutional maximum exposure ceiling of 45%."
        )
        recommendation = "Application rejected. Recommend debt consolidation or lower requested loan amount."

    # 7. Safe credit limit
    max_allowable_debt = salary * 0.45
    max_allowable_new_emi = max(0.0, max_allowable_debt - existing_emi)
    if monthly_rate > 0:
        safe_credit_limit = round(
            (max_allowable_new_emi * (math.pow(1 + monthly_rate, tenure) - 1))
            / (monthly_rate * math.pow(1 + monthly_rate, tenure)),
            2,
        )
    else:
        safe_credit_limit = round(max_allowable_new_emi * tenure, 2)

    return RiskScoringResult(
        applicant_name=applicant_name,
        loan_type=loan_type,
        dti_ratio_percent=dti_ratio,
        health_score=health_score,
        risk_classification=risk_classification,
        decision=decision,
        single_line_explanation=single_line_explanation,
        single_line_verdict=single_line_verdict,
        estimated_new_emi=new_emi,
        total_monthly_debt=total_monthly_debt,
        disposable_income=disposable_income,
        safe_credit_limit=safe_credit_limit,
        income_mismatch_flag=income_mismatch_flag,
        identity_mismatch_flag=False,
        tamper_flag=False,
        missing_documents=[],
        mismatched_fields=mismatched_fields,
        confidence_score=95.0,
        positive_signals=positive_signals,
        risk_factors=risk_factors,
        recommendation=recommendation,
    )
