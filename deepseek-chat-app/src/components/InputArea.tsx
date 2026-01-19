import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import './InputArea.css';

interface InputAreaProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onStopGeneration?: () => void; // 新增停止函数
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading,
  onStopGeneration 
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          placeholder={isLoading ? 'AI正在思考中... (按Esc停止)' : '输入消息... (Shift+Enter换行，Enter发送)'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />
        
        <div className="input-actions">
          <button 
            className="action-button clear-button"
            onClick={handleClear}
            disabled={!input.trim() || isLoading}
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
        <span className="hint">📝 上下文长度：128K</span>
        {isLoading && (
          <span className="hint warning">⏹️ 按 Esc 停止生成</span>
        )}
      </div>
    </div>
  );
};

export default InputArea;