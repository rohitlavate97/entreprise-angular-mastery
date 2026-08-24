import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UserService, User } from '../../core/services/user.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container py-8">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900">Django 5+ User Directory</h1>
        <p class="text-sm text-slate-500 mt-1">Debounced search with trailing slash safe API endpoints</p>
      </div>

      <div class="card mb-6 p-4">
        <input
          type="text"
          [formControl]="searchControl"
          placeholder="Search by username or email..."
          class="w-full px-3 py-2 border rounded-md text-sm border-slate-300"
        />
      </div>

      <div class="card p-0 overflow-hidden">
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <th class="p-3">ID</th>
              <th class="p-3">Username</th>
              <th class="p-3">Email</th>
              <th class="p-3">Roles</th>
              <th class="p-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            @for (user of users(); track user.id) {
              <tr>
                <td class="p-3 font-mono text-xs">{{ user.id }}</td>
                <td class="p-3 font-medium">{{ user.username }}</td>
                <td class="p-3 text-slate-600">{{ user.email }}</td>
                <td class="p-3">
                  <div class="flex gap-1">
                    @for (role of user.roles; track role) {
                      <span class="badge badge-success">{{ role }}</span>
                    }
                  </div>
                </td>
                <td class="p-3">
                  <span class="badge" [ngClass]="user.is_active ? 'badge-success' : 'badge-danger'">
                    {{ user.is_active ? 'Active' : 'Disabled' }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="p-6 text-center text-slate-400">No users found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; }
    input { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; }
  `]
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  readonly users = signal<User[]>([]);
  readonly searchControl = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.loadUsers();

    this.searchControl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe((val) => this.loadUsers(val));
  }

  loadUsers(query?: string): void {
    this.userService.getUsers(query).subscribe({
      next: (res) => this.users.set(res.results),
      error: (err) => console.error('Failed to load users from Django', err)
    });
  }
}
