import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import Hls from 'hls.js';

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

  startEncodedArchive(serverApiEndpoint: string): Observable<any> {
    // serverApiEndpoint should be something like getAPIEndpoint("encodedStartlive") + channel + '/200/100/0'
    return this.proxyRequest('GET', serverApiEndpoint);
  }
  stopEncodedArchive(serverApiEndpoint: string): Observable<any> {
    return this.proxyRequest('GET', serverApiEndpoint);
  }

  onEventsMediaAttached(playerObj: Hls, video: HTMLVideoElement): void {
    playerObj.on(Hls.Events.MEDIA_ATTACHED, () => {
      console.debug('MediaSource attached...');

      setTimeout(() => {
        video.play();
      }, 5000);
    });
  }

  onEventsMediaDetached(playerObj: Hls, video: HTMLVideoElement): void {
    playerObj.on(Hls.Events.MEDIA_DETACHED, () => {
      console.debug('MediaSource detached...');
      playerObj.attachMedia(video);
    });
  }

  onEventsError(playerObj: Hls, video: HTMLVideoElement): void {
    playerObj.on(Hls.Events.ERROR, (event, data) => {
      console.debug('Hls.Events.ERROR...', data);

      switch (data.details) {
        case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
          try {
            console.debug(
              'Cannot load manifest. code, url, text : ',
              data.response?.code,
              data.context?.url,
              data.response?.text,
            );
          } catch {
            console.debug('Cannot load manifest');
          }
          break;

        case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
          console.debug('Timeout while loading manifest');
          break;

        case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
          console.debug('Error while parsing manifest: ' + data.reason);
          break;

        case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
          console.debug('Error while loading level playlist');
          break;

        case Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT:
          console.debug('Timeout while loading level playlist');
          break;

        case Hls.ErrorDetails.LEVEL_SWITCH_ERROR:
          console.error('Error switching to level ' + data.level);
          break;

        case Hls.ErrorDetails.FRAG_LOAD_ERROR:
          console.debug('Error loading fragment ' + data.frag?.url);
          break;

        case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
          console.debug('Timeout loading fragment ' + data.frag?.url);
          break;

        // case Hls.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        //   console.debug("Fragment-loop loading error");
        //   break;

        case Hls.ErrorDetails.FRAG_DECRYPT_ERROR:
          console.debug('Decrypting error: ' + data.reason);
          break;

        case Hls.ErrorDetails.FRAG_PARSING_ERROR:
          console.debug('Parsing error: ' + data.reason);
          break;

        case Hls.ErrorDetails.KEY_LOAD_ERROR:
          console.debug('Error loading key ' + data.frag?.decryptdata?.uri);
          break;

        case Hls.ErrorDetails.KEY_LOAD_TIMEOUT:
          console.debug('Timeout loading key ' + data.frag?.decryptdata?.uri);
          break;

        case Hls.ErrorDetails.BUFFER_APPEND_ERROR:
          console.debug('Buffer append error');
          break;

        case Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR:
          console.debug('Buffer add codec error for ' + data.mimeType + ':' + data.err?.message);
          break;

        case Hls.ErrorDetails.BUFFER_APPENDING_ERROR:
          console.debug('Buffer appending error');
          break;

        case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
          console.debug('Buffer stalled error');
          break;

        default:
          break;
      }

      // Handle fatal errors
      if (data.fatal) {
        console.debug('Fatal error : ' + data.details);

        switch (data.type) {
          case Hls.ErrorTypes.MEDIA_ERROR:
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.debug('Recovering from fatal media/network error...');
            setTimeout(() => {
              playerObj.loadSource(data.context!.url);
              playerObj.startLoad();
            }, 2000);
            break;

          default:
            console.debug('Unrecoverable error → destroying HLS instance');
            playerObj.destroy();
            break;
        }
      }
    });
  }

  handleMediaError(playerObj: Hls): void {
    playerObj.recoverMediaError();
  }

  onEventsFragParsingInitSegment(playerObj: Hls): void {
    playerObj.on(Hls.Events.FRAG_PARSING_INIT_SEGMENT, () => {
      console.debug('Hls.Events.FRAG_PARSING_INIT_SEGMENT...');
    });
  }

  onEventsFragParsingMetadata(playerObj: Hls): void {
    playerObj.on(Hls.Events.FRAG_PARSING_METADATA, () => {
      console.debug('Hls.Events.FRAG_PARSING_METADATA...');
    });
  }

  onEventsLevelSwitching(playerObj: Hls): void {
    playerObj.on(Hls.Events.LEVEL_SWITCHING, () => {
      console.debug('Hls.Events.LEVEL_SWITCHING...');
    });
  }

  onEventsManifestParsed(playerObj: Hls): void {
    playerObj.on(Hls.Events.MANIFEST_PARSED, () => {
      console.debug('Hls.Events.MANIFEST_PARSED...');
    });
  }
}
