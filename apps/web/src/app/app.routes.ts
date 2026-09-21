import { Routes } from '@angular/router';
import { DiscoverPageComponent } from './pages/discover/discover-page.component';
import { RecipeDetailPageComponent } from './pages/recipe-detail/recipe-detail-page.component';
import { LoginPageComponent } from './pages/login/login-page.component';
import { RegisterPageComponent } from './pages/register/register-page.component';

export const routes: Routes = [
  { path: '', component: DiscoverPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'recipes/:slug', component: RecipeDetailPageComponent },
  { path: '**', redirectTo: '' },
];
