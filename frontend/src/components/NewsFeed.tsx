import React, { useState, useEffect } from 'react';

import { FileText, AlertTriangle } from 'lucide-react';

interface Article {
  title: string;
  source: string;
  url: string;
  time_ago: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
}

interface NewsData {
  articles: Article[];
  summary: {
    overall: string;
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  };
}

interface NewsFeedProps {
  ticker: string;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ ticker }) => {
  const [data, setData] = useState<NewsData | null>(null);
  const [signalData, setSignalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!ticker) return;
      setLoading(true);
      try {
        const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000';
        // Fetch news and signal in parallel
        const [newsRes, signalRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/news/${ticker}`),
          fetch(`${API_BASE_URL}/api/signal/${ticker}`)
        ]);
        
        const newsJson = await newsRes.json();
        const signalJson = await signalRes.json();
        
        setData(newsJson);
        setSignalData(signalJson);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker]);

  const getSentimentStyles = (sentiment: string) => {
    switch(sentiment) {
      case 'positive': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'negative': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col">
        <h3 className="text-white font-semibold flex items-center mb-6">
          News Sentiment Feed
        </h3>
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-2 w-24 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 w-full bg-gray-800 rounded mb-1"></div>
              <div className="h-4 w-2/3 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.articles.length === 0) {
    return (
      <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-6 h-6 text-gray-600" />
        </div>
        <h3 className="text-gray-300 font-semibold text-sm">No recent news for {ticker}</h3>
        <p className="text-gray-500 text-xs mt-1">Try Searching by company name</p>
      </div>
    );
  }

  const { overall, positive, negative, neutral, total } = data.summary;
  const isBullish = positive > negative;
  const isBearish = negative > positive;
  const overallLabel = isBullish ? 'Bullish' : isBearish ? 'Bearish' : 'Neutral';
  const overallColor = isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-gray-400';

  // Contradiction detection
  const currentSignal = signalData?.signal;
  const newsSentiment = overall;
  const hasContradiction = 
    (currentSignal === 'BUY' && newsSentiment === 'negative') ||
    (currentSignal === 'SELL' && newsSentiment === 'positive');

  return (
    <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">News Sentiment Feed</h3>
        <span className={`text-xs font-black uppercase tracking-widest ${overallColor}`}>{overallLabel}</span>
      </div>

      {/* Sentiment Summary Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight mb-2">
          <span className="text-emerald-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>{positive} Positive</span>
          <span className="text-gray-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>{neutral} Neutral</span>
          <span className="text-rose-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>{negative} Negative</span>
        </div>
        <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-gray-800">
          <div style={{ width: `${(positive/total)*100}%` }} className="bg-emerald-500/80 h-full"></div>
          <div style={{ width: `${(neutral/total)*100}%` }} className="bg-gray-500/80 h-full"></div>
          <div style={{ width: `${(negative/total)*100}%` }} className="bg-rose-500/80 h-full"></div>
        </div>
      </div>

      {/* Contradiction Warning */}
      {hasContradiction && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start space-x-3 animate-in fade-in zoom-in duration-300">
          <div className="mt-0.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xs font-medium text-amber-200/80 leading-relaxed">
            News sentiment contradicts technical signal
          </p>
        </div>
      )}
      
      <div className="space-y-5 overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {data.articles.map((item, idx) => (
            <div 
              key={idx} 
              onClick={() => window.open(item.url, '_blank')}
              className="pb-5 border-b border-[#1f2937] last:border-0 last:pb-0 group cursor-pointer"
            >
                <div className="flex justify-between items-start mb-1.5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{item.source} · {item.time_ago}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border leading-none ${getSentimentStyles(item.sentiment)}`}>
                        {item.sentiment}
                    </span>
                </div>
                <h4 className="text-sm font-medium text-gray-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                    {item.title}
                </h4>
            </div>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;
