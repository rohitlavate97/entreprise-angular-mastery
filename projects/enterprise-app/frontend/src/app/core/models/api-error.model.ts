export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  errorCode: string;
  message: string;
  fieldErrors?: FieldErrorItem[];
  traceId?: string;
}

export interface FieldErrorItem {
  field: string;
  message: string;
  rejectedValue?: unknown;
}
