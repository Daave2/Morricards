'use client';

import { useCustomTheme } from '@/hooks/useCustomTheme';
import React from 'react';

export default function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  useCustomTheme();
  return <>{children}</>;
}
