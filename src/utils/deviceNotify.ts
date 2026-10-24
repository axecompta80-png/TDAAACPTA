// Notifications système (bannière de l'appareil), en plus du centre de notifications de l'application.
// Android exige de passer par un service worker ; iPhone n'en affiche que si l'app est ajoutée à l'écran d'accueil.

export type DeviceNotificationStatus = NotificationPermission | 'unsupported';

const supported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export const deviceNotificationStatus = (): DeviceNotificationStatus =>
  supported() ? Notification.permission : 'unsupported';

export async function requestDeviceNotifications(): Promise<DeviceNotificationStatus> {
  if (!supported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

/** Enregistre le service worker et demande l'autorisation au premier geste (exigé par Safari / Firefox). */
export function initDeviceNotifications(): void {
  if (!supported()) return;
  navigator.serviceWorker.register('/sw.js').catch(e => console.warn('Service worker indisponible', e));
  if (Notification.permission === 'default') {
    window.addEventListener('pointerdown', () => { requestDeviceNotifications(); }, { once: true });
  }
}

export async function showDeviceNotification(title: string, body: string, tag: string): Promise<void> {
  if (deviceNotificationStatus() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body, tag, icon: '/logo.png', badge: '/favicon.svg',
      silent: false, // son du système en plus du carillon de l'application
      requireInteraction: true, // reste affichée jusqu'à ce que l'utilisateur la traite
    });
  } catch (e) {
    console.warn('Notification système impossible', e);
  }
}
