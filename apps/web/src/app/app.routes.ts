import { Routes } from '@angular/router';
import { DiscoverPageComponent } from './pages/discover/discover-page.component';
import { RecipeDetailPageComponent } from './pages/recipe-detail/recipe-detail-page.component';

export const routes: Routes = [
  { path: '', component: DiscoverPageComponent },
  { path: 'recipes/:slug', component: RecipeDetailPageComponent },
  { path: '**', redirectTo: '' },
];
