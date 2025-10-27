export interface InterceptorConfig {
  enableLogging?: boolean;
  enableLoadingIndicator?: boolean;
  retryAttempts?: number;
  excludedUrls?: string[];
  timeout?: number;
  enableCache?: boolean;
}

export interface PostInterceptorConfig extends InterceptorConfig {
  enableRequestValidation?: boolean;
  enableResponseValidation?: boolean;
  customHeaders?: Record<string, string>;
}

export interface AuthInterceptorConfig extends InterceptorConfig {
  tokenHeader?: string;
  tokenPrefix?: string;
  excludeAuthUrls?: string[];
}

// Default configurations
export const DEFAULT_POST_CONFIG: PostInterceptorConfig = {
  enableLogging: true,
  enableLoadingIndicator: true,
  retryAttempts: 3,
  excludedUrls: ['/login', '/register', '/forgot-password'],
  timeout: 30000,
  enableCache: false,
  enableRequestValidation: true,
  enableResponseValidation: true,
  customHeaders: {
    'Content-Type': 'application/json'
  }
};

export const DEFAULT_AUTH_CONFIG: AuthInterceptorConfig = {
  enableLogging: true,
  enableLoadingIndicator: false,
  retryAttempts: 1,
  excludedUrls: [],
  timeout: 30000,
  enableCache: false,
  tokenHeader: 'Authorization',
  tokenPrefix: 'Bearer ',
  excludeAuthUrls: ['/login', '/register', '/forgot-password']
};
