<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use App\Models\CompanyData;
use Illuminate\Support\Facades\DB;
use Ramsey\Uuid\Uuid;

/**
 * Seeder for creating company data following PHP 8.4 and Laravel best practices.
 * 
 * This seeder creates the main company information and any subsidiary companies,
 * using modern PHP features and Laravel conventions.
 */
class CompanySeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->createMainCompany();
        // Subsidiarias comentadas por solicitud
        // $this->createSubsidiaryCompanies();
    }

    /**
     * Create the main company record.
     */
    private function createMainCompany(): void
    {
        CompanyData::firstOrCreate(
            ['email' => 'info@aquashieldrestorationusa.com'],
            [
                'uuid' => Uuid::uuid4()->toString(),
                'name' => 'Victor Lara',
                'company_name' => 'Aquashield Restoration USA',
                'signature_path' => '/signatures/victor_lara_signature.png',
                'email' => 'info@aquashieldrestorationusa.com',
                'phone' => '+17135876423',
                'address' => '1321 Upland Dr. PMB 4455, Houston, TX 77043',
                'website' => 'https://aquashieldrestorationusa.com',
                'latitude' => 29.75516,
                'longitude' => -95.3984135,
                'user_id' => 1,
                'facebook_link' => 'https://www.facebook.com/aquashieldrestorationusa/',
                'instagram_link' => 'https://www.instagram.com/aquashieldrestorationusa/',
                'linkedin_link' => 'https://www.linkedin.com/company/v-general-contractors/',
                'twitter_link' => 'https://twitter.com/aquashieldrestorationusa'
            ]
        );
    }

    /**
     * Create subsidiary or partner companies.
     */
    private function createSubsidiaryCompanies(): void
    {
        $subsidiaries = [
            [
                'uuid' => Uuid::uuid4()->toString(),
                'name' => 'Maria Rodriguez',
                'company_name' => 'V Roofing Solutions',
                'signature_path' => '/signatures/maria_rodriguez_signature.png',
                'email' => 'roofing@aquashieldrestorationusa.com',
                'phone' => '+1 (555) 123-4568',
                'address' => '124 Construction Ave, Miami, FL 33101',
                'website' => 'https://vroofingsolutions.com',
                'latitude' => 25.7617,
                'longitude' => -80.1918,
                'user_id' => 2,
                'facebook_link' => 'https://www.facebook.com/vroofingsolutions/',
                'instagram_link' => 'https://www.instagram.com/vroofingsolutions/',
                'linkedin_link' => 'https://www.linkedin.com/company/v-roofing-solutions/',
                'twitter_link' => 'https://twitter.com/vroofingsolutions'
            ],
            [
                'uuid' => Uuid::uuid4()->toString(),
                'name' => 'Carlos Martinez',
                'company_name' => 'V Restoration Services',
                'signature_path' => '/signatures/carlos_martinez_signature.png',
                'email' => 'restoration@aquashieldrestorationusa.com',
                'phone' => '+1 (555) 123-4569',
                'address' => '125 Construction Ave, Miami, FL 33101',
                'website' => 'https://vrestorationservices.com',
                'latitude' => 25.7617,
                'longitude' => -80.1918,
                'user_id' => 3,
                'facebook_link' => 'https://www.facebook.com/vrestorationservices/',
                'instagram_link' => 'https://www.instagram.com/vrestorationservices/',
                'linkedin_link' => 'https://www.linkedin.com/company/v-restoration-services/',
                'twitter_link' => 'https://twitter.com/vrestorationservices'
            ],
        ];

        foreach ($subsidiaries as $subsidiary) {
            CompanyData::firstOrCreate(
                ['email' => $subsidiary['email']],
                $subsidiary
            );
        }
    }
}