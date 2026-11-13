<?php

namespace App\Enums;

enum ProductSort: string
{
    case Name = 'name';
    case PriceAsc = 'price_asc';
    case PriceDesc = 'price_desc';
    case Relevance = 'relevance';
}
