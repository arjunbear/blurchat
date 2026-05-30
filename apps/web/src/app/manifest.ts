import type { MetadataRoute } from 'next';

// Web app manifest → makes Chatarooni installable (Android/Chrome "Install
// app"; iOS uses the apple-* meta + apple-icon instead). display:standalone
// drops the browser chrome. Colors match the dark default (a manifest can't
// follow the in-app light/dark toggle — that's handled live by ThemeColorSync
// for the status bar; this only affects the install splash/title).
//
// Icons reuse /logo.png (1024²). A dedicated *maskable* icon (logo on a padded
// safe-zone) would round-crop cleanly on Android — worth adding later.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chatarooni',
    short_name: 'Chatarooni',
    description:
      'Free random text chat. Meet new people and make friends from around the world.',
    start_url: '/',
    display: 'standalone',
    background_color: '#211f1c',
    theme_color: '#211f1c',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
