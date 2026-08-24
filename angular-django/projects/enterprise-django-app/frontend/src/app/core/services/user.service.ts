import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  username: string;
  email: string;
  roles: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DjangoPageResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  // CRITICAL: Trailing slash prevents Django 301 POST dropping payload!
  private readonly baseUrl = '/api/v1/users/';

  getUsers(query?: string, role?: string, page = 1): Observable<DjangoPageResponse<User>> {
    let params = new HttpParams().set('page', page.toString());
    if (query) params = params.set('query', query);
    if (role) params = params.set('role', role);

    return this.http.get<DjangoPageResponse<User>>(this.baseUrl, { params });
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}${id}/`);
  }

  createUser(data: Partial<User>): Observable<User> {
    return this.http.post<User>(this.baseUrl, data);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`);
  }
}
