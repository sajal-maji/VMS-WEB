import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { runInInjectionContext } from '@angular/core';

// =====================================================
// UNIVERSAL CLEAR FUNCTION — CACHE + STORAGE + COOKIES
// =====================================================
async function clearAllClientStorage() {
  // 1) Clear Cache Storage (PWAs, API cache, assets cache)
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      console.log('Cache Storage cleared');
    } catch (err) {
      console.warn('Cache clearing failed:', err);
    }
  }

  // 2) Clear local/session storage
  try {
    localStorage.clear();
    sessionStorage.clear();
    console.log('Local/session storage cleared');
  } catch (err) {
    console.warn('Storage clearing failed:', err);
  }

  // 3) Clear ALL cookies
  try {
    const cookies = document.cookie.split(';');

    const paths = ['/', '/ivmsweb', '/ivmsweb/login'];
    const domains = [window.location.hostname, '.' + window.location.hostname];

    cookies.forEach((cookie) => {
      const eq = cookie.indexOf('=');
      const name = eq > -1 ? cookie.substring(0, eq).trim() : cookie.trim();

      domains.forEach((domain) => {
        paths.forEach((path) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain};`;
        });
      });
    });

    console.log('All cookies cleared');
  } catch (err) {
    console.warn('Cookie clearing failed:', err);
  }
}

// =====================================================
// LOGOUT (SERVER LOGOUT + FULL CLEAR ON CLIENT)
// =====================================================
function logout(cookieService: CookieService) {
  const vSessionId = cookieService.get('vSessionId');

  // Server logout API
  fetch(`${environment.apiBaseUrl}user/session/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookies: `JSESSIONID=${vSessionId}`,
    },
    body: '',
    credentials: 'include',
    keepalive: true,
  }).catch(() => {});

  // Replace old individual cookie deletion with ONE function
  clearAllClientStorage();
}

// =====================================================
// BOOTSTRAP & EVENT HANDLERS
// =====================================================
bootstrapApplication(App, {
  providers: [provideRouter(routes), provideHttpClient(), CookieService],
})
  .then((appRef) => {
    const runLogout = () => {
      runInInjectionContext(appRef.injector, () => {
        const cookieService = appRef.injector.get(CookieService);
        logout(cookieService);
      });
    };

    // When tab becomes hidden
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') runLogout();
    });

    // When tab is closing or refreshing
    window.addEventListener('beforeunload', () => {
      runLogout();
    });
  })
  .catch((err) => console.error(err));
