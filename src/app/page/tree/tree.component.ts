import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import { CookieService } from 'ngx-cookie-service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

interface CameraNode {
  name: string;
  type: string;
  isRTAMC?: boolean;
  isRecordingServer?: boolean;
  isLocation?: boolean;
  iscamera?: boolean;
  id?: any;
  location?: any;
  configurationType?: any;
  children?: CameraNode[];
}

@Component({
  selector: 'tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tree.component.html',
  styleUrls: ['./tree.component.css']
})
export class TreeComponent implements OnInit {
  displayTree: CameraNode[] = [];
  originalCameraTree: CameraNode[] = [];
  loading: boolean = false;
  isNTAMC: boolean = false;
  imagePathFixedIdle = "CameraIconIdle.png";

	imagePathFixedLive = "CameraLiveAndRecordingIcon.png";
	imagePathFixedDead = "CameraBrokenInactiveIcon.png";

	imagePathPtzLive = "PtzCameraLiveAndRecordingIcon.png";
	imagePathPtzDead = "PtzCameraBrokenInactiveIcon.png";

	imagePathZoomLive = "ZoomCameraLiveAndRecordingIcon.png";
	imagePathZoomDead = "ZoomCameraInactiveIcon.png";
  imagePathFixed: string = '';
  imagePathPtz: string = '';

  rootconfig: any = {
    serverid: '',
    vsessionid: '',
    ws: {
      schemadomainport: '',
      context: ''
    },
    status_indicator: false,
    is_connected: false,
    junctions: [],
    cameramap: {},
    filteredchannels: [],
    streamer: undefined,
    analytictypes: {}
  };

  serverConfiguration: any;

  model:any = { 
		error: "", camerror: "", 
		success: "", 
		dateform: {"date": new Date(), "open": false}, 
		dateto: {"date": new Date(), "open": false}, 
		total: 0,
	};

  vsessionuserid: string = '';
  vsessionid: string = '';
  // List of cameras available to drag
  cameras: CameraNode[] = [];
  // List of drop zones
  dropZones: { index: number; cameras: CameraNode[] }[] = [];
  message='';
  isFavroite = false;
  isLocation = false;
  isGroup = false;

  analytictypes:any[] = [];
  analyticTypes$ = new Subject<any>();

  constructor(
    private http: HttpClient,
    private cookieService:CookieService,
    private router:Router
  ) {}

  ngOnInit(): void {
    // Initialize dropZones if needed
    for (let i = 0; i < 5; i++) {
      this.dropZones.push({ index: i, cameras: [] });
    }

    this.rootconfig.vsessionid = this.cookieService.get('vSessionId');
    this.rootconfig.ws.schemadomainport =
      document.querySelector('#ws_schemadomainport')?.textContent?.trim() || '';
    this.rootconfig.ws.context =
      document.querySelector('#ws_context')?.textContent?.trim() || '';
    this.loadData();
    this.loadServerConfiguration();
    // this.buildJunctionTree();
  }

  ngOnDestroy(): void {
    localStorage.removeItem('serverConfiguration');
  }

  private showInvalidSession(): void {
    const confirmed = confirm('Invalid Session! Please Login.');
    if (confirmed) {
      // Clear cookies and local/session storage (optional for security)
      this.cookieService.deleteAll('/', window.location.hostname);
      sessionStorage.clear();
      localStorage.clear();

      // ✅ Redirect to login page
      this.router.navigateByUrl('ivmsweb/login');
    }
  }

