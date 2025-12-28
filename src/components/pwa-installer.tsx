'use client';

import { useEffect, useState } from 'react';
import { PWAUpdateNotification } from './pwa-update-notification';

export function PWAInstaller() {
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered:', registration.scope);

            // Check for updates every 60 seconds
            setInterval(() => {
              registration.update();
            }, 60000);

            // Detect when a new service worker is waiting
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker is ready to activate
                    setWaitingWorker(newWorker);
                    setShowUpdateNotification(true);
                  }
                });
              }
            });

            // Check if there's already a waiting service worker
            if (registration.waiting) {
              setWaitingWorker(registration.waiting);
              setShowUpdateNotification(true);
            }
          })
          .catch((error) => {
            console.log('Service Worker registration failed:', error);
          });
      });

      // Listen for messages from the service worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page when the new service worker takes control
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Tell the waiting service worker to skip waiting and become active
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleDismiss = () => {
    setShowUpdateNotification(false);
  };

  return (
    <>
      {showUpdateNotification && (
        <PWAUpdateNotification onUpdate={handleUpdate} onDismiss={handleDismiss} />
      )}
    </>
  );
}
