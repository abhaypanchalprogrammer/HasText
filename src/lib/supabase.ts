import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          code: string;
          name: string;
          content: string;
          created_at: string;
          created_by: string;
          last_edited_by: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          content?: string;
          created_at?: string;
          created_by: string;
          last_edited_by?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          content?: string;
          created_at?: string;
          created_by?: string;
          last_edited_by?: string | null;
        };
      };
    };
  };
};

/**
 * Get email for a given user id
 */
async function getUserEmail(userId: string | null): Promise<string> {
  if (!userId) return "Unknown";

  const { data, error } = await supabase
    .from("users") // ✅ you need a public `users` table synced from auth
    .select("email")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Failed to fetch email:", error.message);
    return "Unknown";
  }

  return data?.email || "Unknown";
}

/**
 * Subscribe to room updates
 */
export function subscribeToRoomUpdates(
  roomId: string,
  onUpdate: (update: { content: string; editorEmail: string }) => void
) {
  // Initial fetch
  supabase
    .from("rooms")
    .select("content, last_edited_by")
    .eq("id", roomId)
    .single()
    .then(async ({ data, error }) => {
      if (error) {
        console.error("Initial fetch error:", error.message);
        return;
      }

      const editorEmail = await getUserEmail(data?.last_edited_by || null);
      onUpdate({
        content: data?.content || "",
        editorEmail,
      });
    });

  // Subscribe to realtime updates
  const channel = supabase
    .channel("room-updates")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      async (payload) => {
        const editorEmail = await getUserEmail(payload.new.last_edited_by);
        onUpdate({
          content: payload.new.content,
          editorEmail,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
