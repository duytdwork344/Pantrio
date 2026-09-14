import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

type RecipeCopy = {
  title: string;
  body: string;
  ingredients: string[];
};

const RECIPE_COPY: Record<string, RecipeCopy> = {
  carbonara: {
    title: 'Carbonara',
    body: 'Pasta, trứng, bacon và phô mai. Recipe quantity là gợi ý — inventory sẽ ước lượng khi bạn Cook.',
    ingredients: ['Pasta 200g', 'Egg 2', 'Bacon 100g', 'Cheese 50g'],
  },
  'chicken-tomato-pasta': {
    title: 'Chicken Tomato Pasta',
    body: 'Món discovery mặc định cho USP: cook with what you have.',
    ingredients: ['Chicken 300g', 'Tomato 200g', 'Onion 100g', 'Pasta 200g'],
  },
};

@Component({
  selector: 'app-recipe-detail-page',
  imports: [RouterLink],
  templateUrl: './recipe-detail-page.component.html',
  styleUrl: './recipe-detail-page.component.scss',
})
export class RecipeDetailPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly slug = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('slug') ?? '')),
    { initialValue: '' },
  );

  readonly recipe = computed(() => {
    const slug = this.slug();
    return (
      RECIPE_COPY[slug] ?? {
        title: slug.replace(/-/g, ' '),
        body: 'Chi tiết recipe sẽ được hydrate từ NestJS API (/api/recipes/:slug).',
        ingredients: [] as string[],
      }
    );
  });
}
