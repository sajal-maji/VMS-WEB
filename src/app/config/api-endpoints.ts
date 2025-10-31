import { environment } from "../../environments/environment.development";

export const API_ENDPOINTS = {
  LOGIN: `${environment.apiBaseUrl}user/login`,
  SIGNIN: `${environment.apiBaseUrl}user/signin`,
  FORGOT_PASSWORD: `${environment.apiBaseUrl}user/forgotpassword/generatelink`,
  VALIDATE_KEY: `${environment.apiBaseUrl}user/forgotpassword/validate/{uniquekey}`,
  LOCATION_TREE: `${environment.apiBaseUrl}{serverid}/channel/junction/tree`,
  SERVER_INFO: `${environment.apiBaseUrl}server`,
  USER_SESSION: `${environment.apiBaseUrl}user/session`,
  SERVER_CONFIG: `${environment.apiBaseUrl}server/config`,
  ANLYTICS_INFO: `${environment.apiBaseUrl}{serverid}/analytic/type`
};
