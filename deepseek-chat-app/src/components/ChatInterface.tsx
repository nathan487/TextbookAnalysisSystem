import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { sendMessageStream, simulateStreamResponse } from '../api/chatApi';
import './ChatInterface.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '你好！我是AI助手，基于DeepSeek模型。有什么可以帮你的吗？',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingRealAPI, setIsUsingRealAPI] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 停止生成函数
  const stopGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
      
      // 添加停止提示到当前正在生成的消息
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.sender === 'assistant' && lastMessage.content) {
          return [...prev.slice(0, -1), {
            ...lastMessage,
            content: lastMessage.content + '\n\n**[已停止生成]**'
          }];
        }
        return prev;
      });
      
      console.log('生成已停止');
    }
  }, [abortController]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // 如果有正在进行的生成，先停止
    if (isLoading && abortController) {
      stopGeneration();
      await new Promise(resolve => setTimeout(resolve, 100)); // 短暂延迟
    }

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // 创建AI消息（初始为空）
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      content: '',
      sender: 'assistant',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, aiMessage]);

    // 创建AbortController用于中断请求
    const controller = new AbortController();
    setAbortController(controller);

    try {
      let fullResponse = '';
      
      const onChunk = (chunk: string) => {
        fullResponse += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: fullResponse }
            : msg
        ));
      };

      const onComplete = () => {
        setIsLoading(false);
        setAbortController(null);
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: fullResponse.trim() }
            : msg
        ));
      };

      const onError = (error: string) => {
        // 如果是主动中断，不显示错误
        if (error.includes('abort') || controller.signal.aborted) {
          setIsLoading(false);
          setAbortController(null);
          return;
        }
        
        console.error('Error:', error);
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { 
                ...msg, 
                content: `抱歉，我遇到了一些问题：${error}\n\n已切换为模拟模式，你可以继续聊天。` 
              }
            : msg
        ));
        setIsLoading(false);
        setAbortController(null);
        setIsUsingRealAPI(false);
      };

      if (isUsingRealAPI) {
        // 使用真实DeepSeek API（需要修改API函数支持AbortController）
        await sendMessageStream(
          content, 
          onChunk, 
          onComplete, 
          onError,
          controller // 传递AbortController
        );
      } else {
        // 模拟API也要支持中断
        await simulateStreamResponse(
          content, 
          onChunk, 
          onComplete,
          controller
        );
      }

    } catch (error) {
      // 如果是中断错误，忽略
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        setIsLoading(false);
        setAbortController(null);
        return;
      }
      
      console.error('Error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              content: '抱歉，网络连接出现问题，请稍后再试。' 
            }
          : msg
      ));
      setIsLoading(false);
      setAbortController(null);
      setIsUsingRealAPI(false);
    }
  };

  // 添加键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+. 或 Esc 停止生成
      if ((e.ctrlKey && e.key === '.') || e.key === 'Escape') {
        if (isLoading) {
          e.preventDefault();
          stopGeneration();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, stopGeneration]);

  const handleClearChat = () => {
    // 如果正在生成，先停止
    if (isLoading && abortController) {
      stopGeneration();
    }
    
    setMessages([{
      id: Date.now().toString(),
      content: '对话已清空。有什么可以帮你的吗？',
      sender: 'assistant',
      timestamp: new Date()
    }]);
  };

  const toggleAPI = () => {
    // 如果正在生成，先停止
    if (isLoading && abortController) {
      stopGeneration();
    }
    
    setIsUsingRealAPI(!isUsingRealAPI);
    const status = !isUsingRealAPI ? '真实DeepSeek API' : '模拟模式';
    alert(`已切换到${status}`);
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="header-left">
          <h1>🤖 DeepSeek AI助手</h1>
          <div className="model-info">
            <span className="model-tag">DeepSeek</span>
            <span className="status-indicator">
              ● {isUsingRealAPI ? '真实API' : '模拟模式'}
            </span>
            {isLoading && (
              <button 
                className="stop-button"
                onClick={stopGeneration}
                title="停止生成 (Esc 或 Ctrl+.)"
              >
                ⏹️ 停止生成
              </button>
            )}
            <button 
              className="api-toggle-button"
              onClick={toggleAPI}
              title={isUsingRealAPI ? '切换到模拟模式' : '切换到真实API'}
              disabled={isLoading}
            >
              {isUsingRealAPI ? '🔌 模拟模式' : '⚡ 真实API'}
            </button>
          </div>
        </div>
        <button 
          className="clear-button"
          onClick={handleClearChat}
          title="清空对话"
          disabled={isLoading}
        >
          清空对话
        </button>
      </div>
      
      <div className="chat-messages-container">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>
      
      <InputArea 
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onStopGeneration={stopGeneration} // 传递给InputArea
      />
      
      {isUsingRealAPI && (
        <div className="api-notice">
          ⚡ 正在使用真实DeepSeek API，请确保后端服务器已启动
          {isLoading && ' | 按 Esc 或 Ctrl+. 停止生成'}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;