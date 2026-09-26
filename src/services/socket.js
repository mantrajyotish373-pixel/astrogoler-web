import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/api";

let socket = null;
let currentRoomSessionId = null;
let heartbeatInterval = null;
const listeners = {
  incomingRequest: [],
  incomingCallRequest: [],
  callAccepted: [],
  callRejected: [],
  callEnded: [],
  peerMediaStateChanged: [],
  receiveMessage: [],
  timerTick: [],
  walletWarning: [],
  userTyping: [],
  chatEnded: [],
};



/**
 * Audio Synthesizer for incoming request alert (works without any external mp3 file)
 */
export const playNotificationSound = () => {
  // Completely disabled - no tung-tung sound
  return;
};

/**
 * Normalizes user details safely from any backend payload structure
 */
export const extractUserData = (data) => {
  if (!data) return { name: "Client User" };

  // Handle nested session or response objects
  const sessionObj = data.session || data.data || data;
  const userObj = (typeof sessionObj.user === "object" && sessionObj.user)
    || (typeof data.user === "object" && data.user)
    || (typeof data.userId === "object" && data.userId)
    || (typeof data.client === "object" && data.client)
    || (typeof data.userData === "object" && data.userData)
    || {};

  const constructedFullName = (userObj.firstname || userObj.first_name || data.firstname)
    ? `${userObj.firstname || userObj.first_name || data.firstname || ""} ${userObj.lastname || userObj.last_name || data.lastname || ""}`.trim()
    : "";

  const rawName =
    userObj.name ||
    userObj.fullName ||
    userObj.full_name ||
    constructedFullName ||
    userObj.userName ||
    userObj.user_name ||
    userObj.username ||
    userObj.displayName ||
    data.name ||
    data.fullName ||
    data.full_name ||
    data.userName ||
    data.user_name ||
    data.username ||
    data.clientName ||
    data.senderName;

  const userIdStr = typeof userObj._id === "string" ? userObj._id : typeof data.userId === "string" ? data.userId : typeof data.user === "string" ? data.user : "";
  const phone = userObj.phone || data.phone || "";

  const fallbackName = phone ? `User (${phone})` : (userIdStr ? `User #${String(userIdStr).slice(-4)}` : "Client User");
  const name = rawName && typeof rawName === "string" && rawName.trim() && rawName.trim() !== "Client User" ? rawName.trim() : fallbackName;

  const avatar =
    userObj.profileImage ||
    userObj.avatar ||
    userObj.profilePic ||
    userObj.image ||
    userObj.photo ||
    data.profileImage ||
    data.avatar ||
    data.userAvatar ||
    data.profilePic ||
    data.image ||
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80";

  const dob = userObj.dob || userObj.dateofbirth || userObj.dateOfBirth || userObj.birthDate || data.dob || data.dateofbirth || data.dateOfBirth || data.birthDate || "Not Specified";
  const tob = userObj.tob || userObj.timeofbirth || userObj.timeOfBirth || userObj.birthTime || data.tob || data.timeofbirth || data.timeOfBirth || data.birthTime || "Not Specified";
  const pob = userObj.pob || userObj.placeofbirth || userObj.placeOfBirth || userObj.birthPlace || data.pob || data.placeofbirth || data.placeOfBirth || data.birthPlace || "Not Specified";
  const topic = userObj.topic || userObj.consultationTopic || data.topic || data.consultationTopic || data.subject || "Astrology Consultation";
  const gender = userObj.gender || data.gender || "Not Specified";

  return {
    _id: userObj._id || userObj.id || userIdStr || data.userId || "",
    name,
    avatar,
    dob,
    tob,
    pob,
    topic,
    gender
  };
};

/**
 * Safely extracts Astrologer MongoDB ID from any storage key or JWT token
 */
