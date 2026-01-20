// src/components/MessageBubble.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';  // 新增：支持原始 HTML 输出（KaTeX 需要）
import 'katex/dist/katex.min.css';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: {
    content: string;
    sender: 'user' | 'assistant';
    timestamp: Date;
  };
}

// 为 code 组件定义正确的 props 类型
interface CodeProps {
  className?: string;
  children?: React.ReactNode;
  node?: any;
  inline?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const timeString = message.timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // 用户消息直接显示，不处理 Markdown
  if (isUser) {
    return (
      <div className="message-bubble-container user">
        <div className="message-content-wrapper">
          <div className="message-bubble user">
            <div className="message-text user-content">{message.content}</div>
            <div className="message-time">{timeString}</div>
          </div>
        </div>
        <div className="avatar user-avatar">
          <div className="avatar-icon">👤</div>
        </div>
      </div>
    );
  }

  // 预处理内容：替换转义的 LaTeX 分隔符为标准 $ 和 $$，防止 AI 偶尔输出 \[ \] 或 \( \)
  const processedContent = message.content
    .replace(/\\\[/g, '$$')   // \[ → $$
    .replace(/\\\]/g, '$$')   // \] → $$
    .replace(/\\\(/g, '$')    // \( → $
    .replace(/\\\)/g, '$');   // \) → $

  // AI 消息使用完整的 Markdown 和 LaTeX 渲染
  return (
    <div className="message-bubble-container assistant">
      <div className="avatar ai-avatar">
        <div className="avatar-icon">🤖</div>
      </div>
      <div className="message-content-wrapper">
        <div className="sender-name">AI助手</div>
        <div className="message-bubble assistant">
          <div className="message-text">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, rehypeKatex]}  // 更新：添加 rehypeRaw，确保 KaTeX 输出不被转义
              components={{
                // 链接处理
                a: ({ href, children }) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="markdown-link"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {children}
                  </a>
                ),
                
                // 代码处理
                code: ({ node, className, children, ...props }: CodeProps) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const inline = !match;
                  if (inline) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  } else {
                    return (
                      <div className="code-block">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </div>
                    );
                  }
                },
                
                // 表格
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      {children}
                    </table>
                  </div>
                ),
                
                // 引用
                blockquote: ({ children }) => (
                  <blockquote style={{
                    margin: '10px 0',
                    padding: '10px 15px',
                    borderLeft: '4px solid #4facfe',
                    background: 'rgba(79, 172, 254, 0.05)',
                    fontStyle: 'italic'
                  }}>
                    {children}
                  </blockquote>
                ),
                
                // 标题
                h1: ({ children }) => <h1 style={{ fontSize: '1.8em', margin: '1em 0 0.5em' }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontSize: '1.5em', margin: '1.2em 0 0.5em' }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: '1.3em', margin: '1em 0 0.5em' }}>{children}</h3>,
                h4: ({ children }) => <h4 style={{ fontSize: '1.1em', margin: '0.8em 0 0.3em', fontWeight: 600 }}>{children}</h4>,
                
                // 列表
                ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>{children}</ol>,
                li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
                
                // 段落
                p: ({ children }) => <p style={{ margin: '10px 0' }}>{children}</p>
              }}
              children={processedContent}  // 使用显式 children prop 来修复类型错误
            />
          </div>
          <div className="message-time">{timeString}</div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;