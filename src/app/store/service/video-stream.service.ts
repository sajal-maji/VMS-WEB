import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VideoStreamService {
  VideoneticsRTC = VideoneticsRTC;
}
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


class VideoneticsRTCError extends Error {
  constructor(message:any) {
    super(message);
  }
}
class VideoneticsRTC extends EventTarget {
  #siteId;
  #channelId;
  #timeStamp;
  #CODECS;
  #mode;
  #media;
  #pcConfig: RTCConfiguration;
  #video;
  #ws:any;
  #wsURL;
  #pc:any;
  #mseCodecs;
  #DISCONNECT_TIMEOUT;
  #RECONNECT_TIMEOUT;
  #INTER_FRAME_TIMEOUT;
  #CLOUD_IP;
  #connectTS;
  #disconnectTID;
  #reconnectTID;
  #interFrameGapTID;
  #app;
  #stream;
  #sessionId;
  #ondata:any;
  #onmessage;
  // State Variables
  startTimeStamp;
  endTimeStamp;
  speed;
  frameByFrame;
  currentTimeStamp;
  isPlaying;
  isReplay;
  #isError;
  #errorMessage;
  #isLive;
  base_url: any;

  constructor(base_url:any, videoElement:any) {
    super();
    this.#siteId = -1;
    this.#channelId = -1;
    this.#timeStamp = 0;
    this.#app = 0;

    this.#stream = 0;
    this.#sessionId = "";
    // Assign default values for state variables
    this.startTimeStamp = 0;
    this.endTimeStamp = 0;
    this.speed = 1;
    this.frameByFrame = false;
    this.currentTimeStamp = 0;
    this.isPlaying = false;
    this.isReplay = false;
    this.#isError = false;
    this.#errorMessage = "";
    this.#isLive = false;
    this.base_url = base_url;

    this.#CODECS = [
      "avc1.640029", // H.264 high 4.1 (Chromecast 1st and 2nd Gen)
      "avc1.64002A", // H.264 high 4.2 (Chromecast 3rd Gen)
      "avc1.640033", // H.264 high 5.1 (Chromecast with Google TV)
      "hvc1.1.6.L153.B0", // H.265 main 5.1 (Chromecast Ultra)
      "mp4a.40.2", // AAC LC
      "mp4a.40.5", // AAC HE
      "flac", // FLAC (PCM compatible)
      "opus", // OPUS Chrome, Firefox
    ];

    /**
     * [config] Supported modes (webrtc, webrtc/tcp, mse, hls, mp4, mjpeg).
     * @type {string}
     */
    this.#mode = "webrtc,mse"; //"webrtc,mse,hls,mjpeg";

    /**
     * [Config] Requested medias (video, audio, microphone).
     * @type {string}
     */
    this.#media = "video,audio";

