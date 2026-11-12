<?php

namespace App\Http\Controllers;

use App\Actions\Catalog\ListProducts;
use App\Actions\Catalog\ShowProduct;
use App\Http\Resources\ProductDetailResource;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(ListProducts $listProducts): AnonymousResourceCollection
    {
        return ProductResource::collection($listProducts->handle());
    }

    public function show(string $slug, ShowProduct $showProduct): ProductDetailResource
    {
        return new ProductDetailResource($showProduct->handle($slug));
    }
}
