import React, { useState } from 'react';
import { Brain, Shield, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Activity, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';

// أنواع البيانات (يجب أن تتطابق مع مخرجات المحرك الخلفي)
export interface ThoughtStep {
  step: number;
  thought: string;
  reasoning: string;
  confidence: number;
}

export interface Perspective {
  name: string;
  icon: string;
  analysis: string;
  recommendation: string;
  confidence: number;
}

export interface OmegaAnalysisProps {
  query: string;
  thoughts: ThoughtStep[];
  perspectives: Perspective[];
  consensus: string;
  emotionalState: string; // e.g., 'worried', 'excited'
  sources: { name: string; reliability: number }[];
  recommendationId?: string;
  onFeedback?: (recommendationId: string, wasSuccessful: boolean, rating: number) => void;
}

export const OmegaAnalysisCard: React.FC<OmegaAnalysisProps> = ({
  query, thoughts, perspectives, consensus, emotionalState, sources, recommendationId, onFeedback
}) => {
  const [showThoughts, setShowThoughts] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const handleFeedback = (isPositive: boolean) => {
    if (!recommendationId || !onFeedback) return;
    const rating = isPositive ? 5 : 2; // 5 للنجاح، 2 للفشل
    setSelectedRating(rating);
    onFeedback(recommendationId, isPositive, rating);
    setFeedbackGiven(true);
  };

  // ألوان مخصصة بناءً على الحالة العاطفية المكتشفة
  const emotionColors = {
    worried: 'border-blue-500 bg-blue-500/10',
    excited: 'border-yellow-500 bg-yellow-500/10',
    neutral: 'border-gray-500 bg-gray-500/10',
  };

  const currentEmotionColor = emotionColors[emotionalState as keyof typeof emotionColors] || emotionColors.neutral;

  return (
    <div className={`max-w-3xl mx-auto p-6 rounded-2xl border ${currentEmotionColor} shadow-lg transition-all duration-300`}>
      
      {/* 1. مؤشر الذكاء العاطفي (عنوان علوي) */}
      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-600 dark:text-gray-300">
        <Activity size={16} />
        <span>تم تحليل نبرة سؤالك: {emotionalState === 'worried' ? 'قلق (تم تفعيل وضع الطمأنة والتحليل الآمن)' : (emotionalState === 'excited' ? 'متحمس (يتم تطبيق قيود المخاطر بصرامة)' : 'عادي')}</span>
      </div>

      {/* 2. سلسلة التفكير (Chain of Thought) - قابلة للطي */}
      <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button 
          onClick={() => setShowThoughts(!showThoughts)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
            <Brain size={18} />
            <span>عملية التفكير (Chain of Thought)</span>
          </div>
          {showThoughts ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        {showThoughts && (
          <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
            {thoughts.map((t, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                  {t.step}
                </div>
                <div className="w-full">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{t.thought}</p>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{t.reasoning}</p>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div 
                      className="bg-purple-500 h-1.5 rounded-full" 
                      style={{ width: `${t.confidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500 mt-1 block">الثقة: {(t.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. التحليل متعدد الزوايا (Multi-Perspective Grid) */}
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <TrendingUp size={20} className="text-green-500" />
        التحليل الشامل
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {perspectives.map((p, i) => (
          <div key={i} className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-2xl">{p.icon}</span>
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                ثقة: {(p.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-1">{p.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{p.analysis}</p>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Shield size={14} />
              {p.recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* 4. الإجماع النهائي */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white mb-6 text-center">
        <h4 className="font-bold text-lg mb-1">🎯 الإجماع النهائي</h4>
        <p className="text-blue-100">{consensus}</p>
      </div>

      {/* 🌟 الإضافة الجديدة: نظام التغذية الراجعة (Meta-Learning Feedback) */}
      {recommendationId && onFeedback && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          {!feedbackGiven ? (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                هل كان هذا التحليل مفيداً لقرارك؟
              </p>
              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => handleFeedback(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <ThumbsUp size={18} /> نعم، كان دقيقاً
                </button>
                <button 
                  onClick={() => handleFeedback(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  <ThumbsDown size={18} /> لا، يحتاج تحسين
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center flex items-center justify-center gap-2 text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle size={20} />
              <span className="font-medium">شكراً لتقييمك! سيتم استخدامه لتحسين التحليلات (Meta-Learning).</span>
            </div>
          )}
        </div>
      )}

      {/* 5. تذييل الشفافية (Transparency Footer) */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
          <AlertTriangle size={12} />
          مصادر البيانات والموثوقية:
        </p>
        <div className="flex flex-wrap gap-2">
          {sources.map((src, i) => (
            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md flex items-center gap-1">
              {src.name}
              <span className="text-yellow-500">{'⭐'.repeat(Math.round(src.reliability * 5))}</span>
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-3 text-center">
          ⚠️ تنويه: التداول ينطوي على مخاطر عالية. هذا التحليل لأغراض تعليمية ولا يشكل نصيحة مالية ملزمة.
        </p>
      </div>

    </div>
  );
};
