<?php

namespace App\Models;

use App\Enums\HomeBlockType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['type', 'title', 'position', 'is_active'])]
class HomeBlock extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => HomeBlockType::class,
            'is_active' => 'boolean',
        ];
    }
}
