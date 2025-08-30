import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Code, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // prevent double submit

    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        console.error("Supabase Auth Error:", error); // Debug info
        toast({
          title: isLogin ? "Login failed" : "Registration failed",
          description: error.message || "Something went wrong.",
          variant: "destructive",
        });
        return;
      }

      if (isLogin) {
        toast({
          title: "Welcome back!",
          description: "You have been logged in successfully",
        });
        navigate("/dashboard");
      } else {
        toast({
          title: "Account created!",
          description:
            "Please check your email to confirm your account before logging in (if required).",
        });
        // Optional: auto-switch to login after signup
        setIsLogin(true);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Code className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">TextShare</h1>
          </div>
          <p className="text-muted-foreground">
            Share and collaborate on text in real-time
          </p>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to your account to continue"
                : "Sign up to start sharing text with your team"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading
                  ? "Loading..."
                  : isLogin
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </p>
              <Button
                variant="link"
                className="p-0 h-auto font-medium"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Sign up" : "Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Real Auth Info */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Powered by Supabase:</strong> Secure authentication and
            real-time data storage.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
