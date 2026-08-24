export interface Transfer {
  id: string;
  referenceId: string;
  sourceAccount: string;
  targetAccount: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface TransferRequest {
  sourceAccount: string;
  targetAccount: string;
  amount: number;
  currency: string;
  description?: string;
}
