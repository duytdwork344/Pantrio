import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { email, displayName, password } = this.form.getRawValue();
    this.auth.register(email, displayName, password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.submitting.set(false);
        const msg = err.error?.message;
        this.error.set(
          Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Register failed'),
        );
      },
    });
  }
}
