import { useEffect, useState } from "react";
import { fetchFollowersApi } from "../config/api";
import {
  Users,
  FileText,
  MessageSquare,
  Star,
  Phone,
  User,
  Wallet,
  Mic,
  Video
} from "lucide-react";

import DashboardCard from "./DashboardCard";

export default function DashboardGrid({ onCardClick }) {
  const [followerCount, setFollowerCount] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchFollowersApi(1).then((d) => { if (alive) setFollowerCount(d.total); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="pt-2 pb-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">

        {/* Audio Calling Card */}
        <DashboardCard
          title="Audio Calling"
          subtitle="Voice Consultations"
          badge="₹25/m"
          badgeColor="bg-emerald-100 text-emerald-700"
          icon={Mic}
          onClick={() => onCardClick("audio-call")}
        />

        {/* Video Calling Card */}
        <DashboardCard
          title="Video Calling"
          subtitle="HD Stream Consultation"
          badge="₹40/m"
          badgeColor="bg-purple-100 text-purple-700"
          icon={Video}
          onClick={() => onCardClick("video-call")}
        />

        {/* Live Chats Card */}
        <DashboardCard
          title="Live Chats"
          subtitle="Text Consultation"
          badge="₹20/m"
          badgeColor="bg-orange-100 text-[#ff7448]"
          icon={MessageSquare}
          onClick={() => onCardClick("live-chat")}
        />

        {/* Call Logs & History Card */}
        <DashboardCard
          title="Call History"
          subtitle="Logs & Recordings"
          icon={Phone}
          onClick={() => onCardClick("call-history")}
        />

        {/* Withdraw Earnings Card */}
        <DashboardCard
          title="Withdraw Earnings"
          subtitle="Instant Wallet Cashout"
          icon={Wallet}
          onClick={() => onCardClick("withdraw")}
        />

        {/* Astrologer Report Card */}
        <DashboardCard
          title="Astrologer Report"
          subtitle="Earnings & Stats"
          icon={FileText}
          onClick={() => onCardClick("report")}
        />

        {/* User Ratings Card */}
        <DashboardCard
          title="User Ratings"
          subtitle="Reviews & Feedback"
          icon={Star}
          onClick={() => onCardClick("ratings")}
        />

        {/* Followers Card */}
        <DashboardCard
          title="Followers"
          subtitle="People following you"
          badge={followerCount === null ? undefined : String(followerCount)}
          badgeColor="bg-violet-100 text-violet-700"
          icon={Users}
          onClick={() => onCardClick("followers")}
        />

        {/* Astrologer Profile Card */}
        <DashboardCard
          title="My Profile"
          subtitle="Edit Profile & Rates"
          icon={User}
          onClick={() => onCardClick("profile")}
        />

      </div>
    </div>
  );
}