export const getAstroId = () => {
  try {
    const keys = ["astrologerUser", "user", "astrologer", "userData", "profile"];
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          const parsed = JSON.parse(val);
          const id = parsed._id || parsed.id || parsed.astrologerId || parsed.userId;
          if (id) return String(id);
        } catch {
          if (typeof val === "string" && val.length > 10) return val;
        }
      }
    }
    const directId = localStorage.getItem("astrologerId") || localStorage.getItem("userId") || localStorage.getItem("id");
    if (directId) return String(directId);

    // Fallback: parse JWT token
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    if (token && token.includes(".")) {
      const payloadBase64 = token.split(".")[1];
      if (payloadBase64) {
        const decoded = JSON.parse(atob(payloadBase64));
        const id = decoded.id || decoded._id || decoded.userId || decoded.astrologerId;
        if (id) return String(id);
      }
    }
  } catch (err) {
    console.error("Error extracting astro ID:", err);
  }
  return "";
};

/**
 * Helper to emit all possible room registration variations on Socket.io connection
 */
const emitAstroRegistration = (s, astroId) => {
  if (!s || !astroId) return;
  if (import.meta.env.DEV) {
    console.log("📡 Emitting Astrologer room registration for Astro ID:", astroId);
  }

  // Object payloads
  s.emit("register_user", { userId: astroId, astrologerId: astroId, id: astroId });
  s.emit("register_astrologer", { astrologerId: astroId, userId: astroId, id: astroId });
  s.emit("register", { userId: astroId, astrologerId: astroId, role: "astrologer" });
  s.emit("join_astrologer", { astrologerId: astroId, userId: astroId });

  // Direct string room IDs
  s.emit("register", astroId);
  s.emit("join", astroId);
  s.emit("join", `astro_${astroId}`);
  s.emit("join", `user_${astroId}`);
  s.emit("join", `astrologer_${astroId}`);
  s.emit("join", `room_${astroId}`);

  s.emit("subscribe", astroId);
  s.emit("subscribe", `astro_${astroId}`);
  s.emit("subscribe", `user_${astroId}`);
};

/**
 * Initializes and connects socket client for Astrologer
 */
