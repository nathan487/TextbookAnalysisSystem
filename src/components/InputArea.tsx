// src/components/InputArea.tsx
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import FileUploader from './FileUploader/FileUploader';
import { UploadedFile } from '../utils/fileUtils';
import './InputArea.css';

interface InputAreaProps {
  onSendMessage: (content: string, files?: UploadedFile[]) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  initialFiles?: UploadedFile[];
  onFilesChange?: (files: UploadedFile[]) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isLoading,
  onStopGeneration,
  initialFiles = [],
  onFilesChange
}) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>(initialFiles);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 同步外部传入的文件列表
  useEffect(() => {
    setAttachedFiles(initialFiles);
  }, [initialFiles]);

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
      clearAttachedFiles();
      setShowFileUploader(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const clearAttachedFiles = () => {
    setAttachedFiles([]);
    if (onFilesChange) {
      onFilesChange([]);
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
    const newFiles = [...attachedFiles, ...files];
    setAttachedFiles(newFiles);
    if (onFilesChange) {
      onFilesChange(newFiles);
    }
    setShowFileUploader(false);
  };

  const removeFile = (fileId: string) => {
    const newFiles = attachedFiles.filter(file => file.id !== fileId);
    setAttachedFiles(newFiles);
    if (onFilesChange) {
      onFilesChange(newFiles);
    }
  };

  const toggleFileUploader = () => {
    setShowFileUploader(!showFileUploader);
  };

  // 获取文件图标
  const getFileIcon = (file: UploadedFile): string => {
    const mimeType = file.type.toLowerCase();
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType === 'application/msword' || 
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return '📝';
    }
    if (mimeType.startsWith('audio/')) return '🎵';
    return '📎';
  };

  // 获取文件分类
  const getFileCategory = (file: UploadedFile): string => {
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
                    {getFileIcon(file)}
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
                      {getFileCategory(file)}
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
        
        <div className="button-row">
        <button 
          className="action-button input-clear-button"
          onClick={handleClear}
          disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
          title="清空输入"
        >
          ✕
        </button>

        <button 
          className="action-button file-upload-button"
          onClick={toggleFileUploader}
          disabled={isLoading}
          title={showFileUploader ? '隐藏文件上传' : '上传文件'}
        >
          📎
        </button>

        {isLoading && onStopGeneration ? (
          <button 
            className="action-button stop-button"
            onClick={onStopGeneration}
            title="停止生成 (Esc)"
          >
            ⏹️
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
                  <span className="send-icon" style={{ 
                    fontSize: '25px', 
                    fontWeight: 'bold',
                    transform: 'scale(1.3)'
                  }}>↑</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      <div className="input-hints">
        可以加入提示
      </div>
    </div>
  );
};

export default InputArea;