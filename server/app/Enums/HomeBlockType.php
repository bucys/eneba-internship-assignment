<?php

namespace App\Enums;

enum HomeBlockType: string
{
    case Banners = 'banners';
    case BestSellers = 'best_sellers';
    case Deals = 'deals';
    case Products = 'products';
}
