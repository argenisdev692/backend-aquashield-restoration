<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Modules\Users\Infrastructure\Persistence\Eloquent\Models\UserEloquentModel as User;
use Ramsey\Uuid\Uuid;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ============================================
        // CORE ROLES
        // ============================================

        $superAdminRole = Role::firstOrCreate(['name' => 'SUPER_ADMIN', 'guard_name' => 'web'], ['uuid' => Uuid::uuid4()->toString()]);
        $adminRole = Role::firstOrCreate(['name' => 'ADMIN', 'guard_name' => 'web'], ['uuid' => Uuid::uuid4()->toString()]);
        $userRole = Role::firstOrCreate(['name' => 'USER', 'guard_name' => 'web'], ['uuid' => Uuid::uuid4()->toString()]);
        $guestRole = Role::firstOrCreate(['name' => 'GUEST', 'guard_name' => 'web'], ['uuid' => Uuid::uuid4()->toString()]);

        // Flush Spatie's permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ============================================
        // SUPER ADMIN USER
        // ============================================

        $superAdminUser = User::firstOrCreate(
            ['email' => 'argenis692@gmail.com'],
            [
                'name' => 'Argenis',
                'last_name' => 'Gonzalez',
                'username' => 'argenis692',
                'password' => bcrypt('argenis01='),
                'uuid' => Uuid::uuid4()->toString(),
                'address' => '123 Random Web Dev St, Suite 404, Tech City',
                'terms_and_conditions' => true
            ]
        );

        $superAdminUser->assignRole('SUPER_ADMIN');

        // ============================================
        // RANDOM USERS
        // ============================================

        $adminUser = User::firstOrCreate(
            ['email' => 'admin@vidula.com'],
            [
                'name' => 'Admin',
                'last_name' => 'User',
                'username' => 'admin_user',
                'password' => bcrypt('password123'),
                'uuid' => Uuid::uuid4()->toString(),
                'address' => 'Admin Address, City',
                'terms_and_conditions' => true
            ]
        );
        $adminUser->assignRole('ADMIN');

        $standardUser = User::firstOrCreate(
            ['email' => 'user@vidula.com'],
            [
                'name' => 'Standard',
                'last_name' => 'User',
                'username' => 'standard_user',
                'password' => bcrypt('password123'),
                'uuid' => Uuid::uuid4()->toString(),
                'address' => 'User Address, City',
                'terms_and_conditions' => true
            ]
        );
        $standardUser->assignRole('USER');

        $guestUser = User::firstOrCreate(
            ['email' => 'guest@vidula.com'],
            [
                'name' => 'Guest',
                'last_name' => 'User',
                'username' => 'guest_user',
                'password' => bcrypt('password123'),
                'uuid' => Uuid::uuid4()->toString(),
                'address' => 'Guest Address, City',
                'terms_and_conditions' => true
            ]
        );
        $guestUser->assignRole('GUEST');
    }
}