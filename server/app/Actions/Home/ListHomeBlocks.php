<?php

namespace App\Actions\Home;

use App\Models\HomeBlock;
use Illuminate\Database\Eloquent\Collection;

class ListHomeBlocks
{
    /**
     * @return Collection<int, HomeBlock>
     */
    public function handle(): Collection
    {
        return HomeBlock::query()
            ->where('is_active', true)
            ->orderBy('position')
            ->orderBy('id')
            ->get(['id', 'type', 'title']);
    }
}
