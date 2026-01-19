import { Component, OnInit } from '@angular/core';
import { HeaderComponent } from '../header/header.component';
import { TreeComponent } from '../tree/tree.component';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthStore } from '../../auth/auth.store';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CookieService } from 'ngx-cookie-service';
import { Router } from '@angular/router';
import { take } from 'rxjs';

@Component({
  selector: 'app-change-password',
  imports: [HeaderComponent, FormsModule, CommonModule, TreeComponent, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent implements OnInit {
  OnLoad(event: any) {
    console.log('event', event);
  }

  model: any = {};

  showCurrent: boolean = false;
  showNew: boolean = false;
  showConfirm: boolean = false;

  isLoading: boolean = false;
  submitted: boolean = false;
  error_message: string = '';
  success_message: string = '';

  changePassForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private authStore: AuthStore,
    private http: HttpClient,
    private cookies: CookieService,
    private router: Router,
  ) {}
  ngOnInit(): void {
    this.changePassForm = this.fb.group({
      userid: [''],
      password: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,64}$/,
          ),
        ],
      ],
      newpassword: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,64}$/,
          ),
        ],
      ],
      confirmPassword: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,64}$/,
          ),
        ],
      ],
    });

    this.model = {
      password: '',
      newpassword: '',
      confirmPassword: '',
    };

    this.loadData();
  }

  get f() {
    return this.changePassForm.controls;
  }

  private showInvalidSession(): void {
    const confirmed = confirm('Invalid Session! Please Login.');
    if (confirmed) {
      // Clear cookies and local/session storage (optional for security)
      this.cookies.deleteAll('/', window.location.hostname);
      sessionStorage.clear();
      localStorage.clear();
      this.authStore.logout();

      // ✅ Redirect to login page
      this.router.navigateByUrl('ivmsweb/login');
    }
  }

  loadData(): void {
    const url = API_ENDPOINTS.USER_SESSION;
    this.http
      .get<any>(url, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          console.log(res.result);
          if (res?.result?.length > 0) {
            const changePassword = res.result[0];
            this.changePassForm.patchValue(changePassword);
            // this.setSecurityQuestionAnswers(user);
          }
        },
        error: (err) => {
          if (err.status === 401) {
            this.showInvalidSession();
            // this.router.navigate(['ivmsweb/login']);
          } else {
            this.error_message = err.error?.message || 'Error loading user data!';
          }
        },
      });
  }

  togglePassword(): void {
    this.showCurrent = !this.showCurrent;
    const input = document.getElementById('current-password-field') as HTMLInputElement;
    if (input) input.type = this.showCurrent ? 'text' : 'password';
  }

  toggleNewPassword(): void {
    this.showNew = !this.showNew;
    const input = document.getElementById('new-password-field') as HTMLInputElement;
    if (input) input.type = this.showNew ? 'text' : 'password';
  }

  toggleConfirmNewPassword(): void {
    this.showConfirm = !this.showConfirm;
    const input = document.getElementById('confirm-new-password-field') as HTMLInputElement;
    if (input) input.type = this.showConfirm ? 'text' : 'password';
  }

  sanitizeInput(value: string): string {
    return value ? this.sanitizer.sanitize(1, value) || '' : '';
  }

  async save() {
    this.isLoading = true;
    this.submitted = true;

    if (!this.changePassForm.valid) {
      return;
    }

    const changePassword = this.changePassForm.value;
    // console.log("change Pass", changePassword)

    Object.keys(changePassword).forEach((key) => {
      changePassword[key] = this.sanitizeInput(changePassword[key]);
    });

    if (changePassword.newpassword !== changePassword.confirmPassword) {
      this.error_message = 'New Password and Confirm New Password must be same.';
      return; // STOP HERE!
    }

    // 🔐 Web Crypto API hashing helper
    const sha512 = async (value: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const hashBuffer = await crypto.subtle.digest('SHA-512', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    };

    // Hash current password
    let firstEncryptCurrPass = await sha512(changePassword.password);
    firstEncryptCurrPass = await sha512(firstEncryptCurrPass);
    changePassword.password = firstEncryptCurrPass;

    // Hash new password
    const firstEncryptNewPass = await sha512(changePassword.newpassword);
    changePassword.newpassword = firstEncryptNewPass;

    changePassword.confirmPassword = firstEncryptNewPass;

    // console.log("change Pass", changePassword);

    const postData = {
      userid: changePassword.userid,
      password: changePassword.password,
      newpassword: changePassword.newpassword,
    };

    console.log('change Pass', postData);

    setTimeout(() => {
      const url = API_ENDPOINTS.CHANGE_PASSWORD;
      this.http
        .post<any>(url, postData, {
          headers: new HttpHeaders({
            'Content-Type': 'application/json',
            Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
            Authorization: `Bearer ${this.cookies.get('authToken')}`,
          }),
        })
        .subscribe({
          next: (response) => {
            console.log('response', response);
            this.success_message = 'Password Changed successfully';
            alert(this.success_message);
            setTimeout(() => {
              // this.success_message = '';
              this.authStore.logout();
              this.router.navigateByUrl('ivmsweb/login');
            }, 1000);
            this.isLoading = false;
          },
          error: (response) => {
            this.error_message = response?.error?.message || 'Something went wrong!';
            this.success_message = '';
            alert(this.error_message);
            // Auto-clear error message after a few seconds (optional)
            setTimeout(() => {
              this.error_message = '';
              this.reset();
            }, 1000);
          },
        });
      // console.log('Saved:', this.model);
      this.isLoading = false;
    }, 1000);
  }

  reset() {
    this.changePassForm.reset({
      password: '',
      newpassword: '',
      confirmPassword: '',
    });

    this.changePassForm.markAsPristine();
    this.changePassForm.markAsUntouched();

    this.submitted = false;
  }
}
