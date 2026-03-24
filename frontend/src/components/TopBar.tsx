import React, { useState, FormEvent, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import axios from "axios";

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
        const { data } = await axios.get(`http://localhost:8000/search?q=${searchInput}`);
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
        const { data } = await axios.get(`http://localhost:8000/search?q=${trimmed}`);
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

  return (
    <header className="h-16 bg-[#0b0f19]/80 backdrop-blur-md border-b border-[#1f2937] flex items-center justify-between px-8 z-50 sticky top-0">
      <div className="relative w-96" ref={dropdownRef}>
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
        <div className="flex items-center bg-[#111827] px-3 py-1.5 rounded-full border border-[#1f2937]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_#10b981]" />
          <span className="text-xs font-semibold tracking-wide text-gray-300">MARKET OPEN</span>
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
