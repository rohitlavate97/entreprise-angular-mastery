export interface User {
  id: number;
  username: string;
  email: string;
  roles: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateRequest {
  username: string;
  email: string;
  password: string;
  roles: string[];
  active?: boolean;
}

export interface UserUpdateRequest {
  email: string;
  roles: string[];
  active: boolean;
}

export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  isFirst: boolean;
  isLast: boolean;
}

export interface UserFilterParams {
  query?: string;
  role?: string;
  active?: boolean;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface AvailabilityResponse {
  available: boolean;
  field: string;
  value: string;
}
