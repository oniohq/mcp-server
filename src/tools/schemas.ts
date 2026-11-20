import * as z from 'zod';
import type { CreateWishInput, Wish, Wishlist } from '../onio-api.js';

export const WishlistId = z.uuid().describe('The `id` of a wishlist from `list_wishlists`.');
export const WishId = z.uuid().describe('The `id` of a wish from `get_wishlist`.');

export const Occasion = z
  .enum([
    'birthday',
    'christmas',
    'wedding',
    'baby',
    'anniversary',
    'graduation',
    'housewarming',
    'other',
  ] as const satisfies Wishlist['occasion'][])
  .describe('`baby` is Baby Shower in the app.');

export const Priority = z
  .enum(['highest', 'high', 'normal'] as const satisfies Wish['priority'][])
  .describe('`highest` is Very high in the app.');

export const PriceRange = z
  .enum([
    'under_15',
    '15_to_35',
    '35_to_75',
    '75_to_150',
    'over_150',
  ] as const satisfies NonNullable<Wish['priceRange']>[])
  .describe('Price band in euros: under 15, 15–35, 35–75, 75–150 or over 150.');

export const WishStatus = z
  .enum(['draft', 'published'] as const satisfies NonNullable<CreateWishInput['status']>[])
  .describe(
    '`draft` is Private: only the owner sees the wish. `published`: everyone who can see the wishlist sees the wish.',
  );
