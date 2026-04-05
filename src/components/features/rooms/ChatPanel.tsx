'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Wifi, WifiOff } from 'lucide-react';
import { useRoomChat } from '@/hooks/useRoomChat';

interface ChatPanelProps {
  roomId: string;
  currentUserId: string;
  currentDisplayName: string;
}

export function ChatPanel({ roomId, currentUserId, currentDisplayName }: ChatPanelProps) {
  const { messages, isConnected, isSending, sendMessage } = useRoomChat(roomId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (createdAt: string) => {
    return new Date(createdAt).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden" style={{ height: '460px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold">채팅</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-black/20" />
          )}
          <span className="text-[10px] text-black/40">
            {isConnected ? '실시간 연결' : '연결 중...'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-black/30 text-sm">
            첫 메시지를 보내보세요!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-[10px] font-semibold text-black/40 mb-1 ml-1">
                    {msg.displayName}
                  </span>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-orange-500 text-white rounded-tr-sm'
                      : 'bg-[#f5f5f5] text-black rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-black/30 mt-1 mx-1">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-black/5 p-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력... (Enter로 전송)"
          rows={1}
          className="flex-1 text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5] resize-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="px-3 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
