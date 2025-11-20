import { AfterViewInit, Component, computed, ElementRef, inject, OnDestroy, OnInit, QueryList, Renderer2, ViewChildren } from '@angular/core';
import { TreeComponent } from "../tree/tree.component";
import { HeaderComponent } from "../header/header.component";
import { LayoutService } from '../live-matrix/layout.service';
import { interval, Subscription, take, timer } from 'rxjs';
import { StreamingService } from '../../store/service/commonService/streaming.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { VideoStreamService } from '../../store/service/video-stream.service';
import { CookieService } from 'ngx-cookie-service';
import Hls from 'hls.js';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FooterComponent } from "../footer/footer.component";

type Player = {
  motionclips: never[];
  barclips: never[];
  webrtcURL: string;
  isMicrophoneOn?: boolean;
  microphone_txt?: string;
  speaker_txt?: string;
  isSpeakerOn?: any;
  elem_id: string;
  disable_controls: boolean;
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
  date?: number;
};

const archiveHlsJsConfig = {
  autoStartLoad: true,
  startPosition: -1,
  capLevelToPlayerSize: false,
  debug: false,
  defaultAudioCodec: undefined,
  initialLiveManifestSize: 1,
  maxBufferLength: 60,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.5,
  maxSeekHole: 2,
  lowBufferWatchdogPeriod: 0.5,
  highBufferWatchdogPeriod: 3,
  nudgeOffset: 0.1,
  nudgeMaxRetry: 3,
  maxFragLookUpTolerance: 0.2,
  liveSyncDurationCount: 3,
  liveMaxLatencyDurationCount: 10,
  enableWorker: true,
  enableSoftwareAES: true,
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 1,
  manifestLoadingRetryDelay: 500,
  manifestLoadingMaxRetryTimeout: 64000,
  startLevel: undefined,
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 4,
  levelLoadingRetryDelay: 1000,
  levelLoadingMaxRetryTimeout: 64000,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 500,
  fragLoadingMaxRetryTimeout: 64000,
  startFragPrefetch: false,
  appendErrorMaxRetry: 3,
  enableWebVTT: true,
  enableCEA708Captions: true,
  stretchShortVideoTrack: false,
  forceKeyFrameOnDiscontinuity: true,
  abrEwmaFastLive: 5.0,
  abrEwmaSlowLive: 9.0,
  abrEwmaFastVoD: 4.0,
  abrEwmaSlowVoD: 15.0,
  abrEwmaDefaultEstimate: 500000,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  minAutoBitrate: 0
};


@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, TreeComponent, HeaderComponent, FormsModule, FooterComponent],
  templateUrl: './archive.component.html',
  styleUrl: './archive.component.css'
})
export class ArchiveComponent implements OnInit, AfterViewInit, OnDestroy  {


  private readonly layout = inject(LayoutService);
  readonly selectedLayout = computed(() => this.layout.selectedLayout());
  @ViewChildren('videoRef') videoRefs!: QueryList<ElementRef<HTMLVideoElement>>;

  players: Player[] = [];
  ptzindex = -1;
  ptzplayer: any = {};
  currentPlayer: any = {};
  allPresets: any[] = [];
  vSessionId = ''; // if you used vsessionid in original
  serverConfiguration: any = {};
  rootconfig: any = {}; // replace or inject as needed
  sendMatrix: { matrix: string; channels: string[]; matrixUrl: string } = { matrix: '2x2', channels: [], matrixUrl: '' };
  currentTime = '';
  private subscriptions: Subscription[] = [];
  private keepAliveSub?: Subscription;
  navigator = window.navigator; // fix: Property 'navigator' does not exist

  matrixItems: any[] = []; // fix: used in *ngFor
  model: any = { error: '' };

   speedDisplay: number = 1;
  updateSpeedMultiplier: number = 1;
  selectedSpeed: number = 1000;

  isFastBackwardClicked: boolean = false;
  isFastForwardClicked: boolean = false;
  isPlayPauseClicked: boolean = false;
  isFrameByFrameBackwardClicked: boolean = false;
  isFrameByFrameForwardClicked: boolean = false;

  counter: number = 0;
  archivestarted: boolean = false;
  endtimestamp: number = 0;

  // Placeholder timers
  countInterval: any;
  progressInterval: any;
  isDropdownOpen: boolean = false;
  selectedDate: number = Date.now();
  selectedDateStr: string = new Date().toISOString().split('T')[0];
  isLoading: boolean = false;
  barsection: any = {}; 

