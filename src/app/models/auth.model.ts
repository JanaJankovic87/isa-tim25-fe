export interface JwtAuthenticationRequest {
  username: string;
  password: string;
}

export interface UserTokenState {
  accessToken: string;
  expiresIn: number;
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  address?: Address;
  password?: string;
}

export interface UserRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstname: string;
  lastname: string;
  address?: Address;
}