export const connectSocket = () => {
  const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
  const astroId = getAstroId();

  if (socket) {
    if (socket.connected && astroId) {
      emitAstroRegistration(socket, astroId);
    }
    return socket;
  }

  if (import.meta.env.DEV) {
    console.log("🔌 Initializing socket connection for Astro ID:", astroId);
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: {
      token,
      role: "astrologer",
      userId: astroId,
      astrologerId: astroId,
    },
    query: {
      token,
      role: "astrologer",
      userId: astroId,
      astrologerId: astroId,
    },
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    const currentAstroId = getAstroId();
    if (import.meta.env.DEV) {
      console.log("⚡ Socket.io connected to backend:", socket.id, "Astro ID:", currentAstroId);
    }

    if (currentAstroId) {
      emitAstroRegistration(socket, currentAstroId);
      
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (socket && socket.connected) {
          socket.emit("presence:heartbeat");
          if (import.meta.env.DEV) {
            console.log("📡 Emitted presence:heartbeat to server");
          }
        }
      }, 10000);
    }

    if (currentRoomSessionId) {
      if (import.meta.env.DEV) {
        console.log("⚡ Auto re-joining active session room:", currentRoomSessionId);
      }
      socket.emit("join_session", { sessionId: currentRoomSessionId, roomId: currentRoomSessionId, chatId: currentRoomSessionId });
      socket.emit("join_call_room", { sessionId: currentRoomSessionId, roomId: currentRoomSessionId });
      socket.emit("join_room", { sessionId: currentRoomSessionId, roomId: currentRoomSessionId });
      socket.emit("join", currentRoomSessionId);
      socket.emit("join_chat", { sessionId: currentRoomSessionId });
    }
  });

  // Catch-all listener to ensure NO backend event is ever dropped or missed
  socket.onAny((eventName, data) => {
    // console.log("🔥 [Socket Catch-All Event Received]:", eventName, data);
    // If event name explicitly contains call/video/audio keywords (and not chat) and isn't already handled
    const evtLower = String(eventName || "").toLowerCase();
    // Exclude status, state, typing, ringing, and acknowledgment events from triggering the incoming call modal
    const excludedKeywords = ["accepted", "ended", "rejected", "sent", "state", "ringing", "media", "peer", "typing", "presence", "heartbeat"];
    const isExcluded = excludedKeywords.some(keyword => evtLower.includes(keyword));
    if (
      (evtLower.includes("call") || evtLower.includes("video") || evtLower.includes("audio")) &&
      !evtLower.includes("chat") &&
      !isExcluded
    ) {
      if (data && (data.callId || data.sessionId || data._id || data.id || data.user || data.data)) {
        handleIncomingCall(data);
      }
    }
  });

  // Incoming Chat Request Event Handler
  const handleIncoming = (data) => {
    console.log("🔔 Incoming Chat Request received on socket:", data);
    
    const sessionData = data.data || data.session || data;
    const validSessionId = sessionData.sessionId || sessionData._id || sessionData.id || data.sessionId || data._id || "";
    const userDetails = extractUserData(data);

    const normalizedData = {
      sessionId: validSessionId,
      _id: validSessionId,
      user: userDetails,
      perMinuteRate: Number(sessionData.perMinuteRate || data.perMinuteRate || data.rate || 10) || 10,
      requestedAt: sessionData.createdAt || data.createdAt || new Date().toISOString()
    };

    // playNotificationSound(); // Disabled old tung-tung chime in favor of 30s ringtone
    listeners.incomingRequest.forEach((fn) => fn(normalizedData));
  };

  const requestEvents = [
    "incoming_chat_request",
    "incoming_request",
    "chat_request",
    "new_chat_request",
    "request_received",
    "user_chat_request",
    "new_request",
    "request_chat",
    "initiate_chat"
  ];

  requestEvents.forEach((evt) => {
    socket.on(evt, handleIncoming);
  });


  // Incoming Call Request Event Handler (Audio / Video)
  const handleIncomingCall = (data) => {
    if (!data) return;
    console.log("📞 Incoming Call Request received on socket:", data);

    const sessionObj = data.data || data.session || data.call || data;
    const validId = sessionObj.callSessionId || sessionObj.callId || sessionObj.sessionId || sessionObj._id || sessionObj.id || data.callSessionId || data.callId || data.sessionId || data._id || data.id || "";

    const userDetails = extractUserData(data);
    const rawType = String(sessionObj.callType || sessionObj.type || data.callType || data.type || "AUDIO").toUpperCase();
    const callType = rawType.includes("VIDEO") ? "VIDEO" : "AUDIO";
    const agoraObj = sessionObj.agora || data.agora || {};

    const normalizedData = {
      callId: validId,
      sessionId: validId,
      _id: validId,
      user: userDetails,
      callType: callType,
      perMinuteRate: Number(sessionObj.perMinuteRate || sessionObj.rate || sessionObj.ratePerMinute || data.perMinuteRate || data.rate || 25) || 25,
      channelName: sessionObj.channelName || data.channelName || agoraObj.channelName || `video_${validId}`,
      rtcToken: sessionObj.rtcToken || sessionObj.token || data.rtcToken || data.token || agoraObj.token || "",
      appId: sessionObj.appId || data.appId || agoraObj.appId || "",
      agora: agoraObj,
      requestedAt: sessionObj.createdAt || data.createdAt || new Date().toISOString()
    };

    // playNotificationSound(); // Disabled old tung-tung chime in favor of 30s ringtone
    listeners.incomingCallRequest.forEach((fn) => fn(normalizedData));
  };


  // Comprehensive array of all possible socket event names backend might emit when user requests call
  const callRequestEvents = [
    "incoming_call_request",
    "user_request_call",
    "request_call",
    "incoming_call",
    "call_request",
    "new_call_request",
    "call_incoming",
    "incoming_video_call",
    "incoming_audio_call",
    "video_call_request",
    "audio_call_request",
    "call_received",
    "new_video_session",
    "incoming_video_session",
    "receive_call",
    "call",
    "video_session_request",
    "initiate_call",
    "call_initiated",
    "user_call_request"
  ];
  callRequestEvents.forEach((evt) => {
    socket.on(evt, handleIncomingCall);
  });


  // Call Accepted Event (Emitted by backend when accepted)
  const handleCallAccepted = (data) => {
    console.log("✅ Call Accepted on socket:", data);
    listeners.callAccepted.forEach((fn) => fn(data));
  };

  ["call_accepted", "accept_call_success", "call_started"].forEach((evt) => {
    socket.on(evt, handleCallAccepted);
  });

  // Call Rejected / Missed Event
  const handleCallRejected = (data) => {
    console.log("❌ Call Rejected / Timeout on socket:", data);
    listeners.callRejected.forEach((fn) => fn(data));
  };

  ["call_rejected", "call_missed", "call_timeout", "reject_call_success"].forEach((evt) => {
    socket.on(evt, handleCallRejected);
  });

  // Call Session Ended Event
  const handleCallEnded = (data) => {
    console.log("🔴 Call Ended Event Received:", data);
    listeners.callEnded.forEach((fn) => fn(data));
  };

  ["call_ended", "end_call_session", "call_end", "user_ended_call", "call_ended_insufficient_funds"].forEach((evt) => {
    socket.on(evt, handleCallEnded);
  });

  // Receive Message in Chat Room (Listens to all message event names backend might emit)
  const recentMsgIds = new Set();
  const handleMsgReceived = (message) => {
    if (!message) return;
    const extractId = (obj) => {
      if (!obj) return "";
      if (typeof obj === "string" || typeof obj === "number") return String(obj);
      return String(obj.sessionId || obj.chatId || obj.roomId || obj._id || obj.id || (obj.session && (typeof obj.session === "object" ? (obj.session._id || obj.session.id) : obj.session)) || "");
    };

    const msgSessionId = extractId(message.sessionId || message.chatId || message.roomId || message.session || message);
    const currentCleanId = extractId(currentRoomSessionId);

    if (currentCleanId && msgSessionId && String(msgSessionId) !== String(currentCleanId)) {
      console.log(`🗑️ Discarding message meant for session ${msgSessionId} (Current session is ${currentCleanId})`);
      return;
    }

    const uniqueMsgKey = String(message._id || message.id || message.clientMessageId || "");
    if (uniqueMsgKey && recentMsgIds.has(uniqueMsgKey)) {
      return;
    }
    if (uniqueMsgKey) {
      recentMsgIds.add(uniqueMsgKey);
      setTimeout(() => recentMsgIds.delete(uniqueMsgKey), 3000);
    }

    console.log("💬 Message Received on socket:", message);
    listeners.receiveMessage.forEach((fn) => fn(message));
  };
  socket.on("receive_message", handleMsgReceived);
  socket.on("message", handleMsgReceived);
  socket.on("new_message", handleMsgReceived);
  socket.on("chat_message", handleMsgReceived);
  socket.on("receive-message", handleMsgReceived);
  socket.on("receive_msg", handleMsgReceived);

  // Timer Tick & Billing Update Event
  socket.on("timer_tick", (data) => {
    console.log("⏱️ Timer Tick:", data);
    listeners.timerTick.forEach((fn) => fn(data));
  });

  // Wallet Low Warning Event
  socket.on("wallet_warning", (data) => {
    console.log("⚠️ Wallet Warning:", data);
    listeners.walletWarning.forEach((fn) => fn(data));
  });

  // Peer Media State Changed Event (Mute / Unmute indicators)
  socket.on("peer_media_state_changed", (data) => {
    console.log("🎤 Peer Media State Changed:", data);
    listeners.peerMediaStateChanged.forEach((fn) => fn(data));
  });

  // User Typing Indicator Status Event
  const handleUserTyping = (data) => {
    console.log("⌨️ User Typing Event Received:", data);
    listeners.userTyping.forEach((fn) => fn(data));
  };
  socket.on("user_typing", handleUserTyping);
  socket.on("typing_status", handleUserTyping);
  socket.on("typing", handleUserTyping);
  socket.on("user-typing", handleUserTyping);


  // Chat Session Ended Event (Listens to all backend chat ended event variations)
  const handleChatEnded = (data) => {
    console.log("🔴 Chat Session Ended Event Received:", data);
    listeners.chatEnded.forEach((fn) => fn(data));
  };

  socket.on("chat_ended", handleChatEnded);
  socket.on("session_ended", handleChatEnded);
  socket.on("end_chat", handleChatEnded);
  socket.on("end_session", handleChatEnded);
  socket.on("chat_end", handleChatEnded);
  socket.on("session_end", handleChatEnded);
  socket.on("chat_completed", handleChatEnded);
  socket.on("user_ended_chat", handleChatEnded);
  socket.on("chat_closed", handleChatEnded);
  socket.on("session_closed", handleChatEnded);
  socket.on("user_left", handleChatEnded);
  socket.on("leave_chat", handleChatEnded);

  socket.on("status_change", (data) => {
    if (data && (data.status === "COMPLETED" || data.status === "ENDED" || data.status === "REJECTED" || data.status === "CLOSED")) {
      handleChatEnded(data);
    }
  });

  socket.on("session_update", (data) => {
    if (data && (data.status === "COMPLETED" || data.status === "ENDED" || data.status === "REJECTED" || data.status === "CLOSED")) {
      handleChatEnded(data);
    }
  });


  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  return socket;
};


