import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, Users, FileText, Code } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRooms();
    }
  }, [user]);

  const fetchUserRooms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserRooms(data || []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = async () => {
    if (!user) return;

    const code = generateRoomCode();

    try {
      const { error } = await supabase.from("rooms").insert({
        code,
        name: roomName || `Room ${code}`,
        content: "",
        created_by: user.id,
        editor_email: user.email, // ✅ added email when creating room
      });

      if (error) throw error;

      toast({
        title: "Room created!",
        description: `Room ${code} has been created successfully`,
      });

      navigate(`/room/${code}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.trim()) {
      navigate(`/room/${joinCode.toUpperCase()}`);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Code className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">
                TextShare
              </h1>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Share text instantly
            </h2>
            <p className="text-xl text-muted-foreground">
              Create private rooms to share and collaborate on text with your
              team
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Create Room */}
            <Card className="border-2 hover:border-ring transition-colors cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  <PlusCircle className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Create Room</CardTitle>
                <CardDescription>
                  Start a new private room for text sharing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full" size="lg">
                      Create New Room
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Room</DialogTitle>
                      <DialogDescription>
                        Give your room a name (optional) and start sharing text
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="roomName">Room Name (optional)</Label>
                        <Input
                          id="roomName"
                          placeholder="My Awesome Project"
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleCreateRoom} className="w-full">
                        Create Room
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Join Room */}
            <Card className="border-2 hover:border-ring transition-colors cursor-pointer">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-3 bg-secondary/50 rounded-full w-fit">
                  <Users className="h-8 w-8 text-foreground" />
                </div>
                <CardTitle className="text-2xl">Join Room</CardTitle>
                <CardDescription>
                  Enter a room code to join an existing room
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    placeholder="Enter room code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="text-center font-mono text-lg"
                  />
                  <Button
                    onClick={handleJoinRoom}
                    className="w-full"
                    size="lg"
                    disabled={!joinCode.trim()}
                  >
                    Join Room
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* My Rooms */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <CardTitle>My Rooms</CardTitle>
              </div>
              <CardDescription>Rooms you've created recently</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Loading rooms...</p>
                  </div>
                ) : userRooms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No rooms created yet</p>
                    <p className="text-sm">
                      Create your first room to get started
                    </p>
                  </div>
                ) : (
                  userRooms.map((room: any) => (
                    <div
                      key={room.code}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => navigate(`/room/${room.code}`)}
                    >
                      <div>
                        <h3 className="font-medium">{room.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Code: {room.code} • Created{" "}
                          {new Date(room.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          Last edited by: {room.editor_email || "Unknown"}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
