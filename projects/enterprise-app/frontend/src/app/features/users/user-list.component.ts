import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { PageResponse, User, UserFilterParams } from '../../core/models/user.models';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PaginationComponent],
  template: `
    <div class="container py-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">User Management Directory</h1>
          <p class="text-sm text-slate-500 mt-1">Server-side paginated, sorted, and debounced search via Spring Data JPA</p>
        </div>

        @if (authService.isAdmin()) {
          <a routerLink="/users/new" class="btn btn-primary text-sm shadow">
            + Create New User
          </a>
        }
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card mb-6 p-4 bg-white border border-slate-200 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="search" class="block text-xs font-semibold text-slate-500 uppercase mb-1">Debounced Search</label>
            <input
              id="search"
              type="text"
              [formControl]="searchControl"
              placeholder="Search by username or email..."
              class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label for="role" class="block text-xs font-semibold text-slate-500 uppercase mb-1">Filter by Role</label>
            <select
              id="role"
              [formControl]="roleControl"
              class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 bg-white"
            >
              <option value="">All Roles</option>
              <option value="ROLE_ADMIN">ROLE_ADMIN</option>
              <option value="ROLE_MANAGER">ROLE_MANAGER</option>
              <option value="ROLE_USER">ROLE_USER</option>
            </select>
          </div>

          <div>
            <label for="sort" class="block text-xs font-semibold text-slate-500 uppercase mb-1">Sort Field</label>
            <select
              id="sort"
              [formControl]="sortControl"
              class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 bg-white"
            >
              <option value="createdAt,desc">Created Date (Newest First)</option>
              <option value="createdAt,asc">Created Date (Oldest First)</option>
              <option value="username,asc">Username (A-Z)</option>
              <option value="email,asc">Email (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- User Data Table -->
      <div class="card overflow-hidden p-0 border border-slate-200 shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <th class="p-3.5">ID</th>
                <th class="p-3.5">Username</th>
                <th class="p-3.5">Email</th>
                <th class="p-3.5">Roles</th>
                <th class="p-3.5">Status</th>
                <th class="p-3.5">Created At</th>
                @if (authService.isAdmin()) {
                  <th class="p-3.5 text-right">Actions</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-sm">
              @if (isLoading()) {
                <tr>
                  <td [attr.colspan]="authService.isAdmin() ? 7 : 6" class="p-8 text-center text-slate-400">
                    Loading enterprise users...
                  </td>
                </tr>
              } @else {
                @for (user of users(); track user.id) {
                  <tr class="hover:bg-slate-50/50 transition">
                    <td class="p-3.5 font-mono text-xs text-slate-500">{{ user.id }}</td>
                    <td class="p-3.5 font-medium text-slate-900">{{ user.username }}</td>
                    <td class="p-3.5 text-slate-600">{{ user.email }}</td>
                    <td class="p-3.5">
                      <div class="flex gap-1">
                        @for (role of user.roles; track role) {
                          <span class="badge badge-success text-[10px]">{{ role }}</span>
                        }
                      </div>
                    </td>
                    <td class="p-3.5">
                      <span class="badge" [ngClass]="user.active ? 'badge-success' : 'badge-danger'">
                        {{ user.active ? 'Active' : 'Disabled' }}
                      </span>
                    </td>
                    <td class="p-3.5 text-xs text-slate-500 font-mono">{{ user.createdAt | date:'short' }}</td>
                    @if (authService.isAdmin()) {
                      <td class="p-3.5 text-right space-x-2">
                        <a [routerLink]="['/users/edit', user.id]" class="text-xs text-blue-600 hover:underline">
                          Edit
                        </a>
                        <button (click)="deleteUser(user)" class="text-xs text-rose-600 hover:underline border-none bg-transparent cursor-pointer">
                          Delete
                        </button>
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="authService.isAdmin() ? 7 : 6" class="p-8 text-center text-slate-400">
                      No users match the search criteria.
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (pageData()) {
          <div class="px-4">
            <app-pagination
              [currentPage]="pageData()!.pageNumber"
              [pageSize]="pageData()!.pageSize"
              [totalElements]="pageData()!.totalElements"
              [totalPages]="pageData()!.totalPages"
              (pageChange)="onPageChange($event)"
            />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .gap-4 { gap: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.875rem; text-align: left; }
    @media (min-width: 768px) {
      .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  readonly authService = inject(AuthService);

  readonly users = signal<User[]>([]);
  readonly pageData = signal<PageResponse<User> | null>(null);
  readonly isLoading = signal<boolean>(false);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly roleControl = new FormControl('', { nonNullable: true });
  readonly sortControl = new FormControl('createdAt,desc', { nonNullable: true });

  private currentPage = 0;
  private pageSize = 10;

  ngOnInit(): void {
    this.loadUsers();

    // Debounced search input
    this.searchControl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadUsers();
    });

    this.roleControl.valueChanges.subscribe(() => {
      this.currentPage = 0;
      this.loadUsers();
    });

    this.sortControl.valueChanges.subscribe(() => {
      this.loadUsers();
    });
  }

  loadUsers(): void {
    this.isLoading.set(true);

    const [sortBy, sortDir] = this.sortControl.value.split(',');

    const params: UserFilterParams = {
      query: this.searchControl.value || undefined,
      role: this.roleControl.value || undefined,
      page: this.currentPage,
      size: this.pageSize,
      sortBy: sortBy || 'createdAt',
      sortDir: (sortDir as 'asc' | 'desc') || 'desc'
    };

    this.userService.getUsers(params).subscribe({
      next: (res) => {
        this.users.set(res.content);
        this.pageData.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Failed to load users', err);
      }
    });
  }

  onPageChange(newPage: number): void {
    this.currentPage = newPage;
    this.loadUsers();
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete user '${user.username}'?`)) {
      this.userService.deleteUser(user.id).subscribe({
        next: () => this.loadUsers(),
        error: (err) => alert(`Failed to delete user: ${err.message}`)
      });
    }
  }
}
