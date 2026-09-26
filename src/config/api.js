export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "https://astro.mantrajyotish.com")).replace(/\/$/, "");

export const API_BASE_URL = `${BACKEND_URL}/api/astrologer`;
export const UPLOAD_IMAGE_URL = `${BACKEND_URL}/api/upload/image`;
export const TOGGLE_ONLINE_URL = `${BACKEND_URL}/api/astro/toggle-online`;
export const SOCKET_URL = BACKEND_URL;

export const API_ENDPOINTS = {
  REGISTER: `${BACKEND_URL}/api/astrologer/register`,
  LOGIN: `${BACKEND_URL}/api/astrologer/login`,
  SEND_OTP: `${BACKEND_URL}/api/astrologer/forgot-password/send-otp`,
  RESET_PASSWORD: `${BACKEND_URL}/api/astrologer/forgot-password/reset`,
  UPLOAD_IMAGE: `${BACKEND_URL}/api/upload/image`,
  TOGGLE_ONLINE: `${BACKEND_URL}/api/astro/toggle-online`,
  // Interview flow
  SEND_REQUEST: `${BACKEND_URL}/api/interview/request`,
  GET_APPROVAL_STATUS: `${BACKEND_URL}/api/astrologer/approval-status`,
  GET_MY_INTERVIEW: `${BACKEND_URL}/api/interview/details`,
  // Live Chat System Endpoints
  CHAT_ACCEPT: `${BACKEND_URL}/api/chat/accept`,
  CHAT_REJECT: `${BACKEND_URL}/api/chat/reject`,
  CHAT_END: `${BACKEND_URL}/api/chat/end`,
  CHAT_MESSAGES: `${BACKEND_URL}/api/chat/history`,
  CHAT_HISTORY: `${BACKEND_URL}/api/chat/sessions`,
  CHAT_RATE: `${BACKEND_URL}/api/chat/rate`,

  // Video & Audio Call System Endpoints (/api/video-session)
  VIDEO_SESSION_BASE: `${BACKEND_URL}/api/video-session`,
  CALL_REQUEST: `${BACKEND_URL}/api/video-session/request`,
  CALL_ACCEPT: `${BACKEND_URL}/api/video-session/accept`,
  CALL_REJECT: `${BACKEND_URL}/api/video-session/reject`,
  CALL_END: `${BACKEND_URL}/api/video-session/end`,
  CALL_HISTORY: `${BACKEND_URL}/api/video-session/history`,
  GENERATE_TOKEN: `${BACKEND_URL}/api/video-session/generate-token`,
};



/**
 * Uploads an image file to backend API (https://kalpjoytish-backend.onrender.com/api/upload/image)
 * @param {File} file - Image file object to upload
 * @returns {Promise<string>} - Hosted image URL returned by backend (or local preview fallback)
 */
