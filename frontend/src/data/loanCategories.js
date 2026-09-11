export const LOAN_CATEGORIES = [
  {
    id: 'home-loan',
    title: 'Home Loan',
    subtitle: 'Residential & Housing Finance',
    iconName: 'Home',
    minAmount: '₹1,000,000',
    maxAmount: '₹100,000,000',
    avgRate: '8.50%',
    defaultTenure: 240,
    requiredDocuments: [
      { name: 'Government ID (Aadhaar / PAN)', code: 'KYC_ID', required: true },
      { name: 'Address Proof (Utility Bill / Passport)', code: 'KYC_ADDR', required: true },
      { name: 'Latest 3 Months Salary Slips', code: 'PAY_SLIP', required: true },
      { name: '6 Months Bank Statement (PDF)', code: 'BANK_STMT', required: true },
      { name: 'Form 16 / Latest 2 Years ITR', code: 'ITR_DOC', required: true },
      { name: 'Property Title & Agreement Documents', code: 'PROP_DOC', required: true }
    ]
  },
  {
    id: 'vehicle-loan',
    title: 'Vehicle Loan',
    subtitle: 'Auto & Commercial Vehicle',
    iconName: 'Car',
    minAmount: '₹300,000',
    maxAmount: '₹10,000,000',
    avgRate: '9.25%',
    defaultTenure: 60,
    requiredDocuments: [
      { name: 'Government ID (PAN / Passport)', code: 'KYC_ID', required: true },
      { name: 'Address Proof', code: 'KYC_ADDR', required: true },
      { name: 'Salary Slips / Income Proof', code: 'PAY_SLIP', required: true },
      { name: '6 Months Bank Statement', code: 'BANK_STMT', required: true },
      { name: 'Proforma Invoice / Vehicle Quotation', code: 'VEH_QUOTE', required: true }
    ]
  },
  {
    id: 'education-loan',
    title: 'Education Loan',
    subtitle: 'Higher Studies & Global Academic',
    iconName: 'GraduationCap',
    minAmount: '₹500,000',
    maxAmount: '₹15,000,000',
    avgRate: '9.75%',
    defaultTenure: 120,
    requiredDocuments: [
      { name: 'Student & Co-Applicant Government IDs', code: 'KYC_ID', required: true },
      { name: 'Official Admission Offer Letter', code: 'ADM_LETTER', required: true },
      { name: 'Course Fee Structure Breakdown', code: 'FEE_STRUCT', required: true },
      { name: 'Academic Marksheets & Certificates', code: 'ACAD_CERT', required: true },
      { name: 'Co-applicant Income Proof & ITR', code: 'CO_INC', required: true },
      { name: '6 Months Bank Statement', code: 'BANK_STMT', required: true }
    ]
  },
  {
    id: 'personal-loan',
    title: 'Personal Loan',
    subtitle: 'Unsecured Personal Credit',
    iconName: 'User',
    minAmount: '₹100,000',
    maxAmount: '₹4,000,000',
    avgRate: '11.50%',
    defaultTenure: 48,
    requiredDocuments: [
      { name: 'Government IDs (PAN & Aadhaar)', code: 'KYC_ID', required: true },
      { name: 'Current Address Proof', code: 'KYC_ADDR', required: true },
      { name: 'Latest 3 Months Salary Slips', code: 'PAY_SLIP', required: true },
      { name: 'Form 16 / ITR Tax Returns', code: 'ITR_DOC', required: true },
      { name: '6 Months Salary Account Statement', code: 'BANK_STMT', required: true }
    ]
  },
  {
    id: 'business-loan',
    title: 'Business Loan',
    subtitle: 'Commercial Credit & SME Working Capital',
    iconName: 'Building2',
    minAmount: '₹1,000,000',
    maxAmount: '₹50,000,000',
    avgRate: '12.00%',
    defaultTenure: 60,
    requiredDocuments: [
      { name: 'Business Registration / GST Certificate', code: 'GST_CERT', required: true },
      { name: 'Promoter & Business KYC Documents', code: 'KYC_ID', required: true },
      { name: 'Latest 2 Years Audited Financial Statements', code: 'FIN_STMT', required: true },
      { name: '2 Years Business ITR Returns', code: 'ITR_DOC', required: true },
      { name: '12 Months Current Bank Account Statement', code: 'BANK_STMT', required: true }
    ]
  },
  {
    id: 'agricultural-loan',
    title: 'Agricultural Loan',
    subtitle: 'Kisan & Agri Infrastructure',
    iconName: 'Sprout',
    minAmount: '₹200,000',
    maxAmount: '₹20,000,000',
    avgRate: '7.00%',
    defaultTenure: 36,
    requiredDocuments: [
      { name: 'Farmer KYC (Aadhaar / Voter ID)', code: 'KYC_ID', required: true },
      { name: 'Land Ownership / 7/12 Land Extract', code: 'LAND_REC', required: true },
      { name: 'Crop Cultivation & Yield Details', code: 'CROP_REC', required: true },
      { name: '6 Months Bank Account Statement', code: 'BANK_STMT', required: true }
    ]
  },
  {
    id: 'gold-loan',
    title: 'Gold Loan',
    subtitle: 'Pledged Bullion Finance',
    iconName: 'Coins',
    minAmount: '₹50,000',
    maxAmount: '₹10,000,000',
    avgRate: '8.90%',
    defaultTenure: 12,
    requiredDocuments: [
      { name: 'Government ID Proof (PAN / Aadhaar)', code: 'KYC_ID', required: true },
      { name: 'Address Proof', code: 'KYC_ADDR', required: true },
      { name: 'Gold Ornaments Valuation Certificate', code: 'GOLD_VAL', required: true }
    ]
  },
  {
    id: 'lap',
    title: 'Loan Against Property',
    subtitle: 'Mortgage & Property Encumbrance',
    iconName: 'Key',
    minAmount: '₹2,000,000',
    maxAmount: '₹75,000,000',
    avgRate: '9.50%',
    defaultTenure: 180,
    requiredDocuments: [
      { name: 'Property Title Deeds & Chain Documents', code: 'PROP_TITLE', required: true },
      { name: 'Valuation & Legal Search Report', code: 'PROP_VAL', required: true },
      { name: 'Promoter / Borrower KYC', code: 'KYC_ID', required: true },
      { name: 'Income Proof & 2 Years ITR', code: 'ITR_DOC', required: true },
      { name: '12 Months Bank Statement', code: 'BANK_STMT', required: true }
    ]
  },
  {
    id: 'consumer-loan',
    title: 'Consumer Loan',
    subtitle: 'Retail Durable & Electronics Credit',
    iconName: 'ShoppingBag',
    minAmount: '₹20,000',
    maxAmount: '₹500,000',
    avgRate: '12.50%',
    defaultTenure: 24,
    requiredDocuments: [
      { name: 'KYC Documents (PAN / Aadhaar)', code: 'KYC_ID', required: true },
      { name: 'Proof of Income / Salary Slip', code: 'PAY_SLIP', required: true },
      { name: 'Product Quotation / Merchant Invoice', code: 'PROD_QUOTE', required: true }
    ]
  },
  {
    id: 'machinery-loan',
    title: 'Equipment & Machinery Loan',
    subtitle: 'Industrial Plant & Capital Asset',
    iconName: 'Cpu',
    minAmount: '₹1,500,000',
    maxAmount: '₹50,000,000',
    avgRate: '10.50%',
    defaultTenure: 60,
    requiredDocuments: [
      { name: 'Machinery Supplier Proforma Quotation', code: 'MACH_QUOTE', required: true },
      { name: 'Business Registration & GST Return', code: 'GST_CERT', required: true },
      { name: 'Latest 2 Years Audited Financial Statements', code: 'FIN_STMT', required: true },
      { name: '12 Months Bank Account Statement', code: 'BANK_STMT', required: true }
    ]
  },
  {
    id: 'securities-loan',
    title: 'Loan Against Securities',
    subtitle: 'Shares, Mutual Funds & Bonds Pledge',
    iconName: 'LineChart',
    minAmount: '₹500,000',
    maxAmount: '₹30,000,000',
    avgRate: '9.00%',
    defaultTenure: 36,
    requiredDocuments: [
      { name: 'Demat Holding Statement / Mutual Fund Folio', code: 'DEMAT_STMT', required: true },
      { name: 'Pledge Request Form & Securities Valuation', code: 'PLEDGE_DOC', required: true },
      { name: 'Government ID (PAN Mandatory)', code: 'KYC_ID', required: true },
      { name: '6 Months Bank Account Statement', code: 'BANK_STMT', required: true }
    ]
  }
];

export const INSTITUTIONAL_ROLES = [
  { id: 'fintech', title: 'Fintech Companies', icon: 'Zap', permissions: 'Full API Access • Automated Underwriting' },
  { id: 'nbfc', title: 'NBFCs', icon: 'Landmark', permissions: 'High-Volume Scoring • Co-Lending Policy' },
  { id: 'lending', title: 'Lending Companies', icon: 'Briefcase', permissions: 'Direct Disbursement • Policy Customization' },
  { id: 'bank', title: 'Banks', icon: 'Building', permissions: 'Regulatory Compliance • Enterprise Governance' },
  { id: 'sme', title: 'SMEs', icon: 'Store', permissions: 'Vendor Financing • Working Capital Intake' },
  { id: 'credit', title: 'Credit Teams', icon: 'ShieldCheck', permissions: 'Manual Overrides • Deep Audit Trail' },
  { id: 'analyst', title: 'Financial Analysts', icon: 'BarChart2', permissions: 'Portfolio Stress Test • Model Analytics' }
];