/**
 * Disconnect socket client
 */
export const disconnectSocket = () => {
  currentRoomSessionId = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join specific chat room
 */
export const joinChatRoom = (sessionId) => {
  currentRoomSessionId = sessionId;
  const s = connectSocket();
  if (s) {
    console.log("🚪 Joining chat room for session:", sessionId);
    // Object payloads
    s.emit("join_session", { sessionId, roomId: sessionId, chatId: sessionId, room: sessionId });
    s.emit("join_room", { sessionId, roomId: sessionId, room: sessionId });
    s.emit("join_chat", { sessionId, roomId: sessionId });

    // String payloads (Crucial for Socket.io backends expecting string room ID)
    if (typeof sessionId === "string" || typeof sessionId === "number") {
      const cleanId = String(sessionId);
      s.emit("join_session", cleanId);
      s.emit("join_session", `session_${cleanId}`);
      s.emit("join_session", `room_${cleanId}`);
      s.emit("join_room", cleanId);
      s.emit("join_room", `session_${cleanId}`);
      s.emit("join_room", `room_${cleanId}`);
      s.emit("join", cleanId);
      s.emit("join", `session_${cleanId}`);
      s.emit("join", `room_${cleanId}`);
      s.emit("subscribe", cleanId);
      s.emit("subscribe", `session_${cleanId}`);
    }
  }
};

/**
 * Join specific call room
 */
export const joinCallRoom = (sessionId) => {
  currentRoomSessionId = sessionId;
  const s = connectSocket();
  if (s) {
    console.log("🚪 Joining call room for session:", sessionId);
    s.emit("join_call_room", { sessionId, roomId: sessionId, callId: sessionId });
    s.emit("join_room", { sessionId, roomId: sessionId });
    s.emit("join", sessionId);
    if (typeof sessionId === "string" || typeof sessionId === "number") {
      const cleanId = String(sessionId);
      s.emit("join", `call_${cleanId}`);
      s.emit("join_room", `call_${cleanId}`);
      s.emit("join_session", `call_${cleanId}`);
    }
  }
};

/**
 * Send real-time chat message
 */
export const sendChatMessage = (messageData) => {
  const s = connectSocket();
  if (s) {
    console.log("📤 Emitting send_message via socket:", messageData);
    
    const cleanSessionId = String(messageData.sessionId || messageData.chatId || messageData.roomId || "");
    const cleanSenderId = String(messageData.senderId || messageData.astrologerId || messageData.sender || "");
    const cleanText = String(messageData.text || messageData.message || messageData.content || "");
    const clientMessageId = String(messageData.clientMessageId || messageData.tempId || messageData.id || "");

    const specPayload = {
      sessionId: cleanSessionId,
      chatId: cleanSessionId,
      roomId: cleanSessionId,
      senderId: cleanSenderId,
      astrologerId: cleanSenderId,
      senderType: "ASTROLOGER",
      role: "astrologer",
      text: cleanText,
      message: cleanText,
      content: cleanText,
      clientMessageId: clientMessageId || undefined,
      tempId: clientMessageId || undefined
    };

    s.emit("send_message", specPayload);
  }
};


/**
 * Emit typing indicator
 */
export const emitTyping = (sessionId, isTyping) => {
  const s = connectSocket();
  if (s) {
    const payload = { 
      sessionId, 
      chatId: sessionId,
      isTyping: Boolean(isTyping), 
      senderType: "ASTROLOGER", 
      role: "astrologer" 
    };
    s.emit("typing_status", payload);
    s.emit("typing", payload);
    s.emit("astro_typing", payload);
    s.emit("astrologer_typing", payload);
  }
};

/**
 * Accept incoming chat request
 */
export const acceptChatRequest = (sessionId) => {
  const s = connectSocket();
  if (s) {
    console.log("✅ Emitting accept_chat_request via socket:", sessionId);
    s.emit("accept_chat_request", { sessionId, chatId: sessionId });
    s.emit("accept_request", { sessionId, chatId: sessionId });
    s.emit("accept_chat", { sessionId, chatId: sessionId });

    if (typeof sessionId === "string" || typeof sessionId === "number") {
      const cleanId = String(sessionId);
      s.emit("accept_chat_request", cleanId);
      s.emit("accept_request", cleanId);
    }
  }
};

/**
 * Reject incoming chat request
 */
export const rejectChatRequest = (sessionId) => {
  const s = connectSocket();
  if (s) {
    s.emit("reject_request", { sessionId });
    s.emit("reject_chat_request", { sessionId });
  }
};

/**
 * End chat session
 */
export const endChatSession = (sessionId) => {
  currentRoomSessionId = null;
  const s = connectSocket();
  if (s) {
    const cleanId = String(sessionId);
    const payload = { sessionId: cleanId, chatId: cleanId, _id: cleanId, id: cleanId };

    console.log("🔴 Emitting endChatSession via socket:", payload);
    s.emit("end_chat", payload);
    s.emit("end_session", payload);
    s.emit("chat_ended", payload);
    s.emit("session_ended", payload);
    s.emit("leave_chat", payload);

    s.emit("end_chat", cleanId);
    s.emit("end_session", cleanId);
    s.emit("chat_ended", cleanId);
    s.emit("session_ended", cleanId);
  }
};

/**
 * Subscribe to specific Socket events
 */
export const subscribeSocketEvent = (event, callback) => {
  if (listeners[event]) {
    listeners[event].push(callback);
  }
  return () => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter((fn) => fn !== callback);
    }
  };
};

