import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Room.tsx
 * -----------------------------------------------------------------------------
 * ✅ What this file does
 * - Loads a room by `roomCode`
 * - Lets a user edit content and explicitly SAVE it
 * - On SAVE: writes to Supabase and relies on Supabase Realtime to broadcast
 * - Realtime subscription listens to UPDATE events for this room
 * - Other users will see the updated content instantly (no reload)
 * - Self-updates are ignored (to avoid flicker)
 * - Newer-update guard using `updated_at` ensures we don't apply stale payloads
 *
 * 🔒 What we explicitly DO NOT change
 * - **UI/Markup and classNames**: identical to your last provided code
 * - Only logic around realtime + guards is added
 *
 * 🧠 Implementation details
 * - We subscribe to `postgres_changes` for table `rooms`, event `UPDATE`
 * - We compare `payload.new.editor_email` with `user.email` to skip self
 * - We compare `payload.new.updated_at` with our local `lastAppliedAt` to only
 *   apply strictly newer updates (prevents stale overwrites)
 * - We do not touch the UI layout, Tailwind classes, or text
 * - Buttons already responsive via your classes (icons always, labels hidden on sm)
 * -----------------------------------------------------------------------------
 */

type RoomRow = {
  id: string;
  code: string;
  name: string | null;
  content: string | null;
  editor_email: string | null;
  updated_at: string | null;
  // add any other columns your table has; unused fields won't affect behavior
};

const Room = () => {
  // ---------------------------------------------------------------------------
  // Router + Auth
  // ---------------------------------------------------------------------------
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---------------------------------------------------------------------------
  // Local State
  // ---------------------------------------------------------------------------
  const [roomData, setRoomData] = useState<RoomRow | null>(null);
  const [content, setContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // We keep track of the latest "applied" updated_at so that we don't apply
  // stale payloads that arrive late/out-of-order.
  const lastAppliedAtRef = useRef<string | null>(null);

  // A ref to store current user email for quick comparisons inside listeners
  const myEmailRef = useRef<string | null>(null);
  useEffect(() => {
    myEmailRef.current = user?.email ?? null;
  }, [user?.email]);

  // Keep a stable channel name per room
  const channelName = useMemo(
    () => (roomCode ? `room-changes-${roomCode}` : "room-changes"),
    [roomCode]
  );

  // ---------------------------------------------------------------------------
  // Load initial data + subscribe to realtime changes (UPDATE only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Guard: both roomCode and user must be present
    if (!roomCode || !user) return;

    let isMounted = true;

    // Initial load
    (async () => {
      await loadRoom(roomCode, isMounted);
    })();

    // Realtime subscription
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE", // ✅ Listen to UPDATE only
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          // Safety checks
          if (!payload?.new) return;

          const next = payload.new as RoomRow;

          // 1) Ignore self-updates to avoid unnecessary flicker
          //    If the editor_email of the payload equals our current user email,
          //    then WE were the one who saved it—skip applying it again.
          const isSelfUpdate =
            myEmailRef.current &&
            next.editor_email &&
            next.editor_email === myEmailRef.current;

          if (isSelfUpdate) {
            // Still update roomData so meta (like updated_at) is accurate
            setRoomData((prev) => {
              // We only "apply" the timestamp tracker if it's newer
              if (isNewer(next.updated_at, lastAppliedAtRef.current)) {
                lastAppliedAtRef.current = next.updated_at ?? null;
              }
              return { ...(prev ?? ({} as RoomRow)), ...next };
            });
            return;
          }

          // 2) Apply only if newer than our last applied timestamp
          const isNewerThanLocal = isNewer(
            next.updated_at,
            lastAppliedAtRef.current
          );

          if (!isNewerThanLocal) {
            // Stale payload—ignore
            return;
          }

          // 3) Apply incoming content + metadata
          lastAppliedAtRef.current = next.updated_at ?? null;
          setRoomData(next);
          setContent(next.content ?? "");
        }
      )
      .subscribe((status) => {
        // Optional: console status for debugging
        // "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"
        // eslint-disable-next-line no-console
        console.log(`[Supabase] subscription status (${channelName}):`, status);
      });

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, user, channelName]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Load a room by code. Applies content and metadata.
   * Uses "newer update wins" logic to set lastAppliedAtRef for future guards.
   */
  const loadRoom = async (code: string, isMounted = true) => {
    if (!user) return;

    try {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .single<RoomRow>();

      if (error && (error as any).code !== "PGRST116") {
        throw error;
      }

      if (room) {
        // Track the last applied updated_at to guard against stale realtime
        lastAppliedAtRef.current = room.updated_at ?? null;

        if (isMounted) {
          setRoomData(room);
          setContent(room.content ?? "");
        }
      } else {
        // Room not found or not accessible
        toast({
          title: "Room not found",
          description:
            "This room doesn't exist or you don't have access to it.",
          variant: "destructive",
        });
        navigate("/dashboard");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error loading room:", error);
      toast({
        title: "Error",
        description: "Failed to load room data.",
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  /**
   * Compare ISO timestamps; returns true if `a` is strictly newer than `b`.
   */
  function isNewer(a: string | null | undefined, b: string | null | undefined) {
    if (!a && !b) return false;
    if (a && !b) return true;
    if (!a && b) return false;
    // Both defined
    const da = Date.parse(a as string);
    const db = Date.parse(b as string);
    if (Number.isNaN(da) || Number.isNaN(db)) return !!a && !b;
    return da > db;
  }

  // ---------------------------------------------------------------------------
  // Action Handlers (Save / Copy / Download / Share)
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!user || !roomCode) return;

    setIsSaving(true);

    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("rooms")
        .update({
          content,
          editor_email: user.email, // ✅ record who edited
          updated_at: nowIso,
        })
        .eq("code", roomCode);

      if (error) throw error;

      // ⚡ Do not update content here; realtime will broadcast to others.
      // We *can* optimistically update lastAppliedAt to avoid false "stale"
      // filters on the coming realtime packet, but we also skip self updates.
      // Set our local lastAppliedAt to now so future remote payloads compare correctly.
      lastAppliedAtRef.current = nowIso;

      toast({
        title: "Saved successfully",
        description: "Your text has been saved to the room",
      });
    } catch (error) {
      // eslint-disable-next-line no-console
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

  // ---------------------------------------------------------------------------
  // Loading State UI (UNCHANGED)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Main UI (ABSOLUTELY UNCHANGED)
  // ---------------------------------------------------------------------------
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
