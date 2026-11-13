<?php

namespace App\Http\Controllers;

use App\Actions\Catalog\ListCatalogFilters;
use App\Http\Resources\CatalogFiltersResource;

class CatalogFilterController extends Controller
{
    public function __invoke(ListCatalogFilters $listCatalogFilters): CatalogFiltersResource
    {
        return new CatalogFiltersResource($listCatalogFilters->handle());
    }
}
