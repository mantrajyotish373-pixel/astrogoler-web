import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, Sparkles, User, ShieldAlert, Calendar, Clock, MapPin, MessageSquare, Send, X, Copy, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { endCallApi, fetchChatMessagesApi, sendChatMessageApi, uploadImageApi } from "../config/api";
import { endCallSession, subscribeSocketEvent, emitMediaStateChange, joinCallRoom, sendChatMessage } from "../services/socket";
import AgoraRTC from "agora-rtc-sdk-ng";
import {
  joinAgoraCallChannel,
  playLocalVideoTrack,
  playRemoteVideoTrack,
  toggleMicrophoneMute,
  toggleCameraState,
  leaveAgoraCallChannel,
  getLocalTracks,
  switchMicrophone,
  switchCamera
} from "../services/agoraCall";

export default function ActiveCallModal({ session, onClose }) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [peerMediaState, setPeerMediaState] = useState({ isAudioMuted: false, isVideoMuted: false });
  const [isConnected, setIsConnected] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [walletWarning, setWalletWarning] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const chatEndRef = useRef(null);

  const [microphones, setMicrophones] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [volumeBoost, setVolumeBoost] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [isBillingPaused, setIsBillingPaused] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const durationRef = useRef(0);
  durationRef.current = duration;
  const currentEarningsRef = useRef("0.00");

  const callId = session?.callId || session?.sessionId || session?._id || session?.id || "";
  const user = session?.user || session?.session?.user || {};
  
  const clientName = user?.name || (user?.firstname || user?.lastname ? `${user.firstname || ""} ${user.lastname || ""}`.trim() : null) || "Client User";
  const perMinuteRate = Number(session?.perMinuteRate || session?.rate || 25) || 25;
  const callType = (session?.callType || "AUDIO").toUpperCase();
  const isVideoCall = callType === "VIDEO";

  const dob = user?.dob || user?.dateofbirth || "Not Specified";
  const tob = user?.tob || user?.timeofbirth || "Not Specified";
  const pob = user?.pob || user?.placeofbirth || "Not Specified";

  // Extract Agora Token Details from backend response payload
  const rtcObj = session?.rtc || session?.agora || session?.data?.rtc || session?.data?.agora || {};
  const appId = rtcObj.appId || session?.appId || import.meta.env.VITE_AGORA_APP_ID || "af89ac0f87f4412ea75f23aba4717e04";
  const channelName = session?.channelName || rtcObj.channelName || session?.roomId || `video_${callId}`;
  const token = rtcObj.token || session?.rtcToken || session?.token || null;
  const uid = rtcObj.uid !== undefined ? Number(rtcObj.uid) : (session?.astrologerUid ? Number(session.astrologerUid) : (session?.uid ? Number(session.uid) : null));

  // Format DOB Date format safely (e.g. YYYY-MM-DD -> DD/MM/YYYY)
  const formatDob = (dateVal) => {
    if (!dateVal || dateVal === "Not Specified" || dateVal === "N/A") return "Not Specified";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // 1. Duration Timer
  useEffect(() => {
    if (isBillingPaused) return; // Freeze timer on UI during recharge
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isBillingPaused]);

  useEffect(() => {
    const unsubPaused = subscribeSocketEvent("billing_paused", (data) => {
      console.log("⏸️ User is recharging, billing paused:", data?.message);
      setIsBillingPaused(true);
    });
    const unsubResumed = subscribeSocketEvent("billing_resumed", (data) => {
      console.log("▶️ Recharge successful, billing resumed:", data?.message);
      setIsBillingPaused(false);
    });
    return () => {
      unsubPaused();
      unsubResumed();
    };
  }, []);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const mics = await AgoraRTC.getMicrophones();
        // Query cameras only if it is a Video Call to prevent audio calls from asking camera permission
        const cams = isVideoCall ? await AgoraRTC.getCameras() : [];
        const plays = await AgoraRTC.getPlaybackDevices();
        setMicrophones(mics);
        setCameras(cams);
        setSpeakers(plays);
      } catch (err) {
        console.error("Error querying media devices:", err);
      }
    };
    if (isConnected) {
      fetchDevices();
    }
  }, [isConnected, isVideoCall]);

  // 2. Initialize Agora RTC Stream & Socket Signalling
  useEffect(() => {
    let isMounted = true;

    // Join socket calling room to receive sync events
    if (callId) {
      joinCallRoom(callId);
    }

    const initCall = async () => {
      console.log("🎬 Joining Agora Call Channel:", channelName, "AppID:", appId, "Type:", callType);

      const res = await joinAgoraCallChannel({
        appId,
        channelName,
        token,
        uid,
        callType,
        callbacks: {
          onRemoteUserJoined: (usr) => {
            console.log("👤 Remote user joined:", usr.uid);
            if (isMounted) {
              setRemoteUser(usr);
              setIsConnected(true);
            }
          },
          onRemoteTrackPublished: (usr, mediaType) => {
            console.log("📹 Remote track published:", mediaType);
            if (isMounted) {
              setRemoteUser(usr);
              setIsConnected(true);
              if (mediaType === "video") {
                setHasRemoteVideo(true);
                setTimeout(() => {
                  if (remoteVideoRef.current) {
                    playRemoteVideoTrack(usr, remoteVideoRef.current);
                  }
                }, 300);
              }
            }
          },
          onRemoteUserLeft: () => {
            console.log("👋 Remote user left the call");
            if (isMounted) {
              setRemoteUser(null);
              setHasRemoteVideo(false);
            }
          }
        }
      });

      if (isMounted) {
        setIsConnected(true);
        if (isVideoCall && res.localVideoTrack && localVideoRef.current) {
          playLocalVideoTrack(localVideoRef.current);
        }
      }
    };

    initCall();

    // Socket subscriptions
    const unsubEnded = subscribeSocketEvent("callEnded", (data) => {
      console.log("🔴 Call ended via socket event:", data);
      handleEndCall(data);
    });

    const unsubSessionEnded = subscribeSocketEvent("session_ended", (data) => {
      console.log("🔴 Session ended via socket event:", data);
      handleEndCall(data);
    });

    const unsubTimerTick = subscribeSocketEvent("timerTick", (data) => {
      if (data) {
        if (data.elapsedSeconds !== undefined) {
          setDuration(data.elapsedSeconds);
        } else if (data.elapsedMinutes !== undefined) {
          setDuration(data.elapsedMinutes * 60);
        }
      }
    });

    const unsubWarning = subscribeSocketEvent("walletWarning", (data) => {
      setWalletWarning(data?.message || "User wallet balance is low!");
    });

    const unsubPeerMedia = subscribeSocketEvent("peer_media_state_changed", (data) => {
      if (data) {
        setPeerMediaState({
          isAudioMuted: !!data.isAudioMuted,
          isVideoMuted: !!data.isVideoMuted
        });
      }
    });

    return () => {
      isMounted = false;
      unsubEnded();
      unsubTimerTick();
      unsubWarning();
      unsubPeerMedia();
      leaveAgoraCallChannel();
    };
  }, [callId, channelName, token, appId, callType]);

  // 3. Unified Video Player rendering logic (handles swapping local/remote screens)
  useEffect(() => {
    if (!isVideoCall) return;

    const bigEl = remoteVideoRef.current;
    const smallEl = localVideoRef.current;
    if (!bigEl || !smallEl) return;

    if (!isSwapped) {
      // Normal state: local is small preview, remote is big background
      if (!isCameraOff) {
        playLocalVideoTrack(smallEl);
      }
      if (remoteUser && remoteUser.videoTrack && hasRemoteVideo) {
        playRemoteVideoTrack(remoteUser, bigEl);
      }
    } else {
      // Swapped state: local is big background, remote is small preview
      if (!isCameraOff) {
        playLocalVideoTrack(bigEl);
      }
      if (remoteUser && remoteUser.videoTrack && hasRemoteVideo) {
        playRemoteVideoTrack(remoteUser, smallEl);
      }
    }
  }, [isVideoCall, remoteUser, isCameraOff, isSwapped, hasRemoteVideo]);

  // Scroll to bottom of chat when messages updates or chat opens
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  // Load initial chat messages and handle socket message subscription
  useEffect(() => {
    let unsubMsg = () => {};

    if (callId) {
      // 1. Load initial chat messages if any
      fetchChatMessagesApi(callId).then((existingMsgs) => {
        if (existingMsgs && Array.isArray(existingMsgs) && existingMsgs.length > 0) {
          setMessages(existingMsgs);
        }
      }).catch((e) => console.log("Failed to load initial call chat messages:", e));

      // 2. Subscribe to incoming messages
      unsubMsg = subscribeSocketEvent("receiveMessage", (msg) => {
        const msgSessionId = msg.sessionId || msg.chatId || msg.roomId || "";
        if (msgSessionId && msgSessionId !== callId) return;

        const normalized = {
          _id: msg._id || Math.random().toString(),
          senderId: msg.senderId || msg.sender,
          senderType: (msg.senderType || msg.role || "USER").toUpperCase(),
          text: msg.text || msg.message || msg.content || "",
          timestamp: msg.timestamp || new Date().toISOString()
        };

        setMessages((prev) => {
          const exists = prev.some(m => m._id === normalized._id || (m.text === normalized.text && Math.abs(new Date(m.timestamp) - new Date(normalized.timestamp)) < 2000));
          if (exists) return prev;
          return [...prev, normalized];
        });
      });
    }

    return () => {
      unsubMsg();
    };
  }, [callId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const text = inputMessage.trim();

    const storedUser = localStorage.getItem("astrologerUser") || localStorage.getItem("astrologer");
    let astroId = "";
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        astroId = parsed._id || parsed.id;
      } catch (e) {}
    }

    const newMsg = {
      _id: Math.random().toString(),
      sessionId: callId,
      chatId: callId,
      senderId: astroId,
      sender: astroId,
      senderType: "ASTROLOGER",
      role: "astrologer",
      text: text,
      message: text,
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");

    try {
      // 1. Emit via socket
      sendChatMessage(newMsg);

      // 2. Fallback / save to DB via API
      const targetUserId = user?._id || user?.id || "";
      if (callId) {
        sendChatMessageApi(callId, text, targetUserId, astroId);
      }
    } catch (err) {
      console.error("Error sending message during call:", err);
    }
  };

  const handleAstroFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storedUser = localStorage.getItem("astrologerUser") || localStorage.getItem("astrologer");
      let astroId = "";
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          astroId = parsed._id || parsed.id;
        } catch (err) {}
      }
      const imageUrl = await uploadImageApi(file);
      if (imageUrl) {
        const msgPayload = {
          _id: Math.random().toString(),
          sessionId: callId,
          chatId: callId,
          senderId: astroId,
          sender: astroId,
          senderType: "ASTROLOGER",
          text: "",
          mediaUrl: imageUrl,
          messageType: "image",
          timestamp: new Date().toISOString()
        };
        sendChatMessage(msgPayload);
        const targetUserId = user?._id || user?.id || "";
        await sendChatMessageApi(callId, "", targetUserId, astroId, "image", imageUrl);
        setMessages((prev) => [...prev, msgPayload]);
      }
    } catch (err) {
      console.error("Error uploading call chat file:", err);
    }
  };

  const handleToggleMic = async () => {
    const muted = await toggleMicrophoneMute();
    setIsMuted(muted);
    emitMediaStateChange(callId, muted, isCameraOff);
  };

  const handleToggleCamera = async () => {
    const cameraOff = await toggleCameraState();
    setIsCameraOff(cameraOff);
    emitMediaStateChange(callId, isMuted, cameraOff);
    if (!cameraOff) {
      const targetEl = isSwapped ? remoteVideoRef.current : localVideoRef.current;
      if (targetEl) {
        setTimeout(() => playLocalVideoTrack(targetEl), 200);
      }
    }
  };

  const handleMicChange = async (e) => {
    const deviceId = e.target.value;
    setSelectedMic(deviceId);
    await switchMicrophone(deviceId);
  };
  const handleCameraChange = async (e) => {
    const deviceId = e.target.value;
    setSelectedCamera(deviceId);
    await switchCamera(deviceId);
  };
  const handleSpeakerChange = async (e) => {
    const deviceId = e.target.value;
    setSelectedSpeaker(deviceId);
    if (remoteUser && remoteUser.audioTrack) {
      await remoteUser.audioTrack.setPlaybackDevice(deviceId);
    }
  };
  const handleVolumeBoost = (boostLevel) => {
    setVolumeBoost(boostLevel);
    if (remoteUser && remoteUser.audioTrack) {
      remoteUser.audioTrack.setVolume(boostLevel);
    }
  };

  const handleToggleSpeaker = () => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    const boostLevel = nextState ? 300 : 100; // 300% for Speakerphone, 100% for Normal Earpiece
    setVolumeBoost(boostLevel);
    if (remoteUser && remoteUser.audioTrack) {
      remoteUser.audioTrack.setVolume(boostLevel);
    }
  };

  const handleEndCall = async (endData = null) => {
    let summary = null;
    try {
      if (callId) {
        endCallSession(callId);
      }
      const res = await endCallApi(callId).catch(() => null);
      
      const sObj = res?.data || res?.session || endData?.session || endData?.data || endData || {};
      const rawSecs = Number(sObj.totalDurationSeconds || sObj.durationSeconds || endData?.totalDurationSeconds || 0);
      const finalSecs = rawSecs > 0 ? rawSecs : (durationRef.current || duration || 1);
      const calculatedGross = (Math.max(1, finalSecs) * (perMinuteRate / 60)).toFixed(2);
      const rawGross = (sObj.totalAmountDeducted !== undefined && Number(sObj.totalAmountDeducted) > 0)
        ? Number(sObj.totalAmountDeducted)
        : (endData?.totalAmountDeducted !== undefined && Number(endData.totalAmountDeducted) > 0)
        ? Number(endData.totalAmountDeducted)
        : Number(calculatedGross);
      const finalGross = rawGross.toFixed(2);
      const finalPlatFee = (rawGross * 0.40).toFixed(2);
      const finalEarning = (rawGross * 0.60).toFixed(2);
      
      summary = {
        clientName: clientName,
        type: isVideoCall ? "Video Call" : "Audio Call",
        duration: formatTimer(finalSecs),
        totalDeducted: finalGross,
        platformFee: finalPlatFee,
        earnings: finalEarning
      };
    } catch (err) {
      console.error("Error ending call:", err);
      const finalSecs = durationRef.current || duration || 1;
      const calculatedGross = (Math.max(1, finalSecs) * (perMinuteRate / 60)).toFixed(2);
      const rawGross = Number(calculatedGross);
      summary = {
        clientName: clientName,
        type: isVideoCall ? "Video Call" : "Audio Call",
        duration: formatTimer(finalSecs),
        totalDeducted: rawGross.toFixed(2),
        platformFee: (rawGross * 0.40).toFixed(2),
        earnings: (rawGross * 0.60).toFixed(2)
      };
    } finally {
      leaveAgoraCallChannel();
      if (onClose) {
        onClose(summary);
      }
    }
  };

  const formatTimer = (totalSeconds) => {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Compute exact pro-rata live earnings directly from the elapsed duration in seconds
  const ratePerSecond = perMinuteRate / 60;
  const currentExactGross = parseFloat((Math.max(1, duration) * ratePerSecond).toFixed(2));
  const currentEarnings = currentExactGross.toFixed(2);
  currentEarningsRef.current = currentEarnings;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#090D1A] via-[#0E1326] to-[#05070F] text-white overflow-hidden animate-fade-in">
      
      {isBillingPaused && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-55 flex flex-col items-center justify-center text-white px-6 text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-[#FF7448] border-t-transparent rounded-full animate-spin mb-4"></div>
          <h3 className="text-xl font-bold">Client is Recharging Wallet</h3>
          <p className="text-sm text-gray-400 mt-2 max-w-xs">Billing is paused. The call will automatically resume once the recharge is complete. Please do not hang up.</p>
        </div>
      )}

      {/* Top Header Floating Bar */}
      <div className="absolute top-6 inset-x-0 z-20 flex flex-col items-center gap-2 px-4">
        {/* Main Status Capsule */}
        <div className="bg-[#0C101B]/95 border border-white/15 px-5 py-2 rounded-full flex items-center gap-3.5 text-xs font-semibold backdrop-blur-md shadow-lg">
          <span className="text-[#E28743] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#E28743] stroke-[2px]" />
            <span className="text-white text-[13.5px] font-bold tracking-wide tabular-nums">{formatTimer(duration)}</span>
          </span>
          <span className="text-white/15 font-light">|</span>
          <span className="text-[#E28743] font-bold text-[13px]">₹{perMinuteRate}/min</span>
          <span className="text-white/15 font-light">|</span>
          <span className="bg-[#0c181a] border border-[#10b981]/40 text-[#10b981] px-3 py-0.5 rounded-full text-[11.5px] font-bold tabular-nums whitespace-nowrap">
            Earning: +₹{currentEarnings}
          </span>
        </div>

        {/* Client Details Dropdown */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => setShowDetailsDropdown(!showDetailsDropdown)}
            className="bg-[#202737]/80 hover:bg-[#202737] border border-white/10 px-5 py-1.5 rounded-full text-[12.5px] font-medium text-white/95 backdrop-blur-md shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 z-20"
          >
            <span>Client Details</span>
            <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform duration-200 ${showDetailsDropdown ? "rotate-180" : ""}`} />
          </button>

          {/* Details Dropdown Card */}
          {showDetailsDropdown && (
            <div className="bg-[#020617]/85 border border-white/10 backdrop-blur-[24px] rounded-[24px] p-5 w-full max-w-[340px] shadow-2xl flex flex-col gap-3.5 mt-2.5 animate-fade-in z-25 text-left">
              
              {/* Client Name Row */}
              <div className="flex justify-between items-center">
                <span className="text-[#9CA3AF] text-[10px] font-normal">Client Name:</span>
                <span className="text-white text-[10px] font-bold uppercase tracking-wide truncate max-w-[190px]" title={clientName}>
                  {clientName}
                </span>
              </div>

              {/* Gender Row */}
              <div className="flex justify-between items-center">
                <span className="text-[#9CA3AF] text-[10px] font-normal">Gender:</span>
                <span className="text-white text-[10px] font-bold capitalize">
                  {user?.gender || "Not Specified"}
                </span>
              </div>

              {/* Consultation Topic Row */}
              {(user?.topic || session?.topic) && (
                <div className="flex justify-between items-center">
                  <span className="text-[#9CA3AF] text-[10px] font-normal">Topic:</span>
                  <span className="text-white text-[10px] font-bold truncate max-w-[190px]" title={user?.topic || session?.topic}>
                    {user?.topic || session?.topic}
                  </span>
                </div>
              )}

              {/* Session ID Row */}
              <div className="flex justify-between items-center">
                <span className="text-[#9CA3AF] text-[10px] font-normal">Session ID:</span>
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg shadow-xs">
                  <span className="text-white font-mono text-[10px] font-bold truncate max-w-[180px]" title={callId}>
                    {callId || "N/A"}
                  </span>
                  {callId && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(callId);
                        alert("Session ID copied!");
                      }}
                      className="text-white/40 hover:text-white cursor-pointer p-0.5 rounded transition-colors"
                      title="Copy Session ID"
                    >
                      <Copy size={10} />
                    </button>
                  )}
                </div>
              </div>

              {/* Horizontal Divider Line */}
              <div className="border-t border-white/10 my-0.5"></div>

              {/* Client Birth Details 3 Columns */}
              <div className="flex justify-around items-center">
                <div className="text-center flex-1">
                  <span className="text-[#64748B] block text-[7.5px] uppercase font-black tracking-widest mb-0.5">DOB</span>
                  <span className="font-extrabold text-white text-[10px] leading-tight">{formatDob(dob)}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="text-center flex-1">
                  <span className="text-[#64748B] block text-[7.5px] uppercase font-black tracking-widest mb-0.5">TOB</span>
                  <span className="font-extrabold text-white text-[10px] leading-tight">{tob}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="text-center flex-1">
                  <span className="text-[#64748B] block text-[7.5px] uppercase font-black tracking-widest mb-0.5">POB</span>
                  <span className="font-extrabold text-white text-[10px] leading-tight truncate max-w-[85px] inline-block" title={pob}>{pob}</span>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Wallet Warning Toast Banner */}
      {walletWarning && (
        <div className="absolute top-32 z-30 bg-amber-500/90 backdrop-blur-md text-black font-bold px-4 py-2 rounded-full text-xs flex items-center gap-2 shadow-lg animate-bounce">
          <ShieldAlert className="w-4 h-4 text-black" />
          <span>{walletWarning}</span>
        </div>
      )}

      {/* Peer Muted Status Indicator */}
      {(peerMediaState.isAudioMuted || peerMediaState.isVideoMuted) && (
        <div className="absolute top-32 z-30 bg-red-500/80 backdrop-blur-md text-white font-bold px-3 py-1 rounded-full text-[11px] flex items-center gap-1.5 shadow-md">
          {peerMediaState.isAudioMuted && <MicOff className="w-3.5 h-3.5 text-red-200" />}
          {peerMediaState.isVideoMuted && <VideoOff className="w-3.5 h-3.5 text-red-200" />}
          <span>{clientName} muted {peerMediaState.isAudioMuted ? "microphone" : "video"}</span>
        </div>
      )}

      {/* MAIN CALL STREAM CONTAINER */}
      <div className="w-full h-full relative flex items-center justify-center">

        {isVideoCall ? (
          /* VIDEO CALL INTERFACE */
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Remote Client / Swap Video Window */}
            <div className="w-full h-full bg-slate-900 relative overflow-hidden">
              <div
                ref={remoteVideoRef}
                className="w-full h-full flex items-center justify-center"
              />
              
              {/* Overlay states for Big Window */}
              {isSwapped ? (
                // Local video is background. Show Camera Off if isCameraOff is true.
                isCameraOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 text-gray-400 text-sm gap-2 z-10">
                    <VideoOff className="w-8 h-8 text-red-400" />
                    <span>Your camera is off</span>
                  </div>
                )
              ) : (
                // Remote video is background. Show waiting/profile if remote video is inactive.
                (!hasRemoteVideo || !isConnected) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center p-6 bg-gradient-to-b from-[#090D1A] via-[#0E1326] to-[#05070F] z-10">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-[#ff7448] via-yellow-500 to-[#D53F8C] shadow-2xl z-10 flex items-center justify-center">
                        <img
                          src={user?.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80"}
                          alt={clientName}
                          className="w-full h-full rounded-full object-cover border-[3px] border-[#FF7448]"
                        />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-wide">{clientName}</h2>
                      <p className="text-emerald-400 text-xs font-extrabold tracking-widest mt-1.5 uppercase">
                        ACTIVE VIDEO CALL
                      </p>
                      <div className="w-16 border-t border-white/10 my-4 mx-auto"></div>
                      <p className="text-xs text-gray-400 mt-1">Waiting for remote camera video stream...</p>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Local Astrologer Self Video Preview (Picture in Picture Overlay) */}
            <div 
              onClick={() => setIsSwapped(!isSwapped)}
              className="absolute bottom-28 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/80 z-20 cursor-pointer hover:border-white/40 active:scale-95 transition-all"
              title="Click to swap screens"
            >
              <div ref={localVideoRef} className="w-full h-full" />
              
              {isSwapped ? (
                // Swapped: remote video is preview. Show waiting details if inactive.
                (!hasRemoteVideo || !isConnected) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400 text-xs gap-1.5 p-2 text-center z-10">
                    <img 
                      src={user?.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80"} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover border border-white/20"
                    />
                    <span className="text-[10px] text-gray-400 line-clamp-1">No Video</span>
                  </div>
                )
              ) : (
                // Normal: local video is preview. Show Camera Off if isCameraOff is true.
                isCameraOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-400 text-xs gap-1 z-10">
                    <VideoOff className="w-6 h-6 text-red-400" />
                    <span>Camera Off</span>
                  </div>
                )
              )}

              {/* Label Tag */}
              <div className="absolute bottom-1 left-2 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-white font-medium z-10">
                {isSwapped ? clientName : "You (Astrologer)"}
              </div>
            </div>
          </div>
        ) : (
          /* AUDIO CALL INTERFACE */
          <div className="flex flex-col items-center justify-center gap-6 w-full max-w-sm px-6 text-center">
            
            {/* Client Profile Image */}
            <div className="relative flex items-center justify-center mb-2">
              <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-[#ff7448] via-yellow-500 to-[#D53F8C] shadow-2xl z-10 flex items-center justify-center">
                <img
                  src={user?.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80"}
                  alt={clientName}
                  className="w-full h-full rounded-full object-cover border-[3px] border-[#FF7448]"
                />
              </div>
            </div>

            {/* User Info & Audio Status */}
            <div>
              <h2 className="text-3xl font-bold text-white tracking-wide">{clientName}</h2>
              <p className="text-emerald-400 text-xs font-extrabold tracking-widest mt-1.5 uppercase">
                ACTIVE VOICE CALL
              </p>
              <div className="w-16 border-t border-white/10 my-4 mx-auto"></div>
            </div>

            {/* Client Birth Details Card */}
            <div className="w-full bg-[#111625]/60 border border-white/5 backdrop-blur-md rounded-[24px] p-5 text-center mt-2 flex flex-col gap-3 shadow-xl">
              <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest block">Client Birth Details</span>
              <div className="flex justify-around items-center text-xs text-gray-300">
                <div className="text-center flex-1">
                  <span className="text-white/40 block text-[9px] uppercase font-bold tracking-wider mb-0.5">DOB</span>
                  <span className="font-bold text-white text-xs">{formatDob(dob)}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="text-center flex-1">
                  <span className="text-white/40 block text-[9px] uppercase font-bold tracking-wider mb-0.5">TOB</span>
                  <span className="font-bold text-white text-xs">{tob}</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="text-center flex-1">
                  <span className="text-white/40 block text-[9px] uppercase font-bold tracking-wider mb-0.5">POB</span>
                  <span className="font-bold text-white text-xs truncate max-w-[85px] inline-block" title={pob}>{pob}</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Floating Bottom Control Bar */}
      <div className="absolute bottom-5 inset-x-0 z-30 flex flex-col items-center px-4">

        {/* Buttons Row */}
        <div className="flex items-center gap-6">
          {/* Toggle Microphone */}
          <button
            onClick={handleToggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl cursor-pointer border ${
              isMuted 
                ? "bg-red-500 text-white border-red-400 animate-pulse" 
                : "bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Toggle Camera (Only for Video Calls) */}
          {isVideoCall && (
            <button
              onClick={handleToggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl cursor-pointer border ${
                isCameraOff 
                  ? "bg-red-500 text-white border-red-400" 
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
              }`}
              title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* Toggle Chat Sidebar */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl cursor-pointer border ${
              isChatOpen 
                ? "bg-[#FF7448] text-white border-[#FF7448]/80 shadow-[#FF7448]/30" 
                : "bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
            }`}
            title="Toggle Chat"
          >
            <MessageSquare className="w-6 h-6" />
          </button>

          {/* Replace Settings button with simple Speaker toggle */}
          <button
            onClick={handleToggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-xl cursor-pointer border ${
              isSpeakerOn 
                ? "bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/30" 
                : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            }`}
            title={isSpeakerOn ? "Turn Speaker Off" : "Turn Speaker On"}
          >
            <Volume2 className="w-6 h-6" />
          </button>

          {/* End Call Button */}
          <button
            onClick={() => setShowEndConfirm(true)}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all active:scale-95 cursor-pointer border border-red-400/30"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6 fill-white" />
          </button>
        </div>

      </div>

      {/* Slide-in Chat Panel as Bottom Sheet */}
      {isChatOpen && (
        <div className="absolute bottom-0 inset-x-0 h-[65%] bg-[#0E1326] rounded-t-[32px] border-t border-white/10 z-45 flex flex-col shadow-2xl transition-all duration-300 animate-slide-up">
          {/* Header */}
          <div className="p-4 px-6 border-b border-white/10 flex items-center justify-between bg-[#111625]/60 rounded-t-[32px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
              <span className="font-bold text-sm text-white">Chat with {clientName}</span>
            </div>
            <button 
              onClick={() => setIsChatOpen(false)}
              className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-full p-2 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Context Header Badge */}
            <div className="flex justify-center mb-1">
              <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-[10px] text-white/50 font-medium tracking-wide">
                In-Call Message Session
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 gap-2">
                <MessageSquare size={36} className="text-gray-600" />
                <span className="text-xs">No messages yet. Send a message to start chatting!</span>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isAstro = msg.senderType === "ASTROLOGER";
                return (
                  <div 
                    key={msg._id || index}
                    className={`flex flex-col max-w-[85%] ${isAstro ? "self-end items-end" : "self-start items-start"}`}
                  >
                    <div className={`px-4 py-2.5 rounded-[20px] text-xs leading-relaxed flex flex-col gap-1 shadow-xs ${
                      isAstro 
                        ? "bg-[#FF7448] text-white rounded-tr-none" 
                        : "bg-[#202737] text-white rounded-tl-none border border-white/5"
                    }`}>
                      {msg.mediaUrl ? (
                        <div className="rounded-lg overflow-hidden max-w-[200px] mb-1">
                          <img src={msg.mediaUrl} alt="Uploaded" className="w-full h-auto object-cover max-h-48" />
                        </div>
                      ) : (
                        <span className="pr-4">{msg.text || msg.message || msg.content}</span>
                      )}
                      <span className={`text-[8.5px] font-mono self-end mt-0.5 -mr-1 ${isAstro ? "text-white/70" : "text-white/40"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-4 border-t border-white/10 bg-[#111625]/60 flex items-center gap-3">
            <input 
              type="file" 
              id="in-call-astro-upload" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAstroFileUpload} 
            />
            <label 
              htmlFor="in-call-astro-upload"
              className="w-11 h-11 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer shadow-md active:scale-95 transition-all border border-white/5 flex-shrink-0"
              title="Upload Image"
            >
              <Plus className="w-4.5 h-4.5" />
            </label>
            <input 
              type="text" 
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
              className="flex-1 bg-[#202737] border border-white/5 rounded-full px-5 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF7448] transition-colors"
            />
            <button 
              onClick={handleSendMessage}
              className="w-11 h-11 bg-[#FF7448] hover:bg-[#e05e30] rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <Send size={16} className="fill-white stroke-none transform rotate-45 -translate-x-0.5 translate-y-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* End Call Confirmation Modal */}
      {showEndConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-[28px] w-full max-w-[320px] p-6 text-center shadow-2xl flex flex-col items-center animate-scale-up">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-sm">
              <PhoneOff size={32} />
            </div>
            <h4 className="text-lg font-bold text-gray-900">End Call Session?</h4>
            <p className="text-gray-500 text-xs mt-2 px-2 leading-relaxed text-center">
              Are you sure you want to end this consultation? This session will close and billing will end immediately.
            </p>
            <div className="flex gap-3 w-full mt-6">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-500 active:scale-95 transition-all cursor-pointer"
              >
                No, Continue
              </button>
              <button
                onClick={async () => {
                  setShowEndConfirm(false);
                  await handleEndCall();
                }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Yes, End Call
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
