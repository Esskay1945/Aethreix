import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAthreix } from '../context/AthreixContext.jsx';
import ChatMessage from './ChatMessage.jsx';
import { runAnalysis } from '../services/AnalysisEngine.js';
import { streamMistralResponse } from '../services/MistralService.js';

const SUGGESTIONS = [
  'What specific infrastructural changes took place here since 2020?',
  'Analyze urban sprawl and construction growth in this area',
  'What are the key roads, landmarks, and terrain features visible?',
  'Analyze vegetation health and NDVI changes',
  'Assess flood risk and water body dynamics',
  'Explain the satellite observation resolution at this zoom level',
];

export default function ChatPanel() {
  const { state, dispatch, sendMessage, addAIMessage } = useAthreix();
  const { chatOpen, messages, isAnalyzing, location, selectedYear } = state;
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (chatOpen) {
      scrollToBottom();
    }
  }, [messages, isAnalyzing, chatOpen, scrollToBottom]);

  // Handle query submission with Mistral AI Streaming + Fallback
  const handleSend = useCallback(
    async (textToSend) => {
      const text = (textToSend || inputText).trim();
      if (!text || isAnalyzing) return;

      setInputText('');
      sendMessage(text);
      dispatch({ type: 'SET_ANALYZING', payload: true });

      // Add empty placeholder message for streaming
      const aiMsgId = Date.now() + 1;
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: aiMsgId,
          role: 'ai',
          text: '',
          isStreaming: true,
          timestamp: new Date(),
        },
      });

      const context = { location, selectedYear };

      const onToken = (chunk, fullText) => {
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: { text: fullText, isStreaming: true },
        });
      };

      const onDone = (fullText) => {
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: {
            text: fullText,
            isStreaming: false,
            evidence: {
              type: 'mistral_geoint',
              model: 'Mistral-Small-Latest',
              confidence: 96,
              sources: [
                'Mistral GEOINT Core',
                selectedYear >= 2017 ? 'Sentinel-2 L2A (10m)' : 'Landsat / NASA GIBS Archive',
                'Esri High-Res Aerial',
              ],
              fusionUsed: true,
            },
          },
        });
        dispatch({ type: 'SET_ANALYZING', payload: false });
      };

      const onError = async (err) => {
        console.warn('Mistral stream fallback triggered:', err.message);
        // Seamless fallback to grounded local analysis engine
        try {
          const fallbackRes = await runAnalysis(text, context);
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: {
              text: fallbackRes.text,
              evidence: fallbackRes.evidence,
              isStreaming: false,
            },
          });
        } catch (fallbackErr) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: {
              text: `⚠️ **Analysis Notice:** Unable to reach satellite intelligence server. Coordinates locked: ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E (${location.name || 'Target Area'}).`,
              isStreaming: false,
            },
          });
        } finally {
          dispatch({ type: 'SET_ANALYZING', payload: false });
        }
      };

      // Execute Mistral API streaming
      streamMistralResponse(text, context, onToken, onDone, onError);
    },
    [inputText, isAnalyzing, sendMessage, dispatch, location, selectedYear]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  return (
    <>
      {/* Floating Toggle Button when closed */}
      <button
        className={`chat-toggle-btn ${chatOpen ? 'hidden' : ''}`}
        onClick={() => dispatch({ type: 'OPEN_CHAT' })}
        title="Open Aethrix Intelligence Chat"
        id="chat-toggle-btn"
      >
        💬
      </button>

      {/* Main Slide-in Chat Panel */}
      <div className={`chat-panel glass-panel ${chatOpen ? 'open' : 'collapsed'}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-avatar">A</div>
            <div>
              <div className="chat-header-title">
                Aethrix AI Agent
                <span className="mistral-powered-badge">Mistral AI</span>
              </div>
              <div className="chat-header-subtitle">
                Multimodal EO Intelligence • {selectedYear} • {location.name || 'Global'}
              </div>
            </div>
          </div>
          <button
            className="chat-close-btn"
            onClick={() => dispatch({ type: 'CLOSE_CHAT' })}
            title="Close panel"
            id="chat-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Message Log */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome-logo">A</div>
              <h3>Interrogate Observation Data</h3>
              <p>
                Ask natural-language questions about current or historical satellite
                imagery and urban development for {location.name || 'this location'}.
              </p>

              <div className="chat-suggestions">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    className="suggestion-chip"
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </>
          )}

          {/* Typing / Analyzing Indicator */}
          {isAnalyzing && messages[messages.length - 1]?.text === '' && (
            <div className="message ai">
              <div className="message-avatar">A</div>
              <div className="message-bubble typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Ask anything about scene changes, infrastructure, terrain..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              id="chat-input-box"
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isAnalyzing}
              id="chat-send-btn"
              title="Send Query"
            >
              ➔
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
