import { CommonModule } from '@angular/common';
import { Component, effect, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthStore } from '../../auth/auth.store';
import * as CryptoJS from 'crypto-es';
import { FooterComponent } from '../footer/footer.component';
import { Router, RouterLink } from '@angular/router';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FooterComponent, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'], // keep your CSS
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  rememberMe = false;
  showPassword = false;
  errorMessage = '';
  submitted = false;

  siteList: any[] = [];
  site: string | null = null;

  SESSION_TIMEOUT = 1 * 60 * 1000; // 15 minutes
  sessionTimer: any; // to hold timeout reference

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private authStore: AuthStore,
    private router: Router,
  ) {
    effect(() => {
      const err = this.authStore.error() ?? '';
      this.errorMessage = err;

      if (err) {
        // Clear after 5 seconds
        setTimeout(() => {
          this.errorMessage = '';
        }, 1000);
      }
    });
  }

  ngOnInit(): void {
    // Initialize form
    this.loginForm = this.fb.group({
      userid: ['', Validators.required],
      password: [
        '',
        [
          Validators.required,
          // 8-12 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,15}$/,
          ),
        ],
      ],
    });

    // Load saved username if "Remember Me" was checked
    const savedUsername = localStorage.getItem('username');
    const savedCheckbox = localStorage.getItem('checkbox');
    if (savedCheckbox === 'true' && savedUsername) {
      this.loginForm.patchValue({ userid: savedUsername });
      this.rememberMe = true;
    }

    // Set hidden form fields (success/fail URLs)
    const hash = window.location.hash;
    const successtoInput = document.querySelector<HTMLInputElement>('input[name="successto"]');
    const failtoInput = document.querySelector<HTMLInputElement>('input[name="failto"]');
    if (successtoInput) successtoInput.value = '/ivmsweb/live-matrix' + hash;
    if (failtoInput) failtoInput.value = '/ivmsweb' + hash;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
    const input = document.getElementById('password-field') as HTMLInputElement;
    if (input) input.type = this.showPassword ? 'text' : 'password';
  }

  login(): void {
    this.submitted = true;

    // Reset previous error
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();

      // Check specific errors
      const passwordErrors = this.loginForm.controls['password'].errors;
      const userErrors = this.loginForm.controls['userid'].errors;

      if (userErrors?.['required']) {
        this.errorMessage = 'Username is required.';
      } else if (passwordErrors) {
        if (passwordErrors['required']) {
          this.errorMessage = 'Password is required.';
        } else if (passwordErrors['pattern']) {
          this.errorMessage =
            'Password must be 8-12 chars with 1 uppercase, 1 lowercase, 1 number, and 1 special character.';
        }
      } else {
        this.errorMessage = 'Please correct the highlighted errors.';
      }

      return; // stop login if form invalid
    }

    // Reset password field icon
    const toggleElements = document.querySelectorAll('.toggle-password');
    toggleElements.forEach((el) => {
      el.classList.remove('fa-eye-slash');
      el.classList.add('fa-eye');
      const input = document.querySelector<HTMLInputElement>(
        (el as HTMLElement).getAttribute('toggle')!,
      );
      if (input) input.type = 'password';
    });

    // Sanitize and encrypt
    let userid = this.sanitizer.sanitize(1, this.loginForm.value.userid) || '';
    let password = this.sanitizer.sanitize(1, this.loginForm.value.password) || '';
    if (password.trim()) {
      let firstEncrypt = CryptoJS.SHA512(password).toString();
      firstEncrypt = CryptoJS.SHA512(firstEncrypt).toString();
      password = firstEncrypt;
    }

    // Remember Me
    if (this.rememberMe) {
      localStorage.setItem('username', userid);
      localStorage.setItem('checkbox', 'true');
    } else {
      localStorage.removeItem('username');
      localStorage.setItem('checkbox', 'false');
    }

    // Call API via store
    this.authStore.login({ userid, password });
    this.errorMessage = ''; // reset API error, store effect handles API errors

    this.submitted = false;

    if (this.authStore.isAuthenticated()) {
      this.resetSessionTimer();
    }
  }

  private resetSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }

    this.sessionTimer = setTimeout(() => {
      this.handleSessionTimeout();
    }, this.SESSION_TIMEOUT);
  }

  private handleSessionTimeout(): void {
    this.authStore.logout();
    alert('Your session has expired. Please login again.');
    // Optional: redirect to login
  }

  forgotPassword(): void {
    this.router.navigate(['/ivmsweb/forgot-password']);
  }
}
