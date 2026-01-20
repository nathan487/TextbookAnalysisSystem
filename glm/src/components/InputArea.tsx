import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import './InputArea.css';

interface InputAreaProps {
  onSendMessage: (content: string, files?: Array<{type: string, data: string, name: string}>) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading,
  onStopGeneration 
}) => {
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{type: string, data: string, name: string}>>([]);
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
    if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
      onSendMessage(input.trim(), uploadedFiles);
      setInput('');
      setUploadedFiles([]);
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
    setUploadedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB 限制

    Array.from(files).forEach(file => {
      // 首先检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        alert(`文件 "${file.name}" 过大（${(file.size / 1024 / 1024).toFixed(2)}MB）\n请上传不超过 5MB 的文件，或压缩后再试。`);
        return;
      }

      // 检查文件类型
      if (file.type.startsWith('image/')) {
        // 图片文件
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setUploadedFiles(prev => [...prev, {
            type: 'image',
            data: base64,
            name: file.name
          }]);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf' || 
                 file.type === 'application/msword' || 
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // 文档文件（PDF, DOC, DOCX）
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setUploadedFiles(prev => [...prev, {
            type: 'document',
            data: base64,
            name: file.name
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        alert('仅支持图片（JPG、PNG、GIF）和文档（PDF、DOC、DOCX）格式');
      }
    });

    // 清空input以允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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

      {/* 文件预览区域 */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="file-preview">
              {file.type === 'image' ? (
                <img src={file.data} alt={file.name} className="preview-image" />
              ) : (
                <div className="preview-document">
                  📄 {file.name}
                </div>
              )}
              <button 
                className="remove-file"
                onClick={() => removeFile(index)}
                disabled={isLoading}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button 
            className="action-button attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="上传图片或文档"
          >
            📎
          </button>
          
          <button 
            className="action-button clear-button"
            onClick={handleClear}
            disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
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
              disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
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
        <span className="hint">� 支持图片和文档</span>
        {isLoading && (
          <span className="hint warning">⏹️ 按 Esc 停止生成</span>
        )}
      </div>
    </div>
  );
};

export default InputArea;