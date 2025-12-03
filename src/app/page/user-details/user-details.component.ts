import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { debug } from 'console';
import { TreeComponent } from '../tree/tree.component';
import { HeaderComponent } from '../header/header.component';
import { API_ENDPOINTS } from '../../config/api-endpoints';
import { CookieService } from 'ngx-cookie-service';
import { take } from 'rxjs';
import * as CryptoJS from 'crypto-es';
import { FooterComponent } from '../footer/footer.component';
import { AuthStore } from '../../auth/auth.store';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, TreeComponent, HeaderComponent, FooterComponent],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.css'],
})
export class UserDetailsComponent implements OnInit {
  userForm!: FormGroup;
  model: any = {};
  error_message: string = '';
  success_message: string = '';

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private cookies: CookieService,
    private http: HttpClient,
    private router: Router,
    private authStore: AuthStore,
  ) {}

  ngOnInit(): void {
    this.model = {
      securityQuestionSet_1: [
        { id: 1, name: 'Which town were you born in?' },
        { id: 2, name: 'Which town was your father born in?' },
        { id: 3, name: 'What is the name of the hospital in which you were born?' },
        { id: 4, name: 'What is the first name of your best childhood friend?' },
        { id: 5, name: 'What was the name of your primary school?' },
        { id: 6, name: 'Which town was your mother born in?' },
        { id: 7, name: 'What is the name of the first company / organization you worked for?' },
      ],
      securityQuestionSet_2: [
        { id: 1, name: 'What was your favourite food as a child?' },
        { id: 2, name: 'What is the title of your favourite book?' },
        { id: 3, name: 'Who is your favourite author?' },
        { id: 4, name: 'Who is your all-time favourite sports personality?' },
        { id: 5, name: 'Who is your all-time favourite movie character?' },
        { id: 6, name: 'What was your favourite childhood game?' },
        { id: 7, name: 'What was your favourite cartoon character as a child?' },
      ],
      securityquestion1: 1,
      securityquestion2: 1,
      securityanswer1: '',
      securityanswer2: '',
      isEditable: false,
    };

    this.userForm = this.fb.group({
      userid: [''],
      fullname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', Validators.pattern(/^[0-9]{10}$/)],
      securityquestion1: [this.model.securityquestion1, Validators.required],
      securityanswer1: [''],
      securityquestion2: [this.model.securityquestion2, Validators.required],
      securityanswer2: [''],
    });

    this.loadData();
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

  get f() {
    return this.userForm.controls;
  }

  toggleEdit(): void {
    this.model.isEditable = !this.model.isEditable;
  }

  sanitizeInput(value: string): string {
    return value ? this.sanitizer.sanitize(1, value) || '' : '';
  }

  validateForm(): boolean {
    if (this.userForm.invalid) {
      this.error_message = 'Please fill all required fields!';
      return false;
    }
    return true;
  }

  OnLoad(event: any) {
    console.log('Hi events', event);
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
            const user = res.result[0];
            this.userForm.patchValue(user);
            this.setSecurityQuestionAnswers(user);
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

  setSecurityQuestionAnswers(user: any): void {
    if (user.securityquestion1) {
      const q1 = this.model.securityQuestionSet_1.find(
        (q: any) => q.name === user.securityquestion1,
      );
      if (q1) this.userForm.patchValue({ securityquestion1: q1.id });
    }

    if (user.securityquestion2) {
      const q2 = this.model.securityQuestionSet_2.find(
        (q: any) => q.name === user.securityquestion2,
      );
      if (q2) this.userForm.patchValue({ securityquestion2: q2.id });
    }

    if (user.securityanswer1) {
      // console.log(user.securityanswer1);
      this.userForm.patchValue({ securityanswer1: '**********' });
    }
    if (user.securityanswer2) {
      // console.log(user.securityanswer2);
      this.userForm.patchValue({ securityanswer2: '**********' });
    }
  }

  save(): void {
    this.error_message = '';
    // debugger
    if (!this.userForm.valid) {
      return;
    }

    const user = this.userForm.value;
    console.log('user', user);

    // Sanitize inputs
    Object.keys(user).forEach((key) => {
      user[key] = this.sanitizeInput(user[key]);
    });

    // Map security questions
    user.securityquestion1 = this.model.securityQuestionSet_1.find(
      (q: any) => q.id === Number(user.securityquestion1),
    )?.name;
    user.securityquestion2 = this.model.securityQuestionSet_2.find(
      (q: any) => q.id === Number(user.securityquestion2),
    )?.name;

    console.log(user.securityquestion1, user.securityquestion2);

    // Hash security answers if not masked
    if (user.securityanswer1 !== '**********') {
      user.securityanswer1 = CryptoJS.SHA512(user.securityanswer1).toString();
    }
    if (user.securityanswer2 !== '**********') {
      user.securityanswer2 = CryptoJS.SHA512(user.securityanswer2).toString();
    }

    const url = API_ENDPOINTS.UPDATE_USER;
    this.http
      .post<any>(url, user, {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          Cookies: `JSESSIONID=${this.cookies.get('vSessionId')}`,
          Authorization: `Bearer ${this.cookies.get('authToken')}`,
        }),
      })
      .subscribe({
        next: () => {
          this.success_message = 'User Details Successfully Updated!';
          setTimeout(() => {
            this.success_message = '';
            location.reload();
            // this.router.navigate(['ivmsweb/login']);
          }, 1000);
        },
        error: (err) => {
          if (err.status === 401) {
            this.router.navigate(['ivmsweb/login']);
          } else {
            this.error_message = err.error?.message || 'An error occurred!';
            this.success_message = '';

            // Auto-clear error message after a few seconds (optional)
            setTimeout(() => {
              this.error_message = '';
            }, 1000);
          }
        },
      });
  }

  // getAPIUrl(endpoint: string): string {
  //   // Replace with your actual base URL builder logic
  //   return `/api/${endpoint}`;
  // }
}
