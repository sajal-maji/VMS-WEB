import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthStore } from '../../auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'] // keep your CSS
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  rememberMe = false;
  showPassword = false;
  errorMessage = '';
  submitted = false;

  siteList: any[] = [];
  site: string | null = null;

  constructor(private fb: FormBuilder, private sanitizer: DomSanitizer, private authStore: AuthStore) {}

  ngOnInit(): void {
    // Initialize form
    this.loginForm = this.fb.group({
      userid: ['', Validators.required],
      password: [
        '',
        [
          Validators.required,
          // 8-12 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,15}$/)
        ]
      ]
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
    if (successtoInput) successtoInput.value = '/ivmsweb/live_matrix' + hash;
    if (failtoInput) failtoInput.value = '/ivmsweb' + hash;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
    const input = document.getElementById('password-field') as HTMLInputElement;
    if (input) input.type = this.showPassword ? 'text' : 'password';
  }

  login(): void {
    this.submitted = true;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'Please correct the highlighted errors.';
      return;
    }

    // Reset password field icon
    const toggleElements = document.querySelectorAll('.toggle-password');
    toggleElements.forEach(el => {
      el.classList.remove('fa-eye-slash');
      el.classList.add('fa-eye');
      const input = document.querySelector<HTMLInputElement>((el as HTMLElement).getAttribute('toggle')!);
      if (input) input.type = 'password';
    });

    // Sanitize and encrypt
    let userid = this.sanitizer.sanitize(1, this.loginForm.value.userid) || '';
    let password = this.sanitizer.sanitize(1, this.loginForm.value.password) || '';

    // if (password.trim()) {
    //   let firstEncrypt = SHA512(password).toString();
    //   firstEncrypt = SHA512(firstEncrypt).toString();
    //   password = firstEncrypt;
    // }

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
    this.errorMessage = '';
    this.submitted = false;
  }
}
