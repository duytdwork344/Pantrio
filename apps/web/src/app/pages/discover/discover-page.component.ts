import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type DemoRecipe = {
  slug: string;
  title: string;
  description: string;
};

@Component({
  selector: 'app-discover-page',
  imports: [RouterLink],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
})
export class DiscoverPageComponent {
  readonly recipes: DemoRecipe[] = [
    {
      slug: 'chicken-tomato-pasta',
      title: 'Chicken Tomato Pasta',
      description: 'Nhanh, dùng được cà chua và gà đang có trong tủ.',
    },
    {
      slug: 'carbonara',
      title: 'Carbonara',
      description: 'Cổ điển — pasta, trứng, bacon, phô mai.',
    },
  ];
}
