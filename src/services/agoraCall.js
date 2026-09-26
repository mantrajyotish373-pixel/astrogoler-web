import AgoraRTC from "agora-rtc-sdk-ng";
AgoraRTC.setLogLevel(3);

// Agora RTC Client Singleton Instance
let rtcClient = null;
let localAudioTrack = null;
let localVideoTrack = null;

let isMicMuted = false;
let isCameraOff = false;

// Event callbacks object
const callEvents = {
  onRemoteUserJoined: null,
  onRemoteUserLeft: null,
  onRemoteTrackPublished: null,
  onError: null,
};

/**
 * Initializes and joins an Agora RTC Channel for Audio or Video calls
 */
export const joinAgoraCallChannel = async ({
  appId,
  channelName,
  token = null,
  uid = null,
  callType = "AUDIO",
  callbacks = {}
}) => {
  try {
    const finalAppId = appId || import.meta.env.VITE_AGORA_APP_ID || "af89ac0f87f4412ea75f23aba4717e04";
    const numericUid = uid !== undefined && uid !== null ? Number(uid) : null;
    
    console.log(`[AGORA] init - type: ${callType}, channel: ${channelName}, uid: ${numericUid}, appId: ${finalAppId}`);

    // Store callbacks
    callEvents.onRemoteUserJoined = callbacks.onRemoteUserJoined || null;
    callEvents.onRemoteUserLeft = callbacks.onRemoteUserLeft || null;
    callEvents.onRemoteTrackPublished = callbacks.onRemoteTrackPublished || null;
    callEvents.onError = callbacks.onError || null;

    // Reset mute flags
    isMicMuted = false;
    isCameraOff = false;

    // Create client instance if not exists
    if (!rtcClient) {
      rtcClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    } else {
      // Remove previous listeners to prevent duplicates
      rtcClient.removeAllListeners("user-published");
      rtcClient.removeAllListeners("user-unpublished");
      rtcClient.removeAllListeners("user-left");
      rtcClient.removeAllListeners("user-joined");
    }

    const client = rtcClient;

    // Handle Safari/Mobile Autoplay restrictions
    AgoraRTC.onAutoplayFailed = () => {
      console.warn("[AGORA] Autoplay blocked by browser policy. User gesture required to resume audio.");
    };

    // Register Remote Event Listeners
    client.on("user-joined", (user) => {
      console.log(`[AGORA] remote-user-joined: ${user.uid}`);
      if (callEvents.onRemoteUserJoined) {
        callEvents.onRemoteUserJoined(user);
      }
    });

    client.on("user-published", async (user, mediaType) => {
      if (mediaType === "audio") {
        console.log(`[AGORA] remote-audio-published by uid: ${user.uid}`);
      } else if (mediaType === "video") {
        console.log(`[AGORA] remote-video-published by uid: ${user.uid}`);
      }

      if (client) {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          console.log(`[AGORA] remote-audio-subscribed for uid: ${user.uid}`);
        } else if (mediaType === "video") {
          console.log(`[AGORA] remote-video-subscribed for uid: ${user.uid}`);
        }
      }

      if (mediaType === "audio" && user.audioTrack) {
        try {
          user.audioTrack.play();
          console.log(`[AGORA] remote-audio-playing for uid: ${user.uid}`);
        } catch (e) {
          console.error(`[AGORA] Audio playback error for uid: ${user.uid}`, e);
        }
      }

      if (callEvents.onRemoteTrackPublished) {
        callEvents.onRemoteTrackPublished(user, mediaType);
      }
    });

    client.on("user-left", (user, reason) => {
      console.log(`[AGORA] remote-user-left: ${user.uid}, reason: ${reason}`);
      if (callEvents.onRemoteUserLeft) {
        callEvents.onRemoteUserLeft(user, reason);
      }
    });

    // STEP 1: Request mic/camera permissions FIRST
    if (callType === "VIDEO") {
      try {
        [localAudioTrack, localVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          { encoderConfig: "speech_standard" },
          { encoderConfig: "720p_1", facingMode: "user" }
        );
        console.log("[AGORA] local-audio-created");
        console.log("[AGORA] local-video-created");
      } catch (mediaErr) {
        console.warn("⚠️ Camera/Mic failed, falling back to audio-only:", mediaErr.message);
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
        localVideoTrack = null;
        console.log("[AGORA] local-audio-created (audio-only fallback)");
      }
    } else {
      localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "speech_standard" });
      localVideoTrack = null;
      console.log("[AGORA] local-audio-created");
    }

    // STEP 2: Join Agora channel (without logging token)
    console.log(`[AGORA] join-start - channel: ${channelName}, uid: ${numericUid}`);
    const resolvedToken = (token && !String(token).startsWith("mock_")) ? token : null;
    const joinedUid = await client.join(
      finalAppId,
      channelName,
      resolvedToken,
      numericUid
    );
    console.log(`[AGORA] join-success - assigned UID: ${joinedUid}`);

    // STEP 3: Publish local tracks
    const tracksToPublish = [localAudioTrack, localVideoTrack].filter(Boolean);
    if (tracksToPublish.length > 0) {
      await client.publish(tracksToPublish);
      if (localAudioTrack) console.log("[AGORA] local-audio-published");
      if (localVideoTrack) console.log("[AGORA] local-video-published");
    }

    return {
      uid: joinedUid,
      localAudioTrack,
      localVideoTrack,
      client: rtcClient
    };

  } catch (err) {
    console.error("[AGORA] Failed to join Agora RTC Channel:", err);
    if (callEvents.onError) {
      callEvents.onError(err);
    }
    return {
      uid: uid || null,
      localAudioTrack: null,
      localVideoTrack: null,
      error: err
    };
  }
};