/**
 * Helper to simulate an incoming test request (for offline / frontend testing)
 */
export const triggerDemoIncomingRequest = () => {
  const demoData = {
    sessionId: "demo_session_" + Date.now(),
    user: {
      name: "Rahul Sharma",
      avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80",
      dob: "14 May 1996",
      tob: "08:45 AM",
      pob: "Dehradun, Uttarakhand",
      topic: "Career & Job Growth",
      gender: "Male"
    },
    perMinuteRate: 20,
    minMinutes: 3,
    requestedAt: new Date().toISOString()
  };
  // playNotificationSound(); // Disabled old tung-tung chime in favor of 30s ringtone
  listeners.incomingRequest.forEach((fn) => fn(demoData));
  return demoData;
};

/**
 * Accept incoming audio/video call request
 */
export const acceptCallRequest = (callId, callType = "AUDIO") => {
  const s = connectSocket();
  if (s) {
    const cleanId = String(callId);
    console.log("✅ Emitting accept_call_request via socket:", cleanId);
    s.emit("accept_call_request", { sessionId: cleanId, callId: cleanId, callType });
    s.emit("join_call_room", { sessionId: cleanId });
    s.emit("accept_call", { sessionId: cleanId });
  }
};

/**
 * Reject incoming audio/video call request
 */
