/* -------------------------
   ORIGINAL OneXOneComponent
   (kept exactly as you provided)
   ------------------------- */

import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, Renderer2, ViewChildren, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { interval, Subscription, timer } from 'rxjs';
import Hls from 'hls.js';
import { TreeComponent } from '../tree/tree.component';
import { HeaderComponent } from '../header/header.component';
import { LayoutService } from '../live-matrix/layout.service';
import { VideoStreamService } from '../../store/service/video-stream.service';
import { StreamingService } from '../../store/service/commonService/streaming.service';
type Player = {
  isMicrophoneOn?: boolean;
  microphone_txt?: string;
  speaker_txt?: string;
  isSpeakerOn?: any;
  elem_id: string;
  waitinggolla_id?: string;
  controls_id?: string;
  channelId: number;
  channelName: string;
  sessionId: number;
  mjpeg_sessionId: number;
  hlsURL: string;
  hlsPlayer?: Hls;
  webrtc?: any;
  isplaying: boolean;
  ptz_control?: boolean;
  status?: number;
  error?: string;
  recoverDecodingErrorDate?: any;
  recoverSwapAudioCodecDate?: any;
  streamingParameters?: any;
  videoInfoIntervalSub?: Subscription | null;
  streamType?: number;
};

const liveHlsJsConfig = {
  maxBufferLength: 30,
  liveDurationInfinity: true
};