  loadData(): void {
    const jsessionId = this.cookieService.get('vSessionId');
    console.log('Cookie value:', jsessionId);

    const url = API_ENDPOINTS.SERVER_INFO;
    const url1 = API_ENDPOINTS.USER_SESSION;

    // ❗ Don't use 'Cookie' — browser blocks it

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cookies': `JSESSIONID=${jsessionId}`,
      'Authorization': `Bearer ${this.cookieService.get('authToken')}`
    });

    // === 1. Fetch server info ===
    this.http.get<any>(url, { headers }).pipe(take(1)).subscribe({
      next: (response) => {
        console.log('Server Info Response:', response);
        if (response?.result?.length) { 
          response.result.forEach((server: any) => { 
            if (server.servertype === 'IVMS') { 
              this.rootconfig.serverid = server.serverid; 
              // console.log(this.rootconfig.serverid, server.serverid)
            } 
          }); 
        } 
        if (!this.rootconfig.serverid) { 
          this.model.camerror = 'IVMS server is not registered'; 
          setTimeout(() => (this.model.camerror = ''), 5000); 
        } else { 
          this.getAnalyticsTypes(this.rootconfig.serverid); 
          // console.log('IsNTAMC:', this.isNTAMC); 
          this.buildJunctionTree(this.rootconfig.serverid); 
        }
      },
      error: (err) => {
        if (err.status === 401) {
          this.showInvalidSession();
        } else {
          this.model.camerror = err?.error?.message || 'Error loading servers';
          setTimeout(() => (this.model.camerror = ''), 5000);
        }
      }
    });
    // === 2. Fetch user session ===
    this.http.get<any>(url1, { headers }).pipe(take(1)).subscribe({
      next: (response) => {
        console.log('User Session Response:', response);
        if (response?.result?.length > 0) {
          const user = response.result[0];
          this.vsessionuserid = user.userid;
          this.vsessionid = user.vsessionid;
          // console.log(this.vsessionid, this.vsessionuserid)
        }
      },
      error: (err) => {
        if (err.status === 401) {
          this.showInvalidSession();
        } else {
          this.model.camerror = err?.error?.message || 'Error loading user info';
          setTimeout(() => (this.model.camerror = ''), 5000);
        }
      },
    });
  }

  buildJunctionTree(serverid:string) {
    const apiEndpoint = API_ENDPOINTS.LOCATION_TREE.replace('{serverid}', serverid);
    const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Cookies': `JSESSIONID=${this.cookieService.get('vSessionId')}`,  // or your API expects 'X-Session-Token'
    'Authorization': `Bearer ${this.cookieService.get('authToken')}`
  });

    this.loading = true;
    this.http.get<any>(apiEndpoint,{headers, withCredentials:true}).pipe(take(1)).subscribe({
      next: response => {
        if (response.result) {
          let rawData = response.result;
          this.displayTree = [];

          if (!this.isNTAMC) {
            this.originalCameraTree = rawData;
            this.displayTree = this.originalCameraTree;
          } else {
            let formattedTree: CameraNode[] = [];

            if (Array.isArray(rawData) && rawData.length > 0) {
              rawData = rawData[0];
            }

            Object.keys(rawData).forEach(serverKey => {
              let serverName = "Unnamed Server";
              let serverId = "Unknown ID";

              const match = serverKey.match(/redundantmediaservername=([^,]+), redundantmediaserverid=([^,\]]+)/);
              if (match) {
                serverName = match[1].trim();
                serverId = match[2].trim();
              }

              const cameras = Array.isArray(rawData[serverKey]) ? rawData[serverKey] : [];
              const recordingServerMap: any = {};

              cameras.forEach(camera => {
                const recordingServer = camera.recordingservername;
                const location = camera.location;

                if (!recordingServerMap[recordingServer]) recordingServerMap[recordingServer] = {};
                if (!recordingServerMap[recordingServer][location]) recordingServerMap[recordingServer][location] = [];

                recordingServerMap[recordingServer][location].push({
                  name: `${camera.channelid}_${camera.channelname}`,
                  type: 'camera',
                  isRTAMC: false,
                  isRecordingServer: false,
                  iscamera: true,
                  isLocation: false,
                  id: camera.channelid,
                  location: camera.location,
                  configurationType: camera.channeltype
                });
              });

              const recordingServerNodes = Object.keys(recordingServerMap).map(recordingServer => {
                const recServerCamera = cameras.find(cam => cam.recordingservername === recordingServer);
                const recordingServerId = recServerCamera ? recServerCamera.recordingserverid : 'unknown';

                const locationNodes = Object.keys(recordingServerMap[recordingServer]).map(location => ({
                  name: location,
                  type: 'location',
                  isRTAMC: false,
                  isRecordingServer: false,
                  isLocation: true,
                  iscamera: false,
                  children: recordingServerMap[recordingServer][location]
                }));

                return {
                  name: recordingServer,
                  id: recordingServerId,
                  type: 'recordingserver',
                  isRTAMC: false,
                  isRecordingServer: true,
                  isLocation: false,
                  iscamera: false,
                  children: locationNodes
                };
              });

              formattedTree.push({
                name: serverName,
                id: serverId,
                type: 'rtamcserver',
                isRTAMC: true,
                isRecordingServer: false,
                isLocation: false,
                iscamera: false,
                children: recordingServerNodes
              });
            });

            this.originalCameraTree = formattedTree;
            this.displayTree = this.originalCameraTree;

            // Populate flat cameras list for drag-drop
            this.cameras = [];
            this.displayTree.forEach(server => {
              server.children?.forEach(recServer => {
                recServer.children?.forEach(location => {
                  location.children?.forEach(cam => this.cameras.push(cam));
                });
              });
            });
          }

          this.loading = false;
          this.generateCameraHierarchy();
        }
      },
      error: err => {
        console.error('Error loading camera tree:', err);
        this.loading = false;
      }
    });
  }

  generateCameraHierarchy() {
    this.displayTree.forEach((node:any) => {
      if (!this.isNTAMC) {
        if (node['isjunction']) {
          this.rootconfig.junctions.push({ id: node.id, name: node.name });
        } else if (node['iscamera']) {
          this.rootconfig.cameramap[`junction_camera_${node.id}`] = node;
        }
      } else {
        if (node.isRTAMC) {
          this.rootconfig.rtamcServers[node.id] = { id: node.id, name: node.name };
        }
        node.children?.forEach((child1:any) => {
          if (child1.isRecordingServer) {
            child1.children?.forEach((child2:any) => {
              if (child2.isLocation) {
                this.rootconfig.locations[child2.name] = { id: child2.id, name: child2.name };
              }
              child2.children?.forEach((child3:any) => {
                if (child3.iscamera) {
                  const camera2 = {
                    id: child3.id,
                    name: child3.name,
                    configurationType: child3.configurationType,
                    location: child2
                  };
                  this.rootconfig.cameramap[`location_camera_${camera2.id}`] = camera2;

                  if (camera2.configurationType == "0") this.imagePathFixed = "camera_normal.png";
                  else if (camera2.configurationType == "1") this.imagePathPtz = "Ptz_Camera_16x16.png";
                }
              });
            });
          }
        });
      }
    });
  }

  // drop(event: CdkDragDrop<CameraNode[]>, dropZoneIndex: number) {
  //   if (event.previousContainer === event.container) return;
  //   transferArrayItem(
  //     event.previousContainer.data,
  //     event.container.data,
  //     event.previousIndex,
  //     event.currentIndex
  //   );
  //   console.log('Camera dropped in zone', dropZoneIndex, event.container.data);
  // }
  nodeClicked(node: any) {
    // Toggle the checked state
    node.checked = !node.checked;

    if (node.isjunction) {
      // Toggle visibility of children using a 'visible' property
      if (node.children) {
        node.children.forEach((child:any) => {
          child.visible = !child.visible;
        });
      }
    } else {
      // Replace $rootScope.$broadcast with a custom method or EventEmitter
      this.channelClicked(node);
    }
  }

  getNodeName(nodeName: string): string {
    return nodeName.length <= 20 ? nodeName : nodeName.substring(0, 18) + '..';
  }

  // Example placeholder for channel click event
  private channelClicked(node: any) {
    console.log('Channel clicked:', node);
  }
  private getAPIUrl(endpoint: string): string {
    return `${endpoint}`;
  }


  loadServerConfiguration(): void {
    const jsessionId = this.cookieService.get('vSessionId');
    // console.log('Cookie value:', jsessionId);
    const apiUrl = API_ENDPOINTS.SERVER_CONFIG;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cookies': `JSESSIONID=${jsessionId}`,
      'Authorization': `Bearer ${this.cookieService.get('authToken')}`
    });

    this.http.get<any>(apiUrl,  { headers, withCredentials:true }).pipe(take(1)).subscribe({
      next: (response) => {
        console.log("serverConfiguration", response);
        if (response?.result?.length > 0 && response.result[0]) {
          this.serverConfiguration = response.result[0];
          localStorage.setItem('serverConfiguration', JSON.stringify(this.serverConfiguration));

          this.rootconfig.streamer = this.serverConfiguration.streamingMode;
        }
      },
      error: (error) => {
        // this.message = error?.data?.message || 'Could not connect to server!';
      }
    });
  }

  getAnalyticsTypes(serverid:string): void {
    const apiUrl = API_ENDPOINTS.ANLYTICS_INFO.replace('{serverid}', serverid);
    const jsessionId = this.cookieService.get('vSessionId');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cookies': `JSESSIONID=${jsessionId}`,
      'Authorization': `Bearer ${this.cookieService.get('authToken')}`
    });

    this.http.get<any>(apiUrl,{ headers }).subscribe({
      next: (response) => {
        if (response?.result?.length > 0) {
          console.log("analytic response", response);
          
          response.result.forEach((analytic: any, index: number) => {
            console.log("analytic", analytic, this.analytictypes);
            
            this.rootconfig.analytictypes[index] = {
              alerttype: analytic.alerttype,
              alertname: analytic.alertname
            };
            this.analytictypes[index] = analytic;
          });

          // 🔊 Equivalent to $rootScope.$broadcast('analytictypes', ...)
          this.analyticTypes$.next(this.rootconfig.analytictypes);
          console.log(this.rootconfig.analytictypes, this.analytictypes);
          
        }
      },
      error: (error) => {
        if (error.status === 401) {
          this.showInvalidSession();
        } else {
          this.model.camerror = error.error?.message || 'Server error occurred.';
          setTimeout(() => {
            this.model.camerror = '';
          }, 3000);
        }
      }
    });
  }

  // locationClick(value: string): void {
  //   if (value === 'Favroite') {
  //     this.isFavroite = !this.isFavroite;
  //     this.isLocation = false;
  //     this.isGroup = false;
  //   } else if (value === 'Location') {
  //     this.isLocation = !this.isLocation;
  //     this.isFavroite = false;
  //     this.isGroup = false;
  //   } else if (value === 'Group') {
  //     this.isGroup = !this.isGroup;
  //     this.isFavroite = false;
  //     this.isLocation = false;
  //   }
  // }

}