export const rejectCallRequest = (callId, reason = "Astrologer is currently busy on another call") => {
  const s = connectSocket();
  if (s) {
    const cleanId = String(callId);
    console.log("❌ Emitting reject_call_request via socket:", cleanId);
    s.emit("reject_call_request", { sessionId: cleanId, callId: cleanId, reason });
    s.emit("reject_call", { sessionId: cleanId, reason });
  }
};

/**
 * End active call session
 */
export const endCallSession = (callId) => {
  const s = connectSocket();
  if (s) {
    const cleanId = String(callId);
    console.log("🔴 Emitting end_call_session via socket:", cleanId);
    s.emit("end_call_session", { sessionId: cleanId, callId: cleanId });
    s.emit("end_call", { sessionId: cleanId, callId: cleanId });
  }
};

/**
 * Sync media state changes (mic / camera toggles) with peer client
 */
export const emitMediaStateChange = (sessionId, isAudioMuted, isVideoMuted) => {
  const s = connectSocket();
  if (s) {
    const cleanId = String(sessionId);
    console.log("🎙️ Emitting media_state_change:", cleanId, { isAudioMuted, isVideoMuted });
    s.emit("media_state_change", {
      sessionId: cleanId,
      isAudioMuted,
      isVideoMuted,
      senderType: "ASTROLOGER"
    });
  }
};

