import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  HelpCircle,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

export default function AgriNexusAssistModal({ isOpen, onClose, activeBatches = [] }) {
  const { lang, t } = useLanguage();
  const { currentUser } = useAuth();

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: lang === 'hi'
        ? 'नमस्ते! मैं एग्रीनेक्सस सहायक हूँ। आपकी फसल कटाई, शेल्फ-लाइफ, मंडी भाव और कोल्ड स्टोरेज संबंधी प्रश्नों में आपकी क्या सहायता कर सकता हूँ?'
        : 'Hello! I am AgriNexus Assist, your AI post-harvest intelligence advisor. How can I help you maximize your crop value today?',
      grounded: true
    }
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState(activeBatches[0]?.id || null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketStatus, setTicketStatus] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  // Web Speech API: Speech Recognition
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputQuery(transcript);
      handleSend(transcript);
    };

    recognition.start();
  };

  // Web Speech API: Text-to-Speech
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const cleanText = text.replace(/[*_#•]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (queryToSend) => {
    const query = (queryToSend || inputQuery).trim();
    if (!query || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/assist/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          user_id: currentUser.id,
          batch_id: selectedBatchId ? parseInt(selectedBatchId) : null,
          language: lang
        })
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: data.answer,
          grounded: data.grounded,
          uncertain: data.uncertain,
          escalate: data.escalate_to_helpdesk,
          source: data.source
        };
        setMessages(prev => [...prev, botMsg]);

        // Auto speak if audio is enabled
        if (isSpeaking) {
          speakText(data.answer);
        }
      }
    } catch (err) {
      console.error('Assist error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: lang === 'hi'
            ? 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें अथवा एफपीओ डेस्क से संपर्क करें।'
            : 'Connection error. Please try again or escalate to the FPO desk.',
          escalate: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (queryText) => {
    try {
      const res = await fetch('/api/assist/escalate-helpdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          batch_id: selectedBatchId ? parseInt(selectedBatchId) : null,
          issue_topic: 'Post-Harvest Decision Escalation',
          query_text: queryText || 'Farmer request for Agronomist assistance'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTicketStatus(data);
      }
    } catch (err) {
      console.error('Escalation error:', err);
    }
  };

  const quickQuestions = [
    t('quick_q1'),
    t('quick_q2'),
    t('quick_q3'),
    t('quick_q4')
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center space-x-2">
                <span>{t('assist_title')}</span>
                <span className="px-2 py-0.2 bg-emerald-400/30 text-emerald-100 rounded text-[9px] uppercase font-bold tracking-wider">
                  RAG Grounded
                </span>
              </h3>
              <p className="text-xs text-emerald-100/80">{t('assist_subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Context Selector */}
        {activeBatches.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Focus on specific batch:</span>
            <select
              value={selectedBatchId || ''}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Farm Produce (General)</option>
              {activeBatches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.batch_code} — {b.crop} ({b.quantity_kg}kg, Quality: {b.current_quality}%)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Chat History Box */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {ticketStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ticket Generated: {ticketStatus.ticket_id}</span>
              </div>
              <p>{lang === 'hi' ? ticketStatus.message_hi : ticketStatus.message}</p>
              <p className="font-mono text-emerald-700 font-bold">{ticketStatus.fpo_helpdesk_number}</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 ${
                msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none'
                  : msg.uncertain
                  ? 'bg-amber-50 border border-amber-200 text-slate-800 rounded-tl-none'
                  : 'bg-white border border-slate-200 text-slate-900 shadow-xs rounded-tl-none'
              }`}>
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* Grounding Badge & Text-to-Speech button */}
                {msg.sender === 'bot' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      {msg.grounded && (
                        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                          ✓ Grounded Telemetry
                        </span>
                      )}
                      {msg.uncertain && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Uncertain (No Guesswork)</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => speakText(msg.text)}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1"
                      title="Read Aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Escalation button if uncertain or out-of-scope (FR-9.6) */}
                {msg.escalate && !ticketStatus && (
                  <button
                    onClick={() => handleEscalate(msg.text)}
                    className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{t('escalate_helpdesk')}</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center space-x-2 text-xs text-slate-400 italic pl-10">
              <Sparkles className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Analyzing digital twin telemetry & mandi prices...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Chips */}
        <div className="p-2.5 bg-white border-t border-slate-100 overflow-x-auto flex items-center space-x-2 no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Quick:</span>
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-full text-xs shrink-0 whitespace-nowrap transition-colors border border-slate-200"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-xl border transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse border-red-600'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Voice Speech-to-Text (Hindi / English)"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? t('voice_listening') : t('type_placeholder')}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || loading}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl shadow-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
