import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { debug } from 'console';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.css']
})
export class UserDetailsComponent implements OnInit {

  userForm!: FormGroup;
  model: any = {};
  errorMessage?: string;

  constructor(
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private router: Router
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
        { id: 7, name: 'What is the name of the first company / organization you worked for?' }
      ],
      securityQuestionSet_2: [
        { id: 1, name: 'What was your favourite food as a child?' },
        { id: 2, name: 'What is the title of your favourite book?' },
        { id: 3, name: 'Who is your favourite author?' },
        { id: 4, name: 'Who is your all-time favourite sports personality?' },
        { id: 5, name: 'Who is your all-time favourite movie character?' },
        { id: 6, name: 'What was your favourite childhood game?' },
        { id: 7, name: 'What was your favourite cartoon character as a child?' }
      ],
      securityquestion1: 1,
      securityquestion2: 1,
      securityanswer1: '',
      securityanswer2: '',
      isEditable: false
    };

    this.userForm = this.fb.group({
      fullname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', Validators.required,Validators.pattern(/^[0-9]{10}$/)],
      securityquestion1: [this.model.securityquestion1, Validators.required],
      securityanswer1: ['',],
      securityquestion2: [this.model.securityquestion2, Validators.required],
      securityanswer2: ['', ]
    });

    this.loadData();
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
    // if (this.userForm.invalid) {
    //   this.errorMessage = 'Please fill all required fields!';
    //   return false;
    // }
    return true;
  }

  save(): void {
    this.errorMessage = undefined;
    debugger
    if (!this.userForm.valid) {
      return;
    }

    const user = this.userForm.value;

    // Sanitize inputs
    Object.keys(user).forEach(key => {
      user[key] = this.sanitizeInput(user[key]);
    });

    // Map security questions
    user.securityquestion1 = this.model.securityQuestionSet_1.find(
      (q: any) => q.id === user.securityquestion1
    )?.name;
    user.securityquestion2 = this.model.securityQuestionSet_2.find(
      (q: any) => q.id === user.securityquestion2
    )?.name;

    // Hash security answers if not masked
    // if (user.securityanswer1 !== '**********') {
    //   user.securityanswer1 = CryptoJS.SHA512(user.securityanswer1).toString();
    // }
    // if (user.securityanswer2 !== '**********') {
    //   user.securityanswer2 = CryptoJS.SHA512(user.securityanswer2).toString();
    // }

    this.http.post('proxy', {
      method: 'POST',
      url: this.getAPIUrl('updateUser'),
      payload: JSON.stringify(user)
    }).subscribe({
      next: () => {
        alert('User Details Successfully Updated!');
        location.reload();
      },
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['ivmsweb/login']);
        } else {
          alert(err.error?.message || 'An error occurred!');
        }
      }
    });
  }

  loadData(): void {
    this.http.post('proxy', {
      method: 'GET',
      url: this.getAPIUrl('getUserbySession')
    }).subscribe({
      next: (res: any) => {
        if (res?.result?.length > 0) {
          const user = res.result[0];
          this.userForm.patchValue(user);
          this.setSecurityQuestionAnswers(user);
        }
      },
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['ivmsweb/login']);
        } else {
          alert(err.error?.message || 'Error loading user data!');
        }
      }
    });
  }

  setSecurityQuestionAnswers(user: any): void {
    if (user.securityquestion1) {
      const q1 = this.model.securityQuestionSet_1.find(
        (q: any) => q.name === user.securityquestion1
      );
      if (q1) this.userForm.patchValue({ securityquestion1: q1.id });
    }

    if (user.securityquestion2) {
      const q2 = this.model.securityQuestionSet_2.find(
        (q: any) => q.name === user.securityquestion2
      );
      if (q2) this.userForm.patchValue({ securityquestion2: q2.id });
    }

    // if (user.securityanswer1) this.userForm.patchValue({ securityanswer1: '**********' });
    // if (user.securityanswer2) this.userForm.patchValue({ securityanswer2: '**********' });
  }

  getAPIUrl(endpoint: string): string {
    // Replace with your actual base URL builder logic
    return `/api/${endpoint}`;
  }
}
