import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { API_ENDPOINTS } from '../../config/api-endpoints';
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
  imports: [ReactiveFormsModule, CommonModule ],
  templateUrl: './set-password.component.html',
  styleUrls: ['./set-password.component.css']
})
export class SetPasswordComponent implements OnInit {

  // Flags for UI
  isCheckingKey: boolean = true;
  isKeyValid: boolean = false;

  // Error message
  error_message: string | undefined;

  // Reactive form
  setPasswordForm: FormGroup;

  // Unique key from URL
  uniqueKey: string | null = null;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Initialize reactive form
    this.setPasswordForm = this.fb.group({
    newPassword: ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&+*!=]).{8,12}$/)
    ]],
    confirmNewPassword: ['', Validators.required]
  }, { validators: confirmPasswordValidator });
  }

  model = {
    newPassword: undefined as string | undefined,
    confirmnewPassword: undefined as string | undefined,
    redirecturl: location.origin + '/ivmsweb/set-password',
    userid: undefined as string | undefined,
    expiryTime: undefined as string | undefined,
    uniquekey: undefined as string | undefined,
    email: undefined as string | undefined
  };

  ngOnInit(): void {
    // Get unique key from query parameter
    this.uniqueKey = this.route.snapshot.queryParamMap.get('uk');
    console.log("unique", this.uniqueKey);
    // this.model.uniquekey = this.uniqueKey || undefined;

    // Validate the key
    if (this.uniqueKey) {
      this.checkValidKey(this.uniqueKey);
    } else {
      this.router.navigate(['/not_found']);
    }
  }

  // Toggle password visibility
  togglePasswordField(fieldId: string): void {
    const input = document.getElementById(fieldId) as HTMLInputElement;
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
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
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).subscribe({
      next: (response: any) => {
        this.isCheckingKey = false;

        if (response.status === 200 && response.data?.result?.length > 0) {
          this.isKeyValid = true;
          this.model.userid = response.result[0].userid;
        } else {
          this.router.navigateByUrl('/ivmsweb/not_found');
        }
      },
      error: () => {
        this.isCheckingKey = false;
        this.router.navigateByUrl('/ivmsweb/not_found');
      }
    });
  }
  
  get formControls() {
    return this.setPasswordForm.controls;
  }
  // Validate password rules
  validate(): void {
    debugger
    this.error_message = undefined;
    const pattern = /^(?=.{8,16})(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+*!=]).*$/;

    if (!this.formControls["newPassword"].value?.trim()) {
      this.error_message = 'New Password is required!';
      return;
    }

    if (!this.formControls["confirmNewPassword"].value?.trim()) {
      this.error_message = 'Confirm New Password is required!';
      return;
    }

    if (this.formControls["newPassword"].value.length > 16) {
      this.error_message = 'New Password cannot have more than 16 characters!';
      return;
    }

    if (!pattern.test(this.formControls["newPassword"].value)) {
      this.error_message = 'Min 8 character & Max 16 character. New Password must contain at least one small & one capital alphabet, one numeric digit, and one special character.';
      return;
    }

    if (this.formControls["newPassword"].value !== this.formControls["confirmNewPassword"].value) {
      this.error_message = 'Password Mismatch!';
      return;
    }
  }

  // Submit password
  save(): void {
    // Reset password fields type
    ['new-password-field', 'confirm-new-password-field'].forEach(id => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) input.type = 'password';
    });

    this.validate();

    if (this.error_message) return;

    // Encrypt password
    if (this.formControls['newPassword'].value.trim()) {
      // const firstEncrypt = CryptoJS.SHA512(this.formControlsnewPassword).toString();
      // this.formControlsnewPassword = firstEncrypt;
      // this.formControlsconfirmNewPassword = firstEncrypt;
    }

    const postData = {
      newpassword: this.formControls['newPassword'].value,
      confirmnewpassword: this.formControls['confirmNewPassword'].value,
      // userid: this.formControlsuserid,
      // redirecturl: this.formControlsredirecturl,
      // uniquekey: this.formControlsuniquekey
    };

    // this.passwordService.resetPassword(postData).subscribe({
    //   next: () => {
    //     alert('Password Successfully Updated!');
    //     this.model.newPassword = '';
    //     this.model.confirmNewPassword = '';
    //     this.router.navigate(['/']);
    //   },
    //   error: (response) => {
    //     this.model.newPassword = '';
    //     this.model.confirmNewPassword = '';
    //     alert('Error: ' + response.error.message);
    //   }
    // });
  }
}
