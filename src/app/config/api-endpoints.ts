import { environment } from "../../environments/environment.development";

export const API_ENDPOINTS = {
  LOGIN: `${environment.apiBaseUrl}user/login`,
  FORGOT_PASSWORD: `${environment.apiBaseUrl}user/forgotpassword/generatelink`,
  SIGNUP: `${environment.apiBaseUrl}user/signup`,
  LOCATION_TREE: `${environment.apiBaseUrl}{serverid}/channel/junction/tree`,
  SERVER_INFO: `${environment.apiBaseUrl}server`,
  USER_SESSION: `${environment.apiBaseUrl}user/session`,
  VALIDATE_KEY: `${environment.apiBaseUrl}user/forgotpassword/validate/{uniquekey}`
};
