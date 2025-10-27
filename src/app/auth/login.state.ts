export interface LoginState {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  error: string | null;
}

export const initialLoginState: LoginState = {
  isLoading: false,
  isAuthenticated: false,
  token: null,
  error: null
};