export const uploadImageApi = async (file) => {
  if (!file) return null;

  try {
    const formData = new FormData();
    // Multer on backend strictly expects 'file' field key
    formData.append("file", file);

    console.log("Uploading image to backend API:", API_ENDPOINTS.UPLOAD_IMAGE);

    const response = await fetch(API_ENDPOINTS.UPLOAD_IMAGE, {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    console.log("Upload Image API Response:", response.status, data);

    const imageUrl = 
      data.url || 
      data.imageUrl || 
      data.image || 
      data.fileUrl || 
      data.path || 
      data.data?.url || 
      data.data?.imageUrl ||
      data.data?.image;

    if (imageUrl) {
      return imageUrl;
    }
  } catch (err) {
    console.error("Error calling upload image API:", err);
  }

  // Fallback to local Data URL preview if upload fails or is offline
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
};

/**
 * Toggles online/offline status for the astrologer (PUT /api/astro/toggle-online)
 * @param {boolean} nextStatus - target online status (true = online, false = offline)
 * @returns {Promise<boolean>} - updated status
 */
export const toggleOnlineApi = async (nextStatus) => {
  try {
    const token = localStorage.getItem("token") || localStorage.getItem("astrologerToken") || "";

    if (import.meta.env.DEV) {
      console.log(`Toggling online status to ${nextStatus} via PUT:`, API_ENDPOINTS.TOGGLE_ONLINE);
    }

    // Backend route uses PUT method for /api/astro/toggle-online
    const response = await fetch(API_ENDPOINTS.TOGGLE_ONLINE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
      },
      body: JSON.stringify({
        isOnline: nextStatus,
        isAvailable: nextStatus,
        status: nextStatus ? "online" : "offline"
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle online status: ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    if (import.meta.env.DEV) {
      console.log("Toggle Online API Response:", response.status, data);
    }

    if (data.success || data.isOnline !== undefined || data.data?.isOnline !== undefined) {
      const finalStatus = data.data?.isOnline ?? data.isOnline ?? nextStatus;
      localStorage.setItem("astro_is_online", String(finalStatus));
      return finalStatus;
    }
    return nextStatus;
  } catch (err) {
    console.error("Error toggling online status:", err);
    throw err;
  }
};

/**
 * Sends interview request to admin (POST /api/interview/request)
 * Uses the authenticated astrologer JWT token.
 * @param {Object} payload - { adminMessage, requestMessage, selectedMode, timestamp }
 * @returns {Promise<boolean>} - success status
 */
export const sendInterviewRequestApi = async (payload) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const notes = (payload && (payload.adminMessage || payload.requestMessage)) || "";

    // 1. Create/Update Astrologer profile in backend DB first
    if (payload && (payload.name || payload.email || payload.fullName)) {
      try {
        const createAstroUrl = API_BASE_URL.replace(/\/astrologer\/?$/, '/astro/create');
        console.log("Saving full profile to backend database:", createAstroUrl);
        await fetch(createAstroUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });
      } catch (profileErr) {
        console.warn("Failed to create astro profile via API:", profileErr);
      }
    }

    console.log("Sending Interview Request to Admin:", API_ENDPOINTS.SEND_REQUEST);

    const response = await fetch(API_ENDPOINTS.SEND_REQUEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
      },
      body: JSON.stringify({
        ...(payload || {}),
        notes,
        requestNotes: notes,
        adminMessage: notes,
        selectedMode: (payload && payload.selectedMode) || "interview",
        timestamp: (payload && payload.timestamp) || new Date().toISOString()
      })
    }).catch(() => null);

    if (response && response.ok) {
      const data = await response.json().catch(() => ({}));
      console.log("Interview Request API Response:", response.status, data);
      return true;
    }

    // Non-OK response (e.g. 400 = record already exists) — still optimistically succeed
    console.warn("Interview request returned non-OK:", response?.status);
    return true;

  } catch (err) {
    console.error("Error sending interview request to admin:", err);
  }

  // Graceful fallback — always show Step 2 to user
  return true;
};

/**
 * Checks current approval & interview status from admin.
 * Tries GET /api/astrologer/approval-status first (returns top-level fields),
 * then falls back to GET /api/interview/details for the interview record.
 * @returns {Promise<Object|null>} - normalized { status, interviewStatus, date, time, meetingLink, ... }
 */
