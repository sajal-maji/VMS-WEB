import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { interval, timeout } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { API_ENDPOINTS } from '../../config/api-endpoints';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit {

  model: any = {
    uniquekey: undefined,
    email: undefined,
    expiryTime: undefined,
    redirecturl: window.location.origin + '/ivmsweb/set-password',
    newpassword: undefined
  };

  securityquestion1: any;
  securityquestion2: any;
  error_message: string | undefined;
  captcha_image: any;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Future initialization logic if needed
  }

  /** Get API endpoint by name */
  getAPIEndpoint(endpointname: string): string {
    // Replace this with your actual endpoints config
    return (window as any).endpoints[endpointname];
  }

  /** Replace {serverid} placeholders in API URLs */
  getAPIUrl(apiUrl: string, serverid?: string): string {
    if (apiUrl.includes('{serverid}')) {
      apiUrl = apiUrl.replace('{serverid}', serverid || '');
    }
    return apiUrl;
  }

  /** Main forgot password method */
  forgotPassword(): void {
    // Reset password input type toggles (UI logic from jQuery replaced with plain JS)
    document.querySelectorAll('.toggle-password').forEach((el: any) => {
      const input = document.querySelector((el.getAttribute('toggle') as string)) as HTMLInputElement;
      if (input) {
        input.type = 'password';
        el.classList.remove('fa-eye-slash');
        el.classList.add('fa-eye');
      }
    });

    // Sanitize inputs

    // Validate
    this.validate();
    if (this.error_message !== "") {
      return;
    }

    // Prepare post data
    const postData = {
      uniquekey: this.model.uniquekey,
      userid: this.model.email,
      expiryTime: this.model.expiryTime,
      redirecturl: this.model.redirecturl,
      newpassword: this.model.newPassword
    };

    setTimeout(() => {
      const url = API_ENDPOINTS.FORGOT_PASSWORD;
      const payload = {
        method: 'POST',
        url: url,
        payload: JSON.stringify(postData)
      };

      this.http.post(url, JSON.stringify(postData), {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      }).subscribe({
        next: (response: any) => {
          // Success modal equivalent (replacing jQuery Confirm)
          alert('Password Reset Link Is Successfully Sent!');
          this.model.email = undefined;
          this.router.navigateByUrl('ivmsweb/login');
        },
        error: (response: any) => {
          alert(response?.error?.message || 'Something went wrong!');
        }
      });
    }, 1000);
  }


  /** Validate inputs */
  validate(): string | undefined {

    const pattern = new RegExp(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/);
    // debugger
    if (!this.model.email || this.model.email.trim() === '') {
      this.error_message = 'Email is required!';
      return;
    }

    if (this.model.email.length>0 && !pattern.test(this.model.email)) {
      this.error_message = 'Invalid Email Format!';
      return;
    }
    return this.error_message = ''
  }
}
