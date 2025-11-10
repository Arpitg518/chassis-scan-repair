import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a97c5b32c8f8410993d2ad8b6a63f0e6',
  appName: 'chassis-scan-repair',
  webDir: 'dist',
  server: {
    url: 'https://a97c5b32-c8f8-4109-93d2-ad8b6a63f0e6.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