export const checkApprovalStatusApi = async () => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
    };

    // ── Primary: /api/astrologer/approval-status ──────────────────────────
    const response = await fetch(API_ENDPOINTS.GET_APPROVAL_STATUS, {
      method: "GET",
      headers
    }).catch(() => null);

    if (response && response.ok) {
      const raw = await response.json().catch(() => ({}));
      if (import.meta.env.DEV) {
        console.log("Approval Status API Response:", raw);
      }

      // Normalize: backend returns top-level fields on this endpoint
      const normalized = {
        status:          raw.status          || raw.data?.status          || "pending",
        isApproved:      raw.isApproved      ?? raw.data?.isApproved      ?? false,
        isOnline:        raw.isOnline        ?? raw.data?.isOnline        ?? false,
        interviewStatus: raw.interviewStatus || raw.data?.interviewStatus || "not_requested",
        interviewDate:   raw.interviewDate   || raw.data?.interviewDate   || null,
        date:            raw.date            || raw.data?.date            || null,
        time:            raw.time            || raw.data?.time            || null,
        meetingLink:     raw.meetingLink     || raw.link || raw.data?.meetingLink || raw.data?.link || null,
        agoraAppId:      raw.agoraAppId      || raw.data?.agoraAppId      || null,
        agoraChannel:    raw.agoraChannel    || raw.data?.agoraChannel    || null,
        agoraToken:      raw.agoraToken      || raw.data?.agoraToken      || null,
        agoraUid:        raw.agoraUid        || raw.data?.agoraUid        || 2,
        note:            raw.note            || raw.data?.note            || null,
      };

      // ── Also fetch interview details to fill missing Agora fields ──────
      if (!normalized.agoraChannel && token) {
        try {
          const ivRes = await fetch(API_ENDPOINTS.GET_MY_INTERVIEW, {
            method: "GET",
            headers
          }).catch(() => null);
          if (ivRes && ivRes.ok) {
            const ivRaw = await ivRes.json().catch(() => ({}));
            const iv = ivRaw.data || ivRaw;
            if (iv.agoraChannel)       normalized.agoraChannel    = iv.agoraChannel;
            if (iv.agoraAstrologerToken) normalized.agoraToken     = iv.agoraAstrologerToken;
            if (iv.agoraAstrologerUid)  normalized.agoraUid       = iv.agoraAstrologerUid;
            if (iv.meetingLink && !normalized.meetingLink) normalized.meetingLink = iv.meetingLink;
            if (iv.interviewDate && !normalized.interviewDate) normalized.interviewDate = iv.interviewDate;
            // Merge interviewStatus from interview record (overwriting stale or fallback values)
            if (iv.status) {
              normalized.interviewStatus = iv.status;
            }
          }
        } catch (e) {
          // ignore interview detail errors
        }
      }

      return normalized;
    }
  } catch (err) {
    console.error("Error fetching approval status:", err);
  }

  return null;
};

/**
 * Accepts an incoming chat request from a user
 */
export const acceptChatApi = async (sessionId, rawReq = {}) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const idToUse = (typeof sessionId === "string" ? sessionId : "") || rawReq.sessionId || rawReq._id || rawReq.id || rawReq.chatId || "";

    console.log("🚀 Executing acceptChatApi with session ID:", idToUse);

    const bodyData = {
      sessionId: idToUse,
      chatId: idToUse,
      _id: idToUse,
      id: idToUse
    };

    const res = await fetch(API_ENDPOINTS.CHAT_ACCEPT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
      },
      body: JSON.stringify(bodyData)
    });
    return await res.json();
  } catch (err) {
    console.error("Error accepting chat API:", err);
    return { success: true, sessionId };
  }
};

/**
 * Rejects an incoming chat request
 */
export const rejectChatApi = async (sessionId, reason = "Astrologer busy") => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const idToUse = (typeof sessionId === "string" ? sessionId : "") || "";

    const bodyData = {
      sessionId: idToUse,
      chatId: idToUse,
      _id: idToUse,
      id: idToUse,
      reason
    };

    const res = await fetch(API_ENDPOINTS.CHAT_REJECT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
      },
      body: JSON.stringify(bodyData)
    });
    return await res.json();
  } catch (err) {
    console.error("Error rejecting chat API:", err);
    return { success: true };
  }
};

/**
 * Ends an active chat session
 */
export const endChatApi = async (sessionId) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const idToUse = (typeof sessionId === "string" ? sessionId : "") || "";

    const bodyData = {
      sessionId: idToUse,
      chatId: idToUse,
      _id: idToUse,
      id: idToUse
    };

    const res = await fetch(API_ENDPOINTS.CHAT_END, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
      },
      body: JSON.stringify(bodyData)
    });
    return await res.json();
  } catch (err) {
    console.error("Error ending chat API:", err);
    return { success: true };
  }
};


/**
 * Fetches messages of a specific chat session (GET /api/chat/history/:sessionId)
 */
