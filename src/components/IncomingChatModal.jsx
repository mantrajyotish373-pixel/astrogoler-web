import { useState, useEffect } from "react";
import { Check, X, Clock, Calendar, MapPin, User, Sparkles, MessageSquare, ShieldAlert } from "lucide-react";
import { acceptChatApi, rejectChatApi } from "../config/api";
import { acceptChatRequest, joinChatRoom } from "../services/socket";
import { secondsUntil, syncServerClock } from "../services/serverClock";

export default function IncomingChatModal({ request, onAccept, onDecline }) {
  const [timeLeft, setTimeLeft] = useState(() => secondsUntil(request?.expiresAt) ?? 30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorAlert, setErrorAlert] = useState(null);

  const sessionId = request?.sessionId || request?._id || request?.id || request?.chatId || "";
  const user = request?.user || {};
  const perMinuteRate = Number(request?.perMinuteRate || request?.rate || 20) || 20;

  // Play 30-second Ringtone on Incoming Request (Only when Astrologer is ONLINE)
  useEffect(() => {
    if (!sessionId) return;
    const isOnline = localStorage.getItem("astro_is_online");
    if (isOnline === "false") {
      console.log("Astrologer is OFFLINE: Ringtone sound suppressed.");
      return;
    }

    const ringtoneUrl = request?.ringtoneUrl || "/sounds/ringtone.mp3";
    const audio = new Audio(ringtoneUrl);
    audio.loop = true;

    audio.play().catch(err => {
      console.warn("Background ringtone playback notice:", err);
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [sessionId]);

  // The request deadline is decided by the SERVER (expiresAt). This is only a display countdown to it;
  // the client never decides to time out. At zero the card just closes: the server marks the request
  // missed (and tells the user), so no API call is made from here.
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const fromServer = secondsUntil(request?.expiresAt);
        return fromServer !== null ? fromServer : prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [request?.expiresAt]);

  useEffect(() => {
    if (timeLeft <= 0 && !isProcessing) {
      onDecline(sessionId);
    }
  }, [timeLeft]);

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      // 1. Call REST API first to verify session is still valid/PENDING
      const res = await acceptChatApi(sessionId, request);
      if (res && res.success === false) {
        setErrorAlert(res.message || "This request has been cancelled by the user.");
        return;
      }
      // 2. Only join and emit socket if successful
      if (sessionId) {
        joinChatRoom(sessionId);
        acceptChatRequest(sessionId);
      }
      // The server fixed startedAt at the atomic accept; the chat clock is derived from it (not from this click)
      const accepted = (res && res.data) || {};
      syncServerClock(accepted.serverNow);
      onAccept({
        ...request,
        startTime: accepted.startTime || accepted.startedAt || null,
        startedAt: accepted.startedAt || accepted.startTime || null,
        serverNow: accepted.serverNow || null,
        perMinuteRate: accepted.perMinuteRate || request.perMinuteRate
      });
    } catch (err) {
      console.error("Error accepting chat:", err);
      setErrorAlert("This chat request is no longer active or was cancelled.");
    } finally {
      setIsProcessing(false);
    }
  };



  const handleDecline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await rejectChatApi(sessionId);
    } catch (err) {
      console.error("Error declining chat:", err);
    } finally {
      setIsProcessing(false);
      onDecline(sessionId);
    }
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-gradient-to-b from-gray-900 via-gray-900 to-[#1e130c] text-white rounded-[32px] p-6 border border-orange-500/30 shadow-[0_0_50px_rgba(255,116,72,0.25)] flex flex-col items-center relative overflow-hidden">
        
        {/* Glowing Top Badge */}
        <div className="flex items-center gap-2 bg-[#ff7448]/20 border border-[#ff7448]/40 px-3.5 py-1 rounded-full text-xs font-bold text-[#ff8e6c] animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-[#ff7448]" />
          <span>INCOMING CHAT REQUEST</span>
        </div>

        {/* User Image & Ring Timer */}
        <div className="relative mt-5 mb-4">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#ff7448] via-yellow-500 to-[#D53F8C] shadow-lg flex items-center justify-center">
            <img
              src={user?.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80"}
              alt={user?.name || "User"}
              className="w-full h-full rounded-full object-cover border-2 border-gray-900"
            />
          </div>

          {/* Countdown Badge */}
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-orange-500 to-red-500 text-white w-9 h-9 rounded-full flex items-center justify-center font-black text-sm border-2 border-gray-900 shadow-md">
            {timeLeft}s
          </div>
        </div>

        {/* User Name & Rate */}
        <h2 className="text-xl font-bold text-center tracking-tight text-white">{user?.name || "User Client"}</h2>
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-gray-300">
          <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            ₹{perMinuteRate}/min Rate
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-orange-300 font-bold flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Live Chat
          </span>
        </div>

        {/* User Birth & Kundli Details Box */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 mt-5 flex flex-col gap-2 text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#ff7448]" /> DOB:
            </span>
            <span className="font-semibold text-white">{user?.dob || "Not Specified"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#ff7448]" /> TOB:
            </span>
            <span className="font-semibold text-white">{user?.tob || "Not Specified"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#ff7448]" /> POB:
            </span>
            <span className="font-semibold text-white truncate max-w-[170px]">{user?.pob || "Not Specified"}</span>
          </div>
          {user?.topic && (
            <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#ff7448]" /> Topic:
              </span>
              <span className="font-bold text-orange-400">{user.topic}</span>
            </div>
          )}
        </div>


        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full mt-6">
          <button
            onClick={handleDecline}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 py-3 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
            <span>Decline</span>
          </button>

          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-3 rounded-2xl font-extrabold shadow-lg shadow-emerald-900/40 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            <span>{isProcessing ? "Accepting..." : "Accept"}</span>
          </button>
        </div>

        {/* Custom Alert Modal */}
        {errorAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-gray-150 flex flex-col items-center text-center relative animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 shadow-sm">
                <ShieldAlert size={36} className="stroke-[2.5]" />
              </div>

              <h3 className="text-lg font-bold text-gray-900">Request Cancelled</h3>
              <p className="text-xs text-gray-500 mt-2 px-2 leading-relaxed">
                {errorAlert}
              </p>

              <button
                onClick={() => {
                  setErrorAlert(null);
                  onDecline(sessionId);
                }}
                className="mt-6 w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer"
              >
                OK, Got it
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
