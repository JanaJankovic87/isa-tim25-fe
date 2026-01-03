export interface JwtAuthenticationRequest {
  username: string;
  password: string;
}

export interface UserTokenState {
  accessToken: string;
  expiresIn: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}
