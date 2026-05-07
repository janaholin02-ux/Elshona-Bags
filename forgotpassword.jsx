import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Mail, AlertCircle, ArrowLeft, X, Lock } from "lucide-react";
import logo from "../assets/TechStoreLogo-removebg-preview.png";
import { toast } from "sonner";
import { updateUser, getAllUsers } from '../utils/myDatabase';

const API_URL = "http://localhost:3000";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [serverCode, setServerCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Check if user exists first
      const users = getAllUsers();
      const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (!userExists) {
        throw new Error("No account found with this email address");
      }

      // Send verification code request to API
      const res = await fetch(${API_URL}/register, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ Email: email })
      });

      if (!res.ok) {
        throw new Error("Failed to send verification code");
      }

      const data = await res.json();
      setServerCode(data.code); 
      
      setIsLoading(false);
      setShowVerificationModal(true);
      toast.info("Verification Code Sent", {
        description: "Please check your email for the verification code",
      });
    } catch (err) {
      setError(err.message || "Failed to send verification code");
      toast.error("Failed to send code", {
        description: err.message || "Please try again",
      });
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      // Compare the verification code from server with user input
      if (serverCode == verificationCode) {
        setShowVerificationModal(false);
        setShowPasswordReset(true);
        toast.success("Code verified!", {
          description: "Please enter your new password",
        });
      } else {
        toast.error("Invalid verification code", {
          description: "Please check the code and try again",
        });
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Verification failed", {
        description: "Unable to verify your code. Please try again.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match", {
        description: "Please make sure both passwords are identical",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password too short", {
        description: "Password must be at least 6 characters",
      });
      return;
    }

    const dbData = JSON.parse(localStorage.getItem("myDatabase") || '{"users":[]}');
    const currentUsers = Array.isArray(dbData) ? dbData : (dbData.users || []);
  
    if (!currentUsers || currentUsers.length === 0) {
      toast.error("Database error", { description: "No users found in system." });
      return;
    }
    
    // Find and update the user's password
    const userIndex = currentUsers.findIndex((u) => u.email === email);
    const userObject = currentUsers.find((u) => u.email === email);

    if (userIndex !== -1) {
      currentUsers[userIndex].password = newPassword;
      try {
        await updateUser(userObject.id, { password: newPassword });
        localStorage.setItem("myDatabase", JSON.stringify(currentUsers));
        
        toast.success("Password reset successful!", {
          description: "You can now log in with your new password",
        });
        
        navigate("/login");
      } catch (error) {
        console.error(error);
        toast.error("Update failed", { description: "Could not save new password." });
      }
    } else {
      toast.error("User not found", {
        description: "Unable to reset password",
      });
    }
  };

  // UI rendering logic remains the same (just returning the JSX)
  if (showPasswordReset) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {/* Your Password Reset UI Form here */}