    /**
     * [config] WebRTC configuration
     * @type {RTCConfiguration}
     */
    this.#pcConfig = {
      bundlePolicy: "max-bundle",
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],

      // sdpSemantics: "unified-plan", // important for Chromecast 1
    };

    /**
     * @type {HTMLVideoElement}
     */
    this.#video = videoElement;

    /**
     * @type {WebSocket}
     */
    this.#ws = null;

    /**
     * @type {string|URL}
     */
    this.#wsURL = "";

    /**
     * @type {RTCPeerConnection}
     */
    this.#pc = null;

    /**
     * @type {string}
     */
    this.#mseCodecs = "";

    /**
     * [internal] Disconnect TimeoutID.
     * @type {number}
     */
    this.#disconnectTID = 0;

    /**
     * [internal] Reconnect TimeoutID.
     * @type {number}
     */
    this.#reconnectTID = 0;

    /**
     * [internal] Inter Frame Gap TimeoutID.
     * @type {number}
     */
    this.#interFrameGapTID = 0;
    /**
     * [internal] Handler for receiving Binary from WebSocket.
     * @type {Function}
     */
    this.#ondata = null;

    /**
     * [internal] Handlers list for receiving JSON from WebSocket.
     * @type {Object.<string,Function>}
     */
    this.#onmessage = {
      hls: (msg: any) => { },
      meta: (msg: any) => { },
      mjpeg: (msg: any) => { },
      mp4: (msg: any) => { },
      mse: (msg: any) => { },
      webrtc: (msg: any) => { },
    };

    this.#DISCONNECT_TIMEOUT = 5000;
    this.#RECONNECT_TIMEOUT = 15000;
    this.#INTER_FRAME_TIMEOUT = 5000;
    this.#CLOUD_IP = "<videoneticsAddr>";

    /**
     * @type {number}
     */
    this.#connectTS = 0;

    /**
     * [internal] Disconnect TimeoutID.
     * @type {number}
     */
    this.#disconnectTID = 0;

    /**
     * [internal] Reconnect TimeoutID.
     * @type {number}
     */
    this.#reconnectTID = 0;

    this.#video.addEventListener("error", (ev:any) => {
      console.warn(ev);
      this.dispatchEvent(new CustomEvent("error", { detail: { error: new VideoneticsRTCError(ev.error?.message) } }));
      // this.#ondisconnect()
    });

    this.#video.addEventListener("timeupdate", (event:any) => {
      // console.log("============video timeupdate==========");
    });
  }

  get channelId() {
    return this.#channelId;
  }

  get siteId() {
    return this.#siteId;
  }

  get timeStamp() {
    return this.#timeStamp;
  }

  start(siteId:any, channelId:any, timeStamp:any) {
    // this.stop(false);
    this.#siteId = siteId;
    this.#channelId = channelId;
    this.#timeStamp = timeStamp;
    this.isPlaying = true;
    console.log(
      "Start called Site ID:",
      this.#siteId,
      " Channel ID: ",
      this.#channelId,
      " TimeStamp: ",
      this.#timeStamp
    );
    let live = 1;
    this.#sessionId = "";
    this.startTimeStamp = timeStamp;
    if (timeStamp === 0) this.endTimeStamp = 0;

    if (timeStamp > 1) {
      live = 0;
      this.#sessionId = uuidv4();
    }
    const name =
      this.#siteId +
      "/" +
      this.#channelId +
      "/" +
      this.#app +
      "/" +
      live +
      "/" +
      this.#stream +
      "/" +
      this.#timeStamp +
      "/" +
      this.#sessionId;

    // this.url =
    //   this.base_url +
    //   "/v2/stream/site/" +
    //   this.#siteId +
    //   "/channel/" +
    //   this.#channelId +
    //   "/app/" +
    //   this.#app +
    //   "/live/" +
    //   live +
    //   "/stream/" +
    //   this.#stream +
    //   "/timestamp/" +
    //   this.#timeStamp +
    //   "/webrtc";

    // console.log("url", this.url);
    const src = "videonetics://" + this.#CLOUD_IP + "/" + name;
    // this.#src = new URL(
    //   "api/ws?name=" +
    //     encodeURIComponent(name) +
    //     "&src=" +
    //     encodeURIComponent(src),
    //   location.href
    // );
    // console.log("SessionID: ", this.#sessionId);
    this.#src = "/api/ws?name=" + encodeURIComponent(name) + "&src=" + encodeURIComponent(src);
    // const src = name;
    // this.#src = new URL("api/ws?src=" + encodeURIComponent(src), location.href);
    return this.#sessionId;
  }


  stop(directcall:any) {
    console.log(
      "Stop called Site ID:",
      this.siteId,
      " Channel ID: ",
      this.channelId,
      " TimeStamp: ",
      this.timeStamp,
      " directcall: ",
      directcall
    );
    this.#ondisconnect();
  }

  async pauseWebRTC() {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/pause"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/pause";

    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC paused successfully.');
      } else {
        console.error('Failed to pause WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Seektimestamp WebRTC:', error);
    }
  }

  async resumeWebRTC() {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/resume"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/resume";

    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC resumed successfully.');
      } else {
        console.error('Failed to resume WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Resume WebRTC:', error);
    }
  }

  async seekTimestamp(timeStamp:any) {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/seek/{seektimestamp}"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/seek/" +
      timeStamp;

    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC seektimestamp Applied successfully.');
      } else {
        console.error('Failed to Apply Seektimestamp WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Seektimestamp WebRTC:', error);
    }
  }

  async forwardWebRTC(speed:any) {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/forward/speed/{speed}"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/forward/speed/" +
      speed;
   const requestBody = { sessionId: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC Fast Forward Applied successfully.');
      } else {
        console.error('Failed to Apply Forward WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Forward WebRTC:', error);
    }

  }

  async backwardWebRTC(speed:any) {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/backward/speed/{speed}"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/backward/speed/" +
      speed;
    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC Fast Backward Applied successfully.');
      } else {
        console.error('Failed to Apply Backward WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Backward WebRTC:', error);
    }
  }

  async frameByFrameForwardWebRTC() {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/forward/frame_by_frame"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/forward/frame_by_frame";
    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC Step Forward Applied successfully.');
      } else {
        console.error('Failed to Apply Step Forward WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Step Forward WebRTC:', error);
    }
  }

  async frameByFrameBackwardWebRTC() {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/backward/frame_by_frame"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/backward/frame_by_frame";
    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC Step Backward Applied successfully.');
      } else {
        console.error('Failed to Apply Step Backwar WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Step Backwar WebRTC:', error);
    }
  }

  async normalWebRTC(speed:any) {
    //"/v2/stream/site/{site_id}/channel/{channel_id}/app/{app_id}/archive/sessionid/{session_id}/webrtc/normalplay/speed/{speed}"
    const url = this.base_url +
      "/v2/stream/site/" +
      this.#siteId +
      "/channel/" +
      this.#channelId +
      "/app/" +
      this.#app +
      "/archive/sessionid/" +
      this.#sessionId +
      "/webrtc/normalplay/speed/" +
      speed;
    const requestBody = { sessionid: this.#sessionId };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('WebRTC Normal Play Applied successfully.');
      } else {
        console.error('Failed to Apply Normal WebRTC:', response.status);
      }
    } catch (error) {
      console.error('An error occurred while applying Normal WebRTC:', error);
    }
  }

  /**
   * Set video source (WebSocket URL). Support relative path.
   * @param {string|URL} value
   */
  set #src(value:any) {
    console.log("VideoneticsRTC.src");
    if (typeof value !== "string") value = value.toString();
    if (value.startsWith("http")) {
      value = "ws" + value.substring(4);
    } else if (value.startsWith("/")) {
      value = "ws" + location.origin.substring(4) + value;
    }

    this.#wsURL = value;
    // this.#wsURL = `ws:/${this.base_url}` + value;
    console.log("ws url", this.#wsURL)

    this.#onconnect();
  }

  /**
   * Connect to WebSocket. Called automatically on `connectedCallback`.
   * @return {boolean} true if the connection has started.
   */
  #onconnect() {
    console.log("VideoneticsRTC.onconnect ", this.#wsURL, this.#ws, this.#pc);
    if (!this.#wsURL || this.#ws || this.#pc) return false;
    console.log("VideoneticsRTC.onconnect2", this.#wsURL, this.#ws, this.#pc);

    this.#ws = new WebSocket(this.#wsURL);
    this.#ws.binaryType = "arraybuffer";

    this.#ws.addEventListener("error", () => {
      console.log("Sanglap error", this.#ws);
    });

    this.#ws.addEventListener("open", () => {
      console.log("Sanglap open", this.#ws);
      return this.#onopen();
    });

    this.#ws.addEventListener("close", () => {
      console.log("Sanglap close", this.#ws);
      return this.#onclose();
    });

    this.#connectTS = Date.now();
    console.log("VideoneticsRTC.onconnect3", this.#wsURL, this.#ws, this.#pc);
    return true;
  }

  #ondisconnect() {
    console.log("VideoneticsRTC.ondisconnect");
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.close();
    }
    this.#ws = null;
    console.log("#ws close");

    if (this.#pc) {
      if (this.#pc.connectionState === "connected") {
        this.#pc.getSenders().forEach((sender:any) => {
          if (sender.track) sender.track.stop();
        });
        this.#pc.close();
      }
      this.#pc = null;
    }
    this.#video.src = "";
    this.#video.srcObject = null;
    // this.#video.controls = true;
  }

  /**
   * @returns {Array.<string>} of modes (mse, webrtc, etc.)
   */
  #onopen() {
    console.log("VideoneticsRTC.onopen1 ", this.#ws);
    if (!this.#ws) return;
    console.log("VideoneticsRTC.onopen2 ", this.#ws);
    // CONNECTING => OPEN
    this.#ws.onmessage = (ev:any) => {
      if (typeof ev.data === "string") {
        const msg = JSON.parse(ev.data);
        const type = msg.type.includes("webrtc") ? "webrtc" : msg.type;
        switch (type) {
          case "hls":
            this.#onmessage["hls"](msg);
            break;
          case "meta":
            this.#onmessage["meta"](msg);
            break;
          case "mjpeg":
            this.#onmessage["mjpeg"](msg);
            break;
          case "mp4":
            this.#onmessage["mp4"](msg);
            break;
          case "mse":
            this.#onmessage["mse"](msg);
            break;
          case "webrtc":
            this.#onmessage["webrtc"](msg);
            break;
          case "error":
            this.#onmessage["hls"](msg);
            this.#onmessage["meta"](msg);
            this.#onmessage["mjpeg"](msg);
            this.#onmessage["mp4"](msg);
            this.#onmessage["mse"](msg);
            this.#onmessage["webrtc"](msg);
            this.dispatchEvent(new CustomEvent("error", { detail: { error: new VideoneticsRTCError(msg.value) } }));
            break;
          default:
            this.#onmessage["hls"](msg);
            this.#onmessage["meta"](msg);
            this.#onmessage["mjpeg"](msg);
            this.#onmessage["mp4"](msg);
            this.#onmessage["mse"](msg);
            this.#onmessage["webrtc"](msg);
            break;
        }
      } else {
        if (!this.#ondata) return;
        this.#ondata(ev.data);
      }
    };

    this.#ondata = null;

    this.#onmessage = {
      hls: () => { },
      meta: () => { },
      mjpeg: () => { },
      mp4: () => { },
      mse: () => { },
      webrtc: () => { },
    };

    const modes:any[] = [];

    if (this.#mode.indexOf("mse") >= 0 && ("MediaSource" in window || "ManagedMediaSource" in window)) {
      modes.push("mse");
      this.#onmse();
    } else if (this.#mode.indexOf("hls") >= 0 && this.#video.canPlayType("application/vnd.apple.mpegurl")) {
      modes.push("hls");
      this.#onhls();
    } else if (this.#mode.indexOf("mp4") >= 0) {
      modes.push("mp4");
      this.#onmp4();
    }

    this.#onmeta();

    if (this.#mode.indexOf("webrtc") >= 0 && "RTCPeerConnection" in window) {
      modes.push("webrtc");
      this.#onwebrtc();
    }

    if (this.#mode.indexOf("mjpeg") >= 0) {
      if (modes.length) {
        this.#onmessage["mjpeg"] = (msg) => {
          if (msg.type !== "error" || msg.value.indexOf(modes[0]) !== 0) return;
          this.#onmjpeg();
        };
      } else {
        modes.push("mjpeg");
        this.#onmjpeg();
      }
    }

    return modes;
  }

  /**
   * @return {boolean} true if reconnection has started.
   */
  #onclose() {
    console.log("VideoneticsRTC.onclose", this.#ws, this.#ws?.readyState);
    if (!this.#ws) return;
    if (this.#ws.readyState !== WebSocket.OPEN) return;
    this.#ws = null;

    // reconnect no more than once every X seconds
    const delay = Math.max(this.#RECONNECT_TIMEOUT - (Date.now() - this.#connectTS), 0);

    this.#reconnectTID = window.setTimeout(() => {
      console.log("Reconnect Timer");
      this.#reconnectTID = 0;
      this.#onconnect();
    }, delay);

    return true;
  }

  /**
   * Play video. Support automute when autoplay blocked.
   * https://developer.chrome.com/blog/autoplay/
   */
  #play() {
    console.log("VideoneticsRTC.play");
    this.#video.play().catch(() => {
      if (!this.#video.muted) {
        this.#video.muted = true;
        this.#video.play().catch((er:any) => {
          console.warn(er);
        });
      }
    });
  }

  /**
   * Send message to server via WebSocket
   * @param {Object} value
   */
  #send(value:any) {
    console.log("VideoneticsRTC.send");
    if (this.#ws) this.#ws.send(JSON.stringify(value));
  }

  /** @param {Function} isSupported */
  #codecs(isSupported:any) {
    return this.#CODECS
      .filter((codec) => this.#media.indexOf(codec.indexOf("vc1") > 0 ? "video" : "audio") >= 0)
      .filter((codec) => isSupported(`#video/mp4; codecs="${codec}"`))
      .join();
  }

  #codecs2(isSupported:any) {
    return this.#CODECS
      .filter((codec) => this.#media.indexOf(codec.indexOf("vc1") > 0 ? "video" : "audio") >= 0)
      .filter((codec) => isSupported(`#video/mp4; codecs="${codec}"`))
      .join();
  }

  #onmse() {
    /** @type {MediaSource} */
    let ms;
    console.log("VideoneticsRTC.onmse");
    if ("ManagedMediaSource" in window) {
      const MediaSource = window.ManagedMediaSource;
      // @ts-expect-error unknown
      ms = new MediaSource();
      ms.addEventListener(
        "sourceopen",
        () => {
          this.#send({
            type: "mse",
            // @ts-expect-error unknown
            value: this.#codecs(MediaSource.isTypeSupported),
          });
        },
        { once: true }
      );
      this.#video.disableRemotePlayback = true;
      this.#video.srcObject = ms;
    } else {
      ms = new MediaSource();
      ms.addEventListener(
        "sourceopen",
        () => {
          URL.revokeObjectURL(this.#video.src);
          this.#send({
            type: "mse",
            value: this.#codecs(MediaSource.isTypeSupported),
          });
        },
        { once: true }
      );
      this.#video.src = URL.createObjectURL(ms);
      this.#video.srcObject = null;
    }

    this.#play();

    this.#mseCodecs = "";

    this.#onmessage["mse"] = (msg) => {
      // FIXME: mse string message messages
      if (msg.type !== "mse") return;
      this.#mseCodecs = msg.value;

      console.log("SANGLAP ", msg);

      const sb = ms.addSourceBuffer(msg.value);
      sb.mode = "segments"; // segments or sequence

      const buf = new Uint8Array(2 * 1024 * 1024);
      let bufLen = 0;

      sb.addEventListener("updateend", () => {
        if (sb.updating) return;

        try {
          /*console.log("Sanglap updateEnd");*/
          if (bufLen > 0) {
            const data = buf.slice(0, bufLen);
            bufLen = 0;
            if (ms.sourceBuffers.length > 0 && ms.sourceBuffers[0] === sb)
              sb.appendBuffer(data);
            // Todo Monotosh
            // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer': This SourceBuffer has been removed from the parent media source.
            // this.#mseStreamingStarted = false
          } else if (
            ms.sourceBuffers.length > 0 &&
            sb.buffered &&
            sb.buffered.length
          ) {
            // this.#mseStreamingStarted = true
            /*console.log("<><><>< Buffer Ended ><><><>");*/
            const end = sb.buffered.end(sb.buffered.length - 1);
            // const start = sb.buffered.start(0);

            // if (end > start) {
            //   sb.remove(start, end);
            // }
            // FIXME: Very tricky, needed for PVA data
            // this.#video.currentTime = end;
            // ms.clearLiveSeekableRange();
          } else {
          }
        } catch (e) {
          console.warn(e);
          this.#ondisconnect();
        }
      });

      this.#ondata = (data:any) => {
        // FIXME: mse binary message
        // console.log("Here", sb.updating, bufLen, data);
        /*console.log("Sanglap ondata");*/
        if (sb.updating || bufLen > 0) {
          const b = new Uint8Array(data);
          buf.set(b, bufLen);
          bufLen += b.byteLength;
          // console.debug("VideoRTC.buffer", b.byteLength, bufLen);
        } else {
          try {
            if (ms.sourceBuffers.length > 0 && ms.sourceBuffers[0] === sb)
              sb.appendBuffer(data);
          } catch (e) {
            console.warn(e);
            this.#ondisconnect();
          }
        }
      };
    };
  }

  #onwebrtc() {
    const pc = new RTCPeerConnection(this.#pcConfig);
    const dc = pc.createDataChannel("datachannel");
    dc.onopen = () => { };
    dc.onclose = () => { };
    dc.onmessage = (ev) => {
      this.#onmessage["meta"]({ type: "meta", value: ev.data });
    };

    pc.addEventListener("icecandidate", (ev) => {
      if (ev.candidate && this.#mode.indexOf("webrtc/tcp") >= 0 && ev.candidate.protocol === "udp") return;

      const candidate = ev.candidate ? ev.candidate.toJSON().candidate : "";
      this.#send({ type: "webrtc/candidate", value: candidate });
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "connected") {
        const tracks = pc
          .getTransceivers()
          .filter((tr) => tr.currentDirection === "recvonly") // skip inactive
          .map((tr) => tr.receiver.track);
        /** @type {HTMLVideoElement} */
        const video2 = document.createElement("video");
        video2.addEventListener("loadeddata", () => this.#onpcvideo(video2), {
          once: true,
        });
        video2.srcObject = new MediaStream(tracks);
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        pc.close(); // stop next events
        this.#pc = null;
        this.#onconnect();
      }
    });

    this.#onmessage["webrtc"] = (msg) => {
      switch (msg.type) {
        case "webrtc/candidate":
          if (this.#mode.indexOf("webrtc/tcp") >= 0 && msg.value.indexOf(" udp ") > 0) return;

          pc.addIceCandidate({ candidate: msg.value, sdpMid: "0" }).catch((er) => {
            console.warn(er);
          });
          break;
        case "webrtc/answer":
          pc.setRemoteDescription({ type: "answer", sdp: msg.value }).catch((er) => {
            console.warn(er);
          });
          break;
        case "error":
          if (msg.value.indexOf("webrtc/offer") < 0) return;
          pc.close();
      }
    };

    this.#createOffer(pc).then((offer) => {
      this.#send({ type: "webrtc/offer", value: offer.sdp });
    });

    this.#pc = pc;
  }

  /**
   * @param #pc {RTCPeerConnection}
   * @return {Promise<RTCSessionDescriptionInit>}
   */
  async #createOffer(pc:any) {
    try {
      if (this.#media.indexOf("microphone") >= 0) {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        media.getTracks().forEach((track) => {
          pc.addTransceiver(track, { direction: "sendonly" });
        });
      }
    } catch (e) {
      console.warn(e);
    }

    for (const kind of ["video", "audio"]) {
      if (this.#media.indexOf(kind) >= 0) {
        pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * @param video2 {HTMLVideoElement}
   */
  #onpcvideo(video2:any) {
    console.log("VideoneticsRtc.onpcvideo");
    if (this.#pc) {
      // Video+Audio > Video, H265 > H264, Video > Audio, WebRTC > MSE
      let rtcPriority = 0,
        msePriority = 0;

      /** @type {MediaStream} */
      const stream = video2.srcObject;
      if (!stream) return;
      if (stream.getVideoTracks().length > 0) rtcPriority += 0x220;
      if (stream.getAudioTracks().length > 0) rtcPriority += 0x102;

      if (this.#mseCodecs.indexOf("hvc1.") >= 0) msePriority += 0x230;
      if (this.#mseCodecs.indexOf("avc1.") >= 0) msePriority += 0x210;
      if (this.#mseCodecs.indexOf("mp4a.") >= 0) msePriority += 0x101;
      if (rtcPriority >= msePriority) {
        this.#video.srcObject = stream;
        this.#play();

        if (this.#ws?.readyState === WebSocket.OPEN) {
          this.#ws.close();
        }
        this.#ws = null;
        console.log("#ws close 1");
      } else {
        if (this.#pc) {
          this.#pc.close();
          this.#pc = null;
        }
      }
    }

    video2.srcObject = null;
  }

  #onmjpeg() {
    this.#ondata = (data:any) => {
      this.#video.controls = false;
      this.#video.poster = "data:image/jpeg;base64," + VideoneticsRTC.btoa(data);
    };

    this.#send({ type: "mjpeg" });
  }

  #onhls() {
    this.#onmessage["hls"] = (msg) => {
      if (msg.type !== "hls") return;
      const url = "http" + this.#wsURL.substring(2, this.#wsURL.indexOf("/ws")) + "/hls/";
      const playlist = msg.value.replace("hls/", url);
      this.#video.src = "data:application/vnd.apple.mpegurl;base64," + btoa(playlist);
      this.#play();
    };
    this.#send({
      type: "hls",
      value: this.#codecs((type:any) => {
        return this.#video.canPlayType(type) != "";
      }),
    });
  }

  #onmp4() {
    /** @type {HTMLCanvasElement} **/
    const canvas = document.createElement("canvas");
    /** @type {CanvasRenderingContext2D} */
    let context:any;

    /** @type {HTMLVideoElement} */
    const video2 = document.createElement("video");
    video2.autoplay = true;
    video2.playsInline = true;

    video2.addEventListener("loadeddata", () => {
      if (!context) {
        canvas.width = video2.videoWidth;
        canvas.height = video2.videoHeight;
        context = canvas.getContext("2d");
      }
      if (!context) return;
      context.drawImage(video2, 0, 0, canvas.width, canvas.height);

      this.#video.controls = false;
      this.#video.poster = canvas.toDataURL("image/jpeg");
    });

    this.#ondata = (data:any) => {
      video2.src = "data:video/mp4;base64," + VideoneticsRTC.btoa(data);
    };

    this.#send({ type: "mp4", value: this.#codecs2(this.#video.canPlayType) });
  }

  #onmeta() {
    this.#onmessage["meta"] = (msg) => {
      if (msg.type !== "meta") return;
      const x = JSON.parse(msg.value);
      this.currentTimeStamp = x.timeStamp;
      if (!this.isPlaying && this.startTimeStamp === 0 && !this.#isLive) this.#isLive = true;
      // if (!this.isPlaying) this.isPlaying = true;
      this.dispatchEvent(new CustomEvent("meta", { detail: msg }));
      // console.log(msg);
    };
  }

  static btoa(buffer:any) {
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    let binary = "";
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // State Functions
  // async handlePlayPauseReplay() {
  //   this.#isError = false;
  //   console.log("lklklklklkllklklklklklklkl", this.isReplay, this.startTimeStamp, this.isPlaying, this.#isLive);

  //   if (this.isReplay) {
  //     if (this.startTimeStamp > 0) {
  //       try {
  //         await this.seek(this.startTimeStamp);
  //         this.isPlaying = true;
  //         this.isReplay = false;
  //       } catch (error) {
  //         this.#isError = true;
  //         this.#errorMessage = "Failed to replay.";
  //       }
  //     } else {
  //       this.#isError = true;
  //       this.#errorMessage = "Invalid Start Time.";
  //     }
  //   } else if (this.isPlaying) {
  //     if (this.#isLive) {
  //       this.stop();
  //       this.start(this.siteId, this.channelId, this.currentTimeStamp);
  //       this.#isLive = false;
  //       try {
  //         await this.pause();
  //       } catch (error) {
  //         this.#isError = true;
  //         this.#errorMessage = "Failed to pause.";
  //       }
  //     } else {
  //       try {
  //         await this.pause();
  //       } catch (error) {
  //         this.#isError = true;
  //         this.#errorMessage = "Failed to pause.";
  //       }
  //     }
  //     this.isPlaying = false;
  //   } else if (!this.isPlaying) {
  //     await this.resume();
  //     this.isPlaying = true;
  //   }

  //   setTimeout(() => {
  //     this.dispatchEvent(
  //       new CustomEvent("onPlayPauseReplay", {
  //         detail: {
  //           isPlaying: this.isPlaying,
  //           error: this.#isError ? new VideoneticsRTCError(this.#errorMessage) : null,
  //         },
  //       })
  //     );
  //   }, 500);
  // }

  // async handleGoLive() {
  //   this.stop();

  // }
}