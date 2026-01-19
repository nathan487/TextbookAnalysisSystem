import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import './InputArea.css';

interface InputAreaProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onStopGeneration?: () => void; // 新增停止函数
}

// Whisper API 配置
const WHISPER_API_URL = 'http://localhost:5000/api/transcribe';

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading,
  onStopGeneration 
}) => {
  const [input, setInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 自动调整文本域高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Esc键停止生成
    if (e.key === 'Escape' && isLoading && onStopGeneration) {
      e.preventDefault();
      onStopGeneration();
    }
  };

  const handleClear = () => {
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // 处理音频文件上传
  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['mp3', 'wav', 'mp4', 'm4a', 'ogg', 'webm'];
    
    if (!allowedExtensions.includes(fileExtension || '')) {
      alert('不支持的音频格式！支持的格式：MP3, WAV, MP4, M4A, OGG, WebM');
      return;
    }

    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('language', 'zh'); // 默认中文

      const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('音频转文字失败');
      }

      const result = await response.json();
      
      if (result.success && result.text) {
        // 将转录文本添加到输入框
        setInput((prev) => prev + (prev ? '\n' : '') + result.text);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      } else {
        throw new Error('转录结果为空');
      }
    } catch (error) {
      console.error('音频转文字错误:', error);
      alert('音频转文字失败，请确保 Whisper 服务已启动 (http://localhost:5000)');
    } finally {
      setIsTranscribing(false);
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAudioButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="input-area">
      <div className="examples">
        <span className="examples-label">试试问我：</span>
        <button 
          className="example-button"
          onClick={() => handleExampleClick('用JavaScript写一个简单的待办事项应用')}
          disabled={isLoading}
        >
          ✨ 写代码
        </button>
        <button 
          className="example-button"
          onClick={() => handleExampleClick('解释一下量子计算的基本原理')}
          disabled={isLoading}
        >
          🤔 解释概念
        </button>
        <button 
          className="example-button"
          onClick={() => handleExampleClick('帮我制定一个学习React的计划')}
          disabled={isLoading}
        >
          📚 制定计划
        </button>
      </div>
      
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          className="message-input"
          placeholder={isTranscribing ? '正在转录音频...' : isLoading ? 'AI正在思考中... (按Esc停止)' : '输入消息... (Shift+Enter换行，Enter发送)'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading || isTranscribing}
        />
        
        <div className="input-actions">
          {/* 音频上传按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.mp4,.m4a,.ogg,.webm"
            onChange={handleAudioUpload}
            style={{ display: 'none' }}
          />
          <button 
            className="action-button audio-button"
            onClick={handleAudioButtonClick}
            disabled={isLoading || isTranscribing}
            title="上传音频转文字"
          >
            {isTranscribing ? '🔄' : '🎤'}
          </button>
          
          <button 
            className="action-button clear-button"
            onClick={handleClear}
            disabled={!input.trim() || isLoading || isTranscribing}
            title="清空输入"
          >
            ✕
          </button>
          
          {isLoading && onStopGeneration ? (
            <button 
              className="stop-generate-button"
              onClick={onStopGeneration}
              title="停止生成 (Esc)"
            >
              ⏹️ 停止生成
            </button>
          ) : (
            <button 
              className="send-button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <span className="sending">
                  <span className="spinner"></span>
                  发送中...
                </span>
              ) : (
                <>
                  <span>发送</span>
                  <span className="send-icon">↑</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      <div className="input-hints">
        <span className="hint">💡 支持Markdown格式</span>
        <span className="hint">💻 支持代码块</span>
        <span className="hint">🎤 支持音频转文字</span>
        <span className="hint">📝 上下文长度：128K</span>
        {isLoading && (
          <span className="hint warning">⏹️ 按 Esc 停止生成</span>
        )}
        {isTranscribing && (
          <span className="hint warning">🔄 正在转录音频...</span>
        )}
      </div>
    </div>
  );
};

export default InputArea;