<?php

namespace App\Http\Controllers;

use App\Actions\Catalog\SuggestProducts;
use App\Http\Requests\Catalog\SearchSuggestionsRequest;
use App\Http\Resources\SearchSuggestionResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SearchSuggestionController extends Controller
{
    public function __invoke(SearchSuggestionsRequest $request, SuggestProducts $suggestProducts): AnonymousResourceCollection
    {
        return SearchSuggestionResource::collection($suggestProducts->handle($request->terms()));
    }
}
