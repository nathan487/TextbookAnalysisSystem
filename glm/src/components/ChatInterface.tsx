import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { sendMessageStream, simulateStreamResponse } from '../api/chatApi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './ChatInterface.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  files?: Array<{type: string, data: string, name: string}>;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '你好！我是AI助手，基于GLM-4V模型。我支持文本、图片和文档分析。有什么可以帮你的吗？',
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

  const handleSendMessage = async (content: string, files?: Array<{type: string, data: string, name: string}>) => {
    if ((!content.trim() && (!files || files.length === 0)) || isLoading) return;

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
      timestamp: new Date(),
      files
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
        // 使用真实GLM API（需要修改API函数支持文件）
        await sendMessageStream(
          content, 
          onChunk, 
          onComplete, 
          onError,
          controller, // 传递AbortController
          files // 传递文件
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

  // 导出PDF功能
  const exportToPDF = async () => {
    try {
      const chatContainer = document.querySelector('.chat-messages-container');
      if (!chatContainer) return;

      // 显示加载提示
      const loadingMsg = document.createElement('div');
      loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:8px;z-index:9999;';
      loadingMsg.textContent = '正在生成PDF，请稍候...';
      document.body.appendChild(loadingMsg);

      // 创建临时容器用于渲染
      const printContainer = document.createElement('div');
      printContainer.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:white;padding:20px;';
      
      // 添加标题
      const title = document.createElement('h1');
      title.textContent = 'GLM-4V 聊天记录';
      title.style.cssText = 'text-align:center;color:#333;margin-bottom:20px;';
      printContainer.appendChild(title);

      // 添加导出时间
      const exportTime = document.createElement('p');
      exportTime.textContent = `导出时间: ${new Date().toLocaleString('zh-CN')}`;
      exportTime.style.cssText = 'text-align:center;color:#666;margin-bottom:30px;';
      printContainer.appendChild(exportTime);

      // 复制消息列表
      const messageList = chatContainer.cloneNode(true) as HTMLElement;
      messageList.style.cssText = 'max-height:none;overflow:visible;';
      
      // 移除加载动画
      const loadingElements = messageList.querySelectorAll('.loading-indicator');
      loadingElements.forEach(el => el.remove());

      printContainer.appendChild(messageList);
      document.body.appendChild(printContainer);

      // 等待图片加载
      const images = printContainer.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      // 在导出时注入临时样式，覆盖半透明/浅色 UI，使导出在 PDF 中可读
      const exportStyle = document.createElement('style');
      exportStyle.innerHTML = `
        .chat-interface, .chat-messages-container { background: #ffffff !important; color: #111 !important; }
        .message-bubble.assistant { background: #ffffff !important; color: #111 !important; box-shadow: none !important; }
        .message-bubble.user { background: linear-gradient(135deg,#4facfe,#00f2fe) !important; color: #fff !important; }
        .attachment-preview { background: #ffffff !important; border: none !important; }
        .message-text, .sender-name, .message-time { color: #222 !important; opacity: 1 !important; }
        .markdown-link { color: #0b6efd !important; text-decoration: underline !important; }
        * { opacity: 1 !important; filter: none !important; }
      `;
      printContainer.insertBefore(exportStyle, printContainer.firstChild);

      // 使用html2canvas转换为图片
      const canvas = await html2canvas(printContainer, {
        scale: Math.max(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // 创建PDF（按像素精确分页，避免淡化/重叠问题）
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidthMm = 210; // A4 宽度 mm
      const pageHeightMm = 297; // A4 高度 mm

      // 将像素转换为 mm: pxPerMm = canvas.width(px) / imgWidthMm(mm)
      const pxPerMm = canvas.width / imgWidthMm;
      const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);

      let renderedHeight = 0;
      const totalHeight = canvas.height;
      const ctx = canvas.getContext('2d');

      while (renderedHeight < totalHeight) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pageHeightPx, totalHeight - renderedHeight);
        const pageCtx = pageCanvas.getContext('2d');
        if (pageCtx && ctx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(canvas, 0, renderedHeight, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
        }

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const imgHeightMm = pageCanvas.height / pxPerMm;

        if (renderedHeight === 0) {
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, imgHeightMm);
        } else {
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, imgHeightMm);
        }

        renderedHeight += pageCanvas.height;
      }

      // 下载PDF
      const fileName = `GLM-4V聊天记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);

      // 清理
      document.body.removeChild(printContainer);
      document.body.removeChild(loadingMsg);

    } catch (error) {
      console.error('导出PDF失败:', error);
      alert('导出PDF失败，请重试');
    }
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
        <button 
          className="export-pdf-button"
          onClick={exportToPDF}
          title="导出为PDF"
          disabled={isLoading || messages.length === 0}
        >
          📄 导出PDF
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