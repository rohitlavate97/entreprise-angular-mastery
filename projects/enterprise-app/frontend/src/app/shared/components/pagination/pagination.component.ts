import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-between py-3 border-t border-slate-200">
      <div class="text-xs text-slate-500">
        Showing
        <span class="font-medium text-slate-700">{{ startIndex() }}</span>
        to
        <span class="font-medium text-slate-700">{{ endIndex() }}</span>
        of
        <span class="font-medium text-slate-700">{{ totalElements() }}</span>
        results
      </div>

      <div class="flex items-center space-x-2">
        <button
          (click)="pageChange.emit(currentPage() - 1)"
          [disabled]="currentPage() === 0"
          class="btn text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 disabled:opacity-50"
        >
          Previous
        </button>

        <span class="text-xs text-slate-600 px-2 font-mono">
          Page {{ currentPage() + 1 }} of {{ totalPages() || 1 }}
        </span>

        <button
          (click)="pageChange.emit(currentPage() + 1)"
          [disabled]="currentPage() >= totalPages() - 1"
          class="btn text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  `,
  styles: [`
    .flex { display: flex; align-items: center; justify-content: space-between; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationComponent {
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalElements = input.required<number>();
  readonly totalPages = input.required<number>();

  readonly pageChange = output<number>();

  startIndex(): number {
    return this.totalElements() === 0 ? 0 : this.currentPage() * this.pageSize() + 1;
  }

  endIndex(): number {
    return Math.min((this.currentPage() + 1) * this.pageSize(), this.totalElements());
  }
}
