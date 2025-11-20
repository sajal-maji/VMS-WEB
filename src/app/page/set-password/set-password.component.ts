import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import * as CryptoJS from 'crypto-es';
import { FooterComponent } from "../footer/footer.component";
import { CookieService } from 'ngx-cookie-service';

export const confirmPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmNewPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
};

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FooterComponent],
  templateUrl: './set-password.component.html',
  styleUrls: ['./set-password.component.css']
})
export class SetPasswordComponent implements OnInit {

  // Flags for UI
  isCheckingKey: boolean = true;
  isKeyValid: boolean = false;
  submitted:boolean = false;
  showNew:boolean = false;
  showConfirm:boolean = false;

  error_message: string = '';
  success_message: string = '';

  // Reactive form
  setPasswordForm!: FormGroup;

  // Unique key from URL
  uniqueKey: string | null = null;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private cookieService:CookieService,
  ) {}

  model = {};

  ngOnInit(): void {
    // Get unique key from query parameter
    this.uniqueKey = this.route.snapshot.queryParamMap.get('uk');
    console.log("unique", this.uniqueKey);

    this.setPasswordForm = this.fb.group({
      userid: ['',],
      newpassword: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,15}$/)
        ]
      ],
      confirmPassword: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\[\]{}\-_=+~`|:;"'<>.,?\/]).{8,15}$/)
        ]
      ]
    });

    this.model = {
      newPassword: '',
      confirmnewPassword: '',
      redirecturl: location.origin + '/ivmsweb/set-password',
      userid: '',
      expiryTime: '',
      uniquekey: '',
      email: ''
    }
    // this.model.uniquekey = this.uniqueKey || undefined;

    // Validate the key
    if (this.uniqueKey) {
      this.checkValidKey(this.uniqueKey);
    // } else {
    //   this.router.navigate(['ivmsweb/not-found']);
    }
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

  // Validate unique key via API
  // checkValidKey(uniqueKey: string): void {
  //   this.passwordService.validateKey(uniqueKey).subscribe({
  //     next: (response) => {
  //       this.isCheckingKey = false;
  //       if (response.status === 200 && response.data?.result?.length > 0) {
  //         this.isKeyValid = true;
  //         this.model.userid = response.data.result[0].userid;
  //       } else {
  //         this.router.navigate(['/not_found']);
  //       }
  //     },
  //     error: () => {
  //       this.isCheckingKey = false;
  //       this.router.navigate(['/not_found']);
  //     }
  //   });
  // }

  checkValidKey(uniqueKey: string): void {
    this.isCheckingKey = true;

    // Replace {uk} with the actual uniqueKey value
    const url = API_ENDPOINTS.VALIDATE_KEY.replace('{uniquekey}', uniqueKey);

    this.http.get(url, {
      headers: new HttpHeaders({ 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.cookieService.get('authToken')}`
      })
    }).subscribe({
      next: (response: any) => {
        this.isCheckingKey = false;

        if (response.status === 200 && response.result?.length > 0) {
          this.isKeyValid = true;
          const setPassword = response.result[0];
          this.setPasswordForm.patchValue(setPassword);
          // this.model.userid = response.result[0].userid;
        } else {
          this.router.navigateByUrl('/ivmsweb/not-found');
        }
      },
      error: () => {
        this.isCheckingKey = false;
        this.router.navigateByUrl('/ivmsweb/not-found');
      }
    });
  }
  
  get f() {
    return this.setPasswordForm.controls;
  }

  // Submit password
  save(): void {
    this.submitted = true;

    if (!this.setPasswordForm.valid) {
      return;
    }

    const setPassword = this.setPasswordForm.value;

    Object.keys(setPassword).forEach(key => {
      setPassword[key] = this.sanitizeInput(setPassword[key]);
    });

    // this.validate();

    if (this.error_message) return;

    let firstEncryptCurrPass = CryptoJS.SHA512(setPassword.newpassword).toString();
    firstEncryptCurrPass = CryptoJS.SHA512(firstEncryptCurrPass).toString();
    setPassword.newpassword = firstEncryptCurrPass;
    setPassword.confirmPassword = firstEncryptCurrPass;

    const postData = {
      userid: setPassword.userid,
      newpassword: setPassword.newpassword,
      confirmnewpassword: setPassword.confirmPassword,
      redirecturl:setPassword.redirecturl,
      uniquekey: setPassword.uniquekey
    };

    const url = API_ENDPOINTS.RESET_PASSWORD;

    this.http.post<any>(url, postData, {
      headers: new HttpHeaders({ 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.cookieService.get('authToken')}`
      }),
    }).subscribe({
      next: (response: any) => {
        console.log("response", response);
        
        // Success modal equivalent (replacing jQuery Confirm)
        this.success_message = 'Password is Reset now!';
        setTimeout(() => {
          this.success_message = '';
          this.router.navigateByUrl('ivmsweb/login');
        }, 2000);
      },
      error: (response: any) => {
        this.error_message = response?.error?.message || 'Something went wrong!';
        this.success_message = '';

        // Auto-clear error message after a few seconds (optional)
        setTimeout(() => {
          this.error_message = '';
          location.reload();
        }, 3000);
      }
    })
  }
}
