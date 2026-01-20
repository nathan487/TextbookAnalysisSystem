import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import FileUploader from './FileUploader/FileUploader';
import { UploadedFile } from '../utils/fileUtils';
import './InputArea.css';

interface InputAreaProps {
  onSendMessage: (content: string, files?: UploadedFile[]) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading,
  onStopGeneration 
}) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取文件图标
  const getFileIcon = (file: UploadedFile | File): string => {
    const mimeType = file.type.toLowerCase();
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType === 'application/msword' || 
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return '📝';  // Word 文档图标
    }
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📎';
  };

  // 获取文件分类
  const getFileCategory = (file: UploadedFile | File): string => {
    const mimeType = file.type.toLowerCase();
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/msword' || 
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'document';
    }
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('text/')) return 'text';
    return 'other';
  };

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
    if ((input.trim() || attachedFiles.length > 0) && !isLoading) {
      onSendMessage(input.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
      setInput('');
      setAttachedFiles([]);
      setShowFileUploader(false);
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

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
    setShowFileUploader(false);
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const toggleFileUploader = () => {
    setShowFileUploader(!showFileUploader);
  };

  const formatFileName = (name: string) => {
    if (name.length > 20) {
      return `${name.substring(0, 17)}...`;
    }
    return name;
  };

  return (
    <div className="input-area">
      {/* 已附加的文件预览 */}
      {attachedFiles.length > 0 && (
        <div className="attached-files-section">
          <div className="section-header">
            <h4 className="section-title">📎 附加文件</h4>
            <span className="file-count">{attachedFiles.length} 个文件</span>
          </div>
          <div className="files-preview-grid">
            {attachedFiles.map((file) => (
              <div key={file.id} className="file-preview-card">
                <div className="file-card-header">
                  <span className="file-icon">
                    {getFileIcon(file)}  {/* 使用新的函数 */}
                  </span>
                  <button
                    className="file-remove-btn"
                    onClick={() => removeFile(file.id)}
                    title="移除文件"
                    disabled={isLoading}
                  >
                    ×
                  </button>
                </div>
                <div className="file-card-body">
                  <div className="file-name" title={file.name}>
                    {formatFileName(file.name)}
                  </div>
                  <div className="file-meta">
                    <span className="file-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <span className="file-type">
                      {getFileCategory(file)}  {/* 显示文件分类 */}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件上传器 */}
      {showFileUploader && (
        <div className="file-uploader-section">
          <FileUploader 
            onFilesUploaded={handleFilesUploaded}
            maxFiles={5}
            disabled={isLoading}
          />
        </div>
      )}

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
        <button 
          className={`example-button ${showFileUploader ? 'active' : ''}`}
          onClick={toggleFileUploader}
          disabled={isLoading}
          title={showFileUploader ? '隐藏文件上传' : '上传文件'}
        >
          {showFileUploader ? '📎 隐藏' : '📎 上传文件'}
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
            disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
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
              disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
            >
              {isLoading ? (
                <span className="sending">
                  <span className="spinner"></span>
                  发送中...
                </span>
              ) : (
                <>
                  {attachedFiles.length > 0 && <span className="file-indicator">+{attachedFiles.length}</span>}
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
        <span className="hint">📎 支持文件上传</span>
        <span className="hint">📝 上下文长度：128K</span>
        {isLoading && (
          <span className="hint warning">⏹️ 按 Esc 停止生成</span>
        )}
      </div>
    </div>
  );
};

export default InputArea;