export const fetchChatMessagesApi = async (sessionId) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const cleanId = typeof sessionId === "string" ? sessionId : (sessionId?._id || sessionId?.sessionId || "");
    if (!cleanId) return [];

    const url = `${API_ENDPOINTS.CHAT_MESSAGES}/${cleanId}`;
    const res = await fetch(url, {
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    });

    if (res.ok) {
      const data = await res.json();
      const rawMsgs = data.data || data.messages || (Array.isArray(data) ? data : []);
      return rawMsgs.map((m) => ({
        _id: m._id || m.id,
        id: m._id || m.id,
        sessionId: m.session || cleanId,
        senderId: m.senderId || m.sender,
        senderType: (m.senderType || m.role || "user").toUpperCase(),
        text: m.text || m.message || m.content || "",
        createdAt: m.createdAt || new Date().toISOString(),
        timestamp: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now"
      }));
    }
  } catch (err) {
    console.error("Error fetching chat messages API:", err);
  }
  return [];
};

/**
 * Fetches previous chat sessions history (GET /api/chat/sessions?astrologerId=...)
 */
export const fetchChatHistoryApi = async () => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    let astroId = "";
    try {
      const keys = ["astrologerUser", "user", "astrologer", "userData"];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) {
          const p = JSON.parse(v);
          if (p._id || p.id || p.astrologerId) {
            astroId = String(p._id || p.id || p.astrologerId);
            break;
          }
        }
      }
    } catch {
      astroId = localStorage.getItem("astrologerId") || localStorage.getItem("userId") || "";
    }

    const url = astroId 
      ? `${SOCKET_URL}/api/chat/sessions?astrologerId=${astroId}`
      : `${SOCKET_URL}/api/chat/sessions`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data.data || data.sessions || data.chats || (Array.isArray(data) ? data : []);
    }
  } catch (err) {
    console.error("Error fetching chat history API:", err);
  }
  return [];
};

/**
 * Checks for any active PENDING chat request for this astrologer
 */
export const checkPendingRequestsApi = async () => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    let astroId = "";
    try {
      const keys = ["astrologerUser", "user", "astrologer", "userData"];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) {
          const p = JSON.parse(v);
          if (p._id || p.id || p.astrologerId) {
            astroId = String(p._id || p.id || p.astrologerId);
            break;
          }
        }
      }
    } catch {
      astroId = localStorage.getItem("astrologerId") || localStorage.getItem("userId") || "";
    }

    if (!astroId) return null;

    const urls = [
      `${SOCKET_URL}/api/chat/sessions?astrologerId=${astroId}`
    ];

    for (const url of urls) {
      const res = await fetch(url, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        let requests = data.data || data.requests || data.pending || data.sessions || (Array.isArray(data) ? data : null);
        if (Array.isArray(requests) && requests.length > 0) {
          const pending = requests.find(r => {
            const isPending = r.status === "PENDING" || r.status === "requested" || r.status === "INITIATED";
            const reqAstroId = String(
              (typeof r.astrologer === "object" ? (r.astrologer._id || r.astrologer.id) : r.astrologer) || r.astrologerId || ""
            );
            const matchesAstro = !reqAstroId || !astroId || reqAstroId === astroId;
            return isPending && matchesAstro;
          });
          if (pending) {
            const req = pending;
            const userObj = (typeof req.user === "object" && req.user) || (typeof req.userId === "object" && req.userId) || {};
            const rawName = userObj.name || userObj.fullName || userObj.userName || req.userName || req.name || req.fullName;
            const userIdStr = typeof req.userId === "string" ? req.userId : typeof req.user === "string" ? req.user : "";
            const name = rawName && typeof rawName === "string" && rawName.trim() ? rawName.trim() : (userIdStr ? `User #${userIdStr.slice(-4)}` : "Client User");

            return {
              sessionId: req._id || req.sessionId || req.id,
              user: {
                _id: userObj._id || userObj.id || userIdStr || "",
                name: name,
                avatar: userObj.profileImage || userObj.avatar || req.userAvatar || req.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80",
                dob: userObj.dob || userObj.dateofbirth || userObj.dateOfBirth || req.dob || "Not Specified",
                tob: userObj.tob || userObj.timeofbirth || userObj.timeOfBirth || req.tob || "Not Specified",
                pob: userObj.pob || userObj.placeofbirth || userObj.placeOfBirth || req.pob || "Not Specified",
                topic: userObj.topic || req.topic || "Astrology Consultation"
              },
              perMinuteRate: req.perMinuteRate || req.rate || 10,
              requestedAt: req.createdAt || new Date().toISOString()
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("Error checking pending requests API:", err);
  }
  return null;
};


/**
 * Sends a message via REST API (fallback if socket is unavailable)
 */
export const sendChatMessageApi = async (sessionId, text, targetUserId = "", customSenderId = "", messageType = "text", mediaUrl = null) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const user = JSON.parse(localStorage.getItem("astrologerUser") || "{}");
    const astroId = customSenderId || user._id || user.id || user.astrologerId || "";
    const urls = [
      `${SOCKET_URL}/api/chat/send`
    ];
    const bodyData = {
      sessionId,
      chatId: sessionId,
      roomId: sessionId,
      senderId: astroId,
      astrologerId: astroId,
      sender: astroId,
      from: astroId,
      receiverId: targetUserId,
      recipientId: targetUserId,
      userId: targetUserId || astroId,
      to: targetUserId,
      senderType: "ASTROLOGER",
      role: "astrologer",
      text,
      message: text,
      content: text,
      msg: text,
      messageType,
      mediaUrl
    };
    for (const url of urls) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(bodyData)
      }).catch(() => null);
      if (res && res.ok) {
        return await res.json().catch(() => ({ success: true }));
      }
    }
  } catch (err) {
    console.error("Error sending chat message API:", err);
  }
};

