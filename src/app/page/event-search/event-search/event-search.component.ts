import { Component, OnInit, AfterViewInit, NgZone, Renderer2, HostListener } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../header/header.component';
import { TreeComponent } from '../../tree/tree.component';
import { API_ENDPOINTS } from '../../../config/api-endpoints';
import { CookieService } from 'ngx-cookie-service';
import { take } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FooterComponent } from '../../footer/footer.component';

@Component({
  selector: 'app-event-search',
  imports: [CommonModule, FormsModule, HeaderComponent, TreeComponent, FooterComponent],
  standalone: true,
  templateUrl: './event-search.component.html',
  styleUrls: ['./event-search.component.css'],
})
export class EventSearchComponent implements OnInit, AfterViewInit {
  // ---- properties converted from $scope ----
  fullWidth: number = window.innerWidth / 5;

  model: any = {
    error: '',
    dateform: { date: new Date(), open: false },
    dateto: { date: new Date(), open: false },
    selectedtype: '',
    offset: 0,
    total: 0,
    limit: 10,
    selectedchannelid: '',
    selectedrtamc: undefined,
    selectedrecordingserver: undefined,
    searchresult: [],
  };

  rootconfig: any = {};

  //$scope.isNTAMC;
  isNTAMC: any;

  ptzindex: number = -1;
  currentPlayer: any = {};
  ptzplayer: any = {};

  channelList: any[] = [];
  lastEventId: any = null;
  options: any = {
    tableconfig: { itemsPerPage: 5, fillLastPage: false },
  };
  page: number = 1;
  postData: any = null;
  filteredCameraList: any[] = [];

  event_clip_url: any;
  videoPlayer: HTMLVideoElement | undefined = undefined;
  currentTime: string = '0:00';
  duration: string = '0:00';
  progress: number = 0;
  private durInitial: number | undefined;
  private firstTimeLoadingClip: boolean = false;

  selectedEvent: any = {};

  selectedRTAMC: any = null;
  selectedRecServer: any = null;

  fullChannelList: any[] = [];
  uniqueRTAMCList: any[] = [];
  uniqueRecServerList: any[] = [];

  users: any[] = [];
  selectedUsers: any[] = [];
  analyticsList: any[] = [];

  constructor(
    private http: HttpClient,
    private cookies: CookieService,
    private ngZone: NgZone,
    private renderer: Renderer2,
  ) {}

  // ---- lifecycle ----
  ngOnInit(): void {
    // initialize dates to start and end of day
    let now = new Date();
    now.setHours(0, 0, 0);
    this.model.dateform.date = now;

    now = new Date();
    now.setHours(23, 59, 59);
    this.model.dateto.date = now;

    // initial adjustments
    this.adjustVideoView(1);

    // delayed startup to mirror original $timeout(..., 3000)
    setTimeout(() => {
      this.getChannels();
      this.refreshResultSetCount();
      this.initPlayer();
    }, 3000);

    // get users
    this.getAllUsers();
  }

  ngAfterViewInit(): void {
    // nothing else required here; the template should bind video element id 'event_video_player'
  }

