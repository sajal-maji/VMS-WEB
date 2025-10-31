import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StreamingService {
  constructor(private http: HttpClient) {}

  // Generic proxy wrapper like your AngularJS code used
  proxyRequest(method: 'GET' | 'POST', url: string, payload?: any): Observable<any> {
    const body = { method, url, payload: payload ? JSON.stringify(payload) : undefined };
    return this.http.post('/proxy', body);
  }

  // Encoded (MJPEG) start/stop
  startEncodedLive(serverApiEndpoint: string): Observable<any> {
    // serverApiEndpoint should be something like getAPIEndpoint("encodedStartlive") + channel + '/200/100/0'
    return this.proxyRequest('GET', serverApiEndpoint);
  }
  stopEncodedLive(serverApiEndpoint: string): Observable<any> {
    return this.proxyRequest('GET', serverApiEndpoint);
  }

  // Start HLS/WebRTC live - expects prebuilt URL as in AngularJS (you may change)
  startLive(serverApiEndpoint: string, postData: any): Observable<any> {
    return this.proxyRequest('POST', serverApiEndpoint, postData);
  }

  stopLive(serverApiEndpoint: string, postData: any): Observable<any> {
    return this.proxyRequest('POST', serverApiEndpoint, postData);
  }

  // PTZ control (GET via proxy in original)
  ptzControl(apiUrl: string): Observable<any> {
    return this.proxyRequest('GET', apiUrl);
  }

  // Presets
  getPresets(apiUrl: string): Observable<any> {
    return this.proxyRequest('GET', apiUrl);
  }

  goToPreset(apiUrl: string, payload: any): Observable<any> {
    return this.proxyRequest('POST', apiUrl, payload);
  }

  // Streaming parameter
  getStreamingParameters(apiUrl: string): Observable<any> {
    return this.proxyRequest('GET', apiUrl);
  }

  // Request a frame blob directly from HLS URL (used for snapshotting MJPEG/HLS preview)
  requestFrameBlob(hlsUrl: string): Observable<Blob> {
    return this.http.get(hlsUrl, { responseType: 'blob' });
  }
}
