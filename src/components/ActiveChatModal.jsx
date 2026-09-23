import { useState, useEffect, useRef } from "react";
import { Send, PhoneOff, Clock, User, ChevronDown, ChevronUp, Image, AlertTriangle, ShieldAlert, CheckCheck, Plus, Calendar, MapPin, Star, Copy, Wallet } from "lucide-react";
import { sendChatMessage, emitTyping, endChatSession, subscribeSocketEvent, joinChatRoom, acceptChatRequest } from "../services/socket";
import { endChatApi, fetchChatMessagesApi, sendChatMessageApi } from "../config/api";


export default function ActiveChatModal({ session, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [showKundliDetails, setShowKundliDetails] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [walletWarning, setWalletWarning] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 50;
    setShowScrollBottom(isScrolledUp);
  };

  const astroUser = JSON.parse(localStorage.getItem("astrologerUser") || "{}");
  const astroId = astroUser._id || astroUser.id || astroUser.astrologerId || session?.astrologerId || session?.astrologer || "";

  const sessionId = session?.sessionId || session?._id || session?.id || session?.chatId || "";
  const user = session?.user || {};
  const perMinuteRate = Number(session?.perMinuteRate || session?.rate || session?.price || session?.charge || user?.perMinuteRate || user?.rate || 20) || 20;

  // Determine if this session is already completed (Read-Only Mode)
  const isReadOnly = session?.status === "COMPLETED" || session?.status === "ENDED" || session?.status === "CLOSED" || session?.status === "REJECTED" || session?.status === "CANCELLED" || false;

  const hasInitialScrollRef = useRef(false);
  const secondsElapsedRef = useRef(0);
  secondsElapsedRef.current = secondsElapsed;

  const currentEarningsRef = useRef(0);

  // Auto-scroll to bottom
  const scrollToBottom = (isSmooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: isSmooth ? "smooth" : "auto", 
        block: "end"
      });
    }, 100);
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (!hasInitialScrollRef.current) {
        scrollToBottom(false);
        hasInitialScrollRef.current = true;
      } else {
        const lastMsg = messages[messages.length - 1];
        const typeUpper = String(lastMsg?.senderType || lastMsg?.role || "").toUpperCase();
        const sentByMe = typeUpper === "ASTROLOGER" || typeUpper === "ASTRO" || (lastMsg?.senderId && String(lastMsg.senderId) === String(astroId));
        
        let isAtBottom = true;
        if (chatContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
          // If the user has scrolled up past 300px from the bottom, isAtBottom is false
          isAtBottom = scrollHeight - scrollTop - clientHeight <= 50;
        }
        
        // Only auto-scroll to bottom if user is already at the bottom or sent the message
        if (isAtBottom || sentByMe) {
          scrollToBottom(true);
        }
      }
    }
  }, [messages, isUserTyping]);

  // Initial messages load & Session timer
  useEffect(() => {
    let timer;
    let statusChecker;
    let unsubMsg = () => {};
    let unsubTimer = () => {};
    let unsubWarning = () => {};
    let unsubEnded = () => {};

    if (sessionId) {
      // 1. Load initial chat messages if any
      fetchChatMessagesApi(sessionId).then((existingMsgs) => {
        if (existingMsgs && existingMsgs.length > 0) {
          setMessages(existingMsgs);
        } else {
          // Default initial greeting message from system
          setMessages([
            {
              id: "sys_1",
              senderType: "SYSTEM",
              text: `Chat Session Started with ${user?.name || "Client User"}. Per-minute rate: ₹${perMinuteRate}/min.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      });

      if (!isReadOnly) {
        // Join chat room on Socket.io and emit accept_chat_request
        joinChatRoom(sessionId);
        acceptChatRequest(sessionId);

        // Start local duration counter with correct offset
        let initialSeconds = 0;
        const sessionStart = session?.startTime || session?.createdAt;
        if (sessionStart) {
          const start = new Date(sessionStart).getTime();
          const now = Date.now();
          if (!isNaN(start) && now > start) {
            initialSeconds = Math.floor((now - start) / 1000);
          }
        }
        setSecondsElapsed(initialSeconds);

        timer = setInterval(() => {
          setSecondsElapsed((prev) => prev + 1);
        }, 1000);

        // Subscribe to Socket events
        unsubMsg = subscribeSocketEvent("receiveMessage", (msg) => {
          if (!msg) return;
          console.log("📩 New Message Received in Active Chat:", msg);
          
          const normalizedMsg = {
            _id: msg._id || msg.id || "msg_" + Date.now(),
            id: msg._id || msg.id || "msg_" + Date.now(),
            clientMessageId: msg.clientMessageId || msg.tempId || msg.clientMsgId || null,
            sessionId: msg.sessionId || msg.chatId || sessionId,
            senderId: msg.senderId || msg.sender,
            senderType: (msg.senderType || msg.role || "user").toUpperCase(),
            messageType: msg.messageType || "text",
            text: msg.text || msg.message || msg.content || "",
            message: msg.text || msg.message || msg.content || "",
            content: msg.text || msg.message || msg.content || "",
            mediaUrl: msg.mediaUrl || msg.image || null,
            image: msg.mediaUrl || msg.image || null,
            createdAt: msg.createdAt || new Date().toISOString(),
            timestamp: msg.timestamp || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
          };

          setMessages((prev) => {
            try {
              if (!Array.isArray(prev)) return [normalizedMsg];
              const msgId = String(normalizedMsg._id || normalizedMsg.id || "");
              const clientMsgId = String(normalizedMsg.clientMessageId || "");

              // Skip if exact server _id already exists
              if (msgId && prev.some((m) => m && String(m._id || m.id || "") === msgId)) return prev;

              // Reconcile optimistic temp message if clientMessageId matches
              if (clientMsgId) {
                const matchIdx = prev.findIndex((m) => m && String(m.clientMessageId || m.id || "") === clientMsgId);
                if (matchIdx !== -1) {
                  const updated = [...prev];
                  updated[matchIdx] = normalizedMsg;
                  return updated;
                }
              }

              return [...prev, normalizedMsg];
            } catch (e) {
              console.error("Error parsing receiveMessage socket callback:", e);
              return prev;
            }
          });
        });

        unsubTimer = subscribeSocketEvent("timerTick", (data) => {
          if (data?.elapsedSeconds !== undefined) {
            setSecondsElapsed(data.elapsedSeconds);
          } else if (data?.elapsedMinutes !== undefined) {
            setSecondsElapsed(data.elapsedMinutes * 60);
          }
        });

        unsubWarning = subscribeSocketEvent("walletWarning", (data) => {
          setWalletWarning(data?.message || "User's wallet balance is running low!");
        });

        unsubEnded = subscribeSocketEvent("chatEnded", (data) => {
          console.log("🔴 Chat Session Ended Event Received - Closing modal immediately:", data);
          const finalGross = Number(data?.session?.totalAmountDeducted || data?.totalAmountDeducted || currentEarningsRef.current).toFixed(2);
          const finalPlatFee = Number(data?.session?.platformFee || data?.platformFee || (Number(currentEarningsRef.current) * 0.40)).toFixed(2);
          const finalEarning = Number(data?.session?.astrologerEarnings || data?.astrologerEarnings || (Number(currentEarningsRef.current) * 0.60)).toFixed(2);
          const finalSecs = data?.session?.totalDurationSeconds || data?.totalDurationSeconds || secondsElapsedRef.current;
          onClose({
            clientName: user?.name || "Client User",
            type: "Chat",
            duration: formatTimer(finalSecs),
            totalDeducted: finalGross,
            platformFee: finalPlatFee,
            earnings: finalEarning
          });
        });

        // Fallback status & message polling (polls backend every 2.5s to check status and sync chat history)
        statusChecker = setInterval(async () => {
          if (sessionId) {
            // Sync latest messages from DB safely without duplicating
            fetchChatMessagesApi(sessionId).then((existingMsgs) => {
              if (existingMsgs && existingMsgs.length > 0) {
                setMessages((prev) => {
                  if (!Array.isArray(prev) || prev.length === 0) return existingMsgs;
                  let updated = [...prev];
                  let hasChanges = false;

                  for (const m of existingMsgs) {
                    if (!m) continue;
                    const mId = String(m._id || m.id || "");
                    const clientMId = String(m.clientMessageId || "");

                    const existsById = mId && updated.some((p) => String(p._id || p.id || "") === mId);
                    if (existsById) continue;

                    if (clientMId) {
                      const matchIdx = updated.findIndex((p) => String(p.clientMessageId || p.id || "") === clientMId);
                      if (matchIdx !== -1) {
                        updated[matchIdx] = m;
                        hasChanges = true;
                        continue;
                      }
                    }

                    updated.push(m);
                    hasChanges = true;
                  }

                  return hasChanges ? updated : prev;
                });
              }
            });

            try {
              const token = localStorage.getItem("astrologerToken") || localStorage.getItem("token") || "";
              const backendBase = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://mantrajyotish-backend.vercel.app").replace(/\/$/, "").replace(/\/api$/, "");
              const urls = [
                `${backendBase}/api/chat/details/${sessionId}`
              ];

              for (const url of urls) {
                const res = await fetch(url, {
                  headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                  }
                }).catch(() => null);

                if (res && res.ok) {
                  const data = await res.json().catch(() => null);
                  const status = data?.status || data?.session?.status || data?.data?.status;
                  const isActive = data?.isActive ?? data?.session?.isActive;

                  if (status === "COMPLETED" || status === "ENDED" || status === "REJECTED" || status === "CLOSED" || isActive === false) {
                    console.log("🔴 Session status marked ended on backend - Closing modal immediately");
                    onClose();
                    break;
                  }
                }
              }
            } catch (err) {
              // ignore error
            }
          }
        }, 2500);
      } else {
        // Read-only Mode: initialize seconds elapsed to total duration or diff
        let finalSeconds = 0;
        if (session?.endTime && session?.startTime) {
          const diff = Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000);
          finalSeconds = diff > 0 ? diff : (session.totalDurationMinutes || 0) * 60;
        } else {
          finalSeconds = (session?.totalDurationMinutes || 0) * 60;
        }
        setSecondsElapsed(finalSeconds);
      }
    }

    return () => {
      if (timer) clearInterval(timer);
      if (statusChecker) clearInterval(statusChecker);
      if (!isReadOnly) {
        unsubMsg();
        unsubTimer();
        unsubWarning();
        unsubEnded();
      }
    };
  }, [sessionId, isReadOnly]);


  const targetUserId = user?._id || user?.id || session?.userId || (typeof session?.user === "string" ? session.user : "") || "";

  const handleSend = async () => {
    if (!inputMessage.trim()) return;

    const text = inputMessage.trim();
    const clientMessageId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

    const newMsg = {
      id: clientMessageId,
      clientMessageId,
      sessionId,
      chatId: sessionId,
      roomId: sessionId,
      senderId: astroId,
      astrologerId: astroId,
      sender: astroId,
      receiverId: targetUserId,
      recipientId: targetUserId,
      userId: targetUserId || astroId,
      to: targetUserId,
      senderType: "ASTROLOGER",
      role: "astrologer",
      text: text,
      message: text,
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update local state immediately
    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "36px";
      textareaRef.current.style.overflowY = "hidden";
    }

    // 1. Send via Socket.io
    sendChatMessage(newMsg);

    // 2. Only call REST API fallback IF socket is disconnected
    try {
      const s = connectSocket();
      if (!s || !s.connected) {
        sendChatMessageApi(sessionId, text, targetUserId, astroId, clientMessageId);
      }
    } catch {
      // ignore
    }

    emitTyping(sessionId, false);
  };




  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    emitTyping(sessionId, e.target.value.length > 0);
  };

  const handleEndChat = async () => {
    try {
      const res = await endChatApi(sessionId);
      endChatSession(sessionId);
      localStorage.setItem("lastEndedChatSessionId", sessionId);
      
      const finalGross = Number(res?.data?.totalAmountDeducted || res?.totalAmountDeducted || currentEarnings).toFixed(2);
      const finalPlatFee = Number(res?.data?.platformFee || res?.platformFee || (Number(currentEarnings) * 0.40)).toFixed(2);
      const finalEarning = Number(res?.data?.astrologerEarnings || res?.astrologerEarnings || (Number(currentEarnings) * 0.60)).toFixed(2);
      const finalSecs = res?.data?.totalDurationSeconds || res?.totalDurationSeconds || secondsElapsed;
      
      onClose({
        clientName: user?.name || "Client User",
        type: "Chat",
        duration: formatTimer(finalSecs),
        totalDeducted: finalGross,
        platformFee: finalPlatFee,
        earnings: finalEarning
      });
    } catch (err) {
      console.error("Error ending chat:", err);
      onClose({
        clientName: user?.name || "Client User",
        type: "Chat",
        duration: formatTimer(secondsElapsed),
        totalDeducted: Number(currentEarnings).toFixed(2),
        platformFee: (Number(currentEarnings) * 0.40).toFixed(2),
        earnings: (Number(currentEarnings) * 0.60).toFixed(2)
      });
    }
  };

  // Format HH:MM:SS or MM:SS
  const formatTimer = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate current earnings
  const elapsedMinutes = Math.max(1, Math.ceil(secondsElapsed / 60));
  const totalAmt = Number(session?.totalAmountDeducted || session?.astrologerEarnings || 0);
  const currentEarnings = isReadOnly && totalAmt > 0
    ? totalAmt.toFixed(2)
    : (elapsedMinutes * perMinuteRate).toFixed(2);
  currentEarningsRef.current = currentEarnings;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[#F3F4F6] animate-fade-in">
      <div className="w-full max-w-[430px] md:max-w-[850px] h-full bg-[#F8F9FD] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff8f6c] to-[#ff5c33] border-b border-orange-500/20 px-3 py-3 sticky top-0 z-20 text-white shadow-md">
          <div className="max-w-[520px] mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-[50%]">
              <div className="relative flex-shrink-0">
                <img
                  src={user?.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80"}
                  alt={user?.name}
                  className="w-10 h-10 rounded-full object-cover border border-white/20"
                />
                <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#ff8f6c] rounded-full ${isReadOnly ? "bg-gray-400" : "bg-green-500"}`}></span>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-xs md:text-sm leading-tight truncate">
                  {user?.name || "Client User"}
                </h2>
                <div className="flex items-center gap-1 mt-0.5 min-w-0">
                  <span className={`text-[9px] font-bold uppercase tracking-wide truncate ${isReadOnly ? "text-orange-200" : "text-orange-100"}`}>
                    {isReadOnly ? "Ended" : "Online"}
                  </span>
                  <span className="text-[9px] text-orange-200/80">•</span>
                  <span className={`text-[9px] font-bold truncate ${isReadOnly ? "text-orange-200" : "text-orange-100"}`}>
                    Rate: ₹{perMinuteRate}/min
                  </span>
                </div>
              </div>
            </div>

            {/* Time Elapsed Badge */}
            <div className="flex flex-col items-center justify-center text-center flex-shrink-0">
              <div className="flex items-center gap-1 bg-black/15 px-2 py-0.5 rounded-full text-white font-mono text-[10px] font-medium border border-white/5">
                <Clock size={10} className="opacity-95" />
                <span>{formatTimer(secondsElapsed)}</span>
              </div>
              <span className="text-[7px] text-orange-100/80 font-bold uppercase mt-0.5 tracking-wide">{isReadOnly ? "Total Time" : "Time Elapsed"}</span>
            </div>

            {/* Earnings & End Button Section */}
            <div className="flex items-center gap-1.5 relative flex-shrink-0">
              <div 
                className="flex items-center gap-2 bg-white rounded-xl px-2 py-0.5 border border-white/80 shadow-xs h-8"
              >
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-0.5 text-gray-800 text-[10px] font-medium leading-none">
                    <Wallet size={9} className="text-gray-400" />
                    <span>₹{Number(currentEarnings).toFixed(2)}</span>
                  </div>
                  <span className="text-[6px] text-gray-400 font-bold uppercase mt-0.5 tracking-wide">Total Earned</span>
                </div>
              </div>

              {!isReadOnly && (
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-md shadow-red-600/10 flex-shrink-0"
                  title="End Chat"
                >
                  <PhoneOff size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Customer Birth & Kundli Details Card */}
        <div className={`bg-white border-l border-r border-gray-100 shadow-sm text-xs z-30 relative transition-all ${showKundliDetails ? "rounded-b-none border-b-0" : "rounded-b-3xl border-b"}`}>
          <div 
            onClick={() => setShowKundliDetails(!showKundliDetails)}
            className="flex items-center justify-between cursor-pointer p-4.5 pb-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#FFF2EC] flex items-center justify-center text-[#FF6F3D]">
                <User size={14} />
              </div>
              <span className="font-medium text-[#FF6F3D] text-[10px] uppercase tracking-wider">
                Customer Birth & Kundli Details
              </span>
            </div>
            <button className="text-gray-400 p-1 rounded-full hover:bg-gray-50 cursor-pointer">
              {showKundliDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showKundliDetails && (
            <div className="absolute top-full left-[-1px] right-[-1px] px-4.5 pb-4.5 pt-1 space-y-4 bg-white rounded-b-3xl border-b border-l border-r border-gray-100 shadow-lg z-30 animate-fade-in">
              {/* 2x2 grid of details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 flex-shrink-0">
                    <Calendar size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] text-gray-400 font-normal uppercase tracking-wider">DOB</div>
                    <div className="text-xs font-medium text-gray-800 mt-0.5">
                      {user?.dob || "Not Specified"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 flex-shrink-0">
                    <Clock size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] text-gray-400 font-normal uppercase tracking-wider">TOB</div>
                    <div className="text-xs font-medium text-gray-800 mt-0.5">
                      {user?.tob || "Not Specified"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 flex-shrink-0">
                    <MapPin size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] text-gray-400 font-normal uppercase tracking-wider">POB</div>
                    <div className="text-xs font-medium text-gray-800 mt-0.5 truncate max-w-[110px]" title={user?.pob || "Not Specified"}>
                      {user?.pob || "Not Specified"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100/50 flex-shrink-0">
                    <User size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] text-gray-400 font-normal uppercase tracking-wider">Gender</div>
                    <div className="text-xs font-medium text-gray-800 mt-0.5 capitalize">
                      {user?.gender || "Not Specified"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Consultation Topic */}
              {user?.topic && (
                <div className="bg-[#FFF2EC] border border-[#ffe0d1] rounded-2xl p-3 flex items-center gap-2.5">
                  <Star size={14} className="text-[#FF6F3D] fill-[#FF6F3D] flex-shrink-0" />
                  <div>
                    <div className="text-[8px] text-[#FF6F3D]/80 font-normal uppercase tracking-wider">Consultation Topic</div>
                    <div className="text-xs font-medium text-gray-800 mt-0.5">{user.topic}</div>
                  </div>
                </div>
              )}

              {/* Session ID display */}
              <div className="flex justify-between items-center bg-[#FAFAFA] border border-gray-100 rounded-2xl px-3 py-2 text-[10px]">
                <span className="text-gray-400 font-normal">Session ID</span>
                <div className="flex items-center gap-1.5 bg-white border border-gray-100 px-2 py-0.5 rounded-lg shadow-2xs">
                  <span className="font-mono text-gray-600 select-all" title={sessionId}>{sessionId || "N/A"}</span>
                  <button 
                    onClick={() => {
                      if (sessionId) {
                        navigator.clipboard.writeText(sessionId);
                        alert("Session ID copied!");
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 rounded"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Low Wallet Warning Banner */}
        {walletWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 font-semibold flex items-center gap-2 animate-bounce">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{walletWarning}</span>
          </div>
        )}

        {/* Messages Container */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-gradient-to-b from-gray-50/50 to-gray-100/30 relative"
        >
          {messages.map((msg, i) => {
            // Use server _id as the React key; fall back to array index only for system/local-only messages
            const msgKey = msg._id || msg.id || i;

            if (msg.senderType === "SYSTEM") {
              return (
                <div key={msgKey} className="self-center my-2 bg-gray-200/50 text-gray-500 text-[10px] uppercase tracking-wider font-extrabold px-4 py-1.5 rounded-full text-center max-w-[85%] border border-gray-200/20 shadow-sm">
                  {msg.text}
                </div>
              );
            }

            const typeUpper = String(msg.senderType || msg.role || "").toUpperCase();
            const isMe = typeUpper === "ASTROLOGER" || typeUpper === "ASTRO" || (msg.senderId && String(msg.senderId) === String(astroId));

            return (
              <div
                key={msgKey}
                className={`flex flex-col max-w-[78%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-[20px] text-[14px] shadow-sm leading-relaxed break-words max-w-full ${
                    isMe
                      ? "bg-gradient-to-r from-[#ff7448] to-[#ff5c33] text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-gray-200/50 rounded-tl-none"
                  }`}
                  style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                >
                  {msg.text || msg.message || msg.content}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1.5">
                  <span className="text-[10px] text-gray-400 font-bold">
                    {msg.timestamp || "Now"}
                  </span>
                  {isMe && (
                    <CheckCheck className={`w-3.5 h-3.5 ${msg.isRead ? "text-blue-500 font-bold" : "text-gray-300"}`} />
                  )}
                </div>
              </div>
            );
          })}

          {isUserTyping && (
            <div className="self-start bg-gray-200/50 text-gray-500 text-xs px-3.5 py-2 rounded-full italic animate-pulse border border-gray-200/30">
              User is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll to Bottom button - fixed above the send input bar */}
        {showScrollBottom && (
          <button 
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-24 right-6 z-40 bg-white text-[#ff5c33] hover:bg-gray-50 border border-gray-200 p-2.5 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all active:scale-90"
            title="Scroll to Bottom"
          >
            <ChevronDown size={18} strokeWidth={3} />
          </button>
        )}

        {/* Bottom Message Input Bar */}
        {isReadOnly ? (
          <div className="p-4 bg-[#F3F4F6] border-t border-gray-200 flex items-center justify-center sticky bottom-0 z-10 w-full text-center flex-shrink-0">
            <span className="text-xs font-bold text-gray-500 bg-white/80 border border-gray-200 px-5 py-2.5 rounded-full shadow-xs flex items-center gap-2">
              <ShieldAlert size={14} className="text-gray-400" />
              This chat session has ended (Read-Only Mode)
            </span>
          </div>
        ) : (
          <div className="p-4 bg-[#FAFAFA] border-t border-gray-100 flex items-center sticky bottom-0 z-10 w-full">
            <div className="flex-1 bg-white rounded-2xl shadow-md border border-gray-200/60 p-1.5 pl-2 pr-2 flex items-end">
              <button className="w-9 h-9 rounded-full bg-[#FFF2EC] hover:bg-[#ffe5d9] flex items-center justify-center text-[#FF6F3D] cursor-pointer active:scale-95 transition-all flex-shrink-0">
                <Plus size={18} strokeWidth={2.5} />
              </button>

              <textarea
                ref={textareaRef}
                placeholder="Type a message..."
                value={inputMessage}
                rows={1}
                onChange={(e) => {
                  handleInputChange(e);
                  e.target.style.height = "36px";
                  const newHeight = Math.min(e.target.scrollHeight, 100);
                  e.target.style.height = `${newHeight}px`;
                  e.target.style.overflowY = e.target.scrollHeight > 100 ? "auto" : "hidden";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 outline-none text-sm bg-transparent placeholder-gray-400 ml-3 resize-none max-h-[100px] py-1.5 text-gray-800"
                style={{ height: "36px", minHeight: "36px", lineHeight: "24px", overflowY: "hidden" }}
              />
              <button
                onClick={handleSend}
                className="ml-2 w-9 h-9 rounded-full bg-[#FF6F3D] hover:bg-[#e05e30] flex items-center justify-center text-white cursor-pointer active:scale-95 transition-all shadow-md shadow-orange-500/20 flex-shrink-0"
              >
                <Send size={16} className="fill-white translate-x-[1px]" />
              </button>
            </div>
          </div>
        )}

        {/* End Chat Confirmation Modal */}
        {showEndConfirm && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white rounded-[28px] w-full max-w-[320px] p-6 text-center shadow-2xl flex flex-col items-center animate-scale-up">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-sm">
                <PhoneOff size={32} />
              </div>
              <h4 className="text-lg font-bold text-gray-900">End Chat Session?</h4>
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
                    await handleEndChat();
                  }}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  Yes, End Chat
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
