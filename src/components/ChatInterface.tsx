import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { sendMessageStream, simulateStreamResponse } from '../api/chatApi';
import { uploadFile, UploadedFile, isDeepSeekSupported } from '../utils/fileUtils';
import './ChatInterface.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  files?: UploadedFile[];
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  vision: boolean;
  supports: string[];
  context_length?: number;  // 添加可选字段
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '你好！我是AI助手，基于Qwen-VL多模态模型。我可以分析你上传的图片、PDF等文件，并进行视觉理解。',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingRealAPI, setIsUsingRealAPI] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
// 在 ChatInterface.tsx 中更新初始模型列表
const [availableModels, setAvailableModels] = useState<ModelInfo[]>([
  {
    id: 'deepseek-ai/DeepSeek-V3.2',
    name: 'DeepSeek-V3.2',
    description: '强大的代码和文本分析模型',
    max_tokens: 32768,
    vision: false,
    supports: ['代码生成', '文本分析', '文件分析', '数学推理'],
    context_length: 128000
  },
  {
    id: 'deepseek-ai/DeepSeek-OCR',
    name: 'DeepSeek-OCR',
    description: '视觉OCR模型，支持图像文字识别',
    max_tokens: 32768,
    vision: true,
    supports: ['图像识别', 'OCR文字提取', '文本分析'],
    context_length: 128000
  },
  {
    id: 'Qwen/Qwen3-VL-32B-Instruct',
    name: 'Qwen3-VL-32B',
    description: '多模态视觉模型，支持推理和文件分析',
    max_tokens: 32768,
    vision: true,
    supports: ['视觉理解', '复杂推理', '文件分析', '文本分析'],
    context_length: 32000
  },
  {
    id: 'Qwen/Qwen2.5-VL-72B-Instruct',
    name: 'Qwen2.5-VL-72B',
    description: '视觉语言模型',
    max_tokens: 8192,
    vision: true,
    supports: ['图像识别', 'PDF分析'],
    context_length: 8192
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen2.5-72B',
    description: '纯文本语言模型',
    max_tokens: 32768,
    vision: false,
    supports: ['文本对话'],
    context_length: 32768
  }
]);

