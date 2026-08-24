import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TransferService } from '../../core/services/transfer.service';

@Component({
  selector: 'app-transfer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container py-8 max-w-2xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900">Django 5+ Wire Transfer</h1>
        <p class="text-sm text-slate-500 mt-1">Idempotent transactions with X-Idempotency-Key header</p>
      </div>

      <div class="card p-6">
        @if (message()) {
          <div class="p-3 mb-4 rounded text-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
            {{ message() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Source Account</label>
            <input type="text" formControlName="sourceAccount" class="w-full px-3 py-2 border rounded text-sm font-mono" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Target Account</label>
            <input type="text" formControlName="targetAccount" class="w-full px-3 py-2 border rounded text-sm font-mono" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-600 uppercase mb-1">Amount ($)</label>
            <input type="number" formControlName="amount" class="w-full px-3 py-2 border rounded text-sm" />
          </div>

          <div class="pt-2">
            <button type="submit" [disabled]="form.invalid || isSubmitting()" class="btn btn-django w-full py-2.5">
              @if (isSubmitting()) {
                <span>Processing...</span>
              } @else {
                <span>Execute Transfer</span>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 36rem; margin: 0 auto; padding: 2rem 1.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    input { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; }
  `]
})
export class TransferFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly transferService = inject(TransferService);

  readonly isSubmitting = signal<boolean>(false);
  readonly message = signal<string | null>(null);

  readonly form = this.fb.group({
    sourceAccount: ['US89370400440532013000', [Validators.required]],
    targetAccount: ['GB29NWBK60161331926819', [Validators.required]],
    amount: [100.00, [Validators.required, Validators.min(1)]],
    currency: ['USD']
  });

  submit(): void {
    if (this.form.invalid) return;

    this.isSubmitting.set(true);
    this.message.set(null);

    const idempotencyKey = crypto.randomUUID();

    this.transferService.createTransfer(this.form.getRawValue(), idempotencyKey).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.message.set(`Transfer authorized by Django! Reference: ${res.referenceId}`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.message.set(err.message || 'Transfer failed.');
      }
    });
  }
}
