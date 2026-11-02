import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, FileText, Send, Download } from 'lucide-react';
import { triggerHaptic } from '../lib/telegram';

interface ExportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string; // YYYY-MM
  tgId: string;
}

export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  isOpen,
  onClose,
  month,
  tgId,
}) => {
  const [reportText, setReportText] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function fetchReport() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/report/summary?month=${month}`, {
          headers: { 'x-telegram-user-id': tgId },
        });
        const data = await res.json();
        if (isMounted) {
          setReportText(data.text || '');
          setStats(data.stats || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchReport();
    return () => {
      isMounted = false;
    };
  }, [month, tgId]);

  const handleCopy = () => {
    triggerHaptic('medium');
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    triggerHaptic('medium');
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(reportText)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-neutral-800 text-gray-900 dark:text-gray-100 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-sans">
              Табель за месяц для сверки
            </h3>
            <p className="text-xs text-gray-400">
              Готовая аккуратная сводка для руководителя или проверки расчета
            </p>
          </div>
        </div>

        {/* Text preview box */}
        <div className="flex-1 my-2 overflow-y-auto rounded-2xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-3.5 font-mono text-[11px] leading-relaxed select-all whitespace-pre-wrap text-gray-800 dark:text-gray-300">
          {isLoading ? 'Генерация сводки...' : reportText}
        </div>

        {/* Quick statistics footer */}
        {stats && (
          <div className="py-2.5 px-3 mb-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs">
            <div className="text-blue-800 dark:text-blue-300">
              Смен: <b>{stats.shiftsCount}</b> | Часов: <b>{stats.totalHours} ч</b>
            </div>
            <div className="font-extrabold text-blue-900 dark:text-blue-200 text-sm">
              Итого: {stats.grandTotal?.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className={`py-3 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-800 dark:bg-neutral-700 text-white hover:bg-neutral-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Скопировано!' : 'Скопировать'}</span>
          </button>

          <button
            onClick={handleShareTelegram}
            className="py-3 px-3 rounded-2xl bg-[#1E88E5] hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>В Telegram / Чат</span>
          </button>
        </div>
      </div>
    </div>
  );
};
