import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { isSupportedLocale } from '@pantrio/shared';
import { AuthService } from './core/auth.service';
import { LocaleService } from './core/i18n/locale.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly title = 'Pantrio';
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocaleService);

  onLocaleChange(value: string): void {
    if (isSupportedLocale(value)) this.i18n.setLocale(value);
  }
}
