<?php

namespace App\Http\Controllers;

use App\Actions\Home\ListBanners;
use App\Actions\Home\ListBestSellers;
use App\Actions\Home\ListDeals;
use App\Actions\Home\ListHomeBlocks;
use App\Http\Resources\BannerResource;
use App\Http\Resources\HomeBlockResource;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class HomeController extends Controller
{
    public function layout(ListHomeBlocks $listHomeBlocks): AnonymousResourceCollection
    {
        return HomeBlockResource::collection($listHomeBlocks->handle());
    }

    public function banners(ListBanners $listBanners): AnonymousResourceCollection
    {
        return BannerResource::collection($listBanners->handle());
    }

    public function bestSellers(ListBestSellers $listBestSellers): AnonymousResourceCollection
    {
        return ProductResource::collection($listBestSellers->handle());
    }

    public function deals(ListDeals $listDeals): AnonymousResourceCollection
    {
        return ProductResource::collection($listDeals->handle());
    }
}
