import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  Renderer2,
  ViewChildren,
} from '@angular/core';
import { TreeComponent } from '../tree/tree.component';
import { HeaderComponent } from '../header/header.component';
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
import { FooterComponent } from '../footer/footer.component';
import { environment } from '../../../environments/environment';

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
  showLoader?: boolean;
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
  minAutoBitrate: 0,
};

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [CommonModule, TreeComponent, HeaderComponent, FormsModule, FooterComponent],
  templateUrl: './archive.component.html',
  styleUrl: './archive.component.css',
})
export class ArchiveComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly layout = inject(LayoutService);
  private zone = inject(NgZone);

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
  sendMatrix: { matrix: string; channels: string[]; matrixUrl: string } = {
    matrix: '2x2',
    channels: [],
    matrixUrl: '',
  };
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

  VIDEONETICS_STREAMING_MODE = 1;
  VSTREAMER_STREAMING_MODE = 2;
  WEBRTC_STREAMING_MODE = 3;

  millisPerDay = 24 * 60 * 60 * 1000;
  oneDayMillis = 24 * 60 * 60 * 1000;

  @Output() channelCleared = new EventEmitter<number>();

  constructor(
    private renderer: Renderer2,
    private streamSvc: StreamingService,
    private http: HttpClient,
    private videoneticsRTC: VideoStreamService,
    private cookies: CookieService,
    public layoutService: LayoutService,
  ) {}

  ngOnInit(): void {
    if (this.layoutService.selectedLayout() === '1x1') {
      this.initPlayers(1);
    } else if (this.layoutService.selectedLayout() === '2x2') {
      this.initPlayers(4);
    } else if (this.layoutService.selectedLayout() === '3x3') {
      this.initPlayers(9);
    } else if (this.layoutService.selectedLayout() === '4x4') {
      this.initPlayers(24);
    }
    this.updateCurrentTime();
    const t = interval(1000).subscribe(() => this.updateCurrentTime());
    this.subscriptions.push(t);
    console.log('players', this.players);

    // start keepalive behavior for live sessions (if required)
    // this.liveKeepAlive();
    if (this.serverConfiguration.streamer === this.VIDEONETICS_STREAMING_MODE) {
      console.log('liveKeepAlive()...');
      this.liveKeepAlive();
    }

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
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.keepAliveSub?.unsubscribe();
  }

  getLocalDate(epoch: number): string {
    if (!epoch) return '';
    const date = new Date(epoch);
    return date.toISOString().substring(0, 19); // yyyy-MM-ddTHH:mm:ss
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
        webrtcURL: '',
      });
    }
  }
  onDateChange(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input?.value) {
      this.selectedDate = new Date(input.value).getTime(); // convert to epoch
      this.players.forEach((p) => (p.date = this.selectedDate));
      console.log('Updated epoch:', this.selectedDate, input.value);
      // Update all players
      this.players.forEach((p) => (p.date = this.selectedDate));
      this.closed(this.players);
      // this.channelClicked(this.players);
      this.motionClip(this.players);
      // if (this.players[index]?.channelId) {
      this.startPlaying(index);
      // }
    }
  }

  convertEpochToDateString(epoch: number): string {
    return new Date(epoch).toISOString().split('T')[0];
  }

  toggleDropDown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  /** ------------------------------
   *  generateRecordingBar (converted)
   *  ------------------------------ */
  generateRecordingBar(player: any): void {
    const element = document.querySelector('#' + player['recording-progress']) as HTMLElement;
    if (!element) return;

    const sectionWidth = element.offsetWidth / this.millisPerDay;

    let last = 0;

    // First loop (touch-up timestamps)
    player.barclips.forEach((barclip: any) => {
      if (last !== 0) {
        const diff = Math.abs(last - barclip.startTimestamp);
        if (diff < 200) {
          barclip.startTimestamp = Number(last);
        }
      }
      last = barclip.endTimestamp;
    });

    // Second loop (calculate UI positions)
    player.barclips.forEach((barclip: any, index: number) => {
      if (index === 0) player.startTimestampOnMarker = barclip.startTimestamp;

      barclip.marginleft = Math.floor((barclip.startTimestamp - player.date) * sectionWidth) + 'px';

      const width = Math.floor((barclip.endTimestamp - barclip.startTimestamp) * sectionWidth);
      barclip.width = (width <= 0 ? 1 : width + 1) + 'px';
    });
  }

  /** ------------------------------
   *  adjustBarSections (converted)
   *  ------------------------------ */
  adjustBarSections(): void {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        this.players.forEach((player) => this.generateRecordingBar(player));
      }, 1000);
    });
  }

  /** ------------------------------
   *  closed() (converted)
   *  ------------------------------ */
  closed(player: any): void {
    // Stop players
    if (player) {
      if (player.hlsplayer) player.hlsplayer.destroy();
      if (player.webrtc) {
        player.webrtc.stop();
        player.webrtc = undefined;
      }

      this.stopAllArchivePlaying(player.sessionId);
      this.archivestarted = false;

      setTimeout(() => {
        const videoElement = document.getElementById(player.elem_id) as HTMLVideoElement;
        if (videoElement) videoElement.poster = 'images/postervtpl_new.jpg';
      }, 1000);
    }

    /** Load barclips again */
    if (player.channelId > -1 && player.date) {
      player.error = '';
      player.disable_controls = true;

      const waitEl = document.getElementById(player.waitinggolla_id);
      waitEl?.classList.remove('hidden');

      const url = `${environment.apiBaseUrl}${this.serverConfiguration.serverid}/channel/${player.channelId}${API_ENDPOINTS.ARCHIVE_BARCLIP}${player.date}/${player.date + this.oneDayMillis}`;

      this.http
        .get<any>(url, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
            Authorization: `Bearer ${this.cookies.get('authToken')}`,
          }),
        })
        .subscribe({
          next: (response) => {
            console.log('res', response);
            player.disable_controls = false;
            waitEl?.classList.add('hidden');

            player.barclips = response.result.sort(
              (a: any, b: any) => a.starttimestamp - b.starttimestamp,
            );

            if (player.barclips.length > 0) {
              this.generateRecordingBar(player);
            } else {
              player.error = 'No Recording Found';
              setTimeout(() => (player.error = ''), 2000);
            }
          },
          error: (err) => {
            player.disable_controls = false;
            waitEl?.classList.add('hidden');

            if (err.status !== 401 && err.error?.code !== 3113) {
              player.error = err.error?.message;
            } else {
              location.reload();
            }
          },
        });
    } else {
      player.error = 'Please choose a camera and date from the calendar';
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
      try {
        player.hlsPlayer.destroy();
      } catch (e) {
        /* ignore */
      }
      player.hlsPlayer = undefined;
    }

    // native HLS support (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.load();
      video.play().catch((err) => console.error('video.play error', err));
    } else if (Hls.isSupported()) {
      const hls = new Hls(archiveHlsJsConfig);
      player.hlsPlayer = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => console.error('video.play error', err));
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
      try {
        player.hlsPlayer.destroy();
      } catch (e) {
        /* ignore */
      }
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
    // this.cancelVideoInfoInterval(index);
  }

  private getVideoElement(index: number): HTMLVideoElement | null {
    const arr = this.videoRefs?.toArray() || [];
    const ref = arr[index];
    return ref
      ? ref.nativeElement
      : (document.getElementById(this.players[index].elem_id) as HTMLVideoElement | null);
  }

  // requestFrames -> get blob from hlsURL (used in original to show MJPEG preview)
  requestFrames(index: number) {
    const player = this.players[index];
    if (!player.hlsURL) return;

    this.streamSvc.requestFrameBlob(player.hlsURL).subscribe({
      next: (blob: Blob) => {
        this.loadSnap(blob, index);
      },
      error: (err: any) => {
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
      },
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
    const urlObject = window.URL || (window as any).webkitURL;
    let imageURL: string | null = null;
    if (imageURL) {
      try {
        urlObject.revokeObjectURL(imageURL);
      } catch (e) {
        /* ignore */
      }
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
      try {
        player.hlsPlayer.destroy();
      } catch (e) {}
      player.hlsPlayer = undefined;
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
          console.log(
            `Speed set to backward for player ${index} at multiplier ${this.updateSpeedMultiplier}`,
          );
        } else if (this.isFastForwardClicked) {
          player.webrtc.forwardWebRTC(this.updateSpeedMultiplier);
          console.log(
            `Speed set to forward for player ${index} at multiplier ${this.updateSpeedMultiplier}`,
          );
        } else if (this.isFrameByFrameBackwardClicked) {
          player.webrtc.frameByFrameBackwardWebRTC();
          console.log(`Frame-by-frame backward for player ${index}`);
        } else if (this.isFrameByFrameForwardClicked) {
          player.webrtc.frameByFrameForwardWebRTC();
          console.log(`Frame-by-frame forward for player ${index}`);
        } else {
          player.webrtc.normalWebRTC(this.updateSpeedMultiplier);
          console.log(
            `Speed set to normal for player ${index} at multiplier ${this.updateSpeedMultiplier}`,
          );
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

      if (
        this.serverConfiguration?.isVideoneticsStreamMode &&
        this.serverConfiguration.videoneticsStreamType === 'encoded'
      ) {
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
    let pos3 = 0,
      pos4 = 0,
      pos1 = 0,
      pos2 = 0;

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
      el.style.top = el.offsetTop - pos2 + 'px';
      el.style.left = el.offsetLeft - pos1 + 'px';
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

  closeClicked(selectedIndex: number): void {
    const selectedPlayer = this.players[selectedIndex];
    if (!selectedPlayer) return;

    // --- Stop archive playback if active ---
    if (selectedPlayer.channelId > -1 && selectedPlayer.sessionId > 0) {
      this.stopAllArchivePlaying(selectedPlayer.sessionId);

      // Stop WebRTC session
      if (this.serverConfiguration?.streamer === this.WEBRTC_STREAMING_MODE) {
        if (selectedPlayer.webrtc) {
          selectedPlayer.webrtc.stop();
        }
      }
    }

    // --- Notify other components (replacing $rootScope.$broadcast) ---
    this.channelCleared.emit(selectedPlayer.channelId);

    // --- Reset player properties ---
    this.count--;
    selectedPlayer.channelId = -1;
    selectedPlayer.channelName =
      selectedIndex + 1 <= 9 ? `0${selectedIndex + 1}` : `${selectedIndex + 1}`;

    selectedPlayer.hlsURL = '';
    selectedPlayer.sessionId = 0;
    selectedPlayer.error = '';
    selectedPlayer.recoverDecodingErrorDate = null;
    selectedPlayer.recoverSwapAudioCodecDate = null;
    selectedPlayer.motionclips = [];
    selectedPlayer.barclips = [];
    selectedPlayer.webrtc = undefined;

    // --- Reset poster image (instead of angular.element) ---
    setTimeout(() => {
      const videoElem = document.getElementById(selectedPlayer.elem_id) as HTMLVideoElement;
      if (videoElem) {
        videoElem.poster = 'assets/images/postervtpl_new.jpg';
      }
    }, 1000);

    // --- Destroy HLS player if available ---
    if (selectedPlayer.hlsPlayer) {
      selectedPlayer.hlsPlayer.destroy();
    }
  }

  stopPlaying(index: number) {
    // similar behavior to original - stop webrtc or stop HLS via server stop endpoint
    const player = this.players[index];
    if (!player) return;

    // If your app uses a streamingMode flag for WebRTC
    if (this.serverConfiguration?.streamer === this.WEBRTC_STREAMING_MODE) {
      if (player.webrtc) {
        try {
          player.webrtc.stop();
        } catch (e) {}
      }
      player.sessionId = 0;
      const vid = this.getVideoElement(index);
      if (vid) vid.setAttribute('poster', '/images/postervtpl_new.jpg');
      return;
    }

    // if encoded/videonetics encoded path:
    // if (
    //   this.serverConfiguration?.isVideoneticsStreamMode &&
    //   this.serverConfiguration?.videoneticsStreamType === 'encoded' &&
    //   window.location.pathname !== '/live_matrix/4x4' &&
    //   window.location.pathname !== '/live_matrix/5x5'
    // ) {
    //   // call encoded stop
    //   this.stopEncodedArchive(index);
    //   return;
    // }

    // normal HLS stop: call API stoplive with streamsessionid
    const postData = { streamsessionid: player.sessionId };
    const apiEndpoint = API_ENDPOINTS.HLS_STOP_LIVE.replace(
      '{serverid}',
      this.serverConfiguration.serverid,
    );
    this.http
      .post<any>(apiEndpoint, postData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: () => {
          player.sessionId = 0;
          const vid = this.getVideoElement(index);
          if (vid) vid.setAttribute('poster', '/images/postervtpl_new.jpg');
          this.stopHls(index);
        },
        error: (err: any) => {
          if (err?.status !== 401 && err?.error?.code !== 3113) {
            console.error('stopPlaying error', err);
          } else {
            // invalid session
            console.error('Invalid session', err);
          }
        },
      });
  }

  /* ============================
     Keep Alive for sessions
     ============================ */

  liveKeepAlive() {
    // Ping every 30 seconds
    this.keepAliveSub = interval(30_000).subscribe(() => {
      this.players.forEach((player, idx) => {
        if (player.channelId > -1 && player.sessionId > 0) {
          const apiUrl = API_ENDPOINTS.KEEP_ALIVE_ARCHIVE.replace(
            '{serverid}',
            this.serverConfiguration.serverid,
          );
          const payload = {
            streamsessionid: player.sessionId,
            channelid: player.channelId,
          };

          this.http
            .post<any>(apiUrl, payload, {
              headers: new HttpHeaders({
                'Content-Type': 'application/json',
                Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
                Authorization: `Bearer ${this.cookies.get('authToken')}`,
              }),
            })
            .subscribe({
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
                      try {
                        player.hlsPlayer.destroy();
                      } catch (e) {}
                      player.hlsPlayer = undefined;
                    }
                  }
                } else {
                  console.error('Invalid session');
                }
              },
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
    if (path === '/archive-matrix/2x2') max = 20;
    // else if (path === '/live_matrix/3x3') max = 15;
    // else if (path === '/live_matrix/4x4') max = 7;
    // else if (path === '/live_matrix/5x5') max = 7;
    nodeName = String(nodeName || '');
    return nodeName.length <= max ? nodeName : nodeName.substr(0, max - 2) + '..';
  }

  clearAllPlayers(matrixItem?: any): void {
    this.players.forEach((player, index) => {
      const waitingElem = player.waitinggolla_id
        ? document.getElementById(player.waitinggolla_id)
        : '';
      if (waitingElem) waitingElem.style.display = 'none';

      if (player.channelId > -1 && (player.sessionId > 0 || (player.mjpeg_sessionId ?? 0) > 0)) {
        this.stopAllArchivePlaying(index);
      }

      player.channelId = -1;
      player.channelName = index + 1 <= 9 ? '0' + (index + 1) : (index + 1).toString();
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
        try {
          player.hlsPlayer.destroy();
        } catch {}
      }
    });
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
      console.error(
        'No video is currently playing or player is not ready. Speaker cannot be toggled.',
      );
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
    arr.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error('root event handler error', e);
      }
    });
  }

  // Integrate clickScope logic: look for external events 'channelClicked' and respond.
  // In AngularJS original: var clickScope = $rootScope.$on('channelClicked', function(event, channelToPlay) { ... });
  // We attach a handler using onRootEvent and keep unsub reference.
  private attachChannelClickedListener() {
    // keep the handler exact to preserve logic and comments
    const handler = (channelToPlay: any) => {
      if (this.getLocationPath() == '/archive-matrix/2x2') {
        this.limit = 4;
      }

      if (channelToPlay.isjunction) {
        this.model.error = 'Please choose a camera.';
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
  channelClicked(channelToPlay: any): void {
    // ------------------------------
    // CASE 1: Click Action (no index)
    // ------------------------------
    if (channelToPlay.index === undefined) {
      let alreadyPlayingIndex = -1;
      let availableIndex = -1;

      // Find already-playing & empty player
      this.players.forEach((player, innerIndex) => {
        if (player.channelId === channelToPlay.id && player.channelId > -1) {
          alreadyPlayingIndex = innerIndex;
        }
        if (player.channelId === -1 && availableIndex < 0) {
          availableIndex = innerIndex;
        }
      });

      // ---------------------------------------------------
      // START NEW PLAYBACK (not already playing somewhere)
      // ---------------------------------------------------
      if (alreadyPlayingIndex < 0 && availableIndex > -1) {
        const updatedPlayers = [...this.players];
        const p = { ...updatedPlayers[availableIndex] };

        p.channelId = channelToPlay.id;
        p.channelName = channelToPlay.name;

        if (channelToPlay.configurationType === '1') {
          p.ptz_control = true;
        }

        updatedPlayers[availableIndex] = p;
        this.players = updatedPlayers;

        this.count += 1;

        this.closed(p);
        this.motionClip(p);
        this.startPlaying(availableIndex);
      }

      // ---------------------------------------------------
      // STOP EXISTING PLAYBACK
      // ---------------------------------------------------
      else if (alreadyPlayingIndex > -1) {
        const updatedPlayers = [...this.players];
        const p = { ...updatedPlayers[alreadyPlayingIndex] };

        this.count += 1;

        this.stopAllArchivePlaying(p.sessionId);
        if (this.serverConfiguration.streamer === this.WEBRTC_STREAMING_MODE && p.webrtc) {
          p.webrtc.stop();
        }

        // Reset the player
        p.channelId = -1;
        p.channelName = (alreadyPlayingIndex + 1).toString().padStart(2, '0');
        p.hlsURL = '';
        p.sessionId = 0;
        p.error = '';
        p.motionclips = [];
        p.barclips = [];
        p.webrtc = undefined;

        updatedPlayers[alreadyPlayingIndex] = p;
        this.players = updatedPlayers;

        setTimeout(() => {
          const elem = document.querySelector(`#${p.elem_id}`) as HTMLVideoElement;
          if (elem) elem.poster = 'assets/images/postervtpl_new.jpg';
        }, 1000);

        if (p.hlsPlayer) {
          p.hlsPlayer.destroy();
        }
      }
    }

    // ------------------------------
    // CASE 2: Drag Action (has index)
    // ------------------------------
    else {
      let availableIndex = channelToPlay.index ?? 0;
      if (availableIndex < 0) availableIndex = 0;

      let alreadyPlayingIndex = -1;

      this.players.forEach((player, innerIndex) => {
        if (player.channelId === channelToPlay.id) {
          alreadyPlayingIndex = innerIndex;
        }
      });

      if (alreadyPlayingIndex < 0) {
        const updatedPlayers = [...this.players];
        const p = { ...updatedPlayers[availableIndex] };

        if (p.channelId <= -1 && p.sessionId <= 0) {
          p.channelId = channelToPlay.id;
          p.channelName = channelToPlay.name;

          if (channelToPlay.configurationType === '1') {
            p.ptz_control = true;
          }

          updatedPlayers[availableIndex] = p;
          this.players = updatedPlayers;

          this.channelCleared.emit(channelToPlay);

          this.count += 1;

          this.closed(p);
          this.motionClip(p);
        }
      }
    }
  }

  // setVideoMatrixUrlChannels (preserving logic)
  setVideoMatrixUrlChannels(index: number, channelIdStr: string) {
    if (this.sendMatrix.channels.length == 0) {
      var channelsLength = 0;
      if (this.sendMatrix.matrix == '1x1') {
        channelsLength = 1;
      } else if (this.sendMatrix.matrix == '2x2') {
        channelsLength = 4;
      } else if (this.sendMatrix.matrix == '3x3') {
        channelsLength = 9;
      } else if (this.sendMatrix.matrix == '4x4') {
        channelsLength = 16;
      } else if (this.sendMatrix.matrix == '5x5') {
        channelsLength = 25;
      }
      for (var i = 0; i < channelsLength; i++) {
        this.sendMatrix.channels[i] = '0';
      }
    }
    this.sendMatrix.channels[index] = channelIdStr;
    this.sendMatrix.matrixUrl =
      window.location.href.split('?')[0] + '?channels=' + this.sendMatrix.channels.join(',');
  }

  // Play matrix channels from sendMatrix (converted)
  playMatrixUrlChannels() {
    setTimeout(() => {
      var invalidChannelIds: string[] = [];
      this.sendMatrix.channels.forEach((loopChannelId: any, loopIndex: number) => {
        //console.log(channel, loopIndex);
        if (!isNaN(String(loopChannelId).trim() as any)) {
          if (
            parseInt(String(loopChannelId).trim(), 10) > -1 &&
            this.rootconfig['cameramap'] &&
            this.rootconfig['cameramap']['junction_channel_' + String(loopChannelId).trim()]
          ) {
            console.debug(
              'valid loopChannelId: ',
              String(loopChannelId).trim(),
              ', channel: ',
              this.rootconfig['cameramap']['junction_channel_' + String(loopChannelId).trim()],
            );

            var channel =
                this.rootconfig['cameramap']['junction_channel_' + String(loopChannelId).trim()],
              channelToPlay = {
                channelId: channel.id,
                channelName: channel.name,
                configurationType: channel.configurationType,
                index: loopIndex + 1,
              };
            this.channelClicked(channelToPlay);
          } else if (loopChannelId != '-1') {
            invalidChannelIds.push(loopChannelId);
          }
        } else if (loopChannelId != '-1') {
          invalidChannelIds.push(loopChannelId);
        }
      });
      if (invalidChannelIds.length > 0) {
        // Use simple confirm using window.confirm to emulate $.confirm used in original.
        const msg = 'Following channel(s) are invalid: ' + invalidChannelIds.join(',');
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
    const availableIndex = this.players.findIndex((p) => p.channelId === -1);
    const channelToPlay = {
      id: event.id.toString(),
      name: event.name,
      configurationType: event.configurationType,
      status: event.status,
      index: availableIndex !== -1 ? availableIndex : 0,
    };

    console.log('Clicked Event:', channelToPlay);
    this.channelClicked(channelToPlay);
  }

  OnLoad(event: any) {
    // console.log(event);
    this.serverConfiguration = event;
    console.log('server config', this.serverConfiguration);
  }

  startPlaying(index: number, barsection?: any): void {
    // console.log('barsection', barsection);
    if (!barsection) return;

    const player = this.players[index];
    const channelId = player.channelId;
    const starttimestamp = player.date;
    player.error = 'Waiting for video ....';
    player.disable_controls = true;

    const waitingElement = player.waitinggolla_id
      ? document.getElementById(player.waitinggolla_id)
      : null;

    if (waitingElement) waitingElement.style.display = 'block';

    this.endtimestamp = starttimestamp!;

    // -------------------------------
    // VIDEONETICS STREAMING MODE
    // -------------------------------
    if (
      this.serverConfiguration &&
      this.serverConfiguration.streamer === this.VIDEONETICS_STREAMING_MODE &&
      this.serverConfiguration.videoneticsStreamType === 'encoded'
    ) {
      if (player.sessionId > 0) {
        this.stopAllArchivePlaying(player.sessionId);
        setTimeout(() => {
          (document.getElementById(player.elem_id) as HTMLVideoElement).setAttribute(
            'poster',
            'images/postervtpl_new.jpg',
          );
        }, 1000);
      }

      this.startEncodedPlay(index, barsection);
      return;
    }

    // -------------------------------
    // CLEANUP FOR HLS / WEBRTC MODES
    // -------------------------------
    if ((player.hlsPlayer || player.webrtc) && player.sessionId > 0) {
      this.stopAllArchivePlaying(player.sessionId);

      if (player.hlsPlayer) player.hlsPlayer.destroy();

      if (player.webrtc) {
        player.webrtc.stop();
        player.sessionId = 0;
        player.webrtc = undefined;
      }

      setTimeout(() => {
        (document.getElementById(player.elem_id) as HTMLVideoElement).setAttribute(
          'poster',
          'images/postervtpl_new.jpg',
        );
      }, 1000);
    }

    const postData: any = {
      resolutionwidth: 200,
      resolutionheight: 100,
      withaudio: false,
      starttimestamp: barsection?.starttimestamp,
      channelid: channelId,
    };

    this.endtimestamp = starttimestamp!;

    // -------------------------------------------------
    // WEBRTC STREAMING MODE
    // -------------------------------------------------
    if (
      this.serverConfiguration &&
      this.serverConfiguration.streamer === this.WEBRTC_STREAMING_MODE
    ) {
      const apiUrl = API_ENDPOINTS.WEBRTC_ARCHIVE.replace(
        '{serverid}',
        this.serverConfiguration.serverid,
      );

      const payload = {
        method: 'POST',
        url: apiUrl,
        payload: JSON.stringify(postData),
      };

      this.http
        .post<any>(apiUrl, postData, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
            Authorization: `Bearer ${this.cookies.get('authToken')}`,
          }),
        })
        .subscribe({
          next: (response: any) => {
            console.log('response', response?.result);
            player.error = '';
            if (waitingElement) waitingElement.style.display = 'none';
            player.sessionId = new Date().getTime();

            if (player.channelId > -1) {
              const streamingResponse = response.result[0];
              player.streamType = streamingResponse.streamType;

              const videoElement = document.getElementById(player.elem_id) as HTMLVideoElement;
              let webrtcURL = `/${streamingResponse.privateAddress}:${streamingResponse.serverPort}`;
              var webrtc: any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);

              this.archivestarted = true;
              this.barsection = barsection;
              console.log('barsection', this.barsection);
              this.changeSpeed(1);

              try {
                player.webrtc = webrtc;
                player.webrtc.start(
                  streamingResponse.serverId,
                  channelId,
                  streamingResponse.startTimestamp,
                );
              } catch (error) {
                console.log('WebRTC playing, error:', error);
                webrtcURL = `/${streamingResponse.publicAddress}:${streamingResponse.serverPort}`;
                var webrtc: any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);
                player.webrtc = webrtc;
                player.webrtc.start(
                  streamingResponse.serverId,
                  channelId,
                  streamingResponse.startTimestamp,
                );
              }

              player.webrtcURL = webrtcURL;
              player.isplaying = true;

              this.stop();
              this.counter = 0;
              this.countStart();
            } else {
              this.stopAllArchivePlaying(player.sessionId);

              if (player.webrtc) {
                player.webrtc.stop();
              }

              player.sessionId = 0;
              player.webrtc = undefined;

              setTimeout(() => {
                const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
                if (elem) elem.setAttribute('poster', 'images/postervtpl_new.jpg');
              }, 1000);
            }
          },

          error: (response: any) => {
            console.log('response', response);
            player.disable_controls = false;
            if (waitingElement) waitingElement.style.display = 'none';
            player.webrtc = undefined;
            player.sessionId = 0;

            if (response?.data?.code === 3037) {
              const elem = document.getElementById(player.elem_id);
              if (elem) elem.setAttribute('poster', 'images/restricted_view_image.jpg');
            }

            if (response.status !== 401 && response.data?.code !== 3113) {
              if (player.channelId > -1) {
                player.error = response.data?.message;
              }

              setTimeout(() => {
                this.count--;
                this.channelCleared.emit(player.channelId);

                player.channelId = -1;
                player.channelName = index + 1 <= 9 ? `0${index + 1}` : `${index + 1}`;
                player.error = '';
                player.motionclips = [];
                player.barclips = [];
                player.webrtc = undefined;

                const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
                if (elem) elem.setAttribute('poster', 'images/postervtpl_new.jpg');
              }, 5000);
            } else {
              location.reload();
            }
          },
        });
    }

    // -------------------------------------------------
    // HLS MODE (VSTREAMER)
    // -------------------------------------------------
    if (
      this.serverConfiguration &&
      this.serverConfiguration.streamer === this.VSTREAMER_STREAMING_MODE
    ) {
      const apiUrl = API_ENDPOINTS.HLS_START_ARCHIVE.replace(
        '{serverid}',
        this.serverConfiguration.serverid,
      );
      this.http
        .post<any>(apiUrl, postData, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
            Authorization: `Bearer ${this.cookies.get('authToken')}`,
          }),
        })
        .subscribe({
          next: (response) => {
            player.error = '';
            player.disable_controls = false;
            if (waitingElement) waitingElement.style.display = 'none';

            const result = response.result[0];
            player.streamType = result.streamType;
            player.sessionId = result.sessionid;

            if (player.channelId > -1) {
              player.hlsURL = result.hlsurl;
              player.isplaying = true;

              if ((Hls as any).isSupported && (Hls as any).isSupported()) {
                const video = document.getElementById(player.elem_id) as HTMLVideoElement;

                player.hlsPlayer = new (Hls as any)(archiveHlsJsConfig);

                setTimeout(() => {
                  if (this.players[index].channelId > -1) {
                    try {
                      (this.players[index].hlsPlayer as any).loadSource(this.players[index].hlsURL);
                      (this.players[index].hlsPlayer as any).attachMedia(video);

                      this.attachHlsEvents(player.hlsPlayer!, video);

                      video.play().catch(() => {});
                    } catch (e) {
                      console.error('HLS attach/play error', e);
                    }
                  }
                }, 2000);
              } else {
                player.error = 'HLS video is not supported in your browser!';
              }
            } else {
              this.stopAllArchivePlaying(player.sessionId);
              player.sessionId = 0;

              setTimeout(() => {
                (document.getElementById(player.elem_id) as HTMLVideoElement).setAttribute(
                  'poster',
                  'images/postervtpl_new.jpg',
                );
              }, 1000);
            }
          },
          error: (response: any) => {
            console.log('response', response?.error);
            if (waitingElement) waitingElement.style.display = 'none';

            this.players[index]['hlsURL'] = '';
            this.players[index]['sessionId'] = 0;
            this.players[index]['mjpeg_sessionId'] = 0;

            if (response?.error?.code === 3037) {
              const ele = document.getElementById(this.players[index]['elem_id']);
              if (ele)
                (ele as HTMLVideoElement).setAttribute(
                  'poster',
                  'images/restricted_view_image.jpg',
                );
            }

            if (response.status !== 401 && response?.error?.code !== 3113) {
              if (this.players[index]['channelId'] > -1) {
                this.count--;
                this.players[index]['error'] = response?.error?.message || 'Stream error';
                this.channelCleared.emit(this.players[index]['channelId']);

                this.players[index]['channelId'] = -1;
                this.players[index]['recoverDecodingErrorDate'] = null;
                this.players[index]['recoverSwapAudioCodecDate'] = null;
                this.players[index]['ptz_control'] = false;
                this.players[index]['status'] = undefined;
                this.players[index]['isplaying'] = false;

                if (this.players[index]['hlsPlayer']) {
                  try {
                    (this.players[index]['hlsPlayer'] as any).destroy();
                  } catch (e) {}
                }

                setTimeout(() => {
                  this.players[index]['error'] = '';
                  const vidElem = document.querySelector('#' + this.players[index]['elem_id']);
                  if (vidElem)
                    (vidElem as HTMLVideoElement).setAttribute(
                      'poster',
                      'images/postervtpl_new.jpg',
                    );
                }, 5000);
              }
            } else {
              console.error('Invalid session');
            }
          },
        });
    }
  }

  stopAllArchivePlaying(sessionId: number): void {
    // -----------------------------------------
    // 1. WEBRTC MODE → DO NOTHING (same logic)
    // -----------------------------------------
    if (this.serverConfiguration?.streamer === this.WEBRTC_STREAMING_MODE) {
      return;
    }

    // -----------------------------------------
    // 2. VIDEONETICS ENCODED MODE → CALL STOP ENCODED
    // -----------------------------------------
    if (
      this.serverConfiguration?.streamer === this.VIDEONETICS_STREAMING_MODE &&
      this.serverConfiguration?.videoneticsStreamType === 'encoded'
    ) {
      this.stopEncodedPlay(sessionId);
      return;
    }

    // -----------------------------------------
    // 3. HLS / VSTREAMER MODE → CALL STOPARCHIVE API
    // -----------------------------------------
    const postData = {
      streamsessionid: sessionId,
    };

    const url = API_ENDPOINTS.STOP_ARCHIVE.replace('{serverid}', this.serverConfiguration.serverid);

    this.http
      .post<any>(url, postData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: (response) => {
          // Your AngularJS code had cleanup here but commented out.
          // If needed, you can re-enable:
          //
          // this.players.forEach(player => {
          //   player.hlsURL = "";
          //   player.error = "";
          //   player.sessionId = 0;
          //   if (player.hlsPlayer) { player.hlsPlayer.destroy(); }
          // });
          console.log('response stoplive', response);
        },
        error: (err) => {
          console.log('error', err);
          if (err.status !== 401 && err?.code !== 3113) {
            // ignore (same as AngularJS)
          } else {
            location.reload();
          }
        },
      });
  }

  private attachHlsEvents(playerObj: Hls, video: HTMLVideoElement): void {
    this.streamSvc.onEventsMediaAttached(playerObj, video);
    this.streamSvc.onEventsMediaDetached(playerObj, video);
    this.streamSvc.onEventsError(playerObj, video);
    this.streamSvc.onEventsFragParsingInitSegment(playerObj);
    this.streamSvc.onEventsFragParsingMetadata(playerObj);
    this.streamSvc.onEventsLevelSwitching(playerObj);
    this.streamSvc.onEventsManifestParsed(playerObj);
  }

  startArchive(index: number, barsection?: any): void {
    this.isLoading = false;

    const player = this.players[index];
    const channelId = player.channelId;
    const starttimestamp = player.date;

    const postData: any = {
      resolutionwidth: 200,
      resolutionheight: 100,
      withaudio: false,
      starttimestamp: barsection ? barsection.starttimestamp : starttimestamp,
      channelid: channelId,
    };

    player.error = 'Waiting for video ....';
    player.disable_controls = true;

    const waitingElement = player.waitinggolla_id
      ? document.getElementById(player.waitinggolla_id)
      : null;

    if (waitingElement) waitingElement.style.display = 'block';

    this.endtimestamp = starttimestamp!;

    const apiUrl = API_ENDPOINTS.WEBRTC_ARCHIVE.replace(
      '{serverid}',
      this.serverConfiguration.serverid,
    );

    this.http
      .post(apiUrl, postData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: (response: any) => {
          player.error = '';
          if (waitingElement) waitingElement.style.display = 'none';
          player.sessionId = new Date().getTime();

          if (player.channelId > -1) {
            const streamingResponse = response.result[0];
            player.streamType = streamingResponse.streamType;

            const videoElement = document.getElementById(player.elem_id) as HTMLVideoElement;
            let webrtcURL = `/${streamingResponse.privateAddress}:${streamingResponse.serverPort}`;
            var webrtc: any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);

            this.archivestarted = true;
            this.barsection = barsection;
            this.changeSpeed(1);

            try {
              player.webrtc = webrtc;
              player.webrtc.start(
                streamingResponse.serverId,
                channelId,
                streamingResponse.startTimestamp,
              );
            } catch (error) {
              console.log('WebRTC playing, error:', error);
              webrtcURL = `/${streamingResponse.publicAddress}:${streamingResponse.serverPort}`;
              var webrtc: any = new this.videoneticsRTC.VideoneticsRTC(webrtcURL, videoElement);
              player.webrtc = webrtc;
              player.webrtc.start(
                streamingResponse.serverId,
                channelId,
                streamingResponse.startTimestamp,
              );
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
              if (elem) elem.setAttribute('poster', 'images/postervtpl_new.jpg');
            }, 1000);
          }
        },

        error: (response: any) => {
          player.disable_controls = false;
          if (waitingElement) waitingElement.style.display = 'none';
          player.webrtc = undefined;
          player.sessionId = 0;

          if (response?.data?.code === 3037) {
            const elem = document.getElementById(player.elem_id);
            if (elem) elem.setAttribute('poster', 'images/restricted_view_image.jpg');
          }

          if (response.status !== 401 && response.data?.code !== 3113) {
            if (player.channelId > -1) {
              player.error = response.data?.message;
            }

            setTimeout(() => {
              this.count--;
              // this.channelCleared.emit(player.channelId);

              player.channelId = -1;
              player.channelName = index + 1 <= 9 ? `0${index + 1}` : `${index + 1}`;
              player.error = '';
              player.motionclips = [];
              player.barclips = [];
              player.webrtc = undefined;

              const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
              if (elem) elem.setAttribute('poster', 'images/postervtpl_new.jpg');
            }, 5000);
          } else {
            location.reload();
          }
        },
      });
  }

  motionClip(player: any): void {
    if (player.channelId > -1 && player.date !== undefined) {
      player.error = '';
      player.disable_controls = true;
      player.showLoader = true;

      const start = player.date;
      const end = player.date + 24 * 60 * 60 * 1000;

      const url = `${environment.apiBaseUrl}${this.serverConfiguration.serverid}/channel/${player.channelId}${API_ENDPOINTS.ARCHIVE_MOTIONCLIP}${player.date}/${player.date + this.oneDayMillis}`;

      this.http
        .get<any>(url, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
            Authorization: `Bearer ${this.cookies.get('authToken')}`,
          }),
        })
        .pipe(take(1))
        .subscribe({
          next: (res) => {
            player.disable_controls = false;
            player.showLoader = false;
            player.motionclips = res.result.sort(
              (a: any, b: any) => a.starttimestamp - b.starttimestamp,
            );

            if (player.motionclips.length > 0) {
              this.generateMotionBar(player);
            }
          },
          error: (err) => {
            player.disable_controls = false;
            player.waiting = false;

            if (err.status !== 401 && err?.data?.code !== 3113) {
              if (player.channelId > -1) {
                player.error = err.data?.message || 'Error loading motion clips';
              }
            } else {
              location.reload();
            }
          },
        });
    } else {
      player.error = 'Please choose a camera and date from the calendar';
    }
  }

  /** ---------------------------
   *  GENERATE MOTION BAR
   * ---------------------------*/
  generateMotionBar(player: any): void {
    const el = document.getElementById(player['motion-progress']);
    if (!el) return;

    const millisPerDay = 24 * 60 * 60 * 1000;
    const sectionWidth = el.offsetWidth / millisPerDay;

    player.motionclips.forEach((motionclip: any) => {
      motionclip.marginleft =
        Math.floor((motionclip.endTimestamp - player.date) * sectionWidth) + 'px';
      const width = Math.floor(
        (motionclip.endTimestamp - motionclip.startTimestamp) * 2 * sectionWidth,
      );
      motionclip.width = (width <= 0 ? 1 : width) + 'px';
    });
  }

  /** ---------------------------
   *  RE-GENERATE MOTION BAR ON RESIZE
   * ---------------------------*/
  adjustMotionSections(): void {
    setTimeout(() => {
      this.players.forEach((player) => this.generateMotionBar(player));
    }, 1000);
  }

  /** ---------------------------
   *  START PLAYING MOTION CLIP
   * ---------------------------*/
  startMotionPlaying(index: number, motionclip?: any): void {
    const player = this.players[index];

    // stop existing session
    if (player.hlsPlayer && player.sessionId > 0) {
      this.stopAllArchivePlaying(index);
      player.webrtc?.stop();
      player.webrtcURL = '';

      setTimeout(() => {
        const video = document.getElementById(player.elem_id) as HTMLVideoElement;
        if (video) video.poster = 'images/postervtpl_new.jpg';
      }, 1000);
    }

    const postData = {
      resolutionwidth: 200,
      resolutionheight: 100,
      withaudio: false,
      starttimestamp: motionclip ? motionclip.starttimestamp : player.date,
      channelid: player.channelId,
    };

    player.error = 'Waiting for video...';
    player.disable_controls = true;
    player.showLoader = true;

    const url = API_ENDPOINTS.HLS_START_ARCHIVE.replace(
      '{serverid}',
      this.serverConfiguration.serverid,
    );

    this.http
      .post<any>(url, postData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: (res) => {
          player.error = '';
          player.disable_controls = false;
          player.showLoader = false;

          player.sessionId = res.result[0].sessionid;
          player.hlsURL = res.result[0].hlsurl;

          // if (Hls.isSupported()) {
          //   const video = document.getElementById(player.elem_id) as HTMLVideoElement;
          //   player.hlsPlayer = new Hls();

          //   setTimeout(() => {
          //     player.hlsPlayer.loadSource(player.hlsURL);
          //     player.hlsPlayer.attachMedia(video);
          //     video.play();
          //   }, 5000);

          // } else {
          //   player.error = 'HLS video not supported in your browser!';
          // }

          if (player.channelId > -1) {
            player.hlsURL = res.result[0].hlsurl;
            player.isplaying = true;

            if ((Hls as any).isSupported && (Hls as any).isSupported()) {
              const video = document.getElementById(player.elem_id) as HTMLVideoElement;

              player.hlsPlayer = new (Hls as any)(archiveHlsJsConfig);

              setTimeout(() => {
                if (this.players[index].channelId > -1) {
                  try {
                    (this.players[index].hlsPlayer as any).loadSource(this.players[index].hlsURL);
                    (this.players[index].hlsPlayer as any).attachMedia(video);

                    this.attachHlsEvents(player.hlsPlayer!, video);

                    video.play().catch(() => {});
                  } catch (e) {
                    console.error('HLS attach/play error', e);
                  }
                }
              }, 2000);
            } else {
              player.error = 'HLS video is not supported in your browser!';
            }
          } else {
            this.stopAllArchivePlaying(player.sessionId);
            player.sessionId = 0;

            setTimeout(() => {
              (document.getElementById(player.elem_id) as HTMLVideoElement).setAttribute(
                'poster',
                'images/postervtpl_new.jpg',
              );
            }, 1000);
          }
        },

        error: (err) => {
          player.disable_controls = false;
          player.showLoader = false;
          player.webrtcURL = '';
          player.sessionId = 0;

          if (err.status !== 401 && err.data?.code !== 3113) {
            if (player.channelId > -1) player.error = err.data?.message;

            setTimeout(() => {
              this.channelCleared.emit(this.players[index]['channelId']);

              player.channelId = -1;
              player.channelName = String(index + 1).padStart(2, '0');
              player.error = '';
              player.motionclips = [];
              player.barclips = [];
            }, 5000);
          } else {
            location.reload();
          }
        },
      });
  }

  startEncodedPlay(index: number, barsection?: any): void {
    if (index === -1) return;

    let startTime = this.players[index].date;

    if (barsection) {
      if (barsection.starttimestamp) {
        startTime = barsection.starttimestamp;
      } else if (barsection.startTimestamp) {
        startTime = barsection.startTimestamp;
      }
    }

    const endTime = startTime! + 60 * 60 * 1000;

    const player = this.players[index];
    player.error = 'Waiting for video ....';
    player.disable_controls = true;
    player.showLoader = true; // used in template instead of angular.element

    const apiUrl = API_ENDPOINTS.ENCODED_START_ARCHIVE.replace(
      '{serverid}',
      this.serverConfiguration.serverid,
    );

    this.http
      .post<any>(apiUrl, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: (response) => {
          player.error = '';
          player.disable_controls = false;
          player.showLoader = false;

          const stream = response.data.result[0].streams[0];
          player.sessionId = stream.session_id;
          player.hlsURL = stream.url;
          player.isplaying = true;

          this.requestFrames(index);
        },

        error: (err) => {
          console.error(err?.data?.message || 'Could not connect to server!');

          if (err?.data?.code === 3037) {
            const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
            if (elem) elem.setAttribute('poster', 'images/postervtpl_new.jpg');
          }

          setTimeout(() => {
            const elem = document.querySelector(`#${player.elem_id}`) as HTMLVideoElement;
            if (elem) elem.setAttribute('poster', 'images/postervtpl_new.jpg');
          }, 5000);
        },
      });
  }

  stopEncodedPlay(sessionId: string | number): void {
    if (!sessionId) return;

    const apiUrl = `${API_ENDPOINTS.ENCODED_STOP_ARCHIVE}/${this.serverConfiguration.serverid}/${sessionId}`;

    this.http
      .get<any>(apiUrl, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          // success - do nothing as per old code
        },
        error: (error) => {
          if (error?.error?.message) {
            console.debug(error.error.message);
          } else {
            console.debug('Could not connect to server!');
          }
        },
      });
  }
  // countstart() {
  //   throw new Error('Method not implemented.');
  // }

  // Provide a light options/actionsMenu equivalent (converted)
  options = {
    actionsMenu: [
      [
        'Clear View',
        (selectedIndex: number) => {
          const selectedPlayer = this.players[selectedIndex];
          if (!selectedPlayer) return;

          // Stop archive playback
          if (selectedPlayer.channelId > -1 && selectedPlayer.sessionId > 0) {
            this.stopAllArchivePlaying(selectedPlayer.sessionId);

            // Stop WebRTC
            if (this.serverConfiguration?.streamer === this.WEBRTC_STREAMING_MODE) {
              selectedPlayer.webrtc?.stop();
            }
          }

          // Emit instead of $rootScope.$broadcast
          this.channelCleared.emit(selectedPlayer.channelId);

          // Reset player state
          this.count--;
          selectedPlayer.channelId = -1;
          selectedPlayer.channelName =
            selectedIndex + 1 <= 9 ? `0${selectedIndex + 1}` : `${selectedIndex + 1}`;
          selectedPlayer.hlsURL = '';
          selectedPlayer.sessionId = 0;
          selectedPlayer.error = '';
          selectedPlayer.recoverDecodingErrorDate = null;
          selectedPlayer.recoverSwapAudioCodecDate = null;
          selectedPlayer.motionclips = [];
          selectedPlayer.barclips = [];
          selectedPlayer.webrtc = undefined;

          // Reset poster
          setTimeout(() => {
            const elem = document.getElementById(selectedPlayer.elem_id) as HTMLVideoElement;
            if (elem) elem.poster = 'assets/images/postervtpl_new.jpg';
          }, 1000);

          // Destroy HLS
          if (selectedPlayer.hlsPlayer) {
            selectedPlayer.hlsPlayer.destroy();
          }
        },
      ],

      [
        'Clear All View',
        () => {
          this.clearAllPlayers();
        },
      ],
    ],
  };

  // clearAllPlayers root listener registration done in attachLegacyListeners
}
