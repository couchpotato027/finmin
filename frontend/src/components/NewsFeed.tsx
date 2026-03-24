import React from 'react';

interface NewsItem {
  id: number;
  source: string;
  time: string;
  headline: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
}

interface NewsFeedProps {
  ticker: string;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ ticker }) => {
  // Mock data for news feed based on the ticker
  const news: NewsItem[] = [
    {
      id: 1,
      source: 'Reuters',
      time: '2h ago',
      headline: `Strategic acquisitions boost ${ticker} market dominance in Q3`,
      sentiment: 'Positive',
    },
    {
      id: 2,
      source: 'Bloomberg',
      time: '4h ago',
      headline: `${ticker} faces regulatory scrutiny over new product launch`,
      sentiment: 'Negative',
    },
    {
      id: 3,
      source: 'WSJ',
      time: '5h ago',
      headline: `Analysts maintain hold rating for ${ticker} ahead of earnings call`,
      sentiment: 'Neutral',
    },
    {
      id: 4,
      source: 'CNBC',
      time: '7h ago',
      headline: `${ticker} CEO discusses core growth strategies moving forward`,
      sentiment: 'Positive',
    }
  ];

  const getSentimentStyles = (sentiment: string) => {
    switch(sentiment) {
      case 'Positive': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Negative': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  return (
    <div className="bg-[#111827]/80 backdrop-blur-md border border-[#1f2937] shadow-lg rounded-xl p-6 h-full flex flex-col">
      <h3 className="text-white font-semibold flex items-center mb-6">
        News Sentiment Feed
      </h3>
      <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {news.map(item => (
            <div key={item.id} className="pb-4 border-b border-[#1f2937] last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-1">
                    <p className="text-xs text-gray-400 font-medium">{item.source} • {item.time}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${getSentimentStyles(item.sentiment)}`}>
                        {item.sentiment}
                    </span>
                </div>
                <h4 className="text-sm font-medium text-gray-200 leading-tight hover:text-blue-400 transition-colors cursor-pointer mt-1.5">
                    {item.headline}
                </h4>
            </div>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;
