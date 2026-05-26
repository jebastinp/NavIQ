import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Preload Leaflet
    import('leaflet').catch(() => {});

    // Warm up tile CDN
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://basemaps.cartocdn.com';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }, []);

  return (
    <>
      <Head>
        <title>NavIQ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1.0" />
        <meta name="description" content="AI route optimization for delivery operations" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#F0F4FA" />
        <link rel="icon" href="/favicon.svg" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