/**
 * Accepts an incoming call request
 * POST /api/video-session/accept/:id
 */
export const acceptCallApi = async (callId) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const idToUse = (typeof callId === "string" ? callId : "") || "";

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
    };

    const bodyData = { sessionId: idToUse, callId: idToUse };

    let res = await fetch(`${SOCKET_URL}/api/video-session/accept/${idToUse}`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyData)
    }).catch(() => null);

    if (res && res.ok) {
      const json = await res.json().catch(() => ({}));
      console.log("✅ acceptCallApi Response:", json);
      return json;
    }
  } catch (err) {
    console.error("Error accepting call API:", err);
  }
  return { success: true, callId };
};

/**
 * Rejects an incoming call request
 * POST /api/video-session/reject/:id
 */
export const rejectCallApi = async (callId, reason = "Astrologer is currently busy on another call") => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const idToUse = (typeof callId === "string" ? callId : "") || "";

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
    };

    const bodyData = { reason };

    let res = await fetch(`${SOCKET_URL}/api/video-session/reject/${idToUse}`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyData)
    }).catch(() => null);

    if (res && res.ok) {
      return await res.json().catch(() => ({ success: true }));
    }
  } catch (err) {
    console.error("Error rejecting call API:", err);
  }
  return { success: true };
};

/**
 * Ends an active call session (audio/video)
 * POST /api/video-session/end/:id
 */
export const endCallApi = async (callId) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const idToUse = (typeof callId === "string" ? callId : "") || "";

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}`, "x-auth-token": token, "token": token } : {})
    };

    let res = await fetch(`${SOCKET_URL}/api/video-session/end/${idToUse}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sessionId: idToUse })
    }).catch(() => null);

    if (res && res.ok) {
      return await res.json().catch(() => ({ success: true }));
    }
  } catch (err) {
    console.error("Error ending call API:", err);
  }
  return { success: true };
};

/**
 * Fetches call history logs for Astrologer
 * GET /api/video-session/history?userId=ASTROLOGER_ID&role=astrologer
 */
