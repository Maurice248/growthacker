"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { signIn } from "next-auth/react";
import "../globals.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  // Forgot Password States
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Reset Password States
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Clear messages after 5 seconds
  useEffect(() => {
    if (errorStatus || successStatus) {
      const timer = setTimeout(() => {
        setErrorStatus(null);
        setSuccessStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorStatus, successStatus]);

  // Check for recovery access tokens in URL hash (Supabase password reset redirect)
  useEffect(() => {
    const checkRecovery = () => {
      const hash = window.location.hash;
      if (hash && (hash.includes("type=recovery") || hash.includes("access_token="))) {
        setIsResetMode(true);
        setForgotPasswordMode(false);
        setSuccessStatus("Secure password reset session activated. Please enter your new password below.");
      }
    };
    checkRecovery();
  }, []);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorStatus(null);
    setSuccessStatus(null);

    const enteredEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@tenantreport.ai").toLowerCase();
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Meta123.com";

    // ── NextAuth (client dashboard) for platform admin ──
    if (enteredEmail === adminEmail) {
      const nextAuthResult = await signIn("credentials", {
        email: enteredEmail,
        password,
        redirect: false,
      });
      if (!nextAuthResult?.error) {
        setSuccessStatus("Authentication successful. Redirecting to client dashboard...");
        setTimeout(() => router.push("/client-dashboard"), 400);
        setLoading(false);
        return;
      }
    }

    // ── Local bypass (legacy main dashboard at /) ──
    if (enteredEmail === adminEmail && password === adminPassword) {
      localStorage.setItem("app_auth_session", "true");
      localStorage.setItem("app_user_email", enteredEmail);
      setSuccessStatus("Authentication successful. Redirecting...");
      setTimeout(() => router.push("/"), 400);
      setLoading(false);
      return;
    }

    // Enforce single-user policy
    if (enteredEmail !== adminEmail) {
      setErrorStatus("Access restricted. Only the authorized administrator account can access this system.");
      setLoading(false);
      return;
    }

    // ── Supabase Auth fallback ──
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        // Friendly message — most likely wrong password
        setErrorStatus("Invalid credentials. Please check your email and password.");
        setLoading(false);
        return;
      }

      if (data?.user) {
        localStorage.setItem("app_auth_session", "true");
        localStorage.setItem("app_user_email", data.user.email || enteredEmail);
        setSuccessStatus("Authentication successful. Redirecting...");
        setTimeout(() => router.push("/"), 400);
      }
    } catch (err: any) {
      console.error("Auth error:", err?.message);
      setErrorStatus("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorStatus(null);
    setSuccessStatus(null);

    const singleUserEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@tenantreport.ai").toLowerCase();
    if (forgotEmail.trim().toLowerCase() !== singleUserEmail) {
      setErrorStatus("Access restricted. You can only request reset links for the single authorized administrator email.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/login`
      });

      if (error) {
        setErrorStatus(error.message || "Failed to send password reset link.");
      } else {
        setSuccessStatus("Secure password reset link has been sent. Please check your email!");
      }
    } catch (error: any) {
      console.error("Supabase Reset Error:", error?.message);
      setErrorStatus("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorStatus(null);
    setSuccessStatus(null);

    if (newPassword !== confirmNewPassword) {
      setErrorStatus("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setErrorStatus("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setErrorStatus(error.message || "Failed to update your password.");
      } else {
        setSuccessStatus("Password updated successfully! Redirecting you to login...");
        
        // Log out of the recovery session so they can login normally
        await supabase.auth.signOut();
        
        setTimeout(() => {
          setIsResetMode(false);
          setForgotPasswordMode(false);
          setNewPassword("");
          setConfirmNewPassword("");
          // Clear hash to prevent reloading loop
          window.history.replaceState(null, "", window.location.pathname);
        }, 2000);
      }
    } catch (error: any) {
      console.error("Supabase Update Password Error:", error?.message);
      setErrorStatus("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FDF6E3",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      {/* Decorative background components */}
      <div style={{
        position: "absolute",
        borderRadius: "50%",
        filter: "blur(80px)",
        zIndex: 1,
        opacity: 0.15,
        width: "400px",
        height: "400px",
        backgroundColor: "#669BBC",
        top: "-100px",
        right: "-100px"
      }}></div>
      <div style={{
        position: "absolute",
        borderRadius: "50%",
        filter: "blur(80px)",
        zIndex: 1,
        opacity: 0.15,
        width: "300px",
        height: "300px",
        backgroundColor: "#06B6D4",
        bottom: "-50px",
        left: "-50px"
      }}></div>

      <div style={{
        width: "100%",
        maxWidth: "440px",
        backgroundColor: "#FFFFFF",
        borderRadius: "20px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(15, 23, 42, 0.08)",
        position: "relative",
        zIndex: 10,
        overflow: "hidden"
      }}>
        <div style={{
          padding: "clamp(24px, 6vw, 40px) clamp(20px, 6vw, 40px) 24px",
          textAlign: "center",
          background: "linear-gradient(to bottom, #E7F0F6, transparent)"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            backgroundColor: "#FFFFFF",
            color: "#003049",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
            border: "1px solid #E8DCC2"
          }}>
            <Building2 size={28} />
          </div>
          <h1 style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#003049",
            marginBottom: "12px",
            letterSpacing: "-0.025em",
            lineHeight: 1.2
          }}>Tenant Report AI</h1>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{
              display: "inline-block",
              padding: "4px 12px",
              backgroundColor: "#E7F0F6",
              border: "1px solid #C2D6E2",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#003049",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>Marketing Platform</span>
          </div>
        </div>

        <div style={{ padding: "0 clamp(20px, 6vw, 40px) 32px" }}>
          {isResetMode ? (
            /* ─── RESET PASSWORD FORM ─── */
            <>
              <h2 style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#003049",
                textAlign: "center",
                marginBottom: "8px"
              }}>Reset Password</h2>
              <p style={{
                fontSize: "14px",
                color: "#8C8474",
                textAlign: "center",
                marginBottom: "28px",
                lineHeight: "1.5"
              }}>
                Create a secure new password for your administrator account.
              </p>

              <form onSubmit={handleResetPassword} style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px"
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <label style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#8C8474",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    paddingLeft: "4px"
                  }}>New Password</label>
                  <div style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <div style={{
                      position: "absolute",
                      left: "14px",
                      color: "#9FA8A3",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 44px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #C2B79A",
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: "#003049",
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                        height: "46px"
                      }}
                      className="focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      required
                    />
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <label style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#8C8474",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    paddingLeft: "4px"
                  }}>Confirm New Password</label>
                  <div style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <div style={{
                      position: "absolute",
                      left: "14px",
                      color: "#9FA8A3",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 44px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #C2B79A",
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: "#003049",
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                        height: "46px"
                      }}
                      className="focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  style={{
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "#003049",
                    color: "#FFFFFF",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 48, 73, 0.2), 0 2px 4px -2px rgba(0, 48, 73, 0.2)",
                    marginTop: "8px",
                    height: "48px"
                  }}
                  className="hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 shadow-md" 
                  disabled={loading}
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </>
          ) : forgotPasswordMode ? (
            /* ─── FORGOT PASSWORD FORM ─── */
            <>
              <h2 style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#003049",
                textAlign: "center",
                marginBottom: "8px"
              }}>Forgot Password</h2>
              <p style={{
                fontSize: "14px",
                color: "#8C8474",
                textAlign: "center",
                marginBottom: "28px",
                lineHeight: "1.5"
              }}>
                Enter the administrator email to receive a secure recovery link.
              </p>

              <form onSubmit={handleForgotPassword} style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px"
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <label style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#8C8474",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    paddingLeft: "4px"
                  }}>Corporate Email</label>
                  <div style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <div style={{
                      position: "absolute",
                      left: "14px",
                      color: "#9FA8A3",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      placeholder="admin@tenantreport.ai"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px 12px 44px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #C2B79A",
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: "#003049",
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                        height: "46px"
                      }}
                      className="focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  style={{
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "#003049",
                    color: "#FFFFFF",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 48, 73, 0.2), 0 2px 4px -2px rgba(0, 48, 73, 0.2)",
                    marginTop: "8px",
                    height: "48px"
                  }}
                  className="hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 shadow-md" 
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setErrorStatus(null);
                    setSuccessStatus(null);
                  }}
                  style={{
                    fontSize: "13px",
                    color: "#003049",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginTop: "4px"
                  }}
                  className="hover:underline"
                >
                  Back to Login
                </button>
              </form>
            </>
          ) : (
            /* ─── STANDARD LOGIN FORM ─── */
            <>
              <h2 style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#003049",
                textAlign: "center",
                marginBottom: "8px"
              }}>Administrator Login</h2>
              <p style={{
                fontSize: "14px",
                color: "#8C8474",
                textAlign: "center",
                marginBottom: "28px",
                lineHeight: "1.5"
              }}>
                Sign in to access your advertising and content dashboards.
              </p>

              {/* Error / Success messages */}
              {errorStatus && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "#F9E3E0", border: "1px solid #fecaca", borderRadius: 10, marginBottom: 16 }}>
                  <AlertCircle size={16} style={{ color: "#C1121F", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#780000", lineHeight: 1.5 }}>{errorStatus}</span>
                </div>
              )}
              {successStatus && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 16 }}>
                  <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#15803d", lineHeight: 1.5 }}>{successStatus}</span>
                </div>
              )}

              <form onSubmit={handleAuth} style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px"
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <label style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#8C8474",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    paddingLeft: "4px"
                  }}>Corporate Email</label>
                  <div style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <div style={{
                      position: "absolute",
                      left: "14px",
                      color: "#9FA8A3",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      placeholder="admin@tenantreport.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 16px 12px 44px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #C2B79A",
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: "#003049",
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                        height: "46px"
                      }}
                      className="focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      required
                    />
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <label style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#8C8474",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      paddingLeft: "4px",
                      flex: 1
                    }}>Security Credentials</label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(true);
                        setForgotEmail(email); // Autofill email if typed
                        setErrorStatus(null);
                        setSuccessStatus(null);
                      }}
                      style={{
                        fontSize: "11px",
                        color: "#003049",
                        fontWeight: 700,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em"
                      }}
                      className="hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center"
                  }}>
                    <div style={{
                      position: "absolute",
                      left: "14px",
                      color: "#9FA8A3",
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px 40px 12px 44px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #C2B79A",
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: "#003049",
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                        height: "46px"
                      }}
                      className="focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      required
                    />
                    <button
                      type="button"
                      style={{
                        position: "absolute",
                        right: "12px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#9FA8A3",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "4px",
                        borderRadius: "6px",
                        transition: "all 0.15s ease"
                      }}
                      className="hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  style={{
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "#003049",
                    color: "#FFFFFF",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 48, 73, 0.2), 0 2px 4px -2px rgba(0, 48, 73, 0.2)",
                    marginTop: "8px",
                    height: "48px"
                  }}
                  className="hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 shadow-md" 
                  disabled={loading}
                >
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <div className="w-4.5 h-4.5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div> Processing...
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <ShieldCheck size={18} />
                      Secure Access
                      <ArrowRight size={16} />
                    </div>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{
          padding: "0 clamp(20px, 6vw, 40px) 32px",
          textAlign: "center"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "20px"
          }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#E8DCC2" }}></div>
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#9FA8A3",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>Personnel Access Only</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#E8DCC2" }}></div>
          </div>
          <p style={{
            fontSize: "13px",
            color: "#8C8474",
            margin: 0
          }}>
            Restricted to authorized administrator accounts only.{" "}
            <a href="/client-login" style={{ color: "#003049", fontWeight: 600, textDecoration: "none" }}>
              Company login
            </a>
          </p>
        </div>
      </div>

      <div style={{
        marginTop: "32px",
        textAlign: "center",
        fontSize: "12px",
        color: "#9FA8A3",
        opacity: 0.8,
        position: "relative",
        zIndex: 10
      }}>
        <p>© 2026 Tenant Report AI. Restricted Administrative Access.</p>
      </div>
    </div>
  );
}