  // ---- window resize handling (replacement for $(window).resize) ----
  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    // emulate waitForFinalEvent with a small debounce
    clearTimeout((this as any)._resizeTimeout);
    (this as any)._resizeTimeout = setTimeout(() => {
      this.adjustVideoView();
    }, 500);
  }

  // ---- helper functions ----
  getViewPortHeight(): number {
    return Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  }

  adjustVideoView(timeoutSec?: number) {
    const apply = () => {
      const height = this.getViewPortHeight();
      if (height > 500) {
        (this as any).fullHeight = height - 210;
      }

      const eventList = document.getElementById('event_list');
      if (eventList) {
        this.fullWidth = window.innerWidth - 288 - eventList.offsetWidth - 290;
      } else {
        this.fullWidth = window.innerWidth / 5;
      }
    };

    if (timeoutSec) {
      setTimeout(() => apply(), timeoutSec * 1000);
    } else {
      apply();
    }
  }

  decrease() {
    if (this.model.offset - this.model.limit <= 0) {
      this.model.offset = 0;
    } else {
      this.model.offset = this.model.offset - this.model.limit;
    }
    this.page = this.page - 1;
    this.refreshResultSet();
  }

  increase() {
    this.model.offset = this.model.offset + this.model.limit;
    this.page = this.page + 1;
    this.refreshResultSet();
  }

  refreshResultSetCount() {
    this.page = 1;
    this.model.total = 0;
    this.model.searchresult = [];
    this.selectedEvent = {};

    this.reset();

    this.loadEventsCount();
    // $rootScope.updateNTAMC($scope.isNTAMC);
  }

  loadEventsCount() {
    this.model.offset = 0;
    this.model.total = 0;

    this.postData = {
      starttimestamp: new Date(this.model.dateform.date).getTime(),
      endtimestamp: new Date(this.model.dateto.date).getTime(),
      lpnumber: null,
      limit: this.model.limit,
    };

    if (this.model.selectedtype) {
      this.postData['applicationid'] = this.model.selectedtype;
    } else {
      this.postData['applicationid'] = null;
    }

    if (this.model.selectedchannelid) {
      this.postData['channelid'] = this.model.selectedchannelid;
      console.log('channelId', this.model.selectedchannelid);
    } else {
      this.postData['channelid'] = null;
    }
    const apiurl = API_ENDPOINTS.EVENT_COUNT.replace('{serverid}', this.rootconfig.serverid);
    const payload = JSON.stringify(this.postData);

    // Mirror the original $http POST to "proxy"
    this.http
      .post<any>(apiurl, this.postData, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: (response) => {
          try {
            this.model.error = '';
            this.model.offset = 0;
            this.model.total = response.result[0]['totalrecords'];

            if (this.model.total > 0) {
              this.refreshResultSet();
            }
          } catch (e) {
            // preserve original behavior: set error
            this.model.error = 'Unexpected response format';
          }
        },
        error: (err) => {
          this.model.error = err?.error?.message || err?.message || 'Error fetching events';
          if (err) {
            setTimeout(() => {
              if (err.status === 401) {
                (window as any).$rootScope?.showInvalidSession?.();
              }
            }, 2000);
          }
        },
      });
  }

  refreshResultSet() {
    if (!this.postData) {
      this.postData = {};
    }
    this.postData['page'] = this.page;
    const apiurl = API_ENDPOINTS.EVENT_SEARCH.replace('{serverid}', this.rootconfig.serverid);
    const payload = JSON.stringify(this.postData);

    this.http
      .post<any>(apiurl, payload, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: (response) => {
          // console.log("r",response);
          try {
            this.model.error = '';
            this.model.searchresult = response.result[0]['eventlist'];
          } catch (e) {
            this.model.error = 'Unexpected response format';
          }
        },
        error: (err) => {
          this.model.error = err?.error?.message || err?.message || 'Error fetching events';
          if (err) {
            setTimeout(() => {
              if (err.status === 401) {
                (window as any).$rootScope?.showInvalidSession?.();
              }
            }, 2000);
          }
        },
      });
  }

  OnLoad(event: any) {
    // console.log("",event);
    this.rootconfig = event;
    console.log('HIIIII', this.rootconfig);
  }

  OnAnayticsLoad(event: any) {
    // console.log("",event);
    const eventList = Array.isArray(event) ? event : Object.values(event);
    this.analyticsList = eventList;
    this.analyticsList.map((e: any) => e.alertname);

    // Initialize selectedEvent if null
    if (!this.selectedEvent) {
      this.selectedEvent = {};
    }

    // Store the array
    // this.selectedEvent.alertname = alertNames;

    // console.log("All selected alert names:", this.selectedEvent.alertname);
  }

  // ---- channel / camera handling ----
  getChannels() {
    const url = API_ENDPOINTS.CHANNEL_INFO.replace('{serverid}', this.rootconfig.serverid);

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
        next: (response) => {
          this.channelList = [];
          const rawData = response?.result;
          // console.log('Raw Data:', rawData);

          if (rawData && rawData.length > 0) {
            this.channelList = rawData;
            this.channelList.map((ch: any) => ch.channelname);
            if (!this.selectedEvent) {
              this.selectedEvent = {};
            }
            // this.selectedEvent.channelname = channelNames;
            // console.log('All Channel Names:', this.selectedEvent.channelname);
          } else {
            this.channelList = [];
          }
        },
        error: (err) => {
          this.channelList = [];
          if (err.status === 401) {
            (window as any).$rootScope?.showInvalidSession?.();
          } else {
            this.model.camerror = err?.error?.message || err?.message || 'Error fetching channels';
            setTimeout(() => (this.model.camerror = ''), 3000);
          }
        },
      });
  }

  updateRecServerDropdown() {
    const filteredServers = this.fullChannelList
      .filter(
        (channel) => !this.model.selectedrtamc || channel.rtamcid === this.model.selectedrtamc,
      )
      .map((channel) => ({
        recordingserverid: channel.recordingserverid,
        recordingservername: channel.recordingservername,
      }));

    const uniqueServersMap = new Map();
    filteredServers.forEach((server) => uniqueServersMap.set(server.recordingserverid, server));

    this.uniqueRecServerList = Array.from(uniqueServersMap.values());

    this.model.selectedrecordingserver = null;
    this.filterChannels();
  }

  filterChannels() {
    this.channelList = this.fullChannelList.filter(
      (channel) =>
        (!this.model.selectedrtamc || channel.rtamcid === this.model.selectedrtamc) &&
        (!this.model.selectedrecordingserver ||
          channel.recordingserverid === this.model.selectedrecordingserver),
    );

    console.log('Filtered channelList:', this.fullChannelList);
  }

  onRTAMCChange() {
    this.model.selectedrecordingserver = null;
    this.updateRecServerDropdown();
    this.filterChannels();
  }

  onRecServerChange() {
    this.filterChannels();
  }

  eventClicked(event: any) {
    this.reset();

    event['isViewed'] = true;
    this.selectedEvent = event;

    if (this.videoPlayer) {
      if (typeof event.snapurl !== 'undefined') {
        console.log('eventsnap', event.snapurl);
        const snap = `${environment.apiurl}${event.snapurl}`;
        const videoSnap = this.videoPlayer.setAttribute('poster', snap);
        console.log('snap', snap, videoSnap);
      }

      this.event_clip_url = this.selectedEvent.clipurl;
      // this.event_clip_url = '/evidence/ivms/clip/12883.mp4';
    }
  }

  play() {
    if (typeof this.selectedEvent === 'undefined' || this.selectedEvent == null) return;

    const waiting = document.getElementById('event_video_player_waitinggolla_id');
    if (!this.firstTimeLoadingClip && waiting) {
      waiting.style.display = 'block';
    }
    const cleanPath = this.event_clip_url.replace(/^\/V1/i, '');
    const url = `${environment.apiUrl}${cleanPath}`;
    console.log('clipurl', this.event_clip_url, url);

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
      Authorization: `Bearer ${this.cookies.get('authToken')}`,
    });

    this.http
      .get<any>(url, { headers })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          console.log('response', response);
          this.firstTimeLoadingClip = true;
          this.model.error = '';
          if (waiting) waiting.style.display = 'none';

          if (this.videoPlayer) {
            this.videoPlayer.setAttribute('src', this.event_clip_url);
            console.log(this.videoPlayer.setAttribute('src', this.event_clip_url));
            const playBtn = document.getElementById('play_btn_id') as HTMLImageElement | null;
            if (playBtn) playBtn.src = 'images/Pause_16x16.png';
            this.videoPlayer.play();
          }
        },
        error: (err) => {
          if (waiting) waiting.style.display = 'none';

          if (err.status === 401) {
            (window as any).$rootScope?.showInvalidSession?.();
          } else {
            this.model.error = err?.error?.message || err?.message || 'Error loading clip';
            setTimeout(() => (this.model.error = ''), 3000);
          }
        },
        complete: () => {
          // Handle play/pause toggle only after first load
          if (this.firstTimeLoadingClip && this.videoPlayer) {
            const playBtn = document.getElementById('play_btn_id') as HTMLImageElement | null;
            if (this.videoPlayer.paused) {
              if (playBtn) playBtn.src = 'images/Pause_16x16.png';
              this.videoPlayer.play();
            } else {
              if (playBtn) playBtn.src = 'images/Play.png';
              this.videoPlayer.pause();
            }
          }
        },
      });
  }

  fullScreen() {
    if (!this.videoPlayer) {
      return;
    }
    const vp = this.videoPlayer as any;
    if (vp.requestFullscreen) {
      vp.requestFullscreen();
    } else if (vp.mozRequestFullScreen) {
      vp.mozRequestFullScreen();
    } else if (vp.webkitRequestFullscreen) {
      vp.webkitRequestFullscreen();
    }
  }

  download() {
    if (typeof this.selectedEvent !== 'undefined' && this.selectedEvent != null) {
      const anchor = document.getElementById('download_event_clip_id') as HTMLAnchorElement | null;
      if (anchor) {
        anchor.href = this.event_clip_url;
        anchor.click();
      }
    }
  }

  downloadSnap() {
    if (typeof this.selectedEvent !== 'undefined' && this.selectedEvent != null) {
      const anchor = document.getElementById('download_event_snap_id') as HTMLAnchorElement | null;
      if (anchor) {
        anchor.href = this.selectedEvent.snapurl;
        anchor.click();
      }
    }
  }

  dragElement(elmnt: HTMLElement | null, headerId: string) {
    if (!elmnt) {
      return;
    }
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    const header = document.getElementById(headerId);

    if (header) {
      header.onmousedown = dragMouseDown;
    } else {
      console.error("Header with ID '" + headerId + "' not found.");
    }

    const self = this;
    function dragMouseDown(e: any) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e: any) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      if (elmnt) {
        elmnt.style.top = elmnt.offsetTop - pos2 + 'px';
        elmnt.style.left = elmnt.offsetLeft - pos1 + 'px';
      }
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  selectedMark: string = '';

  markEvent(markType: string) {
    this.selectedMark = markType;
    const overlay = document.getElementById('eventoverlay');
    if (overlay) {
      overlay.style.display = 'block';
    }
  }

  showMarkEvent(param: any) {
    console.log('showMarkEvent called with param:', param);
    if (param === 0) {
      const overlay = document.getElementById('eventoverlay');
      if (overlay) {
        this.dragElement(overlay, 'eventoverlayheader');
        console.log('Overlay shown');
      }
    }
  }

  hideMarkEvent(param: any) {
    if (param === 1) {
      const overlay = document.getElementById('eventoverlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
      console.log('Overlay hidden');
    }
  }

  showForwardEvent(param: any) {
    console.log('showForwardEvent called with param:', param);
    if (param === 0) {
      const overlay = document.getElementById('overlay');
      if (overlay) {
        overlay.style.display = 'block';
        this.dragElement(overlay, 'overlayheader');
        console.log('Overlay shown');
      }
    }
  }

  hideForwardEvent(param: any) {
    console.log('hideForwardEvent called with param:', param);
    if (param === 1) {
      const overlay = document.getElementById('overlay');
      if (overlay) {
        overlay.style.display = 'none';
        console.log('Overlay hidden');
      }
    }
  }

  saveChange() {
    console.log('New changes are saved.');
  }

  resetChange() {
    console.log('No changes are saved.');
    const overlay = document.getElementById('eventoverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  cancelChange() {
    console.log('cancel all changes.');
    const overlay = document.getElementById('eventoverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // ---- users ----
  getAllUsers() {
    const url = API_ENDPOINTS.USER_INFO;
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
        next: (response) => {
          this.users = response.result;
          this.selectedUsers = this.users.map((user: any) => ({
            username: user.userid,
            selected: user.selected || false,
          }));
        },
        error: (err) => {
          console.error('Error fetching users:', err?.error || err);
        },
      });
  }

  updateSelectedUsers() {
    this.selectedUsers = this.users
      .filter((u) => u.selected)
      .map((u) => ({ username: u.userid, selected: u.selected }));
    console.log('Selected users:', this.selectedUsers);
  }

  sendMessage() {
    if (!this.selectedUsers || this.selectedUsers.length === 0) {
      alert('Please select user(s)');
    } else {
      const usernames = this.selectedUsers.map((u) => u.username);
      console.log('Message sent to ' + usernames.join(','));
      // Add your message sending logic here
    }
  }

  reset() {
    if (this.videoPlayer) {
      this.videoPlayer.setAttribute('poster', 'images/postervtpl_new.jpg');
      this.videoPlayer.setAttribute('src', '');
    }

    this.selectedEvent = null;
    const playBtn = document.getElementById('play_btn_id') as HTMLImageElement | null;
    if (playBtn) {
      playBtn.src = 'images/Play.png';
    }
    this.event_clip_url = undefined;
    this.currentTime = '0:00';
    this.duration = '0:00';
    this.progress = 0;
    this.durInitial = undefined;
    this.firstTimeLoadingClip = false;
    const waiting = document.getElementById('event_video_player_waitinggolla_id');
    if (waiting) {
      waiting.style.display = 'none';
    }

    this.model.error = '';
  }

  initPlayer() {
    let lastDiff: number | undefined = undefined;

    this.videoPlayer =
      (document.getElementById('event_video_player') as HTMLVideoElement | null) || undefined;

    if (!this.videoPlayer) {
      return;
    }

    this.videoPlayer.addEventListener(
      'ended',
      () => {
        lastDiff = undefined;
        const playBtn = document.getElementById('play_btn_id') as HTMLImageElement | null;
        if (playBtn) {
          playBtn.src = 'images/Play.png';
        }
      },
      true,
    );

    this.videoPlayer.addEventListener(
      'timeupdate',
      () => {
        let curr = Math.floor(this.videoPlayer!.currentTime);
        let dur = Math.floor(this.videoPlayer!.duration as number);

        if (curr > dur) {
          curr = dur;
        }

        let diff = dur - curr;
        diff = (this.durInitial ?? diff) - diff; // preserve original math: diff = durInitial - (dur - curr)

        if (typeof lastDiff !== 'undefined') {
          if (diff < lastDiff) {
            diff = lastDiff;
          }
        }

        if (diff < 0) {
          diff = 0;
        }

        lastDiff = diff;

        if (diff < 60) {
          this.currentTime = '0:' + (diff > 9 ? diff : '0' + diff);
        } else {
          this.currentTime =
            Math.floor(diff / 60) +
            ':' +
            (Math.floor(diff % 60) > 9 ? Math.floor(diff % 60) : '0' + Math.floor(diff % 60));
        }

        this.progress = Math.floor(lastDiff * (100 / (this.durInitial ?? 1)));

        if (Number.isNaN(diff)) {
          this.currentTime = '0:00';
        } else {
          const waiting = document.getElementById('event_video_player_waitinggolla_id');
          if (waiting) {
            waiting.style.display = 'none';
          }
        }

        setTimeout(() => {
          // in Angular change detection will pick up changes; run in zone to be safe
        }, 10);
      },
      true,
    );

    this.videoPlayer.addEventListener(
      'loadedmetadata',
      () => {
        if (
          typeof this.videoPlayer!.duration !== 'undefined' &&
          !Number.isNaN(this.videoPlayer!.duration)
        ) {
          this.durInitial = Math.floor(this.videoPlayer!.duration as number);
          this.durInitial = this.durInitial < 0 ? 0 : this.durInitial;

          if (this.durInitial < 60) {
            this.duration = '0:' + (this.durInitial > 9 ? this.durInitial : '0' + this.durInitial);
          } else {
            this.duration =
              Math.floor(this.durInitial / 60) +
              ':' +
              (Math.floor(this.durInitial % 60) > 9
                ? Math.floor(this.durInitial % 60)
                : '0' + Math.floor(this.durInitial % 60));
          }

          this.currentTime = '0:00';

          setTimeout(() => {
            // force change detection if needed
          }, 100);
        }
      },
      true,
    );
  }

  // ---- placeholders for external helpers originally referenced in the controller ----
  getAPIEndpoint(name: string): string {
    // The original controller called $scope.getAPIEndpoint(name). If you have such a helper,
    // replace the implementation here. For now attempt to call a global function if present.
    return (window as any).getAPIEndpoint ? (window as any).getAPIEndpoint(name) : name;
  }
}