  constructor(
    private renderer: Renderer2,
    private streamSvc: StreamingService,
    private http: HttpClient,
    private videoneticsRTC: VideoStreamService,
    private cookies:CookieService,
    public layoutService: LayoutService,
  ) {} 

  ngOnInit(): void {
    if(this.layoutService.selectedLayout()==='1x1'){
      this.initPlayers(1);
    }else if(this.layoutService.selectedLayout()==='2x2'){
      this.initPlayers(4);

    }
    else if(this.layoutService.selectedLayout()==='3x3'){
      this.initPlayers(9);

    }
    else if(this.layoutService.selectedLayout()==='4x4'){
      this.initPlayers(24);

    }
    this.updateCurrentTime();
    const t = interval(1000).subscribe(() => this.updateCurrentTime());
    this.subscriptions.push(t);
    console.log("players", this.players);
    
    // start keepalive behavior for live sessions (if required)
    // this.liveKeepAlive();
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
        disable_controls: false,
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
        videoInfoIntervalSub: null,
        date: this.selectedDate,
        motionclips: [],
        barclips: [],
        webrtcURL: ''
      });
    }
  }
  onDateChange(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input?.value) {
      this.selectedDate = new Date(input.value).getTime(); // convert to epoch
      this.players.forEach(p => p.date = this.selectedDate);
      console.log("Updated epoch:", this.selectedDate, input.value);
      // Update all players
      this.players.forEach(p => (p.date = this.selectedDate));
      this.startPlaying(index);
    }
  }

  convertEpochToDateString(epoch: number): string {
    return new Date(epoch).toISOString().split('T')[0];
  }

  toggleDropDown(): void {
  this.isDropdownOpen = !this.isDropdownOpen;
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
      const hls = new Hls(archiveHlsJsConfig);
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
    // this.manageVideoInfoInterval(index);
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

  startEncodedArchive(index: number) {
    if (index < 0) return;
    const player = this.players[index];
    // build endpoint like your original: encodedStartlive + channel + '/200/100/0'
    const apiEndpoint = this.getApiEndpointEncodedStart(player.channelId);

    this.streamSvc.startEncodedArchive(apiEndpoint).subscribe({
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
        console.error('startEncodedArchive error', err);
        if (err?.data?.code === 3037) {
          const vid = this.getVideoElement(index);
          if (vid) vid.setAttribute('poster', '/images/restricted_view_image.jpg');
        }
      }
    });
  }

  stopEncodedArchive(index: number) {
    if (index < 0) return;
    const player = this.players[index];
    if (!player.mjpeg_sessionId) return;
    const apiEndpoint = this.getApiEndpointEncodedStop(player.mjpeg_sessionId);

    this.streamSvc.stopEncodedArchive(apiEndpoint).subscribe({
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
  // setLayout(size: number) {
  //     this.gridSize = size;
  //   }

    get gridTemplate() {
      // Example: 2x2 -> "repeat(2, 1fr)"
      return `repeat(${2}, 1fr)`;
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
          this.stopEncodedArchive(this.ptzindex);

          // attach hls from currentPlayer to actual slot
          const video = this.getVideoElement(this.ptzindex);
          const targetPlayer = this.players[this.ptzindex];

          targetPlayer.hlsURL = this.currentPlayer.hlsURL;
          targetPlayer.sessionId = this.currentPlayer.sessionId;
          targetPlayer.recoverDecodingErrorDate = this.currentPlayer.recoverDecodingErrorDate;
          targetPlayer.recoverSwapAudioCodecDate = this.currentPlayer.recoverSwapAudioCodecDate;

          // create new HLS player
          try {
            targetPlayer.hlsPlayer = new Hls(archiveHlsJsConfig);
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
          this.stopEncodedArchive(this.ptzindex);
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
    console.log("channel", player.channelId);
    
    if (player.channelId > -1 && player && player.streamType !== undefined && player.streamType > -1) {
      const apiUrl = API_ENDPOINTS.VIDEO_INFO
      .replace('{serverid}', this.serverConfiguration.serverid)
      .replace('{channelid}', player.channelId.toString())
      .replace('{streamindex}', player.streamType.toString());
      this.http.get<any>(apiUrl, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Cookies': `JSESSIONID=${this.cookies.get('vSessionId')}`,
          'Authorization': `Bearer ${this.cookies.get('authToken')}`
        }),
      }).pipe(take(1)).subscribe({
        next: (response: any) => {
          console.log("response", response);
          player.streamingParameters = response?.result ?? null;
          console.log("streamingParameters", player.streamingParameters);
        },
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

  playPause(index: number): void {
    this.isPlayPauseClicked = !this.isPlayPauseClicked;
    const siteId = this.rootconfig?.siteid;
    const channelId = this.players[index]?.channelId;
    const starttimestamp = Math.abs(this.endtimestamp) + this.counter * 1000;

    this.players[index].isplaying = !this.players[index].isplaying;
    const video = document.getElementById(this.players[index].elem_id) as HTMLVideoElement;

    if (this.players[index].isplaying) {
      this.archivestarted = false;
      this.players[index].webrtc?.resumeWebRTC();
      this.countStart();
      this.archivestarted = true;
      this.stop();
      this.counter = 0;
      this.countStart();
    } else {
      this.players[index].webrtc?.pauseWebRTC();
      this.stopUpdatingProgressBar();
    }

    this.isFastBackwardClicked = false;
    this.isFastForwardClicked = false;
  }

  /** ---------------------------
   *  Change Playback Speed
   * -------------------------- */
  changeSpeed(speed: number): void {
    this.updateSpeedMultiplier = speed;

    if (speed === 0.125) {
      this.selectedSpeed = 8000;
      this.speedDisplay = -8;
    } else if (speed === 0.25) {
      this.selectedSpeed = 4000;
      this.speedDisplay = -4;
    } else if (speed === 0.5) {
      this.selectedSpeed = 2000;
      this.speedDisplay = -2;
    } else if (speed === 1) {
      this.selectedSpeed = 1000;
      this.speedDisplay = 1;
    } else if (speed === 2) {
      this.selectedSpeed = 500;
      this.speedDisplay = 2;
    } else if (speed === 4) {
      this.selectedSpeed = 250;
      this.speedDisplay = 4;
    } else if (speed === 8) {
      this.selectedSpeed = 125;
      this.speedDisplay = 8;
    }

    this.stop();
    this.counter = 0;
    this.countStart();

    this.players.forEach((player, index) => {
      if (player && player.webrtc) {
        if (this.isFastBackwardClicked) {
          player.webrtc.backwardWebRTC(this.updateSpeedMultiplier);
          console.log(`Speed set to backward for player ${index} at multiplier ${this.updateSpeedMultiplier}`);
        } else if (this.isFastForwardClicked) {
          player.webrtc.forwardWebRTC(this.updateSpeedMultiplier);
          console.log(`Speed set to forward for player ${index} at multiplier ${this.updateSpeedMultiplier}`);
        } else if (this.isFrameByFrameBackwardClicked) {
          player.webrtc.frameByFrameBackwardWebRTC();
          console.log(`Frame-by-frame backward for player ${index}`);
        } else if (this.isFrameByFrameForwardClicked) {
          player.webrtc.frameByFrameForwardWebRTC();
          console.log(`Frame-by-frame forward for player ${index}`);
        } else {
          player.webrtc.normalWebRTC(this.updateSpeedMultiplier);
          console.log(`Speed set to normal for player ${index} at multiplier ${this.updateSpeedMultiplier}`);
        }
      }
    });
  }

  /** ---------------------------
   *  Fast Backward
   * -------------------------- */
  fastBackward(index: number): void {
    const player = this.players[index];
    if (this.isFastBackwardClicked) {
      player.webrtc?.normalWebRTC(this.updateSpeedMultiplier);
    } else {
      player.webrtc?.backwardWebRTC(this.updateSpeedMultiplier);
    }

    this.resetPlaybackFlags();
  }

  /** ---------------------------
   *  Fast Forward
   * -------------------------- */
  fastForward(index: number): void {
    const player = this.players[index];
    if (this.isFastForwardClicked) {
      player.webrtc?.normalWebRTC(this.updateSpeedMultiplier);
    } else {
      player.webrtc?.forwardWebRTC(this.updateSpeedMultiplier);
    }

    this.resetPlaybackFlags();
  }

  /** ---------------------------
   *  Frame-by-Frame Backward
   * -------------------------- */
  frameByFrameBackward(index: number): void {
    const player = this.players[index];
    if (this.isFrameByFrameBackwardClicked) {
      player.webrtc?.normalWebRTC(this.updateSpeedMultiplier);
    } else {
      player.webrtc?.frameByFrameBackwardWebRTC();
    }

    this.resetPlaybackFlags();
  }

  /** ---------------------------
   *  Frame-by-Frame Forward
   * -------------------------- */
  frameByFrameForward(index: number): void {
    const player = this.players[index];
    if (this.isFrameByFrameForwardClicked) {
      player.webrtc?.normalWebRTC(this.updateSpeedMultiplier);
    } else {
      player.webrtc?.frameByFrameForwardWebRTC();
    }

    this.resetPlaybackFlags();
  }

  /** ---------------------------
   *  Helper Functions
   * -------------------------- */
  countStart(): void {
    this.countInterval = setInterval(() => {
      this.counter++;
    }, 1000);
  }

  stop(): void {
    clearInterval(this.countInterval);
  }

  stopUpdatingProgressBar(): void {
    clearInterval(this.progressInterval);
  }

  resetPlaybackFlags(): void {
    this.isFastBackwardClicked = false;
    this.isFastForwardClicked = false;
    this.isFrameByFrameBackwardClicked = false;
    this.isFrameByFrameForwardClicked = false;
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
      this.stopEncodedArchive(index);
      return;
    }

    // normal HLS stop: call API stoplive with streamsessionid
    const postData = { streamsessionid: player.sessionId };
    const apiEndpoint = API_ENDPOINTS.HLS_STOP_LIVE.replace('{serverid}', this.serverConfiguration.serverid);
    this.http.post<any>(apiEndpoint, postData, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Cookies': `JSESSIONID=${this.cookies.get('vSessionId')}`,
        'Authorization': `Bearer ${this.cookies.get('authToken')}`
      }),
    }).subscribe({
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

  // liveKeepAlive() {
  //   // interval to ping keepalive API for sessionid > 0
  //   this.keepAliveSub = interval(30_000).subscribe(() => {
  //     this.players.forEach((player, idx) => {
  //       if (player.channelId > -1 && player.sessionId > 0) {
  //         const apiUrl = this.getApiEndpointKeepAlive();
  //         const payload = { streamsessionid: player.sessionId, channelid: player.channelId };
  //         this.streamSvc.proxyRequest('POST', apiUrl, payload).subscribe({
  //           next: () => {},
  //           error: (err:any) => {
  //             if (err?.status !== 401 && err?.error?.code !== 3113) {
  //               player.error = err?.error?.message ?? player.error;
  //               if (err?.error?.code === 3551) {
  //                 // session expired/closed by server
  //                 player.channelId = -1;
  //                 player.channelName = idx < 9 ? '0' + (idx + 1) : '' + (idx + 1);
  //                 player.hlsURL = '';
  //                 player.sessionId = 0;
  //                 player.status = undefined;
  //                 player.ptz_control = false;
  //                 player.isplaying = false;
  //                 if (player.hlsPlayer) { try { player.hlsPlayer.destroy(); } catch (e) {} player.hlsPlayer = undefined; }
  //               }
  //             } else {
  //               console.error('Invalid session');
  //             }
  //           }
  //         });
  //       }
  //     });
  //   });
  // }
  liveKeepAlive() {
    // Ping every 30 seconds
    this.keepAliveSub = interval(30_000).subscribe(() => {
      this.players.forEach((player, idx) => {
        if (player.channelId > -1 && player.sessionId > 0) {
          const apiUrl = API_ENDPOINTS.KEEP_ALIVE_LIVE.replace('{serverid}', this.serverConfiguration.serverid);
          const payload = {
            streamsessionid: player.sessionId,
            channelid: player.channelId
          };

          this.http.post<any>(apiUrl, payload, {
            headers: new HttpHeaders({
              'Content-Type': 'application/json',
              'Cookies': `JSESSIONID=${this.cookies.get('vSessionId')}`,
              'Authorization': `Bearer ${this.cookies.get('authToken')}`
            }),
          }).subscribe({
            next: (res: any) => {
              // API success — you can log or handle response if needed
              console.log(`Keepalive success for channel ${player.channelId}`);
            },
            error: (err: any) => {
              if (err?.status !== 401 && err?.error?.code !== 3113) {
                player.error = err?.error?.message ?? player.error;
                if (err?.error?.code === 3551) {
                  // Session expired/closed by server
                  player.channelId = -1;
                  player.channelName = idx < 9 ? '0' + (idx + 1) : '' + (idx + 1);
                  player.hlsURL = '';
                  player.sessionId = 0;
                  player.status = undefined;
                  player.ptz_control = false;
                  player.isplaying = false;
                  if (player.hlsPlayer) {
                    try { player.hlsPlayer.destroy(); } catch (e) {}
                    player.hlsPlayer = undefined;
                  }
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
    return `/V1/REST/${this.rootconfig.serverid}/encoded/startArchive/${channelId}/200/100/0`;
  }
  private getApiEndpointEncodedStop(mjpegSessionId: number) {
    return `/V1/REST/${this.rootconfig.serverid}/encoded/startArchive/${mjpegSessionId}`;
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

  // placeholder for constructing endpoints exactly like your old helpers
  private getApiEndpoint(name: string): string {
    // Implement mapping of endpoints (example)
    const endpoints: Record<string, string> = {
      'ptzcontrol': '/api/ptzcontrol/',
      'getpreset': '/api/getpreset/{0}/{1}',
      'gotopreset': '/api/gotopreset/{0}',
      'getstreamingparameter': '/api/getstreamingparameter',
      'stoplive': '/api/stoplive/{0}',
      'encodedStartarchive': '/api/encoded/startarchive/',
      'encodedStoparchive': '/api/encoded/stoparchive/'
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
    console.log("channelToPlay",channelToPlay);
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
        console.log("channelToPlay",channelToPlay);
        this.players[availableIndex]["channelId"] = channelToPlay.id;
        this.players[availableIndex]["channelName"] = channelToPlay.name;
        if (channelToPlay.configurationType && channelToPlay.configurationType == "1") {
          this.players[availableIndex]["ptz_control"] = true;
        }
        this.players = [...this.players];
        console.log("Updated Player:", this.players[availableIndex]);

        this.players[availableIndex]["status"] = channelToPlay.status;

        this.count++;
        this.startPlaying(availableIndex);
        // this.liveKeepAlive();

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
      console.log("channelToPlay", channelToPlay);
      // this.getVideoInfo(channelToPlay.id);
      let availableIdx = channelToPlay.index - 1;
      if (availableIdx < 0) { availableIdx = 0; }
      // loop all and find if already playing
      var alreadyPlayingIndex = -1;
      this.players.forEach((player, innerIndex) => {
        if (player.channelId === channelToPlay.id) {
          alreadyPlayingIndex = innerIndex;
        }
        // console.log('innerindex', innerIndex,alreadyPlayingIndex);
      });

      if (alreadyPlayingIndex < 0 && this.players[availableIdx]["channelId"] <= -1 && this.players[availableIdx]["sessionId"] <= 0) {
        this.players[availableIdx]["channelId"] = channelToPlay.id;
        this.players[availableIdx]["channelName"] = channelToPlay.name;
        if ((channelToPlay.configurationType) && channelToPlay.configurationType == "1") {
          this.players[availableIdx]["ptz_control"] = true;
        }

        if ((channelToPlay.status) && channelToPlay.status != "") {
          this.players[availableIdx]["status"] = channelToPlay.status;
        }

        this.emitRootEvent('channelDroppedMakeChecked', channelToPlay);

        this.count++;
        this.startPlaying(availableIdx);
        // this.getVideoInfo(channelToPlay.id);

        this.setVideoMatrixUrlChannels(availableIdx, channelToPlay.id.toString());
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


  OnClick(event: any) {
  const availableIndex = this.players.findIndex(p => p.channelId === -1);
  const channelToPlay = {
    id: event.id.toString(),
    name: event.name,
    configurationType: event.configurationType,
    status: event.status,
    index: availableIndex !== -1 ? availableIndex : 0
  };

  console.log("Clicked Event:", channelToPlay);
  this.channelClicked(channelToPlay);
}

  OnLoad(event: any) {
    // console.log(event);
    this.serverConfiguration = event;
    console.log("server config",this.serverConfiguration);
  }


  // startPlaying(index: number) {

  //   if (this.getLocationPath() != "/archive-matrix/4x4" && this.getLocationPath() != "/archive-matrix/5x5" && (this.serverConfiguration) &&
  //     this.serverConfiguration.isVideoneticsStreamMode && this.serverConfiguration.videoneticsStreamType == "encoded") {

  //     /** Encoded */
  //     this.stopEncodedArchive(index);

  //   } else {
  //     /*var postData = { "resolutionwidth": 800, "resolutionheight": 700, "withaudio": false };*/

  //     const elem = document.getElementById(this.players[index]["elem_id"]);
  //     let width = elem ? (elem as HTMLElement).offsetWidth : 0;
  //     let height = elem ? (elem as HTMLElement).offsetHeight : 0;

  //     if (width <= 0) {
  //       width = 200;
  //     }

  //     if (height <= 0) {
  //       height = 100;
  //     }

  //     var postData: any = {
  //       "channelid": this.players[index]["channelId"],
  //       "starttimestamp": this.selectedDate,
  //       "resolutionwidth": width,
  //       "resolutionheight": height,
  //       "withaudio": false
  //     };
  //     console.log("selecteddate", this.selectedDate);
  //     console.log("postdata", postData)

  //     if (this.getLocationPath() == "/live_matrix/1x1") {
  //       postData.resolutionwidth = 1024;
  //       postData.resolutionheight = 860;
  //     }
  //     this.players[index]["error"] = "Waiting for video ....";
  //     const waitinggollaId = this.players[index]['waitinggolla_id'];
  //     const waitingElem = waitinggollaId ? document.getElementById(waitinggollaId) : null;
  //     if (waitingElem) waitingElem.style.display = 'block';
  //     if (waitingElem) waitingElem.style.display = 'block';
  //     const apiUrl = API_ENDPOINTS.WEBRTC_ARCHIVE.replace('{serverid}', this.serverConfiguration.serverid);
  //     // We map your serverConfiguration.streamingMode to a string constant; if set to WEBRTC_STREAMING_MODE
  //     if (this.serverConfiguration &&
  //       this.serverConfiguration.streamingMode == (this.rootconfig?.WEBRTC_STREAMING_MODE ?? this.serverConfiguration.streamingMode)) {
  //       /** WebRTC */
  //       this.http.post(apiUrl, postData, {
  //         headers: new HttpHeaders({
  //           'Content-Type': 'application/json',
  //           'Cookies': `JSESSIONID=${this.cookies.get('vSessionId')}`,
  //           'Authorization': `Bearer ${this.cookies.get('authToken')}`
  //         }),
  //       })
  //       .subscribe({
  //         next: (response: any) => {
  //           console.log("res", response);
  //           this.players[index]["error"] = "";
  //           if (waitingElem) waitingElem.style.display = 'none';

  //           this.players[index]["sessionId"] = new Date().getTime();

  //           if (this.players[index]["channelId"] > -1) {

  //             var streamingResponse = response?.result?.[0];
  //             this.players[index]["streamType"] = streamingResponse.streamType;
  //             var videoElement = this.getVideoElement(index);
  //             var webrtcURL = "/" + streamingResponse.publicAddress + ":" + streamingResponse.serverPort;
  //             // var webrtc = new WebRTC(webrtcURL, streamingResponse.serverId, streamingResponse.channelId, -1, 1, streamingResponse.streamType,
  //             // 	streamingResponse.startTimestamp, videoElement, streamingResponse.stunIp, streamingResponse.stunPort);
              
  //             var webrtc: any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);
              

  //             try {
  //               this.players[index]["webrtc"] = webrtc;
  //               this.players[index]["webrtc"].start(streamingResponse.serverId, streamingResponse.channelId,
  //                 streamingResponse.startTimestamp);
  //               console.log("streamingResponse",streamingResponse, streamingResponse.startTimestamp);
  //             } catch (error) {

  //               console.log("WebRTC playing, error: ", error);

  //               var webrtcURL = "/" + streamingResponse.publicAddress + ":" + streamingResponse.serverPort;
  //               var webrtc : any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);
  //               this.players[index]["webrtc"] = webrtc;
  //               if (this.players[index]["webrtc"].onconnect) this.players[index]["webrtc"].onconnect();
  //             }
  //             this.players[index]["isplaying"] = true;
  //             // this.manageVideoInfoInterval(index);
  //           } else {
  //             this.count--;
  //             this.stopPlaying(index);

  //             this.players[index]["sessionId"] = 0;
  //           }
  //         },
  //         error: (response: any) => {
  //           console.log("response", response?.error);
  //           if (waitingElem) waitingElem.style.display = 'none';

  //           this.players[index]["hlsURL"] = "";
  //           this.players[index]["sessionId"] = 0;
  //           this.players[index]["mjpeg_sessionId"] = 0;

  //           if (response?.error?.code === 3037) {
  //             const ele = document.getElementById(this.players[index]["elem_id"]);
  //             if (ele) (ele as HTMLVideoElement).setAttribute('poster', "images/restricted_view_image.jpg");
  //           }

  //           if (response.status !== 401 && response?.error?.code !== 3113) {
  //             if (this.players[index]["channelId"] > -1) {
  //               this.count--;
  //               this.players[index]["error"] = response?.error?.message || 'Stream error';
  //               this.emitRootEvent('channelCleared', this.players[index]["channelId"]);

  //               this.players[index]["channelId"] = -1;
  //               this.players[index]["recoverDecodingErrorDate"] = null;
  //               this.players[index]["recoverSwapAudioCodecDate"] = null;
  //               this.players[index]["ptz_control"] = false;
  //               this.players[index]["status"] = undefined;
  //               this.players[index]["isplaying"] = false;

  //               if (this.players[index]["hlsPlayer"]) {
  //                 try { (this.players[index]["hlsPlayer"] as any).destroy(); } catch (e) {}
  //               }

  //               setTimeout(() => {
  //                 this.players[index]["error"] = "";
  //                 const vidElem = document.querySelector("#" + this.players[index]["elem_id"]);
  //                 if (vidElem) (vidElem as HTMLVideoElement).setAttribute('poster', 'images/postervtpl_new.jpg');
  //               }, 5000);
  //             }
  //           } else {
  //             console.error('Invalid session');
  //           }
  //         }
  //       })

  //     } else {
  //       const apiUrl = API_ENDPOINTS.HLS_START_ARCHIVE.replace('{serverid}', this.serverConfiguration.serverid);
  //       /** HLS */
  //       this.http.post<any>(apiUrl, postData, {
  //         headers: new HttpHeaders({
  //           'Content-Type': 'application/json',
  //           'Cookies': `JSESSIONID=${this.cookies.get('vSessionId')}`,
  //           'Authorization': `Bearer ${this.cookies.get('authToken')}`
  //         }),
  //       })
  //       .subscribe({
  //         next: (response: any) => {
  //           console.log("response", response?.result);

  //           this.players[index]["error"] = "";
  //           if (waitingElem) waitingElem.style.display = 'none';
  //           this.players[index]["streamType"] = response?.result?.[0]?.streamType;
  //           this.players[index]["sessionId"] = response?.result?.[0]?.sessionid ?? 0;

  //           if (this.players[index]["channelId"] > -1) {
  //             this.players[index]["hlsURL"] = response?.result?.[0]?.hlsurl ?? '';
  //             this.players[index]["isplaying"] = true;

  //             if ((Hls as any).isSupported && (Hls as any).isSupported()) {
  //               const video = this.getVideoElement(index);
  //               this.players[index]["hlsPlayer"] = new (Hls as any)(liveHlsJsConfig);

  //               setTimeout(() => {
  //                 if (this.players[index]["channelId"] > -1) {
  //                   try {
  //                     (this.players[index]["hlsPlayer"] as any).loadSource(this.players[index]["hlsURL"]);
  //                     (this.players[index]["hlsPlayer"] as any).attachMedia(video);
  //                     video?.play().catch(() => {});
  //                   } catch (e) {
  //                     console.error('HLS attach/play error', e);
  //                   }
  //                 }
  //               }, 2000);
  //             } else {
  //               this.players[index]["error"] = "HLS video is not supported in your browser!";
  //             }
  //             // this.manageVideoInfoInterval(index);
  //           } else {
  //             this.count--;
  //             this.stopPlaying(index);
  //             this.players[index]["sessionId"] = 0;
  //           }
  //         },

  //         error: (response: any) => {
  //           console.log("response", response?.error);
  //           if (waitingElem) waitingElem.style.display = 'none';

  //           this.players[index]["hlsURL"] = "";
  //           this.players[index]["sessionId"] = 0;
  //           this.players[index]["mjpeg_sessionId"] = 0;

  //           if (response?.error?.code === 3037) {
  //             const ele = document.getElementById(this.players[index]["elem_id"]);
  //             if (ele) (ele as HTMLVideoElement).setAttribute('poster', "images/restricted_view_image.jpg");
  //           }

  //           if (response.status !== 401 && response?.error?.code !== 3113) {
  //             if (this.players[index]["channelId"] > -1) {
  //               this.count--;
  //               this.players[index]["error"] = response?.error?.message || 'Stream error';
  //               this.emitRootEvent('channelCleared', this.players[index]["channelId"]);

  //               this.players[index]["channelId"] = -1;
  //               this.players[index]["recoverDecodingErrorDate"] = null;
  //               this.players[index]["recoverSwapAudioCodecDate"] = null;
  //               this.players[index]["ptz_control"] = false;
  //               this.players[index]["status"] = undefined;
  //               this.players[index]["isplaying"] = false;

  //               if (this.players[index]["hlsPlayer"]) {
  //                 try { (this.players[index]["hlsPlayer"] as any).destroy(); } catch (e) {}
  //               }

  //               setTimeout(() => {
  //                 this.players[index]["error"] = "";
  //                 const vidElem = document.querySelector("#" + this.players[index]["elem_id"]);
  //                 if (vidElem) (vidElem as HTMLVideoElement).setAttribute('poster', 'images/postervtpl_new.jpg');
  //               }, 5000);
  //             }
  //           } else {
  //             console.error('Invalid session');
  //           }
  //         }
  //       });
  //     }
  //   }
  // }
  
  startPlaying(index: number, barsection?: any): void {
  this.isLoading = false;

  const player = this.players[index];
  const channelId = player.channelId;
  const starttimestamp = player.date;

  const postData: any = {
    resolutionwidth: 200,
    resolutionheight: 100,
    withaudio: false,
    starttimestamp: barsection ? barsection.starttimestamp : starttimestamp,
    channelid: channelId
  };

  player.error = "Waiting for video ....";
  player.disable_controls = true;

  const waitingElement = player.waitinggolla_id
  ? document.getElementById(player.waitinggolla_id)
  : null;

  if (waitingElement) waitingElement.style.display = "block";

  this.endtimestamp = starttimestamp!;

  const apiUrl = API_ENDPOINTS.WEBRTC_ARCHIVE.replace('{serverid}', this.serverConfiguration.serverid);

  const payload = {
    method: "POST",
    url: apiUrl,
    payload: JSON.stringify(postData)
  };

  this.http.post(apiUrl, postData, 
    { headers:  new HttpHeaders({
        'Content-Type': 'application/json',
        'Cookies': `JSESSIONID=${this.cookies.get('vSessionId')}`,
        'Authorization': `Bearer ${this.cookies.get('authToken')}`
      }),
    })
    .subscribe({
      next: (response: any) => {
        player.error = "";
        if (waitingElement) waitingElement.style.display = "none";
        player.sessionId = new Date().getTime();

        if (player.channelId > -1) {
          const streamingResponse = response.result[0];
          player.streamType = streamingResponse.streamType;

          const videoElement = document.getElementById(player.elem_id) as HTMLVideoElement;
          let webrtcURL = `/${streamingResponse.privateAddress}:${streamingResponse.serverPort}`;
          var webrtc : any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);

          this.archivestarted = true;
          this.barsection = barsection;
          this.changeSpeed(1);

          try {
            player.webrtc = webrtc;
            player.webrtc.start(streamingResponse.serverId, channelId, streamingResponse.startTimestamp);
          } catch (error) {
            console.log("WebRTC playing, error:", error);
            webrtcURL = `/${streamingResponse.publicAddress}:${streamingResponse.serverPort}`;
            var webrtc : any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);
            player.webrtc = webrtc;
            player.webrtc.start(streamingResponse.serverId, channelId, streamingResponse.startTimestamp);
          }

          player.webrtcURL = webrtcURL;
          player.isplaying = true;

          this.stop();
          this.counter = 0;
          this.countStart();

        } else {
          // this.stopAllArchivePlaying(player.sessionId);

          if (player.webrtc) {
            player.webrtc.stop();
          }

          player.sessionId = 0;
          player.webrtc = undefined;

          setTimeout(() => {
            const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
            if (elem) elem.setAttribute("poster", "images/postervtpl_new.jpg");
          }, 1000);
        }
      },

      error: (response: any) => {
        player.disable_controls = false;
        if (waitingElement) waitingElement.style.display = "none";
        player.webrtc = undefined;
        player.sessionId = 0;

        if (response?.data?.code === 3037) {
          const elem = document.getElementById(player.elem_id);
          if (elem) elem.setAttribute("poster", "images/restricted_view_image.jpg");
        }

        if (response.status !== 401 && response.data?.code !== 3113) {
          if (player.channelId > -1) {
            player.error = response.data?.message;
          }

          setTimeout(() => {
            this.count--;
            // this.channelCleared.emit(player.channelId);

            player.channelId = -1;
            player.channelName = (index + 1 <= 9 ? `0${index + 1}` : `${index + 1}`);
            player.error = "";
            player.motionclips = [];
            player.barclips = [];
            player.webrtc = undefined;

            const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
            if (elem) elem.setAttribute("poster", "images/postervtpl_new.jpg");
          }, 5000);
        } else {
          location.reload();
        }
      }
    });
}
  // countstart() {
  //   throw new Error('Method not implemented.');
  // }


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

  
}