@Component({
  selector: 'app-dashboard',
  standalone: true,        // ✅ must be standalone for lazy-loading
  imports: [CommonModule, TreeComponent, HeaderComponent, RouterLink, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly layout = inject(LayoutService);
  readonly selectedLayout = computed(() => this.layout.selectedLayout());
  @ViewChildren('videoRef') videoRefs!: QueryList<ElementRef<HTMLVideoElement>>;

  players: Player[] = [];
  ptzindex = -1;
  ptzplayer: any = {};
  currentPlayer: any = {};
  allPresets: any[] = [];
  vSessionId = ''; // if you used vsessionid in original
  serverConfiguration: any = null;
  rootconfig: any = {}; // replace or inject as needed
  sendMatrix: { matrix: string; channels: string[]; matrixUrl: string } = { matrix: '2x2', channels: [], matrixUrl: '' };
  currentTime = '';
  private subscriptions: Subscription[] = [];
  private keepAliveSub?: Subscription;
  navigator = window.navigator; // fix: Property 'navigator' does not exist

  matrixItems: any[] = []; // fix: used in *ngFor
  model: any = { error: '' };
  constructor(
    private renderer: Renderer2,
    private streamSvc: StreamingService,
    private http: HttpClient,
    private videoneticsRTC: VideoStreamService
  ) {} 

  ngOnInit(): void {
    this.initPlayers(25);
    this.updateCurrentTime();
    const t = interval(1000).subscribe(() => this.updateCurrentTime());
    this.subscriptions.push(t);

    // start keepalive behavior for live sessions (if required)
    this.liveKeepAlive();
  }

  ngAfterViewInit(): void {
    // Make overlay draggable after view init
    const overlay = document.getElementById('overlay');
    if (overlay) {
      this.makeDraggable(overlay);
    }
  }

  ngOnDestroy(): void {
    // Cleanup hls instances and subscriptions
    this.players.forEach((p) => {
      p.hlsPlayer?.destroy();
      p.videoInfoIntervalSub?.unsubscribe();
    });
    this.subscriptions.forEach(s => s.unsubscribe());
    this.keepAliveSub?.unsubscribe();
  }

  private initPlayers(count: number) {
    this.players = [];
    for (let i = 1; i <= count; i++) {
      this.players.push({
        elem_id: `video${i}`,
        waitinggolla_id: `golla${i}`,
        controls_id: `controls${i}`,
        channelId: -1,
        channelName: i.toString().padStart(2, '0'),
        sessionId: 0,
        mjpeg_sessionId: 0,
        hlsURL: '',
        isplaying: false,
        ptz_control: false,
        webrtc: undefined,
        hlsPlayer: undefined,
        streamType: -1,
        videoInfoIntervalSub: null
      });
    }
  }

  /* ============================
     HLS playback utilities
     ============================ */

  private playStream(index: number, hlsUrl: string) {
    const player = this.players[index];
    const video = this.getVideoElement(index);
    if (!video) return;

    // destroy existing HLS
    if (player.hlsPlayer) {
      try { player.hlsPlayer.destroy(); } catch (e) { /* ignore */ }
      player.hlsPlayer = undefined;
    }

    // native HLS support (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.load();
      video.play().catch(err => console.error('video.play error', err));
    } else if (Hls.isSupported()) {
      const hls = new Hls(liveHlsJsConfig);
      player.hlsPlayer = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(err => console.error('video.play error', err));
      });

      // Optional: bind events similar to your old `onEvents*` callbacks
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS error', event, data);
      });
    } else {
      console.error('HLS not supported by this browser');
    }

    player.hlsURL = hlsUrl;
    player.isplaying = true;
    this.manageVideoInfoInterval(index);
  }

  private stopHls(index: number) {
    const player = this.players[index];
    if (!player) return;
    if (player.hlsPlayer) {
      try { player.hlsPlayer.destroy(); } catch (e) { /* ignore */ }
      player.hlsPlayer = undefined;
    }
    const video = this.getVideoElement(index);
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    player.hlsURL = '';
    player.isplaying = false;
    player.sessionId = 0;
    this.cancelVideoInfoInterval(index);
  }

  private getVideoElement(index: number): HTMLVideoElement | null {
    const arr = this.videoRefs?.toArray() || [];
    const ref = arr[index];
    return ref ? ref.nativeElement : document.getElementById(this.players[index].elem_id) as HTMLVideoElement | null;
  }

  /* ============================
     Encoded (MJPEG) handling
     ============================ */

  startEncodedLive(index: number) {
    if (index < 0) return;
    const player = this.players[index];
    // build endpoint like your original: encodedStartlive + channel + '/200/100/0'
    const apiEndpoint = this.getApiEndpointEncodedStart(player.channelId);

    this.streamSvc.startEncodedLive(apiEndpoint).subscribe({
      next: (response: any) => {
        const result = response?.result?.[0];
        if (!result) return;
        player.mjpeg_sessionId = result.sessionid;
        // your original constructed hlsURL used vsessionid + /channel/ + channelId
        player.hlsURL = (result.hlsurl ?? '') + (this.vSessionId ? this.vSessionId : '') + '/channel/' + player.channelId;
        player.isplaying = true;
        // Start requesting frames (snapshot based) because encoded stream was being polled in original code
        this.requestFrames(index);
      },
      error: (err:any) => {
        console.error('startEncodedLive error', err);
        if (err?.data?.code === 3037) {
          const vid = this.getVideoElement(index);
          if (vid) vid.setAttribute('poster', '/images/restricted_view_image.jpg');
        }
      }
    });
  }

  stopEncodedLive(index: number) {
    if (index < 0) return;
    const player = this.players[index];
    if (!player.mjpeg_sessionId) return;
    const apiEndpoint = this.getApiEndpointEncodedStop(player.mjpeg_sessionId);

    this.streamSvc.stopEncodedLive(apiEndpoint).subscribe({
      next: () => {
        // stop polling and reset
        if (player.sessionId === 0) player.isplaying = false;
        const vid = this.getVideoElement(index);
        if (vid) vid.setAttribute('poster', '/images/postervtpl_new.jpg');
        this.cancelVideoInfoInterval(index);
      },
      error: (err:any) => {
        console.debug('stopEncodedLive error', err);
      }
    });
  }

  // requestFrames -> get blob from hlsURL (used in original to show MJPEG preview)
  requestFrames(index: number) {
    const player = this.players[index];
    if (!player.hlsURL) return;

    this.streamSvc.requestFrameBlob(player.hlsURL).subscribe({
      next: (blob: Blob) => {
        this.loadSnap(blob, index);
      },
      error: (err:any) => {
        // if server returned JSON error inside blob (your AngularJS readAsText logic)
        const reader = new FileReader();
        reader.onloadend = (e) => {
          try {
            const obj = JSON.parse(String(reader.result));
            if (obj?.code === '3556') {
              // retry
              setTimeout(() => this.requestFrames(index), 2000);
            } else {
              // mark first flag true so next time maybe play HLS
            }
          } catch (e) {
            // ignore
          }
        };
        reader.readAsText(err?.error || err?.message || '');
      }
    });
  }

  loadSnap(blobData: Blob | null, index: number) {
    if (!blobData) {
      setTimeout(() => this.requestFrames(index), 500);
      return;
    }
    const urlObject = (window.URL || (window as any).webkitURL);
    let imageURL: string | null = null;
    if (imageURL) {
      try { urlObject.revokeObjectURL(imageURL); } catch (e) { /* ignore */ }
    }
    imageURL = urlObject.createObjectURL(blobData);
    if (this.players[index].isplaying) {
      const video = this.getVideoElement(index);
      if (video) video.setAttribute('poster', imageURL);
      const ptzVid = document.getElementById('elem_id_ptz');
      if (ptzVid) ptzVid.setAttribute('poster', imageURL);
    }
    // continue polling
    setTimeout(() => this.requestFrames(index), 1000);
  }

  detachedHls(index: number) {
    const player = this.players[index];
    player.hlsURL = '';
    player.error = '';
    player.recoverDecodingErrorDate = null;
    player.recoverSwapAudioCodecDate = null;
    if (player.hlsPlayer) {
      try { player.hlsPlayer.destroy(); } catch (e) {}
      player.hlsPlayer = undefined;
    }
  }

  /* ============================
     PTZ overlay and control
     ============================ */

  hidePTZControl(args?: any) {
    // This mirrors original logic: if we had started encoded MJPEG and saved currentPlayer, reattach HLS, else just hide.
    if (this.serverConfiguration && this.serverConfiguration.streamingMode) {
      if (
        this.serverConfiguration.streamingMode === (this.rootconfig?.VIDEONETICS_STREAMING_MODE ?? 'VIDEONETICS') &&
        this.serverConfiguration.videoneticsStreamType !== 'encoded'
      ) {
        // When args present, reattach previously detached HLS to the player slot
        if (args) {
          // stop encoded for ptz index
          this.stopEncodedLive(this.ptzindex);

          // attach hls from currentPlayer to actual slot
          const video = this.getVideoElement(this.ptzindex);
          const targetPlayer = this.players[this.ptzindex];

          targetPlayer.hlsURL = this.currentPlayer.hlsURL;
          targetPlayer.sessionId = this.currentPlayer.sessionId;
          targetPlayer.recoverDecodingErrorDate = this.currentPlayer.recoverDecodingErrorDate;
          targetPlayer.recoverSwapAudioCodecDate = this.currentPlayer.recoverSwapAudioCodecDate;

          // create new HLS player
          try {
            targetPlayer.hlsPlayer = new Hls(liveHlsJsConfig);
          } catch (err) {
            console.warn('Hls creation failed', err);
            targetPlayer.hlsPlayer = undefined;
          }

          // small delay then load source
          timer(2000).subscribe(() => {
            this.renderer.setStyle(document.getElementById('overlay'), 'display', 'none');
            if (targetPlayer.hlsPlayer && video) {
              targetPlayer.hlsPlayer.loadSource(this.currentPlayer.hlsURL);
              targetPlayer.hlsPlayer.attachMedia(video);
              video.play().catch(() => {});
            } else if (video) {
              video.src = this.currentPlayer.hlsURL;
              video.play().catch(() => {});
            }
            this.currentPlayer = {};
          });

        } else {
          // just stop encoded and remove ptz info
          this.stopEncodedLive(this.ptzindex);
          this.ptzindex = -1;
          this.currentPlayer = {};
          this.ptzplayer = {};
        }
      } else if (this.serverConfiguration.streamingMode === (this.rootconfig?.WEBRTC_STREAMING_MODE ?? 'WEBRTC')) {
        if (this.ptzplayer?.webrtc) {
          try { this.ptzplayer.webrtc.stop(); } catch (e) {}
        }
        this.ptzplayer.webrtc = undefined;
        this.ptzindex = -1;
        this.currentPlayer = {};
        this.ptzplayer = {};
      }
    }

    // always hide overlay
    const overlay = document.getElementById('overlay');
    if (overlay) this.renderer.setStyle(overlay, 'display', 'none');
  }

  ptzControl(command: string) {
    if (!command || this.ptzindex < 0) return;
    // Construct API url similar to your original code:
    const apiUrl = this.getApiEndpointPtz(this.players[this.ptzindex].channelId, command);
    this.streamSvc.ptzControl(apiUrl).subscribe({
      next: (response: any) => {
        this.ptzplayer.error = response?.data?.message ?? response?.message ?? '';
        setTimeout(() => (this.ptzplayer.error = ''), 2000);
      },
      error: (err:any) => {
        if (err?.status !== 401 && err?.error?.code !== 3113) {
          this.players[this.ptzindex].error = err?.error?.message ?? 'PTZ error';
          setTimeout(() => (this.players[this.ptzindex].error = ''), 2000);
        }
      }
    });
  }

  /* ============================
     Video info polling and management
     ============================ */

  getVideoInfo(index: number) {
    const player = this.players[index];
    if (player.channelId > -1 && player && player.streamType !== undefined && player.streamType > -1) {
      const apiUrl = this.getApiEndpointStreamingParameter(player.channelId, player.streamType);
      this.streamSvc.getStreamingParameters(apiUrl).subscribe({
        next: (response: any) => player.streamingParameters = response?.result ?? null,
        error: (err:any) => {
          console.error('Error fetching streaming parameters', err);
          player.streamingParameters = null;
        }
      });
    } else {
      player.streamingParameters = null;
    }
  }

  private manageVideoInfoInterval(index: number,player?: Player, ) {
    if (player?.isplaying) {
      if (!player.videoInfoIntervalSub) {
        player.videoInfoIntervalSub = interval(5000).subscribe(() => this.getVideoInfo(index));
      }
    } else {
      this.cancelVideoInfoInterval(index);
      this.getVideoInfo(index);
    }
  }

  private cancelVideoInfoInterval(index: number) {
    const player = this.players[index];
    if (player.videoInfoIntervalSub) {
      player.videoInfoIntervalSub.unsubscribe();
      player.videoInfoIntervalSub = null;
    }
  }

  private updateCurrentTime() {
    const now = new Date();
    this.currentTime = now.toTimeString().split(' ')[0];
  }

  /* ============================
     Misc: Play / Pause / Screenshot
     ============================ */

  playPause(index: number) {
    const player = this.players[index];
    if (!player) return;

    // if encoded mode, handle accordingly (left as TODO if you have special behavior)
    if (this.serverConfiguration?.isVideoneticsStreamMode && this.serverConfiguration.videoneticsStreamType === 'encoded') {
      // encoded-specific play/pause if required
      return;
    }

    const video = this.getVideoElement(index);
    if (!video) return;
    if (player.isplaying) {
      video.pause();
    } else {
      video.play().catch(e => console.error(e));
    }
    player.isplaying = !player.isplaying;
  }

  screenshot(index: number) {
    const player = this.players[index];
    if (!player) return;

    if (player.channelId > -1 && player.sessionId > 0) {
      const video = this.getVideoElement(index);
      if (!video) return;

      if (this.serverConfiguration?.isVideoneticsStreamMode && this.serverConfiguration.videoneticsStreamType === 'encoded') {
        // encoded snapshot is poster attribute
        const image = video.getAttribute('poster') || '';
        this.downloadDataUrl(image, `Channel_${player.channelName}_${Date.now()}.png`);
      } else {
        const ratio = video.videoWidth / (video.videoHeight || 1);
        let w = Math.max(100, Math.min(video.videoWidth - 100, 1280));
        let h = Math.round(w / ratio);
        if (h > 720) {
          h = 720;
          w = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        this.downloadDataUrl(dataUrl, `Channel_${player.channelName}_${Date.now()}.png`);
      }
    } else {
      // show alert - replace with Angular Material dialog in your app
      alert('First select a camera from camera tree and start archive play!');
    }
  }

  private downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  /* ============================
     Helpers for overlay drag
     ============================ */

  private makeDraggable(el: HTMLElement) {
    // minimalport of dragElement
    if (!el) return;
    const header = document.getElementById(el.id + 'header');
    const handle = header || el;
    let pos3 = 0, pos4 = 0, pos1 = 0, pos2 = 0;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = onClose;
      document.onmousemove = onMouseMove;
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + 'px';
      el.style.left = (el.offsetLeft - pos1) + 'px';
    };

    const onClose = () => {
      document.onmouseup = null;
      document.onmousemove = null;
    };

    handle.onmousedown = onMouseDown;
  }

  /* ============================
     Close player / Clear View
     ============================ */

  closeClicked(selectedIndex: number) {
    const player = this.players[selectedIndex];
    if (!player) return;

    // hide PTZ if open
    const overlay = document.getElementById('overlay');
    if (overlay && this.ptzindex !== -1) {
      this.hidePTZControl();
    }

    if (player.channelId > -1 && (player.sessionId > 0 || (player.mjpeg_sessionId !== undefined && player.mjpeg_sessionId > 0))) {
      this.stopPlaying(selectedIndex);
    }

    // broadcast channel cleared (replace with your event bus if needed)
    // decrement count etc. (you can keep a count property if needed)
    player.channelId = -1;
    player.channelName = ((selectedIndex + 1) <= 9 ? '0' + (selectedIndex + 1) : (selectedIndex + 1).toString());
    player.hlsURL = '';
    player.sessionId = 0;
    player.error = '';
    player.recoverDecodingErrorDate = null;
    player.recoverSwapAudioCodecDate = null;
    player.ptz_control = false;
    player.mjpeg_sessionId = 0;
    player.status = undefined;
    player.isplaying = false;
    player.webrtc = undefined;
    if (player.hlsPlayer) { try { player.hlsPlayer.destroy(); } catch (e) {} player.hlsPlayer = undefined; }

    // update matrix URL if necessary (keep your prev logic)
  }

  stopPlaying(index: number) {
    // similar behavior to original - stop webrtc or stop HLS via server stop endpoint
    const player = this.players[index];
    if (!player) return;

    // If your app uses a streamingMode flag for WebRTC
    if (this.serverConfiguration?.streamingMode === this.rootconfig?.WEBRTC_STREAMING_MODE) {
      if (player.webrtc) {
        try { player.webrtc.stop(); } catch (e) {}
      }
      player.sessionId = 0;
      const vid = this.getVideoElement(index);
      if (vid) vid.setAttribute('poster', '/images/postervtpl_new.jpg');
      return;
    }

    // if encoded/videonetics encoded path:
    if (
      (this.serverConfiguration?.isVideoneticsStreamMode && this.serverConfiguration?.videoneticsStreamType === 'encoded') &&
      (window.location.pathname !== '/live_matrix/4x4' && window.location.pathname !== '/live_matrix/5x5')
    ) {
      // call encoded stop
      this.stopEncodedLive(index);
      return;
    }

    // normal HLS stop: call API stoplive with streamsessionid
    const postData = { streamsessionid: player.sessionId };
    const apiEndpoint = this.getApiEndpointStopLive(); // build like your AngularJS helper
    this.streamSvc.stopLive(apiEndpoint, postData).subscribe({
      next: () => {
        player.sessionId = 0;
        const vid = this.getVideoElement(index);
        if (vid) vid.setAttribute('poster', '/images/postervtpl_new.jpg');
        this.stopHls(index);
      },
      error: (err:any) => {
        if (err?.status !== 401 && err?.error?.code !== 3113) {
          console.error('stopPlaying error', err);
        } else {
          // invalid session
          console.error('Invalid session', err);
        }
      }
    });
  }

  /* ============================
     Presets
     ============================ */

  getPTZPreset(ptzIndex: number) {
    this.allPresets = [];
    if (ptzIndex === -1) return;
    const channelid = this.players[ptzIndex].channelId;
    const apiUrl = this.getApiEndpointGetPreset(channelid);
    this.streamSvc.getPresets(apiUrl).subscribe({
      next: (res: any) => {
        this.allPresets = res?.result ?? [];
      },
      error: (err:any) => {
        if (err?.status === 401) {
          console.error('Invalid session');
        } else {
          this.players[ptzIndex].error = err?.error?.message ?? 'Error getting presets';
          setTimeout(() => (this.players[ptzIndex].error = ''), 2000);
        }
      }
    });
  }

  clickedPreset(ptzPresetModel: string) {
    if (!ptzPresetModel || this.ptzindex === -1) return;
    const postData = {
      channelid: this.players[this.ptzindex].channelId,
      presetname: ptzPresetModel,
      ptzspeed: 5
    };
    const apiUrl = this.getApiEndpointGoToPreset();
    this.streamSvc.goToPreset(apiUrl, postData).subscribe({
      next: (res: any) => {
        this.ptzplayer.error = res?.data?.message ?? res?.message ?? '';
        setTimeout(() => (this.ptzplayer.error = ''), 2000);
      },
      error: (err:any) => {
        this.players[this.ptzindex].error = err?.error?.message ?? 'Goto preset error';
        setTimeout(() => (this.players[this.ptzindex].error = ''), 2000);
      }
    });
  }

  /* ============================
     Keep Alive for sessions
     ============================ */

  liveKeepAlive() {
    // interval to ping keepalive API for sessionid > 0
    this.keepAliveSub = interval(30_000).subscribe(() => {
      this.players.forEach((player, idx) => {
        if (player.channelId > -1 && player.sessionId > 0) {
          const apiUrl = this.getApiEndpointKeepAlive();
          const payload = { streamsessionid: player.sessionId, channelid: player.channelId };
          this.streamSvc.proxyRequest('POST', apiUrl, payload).subscribe({
            next: () => {},
            error: (err:any) => {
              if (err?.status !== 401 && err?.error?.code !== 3113) {
                player.error = err?.error?.message ?? player.error;
                if (err?.error?.code === 3551) {
                  // session expired/closed by server
                  player.channelId = -1;
                  player.channelName = idx < 9 ? '0' + (idx + 1) : '' + (idx + 1);
                  player.hlsURL = '';
                  player.sessionId = 0;
                  player.status = undefined;
                  player.ptz_control = false;
                  player.isplaying = false;
                  if (player.hlsPlayer) { try { player.hlsPlayer.destroy(); } catch (e) {} player.hlsPlayer = undefined; }
                }
              } else {
                console.error('Invalid session');
              }
            }
          });
        }
      });
    });
  }

  /* ============================
     Utility: Node name trimming
     ============================ */

  getNodeName(nodeName: string): string {
    let max = 11;
    const path = window.location.pathname;
    if (path === '/live_matrix/2x2') max = 20;
    else if (path === '/live_matrix/3x3') max = 15;
    else if (path === '/live_matrix/4x4') max = 7;
    else if (path === '/live_matrix/5x5') max = 7;
    nodeName = String(nodeName || '');
    return nodeName.length <= max ? nodeName : nodeName.substr(0, max - 2) + '..';
  }

  /* ============================
     Helpers: API endpoint builders
     Replace these with your $rootScope.getAPIUrl / getAPIEndpoint equivalents
     ============================ */

  private getApiEndpointEncodedStart(channelId: number) {
    // return final string for encodedStartlive + channel/size/audio params
    // Replace with your actual endpoint builder
    return `/V1/REST/${this.rootconfig.serverid}/encoded/startlive/${channelId}/200/100/0`;
  }
  private getApiEndpointEncodedStop(mjpegSessionId: number) {
    return `/V1/REST/${this.rootconfig.serverid}/encoded/stoplive/${mjpegSessionId}`;
  }
  private getApiEndpointPtz(channelId: number, command: string) {
    // original: getAPIEndpoint("ptzcontrol") + players[ptzindex].channelId + "/" + command + "/" + 5
    return `/V1/REST/${this.rootconfig.serverid}/${this.getApiEndpoint('ptzcontrol')}${channelId}/${command}/5`;
  }
  private getApiEndpointGetPreset(channelid: number) {
    return this.getApiEndpoint('getpreset').replace('{0}', this.rootconfig.serverid) + `/${channelid}`;
  }
  private getApiEndpointGoToPreset() {
    return this.getApiEndpoint('gotopreset').replace('{0}', this.rootconfig.serverid);
  }
  private getApiEndpointStreamingParameter(channelId: number, streamType: number) {
    return `${this.getApiEndpoint('getstreamingparameter')}/${channelId}/${streamType}`;
  }
  private getApiEndpointStopLive() {
    return this.getApiEndpoint('stoplive').replace('{0}', this.rootconfig.serverid);
  }
  private getApiEndpointKeepAlive() {
    return this.getApiEndpoint('keepalivelive').replace('{0}', this.rootconfig.serverid);
  }

  // placeholder for constructing endpoints exactly like your old helpers
  private getApiEndpoint(name: string): string {
    // Implement mapping of endpoints (example)
    const endpoints: Record<string, string> = {
      'ptzcontrol': '/api/ptzcontrol/',
      'getpreset': '/api/getpreset/{0}/{1}',
      'gotopreset': '/api/gotopreset/{0}',
      'getstreamingparameter': '/api/getstreamingparameter',
      'stoplive': '/api/stoplive/{0}',
      'keepalivelive': '/api/keepalivelive/{0}',
      'encodedStartlive': '/api/encoded/startlive/',
      'encodedStoplive': '/api/encoded/stoplive/'
    };
    return endpoints[name] || `/${name}`;
  }
   clearAllPlayers(matrixItem?: any): void {
    this.players.forEach((player, index) => {
      const waitingElem = player.waitinggolla_id ? document.getElementById(player.waitinggolla_id):'';
      if (waitingElem) waitingElem.style.display = 'none';

      if (player.channelId > -1 && (player.sessionId > 0 || (player.mjpeg_sessionId ?? 0) > 0)) {
        this.stopPlaying(index);
      }

      player.channelId = -1;
      player.channelName = (index + 1 <= 9 ? '0' + (index + 1) : (index + 1).toString());
      player.hlsURL = '';
      player.sessionId = 0;
      player.error = '';
      player.recoverDecodingErrorDate = null;
      player.recoverSwapAudioCodecDate = null;
      player.ptz_control = false;
      player.mjpeg_sessionId = 0;
      player.status = undefined;
      player.isplaying = false;
      player.webrtc = undefined;

      if (player.hlsPlayer) {
        try { player.hlsPlayer.destroy(); } catch {}
      }
    });

    // if (matrixItem) {
    //   this.router.navigate(['/live_matrix', matrixItem.label]);
    //   this.generateCameraDraggable();
    // }
  }

  // ✅ playMatrixUrl
  playMatrixUrl(): void {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display === 'block' && this.ptzindex !== -1) {
      this.hidePTZControl();
    }

    this.clearAllPlayers();

    const hostBaseUrl = window.location.href.split('#')[0];
    const inputBaseUrl = this.sendMatrix.matrixUrl.split('#')[0];

    if (hostBaseUrl === inputBaseUrl) {
      if (window.location.href !== this.sendMatrix.matrixUrl) {
        window.location.href = this.sendMatrix.matrixUrl;
      } else {
        window.location.reload();
      }
    } else {
      alert('⚠️ Invalid video matrix URL.\nResetting to current URL.');
      this.sendMatrix.matrixUrl = window.location.href;
    }
  }

  // ✅ toggleSpeaker
  toggleSpeaker(index: number): void {
    const player = this.players[index];
    if (player && player.status === 0) {
      const video = document.getElementById(player.elem_id) as HTMLVideoElement;
      if (!video) return;

      if (player.isSpeakerOn) {
        video.volume = 0;
        player.isSpeakerOn = false;
        player.speaker_txt = 'Speaker is off';
      } else {
        video.volume = 1;
        player.isSpeakerOn = true;
        player.speaker_txt = 'Speaker is on';
      }
    } else {
      console.error('No video is currently playing or player is not ready. Speaker cannot be toggled.');
    }
  }

  // ✅ toggleMicrophone
  toggleMicrophone(index: number): void {
    const player = this.players[index];
    if (player && player.status === 0) {
      const video = document.getElementById(player.elem_id) as HTMLVideoElement;
      if (!video) return;

      if (player.isMicrophoneOn) {
        video.volume = 0;
        player.isMicrophoneOn = false;
        player.microphone_txt = 'Microphone is off';
      } else {
        video.volume = 1;
        player.isMicrophoneOn = true;
        player.microphone_txt = 'Microphone is on';
      }
    } else {
      console.error('No video is currently playing or player is not ready. Microphone cannot be toggled.');
    }
  }

  // ✅ toggleFullScreen
  toggleFullScreen(index: number): void {
    const video = document.getElementById(this.players[index].elem_id) as HTMLVideoElement;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if ((video as any).mozRequestFullScreen) {
      (video as any).mozRequestFullScreen();
    } else if ((video as any).webkitRequestFullscreen) {
      (video as any).webkitRequestFullscreen();
    } else if ((video as any).msRequestFullscreen) {
      (video as any).msRequestFullscreen();
    }
  }

  // ✅ screenshotClicked
  screenshotClicked(index: number): void {
    const player = this.players[index];
    if (player.channelId > -1 && player.sessionId > 0) {
      const video = document.getElementById(player.elem_id) as HTMLVideoElement;
      if (!video) return;

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      let image = '';

      if (video.videoWidth && video.videoHeight) {
        const ratio = video.videoWidth / video.videoHeight;
        let w = Math.min(video.videoWidth, 1280);
        let h = Math.min(parseInt((w / ratio).toString(), 10), 720);

        canvas.width = w;
        canvas.height = h;
        context.fillRect(0, 0, w, h);
        context.drawImage(video, 0, 0, w, h);
        image = canvas.toDataURL('image/png');
      } else {
        image = video.poster || '';
      }

      const a = document.createElement('a');
      a.href = image;
      a.download = `Channel_${player.channelName}_${Date.now()}.png`;
      a.click();
    } else {
      alert('⚠️ First select a camera and start playing before taking a snapshot.');
    }
  }

  // ✅ showPTZControl (simplified)
  showPTZControl(index: number): void {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display === 'block') {
      alert('⚠️ First close the previous PTZ Control Panel!');
      return;
    }

    this.ptzindex = index;
    this.ptzplayer = { ...this.players[index] };
    if (overlay) overlay.style.display = 'block';

    // TODO: implement actual PTZ control logic (API calls, WebRTC stream, etc.)
    console.log('PTZ control opened for player', this.ptzindex);
  }

  

  generateCameraDraggable() {
    console.log('Regenerating draggable cameras');
  }


