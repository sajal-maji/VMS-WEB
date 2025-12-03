function deleteCookie(name: string): void {
  const domains = [window.location.hostname, '.' + window.location.hostname];
  const paths = ['/', '/app', '/ivmsweb/login'];

  for (const domain of domains) {
    for (const path of paths) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain};`;
    }
  }
}

window.addEventListener('beforeunload', () => {
  if (!sessionStorage.getItem('reloading')) {
    const payload = JSON.stringify({ intent: "LOGOUT", source: "TAB_CLOSE" });

    navigator.sendBeacon(
      `${environment.apiBaseUrl}user/session/close`,
      new Blob([payload], { type: 'application/json' })
    );

    deleteCookie('JSESSIONID');
    deleteCookie('vSessionId');
    deleteCookie('authToken');
  }
});
// window.addEventListener('visibilitychange', () => {
//   const isReload = sessionStorage.getItem('reloading');

//   if (document.visibilityState === 'hidden' && !isReload) {

//     const payload = JSON.stringify({
//       intent: "LOGOUT",
//       source: "TAB_CLOSE"
//     });

//     navigator.sendBeacon(
//       `${environment.apiBaseUrl}user/session/close`,
//       new Blob([payload], { type: 'application/json' })
//     );

//     deleteCookie('JSESSIONID');
//     deleteCookie('vSessionId');
//     deleteCookie('authToken');
//   }
// });



import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideHttpClient()],
}).catch((err) => console.error(err));
