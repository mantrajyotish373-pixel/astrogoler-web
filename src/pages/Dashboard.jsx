import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../config/axiosInstance";
import { fetchCallStateApi } from "../config/api";
import { ArrowLeft, ChevronDown, Mic, Video, MessageSquare, Radio, Mail, Phone, Briefcase, User, Mars, Sliders, Building, Compass, MapPin, Sparkles, LogOut, Camera, Loader2, Play, MessageCircle, CheckCircle, ShieldAlert } from "lucide-react";
import { uploadImageApi, fetchChatHistoryApi, checkPendingRequestsApi, BACKEND_URL } from "../config/api";
import Header from "../components/Header";
import DashboardGrid from "../components/DashboardGrid";
import WalletModal from "../components/WalletModal";
import IncomingChatModal from "../components/IncomingChatModal";
import ActiveChatModal from "../components/ActiveChatModal";
import IncomingCallModal from "../components/IncomingCallModal";
import ActiveCallModal from "../components/ActiveCallModal";
import { connectSocket, subscribeSocketEvent, triggerDemoIncomingRequest, triggerDemoIncomingCallRequest } from "../services/socket";
import { checkPendingCallRequestsApi, fetchCallHistoryApi, updateAstroProfileApi } from "../config/api";




// Custom Views for each category to keep it on a single page
function ReportView({ onBack }) {
  const categories = [
    {
      title: ["Voice", "Calling"],
      icon: Mic,
      sessions: 0,
      minutes: 0,
      earning: "0.0",
    },
    {
      title: ["Video", "Calling"],
      icon: Video,
      sessions: 0,
      minutes: 0,
      earning: "0.0",
    },
    {
      title: ["Chat Con", "sultation"],
      icon: MessageSquare,
      sessions: 0,
      minutes: 0,
      earning: "0.0",
    },
    {
      title: ["Live", "Session"],
      icon: Radio,
      sessions: 0,
      minutes: 0,
      earning: "0.0",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      {/* Top Header Row */}
      <div className="relative flex items-center justify-center px-6 pt-7 pb-5 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[21px] font-semibold text-center">Astro Report</h1>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-t-[32px] flex-1 px-5 pt-6 pb-6 overflow-y-auto flex flex-col gap-5 shadow-2xl">
        
        {/* Green Earnings Card */}
        <div className="bg-[#4CAF50] rounded-[24px] p-6 text-white relative shadow-md flex-shrink-0">
          <div className="absolute top-4 right-4 flex items-center gap-0.5 text-xs bg-white/15 px-3 py-1 rounded-full cursor-pointer hover:bg-white/25 transition-colors font-medium">
            <span>All</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
          <div className="text-center mt-3">
            <p className="text-[20px] font-bold tracking-wide">Total Earnings</p>
            <p className="text-[26px] mt-2 font-medium tracking-wide">
              INR ~ <span className="italic font-extrabold text-[32px]">0.0</span>
            </p>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 gap-4">
          {categories.map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)] border border-gray-100/50 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Icon className="w-6 h-6 text-gray-700 flex-shrink-0" />
                  <div className="font-bold text-gray-800 text-[14px] leading-tight">
                    {c.title[0]}<br />{c.title[1]}
                  </div>
                </div>
                <div className="text-gray-500 text-[13.5px] font-medium space-y-1">
                  <p>Sessions : <span className="text-[#3B82F6] font-bold ml-1">{c.sessions}</span></p>
                  <p>Minutes : <span className="text-[#3B82F6] font-bold ml-1">{c.minutes}</span></p>
                  <p>Earning : <span className="text-[#3B82F6] font-bold ml-1">{c.earning}</span></p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

function LiveChatView({ onBack, onSimulateDemo, onSelectChat }) {
  const [historyChats, setHistoryChats] = useState([]);

  useEffect(() => {
    const loadHistory = () => {
      fetchChatHistoryApi().then((data) => {
        if (data && data.length > 0) {
          setHistoryChats(data);
        }
      });
    };
    loadHistory();
    const interval = setInterval(loadHistory, 3000);
    return () => clearInterval(interval);
  }, []);

  const dummyChats = [
    {
      sessionId: "demo_session_101",
      user: {
        name: "Rahul Sharma",
        avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80",
        dob: "14 May 1996",
        tob: "08:45 AM",
        pob: "Dehradun, UK",
        topic: "Career & Job Growth",
      },
      perMinuteRate: 20,
      message: "Mera career kaisa rahega is saal?",
      time: "Just now",
      unread: 1,
    },
    {
      sessionId: "demo_session_102",
      user: {
        name: "Priya Singh",
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
        dob: "22 Aug 1998",
        tob: "11:20 PM",
        pob: "Delhi",
        topic: "Marriage & Relationship",
      },
      perMinuteRate: 25,
      message: "Kya meri shadi jaldi hogi?",
      time: "10 mins ago",
      unread: 0,
    },
    {
      sessionId: "demo_session_103",
      user: {
        name: "Amit Verma",
        avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80",
        dob: "05 Nov 1992",
        tob: "04:15 PM",
        pob: "Jaipur",
        topic: "Business Loss",
      },
      perMinuteRate: 20,
      message: "Business mein loss ho raha hai kya karein...",
      time: "1 hour ago",
      unread: 0,
    },
  ];

  const chats = historyChats.length > 0 ? historyChats : dummyChats;

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      {/* Top Header Row */}
      <div className="relative flex items-center justify-center px-6 pt-7 pb-5 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[21px] font-semibold text-center">Live Chat Consultations</h1>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-t-[32px] flex-1 px-5 pt-5 pb-5 overflow-y-auto flex flex-col gap-4 shadow-2xl">
        
        {/* Test Incoming Request Button for Instant Demo */}
        <button
          onClick={onSimulateDemo}
          className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white rounded-[20px] p-4 shadow-lg border border-emerald-400/40 flex items-center justify-between transition-all active:scale-98 hover:brightness-105 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" />
            </div>
            <div className="text-left">
              <p className="font-extrabold text-[14.5px] leading-tight">Test Incoming Chat Request</p>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">Click to simulate User Request & Alert sound</p>
            </div>
          </div>
          <div className="bg-white text-emerald-700 p-2 rounded-full font-bold shadow-sm">
            <Play className="w-4 h-4 fill-emerald-700" />
          </div>
        </button>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mt-1">Recent & Active Conversations</h3>

        {chats.map((c, i) => (
          <div
            key={c.sessionId || i}
            onClick={() => onSelectChat(c)}
            className="bg-white rounded-[20px] shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-gray-100 p-3.5 flex items-center justify-between transition-all active:scale-98 hover:bg-orange-50/30 cursor-pointer"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative">
                <img
                  src={c.user?.avatar || c.avatar || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80"}
                  alt={c.user?.name || c.name}
                  className="w-[52px] h-[52px] rounded-full object-cover border border-gray-100"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-850 text-[15.5px] leading-snug">{c.user?.name || c.name}</p>
                  <span className="text-[10.5px] font-extrabold bg-orange-100 text-[#ff7448] px-2 py-0.5 rounded-full">
                    ₹{c.perMinuteRate || 20}/min
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate mt-1 text-[13.5px] font-medium leading-none">
                  {c.message || "Click to view live chat session"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="text-xs text-gray-400 font-medium">{c.time || "now"}</span>
              <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center shadow-sm">
                <MessageCircle className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function RatingsView({ onBack }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        // Retrieve astro ID securely
        let astroId = "";
        const keys = ["astrologerUser", "user", "astrologer", "userData", "profile"];
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              const id = parsed._id || parsed.id || parsed.astrologerId || parsed.userId;
              if (id) {
                astroId = String(id);
                break;
              }
            } catch {}
          }
        }
        if (!astroId) {
          astroId = localStorage.getItem("astrologerId") || localStorage.getItem("userId") || "";
        }
        if (astroId) {
          const response = await fetch(`${BACKEND_URL}/api/astro/reviews/${astroId}`);
          const resData = await response.json();
          if (response.ok && resData.success) {
            setReviews(resData.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : "0.0";

  const totalPages = Math.ceil(totalReviews / itemsPerPage);
  const displayedReviews = reviews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i <= 2 || // First 2 pages
        i >= totalPages - 1 || // Last 2 pages
        (i >= currentPage - 1 && i <= currentPage + 1) // 1 page around current page
      ) {
        pages.push(i);
      }
    }
    
    // Insert "..." where there are gaps
    const formattedPages = [];
    let prev = null;
    for (const page of pages) {
      if (prev !== null) {
        if (page - prev === 2) {
          formattedPages.push(prev + 1);
        } else if (page - prev > 2) {
          formattedPages.push("...");
        }
      }
      formattedPages.push(page);
      prev = page;
    }
    return formattedPages;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      {/* Top Header Row */}
      <div className="relative flex items-center justify-center px-6 pt-7 pb-5 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[21px] font-semibold text-center">User Ratings</h1>
      </div>
      {/* Main Content Area */}
      <div className="bg-white rounded-t-[32px] flex-1 px-5 pt-6 pb-6 overflow-y-auto flex flex-col justify-between shadow-2xl">
        <div className="flex flex-col gap-6 flex-1">
          <div className="flex items-center gap-6 p-5 rounded-[24px] bg-[#ff7448]/5 border border-[#ff7448]/10 flex-shrink-0">
            <div className="text-4xl font-extrabold text-[#ff7448]">{avgRating}</div>
            <div>
              <div className="flex gap-1 text-yellow-500 text-lg">
                {"★".repeat(Math.round(Number(avgRating)) || 0)}
                {"☆".repeat(5 - (Math.round(Number(avgRating)) || 0))}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Based on {totalReviews} reviews</p>
            </div>
          </div>
          <div className="space-y-4 flex-1">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <span className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">
                No user reviews or ratings submitted yet.
              </div>
            ) : (
              displayedReviews.map((r) => (
                <div key={r.id || r._id} className="p-4 rounded-[20px] bg-gray-50 border border-gray-100 shadow-3xs">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{r.name || r.userName || "Client User"}</p>
                      <span className="text-[10px] text-gray-400 font-medium">{r.type || "Consultation"}</span>
                    </div>
                    <div className="text-yellow-500 text-sm">{"★".repeat(r.rating || 5)}</div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.comment || r.review || "No review text submitted."}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 pt-4 border-t border-gray-100 flex-shrink-0">
            {/* Prev Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95"
            >
              &lt;
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, idx) => {
                if (page === "...") {
                  return (
                    <span key={`dots-${idx}`} className="w-9 h-9 flex items-center justify-center text-gray-400 font-semibold select-none">
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={`page-${page}`}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-xl font-bold text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                      currentPage === page
                        ? "bg-[#ff7448] text-white shadow-md shadow-orange-500/20"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95"
            >
              &gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CallHistoryView({ onBack, onSimulateCall }) {
  const [historyCalls, setHistoryCalls] = useState([]);

  useEffect(() => {
    fetchCallHistoryApi().then((data) => {
      if (data && data.length > 0) {
        setHistoryCalls(data);
      }
    });
  }, []);

  const dummyCalls = [
    { _id: 1, user: { firstname: "Sneha", lastname: "Nair" }, totalDurationMinutes: 12, createdAt: "Today, 10:30 AM", callType: "AUDIO" },
    { _id: 2, user: { firstname: "Rohan", lastname: "Das" }, totalDurationMinutes: 25, createdAt: "Yesterday, 6:15 PM", callType: "VIDEO" },
    { _id: 3, user: { firstname: "Vikram", lastname: "Jeet" }, totalDurationMinutes: 8, createdAt: "14 July, 2:40 PM", callType: "AUDIO" },
  ];

  const calls = historyCalls.length > 0 ? historyCalls : dummyCalls;

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      {/* Top Header Row */}
      <div className="relative flex items-center justify-center px-6 pt-7 pb-5 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[21px] font-semibold text-center">Audio & Video Call Logs</h1>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-t-[32px] flex-1 px-5 pt-5 pb-6 overflow-y-auto flex flex-col gap-4 shadow-2xl">
        
        {/* Test Call Simulation Banner */}
        <div className="bg-gradient-to-r from-purple-950 via-gray-900 to-slate-900 text-white rounded-[24px] p-4 shadow-xl border border-purple-500/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
              <span>TEST CALL SIGNALS & STREAM</span>
            </div>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 font-extrabold">Agora RTC</span>
          </div>

          <p className="text-xs text-gray-300 font-medium">Click below to simulate incoming user Audio or Video calls with ring sound & dynamic token streaming:</p>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => onSimulateCall && onSimulateCall("AUDIO")}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Test Audio Call</span>
            </button>

            <button
              onClick={() => onSimulateCall && onSimulateCall("VIDEO")}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Test Video Call</span>
            </button>
          </div>
        </div>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mt-1">Recent Call History</h3>

        {calls.map((c, i) => {
          const userName = c.user ? `${c.user.firstname || c.user.name || "Client"} ${c.user.lastname || ""}`.trim() : (c.name || "Client User");
          const isVideo = (c.callType || "AUDIO").toUpperCase() === "VIDEO";
          const durText = c.totalDurationMinutes ? `${c.totalDurationMinutes} mins` : (c.duration || "5 mins");
          const dateText = c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : (c.time || "Recent");

          return (
            <div key={c._id || i} className="flex justify-between items-center p-4 rounded-[20px] bg-gray-50 border border-gray-100 hover:bg-gray-100/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isVideo ? "bg-purple-100 text-purple-600" : "bg-emerald-100 text-emerald-600"}`}>
                  {isVideo ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-850">{userName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{dateText} • {isVideo ? "Video" : "Audio"} Call</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-600 bg-white shadow-sm border border-gray-100 px-3 py-1 rounded-full">{durText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function AudioCallView({ onBack, onSimulateCall, onStartCall }) {
  const clients = [
    { id: "ac1", name: "Rahul Sharma", topic: "Career & Kundli Analysis", rate: 25, avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80", status: "Online" },
    { id: "ac2", name: "Karan Gupta", topic: "Marriage & Compatibility", rate: 25, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80", status: "Waiting for Voice Call" },
    { id: "ac3", name: "Vikram Jeet", topic: "Financial Loss Remedy", rate: 25, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80", status: "Online" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      <div className="relative flex items-center justify-center px-6 pt-7 pb-5 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[21px] font-semibold text-center">Voice Calling Consultations</h1>
      </div>

      <div className="bg-white rounded-t-[32px] flex-1 px-5 pt-5 pb-5 overflow-y-auto flex flex-col gap-4 shadow-2xl">
        <button
          onClick={() => onSimulateCall("AUDIO")}
          className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-[20px] p-4 shadow-lg border border-emerald-400/40 flex items-center justify-between transition-all active:scale-98 hover:brightness-105 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Mic className="w-5 h-5 text-emerald-200 animate-pulse" />
            </div>
            <div className="text-left">
              <p className="font-extrabold text-[14.5px] leading-tight">Simulate Audio Call Request</p>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">Test HD Voice Stream & Ringtone alert</p>
            </div>
          </div>
          <div className="bg-white text-emerald-800 p-2 rounded-full font-bold shadow-sm">
            <Play className="w-4 h-4 fill-emerald-800" />
          </div>
        </button>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mt-1">Available Voice Call Clients</h3>

        {clients.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-[20px] shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-gray-100 p-3.5 flex items-center justify-between transition-all hover:bg-emerald-50/20"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative">
                <img src={c.avatar} alt={c.name} className="w-[50px] h-[50px] rounded-full object-cover border border-gray-100" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-850 text-[15px]">{c.name}</p>
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">₹{c.rate}/min</span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.topic}</p>
              </div>
            </div>

            <button
              onClick={() => onStartCall && onStartCall({ user: c, callType: "AUDIO", perMinuteRate: c.rate })}
              className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 font-bold text-xs"
              title="Start Audio Call"
            >
              <Mic className="w-4 h-4 fill-white" />
              <span>Call</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoCallView({ onBack, onSimulateCall, onStartCall }) {
  const clients = [
    { id: "vc1", name: "Ananya Verma", topic: "Face Reading & Kundli Analysis", rate: 40, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80", status: "Ready for Video" },
    { id: "vc2", name: "Priya Singh", topic: "Palmistry & Relationship", rate: 40, avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80", status: "Online" },
    { id: "vc3", name: "Sneha Nair", topic: "Detailed Horoscope Video", rate: 40, avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80", status: "Online" },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      <div className="relative flex items-center justify-center px-6 pt-7 pb-5 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[21px] font-semibold text-center">HD Video Calling Consultations</h1>
      </div>

      <div className="bg-white rounded-t-[32px] flex-1 px-5 pt-5 pb-5 overflow-y-auto flex flex-col gap-4 shadow-2xl">
        <button
          onClick={() => onSimulateCall("VIDEO")}
          className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white rounded-[20px] p-4 shadow-lg border border-purple-400/40 flex items-center justify-between transition-all active:scale-98 hover:brightness-105 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-purple-200 animate-pulse" />
            </div>
            <div className="text-left">
              <p className="font-extrabold text-[14.5px] leading-tight">Simulate Video Call Request</p>
              <p className="text-xs text-purple-100 font-medium mt-0.5">Test HD Video Stream & Camera preview</p>
            </div>
          </div>
          <div className="bg-white text-purple-800 p-2 rounded-full font-bold shadow-sm">
            <Play className="w-4 h-4 fill-purple-800" />
          </div>
        </button>

        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mt-1">Available Video Call Clients</h3>

        {clients.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-[20px] shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-gray-100 p-3.5 flex items-center justify-between transition-all hover:bg-purple-50/20"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative">
                <img src={c.avatar} alt={c.name} className="w-[50px] h-[50px] rounded-full object-cover border border-gray-100" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-850 text-[15px]">{c.name}</p>
                  <span className="text-[10px] font-extrabold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">₹{c.rate}/min</span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.topic}</p>
              </div>
            </div>

            <button
              onClick={() => onStartCall && onStartCall({ user: c, callType: "VIDEO", perMinuteRate: c.rate })}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 font-bold text-xs"
              title="Start Video Call"
            >
              <Video className="w-4 h-4 fill-white" />
              <span>Video Call</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


function ProfileView({ onBack, onLogout }) {
  const savedAstro = (() => {
    try {
      const keys = ["astrologerUser", "astrologer_profile_data", "astrologer_profile_draft", "user"];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) {
          const p = JSON.parse(v);
          if (p.name || p.firstname || p.astrologerName || p.email) return p;
        }
      }
    } catch {}
    return {};
  })();

  const [isEditing, setIsEditing] = useState(false);
  const [avatar, setAvatar] = useState(savedAstro.profileImage || savedAstro.avatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Editable Profile States initialized dynamically
  const [name, setName] = useState(savedAstro.name || savedAstro.firstname || savedAstro.astrologerName || "Sanjeev Baba");
  const [eid, setEid] = useState(savedAstro._id ? `KALP-${String(savedAstro._id).slice(-6).toUpperCase()}` : "KALP2434");
  const [email, setEmail] = useState(savedAstro.email || "astrologer@kalpjoytish.com");
  const [phone, setPhone] = useState(savedAstro.phone || savedAstro.mobile || "9876543210");
  const [experience, setExperience] = useState(savedAstro.experience ? `${savedAstro.experience} Years` : "5 Years");
  const [age, setAge] = useState(savedAstro.age || "32");
  const [gender, setGender] = useState(savedAstro.gender || "Male");
  const [stateVal, setStateVal] = useState(savedAstro.state || "Uttarakhand");
  const [city, setCity] = useState(savedAstro.city || "Dehradun");
  const [address, setAddress] = useState(savedAstro.address || "Dehradun, Uttarakhand");
  const [district, setDistrict] = useState(savedAstro.district || "Dehradun");
  const [skills, setSkills] = useState(
    Array.isArray(savedAstro.specialization) 
      ? savedAstro.specialization.join(", ") 
      : (savedAstro.specialization || savedAstro.skills || "Vedic Astrology, Kundli, Love & Career")
  );

  const [chatPrice, setChatPrice] = useState(savedAstro.chatPrice || 20);
  const [audioPrice, setAudioPrice] = useState(savedAstro.audioCallPrice || 25);
  const [videoPrice, setVideoPrice] = useState(savedAstro.videoCallPrice || 40);

  const fields = [
    {
      label: "Email",
      value: email,
      setValue: setEmail,
      icon: Mail,
      type: "email",
    },
    {
      label: "Phone",
      value: phone,
      setValue: setPhone,
      icon: Phone,
      type: "tel",
    },
    {
      label: "Experience",
      value: experience,
      setValue: setExperience,
      icon: Briefcase,
      type: "text",
    },
    {
      label: "Age",
      value: age,
      setValue: setAge,
      icon: User,
      type: "number",
    },
    {
      label: "Gender",
      value: gender,
      setValue: setGender,
      icon: Mars,
      type: "text",
    },
    {
      label: "State",
      value: stateVal,
      setValue: setStateVal,
      icon: Sliders,
      type: "text",
    },
    {
      label: "City",
      value: city,
      setValue: setCity,
      icon: Building,
      type: "text",
    },
    {
      label: "Address",
      value: address,
      setValue: setAddress,
      icon: Compass,
      type: "text",
    },
    {
      label: "District",
      value: district,
      setValue: setDistrict,
      icon: MapPin,
      type: "text",
    },
    {
      label: "Skills",
      value: skills,
      setValue: setSkills,
      icon: Sparkles,
      type: "text",
    },
    {
      label: "Chat Rate (₹/min)",
      value: 9,
      setValue: () => {},
      icon: MessageSquare,
      type: "number",
      disabled: true,
    },
    {
      label: "Audio Call Rate (₹/min)",
      value: 9,
      setValue: () => {},
      icon: Phone,
      type: "number",
      disabled: true,
    },
    {
      label: "Video Call Rate (₹/min)",
      value: 9,
      setValue: () => {},
      icon: Video,
      type: "number",
      disabled: true,
    },
  ];

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadingAvatar(true);
      try {
        const uploadedUrl = await uploadImageApi(file);
        setAvatar(uploadedUrl);
      } catch (err) {
        console.error("Avatar upload error:", err);
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (isEditing) {
      const payload = {
        name,
        email,
        phone,
        profileImage: avatar,
        profilePhoto: avatar,
        avatar: avatar,
        experience: experience.replace(/[^0-9]/g, ""),
        age,
        gender,
        state: stateVal,
        city,
        address,
        district,
        chatPrice: Number(chatPrice) || 20,
        audioCallPrice: Number(audioPrice) || 25,
        videoCallPrice: Number(videoPrice) || 40,
        specialization: skills.split(",").map(s => s.trim()),
      };
      try {
        const res = await updateAstroProfileApi(savedAstro._id, payload);
        if (res.success && res.data) {
          // Save updated profile back to localStorage
          localStorage.setItem("astrologerUser", JSON.stringify(res.data));
          localStorage.setItem("user", JSON.stringify(res.data));
          alert("Profile updated successfully!");
        }
      } catch (err) {
        alert("Failed to save changes: " + err.message);
      }
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#ff8f6c] to-[#ff5c33] overflow-hidden">
      {/* Top Header Row */}
      <div className="relative flex items-center justify-center px-6 pt-7 pb-4 text-white flex-shrink-0">
        <button onClick={onBack} className="absolute left-6 hover:opacity-80 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[20px] font-semibold text-center">Astrologer Profile</h1>
        <button
          onClick={handleSaveProfile}
          className="absolute right-6 bg-white text-[#ff7448] px-4 py-1.5 rounded-full text-[14px] font-extrabold transition-all active:scale-95 cursor-pointer shadow-md hover:bg-white/95"
        >
          {isEditing ? "Save" : "Edit"}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#F4F5FB] rounded-t-[32px] flex-1 px-5 pt-4 pb-4 overflow-y-auto flex flex-col gap-4 shadow-2xl">
        
        {/* Profile Card Container */}
        <div className="bg-white rounded-[20px] p-4 shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-gray-100/40 flex flex-col items-center gap-3 flex-shrink-0">
          {/* Logo Circle */}
          <div className="w-[94px] h-[94px] rounded-full bg-gradient-to-tr from-[#ff7448] via-[#ff8e6c] to-[#D53F8C] flex flex-col items-center justify-center text-center shadow-md border-3 border-white overflow-hidden relative">
            {uploadingAvatar ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : avatar ? (
              <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[8px] font-black text-white tracking-tighter leading-none text-center p-2">
                DIGITAL IN APP™
              </span>
            )}

            {isEditing && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white transition-opacity hover:bg-black/50">
                <Camera className="w-6 h-6" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            )}
          </div>

          {isEditing ? (
            <div className="flex flex-col items-center gap-1.5 w-full">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-center font-bold text-gray-850 text-[18px] bg-transparent border-b border-[#ff7448]/30 focus:border-[#ff7448] focus:outline-none w-2/3 pb-0.5"
                placeholder="Username"
              />
              <input
                type="text"
                value={eid}
                onChange={(e) => setEid(e.target.value)}
                className="text-center font-bold text-[#ff7448] text-[13px] bg-transparent border-b border-[#ff7448]/30 focus:border-[#ff7448] focus:outline-none w-1/2 pb-0.5"
                placeholder="EID"
              />
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-[20px] font-bold text-gray-800 leading-none mt-0.5">{name}</h2>
              <p className="text-[14px] font-bold text-[#ff7448] tracking-wide leading-none mt-1.5">EID: {eid}</p>
            </div>
          )}
        </div>

        {/* Info List */}
        <div className="flex flex-col gap-3">
          {fields.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-5 bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-gray-100/40 px-5 h-[72px] flex-shrink-0"
              >
                <div className="text-[#ff7448] flex-shrink-0 pl-1">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-400 font-medium">{f.label}</p>
                  {isEditing ? (
                    <input
                      type={f.type}
                      value={f.value}
                      onChange={(e) => f.setValue(e.target.value)}
                      disabled={f.disabled}
                      className="w-full bg-transparent border-b border-[#ff7448]/25 focus:border-[#ff7448] focus:outline-none text-[15px] font-bold text-gray-850 pb-0.5 mt-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  ) : (
                    <p className="text-[16px] font-bold text-gray-850 mt-0.5 truncate">{f.value}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Logout Button */}
          <div
            onClick={onLogout || onBack}
            className="bg-[#FFEAEA] border border-[#FFD2D2] rounded-[22px] px-5 h-[76px] flex items-center justify-between mt-2 cursor-pointer hover:bg-[#FFD6D6] transition-all active:scale-98 flex-shrink-0"
          >
            <span className="text-[#D32F2F] font-bold text-[18px]">Logout</span>
            <div className="w-12 h-12 rounded-[14px] bg-[#FFCDCD] border border-[#FFA1A1] flex items-center justify-center text-[#D32F2F] flex-shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function Dashboard({ onLogout, initialOpenWithdraw = false }) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("grid");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(initialOpenWithdraw);
  const [summaryData, setSummaryData] = useState(null);
  const [infoPopup, setInfoPopup] = useState(null);
  
  // Chat States
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [activeChatSession, setActiveChatSession] = useState(null);

  // Audio & Video Call States
  const [incomingCallRequest, setIncomingCallRequest] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);

  // Guard ref: only redirect back to dashboard AFTER a session was previously active.
  // Without this, on page refresh the redirect fires immediately (both states null)
  // and kicks the astrologer out of the call page before the session can be restored.
  const hadActiveSession = useRef(false);

  // Redirect to unique URL when call session starts
  useEffect(() => {
    if (activeCallSession) {
      hadActiveSession.current = true;
      const sId = activeCallSession.sessionId || activeCallSession._id || activeCallSession.id;
      const pathType = String(activeCallSession.callType || "AUDIO").toUpperCase() === "VIDEO" ? "video" : "call";
      if (sId && !window.location.pathname.includes(`/${pathType}/${sId}`)) {
        navigate(`/${pathType}/${sId}`, { replace: true });
      }
    }
  }, [activeCallSession]);

  // Redirect to unique URL when chat session starts
  useEffect(() => {
    if (activeChatSession) {
      hadActiveSession.current = true;
      const sId = activeChatSession.sessionId || activeChatSession._id || activeChatSession.id;
      if (sId && !window.location.pathname.includes(`/chat/${sId}`)) {
        navigate(`/chat/${sId}`, { replace: true });
      }
    }
  }, [activeChatSession]);

  // Redirect back ONLY after a session was active (not on initial mount/refresh)
  useEffect(() => {
    if (!activeCallSession && !activeChatSession && hadActiveSession.current) {
      if (!["/dashboard", "/wallet", "/withdraw"].includes(window.location.pathname)) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [activeCallSession, activeChatSession]);

  const { sessionId } = useParams();

  // Warn astrologer before leaving an active session via back/refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeCallSession || activeChatSession) {
        e.preventDefault();
        e.returnValue = "Your session is still active. Leaving will disconnect you.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeCallSession, activeChatSession]);

  // Restore session from URL after refresh (skip if socket already provided a session)
  useEffect(() => {
    if (!sessionId || activeCallSession || activeChatSession) return;
    const loadSession = async () => {
      try {
        const res = await axiosInstance.get(`/api/calls/${sessionId}`);
        const session = res.data.session || res.data.data || res.data;
        if (!session || typeof session !== "object") return;

        // If session is already COMPLETED, navigate back silently
        if (session.status && !["ACTIVE", "PENDING"].includes(session.status)) {
          console.log("Session already completed, returning to dashboard.");
          navigate("/dashboard", { replace: true });
          return;
        }

        // Session is ACTIVE — restore it so ActiveCallModal / ChatModal reopens.
        // API now returns appId, agoraToken, channelName for Agora rejoin.
        if (window.location.pathname.includes("/chat")) {
          setActiveChatSession(session);
        } else {
          setActiveCallSession(session);
        }
      } catch (err) {
        console.warn("Could not restore session from URL:", err?.response?.status, sessionId);
        navigate("/dashboard", { replace: true });
      }
    };
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    // Connect to Socket.io backend on Dashboard load
    connectSocket();

    // 1. Chat Socket Subscriptions
    const unsubRequest = subscribeSocketEvent("incomingRequest", (reqData) => {
      console.log("⚡ Real-time chat request received on Dashboard:", reqData);
      setIncomingRequest(reqData);
    });

    const unsubEndedGlobal = subscribeSocketEvent("chatEnded", (data) => {
      console.log("🔴 Global chatEnded event on Dashboard:", data);

      // ✅ Auto-close the incoming chat request overlay if cancelled
      let wasIncomingActive = false;
      setIncomingRequest(prev => {
        const id = data?.sessionId || data?.chatId || data?.id || "";
        if (prev && (prev.sessionId === id || prev._id === id || prev.id === id)) {
          wasIncomingActive = true;
          return null;
        }
        return prev;
      });
      if (wasIncomingActive) {
        setInfoPopup({
          title: "Request Cancelled",
          message: "The user has cancelled the chat session request. You can consult other clients."
        });
      }
    });

    // 2. Audio/Video Call Socket Subscriptions
    const unsubCallRequest = subscribeSocketEvent("incomingCallRequest", (callData) => {
      console.log("📞 Real-time call request received on Dashboard:", callData);
      setIncomingCallRequest(callData);
    });

    const unsubCallEnded = subscribeSocketEvent("callEnded", (data) => {
      console.log("🔴 Call ended on Dashboard - clearing active call:", data);
      // ✅ Auto-close the incoming call request overlay if cancelled
      let wasIncomingActive = false;
      setIncomingCallRequest(prev => {
        const id = data?.sessionId || data?.callId || data?.id || "";
        if (prev && (prev.sessionId === id || prev._id === id || prev.id === id)) {
          wasIncomingActive = true;
          return null;
        }
        return prev;
      });
      if (wasIncomingActive) {
        setInfoPopup({
          title: "Request Cancelled",
          message: "The user has cancelled the call session request. You can consult other clients."
        });
      }
    });

    const unsubCallAccepted = subscribeSocketEvent("call_accepted", (data) => {
      console.log("✅ Call accepted event on Dashboard:", data);
      setIncomingCallRequest(null);
      if (data && (data.channelName || data.callId)) {
        setActiveCallSession(data);
      }
    });

    // Fallback REST Polling every 2.5 seconds to guarantee instant reception of call & chat requests
    const pollInterval = setInterval(async () => {
      if (!incomingRequest && !activeChatSession) {
        const pendingReq = await checkPendingRequestsApi();
        if (pendingReq) {
          console.log("📥 Pending chat request fetched via REST polling:", pendingReq);
          setIncomingRequest(pendingReq);
        }
      }

      if (!incomingCallRequest && !activeCallSession) {
        const pendingCall = await checkPendingCallRequestsApi();
        if (pendingCall) {
          console.log("📞 Pending call request fetched via REST polling:", pendingCall);
          setIncomingCallRequest(pendingCall);
        }
      }
    }, 2500);


    return () => {
      unsubRequest();
      unsubEndedGlobal();
      unsubCallRequest();
      unsubCallEnded();
      unsubCallAccepted();
      clearInterval(pollInterval);
    };
  }, [incomingRequest, activeChatSession, incomingCallRequest, activeCallSession]);

  const handleSimulateDemo = () => {
    const req = triggerDemoIncomingRequest();
    setIncomingRequest(req);
  };

  const handleSimulateDemoCall = (callType = "VIDEO") => {
    const callReq = triggerDemoIncomingCallRequest(callType);
    setIncomingCallRequest(callReq);
  };

  const handleAcceptRequest = (req) => {
    setIncomingRequest(null);
    setActiveChatSession(req);
  };

  const handleDeclineRequest = () => {
    setIncomingRequest(null);
  };

  const handleAcceptCallRequest = (callReq) => {
    setIncomingCallRequest(null);
    setActiveCallSession(callReq);
  };

  const handleDeclineCallRequest = () => {
    setIncomingCallRequest(null);
  };

  const handleCardClick = (view) => {
    if (view === "withdraw") {
      setIsWithdrawModalOpen(true);
    } else {
      setActiveView(view);
    }
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "report":
        return <ReportView onBack={() => setActiveView("grid")} />;
      case "audio-call":
        return (
          <AudioCallView
            onBack={() => setActiveView("grid")}
            onSimulateCall={handleSimulateDemoCall}
            onStartCall={(callData) => {
              setActiveCallSession({
                callId: "call_" + Date.now(),
                channelName: "channel_" + Date.now(),
                user: callData.user,
                callType: "AUDIO",
                perMinuteRate: callData.perMinuteRate || 25,
                appId: import.meta.env.VITE_AGORA_APP_ID || ""
              });
            }}
          />
        );
      case "video-call":
        return (
          <VideoCallView
            onBack={() => setActiveView("grid")}
            onSimulateCall={handleSimulateDemoCall}
            onStartCall={(callData) => {
              setActiveCallSession({
                callId: "call_" + Date.now(),
                channelName: "channel_" + Date.now(),
                user: callData.user,
                callType: "VIDEO",
                perMinuteRate: callData.perMinuteRate || 40,
                appId: import.meta.env.VITE_AGORA_APP_ID || ""
              });
            }}
          />
        );
      case "live-chat":
        return (
          <LiveChatView 
            onBack={() => setActiveView("grid")} 
            onSimulateDemo={handleSimulateDemo}
            onSelectChat={(chatItem) => setActiveChatSession(chatItem)}
          />
        );
      case "ratings":
        return <RatingsView onBack={() => setActiveView("grid")} />;
      case "call-history":
        return (
          <CallHistoryView 
            onBack={() => setActiveView("grid")} 
            onSimulateCall={handleSimulateDemoCall}
          />
        );
      case "profile":
        return <ProfileView onBack={() => setActiveView("grid")} onLogout={onLogout} />;
      default:
        return <DashboardGrid onCardClick={handleCardClick} />;
    }
  };


  return (
    <div className="h-screen bg-[#F4F5FB] flex justify-center overflow-hidden relative">
      <div className="w-full md:max-w-[1280px] h-screen bg-[#F4F5FB] overflow-hidden flex flex-col">
        {activeView === "grid" && <Header />}

        <div className={activeView === "grid" ? "px-6 md:px-12 pt-4 pb-4 flex-1 overflow-y-auto" : "flex-1 overflow-hidden flex flex-col"}>
          {renderActiveView()}
        </div>
      </div>

      {/* Withdraw Modal directly triggered from Dashboard Grid */}
      <WalletModal 
        isOpen={isWithdrawModalOpen} 
        onClose={() => setIsWithdrawModalOpen(false)} 
        initialWithdrawOpen={true} 
      />

      {/* Incoming User Chat Request Alert Modal */}
      {incomingRequest && (
        <IncomingChatModal
          request={incomingRequest}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
        />
      )}

      {/* Active Live Chat Session Window */}
      {activeChatSession && (
        <ActiveChatModal
          session={activeChatSession}
          onClose={(summary) => {
            setActiveChatSession(null);
            if (summary) setSummaryData(summary);
          }}
        />
      )}

      {/* Incoming Audio / Video Call Request Alert Modal */}
      {incomingCallRequest && (
        <IncomingCallModal
          request={incomingCallRequest}
          onAccept={handleAcceptCallRequest}
          onDecline={handleDeclineCallRequest}
        />
      )}

      {/* Active Audio / Video Call Session Window (Agora RTC) */}
      {activeCallSession && (
        <ActiveCallModal
          session={activeCallSession}
          onClose={(summary) => {
            setActiveCallSession(null);
            if (summary) setSummaryData(summary);
          }}
        />
      )}

      {/* Session End Summary Popup Modal */}
      {summaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-gray-150 flex flex-col items-center text-center relative animate-scale-up">
            
            {/* Success Check circle */}
            <div className="w-16 h-16 rounded-full bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-4 shadow-inner">
              <CheckCircle size={36} className="stroke-[2.5]" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">Session Summary</h3>
            <p className="text-xs text-gray-400 mt-1">Details of your completed consultation</p>

            <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 mt-5 space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Client</span>
                <span className="font-bold text-gray-800">{summaryData.clientName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Service Type</span>
                <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px] bg-orange-100 text-[#ff7448] px-2 py-0.5 rounded-full">
                  {summaryData.type}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-medium">Duration</span>
                <span className="font-bold text-gray-800">{summaryData.duration}</span>
              </div>
              <div className="border-t border-gray-250 pt-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Total Charges (Gross)</span>
                  <span className="font-bold text-gray-700">₹{Number(summaryData.totalDeducted || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Platform Share (40%)</span>
                  <span className="font-bold text-red-500">-₹{Number(summaryData.platformFee || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-dashed border-gray-250 pt-2.5 flex justify-between items-center text-sm font-extrabold text-gray-900">
                  <span>Your Earnings (60%)</span>
                  <span className="text-emerald-600 text-lg">₹{Number(summaryData.earnings || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSummaryData(null)}
              className="mt-6 w-full py-3 bg-[#4CAF50] hover:bg-[#43a047] text-white rounded-2xl font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Custom In-App Alert Popup Modal */}
      {infoPopup && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-gray-150 flex flex-col items-center text-center relative animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-[#ff7448] flex items-center justify-center mb-4 shadow-sm">
              <ShieldAlert size={36} className="stroke-[2.5]" />
            </div>

            <h3 className="text-lg font-bold text-gray-900">{infoPopup.title}</h3>
            <p className="text-xs text-gray-500 mt-2 px-2 leading-relaxed">
              {infoPopup.message}
            </p>

            <button
              onClick={() => setInfoPopup(null)}
              className="mt-6 w-full py-3 bg-[#ff7448] hover:bg-[#e05e30] text-white rounded-2xl font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer"
            >
              OK, Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

