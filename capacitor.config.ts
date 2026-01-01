import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.idiampro.app',
  appName: 'IdiamPro',
  webDir: 'out',
  server: {
    // In production, load from deployed web app
    url: process.env.NODE_ENV === 'development'
      ? 'http://localhost:9002'
      : 'https://idiam-pro.vercel.app',
    cleartext: process.env.NODE_ENV === 'development'
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true
  }
};

export default config;