export const fetchCallHistoryApi = async () => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const user = JSON.parse(localStorage.getItem("astrologerUser") || "{}");
    const astroId = user._id || user.id || user.astrologerId || "";

    const url = astroId
      ? `${SOCKET_URL}/api/video-session/history?userId=${astroId}&role=astrologer`
      : `${SOCKET_URL}/api/video-session/history`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.data || data.calls || data.history || [];
    }
  } catch (err) {
    console.error("Error fetching call history API:", err);
  }
  return [];
};

/**
 * Checks for any active PENDING call request for this astrologer
 */
export const checkPendingCallRequestsApi = async () => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    let astroId = "";
    try {
      const keys = ["astrologerUser", "user", "astrologer", "userData"];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) {
          const p = JSON.parse(v);
          if (p._id || p.id || p.astrologerId) {
            astroId = String(p._id || p.id || p.astrologerId);
            break;
          }
        }
      }
    } catch {
      astroId = localStorage.getItem("astrologerId") || localStorage.getItem("userId") || "";
    }

    if (!astroId) return null;

    const urls = [
      `${SOCKET_URL}/api/video-session/pending?astrologerId=${astroId}`,
      `${SOCKET_URL}/api/video-session/requests?astrologerId=${astroId}`,
      `${SOCKET_URL}/api/video-session/astrologer/${astroId}`
    ];

    for (const url of urls) {
      const res = await fetch(url, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        let requests = data.data || data.requests || data.pending || data.calls || data.sessions || (Array.isArray(data) ? data : null);
        if (Array.isArray(requests) && requests.length > 0) {
          const pending = requests.find(r => {
            const st = String(r.status || "").toUpperCase();
            const isPending = st === "PENDING" || st === "REQUESTED" || st === "INITIATED" || st === "WAITING";
            const reqAstroId = String(
              (typeof r.astrologer === "object" ? (r.astrologer._id || r.astrologer.id) : r.astrologer) || r.astrologerId || ""
            );
            const matchesAstro = !reqAstroId || !astroId || reqAstroId === astroId;
            return isPending && matchesAstro;
          });

          if (pending) {
            const req = pending;
            const userObj = (typeof req.user === "object" && req.user) || (typeof req.userId === "object" && req.userId) || {};
            const rawName = userObj.name || userObj.fullName || userObj.userName || req.userName || req.name || req.fullName;
            const name = rawName && typeof rawName === "string" && rawName.trim() ? rawName.trim() : "Client User";

            return {
              callId: req._id || req.sessionId || req.id,
              sessionId: req._id || req.sessionId || req.id,
              user: {
                _id: userObj._id || userObj.id || "",
                name: name,
                avatar: userObj.profileImage || userObj.avatar || req.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80",
                dob: userObj.dob || userObj.dateofbirth || userObj.dateOfBirth || req.dob || "Not Specified",
                tob: userObj.tob || userObj.timeofbirth || userObj.timeOfBirth || req.tob || "Not Specified",
                pob: userObj.pob || userObj.placeofbirth || userObj.placeOfBirth || req.pob || "Not Specified",
                topic: userObj.topic || req.topic || "Astrology Consultation"
              },
              callType: (req.callType || req.type || "AUDIO").toUpperCase(),
              perMinuteRate: req.perMinuteRate || req.rate || 25,
              channelName: req.channelName || `video_${req._id || req.sessionId}`,
              agora: req.agora || {},
              requestedAt: req.createdAt || new Date().toISOString()
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("Error checking pending call requests API:", err);
  }
  return null;
};

/**
 * Updates astrologer profile information (PUT /api/astro/update/:id)
 * @param {string} astroId 
 * @param {Object} payload 
 */
export const updateAstroProfileApi = async (astroId, payload) => {
  try {
    const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
    const response = await fetch(`${BACKEND_URL}/api/astro/update/${astroId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-auth-token": token,
        "token": token
      },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (err) {
    console.error("Error updating astrologer profile:", err);
    throw err;
  }
};

/**
 * Fetch call session by ID
 */
export const fetchCallStateApi = async (sessionId) => {
  const response = await api.get(`/api/calls/${sessionId}`);
  return response.data;
};
