declare module 'next-pwa' {
  import { NextConfig } from 'next';
  export default function withPWA(config?: any): (config: NextConfig) => NextConfig;
}
