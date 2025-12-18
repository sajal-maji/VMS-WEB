import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { CookieService } from 'ngx-cookie-service';
import { runInInjectionContext } from '@angular/core';

// ================================================
// CLEAR EVERYTHING (CACHE + STORAGE + COOKIES)
// ================================================
async function clearAllClientStorage() {
  // Clear Cache
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      console.log('Cache Storage cleared');
    } catch (err) {
      console.warn('Cache clearing failed:', err);
    }
  }

  // Clear Local + Session Storage
  try {
    localStorage.clear();
    sessionStorage.clear();
    console.log('Local/Session storage cleared');
  } catch (err) {
    console.warn('Storage clearing failed:', err);
  }

  // =========================================================
  // DELETE COOKIES EXACTLY AS THEY EXIST
  // =========================================================
  try {
    const domain = window.location.hostname;

    // 1️⃣ DELETE vSessionId cookie (public domain cookie)
    document.cookie = `vSessionId=; Max-Age=0; path=/; domain=${domain}`;

    // 2️⃣ DELETE fallback host-only cookie (in case frontend created one)
    document.cookie = `vSessionId=; Max-Age=0; path=/`;

    // 3️⃣ DELETE JSESSIONID if any exists
    document.cookie = `JSESSIONID=; Max-Age=0; path=/; domain=${domain}`;
    document.cookie = `JSESSIONID=; Max-Age=0; path=/`;

    console.log('Cookies cleared');
  } catch (err) {
    console.warn('Cookie clearing failed:', err);
  }
}

// ================================================
// LOGOUT PROCESS (CALL BACKEND + CLEAR LOCAL DATA)
// ================================================
function logout(cookieService: CookieService) {
  // 1️⃣ Delete JWT cookie immediately
  // cookieService.delete('authToken', '/');

  const vSessionId = cookieService.get('vSessionId');
  const authToken = cookieService.get('authToken'); // will be null now, but backend sees session via vSessionId

  const host = window.location.hostname;

  // Overwrite JSESSIONID so backend can read correct session for logout
  document.cookie = `JSESSIONID=${vSessionId}; path=/; domain=${host}`;
  document.cookie = `JSESSIONID=${vSessionId}; path=/`;

  // Backend logout
  fetch(`${environment.apiBaseUrl}user/session/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookies: `JSESSIONID=${vSessionId}`,
      Authorization: `Bearer ${authToken}`,
    },
    credentials: 'include',
    body: '',
    keepalive: true,
  }).catch(() => {});

  // Clear all client storage
  clearAllClientStorage();
}

// ================================================
// BOOTSTRAP + TAB CLOSE/REFRESH EVENT
// ================================================
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

    // Tab hidden
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') runLogout();
    });

    // Tab closing / refreshing
    window.addEventListener('beforeunload', () => {
      runLogout();
    });
  })
  .catch((err) => console.error(err));
