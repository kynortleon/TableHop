export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
  url?: string;
}

export interface ValidationSummary {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
