<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Modules\CompanyData\Infrastructure\Persistence\Eloquent\Models\CompanyDataEloquentModel as CompanyData;
use Modules\Users\Infrastructure\Persistence\Eloquent\Models\UserEloquentModel as User;
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
        $userId = User::query()
            ->where('email', 'argenis692@gmail.com')
            ->value('id');

        if (!is_int($userId)) {
            throw new \RuntimeException('UserSeeder must create argenis692@gmail.com before CompanySeeder runs.');
        }

        $company = CompanyData::query()->firstOrNew(['email' => 'argenis692@gmail.com']);
        $company->uuid ??= Uuid::uuid4()->toString();
        $company->fill([
            'name' => 'Argenis Carrillo Gonzalez',
            'company_name' => 'Vidula',
            'owner_name' => 'Argenis Carrillo Gonzalez',
            'tax_id' => '316416584',
            'identity_document' => '2175V64V7',
            'signature_path' => null,
            'email' => 'argenis692@gmail.com',
            'invoice_email' => 'argenis692@gmail.com',
            'phone' => '+351 963 490 414',
            'invoice_phone' => '+351 963 490 414',
            'address' => 'Rua da Saudade, Nº 1, R/C Esq., 6200-386 Covilhã, Portugal',
            'address_line_1' => 'Rua da Saudade, Nº 1, R/C Esq.',
            'address_line_2' => null,
            'postal_code' => '6200-386',
            'city' => 'Covilhã',
            'country' => 'Portugal',
            'country_code' => 'PT',
            'invoice_prefix' => 'FAC',
            'next_invoice_number' => 1,
            'default_currency' => 'EUR',
            'website' => null,
            'latitude' => null,
            'longitude' => null,
            'user_id' => $userId,
            'facebook_link' => null,
            'instagram_link' => null,
            'linkedin_link' => null,
            'twitter_link' => null,
        ]);
        $company->save();
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
                'email' => 'roofing@vgeneralcontractors.com',
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
                'company_name' => 'V Services',
                'signature_path' => '/signatures/carlos_martinez_signature.png',
                'email' => 'services@vgeneralcontractors.com',
                'phone' => '+1 (555) 123-4569',
                'address' => '125 Construction Ave, Miami, FL 33101',
                'website' => 'https://vservices.com',
                'latitude' => 25.7617,
                'longitude' => -80.1918,
                'user_id' => 3,
                'facebook_link' => 'https://www.facebook.com/vservices/',
                'instagram_link' => 'https://www.instagram.com/vservices/',
                'linkedin_link' => 'https://www.linkedin.com/company/v-services/',
                'twitter_link' => 'https://twitter.com/vservices'
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