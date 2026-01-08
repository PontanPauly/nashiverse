import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Settings as SettingsIcon, 
  Users,
  Shield,
  Bell,
  UserPlus,
  Check,
  X,
  Copy,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("family");
  
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const { data: familySettings = [] } = useQuery({
    queryKey: ['family-settings'],
    queryFn: () => base44.entities.FamilySettings.list(),
  });

  const { data: joinRequests = [] } = useQuery({
    queryKey: ['join-requests'],
    queryFn: () => base44.entities.JoinRequest.filter({ status: 'pending' }),
  });

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => base44.entities.Person.list(),
  });

  const settings = familySettings[0];
  const isAdmin = settings?.admin_emails?.includes(user?.email) || user?.role === 'admin';

  const handleApproveRequest = async (request) => {
    await base44.entities.JoinRequest.update(request.id, {
      status: 'approved',
      reviewed_by_email: user.email
    });
    queryClient.invalidateQueries(['join-requests']);
    toast.success(`Approved ${request.requester_name}`);
  };

  const handleRejectRequest = async (request) => {
    await base44.entities.JoinRequest.update(request.id, {
      status: 'rejected',
      reviewed_by_email: user.email
    });
    queryClient.invalidateQueries(['join-requests']);
  };

  const generateInviteCode = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (settings?.id) {
      await base44.entities.FamilySettings.update(settings.id, { invite_code: code });
    } else {
      await base44.entities.FamilySettings.create({ 
        family_name: "Our Family",
        invite_code: code 
      });
    }
    queryClient.invalidateQueries(['family-settings']);
    toast.success("New invite code generated");
  };

  const copyInviteCode = () => {
    if (settings?.invite_code) {
      navigator.clipboard.writeText(settings.invite_code);
      toast.success("Invite code copied!");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-amber-400" />
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Manage your family universe</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="family" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
            <Users className="w-4 h-4 mr-2" />
            Family Settings
          </TabsTrigger>
          <TabsTrigger value="admin" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-900">
            <Shield className="w-4 h-4 mr-2" />
            Admin
          </TabsTrigger>
        </TabsList>

        {/* Family Settings Tab */}
        <TabsContent value="family" className="space-y-6">
          <FamilySettingsForm 
            settings={settings} 
            onUpdate={() => queryClient.invalidateQueries(['family-settings'])}
          />

          {/* Invite Code */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-400" />
              Invite New Members
            </h3>
            
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Share this invite code with family members who want to join
              </p>
              
              <div className="flex gap-2">
                <div className="flex-1 p-3 rounded-lg bg-slate-800 border border-slate-700 font-mono text-lg text-slate-200 tracking-wider">
                  {settings?.invite_code || "No code generated"}
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyInviteCode}
                  disabled={!settings?.invite_code}
                  className="border-slate-600 text-slate-100 hover:bg-slate-800 hover:border-slate-500"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={generateInviteCode}
                  className="border-slate-600 text-slate-100 hover:bg-slate-800 hover:border-slate-500"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Admin Tab */}
        <TabsContent value="admin" className="space-y-6">
          {/* Join Requests */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Pending Join Requests</h3>
            
            {joinRequests.length > 0 ? (
              <div className="space-y-3">
                {joinRequests.map((request) => (
                  <div 
                    key={request.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <div>
                      <p className="font-medium text-slate-200">{request.requester_name}</p>
                      <p className="text-sm text-slate-500">{request.requester_email}</p>
                      {request.notes && (
                        <p className="text-sm text-slate-400 mt-1">{request.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApproveRequest(request)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                        onClick={() => handleRejectRequest(request)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No pending requests</p>
            )}
          </div>

          {/* Admin Management */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Family Admins</h3>
            
            <div className="space-y-2">
              {settings?.admin_emails?.map((email, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                >
                  <span className="text-slate-300">{email}</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Admin
                  </Badge>
                </div>
              ))}
              {(!settings?.admin_emails || settings.admin_emails.length === 0) && (
                <p className="text-slate-500 text-sm">No admins configured</p>
              )}
            </div>
          </div>

          {/* Planners */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-medium text-slate-200 mb-4">Family Planners</h3>
            
            <div className="space-y-2">
              {settings?.planner_emails?.map((email, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                >
                  <span className="text-slate-300">{email}</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Planner
                  </Badge>
                </div>
              ))}
              {(!settings?.planner_emails || settings.planner_emails.length === 0) && (
                <p className="text-slate-500 text-sm">No planners configured</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FamilySettingsForm({ settings, onUpdate }) {
  const [formData, setFormData] = useState({
    family_name: settings?.family_name || "",
    tagline: settings?.tagline || "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        family_name: settings.family_name || "",
        tagline: settings.tagline || "",
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (settings?.id) {
      await base44.entities.FamilySettings.update(settings.id, formData);
    } else {
      await base44.entities.FamilySettings.create(formData);
    }

    setLoading(false);
    onUpdate();
    toast.success("Settings saved");
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Family Name</Label>
        <Input
          value={formData.family_name}
          onChange={(e) => setFormData({ ...formData, family_name: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., The Nash Family"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Family Tagline / Motto</Label>
        <Input
          value={formData.tagline}
          onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
          className="bg-slate-800 border-slate-700 text-slate-100"
          placeholder="e.g., Together we shine"
        />
      </div>

      <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900" disabled={loading}>
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}