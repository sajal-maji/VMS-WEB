import { environment } from "../../environments/environment.development";

export const API_ENDPOINTS = {
  LOGIN: `${environment.apiBaseUrl}user/login`,
  FORGOT_PASSWORD: `${environment.apiBaseUrl}user/forgotpassword/generatelink`,
  SIGNUP: `${environment.apiBaseUrl}user/signup`,
  LOCATION_TREE: `${environment.apiBaseUrl}1100/channel/junction/tree`
  // Add other endpoints here
};
