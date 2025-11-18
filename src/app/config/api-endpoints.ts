import { environment } from "../../environments/environment";

export const API_ENDPOINTS = {
  LOGIN: `${environment.apiBaseUrl}user/login`,
  SIGNIN: `${environment.apiBaseUrl}user/signin`,
  FORGOT_PASSWORD: `${environment.apiBaseUrl}user/forgotpassword/generatelink`,
  VALIDATE_KEY: `${environment.apiBaseUrl}user/forgotpassword/validate/{uniquekey}`,
  LOCATION_TREE: `${environment.apiBaseUrl}{serverid}/channel/junction/tree`,
  CHANNEL_STATUS: `${environment.apiBaseUrl}{serverid}/channel/channel/status`,
  SERVER_INFO: `${environment.apiBaseUrl}server`,
  USER_SESSION: `${environment.apiBaseUrl}user/session`,
  SERVER_CONFIG: `${environment.apiBaseUrl}server/config`,
  ANALYTICS_INFO: `${environment.apiBaseUrl}{serverid}/analytic/type`,
  KEEP_ALIVE_LIVE: `${environment.apiBaseUrl}{serverid}/live/keepalive`,
  WEBRTC_LIVE: `${environment.apiBaseUrl}webrtc/{serverid}/startlive`,
  HLS_START_LIVE: `${environment.apiBaseUrl}{serverid}/startlive`,
  HLS_STOP_LIVE: `${environment.apiBaseUrl}{serverid}/stoplive`,
  WEBRTC_ARCHIVE: `${environment.apiBaseUrl}webrtc/{serverid}/startarchive`,
  HLS_START_ARCHIVE: `${environment.apiBaseUrl}{serverid}/startarchive`,
  VIDEO_INFO: `${environment.apiBaseUrl}{serverid}/channel/getstreamingparameter/{channelid}/{streamindex}`,
  CHANNEL_INFO: `${environment.apiBaseUrl}{serverid}/channel`,
  EVENT_SEARCH: `${environment.apiBaseUrl}{serverid}/event/getevents`,
  EVENT_COUNT: `${environment.apiBaseUrl}{serverid}/event/count`,
  USER_INFO: `${environment.apiBaseUrl}user`,
  UPDATE_USER: `${environment.apiBaseUrl}user/update/details`,
  CHANGE_PASSWORD: `${environment.apiBaseUrl}user/changepassword`
};
