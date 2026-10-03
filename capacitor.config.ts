import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salaai.app',
  appName: 'Sala AI',
  webDir: 'dist',
  server: {
    url: 'https://ais-dev-h55mv4dnhb3wfi5gazr272-913251346174.asia-southeast1.run.app',
    androidScheme: 'https',
    allowNavigation: [
      'ais-dev-h55mv4dnhb3wfi5gazr272-913251346174.asia-southeast1.run.app',
      'aistudio.google.com'
    ]
  }
};

export default config;
