import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase, isSupabaseConfigured } from './supabase';

export interface AuthUser {
  id: string;
  email?: string;
  fullName?: string;
}

/**
 * Sign in with Apple and authenticate with Supabase.
 * Returns the authenticated user or throws an error.
 */
export async function signInWithApple(): Promise<AuthUser> {
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud sync is not configured. Please set up Supabase credentials.');
  }

  // Generate a random nonce for security
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  // Request Apple Sign-In
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('No identity token received from Apple.');
  }

  // Authenticate with Supabase using the Apple ID token
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) {
    throw new Error(`Supabase auth error: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('No user returned from Supabase auth.');
  }

  // Build display name from Apple credential (only provided on first sign-in)
  const fullName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ')
    : undefined;

  return {
    id: data.user.id,
    email: data.user.email ?? credential.email ?? undefined,
    fullName: fullName || undefined,
  };
}

/**
 * Get the currently authenticated user, or null if not signed in.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? undefined,
    fullName: user.user_metadata?.full_name ?? undefined,
  };
}

/**
 * Sign out from Supabase.
 */
export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.signOut();
}

/**
 * Check if Apple Sign-In is available on this device.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}
