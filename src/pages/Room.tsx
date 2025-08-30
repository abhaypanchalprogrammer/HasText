import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Copy,
  Download,
  Save,
  Users,
  ArrowLeft,
  Code,
  Share2,
} from "lucide-react";

const Room = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomData, setRoomData] = useState<any>(null);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roomCode && user) {
      loadRoom(roomCode);

      // ✅ Subscribe to real-time updates
      const channel = supabase
        .channel("room-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `code=eq.${roomCode}`,
          },
          (payload) => {
            if (payload.new) {
              setRoomData(payload.new);
              setContent(payload.new.content || "");
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomCode, user]);

  const loadRoom = async (code: string) => {
    if (!user) return;

    try {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (room) {
        setRoomData(room);
        setContent(room.content || "");
      } else {
        toast({
          title: "Room not found",
          description: "This room doesn't exist or you don't have access to it.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Error loading room:", error);
      toast({
        title: "Error",
        description: "Failed to load room data.",
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !roomCode) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("rooms")
        .update({
          content,
          editor_email: user.email, // ✅ record who edited
          updated_at: new Date().toISOString(),
        })
        .eq("code", roomCode);

      if (error) throw error;

      toast({
        title: "Saved successfully",
        description: "Your text has been saved to the room",
      });
    } catch (error) {
      console.error("Error saving room:", error);
      toast({
        title: "Save failed",
        description: "There was an error saving your text",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: "Text has been copied to your clipboard",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${roomData?.name || roomCode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Text file has been downloaded",
    });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Room link copied",
        description: "Share this link to invite others to the room",
      });
    } catch {
      toast({
        title: "Share failed",
        description: "Unable to copy room link",
        variant: "destructive",
      });
    }
  };

  if (loading || !roomData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Code className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">Loading room...</h2>
          <p className="text-muted-foreground">
            Please wait while we load your room
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left side */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
              <div className="flex items-center gap-2">
                <Code className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs">
                    {roomData.name}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Room Code: {roomCode}
                  </p>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!content}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!content}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {isSaving ? "Saving..." : "Save"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Editor */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <Card className="min-h-[600px]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>Collaborative Text Editor</span>
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  {content.length} characters
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start typing or paste your text here..."
                className="min-h-[500px] font-mono text-sm resize-none border-0 focus:ring-0 bg-editor-bg"
                style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineHeight: "1.6",
                }}
              />
            </CardContent>
          </Card>

          {/* Room Info */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Share room code{" "}
              <span className="font-mono font-semibold">{roomCode}</span> with
              others to collaborate
            </p>
            <p className="mt-1">
              Last saved:{" "}
              {roomData.updated_at
                ? new Date(roomData.updated_at).toLocaleString()
                : "Never"}
            </p>
            <p className="mt-1">
              Last edited by:{" "}
              <span className="font-medium">
                {roomData.editor_email || "Unknown"}
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Room;
