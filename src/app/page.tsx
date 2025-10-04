"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
      router.push('/conversational');
    }
  }, [router]);

  const handleLogin = () => {
    setIsLoading(true);
    // Set logged in flag
    localStorage.setItem('isLoggedIn', 'true');
    // Redirect to conversational page
    router.push('/conversational');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎙️</div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Welcome
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            AI-Powered Conversational Learning
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-xl font-semibold text-lg bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Start Conversation'}
          </button>

          <div className="text-center">
            <a
              href="/transcription"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
            >
              Go to Transcription App
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl mb-1">🎤</div>
              <div className="text-gray-600 dark:text-gray-400">Voice AI</div>
            </div>
            <div>
              <div className="text-2xl mb-1">🧠</div>
              <div className="text-gray-600 dark:text-gray-400">Learns About You</div>
            </div>
            <div>
              <div className="text-2xl mb-1">👶</div>
              <div className="text-gray-600 dark:text-gray-400">Kid Friendly</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
