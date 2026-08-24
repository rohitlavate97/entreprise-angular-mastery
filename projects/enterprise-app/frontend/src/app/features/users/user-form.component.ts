import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/services/user.service';
import { uniqueUsernameValidator, uniqueEmailValidator } from '../../core/validators/async-user.validators';
import { Role } from '../../core/models/auth.models';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="container py-8 max-w-2xl mx-auto">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{{ isEditMode() ? 'Edit User' : 'Create New User' }}</h1>
          <p class="text-sm text-slate-500 mt-1">Reactive form with real-time async backend validators</p>
        </div>
        <a routerLink="/users" class="text-xs text-slate-600 hover:text-slate-900 underline">
          &larr; Back to Directory
        </a>
      </div>

      <div class="card p-6 shadow-sm border border-slate-200">
        @if (serverError()) {
          <div class="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-md mb-4">
            {{ serverError() }}
          </div>
        }

        <form [formGroup]="userForm" (ngSubmit)="onSubmit()" class="space-y-4">
          <!-- Username Field (Create Mode only) -->
          @if (!isEditMode()) {
            <div>
              <label for="username" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                formControlName="username"
                class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. jdoe"
              />
              @if (userForm.controls.username.pending) {
                <p class="text-xs text-blue-500 mt-1">Checking username availability with backend...</p>
              }
              @if (userForm.controls.username.touched && userForm.controls.username.errors?.['required']) {
                <p class="text-xs text-rose-500 mt-1">Username is required.</p>
              }
              @if (userForm.controls.username.touched && userForm.controls.username.errors?.['minlength']) {
                <p class="text-xs text-rose-500 mt-1">Username must be at least 3 characters.</p>
              }
              @if (userForm.controls.username.errors?.['usernameTaken']) {
                <p class="text-xs text-rose-500 mt-1">This username is already taken by another user.</p>
              }
            </div>
          }

          <!-- Email Field -->
          <div>
            <label for="email" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. user@enterprise.io"
            />
            @if (userForm.controls.email.pending) {
              <p class="text-xs text-blue-500 mt-1">Checking email availability...</p>
            }
            @if (userForm.controls.email.touched && userForm.controls.email.errors?.['required']) {
              <p class="text-xs text-rose-500 mt-1">Email is required.</p>
            }
            @if (userForm.controls.email.touched && userForm.controls.email.errors?.['email']) {
              <p class="text-xs text-rose-500 mt-1">Please enter a valid email address.</p>
            }
            @if (userForm.controls.email.errors?.['emailTaken']) {
              <p class="text-xs text-rose-500 mt-1">This email address is already registered.</p>
            }
          </div>

          <!-- Password Field (Create Mode only) -->
          @if (!isEditMode()) {
            <div>
              <label for="password" class="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                class="w-full px-3 py-2 border rounded-md text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="At least 8 characters"
              />
              @if (userForm.controls.password.touched && userForm.controls.password.errors?.['required']) {
                <p class="text-xs text-rose-500 mt-1">Password is required.</p>
              }
              @if (userForm.controls.password.touched && userForm.controls.password.errors?.['minlength']) {
                <p class="text-xs text-rose-500 mt-1">Password must be at least 8 characters.</p>
              }
            </div>
          }

          <!-- Roles Checkboxes -->
          <div>
            <span class="block text-xs font-semibold text-slate-700 uppercase mb-2">Role Assignments</span>
            <div class="flex gap-4">
              <label class="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" [checked]="hasRole('ROLE_USER')" (change)="toggleRole('ROLE_USER')" />
                <span>ROLE_USER</span>
              </label>
              <label class="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" [checked]="hasRole('ROLE_MANAGER')" (change)="toggleRole('ROLE_MANAGER')" />
                <span>ROLE_MANAGER</span>
              </label>
              <label class="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" [checked]="hasRole('ROLE_ADMIN')" (change)="toggleRole('ROLE_ADMIN')" />
                <span>ROLE_ADMIN</span>
              </label>
            </div>
          </div>

          <!-- Active Status -->
          <div class="pt-2">
            <label class="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" formControlName="active" />
              <span>Active Account Status</span>
            </label>
          </div>

          <!-- Form Actions -->
          <div class="pt-4 border-t flex justify-end space-x-3">
            <a routerLink="/users" class="btn bg-slate-100 text-slate-700 hover:bg-slate-200 px-4">Cancel</a>
            <button
              type="submit"
              [disabled]="userForm.invalid || userForm.pending || isSubmitting()"
              class="btn btn-primary px-6"
            >
              @if (isSubmitting()) {
                <span>Saving...</span>
              } @else {
                <span>{{ isEditMode() ? 'Update User' : 'Create User' }}</span>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 40rem; margin: 0 auto; padding: 2rem 1.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .flex { display: flex; }
    .gap-4 { gap: 1rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-x-3 > * + * { margin-left: 0.75rem; }
    .justify-end { justify-content: flex-end; }
    input[type="text"], input[type="email"], input[type="password"] {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.875rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isEditMode = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly serverError = signal<string | null>(null);

  private userId: number | null = null;
  readonly selectedRoles = signal<string[]>(['ROLE_USER']);

  readonly userForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)], [uniqueUsernameValidator(this.userService)]],
    email: ['', [Validators.required, Validators.email], [uniqueEmailValidator(this.userService)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    active: [true]
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      this.userId = Number(idParam);
      this.isEditMode.set(true);

      // Disable password and username in edit mode
      this.userForm.controls.password.clearValidators();
      this.userForm.controls.password.updateValueAndValidity();
      this.userForm.controls.username.clearValidators();
      this.userForm.controls.username.clearAsyncValidators();
      this.userForm.controls.username.updateValueAndValidity();

      this.userService.getUserById(this.userId).subscribe({
        next: (user) => {
          this.userForm.patchValue({
            username: user.username,
            email: user.email,
            active: user.active
          });
          this.selectedRoles.set(user.roles);
        },
        error: (err) => this.serverError.set(err.message)
      });
    }
  }

  hasRole(role: string): boolean {
    return this.selectedRoles().includes(role);
  }

  toggleRole(role: string): void {
    const roles = this.selectedRoles();
    if (roles.includes(role)) {
      if (roles.length > 1) {
        this.selectedRoles.set(roles.filter((r) => r !== role));
      }
    } else {
      this.selectedRoles.set([...roles, role]);
    }
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.serverError.set(null);

    const formVal = this.userForm.getRawValue();

    if (this.isEditMode() && this.userId) {
      this.userService.updateUser(this.userId, {
        email: formVal.email,
        roles: this.selectedRoles(),
        active: formVal.active
      }).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/users']);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.serverError.set(err.message);
        }
      });
    } else {
      this.userService.createUser({
        username: formVal.username,
        email: formVal.email,
        password: formVal.password,
        roles: this.selectedRoles(),
        active: formVal.active
      }).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/users']);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.serverError.set(err.message);
        }
      });
    }
  }
}
