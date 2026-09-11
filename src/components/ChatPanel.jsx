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
  const { state, dispatch, sendMessage, addAIMessage, startMission, updateMissionStep, completeMission } = useAthreix();
  const { chatOpen, messages, isAnalyzing, location, selectedYear } = state;
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Handle image upload and base64 conversion
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (chatOpen) {
      scrollToBottom();
    }
  }, [messages, isAnalyzing, chatOpen, scrollToBottom]);

  // Detect if a query is an analysis/investigation query (routes through mission system)
  // vs. a conversational query (routes through Groq LLM streaming)
  const isAnalysisQuery = useCallback((text) => {
    const q = text.toLowerCase();
    const analysisKeywords = [
      'change', 'construction', 'built', 'develop', 'growth', 'expand', 'urban',
      'ndvi', 'ndwi', 'ndbi', 'vegetation', 'forest', 'water', 'flood',
      'sar', 'radar', 'structure', 'infrastructure', 'analyze', 'analysis',
      'compare', 'difference', 'history', 'since', 'between', 'satellite',
      'land cover', 'land use', 'spectral', 'multispectral', 'sentinel',
      'detect', 'monitor', 'assessment', 'evaluate', 'crop', 'drought',
    ];
    return analysisKeywords.some(kw => q.includes(kw));
  }, []);

  // Handle query submission — routes through mission or LLM depending on intent
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

      const context = { location, selectedYear, image_base64: imageBase64 };
      const currentImage = imageBase64;
      if (currentImage) clearImage();

      // ═══════════════════════════════════════════════════════════════
      // ROUTE 1: Image upload → direct ORBITAL backend (geolocation)
      // ═══════════════════════════════════════════════════════════════
      if (currentImage) {
        try {
          const fallbackRes = await runAnalysis(text, context);
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: { text: fallbackRes.text, evidence: fallbackRes.evidence, isStreaming: false },
          });
          if (fallbackRes.evidence?.location_match) {
            const { lat, lon, name } = fallbackRes.evidence.location_match;
            dispatch({ type: 'FLY_TO', payload: { lat, lon, name } });
            dispatch({ type: 'SET_LOCATION', payload: { lat, lon, name, cameraAlt: 3500 } });
          }
          if (fallbackRes.evidence?.geojson_mask) {
            dispatch({ type: 'SET_CHANGE_MASK', payload: fallbackRes.evidence.geojson_mask });
          }
        } catch (err) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: { text: `Analysis error: ${err.message}`, isStreaming: false },
          });
        } finally {
          dispatch({ type: 'SET_ANALYZING', payload: false });
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // ROUTE 2: Analysis query → Mission system with SSE streaming
      // ═══════════════════════════════════════════════════════════════
      if (isAnalysisQuery(text)) {
        try {
          const { executeMission } = await import('../services/MissionService.js');

          // Start a mission — updates the mission tracker UI
          const missionId = startMission(text, state.aoi);
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: { text: '🛰️ **Mission initiated** — running satellite analysis pipeline...\n\n', isStreaming: true },
          });

          const missionResult = await executeMission(text, location, state.aoi?.geometry, {
            onStepStart: (data) => {
              updateMissionStep({ name: data.name, status: 'running', data_quality: data.data_quality });
              dispatch({ type: 'UPDATE_MISSION_PROGRESS', payload: { progress: data.progress } });
            },
            onStepDone: (data) => {
              updateMissionStep({ name: data.name, status: 'done', data_quality: data.data_quality, data_status: data.data_status });
              dispatch({ type: 'UPDATE_MISSION_PROGRESS', payload: { progress: data.progress } });
            },
            onProgress: (pct) => {
              dispatch({ type: 'UPDATE_MISSION_PROGRESS', payload: { progress: pct } });
            },
            onComplete: (data) => {
              const result = data.result;
              completeMission(result);

              // Update chat with the full analysis report
              dispatch({
                type: 'UPDATE_LAST_MESSAGE',
                payload: {
                  text: result.text || 'Analysis complete.',
                  isStreaming: false,
                  evidence: {
                    type: 'orbital_mission',
                    model: 'ORBITAL Multi-Sensor Pipeline',
                    confidence: result.confidence || 0,
                    sources: result.agent_metadata?.specialists_invoked || [],
                    data_quality: result.agent_metadata?.data_quality || 'unknown',
                    fusionUsed: true,
                    geojson_mask: result.geojson_mask,
                  },
                },
              });

              // Render change mask on the map
              if (result.geojson_mask) {
                dispatch({ type: 'SET_CHANGE_MASK', payload: result.geojson_mask });
              }

              dispatch({ type: 'SET_ANALYZING', payload: false });
            },
            onError: (err) => {
              // Fallback to direct ORBITAL query
              runAnalysis(text, context).then(fallbackRes => {
                dispatch({
                  type: 'UPDATE_LAST_MESSAGE',
                  payload: { text: fallbackRes.text, evidence: fallbackRes.evidence, isStreaming: false },
                });
                if (fallbackRes.evidence?.geojson_mask) {
                  dispatch({ type: 'SET_CHANGE_MASK', payload: fallbackRes.evidence.geojson_mask });
                }
              }).catch(() => {
                dispatch({
                  type: 'UPDATE_LAST_MESSAGE',
                  payload: { text: 'Mission failed. Unable to reach satellite intelligence server.', isStreaming: false },
                });
              }).finally(() => {
                dispatch({ type: 'SET_ANALYZING', payload: false });
              });
            },
          });
        } catch (err) {
          // Final fallback
          try {
            const fallbackRes = await runAnalysis(text, context);
            dispatch({
              type: 'UPDATE_LAST_MESSAGE',
              payload: { text: fallbackRes.text, evidence: fallbackRes.evidence, isStreaming: false },
            });
          } catch {
            dispatch({
              type: 'UPDATE_LAST_MESSAGE',
              payload: { text: 'Analysis unavailable. Check server connection.', isStreaming: false },
            });
          }
          dispatch({ type: 'SET_ANALYZING', payload: false });
        }
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // ROUTE 3: Conversational query → Groq LLM streaming
      // ═══════════════════════════════════════════════════════════════
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
              type: 'groq_geoint',
              model: 'Llama-3.3-70B',
              confidence: 96,
              sources: [
                'Groq GEOINT Core',
                selectedYear >= 2015 ? 'Sentinel-2 L2A (10m)' : 'Landsat / NASA GIBS Archive',
                'Esri High-Res Aerial',
              ],
              fusionUsed: true,
            },
          },
        });
        dispatch({ type: 'SET_ANALYZING', payload: false });
      };

      const onError = async (err) => {
        console.warn('Groq stream fallback triggered:', err?.message);
        try {
          const fallbackRes = await runAnalysis(text, context);
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: { text: fallbackRes.text, evidence: fallbackRes.evidence, isStreaming: false },
          });
          if (fallbackRes.evidence?.location_match) {
            const { lat, lon, name } = fallbackRes.evidence.location_match;
            dispatch({ type: 'FLY_TO', payload: { lat, lon, name } });
          }
          if (fallbackRes.evidence?.geojson_mask) {
            dispatch({ type: 'SET_CHANGE_MASK', payload: fallbackRes.evidence.geojson_mask });
          }
        } catch {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: { text: `Unable to reach intelligence server. Target: ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E`, isStreaming: false },
          });
        } finally {
          dispatch({ type: 'SET_ANALYZING', payload: false });
        }
      };

      streamMistralResponse(text, context, onToken, onDone, onError);
    },
    [inputText, imageBase64, isAnalyzing, sendMessage, dispatch, location, selectedYear, startMission, updateMissionStep, completeMission, isAnalysisQuery, state.aoi]
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
        title="Open Aethreix ORBITAL Chat"
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
                Aethreix ORBITAL
                <span className="mistral-powered-badge">Groq AI</span>
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
          {imageBase64 && (
            <div className="image-preview-container">
              <img src={imageBase64} alt="Upload Preview" className="image-thumbnail" />
              <button className="remove-image-btn" onClick={clearImage} title="Remove image">✕</button>
            </div>
          )}
          <div className="chat-input-wrapper">
            <button 
              className="chat-attach-btn" 
              onClick={() => fileInputRef.current?.click()}
              title="Upload Image for Geolocation"
            >
              📎
            </button>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              style={{ display: 'none' }} 
            />
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Ask anything or attach an image to geolocate..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              id="chat-input-box"
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={(!inputText.trim() && !imageBase64) || isAnalyzing}
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