/**
 * Plays local video track inside a DOM container element or ref
 */
export const playLocalVideoTrack = (domElement) => {
  if (localVideoTrack && domElement) {
    try {
      localVideoTrack.play(domElement);
      console.log("[AGORA] local-video-playing in DOM element");
    } catch (err) {
      console.error("[AGORA] Error playing local video track:", err);
    }
  }
};

/**
 * Plays remote user video track inside a DOM container element or ref
 */
export const playRemoteVideoTrack = (remoteUser, domElement) => {
  if (remoteUser && remoteUser.videoTrack && domElement) {
    try {
      remoteUser.videoTrack.play(domElement);
      console.log(`[AGORA] remote-video-playing for uid: ${remoteUser.uid}`);
    } catch (err) {
      console.error(`[AGORA] Error playing remote video track for uid: ${remoteUser.uid}:`, err);
    }
  }
};

/**
 * Toggles Microphone Mute / Unmute
 */
export const toggleMicrophoneMute = async () => {
  if (localAudioTrack) {
    isMicMuted = !isMicMuted;
    await localAudioTrack.setEnabled(!isMicMuted);
    console.log(`[AGORA] Microphone ${isMicMuted ? "MUTED" : "UNMUTED"}`);
    return isMicMuted;
  }
  return false;
};

/**
 * Toggles Camera Video On / Off
 */
export const toggleCameraState = async () => {
  if (localVideoTrack) {
    isCameraOff = !isCameraOff;
    await localVideoTrack.setEnabled(!isCameraOff);
    console.log(`[AGORA] Camera ${isCameraOff ? "DISABLED" : "ENABLED"}`);
    return isCameraOff;
  }
  return false;
};

/**
 * Leaves Agora RTC channel and releases local tracks
 */
export const leaveAgoraCallChannel = async () => {
  try {
    console.log("[AGORA] leave");

    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      localAudioTrack = null;
    }

    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
      localVideoTrack = null;
    }

    if (rtcClient) {
      rtcClient.removeAllListeners();
      await rtcClient.leave().catch(() => null);
      rtcClient = null;
    }

    console.log("[AGORA] cleanup complete");
  } catch (err) {
    console.error("[AGORA] Error leaving Agora channel:", err);
  }
};

/**
 * Switch current local microphone device
 */
export const switchMicrophone = async (deviceId) => {
  if (localAudioTrack) {
    await localAudioTrack.setDevice(deviceId);
    console.log(`[AGORA] Switched microphone to: ${deviceId}`);
    return true;
  }
  return false;
};

/**
 * Switch current local camera device
 */
export const switchCamera = async (deviceId) => {
  if (localVideoTrack) {
    await localVideoTrack.setDevice(deviceId);
    console.log(`[AGORA] Switched camera to: ${deviceId}`);
    return true;
  }
  return false;
};

/**
 * Retrieve active audio and video tracks
 */
export const getLocalTracks = () => {
  return {
    localAudioTrack,
    localVideoTrack
  };
};
