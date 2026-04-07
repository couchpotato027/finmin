import React, { useState, FormEvent, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import axios from "axios";

const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TopBarProps {
  ticker: string;
  setTicker: (t: string) => void;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

const TopBar: React.FC<TopBarProps> = ({ ticker, setTicker }) => {
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [errorMsg, setErrorMsg] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions when searchInput changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!searchInput.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const { data } = await axios.get(`${API_BASE}/search?q=${searchInput}`);
        setSuggestions(data);
        setSelectedIndex(-1);
        setErrorMsg("");
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchInput]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectTicker = (symbol: string) => {
    setTicker(symbol);
    setSearchInput("");
    setShowDropdown(false);
    setErrorMsg("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        selectTicker(suggestions[selectedIndex].symbol);
      } else {
        validateAndSubmit();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const validateAndSubmit = async () => {
    const trimmed = searchInput.trim().toUpperCase();
    if (!trimmed) return;
    
    // Check if it's in our known suggestion list first
    const match = suggestions.find(s => s.symbol.toUpperCase() === trimmed);
    if (match) {
        selectTicker(match.symbol);
        return;
    }

    // Try a direct fetch to backend to see if it's broadly valid/available
    try {
        const { data } = await axios.get(`${API_BASE}/search?q=${trimmed}`);
        const exactMatch = data.find((s: SearchResult) => s.symbol.toUpperCase() === trimmed);
        if (exactMatch) {
            selectTicker(exactMatch.symbol);
        } else {
            setErrorMsg("Company not found.");
            setShowDropdown(false);
        }
    } catch {
        setErrorMsg("Company not found.");
        setShowDropdown(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    validateAndSubmit();
  };

  const getMarketStatus = () => {
    const now = new Date();
    
    // Indian Market (IST: UTC+5:30)
    // Note: getUTCHours on an IST-offset date gives us the IST hour
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const istDay = istDate.getUTCDay(); // 0=Sun, 6=Sat
    const istHours = istDate.getUTCHours();
    const istMins = istDate.getUTCMinutes();
    const istTime = istHours * 100 + istMins;
    const istDateStr = istDate.toISOString().split('T')[0];
    
    // US Market (EST/EDT)
    // 2026 DST: March 8 to Nov 1
    const isDST = now >= new Date("2026-03-08") && now <= new Date("2026-11-01");
    const estOffset = (isDST ? -4 : -5) * 60 * 60 * 1000;
    const estDate = new Date(now.getTime() + estOffset);
    const estDay = estDate.getUTCDay();
    const estHours = estDate.getUTCHours();
    const estMins = estDate.getUTCMinutes();
    const estTime = estHours * 100 + estMins;
    const estDateStr = estDate.toISOString().split('T')[0];

    const indianHolidays = ["2026-01-26","2026-03-25","2026-04-06","2026-04-10","2026-04-14","2026-04-21","2026-05-01","2026-08-15","2026-10-02","2026-10-21","2026-10-23","2026-11-04","2026-11-05","2026-12-25"];
    const usHolidays = ["2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-07-03","2026-09-07","2026-11-26","2026-12-25"];

    const isIndian = ticker.endsWith('.NS') || ticker.endsWith('.BO');
    
    if (isIndian) {
      if (istDay === 0 || istDay === 6 || indianHolidays.includes(istDateStr)) 
        return { label: "NSE CLOSED", color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/20", pulse: false };
      if (istTime >= 915 && istTime < 1530) 
        return { label: "NSE OPEN", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", pulse: true };
      if (istTime >= 900 && istTime < 915) 
        return { label: "NSE PRE-OPEN", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", pulse: false };
      return { label: "NSE CLOSED", color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/20", pulse: false };
    } else {
      if (estDay === 0 || estDay === 6 || usHolidays.includes(estDateStr)) 
        return { label: "NYSE CLOSED", color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/20", pulse: false };
      if (estTime >= 930 && estTime < 1600) 
        return { label: "NYSE OPEN", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", pulse: true };
      if (estTime >= 400 && estTime < 930) 
        return { label: "NYSE PRE-MARKET", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", pulse: false };
      return { label: "NYSE CLOSED", color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/20", pulse: false };
    }
  };

  const market = getMarketStatus();

  return (
    <header className="h-16 bg-[#0b0f19]/80 backdrop-blur-md border-b border-[#1f2937] flex items-center justify-between px-4 md:px-8 pl-14 md:pl-8 z-50 sticky top-0 gap-4">
      <div className="relative flex-1 max-w-md" ref={dropdownRef}>
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search ticker (e.g. MSFT, TSLA)"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
                if (searchInput.trim()) setShowDropdown(true);
                setErrorMsg("");
            }}
            className={`w-full bg-[#111827] text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 border ${errorMsg ? 'border-red-500' : 'border-[#1f2937]'} placeholder-gray-500 shadow-inner`}
          />
        </form>

        {errorMsg && (
            <div className="absolute mt-2 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-900/50">
                {errorMsg}
            </div>
        )}

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 w-full mt-2 bg-[#1f2937] border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.symbol}
                onClick={() => selectTicker(suggestion.symbol)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-3 cursor-pointer flex justify-between items-center transition-colors ${
                  index === selectedIndex ? "bg-blue-600/20 border-l-2 border-blue-500" : "hover:bg-[#374151] border-l-2 border-transparent"
                }`}
              >
                <div className="flex flex-col">
                    <span className="font-bold text-white mb-0.5">{suggestion.symbol}</span>
                    <span className="text-xs text-gray-400">
                      {suggestion.name} {suggestion.exchange ? <span className="text-gray-500 font-mono text-[10px] ml-1 px-1.5 py-0.5 bg-[#111827] rounded">({suggestion.exchange})</span> : ''}
                    </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-6">
        <div className={`hidden md:flex items-center ${market.bg} ${market.border} border px-3 py-1.5 rounded-full transition-all duration-500`}>
          <div className={`w-2 h-2 rounded-full ${market.pulse ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-gray-500'} mr-2`} />
          <span className={`text-[10px] font-black tracking-widest uppercase ${market.color}`}>{market.label}</span>
        </div>

        <div className="w-9 h-9 rounded-full border border-[#1f2937] bg-[#111827] flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer">
          <img
            src={`https://ui-avatars.com/api/?name=Trader&background=111827&color=3b82f6`}
            alt="Profile"
          />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
