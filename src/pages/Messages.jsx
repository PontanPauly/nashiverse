import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Search, User, Image as ImageIcon, Plus, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

export default function Messages() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
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

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => base44.entities.Conversation.list('-created_date'),
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

  const createConversation = useMutation({
    mutationFn: (data) => base44.entities.Conversation.create(data),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries(['conversations']);
      setSelectedConversation(newConv);
      setSelectedMembers([]);
      setGroupName("");
      setShowNewChatDialog(false);
    },
  });

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

  // Get conversations with last message and unread count
  const conversationList = React.useMemo(() => {
    if (!userProfile) return [];

    return conversations
      .filter(conv => conv.participant_ids.includes(userProfile.id))
      .map(conv => {
        const convMessages = messages.filter(m => m.conversation_id === conv.id);
        const sortedMsgs = convMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        const lastMessage = sortedMsgs[sortedMsgs.length - 1];
        const unreadCount = convMessages.filter(m => !m.is_read && m.from_person_id !== userProfile.id).length;

        let displayName = conv.name;
        if (conv.type === 'direct') {
          const otherPersonId = conv.participant_ids.find(id => id !== userProfile.id);
          const otherPerson = people.find(p => p.id === otherPersonId);
          displayName = otherPerson?.name || "Unknown";
        }

        return {
          conversation: conv,
          displayName,
          lastMessage,
          unreadCount,
        };
      })
      .filter(c => c.lastMessage) // Only show conversations with messages
      .sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));
  }, [conversations, messages, people, userProfile]);

  const filteredPeople = people.filter(p => 
    p.id !== userProfile?.id
  );

  const selectedMessages = selectedConversation 
    ? messages.filter(m => m.conversation_id === selectedConversation.id)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [];

  const handleCreateConversation = () => {
    if (selectedMembers.length === 0) return;

    const isGroup = selectedMembers.length > 1;
    createConversation.mutate({
      type: isGroup ? 'group' : 'direct',
      name: isGroup ? groupName : undefined,
      participant_ids: [...selectedMembers, userProfile.id],
      created_by_person_id: userProfile.id,
    });
  };

  const handleSend = () => {
    if (!messageText.trim() || !selectedConversation || !userProfile) return;

    sendMessage.mutate({
      from_person_id: userProfile.id,
      conversation_id: selectedConversation.id,
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
                onClick={() => setShowNewChatDialog(true)}
                size="icon"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <Plus className="w-4 h-4" />
              </Button>
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
                  {selectedConversation.type === 'group' ? (
                    <Users className="w-5 h-5 text-amber-400" />
                  ) : (
                    <span className="text-sm font-medium text-slate-400">
                      {people.find(p => p.id === selectedConversation.participant_ids.find(id => id !== userProfile?.id))?.name?.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-100">
                    {selectedConversation.type === 'group' 
                      ? selectedConversation.name 
                      : people.find(p => p.id === selectedConversation.participant_ids.find(id => id !== userProfile?.id))?.name}
                  </h2>
                  {selectedConversation.type === 'group' && (
                    <p className="text-xs text-slate-400">{selectedConversation.participant_ids.length} members</p>
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

      {/* New Conversation Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Start a Conversation</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Person Selection */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredPeople.map(person => (
                <button
                  key={person.id}
                  onClick={() => {
                    if (selectedMembers.includes(person.id)) {
                      setSelectedMembers(selectedMembers.filter(id => id !== person.id));
                    } else {
                      setSelectedMembers([...selectedMembers, person.id]);
                    }
                  }}
                  className="w-full p-3 rounded-lg hover:bg-slate-800 transition-colors text-left flex items-center gap-3 border border-transparent hover:border-slate-700"
                >
                  <Checkbox 
                    checked={selectedMembers.includes(person.id)}
                    className="bg-slate-800"
                  />
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {person.photo_url ? (
                      <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-medium text-slate-400">{person.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-100 text-sm">{person.name}</h3>
                    {person.nickname && <p className="text-xs text-slate-400">"{person.nickname}"</p>}
                  </div>
                </button>
              ))}
            </div>

            {/* Group Name Input */}
            {selectedMembers.length > 1 && (
              <div>
                <label className="text-sm text-slate-300 block mb-2">Group Name</label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Cousins Chat"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowNewChatDialog(false);
                  setSelectedMembers([]);
                  setGroupName("");
                }}
                variant="outline"
                className="flex-1 border-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateConversation}
                disabled={selectedMembers.length === 0 || (selectedMembers.length > 1 && !groupName.trim())}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                Start Chat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}