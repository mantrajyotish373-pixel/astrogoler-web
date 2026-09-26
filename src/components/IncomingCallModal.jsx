import { useState, useEffect } from "react";
import { Check, X, Clock, Calendar, MapPin, User, Sparkles, Phone, Video, Mic, ShieldAlert } from "lucide-react";
import { acceptCallApi, rejectCallApi } from "../config/api";
import { acceptCallRequest, rejectCallRequest } from "../services/socket";
import { startIncomingRingtone, stopRingtone, playConnectionChime } from "../services/sound";

export default function IncomingCallModal({ request, onAccept, onDecline }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorAlert, setErrorAlert] = useState(null);

  const callId = request?.callId || request?.sessionId || request?._id || request?.id || "";
  const user = request?.user || {};
  const perMinuteRate = Number(request?.perMinuteRate || request?.rate || 30) || 30;
  const callType = (request?.callType || "AUDIO").toUpperCase();
  const isVideo = callType === "VIDEO";

  // Play 30-second Ringtone on Incoming Request (Only when Astrologer is ONLINE)
  useEffect(() => {
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
  }, [request]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleDecline();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      // 1. Call REST API first to verify session is still valid/PENDING
      const res = await acceptCallApi(callId, request);
      if (res && res.success === false) {
        setErrorAlert(res.message || "This call has been cancelled by the user.");
        return;
      }
      const rtcData = res?.data?.rtc || res?.rtc || res?.data?.agora || res?.agora || {};
      const sessionData = res?.data?.session || res?.session || {};
      // 2. Only emit accept event if successful
      if (callId) {
        acceptCallRequest(callId, callType);
        playConnectionChime();
      }
      const merged = {
        ...request,
        ...sessionData,
        rtc: rtcData,
        agora: rtcData,
        uid: rtcData.uid !== undefined ? Number(rtcData.uid) : (sessionData.astrologerUid ? Number(sessionData.astrologerUid) : undefined),
        astrologerUid: rtcData.uid !== undefined ? Number(rtcData.uid) : (sessionData.astrologerUid ? Number(sessionData.astrologerUid) : undefined),
        userUid: sessionData.userUid,
        rtcToken: rtcData.token || request.rtcToken || "",
        appId: rtcData.appId || request.appId || "",
        channelName: rtcData.channelName || sessionData.channelName || request.channelName || ""
      };
      onAccept(merged);
    } catch (err) {
      console.error("Error accepting call:", err);
      setErrorAlert("This call request is no longer active or was cancelled.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (callId) {
        rejectCallRequest(callId);
      }
      await rejectCallApi(callId);
    } catch (err) {
      console.error("Error declining call:", err);
    } finally {
      setIsProcessing(false);
      onDecline(callId);
    }
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-sm bg-gradient-to-b from-gray-900 via-gray-900 ${
        isVideo ? "to-[#17111c] border-purple-500/30 shadow-[0_0_50px_rgba(159,122,234,0.25)]" : "to-[#0a1815] border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.25)]"
      } text-white rounded-[32px] p-6 border flex flex-col items-center relative overflow-hidden`}>
        
        {/* Glowing Top Badge */}
        <div className={`flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold border animate-pulse ${
          isVideo 
            ? "bg-[#9F7AEA]/20 border-[#9F7AEA]/40 text-[#B794F4]"
            : "bg-[#10B981]/20 border-[#10B981]/40 text-[#34D399]"
        }`}>
          {isVideo ? <Video className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>INCOMING {callType} CALL</span>
        </div>

        {/* User Image & Ring Timer */}
        <div className="relative mt-5 mb-4">
          <div className={`w-24 h-24 rounded-full p-1 shadow-lg flex items-center justify-center ${
            isVideo 
              ? "bg-gradient-to-tr from-purple-500 via-pink-500 to-rose-500" 
              : "bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500"
          }`}>
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
          <span className={`${isVideo ? "text-purple-300" : "text-emerald-300"} font-bold flex items-center gap-1`}>
            {isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            {isVideo ? "Video Call" : "Audio Call"}
          </span>
        </div>

        {/* User Details Card */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 mt-5 flex flex-col gap-2 text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Calendar className={`w-3.5 h-3.5 ${isVideo ? "text-purple-400" : "text-emerald-400"}`} /> DOB:
            </span>
            <span className="font-semibold text-white">{user?.dob || "Not Specified"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Clock className={`w-3.5 h-3.5 ${isVideo ? "text-purple-400" : "text-emerald-400"}`} /> TOB:
            </span>
            <span className="font-semibold text-white">{user?.tob || "Not Specified"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <MapPin className={`w-3.5 h-3.5 ${isVideo ? "text-purple-400" : "text-emerald-400"}`} /> POB:
            </span>
            <span className="font-semibold text-white truncate max-w-[170px]">{user?.pob || "Not Specified"}</span>
          </div>
          {user?.topic && (
            <div className="pt-1.5 mt-1 border-t border-white/10 flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5">
                <User className={`w-3.5 h-3.5 ${isVideo ? "text-purple-400" : "text-emerald-400"}`} /> Topic:
              </span>
              <span className={`font-bold ${isVideo ? "text-purple-400" : "text-emerald-400"}`}>{user.topic}</span>
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
            className={`flex items-center justify-center gap-2 bg-gradient-to-r ${
              isVideo 
                ? "from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-purple-900/40" 
                : "from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-900/40"
            } text-white py-3 rounded-2xl font-extrabold shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50`}
          >
            <Check className="w-5 h-5" />
            <span>{isProcessing ? "Accepting..." : "Accept"}</span>
          </button>
        </div>

      </div>

      {/* Custom Alert Modal */}
      {errorAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-gray-150 flex flex-col items-center text-center relative animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 shadow-sm">
              <ShieldAlert size={36} className="stroke-[2.5]" />
            </div>

            <h3 className="text-lg font-bold text-gray-900">Call Cancelled</h3>
            <p className="text-xs text-gray-500 mt-2 px-2 leading-relaxed">
              {errorAlert}
            </p>

            <button
              onClick={() => {
                setErrorAlert(null);
                onDecline(callId);
              }}
              className="mt-6 w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer"
            >
              OK, Got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
