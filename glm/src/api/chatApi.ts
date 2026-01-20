// src/api/chatApi.ts

const API_BASE_URL = 'http://localhost:3001/api';

// 普通API调用（非流式）
export const sendMessage = async (message: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.reply;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// 流式API调用（逐字显示效果）
export const sendMessageStream = async (
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  abortController?: AbortController,
  files?: Array<{type: string, data: string, name: string}>
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message,
        files: files || [],
        max_tokens: 2000
      }),
      signal: abortController?.signal  // 添加中断支持
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
    }

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
          // 检查是否还有未处理的数据
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
      // 处理TypeScript未知类型错误
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // 重新抛出中断错误
      }
      console.error('Stream reading error:', error);
      onError('读取数据流时出错');
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    // 处理TypeScript未知类型错误
    if (error instanceof Error && error.name === 'AbortError') {
      throw error; // 重新抛出中断错误
    }
    console.error('Stream Error:', error);
    onError(error instanceof Error ? error.message : '网络连接失败');
  }
};

// 模拟API也支持中断（添加到文件末尾）
export const simulateStreamResponseWithAbort = async (
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  abortController?: AbortController
) => {
  const responses = [
    `我收到了你的消息："${message}"。`,
    "这是一条模拟的流式响应，用于演示效果。",
    "每个字都会像这样逐字显示出来，创造自然的对话体验。",
    "你可以随时按停止按钮中断生成过程。"
  ];

  const fullResponse = responses.join(' ');

  try {
    // 模拟逐字输出，支持中断
    for (let i = 0; i < fullResponse.length; i++) {
      // 检查是否被中断
      if (abortController?.signal.aborted) {
        throw new Error('Aborted');
      }
      
      await new Promise(resolve => setTimeout(resolve, 20));
      onChunk(fullResponse[i]);
      
      // 每10个字符检查一次中断
      if (i % 10 === 0 && abortController?.signal.aborted) {
        throw new Error('Aborted');
      }
    }

    onComplete();
  } catch (error) {
    if (error instanceof Error && error.message === 'Aborted') {
      throw error; // 重新抛出中断错误
    }
    throw error;
  }
};

// 处理SSE数据行
function processLine(
  dataStr: string,
  onChunk: (chunk: string) => void,
  onError: (error: string) => void
) {
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
}

// 备用：模拟流式响应（用于测试，不调用真实API）
export const simulateStreamResponse = async (
  message: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  abortController?: AbortController // 添加可选参数
) => {
  const responses = [
    `我收到了你的消息："${message}"。`,
    "这是一条模拟的流式响应，用于演示效果。",
    "每个字都会像这样逐字显示出来，创造自然的对话体验。",
    "你可以随时按停止按钮中断生成过程。"
  ];

  const fullResponse = responses.join(' ');

  try {
    // 模拟逐字输出，支持中断
    for (let i = 0; i < fullResponse.length; i++) {
      // 检查是否被中断
      if (abortController?.signal.aborted) {
        throw new Error('Aborted');
      }
      
      await new Promise(resolve => setTimeout(resolve, 20));
      onChunk(fullResponse[i]);
      
      // 每10个字符检查一次中断
      if (i % 10 === 0 && abortController?.signal.aborted) {
        throw new Error('Aborted');
      }
    }

    onComplete();
  } catch (error) {
    if (error instanceof Error && error.message === 'Aborted') {
      throw error; // 重新抛出中断错误
    }
    throw error;
  }
};