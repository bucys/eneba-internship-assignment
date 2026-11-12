<?php

namespace App\Actions\Auth;

use App\Models\User;

class IssueAuthToken
{
    /**
     * @return array{token: string, user: User}
     */
    public function handle(User $user): array
    {
        $minutes = (int) config('sanctum.expiration');

        $token = $user->createToken('spa', ['*'], now()->addMinutes($minutes));

        return ['token' => $token->plainTextToken, 'user' => $user];
    }
}