// 更新默认选择的模型
const [selectedModel, setSelectedModel] = useState<string>('deepseek-ai/DeepSeek-V3.2');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取当前选择的模型信息
  const getCurrentModel = useCallback(() => {
    return availableModels.find(model => model.id === selectedModel) || availableModels[0];
  }, [selectedModel, availableModels]);

  // 获取模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models);
          // 如果当前选择的模型不在新列表中，选择第一个
          if (!data.models.some((model: ModelInfo) => model.id === selectedModel)) {
            setSelectedModel(data.models[0]?.id || 'Qwen/Qwen2.5-VL-72B-Instruct');
          }
        }
      } catch (error) {
        console.error('获取模型列表失败:', error);
      }
    };

    fetchModels();
  }, []);

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

  const handleSendMessage = async (content: string, files?: UploadedFile[]) => {
  if ((!content.trim() && (!files || files.length === 0)) || isLoading) return;

  // 如果有正在进行的生成，先停止
  if (isLoading && abortController) {
    stopGeneration();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 构建消息内容
  let messageContent = content;
  if (files && files.length > 0) {
    const fileDescriptions = files.map(file => 
      `[${file.supportedByDeepSeek ? '✅' : '📄'} 文件: ${file.name} (${formatFileSize(file.size)})]`
    ).join('\n');
    messageContent = fileDescriptions + (content ? `\n\n${content}` : '');
  }

  // 添加用户消息
  const userMessage: Message = {
    id: Date.now().toString(),
    content: messageContent,
    sender: 'user',
    timestamp: new Date(),
    files: files || []
  };
  setMessages(prev => [...prev, userMessage]);
  setIsLoading(true);

  // 创建AI消息
  const aiMessageId = (Date.now() + 1).toString();
  const aiMessage: Message = {
    id: aiMessageId,
    content: '',
    sender: 'assistant',
    timestamp: new Date()
  };
  setMessages(prev => [...prev, aiMessage]);

  // 创建AbortController
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
      // 真实API模式 - SiliconFlow
      // 获取当前模型信息
      const currentModel = getCurrentModel();
      const isVisionModel = currentModel.vision;
  
      // 构建文件数据 - 确保包含正确的路径信息
      const fileData = (files || []).map(file => {
       // 提取相对路径
      let filePath = '';
      if (file.url && file.url.includes('/uploads/')) {
          const urlParts = file.url.split('/uploads/');
        if (urlParts.length > 1) {
          filePath = '/uploads/' + urlParts[1];
        }
      }
    
      return {
        id: file.id,
        name: file.name,
        type: file.type,
        url: file.url,
        path: filePath, // 添加相对路径
        deepSeekReady: file.deepSeekReady,
        supportedByDeepSeek: file.supportedByDeepSeek,
        category: getFileCategory(file.type)
      };
    });

    console.log('📤 发送请求数据:', {
      message: content,
      files: fileData,
      model: selectedModel,
      max_tokens: 4000,
      isVisionModel: isVisionModel
    });

    const requestData = {
      message: content,
      files: fileData,
      model: selectedModel,
      max_tokens: 4000
    };

      const response = await fetch('http://localhost:3001/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      if (!reader) {
        onError('无法读取响应流');
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  processLine(line.slice(6), onChunk, onError);
                }
              }
            }
            onComplete();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              processLine(line.slice(6), onChunk, onError);
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        console.error('Stream reading error:', error);
        onError('读取数据流时出错');
      } finally {
        reader.releaseLock();
      }

    } else {
      // 模拟模式
      await simulateStreamResponse(
        messageContent, 
        onChunk, 
        onComplete,
        controller
      );
    }

  } catch (error) {
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

// 辅助函数：获取文件分类
const getFileCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType === 'application/pdf') return 'pdfs';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'others';
};
  

  // 处理SSE数据行
  const processLine = (
    dataStr: string,
    onChunk: (chunk: string) => void,
    onError: (error: string) => void
  ) => {
    if (dataStr.trim() === '') return;
    
    if (dataStr === '[DONE]') {
      return;
    }

    try {
      const data = JSON.parse(dataStr);
      
      if (data.type === 'chunk' && data.content) {
        onChunk(data.content);
      } else if (data.type === 'error') {
        onError(data.message || '未知错误');
      }
    } catch (e) {
      console.warn('Failed to parse SSE data:', dataStr, e);
    }
  };

  // 辅助函数
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    if (isLoading && abortController) {
      stopGeneration();
    }
    
    setIsUsingRealAPI(!isUsingRealAPI);
    const currentModel = getCurrentModel();
    const status = !isUsingRealAPI ? '真实Qwen-VL API' : '模拟模式';
    const features = currentModel.vision ? '✓ 支持图像和文件分析' : '✓ 支持文本对话';
    alert(`已切换到${status}\n模型: ${currentModel.name}\n${features}`);
  };

  const handleModelChange = (modelId: string) => {
    if (isLoading && abortController) {
      stopGeneration();
    }

    const newModel = availableModels.find(m => m.id === modelId);
    if (newModel) {
      setSelectedModel(modelId);

      // 显示模型切换提示
      const modelName = newModel.name;
      const capabilities = newModel.supports.join(' | ');
      const contextLength = newModel.context_length ? `上下文: ${(newModel.context_length / 1000).toFixed(0)}K` : '';

      console.log(`切换模型到: ${modelName} (${capabilities}) ${contextLength}`);

      // 在界面上显示简短提示
      if (modelId.includes('DeepSeek-V3.2')) {
        console.log('✓ 选择 DeepSeek-V3.2 - 专为代码和文本、文件分析优化');
      } else if (modelId.includes('DeepSeek-OCR')) {
        console.log('✓ 选择 DeepSeek-OCR - 支持图像文字识别');
      } else if (modelId.includes('Qwen3-VL-32B')) {
        console.log('✓ 选择 Qwen3-VL-32B - 多模态视觉推理');
      }
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="header-left">
          <h1>🤖 Qwen-VL AI助手</h1>
          <div className="model-info">
            <select 
              className="model-select"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isLoading}
              title="选择AI模型"
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.vision ? '(多模态)' : '(纯文本)'}
                </option>
              ))}
            </select>
            
            <span className="status-indicator">
              ● {isUsingRealAPI ? '真实API' : '模拟模式'}
              {isUsingRealAPI && getCurrentModel().vision && ' ✓ 图像分析'}
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
        onStopGeneration={stopGeneration}
      />
      
      {isUsingRealAPI && (
        <div className="api-notice">
          ⚡ {getCurrentModel().name} 模式 | 
          {getCurrentModel().vision ? ' 支持图像/文件分析' : ' 纯文本对话'} | 
          最大长度: {getCurrentModel().max_tokens} tokens |
          {isLoading && ' 按 Esc 停止生成'}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;