import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Search, User, Image as ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

export default function Messages() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      base44.auth.redirectToLogin();
    }
  };

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: () => base44.entities.Message.list('-created_date'),
    refetchInterval: 3000, // Poll every 3 seconds
  });

  useEffect(() => {
    if (user && people.length > 0) {
      const profile = people.find(p => p.linked_user_email === user.email);
      setUserProfile(profile);
    }
  }, [user, people]);

  const sendMessage = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
      setMessageText("");
      scrollToBottom();
    },
  });

  const markAsRead = useMutation({
    mutationFn: ({ id }) => base44.entities.Message.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries(['messages']),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversation]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (selectedConversation && userProfile) {
      const unreadMessages = messages.filter(m => 
        m.to_person_id === userProfile.id && 
        m.from_person_id === selectedConversation.id &&
        !m.is_read
      );
      unreadMessages.forEach(msg => {
        markAsRead.mutate({ id: msg.id });
      });
    }
  }, [selectedConversation, messages, userProfile]);

  // Group messages into conversations
  const conversations = React.useMemo(() => {
    if (!userProfile) return [];

    const conversationMap = new Map();

    messages.forEach(msg => {
      const otherPersonId = msg.from_person_id === userProfile.id 
        ? msg.to_person_id 
        : msg.from_person_id;

      if (!otherPersonId) return;

      if (!conversationMap.has(otherPersonId)) {
        conversationMap.set(otherPersonId, []);
      }
      conversationMap.get(otherPersonId).push(msg);
    });

    return Array.from(conversationMap.entries()).map(([personId, msgs]) => {
      const person = people.find(p => p.id === personId);
      const sortedMsgs = msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const lastMessage = sortedMsgs[sortedMsgs.length - 1];
      const unreadCount = msgs.filter(m => m.to_person_id === userProfile.id && !m.is_read).length;

      return {
        person,
        messages: sortedMsgs,
        lastMessage,
        unreadCount,
      };
    }).sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));
  }, [messages, people, userProfile]);

  const filteredPeople = people.filter(p => 
    p.id !== userProfile?.id &&
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMessages = selectedConversation 
    ? messages.filter(m => 
        (m.from_person_id === userProfile?.id && m.to_person_id === selectedConversation.id) ||
        (m.from_person_id === selectedConversation.id && m.to_person_id === userProfile?.id)
      ).sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  const handleSend = () => {
    if (!messageText.trim() || !selectedConversation || !userProfile) return;

    sendMessage.mutate({
      from_person_id: userProfile.id,
      to_person_id: selectedConversation.id,
      content: messageText.trim(),
    });
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) return format(messageDate, 'h:mm a');
    if (isYesterday(messageDate)) return 'Yesterday';
    return format(messageDate, 'MMM d');
  };

  if (!user || !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      <div className="glass-card rounded-2xl overflow-hidden h-full flex">
        {/* Sidebar - Conversations List */}
        <div className="w-80 border-r border-slate-700/50 flex flex-col">
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-amber-400" />
                Messages
              </h1>
              <Button
                onClick={() => {
                  setShowNewChat(!showNewChat);
                  setSearchQuery("");
                }}
                size="icon"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={showNewChat ? "Select a person..." : "Search people..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showNewChat || searchQuery ? (
              // Show all people when starting new chat or searching
              <div className="p-2">
                {filteredPeople.length > 0 ? filteredPeople.map(person => (
                  <button
                    key={person.id}
                    onClick={() => {
                      setSelectedConversation(person);
                      setSearchQuery("");
                      setShowNewChat(false);
                    }}
                    className="w-full p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-left mb-1"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-slate-400">{person.name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-100 text-sm truncate">{person.name}</h3>
                        {person.nickname && <p className="text-xs text-slate-400">"{person.nickname}"</p>}
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="text-center py-8 px-4">
                    <p className="text-slate-500 text-sm">No people found</p>
                  </div>
                )}
              </div>
            ) : (
              // Show conversations
              <div className="p-2">
                {conversations.length > 0 ? conversations.map(({ person, lastMessage, unreadCount }) => (
                  <button
                    key={person.id}
                    onClick={() => setSelectedConversation(person)}
                    className={cn(
                      "w-full p-3 rounded-lg transition-colors text-left mb-1",
                      selectedConversation?.id === person.id
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "hover:bg-slate-800/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-slate-400">{person.name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-slate-100 text-sm truncate">{person.name}</h3>
                          <span className="text-xs text-slate-500">{formatMessageTime(lastMessage.created_date)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-400 truncate">{lastMessage.content}</p>
                          {unreadCount > 0 && (
                            <span className="ml-2 bg-amber-500 text-slate-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="text-center py-12 px-4">
                    <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No conversations yet</p>
                    <p className="text-slate-600 text-xs mt-1">Search above to start chatting</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                  {selectedConversation.photo_url ? (
                    <img src={selectedConversation.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-slate-400">{selectedConversation.name?.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-100">{selectedConversation.name}</h2>
                  {selectedConversation.nickname && (
                    <p className="text-xs text-slate-400">"{selectedConversation.nickname}"</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedMessages.map((msg) => {
                  const isFromMe = msg.from_person_id === userProfile.id;
                  return (
                    <div key={msg.id} className={cn("flex", isFromMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2",
                        isFromMe 
                          ? "bg-amber-500 text-slate-900" 
                          : "bg-slate-800 text-slate-100"
                      )}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={cn("text-xs mt-1", isFromMe ? "text-slate-800/70" : "text-slate-500")}>
                          {formatMessageTime(msg.created_date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-slate-700/50">
                <div className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-800 border-slate-700 text-slate-100"
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-300 mb-2">Select a Conversation</h3>
                <p className="text-slate-500">Choose a family member to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}