import { useState, useEffect } from "react";
import { 
  Wallet, ArrowUpRight, ArrowLeft, X, CheckCircle2, 
  Clock, Landmark, QrCode, AlertCircle, Sparkles, ChevronRight, Loader2, ShieldCheck 
} from "lucide-react";
import { BACKEND_URL } from "../config/api";

export default function WalletModal({ isOpen, onClose, initialWithdrawOpen = false }) {
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [pendingPayout, setPendingPayout] = useState(0);
  const [promoSeconds, setPromoSeconds] = useState(0);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(initialWithdrawOpen);
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("upi"); // "upi" | "bank"
  const [upiId, setUpiId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [transactions, setTransactions] = useState([]);

  const fetchWalletData = async () => {
    try {
      const storedUser = localStorage.getItem("astrologerUser") || localStorage.getItem("astrologer");
      let astroId = null;
      let phone = null;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          astroId = parsed._id || parsed.id || parsed.astrologerId;
          phone = parsed.phone || parsed.mobile;
        } catch (e) {}
      }

      const queryParams = new URLSearchParams();
      if (astroId) queryParams.append("userId", astroId);
      if (phone) queryParams.append("phone", phone);
      queryParams.append("role", "astrologer");

      const token = localStorage.getItem("token") || localStorage.getItem("astrologerToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch Balance
      const balRes = await fetch(`${BACKEND_URL}/api/wallet/balance?${queryParams.toString()}`, { headers });
      if (balRes.ok) {
        const balData = await balRes.json();
        if (balData.success && balData.data) {
          setBalance(balData.data.walletBalance || 0);
          setTotalEarnings(balData.data.totalEarnings || 0);
          setPendingPayout(balData.data.pendingPayout || 0);
          setPromoSeconds(balData.data.promoSecondsPending || 0);
        }
      }

      // Fetch Transactions
      const txRes = await fetch(`${BACKEND_URL}/api/wallet/transactions?${queryParams.toString()}`, { headers });
      if (txRes.ok) {
        const txData = await txRes.json();
        if (txData.success && Array.isArray(txData.data)) {
          const formatted = txData.data.map((tx) => ({
            id: tx.transactionId || tx._id || `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            amount: tx.amount || 0,
            date: tx.date || "Recent",
            method: tx.paymentMethod || tx.description || "Wallet Transaction",
            status: tx.status || "Completed",
            type: tx.type || "debit",
            promoSeconds: tx.promoSeconds || 0
          }));
          setTransactions(formatted);
        }
      }
    } catch (err) {
      console.error("Error fetching wallet data:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsWithdrawOpen(initialWithdrawOpen);
      fetchWalletData();
    }
  }, [isOpen, initialWithdrawOpen]);

  if (!isOpen) return null;

  const handleQuickAmount = (val) => {
    if (val === "all") {
      setAmount(balance.toString());
    } else {
      setAmount(val.toString());
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Please enter a valid withdrawal amount.");
      return;
    }
    if (numAmount < 100) {
      setErrorMsg("Minimum withdrawal amount is ₹100.");
      return;
    }
    if (numAmount > balance) {
      setErrorMsg("Insufficient wallet balance.");
      return;
    }
    if (payoutMethod === "upi" && !upiId.trim()) {
      setErrorMsg("Please enter a valid UPI ID.");
      return;
    }
    if (payoutMethod === "bank" && (!accountNumber.trim() || !ifscCode.trim() || !accountHolder.trim())) {
      setErrorMsg("Please fill in all bank account details.");
      return;
    }

    setLoading(true);
    try {
      const storedUser = localStorage.getItem("astrologerUser") || localStorage.getItem("astrologer");
      let astroId = null;
      let phone = null;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          astroId = parsed._id || parsed.id || parsed.astrologerId;
          phone = parsed.phone || parsed.mobile;
        } catch (err) {}
      }

      const token = localStorage.getItem("token") || localStorage.getItem("astrologerToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const payload = {
        amount: numAmount,
        payoutMethod,
        userId: astroId,
        phone,
        role: "astrologer",
        upiId: payoutMethod === "upi" ? upiId.trim() : undefined,
        accountNumber: payoutMethod === "bank" ? accountNumber.trim() : undefined,
        ifscCode: payoutMethod === "bank" ? ifscCode.trim() : undefined,
        accountHolder: payoutMethod === "bank" ? accountHolder.trim() : undefined
      };

      const res = await fetch(`${BACKEND_URL}/api/wallet/withdraw`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        setSuccessMsg(`Withdrawal request for ₹${numAmount.toLocaleString("en-IN")} submitted successfully!`);
        setAmount("");
        setIsWithdrawOpen(false);
        fetchWalletData();
      } else {
        setErrorMsg(resData.message || "Failed to submit withdrawal request.");
      }
    } catch (err) {
      console.error("Error submitting withdrawal:", err);
      setErrorMsg("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full sm:max-w-[430px] h-screen sm:h-[90vh] bg-[#FAF6F2] sm:rounded-[32px] overflow-hidden flex flex-col relative shadow-2xl border border-gray-100/50">
        
        {/* Top Navigation Header */}
        <div className="bg-gradient-to-r from-[#ff8f6c] via-[#ff7448] to-[#ff5c33] px-5 py-4 text-white flex items-center justify-between shadow-md flex-shrink-0">
          <div className="flex items-center gap-3">
            {isWithdrawOpen ? (
              <button 
                onClick={() => { setIsWithdrawOpen(false); setErrorMsg(""); }}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-[17px] font-bold leading-tight">
                {isWithdrawOpen ? "Withdraw Money" : "Astrologer Wallet"}
              </h2>
              <p className="text-[11px] text-white/80 font-medium">
                {isWithdrawOpen ? "Request instant payout to account" : "Manage earnings & payouts"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          
          {/* Global Toast Messages */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-sm animate-slide-down">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-[13px] text-emerald-800 font-medium leading-snug">
                {successMsg}
              </div>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 shadow-sm animate-slide-down">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-[13px] text-rose-800 font-medium leading-snug">
                {errorMsg}
              </div>
            </div>
          )}

          {/* SCREEN 1: Wallet Overview */}
          {!isWithdrawOpen ? (
            <>
              {/* Balance Card */}
              <div className="bg-gradient-to-tr from-[#1E1B4B] via-[#312E81] to-[#4338CA] rounded-[24px] p-5 text-white shadow-xl relative overflow-hidden flex flex-col gap-4 flex-shrink-0">
                {/* Decorative background glow */}
                <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-[#ff7448]/20 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[12px] font-semibold text-indigo-200/90 tracking-wide uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Available Balance
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                    Verified
                  </span>
                </div>
                <div className="relative z-10">
                  <h1 className="text-[34px] font-extrabold tracking-tight text-white leading-none">
                    ₹ {balance.toLocaleString("en-IN")}
                    <span className="text-[18px] text-indigo-200 font-medium ml-1">.00</span>
                  </h1>
                </div>
                {/* Sub Stats Row */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 relative z-10 text-[12px]">
                  <div>
                    <span className="text-indigo-200/70 block text-[10.5px]">Total Earned</span>
                    <span className="font-bold text-white text-[13.5px]">₹ {totalEarnings.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="text-indigo-200/70 block text-[10.5px]">Pending Payout</span>
                    <span className="font-bold text-amber-300 text-[13.5px]">₹ {pendingPayout.toLocaleString("en-IN")}</span>
                  </div>
                  {promoSeconds > 0 && (
                    <div className="col-span-2 pt-1">
                      <span className="text-indigo-200/70 block text-[10.5px]">Free session time</span>
                      <span className="font-bold text-sky-300 text-[13.5px]">{Math.floor(promoSeconds / 3600) > 0 ? `${Math.floor(promoSeconds / 3600)}h ` : ""}{Math.floor((promoSeconds % 3600) / 60)}m {promoSeconds % 60}s</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 relative z-10 flex-shrink-0">
                <button
                  onClick={() => { setIsWithdrawOpen(true); setErrorMsg(""); setSuccessMsg(""); }}
                  className="w-full bg-gradient-to-r from-[#ff7448] to-[#ff5c33] hover:from-[#e6633b] hover:to-[#e64c24] text-white py-3.5 rounded-2xl font-bold text-[14.5px] shadow-lg shadow-[#ff7448]/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <ArrowUpRight className="w-5 h-5" />
                  Withdraw Money
                </button>
              </div>

              {/* Security Banner */}
              <div className="bg-white rounded-2xl p-3.5 border border-gray-200/60 shadow-sm flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-[12px]">
                  <span className="font-bold text-gray-800 block">Direct Bank & UPI Transfer</span>
                  <span className="text-gray-500">Withdrawals are processed securely within 24 hours.</span>
                </div>
              </div>

              {/* Transactions History Header */}
              <div className="flex items-center justify-between pt-1 flex-shrink-0">
                <h3 className="text-[15px] font-bold text-gray-800">Wallet History</h3>
                <span className="text-[12px] text-[#ff7448] font-semibold">Recent Activity</span>
              </div>

              {/* Transactions List */}
              <div className="flex flex-col gap-2.5 pb-2">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    No transactions found.
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-center justify-between hover:border-gray-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          tx.type === "free"
                            ? "bg-sky-50 text-sky-600 border border-sky-100"
                            : tx.type === "credit"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : tx.status === "Completed" 
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                              : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {tx.type === "credit" ? (
                            <ArrowUpRight className="w-5 h-5 rotate-180 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-bold text-gray-800">
                              {tx.id.startsWith("WDR-") ? tx.id : tx.id.slice(-6).toUpperCase()}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                              tx.type === "credit"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : tx.status === "Completed" 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 block mt-0.5">{tx.method} • {tx.date}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {tx.type === "free" ? (
                          <span className="text-[13.5px] font-bold block text-sky-600">
                            {Math.floor(tx.promoSeconds / 60)}m {tx.promoSeconds % 60}s free
                          </span>
                        ) : (
                          <span className={`text-[14.5px] font-bold block ${tx.type === "credit" ? "text-emerald-600" : "text-gray-900"}`}>
                            {tx.type === "credit" ? "+" : "-"} ₹ {tx.amount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* SCREEN 2: Withdraw Form */
            <form onSubmit={handleWithdrawSubmit} className="flex flex-col gap-4 pb-4 animate-fade-in">
              
              {/* Available Balance Summary */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[11.5px] text-gray-500 font-medium block">Available Balance</span>
                  <span className="text-[20px] font-extrabold text-gray-900">₹ {balance.toLocaleString("en-IN")}</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-[#FFF0E6] text-[#ff7448] flex items-center justify-center font-bold">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>

              {/* Amount Input */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex flex-col gap-3">
                <label className="text-[13px] font-bold text-gray-700">Enter Withdrawal Amount</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-gray-400 text-[20px] font-bold">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-[#FAF6F2] border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-[20px] font-extrabold text-gray-900 focus:outline-none focus:border-[#ff7448] transition-all"
                  />
                </div>
                {/* Quick Selection Chips */}
                <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
                  {[500, 1000, 2500, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAmount(val)}
                      className="px-4 py-2 rounded-full border border-gray-200 text-[12.5px] font-bold bg-[#FAF6F2] text-gray-700 hover:border-[#ff7448] hover:text-[#ff7448] transition-all cursor-pointer whitespace-nowrap"
                    >
                      ₹ {val.toLocaleString("en-IN")}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickAmount("all")}
                    className="px-4 py-2 rounded-full border border-gray-200 text-[12.5px] font-bold bg-[#FAF6F2] text-[#ff7448] hover:border-[#ff7448] transition-all cursor-pointer whitespace-nowrap"
                  >
                    Withdraw All
                  </button>
                </div>
              </div>

              {/* Payout Method Selection */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex flex-col gap-3.5">
                <label className="text-[13px] font-bold text-gray-700">Select Payout Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod("upi")}
                    className={`py-3.5 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition-all cursor-pointer ${
                      payoutMethod === "upi"
                        ? "border-[#ff7448] bg-[#FFF0E6] text-[#ff7448]"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                    <span className="text-[13px]">UPI Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod("bank")}
                    className={`py-3.5 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition-all cursor-pointer ${
                      payoutMethod === "bank"
                        ? "border-[#ff7448] bg-[#FFF0E6] text-[#ff7448]"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <Landmark className="w-5 h-5" />
                    <span className="text-[13px]">Bank Account</span>
                  </button>
                </div>

                {/* Form Fields: UPI */}
                {payoutMethod === "upi" && (
                  <div className="flex flex-col gap-1.5 pt-1.5">
                    <label className="text-[11.5px] font-bold text-gray-500">UPI Address (VPA)</label>
                    <input
                      type="text"
                      placeholder="e.g. name@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full bg-[#FAF6F2] border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13.5px] font-medium focus:outline-none focus:border-[#ff7448]"
                    />
                  </div>
                )}

                {/* Form Fields: Bank details */}
                {payoutMethod === "bank" && (
                  <div className="flex flex-col gap-3 pt-1.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11.5px] font-bold text-gray-500">Bank Account Number</label>
                      <input
                        type="text"
                        placeholder="Enter full account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-[#FAF6F2] border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13.5px] font-medium focus:outline-none focus:border-[#ff7448]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11.5px] font-bold text-gray-500">IFSC Code</label>
                        <input
                          type="text"
                          placeholder="e.g. SBIN0001234"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          className="w-full bg-[#FAF6F2] border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13.5px] font-medium focus:outline-none focus:border-[#ff7448]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11.5px] font-bold text-gray-500">Account Holder Name</label>
                        <input
                          type="text"
                          placeholder="Name as in bank record"
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                          className="w-full bg-[#FAF6F2] border border-gray-200 rounded-xl py-2.5 px-3.5 text-[13.5px] font-medium focus:outline-none focus:border-[#ff7448]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Withdrawal Request Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#ff7448] to-[#ff5c33] disabled:from-gray-400 disabled:to-gray-500 text-white py-3.5 rounded-2xl font-bold text-[14.5px] shadow-lg shadow-[#ff7448]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting request...
                  </>
                ) : (
                  "Confirm Withdrawal"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
