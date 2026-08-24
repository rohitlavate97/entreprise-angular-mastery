import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { exhaustMap } from 'rxjs/operators';
import { TransferService } from '../../core/services/transfer.service';
import { Transfer } from '../../core/models/transfer.models';

@Component({
  selector: 'app-transfer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container py-8 max-w-4xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900">Financial Wire Transfer</h1>
        <p class="text-sm text-slate-500 mt-1">Idempotent transaction submission with RxJS exhaustMap and X-Idempotency-Key</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Transfer Form -->
        <div class="lg:col-span-2">
          <div class="card p-6 shadow-sm border border-slate-200">
            @if (feedbackMessage()) {
              <div class="p-3 rounded-md mb-4 text-sm" [ngClass]="isSuccess() ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'">
                {{ feedbackMessage() }}
              </div>
            }

            <form [formGroup]="transferForm" (ngSubmit)="submitTransfer()" class="space-y-4">
              <div>
                <label for="sourceAccount" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Source Account (From)
                </label>
                <input
                  id="sourceAccount"
                  type="text"
                  formControlName="sourceAccount"
                  class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 font-mono"
                  placeholder="US89370400440532013000"
                />
              </div>

              <div>
                <label for="targetAccount" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Beneficiary Account (To)
                </label>
                <input
                  id="targetAccount"
                  type="text"
                  formControlName="targetAccount"
                  class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 font-mono"
                  placeholder="GB29NWBK60161331926819"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="amount" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Transfer Amount
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    formControlName="amount"
                    class="w-full px-3 py-2 border rounded-md text-sm border-slate-300"
                    placeholder="1000.00"
                  />
                </div>

                <div>
                  <label for="currency" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Currency
                  </label>
                  <select id="currency" formControlName="currency" class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 bg-white">
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label for="description" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Payment Reference / Description
                </label>
                <input
                  id="description"
                  type="text"
                  formControlName="description"
                  class="w-full px-3 py-2 border rounded-md text-sm border-slate-300"
                  placeholder="Invoice #9482 Payment"
                />
              </div>

              <div class="pt-2">
                <div class="text-xs text-slate-500 font-mono bg-slate-50 p-2.5 rounded border border-slate-200 mb-4">
                  <strong>X-Idempotency-Key:</strong> {{ currentIdempotencyKey() }}
                </div>

                <button
                  type="submit"
                  [disabled]="transferForm.invalid || isSubmitting()"
                  class="btn btn-primary w-full py-2.5 font-semibold text-sm"
                >
                  @if (isSubmitting()) {
                    <span>Processing Transaction...</span>
                  } @else {
                    <span>Authorize & Execute Transfer</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Recent Transactions Column -->
        <div>
          <div class="card p-6 shadow-sm border border-slate-200">
            <h3 class="text-base font-bold text-slate-800 mb-3 pb-2 border-b">Recent Transfers</h3>
            <div class="space-y-3">
              @for (tx of recentTransfers(); track tx.id) {
                <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div class="flex justify-between items-center mb-1">
                    <span class="font-mono font-bold text-slate-800">{{ tx.referenceId }}</span>
                    <span class="badge badge-success">{{ tx.status }}</span>
                  </div>
                  <div class="text-slate-600 font-medium text-sm">
                    {{ tx.amount | currency:tx.currency }}
                  </div>
                  <div class="text-slate-400 mt-1 truncate">
                    To: <span class="font-mono">{{ tx.targetAccount }}</span>
                  </div>
                </div>
              } @empty {
                <p class="text-xs text-slate-400 text-center py-6">No previous transfers found.</p>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 56rem; margin: 0 auto; padding: 2rem 1.5rem; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .gap-8 { gap: 2rem; }
    .gap-4 { gap: 1rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    input, select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.875rem; }
    @media (min-width: 1024px) {
      .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lg\\:col-span-2 { grid-column: span 2 / span 2; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransferFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly transferService = inject(TransferService);

  readonly isSubmitting = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly isSuccess = signal<boolean>(false);
  readonly recentTransfers = signal<Transfer[]>([]);
  readonly currentIdempotencyKey = signal<string>(this.generateKey());

  private readonly submitSubject = new Subject<void>();

  readonly transferForm = this.fb.group({
    sourceAccount: ['US89370400440532013000', [Validators.required, Validators.minLength(10)]],
    targetAccount: ['GB29NWBK60161331926819', [Validators.required, Validators.minLength(10)]],
    amount: [250.00, [Validators.required, Validators.min(0.01)]],
    currency: ['USD', [Validators.required]],
    description: ['Enterprise Supplier Settlement', [Validators.maxLength(255)]]
  });

  ngOnInit(): void {
    this.loadRecentTransfers();

    // -------------------------------------------------------------
    // RxJS exhaustMap: Ignores new emissions while request is in flight!
    // Prevents double-submit on rapid user clicks!
    // -------------------------------------------------------------
    this.submitSubject.pipe(
      exhaustMap(() => {
        this.isSubmitting.set(true);
        this.feedbackMessage.set(null);
        const req = this.transferForm.getRawValue();
        const key = this.currentIdempotencyKey();

        return this.transferService.createTransfer(req, key);
      })
    ).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.isSuccess.set(true);
        this.feedbackMessage.set(`Transfer authorized successfully! Reference: ${res.referenceId}`);
        this.currentIdempotencyKey.set(this.generateKey()); // Regenerate key for next distinct transaction
        this.loadRecentTransfers();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.isSuccess.set(false);
        this.feedbackMessage.set(err.message || 'Transfer failed.');
      }
    });
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }
    this.submitSubject.next();
  }

  loadRecentTransfers(): void {
    this.transferService.getTransfers().subscribe({
      next: (list) => this.recentTransfers.set(list),
      error: (err) => console.error('Failed to load transfers', err)
    });
  }

  private generateKey(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
