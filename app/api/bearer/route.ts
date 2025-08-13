'use server';

import { NextResponse } from 'next/server';

// This is a dummy endpoint for the bookmarklet to target.
// In a real application, you would have a secure way to associate
// this token with a specific user session.
// For this local-first app, the bookmarklet UI just shows the token
// for the user to copy-paste, so this endpoint doesn't need to do anything.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (typeof token !== 'string' || !token.trim()) {
      return NextResponse.json({ error: 'Invalid token provided.' }, { status: 400 });
    }

    // In a real app: await saveTokenForUser(userId, token);
    console.log('Received token via /api/bearer, but it is not stored server-side.');
    
    return NextResponse.json({ message: 'Token received, please copy it from the bookmarklet panel and save it in settings.' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
