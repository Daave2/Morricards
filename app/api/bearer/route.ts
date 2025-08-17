
'use server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'

// This endpoint is targeted by the companion bookmarklet.
// It receives a bearer token and temporarily stores it in an HttpOnly cookie.
// The settings page can then read this cookie and prompt the user to save it.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (typeof token !== 'string' || !token.trim()) {
      return NextResponse.json({ error: 'Invalid token provided.' }, { status: 400 });
    }

    // Set the token in a secure, HttpOnly cookie that expires in 1 hour.
    // This makes the token available to the server-side components of the app
    // without exposing it to client-side script.
    cookies().set('new-bearer-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600, // 1 hour
      path: '/',
    });
    
    return NextResponse.json({ message: 'Token received and will be available on the settings page.' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