/**
 * Helper to simulate an incoming Audio or Video Call request (for offline / frontend testing)
 */
export const triggerDemoIncomingCallRequest = (callType = "VIDEO") => {
  const type = callType.toUpperCase() === "AUDIO" ? "AUDIO" : "VIDEO";
  const demoCallData = {
    callId: "demo_call_" + Date.now(),
    sessionId: "demo_call_" + Date.now(),
    user: {
      name: type === "VIDEO" ? "Ananya Verma" : "Karan Sharma",
      avatar: type === "VIDEO" 
        ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      dob: "18 Aug 1997",
      tob: "03:15 PM",
      pob: "Chandigarh, India",
      topic: type === "VIDEO" ? "Face Reading & Kundli Analysis" : "Love & Relationship Guidance",
      gender: type === "VIDEO" ? "Female" : "Male"
    },
    callType: type,
    perMinuteRate: type === "VIDEO" ? 40 : 25,
    channelName: "demo_room_" + Math.floor(Math.random() * 1000),
    agora: {
      token: "",
      appId: import.meta.env.VITE_AGORA_APP_ID || "af89ac0f87f4412ea75f23aba4717e04",
      channelName: "demo_room_" + Math.floor(Math.random() * 1000),
      uid: 0
    },
    requestedAt: new Date().toISOString()
  };
  // playNotificationSound(); // Disabled old tung-tung chime in favor of 30s ringtone
  listeners.incomingCallRequest.forEach((fn) => fn(demoCallData));
  return demoCallData;
};


