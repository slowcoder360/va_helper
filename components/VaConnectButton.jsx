'use client';

import React from 'react';
import { useUser } from '@clerk/nextjs';

const VaConnectButton = ({ className }) => {
  const { user, isLoaded } = useUser();

  const handleConnect = async () => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();
    
    // Set cookies before redirect (handled by API route)
    // This ensures user_id and oauth_state are available on callback
    const response = await fetch('/api/oauth/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.id,
        state 
      }),
    });

    if (!response.ok) {
      console.error('Failed to initiate OAuth');
      return;
    }

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_VA_CLIENT_ID,
      redirect_uri: process.env.NEXT_PUBLIC_VA_OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: 'profile openid service_history.read disability_rating.read',
      state: state,
    });

    window.location.href = `${process.env.NEXT_PUBLIC_VA_AUTHORIZATION_URL}?${params.toString()}`;
  };

  if (!isLoaded) {
    return (
      <button className={className} disabled>
        Loading...
      </button>
    );
  }

  if (!user) {
    return (
      <button className={className} disabled>
        Sign in to connect VA
      </button>
    );
  }

  return (
    <button 
      onClick={handleConnect}
      className={className}
    >
      Connect with VA.gov
    </button>
  );
};

export default VaConnectButton;
