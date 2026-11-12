<?php

namespace App\Http\Controllers;

use App\Actions\Auth\LoginUser;
use App\Actions\Auth\LogoutUser;
use App\Actions\Auth\RegisterUser;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\AuthTokenResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, RegisterUser $registerUser): JsonResponse
    {
        /** @var array{name: string, email: string, password: string} $input */
        $input = $request->validated();

        return (new AuthTokenResource($registerUser->handle($input)))
            ->response()
            ->setStatusCode(201);
    }

    public function login(LoginRequest $request, LoginUser $loginUser): AuthTokenResource
    {
        return new AuthTokenResource($loginUser->handle(
            $request->string('email')->toString(),
            $request->string('password')->toString(),
        ));
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request, LogoutUser $logoutUser): Response
    {
        /** @var User $user */
        $user = $request->user();

        $logoutUser->handle($user);

        return response()->noContent();
    }
}
