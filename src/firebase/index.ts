'use client';

import { firebaseConfig } from './config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

export function getSdks(firebaseApp: FirebaseApp | undefined) {
  if (!firebaseApp) {
    console.warn("Firebase config missing, using mock SDKs.");
    return {
      firebaseApp: { isMock: true } as any,
      auth: { currentUser: null, onAuthStateChanged: () => () => { }, isMock: true } as any,
      firestore: { isMock: true } as any
    };
  }
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

// IMPORTANT: DO NOT MODIFY THIS FUNCTION -> Modified to handle missing config for static export
export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed.', e);
      }
      try {
        // Check if config is valid before initializing
        if (!firebaseConfig.apiKey) {
          throw new Error("Missing API Key");
        }
        firebaseApp = initializeApp(firebaseConfig);
      } catch (err) {
        console.warn("Manual initialization failed, returning mocks.", err);
        return getSdks(undefined);
      }
    }

    return getSdks(firebaseApp);
  }

  return getSdks(getApp());
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
