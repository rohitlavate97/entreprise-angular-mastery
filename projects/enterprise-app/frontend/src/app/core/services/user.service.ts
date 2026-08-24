import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AvailabilityResponse, PageResponse, User, UserCreateRequest, UserFilterParams, UserUpdateRequest } from '../models/user.models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/users';

  getUsers(filters: UserFilterParams = {}): Observable<PageResponse<User>> {
    let params = new HttpParams();

    if (filters.query) params = params.set('query', filters.query);
    if (filters.role) params = params.set('role', filters.role);
    if (filters.active !== undefined) params = params.set('active', filters.active.toString());
    if (filters.page !== undefined) params = params.set('page', filters.page.toString());
    if (filters.size !== undefined) params = params.set('size', filters.size.toString());
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortDir) params = params.set('sortDir', filters.sortDir);

    return this.http.get<PageResponse<User>>(this.baseUrl, { params });
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  createUser(request: UserCreateRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, request);
  }

  updateUser(id: number, request: UserUpdateRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, request);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  checkUsername(username: string): Observable<AvailabilityResponse> {
    const params = new HttpParams().set('username', username);
    return this.http.get<AvailabilityResponse>(`${this.baseUrl}/check-username`, { params });
  }

  checkEmail(email: string): Observable<AvailabilityResponse> {
    const params = new HttpParams().set('email', email);
    return this.http.get<AvailabilityResponse>(`${this.baseUrl}/check-email`, { params });
  }
}
