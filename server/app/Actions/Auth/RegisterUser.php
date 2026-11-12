<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

class RegisterUser
{
    public function __construct(private IssueAuthToken $issueAuthToken) {}

    /**
     * @param  array{name: string, email: string, password: string}  $input
     * @return array{token: string, user: User}
     */
    public function handle(array $input): array
    {
        // Two racing registrations both pass the unique rule; the database index catches the
        // second one. No transaction here: Postgres aborts a transaction after the violation.
        try {
            $user = User::create($input);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'email' => __('validation.unique', ['attribute' => 'email']),
            ]);
        }

        return $this->issueAuthToken->handle($user);
    }
}
