import { Routes } from '@angular/router';
import { DiscoverPageComponent } from './pages/discover/discover-page.component';
import { RecipeDetailPageComponent } from './pages/recipe-detail/recipe-detail-page.component';
import { LoginPageComponent } from './pages/login/login-page.component';
import { RegisterPageComponent } from './pages/register/register-page.component';
import { ArticlesPageComponent } from './pages/articles/articles-page.component';
import { ArticleDetailPageComponent } from './pages/articles/article-detail-page.component';
import { StudioArticlesPageComponent } from './pages/studio/studio-articles-page.component';
import { StudioArticleEditorPageComponent } from './pages/studio/studio-article-editor-page.component';

export const routes: Routes = [
  { path: '', component: DiscoverPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'recipes/:slug', component: RecipeDetailPageComponent },
  { path: 'articles', component: ArticlesPageComponent },
  { path: 'articles/:slug', component: ArticleDetailPageComponent },
  { path: 'studio/articles/new', component: StudioArticleEditorPageComponent },
  { path: 'studio/articles/:id', component: StudioArticleEditorPageComponent },
  { path: 'studio/articles', component: StudioArticlesPageComponent },
  { path: '**', redirectTo: '' },
];