/* -------------------------
   APPENDED: Converted AngularJS controller logic
   (kept original comments exactly as requested)
   ------------------------- */

  // To emulate $rootScope events, we use a simple in-component Subject bus.
  // If your app has a central event bus service, replace this with that.
  private rootEvents = new Map<string, Array<(payload?: any) => void>>();

  // variables used by the original controller logic
  count = 0;
  limit = 25;
  // clickScope equivalent subscription handle (kept as reference)
  private clickScopeUnsub?: () => void;

  // emulate $templateCache if needed (we'll keep the reference for compatibility)
  private templateCache: any = {};

  // emulate $location.path usage via window.location.pathname
  private getLocationPath(): string {
    return window.location.pathname || '';
  }

  // helper to register "root" event listeners (maps to $rootScope.$on)
  private onRootEvent(eventName: string, handler: (payload?: any) => void) {
    if (!this.rootEvents.has(eventName)) this.rootEvents.set(eventName, []);
    this.rootEvents.get(eventName)!.push(handler);
    // return an unsubscribe function (to mimic $scope.$on returning deregister fn)
    return () => {
      const arr = this.rootEvents.get(eventName) || [];
      const idx = arr.indexOf(handler);
      if (idx > -1) arr.splice(idx, 1);
    };
  }

  // helper to emit root events (maps to $rootScope.$emit / $broadcast)
  private emitRootEvent(eventName: string, payload?: any) {
    const arr = this.rootEvents.get(eventName) || [];
    arr.forEach(h => {
      try { h(payload); } catch (e) { console.error('root event handler error', e); }
    });
  }

  // Integrate clickScope logic: look for external events 'channelClicked' and respond.
  // In AngularJS original: var clickScope = $rootScope.$on('channelClicked', function(event, channelToPlay) { ... });
  // We attach a handler using onRootEvent and keep unsub reference.
  private attachChannelClickedListener() {
    // keep the handler exact to preserve logic and comments
    const handler = (channelToPlay: any) => {

      if (this.getLocationPath() == "/live_matrix/2x2") {
        this.limit = 4;
      } else if (this.getLocationPath() == "/live_matrix/3x3") {
        this.limit = 9;
      } else if (this.getLocationPath() == "/live_matrix/4x4") {
        this.limit = 16;
      } else if (this.getLocationPath() == "/live_matrix/5x5") {
        this.limit = 25;
      }

      if (channelToPlay.isjunction) {
        this.model.error = "Please choose a camera.";
        //			$timeout(function() { $scope.model.error = ""; channelToPlay.checked = false; }, 1000);
        return;
      } else {

        if (!channelToPlay.checked) {
          this.channelClicked(channelToPlay);
          return;
        }
        if (this.count >= this.limit) {
          setTimeout(() => {
            channelToPlay.checked = false;
          }, 1000);
        } else {
          this.channelClicked(channelToPlay);
        }
      }
    };

    this.clickScopeUnsub = this.onRootEvent('channelClicked', handler);
  }

  // Call this during init to register root listeners from the old controller
  private attachLegacyListeners() {
    this.attachChannelClickedListener();

    // cameramapDone listener
    this.onRootEvent('cameramapDone', () => {
      //console.log(event, channelToPlay);
      this.playMatrixUrlChannels();
    });

    // clearAllPlayers listener
    this.onRootEvent('clearAllPlayers', () => {
      this.clearAllPlayers();
    });
  }

  // ensure to detach listeners on destroy
  private detachLegacyListeners() {
    if (this.clickScopeUnsub) this.clickScopeUnsub();
    // clear other root events (we can clear map)
    this.rootEvents.clear();
  }

  // Append the original channelClicked logic (converted) — preserved comments and flow
  channelClicked(channelToPlay: any, fromMatrixUrl?: any) {

    if (channelToPlay?.index) {
      // Click Action
      var alreadyPlayingIndex = -1; var availableIndex = -1;

      this.players.forEach((player, innerIndex) => {
        if (player.channelId === channelToPlay.id && player.channelId > -1) {
          alreadyPlayingIndex = innerIndex;
        }
        if (player.channelId === -1 && availableIndex < 0) {
          availableIndex = innerIndex;
        }
      });

      if (alreadyPlayingIndex < 0 && availableIndex > -1) {

        this.players[availableIndex]["channelId"] = channelToPlay.id;
        this.players[availableIndex]["channelName"] = channelToPlay.name;
        if (channelToPlay.configurationType && channelToPlay.configurationType == "1") {
          this.players[availableIndex]["ptz_control"] = true;
        }

        this.players[availableIndex]["status"] = channelToPlay.status;

        this.count++;
        this.startPlaying(availableIndex);

        this.setVideoMatrixUrlChannels(availableIndex, channelToPlay.id.toString());

      } else if (alreadyPlayingIndex > -1) {
        // Already Playing
        // clear 

        this.count--;
        const waitinggollaId = this.players[alreadyPlayingIndex]['waitinggolla_id'];
        const waitingEl = waitinggollaId ? document.getElementById(waitinggollaId) : null;
        if (waitingEl) waitingEl.style.display = 'none';
        this.stopPlaying(alreadyPlayingIndex);
        this.players[alreadyPlayingIndex]["channelId"] = -1;
        this.players[alreadyPlayingIndex]["channelName"] = ((alreadyPlayingIndex + 1) <= 9 ? "0" + (alreadyPlayingIndex + 1) : (alreadyPlayingIndex + 1).toString());
        this.players[alreadyPlayingIndex]["hlsURL"] = "";
        this.players[alreadyPlayingIndex]["sessionId"] = 0;
        this.players[alreadyPlayingIndex]["error"] = "";
        this.players[alreadyPlayingIndex]["recoverDecodingErrorDate"] = null;
        this.players[alreadyPlayingIndex]["recoverSwapAudioCodecDate"] = null;
        this.players[alreadyPlayingIndex]["ptz_control"] = false;
        this.players[alreadyPlayingIndex]["status"] = undefined;
        this.players[alreadyPlayingIndex]["isplaying"] = false;
        this.players[alreadyPlayingIndex]["webrtc"] = undefined;
  
        if ((this.players[alreadyPlayingIndex]["hlsPlayer"])) { try { (this.players[alreadyPlayingIndex]["hlsPlayer"] as any).destroy(); } catch(e) {} }
      }
    } else {
      // Drag Action
      let availableIdx = channelToPlay.index - 1;
      if (availableIdx < 0) { availableIdx = 0; }
      // loop all and find if already playing
      var alreadyPlayingIndex = -1;
      this.players.forEach((player, innerIndex) => {
        if (player.channelId === channelToPlay.channelId) {
          alreadyPlayingIndex = innerIndex;
        }
      });

      if (alreadyPlayingIndex < 0 && this.players[availableIdx]["channelId"] <= -1 && this.players[availableIdx]["sessionId"] <= 0) {
        this.players[availableIdx]["channelId"] = channelToPlay.channelId;
        this.players[availableIdx]["channelName"] = channelToPlay.channelName;
        if ((channelToPlay.configurationType) && channelToPlay.configurationType == "1") {
          this.players[availableIdx]["ptz_control"] = true;
        }

        if ((channelToPlay.status) && channelToPlay.status != "") {
          this.players[availableIdx]["status"] = channelToPlay.status;
        }

        this.emitRootEvent('channelDroppedMakeChecked', channelToPlay);

        this.count++;
        this.startPlaying(availableIdx);

        this.setVideoMatrixUrlChannels(availableIdx, channelToPlay.channelId.toString());
      }
    }
  }

  // setVideoMatrixUrlChannels (preserving logic)
  setVideoMatrixUrlChannels(index: number, channelIdStr: string) {

    if (this.sendMatrix.channels.length == 0) {
      var channelsLength = 0;
      if (this.sendMatrix.matrix == "1x1") {
        channelsLength = 1;
      } else if (this.sendMatrix.matrix == "2x2") {
        channelsLength = 4;
      } else if (this.sendMatrix.matrix == "3x3") {
        channelsLength = 9;
      } else if (this.sendMatrix.matrix == "4x4") {
        channelsLength = 16;
      } else if (this.sendMatrix.matrix == "5x5") {
        channelsLength = 25;
      }
      for (var i = 0; i < channelsLength; i++) {
        this.sendMatrix.channels[i] = "0";
      }
    }
    this.sendMatrix.channels[index] = channelIdStr;
    this.sendMatrix.matrixUrl = window.location.href.split('?')[0] + "?channels=" + this.sendMatrix.channels.join(",");
  }

  // Play matrix channels from sendMatrix (converted)
  playMatrixUrlChannels() {

    setTimeout(() => {
      var invalidChannelIds: string[] = [];
      this.sendMatrix.channels.forEach((loopChannelId: any, loopIndex: number) => {
        //console.log(channel, loopIndex);
        if (!isNaN(String(loopChannelId).trim() as any)) {
          if (parseInt(String(loopChannelId).trim(), 10) > -1 && (this.rootconfig["cameramap"] && this.rootconfig["cameramap"]['junction_channel_' + String(loopChannelId).trim()])) {
            console.debug("valid loopChannelId: ", String(loopChannelId).trim(), ", channel: ", this.rootconfig["cameramap"]['junction_channel_' + String(loopChannelId).trim()]);

            var channel = this.rootconfig["cameramap"]['junction_channel_' + String(loopChannelId).trim()],
              channelToPlay = {
                channelId: channel.id,
                channelName: channel.name,
                configurationType: channel.configurationType,
                index: loopIndex + 1
              };
            this.channelClicked(channelToPlay, true);
          } else if (loopChannelId != '-1') {
            invalidChannelIds.push(loopChannelId);
          }
        } else if (loopChannelId != '-1') {
          invalidChannelIds.push(loopChannelId);
        }
      });
      if (invalidChannelIds.length > 0) {
        // Use simple confirm using window.confirm to emulate $.confirm used in original.
        const msg = 'Following channel(s) are invalid: ' + invalidChannelIds.join(",");
        // display a styled confirm is up to your UI lib; we fallback to alert for now.
        alert('Invalid Channel(s)\n' + msg);
      }

    }, 2 * 1000);
  }

  /* ============================
     startPlaying (append converted logic from AngularJS start)
     NOTE: you already have startEncodedLive / HLS start helpers in this component.
     We'll create a wrapper similar to the original which picks encoded vs HLS vs WebRTC paths
     ============================ */

  startPlaying(index: number) {

    if (this.getLocationPath() != "/live_matrix/4x4" && this.getLocationPath() != "/live_matrix/5x5" && (this.serverConfiguration) &&
      this.serverConfiguration.isVideoneticsStreamMode && this.serverConfiguration.videoneticsStreamType == "encoded") {

      /** Encoded */
      this.startEncodedLive(index);

    } else {
      /*var postData = { "resolutionwidth": 800, "resolutionheight": 700, "withaudio": false };*/

      const elem = document.getElementById(this.players[index]["elem_id"]);
      let width = elem ? (elem as HTMLElement).offsetWidth : 0;
      let height = elem ? (elem as HTMLElement).offsetHeight : 0;

      if (width <= 0) {
        width = 200;
      }

      if (height <= 0) {
        height = 100;
      }

      var postData: any = {
        "channelid": this.players[index]["channelId"],
        "resolutionwidth": width,
        "resolutionheight": height,
        "withaudio": false
      };

      if (this.getLocationPath() == "/live_matrix/1x1") {
        postData.resolutionwidth = 1024;
        postData.resolutionheight = 860;
      }
      this.players[index]["error"] = "Waiting for video ....";
      const waitinggollaId = this.players[index]['waitinggolla_id'];
      const waitingElem = waitinggollaId ? document.getElementById(waitinggollaId) : null;
      if (waitingElem) waitingElem.style.display = 'block';
      if (waitingElem) waitingElem.style.display = 'block';

      // We map your serverConfiguration.streamingMode to a string constant; if set to WEBRTC_STREAMING_MODE
      if (this.serverConfiguration &&
        this.serverConfiguration.streamingMode == (this.rootconfig?.WEBRTC_STREAMING_MODE ?? this.serverConfiguration.streamingMode)) {
        /** WebRTC */
        // Make proxy POST similar to original $http.post to "proxy" with payload holding the actual REST call
        this.proxyRequestPost(this.getApiEndpoint("startwebrtclive"), postData).then((response: any) => {
          this.players[index]["error"] = "";
          if (waitingElem) waitingElem.style.display = 'none';

          this.players[index]["sessionId"] = new Date().getTime();

          if (this.players[index]["channelId"] > -1) {

            var streamingResponse = response?.result?.[0];
            this.players[index]["streamType"] = streamingResponse.streamType;
            var videoElement = this.getVideoElement(index);
            var webrtcURL = "/" + streamingResponse.publicAddress + ":" + streamingResponse.serverPort;
            // var webrtc = new WebRTC(webrtcURL, streamingResponse.serverId, streamingResponse.channelId, -1, 1, streamingResponse.streamType,
            // 	streamingResponse.startTimestamp, videoElement, streamingResponse.stunIp, streamingResponse.stunPort);
            
            var webrtc = new (window as any).VideoneticsRTC(webrtcURL, videoElement);
            

            try {
              this.players[index]["webrtc"] = webrtc;
              this.players[index]["webrtc"].start(streamingResponse.serverId, streamingResponse.channelId,
                streamingResponse.startTimestamp);
              console.log("streamingResponse",streamingResponse, streamingResponse.startTimestamp);
            } catch (error) {

              console.log("WebRTC playing, error: ", error);

              var webrtcURL = "/" + streamingResponse.publicAddress + ":" + streamingResponse.serverPort;
              var webrtc : any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);
              this.players[index]["webrtc"] = webrtc;
              if (this.players[index]["webrtc"].onconnect) this.players[index]["webrtc"].onconnect();
            }
            this.players[index]["isplaying"] = true;

          } else {
            this.count--;
            this.stopPlaying(index);

            this.players[index]["sessionId"] = 0;
          }
        }).catch((response: any) => {
          if (waitingElem) waitingElem.style.display = 'none';

          this.players[index]["webrtc"] = undefined;
          this.players[index]["sessionId"] = 0;
          this.players[index]["mjpeg_sessionId"] = 0;

          if (response && response.data && response.data["code"] == 3037) {
            const ele = document.getElementById(this.players[index]["elem_id"]);
            if (ele) (ele as HTMLVideoElement).setAttribute('poster', "images/restricted_view_image.jpg");
          }

          if (response.status != 401 && response.data["code"] != 3113) {
            if (this.players[index]["channelId"] > -1) {
              this.count--;
              this.players[index]["error"] = response.data.message;
              this.emitRootEvent('channelCleared', this.players[index]["channelId"]);
              this.players[index]["channelId"] = -1;
              this.players[index]["recoverDecodingErrorDate"] = null;
              this.players[index]["recoverSwapAudioCodecDate"] = null;
              this.players[index]["ptz_control"] = false;
              this.players[index]["status"] = undefined;
              this.players[index]["isplaying"] = false;

              setTimeout(() => {
                this.players[index]["error"] = "";

                const vidElem = document.querySelector("#" + this.players[index]["elem_id"]);
                if (vidElem) (vidElem as HTMLVideoElement).setAttribute('poster', 'images/postervtpl_new.jpg');

              }, 5 * 1000);
            }

          } else {
            // emulate invalid session
            console.error('Invalid session');
          }
        });

      } else {

        /** HLS */
        this.proxyRequestPost(this.getApiEndpoint("startlive"), postData).then((response: any) => {
          this.players[index]["error"] = "";
          if (waitingElem) waitingElem.style.display = 'none';
          this.players[index]["streamType"] = response?.result?.[0]?.streamType;

          this.players[index]["sessionId"] = response?.result?.[0]?.sessionid ?? 0;

          if (this.players[index]["channelId"] > -1) {
            this.players[index]["hlsURL"] = response?.result?.[0]?.hlsurl ?? '';
            this.players[index]["isplaying"] = true;

            if ((Hls as any).isSupported && (Hls as any).isSupported()) {

              var video = this.getVideoElement(index);
              this.players[index]["hlsPlayer"] = new (Hls as any)(liveHlsJsConfig);

              setTimeout(() => {
                if (this.players[index]["channelId"] > -1) {
                  // $scope.players[index]["hlsPlayer"].loadSource($scope.players[index]["hlsURL"]);
                  try {
                    (this.players[index]["hlsPlayer"] as any).loadSource(this.players[index]["hlsURL"]);
                    (this.players[index]["hlsPlayer"] as any).attachMedia(video);
                    video?.play().catch(() => {});
                  } catch (e) {
                    console.error('HLS attach/play error', e);
                  }
                }
              }, 2000);

              // onEventsMediaAttached/onEventsMediaDetached/onEventsError etc. can be implemented as needed
            } else {
              this.players[index]["error"] = "HLS video is not supported in your browser!";
            }
          } else {
            this.count--;
            this.stopPlaying(index);

            this.players[index]["sessionId"] = 0;
          }
        }).catch((response: any) => {
          if (waitingElem) waitingElem.style.display = 'none';

          this.players[index]["hlsURL"] = "";
          this.players[index]["sessionId"] = 0;
          this.players[index]["mjpeg_sessionId"] = 0;

          if (response && response.data && response.data["code"] == 3037) {

            const ele = document.getElementById(this.players[index]["elem_id"]);
            if (ele) (ele as HTMLVideoElement).setAttribute('poster', "images/restricted_view_image.jpg");
          }

          if (response.status != 401 && response.data["code"] != 3113) {
            if (this.players[index]["channelId"] > -1) {
              this.count--;
              this.players[index]["error"] = response.data.message;
              this.emitRootEvent('channelCleared', this.players[index]["channelId"]);
              this.players[index]["channelId"] = -1;
              this.players[index]["recoverDecodingErrorDate"] = null;
              this.players[index]["recoverSwapAudioCodecDate"] = null;
              this.players[index]["ptz_control"] = false;
              this.players[index]["status"] = undefined;
              this.players[index]["isplaying"] = false;
              if ((this.players[index]["hlsPlayer"])) { try { (this.players[index]["hlsPlayer"] as any).destroy(); } catch(e) {} }

              setTimeout(() => {
                this.players[index]["error"] = "";

                const vidElem = document.querySelector("#" + this.players[index]["elem_id"]);
                if (vidElem) (vidElem as HTMLVideoElement).setAttribute('poster', 'images/postervtpl_new.jpg');

              }, 5 * 1000);
            }

          } else {
            // invalid session
            console.error('Invalid session');
          }
        });
      }
    }
  }

  // Provide a light options/actionsMenu equivalent (converted)
  options = {
    "actionsMenu": [
      ['Clear View', (selectedIndex: number) => {
        //console.log($itemScope, event, selectedPlayer, text, $li);
        //	            	debugger;
        if (document.getElementById("overlay")?.style.display == "block" && this.ptzindex != -1) {
          this.hidePTZControl();
        }

        if (typeof this.players[selectedIndex] !== 'undefined') {
          var selectedPlayer = this.players[selectedIndex],
            channelId = selectedPlayer["channelId"];
          if (selectedPlayer && selectedPlayer["channelId"] > -1 && (selectedPlayer["sessionId"] > 0 ||
            selectedPlayer && (selectedPlayer["mjpeg_sessionId"] > 0))) {
            this.stopPlaying(selectedIndex);
          }

          this.emitRootEvent('channelCleared', selectedPlayer["channelId"]);
          this.count--;
          selectedPlayer["channelId"] = -1;
          selectedPlayer["channelName"] = ((selectedIndex + 1) <= 9 ? "0" + (selectedIndex + 1) : (selectedIndex + 1)).toString();
          selectedPlayer["hlsURL"] = "";
          selectedPlayer["sessionId"] = 0;
          selectedPlayer["error"] = "";
          selectedPlayer["recoverDecodingErrorDate"] = null;
          selectedPlayer["recoverSwapAudioCodecDate"] = null;
          selectedPlayer["ptz_control"] = false;
          selectedPlayer["mjpeg_sessionId"] = 0;
          selectedPlayer["status"] = undefined;
          selectedPlayer["isplaying"] = false;
          selectedPlayer["webrtc"] = undefined;

          if (selectedPlayer["hlsPlayer"]) { try { (selectedPlayer["hlsPlayer"] as any).destroy(); } catch(e) {} }

          if (this.sendMatrix.channels.indexOf(channelId.toString()) > -1) {
            this.sendMatrix.channels[this.sendMatrix.channels.indexOf(channelId.toString())] = "-1";
            this.sendMatrix.matrixUrl = window.location.href.split('?')[0] + "?channels=" + this.sendMatrix.channels.join(",");
          }
        }
      }],
      ['Clear All View', (_selectedIndex: number) => {
        //console.log($itemScope, event, player, text, $li);
        if (document.getElementById("overlay")?.style.display == "block" && this.ptzindex != -1) {
          this.hidePTZControl();
        }
        this.clearAllPlayers();

        this.sendMatrix.channels.forEach((loopChannel: any, loopIndex: number) => {
          this.sendMatrix.channels[loopIndex] = "0";
        });
        this.sendMatrix.matrixUrl = window.location.href.split('?')[0] + "?channels=" + this.sendMatrix.channels.join(",");

      }]
    ]
  };

  // clearAllPlayers root listener registration done in attachLegacyListeners

  // stopPlaying was already defined above (kept original); nothing to duplicate here.

  /* ============================
     Helper functions used in the appended converted logic
     ============================ */

  // Proxy a POST request to the backend 'proxy' behavior similar to your AngularJS proxy call
  // We return a Promise so we can easily use then/catch in the startPlaying wrapper above.
  private proxyRequestPost(apiNameOrEndpoint: string, payload: any): Promise<any> {
    // In AngularJS original they POST to "proxy" with payload: { method: "POST", url: <api url>, "payload": JSON.stringify(postData) }
    // Here we attempt to call streamSvc.proxyRequest or fallback to HttpClient.
    const url = this.getApiEndpoint(apiNameOrEndpoint) || apiNameOrEndpoint;
    // If streamSvc has a proxyRequest that returns Observable, use it.
    try {
      if (this.streamSvc && (this.streamSvc as any).proxyRequest) {
        return new Promise((resolve, reject) => {
          (this.streamSvc as any).proxyRequest('POST', url, payload).subscribe({
            next: (res: any) => resolve(res),
            error: (err: any) => reject(err)
          });
        });
      }
    } catch (e) {
      // ignore and fallback
    }

    // fallback: direct HttpClient post to the url (assuming a CORS-allowed direct endpoint)
    return this.http.post(url, payload).toPromise();
  }

  /* ============================
     Small AngularJS helpers emulation (to keep code identical)
     ============================ */

  
}