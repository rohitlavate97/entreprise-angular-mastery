import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { UserService } from '../services/user.service';

/**
 * Debounced Async Validator for checking username availability against Spring Boot.
 * Uses timer(400) + switchMap to avoid flooding backend on rapid typing.
 */
export function uniqueUsernameValidator(userService: UserService, currentUsername?: string): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value?.trim();

    if (!value || value === currentUsername) {
      return of(null);
    }

    return timer(400).pipe(
      switchMap(() => userService.checkUsername(value)),
      map((res) => (res.available ? null : { usernameTaken: true })),
      catchError(() => of(null))
    );
  };
}

/**
 * Debounced Async Validator for checking email availability against Spring Boot.
 */
export function uniqueEmailValidator(userService: UserService, currentEmail?: string): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value?.trim();

    if (!value || value === currentEmail) {
      return of(null);
    }

    return timer(400).pipe(
      switchMap(() => userService.checkEmail(value)),
      map((res) => (res.available ? null : { emailTaken: true })),
      catchError(() => of(null))
    );
  };
}
