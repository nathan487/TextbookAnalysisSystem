// src/components/MessageList.tsx
import React from 'react';
import MessageBubble from './MessageBubble';
import './MessageList.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading }) => {
  return (
    <div className="message-list">
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
      {isLoading && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
          <span className="typing-text">AI正在思考...</span>
        </div>
      )}
    </div>
  );
};

export default MessageList;